"""Interactive AppSync helpers for local GraphQL management workflows."""

from __future__ import annotations

from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('appsync')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _dict(value: Any, label: str) -> dict[str, Any]:
    if value in (None, ''):
        return {}
    if not isinstance(value, dict):
        raise ValueError(f'{label} must be an object')
    return value


def create_graphql_api(name: str, *, authentication_type: str = 'API_KEY', tags: Any = None) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        'name': _required(name, 'API name'),
        'authenticationType': _required(authentication_type or 'API_KEY', 'Authentication type'),
    }
    clean_tags = _dict(tags, 'Tags')
    if clean_tags:
        kwargs['tags'] = {str(key): str(value) for key, value in clean_tags.items()}
    response = _client().create_graphql_api(**kwargs)
    api = response.get('graphqlApi', {})
    return {'api_id': api.get('apiId'), 'graphql_api': _clean_response(api)}


def delete_graphql_api(api_id: str) -> dict[str, Any]:
    clean_id = _required(api_id, 'API ID')
    response = _client().delete_graphql_api(apiId=clean_id)
    return {'api_id': clean_id, 'response': _clean_response(response)}


def start_schema_creation(api_id: str, definition: str) -> dict[str, Any]:
    clean_id = _required(api_id, 'API ID')
    response = _client().start_schema_creation(
        apiId=clean_id,
        definition=_required(definition, 'Schema definition').encode('utf-8'),
    )
    return {'api_id': clean_id, 'status': response.get('status'), 'response': _clean_response(response)}


def create_api_key(api_id: str, *, description: str = '', expires: Any = None) -> dict[str, Any]:
    clean_id = _required(api_id, 'API ID')
    kwargs: dict[str, Any] = {'apiId': clean_id}
    if description:
        kwargs['description'] = description
    if expires not in (None, ''):
        kwargs['expires'] = int(expires)
    response = _client().create_api_key(**kwargs)
    return {'api_id': clean_id, 'api_key': _clean_response(response.get('apiKey', {}))}


def delete_api_key(api_id: str, key_id: str) -> dict[str, Any]:
    clean_api_id = _required(api_id, 'API ID')
    clean_key_id = _required(key_id, 'API key ID')
    response = _client().delete_api_key(apiId=clean_api_id, id=clean_key_id)
    return {'api_id': clean_api_id, 'key_id': clean_key_id, 'response': _clean_response(response)}


def create_data_source(api_id: str, name: str, *, source_type: str = 'NONE', description: str = '') -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        'apiId': _required(api_id, 'API ID'),
        'name': _required(name, 'Data source name'),
        'type': _required(source_type or 'NONE', 'Data source type'),
    }
    if description:
        kwargs['description'] = description
    response = _client().create_data_source(**kwargs)
    return {'api_id': kwargs['apiId'], 'data_source': _clean_response(response.get('dataSource', {}))}


def delete_data_source(api_id: str, name: str) -> dict[str, Any]:
    clean_api_id = _required(api_id, 'API ID')
    clean_name = _required(name, 'Data source name')
    response = _client().delete_data_source(apiId=clean_api_id, name=clean_name)
    return {'api_id': clean_api_id, 'name': clean_name, 'response': _clean_response(response)}


def create_resolver(api_id: str, type_name: str, field_name: str, *, data_source_name: str = '') -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        'apiId': _required(api_id, 'API ID'),
        'typeName': _required(type_name, 'Type name'),
        'fieldName': _required(field_name, 'Field name'),
    }
    if data_source_name:
        kwargs['dataSourceName'] = data_source_name
    response = _client().create_resolver(**kwargs)
    return {'api_id': kwargs['apiId'], 'resolver': _clean_response(response.get('resolver', {}))}


def delete_resolver(api_id: str, type_name: str, field_name: str) -> dict[str, Any]:
    kwargs = {
        'apiId': _required(api_id, 'API ID'),
        'typeName': _required(type_name, 'Type name'),
        'fieldName': _required(field_name, 'Field name'),
    }
    response = _client().delete_resolver(**kwargs)
    return {**kwargs, 'response': _clean_response(response)}


def create_function(api_id: str, name: str, data_source_name: str, *, description: str = '') -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        'apiId': _required(api_id, 'API ID'),
        'name': _required(name, 'Function name'),
        'dataSourceName': _required(data_source_name, 'Data source name'),
    }
    if description:
        kwargs['description'] = description
    response = _client().create_function(**kwargs)
    return {'api_id': kwargs['apiId'], 'function': _clean_response(response.get('functionConfiguration', {}))}


def delete_function(api_id: str, function_id: str) -> dict[str, Any]:
    clean_api_id = _required(api_id, 'API ID')
    clean_function_id = _required(function_id, 'Function ID')
    response = _client().delete_function(apiId=clean_api_id, functionId=clean_function_id)
    return {'api_id': clean_api_id, 'function_id': clean_function_id, 'response': _clean_response(response)}


def create_type(api_id: str, definition: str, *, format_name: str = 'SDL') -> dict[str, Any]:
    kwargs = {
        'apiId': _required(api_id, 'API ID'),
        'definition': _required(definition, 'Type definition'),
        'format': _required(format_name or 'SDL', 'Format'),
    }
    response = _client().create_type(**kwargs)
    return {'api_id': kwargs['apiId'], 'type': _clean_response(response.get('type', {}))}


def delete_type(api_id: str, type_name: str) -> dict[str, Any]:
    clean_api_id = _required(api_id, 'API ID')
    clean_type_name = _required(type_name, 'Type name')
    response = _client().delete_type(apiId=clean_api_id, typeName=clean_type_name)
    return {'api_id': clean_api_id, 'type_name': clean_type_name, 'response': _clean_response(response)}


def tag_resource(resource_arn: str, tags: Any) -> dict[str, Any]:
    clean_arn = _required(resource_arn, 'Resource ARN')
    clean_tags = {str(key): str(value) for key, value in _dict(tags, 'Tags').items()}
    if not clean_tags:
        raise ValueError('At least one tag is required')
    response = _client().tag_resource(resourceArn=clean_arn, tags=clean_tags)
    return {'resource_arn': clean_arn, 'tags': clean_tags, 'response': _clean_response(response)}


def untag_resource(resource_arn: str, tag_keys: Any) -> dict[str, Any]:
    clean_arn = _required(resource_arn, 'Resource ARN')
    if not isinstance(tag_keys, list) or not tag_keys:
        raise ValueError('Tag keys must be a non-empty array')
    clean_keys = [_required(key, 'Tag key') for key in tag_keys]
    response = _client().untag_resource(resourceArn=clean_arn, tagKeys=clean_keys)
    return {'resource_arn': clean_arn, 'tag_keys': clean_keys, 'response': _clean_response(response)}
