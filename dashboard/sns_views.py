"""HTTP endpoints for the SNS publish workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .sns_api import publish_message


@require_http_methods(['POST'])
def sns_messages_publish(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(publish_message(
            body.get('topic_arn', ''),
            body.get('message', ''),
            subject=body.get('subject') or None,
            message_attributes=body.get('message_attributes') or None,
            message_structure=body.get('message_structure') or None,
            message_group_id=body.get('message_group_id') or None,
            message_deduplication_id=body.get('message_deduplication_id') or None,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='sns', operation='publish_message')
