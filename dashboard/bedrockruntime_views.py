"""HTTP endpoints for the Bedrock Runtime workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .bedrockruntime_api import converse, invoke_model


@require_http_methods(['POST'])
def bedrockruntime_converse(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(converse(
            body.get('model_id') or '',
            body.get('messages') or [],
            system=body.get('system'),
            inference_config=body.get('inference_config'),
            tool_config=body.get('tool_config'),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='bedrockruntime', operation='converse')


@require_http_methods(['POST'])
def bedrockruntime_invoke_model(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(invoke_model(
            body.get('model_id') or '',
            body.get('body') if 'body' in body else {},
            content_type=body.get('content_type') or 'application/json',
            accept=body.get('accept') or 'application/json',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='bedrockruntime', operation='invoke_model')
