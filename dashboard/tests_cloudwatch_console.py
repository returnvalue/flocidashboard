import json
from pathlib import Path
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


class CloudWatchStaticConsoleTests(SimpleTestCase):
    def test_log_groups_and_streams_use_shared_collection_helper(self):
        script = Path(__file__).resolve().parent / 'static' / 'dashboard' / 'cloudwatch-console.js'
        source = script.read_text()

        self.assertIn('consoleUi.renderCollection({', source)
        self.assertIn("filterPlaceholder: 'Find log groups'", source)
        self.assertIn('state.groupFilterText = value', source)
        self.assertIn("emptyFilteredTitle: 'No log groups match this filter.'", source)
        self.assertIn("filterPlaceholder: 'Find streams'", source)
        self.assertIn('state.streamFilterText = value', source)
        self.assertIn("emptyFilteredTitle: 'No streams match this filter.'", source)


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

    @patch('dashboard.cloudwatch_logs_views.start_logs_insights_query')
    def test_start_logs_insights_query_success(self, query_mock):
        query_mock.return_value = {
            'log_group_name': '/aws/lambda/worker',
            'query_id': 'query-1',
            'query_string': 'fields @message',
        }

        response = self.client.post(
            reverse('dashboard:cloudwatch-logs-insights-query'),
            data=json.dumps({
                'log_group_name': '/aws/lambda/worker',
                'query_string': 'fields @message',
                'limit': 25,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['query_id'], 'query-1')
        query_mock.assert_called_once_with(
            '/aws/lambda/worker',
            'fields @message',
            start_time=None,
            end_time=None,
            limit=25,
        )

    @patch('dashboard.cloudwatch_logs_views.get_logs_insights_query_results')
    def test_get_logs_insights_query_results_success(self, results_mock):
        results_mock.return_value = {
            'query_id': 'query-1',
            'status': 'Complete',
            'results': [[{'field': '@message', 'value': 'hello'}]],
        }

        response = self.client.post(
            reverse('dashboard:cloudwatch-logs-insights-results'),
            data=json.dumps({'query_id': 'query-1'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'Complete')
        results_mock.assert_called_once_with('query-1')
