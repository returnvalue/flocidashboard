"""HTTP endpoints for the MSK/Kafka workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .kafka_api import create_cluster, create_cluster_v2, delete_cluster, get_bootstrap_brokers


@require_http_methods(['POST'])
def kafka_clusters_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_cluster(
            body.get('name') or '',
            kafka_version=body.get('kafka_version') or '3.6.1',
            number_of_broker_nodes=body.get('number_of_broker_nodes') or 1,
            broker_node_group_info=body.get('broker_node_group_info') or {},
            tags=body.get('tags') or {},
        ))
    except Exception as exc:
        return handle_action_error(exc, service='kafka', operation='create_cluster')


@require_http_methods(['POST'])
def kafka_clusters_create_v2(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_cluster_v2(
            body.get('name') or '',
            kafka_version=body.get('kafka_version') or '3.6.1',
            number_of_broker_nodes=body.get('number_of_broker_nodes') or 1,
            broker_node_group_info=body.get('broker_node_group_info') or {},
            tags=body.get('tags') or {},
        ))
    except Exception as exc:
        return handle_action_error(exc, service='kafka', operation='create_cluster_v2')


@require_http_methods(['DELETE'])
def kafka_cluster_detail(request, cluster_arn: str):
    try:
        return JsonResponse(delete_cluster(cluster_arn))
    except Exception as exc:
        return handle_action_error(exc, service='kafka', operation='delete_cluster')


@require_http_methods(['GET'])
def kafka_bootstrap_brokers(request, cluster_arn: str):
    try:
        return JsonResponse(get_bootstrap_brokers(cluster_arn))
    except Exception as exc:
        return handle_action_error(exc, service='kafka', operation='get_bootstrap_brokers')
