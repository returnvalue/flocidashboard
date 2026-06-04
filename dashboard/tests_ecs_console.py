import json
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse

from .ecs_api import run_task
from .services import get_service


class ECSPageTemplateTests(SimpleTestCase):
    def test_ecs_service_page_keeps_readonly_inventory_and_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'ecs'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>ECS inventory</h2>', html=True)
        self.assertContains(response, 'id="ecs-summary"')
        self.assertContains(response, 'id="ecs-console-root"')
        self.assertContains(response, 'id="ecs-grid"')
        self.assertContains(response, 'dashboard/ecs-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/ecs-console.js')

    def test_ecs_registry_marks_service_interactive(self):
        service = get_service('ecs')

        self.assertIsNotNone(service)
        self.assertEqual(service.maturity, 'interactive_workbench')
        self.assertEqual(service.console_js, 'dashboard/ecs-console.js')
        self.assertTrue(any(action.name == 'run_task' for action in service.actions))
        self.assertTrue(any(action.name == 'delete_service' for action in service.actions))


class ECSActionsApiTests(SimpleTestCase):
    @patch('dashboard.ecs_views.create_cluster')
    def test_create_cluster_success(self, create_mock):
        create_mock.return_value = {'name': 'local', 'arn': 'arn:cluster/local'}

        response = self.client.post(
            reverse('dashboard:ecs-clusters'),
            data=json.dumps({'name': 'local', 'tags': [{'key': 'env', 'value': 'local'}]}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'local')
        create_mock.assert_called_once_with(
            'local',
            tags=[{'key': 'env', 'value': 'local'}],
            capacity_providers=[],
        )

    def test_create_cluster_rejects_invalid_json(self):
        response = self.client.post(
            reverse('dashboard:ecs-clusters'),
            data='not-json',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['service'], 'ecs')
        self.assertEqual(response.json()['operation'], 'create_cluster')

    @patch('dashboard.ecs_views.delete_cluster')
    def test_delete_cluster_success(self, delete_mock):
        delete_mock.return_value = {'name': 'local', 'status': 'INACTIVE'}

        response = self.client.post(
            reverse('dashboard:ecs-clusters-delete'),
            data=json.dumps({'cluster': 'local'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'INACTIVE')
        delete_mock.assert_called_once_with('local')

    @patch('dashboard.ecs_views.register_task_definition')
    def test_register_task_definition_success(self, register_mock):
        register_mock.return_value = {'family': 'web', 'revision': 1}
        containers = [{'name': 'app', 'image': 'nginx:latest', 'essential': True}]

        response = self.client.post(
            reverse('dashboard:ecs-task-definitions'),
            data=json.dumps({
                'family': 'web',
                'container_definitions': containers,
                'requires_compatibilities': ['FARGATE'],
                'network_mode': 'awsvpc',
                'cpu': '256',
                'memory': '512',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['family'], 'web')
        register_mock.assert_called_once_with(
            family='web',
            container_definitions=containers,
            requires_compatibilities=['FARGATE'],
            network_mode='awsvpc',
            cpu='256',
            memory='512',
            task_role_arn='',
            execution_role_arn='',
            tags=[],
        )

    @patch('dashboard.ecs_views.run_task')
    def test_run_task_success(self, run_mock):
        run_mock.return_value = {'task_arns': ['arn:task/1']}
        overrides = {
            'containerOverrides': [{
                'name': 'web',
                'command': ['echo', 'hello'],
                'environment': [{'name': 'MODE', 'value': 'local'}],
            }],
        }
        tags = [{'key': 'run', 'value': 'local'}]

        response = self.client.post(
            reverse('dashboard:ecs-tasks-run'),
            data=json.dumps({
                'cluster': 'local',
                'task_definition': 'web:1',
                'launch_type': 'FARGATE',
                'count': 1,
                'network_configuration': {'awsvpcConfiguration': {'subnets': ['subnet-1']}},
                'overrides': overrides,
                'tags': tags,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['task_arns'], ['arn:task/1'])
        run_mock.assert_called_once_with(
            cluster='local',
            task_definition='web:1',
            launch_type='FARGATE',
            count=1,
            network_configuration={'awsvpcConfiguration': {'subnets': ['subnet-1']}},
            overrides=overrides,
            started_by='',
            tags=tags,
        )

    @patch('dashboard.ecs_views.stop_task')
    def test_stop_task_success(self, stop_mock):
        stop_mock.return_value = {'task_arn': 'arn:task/1', 'last_status': 'STOPPED'}

        response = self.client.post(
            reverse('dashboard:ecs-tasks-stop'),
            data=json.dumps({'cluster': 'local', 'task': 'arn:task/1', 'reason': 'done'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['last_status'], 'STOPPED')
        stop_mock.assert_called_once_with('local', 'arn:task/1', reason='done')

    @patch('dashboard.ecs_views.create_service')
    def test_create_service_success(self, create_mock):
        create_mock.return_value = {'service_name': 'web', 'desired_count': 1}
        tags = [{'key': 'service', 'value': 'web'}]

        response = self.client.post(
            reverse('dashboard:ecs-services'),
            data=json.dumps({
                'cluster': 'local',
                'service_name': 'web',
                'task_definition': 'web:1',
                'desired_count': 1,
                'tags': tags,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['service_name'], 'web')
        create_mock.assert_called_once_with(
            cluster='local',
            service_name='web',
            task_definition='web:1',
            desired_count=1,
            launch_type='FARGATE',
            network_configuration={},
            tags=tags,
        )

    @patch('dashboard.ecs_views.update_service')
    def test_update_service_success(self, update_mock):
        update_mock.return_value = {'service_name': 'web', 'desired_count': 2}

        response = self.client.post(
            reverse('dashboard:ecs-services-update'),
            data=json.dumps({
                'cluster': 'local',
                'service': 'web',
                'desired_count': 2,
                'force_new_deployment': True,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['desired_count'], 2)
        update_mock.assert_called_once_with(
            cluster='local',
            service='web',
            desired_count=2,
            task_definition='',
            force_new_deployment=True,
        )

    @patch('dashboard.ecs_views.delete_service')
    def test_delete_service_success(self, delete_mock):
        delete_mock.return_value = {'service_name': 'web', 'force': True}

        response = self.client.post(
            reverse('dashboard:ecs-services-delete'),
            data=json.dumps({'cluster': 'local', 'service': 'web', 'force': True}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['force'])
        delete_mock.assert_called_once_with('local', 'web', force=True)

    @patch('dashboard.ecs_views.tag_resource')
    def test_tag_resource_success(self, tag_mock):
        tag_mock.return_value = {'resource_arn': 'arn:cluster/local'}

        response = self.client.post(
            reverse('dashboard:ecs-tags'),
            data=json.dumps({'resource_arn': 'arn:cluster/local', 'tags': [{'key': 'env', 'value': 'local'}]}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['resource_arn'], 'arn:cluster/local')
        tag_mock.assert_called_once_with('arn:cluster/local', [{'key': 'env', 'value': 'local'}])

    @patch('dashboard.ecs_views.untag_resource')
    def test_untag_resource_success(self, untag_mock):
        untag_mock.return_value = {'resource_arn': 'arn:cluster/local', 'tag_keys': ['env']}

        response = self.client.delete(
            reverse('dashboard:ecs-tags'),
            data=json.dumps({'resource_arn': 'arn:cluster/local', 'tag_keys': ['env']}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['tag_keys'], ['env'])
        untag_mock.assert_called_once_with('arn:cluster/local', ['env'])

    @patch('dashboard.ecs_views.put_account_setting')
    def test_put_account_setting_success(self, put_mock):
        put_mock.return_value = {'setting': {'name': 'containerInsights', 'value': 'enabled'}}

        response = self.client.post(
            reverse('dashboard:ecs-account-settings'),
            data=json.dumps({'name': 'containerInsights', 'value': 'enabled', 'principal_arn': ''}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['setting']['value'], 'enabled')
        put_mock.assert_called_once_with('containerInsights', 'enabled', principal_arn='')


class ECSApiHelperTests(SimpleTestCase):
    @patch('dashboard.ecs_api._client')
    def test_run_task_passes_container_overrides(self, client_factory):
        overrides = {
            'containerOverrides': [{
                'name': 'web',
                'command': ['echo', 'hello'],
                'environment': [{'name': 'MODE', 'value': 'local'}],
            }],
        }
        client_factory.return_value.run_task.return_value = {
            'tasks': [{'taskArn': 'arn:task/1'}],
            'failures': [],
        }

        result = run_task(cluster='local', task_definition='web:1', overrides=overrides)

        client_factory.return_value.run_task.assert_called_once_with(
            cluster='local',
            taskDefinition='web:1',
            count=1,
            launchType='FARGATE',
            overrides=overrides,
        )
        self.assertEqual(result['task_arns'], ['arn:task/1'])
