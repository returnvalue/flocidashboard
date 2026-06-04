"""HTTP endpoints for the Textract stub-response workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .textract_api import (
    analyze_document,
    detect_document_text,
    get_document_analysis,
    get_document_text_detection,
    start_document_analysis,
    start_document_text_detection,
)


@require_http_methods(['POST'])
def textract_detect_document_text(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(detect_document_text(body.get('document') or {}))
    except Exception as exc:
        return handle_action_error(exc, service='textract', operation='detect_document_text')


@require_http_methods(['POST'])
def textract_analyze_document(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(analyze_document(body.get('document') or {}, body.get('feature_types') or ['TABLES', 'FORMS']))
    except Exception as exc:
        return handle_action_error(exc, service='textract', operation='analyze_document')


@require_http_methods(['POST'])
def textract_start_text_detection(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(start_document_text_detection(body.get('document_location') or {}))
    except Exception as exc:
        return handle_action_error(exc, service='textract', operation='start_document_text_detection')


@require_http_methods(['POST'])
def textract_get_text_detection(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(get_document_text_detection(body.get('job_id') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='textract', operation='get_document_text_detection')


@require_http_methods(['POST'])
def textract_start_analysis(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(start_document_analysis(
            body.get('document_location') or {},
            body.get('feature_types') or ['TABLES', 'FORMS'],
        ))
    except Exception as exc:
        return handle_action_error(exc, service='textract', operation='start_document_analysis')


@require_http_methods(['POST'])
def textract_get_analysis(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(get_document_analysis(body.get('job_id') or ''))
    except Exception as exc:
        return handle_action_error(exc, service='textract', operation='get_document_analysis')
