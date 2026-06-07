"""Interactive Glue helpers for Data Catalog and Schema Registry workflows."""

from __future__ import annotations

from typing import Any

from .aws import FlociClientFactory, _clean_response

DATA_FORMATS = {'AVRO', 'JSON', 'PROTOBUF'}
COMPATIBILITY_MODES = {
    'NONE',
    'DISABLED',
    'BACKWARD',
    'BACKWARD_ALL',
    'FORWARD',
    'FORWARD_ALL',
    'FULL',
    'FULL_ALL',
}


def _client():
    return FlociClientFactory().client('glue')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _dict_value(value: Any, label: str, *, required: bool = False) -> dict[str, Any]:
    if value in (None, ''):
        if required:
            raise ValueError(f'{label} is required')
        return {}
    if not isinstance(value, dict):
        raise ValueError(f'{label} must be a JSON object')
    return value


def _list_value(value: Any, label: str, *, required: bool = False) -> list[Any]:
    if value in (None, ''):
        if required:
            raise ValueError(f'{label} is required')
        return []
    if not isinstance(value, list):
        raise ValueError(f'{label} must be a JSON array')
    return value


def _tags(value: Any) -> dict[str, str]:
    if value in (None, ''):
        return {}
    if not isinstance(value, dict):
        raise ValueError('Tags must be a JSON object')
    return {str(key): str(item) for key, item in value.items()}


def _data_format(value: Any) -> str:
    clean = _required(value, 'Data format').upper()
    if clean not in DATA_FORMATS:
        raise ValueError('Data format must be AVRO, JSON, or PROTOBUF')
    return clean


def _compatibility(value: Any) -> str:
    clean = str(value or 'BACKWARD').strip().upper()
    if clean not in COMPATIBILITY_MODES:
        raise ValueError('Compatibility mode is not supported')
    return clean


def create_database(
    name: str,
    *,
    description: str = '',
    location_uri: str = '',
    parameters: Any = None,
) -> dict[str, Any]:
    database_input: dict[str, Any] = {'Name': _required(name, 'Database name')}
    if description:
        database_input['Description'] = description
    if location_uri:
        database_input['LocationUri'] = location_uri
    clean_parameters = _dict_value(parameters, 'Parameters')
    if clean_parameters:
        database_input['Parameters'] = clean_parameters

    response = _client().create_database(DatabaseInput=database_input)
    return {'database': database_input['Name'], 'response': _clean_response(response)}


def delete_database(name: str) -> dict[str, Any]:
    clean_name = _required(name, 'Database name')
    response = _client().delete_database(Name=clean_name)
    return {'database': clean_name, 'response': _clean_response(response)}


def create_table(database_name: str, table_input: Any) -> dict[str, Any]:
    clean_database = _required(database_name, 'Database name')
    clean_table = _dict_value(table_input, 'Table input', required=True)
    if not clean_table.get('Name'):
        raise ValueError('Table input Name is required')
    if not isinstance(clean_table.get('StorageDescriptor'), dict):
        raise ValueError('Table input StorageDescriptor is required')

    response = _client().create_table(DatabaseName=clean_database, TableInput=clean_table)
    return {
        'database': clean_database,
        'table': clean_table.get('Name'),
        'response': _clean_response(response),
    }


def delete_table(database_name: str, table_name: str) -> dict[str, Any]:
    clean_database = _required(database_name, 'Database name')
    clean_table = _required(table_name, 'Table name')
    response = _client().delete_table(DatabaseName=clean_database, Name=clean_table)
    return {'database': clean_database, 'table': clean_table, 'response': _clean_response(response)}


def create_user_defined_function(database_name: str, function_input: Any) -> dict[str, Any]:
    clean_database = _required(database_name, 'Database name')
    clean_function = _dict_value(function_input, 'Function input', required=True)
    function_name = clean_function.get('FunctionName') or clean_function.get('Name')
    if not function_name:
        raise ValueError('Function input FunctionName is required')
    clean_function['FunctionName'] = function_name

    response = _client().create_user_defined_function(
        DatabaseName=clean_database,
        FunctionInput=clean_function,
    )
    return {
        'database': clean_database,
        'function': function_name,
        'response': _clean_response(response),
    }


def delete_user_defined_function(database_name: str, function_name: str) -> dict[str, Any]:
    clean_database = _required(database_name, 'Database name')
    clean_function = _required(function_name, 'Function name')
    response = _client().delete_user_defined_function(
        DatabaseName=clean_database,
        FunctionName=clean_function,
    )
    return {'database': clean_database, 'function': clean_function, 'response': _clean_response(response)}


def create_partition(
    database_name: str,
    table_name: str,
    *,
    values: Any,
    storage_descriptor: Any = None,
    parameters: Any = None,
) -> dict[str, Any]:
    clean_database = _required(database_name, 'Database name')
    clean_table = _required(table_name, 'Table name')
    partition_input: dict[str, Any] = {
        'Values': [str(value) for value in _list_value(values, 'Partition values', required=True)],
    }
    clean_storage = _dict_value(storage_descriptor, 'Storage descriptor')
    if clean_storage:
        partition_input['StorageDescriptor'] = clean_storage
    clean_parameters = _dict_value(parameters, 'Parameters')
    if clean_parameters:
        partition_input['Parameters'] = clean_parameters

    response = _client().create_partition(
        DatabaseName=clean_database,
        TableName=clean_table,
        PartitionInput=partition_input,
    )
    return {
        'database': clean_database,
        'table': clean_table,
        'values': partition_input['Values'],
        'response': _clean_response(response),
    }


def create_registry(registry_name: str, *, description: str = '', tags: Any = None) -> dict[str, Any]:
    clean_name = _required(registry_name, 'Registry name')
    kwargs: dict[str, Any] = {'RegistryName': clean_name}
    if description:
        kwargs['Description'] = description
    clean_tags = _tags(tags)
    if clean_tags:
        kwargs['Tags'] = clean_tags

    response = _client().create_registry(**kwargs)
    return {'registry': clean_name, 'response': _clean_response(response)}


def create_schema(
    registry_name: str,
    schema_name: str,
    *,
    data_format: str,
    compatibility: str = 'BACKWARD',
    schema_definition: str = '',
    description: str = '',
    tags: Any = None,
) -> dict[str, Any]:
    clean_registry = _required(registry_name, 'Registry name')
    clean_schema = _required(schema_name, 'Schema name')
    kwargs: dict[str, Any] = {
        'RegistryId': {'RegistryName': clean_registry},
        'SchemaName': clean_schema,
        'DataFormat': _data_format(data_format),
        'Compatibility': _compatibility(compatibility),
        'SchemaDefinition': _required(schema_definition, 'Schema definition'),
    }
    if description:
        kwargs['Description'] = description
    clean_tags = _tags(tags)
    if clean_tags:
        kwargs['Tags'] = clean_tags

    response = _client().create_schema(**kwargs)
    return {'registry': clean_registry, 'schema': clean_schema, 'response': _clean_response(response)}


def register_schema_version(registry_name: str, schema_name: str, schema_definition: str) -> dict[str, Any]:
    clean_registry = _required(registry_name, 'Registry name')
    clean_schema = _required(schema_name, 'Schema name')
    response = _client().register_schema_version(
        SchemaId={'RegistryName': clean_registry, 'SchemaName': clean_schema},
        SchemaDefinition=_required(schema_definition, 'Schema definition'),
    )
    return {'registry': clean_registry, 'schema': clean_schema, 'response': _clean_response(response)}
