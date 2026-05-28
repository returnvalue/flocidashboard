"""HTTP endpoints for the CloudFormation stack workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .cloudformation_api import (
    create_change_set,
    create_stack,
    delete_change_set,
    delete_stack,
    describe_change_set,
    execute_change_set,
    update_stack,
    validate_template,
)


@require_http_methods(['POST'])
def cloudformation_templates_validate(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(validate_template(body.get('template_body')))
    except Exception as exc:
        return handle_action_error(exc, service='cloudformation', operation='validate_template')


@require_http_methods(['POST'])
def cloudformation_stacks_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_stack(
            body.get('stack_name', ''),
            body.get('template_body'),
            parameters=body.get('parameters'),
            capabilities=body.get('capabilities'),
            disable_rollback=body.get('disable_rollback') is True,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='cloudformation', operation='create_stack')


@require_http_methods(['PUT', 'DELETE'])
def cloudformation_stack_detail(request, stack_name: str):
    if request.method == 'DELETE':
        try:
            return JsonResponse(delete_stack(stack_name))
        except Exception as exc:
            return handle_action_error(exc, service='cloudformation', operation='delete_stack')

    try:
        body = parse_json_body(request)
        return JsonResponse(update_stack(
            stack_name,
            body.get('template_body'),
            parameters=body.get('parameters'),
            capabilities=body.get('capabilities'),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='cloudformation', operation='update_stack')


@require_http_methods(['POST'])
def cloudformation_change_sets_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_change_set(
            body.get('stack_name', ''),
            body.get('change_set_name', ''),
            body.get('template_body'),
            change_set_type=body.get('change_set_type') or 'UPDATE',
            parameters=body.get('parameters'),
            capabilities=body.get('capabilities'),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='cloudformation', operation='create_change_set')


@require_http_methods(['GET', 'POST', 'DELETE'])
def cloudformation_change_set_detail(request, stack_name: str, change_set_name: str):
    if request.method == 'GET':
        try:
            return JsonResponse(describe_change_set(stack_name, change_set_name))
        except Exception as exc:
            return handle_action_error(exc, service='cloudformation', operation='describe_change_set')

    if request.method == 'DELETE':
        try:
            return JsonResponse(delete_change_set(stack_name, change_set_name))
        except Exception as exc:
            return handle_action_error(exc, service='cloudformation', operation='delete_change_set')

    try:
        return JsonResponse(execute_change_set(stack_name, change_set_name))
    except Exception as exc:
        return handle_action_error(exc, service='cloudformation', operation='execute_change_set')
