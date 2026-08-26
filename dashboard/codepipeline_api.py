"""Interactive CodePipeline API helpers for local CI/CD pipelines."""

from __future__ import annotations

import json
from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('codepipeline')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def create_pipeline(pipeline: dict[str, Any] | str) -> dict[str, Any]:
    if isinstance(pipeline, str):
        try:
            pipeline_dict = json.loads(pipeline)
        except json.JSONDecodeError as exc:
            raise ValueError('Pipeline definition must be valid JSON') from exc
    elif isinstance(pipeline, dict):
        pipeline_dict = pipeline
    else:
        raise ValueError('Pipeline definition must be a dictionary or JSON string')

    if not isinstance(pipeline_dict, dict) or not pipeline_dict.get('name'):
        raise ValueError('Pipeline definition must contain a "name" field')

    response = _client().create_pipeline(pipeline=pipeline_dict)
    return {
        'pipeline': _clean_response(response.get('pipeline', {})),
        'response': _clean_response(response),
    }


def get_pipeline(name: str) -> dict[str, Any]:
    clean_name = _required(name, 'Pipeline name')
    response = _client().get_pipeline(name=clean_name)
    return {
        'pipeline': _clean_response(response.get('pipeline', {})),
        'metadata': _clean_response(response.get('metadata', {})),
    }


def get_pipeline_state(name: str) -> dict[str, Any]:
    clean_name = _required(name, 'Pipeline name')
    response = _client().get_pipeline_state(name=clean_name)
    return {
        'pipeline_name': response.get('pipelineName', clean_name),
        'pipeline_version': response.get('pipelineVersion', 1),
        'stage_states': _clean_response(response.get('stageStates', [])),
        'created': _clean_response(response.get('created')),
        'updated': _clean_response(response.get('updated')),
    }


def list_pipeline_executions(name: str, max_results: int = 10) -> dict[str, Any]:
    clean_name = _required(name, 'Pipeline name')
    response = _client().list_pipeline_executions(
        pipelineName=clean_name,
        maxResults=max(1, min(int(max_results or 10), 100)),
    )
    return {
        'pipeline_name': clean_name,
        'pipeline_execution_summaries': _clean_response(response.get('pipelineExecutionSummaries', [])),
    }


def start_pipeline_execution(name: str) -> dict[str, Any]:
    clean_name = _required(name, 'Pipeline name')
    response = _client().start_pipeline_execution(name=clean_name)
    return {
        'pipeline_name': clean_name,
        'pipeline_execution_id': response.get('pipelineExecutionId'),
        'response': _clean_response(response),
    }


def retry_stage_execution(
    pipeline_name: str,
    stage_name: str,
    pipeline_execution_id: str,
    *,
    retry_mode: str = 'FAILED_ACTIONS',
) -> dict[str, Any]:
    clean_pipeline = _required(pipeline_name, 'Pipeline name')
    clean_stage = _required(stage_name, 'Stage name')
    clean_exec_id = _required(pipeline_execution_id, 'Pipeline execution ID')
    response = _client().retry_stage_execution(
        pipelineName=clean_pipeline,
        stageName=clean_stage,
        pipelineExecutionId=clean_exec_id,
        retryMode=retry_mode or 'FAILED_ACTIONS',
    )
    return {
        'pipeline_name': clean_pipeline,
        'stage_name': clean_stage,
        'pipeline_execution_id': response.get('pipelineExecutionId', clean_exec_id),
        'response': _clean_response(response),
    }


def put_approval_result(
    pipeline_name: str,
    stage_name: str,
    action_name: str,
    *,
    status: str = 'Approved',
    summary: str = '',
    token: str | None = None,
) -> dict[str, Any]:
    clean_pipeline = _required(pipeline_name, 'Pipeline name')
    clean_stage = _required(stage_name, 'Stage name')
    clean_action = _required(action_name, 'Action name')
    clean_status = (status or 'Approved').strip().capitalize()
    if clean_status not in ('Approved', 'Rejected'):
        clean_status = 'Approved'

    result_payload = {
        'status': clean_status,
        'summary': summary or f'Manual approval {clean_status.lower()} via Floci Dashboard',
    }

    kwargs: dict[str, Any] = {
        'pipelineName': clean_pipeline,
        'stageName': clean_stage,
        'actionName': clean_action,
        'result': result_payload,
    }
    if token:
        kwargs['token'] = token.strip()
    else:
        kwargs['token'] = 'manual-token-local'

    response = _client().put_approval_result(**kwargs)
    return {
        'pipeline_name': clean_pipeline,
        'stage_name': clean_stage,
        'action_name': clean_action,
        'status': clean_status,
        'approved_at': _clean_response(response.get('approvedAt')),
    }


def enable_stage_transition(
    pipeline_name: str,
    stage_name: str,
    *,
    transition_type: str = 'Inbound',
) -> dict[str, Any]:
    clean_pipeline = _required(pipeline_name, 'Pipeline name')
    clean_stage = _required(stage_name, 'Stage name')
    _client().enable_stage_transition(
        pipelineName=clean_pipeline,
        stageName=clean_stage,
        transitionType=transition_type or 'Inbound',
    )
    return {
        'pipeline_name': clean_pipeline,
        'stage_name': clean_stage,
        'transition_type': transition_type,
        'enabled': True,
    }


def disable_stage_transition(
    pipeline_name: str,
    stage_name: str,
    *,
    transition_type: str = 'Inbound',
    reason: str = '',
) -> dict[str, Any]:
    clean_pipeline = _required(pipeline_name, 'Pipeline name')
    clean_stage = _required(stage_name, 'Stage name')
    clean_reason = reason or 'Transition locked via Floci Dashboard'
    _client().disable_stage_transition(
        pipelineName=clean_pipeline,
        stageName=clean_stage,
        transitionType=transition_type or 'Inbound',
        reason=clean_reason,
    )
    return {
        'pipeline_name': clean_pipeline,
        'stage_name': clean_stage,
        'transition_type': transition_type,
        'enabled': False,
        'reason': clean_reason,
    }


def delete_pipeline(name: str) -> dict[str, Any]:
    clean_name = _required(name, 'Pipeline name')
    response = _client().delete_pipeline(name=clean_name)
    return {
        'pipeline_name': clean_name,
        'deleted': True,
        'response': _clean_response(response),
    }
