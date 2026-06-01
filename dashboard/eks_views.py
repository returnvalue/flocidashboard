"""HTTP endpoints for the EKS cluster workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .eks_api import create_cluster, delete_cluster, list_tags, tag_resource, untag_resource


@require_http_methods(['POST'])
def eks_clusters_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_cluster(
            name=body.get('name') or '',
            role_arn=body.get('role_arn') or '',
            version=body.get('version') or '',
            subnet_ids=body.get('subnet_ids') or [],
            security_group_ids=body.get('security_group_ids') or [],
            tags=body.get('tags') or {},
        ))
    except Exception as exc:
        return handle_action_error(exc, service='eks', operation='create_cluster')


@require_http_methods(['POST'])
def eks_clusters_delete(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(delete_cluster(body.get('name') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='eks', operation='delete_cluster')


@require_http_methods(['POST', 'DELETE'])
def eks_tags(request):
    try:
        body = parse_json_body(request)
        if request.method == 'POST':
            return JsonResponse(tag_resource(body.get('resource_arn') or '', body.get('tags') or {}))
        return JsonResponse(untag_resource(body.get('resource_arn') or '', body.get('tag_keys') or []))
    except Exception as exc:
        operation = 'tag_resource' if request.method == 'POST' else 'untag_resource'
        return handle_action_error(exc, service='eks', operation=operation)


@require_http_methods(['POST'])
def eks_tags_list(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(list_tags(body.get('resource_arn') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='eks', operation='list_tags_for_resource')
