"""HTTP endpoints for the ElastiCache local cache workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .elasticache_api import (
    create_replication_group,
    create_user,
    delete_replication_group,
    delete_user,
    modify_user,
    validate_iam_auth_token,
)


@require_http_methods(['POST'])
def elasticache_replication_groups_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_replication_group(
            replication_group_id=body.get('replication_group_id') or '',
            description=body.get('description') or '',
            engine=body.get('engine') or 'redis',
            cache_node_type=body.get('cache_node_type') or '',
            num_cache_clusters=body.get('num_cache_clusters') or 1,
            port=body.get('port'),
            user_group_ids=body.get('user_group_ids') or [],
            transit_encryption_enabled=body.get('transit_encryption_enabled') or False,
            at_rest_encryption_enabled=body.get('at_rest_encryption_enabled') or False,
            tags=body.get('tags') or [],
        ))
    except Exception as exc:
        return handle_action_error(exc, service='elasticache', operation='create_replication_group')


@require_http_methods(['POST'])
def elasticache_replication_groups_delete(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(delete_replication_group(
            body.get('replication_group_id') or '',
            retain_primary_cluster=body.get('retain_primary_cluster') or False,
            final_snapshot_identifier=body.get('final_snapshot_identifier') or '',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='elasticache', operation='delete_replication_group')


@require_http_methods(['POST'])
def elasticache_users_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_user(
            user_id=body.get('user_id') or '',
            user_name=body.get('user_name') or '',
            engine=body.get('engine') or 'redis',
            access_string=body.get('access_string') or 'on ~* +@all',
            auth_type=body.get('auth_type') or 'iam',
            authentication_mode=body.get('authentication_mode') or {},
            passwords=body.get('passwords') or [],
            no_password_required=body.get('no_password_required') or False,
            tags=body.get('tags') or [],
        ))
    except Exception as exc:
        return handle_action_error(exc, service='elasticache', operation='create_user')


@require_http_methods(['POST'])
def elasticache_users_modify(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(modify_user(
            user_id=body.get('user_id') or '',
            access_string=body.get('access_string') or '',
            append_access_string=body.get('append_access_string') or '',
            auth_type=body.get('auth_type') or '',
            authentication_mode=body.get('authentication_mode') or {},
            passwords=body.get('passwords') or [],
            no_password_required=body.get('no_password_required'),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='elasticache', operation='modify_user')


@require_http_methods(['POST'])
def elasticache_users_delete(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(delete_user(body.get('user_id') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='elasticache', operation='delete_user')


@require_http_methods(['POST'])
def elasticache_iam_auth_validate(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(validate_iam_auth_token(
            body.get('auth_token') or '',
            user_id=body.get('user_id') or '',
            user_name=body.get('user_name') or '',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='elasticache', operation='validate_iam_auth_token')
