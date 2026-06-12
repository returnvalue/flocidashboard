import json
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from django.urls import reverse

from .eks_api import create_nodegroup
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
        self.assertTrue(any(action.name == 'create_nodegroup' for action in service.actions))
        self.assertTrue(any(action.name == 'delete_nodegroup' for action in service.actions))
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

    @patch('dashboard.eks_views.create_nodegroup')
    def test_create_nodegroup_success(self, create_mock):
        create_mock.return_value = {'cluster_name': 'local', 'nodegroup_name': 'workers', 'status': 'CREATING'}

        response = self.client.post(
            reverse('dashboard:eks-nodegroups', kwargs={'cluster_name': 'local'}),
            data=json.dumps({
                'nodegroup_name': 'workers',
                'node_role': 'arn:aws:iam::000000000000:role/eks-node-role',
                'subnets': ['subnet-1'],
                'scaling_config': {'minSize': 1, 'maxSize': 2, 'desiredSize': 1},
                'instance_types': ['t3.small'],
                'ami_type': 'AL2_x86_64',
                'capacity_type': 'ON_DEMAND',
                'disk_size': 20,
                'labels': {'role': 'worker'},
                'tags': {'env': 'local'},
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'CREATING')
        create_mock.assert_called_once_with(
            cluster_name='local',
            nodegroup_name='workers',
            node_role='arn:aws:iam::000000000000:role/eks-node-role',
            subnets=['subnet-1'],
            scaling_config={'minSize': 1, 'maxSize': 2, 'desiredSize': 1},
            instance_types=['t3.small'],
            ami_type='AL2_x86_64',
            capacity_type='ON_DEMAND',
            disk_size=20,
            labels={'role': 'worker'},
            tags={'env': 'local'},
        )

    @patch('dashboard.eks_views.delete_nodegroup')
    def test_delete_nodegroup_success(self, delete_mock):
        delete_mock.return_value = {'cluster_name': 'local', 'nodegroup_name': 'workers', 'status': 'DELETING'}

        response = self.client.delete(
            reverse('dashboard:eks-nodegroup-detail', kwargs={'cluster_name': 'local', 'nodegroup_name': 'workers'}),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'DELETING')
        delete_mock.assert_called_once_with('local', 'workers')

    def test_create_nodegroup_rejects_invalid_json(self):
        response = self.client.post(
            reverse('dashboard:eks-nodegroups', kwargs={'cluster_name': 'local'}),
            data='not-json',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['service'], 'eks')
        self.assertEqual(response.json()['operation'], 'create_nodegroup')


class EKSApiHelperTests(SimpleTestCase):
    @patch('dashboard.eks_api._client')
    def test_create_nodegroup_uses_managed_nodegroup_api(self, client_mock):
        client = MagicMock()
        client.create_nodegroup.return_value = {'nodegroup': {'nodegroupName': 'workers', 'status': 'CREATING'}}
        client_mock.return_value = client

        result = create_nodegroup(
            cluster_name='local',
            nodegroup_name='workers',
            node_role='arn:aws:iam::000000000000:role/eks-node-role',
            subnets=['subnet-1'],
            scaling_config={'minSize': 1, 'maxSize': 2, 'desiredSize': 1},
            instance_types=['t3.small'],
            disk_size='20',
            labels={'role': 'worker'},
            tags={'env': 'local'},
        )

        self.assertEqual(result['nodegroup_name'], 'workers')
        self.assertEqual(result['status'], 'CREATING')
        client.create_nodegroup.assert_called_once()
        kwargs = client.create_nodegroup.call_args.kwargs
        self.assertEqual(kwargs['clusterName'], 'local')
        self.assertEqual(kwargs['nodegroupName'], 'workers')
        self.assertEqual(kwargs['nodeRole'], 'arn:aws:iam::000000000000:role/eks-node-role')
        self.assertEqual(kwargs['subnets'], ['subnet-1'])
        self.assertEqual(kwargs['diskSize'], 20)
        self.assertEqual(kwargs['labels'], {'role': 'worker'})
        self.assertEqual(kwargs['tags'], {'env': 'local'})
