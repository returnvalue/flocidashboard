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
        self.assertContains(response, 'id="sns-grid"')
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
