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
        self.assertEqual(services['lambda']['api_path'], '/api/lambda/')

    def test_service_pages_are_derived_from_registry(self):
        self.assertEqual(set(SERVICE_PAGES), set(SERVICE_REGISTRY))
        self.assertEqual(SERVICE_PAGES['s3']['title'], SERVICE_REGISTRY['s3'].title)


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
