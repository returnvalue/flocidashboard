"""HTTP endpoints for the AWS Config workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .config_api import (
    delete_config_rule,
    delete_conformance_pack,
    put_config_rule,
    put_configuration_recorder,
    put_conformance_pack,
    put_delivery_channel,
    start_config_rules_evaluation,
    start_configuration_recorder,
    stop_configuration_recorder,
    tag_resource,
    untag_resource,
)


@require_http_methods(['POST'])
def config_rules_put(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(put_config_rule(body.get('config_rule') or body))
    except Exception as exc:
        return handle_action_error(exc, service='config', operation='put_config_rule')


@require_http_methods(['DELETE'])
def config_rule_delete(request, rule_name: str):
    try:
        return JsonResponse(delete_config_rule(rule_name))
    except Exception as exc:
        return handle_action_error(exc, service='config', operation='delete_config_rule')


@require_http_methods(['POST'])
def config_rules_evaluation_start(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(start_config_rules_evaluation(body.get('rule_names') or []))
    except Exception as exc:
        return handle_action_error(exc, service='config', operation='start_config_rules_evaluation')


@require_http_methods(['POST'])
def config_recorders_put(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(put_configuration_recorder(body.get('configuration_recorder') or body))
    except Exception as exc:
        return handle_action_error(exc, service='config', operation='put_configuration_recorder')


@require_http_methods(['POST'])
def config_recorder_start(request, recorder_name: str):
    try:
        return JsonResponse(start_configuration_recorder(recorder_name))
    except Exception as exc:
        return handle_action_error(exc, service='config', operation='start_configuration_recorder')


@require_http_methods(['POST'])
def config_recorder_stop(request, recorder_name: str):
    try:
        return JsonResponse(stop_configuration_recorder(recorder_name))
    except Exception as exc:
        return handle_action_error(exc, service='config', operation='stop_configuration_recorder')


@require_http_methods(['POST'])
def config_delivery_channels_put(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(put_delivery_channel(body.get('delivery_channel') or body))
    except Exception as exc:
        return handle_action_error(exc, service='config', operation='put_delivery_channel')


@require_http_methods(['POST'])
def config_conformance_packs_put(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(put_conformance_pack(
            body.get('name') or body.get('conformance_pack_name'),
            template_body=body.get('template_body') or '',
            template_s3_uri=body.get('template_s3_uri') or '',
            input_parameters=body.get('input_parameters'),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='config', operation='put_conformance_pack')


@require_http_methods(['DELETE'])
def config_conformance_pack_delete(request, pack_name: str):
    try:
        return JsonResponse(delete_conformance_pack(pack_name))
    except Exception as exc:
        return handle_action_error(exc, service='config', operation='delete_conformance_pack')


@require_http_methods(['POST', 'DELETE'])
def config_tags(request):
    try:
        body = parse_json_body(request)
        if request.method == 'POST':
            return JsonResponse(tag_resource(body.get('resource_arn'), body.get('tags') or []))
        return JsonResponse(untag_resource(body.get('resource_arn'), body.get('tag_keys') or []))
    except Exception as exc:
        operation = 'tag_resource' if request.method == 'POST' else 'untag_resource'
        return handle_action_error(exc, service='config', operation=operation)
