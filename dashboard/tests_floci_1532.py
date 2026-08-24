import json
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse

from .services import get_service


class Floci1532CompatibilityTests(SimpleTestCase):
    def test_cognito_registry_exposes_session_termination(self):
        actions = {action.name for action in get_service('cognito').actions}
        self.assertIn('global_sign_out', actions)
        self.assertIn('revoke_token', actions)

    @patch('dashboard.cognito_views.global_sign_out')
    def test_global_sign_out_endpoint(self, sign_out):
        sign_out.return_value = {'signed_out': True}
        response = self.client.post(
            reverse('dashboard:cognito-global-sign-out'),
            data=json.dumps({'access_token': 'access-token'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        sign_out.assert_called_once_with('access-token')

    @patch('dashboard.cognito_views.revoke_token')
    def test_revoke_token_endpoint(self, revoke):
        revoke.return_value = {'revoked': True}
        response = self.client.post(
            reverse('dashboard:cognito-revoke-token'),
            data=json.dumps({'client_id': 'client', 'client_secret': 'secret', 'token': 'refresh'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        revoke.assert_called_once_with('client', 'refresh', client_secret='secret')

    def test_stepfunctions_page_documents_jsonata_assign(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'stepfunctions'}))
        self.assertContains(response, 'JSONata')
        self.assertContains(response, '<code>Assign</code>', html=True)

    def test_environment_exposes_s3_auth_mode(self):
        response = self.client.get(reverse('dashboard:legacy-environment'))
        self.assertContains(response, 'id="environment-s3-auth"')
