"""HTTP endpoints for the SES email workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .ses_api import (
    clear_mailbox,
    create_configuration_set,
    create_template,
    delete_configuration_set,
    delete_event_destination,
    delete_identity,
    delete_template,
    put_event_destination,
    render_template,
    send_email,
    send_raw_email,
    send_templated_email,
    update_configuration_set_sending_enabled,
    update_sending_enabled,
    update_template,
    verify_domain_identity,
    verify_email_identity,
)


@require_http_methods(['POST'])
def ses_identities_verify_email(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(verify_email_identity(body.get('email_address') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='ses', operation='verify_email_identity')


@require_http_methods(['POST'])
def ses_identities_verify_domain(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(verify_domain_identity(body.get('domain') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='ses', operation='verify_domain_identity')


@require_http_methods(['DELETE'])
def ses_identity_detail(request, identity: str):
    try:
        return JsonResponse(delete_identity(identity))
    except Exception as exc:
        return handle_action_error(exc, service='ses', operation='delete_identity')


@require_http_methods(['POST'])
def ses_email_send(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(send_email(
            source=body.get('source') or '',
            to_addresses=body.get('to_addresses') or [],
            subject=body.get('subject') or '',
            text=body.get('text') or '',
            html=body.get('html') or '',
            cc_addresses=body.get('cc_addresses') or [],
            bcc_addresses=body.get('bcc_addresses') or [],
            configuration_set_name=body.get('configuration_set_name') or '',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='ses', operation='send_email')


@require_http_methods(['POST'])
def ses_raw_email_send(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(send_raw_email(
            source=body.get('source') or '',
            destinations=body.get('destinations') or [],
            raw_message=body.get('raw_message') or '',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='ses', operation='send_raw_email')


@require_http_methods(['POST'])
def ses_templated_email_send(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(send_templated_email(
            source=body.get('source') or '',
            to_addresses=body.get('to_addresses') or [],
            template_name=body.get('template_name') or '',
            template_data=body.get('template_data') or '',
            configuration_set_name=body.get('configuration_set_name') or '',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='ses', operation='send_templated_email')


@require_http_methods(['POST'])
def ses_templates_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_template(
            body.get('template_name') or '',
            subject=body.get('subject') or '',
            text=body.get('text') or '',
            html=body.get('html') or '',
        ))
    except Exception as exc:
        return handle_action_error(exc, service='ses', operation='create_template')


@require_http_methods(['PATCH', 'DELETE'])
def ses_template_detail(request, template_name: str):
    try:
        if request.method == 'PATCH':
            body = parse_json_body(request)
            return JsonResponse(update_template(
                template_name,
                subject=body.get('subject') or '',
                text=body.get('text') or '',
                html=body.get('html') or '',
            ))
        return JsonResponse(delete_template(template_name))
    except Exception as exc:
        operation = 'update_template' if request.method == 'PATCH' else 'delete_template'
        return handle_action_error(exc, service='ses', operation=operation)


@require_http_methods(['POST'])
def ses_template_render(request, template_name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(render_template(template_name, body.get('template_data') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='ses', operation='render_template')


@require_http_methods(['PUT'])
def ses_account_sending(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(update_sending_enabled(body.get('enabled')))
    except Exception as exc:
        return handle_action_error(exc, service='ses', operation='update_sending_enabled')


@require_http_methods(['POST'])
def ses_configuration_sets_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(create_configuration_set(body.get('name') or '', tags=body.get('tags') or []))
    except Exception as exc:
        return handle_action_error(exc, service='ses', operation='create_configuration_set')


@require_http_methods(['DELETE'])
def ses_configuration_set_detail(request, name: str):
    try:
        return JsonResponse(delete_configuration_set(name))
    except Exception as exc:
        return handle_action_error(exc, service='ses', operation='delete_configuration_set')


@require_http_methods(['PUT'])
def ses_configuration_set_sending(request, name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(update_configuration_set_sending_enabled(name, body.get('enabled')))
    except Exception as exc:
        return handle_action_error(exc, service='ses', operation='update_configuration_set_sending_enabled')


@require_http_methods(['POST'])
def ses_event_destinations_create(request, name: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(put_event_destination(
            name,
            body.get('event_destination_name') or '',
            body.get('event_destination') or {},
        ))
    except Exception as exc:
        return handle_action_error(exc, service='ses', operation='put_event_destination')


@require_http_methods(['DELETE'])
def ses_event_destination_detail(request, name: str, event_destination_name: str):
    try:
        return JsonResponse(delete_event_destination(name, event_destination_name))
    except Exception as exc:
        return handle_action_error(exc, service='ses', operation='delete_event_destination')


@require_http_methods(['DELETE'])
def ses_mailbox_clear(request):
    try:
        return JsonResponse(clear_mailbox())
    except Exception as exc:
        return handle_action_error(exc, service='ses', operation='clear_mailbox')
