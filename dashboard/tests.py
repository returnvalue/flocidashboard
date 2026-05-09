from django.test import SimpleTestCase
from django.urls import reverse

from .views import SERVICE_PAGES


class DashboardTemplateTests(SimpleTestCase):
    def test_home_page_renders_dashboard_shell(self):
        response = self.client.get(reverse('dashboard:index'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<title>Floci Dashboard</title>', html=True)
        self.assertContains(response, 'id="service-grid"')
        self.assertContains(response, 'dashboard/styles.css')
        self.assertContains(response, 'dashboard/dashboard.js')

    def test_all_service_pages_render(self):
        for key, service in SERVICE_PAGES.items():
            with self.subTest(service=key):
                response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': key}))

                self.assertEqual(response.status_code, 200)
                self.assertContains(response, f'<title>{service["title"]} - Floci Dashboard</title>', html=True)
                self.assertContains(response, f'<h1>{service["title"]}</h1>', html=True)
                self.assertContains(response, service['eyebrow'])
                self.assertContains(response, f'id="{key}-loaded-at"')
                self.assertContains(response, f'id="{key}-summary"')
                self.assertContains(response, f'id="{key}-grid"')
                self.assertContains(response, 'dashboard/styles.css')
                self.assertContains(response, 'dashboard/dashboard.js')

    def test_unknown_service_page_404s(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'not-a-service'}))

        self.assertEqual(response.status_code, 404)
