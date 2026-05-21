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


LAMBDA_ACTIONS = (
    action(
        'invoke_function',
        'Invoke function',
        'POST',
        '/api/lambda/functions/{function}/invoke/',
        'execute',
        fields=(
            action_field('payload', 'JSON payload', field_type='textarea'),
            action_field('qualifier', 'Version or alias'),
        ),
        success_message='Function invoked',
    ),
)


DYNAMODB_ACTIONS = (
    action(
        'scan_table',
        'Scan table',
        'POST',
        '/api/dynamodb/tables/{table}/scan/',
        'read',
        safety='safe',
        fields=(
            action_field('limit', 'Limit', field_type='number'),
            action_field('exclusive_start_key', 'Exclusive start key JSON', field_type='object'),
        ),
    ),
    action(
        'execute_select_statement',
        'Execute SELECT',
        'POST',
        '/api/dynamodb/partiql/',
        'read',
        safety='safe',
        fields=(
            action_field('statement', 'SELECT statement', required=True, field_type='textarea'),
            action_field('limit', 'Limit', field_type='number'),
        ),
    ),
)


CLOUDWATCH_ACTIONS = (
    action(
        'list_log_streams',
        'List log streams',
        'POST',
        '/api/cloudwatch/log-streams/',
        'read',
        safety='safe',
        fields=(
            action_field('log_group_name', 'Log group name', required=True),
            action_field('limit', 'Limit', field_type='number'),
        ),
    ),
    action(
        'get_log_events',
        'Get log events',
        'POST',
        '/api/cloudwatch/log-events/',
        'read',
        safety='safe',
        fields=(
            action_field('log_group_name', 'Log group name', required=True),
            action_field('log_stream_name', 'Log stream name', required=True),
            action_field('limit', 'Limit', field_type='number'),
            action_field('start_time', 'Start time milliseconds', field_type='number'),
        ),
    ),
)


EVENTBRIDGE_ACTIONS = (
    action(
        'put_event',
        'Put event',
        'POST',
        '/api/eventbridge/events/put/',
        'execute',
        fields=(
            action_field('event_bus_name', 'Event bus name'),
            action_field('source', 'Source', required=True),
            action_field('detail_type', 'Detail type', required=True),
            action_field('detail', 'Event detail JSON', field_type='textarea'),
        ),
        success_message='Event sent',
    ),
)


APIGATEWAY_ACTIONS = (
    action(
        'test_request',
        'Test request',
        'POST',
        '/api/apigateway/requests/test/',
        'execute',
        safety='safe',
        fields=(
            action_field('api_type', 'API type', required=True),
            action_field('api_id', 'API ID', required=True),
            action_field('stage', 'Stage'),
            action_field('method', 'HTTP method', required=True),
            action_field('path', 'Path', required=True),
            action_field('query', 'Query JSON', field_type='object'),
            action_field('headers', 'Headers JSON', field_type='object'),
            action_field('body', 'Request body', field_type='textarea'),
        ),
        success_message='Request sent',
    ),
)


KINESIS_ACTIONS = (
    action(
        'create_stream',
        'Create stream',
        'POST',
        '/api/kinesis/streams/',
        'create',
        fields=(
            action_field('name', 'Stream name', required=True),
            action_field('mode', 'Stream mode', required=True),
            action_field('shard_count', 'Shard count', field_type='number'),
        ),
        success_message='Stream created',
    ),
    action(
        'put_record',
        'Put record',
        'POST',
        '/api/kinesis/streams/{stream}/records/',
        'execute',
        fields=(
            action_field('partition_key', 'Partition key', required=True),
            action_field('data', 'Record data', required=True, field_type='textarea'),
        ),
        success_message='Record written',
    ),
    action(
        'get_records',
        'Get records',
        'POST',
        '/api/kinesis/streams/{stream}/shards/{shard}/records/',
        'read',
        safety='safe',
        fields=(
            action_field('iterator_type', 'Iterator type'),
            action_field('limit', 'Limit', field_type='number'),
            action_field('sequence_number', 'Sequence number'),
        ),
    ),
)


SECRETSMANAGER_ACTIONS = (
    action(
        'create_secret',
        'Create secret',
        'POST',
        '/api/secretsmanager/secrets/',
        'create',
        fields=(
            action_field('name', 'Secret name', required=True),
            action_field('value', 'Secret value', required=True, field_type='textarea'),
            action_field('description', 'Description'),
            action_field('kms_key_id', 'KMS key ID'),
        ),
        success_message='Secret created',
    ),
    action(
        'get_secret_value',
        'Reveal value',
        'GET',
        '/api/secretsmanager/secrets/{secret}/value/',
        'read',
        safety='safe',
        success_message='Secret value loaded',
    ),
    action(
        'put_secret_value',
        'Update value',
        'PUT',
        '/api/secretsmanager/secrets/{secret}/value/',
        'update',
        fields=(action_field('value', 'Secret value', required=True, field_type='textarea'),),
        success_message='Secret value updated',
    ),
    action(
        'delete_secret',
        'Delete secret',
        'DELETE',
        '/api/secretsmanager/secrets/{secret}/value/',
        'delete',
        safety='destructive',
        confirm='Schedule this secret for deletion?',
        fields=(
            action_field('recovery_window_days', 'Recovery window days', field_type='number'),
            action_field('force_delete_without_recovery', 'Force delete without recovery', field_type='boolean'),
        ),
        success_message='Secret deletion scheduled',
    ),
)


SSM_ACTIONS = (
    action(
        'put_parameter',
        'Create parameter',
        'POST',
        '/api/ssm/parameters/',
        'create',
        fields=(
            action_field('name', 'Parameter name', required=True),
            action_field('type', 'Parameter type', required=True),
            action_field('value', 'Parameter value', required=True, field_type='textarea'),
            action_field('description', 'Description'),
            action_field('overwrite', 'Overwrite existing parameter', field_type='boolean'),
        ),
        success_message='Parameter saved',
    ),
    action(
        'get_parameter',
        'Reveal value',
        'GET',
        '/api/ssm/parameters/{parameter}/value/',
        'read',
        safety='safe',
        success_message='Parameter value loaded',
    ),
    action(
        'update_parameter',
        'Update value',
        'PUT',
        '/api/ssm/parameters/{parameter}/value/',
        'update',
        fields=(
            action_field('type', 'Parameter type', required=True),
            action_field('value', 'Parameter value', required=True, field_type='textarea'),
            action_field('description', 'Description'),
        ),
        success_message='Parameter updated',
    ),
    action(
        'delete_parameter',
        'Delete parameter',
        'DELETE',
        '/api/ssm/parameters/{parameter}/value/',
        'delete',
        safety='destructive',
        confirm='Delete this parameter?',
        success_message='Parameter deleted',
    ),
)


EC2_ACTIONS = (
    action(
        'run_instances',
        'Launch instance',
        'POST',
        '/api/ec2/instances/',
        'create',
        fields=(
            action_field('image_id', 'AMI ID', required=True),
            action_field('instance_type', 'Instance type', required=True),
            action_field('subnet_id', 'Subnet ID'),
            action_field('security_group_ids', 'Security group IDs', field_type='array'),
            action_field('key_name', 'Key name'),
            action_field('user_data', 'UserData script', field_type='textarea'),
            action_field('iam_instance_profile_arn', 'IAM instance profile ARN'),
        ),
        success_message='Instance launched',
    ),
    action(
        'start_instance',
        'Start instance',
        'POST',
        '/api/ec2/instances/{instance}/start/',
        'execute',
        success_message='Instance started',
    ),
    action(
        'stop_instance',
        'Stop instance',
        'POST',
        '/api/ec2/instances/{instance}/stop/',
        'execute',
        success_message='Instance stopped',
    ),
    action(
        'reboot_instance',
        'Reboot instance',
        'POST',
        '/api/ec2/instances/{instance}/reboot/',
        'execute',
        success_message='Instance rebooted',
    ),
    action(
        'terminate_instance',
        'Terminate instance',
        'POST',
        '/api/ec2/instances/{instance}/terminate/',
        'delete',
        safety='destructive',
        confirm='Terminate this instance?',
        success_message='Instance terminated',
    ),
    action(
        'import_key_pair',
        'Import key pair',
        'POST',
        '/api/ec2/key-pairs/import/',
        'create',
        fields=(
            action_field('key_name', 'Key name', required=True),
            action_field('public_key_material', 'Public key material', required=True, field_type='textarea'),
        ),
        success_message='Key pair imported',
    ),
)


IAM_ACTIONS = (
    action(
        'create_access_key',
        'Create access key',
        'POST',
        '/api/iam/users/{user}/access-keys/',
        'create',
        fields=(action_field('user_name', 'User name', required=True),),
        success_message='Access key created',
    ),
    action(
        'update_access_key',
        'Update access key',
        'PUT',
        '/api/iam/users/{user}/access-keys/{access_key}/',
        'update',
        fields=(
            action_field('access_key_id', 'Access key ID', required=True),
            action_field('status', 'Status', required=True),
        ),
        success_message='Access key updated',
    ),
    action(
        'delete_access_key',
        'Delete access key',
        'DELETE',
        '/api/iam/users/{user}/access-keys/{access_key}/',
        'delete',
        safety='destructive',
        confirm='Delete this access key?',
        fields=(action_field('access_key_id', 'Access key ID', required=True),),
        success_message='Access key deleted',
    ),
    action(
        'assume_role',
        'Assume role',
        'POST',
        '/api/iam/roles/{role}/assume/',
        'execute',
        fields=(
            action_field('role_arn', 'Role ARN', required=True),
            action_field('session_name', 'Session name', required=True),
            action_field('duration_seconds', 'Duration seconds', field_type='number'),
        ),
        success_message='Role assumed',
    ),
    action(
        'attach_managed_policy',
        'Attach managed policy',
        'POST',
        '/api/iam/principals/{principal_type}/{principal}/attached-policies/',
        'update',
        fields=(action_field('policy_arn', 'Policy ARN', required=True),),
        success_message='Policy attached',
    ),
    action(
        'detach_managed_policy',
        'Detach managed policy',
        'DELETE',
        '/api/iam/principals/{principal_type}/{principal}/attached-policies/',
        'delete',
        safety='destructive',
        confirm='Detach this managed policy?',
        fields=(action_field('policy_arn', 'Policy ARN', required=True),),
        success_message='Policy detached',
    ),
    action(
        'put_inline_policy',
        'Save inline policy',
        'PUT',
        '/api/iam/principals/{principal_type}/{principal}/inline-policies/{policy}/',
        'update',
        fields=(
            action_field('policy_name', 'Policy name', required=True),
            action_field('document', 'Policy document JSON', required=True, field_type='textarea'),
        ),
        success_message='Inline policy saved',
    ),
    action(
        'delete_inline_policy',
        'Delete inline policy',
        'DELETE',
        '/api/iam/principals/{principal_type}/{principal}/inline-policies/{policy}/',
        'delete',
        safety='destructive',
        confirm='Delete this inline policy?',
        fields=(action_field('policy_name', 'Policy name', required=True),),
        success_message='Inline policy deleted',
    ),
    action(
        'create_managed_policy',
        'Create managed policy',
        'POST',
        '/api/iam/policies/',
        'create',
        fields=(
            action_field('name', 'Policy name', required=True),
            action_field('document', 'Policy document JSON', required=True, field_type='textarea'),
            action_field('description', 'Description'),
        ),
        success_message='Managed policy created',
    ),
)


STEPFUNCTIONS_ACTIONS = (
    action(
        'start_execution',
        'Start execution',
        'POST',
        '/api/stepfunctions/executions/start/',
        'execute',
        fields=(
            action_field('state_machine_arn', 'State machine ARN', required=True),
            action_field('name', 'Execution name'),
            action_field('input', 'JSON input', field_type='textarea'),
            action_field('trace_header', 'Trace header'),
        ),
        success_message='Execution started',
    ),
    action(
        'stop_execution',
        'Stop execution',
        'POST',
        '/api/stepfunctions/executions/stop/',
        'delete',
        safety='destructive',
        fields=(
            action_field('execution_arn', 'Execution ARN', required=True),
            action_field('error', 'Error'),
            action_field('cause', 'Cause'),
        ),
        confirm='Stop this running execution?',
        success_message='Execution stopped',
    ),
)


SERVICES: tuple[ServiceDefinition, ...] = (
    service('acm', 'ACM', 'Certificates and validation state', 'Security'),
    service(
        'apigateway',
        'API Gateway',
        'REST and HTTP APIs',
        'Application Integration',
        maturity='interactive_workbench',
        console_css='dashboard/apigateway-console.css',
        console_js='dashboard/apigateway-console.js',
        shared_console=True,
        tags=('layered-workbench', 'request-workbench'),
        actions=APIGATEWAY_ACTIONS,
    ),
    service('appconfig', 'AppConfig', 'Application configuration management', 'Developer Tools'),
    service('athena', 'Athena', 'SQL queries and workgroups', 'Analytics'),
    service('autoscaling', 'Auto Scaling', 'Groups, policies, and scaling activity', 'Compute'),
    service('backup', 'Backup', 'Backup vaults, plans, jobs, and protected resources', 'Storage'),
    service('bcmdataexports', 'BCM Data Exports', 'Billing and cost management exports', 'Management'),
    service('bedrockruntime', 'Bedrock Runtime', 'Model runtime stub', 'AI'),
    service('cloudfront', 'CloudFront', 'Distributions, origins, cache behaviors, and edge policies', 'Networking'),
    service('cloudformation', 'CloudFormation', 'Stacks and change sets', 'Management'),
    service(
        'cloudwatch',
        'CloudWatch',
        'Logs and metrics',
        'Observability',
        maturity='interactive_workbench',
        console_css='dashboard/cloudwatch-console.css',
        console_js='dashboard/cloudwatch-console.js',
        shared_console=True,
        tags=('layered-workbench',),
        actions=CLOUDWATCH_ACTIONS,
    ),
    service('codebuild', 'CodeBuild', 'Build projects and execution history', 'Developer Tools'),
    service('codedeploy', 'CodeDeploy', 'Deployment applications and history', 'Developer Tools'),
    service('config', 'AWS Config', 'Configuration recorders, rules, compliance, and resource tracking', 'Management'),
    service('cognito', 'Cognito', 'User pools and auth', 'Security'),
    service('costexplorer', 'Cost Explorer', 'Cost and usage dimensions', 'Management'),
    service('cur', 'Cost and Usage Reports', 'Billing report definitions', 'Management'),
    service(
        'dynamodb',
        'DynamoDB',
        'NoSQL tables',
        'Database',
        maturity='interactive_workbench',
        console_css='dashboard/dynamodb-console.css',
        console_js='dashboard/dynamodb-console.js',
        shared_console=True,
        tags=('layered-workbench',),
        actions=DYNAMODB_ACTIONS,
    ),
    service(
        'ec2',
        'EC2',
        'Compute and networking',
        'Compute',
        maturity='interactive_workbench',
        console_css='dashboard/ec2-console.css',
        console_js='dashboard/ec2-console.js',
        shared_console=True,
        tags=('layered-workbench', 'compute-workbench'),
        actions=EC2_ACTIONS,
    ),
    service('ecr', 'ECR', 'Repositories and OCI images', 'Containers'),
    service('ecs', 'ECS', 'Clusters, tasks, and services', 'Containers'),
    service('eks', 'EKS', 'Kubernetes control plane inventory', 'Containers'),
    service('elasticache', 'ElastiCache', 'Cache clusters and replication groups', 'Database'),
    service('elasticloadbalancing', 'Elastic Load Balancing', 'Classic and v2 load balancers', 'Networking'),
    service(
        'eventbridge',
        'EventBridge',
        'Event buses and rules',
        'Application Integration',
        maturity='interactive_workbench',
        console_css='dashboard/eventbridge-console.css',
        console_js='dashboard/eventbridge-console.js',
        shared_console=True,
        tags=('layered-workbench', 'event-workbench'),
        actions=EVENTBRIDGE_ACTIONS,
    ),
    service('firehose', 'Data Firehose', 'Delivery streams and destinations', 'Analytics'),
    service('glue', 'Glue', 'Data catalog metadata', 'Analytics'),
    service(
        'iam',
        'IAM',
        'Identity and access management',
        'Security',
        maturity='interactive_workbench',
        console_css='dashboard/iam-console.css',
        console_js='dashboard/iam-console.js',
        shared_console=True,
        tags=('layered-workbench', 'identity-workbench'),
        actions=IAM_ACTIONS,
    ),
    service('kafka', 'MSK / Kafka', 'Managed Kafka clusters and configuration', 'Application Integration'),
    service(
        'kinesis',
        'Kinesis',
        'Streams, shards, and consumers',
        'Application Integration',
        maturity='interactive_workbench',
        console_css='dashboard/kinesis-console.css',
        console_js='dashboard/kinesis-console.js',
        shared_console=True,
        tags=('layered-workbench', 'stream-workbench'),
        actions=KINESIS_ACTIONS,
    ),
    service('kms', 'KMS', 'Key management', 'Security'),
    service(
        'lambda',
        'Lambda',
        'Functions and event sources',
        'Compute',
        maturity='interactive_workbench',
        console_css='dashboard/lambda-console.css',
        console_js='dashboard/lambda-console.js',
        shared_console=True,
        tags=('layered-workbench',),
        actions=LAMBDA_ACTIONS,
    ),
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
    service(
        'secretsmanager',
        'Secrets Manager',
        'Secret storage',
        'Security',
        maturity='interactive_workbench',
        console_css='dashboard/secretsmanager-console.css',
        console_js='dashboard/secretsmanager-console.js',
        shared_console=True,
        tags=('layered-workbench', 'secret-workbench'),
        actions=SECRETSMANAGER_ACTIONS,
    ),
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
    service(
        'ssm',
        'SSM',
        'Parameter Store, documents, sessions, automation, and managed instances',
        'Management',
        maturity='interactive_workbench',
        console_css='dashboard/ssm-console.css',
        console_js='dashboard/ssm-console.js',
        shared_console=True,
        tags=('layered-workbench', 'parameter-workbench'),
        actions=SSM_ACTIONS,
    ),
    service(
        'stepfunctions',
        'Step Functions',
        'State machines and executions',
        'Application Integration',
        maturity='interactive_workbench',
        console_css='dashboard/stepfunctions-console.css',
        console_js='dashboard/stepfunctions-console.js',
        shared_console=True,
        tags=('layered-workbench', 'workflow-workbench'),
        actions=STEPFUNCTIONS_ACTIONS,
    ),
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
