"""Interactive IAM helpers for the identity workbench."""

from __future__ import annotations

import json
from typing import Any, Literal

from .aws import FlociClientFactory

PrincipalType = Literal['user', 'group', 'role']


def _iam_client():
    return FlociClientFactory().client('iam')


def _sts_client():
    return FlociClientFactory().client('sts')


def validate_name(value: str, label: str) -> str:
    name = (value or '').strip()
    if not name:
        raise ValueError(f'{label} is required')
    return name


def validate_principal_type(value: str) -> PrincipalType:
    if value not in {'user', 'group', 'role'}:
        raise ValueError('Principal type must be user, group, or role')
    return value  # type: ignore[return-value]


def policy_document(value: Any) -> dict[str, Any]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise ValueError('Policy document must be valid JSON') from exc
    if not isinstance(value, dict):
        raise ValueError('Policy document must be a JSON object')
    return value


def create_access_key(user_name: str) -> dict[str, Any]:
    name = validate_name(user_name, 'User name')
    response = _iam_client().create_access_key(UserName=name)['AccessKey']
    return {
        'user_name': name,
        'access_key_id': response.get('AccessKeyId'),
        'secret_access_key': response.get('SecretAccessKey'),
        'status': response.get('Status'),
        'created': response.get('CreateDate'),
    }


def update_access_key(user_name: str, access_key_id: str, status: str) -> dict[str, Any]:
    name = validate_name(user_name, 'User name')
    key_id = validate_name(access_key_id, 'Access key ID')
    clean_status = validate_name(status, 'Status')
    if clean_status not in {'Active', 'Inactive'}:
        raise ValueError('Access key status must be Active or Inactive')
    _iam_client().update_access_key(UserName=name, AccessKeyId=key_id, Status=clean_status)
    return {'user_name': name, 'access_key_id': key_id, 'status': clean_status}


def delete_access_key(user_name: str, access_key_id: str) -> dict[str, Any]:
    name = validate_name(user_name, 'User name')
    key_id = validate_name(access_key_id, 'Access key ID')
    _iam_client().delete_access_key(UserName=name, AccessKeyId=key_id)
    return {'user_name': name, 'access_key_id': key_id, 'deleted': True}


def assume_role(role_arn: str, session_name: str, duration_seconds: int | None = None) -> dict[str, Any]:
    arn = validate_name(role_arn, 'Role ARN')
    session = validate_name(session_name, 'Session name')
    payload: dict[str, Any] = {
        'RoleArn': arn,
        'RoleSessionName': session,
    }
    if duration_seconds:
        payload['DurationSeconds'] = int(duration_seconds)
    response = _sts_client().assume_role(**payload)
    credentials = response.get('Credentials', {})
    return {
        'role_arn': arn,
        'session_name': session,
        'assumed_role_user': response.get('AssumedRoleUser'),
        'credentials': {
            'access_key_id': credentials.get('AccessKeyId'),
            'secret_access_key': credentials.get('SecretAccessKey'),
            'session_token': credentials.get('SessionToken'),
            'expiration': credentials.get('Expiration'),
        },
    }


def _attach_method(iam, principal_type: PrincipalType):
    return {
        'user': iam.attach_user_policy,
        'group': iam.attach_group_policy,
        'role': iam.attach_role_policy,
    }[principal_type]


def _detach_method(iam, principal_type: PrincipalType):
    return {
        'user': iam.detach_user_policy,
        'group': iam.detach_group_policy,
        'role': iam.detach_role_policy,
    }[principal_type]


def _inline_put_method(iam, principal_type: PrincipalType):
    return {
        'user': iam.put_user_policy,
        'group': iam.put_group_policy,
        'role': iam.put_role_policy,
    }[principal_type]


def _inline_delete_method(iam, principal_type: PrincipalType):
    return {
        'user': iam.delete_user_policy,
        'group': iam.delete_group_policy,
        'role': iam.delete_role_policy,
    }[principal_type]


def _inline_get_method(iam, principal_type: PrincipalType):
    return {
        'user': iam.get_user_policy,
        'group': iam.get_group_policy,
        'role': iam.get_role_policy,
    }[principal_type]


def _principal_arg(principal_type: PrincipalType, principal_name: str) -> dict[str, str]:
    return {
        'user': {'UserName': principal_name},
        'group': {'GroupName': principal_name},
        'role': {'RoleName': principal_name},
    }[principal_type]


def attach_managed_policy(principal_type: str, principal_name: str, policy_arn: str) -> dict[str, Any]:
    clean_type = validate_principal_type(principal_type)
    name = validate_name(principal_name, 'Principal name')
    arn = validate_name(policy_arn, 'Policy ARN')
    iam = _iam_client()
    _attach_method(iam, clean_type)(**_principal_arg(clean_type, name), PolicyArn=arn)
    return {'principal_type': clean_type, 'principal_name': name, 'policy_arn': arn, 'attached': True}


def detach_managed_policy(principal_type: str, principal_name: str, policy_arn: str) -> dict[str, Any]:
    clean_type = validate_principal_type(principal_type)
    name = validate_name(principal_name, 'Principal name')
    arn = validate_name(policy_arn, 'Policy ARN')
    iam = _iam_client()
    _detach_method(iam, clean_type)(**_principal_arg(clean_type, name), PolicyArn=arn)
    return {'principal_type': clean_type, 'principal_name': name, 'policy_arn': arn, 'detached': True}


def put_inline_policy(principal_type: str, principal_name: str, policy_name: str, document: Any) -> dict[str, Any]:
    clean_type = validate_principal_type(principal_type)
    name = validate_name(principal_name, 'Principal name')
    policy = validate_name(policy_name, 'Policy name')
    doc = policy_document(document)
    iam = _iam_client()
    _inline_put_method(iam, clean_type)(
        **_principal_arg(clean_type, name),
        PolicyName=policy,
        PolicyDocument=json.dumps(doc),
    )
    return {'principal_type': clean_type, 'principal_name': name, 'policy_name': policy, 'saved': True}


def delete_inline_policy(principal_type: str, principal_name: str, policy_name: str) -> dict[str, Any]:
    clean_type = validate_principal_type(principal_type)
    name = validate_name(principal_name, 'Principal name')
    policy = validate_name(policy_name, 'Policy name')
    iam = _iam_client()
    _inline_delete_method(iam, clean_type)(**_principal_arg(clean_type, name), PolicyName=policy)
    return {'principal_type': clean_type, 'principal_name': name, 'policy_name': policy, 'deleted': True}


def get_inline_policy(principal_type: str, principal_name: str, policy_name: str) -> dict[str, Any]:
    clean_type = validate_principal_type(principal_type)
    name = validate_name(principal_name, 'Principal name')
    policy = validate_name(policy_name, 'Policy name')
    iam = _iam_client()
    response = _inline_get_method(iam, clean_type)(**_principal_arg(clean_type, name), PolicyName=policy)
    return {
        'principal_type': clean_type,
        'principal_name': name,
        'policy_name': policy,
        'document': response.get('PolicyDocument'),
    }


def get_managed_policy(policy_arn: str, version_id: str | None = None) -> dict[str, Any]:
    arn = validate_name(policy_arn, 'Policy ARN')
    iam = _iam_client()
    policy = iam.get_policy(PolicyArn=arn)['Policy']
    version = version_id or policy.get('DefaultVersionId')
    document = iam.get_policy_version(PolicyArn=arn, VersionId=version)['PolicyVersion'].get('Document')
    return {
        'name': policy.get('PolicyName'),
        'arn': arn,
        'default_version': policy.get('DefaultVersionId'),
        'version_id': version,
        'document': document,
    }


def create_managed_policy(name: str, document: Any, description: str | None = None, path: str | None = None) -> dict[str, Any]:
    policy_name = validate_name(name, 'Policy name')
    doc = policy_document(document)
    payload: dict[str, Any] = {
        'PolicyName': policy_name,
        'PolicyDocument': json.dumps(doc),
    }
    if description:
        payload['Description'] = description
    if path:
        payload['Path'] = path
    policy = _iam_client().create_policy(**payload)['Policy']
    return {
        'name': policy.get('PolicyName'),
        'arn': policy.get('Arn'),
        'default_version': policy.get('DefaultVersionId'),
    }


def create_policy_version(policy_arn: str, document: Any, set_as_default: bool = True) -> dict[str, Any]:
    arn = validate_name(policy_arn, 'Policy ARN')
    doc = policy_document(document)
    response = _iam_client().create_policy_version(
        PolicyArn=arn,
        PolicyDocument=json.dumps(doc),
        SetAsDefault=bool(set_as_default),
    )['PolicyVersion']
    return {
        'arn': arn,
        'version_id': response.get('VersionId'),
        'default': response.get('IsDefaultVersion'),
        'created': response.get('CreateDate'),
    }


def set_default_policy_version(policy_arn: str, version_id: str) -> dict[str, Any]:
    arn = validate_name(policy_arn, 'Policy ARN')
    version = validate_name(version_id, 'Version ID')
    _iam_client().set_default_policy_version(PolicyArn=arn, VersionId=version)
    return {'arn': arn, 'version_id': version, 'default': True}


def delete_policy_version(policy_arn: str, version_id: str) -> dict[str, Any]:
    arn = validate_name(policy_arn, 'Policy ARN')
    version = validate_name(version_id, 'Version ID')
    _iam_client().delete_policy_version(PolicyArn=arn, VersionId=version)
    return {'arn': arn, 'version_id': version, 'deleted': True}


def add_user_to_group(user_name: str, group_name: str) -> dict[str, Any]:
    user = validate_name(user_name, 'User name')
    group = validate_name(group_name, 'Group name')
    _iam_client().add_user_to_group(UserName=user, GroupName=group)
    return {'user_name': user, 'group_name': group, 'added': True}


def remove_user_from_group(user_name: str, group_name: str) -> dict[str, Any]:
    user = validate_name(user_name, 'User name')
    group = validate_name(group_name, 'Group name')
    _iam_client().remove_user_from_group(UserName=user, GroupName=group)
    return {'user_name': user, 'group_name': group, 'removed': True}


def update_role_trust_policy(role_name: str, document: Any) -> dict[str, Any]:
    role = validate_name(role_name, 'Role name')
    doc = policy_document(document)
    _iam_client().update_assume_role_policy(
        RoleName=role,
        PolicyDocument=json.dumps(doc),
    )
    return {'role_name': role, 'saved': True, 'document': doc}
