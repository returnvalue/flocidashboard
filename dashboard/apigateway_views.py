"""HTTP endpoints for the API Gateway request workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .apigateway_api import test_api_request


@require_http_methods(['POST'])
def apigateway_requests_test(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(test_api_request(
            body.get('api_type', ''),
            body.get('api_id', ''),
            body.get('method', 'GET'),
            body.get('path', '/'),
            stage=body.get('stage') or '',
            endpoint=body.get('endpoint') or '',
            query=body.get('query') or None,
            headers=body.get('headers') or None,
            body=body.get('body'),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='apigateway', operation='test_request')
