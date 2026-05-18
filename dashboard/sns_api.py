"""Interactive SNS helpers for the publish workbench."""

from __future__ import annotations

from typing import Any

from .aws import FlociClientFactory


def _sns_client():
    return FlociClientFactory().client('sns')


def validate_topic_arn(topic_arn: str) -> str:
    value = (topic_arn or '').strip()
    if not value or ':sns:' not in value:
        raise ValueError('A valid SNS topic ARN is required')
    return value


def _message_attribute(name: str, value: Any) -> dict[str, str]:
    if isinstance(value, dict):
        data_type = value.get('DataType') or value.get('data_type') or value.get('type') or 'String'
        string_value = value.get('StringValue')
        if string_value is None:
            string_value = value.get('string_value')
        if string_value is None:
            string_value = value.get('value')
        if string_value is None and 'BinaryValue' not in value and 'binary_value' not in value:
            raise ValueError(f'Message attribute {name} requires a value')
        attribute = {'DataType': str(data_type)}
        if 'BinaryValue' in value:
            attribute['BinaryValue'] = value['BinaryValue']
        elif 'binary_value' in value:
            attribute['BinaryValue'] = value['binary_value']
        else:
            attribute['StringValue'] = str(string_value)
        return attribute

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return {'DataType': 'Number', 'StringValue': str(value)}

    return {'DataType': 'String', 'StringValue': str(value)}


def normalize_message_attributes(attributes: Any) -> dict[str, dict[str, str]]:
    if attributes in (None, ''):
        return {}
    if not isinstance(attributes, dict):
        raise ValueError('Message attributes must be a JSON object')

    normalized = {}
    for name, value in attributes.items():
        clean_name = str(name).strip()
        if not clean_name:
            raise ValueError('Message attribute names cannot be empty')
        normalized[clean_name] = _message_attribute(clean_name, value)
    return normalized


def publish_message(
    topic_arn: str,
    message: str,
    *,
    subject: str | None = None,
    message_attributes: Any = None,
    message_structure: str | None = None,
    message_group_id: str | None = None,
    message_deduplication_id: str | None = None,
) -> dict[str, Any]:
    if not message:
        raise ValueError('Message body is required')

    arn = validate_topic_arn(topic_arn)
    payload: dict[str, Any] = {
        'TopicArn': arn,
        'Message': message,
    }
    if subject:
        payload['Subject'] = subject
    if message_structure:
        payload['MessageStructure'] = message_structure

    attributes = normalize_message_attributes(message_attributes)
    if attributes:
        payload['MessageAttributes'] = attributes

    if arn.endswith('.fifo'):
        if not message_group_id:
            raise ValueError('Message group ID is required for FIFO topics')
        payload['MessageGroupId'] = message_group_id
        if message_deduplication_id:
            payload['MessageDeduplicationId'] = message_deduplication_id

    response = _sns_client().publish(**payload)
    return {
        'topic_arn': arn,
        'message_id': response.get('MessageId'),
        'sequence_number': response.get('SequenceNumber'),
    }
