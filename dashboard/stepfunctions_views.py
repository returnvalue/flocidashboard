"""HTTP endpoints for the Step Functions execution workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .stepfunctions_api import start_execution, stop_execution


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
