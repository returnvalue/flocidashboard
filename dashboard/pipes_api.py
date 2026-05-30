"""Interactive EventBridge Pipes helpers for local pipe workflows."""

from __future__ import annotations

import json
from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('pipes')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _optional_str(value: Any) -> str:
    return str(value or '').strip()


def _json_object(value: Any, label: str) -> dict[str, Any]:
    if isinstance(value, str):
        value = json.loads(value)
    if not isinstance(value, dict):
        raise ValueError(f'{label} must be a JSON object')
    return value


def _optional_json_object(value: Any, label: str) -> dict[str, Any] | None:
    if value in (None, ''):
        return None
    return _json_object(value, label)


def _tags(value: Any) -> dict[str, str]:
    if value in (None, '', {}, []):
        return {}
    if isinstance(value, str):
        value = json.loads(value)
    if isinstance(value, list):
        result = {}
        for item in value:
            if not isinstance(item, dict):
                raise ValueError('Each tag must be an object')
            key = item.get('Key') or item.get('key')
            if not key:
                raise ValueError('Each tag needs a Key')
            tag_value = item.get('Value')
            if tag_value is None:
                tag_value = item.get('value')
            result[str(key)] = '' if tag_value is None else str(tag_value)
        return result
    if isinstance(value, dict):
        return {str(key): '' if item is None else str(item) for key, item in value.items()}
    raise ValueError('Tags must be an object or list')


def _tag_keys(value: Any) -> list[str]:
    if value in (None, '', []):
        return []
    if isinstance(value, str):
        return [item.strip() for item in value.replace('\n', ',').split(',') if item.strip()]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    raise ValueError('Tag keys must be a comma-separated string or list')


def _pipe_payload(
    *,
    name: Any,
    source: Any,
    target: Any,
    role_arn: Any,
    desired_state: Any = 'RUNNING',
    description: Any = '',
    source_parameters: Any = None,
    target_parameters: Any = None,
    enrichment: Any = '',
    enrichment_parameters: Any = None,
    log_configuration: Any = None,
    kms_key_identifier: Any = '',
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        'Name': _required(name, 'Pipe name'),
        'Source': _required(source, 'Source ARN'),
        'Target': _required(target, 'Target ARN'),
        'RoleArn': _required(role_arn, 'Role ARN'),
        'DesiredState': str(desired_state or 'RUNNING').strip().upper(),
    }
    if payload['DesiredState'] not in {'RUNNING', 'STOPPED'}:
        raise ValueError('Desired state must be RUNNING or STOPPED')
    if description:
        payload['Description'] = str(description)
    if _optional_str(enrichment):
        payload['Enrichment'] = _optional_str(enrichment)
    optional_blocks = {
        'SourceParameters': (source_parameters, 'Source parameters'),
        'TargetParameters': (target_parameters, 'Target parameters'),
        'EnrichmentParameters': (enrichment_parameters, 'Enrichment parameters'),
        'LogConfiguration': (log_configuration, 'Log configuration'),
    }
    for key, (value, label) in optional_blocks.items():
        parsed = _optional_json_object(value, label)
        if parsed is not None:
            payload[key] = parsed
    if _optional_str(kms_key_identifier):
        payload['KmsKeyIdentifier'] = _optional_str(kms_key_identifier)
    return payload


def create_pipe(**kwargs: Any) -> dict[str, Any]:
    tags = _tags(kwargs.pop('tags', None))
    payload = _pipe_payload(**kwargs)
    if tags:
        payload['Tags'] = tags
    response = _client().create_pipe(**payload)
    return {
        'name': payload['Name'],
        'arn': response.get('Arn'),
        'current_state': response.get('CurrentState'),
        'desired_state': response.get('DesiredState'),
        'response': _clean_response(response),
    }


def update_pipe(**kwargs: Any) -> dict[str, Any]:
    payload = _pipe_payload(**kwargs)
    response = _client().update_pipe(**payload)
    return {
        'name': payload['Name'],
        'arn': response.get('Arn'),
        'current_state': response.get('CurrentState'),
        'desired_state': response.get('DesiredState') or payload['DesiredState'],
        'response': _clean_response(response),
    }


def delete_pipe(name: Any) -> dict[str, Any]:
    clean_name = _required(name, 'Pipe name')
    response = _client().delete_pipe(Name=clean_name)
    return {
        'name': clean_name,
        'arn': response.get('Arn'),
        'current_state': response.get('CurrentState'),
        'deleted': True,
        'response': _clean_response(response),
    }


def start_pipe(name: Any) -> dict[str, Any]:
    clean_name = _required(name, 'Pipe name')
    response = _client().start_pipe(Name=clean_name)
    return {'name': clean_name, 'current_state': response.get('CurrentState'), 'response': _clean_response(response)}


def stop_pipe(name: Any) -> dict[str, Any]:
    clean_name = _required(name, 'Pipe name')
    response = _client().stop_pipe(Name=clean_name)
    return {'name': clean_name, 'current_state': response.get('CurrentState'), 'response': _clean_response(response)}


def tag_pipe(resource_arn: Any, tags: Any) -> dict[str, Any]:
    clean_tags = _tags(tags)
    if not clean_tags:
        raise ValueError('At least one tag is required')
    response = _client().tag_resource(resourceArn=_required(resource_arn, 'Resource ARN'), tags=clean_tags)
    return {'resource_arn': resource_arn, 'tags': clean_tags, 'response': _clean_response(response)}


def untag_pipe(resource_arn: Any, tag_keys: Any) -> dict[str, Any]:
    clean_keys = _tag_keys(tag_keys)
    if not clean_keys:
        raise ValueError('At least one tag key is required')
    response = _client().untag_resource(resourceArn=_required(resource_arn, 'Resource ARN'), tagKeys=clean_keys)
    return {'resource_arn': resource_arn, 'tag_keys': clean_keys, 'response': _clean_response(response)}
