import json
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse


class SQSPageTemplateTests(SimpleTestCase):
    def test_sqs_service_page_keeps_readonly_inventory_and_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'sqs'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>SQS inventory</h2>', html=True)
        self.assertContains(response, 'id="sqs-summary"')
        self.assertContains(response, 'id="sqs-console-root"')
        self.assertContains(response, 'id="sqs-grid"')
        self.assertContains(response, 'dashboard/sqs-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/sqs-console.js')


class SQSQueuesApiTests(SimpleTestCase):
    def test_create_queue_rejects_invalid_name(self):
        response = self.client.post(
            reverse('dashboard:sqs-queues'),
            data=json.dumps({'name': 'bad queue'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['service'], 'sqs')
        self.assertEqual(response.json()['operation'], 'create_queue')

    @patch('dashboard.sqs_views.create_queue')
    def test_create_queue_success(self, create_mock):
        create_mock.return_value = {'name': 'orders', 'url': 'http://localhost/000000000000/orders'}

        response = self.client.post(
            reverse('dashboard:sqs-queues'),
            data=json.dumps({'name': 'orders', 'fifo': False}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'orders')
        create_mock.assert_called_once_with('orders', fifo=False, visibility_timeout=None)

    @patch('dashboard.sqs_views.send_message')
    def test_send_message_success(self, send_mock):
        send_mock.return_value = {'message_id': 'abc123'}

        response = self.client.post(
            reverse('dashboard:sqs-messages-send', kwargs={'queue_name': 'orders'}),
            data=json.dumps({'body': 'hello'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['message_id'], 'abc123')
        send_mock.assert_called_once_with(
            'orders',
            'hello',
            delay_seconds=None,
            message_group_id=None,
            message_deduplication_id=None,
        )

    @patch('dashboard.sqs_views.receive_messages')
    def test_receive_messages_success(self, receive_mock):
        receive_mock.return_value = {'queue': 'orders', 'messages': [{'MessageId': 'abc123'}]}

        response = self.client.post(
            reverse('dashboard:sqs-messages-receive', kwargs={'queue_name': 'orders'}),
            data=json.dumps({'max_number': 2}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['messages']), 1)
        receive_mock.assert_called_once_with(
            'orders',
            max_number=2,
            visibility_timeout=None,
            wait_time_seconds=0,
        )

    @patch('dashboard.sqs_views.delete_message')
    def test_delete_message_success(self, delete_mock):
        delete_mock.return_value = {'queue': 'orders', 'deleted': 'true'}

        response = self.client.delete(
            reverse('dashboard:sqs-message-delete', kwargs={'queue_name': 'orders'}),
            data=json.dumps({'receipt_handle': 'receipt'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        delete_mock.assert_called_once_with('orders', 'receipt')

    @patch('dashboard.sqs_views.purge_queue')
    def test_purge_queue_success(self, purge_mock):
        purge_mock.return_value = {'name': 'orders', 'purged': 'true'}

        response = self.client.post(reverse('dashboard:sqs-queue-purge', kwargs={'queue_name': 'orders'}))

        self.assertEqual(response.status_code, 200)
        purge_mock.assert_called_once_with('orders')
