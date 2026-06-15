"""HTTP endpoints for the Glue catalog workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .glue_api import (
    create_database,
    create_partition,
    create_registry,
    create_schema,
    create_table,
    create_user_defined_function,
    batch_delete_tables,
    delete_database,
    delete_table,
    delete_table_column_statistics,
    delete_user_defined_function,
    register_schema_version,
    update_database,
)


@require_http_methods(['POST'])
def glue_databases_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_database(
            body.get('name') or '',
            description=body.get('description') or '',
            location_uri=body.get('location_uri') or '',
            parameters=body.get('parameters') or {},
        ))
    except Exception as exc:
        return handle_action_error(exc, service='glue', operation='create_database')


@require_http_methods(['PUT', 'DELETE'])
def glue_database_detail(request, database_name: str):
    try:
        if request.method == 'PUT':
            body = parse_json_body(request)
            return JsonResponse(update_database(
                database_name,
                new_name=body.get('new_name') or '',
                description=body.get('description') or '',
                location_uri=body.get('location_uri') or '',
                parameters=body.get('parameters') or {},
            ))
        return JsonResponse(delete_database(database_name))
    except Exception as exc:
        operation = 'update_database' if request.method == 'PUT' else 'delete_database'
        return handle_action_error(exc, service='glue', operation=operation)


@require_http_methods(['POST'])
def glue_tables_create(request, database_name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_table(database_name, body.get('table_input') or {}))
    except Exception as exc:
        return handle_action_error(exc, service='glue', operation='create_table')


@require_http_methods(['POST'])
def glue_tables_batch_delete(request, database_name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(batch_delete_tables(database_name, body.get('table_names') or []))
    except Exception as exc:
        return handle_action_error(exc, service='glue', operation='batch_delete_tables')


@require_http_methods(['DELETE'])
def glue_table_detail(request, database_name: str, table_name: str):
    try:
        return JsonResponse(delete_table(database_name, table_name))
    except Exception as exc:
        return handle_action_error(exc, service='glue', operation='delete_table')


@require_http_methods(['DELETE'])
def glue_table_column_statistics_detail(request, database_name: str, table_name: str, column_name: str):
    try:
        return JsonResponse(delete_table_column_statistics(database_name, table_name, column_name))
    except Exception as exc:
        return handle_action_error(exc, service='glue', operation='delete_table_column_statistics')


@require_http_methods(['POST'])
def glue_functions_create(request, database_name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_user_defined_function(database_name, body.get('function_input') or {}))
    except Exception as exc:
        return handle_action_error(exc, service='glue', operation='create_user_defined_function')


@require_http_methods(['DELETE'])
def glue_function_detail(request, database_name: str, function_name: str):
    try:
        return JsonResponse(delete_user_defined_function(database_name, function_name))
    except Exception as exc:
        return handle_action_error(exc, service='glue', operation='delete_user_defined_function')


@require_http_methods(['POST'])
def glue_partitions_create(request, database_name: str, table_name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_partition(
            database_name,
            table_name,
            values=body.get('values') or [],
            storage_descriptor=body.get('storage_descriptor') or {},
            parameters=body.get('parameters') or {},
        ))
    except Exception as exc:
        return handle_action_error(exc, service='glue', operation='create_partition')


@require_http_methods(['POST'])
def glue_registries_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_registry(
            body.get('registry_name') or '',
            description=body.get('description') or '',
            tags=body.get('tags') or {},
        ))
    except Exception as exc:
        return handle_action_error(exc, service='glue', operation='create_registry')


@require_http_methods(['POST'])
def glue_schemas_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_schema(
            body.get('registry_name') or '',
            body.get('schema_name') or '',
            data_format=body.get('data_format') or '',
            compatibility=body.get('compatibility') or 'BACKWARD',
            schema_definition=body.get('schema_definition') or '',
            description=body.get('description') or '',
            tags=body.get('tags') or {},
        ))
    except Exception as exc:
        return handle_action_error(exc, service='glue', operation='create_schema')


@require_http_methods(['POST'])
def glue_schema_versions_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(register_schema_version(
            body.get('registry_name') or '',
            body.get('schema_name') or '',
            body.get('schema_definition') or '',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='glue', operation='register_schema_version')
