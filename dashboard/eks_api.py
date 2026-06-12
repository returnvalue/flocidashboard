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


def _int(value: Any, label: str) -> int | None:
    if value in (None, ''):
        return None
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f'{label} must be a number') from exc


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


def create_nodegroup(
    *,
    cluster_name: str,
    nodegroup_name: str,
    node_role: str,
    subnets: Any = None,
    scaling_config: Any = None,
    instance_types: Any = None,
    ami_type: str = '',
    capacity_type: str = '',
    disk_size: Any = None,
    labels: Any = None,
    tags: Any = None,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        'clusterName': _required(cluster_name, 'Cluster name'),
        'nodegroupName': _required(nodegroup_name, 'Node group name'),
        'nodeRole': _required(node_role, 'Node role ARN'),
        'subnets': _list(subnets, 'Subnets'),
    }
    if not kwargs['subnets']:
        raise ValueError('At least one subnet is required')

    clean_scaling = _dict(scaling_config, 'Scaling config')
    if clean_scaling:
        kwargs['scalingConfig'] = clean_scaling
    clean_instance_types = _list(instance_types, 'Instance types')
    if clean_instance_types:
        kwargs['instanceTypes'] = clean_instance_types
    if ami_type:
        kwargs['amiType'] = str(ami_type).strip()
    if capacity_type:
        kwargs['capacityType'] = str(capacity_type).strip().upper()
    clean_disk_size = _int(disk_size, 'Disk size')
    if clean_disk_size is not None:
        kwargs['diskSize'] = clean_disk_size
    clean_labels = _dict(labels, 'Labels')
    if clean_labels:
        kwargs['labels'] = {str(key): str(item) for key, item in clean_labels.items()}
    clean_tags = _tags(tags)
    if clean_tags:
        kwargs['tags'] = clean_tags

    response = _client().create_nodegroup(**kwargs)
    nodegroup = response.get('nodegroup', {})
    return {
        'cluster_name': kwargs['clusterName'],
        'nodegroup_name': nodegroup.get('nodegroupName') or kwargs['nodegroupName'],
        'arn': nodegroup.get('nodegroupArn'),
        'status': nodegroup.get('status'),
        'response': _clean_response(response),
    }


def delete_nodegroup(cluster_name: str, nodegroup_name: str) -> dict[str, Any]:
    clean_cluster = _required(cluster_name, 'Cluster name')
    clean_nodegroup = _required(nodegroup_name, 'Node group name')
    response = _client().delete_nodegroup(clusterName=clean_cluster, nodegroupName=clean_nodegroup)
    nodegroup = response.get('nodegroup', {})
    return {
        'cluster_name': clean_cluster,
        'nodegroup_name': nodegroup.get('nodegroupName') or clean_nodegroup,
        'arn': nodegroup.get('nodegroupArn'),
        'status': nodegroup.get('status'),
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
