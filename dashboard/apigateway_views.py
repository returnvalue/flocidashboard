"""HTTP endpoints for the API Gateway request workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .apigateway_api import create_api, delete_api, test_api_request


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


@require_http_methods(['POST'])
def apigateway_apis_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_api(body.get('api_type', ''), body.get('name', ''), description=body.get('description') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='apigateway', operation='create_api')


@require_http_methods(['POST'])
def apigateway_apis_delete(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(delete_api(body.get('api_type', ''), body.get('api_id', '')))
    except Exception as exc:
        return handle_action_error(exc, service='apigateway', operation='delete_api')
