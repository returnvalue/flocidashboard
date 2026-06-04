import json
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from django.urls import reverse

from .appsync_api import create_graphql_api, start_schema_creation
from .aws import appsync_inventory, list_resources
from .services import get_service


class AppSyncPageTests(SimpleTestCase):
    def test_page_renders_phase_one_inventory(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'appsync'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>AppSync inventory</h2>', html=True)
        self.assertContains(response, 'id="appsync-console-root"')
        self.assertContains(response, 'id="appsync-grid"')
        self.assertContains(response, 'dashboard/appsync-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/appsync-console.js')
        self.assertContains(response, 'AppSync Phase 1 management API emulation')

    def test_registry_marks_appsync_as_interactive(self):
        service = get_service('appsync')

        self.assertEqual(service.maturity, 'interactive_workbench')
        self.assertEqual(service.console_js, 'dashboard/appsync-console.js')
        self.assertTrue(any(action.name == 'create_graphql_api' for action in service.actions))
        self.assertTrue(any(action.name == 'start_schema_creation' for action in service.actions))
        self.assertTrue(any(action.name == 'delete_graphql_api' for action in service.actions))


class AppSyncInventoryTests(SimpleTestCase):
    @patch('dashboard.views.appsync_inventory')
    def test_inventory_endpoint(self, inventory_mock):
        inventory_mock.return_value = {'summary': {'graphql_apis': 1}}

        response = self.client.get(reverse('dashboard:appsync'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['summary']['graphql_apis'], 1)

    @patch('dashboard.aws._operation_items')
    @patch('dashboard.aws.FlociClientFactory')
    def test_inventory_collects_phase_one_resources(self, factory_mock, items_mock):
        client = MagicMock()
        factory_mock.return_value.client.return_value = client
        client.list_tags_for_resource.return_value = {'tags': {'env': 'test'}}
        client.get_schema_creation_status.return_value = {'status': 'ACTIVE'}

        def items(_client, operation, _result_key, **_kwargs):
            return {
                'list_graphql_apis': [{
                    'apiId': 'api-1',
                    'name': 'orders',
                    'arn': 'arn:aws:appsync:us-east-1:000000000000:apis/api-1',
                    'authenticationType': 'API_KEY',
                }],
                'list_api_keys': [{'id': 'key-1'}],
                'list_data_sources': [{'name': 'none-ds', 'type': 'NONE'}],
                'list_functions': [{'name': 'normalize', 'functionId': 'fn-1'}],
                'list_types': [{'name': 'Query', 'definition': 'type Query { hello: String }'}],
                'list_resolvers': [{'fieldName': 'hello', 'dataSourceName': 'none-ds'}],
            }[operation]

        items_mock.side_effect = items

        result = appsync_inventory()

        self.assertEqual(result['summary']['graphql_apis'], 1)
        self.assertEqual(result['summary']['resolvers'], 1)
        self.assertEqual(result['graphql_apis'][0]['schema_status']['status'], 'ACTIVE')
        self.assertEqual(result['graphql_apis'][0]['tags']['env'], 'test')

    @patch('dashboard.aws._operation_items')
    @patch('dashboard.aws.FlociClientFactory')
    def test_global_resources_include_phase_one_resolvers(self, factory_mock, items_mock):
        factory_mock.return_value.client.return_value = MagicMock()

        def items(_client, operation, _result_key, **_kwargs):
            return {
                'list_graphql_apis': [{'apiId': 'api-1', 'name': 'orders'}],
                'list_api_keys': [{'id': 'key-1'}],
                'list_data_sources': [{'name': 'none-ds', 'type': 'NONE'}],
                'list_functions': [{'name': 'normalize', 'functionId': 'fn-1'}],
                'list_types': [{'name': 'Query'}],
                'list_resolvers': [{'fieldName': 'hello'}],
            }[operation]

        items_mock.side_effect = items

        result = list_resources({'appsync'})

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].name, 'appsync-resources')
        self.assertEqual(
            {item['type'] for item in result[0].items},
            {'graphql_api', 'api_key', 'data_source', 'function', 'type', 'resolver'},
        )
        resolver = next(item for item in result[0].items if item['type'] == 'resolver')
        self.assertEqual(resolver['type_name'], 'Query')
        data_source = next(item for item in result[0].items if item['type'] == 'data_source')
        self.assertEqual(data_source['source_type'], 'NONE')


class AppSyncActionsTests(SimpleTestCase):
    @patch('dashboard.appsync_views.create_graphql_api')
    def test_create_graphql_api(self, create_mock):
        create_mock.return_value = {'api_id': 'api-1'}

        response = self.client.post(
            reverse('dashboard:appsync-apis'),
            data=json.dumps({'name': 'orders', 'authentication_type': 'API_KEY', 'tags': {'env': 'local'}}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_mock.assert_called_once_with('orders', authentication_type='API_KEY', tags={'env': 'local'})

    @patch('dashboard.appsync_views.start_schema_creation')
    def test_upload_schema(self, schema_mock):
        schema_mock.return_value = {'api_id': 'api-1', 'status': 'ACTIVE'}

        response = self.client.post(
            reverse('dashboard:appsync-schema', kwargs={'api_id': 'api-1'}),
            data=json.dumps({'definition': 'type Query { hello: String }'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        schema_mock.assert_called_once_with('api-1', 'type Query { hello: String }')

    @patch('dashboard.appsync_views.create_data_source')
    def test_create_data_source(self, create_mock):
        create_mock.return_value = {'api_id': 'api-1', 'data_source': {'name': 'none-ds'}}

        response = self.client.post(
            reverse('dashboard:appsync-data-sources', kwargs={'api_id': 'api-1'}),
            data=json.dumps({'name': 'none-ds', 'source_type': 'NONE', 'description': ''}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_mock.assert_called_once_with('api-1', 'none-ds', source_type='NONE', description='')

    @patch('dashboard.appsync_views.delete_graphql_api')
    def test_delete_graphql_api(self, delete_mock):
        delete_mock.return_value = {'api_id': 'api-1'}

        response = self.client.delete(reverse('dashboard:appsync-api-detail', kwargs={'api_id': 'api-1'}))

        self.assertEqual(response.status_code, 200)
        delete_mock.assert_called_once_with('api-1')

    def test_create_graphql_api_rejects_invalid_json(self):
        response = self.client.post(reverse('dashboard:appsync-apis'), data='bad', content_type='application/json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['operation'], 'create_graphql_api')


class AppSyncApiHelperTests(SimpleTestCase):
    @patch('dashboard.appsync_api._client')
    def test_create_graphql_api_uses_management_api(self, client_mock):
        client_mock.return_value.create_graphql_api.return_value = {'graphqlApi': {'apiId': 'api-1'}}

        result = create_graphql_api('orders', tags={'env': 'local'})

        self.assertEqual(result['api_id'], 'api-1')
        client_mock.return_value.create_graphql_api.assert_called_once_with(
            name='orders',
            authenticationType='API_KEY',
            tags={'env': 'local'},
        )

    @patch('dashboard.appsync_api._client')
    def test_schema_definition_is_encoded(self, client_mock):
        client_mock.return_value.start_schema_creation.return_value = {'status': 'ACTIVE'}

        result = start_schema_creation('api-1', 'type Query { hello: String }')

        self.assertEqual(result['status'], 'ACTIVE')
        client_mock.return_value.start_schema_creation.assert_called_once_with(
            apiId='api-1',
            definition=b'type Query { hello: String }',
        )
