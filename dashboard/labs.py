"""Curated local AWS workflow labs."""

from __future__ import annotations

import json
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.error import URLError
from urllib.request import urlopen

from botocore.exceptions import ClientError
from django.core.cache import cache

from .aws import FlociClientFactory, _clean_response

AWS_ACCOUNT_ID = '000000000000'
AWS_REGION = 'us-east-1'
ALICE_USER_NAME = 'Alice'
ALICE_POLICY_NAME = 'AliceListBucketsPolicy'
ALICE_POLICY_ARN = f'arn:aws:iam::{AWS_ACCOUNT_ID}:policy/{ALICE_POLICY_NAME}'
ALICE_INLINE_POLICY_NAME = 'AliceInlineListBuckets'
FLOCI_DEVELOPERS_GROUP_NAME = 'FlociDevelopers'
FLOCI_DEVELOPERS_POLICY_NAME = 'FlociDevelopersListBucketsPolicy'
FLOCI_DEVELOPERS_POLICY_ARN = f'arn:aws:iam::{AWS_ACCOUNT_ID}:policy/{FLOCI_DEVELOPERS_POLICY_NAME}'
FLOCI_APPLICATION_ROLE_NAME = 'FlociApplicationRole'
FLOCI_APPLICATION_ROLE_POLICY_NAME = 'FlociApplicationListBuckets'
FLOCI_EC2_ROLE_NAME = 'FlociEc2Role'
FLOCI_EC2_INSTANCE_PROFILE_NAME = 'FlociEc2InstanceProfile'
S3_BASICS_BUCKET_NAME = 'floci-lab-basics'
S3_OBJECTS_BUCKET_NAME = 'floci-lab-objects'
S3_HELLO_OBJECT_KEY = 'hello.txt'
S3_HELLO_OBJECT_TEXT = 'Hello from the Floci S3 lab!\n'
S3_HELLO_OBJECT_BYTES = S3_HELLO_OBJECT_TEXT.encode('utf-8')
S3_PREFIXES_BUCKET_NAME = 'floci-lab-prefixes'
S3_REPORT_SOURCE_KEY = 'incoming/report.txt'
S3_REPORT_ARCHIVE_KEY = 'archive/report.txt'
S3_REPORT_TEXT = 'Floci S3 lab report\nStatus: ready for archive\n'
S3_REPORT_BYTES = S3_REPORT_TEXT.encode('utf-8')
S3_METADATA_BUCKET_NAME = 'floci-lab-metadata'
S3_INVOICE_OBJECT_KEY = 'documents/invoice.txt'
S3_INVOICE_TEXT = 'Invoice: FLOCI-1001\nAmount: 42.00\n'
S3_INVOICE_BYTES = S3_INVOICE_TEXT.encode('utf-8')
S3_INVOICE_METADATA = {
    'project': 'floci',
    'classification': 'internal',
}
S3_INVOICE_TAGS = [
    {'Key': 'Environment', 'Value': 'lab'},
    {'Key': 'CostCenter', 'Value': 'training'},
]
S3_VERSIONING_BUCKET_NAME = 'floci-lab-versioning'
S3_CONFIGURATION_KEY = 'configuration.txt'
S3_CONFIGURATION_V1_TEXT = 'feature_enabled=false\nrelease=v1\n'
S3_CONFIGURATION_V2_TEXT = 'feature_enabled=true\nrelease=v2\n'
S3_CONFIGURATION_V1_BYTES = S3_CONFIGURATION_V1_TEXT.encode('utf-8')
S3_CONFIGURATION_V2_BYTES = S3_CONFIGURATION_V2_TEXT.encode('utf-8')
S3_PRESIGNED_BUCKET_NAME = 'floci-lab-presigned'
S3_PRESIGNED_OBJECT_KEY = 'shared/guide.txt'
S3_PRESIGNED_GUIDE_TEXT = 'Temporary access with an S3 presigned URL.\n'
S3_PRESIGNED_GUIDE_BYTES = S3_PRESIGNED_GUIDE_TEXT.encode('utf-8')
S3_PRESIGNED_EXPIRES_IN = 300
S3_SECURITY_BUCKET_NAME = 'floci-lab-security'
S3_PUBLIC_ACCESS_BLOCK = {
    'BlockPublicAcls': True,
    'IgnorePublicAcls': True,
    'BlockPublicPolicy': True,
    'RestrictPublicBuckets': True,
}
S3_SECURITY_BUCKET_POLICY = {
    'Version': '2012-10-17',
    'Statement': [
        {
            'Sid': 'AllowLocalAccountList',
            'Effect': 'Allow',
            'Principal': {'AWS': f'arn:aws:iam::{AWS_ACCOUNT_ID}:root'},
            'Action': 's3:ListBucket',
            'Resource': f'arn:aws:s3:::{S3_SECURITY_BUCKET_NAME}',
        },
    ],
}
S3_ENCRYPTION_BUCKET_NAME = 'floci-lab-encryption'
S3_ENCRYPTION_OBJECT_KEY = 'protected/record.txt'
S3_ENCRYPTION_RECORD_TEXT = 'Protected by the bucket encryption default.\n'
S3_ENCRYPTION_RECORD_BYTES = S3_ENCRYPTION_RECORD_TEXT.encode('utf-8')
S3_SSE_S3_CONFIGURATION = {
    'Rules': [
        {
            'ApplyServerSideEncryptionByDefault': {
                'SSEAlgorithm': 'AES256',
            },
            'BucketKeyEnabled': False,
        },
    ],
}
S3_LIFECYCLE_BUCKET_NAME = 'floci-lab-lifecycle'
S3_LIFECYCLE_OBJECT_KEY = 'logs/app.log'
S3_LIFECYCLE_LOG_TEXT = '2026-06-18T12:00:00Z INFO Floci lifecycle lab started\n'
S3_LIFECYCLE_LOG_BYTES = S3_LIFECYCLE_LOG_TEXT.encode('utf-8')
S3_LIFECYCLE_RULE_ID = 'ExpireApplicationLogsAfter30Days'
S3_LIFECYCLE_CONFIGURATION = {
    'Rules': [
        {
            'ID': S3_LIFECYCLE_RULE_ID,
            'Status': 'Enabled',
            'Filter': {'Prefix': 'logs/'},
            'Expiration': {'Days': 30},
        },
    ],
}
S3_CORS_BUCKET_NAME = 'floci-lab-cors'
S3_CORS_CONFIGURATION = {
    'CORSRules': [
        {
            'ID': 'AllowLocalWebAppRead',
            'AllowedOrigins': ['http://localhost:3000'],
            'AllowedMethods': ['GET', 'HEAD'],
            'AllowedHeaders': ['Authorization'],
            'ExposeHeaders': ['ETag'],
            'MaxAgeSeconds': 3600,
        },
    ],
}
S3_NOTIFICATIONS_BUCKET_NAME = 'floci-lab-notifications'
S3_NOTIFICATIONS_QUEUE_NAME = 'floci-lab-s3-events'
S3_NOTIFICATIONS_QUEUE_ARN = (
    f'arn:aws:sqs:us-east-1:{AWS_ACCOUNT_ID}:{S3_NOTIFICATIONS_QUEUE_NAME}'
)
S3_NOTIFICATIONS_OBJECT_KEY = 'uploads/report.txt'
S3_NOTIFICATIONS_REPORT_TEXT = 'Floci S3 notification delivery report\n'
S3_NOTIFICATIONS_REPORT_BYTES = S3_NOTIFICATIONS_REPORT_TEXT.encode('utf-8')
S3_NOTIFICATIONS_CONFIGURATION_ID = 'SendObjectCreatedToSqs'
S3_NOTIFICATIONS_QUEUE_POLICY = {
    'Version': '2012-10-17',
    'Statement': [
        {
            'Sid': 'AllowS3ObjectCreatedEvents',
            'Effect': 'Allow',
            'Principal': {'Service': 's3.amazonaws.com'},
            'Action': 'sqs:SendMessage',
            'Resource': S3_NOTIFICATIONS_QUEUE_ARN,
            'Condition': {
                'ArnEquals': {
                    'aws:SourceArn': f'arn:aws:s3:::{S3_NOTIFICATIONS_BUCKET_NAME}',
                },
                'StringEquals': {
                    'aws:SourceAccount': AWS_ACCOUNT_ID,
                },
            },
        },
    ],
}
S3_NOTIFICATIONS_CONFIGURATION = {
    'QueueConfigurations': [
        {
            'Id': S3_NOTIFICATIONS_CONFIGURATION_ID,
            'QueueArn': S3_NOTIFICATIONS_QUEUE_ARN,
            'Events': ['s3:ObjectCreated:*'],
        },
    ],
}
S3_MULTIPART_BUCKET_NAME = 'floci-lab-multipart'
S3_MULTIPART_OBJECT_KEY = 'archives/application.bin'
S3_MULTIPART_CONTENT_TYPE = 'application/octet-stream'
S3_MULTIPART_PART_ONE_BYTES = b'A' * (5 * 1024 * 1024)
S3_MULTIPART_PART_TWO_BYTES = b'B' * 1024
S3_MULTIPART_OBJECT_BYTES = S3_MULTIPART_PART_ONE_BYTES + S3_MULTIPART_PART_TWO_BYTES
SQS_BASICS_QUEUE_NAME = 'floci-lab-basics'
SQS_BASICS_QUEUE_ARN = (
    f'arn:aws:sqs:{AWS_REGION}:{AWS_ACCOUNT_ID}:{SQS_BASICS_QUEUE_NAME}'
)
SQS_MESSAGE_BODY = {
    'event': 'order.created',
    'order_id': 'FLOCI-1001',
}
SQS_MESSAGE_BODY_TEXT = json.dumps(SQS_MESSAGE_BODY, separators=(',', ':'))
SQS_MESSAGE_ATTRIBUTES = {
    'Lab': {
        'DataType': 'String',
        'StringValue': 'message-lifecycle',
    },
}
SQS_MESSAGE_DELETE_CACHE_KEY = 'floci-lab:sqs:message-lifecycle:deleted'
SQS_VISIBILITY_BODY = {
    'event': 'job.ready',
    'job_id': 'FLOCI-JOB-1001',
}
SQS_VISIBILITY_BODY_TEXT = json.dumps(SQS_VISIBILITY_BODY, separators=(',', ':'))
SQS_VISIBILITY_ATTRIBUTES = {
    'Lab': {
        'DataType': 'String',
        'StringValue': 'visibility-timeout',
    },
}
SQS_VISIBILITY_RECEIPT_CACHE_KEY = 'floci-lab:sqs:visibility-timeout:receipt'
SQS_VISIBILITY_EXTENDED_CACHE_KEY = 'floci-lab:sqs:visibility-timeout:extended'
SQS_VISIBILITY_HIDDEN_CACHE_KEY = 'floci-lab:sqs:visibility-timeout:hidden'
SQS_VISIBILITY_SHORTENED_CACHE_KEY = 'floci-lab:sqs:visibility-timeout:shortened'
SQS_VISIBILITY_RETURNED_CACHE_KEY = 'floci-lab:sqs:visibility-timeout:returned'
SQS_VISIBILITY_EXTENDED_SECONDS = 60
SQS_VISIBILITY_SHORT_SECONDS = 2
SQS_DELAYED_BODY = {
    'event': 'report.generate',
    'report_id': 'FLOCI-REPORT-1001',
}
SQS_DELAYED_BODY_TEXT = json.dumps(SQS_DELAYED_BODY, separators=(',', ':'))
SQS_DELAYED_ATTRIBUTES = {
    'Lab': {
        'DataType': 'String',
        'StringValue': 'delayed-message',
    },
}
SQS_DELAY_SECONDS = 10
SQS_DELAYED_OBSERVED_CACHE_KEY = 'floci-lab:sqs:delayed-message:observed'
SQS_DELAYED_RETURNED_CACHE_KEY = 'floci-lab:sqs:delayed-message:returned'
SQS_BATCH_MESSAGES = [
    {'event': 'task.created', 'task_id': f'FLOCI-TASK-{number}'}
    for number in range(1, 4)
]
SQS_BATCH_MESSAGE_TEXTS = [
    json.dumps(message, separators=(',', ':'))
    for message in SQS_BATCH_MESSAGES
]
SQS_BATCH_ATTRIBUTE_VALUE = 'batch-messages'
SQS_BATCH_DELETE_CACHE_KEY = 'floci-lab:sqs:batch-messages:deleted'
SQS_CONFIGURATION_ATTRIBUTES = {
    'VisibilityTimeout': '45',
    'MessageRetentionPeriod': '86400',
    'ReceiveMessageWaitTimeSeconds': '10',
}
SQS_DEFAULT_ATTRIBUTES = {
    'VisibilityTimeout': '30',
    'MessageRetentionPeriod': '345600',
    'ReceiveMessageWaitTimeSeconds': '0',
}
SQS_CONFIGURATION_TAGS = {
    'Environment': 'lab',
    'Purpose': 'training',
}
SQS_REDRIVE_SOURCE_QUEUE_NAME = 'floci-lab-redrive-source'
SQS_REDRIVE_DLQ_NAME = 'floci-lab-redrive-dlq'
SQS_REDRIVE_SOURCE_QUEUE_ARN = (
    f'arn:aws:sqs:{AWS_REGION}:{AWS_ACCOUNT_ID}:{SQS_REDRIVE_SOURCE_QUEUE_NAME}'
)
SQS_REDRIVE_DLQ_ARN = (
    f'arn:aws:sqs:{AWS_REGION}:{AWS_ACCOUNT_ID}:{SQS_REDRIVE_DLQ_NAME}'
)
SQS_REDRIVE_MAX_RECEIVE_COUNT = 2
SQS_REDRIVE_POLICY = {
    'deadLetterTargetArn': SQS_REDRIVE_DLQ_ARN,
    'maxReceiveCount': str(SQS_REDRIVE_MAX_RECEIVE_COUNT),
}
SQS_REDRIVE_BODY = {
    'event': 'payment.process',
    'payment_id': 'FLOCI-PAYMENT-1001',
    'simulate_failure': True,
}
SQS_REDRIVE_BODY_TEXT = json.dumps(SQS_REDRIVE_BODY, separators=(',', ':'))
SQS_REDRIVE_ATTRIBUTES = {
    'Lab': {
        'DataType': 'String',
        'StringValue': 'dead-letter-redrive',
    },
}
SQS_REDRIVE_FAILURE_ONE_CACHE_KEY = 'floci-lab:sqs:dead-letter-redrive:failure-one'
SQS_REDRIVE_FAILURE_TWO_CACHE_KEY = 'floci-lab:sqs:dead-letter-redrive:failure-two'
SQS_REDRIVE_TRIGGERED_CACHE_KEY = 'floci-lab:sqs:dead-letter-redrive:triggered'
SQS_REDRIVE_DLQ_OBSERVED_CACHE_KEY = 'floci-lab:sqs:dead-letter-redrive:dlq-observed'
SQS_REDRIVE_TASK_CACHE_KEY = 'floci-lab:sqs:dead-letter-redrive:task'
SQS_REDRIVE_RETURNED_CACHE_KEY = 'floci-lab:sqs:dead-letter-redrive:returned'
SQS_FIFO_QUEUE_NAME = 'floci-lab-orders.fifo'
SQS_FIFO_QUEUE_ARN = (
    f'arn:aws:sqs:{AWS_REGION}:{AWS_ACCOUNT_ID}:{SQS_FIFO_QUEUE_NAME}'
)
SQS_FIFO_GROUP_ID = 'customer-FLOCI-1001'
SQS_FIFO_MESSAGES = [
    {
        'event': 'order.status',
        'order_id': 'FLOCI-ORDER-1001',
        'status': status,
        'step': step,
    }
    for step, status in enumerate(
        ('created', 'paid', 'fulfilled'),
        start=1,
    )
]
SQS_FIFO_MESSAGE_TEXTS = [
    json.dumps(message, separators=(',', ':'))
    for message in SQS_FIFO_MESSAGES
]
SQS_FIFO_DUPLICATE_BODY = {
    **SQS_FIFO_MESSAGES[0],
    'duplicate_payload': True,
}
SQS_FIFO_DUPLICATE_BODY_TEXT = json.dumps(
    SQS_FIFO_DUPLICATE_BODY,
    separators=(',', ':'),
)
SQS_FIFO_DEDUPLICATION_IDS = [
    f'FLOCI-ORDER-1001-{step}'
    for step in range(1, 4)
]
SQS_FIFO_FIRST_SEND_CACHE_KEY = 'floci-lab:sqs:fifo-ordering:first-send'
SQS_FIFO_DEDUPLICATED_CACHE_KEY = 'floci-lab:sqs:fifo-ordering:deduplicated'
SQS_FIFO_ORDERED_CACHE_KEY = 'floci-lab:sqs:fifo-ordering:ordered'
SQS_CLEANUP_QUEUE_NAME = 'floci-lab-cleanup'
SQS_CLEANUP_QUEUE_ARN = (
    f'arn:aws:sqs:{AWS_REGION}:{AWS_ACCOUNT_ID}:{SQS_CLEANUP_QUEUE_NAME}'
)
SQS_CLEANUP_VISIBILITY_TIMEOUT = '45'
SQS_CLEANUP_TAGS = {'Purpose': 'cleanup-training'}
SQS_CLEANUP_MESSAGES = [
    {'event': 'cleanup.test', 'message_id': f'FLOCI-CLEANUP-{number}'}
    for number in range(1, 4)
]
SQS_CLEANUP_MESSAGE_TEXTS = [
    json.dumps(message, separators=(',', ':'))
    for message in SQS_CLEANUP_MESSAGES
]
SQS_CLEANUP_ATTRIBUTE_VALUE = 'purge-delete'
SQS_CLEANUP_POPULATED_CACHE_KEY = 'floci-lab:sqs:purge-delete:populated'
SQS_CLEANUP_PURGED_CACHE_KEY = 'floci-lab:sqs:purge-delete:purged'
SQS_CLEANUP_DELETED_CACHE_KEY = 'floci-lab:sqs:purge-delete:deleted'
SNS_FANOUT_TOPIC_NAME = 'floci-lab-order-events'
SNS_FANOUT_TOPIC_ARN = (
    f'arn:aws:sns:{AWS_REGION}:{AWS_ACCOUNT_ID}:{SNS_FANOUT_TOPIC_NAME}'
)
SNS_FANOUT_ORDERS_QUEUE_NAME = 'floci-lab-order-processing'
SNS_FANOUT_AUDIT_QUEUE_NAME = 'floci-lab-order-audit'
SNS_FANOUT_ORDERS_QUEUE_ARN = (
    f'arn:aws:sqs:{AWS_REGION}:{AWS_ACCOUNT_ID}:{SNS_FANOUT_ORDERS_QUEUE_NAME}'
)
SNS_FANOUT_AUDIT_QUEUE_ARN = (
    f'arn:aws:sqs:{AWS_REGION}:{AWS_ACCOUNT_ID}:{SNS_FANOUT_AUDIT_QUEUE_NAME}'
)
SNS_FANOUT_MESSAGE = {
    'event': 'order.created',
    'order_id': 'FLOCI-FANOUT-1001',
}
SNS_FANOUT_MESSAGE_TEXT = json.dumps(SNS_FANOUT_MESSAGE, separators=(',', ':'))
SNS_FANOUT_MESSAGE_ATTRIBUTES = {
    'EventType': {
        'DataType': 'String',
        'StringValue': 'order.created',
    },
    'Environment': {
        'DataType': 'String',
        'StringValue': 'lab',
    },
}
SNS_FILTER_TOPIC_NAME = 'floci-lab-filtered-events'
SNS_FILTER_TOPIC_ARN = (
    f'arn:aws:sns:{AWS_REGION}:{AWS_ACCOUNT_ID}:{SNS_FILTER_TOPIC_NAME}'
)
SNS_FILTER_CREATED_QUEUE_NAME = 'floci-lab-created-events'
SNS_FILTER_PRIORITY_QUEUE_NAME = 'floci-lab-priority-events'
SNS_FILTER_CREATED_QUEUE_ARN = (
    f'arn:aws:sqs:{AWS_REGION}:{AWS_ACCOUNT_ID}:{SNS_FILTER_CREATED_QUEUE_NAME}'
)
SNS_FILTER_PRIORITY_QUEUE_ARN = (
    f'arn:aws:sqs:{AWS_REGION}:{AWS_ACCOUNT_ID}:{SNS_FILTER_PRIORITY_QUEUE_NAME}'
)
SNS_FILTER_CREATED_POLICY = {'EventType': ['order.created']}
SNS_FILTER_PRIORITY_POLICY = {'Priority': ['high']}
SNS_FILTER_CREATED_MESSAGE = {
    'event': 'order.created',
    'order_id': 'FLOCI-FILTER-1001',
}
SNS_FILTER_CREATED_MESSAGE_TEXT = json.dumps(
    SNS_FILTER_CREATED_MESSAGE,
    separators=(',', ':'),
)
SNS_FILTER_CREATED_ATTRIBUTES = {
    'EventType': {'DataType': 'String', 'StringValue': 'order.created'},
    'Priority': {'DataType': 'String', 'StringValue': 'normal'},
}
SNS_FILTER_PRIORITY_MESSAGE = {
    'event': 'order.cancelled',
    'order_id': 'FLOCI-FILTER-1002',
}
SNS_FILTER_PRIORITY_MESSAGE_TEXT = json.dumps(
    SNS_FILTER_PRIORITY_MESSAGE,
    separators=(',', ':'),
)
SNS_FILTER_PRIORITY_ATTRIBUTES = {
    'EventType': {'DataType': 'String', 'StringValue': 'order.cancelled'},
    'Priority': {'DataType': 'String', 'StringValue': 'high'},
}
SCHEDULER_SQS_QUEUE_NAME = 'floci-lab-scheduled-reports'
SCHEDULER_SQS_QUEUE_ARN = (
    f'arn:aws:sqs:{AWS_REGION}:{AWS_ACCOUNT_ID}:{SCHEDULER_SQS_QUEUE_NAME}'
)
SCHEDULER_ROLE_NAME = 'FlociSchedulerSqsRole'
SCHEDULER_ROLE_ARN = f'arn:aws:iam::{AWS_ACCOUNT_ID}:role/{SCHEDULER_ROLE_NAME}'
SCHEDULER_ROLE_POLICY_NAME = 'SendScheduledReportToSqs'
SCHEDULER_GROUP_NAME = 'floci-lab-scheduler'
SCHEDULER_GROUP_ARN = (
    f'arn:aws:scheduler:{AWS_REGION}:{AWS_ACCOUNT_ID}:'
    f'schedule-group/{SCHEDULER_GROUP_NAME}'
)
SCHEDULER_SCHEDULE_NAME = 'send-report-ready'
SCHEDULER_SCHEDULE_ARN = (
    f'arn:aws:scheduler:{AWS_REGION}:{AWS_ACCOUNT_ID}:schedule/'
    f'{SCHEDULER_GROUP_NAME}/{SCHEDULER_SCHEDULE_NAME}'
)
SCHEDULER_MESSAGE = {
    'event': 'report.ready',
    'report_id': 'FLOCI-SCHEDULE-1001',
}
SCHEDULER_MESSAGE_TEXT = json.dumps(SCHEDULER_MESSAGE, separators=(',', ':'))
SCHEDULER_TRUST_POLICY = {
    'Version': '2012-10-17',
    'Statement': [{
        'Effect': 'Allow',
        'Principal': {'Service': 'scheduler.amazonaws.com'},
        'Action': 'sts:AssumeRole',
    }],
}
SCHEDULER_ROLE_POLICY = {
    'Version': '2012-10-17',
    'Statement': [{
        'Effect': 'Allow',
        'Action': 'sqs:SendMessage',
        'Resource': SCHEDULER_SQS_QUEUE_ARN,
    }],
}
SCHEDULER_EXPRESSION_CACHE_KEY = 'floci-lab:scheduler:sqs-delivery:expression'
SCHEDULER_CREATED_CACHE_KEY = 'floci-lab:scheduler:sqs-delivery:created'
SCHEDULER_DELIVERED_CACHE_KEY = 'floci-lab:scheduler:sqs-delivery:delivered'
SCHEDULER_DELETED_CACHE_KEY = 'floci-lab:scheduler:sqs-delivery:deleted'
CLOUDFORMATION_STACK_NAME = 'floci-lab-storage-messaging'
CLOUDFORMATION_BUCKET_NAME = 'floci-lab-cfn-storage'
CLOUDFORMATION_QUEUE_NAME = 'floci-lab-cfn-jobs'
CLOUDFORMATION_QUEUE_ARN = (
    f'arn:aws:sqs:{AWS_REGION}:{AWS_ACCOUNT_ID}:{CLOUDFORMATION_QUEUE_NAME}'
)
CLOUDFORMATION_TEMPLATE = {
    'AWSTemplateFormatVersion': '2010-09-09',
    'Description': 'Provision local S3 storage and an SQS work queue.',
    'Resources': {
        'StorageBucket': {
            'Type': 'AWS::S3::Bucket',
            'Properties': {
                'BucketName': CLOUDFORMATION_BUCKET_NAME,
            },
        },
        'JobsQueue': {
            'Type': 'AWS::SQS::Queue',
            'Properties': {
                'QueueName': CLOUDFORMATION_QUEUE_NAME,
                'VisibilityTimeout': 30,
            },
        },
    },
    'Outputs': {
        'BucketName': {
            'Description': 'Name of the provisioned storage bucket.',
            'Value': {'Ref': 'StorageBucket'},
        },
        'QueueUrl': {
            'Description': 'URL of the provisioned work queue.',
            'Value': {'Ref': 'JobsQueue'},
        },
        'QueueArn': {
            'Description': 'ARN of the provisioned work queue.',
            'Value': {'Fn::GetAtt': ['JobsQueue', 'Arn']},
        },
    },
}
CLOUDFORMATION_TEMPLATE_TEXT = json.dumps(
    CLOUDFORMATION_TEMPLATE,
    indent=2,
)
CLOUDFORMATION_CREATED_CACHE_KEY = 'floci-lab:cloudformation:s3-sqs:created'
CLOUDFORMATION_INSPECTED_CACHE_KEY = 'floci-lab:cloudformation:s3-sqs:inspected'
CLOUDFORMATION_DELETED_CACHE_KEY = 'floci-lab:cloudformation:s3-sqs:deleted'
EC2_VPC_CIDR = '10.42.0.0/16'
EC2_PUBLIC_SUBNET_CIDR = '10.42.1.0/24'
EC2_PRIVATE_SUBNET_CIDR = '10.42.2.0/24'
EC2_PUBLIC_AZ = 'us-east-1a'
EC2_PRIVATE_AZ = 'us-east-1b'
EC2_VPC_TAGS = [
    {'Key': 'Name', 'Value': 'floci-lab-vpc'},
    {'Key': 'Lab', 'Value': 'vpc-public-private'},
]
EC2_VPC_ID_CACHE_KEY = 'floci-lab:ec2:vpc-networking:vpc-id'
EC2_PUBLIC_SUBNET_ID_CACHE_KEY = 'floci-lab:ec2:vpc-networking:public-subnet-id'
EC2_PRIVATE_SUBNET_ID_CACHE_KEY = 'floci-lab:ec2:vpc-networking:private-subnet-id'
EC2_IGW_ID_CACHE_KEY = 'floci-lab:ec2:vpc-networking:igw-id'
EC2_PUBLIC_RT_ID_CACHE_KEY = 'floci-lab:ec2:vpc-networking:public-rt-id'
EC2_PRIVATE_RT_ID_CACHE_KEY = 'floci-lab:ec2:vpc-networking:private-rt-id'
EC2_PUBLIC_ASSOC_ID_CACHE_KEY = 'floci-lab:ec2:vpc-networking:public-assoc-id'
EC2_PRIVATE_ASSOC_ID_CACHE_KEY = 'floci-lab:ec2:vpc-networking:private-assoc-id'
EC2_SECURITY_VPC_CIDR = '10.43.0.0/16'
EC2_SECURITY_SUBNET_CIDR = '10.43.1.0/24'
EC2_SECURITY_AZ = 'us-east-1a'
EC2_SECURITY_VPC_TAGS = [
    {'Key': 'Name', 'Value': 'floci-lab-security-vpc'},
    {'Key': 'Lab', 'Value': 'security-controls'},
]
EC2_WEB_SG_NAME = 'floci-lab-web-sg'
EC2_APP_SG_NAME = 'floci-lab-app-sg'
EC2_TRUSTED_CLIENT_CIDR = '203.0.113.0/24'
EC2_NACL_DESIGN = {
    'InboundRules': [
        {
            'RuleNumber': 90,
            'Protocol': 'tcp',
            'RuleAction': 'deny',
            'CidrBlock': '0.0.0.0/0',
            'PortRange': {'From': 22, 'To': 22},
        },
        {
            'RuleNumber': 100,
            'Protocol': 'tcp',
            'RuleAction': 'allow',
            'CidrBlock': EC2_TRUSTED_CLIENT_CIDR,
            'PortRange': {'From': 443, 'To': 443},
        },
    ],
    'OutboundRules': [
        {
            'RuleNumber': 100,
            'Protocol': 'tcp',
            'RuleAction': 'allow',
            'CidrBlock': EC2_TRUSTED_CLIENT_CIDR,
            'PortRange': {'From': 1024, 'To': 65535},
        },
    ],
    'DefaultRule': {
        'RuleNumber': '*',
        'RuleAction': 'deny',
    },
}
EC2_SECURITY_VPC_ID_CACHE_KEY = 'floci-lab:ec2:security-controls:vpc-id'
EC2_SECURITY_SUBNET_ID_CACHE_KEY = 'floci-lab:ec2:security-controls:subnet-id'
EC2_WEB_SG_ID_CACHE_KEY = 'floci-lab:ec2:security-controls:web-sg-id'
EC2_APP_SG_ID_CACHE_KEY = 'floci-lab:ec2:security-controls:app-sg-id'
EC2_SG_REFERENCE_CACHE_KEY = 'floci-lab:ec2:security-controls:sg-reference'
EC2_NACL_BOUNDARY_CACHE_KEY = 'floci-lab:ec2:security-controls:nacl-boundary'
EC2_ENDPOINT_VPC_CIDR = '10.44.0.0/16'
EC2_ENDPOINT_SUBNET_CIDR = '10.44.1.0/24'
EC2_ENDPOINT_AZ = 'us-east-1a'
EC2_ENDPOINT_BUCKET_NAME = 'floci-lab-private-s3-data'
EC2_ENDPOINT_VPC_TAGS = [
    {'Key': 'Name', 'Value': 'floci-lab-s3-endpoint-vpc'},
    {'Key': 'Lab', 'Value': 's3-gateway-endpoint'},
]
EC2_ENDPOINT_POLICY = {
    'Version': '2012-10-17',
    'Statement': [{
        'Effect': 'Allow',
        'Principal': '*',
        'Action': ['s3:ListBucket', 's3:GetObject'],
        'Resource': [
            f'arn:aws:s3:::{EC2_ENDPOINT_BUCKET_NAME}',
            f'arn:aws:s3:::{EC2_ENDPOINT_BUCKET_NAME}/*',
        ],
    }],
}
EC2_ENDPOINT_VPC_ID_CACHE_KEY = 'floci-lab:ec2:s3-endpoint:vpc-id'
EC2_ENDPOINT_SUBNET_ID_CACHE_KEY = 'floci-lab:ec2:s3-endpoint:subnet-id'
EC2_ENDPOINT_RT_ID_CACHE_KEY = 'floci-lab:ec2:s3-endpoint:route-table-id'
EC2_ENDPOINT_ASSOC_ID_CACHE_KEY = 'floci-lab:ec2:s3-endpoint:association-id'
EC2_ENDPOINT_ID_CACHE_KEY = 'floci-lab:ec2:s3-endpoint:endpoint-id'
EC2_ENDPOINT_CONFIGURED_CACHE_KEY = 'floci-lab:ec2:s3-endpoint:configured'
EC2_ENDPOINT_ROUTE_BOUNDARY_CACHE_KEY = 'floci-lab:ec2:s3-endpoint:route-boundary'
EC2_INTERFACE_VPC_CIDR = '10.45.0.0/16'
EC2_INTERFACE_SUBNET_CIDR = '10.45.1.0/24'
EC2_INTERFACE_AZ = 'us-east-1a'
EC2_INTERFACE_QUEUE_NAME = 'floci-lab-private-sqs'
EC2_INTERFACE_QUEUE_ARN = (
    f'arn:aws:sqs:{AWS_REGION}:{AWS_ACCOUNT_ID}:{EC2_INTERFACE_QUEUE_NAME}'
)
EC2_INTERFACE_SG_NAME = 'floci-lab-sqs-endpoint-sg'
EC2_INTERFACE_VPC_TAGS = [
    {'Key': 'Name', 'Value': 'floci-lab-sqs-interface-endpoint-vpc'},
    {'Key': 'Lab', 'Value': 'sqs-interface-endpoint'},
]
EC2_INTERFACE_POLICY = {
    'Version': '2012-10-17',
    'Statement': [{
        'Effect': 'Allow',
        'Principal': '*',
        'Action': ['sqs:GetQueueAttributes', 'sqs:SendMessage'],
        'Resource': EC2_INTERFACE_QUEUE_ARN,
    }],
}
EC2_INTERFACE_VPC_ID_CACHE_KEY = 'floci-lab:ec2:sqs-interface:vpc-id'
EC2_INTERFACE_SUBNET_ID_CACHE_KEY = 'floci-lab:ec2:sqs-interface:subnet-id'
EC2_INTERFACE_SG_ID_CACHE_KEY = 'floci-lab:ec2:sqs-interface:sg-id'
EC2_INTERFACE_ENDPOINT_ID_CACHE_KEY = 'floci-lab:ec2:sqs-interface:endpoint-id'
EC2_INTERFACE_CONFIGURED_CACHE_KEY = 'floci-lab:ec2:sqs-interface:configured'
EC2_INTERFACE_INSPECTED_CACHE_KEY = 'floci-lab:ec2:sqs-interface:inspected'
ALICE_LIST_BUCKETS_POLICY = {
    'Version': '2012-10-17',
    'Statement': [
        {
            'Effect': 'Allow',
            'Action': 's3:ListAllMyBuckets',
            'Resource': '*',
        },
    ],
}
FLOCI_APPLICATION_TRUST_POLICY = {
    'Version': '2012-10-17',
    'Statement': [
        {
            'Effect': 'Allow',
            'Principal': {'Service': 'lambda.amazonaws.com'},
            'Action': 'sts:AssumeRole',
        },
    ],
}
FLOCI_EC2_TRUST_POLICY = {
    'Version': '2012-10-17',
    'Statement': [
        {
            'Effect': 'Allow',
            'Principal': {'Service': 'ec2.amazonaws.com'},
            'Action': 'sts:AssumeRole',
        },
    ],
}

IAM_CREATE_USER_LAB = {
    'service': 'iam',
    'key': 'create-user-alice',
    'title': 'Create an IAM user',
    'description': 'Create a local IAM user named Alice and verify that IAM can read it back.',
    'steps': [
        {
            'key': 'create-user',
            'title': 'Create user Alice',
            'command': 'aws iam create-user --user-name Alice',
            'explanation': 'Creates a local IAM user named Alice through the IAM CreateUser API.',
        },
    ],
}

IAM_ATTACH_POLICY_LAB = {
    'service': 'iam',
    'key': 'attach-policy-alice',
    'title': 'Attach a managed policy to Alice',
    'description': 'Create a customer managed policy, attach it to Alice, and inspect the policy attachment.',
    'steps': [
        {
            'key': 'create-user',
            'title': 'Create user Alice',
            'command': 'aws iam create-user --user-name Alice',
            'explanation': 'Ensures the IAM user Alice exists before permissions are attached.',
        },
        {
            'key': 'create-policy',
            'title': 'Create a customer managed policy',
            'command': 'aws iam create-policy --policy-name AliceListBucketsPolicy --policy-document file://alice-list-buckets-policy.json',
            'explanation': 'Creates a reusable customer managed policy that allows listing S3 buckets.',
            'artifact_label': 'alice-list-buckets-policy.json',
            'artifact': json.dumps(ALICE_LIST_BUCKETS_POLICY, indent=2),
        },
        {
            'key': 'attach-policy',
            'title': 'Attach the policy to Alice',
            'command': f'aws iam attach-user-policy --user-name Alice --policy-arn {ALICE_POLICY_ARN}',
            'explanation': 'Attaches the customer managed policy to Alice as an identity-based permission.',
        },
        {
            'key': 'list-attached-policies',
            'title': 'List Alice attached policies',
            'command': 'aws iam list-attached-user-policies --user-name Alice',
            'explanation': 'Reads Alice policy attachments and verifies the managed policy is attached.',
        },
    ],
}

IAM_ACCESS_KEY_LAB = {
    'service': 'iam',
    'key': 'access-key-alice',
    'title': 'Create an access key for Alice',
    'description': 'Create programmatic credentials for Alice, then list the key metadata IAM stores.',
    'steps': [
        {
            'key': 'create-user',
            'title': 'Create user Alice',
            'command': 'aws iam create-user --user-name Alice',
            'explanation': 'Ensures the IAM user Alice exists before issuing programmatic credentials.',
        },
        {
            'key': 'create-access-key',
            'title': 'Create Alice access key',
            'command': 'aws iam create-access-key --user-name Alice',
            'explanation': 'Creates an access key pair for Alice. In real AWS, the secret access key is shown only once.',
        },
        {
            'key': 'list-access-keys',
            'title': 'List Alice access keys',
            'command': 'aws iam list-access-keys --user-name Alice',
            'explanation': 'Lists Alice access key metadata, including key ID, status, and create date.',
        },
    ],
}

IAM_GROUP_MEMBERSHIP_LAB = {
    'service': 'iam',
    'key': 'group-membership-alice',
    'title': 'Add Alice to an IAM group',
    'description': 'Create an IAM group, add Alice to it, and inspect the group membership.',
    'steps': [
        {
            'key': 'create-user',
            'title': 'Create user Alice',
            'command': 'aws iam create-user --user-name Alice',
            'explanation': 'Ensures the IAM user Alice exists before adding her to a group.',
        },
        {
            'key': 'create-group',
            'title': 'Create the FlociDevelopers group',
            'command': f'aws iam create-group --group-name {FLOCI_DEVELOPERS_GROUP_NAME}',
            'explanation': 'Creates an IAM group that can collect users under shared permissions.',
        },
        {
            'key': 'add-user-to-group',
            'title': 'Add Alice to the group',
            'command': f'aws iam add-user-to-group --group-name {FLOCI_DEVELOPERS_GROUP_NAME} --user-name Alice',
            'explanation': 'Adds Alice as a member of the FlociDevelopers group.',
        },
        {
            'key': 'get-group',
            'title': 'Inspect group membership',
            'command': f'aws iam get-group --group-name {FLOCI_DEVELOPERS_GROUP_NAME}',
            'explanation': 'Reads the group and verifies that Alice appears in the returned Users list.',
        },
    ],
}

IAM_GROUP_POLICY_LAB = {
    'service': 'iam',
    'key': 'group-policy-floci-developers',
    'title': 'Attach a policy to an IAM group',
    'description': 'Create a group policy, attach it to FlociDevelopers, and inspect the group policy attachment.',
    'steps': [
        {
            'key': 'create-user',
            'title': 'Create user Alice',
            'command': 'aws iam create-user --user-name Alice',
            'explanation': 'Ensures the IAM user Alice exists before building the group permissions workflow.',
        },
        {
            'key': 'create-group',
            'title': 'Create the FlociDevelopers group',
            'command': f'aws iam create-group --group-name {FLOCI_DEVELOPERS_GROUP_NAME}',
            'explanation': 'Ensures the group exists before permissions are attached to it.',
        },
        {
            'key': 'add-user-to-group',
            'title': 'Add Alice to the group',
            'command': f'aws iam add-user-to-group --group-name {FLOCI_DEVELOPERS_GROUP_NAME} --user-name Alice',
            'explanation': 'Adds Alice to the group so group permissions can apply to a user.',
        },
        {
            'key': 'create-policy',
            'title': 'Create a group managed policy',
            'command': f'aws iam create-policy --policy-name {FLOCI_DEVELOPERS_POLICY_NAME} --policy-document file://floci-developers-list-buckets-policy.json',
            'explanation': 'Creates a reusable customer managed policy for the FlociDevelopers group.',
            'artifact_label': 'floci-developers-list-buckets-policy.json',
            'artifact': json.dumps(ALICE_LIST_BUCKETS_POLICY, indent=2),
        },
        {
            'key': 'attach-group-policy',
            'title': 'Attach the policy to the group',
            'command': f'aws iam attach-group-policy --group-name {FLOCI_DEVELOPERS_GROUP_NAME} --policy-arn {FLOCI_DEVELOPERS_POLICY_ARN}',
            'explanation': 'Attaches the managed policy to the group so members inherit the permission.',
        },
        {
            'key': 'list-attached-group-policies',
            'title': 'List group attached policies',
            'command': f'aws iam list-attached-group-policies --group-name {FLOCI_DEVELOPERS_GROUP_NAME}',
            'explanation': 'Reads group policy attachments and verifies the managed policy is attached.',
        },
    ],
}

IAM_INLINE_POLICY_LAB = {
    'service': 'iam',
    'key': 'inline-policy-alice',
    'title': 'Attach an inline policy to Alice',
    'description': 'Create an inline policy embedded in Alice, then list and inspect the policy document.',
    'steps': [
        {
            'key': 'create-user',
            'title': 'Create user Alice',
            'command': 'aws iam create-user --user-name Alice',
            'explanation': 'Ensures the IAM user Alice exists before an inline policy is added.',
        },
        {
            'key': 'put-user-policy',
            'title': 'Add an inline policy to Alice',
            'command': f'aws iam put-user-policy --user-name Alice --policy-name {ALICE_INLINE_POLICY_NAME} --policy-document file://alice-inline-list-buckets-policy.json',
            'explanation': 'Embeds a policy directly in Alice instead of creating a separately reusable managed policy.',
            'artifact_label': 'alice-inline-list-buckets-policy.json',
            'artifact': json.dumps(ALICE_LIST_BUCKETS_POLICY, indent=2),
        },
        {
            'key': 'list-user-policies',
            'title': 'List Alice inline policies',
            'command': 'aws iam list-user-policies --user-name Alice',
            'explanation': 'Lists the names of inline policies embedded in Alice.',
        },
        {
            'key': 'get-user-policy',
            'title': 'Inspect the inline policy',
            'command': f'aws iam get-user-policy --user-name Alice --policy-name {ALICE_INLINE_POLICY_NAME}',
            'explanation': 'Retrieves the inline policy document and verifies its permissions.',
        },
    ],
}

IAM_ROLE_TRUST_LAB = {
    'service': 'iam',
    'key': 'role-trust-policy',
    'title': 'Create a role with a trust policy',
    'description': 'Create an application role, inspect who can assume it, and add the permissions the role receives.',
    'steps': [
        {
            'key': 'create-role',
            'title': 'Create the application role',
            'command': f'aws iam create-role --role-name {FLOCI_APPLICATION_ROLE_NAME} --assume-role-policy-document file://floci-application-role-trust-policy.json',
            'explanation': 'Creates a role whose trust policy allows the Lambda service to assume it.',
            'artifact_label': 'floci-application-role-trust-policy.json',
            'artifact': json.dumps(FLOCI_APPLICATION_TRUST_POLICY, indent=2),
        },
        {
            'key': 'get-role',
            'title': 'Inspect the role and trust policy',
            'command': f'aws iam get-role --role-name {FLOCI_APPLICATION_ROLE_NAME}',
            'explanation': 'Returns the role metadata and its assume-role trust policy.',
        },
        {
            'key': 'put-role-policy',
            'title': 'Add role permissions',
            'command': f'aws iam put-role-policy --role-name {FLOCI_APPLICATION_ROLE_NAME} --policy-name {FLOCI_APPLICATION_ROLE_POLICY_NAME} --policy-document file://floci-application-list-buckets-policy.json',
            'explanation': 'Adds an inline permissions policy that defines what the assumed role can do.',
            'artifact_label': 'floci-application-list-buckets-policy.json',
            'artifact': json.dumps(ALICE_LIST_BUCKETS_POLICY, indent=2),
        },
        {
            'key': 'get-role-policy',
            'title': 'Inspect the role permissions',
            'command': f'aws iam get-role-policy --role-name {FLOCI_APPLICATION_ROLE_NAME} --policy-name {FLOCI_APPLICATION_ROLE_POLICY_NAME}',
            'explanation': 'Retrieves the inline permissions policy so it can be compared with the role trust policy.',
        },
    ],
}

IAM_INSTANCE_PROFILE_LAB = {
    'service': 'iam',
    'key': 'ec2-instance-profile',
    'title': 'Create an EC2 instance profile',
    'description': 'Create an EC2-trusted role, place it in an instance profile, and verify the association.',
    'steps': [
        {
            'key': 'create-role',
            'title': 'Create the EC2 role',
            'command': f'aws iam create-role --role-name {FLOCI_EC2_ROLE_NAME} --assume-role-policy-document file://floci-ec2-role-trust-policy.json',
            'explanation': 'Creates a role whose trust policy allows the EC2 service to assume it.',
            'artifact_label': 'floci-ec2-role-trust-policy.json',
            'artifact': json.dumps(FLOCI_EC2_TRUST_POLICY, indent=2),
        },
        {
            'key': 'create-instance-profile',
            'title': 'Create the instance profile',
            'command': f'aws iam create-instance-profile --instance-profile-name {FLOCI_EC2_INSTANCE_PROFILE_NAME}',
            'explanation': 'Creates the IAM container EC2 uses to make a role available to an instance.',
        },
        {
            'key': 'add-role-to-instance-profile',
            'title': 'Add the role to the profile',
            'command': f'aws iam add-role-to-instance-profile --instance-profile-name {FLOCI_EC2_INSTANCE_PROFILE_NAME} --role-name {FLOCI_EC2_ROLE_NAME}',
            'explanation': 'Associates the EC2-trusted role with the instance profile.',
        },
        {
            'key': 'get-instance-profile',
            'title': 'Inspect the instance profile',
            'command': f'aws iam get-instance-profile --instance-profile-name {FLOCI_EC2_INSTANCE_PROFILE_NAME}',
            'explanation': 'Returns the instance profile and verifies that it contains FlociEc2Role.',
        },
        {
            'key': 'list-instance-profiles-for-role',
            'title': 'List profiles for the role',
            'command': f'aws iam list-instance-profiles-for-role --role-name {FLOCI_EC2_ROLE_NAME}',
            'explanation': 'Reads the relationship from the role side and verifies the same association.',
        },
    ],
}

S3_CREATE_BUCKET_LAB = {
    'service': 's3',
    'key': 'create-bucket',
    'title': 'Create and inspect an S3 bucket',
    'description': 'Create a local S3 bucket, confirm it is reachable, and find it in the account bucket list.',
    'steps': [
        {
            'key': 'create-bucket',
            'title': 'Create the bucket',
            'command': f'aws s3api create-bucket --bucket {S3_BASICS_BUCKET_NAME}',
            'explanation': 'Creates an S3 bucket in the configured local AWS region.',
        },
        {
            'key': 'head-bucket',
            'title': 'Confirm the bucket is reachable',
            'command': f'aws s3api head-bucket --bucket {S3_BASICS_BUCKET_NAME}',
            'explanation': 'Checks that the bucket exists and the current identity can access it.',
        },
        {
            'key': 'list-buckets',
            'title': 'List account buckets',
            'command': 'aws s3api list-buckets',
            'explanation': f'Lists S3 buckets and verifies that {S3_BASICS_BUCKET_NAME} appears in the result.',
        },
    ],
}

S3_OBJECT_WORKFLOW_LAB = {
    'service': 's3',
    'key': 'object-workflow',
    'title': 'Upload and retrieve an S3 object',
    'description': 'Upload a known text file, discover it in the bucket, inspect its metadata, and download its exact contents.',
    'steps': [
        {
            'key': 'create-bucket',
            'title': 'Create the object lab bucket',
            'command': f'aws s3api create-bucket --bucket {S3_OBJECTS_BUCKET_NAME}',
            'explanation': 'Creates a dedicated bucket for learning the S3 object workflow.',
        },
        {
            'key': 'put-object',
            'title': 'Upload hello.txt',
            'command': f'aws s3api put-object --bucket {S3_OBJECTS_BUCKET_NAME} --key {S3_HELLO_OBJECT_KEY} --body hello.txt --content-type text/plain',
            'explanation': 'Uploads the artifact bytes under the object key hello.txt with a text content type.',
            'artifact_label': 'hello.txt',
            'artifact': S3_HELLO_OBJECT_TEXT,
        },
        {
            'key': 'list-objects',
            'title': 'List bucket objects',
            'command': f'aws s3api list-objects-v2 --bucket {S3_OBJECTS_BUCKET_NAME}',
            'explanation': 'Lists current objects and verifies that hello.txt appears with the expected size.',
        },
        {
            'key': 'head-object',
            'title': 'Inspect object metadata',
            'command': f'aws s3api head-object --bucket {S3_OBJECTS_BUCKET_NAME} --key {S3_HELLO_OBJECT_KEY}',
            'explanation': 'Reads object metadata without downloading the object body.',
        },
        {
            'key': 'get-object',
            'title': 'Download the object',
            'command': f'aws s3api get-object --bucket {S3_OBJECTS_BUCKET_NAME} --key {S3_HELLO_OBJECT_KEY} downloaded-hello.txt',
            'explanation': 'Downloads hello.txt and verifies that its bytes match the original artifact.',
        },
    ],
}

S3_PREFIX_COPY_LAB = {
    'service': 's3',
    'key': 'prefix-copy',
    'title': 'Organize and copy objects with key prefixes',
    'description': 'Upload a report under an incoming prefix, discover it by prefix, and copy it into an archive prefix.',
    'steps': [
        {
            'key': 'create-bucket',
            'title': 'Create the prefixes lab bucket',
            'command': f'aws s3api create-bucket --bucket {S3_PREFIXES_BUCKET_NAME}',
            'explanation': 'Creates a dedicated bucket for learning S3 key prefixes and object copying.',
        },
        {
            'key': 'put-source-object',
            'title': 'Upload the incoming report',
            'command': f'aws s3api put-object --bucket {S3_PREFIXES_BUCKET_NAME} --key {S3_REPORT_SOURCE_KEY} --body report.txt --content-type text/plain',
            'explanation': 'Uploads report.txt under the incoming/ key prefix.',
            'artifact_label': 'report.txt',
            'artifact': S3_REPORT_TEXT,
        },
        {
            'key': 'list-incoming-prefix',
            'title': 'List the incoming prefix',
            'command': f'aws s3api list-objects-v2 --bucket {S3_PREFIXES_BUCKET_NAME} --prefix incoming/',
            'explanation': 'Filters the flat object namespace to keys beginning with incoming/.',
        },
        {
            'key': 'copy-object',
            'title': 'Copy the report to archive',
            'command': f'aws s3api copy-object --copy-source {S3_PREFIXES_BUCKET_NAME}/{S3_REPORT_SOURCE_KEY} --bucket {S3_PREFIXES_BUCKET_NAME} --key {S3_REPORT_ARCHIVE_KEY}',
            'explanation': 'Copies the source object to a new key under archive/ while leaving the original object in place.',
        },
        {
            'key': 'list-archive-prefix',
            'title': 'List the archive prefix',
            'command': f'aws s3api list-objects-v2 --bucket {S3_PREFIXES_BUCKET_NAME} --prefix archive/',
            'explanation': 'Filters the bucket to archive/ and verifies the copied report is present.',
        },
    ],
}

S3_METADATA_TAGS_LAB = {
    'service': 's3',
    'key': 'metadata-tags',
    'title': 'Add object metadata and tags',
    'description': 'Upload an invoice with content and user metadata, then apply and inspect independently editable object tags.',
    'steps': [
        {
            'key': 'create-bucket',
            'title': 'Create the metadata lab bucket',
            'command': f'aws s3api create-bucket --bucket {S3_METADATA_BUCKET_NAME}',
            'explanation': 'Creates a dedicated bucket for comparing object metadata and tags.',
        },
        {
            'key': 'put-object',
            'title': 'Upload the invoice with metadata',
            'command': f'aws s3api put-object --bucket {S3_METADATA_BUCKET_NAME} --key {S3_INVOICE_OBJECT_KEY} --body invoice.txt --content-type text/plain --metadata project=floci,classification=internal',
            'explanation': 'Uploads the invoice with a system-managed content type and custom project and classification metadata.',
            'artifact_label': 'invoice.txt',
            'artifact': S3_INVOICE_TEXT,
        },
        {
            'key': 'head-object',
            'title': 'Inspect object metadata',
            'command': f'aws s3api head-object --bucket {S3_METADATA_BUCKET_NAME} --key {S3_INVOICE_OBJECT_KEY}',
            'explanation': 'Reads the object content type, size, ETag, and user-defined metadata without downloading the body.',
        },
        {
            'key': 'put-object-tagging',
            'title': 'Apply object tags',
            'command': f'aws s3api put-object-tagging --bucket {S3_METADATA_BUCKET_NAME} --key {S3_INVOICE_OBJECT_KEY} --tagging file://invoice-tags.json',
            'explanation': 'Adds tags that can be updated independently from the object body and metadata.',
            'artifact_label': 'invoice-tags.json',
            'artifact': json.dumps({'TagSet': S3_INVOICE_TAGS}, indent=2),
        },
        {
            'key': 'get-object-tagging',
            'title': 'Inspect object tags',
            'command': f'aws s3api get-object-tagging --bucket {S3_METADATA_BUCKET_NAME} --key {S3_INVOICE_OBJECT_KEY}',
            'explanation': 'Returns the current object tag set for operational classification and automation.',
        },
    ],
}

S3_VERSION_RECOVERY_LAB = {
    'service': 's3',
    'key': 'version-recovery',
    'title': 'Enable versioning and recover an earlier object version',
    'description': 'Enable bucket versioning, overwrite one object, inspect both versions, and retrieve the original contents.',
    'steps': [
        {
            'key': 'create-bucket',
            'title': 'Create the versioning lab bucket',
            'command': f'aws s3api create-bucket --bucket {S3_VERSIONING_BUCKET_NAME}',
            'explanation': 'Creates a dedicated bucket for learning S3 object versioning.',
        },
        {
            'key': 'enable-versioning',
            'title': 'Enable bucket versioning',
            'command': f'aws s3api put-bucket-versioning --bucket {S3_VERSIONING_BUCKET_NAME} --versioning-configuration Status=Enabled',
            'explanation': 'Enables version IDs for future writes to objects in the bucket.',
        },
        {
            'key': 'put-version-one',
            'title': 'Upload configuration v1',
            'command': f'aws s3api put-object --bucket {S3_VERSIONING_BUCKET_NAME} --key {S3_CONFIGURATION_KEY} --body configuration-v1.txt --content-type text/plain',
            'explanation': 'Creates the first stored version of configuration.txt.',
            'artifact_label': 'configuration-v1.txt',
            'artifact': S3_CONFIGURATION_V1_TEXT,
        },
        {
            'key': 'put-version-two',
            'title': 'Overwrite with configuration v2',
            'command': f'aws s3api put-object --bucket {S3_VERSIONING_BUCKET_NAME} --key {S3_CONFIGURATION_KEY} --body configuration-v2.txt --content-type text/plain',
            'explanation': 'Writes a new latest version while preserving the earlier v1 object version.',
            'artifact_label': 'configuration-v2.txt',
            'artifact': S3_CONFIGURATION_V2_TEXT,
        },
        {
            'key': 'list-object-versions',
            'title': 'List stored object versions',
            'command': f'aws s3api list-object-versions --bucket {S3_VERSIONING_BUCKET_NAME} --prefix {S3_CONFIGURATION_KEY}',
            'explanation': 'Returns version IDs and identifies which version is currently latest.',
        },
        {
            'key': 'get-version-one',
            'title': 'Recover configuration v1',
            'command': f'aws s3api get-object --bucket {S3_VERSIONING_BUCKET_NAME} --key {S3_CONFIGURATION_KEY} --version-id <v1-version-id> recovered-configuration.txt',
            'explanation': 'Discovers the version containing v1 and downloads those earlier bytes directly.',
        },
    ],
}

S3_PRESIGNED_URL_LAB = {
    'service': 's3',
    'key': 'presigned-url',
    'title': 'Generate temporary access with a presigned URL',
    'description': 'Upload a private object, generate a five-minute signed URL, and redeem that URL without sending AWS credentials.',
    'steps': [
        {
            'key': 'create-bucket',
            'title': 'Create the presigned URL lab bucket',
            'command': f'aws s3api create-bucket --bucket {S3_PRESIGNED_BUCKET_NAME}',
            'explanation': 'Creates a dedicated bucket for learning temporary signed object access.',
        },
        {
            'key': 'put-object',
            'title': 'Upload the shared guide',
            'command': f'aws s3api put-object --bucket {S3_PRESIGNED_BUCKET_NAME} --key {S3_PRESIGNED_OBJECT_KEY} --body guide.txt --content-type text/plain',
            'explanation': 'Uploads the object that will be shared temporarily through a signed URL.',
            'artifact_label': 'guide.txt',
            'artifact': S3_PRESIGNED_GUIDE_TEXT,
        },
        {
            'key': 'presign-object',
            'title': 'Generate and redeem a presigned URL',
            'command': f'aws s3 presign s3://{S3_PRESIGNED_BUCKET_NAME}/{S3_PRESIGNED_OBJECT_KEY} --expires-in {S3_PRESIGNED_EXPIRES_IN}',
            'explanation': 'Creates a bearer URL signed with the current identity, then redeems it to verify temporary access to the exact guide bytes.',
        },
    ],
}

S3_BUCKET_SECURITY_LAB = {
    'service': 's3',
    'key': 'bucket-security',
    'title': 'Block public access and apply a bucket policy',
    'description': 'Enable every Public Access Block safeguard, then add a non-public policy granting one principal one bucket-level action.',
    'steps': [
        {
            'key': 'create-bucket',
            'title': 'Create the security lab bucket',
            'command': f'aws s3api create-bucket --bucket {S3_SECURITY_BUCKET_NAME}',
            'explanation': 'Creates a dedicated bucket for learning layered S3 access controls.',
        },
        {
            'key': 'put-public-access-block',
            'title': 'Block public access',
            'command': f'aws s3api put-public-access-block --bucket {S3_SECURITY_BUCKET_NAME} --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true',
            'explanation': 'Enables all four bucket-level safeguards against public ACLs and public bucket policies.',
        },
        {
            'key': 'get-public-access-block',
            'title': 'Inspect public-access protection',
            'command': f'aws s3api get-public-access-block --bucket {S3_SECURITY_BUCKET_NAME}',
            'explanation': 'Reads the effective Public Access Block configuration and verifies every safeguard is enabled.',
        },
        {
            'key': 'put-bucket-policy',
            'title': 'Apply a least-privilege bucket policy',
            'command': f'aws s3api put-bucket-policy --bucket {S3_SECURITY_BUCKET_NAME} --policy file://bucket-policy.json',
            'explanation': 'Allows only the local account root to list this bucket; it does not make the bucket public.',
            'artifact_label': 'bucket-policy.json',
            'artifact': json.dumps(S3_SECURITY_BUCKET_POLICY, indent=2),
        },
        {
            'key': 'get-bucket-policy',
            'title': 'Inspect the bucket policy',
            'command': f'aws s3api get-bucket-policy --bucket {S3_SECURITY_BUCKET_NAME}',
            'explanation': 'Returns the resource-based policy and verifies its principal, action, and bucket ARN.',
        },
    ],
}

S3_DEFAULT_ENCRYPTION_LAB = {
    'service': 's3',
    'key': 'default-encryption',
    'title': 'Enable default bucket encryption',
    'description': 'Configure SSE-S3 as the bucket default, inspect the setting, and upload an object after the protection is enabled.',
    'steps': [
        {
            'key': 'create-bucket',
            'title': 'Create the encryption lab bucket',
            'command': f'aws s3api create-bucket --bucket {S3_ENCRYPTION_BUCKET_NAME}',
            'explanation': 'Creates a dedicated bucket for learning default encryption at rest.',
        },
        {
            'key': 'put-bucket-encryption',
            'title': 'Enable default SSE-S3 encryption',
            'command': f'aws s3api put-bucket-encryption --bucket {S3_ENCRYPTION_BUCKET_NAME} --server-side-encryption-configuration file://encryption.json',
            'explanation': 'Configures S3-managed AES-256 encryption as the default for new objects.',
            'artifact_label': 'encryption.json',
            'artifact': json.dumps(S3_SSE_S3_CONFIGURATION, indent=2),
        },
        {
            'key': 'get-bucket-encryption',
            'title': 'Inspect default encryption',
            'command': f'aws s3api get-bucket-encryption --bucket {S3_ENCRYPTION_BUCKET_NAME}',
            'explanation': 'Reads the bucket configuration and verifies the default algorithm is AES256.',
        },
        {
            'key': 'put-object',
            'title': 'Upload a protected record',
            'command': f'aws s3api put-object --bucket {S3_ENCRYPTION_BUCKET_NAME} --key {S3_ENCRYPTION_OBJECT_KEY} --body record.txt --content-type text/plain',
            'explanation': 'Uploads an object after the bucket default encryption configuration is active.',
            'artifact_label': 'record.txt',
            'artifact': S3_ENCRYPTION_RECORD_TEXT,
        },
        {
            'key': 'head-object',
            'title': 'Inspect the uploaded object',
            'command': f'aws s3api head-object --bucket {S3_ENCRYPTION_BUCKET_NAME} --key {S3_ENCRYPTION_OBJECT_KEY}',
            'explanation': 'Reads the object metadata and verifies its exact content while the bucket AES256 default remains enabled.',
        },
    ],
}

S3_LIFECYCLE_RETENTION_LAB = {
    'service': 's3',
    'key': 'lifecycle-retention',
    'title': 'Automate retention with an S3 lifecycle rule',
    'description': 'Upload an application log, configure S3 to expire objects under logs/ after 30 days, and inspect the saved lifecycle rule.',
    'steps': [
        {
            'key': 'create-bucket',
            'title': 'Create the lifecycle lab bucket',
            'command': f'aws s3api create-bucket --bucket {S3_LIFECYCLE_BUCKET_NAME}',
            'explanation': 'Creates a dedicated bucket for learning automated S3 retention.',
        },
        {
            'key': 'put-object',
            'title': 'Upload an application log',
            'command': f'aws s3api put-object --bucket {S3_LIFECYCLE_BUCKET_NAME} --key {S3_LIFECYCLE_OBJECT_KEY} --body app.log --content-type text/plain',
            'explanation': 'Uploads a sample log beneath the logs/ prefix targeted by the lifecycle rule.',
            'artifact_label': 'app.log',
            'artifact': S3_LIFECYCLE_LOG_TEXT,
        },
        {
            'key': 'put-lifecycle-configuration',
            'title': 'Expire logs after 30 days',
            'command': f'aws s3api put-bucket-lifecycle-configuration --bucket {S3_LIFECYCLE_BUCKET_NAME} --lifecycle-configuration file://lifecycle.json',
            'explanation': 'Adds an enabled lifecycle rule that expires objects under logs/ 30 days after creation. AWS performs lifecycle actions asynchronously.',
            'artifact_label': 'lifecycle.json',
            'artifact': json.dumps(S3_LIFECYCLE_CONFIGURATION, indent=2),
        },
        {
            'key': 'get-lifecycle-configuration',
            'title': 'Inspect the retention rule',
            'command': f'aws s3api get-bucket-lifecycle-configuration --bucket {S3_LIFECYCLE_BUCKET_NAME}',
            'explanation': 'Reads the saved lifecycle configuration and verifies the rule scope, status, and 30-day expiration.',
        },
    ],
}

S3_CORS_LAB = {
    'service': 's3',
    'key': 'bucket-cors',
    'title': 'Configure bucket CORS for a local web app',
    'description': 'Allow a browser app on localhost:3000 to read objects, then inspect the saved cross-origin access rule.',
    'steps': [
        {
            'key': 'create-bucket',
            'title': 'Create the CORS lab bucket',
            'command': f'aws s3api create-bucket --bucket {S3_CORS_BUCKET_NAME}',
            'explanation': 'Creates a dedicated bucket for learning browser cross-origin access configuration.',
        },
        {
            'key': 'put-bucket-cors',
            'title': 'Allow the local web app to read objects',
            'command': f'aws s3api put-bucket-cors --bucket {S3_CORS_BUCKET_NAME} --cors-configuration file://cors.json',
            'explanation': 'Allows GET and HEAD requests from http://localhost:3000, permits the Authorization request header, exposes ETag, and caches preflight results for one hour.',
            'artifact_label': 'cors.json',
            'artifact': json.dumps(S3_CORS_CONFIGURATION, indent=2),
        },
        {
            'key': 'get-bucket-cors',
            'title': 'Inspect the CORS rule',
            'command': f'aws s3api get-bucket-cors --bucket {S3_CORS_BUCKET_NAME}',
            'explanation': 'Reads the saved CORS configuration and verifies the exact origin, methods, headers, and preflight cache duration.',
        },
    ],
}

S3_OBJECT_NOTIFICATIONS_LAB = {
    'service': 's3',
    'key': 'object-notifications-sqs',
    'title': 'Send S3 object-created events to SQS',
    'description': 'Create a queue and bucket, authorize S3 delivery, configure object-created notifications, and prove an uploaded object produces an SQS event.',
    'steps': [
        {
            'key': 'create-queue',
            'title': 'Create the event queue',
            'command': f'aws sqs create-queue --queue-name {S3_NOTIFICATIONS_QUEUE_NAME}',
            'explanation': 'Creates the SQS destination that will receive S3 object-created events.',
        },
        {
            'key': 'set-queue-policy',
            'title': 'Authorize S3 to send messages',
            'command': 'aws sqs set-queue-attributes --queue-url <queue-url> --attributes file://queue-attributes.json',
            'explanation': 'Adds the queue resource policy AWS requires before S3 can publish events from this specific bucket and account.',
            'artifact_label': 'queue-attributes.json',
            'artifact': json.dumps(
                {'Policy': json.dumps(S3_NOTIFICATIONS_QUEUE_POLICY)},
                indent=2,
            ),
        },
        {
            'key': 'create-bucket',
            'title': 'Create the notification bucket',
            'command': f'aws s3api create-bucket --bucket {S3_NOTIFICATIONS_BUCKET_NAME}',
            'explanation': 'Creates the source bucket whose object writes will emit events.',
        },
        {
            'key': 'put-notification-configuration',
            'title': 'Connect object-created events to SQS',
            'command': f'aws s3api put-bucket-notification-configuration --bucket {S3_NOTIFICATIONS_BUCKET_NAME} --notification-configuration file://notification.json',
            'explanation': 'Routes every S3 object-created event from the bucket to the lab queue.',
            'artifact_label': 'notification.json',
            'artifact': json.dumps(S3_NOTIFICATIONS_CONFIGURATION, indent=2),
        },
        {
            'key': 'get-notification-configuration',
            'title': 'Inspect the notification wiring',
            'command': f'aws s3api get-bucket-notification-configuration --bucket {S3_NOTIFICATIONS_BUCKET_NAME}',
            'explanation': 'Reads the saved destination ARN and event selection before any object is uploaded.',
        },
        {
            'key': 'put-object',
            'title': 'Upload the report',
            'command': f'aws s3api put-object --bucket {S3_NOTIFICATIONS_BUCKET_NAME} --key {S3_NOTIFICATIONS_OBJECT_KEY} --body report.txt --content-type text/plain',
            'explanation': 'Uploads a known object and causes S3 to emit an ObjectCreated:Put event.',
            'artifact_label': 'report.txt',
            'artifact': S3_NOTIFICATIONS_REPORT_TEXT,
        },
        {
            'key': 'receive-event',
            'title': 'Receive the S3 event from SQS',
            'command': 'aws sqs receive-message --queue-url <queue-url> --max-number-of-messages 10 --visibility-timeout 0 --wait-time-seconds 1',
            'explanation': 'Long-polls the queue and verifies a delivered S3 event names the exact bucket and object key.',
        },
    ],
}

S3_MULTIPART_UPLOAD_LAB = {
    'service': 's3',
    'key': 'multipart-upload',
    'title': 'Complete a multipart upload',
    'description': 'Initiate a multipart upload, send two parts, inspect their ETags, complete the upload, and verify the assembled object.',
    'steps': [
        {
            'key': 'create-bucket',
            'title': 'Create the multipart lab bucket',
            'command': f'aws s3api create-bucket --bucket {S3_MULTIPART_BUCKET_NAME}',
            'explanation': 'Creates a dedicated bucket for learning the multipart upload lifecycle.',
        },
        {
            'key': 'create-multipart-upload',
            'title': 'Initiate the multipart upload',
            'command': f'aws s3api create-multipart-upload --bucket {S3_MULTIPART_BUCKET_NAME} --key {S3_MULTIPART_OBJECT_KEY} --content-type {S3_MULTIPART_CONTENT_TYPE}',
            'explanation': 'Creates an upload ID that identifies this in-progress multipart object.',
        },
        {
            'key': 'upload-part-one',
            'title': 'Upload the 5 MiB first part',
            'command': f'aws s3api upload-part --bucket {S3_MULTIPART_BUCKET_NAME} --key {S3_MULTIPART_OBJECT_KEY} --part-number 1 --upload-id <upload-id> --body part-one.bin',
            'explanation': 'Uploads the first part at the minimum 5 MiB size AWS requires for every non-final multipart part.',
            'artifact_label': 'part-one.bin',
            'artifact': '5 MiB of the byte A, generated by the approved lab action.',
        },
        {
            'key': 'upload-part-two',
            'title': 'Upload the 1 KiB final part',
            'command': f'aws s3api upload-part --bucket {S3_MULTIPART_BUCKET_NAME} --key {S3_MULTIPART_OBJECT_KEY} --part-number 2 --upload-id <upload-id> --body part-two.bin',
            'explanation': 'Uploads the final part, which may be smaller than 5 MiB.',
            'artifact_label': 'part-two.bin',
            'artifact': '1 KiB of the byte B, generated by the approved lab action.',
        },
        {
            'key': 'list-parts',
            'title': 'Inspect uploaded parts',
            'command': f'aws s3api list-parts --bucket {S3_MULTIPART_BUCKET_NAME} --key {S3_MULTIPART_OBJECT_KEY} --upload-id <upload-id>',
            'explanation': 'Returns each part number, size, and ETag needed to complete the upload.',
        },
        {
            'key': 'complete-multipart-upload',
            'title': 'Assemble the final object',
            'command': f'aws s3api complete-multipart-upload --bucket {S3_MULTIPART_BUCKET_NAME} --key {S3_MULTIPART_OBJECT_KEY} --upload-id <upload-id> --multipart-upload file://parts.json',
            'explanation': 'Discovers the current part ETags, orders them by part number, and asks S3 to assemble the final object.',
            'artifact_label': 'parts.json',
            'artifact': json.dumps({
                'Parts': [
                    {'ETag': '<part-1-etag>', 'PartNumber': 1},
                    {'ETag': '<part-2-etag>', 'PartNumber': 2},
                ],
            }, indent=2),
        },
        {
            'key': 'get-object',
            'title': 'Verify the assembled object',
            'command': f'aws s3api get-object --bucket {S3_MULTIPART_BUCKET_NAME} --key {S3_MULTIPART_OBJECT_KEY} downloaded-application.bin',
            'explanation': 'Downloads the completed object and verifies that both parts were concatenated in order with the expected content type and total size.',
        },
    ],
}

SQS_CREATE_QUEUE_LAB = {
    'service': 'sqs',
    'key': 'create-queue',
    'title': 'Create and inspect an SQS queue',
    'description': 'Create a standard queue, resolve its queue URL, inspect its attributes, and find it in the account queue list.',
    'steps': [
        {
            'key': 'create-queue',
            'title': 'Create the queue',
            'command': f'aws sqs create-queue --queue-name {SQS_BASICS_QUEUE_NAME}',
            'explanation': 'Creates a standard SQS queue and returns the queue URL used by later message operations.',
        },
        {
            'key': 'get-queue-url',
            'title': 'Resolve the queue URL',
            'command': f'aws sqs get-queue-url --queue-name {SQS_BASICS_QUEUE_NAME}',
            'explanation': 'Looks up the stable queue URL from its human-readable queue name.',
        },
        {
            'key': 'get-queue-attributes',
            'title': 'Inspect queue attributes',
            'command': 'aws sqs get-queue-attributes --queue-url <queue-url> --attribute-names All',
            'explanation': 'Reads the queue ARN, visibility timeout, retention settings, message counts, and other current attributes.',
        },
        {
            'key': 'list-queues',
            'title': 'List account queues',
            'command': 'aws sqs list-queues',
            'explanation': f'Lists SQS queue URLs and verifies that {SQS_BASICS_QUEUE_NAME} appears in the result.',
        },
    ],
}

SQS_MESSAGE_LIFECYCLE_LAB = {
    'service': 'sqs',
    'key': 'message-lifecycle',
    'title': 'Send, receive, and delete an SQS message',
    'description': 'Ensure the lab queue exists, send a known JSON event, receive and inspect it, then delete it with the live receipt handle.',
    'steps': [
        {
            'key': 'create-queue',
            'title': 'Ensure the queue exists',
            'command': f'aws sqs create-queue --queue-name {SQS_BASICS_QUEUE_NAME}',
            'explanation': 'Creates the shared training queue if it does not already exist.',
        },
        {
            'key': 'send-message',
            'title': 'Send the order event',
            'command': 'aws sqs send-message --queue-url <queue-url> --message-body file://message.json --message-attributes file://message-attributes.json',
            'explanation': 'Sends a known JSON event with a Lab message attribute so the workflow can identify its own message.',
            'artifact_label': 'message.json',
            'artifact': json.dumps(SQS_MESSAGE_BODY, indent=2),
            'secondary_artifact_label': 'message-attributes.json',
            'secondary_artifact': json.dumps(SQS_MESSAGE_ATTRIBUTES, indent=2),
        },
        {
            'key': 'receive-message',
            'title': 'Receive and inspect the event',
            'command': 'aws sqs receive-message --queue-url <queue-url> --max-number-of-messages 10 --visibility-timeout 0 --wait-time-seconds 1 --message-attribute-names All',
            'explanation': 'Long-polls the queue and verifies the exact JSON body and Lab attribute without hiding the message from status checks.',
        },
        {
            'key': 'delete-message',
            'title': 'Delete the processed event',
            'command': 'aws sqs delete-message --queue-url <queue-url> --receipt-handle <receipt-handle>',
            'explanation': 'Receives the matching message to discover its current receipt handle, deletes it, and verifies that it is no longer available.',
        },
    ],
}

SQS_VISIBILITY_TIMEOUT_LAB = {
    'service': 'sqs',
    'key': 'visibility-timeout',
    'title': 'Understand SQS visibility timeout',
    'description': 'Receive a job without deleting it, adjust its visibility timeout, prove it is temporarily hidden, and receive it again when the timeout expires.',
    'steps': [
        {
            'key': 'create-queue',
            'title': 'Ensure the queue exists',
            'command': f'aws sqs create-queue --queue-name {SQS_BASICS_QUEUE_NAME}',
            'explanation': 'Creates the shared training queue if it does not already exist.',
        },
        {
            'key': 'send-message',
            'title': 'Send the job',
            'command': 'aws sqs send-message --queue-url <queue-url> --message-body file://job.json --message-attributes file://message-attributes.json',
            'explanation': 'Sends a known job.ready event identified by a visibility-timeout Lab attribute.',
            'artifact_label': 'job.json',
            'artifact': json.dumps(SQS_VISIBILITY_BODY, indent=2),
            'secondary_artifact_label': 'message-attributes.json',
            'secondary_artifact': json.dumps(SQS_VISIBILITY_ATTRIBUTES, indent=2),
        },
        {
            'key': 'receive-message',
            'title': 'Receive without deleting',
            'command': 'aws sqs receive-message --queue-url <queue-url> --max-number-of-messages 10 --visibility-timeout 30 --wait-time-seconds 1 --message-attribute-names All',
            'explanation': 'Receives the job and stores its current receipt handle while leaving the message in the queue.',
        },
        {
            'key': 'extend-message-visibility',
            'title': 'Extend the visibility timeout',
            'command': f'aws sqs change-message-visibility --queue-url <queue-url> --receipt-handle <receipt-handle> --visibility-timeout {SQS_VISIBILITY_EXTENDED_SECONDS}',
            'explanation': 'Extends the in-flight timeout to one minute, leaving enough time to confirm that other receives cannot see the job.',
        },
        {
            'key': 'verify-hidden',
            'title': 'Confirm the job is temporarily hidden',
            'command': 'aws sqs receive-message --queue-url <queue-url> --max-number-of-messages 10 --visibility-timeout 0 --wait-time-seconds 0 --message-attribute-names All',
            'explanation': 'Polls immediately and verifies that the in-flight job is not currently available.',
        },
        {
            'key': 'shorten-message-visibility',
            'title': 'Shorten the visibility timeout',
            'command': f'aws sqs change-message-visibility --queue-url <queue-url> --receipt-handle <receipt-handle> --visibility-timeout {SQS_VISIBILITY_SHORT_SECONDS}',
            'explanation': 'Shortens the remaining invisibility to two seconds so the lab can demonstrate reappearance quickly.',
        },
        {
            'key': 'receive-after-timeout',
            'title': 'Receive the job after timeout',
            'command': 'aws sqs receive-message --queue-url <queue-url> --max-number-of-messages 10 --visibility-timeout 0 --wait-time-seconds 3 --message-attribute-names All',
            'explanation': 'Waits for the short visibility timeout to expire, then verifies that the same undeleted job becomes available again.',
        },
    ],
}

SQS_DELAYED_MESSAGE_LAB = {
    'service': 'sqs',
    'key': 'delayed-message',
    'title': 'Work with delayed SQS messages',
    'description': 'Send a message that is initially unavailable, verify its delayed state, then receive it after the delivery delay expires.',
    'steps': [
        {
            'key': 'create-queue',
            'title': 'Ensure the queue exists',
            'command': f'aws sqs create-queue --queue-name {SQS_BASICS_QUEUE_NAME}',
            'explanation': 'Creates the shared training queue if it does not already exist.',
        },
        {
            'key': 'send-delayed-message',
            'title': 'Send a delayed report request',
            'command': f'aws sqs send-message --queue-url <queue-url> --message-body file://report.json --message-attributes file://message-attributes.json --delay-seconds {SQS_DELAY_SECONDS}',
            'explanation': 'Sends a known report.generate event with a ten-second delivery delay. The lab immediately verifies the delayed count and confirms the message cannot yet be received.',
            'artifact_label': 'report.json',
            'artifact': json.dumps(SQS_DELAYED_BODY, indent=2),
            'secondary_artifact_label': 'message-attributes.json',
            'secondary_artifact': json.dumps(SQS_DELAYED_ATTRIBUTES, indent=2),
        },
        {
            'key': 'get-queue-attributes',
            'title': 'Inspect the delayed message count',
            'command': 'aws sqs get-queue-attributes --queue-url <queue-url> --attribute-names ApproximateNumberOfMessagesDelayed',
            'explanation': 'Reads the queue delayed-message count and confirms the lab observed the message before delivery.',
        },
        {
            'key': 'receive-after-delay',
            'title': 'Receive the report request after its delay',
            'command': 'aws sqs receive-message --queue-url <queue-url> --max-number-of-messages 10 --visibility-timeout 0 --wait-time-seconds 12 --message-attribute-names All',
            'explanation': 'Waits for the delivery delay to expire and verifies that the exact report.generate message becomes available.',
        },
    ],
}

SQS_BATCH_MESSAGES_LAB = {
    'service': 'sqs',
    'key': 'batch-messages',
    'title': 'Send and delete SQS messages in batches',
    'description': 'Send three task events in one API call, receive the batch, then delete all three with one batch acknowledgement.',
    'steps': [
        {
            'key': 'create-queue',
            'title': 'Ensure the queue exists',
            'command': f'aws sqs create-queue --queue-name {SQS_BASICS_QUEUE_NAME}',
            'explanation': 'Creates the shared training queue if it does not already exist.',
        },
        {
            'key': 'send-message-batch',
            'title': 'Send three task events',
            'command': 'aws sqs send-message-batch --queue-url <queue-url> --entries file://send-batch.json',
            'explanation': 'Sends three independent task.created events in one request and verifies every entry succeeded.',
            'artifact_label': 'send-batch.json',
            'artifact': json.dumps({
                'Entries': [
                    {
                        'Id': f'task-{index}',
                        'MessageBody': text,
                        'MessageAttributes': {
                            'Lab': {
                                'DataType': 'String',
                                'StringValue': SQS_BATCH_ATTRIBUTE_VALUE,
                            },
                        },
                    }
                    for index, text in enumerate(SQS_BATCH_MESSAGE_TEXTS, start=1)
                ],
            }, indent=2),
        },
        {
            'key': 'receive-message',
            'title': 'Receive the task batch',
            'command': 'aws sqs receive-message --queue-url <queue-url> --max-number-of-messages 10 --visibility-timeout 0 --wait-time-seconds 1 --message-attribute-names All',
            'explanation': 'Receives up to ten messages and verifies that all three attributed task events are present.',
        },
        {
            'key': 'delete-message-batch',
            'title': 'Delete the processed batch',
            'command': 'aws sqs delete-message-batch --queue-url <queue-url> --entries file://delete-batch.json',
            'explanation': 'Discovers current receipt handles for the three task events and acknowledges them in one batch request.',
            'artifact_label': 'delete-batch.json',
            'artifact': json.dumps({
                'Entries': [
                    {'Id': f'task-{index}', 'ReceiptHandle': '<receipt-handle>'}
                    for index in range(1, 4)
                ],
            }, indent=2),
        },
    ],
}

SQS_QUEUE_CONFIGURATION_LAB = {
    'service': 'sqs',
    'key': 'queue-configuration',
    'title': 'Configure SQS queue attributes and tags',
    'description': 'Tune message processing defaults, apply operational tags, and inspect both configurations on the shared training queue.',
    'steps': [
        {
            'key': 'create-queue',
            'title': 'Ensure the queue exists',
            'command': f'aws sqs create-queue --queue-name {SQS_BASICS_QUEUE_NAME}',
            'explanation': 'Creates the shared training queue if it does not already exist.',
        },
        {
            'key': 'set-queue-attributes',
            'title': 'Configure processing defaults',
            'command': 'aws sqs set-queue-attributes --queue-url <queue-url> --attributes file://queue-attributes.json',
            'explanation': 'Sets a 45-second visibility timeout, one-day message retention, and 10-second default long polling.',
            'artifact_label': 'queue-attributes.json',
            'artifact': json.dumps(SQS_CONFIGURATION_ATTRIBUTES, indent=2),
        },
        {
            'key': 'get-queue-attributes',
            'title': 'Inspect queue attributes',
            'command': 'aws sqs get-queue-attributes --queue-url <queue-url> --attribute-names VisibilityTimeout MessageRetentionPeriod ReceiveMessageWaitTimeSeconds',
            'explanation': 'Reads the configured processing values and verifies all three exact settings.',
        },
        {
            'key': 'tag-queue',
            'title': 'Tag the queue',
            'command': 'aws sqs tag-queue --queue-url <queue-url> --tags Environment=lab,Purpose=training',
            'explanation': 'Adds operational tags that identify the queue as a training resource.',
        },
        {
            'key': 'list-queue-tags',
            'title': 'Inspect queue tags',
            'command': 'aws sqs list-queue-tags --queue-url <queue-url>',
            'explanation': 'Reads the queue tags and verifies the Environment and Purpose values.',
        },
    ],
}

SQS_DEAD_LETTER_REDRIVE_LAB = {
    'service': 'sqs',
    'key': 'dead-letter-redrive',
    'title': 'Route failed messages to a dead-letter queue',
    'description': 'Configure a source queue and dead-letter queue, fail the same message twice, inspect it in the DLQ, then redrive it to the source queue.',
    'steps': [
        {
            'key': 'create-dlq',
            'title': 'Create the dead-letter queue',
            'command': f'aws sqs create-queue --queue-name {SQS_REDRIVE_DLQ_NAME}',
            'explanation': 'Creates the queue that isolates messages a consumer could not process successfully.',
        },
        {
            'key': 'create-source-queue',
            'title': 'Create the source queue',
            'command': f'aws sqs create-queue --queue-name {SQS_REDRIVE_SOURCE_QUEUE_NAME}',
            'explanation': 'Creates the application queue that initially receives the payment-processing message.',
        },
        {
            'key': 'set-redrive-policy',
            'title': 'Attach the dead-letter queue',
            'command': 'aws sqs set-queue-attributes --queue-url <source-queue-url> --attributes file://redrive-policy.json',
            'explanation': 'Configures the DLQ target and moves a message after two receives without successful deletion.',
            'artifact_label': 'redrive-policy.json',
            'artifact': json.dumps({'RedrivePolicy': json.dumps(SQS_REDRIVE_POLICY)}, indent=2),
        },
        {
            'key': 'get-redrive-policy',
            'title': 'Inspect the redrive policy',
            'command': 'aws sqs get-queue-attributes --queue-url <source-queue-url> --attribute-names RedrivePolicy',
            'explanation': 'Reads the source queue configuration and verifies the exact DLQ ARN and maximum receive count.',
        },
        {
            'key': 'send-message',
            'title': 'Send a message that will fail',
            'command': 'aws sqs send-message --queue-url <source-queue-url> --message-body file://payment.json --message-attributes file://message-attributes.json',
            'explanation': 'Sends a known payment.process event with a flag that represents a consumer processing failure.',
            'artifact_label': 'payment.json',
            'artifact': json.dumps(SQS_REDRIVE_BODY, indent=2),
            'secondary_artifact_label': 'message-attributes.json',
            'secondary_artifact': json.dumps(SQS_REDRIVE_ATTRIBUTES, indent=2),
        },
        {
            'key': 'fail-message-once',
            'title': 'Fail the first processing attempt',
            'command': 'aws sqs receive-message --queue-url <source-queue-url> --max-number-of-messages 1 --visibility-timeout 0 --wait-time-seconds 0 --attribute-names All --message-attribute-names All',
            'explanation': 'Receives the message but deliberately does not delete it, simulating a failed consumer attempt.',
        },
        {
            'key': 'fail-message-twice',
            'title': 'Fail the second processing attempt',
            'command': 'aws sqs receive-message --queue-url <source-queue-url> --max-number-of-messages 1 --visibility-timeout 0 --wait-time-seconds 0 --attribute-names All --message-attribute-names All',
            'explanation': 'Receives the same message a second time without acknowledgement, reaching maxReceiveCount.',
        },
        {
            'key': 'trigger-dead-lettering',
            'title': 'Exceed the receive limit',
            'command': 'aws sqs receive-message --queue-url <source-queue-url> --max-number-of-messages 1 --visibility-timeout 0 --wait-time-seconds 0 --attribute-names All --message-attribute-names All',
            'explanation': 'Polls once more after maxReceiveCount is reached. SQS withholds the message from the source response and moves it to the DLQ.',
        },
        {
            'key': 'inspect-dlq',
            'title': 'Inspect the dead-lettered message',
            'command': 'aws sqs receive-message --queue-url <dlq-url> --max-number-of-messages 1 --visibility-timeout 0 --wait-time-seconds 1 --attribute-names All --message-attribute-names All',
            'explanation': 'Verifies that SQS removed the failed message from the source queue and isolated it in the DLQ.',
        },
        {
            'key': 'start-message-move-task',
            'title': 'Redrive the message',
            'command': f'aws sqs start-message-move-task --source-arn {SQS_REDRIVE_DLQ_ARN} --destination-arn {SQS_REDRIVE_SOURCE_QUEUE_ARN} --max-number-of-messages-per-second 10',
            'explanation': 'Starts an SQS managed redrive task that returns messages from the DLQ to the source queue.',
        },
        {
            'key': 'list-message-move-tasks',
            'title': 'Inspect the redrive task',
            'command': f'aws sqs list-message-move-tasks --source-arn {SQS_REDRIVE_DLQ_ARN} --max-results 10',
            'explanation': 'Reads the task status and moved-message counts for the DLQ.',
        },
        {
            'key': 'receive-redriven-message',
            'title': 'Receive the recovered message',
            'command': 'aws sqs receive-message --queue-url <source-queue-url> --max-number-of-messages 1 --visibility-timeout 0 --wait-time-seconds 1 --attribute-names All --message-attribute-names All',
            'explanation': 'Confirms that the exact payment event returned to the source queue with a fresh receive count.',
        },
    ],
}

SQS_FIFO_ORDERING_LAB = {
    'service': 'sqs',
    'key': 'fifo-ordering',
    'title': 'Preserve ordering and deduplicate messages with SQS FIFO',
    'description': 'Create a FIFO queue, send an ordered workflow in one message group, suppress a duplicate send, and verify delivery order.',
    'steps': [
        {
            'key': 'create-queue',
            'title': 'Create the FIFO queue',
            'command': f'aws sqs create-queue --queue-name {SQS_FIFO_QUEUE_NAME} --attributes FifoQueue=true,ContentBasedDeduplication=false',
            'explanation': 'Creates a FIFO queue with explicit deduplication IDs. FIFO queue names must end in .fifo.',
        },
        {
            'key': 'get-queue-attributes',
            'title': 'Inspect FIFO settings',
            'command': 'aws sqs get-queue-attributes --queue-url <fifo-queue-url> --attribute-names QueueArn FifoQueue ContentBasedDeduplication',
            'explanation': 'Verifies the FIFO queue ARN and confirms that content-based deduplication is disabled.',
        },
        {
            'key': 'send-created',
            'title': 'Send order step 1',
            'command': f'aws sqs send-message --queue-url <fifo-queue-url> --message-body file://order-created.json --message-group-id {SQS_FIFO_GROUP_ID} --message-deduplication-id {SQS_FIFO_DEDUPLICATION_IDS[0]}',
            'explanation': 'Starts the ordered workflow. Messages in the same message group are delivered in sequence.',
            'artifact_label': 'order-created.json',
            'artifact': json.dumps(SQS_FIFO_MESSAGES[0], indent=2),
        },
        {
            'key': 'send-duplicate',
            'title': 'Retry with the same deduplication ID',
            'command': f'aws sqs send-message --queue-url <fifo-queue-url> --message-body file://duplicate-created.json --message-group-id {SQS_FIFO_GROUP_ID} --message-deduplication-id {SQS_FIFO_DEDUPLICATION_IDS[0]}',
            'explanation': 'Uses the same deduplication ID with a different body. SQS accepts the request but suppresses the duplicate message.',
            'artifact_label': 'duplicate-created.json',
            'artifact': json.dumps(SQS_FIFO_DUPLICATE_BODY, indent=2),
        },
        {
            'key': 'send-paid',
            'title': 'Send order step 2',
            'command': f'aws sqs send-message --queue-url <fifo-queue-url> --message-body file://order-paid.json --message-group-id {SQS_FIFO_GROUP_ID} --message-deduplication-id {SQS_FIFO_DEDUPLICATION_IDS[1]}',
            'explanation': 'Adds the paid event to the same ordered message group.',
            'artifact_label': 'order-paid.json',
            'artifact': json.dumps(SQS_FIFO_MESSAGES[1], indent=2),
        },
        {
            'key': 'send-fulfilled',
            'title': 'Send order step 3',
            'command': f'aws sqs send-message --queue-url <fifo-queue-url> --message-body file://order-fulfilled.json --message-group-id {SQS_FIFO_GROUP_ID} --message-deduplication-id {SQS_FIFO_DEDUPLICATION_IDS[2]}',
            'explanation': 'Adds the fulfilled event as the final event in the same message group.',
            'artifact_label': 'order-fulfilled.json',
            'artifact': json.dumps(SQS_FIFO_MESSAGES[2], indent=2),
        },
        {
            'key': 'inspect-message-count',
            'title': 'Confirm the duplicate was suppressed',
            'command': 'aws sqs get-queue-attributes --queue-url <fifo-queue-url> --attribute-names ApproximateNumberOfMessages',
            'explanation': 'Verifies that four successful send requests produced only three available messages.',
        },
        {
            'key': 'receive-ordered-messages',
            'title': 'Receive the ordered workflow',
            'command': 'aws sqs receive-message --queue-url <fifo-queue-url> --max-number-of-messages 10 --visibility-timeout 0 --wait-time-seconds 1 --attribute-names All --message-attribute-names All',
            'explanation': 'Receives all three messages and verifies created, paid, and fulfilled order plus increasing FIFO sequence numbers.',
        },
    ],
}

SQS_PURGE_DELETE_LAB = {
    'service': 'sqs',
    'key': 'purge-delete',
    'title': 'Purge messages and delete an SQS queue',
    'description': 'Populate a dedicated queue, purge all messages while preserving its configuration, then delete the queue itself.',
    'steps': [
        {
            'key': 'create-queue',
            'title': 'Create a configured cleanup queue',
            'command': f'aws sqs create-queue --queue-name {SQS_CLEANUP_QUEUE_NAME} --attributes VisibilityTimeout={SQS_CLEANUP_VISIBILITY_TIMEOUT} --tags Purpose=cleanup-training',
            'explanation': 'Creates a dedicated queue with a non-default visibility timeout and tag so the lab can prove purge preserves queue configuration.',
        },
        {
            'key': 'send-message-batch',
            'title': 'Populate the queue',
            'command': 'aws sqs send-message-batch --queue-url <cleanup-queue-url> --entries file://cleanup-messages.json',
            'explanation': 'Adds three attributed messages that belong only to this cleanup lab.',
            'artifact_label': 'cleanup-messages.json',
            'artifact': json.dumps({
                'Entries': [
                    {
                        'Id': f'cleanup-{index}',
                        'MessageBody': text,
                        'MessageAttributes': {
                            'Lab': {
                                'DataType': 'String',
                                'StringValue': SQS_CLEANUP_ATTRIBUTE_VALUE,
                            },
                        },
                    }
                    for index, text in enumerate(
                        SQS_CLEANUP_MESSAGE_TEXTS,
                        start=1,
                    )
                ],
            }, indent=2),
        },
        {
            'key': 'inspect-populated-queue',
            'title': 'Inspect the populated queue',
            'command': 'aws sqs get-queue-attributes --queue-url <cleanup-queue-url> --attribute-names QueueArn VisibilityTimeout ApproximateNumberOfMessages',
            'explanation': 'Verifies the queue ARN, 45-second visibility timeout, and three available messages.',
        },
        {
            'key': 'purge-queue',
            'title': 'Purge every message',
            'command': 'aws sqs purge-queue --queue-url <cleanup-queue-url>',
            'explanation': 'Permanently removes all available and in-flight messages without deleting the queue.',
        },
        {
            'key': 'inspect-purged-queue',
            'title': 'Confirm the queue still exists',
            'command': 'aws sqs get-queue-attributes --queue-url <cleanup-queue-url> --attribute-names QueueArn VisibilityTimeout ApproximateNumberOfMessages',
            'explanation': 'Verifies zero messages while the queue ARN, visibility timeout, and Purpose tag remain intact.',
        },
        {
            'key': 'delete-queue',
            'title': 'Delete the queue',
            'command': 'aws sqs delete-queue --queue-url <cleanup-queue-url>',
            'explanation': 'Deletes the queue resource itself and verifies that its name no longer resolves to a queue URL.',
        },
    ],
}

SNS_SQS_FANOUT_LAB = {
    'service': 'sns',
    'key': 'sqs-fanout',
    'title': 'Fan out an SNS message to SQS queues',
    'description': 'Publish one order event to an SNS topic and verify that two independently subscribed SQS queues each receive a copy.',
    'steps': [
        {
            'key': 'create-topic',
            'title': 'Create the SNS topic',
            'command': f'aws sns create-topic --name {SNS_FANOUT_TOPIC_NAME}',
            'explanation': 'Creates the publisher-facing topic for order events.',
        },
        {
            'key': 'create-orders-queue',
            'title': 'Create the processing queue',
            'command': f'aws sqs create-queue --queue-name {SNS_FANOUT_ORDERS_QUEUE_NAME}',
            'explanation': 'Creates the queue used by an order-processing consumer.',
        },
        {
            'key': 'create-audit-queue',
            'title': 'Create the audit queue',
            'command': f'aws sqs create-queue --queue-name {SNS_FANOUT_AUDIT_QUEUE_NAME}',
            'explanation': 'Creates a second queue representing an independent audit consumer.',
        },
        {
            'key': 'set-orders-queue-policy',
            'title': 'Authorize delivery to the processing queue',
            'command': 'aws sqs set-queue-attributes --queue-url <orders-queue-url> --attributes file://orders-queue-policy.json',
            'explanation': 'Allows only the lab SNS topic to call SendMessage on the processing queue.',
            'artifact_label': 'orders-queue-policy.json',
            'artifact': json.dumps({
                'Policy': json.dumps({
                    'Version': '2012-10-17',
                    'Statement': [{
                        'Sid': 'AllowOrderTopicDelivery',
                        'Effect': 'Allow',
                        'Principal': {'Service': 'sns.amazonaws.com'},
                        'Action': 'sqs:SendMessage',
                        'Resource': SNS_FANOUT_ORDERS_QUEUE_ARN,
                        'Condition': {
                            'ArnEquals': {'aws:SourceArn': SNS_FANOUT_TOPIC_ARN},
                        },
                    }],
                }),
            }, indent=2),
        },
        {
            'key': 'set-audit-queue-policy',
            'title': 'Authorize delivery to the audit queue',
            'command': 'aws sqs set-queue-attributes --queue-url <audit-queue-url> --attributes file://audit-queue-policy.json',
            'explanation': 'Allows only the same SNS topic to call SendMessage on the audit queue.',
            'artifact_label': 'audit-queue-policy.json',
            'artifact': json.dumps({
                'Policy': json.dumps({
                    'Version': '2012-10-17',
                    'Statement': [{
                        'Sid': 'AllowOrderTopicDelivery',
                        'Effect': 'Allow',
                        'Principal': {'Service': 'sns.amazonaws.com'},
                        'Action': 'sqs:SendMessage',
                        'Resource': SNS_FANOUT_AUDIT_QUEUE_ARN,
                        'Condition': {
                            'ArnEquals': {'aws:SourceArn': SNS_FANOUT_TOPIC_ARN},
                        },
                    }],
                }),
            }, indent=2),
        },
        {
            'key': 'subscribe-orders-queue',
            'title': 'Subscribe the processing queue',
            'command': f'aws sns subscribe --topic-arn {SNS_FANOUT_TOPIC_ARN} --protocol sqs --notification-endpoint {SNS_FANOUT_ORDERS_QUEUE_ARN} --attributes RawMessageDelivery=true --return-subscription-arn',
            'explanation': 'Creates an immediately confirmed SQS subscription with raw message delivery.',
        },
        {
            'key': 'subscribe-audit-queue',
            'title': 'Subscribe the audit queue',
            'command': f'aws sns subscribe --topic-arn {SNS_FANOUT_TOPIC_ARN} --protocol sqs --notification-endpoint {SNS_FANOUT_AUDIT_QUEUE_ARN} --attributes RawMessageDelivery=true --return-subscription-arn',
            'explanation': 'Adds the second queue as an independent subscriber to the same topic.',
        },
        {
            'key': 'list-subscriptions',
            'title': 'Inspect the fan-out topology',
            'command': f'aws sns list-subscriptions-by-topic --topic-arn {SNS_FANOUT_TOPIC_ARN}',
            'explanation': 'Verifies both confirmed SQS endpoints and their raw-delivery settings.',
        },
        {
            'key': 'publish-message',
            'title': 'Publish one order event',
            'command': f'aws sns publish --topic-arn {SNS_FANOUT_TOPIC_ARN} --message file://order-created.json --subject "Order created" --message-attributes file://message-attributes.json',
            'explanation': 'Publishes once to SNS. The topic performs delivery independently to both queues.',
            'artifact_label': 'order-created.json',
            'artifact': json.dumps(SNS_FANOUT_MESSAGE, indent=2),
            'secondary_artifact_label': 'message-attributes.json',
            'secondary_artifact': json.dumps(SNS_FANOUT_MESSAGE_ATTRIBUTES, indent=2),
        },
        {
            'key': 'receive-orders-copy',
            'title': 'Receive the processing copy',
            'command': 'aws sqs receive-message --queue-url <orders-queue-url> --max-number-of-messages 10 --visibility-timeout 0 --wait-time-seconds 1 --message-attribute-names All',
            'explanation': 'Verifies the exact raw JSON body and SNS message attributes in the processing queue.',
        },
        {
            'key': 'receive-audit-copy',
            'title': 'Receive the audit copy',
            'command': 'aws sqs receive-message --queue-url <audit-queue-url> --max-number-of-messages 10 --visibility-timeout 0 --wait-time-seconds 1 --message-attribute-names All',
            'explanation': 'Verifies the same event arrived independently in the audit queue.',
        },
    ],
}

SNS_FILTER_POLICIES_LAB = {
    'service': 'sns',
    'key': 'filter-policies',
    'title': 'Route selected SNS messages with subscription filters',
    'description': 'Attach different message-attribute filters to two SQS subscriptions and prove that each queue receives only its matching event.',
    'steps': [
        {
            'key': 'create-topic',
            'title': 'Create the filtered-events topic',
            'command': f'aws sns create-topic --name {SNS_FILTER_TOPIC_NAME}',
            'explanation': 'Creates the shared publisher endpoint for both event types.',
        },
        {
            'key': 'create-created-queue',
            'title': 'Create the created-events queue',
            'command': f'aws sqs create-queue --queue-name {SNS_FILTER_CREATED_QUEUE_NAME}',
            'explanation': 'Creates the consumer queue that should receive only order.created events.',
        },
        {
            'key': 'create-priority-queue',
            'title': 'Create the priority queue',
            'command': f'aws sqs create-queue --queue-name {SNS_FILTER_PRIORITY_QUEUE_NAME}',
            'explanation': 'Creates the consumer queue that should receive only high-priority events.',
        },
        {
            'key': 'set-created-queue-policy',
            'title': 'Authorize the created-events queue',
            'command': 'aws sqs set-queue-attributes --queue-url <created-queue-url> --attributes file://created-queue-policy.json',
            'explanation': 'Allows only the filtered-events topic to send messages to this queue.',
        },
        {
            'key': 'set-priority-queue-policy',
            'title': 'Authorize the priority queue',
            'command': 'aws sqs set-queue-attributes --queue-url <priority-queue-url> --attributes file://priority-queue-policy.json',
            'explanation': 'Allows only the same topic to send messages to the priority queue.',
        },
        {
            'key': 'subscribe-created-filter',
            'title': 'Filter for order.created',
            'command': f'aws sns subscribe --topic-arn {SNS_FILTER_TOPIC_ARN} --protocol sqs --notification-endpoint {SNS_FILTER_CREATED_QUEUE_ARN} --attributes file://created-filter.json --return-subscription-arn',
            'explanation': 'Creates a raw-delivery subscription with FilterPolicyScope=MessageAttributes.',
            'artifact_label': 'created-filter.json',
            'artifact': json.dumps({
                'RawMessageDelivery': 'true',
                'FilterPolicyScope': 'MessageAttributes',
                'FilterPolicy': json.dumps(SNS_FILTER_CREATED_POLICY),
            }, indent=2),
        },
        {
            'key': 'subscribe-priority-filter',
            'title': 'Filter for high priority',
            'command': f'aws sns subscribe --topic-arn {SNS_FILTER_TOPIC_ARN} --protocol sqs --notification-endpoint {SNS_FILTER_PRIORITY_QUEUE_ARN} --attributes file://priority-filter.json --return-subscription-arn',
            'explanation': 'Creates a second subscription that matches Priority=high regardless of event type.',
            'artifact_label': 'priority-filter.json',
            'artifact': json.dumps({
                'RawMessageDelivery': 'true',
                'FilterPolicyScope': 'MessageAttributes',
                'FilterPolicy': json.dumps(SNS_FILTER_PRIORITY_POLICY),
            }, indent=2),
        },
        {
            'key': 'inspect-filter-policies',
            'title': 'Inspect both filter policies',
            'command': 'aws sns get-subscription-attributes --subscription-arn <subscription-arn>',
            'explanation': 'Verifies both confirmed subscriptions, raw delivery, message-attribute scope, and exact filter documents.',
        },
        {
            'key': 'publish-created-event',
            'title': 'Publish a normal created event',
            'command': f'aws sns publish --topic-arn {SNS_FILTER_TOPIC_ARN} --message file://created-event.json --message-attributes file://created-attributes.json',
            'explanation': 'Matches EventType=order.created but not Priority=high.',
            'artifact_label': 'created-event.json',
            'artifact': json.dumps(SNS_FILTER_CREATED_MESSAGE, indent=2),
            'secondary_artifact_label': 'created-attributes.json',
            'secondary_artifact': json.dumps(SNS_FILTER_CREATED_ATTRIBUTES, indent=2),
        },
        {
            'key': 'publish-priority-event',
            'title': 'Publish a high-priority cancellation',
            'command': f'aws sns publish --topic-arn {SNS_FILTER_TOPIC_ARN} --message file://priority-event.json --message-attributes file://priority-attributes.json',
            'explanation': 'Matches Priority=high but not EventType=order.created.',
            'artifact_label': 'priority-event.json',
            'artifact': json.dumps(SNS_FILTER_PRIORITY_MESSAGE, indent=2),
            'secondary_artifact_label': 'priority-attributes.json',
            'secondary_artifact': json.dumps(SNS_FILTER_PRIORITY_ATTRIBUTES, indent=2),
        },
        {
            'key': 'receive-created-route',
            'title': 'Verify the created-event route',
            'command': 'aws sqs receive-message --queue-url <created-queue-url> --max-number-of-messages 10 --visibility-timeout 0 --wait-time-seconds 1 --message-attribute-names All',
            'explanation': 'Requires exactly the created event and proves the high-priority cancellation was excluded.',
        },
        {
            'key': 'receive-priority-route',
            'title': 'Verify the priority route',
            'command': 'aws sqs receive-message --queue-url <priority-queue-url> --max-number-of-messages 10 --visibility-timeout 0 --wait-time-seconds 1 --message-attribute-names All',
            'explanation': 'Requires exactly the cancellation event and proves the normal created event was excluded.',
        },
    ],
}

SCHEDULER_SQS_DELIVERY_LAB = {
    'service': 'scheduler',
    'key': 'sqs-delivery',
    'title': 'Schedule an EventBridge Scheduler message to SQS',
    'description': 'Create the execution role and target queue, schedule one report event, verify delivery, and confirm automatic schedule cleanup.',
    'steps': [
        {
            'key': 'create-queue',
            'title': 'Create the target queue',
            'command': f'aws sqs create-queue --queue-name {SCHEDULER_SQS_QUEUE_NAME}',
            'explanation': 'Creates the SQS queue that will receive the scheduled report event.',
        },
        {
            'key': 'create-role',
            'title': 'Create the Scheduler execution role',
            'command': f'aws iam create-role --role-name {SCHEDULER_ROLE_NAME} --assume-role-policy-document file://scheduler-trust-policy.json',
            'explanation': 'Creates a role trusted only by the EventBridge Scheduler service.',
            'artifact_label': 'scheduler-trust-policy.json',
            'artifact': json.dumps(SCHEDULER_TRUST_POLICY, indent=2),
        },
        {
            'key': 'put-role-policy',
            'title': 'Authorize SQS delivery',
            'command': f'aws iam put-role-policy --role-name {SCHEDULER_ROLE_NAME} --policy-name {SCHEDULER_ROLE_POLICY_NAME} --policy-document file://send-message-policy.json',
            'explanation': 'Grants the execution role only sqs:SendMessage on the dedicated target queue.',
            'artifact_label': 'send-message-policy.json',
            'artifact': json.dumps(SCHEDULER_ROLE_POLICY, indent=2),
        },
        {
            'key': 'create-schedule-group',
            'title': 'Create a schedule group',
            'command': f'aws scheduler create-schedule-group --name {SCHEDULER_GROUP_NAME}',
            'explanation': 'Creates a dedicated container for the lab schedule.',
        },
        {
            'key': 'create-schedule',
            'title': 'Schedule the report event',
            'command': f'aws scheduler create-schedule --name {SCHEDULER_SCHEDULE_NAME} --group-name {SCHEDULER_GROUP_NAME} --schedule-expression "at(<utc-time-seconds-from-now>)" --flexible-time-window Mode=OFF --target file://target.json --action-after-completion DELETE',
            'explanation': 'Creates a one-time schedule a few seconds in the future. The runner fills in the live UTC timestamp.',
            'artifact_label': 'target.json',
            'artifact': json.dumps({
                'Arn': SCHEDULER_SQS_QUEUE_ARN,
                'RoleArn': SCHEDULER_ROLE_ARN,
                'Input': SCHEDULER_MESSAGE_TEXT,
                'RetryPolicy': {
                    'MaximumEventAgeInSeconds': 60,
                    'MaximumRetryAttempts': 1,
                },
            }, indent=2),
            'secondary_artifact_label': 'scheduled-message.json',
            'secondary_artifact': json.dumps(SCHEDULER_MESSAGE, indent=2),
        },
        {
            'key': 'get-schedule',
            'title': 'Inspect the pending schedule',
            'command': f'aws scheduler get-schedule --name {SCHEDULER_SCHEDULE_NAME} --group-name {SCHEDULER_GROUP_NAME}',
            'explanation': 'Verifies the one-time expression, disabled flexible window, execution role, target queue, retry policy, and automatic deletion setting.',
        },
        {
            'key': 'receive-scheduled-message',
            'title': 'Wait for SQS delivery',
            'command': 'aws sqs receive-message --queue-url <scheduled-reports-queue-url> --max-number-of-messages 10 --visibility-timeout 0 --wait-time-seconds 12',
            'explanation': 'Polls through Scheduler invocation latency and verifies the exact report.ready JSON body.',
        },
        {
            'key': 'confirm-schedule-deleted',
            'title': 'Confirm automatic schedule cleanup',
            'command': f'aws scheduler get-schedule --name {SCHEDULER_SCHEDULE_NAME} --group-name {SCHEDULER_GROUP_NAME}',
            'explanation': 'Requires ResourceNotFoundException, proving ActionAfterCompletion=DELETE removed the one-time schedule.',
        },
    ],
}

CLOUDFORMATION_S3_SQS_LAB = {
    'service': 'cloudformation',
    'key': 's3-sqs-stack',
    'title': 'Provision S3 and SQS resources with CloudFormation',
    'description': 'Validate one infrastructure template, create a stack, inspect its outputs, resources, and events, then delete the stack and verify cleanup.',
    'steps': [
        {
            'key': 'validate-template',
            'title': 'Validate the infrastructure template',
            'command': 'aws cloudformation validate-template --template-body file://storage-messaging-stack.json',
            'explanation': 'Checks the template structure before creating any resources.',
            'artifact_label': 'storage-messaging-stack.json',
            'artifact': CLOUDFORMATION_TEMPLATE_TEXT,
        },
        {
            'key': 'create-stack',
            'title': 'Create the stack',
            'command': f'aws cloudformation create-stack --stack-name {CLOUDFORMATION_STACK_NAME} --template-body file://storage-messaging-stack.json',
            'explanation': 'Asks CloudFormation to provision the named S3 bucket and SQS queue as one managed unit.',
        },
        {
            'key': 'describe-stack',
            'title': 'Inspect stack status and outputs',
            'command': f'aws cloudformation describe-stacks --stack-name {CLOUDFORMATION_STACK_NAME}',
            'explanation': 'Requires CREATE_COMPLETE and verifies the bucket name, queue URL, and queue ARN outputs.',
        },
        {
            'key': 'describe-stack-resources',
            'title': 'Map logical resources to physical resources',
            'command': f'aws cloudformation describe-stack-resources --stack-name {CLOUDFORMATION_STACK_NAME}',
            'explanation': 'Shows how StorageBucket and JobsQueue map to their real AWS-shaped identifiers.',
        },
        {
            'key': 'describe-stack-events',
            'title': 'Inspect the provisioning timeline',
            'command': f'aws cloudformation describe-stack-events --stack-name {CLOUDFORMATION_STACK_NAME}',
            'explanation': 'Verifies CREATE_IN_PROGRESS and CREATE_COMPLETE events for the stack and both resources.',
        },
        {
            'key': 'inspect-provisioned-resources',
            'title': 'Verify the provisioned services',
            'command': f'aws s3api head-bucket --bucket {CLOUDFORMATION_BUCKET_NAME}\naws sqs get-queue-attributes --queue-url <queue-url> --attribute-names QueueArn VisibilityTimeout',
            'explanation': 'Confirms that S3 and SQS expose the resources with the expected queue ARN and visibility timeout.',
        },
        {
            'key': 'delete-stack',
            'title': 'Delete the stack',
            'command': f'aws cloudformation delete-stack --stack-name {CLOUDFORMATION_STACK_NAME}',
            'explanation': 'Deletes the CloudFormation ownership unit instead of deleting the bucket and queue manually.',
        },
        {
            'key': 'confirm-resources-deleted',
            'title': 'Confirm stack-owned cleanup',
            'command': f'aws cloudformation describe-stacks --stack-name {CLOUDFORMATION_STACK_NAME}\naws s3api head-bucket --bucket {CLOUDFORMATION_BUCKET_NAME}\naws sqs get-queue-url --queue-name {CLOUDFORMATION_QUEUE_NAME}',
            'explanation': 'Requires the stack, bucket, and queue to be absent after deletion.',
        },
    ],
}

EC2_VPC_NETWORKING_LAB = {
    'service': 'ec2',
    'key': 'vpc-public-private',
    'title': 'Build a VPC with public and private subnets',
    'description': 'Create an isolated network, give one subnet an internet route and public-IP behavior, and keep the second subnet private.',
    'steps': [
        {
            'key': 'create-vpc',
            'title': 'Create the VPC',
            'command': f'aws ec2 create-vpc --cidr-block {EC2_VPC_CIDR} --tag-specifications file://vpc-tags.json',
            'explanation': 'Creates the private IPv4 address space for the complete topology.',
            'artifact_label': 'vpc-tags.json',
            'artifact': json.dumps([{
                'ResourceType': 'vpc',
                'Tags': EC2_VPC_TAGS,
            }], indent=2),
        },
        {
            'key': 'create-public-subnet',
            'title': 'Create the public subnet',
            'command': f'aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block {EC2_PUBLIC_SUBNET_CIDR} --availability-zone {EC2_PUBLIC_AZ}',
            'explanation': 'Allocates a /24 subnet intended for resources that can use an internet route.',
        },
        {
            'key': 'enable-public-ip',
            'title': 'Enable public IP assignment',
            'command': 'aws ec2 modify-subnet-attribute --subnet-id <public-subnet-id> --map-public-ip-on-launch',
            'explanation': 'Makes newly launched instances in the public subnet request public IPv4 addresses.',
        },
        {
            'key': 'create-private-subnet',
            'title': 'Create the private subnet',
            'command': f'aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block {EC2_PRIVATE_SUBNET_CIDR} --availability-zone {EC2_PRIVATE_AZ}',
            'explanation': 'Allocates a separate /24 subnet without automatic public IP assignment.',
        },
        {
            'key': 'create-internet-gateway',
            'title': 'Create an internet gateway',
            'command': 'aws ec2 create-internet-gateway',
            'explanation': 'Creates the horizontally scaled VPC edge used for internet routing.',
        },
        {
            'key': 'attach-internet-gateway',
            'title': 'Attach the gateway to the VPC',
            'command': 'aws ec2 attach-internet-gateway --internet-gateway-id <igw-id> --vpc-id <vpc-id>',
            'explanation': 'Attaches the internet gateway to this VPC; attachment alone does not make a subnet public.',
        },
        {
            'key': 'create-public-route-table',
            'title': 'Create the public route table',
            'command': 'aws ec2 create-route-table --vpc-id <vpc-id>',
            'explanation': 'Creates a dedicated route table for the public subnet.',
        },
        {
            'key': 'create-internet-route',
            'title': 'Add the default internet route',
            'command': 'aws ec2 create-route --route-table-id <public-route-table-id> --destination-cidr-block 0.0.0.0/0 --gateway-id <igw-id>',
            'explanation': 'Routes non-local IPv4 traffic from the public route table to the internet gateway.',
        },
        {
            'key': 'associate-public-route-table',
            'title': 'Associate the public subnet',
            'command': 'aws ec2 associate-route-table --route-table-id <public-route-table-id> --subnet-id <public-subnet-id>',
            'explanation': 'Makes the public subnet use the route table containing the internet route.',
        },
        {
            'key': 'create-private-route-table',
            'title': 'Create the private route table',
            'command': 'aws ec2 create-route-table --vpc-id <vpc-id>',
            'explanation': 'Creates a separate route table whose only route is the automatic local VPC route.',
        },
        {
            'key': 'associate-private-route-table',
            'title': 'Associate the private subnet',
            'command': 'aws ec2 associate-route-table --route-table-id <private-route-table-id> --subnet-id <private-subnet-id>',
            'explanation': 'Keeps private-subnet traffic on the route table with no internet-gateway default route.',
        },
        {
            'key': 'inspect-network-topology',
            'title': 'Inspect the complete topology',
            'command': 'aws ec2 describe-vpcs --vpc-ids <vpc-id>\naws ec2 describe-subnets --filters Name=vpc-id,Values=<vpc-id>\naws ec2 describe-internet-gateways --filters Name=attachment.vpc-id,Values=<vpc-id>\naws ec2 describe-route-tables --filters Name=vpc-id,Values=<vpc-id>',
            'explanation': 'Proves the public/private distinction from subnet attributes, route-table associations, and the presence or absence of 0.0.0.0/0.',
        },
    ],
}

EC2_SECURITY_CONTROLS_LAB = {
    'service': 'ec2',
    'key': 'security-controls',
    'title': 'Control VPC traffic with security groups and network ACLs',
    'description': 'Build stateful security-group rules, use one group as another group’s source, and examine the stateless NACL rule design plus the current local support boundary.',
    'steps': [
        {
            'key': 'create-vpc',
            'title': 'Create the security VPC',
            'command': f'aws ec2 create-vpc --cidr-block {EC2_SECURITY_VPC_CIDR} --tag-specifications file://vpc-tags.json',
            'explanation': 'Creates an isolated VPC owned only by this traffic-control lab.',
        },
        {
            'key': 'create-subnet',
            'title': 'Create the application subnet',
            'command': f'aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block {EC2_SECURITY_SUBNET_CIDR} --availability-zone {EC2_SECURITY_AZ}',
            'explanation': 'Creates the subnet whose traffic controls are being designed.',
        },
        {
            'key': 'create-web-security-group',
            'title': 'Create the web security group',
            'command': f'aws ec2 create-security-group --group-name {EC2_WEB_SG_NAME} --description "HTTPS web tier" --vpc-id <vpc-id>',
            'explanation': 'Creates a stateful virtual firewall for the public-facing web tier.',
        },
        {
            'key': 'allow-trusted-https',
            'title': 'Allow HTTPS from trusted clients',
            'command': f'aws ec2 authorize-security-group-ingress --group-id <web-sg-id> --ip-permissions file://trusted-https.json',
            'explanation': 'Allows TCP 443 only from the documentation CIDR 203.0.113.0/24.',
            'artifact_label': 'trusted-https.json',
            'artifact': json.dumps([{
                'IpProtocol': 'tcp',
                'FromPort': 443,
                'ToPort': 443,
                'IpRanges': [{
                    'CidrIp': EC2_TRUSTED_CLIENT_CIDR,
                    'Description': 'Trusted HTTPS clients',
                }],
            }], indent=2),
        },
        {
            'key': 'create-app-security-group',
            'title': 'Create the application security group',
            'command': f'aws ec2 create-security-group --group-name {EC2_APP_SG_NAME} --description "Private application tier" --vpc-id <vpc-id>',
            'explanation': 'Creates a separate stateful firewall for the private application tier.',
        },
        {
            'key': 'allow-web-to-app',
            'title': 'Allow web-to-app traffic',
            'command': 'aws ec2 authorize-security-group-ingress --group-id <app-sg-id> --ip-permissions file://web-to-app.json',
            'explanation': 'Allows TCP 8080 only when the source network interface uses the web security group.',
            'artifact_label': 'web-to-app.json',
            'artifact': json.dumps([{
                'IpProtocol': 'tcp',
                'FromPort': 8080,
                'ToPort': 8080,
                'UserIdGroupPairs': [{
                    'GroupId': '<web-sg-id>',
                    'Description': 'Web tier to application tier',
                }],
            }], indent=2),
        },
        {
            'key': 'inspect-security-groups',
            'title': 'Inspect stateful rules',
            'command': 'aws ec2 describe-security-groups --group-ids <web-sg-id> <app-sg-id>\naws ec2 describe-security-group-rules --filters Name=group-id,Values=<web-sg-id>,<app-sg-id>',
            'explanation': 'Verifies the CIDR-based HTTPS rule, security-group reference, and default outbound behavior.',
        },
        {
            'key': 'inspect-network-acl-support',
            'title': 'Inspect the stateless NACL design',
            'command': 'aws ec2 describe-network-acls --filters Name=vpc-id,Values=<vpc-id>',
            'explanation': 'Floci currently returns UnsupportedOperation. The artifact shows the ordered inbound and outbound rules required in AWS.',
            'artifact_label': 'network-acl-design.json',
            'artifact': json.dumps(EC2_NACL_DESIGN, indent=2),
        },
    ],
}

EC2_S3_GATEWAY_ENDPOINT_LAB = {
    'service': 'ec2',
    'key': 's3-gateway-endpoint',
    'title': 'Connect a private VPC to S3 with a gateway endpoint',
    'description': 'Give an isolated private subnet an S3 path without an internet gateway, NAT gateway, public IP, or endpoint security group.',
    'steps': [
        {
            'key': 'create-vpc',
            'title': 'Create the endpoint VPC',
            'command': f'aws ec2 create-vpc --cidr-block {EC2_ENDPOINT_VPC_CIDR} --tag-specifications file://vpc-tags.json',
            'explanation': 'Creates a dedicated VPC with no internet gateway or NAT gateway.',
        },
        {
            'key': 'create-private-subnet',
            'title': 'Create the private subnet',
            'command': f'aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block {EC2_ENDPOINT_SUBNET_CIDR} --availability-zone {EC2_ENDPOINT_AZ}',
            'explanation': 'Creates an isolated subnet with no automatic public IP assignment.',
        },
        {
            'key': 'create-private-route-table',
            'title': 'Create the private route table',
            'command': 'aws ec2 create-route-table --vpc-id <vpc-id>',
            'explanation': 'Creates the route table that the gateway endpoint will modify in AWS.',
        },
        {
            'key': 'associate-private-route-table',
            'title': 'Associate the private subnet',
            'command': 'aws ec2 associate-route-table --route-table-id <route-table-id> --subnet-id <subnet-id>',
            'explanation': 'Makes the private subnet use the route table selected for S3 connectivity.',
        },
        {
            'key': 'create-s3-bucket',
            'title': 'Create the private data bucket',
            'command': f'aws s3api create-bucket --bucket {EC2_ENDPOINT_BUCKET_NAME}',
            'explanation': 'Creates the bucket named in the endpoint policy.',
        },
        {
            'key': 'create-s3-gateway-endpoint',
            'title': 'Create the S3 gateway endpoint',
            'command': 'aws ec2 create-vpc-endpoint --vpc-id <vpc-id> --vpc-endpoint-type Gateway --service-name com.amazonaws.us-east-1.s3 --route-table-ids <route-table-id> --policy-document file://endpoint-policy.json',
            'explanation': 'Associates the regional S3 gateway service with the private route table and limits endpoint use to the lab bucket.',
            'artifact_label': 'endpoint-policy.json',
            'artifact': json.dumps(EC2_ENDPOINT_POLICY, indent=2),
        },
        {
            'key': 'inspect-private-s3-path',
            'title': 'Inspect the private S3 path',
            'command': 'aws ec2 describe-vpc-endpoints --vpc-endpoint-ids <endpoint-id>\naws ec2 describe-route-tables --route-table-ids <route-table-id>\naws s3api head-bucket --bucket floci-lab-private-s3-data',
            'explanation': 'Verifies the endpoint and bucket, then examines the route-table behavior. AWS injects an S3 prefix-list route; Floci currently does not persist that managed route.',
        },
    ],
}

EC2_SQS_INTERFACE_ENDPOINT_LAB = {
    'service': 'ec2',
    'key': 'sqs-interface-endpoint',
    'title': 'Connect a private subnet to SQS with an interface endpoint',
    'description': 'Place an SQS endpoint in a private subnet, protect its endpoint network interfaces with HTTPS-only security-group ingress, and enable private DNS.',
    'steps': [
        {
            'key': 'create-vpc',
            'title': 'Create the interface endpoint VPC',
            'command': f'aws ec2 create-vpc --cidr-block {EC2_INTERFACE_VPC_CIDR} --tag-specifications file://vpc-tags.json',
            'explanation': 'Creates a dedicated VPC with no internet gateway or NAT gateway.',
        },
        {
            'key': 'create-private-subnet',
            'title': 'Create the private subnet',
            'command': f'aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block {EC2_INTERFACE_SUBNET_CIDR} --availability-zone {EC2_INTERFACE_AZ}',
            'explanation': 'Creates the subnet where the interface endpoint network interface will live.',
        },
        {
            'key': 'create-endpoint-security-group',
            'title': 'Create the endpoint security group',
            'command': f'aws ec2 create-security-group --group-name {EC2_INTERFACE_SG_NAME} --description "Private SQS endpoint HTTPS" --vpc-id <vpc-id>',
            'explanation': 'Creates the stateful firewall attached to the endpoint network interface.',
        },
        {
            'key': 'allow-vpc-https',
            'title': 'Allow HTTPS from the VPC',
            'command': 'aws ec2 authorize-security-group-ingress --group-id <endpoint-sg-id> --ip-permissions file://endpoint-https.json',
            'explanation': 'Allows private clients in the VPC CIDR to reach the endpoint on TCP 443.',
            'artifact_label': 'endpoint-https.json',
            'artifact': json.dumps([{
                'IpProtocol': 'tcp',
                'FromPort': 443,
                'ToPort': 443,
                'IpRanges': [{
                    'CidrIp': EC2_INTERFACE_VPC_CIDR,
                    'Description': 'HTTPS from private VPC clients',
                }],
            }], indent=2),
        },
        {
            'key': 'create-sqs-queue',
            'title': 'Create the private SQS target',
            'command': f'aws sqs create-queue --queue-name {EC2_INTERFACE_QUEUE_NAME}',
            'explanation': 'Creates the only queue allowed by the endpoint policy.',
        },
        {
            'key': 'create-sqs-interface-endpoint',
            'title': 'Create the SQS interface endpoint',
            'command': 'aws ec2 create-vpc-endpoint --vpc-id <vpc-id> --vpc-endpoint-type Interface --service-name com.amazonaws.us-east-1.sqs --subnet-ids <subnet-id> --security-group-ids <endpoint-sg-id> --private-dns-enabled --policy-document file://endpoint-policy.json',
            'explanation': 'Places the regional SQS service endpoint in the private subnet with private DNS and queue-scoped permissions.',
            'artifact_label': 'endpoint-policy.json',
            'artifact': json.dumps(EC2_INTERFACE_POLICY, indent=2),
        },
        {
            'key': 'inspect-private-sqs-path',
            'title': 'Inspect the private SQS path',
            'command': f'aws ec2 describe-vpc-endpoints --vpc-endpoint-ids <endpoint-id>\naws ec2 describe-network-interfaces --network-interface-ids <eni-id>\naws sqs get-queue-attributes --queue-url <queue-url> --attribute-names QueueArn',
            'explanation': 'Checks endpoint subnet placement, security groups, private DNS, endpoint ENIs, and the queue protected by the endpoint policy.',
        },
    ],
}


def labs_for_service(service_key: str) -> list[dict[str, Any]]:
    if service_key == 'iam':
        return [
            IAM_CREATE_USER_LAB,
            IAM_ATTACH_POLICY_LAB,
            IAM_ACCESS_KEY_LAB,
            IAM_GROUP_MEMBERSHIP_LAB,
            IAM_GROUP_POLICY_LAB,
            IAM_INLINE_POLICY_LAB,
            IAM_ROLE_TRUST_LAB,
            IAM_INSTANCE_PROFILE_LAB,
        ]
    if service_key == 's3':
        return [
            S3_CREATE_BUCKET_LAB,
            S3_OBJECT_WORKFLOW_LAB,
            S3_PREFIX_COPY_LAB,
            S3_METADATA_TAGS_LAB,
            S3_VERSION_RECOVERY_LAB,
            S3_PRESIGNED_URL_LAB,
            S3_BUCKET_SECURITY_LAB,
            S3_DEFAULT_ENCRYPTION_LAB,
            S3_LIFECYCLE_RETENTION_LAB,
            S3_CORS_LAB,
            S3_OBJECT_NOTIFICATIONS_LAB,
            S3_MULTIPART_UPLOAD_LAB,
        ]
    if service_key == 'sqs':
        return [
            SQS_CREATE_QUEUE_LAB,
            SQS_MESSAGE_LIFECYCLE_LAB,
            SQS_VISIBILITY_TIMEOUT_LAB,
            SQS_DELAYED_MESSAGE_LAB,
            SQS_BATCH_MESSAGES_LAB,
            SQS_QUEUE_CONFIGURATION_LAB,
            SQS_DEAD_LETTER_REDRIVE_LAB,
            SQS_FIFO_ORDERING_LAB,
            SQS_PURGE_DELETE_LAB,
        ]
    if service_key == 'sns':
        return [SNS_SQS_FANOUT_LAB, SNS_FILTER_POLICIES_LAB]
    if service_key == 'scheduler':
        return [SCHEDULER_SQS_DELIVERY_LAB]
    if service_key == 'cloudformation':
        return [CLOUDFORMATION_S3_SQS_LAB]
    if service_key == 'ec2':
        return [
            EC2_VPC_NETWORKING_LAB,
            EC2_SECURITY_CONTROLS_LAB,
            EC2_S3_GATEWAY_ENDPOINT_LAB,
            EC2_SQS_INTERFACE_ENDPOINT_LAB,
        ]
    return []


def get_lab(service_key: str, lab_key: str) -> dict[str, Any] | None:
    for lab in labs_for_service(service_key):
        if lab['key'] == lab_key:
            return lab
    return None


def _iam_client():
    return FlociClientFactory().client('iam')


def _s3_client():
    return FlociClientFactory().client('s3')


def _sqs_client():
    return FlociClientFactory().client('sqs')


def _sns_client():
    return FlociClientFactory().client('sns')


def _scheduler_client():
    return FlociClientFactory().client('scheduler')


def _cloudformation_client():
    return FlociClientFactory().client('cloudformation')


def _ec2_client():
    return FlociClientFactory().client('ec2')


def _json_text(value: Any) -> str:
    return json.dumps(_clean_response(value), indent=2, default=str)


def _error_code(exc: ClientError) -> str | None:
    return exc.response.get('Error', {}).get('Code')


def _ignore_missing(action) -> bool:
    try:
        action()
        return True
    except ClientError as exc:
        if _error_code(exc) == 'NoSuchEntity':
            return False
        raise


def _verify_iam_user(user_name: str) -> dict[str, Any]:
    try:
        user = _iam_client().get_user(UserName=user_name).get('User', {})
    except ClientError as exc:
        return {
            'status': 'failed',
            'message': str(exc),
        }

    if user.get('UserName') == user_name:
        return {
            'status': 'passed',
            'message': f'User {user_name} exists in local IAM.',
            'resource': _clean_response(user),
        }

    return {
        'status': 'failed',
        'message': f'User {user_name} was not returned by IAM.',
    }


def _verify_alice_policy() -> dict[str, Any]:
    try:
        policy = _iam_client().get_policy(PolicyArn=ALICE_POLICY_ARN).get('Policy', {})
    except ClientError as exc:
        return {
            'status': 'failed',
            'message': str(exc),
        }

    if policy.get('Arn') == ALICE_POLICY_ARN:
        return {
            'status': 'passed',
            'message': f'Policy {ALICE_POLICY_NAME} exists in local IAM.',
            'resource': _clean_response(policy),
        }

    return {
        'status': 'failed',
        'message': f'Policy {ALICE_POLICY_NAME} was not returned by IAM.',
    }


def _verify_alice_policy_attachment() -> dict[str, Any]:
    try:
        policies = _iam_client().list_attached_user_policies(UserName=ALICE_USER_NAME).get('AttachedPolicies', [])
    except ClientError as exc:
        return {
            'status': 'failed',
            'message': str(exc),
        }

    for policy in policies:
        if policy.get('PolicyArn') == ALICE_POLICY_ARN:
            return {
                'status': 'passed',
                'message': f'Policy {ALICE_POLICY_NAME} is attached to Alice.',
                'resource': _clean_response(policy),
            }

    return {
        'status': 'failed',
        'message': f'Policy {ALICE_POLICY_NAME} is not attached to Alice.',
    }


def _alice_access_keys() -> list[dict[str, Any]]:
    return _iam_client().list_access_keys(UserName=ALICE_USER_NAME).get('AccessKeyMetadata', [])


def _verify_alice_access_key() -> dict[str, Any]:
    try:
        keys = _alice_access_keys()
    except ClientError as exc:
        return {
            'status': 'failed',
            'message': str(exc),
        }

    if keys:
        return {
            'status': 'passed',
            'message': 'Alice has at least one access key in local IAM.',
            'resource': _clean_response(keys[0]),
        }

    return {
        'status': 'failed',
        'message': 'Alice does not have an access key.',
    }


def _verify_floci_developers_group() -> dict[str, Any]:
    try:
        group = _iam_client().get_group(GroupName=FLOCI_DEVELOPERS_GROUP_NAME).get('Group', {})
    except ClientError as exc:
        return {
            'status': 'failed',
            'message': str(exc),
        }

    if group.get('GroupName') == FLOCI_DEVELOPERS_GROUP_NAME:
        return {
            'status': 'passed',
            'message': f'Group {FLOCI_DEVELOPERS_GROUP_NAME} exists in local IAM.',
            'resource': _clean_response(group),
        }

    return {
        'status': 'failed',
        'message': f'Group {FLOCI_DEVELOPERS_GROUP_NAME} was not returned by IAM.',
    }


def _verify_alice_group_membership() -> dict[str, Any]:
    try:
        users = _iam_client().get_group(GroupName=FLOCI_DEVELOPERS_GROUP_NAME).get('Users', [])
    except ClientError as exc:
        return {
            'status': 'failed',
            'message': str(exc),
        }

    for user in users:
        if user.get('UserName') == ALICE_USER_NAME:
            return {
                'status': 'passed',
                'message': f'Alice is a member of {FLOCI_DEVELOPERS_GROUP_NAME}.',
                'resource': _clean_response(user),
            }

    return {
        'status': 'failed',
        'message': f'Alice is not a member of {FLOCI_DEVELOPERS_GROUP_NAME}.',
    }


def _verify_floci_developers_policy() -> dict[str, Any]:
    try:
        policy = _iam_client().get_policy(PolicyArn=FLOCI_DEVELOPERS_POLICY_ARN).get('Policy', {})
    except ClientError as exc:
        return {
            'status': 'failed',
            'message': str(exc),
        }

    if policy.get('Arn') == FLOCI_DEVELOPERS_POLICY_ARN:
        return {
            'status': 'passed',
            'message': f'Policy {FLOCI_DEVELOPERS_POLICY_NAME} exists in local IAM.',
            'resource': _clean_response(policy),
        }

    return {
        'status': 'failed',
        'message': f'Policy {FLOCI_DEVELOPERS_POLICY_NAME} was not returned by IAM.',
    }


def _verify_floci_developers_policy_attachment() -> dict[str, Any]:
    try:
        policies = _iam_client().list_attached_group_policies(
            GroupName=FLOCI_DEVELOPERS_GROUP_NAME,
        ).get('AttachedPolicies', [])
    except ClientError as exc:
        return {
            'status': 'failed',
            'message': str(exc),
        }

    for policy in policies:
        if policy.get('PolicyArn') == FLOCI_DEVELOPERS_POLICY_ARN:
            return {
                'status': 'passed',
                'message': f'Policy {FLOCI_DEVELOPERS_POLICY_NAME} is attached to {FLOCI_DEVELOPERS_GROUP_NAME}.',
                'resource': _clean_response(policy),
            }

    return {
        'status': 'failed',
        'message': f'Policy {FLOCI_DEVELOPERS_POLICY_NAME} is not attached to {FLOCI_DEVELOPERS_GROUP_NAME}.',
    }


def _verify_alice_inline_policy() -> dict[str, Any]:
    try:
        response = _iam_client().get_user_policy(
            UserName=ALICE_USER_NAME,
            PolicyName=ALICE_INLINE_POLICY_NAME,
        )
    except ClientError as exc:
        return {
            'status': 'failed',
            'message': str(exc),
        }

    if response.get('PolicyName') == ALICE_INLINE_POLICY_NAME:
        return {
            'status': 'passed',
            'message': f'Inline policy {ALICE_INLINE_POLICY_NAME} is embedded in Alice.',
            'resource': _clean_response(response),
        }

    return {
        'status': 'failed',
        'message': f'Inline policy {ALICE_INLINE_POLICY_NAME} was not returned for Alice.',
    }


def _verify_role(role_name: str, trusted_service: str) -> dict[str, Any]:
    try:
        role = _iam_client().get_role(RoleName=role_name).get('Role', {})
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    trust_policy = role.get('AssumeRolePolicyDocument') or {}
    statements = trust_policy.get('Statement', [])
    trusted = any(
        statement.get('Effect') == 'Allow'
        and statement.get('Action') == 'sts:AssumeRole'
        and statement.get('Principal', {}).get('Service') == trusted_service
        for statement in statements
    )
    if role.get('RoleName') == role_name and trusted:
        return {
            'status': 'passed',
            'message': f'Role {role_name} exists and trusts {trusted_service}.',
            'resource': _clean_response(role),
        }

    return {
        'status': 'failed',
        'message': f'Role {role_name} does not have the expected {trusted_service} trust policy.',
    }


def _verify_application_role_policy() -> dict[str, Any]:
    try:
        response = _iam_client().get_role_policy(
            RoleName=FLOCI_APPLICATION_ROLE_NAME,
            PolicyName=FLOCI_APPLICATION_ROLE_POLICY_NAME,
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    if response.get('PolicyName') == FLOCI_APPLICATION_ROLE_POLICY_NAME:
        return {
            'status': 'passed',
            'message': f'Inline policy {FLOCI_APPLICATION_ROLE_POLICY_NAME} is embedded in {FLOCI_APPLICATION_ROLE_NAME}.',
            'resource': _clean_response(response),
        }

    return {
        'status': 'failed',
        'message': f'Inline policy {FLOCI_APPLICATION_ROLE_POLICY_NAME} was not returned.',
    }


def _verify_ec2_instance_profile() -> dict[str, Any]:
    try:
        profile = _iam_client().get_instance_profile(
            InstanceProfileName=FLOCI_EC2_INSTANCE_PROFILE_NAME,
        ).get('InstanceProfile', {})
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    if profile.get('InstanceProfileName') == FLOCI_EC2_INSTANCE_PROFILE_NAME:
        return {
            'status': 'passed',
            'message': f'Instance profile {FLOCI_EC2_INSTANCE_PROFILE_NAME} exists.',
            'resource': _clean_response(profile),
        }

    return {
        'status': 'failed',
        'message': f'Instance profile {FLOCI_EC2_INSTANCE_PROFILE_NAME} was not returned.',
    }


def _verify_ec2_role_profile_association() -> dict[str, Any]:
    profile_verification = _verify_ec2_instance_profile()
    if profile_verification.get('status') != 'passed':
        return profile_verification

    profile = profile_verification.get('resource', {})
    for role in profile.get('Roles', []):
        if role.get('RoleName') == FLOCI_EC2_ROLE_NAME:
            return {
                'status': 'passed',
                'message': f'Role {FLOCI_EC2_ROLE_NAME} is in {FLOCI_EC2_INSTANCE_PROFILE_NAME}.',
                'resource': profile,
            }

    return {
        'status': 'failed',
        'message': f'Role {FLOCI_EC2_ROLE_NAME} is not in {FLOCI_EC2_INSTANCE_PROFILE_NAME}.',
    }


def _verify_s3_bucket() -> dict[str, Any]:
    try:
        response = FlociClientFactory().client('s3').head_bucket(Bucket=S3_BASICS_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    return {
        'status': 'passed',
        'message': f'Bucket {S3_BASICS_BUCKET_NAME} exists and is reachable.',
        'resource': {
            'name': S3_BASICS_BUCKET_NAME,
            **_clean_response(response),
        },
    }


def _verify_s3_objects_bucket() -> dict[str, Any]:
    try:
        response = _s3_client().head_bucket(Bucket=S3_OBJECTS_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    return {
        'status': 'passed',
        'message': f'Bucket {S3_OBJECTS_BUCKET_NAME} exists and is reachable.',
        'resource': {
            'name': S3_OBJECTS_BUCKET_NAME,
            **_clean_response(response),
        },
    }


def _verify_s3_hello_object() -> dict[str, Any]:
    try:
        s3 = _s3_client()
        head = s3.head_object(Bucket=S3_OBJECTS_BUCKET_NAME, Key=S3_HELLO_OBJECT_KEY)
        response = s3.get_object(Bucket=S3_OBJECTS_BUCKET_NAME, Key=S3_HELLO_OBJECT_KEY)
        body = response['Body'].read()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    content_type = head.get('ContentType')
    content_length = head.get('ContentLength')
    if (
        body == S3_HELLO_OBJECT_BYTES
        and content_type == 'text/plain'
        and content_length == len(S3_HELLO_OBJECT_BYTES)
    ):
        return {
            'status': 'passed',
            'message': f'Object {S3_HELLO_OBJECT_KEY} exists with the expected content and metadata.',
            'resource': {
                'bucket': S3_OBJECTS_BUCKET_NAME,
                'key': S3_HELLO_OBJECT_KEY,
                'content_type': content_type,
                'content_length': content_length,
                'body': body.decode('utf-8'),
            },
        }

    return {
        'status': 'failed',
        'message': f'Object {S3_HELLO_OBJECT_KEY} does not match the lab artifact.',
    }


def _verify_s3_prefixes_bucket() -> dict[str, Any]:
    try:
        response = _s3_client().head_bucket(Bucket=S3_PREFIXES_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    return {
        'status': 'passed',
        'message': f'Bucket {S3_PREFIXES_BUCKET_NAME} exists and is reachable.',
        'resource': {
            'name': S3_PREFIXES_BUCKET_NAME,
            **_clean_response(response),
        },
    }


def _verify_s3_report_object(key: str) -> dict[str, Any]:
    try:
        response = _s3_client().get_object(Bucket=S3_PREFIXES_BUCKET_NAME, Key=key)
        body = response['Body'].read()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    if body == S3_REPORT_BYTES:
        return {
            'status': 'passed',
            'message': f'Object {key} exists with the expected report contents.',
            'resource': {
                'bucket': S3_PREFIXES_BUCKET_NAME,
                'key': key,
                'content_length': len(body),
                'body': body.decode('utf-8'),
            },
        }

    return {
        'status': 'failed',
        'message': f'Object {key} does not match the report artifact.',
    }


def _verify_s3_metadata_bucket() -> dict[str, Any]:
    try:
        response = _s3_client().head_bucket(Bucket=S3_METADATA_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    return {
        'status': 'passed',
        'message': f'Bucket {S3_METADATA_BUCKET_NAME} exists and is reachable.',
        'resource': {
            'name': S3_METADATA_BUCKET_NAME,
            **_clean_response(response),
        },
    }


def _verify_s3_invoice_metadata() -> dict[str, Any]:
    try:
        s3 = _s3_client()
        head = s3.head_object(Bucket=S3_METADATA_BUCKET_NAME, Key=S3_INVOICE_OBJECT_KEY)
        response = s3.get_object(Bucket=S3_METADATA_BUCKET_NAME, Key=S3_INVOICE_OBJECT_KEY)
        body = response['Body'].read()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    metadata = head.get('Metadata', {})
    if (
        body == S3_INVOICE_BYTES
        and head.get('ContentType') == 'text/plain'
        and head.get('ContentLength') == len(S3_INVOICE_BYTES)
        and metadata == S3_INVOICE_METADATA
    ):
        return {
            'status': 'passed',
            'message': f'Object {S3_INVOICE_OBJECT_KEY} has the expected body, content type, and user metadata.',
            'resource': {
                'bucket': S3_METADATA_BUCKET_NAME,
                'key': S3_INVOICE_OBJECT_KEY,
                'content_type': head.get('ContentType'),
                'content_length': head.get('ContentLength'),
                'metadata': metadata,
            },
        }

    return {
        'status': 'failed',
        'message': f'Object {S3_INVOICE_OBJECT_KEY} does not match the expected metadata workflow.',
    }


def _verify_s3_invoice_tags() -> dict[str, Any]:
    try:
        response = _s3_client().get_object_tagging(
            Bucket=S3_METADATA_BUCKET_NAME,
            Key=S3_INVOICE_OBJECT_KEY,
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    tags = response.get('TagSet', [])
    expected = {(tag['Key'], tag['Value']) for tag in S3_INVOICE_TAGS}
    actual = {(tag.get('Key'), tag.get('Value')) for tag in tags}
    if actual == expected:
        return {
            'status': 'passed',
            'message': f'Object {S3_INVOICE_OBJECT_KEY} has the expected Environment and CostCenter tags.',
            'resource': {'tags': _clean_response(tags)},
        }

    return {
        'status': 'failed',
        'message': f'Object {S3_INVOICE_OBJECT_KEY} does not have the expected tag set.',
    }


def _verify_s3_versioning_bucket() -> dict[str, Any]:
    try:
        response = _s3_client().head_bucket(Bucket=S3_VERSIONING_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    return {
        'status': 'passed',
        'message': f'Bucket {S3_VERSIONING_BUCKET_NAME} exists and is reachable.',
        'resource': {
            'name': S3_VERSIONING_BUCKET_NAME,
            **_clean_response(response),
        },
    }


def _verify_s3_versioning_enabled() -> dict[str, Any]:
    try:
        response = _s3_client().get_bucket_versioning(Bucket=S3_VERSIONING_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    if response.get('Status') == 'Enabled':
        return {
            'status': 'passed',
            'message': f'Versioning is enabled on {S3_VERSIONING_BUCKET_NAME}.',
            'resource': _clean_response(response),
        }

    return {
        'status': 'failed',
        'message': f'Versioning is not enabled on {S3_VERSIONING_BUCKET_NAME}.',
    }


def _s3_configuration_versions() -> dict[str, Any]:
    s3 = _s3_client()
    response = s3.list_object_versions(
        Bucket=S3_VERSIONING_BUCKET_NAME,
        Prefix=S3_CONFIGURATION_KEY,
    )
    discovered: dict[str, dict[str, Any]] = {}
    unreadable_version_ids: list[str] = []
    for version in response.get('Versions', []):
        if version.get('Key') != S3_CONFIGURATION_KEY or not version.get('VersionId'):
            continue
        try:
            object_response = s3.get_object(
                Bucket=S3_VERSIONING_BUCKET_NAME,
                Key=S3_CONFIGURATION_KEY,
                VersionId=version['VersionId'],
            )
        except ClientError as exc:
            if _error_code(exc) not in {'500', 'InternalError', 'NoSuchKey', 'NoSuchVersion'}:
                raise
            unreadable_version_ids.append(version['VersionId'])
            continue
        body = object_response['Body'].read()
        if body == S3_CONFIGURATION_V1_BYTES:
            discovered.setdefault('v1', {**version, 'body': S3_CONFIGURATION_V1_TEXT})
        elif body == S3_CONFIGURATION_V2_BYTES:
            discovered.setdefault('v2', {**version, 'body': S3_CONFIGURATION_V2_TEXT})
    return {
        'response': response,
        'v1': discovered.get('v1'),
        'v2': discovered.get('v2'),
        'unreadable_version_ids': unreadable_version_ids,
    }


def _verify_s3_configuration_version_one() -> dict[str, Any]:
    try:
        versions = _s3_configuration_versions()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    version = versions.get('v1')
    if version:
        return {
            'status': 'passed',
            'message': f'Configuration v1 is stored as version {version["VersionId"]}.',
            'resource': _clean_response(version),
        }

    return {
        'status': 'failed',
        'message': 'Configuration v1 was not found in the stored object versions.',
    }


def _verify_s3_configuration_versions() -> dict[str, Any]:
    try:
        versions = _s3_configuration_versions()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    version_one = versions.get('v1')
    version_two = versions.get('v2')
    if version_one and version_two and version_two.get('IsLatest') is True:
        return {
            'status': 'passed',
            'message': 'Configuration v1 is preserved and configuration v2 is the latest version.',
            'resource': {
                'v1': _clean_response(version_one),
                'v2': _clean_response(version_two),
            },
        }

    return {
        'status': 'failed',
        'message': 'The expected v1 and latest v2 object versions were not both found.',
    }


def _verify_s3_presigned_bucket() -> dict[str, Any]:
    try:
        response = _s3_client().head_bucket(Bucket=S3_PRESIGNED_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    return {
        'status': 'passed',
        'message': f'Bucket {S3_PRESIGNED_BUCKET_NAME} exists and is reachable.',
        'resource': {
            'name': S3_PRESIGNED_BUCKET_NAME,
            **_clean_response(response),
        },
    }


def _verify_s3_presigned_object() -> dict[str, Any]:
    try:
        response = _s3_client().get_object(
            Bucket=S3_PRESIGNED_BUCKET_NAME,
            Key=S3_PRESIGNED_OBJECT_KEY,
        )
        body = response['Body'].read()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    if body == S3_PRESIGNED_GUIDE_BYTES:
        return {
            'status': 'passed',
            'message': f'Object {S3_PRESIGNED_OBJECT_KEY} contains the expected guide.',
            'resource': {
                'bucket': S3_PRESIGNED_BUCKET_NAME,
                'key': S3_PRESIGNED_OBJECT_KEY,
                'content_length': len(body),
            },
        }

    return {
        'status': 'failed',
        'message': f'Object {S3_PRESIGNED_OBJECT_KEY} does not match the guide artifact.',
    }


def _generate_s3_presigned_url() -> str:
    return _s3_client().generate_presigned_url(
        'get_object',
        Params={
            'Bucket': S3_PRESIGNED_BUCKET_NAME,
            'Key': S3_PRESIGNED_OBJECT_KEY,
        },
        ExpiresIn=S3_PRESIGNED_EXPIRES_IN,
    )


def _redeem_s3_presigned_url(url: str) -> bytes:
    try:
        with urlopen(url, timeout=3) as response:
            return response.read()
    except (OSError, URLError) as exc:
        raise ValueError(f'Presigned URL could not be redeemed: {exc}') from exc


def _verify_s3_presigned_access() -> dict[str, Any]:
    try:
        url = _generate_s3_presigned_url()
        body = _redeem_s3_presigned_url(url)
    except (ClientError, ValueError) as exc:
        return {'status': 'failed', 'message': str(exc)}

    if body == S3_PRESIGNED_GUIDE_BYTES:
        return {
            'status': 'passed',
            'message': 'The five-minute presigned URL returned the expected guide without AWS credentials.',
            'resource': {
                'url': url,
                'expires_in': S3_PRESIGNED_EXPIRES_IN,
                'downloaded_body': body.decode('utf-8'),
            },
        }

    return {
        'status': 'failed',
        'message': 'The presigned URL did not return the expected guide.',
    }


def _verify_s3_security_bucket() -> dict[str, Any]:
    try:
        response = _s3_client().head_bucket(Bucket=S3_SECURITY_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    return {
        'status': 'passed',
        'message': f'Bucket {S3_SECURITY_BUCKET_NAME} exists and is reachable.',
        'resource': {
            'name': S3_SECURITY_BUCKET_NAME,
            **_clean_response(response),
        },
    }


def _verify_s3_public_access_block() -> dict[str, Any]:
    try:
        response = _s3_client().get_public_access_block(Bucket=S3_SECURITY_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    configuration = response.get('PublicAccessBlockConfiguration', {})
    if configuration == S3_PUBLIC_ACCESS_BLOCK:
        return {
            'status': 'passed',
            'message': 'All four S3 Public Access Block safeguards are enabled.',
            'resource': _clean_response(configuration),
        }

    return {
        'status': 'failed',
        'message': 'The bucket does not have the expected Public Access Block configuration.',
    }


def _verify_s3_security_bucket_policy() -> dict[str, Any]:
    try:
        response = _s3_client().get_bucket_policy(Bucket=S3_SECURITY_BUCKET_NAME)
        policy = json.loads(response.get('Policy', '{}'))
    except (ClientError, json.JSONDecodeError) as exc:
        return {'status': 'failed', 'message': str(exc)}

    if policy == S3_SECURITY_BUCKET_POLICY:
        return {
            'status': 'passed',
            'message': 'The bucket policy grants only s3:ListBucket to the local account root.',
            'resource': _clean_response(policy),
        }

    return {
        'status': 'failed',
        'message': 'The bucket policy does not match the expected least-privilege policy.',
    }


def _verify_s3_encryption_bucket() -> dict[str, Any]:
    try:
        response = _s3_client().head_bucket(Bucket=S3_ENCRYPTION_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    return {
        'status': 'passed',
        'message': f'Bucket {S3_ENCRYPTION_BUCKET_NAME} exists and is reachable.',
        'resource': {
            'name': S3_ENCRYPTION_BUCKET_NAME,
            **_clean_response(response),
        },
    }


def _verify_s3_default_encryption() -> dict[str, Any]:
    try:
        response = _s3_client().get_bucket_encryption(Bucket=S3_ENCRYPTION_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    configuration = response.get('ServerSideEncryptionConfiguration', {})
    if configuration == S3_SSE_S3_CONFIGURATION:
        return {
            'status': 'passed',
            'message': 'Default SSE-S3 encryption is configured with the AES256 algorithm.',
            'resource': _clean_response(configuration),
        }

    return {
        'status': 'failed',
        'message': 'The bucket does not have the expected AES256 default-encryption configuration.',
    }


def _verify_s3_encrypted_record_workflow() -> dict[str, Any]:
    encryption = _verify_s3_default_encryption()
    if encryption.get('status') != 'passed':
        return encryption

    try:
        s3 = _s3_client()
        head = s3.head_object(Bucket=S3_ENCRYPTION_BUCKET_NAME, Key=S3_ENCRYPTION_OBJECT_KEY)
        response = s3.get_object(Bucket=S3_ENCRYPTION_BUCKET_NAME, Key=S3_ENCRYPTION_OBJECT_KEY)
        body = response['Body'].read()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    if (
        body == S3_ENCRYPTION_RECORD_BYTES
        and head.get('ContentType') == 'text/plain'
        and head.get('ContentLength') == len(S3_ENCRYPTION_RECORD_BYTES)
    ):
        return {
            'status': 'passed',
            'message': 'The record was uploaded after the bucket AES256 default was enabled.',
            'resource': {
                'bucket': S3_ENCRYPTION_BUCKET_NAME,
                'key': S3_ENCRYPTION_OBJECT_KEY,
                'content_type': head.get('ContentType'),
                'content_length': head.get('ContentLength'),
            },
        }

    return {
        'status': 'failed',
        'message': 'The protected record does not match the expected artifact.',
    }


def _verify_s3_lifecycle_bucket() -> dict[str, Any]:
    try:
        response = _s3_client().head_bucket(Bucket=S3_LIFECYCLE_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    return {
        'status': 'passed',
        'message': f'Bucket {S3_LIFECYCLE_BUCKET_NAME} exists and is reachable.',
        'resource': {
            'name': S3_LIFECYCLE_BUCKET_NAME,
            **_clean_response(response),
        },
    }


def _verify_s3_lifecycle_log() -> dict[str, Any]:
    try:
        s3 = _s3_client()
        head = s3.head_object(Bucket=S3_LIFECYCLE_BUCKET_NAME, Key=S3_LIFECYCLE_OBJECT_KEY)
        response = s3.get_object(Bucket=S3_LIFECYCLE_BUCKET_NAME, Key=S3_LIFECYCLE_OBJECT_KEY)
        body = response['Body'].read()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    if (
        body == S3_LIFECYCLE_LOG_BYTES
        and head.get('ContentType') == 'text/plain'
        and head.get('ContentLength') == len(S3_LIFECYCLE_LOG_BYTES)
    ):
        return {
            'status': 'passed',
            'message': 'The sample application log exists under the logs/ lifecycle prefix.',
            'resource': {
                'bucket': S3_LIFECYCLE_BUCKET_NAME,
                'key': S3_LIFECYCLE_OBJECT_KEY,
                'content_type': head.get('ContentType'),
                'content_length': head.get('ContentLength'),
            },
        }

    return {
        'status': 'failed',
        'message': 'The lifecycle log does not match the expected artifact.',
    }


def _verify_s3_lifecycle_configuration() -> dict[str, Any]:
    try:
        response = _s3_client().get_bucket_lifecycle_configuration(
            Bucket=S3_LIFECYCLE_BUCKET_NAME,
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    rules = response.get('Rules', [])
    rule = next(
        (item for item in rules if item.get('ID') == S3_LIFECYCLE_RULE_ID),
        None,
    )
    prefix = (rule or {}).get('Filter', {}).get('Prefix')
    if prefix is None:
        prefix = (rule or {}).get('Prefix')

    if (
        rule
        and rule.get('Status') == 'Enabled'
        and prefix == 'logs/'
        and rule.get('Expiration', {}).get('Days') == 30
    ):
        return {
            'status': 'passed',
            'message': 'The enabled lifecycle rule expires objects under logs/ after 30 days.',
            'resource': _clean_response(rule),
        }

    return {
        'status': 'failed',
        'message': 'The bucket does not have the expected 30-day logs/ expiration rule.',
    }


def _verify_s3_cors_bucket() -> dict[str, Any]:
    try:
        response = _s3_client().head_bucket(Bucket=S3_CORS_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    return {
        'status': 'passed',
        'message': f'Bucket {S3_CORS_BUCKET_NAME} exists and is reachable.',
        'resource': {
            'name': S3_CORS_BUCKET_NAME,
            **_clean_response(response),
        },
    }


def _verify_s3_cors_configuration() -> dict[str, Any]:
    try:
        response = _s3_client().get_bucket_cors(Bucket=S3_CORS_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    rules = response.get('CORSRules', [])
    expected_rule = S3_CORS_CONFIGURATION['CORSRules'][0]
    rule = next(
        (item for item in rules if item.get('ID') == expected_rule['ID']),
        None,
    )

    if rule and all(
        rule.get(field) == expected_rule[field]
        for field in (
            'AllowedOrigins',
            'AllowedMethods',
            'AllowedHeaders',
            'ExposeHeaders',
            'MaxAgeSeconds',
        )
    ):
        return {
            'status': 'passed',
            'message': 'The CORS rule allows GET and HEAD from http://localhost:3000 and exposes ETag.',
            'resource': _clean_response(rule),
        }

    return {
        'status': 'failed',
        'message': 'The bucket does not have the expected local web app CORS rule.',
    }


def _s3_notifications_queue_url() -> str:
    return _sqs_client().get_queue_url(
        QueueName=S3_NOTIFICATIONS_QUEUE_NAME,
    )['QueueUrl']


def _verify_s3_notifications_queue() -> dict[str, Any]:
    try:
        queue_url = _s3_notifications_queue_url()
        response = _sqs_client().get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=['QueueArn'],
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    queue_arn = response.get('Attributes', {}).get('QueueArn')
    if queue_arn == S3_NOTIFICATIONS_QUEUE_ARN:
        return {
            'status': 'passed',
            'message': f'Queue {S3_NOTIFICATIONS_QUEUE_NAME} exists with the expected ARN.',
            'resource': {
                'name': S3_NOTIFICATIONS_QUEUE_NAME,
                'url': queue_url,
                'arn': queue_arn,
            },
        }

    return {
        'status': 'failed',
        'message': 'The notification queue does not have the expected ARN.',
    }


def _verify_s3_notifications_queue_policy() -> dict[str, Any]:
    try:
        queue_url = _s3_notifications_queue_url()
        response = _sqs_client().get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=['Policy'],
        )
        policy = json.loads(response.get('Attributes', {}).get('Policy', '{}'))
    except (ClientError, json.JSONDecodeError) as exc:
        return {'status': 'failed', 'message': str(exc)}

    if policy == S3_NOTIFICATIONS_QUEUE_POLICY:
        return {
            'status': 'passed',
            'message': 'The queue policy authorizes this S3 bucket to send object-created events.',
            'resource': _clean_response(policy),
        }

    return {
        'status': 'failed',
        'message': 'The queue does not have the expected S3 delivery policy.',
    }


def _verify_s3_notifications_bucket() -> dict[str, Any]:
    try:
        response = _s3_client().head_bucket(Bucket=S3_NOTIFICATIONS_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    return {
        'status': 'passed',
        'message': f'Bucket {S3_NOTIFICATIONS_BUCKET_NAME} exists and is reachable.',
        'resource': {
            'name': S3_NOTIFICATIONS_BUCKET_NAME,
            **_clean_response(response),
        },
    }


def _verify_s3_notification_configuration() -> dict[str, Any]:
    try:
        response = _s3_client().get_bucket_notification_configuration(
            Bucket=S3_NOTIFICATIONS_BUCKET_NAME,
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    configurations = response.get('QueueConfigurations', [])
    configuration = next(
        (
            item for item in configurations
            if item.get('Id') == S3_NOTIFICATIONS_CONFIGURATION_ID
        ),
        None,
    )
    if (
        configuration
        and configuration.get('QueueArn') == S3_NOTIFICATIONS_QUEUE_ARN
        and configuration.get('Events') == ['s3:ObjectCreated:*']
    ):
        return {
            'status': 'passed',
            'message': 'S3 object-created events are routed to the lab SQS queue.',
            'resource': _clean_response(configuration),
        }

    return {
        'status': 'failed',
        'message': 'The bucket does not have the expected SQS notification configuration.',
    }


def _verify_s3_notification_object() -> dict[str, Any]:
    try:
        s3 = _s3_client()
        head = s3.head_object(
            Bucket=S3_NOTIFICATIONS_BUCKET_NAME,
            Key=S3_NOTIFICATIONS_OBJECT_KEY,
        )
        response = s3.get_object(
            Bucket=S3_NOTIFICATIONS_BUCKET_NAME,
            Key=S3_NOTIFICATIONS_OBJECT_KEY,
        )
        body = response['Body'].read()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    if (
        body == S3_NOTIFICATIONS_REPORT_BYTES
        and head.get('ContentType') == 'text/plain'
        and head.get('ContentLength') == len(S3_NOTIFICATIONS_REPORT_BYTES)
    ):
        return {
            'status': 'passed',
            'message': 'The report object exists and is ready to produce an S3 event.',
            'resource': {
                'bucket': S3_NOTIFICATIONS_BUCKET_NAME,
                'key': S3_NOTIFICATIONS_OBJECT_KEY,
                'content_type': head.get('ContentType'),
                'content_length': head.get('ContentLength'),
            },
        }

    return {
        'status': 'failed',
        'message': 'The notification report does not match the expected artifact.',
    }


def _s3_event_record(messages: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    for message in messages:
        try:
            body = json.loads(message.get('Body', '{}'))
        except json.JSONDecodeError:
            continue
        for record in body.get('Records', []):
            s3_record = record.get('s3', {})
            if (
                record.get('eventSource') == 'aws:s3'
                and record.get('eventName', '').startswith('ObjectCreated:')
                and s3_record.get('bucket', {}).get('name') == S3_NOTIFICATIONS_BUCKET_NAME
                and s3_record.get('object', {}).get('key') == S3_NOTIFICATIONS_OBJECT_KEY
            ):
                return message, record
    return None, None


def _verify_s3_notification_delivery() -> dict[str, Any]:
    try:
        queue_url = _s3_notifications_queue_url()
        response = _sqs_client().receive_message(
            QueueUrl=queue_url,
            MaxNumberOfMessages=10,
            VisibilityTimeout=0,
            WaitTimeSeconds=1,
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    message, record = _s3_event_record(response.get('Messages', []))
    if message and record:
        return {
            'status': 'passed',
            'message': 'SQS received the ObjectCreated event for uploads/report.txt.',
            'resource': {
                'message_id': message.get('MessageId'),
                'event': _clean_response(record),
            },
        }

    return {
        'status': 'failed',
        'message': 'The queue does not contain the expected S3 object-created event.',
    }


def _verify_s3_multipart_bucket() -> dict[str, Any]:
    try:
        response = _s3_client().head_bucket(Bucket=S3_MULTIPART_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    return {
        'status': 'passed',
        'message': f'Bucket {S3_MULTIPART_BUCKET_NAME} exists and is reachable.',
        'resource': {
            'name': S3_MULTIPART_BUCKET_NAME,
            **_clean_response(response),
        },
    }


def _s3_active_multipart_upload() -> dict[str, Any] | None:
    response = _s3_client().list_multipart_uploads(
        Bucket=S3_MULTIPART_BUCKET_NAME,
        Prefix=S3_MULTIPART_OBJECT_KEY,
    )
    return next(
        (
            upload for upload in response.get('Uploads', [])
            if upload.get('Key') == S3_MULTIPART_OBJECT_KEY
        ),
        None,
    )


def _verify_s3_multipart_upload_started() -> dict[str, Any]:
    try:
        upload = _s3_active_multipart_upload()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    if upload and upload.get('UploadId'):
        return {
            'status': 'passed',
            'message': 'The multipart upload is active and has a discoverable upload ID.',
            'resource': _clean_response(upload),
        }

    return {
        'status': 'failed',
        'message': 'No active multipart upload exists for the lab object.',
    }


def _s3_multipart_parts() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    upload = _s3_active_multipart_upload()
    if not upload or not upload.get('UploadId'):
        raise ValueError('No active multipart upload exists for the lab object.')
    response = _s3_client().list_parts(
        Bucket=S3_MULTIPART_BUCKET_NAME,
        Key=S3_MULTIPART_OBJECT_KEY,
        UploadId=upload['UploadId'],
    )
    return upload, response.get('Parts', [])


def _verify_s3_multipart_parts(required_part_numbers: set[int]) -> dict[str, Any]:
    try:
        upload, parts = _s3_multipart_parts()
    except (ClientError, ValueError) as exc:
        return {'status': 'failed', 'message': str(exc)}

    by_number = {part.get('PartNumber'): part for part in parts}
    expected_sizes = {
        1: len(S3_MULTIPART_PART_ONE_BYTES),
        2: len(S3_MULTIPART_PART_TWO_BYTES),
    }
    if all(
        number in by_number
        and by_number[number].get('ETag')
        and by_number[number].get('Size') == expected_sizes[number]
        for number in required_part_numbers
    ):
        return {
            'status': 'passed',
            'message': (
                'Both multipart parts are uploaded with their expected sizes and ETags.'
                if required_part_numbers == {1, 2}
                else 'Multipart part 1 is uploaded with its expected size and ETag.'
            ),
            'resource': {
                'upload_id': upload.get('UploadId'),
                'parts': _clean_response(parts),
            },
        }

    return {
        'status': 'failed',
        'message': 'The active upload does not contain the expected multipart parts.',
    }


def _verify_s3_multipart_object() -> dict[str, Any]:
    try:
        s3 = _s3_client()
        head = s3.head_object(
            Bucket=S3_MULTIPART_BUCKET_NAME,
            Key=S3_MULTIPART_OBJECT_KEY,
        )
        response = s3.get_object(
            Bucket=S3_MULTIPART_BUCKET_NAME,
            Key=S3_MULTIPART_OBJECT_KEY,
        )
        body = response['Body'].read()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    if (
        body == S3_MULTIPART_OBJECT_BYTES
        and head.get('ContentType') == S3_MULTIPART_CONTENT_TYPE
        and head.get('ContentLength') == len(S3_MULTIPART_OBJECT_BYTES)
    ):
        return {
            'status': 'passed',
            'message': 'The completed object contains both multipart payloads in order.',
            'resource': {
                'bucket': S3_MULTIPART_BUCKET_NAME,
                'key': S3_MULTIPART_OBJECT_KEY,
                'content_type': head.get('ContentType'),
                'content_length': head.get('ContentLength'),
                'etag': head.get('ETag'),
            },
        }

    return {
        'status': 'failed',
        'message': 'The completed multipart object does not match the expected bytes.',
    }


def _sqs_basics_queue_url() -> str:
    return _sqs_client().get_queue_url(
        QueueName=SQS_BASICS_QUEUE_NAME,
    )['QueueUrl']


def _verify_sqs_basics_queue_url() -> dict[str, Any]:
    try:
        queue_url = _sqs_basics_queue_url()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    if queue_url.rstrip('/').endswith(f'/{SQS_BASICS_QUEUE_NAME}'):
        return {
            'status': 'passed',
            'message': f'Queue URL for {SQS_BASICS_QUEUE_NAME} resolves successfully.',
            'resource': {
                'name': SQS_BASICS_QUEUE_NAME,
                'url': queue_url,
            },
        }

    return {
        'status': 'failed',
        'message': 'The resolved queue URL does not match the expected queue name.',
    }


def _verify_sqs_basics_queue_attributes() -> dict[str, Any]:
    try:
        queue_url = _sqs_basics_queue_url()
        response = _sqs_client().get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=['All'],
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    attributes = response.get('Attributes', {})
    if attributes.get('QueueArn') == SQS_BASICS_QUEUE_ARN:
        return {
            'status': 'passed',
            'message': 'The queue attributes contain the expected standard-queue ARN.',
            'resource': {
                'url': queue_url,
                'attributes': _clean_response(attributes),
            },
        }

    return {
        'status': 'failed',
        'message': 'The queue attributes do not contain the expected queue ARN.',
    }


def _verify_sqs_basics_listed() -> dict[str, Any]:
    try:
        response = _sqs_client().list_queues()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    queue_urls = response.get('QueueUrls', [])
    queue_url = next(
        (
            url for url in queue_urls
            if url.rstrip('/').endswith(f'/{SQS_BASICS_QUEUE_NAME}')
        ),
        None,
    )
    if queue_url:
        return {
            'status': 'passed',
            'message': f'{SQS_BASICS_QUEUE_NAME} appears in the account queue list.',
            'resource': {
                'url': queue_url,
                'queue_urls': queue_urls,
            },
        }

    return {
        'status': 'failed',
        'message': f'{SQS_BASICS_QUEUE_NAME} does not appear in the queue list.',
    }


def _sqs_receive_lab_messages(
    visibility_timeout: int = 0,
    wait_time_seconds: int = 1,
) -> dict[str, Any]:
    queue_url = _sqs_basics_queue_url()
    return _sqs_client().receive_message(
        QueueUrl=queue_url,
        MaxNumberOfMessages=10,
        VisibilityTimeout=visibility_timeout,
        WaitTimeSeconds=wait_time_seconds,
        AttributeNames=['All'],
        MessageAttributeNames=['All'],
    )


def _sqs_lifecycle_message(
    messages: list[dict[str, Any]],
) -> dict[str, Any] | None:
    return next(
        (
            message for message in messages
            if message.get('Body') == SQS_MESSAGE_BODY_TEXT
            and message.get('MessageAttributes', {}).get('Lab', {}).get('StringValue')
            == 'message-lifecycle'
        ),
        None,
    )


def _verify_sqs_lifecycle_message() -> dict[str, Any]:
    try:
        response = _sqs_receive_lab_messages(visibility_timeout=0)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    message = _sqs_lifecycle_message(response.get('Messages', []))
    if message:
        return {
            'status': 'passed',
            'message': 'The queue contains the expected order.created event and Lab attribute.',
            'resource': _clean_response(message),
        }

    return {
        'status': 'failed',
        'message': 'The queue does not contain the expected lifecycle message.',
    }


def _verify_sqs_lifecycle_message_deleted() -> dict[str, Any]:
    if not cache.get(SQS_MESSAGE_DELETE_CACHE_KEY):
        return {
            'status': 'failed',
            'message': 'The lifecycle message has not been deleted by this lab run.',
        }

    verification = _verify_sqs_lifecycle_message()
    if verification.get('status') == 'failed':
        return {
            'status': 'passed',
            'message': 'The processed lifecycle message was deleted from the queue.',
        }

    return {
        'status': 'failed',
        'message': 'The lifecycle message is still available in the queue.',
    }


def _sqs_visibility_message(
    messages: list[dict[str, Any]],
) -> dict[str, Any] | None:
    return next(
        (
            message for message in messages
            if message.get('Body') == SQS_VISIBILITY_BODY_TEXT
            and message.get('MessageAttributes', {}).get('Lab', {}).get('StringValue')
            == 'visibility-timeout'
        ),
        None,
    )


def _verify_sqs_visibility_message_available() -> dict[str, Any]:
    try:
        response = _sqs_receive_lab_messages(visibility_timeout=0)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}

    message = _sqs_visibility_message(response.get('Messages', []))
    if message:
        return {
            'status': 'passed',
            'message': 'The visibility-timeout job is available in the queue.',
            'resource': _clean_response(message),
        }

    return {
        'status': 'failed',
        'message': 'The visibility-timeout job is not currently available.',
    }


def _verify_sqs_visibility_hidden() -> dict[str, Any]:
    if not cache.get(SQS_VISIBILITY_HIDDEN_CACHE_KEY):
        return {
            'status': 'failed',
            'message': 'The lab has not yet verified the message while it was hidden.',
        }
    return {
        'status': 'passed',
        'message': 'The job was unavailable while its visibility timeout was active.',
    }


def _verify_sqs_visibility_returned() -> dict[str, Any]:
    if not cache.get(SQS_VISIBILITY_RETURNED_CACHE_KEY):
        return {
            'status': 'failed',
            'message': 'The lab has not yet received the job after its timeout.',
        }
    verification = _verify_sqs_visibility_message_available()
    if verification.get('status') == 'passed':
        verification['message'] = 'The undeleted job became available again after the visibility timeout.'
    return verification


def _sqs_delayed_message(
    messages: list[dict[str, Any]],
) -> dict[str, Any] | None:
    return next(
        (
            message for message in messages
            if message.get('Body') == SQS_DELAYED_BODY_TEXT
            and message.get('MessageAttributes', {}).get('Lab', {}).get('StringValue')
            == 'delayed-message'
        ),
        None,
    )


def _sqs_delayed_count() -> tuple[str, int]:
    queue_url = _sqs_basics_queue_url()
    response = _sqs_client().get_queue_attributes(
        QueueUrl=queue_url,
        AttributeNames=['ApproximateNumberOfMessagesDelayed'],
    )
    return (
        queue_url,
        int(response.get('Attributes', {}).get('ApproximateNumberOfMessagesDelayed', 0)),
    )


def _sqs_wait_for_delayed_message(
    wait_seconds: float,
    visibility_timeout: int,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    deadline = time.monotonic() + wait_seconds
    last_response: dict[str, Any] = {}
    while True:
        remaining = max(0, deadline - time.monotonic())
        last_response = _sqs_receive_lab_messages(
            visibility_timeout=visibility_timeout,
            wait_time_seconds=min(1, max(0, int(remaining))),
        )
        message = _sqs_delayed_message(last_response.get('Messages', []))
        if message or time.monotonic() >= deadline:
            return last_response, message
        time.sleep(min(0.1, remaining))


def _verify_sqs_delayed_observed() -> dict[str, Any]:
    if not cache.get(SQS_DELAYED_OBSERVED_CACHE_KEY):
        return {
            'status': 'failed',
            'message': 'The lab has not yet observed the message while it was delayed.',
        }
    return {
        'status': 'passed',
        'message': 'The queue reported a delayed message that was not yet receivable.',
    }


def _verify_sqs_delayed_returned() -> dict[str, Any]:
    if not cache.get(SQS_DELAYED_RETURNED_CACHE_KEY):
        return {
            'status': 'failed',
            'message': 'The delayed report request has not yet been received.',
        }
    try:
        response, message = _sqs_wait_for_delayed_message(
            wait_seconds=0.5,
            visibility_timeout=0,
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    if message:
        return {
            'status': 'passed',
            'message': 'The delayed report request became available after its delivery delay.',
            'resource': _clean_response(message),
        }
    return {
        'status': 'failed',
        'message': 'The delayed report request is no longer available in the queue.',
    }


def _sqs_batch_messages(
    messages: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    return [
        message for message in messages
        if message.get('Body') in SQS_BATCH_MESSAGE_TEXTS
        and message.get('MessageAttributes', {}).get('Lab', {}).get('StringValue')
        == SQS_BATCH_ATTRIBUTE_VALUE
    ]


def _sqs_collect_batch_messages(
    wait_seconds: float,
    visibility_timeout: int,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    deadline = time.monotonic() + wait_seconds
    collected: dict[str, dict[str, Any]] = {}
    responses: list[dict[str, Any]] = []
    while time.monotonic() < deadline and len(collected) < len(SQS_BATCH_MESSAGE_TEXTS):
        response = _sqs_receive_lab_messages(
            visibility_timeout=visibility_timeout,
            wait_time_seconds=1,
        )
        responses.append(response)
        for message in _sqs_batch_messages(response.get('Messages', [])):
            collected[message['Body']] = message
        if len(collected) < len(SQS_BATCH_MESSAGE_TEXTS):
            time.sleep(0.05)
    return list(collected.values()), responses


def _verify_sqs_batch_available() -> dict[str, Any]:
    try:
        messages, _ = _sqs_collect_batch_messages(
            wait_seconds=2,
            visibility_timeout=0,
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    bodies = {message.get('Body') for message in messages}
    if bodies == set(SQS_BATCH_MESSAGE_TEXTS):
        return {
            'status': 'passed',
            'message': 'All three task events are available in the queue.',
            'resource': {'messages': _clean_response(messages)},
        }
    return {
        'status': 'failed',
        'message': f'Expected three task events but found {len(bodies)}.',
    }


def _verify_sqs_batch_deleted() -> dict[str, Any]:
    if not cache.get(SQS_BATCH_DELETE_CACHE_KEY):
        return {
            'status': 'failed',
            'message': 'The task batch has not been deleted by this lab run.',
        }
    verification = _verify_sqs_batch_available()
    if verification.get('status') == 'failed':
        return {
            'status': 'passed',
            'message': 'All three processed task events were deleted from the queue.',
        }
    return {
        'status': 'failed',
        'message': 'One or more task events remain available in the queue.',
    }


def _verify_sqs_configuration_attributes() -> dict[str, Any]:
    try:
        queue_url = _sqs_basics_queue_url()
        response = _sqs_client().get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=list(SQS_CONFIGURATION_ATTRIBUTES),
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    attributes = response.get('Attributes', {})
    if all(
        attributes.get(name) == value
        for name, value in SQS_CONFIGURATION_ATTRIBUTES.items()
    ):
        return {
            'status': 'passed',
            'message': 'The queue has the expected visibility, retention, and long-poll settings.',
            'resource': {
                'queue_url': queue_url,
                'attributes': _clean_response(attributes),
            },
        }
    return {
        'status': 'failed',
        'message': 'The queue does not have all expected processing attributes.',
    }


def _verify_sqs_configuration_tags() -> dict[str, Any]:
    try:
        queue_url = _sqs_basics_queue_url()
        response = _sqs_client().list_queue_tags(QueueUrl=queue_url)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    tags = response.get('Tags', {})
    if all(tags.get(name) == value for name, value in SQS_CONFIGURATION_TAGS.items()):
        return {
            'status': 'passed',
            'message': 'The queue is tagged Environment=lab and Purpose=training.',
            'resource': {
                'queue_url': queue_url,
                'tags': tags,
            },
        }
    return {
        'status': 'failed',
        'message': 'The queue does not have the expected training tags.',
    }


def _sqs_queue_url(queue_name: str) -> str:
    return _sqs_client().get_queue_url(QueueName=queue_name)['QueueUrl']


def _verify_sqs_redrive_queue(
    queue_name: str,
    expected_arn: str,
) -> dict[str, Any]:
    try:
        queue_url = _sqs_queue_url(queue_name)
        response = _sqs_client().get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=['QueueArn'],
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    queue_arn = response.get('Attributes', {}).get('QueueArn')
    if queue_arn == expected_arn:
        return {
            'status': 'passed',
            'message': f'Queue {queue_name} exists with the expected ARN.',
            'resource': {
                'name': queue_name,
                'url': queue_url,
                'arn': queue_arn,
            },
        }
    return {
        'status': 'failed',
        'message': f'Queue {queue_name} does not have the expected ARN.',
    }


def _verify_sqs_redrive_policy() -> dict[str, Any]:
    try:
        queue_url = _sqs_queue_url(SQS_REDRIVE_SOURCE_QUEUE_NAME)
        response = _sqs_client().get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=['RedrivePolicy'],
        )
        policy_text = response.get('Attributes', {}).get('RedrivePolicy', '')
        policy = json.loads(policy_text) if policy_text else {}
    except (ClientError, json.JSONDecodeError) as exc:
        return {'status': 'failed', 'message': str(exc)}
    if policy == SQS_REDRIVE_POLICY:
        return {
            'status': 'passed',
            'message': 'The source queue routes messages to the DLQ after two failed receives.',
            'resource': {
                'queue_url': queue_url,
                'redrive_policy': policy,
            },
        }
    return {
        'status': 'failed',
        'message': 'The source queue does not have the expected redrive policy.',
    }


def _sqs_redrive_message(
    messages: list[dict[str, Any]],
) -> dict[str, Any] | None:
    return next(
        (
            message for message in messages
            if message.get('Body') == SQS_REDRIVE_BODY_TEXT
            and message.get('MessageAttributes', {}).get('Lab', {}).get('StringValue')
            == 'dead-letter-redrive'
        ),
        None,
    )


def _sqs_receive_redrive_message(
    queue_name: str,
    wait_time_seconds: int = 0,
) -> dict[str, Any]:
    return _sqs_client().receive_message(
        QueueUrl=_sqs_queue_url(queue_name),
        MaxNumberOfMessages=1,
        VisibilityTimeout=0,
        WaitTimeSeconds=wait_time_seconds,
        AttributeNames=['All'],
        MessageAttributeNames=['All'],
    )


def _verify_sqs_redrive_marker(
    cache_key: str,
    passed_message: str,
    failed_message: str,
) -> dict[str, Any]:
    if cache.get(cache_key):
        return {'status': 'passed', 'message': passed_message}
    return {'status': 'failed', 'message': failed_message}


def _verify_sqs_redrive_task() -> dict[str, Any]:
    task_handle = cache.get(SQS_REDRIVE_TASK_CACHE_KEY)
    if not task_handle:
        return {
            'status': 'failed',
            'message': 'No managed message move task has been started by this lab.',
        }
    try:
        response = _sqs_client().list_message_move_tasks(
            SourceArn=SQS_REDRIVE_DLQ_ARN,
            MaxResults=10,
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    task = next(
        (
            item for item in response.get('Results', [])
            if item.get('TaskHandle') == task_handle
        ),
        None,
    )
    if (
        task
        and task.get('DestinationArn') == SQS_REDRIVE_SOURCE_QUEUE_ARN
        and task.get('Status') in {'RUNNING', 'COMPLETED'}
        and int(task.get('ApproximateNumberOfMessagesMoved', 0)) >= 1
    ):
        return {
            'status': 'passed',
            'message': 'The managed redrive task moved the failed message back to the source queue.',
            'resource': _clean_response(task),
        }
    return {
        'status': 'failed',
        'message': 'The message move task has not yet moved the expected message.',
    }


def _sqs_fifo_queue_url() -> str:
    return _sqs_queue_url(SQS_FIFO_QUEUE_NAME)


def _verify_sqs_fifo_queue() -> dict[str, Any]:
    try:
        queue_url = _sqs_fifo_queue_url()
        response = _sqs_client().get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=['QueueArn', 'FifoQueue', 'ContentBasedDeduplication'],
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    attributes = response.get('Attributes', {})
    if (
        attributes.get('QueueArn') == SQS_FIFO_QUEUE_ARN
        and attributes.get('FifoQueue') == 'true'
        and attributes.get('ContentBasedDeduplication') == 'false'
    ):
        return {
            'status': 'passed',
            'message': 'The .fifo queue uses explicit message deduplication IDs.',
            'resource': {
                'queue_url': queue_url,
                'attributes': _clean_response(attributes),
            },
        }
    return {
        'status': 'failed',
        'message': 'The queue does not have the expected FIFO configuration.',
    }


def _sqs_receive_fifo_messages() -> dict[str, Any]:
    return _sqs_client().receive_message(
        QueueUrl=_sqs_fifo_queue_url(),
        MaxNumberOfMessages=10,
        VisibilityTimeout=0,
        WaitTimeSeconds=1,
        AttributeNames=['All'],
        MessageAttributeNames=['All'],
    )


def _verify_sqs_fifo_messages() -> dict[str, Any]:
    try:
        response = _sqs_receive_fifo_messages()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    messages = [
        message for message in response.get('Messages', [])
        if message.get('Attributes', {}).get('MessageGroupId') == SQS_FIFO_GROUP_ID
    ]
    bodies = [message.get('Body') for message in messages]
    sequence_numbers = [
        int(message.get('Attributes', {}).get('SequenceNumber', 0))
        for message in messages
    ]
    deduplication_ids = [
        message.get('Attributes', {}).get('MessageDeduplicationId')
        for message in messages
    ]
    if (
        bodies == SQS_FIFO_MESSAGE_TEXTS
        and SQS_FIFO_DUPLICATE_BODY_TEXT not in bodies
        and deduplication_ids == SQS_FIFO_DEDUPLICATION_IDS
        and sequence_numbers == sorted(sequence_numbers)
        and len(set(sequence_numbers)) == len(sequence_numbers)
    ):
        return {
            'status': 'passed',
            'message': 'The FIFO queue returned created, paid, and fulfilled in order with no duplicate.',
            'resource': {
                'messages': _clean_response(messages),
                'sequence_numbers': sequence_numbers,
            },
        }
    return {
        'status': 'failed',
        'message': 'The queue does not contain the expected three-message ordered workflow.',
    }


def _verify_sqs_fifo_message_count() -> dict[str, Any]:
    if not cache.get(SQS_FIFO_DEDUPLICATED_CACHE_KEY):
        return {
            'status': 'failed',
            'message': 'The duplicate send has not yet been verified.',
        }
    try:
        queue_url = _sqs_fifo_queue_url()
        response = _sqs_client().get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=['ApproximateNumberOfMessages'],
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    count = int(response.get('Attributes', {}).get('ApproximateNumberOfMessages', 0))
    if count == len(SQS_FIFO_MESSAGES):
        return {
            'status': 'passed',
            'message': 'Four successful send requests produced three available messages.',
            'resource': {
                'queue_url': queue_url,
                'approximate_messages': count,
            },
        }
    return {
        'status': 'failed',
        'message': f'Expected three available messages after deduplication but found {count}.',
    }


def _sqs_cleanup_queue_url() -> str:
    return _sqs_queue_url(SQS_CLEANUP_QUEUE_NAME)


def _sqs_cleanup_state() -> tuple[str, dict[str, Any], dict[str, str]]:
    queue_url = _sqs_cleanup_queue_url()
    attributes = _sqs_client().get_queue_attributes(
        QueueUrl=queue_url,
        AttributeNames=[
            'QueueArn',
            'VisibilityTimeout',
            'ApproximateNumberOfMessages',
        ],
    ).get('Attributes', {})
    tags = _sqs_client().list_queue_tags(QueueUrl=queue_url).get('Tags', {})
    return queue_url, attributes, tags


def _verify_sqs_cleanup_queue(expected_count: int) -> dict[str, Any]:
    try:
        queue_url, attributes, tags = _sqs_cleanup_state()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    count = int(attributes.get('ApproximateNumberOfMessages', 0))
    if (
        attributes.get('QueueArn') == SQS_CLEANUP_QUEUE_ARN
        and attributes.get('VisibilityTimeout') == SQS_CLEANUP_VISIBILITY_TIMEOUT
        and tags.get('Purpose') == SQS_CLEANUP_TAGS['Purpose']
        and count == expected_count
    ):
        return {
            'status': 'passed',
            'message': (
                f'The cleanup queue has {expected_count} available messages; '
                'its visibility timeout and tag are intact.'
            ),
            'resource': {
                'queue_url': queue_url,
                'attributes': _clean_response(attributes),
                'tags': tags,
            },
        }
    return {
        'status': 'failed',
        'message': (
            f'The cleanup queue does not have the expected configuration and '
            f'{expected_count} available messages.'
        ),
    }


def _verify_sqs_cleanup_deleted() -> dict[str, Any]:
    if not cache.get(SQS_CLEANUP_DELETED_CACHE_KEY):
        return {
            'status': 'failed',
            'message': 'The cleanup queue has not been deleted by this lab run.',
        }
    try:
        _sqs_cleanup_queue_url()
    except ClientError as exc:
        if _error_code(exc) in {
            'AWS.SimpleQueueService.NonExistentQueue',
            'QueueDoesNotExist',
        }:
            return {
                'status': 'passed',
                'message': f'Queue {SQS_CLEANUP_QUEUE_NAME} no longer resolves.',
            }
        return {'status': 'failed', 'message': str(exc)}
    return {
        'status': 'failed',
        'message': f'Queue {SQS_CLEANUP_QUEUE_NAME} still exists.',
    }


def _sns_fanout_queue_policy(queue_arn: str) -> dict[str, Any]:
    return {
        'Version': '2012-10-17',
        'Statement': [{
            'Sid': 'AllowOrderTopicDelivery',
            'Effect': 'Allow',
            'Principal': {'Service': 'sns.amazonaws.com'},
            'Action': 'sqs:SendMessage',
            'Resource': queue_arn,
            'Condition': {
                'ArnEquals': {'aws:SourceArn': SNS_FANOUT_TOPIC_ARN},
            },
        }],
    }


def _verify_sns_fanout_topic() -> dict[str, Any]:
    try:
        response = _sns_client().get_topic_attributes(
            TopicArn=SNS_FANOUT_TOPIC_ARN,
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    if response.get('Attributes', {}).get('TopicArn') == SNS_FANOUT_TOPIC_ARN:
        return {
            'status': 'passed',
            'message': 'The order-events SNS topic exists.',
            'resource': {'topic_arn': SNS_FANOUT_TOPIC_ARN},
        }
    return {'status': 'failed', 'message': 'The SNS topic does not exist.'}


def _verify_sns_fanout_queue(
    queue_name: str,
    queue_arn: str,
) -> dict[str, Any]:
    try:
        queue_url = _sqs_queue_url(queue_name)
        response = _sqs_client().get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=['QueueArn'],
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    if response.get('Attributes', {}).get('QueueArn') == queue_arn:
        return {
            'status': 'passed',
            'message': f'Queue {queue_name} exists with the expected ARN.',
            'resource': {'queue_url': queue_url, 'queue_arn': queue_arn},
        }
    return {'status': 'failed', 'message': f'Queue {queue_name} is not ready.'}


def _verify_sns_fanout_queue_policy(
    queue_name: str,
    queue_arn: str,
) -> dict[str, Any]:
    try:
        queue_url = _sqs_queue_url(queue_name)
        response = _sqs_client().get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=['Policy'],
        )
        policy_text = response.get('Attributes', {}).get('Policy', '')
        policy = json.loads(policy_text) if policy_text else {}
    except (ClientError, json.JSONDecodeError) as exc:
        return {'status': 'failed', 'message': str(exc)}
    if policy == _sns_fanout_queue_policy(queue_arn):
        return {
            'status': 'passed',
            'message': f'Queue {queue_name} authorizes only the lab SNS topic.',
            'resource': {'queue_url': queue_url, 'policy': policy},
        }
    return {
        'status': 'failed',
        'message': f'Queue {queue_name} does not have the expected SNS policy.',
    }


def _sns_fanout_subscriptions() -> list[dict[str, Any]]:
    return _sns_client().list_subscriptions_by_topic(
        TopicArn=SNS_FANOUT_TOPIC_ARN,
    ).get('Subscriptions', [])


def _verify_sns_fanout_subscription(queue_arn: str) -> dict[str, Any]:
    try:
        subscription = next(
            (
                item for item in _sns_fanout_subscriptions()
                if item.get('Protocol') == 'sqs'
                and item.get('Endpoint') == queue_arn
                and item.get('SubscriptionArn') not in {None, 'PendingConfirmation'}
            ),
            None,
        )
        attributes = (
            _sns_client().get_subscription_attributes(
                SubscriptionArn=subscription['SubscriptionArn'],
            ).get('Attributes', {})
            if subscription
            else {}
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    if subscription and attributes.get('RawMessageDelivery') == 'true':
        return {
            'status': 'passed',
            'message': 'The SQS endpoint is confirmed with raw message delivery.',
            'resource': {
                'subscription': _clean_response(subscription),
                'attributes': _clean_response(attributes),
            },
        }
    return {
        'status': 'failed',
        'message': 'The expected raw-delivery SQS subscription is not confirmed.',
    }


def _sns_fanout_message(
    messages: list[dict[str, Any]],
) -> dict[str, Any] | None:
    return next(
        (
            message for message in messages
            if message.get('Body') == SNS_FANOUT_MESSAGE_TEXT
            and message.get('MessageAttributes', {}).get('EventType', {}).get(
                'StringValue'
            ) == 'order.created'
            and message.get('MessageAttributes', {}).get('Environment', {}).get(
                'StringValue'
            ) == 'lab'
        ),
        None,
    )


def _verify_sns_fanout_delivery(queue_name: str) -> dict[str, Any]:
    try:
        response = _sqs_client().receive_message(
            QueueUrl=_sqs_queue_url(queue_name),
            MaxNumberOfMessages=10,
            VisibilityTimeout=0,
            WaitTimeSeconds=1,
            MessageAttributeNames=['All'],
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    message = _sns_fanout_message(response.get('Messages', []))
    if message:
        return {
            'status': 'passed',
            'message': f'Queue {queue_name} contains the raw order.created event.',
            'resource': _clean_response(message),
        }
    return {
        'status': 'failed',
        'message': f'Queue {queue_name} does not contain the expected event.',
    }


def _sns_filter_queue_policy(queue_arn: str) -> dict[str, Any]:
    return {
        'Version': '2012-10-17',
        'Statement': [{
            'Sid': 'AllowFilteredTopicDelivery',
            'Effect': 'Allow',
            'Principal': {'Service': 'sns.amazonaws.com'},
            'Action': 'sqs:SendMessage',
            'Resource': queue_arn,
            'Condition': {
                'ArnEquals': {'aws:SourceArn': SNS_FILTER_TOPIC_ARN},
            },
        }],
    }


def _verify_sns_filter_topic() -> dict[str, Any]:
    try:
        response = _sns_client().get_topic_attributes(
            TopicArn=SNS_FILTER_TOPIC_ARN,
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    if response.get('Attributes', {}).get('TopicArn') == SNS_FILTER_TOPIC_ARN:
        return {
            'status': 'passed',
            'message': 'The filtered-events SNS topic exists.',
            'resource': {'topic_arn': SNS_FILTER_TOPIC_ARN},
        }
    return {'status': 'failed', 'message': 'The filtered-events topic is missing.'}


def _verify_sns_filter_queue(
    queue_name: str,
    queue_arn: str,
) -> dict[str, Any]:
    return _verify_sns_fanout_queue(queue_name, queue_arn)


def _verify_sns_filter_queue_policy(
    queue_name: str,
    queue_arn: str,
) -> dict[str, Any]:
    try:
        queue_url = _sqs_queue_url(queue_name)
        response = _sqs_client().get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=['Policy'],
        )
        policy_text = response.get('Attributes', {}).get('Policy', '')
        policy = json.loads(policy_text) if policy_text else {}
    except (ClientError, json.JSONDecodeError) as exc:
        return {'status': 'failed', 'message': str(exc)}
    if policy == _sns_filter_queue_policy(queue_arn):
        return {
            'status': 'passed',
            'message': f'Queue {queue_name} authorizes only the filtered-events topic.',
            'resource': {'queue_url': queue_url, 'policy': policy},
        }
    return {'status': 'failed', 'message': f'Queue policy for {queue_name} is incorrect.'}


def _sns_filter_subscriptions() -> list[dict[str, Any]]:
    return _sns_client().list_subscriptions_by_topic(
        TopicArn=SNS_FILTER_TOPIC_ARN,
    ).get('Subscriptions', [])


def _verify_sns_filter_subscription(
    queue_arn: str,
    filter_policy: dict[str, Any],
) -> dict[str, Any]:
    try:
        subscription = next(
            (
                item for item in _sns_filter_subscriptions()
                if item.get('Protocol') == 'sqs'
                and item.get('Endpoint') == queue_arn
                and item.get('SubscriptionArn') not in {None, 'PendingConfirmation'}
            ),
            None,
        )
        attributes = (
            _sns_client().get_subscription_attributes(
                SubscriptionArn=subscription['SubscriptionArn'],
            ).get('Attributes', {})
            if subscription
            else {}
        )
        stored_filter = json.loads(attributes.get('FilterPolicy', '{}'))
    except (ClientError, json.JSONDecodeError) as exc:
        return {'status': 'failed', 'message': str(exc)}
    if (
        subscription
        and attributes.get('RawMessageDelivery') == 'true'
        and attributes.get('FilterPolicyScope') == 'MessageAttributes'
        and stored_filter == filter_policy
    ):
        return {
            'status': 'passed',
            'message': 'The confirmed subscription has the expected message-attribute filter.',
            'resource': {
                'subscription': _clean_response(subscription),
                'attributes': _clean_response(attributes),
            },
        }
    return {'status': 'failed', 'message': 'The expected subscription filter is not active.'}


def _verify_sns_filter_route(
    queue_name: str,
    expected_body: str,
    excluded_body: str,
) -> dict[str, Any]:
    try:
        response = _sqs_client().receive_message(
            QueueUrl=_sqs_queue_url(queue_name),
            MaxNumberOfMessages=10,
            VisibilityTimeout=0,
            WaitTimeSeconds=1,
            MessageAttributeNames=['All'],
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    messages = response.get('Messages', [])
    bodies = [message.get('Body') for message in messages]
    if len(messages) == 1 and bodies == [expected_body] and excluded_body not in bodies:
        return {
            'status': 'passed',
            'message': f'Queue {queue_name} contains only its matching event.',
            'resource': {'messages': _clean_response(messages)},
        }
    return {
        'status': 'failed',
        'message': f'Queue {queue_name} does not contain exactly its matching event.',
    }


def _verify_scheduler_queue() -> dict[str, Any]:
    try:
        queue_url = _sqs_queue_url(SCHEDULER_SQS_QUEUE_NAME)
        response = _sqs_client().get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=['QueueArn'],
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    if response.get('Attributes', {}).get('QueueArn') == SCHEDULER_SQS_QUEUE_ARN:
        return {
            'status': 'passed',
            'message': 'The scheduled-reports target queue exists.',
            'resource': {
                'queue_url': queue_url,
                'queue_arn': SCHEDULER_SQS_QUEUE_ARN,
            },
        }
    return {'status': 'failed', 'message': 'The target queue is not ready.'}


def _verify_scheduler_role() -> dict[str, Any]:
    try:
        response = _iam_client().get_role(RoleName=SCHEDULER_ROLE_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    role = response.get('Role', {})
    if (
        role.get('Arn') == SCHEDULER_ROLE_ARN
        and role.get('AssumeRolePolicyDocument') == SCHEDULER_TRUST_POLICY
    ):
        return {
            'status': 'passed',
            'message': 'The execution role trusts only EventBridge Scheduler.',
            'resource': _clean_response(role),
        }
    return {'status': 'failed', 'message': 'The Scheduler role trust policy is incorrect.'}


def _verify_scheduler_role_policy() -> dict[str, Any]:
    try:
        response = _iam_client().get_role_policy(
            RoleName=SCHEDULER_ROLE_NAME,
            PolicyName=SCHEDULER_ROLE_POLICY_NAME,
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    if response.get('PolicyDocument') == SCHEDULER_ROLE_POLICY:
        return {
            'status': 'passed',
            'message': 'The execution role can send messages only to the lab queue.',
            'resource': _clean_response(response),
        }
    return {'status': 'failed', 'message': 'The execution role policy is incorrect.'}


def _verify_scheduler_group() -> dict[str, Any]:
    try:
        response = _scheduler_client().get_schedule_group(
            Name=SCHEDULER_GROUP_NAME,
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    if response.get('Arn') == SCHEDULER_GROUP_ARN:
        return {
            'status': 'passed',
            'message': 'The dedicated schedule group exists.',
            'resource': _clean_response(response),
        }
    return {'status': 'failed', 'message': 'The schedule group does not exist.'}


def _verify_scheduler_schedule() -> dict[str, Any]:
    expression = cache.get(SCHEDULER_EXPRESSION_CACHE_KEY)
    if not expression:
        return {
            'status': 'failed',
            'message': 'The lab has not created its one-time schedule.',
        }
    try:
        response = _scheduler_client().get_schedule(
            Name=SCHEDULER_SCHEDULE_NAME,
            GroupName=SCHEDULER_GROUP_NAME,
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    target = response.get('Target', {})
    if (
        response.get('Arn') == SCHEDULER_SCHEDULE_ARN
        and response.get('ScheduleExpression') == expression
        and response.get('FlexibleTimeWindow') == {'Mode': 'OFF'}
        and response.get('ActionAfterCompletion') == 'DELETE'
        and response.get('State') == 'ENABLED'
        and target.get('Arn') == SCHEDULER_SQS_QUEUE_ARN
        and target.get('RoleArn') == SCHEDULER_ROLE_ARN
        and target.get('Input') == SCHEDULER_MESSAGE_TEXT
        and target.get('RetryPolicy') == {
            'MaximumEventAgeInSeconds': 60,
            'MaximumRetryAttempts': 1,
        }
    ):
        return {
            'status': 'passed',
            'message': 'The pending one-time schedule has the expected target and execution settings.',
            'resource': _clean_response(response),
        }
    return {'status': 'failed', 'message': 'The schedule configuration is incomplete.'}


def _scheduler_message(
    messages: list[dict[str, Any]],
) -> dict[str, Any] | None:
    return next(
        (
            message for message in messages
            if message.get('Body') == SCHEDULER_MESSAGE_TEXT
        ),
        None,
    )


def _verify_scheduler_delivery() -> dict[str, Any]:
    try:
        response = _sqs_client().receive_message(
            QueueUrl=_sqs_queue_url(SCHEDULER_SQS_QUEUE_NAME),
            MaxNumberOfMessages=10,
            VisibilityTimeout=0,
            WaitTimeSeconds=1,
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    message = _scheduler_message(response.get('Messages', []))
    if message:
        return {
            'status': 'passed',
            'message': 'The target queue contains the scheduled report.ready event.',
            'resource': _clean_response(message),
        }
    return {'status': 'failed', 'message': 'The scheduled event is not available.'}


def _verify_scheduler_deleted() -> dict[str, Any]:
    if not cache.get(SCHEDULER_DELETED_CACHE_KEY):
        return {
            'status': 'failed',
            'message': 'Automatic schedule deletion has not been verified.',
        }
    try:
        _scheduler_client().get_schedule(
            Name=SCHEDULER_SCHEDULE_NAME,
            GroupName=SCHEDULER_GROUP_NAME,
        )
    except ClientError as exc:
        if _error_code(exc) == 'ResourceNotFoundException':
            return {
                'status': 'passed',
                'message': 'The completed one-time schedule was deleted automatically.',
            }
        return {'status': 'failed', 'message': str(exc)}
    return {'status': 'failed', 'message': 'The completed schedule still exists.'}


def _cloudformation_stack() -> dict[str, Any]:
    return _cloudformation_client().describe_stacks(
        StackName=CLOUDFORMATION_STACK_NAME,
    )['Stacks'][0]


def _wait_for_cloudformation_status(
    terminal_statuses: set[str],
    timeout_seconds: float = 10,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        stack = _cloudformation_stack()
        if stack.get('StackStatus') in terminal_statuses:
            return stack
        time.sleep(0.1)
    raise ValueError(
        f'Stack {CLOUDFORMATION_STACK_NAME} did not reach '
        f'{", ".join(sorted(terminal_statuses))}.'
    )


def _verify_cloudformation_stack() -> dict[str, Any]:
    try:
        stack = _cloudformation_stack()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    outputs = {
        item.get('OutputKey'): item.get('OutputValue')
        for item in stack.get('Outputs', [])
    }
    queue_url = outputs.get('QueueUrl', '')
    if (
        stack.get('StackStatus') == 'CREATE_COMPLETE'
        and outputs.get('BucketName') == CLOUDFORMATION_BUCKET_NAME
        and queue_url.rstrip('/').endswith(f'/{CLOUDFORMATION_QUEUE_NAME}')
        and outputs.get('QueueArn') == CLOUDFORMATION_QUEUE_ARN
    ):
        return {
            'status': 'passed',
            'message': 'The stack is CREATE_COMPLETE with all expected outputs.',
            'resource': {
                'stack': _clean_response(stack),
                'outputs': outputs,
            },
        }
    return {'status': 'failed', 'message': 'The stack outputs are incomplete.'}


def _verify_cloudformation_resources() -> dict[str, Any]:
    try:
        response = _cloudformation_client().describe_stack_resources(
            StackName=CLOUDFORMATION_STACK_NAME,
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    resources = {
        item.get('LogicalResourceId'): item
        for item in response.get('StackResources', [])
    }
    bucket = resources.get('StorageBucket', {})
    queue = resources.get('JobsQueue', {})
    if (
        bucket.get('PhysicalResourceId') == CLOUDFORMATION_BUCKET_NAME
        and bucket.get('ResourceType') == 'AWS::S3::Bucket'
        and bucket.get('ResourceStatus') == 'CREATE_COMPLETE'
        and queue.get('PhysicalResourceId', '').rstrip('/').endswith(
            f'/{CLOUDFORMATION_QUEUE_NAME}'
        )
        and queue.get('ResourceType') == 'AWS::SQS::Queue'
        and queue.get('ResourceStatus') == 'CREATE_COMPLETE'
    ):
        return {
            'status': 'passed',
            'message': 'Both logical resources map to CREATE_COMPLETE physical resources.',
            'resource': {'resources': _clean_response(list(resources.values()))},
        }
    return {'status': 'failed', 'message': 'The stack resource mapping is incomplete.'}


def _verify_cloudformation_events() -> dict[str, Any]:
    try:
        response = _cloudformation_client().describe_stack_events(
            StackName=CLOUDFORMATION_STACK_NAME,
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    events = response.get('StackEvents', [])
    completed = {
        (item.get('LogicalResourceId'), item.get('ResourceStatus'))
        for item in events
    }
    required = {
        (CLOUDFORMATION_STACK_NAME, 'CREATE_COMPLETE'),
        ('StorageBucket', 'CREATE_COMPLETE'),
        ('JobsQueue', 'CREATE_COMPLETE'),
    }
    if required.issubset(completed):
        return {
            'status': 'passed',
            'message': 'The event timeline records successful creation of the stack and both resources.',
            'resource': {'events': _clean_response(events)},
        }
    return {'status': 'failed', 'message': 'The expected creation events are missing.'}


def _verify_cloudformation_service_resources() -> dict[str, Any]:
    try:
        _s3_client().head_bucket(Bucket=CLOUDFORMATION_BUCKET_NAME)
        queue_url = _sqs_queue_url(CLOUDFORMATION_QUEUE_NAME)
        queue_attributes = _sqs_client().get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=['QueueArn', 'VisibilityTimeout'],
        ).get('Attributes', {})
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    if (
        queue_attributes.get('QueueArn') == CLOUDFORMATION_QUEUE_ARN
        and queue_attributes.get('VisibilityTimeout') == '30'
    ):
        return {
            'status': 'passed',
            'message': 'S3 and SQS expose the stack-managed resources and expected configuration.',
            'resource': {
                'bucket': CLOUDFORMATION_BUCKET_NAME,
                'queue_url': queue_url,
                'queue_attributes': queue_attributes,
            },
        }
    return {'status': 'failed', 'message': 'The provisioned resource configuration is incorrect.'}


def _verify_cloudformation_deleted() -> dict[str, Any]:
    if not cache.get(CLOUDFORMATION_DELETED_CACHE_KEY):
        return {
            'status': 'failed',
            'message': 'Stack deletion has not been verified by this lab run.',
        }
    stack_absent = False
    bucket_absent = False
    queue_absent = False
    try:
        _cloudformation_stack()
    except ClientError:
        stack_absent = True
    try:
        _s3_client().head_bucket(Bucket=CLOUDFORMATION_BUCKET_NAME)
    except ClientError:
        bucket_absent = True
    try:
        _sqs_queue_url(CLOUDFORMATION_QUEUE_NAME)
    except ClientError as exc:
        queue_absent = _error_code(exc) in {
            'AWS.SimpleQueueService.NonExistentQueue',
            'QueueDoesNotExist',
        }
    if stack_absent and bucket_absent and queue_absent:
        return {
            'status': 'passed',
            'message': 'The stack, bucket, and queue are all absent.',
        }
    return {'status': 'failed', 'message': 'One or more stack-owned resources still exist.'}


def _ec2_lab_vpc() -> dict[str, Any] | None:
    response = _ec2_client().describe_vpcs(
        Filters=[
            {'Name': 'cidr-block', 'Values': [EC2_VPC_CIDR]},
            {'Name': 'tag:Lab', 'Values': ['vpc-public-private']},
        ],
    )
    return next(iter(response.get('Vpcs', [])), None)


def _ec2_lab_subnets(vpc_id: str) -> dict[str, dict[str, Any]]:
    response = _ec2_client().describe_subnets(
        Filters=[{'Name': 'vpc-id', 'Values': [vpc_id]}],
    )
    return {
        subnet.get('CidrBlock'): subnet
        for subnet in response.get('Subnets', [])
    }


def _ec2_lab_igw(vpc_id: str) -> dict[str, Any] | None:
    response = _ec2_client().describe_internet_gateways(
        Filters=[{'Name': 'attachment.vpc-id', 'Values': [vpc_id]}],
    )
    return next(iter(response.get('InternetGateways', [])), None)


def _ec2_lab_route_tables(vpc_id: str) -> list[dict[str, Any]]:
    return _ec2_client().describe_route_tables(
        Filters=[{'Name': 'vpc-id', 'Values': [vpc_id]}],
    ).get('RouteTables', [])


def _verify_ec2_vpc() -> dict[str, Any]:
    try:
        vpc = _ec2_lab_vpc()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    if vpc and vpc.get('State') == 'available':
        cache.set(EC2_VPC_ID_CACHE_KEY, vpc['VpcId'], timeout=86400)
        return {
            'status': 'passed',
            'message': f'The VPC owns the {EC2_VPC_CIDR} address space.',
            'resource': _clean_response(vpc),
        }
    return {'status': 'failed', 'message': 'The lab VPC does not exist.'}


def _verify_ec2_subnets() -> tuple[dict[str, Any], dict[str, Any]]:
    vpc = _ec2_lab_vpc()
    if not vpc:
        failed = {'status': 'failed', 'message': 'Create the VPC first.'}
        return failed, failed
    subnets = _ec2_lab_subnets(vpc['VpcId'])
    public = subnets.get(EC2_PUBLIC_SUBNET_CIDR)
    private = subnets.get(EC2_PRIVATE_SUBNET_CIDR)
    public_verification = (
        {
            'status': 'passed',
            'message': 'The public subnet uses the expected CIDR, AZ, and public-IP setting.',
            'resource': _clean_response(public),
        }
        if public
        and public.get('AvailabilityZone') == EC2_PUBLIC_AZ
        and public.get('MapPublicIpOnLaunch') is True
        else {'status': 'failed', 'message': 'The public subnet is incomplete.'}
    )
    private_verification = (
        {
            'status': 'passed',
            'message': 'The private subnet uses the expected CIDR and has no automatic public IPs.',
            'resource': _clean_response(private),
        }
        if private
        and private.get('AvailabilityZone') == EC2_PRIVATE_AZ
        and private.get('MapPublicIpOnLaunch') is False
        else {'status': 'failed', 'message': 'The private subnet is incomplete.'}
    )
    if public:
        cache.set(EC2_PUBLIC_SUBNET_ID_CACHE_KEY, public['SubnetId'], timeout=86400)
    if private:
        cache.set(EC2_PRIVATE_SUBNET_ID_CACHE_KEY, private['SubnetId'], timeout=86400)
    return public_verification, private_verification


def _verify_ec2_igw() -> dict[str, Any]:
    vpc = _ec2_lab_vpc()
    if not vpc:
        return {'status': 'failed', 'message': 'Create the VPC first.'}
    igw = _ec2_lab_igw(vpc['VpcId'])
    if igw:
        cache.set(EC2_IGW_ID_CACHE_KEY, igw['InternetGatewayId'], timeout=86400)
        return {
            'status': 'passed',
            'message': 'The internet gateway is attached to the lab VPC.',
            'resource': _clean_response(igw),
        }
    return {'status': 'failed', 'message': 'No internet gateway is attached.'}


def _verify_ec2_routes() -> tuple[dict[str, Any], dict[str, Any]]:
    vpc = _ec2_lab_vpc()
    if not vpc:
        failed = {'status': 'failed', 'message': 'Create the VPC first.'}
        return failed, failed
    subnets = _ec2_lab_subnets(vpc['VpcId'])
    public_subnet = subnets.get(EC2_PUBLIC_SUBNET_CIDR, {})
    private_subnet = subnets.get(EC2_PRIVATE_SUBNET_CIDR, {})
    igw = _ec2_lab_igw(vpc['VpcId']) or {}
    route_tables = _ec2_lab_route_tables(vpc['VpcId'])

    def associated_table(subnet_id: str | None):
        return next(
            (
                table for table in route_tables
                if any(
                    association.get('SubnetId') == subnet_id
                    for association in table.get('Associations', [])
                )
            ),
            None,
        )

    public_table = associated_table(public_subnet.get('SubnetId'))
    private_table = associated_table(private_subnet.get('SubnetId'))
    public_default = next(
        (
            route for route in (public_table or {}).get('Routes', [])
            if route.get('DestinationCidrBlock') == '0.0.0.0/0'
        ),
        None,
    )
    private_default = next(
        (
            route for route in (private_table or {}).get('Routes', [])
            if route.get('DestinationCidrBlock') == '0.0.0.0/0'
        ),
        None,
    )
    public_verification = (
        {
            'status': 'passed',
            'message': 'The public subnet route table sends 0.0.0.0/0 to the internet gateway.',
            'resource': _clean_response(public_table),
        }
        if public_table
        and public_default
        and public_default.get('GatewayId') == igw.get('InternetGatewayId')
        else {'status': 'failed', 'message': 'The public route is incomplete.'}
    )
    private_verification = (
        {
            'status': 'passed',
            'message': 'The private subnet has an associated route table with no internet default route.',
            'resource': _clean_response(private_table),
        }
        if private_table and not private_default
        else {'status': 'failed', 'message': 'The private route table is incomplete.'}
    )
    if public_table:
        cache.set(EC2_PUBLIC_RT_ID_CACHE_KEY, public_table['RouteTableId'], timeout=86400)
    if private_table:
        cache.set(EC2_PRIVATE_RT_ID_CACHE_KEY, private_table['RouteTableId'], timeout=86400)
    return public_verification, private_verification


def _ec2_cached_id(cache_key: str, label: str) -> str:
    value = cache.get(cache_key)
    if not value:
        raise ValueError(f'{label} is not available; run the prerequisite step.')
    return value


def _ec2_security_vpc() -> dict[str, Any] | None:
    response = _ec2_client().describe_vpcs(
        Filters=[
            {'Name': 'cidr-block', 'Values': [EC2_SECURITY_VPC_CIDR]},
            {'Name': 'tag:Lab', 'Values': ['security-controls']},
        ],
    )
    return next(iter(response.get('Vpcs', [])), None)


def _ec2_security_groups(vpc_id: str) -> dict[str, dict[str, Any]]:
    response = _ec2_client().describe_security_groups(
        Filters=[{'Name': 'vpc-id', 'Values': [vpc_id]}],
    )
    return {
        group.get('GroupName'): group
        for group in response.get('SecurityGroups', [])
    }


def _verify_ec2_security_vpc() -> dict[str, Any]:
    try:
        vpc = _ec2_security_vpc()
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    if vpc:
        cache.set(EC2_SECURITY_VPC_ID_CACHE_KEY, vpc['VpcId'], timeout=86400)
        return {
            'status': 'passed',
            'message': 'The dedicated security-controls VPC exists.',
            'resource': _clean_response(vpc),
        }
    return {'status': 'failed', 'message': 'The security-controls VPC is missing.'}


def _verify_ec2_security_subnet() -> dict[str, Any]:
    vpc = _ec2_security_vpc()
    if not vpc:
        return {'status': 'failed', 'message': 'Create the VPC first.'}
    response = _ec2_client().describe_subnets(
        Filters=[
            {'Name': 'vpc-id', 'Values': [vpc['VpcId']]},
            {'Name': 'cidr-block', 'Values': [EC2_SECURITY_SUBNET_CIDR]},
        ],
    )
    subnet = next(iter(response.get('Subnets', [])), None)
    if subnet and subnet.get('AvailabilityZone') == EC2_SECURITY_AZ:
        cache.set(
            EC2_SECURITY_SUBNET_ID_CACHE_KEY,
            subnet['SubnetId'],
            timeout=86400,
        )
        return {
            'status': 'passed',
            'message': 'The application subnet exists in the expected AZ.',
            'resource': _clean_response(subnet),
        }
    return {'status': 'failed', 'message': 'The application subnet is missing.'}


def _verify_ec2_security_group_rules() -> tuple[dict[str, Any], dict[str, Any]]:
    vpc = _ec2_security_vpc()
    if not vpc:
        failed = {'status': 'failed', 'message': 'Create the VPC first.'}
        return failed, failed
    groups = _ec2_security_groups(vpc['VpcId'])
    web = groups.get(EC2_WEB_SG_NAME)
    app = groups.get(EC2_APP_SG_NAME)
    if web:
        cache.set(EC2_WEB_SG_ID_CACHE_KEY, web['GroupId'], timeout=86400)
    if app:
        cache.set(EC2_APP_SG_ID_CACHE_KEY, app['GroupId'], timeout=86400)
    web_rule = next(
        (
            permission for permission in (web or {}).get('IpPermissions', [])
            if permission.get('IpProtocol') == 'tcp'
            and permission.get('FromPort') == 443
            and permission.get('ToPort') == 443
            and any(
                item.get('CidrIp') == EC2_TRUSTED_CLIENT_CIDR
                for item in permission.get('IpRanges', [])
            )
        ),
        None,
    )
    app_rule = next(
        (
            permission for permission in (app or {}).get('IpPermissions', [])
            if permission.get('IpProtocol') == 'tcp'
            and permission.get('FromPort') == 8080
            and permission.get('ToPort') == 8080
        ),
        None,
    )
    app_reference_verified = bool(cache.get(EC2_SG_REFERENCE_CACHE_KEY))
    web_egress = any(
        permission.get('IpProtocol') == '-1'
        for permission in (web or {}).get('IpPermissionsEgress', [])
    )
    app_egress = any(
        permission.get('IpProtocol') == '-1'
        for permission in (app or {}).get('IpPermissionsEgress', [])
    )
    web_verification = (
        {
            'status': 'passed',
            'message': 'The web group allows trusted HTTPS and keeps default stateful egress.',
            'resource': _clean_response(web),
        }
        if web and web_rule and web_egress
        else {'status': 'failed', 'message': 'The web security group is incomplete.'}
    )
    app_verification = (
        {
            'status': 'passed',
            'message': 'The app group allows port 8080 only from the web security group.',
            'resource': _clean_response(app),
        }
        if app and app_rule and app_egress and app_reference_verified
        else {'status': 'failed', 'message': 'The app security group is incomplete.'}
    )
    return web_verification, app_verification


def _verify_ec2_nacl_boundary() -> dict[str, Any]:
    if cache.get(EC2_NACL_BOUNDARY_CACHE_KEY):
        return {
            'status': 'passed',
            'message': 'Floci reported UnsupportedOperation for network ACL APIs as documented.',
            'resource': {'intended_rules': EC2_NACL_DESIGN},
        }
    return {
        'status': 'failed',
        'message': 'The network ACL support boundary has not been checked.',
    }


def _ec2_endpoint_vpc() -> dict[str, Any] | None:
    response = _ec2_client().describe_vpcs(Filters=[
        {'Name': 'cidr-block', 'Values': [EC2_ENDPOINT_VPC_CIDR]},
        {'Name': 'tag:Lab', 'Values': ['s3-gateway-endpoint']},
    ])
    return next(iter(response.get('Vpcs', [])), None)


def _verify_ec2_endpoint_vpc() -> dict[str, Any]:
    vpc = _ec2_endpoint_vpc()
    if not vpc:
        return {'status': 'failed', 'message': 'The endpoint VPC is missing.'}
    cache.set(EC2_ENDPOINT_VPC_ID_CACHE_KEY, vpc['VpcId'], timeout=86400)
    return {
        'status': 'passed',
        'message': 'The isolated endpoint VPC exists.',
        'resource': _clean_response(vpc),
    }


def _verify_ec2_endpoint_subnet() -> dict[str, Any]:
    vpc = _ec2_endpoint_vpc()
    if not vpc:
        return {'status': 'failed', 'message': 'Create the VPC first.'}
    response = _ec2_client().describe_subnets(Filters=[
        {'Name': 'vpc-id', 'Values': [vpc['VpcId']]},
        {'Name': 'cidr-block', 'Values': [EC2_ENDPOINT_SUBNET_CIDR]},
    ])
    subnet = next(iter(response.get('Subnets', [])), None)
    verified = (
        subnet
        and subnet.get('AvailabilityZone') == EC2_ENDPOINT_AZ
        and subnet.get('MapPublicIpOnLaunch') is False
    )
    if verified:
        cache.set(EC2_ENDPOINT_SUBNET_ID_CACHE_KEY, subnet['SubnetId'], timeout=86400)
    return {
        'status': 'passed' if verified else 'failed',
        'message': (
            'The private subnet has no automatic public IPs.'
            if verified else 'The private subnet is incomplete.'
        ),
        'resource': _clean_response(subnet or {}),
    }


def _verify_ec2_endpoint_route_table() -> dict[str, Any]:
    vpc = _ec2_endpoint_vpc()
    subnet_id = cache.get(EC2_ENDPOINT_SUBNET_ID_CACHE_KEY)
    if not vpc or not subnet_id:
        return {'status': 'failed', 'message': 'Create the subnet first.'}
    tables = _ec2_lab_route_tables(vpc['VpcId'])
    table = next((
        item for item in tables
        if any(
            association.get('SubnetId') == subnet_id
            for association in item.get('Associations', [])
        )
    ), None)
    has_public_default = any(
        route.get('DestinationCidrBlock') == '0.0.0.0/0'
        for route in (table or {}).get('Routes', [])
    )
    verified = bool(table and not has_public_default)
    if table:
        cache.set(EC2_ENDPOINT_RT_ID_CACHE_KEY, table['RouteTableId'], timeout=86400)
    return {
        'status': 'passed' if verified else 'failed',
        'message': (
            'The subnet uses a private route table with no internet default route.'
            if verified else 'The private route-table association is incomplete.'
        ),
        'resource': _clean_response(table or {}),
    }


def _verify_ec2_endpoint_bucket() -> dict[str, Any]:
    try:
        response = _s3_client().head_bucket(Bucket=EC2_ENDPOINT_BUCKET_NAME)
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    return {
        'status': 'passed',
        'message': 'The endpoint-policy bucket exists.',
        'resource': _clean_response(response),
    }


def _ec2_s3_gateway_endpoint() -> dict[str, Any] | None:
    vpc = _ec2_endpoint_vpc()
    if not vpc:
        return None
    service_name = f'com.amazonaws.{_ec2_client().meta.region_name}.s3'
    response = _ec2_client().describe_vpc_endpoints()
    return next((
        endpoint
        for endpoint in response.get('VpcEndpoints', [])
        if endpoint.get('VpcId') == vpc['VpcId']
        and endpoint.get('ServiceName') == service_name
    ), None)


def _verify_ec2_s3_gateway_endpoint() -> dict[str, Any]:
    endpoint = _ec2_s3_gateway_endpoint()
    configured = bool(cache.get(EC2_ENDPOINT_CONFIGURED_CACHE_KEY))
    verified = (
        endpoint
        and endpoint.get('VpcEndpointType') == 'Gateway'
        and endpoint.get('State') == 'available'
        and configured
    )
    if endpoint:
        cache.set(EC2_ENDPOINT_ID_CACHE_KEY, endpoint['VpcEndpointId'], timeout=86400)
    return {
        'status': 'passed' if verified else 'failed',
        'message': (
            'The available S3 gateway endpoint was requested with the private route table and bucket-scoped policy.'
            if verified else 'The S3 gateway endpoint is incomplete.'
        ),
        'resource': _clean_response(endpoint or {}),
    }


def _verify_ec2_endpoint_route_boundary() -> dict[str, Any]:
    if not cache.get(EC2_ENDPOINT_ROUTE_BOUNDARY_CACHE_KEY):
        return {
            'status': 'failed',
            'message': 'Inspect the route table after creating the endpoint.',
        }
    return {
        'status': 'passed',
        'message': 'Floci did not persist the gateway endpoint route-table ID or inject the managed S3 prefix-list route; AWS does both.',
    }

def _ec2_interface_vpc() -> dict[str, Any] | None:
    response = _ec2_client().describe_vpcs(Filters=[
        {'Name': 'cidr-block', 'Values': [EC2_INTERFACE_VPC_CIDR]},
        {'Name': 'tag:Lab', 'Values': ['sqs-interface-endpoint']},
    ])
    return next(iter(response.get('Vpcs', [])), None)


def _verify_ec2_interface_vpc() -> dict[str, Any]:
    vpc = _ec2_interface_vpc()
    if not vpc:
        return {'status': 'failed', 'message': 'The interface endpoint VPC is missing.'}
    cache.set(EC2_INTERFACE_VPC_ID_CACHE_KEY, vpc['VpcId'], timeout=86400)
    return {
        'status': 'passed',
        'message': 'The isolated interface endpoint VPC exists.',
        'resource': _clean_response(vpc),
    }


def _verify_ec2_interface_subnet() -> dict[str, Any]:
    vpc = _ec2_interface_vpc()
    if not vpc:
        return {'status': 'failed', 'message': 'Create the VPC first.'}
    response = _ec2_client().describe_subnets(Filters=[
        {'Name': 'vpc-id', 'Values': [vpc['VpcId']]},
        {'Name': 'cidr-block', 'Values': [EC2_INTERFACE_SUBNET_CIDR]},
    ])
    subnet = next(iter(response.get('Subnets', [])), None)
    verified = (
        subnet
        and subnet.get('AvailabilityZone') == EC2_INTERFACE_AZ
        and subnet.get('MapPublicIpOnLaunch') is False
    )
    if verified:
        cache.set(EC2_INTERFACE_SUBNET_ID_CACHE_KEY, subnet['SubnetId'], timeout=86400)
    return {
        'status': 'passed' if verified else 'failed',
        'message': (
            'The endpoint subnet has no automatic public IPs.'
            if verified else 'The endpoint subnet is incomplete.'
        ),
        'resource': _clean_response(subnet or {}),
    }


def _verify_ec2_interface_security_group() -> dict[str, Any]:
    vpc = _ec2_interface_vpc()
    if not vpc:
        return {'status': 'failed', 'message': 'Create the VPC first.'}
    response = _ec2_client().describe_security_groups(Filters=[
        {'Name': 'vpc-id', 'Values': [vpc['VpcId']]},
        {'Name': 'group-name', 'Values': [EC2_INTERFACE_SG_NAME]},
    ])
    group = next(iter(response.get('SecurityGroups', [])), None)
    https_rule = next((
        permission
        for permission in (group or {}).get('IpPermissions', [])
        if permission.get('IpProtocol') == 'tcp'
        and permission.get('FromPort') == 443
        and permission.get('ToPort') == 443
        and any(
            item.get('CidrIp') == EC2_INTERFACE_VPC_CIDR
            for item in permission.get('IpRanges', [])
        )
    ), None)
    verified = bool(group and https_rule)
    if group:
        cache.set(EC2_INTERFACE_SG_ID_CACHE_KEY, group['GroupId'], timeout=86400)
    return {
        'status': 'passed' if verified else 'failed',
        'message': (
            'The endpoint security group allows TCP 443 only from the lab VPC.'
            if verified else 'The endpoint security group is incomplete.'
        ),
        'resource': _clean_response(group or {}),
    }


def _verify_ec2_interface_queue() -> dict[str, Any]:
    try:
        queue_url = _sqs_queue_url(EC2_INTERFACE_QUEUE_NAME)
        response = _sqs_client().get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=['QueueArn'],
        )
    except ClientError as exc:
        return {'status': 'failed', 'message': str(exc)}
    verified = response.get('Attributes', {}).get('QueueArn') == EC2_INTERFACE_QUEUE_ARN
    return {
        'status': 'passed' if verified else 'failed',
        'message': (
            'The queue protected by the endpoint policy exists.'
            if verified else 'The private SQS queue is incomplete.'
        ),
        'resource': _clean_response(response),
    }


def _ec2_sqs_interface_endpoint() -> dict[str, Any] | None:
    vpc = _ec2_interface_vpc()
    if not vpc:
        return None
    service_name = f'com.amazonaws.{_ec2_client().meta.region_name}.sqs'
    response = _ec2_client().describe_vpc_endpoints()
    return next((
        endpoint
        for endpoint in response.get('VpcEndpoints', [])
        if endpoint.get('VpcId') == vpc['VpcId']
        and endpoint.get('ServiceName') == service_name
    ), None)


def _verify_ec2_sqs_interface_endpoint() -> dict[str, Any]:
    endpoint = _ec2_sqs_interface_endpoint()
    configured = bool(cache.get(EC2_INTERFACE_CONFIGURED_CACHE_KEY))
    verified = (
        endpoint
        and endpoint.get('VpcEndpointType') == 'Interface'
        and endpoint.get('State') == 'available'
        and configured
    )
    if endpoint:
        cache.set(
            EC2_INTERFACE_ENDPOINT_ID_CACHE_KEY,
            endpoint['VpcEndpointId'],
            timeout=86400,
        )
    return {
        'status': 'passed' if verified else 'failed',
        'message': (
            'The available SQS interface endpoint was requested with private DNS, subnet placement, endpoint security, and a queue-scoped policy.'
            if verified else 'The SQS interface endpoint is incomplete.'
        ),
        'resource': _clean_response(endpoint or {}),
    }


def _verify_ec2_interface_inspection() -> dict[str, Any]:
    if not cache.get(EC2_INTERFACE_INSPECTED_CACHE_KEY):
        return {
            'status': 'failed',
            'message': 'Inspect the endpoint topology after creating it.',
        }
    return {
        'status': 'passed',
        'message': 'The endpoint topology and Floci persistence boundary were inspected.',
    }


def run_lab_step(service_key: str, lab_key: str, step_key: str) -> dict[str, Any]:
    lab = get_lab(service_key, lab_key)
    if not lab:
        raise ValueError('Lab not found')

    if service_key == 'iam' and lab_key == 'create-user-alice' and step_key == 'create-user':
        return _run_iam_create_user_alice()

    if service_key == 'iam' and lab_key == 'attach-policy-alice':
        runners = {
            'create-user': lambda: _run_iam_create_user_alice('attach-policy-alice'),
            'create-policy': _run_iam_create_alice_policy,
            'attach-policy': _run_iam_attach_alice_policy,
            'list-attached-policies': _run_iam_list_alice_attached_policies,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'iam' and lab_key == 'access-key-alice':
        runners = {
            'create-user': lambda: _run_iam_create_user_alice('access-key-alice'),
            'create-access-key': _run_iam_create_alice_access_key,
            'list-access-keys': _run_iam_list_alice_access_keys,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'iam' and lab_key == 'group-membership-alice':
        runners = {
            'create-user': lambda: _run_iam_create_user_alice('group-membership-alice'),
            'create-group': _run_iam_create_floci_developers_group,
            'add-user-to-group': _run_iam_add_alice_to_floci_developers_group,
            'get-group': _run_iam_get_floci_developers_group,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'iam' and lab_key == 'group-policy-floci-developers':
        runners = {
            'create-user': lambda: _run_iam_create_user_alice('group-policy-floci-developers'),
            'create-group': lambda: _run_iam_create_floci_developers_group('group-policy-floci-developers'),
            'add-user-to-group': lambda: _run_iam_add_alice_to_floci_developers_group('group-policy-floci-developers'),
            'create-policy': _run_iam_create_floci_developers_policy,
            'attach-group-policy': _run_iam_attach_floci_developers_policy,
            'list-attached-group-policies': _run_iam_list_floci_developers_attached_policies,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'iam' and lab_key == 'inline-policy-alice':
        runners = {
            'create-user': lambda: _run_iam_create_user_alice('inline-policy-alice'),
            'put-user-policy': _run_iam_put_alice_inline_policy,
            'list-user-policies': _run_iam_list_alice_inline_policies,
            'get-user-policy': _run_iam_get_alice_inline_policy,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'iam' and lab_key == 'role-trust-policy':
        runners = {
            'create-role': _run_iam_create_application_role,
            'get-role': _run_iam_get_application_role,
            'put-role-policy': _run_iam_put_application_role_policy,
            'get-role-policy': _run_iam_get_application_role_policy,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'iam' and lab_key == 'ec2-instance-profile':
        runners = {
            'create-role': _run_iam_create_ec2_role,
            'create-instance-profile': _run_iam_create_ec2_instance_profile,
            'add-role-to-instance-profile': _run_iam_add_ec2_role_to_instance_profile,
            'get-instance-profile': _run_iam_get_ec2_instance_profile,
            'list-instance-profiles-for-role': _run_iam_list_instance_profiles_for_ec2_role,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 's3' and lab_key == 'create-bucket':
        runners = {
            'create-bucket': _run_s3_create_bucket,
            'head-bucket': _run_s3_head_bucket,
            'list-buckets': _run_s3_list_buckets,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 's3' and lab_key == 'object-workflow':
        runners = {
            'create-bucket': _run_s3_create_objects_bucket,
            'put-object': _run_s3_put_hello_object,
            'list-objects': _run_s3_list_hello_objects,
            'head-object': _run_s3_head_hello_object,
            'get-object': _run_s3_get_hello_object,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 's3' and lab_key == 'prefix-copy':
        runners = {
            'create-bucket': _run_s3_create_prefixes_bucket,
            'put-source-object': _run_s3_put_source_report,
            'list-incoming-prefix': _run_s3_list_incoming_prefix,
            'copy-object': _run_s3_copy_report_to_archive,
            'list-archive-prefix': _run_s3_list_archive_prefix,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 's3' and lab_key == 'metadata-tags':
        runners = {
            'create-bucket': _run_s3_create_metadata_bucket,
            'put-object': _run_s3_put_invoice_object,
            'head-object': _run_s3_head_invoice_object,
            'put-object-tagging': _run_s3_put_invoice_tags,
            'get-object-tagging': _run_s3_get_invoice_tags,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 's3' and lab_key == 'version-recovery':
        runners = {
            'create-bucket': _run_s3_create_versioning_bucket,
            'enable-versioning': _run_s3_enable_versioning,
            'put-version-one': _run_s3_put_configuration_v1,
            'put-version-two': _run_s3_put_configuration_v2,
            'list-object-versions': _run_s3_list_configuration_versions,
            'get-version-one': _run_s3_get_configuration_v1,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 's3' and lab_key == 'presigned-url':
        runners = {
            'create-bucket': _run_s3_create_presigned_bucket,
            'put-object': _run_s3_put_presigned_guide,
            'presign-object': _run_s3_presign_guide,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 's3' and lab_key == 'bucket-security':
        runners = {
            'create-bucket': _run_s3_create_security_bucket,
            'put-public-access-block': _run_s3_put_public_access_block,
            'get-public-access-block': _run_s3_get_public_access_block,
            'put-bucket-policy': _run_s3_put_security_bucket_policy,
            'get-bucket-policy': _run_s3_get_security_bucket_policy,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 's3' and lab_key == 'default-encryption':
        runners = {
            'create-bucket': _run_s3_create_encryption_bucket,
            'put-bucket-encryption': _run_s3_put_default_encryption,
            'get-bucket-encryption': _run_s3_get_default_encryption,
            'put-object': _run_s3_put_encrypted_record,
            'head-object': _run_s3_head_encrypted_record,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 's3' and lab_key == 'lifecycle-retention':
        runners = {
            'create-bucket': _run_s3_create_lifecycle_bucket,
            'put-object': _run_s3_put_lifecycle_log,
            'put-lifecycle-configuration': _run_s3_put_lifecycle_configuration,
            'get-lifecycle-configuration': _run_s3_get_lifecycle_configuration,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 's3' and lab_key == 'bucket-cors':
        runners = {
            'create-bucket': _run_s3_create_cors_bucket,
            'put-bucket-cors': _run_s3_put_bucket_cors,
            'get-bucket-cors': _run_s3_get_bucket_cors,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 's3' and lab_key == 'object-notifications-sqs':
        runners = {
            'create-queue': _run_s3_notifications_create_queue,
            'set-queue-policy': _run_s3_notifications_set_queue_policy,
            'create-bucket': _run_s3_notifications_create_bucket,
            'put-notification-configuration': _run_s3_put_notification_configuration,
            'get-notification-configuration': _run_s3_get_notification_configuration,
            'put-object': _run_s3_notifications_put_object,
            'receive-event': _run_s3_notifications_receive_event,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 's3' and lab_key == 'multipart-upload':
        runners = {
            'create-bucket': _run_s3_multipart_create_bucket,
            'create-multipart-upload': _run_s3_create_multipart_upload,
            'upload-part-one': _run_s3_upload_multipart_part_one,
            'upload-part-two': _run_s3_upload_multipart_part_two,
            'list-parts': _run_s3_list_multipart_parts,
            'complete-multipart-upload': _run_s3_complete_multipart_upload,
            'get-object': _run_s3_get_multipart_object,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'sqs' and lab_key == 'create-queue':
        runners = {
            'create-queue': _run_sqs_create_basics_queue,
            'get-queue-url': _run_sqs_get_basics_queue_url,
            'get-queue-attributes': _run_sqs_get_basics_queue_attributes,
            'list-queues': _run_sqs_list_basics_queues,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'sqs' and lab_key == 'message-lifecycle':
        runners = {
            'create-queue': lambda: _run_sqs_create_basics_queue('message-lifecycle'),
            'send-message': _run_sqs_send_lifecycle_message,
            'receive-message': _run_sqs_receive_lifecycle_message,
            'delete-message': _run_sqs_delete_lifecycle_message,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'sqs' and lab_key == 'visibility-timeout':
        runners = {
            'create-queue': lambda: _run_sqs_create_basics_queue('visibility-timeout'),
            'send-message': _run_sqs_send_visibility_message,
            'receive-message': _run_sqs_receive_visibility_message,
            'extend-message-visibility': _run_sqs_extend_visibility,
            'verify-hidden': _run_sqs_verify_visibility_hidden,
            'shorten-message-visibility': _run_sqs_shorten_visibility,
            'receive-after-timeout': _run_sqs_receive_after_visibility_timeout,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'sqs' and lab_key == 'delayed-message':
        runners = {
            'create-queue': lambda: _run_sqs_create_basics_queue('delayed-message'),
            'send-delayed-message': _run_sqs_send_delayed_message,
            'get-queue-attributes': _run_sqs_get_delayed_attributes,
            'receive-after-delay': _run_sqs_receive_after_delay,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'sqs' and lab_key == 'batch-messages':
        runners = {
            'create-queue': lambda: _run_sqs_create_basics_queue('batch-messages'),
            'send-message-batch': _run_sqs_send_message_batch,
            'receive-message': _run_sqs_receive_message_batch,
            'delete-message-batch': _run_sqs_delete_message_batch,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'sqs' and lab_key == 'queue-configuration':
        runners = {
            'create-queue': lambda: _run_sqs_create_basics_queue('queue-configuration'),
            'set-queue-attributes': _run_sqs_set_configuration_attributes,
            'get-queue-attributes': _run_sqs_get_configuration_attributes,
            'tag-queue': _run_sqs_tag_configuration_queue,
            'list-queue-tags': _run_sqs_list_configuration_tags,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'sqs' and lab_key == 'dead-letter-redrive':
        runners = {
            'create-dlq': _run_sqs_create_redrive_dlq,
            'create-source-queue': _run_sqs_create_redrive_source,
            'set-redrive-policy': _run_sqs_set_redrive_policy,
            'get-redrive-policy': _run_sqs_get_redrive_policy,
            'send-message': _run_sqs_send_redrive_message,
            'fail-message-once': lambda: _run_sqs_fail_redrive_message(
                'fail-message-once',
                1,
                SQS_REDRIVE_FAILURE_ONE_CACHE_KEY,
            ),
            'fail-message-twice': lambda: _run_sqs_fail_redrive_message(
                'fail-message-twice',
                2,
                SQS_REDRIVE_FAILURE_TWO_CACHE_KEY,
            ),
            'trigger-dead-lettering': _run_sqs_trigger_dead_lettering,
            'inspect-dlq': _run_sqs_inspect_redrive_dlq,
            'start-message-move-task': _run_sqs_start_message_move_task,
            'list-message-move-tasks': _run_sqs_list_message_move_tasks,
            'receive-redriven-message': _run_sqs_receive_redriven_message,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'sqs' and lab_key == 'fifo-ordering':
        runners = {
            'create-queue': _run_sqs_create_fifo_queue,
            'get-queue-attributes': _run_sqs_get_fifo_attributes,
            'send-created': lambda: _run_sqs_send_fifo_message(0, 'send-created'),
            'send-duplicate': _run_sqs_send_fifo_duplicate,
            'send-paid': lambda: _run_sqs_send_fifo_message(1, 'send-paid'),
            'send-fulfilled': lambda: _run_sqs_send_fifo_message(
                2,
                'send-fulfilled',
            ),
            'inspect-message-count': _run_sqs_get_fifo_message_count,
            'receive-ordered-messages': _run_sqs_receive_ordered_messages,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'sqs' and lab_key == 'purge-delete':
        runners = {
            'create-queue': _run_sqs_create_cleanup_queue,
            'send-message-batch': _run_sqs_send_cleanup_batch,
            'inspect-populated-queue': _run_sqs_inspect_populated_cleanup_queue,
            'purge-queue': _run_sqs_purge_cleanup_queue,
            'inspect-purged-queue': _run_sqs_inspect_purged_cleanup_queue,
            'delete-queue': _run_sqs_delete_cleanup_queue,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'sns' and lab_key == 'sqs-fanout':
        runners = {
            'create-topic': _run_sns_fanout_create_topic,
            'create-orders-queue': lambda: _run_sns_fanout_create_queue(
                SNS_FANOUT_ORDERS_QUEUE_NAME,
                SNS_FANOUT_ORDERS_QUEUE_ARN,
                'create-orders-queue',
            ),
            'create-audit-queue': lambda: _run_sns_fanout_create_queue(
                SNS_FANOUT_AUDIT_QUEUE_NAME,
                SNS_FANOUT_AUDIT_QUEUE_ARN,
                'create-audit-queue',
            ),
            'set-orders-queue-policy': lambda: _run_sns_fanout_set_queue_policy(
                SNS_FANOUT_ORDERS_QUEUE_NAME,
                SNS_FANOUT_ORDERS_QUEUE_ARN,
                'set-orders-queue-policy',
                'orders-queue-url',
                'orders-queue-policy.json',
            ),
            'set-audit-queue-policy': lambda: _run_sns_fanout_set_queue_policy(
                SNS_FANOUT_AUDIT_QUEUE_NAME,
                SNS_FANOUT_AUDIT_QUEUE_ARN,
                'set-audit-queue-policy',
                'audit-queue-url',
                'audit-queue-policy.json',
            ),
            'subscribe-orders-queue': lambda: _run_sns_fanout_subscribe(
                SNS_FANOUT_ORDERS_QUEUE_ARN,
                'subscribe-orders-queue',
            ),
            'subscribe-audit-queue': lambda: _run_sns_fanout_subscribe(
                SNS_FANOUT_AUDIT_QUEUE_ARN,
                'subscribe-audit-queue',
            ),
            'list-subscriptions': _run_sns_fanout_list_subscriptions,
            'publish-message': _run_sns_fanout_publish,
            'receive-orders-copy': lambda: _run_sns_fanout_receive(
                SNS_FANOUT_ORDERS_QUEUE_NAME,
                'receive-orders-copy',
                'orders-queue-url',
            ),
            'receive-audit-copy': lambda: _run_sns_fanout_receive(
                SNS_FANOUT_AUDIT_QUEUE_NAME,
                'receive-audit-copy',
                'audit-queue-url',
            ),
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'sns' and lab_key == 'filter-policies':
        runners = {
            'create-topic': _run_sns_filter_create_topic,
            'create-created-queue': lambda: _run_sns_filter_create_queue(
                SNS_FILTER_CREATED_QUEUE_NAME,
                SNS_FILTER_CREATED_QUEUE_ARN,
                'create-created-queue',
            ),
            'create-priority-queue': lambda: _run_sns_filter_create_queue(
                SNS_FILTER_PRIORITY_QUEUE_NAME,
                SNS_FILTER_PRIORITY_QUEUE_ARN,
                'create-priority-queue',
            ),
            'set-created-queue-policy': lambda: _run_sns_filter_set_queue_policy(
                SNS_FILTER_CREATED_QUEUE_NAME,
                SNS_FILTER_CREATED_QUEUE_ARN,
                'set-created-queue-policy',
                'created-queue-url',
                'created-queue-policy.json',
            ),
            'set-priority-queue-policy': lambda: _run_sns_filter_set_queue_policy(
                SNS_FILTER_PRIORITY_QUEUE_NAME,
                SNS_FILTER_PRIORITY_QUEUE_ARN,
                'set-priority-queue-policy',
                'priority-queue-url',
                'priority-queue-policy.json',
            ),
            'subscribe-created-filter': lambda: _run_sns_filter_subscribe(
                SNS_FILTER_CREATED_QUEUE_ARN,
                SNS_FILTER_CREATED_POLICY,
                'subscribe-created-filter',
                'created-filter.json',
            ),
            'subscribe-priority-filter': lambda: _run_sns_filter_subscribe(
                SNS_FILTER_PRIORITY_QUEUE_ARN,
                SNS_FILTER_PRIORITY_POLICY,
                'subscribe-priority-filter',
                'priority-filter.json',
            ),
            'inspect-filter-policies': _run_sns_filter_inspect,
            'publish-created-event': lambda: _run_sns_filter_publish(
                SNS_FILTER_CREATED_MESSAGE_TEXT,
                SNS_FILTER_CREATED_ATTRIBUTES,
                'publish-created-event',
                'created-event.json',
                'created-attributes.json',
            ),
            'publish-priority-event': lambda: _run_sns_filter_publish(
                SNS_FILTER_PRIORITY_MESSAGE_TEXT,
                SNS_FILTER_PRIORITY_ATTRIBUTES,
                'publish-priority-event',
                'priority-event.json',
                'priority-attributes.json',
            ),
            'receive-created-route': lambda: _run_sns_filter_receive(
                SNS_FILTER_CREATED_QUEUE_NAME,
                SNS_FILTER_CREATED_MESSAGE_TEXT,
                SNS_FILTER_PRIORITY_MESSAGE_TEXT,
                'receive-created-route',
                'created-queue-url',
            ),
            'receive-priority-route': lambda: _run_sns_filter_receive(
                SNS_FILTER_PRIORITY_QUEUE_NAME,
                SNS_FILTER_PRIORITY_MESSAGE_TEXT,
                SNS_FILTER_CREATED_MESSAGE_TEXT,
                'receive-priority-route',
                'priority-queue-url',
            ),
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'scheduler' and lab_key == 'sqs-delivery':
        runners = {
            'create-queue': _run_scheduler_create_queue,
            'create-role': _run_scheduler_create_role,
            'put-role-policy': _run_scheduler_put_role_policy,
            'create-schedule-group': _run_scheduler_create_group,
            'create-schedule': _run_scheduler_create_schedule,
            'get-schedule': _run_scheduler_get_schedule,
            'receive-scheduled-message': _run_scheduler_receive_message,
            'confirm-schedule-deleted': _run_scheduler_confirm_deleted,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'cloudformation' and lab_key == 's3-sqs-stack':
        runners = {
            'validate-template': _run_cloudformation_validate_template,
            'create-stack': _run_cloudformation_create_stack,
            'describe-stack': _run_cloudformation_describe_stack,
            'describe-stack-resources': _run_cloudformation_describe_resources,
            'describe-stack-events': _run_cloudformation_describe_events,
            'inspect-provisioned-resources': _run_cloudformation_inspect_services,
            'delete-stack': _run_cloudformation_delete_stack,
            'confirm-resources-deleted': _run_cloudformation_confirm_deleted,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'ec2' and lab_key == 'vpc-public-private':
        runners = {
            'create-vpc': _run_ec2_create_vpc,
            'create-public-subnet': _run_ec2_create_public_subnet,
            'enable-public-ip': _run_ec2_enable_public_ip,
            'create-private-subnet': _run_ec2_create_private_subnet,
            'create-internet-gateway': _run_ec2_create_igw,
            'attach-internet-gateway': _run_ec2_attach_igw,
            'create-public-route-table': _run_ec2_create_public_route_table,
            'create-internet-route': _run_ec2_create_internet_route,
            'associate-public-route-table': _run_ec2_associate_public_route_table,
            'create-private-route-table': _run_ec2_create_private_route_table,
            'associate-private-route-table': _run_ec2_associate_private_route_table,
            'inspect-network-topology': _run_ec2_inspect_network_topology,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'ec2' and lab_key == 'security-controls':
        runners = {
            'create-vpc': _run_ec2_security_create_vpc,
            'create-subnet': _run_ec2_security_create_subnet,
            'create-web-security-group': lambda: _run_ec2_create_security_group(
                EC2_WEB_SG_NAME,
                'HTTPS web tier',
                EC2_WEB_SG_ID_CACHE_KEY,
                'create-web-security-group',
            ),
            'allow-trusted-https': _run_ec2_allow_trusted_https,
            'create-app-security-group': lambda: _run_ec2_create_security_group(
                EC2_APP_SG_NAME,
                'Private application tier',
                EC2_APP_SG_ID_CACHE_KEY,
                'create-app-security-group',
            ),
            'allow-web-to-app': _run_ec2_allow_web_to_app,
            'inspect-security-groups': _run_ec2_inspect_security_groups,
            'inspect-network-acl-support': _run_ec2_inspect_nacl_support,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'ec2' and lab_key == 's3-gateway-endpoint':
        runners = {
            'create-vpc': _run_ec2_endpoint_create_vpc,
            'create-private-subnet': _run_ec2_endpoint_create_subnet,
            'create-private-route-table': _run_ec2_endpoint_create_route_table,
            'associate-private-route-table': _run_ec2_endpoint_associate_route_table,
            'create-s3-bucket': _run_ec2_endpoint_create_bucket,
            'create-s3-gateway-endpoint': _run_ec2_create_s3_gateway_endpoint,
            'inspect-private-s3-path': _run_ec2_inspect_private_s3_path,
        }
        if step_key in runners:
            return runners[step_key]()

    if service_key == 'ec2' and lab_key == 'sqs-interface-endpoint':
        runners = {
            'create-vpc': _run_ec2_interface_create_vpc,
            'create-private-subnet': _run_ec2_interface_create_subnet,
            'create-endpoint-security-group': _run_ec2_interface_create_security_group,
            'allow-vpc-https': _run_ec2_interface_allow_https,
            'create-sqs-queue': _run_ec2_interface_create_queue,
            'create-sqs-interface-endpoint': _run_ec2_create_sqs_interface_endpoint,
            'inspect-private-sqs-path': _run_ec2_inspect_private_sqs_path,
        }
        if step_key in runners:
            return runners[step_key]()

    raise ValueError('Lab step not found')


def lab_status(service_key: str, lab_key: str) -> dict[str, Any]:
    lab = get_lab(service_key, lab_key)
    if not lab:
        raise ValueError('Lab not found')

    if service_key == 'iam' and lab_key == 'create-user-alice':
        verification = _verify_iam_user('Alice')
        verified = verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': verified,
            'steps': {
                'create-user': {
                    'verified': verified,
                    'verification': verification if verified else None,
                },
            },
        }

    if service_key == 'iam' and lab_key == 'attach-policy-alice':
        user_verification = _verify_iam_user(ALICE_USER_NAME)
        policy_verification = _verify_alice_policy()
        attachment_verification = _verify_alice_policy_attachment()
        user_verified = user_verification.get('status') == 'passed'
        policy_verified = policy_verification.get('status') == 'passed'
        attachment_verified = attachment_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': user_verified and policy_verified and attachment_verified,
            'steps': {
                'create-user': {
                    'verified': user_verified,
                    'verification': user_verification if user_verified else None,
                },
                'create-policy': {
                    'verified': policy_verified,
                    'verification': policy_verification if policy_verified else None,
                },
                'attach-policy': {
                    'verified': attachment_verified,
                    'verification': attachment_verification if attachment_verified else None,
                },
                'list-attached-policies': {
                    'verified': attachment_verified,
                    'verification': attachment_verification if attachment_verified else None,
                },
            },
        }

    if service_key == 'iam' and lab_key == 'access-key-alice':
        user_verification = _verify_iam_user(ALICE_USER_NAME)
        key_verification = _verify_alice_access_key()
        user_verified = user_verification.get('status') == 'passed'
        key_verified = key_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': user_verified and key_verified,
            'steps': {
                'create-user': {
                    'verified': user_verified,
                    'verification': user_verification if user_verified else None,
                },
                'create-access-key': {
                    'verified': key_verified,
                    'verification': key_verification if key_verified else None,
                },
                'list-access-keys': {
                    'verified': key_verified,
                    'verification': key_verification if key_verified else None,
                },
            },
        }

    if service_key == 'iam' and lab_key == 'group-membership-alice':
        user_verification = _verify_iam_user(ALICE_USER_NAME)
        group_verification = _verify_floci_developers_group()
        membership_verification = _verify_alice_group_membership()
        user_verified = user_verification.get('status') == 'passed'
        group_verified = group_verification.get('status') == 'passed'
        membership_verified = membership_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': user_verified and group_verified and membership_verified,
            'steps': {
                'create-user': {
                    'verified': user_verified,
                    'verification': user_verification if user_verified else None,
                },
                'create-group': {
                    'verified': group_verified,
                    'verification': group_verification if group_verified else None,
                },
                'add-user-to-group': {
                    'verified': membership_verified,
                    'verification': membership_verification if membership_verified else None,
                },
                'get-group': {
                    'verified': membership_verified,
                    'verification': membership_verification if membership_verified else None,
                },
            },
        }

    if service_key == 'iam' and lab_key == 'group-policy-floci-developers':
        user_verification = _verify_iam_user(ALICE_USER_NAME)
        group_verification = _verify_floci_developers_group()
        membership_verification = _verify_alice_group_membership()
        policy_verification = _verify_floci_developers_policy()
        attachment_verification = _verify_floci_developers_policy_attachment()
        user_verified = user_verification.get('status') == 'passed'
        group_verified = group_verification.get('status') == 'passed'
        membership_verified = membership_verification.get('status') == 'passed'
        policy_verified = policy_verification.get('status') == 'passed'
        attachment_verified = attachment_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': user_verified and group_verified and membership_verified and policy_verified and attachment_verified,
            'steps': {
                'create-user': {
                    'verified': user_verified,
                    'verification': user_verification if user_verified else None,
                },
                'create-group': {
                    'verified': group_verified,
                    'verification': group_verification if group_verified else None,
                },
                'add-user-to-group': {
                    'verified': membership_verified,
                    'verification': membership_verification if membership_verified else None,
                },
                'create-policy': {
                    'verified': policy_verified,
                    'verification': policy_verification if policy_verified else None,
                },
                'attach-group-policy': {
                    'verified': attachment_verified,
                    'verification': attachment_verification if attachment_verified else None,
                },
                'list-attached-group-policies': {
                    'verified': attachment_verified,
                    'verification': attachment_verification if attachment_verified else None,
                },
            },
        }

    if service_key == 'iam' and lab_key == 'inline-policy-alice':
        user_verification = _verify_iam_user(ALICE_USER_NAME)
        policy_verification = _verify_alice_inline_policy()
        user_verified = user_verification.get('status') == 'passed'
        policy_verified = policy_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': user_verified and policy_verified,
            'steps': {
                'create-user': {
                    'verified': user_verified,
                    'verification': user_verification if user_verified else None,
                },
                'put-user-policy': {
                    'verified': policy_verified,
                    'verification': policy_verification if policy_verified else None,
                },
                'list-user-policies': {
                    'verified': policy_verified,
                    'verification': policy_verification if policy_verified else None,
                },
                'get-user-policy': {
                    'verified': policy_verified,
                    'verification': policy_verification if policy_verified else None,
                },
            },
        }

    if service_key == 'iam' and lab_key == 'role-trust-policy':
        role_verification = _verify_role(FLOCI_APPLICATION_ROLE_NAME, 'lambda.amazonaws.com')
        policy_verification = _verify_application_role_policy()
        role_verified = role_verification.get('status') == 'passed'
        policy_verified = policy_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': role_verified and policy_verified,
            'steps': {
                'create-role': {'verified': role_verified, 'verification': role_verification if role_verified else None},
                'get-role': {'verified': role_verified, 'verification': role_verification if role_verified else None},
                'put-role-policy': {'verified': policy_verified, 'verification': policy_verification if policy_verified else None},
                'get-role-policy': {'verified': policy_verified, 'verification': policy_verification if policy_verified else None},
            },
        }

    if service_key == 'iam' and lab_key == 'ec2-instance-profile':
        role_verification = _verify_role(FLOCI_EC2_ROLE_NAME, 'ec2.amazonaws.com')
        profile_verification = _verify_ec2_instance_profile()
        association_verification = _verify_ec2_role_profile_association()
        role_verified = role_verification.get('status') == 'passed'
        profile_verified = profile_verification.get('status') == 'passed'
        association_verified = association_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': role_verified and profile_verified and association_verified,
            'steps': {
                'create-role': {'verified': role_verified, 'verification': role_verification if role_verified else None},
                'create-instance-profile': {'verified': profile_verified, 'verification': profile_verification if profile_verified else None},
                'add-role-to-instance-profile': {'verified': association_verified, 'verification': association_verification if association_verified else None},
                'get-instance-profile': {'verified': association_verified, 'verification': association_verification if association_verified else None},
                'list-instance-profiles-for-role': {'verified': association_verified, 'verification': association_verification if association_verified else None},
            },
        }

    if service_key == 's3' and lab_key == 'create-bucket':
        verification = _verify_s3_bucket()
        verified = verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': verified,
            'steps': {
                'create-bucket': {'verified': verified, 'verification': verification if verified else None},
                'head-bucket': {'verified': verified, 'verification': verification if verified else None},
                'list-buckets': {'verified': verified, 'verification': verification if verified else None},
            },
        }

    if service_key == 's3' and lab_key == 'object-workflow':
        bucket_verification = _verify_s3_objects_bucket()
        object_verification = _verify_s3_hello_object()
        bucket_verified = bucket_verification.get('status') == 'passed'
        object_verified = object_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': bucket_verified and object_verified,
            'steps': {
                'create-bucket': {
                    'verified': bucket_verified,
                    'verification': bucket_verification if bucket_verified else None,
                },
                'put-object': {
                    'verified': object_verified,
                    'verification': object_verification if object_verified else None,
                },
                'list-objects': {
                    'verified': object_verified,
                    'verification': object_verification if object_verified else None,
                },
                'head-object': {
                    'verified': object_verified,
                    'verification': object_verification if object_verified else None,
                },
                'get-object': {
                    'verified': object_verified,
                    'verification': object_verification if object_verified else None,
                },
            },
        }

    if service_key == 's3' and lab_key == 'prefix-copy':
        bucket_verification = _verify_s3_prefixes_bucket()
        source_verification = _verify_s3_report_object(S3_REPORT_SOURCE_KEY)
        archive_verification = _verify_s3_report_object(S3_REPORT_ARCHIVE_KEY)
        bucket_verified = bucket_verification.get('status') == 'passed'
        source_verified = source_verification.get('status') == 'passed'
        archive_verified = archive_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': bucket_verified and source_verified and archive_verified,
            'steps': {
                'create-bucket': {
                    'verified': bucket_verified,
                    'verification': bucket_verification if bucket_verified else None,
                },
                'put-source-object': {
                    'verified': source_verified,
                    'verification': source_verification if source_verified else None,
                },
                'list-incoming-prefix': {
                    'verified': source_verified,
                    'verification': source_verification if source_verified else None,
                },
                'copy-object': {
                    'verified': archive_verified,
                    'verification': archive_verification if archive_verified else None,
                },
                'list-archive-prefix': {
                    'verified': archive_verified,
                    'verification': archive_verification if archive_verified else None,
                },
            },
        }

    if service_key == 's3' and lab_key == 'metadata-tags':
        bucket_verification = _verify_s3_metadata_bucket()
        metadata_verification = _verify_s3_invoice_metadata()
        tags_verification = _verify_s3_invoice_tags()
        bucket_verified = bucket_verification.get('status') == 'passed'
        metadata_verified = metadata_verification.get('status') == 'passed'
        tags_verified = tags_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': bucket_verified and metadata_verified and tags_verified,
            'steps': {
                'create-bucket': {
                    'verified': bucket_verified,
                    'verification': bucket_verification if bucket_verified else None,
                },
                'put-object': {
                    'verified': metadata_verified,
                    'verification': metadata_verification if metadata_verified else None,
                },
                'head-object': {
                    'verified': metadata_verified,
                    'verification': metadata_verification if metadata_verified else None,
                },
                'put-object-tagging': {
                    'verified': tags_verified,
                    'verification': tags_verification if tags_verified else None,
                },
                'get-object-tagging': {
                    'verified': tags_verified,
                    'verification': tags_verification if tags_verified else None,
                },
            },
        }

    if service_key == 's3' and lab_key == 'version-recovery':
        bucket_verification = _verify_s3_versioning_bucket()
        versioning_verification = _verify_s3_versioning_enabled()
        version_one_verification = _verify_s3_configuration_version_one()
        versions_verification = _verify_s3_configuration_versions()
        bucket_verified = bucket_verification.get('status') == 'passed'
        versioning_verified = versioning_verification.get('status') == 'passed'
        version_one_verified = version_one_verification.get('status') == 'passed'
        versions_verified = versions_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': bucket_verified and versioning_verified and versions_verified,
            'steps': {
                'create-bucket': {
                    'verified': bucket_verified,
                    'verification': bucket_verification if bucket_verified else None,
                },
                'enable-versioning': {
                    'verified': versioning_verified,
                    'verification': versioning_verification if versioning_verified else None,
                },
                'put-version-one': {
                    'verified': version_one_verified,
                    'verification': version_one_verification if version_one_verified else None,
                },
                'put-version-two': {
                    'verified': versions_verified,
                    'verification': versions_verification if versions_verified else None,
                },
                'list-object-versions': {
                    'verified': versions_verified,
                    'verification': versions_verification if versions_verified else None,
                },
                'get-version-one': {
                    'verified': versions_verified,
                    'verification': versions_verification if versions_verified else None,
                },
            },
        }

    if service_key == 's3' and lab_key == 'presigned-url':
        bucket_verification = _verify_s3_presigned_bucket()
        object_verification = _verify_s3_presigned_object()
        bucket_verified = bucket_verification.get('status') == 'passed'
        object_verified = object_verification.get('status') == 'passed'
        access_verification = (
            _verify_s3_presigned_access()
            if object_verified
            else {'status': 'failed', 'message': 'The guide object is not ready for presigned access.'}
        )
        access_verified = access_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': bucket_verified and object_verified and access_verified,
            'steps': {
                'create-bucket': {
                    'verified': bucket_verified,
                    'verification': bucket_verification if bucket_verified else None,
                },
                'put-object': {
                    'verified': object_verified,
                    'verification': object_verification if object_verified else None,
                },
                'presign-object': {
                    'verified': access_verified,
                    'verification': access_verification if access_verified else None,
                },
            },
        }

    if service_key == 's3' and lab_key == 'bucket-security':
        bucket_verification = _verify_s3_security_bucket()
        block_verification = _verify_s3_public_access_block()
        policy_verification = _verify_s3_security_bucket_policy()
        bucket_verified = bucket_verification.get('status') == 'passed'
        block_verified = block_verification.get('status') == 'passed'
        policy_verified = policy_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': bucket_verified and block_verified and policy_verified,
            'steps': {
                'create-bucket': {
                    'verified': bucket_verified,
                    'verification': bucket_verification if bucket_verified else None,
                },
                'put-public-access-block': {
                    'verified': block_verified,
                    'verification': block_verification if block_verified else None,
                },
                'get-public-access-block': {
                    'verified': block_verified,
                    'verification': block_verification if block_verified else None,
                },
                'put-bucket-policy': {
                    'verified': policy_verified,
                    'verification': policy_verification if policy_verified else None,
                },
                'get-bucket-policy': {
                    'verified': policy_verified,
                    'verification': policy_verification if policy_verified else None,
                },
            },
        }

    if service_key == 's3' and lab_key == 'default-encryption':
        bucket_verification = _verify_s3_encryption_bucket()
        encryption_verification = _verify_s3_default_encryption()
        object_verification = _verify_s3_encrypted_record_workflow()
        bucket_verified = bucket_verification.get('status') == 'passed'
        encryption_verified = encryption_verification.get('status') == 'passed'
        object_verified = object_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': bucket_verified and encryption_verified and object_verified,
            'steps': {
                'create-bucket': {
                    'verified': bucket_verified,
                    'verification': bucket_verification if bucket_verified else None,
                },
                'put-bucket-encryption': {
                    'verified': encryption_verified,
                    'verification': encryption_verification if encryption_verified else None,
                },
                'get-bucket-encryption': {
                    'verified': encryption_verified,
                    'verification': encryption_verification if encryption_verified else None,
                },
                'put-object': {
                    'verified': object_verified,
                    'verification': object_verification if object_verified else None,
                },
                'head-object': {
                    'verified': object_verified,
                    'verification': object_verification if object_verified else None,
                },
            },
        }

    if service_key == 's3' and lab_key == 'lifecycle-retention':
        bucket_verification = _verify_s3_lifecycle_bucket()
        object_verification = _verify_s3_lifecycle_log()
        lifecycle_verification = _verify_s3_lifecycle_configuration()
        bucket_verified = bucket_verification.get('status') == 'passed'
        object_verified = object_verification.get('status') == 'passed'
        lifecycle_verified = lifecycle_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': bucket_verified and object_verified and lifecycle_verified,
            'steps': {
                'create-bucket': {
                    'verified': bucket_verified,
                    'verification': bucket_verification if bucket_verified else None,
                },
                'put-object': {
                    'verified': object_verified,
                    'verification': object_verification if object_verified else None,
                },
                'put-lifecycle-configuration': {
                    'verified': lifecycle_verified,
                    'verification': lifecycle_verification if lifecycle_verified else None,
                },
                'get-lifecycle-configuration': {
                    'verified': lifecycle_verified,
                    'verification': lifecycle_verification if lifecycle_verified else None,
                },
            },
        }

    if service_key == 's3' and lab_key == 'bucket-cors':
        bucket_verification = _verify_s3_cors_bucket()
        cors_verification = _verify_s3_cors_configuration()
        bucket_verified = bucket_verification.get('status') == 'passed'
        cors_verified = cors_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': bucket_verified and cors_verified,
            'steps': {
                'create-bucket': {
                    'verified': bucket_verified,
                    'verification': bucket_verification if bucket_verified else None,
                },
                'put-bucket-cors': {
                    'verified': cors_verified,
                    'verification': cors_verification if cors_verified else None,
                },
                'get-bucket-cors': {
                    'verified': cors_verified,
                    'verification': cors_verification if cors_verified else None,
                },
            },
        }

    if service_key == 's3' and lab_key == 'object-notifications-sqs':
        queue_verification = _verify_s3_notifications_queue()
        policy_verification = _verify_s3_notifications_queue_policy()
        bucket_verification = _verify_s3_notifications_bucket()
        configuration_verification = _verify_s3_notification_configuration()
        object_verification = _verify_s3_notification_object()
        queue_verified = queue_verification.get('status') == 'passed'
        policy_verified = policy_verification.get('status') == 'passed'
        bucket_verified = bucket_verification.get('status') == 'passed'
        configuration_verified = configuration_verification.get('status') == 'passed'
        object_verified = object_verification.get('status') == 'passed'
        delivery_verification = (
            _verify_s3_notification_delivery()
            if object_verified
            else {'status': 'failed', 'message': 'The report object is not ready to emit an event.'}
        )
        delivery_verified = delivery_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': all((
                queue_verified,
                policy_verified,
                bucket_verified,
                configuration_verified,
                object_verified,
                delivery_verified,
            )),
            'steps': {
                'create-queue': {
                    'verified': queue_verified,
                    'verification': queue_verification if queue_verified else None,
                },
                'set-queue-policy': {
                    'verified': policy_verified,
                    'verification': policy_verification if policy_verified else None,
                },
                'create-bucket': {
                    'verified': bucket_verified,
                    'verification': bucket_verification if bucket_verified else None,
                },
                'put-notification-configuration': {
                    'verified': configuration_verified,
                    'verification': configuration_verification if configuration_verified else None,
                },
                'get-notification-configuration': {
                    'verified': configuration_verified,
                    'verification': configuration_verification if configuration_verified else None,
                },
                'put-object': {
                    'verified': object_verified,
                    'verification': object_verification if object_verified else None,
                },
                'receive-event': {
                    'verified': delivery_verified,
                    'verification': delivery_verification if delivery_verified else None,
                },
            },
        }

    if service_key == 's3' and lab_key == 'multipart-upload':
        bucket_verification = _verify_s3_multipart_bucket()
        object_verification = _verify_s3_multipart_object()
        bucket_verified = bucket_verification.get('status') == 'passed'
        object_verified = object_verification.get('status') == 'passed'
        if object_verified:
            upload_verification = object_verification
            part_one_verification = object_verification
            parts_verification = object_verification
            upload_verified = True
            part_one_verified = True
            parts_verified = True
        else:
            upload_verification = _verify_s3_multipart_upload_started()
            part_one_verification = _verify_s3_multipart_parts({1})
            parts_verification = _verify_s3_multipart_parts({1, 2})
            upload_verified = upload_verification.get('status') == 'passed'
            part_one_verified = part_one_verification.get('status') == 'passed'
            parts_verified = parts_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': bucket_verified and object_verified,
            'steps': {
                'create-bucket': {
                    'verified': bucket_verified,
                    'verification': bucket_verification if bucket_verified else None,
                },
                'create-multipart-upload': {
                    'verified': upload_verified,
                    'verification': upload_verification if upload_verified else None,
                },
                'upload-part-one': {
                    'verified': part_one_verified,
                    'verification': part_one_verification if part_one_verified else None,
                },
                'upload-part-two': {
                    'verified': parts_verified,
                    'verification': parts_verification if parts_verified else None,
                },
                'list-parts': {
                    'verified': parts_verified,
                    'verification': parts_verification if parts_verified else None,
                },
                'complete-multipart-upload': {
                    'verified': object_verified,
                    'verification': object_verification if object_verified else None,
                },
                'get-object': {
                    'verified': object_verified,
                    'verification': object_verification if object_verified else None,
                },
            },
        }

    if service_key == 'sqs' and lab_key == 'create-queue':
        url_verification = _verify_sqs_basics_queue_url()
        attributes_verification = _verify_sqs_basics_queue_attributes()
        list_verification = _verify_sqs_basics_listed()
        url_verified = url_verification.get('status') == 'passed'
        attributes_verified = attributes_verification.get('status') == 'passed'
        list_verified = list_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': url_verified and attributes_verified and list_verified,
            'steps': {
                'create-queue': {
                    'verified': url_verified,
                    'verification': url_verification if url_verified else None,
                },
                'get-queue-url': {
                    'verified': url_verified,
                    'verification': url_verification if url_verified else None,
                },
                'get-queue-attributes': {
                    'verified': attributes_verified,
                    'verification': attributes_verification if attributes_verified else None,
                },
                'list-queues': {
                    'verified': list_verified,
                    'verification': list_verification if list_verified else None,
                },
            },
        }

    if service_key == 'sqs' and lab_key == 'message-lifecycle':
        queue_verification = _verify_sqs_basics_queue_url()
        deletion_verification = _verify_sqs_lifecycle_message_deleted()
        queue_verified = queue_verification.get('status') == 'passed'
        deletion_verified = deletion_verification.get('status') == 'passed'
        message_verification = (
            deletion_verification
            if deletion_verified
            else _verify_sqs_lifecycle_message()
        )
        message_verified = message_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': queue_verified and deletion_verified,
            'steps': {
                'create-queue': {
                    'verified': queue_verified,
                    'verification': queue_verification if queue_verified else None,
                },
                'send-message': {
                    'verified': message_verified,
                    'verification': message_verification if message_verified else None,
                },
                'receive-message': {
                    'verified': message_verified,
                    'verification': message_verification if message_verified else None,
                },
                'delete-message': {
                    'verified': deletion_verified,
                    'verification': deletion_verification if deletion_verified else None,
                },
            },
        }

    if service_key == 'sqs' and lab_key == 'visibility-timeout':
        queue_verification = _verify_sqs_basics_queue_url()
        queue_verified = queue_verification.get('status') == 'passed'
        returned_verification = _verify_sqs_visibility_returned()
        returned_verified = returned_verification.get('status') == 'passed'
        hidden_verification = _verify_sqs_visibility_hidden()
        hidden_verified = hidden_verification.get('status') == 'passed'
        available_verification = (
            returned_verification
            if returned_verified
            else _verify_sqs_visibility_message_available()
        )
        available_verified = available_verification.get('status') == 'passed'
        receipt_verified = bool(cache.get(SQS_VISIBILITY_RECEIPT_CACHE_KEY))
        extended_verified = bool(cache.get(SQS_VISIBILITY_EXTENDED_CACHE_KEY))
        shortened_verified = bool(cache.get(SQS_VISIBILITY_SHORTENED_CACHE_KEY))
        receipt_verification = {
            'status': 'passed',
            'message': 'The job was received and its live receipt handle was captured.',
        }
        extended_verification = {
            'status': 'passed',
            'message': 'The job visibility timeout was extended to 60 seconds.',
        }
        shortened_verification = {
            'status': 'passed',
            'message': 'The job visibility timeout was shortened to 2 seconds.',
        }
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': queue_verified and hidden_verified and returned_verified,
            'steps': {
                'create-queue': {
                    'verified': queue_verified,
                    'verification': queue_verification if queue_verified else None,
                },
                'send-message': {
                    'verified': available_verified or receipt_verified,
                    'verification': (
                        available_verification
                        if available_verified
                        else receipt_verification if receipt_verified else None
                    ),
                },
                'receive-message': {
                    'verified': receipt_verified or returned_verified,
                    'verification': (
                        receipt_verification
                        if receipt_verified
                        else returned_verification if returned_verified else None
                    ),
                },
                'extend-message-visibility': {
                    'verified': extended_verified or hidden_verified,
                    'verification': (
                        extended_verification
                        if extended_verified
                        else hidden_verification if hidden_verified else None
                    ),
                },
                'verify-hidden': {
                    'verified': hidden_verified,
                    'verification': hidden_verification if hidden_verified else None,
                },
                'shorten-message-visibility': {
                    'verified': shortened_verified or returned_verified,
                    'verification': (
                        shortened_verification
                        if shortened_verified
                        else returned_verification if returned_verified else None
                    ),
                },
                'receive-after-timeout': {
                    'verified': returned_verified,
                    'verification': returned_verification if returned_verified else None,
                },
            },
        }

    if service_key == 'sqs' and lab_key == 'delayed-message':
        queue_verification = _verify_sqs_basics_queue_url()
        observed_verification = _verify_sqs_delayed_observed()
        returned_verification = _verify_sqs_delayed_returned()
        queue_verified = queue_verification.get('status') == 'passed'
        observed_verified = observed_verification.get('status') == 'passed'
        returned_verified = returned_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': queue_verified and observed_verified and returned_verified,
            'steps': {
                'create-queue': {
                    'verified': queue_verified,
                    'verification': queue_verification if queue_verified else None,
                },
                'send-delayed-message': {
                    'verified': observed_verified,
                    'verification': observed_verification if observed_verified else None,
                },
                'get-queue-attributes': {
                    'verified': observed_verified,
                    'verification': observed_verification if observed_verified else None,
                },
                'receive-after-delay': {
                    'verified': returned_verified,
                    'verification': returned_verification if returned_verified else None,
                },
            },
        }

    if service_key == 'sqs' and lab_key == 'batch-messages':
        queue_verification = _verify_sqs_basics_queue_url()
        deletion_verification = _verify_sqs_batch_deleted()
        queue_verified = queue_verification.get('status') == 'passed'
        deletion_verified = deletion_verification.get('status') == 'passed'
        batch_verification = (
            deletion_verification
            if deletion_verified
            else _verify_sqs_batch_available()
        )
        batch_verified = batch_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': queue_verified and deletion_verified,
            'steps': {
                'create-queue': {
                    'verified': queue_verified,
                    'verification': queue_verification if queue_verified else None,
                },
                'send-message-batch': {
                    'verified': batch_verified,
                    'verification': batch_verification if batch_verified else None,
                },
                'receive-message': {
                    'verified': batch_verified,
                    'verification': batch_verification if batch_verified else None,
                },
                'delete-message-batch': {
                    'verified': deletion_verified,
                    'verification': deletion_verification if deletion_verified else None,
                },
            },
        }

    if service_key == 'sqs' and lab_key == 'queue-configuration':
        queue_verification = _verify_sqs_basics_queue_url()
        attributes_verification = _verify_sqs_configuration_attributes()
        tags_verification = _verify_sqs_configuration_tags()
        queue_verified = queue_verification.get('status') == 'passed'
        attributes_verified = attributes_verification.get('status') == 'passed'
        tags_verified = tags_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': queue_verified and attributes_verified and tags_verified,
            'steps': {
                'create-queue': {
                    'verified': queue_verified,
                    'verification': queue_verification if queue_verified else None,
                },
                'set-queue-attributes': {
                    'verified': attributes_verified,
                    'verification': attributes_verification if attributes_verified else None,
                },
                'get-queue-attributes': {
                    'verified': attributes_verified,
                    'verification': attributes_verification if attributes_verified else None,
                },
                'tag-queue': {
                    'verified': tags_verified,
                    'verification': tags_verification if tags_verified else None,
                },
                'list-queue-tags': {
                    'verified': tags_verified,
                    'verification': tags_verification if tags_verified else None,
                },
            },
        }

    if service_key == 'sqs' and lab_key == 'dead-letter-redrive':
        dlq_verification = _verify_sqs_redrive_queue(
            SQS_REDRIVE_DLQ_NAME,
            SQS_REDRIVE_DLQ_ARN,
        )
        source_verification = _verify_sqs_redrive_queue(
            SQS_REDRIVE_SOURCE_QUEUE_NAME,
            SQS_REDRIVE_SOURCE_QUEUE_ARN,
        )
        policy_verification = _verify_sqs_redrive_policy()
        failure_one_verification = _verify_sqs_redrive_marker(
            SQS_REDRIVE_FAILURE_ONE_CACHE_KEY,
            'The first failed receive was verified.',
            'The message has not completed its first failed receive.',
        )
        failure_two_verification = _verify_sqs_redrive_marker(
            SQS_REDRIVE_FAILURE_TWO_CACHE_KEY,
            'The second failed receive reached maxReceiveCount.',
            'The message has not completed its second failed receive.',
        )
        triggered_verification = _verify_sqs_redrive_marker(
            SQS_REDRIVE_TRIGGERED_CACHE_KEY,
            'SQS removed the over-received message from the source queue.',
            'The source queue has not yet evaluated the message beyond maxReceiveCount.',
        )
        dlq_message_verification = _verify_sqs_redrive_marker(
            SQS_REDRIVE_DLQ_OBSERVED_CACHE_KEY,
            'The failed payment event was observed in the dead-letter queue.',
            'The failed payment event has not been observed in the dead-letter queue.',
        )
        task_verification = _verify_sqs_redrive_task()
        returned_verification = _verify_sqs_redrive_marker(
            SQS_REDRIVE_RETURNED_CACHE_KEY,
            'The redriven payment event was received from the source queue.',
            'The redriven payment event has not been received from the source queue.',
        )
        dlq_verified = dlq_verification.get('status') == 'passed'
        source_verified = source_verification.get('status') == 'passed'
        policy_verified = policy_verification.get('status') == 'passed'
        failure_one_verified = failure_one_verification.get('status') == 'passed'
        failure_two_verified = failure_two_verification.get('status') == 'passed'
        triggered_verified = triggered_verification.get('status') == 'passed'
        dlq_message_verified = dlq_message_verification.get('status') == 'passed'
        task_verified = task_verification.get('status') == 'passed'
        returned_verified = returned_verification.get('status') == 'passed'
        sent_verified = (
            failure_one_verified
            or failure_two_verified
            or dlq_message_verified
            or task_verified
            or returned_verified
        )
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': (
                dlq_verified
                and source_verified
                and policy_verified
                and failure_one_verified
                and failure_two_verified
                and triggered_verified
                and dlq_message_verified
                and task_verified
                and returned_verified
            ),
            'steps': {
                'create-dlq': {
                    'verified': dlq_verified,
                    'verification': dlq_verification if dlq_verified else None,
                },
                'create-source-queue': {
                    'verified': source_verified,
                    'verification': source_verification if source_verified else None,
                },
                'set-redrive-policy': {
                    'verified': policy_verified,
                    'verification': policy_verification if policy_verified else None,
                },
                'get-redrive-policy': {
                    'verified': policy_verified,
                    'verification': policy_verification if policy_verified else None,
                },
                'send-message': {
                    'verified': sent_verified,
                    'verification': (
                        failure_one_verification if sent_verified else None
                    ),
                },
                'fail-message-once': {
                    'verified': failure_one_verified,
                    'verification': (
                        failure_one_verification if failure_one_verified else None
                    ),
                },
                'fail-message-twice': {
                    'verified': failure_two_verified,
                    'verification': (
                        failure_two_verification if failure_two_verified else None
                    ),
                },
                'trigger-dead-lettering': {
                    'verified': triggered_verified,
                    'verification': (
                        triggered_verification if triggered_verified else None
                    ),
                },
                'inspect-dlq': {
                    'verified': dlq_message_verified,
                    'verification': (
                        dlq_message_verification if dlq_message_verified else None
                    ),
                },
                'start-message-move-task': {
                    'verified': task_verified,
                    'verification': task_verification if task_verified else None,
                },
                'list-message-move-tasks': {
                    'verified': task_verified,
                    'verification': task_verification if task_verified else None,
                },
                'receive-redriven-message': {
                    'verified': returned_verified,
                    'verification': returned_verification if returned_verified else None,
                },
            },
        }

    if service_key == 'sqs' and lab_key == 'fifo-ordering':
        queue_verification = _verify_sqs_fifo_queue()
        count_verification = _verify_sqs_fifo_message_count()
        ordering_verification = _verify_sqs_fifo_messages()
        queue_verified = queue_verification.get('status') == 'passed'
        count_verified = count_verification.get('status') == 'passed'
        ordering_verified = ordering_verification.get('status') == 'passed'
        deduplicated_verified = bool(cache.get(SQS_FIFO_DEDUPLICATED_CACHE_KEY))
        sent_verified = count_verified or ordering_verified
        sent_verification = (
            ordering_verification
            if ordering_verified
            else count_verification if count_verified else None
        )
        deduplication_verification = {
            'status': 'passed',
            'message': 'The duplicate send reused the original message ID and sequence number.',
        }
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': (
                queue_verified
                and deduplicated_verified
                and count_verified
                and ordering_verified
            ),
            'steps': {
                'create-queue': {
                    'verified': queue_verified,
                    'verification': queue_verification if queue_verified else None,
                },
                'get-queue-attributes': {
                    'verified': queue_verified,
                    'verification': queue_verification if queue_verified else None,
                },
                'send-created': {
                    'verified': sent_verified,
                    'verification': sent_verification,
                },
                'send-duplicate': {
                    'verified': deduplicated_verified,
                    'verification': (
                        deduplication_verification
                        if deduplicated_verified
                        else None
                    ),
                },
                'send-paid': {
                    'verified': sent_verified,
                    'verification': sent_verification,
                },
                'send-fulfilled': {
                    'verified': sent_verified,
                    'verification': sent_verification,
                },
                'inspect-message-count': {
                    'verified': count_verified,
                    'verification': count_verification if count_verified else None,
                },
                'receive-ordered-messages': {
                    'verified': ordering_verified,
                    'verification': (
                        ordering_verification if ordering_verified else None
                    ),
                },
            },
        }

    if service_key == 'sqs' and lab_key == 'purge-delete':
        deleted_verification = _verify_sqs_cleanup_deleted()
        deleted_verified = deleted_verification.get('status') == 'passed'
        populated_verified = bool(cache.get(SQS_CLEANUP_POPULATED_CACHE_KEY))
        purged_verified = bool(cache.get(SQS_CLEANUP_PURGED_CACHE_KEY))
        populated_verification = {
            'status': 'passed',
            'message': 'The cleanup queue was populated with three lab messages.',
        }
        purged_verification = {
            'status': 'passed',
            'message': 'The queue was emptied while its configuration remained intact.',
        }
        if deleted_verified:
            queue_verified = True
            queue_verification = {
                'status': 'passed',
                'message': 'The dedicated cleanup queue was created during this lab run.',
            }
        else:
            queue_verification = _verify_sqs_cleanup_queue(
                (
                    len(SQS_CLEANUP_MESSAGES)
                    if populated_verified and not purged_verified
                    else 0
                )
            )
            queue_verified = queue_verification.get('status') == 'passed'
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': (
                populated_verified
                and purged_verified
                and deleted_verified
            ),
            'steps': {
                'create-queue': {
                    'verified': queue_verified,
                    'verification': queue_verification if queue_verified else None,
                },
                'send-message-batch': {
                    'verified': populated_verified,
                    'verification': (
                        populated_verification if populated_verified else None
                    ),
                },
                'inspect-populated-queue': {
                    'verified': populated_verified,
                    'verification': (
                        populated_verification if populated_verified else None
                    ),
                },
                'purge-queue': {
                    'verified': purged_verified,
                    'verification': purged_verification if purged_verified else None,
                },
                'inspect-purged-queue': {
                    'verified': purged_verified,
                    'verification': purged_verification if purged_verified else None,
                },
                'delete-queue': {
                    'verified': deleted_verified,
                    'verification': (
                        deleted_verification if deleted_verified else None
                    ),
                },
            },
        }

    if service_key == 'sns' and lab_key == 'sqs-fanout':
        topic_verification = _verify_sns_fanout_topic()
        orders_queue_verification = _verify_sns_fanout_queue(
            SNS_FANOUT_ORDERS_QUEUE_NAME,
            SNS_FANOUT_ORDERS_QUEUE_ARN,
        )
        audit_queue_verification = _verify_sns_fanout_queue(
            SNS_FANOUT_AUDIT_QUEUE_NAME,
            SNS_FANOUT_AUDIT_QUEUE_ARN,
        )
        orders_policy_verification = _verify_sns_fanout_queue_policy(
            SNS_FANOUT_ORDERS_QUEUE_NAME,
            SNS_FANOUT_ORDERS_QUEUE_ARN,
        )
        audit_policy_verification = _verify_sns_fanout_queue_policy(
            SNS_FANOUT_AUDIT_QUEUE_NAME,
            SNS_FANOUT_AUDIT_QUEUE_ARN,
        )
        orders_subscription_verification = _verify_sns_fanout_subscription(
            SNS_FANOUT_ORDERS_QUEUE_ARN,
        )
        audit_subscription_verification = _verify_sns_fanout_subscription(
            SNS_FANOUT_AUDIT_QUEUE_ARN,
        )
        orders_delivery_verification = _verify_sns_fanout_delivery(
            SNS_FANOUT_ORDERS_QUEUE_NAME,
        )
        audit_delivery_verification = _verify_sns_fanout_delivery(
            SNS_FANOUT_AUDIT_QUEUE_NAME,
        )
        topic_verified = topic_verification.get('status') == 'passed'
        orders_queue_verified = (
            orders_queue_verification.get('status') == 'passed'
        )
        audit_queue_verified = audit_queue_verification.get('status') == 'passed'
        orders_policy_verified = (
            orders_policy_verification.get('status') == 'passed'
        )
        audit_policy_verified = audit_policy_verification.get('status') == 'passed'
        orders_subscription_verified = (
            orders_subscription_verification.get('status') == 'passed'
        )
        audit_subscription_verified = (
            audit_subscription_verification.get('status') == 'passed'
        )
        orders_delivery_verified = (
            orders_delivery_verification.get('status') == 'passed'
        )
        audit_delivery_verified = audit_delivery_verification.get('status') == 'passed'
        subscriptions_verified = (
            orders_subscription_verified and audit_subscription_verified
        )
        deliveries_verified = (
            orders_delivery_verified and audit_delivery_verified
        )
        subscriptions_verification = {
            'status': 'passed',
            'message': 'Both SQS endpoints are confirmed raw-delivery subscribers.',
        }
        publish_verification = {
            'status': 'passed',
            'message': 'The published order event is available in both queues.',
        }
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': (
                topic_verified
                and orders_queue_verified
                and audit_queue_verified
                and orders_policy_verified
                and audit_policy_verified
                and subscriptions_verified
                and deliveries_verified
            ),
            'steps': {
                'create-topic': {
                    'verified': topic_verified,
                    'verification': topic_verification if topic_verified else None,
                },
                'create-orders-queue': {
                    'verified': orders_queue_verified,
                    'verification': (
                        orders_queue_verification
                        if orders_queue_verified
                        else None
                    ),
                },
                'create-audit-queue': {
                    'verified': audit_queue_verified,
                    'verification': (
                        audit_queue_verification if audit_queue_verified else None
                    ),
                },
                'set-orders-queue-policy': {
                    'verified': orders_policy_verified,
                    'verification': (
                        orders_policy_verification
                        if orders_policy_verified
                        else None
                    ),
                },
                'set-audit-queue-policy': {
                    'verified': audit_policy_verified,
                    'verification': (
                        audit_policy_verification
                        if audit_policy_verified
                        else None
                    ),
                },
                'subscribe-orders-queue': {
                    'verified': orders_subscription_verified,
                    'verification': (
                        orders_subscription_verification
                        if orders_subscription_verified
                        else None
                    ),
                },
                'subscribe-audit-queue': {
                    'verified': audit_subscription_verified,
                    'verification': (
                        audit_subscription_verification
                        if audit_subscription_verified
                        else None
                    ),
                },
                'list-subscriptions': {
                    'verified': subscriptions_verified,
                    'verification': (
                        subscriptions_verification
                        if subscriptions_verified
                        else None
                    ),
                },
                'publish-message': {
                    'verified': deliveries_verified,
                    'verification': (
                        publish_verification if deliveries_verified else None
                    ),
                },
                'receive-orders-copy': {
                    'verified': orders_delivery_verified,
                    'verification': (
                        orders_delivery_verification
                        if orders_delivery_verified
                        else None
                    ),
                },
                'receive-audit-copy': {
                    'verified': audit_delivery_verified,
                    'verification': (
                        audit_delivery_verification
                        if audit_delivery_verified
                        else None
                    ),
                },
            },
        }

    if service_key == 'sns' and lab_key == 'filter-policies':
        topic_verification = _verify_sns_filter_topic()
        created_queue_verification = _verify_sns_filter_queue(
            SNS_FILTER_CREATED_QUEUE_NAME,
            SNS_FILTER_CREATED_QUEUE_ARN,
        )
        priority_queue_verification = _verify_sns_filter_queue(
            SNS_FILTER_PRIORITY_QUEUE_NAME,
            SNS_FILTER_PRIORITY_QUEUE_ARN,
        )
        created_policy_verification = _verify_sns_filter_queue_policy(
            SNS_FILTER_CREATED_QUEUE_NAME,
            SNS_FILTER_CREATED_QUEUE_ARN,
        )
        priority_policy_verification = _verify_sns_filter_queue_policy(
            SNS_FILTER_PRIORITY_QUEUE_NAME,
            SNS_FILTER_PRIORITY_QUEUE_ARN,
        )
        created_subscription_verification = _verify_sns_filter_subscription(
            SNS_FILTER_CREATED_QUEUE_ARN,
            SNS_FILTER_CREATED_POLICY,
        )
        priority_subscription_verification = _verify_sns_filter_subscription(
            SNS_FILTER_PRIORITY_QUEUE_ARN,
            SNS_FILTER_PRIORITY_POLICY,
        )
        created_route_verification = _verify_sns_filter_route(
            SNS_FILTER_CREATED_QUEUE_NAME,
            SNS_FILTER_CREATED_MESSAGE_TEXT,
            SNS_FILTER_PRIORITY_MESSAGE_TEXT,
        )
        priority_route_verification = _verify_sns_filter_route(
            SNS_FILTER_PRIORITY_QUEUE_NAME,
            SNS_FILTER_PRIORITY_MESSAGE_TEXT,
            SNS_FILTER_CREATED_MESSAGE_TEXT,
        )
        verifications = {
            'topic': topic_verification,
            'created_queue': created_queue_verification,
            'priority_queue': priority_queue_verification,
            'created_policy': created_policy_verification,
            'priority_policy': priority_policy_verification,
            'created_subscription': created_subscription_verification,
            'priority_subscription': priority_subscription_verification,
            'created_route': created_route_verification,
            'priority_route': priority_route_verification,
        }
        verified = {
            key: value.get('status') == 'passed'
            for key, value in verifications.items()
        }
        filters_verified = (
            verified['created_subscription']
            and verified['priority_subscription']
        )
        routes_verified = (
            verified['created_route']
            and verified['priority_route']
        )
        filter_verification = {
            'status': 'passed',
            'message': 'Both message-attribute subscription filters are active.',
        }
        publish_verification = {
            'status': 'passed',
            'message': 'Both attributed events were routed to their matching queues.',
        }
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': all(verified.values()),
            'steps': {
                'create-topic': {
                    'verified': verified['topic'],
                    'verification': topic_verification if verified['topic'] else None,
                },
                'create-created-queue': {
                    'verified': verified['created_queue'],
                    'verification': (
                        created_queue_verification
                        if verified['created_queue']
                        else None
                    ),
                },
                'create-priority-queue': {
                    'verified': verified['priority_queue'],
                    'verification': (
                        priority_queue_verification
                        if verified['priority_queue']
                        else None
                    ),
                },
                'set-created-queue-policy': {
                    'verified': verified['created_policy'],
                    'verification': (
                        created_policy_verification
                        if verified['created_policy']
                        else None
                    ),
                },
                'set-priority-queue-policy': {
                    'verified': verified['priority_policy'],
                    'verification': (
                        priority_policy_verification
                        if verified['priority_policy']
                        else None
                    ),
                },
                'subscribe-created-filter': {
                    'verified': verified['created_subscription'],
                    'verification': (
                        created_subscription_verification
                        if verified['created_subscription']
                        else None
                    ),
                },
                'subscribe-priority-filter': {
                    'verified': verified['priority_subscription'],
                    'verification': (
                        priority_subscription_verification
                        if verified['priority_subscription']
                        else None
                    ),
                },
                'inspect-filter-policies': {
                    'verified': filters_verified,
                    'verification': (
                        filter_verification if filters_verified else None
                    ),
                },
                'publish-created-event': {
                    'verified': routes_verified,
                    'verification': (
                        publish_verification if routes_verified else None
                    ),
                },
                'publish-priority-event': {
                    'verified': routes_verified,
                    'verification': (
                        publish_verification if routes_verified else None
                    ),
                },
                'receive-created-route': {
                    'verified': verified['created_route'],
                    'verification': (
                        created_route_verification
                        if verified['created_route']
                        else None
                    ),
                },
                'receive-priority-route': {
                    'verified': verified['priority_route'],
                    'verification': (
                        priority_route_verification
                        if verified['priority_route']
                        else None
                    ),
                },
            },
        }

    if service_key == 'scheduler' and lab_key == 'sqs-delivery':
        queue_verification = _verify_scheduler_queue()
        role_verification = _verify_scheduler_role()
        policy_verification = _verify_scheduler_role_policy()
        group_verification = _verify_scheduler_group()
        delivery_verification = _verify_scheduler_delivery()
        deleted_verification = _verify_scheduler_deleted()
        queue_verified = queue_verification.get('status') == 'passed'
        role_verified = role_verification.get('status') == 'passed'
        policy_verified = policy_verification.get('status') == 'passed'
        group_verified = group_verification.get('status') == 'passed'
        delivery_verified = delivery_verification.get('status') == 'passed'
        deleted_verified = deleted_verification.get('status') == 'passed'
        created_verified = bool(cache.get(SCHEDULER_CREATED_CACHE_KEY))
        created_verification = {
            'status': 'passed',
            'message': 'The one-time schedule was created with the verified target settings.',
        }
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': (
                queue_verified
                and role_verified
                and policy_verified
                and group_verified
                and created_verified
                and delivery_verified
                and deleted_verified
            ),
            'steps': {
                'create-queue': {
                    'verified': queue_verified,
                    'verification': queue_verification if queue_verified else None,
                },
                'create-role': {
                    'verified': role_verified,
                    'verification': role_verification if role_verified else None,
                },
                'put-role-policy': {
                    'verified': policy_verified,
                    'verification': policy_verification if policy_verified else None,
                },
                'create-schedule-group': {
                    'verified': group_verified,
                    'verification': group_verification if group_verified else None,
                },
                'create-schedule': {
                    'verified': created_verified,
                    'verification': (
                        created_verification if created_verified else None
                    ),
                },
                'get-schedule': {
                    'verified': created_verified,
                    'verification': (
                        created_verification if created_verified else None
                    ),
                },
                'receive-scheduled-message': {
                    'verified': delivery_verified,
                    'verification': (
                        delivery_verification if delivery_verified else None
                    ),
                },
                'confirm-schedule-deleted': {
                    'verified': deleted_verified,
                    'verification': (
                        deleted_verification if deleted_verified else None
                    ),
                },
            },
        }

    if service_key == 'cloudformation' and lab_key == 's3-sqs-stack':
        deleted_verification = _verify_cloudformation_deleted()
        deleted_verified = deleted_verification.get('status') == 'passed'
        created_verified = bool(cache.get(CLOUDFORMATION_CREATED_CACHE_KEY))
        inspected_verified = bool(cache.get(CLOUDFORMATION_INSPECTED_CACHE_KEY))
        created_verification = {
            'status': 'passed',
            'message': 'The stack reached CREATE_COMPLETE with verified outputs.',
        }
        inspected_verification = {
            'status': 'passed',
            'message': 'Stack resources, events, and underlying services were inspected.',
        }
        if deleted_verified:
            stack_verified = created_verified
            resources_verified = inspected_verified
            events_verified = inspected_verified
            services_verified = inspected_verified
        else:
            stack_verified = _verify_cloudformation_stack().get('status') == 'passed'
            resources_verified = (
                _verify_cloudformation_resources().get('status') == 'passed'
            )
            events_verified = (
                _verify_cloudformation_events().get('status') == 'passed'
            )
            services_verified = (
                _verify_cloudformation_service_resources().get('status')
                == 'passed'
            )
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': (
                created_verified
                and inspected_verified
                and deleted_verified
            ),
            'steps': {
                'validate-template': {
                    'verified': created_verified,
                    'verification': (
                        created_verification if created_verified else None
                    ),
                },
                'create-stack': {
                    'verified': created_verified,
                    'verification': (
                        created_verification if created_verified else None
                    ),
                },
                'describe-stack': {
                    'verified': stack_verified,
                    'verification': (
                        created_verification if stack_verified else None
                    ),
                },
                'describe-stack-resources': {
                    'verified': resources_verified,
                    'verification': (
                        inspected_verification if resources_verified else None
                    ),
                },
                'describe-stack-events': {
                    'verified': events_verified,
                    'verification': (
                        inspected_verification if events_verified else None
                    ),
                },
                'inspect-provisioned-resources': {
                    'verified': services_verified,
                    'verification': (
                        inspected_verification if services_verified else None
                    ),
                },
                'delete-stack': {
                    'verified': deleted_verified,
                    'verification': (
                        deleted_verification if deleted_verified else None
                    ),
                },
                'confirm-resources-deleted': {
                    'verified': deleted_verified,
                    'verification': (
                        deleted_verification if deleted_verified else None
                    ),
                },
            },
        }

    if service_key == 'ec2' and lab_key == 'vpc-public-private':
        vpc_verification = _verify_ec2_vpc()
        public_subnet_verification, private_subnet_verification = (
            _verify_ec2_subnets()
        )
        igw_verification = _verify_ec2_igw()
        public_route_verification, private_route_verification = (
            _verify_ec2_routes()
        )
        vpc_verified = vpc_verification.get('status') == 'passed'
        public_subnet_verified = (
            public_subnet_verification.get('status') == 'passed'
        )
        private_subnet_verified = (
            private_subnet_verification.get('status') == 'passed'
        )
        igw_verified = igw_verification.get('status') == 'passed'
        public_route_verified = (
            public_route_verification.get('status') == 'passed'
        )
        private_route_verified = (
            private_route_verification.get('status') == 'passed'
        )
        topology_verified = all([
            vpc_verified,
            public_subnet_verified,
            private_subnet_verified,
            igw_verified,
            public_route_verified,
            private_route_verified,
        ])
        topology_verification = {
            'status': 'passed',
            'message': 'The public and private subnet routing topology is complete.',
        }
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': topology_verified,
            'steps': {
                'create-vpc': {
                    'verified': vpc_verified,
                    'verification': vpc_verification if vpc_verified else None,
                },
                'create-public-subnet': {
                    'verified': public_subnet_verified,
                    'verification': (
                        public_subnet_verification
                        if public_subnet_verified else None
                    ),
                },
                'enable-public-ip': {
                    'verified': public_subnet_verified,
                    'verification': (
                        public_subnet_verification
                        if public_subnet_verified else None
                    ),
                },
                'create-private-subnet': {
                    'verified': private_subnet_verified,
                    'verification': (
                        private_subnet_verification
                        if private_subnet_verified else None
                    ),
                },
                'create-internet-gateway': {
                    'verified': igw_verified,
                    'verification': igw_verification if igw_verified else None,
                },
                'attach-internet-gateway': {
                    'verified': igw_verified,
                    'verification': igw_verification if igw_verified else None,
                },
                'create-public-route-table': {
                    'verified': public_route_verified,
                    'verification': (
                        public_route_verification
                        if public_route_verified else None
                    ),
                },
                'create-internet-route': {
                    'verified': public_route_verified,
                    'verification': (
                        public_route_verification
                        if public_route_verified else None
                    ),
                },
                'associate-public-route-table': {
                    'verified': public_route_verified,
                    'verification': (
                        public_route_verification
                        if public_route_verified else None
                    ),
                },
                'create-private-route-table': {
                    'verified': private_route_verified,
                    'verification': (
                        private_route_verification
                        if private_route_verified else None
                    ),
                },
                'associate-private-route-table': {
                    'verified': private_route_verified,
                    'verification': (
                        private_route_verification
                        if private_route_verified else None
                    ),
                },
                'inspect-network-topology': {
                    'verified': topology_verified,
                    'verification': (
                        topology_verification if topology_verified else None
                    ),
                },
            },
        }

    if service_key == 'ec2' and lab_key == 'security-controls':
        vpc_verification = _verify_ec2_security_vpc()
        subnet_verification = _verify_ec2_security_subnet()
        web_verification, app_verification = _verify_ec2_security_group_rules()
        nacl_verification = _verify_ec2_nacl_boundary()
        vpc_verified = vpc_verification.get('status') == 'passed'
        subnet_verified = subnet_verification.get('status') == 'passed'
        web_verified = web_verification.get('status') == 'passed'
        app_verified = app_verification.get('status') == 'passed'
        nacl_verified = nacl_verification.get('status') == 'passed'
        groups_verified = web_verified and app_verified
        groups_verification = {
            'status': 'passed',
            'message': 'Both stateful security-group trust boundaries are active.',
        }
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': (
                vpc_verified
                and subnet_verified
                and groups_verified
                and nacl_verified
            ),
            'steps': {
                'create-vpc': {
                    'verified': vpc_verified,
                    'verification': vpc_verification if vpc_verified else None,
                },
                'create-subnet': {
                    'verified': subnet_verified,
                    'verification': (
                        subnet_verification if subnet_verified else None
                    ),
                },
                'create-web-security-group': {
                    'verified': web_verified,
                    'verification': web_verification if web_verified else None,
                },
                'allow-trusted-https': {
                    'verified': web_verified,
                    'verification': web_verification if web_verified else None,
                },
                'create-app-security-group': {
                    'verified': app_verified,
                    'verification': app_verification if app_verified else None,
                },
                'allow-web-to-app': {
                    'verified': app_verified,
                    'verification': app_verification if app_verified else None,
                },
                'inspect-security-groups': {
                    'verified': groups_verified,
                    'verification': (
                        groups_verification if groups_verified else None
                    ),
                },
                'inspect-network-acl-support': {
                    'verified': nacl_verified,
                    'verification': nacl_verification if nacl_verified else None,
                },
            },
        }

    if service_key == 'ec2' and lab_key == 's3-gateway-endpoint':
        verifications = {
            'vpc': _verify_ec2_endpoint_vpc(),
            'subnet': _verify_ec2_endpoint_subnet(),
            'route': _verify_ec2_endpoint_route_table(),
            'bucket': _verify_ec2_endpoint_bucket(),
            'endpoint': _verify_ec2_s3_gateway_endpoint(),
            'boundary': _verify_ec2_endpoint_route_boundary(),
        }
        passed = {
            key: value.get('status') == 'passed'
            for key, value in verifications.items()
        }
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': all(passed.values()),
            'steps': {
                'create-vpc': {'verified': passed['vpc'], 'verification': verifications['vpc'] if passed['vpc'] else None},
                'create-private-subnet': {'verified': passed['subnet'], 'verification': verifications['subnet'] if passed['subnet'] else None},
                'create-private-route-table': {'verified': passed['route'], 'verification': verifications['route'] if passed['route'] else None},
                'associate-private-route-table': {'verified': passed['route'], 'verification': verifications['route'] if passed['route'] else None},
                'create-s3-bucket': {'verified': passed['bucket'], 'verification': verifications['bucket'] if passed['bucket'] else None},
                'create-s3-gateway-endpoint': {'verified': passed['endpoint'], 'verification': verifications['endpoint'] if passed['endpoint'] else None},
                'inspect-private-s3-path': {
                    'verified': passed['endpoint'] and passed['route'] and passed['bucket'] and passed['boundary'],
                    'verification': verifications['boundary'] if passed['boundary'] else None,
                },
            },
        }

    if service_key == 'ec2' and lab_key == 'sqs-interface-endpoint':
        verifications = {
            'vpc': _verify_ec2_interface_vpc(),
            'subnet': _verify_ec2_interface_subnet(),
            'security_group': _verify_ec2_interface_security_group(),
            'queue': _verify_ec2_interface_queue(),
            'endpoint': _verify_ec2_sqs_interface_endpoint(),
            'inspection': _verify_ec2_interface_inspection(),
        }
        passed = {
            key: value.get('status') == 'passed'
            for key, value in verifications.items()
        }
        return {
            'service': service_key,
            'lab': lab_key,
            'complete': all(passed.values()),
            'steps': {
                'create-vpc': {'verified': passed['vpc'], 'verification': verifications['vpc'] if passed['vpc'] else None},
                'create-private-subnet': {'verified': passed['subnet'], 'verification': verifications['subnet'] if passed['subnet'] else None},
                'create-endpoint-security-group': {'verified': passed['security_group'], 'verification': verifications['security_group'] if passed['security_group'] else None},
                'allow-vpc-https': {'verified': passed['security_group'], 'verification': verifications['security_group'] if passed['security_group'] else None},
                'create-sqs-queue': {'verified': passed['queue'], 'verification': verifications['queue'] if passed['queue'] else None},
                'create-sqs-interface-endpoint': {'verified': passed['endpoint'], 'verification': verifications['endpoint'] if passed['endpoint'] else None},
                'inspect-private-sqs-path': {
                    'verified': passed['endpoint'] and passed['queue'] and passed['inspection'],
                    'verification': verifications['inspection'] if passed['inspection'] else None,
                },
            },
        }

    return {
        'service': service_key,
        'lab': lab_key,
        'complete': False,
        'steps': {},
    }


def reset_lab(service_key: str, lab_key: str) -> dict[str, Any]:
    lab = get_lab(service_key, lab_key)
    if not lab:
        raise ValueError('Lab not found')

    if service_key == 'iam' and lab_key == 'create-user-alice':
        return _reset_iam_create_user_alice()

    if service_key == 'iam' and lab_key == 'attach-policy-alice':
        return _reset_iam_attach_policy_alice()

    if service_key == 'iam' and lab_key == 'access-key-alice':
        return _reset_iam_access_key_alice()

    if service_key == 'iam' and lab_key == 'group-membership-alice':
        return _reset_iam_group_membership_alice()

    if service_key == 'iam' and lab_key == 'group-policy-floci-developers':
        return _reset_iam_group_policy_floci_developers()

    if service_key == 'iam' and lab_key == 'inline-policy-alice':
        return _reset_iam_inline_policy_alice()

    if service_key == 'iam' and lab_key == 'role-trust-policy':
        return _reset_iam_role_trust_policy()

    if service_key == 'iam' and lab_key == 'ec2-instance-profile':
        return _reset_iam_ec2_instance_profile()

    if service_key == 's3' and lab_key == 'create-bucket':
        return _reset_s3_create_bucket()

    if service_key == 's3' and lab_key == 'object-workflow':
        return _reset_s3_object_workflow()

    if service_key == 's3' and lab_key == 'prefix-copy':
        return _reset_s3_prefix_copy()

    if service_key == 's3' and lab_key == 'metadata-tags':
        return _reset_s3_metadata_tags()

    if service_key == 's3' and lab_key == 'version-recovery':
        return _reset_s3_version_recovery()

    if service_key == 's3' and lab_key == 'presigned-url':
        return _reset_s3_presigned_url()

    if service_key == 's3' and lab_key == 'bucket-security':
        return _reset_s3_bucket_security()

    if service_key == 's3' and lab_key == 'default-encryption':
        return _reset_s3_default_encryption()

    if service_key == 's3' and lab_key == 'lifecycle-retention':
        return _reset_s3_lifecycle_retention()

    if service_key == 's3' and lab_key == 'bucket-cors':
        return _reset_s3_bucket_cors()

    if service_key == 's3' and lab_key == 'object-notifications-sqs':
        return _reset_s3_object_notifications()

    if service_key == 's3' and lab_key == 'multipart-upload':
        return _reset_s3_multipart_upload()

    if service_key == 'sqs' and lab_key == 'create-queue':
        return _reset_sqs_create_queue()

    if service_key == 'sqs' and lab_key == 'message-lifecycle':
        return _reset_sqs_message_lifecycle()

    if service_key == 'sqs' and lab_key == 'visibility-timeout':
        return _reset_sqs_visibility_timeout()

    if service_key == 'sqs' and lab_key == 'delayed-message':
        return _reset_sqs_delayed_message()

    if service_key == 'sqs' and lab_key == 'batch-messages':
        return _reset_sqs_batch_messages()

    if service_key == 'sqs' and lab_key == 'queue-configuration':
        return _reset_sqs_queue_configuration()

    if service_key == 'sqs' and lab_key == 'dead-letter-redrive':
        return _reset_sqs_dead_letter_redrive()

    if service_key == 'sqs' and lab_key == 'fifo-ordering':
        return _reset_sqs_fifo_ordering()

    if service_key == 'sqs' and lab_key == 'purge-delete':
        return _reset_sqs_purge_delete()

    if service_key == 'sns' and lab_key == 'sqs-fanout':
        return _reset_sns_sqs_fanout()

    if service_key == 'sns' and lab_key == 'filter-policies':
        return _reset_sns_filter_policies()

    if service_key == 'scheduler' and lab_key == 'sqs-delivery':
        return _reset_scheduler_sqs_delivery()

    if service_key == 'cloudformation' and lab_key == 's3-sqs-stack':
        return _reset_cloudformation_s3_sqs()

    if service_key == 'ec2' and lab_key == 'vpc-public-private':
        return _reset_ec2_vpc_networking()

    if service_key == 'ec2' and lab_key == 'security-controls':
        return _reset_ec2_security_controls()

    if service_key == 'ec2' and lab_key == 's3-gateway-endpoint':
        return _reset_ec2_s3_gateway_endpoint()

    if service_key == 'ec2' and lab_key == 'sqs-interface-endpoint':
        return _reset_ec2_sqs_interface_endpoint()

    raise ValueError('Lab reset not found')


def _run_iam_create_user_alice(lab_key: str = 'create-user-alice') -> dict[str, Any]:
    user_name = 'Alice'
    command = 'aws iam create-user --user-name Alice'
    started = time.perf_counter()

    try:
        response = _iam_client().create_user(UserName=user_name)
    except ClientError as exc:
        if _error_code(exc) != 'EntityAlreadyExists':
            raise
        response = _iam_client().get_user(UserName=user_name)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_iam_user(user_name)

    return {
        'service': 'iam',
        'lab': lab_key,
        'step': 'create-user',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _reset_iam_create_user_alice() -> dict[str, Any]:
    user_name = 'Alice'
    command = 'aws iam delete-user --user-name Alice'
    started = time.perf_counter()
    deleted = False

    try:
        _iam_client().delete_user(UserName=user_name)
        deleted = True
        stdout = _json_text({})
        stderr = ''
        exit_code = 0
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') != 'NoSuchEntity':
            raise
        stdout = _json_text({})
        stderr = 'User Alice did not exist.'
        exit_code = 0

    duration_ms = round((time.perf_counter() - started) * 1000)

    return {
        'service': 'iam',
        'lab': 'create-user-alice',
        'command': command,
        'exit_code': exit_code,
        'stdout': stdout,
        'stderr': stderr,
        'json': {},
        'duration_ms': duration_ms,
        'reset': True,
        'deleted': deleted,
        'verification': {
            'status': 'passed',
            'message': 'User Alice was removed.' if deleted else 'User Alice was already absent.',
        },
    }


def _run_iam_create_alice_policy() -> dict[str, Any]:
    command = 'aws iam create-policy --policy-name AliceListBucketsPolicy --policy-document file://alice-list-buckets-policy.json'
    started = time.perf_counter()
    try:
        response = _iam_client().create_policy(
            PolicyName=ALICE_POLICY_NAME,
            PolicyDocument=json.dumps(ALICE_LIST_BUCKETS_POLICY),
        )
    except ClientError as exc:
        if _error_code(exc) != 'EntityAlreadyExists':
            raise
        response = _iam_client().get_policy(PolicyArn=ALICE_POLICY_ARN)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_alice_policy()

    return {
        'service': 'iam',
        'lab': 'attach-policy-alice',
        'step': 'create-policy',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_attach_alice_policy() -> dict[str, Any]:
    command = f'aws iam attach-user-policy --user-name Alice --policy-arn {ALICE_POLICY_ARN}'
    started = time.perf_counter()
    _iam_client().attach_user_policy(UserName=ALICE_USER_NAME, PolicyArn=ALICE_POLICY_ARN)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_alice_policy_attachment()

    return {
        'service': 'iam',
        'lab': 'attach-policy-alice',
        'step': 'attach-policy',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({}),
        'stderr': '',
        'json': {},
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_list_alice_attached_policies() -> dict[str, Any]:
    command = 'aws iam list-attached-user-policies --user-name Alice'
    started = time.perf_counter()
    response = _iam_client().list_attached_user_policies(UserName=ALICE_USER_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_alice_policy_attachment()

    return {
        'service': 'iam',
        'lab': 'attach-policy-alice',
        'step': 'list-attached-policies',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_create_alice_access_key() -> dict[str, Any]:
    command = 'aws iam create-access-key --user-name Alice'
    started = time.perf_counter()
    response = _iam_client().create_access_key(UserName=ALICE_USER_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_alice_access_key()

    return {
        'service': 'iam',
        'lab': 'access-key-alice',
        'step': 'create-access-key',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_list_alice_access_keys() -> dict[str, Any]:
    command = 'aws iam list-access-keys --user-name Alice'
    started = time.perf_counter()
    response = _iam_client().list_access_keys(UserName=ALICE_USER_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_alice_access_key()

    return {
        'service': 'iam',
        'lab': 'access-key-alice',
        'step': 'list-access-keys',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_create_floci_developers_group(lab_key: str = 'group-membership-alice') -> dict[str, Any]:
    command = f'aws iam create-group --group-name {FLOCI_DEVELOPERS_GROUP_NAME}'
    started = time.perf_counter()
    try:
        response = _iam_client().create_group(GroupName=FLOCI_DEVELOPERS_GROUP_NAME)
    except ClientError as exc:
        if _error_code(exc) != 'EntityAlreadyExists':
            raise
        response = _iam_client().get_group(GroupName=FLOCI_DEVELOPERS_GROUP_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_floci_developers_group()

    return {
        'service': 'iam',
        'lab': lab_key,
        'step': 'create-group',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_add_alice_to_floci_developers_group(lab_key: str = 'group-membership-alice') -> dict[str, Any]:
    command = f'aws iam add-user-to-group --group-name {FLOCI_DEVELOPERS_GROUP_NAME} --user-name Alice'
    started = time.perf_counter()
    _iam_client().add_user_to_group(GroupName=FLOCI_DEVELOPERS_GROUP_NAME, UserName=ALICE_USER_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_alice_group_membership()

    return {
        'service': 'iam',
        'lab': lab_key,
        'step': 'add-user-to-group',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({}),
        'stderr': '',
        'json': {},
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_create_floci_developers_policy() -> dict[str, Any]:
    command = f'aws iam create-policy --policy-name {FLOCI_DEVELOPERS_POLICY_NAME} --policy-document file://floci-developers-list-buckets-policy.json'
    started = time.perf_counter()
    try:
        response = _iam_client().create_policy(
            PolicyName=FLOCI_DEVELOPERS_POLICY_NAME,
            PolicyDocument=json.dumps(ALICE_LIST_BUCKETS_POLICY),
        )
    except ClientError as exc:
        if _error_code(exc) != 'EntityAlreadyExists':
            raise
        response = _iam_client().get_policy(PolicyArn=FLOCI_DEVELOPERS_POLICY_ARN)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_floci_developers_policy()

    return {
        'service': 'iam',
        'lab': 'group-policy-floci-developers',
        'step': 'create-policy',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_attach_floci_developers_policy() -> dict[str, Any]:
    command = f'aws iam attach-group-policy --group-name {FLOCI_DEVELOPERS_GROUP_NAME} --policy-arn {FLOCI_DEVELOPERS_POLICY_ARN}'
    started = time.perf_counter()
    _iam_client().attach_group_policy(
        GroupName=FLOCI_DEVELOPERS_GROUP_NAME,
        PolicyArn=FLOCI_DEVELOPERS_POLICY_ARN,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_floci_developers_policy_attachment()

    return {
        'service': 'iam',
        'lab': 'group-policy-floci-developers',
        'step': 'attach-group-policy',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({}),
        'stderr': '',
        'json': {},
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_list_floci_developers_attached_policies() -> dict[str, Any]:
    command = f'aws iam list-attached-group-policies --group-name {FLOCI_DEVELOPERS_GROUP_NAME}'
    started = time.perf_counter()
    response = _iam_client().list_attached_group_policies(GroupName=FLOCI_DEVELOPERS_GROUP_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_floci_developers_policy_attachment()

    return {
        'service': 'iam',
        'lab': 'group-policy-floci-developers',
        'step': 'list-attached-group-policies',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_put_alice_inline_policy() -> dict[str, Any]:
    command = f'aws iam put-user-policy --user-name Alice --policy-name {ALICE_INLINE_POLICY_NAME} --policy-document file://alice-inline-list-buckets-policy.json'
    started = time.perf_counter()
    _iam_client().put_user_policy(
        UserName=ALICE_USER_NAME,
        PolicyName=ALICE_INLINE_POLICY_NAME,
        PolicyDocument=json.dumps(ALICE_LIST_BUCKETS_POLICY),
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_alice_inline_policy()

    return {
        'service': 'iam',
        'lab': 'inline-policy-alice',
        'step': 'put-user-policy',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({}),
        'stderr': '',
        'json': {},
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_list_alice_inline_policies() -> dict[str, Any]:
    command = 'aws iam list-user-policies --user-name Alice'
    started = time.perf_counter()
    response = _iam_client().list_user_policies(UserName=ALICE_USER_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_alice_inline_policy()

    return {
        'service': 'iam',
        'lab': 'inline-policy-alice',
        'step': 'list-user-policies',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_get_alice_inline_policy() -> dict[str, Any]:
    command = f'aws iam get-user-policy --user-name Alice --policy-name {ALICE_INLINE_POLICY_NAME}'
    started = time.perf_counter()
    response = _iam_client().get_user_policy(
        UserName=ALICE_USER_NAME,
        PolicyName=ALICE_INLINE_POLICY_NAME,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_alice_inline_policy()

    return {
        'service': 'iam',
        'lab': 'inline-policy-alice',
        'step': 'get-user-policy',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_create_role(
    *,
    lab_key: str,
    role_name: str,
    trust_policy: dict[str, Any],
    artifact_name: str,
    trusted_service: str,
) -> dict[str, Any]:
    command = f'aws iam create-role --role-name {role_name} --assume-role-policy-document file://{artifact_name}'
    started = time.perf_counter()
    try:
        response = _iam_client().create_role(
            RoleName=role_name,
            AssumeRolePolicyDocument=json.dumps(trust_policy),
        )
    except ClientError as exc:
        if _error_code(exc) != 'EntityAlreadyExists':
            raise
        response = _iam_client().get_role(RoleName=role_name)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_role(role_name, trusted_service)

    return {
        'service': 'iam',
        'lab': lab_key,
        'step': 'create-role',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_create_application_role() -> dict[str, Any]:
    return _run_iam_create_role(
        lab_key='role-trust-policy',
        role_name=FLOCI_APPLICATION_ROLE_NAME,
        trust_policy=FLOCI_APPLICATION_TRUST_POLICY,
        artifact_name='floci-application-role-trust-policy.json',
        trusted_service='lambda.amazonaws.com',
    )


def _run_iam_get_application_role() -> dict[str, Any]:
    command = f'aws iam get-role --role-name {FLOCI_APPLICATION_ROLE_NAME}'
    started = time.perf_counter()
    response = _iam_client().get_role(RoleName=FLOCI_APPLICATION_ROLE_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_role(FLOCI_APPLICATION_ROLE_NAME, 'lambda.amazonaws.com')

    return {
        'service': 'iam',
        'lab': 'role-trust-policy',
        'step': 'get-role',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_put_application_role_policy() -> dict[str, Any]:
    command = (
        f'aws iam put-role-policy --role-name {FLOCI_APPLICATION_ROLE_NAME} '
        f'--policy-name {FLOCI_APPLICATION_ROLE_POLICY_NAME} '
        '--policy-document file://floci-application-list-buckets-policy.json'
    )
    started = time.perf_counter()
    _iam_client().put_role_policy(
        RoleName=FLOCI_APPLICATION_ROLE_NAME,
        PolicyName=FLOCI_APPLICATION_ROLE_POLICY_NAME,
        PolicyDocument=json.dumps(ALICE_LIST_BUCKETS_POLICY),
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_application_role_policy()

    return {
        'service': 'iam',
        'lab': 'role-trust-policy',
        'step': 'put-role-policy',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({}),
        'stderr': '',
        'json': {},
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_get_application_role_policy() -> dict[str, Any]:
    command = (
        f'aws iam get-role-policy --role-name {FLOCI_APPLICATION_ROLE_NAME} '
        f'--policy-name {FLOCI_APPLICATION_ROLE_POLICY_NAME}'
    )
    started = time.perf_counter()
    response = _iam_client().get_role_policy(
        RoleName=FLOCI_APPLICATION_ROLE_NAME,
        PolicyName=FLOCI_APPLICATION_ROLE_POLICY_NAME,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_application_role_policy()

    return {
        'service': 'iam',
        'lab': 'role-trust-policy',
        'step': 'get-role-policy',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_create_ec2_role() -> dict[str, Any]:
    return _run_iam_create_role(
        lab_key='ec2-instance-profile',
        role_name=FLOCI_EC2_ROLE_NAME,
        trust_policy=FLOCI_EC2_TRUST_POLICY,
        artifact_name='floci-ec2-role-trust-policy.json',
        trusted_service='ec2.amazonaws.com',
    )


def _run_iam_create_ec2_instance_profile() -> dict[str, Any]:
    command = f'aws iam create-instance-profile --instance-profile-name {FLOCI_EC2_INSTANCE_PROFILE_NAME}'
    started = time.perf_counter()
    try:
        response = _iam_client().create_instance_profile(
            InstanceProfileName=FLOCI_EC2_INSTANCE_PROFILE_NAME,
        )
    except ClientError as exc:
        if _error_code(exc) != 'EntityAlreadyExists':
            raise
        response = _iam_client().get_instance_profile(
            InstanceProfileName=FLOCI_EC2_INSTANCE_PROFILE_NAME,
        )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_ec2_instance_profile()

    return {
        'service': 'iam',
        'lab': 'ec2-instance-profile',
        'step': 'create-instance-profile',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_add_ec2_role_to_instance_profile() -> dict[str, Any]:
    command = (
        f'aws iam add-role-to-instance-profile --instance-profile-name {FLOCI_EC2_INSTANCE_PROFILE_NAME} '
        f'--role-name {FLOCI_EC2_ROLE_NAME}'
    )
    started = time.perf_counter()
    existing = _verify_ec2_role_profile_association()
    if existing.get('status') != 'passed':
        _iam_client().add_role_to_instance_profile(
            InstanceProfileName=FLOCI_EC2_INSTANCE_PROFILE_NAME,
            RoleName=FLOCI_EC2_ROLE_NAME,
        )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_ec2_role_profile_association()

    return {
        'service': 'iam',
        'lab': 'ec2-instance-profile',
        'step': 'add-role-to-instance-profile',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({}),
        'stderr': '',
        'json': {},
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_get_ec2_instance_profile() -> dict[str, Any]:
    command = f'aws iam get-instance-profile --instance-profile-name {FLOCI_EC2_INSTANCE_PROFILE_NAME}'
    started = time.perf_counter()
    response = _iam_client().get_instance_profile(
        InstanceProfileName=FLOCI_EC2_INSTANCE_PROFILE_NAME,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_ec2_role_profile_association()

    return {
        'service': 'iam',
        'lab': 'ec2-instance-profile',
        'step': 'get-instance-profile',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_list_instance_profiles_for_ec2_role() -> dict[str, Any]:
    command = f'aws iam list-instance-profiles-for-role --role-name {FLOCI_EC2_ROLE_NAME}'
    started = time.perf_counter()
    response = _iam_client().list_instance_profiles_for_role(RoleName=FLOCI_EC2_ROLE_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_ec2_role_profile_association()

    return {
        'service': 'iam',
        'lab': 'ec2-instance-profile',
        'step': 'list-instance-profiles-for-role',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_create_bucket() -> dict[str, Any]:
    command = f'aws s3api create-bucket --bucket {S3_BASICS_BUCKET_NAME}'
    started = time.perf_counter()
    try:
        response = _s3_client().create_bucket(Bucket=S3_BASICS_BUCKET_NAME)
    except ClientError as exc:
        if _error_code(exc) not in {'BucketAlreadyOwnedByYou', 'BucketAlreadyExists'}:
            raise
        response = _s3_client().head_bucket(Bucket=S3_BASICS_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_bucket()

    return {
        'service': 's3',
        'lab': 'create-bucket',
        'step': 'create-bucket',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_head_bucket() -> dict[str, Any]:
    command = f'aws s3api head-bucket --bucket {S3_BASICS_BUCKET_NAME}'
    started = time.perf_counter()
    response = _s3_client().head_bucket(Bucket=S3_BASICS_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_bucket()

    return {
        'service': 's3',
        'lab': 'create-bucket',
        'step': 'head-bucket',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_list_buckets() -> dict[str, Any]:
    command = 'aws s3api list-buckets'
    started = time.perf_counter()
    response = _s3_client().list_buckets()
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_bucket()

    return {
        'service': 's3',
        'lab': 'create-bucket',
        'step': 'list-buckets',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_create_objects_bucket() -> dict[str, Any]:
    command = f'aws s3api create-bucket --bucket {S3_OBJECTS_BUCKET_NAME}'
    started = time.perf_counter()
    try:
        response = _s3_client().create_bucket(Bucket=S3_OBJECTS_BUCKET_NAME)
    except ClientError as exc:
        if _error_code(exc) not in {'BucketAlreadyOwnedByYou', 'BucketAlreadyExists'}:
            raise
        response = _s3_client().head_bucket(Bucket=S3_OBJECTS_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_objects_bucket()

    return {
        'service': 's3',
        'lab': 'object-workflow',
        'step': 'create-bucket',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_put_hello_object() -> dict[str, Any]:
    command = (
        f'aws s3api put-object --bucket {S3_OBJECTS_BUCKET_NAME} '
        f'--key {S3_HELLO_OBJECT_KEY} --body hello.txt --content-type text/plain'
    )
    started = time.perf_counter()
    response = _s3_client().put_object(
        Bucket=S3_OBJECTS_BUCKET_NAME,
        Key=S3_HELLO_OBJECT_KEY,
        Body=S3_HELLO_OBJECT_BYTES,
        ContentType='text/plain',
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_hello_object()

    return {
        'service': 's3',
        'lab': 'object-workflow',
        'step': 'put-object',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_list_hello_objects() -> dict[str, Any]:
    command = f'aws s3api list-objects-v2 --bucket {S3_OBJECTS_BUCKET_NAME}'
    started = time.perf_counter()
    response = _s3_client().list_objects_v2(Bucket=S3_OBJECTS_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_hello_object()

    return {
        'service': 's3',
        'lab': 'object-workflow',
        'step': 'list-objects',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_head_hello_object() -> dict[str, Any]:
    command = (
        f'aws s3api head-object --bucket {S3_OBJECTS_BUCKET_NAME} '
        f'--key {S3_HELLO_OBJECT_KEY}'
    )
    started = time.perf_counter()
    response = _s3_client().head_object(
        Bucket=S3_OBJECTS_BUCKET_NAME,
        Key=S3_HELLO_OBJECT_KEY,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_hello_object()

    return {
        'service': 's3',
        'lab': 'object-workflow',
        'step': 'head-object',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_get_hello_object() -> dict[str, Any]:
    command = (
        f'aws s3api get-object --bucket {S3_OBJECTS_BUCKET_NAME} '
        f'--key {S3_HELLO_OBJECT_KEY} downloaded-hello.txt'
    )
    started = time.perf_counter()
    response = _s3_client().get_object(
        Bucket=S3_OBJECTS_BUCKET_NAME,
        Key=S3_HELLO_OBJECT_KEY,
    )
    body = response.pop('Body').read()
    display_response = {
        **response,
        'DownloadedFile': 'downloaded-hello.txt',
        'DownloadedBody': body.decode('utf-8'),
    }
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_hello_object()

    return {
        'service': 's3',
        'lab': 'object-workflow',
        'step': 'get-object',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(display_response),
        'stderr': '',
        'json': _clean_response(display_response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_create_prefixes_bucket() -> dict[str, Any]:
    command = f'aws s3api create-bucket --bucket {S3_PREFIXES_BUCKET_NAME}'
    started = time.perf_counter()
    try:
        response = _s3_client().create_bucket(Bucket=S3_PREFIXES_BUCKET_NAME)
    except ClientError as exc:
        if _error_code(exc) not in {'BucketAlreadyOwnedByYou', 'BucketAlreadyExists'}:
            raise
        response = _s3_client().head_bucket(Bucket=S3_PREFIXES_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_prefixes_bucket()

    return {
        'service': 's3',
        'lab': 'prefix-copy',
        'step': 'create-bucket',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_put_source_report() -> dict[str, Any]:
    command = (
        f'aws s3api put-object --bucket {S3_PREFIXES_BUCKET_NAME} '
        f'--key {S3_REPORT_SOURCE_KEY} --body report.txt --content-type text/plain'
    )
    started = time.perf_counter()
    response = _s3_client().put_object(
        Bucket=S3_PREFIXES_BUCKET_NAME,
        Key=S3_REPORT_SOURCE_KEY,
        Body=S3_REPORT_BYTES,
        ContentType='text/plain',
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_report_object(S3_REPORT_SOURCE_KEY)

    return {
        'service': 's3',
        'lab': 'prefix-copy',
        'step': 'put-source-object',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_list_incoming_prefix() -> dict[str, Any]:
    command = f'aws s3api list-objects-v2 --bucket {S3_PREFIXES_BUCKET_NAME} --prefix incoming/'
    started = time.perf_counter()
    response = _s3_client().list_objects_v2(
        Bucket=S3_PREFIXES_BUCKET_NAME,
        Prefix='incoming/',
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_report_object(S3_REPORT_SOURCE_KEY)

    return {
        'service': 's3',
        'lab': 'prefix-copy',
        'step': 'list-incoming-prefix',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_copy_report_to_archive() -> dict[str, Any]:
    command = (
        f'aws s3api copy-object --copy-source {S3_PREFIXES_BUCKET_NAME}/{S3_REPORT_SOURCE_KEY} '
        f'--bucket {S3_PREFIXES_BUCKET_NAME} --key {S3_REPORT_ARCHIVE_KEY}'
    )
    started = time.perf_counter()
    response = _s3_client().copy_object(
        CopySource={
            'Bucket': S3_PREFIXES_BUCKET_NAME,
            'Key': S3_REPORT_SOURCE_KEY,
        },
        Bucket=S3_PREFIXES_BUCKET_NAME,
        Key=S3_REPORT_ARCHIVE_KEY,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_report_object(S3_REPORT_ARCHIVE_KEY)

    return {
        'service': 's3',
        'lab': 'prefix-copy',
        'step': 'copy-object',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_list_archive_prefix() -> dict[str, Any]:
    command = f'aws s3api list-objects-v2 --bucket {S3_PREFIXES_BUCKET_NAME} --prefix archive/'
    started = time.perf_counter()
    response = _s3_client().list_objects_v2(
        Bucket=S3_PREFIXES_BUCKET_NAME,
        Prefix='archive/',
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_report_object(S3_REPORT_ARCHIVE_KEY)

    return {
        'service': 's3',
        'lab': 'prefix-copy',
        'step': 'list-archive-prefix',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_create_metadata_bucket() -> dict[str, Any]:
    command = f'aws s3api create-bucket --bucket {S3_METADATA_BUCKET_NAME}'
    started = time.perf_counter()
    try:
        response = _s3_client().create_bucket(Bucket=S3_METADATA_BUCKET_NAME)
    except ClientError as exc:
        if _error_code(exc) not in {'BucketAlreadyOwnedByYou', 'BucketAlreadyExists'}:
            raise
        response = _s3_client().head_bucket(Bucket=S3_METADATA_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_metadata_bucket()

    return {
        'service': 's3',
        'lab': 'metadata-tags',
        'step': 'create-bucket',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_put_invoice_object() -> dict[str, Any]:
    command = (
        f'aws s3api put-object --bucket {S3_METADATA_BUCKET_NAME} '
        f'--key {S3_INVOICE_OBJECT_KEY} --body invoice.txt --content-type text/plain '
        '--metadata project=floci,classification=internal'
    )
    started = time.perf_counter()
    response = _s3_client().put_object(
        Bucket=S3_METADATA_BUCKET_NAME,
        Key=S3_INVOICE_OBJECT_KEY,
        Body=S3_INVOICE_BYTES,
        ContentType='text/plain',
        Metadata=S3_INVOICE_METADATA,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_invoice_metadata()

    return {
        'service': 's3',
        'lab': 'metadata-tags',
        'step': 'put-object',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_head_invoice_object() -> dict[str, Any]:
    command = (
        f'aws s3api head-object --bucket {S3_METADATA_BUCKET_NAME} '
        f'--key {S3_INVOICE_OBJECT_KEY}'
    )
    started = time.perf_counter()
    response = _s3_client().head_object(
        Bucket=S3_METADATA_BUCKET_NAME,
        Key=S3_INVOICE_OBJECT_KEY,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_invoice_metadata()

    return {
        'service': 's3',
        'lab': 'metadata-tags',
        'step': 'head-object',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_put_invoice_tags() -> dict[str, Any]:
    command = (
        f'aws s3api put-object-tagging --bucket {S3_METADATA_BUCKET_NAME} '
        f'--key {S3_INVOICE_OBJECT_KEY} --tagging file://invoice-tags.json'
    )
    started = time.perf_counter()
    response = _s3_client().put_object_tagging(
        Bucket=S3_METADATA_BUCKET_NAME,
        Key=S3_INVOICE_OBJECT_KEY,
        Tagging={'TagSet': S3_INVOICE_TAGS},
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_invoice_tags()

    return {
        'service': 's3',
        'lab': 'metadata-tags',
        'step': 'put-object-tagging',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_get_invoice_tags() -> dict[str, Any]:
    command = (
        f'aws s3api get-object-tagging --bucket {S3_METADATA_BUCKET_NAME} '
        f'--key {S3_INVOICE_OBJECT_KEY}'
    )
    started = time.perf_counter()
    response = _s3_client().get_object_tagging(
        Bucket=S3_METADATA_BUCKET_NAME,
        Key=S3_INVOICE_OBJECT_KEY,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_invoice_tags()

    return {
        'service': 's3',
        'lab': 'metadata-tags',
        'step': 'get-object-tagging',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_create_versioning_bucket() -> dict[str, Any]:
    command = f'aws s3api create-bucket --bucket {S3_VERSIONING_BUCKET_NAME}'
    started = time.perf_counter()
    try:
        response = _s3_client().create_bucket(Bucket=S3_VERSIONING_BUCKET_NAME)
    except ClientError as exc:
        if _error_code(exc) not in {'BucketAlreadyOwnedByYou', 'BucketAlreadyExists'}:
            raise
        response = _s3_client().head_bucket(Bucket=S3_VERSIONING_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_versioning_bucket()

    return {
        'service': 's3',
        'lab': 'version-recovery',
        'step': 'create-bucket',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_enable_versioning() -> dict[str, Any]:
    command = (
        f'aws s3api put-bucket-versioning --bucket {S3_VERSIONING_BUCKET_NAME} '
        '--versioning-configuration Status=Enabled'
    )
    started = time.perf_counter()
    response = _s3_client().put_bucket_versioning(
        Bucket=S3_VERSIONING_BUCKET_NAME,
        VersioningConfiguration={'Status': 'Enabled'},
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_versioning_enabled()

    return {
        'service': 's3',
        'lab': 'version-recovery',
        'step': 'enable-versioning',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_put_configuration_v1() -> dict[str, Any]:
    command = (
        f'aws s3api put-object --bucket {S3_VERSIONING_BUCKET_NAME} '
        f'--key {S3_CONFIGURATION_KEY} --body configuration-v1.txt --content-type text/plain'
    )
    started = time.perf_counter()
    response = _s3_client().put_object(
        Bucket=S3_VERSIONING_BUCKET_NAME,
        Key=S3_CONFIGURATION_KEY,
        Body=S3_CONFIGURATION_V1_BYTES,
        ContentType='text/plain',
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_configuration_version_one()

    return {
        'service': 's3',
        'lab': 'version-recovery',
        'step': 'put-version-one',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_put_configuration_v2() -> dict[str, Any]:
    command = (
        f'aws s3api put-object --bucket {S3_VERSIONING_BUCKET_NAME} '
        f'--key {S3_CONFIGURATION_KEY} --body configuration-v2.txt --content-type text/plain'
    )
    started = time.perf_counter()
    response = _s3_client().put_object(
        Bucket=S3_VERSIONING_BUCKET_NAME,
        Key=S3_CONFIGURATION_KEY,
        Body=S3_CONFIGURATION_V2_BYTES,
        ContentType='text/plain',
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_configuration_versions()

    return {
        'service': 's3',
        'lab': 'version-recovery',
        'step': 'put-version-two',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_list_configuration_versions() -> dict[str, Any]:
    command = (
        f'aws s3api list-object-versions --bucket {S3_VERSIONING_BUCKET_NAME} '
        f'--prefix {S3_CONFIGURATION_KEY}'
    )
    started = time.perf_counter()
    response = _s3_client().list_object_versions(
        Bucket=S3_VERSIONING_BUCKET_NAME,
        Prefix=S3_CONFIGURATION_KEY,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_configuration_versions()

    return {
        'service': 's3',
        'lab': 'version-recovery',
        'step': 'list-object-versions',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_get_configuration_v1() -> dict[str, Any]:
    command = (
        f'aws s3api get-object --bucket {S3_VERSIONING_BUCKET_NAME} '
        f'--key {S3_CONFIGURATION_KEY} --version-id <v1-version-id> recovered-configuration.txt'
    )
    started = time.perf_counter()
    versions = _s3_configuration_versions()
    version_one = versions.get('v1')
    if not version_one:
        raise ValueError('Configuration v1 version was not found')
    response = _s3_client().get_object(
        Bucket=S3_VERSIONING_BUCKET_NAME,
        Key=S3_CONFIGURATION_KEY,
        VersionId=version_one['VersionId'],
    )
    body = response.pop('Body').read()
    display_response = {
        **response,
        'VersionId': version_one['VersionId'],
        'DownloadedFile': 'recovered-configuration.txt',
        'DownloadedBody': body.decode('utf-8'),
    }
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_configuration_versions()

    return {
        'service': 's3',
        'lab': 'version-recovery',
        'step': 'get-version-one',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(display_response),
        'stderr': '',
        'json': _clean_response(display_response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed' and body == S3_CONFIGURATION_V1_BYTES,
        'verification': verification,
    }


def _run_s3_create_presigned_bucket() -> dict[str, Any]:
    command = f'aws s3api create-bucket --bucket {S3_PRESIGNED_BUCKET_NAME}'
    started = time.perf_counter()
    try:
        response = _s3_client().create_bucket(Bucket=S3_PRESIGNED_BUCKET_NAME)
    except ClientError as exc:
        if _error_code(exc) not in {'BucketAlreadyOwnedByYou', 'BucketAlreadyExists'}:
            raise
        response = _s3_client().head_bucket(Bucket=S3_PRESIGNED_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_presigned_bucket()

    return {
        'service': 's3',
        'lab': 'presigned-url',
        'step': 'create-bucket',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_put_presigned_guide() -> dict[str, Any]:
    command = (
        f'aws s3api put-object --bucket {S3_PRESIGNED_BUCKET_NAME} '
        f'--key {S3_PRESIGNED_OBJECT_KEY} --body guide.txt --content-type text/plain'
    )
    started = time.perf_counter()
    response = _s3_client().put_object(
        Bucket=S3_PRESIGNED_BUCKET_NAME,
        Key=S3_PRESIGNED_OBJECT_KEY,
        Body=S3_PRESIGNED_GUIDE_BYTES,
        ContentType='text/plain',
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_presigned_object()

    return {
        'service': 's3',
        'lab': 'presigned-url',
        'step': 'put-object',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_presign_guide() -> dict[str, Any]:
    command = (
        f'aws s3 presign s3://{S3_PRESIGNED_BUCKET_NAME}/{S3_PRESIGNED_OBJECT_KEY} '
        f'--expires-in {S3_PRESIGNED_EXPIRES_IN}'
    )
    started = time.perf_counter()
    verification = _verify_s3_presigned_access()
    duration_ms = round((time.perf_counter() - started) * 1000)
    resource = verification.get('resource', {})
    response = {
        'PresignedUrl': resource.get('url'),
        'ExpiresIn': resource.get('expires_in'),
        'HttpGetBody': resource.get('downloaded_body'),
    }

    return {
        'service': 's3',
        'lab': 'presigned-url',
        'step': 'presign-object',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_create_security_bucket() -> dict[str, Any]:
    command = f'aws s3api create-bucket --bucket {S3_SECURITY_BUCKET_NAME}'
    started = time.perf_counter()
    try:
        response = _s3_client().create_bucket(Bucket=S3_SECURITY_BUCKET_NAME)
    except ClientError as exc:
        if _error_code(exc) not in {'BucketAlreadyOwnedByYou', 'BucketAlreadyExists'}:
            raise
        response = _s3_client().head_bucket(Bucket=S3_SECURITY_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_security_bucket()

    return {
        'service': 's3',
        'lab': 'bucket-security',
        'step': 'create-bucket',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_put_public_access_block() -> dict[str, Any]:
    command = (
        f'aws s3api put-public-access-block --bucket {S3_SECURITY_BUCKET_NAME} '
        '--public-access-block-configuration '
        'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'
    )
    started = time.perf_counter()
    response = _s3_client().put_public_access_block(
        Bucket=S3_SECURITY_BUCKET_NAME,
        PublicAccessBlockConfiguration=S3_PUBLIC_ACCESS_BLOCK,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_public_access_block()

    return {
        'service': 's3',
        'lab': 'bucket-security',
        'step': 'put-public-access-block',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_get_public_access_block() -> dict[str, Any]:
    command = f'aws s3api get-public-access-block --bucket {S3_SECURITY_BUCKET_NAME}'
    started = time.perf_counter()
    response = _s3_client().get_public_access_block(Bucket=S3_SECURITY_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_public_access_block()

    return {
        'service': 's3',
        'lab': 'bucket-security',
        'step': 'get-public-access-block',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_put_security_bucket_policy() -> dict[str, Any]:
    command = (
        f'aws s3api put-bucket-policy --bucket {S3_SECURITY_BUCKET_NAME} '
        '--policy file://bucket-policy.json'
    )
    started = time.perf_counter()
    response = _s3_client().put_bucket_policy(
        Bucket=S3_SECURITY_BUCKET_NAME,
        Policy=json.dumps(S3_SECURITY_BUCKET_POLICY),
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_security_bucket_policy()

    return {
        'service': 's3',
        'lab': 'bucket-security',
        'step': 'put-bucket-policy',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_get_security_bucket_policy() -> dict[str, Any]:
    command = f'aws s3api get-bucket-policy --bucket {S3_SECURITY_BUCKET_NAME}'
    started = time.perf_counter()
    response = _s3_client().get_bucket_policy(Bucket=S3_SECURITY_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_security_bucket_policy()

    return {
        'service': 's3',
        'lab': 'bucket-security',
        'step': 'get-bucket-policy',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_create_encryption_bucket() -> dict[str, Any]:
    command = f'aws s3api create-bucket --bucket {S3_ENCRYPTION_BUCKET_NAME}'
    started = time.perf_counter()
    try:
        response = _s3_client().create_bucket(Bucket=S3_ENCRYPTION_BUCKET_NAME)
    except ClientError as exc:
        if _error_code(exc) not in {'BucketAlreadyOwnedByYou', 'BucketAlreadyExists'}:
            raise
        response = _s3_client().head_bucket(Bucket=S3_ENCRYPTION_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_encryption_bucket()

    return {
        'service': 's3',
        'lab': 'default-encryption',
        'step': 'create-bucket',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_put_default_encryption() -> dict[str, Any]:
    command = (
        f'aws s3api put-bucket-encryption --bucket {S3_ENCRYPTION_BUCKET_NAME} '
        '--server-side-encryption-configuration file://encryption.json'
    )
    started = time.perf_counter()
    response = _s3_client().put_bucket_encryption(
        Bucket=S3_ENCRYPTION_BUCKET_NAME,
        ServerSideEncryptionConfiguration=S3_SSE_S3_CONFIGURATION,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_default_encryption()

    return {
        'service': 's3',
        'lab': 'default-encryption',
        'step': 'put-bucket-encryption',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_get_default_encryption() -> dict[str, Any]:
    command = f'aws s3api get-bucket-encryption --bucket {S3_ENCRYPTION_BUCKET_NAME}'
    started = time.perf_counter()
    response = _s3_client().get_bucket_encryption(Bucket=S3_ENCRYPTION_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_default_encryption()

    return {
        'service': 's3',
        'lab': 'default-encryption',
        'step': 'get-bucket-encryption',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_put_encrypted_record() -> dict[str, Any]:
    command = (
        f'aws s3api put-object --bucket {S3_ENCRYPTION_BUCKET_NAME} '
        f'--key {S3_ENCRYPTION_OBJECT_KEY} --body record.txt --content-type text/plain'
    )
    started = time.perf_counter()
    response = _s3_client().put_object(
        Bucket=S3_ENCRYPTION_BUCKET_NAME,
        Key=S3_ENCRYPTION_OBJECT_KEY,
        Body=S3_ENCRYPTION_RECORD_BYTES,
        ContentType='text/plain',
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_encrypted_record_workflow()

    return {
        'service': 's3',
        'lab': 'default-encryption',
        'step': 'put-object',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_head_encrypted_record() -> dict[str, Any]:
    command = (
        f'aws s3api head-object --bucket {S3_ENCRYPTION_BUCKET_NAME} '
        f'--key {S3_ENCRYPTION_OBJECT_KEY}'
    )
    started = time.perf_counter()
    response = _s3_client().head_object(
        Bucket=S3_ENCRYPTION_BUCKET_NAME,
        Key=S3_ENCRYPTION_OBJECT_KEY,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_encrypted_record_workflow()

    return {
        'service': 's3',
        'lab': 'default-encryption',
        'step': 'head-object',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_create_lifecycle_bucket() -> dict[str, Any]:
    command = f'aws s3api create-bucket --bucket {S3_LIFECYCLE_BUCKET_NAME}'
    started = time.perf_counter()
    try:
        response = _s3_client().create_bucket(Bucket=S3_LIFECYCLE_BUCKET_NAME)
    except ClientError as exc:
        if _error_code(exc) not in {'BucketAlreadyOwnedByYou', 'BucketAlreadyExists'}:
            raise
        response = _s3_client().head_bucket(Bucket=S3_LIFECYCLE_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_lifecycle_bucket()

    return {
        'service': 's3',
        'lab': 'lifecycle-retention',
        'step': 'create-bucket',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_put_lifecycle_log() -> dict[str, Any]:
    command = (
        f'aws s3api put-object --bucket {S3_LIFECYCLE_BUCKET_NAME} '
        f'--key {S3_LIFECYCLE_OBJECT_KEY} --body app.log --content-type text/plain'
    )
    started = time.perf_counter()
    response = _s3_client().put_object(
        Bucket=S3_LIFECYCLE_BUCKET_NAME,
        Key=S3_LIFECYCLE_OBJECT_KEY,
        Body=S3_LIFECYCLE_LOG_BYTES,
        ContentType='text/plain',
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_lifecycle_log()

    return {
        'service': 's3',
        'lab': 'lifecycle-retention',
        'step': 'put-object',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_put_lifecycle_configuration() -> dict[str, Any]:
    command = (
        f'aws s3api put-bucket-lifecycle-configuration --bucket {S3_LIFECYCLE_BUCKET_NAME} '
        '--lifecycle-configuration file://lifecycle.json'
    )
    started = time.perf_counter()
    response = _s3_client().put_bucket_lifecycle_configuration(
        Bucket=S3_LIFECYCLE_BUCKET_NAME,
        LifecycleConfiguration=S3_LIFECYCLE_CONFIGURATION,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_lifecycle_configuration()

    return {
        'service': 's3',
        'lab': 'lifecycle-retention',
        'step': 'put-lifecycle-configuration',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_get_lifecycle_configuration() -> dict[str, Any]:
    command = (
        f'aws s3api get-bucket-lifecycle-configuration --bucket '
        f'{S3_LIFECYCLE_BUCKET_NAME}'
    )
    started = time.perf_counter()
    response = _s3_client().get_bucket_lifecycle_configuration(
        Bucket=S3_LIFECYCLE_BUCKET_NAME,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_lifecycle_configuration()

    return {
        'service': 's3',
        'lab': 'lifecycle-retention',
        'step': 'get-lifecycle-configuration',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_create_cors_bucket() -> dict[str, Any]:
    command = f'aws s3api create-bucket --bucket {S3_CORS_BUCKET_NAME}'
    started = time.perf_counter()
    try:
        response = _s3_client().create_bucket(Bucket=S3_CORS_BUCKET_NAME)
    except ClientError as exc:
        if _error_code(exc) not in {'BucketAlreadyOwnedByYou', 'BucketAlreadyExists'}:
            raise
        response = _s3_client().head_bucket(Bucket=S3_CORS_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_cors_bucket()

    return {
        'service': 's3',
        'lab': 'bucket-cors',
        'step': 'create-bucket',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_put_bucket_cors() -> dict[str, Any]:
    command = (
        f'aws s3api put-bucket-cors --bucket {S3_CORS_BUCKET_NAME} '
        '--cors-configuration file://cors.json'
    )
    started = time.perf_counter()
    response = _s3_client().put_bucket_cors(
        Bucket=S3_CORS_BUCKET_NAME,
        CORSConfiguration=S3_CORS_CONFIGURATION,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_cors_configuration()

    return {
        'service': 's3',
        'lab': 'bucket-cors',
        'step': 'put-bucket-cors',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_get_bucket_cors() -> dict[str, Any]:
    command = f'aws s3api get-bucket-cors --bucket {S3_CORS_BUCKET_NAME}'
    started = time.perf_counter()
    response = _s3_client().get_bucket_cors(Bucket=S3_CORS_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_cors_configuration()

    return {
        'service': 's3',
        'lab': 'bucket-cors',
        'step': 'get-bucket-cors',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_notifications_create_queue() -> dict[str, Any]:
    command = f'aws sqs create-queue --queue-name {S3_NOTIFICATIONS_QUEUE_NAME}'
    started = time.perf_counter()
    response = _sqs_client().create_queue(QueueName=S3_NOTIFICATIONS_QUEUE_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_notifications_queue()

    return {
        'service': 's3',
        'lab': 'object-notifications-sqs',
        'step': 'create-queue',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_notifications_set_queue_policy() -> dict[str, Any]:
    command = (
        'aws sqs set-queue-attributes --queue-url <queue-url> '
        '--attributes file://queue-attributes.json'
    )
    started = time.perf_counter()
    queue_url = _s3_notifications_queue_url()
    response = _sqs_client().set_queue_attributes(
        QueueUrl=queue_url,
        Attributes={'Policy': json.dumps(S3_NOTIFICATIONS_QUEUE_POLICY)},
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_notifications_queue_policy()

    return {
        'service': 's3',
        'lab': 'object-notifications-sqs',
        'step': 'set-queue-policy',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_notifications_create_bucket() -> dict[str, Any]:
    command = f'aws s3api create-bucket --bucket {S3_NOTIFICATIONS_BUCKET_NAME}'
    started = time.perf_counter()
    try:
        response = _s3_client().create_bucket(Bucket=S3_NOTIFICATIONS_BUCKET_NAME)
    except ClientError as exc:
        if _error_code(exc) not in {'BucketAlreadyOwnedByYou', 'BucketAlreadyExists'}:
            raise
        response = _s3_client().head_bucket(Bucket=S3_NOTIFICATIONS_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_notifications_bucket()

    return {
        'service': 's3',
        'lab': 'object-notifications-sqs',
        'step': 'create-bucket',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_put_notification_configuration() -> dict[str, Any]:
    command = (
        f'aws s3api put-bucket-notification-configuration --bucket '
        f'{S3_NOTIFICATIONS_BUCKET_NAME} --notification-configuration file://notification.json'
    )
    started = time.perf_counter()
    response = _s3_client().put_bucket_notification_configuration(
        Bucket=S3_NOTIFICATIONS_BUCKET_NAME,
        NotificationConfiguration=S3_NOTIFICATIONS_CONFIGURATION,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_notification_configuration()

    return {
        'service': 's3',
        'lab': 'object-notifications-sqs',
        'step': 'put-notification-configuration',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_get_notification_configuration() -> dict[str, Any]:
    command = (
        f'aws s3api get-bucket-notification-configuration --bucket '
        f'{S3_NOTIFICATIONS_BUCKET_NAME}'
    )
    started = time.perf_counter()
    response = _s3_client().get_bucket_notification_configuration(
        Bucket=S3_NOTIFICATIONS_BUCKET_NAME,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_notification_configuration()

    return {
        'service': 's3',
        'lab': 'object-notifications-sqs',
        'step': 'get-notification-configuration',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_notifications_put_object() -> dict[str, Any]:
    command = (
        f'aws s3api put-object --bucket {S3_NOTIFICATIONS_BUCKET_NAME} '
        f'--key {S3_NOTIFICATIONS_OBJECT_KEY} --body report.txt --content-type text/plain'
    )
    started = time.perf_counter()
    response = _s3_client().put_object(
        Bucket=S3_NOTIFICATIONS_BUCKET_NAME,
        Key=S3_NOTIFICATIONS_OBJECT_KEY,
        Body=S3_NOTIFICATIONS_REPORT_BYTES,
        ContentType='text/plain',
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_notification_object()

    return {
        'service': 's3',
        'lab': 'object-notifications-sqs',
        'step': 'put-object',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_notifications_receive_event() -> dict[str, Any]:
    command = (
        'aws sqs receive-message --queue-url <queue-url> --max-number-of-messages 10 '
        '--visibility-timeout 0 --wait-time-seconds 1'
    )
    started = time.perf_counter()
    queue_url = _s3_notifications_queue_url()
    response = _sqs_client().receive_message(
        QueueUrl=queue_url,
        MaxNumberOfMessages=10,
        VisibilityTimeout=0,
        WaitTimeSeconds=1,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    message, record = _s3_event_record(response.get('Messages', []))
    verification = (
        {
            'status': 'passed',
            'message': 'SQS received the ObjectCreated event for uploads/report.txt.',
            'resource': {
                'message_id': message.get('MessageId'),
                'event': _clean_response(record),
            },
        }
        if message and record
        else {
            'status': 'failed',
            'message': 'The queue does not contain the expected S3 object-created event.',
        }
    )

    return {
        'service': 's3',
        'lab': 'object-notifications-sqs',
        'step': 'receive-event',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_multipart_create_bucket() -> dict[str, Any]:
    command = f'aws s3api create-bucket --bucket {S3_MULTIPART_BUCKET_NAME}'
    started = time.perf_counter()
    try:
        response = _s3_client().create_bucket(Bucket=S3_MULTIPART_BUCKET_NAME)
    except ClientError as exc:
        if _error_code(exc) not in {'BucketAlreadyOwnedByYou', 'BucketAlreadyExists'}:
            raise
        response = _s3_client().head_bucket(Bucket=S3_MULTIPART_BUCKET_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_multipart_bucket()

    return {
        'service': 's3',
        'lab': 'multipart-upload',
        'step': 'create-bucket',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_create_multipart_upload() -> dict[str, Any]:
    command = (
        f'aws s3api create-multipart-upload --bucket {S3_MULTIPART_BUCKET_NAME} '
        f'--key {S3_MULTIPART_OBJECT_KEY} --content-type {S3_MULTIPART_CONTENT_TYPE}'
    )
    started = time.perf_counter()
    existing = _s3_active_multipart_upload()
    response = (
        {
            'Bucket': S3_MULTIPART_BUCKET_NAME,
            'Key': S3_MULTIPART_OBJECT_KEY,
            'UploadId': existing['UploadId'],
        }
        if existing
        else _s3_client().create_multipart_upload(
            Bucket=S3_MULTIPART_BUCKET_NAME,
            Key=S3_MULTIPART_OBJECT_KEY,
            ContentType=S3_MULTIPART_CONTENT_TYPE,
        )
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_multipart_upload_started()

    return {
        'service': 's3',
        'lab': 'multipart-upload',
        'step': 'create-multipart-upload',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_upload_multipart_part(
    part_number: int,
    body: bytes,
    step_key: str,
    body_name: str,
) -> dict[str, Any]:
    command = (
        f'aws s3api upload-part --bucket {S3_MULTIPART_BUCKET_NAME} '
        f'--key {S3_MULTIPART_OBJECT_KEY} --part-number {part_number} '
        f'--upload-id <upload-id> --body {body_name}'
    )
    started = time.perf_counter()
    upload = _s3_active_multipart_upload()
    if not upload:
        raise ValueError('Create the multipart upload before uploading parts.')
    response = _s3_client().upload_part(
        Bucket=S3_MULTIPART_BUCKET_NAME,
        Key=S3_MULTIPART_OBJECT_KEY,
        PartNumber=part_number,
        UploadId=upload['UploadId'],
        Body=body,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_multipart_parts(
        {1} if part_number == 1 else {1, 2},
    )

    return {
        'service': 's3',
        'lab': 'multipart-upload',
        'step': step_key,
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_upload_multipart_part_one() -> dict[str, Any]:
    return _run_s3_upload_multipart_part(
        1,
        S3_MULTIPART_PART_ONE_BYTES,
        'upload-part-one',
        'part-one.bin',
    )


def _run_s3_upload_multipart_part_two() -> dict[str, Any]:
    return _run_s3_upload_multipart_part(
        2,
        S3_MULTIPART_PART_TWO_BYTES,
        'upload-part-two',
        'part-two.bin',
    )


def _run_s3_list_multipart_parts() -> dict[str, Any]:
    command = (
        f'aws s3api list-parts --bucket {S3_MULTIPART_BUCKET_NAME} '
        f'--key {S3_MULTIPART_OBJECT_KEY} --upload-id <upload-id>'
    )
    started = time.perf_counter()
    upload, _ = _s3_multipart_parts()
    response = _s3_client().list_parts(
        Bucket=S3_MULTIPART_BUCKET_NAME,
        Key=S3_MULTIPART_OBJECT_KEY,
        UploadId=upload['UploadId'],
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_multipart_parts({1, 2})

    return {
        'service': 's3',
        'lab': 'multipart-upload',
        'step': 'list-parts',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_complete_multipart_upload() -> dict[str, Any]:
    command = (
        f'aws s3api complete-multipart-upload --bucket {S3_MULTIPART_BUCKET_NAME} '
        f'--key {S3_MULTIPART_OBJECT_KEY} --upload-id <upload-id> '
        '--multipart-upload file://parts.json'
    )
    started = time.perf_counter()
    upload, parts = _s3_multipart_parts()
    completed_parts = [
        {'ETag': part['ETag'], 'PartNumber': part['PartNumber']}
        for part in sorted(parts, key=lambda item: item['PartNumber'])
        if part.get('ETag') and part.get('PartNumber')
    ]
    if [part['PartNumber'] for part in completed_parts] != [1, 2]:
        raise ValueError('Upload both multipart parts before completing the object.')
    response = _s3_client().complete_multipart_upload(
        Bucket=S3_MULTIPART_BUCKET_NAME,
        Key=S3_MULTIPART_OBJECT_KEY,
        UploadId=upload['UploadId'],
        MultipartUpload={'Parts': completed_parts},
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_multipart_object()

    return {
        'service': 's3',
        'lab': 'multipart-upload',
        'step': 'complete-multipart-upload',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_s3_get_multipart_object() -> dict[str, Any]:
    command = (
        f'aws s3api get-object --bucket {S3_MULTIPART_BUCKET_NAME} '
        f'--key {S3_MULTIPART_OBJECT_KEY} downloaded-application.bin'
    )
    started = time.perf_counter()
    response = _s3_client().get_object(
        Bucket=S3_MULTIPART_BUCKET_NAME,
        Key=S3_MULTIPART_OBJECT_KEY,
    )
    body = response['Body'].read()
    output = {
        key: value
        for key, value in response.items()
        if key != 'Body'
    }
    output['DownloadedBytes'] = len(body)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_s3_multipart_object()

    return {
        'service': 's3',
        'lab': 'multipart-upload',
        'step': 'get-object',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(output),
        'stderr': '',
        'json': _clean_response(output),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_create_basics_queue(lab_key: str = 'create-queue') -> dict[str, Any]:
    command = f'aws sqs create-queue --queue-name {SQS_BASICS_QUEUE_NAME}'
    started = time.perf_counter()
    response = _sqs_client().create_queue(QueueName=SQS_BASICS_QUEUE_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_sqs_basics_queue_url()

    return {
        'service': 'sqs',
        'lab': lab_key,
        'step': 'create-queue',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_send_lifecycle_message() -> dict[str, Any]:
    command = (
        'aws sqs send-message --queue-url <queue-url> '
        '--message-body file://message.json '
        '--message-attributes file://message-attributes.json'
    )
    started = time.perf_counter()
    queue_url = _sqs_basics_queue_url()
    response = _sqs_client().send_message(
        QueueUrl=queue_url,
        MessageBody=SQS_MESSAGE_BODY_TEXT,
        MessageAttributes=SQS_MESSAGE_ATTRIBUTES,
    )
    cache.delete(SQS_MESSAGE_DELETE_CACHE_KEY)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_sqs_lifecycle_message()

    return {
        'service': 'sqs',
        'lab': 'message-lifecycle',
        'step': 'send-message',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_receive_lifecycle_message() -> dict[str, Any]:
    command = (
        'aws sqs receive-message --queue-url <queue-url> '
        '--max-number-of-messages 10 --visibility-timeout 0 '
        '--wait-time-seconds 1 --message-attribute-names All'
    )
    started = time.perf_counter()
    response = _sqs_receive_lab_messages(
        visibility_timeout=0,
        wait_time_seconds=1,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    message = _sqs_lifecycle_message(response.get('Messages', []))
    verification = (
        {
            'status': 'passed',
            'message': 'The received message has the expected JSON body and Lab attribute.',
            'resource': _clean_response(message),
        }
        if message
        else {
            'status': 'failed',
            'message': 'The expected lifecycle message was not returned.',
        }
    )

    return {
        'service': 'sqs',
        'lab': 'message-lifecycle',
        'step': 'receive-message',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_delete_lifecycle_message() -> dict[str, Any]:
    command = (
        'aws sqs delete-message --queue-url <queue-url> '
        '--receipt-handle <receipt-handle>'
    )
    started = time.perf_counter()
    queue_url = _sqs_basics_queue_url()
    response = _sqs_receive_lab_messages(visibility_timeout=30)
    message = _sqs_lifecycle_message(response.get('Messages', []))
    if not message or not message.get('ReceiptHandle'):
        raise ValueError('Receive the lifecycle message before deleting it.')
    delete_response = _sqs_client().delete_message(
        QueueUrl=queue_url,
        ReceiptHandle=message['ReceiptHandle'],
    )
    cache.set(SQS_MESSAGE_DELETE_CACHE_KEY, True, timeout=86400)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_sqs_lifecycle_message_deleted()

    output = {
        'MessageId': message.get('MessageId'),
        **_clean_response(delete_response),
    }
    return {
        'service': 'sqs',
        'lab': 'message-lifecycle',
        'step': 'delete-message',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(output),
        'stderr': '',
        'json': output,
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_send_visibility_message() -> dict[str, Any]:
    command = (
        'aws sqs send-message --queue-url <queue-url> '
        '--message-body file://job.json '
        '--message-attributes file://message-attributes.json'
    )
    started = time.perf_counter()
    queue_url = _sqs_basics_queue_url()
    response = _sqs_client().send_message(
        QueueUrl=queue_url,
        MessageBody=SQS_VISIBILITY_BODY_TEXT,
        MessageAttributes=SQS_VISIBILITY_ATTRIBUTES,
    )
    cache.delete_many([
        SQS_VISIBILITY_RECEIPT_CACHE_KEY,
        SQS_VISIBILITY_EXTENDED_CACHE_KEY,
        SQS_VISIBILITY_HIDDEN_CACHE_KEY,
        SQS_VISIBILITY_SHORTENED_CACHE_KEY,
        SQS_VISIBILITY_RETURNED_CACHE_KEY,
    ])
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_sqs_visibility_message_available()

    return {
        'service': 'sqs',
        'lab': 'visibility-timeout',
        'step': 'send-message',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_receive_visibility_message() -> dict[str, Any]:
    command = (
        'aws sqs receive-message --queue-url <queue-url> '
        '--max-number-of-messages 10 --visibility-timeout 30 '
        '--wait-time-seconds 1 --message-attribute-names All'
    )
    started = time.perf_counter()
    response = _sqs_receive_lab_messages(visibility_timeout=30)
    message = _sqs_visibility_message(response.get('Messages', []))
    if not message or not message.get('ReceiptHandle'):
        raise ValueError('Send the visibility-timeout job before receiving it.')
    cache.set(
        SQS_VISIBILITY_RECEIPT_CACHE_KEY,
        message['ReceiptHandle'],
        timeout=300,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = {
        'status': 'passed',
        'message': 'The job was received without deletion and is now in flight.',
        'resource': _clean_response(message),
    }

    return {
        'service': 'sqs',
        'lab': 'visibility-timeout',
        'step': 'receive-message',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': True,
        'verification': verification,
    }


def _run_sqs_set_visibility(
    seconds: int,
    step_key: str,
    cache_key: str,
) -> dict[str, Any]:
    command = (
        'aws sqs change-message-visibility --queue-url <queue-url> '
        f'--receipt-handle <receipt-handle> --visibility-timeout {seconds}'
    )
    receipt_handle = cache.get(SQS_VISIBILITY_RECEIPT_CACHE_KEY)
    if not receipt_handle:
        raise ValueError('Receive the visibility-timeout job before changing its visibility.')
    started = time.perf_counter()
    queue_url = _sqs_basics_queue_url()
    response = _sqs_client().change_message_visibility(
        QueueUrl=queue_url,
        ReceiptHandle=receipt_handle,
        VisibilityTimeout=seconds,
    )
    cache.set(cache_key, True, timeout=86400)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = {
        'status': 'passed',
        'message': f'The job visibility timeout was changed to {seconds} seconds.',
    }

    return {
        'service': 'sqs',
        'lab': 'visibility-timeout',
        'step': step_key,
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': True,
        'verification': verification,
    }


def _run_sqs_extend_visibility() -> dict[str, Any]:
    return _run_sqs_set_visibility(
        SQS_VISIBILITY_EXTENDED_SECONDS,
        'extend-message-visibility',
        SQS_VISIBILITY_EXTENDED_CACHE_KEY,
    )


def _run_sqs_shorten_visibility() -> dict[str, Any]:
    return _run_sqs_set_visibility(
        SQS_VISIBILITY_SHORT_SECONDS,
        'shorten-message-visibility',
        SQS_VISIBILITY_SHORTENED_CACHE_KEY,
    )


def _run_sqs_verify_visibility_hidden() -> dict[str, Any]:
    command = (
        'aws sqs receive-message --queue-url <queue-url> '
        '--max-number-of-messages 10 --visibility-timeout 0 '
        '--wait-time-seconds 0 --message-attribute-names All'
    )
    started = time.perf_counter()
    response = _sqs_receive_lab_messages(
        visibility_timeout=0,
        wait_time_seconds=0,
    )
    message = _sqs_visibility_message(response.get('Messages', []))
    duration_ms = round((time.perf_counter() - started) * 1000)
    if message:
        verification = {
            'status': 'failed',
            'message': 'The job was returned before its visibility timeout expired.',
        }
    else:
        cache.set(SQS_VISIBILITY_HIDDEN_CACHE_KEY, True, timeout=86400)
        verification = {
            'status': 'passed',
            'message': 'The in-flight job is temporarily hidden from other receives.',
        }

    return {
        'service': 'sqs',
        'lab': 'visibility-timeout',
        'step': 'verify-hidden',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_receive_after_visibility_timeout() -> dict[str, Any]:
    command = (
        'aws sqs receive-message --queue-url <queue-url> '
        '--max-number-of-messages 10 --visibility-timeout 0 '
        '--wait-time-seconds 3 --message-attribute-names All'
    )
    started = time.perf_counter()
    time.sleep(SQS_VISIBILITY_SHORT_SECONDS + 0.25)
    response = _sqs_receive_lab_messages(
        visibility_timeout=0,
        wait_time_seconds=3,
    )
    message = _sqs_visibility_message(response.get('Messages', []))
    duration_ms = round((time.perf_counter() - started) * 1000)
    if message:
        cache.set(SQS_VISIBILITY_RETURNED_CACHE_KEY, True, timeout=86400)
        verification = {
            'status': 'passed',
            'message': 'The same undeleted job became available after the timeout expired.',
            'resource': _clean_response(message),
        }
    else:
        verification = {
            'status': 'failed',
            'message': 'The visibility-timeout job did not reappear in time.',
        }

    return {
        'service': 'sqs',
        'lab': 'visibility-timeout',
        'step': 'receive-after-timeout',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_send_delayed_message() -> dict[str, Any]:
    command = (
        'aws sqs send-message --queue-url <queue-url> '
        '--message-body file://report.json '
        '--message-attributes file://message-attributes.json '
        f'--delay-seconds {SQS_DELAY_SECONDS}'
    )
    started = time.perf_counter()
    queue_url = _sqs_basics_queue_url()
    response = _sqs_client().send_message(
        QueueUrl=queue_url,
        MessageBody=SQS_DELAYED_BODY_TEXT,
        MessageAttributes=SQS_DELAYED_ATTRIBUTES,
        DelaySeconds=SQS_DELAY_SECONDS,
    )
    cache.delete_many([
        SQS_DELAYED_OBSERVED_CACHE_KEY,
        SQS_DELAYED_RETURNED_CACHE_KEY,
    ])

    delayed_count = 0
    for _ in range(5):
        _, delayed_count = _sqs_delayed_count()
        if delayed_count > 0:
            break
        time.sleep(0.05)
    immediate = _sqs_receive_lab_messages(
        visibility_timeout=0,
        wait_time_seconds=0,
    )
    unavailable = _sqs_delayed_message(immediate.get('Messages', [])) is None
    if delayed_count > 0 and unavailable:
        cache.set(SQS_DELAYED_OBSERVED_CACHE_KEY, True, timeout=86400)
        verification = {
            'status': 'passed',
            'message': 'The queue reports the message as delayed and an immediate receive cannot return it.',
            'resource': {
                'approximate_delayed_messages': delayed_count,
            },
        }
    else:
        verification = {
            'status': 'failed',
            'message': 'The message was not observed in the expected delayed state.',
        }
    duration_ms = round((time.perf_counter() - started) * 1000)

    output = {
        **_clean_response(response),
        'ApproximateNumberOfMessagesDelayed': delayed_count,
        'ImmediateReceive': _clean_response(immediate),
    }
    return {
        'service': 'sqs',
        'lab': 'delayed-message',
        'step': 'send-delayed-message',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(output),
        'stderr': '',
        'json': output,
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_get_delayed_attributes() -> dict[str, Any]:
    command = (
        'aws sqs get-queue-attributes --queue-url <queue-url> '
        '--attribute-names ApproximateNumberOfMessagesDelayed'
    )
    started = time.perf_counter()
    queue_url, delayed_count = _sqs_delayed_count()
    response = {
        'Attributes': {
            'ApproximateNumberOfMessagesDelayed': str(delayed_count),
        },
    }
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_sqs_delayed_observed()
    if verification.get('status') == 'passed':
        verification = {
            **verification,
            'resource': {
                'queue_url': queue_url,
                'approximate_delayed_messages': delayed_count,
            },
        }

    return {
        'service': 'sqs',
        'lab': 'delayed-message',
        'step': 'get-queue-attributes',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': response,
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_receive_after_delay() -> dict[str, Any]:
    command = (
        'aws sqs receive-message --queue-url <queue-url> '
        '--max-number-of-messages 10 --visibility-timeout 0 '
        '--wait-time-seconds 12 --message-attribute-names All'
    )
    started = time.perf_counter()
    response, message = _sqs_wait_for_delayed_message(
        wait_seconds=12.5,
        visibility_timeout=0,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    if message:
        cache.set(SQS_DELAYED_RETURNED_CACHE_KEY, True, timeout=86400)
        verification = {
            'status': 'passed',
            'message': 'The delayed report request became available after ten seconds.',
            'resource': _clean_response(message),
        }
    else:
        verification = {
            'status': 'failed',
            'message': 'The delayed report request did not become available in time.',
        }

    return {
        'service': 'sqs',
        'lab': 'delayed-message',
        'step': 'receive-after-delay',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_send_message_batch() -> dict[str, Any]:
    command = (
        'aws sqs send-message-batch --queue-url <queue-url> '
        '--entries file://send-batch.json'
    )
    queue_url = _sqs_basics_queue_url()
    entries = [
        {
            'Id': f'task-{index}',
            'MessageBody': text,
            'MessageAttributes': {
                'Lab': {
                    'DataType': 'String',
                    'StringValue': SQS_BATCH_ATTRIBUTE_VALUE,
                },
            },
        }
        for index, text in enumerate(SQS_BATCH_MESSAGE_TEXTS, start=1)
    ]
    started = time.perf_counter()
    response = _sqs_client().send_message_batch(
        QueueUrl=queue_url,
        Entries=entries,
    )
    cache.delete(SQS_BATCH_DELETE_CACHE_KEY)
    duration_ms = round((time.perf_counter() - started) * 1000)
    successful_ids = {
        item.get('Id') for item in response.get('Successful', [])
    }
    expected_ids = {entry['Id'] for entry in entries}
    if successful_ids == expected_ids and not response.get('Failed'):
        verification = _verify_sqs_batch_available()
    else:
        verification = {
            'status': 'failed',
            'message': 'One or more batch send entries failed.',
        }

    return {
        'service': 'sqs',
        'lab': 'batch-messages',
        'step': 'send-message-batch',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_receive_message_batch() -> dict[str, Any]:
    command = (
        'aws sqs receive-message --queue-url <queue-url> '
        '--max-number-of-messages 10 --visibility-timeout 0 '
        '--wait-time-seconds 1 --message-attribute-names All'
    )
    started = time.perf_counter()
    messages, responses = _sqs_collect_batch_messages(
        wait_seconds=2,
        visibility_timeout=0,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    bodies = {message.get('Body') for message in messages}
    verification = (
        {
            'status': 'passed',
            'message': 'ReceiveMessage returned all three task events.',
            'resource': {'messages': _clean_response(messages)},
        }
        if bodies == set(SQS_BATCH_MESSAGE_TEXTS)
        else {
            'status': 'failed',
            'message': f'Expected three task events but found {len(bodies)}.',
        }
    )
    output = {
        'Messages': messages,
        'ReceiveCalls': len(responses),
    }

    return {
        'service': 'sqs',
        'lab': 'batch-messages',
        'step': 'receive-message',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(output),
        'stderr': '',
        'json': _clean_response(output),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_delete_message_batch() -> dict[str, Any]:
    command = (
        'aws sqs delete-message-batch --queue-url <queue-url> '
        '--entries file://delete-batch.json'
    )
    started = time.perf_counter()
    queue_url = _sqs_basics_queue_url()
    messages, _ = _sqs_collect_batch_messages(
        wait_seconds=2,
        visibility_timeout=30,
    )
    by_body = {message.get('Body'): message for message in messages}
    if set(by_body) != set(SQS_BATCH_MESSAGE_TEXTS):
        raise ValueError('Receive all three batch messages before deleting them.')
    entries = [
        {
            'Id': f'task-{index}',
            'ReceiptHandle': by_body[text]['ReceiptHandle'],
        }
        for index, text in enumerate(SQS_BATCH_MESSAGE_TEXTS, start=1)
    ]
    response = _sqs_client().delete_message_batch(
        QueueUrl=queue_url,
        Entries=entries,
    )
    successful_ids = {
        item.get('Id') for item in response.get('Successful', [])
    }
    expected_ids = {entry['Id'] for entry in entries}
    if successful_ids == expected_ids and not response.get('Failed'):
        cache.set(SQS_BATCH_DELETE_CACHE_KEY, True, timeout=86400)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_sqs_batch_deleted()

    return {
        'service': 'sqs',
        'lab': 'batch-messages',
        'step': 'delete-message-batch',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_set_configuration_attributes() -> dict[str, Any]:
    command = (
        'aws sqs set-queue-attributes --queue-url <queue-url> '
        '--attributes file://queue-attributes.json'
    )
    started = time.perf_counter()
    queue_url = _sqs_basics_queue_url()
    response = _sqs_client().set_queue_attributes(
        QueueUrl=queue_url,
        Attributes=SQS_CONFIGURATION_ATTRIBUTES,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_sqs_configuration_attributes()

    return {
        'service': 'sqs',
        'lab': 'queue-configuration',
        'step': 'set-queue-attributes',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_get_configuration_attributes() -> dict[str, Any]:
    command = (
        'aws sqs get-queue-attributes --queue-url <queue-url> '
        '--attribute-names VisibilityTimeout MessageRetentionPeriod '
        'ReceiveMessageWaitTimeSeconds'
    )
    started = time.perf_counter()
    queue_url = _sqs_basics_queue_url()
    response = _sqs_client().get_queue_attributes(
        QueueUrl=queue_url,
        AttributeNames=list(SQS_CONFIGURATION_ATTRIBUTES),
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_sqs_configuration_attributes()

    return {
        'service': 'sqs',
        'lab': 'queue-configuration',
        'step': 'get-queue-attributes',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_tag_configuration_queue() -> dict[str, Any]:
    command = (
        'aws sqs tag-queue --queue-url <queue-url> '
        '--tags Environment=lab,Purpose=training'
    )
    started = time.perf_counter()
    queue_url = _sqs_basics_queue_url()
    response = _sqs_client().tag_queue(
        QueueUrl=queue_url,
        Tags=SQS_CONFIGURATION_TAGS,
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_sqs_configuration_tags()

    return {
        'service': 'sqs',
        'lab': 'queue-configuration',
        'step': 'tag-queue',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_list_configuration_tags() -> dict[str, Any]:
    command = 'aws sqs list-queue-tags --queue-url <queue-url>'
    started = time.perf_counter()
    queue_url = _sqs_basics_queue_url()
    response = _sqs_client().list_queue_tags(QueueUrl=queue_url)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_sqs_configuration_tags()

    return {
        'service': 'sqs',
        'lab': 'queue-configuration',
        'step': 'list-queue-tags',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _sqs_redrive_step_result(
    step_key: str,
    command: str,
    response: dict[str, Any],
    verification: dict[str, Any],
    started: float,
) -> dict[str, Any]:
    return {
        'service': 'sqs',
        'lab': 'dead-letter-redrive',
        'step': step_key,
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_create_redrive_dlq() -> dict[str, Any]:
    command = f'aws sqs create-queue --queue-name {SQS_REDRIVE_DLQ_NAME}'
    started = time.perf_counter()
    response = _sqs_client().create_queue(QueueName=SQS_REDRIVE_DLQ_NAME)
    verification = _verify_sqs_redrive_queue(
        SQS_REDRIVE_DLQ_NAME,
        SQS_REDRIVE_DLQ_ARN,
    )
    return _sqs_redrive_step_result(
        'create-dlq',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_create_redrive_source() -> dict[str, Any]:
    command = f'aws sqs create-queue --queue-name {SQS_REDRIVE_SOURCE_QUEUE_NAME}'
    started = time.perf_counter()
    response = _sqs_client().create_queue(QueueName=SQS_REDRIVE_SOURCE_QUEUE_NAME)
    verification = _verify_sqs_redrive_queue(
        SQS_REDRIVE_SOURCE_QUEUE_NAME,
        SQS_REDRIVE_SOURCE_QUEUE_ARN,
    )
    return _sqs_redrive_step_result(
        'create-source-queue',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_set_redrive_policy() -> dict[str, Any]:
    command = (
        'aws sqs set-queue-attributes --queue-url <source-queue-url> '
        '--attributes file://redrive-policy.json'
    )
    started = time.perf_counter()
    queue_url = _sqs_queue_url(SQS_REDRIVE_SOURCE_QUEUE_NAME)
    response = _sqs_client().set_queue_attributes(
        QueueUrl=queue_url,
        Attributes={'RedrivePolicy': json.dumps(SQS_REDRIVE_POLICY)},
    )
    verification = _verify_sqs_redrive_policy()
    return _sqs_redrive_step_result(
        'set-redrive-policy',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_get_redrive_policy() -> dict[str, Any]:
    command = (
        'aws sqs get-queue-attributes --queue-url <source-queue-url> '
        '--attribute-names RedrivePolicy'
    )
    started = time.perf_counter()
    queue_url = _sqs_queue_url(SQS_REDRIVE_SOURCE_QUEUE_NAME)
    response = _sqs_client().get_queue_attributes(
        QueueUrl=queue_url,
        AttributeNames=['RedrivePolicy'],
    )
    verification = _verify_sqs_redrive_policy()
    return _sqs_redrive_step_result(
        'get-redrive-policy',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_send_redrive_message() -> dict[str, Any]:
    command = (
        'aws sqs send-message --queue-url <source-queue-url> '
        '--message-body file://payment.json '
        '--message-attributes file://message-attributes.json'
    )
    started = time.perf_counter()
    response = _sqs_client().send_message(
        QueueUrl=_sqs_queue_url(SQS_REDRIVE_SOURCE_QUEUE_NAME),
        MessageBody=SQS_REDRIVE_BODY_TEXT,
        MessageAttributes=SQS_REDRIVE_ATTRIBUTES,
    )
    cache.delete_many([
        SQS_REDRIVE_FAILURE_ONE_CACHE_KEY,
        SQS_REDRIVE_FAILURE_TWO_CACHE_KEY,
        SQS_REDRIVE_TRIGGERED_CACHE_KEY,
        SQS_REDRIVE_DLQ_OBSERVED_CACHE_KEY,
        SQS_REDRIVE_TASK_CACHE_KEY,
        SQS_REDRIVE_RETURNED_CACHE_KEY,
    ])
    verification = {
        'status': 'passed',
        'message': 'The payment event was accepted by the source queue.',
        'resource': _clean_response(response),
    }
    return _sqs_redrive_step_result(
        'send-message',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_fail_redrive_message(
    step_key: str,
    expected_receive_count: int,
    cache_key: str,
) -> dict[str, Any]:
    command = (
        'aws sqs receive-message --queue-url <source-queue-url> '
        '--max-number-of-messages 1 --visibility-timeout 0 '
        '--wait-time-seconds 0 --attribute-names All '
        '--message-attribute-names All'
    )
    started = time.perf_counter()
    response = _sqs_receive_redrive_message(SQS_REDRIVE_SOURCE_QUEUE_NAME)
    message = _sqs_redrive_message(response.get('Messages', []))
    receive_count = int(
        (message or {}).get('Attributes', {}).get('ApproximateReceiveCount', 0)
    )
    if message and receive_count >= expected_receive_count:
        cache.set(cache_key, True, timeout=86400)
        verification = {
            'status': 'passed',
            'message': (
                f'The payment event completed failed receive attempt '
                f'{expected_receive_count} without being deleted.'
            ),
            'resource': _clean_response(message),
        }
    else:
        verification = {
            'status': 'failed',
            'message': (
                f'The source queue did not return the expected failed attempt '
                f'{expected_receive_count}.'
            ),
        }
    return _sqs_redrive_step_result(
        step_key,
        command,
        response,
        verification,
        started,
    )


def _run_sqs_trigger_dead_lettering() -> dict[str, Any]:
    command = (
        'aws sqs receive-message --queue-url <source-queue-url> '
        '--max-number-of-messages 1 --visibility-timeout 0 '
        '--wait-time-seconds 0 --attribute-names All '
        '--message-attribute-names All'
    )
    started = time.perf_counter()
    response = _sqs_receive_redrive_message(SQS_REDRIVE_SOURCE_QUEUE_NAME)
    message = _sqs_redrive_message(response.get('Messages', []))
    if not message and cache.get(SQS_REDRIVE_FAILURE_TWO_CACHE_KEY):
        cache.set(SQS_REDRIVE_TRIGGERED_CACHE_KEY, True, timeout=86400)
        verification = {
            'status': 'passed',
            'message': 'The source queue withheld the over-received message and routed it to the DLQ.',
        }
    else:
        verification = {
            'status': 'failed',
            'message': 'The message is still available from the source queue.',
        }
    return _sqs_redrive_step_result(
        'trigger-dead-lettering',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_inspect_redrive_dlq() -> dict[str, Any]:
    command = (
        'aws sqs receive-message --queue-url <dlq-url> '
        '--max-number-of-messages 1 --visibility-timeout 0 '
        '--wait-time-seconds 1 --attribute-names All '
        '--message-attribute-names All'
    )
    started = time.perf_counter()
    response = _sqs_receive_redrive_message(
        SQS_REDRIVE_DLQ_NAME,
        wait_time_seconds=1,
    )
    message = _sqs_redrive_message(response.get('Messages', []))
    if message:
        cache.set(SQS_REDRIVE_DLQ_OBSERVED_CACHE_KEY, True, timeout=86400)
        verification = {
            'status': 'passed',
            'message': 'The failed payment event is isolated in the dead-letter queue.',
            'resource': _clean_response(message),
        }
    else:
        verification = {
            'status': 'failed',
            'message': 'The expected payment event was not found in the dead-letter queue.',
        }
    return _sqs_redrive_step_result(
        'inspect-dlq',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_start_message_move_task() -> dict[str, Any]:
    command = (
        f'aws sqs start-message-move-task --source-arn {SQS_REDRIVE_DLQ_ARN} '
        f'--destination-arn {SQS_REDRIVE_SOURCE_QUEUE_ARN} '
        '--max-number-of-messages-per-second 10'
    )
    started = time.perf_counter()
    response = _sqs_client().start_message_move_task(
        SourceArn=SQS_REDRIVE_DLQ_ARN,
        DestinationArn=SQS_REDRIVE_SOURCE_QUEUE_ARN,
        MaxNumberOfMessagesPerSecond=10,
    )
    task_handle = response.get('TaskHandle')
    if task_handle:
        cache.set(SQS_REDRIVE_TASK_CACHE_KEY, task_handle, timeout=86400)
        verification = {
            'status': 'passed',
            'message': 'SQS started a managed message move task for the DLQ.',
            'resource': {'task_handle': task_handle},
        }
    else:
        verification = {
            'status': 'failed',
            'message': 'SQS did not return a message move task handle.',
        }
    return _sqs_redrive_step_result(
        'start-message-move-task',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_list_message_move_tasks() -> dict[str, Any]:
    command = (
        f'aws sqs list-message-move-tasks --source-arn {SQS_REDRIVE_DLQ_ARN} '
        '--max-results 10'
    )
    started = time.perf_counter()
    response = _sqs_client().list_message_move_tasks(
        SourceArn=SQS_REDRIVE_DLQ_ARN,
        MaxResults=10,
    )
    verification = _verify_sqs_redrive_task()
    return _sqs_redrive_step_result(
        'list-message-move-tasks',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_receive_redriven_message() -> dict[str, Any]:
    command = (
        'aws sqs receive-message --queue-url <source-queue-url> '
        '--max-number-of-messages 1 --visibility-timeout 0 '
        '--wait-time-seconds 1 --attribute-names All '
        '--message-attribute-names All'
    )
    started = time.perf_counter()
    response: dict[str, Any] = {}
    message = None
    for _ in range(10):
        response = _sqs_receive_redrive_message(
            SQS_REDRIVE_SOURCE_QUEUE_NAME,
            wait_time_seconds=1,
        )
        message = _sqs_redrive_message(response.get('Messages', []))
        if message:
            break
        time.sleep(0.05)
    receive_count = int(
        (message or {}).get('Attributes', {}).get('ApproximateReceiveCount', 0)
    )
    if message and receive_count == 1:
        cache.set(SQS_REDRIVE_RETURNED_CACHE_KEY, True, timeout=86400)
        verification = {
            'status': 'passed',
            'message': 'The exact payment event returned to the source queue with a fresh receive count.',
            'resource': _clean_response(message),
        }
    else:
        verification = {
            'status': 'failed',
            'message': 'The redriven payment event was not available with a fresh receive count.',
        }
    return _sqs_redrive_step_result(
        'receive-redriven-message',
        command,
        response,
        verification,
        started,
    )


def _sqs_fifo_step_result(
    step_key: str,
    command: str,
    response: dict[str, Any],
    verification: dict[str, Any],
    started: float,
) -> dict[str, Any]:
    return {
        'service': 'sqs',
        'lab': 'fifo-ordering',
        'step': step_key,
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_create_fifo_queue() -> dict[str, Any]:
    command = (
        f'aws sqs create-queue --queue-name {SQS_FIFO_QUEUE_NAME} '
        '--attributes FifoQueue=true,ContentBasedDeduplication=false'
    )
    started = time.perf_counter()
    response = _sqs_client().create_queue(
        QueueName=SQS_FIFO_QUEUE_NAME,
        Attributes={
            'FifoQueue': 'true',
            'ContentBasedDeduplication': 'false',
        },
    )
    verification = _verify_sqs_fifo_queue()
    return _sqs_fifo_step_result(
        'create-queue',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_get_fifo_attributes() -> dict[str, Any]:
    command = (
        'aws sqs get-queue-attributes --queue-url <fifo-queue-url> '
        '--attribute-names QueueArn FifoQueue ContentBasedDeduplication'
    )
    started = time.perf_counter()
    response = _sqs_client().get_queue_attributes(
        QueueUrl=_sqs_fifo_queue_url(),
        AttributeNames=['QueueArn', 'FifoQueue', 'ContentBasedDeduplication'],
    )
    verification = _verify_sqs_fifo_queue()
    return _sqs_fifo_step_result(
        'get-queue-attributes',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_send_fifo_message(
    message_index: int,
    step_key: str,
) -> dict[str, Any]:
    artifact_names = ('order-created.json', 'order-paid.json', 'order-fulfilled.json')
    command = (
        'aws sqs send-message --queue-url <fifo-queue-url> '
        f'--message-body file://{artifact_names[message_index]} '
        f'--message-group-id {SQS_FIFO_GROUP_ID} '
        '--message-deduplication-id '
        f'{SQS_FIFO_DEDUPLICATION_IDS[message_index]}'
    )
    started = time.perf_counter()
    response = _sqs_client().send_message(
        QueueUrl=_sqs_fifo_queue_url(),
        MessageBody=SQS_FIFO_MESSAGE_TEXTS[message_index],
        MessageGroupId=SQS_FIFO_GROUP_ID,
        MessageDeduplicationId=SQS_FIFO_DEDUPLICATION_IDS[message_index],
    )
    if message_index == 0:
        cache.delete_many([
            SQS_FIFO_DEDUPLICATED_CACHE_KEY,
            SQS_FIFO_ORDERED_CACHE_KEY,
        ])
        cache.set(
            SQS_FIFO_FIRST_SEND_CACHE_KEY,
            {
                'MessageId': response.get('MessageId'),
                'SequenceNumber': response.get('SequenceNumber'),
            },
            timeout=86400,
        )
    verified = bool(response.get('MessageId') and response.get('SequenceNumber'))
    verification = {
        'status': 'passed' if verified else 'failed',
        'message': (
            f'SQS accepted order workflow step {message_index + 1} '
            f'in message group {SQS_FIFO_GROUP_ID}.'
            if verified
            else 'SQS did not return FIFO message metadata.'
        ),
        'resource': _clean_response(response),
    }
    return _sqs_fifo_step_result(
        step_key,
        command,
        response,
        verification,
        started,
    )


def _run_sqs_send_fifo_duplicate() -> dict[str, Any]:
    command = (
        'aws sqs send-message --queue-url <fifo-queue-url> '
        '--message-body file://duplicate-created.json '
        f'--message-group-id {SQS_FIFO_GROUP_ID} '
        f'--message-deduplication-id {SQS_FIFO_DEDUPLICATION_IDS[0]}'
    )
    first_send = cache.get(SQS_FIFO_FIRST_SEND_CACHE_KEY)
    if not first_send:
        raise ValueError('Send the created event before retrying its deduplication ID.')
    started = time.perf_counter()
    response = _sqs_client().send_message(
        QueueUrl=_sqs_fifo_queue_url(),
        MessageBody=SQS_FIFO_DUPLICATE_BODY_TEXT,
        MessageGroupId=SQS_FIFO_GROUP_ID,
        MessageDeduplicationId=SQS_FIFO_DEDUPLICATION_IDS[0],
    )
    deduplicated = (
        response.get('MessageId') == first_send.get('MessageId')
        and response.get('SequenceNumber') == first_send.get('SequenceNumber')
    )
    if deduplicated:
        cache.set(SQS_FIFO_DEDUPLICATED_CACHE_KEY, True, timeout=86400)
    verification = {
        'status': 'passed' if deduplicated else 'failed',
        'message': (
            'The retry returned the original message ID and sequence number, so no duplicate was enqueued.'
            if deduplicated
            else 'The retry did not reuse the original FIFO message metadata.'
        ),
        'resource': {
            'original': first_send,
            'duplicate_send': _clean_response(response),
        },
    }
    return _sqs_fifo_step_result(
        'send-duplicate',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_get_fifo_message_count() -> dict[str, Any]:
    command = (
        'aws sqs get-queue-attributes --queue-url <fifo-queue-url> '
        '--attribute-names ApproximateNumberOfMessages'
    )
    started = time.perf_counter()
    response = _sqs_client().get_queue_attributes(
        QueueUrl=_sqs_fifo_queue_url(),
        AttributeNames=['ApproximateNumberOfMessages'],
    )
    verification = _verify_sqs_fifo_message_count()
    return _sqs_fifo_step_result(
        'inspect-message-count',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_receive_ordered_messages() -> dict[str, Any]:
    command = (
        'aws sqs receive-message --queue-url <fifo-queue-url> '
        '--max-number-of-messages 10 --visibility-timeout 0 '
        '--wait-time-seconds 1 --attribute-names All '
        '--message-attribute-names All'
    )
    started = time.perf_counter()
    response = _sqs_receive_fifo_messages()
    messages = [
        message for message in response.get('Messages', [])
        if message.get('Attributes', {}).get('MessageGroupId') == SQS_FIFO_GROUP_ID
    ]
    bodies = [message.get('Body') for message in messages]
    sequence_numbers = [
        int(message.get('Attributes', {}).get('SequenceNumber', 0))
        for message in messages
    ]
    ordered = (
        bodies == SQS_FIFO_MESSAGE_TEXTS
        and sequence_numbers == sorted(sequence_numbers)
        and len(set(sequence_numbers)) == len(sequence_numbers)
    )
    if ordered:
        cache.set(SQS_FIFO_ORDERED_CACHE_KEY, True, timeout=86400)
    verification = {
        'status': 'passed' if ordered else 'failed',
        'message': (
            'ReceiveMessage returned created, paid, and fulfilled in FIFO sequence.'
            if ordered
            else 'ReceiveMessage did not return the expected ordered workflow.'
        ),
        'resource': {
            'messages': _clean_response(messages),
            'sequence_numbers': sequence_numbers,
        },
    }
    return _sqs_fifo_step_result(
        'receive-ordered-messages',
        command,
        response,
        verification,
        started,
    )


def _sqs_cleanup_step_result(
    step_key: str,
    command: str,
    response: dict[str, Any],
    verification: dict[str, Any],
    started: float,
) -> dict[str, Any]:
    return {
        'service': 'sqs',
        'lab': 'purge-delete',
        'step': step_key,
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_create_cleanup_queue() -> dict[str, Any]:
    command = (
        f'aws sqs create-queue --queue-name {SQS_CLEANUP_QUEUE_NAME} '
        f'--attributes VisibilityTimeout={SQS_CLEANUP_VISIBILITY_TIMEOUT} '
        '--tags Purpose=cleanup-training'
    )
    started = time.perf_counter()
    response = _sqs_client().create_queue(
        QueueName=SQS_CLEANUP_QUEUE_NAME,
        Attributes={'VisibilityTimeout': SQS_CLEANUP_VISIBILITY_TIMEOUT},
        tags=SQS_CLEANUP_TAGS,
    )
    cache.delete_many([
        SQS_CLEANUP_POPULATED_CACHE_KEY,
        SQS_CLEANUP_PURGED_CACHE_KEY,
        SQS_CLEANUP_DELETED_CACHE_KEY,
    ])
    verification = _verify_sqs_cleanup_queue(0)
    return _sqs_cleanup_step_result(
        'create-queue',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_send_cleanup_batch() -> dict[str, Any]:
    command = (
        'aws sqs send-message-batch --queue-url <cleanup-queue-url> '
        '--entries file://cleanup-messages.json'
    )
    entries = [
        {
            'Id': f'cleanup-{index}',
            'MessageBody': text,
            'MessageAttributes': {
                'Lab': {
                    'DataType': 'String',
                    'StringValue': SQS_CLEANUP_ATTRIBUTE_VALUE,
                },
            },
        }
        for index, text in enumerate(SQS_CLEANUP_MESSAGE_TEXTS, start=1)
    ]
    started = time.perf_counter()
    response = _sqs_client().send_message_batch(
        QueueUrl=_sqs_cleanup_queue_url(),
        Entries=entries,
    )
    successful_ids = {item.get('Id') for item in response.get('Successful', [])}
    expected_ids = {entry['Id'] for entry in entries}
    if successful_ids == expected_ids and not response.get('Failed'):
        verification = _verify_sqs_cleanup_queue(len(SQS_CLEANUP_MESSAGES))
    else:
        verification = {
            'status': 'failed',
            'message': 'One or more cleanup messages failed to send.',
        }
    if verification.get('status') == 'passed':
        cache.set(SQS_CLEANUP_POPULATED_CACHE_KEY, True, timeout=86400)
    return _sqs_cleanup_step_result(
        'send-message-batch',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_inspect_populated_cleanup_queue() -> dict[str, Any]:
    command = (
        'aws sqs get-queue-attributes --queue-url <cleanup-queue-url> '
        '--attribute-names QueueArn VisibilityTimeout '
        'ApproximateNumberOfMessages'
    )
    started = time.perf_counter()
    queue_url, attributes, tags = _sqs_cleanup_state()
    response = {'Attributes': attributes, 'Tags': tags}
    verification = _verify_sqs_cleanup_queue(len(SQS_CLEANUP_MESSAGES))
    if verification.get('status') == 'passed':
        cache.set(SQS_CLEANUP_POPULATED_CACHE_KEY, True, timeout=86400)
    return _sqs_cleanup_step_result(
        'inspect-populated-queue',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_purge_cleanup_queue() -> dict[str, Any]:
    command = 'aws sqs purge-queue --queue-url <cleanup-queue-url>'
    if not cache.get(SQS_CLEANUP_POPULATED_CACHE_KEY):
        raise ValueError('Populate and inspect the cleanup queue before purging it.')
    started = time.perf_counter()
    response = _sqs_client().purge_queue(QueueUrl=_sqs_cleanup_queue_url())
    verification = _verify_sqs_cleanup_queue(0)
    if verification.get('status') == 'passed':
        cache.set(SQS_CLEANUP_PURGED_CACHE_KEY, True, timeout=86400)
    return _sqs_cleanup_step_result(
        'purge-queue',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_inspect_purged_cleanup_queue() -> dict[str, Any]:
    command = (
        'aws sqs get-queue-attributes --queue-url <cleanup-queue-url> '
        '--attribute-names QueueArn VisibilityTimeout '
        'ApproximateNumberOfMessages'
    )
    started = time.perf_counter()
    queue_url, attributes, tags = _sqs_cleanup_state()
    response = {'Attributes': attributes, 'Tags': tags}
    verification = _verify_sqs_cleanup_queue(0)
    if verification.get('status') == 'passed':
        cache.set(SQS_CLEANUP_PURGED_CACHE_KEY, True, timeout=86400)
    return _sqs_cleanup_step_result(
        'inspect-purged-queue',
        command,
        response,
        verification,
        started,
    )


def _run_sqs_delete_cleanup_queue() -> dict[str, Any]:
    command = 'aws sqs delete-queue --queue-url <cleanup-queue-url>'
    if not cache.get(SQS_CLEANUP_PURGED_CACHE_KEY):
        raise ValueError('Purge and inspect the cleanup queue before deleting it.')
    started = time.perf_counter()
    response = _sqs_client().delete_queue(QueueUrl=_sqs_cleanup_queue_url())
    cache.set(SQS_CLEANUP_DELETED_CACHE_KEY, True, timeout=86400)
    verification = _verify_sqs_cleanup_deleted()
    return _sqs_cleanup_step_result(
        'delete-queue',
        command,
        response,
        verification,
        started,
    )


def _sns_fanout_step_result(
    step_key: str,
    command: str,
    response: dict[str, Any],
    verification: dict[str, Any],
    started: float,
) -> dict[str, Any]:
    return {
        'service': 'sns',
        'lab': 'sqs-fanout',
        'step': step_key,
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sns_fanout_create_topic() -> dict[str, Any]:
    command = f'aws sns create-topic --name {SNS_FANOUT_TOPIC_NAME}'
    started = time.perf_counter()
    response = _sns_client().create_topic(Name=SNS_FANOUT_TOPIC_NAME)
    verification = _verify_sns_fanout_topic()
    return _sns_fanout_step_result(
        'create-topic',
        command,
        response,
        verification,
        started,
    )


def _run_sns_fanout_create_queue(
    queue_name: str,
    queue_arn: str,
    step_key: str,
) -> dict[str, Any]:
    command = f'aws sqs create-queue --queue-name {queue_name}'
    started = time.perf_counter()
    response = _sqs_client().create_queue(QueueName=queue_name)
    verification = _verify_sns_fanout_queue(queue_name, queue_arn)
    return _sns_fanout_step_result(
        step_key,
        command,
        response,
        verification,
        started,
    )


def _run_sns_fanout_set_queue_policy(
    queue_name: str,
    queue_arn: str,
    step_key: str,
    queue_url_label: str,
    artifact_name: str,
) -> dict[str, Any]:
    command = (
        f'aws sqs set-queue-attributes --queue-url <{queue_url_label}> '
        f'--attributes file://{artifact_name}'
    )
    started = time.perf_counter()
    response = _sqs_client().set_queue_attributes(
        QueueUrl=_sqs_queue_url(queue_name),
        Attributes={'Policy': json.dumps(_sns_fanout_queue_policy(queue_arn))},
    )
    verification = _verify_sns_fanout_queue_policy(queue_name, queue_arn)
    return _sns_fanout_step_result(
        step_key,
        command,
        response,
        verification,
        started,
    )


def _run_sns_fanout_subscribe(
    queue_arn: str,
    step_key: str,
) -> dict[str, Any]:
    command = (
        f'aws sns subscribe --topic-arn {SNS_FANOUT_TOPIC_ARN} '
        f'--protocol sqs --notification-endpoint {queue_arn} '
        '--attributes RawMessageDelivery=true --return-subscription-arn'
    )
    started = time.perf_counter()
    response = _sns_client().subscribe(
        TopicArn=SNS_FANOUT_TOPIC_ARN,
        Protocol='sqs',
        Endpoint=queue_arn,
        Attributes={'RawMessageDelivery': 'true'},
        ReturnSubscriptionArn=True,
    )
    verification = _verify_sns_fanout_subscription(queue_arn)
    return _sns_fanout_step_result(
        step_key,
        command,
        response,
        verification,
        started,
    )


def _run_sns_fanout_list_subscriptions() -> dict[str, Any]:
    command = (
        'aws sns list-subscriptions-by-topic '
        f'--topic-arn {SNS_FANOUT_TOPIC_ARN}'
    )
    started = time.perf_counter()
    response = _sns_client().list_subscriptions_by_topic(
        TopicArn=SNS_FANOUT_TOPIC_ARN,
    )
    orders = _verify_sns_fanout_subscription(SNS_FANOUT_ORDERS_QUEUE_ARN)
    audit = _verify_sns_fanout_subscription(SNS_FANOUT_AUDIT_QUEUE_ARN)
    verified = (
        orders.get('status') == 'passed'
        and audit.get('status') == 'passed'
    )
    verification = {
        'status': 'passed' if verified else 'failed',
        'message': (
            'Both SQS queues are confirmed raw-delivery subscribers.'
            if verified
            else 'Both expected subscriptions are not ready.'
        ),
        'resource': _clean_response(response),
    }
    return _sns_fanout_step_result(
        'list-subscriptions',
        command,
        response,
        verification,
        started,
    )


def _run_sns_fanout_publish() -> dict[str, Any]:
    command = (
        f'aws sns publish --topic-arn {SNS_FANOUT_TOPIC_ARN} '
        '--message file://order-created.json --subject "Order created" '
        '--message-attributes file://message-attributes.json'
    )
    started = time.perf_counter()
    response = _sns_client().publish(
        TopicArn=SNS_FANOUT_TOPIC_ARN,
        Message=SNS_FANOUT_MESSAGE_TEXT,
        Subject='Order created',
        MessageAttributes=SNS_FANOUT_MESSAGE_ATTRIBUTES,
    )
    orders = _verify_sns_fanout_delivery(SNS_FANOUT_ORDERS_QUEUE_NAME)
    audit = _verify_sns_fanout_delivery(SNS_FANOUT_AUDIT_QUEUE_NAME)
    verified = (
        orders.get('status') == 'passed'
        and audit.get('status') == 'passed'
    )
    verification = {
        'status': 'passed' if verified else 'failed',
        'message': (
            'One SNS publish delivered a copy to both SQS queues.'
            if verified
            else 'The event has not reached both queues.'
        ),
        'resource': {
            'publish': _clean_response(response),
            'orders_delivery': orders.get('resource'),
            'audit_delivery': audit.get('resource'),
        },
    }
    return _sns_fanout_step_result(
        'publish-message',
        command,
        response,
        verification,
        started,
    )


def _run_sns_fanout_receive(
    queue_name: str,
    step_key: str,
    queue_url_label: str,
) -> dict[str, Any]:
    command = (
        f'aws sqs receive-message --queue-url <{queue_url_label}> '
        '--max-number-of-messages 10 --visibility-timeout 0 '
        '--wait-time-seconds 1 --message-attribute-names All'
    )
    started = time.perf_counter()
    response = _sqs_client().receive_message(
        QueueUrl=_sqs_queue_url(queue_name),
        MaxNumberOfMessages=10,
        VisibilityTimeout=0,
        WaitTimeSeconds=1,
        MessageAttributeNames=['All'],
    )
    message = _sns_fanout_message(response.get('Messages', []))
    verification = {
        'status': 'passed' if message else 'failed',
        'message': (
            f'Queue {queue_name} received the raw order event and attributes.'
            if message
            else f'Queue {queue_name} did not return the expected event.'
        ),
        'resource': _clean_response(message) if message else None,
    }
    return _sns_fanout_step_result(
        step_key,
        command,
        response,
        verification,
        started,
    )


def _sns_filter_step_result(
    step_key: str,
    command: str,
    response: dict[str, Any],
    verification: dict[str, Any],
    started: float,
) -> dict[str, Any]:
    return {
        'service': 'sns',
        'lab': 'filter-policies',
        'step': step_key,
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sns_filter_create_topic() -> dict[str, Any]:
    command = f'aws sns create-topic --name {SNS_FILTER_TOPIC_NAME}'
    started = time.perf_counter()
    response = _sns_client().create_topic(Name=SNS_FILTER_TOPIC_NAME)
    verification = _verify_sns_filter_topic()
    return _sns_filter_step_result(
        'create-topic',
        command,
        response,
        verification,
        started,
    )


def _run_sns_filter_create_queue(
    queue_name: str,
    queue_arn: str,
    step_key: str,
) -> dict[str, Any]:
    command = f'aws sqs create-queue --queue-name {queue_name}'
    started = time.perf_counter()
    response = _sqs_client().create_queue(QueueName=queue_name)
    verification = _verify_sns_filter_queue(queue_name, queue_arn)
    return _sns_filter_step_result(
        step_key,
        command,
        response,
        verification,
        started,
    )


def _run_sns_filter_set_queue_policy(
    queue_name: str,
    queue_arn: str,
    step_key: str,
    queue_url_label: str,
    artifact_name: str,
) -> dict[str, Any]:
    command = (
        f'aws sqs set-queue-attributes --queue-url <{queue_url_label}> '
        f'--attributes file://{artifact_name}'
    )
    started = time.perf_counter()
    response = _sqs_client().set_queue_attributes(
        QueueUrl=_sqs_queue_url(queue_name),
        Attributes={'Policy': json.dumps(_sns_filter_queue_policy(queue_arn))},
    )
    verification = _verify_sns_filter_queue_policy(queue_name, queue_arn)
    return _sns_filter_step_result(
        step_key,
        command,
        response,
        verification,
        started,
    )


def _run_sns_filter_subscribe(
    queue_arn: str,
    filter_policy: dict[str, Any],
    step_key: str,
    artifact_name: str,
) -> dict[str, Any]:
    command = (
        f'aws sns subscribe --topic-arn {SNS_FILTER_TOPIC_ARN} '
        f'--protocol sqs --notification-endpoint {queue_arn} '
        f'--attributes file://{artifact_name} --return-subscription-arn'
    )
    attributes = {
        'RawMessageDelivery': 'true',
        'FilterPolicyScope': 'MessageAttributes',
        'FilterPolicy': json.dumps(filter_policy),
    }
    started = time.perf_counter()
    response = _sns_client().subscribe(
        TopicArn=SNS_FILTER_TOPIC_ARN,
        Protocol='sqs',
        Endpoint=queue_arn,
        Attributes=attributes,
        ReturnSubscriptionArn=True,
    )
    verification = _verify_sns_filter_subscription(queue_arn, filter_policy)
    return _sns_filter_step_result(
        step_key,
        command,
        response,
        verification,
        started,
    )


def _run_sns_filter_inspect() -> dict[str, Any]:
    command = (
        'aws sns get-subscription-attributes '
        '--subscription-arn <subscription-arn>'
    )
    started = time.perf_counter()
    subscriptions = _sns_filter_subscriptions()
    details = []
    for subscription in subscriptions:
        subscription_arn = subscription.get('SubscriptionArn')
        if subscription_arn and subscription_arn != 'PendingConfirmation':
            details.append(
                _sns_client().get_subscription_attributes(
                    SubscriptionArn=subscription_arn,
                ).get('Attributes', {})
            )
    created = _verify_sns_filter_subscription(
        SNS_FILTER_CREATED_QUEUE_ARN,
        SNS_FILTER_CREATED_POLICY,
    )
    priority = _verify_sns_filter_subscription(
        SNS_FILTER_PRIORITY_QUEUE_ARN,
        SNS_FILTER_PRIORITY_POLICY,
    )
    verified = (
        created.get('status') == 'passed'
        and priority.get('status') == 'passed'
    )
    response = {'Subscriptions': details}
    verification = {
        'status': 'passed' if verified else 'failed',
        'message': (
            'Both subscriptions expose the expected message-attribute filters.'
            if verified
            else 'Both subscription filters are not ready.'
        ),
        'resource': _clean_response(response),
    }
    return _sns_filter_step_result(
        'inspect-filter-policies',
        command,
        response,
        verification,
        started,
    )


def _run_sns_filter_publish(
    message_text: str,
    message_attributes: dict[str, Any],
    step_key: str,
    message_artifact: str,
    attributes_artifact: str,
) -> dict[str, Any]:
    command = (
        f'aws sns publish --topic-arn {SNS_FILTER_TOPIC_ARN} '
        f'--message file://{message_artifact} '
        f'--message-attributes file://{attributes_artifact}'
    )
    started = time.perf_counter()
    response = _sns_client().publish(
        TopicArn=SNS_FILTER_TOPIC_ARN,
        Message=message_text,
        MessageAttributes=message_attributes,
    )
    verification = {
        'status': 'passed' if response.get('MessageId') else 'failed',
        'message': (
            'SNS accepted the attributed event for filtered delivery.'
            if response.get('MessageId')
            else 'SNS did not return a message ID.'
        ),
        'resource': _clean_response(response),
    }
    return _sns_filter_step_result(
        step_key,
        command,
        response,
        verification,
        started,
    )


def _run_sns_filter_receive(
    queue_name: str,
    expected_body: str,
    excluded_body: str,
    step_key: str,
    queue_url_label: str,
) -> dict[str, Any]:
    command = (
        f'aws sqs receive-message --queue-url <{queue_url_label}> '
        '--max-number-of-messages 10 --visibility-timeout 0 '
        '--wait-time-seconds 1 --message-attribute-names All'
    )
    started = time.perf_counter()
    response = _sqs_client().receive_message(
        QueueUrl=_sqs_queue_url(queue_name),
        MaxNumberOfMessages=10,
        VisibilityTimeout=0,
        WaitTimeSeconds=1,
        MessageAttributeNames=['All'],
    )
    messages = response.get('Messages', [])
    bodies = [message.get('Body') for message in messages]
    verified = (
        len(messages) == 1
        and bodies == [expected_body]
        and excluded_body not in bodies
    )
    verification = {
        'status': 'passed' if verified else 'failed',
        'message': (
            f'Queue {queue_name} contains only the event selected by its filter.'
            if verified
            else f'Queue {queue_name} contains an unexpected routing result.'
        ),
        'resource': {'messages': _clean_response(messages)},
    }
    return _sns_filter_step_result(
        step_key,
        command,
        response,
        verification,
        started,
    )


def _scheduler_step_result(
    step_key: str,
    command: str,
    response: dict[str, Any],
    verification: dict[str, Any],
    started: float,
) -> dict[str, Any]:
    return {
        'service': 'scheduler',
        'lab': 'sqs-delivery',
        'step': step_key,
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_scheduler_create_queue() -> dict[str, Any]:
    command = f'aws sqs create-queue --queue-name {SCHEDULER_SQS_QUEUE_NAME}'
    started = time.perf_counter()
    response = _sqs_client().create_queue(QueueName=SCHEDULER_SQS_QUEUE_NAME)
    verification = _verify_scheduler_queue()
    return _scheduler_step_result(
        'create-queue',
        command,
        response,
        verification,
        started,
    )


def _run_scheduler_create_role() -> dict[str, Any]:
    command = (
        f'aws iam create-role --role-name {SCHEDULER_ROLE_NAME} '
        '--assume-role-policy-document file://scheduler-trust-policy.json'
    )
    started = time.perf_counter()
    try:
        response = _iam_client().create_role(
            RoleName=SCHEDULER_ROLE_NAME,
            AssumeRolePolicyDocument=json.dumps(SCHEDULER_TRUST_POLICY),
        )
    except ClientError as exc:
        if _error_code(exc) != 'EntityAlreadyExists':
            raise
        response = _iam_client().get_role(RoleName=SCHEDULER_ROLE_NAME)
    verification = _verify_scheduler_role()
    return _scheduler_step_result(
        'create-role',
        command,
        response,
        verification,
        started,
    )


def _run_scheduler_put_role_policy() -> dict[str, Any]:
    command = (
        f'aws iam put-role-policy --role-name {SCHEDULER_ROLE_NAME} '
        f'--policy-name {SCHEDULER_ROLE_POLICY_NAME} '
        '--policy-document file://send-message-policy.json'
    )
    started = time.perf_counter()
    response = _iam_client().put_role_policy(
        RoleName=SCHEDULER_ROLE_NAME,
        PolicyName=SCHEDULER_ROLE_POLICY_NAME,
        PolicyDocument=json.dumps(SCHEDULER_ROLE_POLICY),
    )
    verification = _verify_scheduler_role_policy()
    return _scheduler_step_result(
        'put-role-policy',
        command,
        response,
        verification,
        started,
    )


def _run_scheduler_create_group() -> dict[str, Any]:
    command = (
        'aws scheduler create-schedule-group '
        f'--name {SCHEDULER_GROUP_NAME}'
    )
    started = time.perf_counter()
    try:
        response = _scheduler_client().create_schedule_group(
            Name=SCHEDULER_GROUP_NAME,
        )
    except ClientError as exc:
        if _error_code(exc) != 'ConflictException':
            raise
        response = _scheduler_client().get_schedule_group(
            Name=SCHEDULER_GROUP_NAME,
        )
    verification = _verify_scheduler_group()
    return _scheduler_step_result(
        'create-schedule-group',
        command,
        response,
        verification,
        started,
    )


def _run_scheduler_create_schedule() -> dict[str, Any]:
    scheduled_time = datetime.now(timezone.utc) + timedelta(seconds=8)
    timestamp = scheduled_time.isoformat(timespec='seconds').replace('+00:00', '')
    expression = f'at({timestamp})'
    command = (
        f'aws scheduler create-schedule --name {SCHEDULER_SCHEDULE_NAME} '
        f'--group-name {SCHEDULER_GROUP_NAME} '
        f'--schedule-expression "{expression}" '
        '--flexible-time-window Mode=OFF --target file://target.json '
        '--action-after-completion DELETE'
    )
    target = {
        'Arn': SCHEDULER_SQS_QUEUE_ARN,
        'RoleArn': SCHEDULER_ROLE_ARN,
        'Input': SCHEDULER_MESSAGE_TEXT,
        'RetryPolicy': {
            'MaximumEventAgeInSeconds': 60,
            'MaximumRetryAttempts': 1,
        },
    }
    started = time.perf_counter()
    response = _scheduler_client().create_schedule(
        Name=SCHEDULER_SCHEDULE_NAME,
        GroupName=SCHEDULER_GROUP_NAME,
        ScheduleExpression=expression,
        FlexibleTimeWindow={'Mode': 'OFF'},
        Target=target,
        State='ENABLED',
        ActionAfterCompletion='DELETE',
        Description='Send a report.ready event to the local SQS lab queue.',
    )
    cache.set(SCHEDULER_EXPRESSION_CACHE_KEY, expression, timeout=86400)
    cache.set(SCHEDULER_CREATED_CACHE_KEY, True, timeout=86400)
    cache.delete_many([
        SCHEDULER_DELIVERED_CACHE_KEY,
        SCHEDULER_DELETED_CACHE_KEY,
    ])
    verification = _verify_scheduler_schedule()
    return _scheduler_step_result(
        'create-schedule',
        command,
        response,
        verification,
        started,
    )


def _run_scheduler_get_schedule() -> dict[str, Any]:
    command = (
        f'aws scheduler get-schedule --name {SCHEDULER_SCHEDULE_NAME} '
        f'--group-name {SCHEDULER_GROUP_NAME}'
    )
    started = time.perf_counter()
    response = _scheduler_client().get_schedule(
        Name=SCHEDULER_SCHEDULE_NAME,
        GroupName=SCHEDULER_GROUP_NAME,
    )
    verification = _verify_scheduler_schedule()
    return _scheduler_step_result(
        'get-schedule',
        command,
        response,
        verification,
        started,
    )


def _run_scheduler_receive_message() -> dict[str, Any]:
    command = (
        'aws sqs receive-message '
        '--queue-url <scheduled-reports-queue-url> '
        '--max-number-of-messages 10 --visibility-timeout 0 '
        '--wait-time-seconds 12'
    )
    started = time.perf_counter()
    response: dict[str, Any] = {}
    message = None
    deadline = time.monotonic() + 18
    while time.monotonic() < deadline:
        response = _sqs_client().receive_message(
            QueueUrl=_sqs_queue_url(SCHEDULER_SQS_QUEUE_NAME),
            MaxNumberOfMessages=10,
            VisibilityTimeout=0,
            WaitTimeSeconds=1,
        )
        message = _scheduler_message(response.get('Messages', []))
        if message:
            break
        time.sleep(0.1)
    if message:
        cache.set(SCHEDULER_DELIVERED_CACHE_KEY, True, timeout=86400)
        verification = {
            'status': 'passed',
            'message': 'EventBridge Scheduler delivered the report.ready event to SQS.',
            'resource': _clean_response(message),
        }
    else:
        verification = {
            'status': 'failed',
            'message': 'The scheduled report event did not arrive within the delivery window.',
        }
    return _scheduler_step_result(
        'receive-scheduled-message',
        command,
        response,
        verification,
        started,
    )


def _run_scheduler_confirm_deleted() -> dict[str, Any]:
    command = (
        f'aws scheduler get-schedule --name {SCHEDULER_SCHEDULE_NAME} '
        f'--group-name {SCHEDULER_GROUP_NAME}'
    )
    started = time.perf_counter()
    response: dict[str, Any] = {}
    deleted = False
    for _ in range(10):
        try:
            response = _scheduler_client().get_schedule(
                Name=SCHEDULER_SCHEDULE_NAME,
                GroupName=SCHEDULER_GROUP_NAME,
            )
        except ClientError as exc:
            if _error_code(exc) == 'ResourceNotFoundException':
                deleted = True
                response = {
                    'Error': {
                        'Code': _error_code(exc),
                        'Message': exc.response.get('Error', {}).get('Message'),
                    },
                }
                break
            raise
        time.sleep(0.1)
    if deleted:
        cache.set(SCHEDULER_DELETED_CACHE_KEY, True, timeout=86400)
    verification = _verify_scheduler_deleted()
    return _scheduler_step_result(
        'confirm-schedule-deleted',
        command,
        response,
        verification,
        started,
    )


def _cloudformation_step_result(
    step_key: str,
    command: str,
    response: dict[str, Any],
    verification: dict[str, Any],
    started: float,
) -> dict[str, Any]:
    return {
        'service': 'cloudformation',
        'lab': 's3-sqs-stack',
        'step': step_key,
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_cloudformation_validate_template() -> dict[str, Any]:
    command = (
        'aws cloudformation validate-template '
        '--template-body file://storage-messaging-stack.json'
    )
    started = time.perf_counter()
    response = _cloudformation_client().validate_template(
        TemplateBody=CLOUDFORMATION_TEMPLATE_TEXT,
    )
    verified = (
        response.get('Parameters') == []
        and response.get('Capabilities') == []
    )
    verification = {
        'status': 'passed' if verified else 'failed',
        'message': (
            'CloudFormation accepted the template with no parameters or capabilities.'
            if verified
            else 'CloudFormation did not validate the expected template shape.'
        ),
        'resource': _clean_response(response),
    }
    return _cloudformation_step_result(
        'validate-template',
        command,
        response,
        verification,
        started,
    )


def _run_cloudformation_create_stack() -> dict[str, Any]:
    command = (
        f'aws cloudformation create-stack --stack-name '
        f'{CLOUDFORMATION_STACK_NAME} '
        '--template-body file://storage-messaging-stack.json'
    )
    started = time.perf_counter()
    response = _cloudformation_client().create_stack(
        StackName=CLOUDFORMATION_STACK_NAME,
        TemplateBody=CLOUDFORMATION_TEMPLATE_TEXT,
    )
    stack = _wait_for_cloudformation_status(
        {'CREATE_COMPLETE', 'CREATE_FAILED', 'ROLLBACK_COMPLETE'},
    )
    if stack.get('StackStatus') == 'CREATE_COMPLETE':
        cache.set(CLOUDFORMATION_CREATED_CACHE_KEY, True, timeout=86400)
        cache.delete_many([
            CLOUDFORMATION_INSPECTED_CACHE_KEY,
            CLOUDFORMATION_DELETED_CACHE_KEY,
        ])
    verification = _verify_cloudformation_stack()
    output = {**_clean_response(response), 'Stack': _clean_response(stack)}
    return _cloudformation_step_result(
        'create-stack',
        command,
        output,
        verification,
        started,
    )


def _run_cloudformation_describe_stack() -> dict[str, Any]:
    command = (
        f'aws cloudformation describe-stacks '
        f'--stack-name {CLOUDFORMATION_STACK_NAME}'
    )
    started = time.perf_counter()
    response = _cloudformation_client().describe_stacks(
        StackName=CLOUDFORMATION_STACK_NAME,
    )
    verification = _verify_cloudformation_stack()
    return _cloudformation_step_result(
        'describe-stack',
        command,
        response,
        verification,
        started,
    )


def _run_cloudformation_describe_resources() -> dict[str, Any]:
    command = (
        f'aws cloudformation describe-stack-resources '
        f'--stack-name {CLOUDFORMATION_STACK_NAME}'
    )
    started = time.perf_counter()
    response = _cloudformation_client().describe_stack_resources(
        StackName=CLOUDFORMATION_STACK_NAME,
    )
    verification = _verify_cloudformation_resources()
    return _cloudformation_step_result(
        'describe-stack-resources',
        command,
        response,
        verification,
        started,
    )


def _run_cloudformation_describe_events() -> dict[str, Any]:
    command = (
        f'aws cloudformation describe-stack-events '
        f'--stack-name {CLOUDFORMATION_STACK_NAME}'
    )
    started = time.perf_counter()
    response = _cloudformation_client().describe_stack_events(
        StackName=CLOUDFORMATION_STACK_NAME,
    )
    verification = _verify_cloudformation_events()
    return _cloudformation_step_result(
        'describe-stack-events',
        command,
        response,
        verification,
        started,
    )


def _run_cloudformation_inspect_services() -> dict[str, Any]:
    command = (
        f'aws s3api head-bucket --bucket {CLOUDFORMATION_BUCKET_NAME}\n'
        'aws sqs get-queue-attributes --queue-url <queue-url> '
        '--attribute-names QueueArn VisibilityTimeout'
    )
    started = time.perf_counter()
    verification = _verify_cloudformation_service_resources()
    if verification.get('status') == 'passed':
        cache.set(CLOUDFORMATION_INSPECTED_CACHE_KEY, True, timeout=86400)
    response = verification.get('resource', {})
    return _cloudformation_step_result(
        'inspect-provisioned-resources',
        command,
        response,
        verification,
        started,
    )


def _run_cloudformation_delete_stack() -> dict[str, Any]:
    command = (
        f'aws cloudformation delete-stack '
        f'--stack-name {CLOUDFORMATION_STACK_NAME}'
    )
    if not cache.get(CLOUDFORMATION_INSPECTED_CACHE_KEY):
        raise ValueError('Inspect the provisioned resources before deleting the stack.')
    started = time.perf_counter()
    response = _cloudformation_client().delete_stack(
        StackName=CLOUDFORMATION_STACK_NAME,
    )
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        try:
            _cloudformation_stack()
        except ClientError:
            cache.set(CLOUDFORMATION_DELETED_CACHE_KEY, True, timeout=86400)
            break
        time.sleep(0.1)
    verification = _verify_cloudformation_deleted()
    return _cloudformation_step_result(
        'delete-stack',
        command,
        response,
        verification,
        started,
    )


def _run_cloudformation_confirm_deleted() -> dict[str, Any]:
    command = (
        f'aws cloudformation describe-stacks '
        f'--stack-name {CLOUDFORMATION_STACK_NAME}\n'
        f'aws s3api head-bucket --bucket {CLOUDFORMATION_BUCKET_NAME}\n'
        f'aws sqs get-queue-url --queue-name {CLOUDFORMATION_QUEUE_NAME}'
    )
    started = time.perf_counter()
    verification = _verify_cloudformation_deleted()
    response = {
        'stack_absent': verification.get('status') == 'passed',
        'bucket_absent': verification.get('status') == 'passed',
        'queue_absent': verification.get('status') == 'passed',
    }
    return _cloudformation_step_result(
        'confirm-resources-deleted',
        command,
        response,
        verification,
        started,
    )


def _ec2_network_step_result(
    step_key: str,
    command: str,
    response: dict[str, Any],
    verification: dict[str, Any],
    started: float,
) -> dict[str, Any]:
    return {
        'service': 'ec2',
        'lab': 'vpc-public-private',
        'step': step_key,
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _ec2_security_step_result(
    step_key: str,
    command: str,
    response: dict[str, Any],
    verification: dict[str, Any],
    started: float,
) -> dict[str, Any]:
    result = _ec2_network_step_result(
        step_key,
        command,
        response,
        verification,
        started,
    )
    result['lab'] = 'security-controls'
    return result


def _ec2_endpoint_step_result(
    step_key: str,
    command: str,
    response: dict[str, Any],
    verification: dict[str, Any],
    started: float,
) -> dict[str, Any]:
    result = _ec2_network_step_result(
        step_key, command, response, verification, started,
    )
    result['lab'] = 's3-gateway-endpoint'
    return result


def _ec2_interface_step_result(
    step_key: str,
    command: str,
    response: dict[str, Any],
    verification: dict[str, Any],
    started: float,
) -> dict[str, Any]:
    result = _ec2_network_step_result(
        step_key, command, response, verification, started,
    )
    result['lab'] = 'sqs-interface-endpoint'
    return result


def _run_ec2_create_vpc() -> dict[str, Any]:
    command = (
        f'aws ec2 create-vpc --cidr-block {EC2_VPC_CIDR} '
        '--tag-specifications file://vpc-tags.json'
    )
    started = time.perf_counter()
    response = _ec2_client().create_vpc(
        CidrBlock=EC2_VPC_CIDR,
        TagSpecifications=[{
            'ResourceType': 'vpc',
            'Tags': EC2_VPC_TAGS,
        }],
    )
    vpc_id = response.get('Vpc', {}).get('VpcId')
    if vpc_id:
        cache.set(EC2_VPC_ID_CACHE_KEY, vpc_id, timeout=86400)
    verification = _verify_ec2_vpc()
    return _ec2_network_step_result(
        'create-vpc', command, response, verification, started,
    )


def _run_ec2_create_subnet(
    cidr: str,
    availability_zone: str,
    cache_key: str,
    step_key: str,
) -> dict[str, Any]:
    command = (
        'aws ec2 create-subnet --vpc-id <vpc-id> '
        f'--cidr-block {cidr} --availability-zone {availability_zone}'
    )
    started = time.perf_counter()
    response = _ec2_client().create_subnet(
        VpcId=_ec2_cached_id(EC2_VPC_ID_CACHE_KEY, 'VPC ID'),
        CidrBlock=cidr,
        AvailabilityZone=availability_zone,
    )
    subnet = response.get('Subnet', {})
    if subnet.get('SubnetId'):
        cache.set(cache_key, subnet['SubnetId'], timeout=86400)
    verified = (
        subnet.get('CidrBlock') == cidr
        and subnet.get('AvailabilityZone') == availability_zone
    )
    verification = {
        'status': 'passed' if verified else 'failed',
        'message': (
            f'The {cidr} subnet was created in {availability_zone}.'
            if verified else 'The subnet response does not match the request.'
        ),
        'resource': _clean_response(subnet),
    }
    return _ec2_network_step_result(
        step_key, command, response, verification, started,
    )


def _run_ec2_create_public_subnet() -> dict[str, Any]:
    return _run_ec2_create_subnet(
        EC2_PUBLIC_SUBNET_CIDR,
        EC2_PUBLIC_AZ,
        EC2_PUBLIC_SUBNET_ID_CACHE_KEY,
        'create-public-subnet',
    )


def _run_ec2_create_private_subnet() -> dict[str, Any]:
    return _run_ec2_create_subnet(
        EC2_PRIVATE_SUBNET_CIDR,
        EC2_PRIVATE_AZ,
        EC2_PRIVATE_SUBNET_ID_CACHE_KEY,
        'create-private-subnet',
    )


def _run_ec2_enable_public_ip() -> dict[str, Any]:
    command = (
        'aws ec2 modify-subnet-attribute --subnet-id <public-subnet-id> '
        '--map-public-ip-on-launch'
    )
    started = time.perf_counter()
    subnet_id = _ec2_cached_id(
        EC2_PUBLIC_SUBNET_ID_CACHE_KEY,
        'Public subnet ID',
    )
    response = _ec2_client().modify_subnet_attribute(
        SubnetId=subnet_id,
        MapPublicIpOnLaunch={'Value': True},
    )
    public, _ = _verify_ec2_subnets()
    return _ec2_network_step_result(
        'enable-public-ip', command, response, public, started,
    )


def _run_ec2_create_igw() -> dict[str, Any]:
    command = 'aws ec2 create-internet-gateway'
    started = time.perf_counter()
    response = _ec2_client().create_internet_gateway()
    igw_id = response.get('InternetGateway', {}).get('InternetGatewayId')
    if igw_id:
        cache.set(EC2_IGW_ID_CACHE_KEY, igw_id, timeout=86400)
    verification = {
        'status': 'passed' if igw_id else 'failed',
        'message': 'The internet gateway was created.' if igw_id else 'No gateway ID was returned.',
        'resource': _clean_response(response.get('InternetGateway', {})),
    }
    return _ec2_network_step_result(
        'create-internet-gateway', command, response, verification, started,
    )


def _run_ec2_attach_igw() -> dict[str, Any]:
    command = (
        'aws ec2 attach-internet-gateway --internet-gateway-id <igw-id> '
        '--vpc-id <vpc-id>'
    )
    started = time.perf_counter()
    response = _ec2_client().attach_internet_gateway(
        InternetGatewayId=_ec2_cached_id(EC2_IGW_ID_CACHE_KEY, 'Gateway ID'),
        VpcId=_ec2_cached_id(EC2_VPC_ID_CACHE_KEY, 'VPC ID'),
    )
    verification = _verify_ec2_igw()
    return _ec2_network_step_result(
        'attach-internet-gateway', command, response, verification, started,
    )


def _run_ec2_create_route_table(
    cache_key: str,
    step_key: str,
    label: str,
) -> dict[str, Any]:
    command = 'aws ec2 create-route-table --vpc-id <vpc-id>'
    started = time.perf_counter()
    response = _ec2_client().create_route_table(
        VpcId=_ec2_cached_id(EC2_VPC_ID_CACHE_KEY, 'VPC ID'),
    )
    route_table = response.get('RouteTable', {})
    route_table_id = route_table.get('RouteTableId')
    if route_table_id:
        cache.set(cache_key, route_table_id, timeout=86400)
    verification = {
        'status': 'passed' if route_table_id else 'failed',
        'message': f'The {label} route table was created.',
        'resource': _clean_response(route_table),
    }
    return _ec2_network_step_result(
        step_key, command, response, verification, started,
    )


def _run_ec2_create_public_route_table() -> dict[str, Any]:
    return _run_ec2_create_route_table(
        EC2_PUBLIC_RT_ID_CACHE_KEY,
        'create-public-route-table',
        'public',
    )


def _run_ec2_create_private_route_table() -> dict[str, Any]:
    return _run_ec2_create_route_table(
        EC2_PRIVATE_RT_ID_CACHE_KEY,
        'create-private-route-table',
        'private',
    )


def _run_ec2_create_internet_route() -> dict[str, Any]:
    command = (
        'aws ec2 create-route --route-table-id <public-route-table-id> '
        '--destination-cidr-block 0.0.0.0/0 --gateway-id <igw-id>'
    )
    started = time.perf_counter()
    response = _ec2_client().create_route(
        RouteTableId=_ec2_cached_id(
            EC2_PUBLIC_RT_ID_CACHE_KEY,
            'Public route table ID',
        ),
        DestinationCidrBlock='0.0.0.0/0',
        GatewayId=_ec2_cached_id(EC2_IGW_ID_CACHE_KEY, 'Gateway ID'),
    )
    verification = {
        'status': 'passed' if response.get('Return') is True else 'failed',
        'message': 'The public route table now has an internet default route.',
        'resource': _clean_response(response),
    }
    return _ec2_network_step_result(
        'create-internet-route', command, response, verification, started,
    )


def _run_ec2_associate_route_table(
    route_table_cache_key: str,
    subnet_cache_key: str,
    association_cache_key: str,
    step_key: str,
    route_label: str,
) -> dict[str, Any]:
    command = (
        f'aws ec2 associate-route-table --route-table-id '
        f'<{route_label}-route-table-id> --subnet-id <{route_label}-subnet-id>'
    )
    started = time.perf_counter()
    response = _ec2_client().associate_route_table(
        RouteTableId=_ec2_cached_id(route_table_cache_key, 'Route table ID'),
        SubnetId=_ec2_cached_id(subnet_cache_key, 'Subnet ID'),
    )
    association_id = response.get('AssociationId')
    if association_id:
        cache.set(association_cache_key, association_id, timeout=86400)
    public, private = _verify_ec2_routes()
    verification = public if route_label == 'public' else private
    return _ec2_network_step_result(
        step_key, command, response, verification, started,
    )


def _run_ec2_associate_public_route_table() -> dict[str, Any]:
    return _run_ec2_associate_route_table(
        EC2_PUBLIC_RT_ID_CACHE_KEY,
        EC2_PUBLIC_SUBNET_ID_CACHE_KEY,
        EC2_PUBLIC_ASSOC_ID_CACHE_KEY,
        'associate-public-route-table',
        'public',
    )


def _run_ec2_associate_private_route_table() -> dict[str, Any]:
    return _run_ec2_associate_route_table(
        EC2_PRIVATE_RT_ID_CACHE_KEY,
        EC2_PRIVATE_SUBNET_ID_CACHE_KEY,
        EC2_PRIVATE_ASSOC_ID_CACHE_KEY,
        'associate-private-route-table',
        'private',
    )


def _run_ec2_inspect_network_topology() -> dict[str, Any]:
    command = (
        'aws ec2 describe-vpcs --vpc-ids <vpc-id>\n'
        'aws ec2 describe-subnets --filters Name=vpc-id,Values=<vpc-id>\n'
        'aws ec2 describe-internet-gateways '
        '--filters Name=attachment.vpc-id,Values=<vpc-id>\n'
        'aws ec2 describe-route-tables '
        '--filters Name=vpc-id,Values=<vpc-id>'
    )
    started = time.perf_counter()
    vpc = _ec2_lab_vpc()
    public_subnet, private_subnet = _verify_ec2_subnets()
    igw = _verify_ec2_igw()
    public_route, private_route = _verify_ec2_routes()
    verified = all(
        item.get('status') == 'passed'
        for item in [
            _verify_ec2_vpc(),
            public_subnet,
            private_subnet,
            igw,
            public_route,
            private_route,
        ]
    )
    response = {
        'Vpc': _clean_response(vpc),
        'Subnets': _clean_response(
            list(_ec2_lab_subnets(vpc['VpcId']).values()) if vpc else []
        ),
        'InternetGateway': igw.get('resource'),
        'RouteTables': _clean_response(
            _ec2_lab_route_tables(vpc['VpcId']) if vpc else []
        ),
    }
    verification = {
        'status': 'passed' if verified else 'failed',
        'message': (
            'The VPC has one internet-routed public subnet and one isolated private subnet.'
            if verified else 'The network topology is incomplete.'
        ),
        'resource': response,
    }
    return _ec2_network_step_result(
        'inspect-network-topology', command, response, verification, started,
    )


def _run_ec2_security_create_vpc() -> dict[str, Any]:
    command = (
        f'aws ec2 create-vpc --cidr-block {EC2_SECURITY_VPC_CIDR} '
        '--tag-specifications file://vpc-tags.json'
    )
    started = time.perf_counter()
    response = _ec2_client().create_vpc(
        CidrBlock=EC2_SECURITY_VPC_CIDR,
        TagSpecifications=[{
            'ResourceType': 'vpc',
            'Tags': EC2_SECURITY_VPC_TAGS,
        }],
    )
    vpc_id = response.get('Vpc', {}).get('VpcId')
    if vpc_id:
        cache.set(EC2_SECURITY_VPC_ID_CACHE_KEY, vpc_id, timeout=86400)
    verification = _verify_ec2_security_vpc()
    return _ec2_security_step_result(
        'create-vpc', command, response, verification, started,
    )


def _run_ec2_security_create_subnet() -> dict[str, Any]:
    command = (
        'aws ec2 create-subnet --vpc-id <vpc-id> '
        f'--cidr-block {EC2_SECURITY_SUBNET_CIDR} '
        f'--availability-zone {EC2_SECURITY_AZ}'
    )
    started = time.perf_counter()
    response = _ec2_client().create_subnet(
        VpcId=_ec2_cached_id(EC2_SECURITY_VPC_ID_CACHE_KEY, 'VPC ID'),
        CidrBlock=EC2_SECURITY_SUBNET_CIDR,
        AvailabilityZone=EC2_SECURITY_AZ,
    )
    subnet_id = response.get('Subnet', {}).get('SubnetId')
    if subnet_id:
        cache.set(EC2_SECURITY_SUBNET_ID_CACHE_KEY, subnet_id, timeout=86400)
    verification = _verify_ec2_security_subnet()
    return _ec2_security_step_result(
        'create-subnet', command, response, verification, started,
    )


def _run_ec2_create_security_group(
    group_name: str,
    description: str,
    cache_key: str,
    step_key: str,
) -> dict[str, Any]:
    command = (
        f'aws ec2 create-security-group --group-name {group_name} '
        f'--description "{description}" --vpc-id <vpc-id>'
    )
    started = time.perf_counter()
    response = _ec2_client().create_security_group(
        GroupName=group_name,
        Description=description,
        VpcId=_ec2_cached_id(EC2_SECURITY_VPC_ID_CACHE_KEY, 'VPC ID'),
    )
    group_id = response.get('GroupId')
    if group_id:
        cache.set(cache_key, group_id, timeout=86400)
    verification = {
        'status': 'passed' if group_id else 'failed',
        'message': f'Security group {group_name} was created.',
        'resource': _clean_response(response),
    }
    return _ec2_security_step_result(
        step_key, command, response, verification, started,
    )


def _run_ec2_allow_trusted_https() -> dict[str, Any]:
    command = (
        'aws ec2 authorize-security-group-ingress --group-id <web-sg-id> '
        '--ip-permissions file://trusted-https.json'
    )
    permission = {
        'IpProtocol': 'tcp',
        'FromPort': 443,
        'ToPort': 443,
        'IpRanges': [{
            'CidrIp': EC2_TRUSTED_CLIENT_CIDR,
            'Description': 'Trusted HTTPS clients',
        }],
    }
    started = time.perf_counter()
    response = _ec2_client().authorize_security_group_ingress(
        GroupId=_ec2_cached_id(EC2_WEB_SG_ID_CACHE_KEY, 'Web security group ID'),
        IpPermissions=[permission],
    )
    web, _ = _verify_ec2_security_group_rules()
    return _ec2_security_step_result(
        'allow-trusted-https', command, response, web, started,
    )


def _run_ec2_allow_web_to_app() -> dict[str, Any]:
    command = (
        'aws ec2 authorize-security-group-ingress --group-id <app-sg-id> '
        '--ip-permissions file://web-to-app.json'
    )
    web_group_id = _ec2_cached_id(
        EC2_WEB_SG_ID_CACHE_KEY,
        'Web security group ID',
    )
    permission = {
        'IpProtocol': 'tcp',
        'FromPort': 8080,
        'ToPort': 8080,
        'UserIdGroupPairs': [{
            'GroupId': web_group_id,
            'Description': 'Web tier to application tier',
        }],
    }
    started = time.perf_counter()
    response = _ec2_client().authorize_security_group_ingress(
        GroupId=_ec2_cached_id(EC2_APP_SG_ID_CACHE_KEY, 'App security group ID'),
        IpPermissions=[permission],
    )
    if response.get('Return') is True:
        cache.set(EC2_SG_REFERENCE_CACHE_KEY, True, timeout=86400)
    _, app = _verify_ec2_security_group_rules()
    return _ec2_security_step_result(
        'allow-web-to-app', command, response, app, started,
    )


def _run_ec2_inspect_security_groups() -> dict[str, Any]:
    command = (
        'aws ec2 describe-security-groups '
        '--group-ids <web-sg-id> <app-sg-id>\n'
        'aws ec2 describe-security-group-rules '
        '--filters Name=group-id,Values=<web-sg-id>,<app-sg-id>'
    )
    started = time.perf_counter()
    group_ids = [
        _ec2_cached_id(EC2_WEB_SG_ID_CACHE_KEY, 'Web security group ID'),
        _ec2_cached_id(EC2_APP_SG_ID_CACHE_KEY, 'App security group ID'),
    ]
    response = {
        'SecurityGroups': _ec2_client().describe_security_groups(
            GroupIds=group_ids,
        ).get('SecurityGroups', []),
        'SecurityGroupRules': _ec2_client().describe_security_group_rules(
            Filters=[{'Name': 'group-id', 'Values': group_ids}],
        ).get('SecurityGroupRules', []),
    }
    web, app = _verify_ec2_security_group_rules()
    verified = web.get('status') == 'passed' and app.get('status') == 'passed'
    verification = {
        'status': 'passed' if verified else 'failed',
        'message': (
            'The web and app security groups implement the intended stateful trust boundaries.'
            if verified else 'The security group rules are incomplete.'
        ),
        'resource': _clean_response(response),
    }
    return _ec2_security_step_result(
        'inspect-security-groups', command, response, verification, started,
    )


def _run_ec2_inspect_nacl_support() -> dict[str, Any]:
    command = (
        'aws ec2 describe-network-acls '
        '--filters Name=vpc-id,Values=<vpc-id>'
    )
    started = time.perf_counter()
    response: dict[str, Any]
    try:
        response = _ec2_client().describe_network_acls(
            Filters=[{
                'Name': 'vpc-id',
                'Values': [
                    _ec2_cached_id(
                        EC2_SECURITY_VPC_ID_CACHE_KEY,
                        'VPC ID',
                    ),
                ],
            }],
        )
        verification = {
            'status': 'failed',
            'message': 'Network ACL APIs unexpectedly succeeded; update the lab to exercise them.',
        }
    except ClientError as exc:
        if _error_code(exc) != 'UnsupportedOperation':
            raise
        cache.set(EC2_NACL_BOUNDARY_CACHE_KEY, True, timeout=86400)
        response = {
            'Error': {
                'Code': _error_code(exc),
                'Message': exc.response.get('Error', {}).get('Message'),
            },
            'IntendedRules': EC2_NACL_DESIGN,
        }
        verification = _verify_ec2_nacl_boundary()
    return _ec2_security_step_result(
        'inspect-network-acl-support',
        command,
        response,
        verification,
        started,
    )


def _run_ec2_endpoint_create_vpc() -> dict[str, Any]:
    command = (
        f'aws ec2 create-vpc --cidr-block {EC2_ENDPOINT_VPC_CIDR} '
        '--tag-specifications file://vpc-tags.json'
    )
    started = time.perf_counter()
    response = _ec2_client().create_vpc(
        CidrBlock=EC2_ENDPOINT_VPC_CIDR,
        TagSpecifications=[{
            'ResourceType': 'vpc',
            'Tags': EC2_ENDPOINT_VPC_TAGS,
        }],
    )
    vpc_id = response.get('Vpc', {}).get('VpcId')
    if vpc_id:
        cache.set(EC2_ENDPOINT_VPC_ID_CACHE_KEY, vpc_id, timeout=86400)
    return _ec2_endpoint_step_result(
        'create-vpc', command, response, _verify_ec2_endpoint_vpc(), started,
    )


def _run_ec2_endpoint_create_subnet() -> dict[str, Any]:
    command = (
        'aws ec2 create-subnet --vpc-id <vpc-id> '
        f'--cidr-block {EC2_ENDPOINT_SUBNET_CIDR} '
        f'--availability-zone {EC2_ENDPOINT_AZ}'
    )
    started = time.perf_counter()
    response = _ec2_client().create_subnet(
        VpcId=_ec2_cached_id(EC2_ENDPOINT_VPC_ID_CACHE_KEY, 'VPC ID'),
        CidrBlock=EC2_ENDPOINT_SUBNET_CIDR,
        AvailabilityZone=EC2_ENDPOINT_AZ,
    )
    subnet_id = response.get('Subnet', {}).get('SubnetId')
    if subnet_id:
        cache.set(EC2_ENDPOINT_SUBNET_ID_CACHE_KEY, subnet_id, timeout=86400)
    return _ec2_endpoint_step_result(
        'create-private-subnet',
        command,
        response,
        _verify_ec2_endpoint_subnet(),
        started,
    )


def _run_ec2_endpoint_create_route_table() -> dict[str, Any]:
    command = 'aws ec2 create-route-table --vpc-id <vpc-id>'
    started = time.perf_counter()
    response = _ec2_client().create_route_table(
        VpcId=_ec2_cached_id(EC2_ENDPOINT_VPC_ID_CACHE_KEY, 'VPC ID'),
    )
    route_table = response.get('RouteTable', {})
    route_table_id = route_table.get('RouteTableId')
    if route_table_id:
        cache.set(EC2_ENDPOINT_RT_ID_CACHE_KEY, route_table_id, timeout=86400)
    verification = {
        'status': 'passed' if route_table_id else 'failed',
        'message': 'The private route table was created.',
        'resource': _clean_response(route_table),
    }
    return _ec2_endpoint_step_result(
        'create-private-route-table', command, response, verification, started,
    )


def _run_ec2_endpoint_associate_route_table() -> dict[str, Any]:
    command = (
        'aws ec2 associate-route-table --route-table-id <route-table-id> '
        '--subnet-id <subnet-id>'
    )
    started = time.perf_counter()
    response = _ec2_client().associate_route_table(
        RouteTableId=_ec2_cached_id(EC2_ENDPOINT_RT_ID_CACHE_KEY, 'Route table ID'),
        SubnetId=_ec2_cached_id(EC2_ENDPOINT_SUBNET_ID_CACHE_KEY, 'Subnet ID'),
    )
    association_id = response.get('AssociationId')
    if association_id:
        cache.set(EC2_ENDPOINT_ASSOC_ID_CACHE_KEY, association_id, timeout=86400)
    return _ec2_endpoint_step_result(
        'associate-private-route-table',
        command,
        response,
        _verify_ec2_endpoint_route_table(),
        started,
    )


def _run_ec2_endpoint_create_bucket() -> dict[str, Any]:
    command = f'aws s3api create-bucket --bucket {EC2_ENDPOINT_BUCKET_NAME}'
    started = time.perf_counter()
    response = _s3_client().create_bucket(Bucket=EC2_ENDPOINT_BUCKET_NAME)
    return _ec2_endpoint_step_result(
        'create-s3-bucket',
        command,
        response,
        _verify_ec2_endpoint_bucket(),
        started,
    )


def _run_ec2_create_s3_gateway_endpoint() -> dict[str, Any]:
    ec2 = _ec2_client()
    service_name = f'com.amazonaws.{ec2.meta.region_name}.s3'
    command = (
        'aws ec2 create-vpc-endpoint --vpc-id <vpc-id> '
        '--vpc-endpoint-type Gateway '
        f'--service-name {service_name} '
        '--route-table-ids <route-table-id> '
        '--policy-document file://endpoint-policy.json'
    )
    started = time.perf_counter()
    response = ec2.create_vpc_endpoint(
        VpcId=_ec2_cached_id(EC2_ENDPOINT_VPC_ID_CACHE_KEY, 'VPC ID'),
        VpcEndpointType='Gateway',
        ServiceName=service_name,
        RouteTableIds=[
            _ec2_cached_id(EC2_ENDPOINT_RT_ID_CACHE_KEY, 'Route table ID'),
        ],
        PolicyDocument=json.dumps(EC2_ENDPOINT_POLICY),
    )
    endpoint_id = response.get('VpcEndpoint', {}).get('VpcEndpointId')
    if endpoint_id:
        cache.set(EC2_ENDPOINT_ID_CACHE_KEY, endpoint_id, timeout=86400)
        cache.set(EC2_ENDPOINT_CONFIGURED_CACHE_KEY, True, timeout=86400)
    return _ec2_endpoint_step_result(
        'create-s3-gateway-endpoint',
        command,
        response,
        _verify_ec2_s3_gateway_endpoint(),
        started,
    )


def _run_ec2_inspect_private_s3_path() -> dict[str, Any]:
    command = (
        'aws ec2 describe-vpc-endpoints '
        '--vpc-endpoint-ids <endpoint-id>\n'
        'aws ec2 describe-route-tables --route-table-ids <route-table-id>\n'
        f'aws s3api head-bucket --bucket {EC2_ENDPOINT_BUCKET_NAME}'
    )
    started = time.perf_counter()
    endpoint_id = _ec2_cached_id(EC2_ENDPOINT_ID_CACHE_KEY, 'Endpoint ID')
    route_table_id = _ec2_cached_id(
        EC2_ENDPOINT_RT_ID_CACHE_KEY,
        'Route table ID',
    )
    ec2 = _ec2_client()
    endpoints = ec2.describe_vpc_endpoints(
        VpcEndpointIds=[endpoint_id],
    ).get('VpcEndpoints', [])
    route_tables = ec2.describe_route_tables(
        RouteTableIds=[route_table_id],
    ).get('RouteTables', [])
    route_injected = any(
        route.get('DestinationPrefixListId')
        for table in route_tables
        for route in table.get('Routes', [])
    )
    if not route_injected:
        cache.set(EC2_ENDPOINT_ROUTE_BOUNDARY_CACHE_KEY, True, timeout=86400)
    response = {
        'VpcEndpoints': endpoints,
        'RouteTables': route_tables,
        'Bucket': _clean_response(
            _s3_client().head_bucket(Bucket=EC2_ENDPOINT_BUCKET_NAME)
        ),
        'AwsExpectedManagedPrefixListRoute': True,
        'FlociInjectedManagedPrefixListRoute': route_injected,
    }
    verification = _verify_ec2_endpoint_route_boundary()
    return _ec2_endpoint_step_result(
        'inspect-private-s3-path',
        command,
        response,
        verification,
        started,
    )

def _run_ec2_interface_create_vpc() -> dict[str, Any]:
    command = (
        f'aws ec2 create-vpc --cidr-block {EC2_INTERFACE_VPC_CIDR} '
        '--tag-specifications file://vpc-tags.json'
    )
    started = time.perf_counter()
    response = _ec2_client().create_vpc(
        CidrBlock=EC2_INTERFACE_VPC_CIDR,
        TagSpecifications=[{
            'ResourceType': 'vpc',
            'Tags': EC2_INTERFACE_VPC_TAGS,
        }],
    )
    vpc_id = response.get('Vpc', {}).get('VpcId')
    if vpc_id:
        cache.set(EC2_INTERFACE_VPC_ID_CACHE_KEY, vpc_id, timeout=86400)
    return _ec2_interface_step_result(
        'create-vpc', command, response, _verify_ec2_interface_vpc(), started,
    )


def _run_ec2_interface_create_subnet() -> dict[str, Any]:
    command = (
        'aws ec2 create-subnet --vpc-id <vpc-id> '
        f'--cidr-block {EC2_INTERFACE_SUBNET_CIDR} '
        f'--availability-zone {EC2_INTERFACE_AZ}'
    )
    started = time.perf_counter()
    response = _ec2_client().create_subnet(
        VpcId=_ec2_cached_id(EC2_INTERFACE_VPC_ID_CACHE_KEY, 'VPC ID'),
        CidrBlock=EC2_INTERFACE_SUBNET_CIDR,
        AvailabilityZone=EC2_INTERFACE_AZ,
    )
    subnet_id = response.get('Subnet', {}).get('SubnetId')
    if subnet_id:
        cache.set(EC2_INTERFACE_SUBNET_ID_CACHE_KEY, subnet_id, timeout=86400)
    return _ec2_interface_step_result(
        'create-private-subnet',
        command,
        response,
        _verify_ec2_interface_subnet(),
        started,
    )


def _run_ec2_interface_create_security_group() -> dict[str, Any]:
    command = (
        f'aws ec2 create-security-group --group-name {EC2_INTERFACE_SG_NAME} '
        '--description "Private SQS endpoint HTTPS" --vpc-id <vpc-id>'
    )
    started = time.perf_counter()
    response = _ec2_client().create_security_group(
        GroupName=EC2_INTERFACE_SG_NAME,
        Description='Private SQS endpoint HTTPS',
        VpcId=_ec2_cached_id(EC2_INTERFACE_VPC_ID_CACHE_KEY, 'VPC ID'),
    )
    group_id = response.get('GroupId')
    if group_id:
        cache.set(EC2_INTERFACE_SG_ID_CACHE_KEY, group_id, timeout=86400)
    verification = {
        'status': 'passed' if group_id else 'failed',
        'message': 'The endpoint security group was created.',
        'resource': _clean_response(response),
    }
    return _ec2_interface_step_result(
        'create-endpoint-security-group',
        command,
        response,
        verification,
        started,
    )


def _run_ec2_interface_allow_https() -> dict[str, Any]:
    command = (
        'aws ec2 authorize-security-group-ingress '
        '--group-id <endpoint-sg-id> '
        '--ip-permissions file://endpoint-https.json'
    )
    started = time.perf_counter()
    response = _ec2_client().authorize_security_group_ingress(
        GroupId=_ec2_cached_id(EC2_INTERFACE_SG_ID_CACHE_KEY, 'Security group ID'),
        IpPermissions=[{
            'IpProtocol': 'tcp',
            'FromPort': 443,
            'ToPort': 443,
            'IpRanges': [{
                'CidrIp': EC2_INTERFACE_VPC_CIDR,
                'Description': 'HTTPS from private VPC clients',
            }],
        }],
    )
    return _ec2_interface_step_result(
        'allow-vpc-https',
        command,
        response,
        _verify_ec2_interface_security_group(),
        started,
    )


def _run_ec2_interface_create_queue() -> dict[str, Any]:
    command = f'aws sqs create-queue --queue-name {EC2_INTERFACE_QUEUE_NAME}'
    started = time.perf_counter()
    response = _sqs_client().create_queue(QueueName=EC2_INTERFACE_QUEUE_NAME)
    return _ec2_interface_step_result(
        'create-sqs-queue',
        command,
        response,
        _verify_ec2_interface_queue(),
        started,
    )


def _run_ec2_create_sqs_interface_endpoint() -> dict[str, Any]:
    ec2 = _ec2_client()
    service_name = f'com.amazonaws.{ec2.meta.region_name}.sqs'
    command = (
        'aws ec2 create-vpc-endpoint --vpc-id <vpc-id> '
        '--vpc-endpoint-type Interface '
        f'--service-name {service_name} '
        '--subnet-ids <subnet-id> '
        '--security-group-ids <endpoint-sg-id> '
        '--private-dns-enabled '
        '--policy-document file://endpoint-policy.json'
    )
    started = time.perf_counter()
    response = ec2.create_vpc_endpoint(
        VpcId=_ec2_cached_id(EC2_INTERFACE_VPC_ID_CACHE_KEY, 'VPC ID'),
        VpcEndpointType='Interface',
        ServiceName=service_name,
        SubnetIds=[
            _ec2_cached_id(EC2_INTERFACE_SUBNET_ID_CACHE_KEY, 'Subnet ID'),
        ],
        SecurityGroupIds=[
            _ec2_cached_id(EC2_INTERFACE_SG_ID_CACHE_KEY, 'Security group ID'),
        ],
        PrivateDnsEnabled=True,
        PolicyDocument=json.dumps(EC2_INTERFACE_POLICY),
    )
    endpoint_id = response.get('VpcEndpoint', {}).get('VpcEndpointId')
    if endpoint_id:
        cache.set(EC2_INTERFACE_ENDPOINT_ID_CACHE_KEY, endpoint_id, timeout=86400)
        cache.set(EC2_INTERFACE_CONFIGURED_CACHE_KEY, True, timeout=86400)
    return _ec2_interface_step_result(
        'create-sqs-interface-endpoint',
        command,
        response,
        _verify_ec2_sqs_interface_endpoint(),
        started,
    )


def _run_ec2_inspect_private_sqs_path() -> dict[str, Any]:
    command = (
        'aws ec2 describe-vpc-endpoints --vpc-endpoint-ids <endpoint-id>\n'
        'aws ec2 describe-network-interfaces --network-interface-ids <eni-id>\n'
        'aws sqs get-queue-attributes --queue-url <queue-url> '
        '--attribute-names QueueArn'
    )
    started = time.perf_counter()
    endpoint_id = _ec2_cached_id(
        EC2_INTERFACE_ENDPOINT_ID_CACHE_KEY,
        'Endpoint ID',
    )
    ec2 = _ec2_client()
    endpoints = ec2.describe_vpc_endpoints(
        VpcEndpointIds=[endpoint_id],
    ).get('VpcEndpoints', [])
    endpoint = next(iter(endpoints), {})
    eni_ids = endpoint.get('NetworkInterfaceIds', [])
    network_interfaces: list[dict[str, Any]] = []
    network_interface_boundary = None
    if eni_ids:
        try:
            network_interfaces = ec2.describe_network_interfaces(
                NetworkInterfaceIds=eni_ids,
            ).get('NetworkInterfaces', [])
        except ClientError as exc:
            if _error_code(exc) != 'UnsupportedOperation':
                raise
            network_interface_boundary = _error_code(exc)
    queue_url = _sqs_queue_url(EC2_INTERFACE_QUEUE_NAME)
    queue = _sqs_client().get_queue_attributes(
        QueueUrl=queue_url,
        AttributeNames=['QueueArn'],
    )
    cache.set(EC2_INTERFACE_INSPECTED_CACHE_KEY, True, timeout=86400)
    response = {
        'VpcEndpoints': endpoints,
        'NetworkInterfaces': network_interfaces,
        'Queue': _clean_response(queue),
        'Expected': {
            'SubnetIds': [
                _ec2_cached_id(EC2_INTERFACE_SUBNET_ID_CACHE_KEY, 'Subnet ID'),
            ],
            'SecurityGroupIds': [
                _ec2_cached_id(EC2_INTERFACE_SG_ID_CACHE_KEY, 'Security group ID'),
            ],
            'PrivateDnsEnabled': True,
            'NetworkInterfaceCount': 1,
        },
        'NetworkInterfaceBoundary': network_interface_boundary,
    }
    return _ec2_interface_step_result(
        'inspect-private-sqs-path',
        command,
        response,
        _verify_ec2_interface_inspection(),
        started,
    )


def _run_sqs_get_basics_queue_url() -> dict[str, Any]:
    command = f'aws sqs get-queue-url --queue-name {SQS_BASICS_QUEUE_NAME}'
    started = time.perf_counter()
    response = _sqs_client().get_queue_url(QueueName=SQS_BASICS_QUEUE_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_sqs_basics_queue_url()

    return {
        'service': 'sqs',
        'lab': 'create-queue',
        'step': 'get-queue-url',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_get_basics_queue_attributes() -> dict[str, Any]:
    command = 'aws sqs get-queue-attributes --queue-url <queue-url> --attribute-names All'
    started = time.perf_counter()
    queue_url = _sqs_basics_queue_url()
    response = _sqs_client().get_queue_attributes(
        QueueUrl=queue_url,
        AttributeNames=['All'],
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_sqs_basics_queue_attributes()

    return {
        'service': 'sqs',
        'lab': 'create-queue',
        'step': 'get-queue-attributes',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_sqs_list_basics_queues() -> dict[str, Any]:
    command = 'aws sqs list-queues'
    started = time.perf_counter()
    response = _sqs_client().list_queues()
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_sqs_basics_listed()

    return {
        'service': 'sqs',
        'lab': 'create-queue',
        'step': 'list-queues',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _run_iam_get_floci_developers_group() -> dict[str, Any]:
    command = f'aws iam get-group --group-name {FLOCI_DEVELOPERS_GROUP_NAME}'
    started = time.perf_counter()
    response = _iam_client().get_group(GroupName=FLOCI_DEVELOPERS_GROUP_NAME)
    duration_ms = round((time.perf_counter() - started) * 1000)
    verification = _verify_alice_group_membership()

    return {
        'service': 'iam',
        'lab': 'group-membership-alice',
        'step': 'get-group',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(response),
        'stderr': '',
        'json': _clean_response(response),
        'duration_ms': duration_ms,
        'verified': verification.get('status') == 'passed',
        'verification': verification,
    }


def _reset_iam_attach_policy_alice() -> dict[str, Any]:
    command = (
        'aws iam detach-user-policy --user-name Alice '
        f'--policy-arn {ALICE_POLICY_ARN}\n'
        f'aws iam delete-policy --policy-arn {ALICE_POLICY_ARN}'
    )
    started = time.perf_counter()
    iam = _iam_client()
    detached = _ignore_missing(lambda: iam.detach_user_policy(UserName=ALICE_USER_NAME, PolicyArn=ALICE_POLICY_ARN))
    deleted = _ignore_missing(lambda: iam.delete_policy(PolicyArn=ALICE_POLICY_ARN))
    duration_ms = round((time.perf_counter() - started) * 1000)

    return {
        'service': 'iam',
        'lab': 'attach-policy-alice',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({'detached': detached, 'deleted': deleted}),
        'stderr': '',
        'json': {'detached': detached, 'deleted': deleted},
        'duration_ms': duration_ms,
        'reset': True,
        'detached': detached,
        'deleted': deleted,
        'verification': {
            'status': 'passed',
            'message': 'Alice policy attachment and customer managed policy were removed.',
        },
    }


def _reset_iam_group_membership_alice() -> dict[str, Any]:
    command = (
        f'aws iam remove-user-from-group --group-name {FLOCI_DEVELOPERS_GROUP_NAME} --user-name Alice\n'
        f'aws iam delete-group --group-name {FLOCI_DEVELOPERS_GROUP_NAME}'
    )
    started = time.perf_counter()
    iam = _iam_client()
    removed = _ignore_missing(lambda: iam.remove_user_from_group(
        GroupName=FLOCI_DEVELOPERS_GROUP_NAME,
        UserName=ALICE_USER_NAME,
    ))
    deleted = _ignore_missing(lambda: iam.delete_group(GroupName=FLOCI_DEVELOPERS_GROUP_NAME))
    duration_ms = round((time.perf_counter() - started) * 1000)

    return {
        'service': 'iam',
        'lab': 'group-membership-alice',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({'removed': removed, 'deleted': deleted}),
        'stderr': '',
        'json': {'removed': removed, 'deleted': deleted},
        'duration_ms': duration_ms,
        'reset': True,
        'removed': removed,
        'deleted': deleted,
        'verification': {
            'status': 'passed',
            'message': f'Alice group membership and {FLOCI_DEVELOPERS_GROUP_NAME} were removed.',
        },
    }


def _reset_iam_group_policy_floci_developers() -> dict[str, Any]:
    command = (
        f'aws iam detach-group-policy --group-name {FLOCI_DEVELOPERS_GROUP_NAME} '
        f'--policy-arn {FLOCI_DEVELOPERS_POLICY_ARN}\n'
        f'aws iam delete-policy --policy-arn {FLOCI_DEVELOPERS_POLICY_ARN}\n'
        f'aws iam remove-user-from-group --group-name {FLOCI_DEVELOPERS_GROUP_NAME} --user-name Alice\n'
        f'aws iam delete-group --group-name {FLOCI_DEVELOPERS_GROUP_NAME}'
    )
    started = time.perf_counter()
    iam = _iam_client()
    detached = _ignore_missing(lambda: iam.detach_group_policy(
        GroupName=FLOCI_DEVELOPERS_GROUP_NAME,
        PolicyArn=FLOCI_DEVELOPERS_POLICY_ARN,
    ))
    deleted_policy = _ignore_missing(lambda: iam.delete_policy(PolicyArn=FLOCI_DEVELOPERS_POLICY_ARN))
    removed = _ignore_missing(lambda: iam.remove_user_from_group(
        GroupName=FLOCI_DEVELOPERS_GROUP_NAME,
        UserName=ALICE_USER_NAME,
    ))
    deleted_group = _ignore_missing(lambda: iam.delete_group(GroupName=FLOCI_DEVELOPERS_GROUP_NAME))
    duration_ms = round((time.perf_counter() - started) * 1000)

    return {
        'service': 'iam',
        'lab': 'group-policy-floci-developers',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({
            'detached': detached,
            'deleted_policy': deleted_policy,
            'removed': removed,
            'deleted_group': deleted_group,
        }),
        'stderr': '',
        'json': {
            'detached': detached,
            'deleted_policy': deleted_policy,
            'removed': removed,
            'deleted_group': deleted_group,
        },
        'duration_ms': duration_ms,
        'reset': True,
        'detached': detached,
        'deleted_policy': deleted_policy,
        'removed': removed,
        'deleted_group': deleted_group,
        'verification': {
            'status': 'passed',
            'message': f'{FLOCI_DEVELOPERS_POLICY_NAME}, Alice group membership, and {FLOCI_DEVELOPERS_GROUP_NAME} were removed.',
        },
    }


def _reset_iam_inline_policy_alice() -> dict[str, Any]:
    command = f'aws iam delete-user-policy --user-name Alice --policy-name {ALICE_INLINE_POLICY_NAME}'
    started = time.perf_counter()
    deleted = _ignore_missing(lambda: _iam_client().delete_user_policy(
        UserName=ALICE_USER_NAME,
        PolicyName=ALICE_INLINE_POLICY_NAME,
    ))
    duration_ms = round((time.perf_counter() - started) * 1000)

    return {
        'service': 'iam',
        'lab': 'inline-policy-alice',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({'deleted': deleted}),
        'stderr': '',
        'json': {'deleted': deleted},
        'duration_ms': duration_ms,
        'reset': True,
        'deleted': deleted,
        'verification': {
            'status': 'passed',
            'message': f'Inline policy {ALICE_INLINE_POLICY_NAME} was removed from Alice.',
        },
    }


def _reset_iam_role_trust_policy() -> dict[str, Any]:
    command = (
        f'aws iam delete-role-policy --role-name {FLOCI_APPLICATION_ROLE_NAME} '
        f'--policy-name {FLOCI_APPLICATION_ROLE_POLICY_NAME}\n'
        f'aws iam delete-role --role-name {FLOCI_APPLICATION_ROLE_NAME}'
    )
    started = time.perf_counter()
    iam = _iam_client()
    deleted_policy = _ignore_missing(lambda: iam.delete_role_policy(
        RoleName=FLOCI_APPLICATION_ROLE_NAME,
        PolicyName=FLOCI_APPLICATION_ROLE_POLICY_NAME,
    ))
    deleted_role = _ignore_missing(lambda: iam.delete_role(RoleName=FLOCI_APPLICATION_ROLE_NAME))
    duration_ms = round((time.perf_counter() - started) * 1000)

    return {
        'service': 'iam',
        'lab': 'role-trust-policy',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({'deleted_policy': deleted_policy, 'deleted_role': deleted_role}),
        'stderr': '',
        'json': {'deleted_policy': deleted_policy, 'deleted_role': deleted_role},
        'duration_ms': duration_ms,
        'reset': True,
        'deleted_policy': deleted_policy,
        'deleted_role': deleted_role,
        'verification': {
            'status': 'passed',
            'message': f'Role {FLOCI_APPLICATION_ROLE_NAME} and its inline policy were removed.',
        },
    }


def _reset_iam_ec2_instance_profile() -> dict[str, Any]:
    command = (
        f'aws iam remove-role-from-instance-profile --instance-profile-name {FLOCI_EC2_INSTANCE_PROFILE_NAME} '
        f'--role-name {FLOCI_EC2_ROLE_NAME}\n'
        f'aws iam delete-instance-profile --instance-profile-name {FLOCI_EC2_INSTANCE_PROFILE_NAME}\n'
        f'aws iam delete-role --role-name {FLOCI_EC2_ROLE_NAME}'
    )
    started = time.perf_counter()
    iam = _iam_client()
    removed = _ignore_missing(lambda: iam.remove_role_from_instance_profile(
        InstanceProfileName=FLOCI_EC2_INSTANCE_PROFILE_NAME,
        RoleName=FLOCI_EC2_ROLE_NAME,
    ))
    deleted_profile = _ignore_missing(lambda: iam.delete_instance_profile(
        InstanceProfileName=FLOCI_EC2_INSTANCE_PROFILE_NAME,
    ))
    deleted_role = _ignore_missing(lambda: iam.delete_role(RoleName=FLOCI_EC2_ROLE_NAME))
    duration_ms = round((time.perf_counter() - started) * 1000)

    return {
        'service': 'iam',
        'lab': 'ec2-instance-profile',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({
            'removed': removed,
            'deleted_profile': deleted_profile,
            'deleted_role': deleted_role,
        }),
        'stderr': '',
        'json': {
            'removed': removed,
            'deleted_profile': deleted_profile,
            'deleted_role': deleted_role,
        },
        'duration_ms': duration_ms,
        'reset': True,
        'removed': removed,
        'deleted_profile': deleted_profile,
        'deleted_role': deleted_role,
        'verification': {
            'status': 'passed',
            'message': f'Instance profile {FLOCI_EC2_INSTANCE_PROFILE_NAME} and role {FLOCI_EC2_ROLE_NAME} were removed.',
        },
    }


def _reset_s3_bucket(lab_key: str, bucket_name: str) -> dict[str, Any]:
    command = (
        f'aws s3api delete-objects --bucket {bucket_name} --delete file://objects.json\n'
        f'aws s3api delete-bucket --bucket {bucket_name}'
    )
    started = time.perf_counter()
    s3 = _s3_client()
    deleted_objects = 0
    deleted_bucket = False

    try:
        versions = s3.get_paginator('list_object_versions').paginate(
            Bucket=bucket_name,
        )
        for page in versions:
            objects = [
                {'Key': item['Key'], 'VersionId': item['VersionId']}
                for item in [*page.get('Versions', []), *page.get('DeleteMarkers', [])]
                if item.get('Key') and item.get('VersionId')
            ]
            if objects:
                s3.delete_objects(
                    Bucket=bucket_name,
                    Delete={'Objects': objects, 'Quiet': True},
                )
                deleted_objects += len(objects)

        contents = s3.get_paginator('list_objects_v2').paginate(
            Bucket=bucket_name,
        )
        for page in contents:
            objects = [
                {'Key': item['Key']}
                for item in page.get('Contents', [])
                if item.get('Key')
            ]
            if objects:
                s3.delete_objects(
                    Bucket=bucket_name,
                    Delete={'Objects': objects, 'Quiet': True},
                )
                deleted_objects += len(objects)

        s3.delete_bucket(Bucket=bucket_name)
        deleted_bucket = True
    except ClientError as exc:
        if _error_code(exc) != 'NoSuchBucket':
            raise

    duration_ms = round((time.perf_counter() - started) * 1000)

    return {
        'service': 's3',
        'lab': lab_key,
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({
            'deleted_objects': deleted_objects,
            'deleted_bucket': deleted_bucket,
        }),
        'stderr': '',
        'json': {
            'deleted_objects': deleted_objects,
            'deleted_bucket': deleted_bucket,
        },
        'duration_ms': duration_ms,
        'reset': True,
        'deleted_objects': deleted_objects,
        'deleted_bucket': deleted_bucket,
        'verification': {
            'status': 'passed',
            'message': (
                f'Bucket {bucket_name} and its contents were removed.'
                if deleted_bucket
                else f'Bucket {bucket_name} was already absent.'
            ),
        },
    }


def _reset_s3_create_bucket() -> dict[str, Any]:
    return _reset_s3_bucket('create-bucket', S3_BASICS_BUCKET_NAME)


def _reset_s3_object_workflow() -> dict[str, Any]:
    return _reset_s3_bucket('object-workflow', S3_OBJECTS_BUCKET_NAME)


def _reset_s3_prefix_copy() -> dict[str, Any]:
    return _reset_s3_bucket('prefix-copy', S3_PREFIXES_BUCKET_NAME)


def _reset_s3_metadata_tags() -> dict[str, Any]:
    return _reset_s3_bucket('metadata-tags', S3_METADATA_BUCKET_NAME)


def _reset_s3_version_recovery() -> dict[str, Any]:
    return _reset_s3_bucket('version-recovery', S3_VERSIONING_BUCKET_NAME)


def _reset_s3_presigned_url() -> dict[str, Any]:
    return _reset_s3_bucket('presigned-url', S3_PRESIGNED_BUCKET_NAME)


def _reset_s3_bucket_security() -> dict[str, Any]:
    s3 = _s3_client()
    for action, missing_codes in (
        (
            lambda: s3.delete_bucket_policy(Bucket=S3_SECURITY_BUCKET_NAME),
            {'NoSuchBucket', 'NoSuchBucketPolicy'},
        ),
        (
            lambda: s3.delete_public_access_block(Bucket=S3_SECURITY_BUCKET_NAME),
            {'NoSuchBucket', 'NoSuchPublicAccessBlockConfiguration'},
        ),
    ):
        try:
            action()
        except ClientError as exc:
            if _error_code(exc) not in missing_codes:
                raise
    return _reset_s3_bucket('bucket-security', S3_SECURITY_BUCKET_NAME)


def _reset_s3_default_encryption() -> dict[str, Any]:
    try:
        _s3_client().delete_bucket_encryption(Bucket=S3_ENCRYPTION_BUCKET_NAME)
    except ClientError as exc:
        if _error_code(exc) not in {
            'NoSuchBucket',
            'ServerSideEncryptionConfigurationNotFoundError',
        }:
            raise
    return _reset_s3_bucket('default-encryption', S3_ENCRYPTION_BUCKET_NAME)


def _reset_s3_lifecycle_retention() -> dict[str, Any]:
    try:
        _s3_client().delete_bucket_lifecycle(Bucket=S3_LIFECYCLE_BUCKET_NAME)
    except ClientError as exc:
        if _error_code(exc) not in {
            'NoSuchBucket',
            'NoSuchLifecycleConfiguration',
        }:
            raise
    return _reset_s3_bucket('lifecycle-retention', S3_LIFECYCLE_BUCKET_NAME)


def _reset_s3_bucket_cors() -> dict[str, Any]:
    try:
        _s3_client().delete_bucket_cors(Bucket=S3_CORS_BUCKET_NAME)
    except ClientError as exc:
        if _error_code(exc) not in {
            'NoSuchBucket',
            'NoSuchCORSConfiguration',
        }:
            raise
    return _reset_s3_bucket('bucket-cors', S3_CORS_BUCKET_NAME)


def _reset_s3_object_notifications() -> dict[str, Any]:
    try:
        _s3_client().put_bucket_notification_configuration(
            Bucket=S3_NOTIFICATIONS_BUCKET_NAME,
            NotificationConfiguration={},
        )
    except ClientError as exc:
        if _error_code(exc) != 'NoSuchBucket':
            raise

    result = _reset_s3_bucket(
        'object-notifications-sqs',
        S3_NOTIFICATIONS_BUCKET_NAME,
    )
    deleted_queue = False
    try:
        queue_url = _s3_notifications_queue_url()
        _sqs_client().delete_queue(QueueUrl=queue_url)
        deleted_queue = True
    except ClientError as exc:
        if _error_code(exc) not in {
            'AWS.SimpleQueueService.NonExistentQueue',
            'QueueDoesNotExist',
        }:
            raise

    result['command'] = (
        f'aws s3api put-bucket-notification-configuration --bucket '
        f'{S3_NOTIFICATIONS_BUCKET_NAME} --notification-configuration file://empty.json\n'
        f'aws s3api delete-objects --bucket {S3_NOTIFICATIONS_BUCKET_NAME} --delete file://objects.json\n'
        f'aws s3api delete-bucket --bucket {S3_NOTIFICATIONS_BUCKET_NAME}\n'
        'aws sqs delete-queue --queue-url <queue-url>'
    )
    result['deleted_queue'] = deleted_queue
    result['json']['deleted_queue'] = deleted_queue
    result['stdout'] = _json_text(result['json'])
    result['verification'] = {
        'status': 'passed',
        'message': (
            f'Notification wiring, bucket {S3_NOTIFICATIONS_BUCKET_NAME}, '
            f'and queue {S3_NOTIFICATIONS_QUEUE_NAME} were removed.'
        ),
    }
    return result


def _reset_s3_multipart_upload() -> dict[str, Any]:
    aborted_uploads = 0
    try:
        s3 = _s3_client()
        pages = s3.get_paginator('list_multipart_uploads').paginate(
            Bucket=S3_MULTIPART_BUCKET_NAME,
            Prefix=S3_MULTIPART_OBJECT_KEY,
        )
        for page in pages:
            for upload in page.get('Uploads', []):
                if (
                    upload.get('Key') == S3_MULTIPART_OBJECT_KEY
                    and upload.get('UploadId')
                ):
                    s3.abort_multipart_upload(
                        Bucket=S3_MULTIPART_BUCKET_NAME,
                        Key=S3_MULTIPART_OBJECT_KEY,
                        UploadId=upload['UploadId'],
                    )
                    aborted_uploads += 1
    except ClientError as exc:
        if _error_code(exc) != 'NoSuchBucket':
            raise

    result = _reset_s3_bucket('multipart-upload', S3_MULTIPART_BUCKET_NAME)
    result['command'] = (
        f'aws s3api abort-multipart-upload --bucket {S3_MULTIPART_BUCKET_NAME} '
        f'--key {S3_MULTIPART_OBJECT_KEY} --upload-id <upload-id>\n'
        f'aws s3api delete-objects --bucket {S3_MULTIPART_BUCKET_NAME} --delete file://objects.json\n'
        f'aws s3api delete-bucket --bucket {S3_MULTIPART_BUCKET_NAME}'
    )
    result['aborted_uploads'] = aborted_uploads
    result['json']['aborted_uploads'] = aborted_uploads
    result['stdout'] = _json_text(result['json'])
    result['verification'] = {
        'status': 'passed',
        'message': (
            f'Multipart uploads, object data, and bucket '
            f'{S3_MULTIPART_BUCKET_NAME} were removed.'
        ),
    }
    return result


def _reset_sqs_create_queue() -> dict[str, Any]:
    command = 'aws sqs delete-queue --queue-url <queue-url>'
    started = time.perf_counter()
    deleted = False
    try:
        queue_url = _sqs_basics_queue_url()
        _sqs_client().delete_queue(QueueUrl=queue_url)
        deleted = True
    except ClientError as exc:
        if _error_code(exc) not in {
            'AWS.SimpleQueueService.NonExistentQueue',
            'QueueDoesNotExist',
        }:
            raise
    duration_ms = round((time.perf_counter() - started) * 1000)

    return {
        'service': 'sqs',
        'lab': 'create-queue',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({'deleted': deleted}),
        'stderr': '',
        'json': {'deleted': deleted},
        'duration_ms': duration_ms,
        'reset': True,
        'deleted': deleted,
        'verification': {
            'status': 'passed',
            'message': (
                f'Queue {SQS_BASICS_QUEUE_NAME} was removed.'
                if deleted
                else f'Queue {SQS_BASICS_QUEUE_NAME} was already absent.'
            ),
        },
    }


def _reset_sqs_message_lifecycle() -> dict[str, Any]:
    command = (
        'aws sqs receive-message --queue-url <queue-url> '
        '--max-number-of-messages 10 --visibility-timeout 30\n'
        'aws sqs delete-message --queue-url <queue-url> '
        '--receipt-handle <receipt-handle>'
    )
    started = time.perf_counter()
    deleted_messages = 0
    try:
        queue_url = _sqs_basics_queue_url()
        response = _sqs_receive_lab_messages(visibility_timeout=30)
        for message in response.get('Messages', []):
            if (
                _sqs_lifecycle_message([message])
                and message.get('ReceiptHandle')
            ):
                _sqs_client().delete_message(
                    QueueUrl=queue_url,
                    ReceiptHandle=message['ReceiptHandle'],
                )
                deleted_messages += 1
    except ClientError as exc:
        if _error_code(exc) not in {
            'AWS.SimpleQueueService.NonExistentQueue',
            'QueueDoesNotExist',
        }:
            raise
    cache.delete(SQS_MESSAGE_DELETE_CACHE_KEY)
    duration_ms = round((time.perf_counter() - started) * 1000)

    return {
        'service': 'sqs',
        'lab': 'message-lifecycle',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({'deleted_messages': deleted_messages}),
        'stderr': '',
        'json': {'deleted_messages': deleted_messages},
        'duration_ms': duration_ms,
        'reset': True,
        'deleted_messages': deleted_messages,
        'verification': {
            'status': 'passed',
            'message': (
                'Lifecycle messages and stored completion state were cleared; '
                f'queue {SQS_BASICS_QUEUE_NAME} was left in place.'
            ),
        },
    }


def _reset_sqs_visibility_timeout() -> dict[str, Any]:
    command = (
        'aws sqs change-message-visibility --queue-url <queue-url> '
        '--receipt-handle <receipt-handle> --visibility-timeout 0\n'
        'aws sqs receive-message --queue-url <queue-url> '
        '--max-number-of-messages 10 --visibility-timeout 30\n'
        'aws sqs delete-message --queue-url <queue-url> '
        '--receipt-handle <receipt-handle>'
    )
    started = time.perf_counter()
    deleted_messages = 0
    try:
        queue_url = _sqs_basics_queue_url()
        receipt_handle = cache.get(SQS_VISIBILITY_RECEIPT_CACHE_KEY)
        if receipt_handle:
            try:
                _sqs_client().change_message_visibility(
                    QueueUrl=queue_url,
                    ReceiptHandle=receipt_handle,
                    VisibilityTimeout=0,
                )
            except ClientError as exc:
                if _error_code(exc) not in {'ReceiptHandleIsInvalid', 'InvalidParameterValue'}:
                    raise
        response = _sqs_receive_lab_messages(
            visibility_timeout=30,
            wait_time_seconds=1,
        )
        for message in response.get('Messages', []):
            if (
                _sqs_visibility_message([message])
                and message.get('ReceiptHandle')
            ):
                _sqs_client().delete_message(
                    QueueUrl=queue_url,
                    ReceiptHandle=message['ReceiptHandle'],
                )
                deleted_messages += 1
    except ClientError as exc:
        if _error_code(exc) not in {
            'AWS.SimpleQueueService.NonExistentQueue',
            'QueueDoesNotExist',
        }:
            raise
    cache.delete_many([
        SQS_VISIBILITY_RECEIPT_CACHE_KEY,
        SQS_VISIBILITY_EXTENDED_CACHE_KEY,
        SQS_VISIBILITY_HIDDEN_CACHE_KEY,
        SQS_VISIBILITY_SHORTENED_CACHE_KEY,
        SQS_VISIBILITY_RETURNED_CACHE_KEY,
    ])
    duration_ms = round((time.perf_counter() - started) * 1000)

    return {
        'service': 'sqs',
        'lab': 'visibility-timeout',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({'deleted_messages': deleted_messages}),
        'stderr': '',
        'json': {'deleted_messages': deleted_messages},
        'duration_ms': duration_ms,
        'reset': True,
        'deleted_messages': deleted_messages,
        'verification': {
            'status': 'passed',
            'message': (
                'Visibility-lab messages and timing state were cleared; '
                f'queue {SQS_BASICS_QUEUE_NAME} was left in place.'
            ),
        },
    }


def _reset_sqs_delayed_message() -> dict[str, Any]:
    command = (
        'aws sqs receive-message --queue-url <queue-url> '
        '--max-number-of-messages 10 --visibility-timeout 30 --wait-time-seconds 12\n'
        'aws sqs delete-message --queue-url <queue-url> '
        '--receipt-handle <receipt-handle>'
    )
    started = time.perf_counter()
    deleted_messages = 0
    try:
        queue_url = _sqs_basics_queue_url()
        response, _ = _sqs_wait_for_delayed_message(
            wait_seconds=12.5,
            visibility_timeout=30,
        )
        for message in response.get('Messages', []):
            if (
                _sqs_delayed_message([message])
                and message.get('ReceiptHandle')
            ):
                _sqs_client().delete_message(
                    QueueUrl=queue_url,
                    ReceiptHandle=message['ReceiptHandle'],
                )
                deleted_messages += 1
    except ClientError as exc:
        if _error_code(exc) not in {
            'AWS.SimpleQueueService.NonExistentQueue',
            'QueueDoesNotExist',
        }:
            raise
    cache.delete_many([
        SQS_DELAYED_OBSERVED_CACHE_KEY,
        SQS_DELAYED_RETURNED_CACHE_KEY,
    ])
    duration_ms = round((time.perf_counter() - started) * 1000)

    return {
        'service': 'sqs',
        'lab': 'delayed-message',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({'deleted_messages': deleted_messages}),
        'stderr': '',
        'json': {'deleted_messages': deleted_messages},
        'duration_ms': duration_ms,
        'reset': True,
        'deleted_messages': deleted_messages,
        'verification': {
            'status': 'passed',
            'message': (
                'Delayed-lab messages and timing state were cleared; '
                f'queue {SQS_BASICS_QUEUE_NAME} was left in place.'
            ),
        },
    }


def _reset_sqs_batch_messages() -> dict[str, Any]:
    command = (
        'aws sqs receive-message --queue-url <queue-url> '
        '--max-number-of-messages 10 --visibility-timeout 30\n'
        'aws sqs delete-message-batch --queue-url <queue-url> '
        '--entries file://delete-batch.json'
    )
    started = time.perf_counter()
    deleted_messages = 0
    try:
        queue_url = _sqs_basics_queue_url()
        messages, _ = _sqs_collect_batch_messages(
            wait_seconds=2,
            visibility_timeout=30,
        )
        entries = [
            {
                'Id': f'task-{index}',
                'ReceiptHandle': message['ReceiptHandle'],
            }
            for index, message in enumerate(messages, start=1)
            if message.get('ReceiptHandle')
        ]
        if entries:
            response = _sqs_client().delete_message_batch(
                QueueUrl=queue_url,
                Entries=entries,
            )
            deleted_messages = len(response.get('Successful', []))
    except ClientError as exc:
        if _error_code(exc) not in {
            'AWS.SimpleQueueService.NonExistentQueue',
            'QueueDoesNotExist',
        }:
            raise
    cache.delete(SQS_BATCH_DELETE_CACHE_KEY)
    duration_ms = round((time.perf_counter() - started) * 1000)

    return {
        'service': 'sqs',
        'lab': 'batch-messages',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({'deleted_messages': deleted_messages}),
        'stderr': '',
        'json': {'deleted_messages': deleted_messages},
        'duration_ms': duration_ms,
        'reset': True,
        'deleted_messages': deleted_messages,
        'verification': {
            'status': 'passed',
            'message': (
                'Batch-lab messages and completion state were cleared; '
                f'queue {SQS_BASICS_QUEUE_NAME} was left in place.'
            ),
        },
    }


def _reset_sqs_queue_configuration() -> dict[str, Any]:
    command = (
        'aws sqs set-queue-attributes --queue-url <queue-url> '
        '--attributes file://default-queue-attributes.json\n'
        'aws sqs untag-queue --queue-url <queue-url> '
        '--tag-keys Environment Purpose'
    )
    started = time.perf_counter()
    reset = False
    try:
        queue_url = _sqs_basics_queue_url()
        _sqs_client().set_queue_attributes(
            QueueUrl=queue_url,
            Attributes=SQS_DEFAULT_ATTRIBUTES,
        )
        _sqs_client().untag_queue(
            QueueUrl=queue_url,
            TagKeys=list(SQS_CONFIGURATION_TAGS),
        )
        reset = True
    except ClientError as exc:
        if _error_code(exc) not in {
            'AWS.SimpleQueueService.NonExistentQueue',
            'QueueDoesNotExist',
        }:
            raise
    duration_ms = round((time.perf_counter() - started) * 1000)

    return {
        'service': 'sqs',
        'lab': 'queue-configuration',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({
            'reset_attributes': reset,
            'removed_tags': reset,
        }),
        'stderr': '',
        'json': {
            'reset_attributes': reset,
            'removed_tags': reset,
        },
        'duration_ms': duration_ms,
        'reset': True,
        'reset_attributes': reset,
        'removed_tags': reset,
        'verification': {
            'status': 'passed',
            'message': (
                'Queue processing attributes were restored to defaults and '
                'the lab tags were removed; the shared queue was left in place.'
                if reset
                else f'Queue {SQS_BASICS_QUEUE_NAME} was already absent.'
            ),
        },
    }


def _reset_sqs_dead_letter_redrive() -> dict[str, Any]:
    command = (
        f'aws sqs list-message-move-tasks --source-arn {SQS_REDRIVE_DLQ_ARN} '
        '--max-results 10\n'
        'aws sqs cancel-message-move-task --task-handle <task-handle>\n'
        'aws sqs delete-queue --queue-url <source-queue-url>\n'
        'aws sqs delete-queue --queue-url <dlq-url>'
    )
    started = time.perf_counter()
    cancelled_tasks = 0
    deleted_queues: list[str] = []
    try:
        tasks = _sqs_client().list_message_move_tasks(
            SourceArn=SQS_REDRIVE_DLQ_ARN,
            MaxResults=10,
        )
        for task in tasks.get('Results', []):
            if task.get('Status') == 'RUNNING' and task.get('TaskHandle'):
                _sqs_client().cancel_message_move_task(
                    TaskHandle=task['TaskHandle'],
                )
                cancelled_tasks += 1
    except ClientError as exc:
        if _error_code(exc) not in {
            'AWS.SimpleQueueService.NonExistentQueue',
            'QueueDoesNotExist',
            'ResourceNotFoundException',
        }:
            raise

    for queue_name in (
        SQS_REDRIVE_SOURCE_QUEUE_NAME,
        SQS_REDRIVE_DLQ_NAME,
    ):
        try:
            queue_url = _sqs_queue_url(queue_name)
            _sqs_client().delete_queue(QueueUrl=queue_url)
            deleted_queues.append(queue_name)
        except ClientError as exc:
            if _error_code(exc) not in {
                'AWS.SimpleQueueService.NonExistentQueue',
                'QueueDoesNotExist',
            }:
                raise

    cache.delete_many([
        SQS_REDRIVE_FAILURE_ONE_CACHE_KEY,
        SQS_REDRIVE_FAILURE_TWO_CACHE_KEY,
        SQS_REDRIVE_TRIGGERED_CACHE_KEY,
        SQS_REDRIVE_DLQ_OBSERVED_CACHE_KEY,
        SQS_REDRIVE_TASK_CACHE_KEY,
        SQS_REDRIVE_RETURNED_CACHE_KEY,
    ])
    output = {
        'cancelled_tasks': cancelled_tasks,
        'deleted_queues': deleted_queues,
    }
    return {
        'service': 'sqs',
        'lab': 'dead-letter-redrive',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(output),
        'stderr': '',
        'json': output,
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'reset': True,
        **output,
        'verification': {
            'status': 'passed',
            'message': 'The redrive task state, source queue, and dead-letter queue were cleared.',
        },
    }


def _reset_sqs_fifo_ordering() -> dict[str, Any]:
    command = 'aws sqs delete-queue --queue-url <fifo-queue-url>'
    started = time.perf_counter()
    deleted = False
    try:
        queue_url = _sqs_fifo_queue_url()
        _sqs_client().delete_queue(QueueUrl=queue_url)
        deleted = True
    except ClientError as exc:
        if _error_code(exc) not in {
            'AWS.SimpleQueueService.NonExistentQueue',
            'QueueDoesNotExist',
        }:
            raise
    cache.delete_many([
        SQS_FIFO_FIRST_SEND_CACHE_KEY,
        SQS_FIFO_DEDUPLICATED_CACHE_KEY,
        SQS_FIFO_ORDERED_CACHE_KEY,
    ])
    output = {
        'deleted_queue': deleted,
        'queue_name': SQS_FIFO_QUEUE_NAME,
    }
    return {
        'service': 'sqs',
        'lab': 'fifo-ordering',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(output),
        'stderr': '',
        'json': output,
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'reset': True,
        **output,
        'verification': {
            'status': 'passed',
            'message': (
                f'FIFO queue {SQS_FIFO_QUEUE_NAME} and its lab state were removed.'
                if deleted
                else f'FIFO queue {SQS_FIFO_QUEUE_NAME} was already absent.'
            ),
        },
    }


def _reset_sqs_purge_delete() -> dict[str, Any]:
    command = 'aws sqs delete-queue --queue-url <cleanup-queue-url>'
    started = time.perf_counter()
    deleted = False
    try:
        queue_url = _sqs_cleanup_queue_url()
        _sqs_client().delete_queue(QueueUrl=queue_url)
        deleted = True
    except ClientError as exc:
        if _error_code(exc) not in {
            'AWS.SimpleQueueService.NonExistentQueue',
            'QueueDoesNotExist',
        }:
            raise
    cache.delete_many([
        SQS_CLEANUP_POPULATED_CACHE_KEY,
        SQS_CLEANUP_PURGED_CACHE_KEY,
        SQS_CLEANUP_DELETED_CACHE_KEY,
    ])
    output = {
        'deleted_queue': deleted,
        'queue_name': SQS_CLEANUP_QUEUE_NAME,
    }
    return {
        'service': 'sqs',
        'lab': 'purge-delete',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(output),
        'stderr': '',
        'json': output,
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'reset': True,
        **output,
        'verification': {
            'status': 'passed',
            'message': (
                f'Cleanup queue {SQS_CLEANUP_QUEUE_NAME} and lab state were removed.'
                if deleted
                else f'Cleanup queue {SQS_CLEANUP_QUEUE_NAME} was already absent.'
            ),
        },
    }


def _reset_sns_sqs_fanout() -> dict[str, Any]:
    command = (
        f'aws sns list-subscriptions-by-topic --topic-arn {SNS_FANOUT_TOPIC_ARN}\n'
        'aws sns unsubscribe --subscription-arn <subscription-arn>\n'
        f'aws sns delete-topic --topic-arn {SNS_FANOUT_TOPIC_ARN}\n'
        'aws sqs delete-queue --queue-url <orders-queue-url>\n'
        'aws sqs delete-queue --queue-url <audit-queue-url>'
    )
    started = time.perf_counter()
    unsubscribed = 0
    deleted_topic = False
    deleted_queues: list[str] = []
    try:
        for subscription in _sns_fanout_subscriptions():
            subscription_arn = subscription.get('SubscriptionArn')
            if subscription_arn and subscription_arn != 'PendingConfirmation':
                _sns_client().unsubscribe(SubscriptionArn=subscription_arn)
                unsubscribed += 1
        _sns_client().delete_topic(TopicArn=SNS_FANOUT_TOPIC_ARN)
        deleted_topic = True
    except ClientError as exc:
        if _error_code(exc) not in {'NotFound', 'NotFoundException'}:
            raise

    for queue_name in (
        SNS_FANOUT_ORDERS_QUEUE_NAME,
        SNS_FANOUT_AUDIT_QUEUE_NAME,
    ):
        try:
            queue_url = _sqs_queue_url(queue_name)
            _sqs_client().delete_queue(QueueUrl=queue_url)
            deleted_queues.append(queue_name)
        except ClientError as exc:
            if _error_code(exc) not in {
                'AWS.SimpleQueueService.NonExistentQueue',
                'QueueDoesNotExist',
            }:
                raise
    output = {
        'unsubscribed': unsubscribed,
        'deleted_topic': deleted_topic,
        'deleted_queues': deleted_queues,
    }
    return {
        'service': 'sns',
        'lab': 'sqs-fanout',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(output),
        'stderr': '',
        'json': output,
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'reset': True,
        **output,
        'verification': {
            'status': 'passed',
            'message': 'SNS fan-out subscriptions, topic, and both SQS queues were removed.',
        },
    }


def _reset_sns_filter_policies() -> dict[str, Any]:
    command = (
        f'aws sns list-subscriptions-by-topic --topic-arn {SNS_FILTER_TOPIC_ARN}\n'
        'aws sns unsubscribe --subscription-arn <subscription-arn>\n'
        f'aws sns delete-topic --topic-arn {SNS_FILTER_TOPIC_ARN}\n'
        'aws sqs delete-queue --queue-url <created-queue-url>\n'
        'aws sqs delete-queue --queue-url <priority-queue-url>'
    )
    started = time.perf_counter()
    unsubscribed = 0
    deleted_topic = False
    deleted_queues: list[str] = []
    try:
        for subscription in _sns_filter_subscriptions():
            subscription_arn = subscription.get('SubscriptionArn')
            if subscription_arn and subscription_arn != 'PendingConfirmation':
                _sns_client().unsubscribe(SubscriptionArn=subscription_arn)
                unsubscribed += 1
        _sns_client().delete_topic(TopicArn=SNS_FILTER_TOPIC_ARN)
        deleted_topic = True
    except ClientError as exc:
        if _error_code(exc) not in {'NotFound', 'NotFoundException'}:
            raise
    for queue_name in (
        SNS_FILTER_CREATED_QUEUE_NAME,
        SNS_FILTER_PRIORITY_QUEUE_NAME,
    ):
        try:
            _sqs_client().delete_queue(QueueUrl=_sqs_queue_url(queue_name))
            deleted_queues.append(queue_name)
        except ClientError as exc:
            if _error_code(exc) not in {
                'AWS.SimpleQueueService.NonExistentQueue',
                'QueueDoesNotExist',
            }:
                raise
    output = {
        'unsubscribed': unsubscribed,
        'deleted_topic': deleted_topic,
        'deleted_queues': deleted_queues,
    }
    return {
        'service': 'sns',
        'lab': 'filter-policies',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(output),
        'stderr': '',
        'json': output,
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'reset': True,
        **output,
        'verification': {
            'status': 'passed',
            'message': 'Filtered subscriptions, topic, and both queues were removed.',
        },
    }


def _reset_scheduler_sqs_delivery() -> dict[str, Any]:
    command = (
        f'aws scheduler delete-schedule --name {SCHEDULER_SCHEDULE_NAME} '
        f'--group-name {SCHEDULER_GROUP_NAME}\n'
        f'aws scheduler delete-schedule-group --name {SCHEDULER_GROUP_NAME}\n'
        f'aws iam delete-role-policy --role-name {SCHEDULER_ROLE_NAME} '
        f'--policy-name {SCHEDULER_ROLE_POLICY_NAME}\n'
        f'aws iam delete-role --role-name {SCHEDULER_ROLE_NAME}\n'
        'aws sqs delete-queue --queue-url <scheduled-reports-queue-url>'
    )
    started = time.perf_counter()
    deleted_schedule = False
    deleted_group = False
    deleted_policy = False
    deleted_role = False
    deleted_queue = False
    try:
        _scheduler_client().delete_schedule(
            Name=SCHEDULER_SCHEDULE_NAME,
            GroupName=SCHEDULER_GROUP_NAME,
        )
        deleted_schedule = True
    except ClientError as exc:
        if _error_code(exc) != 'ResourceNotFoundException':
            raise
    try:
        _scheduler_client().delete_schedule_group(Name=SCHEDULER_GROUP_NAME)
        deleted_group = True
    except ClientError as exc:
        if _error_code(exc) != 'ResourceNotFoundException':
            raise
    try:
        _iam_client().delete_role_policy(
            RoleName=SCHEDULER_ROLE_NAME,
            PolicyName=SCHEDULER_ROLE_POLICY_NAME,
        )
        deleted_policy = True
    except ClientError as exc:
        if _error_code(exc) != 'NoSuchEntity':
            raise
    try:
        _iam_client().delete_role(RoleName=SCHEDULER_ROLE_NAME)
        deleted_role = True
    except ClientError as exc:
        if _error_code(exc) != 'NoSuchEntity':
            raise
    try:
        _sqs_client().delete_queue(QueueUrl=_sqs_queue_url(SCHEDULER_SQS_QUEUE_NAME))
        deleted_queue = True
    except ClientError as exc:
        if _error_code(exc) not in {
            'AWS.SimpleQueueService.NonExistentQueue',
            'QueueDoesNotExist',
        }:
            raise
    cache.delete_many([
        SCHEDULER_EXPRESSION_CACHE_KEY,
        SCHEDULER_CREATED_CACHE_KEY,
        SCHEDULER_DELIVERED_CACHE_KEY,
        SCHEDULER_DELETED_CACHE_KEY,
    ])
    output = {
        'deleted_schedule': deleted_schedule,
        'deleted_group': deleted_group,
        'deleted_policy': deleted_policy,
        'deleted_role': deleted_role,
        'deleted_queue': deleted_queue,
    }
    return {
        'service': 'scheduler',
        'lab': 'sqs-delivery',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(output),
        'stderr': '',
        'json': output,
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'reset': True,
        **output,
        'verification': {
            'status': 'passed',
            'message': 'Schedule resources, execution role, and target queue were removed.',
        },
    }


def _reset_cloudformation_s3_sqs() -> dict[str, Any]:
    command = (
        f'aws cloudformation delete-stack '
        f'--stack-name {CLOUDFORMATION_STACK_NAME}'
    )
    started = time.perf_counter()
    deleted_stack = False
    deleted_bucket = False
    deleted_queue = False
    try:
        _cloudformation_client().delete_stack(
            StackName=CLOUDFORMATION_STACK_NAME,
        )
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            try:
                _cloudformation_stack()
            except ClientError:
                deleted_stack = True
                break
            time.sleep(0.1)
    except ClientError:
        deleted_stack = True

    try:
        _s3_client().head_bucket(Bucket=CLOUDFORMATION_BUCKET_NAME)
    except ClientError:
        deleted_bucket = True
    if not deleted_bucket:
        bucket_result = _reset_s3_bucket(
            's3-sqs-stack',
            CLOUDFORMATION_BUCKET_NAME,
        )
        deleted_bucket = bucket_result.get('deleted_bucket', False)

    try:
        queue_url = _sqs_queue_url(CLOUDFORMATION_QUEUE_NAME)
        _sqs_client().delete_queue(QueueUrl=queue_url)
        deleted_queue = True
    except ClientError as exc:
        if _error_code(exc) in {
            'AWS.SimpleQueueService.NonExistentQueue',
            'QueueDoesNotExist',
        }:
            deleted_queue = True
        else:
            raise

    cache.delete_many([
        CLOUDFORMATION_CREATED_CACHE_KEY,
        CLOUDFORMATION_INSPECTED_CACHE_KEY,
        CLOUDFORMATION_DELETED_CACHE_KEY,
    ])
    output = {
        'deleted_stack': deleted_stack,
        'deleted_bucket': deleted_bucket,
        'deleted_queue': deleted_queue,
    }
    return {
        'service': 'cloudformation',
        'lab': 's3-sqs-stack',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(output),
        'stderr': '',
        'json': output,
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'reset': True,
        **output,
        'verification': {
            'status': 'passed',
            'message': 'The CloudFormation stack and its S3 and SQS resources were removed.',
        },
    }


def _reset_ec2_vpc_networking() -> dict[str, Any]:
    command = (
        'aws ec2 disassociate-route-table --association-id <association-id>\n'
        'aws ec2 delete-route-table --route-table-id <route-table-id>\n'
        'aws ec2 detach-internet-gateway --internet-gateway-id <igw-id> '
        '--vpc-id <vpc-id>\n'
        'aws ec2 delete-internet-gateway --internet-gateway-id <igw-id>\n'
        'aws ec2 delete-subnet --subnet-id <subnet-id>\n'
        'aws ec2 delete-vpc --vpc-id <vpc-id>'
    )
    started = time.perf_counter()
    ec2 = _ec2_client()
    deleted_associations = 0
    deleted_route_tables = 0
    deleted_subnets = 0
    deleted_igw = False
    deleted_vpc = False
    vpc = None
    try:
        vpc = _ec2_lab_vpc()
    except ClientError:
        vpc = None
    if vpc:
        vpc_id = vpc['VpcId']
        subnets = _ec2_lab_subnets(vpc_id)
        subnet_ids = {
            subnet.get('SubnetId')
            for cidr, subnet in subnets.items()
            if cidr in {EC2_PUBLIC_SUBNET_CIDR, EC2_PRIVATE_SUBNET_CIDR}
        }
        route_tables = _ec2_lab_route_tables(vpc_id)
        custom_tables = []
        for table in route_tables:
            matching_associations = [
                association
                for association in table.get('Associations', [])
                if association.get('SubnetId') in subnet_ids
            ]
            if not matching_associations:
                continue
            custom_tables.append(table)
            for association in matching_associations:
                association_id = association.get('RouteTableAssociationId')
                if association_id:
                    ec2.disassociate_route_table(AssociationId=association_id)
                    deleted_associations += 1
        for table in custom_tables:
            ec2.delete_route_table(RouteTableId=table['RouteTableId'])
            deleted_route_tables += 1

        igw = _ec2_lab_igw(vpc_id)
        if igw:
            igw_id = igw['InternetGatewayId']
            ec2.detach_internet_gateway(
                InternetGatewayId=igw_id,
                VpcId=vpc_id,
            )
            ec2.delete_internet_gateway(InternetGatewayId=igw_id)
            deleted_igw = True

        for subnet_id in subnet_ids:
            if subnet_id:
                ec2.delete_subnet(SubnetId=subnet_id)
                deleted_subnets += 1
        ec2.delete_vpc(VpcId=vpc_id)
        deleted_vpc = True

    cache.delete_many([
        EC2_VPC_ID_CACHE_KEY,
        EC2_PUBLIC_SUBNET_ID_CACHE_KEY,
        EC2_PRIVATE_SUBNET_ID_CACHE_KEY,
        EC2_IGW_ID_CACHE_KEY,
        EC2_PUBLIC_RT_ID_CACHE_KEY,
        EC2_PRIVATE_RT_ID_CACHE_KEY,
        EC2_PUBLIC_ASSOC_ID_CACHE_KEY,
        EC2_PRIVATE_ASSOC_ID_CACHE_KEY,
    ])
    output = {
        'deleted_associations': deleted_associations,
        'deleted_route_tables': deleted_route_tables,
        'deleted_subnets': deleted_subnets,
        'deleted_internet_gateway': deleted_igw,
        'deleted_vpc': deleted_vpc,
    }
    return {
        'service': 'ec2',
        'lab': 'vpc-public-private',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(output),
        'stderr': '',
        'json': output,
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'reset': True,
        **output,
        'verification': {
            'status': 'passed',
            'message': 'Route associations, route tables, gateway, subnets, and VPC were removed in dependency order.',
        },
    }


def _reset_ec2_security_controls() -> dict[str, Any]:
    command = (
        'aws ec2 delete-security-group --group-id <app-sg-id>\n'
        'aws ec2 delete-security-group --group-id <web-sg-id>\n'
        'aws ec2 delete-subnet --subnet-id <subnet-id>\n'
        'aws ec2 delete-vpc --vpc-id <vpc-id>'
    )
    started = time.perf_counter()
    ec2 = _ec2_client()
    deleted_groups = 0
    deleted_subnet = False
    deleted_vpc = False
    vpc = None
    try:
        vpc = _ec2_security_vpc()
    except ClientError:
        vpc = None
    if vpc:
        groups = _ec2_security_groups(vpc['VpcId'])
        for group_name in (EC2_APP_SG_NAME, EC2_WEB_SG_NAME):
            group = groups.get(group_name)
            if group:
                ec2.delete_security_group(GroupId=group['GroupId'])
                deleted_groups += 1
        subnet_response = ec2.describe_subnets(
            Filters=[
                {'Name': 'vpc-id', 'Values': [vpc['VpcId']]},
                {'Name': 'cidr-block', 'Values': [EC2_SECURITY_SUBNET_CIDR]},
            ],
        )
        subnet = next(iter(subnet_response.get('Subnets', [])), None)
        if subnet:
            ec2.delete_subnet(SubnetId=subnet['SubnetId'])
            deleted_subnet = True
        ec2.delete_vpc(VpcId=vpc['VpcId'])
        deleted_vpc = True
    cache.delete_many([
        EC2_SECURITY_VPC_ID_CACHE_KEY,
        EC2_SECURITY_SUBNET_ID_CACHE_KEY,
        EC2_WEB_SG_ID_CACHE_KEY,
        EC2_APP_SG_ID_CACHE_KEY,
        EC2_SG_REFERENCE_CACHE_KEY,
        EC2_NACL_BOUNDARY_CACHE_KEY,
    ])
    output = {
        'deleted_security_groups': deleted_groups,
        'deleted_subnet': deleted_subnet,
        'deleted_vpc': deleted_vpc,
    }
    return {
        'service': 'ec2',
        'lab': 'security-controls',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(output),
        'stderr': '',
        'json': output,
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'reset': True,
        **output,
        'verification': {
            'status': 'passed',
            'message': 'The security groups, subnet, and dedicated VPC were removed.',
        },
    }


def _reset_ec2_s3_gateway_endpoint() -> dict[str, Any]:
    command = (
        'aws ec2 delete-vpc-endpoints --vpc-endpoint-ids <endpoint-id>\n'
        f'aws s3api delete-bucket --bucket {EC2_ENDPOINT_BUCKET_NAME}\n'
        'aws ec2 disassociate-route-table --association-id <association-id>\n'
        'aws ec2 delete-route-table --route-table-id <route-table-id>\n'
        'aws ec2 delete-subnet --subnet-id <subnet-id>\n'
        'aws ec2 delete-vpc --vpc-id <vpc-id>'
    )
    started = time.perf_counter()
    ec2 = _ec2_client()
    endpoint = _ec2_s3_gateway_endpoint()
    deleted_endpoint = False
    if endpoint:
        ec2.delete_vpc_endpoints(VpcEndpointIds=[endpoint['VpcEndpointId']])
        deleted_endpoint = True
    deleted_bucket = False
    try:
        _s3_client().delete_bucket(Bucket=EC2_ENDPOINT_BUCKET_NAME)
        deleted_bucket = True
    except ClientError:
        pass
    vpc = _ec2_endpoint_vpc()
    deleted_route_table = False
    deleted_subnet = False
    deleted_vpc = False
    if vpc:
        subnets = _ec2_lab_subnets(vpc['VpcId'])
        subnet = subnets.get(EC2_ENDPOINT_SUBNET_CIDR)
        tables = _ec2_lab_route_tables(vpc['VpcId'])
        table = next((
            item for item in tables
            if any(
                association.get('SubnetId') == (subnet or {}).get('SubnetId')
                for association in item.get('Associations', [])
            )
        ), None)
        if table:
            for association in table.get('Associations', []):
                association_id = association.get('RouteTableAssociationId')
                if association_id and not association.get('Main'):
                    ec2.disassociate_route_table(AssociationId=association_id)
            ec2.delete_route_table(RouteTableId=table['RouteTableId'])
            deleted_route_table = True
        if subnet:
            ec2.delete_subnet(SubnetId=subnet['SubnetId'])
            deleted_subnet = True
        ec2.delete_vpc(VpcId=vpc['VpcId'])
        deleted_vpc = True
    cache.delete_many([
        EC2_ENDPOINT_VPC_ID_CACHE_KEY,
        EC2_ENDPOINT_SUBNET_ID_CACHE_KEY,
        EC2_ENDPOINT_RT_ID_CACHE_KEY,
        EC2_ENDPOINT_ASSOC_ID_CACHE_KEY,
        EC2_ENDPOINT_ID_CACHE_KEY,
        EC2_ENDPOINT_CONFIGURED_CACHE_KEY,
        EC2_ENDPOINT_ROUTE_BOUNDARY_CACHE_KEY,
    ])
    output = {
        'deleted_endpoint': deleted_endpoint,
        'deleted_bucket': deleted_bucket,
        'deleted_route_table': deleted_route_table,
        'deleted_subnet': deleted_subnet,
        'deleted_vpc': deleted_vpc,
    }
    return {
        'service': 'ec2',
        'lab': 's3-gateway-endpoint',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(output),
        'stderr': '',
        'json': output,
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'reset': True,
        **output,
        'verification': {
            'status': 'passed',
            'message': 'The endpoint, bucket, route table, subnet, and dedicated VPC were removed in dependency order.',
        },
    }

def _reset_ec2_sqs_interface_endpoint() -> dict[str, Any]:
    command = (
        'aws ec2 delete-vpc-endpoints --vpc-endpoint-ids <endpoint-id>\n'
        'aws sqs delete-queue --queue-url <queue-url>\n'
        'aws ec2 delete-security-group --group-id <endpoint-sg-id>\n'
        'aws ec2 delete-subnet --subnet-id <subnet-id>\n'
        'aws ec2 delete-vpc --vpc-id <vpc-id>'
    )
    started = time.perf_counter()
    ec2 = _ec2_client()
    endpoint = _ec2_sqs_interface_endpoint()
    deleted_endpoint = False
    if endpoint:
        ec2.delete_vpc_endpoints(VpcEndpointIds=[endpoint['VpcEndpointId']])
        deleted_endpoint = True
    deleted_queue = False
    try:
        queue_url = _sqs_queue_url(EC2_INTERFACE_QUEUE_NAME)
        _sqs_client().delete_queue(QueueUrl=queue_url)
        deleted_queue = True
    except ClientError as exc:
        if _error_code(exc) not in {
            'AWS.SimpleQueueService.NonExistentQueue',
            'QueueDoesNotExist',
        }:
            raise
    vpc = _ec2_interface_vpc()
    deleted_group = False
    deleted_subnet = False
    deleted_vpc = False
    if vpc:
        groups = _ec2_client().describe_security_groups(Filters=[
            {'Name': 'vpc-id', 'Values': [vpc['VpcId']]},
            {'Name': 'group-name', 'Values': [EC2_INTERFACE_SG_NAME]},
        ]).get('SecurityGroups', [])
        group = next(iter(groups), None)
        if group:
            ec2.delete_security_group(GroupId=group['GroupId'])
            deleted_group = True
        subnets = ec2.describe_subnets(Filters=[
            {'Name': 'vpc-id', 'Values': [vpc['VpcId']]},
            {'Name': 'cidr-block', 'Values': [EC2_INTERFACE_SUBNET_CIDR]},
        ]).get('Subnets', [])
        subnet = next(iter(subnets), None)
        if subnet:
            ec2.delete_subnet(SubnetId=subnet['SubnetId'])
            deleted_subnet = True
        ec2.delete_vpc(VpcId=vpc['VpcId'])
        deleted_vpc = True
    cache.delete_many([
        EC2_INTERFACE_VPC_ID_CACHE_KEY,
        EC2_INTERFACE_SUBNET_ID_CACHE_KEY,
        EC2_INTERFACE_SG_ID_CACHE_KEY,
        EC2_INTERFACE_ENDPOINT_ID_CACHE_KEY,
        EC2_INTERFACE_CONFIGURED_CACHE_KEY,
        EC2_INTERFACE_INSPECTED_CACHE_KEY,
    ])
    output = {
        'deleted_endpoint': deleted_endpoint,
        'deleted_queue': deleted_queue,
        'deleted_security_group': deleted_group,
        'deleted_subnet': deleted_subnet,
        'deleted_vpc': deleted_vpc,
    }
    return {
        'service': 'ec2',
        'lab': 'sqs-interface-endpoint',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text(output),
        'stderr': '',
        'json': output,
        'duration_ms': round((time.perf_counter() - started) * 1000),
        'reset': True,
        **output,
        'verification': {
            'status': 'passed',
            'message': 'The interface endpoint, queue, security group, subnet, and dedicated VPC were removed in dependency order.',
        },
    }


def _reset_iam_access_key_alice() -> dict[str, Any]:
    command = 'aws iam delete-access-key --user-name Alice --access-key-id <AliceAccessKeyId>'
    started = time.perf_counter()
    iam = _iam_client()
    deleted_keys: list[str] = []

    try:
        keys = iam.list_access_keys(UserName=ALICE_USER_NAME).get('AccessKeyMetadata', [])
    except ClientError as exc:
        if _error_code(exc) != 'NoSuchEntity':
            raise
        keys = []

    for key in keys:
        access_key_id = key.get('AccessKeyId')
        if access_key_id:
            iam.delete_access_key(UserName=ALICE_USER_NAME, AccessKeyId=access_key_id)
            deleted_keys.append(access_key_id)

    duration_ms = round((time.perf_counter() - started) * 1000)

    return {
        'service': 'iam',
        'lab': 'access-key-alice',
        'command': command,
        'exit_code': 0,
        'stdout': _json_text({'deleted_access_key_ids': deleted_keys}),
        'stderr': '',
        'json': {'deleted_access_key_ids': deleted_keys},
        'duration_ms': duration_ms,
        'reset': True,
        'deleted': bool(deleted_keys),
        'verification': {
            'status': 'passed',
            'message': 'Alice access keys were removed.' if deleted_keys else 'Alice had no access keys to remove.',
        },
    }
