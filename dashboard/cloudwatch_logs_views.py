"""HTTP endpoints for the CloudWatch Logs viewer."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .cloudwatch_logs_api import get_log_events, get_logs_insights_query_results, list_log_streams, start_logs_insights_query


@require_http_methods(['POST'])
def cloudwatch_log_streams(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(list_log_streams(
            body.get('log_group_name', ''),
            limit=body.get('limit') or 50,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='cloudwatch', operation='list_log_streams')


@require_http_methods(['POST'])
def cloudwatch_log_events(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(get_log_events(
            body.get('log_group_name', ''),
            body.get('log_stream_name', ''),
            limit=body.get('limit') or 50,
            start_time=body.get('start_time') or None,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='cloudwatch', operation='get_log_events')


@require_http_methods(['POST'])
def cloudwatch_logs_insights_query(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(start_logs_insights_query(
            body.get('log_group_name', ''),
            body.get('query_string', ''),
            start_time=body.get('start_time') or None,
            end_time=body.get('end_time') or None,
            limit=body.get('limit') or 100,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='cloudwatch', operation='start_logs_insights_query')


@require_http_methods(['POST'])
def cloudwatch_logs_insights_results(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(get_logs_insights_query_results(body.get('query_id', '')))
    except Exception as exc:
        return handle_action_error(exc, service='cloudwatch', operation='get_logs_insights_query_results')
