# Floci Dashboard

A small Django UI for inspecting, testing, and learning against a local [Floci](https://floci.io/) AWS-compatible environment. The dashboard shows Floci health, endpoint/profile/identity details, selectable service cards, resource counts, service-specific inventory pages, interactive workbenches, and one-click local AWS workflow labs.

![Floci Dashboard UI](./djangofloci.png)

## What It Shows

- Local Floci health and version
- Environment diagnostics for AWS endpoint, region, profile, credential source, caller identity, and local-endpoint warnings
- Clickable service cards for supported local services, with persisted home-page service filtering and a Tracked Resources view that shows only services with discovered resources
- Service Matrix coverage page showing registry maturity, API paths, shared console status, action counts, tags, and linked service pages
- Labs directory at `/labs/` showing every service with active workflow labs, current lab counts, runnable step counts, and direct links
- Local AWS workflow labs for IAM, S3, SQS, SNS, EventBridge Scheduler, CloudFormation, and EC2 networking, with exact AWS CLI commands, approved one-click execution, live-state verification, reset actions, and breadcrumb navigation back to the service or homepage
- Interactive workbenches for S3, IAM, EC2, SQS, SNS, Lambda, DynamoDB, CloudWatch Logs, Step Functions, EventBridge, EventBridge Pipes, EventBridge Scheduler, API Gateway, AppSync, Kinesis, KMS, Secrets Manager, SSM Parameter Store, CloudFormation, Cognito, AWS Config, RDS, Auto Scaling, ELB v2, CloudFront, AWS Cloud Map, Route 53, ACM, ECS, ECR, EKS, ElastiCache, OpenSearch, Athena, Backup, Firehose, Glue, Kafka, Neptune, SES, Transfer Family, Textract, Transcribe, CodeDeploy, CodeBuild, Bedrock Runtime, AppConfig, and Resource Groups Tagging
- Inventory pages for newer Floci services including EMR, WAF v2, AWS Batch, RDS Data API, Amazon DocumentDB, MemoryDB, CodePipeline, S3 Vectors, IoT Core, and Elastic Beanstalk
- Inventory pages for read-only or newly surfaced services such as CloudTrail
- Detail pages for services such as Cost Explorer, Cost and Usage Reports, BCM Data Exports, Pricing, and more
- Expanded inventory for EC2 VPC endpoints, EC2 Network ACLs, and SSM default patch baselines, plus KMS key enable/disable actions and richer S3 object metadata
- Release-aware service notes refreshed through Floci 1.5.29, including AppSync VTL execution, IAM assumed-role routing, ECS conformance, Transcribe persistence, ELBv2 local DNS, and Step Functions aws-sdk integrations
- Loading state with the Floci cloud image while service data is fetched

## Local AWS Workflow Labs

IAM, S3, SQS, SNS, EventBridge Scheduler, CloudFormation, and EC2 service pages link to curated labs at:

```text
/labs/
/service/iam/labs/
/service/s3/labs/
/service/sqs/labs/
/service/sns/labs/
/service/scheduler/labs/
/service/cloudformation/labs/
/service/ec2/labs/
```

Labs show the AWS CLI command shape without local endpoint plumbing. Each Run button invokes a registered boto3-backed action, displays the response, and independently verifies the result against live Floci state. Reset removes only the resources owned by that lab.

The curriculum includes eight IAM labs, twelve S3 labs, nine SQS labs, two SNS labs, one EventBridge Scheduler lab, one CloudFormation lab, and four EC2 networking labs. It covers IAM users, policies, access keys, groups, roles, and instance profiles; S3 buckets, objects, prefixes, metadata, tags, versioning, presigned URLs, security, encryption, lifecycle retention, CORS, S3-to-SQS notifications, and multipart uploads; SQS queue inspection, message lifecycle, visibility timeout behavior, delayed delivery, batch operations, queue configuration, dead-letter queues, managed redrive, FIFO ordering, duplicate suppression, purge, and queue deletion; SNS-to-SQS fan-out, resource policies, raw delivery, and subscription filtering; scheduled SQS delivery through a scoped IAM execution role; infrastructure-as-code ownership of S3 and SQS resources; public/private VPC routing; stateful security-group traffic controls; private S3 connectivity through a gateway endpoint; and private SQS connectivity through an HTTPS-only interface endpoint with private DNS.

Lab definitions and implementation notes live in [`buildinglabs.md`](./buildinglabs.md).

## Quickstart

These steps launch a local Floci environment and start the dashboard against it. They are written for macOS. The dashboard will likely work fine on Windows as well, but Windows has not been tested yet.

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) if you have not already.

Make sure Docker Desktop is running. You will also need `git`, `python3`, and `pip3` available in your shell.

Paste the following commands into your terminal one at a time, pressing Enter after each one.

Create a directory for your local Floci files:

```bash
mkdir -p floci
```

Change into that directory:

```bash
cd floci
```

Create the Docker Compose file:

```bash
cat <<EOF > docker-compose.yml
services:
  floci:
    image: floci/floci:latest
    pull_policy: always
    container_name: floci
    ports:
      # Main API Gateway port (All AWS API calls go here)
      - "4566:4566"
      # Port range for ElastiCache proxy (Redis/Valkey)
      - "6379-6399:6379-6399"
      # Port range for RDS proxy (PostgreSQL & MySQL)
      - "7001-7099:7001-7099"
    environment:
      # --- IAM ENFORCEMENT ENGINE ---
      # Evaluates inbound requests against identity policies, session policies,
      # and permission boundaries. Enforces Explicit Deny > Explicit Allow > Implicit Deny.
      - FLOCI_SERVICES_IAM_ENFORCEMENT_ENABLED=true
      - FLOCI_AUTH_VALIDATE_SIGNATURES=true

      # Tells Floci to use this hostname in returned URLs (e.g., SQS queue URLs).
      # Crucial if you add other app containers to this compose file later.
      - FLOCI_HOSTNAME=floci

      # Tells Floci which Docker network to attach spawned Lambdas/DBs to.
      # By default, Docker Compose names the network <directory-name>_default.
      - FLOCI_SERVICES_DOCKER_NETWORK=floci_default

      - FLOCI_SERVICES_LAMBDA_HOT_RELOAD_ENABLED=true

    volumes:
      # PERSISTENCE: This saves your IAM users so they survive 'floci down'
      - ./data:/app/data
      # Gives Floci access to spawn underlying containers (Lambda, RDS, etc.)
      - /var/run/docker.sock:/var/run/docker.sock

networks:
  default:
    name: floci_default
EOF
```

Launch the Compose file in detached mode:

```bash
docker compose up -d
```

Clone the dashboard repository:

```bash
git clone https://github.com/returnvalue/flocidashboard.git
```

Change into the dashboard directory:

```bash
cd flocidashboard
```

Run the remaining commands from the `flocidashboard` directory.

### Option 1: Use A Virtual Environment

This keeps the Python packages isolated to this project.

Create the virtual environment:

```bash
python3 -m venv .venv
```

Activate the virtual environment:

```bash
source .venv/bin/activate
```

Upgrade `pip` inside the virtual environment:

```bash
python3 -m pip install --upgrade pip
```

Install the dashboard requirements:

```bash
pip3 install -r requirements.txt
```

### Option 2: Install Without A Virtual Environment

This installs the packages into your current Python 3 environment.

Install the dashboard requirements:

```bash
pip3 install -r requirements.txt
```

The requirements install the latest available Django and boto3 releases.

Before starting Django, choose one local AWS credential setup.

For a fresh Floci clone, local `test/test` credentials are enough:

Set the Floci endpoint URL:

```bash
export AWS_ENDPOINT_URL=http://localhost:4566
```

Set the default AWS region:

```bash
export AWS_DEFAULT_REGION=us-east-1
```

Set the local AWS access key:

```bash
export AWS_ACCESS_KEY_ID=test
```

Set the local AWS secret key:

```bash
export AWS_SECRET_ACCESS_KEY=test
```

Or create and use your own AWS profile for Floci before running the dashboard:

Set your Floci AWS profile:

```bash
export AWS_PROFILE=floci-admin
```

Set the default AWS region:

```bash
export AWS_DEFAULT_REGION=us-east-1
```

Set the Floci endpoint URL:

```bash
export AWS_ENDPOINT_URL=http://localhost:4566
```

`FLOCI_AWS_ENDPOINT_URL` and `FLOCI_AWS_REGION` are also supported if you prefer Floci-specific names. When no explicit profile or credentials are visible to Django, the dashboard falls back to local `test/test` credentials so a fresh Floci install can still show service inventory.

Start the Django dev server:

```bash
python3 manage.py runserver 127.0.0.1:8000
```

Open `http://127.0.0.1:8000` in your browser.

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
- `dashboard/labs.py`: curated workflow lab definitions, approved runners, live-state verification, and reset behavior for IAM, S3, SQS, SNS, EventBridge Scheduler, CloudFormation, and EC2.
- `dashboard/templates/dashboard/service.html`: common service page shell. Interactive workbenches should be layered into this page while keeping the original read-only inventory visible.
- `dashboard/templates/dashboard/labs.html` and `dashboard/static/dashboard/labs.js`: shared workflow-lab UI and browser behavior.
- `dashboard/static/dashboard/service-console.js`: shared browser-side helpers for API calls, summary cards, read-only cards, toolbars, modals, formatting, and lower-right toasts.
- `dashboard/static/dashboard/dashboard.js`: generic read-only inventory rendering for service pages.
- Service-specific files such as `s3_api.py`, `s3_views.py`, `s3-console.js`, and `s3-console.css`, `iam_api.py`, `iam_views.py`, `iam-console.js`, and `iam-console.css`, `ec2_api.py`, `ec2_views.py`, `ec2-console.js`, and `ec2-console.css`, `cloudformation_api.py`, `cloudformation_views.py`, `cloudformation-console.js`, and `cloudformation-console.css`, `cognito_api.py`, `cognito_views.py`, `cognito-console.js`, and `cognito-console.css`, `rds_api.py`, `rds_views.py`, `rds-console.js`, and `rds-console.css`, `autoscaling_api.py`, `autoscaling_views.py`, `autoscaling-console.js`, and `autoscaling-console.css`, `elasticloadbalancing_api.py`, `elasticloadbalancing_views.py`, `elasticloadbalancing-console.js`, and `elasticloadbalancing-console.css`, `cloudfront_api.py`, `cloudfront_views.py`, `cloudfront-console.js`, and `cloudfront-console.css`, `cloudmap_api.py`, `cloudmap_views.py`, `cloudmap-console.js`, and `cloudmap-console.css`, `route53_api.py`, `route53_views.py`, `route53-console.js`, and `route53-console.css`, `acm_api.py`, `acm_views.py`, `acm-console.js`, and `acm-console.css`, `ecs_api.py`, `ecs_views.py`, `ecs-console.js`, and `ecs-console.css`, `ecr_api.py`, `ecr_views.py`, `ecr-console.js`, and `ecr-console.css`, `eks_api.py`, `eks_views.py`, `eks-console.js`, and `eks-console.css`, `elasticache_api.py`, `elasticache_views.py`, `elasticache-console.js`, and `elasticache-console.css`, `opensearch_api.py`, `opensearch_views.py`, `opensearch-console.js`, and `opensearch-console.css`, `athena_api.py`, `athena_views.py`, `athena-console.js`, and `athena-console.css`, or the equivalent files for SQS, SNS, Lambda, DynamoDB, CloudWatch Logs, Step Functions, EventBridge, API Gateway, AppSync, Kinesis, Secrets Manager, SSM Parameter Store, Backup, Firehose, Glue, Kafka, Neptune, SES, Transfer Family, Textract, Transcribe, CodeDeploy, CodeBuild, Bedrock Runtime, AppConfig, and Resource Groups Tagging: focused behavior for one service only.

Important conventions:

- Treat interactive workbenches as additive. Do not remove summary cards, anchor-link behavior, read-only inventory cards, supported-operation panels, or service notes.
- Treat labs as curated workflows rather than a browser terminal. The browser sends registered service/lab/step identifiers and never arbitrary shell commands.
- Derive lab completion from live Floci state whenever possible, and keep reset ownership explicit.
- Register service capabilities in `dashboard/services.py` before wiring service-specific UI.
- Use `dashboard/actions.py` helpers for JSON request parsing and normalized action errors.
- Use `ServiceConsole.toast()` for action feedback. Interactive success and failure messages should appear as lower-right toasts.
- Keep service-specific JavaScript focused on that service's workflow. Prefer shared helpers from `service-console.js` for common UI behavior.
- Keep destructive actions explicit. Add destructive action metadata with confirmation text.
- Add focused tests for registry metadata, page rendering, and each new action endpoint.

New service checklist:

- Add the service to `dashboard/services.py` with title, category, maturity, docs URL when available, tags, optional static assets, and action metadata if it has interactive workflows.
- Add or extend inventory loading in `dashboard/aws.py`, including a graceful empty/error shape for fresh local Floci instances.
- Add the API route and view in `dashboard/urls.py` and `dashboard/views.py`, or a focused `<service>_views.py` when the service needs action endpoints.
- Confirm the generic service page renders via `dashboard/templates/dashboard/service.html`; add service-specific JS/CSS only when the workflow needs it.
- Register homepage resource loading in the resource loader map when the service should appear on the home dashboard.
- Add focused tests for registry metadata, service page rendering, inventory/API behavior, and each action endpoint.
- Keep action metadata paths, route coverage, and action endpoint tests in sync; `ActionRegistryAuditTests` flags stale registry paths and missing action test coverage.
- Run JS syntax checks for any changed console assets; `dashboard.tests.StaticJavaScriptTests` also checks dashboard JS during the test suite.
- Update `ROADMAP.md` with the coverage note, maturity change, or follow-up gaps so contributors can see what changed and what remains.

Recommended checks before opening a PR:

```bash
python3 manage.py test dashboard
python3 manage.py test dashboard.tests.ActionRegistryAuditTests
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
http://127.0.0.1:8000/service/appsync/
http://127.0.0.1:8000/service/resourcegroupstagging/
http://127.0.0.1:8000/service/docdb/
http://127.0.0.1:8000/service/memorydb/
http://127.0.0.1:8000/service/codepipeline/
http://127.0.0.1:8000/service/s3vectors/
http://127.0.0.1:8000/service/iot/
http://127.0.0.1:8000/service/elasticbeanstalk/
http://127.0.0.1:8000/service/iam/labs/
http://127.0.0.1:8000/service/s3/labs/
http://127.0.0.1:8000/service/sqs/labs/
http://127.0.0.1:8000/service/sns/labs/
http://127.0.0.1:8000/service/scheduler/labs/
http://127.0.0.1:8000/service/cloudformation/labs/
http://127.0.0.1:8000/service/ec2/labs/
```

## Prompt For AI-Assisted Contributors

If you are using Codex, Claude, or another local coding assistant to add a dashboard feature, start with a prompt like this:

```text
You are contributing to the Floci Dashboard Django app. Before editing, read README.md, ROADMAP.md, dashboard/services.py, dashboard/actions.py, dashboard/templates/dashboard/service.html, dashboard/static/dashboard/service-console.js, and the closest existing workbench implementation. Good references are S3 for object browsing, IAM for identity and policy workflows, EC2 for local compute lifecycle workflows, SQS/SNS for messaging, Lambda for invoke/test workflows, DynamoDB for read-only data exploration, CloudWatch Logs for recent event viewing, Step Functions for execution workflows, EventBridge for event routing tests, EventBridge Pipes and Scheduler for event routing lifecycle workflows, API Gateway for request testing, AppSync for GraphQL management workflows, Kinesis for stream records, KMS for key workflows, Secrets Manager for secret value workflows, SSM for Parameter Store workflows, CloudFormation for stack workflows, Cognito for local auth workflows, AWS Config for compliance setup workflows, RDS for database lifecycle workflows, Auto Scaling for capacity workflows, ELB v2 for load-balancing topology workflows, CloudFront for CDN management workflows, AWS Cloud Map for service discovery workflows, Route 53 for DNS management workflows, ACM for certificate workflows, ECS for container orchestration workflows, ECR for image registry workflows, EKS for Kubernetes cluster and node group workflows, ElastiCache for cache/user/IAM auth workflows, OpenSearch for search domain workflows, Athena for SQL query workflows, Backup for plan/job workflows, Firehose for stream delivery, Glue for database/table catalog and schema registry workflows, Kafka for cluster bootstrap and broker endpoints, Neptune for graph cluster and instance lifecycle, SES for email identities and templates, Transfer Family for SFTP server and user management workflows, Textract and Transcribe for stub AI workflows, CodeDeploy and CodeBuild for local delivery workflows, Bedrock Runtime for stub model requests, AppConfig for configuration deployment and retrieval, Resource Groups Tagging for centralized tag discovery, and CloudTrail for read-only audit trail inventory.

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
