# Floci Dashboard

A small Django UI for inspecting and testing a local [Floci](https://floci.io/) AWS-compatible environment. The dashboard shows Floci health, endpoint/profile/identity details, selectable service cards, resource counts, service-specific inventory pages, and interactive workbenches for common local AWS workflows.

![Floci Dashboard UI](./djangofloci.png)

## What It Shows

- Local Floci health and version
- AWS endpoint, profile, and caller identity
- Clickable service cards for supported local services, with persisted home-page service filtering to keep resource probes focused
- Interactive workbenches for S3, IAM, EC2, SQS, SNS, Lambda, DynamoDB, CloudWatch Logs, Step Functions, EventBridge, EventBridge Pipes, EventBridge Scheduler, API Gateway, Kinesis, KMS, Secrets Manager, SSM Parameter Store, CloudFormation, Cognito, AWS Config, RDS, Auto Scaling, ELB v2, CloudFront, Route 53, ACM, ECS, ECR, EKS, ElastiCache, OpenSearch, Athena, Backup, Firehose, Glue, Kafka, Neptune, SES, Transfer Family, Textract, Transcribe, CodeDeploy, CodeBuild, Bedrock Runtime, AppConfig, and Resource Groups Tagging
- Detail pages for services such as Cost Explorer, Cost and Usage Reports, BCM Data Exports, Pricing, and more
- Loading state with the Floci cloud image while service data is fetched

## Run Locally On macOS

These steps are written for macOS. The dashboard will likely work fine on Windows as well, but Windows has not been tested yet.

Clone the project first:

```bash
git clone https://github.com/returnvalue/flocidashboard
cd flocidashboard
```

### Option 1: Use A Virtual Environment

This keeps the Python packages isolated to this project.

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
pip3 install -r requirements.txt
```

### Option 2: Install Without A Virtual Environment

This installs the packages into your current Python 3 environment.

```bash
pip3 install -r requirements.txt
```

The requirements install the latest available Django and boto3 releases.


Make sure Floci is already running locally on port `4566`. Before starting Django, choose one local AWS credential setup.

For a fresh Floci clone, local `test/test` credentials are enough:

```bash
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_DEFAULT_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
```

Or create and use your own AWS profile for Floci before running the dashboard:

```bash
export AWS_PROFILE=floci-admin
export AWS_DEFAULT_REGION=us-east-1
export AWS_ENDPOINT_URL=http://localhost:4566
```

`FLOCI_AWS_ENDPOINT_URL` and `FLOCI_AWS_REGION` are also supported if you prefer Floci-specific names. When no explicit profile or credentials are visible to Django, the dashboard falls back to local `test/test` credentials so a fresh Floci install can still show service inventory.

Floci 1.5.16 and newer support the public localhost DNS suffix for virtual-hosted-style S3. The dashboard accepts `localhost.floci.io`, `*.localhost.floci.io`, and the LocalStack-compatible `*.localhost.localstack.cloud` aliases as local endpoints:

```bash
export FLOCI_AWS_ENDPOINT_URL=http://s3.localhost.floci.io:4566
```

Floci 1.5.18 adds CloudFront and AWS Config emulation. The dashboard includes a CloudFront management workbench plus AWS Config inventory, and refreshes Neptune, SNS, SQS, Lambda, and API Gateway notes around the 1.5.18 release surface.

Floci 1.5.19 adds Lambda layer APIs, CloudFormation parity for SQS queues, SNS-to-SQS subscriptions, and Cognito resources, API Gateway REQUEST authorizer fixes, ELBv2 listener attribute and capacity reservation actions, and ECR Public Gallery publishing. The dashboard surfaces attached Lambda layer versions and refreshes release-aware notes across the affected service pages.

Floci 1.5.20 adds broad ACM, ECS, and ECR coverage. The dashboard includes an ACM certificate workbench, an ECS container workflow workbench, and an ECR repository/image registry workbench.

The dashboard also includes interactive workbenches for EKS cluster lifecycle, ElastiCache replication groups/users/IAM auth, OpenSearch domain lifecycle/configuration, and Athena query execution.

Floci 1.5.21 moves builds to GraalVM 25 and adds Cognito userInfo/custom-schema support, EC2 parity fixes, SES v2 configuration set event destinations, Firehose tagging, and assorted conformance fixes. The dashboard refreshes affected service notes and surfaces SES v2 configuration set event destinations.

The dashboard also includes interactive workbenches for AWS Backup, Amazon Data Firehose, AWS Glue, MSK Kafka, Neptune, SES, AWS Transfer Family, Textract, Transcribe, CodeDeploy, CodeBuild, Bedrock Runtime, AppConfig, and Resource Groups Tagging.

Start the Django dev server:

```bash
python3 manage.py runserver 127.0.0.1:8000
```

Open:

```text
http://127.0.0.1:8000
```

## Configuration

Defaults live in `flocidashboard/settings.py`:

- `FLOCI_AWS_ENDPOINT_URL`: `http://localhost:4566`
- `FLOCI_AWS_REGION`: `us-east-1`
- `FLOCI_AWS_PROFILE`: `floci-admin`

Environment variables override those defaults. If `floci-admin` is not configured locally, the dashboard uses local `test/test` credentials instead of failing the homepage with missing-credential cards.

## Quick Check

```bash
python3 manage.py check
```

Then refresh the browser. Service cards should appear once Floci responds.

## Contributor Architecture Notes

The dashboard is moving toward a shared service workbench architecture. New service features should build on the shared pieces instead of replacing existing inventory pages.

Core files:

- `dashboard/services.py`: canonical service registry. Add service metadata, maturity, optional CSS/JS assets, and action metadata here.
- `dashboard/actions.py`: shared action metadata plus JSON parsing and error normalization helpers for interactive service endpoints.
- `dashboard/templates/dashboard/service.html`: common service page shell. Interactive workbenches should be layered into this page while keeping the original read-only inventory visible.
- `dashboard/static/dashboard/service-console.js`: shared browser-side helpers for API calls, summary cards, read-only cards, toolbars, modals, formatting, and lower-right toasts.
- `dashboard/static/dashboard/dashboard.js`: generic read-only inventory rendering for service pages.
- Service-specific files such as `s3_api.py`, `s3_views.py`, `s3-console.js`, and `s3-console.css`, `iam_api.py`, `iam_views.py`, `iam-console.js`, and `iam-console.css`, `ec2_api.py`, `ec2_views.py`, `ec2-console.js`, and `ec2-console.css`, `cloudformation_api.py`, `cloudformation_views.py`, `cloudformation-console.js`, and `cloudformation-console.css`, `cognito_api.py`, `cognito_views.py`, `cognito-console.js`, and `cognito-console.css`, `rds_api.py`, `rds_views.py`, `rds-console.js`, and `rds-console.css`, `autoscaling_api.py`, `autoscaling_views.py`, `autoscaling-console.js`, and `autoscaling-console.css`, `elasticloadbalancing_api.py`, `elasticloadbalancing_views.py`, `elasticloadbalancing-console.js`, and `elasticloadbalancing-console.css`, `cloudfront_api.py`, `cloudfront_views.py`, `cloudfront-console.js`, and `cloudfront-console.css`, `route53_api.py`, `route53_views.py`, `route53-console.js`, and `route53-console.css`, `acm_api.py`, `acm_views.py`, `acm-console.js`, and `acm-console.css`, `ecs_api.py`, `ecs_views.py`, `ecs-console.js`, and `ecs-console.css`, `ecr_api.py`, `ecr_views.py`, `ecr-console.js`, and `ecr-console.css`, `eks_api.py`, `eks_views.py`, `eks-console.js`, and `eks-console.css`, `elasticache_api.py`, `elasticache_views.py`, `elasticache-console.js`, and `elasticache-console.css`, `opensearch_api.py`, `opensearch_views.py`, `opensearch-console.js`, and `opensearch-console.css`, `athena_api.py`, `athena_views.py`, `athena-console.js`, and `athena-console.css`, or the equivalent files for SQS, SNS, Lambda, DynamoDB, CloudWatch Logs, Step Functions, EventBridge, API Gateway, Kinesis, Secrets Manager, SSM Parameter Store, Backup, Firehose, Glue, Kafka, Neptune, SES, Transfer Family, Textract, Transcribe, CodeDeploy, CodeBuild, Bedrock Runtime, AppConfig, and Resource Groups Tagging: focused behavior for one service only.

Important conventions:

- Treat interactive workbenches as additive. Do not remove summary cards, anchor-link behavior, read-only inventory cards, supported-operation panels, or service notes.
- Register service capabilities in `dashboard/services.py` before wiring service-specific UI.
- Use `dashboard/actions.py` helpers for JSON request parsing and normalized action errors.
- Use `ServiceConsole.toast()` for action feedback. Interactive success and failure messages should appear as lower-right toasts.
- Keep service-specific JavaScript focused on that service's workflow. Prefer shared helpers from `service-console.js` for common UI behavior.
- Keep destructive actions explicit. Add destructive action metadata with confirmation text.
- Add focused tests for registry metadata, page rendering, and each new action endpoint.

Recommended checks before opening a PR:

```bash
python3 manage.py test dashboard
python3 manage.py check
node --check dashboard/static/dashboard/service-console.js
node --check dashboard/static/dashboard/<service>-console.js
```

Use the service page in the browser as a final sanity check, for example:

```text
http://127.0.0.1:8000/service/s3/
http://127.0.0.1:8000/service/iam/
http://127.0.0.1:8000/service/ec2/
http://127.0.0.1:8000/service/sqs/
http://127.0.0.1:8000/service/stepfunctions/
http://127.0.0.1:8000/service/eventbridge/
http://127.0.0.1:8000/service/pipes/
http://127.0.0.1:8000/service/scheduler/
http://127.0.0.1:8000/service/apigateway/
http://127.0.0.1:8000/service/kinesis/
http://127.0.0.1:8000/service/kms/
http://127.0.0.1:8000/service/secretsmanager/
http://127.0.0.1:8000/service/ssm/
http://127.0.0.1:8000/service/cloudformation/
http://127.0.0.1:8000/service/cognito/
http://127.0.0.1:8000/service/config/
http://127.0.0.1:8000/service/rds/
http://127.0.0.1:8000/service/autoscaling/
http://127.0.0.1:8000/service/elasticloadbalancing/
http://127.0.0.1:8000/service/cloudfront/
http://127.0.0.1:8000/service/route53/
http://127.0.0.1:8000/service/acm/
http://127.0.0.1:8000/service/ecs/
http://127.0.0.1:8000/service/ecr/
http://127.0.0.1:8000/service/eks/
http://127.0.0.1:8000/service/elasticache/
http://127.0.0.1:8000/service/opensearch/
http://127.0.0.1:8000/service/athena/
http://127.0.0.1:8000/service/backup/
http://127.0.0.1:8000/service/firehose/
http://127.0.0.1:8000/service/glue/
http://127.0.0.1:8000/service/kafka/
http://127.0.0.1:8000/service/neptune/
http://127.0.0.1:8000/service/ses/
http://127.0.0.1:8000/service/transfer/
http://127.0.0.1:8000/service/textract/
http://127.0.0.1:8000/service/transcribe/
http://127.0.0.1:8000/service/codedeploy/
http://127.0.0.1:8000/service/codebuild/
http://127.0.0.1:8000/service/bedrockruntime/
http://127.0.0.1:8000/service/appconfig/
http://127.0.0.1:8000/service/resourcegroupstagging/
```

## Prompt For AI-Assisted Contributors

If you are using Codex, Claude, or another local coding assistant to add a dashboard feature, start with a prompt like this:

```text
You are contributing to the Floci Dashboard Django app. Before editing, read README.md, ROADMAP.md, dashboard/services.py, dashboard/actions.py, dashboard/templates/dashboard/service.html, dashboard/static/dashboard/service-console.js, and the closest existing workbench implementation. Good references are S3 for object browsing, IAM for identity and policy workflows, EC2 for local compute lifecycle workflows, SQS/SNS for messaging, Lambda for invoke/test workflows, DynamoDB for read-only data exploration, CloudWatch Logs for recent event viewing, Step Functions for execution workflows, EventBridge for event routing tests, EventBridge Pipes and Scheduler for event routing lifecycle workflows, API Gateway for request testing, Kinesis for stream records, KMS for key workflows, Secrets Manager for secret value workflows, SSM for Parameter Store workflows, CloudFormation for stack workflows, Cognito for local auth workflows, AWS Config for compliance setup workflows, RDS for database lifecycle workflows, Auto Scaling for capacity workflows, ELB v2 for load-balancing topology workflows, CloudFront for CDN management workflows, Route 53 for DNS management workflows, ACM for certificate workflows, ECS for container orchestration workflows, ECR for image registry workflows, EKS for Kubernetes cluster workflows, ElastiCache for cache/user/IAM auth workflows, OpenSearch for search domain workflows, Athena for SQL query workflows, Backup for plan/job workflows, Firehose for stream delivery, Glue for database/table catalog and schema registry workflows, Kafka for cluster bootstrap and broker endpoints, Neptune for graph cluster and instance lifecycle, SES for email identities and templates, Transfer Family for SFTP server and user management workflows, Textract and Transcribe for stub AI workflows, CodeDeploy and CodeBuild for local delivery workflows, Bedrock Runtime for stub model requests, AppConfig for configuration deployment and retrieval, and Resource Groups Tagging for centralized tag discovery.

Goal: add or improve the <SERVICE> dashboard feature.

Architecture rules:
- Preserve the existing service page and read-only inventory. Interactive workbenches are additive, not replacements.
- Register service metadata, maturity, optional assets, and action metadata in dashboard/services.py.
- Use dashboard/actions.py for JSON parsing and normalized action errors.
- Use the shared ServiceConsole helpers for API calls, summary rendering, modals, toolbars, formatting, and lower-right toasts.
- Keep service-specific JS/CSS focused on the service workflow only.
- Use destructive action confirmations for delete, purge, reset, empty, or cleanup actions.
- Preserve fresh local startup behavior. The dashboard must work with AWS_ENDPOINT_URL, AWS_DEFAULT_REGION, AWS_ACCESS_KEY_ID=test, and AWS_SECRET_ACCESS_KEY=test, and must not assume a floci-admin profile exists.
- If changing auth, identity, health, or homepage loading behavior, keep missing Floci and missing/partial AWS credentials graceful: show helpful status messages and display any inventory that can still be loaded.
- Add focused tests for registry metadata, service page rendering, and action endpoints.

Implementation request:
1. Inspect the existing inventory shape for <SERVICE>.
2. Propose the smallest useful interactive workbench for common local development workflows.
3. Implement it in the shared architecture.
4. Keep the original read-only cards visible under the new workbench.
5. Run python3 manage.py test dashboard, python3 manage.py check, and node --check for any changed console JS or dashboard JS.
6. Summarize changed files, behavior, tests run, and any known follow-ups.
```
