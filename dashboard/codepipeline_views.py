"""HTTP endpoints for the CodePipeline management and execution workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .codepipeline_api import (
    create_pipeline,
    delete_pipeline,
    disable_stage_transition,
    enable_stage_transition,
    get_pipeline,
    get_pipeline_state,
    list_pipeline_executions,
    put_approval_result,
    retry_stage_execution,
    start_pipeline_execution,
)


@require_http_methods(['POST'])
def codepipeline_pipelines_create(request):
    try:
        body = parse_json_body(request)
        pipeline_data = body.get('pipeline') or body
        return JsonResponse(create_pipeline(pipeline_data))
    except Exception as exc:
        return handle_action_error(exc, service='codepipeline', operation='create_pipeline')


@require_http_methods(['POST', 'DELETE'])
def codepipeline_pipeline_delete(request, name: str = ''):
    try:
        if not name:
            body = parse_json_body(request)
            name = body.get('name') or body.get('pipeline_name') or ''
        return JsonResponse(delete_pipeline(name))
    except Exception as exc:
        return handle_action_error(exc, service='codepipeline', operation='delete_pipeline')


@require_http_methods(['GET'])
def codepipeline_pipeline_detail(request, name: str):
    try:
        return JsonResponse(get_pipeline(name))
    except Exception as exc:
        return handle_action_error(exc, service='codepipeline', operation='get_pipeline')


@require_http_methods(['GET'])
def codepipeline_pipeline_state(request, name: str):
    try:
        return JsonResponse(get_pipeline_state(name))
    except Exception as exc:
        return handle_action_error(exc, service='codepipeline', operation='get_pipeline_state')


@require_http_methods(['GET'])
def codepipeline_pipeline_executions(request, name: str):
    try:
        max_results = int(request.GET.get('max_results', 10))
        return JsonResponse(list_pipeline_executions(name, max_results=max_results))
    except Exception as exc:
        return handle_action_error(exc, service='codepipeline', operation='list_pipeline_executions')


@require_http_methods(['POST'])
def codepipeline_pipeline_start(request, name: str = ''):
    try:
        if not name:
            body = parse_json_body(request)
            name = body.get('name') or body.get('pipeline_name') or ''
        return JsonResponse(start_pipeline_execution(name))
    except Exception as exc:
        return handle_action_error(exc, service='codepipeline', operation='start_pipeline_execution')


@require_http_methods(['POST'])
def codepipeline_pipeline_retry(request, name: str = ''):
    try:
        body = parse_json_body(request)
        return JsonResponse(retry_stage_execution(
            pipeline_name=name or body.get('pipeline_name') or '',
            stage_name=body.get('stage_name') or '',
            pipeline_execution_id=body.get('pipeline_execution_id') or '',
            retry_mode=body.get('retry_mode') or 'FAILED_ACTIONS',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='codepipeline', operation='retry_stage_execution')


@require_http_methods(['POST'])
def codepipeline_pipeline_approve(request, name: str = ''):
    try:
        body = parse_json_body(request)
        return JsonResponse(put_approval_result(
            pipeline_name=name or body.get('pipeline_name') or '',
            stage_name=body.get('stage_name') or '',
            action_name=body.get('action_name') or '',
            status=body.get('status') or 'Approved',
            summary=body.get('summary') or '',
            token=body.get('token'),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='codepipeline', operation='put_approval_result')


@require_http_methods(['POST'])
def codepipeline_pipeline_transition(request, name: str = ''):
    try:
        body = parse_json_body(request)
        p_name = name or body.get('pipeline_name') or ''
        s_name = body.get('stage_name') or ''
        enabled = bool(body.get('enabled', True))
        trans_type = body.get('transition_type') or 'Inbound'
        if enabled:
            return JsonResponse(enable_stage_transition(p_name, s_name, transition_type=trans_type))
        return JsonResponse(disable_stage_transition(
            p_name,
            s_name,
            transition_type=trans_type,
            reason=body.get('reason') or '',
        ))
    except Exception as exc:
        op = 'enable_stage_transition' if body.get('enabled', True) else 'disable_stage_transition'
        return handle_action_error(exc, service='codepipeline', operation=op)
