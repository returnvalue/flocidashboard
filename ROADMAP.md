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

Recent S3 and SQS work established the shared pattern for future service pages:

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
- Service-specific modules such as `s3_api.py`, `s3_views.py`, `s3-console.js`, `s3-console.css`, `sqs_api.py`, `sqs_views.py`, `sqs-console.js`, and `sqs-console.css`.

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
- Added tutorial-style "About Floci S3", "About Floci SQS", "About Floci SNS", "About Floci Lambda", "About Floci DynamoDB", and "About Floci CloudWatch Logs" notes.
- Added contributor architecture notes and an AI-assisted contributor prompt to `README.md`.

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

### 2. Service Page Consistency Pass

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

### 3. Shared Console Shell Hardening

Improve shared frontend helpers based on what S3 and SQS now share.

Feasible first version:

- Move repeated toolbar, modal, empty-state, and destructive-confirmation patterns into `service-console.js`.
- Add small helper APIs for rendering action buttons from registry metadata.
- Keep service-specific renderers where workflows differ.
- Add JS syntax checks for every service console file.

Why it matters:

- The next workbench should require less custom code than S3 or SQS.
- Contributor changes become easier to review.

### 4. Action API Follow-Through

Make interactive endpoint behavior more consistent.

Feasible first version:

- Keep using `dashboard/actions.py` for JSON parsing and error responses.
- Add operation names to action errors.
- Add tests for every interactive action endpoint.
- Gradually move common validation patterns into small service-specific helpers.
- Avoid an over-generalized dispatcher until S3, SQS, and one more service prove the shape.

Why it matters:

- Tutorial mode and future workbenches can rely on predictable action behavior.
- Users get consistent error toasts and response shapes.

### 5. Environment Details Page

Expand the current status strip into a simple environment page.

Feasible first version:

- Show endpoint, region, profile, identity, Floci version, and edition.
- Show friendly warnings when Floci is unavailable or the endpoint is not local.
- Keep using `/api/health/` and `/api/identity/`.
- Add fields only when the current Floci response already exposes them.

Why it matters:

- Many local debugging problems start with endpoint or credential confusion.
- This is practical and low-risk.

### 6. S3 Follow-Ups

Keep improving the existing S3 workbench.

Feasible follow-ups:

- Improve object pagination behavior.
- Improve empty/delete handling for versioned buckets.
- Replace any remaining unsafe HTML rendering.
- Add clearer empty states for buckets, prefixes, and object details.
- Add cross-service links where S3 notifications reference SQS, SNS, or Lambda resources.

Why it matters:

- S3 is the reference workbench and likely a high-traffic page.

## Later, But Still Plausible

These are useful, but should wait until the shared service architecture has one or two more workbenches behind it.

### Step Functions Execution Viewer

Feasible first version:

- State machine list.
- Start execution with JSON input.
- Execution list and detail/history view.
- Later: simple graph rendering from ASL JSON.

### API Gateway Inspector

Feasible first version:

- REST and HTTP API list.
- Route/resource detail panels.
- Integration view.
- Later: local test invoke.

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
2. Service Page Consistency Pass.
3. Shared Console Shell hardening.
4. Action API follow-through.
5. Environment Details page.
6. S3 follow-ups.

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
- Which service should become the next reference workbench after S3, SQS, SNS, Lambda, DynamoDB, and CloudWatch Logs: Step Functions or API Gateway?
- What health fields are stable enough in Floci to expose on an Environment Details page?
