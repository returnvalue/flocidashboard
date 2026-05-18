"""Interactive Lambda helpers for the invoke workbench."""

from __future__ import annotations

import base64
import json
from typing import Any

from .aws import FlociClientFactory


def _lambda_client():
    return FlociClientFactory().client('lambda')


def validate_function_name(name: str) -> str:
    value = (name or '').strip()
    if not value:
        raise ValueError('Function name is required')
    return value


def _payload_bytes(payload: Any) -> bytes:
    if payload in (None, ''):
        return b'{}'
    if isinstance(payload, str):
        try:
            json.loads(payload)
        except json.JSONDecodeError as exc:
            raise ValueError('Payload must be valid JSON') from exc
        return payload.encode('utf-8')
    return json.dumps(payload).encode('utf-8')


def _read_payload(stream: Any) -> dict[str, Any]:
    if stream is None:
        return {'raw': ''}

    raw = stream.read() if hasattr(stream, 'read') else stream
    if isinstance(raw, bytes):
        text = raw.decode('utf-8')
    else:
        text = str(raw or '')

    if not text:
        return {'raw': ''}

    try:
        return {'json': json.loads(text), 'raw': text}
    except json.JSONDecodeError:
        return {'raw': text}


def invoke_function(
    name: str,
    payload: Any = None,
    *,
    qualifier: str | None = None,
) -> dict[str, Any]:
    function_name = validate_function_name(name)
    request: dict[str, Any] = {
        'FunctionName': function_name,
        'InvocationType': 'RequestResponse',
        'LogType': 'Tail',
        'Payload': _payload_bytes(payload),
    }
    if qualifier:
        request['Qualifier'] = qualifier

    response = _lambda_client().invoke(**request)
    log_tail = response.get('LogResult')
    if log_tail:
        try:
            log_tail = base64.b64decode(log_tail).decode('utf-8')
        except (ValueError, UnicodeDecodeError):
            pass

    return {
        'function_name': function_name,
        'status_code': response.get('StatusCode'),
        'executed_version': response.get('ExecutedVersion'),
        'function_error': response.get('FunctionError'),
        'log_tail': log_tail,
        'payload': _read_payload(response.get('Payload')),
        'log_group': f'/aws/lambda/{function_name}',
    }
