import json
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse

from .services import get_service


class AppSyncConsoleTests(SimpleTestCase):
    def test_service_page_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'appsync'}))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="appsync-summary"')
        self.assertContains(response, 'id="appsync-console-root"')
        self.assertContains(response, 'dashboard/appsync-console.css')
        self.assertContains(response, 'dashboard/appsync-console.js')

    def test_appsync_registry_actions(self):
        actions = {action.name for action in get_service('appsync').actions}
        self.assertTrue({'create_graphql_api', 'delete_graphql_api', 'start_schema_creation', 'create_api_key', 'delete_api_key', 'create_data_source', 'delete_data_source', 'create_resolver', 'delete_resolver', 'execute_graphql'} <= actions)

    @patch('dashboard.appsync_views.execute_graphql')
    def test_graphql_run_endpoint_success(self, run_mock):
        run_mock.return_value = {
            'api_id': 'api-123',
            'status_code': 200,
            'latency_ms': 15.2,
            'data': {'hello': 'world'},
            'errors': None,
        }

        response = self.client.post(
            reverse('dashboard:appsync-graphql-run'),
            data=json.dumps({
                'api_id': 'api-123',
                'query': 'query { hello }',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data'], {'hello': 'world'})
        run_mock.assert_called_once_with(
            api_id='api-123',
            query='query { hello }',
            variables=None,
            operation_name=None,
            api_key=None,
            endpoint_url=None,
        )
