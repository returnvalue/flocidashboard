import json
from base64 import b64encode
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse

from .kms_api import generate_random
from .services import get_service


class KMSPageTemplateTests(SimpleTestCase):
    def test_kms_service_page_keeps_readonly_inventory_and_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'kms'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>KMS inventory</h2>', html=True)
        self.assertContains(response, 'id="kms-summary"')
        self.assertContains(response, 'id="kms-console-root"')
        self.assertContains(response, 'id="kms-grid"')
        self.assertContains(response, 'dashboard/kms-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/kms-console.js')

    def test_kms_registry_marks_service_interactive(self):
        service = get_service('kms')

        self.assertIsNotNone(service)
        self.assertEqual(service.maturity, 'interactive_workbench')
        self.assertEqual(service.console_js, 'dashboard/kms-console.js')
        self.assertTrue(any(action.name == 'encrypt' for action in service.actions))
        self.assertTrue(any(action.name == 'generate_random' for action in service.actions))
        self.assertTrue(any(action.name == 'schedule_key_deletion' for action in service.actions))


class KMSActionsApiTests(SimpleTestCase):
    @patch('dashboard.kms_views.create_key')
    def test_create_key_success(self, create_mock):
        create_mock.return_value = {'key_id': 'key-1', 'key_state': 'Enabled'}

        response = self.client.post(
            reverse('dashboard:kms-keys'),
            data=json.dumps({
                'description': 'Local key',
                'key_usage': 'ENCRYPT_DECRYPT',
                'key_spec': 'SYMMETRIC_DEFAULT',
                'override_id': 'key-1',
                'tags': [{'TagKey': 'env', 'TagValue': 'local'}],
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['key_id'], 'key-1')
        create_mock.assert_called_once_with(
            description='Local key',
            key_usage='ENCRYPT_DECRYPT',
            key_spec='SYMMETRIC_DEFAULT',
            override_id='key-1',
            tags=[{'TagKey': 'env', 'TagValue': 'local'}],
        )

    def test_create_key_rejects_invalid_json(self):
        response = self.client.post(
            reverse('dashboard:kms-keys'),
            data='not-json',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['service'], 'kms')
        self.assertEqual(response.json()['operation'], 'create_key')

    @patch('dashboard.kms_views.create_alias')
    def test_create_alias_success(self, create_alias_mock):
        create_alias_mock.return_value = {'alias_name': 'alias/local', 'target_key_id': 'key-1'}

        response = self.client.post(
            reverse('dashboard:kms-aliases'),
            data=json.dumps({'alias_name': 'alias/local', 'target_key_id': 'key-1'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['alias_name'], 'alias/local')
        create_alias_mock.assert_called_once_with('alias/local', 'key-1')

    @patch('dashboard.kms_views.delete_alias')
    def test_delete_alias_success(self, delete_alias_mock):
        delete_alias_mock.return_value = {'alias_name': 'alias/local', 'deleted': True}

        response = self.client.delete(
            reverse('dashboard:kms-aliases'),
            data=json.dumps({'alias_name': 'alias/local'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['deleted'])
        delete_alias_mock.assert_called_once_with('alias/local')

    @patch('dashboard.kms_views.encrypt')
    def test_encrypt_success(self, encrypt_mock):
        encrypt_mock.return_value = {'key_id': 'key-1', 'ciphertext_blob': 'abc'}

        response = self.client.post(
            reverse('dashboard:kms-encrypt'),
            data=json.dumps({'key_id': 'alias/local', 'plaintext': 'hello'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['ciphertext_blob'], 'abc')
        encrypt_mock.assert_called_once_with('alias/local', 'hello')

    @patch('dashboard.kms_views.decrypt')
    def test_decrypt_success(self, decrypt_mock):
        decrypt_mock.return_value = {'key_id': 'key-1', 'plaintext': 'hello'}

        response = self.client.post(
            reverse('dashboard:kms-decrypt'),
            data=json.dumps({'ciphertext_blob': 'abc'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['plaintext'], 'hello')
        decrypt_mock.assert_called_once_with('abc')

    @patch('dashboard.kms_views.generate_data_key')
    def test_generate_data_key_success(self, data_key_mock):
        data_key_mock.return_value = {'key_id': 'key-1', 'plaintext_base64': 'abc', 'ciphertext_blob': 'def'}

        response = self.client.post(
            reverse('dashboard:kms-data-keys'),
            data=json.dumps({'key_id': 'alias/local', 'key_spec': 'AES_256'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['ciphertext_blob'], 'def')
        data_key_mock.assert_called_once_with('alias/local', key_spec='AES_256', number_of_bytes=None)

    @patch('dashboard.kms_views.generate_random')
    def test_generate_random_success(self, random_mock):
        random_mock.return_value = {'plaintext_base64': 'AQID', 'size_bytes': 3}

        response = self.client.post(
            reverse('dashboard:kms-random'),
            data=json.dumps({'number_of_bytes': 3}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['plaintext_base64'], 'AQID')
        random_mock.assert_called_once_with(3)

    def test_generate_random_rejects_zero_bytes(self):
        response = self.client.post(
            reverse('dashboard:kms-random'),
            data=json.dumps({'number_of_bytes': 0}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['error'], 'Number of bytes must be greater than zero')

    @patch('dashboard.kms_views.set_key_rotation')
    def test_rotation_success(self, rotation_mock):
        rotation_mock.return_value = {'key_id': 'key-1', 'rotation_enabled': True}

        response = self.client.post(
            reverse('dashboard:kms-rotation'),
            data=json.dumps({'key_id': 'key-1', 'enabled': True}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['rotation_enabled'])
        rotation_mock.assert_called_once_with('key-1', True)

    @patch('dashboard.kms_views.schedule_key_deletion')
    def test_schedule_deletion_success(self, schedule_mock):
        schedule_mock.return_value = {'key_id': 'key-1', 'key_state': 'PendingDeletion'}

        response = self.client.post(
            reverse('dashboard:kms-deletion-schedule'),
            data=json.dumps({'key_id': 'key-1', 'pending_window_in_days': 10}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['key_state'], 'PendingDeletion')
        schedule_mock.assert_called_once_with('key-1', pending_window_in_days=10)

    @patch('dashboard.kms_views.cancel_key_deletion')
    def test_cancel_deletion_success(self, cancel_mock):
        cancel_mock.return_value = {'key_id': 'key-1', 'key_state': 'Enabled'}

        response = self.client.post(
            reverse('dashboard:kms-deletion-cancel'),
            data=json.dumps({'key_id': 'key-1'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['key_state'], 'Enabled')
        cancel_mock.assert_called_once_with('key-1')


class KMSApiHelperTests(SimpleTestCase):
    @patch('dashboard.kms_api._client')
    def test_generate_random_calls_kms_and_encodes_plaintext(self, client_factory):
        client_factory.return_value.generate_random.return_value = {'Plaintext': b'\x01\x02\x03'}

        result = generate_random(3)

        client_factory.return_value.generate_random.assert_called_once_with(NumberOfBytes=3)
        self.assertEqual(result, {
            'plaintext_base64': b64encode(b'\x01\x02\x03').decode('ascii'),
            'size_bytes': 3,
        })

    def test_generate_random_rejects_more_than_aws_limit(self):
        with self.assertRaisesMessage(ValueError, 'Number of bytes must be 1024 or less'):
            generate_random(1025)
