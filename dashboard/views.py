from dataclasses import asdict
from typing import Optional

from botocore.exceptions import BotoCoreError, ClientError
from django.http import Http404, JsonResponse
from django.shortcuts import render
from .aws import FlociClientFactory, acm_inventory, apigateway_inventory, appconfig_inventory, athena_inventory, autoscaling_inventory, backup_inventory, bcmdataexports_inventory, bedrockruntime_inventory, cloudformation_inventory, cloudwatch_inventory, codebuild_inventory, codedeploy_inventory, cognito_inventory, costexplorer_inventory, cur_inventory, dynamodb_inventory, ec2_inventory, ecr_inventory, ecs_inventory, eks_inventory, elasticache_inventory, elasticloadbalancing_inventory, eventbridge_inventory, firehose_inventory, glue_inventory, iam_inventory, kafka_inventory, kinesis_inventory, kms_inventory, lambda_inventory, list_resources, neptune_inventory, opensearch_inventory, pipes_inventory, pricing_inventory, rds_inventory, resourcegroupstagging_inventory, route53_inventory, s3_inventory, scheduler_inventory, secretsmanager_inventory, ses_inventory, sns_inventory, sqs_inventory, ssm_inventory, stepfunctions_inventory, textract_inventory, transcribe_inventory, transfer_inventory
from .services import SERVICE_PAGES, get_service, services_payload


SERVICE_ALIASES = {
    'cognito-idp': 'cognito',
    'events': 'eventbridge',
    'logs': 'cloudwatch',
    'monitoring': 'cloudwatch',
    'states': 'stepfunctions',
}


def selected_service_keys(request) -> Optional[set[str]]:
    raw_values = request.GET.getlist('services')
    if not raw_values:
        return None

    keys: set[str] = set()
    for raw_value in raw_values:
        for item in raw_value.split(','):
            key = SERVICE_ALIASES.get(item.strip(), item.strip())
            if get_service(key):
                keys.add(key)
    return keys


def index(request):
    return render(request, 'dashboard/index.html')


def service_page(request, service_key: str):
    service_definition = get_service(service_key)
    if not service_definition:
        raise Http404('Service page not found')

    return render(request, 'dashboard/service.html', {'service': service_definition.page_context()})


def services(request):
    return JsonResponse(services_payload())


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


def cur(request):
    try:
        return JsonResponse(cur_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def bcmdataexports(request):
    try:
        return JsonResponse(bcmdataexports_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def neptune(request):
    try:
        return JsonResponse(neptune_inventory())
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
    service_keys = selected_service_keys(request)
    return JsonResponse(
        {
            'resources': [asdict(result) for result in list_resources(service_keys)],
        }
    )
