"""HTTP endpoints for the DynamoDB table explorer."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .dynamodb_api import execute_select_statement, parse_start_key, scan_table


@require_http_methods(['POST'])
def dynamodb_table_scan(request, table_name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(scan_table(
            table_name,
            limit=body.get('limit') or 25,
            exclusive_start_key=parse_start_key(body.get('exclusive_start_key')),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='dynamodb', operation='scan_table')


@require_http_methods(['POST'])
def dynamodb_partiql_execute(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(execute_select_statement(
            body.get('statement', ''),
            limit=body.get('limit') or 25,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='dynamodb', operation='execute_select_statement')
