"""Interactive Bedrock Runtime helpers for local stub inference."""

from __future__ import annotations

import json
from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('bedrock-runtime')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _dict_value(value: Any, label: str) -> dict[str, Any]:
    if value in (None, ''):
        return {}
    if not isinstance(value, dict):
        raise ValueError(f'{label} must be a JSON object')
    return value


def _list_value(value: Any, label: str) -> list[Any]:
    if value in (None, ''):
        return []
    if not isinstance(value, list):
        raise ValueError(f'{label} must be a JSON array')
    return value


def converse(model_id: str, messages: Any, *, system: Any = None, inference_config: Any = None, tool_config: Any = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        'modelId': _required(model_id, 'Model ID'),
        'messages': _list_value(messages, 'Messages'),
    }
    if not payload['messages']:
        raise ValueError('Messages are required')
    if system not in (None, ''):
        payload['system'] = _list_value(system, 'System')
    if inference_config not in (None, ''):
        payload['inferenceConfig'] = _dict_value(inference_config, 'Inference config')
    if tool_config not in (None, ''):
        payload['toolConfig'] = _dict_value(tool_config, 'Tool config')
    response = _client().converse(**payload)
    return {
        'model_id': payload['modelId'],
        'output': _clean_response(response.get('output', {})),
        'usage': _clean_response(response.get('usage', {})),
        'stop_reason': response.get('stopReason'),
        'metrics': _clean_response(response.get('metrics', {})),
        'response': _clean_response(response),
    }


def invoke_model(model_id: str, body: Any, *, content_type: str = 'application/json', accept: str = 'application/json') -> dict[str, Any]:
    clean_model_id = _required(model_id, 'Model ID')
    if isinstance(body, (dict, list)):
        raw_body = json.dumps(body).encode('utf-8')
    elif isinstance(body, str):
        raw_body = body.encode('utf-8')
    else:
        raise ValueError('Body must be a JSON object, array, or string')
    response = _client().invoke_model(
        modelId=clean_model_id,
        body=raw_body,
        contentType=content_type or 'application/json',
        accept=accept or 'application/json',
    )
    stream = response.get('body')
    response_body = stream.read() if hasattr(stream, 'read') else stream
    if isinstance(response_body, bytes):
        decoded = response_body.decode('utf-8', errors='replace')
    else:
        decoded = str(response_body or '')
    try:
        parsed: Any = json.loads(decoded)
    except json.JSONDecodeError:
        parsed = decoded
    return {
        'model_id': clean_model_id,
        'content_type': response.get('contentType'),
        'body': _clean_response(parsed),
        'response_metadata': _clean_response(response.get('ResponseMetadata', {})),
    }
