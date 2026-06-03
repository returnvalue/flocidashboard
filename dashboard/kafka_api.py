"""Interactive MSK/Kafka helpers for local Redpanda cluster workflows."""

from __future__ import annotations

from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('kafka')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _positive_int(value: Any, label: str, default: int) -> int:
    if value in (None, ''):
        return default
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f'{label} must be a number') from exc
    if number <= 0:
        raise ValueError(f'{label} must be greater than zero')
    return number


def _dict_value(value: Any, label: str, *, required: bool = False) -> dict[str, Any]:
    if value in (None, ''):
        if required:
            raise ValueError(f'{label} is required')
        return {}
    if not isinstance(value, dict):
        raise ValueError(f'{label} must be a JSON object')
    return value


def _tags(value: Any) -> dict[str, str]:
    if value in (None, ''):
        return {}
    if not isinstance(value, dict):
        raise ValueError('Tags must be a JSON object')
    return {str(key): str(item) for key, item in value.items()}


def create_cluster(
    name: str,
    *,
    kafka_version: str = '3.6.1',
    number_of_broker_nodes: Any = 1,
    broker_node_group_info: Any = None,
    tags: Any = None,
) -> dict[str, Any]:
    clean_name = _required(name, 'Cluster name')
    clean_broker_info = _dict_value(broker_node_group_info, 'Broker node group info')
    if not clean_broker_info:
        clean_broker_info = {
            'InstanceType': 'kafka.m5.large',
            'ClientSubnets': ['subnet-1'],
        }

    kwargs: dict[str, Any] = {
        'ClusterName': clean_name,
        'KafkaVersion': _required(kafka_version or '3.6.1', 'Kafka version'),
        'NumberOfBrokerNodes': _positive_int(number_of_broker_nodes, 'Number of broker nodes', 1),
        'BrokerNodeGroupInfo': clean_broker_info,
    }
    clean_tags = _tags(tags)
    if clean_tags:
        kwargs['Tags'] = clean_tags

    response = _client().create_cluster(**kwargs)
    return {
        'name': clean_name,
        'arn': response.get('ClusterArn'),
        'state': response.get('State'),
        'response': _clean_response(response),
    }


def create_cluster_v2(
    name: str,
    *,
    kafka_version: str = '3.6.1',
    number_of_broker_nodes: Any = 1,
    broker_node_group_info: Any = None,
    tags: Any = None,
) -> dict[str, Any]:
    clean_name = _required(name, 'Cluster name')
    clean_broker_info = _dict_value(broker_node_group_info, 'Broker node group info')
    if not clean_broker_info:
        clean_broker_info = {
            'InstanceType': 'kafka.m5.large',
            'ClientSubnets': ['subnet-1'],
        }

    kwargs: dict[str, Any] = {
        'ClusterName': clean_name,
        'Provisioned': {
            'KafkaVersion': _required(kafka_version or '3.6.1', 'Kafka version'),
            'NumberOfBrokerNodes': _positive_int(number_of_broker_nodes, 'Number of broker nodes', 1),
            'BrokerNodeGroupInfo': clean_broker_info,
        },
    }
    clean_tags = _tags(tags)
    if clean_tags:
        kwargs['Tags'] = clean_tags

    response = _client().create_cluster_v2(**kwargs)
    return {
        'name': clean_name,
        'arn': response.get('ClusterArn'),
        'state': response.get('State'),
        'response': _clean_response(response),
    }


def delete_cluster(cluster_arn: str) -> dict[str, Any]:
    clean_arn = _required(cluster_arn, 'Cluster ARN')
    response = _client().delete_cluster(ClusterArn=clean_arn)
    return {
        'arn': clean_arn,
        'state': response.get('State'),
        'response': _clean_response(response),
    }


def get_bootstrap_brokers(cluster_arn: str) -> dict[str, Any]:
    clean_arn = _required(cluster_arn, 'Cluster ARN')
    response = _client().get_bootstrap_brokers(ClusterArn=clean_arn)
    return {'arn': clean_arn, 'bootstrap_brokers': _clean_response(response)}
