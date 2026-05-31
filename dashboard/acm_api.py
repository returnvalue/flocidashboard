"""Interactive ACM helpers for local certificate workflows."""

from __future__ import annotations

import base64
import uuid
from typing import Any

from .aws import FlociClientFactory


def _client():
    return FlociClientFactory().client('acm')


def _clean_required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _optional_int(value: Any, label: str, default: int) -> int:
    if value in (None, ''):
        return default
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f'{label} must be a number') from exc
    if number <= 0:
        raise ValueError(f'{label} must be greater than zero')
    return number


def _string_list(value: Any, label: str) -> list[str]:
    if not value:
        return []
    if isinstance(value, str):
        return [item.strip() for item in value.splitlines() if item.strip()]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    raise ValueError(f'{label} must be a list')


def _tags(value: Any) -> list[dict[str, str]]:
    if not value:
        return []
    if not isinstance(value, list):
        raise ValueError('Tags must be a list')
    tags = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError('Each tag must be an object')
        key = _clean_required(item.get('Key') or item.get('TagKey') or item.get('key'), 'Tag key')
        val = str(item.get('Value') if item.get('Value') is not None else item.get('TagValue', item.get('value', '')))
        tags.append({'Key': key, 'Value': val})
    return tags


def _tag_keys(value: Any) -> list[str]:
    keys = _string_list(value, 'Tag keys')
    if not keys:
        raise ValueError('At least one tag key is required')
    return keys


def _decode_passphrase(value: Any) -> bytes:
    text = _clean_required(value, 'Passphrase')
    try:
        decoded = base64.b64decode(text, validate=True)
    except (ValueError, TypeError) as exc:
        raise ValueError('Passphrase must be base64 encoded') from exc
    if len(decoded) < 4:
        raise ValueError('Passphrase must decode to at least 4 bytes')
    return decoded


def _json_datetime(value: Any) -> Any:
    return value.isoformat() if hasattr(value, 'isoformat') else value


def _clean_response(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: _clean_response(item)
            for key, item in value.items()
            if key != 'ResponseMetadata'
        }
    if isinstance(value, list):
        return [_clean_response(item) for item in value]
    if isinstance(value, bytes):
        return base64.b64encode(value).decode('ascii')
    return _json_datetime(value)


def request_certificate(
    *,
    domain_name: str,
    subject_alternative_names: Any = None,
    validation_method: str = 'DNS',
    key_algorithm: str = 'RSA_2048',
    certificate_authority_arn: str = '',
    tags: Any = None,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        'DomainName': _clean_required(domain_name, 'Domain name'),
        'ValidationMethod': (validation_method or 'DNS').strip().upper(),
        'KeyAlgorithm': key_algorithm or 'RSA_2048',
    }
    sans = _string_list(subject_alternative_names, 'Subject alternative names')
    if sans:
        kwargs['SubjectAlternativeNames'] = sans
    if certificate_authority_arn:
        kwargs['CertificateAuthorityArn'] = certificate_authority_arn.strip()
    clean_tags = _tags(tags)
    if clean_tags:
        kwargs['Tags'] = clean_tags

    response = _client().request_certificate(**kwargs)
    return {
        'certificate_arn': response.get('CertificateArn'),
        'domain_name': kwargs['DomainName'],
        'subject_alternative_names': sans,
        'type': 'PRIVATE' if certificate_authority_arn else 'AMAZON_ISSUED',
    }


def get_certificate(certificate_arn: str) -> dict[str, Any]:
    arn = _clean_required(certificate_arn, 'Certificate ARN')
    return _clean_response(_client().get_certificate(CertificateArn=arn))


def delete_certificate(certificate_arn: str) -> dict[str, Any]:
    arn = _clean_required(certificate_arn, 'Certificate ARN')
    _client().delete_certificate(CertificateArn=arn)
    return {'certificate_arn': arn, 'deleted': True}


def renew_certificate(certificate_arn: str) -> dict[str, Any]:
    arn = _clean_required(certificate_arn, 'Certificate ARN')
    _client().renew_certificate(CertificateArn=arn)
    return {'certificate_arn': arn, 'renewed': True}


def export_certificate(certificate_arn: str, passphrase_base64: str) -> dict[str, Any]:
    arn = _clean_required(certificate_arn, 'Certificate ARN')
    response = _client().export_certificate(
        CertificateArn=arn,
        Passphrase=_decode_passphrase(passphrase_base64),
    )
    return _clean_response(response)


def add_tags(certificate_arn: str, tags: Any) -> dict[str, Any]:
    arn = _clean_required(certificate_arn, 'Certificate ARN')
    clean_tags = _tags(tags)
    if not clean_tags:
        raise ValueError('At least one tag is required')
    _client().add_tags_to_certificate(CertificateArn=arn, Tags=clean_tags)
    return {'certificate_arn': arn, 'tags': clean_tags}


def remove_tags(certificate_arn: str, tag_keys: Any) -> dict[str, Any]:
    arn = _clean_required(certificate_arn, 'Certificate ARN')
    tags = [{'Key': key} for key in _tag_keys(tag_keys)]
    _client().remove_tags_from_certificate(CertificateArn=arn, Tags=tags)
    return {'certificate_arn': arn, 'tag_keys': [tag['Key'] for tag in tags]}


def put_account_configuration(days_before_expiry: Any = 45) -> dict[str, Any]:
    days = max(1, min(_optional_int(days_before_expiry, 'Days before expiry', 45), 45))
    _client().put_account_configuration(
        ExpiryEvents={'DaysBeforeExpiry': days},
        IdempotencyToken=uuid.uuid4().hex,
    )
    return {'expiry_events': {'DaysBeforeExpiry': days}}
