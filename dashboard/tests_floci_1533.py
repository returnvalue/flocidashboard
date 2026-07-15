from django.test import SimpleTestCase

from .services import get_service


class Floci1533CompatibilityTests(SimpleTestCase):
    def test_eks_registry_exposes_new_fargate_profile_lifecycle(self):
        actions = {action.name for action in get_service('eks').actions}
        self.assertIn('create_fargate_profile', actions)
        self.assertIn('delete_fargate_profile', actions)
