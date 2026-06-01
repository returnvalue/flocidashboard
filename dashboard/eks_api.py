"""Interactive EKS helpers for local Kubernetes control plane workflows."""

from __future__ import annotations

from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('eks')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _list(value: Any, label: str) -> list[Any]:
    if value in (None, '', []):
        return []
    if isinstance(value, str):
        return [item.strip() for item in value.replace('\n', ',').split(',') if item.strip()]
    if isinstance(value, list):
        return value
    raise ValueError(f'{label} must be a list')


def _dict(value: Any, label: str) -> dict[str, Any]:
    if value in (None, ''):
        return {}
    if not isinstance(value, dict):
        raise ValueError(f'{label} must be an object')
    return value


def _tags(value: Any) -> dict[str, str]:
    if value in (None, '', [], {}):
        return {}
    if isinstance(value, list):
        value = {
            item.get('key') or item.get('Key'): item.get('value') if item.get('value') is not None else item.get('Value')
            for item in value
            if isinstance(item, dict)
        }
    if not isinstance(value, dict):
        raise ValueError('Tags must be an object or list')

    tags: dict[str, str] = {}
    for key, item in value.items():
        clean_key = _required(key, 'Tag key')
        tags[clean_key] = '' if item is None else str(item)
    return tags


def _tag_keys(value: Any) -> list[str]:
    keys = [str(item).strip() for item in _list(value, 'Tag keys') if str(item).strip()]
    if not keys:
        raise ValueError('At least one tag key is required')
    return keys


def create_cluster(
    *,
    name: str,
    role_arn: str,
    version: str = '',
    subnet_ids: Any = None,
    security_group_ids: Any = None,
    tags: Any = None,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        'name': _required(name, 'Cluster name'),
        'roleArn': _required(role_arn, 'Role ARN'),
        'resourcesVpcConfig': {
            'subnetIds': _list(subnet_ids, 'Subnet IDs'),
            'securityGroupIds': _list(security_group_ids, 'Security group IDs'),
        },
    }
    if version:
        kwargs['version'] = str(version).strip()
    clean_tags = _tags(tags)
    if clean_tags:
        kwargs['tags'] = clean_tags

    response = _client().create_cluster(**kwargs)
    cluster = response.get('cluster', {})
    return {
        'name': cluster.get('name') or kwargs['name'],
        'arn': cluster.get('arn'),
        'status': cluster.get('status'),
        'endpoint': cluster.get('endpoint'),
        'version': cluster.get('version'),
        'response': _clean_response(response),
    }


def delete_cluster(name: str) -> dict[str, Any]:
    clean_name = _required(name, 'Cluster name')
    response = _client().delete_cluster(name=clean_name)
    cluster = response.get('cluster', {})
    return {
        'name': cluster.get('name') or clean_name,
        'arn': cluster.get('arn'),
        'status': cluster.get('status'),
        'response': _clean_response(response),
    }


def tag_resource(resource_arn: str, tags: Any) -> dict[str, Any]:
    clean_arn = _required(resource_arn, 'Resource ARN')
    clean_tags = _tags(tags)
    if not clean_tags:
        raise ValueError('At least one tag is required')
    response = _client().tag_resource(resourceArn=clean_arn, tags=clean_tags)
    return {
        'resource_arn': clean_arn,
        'tags': clean_tags,
        'response': _clean_response(response),
    }


def untag_resource(resource_arn: str, tag_keys: Any) -> dict[str, Any]:
    clean_arn = _required(resource_arn, 'Resource ARN')
    clean_keys = _tag_keys(tag_keys)
    response = _client().untag_resource(resourceArn=clean_arn, tagKeys=clean_keys)
    return {
        'resource_arn': clean_arn,
        'tag_keys': clean_keys,
        'response': _clean_response(response),
    }


def list_tags(resource_arn: str) -> dict[str, Any]:
    clean_arn = _required(resource_arn, 'Resource ARN')
    response = _client().list_tags_for_resource(resourceArn=clean_arn)
    return {
        'resource_arn': clean_arn,
        'tags': response.get('tags', {}),
        'response': _clean_response(response),
    }
