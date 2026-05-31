import json
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse

from .services import get_service


class ECRPageTemplateTests(SimpleTestCase):
    def test_ecr_service_page_keeps_readonly_inventory_and_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'ecr'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>ECR inventory</h2>', html=True)
        self.assertContains(response, 'id="ecr-summary"')
        self.assertContains(response, 'id="ecr-console-root"')
        self.assertContains(response, 'id="ecr-grid"')
        self.assertContains(response, 'dashboard/ecr-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/ecr-console.js')

    def test_ecr_registry_marks_service_interactive(self):
        service = get_service('ecr')

        self.assertIsNotNone(service)
        self.assertEqual(service.maturity, 'interactive_workbench')
        self.assertEqual(service.console_js, 'dashboard/ecr-console.js')
        self.assertTrue(any(action.name == 'create_repository' for action in service.actions))
        self.assertTrue(any(action.name == 'garbage_collection' for action in service.actions))


class ECRActionsApiTests(SimpleTestCase):
    @patch('dashboard.ecr_views.create_repository')
    def test_create_repository_success(self, create_mock):
        create_mock.return_value = {'name': 'floci-it/app', 'uri': 'localhost:5100/floci-it/app'}

        response = self.client.post(
            reverse('dashboard:ecr-repositories'),
            data=json.dumps({
                'name': 'floci-it/app',
                'image_tag_mutability': 'MUTABLE',
                'tags': [{'Key': 'env', 'Value': 'local'}],
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'floci-it/app')
        create_mock.assert_called_once_with(
            'floci-it/app',
            image_tag_mutability='MUTABLE',
            tags=[{'Key': 'env', 'Value': 'local'}],
        )

    def test_create_repository_rejects_invalid_json(self):
        response = self.client.post(
            reverse('dashboard:ecr-repositories'),
            data='not-json',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['service'], 'ecr')
        self.assertEqual(response.json()['operation'], 'create_repository')

    @patch('dashboard.ecr_views.delete_repository')
    def test_delete_repository_success(self, delete_mock):
        delete_mock.return_value = {'name': 'floci-it/app', 'force': True}

        response = self.client.post(
            reverse('dashboard:ecr-repositories-delete'),
            data=json.dumps({'repository_name': 'floci-it/app', 'force': True}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['force'])
        delete_mock.assert_called_once_with('floci-it/app', force=True)

    @patch('dashboard.ecr_views.get_authorization_token')
    def test_get_authorization_token_success(self, auth_mock):
        auth_mock.return_value = {'authorization_data': [{'proxy_endpoint': 'localhost:5100'}]}

        response = self.client.post(reverse('dashboard:ecr-auth-token'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['authorization_data'][0]['proxy_endpoint'], 'localhost:5100')
        auth_mock.assert_called_once_with()

    @patch('dashboard.ecr_views.batch_delete_image')
    def test_batch_delete_image_success(self, delete_mock):
        delete_mock.return_value = {'repository_name': 'floci-it/app', 'image_ids_deleted': [{'imageTag': 'v1'}]}

        response = self.client.post(
            reverse('dashboard:ecr-images-delete'),
            data=json.dumps({'repository_name': 'floci-it/app', 'image_ids': ['v1']}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['repository_name'], 'floci-it/app')
        delete_mock.assert_called_once_with('floci-it/app', ['v1'])

    @patch('dashboard.ecr_views.put_image_tag_mutability')
    def test_put_image_tag_mutability_success(self, mutability_mock):
        mutability_mock.return_value = {'repository_name': 'floci-it/app', 'image_tag_mutability': 'IMMUTABLE'}

        response = self.client.post(
            reverse('dashboard:ecr-tag-mutability'),
            data=json.dumps({'repository_name': 'floci-it/app', 'image_tag_mutability': 'IMMUTABLE'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['image_tag_mutability'], 'IMMUTABLE')
        mutability_mock.assert_called_once_with('floci-it/app', 'IMMUTABLE')

    @patch('dashboard.ecr_views.put_lifecycle_policy')
    def test_put_lifecycle_policy_success(self, put_mock):
        policy = {'rules': []}
        put_mock.return_value = {'repository_name': 'floci-it/app'}

        response = self.client.post(
            reverse('dashboard:ecr-lifecycle-policy'),
            data=json.dumps({'repository_name': 'floci-it/app', 'lifecycle_policy_text': policy}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        put_mock.assert_called_once_with('floci-it/app', policy)

    @patch('dashboard.ecr_views.delete_lifecycle_policy')
    def test_delete_lifecycle_policy_success(self, delete_mock):
        delete_mock.return_value = {'repository_name': 'floci-it/app'}

        response = self.client.delete(
            reverse('dashboard:ecr-lifecycle-policy'),
            data=json.dumps({'repository_name': 'floci-it/app'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        delete_mock.assert_called_once_with('floci-it/app')

    @patch('dashboard.ecr_views.set_repository_policy')
    def test_set_repository_policy_success(self, set_mock):
        policy = {'Version': '2012-10-17', 'Statement': []}
        set_mock.return_value = {'repository_name': 'floci-it/app'}

        response = self.client.post(
            reverse('dashboard:ecr-repository-policy'),
            data=json.dumps({'repository_name': 'floci-it/app', 'policy_text': policy, 'force': True}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        set_mock.assert_called_once_with('floci-it/app', policy, force=True)

    @patch('dashboard.ecr_views.delete_repository_policy')
    def test_delete_repository_policy_success(self, delete_mock):
        delete_mock.return_value = {'repository_name': 'floci-it/app'}

        response = self.client.delete(
            reverse('dashboard:ecr-repository-policy'),
            data=json.dumps({'repository_name': 'floci-it/app'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        delete_mock.assert_called_once_with('floci-it/app')

    @patch('dashboard.ecr_views.tag_resource')
    def test_tag_resource_success(self, tag_mock):
        tag_mock.return_value = {'resource_arn': 'arn:repo'}

        response = self.client.post(
            reverse('dashboard:ecr-tags'),
            data=json.dumps({'resource_arn': 'arn:repo', 'tags': [{'Key': 'env', 'Value': 'local'}]}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        tag_mock.assert_called_once_with('arn:repo', [{'Key': 'env', 'Value': 'local'}])

    @patch('dashboard.ecr_views.untag_resource')
    def test_untag_resource_success(self, untag_mock):
        untag_mock.return_value = {'resource_arn': 'arn:repo', 'tag_keys': ['env']}

        response = self.client.delete(
            reverse('dashboard:ecr-tags'),
            data=json.dumps({'resource_arn': 'arn:repo', 'tag_keys': ['env']}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['tag_keys'], ['env'])
        untag_mock.assert_called_once_with('arn:repo', ['env'])

    @patch('dashboard.ecr_views.run_garbage_collection')
    def test_garbage_collection_success(self, gc_mock):
        gc_mock.return_value = {'endpoint': 'http://localhost:4566/_floci/ecr/gc', 'result': {'ok': True}}

        response = self.client.post(reverse('dashboard:ecr-garbage-collection'))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['result']['ok'])
        gc_mock.assert_called_once_with()
