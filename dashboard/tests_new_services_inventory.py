from types import SimpleNamespace
from unittest.mock import MagicMock
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse

from .aws import batch_inventory, docdb_inventory, emr_inventory, rdsdata_inventory, wafv2_inventory
from .services import get_service


def service_model(*operations):
    return SimpleNamespace(service_model=SimpleNamespace(operation_names=list(operations)))


class NewServiceInventoryPageTests(SimpleTestCase):
    def test_new_service_pages_render_inventory_shells(self):
        cases = [
            ('batch', 'AWS Batch', 'Compute environments, job queues, definitions, and jobs'),
            ('docdb', 'DocumentDB', 'MongoDB-compatible clusters and instances'),
            ('emr', 'EMR', 'Clusters, instance groups, and steps'),
            ('rdsdata', 'RDS Data API', 'Serverless SQL statement and transaction calls'),
            ('wafv2', 'WAF v2', 'Web ACLs, rule groups, IP sets, and regex pattern sets'),
        ]

        for key, title, eyebrow in cases:
            with self.subTest(service=key):
                response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': key}))

                self.assertEqual(response.status_code, 200)
                self.assertContains(response, f'<title>{title} - Floci Dashboard</title>', html=True)
                self.assertContains(response, eyebrow)
                self.assertContains(response, f'id="{key}-loaded-at"')
                self.assertContains(response, f'id="{key}-summary"')
                self.assertContains(response, f'id="{key}-grid"')

    def test_new_services_are_registered_as_read_only_inspectors(self):
        cases = [
            ('batch', 'Compute'),
            ('docdb', 'Database'),
            ('emr', 'Analytics'),
            ('rdsdata', 'Database'),
            ('wafv2', 'Security'),
        ]

        for key, category in cases:
            with self.subTest(service=key):
                service = get_service(key)

                self.assertIsNotNone(service)
                self.assertEqual(service.maturity, 'read_only_inspector')
                self.assertEqual(service.api_path, None)
                self.assertEqual(service.category, category)

    @patch('dashboard.views.batch_inventory')
    @patch('dashboard.views.docdb_inventory')
    @patch('dashboard.views.emr_inventory')
    @patch('dashboard.views.rdsdata_inventory')
    @patch('dashboard.views.wafv2_inventory')
    def test_new_service_api_routes_return_inventory(self, wafv2, rdsdata, emr, docdb, batch):
        batch.return_value = {'summary': {'job_queues': 1}, 'job_queues': [{'jobQueueName': 'local'}]}
        docdb.return_value = {'summary': {'clusters': 1}, 'clusters': [{'DBClusterIdentifier': 'docs'}]}
        emr.return_value = {'summary': {'clusters': 1}, 'clusters': [{'name': 'analytics'}]}
        rdsdata.return_value = {'summary': {'available_sdk_operations': 5}, 'statement_operations': [{'name': 'ExecuteStatement'}]}
        wafv2.return_value = {'summary': {'web_acls': 1}, 'web_acls': [{'Name': 'local-acl'}]}

        cases = [
            ('dashboard:batch', 'job_queues', 1),
            ('dashboard:docdb', 'clusters', 1),
            ('dashboard:emr', 'clusters', 1),
            ('dashboard:rdsdata', 'available_sdk_operations', 5),
            ('dashboard:wafv2', 'web_acls', 1),
        ]

        for route_name, summary_key, expected in cases:
            with self.subTest(route=route_name):
                response = self.client.get(reverse(route_name))

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()['summary'][summary_key], expected)


class NewServiceInventoryHelperTests(SimpleTestCase):
    @patch('dashboard.aws.FlociClientFactory')
    def test_batch_inventory_summarizes_batch_resources(self, factory_mock):
        batch = MagicMock()
        batch.meta = service_model(
            'DescribeComputeEnvironments',
            'DescribeJobQueues',
            'DescribeJobDefinitions',
            'ListJobs',
        )
        batch.can_paginate.return_value = False
        batch.describe_compute_environments.return_value = {
            'computeEnvironments': [{'computeEnvironmentName': 'local-env', 'status': 'VALID'}],
        }
        batch.describe_job_queues.return_value = {
            'jobQueues': [{'jobQueueName': 'local-queue', 'status': 'VALID'}],
        }
        batch.describe_job_definitions.return_value = {
            'jobDefinitions': [{'jobDefinitionName': 'worker', 'status': 'ACTIVE'}],
        }
        batch.list_jobs.return_value = {'jobSummaryList': [{'jobId': 'job-1', 'jobName': 'worker', 'status': 'RUNNING'}]}
        factory_mock.return_value.client.return_value = batch

        result = batch_inventory()

        self.assertEqual(result['summary']['compute_environments'], 1)
        self.assertEqual(result['summary']['job_queues'], 1)
        self.assertEqual(result['summary']['job_definitions'], 1)
        self.assertGreaterEqual(result['summary']['sampled_jobs'], 1)

    @patch('dashboard.aws.FlociClientFactory')
    def test_docdb_inventory_summarizes_clusters_and_instances(self, factory_mock):
        docdb = MagicMock()
        docdb.meta = service_model('DescribeDBClusters', 'DescribeDBInstances')
        docdb.can_paginate.return_value = False
        docdb.describe_db_clusters.return_value = {
            'DBClusters': [{'DBClusterIdentifier': 'docs', 'Status': 'available'}],
        }
        docdb.describe_db_instances.return_value = {
            'DBInstances': [{'DBInstanceIdentifier': 'docs-1', 'DBInstanceStatus': 'available'}],
        }
        factory_mock.return_value.client.return_value = docdb

        result = docdb_inventory()

        self.assertEqual(result['summary']['clusters'], 1)
        self.assertEqual(result['summary']['instances'], 1)
        self.assertEqual(result['clusters'][0]['DBClusterIdentifier'], 'docs')

    @patch('dashboard.aws.FlociClientFactory')
    def test_emr_inventory_summarizes_clusters(self, factory_mock):
        emr = MagicMock()
        emr.meta = service_model('ListClusters', 'DescribeCluster', 'ListInstanceGroups', 'ListSteps')
        emr.can_paginate.return_value = False
        emr.list_clusters.return_value = {
            'Clusters': [{'Id': 'j-1', 'Name': 'analytics', 'Status': {'State': 'WAITING'}}],
        }
        emr.describe_cluster.return_value = {
            'Cluster': {'Id': 'j-1', 'Name': 'analytics', 'ReleaseLabel': 'emr-7.0.0'},
        }
        emr.list_instance_groups.return_value = {'InstanceGroups': [{'Id': 'ig-1'}]}
        emr.list_steps.return_value = {'Steps': [{'Id': 's-1'}]}
        factory_mock.return_value.client.return_value = emr

        result = emr_inventory()

        self.assertEqual(result['summary']['clusters'], 1)
        self.assertEqual(result['summary']['instance_groups'], 1)
        self.assertEqual(result['summary']['steps'], 1)
        self.assertEqual(result['clusters'][0]['release_label'], 'emr-7.0.0')

    @patch('dashboard.aws.FlociClientFactory')
    def test_wafv2_inventory_checks_regional_and_cloudfront_scopes(self, factory_mock):
        wafv2 = MagicMock()
        wafv2.meta = service_model('ListWebACLs', 'ListRuleGroups', 'ListIPSets', 'ListRegexPatternSets')
        wafv2.can_paginate.return_value = False
        wafv2.list_web_acls.return_value = {'WebACLs': [{'Name': 'local-acl', 'Id': 'acl-1'}]}
        wafv2.list_rule_groups.return_value = {'RuleGroups': [{'Name': 'rules', 'Id': 'rg-1'}]}
        wafv2.list_ip_sets.return_value = {'IPSets': []}
        wafv2.list_regex_pattern_sets.return_value = {'RegexPatternSets': []}
        factory_mock.return_value.client.return_value = wafv2

        result = wafv2_inventory()

        self.assertEqual(result['summary']['web_acls'], 2)
        self.assertEqual(result['summary']['rule_groups'], 2)
        self.assertEqual({item['Scope'] for item in result['web_acls']}, {'REGIONAL', 'CLOUDFRONT'})

    @patch('dashboard.aws.FlociClientFactory')
    def test_rdsdata_inventory_surfaces_request_oriented_operations(self, factory_mock):
        rdsdata = MagicMock()
        rdsdata.meta = service_model(
            'ExecuteStatement',
            'BatchExecuteStatement',
            'BeginTransaction',
            'CommitTransaction',
            'RollbackTransaction',
        )
        factory_mock.return_value.client.return_value = rdsdata

        result = rdsdata_inventory()

        self.assertEqual(result['summary']['available_sdk_operations'], 5)
        self.assertIn('ExecuteStatement', result['supported_from_sdk'])
        self.assertTrue(any(field['name'] == 'resourceArn' for field in result['request_fields']))
