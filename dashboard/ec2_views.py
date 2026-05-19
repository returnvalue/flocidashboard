"""HTTP endpoints for the EC2 instance workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .ec2_api import (
    import_key_pair,
    normalize_security_group_ids,
    reboot_instance,
    run_instances,
    start_instance,
    stop_instance,
    terminate_instance,
)


@require_http_methods(['POST'])
def ec2_instances_run(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(run_instances(
            body.get('image_id', ''),
            body.get('instance_type', ''),
            subnet_id=body.get('subnet_id') or None,
            security_group_ids=normalize_security_group_ids(body.get('security_group_ids')),
            key_name=body.get('key_name') or None,
            user_data=body.get('user_data') or None,
            iam_instance_profile_arn=body.get('iam_instance_profile_arn') or None,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='ec2', operation='run_instances')


@require_http_methods(['POST'])
def ec2_instance_start(request, instance_id: str):
    try:
        return JsonResponse(start_instance(instance_id))
    except Exception as exc:
        return handle_action_error(exc, service='ec2', operation='start_instance')


@require_http_methods(['POST'])
def ec2_instance_stop(request, instance_id: str):
    try:
        return JsonResponse(stop_instance(instance_id))
    except Exception as exc:
        return handle_action_error(exc, service='ec2', operation='stop_instance')


@require_http_methods(['POST'])
def ec2_instance_reboot(request, instance_id: str):
    try:
        return JsonResponse(reboot_instance(instance_id))
    except Exception as exc:
        return handle_action_error(exc, service='ec2', operation='reboot_instance')


@require_http_methods(['POST'])
def ec2_instance_terminate(request, instance_id: str):
    try:
        return JsonResponse(terminate_instance(instance_id))
    except Exception as exc:
        return handle_action_error(exc, service='ec2', operation='terminate_instance')


@require_http_methods(['POST'])
def ec2_key_pairs_import(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(import_key_pair(
            body.get('key_name', ''),
            body.get('public_key_material', ''),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='ec2', operation='import_key_pair')
