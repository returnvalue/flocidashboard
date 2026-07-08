from __future__ import annotations

from .aws import (
    RUNTIME_ENDPOINT_SESSION_KEY,
    reset_runtime_endpoint_override,
    set_runtime_endpoint_override,
)


class RuntimeEndpointOverrideMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = set_runtime_endpoint_override(
            request.session.get(RUNTIME_ENDPOINT_SESSION_KEY),
        )
        try:
            return self.get_response(request)
        finally:
            reset_runtime_endpoint_override(token)
