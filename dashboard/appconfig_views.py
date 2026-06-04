"""HTTP endpoints for the AppConfig workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .appconfig_api import (
    create_application,
    create_configuration_profile,
    create_deployment_strategy,
    create_environment,
    create_hosted_configuration_version,
    delete_application,
    get_latest_configuration,
    start_configuration_session,
    start_deployment,
)


@require_http_methods(['POST'])
def appconfig_applications_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_application(body.get('name') or '', description=body.get('description') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='appconfig', operation='create_application')


@require_http_methods(['DELETE'])
def appconfig_application_detail(request, application_id: str):
    try:
        return JsonResponse(delete_application(application_id))
    except Exception as exc:
        return handle_action_error(exc, service='appconfig', operation='delete_application')


@require_http_methods(['POST'])
def appconfig_environments_create(request, application_id: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_environment(application_id, body.get('name') or '', description=body.get('description') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='appconfig', operation='create_environment')


@require_http_methods(['POST'])
def appconfig_profiles_create(request, application_id: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_configuration_profile(
            application_id,
            body.get('name') or '',
            location_uri=body.get('location_uri') or 'hosted',
            profile_type=body.get('profile_type') or 'AWS.Freeform',
            description=body.get('description') or '',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='appconfig', operation='create_configuration_profile')


@require_http_methods(['POST'])
def appconfig_hosted_versions_create(request, application_id: str, profile_id: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_hosted_configuration_version(
            application_id,
            profile_id,
            body.get('content') or '',
            content_type=body.get('content_type') or 'application/json',
            description=body.get('description') or '',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='appconfig', operation='create_hosted_configuration_version')


@require_http_methods(['POST'])
def appconfig_strategies_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_deployment_strategy(
            body.get('name') or '',
            duration_minutes=body.get('duration_minutes') or 0,
            growth_factor=body.get('growth_factor') if body.get('growth_factor') is not None else 100,
            final_bake_minutes=body.get('final_bake_minutes') or 0,
            description=body.get('description') or '',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='appconfig', operation='create_deployment_strategy')


@require_http_methods(['POST'])
def appconfig_deployments_start(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(start_deployment(
            body.get('application_id') or '',
            body.get('environment_id') or '',
            body.get('profile_id') or '',
            body.get('configuration_version') or '',
            body.get('deployment_strategy_id') or '',
            description=body.get('description') or '',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='appconfig', operation='start_deployment')


@require_http_methods(['POST'])
def appconfig_sessions_start(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(start_configuration_session(body.get('application_id') or '', body.get('environment_id') or '', body.get('profile_id') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='appconfig', operation='start_configuration_session')


@require_http_methods(['POST'])
def appconfig_latest_configuration(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(get_latest_configuration(body.get('configuration_token') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='appconfig', operation='get_latest_configuration')
