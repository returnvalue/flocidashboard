"""HTTP endpoints for the Data Firehose workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .firehose_api import create_delivery_stream, delete_delivery_stream, put_record, put_record_batch


@require_http_methods(['POST'])
def firehose_delivery_streams_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_delivery_stream(
            body.get('name') or '',
            tags=body.get('tags') or [],
        ))
    except Exception as exc:
        return handle_action_error(exc, service='firehose', operation='create_delivery_stream')


@require_http_methods(['DELETE'])
def firehose_delivery_stream_detail(request, stream_name: str):
    try:
        return JsonResponse(delete_delivery_stream(stream_name))
    except Exception as exc:
        return handle_action_error(exc, service='firehose', operation='delete_delivery_stream')


@require_http_methods(['POST'])
def firehose_records_put(request, stream_name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(put_record(stream_name, body.get('data')))
    except Exception as exc:
        return handle_action_error(exc, service='firehose', operation='put_record')


@require_http_methods(['POST'])
def firehose_records_batch(request, stream_name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(put_record_batch(stream_name, body.get('records') or []))
    except Exception as exc:
        return handle_action_error(exc, service='firehose', operation='put_record_batch')
