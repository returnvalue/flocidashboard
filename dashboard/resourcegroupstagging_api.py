"""Interactive Resource Groups Tagging helpers for centralized tag discovery."""

from __future__ import annotations

from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('resourcegroupstaggingapi')


def _list_value(value: Any, label: str, *, required: bool = False) -> list[Any]:
    if value in (None, ''):
        if required:
            raise ValueError(f'{label} is required')
        return []
    if not isinstance(value, list):
        raise ValueError(f'{label} must be a JSON array')
    if required and not value:
        raise ValueError(f'{label} is required')
    return value


def _tags(value: Any) -> dict[str, str]:
    if not isinstance(value, dict) or not value:
        raise ValueError('Tags must be a non-empty JSON object')
    return {str(key): str(item) for key, item in value.items()}


def tag_resources(resource_arns: Any, tags: Any) -> dict[str, Any]:
    arns = [str(arn) for arn in _list_value(resource_arns, 'Resource ARNs', required=True)]
    clean_tags = _tags(tags)
    response = _client().tag_resources(ResourceARNList=arns, Tags=clean_tags)
    return {'resource_arns': arns, 'tags': clean_tags, 'failed_resources': _clean_response(response.get('FailedResourcesMap', {}))}


def untag_resources(resource_arns: Any, tag_keys: Any) -> dict[str, Any]:
    arns = [str(arn) for arn in _list_value(resource_arns, 'Resource ARNs', required=True)]
    keys = [str(key) for key in _list_value(tag_keys, 'Tag keys', required=True)]
    response = _client().untag_resources(ResourceARNList=arns, TagKeys=keys)
    return {'resource_arns': arns, 'tag_keys': keys, 'failed_resources': _clean_response(response.get('FailedResourcesMap', {}))}


def get_resources(*, resource_arns: Any = None, tag_filters: Any = None, resource_type_filters: Any = None, resources_per_page: Any = 50, pagination_token: str = '') -> dict[str, Any]:
    kwargs: dict[str, Any] = {'ResourcesPerPage': min(max(int(resources_per_page or 50), 1), 100)}
    arns = [str(arn) for arn in _list_value(resource_arns, 'Resource ARNs')]
    filters = _list_value(tag_filters, 'Tag filters')
    types = [str(item) for item in _list_value(resource_type_filters, 'Resource type filters')]
    if arns:
        kwargs['ResourceARNList'] = arns
    if filters:
        kwargs['TagFilters'] = filters
    if types:
        kwargs['ResourceTypeFilters'] = types
    if pagination_token:
        kwargs['PaginationToken'] = pagination_token
    response = _client().get_resources(**kwargs)
    return {
        'resources': _clean_response(response.get('ResourceTagMappingList', [])),
        'pagination_token': response.get('PaginationToken'),
        'filters': {'resource_arns': arns, 'tag_filters': filters, 'resource_type_filters': types},
    }


def get_tag_values(key: str) -> dict[str, Any]:
    clean_key = str(key or '').strip()
    if not clean_key:
        raise ValueError('Tag key is required')
    response = _client().get_tag_values(Key=clean_key)
    return {'key': clean_key, 'values': _clean_response(response.get('TagValues', [])), 'pagination_token': response.get('PaginationToken')}
