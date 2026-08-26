"""HTTP endpoints for the RDS Data API SQL query workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .rdsdata_api import (
    batch_execute_statement,
    begin_transaction,
    commit_transaction,
    execute_statement,
    rollback_transaction,
)


@require_http_methods(['POST'])
def rdsdata_execute(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(execute_statement(
            resource_arn=body.get('resource_arn') or body.get('resourceArn', ''),
            secret_arn=body.get('secret_arn') or body.get('secretArn', ''),
            sql=body.get('sql', ''),
            database=body.get('database') or None,
            schema=body.get('schema') or None,
            parameters=body.get('parameters') or None,
            transaction_id=body.get('transaction_id') or body.get('transactionId') or None,
            include_result_metadata=body.get('include_result_metadata', True),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='rdsdata', operation='execute_statement')


@require_http_methods(['POST'])
def rdsdata_batch_execute(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(batch_execute_statement(
            resource_arn=body.get('resource_arn') or body.get('resourceArn', ''),
            secret_arn=body.get('secret_arn') or body.get('secretArn', ''),
            sql=body.get('sql', ''),
            parameter_sets=body.get('parameter_sets') or body.get('parameterSets', []),
            database=body.get('database') or None,
            schema=body.get('schema') or None,
            transaction_id=body.get('transaction_id') or body.get('transactionId') or None,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='rdsdata', operation='batch_execute_statement')


@require_http_methods(['POST'])
def rdsdata_transaction_begin(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(begin_transaction(
            resource_arn=body.get('resource_arn') or body.get('resourceArn', ''),
            secret_arn=body.get('secret_arn') or body.get('secretArn', ''),
            database=body.get('database') or None,
            schema=body.get('schema') or None,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='rdsdata', operation='begin_transaction')


@require_http_methods(['POST'])
def rdsdata_transaction_commit(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(commit_transaction(
            resource_arn=body.get('resource_arn') or body.get('resourceArn', ''),
            secret_arn=body.get('secret_arn') or body.get('secretArn', ''),
            transaction_id=body.get('transaction_id') or body.get('transactionId', ''),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='rdsdata', operation='commit_transaction')


@require_http_methods(['POST'])
def rdsdata_transaction_rollback(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(rollback_transaction(
            resource_arn=body.get('resource_arn') or body.get('resourceArn', ''),
            secret_arn=body.get('secret_arn') or body.get('secretArn', ''),
            transaction_id=body.get('transaction_id') or body.get('transactionId', ''),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='rdsdata', operation='rollback_transaction')
