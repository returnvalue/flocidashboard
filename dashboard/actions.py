"""Shared action metadata and HTTP helpers for interactive service workbenches."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from typing import Literal

from botocore.exceptions import BotoCoreError, ClientError
from django.http import JsonResponse

ActionKind = Literal['read', 'create', 'update', 'delete', 'execute']
ActionSafety = Literal['safe', 'mutating', 'destructive']


@dataclass(frozen=True)
class ActionField:
    name: str
    label: str
    required: bool = False
    field_type: str = 'string'
    help_text: str = ''


@dataclass(frozen=True)
class ServiceAction:
    name: str
    label: str
    method: str
    path: str
    kind: ActionKind
    safety: ActionSafety = 'mutating'
    description: str = ''
    fields: tuple[ActionField, ...] = field(default_factory=tuple)
    confirm: str = ''
    success_message: str = ''

    def as_dict(self) -> dict:
        data = asdict(self)
        data['fields'] = [asdict(field) for field in self.fields]
        return data


def action(
    name: str,
    label: str,
    method: str,
    path: str,
    kind: ActionKind,
    *,
    safety: ActionSafety = 'mutating',
    description: str = '',
    fields: tuple[ActionField, ...] = (),
    confirm: str = '',
    success_message: str = '',
) -> ServiceAction:
    return ServiceAction(
        name=name,
        label=label,
        method=method,
        path=path,
        kind=kind,
        safety=safety,
        description=description,
        fields=fields,
        confirm=confirm,
        success_message=success_message,
    )


def field(
    name: str,
    label: str,
    *,
    required: bool = False,
    field_type: str = 'string',
    help_text: str = '',
) -> ActionField:
    return ActionField(
        name=name,
        label=label,
        required=required,
        field_type=field_type,
        help_text=help_text,
    )


def parse_json_body(request) -> dict:
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError as exc:
        raise ValueError('Invalid JSON body') from exc
    if not isinstance(body, dict):
        raise ValueError('Invalid JSON body')
    return body


def error_payload(exc: Exception, *, service: str = '', operation: str = '') -> dict:
    payload: dict = {
        'error': str(exc),
        'service': service,
        'operation': operation,
    }
    if isinstance(exc, ClientError):
        error = exc.response.get('Error', {})
        payload['error'] = error.get('Message') or str(exc)
        payload['code'] = error.get('Code')
    return {key: value for key, value in payload.items() if value}


def error_status(exc: Exception) -> int:
    if isinstance(exc, ValueError):
        return 400
    if isinstance(exc, ClientError):
        code = exc.response.get('Error', {}).get('Code')
        return 404 if code in ('NoSuchBucket', 'NoSuchKey', '404') else 502
    if isinstance(exc, BotoCoreError):
        return 502
    return 500


def json_error(
    message: str,
    *,
    status: int = 400,
    code: str | None = None,
    service: str = '',
    operation: str = '',
) -> JsonResponse:
    payload: dict = {'error': message}
    if code:
        payload['code'] = code
    if service:
        payload['service'] = service
    if operation:
        payload['operation'] = operation
    return JsonResponse(payload, status=status)


def handle_action_error(exc: Exception, *, service: str = '', operation: str = '') -> JsonResponse:
    return JsonResponse(
        error_payload(exc, service=service, operation=operation),
        status=error_status(exc),
    )
