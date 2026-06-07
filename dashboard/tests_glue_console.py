import json
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse

from .services import get_service


class GluePageTemplateTests(SimpleTestCase):
    def test_glue_service_page_keeps_readonly_inventory_and_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'glue'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>Glue inventory</h2>', html=True)
        self.assertContains(response, 'id="glue-summary"')
        self.assertContains(response, 'id="glue-console-root"')
        self.assertContains(response, 'id="glue-grid"')
        self.assertContains(response, 'dashboard/glue-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/glue-console.js')

    def test_glue_registry_marks_service_interactive(self):
        service = get_service('glue')

        self.assertIsNotNone(service)
        self.assertEqual(service.maturity, 'interactive_workbench')
        self.assertEqual(service.console_js, 'dashboard/glue-console.js')
        self.assertTrue(any(action.name == 'create_database' for action in service.actions))
        self.assertTrue(any(action.name == 'create_table' for action in service.actions))
        self.assertTrue(any(action.name == 'create_user_defined_function' for action in service.actions))
        self.assertTrue(any(action.name == 'create_registry' for action in service.actions))
        self.assertTrue(any(action.name == 'register_schema_version' for action in service.actions))


class GlueActionsApiTests(SimpleTestCase):
    @patch('dashboard.glue_views.create_database')
    def test_create_database_success(self, create_mock):
        create_mock.return_value = {'database': 'analytics'}

        response = self.client.post(
            reverse('dashboard:glue-databases'),
            data=json.dumps({
                'name': 'analytics',
                'description': 'Local analytics',
                'location_uri': 's3://my-bucket/',
                'parameters': {'env': 'local'},
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['database'], 'analytics')
        create_mock.assert_called_once_with(
            'analytics',
            description='Local analytics',
            location_uri='s3://my-bucket/',
            parameters={'env': 'local'},
        )

    def test_create_database_rejects_invalid_json(self):
        response = self.client.post(
            reverse('dashboard:glue-databases'),
            data='not-json',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['service'], 'glue')
        self.assertEqual(response.json()['operation'], 'create_database')

    @patch('dashboard.glue_views.delete_database')
    def test_delete_database_success(self, delete_mock):
        delete_mock.return_value = {'database': 'analytics'}

        response = self.client.delete(reverse('dashboard:glue-database-detail', kwargs={'database_name': 'analytics'}))

        self.assertEqual(response.status_code, 200)
        delete_mock.assert_called_once_with('analytics')

    @patch('dashboard.glue_views.create_table')
    def test_create_table_success(self, create_mock):
        table_input = {'Name': 'orders', 'StorageDescriptor': {'Columns': []}}
        create_mock.return_value = {'database': 'analytics', 'table': 'orders'}

        response = self.client.post(
            reverse('dashboard:glue-tables', kwargs={'database_name': 'analytics'}),
            data=json.dumps({'table_input': table_input}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_mock.assert_called_once_with('analytics', table_input)

    @patch('dashboard.glue_views.delete_table')
    def test_delete_table_success(self, delete_mock):
        delete_mock.return_value = {'database': 'analytics', 'table': 'orders'}

        response = self.client.delete(reverse(
            'dashboard:glue-table-detail',
            kwargs={'database_name': 'analytics', 'table_name': 'orders'},
        ))

        self.assertEqual(response.status_code, 200)
        delete_mock.assert_called_once_with('analytics', 'orders')

    @patch('dashboard.glue_views.create_partition')
    def test_create_partition_success(self, create_mock):
        create_mock.return_value = {'database': 'analytics', 'table': 'orders', 'values': ['2026']}

        response = self.client.post(
            reverse('dashboard:glue-partitions', kwargs={'database_name': 'analytics', 'table_name': 'orders'}),
            data=json.dumps({
                'values': ['2026'],
                'storage_descriptor': {'Location': 's3://my-bucket/orders/year=2026/'},
                'parameters': {'env': 'local'},
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_mock.assert_called_once_with(
            'analytics',
            'orders',
            values=['2026'],
            storage_descriptor={'Location': 's3://my-bucket/orders/year=2026/'},
            parameters={'env': 'local'},
        )

    @patch('dashboard.glue_views.create_user_defined_function')
    def test_create_user_defined_function_success(self, create_mock):
        function_input = {
            'FunctionName': 'normalize_order',
            'ClassName': 'com.example.NormalizeOrder',
            'OwnerName': 'local',
            'OwnerType': 'USER',
            'ResourceUris': [{'ResourceType': 'JAR', 'Uri': 's3://bucket/udf.jar'}],
        }
        create_mock.return_value = {'database': 'analytics', 'function': 'normalize_order'}

        response = self.client.post(
            reverse('dashboard:glue-functions', kwargs={'database_name': 'analytics'}),
            data=json.dumps({'function_input': function_input}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_mock.assert_called_once_with('analytics', function_input)

    @patch('dashboard.glue_views.delete_user_defined_function')
    def test_delete_user_defined_function_success(self, delete_mock):
        delete_mock.return_value = {'database': 'analytics', 'function': 'normalize_order'}

        response = self.client.delete(reverse(
            'dashboard:glue-function-detail',
            kwargs={'database_name': 'analytics', 'function_name': 'normalize_order'},
        ))

        self.assertEqual(response.status_code, 200)
        delete_mock.assert_called_once_with('analytics', 'normalize_order')

    @patch('dashboard.glue_views.create_registry')
    def test_create_registry_success(self, create_mock):
        create_mock.return_value = {'registry': 'local-registry'}

        response = self.client.post(
            reverse('dashboard:glue-registries'),
            data=json.dumps({
                'registry_name': 'local-registry',
                'description': 'Local schemas',
                'tags': {'env': 'local'},
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_mock.assert_called_once_with(
            'local-registry',
            description='Local schemas',
            tags={'env': 'local'},
        )

    @patch('dashboard.glue_views.create_schema')
    def test_create_schema_success(self, create_mock):
        definition = '{"type":"record","name":"Order","fields":[{"name":"id","type":"long"}]}'
        create_mock.return_value = {'registry': 'local-registry', 'schema': 'orders'}

        response = self.client.post(
            reverse('dashboard:glue-schemas'),
            data=json.dumps({
                'registry_name': 'local-registry',
                'schema_name': 'orders',
                'data_format': 'AVRO',
                'compatibility': 'BACKWARD',
                'schema_definition': definition,
                'description': 'Order events',
                'tags': {'env': 'local'},
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_mock.assert_called_once_with(
            'local-registry',
            'orders',
            data_format='AVRO',
            compatibility='BACKWARD',
            schema_definition=definition,
            description='Order events',
            tags={'env': 'local'},
        )

    @patch('dashboard.glue_views.register_schema_version')
    def test_register_schema_version_success(self, register_mock):
        definition = '{"type":"record","name":"Order","fields":[{"name":"id","type":"long"}]}'
        register_mock.return_value = {'registry': 'local-registry', 'schema': 'orders'}

        response = self.client.post(
            reverse('dashboard:glue-schema-versions'),
            data=json.dumps({
                'registry_name': 'local-registry',
                'schema_name': 'orders',
                'schema_definition': definition,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        register_mock.assert_called_once_with('local-registry', 'orders', definition)
