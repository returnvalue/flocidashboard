import json
import os
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse

from .aws import FlociClientFactory
from .services import SERVICE_PAGES, SERVICE_REGISTRY, SERVICES


class DashboardTemplateTests(SimpleTestCase):
    def test_home_page_renders_dashboard_shell(self):
        response = self.client.get(reverse('dashboard:index'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<title>Floci Dashboard</title>', html=True)
        self.assertContains(response, 'id="service-grid"')
        self.assertContains(response, 'dashboard/styles.css')
        self.assertContains(response, 'dashboard/dashboard.js')

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
                else:
                    self.assertContains(response, f'id="{key}-loaded-at"')
                    self.assertContains(response, f'id="{key}-summary"')
                    self.assertContains(response, f'id="{key}-grid"')

    def test_unknown_service_page_404s(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'not-a-service'}))

        self.assertEqual(response.status_code, 404)

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
        self.assertEqual(services['eventbridge']['maturity'], 'interactive_workbench')
        self.assertEqual(services['eventbridge']['console_js'], 'dashboard/eventbridge-console.js')
        eventbridge_actions = {action['name']: action for action in services['eventbridge']['actions']}
        self.assertEqual(eventbridge_actions['put_event']['method'], 'POST')
        self.assertEqual(eventbridge_actions['put_event']['kind'], 'execute')
        self.assertEqual(eventbridge_actions['put_event']['fields'][3]['field_type'], 'textarea')
        self.assertEqual(services['ec2']['maturity'], 'interactive_workbench')
        self.assertEqual(services['ec2']['console_js'], 'dashboard/ec2-console.js')
        ec2_actions = {action['name']: action for action in services['ec2']['actions']}
        self.assertEqual(ec2_actions['run_instances']['kind'], 'create')
        self.assertEqual(ec2_actions['run_instances']['fields'][5]['field_type'], 'textarea')
        self.assertEqual(ec2_actions['terminate_instance']['safety'], 'destructive')
        self.assertEqual(ec2_actions['import_key_pair']['fields'][1]['field_type'], 'textarea')
        self.assertEqual(services['lambda']['api_path'], '/api/lambda/')

    def test_service_pages_are_derived_from_registry(self):
        self.assertEqual(set(SERVICE_PAGES), set(SERVICE_REGISTRY))
        self.assertEqual(SERVICE_PAGES['s3']['title'], SERVICE_REGISTRY['s3'].title)

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


class FlociClientFactoryTests(SimpleTestCase):
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


class EC2ActionTests(SimpleTestCase):
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
