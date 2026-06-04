"""Interactive Textract helpers for local stub-response workflows."""

from __future__ import annotations

from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('textract')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _dict_value(value: Any, label: str) -> dict[str, Any]:
    if value in (None, ''):
        return {}
    if not isinstance(value, dict):
        raise ValueError(f'{label} must be a JSON object')
    return value


def _list_value(value: Any, label: str) -> list[Any]:
    if value in (None, ''):
        return []
    if not isinstance(value, list):
        raise ValueError(f'{label} must be a JSON array')
    return value


def detect_document_text(document: Any) -> dict[str, Any]:
    response = _client().detect_document_text(Document=_dict_value(document, 'Document'))
    return {
        'blocks': _clean_response(response.get('Blocks') or []),
        'block_count': len(response.get('Blocks') or []),
        'response': _clean_response(response),
    }


def analyze_document(document: Any, feature_types: Any) -> dict[str, Any]:
    features = [str(feature).upper() for feature in (_list_value(feature_types, 'Feature types') or ['TABLES', 'FORMS'])]
    response = _client().analyze_document(
        Document=_dict_value(document, 'Document'),
        FeatureTypes=features,
    )
    return {
        'feature_types': features,
        'blocks': _clean_response(response.get('Blocks') or []),
        'block_count': len(response.get('Blocks') or []),
        'response': _clean_response(response),
    }


def start_document_text_detection(document_location: Any) -> dict[str, Any]:
    response = _client().start_document_text_detection(
        DocumentLocation=_dict_value(document_location, 'Document location'),
    )
    return {'job_id': response.get('JobId'), 'job_type': 'text_detection', 'response': _clean_response(response)}


def get_document_text_detection(job_id: str) -> dict[str, Any]:
    clean_job = _required(job_id, 'Job ID')
    response = _client().get_document_text_detection(JobId=clean_job)
    return {
        'job_id': clean_job,
        'job_type': 'text_detection',
        'job_status': response.get('JobStatus'),
        'blocks': _clean_response(response.get('Blocks') or []),
        'block_count': len(response.get('Blocks') or []),
        'response': _clean_response(response),
    }


def start_document_analysis(document_location: Any, feature_types: Any) -> dict[str, Any]:
    features = [str(feature).upper() for feature in (_list_value(feature_types, 'Feature types') or ['TABLES', 'FORMS'])]
    response = _client().start_document_analysis(
        DocumentLocation=_dict_value(document_location, 'Document location'),
        FeatureTypes=features,
    )
    return {
        'job_id': response.get('JobId'),
        'job_type': 'analysis',
        'feature_types': features,
        'response': _clean_response(response),
    }


def get_document_analysis(job_id: str) -> dict[str, Any]:
    clean_job = _required(job_id, 'Job ID')
    response = _client().get_document_analysis(JobId=clean_job)
    return {
        'job_id': clean_job,
        'job_type': 'analysis',
        'job_status': response.get('JobStatus'),
        'blocks': _clean_response(response.get('Blocks') or []),
        'block_count': len(response.get('Blocks') or []),
        'response': _clean_response(response),
    }
