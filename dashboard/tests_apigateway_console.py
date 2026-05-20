import json
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from django.urls import reverse


class ApiGatewayPageTemplateTests(SimpleTestCase):
    def test_apigateway_service_page_keeps_readonly_inventory_and_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'apigateway'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>API Gateway inventory</h2>', html=True)
        self.assertContains(response, 'id="apigateway-summary"')
        self.assertContains(response, 'id="apigateway-console-root"')
        self.assertContains(response, 'id="apigateway-grid"')
        self.assertContains(response, 'dashboard/apigateway-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/apigateway-console.js')


class ApiGatewayRequestsApiTests(SimpleTestCase):
    @patch('dashboard.apigateway_api.urlopen')
    def test_test_request_success(self, urlopen_mock):
        response_mock = MagicMock()
        response_mock.__enter__.return_value = response_mock
        response_mock.read.return_value = b'{"ok": true}'
        response_mock.getcode.return_value = 200
        response_mock.headers.items.return_value = [('Content-Type', 'application/json')]
        urlopen_mock.return_value = response_mock

        response = self.client.post(
            reverse('dashboard:apigateway-requests-test'),
            data=json.dumps({
                'api_type': 'rest',
                'api_id': 'abc123',
                'stage': 'dev',
                'method': 'POST',
                'path': '/orders',
                'query': {'debug': True},
                'headers': {'X-Test': 'yes'},
                'body': {'order_id': '123'},
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status_code'], 200)
        self.assertEqual(payload['json'], {'ok': True})
        request = urlopen_mock.call_args.args[0]
        self.assertEqual(request.get_method(), 'POST')
        self.assertIn('/restapis/abc123/dev/_user_request_/orders?debug=True', request.full_url)

    def test_test_request_rejects_external_http_api_endpoint(self):
        response = self.client.post(
            reverse('dashboard:apigateway-requests-test'),
            data=json.dumps({
                'api_type': 'http',
                'api_id': 'abc123',
                'endpoint': 'https://example.com',
                'method': 'GET',
                'path': '/',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['service'], 'apigateway')
        self.assertEqual(response.json()['operation'], 'test_request')
