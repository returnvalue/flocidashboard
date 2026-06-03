"""HTTP endpoints for the Transfer Family workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .transfer_api import (
    create_server,
    create_user,
    delete_server,
    delete_ssh_public_key,
    delete_user,
    import_ssh_public_key,
    start_server,
    stop_server,
    tag_resource,
    untag_resource,
    update_server,
    update_user,
)


@require_http_methods(['POST'])
def transfer_servers_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_server(
            protocols=body.get('protocols') or ['SFTP'],
            endpoint_type=body.get('endpoint_type') or 'PUBLIC',
            domain=body.get('domain') or 'S3',
            logging_role=body.get('logging_role') or '',
            security_policy_name=body.get('security_policy_name') or '',
            tags=body.get('tags') or [],
        ))
    except Exception as exc:
        return handle_action_error(exc, service='transfer', operation='create_server')


@require_http_methods(['PATCH', 'DELETE'])
def transfer_server_detail(request, server_id: str):
    try:
        if request.method == 'PATCH':
            body = parse_json_body(request)
            return JsonResponse(update_server(server_id, body.get('options') or {}))
        return JsonResponse(delete_server(server_id))
    except Exception as exc:
        operation = 'update_server' if request.method == 'PATCH' else 'delete_server'
        return handle_action_error(exc, service='transfer', operation=operation)


@require_http_methods(['POST'])
def transfer_server_start(request, server_id: str):
    try:
        return JsonResponse(start_server(server_id))
    except Exception as exc:
        return handle_action_error(exc, service='transfer', operation='start_server')


@require_http_methods(['POST'])
def transfer_server_stop(request, server_id: str):
    try:
        return JsonResponse(stop_server(server_id))
    except Exception as exc:
        return handle_action_error(exc, service='transfer', operation='stop_server')


@require_http_methods(['POST'])
def transfer_users_create(request, server_id: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_user(
            server_id,
            body.get('user_name') or '',
            role=body.get('role') or '',
            home_directory=body.get('home_directory') or '',
            home_directory_mappings=body.get('home_directory_mappings') or [],
            policy=body.get('policy') or '',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='transfer', operation='create_user')


@require_http_methods(['PATCH', 'DELETE'])
def transfer_user_detail(request, server_id: str, user_name: str):
    try:
        if request.method == 'PATCH':
            body = parse_json_body(request)
            return JsonResponse(update_user(server_id, user_name, body.get('options') or {}))
        return JsonResponse(delete_user(server_id, user_name))
    except Exception as exc:
        operation = 'update_user' if request.method == 'PATCH' else 'delete_user'
        return handle_action_error(exc, service='transfer', operation=operation)


@require_http_methods(['POST'])
def transfer_ssh_public_keys_import(request, server_id: str, user_name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(import_ssh_public_key(server_id, user_name, body.get('ssh_public_key_body') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='transfer', operation='import_ssh_public_key')


@require_http_methods(['DELETE'])
def transfer_ssh_public_key_detail(request, server_id: str, user_name: str, ssh_public_key_id: str):
    try:
        return JsonResponse(delete_ssh_public_key(server_id, user_name, ssh_public_key_id))
    except Exception as exc:
        return handle_action_error(exc, service='transfer', operation='delete_ssh_public_key')


@require_http_methods(['POST', 'DELETE'])
def transfer_tags(request):
    try:
        body = parse_json_body(request)
        if request.method == 'DELETE':
            return JsonResponse(untag_resource(body.get('arn') or '', body.get('tag_keys') or []))
        return JsonResponse(tag_resource(body.get('arn') or '', body.get('tags') or []))
    except Exception as exc:
        operation = 'untag_resource' if request.method == 'DELETE' else 'tag_resource'
        return handle_action_error(exc, service='transfer', operation=operation)
