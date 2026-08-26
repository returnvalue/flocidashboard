"""HTTP endpoints for the Step Functions execution workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .stepfunctions_api import (
    create_state_machine, delete_state_machine, delete_state_machine_version,
    describe_execution, describe_state_machine, get_execution_history,
    publish_state_machine_version, start_execution, stop_execution,
)


@require_http_methods(['POST'])
def stepfunctions_state_machines_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_state_machine(
            name=body.get('name', ''),
            definition=body.get('definition'),
            role_arn=body.get('role_arn', ''),
            state_machine_type=body.get('type') or 'STANDARD',
            logging_configuration=body.get('logging_configuration'),
            tracing_configuration=body.get('tracing_configuration'),
            tags=body.get('tags'),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='stepfunctions', operation='create_state_machine')


@require_http_methods(['GET', 'DELETE'])
def stepfunctions_state_machine_detail(request, state_machine_arn: str):
    try:
        if request.method == 'DELETE':
            return JsonResponse(delete_state_machine(state_machine_arn))
        return JsonResponse(describe_state_machine(state_machine_arn))
    except Exception as exc:
        return handle_action_error(exc, service='stepfunctions', operation='delete_state_machine' if request.method == 'DELETE' else 'describe_state_machine')


@require_http_methods(['POST'])
def stepfunctions_executions_start(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(start_execution(
            body.get('state_machine_arn', ''),
            body.get('input'),
            name=body.get('name') or None,
            trace_header=body.get('trace_header') or None,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='stepfunctions', operation='start_execution')


@require_http_methods(['GET'])
def stepfunctions_execution_detail(request, execution_arn: str):
    try:
        return JsonResponse(describe_execution(execution_arn))
    except Exception as exc:
        return handle_action_error(exc, service='stepfunctions', operation='describe_execution')


@require_http_methods(['GET'])
def stepfunctions_execution_history(request, execution_arn: str):
    try:
        return JsonResponse(get_execution_history(execution_arn))
    except Exception as exc:
        return handle_action_error(exc, service='stepfunctions', operation='get_execution_history')


@require_http_methods(['POST'])
def stepfunctions_state_machine_versions_publish(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(publish_state_machine_version(
            body.get('state_machine_arn', ''),
            revision_id=body.get('revision_id') or None,
            description=body.get('description') or None,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='stepfunctions', operation='publish_state_machine_version')


@require_http_methods(['DELETE'])
def stepfunctions_state_machine_version_delete(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(delete_state_machine_version(body.get('state_machine_version_arn', '')))
    except Exception as exc:
        return handle_action_error(exc, service='stepfunctions', operation='delete_state_machine_version')


@require_http_methods(['POST'])
def stepfunctions_executions_stop(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(stop_execution(
            body.get('execution_arn', ''),
            error=body.get('error') or None,
            cause=body.get('cause') or None,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='stepfunctions', operation='stop_execution')
