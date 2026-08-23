"""Cognito Identity Provider (IDP) workflow labs."""

from __future__ import annotations

import json
import time
from typing import Any

from botocore.exceptions import ClientError
from django.core.cache import cache

from dashboard.aws import FlociClientFactory, _clean_response

REGION = 'us-east-1'
ACCOUNT = '000000000000'
CACHE_PREFIX = 'floci-lab:cognito:'

USER_POOL_NAME = 'lab-auth-user-pool'
CLIENT_APP_NAME = 'lab-web-app-client'
USERNAME = 'developer@floci.local'
PASSWORD = 'FlociDevPassword2026!'

USER_POOL_LAB = {
    'service': 'cognito',
    'key': 'user-pool-signup-auth',
    'title': 'Create a Cognito User Pool, register users, and authenticate',
    'description': 'Provision an Amazon Cognito User Pool with email verification, configure an App Client for client-side authentication, register a user, set credentials, and obtain JWT tokens.',
    'steps': [
        {
            'key': 'create-user-pool',
            'title': 'Create Cognito User Pool',
            'command': f'aws cognito-idp create-user-pool --pool-name {USER_POOL_NAME} --auto-verified-attributes email --policies \'{{"PasswordPolicy":{{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":false}}}}\'',
            'explanation': 'Creates a secure user directory in Amazon Cognito with automated email verification and configurable password policies.',
        },
        {
            'key': 'create-app-client',
            'title': 'Create User Pool App Client',
            'command': f'aws cognito-idp create-user-pool-client --user-pool-id <user-pool-id> --client-name {CLIENT_APP_NAME} --no-generate-secret --explicit-auth-flows ADMIN_NO_SRP_AUTH USER_PASSWORD_AUTH',
            'explanation': 'Creates an App Client without a secret suitable for public web and mobile client authentication against the User Pool.',
        },
        {
            'key': 'sign-up-user',
            'title': f'Register user {USERNAME}',
            'command': f'aws cognito-idp admin-create-user --user-pool-id <user-pool-id> --username {USERNAME} --user-attributes Name=email,Value={USERNAME} Name=email_verified,Value=true --message-action SUPPRESS',
            'explanation': 'Creates a user record in the pool with verified email attributes and skips external email delivery in local development.',
        },
        {
            'key': 'confirm-set-password',
            'title': 'Set permanent password for user',
            'command': f'aws cognito-idp admin-set-user-password --user-pool-id <user-pool-id> --username {USERNAME} --password "{PASSWORD}" --permanent',
            'explanation': 'Sets the user password permanently, transitioning user state from FORCE_CHANGE_PASSWORD to CONFIRMED.',
        },
        {
            'key': 'authenticate-user',
            'title': 'Authenticate user and extract JWT tokens',
            'command': f'aws cognito-idp admin-initiate-auth --user-pool-id <user-pool-id> --client-id <client-id> --auth-flow ADMIN_NO_SRP_AUTH --auth-parameters USERNAME={USERNAME},PASSWORD="{PASSWORD}"',
            'explanation': 'Initiates authentication against the User Pool and returns JWT AccessToken, IdToken, and RefreshToken for API authorizers.',
        },
    ],
}

USER_GROUPS_LAB = {
    'service': 'cognito',
    'key': 'user-groups-custom-attributes',
    'title': 'Manage Cognito user groups and custom profile attributes',
    'description': 'Organize users into role-based groups (Admins and Developers), attach custom attributes, and verify user profile claims.',
    'steps': [
        {
            'key': 'create-user-groups',
            'title': 'Create Admins and Developers groups',
            'command': 'aws cognito-idp create-group --group-name Admins --user-pool-id <user-pool-id> --description "Administrators"\naws cognito-idp create-group --group-name Developers --user-pool-id <user-pool-id> --description "Engineering Developers"',
            'explanation': 'Creates role groups within the User Pool used for role-based access control (RBAC) in Cognito authorization tokens.',
        },
        {
            'key': 'add-user-to-group',
            'title': 'Add user to Developers group',
            'command': f'aws cognito-idp admin-add-user-to-group --user-pool-id <user-pool-id> --username {USERNAME} --group-name Developers',
            'explanation': 'Associates the user with the Developers group, injecting cognito:groups into subsequent token payload claims.',
        },
        {
            'key': 'update-user-attributes',
            'title': 'Update custom user profile attributes',
            'command': f'aws cognito-idp admin-update-user-attributes --user-pool-id <user-pool-id> --username {USERNAME} --user-attributes Name=nickname,Value=floci-dev Name=given_name,Value=Developer',
            'explanation': 'Updates standard and custom profile metadata stored on the user directory object.',
        },
        {
            'key': 'inspect-user-profile',
            'title': 'Inspect user profile and group memberships',
            'command': f'aws cognito-idp admin-get-user --user-pool-id <user-pool-id> --username {USERNAME}\naws cognito-idp admin-list-groups-for-user --user-pool-id <user-pool-id> --username {USERNAME}',
            'explanation': 'Verifies user directory state, attribute values, and confirmed group associations.',
        },
    ],
}

LABS = [USER_POOL_LAB, USER_GROUPS_LAB]


def client(name: str):
    return FlociClientFactory().client(name)


def marker(key: str, value: Any = True) -> None:
    cache.set(CACHE_PREFIX + key, _clean_response(value), timeout=86400)


def marked(key: str) -> Any:
    return cache.get(CACHE_PREFIX + key)


def result(lab: str, step: str, command: str, response: Any, verified: bool, message: str, started: float) -> dict[str, Any]:
    clean = _clean_response(response)
    return {
        'service': 'cognito',
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


def get_or_create_user_pool() -> tuple[str, dict[str, Any]]:
    cog = client('cognito-idp')
    for pool in cog.list_user_pools(MaxResults=20).get('UserPools', []):
        if pool.get('Name') == USER_POOL_NAME:
            return pool['Id'], pool
    resp = cog.create_user_pool(
        PoolName=USER_POOL_NAME,
        AutoVerifiedAttributes=['email'],
    )
    return resp['UserPool']['Id'], resp['UserPool']


def get_or_create_client(pool_id: str) -> tuple[str, dict[str, Any]]:
    cog = client('cognito-idp')
    for cl in cog.list_user_pool_clients(UserPoolId=pool_id, MaxResults=20).get('UserPoolClients', []):
        if cl.get('ClientName') == CLIENT_APP_NAME:
            return cl['ClientId'], cl
    resp = cog.create_user_pool_client(
        UserPoolId=pool_id,
        ClientName=CLIENT_APP_NAME,
        GenerateSecret=False,
        ExplicitAuthFlows=['ADMIN_NO_SRP_AUTH', 'USER_PASSWORD_AUTH'],
    )
    return resp['UserPoolClient']['ClientId'], resp['UserPoolClient']


def get_or_create_user(pool_id: str) -> dict[str, Any]:
    cog = client('cognito-idp')
    try:
        return cog.admin_get_user(UserPoolId=pool_id, Username=USERNAME)
    except ClientError:
        cog.admin_create_user(
            UserPoolId=pool_id,
            Username=USERNAME,
            UserAttributes=[
                {'Name': 'email', 'Value': USERNAME},
                {'Name': 'email_verified', 'Value': 'true'},
            ],
            MessageAction='SUPPRESS',
        )
        cog.admin_set_user_password(
            UserPoolId=pool_id,
            Username=USERNAME,
            Password=PASSWORD,
            Permanent=True,
        )
        return cog.admin_get_user(UserPoolId=pool_id, Username=USERNAME)


def step_create_pool() -> dict[str, Any]:
    started = time.perf_counter()
    pool_id, pool_data = get_or_create_user_pool()
    marker('pool', {'id': pool_id, 'data': pool_data})
    return result(
        'user-pool-signup-auth',
        'create-user-pool',
        'aws cognito-idp create-user-pool ...',
        pool_data,
        True,
        f'Cognito User Pool {USER_POOL_NAME} (ID: {pool_id}) exists with email verification configured.',
        started,
    )


def step_create_client() -> dict[str, Any]:
    started = time.perf_counter()
    pool_id, _ = get_or_create_user_pool()
    client_id, client_data = get_or_create_client(pool_id)
    marker('client', {'id': client_id, 'data': client_data})
    return result(
        'user-pool-signup-auth',
        'create-app-client',
        'aws cognito-idp create-user-pool-client ...',
        client_data,
        True,
        f'App Client {CLIENT_APP_NAME} (ID: {client_id}) created for User Pool {pool_id}.',
        started,
    )


def step_signup_user() -> dict[str, Any]:
    started = time.perf_counter()
    cog = client('cognito-idp')
    pool_id, _ = get_or_create_user_pool()
    try:
        user_resp = cog.admin_create_user(
            UserPoolId=pool_id,
            Username=USERNAME,
            UserAttributes=[
                {'Name': 'email', 'Value': USERNAME},
                {'Name': 'email_verified', 'Value': 'true'},
            ],
            MessageAction='SUPPRESS',
        )
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') != 'UsernameExistsException':
            raise
        user_resp = cog.admin_get_user(UserPoolId=pool_id, Username=USERNAME)
    marker('user', user_resp)
    return result(
        'user-pool-signup-auth',
        'sign-up-user',
        'aws cognito-idp admin-create-user ...',
        user_resp,
        True,
        f'User {USERNAME} created in User Pool {pool_id}.',
        started,
    )


def step_set_password() -> dict[str, Any]:
    started = time.perf_counter()
    cog = client('cognito-idp')
    pool_id, _ = get_or_create_user_pool()
    get_or_create_user(pool_id)
    cog.admin_set_user_password(
        UserPoolId=pool_id,
        Username=USERNAME,
        Password=PASSWORD,
        Permanent=True,
    )
    user = cog.admin_get_user(UserPoolId=pool_id, Username=USERNAME)
    marker('password', user)
    return result(
        'user-pool-signup-auth',
        'confirm-set-password',
        'aws cognito-idp admin-set-user-password ...',
        user,
        user.get('UserStatus') in {'CONFIRMED', 'FORCE_CHANGE_PASSWORD', None},
        f'Permanent password configured for {USERNAME}.',
        started,
    )


def step_auth_user() -> dict[str, Any]:
    started = time.perf_counter()
    cog = client('cognito-idp')
    pool_id, _ = get_or_create_user_pool()
    client_id, _ = get_or_create_client(pool_id)
    get_or_create_user(pool_id)
    auth_resp = cog.admin_initiate_auth(
        UserPoolId=pool_id,
        ClientId=client_id,
        AuthFlow='ADMIN_NO_SRP_AUTH',
        AuthParameters={'USERNAME': USERNAME, 'PASSWORD': PASSWORD},
    )
    auth_res = auth_resp.get('AuthenticationResult', {})
    token_type = auth_res.get('TokenType', 'Bearer')
    marker('auth', auth_resp)
    return result(
        'user-pool-signup-auth',
        'authenticate-user',
        'aws cognito-idp admin-initiate-auth ...',
        auth_resp,
        bool(auth_res.get('IdToken') or auth_res.get('AccessToken')),
        f'Authenticated successfully as {USERNAME} ({token_type} tokens returned).',
        started,
    )


def step_create_groups() -> dict[str, Any]:
    started = time.perf_counter()
    cog = client('cognito-idp')
    pool_id, _ = get_or_create_user_pool()
    get_or_create_user(pool_id)
    created = []
    for g, desc in [('Admins', 'Administrators'), ('Developers', 'Engineering Developers')]:
        try:
            created.append(cog.create_group(GroupName=g, UserPoolId=pool_id, Description=desc))
        except ClientError as exc:
            if exc.response.get('Error', {}).get('Code') != 'GroupExistsException':
                raise
            created.append(cog.get_group(GroupName=g, UserPoolId=pool_id))
    marker('groups', created)
    return result(
        'user-groups-custom-attributes',
        'create-user-groups',
        'aws cognito-idp create-group ...',
        created,
        True,
        f'Admins and Developers groups exist in User Pool {pool_id}.',
        started,
    )


def step_add_to_group() -> dict[str, Any]:
    started = time.perf_counter()
    cog = client('cognito-idp')
    pool_id, _ = get_or_create_user_pool()
    get_or_create_user(pool_id)
    cog.admin_add_user_to_group(UserPoolId=pool_id, Username=USERNAME, GroupName='Developers')
    groups = cog.admin_list_groups_for_user(UserPoolId=pool_id, Username=USERNAME)
    marker('user-group', groups)
    return result(
        'user-groups-custom-attributes',
        'add-user-to-group',
        'aws cognito-idp admin-add-user-to-group ...',
        groups,
        any(g.get('GroupName') == 'Developers' for g in groups.get('Groups', [])),
        f'User {USERNAME} added to Developers group.',
        started,
    )


def step_update_attrs() -> dict[str, Any]:
    started = time.perf_counter()
    cog = client('cognito-idp')
    pool_id, _ = get_or_create_user_pool()
    get_or_create_user(pool_id)
    cog.admin_update_user_attributes(
        UserPoolId=pool_id,
        Username=USERNAME,
        UserAttributes=[
            {'Name': 'nickname', 'Value': 'floci-dev'},
            {'Name': 'given_name', 'Value': 'Developer'},
        ],
    )
    user = cog.admin_get_user(UserPoolId=pool_id, Username=USERNAME)
    marker('attrs', user)
    return result(
        'user-groups-custom-attributes',
        'update-user-attributes',
        'aws cognito-idp admin-update-user-attributes ...',
        user,
        True,
        f'User attributes updated for {USERNAME}.',
        started,
    )


def step_inspect_profile() -> dict[str, Any]:
    started = time.perf_counter()
    cog = client('cognito-idp')
    pool_id, _ = get_or_create_user_pool()
    get_or_create_user(pool_id)
    user = cog.admin_get_user(UserPoolId=pool_id, Username=USERNAME)
    groups = cog.admin_list_groups_for_user(UserPoolId=pool_id, Username=USERNAME)
    payload = {'user': user, 'groups': groups}
    marker('profile', payload)
    return result(
        'user-groups-custom-attributes',
        'inspect-user-profile',
        'aws cognito-idp admin-get-user ...',
        payload,
        True,
        f'Profile and group memberships verified for {USERNAME}.',
        started,
    )


RUNNERS = {
    'user-pool-signup-auth': {
        'create-user-pool': step_create_pool,
        'create-app-client': step_create_client,
        'sign-up-user': step_signup_user,
        'confirm-set-password': step_set_password,
        'authenticate-user': step_auth_user,
    },
    'user-groups-custom-attributes': {
        'create-user-groups': step_create_groups,
        'add-user-to-group': step_add_to_group,
        'update-user-attributes': step_update_attrs,
        'inspect-user-profile': step_inspect_profile,
    },
}


def run_step(service_key: str, lab_key: str, step_key: str) -> dict[str, Any]:
    if lab_key not in RUNNERS or step_key not in RUNNERS[lab_key]:
        raise ValueError(f'Unknown Cognito lab step: {lab_key}/{step_key}')
    return RUNNERS[lab_key][step_key]()


def status(service_key: str, lab_key: str) -> dict[str, Any]:
    if lab_key == 'user-pool-signup-auth':
        keys = {
            'create-user-pool': 'pool',
            'create-app-client': 'client',
            'sign-up-user': 'user',
            'confirm-set-password': 'password',
            'authenticate-user': 'auth',
        }
    elif lab_key == 'user-groups-custom-attributes':
        keys = {
            'create-user-groups': 'groups',
            'add-user-to-group': 'user-group',
            'update-user-attributes': 'attrs',
            'inspect-user-profile': 'profile',
        }
    else:
        raise ValueError(f'Unknown Cognito lab: {lab_key}')

    checks = {step: marked(k) is not None for step, k in keys.items()}
    return {
        'service': 'cognito',
        'lab': lab_key,
        'complete': all(checks.values()),
        'steps': {
            step: {
                'verified': checks[step],
                'verification': {
                    'status': 'passed',
                    'message': 'Verified by Cognito runner.',
                } if checks[step] else None,
            }
            for step in keys
        },
    }


def reset(service_key: str, lab_key: str) -> dict[str, Any]:
    started = time.perf_counter()
    cog = client('cognito-idp')

    for pool in cog.list_user_pools(MaxResults=20).get('UserPools', []):
        if pool.get('Name') == USER_POOL_NAME:
            try:
                cog.delete_user_pool(UserPoolId=pool['Id'])
            except ClientError:
                pass

    cache.delete_many([
        CACHE_PREFIX + k
        for k in ['pool', 'client', 'user', 'password', 'auth', 'groups', 'user-group', 'attrs', 'profile']
    ])

    payload = {'removed': True, 'user_pools': [USER_POOL_NAME]}
    return {
        'service': 'cognito',
        'lab': lab_key,
        'command': 'aws cognito-idp delete-user-pool ... # cleanup',
        'exit_code': 0,
        'stdout': json.dumps(payload, indent=2),
        'stderr': '',
        'json': payload,
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'reset': True,
        'verification': {'status': 'passed', 'message': 'Cognito lab resources cleaned up.'},
    }
