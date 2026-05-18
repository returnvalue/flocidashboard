import json
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse


class CloudWatchPageTemplateTests(SimpleTestCase):
    def test_cloudwatch_service_page_keeps_readonly_inventory_and_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'cloudwatch'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>CloudWatch inventory</h2>', html=True)
        self.assertContains(response, 'id="cloudwatch-summary"')
        self.assertContains(response, 'id="cloudwatch-console-root"')
        self.assertContains(response, 'id="cloudwatch-grid"')
        self.assertContains(response, 'dashboard/cloudwatch-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/cloudwatch-console.js')


class CloudWatchLogsApiTests(SimpleTestCase):
    @patch('dashboard.cloudwatch_logs_views.list_log_streams')
    def test_list_log_streams_success(self, streams_mock):
        streams_mock.return_value = {
            'log_group_name': '/aws/lambda/worker',
            'streams': [{'logStreamName': 'latest'}],
        }

        response = self.client.post(
            reverse('dashboard:cloudwatch-log-streams'),
            data=json.dumps({'log_group_name': '/aws/lambda/worker', 'limit': 25}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['streams']), 1)
        streams_mock.assert_called_once_with('/aws/lambda/worker', limit=25)

    @patch('dashboard.cloudwatch_logs_views.get_log_events')
    def test_get_log_events_success(self, events_mock):
        events_mock.return_value = {
            'log_group_name': '/aws/lambda/worker',
            'log_stream_name': 'latest',
            'events': [{'message': 'hello'}],
        }

        response = self.client.post(
            reverse('dashboard:cloudwatch-log-events'),
            data=json.dumps({
                'log_group_name': '/aws/lambda/worker',
                'log_stream_name': 'latest',
                'limit': 50,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['events'][0]['message'], 'hello')
        events_mock.assert_called_once_with(
            '/aws/lambda/worker',
            'latest',
            limit=50,
            start_time=None,
        )
