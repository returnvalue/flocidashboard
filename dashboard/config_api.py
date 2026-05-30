"""Interactive AWS Config helpers for local compliance workflows."""

from __future__ import annotations

import json
from typing import Any

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('config')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _json_object(value: Any, label: str) -> dict[str, Any]:
    if isinstance(value, str):
        value = json.loads(value)
    if not isinstance(value, dict):
        raise ValueError(f'{label} must be a JSON object')
    return value


def _tags(value: Any) -> list[dict[str, str]]:
    if value in (None, '', []):
        return []
    if isinstance(value, str):
        value = json.loads(value)
    if isinstance(value, dict):
        value = [{'Key': key, 'Value': item} for key, item in value.items()]
    if not isinstance(value, list):
        raise ValueError('Tags must be an object or list')
    tags = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError('Each tag must be an object')
        key = item.get('Key') or item.get('key')
        if not key:
            raise ValueError('Each tag needs a Key')
        tag_value = item.get('Value')
        if tag_value is None:
            tag_value = item.get('value')
        tags.append({'Key': str(key), 'Value': '' if tag_value is None else str(tag_value)})
    return tags


def _tag_keys(value: Any) -> list[str]:
    if value in (None, '', []):
        return []
    if isinstance(value, str):
        return [item.strip() for item in value.replace('\n', ',').split(',') if item.strip()]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    raise ValueError('Tag keys must be a comma-separated string or list')


def put_config_rule(config_rule: Any) -> dict[str, Any]:
    rule = _json_object(config_rule, 'Config rule')
    name = _required(rule.get('ConfigRuleName'), 'Config rule name')
    response = _client().put_config_rule(ConfigRule=rule)
    return {'name': name, 'config_rule': _clean_response(rule), 'response': _clean_response(response)}


def delete_config_rule(name: Any) -> dict[str, Any]:
    clean_name = _required(name, 'Config rule name')
    response = _client().delete_config_rule(ConfigRuleName=clean_name)
    return {'name': clean_name, 'deleted': True, 'response': _clean_response(response)}


def start_config_rules_evaluation(rule_names: Any) -> dict[str, Any]:
    if isinstance(rule_names, str):
        names = [item.strip() for item in rule_names.replace('\n', ',').split(',') if item.strip()]
    elif isinstance(rule_names, list):
        names = [str(item).strip() for item in rule_names if str(item).strip()]
    else:
        names = []
    if not names:
        raise ValueError('At least one config rule name is required')
    response = _client().start_config_rules_evaluation(ConfigRuleNames=names)
    return {'rule_names': names, 'response': _clean_response(response)}


def put_configuration_recorder(configuration_recorder: Any) -> dict[str, Any]:
    recorder = _json_object(configuration_recorder, 'Configuration recorder')
    name = _required(recorder.get('name') or recorder.get('Name'), 'Configuration recorder name')
    response = _client().put_configuration_recorder(ConfigurationRecorder=recorder)
    return {'name': name, 'configuration_recorder': _clean_response(recorder), 'response': _clean_response(response)}


def start_configuration_recorder(name: Any) -> dict[str, Any]:
    clean_name = _required(name, 'Configuration recorder name')
    response = _client().start_configuration_recorder(ConfigurationRecorderName=clean_name)
    return {'name': clean_name, 'recording': True, 'response': _clean_response(response)}


def stop_configuration_recorder(name: Any) -> dict[str, Any]:
    clean_name = _required(name, 'Configuration recorder name')
    response = _client().stop_configuration_recorder(ConfigurationRecorderName=clean_name)
    return {'name': clean_name, 'recording': False, 'response': _clean_response(response)}


def put_delivery_channel(delivery_channel: Any) -> dict[str, Any]:
    channel = _json_object(delivery_channel, 'Delivery channel')
    name = _required(channel.get('name') or channel.get('Name'), 'Delivery channel name')
    response = _client().put_delivery_channel(DeliveryChannel=channel)
    return {'name': name, 'delivery_channel': _clean_response(channel), 'response': _clean_response(response)}


def put_conformance_pack(name: Any, *, template_body: Any = '', template_s3_uri: Any = '', input_parameters: Any = None) -> dict[str, Any]:
    pack_name = _required(name, 'Conformance pack name')
    kwargs: dict[str, Any] = {'ConformancePackName': pack_name}
    if template_body:
        kwargs['TemplateBody'] = str(template_body)
    if template_s3_uri:
        kwargs['TemplateS3Uri'] = str(template_s3_uri)
    if not template_body and not template_s3_uri:
        raise ValueError('Template body or template S3 URI is required')
    if input_parameters not in (None, '', []):
        if isinstance(input_parameters, str):
            input_parameters = json.loads(input_parameters)
        if not isinstance(input_parameters, list):
            raise ValueError('Input parameters must be a JSON array')
        kwargs['ConformancePackInputParameters'] = input_parameters
    response = _client().put_conformance_pack(**kwargs)
    return {'name': pack_name, 'response': _clean_response(response)}


def delete_conformance_pack(name: Any) -> dict[str, Any]:
    clean_name = _required(name, 'Conformance pack name')
    response = _client().delete_conformance_pack(ConformancePackName=clean_name)
    return {'name': clean_name, 'deleted': True, 'response': _clean_response(response)}


def tag_resource(resource_arn: Any, tags: Any) -> dict[str, Any]:
    clean_tags = _tags(tags)
    if not clean_tags:
        raise ValueError('At least one tag is required')
    response = _client().tag_resource(ResourceArn=_required(resource_arn, 'Resource ARN'), Tags=clean_tags)
    return {'resource_arn': resource_arn, 'tags': clean_tags, 'response': _clean_response(response)}


def untag_resource(resource_arn: Any, tag_keys: Any) -> dict[str, Any]:
    clean_keys = _tag_keys(tag_keys)
    if not clean_keys:
        raise ValueError('At least one tag key is required')
    response = _client().untag_resource(ResourceArn=_required(resource_arn, 'Resource ARN'), TagKeys=clean_keys)
    return {'resource_arn': resource_arn, 'tag_keys': clean_keys, 'response': _clean_response(response)}
