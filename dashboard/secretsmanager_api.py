"""Interactive Secrets Manager helpers for local secret workflows."""

from __future__ import annotations

import base64
import json
from typing import Any

from .aws import FlociClientFactory


def _client():
    return FlociClientFactory().client('secretsmanager')


def _clean_required(value: str, label: str) -> str:
    cleaned = (value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _secret_string(value: Any) -> str:
    if value in (None, ''):
        raise ValueError('Secret value is required')
    if isinstance(value, str):
        return value
    return json.dumps(value)


def _decode_secret_value(response: dict[str, Any]) -> dict[str, Any]:
    if 'SecretString' in response:
        text = response.get('SecretString') or ''
        parsed: Any = None
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            parsed = None
        return {
            'type': 'string',
            'value': text,
            'json': parsed,
            'size_bytes': len(text.encode('utf-8')),
        }

    binary = response.get('SecretBinary') or b''
    if isinstance(binary, str):
        raw = base64.b64decode(binary)
    else:
        raw = bytes(binary)
    return {
        'type': 'binary',
        'value': base64.b64encode(raw).decode('ascii'),
        'json': None,
        'size_bytes': len(raw),
    }


def _json_datetime(value: Any) -> Any:
    return value.isoformat() if hasattr(value, 'isoformat') else value


def create_secret(
    name: str,
    value: Any,
    *,
    description: str = '',
    kms_key_id: str = '',
) -> dict[str, Any]:
    secret_name = _clean_required(name, 'Secret name')
    kwargs: dict[str, Any] = {
        'Name': secret_name,
        'SecretString': _secret_string(value),
    }
    if description:
        kwargs['Description'] = description
    if kms_key_id:
        kwargs['KmsKeyId'] = kms_key_id

    response = _client().create_secret(**kwargs)
    return {
        'name': response.get('Name') or secret_name,
        'arn': response.get('ARN'),
        'version_id': response.get('VersionId'),
    }


def put_secret_value(secret_id: str, value: Any) -> dict[str, Any]:
    clean_id = _clean_required(secret_id, 'Secret ID')
    response = _client().put_secret_value(
        SecretId=clean_id,
        SecretString=_secret_string(value),
    )
    return {
        'name': response.get('Name') or clean_id,
        'arn': response.get('ARN'),
        'version_id': response.get('VersionId'),
        'version_stages': response.get('VersionStages'),
    }


def get_secret_value(secret_id: str) -> dict[str, Any]:
    clean_id = _clean_required(secret_id, 'Secret ID')
    response = _client().get_secret_value(SecretId=clean_id)
    decoded = _decode_secret_value(response)
    return {
        'name': response.get('Name') or clean_id,
        'arn': response.get('ARN'),
        'version_id': response.get('VersionId'),
        'version_stages': response.get('VersionStages'),
        'created_date': _json_datetime(response.get('CreatedDate')),
        **decoded,
    }


def delete_secret(
    secret_id: str,
    *,
    recovery_window_days: Any = 7,
    force_delete_without_recovery: bool = False,
) -> dict[str, Any]:
    clean_id = _clean_required(secret_id, 'Secret ID')
    kwargs: dict[str, Any] = {'SecretId': clean_id}
    if force_delete_without_recovery:
        kwargs['ForceDeleteWithoutRecovery'] = True
    else:
        try:
            window = int(recovery_window_days or 7)
        except (TypeError, ValueError) as exc:
            raise ValueError('Recovery window days must be a number') from exc
        kwargs['RecoveryWindowInDays'] = max(7, min(window, 30))

    response = _client().delete_secret(**kwargs)
    return {
        'name': response.get('Name') or clean_id,
        'arn': response.get('ARN'),
        'deletion_date': _json_datetime(response.get('DeletionDate')),
    }
