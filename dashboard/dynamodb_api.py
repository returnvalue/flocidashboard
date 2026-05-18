"""Interactive DynamoDB helpers for the table explorer."""

from __future__ import annotations

import base64
import json
from decimal import Decimal
from typing import Any

from boto3.dynamodb.types import TypeDeserializer, TypeSerializer

from .aws import FlociClientFactory

deserializer = TypeDeserializer()
serializer = TypeSerializer()


def _dynamodb_client():
    return FlociClientFactory().client('dynamodb')


def validate_table_name(name: str) -> str:
    value = (name or '').strip()
    if not value:
        raise ValueError('Table name is required')
    return value


def _json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, bytes):
        return base64.b64encode(value).decode('ascii')
    if isinstance(value, set):
        return [_json_safe(item) for item in sorted(value, key=str)]
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    return value


def _deserialize_item(item: dict[str, Any]) -> dict[str, Any]:
    return _json_safe({
        key: deserializer.deserialize(value)
        for key, value in item.items()
    })


def _serialize_key(key: dict[str, Any]) -> dict[str, Any]:
    return {
        str(name): serializer.serialize(value)
        for name, value in key.items()
    }


def scan_table(
    table_name: str,
    *,
    limit: int = 25,
    exclusive_start_key: dict[str, Any] | None = None,
) -> dict[str, Any]:
    clean_name = validate_table_name(table_name)
    bounded_limit = max(1, min(int(limit), 100))
    payload: dict[str, Any] = {
        'TableName': clean_name,
        'Limit': bounded_limit,
    }
    if exclusive_start_key:
        payload['ExclusiveStartKey'] = _serialize_key(exclusive_start_key)

    response = _dynamodb_client().scan(**payload)
    return {
        'table': clean_name,
        'count': response.get('Count', 0),
        'scanned_count': response.get('ScannedCount', 0),
        'items': [_deserialize_item(item) for item in response.get('Items', [])],
        'last_evaluated_key': _deserialize_item(response['LastEvaluatedKey'])
        if response.get('LastEvaluatedKey') else None,
    }


def execute_select_statement(statement: str, *, limit: int = 25) -> dict[str, Any]:
    clean_statement = (statement or '').strip()
    if not clean_statement:
        raise ValueError('Statement is required')
    if not clean_statement.lower().startswith('select'):
        raise ValueError('Only read-only SELECT statements are allowed')

    bounded_limit = max(1, min(int(limit), 100))
    client = _dynamodb_client()
    if 'ExecuteStatement' not in client.meta.service_model.operation_names:
        raise ValueError('ExecuteStatement is not available in this boto3/Floci environment')

    response = client.execute_statement(Statement=clean_statement, Limit=bounded_limit)
    return {
        'statement': clean_statement,
        'count': len(response.get('Items', [])),
        'items': [_deserialize_item(item) for item in response.get('Items', [])],
        'next_token': response.get('NextToken'),
    }


def parse_start_key(value: Any) -> dict[str, Any] | None:
    if value in (None, ''):
        return None
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        parsed = json.loads(value)
        if not isinstance(parsed, dict):
            raise ValueError('Exclusive start key must be a JSON object')
        return parsed
    raise ValueError('Exclusive start key must be a JSON object')
