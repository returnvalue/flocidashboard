import json
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse

from .services import get_service


class FirehosePageTemplateTests(SimpleTestCase):
    def test_firehose_service_page_keeps_readonly_inventory_and_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'firehose'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>Data Firehose inventory</h2>', html=True)
        self.assertContains(response, 'id="firehose-summary"')
        self.assertContains(response, 'id="firehose-console-root"')
        self.assertContains(response, 'id="firehose-grid"')
        self.assertContains(response, 'dashboard/firehose-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/firehose-console.js')

    def test_firehose_registry_marks_service_interactive(self):
        service = get_service('firehose')

        self.assertIsNotNone(service)
        self.assertEqual(service.maturity, 'interactive_workbench')
        self.assertEqual(service.console_js, 'dashboard/firehose-console.js')
        self.assertTrue(any(action.name == 'create_delivery_stream' for action in service.actions))
        self.assertTrue(any(action.name == 'put_record' for action in service.actions))
        self.assertTrue(any(action.name == 'put_record_batch' for action in service.actions))


class FirehoseActionsApiTests(SimpleTestCase):
    @patch('dashboard.firehose_views.create_delivery_stream')
    def test_create_delivery_stream_success(self, create_mock):
        create_mock.return_value = {'name': 'orders'}

        response = self.client.post(
            reverse('dashboard:firehose-delivery-streams'),
            data=json.dumps({
                'name': 'orders',
                'tags': [{'Key': 'env', 'Value': 'local'}],
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'orders')
        create_mock.assert_called_once_with('orders', tags=[{'Key': 'env', 'Value': 'local'}])

    def test_create_delivery_stream_rejects_invalid_json(self):
        response = self.client.post(
            reverse('dashboard:firehose-delivery-streams'),
            data='not-json',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['service'], 'firehose')
        self.assertEqual(response.json()['operation'], 'create_delivery_stream')

    @patch('dashboard.firehose_views.delete_delivery_stream')
    def test_delete_delivery_stream_success(self, delete_mock):
        delete_mock.return_value = {'name': 'orders'}

        response = self.client.delete(reverse(
            'dashboard:firehose-delivery-stream-detail',
            kwargs={'stream_name': 'orders'},
        ))

        self.assertEqual(response.status_code, 200)
        delete_mock.assert_called_once_with('orders')

    @patch('dashboard.firehose_views.put_record')
    def test_put_record_success(self, put_mock):
        put_mock.return_value = {'stream_name': 'orders', 'record_id': 'record-1'}

        response = self.client.post(
            reverse('dashboard:firehose-records-put', kwargs={'stream_name': 'orders'}),
            data=json.dumps({'data': {'id': 1, 'amount': 10.5}}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['record_id'], 'record-1')
        put_mock.assert_called_once_with('orders', {'id': 1, 'amount': 10.5})

    @patch('dashboard.firehose_views.put_record_batch')
    def test_put_record_batch_success(self, batch_mock):
        records = [{'id': 1}, {'id': 2}]
        batch_mock.return_value = {'stream_name': 'orders', 'record_count': 2}

        response = self.client.post(
            reverse('dashboard:firehose-records-batch', kwargs={'stream_name': 'orders'}),
            data=json.dumps({'records': records}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['record_count'], 2)
        batch_mock.assert_called_once_with('orders', records)
