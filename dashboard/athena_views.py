"""HTTP endpoints for the Athena query workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .athena_api import (
    create_work_group,
    get_query_execution,
    get_query_results,
    start_query_execution,
    stop_query_execution,
)


@require_http_methods(['POST'])
def athena_queries_start(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(start_query_execution(
            query_string=body.get('query_string') or '',
            database=body.get('database') or '',
            catalog=body.get('catalog') or '',
            workgroup=body.get('workgroup') or '',
            output_location=body.get('output_location') or '',
            execution_parameters=body.get('execution_parameters') or [],
        ))
    except Exception as exc:
        return handle_action_error(exc, service='athena', operation='start_query_execution')


@require_http_methods(['POST'])
def athena_queries_stop(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(stop_query_execution(body.get('query_execution_id') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='athena', operation='stop_query_execution')


@require_http_methods(['POST'])
def athena_queries_results(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(get_query_results(
            body.get('query_execution_id') or '',
            max_results=body.get('max_results') or 25,
            next_token=body.get('next_token') or '',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='athena', operation='get_query_results')


@require_http_methods(['POST'])
def athena_queries_detail(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(get_query_execution(body.get('query_execution_id') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='athena', operation='get_query_execution')


@require_http_methods(['POST'])
def athena_workgroups_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_work_group(
            name=body.get('name') or '',
            description=body.get('description') or '',
            output_location=body.get('output_location') or '',
            configuration=body.get('configuration') or {},
            tags=body.get('tags') or [],
        ))
    except Exception as exc:
        return handle_action_error(exc, service='athena', operation='create_work_group')
