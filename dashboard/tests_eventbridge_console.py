import json
from pathlib import Path

from django.test import SimpleTestCase
from django.urls import reverse

from .eventbridge_api import test_event_pattern


class EventBridgeFirstClassConsoleTests(SimpleTestCase):
    def test_service_page_loads_first_class_console_assets(self):
        response = self.client.get(
            reverse('dashboard:service-page', kwargs={'service_key': 'eventbridge'}),
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="eventbridge-breadcrumbs"')
        self.assertContains(response, 'id="eventbridge-console-root"')
        self.assertContains(response, 'dashboard/eventbridge-console.css')
        self.assertContains(response, 'dashboard/eventbridge-console.js')

    def test_console_exposes_resource_tabs_and_tester(self):
        source = (
            Path(__file__).resolve().parent
            / 'static'
            / 'dashboard'
            / 'eventbridge-console.js'
        ).read_text(encoding='utf-8')

        for label in ('Event buses', 'Rules', 'Targets', 'Send events', 'Pattern Tester'):
            self.assertIn(label, source)
        self.assertIn("params.get('view')", source)
        self.assertIn("params.get('bus')", source)
        self.assertIn("params.get('rule')", source)
        self.assertIn("params.get('target')", source)
        self.assertIn('window.history.replaceState', source)

    def test_pattern_matching_engine(self):
        # Exact matching
        res = test_event_pattern({'source': ['aws.ec2']}, {'source': 'aws.ec2'})
        self.assertTrue(res['result'])

        # Numeric range matching
        res = test_event_pattern(
            {'detail': {'price': [{'numeric': ['>=', 50, '<=', 150]}]}},
            {'detail': {'price': 100}},
        )
        self.assertTrue(res['result'])

        # Prefix matching
        res = test_event_pattern(
            {'detail': {'file': [{'prefix': 'uploads/'}]}},
            {'detail': {'file': 'uploads/doc.pdf'}},
        )
        self.assertTrue(res['result'])

        # Suffix matching
        res = test_event_pattern(
            {'detail': {'file': [{'suffix': '.png'}]}},
            {'detail': {'file': 'uploads/image.png'}},
        )
        self.assertTrue(res['result'])

        # Exists matching
        res = test_event_pattern(
            {'detail': {'deleted': [{'exists': False}]}},
            {'detail': {'name': 'test'}},
        )
        self.assertTrue(res['result'])

        # Anything-but matching
        res = test_event_pattern(
            {'detail': {'tier': [{'anything-but': 'FRAUD'}]}},
            {'detail': {'tier': 'SILVER'}},
        )
        self.assertTrue(res['result'])

        # Mismatch
        res = test_event_pattern({'source': ['aws.ec2']}, {'source': 'aws.s3'})
        self.assertFalse(res['result'])
        self.assertEqual(len(res['mismatches']), 1)

    def test_pattern_test_endpoint(self):
        response = self.client.post(
            reverse('dashboard:eventbridge-pattern-test'),
            data=json.dumps({
                'event_pattern': {'source': ['aws.ec2']},
                'event': {'source': 'aws.ec2'},
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['result'])

    def test_sample_events_endpoint(self):
        response = self.client.get(reverse('dashboard:eventbridge-sample-events'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('ec2_instance_state', data)
        self.assertIn('s3_object_created', data)
        self.assertIn('custom_order_event', data)
