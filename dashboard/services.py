"""Canonical service metadata for dashboard pages and future workbenches."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field as dataclass_field
from typing import Literal

from .actions import ServiceAction, action, field as action_field

ServiceMaturity = Literal[
    'missing',
    'inventory_only',
    'read_only_inspector',
    'interactive_workbench',
    'tutorial_ready',
]


@dataclass(frozen=True)
class ServiceDefinition:
    key: str
    title: str
    eyebrow: str
    category: str
    maturity: ServiceMaturity = 'inventory_only'
    api_path: str | None = None
    page_path: str | None = None
    docs_url: str = ''
    console_css: str | None = None
    console_js: str | None = None
    shared_console: bool = False
    tutorial_available: bool = False
    tags: tuple[str, ...] = dataclass_field(default_factory=tuple)
    actions: tuple[ServiceAction, ...] = dataclass_field(default_factory=tuple)

    def as_dict(self) -> dict:
        data = asdict(self)
        data['api_path'] = self.api_path or f'/api/{self.key}/'
        data['page_path'] = self.page_path or f'/service/{self.key}/'
        data['tags'] = list(self.tags)
        return data

    def page_context(self) -> dict:
        return self.as_dict()


def service(
    key: str,
    title: str,
    eyebrow: str,
    category: str,
    *,
    maturity: ServiceMaturity = 'inventory_only',
    api_path: str | None = None,
    docs_url: str = '',
    console_css: str | None = None,
    console_js: str | None = None,
    shared_console: bool = False,
    tutorial_available: bool = False,
    tags: tuple[str, ...] = (),
    actions: tuple[ServiceAction, ...] = (),
) -> ServiceDefinition:
    return ServiceDefinition(
        key=key,
        title=title,
        eyebrow=eyebrow,
        category=category,
        maturity=maturity,
        api_path=api_path,
        docs_url=docs_url,
        console_css=console_css,
        console_js=console_js,
        shared_console=shared_console,
        tutorial_available=tutorial_available,
        tags=tags,
        actions=actions,
    )


S3_ACTIONS = (
    action(
        'create_bucket',
        'Create bucket',
        'POST',
        '/api/s3/buckets/',
        'create',
        fields=(
            action_field('name', 'Bucket name', required=True),
            action_field('region', 'Region', help_text='Defaults to the configured Floci region.'),
        ),
        success_message='Bucket created',
    ),
    action(
        'delete_bucket',
        'Delete bucket',
        'DELETE',
        '/api/s3/buckets/{bucket}/',
        'delete',
        safety='destructive',
        confirm='Delete this bucket? It must be empty.',
        success_message='Bucket deleted',
    ),
    action(
        'empty_bucket',
        'Empty bucket',
        'POST',
        '/api/s3/buckets/{bucket}/empty/',
        'delete',
        safety='destructive',
        confirm='Empty all objects in this bucket?',
        success_message='Bucket emptied',
    ),
    action(
        'upload_object',
        'Upload object',
        'POST',
        '/api/s3/buckets/{bucket}/objects/',
        'create',
        fields=(
            action_field('key', 'Object key', required=True),
            action_field('file', 'File', required=True, field_type='file'),
        ),
        success_message='Upload complete',
    ),
    action(
        'download_object',
        'Download object',
        'GET',
        '/api/s3/buckets/{bucket}/objects/download/',
        'read',
        safety='safe',
        fields=(action_field('key', 'Object key', required=True),),
    ),
    action(
        'delete_objects',
        'Delete objects',
        'DELETE',
        '/api/s3/buckets/{bucket}/objects/',
        'delete',
        safety='destructive',
        fields=(action_field('keys', 'Object keys', required=True, field_type='array'),),
        confirm='Delete selected objects?',
        success_message='Deleted',
    ),
    action(
        'copy_object',
        'Copy object',
        'POST',
        '/api/s3/buckets/{bucket}/objects/copy/',
        'create',
        fields=(
            action_field('source_key', 'Source key', required=True),
            action_field('dest_key', 'Destination key', required=True),
            action_field('dest_bucket', 'Destination bucket'),
        ),
        success_message='Copy complete',
    ),
    action(
        'create_folder',
        'Create folder',
        'PUT',
        '/api/s3/buckets/{bucket}/folders/',
        'create',
        fields=(action_field('folder', 'Folder name', required=True),),
        success_message='Folder created',
    ),
    action(
        'put_versioning',
        'Update versioning',
        'PUT',
        '/api/s3/buckets/{bucket}/versioning/',
        'update',
        fields=(action_field('status', 'Versioning status', required=True),),
        success_message='Versioning updated',
    ),
    action(
        'put_object_tags',
        'Update object tags',
        'PUT',
        '/api/s3/buckets/{bucket}/objects/tags/',
        'update',
        fields=(
            action_field('key', 'Object key', required=True),
            action_field('tags', 'Tags', required=True, field_type='array'),
        ),
        success_message='Tags saved',
    ),
    action(
        'presign_object',
        'Create presigned URL',
        'POST',
        '/api/s3/buckets/{bucket}/objects/presign/',
        'execute',
        fields=(
            action_field('key', 'Object key', required=True),
            action_field('expires_in', 'Expires in seconds', field_type='number'),
        ),
        success_message='URL copied to clipboard',
    ),
)


SQS_ACTIONS = (
    action(
        'create_queue',
        'Create queue',
        'POST',
        '/api/sqs/queues/',
        'create',
        fields=(
            action_field('name', 'Queue name', required=True),
            action_field('fifo', 'FIFO queue', field_type='boolean'),
            action_field('visibility_timeout', 'Visibility timeout seconds', field_type='number'),
        ),
        success_message='Queue created',
    ),
    action(
        'delete_queue',
        'Delete queue',
        'DELETE',
        '/api/sqs/queues/{queue}/',
        'delete',
        safety='destructive',
        confirm='Delete this queue?',
        success_message='Queue deleted',
    ),
    action(
        'purge_queue',
        'Purge queue',
        'POST',
        '/api/sqs/queues/{queue}/purge/',
        'delete',
        safety='destructive',
        confirm='Delete all available messages in this queue?',
        success_message='Queue purged',
    ),
    action(
        'send_message',
        'Send message',
        'POST',
        '/api/sqs/queues/{queue}/messages/send/',
        'create',
        fields=(
            action_field('body', 'Message body', required=True, field_type='textarea'),
            action_field('delay_seconds', 'Delay seconds', field_type='number'),
            action_field('message_group_id', 'FIFO message group ID'),
            action_field('message_deduplication_id', 'FIFO deduplication ID'),
        ),
        success_message='Message sent',
    ),
    action(
        'receive_messages',
        'Poll messages',
        'POST',
        '/api/sqs/queues/{queue}/messages/',
        'read',
        safety='safe',
        fields=(
            action_field('max_number', 'Max messages', field_type='number'),
            action_field('visibility_timeout', 'Visibility timeout seconds', field_type='number'),
            action_field('wait_time_seconds', 'Wait time seconds', field_type='number'),
        ),
    ),
    action(
        'delete_message',
        'Delete message',
        'DELETE',
        '/api/sqs/queues/{queue}/messages/delete/',
        'delete',
        safety='destructive',
        fields=(action_field('receipt_handle', 'Receipt handle', required=True),),
        confirm='Delete this received message?',
        success_message='Message deleted',
    ),
)


SNS_ACTIONS = (
    action(
        'publish_message',
        'Publish message',
        'POST',
        '/api/sns/messages/publish/',
        'create',
        fields=(
            action_field('topic_arn', 'Topic ARN', required=True),
            action_field('message', 'Message body', required=True, field_type='textarea'),
            action_field('subject', 'Subject'),
            action_field('message_attributes', 'Message attributes JSON', field_type='object'),
            action_field('message_structure', 'Message structure'),
            action_field('message_group_id', 'FIFO message group ID'),
            action_field('message_deduplication_id', 'FIFO deduplication ID'),
        ),
        success_message='Message published',
    ),
)


SERVICES: tuple[ServiceDefinition, ...] = (
    service('acm', 'ACM', 'Certificates and validation state', 'Security'),
    service('apigateway', 'API Gateway', 'REST and HTTP APIs', 'Application Integration'),
    service('appconfig', 'AppConfig', 'Application configuration management', 'Developer Tools'),
    service('athena', 'Athena', 'SQL queries and workgroups', 'Analytics'),
    service('autoscaling', 'Auto Scaling', 'Groups, policies, and scaling activity', 'Compute'),
    service('backup', 'Backup', 'Backup vaults, plans, jobs, and protected resources', 'Storage'),
    service('bcmdataexports', 'BCM Data Exports', 'Billing and cost management exports', 'Management'),
    service('bedrockruntime', 'Bedrock Runtime', 'Model runtime stub', 'AI'),
    service('cloudformation', 'CloudFormation', 'Stacks and change sets', 'Management'),
    service('cloudwatch', 'CloudWatch', 'Logs and metrics', 'Observability'),
    service('codebuild', 'CodeBuild', 'Build projects and execution history', 'Developer Tools'),
    service('codedeploy', 'CodeDeploy', 'Deployment applications and history', 'Developer Tools'),
    service('cognito', 'Cognito', 'User pools and auth', 'Security'),
    service('costexplorer', 'Cost Explorer', 'Cost and usage dimensions', 'Management'),
    service('cur', 'Cost and Usage Reports', 'Billing report definitions', 'Management'),
    service('dynamodb', 'DynamoDB', 'NoSQL tables', 'Database'),
    service('ec2', 'EC2', 'Compute and networking', 'Compute'),
    service('ecr', 'ECR', 'Repositories and OCI images', 'Containers'),
    service('ecs', 'ECS', 'Clusters, tasks, and services', 'Containers'),
    service('eks', 'EKS', 'Kubernetes control plane inventory', 'Containers'),
    service('elasticache', 'ElastiCache', 'Cache clusters and replication groups', 'Database'),
    service('elasticloadbalancing', 'Elastic Load Balancing', 'Classic and v2 load balancers', 'Networking'),
    service('eventbridge', 'EventBridge', 'Event buses and rules', 'Application Integration'),
    service('firehose', 'Data Firehose', 'Delivery streams and destinations', 'Analytics'),
    service('glue', 'Glue', 'Data catalog metadata', 'Analytics'),
    service('iam', 'IAM', 'Identity and access management', 'Security'),
    service('kafka', 'MSK / Kafka', 'Managed Kafka clusters and configuration', 'Application Integration'),
    service('kinesis', 'Kinesis', 'Streams, shards, and consumers', 'Application Integration'),
    service('kms', 'KMS', 'Key management', 'Security'),
    service('lambda', 'Lambda', 'Functions and event sources', 'Compute'),
    service('neptune', 'Neptune', 'Graph database clusters and instances', 'Database'),
    service('opensearch', 'OpenSearch', 'Search domains, packages, endpoints, and maintenance', 'Analytics'),
    service('pipes', 'EventBridge Pipes', 'EventBridge pipe sources, enrichment, targets, and state', 'Application Integration'),
    service('pricing', 'AWS Price List', 'Pricing services, attributes, and price lists', 'Management'),
    service('rds', 'RDS', 'Database instances and proxy endpoints', 'Database'),
    service('resourcegroupstagging', 'Resource Groups Tagging', 'Tagged resources, tag keys, tag values, and compliance', 'Management'),
    service('route53', 'Route 53', 'Hosted zones, records, health checks, and DNS policies', 'Networking'),
    service(
        's3',
        'S3',
        'Object storage',
        'Storage',
        maturity='interactive_workbench',
        console_css='dashboard/s3-console.css',
        console_js='dashboard/s3-console.js',
        shared_console=True,
        tags=('layered-workbench',),
        actions=S3_ACTIONS,
    ),
    service('scheduler', 'EventBridge Scheduler', 'Schedule groups and targets', 'Application Integration'),
    service('secretsmanager', 'Secrets Manager', 'Secret storage', 'Security'),
    service('ses', 'SES', 'Email identities and captured messages', 'Application Integration'),
    service(
        'sns',
        'SNS',
        'Topics and subscriptions',
        'Application Integration',
        maturity='interactive_workbench',
        console_css='dashboard/sns-console.css',
        console_js='dashboard/sns-console.js',
        shared_console=True,
        tags=('layered-workbench', 'message-workbench'),
        actions=SNS_ACTIONS,
    ),
    service(
        'sqs',
        'SQS',
        'Message queues',
        'Application Integration',
        maturity='interactive_workbench',
        console_css='dashboard/sqs-console.css',
        console_js='dashboard/sqs-console.js',
        shared_console=True,
        tags=('layered-workbench', 'message-workbench'),
        actions=SQS_ACTIONS,
    ),
    service('ssm', 'SSM', 'Parameter Store, documents, sessions, automation, and managed instances', 'Management'),
    service('stepfunctions', 'Step Functions', 'State machines and executions', 'Application Integration'),
    service('textract', 'Textract', 'Document analysis, OCR, adapters, and async jobs', 'AI'),
    service('transcribe', 'Transcribe', 'Speech transcription jobs and vocabularies', 'AI'),
    service('transfer', 'Transfer Family', 'SFTP, FTPS, FTP, and AS2 transfer resources', 'Storage'),
)

SERVICE_REGISTRY = {definition.key: definition for definition in SERVICES}

SERVICE_PAGES = {
    definition.key: {
        'title': definition.title,
        'eyebrow': definition.eyebrow,
    }
    for definition in SERVICES
}


def get_service(key: str) -> ServiceDefinition | None:
    return SERVICE_REGISTRY.get(key)


def services_payload() -> dict:
    return {
        'maturity_levels': [
            'missing',
            'inventory_only',
            'read_only_inspector',
            'interactive_workbench',
            'tutorial_ready',
        ],
        'services': [definition.as_dict() for definition in SERVICES],
    }
