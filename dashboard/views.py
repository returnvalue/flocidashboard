from dataclasses import asdict

from botocore.exceptions import BotoCoreError, ClientError
from django.http import JsonResponse
from django.shortcuts import render

from .aws import FlociClientFactory, acm_inventory, apigateway_inventory, appconfig_inventory, athena_inventory, autoscaling_inventory, backup_inventory, bedrockruntime_inventory, cloudformation_inventory, cloudwatch_inventory, codebuild_inventory, codedeploy_inventory, cognito_inventory, dynamodb_inventory, ec2_inventory, ecr_inventory, ecs_inventory, eks_inventory, elasticache_inventory, elasticloadbalancing_inventory, eventbridge_inventory, firehose_inventory, glue_inventory, iam_inventory, kafka_inventory, kinesis_inventory, kms_inventory, lambda_inventory, list_resources, opensearch_inventory, pipes_inventory, rds_inventory, resourcegroupstagging_inventory, route53_inventory, s3_inventory, scheduler_inventory, secretsmanager_inventory, ses_inventory, sns_inventory, sqs_inventory, ssm_inventory, stepfunctions_inventory, transfer_inventory


def index(request):
    return render(request, 'dashboard/index.html')


def iam_service(request):
    return render(request, 'dashboard/iam.html')


def s3_service(request):
    return render(request, 'dashboard/s3.html')


def ec2_service(request):
    return render(request, 'dashboard/ec2.html')


def kms_service(request):
    return render(request, 'dashboard/kms.html')


def lambda_service(request):
    return render(request, 'dashboard/lambda.html')


def sqs_service(request):
    return render(request, 'dashboard/sqs.html')


def secretsmanager_service(request):
    return render(request, 'dashboard/secretsmanager.html')


def dynamodb_service(request):
    return render(request, 'dashboard/dynamodb.html')


def cloudwatch_service(request):
    return render(request, 'dashboard/cloudwatch.html')


def eventbridge_service(request):
    return render(request, 'dashboard/eventbridge.html')


def cognito_service(request):
    return render(request, 'dashboard/cognito.html')


def apigateway_service(request):
    return render(request, 'dashboard/apigateway.html')


def appconfig_service(request):
    return render(request, 'dashboard/appconfig.html')


def bedrockruntime_service(request):
    return render(request, 'dashboard/bedrockruntime.html')


def codebuild_service(request):
    return render(request, 'dashboard/codebuild.html')


def codedeploy_service(request):
    return render(request, 'dashboard/codedeploy.html')


def ecs_service(request):
    return render(request, 'dashboard/ecs.html')


def eks_service(request):
    return render(request, 'dashboard/eks.html')


def elasticache_service(request):
    return render(request, 'dashboard/elasticache.html')


def elasticloadbalancing_service(request):
    return render(request, 'dashboard/elasticloadbalancing.html')


def firehose_service(request):
    return render(request, 'dashboard/firehose.html')


def kinesis_service(request):
    return render(request, 'dashboard/kinesis.html')


def kafka_service(request):
    return render(request, 'dashboard/kafka.html')


def opensearch_service(request):
    return render(request, 'dashboard/opensearch.html')


def pipes_service(request):
    return render(request, 'dashboard/pipes.html')


def resourcegroupstagging_service(request):
    return render(request, 'dashboard/resourcegroupstagging.html')


def ssm_service(request):
    return render(request, 'dashboard/ssm.html')


def athena_service(request):
    return render(request, 'dashboard/athena.html')


def autoscaling_service(request):
    return render(request, 'dashboard/autoscaling.html')


def backup_service(request):
    return render(request, 'dashboard/backup.html')


def route53_service(request):
    return render(request, 'dashboard/route53.html')


def transfer_service(request):
    return render(request, 'dashboard/transfer.html')


def sns_service(request):
    return render(request, 'dashboard/sns.html')


def ses_service(request):
    return render(request, 'dashboard/ses.html')


def cloudformation_service(request):
    return render(request, 'dashboard/cloudformation.html')


def ecr_service(request):
    return render(request, 'dashboard/ecr.html')


def rds_service(request):
    return render(request, 'dashboard/rds.html')


def acm_service(request):
    return render(request, 'dashboard/acm.html')


def stepfunctions_service(request):
    return render(request, 'dashboard/stepfunctions.html')


def scheduler_service(request):
    return render(request, 'dashboard/scheduler.html')


def glue_service(request):
    return render(request, 'dashboard/glue.html')


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
