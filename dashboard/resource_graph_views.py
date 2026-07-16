from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .actions import handle_action_error
from .resource_graph import resource_graph


@require_GET
def graph_detail(request):
    try:
        return JsonResponse(resource_graph(request.GET.get('scenario', '')))
    except Exception as exc:
        return handle_action_error(exc, service='resource-graph', operation='discover')
