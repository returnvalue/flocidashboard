from dataclasses import asdict

from botocore.exceptions import BotoCoreError, ClientError
from django.http import Http404, JsonResponse
from django.shortcuts import render
from .aws import FlociClientFactory, acm_inventory, apigateway_inventory, appconfig_inventory, athena_inventory, autoscaling_inventory, backup_inventory, bedrockruntime_inventory, cloudformation_inventory, cloudwatch_inventory, codebuild_inventory, codedeploy_inventory, cognito_inventory, costexplorer_inventory, dynamodb_inventory, ec2_inventory, ecr_inventory, ecs_inventory, eks_inventory, elasticache_inventory, elasticloadbalancing_inventory, eventbridge_inventory, firehose_inventory, glue_inventory, iam_inventory, kafka_inventory, kinesis_inventory, kms_inventory, lambda_inventory, list_resources, opensearch_inventory, pipes_inventory, pricing_inventory, rds_inventory, resourcegroupstagging_inventory, route53_inventory, s3_inventory, scheduler_inventory, secretsmanager_inventory, ses_inventory, sns_inventory, sqs_inventory, ssm_inventory, stepfunctions_inventory, textract_inventory, transcribe_inventory, transfer_inventory

SERVICE_PAGES = {
    'acm': {'title': 'ACM', 'eyebrow': 'Certificates and validation state'},
    'apigateway': {'title': 'API Gateway', 'eyebrow': 'REST and HTTP APIs'},
    'appconfig': {'title': 'AppConfig', 'eyebrow': 'Application configuration management'},
    'athena': {'title': 'Athena', 'eyebrow': 'SQL queries and workgroups'},
    'autoscaling': {'title': 'Auto Scaling', 'eyebrow': 'Groups, policies, and scaling activity'},
    'backup': {'title': 'Backup', 'eyebrow': 'Backup vaults, plans, jobs, and protected resources'},
    'bedrockruntime': {'title': 'Bedrock Runtime', 'eyebrow': 'Model runtime stub'},
    'cloudformation': {'title': 'CloudFormation', 'eyebrow': 'Stacks and change sets'},
    'cloudwatch': {'title': 'CloudWatch', 'eyebrow': 'Logs and metrics'},
    'codebuild': {'title': 'CodeBuild', 'eyebrow': 'Build projects and execution history'},
    'codedeploy': {'title': 'CodeDeploy', 'eyebrow': 'Deployment applications and history'},
    'cognito': {'title': 'Cognito', 'eyebrow': 'User pools and auth'},
    'costexplorer': {'title': 'Cost Explorer', 'eyebrow': 'Cost and usage dimensions'},
    'dynamodb': {'title': 'DynamoDB', 'eyebrow': 'NoSQL tables'},
    'ec2': {'title': 'EC2', 'eyebrow': 'Compute and networking'},
    'ecr': {'title': 'ECR', 'eyebrow': 'Repositories and OCI images'},
    'ecs': {'title': 'ECS', 'eyebrow': 'Clusters, tasks, and services'},
    'eks': {'title': 'EKS', 'eyebrow': 'Kubernetes control plane inventory'},
    'elasticache': {'title': 'ElastiCache', 'eyebrow': 'Cache clusters and replication groups'},
    'elasticloadbalancing': {'title': 'Elastic Load Balancing', 'eyebrow': 'Classic and v2 load balancers'},
    'eventbridge': {'title': 'EventBridge', 'eyebrow': 'Event buses and rules'},
    'firehose': {'title': 'Data Firehose', 'eyebrow': 'Delivery streams and destinations'},
    'glue': {'title': 'Glue', 'eyebrow': 'Data catalog metadata'},
    'iam': {'title': 'IAM', 'eyebrow': 'Identity and access management'},
    'kafka': {'title': 'MSK / Kafka', 'eyebrow': 'Managed Kafka clusters and configuration'},
    'kinesis': {'title': 'Kinesis', 'eyebrow': 'Streams, shards, and consumers'},
    'kms': {'title': 'KMS', 'eyebrow': 'Key management'},
    'lambda': {'title': 'Lambda', 'eyebrow': 'Functions and event sources'},
    'opensearch': {'title': 'OpenSearch', 'eyebrow': 'Search domains, packages, endpoints, and maintenance'},
    'pipes': {'title': 'EventBridge Pipes', 'eyebrow': 'EventBridge pipe sources, enrichment, targets, and state'},
    'pricing': {'title': 'AWS Price List', 'eyebrow': 'Pricing services, attributes, and price lists'},
    'rds': {'title': 'RDS', 'eyebrow': 'Database instances and proxy endpoints'},
    'resourcegroupstagging': {'title': 'Resource Groups Tagging', 'eyebrow': 'Tagged resources, tag keys, tag values, and compliance'},
    'route53': {'title': 'Route 53', 'eyebrow': 'Hosted zones, records, health checks, and DNS policies'},
    's3': {'title': 'S3', 'eyebrow': 'Object storage'},
    'scheduler': {'title': 'EventBridge Scheduler', 'eyebrow': 'Schedule groups and targets'},
    'secretsmanager': {'title': 'Secrets Manager', 'eyebrow': 'Secret storage'},
    'ses': {'title': 'SES', 'eyebrow': 'Email identities and captured messages'},
    'sns': {'title': 'SNS', 'eyebrow': 'Topics and subscriptions'},
    'sqs': {'title': 'SQS', 'eyebrow': 'Message queues'},
    'ssm': {'title': 'SSM', 'eyebrow': 'Parameter Store, documents, sessions, automation, and managed instances'},
    'stepfunctions': {'title': 'Step Functions', 'eyebrow': 'State machines and executions'},
    'textract': {'title': 'Textract', 'eyebrow': 'Document analysis, OCR, adapters, and async jobs'},
    'transcribe': {'title': 'Transcribe', 'eyebrow': 'Speech transcription jobs and vocabularies'},
    'transfer': {'title': 'Transfer Family', 'eyebrow': 'SFTP, FTPS, FTP, and AS2 transfer resources'},
}


def index(request):
    return render(request, 'dashboard/index.html')


def service_page(request, service_key: str):
    if service_key not in SERVICE_PAGES:
        raise Http404('Service page not found')

    service = {'key': service_key, **SERVICE_PAGES[service_key]}
    template = 'dashboard/service_s3.html' if service_key == 's3' else 'dashboard/service.html'
    return render(request, template, {'service': service})


def identity(request):
    factory = FlociClientFactory()
    payload = {
        'endpoint_url': factory.endpoint_url,
        'region': factory.region,
        'profile': factory.profile,
    }

    try:
        payload['identity'] = factory.identity()
        return JsonResponse(payload)
    except (BotoCoreError, ClientError, ValueError) as exc:
        payload['error'] = str(exc)
        return JsonResponse(payload, status=502)


def health(request):
    try:
        return JsonResponse(FlociClientFactory().health())
    except ValueError as exc:
        return JsonResponse({'ok': False, 'error': str(exc)}, status=400)


def iam(request):
    try:
        return JsonResponse(iam_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def s3(request):
    try:
        return JsonResponse(s3_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def ec2(request):
    try:
        return JsonResponse(ec2_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def kms(request):
    try:
        return JsonResponse(kms_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def lambda_(request):
    try:
        return JsonResponse(lambda_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def sqs(request):
    try:
        return JsonResponse(sqs_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def secretsmanager(request):
    try:
        return JsonResponse(secretsmanager_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def dynamodb(request):
    try:
        return JsonResponse(dynamodb_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def cloudwatch(request):
    try:
        return JsonResponse(cloudwatch_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def eventbridge(request):
    try:
        return JsonResponse(eventbridge_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def cognito(request):
    try:
        return JsonResponse(cognito_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def apigateway(request):
    try:
        return JsonResponse(apigateway_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def appconfig(request):
    try:
        return JsonResponse(appconfig_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def bedrockruntime(request):
    try:
        return JsonResponse(bedrockruntime_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def codebuild(request):
    try:
        return JsonResponse(codebuild_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def codedeploy(request):
    try:
        return JsonResponse(codedeploy_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def ecs(request):
    try:
        return JsonResponse(ecs_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def eks(request):
    try:
        return JsonResponse(eks_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def elasticache(request):
    try:
        return JsonResponse(elasticache_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def elasticloadbalancing(request):
    try:
        return JsonResponse(elasticloadbalancing_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def firehose(request):
    try:
        return JsonResponse(firehose_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def kinesis(request):
    try:
        return JsonResponse(kinesis_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def kafka(request):
    try:
        return JsonResponse(kafka_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def opensearch(request):
    try:
        return JsonResponse(opensearch_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def pipes(request):
    try:
        return JsonResponse(pipes_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def pricing(request):
    try:
        return JsonResponse(pricing_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def costexplorer(request):
    try:
        return JsonResponse(costexplorer_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def resourcegroupstagging(request):
    try:
        return JsonResponse(resourcegroupstagging_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def ssm(request):
    try:
        return JsonResponse(ssm_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def athena(request):
    try:
        return JsonResponse(athena_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def autoscaling(request):
    try:
        return JsonResponse(autoscaling_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def backup(request):
    try:
        return JsonResponse(backup_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def route53(request):
    try:
        return JsonResponse(route53_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def transfer(request):
    try:
        return JsonResponse(transfer_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def sns(request):
    try:
        return JsonResponse(sns_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def ses(request):
    try:
        return JsonResponse(ses_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def cloudformation(request):
    try:
        return JsonResponse(cloudformation_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def ecr(request):
    try:
        return JsonResponse(ecr_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def rds(request):
    try:
        return JsonResponse(rds_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def acm(request):
    try:
        return JsonResponse(acm_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def stepfunctions(request):
    try:
        return JsonResponse(stepfunctions_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def scheduler(request):
    try:
        return JsonResponse(scheduler_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def textract(request):
    try:
        return JsonResponse(textract_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def transcribe(request):
    try:
        return JsonResponse(transcribe_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def glue(request):
    try:
        return JsonResponse(glue_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def resources(request):
    return JsonResponse(
        {
            'resources': [asdict(result) for result in list_resources()],
        }
    )
