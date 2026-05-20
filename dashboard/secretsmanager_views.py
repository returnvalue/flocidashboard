"""HTTP endpoints for the Secrets Manager workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .secretsmanager_api import create_secret, delete_secret, get_secret_value, put_secret_value


@require_http_methods(['POST'])
def secretsmanager_secrets_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_secret(
            body.get('name', ''),
            body.get('value'),
            description=body.get('description') or '',
            kms_key_id=body.get('kms_key_id') or '',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='secretsmanager', operation='create_secret')


@require_http_methods(['GET', 'PUT', 'DELETE'])
def secretsmanager_secret_value(request, secret_id: str):
    try:
        if request.method == 'GET':
            return JsonResponse(get_secret_value(secret_id))
        body = parse_json_body(request) if request.body else {}
        if request.method == 'PUT':
            return JsonResponse(put_secret_value(secret_id, body.get('value')))
        return JsonResponse(delete_secret(
            secret_id,
            recovery_window_days=body.get('recovery_window_days') or 7,
            force_delete_without_recovery=bool(body.get('force_delete_without_recovery')),
        ))
    except Exception as exc:
        operation = {
            'GET': 'get_secret_value',
            'PUT': 'put_secret_value',
            'DELETE': 'delete_secret',
        }.get(request.method, 'secret_value')
        return handle_action_error(exc, service='secretsmanager', operation=operation)
