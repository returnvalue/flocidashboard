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
- Service-specific modules such as `s3_api.py`, `s3_views.py`, `s3-console.js`, and `s3-console.css`, `iam_api.py`, `iam_views.py`, `iam-console.js`, and `iam-console.css`, `ec2_api.py`, `ec2_views.py`, `ec2-console.js`, and `ec2-console.css`, `stepfunctions_api.py`, `stepfunctions_views.py`, `stepfunctions-console.js`, and `stepfunctions-console.css`, `eventbridge_api.py`, `eventbridge_views.py`, `eventbridge-console.js`, and `eventbridge-console.css`, or the equivalent files for SQS, SNS, Lambda, DynamoDB, CloudWatch Logs, API Gateway, AppSync, Kinesis, Secrets Manager, SSM Parameter Store, CloudFormation, Cognito, RDS, Auto Scaling, ELB v2, CloudFront, Cloud Map, CloudTrail, Route 53, ACM, ECS, ECR, EKS, ElastiCache, OpenSearch, Athena, Backup, Firehose, Glue, Kafka, Neptune, SES, Transfer Family, Textract, Transcribe, CodeDeploy, CodeBuild, Bedrock Runtime, AppConfig, and Resource Groups Tagging.

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
- Built the ACM Certificate Workbench with certificate request, PEM retrieval, private certificate export, renewal, deletion, tagging, and account expiry configuration helpers.
- Registered ACM as an interactive certificate workbench.
- Built the ECS Container Workbench with cluster creation/deletion, task definition registration, run/stop task helpers, service create/update/delete flows, tagging, account settings, and Docker/mock-mode notes.
- Registered ECS as an interactive container workbench.
- Built the ECR Image Registry Workbench with repository creation/deletion, Docker login token helpers, image deletion, tag mutability updates, lifecycle/repository policy round trips, tagging, and registry garbage collection.
- Registered ECR as an interactive image registry workbench.
- Built the EKS Cluster Workbench with cluster creation/deletion, tag helpers, list-tags support, endpoint context, and mock/real-mode notes.
- Registered EKS as an interactive Kubernetes workbench.
- Built the ElastiCache Workbench with replication group lifecycle, user creation and updates, IAM auth token validation, connection snippets, and proxy-port context.
- Registered ElastiCache as an interactive cache workbench.
- Built the OpenSearch Domain Workbench with domain lifecycle, config updates, upgrade helpers, tagging, version compatibility, and instance type limit inspection.
- Registered OpenSearch as an interactive search workbench.
- Built the Athena Query Workbench with workgroup creation, query start/stop, execution details, result previews, and S3 output context.
- Registered Athena as an interactive SQL workbench.
- Built the AWS Backup plan and job workbench with plan, selection, vault, and recovery point management.
- Registered AWS Backup as an interactive backup workbench.
- Built the Amazon Data Firehose Delivery Stream workbench with stream creation, record ingestion, and S3 delivery buffering details.
- Registered Firehose as an interactive stream delivery workbench.
- Built the AWS Glue catalog and registry workbench with databases, tables, partitions, registries, schemas, and versioning flows.
- Registered Glue as an interactive catalog and schema workbench.
- Built the MSK Kafka bootstrap broker workbench with cluster lifecycle, broker lookup, and client connectivity configurations.
- Registered MSK Kafka as an interactive broker workbench.
- Built the Neptune Graph workbench with cluster and instance creation, Gremlin WebSocket credentials, and connection information.
- Registered Neptune as an interactive graph workbench.
- Built the AWS SES Email and Template workbench with domain/email verification, email drafting, templates, and clearing the local mailbox.
- Registered SES as an interactive email workbench.
- Built the AWS Transfer Family console with server creation, user setup, SSH public key importing, and management APIs.
- Registered Transfer Family as an interactive server workbench.
- Built the Textract stub workbench with synchronous document text and analysis requests plus immediate-success async job workflows.
- Registered Textract as an interactive document AI workbench.
- Built the Transcribe stub workbench with transcription job and custom vocabulary lifecycle helpers.
- Registered Transcribe as an interactive speech workbench.
- Built the CodeDeploy workbench with application, deployment group, deployment, deployment config, lifecycle hook, and tagging workflows.
- Registered CodeDeploy as an interactive deployment workbench.
- Built the CodeBuild workbench with project, build execution, report group, source credential, and curated image workflows.
- Registered CodeBuild as an interactive build workbench.
- Built the Bedrock Runtime workbench with Converse and InvokeModel request helpers, model ID examples, and decoded stub responses.
- Registered Bedrock Runtime as an interactive model runtime workbench.
- Built the AppConfig workbench with application hierarchy, hosted versions, deployment strategies, deployments, configuration sessions, and AppConfigData retrieval.
- Registered AppConfig as an interactive configuration workbench.
- Built the Resource Groups Tagging explorer with bulk tag and untag actions, filtered resource discovery, and tag-value lookup.
- Registered Resource Groups Tagging as an interactive tag explorer.
- Added a home-page service selector that defaults to the top 12 common AWS services, persists user selections, labels cards as Interactive or Read Only, and limits `/api/resources/` calls to selected services for faster loads.
- Replaced the dashboard README screenshot image.
- Added tutorial-style "About Floci" notes across interactive service pages, including Textract, Transcribe, CodeDeploy, CodeBuild, Bedrock Runtime, AppConfig, and Resource Groups Tagging.
- Added contributor architecture notes and an AI-assisted contributor prompt to `README.md`.
- Added Floci 1.5.18 inventory coverage and homepage cards for CloudFront and AWS Config, then promoted CloudFront to an interactive management workbench.
- Refreshed release-aware notes for Neptune Gremlin backend support, SNS HTTP/HTTPS delivery, SQS message move tasks and FIFO dedup scoping, Lambda port-pool behavior, API Gateway v2 ALB routing, KMS MAC operations, ElastiCache Memcached clusters, and ECS-to-ELBv2 target registration.
- Reviewed Floci 1.5.19 and refreshed Lambda layer, CloudFormation SQS queue, SNS-to-SQS subscription, and Cognito parity, API Gateway authorizer, ELBv2 action-family, S3 request-payment, SNS batch/binary-attribute, SQS queue-url, Cognito token-claim, and ECR Public Gallery dashboard notes.
- Reviewed Floci 1.5.21 and refreshed Cognito, EC2, SES v2, Firehose, KMS, CloudFormation, API Gateway, EventBridge, S3, DynamoDB, and RDS dashboard coverage notes, including SES v2 configuration set event destination inventory.
- Reviewed Floci 1.5.22, added an AppSync Phase 1 management workbench, exposed KMS GenerateRandom plus ECS RunTask overrides and create-time tags, added an ECS + ALB CloudFormation starter, and refreshed affected service notes.
- Made homepage service cards use registry page paths when available and dedupe repeated card description text from service aliases.
- Reviewed Floci 1.5.23 plus the two post-release main commits, refreshed AppSync, Glue, ECS, EKS, SES, CloudWatch Logs, DynamoDB, EC2, Step Functions, and SNS release-aware notes, and added AWS Cloud Map inventory coverage for the new servicediscovery management API.
- Reviewed Floci 1.5.24 and added CloudTrail inventory coverage for local audit trail lifecycle visibility.
- Promoted AWS Cloud Map to an interactive service discovery workbench for namespace, service, instance, discovery, custom health, and tag workflows.
- Expanded the EKS workbench with managed node group create and delete workflows on top of existing node group inventory.
- Refreshed Floci 1.5.24 coverage notes across Cognito, Glue, KMS, S3, SES, Athena, EC2, ELB v2, and ElastiCache, and added Glue UpdateDatabase plus BatchDeleteTable workflows.
- Reviewed Floci 1.5.25 and refreshed existing-service notes for RDS provisioning, Glue partitions/statistics, CloudFormation custom resources and VPC/subnet provisioning, STS secret persistence, SQS message sizing and delayed-message counts, S3 conformance, SES v2, ELBv2, ECS, Cognito, Athena, AppConfig, MSK, and EC2.
- Added Floci 1.5.25 inventory coverage and service pages for the four new services: EMR, WAF v2, AWS Batch, and RDS Data API.
- Added the Service Matrix page powered by `dashboard/services.py`, with homepage-order service rows, linked service names, API paths, maturity, shared console status, action counts, tags, and a horizontal coverage summary.
- Refined homepage service filtering by removing the unused search box, keeping the selector compact, closing it on outside clicks, preserving selected-service loading, and making Refresh the explicit cache-bypass path.
- Added short-cache headers for `/api/services/`, static JS cache-busting for dashboard and service console assets, and tests for selected-service resource loading.
- Completed a service page consistency pass for generic summary links, zero-value rendering, targeted summary-card anchors, and clearer inventory empty states.
- Hardened the shared console shell with `confirmAction`, registry-shaped `renderActionButtons`, destructive confirmation reuse, and pilot migrations for Transcribe and AppConfig action rows.
- Added JS syntax checks across dashboard static JavaScript files through `dashboard.tests.StaticJavaScriptTests`.
- Added a contributor new-service checklist to `README.md` covering registry entries, inventory/API wiring, service pages, optional static assets, resource loader registration, tests, JS checks, and roadmap notes.
- Added `ActionRegistryAuditTests` to compare `dashboard/services.py` action metadata against Django route coverage, endpoint test references, and destructive confirmation metadata.
- Moved action metadata loading into `service-console.js` with `ServiceConsole.loadServiceActions(serviceKey, fallbacks)`, then simplified the AppConfig and Transcribe console pilots.
- Added the Environment Details page at `/environment/` for Floci health, AWS endpoint, region, credential source/profile, caller identity, and local-endpoint warnings.
- Closed the action audit baseline by adding endpoint tests across S3, Cloud Map, IAM, SQS, AppSync, Auto Scaling, CloudFront, Cognito, EC2, ELB v2, OpenSearch, and Route 53, reducing `ACTION_TEST_REFERENCE_GAP_BASELINE` from 39 historical gaps to zero.
- Migrated Cloud Map action rows to `ServiceConsole.loadServiceActions(...)`, making it the third registry-driven console after AppConfig and Transcribe.
- Expanded the IAM workbench with managed policy version create/default/delete flows, user/group membership editing, and role trust policy editing.
- Added a Tracked Resources homepage filter that discovers resources across all registered services and hides empty service cards.
- Reviewed Floci 1.5.29 and refreshed release-aware notes for AppSync Phase 4 VTL execution, IAM cross-account assumed-role routing and AmazonRDSEnhancedMonitoringRole, floci-core reset/nuke endpoints, ECS hostPort/native-image/CloudFormation cleanup behavior, Transcribe vocabulary persistence, shutdown persistence flushing, local ALB DNS names, Step Functions aws-sdk integrations, Cognito client overrides, SES v2 optional FromEmailAddress, SSM diagnostics, and IoT compatibility polish.
- Reviewed Floci 1.5.28, added read-only inventory coverage for IoT Core and Elastic Beanstalk, and refreshed release-aware notes for AppSync Phase 3, Kafka-backed Pipes, Steampipe-oriented read APIs, ECS EFS volumes, MemoryDB ACL auth, CodeDeploy persistence, Cognito, Lambda/SQS ESM, RDS, EC2, IAM, S3, SES, Secrets Manager, CloudFormation, CloudFront, CodeBuild, DynamoDB, Step Functions, Athena, ELBv2, EventBridge, and MSK.
- Reviewed Floci 1.5.27, added read-only inventory coverage for MemoryDB, CodePipeline, and S3 Vectors, folded EC2 Network ACLs into EC2 inventory, and refreshed release-aware notes for DynamoDB, CloudFormation SAM support, Neptune openCypher, persistence, Secrets Manager rotation, SES, ACM, SSM, and Auto Scaling.
- Reviewed Floci 1.5.26 and refreshed release-aware notes for DocumentDB, CloudFormation provisioning, SSM SendCommand and patch baselines, Auto Scaling reconciliation and mixed instances, EC2 Spot/DNS behavior, KMS EnableKey, and Cognito client/password recovery alignment.
- Added Amazon DocumentDB cluster and instance inventory, resource counting, homepage coverage, and a dedicated read-only service page.
- Expanded EC2 inventory with VPC endpoints and SSM inventory with per-operating-system default patch baselines.
- Added KMS key enable/disable actions and surfaced S3 user metadata in the object detail drawer.
- Added local AWS workflow labs with shared routes, UI, live-state verification, reset behavior, and breadcrumb navigation.
- Added a top-level Labs directory that automatically lists services with registered labs and links it from the homepage between Environment and Service Matrix.
- Completed eight IAM labs covering users, managed and inline policies, access keys, groups, roles, and EC2 instance profiles.
- Completed twelve S3 labs covering bucket/object fundamentals, prefixes, metadata and tags, version recovery, presigned URLs, bucket security, default encryption, lifecycle retention, CORS, S3-to-SQS notifications, and multipart upload.
- Started the SQS lab sequence with queue creation, URL resolution, full attribute inspection, account queue listing, live-state completion, and queue-owned reset.
- Added the SQS message lifecycle lab with a known JSON event, message attributes, reload-safe receive verification, live receipt-handle discovery, delete verification, and message-only reset behavior.
- Added the SQS visibility timeout lab with in-flight receipt tracking, ChangeMessageVisibility, immediate hidden-state verification, timed message reappearance, and message-only cleanup.
- Added the delayed-message SQS lab with DelaySeconds, delayed-count inspection, atomic unavailable-state verification, timed delivery, and attributed message cleanup.
- Added the SQS batch-message lab with three-entry SendMessageBatch, multi-message receive verification, live receipt-handle discovery, DeleteMessageBatch, and batch-only reset behavior.
- Added the SQS queue-configuration lab with visibility, retention, long-poll attributes, operational tags, exact live-state verification, and default-restoring reset behavior.
- Added the SQS dead-letter queue and redrive lab with dedicated source/DLQ topology, `RedrivePolicy`, repeated failed receives, explicit max-receive transition, DLQ inspection, managed message move task verification, and queue-owned reset.
- Added the SQS FIFO ordering and deduplication lab with explicit FIFO attributes, one ordered message group, duplicate-send metadata comparison, queue-depth verification, sequence-number inspection, and queue-owned reset.
- Completed the foundational SQS sequence with a purge/delete lab that verifies message removal, preserved queue configuration and tags, final queue absence, and idempotent reset behavior.
- Added the first SNS lab and first dedicated multi-service messaging lab: one topic, two least-privilege SQS queue policies, two raw-delivery subscriptions, one publish, two independently verified queue copies, and dependency-aware reset.
- Added the EventBridge Scheduler-to-SQS lab with a service trust policy, queue-scoped execution permission, dedicated schedule group, dynamic one-time expression, eventual-delivery polling, and automatic schedule deletion verification.
- Added the SNS subscription filter policy lab with two message-attribute filters, two contrasting publishes, exact-route verification, exclusion checks, and dependency-aware cleanup.
- Added the first CloudFormation lab with template validation, S3 and SQS stack provisioning, outputs, logical-to-physical resource mapping, event inspection, live service verification, stack deletion, and ownership cleanup proof.
- Added the first EC2 networking lab with a dedicated VPC, public/private subnets, public-IP behavior, internet gateway attachment, separate route tables, explicit subnet associations, topology verification, and dependency-aware teardown.
- Added the EC2 traffic-control lab with trusted-CIDR HTTPS ingress, web-to-app security-group references, stateful egress inspection, an explicit network ACL support probe, intended stateless NACL rule artifacts, and isolated teardown.
- Added the EC2 S3 gateway endpoint lab with an isolated VPC and private subnet, explicit route-table association, a bucket-scoped endpoint policy, managed prefix-list route inspection, a documented Floci persistence boundary, and dependency-aware teardown.
- Added the EC2 SQS interface endpoint lab with isolated subnet placement, HTTPS-only endpoint security, private DNS, queue-scoped endpoint policy, endpoint ENI inspection, and dependency-aware teardown.

## Near-Term Priorities

These are the most likely next steps because they build directly on the current codebase.

Recently completed from the previous build order:

- Service Matrix.
- Home page filtering follow-through.
- Service Page Consistency Pass.
- Shared Console Shell hardening first pass.
- Action API registry audit.
- Shared action metadata loading in `service-console.js`.
- Environment Details page.
- Completed action audit baseline cleanup across all historical route/test gaps.
- Cloud Map shared action loader migration.
- IAM policy version, group membership, and trust policy follow-ups.

### 1. Keep Action Audit Baseline At Zero

Use the new action metadata audit to prevent future route/test drift.

Feasible first version:

- Add endpoint tests in the same change as each new registry action.
- Keep `ACTION_TEST_REFERENCE_GAP_BASELINE` empty unless a deliberately temporary exception is documented.
- Fix or remove stale action metadata paths when the audit exposes dead links.
- Keep destructive action confirmation metadata mandatory.

Why it matters:

- The registry becomes a trustworthy map of what the UI can really execute.
- Contributors get a measurable way to improve coverage without guessing.

### 2. Continue Shared Action Loader Migration

Keep moving service consoles toward registry-driven action rows.

Feasible first version:

- Migrate another compact console with several destructive actions, such as Athena or CloudFront.
- Remove duplicated `ACTION_FALLBACKS`, local action lookup helpers, and label override code.
- Keep service-specific JavaScript focused on workflow behavior and rendering.
- Add or adjust JS syntax checks and page smoke tests as needed.

Why it matters:

- Action buttons become registry-driven instead of duplicated per workbench.
- Future service migrations get smaller and less error-prone.

### 3. Step Functions Follow-Ups

Keep improving the new Step Functions execution workbench.

Feasible follow-ups:

- Add ASL definition graph rendering.
- Improve execution-history filtering and grouping.
- Add task-token callback helpers for waitForTaskToken workflows.
- Add cross-service links from state machine Lambda tasks where the resource ARN is easy to identify.

Why it matters:

- Step Functions is a natural workflow debugger for local Lambda and service-integration testing.

### 4. IAM Polish

Keep improving the new IAM workbench.

Feasible follow-ups:

- Add optional principal search/filtering inside the IAM workbench.
- Add better affordances for copying access key and assumed-role credential exports after refresh.
- Add richer managed policy version document diffs if Floci exposes enough version metadata.

Why it matters:

- IAM is central to local AWS debugging.
- The current workbench is already useful, and a few focused additions would make it a stronger identity debugger.

### 5. S3 Follow-Ups

Keep improving the existing S3 workbench.

Feasible follow-ups:

- Improve object pagination behavior.
- Improve empty/delete handling for versioned buckets.
- Replace any remaining unsafe HTML rendering.
- Add clearer empty states for buckets, prefixes, and object details.
- Add cross-service links where S3 notifications reference SQS, SNS, or Lambda resources.
- Add optional links from completed S3 labs into the matching bucket, object, or queue workbench.

Why it matters:

- S3 is the reference workbench and likely a high-traffic page.
- The completed S3 lab sequence now provides a repeatable regression and learning surface for these workflows.

### 6. Workflow Lab Framework

Continue the local AWS workflow lab system beyond IAM and S3.

Feasible follow-ups:

- Split the growing `dashboard/labs.py` module into a small typed package with shared registry and runner code.
- Continue networking labs with multi-AZ interface endpoints, endpoint policy variations, or hybrid connectivity when local support makes them useful.
- Add “View in dashboard” links after verified steps.
- Consider step-order guidance while preserving live-state recovery after reloads.

Why it matters:

- Labs teach AWS-shaped workflows while proving Floci behavior end to end.
- The curated runner model keeps command execution safe and repeatable.
- Multi-service labs can turn the dashboard into a practical local integration-learning environment.

### 7. EC2 Follow-Ups

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

### 8. EventBridge Follow-Ups

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

### 9. API Gateway Follow-Ups

Keep improving the new API Gateway request workbench.

Feasible follow-ups:

- Add route/resource filtering and clearer integration summaries inside the workbench.
- Add request history in browser state for quick replay.
- Add deep links to Lambda and CloudWatch Logs when integrations or log groups are recognizable.
- Add helper presets for common JSON, query string, and header test cases.

Why it matters:

- API Gateway is now the local HTTP front door for Lambda and HTTP proxy workflows.
- Replay and cross-service links would make it a stronger request debugger.

### 10. Kinesis Follow-Ups

Keep improving the new Kinesis stream workbench.

Feasible follow-ups:

- Add stream deletion with explicit destructive confirmation.
- Add enhanced monitoring toggles where Floci supports them.
- Add stream consumer registration and deregistration.
- Add simple record replay from recently read records.
- Add links from EventBridge Pipes or Lambda event source mappings when a stream ARN is recognizable.

Why it matters:

- Kinesis now completes the event/data-stream testing loop alongside SQS, SNS, EventBridge, Lambda, and CloudWatch.

### 11. Secrets Manager And SSM Follow-Ups

Keep improving local configuration and secret debugging.

Feasible follow-ups:

- Add Secrets Manager resource policy editing and tag editing.
- Add secret restore/cancel-delete flows if Floci exposes them.
- Add SSM parameter path browsing and parameter history.
- Add bulk parameter reads by path.
- Improve SecureString/KMS edge-case messaging.

Why it matters:

- Local apps commonly fail because configuration or credentials are missing, malformed, stale, or read from the wrong path.

## Parking Lot

These ideas are still interesting, but they likely need more design, Floci support, or a larger implementation window before they belong in the active roadmap.

- Resource graph across services.
- Request trace explorer.
- Docker runtime lens.
- Full state export/import/reset manager.
- Scenario launcher.
- Broader tutorial mode beyond the current curated workflow labs.
- Large file transfer UI.
- Deep CloudFormation stack graph.
- Broad IAM policy simulation.
- Multi-user auth.

## Suggested Build Order

This order is intentionally modest and can change:

1. Keep action audit baseline at zero.
2. Finish shared action loader migration.
3. Step Functions follow-ups.
4. IAM polish.
5. S3 follow-ups.
6. Split and extend the workflow lab framework, beginning with SQS.
7. EC2 follow-ups.
8. EventBridge follow-ups.
9. API Gateway follow-ups.
10. Kinesis follow-ups.
11. Secrets Manager and SSM follow-ups.

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
- Which remaining inventory-only service should become the next interactive workbench?
- Should the Environment page grow a Docker/runtime lens when Floci exposes stable runtime fields?
