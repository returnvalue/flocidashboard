"""HTTP endpoints for the Neptune workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .neptune_api import (
    create_db_cluster,
    create_db_instance,
    delete_db_cluster,
    delete_db_instance,
    modify_db_cluster,
    modify_db_instance,
)


@require_http_methods(['POST'])
def neptune_clusters_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_db_cluster(
            body.get('identifier') or '',
            engine=body.get('engine') or 'neptune',
            options=body.get('options') or {},
        ))
    except Exception as exc:
        return handle_action_error(exc, service='neptune', operation='create_db_cluster')


@require_http_methods(['PATCH', 'DELETE'])
def neptune_cluster_detail(request, cluster_identifier: str):
    try:
        if request.method == 'PATCH':
            body = parse_json_body(request)
            return JsonResponse(modify_db_cluster(cluster_identifier, options=body.get('options') or {}))
        body = parse_json_body(request) if request.body else {}
        return JsonResponse(delete_db_cluster(
            cluster_identifier,
            skip_final_snapshot=body.get('skip_final_snapshot', True),
        ))
    except Exception as exc:
        operation = 'modify_db_cluster' if request.method == 'PATCH' else 'delete_db_cluster'
        return handle_action_error(exc, service='neptune', operation=operation)


@require_http_methods(['POST'])
def neptune_instances_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_db_instance(
            body.get('identifier') or '',
            cluster_identifier=body.get('cluster_identifier') or '',
            instance_class=body.get('instance_class') or 'db.r5.large',
            engine=body.get('engine') or 'neptune',
            options=body.get('options') or {},
        ))
    except Exception as exc:
        return handle_action_error(exc, service='neptune', operation='create_db_instance')


@require_http_methods(['PATCH', 'DELETE'])
def neptune_instance_detail(request, instance_identifier: str):
    try:
        if request.method == 'PATCH':
            body = parse_json_body(request)
            return JsonResponse(modify_db_instance(instance_identifier, options=body.get('options') or {}))
        return JsonResponse(delete_db_instance(instance_identifier))
    except Exception as exc:
        operation = 'modify_db_instance' if request.method == 'PATCH' else 'delete_db_instance'
        return handle_action_error(exc, service='neptune', operation=operation)
