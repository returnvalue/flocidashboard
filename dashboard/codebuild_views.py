"""HTTP endpoints for the CodeBuild workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .codebuild_api import (
    create_project,
    create_report_group,
    delete_project,
    delete_report_group,
    delete_source_credentials,
    get_build,
    import_source_credentials,
    list_curated_images,
    retry_build,
    start_build,
    stop_build,
    update_project,
    update_report_group,
)


@require_http_methods(['POST'])
def codebuild_projects_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_project(body.get('name') or '', body.get('options') or {}))
    except Exception as exc:
        return handle_action_error(exc, service='codebuild', operation='create_project')


@require_http_methods(['PATCH', 'DELETE'])
def codebuild_project_detail(request, project_name: str):
    try:
        if request.method == 'PATCH':
            body = parse_json_body(request)
            return JsonResponse(update_project(project_name, body.get('options') or {}))
        return JsonResponse(delete_project(project_name))
    except Exception as exc:
        operation = 'update_project' if request.method == 'PATCH' else 'delete_project'
        return handle_action_error(exc, service='codebuild', operation=operation)


@require_http_methods(['POST'])
def codebuild_builds_start(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(start_build(body.get('project_name') or '', body.get('options') or {}))
    except Exception as exc:
        return handle_action_error(exc, service='codebuild', operation='start_build')


@require_http_methods(['POST'])
def codebuild_build_get(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(get_build(body.get('build_id') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='codebuild', operation='get_build')


@require_http_methods(['POST'])
def codebuild_build_stop(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(stop_build(body.get('build_id') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='codebuild', operation='stop_build')


@require_http_methods(['POST'])
def codebuild_build_retry(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(retry_build(body.get('build_id') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='codebuild', operation='retry_build')


@require_http_methods(['GET'])
def codebuild_curated_images(request):
    try:
        return JsonResponse(list_curated_images())
    except Exception as exc:
        return handle_action_error(exc, service='codebuild', operation='list_curated_images')


@require_http_methods(['POST'])
def codebuild_report_groups_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_report_group(body.get('name') or '', body.get('options') or {}))
    except Exception as exc:
        return handle_action_error(exc, service='codebuild', operation='create_report_group')


@require_http_methods(['PATCH', 'DELETE'])
def codebuild_report_group_detail(request):
    try:
        body = parse_json_body(request)
        arn = body.get('arn') or ''
        if request.method == 'PATCH':
            return JsonResponse(update_report_group(arn, body.get('options') or {}))
        return JsonResponse(delete_report_group(arn, body.get('delete_reports') or False))
    except Exception as exc:
        operation = 'update_report_group' if request.method == 'PATCH' else 'delete_report_group'
        return handle_action_error(exc, service='codebuild', operation=operation)


@require_http_methods(['POST', 'DELETE'])
def codebuild_source_credentials(request):
    try:
        body = parse_json_body(request)
        if request.method == 'DELETE':
            return JsonResponse(delete_source_credentials(body.get('arn') or ''))
        return JsonResponse(import_source_credentials(
            body.get('server_type') or '',
            body.get('auth_type') or '',
            body.get('token') or '',
            body.get('username') or '',
        ))
    except Exception as exc:
        operation = 'delete_source_credentials' if request.method == 'DELETE' else 'import_source_credentials'
        return handle_action_error(exc, service='codebuild', operation=operation)
