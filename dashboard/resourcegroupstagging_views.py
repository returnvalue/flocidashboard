"""HTTP endpoints for the Resource Groups Tagging workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .resourcegroupstagging_api import get_resources, get_tag_values, tag_resources, untag_resources


@require_http_methods(['POST'])
def tagging_resources_tag(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(tag_resources(body.get('resource_arns') or [], body.get('tags') or {}))
    except Exception as exc:
        return handle_action_error(exc, service='resourcegroupstagging', operation='tag_resources')


@require_http_methods(['POST'])
def tagging_resources_untag(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(untag_resources(body.get('resource_arns') or [], body.get('tag_keys') or []))
    except Exception as exc:
        return handle_action_error(exc, service='resourcegroupstagging', operation='untag_resources')


@require_http_methods(['POST'])
def tagging_resources_search(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(get_resources(
            resource_arns=body.get('resource_arns') or [],
            tag_filters=body.get('tag_filters') or [],
            resource_type_filters=body.get('resource_type_filters') or [],
            resources_per_page=body.get('resources_per_page') or 50,
            pagination_token=body.get('pagination_token') or '',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='resourcegroupstagging', operation='get_resources')


@require_http_methods(['POST'])
def tagging_values_get(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(get_tag_values(body.get('key') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='resourcegroupstagging', operation='get_tag_values')
