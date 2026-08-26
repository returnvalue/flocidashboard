import json
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse


class SNSPageTemplateTests(SimpleTestCase):
    def test_sns_service_page_keeps_readonly_inventory_and_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'sns'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>SNS inventory</h2>', html=True)
        self.assertContains(response, 'id="sns-summary"')
        self.assertContains(response, 'id="sns-console-root"')
        self.assertNotContains(response, 'id="sns-grid"')
        self.assertContains(response, 'dashboard/sns-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/sns-console.js')


class SNSMessagesApiTests(SimpleTestCase):
    def test_publish_message_rejects_missing_topic(self):
        response = self.client.post(
            reverse('dashboard:sns-messages-publish'),
            data=json.dumps({'message': 'hello'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['service'], 'sns')
        self.assertEqual(response.json()['operation'], 'publish_message')

    @patch('dashboard.sns_views.publish_message')
    def test_publish_message_success(self, publish_mock):
        publish_mock.return_value = {'message_id': 'abc123'}
        topic_arn = 'arn:aws:sns:us-east-1:000000000000:orders'

        response = self.client.post(
            reverse('dashboard:sns-messages-publish'),
            data=json.dumps({
                'topic_arn': topic_arn,
                'message': 'hello',
                'subject': 'Test',
                'message_attributes': {'eventType': 'created'},
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['message_id'], 'abc123')
        publish_mock.assert_called_once_with(
            topic_arn,
            'hello',
            subject='Test',
            message_attributes={'eventType': 'created'},
            message_structure=None,
            message_group_id=None,
            message_deduplication_id=None,
        )

    @patch('dashboard.sns_views.create_topic')
    def test_create_topic_success(self, create_mock):
        create_mock.return_value = {'name': 'events', 'topic_arn': 'arn:aws:sns:us-east-1:000000000000:events'}

        response = self.client.post(
            reverse('dashboard:sns-topics-create'),
            data=json.dumps({'name': 'events', 'fifo': False}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'events')
        create_mock.assert_called_once_with('events', fifo=False, display_name=None, kms_master_key_id=None)

    @patch('dashboard.sns_views.delete_topic')
    def test_delete_topic_success(self, delete_mock):
        delete_mock.return_value = {'topic_arn': 'arn:aws:sns:us-east-1:000000000000:events', 'deleted': True}

        response = self.client.delete(
            reverse('dashboard:sns-topic-detail', kwargs={'topic_arn': 'arn:aws:sns:us-east-1:000000000000:events'}),
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['deleted'])
        delete_mock.assert_called_once_with('arn:aws:sns:us-east-1:000000000000:events')

    @patch('dashboard.sns_views.subscribe')
    def test_subscribe_success(self, sub_mock):
        sub_mock.return_value = {
            'topic_arn': 'arn:aws:sns:us-east-1:000000000000:events',
            'subscription_arn': 'arn:aws:sns:us-east-1:000000000000:events:sub-101',
        }

        response = self.client.post(
            reverse('dashboard:sns-subscriptions-create'),
            data=json.dumps({
                'topic_arn': 'arn:aws:sns:us-east-1:000000000000:events',
                'protocol': 'sqs',
                'endpoint': 'arn:aws:sqs:us-east-1:000000000000:orders',
                'filter_policy': {'event_type': ['order_created']},
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['subscription_arn'], 'arn:aws:sns:us-east-1:000000000000:events:sub-101')
        sub_mock.assert_called_once_with(
            'arn:aws:sns:us-east-1:000000000000:events',
            'sqs',
            'arn:aws:sqs:us-east-1:000000000000:orders',
            filter_policy={'event_type': ['order_created']},
            raw_message_delivery=False,
        )

    @patch('dashboard.sns_views.unsubscribe')
    def test_unsubscribe_success(self, unsub_mock):
        unsub_mock.return_value = {'subscription_arn': 'arn:aws:sns:...:sub-101', 'unsubscribed': True}

        response = self.client.delete(
            reverse('dashboard:sns-subscription-detail', kwargs={'subscription_arn': 'arn:aws:sns:...:sub-101'}),
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['unsubscribed'])
        unsub_mock.assert_called_once_with('arn:aws:sns:...:sub-101')

