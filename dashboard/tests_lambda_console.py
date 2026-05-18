import json
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse


class LambdaPageTemplateTests(SimpleTestCase):
    def test_lambda_service_page_keeps_readonly_inventory_and_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'lambda'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>Lambda inventory</h2>', html=True)
        self.assertContains(response, 'id="lambda-summary"')
        self.assertContains(response, 'id="lambda-console-root"')
        self.assertContains(response, 'id="lambda-grid"')
        self.assertContains(response, 'dashboard/lambda-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/lambda-console.js')


class LambdaFunctionsApiTests(SimpleTestCase):
    def test_invoke_function_rejects_invalid_payload(self):
        response = self.client.post(
            reverse('dashboard:lambda-functions-invoke', kwargs={'function_name': 'worker'}),
            data=json.dumps({'payload': '{bad json'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['service'], 'lambda')
        self.assertEqual(response.json()['operation'], 'invoke_function')

    @patch('dashboard.lambda_views.invoke_function')
    def test_invoke_function_success(self, invoke_mock):
        invoke_mock.return_value = {
            'function_name': 'worker',
            'status_code': 200,
            'payload': {'json': {'ok': True}, 'raw': '{"ok":true}'},
        }

        response = self.client.post(
            reverse('dashboard:lambda-functions-invoke', kwargs={'function_name': 'worker'}),
            data=json.dumps({'payload': {'hello': 'world'}, 'qualifier': 'prod'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status_code'], 200)
        invoke_mock.assert_called_once_with(
            'worker',
            {'hello': 'world'},
            qualifier='prod',
        )
