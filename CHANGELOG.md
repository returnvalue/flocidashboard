# Changelog

## 0.1.3 — 2026-07-15

### Floci 1.5.32 compatibility

- Added optional S3 ACL and bucket-policy authorization configuration to Docker Compose and exposed its resolved mode on Environment Details.
- Updated S3 encryption handling for Floci's AWS-compatible default SSE-S3 response and refreshed S3 support guidance.
- Surfaced Lambda event-source failure destinations and downloadable function package locations.
- Added Cognito global sign-out and refresh-token revocation workflows.
- Added SES v2 contact create, update, and delete workflows and filtered KMS alias lookup by key.
- Documented Step Functions JSONata workflow variables and `Assign` support while retaining explicit IAM usernames in identity-management calls.

### Console polish

- Simplified S3 and IAM workbenches by removing duplicated read-only detail panels and making summary cards navigate into the interactive inventory.
- Removed the redundant upper-left service filter, renamed command search to Search, and removed duplicated supported-operation/read-only panels from first-class workbenches.
- Expanded Lambda into a first-class function console with lifecycle, configuration, code, versions, aliases, triggers, URLs, concurrency, permissions, tags, and relationship views.
- Expanded IAM with richer user, role, policy, access-key, login-profile, instance-profile, tag, and permission-management workflows.
- Expanded ECS with resource tabs, service/task relationships, task-definition revision lifecycle, deployments, infrastructure, task protection, container-instance draining, and Floci-supported service updates.
- Expanded EKS with searchable cluster, managed node group, Fargate profile, IAM relationship, and k3s connection views while removing unsupported API probes.
- Expanded ECR with searchable repository/image views, manifest inspection, stored policy management, local Docker commands, and registry garbage collection.
- Added EKS Fargate profile support introduced by the latest compatible Floci release.
- Consolidated AWS CLI parsed and raw output, added compact summary grids for large inventories, and expanded regression coverage.

### Compatibility and quality

- Audited ECS, EKS, and ECR controls against Floci's implemented handlers so the dashboard does not advertise ignored or unsupported mutations.
- Parallelized independent IAM, Lambda, ECS, EKS, and ECR inventory enrichment to reduce large-console load times.
- Added focused compatibility coverage for the latest Floci health/version response and expanded the dashboard suite to 1,000 tests.

## 0.1.2 — 2026-07-10

### EC2

- Added a first-class instance experience with searchable inventory, detail views, an improved launch workflow, state-aware lifecycle actions, polling, tag editing, and SSM command execution.
- Added a network control plane for VPCs, subnets, security groups, internet gateways, routes, Elastic IPs, NAT gateways, VPC endpoints, relationship topology, and connectivity diagnostics.
- Added advanced EC2 management for network ACLs, VPC flow logs, EBS volumes, snapshots, AMI registration, launch template versions, and Spot requests.
- Added seven guided local workflows covering IMDS, UserData, IAM instance roles, published web servers, route diagnosis, private S3 connectivity, and SSM commands.

### Quality

- Added focused API, action-registry, inventory, lab-runner, browser, and live Floci verification coverage.
- Preserved read-only inventory beneath the interactive workbench and documented local emulator compatibility boundaries in the UI.
