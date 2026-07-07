"""Registry facade for local AWS workflow labs."""

from __future__ import annotations

from typing import Any

from .monolith import (
    LAB_BATCH_ORDER,
    NEXT_BUILD_RECOMMENDATIONS,
    get_lab,
    labs_for_service,
    next_lab_batch,
)

__all__ = [
    'LAB_BATCH_ORDER',
    'NEXT_BUILD_RECOMMENDATIONS',
    'get_lab',
    'labs_for_service',
    'next_lab_batch',
]


def all_labs() -> list[dict[str, Any]]:
    """Return every registered lab in practical batch order."""
    return [
        lab
        for batch in LAB_BATCH_ORDER
        for lab in labs_for_service(batch['service'])
    ]
