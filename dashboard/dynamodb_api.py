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
    if not item:
        return {}
    is_wire_format = any(
        isinstance(v, dict) and any(k in {'S', 'N', 'B', 'SS', 'NS', 'BS', 'M', 'L', 'NULL', 'BOOL'} for k in v)
        for v in item.values()
    )
    if is_wire_format:
        return _json_safe({
            key: deserializer.deserialize(value) if isinstance(value, dict) and any(k in {'S', 'N', 'B', 'SS', 'NS', 'BS', 'M', 'L', 'NULL', 'BOOL'} for k in value) else value
            for key, value in item.items()
        })
    return _json_safe(item)


def _serialize_value(val: Any) -> Any:
    if isinstance(val, dict) and len(val) == 1 and list(val.keys())[0] in {'S', 'N', 'B', 'SS', 'NS', 'BS', 'M', 'L', 'NULL', 'BOOL'}:
        return val
    return serializer.serialize(val)


def _serialize_item(item: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise ValueError('Item must be a dictionary')
    return {
        str(name): _serialize_value(value)
        for name, value in item.items()
    }


def _serialize_key(key: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(key, dict) or not key:
        raise ValueError('Key must be a non-empty dictionary')
    return {
        str(name): _serialize_value(value)
        for name, value in key.items()
    }


def scan_table(
    table_name: str,
    *,
    limit: int = 25,
    exclusive_start_key: dict[str, Any] | None = None,
    filter_expression: str | None = None,
    expression_attribute_names: dict[str, str] | None = None,
    expression_attribute_values: dict[str, Any] | None = None,
    index_name: str | None = None,
) -> dict[str, Any]:
    clean_name = validate_table_name(table_name)
    bounded_limit = max(1, min(int(limit), 100))
    payload: dict[str, Any] = {
        'TableName': clean_name,
        'Limit': bounded_limit,
    }
    if exclusive_start_key:
        payload['ExclusiveStartKey'] = _serialize_key(exclusive_start_key)
    if filter_expression:
        payload['FilterExpression'] = filter_expression
    if expression_attribute_names:
        payload['ExpressionAttributeNames'] = expression_attribute_names
    if expression_attribute_values:
        payload['ExpressionAttributeValues'] = _serialize_item(expression_attribute_values)
    if index_name:
        payload['IndexName'] = index_name

    response = _dynamodb_client().scan(**payload)
    return {
        'table': clean_name,
        'count': response.get('Count', 0),
        'scanned_count': response.get('ScannedCount', 0),
        'items': [_deserialize_item(item) for item in response.get('Items', [])],
        'last_evaluated_key': _deserialize_item(response['LastEvaluatedKey'])
        if response.get('LastEvaluatedKey') else None,
    }


def query_table(
    table_name: str,
    key_condition_expression: str,
    expression_attribute_values: dict[str, Any],
    *,
    expression_attribute_names: dict[str, str] | None = None,
    filter_expression: str | None = None,
    index_name: str | None = None,
    limit: int = 25,
    scan_index_forward: bool = True,
    exclusive_start_key: dict[str, Any] | None = None,
) -> dict[str, Any]:
    clean_name = validate_table_name(table_name)
    if not key_condition_expression:
        raise ValueError('KeyConditionExpression is required for query')
    if not expression_attribute_values:
        raise ValueError('ExpressionAttributeValues is required for query')

    bounded_limit = max(1, min(int(limit), 100))
    payload: dict[str, Any] = {
        'TableName': clean_name,
        'KeyConditionExpression': key_condition_expression,
        'ExpressionAttributeValues': _serialize_item(expression_attribute_values),
        'Limit': bounded_limit,
        'ScanIndexForward': bool(scan_index_forward),
    }
    if expression_attribute_names:
        payload['ExpressionAttributeNames'] = expression_attribute_names
    if filter_expression:
        payload['FilterExpression'] = filter_expression
    if index_name:
        payload['IndexName'] = index_name
    if exclusive_start_key:
        payload['ExclusiveStartKey'] = _serialize_key(exclusive_start_key)

    response = _dynamodb_client().query(**payload)
    return {
        'table': clean_name,
        'count': response.get('Count', 0),
        'scanned_count': response.get('ScannedCount', 0),
        'items': [_deserialize_item(item) for item in response.get('Items', [])],
        'last_evaluated_key': _deserialize_item(response['LastEvaluatedKey'])
        if response.get('LastEvaluatedKey') else None,
    }


def put_item(
    table_name: str,
    item: dict[str, Any],
    *,
    return_values: str = 'NONE',
) -> dict[str, Any]:
    clean_name = validate_table_name(table_name)
    if not isinstance(item, dict) or not item:
        raise ValueError('Item dictionary is required')
    payload: dict[str, Any] = {
        'TableName': clean_name,
        'Item': _serialize_item(item),
    }
    if return_values and return_values != 'NONE':
        payload['ReturnValues'] = return_values

    response = _dynamodb_client().put_item(**payload)
    return {
        'table': clean_name,
        'item': item,
        'attributes': _deserialize_item(response.get('Attributes', {})) if response.get('Attributes') else None,
        'consumed_capacity': response.get('ConsumedCapacity'),
    }


def get_item(
    table_name: str,
    key: dict[str, Any],
    *,
    consistent_read: bool = False,
    projection_expression: str | None = None,
) -> dict[str, Any]:
    clean_name = validate_table_name(table_name)
    payload: dict[str, Any] = {
        'TableName': clean_name,
        'Key': _serialize_key(key),
        'ConsistentRead': bool(consistent_read),
    }
    if projection_expression:
        payload['ProjectionExpression'] = projection_expression

    response = _dynamodb_client().get_item(**payload)
    item = response.get('Item')
    return {
        'table': clean_name,
        'item': _deserialize_item(item) if item else None,
        'found': bool(item),
    }


def delete_item(
    table_name: str,
    key: dict[str, Any],
    *,
    return_values: str = 'NONE',
) -> dict[str, Any]:
    clean_name = validate_table_name(table_name)
    payload: dict[str, Any] = {
        'TableName': clean_name,
        'Key': _serialize_key(key),
    }
    if return_values and return_values != 'NONE':
        payload['ReturnValues'] = return_values

    response = _dynamodb_client().delete_item(**payload)
    return {
        'table': clean_name,
        'key': key,
        'deleted': True,
        'attributes': _deserialize_item(response.get('Attributes', {})) if response.get('Attributes') else None,
    }


def update_time_to_live(
    table_name: str,
    attribute_name: str,
    *,
    enabled: bool = True,
) -> dict[str, Any]:
    clean_name = validate_table_name(table_name)
    clean_attr = (attribute_name or '').strip()
    if not clean_attr:
        raise ValueError('TTL attribute name is required')
    payload = {
        'TableName': clean_name,
        'TimeToLiveSpecification': {
            'AttributeName': clean_attr,
            'Enabled': bool(enabled),
        },
    }
    response = _dynamodb_client().update_time_to_live(**payload)
    return {
        'table': clean_name,
        'time_to_live_specification': response.get('TimeToLiveSpecification', {}),
    }


def describe_time_to_live(table_name: str) -> dict[str, Any]:
    clean_name = validate_table_name(table_name)
    response = _dynamodb_client().describe_time_to_live(TableName=clean_name)
    return {
        'table': clean_name,
        'time_to_live_description': response.get('TimeToLiveDescription', {}),
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
