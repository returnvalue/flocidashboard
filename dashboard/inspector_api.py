"""Local workflow inspection helpers."""

from __future__ import annotations

import json
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from .aws import FlociClientFactory, _clean_response
from .ses_api import clear_mailbox


def _bounded_limit(value: Any, *, default: int = 10, maximum: int = 100) -> int:
    if value in (None, ''):
        return default
    return max(1, min(int(value), maximum))


def _queue_name(queue_url: str) -> str:
    return queue_url.rstrip('/').split('/')[-1]


def list_sqs_queues() -> dict[str, Any]:
    sqs = FlociClientFactory().client('sqs')
    queue_urls = sqs.list_queues().get('QueueUrls', [])
    queues = []
    for queue_url in queue_urls:
        attributes = sqs.get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=['QueueArn', 'ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible'],
        ).get('Attributes', {})
        queues.append({
            'name': _queue_name(queue_url),
            'url': queue_url,
            'arn': attributes.get('QueueArn'),
            'available': int(attributes.get('ApproximateNumberOfMessages') or 0),
            'in_flight': int(attributes.get('ApproximateNumberOfMessagesNotVisible') or 0),
        })
    return {'queues': queues}


def receive_sqs_messages(queue_url: str, *, max_number: Any = 10) -> dict[str, Any]:
    value = (queue_url or '').strip()
    if not value:
        raise ValueError('Queue URL is required')

    sqs = FlociClientFactory().client('sqs')
    response = sqs.receive_message(
        QueueUrl=value,
        MaxNumberOfMessages=_bounded_limit(max_number, default=10, maximum=10),
        AttributeNames=['All'],
        MessageAttributeNames=['All'],
        VisibilityTimeout=0,
        WaitTimeSeconds=0,
    )
    return {
        'queue_url': value,
        'queue_name': _queue_name(value),
        'mode': 'peek',
        'messages': _clean_response(response.get('Messages', [])),
    }


def _mailbox_url() -> str:
    factory = FlociClientFactory()
    return f'{factory.endpoint_url.rstrip("/")}/_aws/ses'


def read_ses_mailbox() -> dict[str, Any]:
    url = _mailbox_url()
    request = Request(url, method='GET')
    try:
        with urlopen(request, timeout=3) as response:
            body = response.read().decode('utf-8')
            status = response.status
    except URLError as exc:
        raise ValueError(f'Could not read SES mailbox: {exc.reason}') from exc
    except TimeoutError as exc:
        raise ValueError(f'Could not read SES mailbox: {exc}') from exc

    parsed: Any
    try:
        parsed = json.loads(body) if body else {}
    except json.JSONDecodeError:
        parsed = {'raw': body}

    messages = []
    if isinstance(parsed, list):
        messages = parsed
    elif isinstance(parsed, dict):
        for key in ('messages', 'emails', 'mailbox'):
            if isinstance(parsed.get(key), list):
                messages = parsed[key]
                break

    return {
        'mailbox_url': url,
        'status': status,
        'messages': _clean_response(messages),
        'raw': _clean_response(parsed),
    }


def clear_ses_mailbox() -> dict[str, Any]:
    return clear_mailbox()


def lambda_log_groups(*, function_name: str = '', limit: Any = 25) -> dict[str, Any]:
    logs = FlociClientFactory().client('logs')
    prefix = f'/aws/lambda/{function_name.strip()}' if function_name else '/aws/lambda/'
    response = logs.describe_log_groups(
        logGroupNamePrefix=prefix,
        limit=_bounded_limit(limit, default=25, maximum=50),
    )
    groups = _clean_response(response.get('logGroups', []))
    return {
        'function_name': function_name,
        'log_group_prefix': prefix,
        'log_groups': groups,
    }


def lambda_log_events(log_group_name: str, *, limit: Any = 50) -> dict[str, Any]:
    group = (log_group_name or '').strip()
    if not group:
        raise ValueError('Log group name is required')

    logs = FlociClientFactory().client('logs')
    streams = logs.describe_log_streams(
        logGroupName=group,
        orderBy='LastEventTime',
        descending=True,
        limit=5,
    ).get('logStreams', [])
    events = []
    for stream in streams:
        stream_name = stream.get('logStreamName')
        if not stream_name:
            continue
        response = logs.get_log_events(
            logGroupName=group,
            logStreamName=stream_name,
            startFromHead=False,
            limit=_bounded_limit(limit, default=50, maximum=100),
        )
        for event in response.get('events', []):
            events.append({
                **event,
                'logStreamName': stream_name,
            })
    events.sort(key=lambda event: event.get('timestamp') or 0, reverse=True)
    return {
        'log_group_name': group,
        'streams': _clean_response(streams),
        'events': _clean_response(events[:_bounded_limit(limit, default=50, maximum=100)]),
    }
