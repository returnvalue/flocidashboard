import json
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from django.urls import reverse

from .aws import ssm_inventory


class SSMPageTemplateTests(SimpleTestCase):
    def test_ssm_service_page_keeps_readonly_inventory_and_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'ssm'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>SSM inventory</h2>', html=True)
        self.assertContains(response, 'id="ssm-summary"')
        self.assertContains(response, 'id="ssm-console-root"')
        self.assertContains(response, 'id="ssm-grid"')
        self.assertContains(response, 'dashboard/ssm-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/ssm-console.js')


class SSMActionsApiTests(SimpleTestCase):
    @patch('dashboard.ssm_views.put_parameter')
    def test_create_parameter_success(self, put_mock):
        put_mock.return_value = {
            'name': '/local/app/config',
            'type': 'String',
            'version': 1,
        }

        response = self.client.post(
            reverse('dashboard:ssm-parameters'),
            data=json.dumps({
                'name': '/local/app/config',
                'type': 'String',
                'value': {'feature_enabled': True},
                'description': 'local config',
                'overwrite': True,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['version'], 1)
        put_mock.assert_called_once_with(
            '/local/app/config',
            {'feature_enabled': True},
            parameter_type='String',
            description='local config',
            overwrite=True,
        )

    def test_create_parameter_rejects_missing_name(self):
        response = self.client.post(
            reverse('dashboard:ssm-parameters'),
            data=json.dumps({'value': 'enabled'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['service'], 'ssm')
        self.assertEqual(response.json()['operation'], 'put_parameter')

    @patch('dashboard.ssm_views.get_parameter')
    def test_get_parameter_success(self, get_mock):
        get_mock.return_value = {
            'name': '/local/app/config',
            'type': 'String',
            'value': '{"ok": true}',
            'json': {'ok': True},
        }

        response = self.client.get(
            reverse('dashboard:ssm-parameter-value', kwargs={'parameter_name': '/local/app/config'}),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['json'], {'ok': True})
        get_mock.assert_called_once_with('/local/app/config', with_decryption=True)

    @patch('dashboard.ssm_views.put_parameter')
    def test_update_parameter_success(self, put_mock):
        put_mock.return_value = {
            'name': '/local/app/config',
            'version': 2,
        }

        response = self.client.put(
            reverse('dashboard:ssm-parameter-value', kwargs={'parameter_name': '/local/app/config'}),
            data=json.dumps({'type': 'String', 'value': 'enabled', 'description': 'updated'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['version'], 2)
        put_mock.assert_called_once_with(
            '/local/app/config',
            'enabled',
            parameter_type='String',
            description='updated',
            overwrite=True,
        )

    @patch('dashboard.ssm_views.delete_parameter')
    def test_delete_parameter_success(self, delete_mock):
        delete_mock.return_value = {
            'name': '/local/app/config',
        }

        response = self.client.delete(
            reverse('dashboard:ssm-parameter-value', kwargs={'parameter_name': '/local/app/config'}),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], '/local/app/config')
        delete_mock.assert_called_once_with('/local/app/config')


class SSMInventoryTests(SimpleTestCase):
    @patch('dashboard.aws._paginate')
    @patch('dashboard.aws.FlociClientFactory')
    def test_inventory_includes_default_patch_baselines(self, factory_mock, paginate_mock):
        ssm = MagicMock()
        ssm.get_default_patch_baseline.side_effect = lambda OperatingSystem: (
            {'BaselineId': f'pb-{OperatingSystem.lower()}'}
            if OperatingSystem in {'AMAZON_LINUX_2023', 'WINDOWS'}
            else {}
        )
        factory_mock.return_value.client.return_value = ssm
        paginate_mock.return_value = []

        result = ssm_inventory()

        self.assertEqual(result['summary']['default_patch_baselines'], 2)
        self.assertEqual(
            {baseline['operating_system'] for baseline in result['default_patch_baselines']},
            {'AMAZON_LINUX_2023', 'WINDOWS'},
        )
        self.assertIn('GetDefaultPatchBaseline', result['supported_from_sdk'])
