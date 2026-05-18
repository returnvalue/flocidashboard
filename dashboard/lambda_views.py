"""HTTP endpoints for the Lambda invoke workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .lambda_api import invoke_function


@require_http_methods(['POST'])
def lambda_functions_invoke(request, function_name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(invoke_function(
            function_name,
            body.get('payload'),
            qualifier=body.get('qualifier') or None,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='lambda', operation='invoke_function')
