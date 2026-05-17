"""Interactive SQS helpers for the queue workbench."""

from __future__ import annotations

import re
from typing import Any

from .aws import FlociClientFactory

QUEUE_NAME_RE = re.compile(r'^[A-Za-z0-9_-]{1,80}(\.fifo)?$')


def _sqs_client():
    return FlociClientFactory().client('sqs')


def validate_queue_name(name: str) -> str:
    value = (name or '').strip()
    if not QUEUE_NAME_RE.match(value):
        raise ValueError('Queue names can contain letters, numbers, hyphens, and underscores, with optional .fifo suffix.')
    return value


def get_queue_url(name: str) -> str:
    queue_name = validate_queue_name(name)
    return _sqs_client().get_queue_url(QueueName=queue_name)['QueueUrl']


def create_queue(name: str, *, fifo: bool = False, visibility_timeout: int | None = None) -> dict[str, Any]:
    queue_name = validate_queue_name(name)
    if fifo and not queue_name.endswith('.fifo'):
        raise ValueError('FIFO queue names must end with .fifo')
    attributes: dict[str, str] = {}
    if fifo or queue_name.endswith('.fifo'):
        attributes['FifoQueue'] = 'true'
        attributes['ContentBasedDeduplication'] = 'true'
    if visibility_timeout is not None:
        attributes['VisibilityTimeout'] = str(int(visibility_timeout))

    payload: dict[str, Any] = {'QueueName': queue_name}
    if attributes:
        payload['Attributes'] = attributes
    response = _sqs_client().create_queue(**payload)
    return {'name': queue_name, 'url': response['QueueUrl']}


def delete_queue(name: str) -> dict[str, str]:
    queue_url = get_queue_url(name)
    _sqs_client().delete_queue(QueueUrl=queue_url)
    return {'name': validate_queue_name(name), 'deleted': 'true'}


def purge_queue(name: str) -> dict[str, str]:
    queue_url = get_queue_url(name)
    _sqs_client().purge_queue(QueueUrl=queue_url)
    return {'name': validate_queue_name(name), 'purged': 'true'}


def send_message(
    name: str,
    body: str,
    *,
    delay_seconds: int | None = None,
    message_group_id: str | None = None,
    message_deduplication_id: str | None = None,
) -> dict[str, Any]:
    if not body:
        raise ValueError('Message body is required')
    queue_name = validate_queue_name(name)
    queue_url = get_queue_url(queue_name)
    payload: dict[str, Any] = {
        'QueueUrl': queue_url,
        'MessageBody': body,
    }
    if delay_seconds is not None:
        payload['DelaySeconds'] = int(delay_seconds)
    if queue_name.endswith('.fifo'):
        if not message_group_id:
            raise ValueError('Message group ID is required for FIFO queues')
        payload['MessageGroupId'] = message_group_id
        if message_deduplication_id:
            payload['MessageDeduplicationId'] = message_deduplication_id

    response = _sqs_client().send_message(**payload)
    return {
        'message_id': response.get('MessageId'),
        'md5_of_body': response.get('MD5OfMessageBody'),
        'sequence_number': response.get('SequenceNumber'),
    }


def receive_messages(
    name: str,
    *,
    max_number: int = 5,
    visibility_timeout: int | None = None,
    wait_time_seconds: int = 0,
) -> dict[str, Any]:
    queue_url = get_queue_url(name)
    payload: dict[str, Any] = {
        'QueueUrl': queue_url,
        'MaxNumberOfMessages': max(1, min(int(max_number), 10)),
        'AttributeNames': ['All'],
        'MessageAttributeNames': ['All'],
        'WaitTimeSeconds': max(0, min(int(wait_time_seconds), 20)),
    }
    if visibility_timeout is not None:
        payload['VisibilityTimeout'] = int(visibility_timeout)
    messages = _sqs_client().receive_message(**payload).get('Messages', [])
    return {
        'queue': validate_queue_name(name),
        'messages': messages,
    }


def delete_message(name: str, receipt_handle: str) -> dict[str, str]:
    if not receipt_handle:
        raise ValueError('Receipt handle is required')
    queue_url = get_queue_url(name)
    _sqs_client().delete_message(QueueUrl=queue_url, ReceiptHandle=receipt_handle)
    return {'queue': validate_queue_name(name), 'deleted': 'true'}
