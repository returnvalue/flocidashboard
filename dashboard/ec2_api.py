"""Interactive EC2 helpers for the instance workbench."""

from __future__ import annotations

import base64
from typing import Any

from .aws import FlociClientFactory


def _ec2_client():
    return FlociClientFactory().client('ec2')


def _required(value: str, label: str) -> str:
    cleaned = (value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _string_list(values: Any) -> list[str]:
    if values in (None, ''):
        return []
    if not isinstance(values, list):
        raise ValueError('Expected a JSON array')
    return [str(value).strip() for value in values if str(value).strip()]


def _encoded_user_data(user_data: str | None) -> str | None:
    if not user_data:
        return None
    return base64.b64encode(user_data.encode('utf-8')).decode('ascii')


def _instance_summary(instance: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': instance.get('InstanceId'),
        'image_id': instance.get('ImageId'),
        'instance_type': instance.get('InstanceType'),
        'state': instance.get('State', {}).get('Name'),
        'private_ip': instance.get('PrivateIpAddress'),
        'public_ip': instance.get('PublicIpAddress'),
        'public_dns': instance.get('PublicDnsName'),
        'key_name': instance.get('KeyName'),
        'subnet_id': instance.get('SubnetId'),
        'vpc_id': instance.get('VpcId'),
    }


def run_instances(
    image_id: str,
    instance_type: str,
    *,
    subnet_id: str | None = None,
    security_group_ids: list[str] | None = None,
    key_name: str | None = None,
    user_data: str | None = None,
    iam_instance_profile_arn: str | None = None,
) -> dict[str, Any]:
    request: dict[str, Any] = {
        'ImageId': _required(image_id, 'Image ID'),
        'InstanceType': _required(instance_type, 'Instance type'),
        'MinCount': 1,
        'MaxCount': 1,
    }
    if subnet_id:
        request['SubnetId'] = subnet_id
    if security_group_ids:
        request['SecurityGroupIds'] = security_group_ids
    if key_name:
        request['KeyName'] = key_name
    encoded_user_data = _encoded_user_data(user_data)
    if encoded_user_data:
        request['UserData'] = encoded_user_data
    if iam_instance_profile_arn:
        request['IamInstanceProfile'] = {'Arn': iam_instance_profile_arn}

    response = _ec2_client().run_instances(**request)
    instances = response.get('Instances', [])
    return {
        'reservation_id': response.get('ReservationId'),
        'instances': [_instance_summary(instance) for instance in instances],
        'instance_id': instances[0].get('InstanceId') if instances else None,
    }


def start_instance(instance_id: str) -> dict[str, Any]:
    instance = _required(instance_id, 'Instance ID')
    response = _ec2_client().start_instances(InstanceIds=[instance])
    return {'instance_id': instance, 'state_changes': response.get('StartingInstances', [])}


def stop_instance(instance_id: str) -> dict[str, Any]:
    instance = _required(instance_id, 'Instance ID')
    response = _ec2_client().stop_instances(InstanceIds=[instance])
    return {'instance_id': instance, 'state_changes': response.get('StoppingInstances', [])}


def reboot_instance(instance_id: str) -> dict[str, Any]:
    instance = _required(instance_id, 'Instance ID')
    _ec2_client().reboot_instances(InstanceIds=[instance])
    return {'instance_id': instance, 'rebooted': True}


def terminate_instance(instance_id: str) -> dict[str, Any]:
    instance = _required(instance_id, 'Instance ID')
    response = _ec2_client().terminate_instances(InstanceIds=[instance])
    return {'instance_id': instance, 'state_changes': response.get('TerminatingInstances', [])}


def import_key_pair(key_name: str, public_key_material: str) -> dict[str, Any]:
    name = _required(key_name, 'Key name')
    material = _required(public_key_material, 'Public key material')
    response = _ec2_client().import_key_pair(
        KeyName=name,
        PublicKeyMaterial=material.encode('utf-8'),
    )
    return {
        'key_name': name,
        'key_pair_id': response.get('KeyPairId'),
        'fingerprint': response.get('KeyFingerprint'),
    }


def normalize_security_group_ids(values: Any) -> list[str]:
    return _string_list(values)
