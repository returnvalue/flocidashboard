"""HTTP endpoints for the EventBridge event sender workbench."""

from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .actions import handle_action_error, parse_json_body
from .eventbridge_api import put_event


@require_http_methods(['POST'])
def eventbridge_events_put(request):
    try:
        body = parse_json_body(request)
        return JsonResponse(put_event(
            body.get('event_bus_name') or 'default',
            body.get('source', ''),
            body.get('detail_type', ''),
            body.get('detail', {}),
            resources=body.get('resources') or None,
        ))
    except Exception as exc:
        return handle_action_error(exc, service='eventbridge', operation='put_event')
