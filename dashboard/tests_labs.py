import json
from unittest.mock import MagicMock, patch

from botocore.exceptions import ClientError
from django.test import SimpleTestCase
from django.urls import reverse

from .labs import labs_for_service, reset_lab, run_lab_step


class LabsPageTests(SimpleTestCase):
    @patch('dashboard.views.lab_status')
    def test_iam_labs_page_renders_create_user_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(reverse('dashboard:service-labs', kwargs={'service_key': 'iam'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<title>IAM Labs - Floci Dashboard</title>', html=True)
        self.assertContains(response, 'aria-label="Breadcrumb"')
        self.assertContains(response, f'href="{reverse("dashboard:index")}"')
        self.assertContains(response, f'href="{reverse("dashboard:service-page", kwargs={"service_key": "iam"})}"')
        self.assertContains(response, 'aria-current="page">Labs</span>')
        self.assertContains(response, 'Create an IAM user')
        self.assertContains(response, 'aws iam create-user --user-name Alice')
        self.assertContains(response, 'id="lab-reset"')
        self.assertContains(response, '>Not started</span>')
        self.assertNotContains(response, 'Floci health')
        self.assertContains(response, 'dashboard/labs.js')

    @patch('dashboard.views.lab_status')
    def test_iam_labs_page_renders_policy_lab_when_selected(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'iam'}),
            {'lab': 'attach-policy-alice'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Attach a managed policy to Alice')
        self.assertContains(response, 'aws iam create-policy --policy-name AliceListBucketsPolicy --policy-document file://alice-list-buckets-policy.json')
        self.assertContains(response, 'aws iam attach-user-policy --user-name Alice --policy-arn arn:aws:iam::000000000000:policy/AliceListBucketsPolicy')
        self.assertContains(response, 'aws iam list-attached-user-policies --user-name Alice')
        self.assertContains(response, 'alice-list-buckets-policy.json')
        self.assertContains(response, 's3:ListAllMyBuckets')

    @patch('dashboard.views.lab_status')
    def test_iam_labs_page_renders_access_key_lab_when_selected(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'iam'}),
            {'lab': 'access-key-alice'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Create an access key for Alice')
        self.assertContains(response, 'aws iam create-access-key --user-name Alice')
        self.assertContains(response, 'aws iam list-access-keys --user-name Alice')

    @patch('dashboard.views.lab_status')
    def test_iam_labs_page_renders_group_membership_lab_when_selected(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'iam'}),
            {'lab': 'group-membership-alice'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Add Alice to an IAM group')
        self.assertContains(response, 'aws iam create-group --group-name FlociDevelopers')
        self.assertContains(response, 'aws iam add-user-to-group --group-name FlociDevelopers --user-name Alice')
        self.assertContains(response, 'aws iam get-group --group-name FlociDevelopers')

    @patch('dashboard.views.lab_status')
    def test_iam_labs_page_renders_group_policy_lab_when_selected(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'iam'}),
            {'lab': 'group-policy-floci-developers'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Attach a policy to an IAM group')
        self.assertContains(response, 'aws iam create-policy --policy-name FlociDevelopersListBucketsPolicy --policy-document file://floci-developers-list-buckets-policy.json')
        self.assertContains(response, 'aws iam attach-group-policy --group-name FlociDevelopers --policy-arn arn:aws:iam::000000000000:policy/FlociDevelopersListBucketsPolicy')
        self.assertContains(response, 'aws iam list-attached-group-policies --group-name FlociDevelopers')
        self.assertContains(response, 'floci-developers-list-buckets-policy.json')

    @patch('dashboard.views.lab_status')
    def test_iam_labs_page_renders_inline_policy_lab_when_selected(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'iam'}),
            {'lab': 'inline-policy-alice'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Attach an inline policy to Alice')
        self.assertContains(response, 'aws iam put-user-policy --user-name Alice --policy-name AliceInlineListBuckets --policy-document file://alice-inline-list-buckets-policy.json')
        self.assertContains(response, 'aws iam list-user-policies --user-name Alice')
        self.assertContains(response, 'aws iam get-user-policy --user-name Alice --policy-name AliceInlineListBuckets')
        self.assertContains(response, 'alice-inline-list-buckets-policy.json')

    @patch('dashboard.views.lab_status')
    def test_iam_labs_page_renders_role_trust_lab_when_selected(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'iam'}),
            {'lab': 'role-trust-policy'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Create a role with a trust policy')
        self.assertContains(response, 'aws iam create-role --role-name FlociApplicationRole --assume-role-policy-document file://floci-application-role-trust-policy.json')
        self.assertContains(response, 'aws iam get-role --role-name FlociApplicationRole')
        self.assertContains(response, 'aws iam put-role-policy --role-name FlociApplicationRole --policy-name FlociApplicationListBuckets')
        self.assertContains(response, 'lambda.amazonaws.com')

    @patch('dashboard.views.lab_status')
    def test_iam_labs_page_renders_instance_profile_lab_when_selected(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'iam'}),
            {'lab': 'ec2-instance-profile'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Create an EC2 instance profile')
        self.assertContains(response, 'aws iam create-role --role-name FlociEc2Role')
        self.assertContains(response, 'aws iam create-instance-profile --instance-profile-name FlociEc2InstanceProfile')
        self.assertContains(response, 'aws iam add-role-to-instance-profile --instance-profile-name FlociEc2InstanceProfile --role-name FlociEc2Role')
        self.assertContains(response, 'aws iam list-instance-profiles-for-role --role-name FlociEc2Role')
        self.assertContains(response, 'ec2.amazonaws.com')

    @patch('dashboard.views.lab_status')
    def test_iam_labs_page_marks_existing_user_complete(self, status_mock):
        status_mock.return_value = {
            'complete': True,
            'steps': {
                'create-user': {
                    'verified': True,
                    'verification': {'message': 'User Alice exists in local IAM.'},
                },
            },
        }

        response = self.client.get(reverse('dashboard:service-labs', kwargs={'service_key': 'iam'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '>Complete</span>')
        self.assertContains(response, 'lab-step-complete')
        self.assertContains(response, 'User Alice exists in local IAM.')
        self.assertContains(response, '&#10003; Done</button>')

    def test_iam_service_page_links_to_labs(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'iam'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Identity and access management')
        self.assertContains(response, f'href="{reverse("dashboard:service-labs", kwargs={"service_key": "iam"})}"')
        self.assertContains(response, '>Labs</a>')

    @patch('dashboard.views.lab_status')
    def test_s3_labs_page_renders_create_bucket_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(reverse('dashboard:service-labs', kwargs={'service_key': 's3'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<title>S3 Labs - Floci Dashboard</title>', html=True)
        self.assertContains(response, 'aria-label="Breadcrumb"')
        self.assertContains(response, f'href="{reverse("dashboard:index")}"')
        self.assertContains(response, f'href="{reverse("dashboard:service-page", kwargs={"service_key": "s3"})}"')
        self.assertContains(response, 'aria-current="page">Labs</span>')
        self.assertContains(response, 'Create and inspect an S3 bucket')
        self.assertContains(response, 'aws s3api create-bucket --bucket floci-lab-basics')
        self.assertContains(response, 'aws s3api head-bucket --bucket floci-lab-basics')
        self.assertContains(response, 'aws s3api list-buckets')

    @patch('dashboard.views.lab_status')
    def test_s3_labs_page_renders_object_workflow_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 's3'}),
            {'lab': 'object-workflow'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Upload and retrieve an S3 object')
        self.assertContains(response, 'aws s3api create-bucket --bucket floci-lab-objects')
        self.assertContains(response, 'aws s3api put-object --bucket floci-lab-objects --key hello.txt --body hello.txt --content-type text/plain')
        self.assertContains(response, 'aws s3api list-objects-v2 --bucket floci-lab-objects')
        self.assertContains(response, 'aws s3api head-object --bucket floci-lab-objects --key hello.txt')
        self.assertContains(response, 'aws s3api get-object --bucket floci-lab-objects --key hello.txt downloaded-hello.txt')
        self.assertContains(response, 'Hello from the Floci S3 lab!')

    @patch('dashboard.views.lab_status')
    def test_s3_labs_page_renders_prefix_copy_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 's3'}),
            {'lab': 'prefix-copy'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Organize and copy objects with key prefixes')
        self.assertContains(response, 'aws s3api create-bucket --bucket floci-lab-prefixes')
        self.assertContains(response, 'aws s3api put-object --bucket floci-lab-prefixes --key incoming/report.txt --body report.txt --content-type text/plain')
        self.assertContains(response, 'aws s3api list-objects-v2 --bucket floci-lab-prefixes --prefix incoming/')
        self.assertContains(response, 'aws s3api copy-object --copy-source floci-lab-prefixes/incoming/report.txt --bucket floci-lab-prefixes --key archive/report.txt')
        self.assertContains(response, 'aws s3api list-objects-v2 --bucket floci-lab-prefixes --prefix archive/')
        self.assertContains(response, 'Status: ready for archive')

    @patch('dashboard.views.lab_status')
    def test_s3_labs_page_renders_metadata_tags_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 's3'}),
            {'lab': 'metadata-tags'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Add object metadata and tags')
        self.assertContains(response, 'aws s3api create-bucket --bucket floci-lab-metadata')
        self.assertContains(response, 'aws s3api put-object --bucket floci-lab-metadata --key documents/invoice.txt --body invoice.txt --content-type text/plain --metadata project=floci,classification=internal')
        self.assertContains(response, 'aws s3api head-object --bucket floci-lab-metadata --key documents/invoice.txt')
        self.assertContains(response, 'aws s3api put-object-tagging --bucket floci-lab-metadata --key documents/invoice.txt --tagging file://invoice-tags.json')
        self.assertContains(response, 'aws s3api get-object-tagging --bucket floci-lab-metadata --key documents/invoice.txt')
        self.assertContains(response, 'CostCenter')
        self.assertContains(response, 'training')

    @patch('dashboard.views.lab_status')
    def test_s3_labs_page_renders_version_recovery_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 's3'}),
            {'lab': 'version-recovery'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Enable versioning and recover an earlier object version')
        self.assertContains(response, 'aws s3api create-bucket --bucket floci-lab-versioning')
        self.assertContains(response, 'aws s3api put-bucket-versioning --bucket floci-lab-versioning --versioning-configuration Status=Enabled')
        self.assertContains(response, 'aws s3api put-object --bucket floci-lab-versioning --key configuration.txt --body configuration-v1.txt --content-type text/plain')
        self.assertContains(response, 'aws s3api list-object-versions --bucket floci-lab-versioning --prefix configuration.txt')
        self.assertContains(response, 'aws s3api get-object --bucket floci-lab-versioning --key configuration.txt --version-id &lt;v1-version-id&gt; recovered-configuration.txt')
        self.assertContains(response, 'feature_enabled=false')
        self.assertContains(response, 'feature_enabled=true')

    @patch('dashboard.views.lab_status')
    def test_s3_labs_page_renders_presigned_url_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 's3'}),
            {'lab': 'presigned-url'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Generate temporary access with a presigned URL')
        self.assertContains(response, 'aws s3api create-bucket --bucket floci-lab-presigned')
        self.assertContains(response, 'aws s3api put-object --bucket floci-lab-presigned --key shared/guide.txt --body guide.txt --content-type text/plain')
        self.assertContains(response, 'aws s3 presign s3://floci-lab-presigned/shared/guide.txt --expires-in 300')
        self.assertContains(response, 'Temporary access with an S3 presigned URL.')

    @patch('dashboard.views.lab_status')
    def test_s3_labs_page_renders_bucket_security_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 's3'}),
            {'lab': 'bucket-security'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Block public access and apply a bucket policy')
        self.assertContains(response, 'aws s3api create-bucket --bucket floci-lab-security')
        self.assertContains(response, 'aws s3api put-public-access-block --bucket floci-lab-security')
        self.assertContains(response, 'BlockPublicPolicy=true')
        self.assertContains(response, 'aws s3api get-public-access-block --bucket floci-lab-security')
        self.assertContains(response, 'aws s3api put-bucket-policy --bucket floci-lab-security --policy file://bucket-policy.json')
        self.assertContains(response, 'aws s3api get-bucket-policy --bucket floci-lab-security')
        self.assertContains(response, 'AllowLocalAccountList')
        self.assertContains(response, 's3:ListBucket')

    @patch('dashboard.views.lab_status')
    def test_s3_labs_page_renders_default_encryption_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 's3'}),
            {'lab': 'default-encryption'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Enable default bucket encryption')
        self.assertContains(response, 'aws s3api create-bucket --bucket floci-lab-encryption')
        self.assertContains(response, 'aws s3api put-bucket-encryption --bucket floci-lab-encryption --server-side-encryption-configuration file://encryption.json')
        self.assertContains(response, 'aws s3api get-bucket-encryption --bucket floci-lab-encryption')
        self.assertContains(response, 'aws s3api put-object --bucket floci-lab-encryption --key protected/record.txt --body record.txt --content-type text/plain')
        self.assertContains(response, 'aws s3api head-object --bucket floci-lab-encryption --key protected/record.txt')
        self.assertContains(response, 'AES256')

    @patch('dashboard.views.lab_status')
    def test_s3_labs_page_renders_lifecycle_retention_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 's3'}),
            {'lab': 'lifecycle-retention'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Automate retention with an S3 lifecycle rule')
        self.assertContains(response, 'aws s3api create-bucket --bucket floci-lab-lifecycle')
        self.assertContains(response, 'aws s3api put-object --bucket floci-lab-lifecycle --key logs/app.log --body app.log --content-type text/plain')
        self.assertContains(response, 'aws s3api put-bucket-lifecycle-configuration --bucket floci-lab-lifecycle --lifecycle-configuration file://lifecycle.json')
        self.assertContains(response, 'aws s3api get-bucket-lifecycle-configuration --bucket floci-lab-lifecycle')
        self.assertContains(response, 'ExpireApplicationLogsAfter30Days')
        self.assertContains(response, '&quot;Days&quot;: 30')
        self.assertContains(response, 'asynchronously')

    @patch('dashboard.views.lab_status')
    def test_s3_labs_page_renders_bucket_cors_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 's3'}),
            {'lab': 'bucket-cors'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Configure bucket CORS for a local web app')
        self.assertContains(response, 'aws s3api create-bucket --bucket floci-lab-cors')
        self.assertContains(response, 'aws s3api put-bucket-cors --bucket floci-lab-cors --cors-configuration file://cors.json')
        self.assertContains(response, 'aws s3api get-bucket-cors --bucket floci-lab-cors')
        self.assertContains(response, 'http://localhost:3000')
        self.assertContains(response, 'AllowLocalWebAppRead')
        self.assertContains(response, 'ETag')

    @patch('dashboard.views.lab_status')
    def test_s3_labs_page_renders_object_notifications_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 's3'}),
            {'lab': 'object-notifications-sqs'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Send S3 object-created events to SQS')
        self.assertContains(response, 'aws sqs create-queue --queue-name floci-lab-s3-events')
        self.assertContains(response, 'aws sqs set-queue-attributes --queue-url &lt;queue-url&gt; --attributes file://queue-attributes.json')
        self.assertContains(response, 'aws s3api create-bucket --bucket floci-lab-notifications')
        self.assertContains(response, 'aws s3api put-bucket-notification-configuration --bucket floci-lab-notifications')
        self.assertContains(response, 'aws s3api put-object --bucket floci-lab-notifications --key uploads/report.txt')
        self.assertContains(response, 'aws sqs receive-message --queue-url &lt;queue-url&gt;')
        self.assertContains(response, 'AllowS3ObjectCreatedEvents')
        self.assertContains(response, 's3:ObjectCreated:*')

    @patch('dashboard.views.lab_status')
    def test_s3_labs_page_renders_multipart_upload_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 's3'}),
            {'lab': 'multipart-upload'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Complete a multipart upload')
        self.assertContains(response, 'aws s3api create-bucket --bucket floci-lab-multipart')
        self.assertContains(response, 'aws s3api create-multipart-upload --bucket floci-lab-multipart')
        self.assertContains(response, 'aws s3api upload-part --bucket floci-lab-multipart')
        self.assertContains(response, '--part-number 1')
        self.assertContains(response, '--part-number 2')
        self.assertContains(response, 'aws s3api list-parts --bucket floci-lab-multipart')
        self.assertContains(response, 'aws s3api complete-multipart-upload --bucket floci-lab-multipart')
        self.assertContains(response, 'aws s3api get-object --bucket floci-lab-multipart')
        self.assertContains(response, '5 MiB')
        self.assertContains(response, 'parts.json')

    def test_s3_service_page_links_to_labs(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 's3'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, f'href="{reverse("dashboard:service-labs", kwargs={"service_key": "s3"})}"')
        self.assertContains(response, '>Labs</a>')

    def test_service_without_labs_returns_404(self):
        response = self.client.get(reverse('dashboard:service-labs', kwargs={'service_key': 'sqs'}))

        self.assertEqual(response.status_code, 404)


class LabsRunnerTests(SimpleTestCase):
    def test_iam_lab_registry_includes_alice_step(self):
        labs = labs_for_service('iam')

        self.assertEqual(labs[0]['key'], 'create-user-alice')
        self.assertEqual(labs[0]['steps'][0]['command'], 'aws iam create-user --user-name Alice')
        self.assertEqual(labs[1]['key'], 'attach-policy-alice')
        self.assertEqual(len(labs[1]['steps']), 4)
        self.assertEqual(labs[2]['key'], 'access-key-alice')
        self.assertEqual(len(labs[2]['steps']), 3)
        self.assertEqual(labs[3]['key'], 'group-membership-alice')
        self.assertEqual(len(labs[3]['steps']), 4)
        self.assertEqual(labs[4]['key'], 'group-policy-floci-developers')
        self.assertEqual(len(labs[4]['steps']), 6)
        self.assertEqual(labs[5]['key'], 'inline-policy-alice')
        self.assertEqual(len(labs[5]['steps']), 4)
        self.assertEqual(labs[6]['key'], 'role-trust-policy')
        self.assertEqual(len(labs[6]['steps']), 4)
        self.assertEqual(labs[7]['key'], 'ec2-instance-profile')
        self.assertEqual(len(labs[7]['steps']), 5)

    def test_s3_lab_registry_includes_create_bucket_workflow(self):
        labs = labs_for_service('s3')

        self.assertEqual(len(labs), 12)
        self.assertEqual(labs[0]['key'], 'create-bucket')
        self.assertEqual(
            [step['key'] for step in labs[0]['steps']],
            ['create-bucket', 'head-bucket', 'list-buckets'],
        )
        self.assertEqual(labs[1]['key'], 'object-workflow')
        self.assertEqual(
            [step['key'] for step in labs[1]['steps']],
            ['create-bucket', 'put-object', 'list-objects', 'head-object', 'get-object'],
        )
        self.assertEqual(labs[2]['key'], 'prefix-copy')
        self.assertEqual(
            [step['key'] for step in labs[2]['steps']],
            ['create-bucket', 'put-source-object', 'list-incoming-prefix', 'copy-object', 'list-archive-prefix'],
        )
        self.assertEqual(labs[3]['key'], 'metadata-tags')
        self.assertEqual(
            [step['key'] for step in labs[3]['steps']],
            ['create-bucket', 'put-object', 'head-object', 'put-object-tagging', 'get-object-tagging'],
        )
        self.assertEqual(labs[4]['key'], 'version-recovery')
        self.assertEqual(
            [step['key'] for step in labs[4]['steps']],
            ['create-bucket', 'enable-versioning', 'put-version-one', 'put-version-two', 'list-object-versions', 'get-version-one'],
        )
        self.assertEqual(labs[5]['key'], 'presigned-url')
        self.assertEqual(
            [step['key'] for step in labs[5]['steps']],
            ['create-bucket', 'put-object', 'presign-object'],
        )
        self.assertEqual(labs[6]['key'], 'bucket-security')
        self.assertEqual(
            [step['key'] for step in labs[6]['steps']],
            ['create-bucket', 'put-public-access-block', 'get-public-access-block', 'put-bucket-policy', 'get-bucket-policy'],
        )
        self.assertEqual(labs[7]['key'], 'default-encryption')
        self.assertEqual(
            [step['key'] for step in labs[7]['steps']],
            ['create-bucket', 'put-bucket-encryption', 'get-bucket-encryption', 'put-object', 'head-object'],
        )
        self.assertEqual(labs[8]['key'], 'lifecycle-retention')
        self.assertEqual(
            [step['key'] for step in labs[8]['steps']],
            ['create-bucket', 'put-object', 'put-lifecycle-configuration', 'get-lifecycle-configuration'],
        )
        self.assertEqual(labs[9]['key'], 'bucket-cors')
        self.assertEqual(
            [step['key'] for step in labs[9]['steps']],
            ['create-bucket', 'put-bucket-cors', 'get-bucket-cors'],
        )
        self.assertEqual(labs[10]['key'], 'object-notifications-sqs')
        self.assertEqual(
            [step['key'] for step in labs[10]['steps']],
            [
                'create-queue',
                'set-queue-policy',
                'create-bucket',
                'put-notification-configuration',
                'get-notification-configuration',
                'put-object',
                'receive-event',
            ],
        )
        self.assertEqual(labs[11]['key'], 'multipart-upload')
        self.assertEqual(
            [step['key'] for step in labs[11]['steps']],
            [
                'create-bucket',
                'create-multipart-upload',
                'upload-part-one',
                'upload-part-two',
                'list-parts',
                'complete-multipart-upload',
                'get-object',
            ],
        )

    @patch('dashboard.labs.FlociClientFactory')
    def test_reset_iam_create_user_lab_deletes_alice(self, factory_mock):
        iam = MagicMock()
        factory_mock.return_value.client.return_value = iam

        result = reset_lab('iam', 'create-user-alice')

        iam.delete_user.assert_called_once_with(UserName='Alice')
        self.assertTrue(result['reset'])
        self.assertTrue(result['deleted'])
        self.assertEqual(result['command'], 'aws iam delete-user --user-name Alice')

    @patch('dashboard.labs.FlociClientFactory')
    def test_policy_lab_create_policy_step_creates_and_verifies_policy(self, factory_mock):
        iam = MagicMock()
        iam.create_policy.return_value = {
            'Policy': {
                'PolicyName': 'AliceListBucketsPolicy',
                'Arn': 'arn:aws:iam::000000000000:policy/AliceListBucketsPolicy',
            },
        }
        iam.get_policy.return_value = {
            'Policy': {
                'PolicyName': 'AliceListBucketsPolicy',
                'Arn': 'arn:aws:iam::000000000000:policy/AliceListBucketsPolicy',
            },
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'attach-policy-alice', 'create-policy')

        iam.create_policy.assert_called_once()
        kwargs = iam.create_policy.call_args.kwargs
        self.assertEqual(kwargs['PolicyName'], 'AliceListBucketsPolicy')
        self.assertIn('s3:ListAllMyBuckets', kwargs['PolicyDocument'])
        iam.get_policy.assert_called_once_with(PolicyArn='arn:aws:iam::000000000000:policy/AliceListBucketsPolicy')
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_policy_lab_create_policy_step_treats_existing_policy_as_verified(self, factory_mock):
        iam = MagicMock()
        iam.create_policy.side_effect = ClientError(
            {'Error': {'Code': 'EntityAlreadyExists', 'Message': 'Policy already exists'}},
            'CreatePolicy',
        )
        iam.get_policy.return_value = {
            'Policy': {
                'PolicyName': 'AliceListBucketsPolicy',
                'Arn': 'arn:aws:iam::000000000000:policy/AliceListBucketsPolicy',
            },
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'attach-policy-alice', 'create-policy')

        iam.create_policy.assert_called_once()
        iam.get_policy.assert_called_with(PolicyArn='arn:aws:iam::000000000000:policy/AliceListBucketsPolicy')
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_policy_lab_attach_policy_step_attaches_and_verifies_policy(self, factory_mock):
        iam = MagicMock()
        iam.list_attached_user_policies.return_value = {
            'AttachedPolicies': [
                {
                    'PolicyName': 'AliceListBucketsPolicy',
                    'PolicyArn': 'arn:aws:iam::000000000000:policy/AliceListBucketsPolicy',
                },
            ],
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'attach-policy-alice', 'attach-policy')

        iam.attach_user_policy.assert_called_once_with(
            UserName='Alice',
            PolicyArn='arn:aws:iam::000000000000:policy/AliceListBucketsPolicy',
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_policy_lab_list_attached_policies_step_returns_attachment(self, factory_mock):
        iam = MagicMock()
        iam.list_attached_user_policies.return_value = {
            'AttachedPolicies': [
                {
                    'PolicyName': 'AliceListBucketsPolicy',
                    'PolicyArn': 'arn:aws:iam::000000000000:policy/AliceListBucketsPolicy',
                },
            ],
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'attach-policy-alice', 'list-attached-policies')

        iam.list_attached_user_policies.assert_called_with(UserName='Alice')
        self.assertTrue(result['verified'])
        self.assertIn('AliceListBucketsPolicy', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_policy_lab_reset_detaches_and_deletes_policy(self, factory_mock):
        iam = MagicMock()
        factory_mock.return_value.client.return_value = iam

        result = reset_lab('iam', 'attach-policy-alice')

        iam.detach_user_policy.assert_called_once_with(
            UserName='Alice',
            PolicyArn='arn:aws:iam::000000000000:policy/AliceListBucketsPolicy',
        )
        iam.delete_policy.assert_called_once_with(
            PolicyArn='arn:aws:iam::000000000000:policy/AliceListBucketsPolicy',
        )
        self.assertTrue(result['reset'])
        self.assertTrue(result['detached'])
        self.assertTrue(result['deleted'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_access_key_lab_create_key_step_creates_and_verifies_key(self, factory_mock):
        iam = MagicMock()
        iam.create_access_key.return_value = {
            'AccessKey': {
                'UserName': 'Alice',
                'AccessKeyId': 'AKIALOCALALICE',
                'SecretAccessKey': 'local-secret',
                'Status': 'Active',
            },
        }
        iam.list_access_keys.return_value = {
            'AccessKeyMetadata': [
                {
                    'UserName': 'Alice',
                    'AccessKeyId': 'AKIALOCALALICE',
                    'Status': 'Active',
                },
            ],
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'access-key-alice', 'create-access-key')

        iam.create_access_key.assert_called_once_with(UserName='Alice')
        iam.list_access_keys.assert_called_once_with(UserName='Alice')
        self.assertTrue(result['verified'])
        self.assertIn('AKIALOCALALICE', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_access_key_lab_list_keys_step_returns_key_metadata(self, factory_mock):
        iam = MagicMock()
        iam.list_access_keys.return_value = {
            'AccessKeyMetadata': [
                {
                    'UserName': 'Alice',
                    'AccessKeyId': 'AKIALOCALALICE',
                    'Status': 'Active',
                },
            ],
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'access-key-alice', 'list-access-keys')

        iam.list_access_keys.assert_called_with(UserName='Alice')
        self.assertTrue(result['verified'])
        self.assertIn('AKIALOCALALICE', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_access_key_lab_status_marks_key_steps_complete(self, factory_mock):
        iam = MagicMock()
        iam.get_user.return_value = {'User': {'UserName': 'Alice'}}
        iam.list_access_keys.return_value = {
            'AccessKeyMetadata': [
                {
                    'UserName': 'Alice',
                    'AccessKeyId': 'AKIALOCALALICE',
                    'Status': 'Active',
                },
            ],
        }
        factory_mock.return_value.client.return_value = iam

        from .labs import lab_status

        status = lab_status('iam', 'access-key-alice')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['create-access-key']['verified'])
        self.assertTrue(status['steps']['list-access-keys']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_access_key_lab_reset_deletes_alice_access_keys(self, factory_mock):
        iam = MagicMock()
        iam.list_access_keys.return_value = {
            'AccessKeyMetadata': [
                {'AccessKeyId': 'AKIALOCALONE'},
                {'AccessKeyId': 'AKIALOCALTWO'},
            ],
        }
        factory_mock.return_value.client.return_value = iam

        result = reset_lab('iam', 'access-key-alice')

        iam.delete_access_key.assert_any_call(UserName='Alice', AccessKeyId='AKIALOCALONE')
        iam.delete_access_key.assert_any_call(UserName='Alice', AccessKeyId='AKIALOCALTWO')
        self.assertEqual(iam.delete_access_key.call_count, 2)
        self.assertTrue(result['reset'])
        self.assertTrue(result['deleted'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_group_lab_create_group_step_creates_and_verifies_group(self, factory_mock):
        iam = MagicMock()
        iam.create_group.return_value = {'Group': {'GroupName': 'FlociDevelopers'}}
        iam.get_group.return_value = {'Group': {'GroupName': 'FlociDevelopers'}, 'Users': []}
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'group-membership-alice', 'create-group')

        iam.create_group.assert_called_once_with(GroupName='FlociDevelopers')
        iam.get_group.assert_called_once_with(GroupName='FlociDevelopers')
        self.assertTrue(result['verified'])
        self.assertIn('FlociDevelopers', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_group_lab_add_user_step_adds_and_verifies_membership(self, factory_mock):
        iam = MagicMock()
        iam.get_group.return_value = {
            'Group': {'GroupName': 'FlociDevelopers'},
            'Users': [{'UserName': 'Alice'}],
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'group-membership-alice', 'add-user-to-group')

        iam.add_user_to_group.assert_called_once_with(GroupName='FlociDevelopers', UserName='Alice')
        iam.get_group.assert_called_once_with(GroupName='FlociDevelopers')
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_group_lab_get_group_step_returns_membership(self, factory_mock):
        iam = MagicMock()
        iam.get_group.return_value = {
            'Group': {'GroupName': 'FlociDevelopers'},
            'Users': [{'UserName': 'Alice'}],
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'group-membership-alice', 'get-group')

        iam.get_group.assert_called_with(GroupName='FlociDevelopers')
        self.assertTrue(result['verified'])
        self.assertIn('Alice', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_group_lab_status_marks_membership_steps_complete(self, factory_mock):
        iam = MagicMock()
        iam.get_user.return_value = {'User': {'UserName': 'Alice'}}
        iam.get_group.return_value = {
            'Group': {'GroupName': 'FlociDevelopers'},
            'Users': [{'UserName': 'Alice'}],
        }
        factory_mock.return_value.client.return_value = iam

        from .labs import lab_status

        status = lab_status('iam', 'group-membership-alice')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['create-group']['verified'])
        self.assertTrue(status['steps']['add-user-to-group']['verified'])
        self.assertTrue(status['steps']['get-group']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_group_lab_reset_removes_alice_then_deletes_group(self, factory_mock):
        iam = MagicMock()
        factory_mock.return_value.client.return_value = iam

        result = reset_lab('iam', 'group-membership-alice')

        iam.remove_user_from_group.assert_called_once_with(GroupName='FlociDevelopers', UserName='Alice')
        iam.delete_group.assert_called_once_with(GroupName='FlociDevelopers')
        self.assertTrue(result['reset'])
        self.assertTrue(result['removed'])
        self.assertTrue(result['deleted'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_group_policy_lab_create_policy_step_creates_and_verifies_policy(self, factory_mock):
        iam = MagicMock()
        iam.create_policy.return_value = {
            'Policy': {
                'PolicyName': 'FlociDevelopersListBucketsPolicy',
                'Arn': 'arn:aws:iam::000000000000:policy/FlociDevelopersListBucketsPolicy',
            },
        }
        iam.get_policy.return_value = {
            'Policy': {
                'PolicyName': 'FlociDevelopersListBucketsPolicy',
                'Arn': 'arn:aws:iam::000000000000:policy/FlociDevelopersListBucketsPolicy',
            },
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'group-policy-floci-developers', 'create-policy')

        iam.create_policy.assert_called_once()
        kwargs = iam.create_policy.call_args.kwargs
        self.assertEqual(kwargs['PolicyName'], 'FlociDevelopersListBucketsPolicy')
        self.assertIn('s3:ListAllMyBuckets', kwargs['PolicyDocument'])
        iam.get_policy.assert_called_once_with(
            PolicyArn='arn:aws:iam::000000000000:policy/FlociDevelopersListBucketsPolicy',
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_group_policy_lab_attach_policy_step_attaches_and_verifies_policy(self, factory_mock):
        iam = MagicMock()
        iam.list_attached_group_policies.return_value = {
            'AttachedPolicies': [
                {
                    'PolicyName': 'FlociDevelopersListBucketsPolicy',
                    'PolicyArn': 'arn:aws:iam::000000000000:policy/FlociDevelopersListBucketsPolicy',
                },
            ],
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'group-policy-floci-developers', 'attach-group-policy')

        iam.attach_group_policy.assert_called_once_with(
            GroupName='FlociDevelopers',
            PolicyArn='arn:aws:iam::000000000000:policy/FlociDevelopersListBucketsPolicy',
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_group_policy_lab_list_attached_policies_step_returns_attachment(self, factory_mock):
        iam = MagicMock()
        iam.list_attached_group_policies.return_value = {
            'AttachedPolicies': [
                {
                    'PolicyName': 'FlociDevelopersListBucketsPolicy',
                    'PolicyArn': 'arn:aws:iam::000000000000:policy/FlociDevelopersListBucketsPolicy',
                },
            ],
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'group-policy-floci-developers', 'list-attached-group-policies')

        iam.list_attached_group_policies.assert_called_with(GroupName='FlociDevelopers')
        self.assertTrue(result['verified'])
        self.assertIn('FlociDevelopersListBucketsPolicy', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_group_policy_lab_status_marks_all_steps_complete(self, factory_mock):
        iam = MagicMock()
        iam.get_user.return_value = {'User': {'UserName': 'Alice'}}
        iam.get_group.return_value = {
            'Group': {'GroupName': 'FlociDevelopers'},
            'Users': [{'UserName': 'Alice'}],
        }
        iam.get_policy.return_value = {
            'Policy': {
                'PolicyName': 'FlociDevelopersListBucketsPolicy',
                'Arn': 'arn:aws:iam::000000000000:policy/FlociDevelopersListBucketsPolicy',
            },
        }
        iam.list_attached_group_policies.return_value = {
            'AttachedPolicies': [
                {
                    'PolicyName': 'FlociDevelopersListBucketsPolicy',
                    'PolicyArn': 'arn:aws:iam::000000000000:policy/FlociDevelopersListBucketsPolicy',
                },
            ],
        }
        factory_mock.return_value.client.return_value = iam

        from .labs import lab_status

        status = lab_status('iam', 'group-policy-floci-developers')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['create-group']['verified'])
        self.assertTrue(status['steps']['add-user-to-group']['verified'])
        self.assertTrue(status['steps']['create-policy']['verified'])
        self.assertTrue(status['steps']['attach-group-policy']['verified'])
        self.assertTrue(status['steps']['list-attached-group-policies']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_group_policy_lab_reset_detaches_policy_and_removes_group(self, factory_mock):
        iam = MagicMock()
        factory_mock.return_value.client.return_value = iam

        result = reset_lab('iam', 'group-policy-floci-developers')

        iam.detach_group_policy.assert_called_once_with(
            GroupName='FlociDevelopers',
            PolicyArn='arn:aws:iam::000000000000:policy/FlociDevelopersListBucketsPolicy',
        )
        iam.delete_policy.assert_called_once_with(
            PolicyArn='arn:aws:iam::000000000000:policy/FlociDevelopersListBucketsPolicy',
        )
        iam.remove_user_from_group.assert_called_once_with(GroupName='FlociDevelopers', UserName='Alice')
        iam.delete_group.assert_called_once_with(GroupName='FlociDevelopers')
        self.assertTrue(result['reset'])
        self.assertTrue(result['detached'])
        self.assertTrue(result['deleted_policy'])
        self.assertTrue(result['removed'])
        self.assertTrue(result['deleted_group'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_inline_policy_lab_puts_and_verifies_policy(self, factory_mock):
        iam = MagicMock()
        iam.get_user_policy.return_value = {
            'UserName': 'Alice',
            'PolicyName': 'AliceInlineListBuckets',
            'PolicyDocument': {'Statement': [{'Action': 's3:ListAllMyBuckets'}]},
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'inline-policy-alice', 'put-user-policy')

        iam.put_user_policy.assert_called_once()
        kwargs = iam.put_user_policy.call_args.kwargs
        self.assertEqual(kwargs['UserName'], 'Alice')
        self.assertEqual(kwargs['PolicyName'], 'AliceInlineListBuckets')
        self.assertIn('s3:ListAllMyBuckets', kwargs['PolicyDocument'])
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_inline_policy_lab_lists_policy_names(self, factory_mock):
        iam = MagicMock()
        iam.list_user_policies.return_value = {'PolicyNames': ['AliceInlineListBuckets']}
        iam.get_user_policy.return_value = {
            'UserName': 'Alice',
            'PolicyName': 'AliceInlineListBuckets',
            'PolicyDocument': {'Statement': [{'Action': 's3:ListAllMyBuckets'}]},
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'inline-policy-alice', 'list-user-policies')

        iam.list_user_policies.assert_called_once_with(UserName='Alice')
        self.assertTrue(result['verified'])
        self.assertIn('AliceInlineListBuckets', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_inline_policy_lab_gets_policy_document(self, factory_mock):
        iam = MagicMock()
        iam.get_user_policy.return_value = {
            'UserName': 'Alice',
            'PolicyName': 'AliceInlineListBuckets',
            'PolicyDocument': {'Statement': [{'Action': 's3:ListAllMyBuckets'}]},
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'inline-policy-alice', 'get-user-policy')

        iam.get_user_policy.assert_called_with(
            UserName='Alice',
            PolicyName='AliceInlineListBuckets',
        )
        self.assertTrue(result['verified'])
        self.assertIn('s3:ListAllMyBuckets', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_inline_policy_lab_status_marks_policy_steps_complete(self, factory_mock):
        iam = MagicMock()
        iam.get_user.return_value = {'User': {'UserName': 'Alice'}}
        iam.get_user_policy.return_value = {
            'UserName': 'Alice',
            'PolicyName': 'AliceInlineListBuckets',
            'PolicyDocument': {'Statement': [{'Action': 's3:ListAllMyBuckets'}]},
        }
        factory_mock.return_value.client.return_value = iam

        from .labs import lab_status

        status = lab_status('iam', 'inline-policy-alice')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['put-user-policy']['verified'])
        self.assertTrue(status['steps']['list-user-policies']['verified'])
        self.assertTrue(status['steps']['get-user-policy']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_inline_policy_lab_reset_deletes_policy_and_leaves_alice(self, factory_mock):
        iam = MagicMock()
        factory_mock.return_value.client.return_value = iam

        result = reset_lab('iam', 'inline-policy-alice')

        iam.delete_user_policy.assert_called_once_with(
            UserName='Alice',
            PolicyName='AliceInlineListBuckets',
        )
        iam.delete_user.assert_not_called()
        self.assertTrue(result['reset'])
        self.assertTrue(result['deleted'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_role_lab_creates_role_with_lambda_trust_policy(self, factory_mock):
        iam = MagicMock()
        role = {
            'RoleName': 'FlociApplicationRole',
            'AssumeRolePolicyDocument': {
                'Statement': [{
                    'Effect': 'Allow',
                    'Principal': {'Service': 'lambda.amazonaws.com'},
                    'Action': 'sts:AssumeRole',
                }],
            },
        }
        iam.create_role.return_value = {'Role': role}
        iam.get_role.return_value = {'Role': role}
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'role-trust-policy', 'create-role')

        iam.create_role.assert_called_once()
        kwargs = iam.create_role.call_args.kwargs
        self.assertEqual(kwargs['RoleName'], 'FlociApplicationRole')
        self.assertIn('lambda.amazonaws.com', kwargs['AssumeRolePolicyDocument'])
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_role_lab_puts_and_verifies_permissions_policy(self, factory_mock):
        iam = MagicMock()
        iam.get_role_policy.return_value = {
            'RoleName': 'FlociApplicationRole',
            'PolicyName': 'FlociApplicationListBuckets',
            'PolicyDocument': {'Statement': [{'Action': 's3:ListAllMyBuckets'}]},
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'role-trust-policy', 'put-role-policy')

        iam.put_role_policy.assert_called_once()
        kwargs = iam.put_role_policy.call_args.kwargs
        self.assertEqual(kwargs['RoleName'], 'FlociApplicationRole')
        self.assertEqual(kwargs['PolicyName'], 'FlociApplicationListBuckets')
        self.assertIn('s3:ListAllMyBuckets', kwargs['PolicyDocument'])
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_role_lab_status_marks_trust_and_permissions_complete(self, factory_mock):
        iam = MagicMock()
        iam.get_role.return_value = {
            'Role': {
                'RoleName': 'FlociApplicationRole',
                'AssumeRolePolicyDocument': {
                    'Statement': [{
                        'Effect': 'Allow',
                        'Principal': {'Service': 'lambda.amazonaws.com'},
                        'Action': 'sts:AssumeRole',
                    }],
                },
            },
        }
        iam.get_role_policy.return_value = {
            'RoleName': 'FlociApplicationRole',
            'PolicyName': 'FlociApplicationListBuckets',
        }
        factory_mock.return_value.client.return_value = iam

        from .labs import lab_status

        status = lab_status('iam', 'role-trust-policy')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['create-role']['verified'])
        self.assertTrue(status['steps']['get-role']['verified'])
        self.assertTrue(status['steps']['put-role-policy']['verified'])
        self.assertTrue(status['steps']['get-role-policy']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_role_lab_reset_deletes_policy_before_role(self, factory_mock):
        iam = MagicMock()
        factory_mock.return_value.client.return_value = iam

        result = reset_lab('iam', 'role-trust-policy')

        iam.delete_role_policy.assert_called_once_with(
            RoleName='FlociApplicationRole',
            PolicyName='FlociApplicationListBuckets',
        )
        iam.delete_role.assert_called_once_with(RoleName='FlociApplicationRole')
        self.assertTrue(result['deleted_policy'])
        self.assertTrue(result['deleted_role'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_instance_profile_lab_creates_profile(self, factory_mock):
        iam = MagicMock()
        iam.create_instance_profile.return_value = {
            'InstanceProfile': {
                'InstanceProfileName': 'FlociEc2InstanceProfile',
                'Roles': [],
            },
        }
        iam.get_instance_profile.return_value = {
            'InstanceProfile': {
                'InstanceProfileName': 'FlociEc2InstanceProfile',
                'Roles': [],
            },
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'ec2-instance-profile', 'create-instance-profile')

        iam.create_instance_profile.assert_called_once_with(
            InstanceProfileName='FlociEc2InstanceProfile',
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_instance_profile_lab_adds_role_and_verifies_association(self, factory_mock):
        iam = MagicMock()
        iam.get_instance_profile.side_effect = [
            {
                'InstanceProfile': {
                    'InstanceProfileName': 'FlociEc2InstanceProfile',
                    'Roles': [],
                },
            },
            {
                'InstanceProfile': {
                    'InstanceProfileName': 'FlociEc2InstanceProfile',
                    'Roles': [{'RoleName': 'FlociEc2Role'}],
                },
            },
        ]
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'ec2-instance-profile', 'add-role-to-instance-profile')

        iam.add_role_to_instance_profile.assert_called_once_with(
            InstanceProfileName='FlociEc2InstanceProfile',
            RoleName='FlociEc2Role',
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_instance_profile_lab_status_marks_association_steps_complete(self, factory_mock):
        iam = MagicMock()
        iam.get_role.return_value = {
            'Role': {
                'RoleName': 'FlociEc2Role',
                'AssumeRolePolicyDocument': {
                    'Statement': [{
                        'Effect': 'Allow',
                        'Principal': {'Service': 'ec2.amazonaws.com'},
                        'Action': 'sts:AssumeRole',
                    }],
                },
            },
        }
        iam.get_instance_profile.return_value = {
            'InstanceProfile': {
                'InstanceProfileName': 'FlociEc2InstanceProfile',
                'Roles': [{'RoleName': 'FlociEc2Role'}],
            },
        }
        factory_mock.return_value.client.return_value = iam

        from .labs import lab_status

        status = lab_status('iam', 'ec2-instance-profile')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['create-role']['verified'])
        self.assertTrue(status['steps']['create-instance-profile']['verified'])
        self.assertTrue(status['steps']['add-role-to-instance-profile']['verified'])
        self.assertTrue(status['steps']['get-instance-profile']['verified'])
        self.assertTrue(status['steps']['list-instance-profiles-for-role']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_instance_profile_lab_reset_removes_association_before_resources(self, factory_mock):
        iam = MagicMock()
        factory_mock.return_value.client.return_value = iam

        result = reset_lab('iam', 'ec2-instance-profile')

        iam.remove_role_from_instance_profile.assert_called_once_with(
            InstanceProfileName='FlociEc2InstanceProfile',
            RoleName='FlociEc2Role',
        )
        iam.delete_instance_profile.assert_called_once_with(
            InstanceProfileName='FlociEc2InstanceProfile',
        )
        iam.delete_role.assert_called_once_with(RoleName='FlociEc2Role')
        self.assertTrue(result['removed'])
        self.assertTrue(result['deleted_profile'])
        self.assertTrue(result['deleted_role'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_create_bucket_step_creates_and_verifies_bucket(self, factory_mock):
        s3 = MagicMock()
        s3.create_bucket.return_value = {'Location': '/floci-lab-basics'}
        s3.head_bucket.return_value = {'BucketRegion': 'us-east-1'}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'create-bucket', 'create-bucket')

        s3.create_bucket.assert_called_once_with(Bucket='floci-lab-basics')
        s3.head_bucket.assert_called_once_with(Bucket='floci-lab-basics')
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_create_bucket_step_treats_existing_bucket_as_verified(self, factory_mock):
        s3 = MagicMock()
        s3.create_bucket.side_effect = ClientError(
            {'Error': {'Code': 'BucketAlreadyOwnedByYou', 'Message': 'Bucket exists'}},
            'CreateBucket',
        )
        s3.head_bucket.return_value = {'BucketRegion': 'us-east-1'}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'create-bucket', 'create-bucket')

        self.assertTrue(result['verified'])
        self.assertGreaterEqual(s3.head_bucket.call_count, 2)

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_head_bucket_step_verifies_bucket(self, factory_mock):
        s3 = MagicMock()
        s3.head_bucket.return_value = {'BucketRegion': 'us-east-1'}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'create-bucket', 'head-bucket')

        self.assertTrue(result['verified'])
        self.assertIn('us-east-1', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_list_buckets_step_returns_lab_bucket(self, factory_mock):
        s3 = MagicMock()
        s3.list_buckets.return_value = {
            'Buckets': [{'Name': 'floci-lab-basics'}],
        }
        s3.head_bucket.return_value = {'BucketRegion': 'us-east-1'}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'create-bucket', 'list-buckets')

        s3.list_buckets.assert_called_once_with()
        self.assertTrue(result['verified'])
        self.assertIn('floci-lab-basics', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_lab_status_marks_all_steps_complete_from_live_bucket(self, factory_mock):
        s3 = MagicMock()
        s3.head_bucket.return_value = {'BucketRegion': 'us-east-1'}
        factory_mock.return_value.client.return_value = s3

        from .labs import lab_status

        status = lab_status('s3', 'create-bucket')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['create-bucket']['verified'])
        self.assertTrue(status['steps']['head-bucket']['verified'])
        self.assertTrue(status['steps']['list-buckets']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_lab_reset_removes_versions_objects_and_bucket(self, factory_mock):
        s3 = MagicMock()
        version_paginator = MagicMock()
        object_paginator = MagicMock()
        version_paginator.paginate.return_value = [{
            'Versions': [{'Key': 'versioned.txt', 'VersionId': 'v1'}],
            'DeleteMarkers': [{'Key': 'deleted.txt', 'VersionId': 'd1'}],
        }]
        object_paginator.paginate.return_value = [{
            'Contents': [{'Key': 'plain.txt'}],
        }]
        s3.get_paginator.side_effect = [version_paginator, object_paginator]
        factory_mock.return_value.client.return_value = s3

        result = reset_lab('s3', 'create-bucket')

        self.assertEqual(s3.delete_objects.call_count, 2)
        s3.delete_bucket.assert_called_once_with(Bucket='floci-lab-basics')
        self.assertEqual(result['deleted_objects'], 3)
        self.assertTrue(result['deleted_bucket'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_object_lab_uploads_exact_artifact_and_verifies_it(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = b'Hello from the Floci S3 lab!\n'
        s3.put_object.return_value = {'ETag': '"etag"'}
        s3.head_object.return_value = {
            'ContentType': 'text/plain',
            'ContentLength': 29,
        }
        s3.get_object.return_value = {'Body': body}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'object-workflow', 'put-object')

        s3.put_object.assert_called_once_with(
            Bucket='floci-lab-objects',
            Key='hello.txt',
            Body=b'Hello from the Floci S3 lab!\n',
            ContentType='text/plain',
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_object_lab_lists_and_verifies_hello_object(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = b'Hello from the Floci S3 lab!\n'
        s3.list_objects_v2.return_value = {
            'Contents': [{'Key': 'hello.txt', 'Size': 29}],
        }
        s3.head_object.return_value = {
            'ContentType': 'text/plain',
            'ContentLength': 29,
        }
        s3.get_object.return_value = {'Body': body}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'object-workflow', 'list-objects')

        s3.list_objects_v2.assert_called_once_with(Bucket='floci-lab-objects')
        self.assertTrue(result['verified'])
        self.assertIn('hello.txt', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_object_lab_download_response_includes_exact_body(self, factory_mock):
        s3 = MagicMock()
        download_body = MagicMock()
        download_body.read.return_value = b'Hello from the Floci S3 lab!\n'
        verify_body = MagicMock()
        verify_body.read.return_value = b'Hello from the Floci S3 lab!\n'
        s3.get_object.side_effect = [
            {'Body': download_body, 'ContentType': 'text/plain', 'ContentLength': 29},
            {'Body': verify_body},
        ]
        s3.head_object.return_value = {
            'ContentType': 'text/plain',
            'ContentLength': 29,
        }
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'object-workflow', 'get-object')

        self.assertTrue(result['verified'])
        self.assertIn('downloaded-hello.txt', result['stdout'])
        self.assertIn('Hello from the Floci S3 lab!', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_object_lab_status_requires_matching_content_and_metadata(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = b'Hello from the Floci S3 lab!\n'
        s3.head_bucket.return_value = {'BucketRegion': 'us-east-1'}
        s3.head_object.return_value = {
            'ContentType': 'text/plain',
            'ContentLength': 29,
        }
        s3.get_object.return_value = {'Body': body}
        factory_mock.return_value.client.return_value = s3

        from .labs import lab_status

        status = lab_status('s3', 'object-workflow')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['create-bucket']['verified'])
        self.assertTrue(status['steps']['put-object']['verified'])
        self.assertTrue(status['steps']['get-object']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_object_lab_reset_deletes_its_bucket(self, factory_mock):
        s3 = MagicMock()
        version_paginator = MagicMock()
        object_paginator = MagicMock()
        version_paginator.paginate.return_value = []
        object_paginator.paginate.return_value = [{
            'Contents': [{'Key': 'hello.txt'}],
        }]
        s3.get_paginator.side_effect = [version_paginator, object_paginator]
        factory_mock.return_value.client.return_value = s3

        result = reset_lab('s3', 'object-workflow')

        s3.delete_objects.assert_called_once_with(
            Bucket='floci-lab-objects',
            Delete={'Objects': [{'Key': 'hello.txt'}], 'Quiet': True},
        )
        s3.delete_bucket.assert_called_once_with(Bucket='floci-lab-objects')
        self.assertEqual(result['lab'], 'object-workflow')
        self.assertTrue(result['deleted_bucket'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_prefix_lab_uploads_source_report(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = b'Floci S3 lab report\nStatus: ready for archive\n'
        s3.put_object.return_value = {'ETag': '"source"'}
        s3.get_object.return_value = {'Body': body}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'prefix-copy', 'put-source-object')

        s3.put_object.assert_called_once_with(
            Bucket='floci-lab-prefixes',
            Key='incoming/report.txt',
            Body=b'Floci S3 lab report\nStatus: ready for archive\n',
            ContentType='text/plain',
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_prefix_lab_lists_exact_incoming_prefix(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = b'Floci S3 lab report\nStatus: ready for archive\n'
        s3.list_objects_v2.return_value = {
            'Contents': [{'Key': 'incoming/report.txt'}],
        }
        s3.get_object.return_value = {'Body': body}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'prefix-copy', 'list-incoming-prefix')

        s3.list_objects_v2.assert_called_once_with(
            Bucket='floci-lab-prefixes',
            Prefix='incoming/',
        )
        self.assertTrue(result['verified'])
        self.assertIn('incoming/report.txt', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_prefix_lab_copies_report_to_archive(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = b'Floci S3 lab report\nStatus: ready for archive\n'
        s3.copy_object.return_value = {'CopyObjectResult': {'ETag': '"archive"'}}
        s3.get_object.return_value = {'Body': body}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'prefix-copy', 'copy-object')

        s3.copy_object.assert_called_once_with(
            CopySource={
                'Bucket': 'floci-lab-prefixes',
                'Key': 'incoming/report.txt',
            },
            Bucket='floci-lab-prefixes',
            Key='archive/report.txt',
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_prefix_lab_status_tracks_source_and_archive_separately(self, factory_mock):
        s3 = MagicMock()
        source_body = MagicMock()
        source_body.read.return_value = b'Floci S3 lab report\nStatus: ready for archive\n'
        archive_body = MagicMock()
        archive_body.read.return_value = b'Floci S3 lab report\nStatus: ready for archive\n'
        s3.head_bucket.return_value = {'BucketRegion': 'us-east-1'}
        s3.get_object.side_effect = [
            {'Body': source_body},
            {'Body': archive_body},
        ]
        factory_mock.return_value.client.return_value = s3

        from .labs import lab_status

        status = lab_status('s3', 'prefix-copy')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['put-source-object']['verified'])
        self.assertTrue(status['steps']['list-incoming-prefix']['verified'])
        self.assertTrue(status['steps']['copy-object']['verified'])
        self.assertTrue(status['steps']['list-archive-prefix']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_prefix_lab_reset_deletes_both_objects_and_bucket(self, factory_mock):
        s3 = MagicMock()
        version_paginator = MagicMock()
        object_paginator = MagicMock()
        version_paginator.paginate.return_value = []
        object_paginator.paginate.return_value = [{
            'Contents': [
                {'Key': 'incoming/report.txt'},
                {'Key': 'archive/report.txt'},
            ],
        }]
        s3.get_paginator.side_effect = [version_paginator, object_paginator]
        factory_mock.return_value.client.return_value = s3

        result = reset_lab('s3', 'prefix-copy')

        s3.delete_objects.assert_called_once_with(
            Bucket='floci-lab-prefixes',
            Delete={
                'Objects': [
                    {'Key': 'incoming/report.txt'},
                    {'Key': 'archive/report.txt'},
                ],
                'Quiet': True,
            },
        )
        s3.delete_bucket.assert_called_once_with(Bucket='floci-lab-prefixes')
        self.assertEqual(result['deleted_objects'], 2)
        self.assertTrue(result['deleted_bucket'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_metadata_lab_uploads_invoice_with_user_metadata(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = b'Invoice: FLOCI-1001\nAmount: 42.00\n'
        s3.put_object.return_value = {'ETag': '"invoice"'}
        s3.head_object.return_value = {
            'ContentType': 'text/plain',
            'ContentLength': 34,
            'Metadata': {
                'project': 'floci',
                'classification': 'internal',
            },
        }
        s3.get_object.return_value = {'Body': body}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'metadata-tags', 'put-object')

        s3.put_object.assert_called_once_with(
            Bucket='floci-lab-metadata',
            Key='documents/invoice.txt',
            Body=b'Invoice: FLOCI-1001\nAmount: 42.00\n',
            ContentType='text/plain',
            Metadata={
                'project': 'floci',
                'classification': 'internal',
            },
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_metadata_lab_head_object_returns_metadata(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = b'Invoice: FLOCI-1001\nAmount: 42.00\n'
        s3.head_object.return_value = {
            'ContentType': 'text/plain',
            'ContentLength': 34,
            'Metadata': {
                'project': 'floci',
                'classification': 'internal',
            },
        }
        s3.get_object.return_value = {'Body': body}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'metadata-tags', 'head-object')

        s3.head_object.assert_called_with(
            Bucket='floci-lab-metadata',
            Key='documents/invoice.txt',
        )
        self.assertTrue(result['verified'])
        self.assertIn('classification', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_metadata_lab_applies_expected_tags(self, factory_mock):
        s3 = MagicMock()
        s3.put_object_tagging.return_value = {}
        s3.get_object_tagging.return_value = {
            'TagSet': [
                {'Key': 'CostCenter', 'Value': 'training'},
                {'Key': 'Environment', 'Value': 'lab'},
            ],
        }
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'metadata-tags', 'put-object-tagging')

        s3.put_object_tagging.assert_called_once_with(
            Bucket='floci-lab-metadata',
            Key='documents/invoice.txt',
            Tagging={
                'TagSet': [
                    {'Key': 'Environment', 'Value': 'lab'},
                    {'Key': 'CostCenter', 'Value': 'training'},
                ],
            },
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_metadata_lab_status_tracks_metadata_and_tags_separately(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = b'Invoice: FLOCI-1001\nAmount: 42.00\n'
        s3.head_bucket.return_value = {'BucketRegion': 'us-east-1'}
        s3.head_object.return_value = {
            'ContentType': 'text/plain',
            'ContentLength': 34,
            'Metadata': {
                'project': 'floci',
                'classification': 'internal',
            },
        }
        s3.get_object.return_value = {'Body': body}
        s3.get_object_tagging.return_value = {
            'TagSet': [
                {'Key': 'Environment', 'Value': 'lab'},
                {'Key': 'CostCenter', 'Value': 'training'},
            ],
        }
        factory_mock.return_value.client.return_value = s3

        from .labs import lab_status

        status = lab_status('s3', 'metadata-tags')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['put-object']['verified'])
        self.assertTrue(status['steps']['head-object']['verified'])
        self.assertTrue(status['steps']['put-object-tagging']['verified'])
        self.assertTrue(status['steps']['get-object-tagging']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_metadata_lab_reset_deletes_object_and_bucket(self, factory_mock):
        s3 = MagicMock()
        version_paginator = MagicMock()
        object_paginator = MagicMock()
        version_paginator.paginate.return_value = []
        object_paginator.paginate.return_value = [{
            'Contents': [{'Key': 'documents/invoice.txt'}],
        }]
        s3.get_paginator.side_effect = [version_paginator, object_paginator]
        factory_mock.return_value.client.return_value = s3

        result = reset_lab('s3', 'metadata-tags')

        s3.delete_objects.assert_called_once_with(
            Bucket='floci-lab-metadata',
            Delete={
                'Objects': [{'Key': 'documents/invoice.txt'}],
                'Quiet': True,
            },
        )
        s3.delete_bucket.assert_called_once_with(Bucket='floci-lab-metadata')
        self.assertTrue(result['deleted_bucket'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_version_lab_enables_bucket_versioning(self, factory_mock):
        s3 = MagicMock()
        s3.put_bucket_versioning.return_value = {}
        s3.get_bucket_versioning.return_value = {'Status': 'Enabled'}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'version-recovery', 'enable-versioning')

        s3.put_bucket_versioning.assert_called_once_with(
            Bucket='floci-lab-versioning',
            VersioningConfiguration={'Status': 'Enabled'},
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_version_lab_writes_v1_and_verifies_its_content(self, factory_mock):
        s3 = MagicMock()
        s3.put_object.return_value = {'VersionId': 'version-one'}
        s3.list_object_versions.return_value = {
            'Versions': [{
                'Key': 'configuration.txt',
                'VersionId': 'version-one',
                'IsLatest': True,
            }],
        }

        def get_object(**kwargs):
            body = MagicMock()
            body.read.return_value = b'feature_enabled=false\nrelease=v1\n'
            return {'Body': body, 'VersionId': kwargs['VersionId']}

        s3.get_object.side_effect = get_object
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'version-recovery', 'put-version-one')

        s3.put_object.assert_called_once_with(
            Bucket='floci-lab-versioning',
            Key='configuration.txt',
            Body=b'feature_enabled=false\nrelease=v1\n',
            ContentType='text/plain',
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_version_lab_identifies_latest_v2_and_preserved_v1(self, factory_mock):
        s3 = MagicMock()
        s3.list_object_versions.return_value = {
            'Versions': [
                {
                    'Key': 'configuration.txt',
                    'VersionId': 'version-two',
                    'IsLatest': True,
                },
                {
                    'Key': 'configuration.txt',
                    'VersionId': 'version-one',
                    'IsLatest': False,
                },
            ],
        }

        def get_object(**kwargs):
            body = MagicMock()
            body.read.return_value = (
                b'feature_enabled=false\nrelease=v1\n'
                if kwargs['VersionId'] == 'version-one'
                else b'feature_enabled=true\nrelease=v2\n'
            )
            return {'Body': body, 'VersionId': kwargs['VersionId']}

        s3.get_object.side_effect = get_object
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'version-recovery', 'list-object-versions')

        self.assertTrue(result['verified'])
        self.assertIn('version-one', result['stdout'])
        self.assertIn('version-two', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_version_lab_skips_unreadable_stale_versions(self, factory_mock):
        s3 = MagicMock()
        s3.put_object.return_value = {'VersionId': 'new-version-one'}
        s3.list_object_versions.return_value = {
            'Versions': [
                {
                    'Key': 'configuration.txt',
                    'VersionId': 'new-version-one',
                    'IsLatest': True,
                },
                {
                    'Key': 'configuration.txt',
                    'VersionId': 'stale-version',
                    'IsLatest': False,
                },
            ],
        }

        def get_object(**kwargs):
            if kwargs['VersionId'] == 'stale-version':
                raise ClientError(
                    {'Error': {'Code': '500', 'Message': 'Internal Server Error'}},
                    'GetObject',
                )
            body = MagicMock()
            body.read.return_value = b'feature_enabled=false\nrelease=v1\n'
            return {'Body': body}

        s3.get_object.side_effect = get_object
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'version-recovery', 'put-version-one')

        self.assertTrue(result['verified'])
        self.assertIn('new-version-one', result['verification']['message'])
        self.assertNotIn('stale-version', result['verification']['message'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_version_lab_recovers_v1_by_discovered_version_id(self, factory_mock):
        s3 = MagicMock()
        s3.list_object_versions.return_value = {
            'Versions': [
                {
                    'Key': 'configuration.txt',
                    'VersionId': 'version-two',
                    'IsLatest': True,
                },
                {
                    'Key': 'configuration.txt',
                    'VersionId': 'version-one',
                    'IsLatest': False,
                },
            ],
        }

        def get_object(**kwargs):
            body = MagicMock()
            body.read.return_value = (
                b'feature_enabled=false\nrelease=v1\n'
                if kwargs['VersionId'] == 'version-one'
                else b'feature_enabled=true\nrelease=v2\n'
            )
            return {'Body': body, 'VersionId': kwargs['VersionId']}

        s3.get_object.side_effect = get_object
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'version-recovery', 'get-version-one')

        self.assertTrue(result['verified'])
        self.assertIn('"VersionId": "version-one"', result['stdout'])
        self.assertIn('feature_enabled=false', result['stdout'])
        self.assertIn('recovered-configuration.txt', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_version_lab_status_requires_latest_v2(self, factory_mock):
        s3 = MagicMock()
        s3.head_bucket.return_value = {'BucketRegion': 'us-east-1'}
        s3.get_bucket_versioning.return_value = {'Status': 'Enabled'}
        s3.list_object_versions.return_value = {
            'Versions': [
                {
                    'Key': 'configuration.txt',
                    'VersionId': 'version-two',
                    'IsLatest': True,
                },
                {
                    'Key': 'configuration.txt',
                    'VersionId': 'version-one',
                    'IsLatest': False,
                },
            ],
        }

        def get_object(**kwargs):
            body = MagicMock()
            body.read.return_value = (
                b'feature_enabled=false\nrelease=v1\n'
                if kwargs['VersionId'] == 'version-one'
                else b'feature_enabled=true\nrelease=v2\n'
            )
            return {'Body': body}

        s3.get_object.side_effect = get_object
        factory_mock.return_value.client.return_value = s3

        from .labs import lab_status

        status = lab_status('s3', 'version-recovery')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['enable-versioning']['verified'])
        self.assertTrue(status['steps']['put-version-one']['verified'])
        self.assertTrue(status['steps']['put-version-two']['verified'])
        self.assertTrue(status['steps']['get-version-one']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_version_lab_reset_deletes_all_versions(self, factory_mock):
        s3 = MagicMock()
        version_paginator = MagicMock()
        object_paginator = MagicMock()
        version_paginator.paginate.return_value = [{
            'Versions': [
                {'Key': 'configuration.txt', 'VersionId': 'version-two'},
                {'Key': 'configuration.txt', 'VersionId': 'version-one'},
            ],
        }]
        object_paginator.paginate.return_value = []
        s3.get_paginator.side_effect = [version_paginator, object_paginator]
        factory_mock.return_value.client.return_value = s3

        result = reset_lab('s3', 'version-recovery')

        s3.delete_objects.assert_called_once_with(
            Bucket='floci-lab-versioning',
            Delete={
                'Objects': [
                    {'Key': 'configuration.txt', 'VersionId': 'version-two'},
                    {'Key': 'configuration.txt', 'VersionId': 'version-one'},
                ],
                'Quiet': True,
            },
        )
        s3.delete_bucket.assert_called_once_with(Bucket='floci-lab-versioning')
        self.assertEqual(result['deleted_objects'], 2)

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_presigned_lab_uploads_exact_guide(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = b'Temporary access with an S3 presigned URL.\n'
        s3.put_object.return_value = {'ETag': '"guide"'}
        s3.get_object.return_value = {'Body': body}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'presigned-url', 'put-object')

        s3.put_object.assert_called_once_with(
            Bucket='floci-lab-presigned',
            Key='shared/guide.txt',
            Body=b'Temporary access with an S3 presigned URL.\n',
            ContentType='text/plain',
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs._redeem_s3_presigned_url')
    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_presigned_lab_generates_and_redeems_url(self, factory_mock, redeem_mock):
        s3 = MagicMock()
        s3.generate_presigned_url.return_value = (
            'http://localhost:4566/floci-lab-presigned/shared/guide.txt?signature=sample'
        )
        factory_mock.return_value.client.return_value = s3
        redeem_mock.return_value = b'Temporary access with an S3 presigned URL.\n'

        result = run_lab_step('s3', 'presigned-url', 'presign-object')

        s3.generate_presigned_url.assert_called_once_with(
            'get_object',
            Params={
                'Bucket': 'floci-lab-presigned',
                'Key': 'shared/guide.txt',
            },
            ExpiresIn=300,
        )
        redeem_mock.assert_called_once_with(
            'http://localhost:4566/floci-lab-presigned/shared/guide.txt?signature=sample',
        )
        self.assertTrue(result['verified'])
        self.assertIn('signature=sample', result['stdout'])
        self.assertIn('Temporary access with an S3 presigned URL.', result['stdout'])

    @patch('dashboard.labs._redeem_s3_presigned_url')
    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_presigned_lab_status_requires_successful_http_get(self, factory_mock, redeem_mock):
        s3 = MagicMock()
        object_body = MagicMock()
        object_body.read.return_value = b'Temporary access with an S3 presigned URL.\n'
        s3.head_bucket.return_value = {'BucketRegion': 'us-east-1'}
        s3.get_object.return_value = {'Body': object_body}
        s3.generate_presigned_url.return_value = 'http://localhost:4566/signed'
        factory_mock.return_value.client.return_value = s3
        redeem_mock.return_value = b'Temporary access with an S3 presigned URL.\n'

        from .labs import lab_status

        status = lab_status('s3', 'presigned-url')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['create-bucket']['verified'])
        self.assertTrue(status['steps']['put-object']['verified'])
        self.assertTrue(status['steps']['presign-object']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_presigned_lab_reset_deletes_guide_and_bucket(self, factory_mock):
        s3 = MagicMock()
        version_paginator = MagicMock()
        object_paginator = MagicMock()
        version_paginator.paginate.return_value = []
        object_paginator.paginate.return_value = [{
            'Contents': [{'Key': 'shared/guide.txt'}],
        }]
        s3.get_paginator.side_effect = [version_paginator, object_paginator]
        factory_mock.return_value.client.return_value = s3

        result = reset_lab('s3', 'presigned-url')

        s3.delete_objects.assert_called_once_with(
            Bucket='floci-lab-presigned',
            Delete={
                'Objects': [{'Key': 'shared/guide.txt'}],
                'Quiet': True,
            },
        )
        s3.delete_bucket.assert_called_once_with(Bucket='floci-lab-presigned')
        self.assertTrue(result['deleted_bucket'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_security_lab_enables_all_public_access_blocks(self, factory_mock):
        s3 = MagicMock()
        configuration = {
            'BlockPublicAcls': True,
            'IgnorePublicAcls': True,
            'BlockPublicPolicy': True,
            'RestrictPublicBuckets': True,
        }
        s3.put_public_access_block.return_value = {}
        s3.get_public_access_block.return_value = {
            'PublicAccessBlockConfiguration': configuration,
        }
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'bucket-security', 'put-public-access-block')

        s3.put_public_access_block.assert_called_once_with(
            Bucket='floci-lab-security',
            PublicAccessBlockConfiguration=configuration,
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_security_lab_applies_least_privilege_policy(self, factory_mock):
        s3 = MagicMock()
        policy = {
            'Version': '2012-10-17',
            'Statement': [{
                'Sid': 'AllowLocalAccountList',
                'Effect': 'Allow',
                'Principal': {'AWS': 'arn:aws:iam::000000000000:root'},
                'Action': 's3:ListBucket',
                'Resource': 'arn:aws:s3:::floci-lab-security',
            }],
        }
        s3.put_bucket_policy.return_value = {}
        s3.get_bucket_policy.return_value = {'Policy': json.dumps(policy)}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'bucket-security', 'put-bucket-policy')

        s3.put_bucket_policy.assert_called_once()
        kwargs = s3.put_bucket_policy.call_args.kwargs
        self.assertEqual(kwargs['Bucket'], 'floci-lab-security')
        self.assertEqual(json.loads(kwargs['Policy']), policy)
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_security_lab_status_tracks_blocks_and_policy_separately(self, factory_mock):
        s3 = MagicMock()
        s3.head_bucket.return_value = {'BucketRegion': 'us-east-1'}
        s3.get_public_access_block.return_value = {
            'PublicAccessBlockConfiguration': {
                'BlockPublicAcls': True,
                'IgnorePublicAcls': True,
                'BlockPublicPolicy': True,
                'RestrictPublicBuckets': True,
            },
        }
        s3.get_bucket_policy.return_value = {
            'Policy': json.dumps({
                'Version': '2012-10-17',
                'Statement': [{
                    'Sid': 'AllowLocalAccountList',
                    'Effect': 'Allow',
                    'Principal': {'AWS': 'arn:aws:iam::000000000000:root'},
                    'Action': 's3:ListBucket',
                    'Resource': 'arn:aws:s3:::floci-lab-security',
                }],
            }),
        }
        factory_mock.return_value.client.return_value = s3

        from .labs import lab_status

        status = lab_status('s3', 'bucket-security')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['put-public-access-block']['verified'])
        self.assertTrue(status['steps']['get-public-access-block']['verified'])
        self.assertTrue(status['steps']['put-bucket-policy']['verified'])
        self.assertTrue(status['steps']['get-bucket-policy']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_security_lab_reset_removes_configuration_then_bucket(self, factory_mock):
        s3 = MagicMock()
        version_paginator = MagicMock()
        object_paginator = MagicMock()
        version_paginator.paginate.return_value = []
        object_paginator.paginate.return_value = []
        s3.get_paginator.side_effect = [version_paginator, object_paginator]
        factory_mock.return_value.client.return_value = s3

        result = reset_lab('s3', 'bucket-security')

        s3.delete_bucket_policy.assert_called_once_with(Bucket='floci-lab-security')
        s3.delete_public_access_block.assert_called_once_with(Bucket='floci-lab-security')
        s3.delete_bucket.assert_called_once_with(Bucket='floci-lab-security')
        self.assertTrue(result['deleted_bucket'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_encryption_lab_configures_aes256_default(self, factory_mock):
        s3 = MagicMock()
        configuration = {
            'Rules': [{
                'ApplyServerSideEncryptionByDefault': {'SSEAlgorithm': 'AES256'},
                'BucketKeyEnabled': False,
            }],
        }
        s3.put_bucket_encryption.return_value = {}
        s3.get_bucket_encryption.return_value = {
            'ServerSideEncryptionConfiguration': configuration,
        }
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'default-encryption', 'put-bucket-encryption')

        s3.put_bucket_encryption.assert_called_once_with(
            Bucket='floci-lab-encryption',
            ServerSideEncryptionConfiguration=configuration,
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_encryption_lab_uploads_record_after_default_enabled(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = b'Protected by the bucket encryption default.\n'
        s3.put_object.return_value = {'ETag': '"record"'}
        s3.get_bucket_encryption.return_value = {
            'ServerSideEncryptionConfiguration': {
                'Rules': [{
                    'ApplyServerSideEncryptionByDefault': {'SSEAlgorithm': 'AES256'},
                    'BucketKeyEnabled': False,
                }],
            },
        }
        s3.head_object.return_value = {
            'ContentType': 'text/plain',
            'ContentLength': 44,
        }
        s3.get_object.return_value = {'Body': body}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'default-encryption', 'put-object')

        s3.put_object.assert_called_once_with(
            Bucket='floci-lab-encryption',
            Key='protected/record.txt',
            Body=b'Protected by the bucket encryption default.\n',
            ContentType='text/plain',
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_encryption_lab_status_requires_config_and_object(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = b'Protected by the bucket encryption default.\n'
        s3.head_bucket.return_value = {'BucketRegion': 'us-east-1'}
        s3.get_bucket_encryption.return_value = {
            'ServerSideEncryptionConfiguration': {
                'Rules': [{
                    'ApplyServerSideEncryptionByDefault': {'SSEAlgorithm': 'AES256'},
                    'BucketKeyEnabled': False,
                }],
            },
        }
        s3.head_object.return_value = {
            'ContentType': 'text/plain',
            'ContentLength': 44,
        }
        s3.get_object.return_value = {'Body': body}
        factory_mock.return_value.client.return_value = s3

        from .labs import lab_status

        status = lab_status('s3', 'default-encryption')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['put-bucket-encryption']['verified'])
        self.assertTrue(status['steps']['get-bucket-encryption']['verified'])
        self.assertTrue(status['steps']['put-object']['verified'])
        self.assertTrue(status['steps']['head-object']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_encryption_lab_reset_removes_encryption_then_bucket(self, factory_mock):
        s3 = MagicMock()
        version_paginator = MagicMock()
        object_paginator = MagicMock()
        version_paginator.paginate.return_value = []
        object_paginator.paginate.return_value = [{
            'Contents': [{'Key': 'protected/record.txt'}],
        }]
        s3.get_paginator.side_effect = [version_paginator, object_paginator]
        factory_mock.return_value.client.return_value = s3

        result = reset_lab('s3', 'default-encryption')

        s3.delete_bucket_encryption.assert_called_once_with(Bucket='floci-lab-encryption')
        s3.delete_objects.assert_called_once()
        s3.delete_bucket.assert_called_once_with(Bucket='floci-lab-encryption')
        self.assertTrue(result['deleted_bucket'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_lifecycle_lab_uploads_log_under_target_prefix(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = b'2026-06-18T12:00:00Z INFO Floci lifecycle lab started\n'
        s3.put_object.return_value = {'ETag': '"log"'}
        s3.head_object.return_value = {
            'ContentType': 'text/plain',
            'ContentLength': 54,
        }
        s3.get_object.return_value = {'Body': body}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'lifecycle-retention', 'put-object')

        s3.put_object.assert_called_once_with(
            Bucket='floci-lab-lifecycle',
            Key='logs/app.log',
            Body=b'2026-06-18T12:00:00Z INFO Floci lifecycle lab started\n',
            ContentType='text/plain',
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_lifecycle_lab_configures_30_day_logs_expiration(self, factory_mock):
        s3 = MagicMock()
        configuration = {
            'Rules': [{
                'ID': 'ExpireApplicationLogsAfter30Days',
                'Status': 'Enabled',
                'Filter': {'Prefix': 'logs/'},
                'Expiration': {'Days': 30},
            }],
        }
        s3.put_bucket_lifecycle_configuration.return_value = {}
        s3.get_bucket_lifecycle_configuration.return_value = configuration
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step(
            's3',
            'lifecycle-retention',
            'put-lifecycle-configuration',
        )

        s3.put_bucket_lifecycle_configuration.assert_called_once_with(
            Bucket='floci-lab-lifecycle',
            LifecycleConfiguration=configuration,
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_lifecycle_lab_status_requires_log_and_rule(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = b'2026-06-18T12:00:00Z INFO Floci lifecycle lab started\n'
        s3.head_bucket.return_value = {'BucketRegion': 'us-east-1'}
        s3.head_object.return_value = {
            'ContentType': 'text/plain',
            'ContentLength': 54,
        }
        s3.get_object.return_value = {'Body': body}
        s3.get_bucket_lifecycle_configuration.return_value = {
            'Rules': [{
                'ID': 'ExpireApplicationLogsAfter30Days',
                'Status': 'Enabled',
                'Filter': {'Prefix': 'logs/'},
                'Expiration': {'Days': 30},
            }],
        }
        factory_mock.return_value.client.return_value = s3

        from .labs import lab_status

        status = lab_status('s3', 'lifecycle-retention')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['create-bucket']['verified'])
        self.assertTrue(status['steps']['put-object']['verified'])
        self.assertTrue(status['steps']['put-lifecycle-configuration']['verified'])
        self.assertTrue(status['steps']['get-lifecycle-configuration']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_lifecycle_lab_reset_removes_rule_then_bucket(self, factory_mock):
        s3 = MagicMock()
        version_paginator = MagicMock()
        object_paginator = MagicMock()
        version_paginator.paginate.return_value = []
        object_paginator.paginate.return_value = [{
            'Contents': [{'Key': 'logs/app.log'}],
        }]
        s3.get_paginator.side_effect = [version_paginator, object_paginator]
        factory_mock.return_value.client.return_value = s3

        result = reset_lab('s3', 'lifecycle-retention')

        s3.delete_bucket_lifecycle.assert_called_once_with(Bucket='floci-lab-lifecycle')
        s3.delete_objects.assert_called_once()
        s3.delete_bucket.assert_called_once_with(Bucket='floci-lab-lifecycle')
        self.assertTrue(result['deleted_bucket'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_cors_lab_configures_local_web_app_read_access(self, factory_mock):
        s3 = MagicMock()
        configuration = {
            'CORSRules': [{
                'ID': 'AllowLocalWebAppRead',
                'AllowedOrigins': ['http://localhost:3000'],
                'AllowedMethods': ['GET', 'HEAD'],
                'AllowedHeaders': ['Authorization'],
                'ExposeHeaders': ['ETag'],
                'MaxAgeSeconds': 3600,
            }],
        }
        s3.put_bucket_cors.return_value = {}
        s3.get_bucket_cors.return_value = configuration
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'bucket-cors', 'put-bucket-cors')

        s3.put_bucket_cors.assert_called_once_with(
            Bucket='floci-lab-cors',
            CORSConfiguration=configuration,
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_cors_lab_get_returns_and_verifies_rule(self, factory_mock):
        s3 = MagicMock()
        configuration = {
            'CORSRules': [{
                'ID': 'AllowLocalWebAppRead',
                'AllowedOrigins': ['http://localhost:3000'],
                'AllowedMethods': ['GET', 'HEAD'],
                'AllowedHeaders': ['Authorization'],
                'ExposeHeaders': ['ETag'],
                'MaxAgeSeconds': 3600,
            }],
        }
        s3.get_bucket_cors.return_value = configuration
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'bucket-cors', 'get-bucket-cors')

        self.assertTrue(result['verified'])
        self.assertIn('http://localhost:3000', result['stdout'])
        self.assertIn('ETag', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_cors_lab_status_requires_bucket_and_exact_rule(self, factory_mock):
        s3 = MagicMock()
        s3.head_bucket.return_value = {'BucketRegion': 'us-east-1'}
        s3.get_bucket_cors.return_value = {
            'CORSRules': [{
                'ID': 'AllowLocalWebAppRead',
                'AllowedOrigins': ['http://localhost:3000'],
                'AllowedMethods': ['GET', 'HEAD'],
                'AllowedHeaders': ['Authorization'],
                'ExposeHeaders': ['ETag'],
                'MaxAgeSeconds': 3600,
            }],
        }
        factory_mock.return_value.client.return_value = s3

        from .labs import lab_status

        status = lab_status('s3', 'bucket-cors')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['create-bucket']['verified'])
        self.assertTrue(status['steps']['put-bucket-cors']['verified'])
        self.assertTrue(status['steps']['get-bucket-cors']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_cors_lab_reset_removes_rule_then_bucket(self, factory_mock):
        s3 = MagicMock()
        version_paginator = MagicMock()
        object_paginator = MagicMock()
        version_paginator.paginate.return_value = []
        object_paginator.paginate.return_value = []
        s3.get_paginator.side_effect = [version_paginator, object_paginator]
        factory_mock.return_value.client.return_value = s3

        result = reset_lab('s3', 'bucket-cors')

        s3.delete_bucket_cors.assert_called_once_with(Bucket='floci-lab-cors')
        s3.delete_bucket.assert_called_once_with(Bucket='floci-lab-cors')
        self.assertTrue(result['deleted_bucket'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_notifications_lab_sets_queue_policy(self, factory_mock):
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-s3-events'
        policy = {
            'Version': '2012-10-17',
            'Statement': [{
                'Sid': 'AllowS3ObjectCreatedEvents',
                'Effect': 'Allow',
                'Principal': {'Service': 's3.amazonaws.com'},
                'Action': 'sqs:SendMessage',
                'Resource': 'arn:aws:sqs:us-east-1:000000000000:floci-lab-s3-events',
                'Condition': {
                    'ArnEquals': {
                        'aws:SourceArn': 'arn:aws:s3:::floci-lab-notifications',
                    },
                    'StringEquals': {'aws:SourceAccount': '000000000000'},
                },
            }],
        }
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.set_queue_attributes.return_value = {}
        sqs.get_queue_attributes.return_value = {
            'Attributes': {'Policy': json.dumps(policy)},
        }
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            's3',
            'object-notifications-sqs',
            'set-queue-policy',
        )

        sqs.set_queue_attributes.assert_called_once_with(
            QueueUrl=queue_url,
            Attributes={'Policy': json.dumps(policy)},
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_notifications_lab_configures_queue_destination(self, factory_mock):
        s3 = MagicMock()
        configuration = {
            'QueueConfigurations': [{
                'Id': 'SendObjectCreatedToSqs',
                'QueueArn': 'arn:aws:sqs:us-east-1:000000000000:floci-lab-s3-events',
                'Events': ['s3:ObjectCreated:*'],
            }],
        }
        s3.put_bucket_notification_configuration.return_value = {}
        s3.get_bucket_notification_configuration.return_value = configuration
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step(
            's3',
            'object-notifications-sqs',
            'put-notification-configuration',
        )

        s3.put_bucket_notification_configuration.assert_called_once_with(
            Bucket='floci-lab-notifications',
            NotificationConfiguration=configuration,
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_notifications_lab_uploads_report(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = b'Floci S3 notification delivery report\n'
        s3.put_object.return_value = {'ETag': '"report"'}
        s3.head_object.return_value = {
            'ContentType': 'text/plain',
            'ContentLength': 38,
        }
        s3.get_object.return_value = {'Body': body}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step(
            's3',
            'object-notifications-sqs',
            'put-object',
        )

        s3.put_object.assert_called_once_with(
            Bucket='floci-lab-notifications',
            Key='uploads/report.txt',
            Body=b'Floci S3 notification delivery report\n',
            ContentType='text/plain',
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_notifications_lab_receives_matching_s3_event(self, factory_mock):
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-s3-events'
        event = {
            'Records': [{
                'eventSource': 'aws:s3',
                'eventName': 'ObjectCreated:Put',
                's3': {
                    'bucket': {'name': 'floci-lab-notifications'},
                    'object': {'key': 'uploads/report.txt', 'size': 38},
                },
            }],
        }
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {
            'Messages': [{
                'MessageId': 'message-1',
                'Body': json.dumps(event),
            }],
        }
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            's3',
            'object-notifications-sqs',
            'receive-event',
        )

        sqs.receive_message.assert_called_once_with(
            QueueUrl=queue_url,
            MaxNumberOfMessages=10,
            VisibilityTimeout=0,
            WaitTimeSeconds=1,
        )
        self.assertTrue(result['verified'])
        self.assertIn('ObjectCreated:Put', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_notifications_lab_status_requires_delivered_event(self, factory_mock):
        s3 = MagicMock()
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-s3-events'
        queue_arn = 'arn:aws:sqs:us-east-1:000000000000:floci-lab-s3-events'
        policy = {
            'Version': '2012-10-17',
            'Statement': [{
                'Sid': 'AllowS3ObjectCreatedEvents',
                'Effect': 'Allow',
                'Principal': {'Service': 's3.amazonaws.com'},
                'Action': 'sqs:SendMessage',
                'Resource': queue_arn,
                'Condition': {
                    'ArnEquals': {
                        'aws:SourceArn': 'arn:aws:s3:::floci-lab-notifications',
                    },
                    'StringEquals': {'aws:SourceAccount': '000000000000'},
                },
            }],
        }
        body = MagicMock()
        body.read.return_value = b'Floci S3 notification delivery report\n'
        event = {
            'Records': [{
                'eventSource': 'aws:s3',
                'eventName': 'ObjectCreated:Put',
                's3': {
                    'bucket': {'name': 'floci-lab-notifications'},
                    'object': {'key': 'uploads/report.txt', 'size': 38},
                },
            }],
        }
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.get_queue_attributes.side_effect = [
            {'Attributes': {'QueueArn': queue_arn}},
            {'Attributes': {'Policy': json.dumps(policy)}},
        ]
        sqs.receive_message.return_value = {
            'Messages': [{'MessageId': 'message-1', 'Body': json.dumps(event)}],
        }
        s3.head_bucket.return_value = {'BucketRegion': 'us-east-1'}
        s3.get_bucket_notification_configuration.return_value = {
            'QueueConfigurations': [{
                'Id': 'SendObjectCreatedToSqs',
                'QueueArn': queue_arn,
                'Events': ['s3:ObjectCreated:*'],
            }],
        }
        s3.head_object.return_value = {
            'ContentType': 'text/plain',
            'ContentLength': 38,
        }
        s3.get_object.return_value = {'Body': body}
        factory_mock.return_value.client.side_effect = (
            lambda service: sqs if service == 'sqs' else s3
        )

        from .labs import lab_status

        status = lab_status('s3', 'object-notifications-sqs')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['set-queue-policy']['verified'])
        self.assertTrue(status['steps']['put-notification-configuration']['verified'])
        self.assertTrue(status['steps']['receive-event']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_notifications_lab_reset_removes_bucket_then_queue(self, factory_mock):
        s3 = MagicMock()
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-s3-events'
        version_paginator = MagicMock()
        object_paginator = MagicMock()
        version_paginator.paginate.return_value = []
        object_paginator.paginate.return_value = [{
            'Contents': [{'Key': 'uploads/report.txt'}],
        }]
        s3.get_paginator.side_effect = [version_paginator, object_paginator]
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        factory_mock.return_value.client.side_effect = (
            lambda service: sqs if service == 'sqs' else s3
        )

        result = reset_lab('s3', 'object-notifications-sqs')

        s3.put_bucket_notification_configuration.assert_called_once_with(
            Bucket='floci-lab-notifications',
            NotificationConfiguration={},
        )
        s3.delete_bucket.assert_called_once_with(Bucket='floci-lab-notifications')
        sqs.delete_queue.assert_called_once_with(QueueUrl=queue_url)
        self.assertTrue(result['deleted_bucket'])
        self.assertTrue(result['deleted_queue'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_multipart_lab_initiates_upload(self, factory_mock):
        s3 = MagicMock()
        active_upload = {
            'Key': 'archives/application.bin',
            'UploadId': 'upload-1',
        }
        s3.list_multipart_uploads.side_effect = [
            {'Uploads': []},
            {'Uploads': [active_upload]},
        ]
        s3.create_multipart_upload.return_value = {
            'Bucket': 'floci-lab-multipart',
            'Key': 'archives/application.bin',
            'UploadId': 'upload-1',
        }
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step(
            's3',
            'multipart-upload',
            'create-multipart-upload',
        )

        s3.create_multipart_upload.assert_called_once_with(
            Bucket='floci-lab-multipart',
            Key='archives/application.bin',
            ContentType='application/octet-stream',
        )
        self.assertTrue(result['verified'])
        self.assertIn('upload-1', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_multipart_lab_uploads_minimum_sized_first_part(self, factory_mock):
        s3 = MagicMock()
        active_upload = {
            'Key': 'archives/application.bin',
            'UploadId': 'upload-1',
        }
        s3.list_multipart_uploads.return_value = {'Uploads': [active_upload]}
        s3.upload_part.return_value = {'ETag': '"part-one"'}
        s3.list_parts.return_value = {
            'Parts': [{
                'PartNumber': 1,
                'ETag': '"part-one"',
                'Size': 5 * 1024 * 1024,
            }],
        }
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step(
            's3',
            'multipart-upload',
            'upload-part-one',
        )

        call = s3.upload_part.call_args.kwargs
        self.assertEqual(call['Bucket'], 'floci-lab-multipart')
        self.assertEqual(call['Key'], 'archives/application.bin')
        self.assertEqual(call['PartNumber'], 1)
        self.assertEqual(call['UploadId'], 'upload-1')
        self.assertEqual(len(call['Body']), 5 * 1024 * 1024)
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_multipart_lab_lists_both_parts(self, factory_mock):
        s3 = MagicMock()
        active_upload = {
            'Key': 'archives/application.bin',
            'UploadId': 'upload-1',
        }
        parts = [
            {'PartNumber': 1, 'ETag': '"part-one"', 'Size': 5 * 1024 * 1024},
            {'PartNumber': 2, 'ETag': '"part-two"', 'Size': 1024},
        ]
        s3.list_multipart_uploads.return_value = {'Uploads': [active_upload]}
        s3.list_parts.return_value = {'Parts': parts}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step('s3', 'multipart-upload', 'list-parts')

        self.assertTrue(result['verified'])
        self.assertIn('"PartNumber": 1', result['stdout'])
        self.assertIn('"PartNumber": 2', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_multipart_lab_completes_with_discovered_etags(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = (
            b'A' * (5 * 1024 * 1024)
            + b'B' * 1024
        )
        active_upload = {
            'Key': 'archives/application.bin',
            'UploadId': 'upload-1',
        }
        parts = [
            {'PartNumber': 2, 'ETag': '"part-two"', 'Size': 1024},
            {'PartNumber': 1, 'ETag': '"part-one"', 'Size': 5 * 1024 * 1024},
        ]
        s3.list_multipart_uploads.return_value = {'Uploads': [active_upload]}
        s3.list_parts.return_value = {'Parts': parts}
        s3.complete_multipart_upload.return_value = {'ETag': '"complete-2"'}
        s3.head_object.return_value = {
            'ContentType': 'application/octet-stream',
            'ContentLength': 5 * 1024 * 1024 + 1024,
            'ETag': '"complete-2"',
        }
        s3.get_object.return_value = {'Body': body}
        factory_mock.return_value.client.return_value = s3

        result = run_lab_step(
            's3',
            'multipart-upload',
            'complete-multipart-upload',
        )

        s3.complete_multipart_upload.assert_called_once_with(
            Bucket='floci-lab-multipart',
            Key='archives/application.bin',
            UploadId='upload-1',
            MultipartUpload={
                'Parts': [
                    {'ETag': '"part-one"', 'PartNumber': 1},
                    {'ETag': '"part-two"', 'PartNumber': 2},
                ],
            },
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_multipart_lab_status_recomputes_from_completed_object(self, factory_mock):
        s3 = MagicMock()
        body = MagicMock()
        body.read.return_value = (
            b'A' * (5 * 1024 * 1024)
            + b'B' * 1024
        )
        s3.head_bucket.return_value = {'BucketRegion': 'us-east-1'}
        s3.head_object.return_value = {
            'ContentType': 'application/octet-stream',
            'ContentLength': 5 * 1024 * 1024 + 1024,
            'ETag': '"complete-2"',
        }
        s3.get_object.return_value = {'Body': body}
        factory_mock.return_value.client.return_value = s3

        from .labs import lab_status

        status = lab_status('s3', 'multipart-upload')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['create-multipart-upload']['verified'])
        self.assertTrue(status['steps']['upload-part-one']['verified'])
        self.assertTrue(status['steps']['upload-part-two']['verified'])
        self.assertTrue(status['steps']['complete-multipart-upload']['verified'])
        self.assertTrue(status['steps']['get-object']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_s3_multipart_lab_reset_aborts_uploads_then_deletes_bucket(self, factory_mock):
        s3 = MagicMock()
        multipart_paginator = MagicMock()
        version_paginator = MagicMock()
        object_paginator = MagicMock()
        multipart_paginator.paginate.return_value = [{
            'Uploads': [{
                'Key': 'archives/application.bin',
                'UploadId': 'upload-1',
            }],
        }]
        version_paginator.paginate.return_value = []
        object_paginator.paginate.return_value = [{
            'Contents': [{'Key': 'archives/application.bin'}],
        }]
        s3.get_paginator.side_effect = [
            multipart_paginator,
            version_paginator,
            object_paginator,
        ]
        factory_mock.return_value.client.return_value = s3

        result = reset_lab('s3', 'multipart-upload')

        s3.abort_multipart_upload.assert_called_once_with(
            Bucket='floci-lab-multipart',
            Key='archives/application.bin',
            UploadId='upload-1',
        )
        s3.delete_bucket.assert_called_once_with(Bucket='floci-lab-multipart')
        self.assertEqual(result['aborted_uploads'], 1)
        self.assertTrue(result['deleted_bucket'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_run_iam_create_user_step_creates_and_verifies_alice(self, factory_mock):
        iam = MagicMock()
        iam.create_user.return_value = {'User': {'UserName': 'Alice', 'Arn': 'arn:aws:iam::000000000000:user/Alice'}}
        iam.get_user.return_value = {'User': {'UserName': 'Alice', 'Arn': 'arn:aws:iam::000000000000:user/Alice'}}
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'create-user-alice', 'create-user')

        iam.create_user.assert_called_once_with(UserName='Alice')
        iam.get_user.assert_called_once_with(UserName='Alice')
        self.assertEqual(result['command'], 'aws iam create-user --user-name Alice')
        self.assertEqual(result['exit_code'], 0)
        self.assertTrue(result['verified'])
        self.assertIn('"UserName": "Alice"', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_run_iam_create_user_step_treats_existing_alice_as_verified(self, factory_mock):
        iam = MagicMock()
        iam.create_user.side_effect = ClientError(
            {'Error': {'Code': 'EntityAlreadyExists', 'Message': 'User already exists'}},
            'CreateUser',
        )
        iam.get_user.return_value = {'User': {'UserName': 'Alice', 'Arn': 'arn:aws:iam::000000000000:user/Alice'}}
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step('iam', 'group-membership-alice', 'create-user')

        iam.create_user.assert_called_once_with(UserName='Alice')
        iam.get_user.assert_called_with(UserName='Alice')
        self.assertTrue(result['verified'])
        self.assertEqual(result['lab'], 'group-membership-alice')

    @patch('dashboard.views.reset_lab')
    def test_reset_lab_endpoint_returns_reset_payload(self, reset_mock):
        reset_mock.return_value = {
            'service': 'iam',
            'lab': 'create-user-alice',
            'command': 'aws iam delete-user --user-name Alice',
            'exit_code': 0,
            'stdout': '{}',
            'stderr': '',
            'reset': True,
            'deleted': True,
            'verification': {'status': 'passed', 'message': 'User Alice was removed.'},
        }

        response = self.client.post(reverse('dashboard:lab-reset', kwargs={
            'service_key': 'iam',
            'lab_key': 'create-user-alice',
        }))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['reset'])
        reset_mock.assert_called_once_with('iam', 'create-user-alice')

    @patch('dashboard.views.run_lab_step')
    def test_run_lab_step_endpoint_returns_runner_payload(self, run_mock):
        run_mock.return_value = {
            'service': 'iam',
            'lab': 'create-user-alice',
            'step': 'create-user',
            'command': 'aws iam create-user --user-name Alice',
            'exit_code': 0,
            'stdout': '{}',
            'stderr': '',
            'verified': True,
            'verification': {'status': 'passed', 'message': 'User Alice exists in local IAM.'},
        }

        response = self.client.post(reverse('dashboard:lab-step-run', kwargs={
            'service_key': 'iam',
            'lab_key': 'create-user-alice',
            'step_key': 'create-user',
        }))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['verified'])
        run_mock.assert_called_once_with('iam', 'create-user-alice', 'create-user')
