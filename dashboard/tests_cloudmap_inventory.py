from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse

from .services import get_service


class CloudMapInventoryTests(SimpleTestCase):
    def test_cloudmap_service_page_renders_inventory_shell(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'cloudmap'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<title>Cloud Map - Floci Dashboard</title>', html=True)
        self.assertContains(response, 'Service discovery namespaces, services, and instances')
        self.assertContains(response, 'id="cloudmap-loaded-at"')
        self.assertContains(response, 'id="cloudmap-summary"')
        self.assertContains(response, 'id="cloudmap-grid"')

    def test_cloudmap_registry_marks_service_inventory_only(self):
        service = get_service('cloudmap')

        self.assertIsNotNone(service)
        self.assertEqual(service.maturity, 'inventory_only')
        self.assertEqual(service.api_path, None)
        self.assertEqual(service.docs_url, 'https://floci.io/floci/services/cloudmap/')

    @patch('dashboard.views.cloudmap_inventory')
    def test_cloudmap_api_returns_inventory(self, inventory):
        inventory.return_value = {
            'summary': {'namespaces': 1, 'services': 1, 'instances': 1, 'operations': 0},
            'namespaces': [{'name': 'local.test', 'id': 'ns-1'}],
            'services': [{'name': 'api', 'id': 'srv-1'}],
            'instances': [{'id': 'instance-1', 'service_id': 'srv-1'}],
            'operations': [],
        }

        response = self.client.get(reverse('dashboard:cloudmap'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['summary']['namespaces'], 1)
