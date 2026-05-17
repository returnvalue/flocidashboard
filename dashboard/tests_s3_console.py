import json
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from django.urls import reverse

from .s3_api import list_s3_objects, s3_inventory_summary


class S3PageTemplateTests(SimpleTestCase):
    def test_s3_service_page_embeds_console_in_standard_service_template(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 's3'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<h2>S3 inventory</h2>', html=True)
        self.assertContains(response, 'id="s3-loaded-at"')
        self.assertContains(response, 'id="s3-summary"')
        self.assertContains(response, 'id="s3-console-root"')
        self.assertContains(response, 'id="s3-readonly-grid"')
        self.assertContains(response, 'dashboard/s3-console.css')
        self.assertContains(response, 'dashboard/service-console.js')
        self.assertContains(response, 'dashboard/s3-console.js')
        self.assertNotContains(response, 'id="s3-grid"')


class S3BucketsApiTests(SimpleTestCase):
    def test_create_bucket_rejects_invalid_name(self):
        response = self.client.post(
            reverse('dashboard:s3-buckets'),
            data=json.dumps({'name': 'AB'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json())

    @patch('dashboard.s3_views.list_s3_buckets')
    def test_list_buckets(self, list_mock):
        list_mock.return_value = [{'name': 'a', 'region': 'us-east-1', 'created': None}]

        response = self.client.get(reverse('dashboard:s3-buckets'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['buckets']), 1)

    @patch('dashboard.s3_views.create_s3_bucket')
    def test_create_bucket_success(self, create_mock):
        create_mock.return_value = {'name': 'my-test-bucket', 'region': 'us-east-1'}

        response = self.client.post(
            reverse('dashboard:s3-buckets'),
            data=json.dumps({'name': 'my-test-bucket'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'my-test-bucket')
        create_mock.assert_called_once_with('my-test-bucket', None)


class S3ListObjectsTests(SimpleTestCase):
    @patch('dashboard.s3_api._s3_client')
    def test_list_objects_splits_folders_and_files(self, client_mock):
        s3 = MagicMock()
        client_mock.return_value = s3
        s3.list_objects_v2.return_value = {
            'CommonPrefixes': [{'Prefix': 'logs/'}],
            'Contents': [
                {'Key': 'logs/', 'Size': 0},
                {
                    'Key': 'logs/app.txt',
                    'Size': 10,
                    'ETag': '"x"',
                    'LastModified': '2024-01-01',
                    'StorageClass': 'STANDARD',
                },
            ],
            'IsTruncated': False,
            'KeyCount': 2,
        }

        result = list_s3_objects('my-bucket', prefix='', delimiter='/', max_keys=100)

        self.assertEqual(len(result['folders']), 1)
        self.assertEqual(len(result['objects']), 1)
        self.assertEqual(result['objects'][0]['key'], 'logs/app.txt')

    def test_folder_display_name(self):
        from .s3_api import _folder_display_name

        self.assertEqual(_folder_display_name('logs/2024/', ''), 'logs')

    @patch('dashboard.s3_api.list_s3_buckets')
    def test_inventory_summary_defaults_empty_object_counts_to_zero(self, list_mock):
        list_mock.return_value = []
        result = s3_inventory_summary()

        self.assertEqual(result['summary']['objects'], 0)
        self.assertEqual(result['summary']['total_bytes'], 0)

    @patch('dashboard.s3_api.get_s3_bucket')
    @patch('dashboard.s3_api.list_s3_buckets')
    def test_inventory_summary_counts_bucket_objects_and_bytes(self, list_mock, get_mock):
        list_mock.return_value = [{'name': 'my-bucket'}]
        get_mock.return_value = {
            'name': 'my-bucket',
            'versioning': {'Status': 'Enabled'},
            'object_count': 2,
            'total_bytes': 12,
            'objects': [
                {'key': 'folder/', 'size': 0},
                {'key': 'folder/file.txt', 'size': 12},
            ],
            'object_versions': {'versions': [], 'delete_markers': []},
        }

        result = s3_inventory_summary()

        self.assertEqual(result['summary']['objects'], 2)
        self.assertEqual(result['summary']['total_bytes'], 12)
        self.assertEqual(result['summary']['versioned_buckets'], 1)


class S3ObjectApiTests(SimpleTestCase):
    @patch('dashboard.s3_views.list_s3_objects')
    def test_list_objects_query_params(self, list_mock):
        list_mock.return_value = {'bucket': 'b', 'prefix': '', 'folders': [], 'objects': []}

        response = self.client.get(
            reverse('dashboard:s3-bucket-objects', kwargs={'bucket_name': 'my-bucket'}),
            {'prefix': 'a/', 'max_keys': '50'},
        )

        self.assertEqual(response.status_code, 200)
        list_mock.assert_called_once()
        _, kwargs = list_mock.call_args
        self.assertEqual(kwargs['prefix'], 'a/')
        self.assertEqual(kwargs['max_keys'], 50)

    @patch('dashboard.s3_views.put_s3_versioning')
    def test_put_versioning(self, put_mock):
        put_mock.return_value = {'Status': 'Enabled'}

        response = self.client.put(
            reverse('dashboard:s3-bucket-versioning', kwargs={'bucket_name': 'my-bucket'}),
            data=json.dumps({'status': 'Enabled'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        put_mock.assert_called_once_with('my-bucket', 'Enabled')
