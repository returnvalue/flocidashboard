from pathlib import Path

from django.test import SimpleTestCase
from django.urls import reverse


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

    def test_console_exposes_resource_tabs_search_and_url_state(self):
        source = (
            Path(__file__).resolve().parent
            / 'static'
            / 'dashboard'
            / 'eventbridge-console.js'
        ).read_text(encoding='utf-8')

        for label in ('Event buses', 'Rules', 'Targets', 'Send events'):
            self.assertIn(label, source)
        self.assertIn("mode: 'table'", source)
        self.assertIn('Find ${title.toLowerCase()}', source)
        self.assertIn("params.get('view')", source)
        self.assertIn("params.get('bus')", source)
        self.assertIn("params.get('rule')", source)
        self.assertIn("params.get('target')", source)
        self.assertIn('window.history.replaceState', source)

    def test_console_links_targets_to_destination_workbenches_and_capstone(self):
        source = (
            Path(__file__).resolve().parent
            / 'static'
            / 'dashboard'
            / 'eventbridge-console.js'
        ).read_text(encoding='utf-8')

        self.assertIn("service === 'sqs'", source)
        self.assertIn("service === 'lambda'", source)
        self.assertIn("service === 'sns'", source)
        self.assertIn("service === 'states'", source)
        self.assertIn('/service/eventbridge/labs/?lab=application-spine', source)

    def test_empty_inventory_does_not_disable_create_bus(self):
        source = (
            Path(__file__).resolve().parent
            / 'static'
            / 'dashboard'
            / 'eventbridge-console.js'
        ).read_text(encoding='utf-8')

        self.assertNotIn('sendButton.disabled = !bus', source)
        self.assertIn("btn('Create event bus', null, showCreateBusModal)", source)
