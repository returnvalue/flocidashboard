"""Lambda lab definitions."""

from __future__ import annotations

from .monolith import (
    LAMBDA_CREATE_INVOKE_LOGS_LAB,
    LAMBDA_RUNTIME_CONFIG_LAB,
    LAMBDA_SQS_EVENT_SOURCE_LAB,
)

LABS = [
    LAMBDA_CREATE_INVOKE_LOGS_LAB,
    LAMBDA_RUNTIME_CONFIG_LAB,
    LAMBDA_SQS_EVENT_SOURCE_LAB,
]
