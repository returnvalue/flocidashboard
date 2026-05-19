"""Interactive Step Functions helpers for the execution workbench."""

from __future__ import annotations

import json
from typing import Any

from .aws import FlociClientFactory


def _stepfunctions_client():
    return FlociClientFactory().client('stepfunctions')


def validate_state_machine_arn(arn: str) -> str:
    value = (arn or '').strip()
    if not value or ':states:' not in value or ':stateMachine:' not in value:
        raise ValueError('A valid Step Functions state machine ARN is required')
    return value


def validate_execution_arn(arn: str) -> str:
    value = (arn or '').strip()
    if not value or ':states:' not in value or ':execution:' not in value:
        raise ValueError('A valid Step Functions execution ARN is required')
    return value


def _json_input(value: Any) -> str:
    if value in (None, ''):
        return '{}'
    if isinstance(value, str):
        try:
            json.loads(value)
        except json.JSONDecodeError as exc:
            raise ValueError('Execution input must be valid JSON') from exc
        return value
    return json.dumps(value)


def start_execution(
    state_machine_arn: str,
    execution_input: Any = None,
    *,
    name: str | None = None,
    trace_header: str | None = None,
) -> dict[str, Any]:
    arn = validate_state_machine_arn(state_machine_arn)
    payload: dict[str, Any] = {
        'stateMachineArn': arn,
        'input': _json_input(execution_input),
    }
    if name:
        payload['name'] = name.strip()
    if trace_header:
        payload['traceHeader'] = trace_header.strip()

    response = _stepfunctions_client().start_execution(**payload)
    return {
        'state_machine_arn': arn,
        'execution_arn': response.get('executionArn'),
        'start_date': response.get('startDate'),
    }


def stop_execution(
    execution_arn: str,
    *,
    error: str | None = None,
    cause: str | None = None,
) -> dict[str, Any]:
    arn = validate_execution_arn(execution_arn)
    payload: dict[str, Any] = {'executionArn': arn}
    if error:
        payload['error'] = error.strip()
    if cause:
        payload['cause'] = cause.strip()

    response = _stepfunctions_client().stop_execution(**payload)
    return {
        'execution_arn': arn,
        'stop_date': response.get('stopDate'),
    }
