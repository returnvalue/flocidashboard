import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

from botocore.exceptions import ClientError, NoCredentialsError, ProfileNotFound
from botocore.parsers import ResponseParserError
from django.test import SimpleTestCase
from django.urls import Resolver404, resolve, reverse

from .actions import error_payload, error_status, handle_action_error, json_error
from .aws import FlociClientFactory, ResourceResult, cloudformation_inventory, ec2_inventory, list_resources as aws_list_resources, rds_inventory
from .services import SERVICE_PAGES, SERVICE_REGISTRY, SERVICES


ACTION_TEST_REFERENCE_GAP_BASELINE = frozenset()


class StaticJavaScriptTests(SimpleTestCase):
    def test_dashboard_javascript_files_are_valid(self):
        node = shutil.which('node')
        if not node:
            self.skipTest('Node.js is required for JavaScript syntax checks.')

        static_dir = Path(__file__).resolve().parent / 'static' / 'dashboard'
        scripts = sorted(static_dir.glob('*.js'))
        self.assertTrue(scripts)

        for script in scripts:
            with self.subTest(script=script.name):
                result = subprocess.run(
                    [node, '--check', str(script)],
                    check=False,
                    capture_output=True,
                    text=True,
                )
                self.assertEqual(result.returncode, 0, result.stderr or result.stdout)


class ActionRegistryAuditTests(SimpleTestCase):
    placeholder_pattern = re.compile(r'\{[^/{}]+\}')

    @classmethod
    def sample_action_path(cls, path):
        return cls.placeholder_pattern.sub('sample', path)

    @staticmethod
    def action_test_route_references():
        route_names = set()
        for test_file in Path(__file__).resolve().parent.glob('tests*.py'):
            text = test_file.read_text()
            route_names.update(re.findall(r"reverse\(\s*['\"]dashboard:([^'\"]+)", text))
        return route_names

    def test_action_metadata_paths_resolve_to_dashboard_routes(self):
        missing_routes = []

        for service in SERVICES:
            for action in service.actions:
                with self.subTest(service=service.key, action=action.name):
                    try:
                        match = resolve(self.sample_action_path(action.path))
                    except Resolver404:
                        missing_routes.append((service.key, action.name, action.method, action.path))
                        continue
                    self.assertEqual(match.app_name, 'dashboard')

        self.assertEqual(missing_routes, [])

    def test_action_metadata_has_endpoint_test_references(self):
        route_names = self.action_test_route_references()
        missing_references = set()

        for service in SERVICES:
            for action in service.actions:
                match = resolve(self.sample_action_path(action.path))
                if match.url_name not in route_names:
                    missing_references.add((service.key, action.name, match.url_name))

        self.assertEqual(
            missing_references,
            ACTION_TEST_REFERENCE_GAP_BASELINE,
            'Action endpoint test coverage changed. Add tests for new gaps, or remove entries from '
            'ACTION_TEST_REFERENCE_GAP_BASELINE when a historical gap is covered.',
        )

    def test_destructive_action_metadata_requires_confirm_text(self):
        missing_confirmations = [
            (service.key, action.name)
            for service in SERVICES
            for action in service.actions
            if action.safety == 'destructive' and not action.confirm
        ]

        self.assertEqual(missing_confirmations, [])


class DashboardTemplateTests(SimpleTestCase):
    def test_home_page_renders_dashboard_shell(self):
        response = self.client.get(reverse('dashboard:index'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<title>Floci Dashboard</title>', html=True)
        self.assertContains(response, 'id="service-grid"')
        self.assertContains(response, reverse('dashboard:environment'))
        self.assertContains(response, reverse('dashboard:service-matrix'))
        self.assertContains(response, 'dashboard/styles.css')
        self.assertContains(response, 'dashboard/dashboard.js')

    def test_environment_page_renders_diagnostics_shell(self):
        response = self.client.get(reverse('dashboard:environment'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<title>Environment - Floci Dashboard</title>', html=True)
        self.assertContains(response, '<h1>Environment</h1>', html=True)
        self.assertContains(response, 'id="environment-refresh"')
        self.assertContains(response, 'id="environment-state"')
        self.assertContains(response, 'id="environment-endpoint"')
        self.assertContains(response, 'id="environment-identity-arn"')
        self.assertContains(response, reverse('dashboard:service-matrix'))
        self.assertContains(response, 'dashboard/dashboard.js')

    def test_service_matrix_renders_registry_coverage(self):
        response = self.client.get(reverse('dashboard:service-matrix'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<title>Service Matrix - Floci Dashboard</title>', html=True)
        self.assertContains(response, 'Service Matrix')
        self.assertContains(response, f'{len(SERVICES)} registered services')
        self.assertContains(response, 'S3')
        self.assertContains(response, '/api/s3/')
        self.assertContains(response, 'href="/service/s3/"')
        self.assertContains(response, 'Interactive Workbench')
        self.assertContains(response, 'dashboard/s3-console.js', count=0)
        self.assertNotContains(response, '<th scope="col">Page</th>', html=True)
        content = response.content.decode()
        self.assertLess(content.index('href="/service/iam/"'), content.index('href="/service/s3/"'))

    def test_all_service_pages_render(self):
        for key, service in SERVICE_PAGES.items():
            with self.subTest(service=key):
                response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': key}))

                self.assertEqual(response.status_code, 200)
                self.assertContains(response, f'<title>{service["title"]} - Floci Dashboard</title>', html=True)
                self.assertContains(response, f'<h1>{service["title"]}</h1>', html=True)
                self.assertContains(response, service['eyebrow'])
                self.assertContains(response, 'dashboard/styles.css')
                self.assertContains(response, 'dashboard/dashboard.js')
                if key == 's3':
                    self.assertContains(response, 'id="s3-loaded-at"')
                    self.assertContains(response, 'id="s3-summary"')
                    self.assertContains(response, 'id="s3-console-root"')
                    self.assertContains(response, 'id="s3-readonly-grid"')
                    self.assertContains(response, 'dashboard/service-console.js')
                    self.assertContains(response, 'dashboard/s3-console.js')
                elif key == 'iam':
                    self.assertContains(response, 'id="iam-loaded-at"')
                    self.assertContains(response, 'id="iam-summary"')
                    self.assertContains(response, 'id="iam-console-root"')
                    self.assertContains(response, 'id="iam-grid"')
                    self.assertContains(response, 'dashboard/service-console.js')
                    self.assertContains(response, 'dashboard/iam-console.js')
                elif key == 'stepfunctions':
                    self.assertContains(response, 'id="stepfunctions-loaded-at"')
                    self.assertContains(response, 'id="stepfunctions-summary"')
                    self.assertContains(response, 'id="stepfunctions-console-root"')
                    self.assertContains(response, 'id="stepfunctions-grid"')
                    self.assertContains(response, 'dashboard/service-console.js')
                    self.assertContains(response, 'dashboard/stepfunctions-console.js')
                elif key == 'cloudformation':
                    self.assertContains(response, 'id="cloudformation-loaded-at"')
                    self.assertContains(response, 'id="cloudformation-summary"')
                    self.assertContains(response, 'id="cloudformation-console-root"')
                    self.assertContains(response, 'id="cloudformation-grid"')
                    self.assertContains(response, 'dashboard/service-console.js')
                    self.assertContains(response, 'dashboard/cloudformation-console.js')
                elif key == 'cognito':
                    self.assertContains(response, 'id="cognito-loaded-at"')
                    self.assertContains(response, 'id="cognito-summary"')
                    self.assertContains(response, 'id="cognito-console-root"')
                    self.assertContains(response, 'id="cognito-grid"')
                    self.assertContains(response, 'dashboard/service-console.js')
                    self.assertContains(response, 'dashboard/cognito-console.js')
                elif key == 'eventbridge':
                    self.assertContains(response, 'id="eventbridge-loaded-at"')
                    self.assertContains(response, 'id="eventbridge-summary"')
                    self.assertContains(response, 'id="eventbridge-console-root"')
                    self.assertContains(response, 'id="eventbridge-grid"')
                    self.assertContains(response, 'dashboard/service-console.js')
                    self.assertContains(response, 'dashboard/eventbridge-console.js')
                elif key == 'ec2':
                    self.assertContains(response, 'id="ec2-loaded-at"')
                    self.assertContains(response, 'id="ec2-summary"')
                    self.assertContains(response, 'id="ec2-console-root"')
                    self.assertContains(response, 'id="ec2-grid"')
                    self.assertContains(response, 'dashboard/service-console.js')
                    self.assertContains(response, 'dashboard/ec2-console.js')
                elif key == 'apigateway':
                    self.assertContains(response, 'id="apigateway-loaded-at"')
                    self.assertContains(response, 'id="apigateway-summary"')
                    self.assertContains(response, 'id="apigateway-console-root"')
                    self.assertContains(response, 'id="apigateway-grid"')
                    self.assertContains(response, 'dashboard/service-console.js')
                    self.assertContains(response, 'dashboard/apigateway-console.js')
                elif key == 'kinesis':
                    self.assertContains(response, 'id="kinesis-loaded-at"')
                    self.assertContains(response, 'id="kinesis-summary"')
                    self.assertContains(response, 'id="kinesis-console-root"')
                    self.assertContains(response, 'id="kinesis-grid"')
                    self.assertContains(response, 'dashboard/service-console.js')
                    self.assertContains(response, 'dashboard/kinesis-console.js')
                elif key == 'secretsmanager':
                    self.assertContains(response, 'id="secretsmanager-loaded-at"')
                    self.assertContains(response, 'id="secretsmanager-summary"')
                    self.assertContains(response, 'id="secretsmanager-console-root"')
                    self.assertContains(response, 'id="secretsmanager-grid"')
                    self.assertContains(response, 'dashboard/service-console.js')
                    self.assertContains(response, 'dashboard/secretsmanager-console.js')
                elif key == 'ssm':
                    self.assertContains(response, 'id="ssm-loaded-at"')
                    self.assertContains(response, 'id="ssm-summary"')
                    self.assertContains(response, 'id="ssm-console-root"')
                    self.assertContains(response, 'id="ssm-grid"')
                    self.assertContains(response, 'dashboard/service-console.js')
                    self.assertContains(response, 'dashboard/ssm-console.js')
                elif key == 'rds':
                    self.assertContains(response, 'id="rds-loaded-at"')
                    self.assertContains(response, 'id="rds-summary"')
                    self.assertContains(response, 'id="rds-console-root"')
                    self.assertContains(response, 'id="rds-grid"')
                    self.assertContains(response, 'dashboard/service-console.js')
                    self.assertContains(response, 'dashboard/rds-console.js')
                elif key == 'autoscaling':
                    self.assertContains(response, 'id="autoscaling-loaded-at"')
                    self.assertContains(response, 'id="autoscaling-summary"')
                    self.assertContains(response, 'id="autoscaling-console-root"')
                    self.assertContains(response, 'id="autoscaling-grid"')
                    self.assertContains(response, 'dashboard/service-console.js')
                    self.assertContains(response, 'dashboard/autoscaling-console.js')
                elif key == 'elasticloadbalancing':
                    self.assertContains(response, 'id="elasticloadbalancing-loaded-at"')
                    self.assertContains(response, 'id="elasticloadbalancing-summary"')
                    self.assertContains(response, 'id="elasticloadbalancing-console-root"')
                    self.assertContains(response, 'id="elasticloadbalancing-grid"')
                    self.assertContains(response, 'dashboard/service-console.js')
                    self.assertContains(response, 'dashboard/elasticloadbalancing-console.js')
                else:
                    self.assertContains(response, f'id="{key}-loaded-at"')
                    self.assertContains(response, f'id="{key}-summary"')
                    self.assertContains(response, f'id="{key}-grid"')

    def test_unknown_service_page_404s(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'not-a-service'}))

        self.assertEqual(response.status_code, 404)


class ActionErrorTests(SimpleTestCase):
    def test_value_error_payload_includes_operation_context(self):
        response = handle_action_error(ValueError('Name is required'), service='sqs', operation='create_queue')

        self.assertEqual(response.status_code, 400)
        payload = json.loads(response.content)
        self.assertFalse(payload['ok'])
        self.assertEqual(payload['error'], 'Name is required')
        self.assertEqual(payload['service'], 'sqs')
        self.assertEqual(payload['operation'], 'create_queue')
        self.assertEqual(payload['operation_label'], 'Create queue')
        self.assertEqual(payload['type'], 'ValueError')
        self.assertEqual(payload['status'], 400)

    def test_client_error_status_mapping_matches_common_aws_shapes(self):
        missing = ClientError({'Error': {'Code': 'ResourceNotFoundException', 'Message': 'Missing'}}, 'DescribeThing')
        invalid = ClientError({'Error': {'Code': 'ValidationException', 'Message': 'Bad input'}}, 'CreateThing')
        denied = ClientError({'Error': {'Code': 'AccessDeniedException', 'Message': 'Nope'}}, 'CreateThing')
        throttled = ClientError({'Error': {'Code': 'ThrottlingException', 'Message': 'Slow down'}}, 'CreateThing')

        self.assertEqual(error_status(missing), 404)
        self.assertEqual(error_status(invalid), 400)
        self.assertEqual(error_status(denied), 403)
        self.assertEqual(error_status(throttled), 429)

    def test_client_error_payload_prefers_aws_error_message_and_code(self):
        exc = ClientError({'Error': {'Code': 'ValidationException', 'Message': 'Bad input'}}, 'CreateThing')

        payload = error_payload(exc, service='glue', operation='create_table')

        self.assertFalse(payload['ok'])
        self.assertEqual(payload['error'], 'Bad input')
        self.assertEqual(payload['code'], 'ValidationException')
        self.assertEqual(payload['operation_label'], 'Create table')

    def test_json_error_uses_normalized_payload_shape(self):
        response = json_error('Invalid key', service='s3', operation='upload_object')

        self.assertEqual(response.status_code, 400)
        payload = json.loads(response.content)
        self.assertFalse(payload['ok'])
        self.assertEqual(payload['error'], 'Invalid key')
        self.assertEqual(payload['service'], 's3')
        self.assertEqual(payload['operation'], 'upload_object')
        self.assertEqual(payload['operation_label'], 'Upload object')
        self.assertEqual(payload['status'], 400)


class ServiceRegistryApiTests(SimpleTestCase):
    def test_services_api_exposes_registry_metadata(self):
        response = self.client.get(reverse('dashboard:services'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        services = {service['key']: service for service in payload['services']}
        self.assertEqual(len(services), len(SERVICES))
        self.assertIn('interactive_workbench', payload['maturity_levels'])
        self.assertEqual(services['s3']['maturity'], 'interactive_workbench')
        self.assertTrue(services['s3']['shared_console'])
        self.assertEqual(services['s3']['console_js'], 'dashboard/s3-console.js')
        s3_actions = {action['name']: action for action in services['s3']['actions']}
        self.assertEqual(s3_actions['create_bucket']['method'], 'POST')
        self.assertEqual(s3_actions['delete_bucket']['safety'], 'destructive')
        self.assertEqual(s3_actions['upload_object']['fields'][1]['field_type'], 'file')
        self.assertEqual(services['sqs']['maturity'], 'interactive_workbench')
        self.assertEqual(services['sqs']['console_js'], 'dashboard/sqs-console.js')
        sqs_actions = {action['name']: action for action in services['sqs']['actions']}
        self.assertEqual(sqs_actions['send_message']['method'], 'POST')
        self.assertEqual(sqs_actions['receive_messages']['safety'], 'safe')
        self.assertEqual(sqs_actions['purge_queue']['safety'], 'destructive')
        self.assertEqual(services['sns']['maturity'], 'interactive_workbench')
        self.assertTrue(services['sns']['shared_console'])
        self.assertEqual(services['sns']['console_js'], 'dashboard/sns-console.js')
        sns_actions = {action['name']: action for action in services['sns']['actions']}
        self.assertEqual(sns_actions['publish_message']['method'], 'POST')
        self.assertEqual(sns_actions['publish_message']['fields'][1]['field_type'], 'textarea')
        self.assertEqual(services['lambda']['maturity'], 'interactive_workbench')
        self.assertEqual(services['lambda']['console_js'], 'dashboard/lambda-console.js')
        lambda_actions = {action['name']: action for action in services['lambda']['actions']}
        self.assertEqual(lambda_actions['invoke_function']['method'], 'POST')
        self.assertEqual(lambda_actions['invoke_function']['kind'], 'execute')
        self.assertEqual(services['iam']['maturity'], 'interactive_workbench')
        self.assertEqual(services['iam']['console_js'], 'dashboard/iam-console.js')
        iam_actions = {action['name']: action for action in services['iam']['actions']}
        self.assertEqual(iam_actions['create_access_key']['kind'], 'create')
        self.assertEqual(iam_actions['assume_role']['kind'], 'execute')
        self.assertEqual(iam_actions['delete_access_key']['safety'], 'destructive')
        self.assertEqual(iam_actions['put_inline_policy']['fields'][1]['field_type'], 'textarea')
        self.assertEqual(services['dynamodb']['maturity'], 'interactive_workbench')
        self.assertEqual(services['dynamodb']['console_js'], 'dashboard/dynamodb-console.js')
        dynamodb_actions = {action['name']: action for action in services['dynamodb']['actions']}
        self.assertEqual(dynamodb_actions['scan_table']['safety'], 'safe')
        self.assertEqual(dynamodb_actions['execute_select_statement']['fields'][0]['field_type'], 'textarea')
        self.assertEqual(services['cloudwatch']['maturity'], 'interactive_workbench')
        self.assertEqual(services['cloudwatch']['console_js'], 'dashboard/cloudwatch-console.js')
        cloudwatch_actions = {action['name']: action for action in services['cloudwatch']['actions']}
        self.assertEqual(cloudwatch_actions['list_log_streams']['safety'], 'safe')
        self.assertEqual(cloudwatch_actions['get_log_events']['fields'][1]['name'], 'log_stream_name')
        self.assertEqual(services['stepfunctions']['maturity'], 'interactive_workbench')
        self.assertEqual(services['stepfunctions']['console_js'], 'dashboard/stepfunctions-console.js')
        stepfunctions_actions = {action['name']: action for action in services['stepfunctions']['actions']}
        self.assertEqual(stepfunctions_actions['start_execution']['kind'], 'execute')
        self.assertEqual(stepfunctions_actions['start_execution']['fields'][2]['field_type'], 'textarea')
        self.assertEqual(stepfunctions_actions['stop_execution']['safety'], 'destructive')
        self.assertEqual(services['cloudformation']['maturity'], 'interactive_workbench')
        self.assertEqual(services['cloudformation']['console_js'], 'dashboard/cloudformation-console.js')
        cloudformation_actions = {action['name']: action for action in services['cloudformation']['actions']}
        self.assertEqual(cloudformation_actions['validate_template']['safety'], 'safe')
        self.assertEqual(cloudformation_actions['create_stack']['fields'][1]['field_type'], 'textarea')
        self.assertEqual(cloudformation_actions['delete_stack']['safety'], 'destructive')
        self.assertEqual(cloudformation_actions['execute_change_set']['kind'], 'execute')
        self.assertEqual(services['cognito']['maturity'], 'interactive_workbench')
        self.assertEqual(services['cognito']['console_js'], 'dashboard/cognito-console.js')
        cognito_actions = {action['name']: action for action in services['cognito']['actions']}
        self.assertEqual(cognito_actions['create_user_pool']['kind'], 'create')
        self.assertEqual(cognito_actions['admin_create_user']['fields'][2]['field_type'], 'object')
        self.assertEqual(cognito_actions['admin_delete_user']['safety'], 'destructive')
        self.assertEqual(cognito_actions['initiate_auth']['safety'], 'safe')
        self.assertEqual(cognito_actions['oauth_client_credentials']['kind'], 'execute')
        self.assertEqual(services['eventbridge']['maturity'], 'interactive_workbench')
        self.assertEqual(services['eventbridge']['console_js'], 'dashboard/eventbridge-console.js')
        eventbridge_actions = {action['name']: action for action in services['eventbridge']['actions']}
        self.assertEqual(eventbridge_actions['put_event']['method'], 'POST')
        self.assertEqual(eventbridge_actions['put_event']['kind'], 'execute')
        self.assertEqual(eventbridge_actions['put_event']['fields'][3]['field_type'], 'textarea')
        self.assertEqual(services['apigateway']['maturity'], 'interactive_workbench')
        self.assertEqual(services['apigateway']['console_js'], 'dashboard/apigateway-console.js')
        apigateway_actions = {action['name']: action for action in services['apigateway']['actions']}
        self.assertEqual(apigateway_actions['test_request']['method'], 'POST')
        self.assertEqual(apigateway_actions['test_request']['safety'], 'safe')
        self.assertEqual(apigateway_actions['test_request']['fields'][7]['field_type'], 'textarea')
        self.assertEqual(services['kinesis']['maturity'], 'interactive_workbench')
        self.assertEqual(services['kinesis']['console_js'], 'dashboard/kinesis-console.js')
        kinesis_actions = {action['name']: action for action in services['kinesis']['actions']}
        self.assertEqual(kinesis_actions['create_stream']['kind'], 'create')
        self.assertEqual(kinesis_actions['put_record']['fields'][1]['field_type'], 'textarea')
        self.assertEqual(kinesis_actions['get_records']['safety'], 'safe')
        self.assertEqual(services['secretsmanager']['maturity'], 'interactive_workbench')
        self.assertEqual(services['secretsmanager']['console_js'], 'dashboard/secretsmanager-console.js')
        secrets_actions = {action['name']: action for action in services['secretsmanager']['actions']}
        self.assertEqual(secrets_actions['create_secret']['fields'][1]['field_type'], 'textarea')
        self.assertEqual(secrets_actions['get_secret_value']['safety'], 'safe')
        self.assertEqual(secrets_actions['delete_secret']['safety'], 'destructive')
        self.assertEqual(services['ssm']['maturity'], 'interactive_workbench')
        self.assertEqual(services['ssm']['console_js'], 'dashboard/ssm-console.js')
        ssm_actions = {action['name']: action for action in services['ssm']['actions']}
        self.assertEqual(ssm_actions['put_parameter']['fields'][2]['field_type'], 'textarea')
        self.assertEqual(ssm_actions['get_parameter']['safety'], 'safe')
        self.assertEqual(ssm_actions['delete_parameter']['safety'], 'destructive')
        self.assertEqual(services['ec2']['maturity'], 'interactive_workbench')
        self.assertEqual(services['ec2']['console_js'], 'dashboard/ec2-console.js')
        ec2_actions = {action['name']: action for action in services['ec2']['actions']}
        self.assertEqual(ec2_actions['run_instances']['kind'], 'create')
        self.assertEqual(ec2_actions['run_instances']['fields'][5]['field_type'], 'textarea')
        self.assertEqual(ec2_actions['terminate_instance']['safety'], 'destructive')
        self.assertEqual(ec2_actions['import_key_pair']['fields'][1]['field_type'], 'textarea')
        self.assertEqual(services['rds']['maturity'], 'interactive_workbench')
        self.assertEqual(services['rds']['console_js'], 'dashboard/rds-console.js')
        rds_actions = {action['name']: action for action in services['rds']['actions']}
        self.assertEqual(rds_actions['create_db_instance']['kind'], 'create')
        self.assertEqual(rds_actions['create_db_instance']['fields'][4]['field_type'], 'number')
        self.assertEqual(rds_actions['reboot_db_instance']['kind'], 'execute')
        self.assertEqual(rds_actions['delete_db_instance']['safety'], 'destructive')
        self.assertEqual(rds_actions['create_db_parameter_group']['fields'][2]['name'], 'description')
        self.assertEqual(services['autoscaling']['maturity'], 'interactive_workbench')
        self.assertEqual(services['autoscaling']['console_js'], 'dashboard/autoscaling-console.js')
        autoscaling_actions = {action['name']: action for action in services['autoscaling']['actions']}
        self.assertEqual(autoscaling_actions['create_launch_configuration']['fields'][5]['field_type'], 'textarea')
        self.assertEqual(autoscaling_actions['create_auto_scaling_group']['fields'][2]['field_type'], 'number')
        self.assertEqual(autoscaling_actions['set_desired_capacity']['kind'], 'execute')
        self.assertEqual(autoscaling_actions['detach_instances']['safety'], 'destructive')
        self.assertEqual(autoscaling_actions['terminate_instance']['safety'], 'destructive')
        self.assertEqual(services['elasticloadbalancing']['maturity'], 'interactive_workbench')
        self.assertEqual(services['elasticloadbalancing']['console_js'], 'dashboard/elasticloadbalancing-console.js')
        elbv2_actions = {action['name']: action for action in services['elasticloadbalancing']['actions']}
        self.assertEqual(elbv2_actions['create_load_balancer']['kind'], 'create')
        self.assertEqual(elbv2_actions['create_target_group']['fields'][2]['field_type'], 'number')
        self.assertEqual(elbv2_actions['register_targets']['fields'][0]['field_type'], 'array')
        self.assertEqual(elbv2_actions['delete_load_balancer']['safety'], 'destructive')
        self.assertEqual(elbv2_actions['delete_rule']['safety'], 'destructive')
        self.assertEqual(services['eks']['maturity'], 'interactive_workbench')
        self.assertEqual(services['eks']['console_js'], 'dashboard/eks-console.js')
        eks_actions = {action['name']: action for action in services['eks']['actions']}
        self.assertEqual(eks_actions['create_cluster']['fields'][1]['name'], 'role_arn')
        self.assertEqual(eks_actions['delete_cluster']['safety'], 'destructive')
        self.assertEqual(eks_actions['list_tags_for_resource']['safety'], 'safe')
        self.assertEqual(services['elasticache']['maturity'], 'interactive_workbench')
        self.assertEqual(services['elasticache']['console_js'], 'dashboard/elasticache-console.js')
        elasticache_actions = {action['name']: action for action in services['elasticache']['actions']}
        self.assertEqual(elasticache_actions['create_replication_group']['kind'], 'create')
        self.assertEqual(elasticache_actions['delete_replication_group']['safety'], 'destructive')
        self.assertEqual(elasticache_actions['validate_iam_auth_token']['safety'], 'safe')
        self.assertIn('max-age=60', response.headers['Cache-Control'])
        self.assertIn('public', response.headers['Cache-Control'])
        self.assertEqual(services['opensearch']['maturity'], 'interactive_workbench')
        self.assertEqual(services['opensearch']['console_js'], 'dashboard/opensearch-console.js')
        opensearch_actions = {action['name']: action for action in services['opensearch']['actions']}
        self.assertEqual(opensearch_actions['create_domain']['kind'], 'create')
        self.assertEqual(opensearch_actions['delete_domain']['safety'], 'destructive')
        self.assertEqual(opensearch_actions['list_versions']['safety'], 'safe')
        self.assertEqual(services['athena']['maturity'], 'interactive_workbench')
        self.assertEqual(services['athena']['console_js'], 'dashboard/athena-console.js')
        athena_actions = {action['name']: action for action in services['athena']['actions']}
        self.assertEqual(athena_actions['start_query_execution']['kind'], 'execute')
        self.assertEqual(athena_actions['get_query_results']['safety'], 'safe')
        self.assertEqual(athena_actions['stop_query_execution']['safety'], 'destructive')
        self.assertEqual(services['lambda']['api_path'], '/api/lambda/')
        self.assertEqual(services['cloudfront']['maturity'], 'interactive_workbench')
        self.assertEqual(services['cloudfront']['api_path'], '/api/cloudfront/')
        self.assertEqual(services['cloudfront']['console_js'], 'dashboard/cloudfront-console.js')
        cloudfront_actions = {action['name']: action for action in services['cloudfront']['actions']}
        self.assertEqual(cloudfront_actions['create_distribution']['kind'], 'create')
        self.assertEqual(cloudfront_actions['create_invalidation']['kind'], 'execute')
        self.assertEqual(cloudfront_actions['delete_distribution']['safety'], 'destructive')
        self.assertEqual(services['cloudmap']['title'], 'Cloud Map')
        self.assertEqual(services['cloudmap']['api_path'], '/api/cloudmap/')
        self.assertEqual(services['cloudmap']['maturity'], 'interactive_workbench')
        self.assertEqual(services['config']['title'], 'AWS Config')
        self.assertEqual(services['config']['api_path'], '/api/config/')

    @patch('dashboard.views.FlociClientFactory.identity')
    def test_identity_api_includes_credential_context(self, identity):
        identity.return_value = {
            'account': '000000000000',
            'arn': 'arn:aws:iam::000000000000:user/test',
            'user_id': 'AIDAEXAMPLE',
        }

        with patch.dict(os.environ, {
            'AWS_ACCESS_KEY_ID': 'test',
            'AWS_SECRET_ACCESS_KEY': 'test',
        }, clear=True):
            response = self.client.get(reverse('dashboard:identity'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['credential_source'], 'environment')
        self.assertTrue(payload['has_env_credentials'])
        self.assertIsNone(payload['profile'])
        self.assertIsNone(payload['profile_source'])

    @patch('dashboard.views.FlociClientFactory.identity')
    def test_identity_api_uses_test_identity_hint_when_sts_is_unresolved(self, identity):
        identity.side_effect = NoCredentialsError()

        with patch.dict(os.environ, {
            'AWS_ACCESS_KEY_ID': 'test',
            'AWS_SECRET_ACCESS_KEY': 'test',
        }, clear=True):
            response = self.client.get(reverse('dashboard:identity'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['identity']['user_id'], 'test')
        self.assertEqual(payload['identity']['arn'], 'test (local credentials)')
        self.assertFalse(payload['identity_resolved'])
        self.assertIn('Unable to locate credentials', payload['identity_error'])

    def test_service_pages_are_derived_from_registry(self):
        self.assertEqual(set(SERVICE_PAGES), set(SERVICE_REGISTRY))
        self.assertEqual(SERVICE_PAGES['s3']['title'], SERVICE_REGISTRY['s3'].title)

    @patch('dashboard.views.cloudfront_inventory')
    def test_cloudfront_api_returns_inventory(self, cloudfront_inventory):
        cloudfront_inventory.return_value = {'summary': {'distributions': 1}, 'distributions': []}

        response = self.client.get(reverse('dashboard:cloudfront'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['summary']['distributions'], 1)

    @patch('dashboard.views.config_inventory')
    def test_config_api_returns_inventory(self, config_inventory):
        config_inventory.return_value = {'summary': {'config_rules': 1}, 'config_rules': []}

        response = self.client.get(reverse('dashboard:config'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['summary']['config_rules'], 1)

    @patch('dashboard.views.list_resources')
    def test_resources_api_passes_selected_services(self, list_resources):
        list_resources.return_value = []

        response = self.client.get(
            reverse('dashboard:resources'),
            {'services': 's3,lambda,not-a-service,logs'},
        )

        self.assertEqual(response.status_code, 200)
        list_resources.assert_called_once_with({'s3', 'lambda', 'cloudwatch'})

    @patch('dashboard.views.list_resources')
    def test_resources_api_without_selection_loads_all_services(self, list_resources):
        list_resources.return_value = []

        response = self.client.get(reverse('dashboard:resources'))

        self.assertEqual(response.status_code, 200)
        list_resources.assert_called_once_with(None)

    @patch('dashboard.views.list_resources')
    def test_resources_api_returns_json_for_parser_errors(self, list_resources):
        list_resources.side_effect = ResponseParserError('invalid XML received')

        response = self.client.get(reverse('dashboard:resources'))

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response['Content-Type'], 'application/json')
        self.assertEqual(response.json()['resources'], [])
        self.assertIn('invalid XML received', response.json()['error'])


class ResourceLoaderFilterTests(SimpleTestCase):
    @patch('dashboard.aws._resource')
    def test_list_resources_filters_loaders_by_selected_services(self, resource):
        resource.side_effect = lambda name, label, loader: ResourceResult(
            name=name,
            label=label,
            count=0,
            items=[],
        )

        results = aws_list_resources({'s3', 'lambda'})

        self.assertEqual([result.name for result in results], ['s3-buckets', 'lambda-functions'])
        self.assertEqual(resource.call_count, 2)


class FlociClientFactoryTests(SimpleTestCase):
    def test_credential_context_reports_environment_credentials(self):
        with patch.dict(os.environ, {
            'AWS_ACCESS_KEY_ID': 'test',
            'AWS_SECRET_ACCESS_KEY': 'test',
        }, clear=True):
            factory = FlociClientFactory()

            self.assertEqual(factory.credential_context(), {
                'credential_source': 'environment',
                'endpoint_source': 'settings',
                'has_env_credentials': True,
                'profile': None,
                'profile_source': None,
                'region_source': 'settings',
            })

    def test_credential_context_reports_configured_profile(self):
        with patch.dict(os.environ, {'AWS_PROFILE': 'developer'}, clear=True):
            factory = FlociClientFactory()

            self.assertEqual(factory.credential_context(), {
                'credential_source': 'profile',
                'endpoint_source': 'settings',
                'has_env_credentials': False,
                'profile': 'developer',
                'profile_source': 'AWS_PROFILE',
                'region_source': 'settings',
            })

    def test_aws_endpoint_url_is_accepted_for_local_bootstrap(self):
        with patch.dict(os.environ, {
            'AWS_ENDPOINT_URL': 'http://localhost:4566',
            'AWS_DEFAULT_REGION': 'us-east-1',
            'AWS_ACCESS_KEY_ID': 'test',
            'AWS_SECRET_ACCESS_KEY': 'test',
        }, clear=True):
            factory = FlociClientFactory()

            self.assertEqual(factory.endpoint_url, 'http://localhost:4566')
            self.assertEqual(factory.endpoint_source, 'AWS_ENDPOINT_URL')
            self.assertEqual(factory.profile, None)
            self.assertEqual(factory.credential_context()['credential_source'], 'environment')

    def test_local_test_credentials_are_default_when_profile_is_unavailable(self):
        with patch.dict(os.environ, {}, clear=True), patch(
            'dashboard.aws.boto3.Session',
            side_effect=ProfileNotFound(profile='floci-admin'),
        ):
            factory = FlociClientFactory()

            self.assertEqual(factory.profile, None)
            self.assertEqual(factory.access_key_id, 'test')
            self.assertEqual(factory.secret_access_key, 'test')
            self.assertEqual(factory.credential_context()['credential_source'], 'local_default')
            self.assertEqual(factory.local_identity_hint()['user_id'], 'test')

    def test_settings_profile_is_used_when_available(self):
        with patch.dict(os.environ, {}, clear=True):
            with patch('dashboard.aws.boto3.Session') as session:
                session.return_value.get_credentials.return_value = object()
                factory = FlociClientFactory()

        self.assertEqual(factory.profile, 'floci-admin')
        self.assertIsNone(factory.access_key_id)
        self.assertEqual(factory.credential_context()['credential_source'], 'profile')
        self.assertEqual(factory.credential_context()['profile_source'], 'settings')

    def test_localhost_floci_dns_endpoints_are_allowed(self):
        endpoints = [
            'http://localhost.floci.io:4566',
            'http://s3.localhost.floci.io:4566',
            'http://bucket.s3.localhost.floci.io:4566',
            'http://localhost.localstack.cloud:4566',
            'http://s3.localhost.localstack.cloud:4566',
        ]

        for endpoint in endpoints:
            with self.subTest(endpoint=endpoint), patch.dict(os.environ, {'FLOCI_AWS_ENDPOINT_URL': endpoint}):
                factory = FlociClientFactory()

                self.assertEqual(factory.endpoint_url, endpoint)

    def test_non_local_endpoints_are_rejected(self):
        with patch.dict(os.environ, {'FLOCI_AWS_ENDPOINT_URL': 'https://aws.amazon.com'}):
            with self.assertRaisesMessage(ValueError, 'Refusing to use a non-local AWS endpoint'):
                FlociClientFactory()


class StepFunctionsActionTests(SimpleTestCase):
    @patch('dashboard.stepfunctions_views.start_execution')
    def test_start_execution_endpoint_uses_action_helper(self, start_execution):
        start_execution.return_value = {
            'state_machine_arn': 'arn:aws:states:us-east-1:000000000000:stateMachine:orders',
            'execution_arn': 'arn:aws:states:us-east-1:000000000000:execution:orders:test',
        }

        response = self.client.post(
            reverse('dashboard:stepfunctions-executions-start'),
            data=json.dumps({
                'state_machine_arn': 'arn:aws:states:us-east-1:000000000000:stateMachine:orders',
                'name': 'test',
                'input': {'order_id': '123'},
                'trace_header': 'trace-1',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['execution_arn'], 'arn:aws:states:us-east-1:000000000000:execution:orders:test')
        start_execution.assert_called_once_with(
            'arn:aws:states:us-east-1:000000000000:stateMachine:orders',
            {'order_id': '123'},
            name='test',
            trace_header='trace-1',
        )

    @patch('dashboard.stepfunctions_views.stop_execution')
    def test_stop_execution_endpoint_uses_action_helper(self, stop_execution):
        stop_execution.return_value = {
            'execution_arn': 'arn:aws:states:us-east-1:000000000000:execution:orders:test',
        }

        response = self.client.post(
            reverse('dashboard:stepfunctions-executions-stop'),
            data=json.dumps({
                'execution_arn': 'arn:aws:states:us-east-1:000000000000:execution:orders:test',
                'error': 'StoppedByDashboard',
                'cause': 'local test',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['execution_arn'], 'arn:aws:states:us-east-1:000000000000:execution:orders:test')
        stop_execution.assert_called_once_with(
            'arn:aws:states:us-east-1:000000000000:execution:orders:test',
            error='StoppedByDashboard',
            cause='local test',
        )


class EventBridgeActionTests(SimpleTestCase):
    @patch('dashboard.eventbridge_views.put_event')
    def test_put_event_endpoint_uses_action_helper(self, put_event):
        put_event.return_value = {
            'event_bus_name': 'default',
            'failed_entry_count': 0,
            'event_id': 'event-123',
            'entries': [{'EventId': 'event-123'}],
        }

        response = self.client.post(
            reverse('dashboard:eventbridge-events-put'),
            data=json.dumps({
                'event_bus_name': 'default',
                'source': 'com.example.orders',
                'detail_type': 'OrderCreated',
                'detail': {'order_id': '123'},
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['event_id'], 'event-123')
        put_event.assert_called_once_with(
            'default',
            'com.example.orders',
            'OrderCreated',
            {'order_id': '123'},
            resources=None,
        )

    def test_put_event_endpoint_rejects_invalid_json_detail(self):
        response = self.client.post(
            reverse('dashboard:eventbridge-events-put'),
            data=json.dumps({
                'event_bus_name': 'default',
                'source': 'com.example.orders',
                'detail_type': 'OrderCreated',
                'detail': '{bad json',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['service'], 'eventbridge')
        self.assertEqual(response.json()['operation'], 'put_event')


class CloudFormationActionTests(SimpleTestCase):
    @patch('dashboard.cloudformation_views.validate_template')
    def test_validate_template_endpoint_uses_action_helper(self, validate_template):
        validate_template.return_value = {'validation': {'Description': 'ok'}}

        response = self.client.post(
            reverse('dashboard:cloudformation-templates-validate'),
            data=json.dumps({'template_body': 'Resources: {}'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['validation']['Description'], 'ok')
        validate_template.assert_called_once_with('Resources: {}')

    @patch('dashboard.cloudformation_views.create_stack')
    def test_create_stack_endpoint_uses_action_helper(self, create_stack):
        create_stack.return_value = {'stack_name': 'demo', 'stack_id': 'stack-123'}

        response = self.client.post(
            reverse('dashboard:cloudformation-stacks'),
            data=json.dumps({
                'stack_name': 'demo',
                'template_body': 'Resources: {}',
                'parameters': {'Env': 'dev'},
                'capabilities': 'CAPABILITY_NAMED_IAM',
                'disable_rollback': True,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['stack_id'], 'stack-123')
        create_stack.assert_called_once_with(
            'demo',
            'Resources: {}',
            parameters={'Env': 'dev'},
            capabilities='CAPABILITY_NAMED_IAM',
            disable_rollback=True,
        )

    @patch('dashboard.cloudformation_views.update_stack')
    def test_update_stack_endpoint_uses_action_helper(self, update_stack):
        update_stack.return_value = {'stack_name': 'demo', 'stack_id': 'stack-123'}

        response = self.client.put(
            reverse('dashboard:cloudformation-stack-detail', kwargs={'stack_name': 'demo'}),
            data=json.dumps({
                'template_body': 'Resources: {}',
                'parameters': [{'ParameterKey': 'Env', 'ParameterValue': 'dev'}],
                'capabilities': ['CAPABILITY_IAM'],
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        update_stack.assert_called_once_with(
            'demo',
            'Resources: {}',
            parameters=[{'ParameterKey': 'Env', 'ParameterValue': 'dev'}],
            capabilities=['CAPABILITY_IAM'],
        )

    @patch('dashboard.cloudformation_views.delete_stack')
    def test_delete_stack_endpoint_uses_action_helper(self, delete_stack):
        delete_stack.return_value = {'stack_name': 'demo'}

        response = self.client.delete(
            reverse('dashboard:cloudformation-stack-detail', kwargs={'stack_name': 'demo'}),
        )

        self.assertEqual(response.status_code, 200)
        delete_stack.assert_called_once_with('demo')

    @patch('dashboard.cloudformation_views.create_change_set')
    def test_create_change_set_endpoint_uses_action_helper(self, create_change_set):
        create_change_set.return_value = {'stack_name': 'demo', 'change_set_name': 'next'}

        response = self.client.post(
            reverse('dashboard:cloudformation-change-sets'),
            data=json.dumps({
                'stack_name': 'demo',
                'change_set_name': 'next',
                'change_set_type': 'UPDATE',
                'template_body': 'Resources: {}',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_change_set.assert_called_once_with(
            'demo',
            'next',
            'Resources: {}',
            change_set_type='UPDATE',
            parameters=None,
            capabilities=None,
        )

    @patch('dashboard.aws._paginate')
    @patch('dashboard.aws.FlociClientFactory')
    def test_inventory_notes_include_1_5_25_provisioning_coverage(self, factory_mock, paginate_mock):
        cloudformation = MagicMock()
        factory_mock.return_value.client.return_value = cloudformation
        paginate_mock.return_value = []

        result = cloudformation_inventory()

        self.assertTrue(any(
            'Lambda-backed custom resources' in note and 'EC2 VPC/subnet resources' in note
            for note in result['notes']
        ))
        self.assertIn('Lambda layer versions', ' '.join(result['notes']))

    @patch('dashboard.cloudformation_views.describe_change_set')
    def test_describe_change_set_endpoint_uses_action_helper(self, describe_change_set):
        describe_change_set.return_value = {'change_set': {'ChangeSetName': 'next'}}

        response = self.client.get(
            reverse('dashboard:cloudformation-change-set-detail', kwargs={
                'stack_name': 'demo',
                'change_set_name': 'next',
            }),
        )

        self.assertEqual(response.status_code, 200)
        describe_change_set.assert_called_once_with('demo', 'next')

    @patch('dashboard.cloudformation_views.execute_change_set')
    def test_execute_change_set_endpoint_uses_action_helper(self, execute_change_set):
        execute_change_set.return_value = {'stack_name': 'demo', 'change_set_name': 'next'}

        response = self.client.post(
            reverse('dashboard:cloudformation-change-set-detail', kwargs={
                'stack_name': 'demo',
                'change_set_name': 'next',
            }),
        )

        self.assertEqual(response.status_code, 200)
        execute_change_set.assert_called_once_with('demo', 'next')

    @patch('dashboard.cloudformation_views.delete_change_set')
    def test_delete_change_set_endpoint_uses_action_helper(self, delete_change_set):
        delete_change_set.return_value = {'stack_name': 'demo', 'change_set_name': 'next'}

        response = self.client.delete(
            reverse('dashboard:cloudformation-change-set-detail', kwargs={
                'stack_name': 'demo',
                'change_set_name': 'next',
            }),
        )

        self.assertEqual(response.status_code, 200)
        delete_change_set.assert_called_once_with('demo', 'next')


class CognitoActionTests(SimpleTestCase):
    @patch('dashboard.cognito_views.create_user_pool')
    def test_create_user_pool_endpoint_uses_action_helper(self, create_user_pool):
        create_user_pool.return_value = {'pool_id': 'local-pool', 'name': 'MyApp'}

        response = self.client.post(
            reverse('dashboard:cognito-user-pools'),
            data=json.dumps({'name': 'MyApp', 'tags': {'floci:override-id': 'local-pool'}}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['pool_id'], 'local-pool')
        create_user_pool.assert_called_once_with('MyApp', tags={'floci:override-id': 'local-pool'})

    @patch('dashboard.cognito_views.delete_user_pool')
    def test_delete_user_pool_endpoint_uses_action_helper(self, delete_user_pool):
        delete_user_pool.return_value = {'user_pool_id': 'local-pool'}

        response = self.client.delete(
            reverse('dashboard:cognito-user-pool-detail', kwargs={'user_pool_id': 'local-pool'}),
        )

        self.assertEqual(response.status_code, 200)
        delete_user_pool.assert_called_once_with('local-pool')

    @patch('dashboard.cognito_views.create_user_pool_client')
    def test_create_user_pool_client_endpoint_uses_action_helper(self, create_client):
        create_client.return_value = {'client_id': 'client-123', 'client_secret': 'secret'}

        response = self.client.post(
            reverse('dashboard:cognito-user-pool-clients', kwargs={'user_pool_id': 'local-pool'}),
            data=json.dumps({
                'name': 'my-client',
                'generate_secret': True,
                'allowed_oauth_scopes': ['notes/read'],
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['client_id'], 'client-123')
        create_client.assert_called_once_with(
            'local-pool',
            'my-client',
            generate_secret=True,
            allowed_oauth_scopes=['notes/read'],
        )

    @patch('dashboard.cognito_views.create_resource_server')
    def test_create_resource_server_endpoint_uses_action_helper(self, create_resource_server):
        create_resource_server.return_value = {'resource_server': {'Identifier': 'notes'}}

        response = self.client.post(
            reverse('dashboard:cognito-resource-servers', kwargs={'user_pool_id': 'local-pool'}),
            data=json.dumps({
                'identifier': 'notes',
                'name': 'Notes API',
                'scopes': {'read': 'Read notes'},
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_resource_server.assert_called_once_with(
            'local-pool',
            'notes',
            'Notes API',
            scopes={'read': 'Read notes'},
        )

    @patch('dashboard.cognito_views.admin_create_user')
    def test_admin_create_user_endpoint_uses_action_helper(self, admin_create_user):
        admin_create_user.return_value = {'user': {'Username': 'alice@example.com'}}

        response = self.client.post(
            reverse('dashboard:cognito-users', kwargs={'user_pool_id': 'local-pool'}),
            data=json.dumps({
                'username': 'alice@example.com',
                'temporary_password': 'Temp1234!',
                'attributes': {'email': 'alice@example.com'},
                'message_action': 'SUPPRESS',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        admin_create_user.assert_called_once_with(
            'local-pool',
            'alice@example.com',
            temporary_password='Temp1234!',
            attributes={'email': 'alice@example.com'},
            message_action='SUPPRESS',
        )

    @patch('dashboard.cognito_views.admin_set_user_password')
    def test_set_user_password_endpoint_uses_action_helper(self, set_password):
        set_password.return_value = {'username': 'alice@example.com', 'permanent': True}

        response = self.client.post(
            reverse('dashboard:cognito-user-password', kwargs={
                'user_pool_id': 'local-pool',
                'username': 'alice@example.com',
            }),
            data=json.dumps({'password': 'Perm1234!', 'permanent': True}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        set_password.assert_called_once_with('local-pool', 'alice@example.com', 'Perm1234!', permanent=True)

    @patch('dashboard.cognito_views.admin_delete_user')
    def test_admin_delete_user_endpoint_uses_action_helper(self, admin_delete_user):
        admin_delete_user.return_value = {'username': 'alice@example.com'}

        response = self.client.delete(
            reverse('dashboard:cognito-user-detail', kwargs={
                'user_pool_id': 'local-pool',
                'username': 'alice@example.com',
            }),
        )

        self.assertEqual(response.status_code, 200)
        admin_delete_user.assert_called_once_with('local-pool', 'alice@example.com')

    @patch('dashboard.cognito_views.create_group')
    def test_create_group_endpoint_uses_action_helper(self, create_group):
        create_group.return_value = {'group': {'GroupName': 'admin'}}

        response = self.client.post(
            reverse('dashboard:cognito-groups', kwargs={'user_pool_id': 'local-pool'}),
            data=json.dumps({'group_name': 'admin', 'description': 'Admin group'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_group.assert_called_once_with('local-pool', 'admin', description='Admin group')

    @patch('dashboard.cognito_views.add_user_to_group')
    def test_add_user_to_group_endpoint_uses_action_helper(self, add_user_to_group):
        add_user_to_group.return_value = {'username': 'alice@example.com', 'group_name': 'admin'}

        response = self.client.post(
            reverse('dashboard:cognito-group-membership', kwargs={
                'user_pool_id': 'local-pool',
                'group_name': 'admin',
                'username': 'alice@example.com',
            }),
        )

        self.assertEqual(response.status_code, 200)
        add_user_to_group.assert_called_once_with('local-pool', 'alice@example.com', 'admin')

    @patch('dashboard.cognito_views.initiate_auth')
    def test_initiate_auth_endpoint_uses_action_helper(self, initiate_auth):
        initiate_auth.return_value = {'AuthenticationResult': {'AccessToken': 'token'}}

        response = self.client.post(
            reverse('dashboard:cognito-auth-initiate'),
            data=json.dumps({
                'client_id': 'client-123',
                'username': 'alice@example.com',
                'password': 'Perm1234!',
                'auth_flow': 'USER_PASSWORD_AUTH',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        initiate_auth.assert_called_once_with(
            'client-123',
            'alice@example.com',
            'Perm1234!',
            auth_flow='USER_PASSWORD_AUTH',
        )

    @patch('dashboard.cognito_views.oauth_client_credentials')
    def test_oauth_token_endpoint_uses_action_helper(self, oauth_client_credentials):
        oauth_client_credentials.return_value = {'access_token': 'token', 'token_type': 'Bearer'}

        response = self.client.post(
            reverse('dashboard:cognito-oauth-token'),
            data=json.dumps({
                'client_id': 'client-123',
                'client_secret': 'secret',
                'scope': 'notes/read',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        oauth_client_credentials.assert_called_once_with('client-123', 'secret', scope='notes/read')


class RDSActionTests(SimpleTestCase):
    @patch('dashboard.rds_views.create_db_instance')
    def test_create_db_instance_endpoint_uses_action_helper(self, create_db_instance):
        create_db_instance.return_value = {'identifier': 'mypostgres'}

        response = self.client.post(
            reverse('dashboard:rds-instances'),
            data=json.dumps({
                'identifier': 'mypostgres',
                'engine': 'postgres',
                'username': 'admin',
                'password': 'secret123',
                'db_instance_class': 'db.t3.micro',
                'allocated_storage': 20,
                'db_name': 'appdb',
                'engine_version': 'postgres:16-alpine',
                'enable_iam_auth': True,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['identifier'], 'mypostgres')
        create_db_instance.assert_called_once_with(
            'mypostgres',
            'postgres',
            'admin',
            'secret123',
            db_instance_class='db.t3.micro',
            allocated_storage=20,
            db_name='appdb',
            engine_version='postgres:16-alpine',
            enable_iam_auth=True,
            tags=None,
        )

    @patch('dashboard.aws._paginate')
    @patch('dashboard.aws.FlociClientFactory')
    def test_inventory_notes_include_provisioning_and_sts_iam_auth_context(self, factory_mock, paginate_mock):
        rds = MagicMock()
        factory_mock.return_value.client.return_value = rds
        paginate_mock.return_value = []

        result = rds_inventory()

        self.assertTrue(any('RDS provisioning lifecycle support' in note for note in result['notes']))
        self.assertTrue(any('STS session secret keys' in note for note in result['notes']))
        self.assertIn('CreateDBInstance', result['supported'])
        self.assertIn('ModifyDBInstance', result['supported'])
        self.assertIn('DeleteDBInstance', result['supported'])

    @patch('dashboard.rds_views.modify_db_instance')
    def test_modify_db_instance_endpoint_uses_action_helper(self, modify_db_instance):
        modify_db_instance.return_value = {'identifier': 'mypostgres'}

        response = self.client.put(
            reverse('dashboard:rds-instance-detail', kwargs={'identifier': 'mypostgres'}),
            data=json.dumps({
                'db_instance_class': 'db.t3.small',
                'allocated_storage': 30,
                'master_user_password': 'newsecret123',
                'apply_immediately': True,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        modify_db_instance.assert_called_once_with(
            'mypostgres',
            db_instance_class='db.t3.small',
            allocated_storage=30,
            master_user_password='newsecret123',
            apply_immediately=True,
        )

    @patch('dashboard.rds_views.reboot_db_instance')
    def test_reboot_db_instance_endpoint_uses_action_helper(self, reboot_db_instance):
        reboot_db_instance.return_value = {'identifier': 'mypostgres'}

        response = self.client.post(
            reverse('dashboard:rds-instance-reboot', kwargs={'identifier': 'mypostgres'}),
        )

        self.assertEqual(response.status_code, 200)
        reboot_db_instance.assert_called_once_with('mypostgres')

    @patch('dashboard.rds_views.delete_db_instance')
    def test_delete_db_instance_endpoint_uses_action_helper(self, delete_db_instance):
        delete_db_instance.return_value = {'identifier': 'mypostgres'}

        response = self.client.delete(
            reverse('dashboard:rds-instance-detail', kwargs={'identifier': 'mypostgres'}),
            data=json.dumps({
                'skip_final_snapshot': False,
                'final_snapshot_identifier': 'mypostgres-final',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        delete_db_instance.assert_called_once_with(
            'mypostgres',
            skip_final_snapshot=False,
            final_snapshot_identifier='mypostgres-final',
        )

    @patch('dashboard.rds_views.create_db_cluster')
    def test_create_db_cluster_endpoint_uses_action_helper(self, create_db_cluster):
        create_db_cluster.return_value = {'identifier': 'mycluster'}

        response = self.client.post(
            reverse('dashboard:rds-clusters'),
            data=json.dumps({
                'identifier': 'mycluster',
                'engine': 'postgres',
                'username': 'admin',
                'password': 'secret123',
                'database_name': 'appdb',
                'engine_version': 'postgres:16-alpine',
                'enable_iam_auth': True,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_db_cluster.assert_called_once_with(
            'mycluster',
            'postgres',
            'admin',
            'secret123',
            database_name='appdb',
            engine_version='postgres:16-alpine',
            enable_iam_auth=True,
        )

    @patch('dashboard.rds_views.delete_db_cluster')
    def test_delete_db_cluster_endpoint_uses_action_helper(self, delete_db_cluster):
        delete_db_cluster.return_value = {'identifier': 'mycluster'}

        response = self.client.delete(
            reverse('dashboard:rds-cluster-detail', kwargs={'identifier': 'mycluster'}),
        )

        self.assertEqual(response.status_code, 200)
        delete_db_cluster.assert_called_once_with(
            'mycluster',
            skip_final_snapshot=True,
            final_snapshot_identifier='',
        )

    @patch('dashboard.rds_views.create_db_parameter_group')
    def test_create_db_parameter_group_endpoint_uses_action_helper(self, create_db_parameter_group):
        create_db_parameter_group.return_value = {'parameter_group': {'DBParameterGroupName': 'local-postgres'}}

        response = self.client.post(
            reverse('dashboard:rds-parameter-groups'),
            data=json.dumps({
                'name': 'local-postgres',
                'family': 'postgres16',
                'description': 'Local PostgreSQL parameters',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_db_parameter_group.assert_called_once_with(
            'local-postgres',
            'postgres16',
            'Local PostgreSQL parameters',
        )

    @patch('dashboard.rds_views.delete_db_parameter_group')
    def test_delete_db_parameter_group_endpoint_uses_action_helper(self, delete_db_parameter_group):
        delete_db_parameter_group.return_value = {'name': 'local-postgres'}

        response = self.client.delete(
            reverse('dashboard:rds-parameter-group-detail', kwargs={'name': 'local-postgres'}),
        )

        self.assertEqual(response.status_code, 200)
        delete_db_parameter_group.assert_called_once_with('local-postgres')


class AutoScalingActionTests(SimpleTestCase):
    @patch('dashboard.autoscaling_views.create_launch_configuration')
    def test_create_launch_configuration_endpoint_uses_action_helper(self, create_launch_configuration):
        create_launch_configuration.return_value = {'name': 'my-lc'}

        response = self.client.post(
            reverse('dashboard:autoscaling-launch-configurations'),
            data=json.dumps({
                'name': 'my-lc',
                'image_id': 'ami-12345678',
                'instance_type': 't3.micro',
                'key_name': 'floci-key',
                'security_groups': ['sg-default'],
                'user_data': '#!/bin/sh\necho hello',
                'iam_instance_profile': 'app-profile',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_launch_configuration.assert_called_once_with(
            'my-lc',
            'ami-12345678',
            't3.micro',
            key_name='floci-key',
            security_groups=['sg-default'],
            user_data='#!/bin/sh\necho hello',
            iam_instance_profile='app-profile',
        )

    @patch('dashboard.autoscaling_views.delete_launch_configuration')
    def test_delete_launch_configuration_endpoint_uses_action_helper(self, delete_launch_configuration):
        delete_launch_configuration.return_value = {'name': 'my-lc'}

        response = self.client.delete(
            reverse('dashboard:autoscaling-launch-configuration-detail', kwargs={'name': 'my-lc'}),
        )

        self.assertEqual(response.status_code, 200)
        delete_launch_configuration.assert_called_once_with('my-lc')

    @patch('dashboard.autoscaling_views.create_auto_scaling_group')
    def test_create_auto_scaling_group_endpoint_uses_action_helper(self, create_auto_scaling_group):
        create_auto_scaling_group.return_value = {'name': 'my-asg'}

        response = self.client.post(
            reverse('dashboard:autoscaling-groups'),
            data=json.dumps({
                'name': 'my-asg',
                'launch_configuration_name': 'my-lc',
                'min_size': 1,
                'max_size': 5,
                'desired_capacity': 2,
                'availability_zones': ['us-east-1a'],
                'target_group_arns': ['arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/my-tg/abc'],
                'tags': {'env': 'local'},
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_auto_scaling_group.assert_called_once_with(
            'my-asg',
            'my-lc',
            min_size=1,
            max_size=5,
            desired_capacity=2,
            availability_zones=['us-east-1a'],
            target_group_arns=['arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/my-tg/abc'],
            tags={'env': 'local'},
        )

    @patch('dashboard.autoscaling_views.update_auto_scaling_group')
    def test_update_auto_scaling_group_endpoint_uses_action_helper(self, update_auto_scaling_group):
        update_auto_scaling_group.return_value = {'name': 'my-asg'}

        response = self.client.put(
            reverse('dashboard:autoscaling-group-detail', kwargs={'name': 'my-asg'}),
            data=json.dumps({'min_size': 1, 'max_size': 6, 'desired_capacity': 3}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        update_auto_scaling_group.assert_called_once_with(
            'my-asg',
            launch_configuration_name='',
            min_size=1,
            max_size=6,
            desired_capacity=3,
            availability_zones=None,
        )

    @patch('dashboard.autoscaling_views.set_desired_capacity')
    def test_set_desired_capacity_endpoint_uses_action_helper(self, set_desired_capacity):
        set_desired_capacity.return_value = {'name': 'my-asg', 'desired_capacity': 3}

        response = self.client.post(
            reverse('dashboard:autoscaling-group-desired-capacity', kwargs={'name': 'my-asg'}),
            data=json.dumps({'desired_capacity': 3, 'honor_cooldown': True}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        set_desired_capacity.assert_called_once_with('my-asg', 3, honor_cooldown=True)

    @patch('dashboard.autoscaling_views.attach_instances')
    def test_attach_instances_endpoint_uses_action_helper(self, attach_instances):
        attach_instances.return_value = {'name': 'my-asg', 'instance_ids': ['i-123']}

        response = self.client.post(
            reverse('dashboard:autoscaling-group-instances', kwargs={'name': 'my-asg'}),
            data=json.dumps({'instance_ids': ['i-123']}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        attach_instances.assert_called_once_with('my-asg', ['i-123'])

    @patch('dashboard.autoscaling_views.detach_instances')
    def test_detach_instances_endpoint_uses_action_helper(self, detach_instances):
        detach_instances.return_value = {'name': 'my-asg', 'instance_ids': ['i-123']}

        response = self.client.delete(
            reverse('dashboard:autoscaling-group-instances', kwargs={'name': 'my-asg'}),
            data=json.dumps({'instance_ids': ['i-123'], 'decrement_desired_capacity': True}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        detach_instances.assert_called_once_with('my-asg', ['i-123'], decrement_desired_capacity=True)

    @patch('dashboard.autoscaling_views.terminate_instance')
    def test_terminate_instance_endpoint_uses_action_helper(self, terminate_instance):
        terminate_instance.return_value = {'instance_id': 'i-123'}

        response = self.client.post(
            reverse('dashboard:autoscaling-instance-terminate', kwargs={'instance_id': 'i-123'}),
            data=json.dumps({'decrement_desired_capacity': True}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        terminate_instance.assert_called_once_with('i-123', decrement_desired_capacity=True)

    @patch('dashboard.autoscaling_views.put_lifecycle_hook')
    def test_put_lifecycle_hook_endpoint_uses_action_helper(self, put_lifecycle_hook):
        put_lifecycle_hook.return_value = {'name': 'my-asg', 'hook_name': 'launch-wait'}

        response = self.client.post(
            reverse('dashboard:autoscaling-lifecycle-hooks', kwargs={'name': 'my-asg'}),
            data=json.dumps({
                'hook_name': 'launch-wait',
                'transition': 'autoscaling:EC2_INSTANCE_LAUNCHING',
                'default_result': 'CONTINUE',
                'heartbeat_timeout': 120,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        put_lifecycle_hook.assert_called_once_with(
            'my-asg',
            'launch-wait',
            'autoscaling:EC2_INSTANCE_LAUNCHING',
            default_result='CONTINUE',
            heartbeat_timeout=120,
        )

    @patch('dashboard.autoscaling_views.put_scaling_policy')
    def test_put_scaling_policy_endpoint_uses_action_helper(self, put_scaling_policy):
        put_scaling_policy.return_value = {'name': 'my-asg', 'policy_name': 'scale-out-one'}

        response = self.client.post(
            reverse('dashboard:autoscaling-policies', kwargs={'name': 'my-asg'}),
            data=json.dumps({
                'policy_name': 'scale-out-one',
                'adjustment_type': 'ChangeInCapacity',
                'scaling_adjustment': 1,
                'cooldown': 60,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        put_scaling_policy.assert_called_once_with(
            'my-asg',
            'scale-out-one',
            adjustment_type='ChangeInCapacity',
            scaling_adjustment=1,
            cooldown=60,
        )


class ElasticLoadBalancingActionTests(SimpleTestCase):
    load_balancer_arn = 'arn:aws:elasticloadbalancing:us-east-1:000000000000:loadbalancer/app/my-alb/abc123'
    target_group_arn = 'arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/my-targets/def456'
    listener_arn = 'arn:aws:elasticloadbalancing:us-east-1:000000000000:listener/app/my-alb/abc123/ghi789'
    rule_arn = 'arn:aws:elasticloadbalancing:us-east-1:000000000000:listener-rule/app/my-alb/abc123/ghi789/jkl012'

    @patch('dashboard.elasticloadbalancing_views.create_load_balancer')
    def test_create_load_balancer_endpoint_uses_action_helper(self, create_load_balancer):
        create_load_balancer.return_value = {'load_balancers': [{'LoadBalancerName': 'my-alb'}]}

        response = self.client.post(
            reverse('dashboard:elbv2-load-balancers'),
            data=json.dumps({
                'name': 'my-alb',
                'type': 'application',
                'scheme': 'internet-facing',
                'subnets': ['subnet-a'],
                'security_groups': ['sg-default'],
                'ip_address_type': 'ipv4',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_load_balancer.assert_called_once_with(
            'my-alb',
            lb_type='application',
            scheme='internet-facing',
            subnets=['subnet-a'],
            security_groups=['sg-default'],
            ip_address_type='ipv4',
        )

    @patch('dashboard.elasticloadbalancing_views.delete_load_balancer')
    def test_delete_load_balancer_endpoint_uses_action_helper(self, delete_load_balancer):
        delete_load_balancer.return_value = {'load_balancer_arn': self.load_balancer_arn}

        response = self.client.delete(
            reverse('dashboard:elbv2-load-balancer-detail', kwargs={'load_balancer_arn': self.load_balancer_arn}),
        )

        self.assertEqual(response.status_code, 200)
        delete_load_balancer.assert_called_once_with(self.load_balancer_arn)

    @patch('dashboard.elasticloadbalancing_views.create_target_group')
    def test_create_target_group_endpoint_uses_action_helper(self, create_target_group):
        create_target_group.return_value = {'target_groups': [{'TargetGroupName': 'my-targets'}]}

        response = self.client.post(
            reverse('dashboard:elbv2-target-groups'),
            data=json.dumps({
                'name': 'my-targets',
                'protocol': 'HTTP',
                'port': 80,
                'target_type': 'instance',
                'vpc_id': 'vpc-default',
                'health_check_path': '/health',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_target_group.assert_called_once_with(
            'my-targets',
            'HTTP',
            80,
            target_type='instance',
            vpc_id='vpc-default',
            health_check_path='/health',
        )

    @patch('dashboard.elasticloadbalancing_views.delete_target_group')
    def test_delete_target_group_endpoint_uses_action_helper(self, delete_target_group):
        delete_target_group.return_value = {'target_group_arn': self.target_group_arn}

        response = self.client.delete(
            reverse('dashboard:elbv2-target-group-detail', kwargs={'target_group_arn': self.target_group_arn}),
        )

        self.assertEqual(response.status_code, 200)
        delete_target_group.assert_called_once_with(self.target_group_arn)

    @patch('dashboard.elasticloadbalancing_views.register_targets')
    def test_register_targets_endpoint_uses_action_helper(self, register_targets):
        register_targets.return_value = {'target_group_arn': self.target_group_arn}

        response = self.client.post(
            reverse('dashboard:elbv2-target-group-targets', kwargs={'target_group_arn': self.target_group_arn}),
            data=json.dumps({'targets': [{'Id': 'i-123', 'Port': 8080}]}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        register_targets.assert_called_once_with(self.target_group_arn, [{'Id': 'i-123', 'Port': 8080}])

    @patch('dashboard.elasticloadbalancing_views.deregister_targets')
    def test_deregister_targets_endpoint_uses_action_helper(self, deregister_targets):
        deregister_targets.return_value = {'target_group_arn': self.target_group_arn}

        response = self.client.delete(
            reverse('dashboard:elbv2-target-group-targets', kwargs={'target_group_arn': self.target_group_arn}),
            data=json.dumps({'targets': [{'Id': 'i-123'}]}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        deregister_targets.assert_called_once_with(self.target_group_arn, [{'Id': 'i-123'}])

    @patch('dashboard.elasticloadbalancing_views.create_listener')
    def test_create_listener_endpoint_uses_action_helper(self, create_listener):
        create_listener.return_value = {'listeners': [{'Port': 80}]}

        response = self.client.post(
            reverse('dashboard:elbv2-listeners'),
            data=json.dumps({
                'load_balancer_arn': self.load_balancer_arn,
                'protocol': 'HTTP',
                'port': 80,
                'target_group_arn': self.target_group_arn,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_listener.assert_called_once_with(self.load_balancer_arn, 'HTTP', 80, self.target_group_arn)

    @patch('dashboard.elasticloadbalancing_views.delete_listener')
    def test_delete_listener_endpoint_uses_action_helper(self, delete_listener):
        delete_listener.return_value = {'listener_arn': self.listener_arn}

        response = self.client.delete(
            reverse('dashboard:elbv2-listener-detail', kwargs={'listener_arn': self.listener_arn}),
        )

        self.assertEqual(response.status_code, 200)
        delete_listener.assert_called_once_with(self.listener_arn)

    @patch('dashboard.elasticloadbalancing_views.create_rule')
    def test_create_rule_endpoint_uses_action_helper(self, create_rule):
        create_rule.return_value = {'rules': [{'Priority': '10'}]}

        response = self.client.post(
            reverse('dashboard:elbv2-rules'),
            data=json.dumps({
                'listener_arn': self.listener_arn,
                'priority': 10,
                'path_pattern': '/api/*',
                'target_group_arn': self.target_group_arn,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_rule.assert_called_once_with(self.listener_arn, 10, '/api/*', self.target_group_arn)

    @patch('dashboard.elasticloadbalancing_views.delete_rule')
    def test_delete_rule_endpoint_uses_action_helper(self, delete_rule):
        delete_rule.return_value = {'rule_arn': self.rule_arn}

        response = self.client.delete(
            reverse('dashboard:elbv2-rule-detail', kwargs={'rule_arn': self.rule_arn}),
        )

        self.assertEqual(response.status_code, 200)
        delete_rule.assert_called_once_with(self.rule_arn)

    @patch('dashboard.elasticloadbalancing_views.add_tags')
    def test_add_tags_endpoint_uses_action_helper(self, add_tags):
        add_tags.return_value = {'resource_arns': [self.load_balancer_arn]}

        response = self.client.post(
            reverse('dashboard:elbv2-tags'),
            data=json.dumps({'resource_arns': [self.load_balancer_arn], 'tags': {'env': 'dev'}}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        add_tags.assert_called_once_with([self.load_balancer_arn], {'env': 'dev'})


class EC2ActionTests(SimpleTestCase):
    def _empty_ec2_client(self):
        ec2 = MagicMock()
        ec2.describe_instances.return_value = {'Reservations': []}
        ec2.describe_vpcs.return_value = {'Vpcs': []}
        ec2.describe_subnets.return_value = {'Subnets': []}
        ec2.describe_security_groups.return_value = {'SecurityGroups': []}
        ec2.describe_security_group_rules.return_value = {'SecurityGroupRules': []}
        ec2.describe_key_pairs.return_value = {'KeyPairs': []}
        ec2.describe_images.return_value = {'Images': []}
        ec2.describe_tags.return_value = {'Tags': []}
        ec2.describe_internet_gateways.return_value = {'InternetGateways': []}
        ec2.describe_route_tables.return_value = {'RouteTables': []}
        ec2.describe_addresses.return_value = {'Addresses': []}
        ec2.describe_availability_zones.return_value = {'AvailabilityZones': []}
        ec2.describe_regions.return_value = {'Regions': []}
        ec2.describe_account_attributes.return_value = {'AccountAttributes': []}
        ec2.describe_instance_types.return_value = {'InstanceTypes': []}
        return ec2

    @patch('dashboard.aws._paginate')
    @patch('dashboard.aws.FlociClientFactory')
    def test_inventory_includes_vpc_endpoints(self, factory_mock, paginate_mock):
        endpoint = {
            'VpcEndpointId': 'vpce-123',
            'VpcEndpointType': 'Interface',
            'ServiceName': 'com.amazonaws.us-east-1.s3',
            'State': 'available',
            'VpcId': 'vpc-default',
        }
        factory_mock.return_value.client.return_value = self._empty_ec2_client()
        paginate_mock.side_effect = lambda _client, operation_name, _result_key, **_kwargs: (
            [endpoint] if operation_name == 'describe_vpc_endpoints' else []
        )

        result = ec2_inventory()

        self.assertEqual(result['summary']['vpc_endpoints'], 1)
        self.assertEqual(result['vpc_endpoints'], [endpoint])

    @patch('dashboard.aws._paginate')
    @patch('dashboard.aws.FlociClientFactory')
    def test_resource_count_includes_vpc_endpoints(self, factory_mock, paginate_mock):
        endpoint = {'VpcEndpointId': 'vpce-123'}
        factory_mock.return_value.client.return_value = self._empty_ec2_client()
        paginate_mock.side_effect = lambda _client, operation_name, _result_key, **_kwargs: (
            [endpoint] if operation_name == 'describe_vpc_endpoints' else []
        )

        results = aws_list_resources({'ec2'})

        self.assertEqual(results[0].name, 'ec2-resources')
        self.assertEqual(results[0].count, 1)
        self.assertEqual(results[0].items, [{'type': 'vpc_endpoint', 'id': 'vpce-123'}])

    @patch('dashboard.ec2_views.run_instances')
    def test_run_instances_endpoint_uses_action_helper(self, run_instances):
        run_instances.return_value = {
            'reservation_id': 'r-123',
            'instance_id': 'i-123',
            'instances': [{'id': 'i-123'}],
        }

        response = self.client.post(
            reverse('dashboard:ec2-instances-run'),
            data=json.dumps({
                'image_id': 'ami-amazonlinux2023',
                'instance_type': 't2.micro',
                'subnet_id': 'subnet-default-c',
                'security_group_ids': ['sg-default'],
                'key_name': 'floci-key',
                'user_data': '#!/bin/sh\necho hello',
                'iam_instance_profile_arn': 'arn:aws:iam::000000000000:instance-profile/app',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['instance_id'], 'i-123')
        run_instances.assert_called_once_with(
            'ami-amazonlinux2023',
            't2.micro',
            subnet_id='subnet-default-c',
            security_group_ids=['sg-default'],
            key_name='floci-key',
            user_data='#!/bin/sh\necho hello',
            iam_instance_profile_arn='arn:aws:iam::000000000000:instance-profile/app',
        )

    def test_run_instances_endpoint_rejects_missing_image_id(self):
        response = self.client.post(
            reverse('dashboard:ec2-instances-run'),
            data=json.dumps({'instance_type': 't2.micro'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['service'], 'ec2')
        self.assertEqual(response.json()['operation'], 'run_instances')

    @patch('dashboard.ec2_views.stop_instance')
    def test_stop_instance_endpoint_uses_action_helper(self, stop_instance):
        stop_instance.return_value = {'instance_id': 'i-123', 'state_changes': []}

        response = self.client.post(reverse('dashboard:ec2-instance-stop', kwargs={'instance_id': 'i-123'}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['instance_id'], 'i-123')
        stop_instance.assert_called_once_with('i-123')

    @patch('dashboard.ec2_views.start_instance')
    def test_start_instance_endpoint_uses_action_helper(self, start_instance):
        start_instance.return_value = {'instance_id': 'i-123', 'state_changes': []}

        response = self.client.post(reverse('dashboard:ec2-instance-start', kwargs={'instance_id': 'i-123'}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['instance_id'], 'i-123')
        start_instance.assert_called_once_with('i-123')

    @patch('dashboard.ec2_views.reboot_instance')
    def test_reboot_instance_endpoint_uses_action_helper(self, reboot_instance):
        reboot_instance.return_value = {'instance_id': 'i-123', 'state_changes': []}

        response = self.client.post(reverse('dashboard:ec2-instance-reboot', kwargs={'instance_id': 'i-123'}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['instance_id'], 'i-123')
        reboot_instance.assert_called_once_with('i-123')

    @patch('dashboard.ec2_views.terminate_instance')
    def test_terminate_instance_endpoint_uses_action_helper(self, terminate_instance):
        terminate_instance.return_value = {'instance_id': 'i-123', 'state_changes': []}

        response = self.client.post(reverse('dashboard:ec2-instance-terminate', kwargs={'instance_id': 'i-123'}))

        self.assertEqual(response.status_code, 200)
        terminate_instance.assert_called_once_with('i-123')

    @patch('dashboard.ec2_views.import_key_pair')
    def test_import_key_pair_endpoint_uses_action_helper(self, import_key_pair):
        import_key_pair.return_value = {'key_name': 'floci-key', 'fingerprint': 'aa:bb'}

        response = self.client.post(
            reverse('dashboard:ec2-key-pairs-import'),
            data=json.dumps({
                'key_name': 'floci-key',
                'public_key_material': 'ssh-rsa AAAA user@host',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['key_name'], 'floci-key')
        import_key_pair.assert_called_once_with('floci-key', 'ssh-rsa AAAA user@host')


class IAMActionTests(SimpleTestCase):
    @patch('dashboard.iam_views.create_access_key')
    def test_create_access_key_endpoint_uses_action_helper(self, create_access_key):
        create_access_key.return_value = {
            'user_name': 'alice',
            'access_key_id': 'AKIAEXAMPLE',
            'secret_access_key': 'secret',
        }

        response = self.client.post(reverse('dashboard:iam-user-access-keys', kwargs={'user_name': 'alice'}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['access_key_id'], 'AKIAEXAMPLE')
        create_access_key.assert_called_once_with('alice')

    @patch('dashboard.iam_views.update_access_key')
    def test_update_access_key_endpoint_uses_action_helper(self, update_access_key):
        update_access_key.return_value = {
            'user_name': 'alice',
            'access_key_id': 'AKIAEXAMPLE',
            'status': 'Inactive',
        }

        response = self.client.put(
            reverse('dashboard:iam-user-access-key-detail', kwargs={
                'user_name': 'alice',
                'access_key_id': 'AKIAEXAMPLE',
            }),
            data=json.dumps({'status': 'Inactive'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'Inactive')
        update_access_key.assert_called_once_with('alice', 'AKIAEXAMPLE', 'Inactive')

    @patch('dashboard.iam_views.delete_access_key')
    def test_delete_access_key_endpoint_uses_action_helper(self, delete_access_key):
        delete_access_key.return_value = {
            'user_name': 'alice',
            'access_key_id': 'AKIAEXAMPLE',
            'deleted': True,
        }

        response = self.client.delete(
            reverse('dashboard:iam-user-access-key-detail', kwargs={
                'user_name': 'alice',
                'access_key_id': 'AKIAEXAMPLE',
            })
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['deleted'])
        delete_access_key.assert_called_once_with('alice', 'AKIAEXAMPLE')

    @patch('dashboard.iam_views.assume_role')
    def test_assume_role_endpoint_uses_action_helper(self, assume_role):
        assume_role.return_value = {
            'role_arn': 'arn:aws:iam::000000000000:role/app',
            'session_name': 'dashboard',
            'credentials': {'access_key_id': 'ASIAEXAMPLE'},
        }

        response = self.client.post(
            reverse('dashboard:iam-role-assume', kwargs={'role_name': 'app'}),
            data=json.dumps({
                'role_arn': 'arn:aws:iam::000000000000:role/app',
                'session_name': 'dashboard',
                'duration_seconds': 900,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['credentials']['access_key_id'], 'ASIAEXAMPLE')
        assume_role.assert_called_once_with(
            'arn:aws:iam::000000000000:role/app',
            'dashboard',
            duration_seconds=900,
        )

    @patch('dashboard.iam_views.update_role_trust_policy')
    def test_update_role_trust_policy_endpoint_uses_action_helper(self, update_role_trust_policy):
        update_role_trust_policy.return_value = {'role_name': 'app', 'saved': True}
        document = {'Version': '2012-10-17', 'Statement': []}

        response = self.client.put(
            reverse('dashboard:iam-role-trust-policy', kwargs={'role_name': 'app'}),
            data=json.dumps({'document': document}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['saved'])
        update_role_trust_policy.assert_called_once_with('app', document)

    @patch('dashboard.iam_views.add_user_to_group')
    def test_add_user_to_group_endpoint_uses_action_helper(self, add_user_to_group):
        add_user_to_group.return_value = {'user_name': 'alice', 'group_name': 'admins', 'added': True}

        response = self.client.post(
            reverse('dashboard:iam-group-membership', kwargs={'group_name': 'admins'}),
            data=json.dumps({'user_name': 'alice'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['added'])
        add_user_to_group.assert_called_once_with('alice', 'admins')

    @patch('dashboard.iam_views.remove_user_from_group')
    def test_remove_user_from_group_endpoint_uses_action_helper(self, remove_user_from_group):
        remove_user_from_group.return_value = {'user_name': 'alice', 'group_name': 'admins', 'removed': True}

        response = self.client.delete(
            reverse('dashboard:iam-group-membership', kwargs={'group_name': 'admins'}),
            data=json.dumps({'user_name': 'alice'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['removed'])
        remove_user_from_group.assert_called_once_with('alice', 'admins')

    @patch('dashboard.iam_views.attach_managed_policy')
    def test_attach_managed_policy_endpoint_uses_action_helper(self, attach_managed_policy):
        attach_managed_policy.return_value = {
            'principal_type': 'role',
            'principal_name': 'app',
            'policy_arn': 'arn:aws:iam::000000000000:policy/Local',
            'attached': True,
        }

        response = self.client.post(
            reverse('dashboard:iam-attached-policies', kwargs={
                'principal_type': 'role',
                'principal_name': 'app',
            }),
            data=json.dumps({'policy_arn': 'arn:aws:iam::000000000000:policy/Local'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['attached'])
        attach_managed_policy.assert_called_once_with('role', 'app', 'arn:aws:iam::000000000000:policy/Local')

    @patch('dashboard.iam_views.detach_managed_policy')
    def test_detach_managed_policy_endpoint_uses_action_helper(self, detach_managed_policy):
        detach_managed_policy.return_value = {
            'principal_type': 'role',
            'principal_name': 'app',
            'policy_arn': 'arn:aws:iam::000000000000:policy/Local',
            'detached': True,
        }

        response = self.client.delete(
            reverse('dashboard:iam-attached-policies', kwargs={
                'principal_type': 'role',
                'principal_name': 'app',
            }),
            data=json.dumps({'policy_arn': 'arn:aws:iam::000000000000:policy/Local'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['detached'])
        detach_managed_policy.assert_called_once_with('role', 'app', 'arn:aws:iam::000000000000:policy/Local')

    @patch('dashboard.iam_views.put_inline_policy')
    def test_put_inline_policy_endpoint_uses_action_helper(self, put_inline_policy):
        put_inline_policy.return_value = {
            'principal_type': 'role',
            'principal_name': 'app',
            'policy_name': 'local',
            'saved': True,
        }

        document = {'Version': '2012-10-17', 'Statement': []}
        response = self.client.put(
            reverse('dashboard:iam-inline-policy-detail', kwargs={
                'principal_type': 'role',
                'principal_name': 'app',
                'policy_name': 'local',
            }),
            data=json.dumps({'document': document}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['saved'])
        put_inline_policy.assert_called_once_with('role', 'app', 'local', document)

    @patch('dashboard.iam_views.create_managed_policy')
    def test_create_managed_policy_endpoint_uses_action_helper(self, create_managed_policy):
        create_managed_policy.return_value = {
            'policy_name': 'Local',
            'policy_arn': 'arn:aws:iam::000000000000:policy/Local',
        }

        document = {'Version': '2012-10-17', 'Statement': []}
        response = self.client.post(
            reverse('dashboard:iam-managed-policies'),
            data=json.dumps({
                'name': 'Local',
                'document': document,
                'description': 'Local test policy',
                'path': '/service-role/',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['policy_name'], 'Local')
        create_managed_policy.assert_called_once_with(
            'Local',
            document,
            description='Local test policy',
            path='/service-role/',
        )

    @patch('dashboard.iam_views.create_policy_version')
    def test_create_policy_version_endpoint_uses_action_helper(self, create_policy_version):
        create_policy_version.return_value = {'arn': 'arn:aws:iam::000000000000:policy/Local', 'version_id': 'v2'}
        document = {'Version': '2012-10-17', 'Statement': []}

        response = self.client.post(
            reverse('dashboard:iam-managed-policy-versions'),
            data=json.dumps({
                'policy_arn': 'arn:aws:iam::000000000000:policy/Local',
                'document': document,
                'set_as_default': False,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['version_id'], 'v2')
        create_policy_version.assert_called_once_with(
            'arn:aws:iam::000000000000:policy/Local',
            document,
            set_as_default=False,
        )

    @patch('dashboard.iam_views.set_default_policy_version')
    def test_set_default_policy_version_endpoint_uses_action_helper(self, set_default_policy_version):
        set_default_policy_version.return_value = {
            'arn': 'arn:aws:iam::000000000000:policy/Local',
            'version_id': 'v2',
            'default': True,
        }

        response = self.client.put(
            reverse('dashboard:iam-managed-policy-version-detail'),
            data=json.dumps({
                'policy_arn': 'arn:aws:iam::000000000000:policy/Local',
                'version_id': 'v2',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['default'])
        set_default_policy_version.assert_called_once_with('arn:aws:iam::000000000000:policy/Local', 'v2')

    @patch('dashboard.iam_views.delete_policy_version')
    def test_delete_policy_version_endpoint_uses_action_helper(self, delete_policy_version):
        delete_policy_version.return_value = {
            'arn': 'arn:aws:iam::000000000000:policy/Local',
            'version_id': 'v1',
            'deleted': True,
        }

        response = self.client.delete(
            reverse('dashboard:iam-managed-policy-version-detail'),
            data=json.dumps({
                'policy_arn': 'arn:aws:iam::000000000000:policy/Local',
                'version_id': 'v1',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['deleted'])
        delete_policy_version.assert_called_once_with('arn:aws:iam::000000000000:policy/Local', 'v1')
