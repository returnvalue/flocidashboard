"""Interactive CloudWatch Logs helpers for the log viewer."""

from __future__ import annotations

import time
from typing import Any

from .aws import FlociClientFactory


def _logs_client():
    return FlociClientFactory().client('logs')


def validate_log_group_name(name: str) -> str:
    value = (name or '').strip()
    if not value:
        raise ValueError('Log group name is required')
    return value


def validate_log_stream_name(name: str) -> str:
    value = (name or '').strip()
    if not value:
        raise ValueError('Log stream name is required')
    return value


def _bounded_limit(value: Any, default: int = 50) -> int:
    if value in (None, ''):
        return default
    return max(1, min(int(value), 100))


def _bounded_query_limit(value: Any, default: int = 100) -> int:
    if value in (None, ''):
        return default
    return max(1, min(int(value), 1000))


def _optional_epoch_seconds(value: Any) -> int | None:
    if value in (None, ''):
        return None
    return int(value)


def list_log_streams(log_group_name: str, *, limit: int = 50) -> dict[str, Any]:
    group = validate_log_group_name(log_group_name)
    response = _logs_client().describe_log_streams(
        logGroupName=group,
        orderBy='LastEventTime',
        descending=True,
        limit=_bounded_limit(limit),
    )
    return {
        'log_group_name': group,
        'streams': response.get('logStreams', []),
        'next_token': response.get('nextToken'),
    }


def get_log_events(
    log_group_name: str,
    log_stream_name: str,
    *,
    limit: int = 50,
    start_time: int | None = None,
) -> dict[str, Any]:
    group = validate_log_group_name(log_group_name)
    stream = validate_log_stream_name(log_stream_name)
    payload: dict[str, Any] = {
        'logGroupName': group,
        'logStreamName': stream,
        'limit': _bounded_limit(limit),
        'startFromHead': False,
    }
    if start_time is not None:
        payload['startTime'] = int(start_time)

    response = _logs_client().get_log_events(**payload)
    return {
        'log_group_name': group,
        'log_stream_name': stream,
        'events': response.get('events', []),
        'next_forward_token': response.get('nextForwardToken'),
        'next_backward_token': response.get('nextBackwardToken'),
    }


def start_logs_insights_query(
    log_group_name: str,
    query_string: str,
    *,
    start_time: int | None = None,
    end_time: int | None = None,
    limit: int = 100,
) -> dict[str, Any]:
    group = validate_log_group_name(log_group_name)
    query = (query_string or '').strip()
    if not query:
        raise ValueError('Query string is required')

    payload: dict[str, Any] = {
        'logGroupNames': [group],
        'queryString': query,
        'limit': _bounded_query_limit(limit),
    }
    parsed_start = _optional_epoch_seconds(start_time)
    parsed_end = _optional_epoch_seconds(end_time)
    end = parsed_end if parsed_end is not None else int(time.time())
    start = parsed_start if parsed_start is not None else end - 3600
    payload['startTime'] = start
    payload['endTime'] = end

    response = _logs_client().start_query(**payload)
    return {
        'log_group_name': group,
        'query_id': response.get('queryId'),
        'query_string': query,
    }


def get_logs_insights_query_results(query_id: str) -> dict[str, Any]:
    value = (query_id or '').strip()
    if not value:
        raise ValueError('Query ID is required')

    response = _logs_client().get_query_results(queryId=value)
    return {
        'query_id': value,
        'status': response.get('status'),
        'results': response.get('results', []),
        'statistics': response.get('statistics', {}),
    }
