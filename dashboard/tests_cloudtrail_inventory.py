from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse

from .services import get_service


class CloudTrailInventoryTests(SimpleTestCase):
    def test_cloudtrail_service_page_renders_inventory_shell(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'cloudtrail'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<title>CloudTrail - Floci Dashboard</title>', html=True)
        self.assertContains(response, 'Audit trails, logging status, event selectors, and tags')
        self.assertContains(response, 'id="cloudtrail-loaded-at"')
        self.assertContains(response, 'id="cloudtrail-summary"')
        self.assertContains(response, 'id="cloudtrail-grid"')

    def test_cloudtrail_registry_marks_service_inventory_only(self):
        service = get_service('cloudtrail')

        self.assertIsNotNone(service)
        self.assertEqual(service.maturity, 'inventory_only')
        self.assertEqual(service.api_path, None)
        self.assertEqual(service.category, 'Observability')

    @patch('dashboard.views.cloudtrail_inventory')
    def test_cloudtrail_api_returns_inventory(self, inventory):
        inventory.return_value = {
            'summary': {'trails': 1, 'logging': 1, 'multi_region_trails': 0},
            'trails': [{'name': 'local-audit', 'arn': 'arn:aws:cloudtrail:us-east-1:000000000000:trail/local-audit'}],
            'supported_from_sdk': ['CreateTrail', 'StartLogging', 'StopLogging', 'DeleteTrail'],
        }

        response = self.client.get(reverse('dashboard:cloudtrail'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['summary']['trails'], 1)
