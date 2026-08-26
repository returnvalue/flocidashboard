"""Tests for new Top 15 AWS service workflow labs (RDS, ECS, EKS)."""

from django.test import SimpleTestCase, TestCase
from unittest.mock import MagicMock, patch

from dashboard.labs.registry import all_labs, get_lab, labs_for_service
from dashboard.labs.monolith import lab_status, reset_lab, run_lab_step


class NewServiceLabsLifecycleTests(TestCase):
    def test_registry_contains_new_services(self):
        services = {lab['service'] for lab in all_labs()}
        self.assertIn('rds', services)
        self.assertIn('ecs', services)
        self.assertIn('eks', services)

    def test_rds_lab_lifecycle(self):
        labs = labs_for_service('rds')
        self.assertEqual(len(labs), 1)
        lab = labs[0]
        self.assertEqual(lab['key'], 'db-instance-lifecycle')

        # Reset
        reset_res = reset_lab('rds', 'db-instance-lifecycle')
        self.assertEqual(reset_res['status'], 'reset')

        # Step 1: Create parameter group
        res1 = run_lab_step('rds', 'db-instance-lifecycle', 'create-parameter-group')
        self.assertTrue(res1['verified'])

        # Step 2: Create DB instance
        res2 = run_lab_step('rds', 'db-instance-lifecycle', 'create-db-instance')
        self.assertTrue(res2['verified'])

        # Step 3: Describe DB instance
        res3 = run_lab_step('rds', 'db-instance-lifecycle', 'describe-db-instance')
        self.assertTrue(res3['verified'])

        # Step 4: Modify DB instance
        res4 = run_lab_step('rds', 'db-instance-lifecycle', 'modify-db-instance')
        self.assertTrue(res4['verified'])

        # Step 5: Reboot DB instance
        res5 = run_lab_step('rds', 'db-instance-lifecycle', 'reboot-db-instance')
        self.assertTrue(res5['verified'])

        # Status check
        st = lab_status('rds', 'db-instance-lifecycle')
        self.assertEqual(st['status'], 'passed')
        self.assertEqual(st['passed_steps'], 5)

        # Teardown reset
        reset_lab('rds', 'db-instance-lifecycle')

    def test_ecs_lab_lifecycle(self):
        labs = labs_for_service('ecs')
        self.assertEqual(len(labs), 1)
        lab = labs[0]
        self.assertEqual(lab['key'], 'fargate-microservice')

        # Reset
        reset_res = reset_lab('ecs', 'fargate-microservice')
        self.assertEqual(reset_res['status'], 'reset')

        # Step 1: Create cluster
        res1 = run_lab_step('ecs', 'fargate-microservice', 'create-cluster')
        self.assertTrue(res1['verified'])

        # Step 2: Register task def
        res2 = run_lab_step('ecs', 'fargate-microservice', 'register-task-definition')
        self.assertTrue(res2['verified'])

        # Step 3: Run task
        res3 = run_lab_step('ecs', 'fargate-microservice', 'run-task')
        self.assertTrue(res3['verified'])

        # Step 4: Describe task
        res4 = run_lab_step('ecs', 'fargate-microservice', 'describe-tasks')
        self.assertTrue(res4['verified'])

        # Step 5: Create service
        res5 = run_lab_step('ecs', 'fargate-microservice', 'create-service')
        self.assertTrue(res5['verified'])

        # Step 6: Update service
        res6 = run_lab_step('ecs', 'fargate-microservice', 'update-service')
        self.assertTrue(res6['verified'])

        # Status check
        st = lab_status('ecs', 'fargate-microservice')
        self.assertEqual(st['status'], 'passed')
        self.assertEqual(st['passed_steps'], 6)

        # Teardown reset
        reset_lab('ecs', 'fargate-microservice')

    def test_eks_lab_lifecycle(self):
        labs = labs_for_service('eks')
        self.assertEqual(len(labs), 1)
        lab = labs[0]
        self.assertEqual(lab['key'], 'control-plane-nodegroup')

        # Reset
        reset_res = reset_lab('eks', 'control-plane-nodegroup')
        self.assertEqual(reset_res['status'], 'reset')

        # Step 1: Create cluster
        res1 = run_lab_step('eks', 'control-plane-nodegroup', 'create-cluster')
        self.assertTrue(res1['verified'])

        # Step 2: Describe cluster
        res2 = run_lab_step('eks', 'control-plane-nodegroup', 'describe-cluster')
        self.assertTrue(res2['verified'])

        # Step 3: Create nodegroup
        res3 = run_lab_step('eks', 'control-plane-nodegroup', 'create-nodegroup')
        self.assertTrue(res3['verified'])

        # Step 4: Create fargate profile
        res4 = run_lab_step('eks', 'control-plane-nodegroup', 'create-fargate-profile')
        self.assertTrue(res4['verified'])

        # Step 5: Generate kubeconfig
        res5 = run_lab_step('eks', 'control-plane-nodegroup', 'generate-kubeconfig')
        self.assertTrue(res5['verified'])

        # Status check
        st = lab_status('eks', 'control-plane-nodegroup')
        self.assertEqual(st['status'], 'passed')
        self.assertEqual(st['passed_steps'], 5)

        # Teardown reset
        reset_lab('eks', 'control-plane-nodegroup')
