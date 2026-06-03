"""Interactive Firehose helpers for local delivery stream testing."""

from __future__ import annotations

import json
from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('firehose')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _record_bytes(value: Any) -> bytes:
    if value in (None, ''):
        raise ValueError('Record data is required')
    if isinstance(value, bytes):
        return value
    if isinstance(value, str):
        return value.encode('utf-8')
    return json.dumps(value, separators=(',', ':')).encode('utf-8')


def _records(value: Any) -> list[Any]:
    if not isinstance(value, list) or not value:
        raise ValueError('Records must be a non-empty JSON array')
    return value


def create_delivery_stream(name: str, *, tags: Any = None) -> dict[str, Any]:
    clean_name = _required(name, 'Delivery stream name')
    kwargs: dict[str, Any] = {'DeliveryStreamName': clean_name}
    if tags:
        if not isinstance(tags, list):
            raise ValueError('Tags must be a JSON array')
        kwargs['Tags'] = tags

    response = _client().create_delivery_stream(**kwargs)
    return {
        'name': clean_name,
        'arn': response.get('DeliveryStreamARN'),
        'response': _clean_response(response),
    }


def delete_delivery_stream(name: str) -> dict[str, Any]:
    clean_name = _required(name, 'Delivery stream name')
    response = _client().delete_delivery_stream(DeliveryStreamName=clean_name)
    return {'name': clean_name, 'response': _clean_response(response)}


def put_record(stream_name: str, data: Any) -> dict[str, Any]:
    clean_name = _required(stream_name, 'Delivery stream name')
    response = _client().put_record(
        DeliveryStreamName=clean_name,
        Record={'Data': _record_bytes(data)},
    )
    return {
        'stream_name': clean_name,
        'record_id': response.get('RecordId'),
        'encrypted': response.get('Encrypted'),
        'response': _clean_response(response),
    }


def put_record_batch(stream_name: str, records: Any) -> dict[str, Any]:
    clean_name = _required(stream_name, 'Delivery stream name')
    clean_records = [{'Data': _record_bytes(record)} for record in _records(records)]
    response = _client().put_record_batch(
        DeliveryStreamName=clean_name,
        Records=clean_records,
    )
    request_responses = response.get('RequestResponses') or []
    return {
        'stream_name': clean_name,
        'record_count': len(clean_records),
        'failed_put_count': response.get('FailedPutCount', 0),
        'request_responses': _clean_response(request_responses),
        'response': _clean_response(response),
    }
