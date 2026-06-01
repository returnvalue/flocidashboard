import json
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse

from .services import get_service


class EKSPageTemplateTests(SimpleTestCase):
    def test_eks_service_page_keeps_readonly_inventory_and_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'eks'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>EKS inventory</h2>', html=True)
        self.assertContains(response, 'id="eks-summary"')
        self.assertContains(response, 'id="eks-console-root"')
        self.assertContains(response, 'id="eks-grid"')
        self.assertContains(response, 'dashboard/eks-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/eks-console.js')

    def test_eks_registry_marks_service_interactive(self):
        service = get_service('eks')

        self.assertIsNotNone(service)
        self.assertEqual(service.maturity, 'interactive_workbench')
        self.assertEqual(service.console_js, 'dashboard/eks-console.js')
        self.assertTrue(any(action.name == 'create_cluster' for action in service.actions))
        self.assertTrue(any(action.name == 'delete_cluster' for action in service.actions))
        self.assertTrue(any(action.name == 'tag_resource' for action in service.actions))


class EKSActionsApiTests(SimpleTestCase):
    @patch('dashboard.eks_views.create_cluster')
    def test_create_cluster_success(self, create_mock):
        create_mock.return_value = {'name': 'local', 'arn': 'arn:aws:eks:us-east-1:000000000000:cluster/local'}

        response = self.client.post(
            reverse('dashboard:eks-clusters'),
            data=json.dumps({
                'name': 'local',
                'role_arn': 'arn:aws:iam::000000000000:role/eks-role',
                'version': '1.29',
                'subnet_ids': ['subnet-1'],
                'security_group_ids': ['sg-1'],
                'tags': {'env': 'local'},
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'local')
        create_mock.assert_called_once_with(
            name='local',
            role_arn='arn:aws:iam::000000000000:role/eks-role',
            version='1.29',
            subnet_ids=['subnet-1'],
            security_group_ids=['sg-1'],
            tags={'env': 'local'},
        )

    def test_create_cluster_rejects_invalid_json(self):
        response = self.client.post(
            reverse('dashboard:eks-clusters'),
            data='not-json',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['service'], 'eks')
        self.assertEqual(response.json()['operation'], 'create_cluster')

    @patch('dashboard.eks_views.delete_cluster')
    def test_delete_cluster_success(self, delete_mock):
        delete_mock.return_value = {'name': 'local', 'status': 'DELETING'}

        response = self.client.post(
            reverse('dashboard:eks-clusters-delete'),
            data=json.dumps({'name': 'local'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'DELETING')
        delete_mock.assert_called_once_with('local')

    @patch('dashboard.eks_views.tag_resource')
    def test_tag_resource_success(self, tag_mock):
        tag_mock.return_value = {'resource_arn': 'arn:cluster/local', 'tags': {'env': 'local'}}

        response = self.client.post(
            reverse('dashboard:eks-tags'),
            data=json.dumps({'resource_arn': 'arn:cluster/local', 'tags': {'env': 'local'}}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['tags'], {'env': 'local'})
        tag_mock.assert_called_once_with('arn:cluster/local', {'env': 'local'})

    @patch('dashboard.eks_views.untag_resource')
    def test_untag_resource_success(self, untag_mock):
        untag_mock.return_value = {'resource_arn': 'arn:cluster/local', 'tag_keys': ['env']}

        response = self.client.delete(
            reverse('dashboard:eks-tags'),
            data=json.dumps({'resource_arn': 'arn:cluster/local', 'tag_keys': ['env']}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['tag_keys'], ['env'])
        untag_mock.assert_called_once_with('arn:cluster/local', ['env'])

    @patch('dashboard.eks_views.list_tags')
    def test_list_tags_success(self, list_mock):
        list_mock.return_value = {'resource_arn': 'arn:cluster/local', 'tags': {'env': 'local'}}

        response = self.client.post(
            reverse('dashboard:eks-tags-list'),
            data=json.dumps({'resource_arn': 'arn:cluster/local'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['tags'], {'env': 'local'})
        list_mock.assert_called_once_with('arn:cluster/local')
