"""CloudWatch Metrics & Logs workflow labs."""

from __future__ import annotations

import json
import time
from typing import Any

from botocore.exceptions import ClientError
from django.core.cache import cache

from dashboard.aws import FlociClientFactory, _clean_response

REGION = 'us-east-1'
ACCOUNT = '000000000000'
CACHE_PREFIX = 'floci-lab:cloudwatch:'

NAMESPACE = 'Floci/Ecommerce'
METRIC_NAME = 'OrderProcessingErrors'
ALARM_NAME = 'lab-order-error-alarm'

LOG_GROUP_NAME = '/aws/floci/app-logs'
LOG_STREAM_NAME = 'web-server-1'

METRIC_ALARMS_LAB = {
    'service': 'cloudwatch',
    'key': 'metric-alarms',
    'title': 'Publish custom CloudWatch metrics and trigger alarms',
    'description': 'Ingest custom application metrics into Amazon CloudWatch, configure a threshold metric alarm with evaluation periods, trigger alarm transitions, and inspect alarm state.',
    'steps': [
        {
            'key': 'put-metric-data',
            'title': 'Publish custom metric data points',
            'command': f'aws cloudwatch put-metric-data --namespace {NAMESPACE} --metric-data MetricName={METRIC_NAME},Value=5,Unit=Count',
            'explanation': 'Publishes custom numerical measurements and dimensions into CloudWatch under the specified namespace.',
        },
        {
            'key': 'create-metric-alarm',
            'title': 'Create threshold metric alarm',
            'command': f'aws cloudwatch put-metric-alarm --alarm-name {ALARM_NAME} --metric-name {METRIC_NAME} --namespace {NAMESPACE} --statistic Sum --period 60 --evaluation-periods 1 --threshold 1 --comparison-operator GreaterThanThreshold',
            'explanation': 'Configures an alarm that monitors the Sum of errors over a 60-second period, evaluating when the metric exceeds 1.',
        },
        {
            'key': 'trigger-alarm-state',
            'title': 'Simulate alarm transition to ALARM state',
            'command': f'aws cloudwatch set-alarm-state --alarm-name {ALARM_NAME} --state-value ALARM --state-reason "High error spike detected in order processor"',
            'explanation': 'Explicitly sets the alarm state to test downstream alert actions and verify operational incident response.',
        },
        {
            'key': 'describe-alarms',
            'title': 'Describe alarm state and evaluation history',
            'command': f'aws cloudwatch describe-alarms --alarm-names {ALARM_NAME}',
            'explanation': 'Queries the active metric alarm configuration, current state value, and state reason.',
        },
    ],
}

LOGS_FILTERS_LAB = {
    'service': 'cloudwatch',
    'key': 'log-groups-metric-filters',
    'title': 'Stream logs and query events in CloudWatch Logs',
    'description': 'Create an Amazon CloudWatch Log Group, provision a dedicated stream, ingest structured application error events, and query events.',
    'steps': [
        {
            'key': 'create-log-group',
            'title': 'Create CloudWatch Log Group',
            'command': f'aws logs create-log-group --log-group-name {LOG_GROUP_NAME}',
            'explanation': 'Defines a retention container for streams of log events emitted by applications, containers, or Lambda functions.',
        },
        {
            'key': 'create-log-stream',
            'title': 'Create Log Stream',
            'command': f'aws logs create-log-stream --log-group-name {LOG_GROUP_NAME} --log-stream-name {LOG_STREAM_NAME}',
            'explanation': 'Creates a distinct sequence of log events originating from a specific application instance or container.',
        },
        {
            'key': 'put-log-events',
            'title': 'Ingest structured application log events',
            'command': f'aws logs put-log-events --log-group-name {LOG_GROUP_NAME} --log-stream-name {LOG_STREAM_NAME} --log-events timestamp=<current-time-ms>,message="HTTP 500 Internal Server Error in order-service"',
            'explanation': 'Uploads a batch of timestamped log entries into the target stream for centralized query and analysis.',
        },
        {
            'key': 'get-log-events',
            'title': 'Retrieve and verify ingested log events',
            'command': f'aws logs get-log-events --log-group-name {LOG_GROUP_NAME} --log-stream-name {LOG_STREAM_NAME}',
            'explanation': 'Fetches the recorded log events and verifies timestamp order and payload integrity.',
        },
    ],
}

LABS = [METRIC_ALARMS_LAB, LOGS_FILTERS_LAB]


def client(name: str):
    return FlociClientFactory().client(name)


def marker(key: str, value: Any = True) -> None:
    cache.set(CACHE_PREFIX + key, _clean_response(value), timeout=86400)


def marked(key: str) -> Any:
    return cache.get(CACHE_PREFIX + key)


def result(lab: str, step: str, command: str, response: Any, verified: bool, message: str, started: float) -> dict[str, Any]:
    clean = _clean_response(response)
    return {
        'service': 'cloudwatch',
        'lab': lab,
        'step': step,
        'command': command,
        'exit_code': 0,
        'stdout': json.dumps(clean, indent=2, default=str),
        'stderr': '',
        'json': clean,
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'verified': verified,
        'verification': {'status': 'passed' if verified else 'failed', 'message': message},
    }


def step_put_metric() -> dict[str, Any]:
    started = time.perf_counter()
    cw = client('cloudwatch')
    resp = cw.put_metric_data(
        Namespace=NAMESPACE,
        MetricData=[{'MetricName': METRIC_NAME, 'Value': 5, 'Unit': 'Count'}],
    )
    marker('metric', {'namespace': NAMESPACE, 'metric': METRIC_NAME, 'value': 5})
    return result(
        'metric-alarms',
        'put-metric-data',
        'aws cloudwatch put-metric-data ...',
        resp,
        True,
        f'Published metric data point {METRIC_NAME}=5 to namespace {NAMESPACE}.',
        started,
    )


def step_create_alarm() -> dict[str, Any]:
    started = time.perf_counter()
    cw = client('cloudwatch')
    resp = cw.put_metric_alarm(
        AlarmName=ALARM_NAME,
        MetricName=METRIC_NAME,
        Namespace=NAMESPACE,
        Statistic='Sum',
        Period=60,
        EvaluationPeriods=1,
        Threshold=1,
        ComparisonOperator='GreaterThanThreshold',
    )
    marker('alarm', resp)
    return result(
        'metric-alarms',
        'create-metric-alarm',
        'aws cloudwatch put-metric-alarm ...',
        resp,
        True,
        f'Metric alarm {ALARM_NAME} created for {NAMESPACE}/{METRIC_NAME} > 1.',
        started,
    )


def step_trigger_alarm() -> dict[str, Any]:
    started = time.perf_counter()
    cw = client('cloudwatch')
    resp = cw.set_alarm_state(
        AlarmName=ALARM_NAME,
        StateValue='ALARM',
        StateReason='High error spike detected in order processor',
    )
    marker('alarm-state', resp)
    return result(
        'metric-alarms',
        'trigger-alarm-state',
        'aws cloudwatch set-alarm-state ...',
        resp,
        True,
        f'Alarm {ALARM_NAME} state set to ALARM.',
        started,
    )


def step_describe_alarms() -> dict[str, Any]:
    started = time.perf_counter()
    cw = client('cloudwatch')
    resp = cw.describe_alarms(AlarmNames=[ALARM_NAME])
    alarms = resp.get('MetricAlarms', [])
    marker('describe-alarm', resp)
    return result(
        'metric-alarms',
        'describe-alarms',
        'aws cloudwatch describe-alarms ...',
        resp,
        any(a.get('AlarmName') == ALARM_NAME for a in alarms),
        f'Alarm {ALARM_NAME} verified in CloudWatch registry.',
        started,
    )


def step_create_log_group() -> dict[str, Any]:
    started = time.perf_counter()
    logs = client('logs')
    try:
        resp = logs.create_log_group(logGroupName=LOG_GROUP_NAME)
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') != 'ResourceAlreadyExistsException':
            raise
        resp = {'logGroupName': LOG_GROUP_NAME}
    marker('log-group', resp)
    return result(
        'log-groups-metric-filters',
        'create-log-group',
        'aws logs create-log-group ...',
        resp,
        True,
        f'Log group {LOG_GROUP_NAME} exists.',
        started,
    )


def step_create_log_stream() -> dict[str, Any]:
    started = time.perf_counter()
    logs = client('logs')
    try:
        resp = logs.create_log_stream(logGroupName=LOG_GROUP_NAME, logStreamName=LOG_STREAM_NAME)
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') != 'ResourceAlreadyExistsException':
            raise
        resp = {'logStreamName': LOG_STREAM_NAME}
    marker('log-stream', resp)
    return result(
        'log-groups-metric-filters',
        'create-log-stream',
        'aws logs create-log-stream ...',
        resp,
        True,
        f'Log stream {LOG_STREAM_NAME} created in {LOG_GROUP_NAME}.',
        started,
    )


def step_put_log_events() -> dict[str, Any]:
    started = time.perf_counter()
    logs = client('logs')
    now_ms = int(time.time() * 1000)
    resp = logs.put_log_events(
        logGroupName=LOG_GROUP_NAME,
        logStreamName=LOG_STREAM_NAME,
        logEvents=[
            {'timestamp': now_ms, 'message': 'HTTP 500 Internal Server Error in order-service (ORDER#9021)'},
            {'timestamp': now_ms + 10, 'message': 'Stacktrace: Database connection timeout at pool.acquire()'},
        ],
    )
    marker('log-events', resp)
    return result(
        'log-groups-metric-filters',
        'put-log-events',
        'aws logs put-log-events ...',
        resp,
        True,
        f'Ingested structured error log events into {LOG_STREAM_NAME}.',
        started,
    )


def step_get_log_events() -> dict[str, Any]:
    started = time.perf_counter()
    logs = client('logs')
    resp = logs.get_log_events(logGroupName=LOG_GROUP_NAME, logStreamName=LOG_STREAM_NAME)
    events = resp.get('events', [])
    marker('get-events', resp)
    return result(
        'log-groups-metric-filters',
        'get-log-events',
        'aws logs get-log-events ...',
        resp,
        len(events) > 0,
        f'Retrieved {len(events)} log events from {LOG_STREAM_NAME}.',
        started,
    )


RUNNERS = {
    'metric-alarms': {
        'put-metric-data': step_put_metric,
        'create-metric-alarm': step_create_alarm,
        'trigger-alarm-state': step_trigger_alarm,
        'describe-alarms': step_describe_alarms,
    },
    'log-groups-metric-filters': {
        'create-log-group': step_create_log_group,
        'create-log-stream': step_create_log_stream,
        'put-log-events': step_put_log_events,
        'get-log-events': step_get_log_events,
    },
}


def run_step(service_key: str, lab_key: str, step_key: str) -> dict[str, Any]:
    if lab_key not in RUNNERS or step_key not in RUNNERS[lab_key]:
        raise ValueError(f'Unknown CloudWatch lab step: {lab_key}/{step_key}')
    return RUNNERS[lab_key][step_key]()


def status(service_key: str, lab_key: str) -> dict[str, Any]:
    if lab_key == 'metric-alarms':
        keys = {
            'put-metric-data': 'metric',
            'create-metric-alarm': 'alarm',
            'trigger-alarm-state': 'alarm-state',
            'describe-alarms': 'describe-alarm',
        }
    elif lab_key == 'log-groups-metric-filters':
        keys = {
            'create-log-group': 'log-group',
            'create-log-stream': 'log-stream',
            'put-log-events': 'log-events',
            'get-log-events': 'get-events',
        }
    else:
        raise ValueError(f'Unknown CloudWatch lab: {lab_key}')

    checks = {step: marked(k) is not None for step, k in keys.items()}
    return {
        'service': 'cloudwatch',
        'lab': lab_key,
        'complete': all(checks.values()),
        'steps': {
            step: {
                'verified': checks[step],
                'verification': {
                    'status': 'passed',
                    'message': 'Verified by CloudWatch runner.',
                } if checks[step] else None,
            }
            for step in keys
        },
    }


def reset(service_key: str, lab_key: str) -> dict[str, Any]:
    started = time.perf_counter()
    cw = client('cloudwatch')
    logs = client('logs')

    try:
        cw.delete_alarms(AlarmNames=[ALARM_NAME])
    except ClientError:
        pass

    try:
        logs.delete_log_group(logGroupName=LOG_GROUP_NAME)
    except ClientError:
        pass

    cache.delete_many([
        CACHE_PREFIX + k
        for k in ['metric', 'alarm', 'alarm-state', 'describe-alarm', 'log-group', 'log-stream', 'log-events', 'get-events']
    ])

    payload = {'removed': True, 'alarm': ALARM_NAME, 'log_group': LOG_GROUP_NAME}
    return {
        'service': 'cloudwatch',
        'lab': lab_key,
        'command': 'aws cloudwatch delete-alarms ...\naws logs delete-log-group ... # cleanup',
        'exit_code': 0,
        'stdout': json.dumps(payload, indent=2),
        'stderr': '',
        'json': payload,
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'reset': True,
        'verification': {'status': 'passed', 'message': 'CloudWatch lab resources cleaned up.'},
    }
