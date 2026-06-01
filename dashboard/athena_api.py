"""Interactive Athena helpers for local SQL query workflows."""

from __future__ import annotations

from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('athena')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _int_value(value: Any, label: str, default: int | None = None) -> int | None:
    if value in (None, ''):
        return default
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f'{label} must be a number') from exc
    if number < 0:
        raise ValueError(f'{label} must be zero or greater')
    return number


def _dict(value: Any, label: str) -> dict[str, Any]:
    if value in (None, ''):
        return {}
    if not isinstance(value, dict):
        raise ValueError(f'{label} must be an object')
    return value


def _tags(value: Any) -> list[dict[str, str]]:
    if value in (None, '', [], {}):
        return []
    if isinstance(value, dict):
        value = [{'Key': key, 'Value': item} for key, item in value.items()]
    if not isinstance(value, list):
        raise ValueError('Tags must be an object or list')

    tags = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError('Each tag must be an object')
        key = _required(item.get('Key') or item.get('key'), 'Tag key')
        tag_value = item.get('Value')
        if tag_value is None:
            tag_value = item.get('value')
        tags.append({'Key': key, 'Value': '' if tag_value is None else str(tag_value)})
    return tags


def start_query_execution(
    *,
    query_string: str,
    database: str = '',
    catalog: str = '',
    workgroup: str = '',
    output_location: str = '',
    execution_parameters: Any = None,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {'QueryString': _required(query_string, 'Query string')}
    context = {}
    if database:
        context['Database'] = database
    if catalog:
        context['Catalog'] = catalog
    if context:
        kwargs['QueryExecutionContext'] = context
    if workgroup:
        kwargs['WorkGroup'] = workgroup
    if output_location:
        kwargs['ResultConfiguration'] = {'OutputLocation': output_location}
    if execution_parameters:
        if not isinstance(execution_parameters, list):
            raise ValueError('Execution parameters must be a list')
        kwargs['ExecutionParameters'] = [str(item) for item in execution_parameters]

    response = _client().start_query_execution(**kwargs)
    return {
        'query_execution_id': response.get('QueryExecutionId'),
        'response': _clean_response(response),
    }


def stop_query_execution(query_execution_id: str) -> dict[str, Any]:
    clean_id = _required(query_execution_id, 'Query execution ID')
    response = _client().stop_query_execution(QueryExecutionId=clean_id)
    return {
        'query_execution_id': clean_id,
        'response': _clean_response(response),
    }


def get_query_results(query_execution_id: str, *, max_results: Any = 25, next_token: str = '') -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        'QueryExecutionId': _required(query_execution_id, 'Query execution ID'),
        'MaxResults': _int_value(max_results, 'Max results', 25),
    }
    if next_token:
        kwargs['NextToken'] = next_token
    response = _client().get_query_results(**kwargs)
    return {
        'query_execution_id': kwargs['QueryExecutionId'],
        'result_set': _clean_response(response.get('ResultSet', {})),
        'next_token': response.get('NextToken'),
        'response': _clean_response(response),
    }


def get_query_execution(query_execution_id: str) -> dict[str, Any]:
    clean_id = _required(query_execution_id, 'Query execution ID')
    response = _client().get_query_execution(QueryExecutionId=clean_id)
    return {
        'query_execution_id': clean_id,
        'query_execution': _clean_response(response.get('QueryExecution', {})),
        'response': _clean_response(response),
    }


def create_work_group(
    *,
    name: str,
    description: str = '',
    output_location: str = '',
    configuration: Any = None,
    tags: Any = None,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {'Name': _required(name, 'Workgroup name')}
    if description:
        kwargs['Description'] = description
    config = _dict(configuration, 'Configuration')
    if output_location:
        config.setdefault('ResultConfiguration', {})['OutputLocation'] = output_location
    if config:
        kwargs['Configuration'] = config
    clean_tags = _tags(tags)
    if clean_tags:
        kwargs['Tags'] = clean_tags

    response = _client().create_work_group(**kwargs)
    return {
        'name': kwargs['Name'],
        'response': _clean_response(response),
    }
