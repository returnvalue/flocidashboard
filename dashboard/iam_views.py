"""HTTP endpoints for the IAM identity workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .iam_api import (
    assume_role,
    attach_managed_policy,
    create_access_key,
    create_managed_policy,
    delete_access_key,
    delete_inline_policy,
    detach_managed_policy,
    get_inline_policy,
    get_managed_policy,
    put_inline_policy,
    update_access_key,
)


@require_http_methods(['POST'])
def iam_user_access_keys_create(request, user_name: str):
    try:
        return JsonResponse(create_access_key(user_name))
    except Exception as exc:
        return handle_action_error(exc, service='iam', operation='create_access_key')


@require_http_methods(['PUT', 'DELETE'])
def iam_user_access_key_detail(request, user_name: str, access_key_id: str):
    try:
        if request.method == 'DELETE':
            return JsonResponse(delete_access_key(user_name, access_key_id))
        body = parse_json_body(request)
        return JsonResponse(update_access_key(user_name, access_key_id, body.get('status', '')))
    except Exception as exc:
        operation = 'delete_access_key' if request.method == 'DELETE' else 'update_access_key'
        return handle_action_error(exc, service='iam', operation=operation)


@require_http_methods(['POST'])
def iam_role_assume(request, role_name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(assume_role(
            body.get('role_arn', ''),
            body.get('session_name') or f'{role_name}-dashboard',
            duration_seconds=body.get('duration_seconds') or None,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='iam', operation='assume_role')


@require_http_methods(['POST', 'DELETE'])
def iam_attached_policies(request, principal_type: str, principal_name: str):
    try:
        body = parse_json_body(request)
        if request.method == 'DELETE':
            return JsonResponse(detach_managed_policy(principal_type, principal_name, body.get('policy_arn', '')))
        return JsonResponse(attach_managed_policy(principal_type, principal_name, body.get('policy_arn', '')))
    except Exception as exc:
        operation = 'detach_managed_policy' if request.method == 'DELETE' else 'attach_managed_policy'
        return handle_action_error(exc, service='iam', operation=operation)


@require_http_methods(['PUT', 'DELETE'])
def iam_inline_policy_detail(request, principal_type: str, principal_name: str, policy_name: str):
    try:
        if request.method == 'DELETE':
            return JsonResponse(delete_inline_policy(principal_type, principal_name, policy_name))
        body = parse_json_body(request)
        return JsonResponse(put_inline_policy(principal_type, principal_name, policy_name, body.get('document')))
    except Exception as exc:
        operation = 'delete_inline_policy' if request.method == 'DELETE' else 'put_inline_policy'
        return handle_action_error(exc, service='iam', operation=operation)


@require_http_methods(['GET'])
def iam_inline_policy_document(request, principal_type: str, principal_name: str, policy_name: str):
    try:
        return JsonResponse(get_inline_policy(principal_type, principal_name, policy_name))
    except Exception as exc:
        return handle_action_error(exc, service='iam', operation='get_inline_policy')


@require_http_methods(['POST'])
def iam_managed_policies_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_managed_policy(
            body.get('name', ''),
            body.get('document'),
            description=body.get('description') or None,
            path=body.get('path') or None,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='iam', operation='create_managed_policy')


@require_http_methods(['POST'])
def iam_managed_policy_document(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(get_managed_policy(body.get('policy_arn', ''), version_id=body.get('version_id') or None))
    except Exception as exc:
        return handle_action_error(exc, service='iam', operation='get_managed_policy')
