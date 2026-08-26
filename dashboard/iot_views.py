"""HTTP endpoints for the IoT Core and MQTT workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .iot_api import (
    create_thing,
    create_topic_rule,
    delete_thing,
    delete_thing_shadow,
    delete_topic_rule,
    get_thing_shadow,
    publish_mqtt_message,
    update_thing_shadow,
)


@require_http_methods(['POST'])
def iot_mqtt_publish(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(publish_mqtt_message(
            topic=body.get('topic', ''),
            payload=body.get('payload'),
            qos=body.get('qos', 0),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='iot', operation='publish_mqtt_message')


@require_http_methods(['GET', 'POST', 'DELETE'])
def iot_thing_shadow(request, thing_name: str):
    try:
        if request.method == 'GET':
            shadow_name = request.GET.get('shadow_name')
            return JsonResponse(get_thing_shadow(thing_name, shadow_name=shadow_name))
        if request.method == 'DELETE':
            body = parse_json_body(request) if request.body else {}
            return JsonResponse(delete_thing_shadow(thing_name, shadow_name=body.get('shadow_name')))
        body = parse_json_body(request)
        return JsonResponse(update_thing_shadow(
            thing_name,
            payload=body.get('payload'),
            shadow_name=body.get('shadow_name'),
        ))
    except Exception as exc:
        operation = {'GET': 'get_thing_shadow', 'POST': 'update_thing_shadow', 'DELETE': 'delete_thing_shadow'}[request.method]
        return handle_action_error(exc, service='iot', operation=operation)


@require_http_methods(['POST'])
def iot_things_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_thing(
            thing_name=body.get('thing_name', ''),
            thing_type_name=body.get('thing_type_name'),
            attributes=body.get('attributes'),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='iot', operation='create_thing')


@require_http_methods(['DELETE'])
def iot_thing_detail(request, thing_name: str):
    try:
        return JsonResponse(delete_thing(thing_name))
    except Exception as exc:
        return handle_action_error(exc, service='iot', operation='delete_thing')


@require_http_methods(['POST'])
def iot_topic_rules_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_topic_rule(
            rule_name=body.get('rule_name', ''),
            sql=body.get('sql', ''),
            actions=body.get('actions'),
            description=body.get('description'),
            rule_disabled=body.get('rule_disabled', False),
        ))
    except Exception as exc:
        return handle_action_error(exc, service='iot', operation='create_topic_rule')


@require_http_methods(['DELETE'])
def iot_topic_rule_detail(request, rule_name: str):
    try:
        return JsonResponse(delete_topic_rule(rule_name))
    except Exception as exc:
        return handle_action_error(exc, service='iot', operation='delete_topic_rule')
