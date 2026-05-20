import json
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse


class SecretsManagerPageTemplateTests(SimpleTestCase):
    def test_secretsmanager_service_page_keeps_readonly_inventory_and_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'secretsmanager'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>Secrets Manager inventory</h2>', html=True)
        self.assertContains(response, 'id="secretsmanager-summary"')
        self.assertContains(response, 'id="secretsmanager-console-root"')
        self.assertContains(response, 'id="secretsmanager-grid"')
        self.assertContains(response, 'dashboard/secretsmanager-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/secretsmanager-console.js')


class SecretsManagerActionsApiTests(SimpleTestCase):
    @patch('dashboard.secretsmanager_views.create_secret')
    def test_create_secret_success(self, create_mock):
        create_mock.return_value = {
            'name': '/local/app/db',
            'arn': 'arn:aws:secretsmanager:us-east-1:000000000000:secret:/local/app/db',
            'version_id': 'version-1',
        }

        response = self.client.post(
            reverse('dashboard:secretsmanager-secrets'),
            data=json.dumps({
                'name': '/local/app/db',
                'value': {'username': 'local', 'password': 'secret'},
                'description': 'local database',
                'kms_key_id': 'alias/local',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['version_id'], 'version-1')
        create_mock.assert_called_once_with(
            '/local/app/db',
            {'username': 'local', 'password': 'secret'},
            description='local database',
            kms_key_id='alias/local',
        )

    def test_create_secret_rejects_missing_name(self):
        response = self.client.post(
            reverse('dashboard:secretsmanager-secrets'),
            data=json.dumps({'value': 'secret'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['service'], 'secretsmanager')
        self.assertEqual(response.json()['operation'], 'create_secret')

    @patch('dashboard.secretsmanager_views.get_secret_value')
    def test_get_secret_value_success(self, get_mock):
        get_mock.return_value = {
            'name': '/local/app/db',
            'type': 'string',
            'value': '{"ok": true}',
            'json': {'ok': True},
        }

        response = self.client.get(
            reverse('dashboard:secretsmanager-secret-value', kwargs={'secret_id': '/local/app/db'}),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['json'], {'ok': True})
        get_mock.assert_called_once_with('/local/app/db')

    @patch('dashboard.secretsmanager_views.put_secret_value')
    def test_put_secret_value_success(self, put_mock):
        put_mock.return_value = {
            'name': '/local/app/db',
            'version_id': 'version-2',
        }

        response = self.client.put(
            reverse('dashboard:secretsmanager-secret-value', kwargs={'secret_id': '/local/app/db'}),
            data=json.dumps({'value': {'ok': True}}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['version_id'], 'version-2')
        put_mock.assert_called_once_with('/local/app/db', {'ok': True})

    @patch('dashboard.secretsmanager_views.delete_secret')
    def test_delete_secret_success(self, delete_mock):
        delete_mock.return_value = {
            'name': '/local/app/db',
            'deletion_date': '2026-05-27T00:00:00',
        }

        response = self.client.delete(
            reverse('dashboard:secretsmanager-secret-value', kwargs={'secret_id': '/local/app/db'}),
            data=json.dumps({'recovery_window_days': 7}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], '/local/app/db')
        delete_mock.assert_called_once_with(
            '/local/app/db',
            recovery_window_days=7,
            force_delete_without_recovery=False,
        )
