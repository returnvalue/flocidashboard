"""Interactive CloudFront helpers for local distribution workflows."""

from __future__ import annotations

import base64
import json
from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('cloudfront')


def _required(value: str, label: str) -> str:
    cleaned = (value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _string_list(value: Any) -> list[str]:
    if value in (None, '', []):
        return []
    if isinstance(value, str):
        return [item.strip() for item in value.replace('\n', ',').split(',') if item.strip()]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    raise ValueError('Value must be a comma-separated string or list')


def _json_object(value: Any, label: str) -> dict[str, Any]:
    if isinstance(value, str):
        value = json.loads(value)
    if not isinstance(value, dict):
        raise ValueError(f'{label} must be a JSON object')
    return value


def _tags(value: Any) -> dict[str, list[dict[str, str]]]:
    if value in (None, '', []):
        return {'Items': []}
    if isinstance(value, str):
        value = json.loads(value)
    if isinstance(value, dict):
        value = [{'Key': key, 'Value': item} for key, item in value.items()]
    if not isinstance(value, list):
        raise ValueError('Tags must be an object or list')
    items = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError('Each tag must be an object')
        key = item.get('Key') or item.get('key')
        if not key:
            raise ValueError('Each tag needs a Key')
        tag_value = item.get('Value')
        if tag_value is None:
            tag_value = item.get('value')
        items.append({'Key': str(key), 'Value': '' if tag_value is None else str(tag_value)})
    return {'Items': items}


def _distribution_config(
    caller_reference: str,
    origin_id: str,
    origin_domain_name: str,
    *,
    comment: str = '',
    enabled: bool = True,
    aliases: Any = None,
    viewer_protocol_policy: str = 'redirect-to-https',
    cache_policy_id: str = '',
) -> dict[str, Any]:
    clean_origin_id = _required(origin_id, 'Origin ID')
    config: dict[str, Any] = {
        'CallerReference': _required(caller_reference, 'Caller reference'),
        'Comment': comment or '',
        'Enabled': bool(enabled),
        'Origins': {
            'Quantity': 1,
            'Items': [{
                'Id': clean_origin_id,
                'DomainName': _required(origin_domain_name, 'Origin domain name'),
                'S3OriginConfig': {'OriginAccessIdentity': ''},
            }],
        },
        'DefaultCacheBehavior': {
            'TargetOriginId': clean_origin_id,
            'ViewerProtocolPolicy': viewer_protocol_policy or 'redirect-to-https',
            'AllowedMethods': {'Quantity': 2, 'Items': ['GET', 'HEAD'], 'CachedMethods': {'Quantity': 2, 'Items': ['GET', 'HEAD']}},
            'Compress': True,
            'TrustedSigners': {'Enabled': False, 'Quantity': 0},
            'ForwardedValues': {
                'QueryString': False,
                'Cookies': {'Forward': 'none'},
            },
            'MinTTL': 0,
        },
    }
    if cache_policy_id:
        behavior = config['DefaultCacheBehavior']
        behavior['CachePolicyId'] = cache_policy_id
        behavior.pop('ForwardedValues', None)
    alias_items = _string_list(aliases)
    if alias_items:
        config['Aliases'] = {'Quantity': len(alias_items), 'Items': alias_items}
    else:
        config['Aliases'] = {'Quantity': 0}
    return config


def create_distribution(
    caller_reference: str,
    origin_id: str,
    origin_domain_name: str,
    *,
    comment: str = '',
    enabled: bool = True,
    aliases: Any = None,
    viewer_protocol_policy: str = 'redirect-to-https',
    cache_policy_id: str = '',
) -> dict[str, Any]:
    response = _client().create_distribution(DistributionConfig=_distribution_config(
        caller_reference,
        origin_id,
        origin_domain_name,
        comment=comment,
        enabled=enabled,
        aliases=aliases,
        viewer_protocol_policy=viewer_protocol_policy,
        cache_policy_id=cache_policy_id,
    ))
    return {'distribution': _clean_response(response.get('Distribution', {})), 'etag': response.get('ETag'), 'response': _clean_response(response)}


def update_distribution(distribution_id: str, config: Any = None, *, if_match: str = '', comment: str = '', enabled: Any = None) -> dict[str, Any]:
    cloudfront = _client()
    clean_id = _required(distribution_id, 'Distribution ID')
    if config:
        distribution_config = _json_object(config, 'Distribution config')
        etag = _required(if_match, 'If-Match ETag')
    else:
        current = cloudfront.get_distribution_config(Id=clean_id)
        distribution_config = current.get('DistributionConfig', {})
        etag = if_match or current.get('ETag')
        if comment != '':
            distribution_config['Comment'] = comment
        if enabled is not None:
            distribution_config['Enabled'] = bool(enabled)
    response = cloudfront.update_distribution(Id=clean_id, IfMatch=_required(etag, 'If-Match ETag'), DistributionConfig=distribution_config)
    return {'distribution': _clean_response(response.get('Distribution', {})), 'etag': response.get('ETag'), 'response': _clean_response(response)}


def delete_distribution(distribution_id: str, *, if_match: str = '') -> dict[str, Any]:
    cloudfront = _client()
    clean_id = _required(distribution_id, 'Distribution ID')
    etag = if_match
    if not etag:
        etag = cloudfront.get_distribution_config(Id=clean_id).get('ETag')
    response = cloudfront.delete_distribution(Id=clean_id, IfMatch=_required(etag, 'If-Match ETag'))
    return {'distribution_id': clean_id, 'response': _clean_response(response)}


def create_invalidation(distribution_id: str, paths: Any, *, caller_reference: str = '') -> dict[str, Any]:
    clean_paths = _string_list(paths)
    if not clean_paths:
        raise ValueError('At least one invalidation path is required')
    reference = caller_reference or f'dashboard-{distribution_id}-{len(clean_paths)}'
    response = _client().create_invalidation(
        DistributionId=_required(distribution_id, 'Distribution ID'),
        InvalidationBatch={
            'CallerReference': reference,
            'Paths': {'Quantity': len(clean_paths), 'Items': clean_paths},
        },
    )
    return {'invalidation': _clean_response(response.get('Invalidation', {})), 'response': _clean_response(response)}


def create_cache_policy(name: str, *, default_ttl: Any = 86400, max_ttl: Any = 31536000, min_ttl: Any = 0, comment: str = '') -> dict[str, Any]:
    response = _client().create_cache_policy(CachePolicyConfig={
        'Name': _required(name, 'Cache policy name'),
        'Comment': comment or '',
        'DefaultTTL': int(default_ttl or 0),
        'MaxTTL': int(max_ttl or 0),
        'MinTTL': int(min_ttl or 0),
        'ParametersInCacheKeyAndForwardedToOrigin': {
            'EnableAcceptEncodingGzip': True,
            'EnableAcceptEncodingBrotli': False,
            'HeadersConfig': {'HeaderBehavior': 'none'},
            'CookiesConfig': {'CookieBehavior': 'none'},
            'QueryStringsConfig': {'QueryStringBehavior': 'none'},
        },
    })
    return {'cache_policy': _clean_response(response.get('CachePolicy', {})), 'etag': response.get('ETag'), 'response': _clean_response(response)}


def create_origin_access_identity(caller_reference: str, *, comment: str = '') -> dict[str, Any]:
    response = _client().create_cloud_front_origin_access_identity(
        CloudFrontOriginAccessIdentityConfig={
            'CallerReference': _required(caller_reference, 'Caller reference'),
            'Comment': comment or '',
        },
    )
    return {'origin_access_identity': _clean_response(response.get('CloudFrontOriginAccessIdentity', {})), 'etag': response.get('ETag'), 'response': _clean_response(response)}


def create_function(name: str, code: str, *, comment: str = '', runtime: str = 'cloudfront-js-1.0') -> dict[str, Any]:
    raw_code = _required(code, 'Function code')
    if raw_code.startswith('base64:'):
        function_code = base64.b64decode(raw_code.removeprefix('base64:'))
    else:
        function_code = raw_code.encode('utf-8')
    response = _client().create_function(
        Name=_required(name, 'Function name'),
        FunctionConfig={'Comment': comment or '', 'Runtime': runtime or 'cloudfront-js-1.0'},
        FunctionCode=function_code,
    )
    return {'function': _clean_response(response.get('FunctionSummary', {})), 'etag': response.get('ETag'), 'response': _clean_response(response)}


def publish_function(name: str, *, if_match: str = '') -> dict[str, Any]:
    cloudfront = _client()
    clean_name = _required(name, 'Function name')
    etag = if_match or cloudfront.describe_function(Name=clean_name).get('ETag')
    response = cloudfront.publish_function(Name=clean_name, IfMatch=_required(etag, 'If-Match ETag'))
    return {'function': _clean_response(response.get('FunctionSummary', {})), 'etag': response.get('ETag'), 'response': _clean_response(response)}


def delete_function(name: str, *, if_match: str = '') -> dict[str, Any]:
    cloudfront = _client()
    clean_name = _required(name, 'Function name')
    etag = if_match or cloudfront.describe_function(Name=clean_name).get('ETag')
    response = cloudfront.delete_function(Name=clean_name, IfMatch=_required(etag, 'If-Match ETag'))
    return {'function_name': clean_name, 'response': _clean_response(response)}


def tag_resource(resource_arn: str, tags: Any) -> dict[str, Any]:
    parsed_tags = _tags(tags)
    if not parsed_tags['Items']:
        raise ValueError('At least one tag is required')
    response = _client().tag_resource(Resource=_required(resource_arn, 'Resource ARN'), Tags=parsed_tags)
    return {'resource_arn': resource_arn, 'tags': parsed_tags['Items'], 'response': _clean_response(response)}


def untag_resource(resource_arn: str, tag_keys: Any) -> dict[str, Any]:
    keys = _string_list(tag_keys)
    if not keys:
        raise ValueError('At least one tag key is required')
    response = _client().untag_resource(Resource=_required(resource_arn, 'Resource ARN'), TagKeys={'Items': keys})
    return {'resource_arn': resource_arn, 'tag_keys': keys, 'response': _clean_response(response)}
