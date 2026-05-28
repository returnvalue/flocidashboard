"""Interactive ELBv2 helpers for local load-balancing workflows."""

from __future__ import annotations

from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('elbv2')


def _required(value: str, label: str) -> str:
    cleaned = (value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _int_value(value: Any, label: str, default: int | None = None) -> int:
    if value in (None, '') and default is not None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f'{label} must be a number') from exc


def _string_list(value: Any) -> list[str]:
    if value in (None, '', []):
        return []
    if isinstance(value, str):
        return [item.strip() for item in value.replace('\n', ',').split(',') if item.strip()]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    raise ValueError('Value must be a comma-separated string or list')


def _tags(value: Any) -> list[dict[str, str]]:
    if value in (None, '', []):
        return []
    if isinstance(value, dict):
        value = [{'Key': key, 'Value': item} for key, item in value.items()]
    if not isinstance(value, list):
        raise ValueError('Tags must be an object or list')
    tags = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError('Each tag must be an object')
        key = item.get('Key') or item.get('key')
        if not key:
            raise ValueError('Each tag needs a Key')
        tag_value = item.get('Value')
        if tag_value is None:
            tag_value = item.get('value')
        tags.append({'Key': str(key), 'Value': '' if tag_value is None else str(tag_value)})
    return tags


def _targets(value: Any) -> list[dict[str, Any]]:
    if value in (None, '', []):
        return []
    if isinstance(value, str):
        items = _string_list(value)
        targets = []
        for item in items:
            target_id, _, port = item.partition(':')
            target = {'Id': _required(target_id, 'Target ID')}
            if port:
                target['Port'] = _int_value(port, 'Target port')
            targets.append(target)
        return targets
    if not isinstance(value, list):
        raise ValueError('Targets must be a list or comma-separated string')
    targets = []
    for item in value:
        if isinstance(item, str):
            targets.extend(_targets(item))
            continue
        if not isinstance(item, dict):
            raise ValueError('Each target must be an object')
        target_id = item.get('Id') or item.get('id')
        target = {'Id': _required(target_id, 'Target ID')}
        port = item.get('Port') if item.get('Port') is not None else item.get('port')
        if port not in (None, ''):
            target['Port'] = _int_value(port, 'Target port')
        targets.append(target)
    return targets


def create_load_balancer(
    name: str,
    *,
    lb_type: str = 'application',
    scheme: str = 'internet-facing',
    subnets: Any = None,
    security_groups: Any = None,
    ip_address_type: str = '',
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        'Name': _required(name, 'Load balancer name'),
        'Type': (lb_type or 'application').strip(),
        'Scheme': (scheme or 'internet-facing').strip(),
    }
    parsed_subnets = _string_list(subnets)
    if parsed_subnets:
        kwargs['Subnets'] = parsed_subnets
    parsed_groups = _string_list(security_groups)
    if parsed_groups:
        kwargs['SecurityGroups'] = parsed_groups
    if ip_address_type:
        kwargs['IpAddressType'] = ip_address_type
    response = _client().create_load_balancer(**kwargs)
    return {'load_balancers': _clean_response(response.get('LoadBalancers', [])), 'response': _clean_response(response)}


def delete_load_balancer(load_balancer_arn: str) -> dict[str, Any]:
    arn = _required(load_balancer_arn, 'Load balancer ARN')
    response = _client().delete_load_balancer(LoadBalancerArn=arn)
    return {'load_balancer_arn': arn, 'response': _clean_response(response)}


def create_target_group(
    name: str,
    protocol: str,
    port: Any,
    *,
    target_type: str = 'instance',
    vpc_id: str = '',
    health_check_path: str = '',
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        'Name': _required(name, 'Target group name'),
        'Protocol': _required(protocol, 'Protocol').upper(),
        'Port': _int_value(port, 'Port'),
        'TargetType': (target_type or 'instance').strip(),
    }
    if vpc_id:
        kwargs['VpcId'] = vpc_id
    if health_check_path:
        kwargs['HealthCheckPath'] = health_check_path
    response = _client().create_target_group(**kwargs)
    return {'target_groups': _clean_response(response.get('TargetGroups', [])), 'response': _clean_response(response)}


def delete_target_group(target_group_arn: str) -> dict[str, Any]:
    arn = _required(target_group_arn, 'Target group ARN')
    response = _client().delete_target_group(TargetGroupArn=arn)
    return {'target_group_arn': arn, 'response': _clean_response(response)}


def register_targets(target_group_arn: str, targets: Any) -> dict[str, Any]:
    arn = _required(target_group_arn, 'Target group ARN')
    parsed_targets = _targets(targets)
    if not parsed_targets:
        raise ValueError('At least one target is required')
    response = _client().register_targets(TargetGroupArn=arn, Targets=parsed_targets)
    return {'target_group_arn': arn, 'targets': parsed_targets, 'response': _clean_response(response)}


def deregister_targets(target_group_arn: str, targets: Any) -> dict[str, Any]:
    arn = _required(target_group_arn, 'Target group ARN')
    parsed_targets = _targets(targets)
    if not parsed_targets:
        raise ValueError('At least one target is required')
    response = _client().deregister_targets(TargetGroupArn=arn, Targets=parsed_targets)
    return {'target_group_arn': arn, 'targets': parsed_targets, 'response': _clean_response(response)}


def create_listener(load_balancer_arn: str, protocol: str, port: Any, target_group_arn: str) -> dict[str, Any]:
    response = _client().create_listener(
        LoadBalancerArn=_required(load_balancer_arn, 'Load balancer ARN'),
        Protocol=_required(protocol, 'Protocol').upper(),
        Port=_int_value(port, 'Port'),
        DefaultActions=[{'Type': 'forward', 'TargetGroupArn': _required(target_group_arn, 'Target group ARN')}],
    )
    return {'listeners': _clean_response(response.get('Listeners', [])), 'response': _clean_response(response)}


def delete_listener(listener_arn: str) -> dict[str, Any]:
    arn = _required(listener_arn, 'Listener ARN')
    response = _client().delete_listener(ListenerArn=arn)
    return {'listener_arn': arn, 'response': _clean_response(response)}


def create_rule(listener_arn: str, priority: Any, path_pattern: str, target_group_arn: str) -> dict[str, Any]:
    response = _client().create_rule(
        ListenerArn=_required(listener_arn, 'Listener ARN'),
        Priority=_int_value(priority, 'Priority'),
        Conditions=[{'Field': 'path-pattern', 'Values': [_required(path_pattern, 'Path pattern')]}],
        Actions=[{'Type': 'forward', 'TargetGroupArn': _required(target_group_arn, 'Target group ARN')}],
    )
    return {'rules': _clean_response(response.get('Rules', [])), 'response': _clean_response(response)}


def delete_rule(rule_arn: str) -> dict[str, Any]:
    arn = _required(rule_arn, 'Rule ARN')
    response = _client().delete_rule(RuleArn=arn)
    return {'rule_arn': arn, 'response': _clean_response(response)}


def add_tags(resource_arns: Any, tags: Any) -> dict[str, Any]:
    arns = _string_list(resource_arns)
    parsed_tags = _tags(tags)
    if not arns:
        raise ValueError('At least one resource ARN is required')
    if not parsed_tags:
        raise ValueError('At least one tag is required')
    response = _client().add_tags(ResourceArns=arns, Tags=parsed_tags)
    return {'resource_arns': arns, 'tags': parsed_tags, 'response': _clean_response(response)}


def remove_tags(resource_arns: Any, tag_keys: Any) -> dict[str, Any]:
    arns = _string_list(resource_arns)
    keys = _string_list(tag_keys)
    if not arns:
        raise ValueError('At least one resource ARN is required')
    if not keys:
        raise ValueError('At least one tag key is required')
    response = _client().remove_tags(ResourceArns=arns, TagKeys=keys)
    return {'resource_arns': arns, 'tag_keys': keys, 'response': _clean_response(response)}
