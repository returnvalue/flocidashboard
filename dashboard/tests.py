import json
import os
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse

from .aws import FlociClientFactory
from .views import SERVICE_PAGES


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
                    self.assertContains(response, 'id="s3-console-root"')
                    self.assertContains(response, 'dashboard/s3-console.js')
                else:
                    self.assertContains(response, f'id="{key}-loaded-at"')
                    self.assertContains(response, f'id="{key}-summary"')
                    self.assertContains(response, f'id="{key}-grid"')

    def test_unknown_service_page_404s(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'not-a-service'}))

        self.assertEqual(response.status_code, 404)


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


