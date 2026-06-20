import json
from contextlib import ExitStack
from unittest.mock import MagicMock, patch

from botocore.exceptions import ClientError
from django.core.cache import cache
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

    @patch('dashboard.views.lab_status')
    def test_sqs_labs_page_renders_create_queue_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'sqs'}),
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<title>SQS Labs - Floci Dashboard</title>', html=True)
        self.assertContains(response, 'aria-label="Breadcrumb"')
        self.assertContains(response, f'href="{reverse("dashboard:index")}"')
        self.assertContains(response, f'href="{reverse("dashboard:service-page", kwargs={"service_key": "sqs"})}"')
        self.assertContains(response, 'Create and inspect an SQS queue')
        self.assertContains(response, 'aws sqs create-queue --queue-name floci-lab-basics')
        self.assertContains(response, 'aws sqs get-queue-url --queue-name floci-lab-basics')
        self.assertContains(response, 'aws sqs get-queue-attributes --queue-url &lt;queue-url&gt; --attribute-names All')
        self.assertContains(response, 'aws sqs list-queues')

    @patch('dashboard.views.lab_status')
    def test_sqs_labs_page_renders_message_lifecycle_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'sqs'}),
            {'lab': 'message-lifecycle'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Send, receive, and delete an SQS message')
        self.assertContains(response, 'aws sqs create-queue --queue-name floci-lab-basics')
        self.assertContains(response, 'aws sqs send-message --queue-url &lt;queue-url&gt;')
        self.assertContains(response, 'aws sqs receive-message --queue-url &lt;queue-url&gt;')
        self.assertContains(response, 'aws sqs delete-message --queue-url &lt;queue-url&gt;')
        self.assertContains(response, 'message.json')
        self.assertContains(response, 'message-attributes.json')
        self.assertContains(response, 'order.created')
        self.assertContains(response, 'message-lifecycle')

    @patch('dashboard.views.lab_status')
    def test_sqs_labs_page_renders_visibility_timeout_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'sqs'}),
            {'lab': 'visibility-timeout'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Understand SQS visibility timeout')
        self.assertContains(response, 'aws sqs send-message --queue-url &lt;queue-url&gt;')
        self.assertContains(response, '--visibility-timeout 30')
        self.assertContains(response, 'aws sqs change-message-visibility --queue-url &lt;queue-url&gt;')
        self.assertContains(response, '--visibility-timeout 60')
        self.assertContains(response, '--visibility-timeout 2')
        self.assertContains(response, '--wait-time-seconds 0')
        self.assertContains(response, '--wait-time-seconds 3')
        self.assertContains(response, 'job.ready')
        self.assertContains(response, 'visibility-timeout')

    @patch('dashboard.views.lab_status')
    def test_sqs_labs_page_renders_delayed_message_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'sqs'}),
            {'lab': 'delayed-message'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Work with delayed SQS messages')
        self.assertContains(response, 'aws sqs send-message --queue-url &lt;queue-url&gt;')
        self.assertContains(response, '--delay-seconds 10')
        self.assertContains(response, 'ApproximateNumberOfMessagesDelayed')
        self.assertContains(response, '--wait-time-seconds 12')
        self.assertContains(response, 'report.generate')
        self.assertContains(response, 'delayed-message')

    @patch('dashboard.views.lab_status')
    def test_sqs_labs_page_renders_batch_messages_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'sqs'}),
            {'lab': 'batch-messages'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Send and delete SQS messages in batches')
        self.assertContains(response, 'aws sqs send-message-batch --queue-url &lt;queue-url&gt;')
        self.assertContains(response, 'aws sqs receive-message --queue-url &lt;queue-url&gt;')
        self.assertContains(response, 'aws sqs delete-message-batch --queue-url &lt;queue-url&gt;')
        self.assertContains(response, 'send-batch.json')
        self.assertContains(response, 'delete-batch.json')
        self.assertContains(response, 'FLOCI-TASK-1')
        self.assertContains(response, 'FLOCI-TASK-3')

    @patch('dashboard.views.lab_status')
    def test_sqs_labs_page_renders_queue_configuration_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'sqs'}),
            {'lab': 'queue-configuration'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Configure SQS queue attributes and tags')
        self.assertContains(response, 'aws sqs set-queue-attributes --queue-url &lt;queue-url&gt;')
        self.assertContains(response, 'aws sqs get-queue-attributes --queue-url &lt;queue-url&gt;')
        self.assertContains(response, 'aws sqs tag-queue --queue-url &lt;queue-url&gt;')
        self.assertContains(response, 'aws sqs list-queue-tags --queue-url &lt;queue-url&gt;')
        self.assertContains(response, '&quot;VisibilityTimeout&quot;: &quot;45&quot;')
        self.assertContains(response, '&quot;MessageRetentionPeriod&quot;: &quot;86400&quot;')
        self.assertContains(response, 'Environment=lab')
        self.assertContains(response, 'Purpose=training')

    @patch('dashboard.views.lab_status')
    def test_sqs_labs_page_renders_dead_letter_redrive_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'sqs'}),
            {'lab': 'dead-letter-redrive'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Route failed messages to a dead-letter queue')
        self.assertContains(response, 'aws sqs create-queue --queue-name floci-lab-redrive-dlq')
        self.assertContains(response, 'aws sqs create-queue --queue-name floci-lab-redrive-source')
        self.assertContains(response, 'aws sqs set-queue-attributes --queue-url &lt;source-queue-url&gt;')
        self.assertContains(response, 'aws sqs start-message-move-task')
        self.assertContains(response, 'aws sqs list-message-move-tasks')
        self.assertContains(response, 'payment.process')
        self.assertContains(response, 'maxReceiveCount')

    @patch('dashboard.views.lab_status')
    def test_sqs_labs_page_renders_fifo_ordering_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'sqs'}),
            {'lab': 'fifo-ordering'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Preserve ordering and deduplicate messages with SQS FIFO')
        self.assertContains(response, 'aws sqs create-queue --queue-name floci-lab-orders.fifo')
        self.assertContains(response, 'FifoQueue=true')
        self.assertContains(response, 'ContentBasedDeduplication=false')
        self.assertContains(response, '--message-group-id customer-FLOCI-1001')
        self.assertContains(response, '--message-deduplication-id FLOCI-ORDER-1001-1')
        self.assertContains(response, 'duplicate-created.json')
        self.assertContains(response, 'ApproximateNumberOfMessages')
        self.assertContains(response, 'order.status')

    @patch('dashboard.views.lab_status')
    def test_sqs_labs_page_renders_purge_delete_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'sqs'}),
            {'lab': 'purge-delete'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Purge messages and delete an SQS queue')
        self.assertContains(response, 'aws sqs create-queue --queue-name floci-lab-cleanup')
        self.assertContains(response, 'VisibilityTimeout=45')
        self.assertContains(response, 'Purpose=cleanup-training')
        self.assertContains(response, 'aws sqs send-message-batch')
        self.assertContains(response, 'aws sqs purge-queue')
        self.assertContains(response, 'aws sqs delete-queue')
        self.assertContains(response, 'FLOCI-CLEANUP-1')
        self.assertContains(response, 'FLOCI-CLEANUP-3')

    def test_sqs_service_page_links_to_labs(self):
        response = self.client.get(reverse('dashboard:service-page', kwargs={'service_key': 'sqs'}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, f'href="{reverse("dashboard:service-labs", kwargs={"service_key": "sqs"})}"')
        self.assertContains(response, '>Labs</a>')

    @patch('dashboard.views.lab_status')
    def test_sns_labs_page_renders_sqs_fanout_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'sns'}),
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<title>SNS Labs - Floci Dashboard</title>', html=True)
        self.assertContains(response, 'Fan out an SNS message to SQS queues')
        self.assertContains(response, 'aws sns create-topic --name floci-lab-order-events')
        self.assertContains(response, 'aws sqs create-queue --queue-name floci-lab-order-processing')
        self.assertContains(response, 'aws sqs create-queue --queue-name floci-lab-order-audit')
        self.assertContains(response, 'RawMessageDelivery=true')
        self.assertContains(response, 'aws sns publish')
        self.assertContains(response, 'order.created')
        self.assertContains(response, 'FLOCI-FANOUT-1001')

    @patch('dashboard.views.lab_status')
    def test_sns_labs_page_renders_filter_policies_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'sns'}),
            {'lab': 'filter-policies'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            'Route selected SNS messages with subscription filters',
        )
        self.assertContains(response, 'floci-lab-filtered-events')
        self.assertContains(response, 'floci-lab-created-events')
        self.assertContains(response, 'floci-lab-priority-events')
        self.assertContains(response, 'FilterPolicyScope')
        self.assertContains(response, 'MessageAttributes')
        self.assertContains(response, 'order.created')
        self.assertContains(response, 'order.cancelled')
        self.assertContains(response, 'Priority')

    def test_sns_service_page_links_to_labs(self):
        response = self.client.get(
            reverse('dashboard:service-page', kwargs={'service_key': 'sns'}),
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            f'href="{reverse("dashboard:service-labs", kwargs={"service_key": "sns"})}"',
        )
        self.assertContains(response, '>Labs</a>')

    @patch('dashboard.views.lab_status')
    def test_scheduler_labs_page_renders_sqs_delivery_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse(
                'dashboard:service-labs',
                kwargs={'service_key': 'scheduler'},
            ),
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            'Schedule an EventBridge Scheduler message to SQS',
        )
        self.assertContains(response, 'aws sqs create-queue --queue-name floci-lab-scheduled-reports')
        self.assertContains(response, 'aws iam create-role --role-name FlociSchedulerSqsRole')
        self.assertContains(response, 'scheduler.amazonaws.com')
        self.assertContains(response, 'sqs:SendMessage')
        self.assertContains(response, 'aws scheduler create-schedule-group')
        self.assertContains(response, 'ActionAfterCompletion')
        self.assertContains(response, 'report.ready')
        self.assertContains(response, 'FLOCI-SCHEDULE-1001')

    def test_scheduler_service_page_links_to_labs(self):
        response = self.client.get(
            reverse(
                'dashboard:service-page',
                kwargs={'service_key': 'scheduler'},
            ),
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            f'href="{reverse("dashboard:service-labs", kwargs={"service_key": "scheduler"})}"',
        )

    @patch('dashboard.views.lab_status')
    def test_cloudformation_labs_page_renders_s3_sqs_stack_lab(
        self,
        status_mock,
    ):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse(
                'dashboard:service-labs',
                kwargs={'service_key': 'cloudformation'},
            ),
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            'Provision S3 and SQS resources with CloudFormation',
        )
        self.assertContains(response, 'aws cloudformation validate-template')
        self.assertContains(response, 'aws cloudformation create-stack')
        self.assertContains(response, 'AWS::S3::Bucket')
        self.assertContains(response, 'AWS::SQS::Queue')
        self.assertContains(response, 'floci-lab-cfn-storage')
        self.assertContains(response, 'floci-lab-cfn-jobs')
        self.assertContains(response, 'describe-stack-events')
        self.assertContains(response, 'delete-stack')

    def test_cloudformation_service_page_links_to_labs(self):
        response = self.client.get(
            reverse(
                'dashboard:service-page',
                kwargs={'service_key': 'cloudformation'},
            ),
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            f'href="{reverse("dashboard:service-labs", kwargs={"service_key": "cloudformation"})}"',
        )

    @patch('dashboard.views.lab_status')
    def test_ec2_labs_page_renders_vpc_networking_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'ec2'}),
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Build a VPC with public and private subnets')
        self.assertContains(response, '10.42.0.0/16')
        self.assertContains(response, '10.42.1.0/24')
        self.assertContains(response, '10.42.2.0/24')
        self.assertContains(response, 'aws ec2 create-internet-gateway')
        self.assertContains(response, '0.0.0.0/0')
        self.assertContains(response, 'map-public-ip-on-launch')
        self.assertContains(response, 'associate-route-table')

    @patch('dashboard.views.lab_status')
    def test_ec2_labs_page_renders_security_controls_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'ec2'}),
            {'lab': 'security-controls'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            'Control VPC traffic with security groups and network ACLs',
        )
        self.assertContains(response, 'floci-lab-web-sg')
        self.assertContains(response, 'floci-lab-app-sg')
        self.assertContains(response, '203.0.113.0/24')
        self.assertContains(response, 'FromPort')
        self.assertContains(response, '8080')
        self.assertContains(response, 'describe-network-acls')
        self.assertContains(response, 'UnsupportedOperation')
        self.assertContains(response, 'network-acl-design.json')

    @patch('dashboard.views.lab_status')
    def test_ec2_labs_page_renders_s3_gateway_endpoint_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'ec2'}),
            {'lab': 's3-gateway-endpoint'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            'Connect a private VPC to S3 with a gateway endpoint',
        )
        self.assertContains(response, '10.44.0.0/16')
        self.assertContains(response, 'com.amazonaws.us-east-1.s3')
        self.assertContains(response, 'endpoint-policy.json')
        self.assertContains(response, 's3:ListBucket')
        self.assertContains(response, 'prefix-list route')

    @patch('dashboard.views.lab_status')
    def test_ec2_labs_page_renders_sqs_interface_endpoint_lab(self, status_mock):
        status_mock.return_value = {'complete': False, 'steps': {}}

        response = self.client.get(
            reverse('dashboard:service-labs', kwargs={'service_key': 'ec2'}),
            {'lab': 'sqs-interface-endpoint'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            'Connect a private subnet to SQS with an interface endpoint',
        )
        self.assertContains(response, '10.45.0.0/16')
        self.assertContains(response, 'com.amazonaws.us-east-1.sqs')
        self.assertContains(response, 'floci-lab-sqs-endpoint-sg')
        self.assertContains(response, 'private-dns-enabled')
        self.assertContains(response, 'describe-network-interfaces')
        self.assertContains(response, 'sqs:SendMessage')

    def test_ec2_service_page_links_to_labs(self):
        response = self.client.get(
            reverse('dashboard:service-page', kwargs={'service_key': 'ec2'}),
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            f'href="{reverse("dashboard:service-labs", kwargs={"service_key": "ec2"})}"',
        )

    def test_service_without_labs_returns_404(self):
        response = self.client.get(
            reverse(
                'dashboard:service-labs',
                kwargs={'service_key': 'lambda'},
            ),
        )

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

    def test_sqs_lab_registry_includes_create_queue_workflow(self):
        labs = labs_for_service('sqs')

        self.assertEqual(len(labs), 9)
        self.assertEqual(labs[0]['key'], 'create-queue')
        self.assertEqual(
            [step['key'] for step in labs[0]['steps']],
            ['create-queue', 'get-queue-url', 'get-queue-attributes', 'list-queues'],
        )
        self.assertEqual(labs[1]['key'], 'message-lifecycle')
        self.assertEqual(
            [step['key'] for step in labs[1]['steps']],
            ['create-queue', 'send-message', 'receive-message', 'delete-message'],
        )
        self.assertEqual(labs[2]['key'], 'visibility-timeout')
        self.assertEqual(
            [step['key'] for step in labs[2]['steps']],
            [
                'create-queue',
                'send-message',
                'receive-message',
                'extend-message-visibility',
                'verify-hidden',
                'shorten-message-visibility',
                'receive-after-timeout',
            ],
        )
        self.assertEqual(labs[3]['key'], 'delayed-message')
        self.assertEqual(
            [step['key'] for step in labs[3]['steps']],
            [
                'create-queue',
                'send-delayed-message',
                'get-queue-attributes',
                'receive-after-delay',
            ],
        )
        self.assertEqual(labs[4]['key'], 'batch-messages')
        self.assertEqual(
            [step['key'] for step in labs[4]['steps']],
            [
                'create-queue',
                'send-message-batch',
                'receive-message',
                'delete-message-batch',
            ],
        )
        self.assertEqual(labs[5]['key'], 'queue-configuration')
        self.assertEqual(
            [step['key'] for step in labs[5]['steps']],
            [
                'create-queue',
                'set-queue-attributes',
                'get-queue-attributes',
                'tag-queue',
                'list-queue-tags',
            ],
        )
        self.assertEqual(labs[6]['key'], 'dead-letter-redrive')
        self.assertEqual(
            [step['key'] for step in labs[6]['steps']],
            [
                'create-dlq',
                'create-source-queue',
                'set-redrive-policy',
                'get-redrive-policy',
                'send-message',
                'fail-message-once',
                'fail-message-twice',
                'trigger-dead-lettering',
                'inspect-dlq',
                'start-message-move-task',
                'list-message-move-tasks',
                'receive-redriven-message',
            ],
        )
        self.assertEqual(labs[7]['key'], 'fifo-ordering')
        self.assertEqual(
            [step['key'] for step in labs[7]['steps']],
            [
                'create-queue',
                'get-queue-attributes',
                'send-created',
                'send-duplicate',
                'send-paid',
                'send-fulfilled',
                'inspect-message-count',
                'receive-ordered-messages',
            ],
        )
        self.assertEqual(labs[8]['key'], 'purge-delete')
        self.assertEqual(
            [step['key'] for step in labs[8]['steps']],
            [
                'create-queue',
                'send-message-batch',
                'inspect-populated-queue',
                'purge-queue',
                'inspect-purged-queue',
                'delete-queue',
            ],
        )

    def test_sns_lab_registry_includes_sqs_fanout_workflow(self):
        labs = labs_for_service('sns')

        self.assertEqual(len(labs), 2)
        self.assertEqual(labs[0]['key'], 'sqs-fanout')
        self.assertEqual(
            [step['key'] for step in labs[0]['steps']],
            [
                'create-topic',
                'create-orders-queue',
                'create-audit-queue',
                'set-orders-queue-policy',
                'set-audit-queue-policy',
                'subscribe-orders-queue',
                'subscribe-audit-queue',
                'list-subscriptions',
                'publish-message',
                'receive-orders-copy',
                'receive-audit-copy',
            ],
        )
        self.assertEqual(labs[1]['key'], 'filter-policies')
        self.assertEqual(
            [step['key'] for step in labs[1]['steps']],
            [
                'create-topic',
                'create-created-queue',
                'create-priority-queue',
                'set-created-queue-policy',
                'set-priority-queue-policy',
                'subscribe-created-filter',
                'subscribe-priority-filter',
                'inspect-filter-policies',
                'publish-created-event',
                'publish-priority-event',
                'receive-created-route',
                'receive-priority-route',
            ],
        )

    def test_scheduler_lab_registry_includes_sqs_delivery_workflow(self):
        labs = labs_for_service('scheduler')

        self.assertEqual(len(labs), 1)
        self.assertEqual(labs[0]['key'], 'sqs-delivery')
        self.assertEqual(
            [step['key'] for step in labs[0]['steps']],
            [
                'create-queue',
                'create-role',
                'put-role-policy',
                'create-schedule-group',
                'create-schedule',
                'get-schedule',
                'receive-scheduled-message',
                'confirm-schedule-deleted',
            ],
        )

    def test_cloudformation_lab_registry_includes_s3_sqs_stack_workflow(self):
        labs = labs_for_service('cloudformation')

        self.assertEqual(len(labs), 1)
        self.assertEqual(labs[0]['key'], 's3-sqs-stack')
        self.assertEqual(
            [step['key'] for step in labs[0]['steps']],
            [
                'validate-template',
                'create-stack',
                'describe-stack',
                'describe-stack-resources',
                'describe-stack-events',
                'inspect-provisioned-resources',
                'delete-stack',
                'confirm-resources-deleted',
            ],
        )

    def test_ec2_lab_registry_includes_public_private_vpc_workflow(self):
        labs = labs_for_service('ec2')

        self.assertEqual(len(labs), 4)
        self.assertEqual(labs[0]['key'], 'vpc-public-private')
        self.assertEqual(
            [step['key'] for step in labs[0]['steps']],
            [
                'create-vpc',
                'create-public-subnet',
                'enable-public-ip',
                'create-private-subnet',
                'create-internet-gateway',
                'attach-internet-gateway',
                'create-public-route-table',
                'create-internet-route',
                'associate-public-route-table',
                'create-private-route-table',
                'associate-private-route-table',
                'inspect-network-topology',
            ],
        )
        self.assertEqual(labs[1]['key'], 'security-controls')
        self.assertEqual(
            [step['key'] for step in labs[1]['steps']],
            [
                'create-vpc',
                'create-subnet',
                'create-web-security-group',
                'allow-trusted-https',
                'create-app-security-group',
                'allow-web-to-app',
                'inspect-security-groups',
                'inspect-network-acl-support',
            ],
        )
        self.assertEqual(labs[2]['key'], 's3-gateway-endpoint')
        self.assertEqual(
            [step['key'] for step in labs[2]['steps']],
            [
                'create-vpc',
                'create-private-subnet',
                'create-private-route-table',
                'associate-private-route-table',
                'create-s3-bucket',
                'create-s3-gateway-endpoint',
                'inspect-private-s3-path',
            ],
        )
        self.assertEqual(labs[3]['key'], 'sqs-interface-endpoint')
        self.assertEqual(
            [step['key'] for step in labs[3]['steps']],
            [
                'create-vpc',
                'create-private-subnet',
                'create-endpoint-security-group',
                'allow-vpc-https',
                'create-sqs-queue',
                'create-sqs-interface-endpoint',
                'inspect-private-sqs-path',
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
    def test_sqs_create_queue_step_creates_and_verifies_queue(self, factory_mock):
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        sqs.create_queue.return_value = {'QueueUrl': queue_url}
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step('sqs', 'create-queue', 'create-queue')

        sqs.create_queue.assert_called_once_with(QueueName='floci-lab-basics')
        self.assertTrue(result['verified'])
        self.assertEqual(
            result['command'],
            'aws sqs create-queue --queue-name floci-lab-basics',
        )

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_get_queue_attributes_step_verifies_expected_arn(self, factory_mock):
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.get_queue_attributes.return_value = {
            'Attributes': {
                'QueueArn': 'arn:aws:sqs:us-east-1:000000000000:floci-lab-basics',
                'VisibilityTimeout': '30',
            },
        }
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            'sqs',
            'create-queue',
            'get-queue-attributes',
        )

        sqs.get_queue_attributes.assert_called_with(
            QueueUrl=queue_url,
            AttributeNames=['All'],
        )
        self.assertTrue(result['verified'])
        self.assertIn('VisibilityTimeout', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_list_queues_step_finds_lab_queue(self, factory_mock):
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        sqs.list_queues.return_value = {'QueueUrls': [queue_url]}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step('sqs', 'create-queue', 'list-queues')

        sqs.list_queues.assert_called()
        self.assertTrue(result['verified'])
        self.assertIn('floci-lab-basics', result['stdout'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_create_queue_lab_status_recomputes_from_live_queue(self, factory_mock):
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.get_queue_attributes.return_value = {
            'Attributes': {
                'QueueArn': 'arn:aws:sqs:us-east-1:000000000000:floci-lab-basics',
            },
        }
        sqs.list_queues.return_value = {'QueueUrls': [queue_url]}
        factory_mock.return_value.client.return_value = sqs

        from .labs import lab_status

        status = lab_status('sqs', 'create-queue')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['create-queue']['verified'])
        self.assertTrue(status['steps']['get-queue-url']['verified'])
        self.assertTrue(status['steps']['get-queue-attributes']['verified'])
        self.assertTrue(status['steps']['list-queues']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_create_queue_lab_reset_deletes_queue(self, factory_mock):
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        factory_mock.return_value.client.return_value = sqs

        result = reset_lab('sqs', 'create-queue')

        sqs.delete_queue.assert_called_once_with(QueueUrl=queue_url)
        self.assertTrue(result['reset'])
        self.assertTrue(result['deleted'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_message_lifecycle_sends_known_body_and_attribute(self, factory_mock):
        cache.clear()
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        message = {
            'MessageId': 'message-1',
            'ReceiptHandle': 'receipt-1',
            'Body': '{"event":"order.created","order_id":"FLOCI-1001"}',
            'MessageAttributes': {
                'Lab': {
                    'DataType': 'String',
                    'StringValue': 'message-lifecycle',
                },
            },
        }
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.send_message.return_value = {'MessageId': 'message-1'}
        sqs.receive_message.return_value = {'Messages': [message]}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step('sqs', 'message-lifecycle', 'send-message')

        sqs.send_message.assert_called_once_with(
            QueueUrl=queue_url,
            MessageBody='{"event":"order.created","order_id":"FLOCI-1001"}',
            MessageAttributes={
                'Lab': {
                    'DataType': 'String',
                    'StringValue': 'message-lifecycle',
                },
            },
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_message_lifecycle_receives_without_hiding_message(self, factory_mock):
        cache.clear()
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        message = {
            'MessageId': 'message-1',
            'ReceiptHandle': 'receipt-1',
            'Body': '{"event":"order.created","order_id":"FLOCI-1001"}',
            'MessageAttributes': {
                'Lab': {'DataType': 'String', 'StringValue': 'message-lifecycle'},
            },
        }
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {'Messages': [message]}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step('sqs', 'message-lifecycle', 'receive-message')

        sqs.receive_message.assert_called_once_with(
            QueueUrl=queue_url,
            MaxNumberOfMessages=10,
            VisibilityTimeout=0,
            WaitTimeSeconds=1,
            AttributeNames=['All'],
            MessageAttributeNames=['All'],
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_message_lifecycle_deletes_with_live_receipt_handle(self, factory_mock):
        cache.clear()
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        message = {
            'MessageId': 'message-1',
            'ReceiptHandle': 'receipt-1',
            'Body': '{"event":"order.created","order_id":"FLOCI-1001"}',
            'MessageAttributes': {
                'Lab': {'DataType': 'String', 'StringValue': 'message-lifecycle'},
            },
        }
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.side_effect = [
            {'Messages': [message]},
            {'Messages': []},
        ]
        sqs.delete_message.return_value = {}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step('sqs', 'message-lifecycle', 'delete-message')

        sqs.delete_message.assert_called_once_with(
            QueueUrl=queue_url,
            ReceiptHandle='receipt-1',
        )
        self.assertTrue(result['verified'])
        self.assertTrue(cache.get('floci-lab:sqs:message-lifecycle:deleted'))
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_message_lifecycle_status_remembers_verified_deletion(self, factory_mock):
        cache.clear()
        cache.set('floci-lab:sqs:message-lifecycle:deleted', True)
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {'Messages': []}
        factory_mock.return_value.client.return_value = sqs

        from .labs import lab_status

        status = lab_status('sqs', 'message-lifecycle')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['send-message']['verified'])
        self.assertTrue(status['steps']['receive-message']['verified'])
        self.assertTrue(status['steps']['delete-message']['verified'])
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_message_lifecycle_reset_deletes_only_matching_message(self, factory_mock):
        cache.clear()
        cache.set('floci-lab:sqs:message-lifecycle:deleted', True)
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        matching = {
            'ReceiptHandle': 'receipt-1',
            'Body': '{"event":"order.created","order_id":"FLOCI-1001"}',
            'MessageAttributes': {
                'Lab': {'DataType': 'String', 'StringValue': 'message-lifecycle'},
            },
        }
        unrelated = {
            'ReceiptHandle': 'receipt-2',
            'Body': 'leave me alone',
            'MessageAttributes': {},
        }
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {'Messages': [matching, unrelated]}
        factory_mock.return_value.client.return_value = sqs

        result = reset_lab('sqs', 'message-lifecycle')

        sqs.delete_message.assert_called_once_with(
            QueueUrl=queue_url,
            ReceiptHandle='receipt-1',
        )
        sqs.delete_queue.assert_not_called()
        self.assertEqual(result['deleted_messages'], 1)
        self.assertIsNone(cache.get('floci-lab:sqs:message-lifecycle:deleted'))

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_visibility_lab_receives_and_captures_receipt(self, factory_mock):
        cache.clear()
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        message = {
            'MessageId': 'job-1',
            'ReceiptHandle': 'visibility-receipt',
            'Body': '{"event":"job.ready","job_id":"FLOCI-JOB-1001"}',
            'MessageAttributes': {
                'Lab': {'DataType': 'String', 'StringValue': 'visibility-timeout'},
            },
        }
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {'Messages': [message]}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step('sqs', 'visibility-timeout', 'receive-message')

        self.assertTrue(result['verified'])
        self.assertEqual(
            cache.get('floci-lab:sqs:visibility-timeout:receipt'),
            'visibility-receipt',
        )
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_visibility_lab_extends_timeout_with_cached_receipt(self, factory_mock):
        cache.clear()
        cache.set(
            'floci-lab:sqs:visibility-timeout:receipt',
            'visibility-receipt',
        )
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.change_message_visibility.return_value = {}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            'sqs',
            'visibility-timeout',
            'extend-message-visibility',
        )

        sqs.change_message_visibility.assert_called_once_with(
            QueueUrl=queue_url,
            ReceiptHandle='visibility-receipt',
            VisibilityTimeout=60,
        )
        self.assertTrue(result['verified'])
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_visibility_lab_shortens_timeout_after_hidden_check(self, factory_mock):
        cache.clear()
        cache.set(
            'floci-lab:sqs:visibility-timeout:receipt',
            'visibility-receipt',
        )
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            'sqs',
            'visibility-timeout',
            'shorten-message-visibility',
        )

        sqs.change_message_visibility.assert_called_once_with(
            QueueUrl=queue_url,
            ReceiptHandle='visibility-receipt',
            VisibilityTimeout=2,
        )
        self.assertTrue(result['verified'])
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_visibility_lab_verifies_message_is_hidden(self, factory_mock):
        cache.clear()
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {'Messages': []}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step('sqs', 'visibility-timeout', 'verify-hidden')

        sqs.receive_message.assert_called_once_with(
            QueueUrl=queue_url,
            MaxNumberOfMessages=10,
            VisibilityTimeout=0,
            WaitTimeSeconds=0,
            AttributeNames=['All'],
            MessageAttributeNames=['All'],
        )
        self.assertTrue(result['verified'])
        self.assertTrue(cache.get('floci-lab:sqs:visibility-timeout:hidden'))
        cache.clear()

    @patch('dashboard.labs.time.sleep')
    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_visibility_lab_receives_again_after_timeout(
        self,
        factory_mock,
        sleep_mock,
    ):
        cache.clear()
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        message = {
            'MessageId': 'job-1',
            'ReceiptHandle': 'new-receipt',
            'Body': '{"event":"job.ready","job_id":"FLOCI-JOB-1001"}',
            'MessageAttributes': {
                'Lab': {'DataType': 'String', 'StringValue': 'visibility-timeout'},
            },
        }
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {'Messages': [message]}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            'sqs',
            'visibility-timeout',
            'receive-after-timeout',
        )

        sleep_mock.assert_called_once_with(2.25)
        self.assertTrue(result['verified'])
        self.assertTrue(cache.get('floci-lab:sqs:visibility-timeout:returned'))
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_visibility_lab_status_requires_hidden_and_returned_markers(
        self,
        factory_mock,
    ):
        cache.clear()
        cache.set('floci-lab:sqs:visibility-timeout:hidden', True)
        cache.set('floci-lab:sqs:visibility-timeout:returned', True)
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        message = {
            'MessageId': 'job-1',
            'ReceiptHandle': 'new-receipt',
            'Body': '{"event":"job.ready","job_id":"FLOCI-JOB-1001"}',
            'MessageAttributes': {
                'Lab': {'DataType': 'String', 'StringValue': 'visibility-timeout'},
            },
        }
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {'Messages': [message]}
        factory_mock.return_value.client.return_value = sqs

        from .labs import lab_status

        status = lab_status('sqs', 'visibility-timeout')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['verify-hidden']['verified'])
        self.assertTrue(status['steps']['receive-after-timeout']['verified'])
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_visibility_lab_reset_reveals_and_deletes_matching_job(
        self,
        factory_mock,
    ):
        cache.clear()
        cache.set(
            'floci-lab:sqs:visibility-timeout:receipt',
            'old-receipt',
        )
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        message = {
            'ReceiptHandle': 'current-receipt',
            'Body': '{"event":"job.ready","job_id":"FLOCI-JOB-1001"}',
            'MessageAttributes': {
                'Lab': {'DataType': 'String', 'StringValue': 'visibility-timeout'},
            },
        }
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {'Messages': [message]}
        factory_mock.return_value.client.return_value = sqs

        result = reset_lab('sqs', 'visibility-timeout')

        sqs.change_message_visibility.assert_called_once_with(
            QueueUrl=queue_url,
            ReceiptHandle='old-receipt',
            VisibilityTimeout=0,
        )
        sqs.delete_message.assert_called_once_with(
            QueueUrl=queue_url,
            ReceiptHandle='current-receipt',
        )
        sqs.delete_queue.assert_not_called()
        self.assertEqual(result['deleted_messages'], 1)
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_delayed_lab_sends_and_immediately_verifies_delay(self, factory_mock):
        cache.clear()
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.send_message.return_value = {'MessageId': 'report-1'}
        sqs.get_queue_attributes.return_value = {
            'Attributes': {'ApproximateNumberOfMessagesDelayed': '1'},
        }
        sqs.receive_message.return_value = {'Messages': []}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            'sqs',
            'delayed-message',
            'send-delayed-message',
        )

        sqs.send_message.assert_called_once_with(
            QueueUrl=queue_url,
            MessageBody='{"event":"report.generate","report_id":"FLOCI-REPORT-1001"}',
            MessageAttributes={
                'Lab': {
                    'DataType': 'String',
                    'StringValue': 'delayed-message',
                },
            },
            DelaySeconds=10,
        )
        self.assertTrue(result['verified'])
        self.assertTrue(cache.get('floci-lab:sqs:delayed-message:observed'))
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_delayed_lab_reads_delayed_message_count(self, factory_mock):
        cache.clear()
        cache.set('floci-lab:sqs:delayed-message:observed', True)
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.get_queue_attributes.return_value = {
            'Attributes': {'ApproximateNumberOfMessagesDelayed': '1'},
        }
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            'sqs',
            'delayed-message',
            'get-queue-attributes',
        )

        sqs.get_queue_attributes.assert_called_once_with(
            QueueUrl=queue_url,
            AttributeNames=['ApproximateNumberOfMessagesDelayed'],
        )
        self.assertTrue(result['verified'])
        self.assertIn('"ApproximateNumberOfMessagesDelayed": "1"', result['stdout'])
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_delayed_lab_receives_message_after_delay(self, factory_mock):
        cache.clear()
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        message = {
            'MessageId': 'report-1',
            'ReceiptHandle': 'report-receipt',
            'Body': '{"event":"report.generate","report_id":"FLOCI-REPORT-1001"}',
            'MessageAttributes': {
                'Lab': {'DataType': 'String', 'StringValue': 'delayed-message'},
            },
        }
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {'Messages': [message]}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            'sqs',
            'delayed-message',
            'receive-after-delay',
        )

        sqs.receive_message.assert_called_once_with(
            QueueUrl=queue_url,
            MaxNumberOfMessages=10,
            VisibilityTimeout=0,
            WaitTimeSeconds=1,
            AttributeNames=['All'],
            MessageAttributeNames=['All'],
        )
        self.assertTrue(result['verified'])
        self.assertTrue(cache.get('floci-lab:sqs:delayed-message:returned'))
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_delayed_lab_status_requires_observed_and_returned_states(
        self,
        factory_mock,
    ):
        cache.clear()
        cache.set('floci-lab:sqs:delayed-message:observed', True)
        cache.set('floci-lab:sqs:delayed-message:returned', True)
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        message = {
            'MessageId': 'report-1',
            'ReceiptHandle': 'report-receipt',
            'Body': '{"event":"report.generate","report_id":"FLOCI-REPORT-1001"}',
            'MessageAttributes': {
                'Lab': {'DataType': 'String', 'StringValue': 'delayed-message'},
            },
        }
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {'Messages': [message]}
        factory_mock.return_value.client.return_value = sqs

        from .labs import lab_status

        status = lab_status('sqs', 'delayed-message')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['send-delayed-message']['verified'])
        self.assertTrue(status['steps']['get-queue-attributes']['verified'])
        self.assertTrue(status['steps']['receive-after-delay']['verified'])
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_delayed_lab_reset_deletes_only_matching_message(self, factory_mock):
        cache.clear()
        cache.set('floci-lab:sqs:delayed-message:observed', True)
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        matching = {
            'ReceiptHandle': 'report-receipt',
            'Body': '{"event":"report.generate","report_id":"FLOCI-REPORT-1001"}',
            'MessageAttributes': {
                'Lab': {'DataType': 'String', 'StringValue': 'delayed-message'},
            },
        }
        unrelated = {
            'ReceiptHandle': 'other-receipt',
            'Body': 'unrelated',
            'MessageAttributes': {},
        }
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {'Messages': [matching, unrelated]}
        factory_mock.return_value.client.return_value = sqs

        result = reset_lab('sqs', 'delayed-message')

        sqs.delete_message.assert_called_once_with(
            QueueUrl=queue_url,
            ReceiptHandle='report-receipt',
        )
        sqs.delete_queue.assert_not_called()
        self.assertEqual(result['deleted_messages'], 1)
        self.assertIsNone(cache.get('floci-lab:sqs:delayed-message:observed'))

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_batch_lab_sends_three_entries(self, factory_mock):
        cache.clear()
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        messages = [
            {
                'MessageId': f'message-{index}',
                'ReceiptHandle': f'receipt-{index}',
                'Body': f'{{"event":"task.created","task_id":"FLOCI-TASK-{index}"}}',
                'MessageAttributes': {
                    'Lab': {'DataType': 'String', 'StringValue': 'batch-messages'},
                },
            }
            for index in range(1, 4)
        ]
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.send_message_batch.return_value = {
            'Successful': [
                {'Id': f'task-{index}', 'MessageId': f'message-{index}'}
                for index in range(1, 4)
            ],
            'Failed': [],
        }
        sqs.receive_message.return_value = {'Messages': messages}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            'sqs',
            'batch-messages',
            'send-message-batch',
        )

        call = sqs.send_message_batch.call_args.kwargs
        self.assertEqual(call['QueueUrl'], queue_url)
        self.assertEqual(len(call['Entries']), 3)
        self.assertEqual(
            {entry['Id'] for entry in call['Entries']},
            {'task-1', 'task-2', 'task-3'},
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_batch_lab_receives_all_three_messages(self, factory_mock):
        cache.clear()
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        messages = [
            {
                'MessageId': f'message-{index}',
                'ReceiptHandle': f'receipt-{index}',
                'Body': f'{{"event":"task.created","task_id":"FLOCI-TASK-{index}"}}',
                'MessageAttributes': {
                    'Lab': {'DataType': 'String', 'StringValue': 'batch-messages'},
                },
            }
            for index in range(1, 4)
        ]
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {'Messages': messages}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step('sqs', 'batch-messages', 'receive-message')

        self.assertTrue(result['verified'])
        self.assertEqual(len(result['json']['Messages']), 3)

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_batch_lab_deletes_with_live_receipt_handles(self, factory_mock):
        cache.clear()
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        messages = [
            {
                'MessageId': f'message-{index}',
                'ReceiptHandle': f'receipt-{index}',
                'Body': f'{{"event":"task.created","task_id":"FLOCI-TASK-{index}"}}',
                'MessageAttributes': {
                    'Lab': {'DataType': 'String', 'StringValue': 'batch-messages'},
                },
            }
            for index in range(1, 4)
        ]
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        receive_calls = iter([{'Messages': messages}])
        sqs.receive_message.side_effect = lambda **_kwargs: next(
            receive_calls,
            {'Messages': []},
        )
        sqs.delete_message_batch.return_value = {
            'Successful': [{'Id': f'task-{index}'} for index in range(1, 4)],
            'Failed': [],
        }
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            'sqs',
            'batch-messages',
            'delete-message-batch',
        )

        sqs.delete_message_batch.assert_called_once_with(
            QueueUrl=queue_url,
            Entries=[
                {'Id': 'task-1', 'ReceiptHandle': 'receipt-1'},
                {'Id': 'task-2', 'ReceiptHandle': 'receipt-2'},
                {'Id': 'task-3', 'ReceiptHandle': 'receipt-3'},
            ],
        )
        self.assertTrue(result['verified'])
        self.assertTrue(cache.get('floci-lab:sqs:batch-messages:deleted'))
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_batch_lab_status_remembers_verified_deletion(self, factory_mock):
        cache.clear()
        cache.set('floci-lab:sqs:batch-messages:deleted', True)
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {'Messages': []}
        factory_mock.return_value.client.return_value = sqs

        from .labs import lab_status

        status = lab_status('sqs', 'batch-messages')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['send-message-batch']['verified'])
        self.assertTrue(status['steps']['receive-message']['verified'])
        self.assertTrue(status['steps']['delete-message-batch']['verified'])
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_batch_lab_reset_deletes_only_matching_messages(self, factory_mock):
        cache.clear()
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        messages = [
            {
                'ReceiptHandle': f'receipt-{index}',
                'Body': f'{{"event":"task.created","task_id":"FLOCI-TASK-{index}"}}',
                'MessageAttributes': {
                    'Lab': {'DataType': 'String', 'StringValue': 'batch-messages'},
                },
            }
            for index in range(1, 4)
        ]
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {'Messages': messages}
        sqs.delete_message_batch.return_value = {
            'Successful': [{'Id': f'task-{index}'} for index in range(1, 4)],
        }
        factory_mock.return_value.client.return_value = sqs

        result = reset_lab('sqs', 'batch-messages')

        sqs.delete_message_batch.assert_called_once()
        sqs.delete_queue.assert_not_called()
        self.assertEqual(result['deleted_messages'], 3)

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_configuration_lab_sets_processing_attributes(self, factory_mock):
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        configured = {
            'VisibilityTimeout': '45',
            'MessageRetentionPeriod': '86400',
            'ReceiveMessageWaitTimeSeconds': '10',
        }
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.get_queue_attributes.return_value = {'Attributes': configured}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            'sqs',
            'queue-configuration',
            'set-queue-attributes',
        )

        sqs.set_queue_attributes.assert_called_once_with(
            QueueUrl=queue_url,
            Attributes=configured,
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_configuration_lab_tags_queue(self, factory_mock):
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        tags = {'Environment': 'lab', 'Purpose': 'training'}
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.list_queue_tags.return_value = {'Tags': tags}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            'sqs',
            'queue-configuration',
            'tag-queue',
        )

        sqs.tag_queue.assert_called_once_with(
            QueueUrl=queue_url,
            Tags=tags,
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_configuration_lab_status_requires_attributes_and_tags(
        self,
        factory_mock,
    ):
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.get_queue_attributes.return_value = {
            'Attributes': {
                'VisibilityTimeout': '45',
                'MessageRetentionPeriod': '86400',
                'ReceiveMessageWaitTimeSeconds': '10',
            },
        }
        sqs.list_queue_tags.return_value = {
            'Tags': {'Environment': 'lab', 'Purpose': 'training'},
        }
        factory_mock.return_value.client.return_value = sqs

        from .labs import lab_status

        status = lab_status('sqs', 'queue-configuration')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['set-queue-attributes']['verified'])
        self.assertTrue(status['steps']['get-queue-attributes']['verified'])
        self.assertTrue(status['steps']['tag-queue']['verified'])
        self.assertTrue(status['steps']['list-queue-tags']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_configuration_lab_reset_restores_defaults_and_removes_tags(
        self,
        factory_mock,
    ):
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-basics'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        factory_mock.return_value.client.return_value = sqs

        result = reset_lab('sqs', 'queue-configuration')

        sqs.set_queue_attributes.assert_called_once_with(
            QueueUrl=queue_url,
            Attributes={
                'VisibilityTimeout': '30',
                'MessageRetentionPeriod': '345600',
                'ReceiveMessageWaitTimeSeconds': '0',
            },
        )
        sqs.untag_queue.assert_called_once_with(
            QueueUrl=queue_url,
            TagKeys=['Environment', 'Purpose'],
        )
        sqs.delete_queue.assert_not_called()
        self.assertTrue(result['reset_attributes'])
        self.assertTrue(result['removed_tags'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_redrive_lab_configures_source_queue_policy(self, factory_mock):
        sqs = MagicMock()
        source_url = 'http://localhost:4566/000000000000/floci-lab-redrive-source'
        policy = {
            'deadLetterTargetArn': (
                'arn:aws:sqs:us-east-1:000000000000:floci-lab-redrive-dlq'
            ),
            'maxReceiveCount': '2',
        }
        sqs.get_queue_url.return_value = {'QueueUrl': source_url}
        sqs.get_queue_attributes.return_value = {
            'Attributes': {'RedrivePolicy': json.dumps(policy)},
        }
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            'sqs',
            'dead-letter-redrive',
            'set-redrive-policy',
        )

        sqs.set_queue_attributes.assert_called_once_with(
            QueueUrl=source_url,
            Attributes={'RedrivePolicy': json.dumps(policy)},
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_redrive_lab_records_two_failed_receives(self, factory_mock):
        cache.clear()
        sqs = MagicMock()
        source_url = 'http://localhost:4566/000000000000/floci-lab-redrive-source'
        sqs.get_queue_url.return_value = {'QueueUrl': source_url}
        messages = [
            {
                'MessageId': 'payment-1',
                'ReceiptHandle': f'receipt-{receive_count}',
                'Body': (
                    '{"event":"payment.process","payment_id":'
                    '"FLOCI-PAYMENT-1001","simulate_failure":true}'
                ),
                'Attributes': {'ApproximateReceiveCount': str(receive_count)},
                'MessageAttributes': {
                    'Lab': {
                        'DataType': 'String',
                        'StringValue': 'dead-letter-redrive',
                    },
                },
            }
            for receive_count in (1, 2)
        ]
        sqs.receive_message.side_effect = [
            {'Messages': [messages[0]]},
            {'Messages': [messages[1]]},
        ]
        factory_mock.return_value.client.return_value = sqs

        first = run_lab_step(
            'sqs',
            'dead-letter-redrive',
            'fail-message-once',
        )
        second = run_lab_step(
            'sqs',
            'dead-letter-redrive',
            'fail-message-twice',
        )

        self.assertTrue(first['verified'])
        self.assertTrue(second['verified'])
        self.assertTrue(
            cache.get('floci-lab:sqs:dead-letter-redrive:failure-one')
        )
        self.assertTrue(
            cache.get('floci-lab:sqs:dead-letter-redrive:failure-two')
        )
        self.assertEqual(sqs.receive_message.call_count, 2)
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_redrive_lab_inspects_dlq_and_starts_move_task(self, factory_mock):
        cache.clear()
        sqs = MagicMock()
        dlq_url = 'http://localhost:4566/000000000000/floci-lab-redrive-dlq'
        message = {
            'MessageId': 'payment-1',
            'ReceiptHandle': 'dlq-receipt',
            'Body': (
                '{"event":"payment.process","payment_id":'
                '"FLOCI-PAYMENT-1001","simulate_failure":true}'
            ),
            'Attributes': {'ApproximateReceiveCount': '4'},
            'MessageAttributes': {
                'Lab': {
                    'DataType': 'String',
                    'StringValue': 'dead-letter-redrive',
                },
            },
        }
        sqs.get_queue_url.return_value = {'QueueUrl': dlq_url}
        sqs.receive_message.return_value = {'Messages': [message]}
        sqs.start_message_move_task.return_value = {'TaskHandle': 'task-1'}
        factory_mock.return_value.client.return_value = sqs

        inspect_result = run_lab_step(
            'sqs',
            'dead-letter-redrive',
            'inspect-dlq',
        )
        move_result = run_lab_step(
            'sqs',
            'dead-letter-redrive',
            'start-message-move-task',
        )

        self.assertTrue(inspect_result['verified'])
        self.assertTrue(move_result['verified'])
        sqs.start_message_move_task.assert_called_once_with(
            SourceArn='arn:aws:sqs:us-east-1:000000000000:floci-lab-redrive-dlq',
            DestinationArn=(
                'arn:aws:sqs:us-east-1:000000000000:floci-lab-redrive-source'
            ),
            MaxNumberOfMessagesPerSecond=10,
        )
        self.assertEqual(
            cache.get('floci-lab:sqs:dead-letter-redrive:task'),
            'task-1',
        )
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_redrive_lab_triggers_dead_letter_transition(self, factory_mock):
        cache.clear()
        cache.set(
            'floci-lab:sqs:dead-letter-redrive:failure-two',
            True,
        )
        sqs = MagicMock()
        source_url = 'http://localhost:4566/000000000000/floci-lab-redrive-source'
        sqs.get_queue_url.return_value = {'QueueUrl': source_url}
        sqs.receive_message.return_value = {}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            'sqs',
            'dead-letter-redrive',
            'trigger-dead-lettering',
        )

        self.assertTrue(result['verified'])
        self.assertTrue(
            cache.get('floci-lab:sqs:dead-letter-redrive:triggered')
        )
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_redrive_lab_verifies_task_and_returned_message(self, factory_mock):
        cache.clear()
        cache.set('floci-lab:sqs:dead-letter-redrive:task', 'task-1')
        sqs = MagicMock()
        source_url = 'http://localhost:4566/000000000000/floci-lab-redrive-source'
        task = {
            'TaskHandle': 'task-1',
            'Status': 'COMPLETED',
            'SourceArn': (
                'arn:aws:sqs:us-east-1:000000000000:floci-lab-redrive-dlq'
            ),
            'DestinationArn': (
                'arn:aws:sqs:us-east-1:000000000000:floci-lab-redrive-source'
            ),
            'ApproximateNumberOfMessagesMoved': 1,
        }
        message = {
            'MessageId': 'payment-1',
            'ReceiptHandle': 'source-receipt',
            'Body': (
                '{"event":"payment.process","payment_id":'
                '"FLOCI-PAYMENT-1001","simulate_failure":true}'
            ),
            'Attributes': {'ApproximateReceiveCount': '1'},
            'MessageAttributes': {
                'Lab': {
                    'DataType': 'String',
                    'StringValue': 'dead-letter-redrive',
                },
            },
        }
        sqs.get_queue_url.return_value = {'QueueUrl': source_url}
        sqs.list_message_move_tasks.return_value = {'Results': [task]}
        sqs.receive_message.return_value = {'Messages': [message]}
        factory_mock.return_value.client.return_value = sqs

        task_result = run_lab_step(
            'sqs',
            'dead-letter-redrive',
            'list-message-move-tasks',
        )
        receive_result = run_lab_step(
            'sqs',
            'dead-letter-redrive',
            'receive-redriven-message',
        )

        self.assertTrue(task_result['verified'])
        self.assertTrue(receive_result['verified'])
        self.assertTrue(
            cache.get('floci-lab:sqs:dead-letter-redrive:returned')
        )
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_redrive_lab_status_recomputes_topology_and_task(
        self,
        factory_mock,
    ):
        cache.clear()
        for key in (
            'failure-one',
            'failure-two',
            'triggered',
            'dlq-observed',
            'returned',
        ):
            cache.set(
                f'floci-lab:sqs:dead-letter-redrive:{key}',
                True,
            )
        cache.set('floci-lab:sqs:dead-letter-redrive:task', 'task-1')
        sqs = MagicMock()
        source_url = 'http://localhost:4566/000000000000/floci-lab-redrive-source'
        dlq_url = 'http://localhost:4566/000000000000/floci-lab-redrive-dlq'
        urls = {
            'floci-lab-redrive-source': source_url,
            'floci-lab-redrive-dlq': dlq_url,
        }
        sqs.get_queue_url.side_effect = lambda QueueName: {
            'QueueUrl': urls[QueueName],
        }

        def get_attributes(QueueUrl, AttributeNames):
            if AttributeNames == ['QueueArn']:
                return {
                    'Attributes': {
                        'QueueArn': (
                            'arn:aws:sqs:us-east-1:000000000000:'
                            + QueueUrl.rsplit('/', 1)[-1]
                        ),
                    },
                }
            return {
                'Attributes': {
                    'RedrivePolicy': json.dumps({
                        'deadLetterTargetArn': (
                            'arn:aws:sqs:us-east-1:000000000000:'
                            'floci-lab-redrive-dlq'
                        ),
                        'maxReceiveCount': '2',
                    }),
                },
            }

        sqs.get_queue_attributes.side_effect = get_attributes
        sqs.list_message_move_tasks.return_value = {
            'Results': [{
                'TaskHandle': 'task-1',
                'Status': 'COMPLETED',
                'DestinationArn': (
                    'arn:aws:sqs:us-east-1:000000000000:'
                    'floci-lab-redrive-source'
                ),
                'ApproximateNumberOfMessagesMoved': 1,
            }],
        }
        factory_mock.return_value.client.return_value = sqs

        from .labs import lab_status

        status = lab_status('sqs', 'dead-letter-redrive')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['set-redrive-policy']['verified'])
        self.assertTrue(status['steps']['trigger-dead-lettering']['verified'])
        self.assertTrue(status['steps']['list-message-move-tasks']['verified'])
        self.assertTrue(status['steps']['receive-redriven-message']['verified'])
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_redrive_lab_reset_cancels_task_and_deletes_both_queues(
        self,
        factory_mock,
    ):
        cache.clear()
        sqs = MagicMock()
        urls = {
            'floci-lab-redrive-source': (
                'http://localhost:4566/000000000000/floci-lab-redrive-source'
            ),
            'floci-lab-redrive-dlq': (
                'http://localhost:4566/000000000000/floci-lab-redrive-dlq'
            ),
        }
        sqs.get_queue_url.side_effect = lambda QueueName: {
            'QueueUrl': urls[QueueName],
        }
        sqs.list_message_move_tasks.return_value = {
            'Results': [{'TaskHandle': 'task-1', 'Status': 'RUNNING'}],
        }
        factory_mock.return_value.client.return_value = sqs

        result = reset_lab('sqs', 'dead-letter-redrive')

        sqs.cancel_message_move_task.assert_called_once_with(
            TaskHandle='task-1',
        )
        self.assertEqual(
            [call.kwargs['QueueUrl'] for call in sqs.delete_queue.call_args_list],
            [urls['floci-lab-redrive-source'], urls['floci-lab-redrive-dlq']],
        )
        self.assertEqual(result['cancelled_tasks'], 1)
        self.assertEqual(
            result['deleted_queues'],
            ['floci-lab-redrive-source', 'floci-lab-redrive-dlq'],
        )

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_fifo_lab_creates_explicit_deduplication_queue(self, factory_mock):
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-orders.fifo'
        sqs.create_queue.return_value = {'QueueUrl': queue_url}
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.get_queue_attributes.return_value = {
            'Attributes': {
                'QueueArn': (
                    'arn:aws:sqs:us-east-1:000000000000:floci-lab-orders.fifo'
                ),
                'FifoQueue': 'true',
                'ContentBasedDeduplication': 'false',
            },
        }
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step('sqs', 'fifo-ordering', 'create-queue')

        sqs.create_queue.assert_called_once_with(
            QueueName='floci-lab-orders.fifo',
            Attributes={
                'FifoQueue': 'true',
                'ContentBasedDeduplication': 'false',
            },
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_fifo_lab_suppresses_duplicate_deduplication_id(
        self,
        factory_mock,
    ):
        cache.clear()
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-orders.fifo'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.send_message.side_effect = [
            {'MessageId': 'message-1', 'SequenceNumber': '41'},
            {'MessageId': 'message-1', 'SequenceNumber': '41'},
        ]
        factory_mock.return_value.client.return_value = sqs

        first = run_lab_step('sqs', 'fifo-ordering', 'send-created')
        duplicate = run_lab_step('sqs', 'fifo-ordering', 'send-duplicate')

        self.assertTrue(first['verified'])
        self.assertTrue(duplicate['verified'])
        self.assertEqual(sqs.send_message.call_count, 2)
        duplicate_call = sqs.send_message.call_args_list[1].kwargs
        self.assertEqual(
            duplicate_call['MessageDeduplicationId'],
            'FLOCI-ORDER-1001-1',
        )
        self.assertEqual(
            duplicate_call['MessageGroupId'],
            'customer-FLOCI-1001',
        )
        self.assertTrue(
            cache.get('floci-lab:sqs:fifo-ordering:deduplicated')
        )
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_fifo_lab_receives_three_messages_in_order(self, factory_mock):
        cache.clear()
        cache.set('floci-lab:sqs:fifo-ordering:deduplicated', True)
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-orders.fifo'
        bodies = [
            (
                '{"event":"order.status","order_id":"FLOCI-ORDER-1001",'
                f'"status":"{status}","step":{step}}}'
            )
            for step, status in enumerate(
                ('created', 'paid', 'fulfilled'),
                start=1,
            )
        ]
        messages = [
            {
                'MessageId': f'message-{step}',
                'ReceiptHandle': f'receipt-{step}',
                'Body': body,
                'Attributes': {
                    'MessageGroupId': 'customer-FLOCI-1001',
                    'MessageDeduplicationId': f'FLOCI-ORDER-1001-{step}',
                    'SequenceNumber': str(40 + step),
                },
            }
            for step, body in enumerate(bodies, start=1)
        ]
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {'Messages': messages}
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            'sqs',
            'fifo-ordering',
            'receive-ordered-messages',
        )

        self.assertTrue(result['verified'])
        self.assertEqual(
            result['verification']['resource']['sequence_numbers'],
            [41, 42, 43],
        )
        self.assertTrue(cache.get('floci-lab:sqs:fifo-ordering:ordered'))
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_fifo_lab_status_requires_deduplication_and_order(
        self,
        factory_mock,
    ):
        cache.clear()
        cache.set('floci-lab:sqs:fifo-ordering:deduplicated', True)
        cache.set('floci-lab:sqs:fifo-ordering:ordered', True)
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-orders.fifo'
        bodies = [
            (
                '{"event":"order.status","order_id":"FLOCI-ORDER-1001",'
                f'"status":"{status}","step":{step}}}'
            )
            for step, status in enumerate(
                ('created', 'paid', 'fulfilled'),
                start=1,
            )
        ]
        messages = [
            {
                'Body': body,
                'Attributes': {
                    'MessageGroupId': 'customer-FLOCI-1001',
                    'MessageDeduplicationId': f'FLOCI-ORDER-1001-{step}',
                    'SequenceNumber': str(step),
                },
            }
            for step, body in enumerate(bodies, start=1)
        ]
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}

        def get_attributes(QueueUrl, AttributeNames):
            if AttributeNames == ['ApproximateNumberOfMessages']:
                return {'Attributes': {'ApproximateNumberOfMessages': '3'}}
            return {
                'Attributes': {
                    'QueueArn': (
                        'arn:aws:sqs:us-east-1:000000000000:'
                        'floci-lab-orders.fifo'
                    ),
                    'FifoQueue': 'true',
                    'ContentBasedDeduplication': 'false',
                },
            }

        sqs.get_queue_attributes.side_effect = get_attributes
        sqs.receive_message.return_value = {'Messages': messages}
        factory_mock.return_value.client.return_value = sqs

        from .labs import lab_status

        status = lab_status('sqs', 'fifo-ordering')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['send-duplicate']['verified'])
        self.assertTrue(status['steps']['inspect-message-count']['verified'])
        self.assertTrue(status['steps']['receive-ordered-messages']['verified'])
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_fifo_lab_reset_deletes_owned_queue(self, factory_mock):
        cache.clear()
        cache.set('floci-lab:sqs:fifo-ordering:deduplicated', True)
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-orders.fifo'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        factory_mock.return_value.client.return_value = sqs

        result = reset_lab('sqs', 'fifo-ordering')

        sqs.delete_queue.assert_called_once_with(QueueUrl=queue_url)
        self.assertTrue(result['deleted_queue'])
        self.assertIsNone(
            cache.get('floci-lab:sqs:fifo-ordering:deduplicated')
        )

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_cleanup_lab_creates_configured_tagged_queue(self, factory_mock):
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-cleanup'
        sqs.create_queue.return_value = {'QueueUrl': queue_url}
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.get_queue_attributes.return_value = {
            'Attributes': {
                'QueueArn': (
                    'arn:aws:sqs:us-east-1:000000000000:floci-lab-cleanup'
                ),
                'VisibilityTimeout': '45',
                'ApproximateNumberOfMessages': '0',
            },
        }
        sqs.list_queue_tags.return_value = {
            'Tags': {'Purpose': 'cleanup-training'},
        }
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step('sqs', 'purge-delete', 'create-queue')

        sqs.create_queue.assert_called_once_with(
            QueueName='floci-lab-cleanup',
            Attributes={'VisibilityTimeout': '45'},
            tags={'Purpose': 'cleanup-training'},
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_cleanup_lab_populates_three_messages(self, factory_mock):
        cache.clear()
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-cleanup'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.send_message_batch.return_value = {
            'Successful': [
                {'Id': f'cleanup-{number}'}
                for number in range(1, 4)
            ],
            'Failed': [],
        }
        sqs.get_queue_attributes.return_value = {
            'Attributes': {
                'QueueArn': (
                    'arn:aws:sqs:us-east-1:000000000000:floci-lab-cleanup'
                ),
                'VisibilityTimeout': '45',
                'ApproximateNumberOfMessages': '3',
            },
        }
        sqs.list_queue_tags.return_value = {
            'Tags': {'Purpose': 'cleanup-training'},
        }
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step(
            'sqs',
            'purge-delete',
            'send-message-batch',
        )

        entries = sqs.send_message_batch.call_args.kwargs['Entries']
        self.assertEqual(len(entries), 3)
        self.assertEqual(
            {entry['Id'] for entry in entries},
            {'cleanup-1', 'cleanup-2', 'cleanup-3'},
        )
        self.assertTrue(result['verified'])
        self.assertTrue(cache.get('floci-lab:sqs:purge-delete:populated'))
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_cleanup_lab_purges_messages_but_preserves_configuration(
        self,
        factory_mock,
    ):
        cache.clear()
        cache.set('floci-lab:sqs:purge-delete:populated', True)
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-cleanup'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.get_queue_attributes.return_value = {
            'Attributes': {
                'QueueArn': (
                    'arn:aws:sqs:us-east-1:000000000000:floci-lab-cleanup'
                ),
                'VisibilityTimeout': '45',
                'ApproximateNumberOfMessages': '0',
            },
        }
        sqs.list_queue_tags.return_value = {
            'Tags': {'Purpose': 'cleanup-training'},
        }
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step('sqs', 'purge-delete', 'purge-queue')

        sqs.purge_queue.assert_called_once_with(QueueUrl=queue_url)
        self.assertTrue(result['verified'])
        self.assertTrue(cache.get('floci-lab:sqs:purge-delete:purged'))
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_cleanup_lab_deletes_queue_and_verifies_absence(
        self,
        factory_mock,
    ):
        cache.clear()
        cache.set('floci-lab:sqs:purge-delete:purged', True)
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-cleanup'
        sqs.get_queue_url.side_effect = [
            {'QueueUrl': queue_url},
            ClientError(
                {
                    'Error': {
                        'Code': 'AWS.SimpleQueueService.NonExistentQueue',
                        'Message': 'missing',
                    },
                },
                'GetQueueUrl',
            ),
        ]
        factory_mock.return_value.client.return_value = sqs

        result = run_lab_step('sqs', 'purge-delete', 'delete-queue')

        sqs.delete_queue.assert_called_once_with(QueueUrl=queue_url)
        self.assertTrue(result['verified'])
        self.assertTrue(cache.get('floci-lab:sqs:purge-delete:deleted'))
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_cleanup_lab_status_completes_after_queue_is_absent(
        self,
        factory_mock,
    ):
        cache.clear()
        cache.set('floci-lab:sqs:purge-delete:populated', True)
        cache.set('floci-lab:sqs:purge-delete:purged', True)
        cache.set('floci-lab:sqs:purge-delete:deleted', True)
        sqs = MagicMock()
        sqs.get_queue_url.side_effect = ClientError(
            {
                'Error': {
                    'Code': 'AWS.SimpleQueueService.NonExistentQueue',
                    'Message': 'missing',
                },
            },
            'GetQueueUrl',
        )
        factory_mock.return_value.client.return_value = sqs

        from .labs import lab_status

        status = lab_status('sqs', 'purge-delete')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['purge-queue']['verified'])
        self.assertTrue(status['steps']['delete-queue']['verified'])
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_sqs_cleanup_lab_reset_deletes_queue_and_clears_markers(
        self,
        factory_mock,
    ):
        cache.clear()
        cache.set('floci-lab:sqs:purge-delete:populated', True)
        sqs = MagicMock()
        queue_url = 'http://localhost:4566/000000000000/floci-lab-cleanup'
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        factory_mock.return_value.client.return_value = sqs

        result = reset_lab('sqs', 'purge-delete')

        sqs.delete_queue.assert_called_once_with(QueueUrl=queue_url)
        self.assertTrue(result['deleted_queue'])
        self.assertIsNone(cache.get('floci-lab:sqs:purge-delete:populated'))

    @patch('dashboard.labs.FlociClientFactory')
    def test_sns_fanout_lab_creates_topic_and_queue_policy(self, factory_mock):
        sns = MagicMock()
        sqs = MagicMock()
        orders_url = (
            'http://localhost:4566/000000000000/floci-lab-order-processing'
        )
        topic_arn = (
            'arn:aws:sns:us-east-1:000000000000:floci-lab-order-events'
        )
        orders_arn = (
            'arn:aws:sqs:us-east-1:000000000000:floci-lab-order-processing'
        )
        sns.create_topic.return_value = {'TopicArn': topic_arn}
        sns.get_topic_attributes.return_value = {
            'Attributes': {'TopicArn': topic_arn},
        }
        sqs.get_queue_url.return_value = {'QueueUrl': orders_url}
        expected_policy = {
            'Version': '2012-10-17',
            'Statement': [{
                'Sid': 'AllowOrderTopicDelivery',
                'Effect': 'Allow',
                'Principal': {'Service': 'sns.amazonaws.com'},
                'Action': 'sqs:SendMessage',
                'Resource': orders_arn,
                'Condition': {'ArnEquals': {'aws:SourceArn': topic_arn}},
            }],
        }
        sqs.get_queue_attributes.return_value = {
            'Attributes': {'Policy': json.dumps(expected_policy)},
        }
        factory_mock.return_value.client.side_effect = (
            lambda service: sns if service == 'sns' else sqs
        )

        topic_result = run_lab_step('sns', 'sqs-fanout', 'create-topic')
        policy_result = run_lab_step(
            'sns',
            'sqs-fanout',
            'set-orders-queue-policy',
        )

        self.assertTrue(topic_result['verified'])
        self.assertTrue(policy_result['verified'])
        sqs.set_queue_attributes.assert_called_once_with(
            QueueUrl=orders_url,
            Attributes={'Policy': json.dumps(expected_policy)},
        )

    @patch('dashboard.labs.FlociClientFactory')
    def test_sns_fanout_lab_subscribes_queue_with_raw_delivery(
        self,
        factory_mock,
    ):
        sns = MagicMock()
        sqs = MagicMock()
        topic_arn = (
            'arn:aws:sns:us-east-1:000000000000:floci-lab-order-events'
        )
        orders_arn = (
            'arn:aws:sqs:us-east-1:000000000000:floci-lab-order-processing'
        )
        subscription_arn = f'{topic_arn}:subscription-1'
        sns.subscribe.return_value = {'SubscriptionArn': subscription_arn}
        sns.list_subscriptions_by_topic.return_value = {
            'Subscriptions': [{
                'SubscriptionArn': subscription_arn,
                'Protocol': 'sqs',
                'Endpoint': orders_arn,
                'TopicArn': topic_arn,
            }],
        }
        sns.get_subscription_attributes.return_value = {
            'Attributes': {'RawMessageDelivery': 'true'},
        }
        factory_mock.return_value.client.side_effect = (
            lambda service: sns if service == 'sns' else sqs
        )

        result = run_lab_step(
            'sns',
            'sqs-fanout',
            'subscribe-orders-queue',
        )

        sns.subscribe.assert_called_once_with(
            TopicArn=topic_arn,
            Protocol='sqs',
            Endpoint=orders_arn,
            Attributes={'RawMessageDelivery': 'true'},
            ReturnSubscriptionArn=True,
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sns_fanout_lab_publish_delivers_to_both_queues(
        self,
        factory_mock,
    ):
        sns = MagicMock()
        sqs = MagicMock()
        topic_arn = (
            'arn:aws:sns:us-east-1:000000000000:floci-lab-order-events'
        )
        urls = {
            'floci-lab-order-processing': (
                'http://localhost:4566/000000000000/floci-lab-order-processing'
            ),
            'floci-lab-order-audit': (
                'http://localhost:4566/000000000000/floci-lab-order-audit'
            ),
        }
        message = {
            'MessageId': 'fanout-copy',
            'Body': '{"event":"order.created","order_id":"FLOCI-FANOUT-1001"}',
            'MessageAttributes': {
                'EventType': {
                    'DataType': 'String',
                    'StringValue': 'order.created',
                },
                'Environment': {
                    'DataType': 'String',
                    'StringValue': 'lab',
                },
            },
        }
        sns.publish.return_value = {'MessageId': 'sns-message'}
        sqs.get_queue_url.side_effect = lambda QueueName: {
            'QueueUrl': urls[QueueName],
        }
        sqs.receive_message.return_value = {'Messages': [message]}
        factory_mock.return_value.client.side_effect = (
            lambda service: sns if service == 'sns' else sqs
        )

        result = run_lab_step('sns', 'sqs-fanout', 'publish-message')

        sns.publish.assert_called_once_with(
            TopicArn=topic_arn,
            Message='{"event":"order.created","order_id":"FLOCI-FANOUT-1001"}',
            Subject='Order created',
            MessageAttributes={
                'EventType': {
                    'DataType': 'String',
                    'StringValue': 'order.created',
                },
                'Environment': {
                    'DataType': 'String',
                    'StringValue': 'lab',
                },
            },
        )
        self.assertEqual(sqs.receive_message.call_count, 2)
        self.assertTrue(result['verified'])

    def test_sns_fanout_lab_status_requires_both_subscriptions_and_deliveries(
        self,
    ):
        passed = {'status': 'passed', 'message': 'verified'}
        with ExitStack() as stack:
            stack.enter_context(patch(
                'dashboard.labs._verify_sns_fanout_topic',
                return_value=passed,
            ))
            stack.enter_context(patch(
                'dashboard.labs._verify_sns_fanout_queue',
                return_value=passed,
            ))
            stack.enter_context(patch(
                'dashboard.labs._verify_sns_fanout_queue_policy',
                return_value=passed,
            ))
            stack.enter_context(patch(
                'dashboard.labs._verify_sns_fanout_subscription',
                return_value=passed,
            ))
            stack.enter_context(patch(
                'dashboard.labs._verify_sns_fanout_delivery',
                return_value=passed,
            ))
            from .labs import lab_status

            status = lab_status('sns', 'sqs-fanout')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['list-subscriptions']['verified'])
        self.assertTrue(status['steps']['publish-message']['verified'])
        self.assertTrue(status['steps']['receive-orders-copy']['verified'])
        self.assertTrue(status['steps']['receive-audit-copy']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sns_fanout_lab_reset_removes_subscriptions_topic_and_queues(
        self,
        factory_mock,
    ):
        sns = MagicMock()
        sqs = MagicMock()
        topic_arn = (
            'arn:aws:sns:us-east-1:000000000000:floci-lab-order-events'
        )
        subscription_arns = [
            f'{topic_arn}:subscription-{number}'
            for number in (1, 2)
        ]
        sns.list_subscriptions_by_topic.return_value = {
            'Subscriptions': [
                {'SubscriptionArn': arn}
                for arn in subscription_arns
            ],
        }
        urls = {
            'floci-lab-order-processing': (
                'http://localhost:4566/000000000000/floci-lab-order-processing'
            ),
            'floci-lab-order-audit': (
                'http://localhost:4566/000000000000/floci-lab-order-audit'
            ),
        }
        sqs.get_queue_url.side_effect = lambda QueueName: {
            'QueueUrl': urls[QueueName],
        }
        factory_mock.return_value.client.side_effect = (
            lambda service: sns if service == 'sns' else sqs
        )

        result = reset_lab('sns', 'sqs-fanout')

        self.assertEqual(sns.unsubscribe.call_count, 2)
        sns.delete_topic.assert_called_once_with(TopicArn=topic_arn)
        self.assertEqual(sqs.delete_queue.call_count, 2)
        self.assertEqual(result['unsubscribed'], 2)
        self.assertTrue(result['deleted_topic'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sns_filter_lab_subscribes_with_attribute_filter(
        self,
        factory_mock,
    ):
        sns = MagicMock()
        sqs = MagicMock()
        topic_arn = (
            'arn:aws:sns:us-east-1:000000000000:floci-lab-filtered-events'
        )
        queue_arn = (
            'arn:aws:sqs:us-east-1:000000000000:floci-lab-created-events'
        )
        subscription_arn = f'{topic_arn}:subscription-1'
        sns.subscribe.return_value = {'SubscriptionArn': subscription_arn}
        sns.list_subscriptions_by_topic.return_value = {
            'Subscriptions': [{
                'SubscriptionArn': subscription_arn,
                'Protocol': 'sqs',
                'Endpoint': queue_arn,
            }],
        }
        sns.get_subscription_attributes.return_value = {
            'Attributes': {
                'RawMessageDelivery': 'true',
                'FilterPolicyScope': 'MessageAttributes',
                'FilterPolicy': json.dumps({
                    'EventType': ['order.created'],
                }),
            },
        }
        factory_mock.return_value.client.side_effect = (
            lambda service: sns if service == 'sns' else sqs
        )

        result = run_lab_step(
            'sns',
            'filter-policies',
            'subscribe-created-filter',
        )

        sns.subscribe.assert_called_once_with(
            TopicArn=topic_arn,
            Protocol='sqs',
            Endpoint=queue_arn,
            Attributes={
                'RawMessageDelivery': 'true',
                'FilterPolicyScope': 'MessageAttributes',
                'FilterPolicy': json.dumps({
                    'EventType': ['order.created'],
                }),
            },
            ReturnSubscriptionArn=True,
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sns_filter_lab_publishes_two_attributed_events(
        self,
        factory_mock,
    ):
        sns = MagicMock()
        sqs = MagicMock()
        sns.publish.side_effect = [
            {'MessageId': 'created-message'},
            {'MessageId': 'priority-message'},
        ]
        factory_mock.return_value.client.side_effect = (
            lambda service: sns if service == 'sns' else sqs
        )

        created = run_lab_step(
            'sns',
            'filter-policies',
            'publish-created-event',
        )
        priority = run_lab_step(
            'sns',
            'filter-policies',
            'publish-priority-event',
        )

        self.assertTrue(created['verified'])
        self.assertTrue(priority['verified'])
        first = sns.publish.call_args_list[0].kwargs
        second = sns.publish.call_args_list[1].kwargs
        self.assertEqual(
            first['MessageAttributes']['EventType']['StringValue'],
            'order.created',
        )
        self.assertEqual(
            second['MessageAttributes']['Priority']['StringValue'],
            'high',
        )

    @patch('dashboard.labs.FlociClientFactory')
    def test_sns_filter_lab_created_queue_excludes_priority_event(
        self,
        factory_mock,
    ):
        sns = MagicMock()
        sqs = MagicMock()
        queue_url = (
            'http://localhost:4566/000000000000/floci-lab-created-events'
        )
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {
            'Messages': [{
                'Body': (
                    '{"event":"order.created",'
                    '"order_id":"FLOCI-FILTER-1001"}'
                ),
            }],
        }
        factory_mock.return_value.client.side_effect = (
            lambda service: sns if service == 'sns' else sqs
        )

        result = run_lab_step(
            'sns',
            'filter-policies',
            'receive-created-route',
        )

        self.assertTrue(result['verified'])
        self.assertEqual(len(result['json']['Messages']), 1)

    def test_sns_filter_lab_status_requires_both_exact_routes(self):
        passed = {'status': 'passed', 'message': 'verified'}
        with ExitStack() as stack:
            stack.enter_context(patch(
                'dashboard.labs._verify_sns_filter_topic',
                return_value=passed,
            ))
            stack.enter_context(patch(
                'dashboard.labs._verify_sns_filter_queue',
                return_value=passed,
            ))
            stack.enter_context(patch(
                'dashboard.labs._verify_sns_filter_queue_policy',
                return_value=passed,
            ))
            stack.enter_context(patch(
                'dashboard.labs._verify_sns_filter_subscription',
                return_value=passed,
            ))
            stack.enter_context(patch(
                'dashboard.labs._verify_sns_filter_route',
                return_value=passed,
            ))
            from .labs import lab_status

            status = lab_status('sns', 'filter-policies')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['inspect-filter-policies']['verified'])
        self.assertTrue(status['steps']['receive-created-route']['verified'])
        self.assertTrue(status['steps']['receive-priority-route']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_sns_filter_lab_reset_removes_topic_subscriptions_and_queues(
        self,
        factory_mock,
    ):
        sns = MagicMock()
        sqs = MagicMock()
        topic_arn = (
            'arn:aws:sns:us-east-1:000000000000:floci-lab-filtered-events'
        )
        sns.list_subscriptions_by_topic.return_value = {
            'Subscriptions': [
                {'SubscriptionArn': f'{topic_arn}:subscription-{number}'}
                for number in (1, 2)
            ],
        }
        urls = {
            'floci-lab-created-events': (
                'http://localhost:4566/000000000000/floci-lab-created-events'
            ),
            'floci-lab-priority-events': (
                'http://localhost:4566/000000000000/floci-lab-priority-events'
            ),
        }
        sqs.get_queue_url.side_effect = lambda QueueName: {
            'QueueUrl': urls[QueueName],
        }
        factory_mock.return_value.client.side_effect = (
            lambda service: sns if service == 'sns' else sqs
        )

        result = reset_lab('sns', 'filter-policies')

        self.assertEqual(sns.unsubscribe.call_count, 2)
        sns.delete_topic.assert_called_once_with(TopicArn=topic_arn)
        self.assertEqual(sqs.delete_queue.call_count, 2)
        self.assertEqual(result['unsubscribed'], 2)

    @patch('dashboard.labs._verify_scheduler_role')
    @patch('dashboard.labs.FlociClientFactory')
    def test_scheduler_lab_creates_trusted_scoped_role(
        self,
        factory_mock,
        verify_role_mock,
    ):
        iam = MagicMock()
        sqs = MagicMock()
        scheduler = MagicMock()
        verify_role_mock.return_value = {'status': 'passed', 'message': 'verified'}
        factory_mock.return_value.client.side_effect = (
            lambda service: (
                iam if service == 'iam'
                else sqs if service == 'sqs'
                else scheduler
            )
        )

        role_result = run_lab_step('scheduler', 'sqs-delivery', 'create-role')

        iam.create_role.assert_called_once()
        role_call = iam.create_role.call_args.kwargs
        self.assertEqual(role_call['RoleName'], 'FlociSchedulerSqsRole')
        self.assertIn(
            'scheduler.amazonaws.com',
            role_call['AssumeRolePolicyDocument'],
        )
        self.assertTrue(role_result['verified'])

    @patch('dashboard.labs._verify_scheduler_role_policy')
    @patch('dashboard.labs.FlociClientFactory')
    def test_scheduler_lab_adds_sqs_send_permission(
        self,
        factory_mock,
        verify_policy_mock,
    ):
        iam = MagicMock()
        verify_policy_mock.return_value = {
            'status': 'passed',
            'message': 'verified',
        }
        factory_mock.return_value.client.return_value = iam

        result = run_lab_step(
            'scheduler',
            'sqs-delivery',
            'put-role-policy',
        )

        call = iam.put_role_policy.call_args.kwargs
        self.assertEqual(call['RoleName'], 'FlociSchedulerSqsRole')
        self.assertEqual(call['PolicyName'], 'SendScheduledReportToSqs')
        self.assertIn('sqs:SendMessage', call['PolicyDocument'])
        self.assertIn('floci-lab-scheduled-reports', call['PolicyDocument'])
        self.assertTrue(result['verified'])

    @patch('dashboard.labs._verify_scheduler_schedule')
    @patch('dashboard.labs.FlociClientFactory')
    def test_scheduler_lab_creates_one_time_auto_delete_schedule(
        self,
        factory_mock,
        verify_schedule_mock,
    ):
        cache.clear()
        scheduler = MagicMock()
        scheduler.create_schedule.return_value = {
            'ScheduleArn': (
                'arn:aws:scheduler:us-east-1:000000000000:schedule/'
                'floci-lab-scheduler/send-report-ready'
            ),
        }
        verify_schedule_mock.return_value = {
            'status': 'passed',
            'message': 'verified',
        }
        factory_mock.return_value.client.return_value = scheduler

        result = run_lab_step(
            'scheduler',
            'sqs-delivery',
            'create-schedule',
        )

        call = scheduler.create_schedule.call_args.kwargs
        self.assertTrue(call['ScheduleExpression'].startswith('at('))
        self.assertEqual(call['FlexibleTimeWindow'], {'Mode': 'OFF'})
        self.assertEqual(call['ActionAfterCompletion'], 'DELETE')
        self.assertEqual(
            call['Target']['Arn'],
            'arn:aws:sqs:us-east-1:000000000000:floci-lab-scheduled-reports',
        )
        self.assertEqual(
            call['Target']['RoleArn'],
            'arn:aws:iam::000000000000:role/FlociSchedulerSqsRole',
        )
        self.assertTrue(result['verified'])
        self.assertTrue(cache.get('floci-lab:scheduler:sqs-delivery:created'))
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_scheduler_lab_receives_scheduled_message(self, factory_mock):
        cache.clear()
        sqs = MagicMock()
        scheduler = MagicMock()
        iam = MagicMock()
        queue_url = (
            'http://localhost:4566/000000000000/'
            'floci-lab-scheduled-reports'
        )
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        sqs.receive_message.return_value = {
            'Messages': [{
                'MessageId': 'scheduled-message',
                'Body': (
                    '{"event":"report.ready",'
                    '"report_id":"FLOCI-SCHEDULE-1001"}'
                ),
            }],
        }
        factory_mock.return_value.client.side_effect = (
            lambda service: (
                iam if service == 'iam'
                else sqs if service == 'sqs'
                else scheduler
            )
        )

        result = run_lab_step(
            'scheduler',
            'sqs-delivery',
            'receive-scheduled-message',
        )

        self.assertTrue(result['verified'])
        self.assertTrue(
            cache.get('floci-lab:scheduler:sqs-delivery:delivered')
        )
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_scheduler_lab_confirms_automatic_schedule_deletion(
        self,
        factory_mock,
    ):
        cache.clear()
        scheduler = MagicMock()
        scheduler.get_schedule.side_effect = ClientError(
            {
                'Error': {
                    'Code': 'ResourceNotFoundException',
                    'Message': 'missing',
                },
            },
            'GetSchedule',
        )
        factory_mock.return_value.client.return_value = scheduler

        result = run_lab_step(
            'scheduler',
            'sqs-delivery',
            'confirm-schedule-deleted',
        )

        self.assertTrue(result['verified'])
        self.assertTrue(cache.get('floci-lab:scheduler:sqs-delivery:deleted'))
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_scheduler_lab_reset_removes_dependencies_in_order(
        self,
        factory_mock,
    ):
        cache.clear()
        iam = MagicMock()
        sqs = MagicMock()
        scheduler = MagicMock()
        queue_url = (
            'http://localhost:4566/000000000000/'
            'floci-lab-scheduled-reports'
        )
        sqs.get_queue_url.return_value = {'QueueUrl': queue_url}
        factory_mock.return_value.client.side_effect = (
            lambda service: (
                iam if service == 'iam'
                else sqs if service == 'sqs'
                else scheduler
            )
        )

        result = reset_lab('scheduler', 'sqs-delivery')

        scheduler.delete_schedule.assert_called_once()
        scheduler.delete_schedule_group.assert_called_once()
        iam.delete_role_policy.assert_called_once()
        iam.delete_role.assert_called_once()
        sqs.delete_queue.assert_called_once_with(QueueUrl=queue_url)
        self.assertTrue(result['deleted_schedule'])
        self.assertTrue(result['deleted_group'])
        self.assertTrue(result['deleted_role'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_cloudformation_lab_validates_template(self, factory_mock):
        cloudformation = MagicMock()
        cloudformation.validate_template.return_value = {
            'Parameters': [],
            'Capabilities': [],
        }
        factory_mock.return_value.client.return_value = cloudformation

        result = run_lab_step(
            'cloudformation',
            's3-sqs-stack',
            'validate-template',
        )

        call = cloudformation.validate_template.call_args.kwargs
        template = json.loads(call['TemplateBody'])
        self.assertEqual(
            template['Resources']['StorageBucket']['Type'],
            'AWS::S3::Bucket',
        )
        self.assertEqual(
            template['Resources']['JobsQueue']['Type'],
            'AWS::SQS::Queue',
        )
        self.assertTrue(result['verified'])

    @patch('dashboard.labs._verify_cloudformation_stack')
    @patch('dashboard.labs._wait_for_cloudformation_status')
    @patch('dashboard.labs.FlociClientFactory')
    def test_cloudformation_lab_creates_stack_and_waits_for_completion(
        self,
        factory_mock,
        wait_mock,
        verify_mock,
    ):
        cache.clear()
        cloudformation = MagicMock()
        cloudformation.create_stack.return_value = {'StackId': 'stack-id'}
        wait_mock.return_value = {
            'StackName': 'floci-lab-storage-messaging',
            'StackStatus': 'CREATE_COMPLETE',
        }
        verify_mock.return_value = {'status': 'passed', 'message': 'verified'}
        factory_mock.return_value.client.return_value = cloudformation

        result = run_lab_step(
            'cloudformation',
            's3-sqs-stack',
            'create-stack',
        )

        cloudformation.create_stack.assert_called_once()
        call = cloudformation.create_stack.call_args.kwargs
        self.assertEqual(call['StackName'], 'floci-lab-storage-messaging')
        self.assertIn('floci-lab-cfn-storage', call['TemplateBody'])
        self.assertTrue(result['verified'])
        self.assertTrue(
            cache.get('floci-lab:cloudformation:s3-sqs:created')
        )
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_cloudformation_lab_maps_logical_to_physical_resources(
        self,
        factory_mock,
    ):
        cloudformation = MagicMock()
        resources = [
            {
                'LogicalResourceId': 'StorageBucket',
                'PhysicalResourceId': 'floci-lab-cfn-storage',
                'ResourceType': 'AWS::S3::Bucket',
                'ResourceStatus': 'CREATE_COMPLETE',
            },
            {
                'LogicalResourceId': 'JobsQueue',
                'PhysicalResourceId': (
                    'http://localhost:4566/000000000000/floci-lab-cfn-jobs'
                ),
                'ResourceType': 'AWS::SQS::Queue',
                'ResourceStatus': 'CREATE_COMPLETE',
            },
        ]
        cloudformation.describe_stack_resources.return_value = {
            'StackResources': resources,
        }
        factory_mock.return_value.client.return_value = cloudformation

        result = run_lab_step(
            'cloudformation',
            's3-sqs-stack',
            'describe-stack-resources',
        )

        self.assertTrue(result['verified'])
        self.assertEqual(len(result['json']['StackResources']), 2)

    @patch('dashboard.labs._verify_cloudformation_deleted')
    @patch('dashboard.labs.FlociClientFactory')
    def test_cloudformation_lab_deletes_stack_after_inspection(
        self,
        factory_mock,
        verify_deleted_mock,
    ):
        cache.clear()
        cache.set('floci-lab:cloudformation:s3-sqs:inspected', True)
        cloudformation = MagicMock()
        cloudformation.describe_stacks.side_effect = ClientError(
            {
                'Error': {
                    'Code': 'ValidationError',
                    'Message': 'missing',
                },
            },
            'DescribeStacks',
        )
        verify_deleted_mock.return_value = {
            'status': 'passed',
            'message': 'deleted',
        }
        factory_mock.return_value.client.return_value = cloudformation

        result = run_lab_step(
            'cloudformation',
            's3-sqs-stack',
            'delete-stack',
        )

        cloudformation.delete_stack.assert_called_once_with(
            StackName='floci-lab-storage-messaging',
        )
        self.assertTrue(result['verified'])
        self.assertTrue(
            cache.get('floci-lab:cloudformation:s3-sqs:deleted')
        )
        cache.clear()

    def test_cloudformation_lab_status_completes_after_owned_resources_deleted(
        self,
    ):
        cache.clear()
        cache.set('floci-lab:cloudformation:s3-sqs:created', True)
        cache.set('floci-lab:cloudformation:s3-sqs:inspected', True)
        with patch(
            'dashboard.labs._verify_cloudformation_deleted',
            return_value={'status': 'passed', 'message': 'deleted'},
        ):
            from .labs import lab_status

            status = lab_status('cloudformation', 's3-sqs-stack')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['describe-stack-events']['verified'])
        self.assertTrue(status['steps']['confirm-resources-deleted']['verified'])
        cache.clear()

    @patch('dashboard.labs._verify_ec2_vpc')
    @patch('dashboard.labs.FlociClientFactory')
    def test_ec2_network_lab_creates_tagged_vpc(
        self,
        factory_mock,
        verify_vpc_mock,
    ):
        cache.clear()
        ec2 = MagicMock()
        ec2.create_vpc.return_value = {
            'Vpc': {
                'VpcId': 'vpc-lab',
                'CidrBlock': '10.42.0.0/16',
            },
        }
        verify_vpc_mock.return_value = {'status': 'passed', 'message': 'verified'}
        factory_mock.return_value.client.return_value = ec2

        result = run_lab_step('ec2', 'vpc-public-private', 'create-vpc')

        call = ec2.create_vpc.call_args.kwargs
        self.assertEqual(call['CidrBlock'], '10.42.0.0/16')
        self.assertEqual(
            call['TagSpecifications'][0]['Tags'][1],
            {'Key': 'Lab', 'Value': 'vpc-public-private'},
        )
        self.assertTrue(result['verified'])
        self.assertEqual(
            cache.get('floci-lab:ec2:vpc-networking:vpc-id'),
            'vpc-lab',
        )
        cache.clear()

    @patch('dashboard.labs._verify_ec2_routes')
    @patch('dashboard.labs.FlociClientFactory')
    def test_ec2_network_lab_creates_public_default_route(
        self,
        factory_mock,
        verify_routes_mock,
    ):
        cache.clear()
        cache.set('floci-lab:ec2:vpc-networking:public-rt-id', 'rtb-public')
        cache.set('floci-lab:ec2:vpc-networking:igw-id', 'igw-lab')
        ec2 = MagicMock()
        ec2.create_route.return_value = {'Return': True}
        verify_routes_mock.return_value = (
            {'status': 'passed', 'message': 'public'},
            {'status': 'failed', 'message': 'private'},
        )
        factory_mock.return_value.client.return_value = ec2

        result = run_lab_step(
            'ec2',
            'vpc-public-private',
            'create-internet-route',
        )

        ec2.create_route.assert_called_once_with(
            RouteTableId='rtb-public',
            DestinationCidrBlock='0.0.0.0/0',
            GatewayId='igw-lab',
        )
        self.assertTrue(result['verified'])
        cache.clear()

    @patch('dashboard.labs._verify_ec2_routes')
    @patch('dashboard.labs.FlociClientFactory')
    def test_ec2_network_lab_associates_private_route_table(
        self,
        factory_mock,
        verify_routes_mock,
    ):
        cache.clear()
        cache.set('floci-lab:ec2:vpc-networking:private-rt-id', 'rtb-private')
        cache.set(
            'floci-lab:ec2:vpc-networking:private-subnet-id',
            'subnet-private',
        )
        ec2 = MagicMock()
        ec2.associate_route_table.return_value = {
            'AssociationId': 'rtbassoc-private',
        }
        verify_routes_mock.return_value = (
            {'status': 'failed', 'message': 'public'},
            {'status': 'passed', 'message': 'private'},
        )
        factory_mock.return_value.client.return_value = ec2

        result = run_lab_step(
            'ec2',
            'vpc-public-private',
            'associate-private-route-table',
        )

        ec2.associate_route_table.assert_called_once_with(
            RouteTableId='rtb-private',
            SubnetId='subnet-private',
        )
        self.assertTrue(result['verified'])
        cache.clear()

    def test_ec2_network_lab_status_requires_public_and_private_routes(self):
        passed = {'status': 'passed', 'message': 'verified'}
        with ExitStack() as stack:
            stack.enter_context(patch(
                'dashboard.labs._verify_ec2_vpc',
                return_value=passed,
            ))
            stack.enter_context(patch(
                'dashboard.labs._verify_ec2_subnets',
                return_value=(passed, passed),
            ))
            stack.enter_context(patch(
                'dashboard.labs._verify_ec2_igw',
                return_value=passed,
            ))
            stack.enter_context(patch(
                'dashboard.labs._verify_ec2_routes',
                return_value=(passed, passed),
            ))
            from .labs import lab_status

            status = lab_status('ec2', 'vpc-public-private')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['create-internet-route']['verified'])
        self.assertTrue(status['steps']['associate-private-route-table']['verified'])
        self.assertTrue(status['steps']['inspect-network-topology']['verified'])

    @patch('dashboard.labs.FlociClientFactory')
    def test_ec2_security_lab_allows_trusted_https(self, factory_mock):
        cache.clear()
        cache.set('floci-lab:ec2:security-controls:web-sg-id', 'sg-web')
        ec2 = MagicMock()
        ec2.authorize_security_group_ingress.return_value = {'Return': True}
        factory_mock.return_value.client.return_value = ec2
        with patch(
            'dashboard.labs._verify_ec2_security_group_rules',
            return_value=(
                {'status': 'passed', 'message': 'web'},
                {'status': 'failed', 'message': 'app'},
            ),
        ):
            result = run_lab_step(
                'ec2',
                'security-controls',
                'allow-trusted-https',
            )

        call = ec2.authorize_security_group_ingress.call_args.kwargs
        self.assertEqual(call['GroupId'], 'sg-web')
        permission = call['IpPermissions'][0]
        self.assertEqual(permission['FromPort'], 443)
        self.assertEqual(
            permission['IpRanges'][0]['CidrIp'],
            '203.0.113.0/24',
        )
        self.assertTrue(result['verified'])
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_ec2_security_lab_references_web_group_from_app_group(
        self,
        factory_mock,
    ):
        cache.clear()
        cache.set('floci-lab:ec2:security-controls:web-sg-id', 'sg-web')
        cache.set('floci-lab:ec2:security-controls:app-sg-id', 'sg-app')
        ec2 = MagicMock()
        ec2.authorize_security_group_ingress.return_value = {'Return': True}
        factory_mock.return_value.client.return_value = ec2
        with patch(
            'dashboard.labs._verify_ec2_security_group_rules',
            return_value=(
                {'status': 'passed', 'message': 'web'},
                {'status': 'passed', 'message': 'app'},
            ),
        ):
            result = run_lab_step(
                'ec2',
                'security-controls',
                'allow-web-to-app',
            )

        call = ec2.authorize_security_group_ingress.call_args.kwargs
        self.assertEqual(call['GroupId'], 'sg-app')
        permission = call['IpPermissions'][0]
        self.assertEqual(permission['FromPort'], 8080)
        self.assertEqual(
            permission['UserIdGroupPairs'][0]['GroupId'],
            'sg-web',
        )
        self.assertTrue(result['verified'])
        cache.clear()

    @patch('dashboard.labs.FlociClientFactory')
    def test_ec2_security_lab_records_network_acl_support_boundary(
        self,
        factory_mock,
    ):
        cache.clear()
        cache.set('floci-lab:ec2:security-controls:vpc-id', 'vpc-security')
        ec2 = MagicMock()
        ec2.describe_network_acls.side_effect = ClientError(
            {
                'Error': {
                    'Code': 'UnsupportedOperation',
                    'Message': 'not supported',
                },
            },
            'DescribeNetworkAcls',
        )
        factory_mock.return_value.client.return_value = ec2

        result = run_lab_step(
            'ec2',
            'security-controls',
            'inspect-network-acl-support',
        )

        self.assertTrue(result['verified'])
        self.assertEqual(result['json']['Error']['Code'], 'UnsupportedOperation')
        self.assertTrue(
            cache.get('floci-lab:ec2:security-controls:nacl-boundary')
        )
        cache.clear()

    def test_ec2_security_lab_status_requires_groups_and_nacl_boundary(self):
        passed = {'status': 'passed', 'message': 'verified'}
        with ExitStack() as stack:
            stack.enter_context(patch(
                'dashboard.labs._verify_ec2_security_vpc',
                return_value=passed,
            ))
            stack.enter_context(patch(
                'dashboard.labs._verify_ec2_security_subnet',
                return_value=passed,
            ))
            stack.enter_context(patch(
                'dashboard.labs._verify_ec2_security_group_rules',
                return_value=(passed, passed),
            ))
            stack.enter_context(patch(
                'dashboard.labs._verify_ec2_nacl_boundary',
                return_value=passed,
            ))
            from .labs import lab_status

            status = lab_status('ec2', 'security-controls')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['allow-trusted-https']['verified'])
        self.assertTrue(status['steps']['allow-web-to-app']['verified'])
        self.assertTrue(status['steps']['inspect-network-acl-support']['verified'])

    @patch('dashboard.labs._verify_ec2_s3_gateway_endpoint')
    @patch('dashboard.labs.FlociClientFactory')
    def test_ec2_endpoint_lab_creates_bucket_scoped_s3_gateway_endpoint(
        self,
        factory_mock,
        verify_endpoint_mock,
    ):
        cache.clear()
        cache.set('floci-lab:ec2:s3-endpoint:vpc-id', 'vpc-private')
        cache.set('floci-lab:ec2:s3-endpoint:route-table-id', 'rtb-private')
        ec2 = MagicMock()
        ec2.meta.region_name = 'us-east-1'
        ec2.create_vpc_endpoint.return_value = {
            'VpcEndpoint': {'VpcEndpointId': 'vpce-s3'},
        }
        factory_mock.return_value.client.return_value = ec2
        verify_endpoint_mock.return_value = {
            'status': 'passed',
            'message': 'verified',
        }

        result = run_lab_step(
            'ec2',
            's3-gateway-endpoint',
            'create-s3-gateway-endpoint',
        )

        call = ec2.create_vpc_endpoint.call_args.kwargs
        self.assertEqual(call['VpcId'], 'vpc-private')
        self.assertEqual(call['VpcEndpointType'], 'Gateway')
        self.assertEqual(call['ServiceName'], 'com.amazonaws.us-east-1.s3')
        self.assertEqual(call['RouteTableIds'], ['rtb-private'])
        policy = json.loads(call['PolicyDocument'])
        self.assertEqual(
            policy['Statement'][0]['Resource'][0],
            'arn:aws:s3:::floci-lab-private-s3-data',
        )
        self.assertTrue(result['verified'])
        cache.clear()

    def test_ec2_endpoint_lab_status_requires_private_path_and_boundary(self):
        passed = {'status': 'passed', 'message': 'verified'}
        with ExitStack() as stack:
            for verifier in (
                '_verify_ec2_endpoint_vpc',
                '_verify_ec2_endpoint_subnet',
                '_verify_ec2_endpoint_route_table',
                '_verify_ec2_endpoint_bucket',
                '_verify_ec2_s3_gateway_endpoint',
                '_verify_ec2_endpoint_route_boundary',
            ):
                stack.enter_context(patch(
                    f'dashboard.labs.{verifier}',
                    return_value=passed,
                ))
            from .labs import lab_status

            status = lab_status('ec2', 's3-gateway-endpoint')

        self.assertTrue(status['complete'])
        self.assertTrue(
            status['steps']['create-s3-gateway-endpoint']['verified']
        )
        self.assertTrue(status['steps']['inspect-private-s3-path']['verified'])

    @patch('dashboard.labs._verify_ec2_sqs_interface_endpoint')
    @patch('dashboard.labs.FlociClientFactory')
    def test_ec2_interface_lab_creates_private_dns_sqs_endpoint(
        self,
        factory_mock,
        verify_endpoint_mock,
    ):
        cache.clear()
        cache.set('floci-lab:ec2:sqs-interface:vpc-id', 'vpc-private')
        cache.set('floci-lab:ec2:sqs-interface:subnet-id', 'subnet-private')
        cache.set('floci-lab:ec2:sqs-interface:sg-id', 'sg-endpoint')
        ec2 = MagicMock()
        ec2.meta.region_name = 'us-east-1'
        ec2.create_vpc_endpoint.return_value = {
            'VpcEndpoint': {'VpcEndpointId': 'vpce-sqs'},
        }
        factory_mock.return_value.client.return_value = ec2
        verify_endpoint_mock.return_value = {
            'status': 'passed',
            'message': 'verified',
        }

        result = run_lab_step(
            'ec2',
            'sqs-interface-endpoint',
            'create-sqs-interface-endpoint',
        )

        call = ec2.create_vpc_endpoint.call_args.kwargs
        self.assertEqual(call['VpcEndpointType'], 'Interface')
        self.assertEqual(call['ServiceName'], 'com.amazonaws.us-east-1.sqs')
        self.assertEqual(call['SubnetIds'], ['subnet-private'])
        self.assertEqual(call['SecurityGroupIds'], ['sg-endpoint'])
        self.assertTrue(call['PrivateDnsEnabled'])
        policy = json.loads(call['PolicyDocument'])
        self.assertEqual(
            policy['Statement'][0]['Resource'],
            'arn:aws:sqs:us-east-1:000000000000:floci-lab-private-sqs',
        )
        self.assertTrue(result['verified'])
        cache.clear()

    def test_ec2_interface_lab_status_requires_endpoint_topology(self):
        passed = {'status': 'passed', 'message': 'verified'}
        with ExitStack() as stack:
            for verifier in (
                '_verify_ec2_interface_vpc',
                '_verify_ec2_interface_subnet',
                '_verify_ec2_interface_security_group',
                '_verify_ec2_interface_queue',
                '_verify_ec2_sqs_interface_endpoint',
                '_verify_ec2_interface_inspection',
            ):
                stack.enter_context(patch(
                    f'dashboard.labs.{verifier}',
                    return_value=passed,
                ))
            from .labs import lab_status

            status = lab_status('ec2', 'sqs-interface-endpoint')

        self.assertTrue(status['complete'])
        self.assertTrue(status['steps']['allow-vpc-https']['verified'])
        self.assertTrue(
            status['steps']['create-sqs-interface-endpoint']['verified']
        )
        self.assertTrue(status['steps']['inspect-private-sqs-path']['verified'])

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
