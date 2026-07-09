# Updating IAM Identity Behavior

Goal: make the dashboard behave more like real AWS IAM usage by letting each browser session run dashboard actions and AWS CLI Console commands under a selected local IAM identity.

Status: implemented for session identity selection, IAM workbench identity actions, AWS CLI Console credential wiring, multi-session isolation, and the IAM enforcement capstone lab. Keep this note as the design record for future IAM identity work.

## Current State

The shell helpers now model real IAM behavior well:

- `admin` uses the `floci-admin` profile.
- `mkuser <user>` creates a local IAM user, access key, local profile, and baseline `sts:GetCallerIdentity` permission.
- `loginas <user>` switches future AWS CLI calls to that user profile.
- `assumerole <role>` exports temporary STS credentials for future AWS CLI calls.
- `assumeroleas <user> <role>` switches to a user and assumes a role.

The dashboard now matches that model for browser-session identities. Django can construct request-aware Floci clients from `request.session["floci_identity"]`, service actions can run under the selected identity, and the AWS CLI Console still blocks `--profile` while using the browser session identity as the source of truth.

The IAM workbench is the primary control surface:

- user details expose `Use this user`,
- role details expose `Get temporary credentials`,
- session identity switching creates a session access key without deleting existing user keys by default,
- role assumption stores STS credentials in the session,
- cleanup helpers remove dependent IAM resources before deleting principals,
- the policy simulation panel is available where the local Floci runtime supports it.

## Desired Model

Every browser session should have its own active identity:

```text
Browser session -> selected identity credentials -> boto3 clients -> service workbenches and AWS CLI Console
```

This should allow realistic flows:

1. Use admin identity.
2. Create an IAM user.
3. Switch the dashboard to that IAM user.
4. Watch unauthorized calls fail.
5. Assume a role.
6. Watch role-allowed calls succeed and unrelated calls fail.
7. Clear the identity and return to the dashboard default.

## Session Identity Shape

Store the active identity in `request.session`:

```python
request.session["floci_identity"] = {
    "type": "user" | "assumed_role" | "admin" | "default",
    "label": "charlie" | "CharlieSqsReadRole/floci-session" | "admin",
    "access_key_id": "...",
    "secret_access_key": "...",
    "session_token": "...",  # only for assumed-role identities
    "expires_at": "...",     # only when STS returns expiration
}
```

Do not store arbitrary AWS profile names in the browser session. Store explicit local Floci credentials created by the dashboard or returned by STS. This makes behavior deterministic and avoids depending on the server user's `~/.aws` files.

## Backend Changes

### Client Factory

Update `FlociClientFactory` so it can accept session credentials:

```python
factory = FlociClientFactory(identity=request.session.get("floci_identity"))
```

Credential precedence should become:

1. Session identity credentials.
2. Existing environment/profile behavior.
3. Local `test/test` fallback.

Expose identity context in `credential_context()`:

- `identity_type`
- `identity_label`
- `identity_expires_at`
- `credential_source`
- `profile`
- `profile_source`

### Middleware

Add a small middleware or request helper that makes the active identity available without passing the session manually through every view. Keep it explicit enough that tests can still construct factories directly.

Suggested helper:

```python
def floci_factory_for_request(request):
    return FlociClientFactory(identity=request.session.get("floci_identity"))
```

Then migrate service APIs and action views from direct `FlociClientFactory()` construction to the helper where request context matters.

### Settings And Environment APIs

Extend the environment/settings responses to include:

- current effective identity
- whether identity came from session, profile, environment, or local fallback
- expiration warning for assumed-role sessions
- a clear action to reset to default/server identity

## Identity API Endpoints

Add focused endpoints:

```text
GET  /api/session-identity/
POST /api/session-identity/use-admin/
POST /api/session-identity/use-user/
POST /api/session-identity/assume-role/
POST /api/session-identity/clear/
```

### `GET /api/session-identity/`

Returns active identity, caller identity, endpoint, region, source, and expiration.

### `POST /api/session-identity/use-admin/`

Loads or creates admin credentials for the session. Prefer existing `floci-admin` server profile only as a bootstrap source, then store explicit credentials in the session.

### `POST /api/session-identity/use-user/`

Input:

```json
{
  "user_name": "charlie"
}
```

Implemented behavior:

- Create a local access key for the selected user from an admin context.
- Do not delete existing access keys unless a specific replacement key is supplied.
- Attach baseline `sts:GetCallerIdentity` if missing.
- Store the explicit key pair in the session.

### `POST /api/session-identity/assume-role/`

Input:

```json
{
  "role_name": "CharlieSqsReadRole",
  "session_name": "floci-session"
}
```

Use the current session identity as the caller. Store returned STS credentials in the session.

The assumed role should include `sts:GetCallerIdentity` if the user expects the dashboard identity indicator to work.

### `POST /api/session-identity/clear/`

Removes `request.session["floci_identity"]` and returns to server default credentials.

## IAM Workbench Changes

The IAM workbench is the main place to drive identity switching:

- On a user detail view, `Use this user` switches the active dashboard identity.
- On a role detail view, `Get temporary credentials` assumes the role and stores STS credentials in the session.
- On user creation flows, the dashboard attaches baseline `sts:GetCallerIdentity`.
- Role creation supports trust templates for Lambda, EC2, account-root testing, or custom JSON.
- Switching identities explains that later dashboard actions may lose permissions.

The workbench should clearly distinguish:

- editing IAM resources as admin
- operating the dashboard as a selected IAM user
- operating the dashboard as an assumed role

## AWS CLI Console Changes

Keep `--profile` blocked. The browser session identity should be the source of truth.

`/api/console/run/` uses session credentials when present:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_SESSION_TOKEN
AWS_ENDPOINT_URL
AWS_DEFAULT_REGION
```

Command results include identity context:

- identity label
- identity type
- caller ARN when available
- expiration for STS sessions

Future improvement: if a user runs `aws sts assume-role` directly in the console, offer a `Use returned credentials` button instead of requiring manual copy/paste.

## Global UI

Add a compact global identity indicator near the existing status/nav area:

```text
Identity: admin
Identity: user/charlie
Identity: assumed-role/CharlieSqsReadRole/floci-session
```

Actions:

- View identity details
- Clear identity
- Go to IAM workbench

Use neutral warning states when the active identity cannot call `sts:GetCallerIdentity`.

## Security And Local-Scope Rules

This is a local development dashboard, but still keep the edges sane:

- Only allow local Floci endpoints.
- Do not allow arbitrary external AWS endpoints.
- Do not persist session credentials outside the Django session store.
- Do not log secret access keys or session tokens.
- Redact access keys in UI except for the first/last few characters.
- Keep destructive action confirmation behavior unchanged.

## Test Plan

Add backend tests for:

- `FlociClientFactory` uses session credentials before environment/profile credentials.
- Session user identity can call `sts:GetCallerIdentity`.
- Session role identity includes `AWS_SESSION_TOKEN`.
- Clearing identity returns to default credential behavior.
- AWS CLI Console environment includes session credentials.
- AWS CLI Console still rejects `--profile`.
- Two Django test clients can hold different active identities at the same time.

Add integration-style tests for:

- admin creates `charlie`
- dashboard switches to `charlie`
- S3 list fails
- admin creates `CharlieSqsReadRole`
- `charlie` assumes role
- SQS list succeeds
- S3 list still fails

Add UI tests for:

- identity indicator renders current identity
- IAM user detail exposes `Use this user`
- IAM role detail exposes `Assume this role`
- console command result shows active identity

## Rollout Plan

1. Done: add session identity model and factory support.
2. Done: add identity API endpoints.
3. Done: wire AWS CLI Console to session identity.
4. Done: add global identity indicator.
5. Done: add IAM workbench buttons.
6. Done: migrate request-sensitive service APIs/actions to request-aware factory creation.
7. Done: add tests for multi-session isolation and IAM action coverage.
8. Done: add IAM enforcement capstone lab.
9. Done: update README, ROADMAP, and lab-building notes.

## Acceptance Criteria

The dashboard should reproduce the shell-proven behavior:

```text
admin -> create charlie -> use charlie -> s3 denied
charlie -> assume CharlieSqsReadRole -> sqs allowed -> s3 denied
```

This must work without restarting Django and without changing shell environment variables.
