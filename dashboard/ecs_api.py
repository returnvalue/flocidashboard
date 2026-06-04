"""Interactive ECS helpers for local container workflows."""

from __future__ import annotations

from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('ecs')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _int_value(value: Any, label: str, default: int | None = None) -> int:
    if value in (None, '') and default is not None:
        return default
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f'{label} must be a number') from exc
    if number < 0:
        raise ValueError(f'{label} must be zero or greater')
    return number


def _list(value: Any, label: str = 'Value') -> list[Any]:
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


def _tags(value: Any) -> list[dict[str, str]]:
    if value in (None, '', []):
        return []
    if isinstance(value, dict):
        value = [{'key': key, 'value': item} for key, item in value.items()]
    if not isinstance(value, list):
        raise ValueError('Tags must be an object or list')

    tags = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError('Each tag must be an object')
        key = _required(item.get('key') or item.get('Key'), 'Tag key')
        tag_value = item.get('value')
        if tag_value is None:
            tag_value = item.get('Value')
        tags.append({'key': key, 'value': '' if tag_value is None else str(tag_value)})
    return tags


def _tag_keys(value: Any) -> list[str]:
    keys = [str(item).strip() for item in _list(value, 'Tag keys') if str(item).strip()]
    if not keys:
        raise ValueError('At least one tag key is required')
    return keys


def create_cluster(name: str, *, tags: Any = None, capacity_providers: Any = None) -> dict[str, Any]:
    kwargs: dict[str, Any] = {'clusterName': _required(name, 'Cluster name')}
    clean_tags = _tags(tags)
    if clean_tags:
        kwargs['tags'] = clean_tags
    providers = _list(capacity_providers, 'Capacity providers')
    if providers:
        kwargs['capacityProviders'] = providers
    response = _client().create_cluster(**kwargs)
    cluster = response.get('cluster', {})
    return {
        'name': cluster.get('clusterName') or kwargs['clusterName'],
        'arn': cluster.get('clusterArn'),
        'status': cluster.get('status'),
        'response': _clean_response(response),
    }


def delete_cluster(cluster: str) -> dict[str, Any]:
    clean_cluster = _required(cluster, 'Cluster')
    response = _client().delete_cluster(cluster=clean_cluster)
    deleted = response.get('cluster', {})
    return {
        'name': deleted.get('clusterName') or clean_cluster,
        'arn': deleted.get('clusterArn'),
        'status': deleted.get('status'),
        'response': _clean_response(response),
    }


def register_task_definition(
    *,
    family: str,
    container_definitions: Any,
    requires_compatibilities: Any = None,
    network_mode: str = 'awsvpc',
    cpu: Any = '256',
    memory: Any = '512',
    task_role_arn: str = '',
    execution_role_arn: str = '',
    tags: Any = None,
) -> dict[str, Any]:
    containers = _list(container_definitions, 'Container definitions')
    if not containers:
        raise ValueError('At least one container definition is required')

    kwargs: dict[str, Any] = {
        'family': _required(family, 'Task family'),
        'containerDefinitions': containers,
    }
    compatibilities = _list(requires_compatibilities, 'Requires compatibilities')
    if compatibilities:
        kwargs['requiresCompatibilities'] = compatibilities
    if network_mode:
        kwargs['networkMode'] = network_mode
    if cpu not in (None, ''):
        kwargs['cpu'] = str(cpu)
    if memory not in (None, ''):
        kwargs['memory'] = str(memory)
    if task_role_arn:
        kwargs['taskRoleArn'] = task_role_arn
    if execution_role_arn:
        kwargs['executionRoleArn'] = execution_role_arn
    clean_tags = _tags(tags)
    if clean_tags:
        kwargs['tags'] = clean_tags

    response = _client().register_task_definition(**kwargs)
    task_definition = response.get('taskDefinition', {})
    return {
        'family': task_definition.get('family') or kwargs['family'],
        'revision': task_definition.get('revision'),
        'task_definition_arn': task_definition.get('taskDefinitionArn'),
        'status': task_definition.get('status'),
        'response': _clean_response(response),
    }


def run_task(
    *,
    cluster: str,
    task_definition: str,
    launch_type: str = 'FARGATE',
    count: Any = 1,
    network_configuration: Any = None,
    overrides: Any = None,
    started_by: str = '',
    tags: Any = None,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        'cluster': _required(cluster, 'Cluster'),
        'taskDefinition': _required(task_definition, 'Task definition'),
        'count': max(1, _int_value(count, 'Count', 1)),
    }
    if launch_type:
        kwargs['launchType'] = launch_type
    config = _dict(network_configuration, 'Network configuration')
    if config:
        kwargs['networkConfiguration'] = config
    clean_overrides = _dict(overrides, 'Overrides')
    if clean_overrides:
        kwargs['overrides'] = clean_overrides
    if started_by:
        kwargs['startedBy'] = started_by
    clean_tags = _tags(tags)
    if clean_tags:
        kwargs['tags'] = clean_tags

    response = _client().run_task(**kwargs)
    tasks = response.get('tasks', [])
    return {
        'cluster': kwargs['cluster'],
        'task_definition': kwargs['taskDefinition'],
        'task_arns': [task.get('taskArn') for task in tasks if task.get('taskArn')],
        'failures': response.get('failures', []),
        'response': _clean_response(response),
    }


def stop_task(cluster: str, task: str, *, reason: str = '') -> dict[str, Any]:
    kwargs: dict[str, Any] = {'task': _required(task, 'Task')}
    if cluster:
        kwargs['cluster'] = cluster
    if reason:
        kwargs['reason'] = reason
    response = _client().stop_task(**kwargs)
    stopped = response.get('task', {})
    return {
        'cluster': kwargs.get('cluster'),
        'task_arn': stopped.get('taskArn') or kwargs['task'],
        'last_status': stopped.get('lastStatus'),
        'desired_status': stopped.get('desiredStatus'),
        'response': _clean_response(response),
    }


def create_service(
    *,
    cluster: str,
    service_name: str,
    task_definition: str,
    desired_count: Any = 1,
    launch_type: str = 'FARGATE',
    network_configuration: Any = None,
    tags: Any = None,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        'cluster': _required(cluster, 'Cluster'),
        'serviceName': _required(service_name, 'Service name'),
        'desiredCount': _int_value(desired_count, 'Desired count', 1),
    }
    if task_definition:
        kwargs['taskDefinition'] = task_definition
    if launch_type:
        kwargs['launchType'] = launch_type
    config = _dict(network_configuration, 'Network configuration')
    if config:
        kwargs['networkConfiguration'] = config
    clean_tags = _tags(tags)
    if clean_tags:
        kwargs['tags'] = clean_tags
    response = _client().create_service(**kwargs)
    service = response.get('service', {})
    return {
        'cluster': kwargs['cluster'],
        'service_name': service.get('serviceName') or kwargs['serviceName'],
        'service_arn': service.get('serviceArn'),
        'status': service.get('status'),
        'desired_count': service.get('desiredCount'),
        'response': _clean_response(response),
    }


def update_service(
    *,
    cluster: str,
    service: str,
    desired_count: Any = None,
    task_definition: str = '',
    force_new_deployment: bool = False,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        'cluster': _required(cluster, 'Cluster'),
        'service': _required(service, 'Service'),
    }
    if desired_count not in (None, ''):
        kwargs['desiredCount'] = _int_value(desired_count, 'Desired count')
    if task_definition:
        kwargs['taskDefinition'] = task_definition
    if force_new_deployment:
        kwargs['forceNewDeployment'] = True
    if len(kwargs) == 2:
        raise ValueError('At least one service setting must be changed')
    response = _client().update_service(**kwargs)
    updated = response.get('service', {})
    return {
        'cluster': kwargs['cluster'],
        'service_name': updated.get('serviceName') or kwargs['service'],
        'service_arn': updated.get('serviceArn'),
        'status': updated.get('status'),
        'desired_count': updated.get('desiredCount'),
        'response': _clean_response(response),
    }


def delete_service(cluster: str, service: str, *, force: bool = True) -> dict[str, Any]:
    response = _client().delete_service(
        cluster=_required(cluster, 'Cluster'),
        service=_required(service, 'Service'),
        force=bool(force),
    )
    deleted = response.get('service', {})
    return {
        'cluster': cluster,
        'service_name': deleted.get('serviceName') or service,
        'service_arn': deleted.get('serviceArn'),
        'status': deleted.get('status'),
        'force': bool(force),
        'response': _clean_response(response),
    }


def tag_resource(resource_arn: str, tags: Any) -> dict[str, Any]:
    arn = _required(resource_arn, 'Resource ARN')
    clean_tags = _tags(tags)
    if not clean_tags:
        raise ValueError('At least one tag is required')
    response = _client().tag_resource(resourceArn=arn, tags=clean_tags)
    return {'resource_arn': arn, 'tags': clean_tags, 'response': _clean_response(response)}


def untag_resource(resource_arn: str, tag_keys: Any) -> dict[str, Any]:
    arn = _required(resource_arn, 'Resource ARN')
    keys = _tag_keys(tag_keys)
    response = _client().untag_resource(resourceArn=arn, tagKeys=keys)
    return {'resource_arn': arn, 'tag_keys': keys, 'response': _clean_response(response)}


def put_account_setting(name: str, value: str, *, principal_arn: str = '') -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        'name': _required(name, 'Setting name'),
        'value': _required(value, 'Setting value'),
    }
    if principal_arn:
        kwargs['principalArn'] = principal_arn
    response = _client().put_account_setting(**kwargs)
    return {'setting': _clean_response(response.get('setting', {})), 'response': _clean_response(response)}
