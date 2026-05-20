"""HTTP endpoints for the SSM Parameter Store workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .ssm_api import delete_parameter, get_parameter, put_parameter


@require_http_methods(['POST'])
def ssm_parameters_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(put_parameter(
            body.get('name', ''),
            body.get('value'),
            parameter_type=body.get('type') or 'String',
            description=body.get('description') or '',
            overwrite=bool(body.get('overwrite')),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='ssm', operation='put_parameter')


@require_http_methods(['GET', 'PUT', 'DELETE'])
def ssm_parameter_value(request, parameter_name: str):
    try:
        if request.method == 'GET':
            return JsonResponse(get_parameter(parameter_name, with_decryption=True))
        if request.method == 'PUT':
            body = parse_json_body(request)
            return JsonResponse(put_parameter(
                parameter_name,
                body.get('value'),
                parameter_type=body.get('type') or 'String',
                description=body.get('description') or '',
                overwrite=True,
            ))
        return JsonResponse(delete_parameter(parameter_name))
    except Exception as exc:
        operation = {
            'GET': 'get_parameter',
            'PUT': 'put_parameter',
            'DELETE': 'delete_parameter',
        }.get(request.method, 'parameter_value')
        return handle_action_error(exc, service='ssm', operation=operation)
