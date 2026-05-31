"""Interactive ECR helpers for local image repository workflows."""

from __future__ import annotations

import base64
import json
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from .aws import FlociClientFactory, _clean_response


def _client():
    return FlociClientFactory().client('ecr')


def _required(value: Any, label: str) -> str:
    cleaned = str(value or '').strip()
    if not cleaned:
        raise ValueError(f'{label} is required')
    return cleaned


def _list(value: Any, label: str = 'Value') -> list[Any]:
    if value in (None, '', []):
        return []
    if isinstance(value, str):
        return [item.strip() for item in value.replace('\n', ',').split(',') if item.strip()]
    if isinstance(value, list):
        return value
    raise ValueError(f'{label} must be a list')


def _tags(value: Any) -> list[dict[str, str]]:
    if value in (None, '', []):
        return []
    if isinstance(value, dict):
        value = [{'Key': key, 'Value': item} for key, item in value.items()]
    if not isinstance(value, list):
        raise ValueError('Tags must be an object or list')

    tags = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError('Each tag must be an object')
        key = _required(item.get('Key') or item.get('key'), 'Tag key')
        tag_value = item.get('Value')
        if tag_value is None:
            tag_value = item.get('value')
        tags.append({'Key': key, 'Value': '' if tag_value is None else str(tag_value)})
    return tags


def _tag_keys(value: Any) -> list[str]:
    keys = [str(item).strip() for item in _list(value, 'Tag keys') if str(item).strip()]
    if not keys:
        raise ValueError('At least one tag key is required')
    return keys


def _image_ids(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list) or not value:
        raise ValueError('At least one image ID is required')
    images = []
    for item in value:
        if isinstance(item, str):
            text = item.strip()
            if not text:
                continue
            if text.startswith('sha256:'):
                images.append({'imageDigest': text})
            else:
                images.append({'imageTag': text})
            continue
        if isinstance(item, dict):
            image: dict[str, str] = {}
            tag = item.get('imageTag') or item.get('tag')
            digest = item.get('imageDigest') or item.get('digest')
            if tag:
                image['imageTag'] = str(tag)
            if digest:
                image['imageDigest'] = str(digest)
            if image:
                images.append(image)
            continue
        raise ValueError('Each image ID must be an object or string')
    if not images:
        raise ValueError('At least one image ID is required')
    return images


def _policy_text(value: Any, label: str) -> str:
    if value in (None, ''):
        raise ValueError(f'{label} is required')
    if isinstance(value, str):
        return value
    return json.dumps(value)


def create_repository(
    name: str,
    *,
    image_tag_mutability: str = 'MUTABLE',
    tags: Any = None,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        'repositoryName': _required(name, 'Repository name'),
        'imageTagMutability': (image_tag_mutability or 'MUTABLE').strip().upper(),
    }
    clean_tags = _tags(tags)
    if clean_tags:
        kwargs['tags'] = clean_tags
    response = _client().create_repository(**kwargs)
    repository = response.get('repository', {})
    return {
        'name': repository.get('repositoryName') or kwargs['repositoryName'],
        'arn': repository.get('repositoryArn'),
        'uri': repository.get('repositoryUri'),
        'tag_mutability': repository.get('imageTagMutability'),
        'response': _clean_response(response),
    }


def delete_repository(name: str, *, force: bool = True) -> dict[str, Any]:
    repository_name = _required(name, 'Repository name')
    response = _client().delete_repository(repositoryName=repository_name, force=bool(force))
    repository = response.get('repository', {})
    return {
        'name': repository.get('repositoryName') or repository_name,
        'arn': repository.get('repositoryArn'),
        'force': bool(force),
        'response': _clean_response(response),
    }


def get_authorization_token() -> dict[str, Any]:
    response = _client().get_authorization_token()
    auth_data = []
    for item in response.get('authorizationData', []):
        token = item.get('authorizationToken') or ''
        username = 'AWS'
        password = ''
        try:
            decoded = base64.b64decode(token).decode('utf-8')
            username, password = decoded.split(':', 1)
        except (ValueError, TypeError):
            password = token
        endpoint = item.get('proxyEndpoint')
        auth_data.append({
            'proxy_endpoint': endpoint,
            'expires_at': item.get('expiresAt'),
            'username': username,
            'password': password,
            'docker_login': f'docker login --username {username} --password-stdin {endpoint}' if endpoint else '',
        })
    return {'authorization_data': auth_data}


def batch_delete_image(repository_name: str, image_ids: Any) -> dict[str, Any]:
    repo = _required(repository_name, 'Repository name')
    images = _image_ids(image_ids)
    response = _client().batch_delete_image(repositoryName=repo, imageIds=images)
    return {
        'repository_name': repo,
        'image_ids': images,
        'image_ids_deleted': response.get('imageIds', []),
        'failures': response.get('failures', []),
        'response': _clean_response(response),
    }


def put_image_tag_mutability(repository_name: str, image_tag_mutability: str) -> dict[str, Any]:
    repo = _required(repository_name, 'Repository name')
    mutability = _required(image_tag_mutability, 'Image tag mutability').upper()
    response = _client().put_image_tag_mutability(
        repositoryName=repo,
        imageTagMutability=mutability,
    )
    return {'repository_name': repo, 'image_tag_mutability': mutability, 'response': _clean_response(response)}


def put_lifecycle_policy(repository_name: str, lifecycle_policy_text: Any) -> dict[str, Any]:
    repo = _required(repository_name, 'Repository name')
    response = _client().put_lifecycle_policy(
        repositoryName=repo,
        lifecyclePolicyText=_policy_text(lifecycle_policy_text, 'Lifecycle policy'),
    )
    return {'repository_name': repo, 'response': _clean_response(response)}


def delete_lifecycle_policy(repository_name: str) -> dict[str, Any]:
    repo = _required(repository_name, 'Repository name')
    response = _client().delete_lifecycle_policy(repositoryName=repo)
    return {'repository_name': repo, 'response': _clean_response(response)}


def set_repository_policy(repository_name: str, policy_text: Any, *, force: bool = True) -> dict[str, Any]:
    repo = _required(repository_name, 'Repository name')
    response = _client().set_repository_policy(
        repositoryName=repo,
        policyText=_policy_text(policy_text, 'Repository policy'),
        force=bool(force),
    )
    return {'repository_name': repo, 'response': _clean_response(response)}


def delete_repository_policy(repository_name: str) -> dict[str, Any]:
    repo = _required(repository_name, 'Repository name')
    response = _client().delete_repository_policy(repositoryName=repo)
    return {'repository_name': repo, 'response': _clean_response(response)}


def tag_resource(resource_arn: str, tags: Any) -> dict[str, Any]:
    arn = _required(resource_arn, 'Resource ARN')
    clean_tags = _tags(tags)
    if not clean_tags:
        raise ValueError('At least one tag is required')
    response = _client().tag_resource(resourceArn=arn, tags=clean_tags)
    return {'resource_arn': arn, 'tags': clean_tags, 'response': _clean_response(response)}


def untag_resource(resource_arn: str, tag_keys: Any) -> dict[str, Any]:
    arn = _required(resource_arn, 'Resource ARN')
    keys = _tag_keys(tag_keys)
    response = _client().untag_resource(resourceArn=arn, tagKeys=keys)
    return {'resource_arn': arn, 'tag_keys': keys, 'response': _clean_response(response)}


def run_garbage_collection() -> dict[str, Any]:
    endpoint = FlociClientFactory().endpoint_url.rstrip('/')
    request = Request(f'{endpoint}/_floci/ecr/gc', data=b'', method='POST')
    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read().decode('utf-8')
    except URLError as exc:
        raise ValueError(f'ECR garbage collection failed: {exc}') from exc
    try:
        payload = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        payload = {'output': raw}
    return {'endpoint': f'{endpoint}/_floci/ecr/gc', 'result': payload}
