import json
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse

from .services import get_service
from .stepfunctions_api import create_state_machine, describe_execution, start_execution, stop_execution


class StepFunctionsPageTemplateTests(SimpleTestCase):
    def test_stepfunctions_service_page_embeds_console(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'stepfunctions'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="stepfunctions-summary"')
        self.assertContains(response, 'id="stepfunctions-console-root"')
        self.assertContains(response, 'dashboard/stepfunctions-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/stepfunctions-console.js')

    def test_stepfunctions_registry_exposes_management_lifecycle(self):
        actions = {action.name for action in get_service('stepfunctions').actions}
        self.assertTrue({'create_state_machine', 'delete_state_machine', 'start_execution', 'stop_execution', 'publish_state_machine_version', 'delete_state_machine_version'} <= actions)


class StepFunctionsApiTests(SimpleTestCase):
    @patch('dashboard.stepfunctions_views.create_state_machine')
    def test_create_state_machine_endpoint_success(self, create_mock):
        create_mock.return_value = {
            'state_machine_arn': 'arn:aws:states:us-east-1:000000000000:stateMachine:order-flow',
            'creation_date': '2026-08-25T12:00:00Z',
        }

        response = self.client.post(
            reverse('dashboard:stepfunctions-state-machines'),
            data=json.dumps({
                'name': 'order-flow',
                'role_arn': 'arn:aws:iam::000000000000:role/ExecutionRole',
                'definition': {'StartAt': 'Pass', 'States': {'Pass': {'Type': 'Pass', 'End': True}}},
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['state_machine_arn'], 'arn:aws:states:us-east-1:000000000000:stateMachine:order-flow')

    @patch('dashboard.stepfunctions_views.delete_state_machine')
    def test_delete_state_machine_endpoint_success(self, delete_mock):
        delete_mock.return_value = {
            'state_machine_arn': 'arn:aws:states:us-east-1:000000000000:stateMachine:order-flow',
            'deleted': True,
        }

        response = self.client.delete(
            reverse('dashboard:stepfunctions-state-machine-detail', kwargs={'state_machine_arn': 'arn:aws:states:us-east-1:000000000000:stateMachine:order-flow'}),
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['deleted'])

    @patch('dashboard.stepfunctions_views.start_execution')
    def test_start_execution_endpoint_success(self, start_mock):
        start_mock.return_value = {
            'execution_arn': 'arn:aws:states:us-east-1:000000000000:execution:order-flow:exec-1',
            'state_machine_arn': 'arn:aws:states:us-east-1:000000000000:stateMachine:order-flow',
        }

        response = self.client.post(
            reverse('dashboard:stepfunctions-executions-start'),
            data=json.dumps({
                'state_machine_arn': 'arn:aws:states:us-east-1:000000000000:stateMachine:order-flow',
                'input': {'orderId': '123'},
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['execution_arn'], 'arn:aws:states:us-east-1:000000000000:execution:order-flow:exec-1')

    @patch('dashboard.stepfunctions_views.describe_execution')
    def test_describe_execution_endpoint_success(self, describe_mock):
        describe_mock.return_value = {
            'executionArn': 'arn:aws:states:us-east-1:000000000000:execution:order-flow:exec-1',
            'status': 'SUCCEEDED',
            'input': '{"orderId": "123"}',
            'output': '{"status": "CONFIRMED"}',
        }

        response = self.client.get(
            reverse('dashboard:stepfunctions-execution-detail', kwargs={'execution_arn': 'arn:aws:states:us-east-1:000000000000:execution:order-flow:exec-1'}),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'SUCCEEDED')

    @patch('dashboard.stepfunctions_views.get_execution_history')
    def test_get_execution_history_endpoint_success(self, history_mock):
        history_mock.return_value = {
            'execution_arn': 'arn:aws:states:us-east-1:000000000000:execution:order-flow:exec-1',
            'events': [{'id': 1, 'type': 'ExecutionStarted'}],
        }

        response = self.client.get(
            reverse('dashboard:stepfunctions-execution-history', kwargs={'execution_arn': 'arn:aws:states:us-east-1:000000000000:execution:order-flow:exec-1'}),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['events']), 1)

    @patch('dashboard.stepfunctions_views.stop_execution')
    def test_stop_execution_endpoint_success(self, stop_mock):
        stop_mock.return_value = {
            'execution_arn': 'arn:aws:states:us-east-1:000000000000:execution:order-flow:exec-1',
            'stop_date': '2026-08-25T12:05:00Z',
        }

        response = self.client.post(
            reverse('dashboard:stepfunctions-executions-stop'),
            data=json.dumps({
                'execution_arn': 'arn:aws:states:us-east-1:000000000000:execution:order-flow:exec-1',
                'error': 'UserCancel',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['execution_arn'], 'arn:aws:states:us-east-1:000000000000:execution:order-flow:exec-1')

    @patch('dashboard.stepfunctions_views.publish_state_machine_version')
    def test_publish_version_endpoint_success(self, publish_mock):
        publish_mock.return_value = {
            'state_machine_arn': 'arn:aws:states:us-east-1:000000000000:stateMachine:order-flow',
            'state_machine_version_arn': 'arn:aws:states:us-east-1:000000000000:stateMachine:order-flow:1',
        }

        response = self.client.post(
            reverse('dashboard:stepfunctions-state-machine-versions-publish'),
            data=json.dumps({
                'state_machine_arn': 'arn:aws:states:us-east-1:000000000000:stateMachine:order-flow',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['state_machine_version_arn'], 'arn:aws:states:us-east-1:000000000000:stateMachine:order-flow:1')

    @patch('dashboard.stepfunctions_views.delete_state_machine_version')
    def test_delete_version_endpoint_success(self, delete_v_mock):
        delete_v_mock.return_value = {
            'state_machine_version_arn': 'arn:aws:states:us-east-1:000000000000:stateMachine:order-flow:1',
        }

        response = self.client.delete(
            reverse('dashboard:stepfunctions-state-machine-version-delete'),
            data=json.dumps({
                'state_machine_version_arn': 'arn:aws:states:us-east-1:000000000000:stateMachine:order-flow:1',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
