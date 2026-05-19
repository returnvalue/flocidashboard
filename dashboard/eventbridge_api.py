"""Interactive EventBridge helpers for the event sender workbench."""

from __future__ import annotations

import json
from typing import Any

from .aws import FlociClientFactory


def _events_client():
    return FlociClientFactory().client('events')


def _clean_required(value: str, label: str) -> str:
    cleaned = (value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def normalize_event_detail(detail: Any) -> str:
    if detail in (None, ''):
        return '{}'
    if isinstance(detail, str):
        try:
            json.loads(detail)
        except json.JSONDecodeError as exc:
            raise ValueError('Event detail must be valid JSON') from exc
        return detail
    if isinstance(detail, (dict, list)):
        return json.dumps(detail)
    raise ValueError('Event detail must be a JSON object, array, or string')


def put_event(
    event_bus_name: str,
    source: str,
    detail_type: str,
    detail: Any,
    *,
    resources: list[str] | None = None,
) -> dict[str, Any]:
    bus = (event_bus_name or '').strip() or 'default'
    event_source = _clean_required(source, 'Source')
    event_detail_type = _clean_required(detail_type, 'Detail type')

    entry: dict[str, Any] = {
        'EventBusName': bus,
        'Source': event_source,
        'DetailType': event_detail_type,
        'Detail': normalize_event_detail(detail),
    }
    if resources:
        entry['Resources'] = [str(resource) for resource in resources if str(resource).strip()]

    response = _events_client().put_events(Entries=[entry])
    entries = response.get('Entries', [])
    return {
        'event_bus_name': bus,
        'failed_entry_count': response.get('FailedEntryCount', 0),
        'entries': entries,
        'event_id': entries[0].get('EventId') if entries else None,
        'error_code': entries[0].get('ErrorCode') if entries else None,
        'error_message': entries[0].get('ErrorMessage') if entries else None,
    }
