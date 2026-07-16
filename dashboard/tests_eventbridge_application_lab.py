import importlib
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.test import SimpleTestCase
from django.urls import reverse

from dashboard.labs import lab_status, labs_for_service, run_lab_step
from dashboard.labs import eventbridge_application as application


class EventBridgeApplicationLabTests(SimpleTestCase):
    def tearDown(self):
        cache.clear()

    def test_eventbridge_lab_is_registered_with_failure_experiments(self):
        labs = labs_for_service('eventbridge')
        self.assertEqual([lab['key'] for lab in labs], ['application-spine'])
        step_keys = [step['key'] for step in labs[0]['steps']]
        self.assertEqual(step_keys[-3:], ['malformed-event', 'missing-permission', 'disabled-rule'])

    def test_eventbridge_labs_page_renders_architecture_commands_and_artifacts(self):
        response = self.client.get(reverse('dashboard:service-labs', kwargs={'service_key': 'eventbridge'}))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Build an event-driven order application')
        self.assertContains(response, 'aws events create-event-bus')
        self.assertContains(response, 'producer-policy.json')
        self.assertContains(response, 'processing-target.json')
        self.assertContains(response, 'InputTransformer')
        self.assertContains(response, 'DeadLetterConfig')

    def test_runner_facade_dispatches_to_eventbridge_module(self):
        module = importlib.import_module(application.run_step.__module__)
        runner = MagicMock(return_value={'verified': True})
        with patch.dict(module.RUNNERS, {'happy-path': runner}):
            result = module.run_step('happy-path')
        self.assertTrue(result['verified'])
        runner.assert_called_once_with()

    def test_status_tracks_all_reload_safe_milestones(self):
        for key in ['queues', 'roles', 'functions', 'rules', 'targets', 'api-id', 'permissions', 'happy-path', 'malformed', 'missing-permission', 'disabled-rule']:
            application.marker(key)
        result = lab_status('eventbridge', 'application-spine')
        self.assertTrue(result['complete'])
        self.assertTrue(result['steps']['disabled-rule']['verified'])

    def test_targets_include_transformer_retry_and_dead_letter_shapes(self):
        module = importlib.import_module(application.put_targets.__module__)
        events = MagicMock()
        events.put_targets.return_value = {'FailedEntryCount': 0, 'FailedEntries': []}
        with patch.object(module, 'client', return_value=events):
            result = module.put_targets()
        self.assertTrue(result['verified'])
        processing = events.put_targets.call_args_list[0].kwargs['Targets'][0]
        self.assertEqual(processing['InputTransformer'], application.PROCESSING_TRANSFORMER)
        self.assertEqual(processing['RetryPolicy']['MaximumRetryAttempts'], 2)
        self.assertEqual(processing['DeadLetterConfig']['Arn'], application.QUEUE_ARNS[application.DLQ])
