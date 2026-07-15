"""Interactive Lambda helpers for the invoke workbench."""

from __future__ import annotations

import base64
import json
from typing import Any

from .aws import FlociClientFactory, _clean_response


def _lambda_client():
    return FlociClientFactory().client('lambda')


def validate_function_name(name: str) -> str:
    value = (name or '').strip()
    if not value:
        raise ValueError('Function name is required')
    return value


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _object(value: Any, label: str, *, empty: bool = True) -> dict[str, Any]:
    if value in (None, '') and empty:
        return {}
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise ValueError(f'{label} must be valid JSON') from exc
    if not isinstance(value, dict):
        raise ValueError(f'{label} must be a JSON object')
    return value


def create_function(name: str, role: str, code: Any, *, configuration: Any = None, tags: Any = None) -> dict[str, Any]:
    kwargs = {
        **_object(configuration, 'Configuration'),
        'FunctionName': validate_function_name(name),
        'Role': _required(role, 'Execution role ARN'),
        'Code': _object(code, 'Code', empty=False),
    }
    clean_tags = _object(tags, 'Tags')
    if clean_tags:
        kwargs['Tags'] = {str(key): str(value) for key, value in clean_tags.items()}
    response = _lambda_client().create_function(**kwargs)
    return {'function_name': kwargs['FunctionName'], 'arn': response.get('FunctionArn'), 'state': response.get('State'), 'response': _clean_response(response)}


def update_function_configuration(name: str, configuration: Any) -> dict[str, Any]:
    kwargs = _object(configuration, 'Configuration', empty=False)
    kwargs['FunctionName'] = validate_function_name(name)
    response = _lambda_client().update_function_configuration(**kwargs)
    return {'function_name': kwargs['FunctionName'], 'state': response.get('State'), 'response': _clean_response(response)}


def update_function_code(name: str, code: Any, *, publish: bool = False) -> dict[str, Any]:
    kwargs = _object(code, 'Code', empty=False)
    kwargs.update(FunctionName=validate_function_name(name), Publish=bool(publish))
    response = _lambda_client().update_function_code(**kwargs)
    return {'function_name': kwargs['FunctionName'], 'version': response.get('Version'), 'response': _clean_response(response)}


def delete_function(name: str, *, qualifier: str = '') -> dict[str, Any]:
    kwargs = {'FunctionName': validate_function_name(name)}
    if qualifier:
        kwargs['Qualifier'] = str(qualifier).strip()
    response = _lambda_client().delete_function(**kwargs)
    return {'function_name': kwargs['FunctionName'], 'qualifier': kwargs.get('Qualifier'), 'deleted': True, 'response': _clean_response(response)}


def publish_version(name: str, *, description: str = '') -> dict[str, Any]:
    kwargs = {'FunctionName': validate_function_name(name)}
    if description:
        kwargs['Description'] = str(description)
    response = _lambda_client().publish_version(**kwargs)
    return {'function_name': kwargs['FunctionName'], 'version': response.get('Version'), 'response': _clean_response(response)}


def save_alias(function_name: str, alias_name: str, function_version: str, *, description: str = '', update: bool = False) -> dict[str, Any]:
    kwargs = {'FunctionName': validate_function_name(function_name), 'Name': _required(alias_name, 'Alias name'), 'FunctionVersion': _required(function_version, 'Function version')}
    if description:
        kwargs['Description'] = str(description)
    client = _lambda_client()
    response = client.update_alias(**kwargs) if update else client.create_alias(**kwargs)
    return {'function_name': kwargs['FunctionName'], 'alias': kwargs['Name'], 'version': response.get('FunctionVersion'), 'response': _clean_response(response)}


def delete_alias(function_name: str, alias_name: str) -> dict[str, Any]:
    clean_function = validate_function_name(function_name)
    clean_alias = _required(alias_name, 'Alias name')
    response = _lambda_client().delete_alias(FunctionName=clean_function, Name=clean_alias)
    return {'function_name': clean_function, 'alias': clean_alias, 'deleted': True, 'response': _clean_response(response)}


def save_event_source_mapping(function_name: str, options: Any, *, uuid: str = '') -> dict[str, Any]:
    kwargs = _object(options, 'Event source mapping', empty=False)
    client = _lambda_client()
    if uuid:
        kwargs['UUID'] = _required(uuid, 'Mapping UUID')
        response = client.update_event_source_mapping(**kwargs)
    else:
        kwargs['FunctionName'] = validate_function_name(function_name)
        response = client.create_event_source_mapping(**kwargs)
    return {'function_name': function_name, 'uuid': response.get('UUID'), 'state': response.get('State'), 'response': _clean_response(response)}


def delete_event_source_mapping(uuid: str) -> dict[str, Any]:
    clean_uuid = _required(uuid, 'Mapping UUID')
    response = _lambda_client().delete_event_source_mapping(UUID=clean_uuid)
    return {'uuid': clean_uuid, 'deleted': True, 'response': _clean_response(response)}


def save_function_url(function_name: str, options: Any, *, update: bool = False) -> dict[str, Any]:
    kwargs = _object(options, 'Function URL configuration', empty=False)
    kwargs['FunctionName'] = validate_function_name(function_name)
    client = _lambda_client()
    response = client.update_function_url_config(**kwargs) if update else client.create_function_url_config(**kwargs)
    return {'function_name': kwargs['FunctionName'], 'function_url': response.get('FunctionUrl'), 'response': _clean_response(response)}


def delete_function_url(function_name: str) -> dict[str, Any]:
    clean_name = validate_function_name(function_name)
    response = _lambda_client().delete_function_url_config(FunctionName=clean_name)
    return {'function_name': clean_name, 'deleted': True, 'response': _clean_response(response)}


def set_concurrency(function_name: str, value: Any = None) -> dict[str, Any]:
    clean_name = validate_function_name(function_name)
    client = _lambda_client()
    if value in (None, ''):
        response = client.delete_function_concurrency(FunctionName=clean_name)
        return {'function_name': clean_name, 'reserved_concurrency': None, 'response': _clean_response(response)}
    try:
        concurrency = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError('Reserved concurrency must be a number') from exc
    response = client.put_function_concurrency(FunctionName=clean_name, ReservedConcurrentExecutions=concurrency)
    return {'function_name': clean_name, 'reserved_concurrency': response.get('ReservedConcurrentExecutions'), 'response': _clean_response(response)}


def add_permission(function_name: str, statement: Any) -> dict[str, Any]:
    kwargs = _object(statement, 'Permission statement', empty=False)
    kwargs['FunctionName'] = validate_function_name(function_name)
    response = _lambda_client().add_permission(**kwargs)
    return {'function_name': kwargs['FunctionName'], 'statement': response.get('Statement'), 'response': _clean_response(response)}


def remove_permission(function_name: str, statement_id: str) -> dict[str, Any]:
    clean_name = validate_function_name(function_name)
    clean_id = _required(statement_id, 'Statement ID')
    response = _lambda_client().remove_permission(FunctionName=clean_name, StatementId=clean_id)
    return {'function_name': clean_name, 'statement_id': clean_id, 'removed': True, 'response': _clean_response(response)}


def update_tags(resource_arn: str, tags: Any = None, *, remove: Any = None) -> dict[str, Any]:
    arn = _required(resource_arn, 'Resource ARN')
    client = _lambda_client()
    if remove not in (None, '', []):
        keys = remove if isinstance(remove, list) else [item.strip() for item in str(remove).split(',') if item.strip()]
        response = client.untag_resource(Resource=arn, TagKeys=keys)
        return {'resource_arn': arn, 'removed': keys, 'response': _clean_response(response)}
    clean_tags = _object(tags, 'Tags', empty=False)
    response = client.tag_resource(Resource=arn, Tags={str(key): str(value) for key, value in clean_tags.items()})
    return {'resource_arn': arn, 'tags': clean_tags, 'response': _clean_response(response)}


def _payload_bytes(payload: Any) -> bytes:
    if payload in (None, ''):
        return b'{}'
    if isinstance(payload, str):
        try:
            json.loads(payload)
        except json.JSONDecodeError as exc:
            raise ValueError('Payload must be valid JSON') from exc
        return payload.encode('utf-8')
    return json.dumps(payload).encode('utf-8')


def _read_payload(stream: Any) -> dict[str, Any]:
    if stream is None:
        return {'raw': ''}

    raw = stream.read() if hasattr(stream, 'read') else stream
    if isinstance(raw, bytes):
        text = raw.decode('utf-8')
    else:
        text = str(raw or '')

    if not text:
        return {'raw': ''}

    try:
        return {'json': json.loads(text), 'raw': text}
    except json.JSONDecodeError:
        return {'raw': text}


def invoke_function(
    name: str,
    payload: Any = None,
    *,
    qualifier: str | None = None,
    invocation_type: str = 'RequestResponse',
) -> dict[str, Any]:
    function_name = validate_function_name(name)
    request: dict[str, Any] = {
        'FunctionName': function_name,
        'InvocationType': invocation_type if invocation_type in {'RequestResponse', 'Event', 'DryRun'} else 'RequestResponse',
        'Payload': _payload_bytes(payload),
    }
    if request['InvocationType'] == 'RequestResponse':
        request['LogType'] = 'Tail'
    if qualifier:
        request['Qualifier'] = qualifier

    response = _lambda_client().invoke(**request)
    log_tail = response.get('LogResult')
    if log_tail:
        try:
            log_tail = base64.b64decode(log_tail).decode('utf-8')
        except (ValueError, UnicodeDecodeError):
            pass

    return {
        'function_name': function_name,
        'status_code': response.get('StatusCode'),
        'executed_version': response.get('ExecutedVersion'),
        'function_error': response.get('FunctionError'),
        'log_tail': log_tail,
        'payload': _read_payload(response.get('Payload')),
        'log_group': f'/aws/lambda/{function_name}',
    }
