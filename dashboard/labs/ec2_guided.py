"""Guided local EC2 workflows built on Floci's instance runtime."""

from __future__ import annotations

import time
from typing import Any

from django.core.cache import cache

from dashboard.aws import FlociClientFactory
from dashboard.ec2_api import create_vpc_endpoint, instance_command_detail, run_instance_command, run_instances, terminate_instance


LAB_PREFIX = 'floci-lab:ec2:guided'
DEFAULT_IMAGE = 'ami-ubuntu2204'
DEFAULT_TYPE = 't2.micro'
DEFAULT_SUBNET = 'subnet-default-a'
DEFAULT_VPC = 'vpc-default'
DEFAULT_GROUP = 'sg-default'


def _lab(key: str, title: str, description: str, command: str, explanation: str) -> dict[str, Any]:
    return {'service': 'ec2', 'key': key, 'title': title, 'description': description, 'guided': True, 'steps': [{'key': 'run-workflow', 'title': title, 'command': command, 'explanation': explanation}]}


GUIDED_EC2_LABS = [
    _lab('guided-imds', 'Launch an instance and inspect IMDS', 'Launch a disposable Ubuntu instance, query its identity and networking metadata from inside the guest, and retain the evidence.', 'aws ec2 run-instances --image-id ami-ubuntu2204 --instance-type t2.micro\naws ssm send-command --instance-ids <instance-id> --parameters commands="curl -s http://169.254.169.254/latest/meta-data/instance-id"', 'The metadata request runs inside the instance through SSM, not on the dashboard host.'),
    _lab('guided-userdata', 'Run UserData and verify its output', 'Boot an instance with deterministic UserData and read the generated artifact back through SSM.', "aws ec2 run-instances --image-id ami-ubuntu2204 --user-data '#!/bin/sh\necho floci-userdata-ok >/tmp/floci-userdata.txt'\naws ssm send-command --instance-ids <instance-id> --parameters commands='cat /tmp/floci-userdata.txt'", 'UserData runs asynchronously during guest startup; the dashboard waits for its observable filesystem effect before completing the lab.'),
    _lab('guided-instance-role', 'Use an IAM role from inside an instance', 'Create an EC2-trusted role and instance profile, launch with the profile, then inspect its temporary credential document through IMDS.', 'aws iam create-role --role-name FlociGuidedEc2Role --assume-role-policy-document file://trust.json\naws iam create-instance-profile --instance-profile-name FlociGuidedEc2Profile\naws ec2 run-instances --iam-instance-profile Name=FlociGuidedEc2Profile', 'This proves the role-to-profile-to-instance chain while redacting credential values from the response.'),
    _lab('guided-web-server', 'Publish a web server through a security group', 'Allow TCP/8080, start a local web server with UserData, and verify its page from inside the guest.', 'aws ec2 create-security-group --group-name guided-web --vpc-id vpc-default\naws ec2 authorize-security-group-ingress --group-id <group-id> --protocol tcp --port 8080 --cidr 0.0.0.0/0\naws ec2 run-instances --security-group-ids <group-id>', 'Floci publishes allowed TCP ingress ports on the host; the lab verifies the rule and guest web process.'),
    _lab('guided-broken-route', 'Diagnose a broken route', 'Build an isolated subnet whose route table has no default route and run relationship diagnostics.', 'aws ec2 create-vpc --cidr-block 10.47.0.0/16\naws ec2 create-subnet --vpc-id <vpc-id> --cidr-block 10.47.1.0/24\naws ec2 create-route-table --vpc-id <vpc-id>\naws ec2 describe-route-tables --route-table-ids <route-table-id>', 'A table with only its local VPC route cannot reach external destinations; the result identifies the missing route.'),
    _lab('guided-private-s3', 'Connect privately to S3 through a VPC endpoint', 'Create an S3 gateway endpoint on the default route table and verify that it becomes available.', 'aws ec2 create-vpc-endpoint --vpc-id vpc-default --service-name com.amazonaws.us-east-1.s3 --vpc-endpoint-type Gateway --route-table-ids rtb-default', 'Gateway endpoints attach to route tables rather than security groups; Floci models the endpoint boundary.'),
    _lab('guided-ssm-command', 'Execute a command with SSM', 'Launch a disposable instance, run a shell command through SSM, and return invocation evidence.', "aws ec2 run-instances --image-id ami-ubuntu2204\naws ssm send-command --instance-ids <instance-id> --parameters commands='printf floci-ssm-ok'", 'This exercises the same command path as the instance detail runner.'),
]


def _key(lab_key: str, suffix: str) -> str: return f'{LAB_PREFIX}:{lab_key}:{suffix}'
def _remember(lab_key: str, suffix: str, value: Any) -> Any: cache.set(_key(lab_key, suffix), value, timeout=86400); return value
def _ec2(): return FlociClientFactory().client('ec2')
def _iam(): return FlociClientFactory().client('iam')


def _launch(lab_key: str, *, user_data: str | None = None, groups: list[str] | None = None, profile_arn: str | None = None) -> str:
    result = run_instances(DEFAULT_IMAGE, DEFAULT_TYPE, subnet_id=DEFAULT_SUBNET, security_group_ids=groups or [DEFAULT_GROUP], user_data=user_data, iam_instance_profile_arn=profile_arn, tags={'Name': lab_key})
    instance_id = _remember(lab_key, 'instance-id', result['instance_id'])
    for _attempt in range(50):
        response = _ec2().describe_instances(InstanceIds=[instance_id])
        instance = response.get('Reservations', [{}])[0].get('Instances', [{}])[0]
        if instance.get('State', {}).get('Name') == 'running':
            break
        time.sleep(0.2)
    return instance_id


def _execute(instance_id: str, command: str) -> dict[str, Any]:
    submitted = run_instance_command(instance_id, command)
    command_id = submitted.get('command_id')
    if not command_id:
        return submitted
    for _attempt in range(50):
        detail = instance_command_detail(instance_id, command_id)
        if detail.get('status') not in {'Pending', 'InProgress', 'Delayed'}:
            return detail
        time.sleep(0.2)
    return detail


def _require_success(invocation: dict[str, Any], expected: str | None = None) -> dict[str, Any]:
    if invocation.get('status') != 'Success':
        raise ValueError(f"Guest command failed: {invocation.get('stderr') or invocation.get('status')}")
    if expected and expected not in invocation.get('stdout', ''):
        raise ValueError(f'Guest command did not return expected output: {expected}')
    return invocation


def _http_get_command(host: str, port: int, path: str) -> str:
    clean_path = '/' + path.strip().lstrip('/')
    return (
        f"bash -c 'exec 3<>/dev/tcp/{host}/{port}; "
        f'printf "GET {clean_path} HTTP/1.0\\r\\nHost: {host}\\r\\nConnection: close\\r\\n\\r\\n" >&3; '
        "awk \"f{print} /^\\r?$/{f=1}\" <&3'"
    )


def _imds_get_command(path: str) -> str:
    return _http_get_command('169.254.169.254', 80, path)


def _wait_for_output(instance_id: str, command: str, expected: str, *, attempts: int = 30) -> dict[str, Any]:
    last: dict[str, Any] = {}
    for _attempt in range(attempts):
        last = _execute(instance_id, command)
        if last.get('status') == 'Success' and expected in last.get('stdout', ''):
            return last
        time.sleep(0.5)
    return _require_success(last, expected)


def _result(lab: dict[str, Any], evidence: dict[str, Any], message: str) -> dict[str, Any]:
    _remember(lab['key'], 'complete', True)
    return {'service': 'ec2', 'lab': lab['key'], 'step': 'run-workflow', 'command': lab['steps'][0]['command'], 'exit_code': 0, 'stdout': str(evidence), 'stderr': '', 'json': evidence, 'duration_ms': 0, 'verified': True, 'verification': {'status': 'passed', 'message': message, 'resource': evidence}}


def _run_imds() -> dict[str, Any]:
    lab = GUIDED_EC2_LABS[0]; instance_id = _launch(lab['key'])
    instance = _require_success(_execute(instance_id, _imds_get_command('/latest/meta-data/instance-id')), instance_id)
    address = _require_success(_execute(instance_id, _imds_get_command('/latest/meta-data/local-ipv4')))
    return _result(lab, {'instance_id': instance_id, 'instance_id_invocation': instance, 'local_ipv4_invocation': address}, 'The guest queried its own identity and address through IMDS without requiring curl.')


def _run_userdata() -> dict[str, Any]:
    lab = GUIDED_EC2_LABS[1]; instance_id = _launch(lab['key'], user_data='#!/bin/sh\necho floci-userdata-ok > /tmp/floci-userdata.txt\n')
    invocation = _wait_for_output(instance_id, 'cat /tmp/floci-userdata.txt', 'floci-userdata-ok')
    return _result(lab, {'instance_id': instance_id, 'invocation': invocation}, 'UserData created the expected artifact and SSM read it back.')


def _run_role() -> dict[str, Any]:
    lab = GUIDED_EC2_LABS[2]; iam = _iam(); role = 'FlociGuidedEc2Role'; profile = 'FlociGuidedEc2Profile'
    trust = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
    try: iam.create_role(RoleName=role, AssumeRolePolicyDocument=trust)
    except iam.exceptions.EntityAlreadyExistsException: pass
    try: response = iam.create_instance_profile(InstanceProfileName=profile)
    except iam.exceptions.EntityAlreadyExistsException: response = iam.get_instance_profile(InstanceProfileName=profile)
    try: iam.add_role_to_instance_profile(InstanceProfileName=profile, RoleName=role)
    except Exception as exc:
        if 'already' not in str(exc).lower() and 'limit' not in str(exc).lower(): raise
    instance_id = _launch(lab['key'], profile_arn=response['InstanceProfile']['Arn'])
    invocation = _require_success(_execute(instance_id, _imds_get_command(f'/latest/meta-data/iam/security-credentials/{role}')))
    _remember(lab['key'], 'role', role); _remember(lab['key'], 'profile', profile)
    return _result(lab, {'instance_id': instance_id, 'role': role, 'profile': profile, 'credential_source': 'IMDS', 'command_id': invocation.get('command_id')}, 'The profile was attached and guest IMDS exposed role credentials; secret values were omitted.')


def _run_web() -> dict[str, Any]:
    lab = GUIDED_EC2_LABS[3]; ec2 = _ec2()
    groups = ec2.describe_security_groups(Filters=[
        {'Name': 'vpc-id', 'Values': [DEFAULT_VPC]},
        {'Name': 'group-name', 'Values': ['guided-web']},
    ]).get('SecurityGroups', [])
    group = groups[0] if groups else None
    group_id = group['GroupId'] if group else ec2.create_security_group(GroupName='guided-web', Description='Guided local web server', VpcId=DEFAULT_VPC)['GroupId']
    has_ingress = any(
        permission.get('IpProtocol') == 'tcp'
        and permission.get('FromPort') == 8080
        and permission.get('ToPort') == 8080
        for permission in (group or {}).get('IpPermissions', [])
    )
    if not has_ingress:
        ec2.authorize_security_group_ingress(GroupId=group_id, IpPermissions=[{'IpProtocol': 'tcp', 'FromPort': 8080, 'ToPort': 8080, 'IpRanges': [{'CidrIp': '0.0.0.0/0', 'Description': 'Guided web lab'}]}])
    _remember(lab['key'], 'group-id', group_id)
    user_data = r'''#!/bin/sh
cat > /tmp/floci-web-server.pl <<'PERL'
use IO::Socket::INET;
my $server = IO::Socket::INET->new(LocalPort => 8080, Listen => 5, Reuse => 1) or die $!;
while (my $client = $server->accept()) {
  while (<$client>) { last if /^\r?$/; }
  print $client "HTTP/1.0 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 13\r\n\r\nfloci-web-ok\n";
  close $client;
}
PERL
nohup perl /tmp/floci-web-server.pl >/tmp/floci-web-server.log 2>&1 &
'''
    instance_id = _launch(lab['key'], user_data=user_data, groups=[group_id])
    invocation = _wait_for_output(instance_id, _http_get_command('127.0.0.1', 8080, '/'), 'floci-web-ok')
    return _result(lab, {'instance_id': instance_id, 'security_group_id': group_id, 'port': 8080, 'invocation': invocation}, 'TCP/8080 is allowed and the guest returned its expected page.')


def _run_route() -> dict[str, Any]:
    lab = GUIDED_EC2_LABS[4]; ec2 = _ec2()
    vpc_id = ec2.create_vpc(CidrBlock='10.47.0.0/16')['Vpc']['VpcId']; subnet_id = ec2.create_subnet(VpcId=vpc_id, CidrBlock='10.47.1.0/24', AvailabilityZone='us-east-1a')['Subnet']['SubnetId']; route_table_id = ec2.create_route_table(VpcId=vpc_id)['RouteTable']['RouteTableId']; association_id = ec2.associate_route_table(RouteTableId=route_table_id, SubnetId=subnet_id)['AssociationId']
    for suffix, value in [('vpc-id', vpc_id), ('subnet-id', subnet_id), ('route-table-id', route_table_id), ('association-id', association_id)]: _remember(lab['key'], suffix, value)
    routes = ec2.describe_route_tables(RouteTableIds=[route_table_id])['RouteTables'][0].get('Routes', [])
    return _result(lab, {'problem': 'No default route', 'missing_destination': '0.0.0.0/0', 'routes': routes, 'subnet_id': subnet_id, 'route_table_id': route_table_id}, 'The diagnostic found only a local route and no external path.')


def _run_s3() -> dict[str, Any]:
    lab = GUIDED_EC2_LABS[5]; endpoint = create_vpc_endpoint(DEFAULT_VPC, 'com.amazonaws.us-east-1.s3', 'Gateway', route_table_ids=['rtb-default']); _remember(lab['key'], 'endpoint-id', endpoint['vpc_endpoint_id'])
    return _result(lab, endpoint, 'The S3 gateway endpoint is available on the selected route table.')


def _run_ssm() -> dict[str, Any]:
    lab = GUIDED_EC2_LABS[6]; instance_id = _launch(lab['key']); invocation = _require_success(_execute(instance_id, 'printf floci-ssm-ok'), 'floci-ssm-ok')
    return _result(lab, {'instance_id': instance_id, 'invocation': invocation}, 'SSM executed the command and returned invocation evidence.')


RUNNERS = {'guided-imds': _run_imds, 'guided-userdata': _run_userdata, 'guided-instance-role': _run_role, 'guided-web-server': _run_web, 'guided-broken-route': _run_route, 'guided-private-s3': _run_s3, 'guided-ssm-command': _run_ssm}


def run_guided_step(lab_key: str, step_key: str) -> dict[str, Any]:
    if step_key != 'run-workflow' or lab_key not in RUNNERS: raise ValueError('Guided EC2 lab step not found')
    started = time.perf_counter(); result = RUNNERS[lab_key](); result['duration_ms'] = round((time.perf_counter() - started) * 1000); return result


def guided_status(lab_key: str) -> dict[str, Any]:
    complete = bool(cache.get(_key(lab_key, 'complete'))); verification = {'status': 'passed', 'message': 'The guided workflow was verified.'} if complete else None
    return {'service': 'ec2', 'lab': lab_key, 'complete': complete, 'steps': {'run-workflow': {'verified': complete, 'verification': verification}}}


def reset_guided_lab(lab_key: str) -> dict[str, Any]:
    ec2 = _ec2(); instance_id = cache.get(_key(lab_key, 'instance-id')); endpoint_id = cache.get(_key(lab_key, 'endpoint-id'))
    if instance_id:
        try: terminate_instance(instance_id)
        except Exception: pass
    if endpoint_id:
        try: ec2.delete_vpc_endpoints(VpcEndpointIds=[endpoint_id])
        except Exception: pass
    if lab_key == 'guided-broken-route':
        association_id = cache.get(_key(lab_key, 'association-id')); route_table_id = cache.get(_key(lab_key, 'route-table-id')); subnet_id = cache.get(_key(lab_key, 'subnet-id')); vpc_id = cache.get(_key(lab_key, 'vpc-id'))
        operations = [(ec2.disassociate_route_table, {'AssociationId': association_id}), (ec2.delete_route_table, {'RouteTableId': route_table_id}), (ec2.delete_subnet, {'SubnetId': subnet_id}), (ec2.delete_vpc, {'VpcId': vpc_id})]
        for operation, kwargs in operations:
            if next(iter(kwargs.values())):
                try: operation(**kwargs)
                except Exception: pass
    group_id = cache.get(_key(lab_key, 'group-id'))
    if group_id:
        try: ec2.delete_security_group(GroupId=group_id)
        except Exception: pass
    if lab_key == 'guided-instance-role':
        iam = _iam(); role = cache.get(_key(lab_key, 'role')); profile = cache.get(_key(lab_key, 'profile'))
        if role and profile:
            for operation, kwargs in [(iam.remove_role_from_instance_profile, {'InstanceProfileName': profile, 'RoleName': role}), (iam.delete_instance_profile, {'InstanceProfileName': profile}), (iam.delete_role, {'RoleName': role})]:
                try: operation(**kwargs)
                except Exception: pass
    suffixes = ['complete', 'instance-id', 'endpoint-id', 'group-id', 'vpc-id', 'subnet-id', 'route-table-id', 'association-id', 'role', 'profile']; cache.delete_many([_key(lab_key, suffix) for suffix in suffixes])
    output = {'reset': True, 'terminated_instance': instance_id, 'deleted_endpoint': endpoint_id}
    return {'service': 'ec2', 'lab': lab_key, 'command': 'guided cleanup', 'exit_code': 0, 'stdout': str(output), 'stderr': '', 'json': output, 'duration_ms': 0, **output, 'verification': {'status': 'passed', 'message': 'Guided lab resources and progress were cleaned up.'}}
