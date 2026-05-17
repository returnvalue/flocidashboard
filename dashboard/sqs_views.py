"""HTTP endpoints for the SQS queue workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .sqs_api import create_queue, delete_message, delete_queue, purge_queue, receive_messages, send_message


@require_http_methods(['POST'])
def sqs_queues_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_queue(
            body.get('name', ''),
            fifo=bool(body.get('fifo')),
            visibility_timeout=body.get('visibility_timeout') or None,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='sqs', operation='create_queue')


@require_http_methods(['DELETE'])
def sqs_queue_delete(request, queue_name: str):
    try:
        return JsonResponse(delete_queue(queue_name))
    except Exception as exc:
        return handle_action_error(exc, service='sqs', operation='delete_queue')


@require_http_methods(['POST'])
def sqs_queue_purge(request, queue_name: str):
    try:
        return JsonResponse(purge_queue(queue_name))
    except Exception as exc:
        return handle_action_error(exc, service='sqs', operation='purge_queue')


@require_http_methods(['POST'])
def sqs_messages_send(request, queue_name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(send_message(
            queue_name,
            body.get('body', ''),
            delay_seconds=body.get('delay_seconds') or None,
            message_group_id=body.get('message_group_id') or None,
            message_deduplication_id=body.get('message_deduplication_id') or None,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='sqs', operation='send_message')


@require_http_methods(['POST'])
def sqs_messages_receive(request, queue_name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(receive_messages(
            queue_name,
            max_number=body.get('max_number') or 5,
            visibility_timeout=body.get('visibility_timeout') or None,
            wait_time_seconds=body.get('wait_time_seconds') or 0,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='sqs', operation='receive_messages')


@require_http_methods(['DELETE'])
def sqs_message_delete(request, queue_name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(delete_message(queue_name, body.get('receipt_handle', '')))
    except Exception as exc:
        return handle_action_error(exc, service='sqs', operation='delete_message')
