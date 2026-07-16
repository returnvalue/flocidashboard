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


def create_event_bus(name: str, *, description: str = '') -> dict[str, Any]:
    bus_name = _clean_required(name, 'Event bus name')
    kwargs: dict[str, Any] = {'Name': bus_name}
    if description.strip():
        kwargs['Description'] = description.strip()
    response = _events_client().create_event_bus(**kwargs)
    return {'name': bus_name, 'arn': response.get('EventBusArn'), 'response': response}


def delete_event_bus(name: str) -> dict[str, Any]:
    bus_name = _clean_required(name, 'Event bus name')
    if bus_name == 'default':
        raise ValueError('The default event bus cannot be deleted')
    response = _events_client().delete_event_bus(Name=bus_name)
    return {'name': bus_name, 'deleted': True, 'response': response}


def put_rule(name: str, event_bus_name: str, *, event_pattern: Any = None,
             schedule_expression: str = '', description: str = '', state: str = 'ENABLED') -> dict[str, Any]:
    rule_name = _clean_required(name, 'Rule name')
    bus_name = (event_bus_name or '').strip() or 'default'
    clean_state = (state or 'ENABLED').strip().upper()
    if clean_state not in {'ENABLED', 'DISABLED'}:
        raise ValueError('Rule state must be ENABLED or DISABLED')
    kwargs: dict[str, Any] = {'Name': rule_name, 'EventBusName': bus_name, 'State': clean_state}
    if event_pattern not in (None, ''):
        kwargs['EventPattern'] = normalize_event_detail(event_pattern)
    if schedule_expression.strip():
        kwargs['ScheduleExpression'] = schedule_expression.strip()
    if 'EventPattern' not in kwargs and 'ScheduleExpression' not in kwargs:
        raise ValueError('Event pattern or schedule expression is required')
    if description.strip():
        kwargs['Description'] = description.strip()
    response = _events_client().put_rule(**kwargs)
    return {'name': rule_name, 'event_bus_name': bus_name, 'arn': response.get('RuleArn'), 'state': clean_state, 'response': response}


def set_rule_state(name: str, event_bus_name: str, *, enabled: bool) -> dict[str, Any]:
    rule_name = _clean_required(name, 'Rule name')
    bus_name = (event_bus_name or '').strip() or 'default'
    client = _events_client()
    operation = client.enable_rule if enabled else client.disable_rule
    response = operation(Name=rule_name, EventBusName=bus_name)
    return {'name': rule_name, 'event_bus_name': bus_name, 'state': 'ENABLED' if enabled else 'DISABLED', 'response': response}


def delete_rule(name: str, event_bus_name: str) -> dict[str, Any]:
    rule_name = _clean_required(name, 'Rule name')
    bus_name = (event_bus_name or '').strip() or 'default'
    response = _events_client().delete_rule(Name=rule_name, EventBusName=bus_name)
    return {'name': rule_name, 'event_bus_name': bus_name, 'deleted': True, 'response': response}


def put_target(rule_name: str, event_bus_name: str, target_id: str, arn: str, *,
               role_arn: str = '', input_value: Any = None) -> dict[str, Any]:
    rule = _clean_required(rule_name, 'Rule name')
    bus = (event_bus_name or '').strip() or 'default'
    target: dict[str, Any] = {'Id': _clean_required(target_id, 'Target ID'), 'Arn': _clean_required(arn, 'Target ARN')}
    if role_arn.strip():
        target['RoleArn'] = role_arn.strip()
    if input_value not in (None, ''):
        target['Input'] = normalize_event_detail(input_value)
    response = _events_client().put_targets(Rule=rule, EventBusName=bus, Targets=[target])
    return {'rule_name': rule, 'event_bus_name': bus, 'target': target, 'failed_entry_count': response.get('FailedEntryCount', 0), 'failed_entries': response.get('FailedEntries', [])}


def remove_target(rule_name: str, event_bus_name: str, target_id: str) -> dict[str, Any]:
    rule = _clean_required(rule_name, 'Rule name')
    bus = (event_bus_name or '').strip() or 'default'
    clean_id = _clean_required(target_id, 'Target ID')
    response = _events_client().remove_targets(Rule=rule, EventBusName=bus, Ids=[clean_id])
    return {'rule_name': rule, 'event_bus_name': bus, 'target_id': clean_id, 'removed': response.get('FailedEntryCount', 0) == 0, 'failed_entries': response.get('FailedEntries', [])}
