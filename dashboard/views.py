from dataclasses import asdict
from pathlib import Path
from typing import Optional

from botocore.exceptions import BotoCoreError, ClientError
from botocore.parsers import ResponseParserError
from django.conf import settings
from django.http import Http404, JsonResponse
from django.shortcuts import render
from django.views.decorators.cache import cache_control
from django.views.decorators.http import require_POST
from .aws import FlociClientFactory, acm_inventory, apigateway_inventory, appconfig_inventory, appsync_inventory, athena_inventory, autoscaling_inventory, backup_inventory, batch_inventory, bcmdataexports_inventory, bedrockruntime_inventory, cloudformation_inventory, cloudfront_inventory, cloudmap_inventory, cloudtrail_inventory, cloudwatch_inventory, codebuild_inventory, codedeploy_inventory, config_inventory, cognito_inventory, costexplorer_inventory, cur_inventory, docdb_inventory, dynamodb_inventory, ec2_inventory, ecr_inventory, ecs_inventory, eks_inventory, elasticache_inventory, elasticloadbalancing_inventory, emr_inventory, eventbridge_inventory, firehose_inventory, glue_inventory, iam_inventory, kafka_inventory, kinesis_inventory, kms_inventory, lambda_inventory, list_resources, neptune_inventory, opensearch_inventory, pipes_inventory, pricing_inventory, rds_inventory, rdsdata_inventory, resourcegroupstagging_inventory, route53_inventory, s3_inventory, scheduler_inventory, secretsmanager_inventory, ses_inventory, sns_inventory, sqs_inventory, ssm_inventory, stepfunctions_inventory, textract_inventory, transcribe_inventory, transfer_inventory, wafv2_inventory
from .labs import get_lab, lab_status, labs_for_service, reset_lab, run_lab_step
from .services import SERVICES, SERVICE_PAGES, get_service, services_payload


SERVICE_ALIASES = {
    'cognito-idp': 'cognito',
    'events': 'eventbridge',
    'logs': 'cloudwatch',
    'monitoring': 'cloudwatch',
    'servicediscovery': 'cloudmap',
    'states': 'stepfunctions',
}

HOME_SERVICE_ORDER = (
    'iam',
    's3',
    'ec2',
    'elasticloadbalancing',
    'route53',
    'cloudwatch',
    'rds',
    'docdb',
    'dynamodb',
    'lambda',
    'autoscaling',
    'sqs',
    'sns',
    'cloudfront',
    'cloudmap',
    'cloudtrail',
    'kms',
    'cloudformation',
    'apigateway',
    'ssm',
    'cognito',
    'ecs',
    'config',
    'elasticache',
    'secretsmanager',
    'acm',
    'athena',
    'eventbridge',
    'eks',
    'costexplorer',
    'backup',
    'ecr',
    'glue',
    'kinesis',
    'stepfunctions',
    'codedeploy',
    'codebuild',
    'opensearch',
    'cur',
    'firehose',
    'ses',
    'transfer',
    'textract',
    'transcribe',
    'bedrockruntime',
    'kafka',
    'resourcegroupstagging',
    'appconfig',
    'scheduler',
    'pipes',
    'neptune',
    'pricing',
    'bcmdataexports',
)

HOME_SERVICE_RANK = {key: index for index, key in enumerate(HOME_SERVICE_ORDER)}


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


def environment(request):
    return render(request, 'dashboard/environment.html')


def service_matrix(request):
    rows = []
    maturity_counts: dict[str, int] = {}
    interactive_count = 0

    for definition in sorted(
        SERVICES,
        key=lambda service_definition: (
            HOME_SERVICE_RANK.get(service_definition.key, len(HOME_SERVICE_RANK)),
            service_definition.title,
        ),
    ):
        service_data = definition.as_dict()
        action_count = len(definition.actions)
        maturity = service_data['maturity']
        maturity_counts[maturity] = maturity_counts.get(maturity, 0) + 1
        if definition.shared_console or action_count:
            interactive_count += 1

        rows.append({
            **service_data,
            'action_count': action_count,
            'maturity_label': maturity.replace('_', ' ').title(),
            'shared_console_label': 'Yes' if definition.shared_console else 'No',
            'tutorial_label': 'Yes' if definition.tutorial_available else 'No',
            'tags_label': ', '.join(service_data['tags']) or 'None',
        })

    context = {
        'interactive_count': interactive_count,
        'maturity_counts': [
            {
                'key': key,
                'label': key.replace('_', ' ').title(),
                'count': count,
            }
            for key, count in sorted(maturity_counts.items())
        ],
        'services': rows,
        'service_count': len(rows),
    }
    return render(request, 'dashboard/service_matrix.html', context)


def service_page(request, service_key: str):
    service_definition = get_service(service_key)
    if not service_definition:
        raise Http404('Service page not found')

    context = service_definition.page_context()
    static_assets = [
        asset
        for asset in [context.get('console_css'), context.get('console_js'), 'dashboard/service-console.js']
        if asset and (asset != 'dashboard/service-console.js' or context.get('shared_console'))
    ]
    asset_versions = []
    for asset in static_assets:
        asset_path = Path(settings.BASE_DIR) / 'dashboard' / 'static' / asset
        try:
            asset_versions.append(str(asset_path.stat().st_mtime_ns))
        except OSError:
            continue
    context['asset_version'] = '-'.join(asset_versions) or 'dev'

    return render(request, 'dashboard/service.html', {'service': context})


def service_labs(request, service_key: str):
    service_definition = get_service(service_key)
    if not service_definition:
        raise Http404('Service page not found')

    labs = labs_for_service(service_key)
    if not labs:
        raise Http404('Labs not found')
    requested_lab_key = request.GET.get('lab')
    active_lab = next(
        (lab for lab in labs if lab.get('key') == requested_lab_key),
        labs[0],
    )
    status = lab_status(service_key, active_lab['key'])
    step_statuses = status.get('steps', {})
    active_lab = {
        **active_lab,
        'steps': [
            {
                **step,
                'status': step_statuses.get(step.get('key'), {}),
            }
            for step in active_lab.get('steps', [])
        ],
    }

    return render(
        request,
        'dashboard/labs.html',
        {
            'service': service_definition.as_dict(),
            'labs': labs,
            'active_lab': active_lab,
            'lab_status': status,
            'lab_complete': status.get('complete'),
        },
    )


@require_POST
def lab_step_run(request, service_key: str, lab_key: str, step_key: str):
    if not get_lab(service_key, lab_key):
        raise Http404('Lab not found')

    try:
        return JsonResponse(run_lab_step(service_key, lab_key, step_key))
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=400)


@require_POST
def lab_reset(request, service_key: str, lab_key: str):
    if not get_lab(service_key, lab_key):
        raise Http404('Lab not found')

    try:
        return JsonResponse(reset_lab(service_key, lab_key))
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=400)


@cache_control(public=True, max_age=60)
def services(request):
    return JsonResponse(services_payload())


def identity(request):
    try:
        factory = FlociClientFactory()
        payload = {
            'endpoint_url': factory.endpoint_url,
            'region': factory.region,
            **factory.credential_context(),
        }
        payload['identity'] = factory.identity()
        return JsonResponse(payload)
    except (BotoCoreError, ClientError, ValueError) as exc:
        payload = locals().get('payload', {})
        factory = locals().get('factory')
        identity_hint = factory.local_identity_hint() if factory else None
        if identity_hint:
            payload['identity'] = identity_hint
            payload['identity_resolved'] = False
            payload['identity_error'] = str(exc)
            return JsonResponse(payload)
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


def docdb(request):
    try:
        return JsonResponse(docdb_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def cloudwatch(request):
    try:
        return JsonResponse(cloudwatch_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def cloudmap(request):
    try:
        return JsonResponse(cloudmap_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def cloudtrail(request):
    try:
        return JsonResponse(cloudtrail_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def config(request):
    try:
        return JsonResponse(config_inventory())
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


def appsync(request):
    try:
        return JsonResponse(appsync_inventory())
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


def emr(request):
    try:
        return JsonResponse(emr_inventory())
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


def batch(request):
    try:
        return JsonResponse(batch_inventory())
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


def cloudfront(request):
    try:
        return JsonResponse(cloudfront_inventory())
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


def rdsdata(request):
    try:
        return JsonResponse(rdsdata_inventory())
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


def wafv2(request):
    try:
        return JsonResponse(wafv2_inventory())
    except (BotoCoreError, ClientError, ValueError) as exc:
        return JsonResponse({'error': str(exc)}, status=502)


def resources(request):
    service_keys = selected_service_keys(request)
    try:
        return JsonResponse(
            {
                'resources': [asdict(result) for result in list_resources(service_keys)],
            }
        )
    except (BotoCoreError, ClientError, ResponseParserError, ValueError) as exc:
        return JsonResponse({'resources': [], 'error': str(exc)}, status=502)
