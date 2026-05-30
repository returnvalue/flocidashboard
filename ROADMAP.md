# Floci Dashboard Roadmap

This roadmap is a living idea collector and planning aid, not a set-in-stone promise. Items may be added, removed, reordered, or reshaped as the dashboard, Floci, and contributor needs evolve.

The goal is to keep this public and useful: it should show the direction of the project, capture good ideas before they disappear, and help contributors choose work that fits the current architecture. The near-term sections should stay realistic for this Django + boto3 dashboard talking to a local Floci endpoint.

## Product Direction

Floci Dashboard should become a focused local cloud workbench. It should help developers answer a few practical questions faster than the AWS CLI alone:

1. What did my app create?
2. What can I inspect or test right now?
3. Why did my local AWS workflow fail?

The dashboard should not clone the full AWS Console. The best version is a compact developer UI for inspecting, testing, resetting, and learning local AWS workflows.

## Current Architecture Direction

Recent service workbenches established the shared pattern for future service pages:

- Service pages are layered workbenches, not replacements for inventory pages.
- Read-only inventory remains the base layer.
- Interactive tools are added above the existing inventory.
- Summary cards should continue to link into read-only sections where possible.
- Success and error feedback for UI actions should use shared lower-right toasts.
- Service-specific files should stay focused on service-specific behavior.

Core architecture files:

- `dashboard/services.py`: canonical service registry, maturity labels, optional assets, and action metadata.
- `dashboard/actions.py`: shared action metadata, JSON parsing, and normalized action errors.
- `dashboard/templates/dashboard/service.html`: common service page shell.
- `dashboard/static/dashboard/service-console.js`: shared frontend helpers for API calls, summary cards, read-only cards, toolbars, modals, formatting, and lower-right toasts.
- Service-specific modules such as `s3_api.py`, `s3_views.py`, `s3-console.js`, and `s3-console.css`, `iam_api.py`, `iam_views.py`, `iam-console.js`, and `iam-console.css`, `ec2_api.py`, `ec2_views.py`, `ec2-console.js`, and `ec2-console.css`, `stepfunctions_api.py`, `stepfunctions_views.py`, `stepfunctions-console.js`, and `stepfunctions-console.css`, `eventbridge_api.py`, `eventbridge_views.py`, `eventbridge-console.js`, and `eventbridge-console.css`, or the equivalent files for SQS, SNS, Lambda, DynamoDB, CloudWatch Logs, API Gateway, Kinesis, Secrets Manager, SSM Parameter Store, CloudFormation, Cognito, RDS, Auto Scaling, ELB v2, CloudFront, and Route 53.

## Guiding Principles

- Prefer useful local workflows over raw inventory alone.
- Keep interactive workbenches additive.
- Keep backend behavior close to boto3 and Floci's public AWS-compatible APIs.
- Add shared architecture only after the need is visible in at least one real service page.
- Make errors clear and actionable.
- Use destructive confirmations for delete, purge, reset, empty, and cleanup actions.
- Keep public roadmap items feasible enough for contributors to pick up.
- Keep tutorial-style notes close to the UI where they help users understand what to test.

## Completed Recently

- Merged the S3 object browser contribution and preserved the original read-only S3 inventory underneath it.
- Restored S3 summary cards, anchor-link behavior, and read-only cards after adding the new interactive browser.
- Added shared `service-console.js` primitives for summary cards, detail cards, modals, toolbars, API calls, formatting, and toasts.
- Added lower-right toast messaging for interactive action feedback.
- Added `dashboard/services.py` as the service registry.
- Added `/api/services/` to expose service metadata.
- Added `dashboard/actions.py` for shared action metadata and JSON/error helpers.
- Registered S3 action metadata.
- Built the SQS Queue Workbench with create, delete, purge, send, receive, and delete-message actions.
- Registered SQS as an interactive workbench.
- Built the SNS Publish Workbench with topic/subscription browsing and publish-message actions.
- Registered SNS as an interactive message workbench.
- Built the Lambda Invoke Workbench with function selection, JSON payload invocation, response payloads, error details, log tails, and CloudWatch log group hints.
- Registered Lambda as an interactive workbench.
- Built the DynamoDB Table Explorer with table selection, schema/index details, bounded scans, item JSON detail, and read-only PartiQL SELECT.
- Registered DynamoDB as an interactive workbench.
- Built the CloudWatch Logs Viewer with log group selection, stream browsing, recent event polling, auto-refresh, and Lambda log group deep links.
- Registered CloudWatch as an interactive workbench.
- Built the Step Functions Execution Workbench with state machine selection, JSON execution starts, execution details, recent history timelines, and stop-running-execution actions.
- Registered Step Functions as an interactive workflow workbench.
- Built the IAM Identity Workbench with principal exploration, policy document viewing, statement summaries, access key management, assume-role testing, managed policy attachment, inline policy editing, and managed policy creation.
- Registered IAM as an interactive identity workbench.
- Built the EventBridge Event Sender with event bus selection, rule and target context, JSON event detail submission, PutEvents result rendering, and EventBridge tutorial notes.
- Registered EventBridge as an interactive event workbench.
- Built the EC2 Instance Workbench with instance selection, launch and key import modals, start/stop/reboot/terminate actions, CLI snippets, IMDS hints, richer instance inventory, and EC2 tutorial notes.
- Registered EC2 as an interactive compute workbench.
- Built the API Gateway Request Workbench with REST/HTTP API selection, stage and route hints, local request execution, and response rendering.
- Registered API Gateway as an interactive request workbench.
- Built the Kinesis Stream Workbench with stream creation, stream and shard selection, PutRecord testing, GetRecords reads, and decoded record rendering.
- Registered Kinesis as an interactive stream workbench.
- Built the Secrets Manager Workbench with secret creation, explicit value reveal, value updates, scheduled deletion, and masked read-only inventory underneath.
- Registered Secrets Manager as an interactive secret workbench.
- Built the SSM Parameter Store Workbench with parameter creation, explicit value reveal, value updates, delete confirmations, and broad SSM read-only inventory underneath.
- Registered SSM as an interactive parameter workbench.
- Built the CloudFormation Stack Workbench with template validation, stack create/update/delete actions, event and resource inspection, change set helpers, and CloudFormation tutorial notes.
- Registered CloudFormation as an interactive stack workbench.
- Built the Cognito Auth Workbench with user pool, app client, resource server, user, group, password, user auth, and OAuth token helpers.
- Registered Cognito as an interactive auth workbench.
- Built the RDS Database Workbench with DB instance creation, modification, reboot, deletion, cluster creation, parameter group creation, connection snippets, engine notes, and proxy configuration context.
- Registered RDS as an interactive database workbench.
- Built the Auto Scaling Capacity Workbench with launch configuration creation, group creation/update/delete, desired-capacity scaling, instance attach/detach/termination, target group attachment, lifecycle hooks, policy helpers, and activity inspection.
- Registered Auto Scaling as an interactive capacity workbench.
- Built the ELB v2 Load Balancing Workbench with load balancer and target group creation, target registration, listener and rule helpers, target health inspection, tag updates, and Phase 1 behavior notes.
- Registered ELB v2 as an interactive load-balancing workbench.
- Built the CloudFront Management Workbench with distribution creation and updates, invalidation helpers, cache policy and OAI creation, function creation and publishing, tagging, and management-plane behavior notes.
- Registered CloudFront as an interactive CDN workbench.
- Built the Route 53 DNS Workbench with hosted zone creation and deletion, record-set change helpers, health check creation and updates, tagging, and management-plane behavior notes.
- Registered Route 53 as an interactive DNS workbench.
- Built the KMS Key Workbench with key and alias creation, encrypt/decrypt helpers, data key generation, rotation toggles, deletion scheduling, and KMS behavior notes.
- Registered KMS as an interactive key workbench.
- Built the EventBridge Scheduler Workbench with schedule group creation, schedule create/update/delete helpers, state toggles, target JSON editing, and scheduler invocation notes.
- Registered EventBridge Scheduler as an interactive schedule workbench.
- Built the EventBridge Pipes Workbench with pipe creation, source/target and parameter editing, start/stop actions, deletion, tagging endpoints, and pipe routing notes.
- Registered EventBridge Pipes as an interactive pipe workbench.
- Built the AWS Config Workbench with config rule, recorder, delivery channel, conformance pack, evaluation, recorder start/stop, delete, and tagging helpers.
- Registered AWS Config as an interactive compliance workbench.
- Added a home-page service selector that defaults to the top 12 common AWS services, persists user selections, labels cards as Interactive or Read Only, and limits `/api/resources/` calls to selected services for faster loads.
- Replaced the dashboard README screenshot image.
- Added tutorial-style "About Floci S3", "About Floci IAM", "About Floci EC2", "About Floci SQS", "About Floci SNS", "About Floci Lambda", "About Floci DynamoDB", "About Floci CloudWatch Logs", "About Floci Step Functions", "About Floci EventBridge", "About Floci API Gateway", "About Floci Kinesis", "About Floci Secrets Manager", "About Floci SSM Parameter Store", "About Floci CloudFormation", "About Floci Cognito", "About Floci RDS", "About Floci Auto Scaling", "About Floci ELB v2", "About Floci CloudFront", and "About Floci Route 53" notes.
- Added contributor architecture notes and an AI-assisted contributor prompt to `README.md`.
- Added Floci 1.5.18 inventory coverage and homepage cards for CloudFront and AWS Config, then promoted CloudFront to an interactive management workbench.
- Refreshed release-aware notes for Neptune Gremlin backend support, SNS HTTP/HTTPS delivery, SQS message move tasks and FIFO dedup scoping, Lambda port-pool behavior, API Gateway v2 ALB routing, KMS MAC operations, ElastiCache Memcached clusters, and ECS-to-ELBv2 target registration.
- Reviewed Floci 1.5.19 and refreshed Lambda layer, CloudFormation SQS queue, SNS-to-SQS subscription, and Cognito parity, API Gateway authorizer, ELBv2 action-family, S3 request-payment, SNS batch/binary-attribute, SQS queue-url, Cognito token-claim, and ECR Public Gallery dashboard notes.
- Made homepage service cards use registry page paths when available and dedupe repeated card description text from service aliases.

## Near-Term Priorities

These are the most likely next steps because they build directly on the current codebase.

### 1. Service Matrix

Create a public coverage page powered by `dashboard/services.py`.

Feasible first version:

- List service name, category, page URL, API URL, maturity, shared console usage, and available actions.
- Show which services are inventory-only vs interactive workbenches.
- Link each row to the service page.
- Keep the data manually maintained in the registry for now.

Why it matters:

- Contributors get a clear map of what exists.
- Users can see dashboard coverage without clicking every service.
- The service registry becomes visibly useful.

### 2. Home Page Filtering Follow-Through

Improve the new service selector and filtered resource loading.

Feasible first version:

- Add a compact search field inside the selector if the service list becomes hard to scan.
- Consider a short-lived cache for `/api/services/`, since registry metadata changes only with app code.
- Add focused tests for selected-service query parsing and resource-loader filtering as the loader map grows.
- Keep the Refresh button as the user's explicit cache-bypass and recheck action.

Why it matters:

- The dashboard now avoids probing every supported service on first load.
- Users can tune the home page to the services they are actively testing.

### 3. Service Page Consistency Pass

Make the generic service pages feel more consistent without rebuilding every service.

Feasible first version:

- Ensure summary cards render `0` instead of `-` or blank for empty numeric values.
- Keep anchor targets stable for read-only panels.
- Add better empty states for inventory-only services.
- Standardize supported-operation and configuration panels where the data shape is simple.
- Avoid large rewrites of `dashboard.js` until repeated patterns are clear.

Why it matters:

- The S3/SQS workbench pages now feel more polished than older pages.
- A consistency pass improves the whole app without needing a new workbench.

### 4. Shared Console Shell Hardening

Improve shared frontend helpers based on what the current interactive workbenches now share.

Feasible first version:

- Move repeated toolbar, modal, empty-state, and destructive-confirmation patterns into `service-console.js`.
- Add small helper APIs for rendering action buttons from registry metadata.
- Keep service-specific renderers where workflows differ.
- Add JS syntax checks for every service console file.

Why it matters:

- The next workbench should require less custom code than the early service-specific consoles.
- Contributor changes become easier to review.

### 5. Action API Follow-Through

Make interactive endpoint behavior more consistent.

Feasible first version:

- Keep using `dashboard/actions.py` for JSON parsing and error responses.
- Add operation names to action errors.
- Add tests for every interactive action endpoint.
- Gradually move common validation patterns into small service-specific helpers.
- Avoid an over-generalized dispatcher until the repeated IAM, Step Functions, S3, SQS, SNS, Lambda, DynamoDB, and CloudWatch patterns prove the shape.

Why it matters:

- Tutorial mode and future workbenches can rely on predictable action behavior.
- Users get consistent error toasts and response shapes.

### 6. Environment Details Page

Expand the current status strip into a simple environment page.

Feasible first version:

- Show endpoint, region, profile, identity, Floci version, and edition.
- Show friendly warnings when Floci is unavailable or the endpoint is not local.
- Keep using `/api/health/` and `/api/identity/`.
- Add fields only when the current Floci response already exposes them.

Why it matters:

- Many local debugging problems start with endpoint or credential confusion.
- This is practical and low-risk.

### 7. IAM Follow-Ups

Keep improving the new IAM workbench.

Feasible follow-ups:

- Add safer managed policy version management.
- Add group membership editing for users and groups.
- Add role trust policy editing with clear destructive confirmations.
- Add optional principal search/filtering inside the IAM workbench.
- Add better affordances for copying access key and assumed-role credential exports after refresh.

Why it matters:

- IAM is central to local AWS debugging.
- The current workbench is already useful, and a few focused additions would make it a stronger identity debugger.

### 8. Step Functions Follow-Ups

Keep improving the new Step Functions execution workbench.

Feasible follow-ups:

- Add ASL definition graph rendering.
- Improve execution-history filtering and grouping.
- Add task-token callback helpers for waitForTaskToken workflows.
- Add cross-service links from state machine Lambda tasks where the resource ARN is easy to identify.

Why it matters:

- Step Functions is a natural workflow debugger for local Lambda and service-integration testing.

### 9. S3 Follow-Ups

Keep improving the existing S3 workbench.

Feasible follow-ups:

- Improve object pagination behavior.
- Improve empty/delete handling for versioned buckets.
- Replace any remaining unsafe HTML rendering.
- Add clearer empty states for buckets, prefixes, and object details.
- Add cross-service links where S3 notifications reference SQS, SNS, or Lambda resources.

Why it matters:

- S3 is the reference workbench and likely a high-traffic page.

### 10. EC2 Follow-Ups

Keep improving the new EC2 instance workbench.

Feasible follow-ups:

- Surface Docker container identifiers, SSH host ports, and UserData output when Floci exposes them.
- Add security group ingress and egress editing with explicit revoke confirmations.
- Add Elastic IP allocate, associate, disassociate, and release actions.
- Add VPC and subnet creation flows for local networking tests.
- Add IAM instance profile selection from IAM inventory where the relationship is easy to infer.

Why it matters:

- EC2 is now a real local compute workflow in Floci.
- Launch, lifecycle, key import, IMDS, and networking hints make the dashboard a better local debugger than raw inventory alone.

### 11. EventBridge Follow-Ups

Keep improving the new EventBridge event sender.

Feasible follow-ups:

- Add rule enable and disable actions.
- Add simple rule creation for event pattern tests.
- Add target summaries that deep-link to Lambda, SQS, SNS, or Step Functions pages where ARNs are recognizable.
- Add recent sent-event history in browser state for quick replay.
- Add event pattern helper presets for common local app events.

Why it matters:

- EventBridge sits between many existing interactive workbenches.
- Better cross-service links would turn it into a practical event-routing debugger.

### 12. API Gateway Follow-Ups

Keep improving the new API Gateway request workbench.

Feasible follow-ups:

- Add route/resource filtering and clearer integration summaries inside the workbench.
- Add request history in browser state for quick replay.
- Add deep links to Lambda and CloudWatch Logs when integrations or log groups are recognizable.
- Add helper presets for common JSON, query string, and header test cases.

Why it matters:

- API Gateway is now the local HTTP front door for Lambda and HTTP proxy workflows.
- Replay and cross-service links would make it a stronger request debugger.

### 13. Kinesis Follow-Ups

Keep improving the new Kinesis stream workbench.

Feasible follow-ups:

- Add stream deletion with explicit destructive confirmation.
- Add enhanced monitoring toggles where Floci supports them.
- Add stream consumer registration and deregistration.
- Add simple record replay from recently read records.
- Add links from EventBridge Pipes or Lambda event source mappings when a stream ARN is recognizable.

Why it matters:

- Kinesis now completes the event/data-stream testing loop alongside SQS, SNS, EventBridge, Lambda, and CloudWatch.

### 14. Secrets Manager And SSM Follow-Ups

Keep improving local configuration and secret debugging.

Feasible follow-ups:

- Add Secrets Manager resource policy editing and tag editing.
- Add secret restore/cancel-delete flows if Floci exposes them.
- Add SSM parameter path browsing and parameter history.
- Add bulk parameter reads by path.
- Improve SecureString/KMS edge-case messaging.

Why it matters:

- Local apps commonly fail because configuration or credentials are missing, malformed, stale, or read from the wrong path.

## Later, But Still Plausible

These are useful, but should wait until the shared service architecture has one or two more workbenches behind it.

### ECR Repository Viewer

Feasible first version:

- Repository list.
- Image tags, digests, and pushed times.
- Copy local Docker pull/tag/push commands.

## Parking Lot

These ideas are still interesting, but they likely need more design, Floci support, or a larger implementation window before they belong in the active roadmap.

- Resource graph across services.
- Request trace explorer.
- Docker runtime lens.
- Full state export/import/reset manager.
- Scenario launcher.
- Tutorial mode with runnable steps.
- Large file transfer UI.
- Deep CloudFormation stack graph.
- Broad IAM policy simulation.
- Multi-user auth.

## Suggested Build Order

This order is intentionally modest and can change:

1. Service Matrix.
2. Home page filtering follow-through.
3. Service Page Consistency Pass.
4. Shared Console Shell hardening.
5. Action API follow-through.
6. Environment Details page.
7. IAM follow-ups.
8. Step Functions follow-ups.
9. S3 follow-ups.
10. EC2 follow-ups.
11. EventBridge follow-ups.
12. API Gateway follow-ups.
13. Kinesis follow-ups.
14. Secrets Manager and SSM follow-ups.
15. ECR Repository Viewer.

## Contributor Checklist

When adding or improving a service page:

- [ ] Preserve the existing read-only inventory.
- [ ] Register service metadata in `dashboard/services.py`.
- [ ] Register action metadata for interactive actions.
- [ ] Use `dashboard/actions.py` for JSON parsing and normalized errors.
- [ ] Use shared lower-right toasts through `ServiceConsole.toast()`.
- [ ] Keep service-specific JS focused on service behavior.
- [ ] Add destructive confirmations for risky actions.
- [ ] Add tests for registry metadata, service page rendering, and action endpoints.
- [ ] Run `python3 manage.py test dashboard`.
- [ ] Run `python3 manage.py check`.
- [ ] Run `node --check` for changed console JS files.

## Open Questions

- Should service docs links and operation counts remain manually maintained in the dashboard registry?
- How much should `dashboard.js` be reduced in favor of declarative panel configs?
- Should tutorial definitions live in this repo, Floci docs, or both?
- Which inventory-only service should become the next interactive workbench: ECR, CodeBuild, Transfer Family, or another high-traffic local workflow?
- What health fields are stable enough in Floci to expose on an Environment Details page?
