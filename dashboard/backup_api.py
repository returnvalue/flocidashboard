"""Interactive AWS Backup helpers for local vault, plan, and job workflows."""

from __future__ import annotations

from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('backup')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _dict_value(value: Any, label: str, *, required: bool = False) -> dict[str, Any]:
    if value in (None, ''):
        if required:
            raise ValueError(f'{label} is required')
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


def create_backup_vault(name: str, *, tags: Any = None, encryption_key_arn: str = '') -> dict[str, Any]:
    clean_name = _required(name, 'Backup vault name')
    kwargs: dict[str, Any] = {'BackupVaultName': clean_name}
    clean_tags = _dict_value(tags, 'Tags')
    if clean_tags:
        kwargs['BackupVaultTags'] = {str(key): str(value) for key, value in clean_tags.items()}
    if encryption_key_arn:
        kwargs['EncryptionKeyArn'] = encryption_key_arn
    response = _client().create_backup_vault(**kwargs)
    return {'vault_name': clean_name, 'response': _clean_response(response)}


def delete_backup_vault(name: str) -> dict[str, Any]:
    clean_name = _required(name, 'Backup vault name')
    response = _client().delete_backup_vault(BackupVaultName=clean_name)
    return {'vault_name': clean_name, 'response': _clean_response(response)}


def create_backup_plan(backup_plan: Any) -> dict[str, Any]:
    clean_plan = _dict_value(backup_plan, 'Backup plan', required=True)
    response = _client().create_backup_plan(BackupPlan=clean_plan)
    return {
        'backup_plan_id': response.get('BackupPlanId'),
        'backup_plan_arn': response.get('BackupPlanArn'),
        'version_id': response.get('VersionId'),
        'response': _clean_response(response),
    }


def update_backup_plan(plan_id: str, backup_plan: Any) -> dict[str, Any]:
    clean_plan_id = _required(plan_id, 'Backup plan ID')
    clean_plan = _dict_value(backup_plan, 'Backup plan', required=True)
    response = _client().update_backup_plan(BackupPlanId=clean_plan_id, BackupPlan=clean_plan)
    return {
        'backup_plan_id': response.get('BackupPlanId') or clean_plan_id,
        'backup_plan_arn': response.get('BackupPlanArn'),
        'version_id': response.get('VersionId'),
        'response': _clean_response(response),
    }


def delete_backup_plan(plan_id: str) -> dict[str, Any]:
    clean_plan_id = _required(plan_id, 'Backup plan ID')
    response = _client().delete_backup_plan(BackupPlanId=clean_plan_id)
    return {'backup_plan_id': clean_plan_id, 'response': _clean_response(response)}


def create_backup_selection(plan_id: str, backup_selection: Any) -> dict[str, Any]:
    clean_plan_id = _required(plan_id, 'Backup plan ID')
    clean_selection = _dict_value(backup_selection, 'Backup selection', required=True)
    response = _client().create_backup_selection(
        BackupPlanId=clean_plan_id,
        BackupSelection=clean_selection,
    )
    return {
        'backup_plan_id': clean_plan_id,
        'selection_id': response.get('SelectionId'),
        'response': _clean_response(response),
    }


def delete_backup_selection(plan_id: str, selection_id: str) -> dict[str, Any]:
    clean_plan_id = _required(plan_id, 'Backup plan ID')
    clean_selection_id = _required(selection_id, 'Selection ID')
    response = _client().delete_backup_selection(
        BackupPlanId=clean_plan_id,
        SelectionId=clean_selection_id,
    )
    return {
        'backup_plan_id': clean_plan_id,
        'selection_id': clean_selection_id,
        'response': _clean_response(response),
    }


def start_backup_job(
    vault_name: str,
    *,
    resource_arn: str,
    iam_role_arn: str,
    lifecycle: Any = None,
    recovery_point_tags: Any = None,
) -> dict[str, Any]:
    clean_vault = _required(vault_name, 'Backup vault name')
    kwargs: dict[str, Any] = {
        'BackupVaultName': clean_vault,
        'ResourceArn': _required(resource_arn, 'Resource ARN'),
        'IamRoleArn': _required(iam_role_arn, 'IAM role ARN'),
    }
    clean_lifecycle = _dict_value(lifecycle, 'Lifecycle')
    if clean_lifecycle:
        kwargs['Lifecycle'] = clean_lifecycle
    clean_tags = _dict_value(recovery_point_tags, 'Recovery point tags')
    if clean_tags:
        kwargs['RecoveryPointTags'] = {str(key): str(value) for key, value in clean_tags.items()}
    response = _client().start_backup_job(**kwargs)
    return {
        'backup_job_id': response.get('BackupJobId'),
        'recovery_point_arn': response.get('RecoveryPointArn'),
        'creation_date': response.get('CreationDate'),
        'response': _clean_response(response),
    }


def stop_backup_job(job_id: str) -> dict[str, Any]:
    clean_job_id = _required(job_id, 'Backup job ID')
    response = _client().stop_backup_job(BackupJobId=clean_job_id)
    return {'backup_job_id': clean_job_id, 'response': _clean_response(response)}


def delete_recovery_point(vault_name: str, recovery_point_arn: str) -> dict[str, Any]:
    clean_vault = _required(vault_name, 'Backup vault name')
    clean_arn = _required(recovery_point_arn, 'Recovery point ARN')
    response = _client().delete_recovery_point(
        BackupVaultName=clean_vault,
        RecoveryPointArn=clean_arn,
    )
    return {'backup_vault_name': clean_vault, 'recovery_point_arn': clean_arn, 'response': _clean_response(response)}


def tag_resource(resource_arn: str, tags: Any) -> dict[str, Any]:
    clean_arn = _required(resource_arn, 'Resource ARN')
    clean_tags = _dict_value(tags, 'Tags', required=True)
    response = _client().tag_resource(ResourceArn=clean_arn, Tags={str(key): str(value) for key, value in clean_tags.items()})
    return {'resource_arn': clean_arn, 'response': _clean_response(response)}


def untag_resource(resource_arn: str, tag_keys: Any) -> dict[str, Any]:
    clean_arn = _required(resource_arn, 'Resource ARN')
    keys = [str(key) for key in _list_value(tag_keys, 'Tag key list')]
    if not keys:
        raise ValueError('Tag key list is required')
    response = _client().untag_resource(ResourceArn=clean_arn, TagKeyList=keys)
    return {'resource_arn': clean_arn, 'tag_keys': keys, 'response': _clean_response(response)}
