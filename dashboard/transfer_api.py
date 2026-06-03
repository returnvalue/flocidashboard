"""Interactive Transfer Family helpers for local management-plane workflows."""

from __future__ import annotations

from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('transfer')


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


def _list_value(value: Any, label: str) -> list[Any]:
    if value in (None, ''):
        return []
    if not isinstance(value, list):
        raise ValueError(f'{label} must be a JSON array')
    return value


def create_server(
    *,
    protocols: Any = None,
    endpoint_type: str = 'PUBLIC',
    domain: str = 'S3',
    logging_role: str = '',
    security_policy_name: str = '',
    tags: Any = None,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        'Protocols': [str(protocol).upper() for protocol in (_list_value(protocols, 'Protocols') or ['SFTP'])],
        'EndpointType': (endpoint_type or 'PUBLIC').strip().upper(),
        'Domain': (domain or 'S3').strip().upper(),
    }
    if logging_role:
        kwargs['LoggingRole'] = logging_role
    if security_policy_name:
        kwargs['SecurityPolicyName'] = security_policy_name
    clean_tags = _list_value(tags, 'Tags')
    if clean_tags:
        kwargs['Tags'] = clean_tags
    response = _client().create_server(**kwargs)
    return {
        'server_id': response.get('ServerId'),
        'response': _clean_response(response),
    }


def update_server(server_id: str, options: Any) -> dict[str, Any]:
    clean_server = _required(server_id, 'Server ID')
    clean_options = _dict_value(options, 'Server options')
    if not clean_options:
        raise ValueError('Server options are required')
    response = _client().update_server(ServerId=clean_server, **clean_options)
    return {'server_id': clean_server, 'response': _clean_response(response)}


def start_server(server_id: str) -> dict[str, Any]:
    clean_server = _required(server_id, 'Server ID')
    response = _client().start_server(ServerId=clean_server)
    return {'server_id': clean_server, 'response': _clean_response(response)}


def stop_server(server_id: str) -> dict[str, Any]:
    clean_server = _required(server_id, 'Server ID')
    response = _client().stop_server(ServerId=clean_server)
    return {'server_id': clean_server, 'response': _clean_response(response)}


def delete_server(server_id: str) -> dict[str, Any]:
    clean_server = _required(server_id, 'Server ID')
    response = _client().delete_server(ServerId=clean_server)
    return {'server_id': clean_server, 'response': _clean_response(response)}


def create_user(
    server_id: str,
    user_name: str,
    *,
    role: str,
    home_directory: str = '',
    home_directory_mappings: Any = None,
    policy: str = '',
) -> dict[str, Any]:
    clean_server = _required(server_id, 'Server ID')
    clean_user = _required(user_name, 'User name')
    kwargs: dict[str, Any] = {
        'ServerId': clean_server,
        'UserName': clean_user,
        'Role': _required(role, 'Role ARN'),
    }
    if home_directory:
        kwargs['HomeDirectory'] = home_directory
    mappings = _list_value(home_directory_mappings, 'Home directory mappings')
    if mappings:
        kwargs['HomeDirectoryMappings'] = mappings
        kwargs['HomeDirectoryType'] = 'LOGICAL'
    if policy:
        kwargs['Policy'] = policy
    response = _client().create_user(**kwargs)
    return {'server_id': clean_server, 'user_name': clean_user, 'response': _clean_response(response)}


def update_user(server_id: str, user_name: str, options: Any) -> dict[str, Any]:
    clean_server = _required(server_id, 'Server ID')
    clean_user = _required(user_name, 'User name')
    clean_options = _dict_value(options, 'User options')
    if not clean_options:
        raise ValueError('User options are required')
    response = _client().update_user(ServerId=clean_server, UserName=clean_user, **clean_options)
    return {'server_id': clean_server, 'user_name': clean_user, 'response': _clean_response(response)}


def delete_user(server_id: str, user_name: str) -> dict[str, Any]:
    clean_server = _required(server_id, 'Server ID')
    clean_user = _required(user_name, 'User name')
    response = _client().delete_user(ServerId=clean_server, UserName=clean_user)
    return {'server_id': clean_server, 'user_name': clean_user, 'response': _clean_response(response)}


def import_ssh_public_key(server_id: str, user_name: str, ssh_public_key_body: str) -> dict[str, Any]:
    clean_server = _required(server_id, 'Server ID')
    clean_user = _required(user_name, 'User name')
    response = _client().import_ssh_public_key(
        ServerId=clean_server,
        UserName=clean_user,
        SshPublicKeyBody=_required(ssh_public_key_body, 'SSH public key body'),
    )
    return {
        'server_id': clean_server,
        'user_name': clean_user,
        'ssh_public_key_id': response.get('SshPublicKeyId'),
        'response': _clean_response(response),
    }


def delete_ssh_public_key(server_id: str, user_name: str, ssh_public_key_id: str) -> dict[str, Any]:
    clean_server = _required(server_id, 'Server ID')
    clean_user = _required(user_name, 'User name')
    clean_key = _required(ssh_public_key_id, 'SSH public key ID')
    response = _client().delete_ssh_public_key(
        ServerId=clean_server,
        UserName=clean_user,
        SshPublicKeyId=clean_key,
    )
    return {'server_id': clean_server, 'user_name': clean_user, 'ssh_public_key_id': clean_key, 'response': _clean_response(response)}


def tag_resource(arn: str, tags: Any) -> dict[str, Any]:
    clean_arn = _required(arn, 'Resource ARN')
    clean_tags = _list_value(tags, 'Tags')
    if not clean_tags:
        raise ValueError('Tags are required')
    response = _client().tag_resource(Arn=clean_arn, Tags=clean_tags)
    return {'arn': clean_arn, 'response': _clean_response(response)}


def untag_resource(arn: str, tag_keys: Any) -> dict[str, Any]:
    clean_arn = _required(arn, 'Resource ARN')
    keys = [str(key) for key in _list_value(tag_keys, 'Tag keys')]
    if not keys:
        raise ValueError('Tag keys are required')
    response = _client().untag_resource(Arn=clean_arn, TagKeys=keys)
    return {'arn': clean_arn, 'tag_keys': keys, 'response': _clean_response(response)}
