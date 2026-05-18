import json
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse

from .dynamodb_api import execute_select_statement


class DynamoDBPageTemplateTests(SimpleTestCase):
    def test_dynamodb_service_page_keeps_readonly_inventory_and_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'dynamodb'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>DynamoDB inventory</h2>', html=True)
        self.assertContains(response, 'id="dynamodb-summary"')
        self.assertContains(response, 'id="dynamodb-console-root"')
        self.assertContains(response, 'id="dynamodb-grid"')
        self.assertContains(response, 'dashboard/dynamodb-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/dynamodb-console.js')


class DynamoDBApiTests(SimpleTestCase):
    @patch('dashboard.dynamodb_views.scan_table')
    def test_scan_table_success(self, scan_mock):
        scan_mock.return_value = {
            'table': 'orders',
            'count': 1,
            'scanned_count': 1,
            'items': [{'pk': '1'}],
            'last_evaluated_key': None,
        }

        response = self.client.post(
            reverse('dashboard:dynamodb-table-scan', kwargs={'table_name': 'orders'}),
            data=json.dumps({'limit': 10}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], 1)
        scan_mock.assert_called_once_with('orders', limit=10, exclusive_start_key=None)

    @patch('dashboard.dynamodb_views.execute_select_statement')
    def test_partiql_select_success(self, execute_mock):
        execute_mock.return_value = {
            'statement': 'SELECT * FROM "orders"',
            'count': 1,
            'items': [{'pk': '1'}],
        }

        response = self.client.post(
            reverse('dashboard:dynamodb-partiql'),
            data=json.dumps({'statement': 'SELECT * FROM "orders"', 'limit': 5}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], 1)
        execute_mock.assert_called_once_with('SELECT * FROM "orders"', limit=5)

    def test_partiql_rejects_non_select(self):
        with self.assertRaisesMessage(ValueError, 'Only read-only SELECT statements are allowed'):
            execute_select_statement('DELETE FROM "orders"')
