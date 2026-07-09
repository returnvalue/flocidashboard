from __future__ import annotations

from .aws import (
    RUNTIME_IDENTITY_SESSION_KEY,
    RUNTIME_ENDPOINT_SESSION_KEY,
    reset_runtime_endpoint_override,
    reset_runtime_identity_override,
    set_runtime_endpoint_override,
    set_runtime_identity_override,
)


class RuntimeEndpointOverrideMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        endpoint_token = set_runtime_endpoint_override(
            request.session.get(RUNTIME_ENDPOINT_SESSION_KEY),
        )
        identity_token = set_runtime_identity_override(
            request.session.get(RUNTIME_IDENTITY_SESSION_KEY),
        )
        try:
            return self.get_response(request)
        finally:
            reset_runtime_endpoint_override(endpoint_token)
            reset_runtime_identity_override(identity_token)
