"""Typed shapes for local AWS workflow labs."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypedDict


class VerificationResult(TypedDict, total=False):
    status: str
    message: str
    resource: Any


class LabStep(TypedDict, total=False):
    key: str
    title: str
    command: str
    explanation: str
    artifact_label: str
    artifact: str


class Lab(TypedDict):
    service: str
    key: str
    title: str
    description: str
    steps: list[LabStep]


class StepResult(TypedDict, total=False):
    service: str
    lab: str
    step: str
    command: str
    exit_code: int
    stdout: str
    stderr: str
    json: Any
    duration_ms: int
    verified: bool
    verification: VerificationResult


class ResetResult(TypedDict, total=False):
    service: str
    lab: str
    command: str
    exit_code: int
    stdout: str
    stderr: str
    json: Any
    duration_ms: int
    reset: bool
    verification: VerificationResult


StepRunner = Callable[[], StepResult]
ResetRunner = Callable[[], ResetResult]
