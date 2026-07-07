"""IAM lab definitions.

The implementation currently lives in ``monolith``; this module gives future
extraction a stable destination without changing callers.
"""

from __future__ import annotations

from .monolith import (
    IAM_ACCESS_KEY_LAB,
    IAM_ATTACH_POLICY_LAB,
    IAM_CREATE_USER_LAB,
    IAM_GROUP_MEMBERSHIP_LAB,
    IAM_GROUP_POLICY_LAB,
    IAM_INLINE_POLICY_LAB,
    IAM_ROLE_TRUST_LAB,
    IAM_STS_SESSION_POLICY_LAB,
    IAM_INSTANCE_PROFILE_LAB,
)

LABS = [
    IAM_CREATE_USER_LAB,
    IAM_ATTACH_POLICY_LAB,
    IAM_ACCESS_KEY_LAB,
    IAM_GROUP_MEMBERSHIP_LAB,
    IAM_GROUP_POLICY_LAB,
    IAM_INLINE_POLICY_LAB,
    IAM_ROLE_TRUST_LAB,
    IAM_STS_SESSION_POLICY_LAB,
    IAM_INSTANCE_PROFILE_LAB,
]
