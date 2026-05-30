"""Interactive EventBridge Scheduler helpers for local schedule workflows."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('scheduler')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _json_object(value: Any, label: str) -> dict[str, Any]:
    if isinstance(value, str):
        value = json.loads(value)
    if not isinstance(value, dict):
        raise ValueError(f'{label} must be a JSON object')
    return value


def _optional_json_object(value: Any, label: str) -> dict[str, Any] | None:
    if value in (None, ''):
        return None
    return _json_object(value, label)


def _tags(value: Any) -> list[dict[str, str]]:
    if value in (None, '', []):
        return []
    if isinstance(value, str):
        value = json.loads(value)
    if isinstance(value, dict):
        value = [{'Key': key, 'Value': item} for key, item in value.items()]
    if not isinstance(value, list):
        raise ValueError('Tags must be an object or list')

    tags = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError('Each tag must be an object')
        key = item.get('Key') or item.get('key')
        if not key:
            raise ValueError('Each tag needs a Key')
        tag_value = item.get('Value')
        if tag_value is None:
            tag_value = item.get('value')
        tags.append({'Key': str(key), 'Value': '' if tag_value is None else str(tag_value)})
    return tags


def _tag_keys(value: Any) -> list[str]:
    if value in (None, '', []):
        return []
    if isinstance(value, str):
        return [item.strip() for item in value.replace('\n', ',').split(',') if item.strip()]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    raise ValueError('Tag keys must be a comma-separated string or list')


def _datetime(value: Any) -> datetime | None:
    if value in (None, ''):
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    if text.endswith('Z'):
        text = f'{text[:-1]}+00:00'
    try:
        return datetime.fromisoformat(text)
    except ValueError as exc:
        raise ValueError('Date values must be ISO 8601 strings') from exc


def _schedule_payload(
    *,
    name: Any,
    schedule_expression: Any,
    target: Any,
    group_name: Any = 'default',
    state: Any = 'ENABLED',
    flexible_time_window: Any = None,
    description: Any = '',
    timezone: Any = '',
    start_date: Any = None,
    end_date: Any = None,
    action_after_completion: Any = '',
    kms_key_arn: Any = '',
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        'Name': _required(name, 'Schedule name'),
        'GroupName': _required(group_name or 'default', 'Group name'),
        'ScheduleExpression': _required(schedule_expression, 'Schedule expression'),
        'FlexibleTimeWindow': _optional_json_object(flexible_time_window, 'Flexible time window') or {'Mode': 'OFF'},
        'Target': _json_object(target, 'Target'),
        'State': str(state or 'ENABLED').strip().upper(),
    }
    if payload['State'] not in {'ENABLED', 'DISABLED'}:
        raise ValueError('State must be ENABLED or DISABLED')
    if description:
        payload['Description'] = str(description)
    if timezone:
        payload['ScheduleExpressionTimezone'] = str(timezone).strip()
    parsed_start = _datetime(start_date)
    parsed_end = _datetime(end_date)
    if parsed_start:
        payload['StartDate'] = parsed_start
    if parsed_end:
        payload['EndDate'] = parsed_end
    if action_after_completion:
        payload['ActionAfterCompletion'] = str(action_after_completion).strip().upper()
    if kms_key_arn:
        payload['KmsKeyArn'] = str(kms_key_arn).strip()
    return payload


def create_schedule_group(name: Any, *, tags: Any = None) -> dict[str, Any]:
    kwargs: dict[str, Any] = {'Name': _required(name, 'Schedule group name')}
    clean_tags = _tags(tags)
    if clean_tags:
        kwargs['Tags'] = clean_tags
    response = _client().create_schedule_group(**kwargs)
    return {'group_name': kwargs['Name'], 'group_arn': response.get('ScheduleGroupArn'), 'response': _clean_response(response)}


def delete_schedule_group(name: Any) -> dict[str, Any]:
    clean_name = _required(name, 'Schedule group name')
    response = _client().delete_schedule_group(Name=clean_name)
    return {'group_name': clean_name, 'deleted': True, 'response': _clean_response(response)}


def create_schedule(**kwargs: Any) -> dict[str, Any]:
    payload = _schedule_payload(**kwargs)
    response = _client().create_schedule(**payload)
    return {
        'name': payload['Name'],
        'group': payload['GroupName'],
        'schedule_arn': response.get('ScheduleArn'),
        'response': _clean_response(response),
    }


def update_schedule(**kwargs: Any) -> dict[str, Any]:
    payload = _schedule_payload(**kwargs)
    response = _client().update_schedule(**payload)
    return {
        'name': payload['Name'],
        'group': payload['GroupName'],
        'schedule_arn': response.get('ScheduleArn'),
        'state': payload['State'],
        'response': _clean_response(response),
    }


def delete_schedule(name: Any, *, group_name: Any = 'default') -> dict[str, Any]:
    clean_name = _required(name, 'Schedule name')
    clean_group = _required(group_name or 'default', 'Group name')
    response = _client().delete_schedule(Name=clean_name, GroupName=clean_group)
    return {'name': clean_name, 'group': clean_group, 'deleted': True, 'response': _clean_response(response)}


def tag_resource(resource_arn: Any, tags: Any) -> dict[str, Any]:
    clean_tags = _tags(tags)
    if not clean_tags:
        raise ValueError('At least one tag is required')
    response = _client().tag_resource(ResourceArn=_required(resource_arn, 'Resource ARN'), Tags=clean_tags)
    return {'resource_arn': resource_arn, 'tags': clean_tags, 'response': _clean_response(response)}


def untag_resource(resource_arn: Any, tag_keys: Any) -> dict[str, Any]:
    clean_keys = _tag_keys(tag_keys)
    if not clean_keys:
        raise ValueError('At least one tag key is required')
    response = _client().untag_resource(ResourceArn=_required(resource_arn, 'Resource ARN'), TagKeys=clean_keys)
    return {'resource_arn': resource_arn, 'tag_keys': clean_keys, 'response': _clean_response(response)}
