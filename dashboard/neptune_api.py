"""Interactive Neptune helpers for local Gremlin cluster workflows."""

from __future__ import annotations

from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('neptune')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _dict_value(value: Any, label: str) -> dict[str, Any]:
    if value in (None, ''):
        return {}
    if not isinstance(value, dict):
        raise ValueError(f'{label} must be a JSON object')
    return value


def create_db_cluster(identifier: str, *, engine: str = 'neptune', options: Any = None) -> dict[str, Any]:
    clean_identifier = _required(identifier, 'DB cluster identifier')
    kwargs = {
        'DBClusterIdentifier': clean_identifier,
        'Engine': _required(engine or 'neptune', 'Engine'),
        **_dict_value(options, 'Cluster options'),
    }
    response = _client().create_db_cluster(**kwargs)
    return {
        'cluster_identifier': clean_identifier,
        'cluster': _clean_response(response.get('DBCluster', {})),
        'response': _clean_response(response),
    }


def modify_db_cluster(identifier: str, *, options: Any = None) -> dict[str, Any]:
    clean_identifier = _required(identifier, 'DB cluster identifier')
    clean_options = _dict_value(options, 'Cluster options')
    if not clean_options:
        raise ValueError('Cluster options are required')
    response = _client().modify_db_cluster(DBClusterIdentifier=clean_identifier, **clean_options)
    return {
        'cluster_identifier': clean_identifier,
        'cluster': _clean_response(response.get('DBCluster', {})),
        'response': _clean_response(response),
    }


def delete_db_cluster(identifier: str, *, skip_final_snapshot: Any = True) -> dict[str, Any]:
    clean_identifier = _required(identifier, 'DB cluster identifier')
    response = _client().delete_db_cluster(
        DBClusterIdentifier=clean_identifier,
        SkipFinalSnapshot=bool(skip_final_snapshot),
    )
    return {
        'cluster_identifier': clean_identifier,
        'cluster': _clean_response(response.get('DBCluster', {})),
        'response': _clean_response(response),
    }


def create_db_instance(
    identifier: str,
    *,
    cluster_identifier: str,
    instance_class: str = 'db.r5.large',
    engine: str = 'neptune',
    options: Any = None,
) -> dict[str, Any]:
    clean_identifier = _required(identifier, 'DB instance identifier')
    clean_cluster = _required(cluster_identifier, 'DB cluster identifier')
    kwargs = {
        'DBInstanceIdentifier': clean_identifier,
        'DBClusterIdentifier': clean_cluster,
        'DBInstanceClass': _required(instance_class or 'db.r5.large', 'DB instance class'),
        'Engine': _required(engine or 'neptune', 'Engine'),
        **_dict_value(options, 'Instance options'),
    }
    response = _client().create_db_instance(**kwargs)
    return {
        'instance_identifier': clean_identifier,
        'cluster_identifier': clean_cluster,
        'instance': _clean_response(response.get('DBInstance', {})),
        'response': _clean_response(response),
    }


def modify_db_instance(identifier: str, *, options: Any = None) -> dict[str, Any]:
    clean_identifier = _required(identifier, 'DB instance identifier')
    clean_options = _dict_value(options, 'Instance options')
    if not clean_options:
        raise ValueError('Instance options are required')
    response = _client().modify_db_instance(DBInstanceIdentifier=clean_identifier, **clean_options)
    return {
        'instance_identifier': clean_identifier,
        'instance': _clean_response(response.get('DBInstance', {})),
        'response': _clean_response(response),
    }


def delete_db_instance(identifier: str) -> dict[str, Any]:
    clean_identifier = _required(identifier, 'DB instance identifier')
    response = _client().delete_db_instance(DBInstanceIdentifier=clean_identifier)
    return {
        'instance_identifier': clean_identifier,
        'instance': _clean_response(response.get('DBInstance', {})),
        'response': _clean_response(response),
    }
