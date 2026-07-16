"""CloudTrail helpers limited to operations implemented by Floci."""

from __future__ import annotations

from typing import Any

from .aws import FlociClientFactory


def _client():
    return FlociClientFactory().client('cloudtrail')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def create_trail(name: str, s3_bucket_name: str, *, include_global_service_events: bool = False,
                 is_multi_region_trail: bool = False, is_organization_trail: bool = False) -> dict[str, Any]:
    clean_name = _required(name, 'Trail name')
    bucket = _required(s3_bucket_name, 'S3 bucket name')
    response = _client().create_trail(
        Name=clean_name,
        S3BucketName=bucket,
        IncludeGlobalServiceEvents=bool(include_global_service_events),
        IsMultiRegionTrail=bool(is_multi_region_trail),
        IsOrganizationTrail=bool(is_organization_trail),
    )
    return {'name': response.get('Name') or clean_name, 'arn': response.get('TrailARN'), 's3_bucket_name': response.get('S3BucketName') or bucket}


def update_trail(name: str, *, s3_bucket_name: str = '', include_global_service_events: Any = None,
                 is_multi_region_trail: Any = None) -> dict[str, Any]:
    clean_name = _required(name, 'Trail name')
    kwargs: dict[str, Any] = {'Name': clean_name}
    if str(s3_bucket_name or '').strip():
        kwargs['S3BucketName'] = str(s3_bucket_name).strip()
    if include_global_service_events is not None:
        kwargs['IncludeGlobalServiceEvents'] = bool(include_global_service_events)
    if is_multi_region_trail is not None:
        kwargs['IsMultiRegionTrail'] = bool(is_multi_region_trail)
    response = _client().update_trail(**kwargs)
    return {'name': response.get('Name') or clean_name, 'arn': response.get('TrailARN'), 's3_bucket_name': response.get('S3BucketName')}


def set_trail_logging(name: str, enabled: bool) -> dict[str, Any]:
    clean_name = _required(name, 'Trail name')
    client = _client()
    if enabled:
        client.start_logging(Name=clean_name)
    else:
        client.stop_logging(Name=clean_name)
    return {'name': clean_name, 'is_logging': bool(enabled)}


def delete_trail(name: str) -> dict[str, Any]:
    clean_name = _required(name, 'Trail name')
    _client().delete_trail(Name=clean_name)
    return {'name': clean_name, 'deleted': True}
