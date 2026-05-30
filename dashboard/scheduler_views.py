"""HTTP endpoints for the EventBridge Scheduler workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .scheduler_api import (
    create_schedule,
    create_schedule_group,
    delete_schedule,
    delete_schedule_group,
    tag_resource,
    untag_resource,
    update_schedule,
)


def _schedule_kwargs(body: dict, *, name: str | None = None, group_name: str | None = None) -> dict:
    return {
        'name': name if name is not None else body.get('name'),
        'group_name': group_name if group_name is not None else body.get('group_name') or 'default',
        'schedule_expression': body.get('schedule_expression'),
        'target': body.get('target'),
        'state': body.get('state') or 'ENABLED',
        'flexible_time_window': body.get('flexible_time_window') or {'Mode': 'OFF'},
        'description': body.get('description') or '',
        'timezone': body.get('timezone') or '',
        'start_date': body.get('start_date'),
        'end_date': body.get('end_date'),
        'action_after_completion': body.get('action_after_completion') or '',
        'kms_key_arn': body.get('kms_key_arn') or '',
    }


@require_http_methods(['POST'])
def scheduler_groups_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_schedule_group(body.get('name'), tags=body.get('tags') or []))
    except Exception as exc:
        return handle_action_error(exc, service='scheduler', operation='create_schedule_group')


@require_http_methods(['DELETE'])
def scheduler_group_delete(request, group_name: str):
    try:
        return JsonResponse(delete_schedule_group(group_name))
    except Exception as exc:
        return handle_action_error(exc, service='scheduler', operation='delete_schedule_group')


@require_http_methods(['POST'])
def scheduler_schedules_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_schedule(**_schedule_kwargs(body)))
    except Exception as exc:
        return handle_action_error(exc, service='scheduler', operation='create_schedule')


@require_http_methods(['PUT', 'DELETE'])
def scheduler_schedule_detail(request, group_name: str, schedule_name: str):
    if request.method == 'DELETE':
        try:
            return JsonResponse(delete_schedule(schedule_name, group_name=group_name))
        except Exception as exc:
            return handle_action_error(exc, service='scheduler', operation='delete_schedule')

    try:
        body = parse_json_body(request)
        return JsonResponse(update_schedule(**_schedule_kwargs(body, name=schedule_name, group_name=group_name)))
    except Exception as exc:
        return handle_action_error(exc, service='scheduler', operation='update_schedule')


@require_http_methods(['POST', 'DELETE'])
def scheduler_tags(request):
    try:
        body = parse_json_body(request)
        if request.method == 'POST':
            return JsonResponse(tag_resource(body.get('resource_arn'), body.get('tags') or []))
        return JsonResponse(untag_resource(body.get('resource_arn'), body.get('tag_keys') or []))
    except Exception as exc:
        operation = 'tag_resource' if request.method == 'POST' else 'untag_resource'
        return handle_action_error(exc, service='scheduler', operation=operation)
