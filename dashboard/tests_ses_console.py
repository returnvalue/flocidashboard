import json
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse

from .services import get_service


class SESPageTemplateTests(SimpleTestCase):
    def test_ses_service_page_keeps_readonly_inventory_and_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'ses'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>SES inventory</h2>', html=True)
        self.assertContains(response, 'id="ses-summary"')
        self.assertContains(response, 'id="ses-console-root"')
        self.assertContains(response, 'id="ses-grid"')
        self.assertContains(response, 'dashboard/ses-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/ses-console.js')

    def test_ses_registry_marks_service_interactive(self):
        service = get_service('ses')

        self.assertIsNotNone(service)
        self.assertEqual(service.maturity, 'interactive_workbench')
        self.assertEqual(service.console_js, 'dashboard/ses-console.js')
        self.assertTrue(any(action.name == 'verify_email_identity' for action in service.actions))
        self.assertTrue(any(action.name == 'send_email' for action in service.actions))
        self.assertTrue(any(action.name == 'create_template' for action in service.actions))
        self.assertTrue(any(action.name == 'clear_mailbox' for action in service.actions))


class SESActionsApiTests(SimpleTestCase):
    @patch('dashboard.ses_views.verify_email_identity')
    def test_verify_email_identity_success(self, verify_mock):
        verify_mock.return_value = {'identity': 'sender@example.com'}

        response = self.client.post(
            reverse('dashboard:ses-identities-email'),
            data=json.dumps({'email_address': 'sender@example.com'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        verify_mock.assert_called_once_with('sender@example.com')

    def test_verify_email_identity_rejects_invalid_json(self):
        response = self.client.post(
            reverse('dashboard:ses-identities-email'),
            data='not-json',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['service'], 'ses')
        self.assertEqual(response.json()['operation'], 'verify_email_identity')

    @patch('dashboard.ses_views.verify_domain_identity')
    def test_verify_domain_identity_success(self, verify_mock):
        verify_mock.return_value = {'identity': 'example.com'}

        response = self.client.post(
            reverse('dashboard:ses-identities-domain'),
            data=json.dumps({'domain': 'example.com'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        verify_mock.assert_called_once_with('example.com')

    @patch('dashboard.ses_views.delete_identity')
    def test_delete_identity_success(self, delete_mock):
        delete_mock.return_value = {'identity': 'sender@example.com'}

        response = self.client.delete(reverse('dashboard:ses-identity-detail', kwargs={'identity': 'sender@example.com'}))

        self.assertEqual(response.status_code, 200)
        delete_mock.assert_called_once_with('sender@example.com')

    @patch('dashboard.ses_views.send_email')
    def test_send_email_success(self, send_mock):
        send_mock.return_value = {'message_id': 'msg-1'}

        response = self.client.post(
            reverse('dashboard:ses-email-send'),
            data=json.dumps({
                'source': 'sender@example.com',
                'to_addresses': ['recipient@example.com'],
                'subject': 'Hello',
                'text': 'Body',
                'html': '',
                'cc_addresses': [],
                'bcc_addresses': [],
                'configuration_set_name': 'local-events',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        send_mock.assert_called_once_with(
            source='sender@example.com',
            to_addresses=['recipient@example.com'],
            subject='Hello',
            text='Body',
            html='',
            cc_addresses=[],
            bcc_addresses=[],
            configuration_set_name='local-events',
        )

    @patch('dashboard.ses_views.send_raw_email')
    def test_send_raw_email_success(self, send_mock):
        send_mock.return_value = {'message_id': 'msg-1'}

        response = self.client.post(
            reverse('dashboard:ses-raw-email-send'),
            data=json.dumps({
                'source': 'sender@example.com',
                'destinations': ['recipient@example.com'],
                'raw_message': 'Subject: Raw\r\n\r\nBody',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        send_mock.assert_called_once_with(
            source='sender@example.com',
            destinations=['recipient@example.com'],
            raw_message='Subject: Raw\r\n\r\nBody',
        )

    @patch('dashboard.ses_views.send_templated_email')
    def test_send_templated_email_success(self, send_mock):
        send_mock.return_value = {'message_id': 'msg-1'}

        response = self.client.post(
            reverse('dashboard:ses-templated-email-send'),
            data=json.dumps({
                'source': 'sender@example.com',
                'to_addresses': ['recipient@example.com'],
                'template_name': 'order-receipt',
                'template_data': '{"name":"Alice"}',
                'configuration_set_name': '',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        send_mock.assert_called_once_with(
            source='sender@example.com',
            to_addresses=['recipient@example.com'],
            template_name='order-receipt',
            template_data='{"name":"Alice"}',
            configuration_set_name='',
        )

    @patch('dashboard.ses_views.create_template')
    def test_create_template_success(self, create_mock):
        create_mock.return_value = {'template_name': 'order-receipt'}

        response = self.client.post(
            reverse('dashboard:ses-templates'),
            data=json.dumps({'template_name': 'order-receipt', 'subject': 'Hi', 'text': 'Text', 'html': '<p>Hi</p>'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_mock.assert_called_once_with('order-receipt', subject='Hi', text='Text', html='<p>Hi</p>')

    @patch('dashboard.ses_views.update_template')
    def test_update_template_success(self, update_mock):
        update_mock.return_value = {'template_name': 'order-receipt'}

        response = self.client.patch(
            reverse('dashboard:ses-template-detail', kwargs={'template_name': 'order-receipt'}),
            data=json.dumps({'subject': 'Hi', 'text': 'Text', 'html': '<p>Hi</p>'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        update_mock.assert_called_once_with('order-receipt', subject='Hi', text='Text', html='<p>Hi</p>')

    @patch('dashboard.ses_views.delete_template')
    def test_delete_template_success(self, delete_mock):
        delete_mock.return_value = {'template_name': 'order-receipt'}

        response = self.client.delete(reverse('dashboard:ses-template-detail', kwargs={'template_name': 'order-receipt'}))

        self.assertEqual(response.status_code, 200)
        delete_mock.assert_called_once_with('order-receipt')

    @patch('dashboard.ses_views.render_template')
    def test_render_template_success(self, render_mock):
        render_mock.return_value = {'template_name': 'order-receipt', 'rendered_template': 'Hi Alice'}

        response = self.client.post(
            reverse('dashboard:ses-template-render', kwargs={'template_name': 'order-receipt'}),
            data=json.dumps({'template_data': '{"name":"Alice"}'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        render_mock.assert_called_once_with('order-receipt', '{"name":"Alice"}')

    @patch('dashboard.ses_views.update_sending_enabled')
    def test_update_sending_enabled_success(self, update_mock):
        update_mock.return_value = {'enabled': False}

        response = self.client.put(
            reverse('dashboard:ses-account-sending'),
            data=json.dumps({'enabled': False}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        update_mock.assert_called_once_with(False)

    @patch('dashboard.ses_views.create_configuration_set')
    def test_create_configuration_set_success(self, create_mock):
        create_mock.return_value = {'configuration_set_name': 'local-events'}

        response = self.client.post(
            reverse('dashboard:ses-configuration-sets'),
            data=json.dumps({'name': 'local-events', 'tags': [{'Key': 'env', 'Value': 'dev'}]}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        create_mock.assert_called_once_with('local-events', tags=[{'Key': 'env', 'Value': 'dev'}])

    @patch('dashboard.ses_views.delete_configuration_set')
    def test_delete_configuration_set_success(self, delete_mock):
        delete_mock.return_value = {'configuration_set_name': 'local-events'}

        response = self.client.delete(reverse('dashboard:ses-configuration-set-detail', kwargs={'name': 'local-events'}))

        self.assertEqual(response.status_code, 200)
        delete_mock.assert_called_once_with('local-events')

    @patch('dashboard.ses_views.update_configuration_set_sending_enabled')
    def test_update_configuration_set_sending_success(self, update_mock):
        update_mock.return_value = {'configuration_set_name': 'local-events', 'enabled': False}

        response = self.client.put(
            reverse('dashboard:ses-configuration-set-sending', kwargs={'name': 'local-events'}),
            data=json.dumps({'enabled': False}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        update_mock.assert_called_once_with('local-events', False)

    @patch('dashboard.ses_views.put_event_destination')
    def test_put_event_destination_success(self, put_mock):
        event_destination = {'Enabled': True, 'MatchingEventTypes': ['SEND'], 'SnsDestination': {'TopicArn': 'arn'}}
        put_mock.return_value = {'configuration_set_name': 'local-events', 'event_destination_name': 'sns-events'}

        response = self.client.post(
            reverse('dashboard:ses-event-destinations', kwargs={'name': 'local-events'}),
            data=json.dumps({'event_destination_name': 'sns-events', 'event_destination': event_destination}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        put_mock.assert_called_once_with('local-events', 'sns-events', event_destination)

    @patch('dashboard.ses_views.delete_event_destination')
    def test_delete_event_destination_success(self, delete_mock):
        delete_mock.return_value = {'configuration_set_name': 'local-events', 'event_destination_name': 'sns-events'}

        response = self.client.delete(reverse(
            'dashboard:ses-event-destination-detail',
            kwargs={'name': 'local-events', 'event_destination_name': 'sns-events'},
        ))

        self.assertEqual(response.status_code, 200)
        delete_mock.assert_called_once_with('local-events', 'sns-events')

    @patch('dashboard.ses_views.clear_mailbox')
    def test_clear_mailbox_success(self, clear_mock):
        clear_mock.return_value = {'status': 200}

        response = self.client.delete(reverse('dashboard:ses-mailbox'))

        self.assertEqual(response.status_code, 200)
        clear_mock.assert_called_once_with()
