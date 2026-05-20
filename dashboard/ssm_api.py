"""Interactive SSM Parameter Store helpers for local configuration workflows."""

from __future__ import annotations

import json
from typing import Any

from .aws import FlociClientFactory

PARAMETER_TYPES = {'String', 'StringList', 'SecureString'}


def _client():
    return FlociClientFactory().client('ssm')


def _clean_required(value: str, label: str) -> str:
    cleaned = (value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _parameter_type(value: str) -> str:
    parameter_type = (value or 'String').strip()
    if parameter_type not in PARAMETER_TYPES:
        raise ValueError('Parameter type must be String, StringList, or SecureString')
    return parameter_type


def _parameter_value(value: Any) -> str:
    if value in (None, ''):
        raise ValueError('Parameter value is required')
    if isinstance(value, str):
        return value
    return json.dumps(value)


def _json_datetime(value: Any) -> Any:
    return value.isoformat() if hasattr(value, 'isoformat') else value


def _decoded_value(value: str) -> dict[str, Any]:
    parsed: Any = None
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        parsed = None
    return {
        'value': value,
        'json': parsed,
        'size_bytes': len(value.encode('utf-8')),
    }


def put_parameter(
    name: str,
    value: Any,
    *,
    parameter_type: str = 'String',
    description: str = '',
    overwrite: bool = False,
) -> dict[str, Any]:
    parameter_name = _clean_required(name, 'Parameter name')
    kwargs: dict[str, Any] = {
        'Name': parameter_name,
        'Value': _parameter_value(value),
        'Type': _parameter_type(parameter_type),
        'Overwrite': bool(overwrite),
    }
    if description:
        kwargs['Description'] = description

    response = _client().put_parameter(**kwargs)
    return {
        'name': parameter_name,
        'type': kwargs['Type'],
        'version': response.get('Version'),
        'tier': response.get('Tier'),
    }


def get_parameter(name: str, *, with_decryption: bool = True) -> dict[str, Any]:
    parameter_name = _clean_required(name, 'Parameter name')
    response = _client().get_parameter(
        Name=parameter_name,
        WithDecryption=bool(with_decryption),
    )
    parameter = response.get('Parameter') or {}
    decoded = _decoded_value(parameter.get('Value') or '')
    return {
        'name': parameter.get('Name') or parameter_name,
        'type': parameter.get('Type'),
        'version': parameter.get('Version'),
        'selector': parameter.get('Selector'),
        'source_result': parameter.get('SourceResult'),
        'last_modified': _json_datetime(parameter.get('LastModifiedDate')),
        'arn': parameter.get('ARN'),
        'data_type': parameter.get('DataType'),
        **decoded,
    }


def delete_parameter(name: str) -> dict[str, Any]:
    parameter_name = _clean_required(name, 'Parameter name')
    response = _client().delete_parameter(Name=parameter_name)
    return {
        'name': parameter_name,
        'response': response,
    }
