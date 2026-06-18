# Building Local AWS Workflow Labs

## Current Curriculum Status

The initial curriculum is complete as of June 18, 2026:

- eight IAM labs,
- twelve S3 labs,
- shared breadcrumb navigation from labs to the service page or dashboard homepage,
- live-state completion for reload-safe progress,
- lab-owned cleanup and reset behavior,
- end-to-end verification against local Floci.

The next service sequence should begin with SQS queue and message lifecycle, then build toward SNS-to-SQS and Scheduler-to-SQS multi-service workflows.

## Direction

Labs are one-click, local AWS workflow lessons.

Each lab teaches a real AWS-shaped workflow while proving that Floci can emulate it locally. The page shows the AWS CLI command a user would normally type, but the user can click a button to run the pre-vetted step immediately.

This removes the slow, error-prone part of learning cloud workflows: typing command after command, fixing quoting mistakes, and wondering whether the failure came from the command, the environment, or the emulator.

The experience should feel like:

1. Read the goal.
2. See the AWS CLI command.
3. Click the command's button.
4. See the real response.
5. See the step verified against local Floci state.
6. Continue one command at a time until the workflow is complete.
7. Reset the lab when done.

The first route is:

```text
/service/iam/labs/
```

The next service route is:

```text
/service/s3/labs/
```

Each service page links to its labs beside the service eyebrow.

## Current Proofs

The first working lab is intentionally tiny:

```bash
aws iam create-user --user-name Alice
```

The page:

- shows the command,
- runs the approved backend action on click,
- displays the response,
- verifies that `Alice` exists in local IAM,
- marks the step complete,
- remembers completion by recomputing state from Floci when the page reloads,
- provides Reset, which runs the matching cleanup operation.

This is the core pattern. Future labs should extend this pattern rather than invent a different interaction.

The second working lab proves the multi-step pattern:

```bash
aws iam create-user --user-name Alice
aws iam create-policy --policy-name AliceListBucketsPolicy --policy-document file://alice-list-buckets-policy.json
aws iam attach-user-policy --user-name Alice --policy-arn arn:aws:iam::000000000000:policy/AliceListBucketsPolicy
aws iam list-attached-user-policies --user-name Alice
```

This lab adds important behavior:

- a Labs sidebar that switches between labs,
- a policy document artifact shown beside the `file://...` command,
- multiple independent completion checks,
- a shared prerequisite step,
- reset that cleans up only the lab-owned policy and attachment,
- a completed state where buttons become green `✓ Done` status indicators.

This is now the reference pattern for new multi-step labs.

The third working lab proves programmatic credential workflows:

```bash
aws iam create-user --user-name Alice
aws iam create-access-key --user-name Alice
aws iam list-access-keys --user-name Alice
```

This lab adds a different IAM teaching point:

- access key creation returns the secret access key in the create response,
- list calls only return key metadata,
- reset can discover live key IDs instead of storing browser state,
- credential cleanup should leave the prerequisite user alone.

This is a good pattern for labs where one step returns an identifier needed later. Prefer discovering that identifier from live Floci state during reset when the API supports it.

The fourth working lab proves group membership workflows:

```bash
aws iam create-user --user-name Alice
aws iam create-group --group-name FlociDevelopers
aws iam add-user-to-group --group-name FlociDevelopers --user-name Alice
aws iam get-group --group-name FlociDevelopers
```

This lab adds another common IAM concept:

- groups collect users for shared permissions,
- membership is verified by reading the group and inspecting its `Users` list,
- reset must remove the user from the group before deleting the group,
- the shared `create-user` step should treat an existing Alice as a verified prerequisite.

This is the reference pattern for relationship-style labs: create the two sides, attach or associate them, then use a read command that proves the relationship exists.

The fifth working lab proves group-based managed permissions:

```bash
aws iam create-user --user-name Alice
aws iam create-group --group-name FlociDevelopers
aws iam add-user-to-group --group-name FlociDevelopers --user-name Alice
aws iam create-policy --policy-name FlociDevelopersListBucketsPolicy --policy-document file://floci-developers-list-buckets-policy.json
aws iam attach-group-policy --group-name FlociDevelopers --policy-arn arn:aws:iam::000000000000:policy/FlociDevelopersListBucketsPolicy
aws iam list-attached-group-policies --group-name FlociDevelopers
```

The sixth working lab proves inline identity policies:

```bash
aws iam create-user --user-name Alice
aws iam put-user-policy --user-name Alice --policy-name AliceInlineListBuckets --policy-document file://alice-inline-list-buckets-policy.json
aws iam list-user-policies --user-name Alice
aws iam get-user-policy --user-name Alice --policy-name AliceInlineListBuckets
```

This lab makes the managed-policy versus inline-policy distinction concrete. The inline policy is embedded in Alice, has no separate policy ARN, and is removed with `delete-user-policy`.

The seventh working lab proves role trust and role permissions as separate policy concerns:

```bash
aws iam create-role --role-name FlociApplicationRole --assume-role-policy-document file://floci-application-role-trust-policy.json
aws iam get-role --role-name FlociApplicationRole
aws iam put-role-policy --role-name FlociApplicationRole --policy-name FlociApplicationListBuckets --policy-document file://floci-application-list-buckets-policy.json
aws iam get-role-policy --role-name FlociApplicationRole --policy-name FlociApplicationListBuckets
```

The eighth working lab proves EC2 instance-profile wiring:

```bash
aws iam create-role --role-name FlociEc2Role --assume-role-policy-document file://floci-ec2-role-trust-policy.json
aws iam create-instance-profile --instance-profile-name FlociEc2InstanceProfile
aws iam add-role-to-instance-profile --instance-profile-name FlociEc2InstanceProfile --role-name FlociEc2Role
aws iam get-instance-profile --instance-profile-name FlociEc2InstanceProfile
aws iam list-instance-profiles-for-role --role-name FlociEc2Role
```

## Product Positioning

Use this language:

> Local AWS workflow labs

The value proposition:

- Learn AWS-shaped workflows quickly.
- See exact CLI commands.
- Run known-good steps with one click.
- Confirm the result in Floci and in the dashboard.
- Build confidence before wiring the workflow into an app or deployment.

Labs are not a browser terminal. They are guided, approved workflows.

## What We Show

Show commands without endpoint flags:

```bash
aws iam create-user --user-name Alice
```

Do not show:

```bash
aws --endpoint-url http://127.0.0.1:4566 iam create-user --user-name Alice
```

The endpoint belongs to the local Floci/dashboard configuration. The lab page should teach the command shape, not distract with environment plumbing.

## Interaction Model

Each lab contains steps.

Each step has:

- title,
- visible CLI command,
- Run button,
- explanation,
- response panel,
- verification result,
- complete state.

Each lab has:

- title,
- description,
- status,
- ordered steps,
- reset action.

The Run button should be one click per CLI command. As labs grow, completing a lab means clicking multiple Run buttons in order.

When a step is verified, its Run button becomes a completion badge:

```text
✓ Done
```

This badge should be green, disabled, and should not change appearance on hover. It should not feel clickable.

If a step has a supporting file-like artifact, show it near the command. For example, a command may show:

```bash
aws iam create-policy --policy-name AliceListBucketsPolicy --policy-document file://alice-list-buckets-policy.json
```

The page should also show `alice-list-buckets-policy.json` as an expandable artifact containing the JSON that the approved backend action will use.

## Status-Aware Labs

Lab state should be derived from live Floci state whenever possible.

Example:

- If `Alice` exists, the IAM create-user step is complete.
- If `Alice` does not exist, the step is not started.
- Reset deletes `Alice`, so the step becomes runnable again.
- If `AliceListBucketsPolicy` exists, the policy creation step is complete.
- If that policy is attached to Alice, both the attach step and the list-attached-policies read step are complete.
- If `FlociDevelopers` exists, the group creation step is complete.
- If `get-group` returns Alice in `Users`, both the add-user-to-group step and get-group read step are complete.
- If `FlociDevelopersListBucketsPolicy` exists, the group policy creation step is complete.
- If `list-attached-group-policies` returns `FlociDevelopersListBucketsPolicy`, both the attach-group-policy step and list-attached-group-policies read step are complete.
- If `get-user-policy` returns `AliceInlineListBuckets`, the put, list, and get inline-policy steps are complete.

This matters because users will move between the lab page and the normal service dashboard. If they create a resource in a lab and then inspect it elsewhere, returning to the lab should reflect reality.

Prefer this order:

1. Verify from live Floci state.
2. Use stored run state only for things that cannot be safely inferred.
3. Use browser state only for display details like expanded panels.

## Execution Model

The browser must not send arbitrary shell text to the server.

The browser sends identifiers:

```json
{
  "service": "iam",
  "lab": "create-user-alice",
  "step": "create-user"
}
```

The backend looks up an approved lab step and runs its implementation.

The command displayed to the user is educational and exact in intent:

```bash
aws iam create-user --user-name Alice
```

The first implementation should continue using boto3-backed actions behind the scenes. This proves the AWS-compatible API behavior through Floci without exposing shell execution.

We can revisit actual AWS CLI subprocess execution later, but it is not needed for the product value right now.

## Response Shape

Step run responses should be consistent:

```json
{
  "service": "iam",
  "lab": "create-user-alice",
  "step": "create-user",
  "command": "aws iam create-user --user-name Alice",
  "exit_code": 0,
  "stdout": "{...}",
  "stderr": "",
  "json": {},
  "duration_ms": 82,
  "verified": true,
  "verification": {
    "status": "passed",
    "message": "User Alice exists in local IAM."
  }
}
```

For multi-step labs, every step should return its own command, response, and verification. The lab page should not assume that one completed step means the whole lab is complete.

Example policy attachment verification:

```json
{
  "service": "iam",
  "lab": "attach-policy-alice",
  "step": "attach-policy",
  "command": "aws iam attach-user-policy --user-name Alice --policy-arn arn:aws:iam::000000000000:policy/AliceListBucketsPolicy",
  "exit_code": 0,
  "stdout": "{}",
  "stderr": "",
  "json": {},
  "duration_ms": 74,
  "verified": true,
  "verification": {
    "status": "passed",
    "message": "Policy AliceListBucketsPolicy is attached to Alice."
  }
}
```

Reset responses should be similarly consistent:

```json
{
  "service": "iam",
  "lab": "create-user-alice",
  "command": "aws iam delete-user --user-name Alice",
  "exit_code": 0,
  "stdout": "{}",
  "stderr": "",
  "json": {},
  "duration_ms": 61,
  "reset": true,
  "deleted": true,
  "verification": {
    "status": "passed",
    "message": "User Alice was removed."
  }
}
```

## Recommended Code Structure

The current `dashboard/labs.py` is fine for the first proof, but it will get messy as labs grow. Before adding many labs, move toward a small framework.

Current state:

```text
dashboard/labs.py
  definitions for the current IAM lab collection
  run_lab_step(...)
  lab_status(...)
  reset_lab(...)
  IAM-specific verification helpers
```

This was the right shape for proving the idea quickly. It should not become a giant file for every service.

Recommended structure:

```text
dashboard/
  labs/
    __init__.py
    registry.py
    runner.py
    types.py
    iam.py
    s3.py
    sqs.py
```

Suggested responsibilities:

```text
types.py
  Dataclasses or typed dictionaries for Lab, LabStep, StepResult, LabStatus.

registry.py
  labs_for_service(service_key)
  get_lab(service_key, lab_key)

runner.py
  run_lab_step(service_key, lab_key, step_key)
  reset_lab(service_key, lab_key)
  common response formatting helpers

iam.py
  IAM lab definitions
  IAM step actions
  IAM verification helpers
  IAM reset helpers
```

Keep service-specific implementation in service files. Keep generic lab routing and response formatting in common files.

## Lab Definition Shape

Use a declarative definition for display, plus explicit Python functions for behavior.

Example:

```python
Lab(
    service="iam",
    key="create-user-alice",
    title="Create an IAM user",
    description="Create a local IAM user named Alice and verify that IAM can read it back.",
    steps=[
        LabStep(
            key="create-user",
            title="Create user Alice",
            command="aws iam create-user --user-name Alice",
            explanation="Creates a local IAM user named Alice through the IAM CreateUser API.",
            run=run_create_user_alice,
            verify=verify_user_alice,
        ),
    ],
    reset=reset_create_user_alice,
)
```

The important split:

- `command` is what the user sees.
- `run` is the approved backend implementation.
- `verify` checks live Floci state.
- `reset` cleans up lab-created resources.

## Adding A New Lab

Each new lab should follow this checklist:

1. Define the lab and step metadata.
2. Implement one run function per step.
3. Implement one verification function per step.
4. Implement reset for all lab-created resources.
5. Make status recomputable from live Floci state.
6. Add page tests for visible commands and complete state.
7. Add runner tests for each step.
8. Add reset tests.
9. Run the step against local Floci and confirm the resource appears in the normal service dashboard.
10. Reset local resources after verification.

No lab should be considered done until the displayed command has been verified against local Floci behavior.

For each command, verify both paths:

- the direct lab endpoint returns `verified: true`,
- the normal service dashboard reflects the resource or state change.

After local verification, reset the lab so the page is ready for a fresh user run.

## Verification Pattern

Every step should answer:

```text
Did the intended resource or state change actually happen?
```

Examples:

- IAM user step: `get_user(UserName="Alice")` returns Alice.
- IAM customer managed policy step: `get_policy(PolicyArn=...)` returns the policy.
- IAM policy attachment step: `list_attached_user_policies` includes the policy ARN.
- IAM access key step: `list_access_keys(UserName="Alice")` returns at least one key.
- S3 bucket step: `head_bucket` succeeds.
- SQS send-message step: `receive_message` returns the expected body.
- Scheduler target step: target queue receives the scheduled message.

Verification should be independent from the original API call succeeding.

## Reset Pattern

Reset should be boring and reliable.

Rules:

- Reset should clean up only known lab resources.
- Reset should tolerate already-missing resources.
- Reset should run cleanup in dependency order.
- Reset should return a visible response.
- Reset should update the page back to a runnable state.

For multi-step labs, reset may need multiple cleanup operations. It can still appear as one Reset button for the lab.

Reset ownership matters:

- The create-user lab owns `Alice`, so its reset deletes `Alice`.
- The attach-policy lab depends on `Alice`, but owns `AliceListBucketsPolicy` and the attachment. Its reset should detach/delete the policy but leave Alice alone.
- The access-key lab depends on `Alice`, but owns Alice access keys in this controlled local workflow. Its reset should delete Alice access keys but leave Alice alone.
- The group membership lab depends on `Alice`, but owns `FlociDevelopers` and Alice's membership in that group. Its reset should remove Alice from the group, delete the group, and leave Alice alone.
- The group policy lab depends on `Alice`, but owns `FlociDevelopers`, `FlociDevelopersListBucketsPolicy`, the group policy attachment, and Alice's membership in that group. Its reset should detach/delete the policy, remove Alice from the group, delete the group, and leave Alice alone.
- The inline policy lab depends on `Alice`, but owns `AliceInlineListBuckets`. Its reset should delete the inline policy and leave Alice alone.
- The role trust lab owns `FlociApplicationRole` and `FlociApplicationListBuckets`. Its reset should delete the inline role policy before deleting the role.
- The instance profile lab owns `FlociEc2Role` and `FlociEc2InstanceProfile`. Its reset should remove the role from the profile, delete the profile, then delete the role.

This rule prevents a later lab from unexpectedly destroying a prerequisite that may have been created by an earlier lab or by the user.

For resources without tags or names, be explicit about ownership. IAM access keys cannot be tagged or named at creation, so the Alice access-key lab treats Alice's local access keys as lab-owned and deletes them during reset. That is acceptable here because this is a fixed local training user; use more isolated names for broader or riskier workflows.

## Naming

Use simple names in early labs when the teaching value is clarity:

```text
Alice
```

Use `floci-lab-*` names when a lab creates multiple resources or resources that are more likely to conflict:

```text
floci-lab-policy-user
floci-lab-readonly-s3
floci-lab-instance-profile
```

For labs with fixed names, status detection must handle resources that already exist.

## Safety

Keep these guardrails:

- Do not execute arbitrary commands from the browser.
- Do not accept free-form shell syntax.
- Do not run pipes, redirects, command separators, or subshells.
- Only run registered service/lab/step combinations.
- Reuse `FlociClientFactory` endpoint validation.
- Refuse non-local endpoints.
- Prefer boto3-backed actions until there is a strong reason to run AWS CLI subprocesses.
- Cleanup only lab-owned resources.

## UI Direction

Labs pages should be focused.

Do not show the standard health/status tile block on labs pages. It distracts from the workflow.

Keep:

- back link to service page,
- service eyebrow,
- lab title,
- lab list,
- command steps,
- response/verification,
- reset.

Future UI improvements:

- step numbers connected by a vertical progress line,
- disabled future steps until prior steps verify,
- compact resource snapshot after each step,
- "View in dashboard" link after verification,
- richer empty/complete states,
- multiple labs in the sidebar.

Current UI lessons:

- Labs pages should not include the standard health/status tiles.
- Lab selection should be link-based so a lab has a direct URL, such as `?lab=attach-policy-alice`.
- Completed steps should look complete, not clickable.
- Showing the supporting policy JSON made the `file://...` command understandable without requiring a real local file.

## First IAM Lab Set

Build IAM labs in this order:

1. Create user Alice
2. Create managed policy and attach it to Alice
3. Create user and access key
4. Create group and add user
5. Attach managed policy to group
6. Create user and attach inline policy
7. Create role with trust policy
8. Create instance profile and add role
9. Simulate policy decision

The first lab proves the core one-step pattern. The second lab proves the multi-step pattern and the core IAM permissions story. The third lab proves credential creation, metadata listing, and live-state cleanup for generated IDs. The fourth lab proves group membership and relationship verification. The fifth lab proves group-based permission assignment. The sixth proves inline user policies. The seventh separates role trust from role permissions. The eighth proves EC2 instance-profile wiring.

Implemented second lab:

```text
Attach a managed policy to Alice
```

Steps:

```bash
aws iam create-user --user-name Alice
aws iam create-policy --policy-name AliceListBucketsPolicy --policy-document file://alice-list-buckets-policy.json
aws iam attach-user-policy --user-name Alice --policy-arn arn:aws:iam::000000000000:policy/AliceListBucketsPolicy
aws iam list-attached-user-policies --user-name Alice
```

Reset:

```bash
aws iam detach-user-policy --user-name Alice --policy-arn arn:aws:iam::000000000000:policy/AliceListBucketsPolicy
aws iam delete-policy --policy-arn arn:aws:iam::000000000000:policy/AliceListBucketsPolicy
```

Implemented third lab:

```text
Create user and access key
```

Steps:

```bash
aws iam create-user --user-name Alice
aws iam create-access-key --user-name Alice
aws iam list-access-keys --user-name Alice
```

Reset:

```bash
aws iam delete-access-key --user-name Alice --access-key-id <created-key-id>
```

This introduces dependency between steps and shows why live-state discovery matters: deleting an access key requires the created access key ID, and reset can discover that ID with `list-access-keys`. This lab's reset removes Alice access keys but leaves Alice in place.

Implemented fourth lab:

```text
Create group and add Alice
```

Steps:

```bash
aws iam create-user --user-name Alice
aws iam create-group --group-name FlociDevelopers
aws iam add-user-to-group --group-name FlociDevelopers --user-name Alice
aws iam get-group --group-name FlociDevelopers
```

Why this should come next:

- groups are a core IAM concept for AWS learning and certification,
- it reuses Alice without making permissions more complex yet,
- it introduces membership state and a new reset dependency order,
- it prepares naturally for a later group policy attachment lab.

Reset should remove Alice from `FlociDevelopers`, then delete `FlociDevelopers`, and leave Alice alone.

Implemented fifth lab:

```text
Attach a policy to a group
```

Steps:

```bash
aws iam create-user --user-name Alice
aws iam create-group --group-name FlociDevelopers
aws iam add-user-to-group --group-name FlociDevelopers --user-name Alice
aws iam create-policy --policy-name FlociDevelopersListBucketsPolicy --policy-document file://floci-developers-list-buckets-policy.json
aws iam attach-group-policy --group-name FlociDevelopers --policy-arn arn:aws:iam::000000000000:policy/FlociDevelopersListBucketsPolicy
aws iam list-attached-group-policies --group-name FlociDevelopers
```

Why this should come next:

- it combines the permissions story from the managed policy lab with the group membership story,
- group-based permissions are a common AWS real-world pattern,
- it prepares learners for least-privilege design without introducing roles yet.

Reset should detach the group policy, delete the policy, remove Alice from the group, delete the group, and leave Alice alone.

Implemented sixth lab:

```text
Attach an inline policy to Alice
```

Steps:

```bash
aws iam create-user --user-name Alice
aws iam put-user-policy --user-name Alice --policy-name AliceInlineListBuckets --policy-document file://alice-inline-list-buckets-policy.json
aws iam list-user-policies --user-name Alice
aws iam get-user-policy --user-name Alice --policy-name AliceInlineListBuckets
```

Why this should come next:

- it teaches the difference between customer managed policies and inline policies,
- inline policy questions show up often in IAM learning and certification prep,
- reset is straightforward: delete the inline policy and leave Alice alone.

Reset should delete `AliceInlineListBuckets` from Alice and leave Alice in place.

Implemented seventh lab:

```text
Create a role with a trust policy
```

Steps:

```bash
aws iam create-role --role-name FlociApplicationRole --assume-role-policy-document file://floci-application-role-trust-policy.json
aws iam get-role --role-name FlociApplicationRole
aws iam put-role-policy --role-name FlociApplicationRole --policy-name FlociApplicationListBuckets --policy-document file://floci-application-list-buckets-policy.json
aws iam get-role-policy --role-name FlociApplicationRole --policy-name FlociApplicationListBuckets
```

This lab teaches the most important role distinction:

- The trust policy answers who or what may assume the role.
- The permissions policy answers what an assumed role may do.

Reset deletes the inline role policy before deleting `FlociApplicationRole`.

Implemented eighth lab:

```text
Create an EC2 instance profile
```

Steps:

```bash
aws iam create-role --role-name FlociEc2Role --assume-role-policy-document file://floci-ec2-role-trust-policy.json
aws iam create-instance-profile --instance-profile-name FlociEc2InstanceProfile
aws iam add-role-to-instance-profile --instance-profile-name FlociEc2InstanceProfile --role-name FlociEc2Role
aws iam get-instance-profile --instance-profile-name FlociEc2InstanceProfile
aws iam list-instance-profiles-for-role --role-name FlociEc2Role
```

This lab teaches that an instance profile is the IAM container EC2 uses to expose a role to an instance. The role and profile use dedicated names so this lab can reset independently from the application-role lab.

Reset removes the role from the profile, deletes the profile, then deletes `FlociEc2Role`.

## IAM Coverage

The IAM lab collection now covers most practical core workflows supported by Floci:

- users,
- programmatic access keys,
- customer managed policies,
- inline user policies,
- groups and membership,
- group-based permissions,
- roles,
- service trust policies,
- inline role permissions,
- EC2 instance profiles,
- live resource verification,
- dependency-aware cleanup.

The primary remaining certification-relevant scenario is policy simulation:

```bash
aws iam simulate-principal-policy --policy-source-arn arn:aws:iam::000000000000:role/FlociApplicationRole --action-names s3:ListAllMyBuckets
```

As of June 17, 2026, local Floci returns:

```text
UnsupportedOperation: Operation SimulatePrincipalPolicy is not supported.
```

`SimulateCustomPolicy` is also unsupported. Do not add a policy-simulation lab until one of these APIs works end to end. When support lands, add one lab that demonstrates both an allowed action and an implicitly denied action.

With that exception, the IAM lab set has covered most everyday IAM use cases that Floci currently supports. Future IAM labs should be driven by newly supported APIs or a clearly valuable certification scenario, not by adding more variations of the same resource operations.

## S3 Lab Progression

S3 should move from the basic storage model into protection, controlled access, and automation. The progression should cover the workflows learners see most often in applications, operations work, and AWS certification material.

Build S3 labs in this order:

1. Create and inspect a bucket.
2. Upload, list, download, and delete an object.
3. Organize keys with prefixes and copy objects.
4. Add object metadata and tags.
5. Enable versioning and recover an earlier version.
6. Generate a presigned URL.
7. Block public access and apply a bucket policy.
8. Enable default bucket encryption.
9. Apply a lifecycle rule.
10. Configure CORS and event notifications.
11. Complete a multipart upload.

This sequence deliberately teaches the S3 data model before its management features:

- Buckets are regional containers with globally shaped names.
- Objects are addressed by keys, and folders are key prefixes rather than real directories.
- Metadata and tags support application behavior, inventory, cost allocation, and lifecycle selection.
- Versioning protects against overwrite and deletion mistakes.
- Presigned URLs grant temporary object access without distributing AWS credentials.
- Public-access blocks and bucket policies teach resource-based access and defense in depth.
- Default encryption teaches data-at-rest controls.
- Lifecycle rules teach cost and retention automation.
- CORS and notifications connect S3 to browser and event-driven architectures.
- Multipart upload teaches the standard large-object workflow.

Before implementing each lab, verify every command against local Floci. The initial capability probe on June 17, 2026 confirmed working support for:

- object upload and download,
- object copy,
- object tagging,
- versioning and object-version listing,
- public-access blocks,
- SSE-S3 default encryption,
- CORS,
- lifecycle configuration,
- presigned URLs,
- multipart upload APIs.

Notification configuration is represented in the dashboard and API. Its eventual lab should verify both saved configuration and actual event delivery to a supported local destination rather than stopping at configuration storage.

## First S3 Lab

Implemented:

```text
Create and inspect an S3 bucket
```

Steps:

```bash
aws s3api create-bucket --bucket floci-lab-basics
aws s3api head-bucket --bucket floci-lab-basics
aws s3api list-buckets
```

This is intentionally a three-command foundation:

- `create-bucket` creates the storage container.
- `head-bucket` proves the bucket exists and is accessible.
- `list-buckets` shows account-level discovery and the bucket creation timestamp.

Live status is derived from `HeadBucket`, so revisiting the lab reflects the real Floci state. Creation is idempotent when the fixed lab bucket already exists.

Reset owns the entire `floci-lab-basics` bucket. It removes ordinary objects, object versions, and delete markers before deleting the bucket. This keeps reset reliable even if a learner uses the normal S3 dashboard to experiment inside the lab bucket.

Implemented second S3 lab:

```text
Upload and retrieve an object
```

Steps:

```bash
aws s3api create-bucket --bucket floci-lab-objects
aws s3api put-object --bucket floci-lab-objects --key hello.txt --body hello.txt --content-type text/plain
aws s3api list-objects-v2 --bucket floci-lab-objects
aws s3api head-object --bucket floci-lab-objects --key hello.txt
aws s3api get-object --bucket floci-lab-objects --key hello.txt downloaded-hello.txt
```

The page shows `hello.txt` as an expandable artifact containing:

```text
Hello from the Floci S3 lab!
```

The backend uploads those exact bytes and verifies:

- bucket accessibility,
- object key,
- downloaded body,
- `text/plain` content type,
- 29-byte content length.

The delete-object command is intentionally not a lab step. If the final learning step deleted the object, a later page load could not distinguish a successfully completed workflow from one that had never started. Reset owns deletion of the object and bucket, preserving live-state completion while still teaching reliable cleanup.

The `get-object` response displays both the destination name `downloaded-hello.txt` and the downloaded text body. This preserves the AWS CLI command shape without writing an arbitrary file on the dashboard server.

Implemented third S3 lab:

```text
Organize and copy objects with key prefixes
```

Steps:

```bash
aws s3api create-bucket --bucket floci-lab-prefixes
aws s3api put-object --bucket floci-lab-prefixes --key incoming/report.txt --body report.txt
aws s3api list-objects-v2 --bucket floci-lab-prefixes --prefix incoming/
aws s3api copy-object --copy-source floci-lab-prefixes/incoming/report.txt --bucket floci-lab-prefixes --key archive/report.txt
aws s3api list-objects-v2 --bucket floci-lab-prefixes --prefix archive/
```

This should teach that S3 has a flat object namespace and that apparent folders are key prefixes. Reset should remove both keys and the bucket.

The page shows `report.txt` as an expandable artifact. The backend uploads its exact 46 bytes to `incoming/report.txt`, then uses `CopyObject` to create `archive/report.txt`.

Live status is intentionally split:

- the upload and incoming-prefix list steps complete when `incoming/report.txt` contains the expected artifact,
- the copy and archive-prefix list steps complete only when `archive/report.txt` contains the same expected artifact.

The verified objects have the same ETag and size, demonstrating that copy creates another object key while preserving the source. S3 does not create real `incoming` or `archive` directories; the slash-separated names are keys that the console presents hierarchically.

Implemented fourth S3 lab:

```text
Add object metadata and tags
```

Steps:

```bash
aws s3api create-bucket --bucket floci-lab-metadata
aws s3api put-object --bucket floci-lab-metadata --key documents/invoice.txt --body invoice.txt --content-type text/plain --metadata project=floci,classification=internal
aws s3api head-object --bucket floci-lab-metadata --key documents/invoice.txt
aws s3api put-object-tagging --bucket floci-lab-metadata --key documents/invoice.txt --tagging file://invoice-tags.json
aws s3api get-object-tagging --bucket floci-lab-metadata --key documents/invoice.txt
```

This should teach the difference between HTTP/system metadata, user-defined object metadata, and object tags. Tags should use practical keys such as `Environment=lab` and `CostCenter=training`.

The uploaded object is `documents/invoice.txt`, with:

- exact 34-byte invoice contents,
- `Content-Type: text/plain`,
- user metadata `project=floci`,
- user metadata `classification=internal`,
- tag `Environment=lab`,
- tag `CostCenter=training`.

Live status is layered:

- upload and `head-object` complete only when the body, content type, size, and user metadata match,
- tagging steps complete only when the full expected tag set is present.

Tag order is ignored during verification because S3 tag responses should be treated as a set of key/value pairs.

The normal S3 object drawer now shows user metadata alongside system metadata and its existing editable tags view. This makes the distinction visible outside the lab:

- system metadata describes how S3 stores and serves the object,
- user metadata travels with the object and is set during write/copy operations,
- tags are a separate mutable classification layer used by lifecycle, cost allocation, and automation.

Implemented fifth S3 lab:

```text
Enable versioning and recover an earlier object version
```

Steps:

```bash
aws s3api create-bucket --bucket floci-lab-versioning
aws s3api put-bucket-versioning --bucket floci-lab-versioning --versioning-configuration Status=Enabled
aws s3api put-object --bucket floci-lab-versioning --key configuration.txt --body configuration-v1.txt
aws s3api put-object --bucket floci-lab-versioning --key configuration.txt --body configuration-v2.txt
aws s3api list-object-versions --bucket floci-lab-versioning --prefix configuration.txt
aws s3api get-object --bucket floci-lab-versioning --key configuration.txt --version-id <v1-version-id> recovered-configuration.txt
```

The backend should discover version IDs from live Floci state rather than persisting them in browser state. Verification should prove that the latest version contains v2 while retrieving the older version returns v1.

The lab uses two explicit artifacts:

```text
configuration-v1.txt
feature_enabled=false
release=v1
```

```text
configuration-v2.txt
feature_enabled=true
release=v2
```

Floci assigns opaque version IDs. The lab never assumes list order or stores those IDs in browser state. It lists the live versions, downloads each candidate by version ID, and identifies v1 and v2 by their exact bodies.

Completion requires:

- bucket versioning status `Enabled`,
- a preserved version containing v1,
- a latest version containing v2,
- successful retrieval of the discovered v1 version.

The normal S3 dashboard exposes the same state through its versioned-bucket count and `Show versions` table. Reset deletes every version and delete marker before deleting the bucket.

Implemented sixth S3 lab:

```text
Generate temporary access with a presigned URL
```

Steps:

```bash
aws s3api create-bucket --bucket floci-lab-presigned
aws s3api put-object --bucket floci-lab-presigned --key shared/guide.txt --body guide.txt --content-type text/plain
aws s3 presign s3://floci-lab-presigned/shared/guide.txt --expires-in 300
```

The lab should verify the object first, generate a five-minute URL, and perform an HTTP GET against that URL to prove the temporary access actually returns the expected bytes. Explain that presigned URLs use the signer identity's permissions and should be treated as bearer credentials until expiration.

The final step does more than return a URL:

1. Generate a URL with `ExpiresIn=300`.
2. Perform an ordinary HTTP GET against the signed URL.
3. Send no AWS Authorization header or credentials with that GET.
4. Verify the response is the exact 43-byte `guide.txt` artifact.

The step response shows the URL, five-minute expiry, and downloaded body. Live completion regenerates and redeems a fresh URL from the current object state, so returning to the page proves the workflow still works rather than trusting an expired browser value.

Security lessons:

- A presigned URL grants only the operation it was signed for.
- Its effective permissions come from the signing identity.
- The URL acts as a bearer credential until it expires.
- URLs should not be logged, committed, or shared more broadly than intended.
- Short expirations reduce exposure but do not revoke a URL immediately.

Implemented seventh S3 lab:

```text
Block public access and apply a bucket policy
```

Steps:

```bash
aws s3api create-bucket --bucket floci-lab-security
aws s3api put-public-access-block --bucket floci-lab-security --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api get-public-access-block --bucket floci-lab-security
aws s3api put-bucket-policy --bucket floci-lab-security --policy file://bucket-policy.json
aws s3api get-bucket-policy --bucket floci-lab-security
```

Use a non-public least-privilege policy, such as allowing the local account root to list the bucket. The lab should explain that public-access blocking and bucket policies are separate defense layers and that enabling `BlockPublicPolicy` intentionally rejects public policies.

The lab enables all four safeguards:

- `BlockPublicAcls`,
- `IgnorePublicAcls`,
- `BlockPublicPolicy`,
- `RestrictPublicBuckets`.

Its policy grants only `s3:ListBucket` on `arn:aws:s3:::floci-lab-security` to `arn:aws:iam::000000000000:root`. The policy contains no wildcard principal and grants no object actions.

Live verification treats the two security layers independently:

- the block steps require the exact four-boolean configuration,
- the policy steps require the exact principal, action, effect, and resource.

The normal S3 Permissions tab displays both JSON configurations.

Floci capability boundary as of June 18, 2026:

- Floci stores and returns the bucket policy.
- Floci stores and returns Public Access Block configuration.
- The dashboard reports that bucket policies are not currently enforced on object access.

Therefore, this lab proves configuration workflows and teaches the AWS policy model, but it must not claim to prove an authorization denial. Add allow/deny access tests only when Floci begins enforcing S3 bucket policies.

Reset removes the policy and Public Access Block configuration before deleting the bucket.

Implemented eighth S3 lab:

```text
Enable default bucket encryption
```

Steps:

```bash
aws s3api create-bucket --bucket floci-lab-encryption
aws s3api put-bucket-encryption --bucket floci-lab-encryption --server-side-encryption-configuration file://encryption.json
aws s3api get-bucket-encryption --bucket floci-lab-encryption
aws s3api put-object --bucket floci-lab-encryption --key protected/record.txt --body record.txt
aws s3api head-object --bucket floci-lab-encryption --key protected/record.txt
```

Start with SSE-S3 using `AES256`. Verify both the bucket default-encryption configuration and the uploaded object's server-side-encryption response metadata.

The lab configures:

```json
{
  "Rules": [
    {
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      },
      "BucketKeyEnabled": false
    }
  ]
}
```

Live completion requires:

- the exact bucket default-encryption configuration,
- the exact 44-byte `protected/record.txt` artifact,
- `text/plain` content metadata,
- the encryption default to remain enabled when the object is inspected.

The normal S3 Properties tab displays the AES256 configuration.

Floci capability boundary as of June 18, 2026:

- Floci stores and returns the bucket encryption configuration.
- Objects can be written and read after the default is enabled.
- `PutObject` and `HeadObject` do not currently return a `ServerSideEncryption` field for objects protected by the bucket default.

Therefore, the lab proves the configuration workflow and object creation after activation, but does not claim per-object encryption-header verification.

Reset deletes the bucket encryption configuration, object, and bucket.

Implemented ninth S3 lab:

```text
Automate retention with an S3 lifecycle rule
```

Steps:

```bash
aws s3api create-bucket --bucket floci-lab-lifecycle
aws s3api put-object --bucket floci-lab-lifecycle --key logs/app.log --body app.log --content-type text/plain
aws s3api put-bucket-lifecycle-configuration --bucket floci-lab-lifecycle --lifecycle-configuration file://lifecycle.json
aws s3api get-bucket-lifecycle-configuration --bucket floci-lab-lifecycle
```

Use an enabled rule scoped to the `logs/` prefix that expires objects after 30 days. Explain that lifecycle actions are asynchronous in AWS and the lab verifies configuration, not the passage of 30 days.

The lifecycle artifact is:

```json
{
  "Rules": [
    {
      "ID": "ExpireApplicationLogsAfter30Days",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "logs/"
      },
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
```

Live completion requires:

- the lifecycle bucket to exist,
- the exact `logs/app.log` artifact with `text/plain` metadata,
- the named rule to remain enabled,
- the rule to target `logs/`,
- expiration to remain set to 30 days.

Reset removes the lifecycle configuration before deleting the object and bucket.

Implemented tenth S3 lab:

```text
Configure bucket CORS
```

Steps:

```bash
aws s3api create-bucket --bucket floci-lab-cors
aws s3api put-bucket-cors --bucket floci-lab-cors --cors-configuration file://cors.json
aws s3api get-bucket-cors --bucket floci-lab-cors
```

The rule allows only `GET` and `HEAD` from `http://localhost:3000`, permits the `Authorization` request header, exposes `ETag`, and caches browser preflight results for 3600 seconds. It deliberately avoids a wildcard origin.

Live completion requires the bucket and exact named CORS rule to remain present. Reset deletes the CORS configuration before deleting the bucket.

Implemented eleventh S3 lab:

```text
Send S3 object-created events to SQS
```

Steps:

```bash
aws sqs create-queue --queue-name floci-lab-s3-events
aws sqs set-queue-attributes --queue-url <queue-url> --attributes file://queue-attributes.json
aws s3api create-bucket --bucket floci-lab-notifications
aws s3api put-bucket-notification-configuration --bucket floci-lab-notifications --notification-configuration file://notification.json
aws s3api get-bucket-notification-configuration --bucket floci-lab-notifications
aws s3api put-object --bucket floci-lab-notifications --key uploads/report.txt --body report.txt --content-type text/plain
aws sqs receive-message --queue-url <queue-url> --max-number-of-messages 10 --visibility-timeout 0 --wait-time-seconds 1
```

The queue policy grants `sqs:SendMessage` only to the S3 service, constrained to `arn:aws:s3:::floci-lab-notifications` and local account `000000000000`. The bucket notification selects `s3:ObjectCreated:*` and targets the dedicated queue ARN.

Live completion requires:

- the queue and expected ARN,
- the exact S3 delivery queue policy,
- the source bucket,
- the saved object-created notification configuration,
- the exact `uploads/report.txt` artifact,
- an actual SQS message containing an `aws:s3` `ObjectCreated:*` record for that bucket and key.

The receive step uses a zero-second visibility timeout so the event remains available for live-state recomputation after page reloads.

Reset removes the notification configuration first, then deletes bucket contents and the bucket, and finally deletes the queue.

Implemented twelfth S3 lab:

```text
Complete a multipart upload
```

Steps:

```bash
aws s3api create-bucket --bucket floci-lab-multipart
aws s3api create-multipart-upload --bucket floci-lab-multipart --key archives/application.bin --content-type application/octet-stream
aws s3api upload-part --bucket floci-lab-multipart --key archives/application.bin --part-number 1 --upload-id <upload-id> --body part-one.bin
aws s3api upload-part --bucket floci-lab-multipart --key archives/application.bin --part-number 2 --upload-id <upload-id> --body part-two.bin
aws s3api list-parts --bucket floci-lab-multipart --key archives/application.bin --upload-id <upload-id>
aws s3api complete-multipart-upload --bucket floci-lab-multipart --key archives/application.bin --upload-id <upload-id> --multipart-upload file://parts.json
aws s3api get-object --bucket floci-lab-multipart --key archives/application.bin downloaded-application.bin
```

The first part is exactly 5 MiB because AWS requires every non-final multipart part to be at least that large. The final part is 1 KiB. The approved backend action discovers the active upload ID and current part ETags from S3 rather than storing generated identifiers in browser state.

Live completion before assembly tracks the active upload and its part sizes and ETags. After completion, the upload ID no longer exists, so completion is recomputed from the final 5,243,904-byte object, its `application/octet-stream` content type, and exact concatenated bytes.

Reset aborts any still-active lab uploads before removing completed object data and deleting the bucket.

This completes the initial S3 lab progression. The next service lab set should begin with:

```text
SQS queue and message lifecycle
```

## Future Services

Good next services:

- SQS: create queue, send message, receive message, delete message, purge/delete queue.
- SNS: create topic, subscribe SQS queue, publish, inspect SQS delivery.
- KMS: create key, create alias, encrypt, decrypt, disable/enable key, cleanup.
- CloudFormation: create stack that provisions S3/SQS/IAM, inspect stack resources, delete stack.
- EventBridge Scheduler: schedule a message to SQS, wait, inspect queue, cleanup.
- RDS: create local DB instance, inspect endpoint, connect instructions, cleanup.
- DocumentDB: create cluster/instance, inspect endpoint, cleanup.

The first strong multi-service lab should be:

```text
Scheduler -> SQS
```

It proves local scheduling, AWS SDK target wiring, SQS delivery, and dashboard inspection in one workflow.

## Tests Required For Each Lab

Minimum:

- labs page renders the lab title and commands,
- service page links to labs when labs exist,
- status marks completed steps from live-state verification,
- run endpoint calls the registered step,
- step runner calls expected boto3 operation,
- step runner verifies expected state,
- reset endpoint calls registered reset,
- reset tolerates missing resources,
- static JavaScript syntax passes.

Manual/local verification:

- Run each command against local Floci through the lab endpoint.
- Confirm the normal service dashboard shows the created resource.
- Reset and confirm the dashboard no longer shows the resource.

## Implementation Phases

Phase 1: First IAM proof

- `/service/iam/labs/`
- IAM service-page Labs link
- Create user Alice
- live-state completion
- reset

Phase 2: Lab framework

- Split `dashboard/labs.py` into a small package.
- Introduce typed lab definitions.
- Centralize step result formatting.
- Centralize status/reset routing.
- Keep the existing route/template API stable while moving internals.

Phase 3: Multi-step IAM labs

- Create user and attach policy.
- Create user and access key.
- Create group and add user.
- Attach policy to group.
- Attach inline policy to user.
- Create role with trust and permissions policies.
- Create role and instance profile.
- Enforce or clearly guide step order.
- Policy simulation remains blocked by Floci `UnsupportedOperation`.

Phase 4: S3 and SQS

- Add the next two services with simple, high-value workflows.
- Generalize "View in dashboard" links after verification.

Phase 5: Multi-service workflows

- SNS -> SQS
- Scheduler -> SQS
- CloudFormation provisioning labs

## Open Questions

- Should future steps be disabled until prior steps verify, or should users be allowed to run ahead?
- Should reset always clean all lab resources, or should it show a checklist of what it will delete?
- Should labs support user-customized names, or remain fixed for repeatability?
- Should the page store last responses in browser state so reloads can show prior output?
- When a resource pre-exists, should Reset delete it or treat it as external?
- When do we need actual AWS CLI subprocess execution, if ever?

## Recommendation

Keep the product simple and opinionated:

- one visible CLI command,
- one click to run it,
- one response,
- one verification,
- one reset path.

Scale by adding more curated steps, not by adding a generic terminal.
