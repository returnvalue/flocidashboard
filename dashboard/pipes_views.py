"""HTTP endpoints for the EventBridge Pipes workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .pipes_api import create_pipe, delete_pipe, start_pipe, stop_pipe, tag_pipe, untag_pipe, update_pipe


def _pipe_kwargs(body: dict, *, name: str | None = None) -> dict:
    return {
        'name': name if name is not None else body.get('name'),
        'source': body.get('source'),
        'target': body.get('target'),
        'role_arn': body.get('role_arn'),
        'desired_state': body.get('desired_state') or 'RUNNING',
        'description': body.get('description') or '',
        'source_parameters': body.get('source_parameters'),
        'target_parameters': body.get('target_parameters'),
        'enrichment': body.get('enrichment') or '',
        'enrichment_parameters': body.get('enrichment_parameters'),
        'log_configuration': body.get('log_configuration'),
        'kms_key_identifier': body.get('kms_key_identifier') or '',
    }


@require_http_methods(['POST'])
def pipes_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_pipe(**_pipe_kwargs(body), tags=body.get('tags') or {}))
    except Exception as exc:
        return handle_action_error(exc, service='pipes', operation='create_pipe')


@require_http_methods(['PUT', 'DELETE'])
def pipe_detail(request, pipe_name: str):
    if request.method == 'DELETE':
        try:
            return JsonResponse(delete_pipe(pipe_name))
        except Exception as exc:
            return handle_action_error(exc, service='pipes', operation='delete_pipe')

    try:
        body = parse_json_body(request)
        return JsonResponse(update_pipe(**_pipe_kwargs(body, name=pipe_name)))
    except Exception as exc:
        return handle_action_error(exc, service='pipes', operation='update_pipe')


@require_http_methods(['POST'])
def pipe_start(request, pipe_name: str):
    try:
        return JsonResponse(start_pipe(pipe_name))
    except Exception as exc:
        return handle_action_error(exc, service='pipes', operation='start_pipe')


@require_http_methods(['POST'])
def pipe_stop(request, pipe_name: str):
    try:
        return JsonResponse(stop_pipe(pipe_name))
    except Exception as exc:
        return handle_action_error(exc, service='pipes', operation='stop_pipe')


@require_http_methods(['POST', 'DELETE'])
def pipe_tags(request):
    try:
        body = parse_json_body(request)
        if request.method == 'POST':
            return JsonResponse(tag_pipe(body.get('resource_arn'), body.get('tags') or {}))
        return JsonResponse(untag_pipe(body.get('resource_arn'), body.get('tag_keys') or []))
    except Exception as exc:
        operation = 'tag_resource' if request.method == 'POST' else 'untag_resource'
        return handle_action_error(exc, service='pipes', operation=operation)
