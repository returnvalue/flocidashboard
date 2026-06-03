"""HTTP endpoints for the AWS Backup workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .backup_api import (
    create_backup_plan,
    create_backup_selection,
    create_backup_vault,
    delete_backup_plan,
    delete_backup_selection,
    delete_backup_vault,
    delete_recovery_point,
    start_backup_job,
    stop_backup_job,
    tag_resource,
    untag_resource,
    update_backup_plan,
)


@require_http_methods(['POST'])
def backup_vaults_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_backup_vault(
            body.get('name') or '',
            tags=body.get('tags') or {},
            encryption_key_arn=body.get('encryption_key_arn') or '',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='backup', operation='create_backup_vault')


@require_http_methods(['DELETE'])
def backup_vault_detail(request, vault_name: str):
    try:
        return JsonResponse(delete_backup_vault(vault_name))
    except Exception as exc:
        return handle_action_error(exc, service='backup', operation='delete_backup_vault')


@require_http_methods(['POST'])
def backup_plans_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_backup_plan(body.get('backup_plan') or {}))
    except Exception as exc:
        return handle_action_error(exc, service='backup', operation='create_backup_plan')


@require_http_methods(['PATCH', 'DELETE'])
def backup_plan_detail(request, plan_id: str):
    try:
        if request.method == 'PATCH':
            body = parse_json_body(request)
            return JsonResponse(update_backup_plan(plan_id, body.get('backup_plan') or {}))
        return JsonResponse(delete_backup_plan(plan_id))
    except Exception as exc:
        operation = 'update_backup_plan' if request.method == 'PATCH' else 'delete_backup_plan'
        return handle_action_error(exc, service='backup', operation=operation)


@require_http_methods(['POST'])
def backup_selections_create(request, plan_id: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_backup_selection(plan_id, body.get('backup_selection') or {}))
    except Exception as exc:
        return handle_action_error(exc, service='backup', operation='create_backup_selection')


@require_http_methods(['DELETE'])
def backup_selection_detail(request, plan_id: str, selection_id: str):
    try:
        return JsonResponse(delete_backup_selection(plan_id, selection_id))
    except Exception as exc:
        return handle_action_error(exc, service='backup', operation='delete_backup_selection')


@require_http_methods(['POST'])
def backup_jobs_start(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(start_backup_job(
            body.get('backup_vault_name') or '',
            resource_arn=body.get('resource_arn') or '',
            iam_role_arn=body.get('iam_role_arn') or '',
            lifecycle=body.get('lifecycle') or {},
            recovery_point_tags=body.get('recovery_point_tags') or {},
        ))
    except Exception as exc:
        return handle_action_error(exc, service='backup', operation='start_backup_job')


@require_http_methods(['POST'])
def backup_job_stop(request, job_id: str):
    try:
        return JsonResponse(stop_backup_job(job_id))
    except Exception as exc:
        return handle_action_error(exc, service='backup', operation='stop_backup_job')


@require_http_methods(['DELETE'])
def backup_recovery_point_detail(request, vault_name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(delete_recovery_point(vault_name, body.get('recovery_point_arn') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='backup', operation='delete_recovery_point')


@require_http_methods(['POST', 'DELETE'])
def backup_resource_tags(request):
    try:
        body = parse_json_body(request)
        if request.method == 'DELETE':
            return JsonResponse(untag_resource(body.get('resource_arn') or '', body.get('tag_keys') or []))
        return JsonResponse(tag_resource(body.get('resource_arn') or '', body.get('tags') or {}))
    except Exception as exc:
        operation = 'untag_resource' if request.method == 'DELETE' else 'tag_resource'
        return handle_action_error(exc, service='backup', operation=operation)
