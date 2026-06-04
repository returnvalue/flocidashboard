"""Interactive CodeBuild helpers for local Docker-backed build workflows."""

from __future__ import annotations

from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('codebuild')


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


def create_project(name: str, options: Any) -> dict[str, Any]:
    clean_name = _required(name, 'Project name')
    payload = {'name': clean_name, **_dict_value(options, 'Project options')}
    response = _client().create_project(**payload)
    return {'project_name': clean_name, 'project': _clean_response(response.get('project', {})), 'response': _clean_response(response)}


def update_project(name: str, options: Any) -> dict[str, Any]:
    clean_name = _required(name, 'Project name')
    response = _client().update_project(name=clean_name, **_dict_value(options, 'Project options'))
    return {'project_name': clean_name, 'project': _clean_response(response.get('project', {})), 'response': _clean_response(response)}


def delete_project(name: str) -> dict[str, Any]:
    clean_name = _required(name, 'Project name')
    response = _client().delete_project(name=clean_name)
    return {'project_name': clean_name, 'response': _clean_response(response)}


def start_build(project_name: str, options: Any = None) -> dict[str, Any]:
    clean_name = _required(project_name, 'Project name')
    response = _client().start_build(projectName=clean_name, **_dict_value(options, 'Build options'))
    build = response.get('build', {})
    return {'project_name': clean_name, 'build_id': build.get('id'), 'build': _clean_response(build), 'response': _clean_response(response)}


def get_build(build_id: str) -> dict[str, Any]:
    clean_id = _required(build_id, 'Build ID')
    response = _client().batch_get_builds(ids=[clean_id])
    builds = response.get('builds') or []
    return {'build_id': clean_id, 'build': _clean_response(builds[0] if builds else {}), 'response': _clean_response(response)}


def stop_build(build_id: str) -> dict[str, Any]:
    clean_id = _required(build_id, 'Build ID')
    response = _client().stop_build(id=clean_id)
    return {'build_id': clean_id, 'build': _clean_response(response.get('build', {})), 'response': _clean_response(response)}


def retry_build(build_id: str) -> dict[str, Any]:
    clean_id = _required(build_id, 'Build ID')
    response = _client().retry_build(id=clean_id)
    build = response.get('build', {})
    return {'source_build_id': clean_id, 'build_id': build.get('id'), 'build': _clean_response(build), 'response': _clean_response(response)}


def list_curated_images() -> dict[str, Any]:
    response = _client().list_curated_environment_images()
    return {'platforms': _clean_response(response.get('platforms') or []), 'response': _clean_response(response)}


def create_report_group(name: str, options: Any) -> dict[str, Any]:
    clean_name = _required(name, 'Report group name')
    response = _client().create_report_group(name=clean_name, **_dict_value(options, 'Report group options'))
    group = response.get('reportGroup', {})
    return {'report_group_name': clean_name, 'report_group_arn': group.get('arn'), 'report_group': _clean_response(group), 'response': _clean_response(response)}


def update_report_group(report_group_arn: str, options: Any) -> dict[str, Any]:
    clean_arn = _required(report_group_arn, 'Report group ARN')
    response = _client().update_report_group(arn=clean_arn, **_dict_value(options, 'Report group options'))
    return {'report_group_arn': clean_arn, 'report_group': _clean_response(response.get('reportGroup', {})), 'response': _clean_response(response)}


def delete_report_group(report_group_arn: str, delete_reports: bool = False) -> dict[str, Any]:
    clean_arn = _required(report_group_arn, 'Report group ARN')
    response = _client().delete_report_group(arn=clean_arn, deleteReports=bool(delete_reports))
    return {'report_group_arn': clean_arn, 'response': _clean_response(response)}


def import_source_credentials(server_type: str, auth_type: str, token: str, username: str = '') -> dict[str, Any]:
    payload = {
        'serverType': _required(server_type, 'Server type'),
        'authType': _required(auth_type, 'Auth type'),
        'token': _required(token, 'Token'),
        'shouldOverwrite': True,
    }
    if username:
        payload['username'] = username
    response = _client().import_source_credentials(**payload)
    return {'arn': response.get('arn'), 'response': _clean_response(response)}


def delete_source_credentials(arn: str) -> dict[str, Any]:
    clean_arn = _required(arn, 'Source credential ARN')
    response = _client().delete_source_credentials(arn=clean_arn)
    return {'arn': clean_arn, 'response': _clean_response(response)}
