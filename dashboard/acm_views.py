"""HTTP endpoints for the ACM certificate workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .acm_api import (
    add_tags,
    delete_certificate,
    export_certificate,
    get_certificate,
    put_account_configuration,
    remove_tags,
    renew_certificate,
    request_certificate,
)


@require_http_methods(['POST'])
def acm_certificates_create(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(request_certificate(
            domain_name=body.get('domain_name') or '',
            subject_alternative_names=body.get('subject_alternative_names') or [],
            validation_method=body.get('validation_method') or 'DNS',
            key_algorithm=body.get('key_algorithm') or 'RSA_2048',
            certificate_authority_arn=body.get('certificate_authority_arn') or '',
            tags=body.get('tags') or [],
        ))
    except Exception as exc:
        return handle_action_error(exc, service='acm', operation='request_certificate')


@require_http_methods(['GET', 'DELETE'])
def acm_certificate_detail(request, certificate_arn: str):
    try:
        if request.method == 'GET':
            return JsonResponse(get_certificate(certificate_arn))
        return JsonResponse(delete_certificate(certificate_arn))
    except Exception as exc:
        operation = 'get_certificate' if request.method == 'GET' else 'delete_certificate'
        return handle_action_error(exc, service='acm', operation=operation)


@require_http_methods(['POST'])
def acm_certificate_renew(request, certificate_arn: str):
    try:
        return JsonResponse(renew_certificate(certificate_arn))
    except Exception as exc:
        return handle_action_error(exc, service='acm', operation='renew_certificate')


@require_http_methods(['POST'])
def acm_certificate_export(request, certificate_arn: str):
    try:
        body = parse_json_body(request)
        return JsonResponse(export_certificate(certificate_arn, body.get('passphrase') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='acm', operation='export_certificate')


@require_http_methods(['POST', 'DELETE'])
def acm_certificate_tags(request, certificate_arn: str):
    try:
        body = parse_json_body(request)
        if request.method == 'POST':
            return JsonResponse(add_tags(certificate_arn, body.get('tags') or []))
        return JsonResponse(remove_tags(certificate_arn, body.get('tag_keys') or []))
    except Exception as exc:
        operation = 'add_tags_to_certificate' if request.method == 'POST' else 'remove_tags_from_certificate'
        return handle_action_error(exc, service='acm', operation=operation)


@require_http_methods(['PUT'])
def acm_account_configuration(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(put_account_configuration(body.get('days_before_expiry') or 45))
    except Exception as exc:
        return handle_action_error(exc, service='acm', operation='put_account_configuration')
