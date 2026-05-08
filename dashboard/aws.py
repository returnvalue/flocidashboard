import os
import json
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import urlopen
from typing import Any, Callable, Optional

import boto3
from botocore import xform_name
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError, ProfileNotFound
from django.conf import settings


@dataclass(frozen=True)
class ResourceResult:
    name: str
    label: str
    count: Optional[int]
    items: list[dict[str, Any]]
    error: Optional[str] = None


class FlociClientFactory:
    def __init__(self) -> None:
        self.endpoint_url = os.getenv(
            'FLOCI_AWS_ENDPOINT_URL',
            settings.FLOCI_AWS_ENDPOINT_URL,
        )
        self.region = os.getenv('AWS_DEFAULT_REGION') or os.getenv(
            'FLOCI_AWS_REGION',
            settings.FLOCI_AWS_REGION,
        )
        self.profile = os.getenv('AWS_PROFILE') or os.getenv(
            'FLOCI_AWS_PROFILE',
            settings.FLOCI_AWS_PROFILE,
        )
        self.config = Config(
            retries={'max_attempts': 2, 'mode': 'standard'},
            connect_timeout=2,
            read_timeout=5,
        )
        self._validate_local_endpoint()

    def _validate_local_endpoint(self) -> None:
        parsed = urlparse(self.endpoint_url)
        allowed_hosts = {'localhost', '127.0.0.1', '::1'}

        if parsed.hostname not in allowed_hosts:
            raise ValueError(
                'Refusing to use a non-local AWS endpoint. '
                f'FLOCI_AWS_ENDPOINT_URL is {self.endpoint_url!r}.'
            )

    def client(self, service_name: str):
        try:
            session = boto3.Session(profile_name=self.profile, region_name=self.region)
        except ProfileNotFound:
            session = boto3.Session(region_name=self.region)

        return session.client(
            service_name,
            endpoint_url=self.endpoint_url,
            region_name=self.region,
            config=Config(
                retries={'max_attempts': 2, 'mode': 'standard'},
                connect_timeout=2,
                read_timeout=5,
                s3={'addressing_style': 'path'},
            ) if service_name == 's3' else self.config,
        )

    def identity(self) -> dict[str, Any]:
        response = self.client('sts').get_caller_identity()
        return {
            'account': response.get('Account'),
            'arn': response.get('Arn'),
            'user_id': response.get('UserId'),
        }

    def health(self) -> dict[str, Any]:
        health_url = f'{self.endpoint_url.rstrip("/")}/_floci/health'

        try:
            with urlopen(health_url, timeout=2) as response:
                body = response.read().decode('utf-8')
        except URLError as exc:
            return {
                'ok': False,
                'url': health_url,
                'error': str(exc.reason),
            }
        except TimeoutError as exc:
            return {
                'ok': False,
                'url': health_url,
                'error': str(exc),
            }

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            data = {'raw': body}

        return {
            'ok': True,
            'url': health_url,
            'data': data,
        }


def _string_items(values: list[str], key: str) -> list[dict[str, Any]]:
    return [{key: value} for value in values]


def _resource(
    name: str,
    label: str,
    loader: Callable[[], list[dict[str, Any]]],
) -> ResourceResult:
    try:
        items = loader()
        return ResourceResult(name=name, label=label, count=len(items), items=items)
    except (BotoCoreError, ClientError, ValueError) as exc:
        return ResourceResult(
            name=name,
            label=label,
            count=None,
            items=[],
            error=str(exc),
        )


def _paginate(client, operation_name: str, result_key: str, **kwargs) -> list[Any]:
    paginator = client.get_paginator(operation_name)
    return paginator.paginate(**kwargs).build_full_result().get(result_key, [])


def _safe_value(loader: Callable[[], Any], fallback: Any = None) -> Any:
    try:
        return loader()
    except (BotoCoreError, ClientError, ValueError):
        return fallback


def _clean_response(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: _clean_response(item)
            for key, item in value.items()
            if key != 'ResponseMetadata'
        }

    if isinstance(value, list):
        return [_clean_response(item) for item in value]

    return value


def _chunks(values: list[Any], size: int) -> list[list[Any]]:
    return [values[index:index + size] for index in range(0, len(values), size)]


def iam_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    iam = factory.client('iam')

    def user_detail(user: dict[str, Any]) -> dict[str, Any]:
        name = user.get('UserName')
        full_user = _safe_value(lambda: iam.get_user(UserName=name).get('User', {}), {})

        return {
            'name': name,
            'arn': user.get('Arn'),
            'created': user.get('CreateDate'),
            'permissions_boundary': full_user.get('PermissionsBoundary'),
            'groups': [
                group.get('GroupName')
                for group in _safe_value(
                    lambda: _paginate(iam, 'list_groups_for_user', 'Groups', UserName=name),
                    [],
                )
            ],
            'attached_policies': [
                {
                    'name': policy.get('PolicyName'),
                    'arn': policy.get('PolicyArn'),
                }
                for policy in _safe_value(
                    lambda: _paginate(iam, 'list_attached_user_policies', 'AttachedPolicies', UserName=name),
                    [],
                )
            ],
            'inline_policies': _safe_value(
                lambda: _paginate(iam, 'list_user_policies', 'PolicyNames', UserName=name),
                [],
            ),
            'access_keys': [
                {
                    'id': key.get('AccessKeyId'),
                    'status': key.get('Status'),
                    'created': key.get('CreateDate'),
                }
                for key in _safe_value(
                    lambda: _paginate(iam, 'list_access_keys', 'AccessKeyMetadata', UserName=name),
                    [],
                )
            ],
            'tags': _safe_value(lambda: iam.list_user_tags(UserName=name).get('Tags', []), []),
        }

    def group_detail(group: dict[str, Any]) -> dict[str, Any]:
        name = group.get('GroupName')
        group_response = _safe_value(lambda: iam.get_group(GroupName=name), {})

        return {
            'name': name,
            'arn': group.get('Arn'),
            'created': group.get('CreateDate'),
            'users': [
                user.get('UserName')
                for user in group_response.get('Users', [])
            ],
            'attached_policies': [
                {
                    'name': policy.get('PolicyName'),
                    'arn': policy.get('PolicyArn'),
                }
                for policy in _safe_value(
                    lambda: _paginate(iam, 'list_attached_group_policies', 'AttachedPolicies', GroupName=name),
                    [],
                )
            ],
            'inline_policies': _safe_value(
                lambda: _paginate(iam, 'list_group_policies', 'PolicyNames', GroupName=name),
                [],
            ),
        }

    def role_detail(role: dict[str, Any]) -> dict[str, Any]:
        name = role.get('RoleName')
        full_role = _safe_value(lambda: iam.get_role(RoleName=name).get('Role', {}), {})

        return {
            'name': name,
            'arn': role.get('Arn'),
            'created': role.get('CreateDate'),
            'permissions_boundary': full_role.get('PermissionsBoundary'),
            'trust_policy': full_role.get('AssumeRolePolicyDocument') or role.get('AssumeRolePolicyDocument'),
            'attached_policies': [
                {
                    'name': policy.get('PolicyName'),
                    'arn': policy.get('PolicyArn'),
                }
                for policy in _safe_value(
                    lambda: _paginate(iam, 'list_attached_role_policies', 'AttachedPolicies', RoleName=name),
                    [],
                )
            ],
            'inline_policies': _safe_value(
                lambda: _paginate(iam, 'list_role_policies', 'PolicyNames', RoleName=name),
                [],
            ),
            'instance_profiles': [
                profile.get('InstanceProfileName')
                for profile in _safe_value(
                    lambda: _paginate(iam, 'list_instance_profiles_for_role', 'InstanceProfiles', RoleName=name),
                    [],
                )
            ],
            'tags': _safe_value(lambda: iam.list_role_tags(RoleName=name).get('Tags', []), []),
        }

    def policy_detail(policy: dict[str, Any]) -> dict[str, Any]:
        arn = policy.get('Arn')

        return {
            'name': policy.get('PolicyName'),
            'arn': arn,
            'default_version': policy.get('DefaultVersionId'),
            'attachment_count': policy.get('AttachmentCount'),
            'permissions_boundary_usage_count': policy.get('PermissionsBoundaryUsageCount'),
            'created': policy.get('CreateDate'),
            'updated': policy.get('UpdateDate'),
            'versions': [
                {
                    'id': version.get('VersionId'),
                    'default': version.get('IsDefaultVersion'),
                    'created': version.get('CreateDate'),
                }
                for version in _safe_value(
                    lambda: _paginate(iam, 'list_policy_versions', 'Versions', PolicyArn=arn),
                    [],
                )
            ],
            'tags': _safe_value(lambda: iam.list_policy_tags(PolicyArn=arn).get('Tags', []), []),
        }

    users = _paginate(iam, 'list_users', 'Users')
    groups = _paginate(iam, 'list_groups', 'Groups')
    roles = _paginate(iam, 'list_roles', 'Roles')
    policies = _safe_value(
        lambda: _paginate(iam, 'list_policies', 'Policies', Scope='Local'),
        _paginate(iam, 'list_policies', 'Policies'),
    )
    instance_profiles = _paginate(iam, 'list_instance_profiles', 'InstanceProfiles')

    return {
        'summary': {
            'users': len(users),
            'groups': len(groups),
            'roles': len(roles),
            'customer_policies': len(policies),
            'instance_profiles': len(instance_profiles),
        },
        'users': [user_detail(user) for user in users],
        'groups': [group_detail(group) for group in groups],
        'roles': [role_detail(role) for role in roles],
        'policies': [policy_detail(policy) for policy in policies],
        'instance_profiles': [
            {
                'name': profile.get('InstanceProfileName'),
                'arn': profile.get('Arn'),
                'created': profile.get('CreateDate'),
                'roles': [
                    role.get('RoleName')
                    for role in profile.get('Roles', [])
                ],
            }
            for profile in instance_profiles
        ],
    }


def _error_code(exc: Exception) -> Optional[str]:
    if isinstance(exc, ClientError):
        return exc.response.get('Error', {}).get('Code')

    return None


def _s3_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (BotoCoreError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def _s3_bucket_location(s3, bucket: str) -> str:
    response = s3.get_bucket_location(Bucket=bucket)
    return response.get('LocationConstraint') or 'us-east-1'


def _s3_bucket_objects(s3, bucket: str) -> list[dict[str, Any]]:
    objects = _safe_value(
        lambda: _paginate(s3, 'list_objects_v2', 'Contents', Bucket=bucket),
        [],
    )

    return [
        {
            'key': item.get('Key'),
            'size': item.get('Size'),
            'etag': item.get('ETag'),
            'last_modified': item.get('LastModified'),
            'storage_class': item.get('StorageClass'),
        }
        for item in objects
    ]


def _s3_bucket_versions(s3, bucket: str) -> dict[str, Any]:
    response = _s3_optional(
        lambda: s3.list_object_versions(Bucket=bucket),
        {'NoSuchBucket'},
    )

    if not response or 'error' in response:
        return response or {'versions': [], 'delete_markers': []}

    return {
        'versions': [
            {
                'key': item.get('Key'),
                'version_id': item.get('VersionId'),
                'latest': item.get('IsLatest'),
                'size': item.get('Size'),
                'last_modified': item.get('LastModified'),
            }
            for item in response.get('Versions', [])
        ],
        'delete_markers': [
            {
                'key': item.get('Key'),
                'version_id': item.get('VersionId'),
                'latest': item.get('IsLatest'),
                'last_modified': item.get('LastModified'),
            }
            for item in response.get('DeleteMarkers', [])
        ],
    }


def s3_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    s3 = factory.client('s3')
    buckets = s3.list_buckets().get('Buckets', [])

    def bucket_detail(bucket: dict[str, Any]) -> dict[str, Any]:
        name = bucket.get('Name')
        objects = _s3_bucket_objects(s3, name)
        total_bytes = sum(item.get('size') or 0 for item in objects)

        return {
            'name': name,
            'arn': f'arn:aws:s3:::{name}',
            'path_style_url': f'{factory.endpoint_url.rstrip("/")}/{name}',
            'created': bucket.get('CreationDate'),
            'location': _s3_optional(
                lambda: _s3_bucket_location(s3, name),
                {'NoSuchBucket'},
            ),
            'versioning': _s3_optional(
                lambda: s3.get_bucket_versioning(Bucket=name),
                {'NoSuchBucket'},
            ),
            'tagging': _s3_optional(
                lambda: s3.get_bucket_tagging(Bucket=name).get('TagSet', []),
                {'NoSuchTagSet', 'NoSuchBucket'},
            ),
            'policy': _s3_optional(
                lambda: json.loads(s3.get_bucket_policy(Bucket=name).get('Policy', '{}')),
                {'NoSuchBucketPolicy', 'NoSuchBucket'},
            ),
            'cors': _s3_optional(
                lambda: s3.get_bucket_cors(Bucket=name).get('CORSRules', []),
                {'NoSuchCORSConfiguration', 'NoSuchBucket'},
            ),
            'lifecycle': _s3_optional(
                lambda: s3.get_bucket_lifecycle(Bucket=name).get('Rules', []),
                {'NoSuchLifecycleConfiguration', 'NoSuchBucket'},
            ),
            'acl': _s3_optional(
                lambda: s3.get_bucket_acl(Bucket=name),
                {'NoSuchBucket'},
            ),
            'encryption': _s3_optional(
                lambda: s3.get_bucket_encryption(Bucket=name).get('ServerSideEncryptionConfiguration'),
                {'ServerSideEncryptionConfigurationNotFoundError', 'NoSuchBucket'},
            ),
            'notification': _s3_optional(
                lambda: s3.get_bucket_notification_configuration(Bucket=name),
                {'NoSuchBucket'},
            ),
            'public_access_block': _s3_optional(
                lambda: s3.get_public_access_block(Bucket=name).get('PublicAccessBlockConfiguration'),
                {'NoSuchPublicAccessBlockConfiguration', 'NoSuchBucket'},
            ),
            'object_lock': _s3_optional(
                lambda: s3.get_object_lock_configuration(Bucket=name).get('ObjectLockConfiguration'),
                {'ObjectLockConfigurationNotFoundError', 'NoSuchBucket'},
            ),
            'objects': objects,
            'object_versions': _s3_bucket_versions(s3, name),
            'object_count': len(objects),
            'total_bytes': total_bytes,
        }

    detailed_buckets = [bucket_detail(bucket) for bucket in buckets]

    return {
        'summary': {
            'buckets': len(detailed_buckets),
            'objects': sum(bucket['object_count'] for bucket in detailed_buckets),
            'total_bytes': sum(bucket['total_bytes'] for bucket in detailed_buckets),
            'versioned_buckets': sum(
                1
                for bucket in detailed_buckets
                if isinstance(bucket.get('versioning'), dict)
                and bucket['versioning'].get('Status') == 'Enabled'
            ),
        },
        'buckets': detailed_buckets,
        'supported': {
            'bucket_configuration': [
                'Location',
                'Versioning',
                'Tagging',
                'Policy',
                'CORS',
                'Lifecycle',
                'ACL',
                'Encryption',
                'Notifications',
                'Object Lock',
                'Public Access Block',
            ],
            'objects': [
                'ListObjectsV2',
                'ListObjectVersions',
                'HeadObject',
                'GetObjectAttributes',
                'Object tagging',
                'Object ACL',
                'Object retention',
                'Object legal hold',
            ],
            'not_implemented': [
                'Replication',
                'Website hosting',
                'Access logging',
                'Request payment',
                'Intelligent-Tiering configurations',
                'Inventory configurations',
                'Metrics and Analytics configurations',
            ],
        },
    }


def ec2_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    ec2 = factory.client('ec2')

    reservations = _clean_response(_safe_value(lambda: ec2.describe_instances().get('Reservations', []), []))
    instances = [
        {
            'id': instance.get('InstanceId'),
            'image_id': instance.get('ImageId'),
            'instance_type': instance.get('InstanceType'),
            'state': instance.get('State', {}).get('Name'),
            'vpc_id': instance.get('VpcId'),
            'subnet_id': instance.get('SubnetId'),
            'private_ip': instance.get('PrivateIpAddress'),
            'public_ip': instance.get('PublicIpAddress'),
            'security_groups': instance.get('SecurityGroups', []),
            'launch_time': instance.get('LaunchTime'),
            'tags': instance.get('Tags', []),
        }
        for reservation in reservations
        for instance in reservation.get('Instances', [])
    ]

    vpcs = _clean_response(_safe_value(lambda: ec2.describe_vpcs().get('Vpcs', []), []))
    subnets = _clean_response(_safe_value(lambda: ec2.describe_subnets().get('Subnets', []), []))
    security_groups = _clean_response(_safe_value(lambda: ec2.describe_security_groups().get('SecurityGroups', []), []))
    security_group_rules = _clean_response(_safe_value(lambda: ec2.describe_security_group_rules().get('SecurityGroupRules', []), []))
    key_pairs = _clean_response(_safe_value(lambda: ec2.describe_key_pairs().get('KeyPairs', []), []))
    images = _clean_response(_safe_value(lambda: ec2.describe_images().get('Images', []), []))
    tags = _clean_response(_safe_value(lambda: ec2.describe_tags().get('Tags', []), []))
    internet_gateways = _clean_response(_safe_value(lambda: ec2.describe_internet_gateways().get('InternetGateways', []), []))
    route_tables = _clean_response(_safe_value(lambda: ec2.describe_route_tables().get('RouteTables', []), []))
    addresses = _clean_response(_safe_value(lambda: ec2.describe_addresses().get('Addresses', []), []))
    availability_zones = _clean_response(_safe_value(lambda: ec2.describe_availability_zones().get('AvailabilityZones', []), []))
    regions = _clean_response(_safe_value(lambda: ec2.describe_regions().get('Regions', []), []))
    account_attributes = _clean_response(_safe_value(lambda: ec2.describe_account_attributes().get('AccountAttributes', []), []))
    instance_types = _clean_response(_safe_value(lambda: ec2.describe_instance_types().get('InstanceTypes', []), []))

    return {
        'summary': {
            'instances': len(instances),
            'vpcs': len(vpcs),
            'subnets': len(subnets),
            'security_groups': len(security_groups),
            'internet_gateways': len(internet_gateways),
            'route_tables': len(route_tables),
            'elastic_ips': len(addresses),
            'key_pairs': len(key_pairs),
        },
        'instances': instances,
        'vpcs': vpcs,
        'subnets': subnets,
        'security_groups': security_groups,
        'security_group_rules': security_group_rules,
        'key_pairs': key_pairs,
        'images': images,
        'tags': tags,
        'internet_gateways': internet_gateways,
        'route_tables': route_tables,
        'addresses': addresses,
        'availability_zones': availability_zones,
        'regions': regions,
        'account_attributes': account_attributes,
        'instance_types': instance_types,
        'default_resources': [
            {'type': 'Default VPC', 'id': 'vpc-default', 'details': 'CIDR 172.31.0.0/16'},
            {'type': 'Default Subnet', 'id': 'subnet-default-a', 'details': 'CIDR 172.31.0.0/20'},
            {'type': 'Default Subnet', 'id': 'subnet-default-b', 'details': 'CIDR 172.31.16.0/20'},
            {'type': 'Default Subnet', 'id': 'subnet-default-c', 'details': 'CIDR 172.31.32.0/20'},
            {'type': 'Default Security Group', 'id': 'sg-default', 'details': 'groupName=default, all-traffic egress'},
            {'type': 'Default Internet Gateway', 'id': 'igw-default', 'details': 'Attached to default VPC'},
            {'type': 'Main Route Table', 'id': 'rtb-default', 'details': 'Associated with default VPC'},
        ],
        'notes': [
            'Instances transition to running immediately; no Docker container is launched.',
            'DescribeImages returns a static list of common AMIs.',
            'CreateKeyPair returns dummy RSA PEM material that is not usable for real SSH.',
            'Instance metadata service at 169.254.169.254 is not emulated.',
        ],
    }


def _kms_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (BotoCoreError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def kms_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    kms = factory.client('kms')
    keys = _safe_value(lambda: _paginate(kms, 'list_keys', 'Keys'), [])
    aliases = _safe_value(lambda: _paginate(kms, 'list_aliases', 'Aliases'), [])

    aliases_by_key: dict[str, list[dict[str, Any]]] = {}
    for alias in aliases:
        target_key_id = alias.get('TargetKeyId')
        if target_key_id:
            aliases_by_key.setdefault(target_key_id, []).append(_clean_response(alias))

    def key_detail(key: dict[str, Any]) -> dict[str, Any]:
        key_id = key.get('KeyId')
        metadata = _kms_optional(
            lambda: kms.describe_key(KeyId=key_id).get('KeyMetadata', {}),
            {'NotFoundException', 'KMSInvalidStateException'},
        )

        return {
            'name': key_id,
            'key_id': key_id,
            'key_arn': key.get('KeyArn'),
            'metadata': metadata,
            'aliases': aliases_by_key.get(key_id, []),
            'tags': _kms_optional(
                lambda: _paginate(kms, 'list_resource_tags', 'Tags', KeyId=key_id),
                {'NotFoundException'},
            ),
            'policy': _kms_optional(
                lambda: json.loads(kms.get_key_policy(KeyId=key_id, PolicyName='default').get('Policy', '{}')),
                {'NotFoundException'},
            ),
            'rotation_enabled': _kms_optional(
                lambda: kms.get_key_rotation_status(KeyId=key_id).get('KeyRotationEnabled'),
                {'NotFoundException', 'UnsupportedOperationException'},
            ),
        }

    detailed_keys = [key_detail(key) for key in keys]

    return {
        'summary': {
            'keys': len(detailed_keys),
            'aliases': len(aliases),
            'enabled_keys': sum(
                1
                for key in detailed_keys
                if isinstance(key.get('metadata'), dict)
                and key['metadata'].get('KeyState') == 'Enabled'
            ),
            'pending_deletion': sum(
                1
                for key in detailed_keys
                if isinstance(key.get('metadata'), dict)
                and key['metadata'].get('KeyState') == 'PendingDeletion'
            ),
            'rotation_enabled': sum(1 for key in detailed_keys if key.get('rotation_enabled') is True),
        },
        'keys': detailed_keys,
        'aliases': _clean_response(aliases),
        'supported': [
            'CreateKey',
            'DescribeKey',
            'ListKeys',
            'Encrypt',
            'Decrypt',
            'ReEncrypt',
            'GenerateDataKey',
            'GenerateDataKeyWithoutPlaintext',
            'Sign',
            'Verify',
            'CreateAlias',
            'DeleteAlias',
            'ListAliases',
            'ScheduleKeyDeletion',
            'CancelKeyDeletion',
            'TagResource',
            'UntagResource',
            'ListResourceTags',
            'GetKeyPolicy',
            'PutKeyPolicy',
            'GetKeyRotationStatus',
            'EnableKeyRotation',
            'DisableKeyRotation',
        ],
        'notes': [
            'KMS uses JSON 1.1 with X-Amz-Target: TrentService.* against the local Floci endpoint.',
            'CreateKey accepts creation-time tag floci:override-id for deterministic local test key IDs.',
            'Floci strips reserved floci:* tags from stored resource tags and rejects adding them later.',
        ],
    }


def _lambda_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (BotoCoreError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def lambda_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    lambda_client = factory.client('lambda')
    functions = _safe_value(lambda: _paginate(lambda_client, 'list_functions', 'Functions'), [])
    event_source_mappings = _safe_value(
        lambda: _paginate(lambda_client, 'list_event_source_mappings', 'EventSourceMappings'),
        [],
    )

    mappings_by_function: dict[str, list[dict[str, Any]]] = {}
    for mapping in event_source_mappings:
        function_arn = mapping.get('FunctionArn')
        if function_arn:
            function_name = function_arn.rsplit(':', 1)[-1]
            mappings_by_function.setdefault(function_name, []).append(_clean_response(mapping))

    def function_detail(function: dict[str, Any]) -> dict[str, Any]:
        name = function.get('FunctionName')
        arn = function.get('FunctionArn')
        function_response = _lambda_optional(
            lambda: lambda_client.get_function(FunctionName=name),
            {'ResourceNotFoundException'},
        )
        configuration = _lambda_optional(
            lambda: lambda_client.get_function_configuration(FunctionName=name),
            {'ResourceNotFoundException'},
        )
        policy = _lambda_optional(
            lambda: json.loads(lambda_client.get_policy(FunctionName=name).get('Policy', '{}')),
            {'ResourceNotFoundException'},
        )

        return {
            'name': name,
            'arn': arn,
            'runtime': function.get('Runtime'),
            'handler': function.get('Handler'),
            'package_type': function.get('PackageType'),
            'state': function.get('State'),
            'last_modified': function.get('LastModified'),
            'role': function.get('Role'),
            'memory_size': function.get('MemorySize'),
            'timeout': function.get('Timeout'),
            'architectures': function.get('Architectures'),
            'environment': function.get('Environment'),
            'tracing_config': function.get('TracingConfig'),
            'layers': function.get('Layers'),
            'code': function_response.get('Code') if isinstance(function_response, dict) else function_response,
            'configuration': configuration,
            'versions': _lambda_optional(
                lambda: _paginate(lambda_client, 'list_versions_by_function', 'Versions', FunctionName=name),
                {'ResourceNotFoundException'},
            ),
            'aliases': _lambda_optional(
                lambda: _paginate(lambda_client, 'list_aliases', 'Aliases', FunctionName=name),
                {'ResourceNotFoundException'},
            ),
            'event_source_mappings': mappings_by_function.get(name, []),
            'policy': policy,
            'function_url': _lambda_optional(
                lambda: lambda_client.get_function_url_config(FunctionName=name),
                {'ResourceNotFoundException'},
            ),
            'code_signing_config': _lambda_optional(
                lambda: lambda_client.get_function_code_signing_config(FunctionName=name),
                {'ResourceNotFoundException'},
            ),
            'concurrency': _lambda_optional(
                lambda: lambda_client.get_function_concurrency(FunctionName=name),
                {'ResourceNotFoundException'},
            ),
            'tags': _lambda_optional(
                lambda: lambda_client.list_tags(Resource=arn).get('Tags', {}),
                {'ResourceNotFoundException'},
            ) if arn else None,
        }

    detailed_functions = [function_detail(function) for function in functions]

    return {
        'summary': {
            'functions': len(detailed_functions),
            'event_source_mappings': len(event_source_mappings),
            'function_urls': sum(1 for function in detailed_functions if function.get('function_url')),
            'aliases': sum(
                len(function.get('aliases') or [])
                for function in detailed_functions
                if isinstance(function.get('aliases'), list)
            ),
            'published_versions': sum(
                len(function.get('versions') or [])
                for function in detailed_functions
                if isinstance(function.get('versions'), list)
            ),
        },
        'functions': detailed_functions,
        'event_source_mappings': _clean_response(event_source_mappings),
        'supported': [
            'CreateFunction',
            'GetFunction',
            'GetFunctionConfiguration',
            'ListFunctions',
            'UpdateFunctionCode',
            'UpdateFunctionConfiguration',
            'DeleteFunction',
            'Invoke',
            'CreateEventSourceMapping',
            'GetEventSourceMapping',
            'ListEventSourceMappings',
            'UpdateEventSourceMapping',
            'DeleteEventSourceMapping',
            'PublishVersion',
            'ListVersionsByFunction',
            'CreateAlias',
            'GetAlias',
            'ListAliases',
            'UpdateAlias',
            'DeleteAlias',
            'AddPermission',
            'GetPolicy',
            'RemovePermission',
            'GetFunctionCodeSigningConfig',
            'CreateFunctionUrlConfig',
            'GetFunctionUrlConfig',
            'UpdateFunctionUrlConfig',
            'DeleteFunctionUrlConfig',
            'ListTags',
            'TagResource',
            'UntagResource',
            'PutFunctionConcurrency',
            'GetFunctionConcurrency',
            'DeleteFunctionConcurrency',
        ],
        'not_implemented': [
            'Layer storage and layer permission operations',
            'Provisioned concurrency operations',
            'Dead-letter and async/event invoke config operations',
            'InvokeWithResponseStream',
            'Code signing management beyond GetFunctionCodeSigningConfig',
            'GetAccountSettings',
        ],
        'notes': [
            'Lambda runs function code inside real Docker containers.',
            'S3-based deployments support reactive hot reload when the source object changes.',
            'Bind-mount hot reload uses S3Bucket=hot-reload and requires explicit configuration.',
            'Reserved concurrency is enforced; provisioned concurrency is not implemented.',
            'ListLayers and ListLayerVersions are stubbed and return empty arrays.',
        ],
    }


def _sqs_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (BotoCoreError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def sqs_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    sqs = factory.client('sqs')
    queue_urls = sqs.list_queues().get('QueueUrls', [])

    def queue_name(queue_url: str) -> str:
        return queue_url.rstrip('/').rsplit('/', 1)[-1]

    def queue_detail(queue_url: str) -> dict[str, Any]:
        attributes = _sqs_optional(
            lambda: sqs.get_queue_attributes(QueueUrl=queue_url, AttributeNames=['All']).get('Attributes', {}),
            {'AWS.SimpleQueueService.NonExistentQueue', 'QueueDoesNotExist'},
        )
        tags = _sqs_optional(
            lambda: sqs.list_queue_tags(QueueUrl=queue_url).get('Tags', {}),
            {'AWS.SimpleQueueService.NonExistentQueue', 'QueueDoesNotExist'},
        )
        dead_letter_sources = _sqs_optional(
            lambda: sqs.list_dead_letter_source_queues(QueueUrl=queue_url).get('queueUrls', []),
            {'AWS.SimpleQueueService.NonExistentQueue', 'QueueDoesNotExist'},
        )
        message_move_tasks = _sqs_optional(
            lambda: sqs.list_message_move_tasks(SourceArn=attributes.get('QueueArn')).get('Results', [])
            if isinstance(attributes, dict) and attributes.get('QueueArn') else [],
            {'AWS.SimpleQueueService.NonExistentQueue', 'QueueDoesNotExist'},
        )

        return {
            'name': queue_name(queue_url),
            'url': queue_url,
            'arn': attributes.get('QueueArn') if isinstance(attributes, dict) else None,
            'fifo': queue_url.endswith('.fifo') or (
                isinstance(attributes, dict) and attributes.get('FifoQueue') == 'true'
            ),
            'attributes': attributes,
            'tags': tags,
            'dead_letter_source_queues': dead_letter_sources,
            'message_move_tasks': message_move_tasks,
            'approximate_messages': int(attributes.get('ApproximateNumberOfMessages', 0))
            if isinstance(attributes, dict) else 0,
            'approximate_not_visible': int(attributes.get('ApproximateNumberOfMessagesNotVisible', 0))
            if isinstance(attributes, dict) else 0,
            'approximate_delayed': int(attributes.get('ApproximateNumberOfMessagesDelayed', 0))
            if isinstance(attributes, dict) else 0,
        }

    queues = [queue_detail(url) for url in queue_urls]

    return {
        'summary': {
            'queues': len(queues),
            'fifo_queues': sum(1 for queue in queues if queue.get('fifo')),
            'visible_messages': sum(queue.get('approximate_messages') or 0 for queue in queues),
            'in_flight_messages': sum(queue.get('approximate_not_visible') or 0 for queue in queues),
            'delayed_messages': sum(queue.get('approximate_delayed') or 0 for queue in queues),
        },
        'queues': queues,
        'supported': [
            'CreateQueue',
            'DeleteQueue',
            'ListQueues',
            'GetQueueUrl',
            'GetQueueAttributes',
            'SetQueueAttributes',
            'SendMessage',
            'SendMessageBatch',
            'ReceiveMessage',
            'DeleteMessage',
            'DeleteMessageBatch',
            'ChangeMessageVisibility',
            'ChangeMessageVisibilityBatch',
            'PurgeQueue',
            'TagQueue',
            'UntagQueue',
            'ListQueueTags',
            'ListDeadLetterSourceQueues',
            'StartMessageMoveTask',
            'ListMessageMoveTasks',
        ],
        'configuration': {
            'default_visibility_timeout_seconds': 30,
            'max_message_size_bytes': 262144,
            'queue_url_format': f'{factory.endpoint_url.rstrip("/")}/000000000000/<queue-name>',
        },
    }


def _secrets_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (BotoCoreError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def _secret_value_preview(value: Any) -> dict[str, Any]:
    if value is None:
        return {'present': False}

    if isinstance(value, bytes):
        return {
            'present': True,
            'type': 'binary',
            'length': len(value),
            'preview': '<binary secret hidden>',
        }

    text = str(value)
    return {
        'present': True,
        'type': 'string',
        'length': len(text),
        'preview': f'{text[:6]}...' if len(text) > 6 else '<short secret hidden>',
    }


def secretsmanager_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    client = factory.client('secretsmanager')
    secrets = _safe_value(lambda: _paginate(client, 'list_secrets', 'SecretList'), [])

    def secret_detail(secret: dict[str, Any]) -> dict[str, Any]:
        secret_id = secret.get('ARN') or secret.get('Name')
        value = _secrets_optional(
            lambda: client.get_secret_value(SecretId=secret_id),
            {'ResourceNotFoundException', 'InvalidRequestException'},
        )
        versions = _secrets_optional(
            lambda: _paginate(client, 'list_secret_version_ids', 'Versions', SecretId=secret_id),
            {'ResourceNotFoundException'},
        )
        policy = _secrets_optional(
            lambda: json.loads(client.get_resource_policy(SecretId=secret_id).get('ResourcePolicy', '{}')),
            {'ResourceNotFoundException', 'ResourcePolicyNotFoundException'},
        )

        return {
            'name': secret.get('Name'),
            'arn': secret.get('ARN'),
            'description': secret.get('Description'),
            'kms_key_id': secret.get('KmsKeyId'),
            'created': secret.get('CreatedDate'),
            'last_changed': secret.get('LastChangedDate'),
            'last_accessed': secret.get('LastAccessedDate'),
            'deleted': secret.get('DeletedDate'),
            'rotation_enabled': secret.get('RotationEnabled'),
            'rotation_lambda_arn': secret.get('RotationLambdaARN'),
            'rotation_rules': secret.get('RotationRules'),
            'version_ids_to_stages': secret.get('SecretVersionsToStages'),
            'tags': secret.get('Tags', []),
            'versions': versions,
            'resource_policy': policy,
            'current_value': _secret_value_preview(value.get('SecretString') if isinstance(value, dict) else None),
            'current_binary_value': _secret_value_preview(value.get('SecretBinary') if isinstance(value, dict) else None),
        }

    detailed_secrets = [secret_detail(secret) for secret in secrets]

    return {
        'summary': {
            'secrets': len(detailed_secrets),
            'scheduled_for_deletion': sum(1 for secret in detailed_secrets if secret.get('deleted')),
            'rotation_enabled': sum(1 for secret in detailed_secrets if secret.get('rotation_enabled')),
            'with_resource_policy': sum(1 for secret in detailed_secrets if secret.get('resource_policy')),
            'versions': sum(
                len(secret.get('versions') or [])
                for secret in detailed_secrets
                if isinstance(secret.get('versions'), list)
            ),
        },
        'secrets': detailed_secrets,
        'supported': [
            'CreateSecret',
            'GetSecretValue',
            'PutSecretValue',
            'UpdateSecret',
            'DescribeSecret',
            'ListSecrets',
            'DeleteSecret',
            'RotateSecret',
            'ListSecretVersionIds',
            'GetResourcePolicy',
            'PutResourcePolicy',
            'DeleteResourcePolicy',
            'TagResource',
            'UntagResource',
        ],
        'configuration': {
            'default_recovery_window_days': 30,
            'protocol': 'JSON 1.1, X-Amz-Target: secretsmanager.*',
            'value_display': 'Secret values are masked; only type, length, and a short preview are shown.',
        },
    }


def _dynamodb_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (BotoCoreError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def dynamodb_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    dynamodb = factory.client('dynamodb')
    streams = factory.client('dynamodbstreams')
    table_names = _safe_value(lambda: _paginate(dynamodb, 'list_tables', 'TableNames'), [])

    def table_detail(table_name: str) -> dict[str, Any]:
        description = _dynamodb_optional(
            lambda: dynamodb.describe_table(TableName=table_name).get('Table', {}),
            {'ResourceNotFoundException'},
        )
        table_arn = description.get('TableArn') if isinstance(description, dict) else None
        scan_preview = _dynamodb_optional(
            lambda: dynamodb.scan(TableName=table_name, Limit=5),
            {'ResourceNotFoundException'},
        )

        return {
            'name': table_name,
            'arn': table_arn,
            'status': description.get('TableStatus') if isinstance(description, dict) else None,
            'item_count': description.get('ItemCount') if isinstance(description, dict) else None,
            'size_bytes': description.get('TableSizeBytes') if isinstance(description, dict) else None,
            'billing_mode': description.get('BillingModeSummary') if isinstance(description, dict) else None,
            'key_schema': description.get('KeySchema') if isinstance(description, dict) else None,
            'attribute_definitions': description.get('AttributeDefinitions') if isinstance(description, dict) else None,
            'provisioned_throughput': description.get('ProvisionedThroughput') if isinstance(description, dict) else None,
            'global_secondary_indexes': description.get('GlobalSecondaryIndexes') if isinstance(description, dict) else None,
            'local_secondary_indexes': description.get('LocalSecondaryIndexes') if isinstance(description, dict) else None,
            'stream_specification': description.get('StreamSpecification') if isinstance(description, dict) else None,
            'latest_stream_arn': description.get('LatestStreamArn') if isinstance(description, dict) else None,
            'ttl': _dynamodb_optional(
                lambda: dynamodb.describe_time_to_live(TableName=table_name).get('TimeToLiveDescription', {}),
                {'ResourceNotFoundException'},
            ),
            'tags': _dynamodb_optional(
                lambda: _paginate(dynamodb, 'list_tags_of_resource', 'Tags', ResourceArn=table_arn)
                if table_arn else [],
                {'ResourceNotFoundException'},
            ),
            'scan_preview': {
                'count': scan_preview.get('Count'),
                'scanned_count': scan_preview.get('ScannedCount'),
                'items': scan_preview.get('Items', []),
            } if isinstance(scan_preview, dict) and 'error' not in scan_preview else scan_preview,
        }

    tables = [table_detail(name) for name in table_names]
    stream_summaries = _safe_value(lambda: _paginate(streams, 'list_streams', 'Streams'), [])

    def stream_detail(stream: dict[str, Any]) -> dict[str, Any]:
        stream_arn = stream.get('StreamArn')
        description = _dynamodb_optional(
            lambda: streams.describe_stream(StreamArn=stream_arn).get('StreamDescription', {}),
            {'ResourceNotFoundException'},
        )

        return {
            'name': stream.get('TableName') or stream_arn,
            'table_name': stream.get('TableName'),
            'stream_arn': stream_arn,
            'label': stream.get('StreamLabel'),
            'description': description,
        }

    stream_details = [stream_detail(stream) for stream in stream_summaries]

    return {
        'summary': {
            'tables': len(tables),
            'items': sum(table.get('item_count') or 0 for table in tables),
            'global_secondary_indexes': sum(
                len(table.get('global_secondary_indexes') or [])
                for table in tables
                if isinstance(table.get('global_secondary_indexes'), list)
            ),
            'streams': len(stream_details),
            'ttl_enabled': sum(
                1
                for table in tables
                if isinstance(table.get('ttl'), dict)
                and table['ttl'].get('TimeToLiveStatus') == 'ENABLED'
            ),
        },
        'tables': tables,
        'streams': stream_details,
        'supported': [
            'CreateTable',
            'DeleteTable',
            'DescribeTable',
            'ListTables',
            'UpdateTable',
            'PutItem',
            'GetItem',
            'DeleteItem',
            'UpdateItem',
            'Query',
            'Scan',
            'BatchWriteItem',
            'BatchGetItem',
            'TransactWriteItems',
            'TransactGetItems',
            'DescribeTimeToLive',
            'UpdateTimeToLive',
            'TagResource',
            'UntagResource',
            'ListTagsOfResource',
        ],
        'streams_supported': [
            'ListStreams',
            'DescribeStream',
            'GetShardIterator',
            'GetRecords',
        ],
    }


def _cloudwatch_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (BotoCoreError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def cloudwatch_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    logs = factory.client('logs')
    cloudwatch = factory.client('cloudwatch')

    log_groups = _safe_value(lambda: _paginate(logs, 'describe_log_groups', 'logGroups'), [])

    def log_group_detail(group: dict[str, Any]) -> dict[str, Any]:
        name = group.get('logGroupName')
        streams = _cloudwatch_optional(
            lambda: _paginate(logs, 'describe_log_streams', 'logStreams', logGroupName=name),
            {'ResourceNotFoundException'},
        )
        stream_details = []

        if isinstance(streams, list):
            for stream in streams:
                stream_name = stream.get('logStreamName')
                events = _cloudwatch_optional(
                    lambda: logs.get_log_events(
                        logGroupName=name,
                        logStreamName=stream_name,
                        limit=10,
                        startFromHead=False,
                    ).get('events', []),
                    {'ResourceNotFoundException'},
                )
                stream_details.append({
                    **stream,
                    'recent_events': events,
                })

        return {
            'name': name,
            'arn': group.get('arn'),
            'created': group.get('creationTime'),
            'retention_days': group.get('retentionInDays'),
            'stored_bytes': group.get('storedBytes'),
            'metric_filter_count': group.get('metricFilterCount'),
            'tags': _cloudwatch_optional(
                lambda: logs.list_tags_log_group(logGroupName=name).get('tags', {}),
                {'ResourceNotFoundException'},
            ),
            'streams': stream_details,
            'stream_count': len(stream_details),
        }

    detailed_log_groups = [log_group_detail(group) for group in log_groups]
    metrics = _safe_value(lambda: _paginate(cloudwatch, 'list_metrics', 'Metrics'), [])
    alarms = _safe_value(lambda: _paginate(cloudwatch, 'describe_alarms', 'MetricAlarms'), [])

    return {
        'summary': {
            'log_groups': len(detailed_log_groups),
            'log_streams': sum(group.get('stream_count') or 0 for group in detailed_log_groups),
            'recent_log_events': sum(
                len(stream.get('recent_events') or [])
                for group in detailed_log_groups
                for stream in group.get('streams', [])
            ),
            'metrics': len(metrics),
            'alarms': len(alarms),
        },
        'log_groups': detailed_log_groups,
        'metrics': _clean_response(metrics),
        'alarms': _clean_response(alarms),
        'logs_supported': [
            'CreateLogGroup',
            'DeleteLogGroup',
            'DescribeLogGroups',
            'CreateLogStream',
            'DeleteLogStream',
            'DescribeLogStreams',
            'PutLogEvents',
            'GetLogEvents',
            'FilterLogEvents',
            'PutRetentionPolicy',
            'DeleteRetentionPolicy',
            'TagLogGroup',
            'UntagLogGroup',
            'ListTagsLogGroup',
        ],
        'metrics_supported': [
            'PutMetricData',
            'ListMetrics',
            'GetMetricStatistics',
            'GetMetricData',
            'PutMetricAlarm',
            'DescribeAlarms',
            'DeleteAlarms',
            'SetAlarmState',
        ],
        'configuration': {
            'logs_max_events_per_query': 10000,
            'logs_protocol': 'JSON 1.1, X-Amz-Target: Logs.*',
            'metrics_protocol': 'Query XML and JSON 1.1',
        },
    }


def _eventbridge_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (BotoCoreError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def eventbridge_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    events = factory.client('events')
    buses = _safe_value(lambda: _paginate(events, 'list_event_buses', 'EventBuses'), [])

    if not buses:
        buses = [{'Name': 'default'}]

    def bus_name(bus: dict[str, Any]) -> str:
        return bus.get('Name') or bus.get('Arn') or 'default'

    def bus_detail(bus: dict[str, Any]) -> dict[str, Any]:
        name = bus_name(bus)
        details = _eventbridge_optional(
            lambda: events.describe_event_bus(Name=name),
            {'ResourceNotFoundException'},
        )
        rules = _eventbridge_optional(
            lambda: _paginate(events, 'list_rules', 'Rules', EventBusName=name),
            {'ResourceNotFoundException'},
        )
        rule_details = []

        if isinstance(rules, list):
            for rule in rules:
                rule_name = rule.get('Name')
                targets = _eventbridge_optional(
                    lambda: _paginate(
                        events,
                        'list_targets_by_rule',
                        'Targets',
                        Rule=rule_name,
                        EventBusName=name,
                    ),
                    {'ResourceNotFoundException'},
                )
                described_rule = _eventbridge_optional(
                    lambda: events.describe_rule(Name=rule_name, EventBusName=name),
                    {'ResourceNotFoundException'},
                )
                rule_details.append({
                    'name': rule_name,
                    'arn': rule.get('Arn'),
                    'state': rule.get('State'),
                    'description': rule.get('Description'),
                    'schedule_expression': rule.get('ScheduleExpression'),
                    'event_pattern': rule.get('EventPattern'),
                    'role_arn': rule.get('RoleArn'),
                    'managed_by': rule.get('ManagedBy'),
                    'details': described_rule,
                    'targets': targets,
                    'target_count': len(targets) if isinstance(targets, list) else 0,
                })

        return {
            'name': name,
            'arn': bus.get('Arn') or (details.get('Arn') if isinstance(details, dict) else None),
            'description': bus.get('Description') or (details.get('Description') if isinstance(details, dict) else None),
            'policy': bus.get('Policy') or (details.get('Policy') if isinstance(details, dict) else None),
            'details': details,
            'rules': rule_details,
            'rule_count': len(rule_details),
            'target_count': sum(rule.get('target_count') or 0 for rule in rule_details),
        }

    detailed_buses = [bus_detail(bus) for bus in buses]

    return {
        'summary': {
            'event_buses': len(detailed_buses),
            'rules': sum(bus.get('rule_count') or 0 for bus in detailed_buses),
            'targets': sum(bus.get('target_count') or 0 for bus in detailed_buses),
            'enabled_rules': sum(
                1
                for bus in detailed_buses
                for rule in bus.get('rules', [])
                if rule.get('state') == 'ENABLED'
            ),
        },
        'event_buses': detailed_buses,
        'supported': [
            'CreateEventBus',
            'DeleteEventBus',
            'DescribeEventBus',
            'ListEventBuses',
            'PutRule',
            'DeleteRule',
            'DescribeRule',
            'ListRules',
            'EnableRule',
            'DisableRule',
            'PutTargets',
            'RemoveTargets',
            'ListTargetsByRule',
            'PutEvents',
        ],
        'notes': [
            'The default event bus is named default and accepts AWS service events.',
            'Custom event buses are for application events.',
        ],
    }


def _cognito_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (BotoCoreError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def cognito_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    cognito = factory.client('cognito-idp')
    pools = _safe_value(lambda: cognito.list_user_pools(MaxResults=60).get('UserPools', []), [])

    def pool_detail(pool: dict[str, Any]) -> dict[str, Any]:
        pool_id = pool.get('Id')
        pool_arn = f'arn:aws:cognito-idp:{factory.region}:000000000000:userpool/{pool_id}' if pool_id else None
        details = _cognito_optional(
            lambda: cognito.describe_user_pool(UserPoolId=pool_id).get('UserPool', {}),
            {'ResourceNotFoundException'},
        )
        clients = _cognito_optional(
            lambda: cognito.list_user_pool_clients(UserPoolId=pool_id, MaxResults=60).get('UserPoolClients', []),
            {'ResourceNotFoundException'},
        )
        resource_servers = _cognito_optional(
            lambda: cognito.list_resource_servers(UserPoolId=pool_id, MaxResults=50).get('ResourceServers', []),
            {'ResourceNotFoundException'},
        )
        users = _cognito_optional(
            lambda: cognito.list_users(UserPoolId=pool_id, Limit=60).get('Users', []),
            {'ResourceNotFoundException'},
        )
        groups = _cognito_optional(
            lambda: cognito.list_groups(UserPoolId=pool_id, Limit=60).get('Groups', []),
            {'ResourceNotFoundException'},
        )

        client_details = []
        if isinstance(clients, list):
            for client in clients:
                client_id = client.get('ClientId')
                client_detail = _cognito_optional(
                    lambda: cognito.describe_user_pool_client(
                        UserPoolId=pool_id,
                        ClientId=client_id,
                    ).get('UserPoolClient', {}),
                    {'ResourceNotFoundException'},
                )
                if isinstance(client_detail, dict):
                    client_detail.pop('ClientSecret', None)
                client_details.append({
                    'name': client.get('ClientName') or client_id,
                    'client_id': client_id,
                    'details': client_detail,
                })

        user_details = []
        if isinstance(users, list):
            for user in users:
                username = user.get('Username')
                groups_for_user = _cognito_optional(
                    lambda: cognito.admin_list_groups_for_user(
                        UserPoolId=pool_id,
                        Username=username,
                    ).get('Groups', []),
                    {'ResourceNotFoundException', 'UserNotFoundException'},
                )
                user_details.append({
                    'name': username,
                    'status': user.get('UserStatus'),
                    'enabled': user.get('Enabled'),
                    'created': user.get('UserCreateDate'),
                    'modified': user.get('UserLastModifiedDate'),
                    'attributes': user.get('Attributes', []),
                    'groups': groups_for_user,
                })

        return {
            'name': pool.get('Name') or pool_id,
            'id': pool_id,
            'arn': pool_arn,
            'status': pool.get('Status'),
            'created': pool.get('CreationDate'),
            'last_modified': pool.get('LastModifiedDate'),
            'details': details,
            'tags': _cognito_optional(
                lambda: cognito.list_tags_for_resource(ResourceArn=pool_arn).get('Tags', {}),
                {'ResourceNotFoundException'},
            ) if pool_arn else None,
            'clients': client_details,
            'resource_servers': resource_servers,
            'users': user_details,
            'groups': groups,
            'discovery_url': f'{factory.endpoint_url.rstrip("/")}/{pool_id}/.well-known/openid-configuration' if pool_id else None,
            'jwks_url': f'{factory.endpoint_url.rstrip("/")}/{pool_id}/.well-known/jwks.json' if pool_id else None,
            'oauth_token_url': f'{factory.endpoint_url.rstrip("/")}/cognito-idp/oauth2/token',
        }

    detailed_pools = [pool_detail(pool) for pool in pools]

    return {
        'summary': {
            'user_pools': len(detailed_pools),
            'clients': sum(len(pool.get('clients') or []) for pool in detailed_pools),
            'users': sum(len(pool.get('users') or []) for pool in detailed_pools),
            'groups': sum(
                len(pool.get('groups') or [])
                for pool in detailed_pools
                if isinstance(pool.get('groups'), list)
            ),
            'resource_servers': sum(
                len(pool.get('resource_servers') or [])
                for pool in detailed_pools
                if isinstance(pool.get('resource_servers'), list)
            ),
        },
        'user_pools': detailed_pools,
        'supported': [
            'CreateUserPool',
            'DescribeUserPool',
            'ListUserPools',
            'UpdateUserPool',
            'DeleteUserPool',
            'TagResource',
            'UntagResource',
            'ListTagsForResource',
            'CreateUserPoolClient',
            'DescribeUserPoolClient',
            'ListUserPoolClients',
            'DeleteUserPoolClient',
            'CreateResourceServer',
            'DescribeResourceServer',
            'ListResourceServers',
            'DeleteResourceServer',
            'AdminCreateUser',
            'AdminGetUser',
            'AdminDeleteUser',
            'AdminSetUserPassword',
            'AdminUpdateUserAttributes',
            'SignUp',
            'ConfirmSignUp',
            'GetUser',
            'UpdateUserAttributes',
            'ChangePassword',
            'ForgotPassword',
            'ConfirmForgotPassword',
            'InitiateAuth',
            'AdminInitiateAuth',
            'RespondToAuthChallenge',
            'ListUsers',
            'CreateGroup',
            'GetGroup',
            'ListGroups',
            'DeleteGroup',
            'AdminAddUserToGroup',
            'AdminRemoveUserFromGroup',
            'AdminListGroupsForUser',
        ],
        'endpoints': [
            'GET /{userPoolId}/.well-known/openid-configuration',
            'GET /{userPoolId}/.well-known/jwks.json',
            'POST /cognito-idp/oauth2/token',
        ],
        'notes': [
            'Client secrets are intentionally omitted from dashboard output.',
            'floci:override-id can pin a user pool ID at creation time and is stripped from persisted tags.',
            'OAuth client_credentials is emulator-friendly and does not require a Cognito domain.',
            'Tokens use the local emulator base URL plus pool ID as issuer.',
        ],
    }


def _apigateway_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (BotoCoreError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def apigateway_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    apigateway = factory.client('apigateway')
    apigatewayv2 = factory.client('apigatewayv2')

    rest_apis = _safe_value(lambda: _paginate(apigateway, 'get_rest_apis', 'items'), [])
    http_apis = _safe_value(lambda: _paginate(apigatewayv2, 'get_apis', 'Items'), [])

    def rest_api_detail(api: dict[str, Any]) -> dict[str, Any]:
        api_id = api.get('id')
        resources = _apigateway_optional(
            lambda: _paginate(apigateway, 'get_resources', 'items', restApiId=api_id),
            {'NotFoundException'},
        )
        deployments = _apigateway_optional(
            lambda: _paginate(apigateway, 'get_deployments', 'items', restApiId=api_id),
            {'NotFoundException'},
        )
        stages = _apigateway_optional(
            lambda: apigateway.get_stages(restApiId=api_id).get('item', []),
            {'NotFoundException'},
        )
        authorizers = _apigateway_optional(
            lambda: _paginate(apigateway, 'get_authorizers', 'items', restApiId=api_id),
            {'NotFoundException'},
        )
        validators = _apigateway_optional(
            lambda: _paginate(apigateway, 'get_request_validators', 'items', restApiId=api_id),
            {'NotFoundException'},
        )
        models = _apigateway_optional(
            lambda: _paginate(apigateway, 'get_models', 'items', restApiId=api_id),
            {'NotFoundException'},
        )

        method_count = 0
        integration_count = 0
        if isinstance(resources, list):
            for resource in resources:
                methods = resource.get('resourceMethods') or {}
                method_count += len(methods)
                integration_count += sum(
                    1
                    for method in methods.values()
                    if isinstance(method, dict) and method.get('methodIntegration')
                )

        return {
            'name': api.get('name') or api_id,
            'id': api_id,
            'description': api.get('description'),
            'created': api.get('createdDate'),
            'version': api.get('version'),
            'api_key_source': api.get('apiKeySource'),
            'endpoint_configuration': api.get('endpointConfiguration'),
            'tags': api.get('tags'),
            'execute_url_pattern': f'{factory.endpoint_url.rstrip("/")}/restapis/{api_id}/{{stage}}/_user_request_/{{path}}' if api_id else None,
            'resource_count': len(resources) if isinstance(resources, list) else 0,
            'method_count': method_count,
            'integration_count': integration_count,
            'deployment_count': len(deployments) if isinstance(deployments, list) else 0,
            'stage_count': len(stages) if isinstance(stages, list) else 0,
            'authorizer_count': len(authorizers) if isinstance(authorizers, list) else 0,
            'validator_count': len(validators) if isinstance(validators, list) else 0,
            'model_count': len(models) if isinstance(models, list) else 0,
            'resources': resources,
            'deployments': deployments,
            'stages': stages,
            'authorizers': authorizers,
            'request_validators': validators,
            'models': models,
        }

    def http_api_detail(api: dict[str, Any]) -> dict[str, Any]:
        api_id = api.get('ApiId')
        routes = _apigateway_optional(
            lambda: _paginate(apigatewayv2, 'get_routes', 'Items', ApiId=api_id),
            {'NotFoundException'},
        )
        integrations = _apigateway_optional(
            lambda: _paginate(apigatewayv2, 'get_integrations', 'Items', ApiId=api_id),
            {'NotFoundException'},
        )
        authorizers = _apigateway_optional(
            lambda: _paginate(apigatewayv2, 'get_authorizers', 'Items', ApiId=api_id),
            {'NotFoundException'},
        )
        stages = _apigateway_optional(
            lambda: _paginate(apigatewayv2, 'get_stages', 'Items', ApiId=api_id),
            {'NotFoundException'},
        )
        deployments = _apigateway_optional(
            lambda: _paginate(apigatewayv2, 'get_deployments', 'Items', ApiId=api_id),
            {'NotFoundException'},
        )

        return {
            'name': api.get('Name') or api_id,
            'id': api_id,
            'protocol_type': api.get('ProtocolType'),
            'api_endpoint': api.get('ApiEndpoint'),
            'created': api.get('CreatedDate'),
            'description': api.get('Description'),
            'route_selection_expression': api.get('RouteSelectionExpression'),
            'tags': api.get('Tags'),
            'route_count': len(routes) if isinstance(routes, list) else 0,
            'integration_count': len(integrations) if isinstance(integrations, list) else 0,
            'authorizer_count': len(authorizers) if isinstance(authorizers, list) else 0,
            'stage_count': len(stages) if isinstance(stages, list) else 0,
            'deployment_count': len(deployments) if isinstance(deployments, list) else 0,
            'routes': routes,
            'integrations': integrations,
            'authorizers': authorizers,
            'stages': stages,
            'deployments': deployments,
        }

    detailed_rest_apis = [rest_api_detail(api) for api in rest_apis]
    detailed_http_apis = [http_api_detail(api) for api in http_apis]
    api_keys = _apigateway_optional(lambda: _paginate(apigateway, 'get_api_keys', 'items', includeValues=False), set())
    usage_plans = _apigateway_optional(lambda: _paginate(apigateway, 'get_usage_plans', 'items'), set())
    domain_names = _apigateway_optional(lambda: _paginate(apigateway, 'get_domain_names', 'items'), set())

    return {
        'summary': {
            'rest_apis': len(detailed_rest_apis),
            'http_apis': len(detailed_http_apis),
            'routes_and_resources': sum(api.get('resource_count') or 0 for api in detailed_rest_apis) + sum(api.get('route_count') or 0 for api in detailed_http_apis),
            'methods': sum(api.get('method_count') or 0 for api in detailed_rest_apis),
            'integrations': sum(api.get('integration_count') or 0 for api in detailed_rest_apis + detailed_http_apis),
            'stages': sum(api.get('stage_count') or 0 for api in detailed_rest_apis + detailed_http_apis),
            'api_keys': len(api_keys) if isinstance(api_keys, list) else 0,
            'usage_plans': len(usage_plans) if isinstance(usage_plans, list) else 0,
        },
        'rest_apis': detailed_rest_apis,
        'http_apis': detailed_http_apis,
        'api_keys': api_keys,
        'usage_plans': usage_plans,
        'domain_names': domain_names,
        'supported_v1': {
            'APIs': ['CreateRestApi', 'ImportRestApi', 'PutRestApi', 'GetRestApi', 'GetRestApis', 'UpdateRestApi', 'DeleteRestApi'],
            'Resources': ['CreateResource', 'GetResource', 'GetResources', 'UpdateResource', 'DeleteResource'],
            'Methods': ['PutMethod', 'GetMethod', 'UpdateMethod', 'DeleteMethod'],
            'Integrations': ['PutIntegration', 'GetIntegration', 'UpdateIntegration', 'DeleteIntegration'],
            'Deployments and stages': ['CreateDeployment', 'GetDeployments', 'CreateStage', 'GetStage', 'GetStages', 'UpdateStage', 'DeleteStage'],
            'Authorizers and validation': ['CreateAuthorizer', 'GetAuthorizer', 'GetAuthorizers', 'CreateRequestValidator', 'GetRequestValidator', 'GetRequestValidators', 'DeleteRequestValidator'],
            'Keys and plans': ['CreateApiKey', 'GetApiKeys', 'CreateUsagePlan', 'GetUsagePlans', 'DeleteUsagePlan', 'CreateUsagePlanKey', 'GetUsagePlanKey', 'GetUsagePlanKeys', 'DeleteUsagePlanKey'],
            'Models and domains': ['CreateModel', 'GetModel', 'GetModels', 'DeleteModel', 'CreateDomainName', 'GetDomainName', 'GetDomainNames', 'DeleteDomainName'],
            'Tags': ['TagResource', 'UntagResource', 'GetTags'],
        },
        'supported_v2': {
            'APIs': ['CreateApi', 'GetApi', 'GetApis', 'DeleteApi'],
            'Routes': ['CreateRoute', 'GetRoute', 'GetRoutes', 'DeleteRoute'],
            'Integrations': ['CreateIntegration', 'GetIntegration', 'GetIntegrations'],
            'Authorizers': ['CreateAuthorizer', 'GetAuthorizer', 'GetAuthorizers', 'DeleteAuthorizer'],
            'Stages and deployments': ['CreateStage', 'GetStage', 'GetStages', 'DeleteStage', 'CreateDeployment', 'GetDeployments'],
        },
        'not_implemented_v1': [
            'GetDeployment',
            'UpdateDeployment',
            'DeleteDeployment',
            'UpdateAuthorizer',
            'DeleteAuthorizer',
            'TestInvokeAuthorizer',
            'GetApiKey',
            'UpdateApiKey',
            'DeleteApiKey',
            'ImportApiKeys',
            'GetUsagePlan',
            'UpdateUsagePlan',
            'Gateway Responses',
            'Documentation parts and versions',
            'VPC Links',
            'Client Certificates',
            'Account operations',
            'GetExport',
        ],
        'notes': [
            'Floci supports API Gateway v1 REST APIs and API Gateway v2 HTTP APIs.',
            'The v1 execute plane is served under /restapis/{id}/{stage}/_user_request_/...',
            'This page shows management-plane resources; proxied traffic remains available through Floci directly.',
        ],
    }

def _appconfig_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (AttributeError, BotoCoreError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def _appconfig_content_preview(content: Any) -> dict[str, Any]:
    if content is None:
        return {'size_bytes': 0, 'preview': None, 'encoding': None}

    if hasattr(content, 'read'):
        content = content.read()

    if isinstance(content, str):
        raw = content.encode('utf-8')
        text = content
    elif isinstance(content, bytes):
        raw = content
        try:
            text = content.decode('utf-8')
        except UnicodeDecodeError:
            text = None
    else:
        text = json.dumps(content, default=str)
        raw = text.encode('utf-8')

    return {
        'size_bytes': len(raw),
        'preview': text[:500] if text is not None else None,
        'encoding': 'utf-8' if text is not None else 'binary',
    }


def appconfig_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    appconfig = factory.client('appconfig')
    applications = _safe_value(lambda: _paginate(appconfig, 'list_applications', 'Items'), [])
    deployment_strategies = _safe_value(lambda: _paginate(appconfig, 'list_deployment_strategies', 'Items'), [])

    def hosted_version_detail(application_id: str, profile_id: str, version: dict[str, Any]) -> dict[str, Any]:
        version_number = version.get('VersionNumber')
        details = _appconfig_optional(
            lambda: appconfig.get_hosted_configuration_version(
                ApplicationId=application_id,
                ConfigurationProfileId=profile_id,
                VersionNumber=version_number,
            ),
            {'BadRequestException', 'NotFoundException'},
        )
        described = details if isinstance(details, dict) and not details.get('error') else {}
        content_preview = _appconfig_content_preview(described.get('Content'))

        return {
            'name': str(version_number),
            'version_number': version_number,
            'application_id': application_id,
            'configuration_profile_id': profile_id,
            'description': version.get('Description') or described.get('Description'),
            'content_type': version.get('ContentType') or described.get('ContentType'),
            'version_label': version.get('VersionLabel') or described.get('VersionLabel'),
            'kms_key_arn': described.get('KmsKeyArn'),
            'content_size_bytes': content_preview.get('size_bytes'),
            'content_encoding': content_preview.get('encoding'),
            'content_preview': content_preview.get('preview'),
            'details': details if isinstance(details, dict) and details.get('error') else None,
        }

    def profile_detail(application_id: str, profile: dict[str, Any]) -> dict[str, Any]:
        profile_id = profile.get('Id')
        details = _appconfig_optional(
            lambda: appconfig.get_configuration_profile(
                ApplicationId=application_id,
                ConfigurationProfileId=profile_id,
            ),
            {'BadRequestException', 'NotFoundException'},
        )
        described = details if isinstance(details, dict) and not details.get('error') else {}
        versions = _appconfig_optional(
            lambda: _paginate(
                appconfig,
                'list_hosted_configuration_versions',
                'Items',
                ApplicationId=application_id,
                ConfigurationProfileId=profile_id,
            ),
            {'BadRequestException', 'NotFoundException'},
        )
        version_details = [
            hosted_version_detail(application_id, profile_id, version)
            for version in versions
        ] if isinstance(versions, list) else []

        return {
            'name': profile.get('Name') or described.get('Name') or profile_id,
            'id': profile_id,
            'application_id': application_id,
            'description': profile.get('Description') or described.get('Description'),
            'location_uri': profile.get('LocationUri') or described.get('LocationUri'),
            'retrieval_role_arn': described.get('RetrievalRoleArn'),
            'type': profile.get('Type') or described.get('Type'),
            'validators': described.get('Validators'),
            'kms_key_arn': described.get('KmsKeyArn'),
            'kms_key_identifier': described.get('KmsKeyIdentifier'),
            'hosted_version_count': len(version_details),
            'hosted_versions': version_details,
            'details': details if isinstance(details, dict) and details.get('error') else None,
            'hosted_versions_error': versions if isinstance(versions, dict) and versions.get('error') else None,
        }

    def deployment_detail(application_id: str, environment_id: str, deployment: dict[str, Any]) -> dict[str, Any]:
        deployment_number = deployment.get('DeploymentNumber')
        details = _appconfig_optional(
            lambda: appconfig.get_deployment(
                ApplicationId=application_id,
                EnvironmentId=environment_id,
                DeploymentNumber=deployment_number,
            ),
            {'BadRequestException', 'NotFoundException'},
        )
        described = details if isinstance(details, dict) and not details.get('error') else {}

        return {
            'name': str(deployment_number),
            'deployment_number': deployment_number,
            'application_id': application_id,
            'environment_id': environment_id,
            'state': deployment.get('State') or described.get('State'),
            'configuration_name': deployment.get('ConfigurationName') or described.get('ConfigurationName'),
            'configuration_profile_id': deployment.get('ConfigurationProfileId') or described.get('ConfigurationProfileId'),
            'configuration_version': deployment.get('ConfigurationVersion') or described.get('ConfigurationVersion'),
            'deployment_strategy_id': deployment.get('DeploymentStrategyId') or described.get('DeploymentStrategyId'),
            'percentage_complete': deployment.get('PercentageComplete') or described.get('PercentageComplete'),
            'started_at': deployment.get('StartedAt') or described.get('StartedAt'),
            'completed_at': deployment.get('CompletedAt') or described.get('CompletedAt'),
            'event_log': described.get('EventLog'),
            'applied_extensions': described.get('AppliedExtensions'),
            'version_label': described.get('VersionLabel'),
            'details': details if isinstance(details, dict) and details.get('error') else None,
        }

    def environment_detail(application_id: str, environment: dict[str, Any]) -> dict[str, Any]:
        environment_id = environment.get('Id')
        details = _appconfig_optional(
            lambda: appconfig.get_environment(
                ApplicationId=application_id,
                EnvironmentId=environment_id,
            ),
            {'BadRequestException', 'NotFoundException'},
        )
        described = details if isinstance(details, dict) and not details.get('error') else {}
        deployments = _appconfig_optional(
            lambda: _paginate(
                appconfig,
                'list_deployments',
                'Items',
                ApplicationId=application_id,
                EnvironmentId=environment_id,
            ),
            {'BadRequestException', 'NotFoundException'},
        )
        deployment_details = [
            deployment_detail(application_id, environment_id, deployment)
            for deployment in deployments
        ] if isinstance(deployments, list) else []

        return {
            'name': environment.get('Name') or described.get('Name') or environment_id,
            'id': environment_id,
            'application_id': application_id,
            'description': environment.get('Description') or described.get('Description'),
            'state': environment.get('State') or described.get('State'),
            'monitors': described.get('Monitors'),
            'deployment_count': len(deployment_details),
            'deployments': deployment_details,
            'details': details if isinstance(details, dict) and details.get('error') else None,
            'deployments_error': deployments if isinstance(deployments, dict) and deployments.get('error') else None,
        }

    def application_detail(application: dict[str, Any]) -> dict[str, Any]:
        application_id = application.get('Id')
        details = _appconfig_optional(
            lambda: appconfig.get_application(ApplicationId=application_id),
            {'BadRequestException', 'NotFoundException'},
        )
        environments = _appconfig_optional(
            lambda: _paginate(appconfig, 'list_environments', 'Items', ApplicationId=application_id),
            {'BadRequestException', 'NotFoundException'},
        )
        profiles = _appconfig_optional(
            lambda: _paginate(appconfig, 'list_configuration_profiles', 'Items', ApplicationId=application_id),
            {'BadRequestException', 'NotFoundException'},
        )
        described = details if isinstance(details, dict) and not details.get('error') else {}
        environment_details = [
            environment_detail(application_id, environment)
            for environment in environments
        ] if isinstance(environments, list) else []
        profile_details = [
            profile_detail(application_id, profile)
            for profile in profiles
        ] if isinstance(profiles, list) else []

        return {
            'name': application.get('Name') or described.get('Name') or application_id,
            'id': application_id,
            'description': application.get('Description') or described.get('Description'),
            'environment_count': len(environment_details),
            'configuration_profile_count': len(profile_details),
            'hosted_version_count': sum(profile.get('hosted_version_count') or 0 for profile in profile_details),
            'deployment_count': sum(environment.get('deployment_count') or 0 for environment in environment_details),
            'environments': environment_details,
            'configuration_profiles': profile_details,
            'details': details if isinstance(details, dict) and details.get('error') else None,
            'environments_error': environments if isinstance(environments, dict) and environments.get('error') else None,
            'configuration_profiles_error': profiles if isinstance(profiles, dict) and profiles.get('error') else None,
        }

    def deployment_strategy_detail(strategy: dict[str, Any]) -> dict[str, Any]:
        strategy_id = strategy.get('Id')
        details = _appconfig_optional(
            lambda: appconfig.get_deployment_strategy(DeploymentStrategyId=strategy_id),
            {'BadRequestException', 'NotFoundException'},
        )
        described = details if isinstance(details, dict) and not details.get('error') else {}

        return {
            'name': strategy.get('Name') or described.get('Name') or strategy_id,
            'id': strategy_id,
            'description': strategy.get('Description') or described.get('Description'),
            'deployment_duration_in_minutes': strategy.get('DeploymentDurationInMinutes') or described.get('DeploymentDurationInMinutes'),
            'growth_type': strategy.get('GrowthType') or described.get('GrowthType'),
            'growth_factor': strategy.get('GrowthFactor') or described.get('GrowthFactor'),
            'final_bake_time_in_minutes': strategy.get('FinalBakeTimeInMinutes') or described.get('FinalBakeTimeInMinutes'),
            'replicate_to': strategy.get('ReplicateTo') or described.get('ReplicateTo'),
            'details': details if isinstance(details, dict) and details.get('error') else None,
        }

    detailed_applications = [application_detail(application) for application in applications]
    detailed_strategies = [deployment_strategy_detail(strategy) for strategy in deployment_strategies]
    environments = [
        environment
        for application in detailed_applications
        for environment in application.get('environments', [])
    ]
    profiles = [
        profile
        for application in detailed_applications
        for profile in application.get('configuration_profiles', [])
    ]
    hosted_versions = [
        version
        for profile in profiles
        for version in profile.get('hosted_versions', [])
    ]
    deployments = [
        deployment
        for environment in environments
        for deployment in environment.get('deployments', [])
    ]

    return {
        'summary': {
            'applications': len(detailed_applications),
            'environments': len(environments),
            'configuration_profiles': len(profiles),
            'hosted_versions': len(hosted_versions),
            'deployment_strategies': len(detailed_strategies),
            'deployments': len(deployments),
        },
        'applications': detailed_applications,
        'environments': environments,
        'configuration_profiles': profiles,
        'hosted_versions': hosted_versions,
        'deployment_strategies': detailed_strategies,
        'deployments': deployments,
        'management_supported': [
            'CreateApplication',
            'GetApplication',
            'ListApplications',
            'DeleteApplication',
            'CreateEnvironment',
            'GetEnvironment',
            'ListEnvironments',
            'CreateConfigurationProfile',
            'GetConfigurationProfile',
            'ListConfigurationProfiles',
            'CreateHostedConfigurationVersion',
            'GetHostedConfigurationVersion',
            'CreateDeploymentStrategy',
            'GetDeploymentStrategy',
            'StartDeployment',
            'GetDeployment',
        ],
        'data_supported': [
            'StartConfigurationSession',
            'GetLatestConfiguration',
        ],
        'notes': [
            'Management resources are read through the AppConfig API.',
            'Runtime retrieval uses the AppConfigData API with configuration sessions and latest-configuration tokens.',
            'Hosted configuration content is shown as size and a short UTF-8 preview to keep the dashboard readable.',
        ],
    }


def bedrockruntime_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    endpoint = factory.endpoint_url.rstrip('/')
    runtime = factory.client('bedrock-runtime')
    available_sdk_operations = runtime.meta.service_model.operation_names

    supported_operations = [
        {
            'name': 'Converse',
            'operation': 'Converse',
            'method': 'POST',
            'endpoint': '/model/{modelId}/converse',
            'status': 'supported',
            'notes': 'Returns a static assistant message with synthetic token usage.',
        },
        {
            'name': 'InvokeModel',
            'operation': 'InvokeModel',
            'method': 'POST',
            'endpoint': '/model/{modelId}/invoke',
            'status': 'supported',
            'notes': 'Returns an Anthropic-shaped body for anthropic model IDs and a generic outputs body otherwise.',
        },
        {
            'name': 'ConverseStream',
            'operation': 'ConverseStream',
            'method': 'POST',
            'endpoint': '/model/{modelId}/converse-stream',
            'status': 'unsupported',
            'notes': 'Returns 501 UnsupportedOperationException.',
        },
        {
            'name': 'InvokeModelWithResponseStream',
            'operation': 'InvokeModelWithResponseStream',
            'method': 'POST',
            'endpoint': '/model/{modelId}/invoke-with-response-stream',
            'status': 'unsupported',
            'notes': 'Returns 501 UnsupportedOperationException.',
        },
    ]

    examples = [
        {
            'name': 'Converse',
            'cli': (
                'aws bedrock-runtime converse '
                '--model-id anthropic.claude-3-haiku-20240307-v1:0 '
                '--messages \'[{"role":"user","content":[{"text":"hi"}]}]\''
            ),
        },
        {
            'name': 'InvokeModel',
            'cli': (
                'aws bedrock-runtime invoke-model '
                '--model-id anthropic.claude-3-haiku-20240307-v1:0 '
                '--body \'{"anthropic_version":"bedrock-2023-05-31","max_tokens":100,"messages":[{"role":"user","content":"hi"}]}\' '
                '--cli-binary-format raw-in-base64-out /tmp/response.json'
            ),
        },
    ]

    return {
        'summary': {
            'supported_operations': sum(1 for operation in supported_operations if operation.get('status') == 'supported'),
            'unsupported_streaming_operations': sum(1 for operation in supported_operations if operation.get('status') == 'unsupported'),
            'management_plane_resources': 0,
            'real_inference': 0,
        },
        'operations': supported_operations,
        'configuration': {
            'service_key': 'bedrock-runtime',
            'enabled_variable': 'floci.services.bedrock-runtime.enabled',
            'endpoint_pattern': f'{endpoint}/model/{{modelId}}/...',
            'protocol': 'REST JSON',
        },
        'model_id_support': [
            {
                'name': 'Plain model ID',
                'example': 'anthropic.claude-3-haiku-20240307-v1:0',
            },
            {
                'name': 'Inference profile ID',
                'example': 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
            },
            {
                'name': 'Inference profile ARN',
                'example': 'arn:aws:bedrock:us-east-1:123456789012:inference-profile/us.anthropic.claude-3-5-sonnet-20241022-v2:0',
            },
        ],
        'request_behavior': [
            {
                'name': 'Converse validation',
                'detail': 'messages must be a non-empty array; system, inferenceConfig, and toolConfig are accepted and ignored.',
            },
            {
                'name': 'InvokeModel body handling',
                'detail': 'request bodies are accepted as opaque bytes and are not parsed by the stub.',
            },
            {
                'name': 'Tool use',
                'detail': 'tool-use round-tripping is not implemented.',
            },
        ],
        'examples': examples,
        'available_sdk_operations': available_sdk_operations,
        'out_of_scope': [
            'Real model inference; responses are fixed stubs.',
            'Streaming responses.',
            'Bedrock management plane operations such as ListFoundationModels and GetFoundationModel.',
            'Bedrock Agents, Knowledge Bases, Guardrails, provisioned throughput, and customization.',
            'Tool-use round-tripping in Converse.',
        ],
        'notes': [
            'This page describes the Bedrock Runtime data plane; Floci does not persist Bedrock Runtime resources.',
            'The response shape is designed to satisfy AWS SDK and CLI clients without calling a real model.',
        ],
    }


def _codebuild_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (AttributeError, BotoCoreError, KeyError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def codebuild_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    codebuild = factory.client('codebuild')
    project_names = _safe_value(lambda: _paginate(codebuild, 'list_projects', 'projects'), [])
    build_ids = _safe_value(lambda: _paginate(codebuild, 'list_builds', 'ids'), [])
    report_group_arns = _safe_value(lambda: _paginate(codebuild, 'list_report_groups', 'reportGroups'), [])
    report_arns = _safe_value(lambda: _paginate(codebuild, 'list_reports', 'reports'), [])
    source_credentials = _safe_value(lambda: codebuild.list_source_credentials().get('sourceCredentialsInfos', []), [])

    def batch_get_projects(names: list[str]) -> list[dict[str, Any]]:
        projects: list[dict[str, Any]] = []
        for chunk in _chunks(names, 100):
            response = _codebuild_optional(
                lambda chunk=chunk: codebuild.batch_get_projects(names=chunk),
                {'InvalidInputException'},
            )
            if isinstance(response, dict) and not response.get('error'):
                projects.extend(response.get('projects', []))
        return projects

    def batch_get_builds(ids: list[str]) -> list[dict[str, Any]]:
        builds: list[dict[str, Any]] = []
        for chunk in _chunks(ids, 100):
            response = _codebuild_optional(
                lambda chunk=chunk: codebuild.batch_get_builds(ids=chunk),
                {'InvalidInputException'},
            )
            if isinstance(response, dict) and not response.get('error'):
                builds.extend(response.get('builds', []))
        return builds

    def batch_get_report_groups(arns: list[str]) -> list[dict[str, Any]]:
        groups: list[dict[str, Any]] = []
        for chunk in _chunks(arns, 100):
            response = _codebuild_optional(
                lambda chunk=chunk: codebuild.batch_get_report_groups(reportGroupArns=chunk),
                {'InvalidInputException'},
            )
            if isinstance(response, dict) and not response.get('error'):
                groups.extend(response.get('reportGroups', []))
        return groups

    def batch_get_reports(arns: list[str]) -> list[dict[str, Any]]:
        reports: list[dict[str, Any]] = []
        for chunk in _chunks(arns, 100):
            response = _codebuild_optional(
                lambda chunk=chunk: codebuild.batch_get_reports(reportArns=chunk),
                {'InvalidInputException'},
            )
            if isinstance(response, dict) and not response.get('error'):
                reports.extend(response.get('reports', []))
        return reports

    projects = batch_get_projects(project_names) if project_names else []
    builds = batch_get_builds(build_ids) if build_ids else []
    report_groups = batch_get_report_groups(report_group_arns) if report_group_arns else []
    reports = batch_get_reports(report_arns) if report_arns else []

    project_details = [
        {
            'name': project.get('name'),
            'arn': project.get('arn'),
            'description': project.get('description'),
            'source': project.get('source'),
            'artifacts': project.get('artifacts'),
            'secondary_sources': project.get('secondarySources'),
            'secondary_artifacts': project.get('secondaryArtifacts'),
            'environment': project.get('environment'),
            'service_role': project.get('serviceRole'),
            'timeout_in_minutes': project.get('timeoutInMinutes'),
            'queued_timeout_in_minutes': project.get('queuedTimeoutInMinutes'),
            'encryption_key': project.get('encryptionKey'),
            'tags': project.get('tags'),
            'created': project.get('created'),
            'last_modified': project.get('lastModified'),
            'webhook': project.get('webhook'),
            'vpc_config': project.get('vpcConfig'),
            'badge': project.get('badge'),
            'logs_config': project.get('logsConfig'),
            'file_system_locations': project.get('fileSystemLocations'),
            'build_batch_config': project.get('buildBatchConfig'),
            'concurrent_build_limit': project.get('concurrentBuildLimit'),
            'project_visibility': project.get('projectVisibility'),
            'resource_access_role': project.get('resourceAccessRole'),
        }
        for project in projects
    ]

    build_details = [
        {
            'name': build.get('id'),
            'id': build.get('id'),
            'arn': build.get('arn'),
            'build_number': build.get('buildNumber'),
            'project_name': build.get('projectName'),
            'status': build.get('buildStatus'),
            'source_version': build.get('sourceVersion'),
            'resolved_source_version': build.get('resolvedSourceVersion'),
            'start_time': build.get('startTime'),
            'end_time': build.get('endTime'),
            'current_phase': build.get('currentPhase'),
            'phases': build.get('phases'),
            'source': build.get('source'),
            'secondary_sources': build.get('secondarySources'),
            'artifacts': build.get('artifacts'),
            'secondary_artifacts': build.get('secondaryArtifacts'),
            'environment': build.get('environment'),
            'logs': build.get('logs'),
            'timeout_in_minutes': build.get('timeoutInMinutes'),
            'queued_timeout_in_minutes': build.get('queuedTimeoutInMinutes'),
            'build_complete': build.get('buildComplete'),
            'initiator': build.get('initiator'),
            'vpc_config': build.get('vpcConfig'),
            'debug_session': build.get('debugSession'),
            'encryption_key': build.get('encryptionKey'),
            'exported_environment_variables': build.get('exportedEnvironmentVariables'),
            'report_arns': build.get('reportArns'),
            'file_system_locations': build.get('fileSystemLocations'),
            'build_batch_arn': build.get('buildBatchArn'),
        }
        for build in builds
    ]

    report_group_details = [
        {
            'name': group.get('name') or group.get('arn'),
            'arn': group.get('arn'),
            'type': group.get('type'),
            'export_config': group.get('exportConfig'),
            'created': group.get('created'),
            'last_modified': group.get('lastModified'),
            'tags': group.get('tags'),
            'status': group.get('status'),
        }
        for group in report_groups
    ]

    report_details = [
        {
            'name': report.get('name') or report.get('arn'),
            'arn': report.get('arn'),
            'type': report.get('type'),
            'report_group_arn': report.get('reportGroupArn'),
            'execution_id': report.get('executionId'),
            'status': report.get('status'),
            'created': report.get('created'),
            'expired': report.get('expired'),
            'export_config': report.get('exportConfig'),
            'truncated': report.get('truncated'),
            'test_summary': report.get('testSummary'),
            'code_coverage_summary': report.get('codeCoverageSummary'),
        }
        for report in reports
    ]

    return {
        'summary': {
            'projects': len(project_names),
            'builds': len(build_ids),
            'report_groups': len(report_group_arns),
            'reports': len(report_arns),
            'source_credentials': len(source_credentials),
        },
        'projects': project_details or [{'name': name} for name in project_names],
        'builds': build_details or [{'name': build_id, 'id': build_id} for build_id in build_ids],
        'report_groups': report_group_details or [{'name': arn, 'arn': arn} for arn in report_group_arns],
        'reports': report_details or [{'name': arn, 'arn': arn} for arn in report_arns],
        'source_credentials': source_credentials,
        'supported_from_sdk': [
            'CreateProject',
            'BatchGetProjects',
            'ListProjects',
            'UpdateProject',
            'DeleteProject',
            'StartBuild',
            'BatchGetBuilds',
            'ListBuilds',
            'ListBuildsForProject',
            'StopBuild',
            'CreateReportGroup',
            'BatchGetReportGroups',
            'ListReportGroups',
            'DeleteReportGroup',
            'BatchGetReports',
            'ListReports',
            'ListReportsForReportGroup',
            'ImportSourceCredentials',
            'ListSourceCredentials',
            'DeleteSourceCredentials',
        ],
        'notes': [
            'This page is inferred from the CodeBuild AWS SDK API because service docs are not available yet.',
            'If Floci only implements a subset of CodeBuild, unsupported calls are treated as empty inventory where possible.',
        ],
    }


def _codedeploy_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (AttributeError, BotoCoreError, KeyError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def codedeploy_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    codedeploy = factory.client('codedeploy')
    application_names = _safe_value(lambda: _paginate(codedeploy, 'list_applications', 'applications'), [])
    deployment_config_names = _safe_value(lambda: _paginate(codedeploy, 'list_deployment_configs', 'deploymentConfigsList'), [])
    on_prem_instance_names = _safe_value(lambda: _paginate(codedeploy, 'list_on_premises_instances', 'instanceNames'), [])

    def application_detail(name: str) -> dict[str, Any]:
        response = _codedeploy_optional(
            lambda: codedeploy.get_application(applicationName=name),
            {'ApplicationDoesNotExistException', 'InvalidApplicationNameException'},
        )
        application = response.get('application', {}) if isinstance(response, dict) and not response.get('error') else {}
        group_names = _codedeploy_optional(
            lambda: _paginate(codedeploy, 'list_deployment_groups', 'deploymentGroups', applicationName=name),
            {'ApplicationDoesNotExistException', 'InvalidApplicationNameException'},
        )
        deployment_ids = _codedeploy_optional(
            lambda: _paginate(codedeploy, 'list_deployments', 'deployments', applicationName=name),
            {'ApplicationDoesNotExistException', 'InvalidApplicationNameException'},
        )

        return {
            'name': name,
            'application_id': application.get('applicationId'),
            'compute_platform': application.get('computePlatform'),
            'linked_to_github': application.get('linkedToGitHub'),
            'git_hub_account_name': application.get('gitHubAccountName'),
            'deployment_group_count': len(group_names) if isinstance(group_names, list) else 0,
            'deployment_count': len(deployment_ids) if isinstance(deployment_ids, list) else 0,
            'deployment_groups': group_names if isinstance(group_names, list) else [],
            'deployments': deployment_ids if isinstance(deployment_ids, list) else [],
            'details': response if isinstance(response, dict) and response.get('error') else None,
            'deployment_groups_error': group_names if isinstance(group_names, dict) and group_names.get('error') else None,
            'deployments_error': deployment_ids if isinstance(deployment_ids, dict) and deployment_ids.get('error') else None,
        }

    def deployment_group_detail(application_name: str, group_name: str) -> dict[str, Any]:
        response = _codedeploy_optional(
            lambda: codedeploy.get_deployment_group(
                applicationName=application_name,
                deploymentGroupName=group_name,
            ),
            {'ApplicationDoesNotExistException', 'DeploymentGroupDoesNotExistException', 'InvalidApplicationNameException'},
        )
        group = response.get('deploymentGroupInfo', {}) if isinstance(response, dict) and not response.get('error') else {}
        deployment_ids = _codedeploy_optional(
            lambda: _paginate(
                codedeploy,
                'list_deployments',
                'deployments',
                applicationName=application_name,
                deploymentGroupName=group_name,
            ),
            {'ApplicationDoesNotExistException', 'DeploymentGroupDoesNotExistException', 'InvalidApplicationNameException'},
        )

        return {
            'name': group_name,
            'application_name': application_name,
            'deployment_group_id': group.get('deploymentGroupId'),
            'service_role_arn': group.get('serviceRoleArn'),
            'deployment_config_name': group.get('deploymentConfigName'),
            'ec2_tag_filters': group.get('ec2TagFilters'),
            'on_premises_instance_tag_filters': group.get('onPremisesInstanceTagFilters'),
            'auto_scaling_groups': group.get('autoScalingGroups'),
            'trigger_configurations': group.get('triggerConfigurations'),
            'alarm_configuration': group.get('alarmConfiguration'),
            'auto_rollback_configuration': group.get('autoRollbackConfiguration'),
            'deployment_style': group.get('deploymentStyle'),
            'blue_green_deployment_configuration': group.get('blueGreenDeploymentConfiguration'),
            'load_balancer_info': group.get('loadBalancerInfo'),
            'last_successful_deployment': group.get('lastSuccessfulDeployment'),
            'last_attempted_deployment': group.get('lastAttemptedDeployment'),
            'outdated_instances_strategy': group.get('outdatedInstancesStrategy'),
            'compute_platform': group.get('computePlatform'),
            'ecs_services': group.get('ecsServices'),
            'termination_hook_enabled': group.get('terminationHookEnabled'),
            'deployment_count': len(deployment_ids) if isinstance(deployment_ids, list) else 0,
            'deployments': deployment_ids if isinstance(deployment_ids, list) else [],
            'details': response if isinstance(response, dict) and response.get('error') else None,
            'deployments_error': deployment_ids if isinstance(deployment_ids, dict) and deployment_ids.get('error') else None,
        }

    def deployment_detail(deployment_id: str) -> dict[str, Any]:
        response = _codedeploy_optional(
            lambda: codedeploy.get_deployment(deploymentId=deployment_id),
            {'DeploymentDoesNotExistException', 'InvalidDeploymentIdException'},
        )
        deployment = response.get('deploymentInfo', {}) if isinstance(response, dict) and not response.get('error') else {}

        return {
            'name': deployment_id,
            'deployment_id': deployment_id,
            'application_name': deployment.get('applicationName'),
            'deployment_group_name': deployment.get('deploymentGroupName'),
            'deployment_config_name': deployment.get('deploymentConfigName'),
            'status': deployment.get('status'),
            'error_information': deployment.get('errorInformation'),
            'create_time': deployment.get('createTime'),
            'start_time': deployment.get('startTime'),
            'complete_time': deployment.get('completeTime'),
            'deployment_overview': deployment.get('deploymentOverview'),
            'description': deployment.get('description'),
            'creator': deployment.get('creator'),
            'ignore_application_stop_failures': deployment.get('ignoreApplicationStopFailures'),
            'auto_rollback_configuration': deployment.get('autoRollbackConfiguration'),
            'update_outdated_instances_only': deployment.get('updateOutdatedInstancesOnly'),
            'rollback_info': deployment.get('rollbackInfo'),
            'deployment_style': deployment.get('deploymentStyle'),
            'target_instances': deployment.get('targetInstances'),
            'instance_termination_wait_time_started': deployment.get('instanceTerminationWaitTimeStarted'),
            'blue_green_deployment_configuration': deployment.get('blueGreenDeploymentConfiguration'),
            'load_balancer_info': deployment.get('loadBalancerInfo'),
            'additional_deployment_status_info': deployment.get('additionalDeploymentStatusInfo'),
            'file_exists_behavior': deployment.get('fileExistsBehavior'),
            'deployment_status_messages': deployment.get('deploymentStatusMessages'),
            'compute_platform': deployment.get('computePlatform'),
            'external_id': deployment.get('externalId'),
            'related_deployments': deployment.get('relatedDeployments'),
            'override_alarm_configuration': deployment.get('overrideAlarmConfiguration'),
            'revision': deployment.get('revision'),
            'details': response if isinstance(response, dict) and response.get('error') else None,
        }

    def deployment_config_detail(name: str) -> dict[str, Any]:
        response = _codedeploy_optional(
            lambda: codedeploy.get_deployment_config(deploymentConfigName=name),
            {'DeploymentConfigDoesNotExistException', 'InvalidDeploymentConfigNameException'},
        )
        config = response.get('deploymentConfigInfo', {}) if isinstance(response, dict) and not response.get('error') else {}

        return {
            'name': name,
            'deployment_config_id': config.get('deploymentConfigId'),
            'minimum_healthy_hosts': config.get('minimumHealthyHosts'),
            'traffic_routing_config': config.get('trafficRoutingConfig'),
            'compute_platform': config.get('computePlatform'),
            'zonal_config': config.get('zonalConfig'),
            'details': response if isinstance(response, dict) and response.get('error') else None,
        }

    applications = [application_detail(name) for name in application_names]
    deployment_groups = [
        deployment_group_detail(application.get('name'), group_name)
        for application in applications
        for group_name in application.get('deployment_groups', [])
    ]
    deployment_ids = sorted({
        deployment_id
        for application in applications
        for deployment_id in application.get('deployments', [])
    } | {
        deployment_id
        for group in deployment_groups
        for deployment_id in group.get('deployments', [])
    })
    deployments = [deployment_detail(deployment_id) for deployment_id in deployment_ids]
    deployment_configs = [deployment_config_detail(name) for name in deployment_config_names]
    on_prem_instances_response = _codedeploy_optional(
        lambda: codedeploy.batch_get_on_premises_instances(instanceNames=on_prem_instance_names),
        {'InvalidInstanceNameException'},
    ) if on_prem_instance_names else {'instanceInfos': []}
    on_prem_instances = (
        on_prem_instances_response.get('instanceInfos', [])
        if isinstance(on_prem_instances_response, dict) and not on_prem_instances_response.get('error')
        else []
    )

    return {
        'summary': {
            'applications': len(applications),
            'deployment_groups': len(deployment_groups),
            'deployments': len(deployments),
            'deployment_configs': len(deployment_configs),
            'on_prem_instances': len(on_prem_instance_names),
        },
        'applications': applications,
        'deployment_groups': deployment_groups,
        'deployments': deployments or [{'name': deployment_id, 'deployment_id': deployment_id} for deployment_id in deployment_ids],
        'deployment_configs': deployment_configs,
        'on_prem_instances': on_prem_instances or [{'name': name} for name in on_prem_instance_names],
        'supported_from_sdk': [
            'CreateApplication',
            'GetApplication',
            'ListApplications',
            'DeleteApplication',
            'CreateDeploymentGroup',
            'GetDeploymentGroup',
            'ListDeploymentGroups',
            'UpdateDeploymentGroup',
            'DeleteDeploymentGroup',
            'CreateDeployment',
            'GetDeployment',
            'ListDeployments',
            'StopDeployment',
            'CreateDeploymentConfig',
            'GetDeploymentConfig',
            'ListDeploymentConfigs',
            'DeleteDeploymentConfig',
            'RegisterApplicationRevision',
            'GetApplicationRevision',
            'ListApplicationRevisions',
            'RegisterOnPremisesInstance',
            'BatchGetOnPremisesInstances',
            'ListOnPremisesInstances',
            'DeregisterOnPremisesInstance',
        ],
        'notes': [
            'This page is inferred from the CodeDeploy AWS SDK API because service docs are not available yet.',
            'Deployment lists are collected from applications and deployment groups, then de-duplicated before detail lookup.',
        ],
    }

def _eks_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (AttributeError, BotoCoreError, KeyError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def eks_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    eks = factory.client('eks')
    cluster_names = _safe_value(lambda: _paginate(eks, 'list_clusters', 'clusters'), [])

    def access_entries(cluster_name: str) -> list[dict[str, Any]]:
        principals = _eks_optional(
            lambda: _paginate(eks, 'list_access_entries', 'accessEntries', clusterName=cluster_name),
            {'ResourceNotFoundException', 'InvalidParameterException'},
        )
        if not isinstance(principals, list):
            return []

        entries = []
        for principal in principals:
            detail = _eks_optional(
                lambda principal=principal: eks.describe_access_entry(
                    clusterName=cluster_name,
                    principalArn=principal,
                ).get('accessEntry', {}),
                {'ResourceNotFoundException', 'InvalidParameterException'},
            )
            entry = detail if isinstance(detail, dict) and not detail.get('error') else {'principalArn': principal}
            policies = _eks_optional(
                lambda principal=principal: _paginate(
                    eks,
                    'list_associated_access_policies',
                    'associatedAccessPolicies',
                    clusterName=cluster_name,
                    principalArn=principal,
                ),
                {'ResourceNotFoundException', 'InvalidParameterException'},
            )
            entries.append({
                'name': entry.get('principalArn') or principal,
                'cluster_name': cluster_name,
                'principal_arn': entry.get('principalArn') or principal,
                'kubernetes_groups': entry.get('kubernetesGroups'),
                'access_entry_arn': entry.get('accessEntryArn'),
                'created_at': entry.get('createdAt'),
                'modified_at': entry.get('modifiedAt'),
                'tags': entry.get('tags'),
                'username': entry.get('username'),
                'type': entry.get('type'),
                'associated_policies': policies if isinstance(policies, list) else [],
                'details': detail if isinstance(detail, dict) and detail.get('error') else None,
            })
        return entries

    def cluster_detail(name: str) -> dict[str, Any]:
        response = _eks_optional(lambda: eks.describe_cluster(name=name), {'ResourceNotFoundException'})
        cluster = response.get('cluster', {}) if isinstance(response, dict) and not response.get('error') else {}
        nodegroups = _eks_optional(lambda: _paginate(eks, 'list_nodegroups', 'nodegroups', clusterName=name), {'ResourceNotFoundException'})
        fargate_profiles = _eks_optional(lambda: _paginate(eks, 'list_fargate_profiles', 'fargateProfileNames', clusterName=name), {'ResourceNotFoundException'})
        addons = _eks_optional(lambda: _paginate(eks, 'list_addons', 'addons', clusterName=name), {'ResourceNotFoundException'})
        identity_provider_configs = _eks_optional(lambda: _paginate(eks, 'list_identity_provider_configs', 'identityProviderConfigs', clusterName=name), {'ResourceNotFoundException'})
        entries = access_entries(name)

        return {
            'name': name,
            'arn': cluster.get('arn'),
            'created_at': cluster.get('createdAt'),
            'version': cluster.get('version'),
            'endpoint': cluster.get('endpoint'),
            'role_arn': cluster.get('roleArn'),
            'resources_vpc_config': cluster.get('resourcesVpcConfig'),
            'kubernetes_network_config': cluster.get('kubernetesNetworkConfig'),
            'logging': cluster.get('logging'),
            'identity': cluster.get('identity'),
            'status': cluster.get('status'),
            'certificate_authority': cluster.get('certificateAuthority'),
            'platform_version': cluster.get('platformVersion'),
            'tags': cluster.get('tags'),
            'encryption_config': cluster.get('encryptionConfig'),
            'connector_config': cluster.get('connectorConfig'),
            'access_config': cluster.get('accessConfig'),
            'upgrade_policy': cluster.get('upgradePolicy'),
            'nodegroup_count': len(nodegroups) if isinstance(nodegroups, list) else 0,
            'fargate_profile_count': len(fargate_profiles) if isinstance(fargate_profiles, list) else 0,
            'addon_count': len(addons) if isinstance(addons, list) else 0,
            'identity_provider_config_count': len(identity_provider_configs) if isinstance(identity_provider_configs, list) else 0,
            'access_entry_count': len(entries),
            'nodegroups': nodegroups if isinstance(nodegroups, list) else [],
            'fargate_profiles': fargate_profiles if isinstance(fargate_profiles, list) else [],
            'addons': addons if isinstance(addons, list) else [],
            'identity_provider_configs': identity_provider_configs if isinstance(identity_provider_configs, list) else [],
            'access_entries': entries,
            'details': response if isinstance(response, dict) and response.get('error') else None,
        }

    def nodegroup_detail(cluster_name: str, nodegroup_name: str) -> dict[str, Any]:
        response = _eks_optional(
            lambda: eks.describe_nodegroup(clusterName=cluster_name, nodegroupName=nodegroup_name),
            {'ResourceNotFoundException'},
        )
        nodegroup = response.get('nodegroup', {}) if isinstance(response, dict) and not response.get('error') else {}
        return {
            'name': nodegroup_name,
            'cluster_name': cluster_name,
            'arn': nodegroup.get('nodegroupArn'),
            'created_at': nodegroup.get('createdAt'),
            'modified_at': nodegroup.get('modifiedAt'),
            'status': nodegroup.get('status'),
            'capacity_type': nodegroup.get('capacityType'),
            'scaling_config': nodegroup.get('scalingConfig'),
            'instance_types': nodegroup.get('instanceTypes'),
            'subnets': nodegroup.get('subnets'),
            'remote_access': nodegroup.get('remoteAccess'),
            'ami_type': nodegroup.get('amiType'),
            'node_role': nodegroup.get('nodeRole'),
            'labels': nodegroup.get('labels'),
            'taints': nodegroup.get('taints'),
            'resources': nodegroup.get('resources'),
            'disk_size': nodegroup.get('diskSize'),
            'health': nodegroup.get('health'),
            'update_config': nodegroup.get('updateConfig'),
            'launch_template': nodegroup.get('launchTemplate'),
            'version': nodegroup.get('version'),
            'release_version': nodegroup.get('releaseVersion'),
            'tags': nodegroup.get('tags'),
            'details': response if isinstance(response, dict) and response.get('error') else None,
        }

    def fargate_profile_detail(cluster_name: str, profile_name: str) -> dict[str, Any]:
        response = _eks_optional(
            lambda: eks.describe_fargate_profile(clusterName=cluster_name, fargateProfileName=profile_name),
            {'ResourceNotFoundException'},
        )
        profile = response.get('fargateProfile', {}) if isinstance(response, dict) and not response.get('error') else {}
        return {
            'name': profile_name,
            'cluster_name': cluster_name,
            'arn': profile.get('fargateProfileArn'),
            'created_at': profile.get('createdAt'),
            'pod_execution_role_arn': profile.get('podExecutionRoleArn'),
            'subnets': profile.get('subnets'),
            'selectors': profile.get('selectors'),
            'status': profile.get('status'),
            'tags': profile.get('tags'),
            'health': profile.get('health'),
            'details': response if isinstance(response, dict) and response.get('error') else None,
        }

    def addon_detail(cluster_name: str, addon_name: str) -> dict[str, Any]:
        response = _eks_optional(
            lambda: eks.describe_addon(clusterName=cluster_name, addonName=addon_name),
            {'ResourceNotFoundException'},
        )
        addon = response.get('addon', {}) if isinstance(response, dict) and not response.get('error') else {}
        return {
            'name': addon_name,
            'cluster_name': cluster_name,
            'arn': addon.get('addonArn'),
            'version': addon.get('addonVersion'),
            'status': addon.get('status'),
            'service_account_role_arn': addon.get('serviceAccountRoleArn'),
            'configuration_values': addon.get('configurationValues'),
            'health': addon.get('health'),
            'created_at': addon.get('createdAt'),
            'modified_at': addon.get('modifiedAt'),
            'tags': addon.get('tags'),
            'publisher': addon.get('publisher'),
            'owner': addon.get('owner'),
            'marketplace_information': addon.get('marketplaceInformation'),
            'pod_identity_associations': addon.get('podIdentityAssociations'),
            'details': response if isinstance(response, dict) and response.get('error') else None,
        }

    def identity_provider_detail(cluster_name: str, config: dict[str, Any]) -> dict[str, Any]:
        response = _eks_optional(
            lambda: eks.describe_identity_provider_config(clusterName=cluster_name, identityProviderConfig=config),
            {'ResourceNotFoundException', 'InvalidParameterException'},
        )
        provider = response.get('identityProviderConfig', {}) if isinstance(response, dict) and not response.get('error') else {}
        oidc = provider.get('oidc') or {}
        name = config.get('name') or oidc.get('identityProviderConfigName')
        return {
            'name': name,
            'cluster_name': cluster_name,
            'type': config.get('type') or provider.get('type'),
            'status': provider.get('status'),
            'issuer_url': oidc.get('issuerUrl'),
            'client_id': oidc.get('clientId'),
            'username_claim': oidc.get('usernameClaim'),
            'username_prefix': oidc.get('usernamePrefix'),
            'groups_claim': oidc.get('groupsClaim'),
            'groups_prefix': oidc.get('groupsPrefix'),
            'required_claims': oidc.get('requiredClaims'),
            'tags': provider.get('tags'),
            'details': response if isinstance(response, dict) and response.get('error') else None,
        }

    clusters = [cluster_detail(name) for name in cluster_names]
    nodegroups = [nodegroup_detail(cluster.get('name'), name) for cluster in clusters for name in cluster.get('nodegroups', [])]
    fargate_profiles = [fargate_profile_detail(cluster.get('name'), name) for cluster in clusters for name in cluster.get('fargate_profiles', [])]
    addons = [addon_detail(cluster.get('name'), name) for cluster in clusters for name in cluster.get('addons', [])]
    identity_provider_configs = [
        identity_provider_detail(cluster.get('name'), config)
        for cluster in clusters
        for config in cluster.get('identity_provider_configs', [])
        if isinstance(config, dict)
    ]
    access_entries_flat = [entry for cluster in clusters for entry in cluster.get('access_entries', [])]

    return {
        'summary': {
            'clusters': len(clusters),
            'nodegroups': len(nodegroups),
            'fargate_profiles': len(fargate_profiles),
            'addons': len(addons),
            'identity_provider_configs': len(identity_provider_configs),
            'access_entries': len(access_entries_flat),
        },
        'clusters': clusters,
        'nodegroups': nodegroups,
        'fargate_profiles': fargate_profiles,
        'addons': addons,
        'identity_provider_configs': identity_provider_configs,
        'access_entries': access_entries_flat,
        'supported_from_sdk': [
            'CreateCluster',
            'DescribeCluster',
            'ListClusters',
            'DeleteCluster',
            'CreateNodegroup',
            'DescribeNodegroup',
            'ListNodegroups',
            'DeleteNodegroup',
            'CreateFargateProfile',
            'DescribeFargateProfile',
            'ListFargateProfiles',
            'DeleteFargateProfile',
            'CreateAddon',
            'DescribeAddon',
            'ListAddons',
            'DeleteAddon',
            'AssociateIdentityProviderConfig',
            'DescribeIdentityProviderConfig',
            'ListIdentityProviderConfigs',
            'CreateAccessEntry',
            'DescribeAccessEntry',
            'ListAccessEntries',
            'AssociateAccessPolicy',
            'ListAssociatedAccessPolicies',
        ],
        'notes': [
            'This page is inferred from the EKS AWS SDK API because service docs were not provided for this pass.',
            'Nested resources are listed from each cluster and flattened into their own panels for scanning.',
        ],
    }

def _elasticache_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (AttributeError, BotoCoreError, KeyError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def elasticache_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    elasticache = factory.client('elasticache')

    cache_clusters = _safe_value(
        lambda: _paginate(
            elasticache,
            'describe_cache_clusters',
            'CacheClusters',
            ShowCacheNodeInfo=True,
            ShowCacheClustersNotInReplicationGroups=True,
        ),
        [],
    )
    replication_groups = _safe_value(lambda: _paginate(elasticache, 'describe_replication_groups', 'ReplicationGroups'), [])
    subnet_groups = _safe_value(lambda: _paginate(elasticache, 'describe_cache_subnet_groups', 'CacheSubnetGroups'), [])
    parameter_groups = _safe_value(lambda: _paginate(elasticache, 'describe_cache_parameter_groups', 'CacheParameterGroups'), [])
    security_groups = _safe_value(lambda: _paginate(elasticache, 'describe_cache_security_groups', 'CacheSecurityGroups'), [])
    snapshots = _safe_value(lambda: _paginate(elasticache, 'describe_snapshots', 'Snapshots'), [])
    users = _safe_value(lambda: _paginate(elasticache, 'describe_users', 'Users'), [])
    user_groups = _safe_value(lambda: _paginate(elasticache, 'describe_user_groups', 'UserGroups'), [])
    serverless_caches = _safe_value(lambda: _paginate(elasticache, 'describe_serverless_caches', 'ServerlessCaches'), [])
    global_replication_groups = _safe_value(lambda: _paginate(elasticache, 'describe_global_replication_groups', 'GlobalReplicationGroups'), [])
    events = _safe_value(lambda: _paginate(elasticache, 'describe_events', 'Events', MaxRecords=50), [])

    return {
        'summary': {
            'cache_clusters': len(cache_clusters),
            'replication_groups': len(replication_groups),
            'serverless_caches': len(serverless_caches),
            'subnet_groups': len(subnet_groups),
            'parameter_groups': len(parameter_groups),
            'snapshots': len(snapshots),
            'users': len(users),
            'user_groups': len(user_groups),
            'global_replication_groups': len(global_replication_groups),
            'events': len(events),
        },
        'cache_clusters': [
            {
                'name': cluster.get('CacheClusterId'),
                'arn': cluster.get('ARN'),
                'engine': cluster.get('Engine'),
                'engine_version': cluster.get('EngineVersion'),
                'status': cluster.get('CacheClusterStatus'),
                'node_type': cluster.get('CacheNodeType'),
                'num_cache_nodes': cluster.get('NumCacheNodes'),
                'preferred_availability_zone': cluster.get('PreferredAvailabilityZone'),
                'cache_subnet_group_name': cluster.get('CacheSubnetGroupName'),
                'replication_group_id': cluster.get('ReplicationGroupId'),
                'security_groups': cluster.get('SecurityGroups'),
                'cache_security_groups': cluster.get('CacheSecurityGroups'),
                'cache_parameter_group': cluster.get('CacheParameterGroup'),
                'cache_nodes': cluster.get('CacheNodes'),
                'configuration_endpoint': cluster.get('ConfigurationEndpoint'),
                'notification_configuration': cluster.get('NotificationConfiguration'),
                'pending_modified_values': cluster.get('PendingModifiedValues'),
                'created': cluster.get('CacheClusterCreateTime'),
                'preferred_maintenance_window': cluster.get('PreferredMaintenanceWindow'),
                'auto_minor_version_upgrade': cluster.get('AutoMinorVersionUpgrade'),
                'snapshot_retention_limit': cluster.get('SnapshotRetentionLimit'),
                'snapshot_window': cluster.get('SnapshotWindow'),
                'auth_token_enabled': cluster.get('AuthTokenEnabled'),
                'transit_encryption_enabled': cluster.get('TransitEncryptionEnabled'),
                'at_rest_encryption_enabled': cluster.get('AtRestEncryptionEnabled'),
                'log_delivery_configurations': cluster.get('LogDeliveryConfigurations'),
            }
            for cluster in cache_clusters
        ],
        'replication_groups': [
            {
                'name': group.get('ReplicationGroupId'),
                'arn': group.get('ARN'),
                'description': group.get('Description'),
                'status': group.get('Status'),
                'pending_modified_values': group.get('PendingModifiedValues'),
                'member_clusters': group.get('MemberClusters'),
                'node_groups': group.get('NodeGroups'),
                'snapshotting_cluster_id': group.get('SnapshottingClusterId'),
                'automatic_failover': group.get('AutomaticFailover'),
                'multi_az': group.get('MultiAZ'),
                'configuration_endpoint': group.get('ConfigurationEndpoint'),
                'snapshot_retention_limit': group.get('SnapshotRetentionLimit'),
                'snapshot_window': group.get('SnapshotWindow'),
                'cluster_enabled': group.get('ClusterEnabled'),
                'cache_node_type': group.get('CacheNodeType'),
                'auth_token_enabled': group.get('AuthTokenEnabled'),
                'transit_encryption_enabled': group.get('TransitEncryptionEnabled'),
                'at_rest_encryption_enabled': group.get('AtRestEncryptionEnabled'),
                'kms_key_id': group.get('KmsKeyId'),
                'user_group_ids': group.get('UserGroupIds'),
                'log_delivery_configurations': group.get('LogDeliveryConfigurations'),
                'data_tiering': group.get('DataTiering'),
            }
            for group in replication_groups
        ],
        'serverless_caches': [
            {
                'name': cache.get('ServerlessCacheName'),
                'arn': cache.get('ARN'),
                'engine': cache.get('Engine'),
                'major_engine_version': cache.get('MajorEngineVersion'),
                'full_engine_version': cache.get('FullEngineVersion'),
                'status': cache.get('Status'),
                'endpoint': cache.get('Endpoint'),
                'reader_endpoint': cache.get('ReaderEndpoint'),
                'description': cache.get('Description'),
                'cache_usage_limits': cache.get('CacheUsageLimits'),
                'kms_key_id': cache.get('KmsKeyId'),
                'security_group_ids': cache.get('SecurityGroupIds'),
                'subnet_ids': cache.get('SubnetIds'),
                'user_group_id': cache.get('UserGroupId'),
                'created': cache.get('CreateTime'),
                'snapshot_retention_limit': cache.get('SnapshotRetentionLimit'),
                'daily_snapshot_time': cache.get('DailySnapshotTime'),
            }
            for cache in serverless_caches
        ],
        'subnet_groups': subnet_groups,
        'parameter_groups': parameter_groups,
        'security_groups': security_groups,
        'snapshots': snapshots,
        'users': users,
        'user_groups': user_groups,
        'global_replication_groups': global_replication_groups,
        'events': events,
        'supported_from_sdk': [
            'CreateCacheCluster',
            'DescribeCacheClusters',
            'ModifyCacheCluster',
            'DeleteCacheCluster',
            'CreateReplicationGroup',
            'DescribeReplicationGroups',
            'ModifyReplicationGroup',
            'DeleteReplicationGroup',
            'CreateServerlessCache',
            'DescribeServerlessCaches',
            'ModifyServerlessCache',
            'DeleteServerlessCache',
            'CreateCacheSubnetGroup',
            'DescribeCacheSubnetGroups',
            'CreateCacheParameterGroup',
            'DescribeCacheParameterGroups',
            'CreateUser',
            'DescribeUsers',
            'CreateUserGroup',
            'DescribeUserGroups',
            'CreateSnapshot',
            'DescribeSnapshots',
            'DescribeEvents',
        ],
        'notes': [
            'This page is inferred from the ElastiCache AWS SDK API because service docs were not provided for this pass.',
            'Cluster and replication-group detail is normalized; lower-volume supporting resources are shown as cleaned AWS responses.',
        ],
    }


def _ecs_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (AttributeError, BotoCoreError, KeyError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}

def _elasticloadbalancing_tags(elbv2, arns: list[str]) -> dict[str, Any]:
    tags: dict[str, Any] = {}
    for chunk in _chunks([arn for arn in arns if arn], 20):
        response = _safe_value(lambda chunk=chunk: elbv2.describe_tags(ResourceArns=chunk).get('TagDescriptions', []), [])
        for description in response:
            tags[description.get('ResourceArn')] = description.get('Tags', [])
    return tags


def _classic_elb_tags(elb, names: list[str]) -> dict[str, Any]:
    tags: dict[str, Any] = {}
    for chunk in _chunks([name for name in names if name], 20):
        response = _safe_value(lambda chunk=chunk: elb.describe_tags(LoadBalancerNames=chunk).get('TagDescriptions', []), [])
        for description in response:
            tags[description.get('LoadBalancerName')] = description.get('Tags', [])
    return tags


def elasticloadbalancing_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    elbv2 = factory.client('elbv2')
    elb = factory.client('elb')

    v2_load_balancers = _safe_value(lambda: _paginate(elbv2, 'describe_load_balancers', 'LoadBalancers'), [])
    v2_target_groups = _safe_value(lambda: _paginate(elbv2, 'describe_target_groups', 'TargetGroups'), [])
    classic_load_balancers = _safe_value(lambda: _paginate(elb, 'describe_load_balancers', 'LoadBalancerDescriptions'), [])
    classic_policy_types = _safe_value(lambda: elb.describe_load_balancer_policy_types().get('PolicyTypeDescriptions', []), [])

    v2_tags = _elasticloadbalancing_tags(elbv2, [lb.get('LoadBalancerArn') for lb in v2_load_balancers])
    target_group_tags = _elasticloadbalancing_tags(elbv2, [group.get('TargetGroupArn') for group in v2_target_groups])
    classic_tags = _classic_elb_tags(elb, [lb.get('LoadBalancerName') for lb in classic_load_balancers])

    listeners: list[dict[str, Any]] = []
    rules: list[dict[str, Any]] = []
    for load_balancer in v2_load_balancers:
        lb_arn = load_balancer.get('LoadBalancerArn')
        lb_listeners = _safe_value(lambda lb_arn=lb_arn: _paginate(elbv2, 'describe_listeners', 'Listeners', LoadBalancerArn=lb_arn), [])
        for listener in lb_listeners:
            listener['LoadBalancerName'] = load_balancer.get('LoadBalancerName')
            listeners.append(listener)
            listener_arn = listener.get('ListenerArn')
            listener_rules = _safe_value(lambda listener_arn=listener_arn: _paginate(elbv2, 'describe_rules', 'Rules', ListenerArn=listener_arn), [])
            for rule in listener_rules:
                rule['LoadBalancerName'] = load_balancer.get('LoadBalancerName')
                rule['ListenerArn'] = listener_arn
                rules.append(rule)

    target_health = []
    for target_group in v2_target_groups:
        arn = target_group.get('TargetGroupArn')
        response = _safe_value(lambda arn=arn: elbv2.describe_target_health(TargetGroupArn=arn).get('TargetHealthDescriptions', []), [])
        target_health.append({
            'name': target_group.get('TargetGroupName'),
            'target_group_arn': arn,
            'target_health_descriptions': response,
        })

    classic_instance_health = []
    classic_policies = []
    for load_balancer in classic_load_balancers:
        name = load_balancer.get('LoadBalancerName')
        classic_instance_health.append({
            'name': name,
            'instance_states': _safe_value(lambda name=name: elb.describe_instance_health(LoadBalancerName=name).get('InstanceStates', []), []),
        })
        classic_policies.append({
            'name': name,
            'policies': _safe_value(lambda name=name: elb.describe_load_balancer_policies(LoadBalancerName=name).get('PolicyDescriptions', []), []),
        })

    return {
        'summary': {
            'v2_load_balancers': len(v2_load_balancers),
            'classic_load_balancers': len(classic_load_balancers),
            'listeners': len(listeners),
            'rules': len(rules),
            'target_groups': len(v2_target_groups),
            'target_health_sets': len(target_health),
            'classic_policy_types': len(classic_policy_types),
        },
        'v2_load_balancers': [
            {
                'name': lb.get('LoadBalancerName'),
                'arn': lb.get('LoadBalancerArn'),
                'dns_name': lb.get('DNSName'),
                'canonical_hosted_zone_id': lb.get('CanonicalHostedZoneId'),
                'created': lb.get('CreatedTime'),
                'scheme': lb.get('Scheme'),
                'vpc_id': lb.get('VpcId'),
                'state': lb.get('State'),
                'type': lb.get('Type'),
                'availability_zones': lb.get('AvailabilityZones'),
                'security_groups': lb.get('SecurityGroups'),
                'ip_address_type': lb.get('IpAddressType'),
                'customer_owned_ipv4_pool': lb.get('CustomerOwnedIpv4Pool'),
                'enforce_security_group_inbound_rules_on_private_link_traffic': lb.get('EnforceSecurityGroupInboundRulesOnPrivateLinkTraffic'),
                'attributes': _safe_value(lambda arn=lb.get('LoadBalancerArn'): elbv2.describe_load_balancer_attributes(LoadBalancerArn=arn).get('Attributes', []), []),
                'tags': v2_tags.get(lb.get('LoadBalancerArn'), []),
            }
            for lb in v2_load_balancers
        ],
        'listeners': [
            {
                'name': listener.get('ListenerArn'),
                'load_balancer_name': listener.get('LoadBalancerName'),
                'arn': listener.get('ListenerArn'),
                'port': listener.get('Port'),
                'protocol': listener.get('Protocol'),
                'certificates': listener.get('Certificates'),
                'ssl_policy': listener.get('SslPolicy'),
                'default_actions': listener.get('DefaultActions'),
                'alpn_policy': listener.get('AlpnPolicy'),
                'mutual_authentication': listener.get('MutualAuthentication'),
            }
            for listener in listeners
        ],
        'rules': [
            {
                'name': rule.get('RuleArn'),
                'load_balancer_name': rule.get('LoadBalancerName'),
                'listener_arn': rule.get('ListenerArn'),
                'arn': rule.get('RuleArn'),
                'priority': rule.get('Priority'),
                'conditions': rule.get('Conditions'),
                'actions': rule.get('Actions'),
                'is_default': rule.get('IsDefault'),
            }
            for rule in rules
        ],
        'target_groups': [
            {
                'name': group.get('TargetGroupName'),
                'arn': group.get('TargetGroupArn'),
                'protocol': group.get('Protocol'),
                'port': group.get('Port'),
                'vpc_id': group.get('VpcId'),
                'health_check_protocol': group.get('HealthCheckProtocol'),
                'health_check_port': group.get('HealthCheckPort'),
                'health_check_enabled': group.get('HealthCheckEnabled'),
                'health_check_interval_seconds': group.get('HealthCheckIntervalSeconds'),
                'health_check_timeout_seconds': group.get('HealthCheckTimeoutSeconds'),
                'healthy_threshold_count': group.get('HealthyThresholdCount'),
                'unhealthy_threshold_count': group.get('UnhealthyThresholdCount'),
                'health_check_path': group.get('HealthCheckPath'),
                'matcher': group.get('Matcher'),
                'load_balancer_arns': group.get('LoadBalancerArns'),
                'target_type': group.get('TargetType'),
                'protocol_version': group.get('ProtocolVersion'),
                'ip_address_type': group.get('IpAddressType'),
                'tags': target_group_tags.get(group.get('TargetGroupArn'), []),
            }
            for group in v2_target_groups
        ],
        'target_health': target_health,
        'classic_load_balancers': [
            {
                'name': lb.get('LoadBalancerName'),
                'dns_name': lb.get('DNSName'),
                'canonical_hosted_zone_name': lb.get('CanonicalHostedZoneName'),
                'canonical_hosted_zone_name_id': lb.get('CanonicalHostedZoneNameID'),
                'listener_descriptions': lb.get('ListenerDescriptions'),
                'policies': lb.get('Policies'),
                'backend_server_descriptions': lb.get('BackendServerDescriptions'),
                'availability_zones': lb.get('AvailabilityZones'),
                'subnets': lb.get('Subnets'),
                'vpc_id': lb.get('VPCId'),
                'instances': lb.get('Instances'),
                'health_check': lb.get('HealthCheck'),
                'source_security_group': lb.get('SourceSecurityGroup'),
                'security_groups': lb.get('SecurityGroups'),
                'created': lb.get('CreatedTime'),
                'scheme': lb.get('Scheme'),
                'attributes': _safe_value(lambda name=lb.get('LoadBalancerName'): elb.describe_load_balancer_attributes(LoadBalancerName=name).get('LoadBalancerAttributes', {}), {}),
                'tags': classic_tags.get(lb.get('LoadBalancerName'), []),
            }
            for lb in classic_load_balancers
        ],
        'classic_instance_health': classic_instance_health,
        'classic_policies': classic_policies,
        'classic_policy_types': classic_policy_types,
        'supported_from_sdk': [
            'CreateLoadBalancer',
            'DescribeLoadBalancers',
            'DeleteLoadBalancer',
            'CreateListener',
            'DescribeListeners',
            'CreateRule',
            'DescribeRules',
            'CreateTargetGroup',
            'DescribeTargetGroups',
            'RegisterTargets',
            'DescribeTargetHealth',
            'DeregisterTargets',
            'AddTags',
            'DescribeTags',
            'RemoveTags',
            'CreateLoadBalancerListeners',
            'DescribeInstanceHealth',
            'CreateLoadBalancerPolicy',
            'DescribeLoadBalancerPolicies',
        ],
        'notes': [
            'This page combines the AWS elbv2 and classic elb SDK APIs under the Elastic Load Balancing service name.',
            'Target health is fetched per target group; listener rules are fetched per listener.',
        ],
    }

def firehose_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    firehose = factory.client('firehose')
    stream_names = _safe_value(lambda: _paginate(firehose, 'list_delivery_streams', 'DeliveryStreamNames'), [])

    def stream_tags(name: str) -> list[dict[str, Any]]:
        tags: list[dict[str, Any]] = []
        exclusive_start_key = None

        while True:
            kwargs = {'DeliveryStreamName': name, 'Limit': 50}
            if exclusive_start_key:
                kwargs['ExclusiveStartTagKey'] = exclusive_start_key
            response = _safe_value(lambda kwargs=kwargs: firehose.list_tags_for_delivery_stream(**kwargs), {})
            tags.extend(response.get('Tags', []) if isinstance(response, dict) else [])
            if not isinstance(response, dict) or not response.get('HasMoreTags') or not response.get('Tags'):
                break
            exclusive_start_key = response.get('Tags', [])[-1].get('Key')

        return tags

    def stream_detail(name: str) -> dict[str, Any]:
        response = _safe_value(
            lambda: firehose.describe_delivery_stream(DeliveryStreamName=name).get('DeliveryStreamDescription', {}),
            {},
        )
        destinations = response.get('Destinations', []) if isinstance(response, dict) else []

        return {
            'name': name,
            'arn': response.get('DeliveryStreamARN'),
            'status': response.get('DeliveryStreamStatus'),
            'type': response.get('DeliveryStreamType'),
            'version_id': response.get('VersionId'),
            'created': response.get('CreateTimestamp'),
            'updated': response.get('LastUpdateTimestamp'),
            'source': response.get('Source'),
            'delivery_stream_encryption_configuration': response.get('DeliveryStreamEncryptionConfiguration'),
            'failure_description': response.get('FailureDescription'),
            'has_more_destinations': response.get('HasMoreDestinations'),
            'destination_count': len(destinations),
            'destinations': destinations,
            'tags': stream_tags(name),
        }

    streams = [stream_detail(name) for name in stream_names]
    destinations = [
        {
            'name': destination.get('DestinationId'),
            'delivery_stream_name': stream.get('name'),
            'destination_id': destination.get('DestinationId'),
            's3_destination_description': destination.get('S3DestinationDescription'),
            'extended_s3_destination_description': destination.get('ExtendedS3DestinationDescription'),
            'redshift_destination_description': destination.get('RedshiftDestinationDescription'),
            'elasticsearch_destination_description': destination.get('ElasticsearchDestinationDescription'),
            'amazonopensearchservice_destination_description': destination.get('AmazonopensearchserviceDestinationDescription'),
            'splunk_destination_description': destination.get('SplunkDestinationDescription'),
            'http_endpoint_destination_description': destination.get('HttpEndpointDestinationDescription'),
            'snowflake_destination_description': destination.get('SnowflakeDestinationDescription'),
            'iceberg_destination_description': destination.get('IcebergDestinationDescription'),
        }
        for stream in streams
        for destination in stream.get('destinations', [])
    ]

    return {
        'summary': {
            'delivery_streams': len(streams),
            'active_streams': sum(1 for stream in streams if stream.get('status') == 'ACTIVE'),
            'destinations': len(destinations),
            'tagged_streams': sum(1 for stream in streams if stream.get('tags')),
        },
        'delivery_streams': streams,
        'destinations': destinations,
        'supported_from_sdk': [
            'CreateDeliveryStream',
            'DescribeDeliveryStream',
            'ListDeliveryStreams',
            'DeleteDeliveryStream',
            'PutRecord',
            'PutRecordBatch',
            'UpdateDestination',
            'StartDeliveryStreamEncryption',
            'StopDeliveryStreamEncryption',
            'TagDeliveryStream',
            'UntagDeliveryStream',
            'ListTagsForDeliveryStream',
        ],
        'notes': [
            'This page is inferred from the Firehose AWS SDK API because service docs were not provided for this pass.',
            'Destinations are flattened from each delivery stream so S3, OpenSearch, HTTP, Splunk, Redshift, Snowflake, and Iceberg configs can be scanned together.',
        ],
    }

def kinesis_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    kinesis = factory.client('kinesis')
    stream_names = _safe_value(lambda: _paginate(kinesis, 'list_streams', 'StreamNames'), [])
    account_settings = _safe_value(lambda: kinesis.describe_account_settings(), {})
    limits = _safe_value(lambda: kinesis.describe_limits(), {})

    def stream_tags(name: str) -> list[dict[str, Any]]:
        tags: list[dict[str, Any]] = []
        exclusive_start_key = None

        while True:
            kwargs = {'StreamName': name, 'Limit': 50}
            if exclusive_start_key:
                kwargs['ExclusiveStartTagKey'] = exclusive_start_key
            response = _safe_value(lambda kwargs=kwargs: kinesis.list_tags_for_stream(**kwargs), {})
            tags.extend(response.get('Tags', []) if isinstance(response, dict) else [])
            if not isinstance(response, dict) or not response.get('HasMoreTags') or not response.get('Tags'):
                break
            exclusive_start_key = response.get('Tags', [])[-1].get('Key')

        return tags

    def consumer_detail(stream_arn: str, consumer: dict[str, Any]) -> dict[str, Any]:
        consumer_arn = consumer.get('ConsumerARN')
        detail = _safe_value(
            lambda: kinesis.describe_stream_consumer(StreamARN=stream_arn, ConsumerARN=consumer_arn).get('ConsumerDescription', {}),
            {},
        )
        return {
            'name': consumer.get('ConsumerName') or detail.get('ConsumerName'),
            'stream_arn': stream_arn,
            'consumer_arn': consumer_arn or detail.get('ConsumerARN'),
            'status': consumer.get('ConsumerStatus') or detail.get('ConsumerStatus'),
            'creation_timestamp': consumer.get('ConsumerCreationTimestamp') or detail.get('ConsumerCreationTimestamp'),
        }

    def stream_detail(name: str) -> dict[str, Any]:
        summary = _safe_value(
            lambda: kinesis.describe_stream_summary(StreamName=name).get('StreamDescriptionSummary', {}),
            {},
        )
        description = _safe_value(
            lambda: kinesis.describe_stream(StreamName=name).get('StreamDescription', {}),
            {},
        )
        stream_arn = summary.get('StreamARN') or description.get('StreamARN')
        shards = _safe_value(lambda: _paginate(kinesis, 'list_shards', 'Shards', StreamName=name), description.get('Shards', []))
        consumers = _safe_value(lambda: _paginate(kinesis, 'list_stream_consumers', 'Consumers', StreamARN=stream_arn), []) if stream_arn else []
        consumer_details = [consumer_detail(stream_arn, consumer) for consumer in consumers] if stream_arn else []

        return {
            'name': name,
            'arn': stream_arn,
            'status': summary.get('StreamStatus') or description.get('StreamStatus'),
            'mode': summary.get('StreamModeDetails') or description.get('StreamModeDetails'),
            'retention_period_hours': summary.get('RetentionPeriodHours') or description.get('RetentionPeriodHours'),
            'created': summary.get('StreamCreationTimestamp') or description.get('StreamCreationTimestamp'),
            'enhanced_monitoring': summary.get('EnhancedMonitoring') or description.get('EnhancedMonitoring'),
            'encryption_type': summary.get('EncryptionType') or description.get('EncryptionType'),
            'key_id': summary.get('KeyId') or description.get('KeyId'),
            'open_shard_count': summary.get('OpenShardCount'),
            'consumer_count': summary.get('ConsumerCount') or len(consumer_details),
            'shard_count': len(shards),
            'shards': shards,
            'consumers': consumer_details,
            'tags': stream_tags(name),
        }

    streams = [stream_detail(name) for name in stream_names]
    shards = [
        {
            'name': shard.get('ShardId'),
            'stream_name': stream.get('name'),
            'shard_id': shard.get('ShardId'),
            'parent_shard_id': shard.get('ParentShardId'),
            'adjacent_parent_shard_id': shard.get('AdjacentParentShardId'),
            'hash_key_range': shard.get('HashKeyRange'),
            'sequence_number_range': shard.get('SequenceNumberRange'),
        }
        for stream in streams
        for shard in stream.get('shards', [])
    ]
    consumers = [
        consumer
        for stream in streams
        for consumer in stream.get('consumers', [])
    ]

    return {
        'summary': {
            'streams': len(streams),
            'active_streams': sum(1 for stream in streams if stream.get('status') == 'ACTIVE'),
            'shards': len(shards),
            'consumers': len(consumers),
            'tagged_streams': sum(1 for stream in streams if stream.get('tags')),
        },
        'streams': streams,
        'shards': shards,
        'consumers': consumers,
        'account_settings': account_settings,
        'limits': limits,
        'supported_from_sdk': [
            'CreateStream',
            'DescribeStream',
            'DescribeStreamSummary',
            'ListStreams',
            'DeleteStream',
            'ListShards',
            'PutRecord',
            'PutRecords',
            'GetShardIterator',
            'GetRecords',
            'RegisterStreamConsumer',
            'ListStreamConsumers',
            'DescribeStreamConsumer',
            'DeregisterStreamConsumer',
            'AddTagsToStream',
            'ListTagsForStream',
            'RemoveTagsFromStream',
            'EnableEnhancedMonitoring',
            'DisableEnhancedMonitoring',
            'StartStreamEncryption',
            'StopStreamEncryption',
            'UpdateShardCount',
            'UpdateStreamMode',
        ],
        'notes': [
            'This page is inferred from the Kinesis AWS SDK API because service docs were not provided for this pass.',
            'Shard and consumer details are flattened from each stream for scanning.',
        ],
    }

def kafka_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    kafka = factory.client('kafka')
    cluster_v1_summaries = _safe_value(lambda: _paginate(kafka, 'list_clusters', 'ClusterInfoList'), [])
    cluster_v2_summaries = _safe_value(lambda: _paginate(kafka, 'list_clusters_v2', 'ClusterInfoList'), [])
    configurations = _safe_value(lambda: _paginate(kafka, 'list_configurations', 'Configurations'), [])
    kafka_versions = _safe_value(lambda: _paginate(kafka, 'list_kafka_versions', 'KafkaVersions'), [])

    def cluster_arn(summary: dict[str, Any]) -> Optional[str]:
        return summary.get('ClusterArn') or summary.get('Provisioned', {}).get('ClusterArn') or summary.get('Serverless', {}).get('ClusterArn')

    def cluster_name(summary: dict[str, Any]) -> Optional[str]:
        return summary.get('ClusterName') or summary.get('Provisioned', {}).get('ClusterName') or summary.get('Serverless', {}).get('ClusterName')

    def cluster_detail(summary: dict[str, Any]) -> dict[str, Any]:
        arn = cluster_arn(summary)
        detail = _safe_value(lambda arn=arn: kafka.describe_cluster_v2(ClusterArn=arn).get('ClusterInfo', {}), {}) if arn else {}
        if not detail and arn:
            detail = _safe_value(lambda arn=arn: kafka.describe_cluster(ClusterArn=arn).get('ClusterInfo', {}), {})
        provisioned = detail.get('Provisioned') or summary.get('Provisioned') or {}
        serverless = detail.get('Serverless') or summary.get('Serverless') or {}
        effective = provisioned or serverless or detail or summary
        nodes = _safe_value(lambda arn=arn: _paginate(kafka, 'list_nodes', 'NodeInfoList', ClusterArn=arn), []) if arn else []
        operations = _safe_value(lambda arn=arn: _paginate(kafka, 'list_cluster_operations', 'ClusterOperationInfoList', ClusterArn=arn), []) if arn else []
        scram_secrets = _safe_value(lambda arn=arn: _paginate(kafka, 'list_scram_secrets', 'SecretArnList', ClusterArn=arn), []) if arn else []
        vpc_connections = _safe_value(lambda arn=arn: _paginate(kafka, 'list_client_vpc_connections', 'ClientVpcConnections', ClusterArn=arn), []) if arn else []
        bootstrap_brokers = _safe_value(lambda arn=arn: kafka.get_bootstrap_brokers(ClusterArn=arn), {}) if arn else {}
        tags = _safe_value(lambda arn=arn: kafka.list_tags_for_resource(ResourceArn=arn).get('Tags', {}), {}) if arn else {}

        return {
            'name': cluster_name(summary) or effective.get('ClusterName') or arn,
            'arn': arn,
            'type': detail.get('ClusterType') or summary.get('ClusterType') or ('SERVERLESS' if serverless else 'PROVISIONED'),
            'state': detail.get('State') or summary.get('State') or effective.get('State'),
            'created': detail.get('CreationTime') or summary.get('CreationTime') or effective.get('CreationTime'),
            'current_version': detail.get('CurrentVersion') or effective.get('CurrentVersion'),
            'kafka_version': effective.get('CurrentBrokerSoftwareInfo', {}).get('KafkaVersion') or effective.get('KafkaVersion'),
            'number_of_broker_nodes': effective.get('NumberOfBrokerNodes'),
            'broker_node_group_info': effective.get('BrokerNodeGroupInfo'),
            'serverless': serverless,
            'provisioned': provisioned,
            'encryption_info': effective.get('EncryptionInfo'),
            'client_authentication': effective.get('ClientAuthentication'),
            'logging_info': effective.get('LoggingInfo'),
            'open_monitoring': effective.get('OpenMonitoring'),
            'storage_mode': effective.get('StorageMode'),
            'connectivity_info': effective.get('ConnectivityInfo'),
            'bootstrap_brokers': bootstrap_brokers,
            'node_count': len(nodes),
            'operation_count': len(operations),
            'scram_secret_count': len(scram_secrets),
            'vpc_connection_count': len(vpc_connections),
            'nodes': nodes,
            'operations': operations,
            'scram_secrets': scram_secrets,
            'client_vpc_connections': vpc_connections,
            'tags': tags,
        }

    clusters_by_arn: dict[str, dict[str, Any]] = {}
    for summary in [*cluster_v1_summaries, *cluster_v2_summaries]:
        arn = cluster_arn(summary) or cluster_name(summary) or str(len(clusters_by_arn))
        clusters_by_arn.setdefault(arn, summary)

    clusters = [cluster_detail(summary) for summary in clusters_by_arn.values()]
    nodes = [
        {
            'name': node.get('BrokerNodeInfo', {}).get('BrokerId') or node.get('NodeARN'),
            'cluster_name': cluster.get('name'),
            'node_arn': node.get('NodeARN'),
            'node_type': node.get('NodeType'),
            'broker_node_info': node.get('BrokerNodeInfo'),
            'zookeeper_node_info': node.get('ZookeeperNodeInfo'),
        }
        for cluster in clusters
        for node in cluster.get('nodes', [])
    ]
    operations = [
        {
            'name': operation.get('ClusterOperationArn'),
            'cluster_name': cluster.get('name'),
            'operation_arn': operation.get('ClusterOperationArn'),
            'operation_type': operation.get('OperationType'),
            'operation_state': operation.get('OperationState'),
            'creation_time': operation.get('CreationTime'),
            'end_time': operation.get('EndTime'),
            'source_cluster_info': operation.get('SourceClusterInfo'),
            'target_cluster_info': operation.get('TargetClusterInfo'),
        }
        for cluster in clusters
        for operation in cluster.get('operations', [])
    ]
    configuration_details = [
        {
            'name': configuration.get('Name'),
            'arn': configuration.get('Arn'),
            'description': configuration.get('Description'),
            'kafka_versions': configuration.get('KafkaVersions'),
            'latest_revision': configuration.get('LatestRevision'),
            'state': configuration.get('State'),
            'created': configuration.get('CreationTime'),
        }
        for configuration in configurations
    ]

    return {
        'summary': {
            'clusters': len(clusters),
            'nodes': len(nodes),
            'operations': len(operations),
            'configurations': len(configuration_details),
            'kafka_versions': len(kafka_versions),
            'scram_secrets': sum(cluster.get('scram_secret_count') or 0 for cluster in clusters),
            'client_vpc_connections': sum(cluster.get('vpc_connection_count') or 0 for cluster in clusters),
        },
        'clusters': clusters,
        'nodes': nodes,
        'operations': operations,
        'configurations': configuration_details,
        'kafka_versions': kafka_versions,
        'supported_from_sdk': [
            'CreateCluster',
            'CreateClusterV2',
            'DescribeCluster',
            'DescribeClusterV2',
            'ListClusters',
            'ListClustersV2',
            'DeleteCluster',
            'GetBootstrapBrokers',
            'ListNodes',
            'CreateConfiguration',
            'DescribeConfiguration',
            'ListConfigurations',
            'ListClusterOperations',
            'ListScramSecrets',
            'ListKafkaVersions',
            'ListClientVpcConnections',
            'TagResource',
            'UntagResource',
        ],
        'notes': [
            'This page is inferred from the MSK/Kafka AWS SDK API because service docs were not provided for this pass.',
            'Cluster summaries from ListClusters and ListClustersV2 are merged by ARN before detail lookup.',
        ],
    }


def opensearch_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    opensearch = factory.client('opensearch')

    operations = set(opensearch.meta.service_model.operation_names)

    def call_if_supported(operation_name: str, result_key: str, **kwargs) -> Any:
        if operation_name not in operations:
            return []

        operation = getattr(opensearch, xform_name(operation_name))
        return _safe_value(lambda: _clean_response(operation(**kwargs)).get(result_key, []), [])

    def paginate_if_supported(operation_name: str, result_key: str, **kwargs) -> list[Any]:
        if operation_name not in operations:
            return []

        return _safe_value(lambda: _paginate(opensearch, xform_name(operation_name), result_key, **kwargs), [])

    domain_names = call_if_supported('ListDomainNames', 'DomainNames')
    names = [domain.get('DomainName') for domain in domain_names if domain.get('DomainName')]
    domain_statuses: list[dict[str, Any]] = []
    for chunk in _chunks(names, 5):
        domain_statuses.extend(
            _safe_value(lambda chunk=chunk: opensearch.describe_domains(DomainNames=chunk).get('DomainStatusList', []), [])
        )

    def domain_detail(status: dict[str, Any]) -> dict[str, Any]:
        name = status.get('DomainName')
        arn = status.get('ARN') or status.get('DomainArn')
        config = _safe_value(lambda name=name: _clean_response(opensearch.describe_domain_config(DomainName=name).get('DomainConfig', {})), {}) if name else {}
        health = _safe_value(lambda name=name: _clean_response(opensearch.describe_domain_health(DomainName=name)), {}) if name else {}
        nodes = _safe_value(lambda name=name: _clean_response(opensearch.describe_domain_nodes(DomainName=name).get('DomainNodesStatusList', [])), []) if name else []
        packages = paginate_if_supported('ListPackagesForDomain', 'DomainPackageDetailsList', DomainName=name) if name else []
        maintenances = paginate_if_supported('ListDomainMaintenances', 'DomainMaintenances', DomainName=name) if name else []
        scheduled_actions = paginate_if_supported('ListScheduledActions', 'ScheduledActions', DomainName=name) if name else []
        endpoint_access = paginate_if_supported('ListVpcEndpointAccess', 'AuthorizedPrincipalList', DomainName=name) if name else []
        data_sources = call_if_supported('ListDataSources', 'DataSources', DomainName=name) if name else []
        tags = _safe_value(lambda arn=arn: opensearch.list_tags(ARN=arn).get('TagList', []), []) if arn else []

        return {
            'name': name,
            'arn': arn,
            'engine_version': status.get('EngineVersion') or status.get('ElasticsearchVersion'),
            'created': status.get('Created'),
            'deleted': status.get('Deleted'),
            'processing': status.get('Processing'),
            'upgrade_processing': status.get('UpgradeProcessing'),
            'endpoint': status.get('Endpoint'),
            'endpoints': status.get('Endpoints'),
            'cluster_config': status.get('ClusterConfig'),
            'ebs_options': status.get('EBSOptions'),
            'vpc_options': status.get('VPCOptions'),
            'endpoint_options': status.get('DomainEndpointOptions'),
            'advanced_security_options': status.get('AdvancedSecurityOptions'),
            'encryption_at_rest_options': status.get('EncryptionAtRestOptions'),
            'node_to_node_encryption_options': status.get('NodeToNodeEncryptionOptions'),
            'service_software_options': status.get('ServiceSoftwareOptions'),
            'health': health,
            'config': config,
            'nodes': nodes,
            'package_count': len(packages),
            'maintenance_count': len(maintenances),
            'scheduled_action_count': len(scheduled_actions),
            'vpc_endpoint_principal_count': len(endpoint_access),
            'data_source_count': len(data_sources),
            'packages': packages,
            'maintenance': maintenances,
            'scheduled_actions': scheduled_actions,
            'vpc_endpoint_access': endpoint_access,
            'data_sources': data_sources,
            'tags': tags,
        }

    domains = [domain_detail(status) for status in domain_statuses]
    packages = paginate_if_supported('DescribePackages', 'PackageDetailsList')
    versions = paginate_if_supported('ListVersions', 'Versions')
    vpc_endpoint_summaries = paginate_if_supported('ListVpcEndpoints', 'VpcEndpointSummaryList')
    vpc_endpoint_ids = [endpoint.get('VpcEndpointId') for endpoint in vpc_endpoint_summaries if endpoint.get('VpcEndpointId')]
    vpc_endpoints: list[dict[str, Any]] = []
    for chunk in _chunks(vpc_endpoint_ids, 25):
        vpc_endpoints.extend(
            _safe_value(lambda chunk=chunk: _clean_response(opensearch.describe_vpc_endpoints(VpcEndpointIds=chunk).get('VpcEndpoints', [])), [])
        )
    if not vpc_endpoints:
        vpc_endpoints = vpc_endpoint_summaries

    inbound_connections = paginate_if_supported('DescribeInboundConnections', 'Connections')
    outbound_connections = paginate_if_supported('DescribeOutboundConnections', 'Connections')
    applications = call_if_supported('ListApplications', 'ApplicationSummaries')
    direct_query_data_sources = paginate_if_supported('ListDirectQueryDataSources', 'DirectQueryDataSources')
    nodes = [
        {
            'name': node.get('NodeId') or node.get('NodeName'),
            'domain_name': domain.get('name'),
            'node_id': node.get('NodeId'),
            'availability_zone': node.get('AvailabilityZone'),
            'instance_type': node.get('InstanceType'),
            'node_status': node.get('NodeStatus'),
            'storage_type': node.get('StorageType'),
            'storage_volume_type': node.get('StorageVolumeType'),
            'node_options': node,
        }
        for domain in domains
        for node in domain.get('nodes', [])
    ]

    return {
        'summary': {
            'domains': len(domains),
            'nodes': len(nodes),
            'packages': len(packages),
            'versions': len(versions),
            'vpc_endpoints': len(vpc_endpoints),
            'inbound_connections': len(inbound_connections),
            'outbound_connections': len(outbound_connections),
            'applications': len(applications),
            'direct_query_data_sources': len(direct_query_data_sources),
        },
        'domains': domains,
        'nodes': nodes,
        'packages': packages,
        'versions': versions,
        'vpc_endpoints': vpc_endpoints,
        'inbound_connections': inbound_connections,
        'outbound_connections': outbound_connections,
        'applications': applications,
        'direct_query_data_sources': direct_query_data_sources,
        'supported_from_sdk': [
            'CreateDomain',
            'DescribeDomain',
            'DescribeDomains',
            'DescribeDomainConfig',
            'DescribeDomainHealth',
            'DescribeDomainNodes',
            'ListDomainNames',
            'DeleteDomain',
            'CreatePackage',
            'DescribePackages',
            'ListPackagesForDomain',
            'AssociatePackage',
            'CreateVpcEndpoint',
            'ListVpcEndpoints',
            'DescribeVpcEndpoints',
            'CreateOutboundConnection',
            'DescribeInboundConnections',
            'DescribeOutboundConnections',
            'ListVersions',
            'ListTags',
        ],
        'notes': [
            'This page is inferred from the OpenSearch AWS SDK API because service docs were not provided for this pass.',
            'OpenSearch is also wired from the es service alias when it appears on the homepage.',
        ],
    }


def pipes_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    pipes = factory.client('pipes')
    summaries = _safe_value(lambda: _paginate(pipes, 'list_pipes', 'Pipes'), [])

    def pipe_detail(summary: dict[str, Any]) -> dict[str, Any]:
        name = summary.get('Name')
        detail = _safe_value(lambda name=name: _clean_response(pipes.describe_pipe(Name=name)), {}) if name else {}
        arn = detail.get('Arn') or summary.get('Arn')
        tags = detail.get('Tags')
        if tags is None and arn:
            tags = _safe_value(lambda arn=arn: pipes.list_tags_for_resource(resourceArn=arn).get('tags', {}), {})

        return {
            'name': name,
            'arn': arn,
            'description': detail.get('Description') or summary.get('Description'),
            'desired_state': detail.get('DesiredState') or summary.get('DesiredState'),
            'current_state': detail.get('CurrentState') or summary.get('CurrentState'),
            'state_reason': detail.get('StateReason') or summary.get('StateReason'),
            'source': detail.get('Source') or summary.get('Source'),
            'source_parameters': detail.get('SourceParameters'),
            'enrichment': detail.get('Enrichment'),
            'enrichment_parameters': detail.get('EnrichmentParameters'),
            'target': detail.get('Target') or summary.get('Target'),
            'target_parameters': detail.get('TargetParameters'),
            'role_arn': detail.get('RoleArn'),
            'log_configuration': detail.get('LogConfiguration'),
            'kms_key_identifier': detail.get('KmsKeyIdentifier'),
            'created': detail.get('CreationTime') or summary.get('CreationTime'),
            'last_modified': detail.get('LastModifiedTime') or summary.get('LastModifiedTime'),
            'tags': tags or {},
        }

    pipe_details = [pipe_detail(summary) for summary in summaries]
    states: dict[str, int] = {}
    for pipe in pipe_details:
        state = pipe.get('current_state') or 'UNKNOWN'
        states[state] = states.get(state, 0) + 1

    return {
        'summary': {
            'pipes': len(pipe_details),
            'running': states.get('RUNNING', 0),
            'stopped': states.get('STOPPED', 0),
            'creating': states.get('CREATING', 0),
            'deleting': states.get('DELETING', 0),
        },
        'pipes': pipe_details,
        'states': [{'name': state, 'state': state, 'count': count} for state, count in sorted(states.items())],
        'supported_from_sdk': [
            'CreatePipe',
            'DescribePipe',
            'ListPipes',
            'StartPipe',
            'StopPipe',
            'UpdatePipe',
            'DeletePipe',
            'ListTagsForResource',
            'TagResource',
            'UntagResource',
        ],
        'notes': [
            'This page is inferred from the EventBridge Pipes AWS SDK API because service docs were not provided for this pass.',
            'Pipe summaries are expanded with DescribePipe so source, enrichment, target, logging, role, KMS, and tag data are visible.',
        ],
    }


def resourcegroupstagging_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    tagging = factory.client('resourcegroupstaggingapi')
    resources = _safe_value(
        lambda: _paginate(tagging, 'get_resources', 'ResourceTagMappingList', IncludeComplianceDetails=True),
        [],
    )
    tag_keys = _safe_value(lambda: _paginate(tagging, 'get_tag_keys', 'TagKeys'), [])
    compliance_summary = _safe_value(lambda: _paginate(tagging, 'get_compliance_summary', 'SummaryList'), [])
    report = _safe_value(lambda: _clean_response(tagging.describe_report_creation()), {})

    tag_values = []
    for key in tag_keys[:25]:
        values = _safe_value(lambda key=key: _paginate(tagging, 'get_tag_values', 'TagValues', Key=key), [])
        tag_values.append({
            'name': key,
            'key': key,
            'values': values,
            'value_count': len(values),
        })

    resource_type_counts: dict[str, int] = {}
    tag_counts: dict[str, int] = {}
    resource_details = []
    for mapping in resources:
        arn = mapping.get('ResourceARN')
        arn_parts = arn.split(':') if arn else []
        resource_type = arn_parts[2] if len(arn_parts) > 2 else 'unknown'
        resource_type_counts[resource_type] = resource_type_counts.get(resource_type, 0) + 1
        tags = mapping.get('Tags', [])
        for tag in tags:
            key = tag.get('Key')
            if key:
                tag_counts[key] = tag_counts.get(key, 0) + 1

        resource_details.append({
            'name': arn.rsplit('/', 1)[-1].rsplit(':', 1)[-1] if arn else None,
            'arn': arn,
            'resource_type': resource_type,
            'tags': tags,
            'tag_count': len(tags),
            'compliance_details': mapping.get('ComplianceDetails'),
        })

    resource_types = [
        {'name': resource_type, 'resource_type': resource_type, 'count': count}
        for resource_type, count in sorted(resource_type_counts.items())
    ]
    top_tags = [
        {'name': key, 'key': key, 'resource_count': count}
        for key, count in sorted(tag_counts.items(), key=lambda item: (-item[1], item[0]))[:50]
    ]

    return {
        'summary': {
            'tagged_resources': len(resource_details),
            'tag_keys': len(tag_keys),
            'tag_value_keys_sampled': len(tag_values),
            'resource_types': len(resource_types),
            'compliance_items': len(compliance_summary),
        },
        'resources': resource_details,
        'resource_types': resource_types,
        'tag_keys': [{'name': key, 'key': key} for key in tag_keys],
        'tag_values': tag_values,
        'top_tags': top_tags,
        'compliance_summary': compliance_summary,
        'report': report,
        'supported_from_sdk': [
            'GetResources',
            'GetTagKeys',
            'GetTagValues',
            'GetComplianceSummary',
            'DescribeReportCreation',
            'ListRequiredTags',
            'StartReportCreation',
            'TagResources',
            'UntagResources',
        ],
        'notes': [
            'This page is inferred from the Resource Groups Tagging API SDK surface because service docs were not provided for this pass.',
            'Tag values are sampled for the first 25 tag keys to keep page loads bounded.',
        ],
    }


def ssm_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    ssm = factory.client('ssm')

    parameters = _safe_value(lambda: _paginate(ssm, 'describe_parameters', 'Parameters'), [])
    documents = _safe_value(lambda: _paginate(ssm, 'list_documents', 'DocumentIdentifiers'), [])
    instances = _safe_value(lambda: _paginate(ssm, 'describe_instance_information', 'InstanceInformationList'), [])
    sessions = _safe_value(lambda: _paginate(ssm, 'describe_sessions', 'Sessions', State='History'), [])
    automation_executions = _safe_value(lambda: _paginate(ssm, 'describe_automation_executions', 'AutomationExecutionMetadataList'), [])
    maintenance_windows = _safe_value(lambda: _paginate(ssm, 'describe_maintenance_windows', 'WindowIdentities'), [])
    patch_baselines = _safe_value(lambda: _paginate(ssm, 'describe_patch_baselines', 'BaselineIdentities'), [])
    associations = _safe_value(lambda: _paginate(ssm, 'list_associations', 'Associations'), [])
    commands = _safe_value(lambda: _paginate(ssm, 'list_commands', 'Commands'), [])
    command_invocations = _safe_value(lambda: _paginate(ssm, 'list_command_invocations', 'CommandInvocations', Details=True), [])
    compliance_summaries = _safe_value(lambda: _paginate(ssm, 'list_compliance_summaries', 'ComplianceSummaryItems'), [])
    resource_compliance_summaries = _safe_value(lambda: _paginate(ssm, 'list_resource_compliance_summaries', 'ResourceComplianceSummaryItems'), [])
    data_syncs = _safe_value(lambda: _paginate(ssm, 'list_resource_data_sync', 'ResourceDataSyncItems'), [])
    ops_items = _safe_value(lambda: _paginate(ssm, 'describe_ops_items', 'OpsItemSummaries'), [])
    ops_metadata = _safe_value(lambda: _paginate(ssm, 'list_ops_metadata', 'OpsMetadataList'), [])

    def parameter_detail(parameter: dict[str, Any]) -> dict[str, Any]:
        name = parameter.get('Name')
        tags = _safe_value(lambda name=name: ssm.list_tags_for_resource(ResourceType='Parameter', ResourceId=name).get('TagList', []), []) if name else []
        return {
            'name': name,
            'type': parameter.get('Type'),
            'key_id': parameter.get('KeyId'),
            'last_modified': parameter.get('LastModifiedDate'),
            'last_modified_user': parameter.get('LastModifiedUser'),
            'description': parameter.get('Description'),
            'version': parameter.get('Version'),
            'tier': parameter.get('Tier'),
            'policies': parameter.get('Policies'),
            'data_type': parameter.get('DataType'),
            'tags': tags,
        }

    def document_detail(document: dict[str, Any]) -> dict[str, Any]:
        name = document.get('Name')
        detail = _safe_value(lambda name=name: _clean_response(ssm.describe_document(Name=name).get('Document', {})), {}) if name else {}
        return {
            'name': name,
            'owner': detail.get('Owner') or document.get('Owner'),
            'platform_types': detail.get('PlatformTypes') or document.get('PlatformTypes'),
            'document_version': detail.get('DocumentVersion') or document.get('DocumentVersion'),
            'document_type': detail.get('DocumentType') or document.get('DocumentType'),
            'schema_version': detail.get('SchemaVersion') or document.get('SchemaVersion'),
            'document_format': detail.get('DocumentFormat') or document.get('DocumentFormat'),
            'target_type': detail.get('TargetType') or document.get('TargetType'),
            'status': detail.get('Status'),
            'created': detail.get('CreatedDate') or document.get('CreatedDate'),
            'description': detail.get('Description'),
            'parameters': detail.get('Parameters'),
            'tags': detail.get('Tags'),
        }

    parameter_details = [parameter_detail(parameter) for parameter in parameters]
    document_details = [document_detail(document) for document in documents[:50]]
    parameter_types: dict[str, int] = {}
    for parameter in parameter_details:
        parameter_type = parameter.get('type') or 'Unknown'
        parameter_types[parameter_type] = parameter_types.get(parameter_type, 0) + 1

    return {
        'summary': {
            'parameters': len(parameter_details),
            'documents': len(documents),
            'managed_instances': len(instances),
            'sessions': len(sessions),
            'automations': len(automation_executions),
            'maintenance_windows': len(maintenance_windows),
            'patch_baselines': len(patch_baselines),
            'associations': len(associations),
            'commands': len(commands),
            'ops_items': len(ops_items),
        },
        'parameters': parameter_details,
        'parameter_types': [{'name': key, 'type': key, 'count': count} for key, count in sorted(parameter_types.items())],
        'documents': document_details,
        'document_identifiers': documents,
        'managed_instances': instances,
        'sessions': sessions,
        'automation_executions': automation_executions,
        'maintenance_windows': maintenance_windows,
        'patch_baselines': patch_baselines,
        'associations': associations,
        'commands': commands,
        'command_invocations': command_invocations,
        'compliance_summaries': compliance_summaries,
        'resource_compliance_summaries': resource_compliance_summaries,
        'resource_data_syncs': data_syncs,
        'ops_items': ops_items,
        'ops_metadata': ops_metadata,
        'supported_from_sdk': [
            'PutParameter',
            'GetParameter',
            'GetParameters',
            'GetParametersByPath',
            'DescribeParameters',
            'DeleteParameter',
            'CreateDocument',
            'DescribeDocument',
            'ListDocuments',
            'SendCommand',
            'ListCommands',
            'ListCommandInvocations',
            'StartSession',
            'DescribeSessions',
            'StartAutomationExecution',
            'DescribeAutomationExecutions',
            'CreateMaintenanceWindow',
            'DescribeMaintenanceWindows',
            'CreatePatchBaseline',
            'DescribePatchBaselines',
            'ListAssociations',
            'DescribeInstanceInformation',
            'ListTagsForResource',
        ],
        'notes': [
            'This page is inferred from the SSM AWS SDK API because service docs were not provided for this pass.',
            'Parameter values are intentionally not fetched; the page shows metadata, types, tiers, policies, and tags.',
            'Document details are expanded for the first 50 document identifiers to keep page loads bounded.',
        ],
    }


def _ecs_operation_supported(client, operation_name: str) -> bool:
    return operation_name in client.meta.service_model.operation_names


def _autoscaling_operation_supported(client, operation_name: str) -> bool:
    return operation_name in client.meta.service_model.operation_names


def _autoscaling_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (BotoCoreError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def autoscaling_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    autoscaling = factory.client('autoscaling')

    groups = _safe_value(
        lambda: _paginate(autoscaling, 'describe_auto_scaling_groups', 'AutoScalingGroups'),
        [],
    )
    launch_configurations = _safe_value(
        lambda: _paginate(autoscaling, 'describe_launch_configurations', 'LaunchConfigurations'),
        [],
    )
    policies = _safe_value(
        lambda: _paginate(autoscaling, 'describe_policies', 'ScalingPolicies'),
        [],
    )
    scheduled_actions = _safe_value(
        lambda: _paginate(autoscaling, 'describe_scheduled_actions', 'ScheduledUpdateGroupActions'),
        [],
    )
    activities = _safe_value(
        lambda: _paginate(autoscaling, 'describe_scaling_activities', 'Activities'),
        [],
    )
    notification_configurations = _safe_value(
        lambda: _paginate(autoscaling, 'describe_notification_configurations', 'NotificationConfigurations'),
        [],
    )
    tags = _safe_value(
        lambda: _paginate(autoscaling, 'describe_tags', 'Tags'),
        [],
    )
    account_limits = _autoscaling_optional(
        lambda: autoscaling.describe_account_limits(),
        {'ResourceContention'},
    )
    adjustment_types = _autoscaling_optional(
        lambda: autoscaling.describe_adjustment_types().get('AdjustmentTypes', []),
        {'ResourceContention'},
    )
    metric_collection_types = _autoscaling_optional(
        lambda: autoscaling.describe_metric_collection_types(),
        {'ResourceContention'},
    )
    scaling_process_types = _autoscaling_optional(
        lambda: autoscaling.describe_scaling_process_types().get('Processes', []),
        {'ResourceContention'},
    )
    termination_policy_types = _autoscaling_optional(
        lambda: autoscaling.describe_termination_policy_types().get('TerminationPolicyTypes', []),
        {'ResourceContention'},
    )

    policies_by_group: dict[str, list[dict[str, Any]]] = {}
    for policy in policies:
        group_name = policy.get('AutoScalingGroupName')
        if group_name:
            policies_by_group.setdefault(group_name, []).append(_clean_response(policy))

    scheduled_actions_by_group: dict[str, list[dict[str, Any]]] = {}
    for action in scheduled_actions:
        group_name = action.get('AutoScalingGroupName')
        if group_name:
            scheduled_actions_by_group.setdefault(group_name, []).append(_clean_response(action))

    activities_by_group: dict[str, list[dict[str, Any]]] = {}
    for activity in activities:
        group_name = activity.get('AutoScalingGroupName')
        if group_name:
            activities_by_group.setdefault(group_name, []).append(_clean_response(activity))

    notifications_by_group: dict[str, list[dict[str, Any]]] = {}
    for configuration in notification_configurations:
        group_name = configuration.get('AutoScalingGroupName')
        if group_name:
            notifications_by_group.setdefault(group_name, []).append(_clean_response(configuration))

    tags_by_group: dict[str, list[dict[str, Any]]] = {}
    for tag in tags:
        resource_type = tag.get('ResourceType')
        resource_id = tag.get('ResourceId')
        if resource_type == 'auto-scaling-group' and resource_id:
            tags_by_group.setdefault(resource_id, []).append(_clean_response(tag))

    def group_detail(group: dict[str, Any]) -> dict[str, Any]:
        name = group.get('AutoScalingGroupName')
        lifecycle_hooks = _autoscaling_optional(
            lambda: autoscaling.describe_lifecycle_hooks(AutoScalingGroupName=name).get('LifecycleHooks', []),
            {'ResourceContention', 'ValidationError'},
        )
        warm_pool = _autoscaling_optional(
            lambda: autoscaling.describe_warm_pool(AutoScalingGroupName=name),
            {'ResourceContention', 'ValidationError'},
        ) if _autoscaling_operation_supported(autoscaling, 'DescribeWarmPool') else None
        instance_refreshes = _autoscaling_optional(
            lambda: _paginate(
                autoscaling,
                'describe_instance_refreshes',
                'InstanceRefreshes',
                AutoScalingGroupName=name,
            ),
            {'ResourceContention', 'ValidationError'},
        ) if _autoscaling_operation_supported(autoscaling, 'DescribeInstanceRefreshes') else None

        instances = group.get('Instances', [])

        return {
            'name': name,
            'arn': group.get('AutoScalingGroupARN'),
            'launch_configuration_name': group.get('LaunchConfigurationName'),
            'launch_template': group.get('LaunchTemplate'),
            'mixed_instances_policy': group.get('MixedInstancesPolicy'),
            'min_size': group.get('MinSize'),
            'max_size': group.get('MaxSize'),
            'desired_capacity': group.get('DesiredCapacity'),
            'default_cooldown': group.get('DefaultCooldown'),
            'availability_zones': group.get('AvailabilityZones'),
            'load_balancer_names': group.get('LoadBalancerNames'),
            'target_group_arns': group.get('TargetGroupARNs'),
            'health_check_type': group.get('HealthCheckType'),
            'health_check_grace_period': group.get('HealthCheckGracePeriod'),
            'placement_group': group.get('PlacementGroup'),
            'vpc_zone_identifier': group.get('VPCZoneIdentifier'),
            'status': group.get('Status'),
            'created_time': group.get('CreatedTime'),
            'suspended_processes': group.get('SuspendedProcesses'),
            'enabled_metrics': group.get('EnabledMetrics'),
            'termination_policies': group.get('TerminationPolicies'),
            'new_instances_protected_from_scale_in': group.get('NewInstancesProtectedFromScaleIn'),
            'service_linked_role_arn': group.get('ServiceLinkedRoleARN'),
            'capacity_rebalance': group.get('CapacityRebalance'),
            'traffic_sources': group.get('TrafficSources'),
            'availability_zone_distribution': group.get('AvailabilityZoneDistribution'),
            'availability_zone_impairment_policy': group.get('AvailabilityZoneImpairmentPolicy'),
            'capacity_reservation_specification': group.get('CapacityReservationSpecification'),
            'instances': instances,
            'instance_count': len(instances),
            'in_service_instances': sum(
                1
                for instance in instances
                if instance.get('LifecycleState') == 'InService'
            ),
            'policies': policies_by_group.get(name, []),
            'scheduled_actions': scheduled_actions_by_group.get(name, []),
            'activities': activities_by_group.get(name, []),
            'lifecycle_hooks': lifecycle_hooks,
            'warm_pool': warm_pool,
            'instance_refreshes': instance_refreshes,
            'notification_configurations': notifications_by_group.get(name, []),
            'tags': tags_by_group.get(name, group.get('Tags', [])),
        }

    detailed_groups = [group_detail(group) for group in groups]

    return {
        'summary': {
            'groups': len(detailed_groups),
            'instances': sum(group.get('instance_count') or 0 for group in detailed_groups),
            'in_service_instances': sum(group.get('in_service_instances') or 0 for group in detailed_groups),
            'launch_configurations': len(launch_configurations),
            'scaling_policies': len(policies),
            'scheduled_actions': len(scheduled_actions),
            'activities': len(activities),
            'lifecycle_hooks': sum(
                len(group.get('lifecycle_hooks') or [])
                for group in detailed_groups
                if isinstance(group.get('lifecycle_hooks'), list)
            ),
        },
        'groups': detailed_groups,
        'launch_configurations': _clean_response(launch_configurations),
        'scaling_policies': _clean_response(policies),
        'scheduled_actions': _clean_response(scheduled_actions),
        'activities': _clean_response(activities),
        'notification_configurations': _clean_response(notification_configurations),
        'tags': _clean_response(tags),
        'account_limits': account_limits,
        'adjustment_types': adjustment_types,
        'metric_collection_types': metric_collection_types,
        'scaling_process_types': scaling_process_types,
        'termination_policy_types': termination_policy_types,
        'supported_from_sdk': [
            'CreateAutoScalingGroup',
            'UpdateAutoScalingGroup',
            'DeleteAutoScalingGroup',
            'DescribeAutoScalingGroups',
            'CreateLaunchConfiguration',
            'DescribeLaunchConfigurations',
            'DeleteLaunchConfiguration',
            'PutScalingPolicy',
            'DescribePolicies',
            'DeletePolicy',
            'PutScheduledUpdateGroupAction',
            'DescribeScheduledActions',
            'DeleteScheduledAction',
            'DescribeScalingActivities',
            'SetDesiredCapacity',
            'TerminateInstanceInAutoScalingGroup',
            'SuspendProcesses',
            'ResumeProcesses',
            'PutLifecycleHook',
            'DescribeLifecycleHooks',
            'DeleteLifecycleHook',
            'PutNotificationConfiguration',
            'DescribeNotificationConfigurations',
            'DeleteNotificationConfiguration',
            'DescribeTags',
            'CreateOrUpdateTags',
            'DeleteTags',
            'DescribeAccountLimits',
        ],
        'notes': [
            'This page uses the EC2 Auto Scaling SDK API and tolerates missing optional operations from local implementations.',
            'Group detail expands lifecycle hooks, warm pool data, instance refreshes, policies, activities, notifications, and tags when available.',
        ],
    }


def backup_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    backup = factory.client('backup')
    vaults = _safe_value(lambda: _paginate(backup, 'list_backup_vaults', 'BackupVaultList'), [])
    plans = _safe_value(lambda: _paginate(backup, 'list_backup_plans', 'BackupPlansList'), [])
    backup_jobs = _safe_value(lambda: _paginate(backup, 'list_backup_jobs', 'BackupJobs'), [])
    restore_jobs = _safe_value(lambda: _paginate(backup, 'list_restore_jobs', 'RestoreJobs'), [])
    protected_resources = _safe_value(lambda: _paginate(backup, 'list_protected_resources', 'Results'), [])

    def vault_detail(vault: dict[str, Any]) -> dict[str, Any]:
        name = vault.get('BackupVaultName')
        recovery_points = _safe_value(
            lambda: _paginate(backup, 'list_recovery_points_by_backup_vault', 'RecoveryPoints', BackupVaultName=name),
            [],
        ) if name else []

        return {
            'name': name,
            'arn': vault.get('BackupVaultArn'),
            'created': vault.get('CreationDate'),
            'creator_request_id': vault.get('CreatorRequestId'),
            'encryption_key_arn': vault.get('EncryptionKeyArn'),
            'recovery_points': vault.get('NumberOfRecoveryPoints'),
            'locked': vault.get('Locked'),
            'min_retention_days': vault.get('MinRetentionDays'),
            'max_retention_days': vault.get('MaxRetentionDays'),
            'recovery_point_count': len(recovery_points),
            'recovery_point_details': recovery_points,
        }

    def plan_detail(plan: dict[str, Any]) -> dict[str, Any]:
        plan_id = plan.get('BackupPlanId')
        details = _safe_value(lambda: backup.get_backup_plan(BackupPlanId=plan_id), {}) if plan_id else {}
        selections = _safe_value(
            lambda: _paginate(backup, 'list_backup_selections', 'BackupSelectionsList', BackupPlanId=plan_id),
            [],
        ) if plan_id else []

        return {
            'name': plan.get('BackupPlanName'),
            'arn': plan.get('BackupPlanArn'),
            'id': plan_id,
            'version_id': plan.get('VersionId'),
            'created': plan.get('CreationDate'),
            'deleted': plan.get('DeletionDate'),
            'last_execution': plan.get('LastExecutionDate'),
            'advanced_backup_settings': details.get('AdvancedBackupSettings'),
            'rules': details.get('BackupPlan', {}).get('Rules'),
            'selections': selections,
            'selection_count': len(selections),
        }

    detailed_vaults = [vault_detail(vault) for vault in vaults]
    detailed_plans = [plan_detail(plan) for plan in plans]

    return {
        'summary': {
            'vaults': len(detailed_vaults),
            'plans': len(detailed_plans),
            'backup_jobs': len(backup_jobs),
            'restore_jobs': len(restore_jobs),
            'protected_resources': len(protected_resources),
            'recovery_points': sum(vault.get('recovery_point_count') or 0 for vault in detailed_vaults),
        },
        'vaults': detailed_vaults,
        'plans': detailed_plans,
        'backup_jobs': backup_jobs,
        'restore_jobs': restore_jobs,
        'protected_resources': protected_resources,
        'supported': [
            'CreateBackupVault',
            'ListBackupVaults',
            'DeleteBackupVault',
            'CreateBackupPlan',
            'GetBackupPlan',
            'ListBackupPlans',
            'DeleteBackupPlan',
            'CreateBackupSelection',
            'ListBackupSelections',
            'ListBackupJobs',
            'ListRestoreJobs',
            'ListProtectedResources',
            'ListRecoveryPointsByBackupVault',
        ],
        'notes': [
            'AWS Backup coordinates backup plans, vaults, recovery points, and restore workflows.',
            'Inventory calls are read-only and tolerate missing local service operations.',
        ],
    }


def route53_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    route53 = factory.client('route53')
    hosted_zones = _safe_value(lambda: _paginate(route53, 'list_hosted_zones', 'HostedZones'), [])
    health_checks = _safe_value(lambda: _paginate(route53, 'list_health_checks', 'HealthChecks'), [])
    traffic_policies = _safe_value(lambda: route53.list_traffic_policies().get('TrafficPolicySummaries', []), [])
    traffic_policy_instances = _safe_value(
        lambda: route53.list_traffic_policy_instances().get('TrafficPolicyInstances', []),
        [],
    )
    delegation_sets = _safe_value(
        lambda: route53.list_reusable_delegation_sets().get('DelegationSets', []),
        [],
    )

    def zone_detail(zone: dict[str, Any]) -> dict[str, Any]:
        zone_id = zone.get('Id')
        clean_zone_id = zone_id.rsplit('/', 1)[-1] if zone_id else None
        details = _safe_value(lambda: route53.get_hosted_zone(Id=zone_id), {}) if zone_id else {}
        records = _safe_value(
            lambda: _paginate(route53, 'list_resource_record_sets', 'ResourceRecordSets', HostedZoneId=zone_id),
            [],
        ) if zone_id else []
        query_logging_configs = _safe_value(
            lambda: route53.list_query_logging_configs(HostedZoneId=clean_zone_id).get('QueryLoggingConfigs', []),
            [],
        ) if clean_zone_id else []

        return {
            'name': zone.get('Name'),
            'id': zone_id,
            'clean_id': clean_zone_id,
            'caller_reference': zone.get('CallerReference'),
            'private_zone': zone.get('Config', {}).get('PrivateZone'),
            'comment': zone.get('Config', {}).get('Comment'),
            'resource_record_set_count': zone.get('ResourceRecordSetCount'),
            'delegation_set': details.get('DelegationSet'),
            'vpcs': details.get('VPCs'),
            'query_logging_configs': query_logging_configs,
            'record_count': len(records),
            'records': _clean_response(records),
        }

    detailed_zones = [zone_detail(zone) for zone in hosted_zones]

    return {
        'summary': {
            'hosted_zones': len(detailed_zones),
            'record_sets': sum(zone.get('record_count') or 0 for zone in detailed_zones),
            'health_checks': len(health_checks),
            'traffic_policies': len(traffic_policies),
            'traffic_policy_instances': len(traffic_policy_instances),
            'delegation_sets': len(delegation_sets),
            'private_zones': sum(1 for zone in detailed_zones if zone.get('private_zone')),
        },
        'hosted_zones': detailed_zones,
        'health_checks': _clean_response(health_checks),
        'traffic_policies': _clean_response(traffic_policies),
        'traffic_policy_instances': _clean_response(traffic_policy_instances),
        'delegation_sets': _clean_response(delegation_sets),
        'supported': [
            'CreateHostedZone',
            'GetHostedZone',
            'ListHostedZones',
            'DeleteHostedZone',
            'ChangeResourceRecordSets',
            'ListResourceRecordSets',
            'ListHealthChecks',
            'CreateHealthCheck',
            'DeleteHealthCheck',
            'ListTrafficPolicies',
            'ListTrafficPolicyInstances',
            'ListReusableDelegationSets',
        ],
        'notes': [
            'Route 53 inventory expands hosted zones with record sets and query logging configuration when available.',
            'Route 53 is a global service; this dashboard still uses the configured local endpoint.',
        ],
    }


def transfer_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    transfer = factory.client('transfer')
    servers = _safe_value(lambda: _paginate(transfer, 'list_servers', 'Servers'), [])
    workflows = _safe_value(lambda: _paginate(transfer, 'list_workflows', 'Workflows'), [])
    profiles = _safe_value(lambda: _paginate(transfer, 'list_profiles', 'Profiles'), [])
    certificates = _safe_value(lambda: _paginate(transfer, 'list_certificates', 'Certificates'), [])
    connectors = _safe_value(lambda: _paginate(transfer, 'list_connectors', 'Connectors'), [])
    security_policies = _safe_value(lambda: _paginate(transfer, 'list_security_policies', 'SecurityPolicyNames'), [])
    web_apps = _safe_value(lambda: _paginate(transfer, 'list_web_apps', 'WebApps'), [])

    def server_detail(server: dict[str, Any]) -> dict[str, Any]:
        server_id = server.get('ServerId')
        details = _safe_value(lambda: transfer.describe_server(ServerId=server_id).get('Server', {}), {}) if server_id else {}
        users = _safe_value(lambda: _paginate(transfer, 'list_users', 'Users', ServerId=server_id), []) if server_id else []
        host_keys = _safe_value(lambda: transfer.list_host_keys(ServerId=server_id).get('HostKeys', []), []) if server_id else []
        agreements = _safe_value(lambda: _paginate(transfer, 'list_agreements', 'Agreements', ServerId=server_id), []) if server_id else []

        return {
            'name': server_id,
            'id': server_id,
            'arn': server.get('Arn') or details.get('Arn'),
            'state': server.get('State') or details.get('State'),
            'endpoint_type': server.get('EndpointType') or details.get('EndpointType'),
            'domain': server.get('Domain') or details.get('Domain'),
            'identity_provider_type': server.get('IdentityProviderType') or details.get('IdentityProviderType'),
            'protocols': details.get('Protocols'),
            'endpoint_details': details.get('EndpointDetails'),
            'logging_role': details.get('LoggingRole'),
            'structured_log_destinations': details.get('StructuredLogDestinations'),
            'security_policy_name': details.get('SecurityPolicyName'),
            'workflow_details': details.get('WorkflowDetails'),
            'certificate': details.get('Certificate'),
            'tags': details.get('Tags'),
            'user_count': len(users),
            'users': _clean_response(users),
            'host_key_count': len(host_keys),
            'host_keys': _clean_response(host_keys),
            'agreement_count': len(agreements),
            'agreements': _clean_response(agreements),
        }

    def profile_detail(profile: dict[str, Any]) -> dict[str, Any]:
        profile_id = profile.get('ProfileId')
        details = _safe_value(lambda: transfer.describe_profile(ProfileId=profile_id).get('Profile', {}), {}) if profile_id else {}
        return {
            'name': profile_id,
            'id': profile_id,
            'arn': profile.get('Arn') or details.get('Arn'),
            'as2_id': details.get('As2Id'),
            'profile_type': details.get('ProfileType'),
            'certificate_ids': details.get('CertificateIds'),
            'tags': details.get('Tags'),
        }

    def certificate_detail(certificate: dict[str, Any]) -> dict[str, Any]:
        certificate_id = certificate.get('CertificateId')
        details = _safe_value(
            lambda: transfer.describe_certificate(CertificateId=certificate_id).get('Certificate', {}),
            {},
        ) if certificate_id else {}
        return {
            'name': certificate_id,
            'id': certificate_id,
            'arn': certificate.get('Arn') or details.get('Arn'),
            'status': details.get('Status'),
            'type': details.get('Type'),
            'usage': details.get('Usage'),
            'certificate': details.get('Certificate'),
            'active_date': details.get('ActiveDate'),
            'inactive_date': details.get('InactiveDate'),
            'serial': details.get('Serial'),
            'not_before_date': details.get('NotBeforeDate'),
            'not_after_date': details.get('NotAfterDate'),
            'description': details.get('Description'),
            'tags': details.get('Tags'),
        }

    def connector_detail(connector: dict[str, Any]) -> dict[str, Any]:
        connector_id = connector.get('ConnectorId')
        details = _safe_value(
            lambda: transfer.describe_connector(ConnectorId=connector_id).get('Connector', {}),
            {},
        ) if connector_id else {}
        return {
            'name': connector_id,
            'id': connector_id,
            'arn': connector.get('Arn') or details.get('Arn'),
            'url': details.get('Url'),
            'as2_config': details.get('As2Config'),
            'access_role': details.get('AccessRole'),
            'logging_role': details.get('LoggingRole'),
            'security_policy_name': details.get('SecurityPolicyName'),
            'tags': details.get('Tags'),
        }

    detailed_servers = [server_detail(server) for server in servers]
    detailed_profiles = [profile_detail(profile) for profile in profiles]
    detailed_certificates = [certificate_detail(certificate) for certificate in certificates]
    detailed_connectors = [connector_detail(connector) for connector in connectors]

    return {
        'summary': {
            'servers': len(detailed_servers),
            'users': sum(server.get('user_count') or 0 for server in detailed_servers),
            'host_keys': sum(server.get('host_key_count') or 0 for server in detailed_servers),
            'agreements': sum(server.get('agreement_count') or 0 for server in detailed_servers),
            'workflows': len(workflows),
            'profiles': len(detailed_profiles),
            'certificates': len(detailed_certificates),
            'connectors': len(detailed_connectors),
            'security_policies': len(security_policies),
            'web_apps': len(web_apps),
        },
        'servers': detailed_servers,
        'workflows': _clean_response(workflows),
        'profiles': detailed_profiles,
        'certificates': detailed_certificates,
        'connectors': detailed_connectors,
        'security_policies': _clean_response(security_policies),
        'web_apps': _clean_response(web_apps),
        'supported': [
            'CreateServer',
            'DescribeServer',
            'ListServers',
            'DeleteServer',
            'CreateUser',
            'DescribeUser',
            'ListUsers',
            'DeleteUser',
            'ImportHostKey',
            'ListHostKeys',
            'CreateWorkflow',
            'ListWorkflows',
            'CreateProfile',
            'ListProfiles',
            'ImportCertificate',
            'ListCertificates',
            'CreateConnector',
            'ListConnectors',
            'ListSecurityPolicies',
            'CreateWebApp',
            'ListWebApps',
        ],
        'notes': [
            'Transfer Family supports SFTP, FTPS, FTP, and AS2 managed transfer workflows.',
            'Server detail expands users, host keys, and AS2 agreements when those local operations are available.',
        ],
    }


def ecs_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    ecs = factory.client('ecs')
    cluster_arns = _safe_value(lambda: _paginate(ecs, 'list_clusters', 'clusterArns'), [])
    task_definition_arns = _safe_value(lambda: _paginate(ecs, 'list_task_definitions', 'taskDefinitionArns'), [])
    task_definition_families = _safe_value(lambda: _paginate(ecs, 'list_task_definition_families', 'families'), [])

    def list_tags(arn: Optional[str]) -> Any:
        if not arn:
            return None

        return _ecs_optional(
            lambda: ecs.list_tags_for_resource(resourceArn=arn).get('tags', []),
            {'ClusterNotFoundException', 'ClientException', 'InvalidParameterException'},
        )

    def describe_task_definition(arn: str) -> dict[str, Any]:
        response = _ecs_optional(
            lambda: ecs.describe_task_definition(taskDefinition=arn, include=['TAGS']),
            {'ClientException', 'InvalidParameterException'},
        )

        if not isinstance(response, dict) or response.get('error'):
            return {'name': arn, 'arn': arn, 'details': response}

        task_definition = response.get('taskDefinition', {})
        return {
            'name': f"{task_definition.get('family')}:{task_definition.get('revision')}" if task_definition.get('family') else arn,
            'arn': task_definition.get('taskDefinitionArn') or arn,
            'family': task_definition.get('family'),
            'revision': task_definition.get('revision'),
            'status': task_definition.get('status'),
            'network_mode': task_definition.get('networkMode'),
            'requires_compatibilities': task_definition.get('requiresCompatibilities'),
            'cpu': task_definition.get('cpu'),
            'memory': task_definition.get('memory'),
            'task_role_arn': task_definition.get('taskRoleArn'),
            'execution_role_arn': task_definition.get('executionRoleArn'),
            'registered_at': task_definition.get('registeredAt'),
            'deregistered_at': task_definition.get('deregisteredAt'),
            'containers': [
                {
                    'name': container.get('name'),
                    'image': container.get('image'),
                    'cpu': container.get('cpu'),
                    'memory': container.get('memory'),
                    'essential': container.get('essential'),
                    'port_mappings': container.get('portMappings'),
                }
                for container in task_definition.get('containerDefinitions', [])
            ],
            'volumes': task_definition.get('volumes'),
            'placement_constraints': task_definition.get('placementConstraints'),
            'tags': response.get('tags') or list_tags(task_definition.get('taskDefinitionArn') or arn),
        }

    def cluster_detail(cluster_arn: str) -> dict[str, Any]:
        response = _ecs_optional(
            lambda: ecs.describe_clusters(
                clusters=[cluster_arn],
                include=['ATTACHMENTS', 'CONFIGURATIONS', 'SETTINGS', 'STATISTICS', 'TAGS'],
            ),
            {'ClusterNotFoundException'},
        )

        if not isinstance(response, dict) or response.get('error'):
            return {'name': cluster_arn, 'arn': cluster_arn, 'details': response}

        cluster = (response.get('clusters') or [{}])[0]
        name = cluster.get('clusterName') or cluster_arn
        task_arns = _ecs_optional(
            lambda: _paginate(ecs, 'list_tasks', 'taskArns', cluster=cluster_arn),
            {'ClusterNotFoundException'},
        )
        service_arns = _ecs_optional(
            lambda: _paginate(ecs, 'list_services', 'serviceArns', cluster=cluster_arn),
            {'ClusterNotFoundException'},
        )
        container_instance_arns = _ecs_optional(
            lambda: _paginate(ecs, 'list_container_instances', 'containerInstanceArns', cluster=cluster_arn),
            {'ClusterNotFoundException'},
        )

        tasks: list[dict[str, Any]] = []
        if isinstance(task_arns, list):
            for batch in _chunks(task_arns, 100):
                task_response = _ecs_optional(
                    lambda batch=batch: ecs.describe_tasks(cluster=cluster_arn, tasks=batch, include=['TAGS']).get('tasks', []),
                    {'ClusterNotFoundException', 'InvalidParameterException'},
                )
                if isinstance(task_response, list):
                    tasks.extend(_clean_response(task_response))

        services: list[dict[str, Any]] = []
        task_sets: list[dict[str, Any]] = []
        service_deployments: list[Any] = []
        service_revisions: list[Any] = []
        if isinstance(service_arns, list):
            for batch in _chunks(service_arns, 10):
                service_response = _ecs_optional(
                    lambda batch=batch: ecs.describe_services(cluster=cluster_arn, services=batch, include=['TAGS']).get('services', []),
                    {'ClusterNotFoundException', 'ServiceNotFoundException', 'InvalidParameterException'},
                )
                if isinstance(service_response, list):
                    services.extend(_clean_response(service_response))

            for service_arn in service_arns:
                sets = _ecs_optional(
                    lambda service_arn=service_arn: ecs.describe_task_sets(cluster=cluster_arn, service=service_arn).get('taskSets', []),
                    {'ClusterNotFoundException', 'ServiceNotFoundException'},
                )
                if isinstance(sets, list):
                    task_sets.extend(_clean_response(sets))

                if _ecs_operation_supported(ecs, 'ListServiceDeployments'):
                    deployments = _ecs_optional(
                        lambda service_arn=service_arn: _paginate(
                            ecs,
                            'list_service_deployments',
                            'serviceDeployments',
                            cluster=cluster_arn,
                            service=service_arn,
                        ),
                        {'ClusterNotFoundException', 'ServiceNotFoundException'},
                    )
                    if isinstance(deployments, list):
                        service_deployments.extend(deployments)

                if _ecs_operation_supported(ecs, 'DescribeServiceRevisions') and service_deployments:
                    revision_arns = [
                        item.get('serviceRevisionArn')
                        for item in service_deployments
                        if isinstance(item, dict) and item.get('serviceRevisionArn')
                    ]
                    if revision_arns:
                        revisions = _ecs_optional(
                            lambda revision_arns=revision_arns[:10]: ecs.describe_service_revisions(
                                serviceRevisionArns=revision_arns[:10],
                            ).get('serviceRevisions', []),
                            {'InvalidParameterException'},
                        )
                        if isinstance(revisions, list):
                            service_revisions.extend(_clean_response(revisions))

        container_instances: list[dict[str, Any]] = []
        if isinstance(container_instance_arns, list):
            for batch in _chunks(container_instance_arns, 100):
                container_response = _ecs_optional(
                    lambda batch=batch: ecs.describe_container_instances(
                        cluster=cluster_arn,
                        containerInstances=batch,
                    ).get('containerInstances', []),
                    {'ClusterNotFoundException', 'InvalidParameterException'},
                )
                if isinstance(container_response, list):
                    container_instances.extend(_clean_response(container_response))

        return {
            'name': name,
            'arn': cluster.get('clusterArn') or cluster_arn,
            'status': cluster.get('status'),
            'running_tasks': cluster.get('runningTasksCount'),
            'pending_tasks': cluster.get('pendingTasksCount'),
            'active_services': cluster.get('activeServicesCount'),
            'registered_container_instances': cluster.get('registeredContainerInstancesCount'),
            'capacity_providers': cluster.get('capacityProviders'),
            'default_capacity_provider_strategy': cluster.get('defaultCapacityProviderStrategy'),
            'settings': cluster.get('settings'),
            'configuration': cluster.get('configuration'),
            'statistics': cluster.get('statistics'),
            'attachments': cluster.get('attachments'),
            'tags': cluster.get('tags') or list_tags(cluster.get('clusterArn') or cluster_arn),
            'task_count': len(tasks),
            'service_count': len(services),
            'task_set_count': len(task_sets),
            'container_instance_count': len(container_instances),
            'service_deployment_count': len(service_deployments),
            'tasks': tasks,
            'services': services,
            'task_sets': task_sets,
            'container_instances': container_instances,
            'service_deployments': service_deployments,
            'service_revisions': service_revisions,
        }

    detailed_clusters = [cluster_detail(arn) for arn in cluster_arns]
    task_definitions = [describe_task_definition(arn) for arn in task_definition_arns]
    capacity_providers = _ecs_optional(
        lambda: ecs.describe_capacity_providers().get('capacityProviders', []),
        {'ClientException'},
    )
    account_settings = _ecs_optional(
        lambda: _paginate(ecs, 'list_account_settings', 'settings'),
        {'ClientException'},
    )
    attributes = _ecs_optional(
        lambda: ecs.list_attributes(targetType='container-instance').get('attributes', []),
        {'ClientException'},
    )
    agent_poll_endpoint = _ecs_optional(
        lambda: ecs.discover_poll_endpoint(),
        {'ClientException'},
    )

    return {
        'summary': {
            'clusters': len(detailed_clusters),
            'task_definitions': len(task_definitions),
            'task_definition_families': len(task_definition_families),
            'tasks': sum(cluster.get('task_count') or 0 for cluster in detailed_clusters),
            'services': sum(cluster.get('service_count') or 0 for cluster in detailed_clusters),
            'task_sets': sum(cluster.get('task_set_count') or 0 for cluster in detailed_clusters),
            'container_instances': sum(cluster.get('container_instance_count') or 0 for cluster in detailed_clusters),
            'capacity_providers': len(capacity_providers) if isinstance(capacity_providers, list) else 0,
        },
        'clusters': detailed_clusters,
        'task_definitions': task_definitions,
        'task_definition_families': task_definition_families,
        'capacity_providers': capacity_providers,
        'account_settings': account_settings,
        'attributes': attributes,
        'agent_poll_endpoint': agent_poll_endpoint,
        'supported': {
            'Clusters': ['CreateCluster', 'DescribeClusters', 'ListClusters', 'UpdateCluster', 'UpdateClusterSettings', 'PutClusterCapacityProviders', 'DeleteCluster'],
            'Task definitions': ['RegisterTaskDefinition', 'DescribeTaskDefinition', 'ListTaskDefinitions', 'ListTaskDefinitionFamilies', 'DeregisterTaskDefinition', 'DeleteTaskDefinitions'],
            'Tasks': ['RunTask', 'StartTask', 'StopTask', 'DescribeTasks', 'ListTasks', 'UpdateTaskProtection', 'GetTaskProtection'],
            'Services': ['CreateService', 'UpdateService', 'DeleteService', 'DescribeServices', 'ListServices', 'ListServicesByNamespace'],
            'Task sets': ['CreateTaskSet', 'UpdateTaskSet', 'DeleteTaskSet', 'DescribeTaskSets', 'UpdateServicePrimaryTaskSet'],
            'Container instances': ['RegisterContainerInstance', 'DeregisterContainerInstance', 'DescribeContainerInstances', 'ListContainerInstances', 'UpdateContainerAgent', 'UpdateContainerInstancesState'],
            'Capacity providers': ['CreateCapacityProvider', 'UpdateCapacityProvider', 'DeleteCapacityProvider', 'DescribeCapacityProviders'],
            'Service deployments and revisions': ['DescribeServiceDeployments', 'ListServiceDeployments', 'DescribeServiceRevisions'],
            'Tags': ['TagResource', 'UntagResource', 'ListTagsForResource'],
            'Account settings and attributes': ['PutAccountSetting', 'PutAccountSettingDefault', 'DeleteAccountSetting', 'ListAccountSettings', 'PutAttributes', 'DeleteAttributes', 'ListAttributes'],
            'Agent stubs': ['SubmitTaskStateChange', 'SubmitContainerStateChange', 'SubmitAttachmentStateChanges', 'DiscoverPollEndpoint'],
        },
        'configuration': {
            'mock': False,
            'docker_network': '',
            'default_memory_mb': 512,
            'default_cpu_units': 256,
        },
        'environment_variables': [
            'FLOCI_SERVICES_ECS_ENABLED',
            'FLOCI_SERVICES_ECS_MOCK',
            'FLOCI_SERVICES_ECS_DOCKER_NETWORK',
            'FLOCI_SERVICES_ECS_DEFAULT_MEMORY_MB',
            'FLOCI_SERVICES_ECS_DEFAULT_CPU_UNITS',
        ],
        'notes': [
            'By default Floci ECS launches real Docker containers for tasks.',
            'Set FLOCI_SERVICES_ECS_MOCK=true to run tasks as in-process stubs for CI or tests.',
            'When mock mode is false, Floci needs access to the Docker socket.',
        ],
    }


def _athena_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (BotoCoreError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def athena_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    athena = factory.client('athena')
    workgroups = _safe_value(lambda: _paginate(athena, 'list_work_groups', 'WorkGroups'), [])
    query_execution_ids = _safe_value(lambda: _paginate(athena, 'list_query_executions', 'QueryExecutionIds'), [])

    def workgroup_detail(workgroup: dict[str, Any]) -> dict[str, Any]:
        name = workgroup.get('Name')
        details = _athena_optional(
            lambda: athena.get_work_group(WorkGroup=name).get('WorkGroup', {}),
            {'InvalidRequestException'},
        )

        return {
            'name': name,
            'state': workgroup.get('State') or (details.get('State') if isinstance(details, dict) else None),
            'description': workgroup.get('Description') or (details.get('Description') if isinstance(details, dict) else None),
            'creation_time': workgroup.get('CreationTime') or (details.get('CreationTime') if isinstance(details, dict) else None),
            'configuration': details.get('Configuration') if isinstance(details, dict) else None,
            'details': details,
        }

    def query_detail(query_execution_id: str) -> dict[str, Any]:
        execution = _athena_optional(
            lambda: athena.get_query_execution(QueryExecutionId=query_execution_id).get('QueryExecution', {}),
            {'InvalidRequestException'},
        )

        if not isinstance(execution, dict) or execution.get('error'):
            return {
                'name': query_execution_id,
                'id': query_execution_id,
                'details': execution,
            }

        status = execution.get('Status', {})
        state = status.get('State')
        preview = None

        if state == 'SUCCEEDED':
            preview = _athena_optional(
                lambda: athena.get_query_results(
                    QueryExecutionId=query_execution_id,
                    MaxResults=5,
                ).get('ResultSet', {}),
                {'InvalidRequestException'},
            )

        return {
            'name': query_execution_id,
            'id': query_execution_id,
            'state': state,
            'state_change_reason': status.get('StateChangeReason'),
            'submission_time': status.get('SubmissionDateTime'),
            'completion_time': status.get('CompletionDateTime'),
            'query': execution.get('Query'),
            'database': execution.get('QueryExecutionContext', {}).get('Database'),
            'catalog': execution.get('QueryExecutionContext', {}).get('Catalog'),
            'workgroup': execution.get('WorkGroup'),
            'engine_version': execution.get('EngineVersion'),
            'statement_type': execution.get('StatementType'),
            'substatement_type': execution.get('SubstatementType'),
            'result_configuration': execution.get('ResultConfiguration'),
            'statistics': execution.get('Statistics'),
            'result_preview': preview,
        }

    detailed_workgroups = [workgroup_detail(workgroup) for workgroup in workgroups]
    detailed_queries = [query_detail(query_id) for query_id in query_execution_ids]

    return {
        'summary': {
            'workgroups': len(detailed_workgroups),
            'query_executions': len(detailed_queries),
            'succeeded': sum(1 for query in detailed_queries if query.get('state') == 'SUCCEEDED'),
            'failed': sum(1 for query in detailed_queries if query.get('state') == 'FAILED'),
            'running': sum(1 for query in detailed_queries if query.get('state') == 'RUNNING'),
            'queued': sum(1 for query in detailed_queries if query.get('state') == 'QUEUED'),
        },
        'workgroups': detailed_workgroups,
        'query_executions': detailed_queries,
        'supported': [
            'StartQueryExecution',
            'GetQueryExecution',
            'GetQueryResults',
            'ListQueryExecutions',
            'StopQueryExecution',
            'CreateWorkGroup',
            'GetWorkGroup',
            'ListWorkGroups',
        ],
        'how_it_works': [
            'Floci runs Athena SQL through a floci-duck sidecar powered by DuckDB.',
            'Glue tables are mapped to DuckDB views over S3 data before execution.',
            'Query results are written as CSV to S3 and read back through GetQueryResults.',
        ],
        'format_inference': {
            'parquet': 'read_parquet',
            'json_or_hive': 'read_json_auto',
            'default': 'read_csv_auto',
        },
        'configuration': {
            'mock': False,
            'default_image': 'floci/floci-duck:latest',
            'duck_url': None,
        },
        'environment_variables': [
            'FLOCI_SERVICES_ATHENA_MOCK',
            'FLOCI_SERVICES_ATHENA_DEFAULT_IMAGE',
            'FLOCI_SERVICES_ATHENA_DUCK_URL',
        ],
        'notes': [
            'Mock mode makes queries transition to SUCCEEDED immediately with empty results.',
            'The DuckDB sidecar is started lazily on the first StartQueryExecution call.',
            'The dashboard only previews a few result rows for completed queries.',
        ],
    }


def _sns_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (BotoCoreError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def sns_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    sns = factory.client('sns')
    topics = _safe_value(lambda: _paginate(sns, 'list_topics', 'Topics'), [])
    subscriptions = _safe_value(lambda: _paginate(sns, 'list_subscriptions', 'Subscriptions'), [])

    def topic_name(topic_arn: Optional[str]) -> str:
        return topic_arn.rsplit(':', 1)[-1] if topic_arn else 'Unnamed topic'

    def topic_detail(topic: dict[str, Any]) -> dict[str, Any]:
        arn = topic.get('TopicArn')
        topic_subscriptions = _sns_optional(
            lambda: _paginate(sns, 'list_subscriptions_by_topic', 'Subscriptions', TopicArn=arn),
            {'NotFound', 'InvalidParameter'},
        )

        return {
            'name': topic_name(arn),
            'arn': arn,
            'attributes': _sns_optional(
                lambda: sns.get_topic_attributes(TopicArn=arn).get('Attributes', {}),
                {'NotFound', 'InvalidParameter'},
            ),
            'tags': _sns_optional(
                lambda: sns.list_tags_for_resource(ResourceArn=arn).get('Tags', []),
                {'NotFound', 'InvalidParameter'},
            ),
            'subscriptions': topic_subscriptions,
            'subscription_count': len(topic_subscriptions) if isinstance(topic_subscriptions, list) else 0,
        }

    def subscription_detail(subscription: dict[str, Any]) -> dict[str, Any]:
        arn = subscription.get('SubscriptionArn')
        attributes = None

        if arn and arn != 'PendingConfirmation':
            attributes = _sns_optional(
                lambda: sns.get_subscription_attributes(SubscriptionArn=arn).get('Attributes', {}),
                {'NotFound', 'InvalidParameter'},
            )

        return {
            'name': arn or subscription.get('Endpoint') or 'Subscription',
            'arn': arn,
            'topic_arn': subscription.get('TopicArn'),
            'protocol': subscription.get('Protocol'),
            'endpoint': subscription.get('Endpoint'),
            'owner': subscription.get('Owner'),
            'attributes': attributes,
        }

    detailed_topics = [topic_detail(topic) for topic in topics]
    detailed_subscriptions = [subscription_detail(subscription) for subscription in subscriptions]

    return {
        'summary': {
            'topics': len(detailed_topics),
            'subscriptions': len(detailed_subscriptions),
            'sqs_subscriptions': sum(1 for subscription in detailed_subscriptions if subscription.get('protocol') == 'sqs'),
            'lambda_subscriptions': sum(1 for subscription in detailed_subscriptions if subscription.get('protocol') == 'lambda'),
            'http_subscriptions': sum(1 for subscription in detailed_subscriptions if subscription.get('protocol') in {'http', 'https'}),
            'pending_subscriptions': sum(1 for subscription in detailed_subscriptions if subscription.get('arn') == 'PendingConfirmation'),
        },
        'topics': detailed_topics,
        'subscriptions': detailed_subscriptions,
        'supported': [
            'CreateTopic',
            'DeleteTopic',
            'ListTopics',
            'GetTopicAttributes',
            'SetTopicAttributes',
            'Subscribe',
            'Unsubscribe',
            'ListSubscriptions',
            'ListSubscriptionsByTopic',
            'GetSubscriptionAttributes',
            'SetSubscriptionAttributes',
            'ConfirmSubscription',
            'Publish',
            'PublishBatch',
            'TagResource',
            'UntagResource',
            'ListTagsForResource',
        ],
        'fanout': [
            'Floci supports SNS to SQS fan-out and delivers published messages immediately.',
            'Supported subscription protocols include sqs, lambda, http, and https.',
        ],
        'protocols': ['Query XML', 'JSON 1.0'],
    }


def _ses_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (AttributeError, BotoCoreError, KeyError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def _ses_mailbox(factory: FlociClientFactory) -> Any:
    mailbox_url = f'{factory.endpoint_url.rstrip("/")}/_aws/ses'

    try:
        with urlopen(mailbox_url, timeout=2) as response:
            body = response.read().decode('utf-8')
    except URLError as exc:
        return {'error': str(exc.reason)}
    except TimeoutError as exc:
        return {'error': str(exc)}

    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return {'raw': body}


def _ses_message_preview(message: dict[str, Any]) -> dict[str, Any]:
    body = message.get('body') or message.get('Body') or message.get('text') or message.get('html')
    preview = None

    if isinstance(body, str):
        preview = body[:160]

    return {
        'id': message.get('id') or message.get('Id') or message.get('messageId') or message.get('MessageId'),
        'from': message.get('from') or message.get('From') or message.get('source') or message.get('Source'),
        'to': message.get('to') or message.get('To') or message.get('destination') or message.get('Destination'),
        'subject': message.get('subject') or message.get('Subject'),
        'timestamp': message.get('timestamp') or message.get('Timestamp'),
        'body_preview': preview,
    }


def ses_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    ses = factory.client('ses')
    sesv2 = factory.client('sesv2')
    identities = _safe_value(lambda: _paginate(ses, 'list_identities', 'Identities'), [])
    templates = _safe_value(lambda: _paginate(ses, 'list_templates', 'TemplatesMetadata'), [])
    verified_emails = _safe_value(lambda: ses.list_verified_email_addresses().get('VerifiedEmailAddresses', []), [])
    identity_attributes: dict[str, Any] = {}

    for batch in _chunks(identities, 100):
        response = _ses_optional(
            lambda batch=batch: ses.get_identity_verification_attributes(Identities=batch).get('VerificationAttributes', {}),
            {'InvalidParameterValue'},
        )
        if isinstance(response, dict):
            identity_attributes.update(response)

    notification_attributes: dict[str, Any] = {}
    for batch in _chunks(identities, 100):
        response = _ses_optional(
            lambda batch=batch: ses.get_identity_notification_attributes(Identities=batch).get('NotificationAttributes', {}),
            {'InvalidParameterValue'},
        )
        if isinstance(response, dict):
            notification_attributes.update(response)

    dkim_attributes: dict[str, Any] = {}
    for batch in _chunks(identities, 100):
        response = _ses_optional(
            lambda batch=batch: ses.get_identity_dkim_attributes(Identities=batch).get('DkimAttributes', {}),
            {'InvalidParameterValue'},
        )
        if isinstance(response, dict):
            dkim_attributes.update(response)

    detailed_identities = [
        {
            'name': identity,
            'type': 'domain' if '@' not in identity else 'email',
            'verification': identity_attributes.get(identity),
            'notifications': notification_attributes.get(identity),
            'dkim': dkim_attributes.get(identity),
        }
        for identity in identities
    ]

    detailed_templates = [
        {
            'name': template.get('Name'),
            'created': template.get('CreatedTimestamp'),
            'details': _ses_optional(
                lambda template=template: ses.get_template(TemplateName=template.get('Name')).get('Template', {}),
                {'TemplateDoesNotExist'},
            ) if template.get('Name') else None,
        }
        for template in templates
    ]

    mailbox = _ses_mailbox(factory)
    messages: list[dict[str, Any]] = []
    if isinstance(mailbox, list):
        messages = [_ses_message_preview(message) for message in mailbox if isinstance(message, dict)]
    elif isinstance(mailbox, dict):
        raw_messages = mailbox.get('messages') or mailbox.get('Messages') or mailbox.get('items') or mailbox.get('Items') or []
        if isinstance(raw_messages, list):
            messages = [_ses_message_preview(message) for message in raw_messages if isinstance(message, dict)]

    v2_identities = _ses_optional(
        lambda: _paginate(sesv2, 'list_email_identities', 'EmailIdentities'),
        {'NotFoundException', 'BadRequestException'},
    )
    v2_templates = _ses_optional(
        lambda: _paginate(sesv2, 'list_email_templates', 'TemplatesMetadata'),
        {'NotFoundException', 'BadRequestException'},
    )

    return {
        'summary': {
            'identities': len(detailed_identities),
            'verified_email_addresses': len(verified_emails),
            'templates': len(detailed_templates),
            'captured_messages': len(messages),
            'v2_identities': len(v2_identities) if isinstance(v2_identities, list) else 0,
            'v2_templates': len(v2_templates) if isinstance(v2_templates, list) else 0,
        },
        'identities': detailed_identities,
        'verified_email_addresses': _string_items(verified_emails, 'email'),
        'templates': detailed_templates,
        'send_quota': _ses_optional(lambda: ses.get_send_quota(), set()),
        'send_statistics': _ses_optional(lambda: ses.get_send_statistics().get('SendDataPoints', []), set()),
        'account_sending_enabled': _ses_optional(lambda: ses.get_account_sending_enabled(), set()),
        'mailbox': {
            'url': f'{factory.endpoint_url.rstrip("/")}/_aws/ses',
            'messages': messages,
            'raw': mailbox if isinstance(mailbox, dict) and mailbox.get('error') else None,
        },
        'v2_identities': v2_identities,
        'v2_templates': v2_templates,
        'supported_v1': [
            'VerifyEmailIdentity',
            'VerifyEmailAddress',
            'VerifyDomainIdentity',
            'DeleteIdentity',
            'ListIdentities',
            'GetIdentityVerificationAttributes',
            'SendEmail',
            'SendRawEmail',
            'SendTemplatedEmail',
            'CreateTemplate',
            'GetTemplate',
            'UpdateTemplate',
            'DeleteTemplate',
            'ListTemplates',
            'GetSendQuota',
            'GetSendStatistics',
            'GetAccountSendingEnabled',
            'ListVerifiedEmailAddresses',
            'DeleteVerifiedEmailAddress',
            'SetIdentityNotificationTopic',
            'GetIdentityNotificationAttributes',
            'GetIdentityDkimAttributes',
        ],
        'supported_v2': [
            'CreateEmailIdentity',
            'ListEmailIdentities',
            'GetEmailIdentity',
            'DeleteEmailIdentity',
            'PutEmailIdentityDkimAttributes',
            'PutEmailIdentityFeedbackAttributes',
            'SendEmail',
            'GetAccount',
            'PutAccountSendingAttributes',
            'CreateEmailTemplate',
            'ListEmailTemplates',
            'GetEmailTemplate',
            'UpdateEmailTemplate',
            'DeleteEmailTemplate',
        ],
        'inspection_endpoints': [
            'GET /_aws/ses',
            'GET /_aws/ses?id=<message-id>',
            'DELETE /_aws/ses',
        ],
        'configuration': {
            'smtp_host': None,
            'smtp_port': 25,
            'smtp_starttls': 'DISABLED',
        },
        'environment_variables': [
            'FLOCI_SERVICES_SES_ENABLED',
            'FLOCI_SERVICES_SES_SMTP_HOST',
            'FLOCI_SERVICES_SES_SMTP_PORT',
            'FLOCI_SERVICES_SES_SMTP_USER',
            'FLOCI_SERVICES_SES_SMTP_PASS',
            'FLOCI_SERVICES_SES_SMTP_STARTTLS',
        ],
        'notes': [
            'Identity verification succeeds immediately in Floci.',
            'Emails are always stored locally and can be inspected through /_aws/ses.',
            'SMTP relay failures are logged but do not affect the SES API response.',
            'SES v1 and SES v2 share identity, template, and sent-message state.',
        ],
    }


def _cloudformation_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (AttributeError, BotoCoreError, KeyError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def cloudformation_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    cloudformation = factory.client('cloudformation')
    stack_summaries = _safe_value(lambda: _paginate(cloudformation, 'list_stacks', 'StackSummaries'), [])

    def stack_name(summary: dict[str, Any]) -> str:
        return summary.get('StackName') or summary.get('StackId') or 'Unnamed stack'

    def stack_detail(summary: dict[str, Any]) -> dict[str, Any]:
        name = stack_name(summary)
        stack = _cloudformation_optional(
            lambda: cloudformation.describe_stacks(StackName=name).get('Stacks', [{}])[0],
            {'ValidationError'},
        )
        events = _cloudformation_optional(
            lambda: _paginate(cloudformation, 'describe_stack_events', 'StackEvents', StackName=name),
            {'ValidationError'},
        )
        resources = _cloudformation_optional(
            lambda: _paginate(cloudformation, 'describe_stack_resources', 'StackResources', StackName=name),
            {'ValidationError'},
        )
        resource_summaries = _cloudformation_optional(
            lambda: _paginate(cloudformation, 'list_stack_resources', 'StackResourceSummaries', StackName=name),
            {'ValidationError'},
        )
        template = _cloudformation_optional(
            lambda: cloudformation.get_template(StackName=name),
            {'ValidationError'},
        )
        change_sets = _cloudformation_optional(
            lambda: _paginate(cloudformation, 'list_change_sets', 'Summaries', StackName=name),
            {'ValidationError'},
        )
        stack_policy = _cloudformation_optional(
            lambda: cloudformation.get_stack_policy(StackName=name),
            {'ValidationError'},
        )

        described_stack = stack if isinstance(stack, dict) and not stack.get('error') else {}

        return {
            'name': name,
            'id': summary.get('StackId') or described_stack.get('StackId'),
            'status': summary.get('StackStatus') or described_stack.get('StackStatus'),
            'status_reason': summary.get('StackStatusReason') or described_stack.get('StackStatusReason'),
            'created': summary.get('CreationTime') or described_stack.get('CreationTime'),
            'updated': summary.get('LastUpdatedTime') or described_stack.get('LastUpdatedTime'),
            'deleted': summary.get('DeletionTime') or described_stack.get('DeletionTime'),
            'description': summary.get('TemplateDescription') or described_stack.get('Description'),
            'parameters': described_stack.get('Parameters'),
            'outputs': described_stack.get('Outputs'),
            'tags': described_stack.get('Tags'),
            'capabilities': described_stack.get('Capabilities'),
            'disable_rollback': described_stack.get('DisableRollback'),
            'rollback_configuration': described_stack.get('RollbackConfiguration'),
            'resources': resources,
            'resource_summaries': resource_summaries,
            'resource_count': len(resource_summaries) if isinstance(resource_summaries, list) else 0,
            'events': events,
            'event_count': len(events) if isinstance(events, list) else 0,
            'change_sets': change_sets,
            'change_set_count': len(change_sets) if isinstance(change_sets, list) else 0,
            'template': template,
            'stack_policy': stack_policy,
            'details': stack if isinstance(stack, dict) and stack.get('error') else None,
        }

    detailed_stacks = [stack_detail(summary) for summary in stack_summaries]
    stack_sets = _cloudformation_optional(
        lambda: _paginate(cloudformation, 'list_stack_sets', 'Summaries'),
        {'ValidationError'},
    )

    detailed_stack_sets = []
    if isinstance(stack_sets, list):
        for stack_set in stack_sets:
            name = stack_set.get('StackSetName') or stack_set.get('StackSetId')
            details = _cloudformation_optional(
                lambda name=name: cloudformation.describe_stack_set(StackSetName=name).get('StackSet', {}),
                {'ValidationError'},
            )
            detailed_stack_sets.append({
                'name': name,
                'id': stack_set.get('StackSetId'),
                'status': stack_set.get('Status'),
                'description': stack_set.get('Description'),
                'created': stack_set.get('CreationTime'),
                'updated': stack_set.get('LastUpdatedTime'),
                'details': details,
            })

    return {
        'summary': {
            'stacks': len(detailed_stacks),
            'active_stacks': sum(1 for stack in detailed_stacks if not str(stack.get('status') or '').startswith('DELETE')),
            'resources': sum(stack.get('resource_count') or 0 for stack in detailed_stacks),
            'events': sum(stack.get('event_count') or 0 for stack in detailed_stacks),
            'change_sets': sum(stack.get('change_set_count') or 0 for stack in detailed_stacks),
            'stack_sets': len(detailed_stack_sets),
        },
        'stacks': detailed_stacks,
        'stack_sets': detailed_stack_sets,
        'supported': [
            'CreateStack',
            'UpdateStack',
            'DeleteStack',
            'DescribeStacks',
            'ListStacks',
            'DescribeStackEvents',
            'DescribeStackResources',
            'DescribeStackResource',
            'ListStackResources',
            'GetTemplate',
            'ValidateTemplate',
            'CreateChangeSet',
            'DescribeChangeSet',
            'ExecuteChangeSet',
            'ListChangeSets',
            'DeleteChangeSet',
            'SetStackPolicy',
            'GetStackPolicy',
            'ListStackSets',
            'DescribeStackSet',
            'CreateStackSet',
        ],
        'protocol': 'Query XML',
        'notes': [
            'CloudFormation actions use the Query XML protocol at the Floci root endpoint.',
            'Stacks can expose templates, events, resources, outputs, stack policies, and change sets.',
        ],
    }


def _ecr_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (AttributeError, BotoCoreError, KeyError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def ecr_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    ecr = factory.client('ecr')
    repositories = _safe_value(lambda: _paginate(ecr, 'describe_repositories', 'repositories'), [])

    def repository_detail(repository: dict[str, Any]) -> dict[str, Any]:
        name = repository.get('repositoryName')
        arn = repository.get('repositoryArn')
        image_ids = _ecr_optional(
            lambda: _paginate(ecr, 'list_images', 'imageIds', repositoryName=name),
            {'RepositoryNotFoundException'},
        )
        image_details = _ecr_optional(
            lambda: _paginate(ecr, 'describe_images', 'imageDetails', repositoryName=name),
            {'RepositoryNotFoundException', 'ImageNotFoundException'},
        )

        return {
            'name': name,
            'arn': arn,
            'registry_id': repository.get('registryId'),
            'uri': repository.get('repositoryUri'),
            'created': repository.get('createdAt'),
            'tag_mutability': repository.get('imageTagMutability'),
            'encryption_configuration': repository.get('encryptionConfiguration'),
            'scanning_configuration': repository.get('imageScanningConfiguration'),
            'image_count': len(image_ids) if isinstance(image_ids, list) else 0,
            'images': image_ids,
            'image_details': image_details,
            'tags': _ecr_optional(
                lambda: ecr.list_tags_for_resource(resourceArn=arn).get('tags', []),
                {'RepositoryNotFoundException', 'InvalidParameterException'},
            ) if arn else None,
            'lifecycle_policy': _ecr_optional(
                lambda: ecr.get_lifecycle_policy(repositoryName=name),
                {'LifecyclePolicyNotFoundException', 'RepositoryNotFoundException'},
            ),
            'repository_policy': _ecr_optional(
                lambda: ecr.get_repository_policy(repositoryName=name),
                {'RepositoryPolicyNotFoundException', 'RepositoryNotFoundException'},
            ),
        }

    auth_data = _ecr_optional(
        lambda: ecr.get_authorization_token().get('authorizationData', []),
        {'InvalidParameterException'},
    )
    auth_endpoints = []
    if isinstance(auth_data, list):
        auth_endpoints = [
            {
                'name': item.get('proxyEndpoint') or 'ECR proxy endpoint',
                'proxy_endpoint': item.get('proxyEndpoint'),
                'expires_at': item.get('expiresAt'),
            }
            for item in auth_data
        ]

    detailed_repositories = [repository_detail(repository) for repository in repositories]

    return {
        'summary': {
            'repositories': len(detailed_repositories),
            'images': sum(repository.get('image_count') or 0 for repository in detailed_repositories),
            'tagged_images': sum(
                1
                for repository in detailed_repositories
                for image in repository.get('images', [])
                if isinstance(image, dict) and image.get('imageTag')
            ),
            'auth_endpoints': len(auth_endpoints),
        },
        'repositories': detailed_repositories,
        'auth_endpoints': auth_endpoints,
        'supported': [
            'CreateRepository',
            'DescribeRepositories',
            'DeleteRepository',
            'GetAuthorizationToken',
            'ListImages',
            'DescribeImages',
            'BatchGetImage',
            'BatchDeleteImage',
            'PutImageTagMutability',
            'TagResource',
            'UntagResource',
            'ListTagsForResource',
            'PutLifecyclePolicy',
            'GetLifecyclePolicy',
            'DeleteLifecyclePolicy',
            'SetRepositoryPolicy',
            'GetRepositoryPolicy',
            'DeleteRepositoryPolicy',
        ],
        'admin_endpoints': ['POST /_floci/ecr/gc'],
        'configuration': {
            'registry_image': 'registry:2',
            'registry_container_name': 'floci-ecr-registry',
            'registry_base_port': 5100,
            'registry_max_port': 5199,
            'data_path': './data/ecr',
            'tls_enabled': False,
            'keep_running_on_shutdown': True,
            'uri_style': 'hostname',
        },
        'environment_variables': [
            'FLOCI_SERVICES_ECR_ENABLED',
            'FLOCI_SERVICES_ECR_REGISTRY_IMAGE',
            'FLOCI_SERVICES_ECR_REGISTRY_CONTAINER_NAME',
            'FLOCI_SERVICES_ECR_REGISTRY_BASE_PORT',
            'FLOCI_SERVICES_ECR_REGISTRY_MAX_PORT',
            'FLOCI_SERVICES_ECR_DATA_PATH',
            'FLOCI_SERVICES_ECR_KEEP_RUNNING_ON_SHUTDOWN',
            'FLOCI_SERVICES_ECR_URI_STYLE',
            'FLOCI_SERVICES_ECR_TLS_ENABLED',
        ],
        'not_implemented': [
            'Replication and pull-through cache',
            'Image scanning',
            'Image signing and notary attachments',
            'Lifecycle policy enforcement',
            'Repository policy enforcement',
            'TLS via emulated ACM',
        ],
        'notes': [
            'The control plane uses JSON 1.1 and the data plane is a real OCI Distribution v2 registry.',
            'Repository URIs use loopback hostnames like <account>.dkr.ecr.<region>.localhost:<port>/<repo> by default.',
            'GetAuthorizationToken returns a docker login token, but the dashboard only displays proxy endpoints.',
            'Deleted image blobs are reclaimed by POST /_floci/ecr/gc.',
        ],
    }


def _rds_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (AttributeError, BotoCoreError, KeyError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def rds_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    rds = factory.client('rds')
    instances = _safe_value(lambda: _paginate(rds, 'describe_db_instances', 'DBInstances'), [])
    clusters = _safe_value(lambda: _paginate(rds, 'describe_db_clusters', 'DBClusters'), [])
    parameter_groups = _safe_value(lambda: _paginate(rds, 'describe_db_parameter_groups', 'DBParameterGroups'), [])

    def instance_detail(instance: dict[str, Any]) -> dict[str, Any]:
        endpoint = instance.get('Endpoint') or {}
        return {
            'name': instance.get('DBInstanceIdentifier'),
            'arn': instance.get('DBInstanceArn'),
            'status': instance.get('DBInstanceStatus'),
            'engine': instance.get('Engine'),
            'engine_version': instance.get('EngineVersion'),
            'class': instance.get('DBInstanceClass'),
            'allocated_storage': instance.get('AllocatedStorage'),
            'storage_type': instance.get('StorageType'),
            'multi_az': instance.get('MultiAZ'),
            'publicly_accessible': instance.get('PubliclyAccessible'),
            'iam_authentication': instance.get('IAMDatabaseAuthenticationEnabled'),
            'master_username': instance.get('MasterUsername'),
            'endpoint': endpoint,
            'connect_host': endpoint.get('Address'),
            'connect_port': endpoint.get('Port'),
            'db_name': instance.get('DBName'),
            'parameter_groups': instance.get('DBParameterGroups'),
            'subnet_group': instance.get('DBSubnetGroup'),
            'security_groups': instance.get('VpcSecurityGroups'),
            'created': instance.get('InstanceCreateTime'),
            'cluster_identifier': instance.get('DBClusterIdentifier'),
            'tags': _rds_optional(
                lambda: rds.list_tags_for_resource(ResourceName=instance.get('DBInstanceArn')).get('TagList', []),
                {'DBInstanceNotFound', 'InvalidParameterValue'},
            ) if instance.get('DBInstanceArn') else None,
        }

    def cluster_detail(cluster: dict[str, Any]) -> dict[str, Any]:
        return {
            'name': cluster.get('DBClusterIdentifier'),
            'arn': cluster.get('DBClusterArn'),
            'status': cluster.get('Status'),
            'engine': cluster.get('Engine'),
            'engine_version': cluster.get('EngineVersion'),
            'database_name': cluster.get('DatabaseName'),
            'master_username': cluster.get('MasterUsername'),
            'endpoint': cluster.get('Endpoint'),
            'reader_endpoint': cluster.get('ReaderEndpoint'),
            'port': cluster.get('Port'),
            'members': cluster.get('DBClusterMembers'),
            'parameter_group': cluster.get('DBClusterParameterGroup'),
            'created': cluster.get('ClusterCreateTime'),
            'iam_authentication': cluster.get('IAMDatabaseAuthenticationEnabled'),
            'tags': _rds_optional(
                lambda: rds.list_tags_for_resource(ResourceName=cluster.get('DBClusterArn')).get('TagList', []),
                {'DBClusterNotFoundFault', 'InvalidParameterValue'},
            ) if cluster.get('DBClusterArn') else None,
        }

    def parameter_group_detail(group: dict[str, Any]) -> dict[str, Any]:
        name = group.get('DBParameterGroupName')
        parameters = _rds_optional(
            lambda: _paginate(rds, 'describe_db_parameters', 'Parameters', DBParameterGroupName=name),
            {'DBParameterGroupNotFound'},
        )

        return {
            'name': name,
            'arn': group.get('DBParameterGroupArn'),
            'family': group.get('DBParameterGroupFamily'),
            'description': group.get('Description'),
            'parameters': parameters,
            'parameter_count': len(parameters) if isinstance(parameters, list) else 0,
        }

    detailed_instances = [instance_detail(instance) for instance in instances]
    detailed_clusters = [cluster_detail(cluster) for cluster in clusters]
    detailed_parameter_groups = [parameter_group_detail(group) for group in parameter_groups]

    return {
        'summary': {
            'instances': len(detailed_instances),
            'clusters': len(detailed_clusters),
            'parameter_groups': len(detailed_parameter_groups),
            'available_instances': sum(1 for instance in detailed_instances if instance.get('status') == 'available'),
            'proxy_endpoints': sum(1 for instance in detailed_instances if instance.get('connect_port')),
        },
        'instances': detailed_instances,
        'clusters': detailed_clusters,
        'parameter_groups': detailed_parameter_groups,
        'supported': [
            'CreateDBInstance',
            'DescribeDBInstances',
            'DeleteDBInstance',
            'ModifyDBInstance',
            'RebootDBInstance',
            'CreateDBCluster',
            'DescribeDBClusters',
            'DeleteDBCluster',
            'ModifyDBCluster',
            'CreateDBParameterGroup',
            'DescribeDBParameterGroups',
            'DeleteDBParameterGroup',
            'ModifyDBParameterGroup',
            'DescribeDBParameters',
        ],
        'supported_engines': [
            {'name': 'postgres', 'default_image': 'postgres:16-alpine'},
            {'name': 'mysql', 'default_image': 'mysql:8.0'},
            {'name': 'mariadb', 'default_image': 'mariadb:11'},
        ],
        'configuration': {
            'proxy_base_port': 7001,
            'proxy_max_port': 7099,
            'default_postgres_image': 'postgres:16-alpine',
            'default_mysql_image': 'mysql:8.0',
            'default_mariadb_image': 'mariadb:11',
        },
        'environment_variables': [
            'FLOCI_SERVICES_RDS_ENABLED',
            'FLOCI_SERVICES_RDS_PROXY_BASE_PORT',
            'FLOCI_SERVICES_RDS_PROXY_MAX_PORT',
            'FLOCI_SERVICES_RDS_DEFAULT_POSTGRES_IMAGE',
            'FLOCI_SERVICES_RDS_DEFAULT_MYSQL_IMAGE',
            'FLOCI_SERVICES_RDS_DEFAULT_MARIADB_IMAGE',
            'FLOCI_SERVICES_DOCKER_NETWORK',
            'FLOCI_STORAGE_SERVICES_RDS_MODE',
        ],
        'notes': [
            'RDS management uses Query XML and the data plane uses PostgreSQL or MySQL wire protocol.',
            'Floci manages real PostgreSQL, MySQL, and MariaDB Docker containers.',
            'Instances expose local TCP proxy endpoints on localhost:<proxy-port>.',
            'IAM database authentication is supported when enabled at instance creation time.',
        ],
    }


def _acm_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (AttributeError, BotoCoreError, KeyError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def acm_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    acm = factory.client('acm')
    certificates = _safe_value(lambda: _paginate(acm, 'list_certificates', 'CertificateSummaryList'), [])

    def certificate_detail(summary: dict[str, Any]) -> dict[str, Any]:
        arn = summary.get('CertificateArn')
        details = _acm_optional(
            lambda: acm.describe_certificate(CertificateArn=arn).get('Certificate', {}),
            {'ResourceNotFoundException'},
        )
        cert_pem = _acm_optional(
            lambda: acm.get_certificate(CertificateArn=arn),
            {'ResourceNotFoundException', 'RequestInProgressException'},
        )
        described = details if isinstance(details, dict) and not details.get('error') else {}
        pem = cert_pem if isinstance(cert_pem, dict) and not cert_pem.get('error') else {}

        return {
            'name': summary.get('DomainName') or described.get('DomainName') or arn,
            'arn': arn,
            'domain_name': summary.get('DomainName') or described.get('DomainName'),
            'status': summary.get('Status') or described.get('Status'),
            'type': summary.get('Type') or described.get('Type'),
            'key_algorithm': summary.get('KeyAlgorithm') or described.get('KeyAlgorithm'),
            'created': described.get('CreatedAt'),
            'issued_at': described.get('IssuedAt'),
            'not_before': described.get('NotBefore'),
            'not_after': described.get('NotAfter'),
            'renewal_eligibility': described.get('RenewalEligibility'),
            'subject_alternative_names': described.get('SubjectAlternativeNames'),
            'domain_validation_options': described.get('DomainValidationOptions'),
            'in_use_by': described.get('InUseBy'),
            'signature_algorithm': described.get('SignatureAlgorithm'),
            'has_certificate_pem': bool(pem.get('Certificate')),
            'has_certificate_chain': bool(pem.get('CertificateChain')),
            'tags': _acm_optional(
                lambda: acm.list_tags_for_certificate(CertificateArn=arn).get('Tags', []),
                {'ResourceNotFoundException'},
            ),
            'details': details if isinstance(details, dict) and details.get('error') else None,
            'certificate_error': cert_pem if isinstance(cert_pem, dict) and cert_pem.get('error') else None,
        }

    detailed_certificates = [certificate_detail(certificate) for certificate in certificates]
    account_configuration = _acm_optional(
        lambda: acm.get_account_configuration(),
        {'AccessDeniedException'},
    )

    return {
        'summary': {
            'certificates': len(detailed_certificates),
            'issued': sum(1 for certificate in detailed_certificates if certificate.get('status') == 'ISSUED'),
            'amazon_issued': sum(1 for certificate in detailed_certificates if certificate.get('type') == 'AMAZON_ISSUED'),
            'private': sum(1 for certificate in detailed_certificates if certificate.get('type') == 'PRIVATE'),
        },
        'certificates': detailed_certificates,
        'account_configuration': account_configuration,
        'supported': [
            'RequestCertificate',
            'DescribeCertificate',
            'GetCertificate',
            'ListCertificates',
            'DeleteCertificate',
            'AddTagsToCertificate',
            'RemoveTagsFromCertificate',
            'ListTagsForCertificate',
            'ExportCertificate',
            'GetAccountConfiguration',
            'PutAccountConfiguration',
            'RenewCertificate',
        ],
        'key_algorithms': [
            'RSA_2048',
            'RSA_3072',
            'RSA_4096',
            'EC_prime256v1',
            'EC_secp384r1',
            'EC_secp521r1',
        ],
        'certificate_types': [
            'AMAZON_ISSUED',
            'PRIVATE',
        ],
        'notes': [
            'Floci immediately issues requested certificates for local emulation.',
            'Certificates use real RSA or EC keys and valid X.509 structure.',
            'Only PRIVATE certificates can be exported with an encrypted private key.',
            'The dashboard intentionally shows PEM availability instead of dumping certificate material.',
        ],
    }


def _stepfunctions_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (AttributeError, BotoCoreError, KeyError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def stepfunctions_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    stepfunctions = factory.client('stepfunctions')
    state_machines = _safe_value(lambda: _paginate(stepfunctions, 'list_state_machines', 'stateMachines'), [])

    def execution_detail(execution: dict[str, Any]) -> dict[str, Any]:
        arn = execution.get('executionArn')
        details = _stepfunctions_optional(
            lambda: stepfunctions.describe_execution(executionArn=arn),
            {'ExecutionDoesNotExist'},
        )
        history = _stepfunctions_optional(
            lambda: stepfunctions.get_execution_history(executionArn=arn, maxResults=25).get('events', []),
            {'ExecutionDoesNotExist'},
        )
        described = details if isinstance(details, dict) and not details.get('error') else {}

        return {
            'name': execution.get('name') or described.get('name') or arn,
            'arn': arn,
            'state_machine_arn': execution.get('stateMachineArn') or described.get('stateMachineArn'),
            'status': execution.get('status') or described.get('status'),
            'started': execution.get('startDate') or described.get('startDate'),
            'stopped': execution.get('stopDate') or described.get('stopDate'),
            'input': described.get('input'),
            'output': described.get('output'),
            'trace_header': described.get('traceHeader'),
            'history': history,
            'history_event_count': len(history) if isinstance(history, list) else 0,
            'details': details if isinstance(details, dict) and details.get('error') else None,
        }

    def state_machine_detail(machine: dict[str, Any]) -> dict[str, Any]:
        arn = machine.get('stateMachineArn')
        details = _stepfunctions_optional(
            lambda: stepfunctions.describe_state_machine(stateMachineArn=arn),
            {'StateMachineDoesNotExist'},
        )
        executions = _stepfunctions_optional(
            lambda: _paginate(stepfunctions, 'list_executions', 'executions', stateMachineArn=arn),
            {'StateMachineDoesNotExist'},
        )
        described = details if isinstance(details, dict) and not details.get('error') else {}
        execution_details = [
            execution_detail(execution)
            for execution in executions
        ] if isinstance(executions, list) else []

        return {
            'name': machine.get('name') or described.get('name') or arn,
            'arn': arn,
            'type': machine.get('type') or described.get('type'),
            'status': machine.get('status') or described.get('status'),
            'created': machine.get('creationDate') or described.get('creationDate'),
            'role_arn': described.get('roleArn'),
            'definition': described.get('definition'),
            'logging_configuration': described.get('loggingConfiguration'),
            'tracing_configuration': described.get('tracingConfiguration'),
            'executions': execution_details,
            'execution_count': len(execution_details),
            'running_executions': sum(1 for execution in execution_details if execution.get('status') == 'RUNNING'),
            'succeeded_executions': sum(1 for execution in execution_details if execution.get('status') == 'SUCCEEDED'),
            'failed_executions': sum(1 for execution in execution_details if execution.get('status') == 'FAILED'),
            'details': details if isinstance(details, dict) and details.get('error') else None,
        }

    detailed_state_machines = [state_machine_detail(machine) for machine in state_machines]

    return {
        'summary': {
            'state_machines': len(detailed_state_machines),
            'executions': sum(machine.get('execution_count') or 0 for machine in detailed_state_machines),
            'running': sum(machine.get('running_executions') or 0 for machine in detailed_state_machines),
            'succeeded': sum(machine.get('succeeded_executions') or 0 for machine in detailed_state_machines),
            'failed': sum(machine.get('failed_executions') or 0 for machine in detailed_state_machines),
        },
        'state_machines': detailed_state_machines,
        'supported': [
            'CreateStateMachine',
            'DescribeStateMachine',
            'ListStateMachines',
            'DeleteStateMachine',
            'StartExecution',
            'DescribeExecution',
            'ListExecutions',
            'StopExecution',
            'GetExecutionHistory',
            'SendTaskSuccess',
            'SendTaskFailure',
            'SendTaskHeartbeat',
        ],
        'protocol': 'JSON 1.1',
        'notes': [
            'Floci exposes Step Functions through the AmazonStatesService JSON 1.1 target.',
            'Execution histories are previewed with a small event limit on the dashboard.',
            'Task token callbacks are available for waitForTaskToken workflows.',
        ],
    }


def _scheduler_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (AttributeError, BotoCoreError, KeyError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def scheduler_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    scheduler = factory.client('scheduler')
    groups = _safe_value(lambda: _paginate(scheduler, 'list_schedule_groups', 'ScheduleGroups'), [])
    schedules = _safe_value(lambda: _paginate(scheduler, 'list_schedules', 'Schedules'), [])

    def group_name(group: dict[str, Any]) -> str:
        return group.get('Name') or group.get('Arn') or 'default'

    def group_detail(group: dict[str, Any]) -> dict[str, Any]:
        name = group_name(group)
        details = _scheduler_optional(
            lambda: scheduler.get_schedule_group(Name=name),
            {'ResourceNotFoundException'},
        )
        group_schedules = _scheduler_optional(
            lambda: _paginate(scheduler, 'list_schedules', 'Schedules', GroupName=name),
            {'ResourceNotFoundException'},
        )

        return {
            'name': name,
            'arn': group.get('Arn') or (details.get('Arn') if isinstance(details, dict) else None),
            'state': group.get('State') or (details.get('State') if isinstance(details, dict) else None),
            'created': group.get('CreationDate') or (details.get('CreationDate') if isinstance(details, dict) else None),
            'last_modified': group.get('LastModificationDate') or (details.get('LastModificationDate') if isinstance(details, dict) else None),
            'schedule_count': len(group_schedules) if isinstance(group_schedules, list) else 0,
            'schedules': group_schedules,
            'details': details if isinstance(details, dict) and details.get('error') else None,
        }

    def schedule_detail(schedule: dict[str, Any]) -> dict[str, Any]:
        name = schedule.get('Name')
        group = schedule.get('GroupName') or 'default'
        details = _scheduler_optional(
            lambda: scheduler.get_schedule(Name=name, GroupName=group),
            {'ResourceNotFoundException'},
        )
        described = details if isinstance(details, dict) and not details.get('error') else {}

        return {
            'name': name,
            'arn': schedule.get('Arn') or described.get('Arn'),
            'group': group,
            'state': schedule.get('State') or described.get('State'),
            'expression': schedule.get('ScheduleExpression') or described.get('ScheduleExpression'),
            'timezone': described.get('ScheduleExpressionTimezone'),
            'start_date': described.get('StartDate'),
            'end_date': described.get('EndDate'),
            'action_after_completion': described.get('ActionAfterCompletion'),
            'flexible_time_window': described.get('FlexibleTimeWindow'),
            'target': described.get('Target') or schedule.get('Target'),
            'created': schedule.get('CreationDate') or described.get('CreationDate'),
            'last_modified': schedule.get('LastModificationDate') or described.get('LastModificationDate'),
            'description': described.get('Description'),
            'kms_key_arn': described.get('KmsKeyArn'),
            'details': details if isinstance(details, dict) and details.get('error') else None,
        }

    detailed_groups = [group_detail(group) for group in groups]
    detailed_schedules = [schedule_detail(schedule) for schedule in schedules]

    return {
        'summary': {
            'groups': len(detailed_groups),
            'schedules': len(detailed_schedules),
            'enabled': sum(1 for schedule in detailed_schedules if schedule.get('state') == 'ENABLED'),
            'disabled': sum(1 for schedule in detailed_schedules if schedule.get('state') == 'DISABLED'),
        },
        'groups': detailed_groups,
        'schedules': detailed_schedules,
        'supported': [
            'CreateScheduleGroup',
            'GetScheduleGroup',
            'DeleteScheduleGroup',
            'ListScheduleGroups',
            'CreateSchedule',
            'GetSchedule',
            'UpdateSchedule',
            'DeleteSchedule',
            'ListSchedules',
        ],
        'supported_expressions': [
            'at(YYYY-MM-DDTHH:mm:ss)',
            'rate(N minutes|hours|days|weeks)',
            'cron(minute hour day-of-month month day-of-week year)',
        ],
        'supported_targets': [
            'SQS',
            'Lambda',
            'SNS',
            'EventBridge PutEvents',
        ],
        'not_supported': [
            'TagResource, UntagResource, ListTagsForResource',
            'RetryPolicy and DeadLetterConfig enforcement',
            'FlexibleTimeWindow jitter',
            'NextToken-based pagination',
        ],
        'configuration': {
            'invocation_enabled': True,
            'tick_interval_seconds': 10,
        },
        'notes': [
            'The default schedule group is created automatically on first access.',
            'Schedules without an explicit group are placed in the default group.',
            'The default group cannot be deleted.',
            'State=DISABLED schedules and schedules outside StartDate/EndDate are skipped.',
        ],
    }


def _glue_optional(loader: Callable[[], Any], empty_codes: set[str]) -> Any:
    try:
        return _clean_response(loader())
    except ClientError as exc:
        if _error_code(exc) in empty_codes:
            return None
        return {'error': str(exc)}
    except (AttributeError, BotoCoreError, KeyError, ValueError, json.JSONDecodeError) as exc:
        return {'error': str(exc)}


def _glue_reader_for_table(table: dict[str, Any]) -> str:
    storage = table.get('StorageDescriptor') or {}
    input_format = (storage.get('InputFormat') or '').lower()
    serde = ((storage.get('SerdeInfo') or {}).get('SerializationLibrary') or '').lower()
    haystack = f'{input_format} {serde}'

    if 'parquet' in haystack:
        return 'read_parquet'

    if 'json' in haystack or 'hive' in input_format:
        return 'read_json_auto'

    return 'read_csv_auto'


def glue_inventory() -> dict[str, Any]:
    factory = FlociClientFactory()
    glue = factory.client('glue')
    databases = _safe_value(lambda: _paginate(glue, 'get_databases', 'DatabaseList'), [])

    def table_detail(database_name: str, table: dict[str, Any]) -> dict[str, Any]:
        table_name = table.get('Name')
        storage = table.get('StorageDescriptor') or {}
        partitions = _glue_optional(
            lambda: _paginate(glue, 'get_partitions', 'Partitions', DatabaseName=database_name, TableName=table_name),
            {'EntityNotFoundException'},
        )

        return {
            'name': table_name,
            'database': database_name,
            'type': table.get('TableType'),
            'created': table.get('CreateTime'),
            'updated': table.get('UpdateTime'),
            'owner': table.get('Owner'),
            'retention': table.get('Retention'),
            'location': storage.get('Location'),
            'input_format': storage.get('InputFormat'),
            'output_format': storage.get('OutputFormat'),
            'serde': storage.get('SerdeInfo'),
            'columns': storage.get('Columns'),
            'partition_keys': table.get('PartitionKeys'),
            'parameters': table.get('Parameters'),
            'duckdb_reader': _glue_reader_for_table(table),
            'partition_count': len(partitions) if isinstance(partitions, list) else 0,
            'partitions': partitions,
        }

    def database_detail(database: dict[str, Any]) -> dict[str, Any]:
        name = database.get('Name')
        details = _glue_optional(
            lambda: glue.get_database(Name=name).get('Database', {}),
            {'EntityNotFoundException'},
        )
        tables = _glue_optional(
            lambda: _paginate(glue, 'get_tables', 'TableList', DatabaseName=name),
            {'EntityNotFoundException'},
        )
        table_details = [
            table_detail(name, table)
            for table in tables
        ] if isinstance(tables, list) else []

        return {
            'name': name,
            'description': database.get('Description') or (details.get('Description') if isinstance(details, dict) else None),
            'location_uri': database.get('LocationUri') or (details.get('LocationUri') if isinstance(details, dict) else None),
            'parameters': database.get('Parameters') or (details.get('Parameters') if isinstance(details, dict) else None),
            'created': database.get('CreateTime') or (details.get('CreateTime') if isinstance(details, dict) else None),
            'tables': table_details,
            'table_count': len(table_details),
            'partition_count': sum(table.get('partition_count') or 0 for table in table_details),
            'details': details if isinstance(details, dict) and details.get('error') else None,
        }

    detailed_databases = [database_detail(database) for database in databases]

    return {
        'summary': {
            'databases': len(detailed_databases),
            'tables': sum(database.get('table_count') or 0 for database in detailed_databases),
            'partitions': sum(database.get('partition_count') or 0 for database in detailed_databases),
        },
        'databases': detailed_databases,
        'supported': {
            'Databases': ['CreateDatabase', 'GetDatabase', 'GetDatabases', 'DeleteDatabase', 'UpdateDatabase'],
            'Tables': ['CreateTable', 'GetTable', 'GetTables', 'DeleteTable', 'UpdateTable'],
            'Partitions': ['CreatePartition', 'BatchCreatePartition', 'GetPartition', 'GetPartitions', 'DeletePartition'],
        },
        'athena_integration': [
            'Athena reads Glue tables for the target database and creates DuckDB views over S3 objects.',
            'The reader function is inferred from StorageDescriptor.InputFormat and SerDe serialization library.',
        ],
        'format_inference': {
            'parquet': 'read_parquet',
            'json_or_hive': 'read_json_auto',
            'default': 'read_csv_auto',
        },
    }


def list_resources() -> list[ResourceResult]:
    factory = FlociClientFactory()

    def iam_users() -> list[dict[str, Any]]:
        return [
            {
                'name': user.get('UserName'),
                'arn': user.get('Arn'),
                'created': user.get('CreateDate'),
            }
            for user in factory.client('iam').get_paginator('list_users').paginate().build_full_result().get('Users', [])
        ]

    def iam_roles() -> list[dict[str, Any]]:
        return [
            {
                'name': role.get('RoleName'),
                'arn': role.get('Arn'),
                'created': role.get('CreateDate'),
            }
            for role in factory.client('iam').get_paginator('list_roles').paginate().build_full_result().get('Roles', [])
        ]

    def s3_buckets() -> list[dict[str, Any]]:
        return [
            {
                'name': bucket.get('Name'),
                'created': bucket.get('CreationDate'),
            }
            for bucket in factory.client('s3').list_buckets().get('Buckets', [])
        ]

    def sqs_queues() -> list[dict[str, Any]]:
        urls = factory.client('sqs').list_queues().get('QueueUrls', [])
        return _string_items(urls, 'url')

    def dynamodb_tables() -> list[dict[str, Any]]:
        names = factory.client('dynamodb').get_paginator('list_tables').paginate().build_full_result().get('TableNames', [])
        return _string_items(names, 'name')

    def sns_topics() -> list[dict[str, Any]]:
        return [
            {'arn': topic.get('TopicArn')}
            for topic in factory.client('sns').get_paginator('list_topics').paginate().build_full_result().get('Topics', [])
        ]

    def ses_resources() -> list[dict[str, Any]]:
        ses = factory.client('ses')
        resources = [
            {'type': 'identity', 'name': identity}
            for identity in _safe_value(lambda: _paginate(ses, 'list_identities', 'Identities'), [])
        ]
        resources.extend(
            {
                'type': 'template',
                'name': template.get('Name'),
            }
            for template in _safe_value(lambda: _paginate(ses, 'list_templates', 'TemplatesMetadata'), [])
        )
        mailbox = _ses_mailbox(factory)
        if isinstance(mailbox, list):
            resources.extend(
                {
                    'type': 'captured_message',
                    'id': message.get('id') or message.get('Id') or message.get('messageId') or message.get('MessageId'),
                }
                for message in mailbox
                if isinstance(message, dict)
            )
        elif isinstance(mailbox, dict):
            messages = mailbox.get('messages') or mailbox.get('Messages') or mailbox.get('items') or mailbox.get('Items') or []
            if isinstance(messages, list):
                resources.extend(
                    {
                        'type': 'captured_message',
                        'id': message.get('id') or message.get('Id') or message.get('messageId') or message.get('MessageId'),
                    }
                    for message in messages
                    if isinstance(message, dict)
                )
        return resources

    def cloudformation_resources() -> list[dict[str, Any]]:
        cloudformation = factory.client('cloudformation')
        resources = [
            {
                'type': 'stack',
                'name': stack.get('StackName'),
                'id': stack.get('StackId'),
                'status': stack.get('StackStatus'),
            }
            for stack in _safe_value(lambda: _paginate(cloudformation, 'list_stacks', 'StackSummaries'), [])
        ]
        stack_sets = _cloudformation_optional(
            lambda: _paginate(cloudformation, 'list_stack_sets', 'Summaries'),
            {'ValidationError'},
        )
        if isinstance(stack_sets, list):
            resources.extend(
                {
                    'type': 'stack_set',
                    'name': stack_set.get('StackSetName'),
                    'id': stack_set.get('StackSetId'),
                    'status': stack_set.get('Status'),
                }
                for stack_set in stack_sets
            )
        return resources

    def ecr_resources() -> list[dict[str, Any]]:
        ecr = factory.client('ecr')
        resources = [
            {
                'type': 'repository',
                'name': repository.get('repositoryName'),
                'arn': repository.get('repositoryArn'),
                'uri': repository.get('repositoryUri'),
            }
            for repository in _safe_value(lambda: _paginate(ecr, 'describe_repositories', 'repositories'), [])
        ]

        for repository in list(resources):
            name = repository.get('name')
            resources.extend(
                {
                    'type': 'image',
                    'repository': name,
                    'tag': image.get('imageTag'),
                    'digest': image.get('imageDigest'),
                }
                for image in _safe_value(lambda name=name: _paginate(ecr, 'list_images', 'imageIds', repositoryName=name), [])
            )

        return resources

    def rds_resources() -> list[dict[str, Any]]:
        rds = factory.client('rds')
        resources = [
            {
                'type': 'instance',
                'name': instance.get('DBInstanceIdentifier'),
                'arn': instance.get('DBInstanceArn'),
                'status': instance.get('DBInstanceStatus'),
                'endpoint': instance.get('Endpoint'),
            }
            for instance in _safe_value(lambda: _paginate(rds, 'describe_db_instances', 'DBInstances'), [])
        ]
        resources.extend(
            {
                'type': 'cluster',
                'name': cluster.get('DBClusterIdentifier'),
                'arn': cluster.get('DBClusterArn'),
                'status': cluster.get('Status'),
            }
            for cluster in _safe_value(lambda: _paginate(rds, 'describe_db_clusters', 'DBClusters'), [])
        )
        resources.extend(
            {
                'type': 'parameter_group',
                'name': group.get('DBParameterGroupName'),
                'arn': group.get('DBParameterGroupArn'),
            }
            for group in _safe_value(lambda: _paginate(rds, 'describe_db_parameter_groups', 'DBParameterGroups'), [])
        )
        return resources

    def acm_resources() -> list[dict[str, Any]]:
        return [
            {
                'type': 'certificate',
                'arn': certificate.get('CertificateArn'),
                'domain': certificate.get('DomainName'),
                'status': certificate.get('Status'),
                'key_algorithm': certificate.get('KeyAlgorithm'),
            }
            for certificate in _safe_value(lambda: _paginate(factory.client('acm'), 'list_certificates', 'CertificateSummaryList'), [])
        ]

    def stepfunctions_resources() -> list[dict[str, Any]]:
        stepfunctions = factory.client('stepfunctions')
        resources = [
            {
                'type': 'state_machine',
                'name': machine.get('name'),
                'arn': machine.get('stateMachineArn'),
                'type_name': machine.get('type'),
            }
            for machine in _safe_value(lambda: _paginate(stepfunctions, 'list_state_machines', 'stateMachines'), [])
        ]
        for machine in list(resources):
            arn = machine.get('arn')
            resources.extend(
                {
                    'type': 'execution',
                    'state_machine': arn,
                    'name': execution.get('name'),
                    'arn': execution.get('executionArn'),
                    'status': execution.get('status'),
                }
                for execution in _safe_value(
                    lambda arn=arn: _paginate(stepfunctions, 'list_executions', 'executions', stateMachineArn=arn),
                    [],
                )
            )
        return resources

    def scheduler_resources() -> list[dict[str, Any]]:
        scheduler = factory.client('scheduler')
        resources = [
            {
                'type': 'schedule_group',
                'name': group.get('Name'),
                'arn': group.get('Arn'),
                'state': group.get('State'),
            }
            for group in _safe_value(lambda: _paginate(scheduler, 'list_schedule_groups', 'ScheduleGroups'), [])
        ]
        resources.extend(
            {
                'type': 'schedule',
                'name': schedule.get('Name'),
                'arn': schedule.get('Arn'),
                'group': schedule.get('GroupName'),
                'state': schedule.get('State'),
                'expression': schedule.get('ScheduleExpression'),
            }
            for schedule in _safe_value(lambda: _paginate(scheduler, 'list_schedules', 'Schedules'), [])
        )
        return resources

    def glue_resources() -> list[dict[str, Any]]:
        glue = factory.client('glue')
        resources = [
            {
                'type': 'database',
                'name': database.get('Name'),
            }
            for database in _safe_value(lambda: _paginate(glue, 'get_databases', 'DatabaseList'), [])
        ]
        for database in list(resources):
            database_name = database.get('name')
            tables = _safe_value(lambda database_name=database_name: _paginate(glue, 'get_tables', 'TableList', DatabaseName=database_name), [])
            resources.extend(
                {
                    'type': 'table',
                    'database': database_name,
                    'name': table.get('Name'),
                    'location': (table.get('StorageDescriptor') or {}).get('Location'),
                }
                for table in tables
            )
            for table in tables:
                table_name = table.get('Name')
                resources.extend(
                    {
                        'type': 'partition',
                        'database': database_name,
                        'table': table_name,
                        'values': partition.get('Values'),
                    }
                    for partition in _safe_value(
                        lambda database_name=database_name, table_name=table_name: _paginate(
                            glue,
                            'get_partitions',
                            'Partitions',
                            DatabaseName=database_name,
                            TableName=table_name,
                        ),
                        [],
                    )
                )
        return resources

    def lambda_functions() -> list[dict[str, Any]]:
        return [
            {
                'name': function.get('FunctionName'),
                'runtime': function.get('Runtime'),
                'arn': function.get('FunctionArn'),
            }
            for function in factory.client('lambda').get_paginator('list_functions').paginate().build_full_result().get('Functions', [])
        ]

    def kms_keys() -> list[dict[str, Any]]:
        return [
            {
                'id': key.get('KeyId'),
                'arn': key.get('KeyArn'),
            }
            for key in factory.client('kms').get_paginator('list_keys').paginate().build_full_result().get('Keys', [])
        ]

    def secrets() -> list[dict[str, Any]]:
        return [
            {
                'name': secret.get('Name'),
                'arn': secret.get('ARN'),
            }
            for secret in factory.client('secretsmanager').get_paginator('list_secrets').paginate().build_full_result().get('SecretList', [])
        ]

    def log_groups() -> list[dict[str, Any]]:
        return [
            {
                'name': group.get('logGroupName'),
                'arn': group.get('arn'),
                'retention': group.get('retentionInDays'),
            }
            for group in factory.client('logs').get_paginator('describe_log_groups').paginate().build_full_result().get('logGroups', [])
        ]

    def cloudwatch_metrics() -> list[dict[str, Any]]:
        cloudwatch = factory.client('cloudwatch')
        resources = [
            {
                'type': 'metric',
                'namespace': metric.get('Namespace'),
                'name': metric.get('MetricName'),
                'dimensions': metric.get('Dimensions'),
            }
            for metric in _safe_value(lambda: _paginate(cloudwatch, 'list_metrics', 'Metrics'), [])
        ]
        resources.extend(
            {
                'type': 'alarm',
                'name': alarm.get('AlarmName'),
                'arn': alarm.get('AlarmArn'),
                'state': alarm.get('StateValue'),
            }
            for alarm in _safe_value(lambda: _paginate(cloudwatch, 'describe_alarms', 'MetricAlarms'), [])
        )
        return resources

    def cognito_resources() -> list[dict[str, Any]]:
        cognito = factory.client('cognito-idp')
        resources: list[dict[str, Any]] = []
        pools = _safe_value(lambda: cognito.list_user_pools(MaxResults=60).get('UserPools', []), [])

        for pool in pools:
            pool_id = pool.get('Id')
            resources.append({
                'type': 'user_pool',
                'id': pool_id,
                'name': pool.get('Name'),
            })
            resources.extend(
                {
                    'type': 'user_pool_client',
                    'pool_id': pool_id,
                    'id': client.get('ClientId'),
                    'name': client.get('ClientName'),
                }
                for client in _safe_value(lambda pool_id=pool_id: cognito.list_user_pool_clients(UserPoolId=pool_id, MaxResults=60).get('UserPoolClients', []), [])
            )
            resources.extend(
                {
                    'type': 'user',
                    'pool_id': pool_id,
                    'name': user.get('Username'),
                    'status': user.get('UserStatus'),
                }
                for user in _safe_value(lambda pool_id=pool_id: cognito.list_users(UserPoolId=pool_id, Limit=60).get('Users', []), [])
            )
            resources.extend(
                {
                    'type': 'group',
                    'pool_id': pool_id,
                    'name': group.get('GroupName'),
                }
                for group in _safe_value(lambda pool_id=pool_id: cognito.list_groups(UserPoolId=pool_id, Limit=60).get('Groups', []), [])
            )

        return resources

    def eventbridge_resources() -> list[dict[str, Any]]:
        events = factory.client('events')
        resources: list[dict[str, Any]] = []
        buses = _safe_value(lambda: _paginate(events, 'list_event_buses', 'EventBuses'), [])

        if not buses:
            buses = [{'Name': 'default'}]

        for bus in buses:
            name = bus.get('Name') or 'default'
            resources.append({
                'type': 'event_bus',
                'name': name,
                'arn': bus.get('Arn'),
            })
            rules = _safe_value(lambda name=name: _paginate(events, 'list_rules', 'Rules', EventBusName=name), [])
            resources.extend(
                {
                    'type': 'rule',
                    'event_bus': name,
                    'name': rule.get('Name'),
                    'arn': rule.get('Arn'),
                    'state': rule.get('State'),
                }
                for rule in rules
            )
            for rule in rules:
                rule_name = rule.get('Name')
                resources.extend(
                    {
                        'type': 'target',
                        'event_bus': name,
                        'rule': rule_name,
                        'id': target.get('Id'),
                        'arn': target.get('Arn'),
                    }
                    for target in _safe_value(
                        lambda name=name, rule_name=rule_name: _paginate(
                            events,
                            'list_targets_by_rule',
                            'Targets',
                            Rule=rule_name,
                            EventBusName=name,
                        ),
                        [],
                    )
                )

        return resources

    def apigateway_apis() -> list[dict[str, Any]]:
        apigateway = factory.client('apigateway')
        apigatewayv2 = factory.client('apigatewayv2')
        apis = [
            {
                'type': 'REST',
                'id': api.get('id'),
                'name': api.get('name'),
            }
            for api in _safe_value(lambda: _paginate(apigateway, 'get_rest_apis', 'items'), [])
        ]
        apis.extend(
            {
                'type': api.get('ProtocolType') or 'HTTP',
                'id': api.get('ApiId'),
                'name': api.get('Name'),
            }
            for api in _safe_value(lambda: _paginate(apigatewayv2, 'get_apis', 'Items'), [])
        )
        return apis

    def ecs_resources() -> list[dict[str, Any]]:
        ecs = factory.client('ecs')
        resources: list[dict[str, Any]] = []
        clusters = _safe_value(lambda: _paginate(ecs, 'list_clusters', 'clusterArns'), [])
        task_definitions = _safe_value(lambda: _paginate(ecs, 'list_task_definitions', 'taskDefinitionArns'), [])
        resources.extend({'type': 'cluster', 'arn': arn} for arn in clusters)
        resources.extend({'type': 'task_definition', 'arn': arn} for arn in task_definitions)

        for cluster in clusters:
            tasks = _safe_value(lambda cluster=cluster: _paginate(ecs, 'list_tasks', 'taskArns', cluster=cluster), [])
            services = _safe_value(lambda cluster=cluster: _paginate(ecs, 'list_services', 'serviceArns', cluster=cluster), [])
            container_instances = _safe_value(lambda cluster=cluster: _paginate(ecs, 'list_container_instances', 'containerInstanceArns', cluster=cluster), [])
            resources.extend({'type': 'task', 'cluster': cluster, 'arn': arn} for arn in tasks)
            resources.extend({'type': 'service', 'cluster': cluster, 'arn': arn} for arn in services)
            resources.extend({'type': 'container_instance', 'cluster': cluster, 'arn': arn} for arn in container_instances)

        return resources

    def appconfig_resources() -> list[dict[str, Any]]:
        appconfig = factory.client('appconfig')
        resources: list[dict[str, Any]] = []
        applications = _safe_value(lambda: _paginate(appconfig, 'list_applications', 'Items'), [])

        for application in applications:
            application_id = application.get('Id')
            resources.append({
                'type': 'application',
                'id': application_id,
                'name': application.get('Name'),
            })

            environments = _safe_value(
                lambda application_id=application_id: _paginate(
                    appconfig,
                    'list_environments',
                    'Items',
                    ApplicationId=application_id,
                ),
                [],
            )
            resources.extend(
                {
                    'type': 'environment',
                    'application_id': application_id,
                    'id': environment.get('Id'),
                    'name': environment.get('Name'),
                    'state': environment.get('State'),
                }
                for environment in environments
            )

            profiles = _safe_value(
                lambda application_id=application_id: _paginate(
                    appconfig,
                    'list_configuration_profiles',
                    'Items',
                    ApplicationId=application_id,
                ),
                [],
            )
            resources.extend(
                {
                    'type': 'configuration_profile',
                    'application_id': application_id,
                    'id': profile.get('Id'),
                    'name': profile.get('Name'),
                    'location_uri': profile.get('LocationUri'),
                }
                for profile in profiles
            )

            for profile in profiles:
                profile_id = profile.get('Id')
                resources.extend(
                    {
                        'type': 'hosted_configuration_version',
                        'application_id': application_id,
                        'configuration_profile_id': profile_id,
                        'version_number': version.get('VersionNumber'),
                        'content_type': version.get('ContentType'),
                    }
                    for version in _safe_value(
                        lambda application_id=application_id, profile_id=profile_id: _paginate(
                            appconfig,
                            'list_hosted_configuration_versions',
                            'Items',
                            ApplicationId=application_id,
                            ConfigurationProfileId=profile_id,
                        ),
                        [],
                    )
                )

            for environment in environments:
                environment_id = environment.get('Id')
                resources.extend(
                    {
                        'type': 'deployment',
                        'application_id': application_id,
                        'environment_id': environment_id,
                        'deployment_number': deployment.get('DeploymentNumber'),
                        'state': deployment.get('State'),
                    }
                    for deployment in _safe_value(
                        lambda application_id=application_id, environment_id=environment_id: _paginate(
                            appconfig,
                            'list_deployments',
                            'Items',
                            ApplicationId=application_id,
                            EnvironmentId=environment_id,
                        ),
                        [],
                    )
                )

        resources.extend(
            {
                'type': 'deployment_strategy',
                'id': strategy.get('Id'),
                'name': strategy.get('Name'),
            }
            for strategy in _safe_value(lambda: _paginate(appconfig, 'list_deployment_strategies', 'Items'), [])
        )
        return resources

    def bedrockruntime_resources() -> list[dict[str, Any]]:
        return [
            {
                'type': 'operation',
                'name': 'Converse',
                'endpoint': '/model/{modelId}/converse',
                'status': 'supported',
            },
            {
                'type': 'operation',
                'name': 'InvokeModel',
                'endpoint': '/model/{modelId}/invoke',
                'status': 'supported',
            },
            {
                'type': 'operation',
                'name': 'ConverseStream',
                'endpoint': '/model/{modelId}/converse-stream',
                'status': 'unsupported',
            },
            {
                'type': 'operation',
                'name': 'InvokeModelWithResponseStream',
                'endpoint': '/model/{modelId}/invoke-with-response-stream',
                'status': 'unsupported',
            },
        ]

    def codebuild_resources() -> list[dict[str, Any]]:
        codebuild = factory.client('codebuild')
        resources: list[dict[str, Any]] = []
        project_names = _safe_value(lambda: _paginate(codebuild, 'list_projects', 'projects'), [])
        build_ids = _safe_value(lambda: _paginate(codebuild, 'list_builds', 'ids'), [])
        report_group_arns = _safe_value(lambda: _paginate(codebuild, 'list_report_groups', 'reportGroups'), [])
        report_arns = _safe_value(lambda: _paginate(codebuild, 'list_reports', 'reports'), [])
        source_credentials = _safe_value(lambda: codebuild.list_source_credentials().get('sourceCredentialsInfos', []), [])

        resources.extend(
            {
                'type': 'project',
                'name': name,
            }
            for name in project_names
        )
        resources.extend(
            {
                'type': 'build',
                'id': build_id,
            }
            for build_id in build_ids
        )
        resources.extend(
            {
                'type': 'report_group',
                'arn': arn,
            }
            for arn in report_group_arns
        )
        resources.extend(
            {
                'type': 'report',
                'arn': arn,
            }
            for arn in report_arns
        )
        resources.extend(
            {
                'type': 'source_credential',
                'server_type': credential.get('serverType'),
                'auth_type': credential.get('authType'),
                'arn': credential.get('arn'),
            }
            for credential in source_credentials
        )
        return resources

    def codedeploy_resources() -> list[dict[str, Any]]:
        codedeploy = factory.client('codedeploy')
        resources: list[dict[str, Any]] = []
        application_names = _safe_value(lambda: _paginate(codedeploy, 'list_applications', 'applications'), [])
        deployment_config_names = _safe_value(lambda: _paginate(codedeploy, 'list_deployment_configs', 'deploymentConfigsList'), [])
        on_prem_instance_names = _safe_value(lambda: _paginate(codedeploy, 'list_on_premises_instances', 'instanceNames'), [])

        for application_name in application_names:
            resources.append({
                'type': 'application',
                'name': application_name,
            })
            group_names = _safe_value(
                lambda application_name=application_name: _paginate(
                    codedeploy,
                    'list_deployment_groups',
                    'deploymentGroups',
                    applicationName=application_name,
                ),
                [],
            )
            resources.extend(
                {
                    'type': 'deployment_group',
                    'application_name': application_name,
                    'name': group_name,
                }
                for group_name in group_names
            )
            deployment_ids = _safe_value(
                lambda application_name=application_name: _paginate(
                    codedeploy,
                    'list_deployments',
                    'deployments',
                    applicationName=application_name,
                ),
                [],
            )
            resources.extend(
                {
                    'type': 'deployment',
                    'application_name': application_name,
                    'id': deployment_id,
                }
                for deployment_id in deployment_ids
            )

        resources.extend(
            {
                'type': 'deployment_config',
                'name': name,
            }
            for name in deployment_config_names
        )
        resources.extend(
            {
                'type': 'on_prem_instance',
                'name': name,
            }
            for name in on_prem_instance_names
        )
        return resources

    def eks_resources() -> list[dict[str, Any]]:
        eks = factory.client('eks')
        resources: list[dict[str, Any]] = []
        cluster_names = _safe_value(lambda: _paginate(eks, 'list_clusters', 'clusters'), [])

        for cluster_name in cluster_names:
            resources.append({
                'type': 'cluster',
                'name': cluster_name,
            })
            resources.extend(
                {
                    'type': 'nodegroup',
                    'cluster': cluster_name,
                    'name': nodegroup,
                }
                for nodegroup in _safe_value(
                    lambda cluster_name=cluster_name: _paginate(eks, 'list_nodegroups', 'nodegroups', clusterName=cluster_name),
                    [],
                )
            )
            resources.extend(
                {
                    'type': 'fargate_profile',
                    'cluster': cluster_name,
                    'name': profile,
                }
                for profile in _safe_value(
                    lambda cluster_name=cluster_name: _paginate(eks, 'list_fargate_profiles', 'fargateProfileNames', clusterName=cluster_name),
                    [],
                )
            )
            resources.extend(
                {
                    'type': 'addon',
                    'cluster': cluster_name,
                    'name': addon,
                }
                for addon in _safe_value(
                    lambda cluster_name=cluster_name: _paginate(eks, 'list_addons', 'addons', clusterName=cluster_name),
                    [],
                )
            )
            resources.extend(
                {
                    'type': 'identity_provider_config',
                    'cluster': cluster_name,
                    'name': config.get('name'),
                    'provider_type': config.get('type'),
                }
                for config in _safe_value(
                    lambda cluster_name=cluster_name: _paginate(
                        eks,
                        'list_identity_provider_configs',
                        'identityProviderConfigs',
                        clusterName=cluster_name,
                    ),
                    [],
                )
                if isinstance(config, dict)
            )
            resources.extend(
                {
                    'type': 'access_entry',
                    'cluster': cluster_name,
                    'principal_arn': principal,
                }
                for principal in _safe_value(
                    lambda cluster_name=cluster_name: _paginate(eks, 'list_access_entries', 'accessEntries', clusterName=cluster_name),
                    [],
                )
            )

        return resources

    def elasticache_resources() -> list[dict[str, Any]]:
        elasticache = factory.client('elasticache')
        resources: list[dict[str, Any]] = []
        resources.extend(
            {
                'type': 'cache_cluster',
                'name': cluster.get('CacheClusterId'),
                'engine': cluster.get('Engine'),
                'status': cluster.get('CacheClusterStatus'),
            }
            for cluster in _safe_value(lambda: _paginate(elasticache, 'describe_cache_clusters', 'CacheClusters'), [])
        )
        resources.extend(
            {
                'type': 'replication_group',
                'name': group.get('ReplicationGroupId'),
                'status': group.get('Status'),
            }
            for group in _safe_value(lambda: _paginate(elasticache, 'describe_replication_groups', 'ReplicationGroups'), [])
        )
        resources.extend(
            {
                'type': 'serverless_cache',
                'name': cache.get('ServerlessCacheName'),
                'engine': cache.get('Engine'),
                'status': cache.get('Status'),
            }
            for cache in _safe_value(lambda: _paginate(elasticache, 'describe_serverless_caches', 'ServerlessCaches'), [])
        )
        resources.extend(
            {
                'type': 'subnet_group',
                'name': group.get('CacheSubnetGroupName'),
            }
            for group in _safe_value(lambda: _paginate(elasticache, 'describe_cache_subnet_groups', 'CacheSubnetGroups'), [])
        )
        resources.extend(
            {
                'type': 'parameter_group',
                'name': group.get('CacheParameterGroupName'),
            }
            for group in _safe_value(lambda: _paginate(elasticache, 'describe_cache_parameter_groups', 'CacheParameterGroups'), [])
        )
        resources.extend(
            {
                'type': 'snapshot',
                'name': snapshot.get('SnapshotName'),
                'status': snapshot.get('SnapshotStatus'),
            }
            for snapshot in _safe_value(lambda: _paginate(elasticache, 'describe_snapshots', 'Snapshots'), [])
        )
        resources.extend(
            {
                'type': 'user',
                'name': user.get('UserName') or user.get('UserId'),
                'id': user.get('UserId'),
            }
            for user in _safe_value(lambda: _paginate(elasticache, 'describe_users', 'Users'), [])
        )
        resources.extend(
            {
                'type': 'user_group',
                'name': group.get('UserGroupId'),
                'status': group.get('Status'),
            }
            for group in _safe_value(lambda: _paginate(elasticache, 'describe_user_groups', 'UserGroups'), [])
        )
        return resources

    def elasticloadbalancing_resources() -> list[dict[str, Any]]:
        elbv2 = factory.client('elbv2')
        elb = factory.client('elb')
        resources: list[dict[str, Any]] = []
        v2_load_balancers = _safe_value(lambda: _paginate(elbv2, 'describe_load_balancers', 'LoadBalancers'), [])
        target_groups = _safe_value(lambda: _paginate(elbv2, 'describe_target_groups', 'TargetGroups'), [])
        classic_load_balancers = _safe_value(lambda: _paginate(elb, 'describe_load_balancers', 'LoadBalancerDescriptions'), [])

        resources.extend(
            {
                'type': 'v2_load_balancer',
                'name': load_balancer.get('LoadBalancerName'),
                'arn': load_balancer.get('LoadBalancerArn'),
                'dns_name': load_balancer.get('DNSName'),
                'state': load_balancer.get('State'),
            }
            for load_balancer in v2_load_balancers
        )
        for load_balancer in v2_load_balancers:
            arn = load_balancer.get('LoadBalancerArn')
            resources.extend(
                {
                    'type': 'listener',
                    'load_balancer': load_balancer.get('LoadBalancerName'),
                    'arn': listener.get('ListenerArn'),
                    'protocol': listener.get('Protocol'),
                    'port': listener.get('Port'),
                }
                for listener in _safe_value(
                    lambda arn=arn: _paginate(elbv2, 'describe_listeners', 'Listeners', LoadBalancerArn=arn),
                    [],
                )
            )
        resources.extend(
            {
                'type': 'target_group',
                'name': group.get('TargetGroupName'),
                'arn': group.get('TargetGroupArn'),
                'protocol': group.get('Protocol'),
                'port': group.get('Port'),
            }
            for group in target_groups
        )
        resources.extend(
            {
                'type': 'classic_load_balancer',
                'name': load_balancer.get('LoadBalancerName'),
                'dns_name': load_balancer.get('DNSName'),
                'scheme': load_balancer.get('Scheme'),
            }
            for load_balancer in classic_load_balancers
        )
        return resources

    def firehose_resources() -> list[dict[str, Any]]:
        firehose = factory.client('firehose')
        stream_names = _safe_value(lambda: _paginate(firehose, 'list_delivery_streams', 'DeliveryStreamNames'), [])
        resources: list[dict[str, Any]] = []

        for name in stream_names:
            description = _safe_value(
                lambda name=name: firehose.describe_delivery_stream(DeliveryStreamName=name).get('DeliveryStreamDescription', {}),
                {},
            )
            resources.append({
                'type': 'delivery_stream',
                'name': name,
                'arn': description.get('DeliveryStreamARN'),
                'status': description.get('DeliveryStreamStatus'),
                'stream_type': description.get('DeliveryStreamType'),
            })
            resources.extend(
                {
                    'type': 'destination',
                    'delivery_stream': name,
                    'id': destination.get('DestinationId'),
                }
                for destination in description.get('Destinations', [])
            )

        return resources

    def kinesis_resources() -> list[dict[str, Any]]:
        kinesis = factory.client('kinesis')
        stream_names = _safe_value(lambda: _paginate(kinesis, 'list_streams', 'StreamNames'), [])
        resources: list[dict[str, Any]] = []

        for name in stream_names:
            summary = _safe_value(
                lambda name=name: kinesis.describe_stream_summary(StreamName=name).get('StreamDescriptionSummary', {}),
                {},
            )
            stream_arn = summary.get('StreamARN')
            resources.append({
                'type': 'stream',
                'name': name,
                'arn': stream_arn,
                'status': summary.get('StreamStatus'),
                'open_shard_count': summary.get('OpenShardCount'),
            })
            resources.extend(
                {
                    'type': 'shard',
                    'stream': name,
                    'id': shard.get('ShardId'),
                }
                for shard in _safe_value(
                    lambda name=name: _paginate(kinesis, 'list_shards', 'Shards', StreamName=name),
                    [],
                )
            )
            if stream_arn:
                resources.extend(
                    {
                        'type': 'consumer',
                        'stream': name,
                        'name': consumer.get('ConsumerName'),
                        'arn': consumer.get('ConsumerARN'),
                        'status': consumer.get('ConsumerStatus'),
                    }
                    for consumer in _safe_value(
                        lambda stream_arn=stream_arn: _paginate(kinesis, 'list_stream_consumers', 'Consumers', StreamARN=stream_arn),
                        [],
                    )
                )

        return resources

    def kafka_resources() -> list[dict[str, Any]]:
        kafka = factory.client('kafka')
        resources: list[dict[str, Any]] = []
        clusters = _safe_value(lambda: _paginate(kafka, 'list_clusters_v2', 'ClusterInfoList'), [])
        if not clusters:
            clusters = _safe_value(lambda: _paginate(kafka, 'list_clusters', 'ClusterInfoList'), [])

        for cluster in clusters:
            arn = cluster.get('ClusterArn') or cluster.get('Provisioned', {}).get('ClusterArn') or cluster.get('Serverless', {}).get('ClusterArn')
            name = cluster.get('ClusterName') or cluster.get('Provisioned', {}).get('ClusterName') or cluster.get('Serverless', {}).get('ClusterName')
            resources.append({
                'type': 'cluster',
                'name': name,
                'arn': arn,
                'state': cluster.get('State'),
                'cluster_type': cluster.get('ClusterType'),
            })
            if arn:
                resources.extend(
                    {
                        'type': 'node',
                        'cluster': name,
                        'arn': node.get('NodeARN'),
                        'node_type': node.get('NodeType'),
                    }
                    for node in _safe_value(lambda arn=arn: _paginate(kafka, 'list_nodes', 'NodeInfoList', ClusterArn=arn), [])
                )
                resources.extend(
                    {
                        'type': 'operation',
                        'cluster': name,
                        'arn': operation.get('ClusterOperationArn'),
                        'operation_type': operation.get('OperationType'),
                        'state': operation.get('OperationState'),
                    }
                    for operation in _safe_value(lambda arn=arn: _paginate(kafka, 'list_cluster_operations', 'ClusterOperationInfoList', ClusterArn=arn), [])
                )

        resources.extend(
            {
                'type': 'configuration',
                'name': configuration.get('Name'),
                'arn': configuration.get('Arn'),
                'state': configuration.get('State'),
            }
            for configuration in _safe_value(lambda: _paginate(kafka, 'list_configurations', 'Configurations'), [])
        )
        return resources

    def opensearch_resources() -> list[dict[str, Any]]:
        opensearch = factory.client('opensearch')
        resources: list[dict[str, Any]] = []
        domain_names = _safe_value(lambda: opensearch.list_domain_names().get('DomainNames', []), [])
        names = [domain.get('DomainName') for domain in domain_names if domain.get('DomainName')]
        for chunk in _chunks(names, 5):
            resources.extend(
                {
                    'type': 'domain',
                    'name': domain.get('DomainName'),
                    'arn': domain.get('ARN') or domain.get('DomainArn'),
                    'engine_version': domain.get('EngineVersion') or domain.get('ElasticsearchVersion'),
                    'processing': domain.get('Processing'),
                    'endpoint': domain.get('Endpoint'),
                }
                for domain in _safe_value(lambda chunk=chunk: opensearch.describe_domains(DomainNames=chunk).get('DomainStatusList', []), [])
            )

        resources.extend(
            {
                'type': 'package',
                'name': package.get('PackageName'),
                'id': package.get('PackageID'),
                'status': package.get('PackageStatus'),
                'package_type': package.get('PackageType'),
            }
            for package in _safe_value(lambda: _paginate(opensearch, 'describe_packages', 'PackageDetailsList'), [])
        )
        resources.extend(
            {
                'type': 'vpc_endpoint',
                'name': endpoint.get('VpcEndpointId'),
                'id': endpoint.get('VpcEndpointId'),
                'domain_arn': endpoint.get('DomainArn'),
                'status': endpoint.get('Status'),
            }
            for endpoint in _safe_value(lambda: _paginate(opensearch, 'list_vpc_endpoints', 'VpcEndpointSummaryList'), [])
        )
        return resources

    def pipes_resources() -> list[dict[str, Any]]:
        pipes = factory.client('pipes')
        return [
            {
                'type': 'pipe',
                'name': pipe.get('Name'),
                'arn': pipe.get('Arn'),
                'desired_state': pipe.get('DesiredState'),
                'current_state': pipe.get('CurrentState'),
                'source': pipe.get('Source'),
                'target': pipe.get('Target'),
            }
            for pipe in _safe_value(lambda: _paginate(pipes, 'list_pipes', 'Pipes'), [])
        ]

    def resourcegroupstagging_resources() -> list[dict[str, Any]]:
        tagging = factory.client('resourcegroupstaggingapi')
        return [
            {
                'type': 'tagged_resource',
                'name': mapping.get('ResourceARN'),
                'arn': mapping.get('ResourceARN'),
                'tag_count': len(mapping.get('Tags', [])),
                'tags': mapping.get('Tags', []),
                'compliance_details': mapping.get('ComplianceDetails'),
            }
            for mapping in _safe_value(
                lambda: _paginate(tagging, 'get_resources', 'ResourceTagMappingList', IncludeComplianceDetails=True),
                [],
            )
        ]

    def ssm_resources() -> list[dict[str, Any]]:
        ssm = factory.client('ssm')
        resources = [
            {
                'type': 'parameter',
                'name': parameter.get('Name'),
                'parameter_type': parameter.get('Type'),
                'tier': parameter.get('Tier'),
                'version': parameter.get('Version'),
            }
            for parameter in _safe_value(lambda: _paginate(ssm, 'describe_parameters', 'Parameters'), [])
        ]
        resources.extend(
            {
                'type': 'document',
                'name': document.get('Name'),
                'owner': document.get('Owner'),
                'document_type': document.get('DocumentType'),
                'document_version': document.get('DocumentVersion'),
            }
            for document in _safe_value(lambda: _paginate(ssm, 'list_documents', 'DocumentIdentifiers'), [])
        )
        resources.extend(
            {
                'type': 'managed_instance',
                'id': instance.get('InstanceId'),
                'name': instance.get('Name') or instance.get('InstanceId'),
                'ping_status': instance.get('PingStatus'),
                'platform_type': instance.get('PlatformType'),
            }
            for instance in _safe_value(lambda: _paginate(ssm, 'describe_instance_information', 'InstanceInformationList'), [])
        )
        return resources

    def athena_resources() -> list[dict[str, Any]]:
        athena = factory.client('athena')
        resources = [
            {
                'type': 'workgroup',
                'name': workgroup.get('Name'),
                'state': workgroup.get('State'),
            }
            for workgroup in _safe_value(lambda: _paginate(athena, 'list_work_groups', 'WorkGroups'), [])
        ]
        resources.extend(
            {
                'type': 'query_execution',
                'id': query_id,
            }
            for query_id in _safe_value(lambda: _paginate(athena, 'list_query_executions', 'QueryExecutionIds'), [])
        )
        return resources

    def autoscaling_resources() -> list[dict[str, Any]]:
        autoscaling = factory.client('autoscaling')
        resources: list[dict[str, Any]] = []
        groups = _safe_value(
            lambda: _paginate(autoscaling, 'describe_auto_scaling_groups', 'AutoScalingGroups'),
            [],
        )
        resources.extend(
            {
                'type': 'auto_scaling_group',
                'name': group.get('AutoScalingGroupName'),
                'arn': group.get('AutoScalingGroupARN'),
                'desired_capacity': group.get('DesiredCapacity'),
                'min_size': group.get('MinSize'),
                'max_size': group.get('MaxSize'),
                'instance_count': len(group.get('Instances', [])),
            }
            for group in groups
        )
        resources.extend(
            {
                'type': 'launch_configuration',
                'name': configuration.get('LaunchConfigurationName'),
                'arn': configuration.get('LaunchConfigurationARN'),
                'image_id': configuration.get('ImageId'),
                'instance_type': configuration.get('InstanceType'),
            }
            for configuration in _safe_value(
                lambda: _paginate(autoscaling, 'describe_launch_configurations', 'LaunchConfigurations'),
                [],
            )
        )
        resources.extend(
            {
                'type': 'scaling_policy',
                'name': policy.get('PolicyName'),
                'arn': policy.get('PolicyARN'),
                'group': policy.get('AutoScalingGroupName'),
                'policy_type': policy.get('PolicyType'),
            }
            for policy in _safe_value(
                lambda: _paginate(autoscaling, 'describe_policies', 'ScalingPolicies'),
                [],
            )
        )
        resources.extend(
            {
                'type': 'scheduled_action',
                'name': action.get('ScheduledActionName'),
                'arn': action.get('ScheduledActionARN'),
                'group': action.get('AutoScalingGroupName'),
                'recurrence': action.get('Recurrence'),
            }
            for action in _safe_value(
                lambda: _paginate(autoscaling, 'describe_scheduled_actions', 'ScheduledUpdateGroupActions'),
                [],
            )
        )
        return resources

    def backup_resources() -> list[dict[str, Any]]:
        backup = factory.client('backup')
        resources = [
            {
                'type': 'backup_vault',
                'name': vault.get('BackupVaultName'),
                'arn': vault.get('BackupVaultArn'),
                'recovery_points': vault.get('NumberOfRecoveryPoints'),
            }
            for vault in _safe_value(lambda: _paginate(backup, 'list_backup_vaults', 'BackupVaultList'), [])
        ]
        resources.extend(
            {
                'type': 'backup_plan',
                'name': plan.get('BackupPlanName'),
                'arn': plan.get('BackupPlanArn'),
                'id': plan.get('BackupPlanId'),
                'version_id': plan.get('VersionId'),
            }
            for plan in _safe_value(lambda: _paginate(backup, 'list_backup_plans', 'BackupPlansList'), [])
        )
        resources.extend(
            {
                'type': 'protected_resource',
                'name': resource.get('ResourceName') or resource.get('ResourceArn'),
                'arn': resource.get('ResourceArn'),
                'resource_type': resource.get('ResourceType'),
                'last_backup_time': resource.get('LastBackupTime'),
            }
            for resource in _safe_value(lambda: _paginate(backup, 'list_protected_resources', 'Results'), [])
        )
        return resources

    def route53_resources() -> list[dict[str, Any]]:
        route53 = factory.client('route53')
        resources = [
            {
                'type': 'hosted_zone',
                'name': zone.get('Name'),
                'id': zone.get('Id'),
                'private_zone': zone.get('Config', {}).get('PrivateZone'),
                'record_sets': zone.get('ResourceRecordSetCount'),
            }
            for zone in _safe_value(lambda: _paginate(route53, 'list_hosted_zones', 'HostedZones'), [])
        ]
        resources.extend(
            {
                'type': 'health_check',
                'name': check.get('Id'),
                'id': check.get('Id'),
                'health_check_version': check.get('HealthCheckVersion'),
                'config': check.get('HealthCheckConfig'),
            }
            for check in _safe_value(lambda: _paginate(route53, 'list_health_checks', 'HealthChecks'), [])
        )
        resources.extend(
            {
                'type': 'traffic_policy',
                'name': policy.get('Name'),
                'id': policy.get('Id'),
                'policy_type': policy.get('Type'),
                'latest_version': policy.get('LatestVersion'),
            }
            for policy in _safe_value(lambda: route53.list_traffic_policies().get('TrafficPolicySummaries', []), [])
        )
        return resources

    def transfer_resources() -> list[dict[str, Any]]:
        transfer = factory.client('transfer')
        resources = [
            {
                'type': 'server',
                'name': server.get('ServerId'),
                'arn': server.get('Arn'),
                'state': server.get('State'),
                'endpoint_type': server.get('EndpointType'),
            }
            for server in _safe_value(lambda: _paginate(transfer, 'list_servers', 'Servers'), [])
        ]
        resources.extend(
            {
                'type': 'workflow',
                'name': workflow.get('WorkflowId'),
                'arn': workflow.get('Arn'),
                'description': workflow.get('Description'),
            }
            for workflow in _safe_value(lambda: _paginate(transfer, 'list_workflows', 'Workflows'), [])
        )
        resources.extend(
            {
                'type': 'profile',
                'name': profile.get('ProfileId'),
                'arn': profile.get('Arn'),
                'profile_type': profile.get('ProfileType'),
            }
            for profile in _safe_value(lambda: _paginate(transfer, 'list_profiles', 'Profiles'), [])
        )
        resources.extend(
            {
                'type': 'connector',
                'name': connector.get('ConnectorId'),
                'arn': connector.get('Arn'),
                'url': connector.get('Url'),
            }
            for connector in _safe_value(lambda: _paginate(transfer, 'list_connectors', 'Connectors'), [])
        )
        return resources

    def ec2_resources() -> list[dict[str, Any]]:
        ec2 = factory.client('ec2')
        resources: list[dict[str, Any]] = []
        reservations = _safe_value(lambda: ec2.describe_instances().get('Reservations', []), [])
        resources.extend(
            {
                'type': 'instance',
                'id': instance.get('InstanceId'),
                'state': instance.get('State', {}).get('Name'),
            }
            for reservation in reservations
            for instance in reservation.get('Instances', [])
        )
        resources.extend({'type': 'vpc', 'id': item.get('VpcId')} for item in _safe_value(lambda: ec2.describe_vpcs().get('Vpcs', []), []))
        resources.extend({'type': 'subnet', 'id': item.get('SubnetId')} for item in _safe_value(lambda: ec2.describe_subnets().get('Subnets', []), []))
        resources.extend({'type': 'security_group', 'id': item.get('GroupId')} for item in _safe_value(lambda: ec2.describe_security_groups().get('SecurityGroups', []), []))
        resources.extend({'type': 'internet_gateway', 'id': item.get('InternetGatewayId')} for item in _safe_value(lambda: ec2.describe_internet_gateways().get('InternetGateways', []), []))
        resources.extend({'type': 'route_table', 'id': item.get('RouteTableId')} for item in _safe_value(lambda: ec2.describe_route_tables().get('RouteTables', []), []))
        resources.extend({'type': 'elastic_ip', 'id': item.get('AllocationId') or item.get('PublicIp')} for item in _safe_value(lambda: ec2.describe_addresses().get('Addresses', []), []))
        resources.extend({'type': 'key_pair', 'id': item.get('KeyName')} for item in _safe_value(lambda: ec2.describe_key_pairs().get('KeyPairs', []), []))
        return resources

    resource_loaders: list[tuple[str, str, Callable[[], list[dict[str, Any]]]]] = [
        ('acm-certificates', 'ACM certificates', acm_resources),
        ('apigateway-apis', 'API Gateway APIs', apigateway_apis),
        ('appconfig-resources', 'AppConfig resources', appconfig_resources),
        ('athena-resources', 'Athena resources', athena_resources),
        ('autoscaling-resources', 'Auto Scaling resources', autoscaling_resources),
        ('backup-resources', 'Backup resources', backup_resources),
        ('bedrockruntime-resources', 'Bedrock Runtime operations', bedrockruntime_resources),
        ('codebuild-resources', 'CodeBuild resources', codebuild_resources),
        ('codedeploy-resources', 'CodeDeploy resources', codedeploy_resources),
        ('eks-resources', 'EKS resources', eks_resources),
        ('elasticache-resources', 'ElastiCache resources', elasticache_resources),
        ('elasticloadbalancing-resources', 'Elastic Load Balancing resources', elasticloadbalancing_resources),
        ('firehose-resources', 'Data Firehose resources', firehose_resources),
        ('kinesis-resources', 'Kinesis resources', kinesis_resources),
        ('kafka-resources', 'MSK / Kafka resources', kafka_resources),
        ('opensearch-resources', 'OpenSearch resources', opensearch_resources),
        ('pipes-resources', 'EventBridge Pipes resources', pipes_resources),
        ('resourcegroupstagging-resources', 'Resource Groups Tagging resources', resourcegroupstagging_resources),
        ('ssm-resources', 'SSM resources', ssm_resources),
        ('cloudformation-resources', 'CloudFormation resources', cloudformation_resources),
        ('ecr-resources', 'ECR resources', ecr_resources),
        ('glue-resources', 'Glue resources', glue_resources),
        ('rds-resources', 'RDS resources', rds_resources),
        ('route53-resources', 'Route 53 resources', route53_resources),
        ('iam-users', 'IAM users', iam_users),
        ('iam-roles', 'IAM roles', iam_roles),
        ('ec2-resources', 'EC2 resources', ec2_resources),
        ('ecs-resources', 'ECS resources', ecs_resources),
        ('s3-buckets', 'S3 buckets', s3_buckets),
        ('sqs-queues', 'SQS queues', sqs_queues),
        ('dynamodb-tables', 'DynamoDB tables', dynamodb_tables),
        ('sns-topics', 'SNS topics', sns_topics),
        ('ses-resources', 'SES resources', ses_resources),
        ('scheduler-resources', 'EventBridge Scheduler resources', scheduler_resources),
        ('stepfunctions-resources', 'Step Functions resources', stepfunctions_resources),
        ('transfer-resources', 'Transfer Family resources', transfer_resources),
        ('lambda-functions', 'Lambda functions', lambda_functions),
        ('kms-keys', 'KMS keys', kms_keys),
        ('secrets', 'Secrets Manager secrets', secrets),
        ('log-groups', 'CloudWatch log groups', log_groups),
        ('cloudwatch-metrics', 'CloudWatch metrics and alarms', cloudwatch_metrics),
        ('cognito-resources', 'Cognito resources', cognito_resources),
        ('eventbridge-resources', 'EventBridge resources', eventbridge_resources),
    ]

    with ThreadPoolExecutor(max_workers=min(12, len(resource_loaders))) as executor:
        return list(executor.map(
            lambda args: _resource(*args),
            resource_loaders,
        ))
