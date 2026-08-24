import React, { useState, useEffect } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Table from '@cloudscape-design/components/table';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import TextFilter from '@cloudscape-design/components/text-filter';
import Tabs from '@cloudscape-design/components/tabs';
import Modal from '@cloudscape-design/components/modal';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import Select from '@cloudscape-design/components/select';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Grid from '@cloudscape-design/components/grid';
import Box from '@cloudscape-design/components/box';
import Badge from '@cloudscape-design/components/badge';
import Alert from '@cloudscape-design/components/alert';
import Link from '@cloudscape-design/components/link';
import {
  fetchServiceInventory,
  executeServiceAction,
  fetchS3Objects,
  presignS3Object,
  fetchS3Website,
  putS3Website,
  deleteS3Website,
  fetchS3Notifications,
  putS3Notifications,
  deleteS3Object,
  createS3Folder,
} from '../api/client';
import { CodeSnippet } from '../components/CodeSnippet';

interface BucketItem {
  Name: string;
  CreationDate: string;
  Region?: string;
  ObjectCount?: number;
  Size?: number;
}

interface S3ConsoleProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export const S3Console: React.FC<S3ConsoleProps> = ({ activeTab, onTabChange }) => {
  const [buckets, setBuckets] = useState<BucketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuckets, setSelectedBuckets] = useState<BucketItem[]>([]);
  const [filterText, setFilterText] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedTabId, setSelectedTabId] = useState(activeTab || 'objects');

  useEffect(() => {
    if (activeTab) {
      setSelectedTabId(activeTab);
    }
  }, [activeTab]);

  // Create Bucket Modal
  const [createBucketOpen, setCreateBucketOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [creatingBucket, setCreatingBucket] = useState(false);

  // Objects State for Active Bucket
  const [objects, setObjects] = useState<any[]>([]);
  const [selectedObjects, setSelectedObjects] = useState<any[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [objectFilter, setObjectFilter] = useState('');

  // Upload Object Modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadKey, setUploadKey] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadContentType, setUploadContentType] = useState('text/plain');
  const [uploading, setUploading] = useState(false);

  // Create Folder Modal
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Presign Modal
  const [presignModalOpen, setPresignModalOpen] = useState(false);
  const [presignExpires, setPresignExpires] = useState({ label: '1 Hour (3,600s)', value: '3600' });
  const [presignedUrl, setPresignedUrl] = useState('');
  const [generatingPresign, setGeneratingPresign] = useState(false);
  const [copiedPresign, setCopiedPresign] = useState(false);

  // Website Hosting State
  const [websiteConfig, setWebsiteConfig] = useState<any | null>(null);
  const [websiteIndexDoc, setWebsiteIndexDoc] = useState('index.html');
  const [websiteErrorDoc, setWebsiteErrorDoc] = useState('error.html');
  const [savingWebsite, setSavingWebsite] = useState(false);

  // Notifications State
  const [notificationsConfig, setNotificationsConfig] = useState<any>({});
  const [addNotificationOpen, setAddNotificationOpen] = useState(false);
  const [notifTargetType, setNotifTargetType] = useState({ label: 'Amazon SQS Queue', value: 'sqs' });
  const [notifTargetArn, setNotifTargetArn] = useState('arn:aws:sqs:us-east-1:000000000000:my-queue');
  const [notifEventType, setNotifEventType] = useState('s3:ObjectCreated:*');
  const [savingNotifications, setSavingNotifications] = useState(false);

  const loadBuckets = async () => {
    setLoading(true);
    try {
      const data = await fetchServiceInventory('s3');
      const list = (data.buckets || data.items || []).map((b: any) => ({
        Name: typeof b === 'string' ? b : b.Name || b.name,
        CreationDate: b.CreationDate || b.created || new Date().toISOString().split('T')[0],
        Region: b.Region || 'us-east-1',
        ObjectCount: b.ObjectCount ?? 0,
        Size: b.Size ?? 0,
      }));
      setBuckets(list);
      if (list.length > 0 && selectedBuckets.length === 0) {
        setSelectedBuckets([list[0]]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuckets();
  }, []);

  const activeBucket = selectedBuckets.length > 0 ? selectedBuckets[0] : null;

  const loadBucketDetails = async (bucket: BucketItem) => {
    setLoadingObjects(true);
    try {
      const [objsRes, webRes, notifRes] = await Promise.all([
        fetchS3Objects(bucket.Name),
        fetchS3Website(bucket.Name),
        fetchS3Notifications(bucket.Name),
      ]);
      setObjects(objsRes.contents || []);
      setWebsiteConfig(webRes);
      if (webRes?.IndexDocument?.Suffix) {
        setWebsiteIndexDoc(webRes.IndexDocument.Suffix);
      }
      if (webRes?.ErrorDocument?.Key) {
        setWebsiteErrorDoc(webRes.ErrorDocument.Key);
      }
      setNotificationsConfig(notifRes || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingObjects(false);
    }
  };

  useEffect(() => {
    if (activeBucket) {
      loadBucketDetails(activeBucket);
      setSelectedObjects([]);
    } else {
      setObjects([]);
      setWebsiteConfig(null);
      setNotificationsConfig({});
    }
  }, [activeBucket?.Name]);

  const handleCreateBucket = async () => {
    if (!newBucketName.trim()) return;
    setCreatingBucket(true);
    setActionMessage(null);
    try {
      await executeServiceAction('s3', 'create_bucket', { Bucket: newBucketName.trim() });
      setActionMessage({ type: 'success', text: `Bucket "${newBucketName.trim()}" created successfully.` });
      setCreateBucketOpen(false);
      setNewBucketName('');
      await loadBuckets();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create bucket' });
    } finally {
      setCreatingBucket(false);
    }
  };

  const handleDeleteBucket = async () => {
    if (!activeBucket) return;
    try {
      await executeServiceAction('s3', 'delete_bucket', { Bucket: activeBucket.Name });
      setActionMessage({ type: 'success', text: `Bucket "${activeBucket.Name}" deleted.` });
      setSelectedBuckets([]);
      await loadBuckets();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete bucket' });
    }
  };

  const handleUploadObject = async () => {
    if (!activeBucket || !uploadKey.trim()) return;
    setUploading(true);
    setActionMessage(null);
    try {
      await executeServiceAction('s3', 'upload_object', {
        bucket: activeBucket.Name,
        key: uploadKey.trim(),
        body: uploadContent,
        content_type: uploadContentType,
      });
      setActionMessage({ type: 'success', text: `Object "${uploadKey.trim()}" uploaded successfully.` });
      setUploadModalOpen(false);
      setUploadKey('');
      setUploadContent('');
      await loadBucketDetails(activeBucket);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to upload object' });
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!activeBucket || !folderName.trim()) return;
    setCreatingFolder(true);
    try {
      await createS3Folder(activeBucket.Name, folderName.trim());
      setActionMessage({ type: 'success', text: `Folder "${folderName.trim()}" created.` });
      setFolderModalOpen(false);
      setFolderName('');
      await loadBucketDetails(activeBucket);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create folder' });
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteObject = async () => {
    if (!activeBucket || !selectedObjects.length) return;
    const obj = selectedObjects[0];
    try {
      await deleteS3Object(activeBucket.Name, obj.Key || obj.key);
      setActionMessage({ type: 'success', text: `Object "${obj.Key || obj.key}" deleted.` });
      setSelectedObjects([]);
      await loadBucketDetails(activeBucket);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete object' });
    }
  };

  const handleGeneratePresignedUrl = async () => {
    if (!activeBucket || !selectedObjects.length) return;
    const obj = selectedObjects[0];
    setGeneratingPresign(true);
    setCopiedPresign(false);
    try {
      const res = await presignS3Object(activeBucket.Name, obj.Key || obj.key, Number(presignExpires.value));
      setPresignedUrl(res.url);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to generate presigned URL' });
    } finally {
      setGeneratingPresign(false);
    }
  };

  const handleSaveWebsite = async (enabled: boolean) => {
    if (!activeBucket) return;
    setSavingWebsite(true);
    try {
      if (enabled) {
        await putS3Website(activeBucket.Name, {
          IndexDocument: { Suffix: websiteIndexDoc.trim() || 'index.html' },
          ErrorDocument: { Key: websiteErrorDoc.trim() || 'error.html' },
        });
        setActionMessage({ type: 'success', text: 'Static website hosting enabled.' });
      } else {
        await deleteS3Website(activeBucket.Name);
        setActionMessage({ type: 'success', text: 'Static website hosting disabled.' });
      }
      await loadBucketDetails(activeBucket);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to update website configuration' });
    } finally {
      setSavingWebsite(false);
    }
  };

  const handleAddNotification = async () => {
    if (!activeBucket) return;
    setSavingNotifications(true);
    try {
      const newConfig = { ...notificationsConfig };
      if (notifTargetType.value === 'sqs') {
        newConfig.QueueConfigurations = [
          ...(newConfig.QueueConfigurations || []),
          { QueueArn: notifTargetArn, Events: [notifEventType] },
        ];
      } else if (notifTargetType.value === 'sns') {
        newConfig.TopicConfigurations = [
          ...(newConfig.TopicConfigurations || []),
          { TopicArn: notifTargetArn, Events: [notifEventType] },
        ];
      } else {
        newConfig.LambdaFunctionConfigurations = [
          ...(newConfig.LambdaFunctionConfigurations || []),
          { LambdaFunctionArn: notifTargetArn, Events: [notifEventType] },
        ];
      }
      await putS3Notifications(activeBucket.Name, newConfig);
      setActionMessage({ type: 'success', text: 'Event notification added successfully.' });
      setAddNotificationOpen(false);
      await loadBucketDetails(activeBucket);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to add notification' });
    } finally {
      setSavingNotifications(false);
    }
  };

  const filteredBuckets = buckets.filter((b) =>
    b.Name.toLowerCase().includes(filterText.toLowerCase())
  );

  const filteredObjects = objects.filter((o) =>
    (o.Key || o.key || '').toLowerCase().includes(objectFilter.toLowerCase())
  );

  const websiteUrl = activeBucket
    ? `http://${activeBucket.Name}.s3-website.localhost:4566`
    : '';

  return (
    <SpaceBetween size="l">
      {/* Header Container */}
      <Container
        header={
          <Header
            variant="h1"
            counter={`(${buckets.length})`}
            description="Object storage built to retrieve any amount of data from anywhere in your local cloud."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadBuckets} loading={loading}>
                  Refresh
                </Button>
                <Button disabled={!activeBucket} onClick={handleDeleteBucket}>
                  Delete bucket
                </Button>
                <Button variant="primary" iconName="add-plus" onClick={() => setCreateBucketOpen(true)}>
                  Create bucket
                </Button>
              </SpaceBetween>
            }
          >
            Amazon S3
          </Header>
        }
      >
        {actionMessage && (
          <Box margin={{ bottom: 'm' }}>
            <Alert type={actionMessage.type} dismissible onDismiss={() => setActionMessage(null)}>
              {actionMessage.text}
            </Alert>
          </Box>
        )}

        <Grid gridDefinition={[{ colspan: { default: 12, s: 4 } }, { colspan: { default: 12, s: 4 } }, { colspan: { default: 12, s: 4 } }]}>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Total Buckets</Box>
            <Box variant="h1" color="text-status-info">
              {buckets.length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Active Region</Box>
            <Box variant="h2" color="text-status-info">
              us-east-1
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">S3 Engine Status</Box>
            <Box variant="h2" color="text-status-info">
              <StatusIndicator type="success">Storage Engine Ready</StatusIndicator>
            </Box>
          </Box>
        </Grid>
      </Container>

      {/* Buckets Table */}
      <Container
        header={
          <Header
            variant="h2"
            description="General purpose buckets hosted on Floci local storage."
          >
            Buckets ({buckets.length})
          </Header>
        }
      >
        <SpaceBetween size="m">
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Find buckets by name..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />

          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: 'Bucket name',
                cell: (item) => <strong>{item.Name}</strong>,
              },
              {
                id: 'region',
                header: 'AWS Region',
                cell: (item) => item.Region || 'us-east-1',
                width: 150,
              },
              {
                id: 'access',
                header: 'Access',
                cell: () => <Badge color="green">Bucket and objects not public</Badge>,
                width: 250,
              },
              {
                id: 'creationDate',
                header: 'Creation date',
                cell: (item) => (
                  <span style={{ color: '#879596', fontSize: '12px' }}>
                    {item.CreationDate}
                  </span>
                ),
                width: 180,
              },
            ]}
            items={filteredBuckets}
            selectionType="single"
            selectedItems={selectedBuckets}
            onSelectionChange={({ detail }) => setSelectedBuckets(detail.selectedItems)}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No buckets found</b>
                <p>Create an S3 bucket to start uploading and storing objects.</p>
              </Box>
            }
          />
        </SpaceBetween>
      </Container>

      {/* Active Bucket Inspector */}
      {activeBucket && (
        <Container
          header={
            <Header
              variant="h2"
              description={`Inspecting bucket: ${activeBucket.Name}`}
            >
              Bucket: {activeBucket.Name}
            </Header>
          }
        >
          <Tabs
            activeTabId={selectedTabId}
            onChange={({ detail }) => {
              setSelectedTabId(detail.activeTabId);
              onTabChange?.(detail.activeTabId);
            }}
            tabs={[
              {
                label: `Objects (${objects.length})`,
                id: 'objects',
                content: (
                  <SpaceBetween size="m">
                    <Box float="right">
                      <SpaceBetween direction="horizontal" size="xs">
                        <Button
                          disabled={!selectedObjects.length}
                          onClick={() => {
                            setPresignedUrl('');
                            setPresignModalOpen(true);
                          }}
                        >
                          Generate Presigned URL
                        </Button>
                        <Button
                          disabled={!selectedObjects.length}
                          onClick={handleDeleteObject}
                        >
                          Delete
                        </Button>
                        <Button onClick={() => setFolderModalOpen(true)}>
                          Create folder
                        </Button>
                        <Button variant="primary" iconName="upload" onClick={() => setUploadModalOpen(true)}>
                          Upload object
                        </Button>
                      </SpaceBetween>
                    </Box>

                    <TextFilter
                      filteringText={objectFilter}
                      filteringPlaceholder="Find objects by key prefix..."
                      onChange={({ detail }) => setObjectFilter(detail.filteringText)}
                    />

                    <Table
                      columnDefinitions={[
                        {
                          id: 'key',
                          header: 'Object Key',
                          cell: (item) => <strong>{item.Key || item.key}</strong>,
                        },
                        {
                          id: 'size',
                          header: 'Size (Bytes)',
                          cell: (item) => `${item.Size ?? item.size ?? 0} B`,
                          width: 140,
                        },
                        {
                          id: 'modified',
                          header: 'Last Modified',
                          cell: (item) => (
                            <span style={{ color: '#879596', fontSize: '11px' }}>
                              {item.LastModified ? new Date(item.LastModified).toLocaleString() : 'Just now'}
                            </span>
                          ),
                          width: 220,
                        },
                        {
                          id: 'storage',
                          header: 'Storage Class',
                          cell: () => <Badge color="blue">STANDARD</Badge>,
                          width: 130,
                        },
                      ]}
                      items={filteredObjects}
                      loading={loadingObjects}
                      selectionType="single"
                      selectedItems={selectedObjects}
                      onSelectionChange={({ detail }) => setSelectedObjects(detail.selectedItems)}
                      empty={
                        <Box textAlign="center" color="inherit">
                          <b>No objects found in this bucket</b>
                          <p>Upload a file or create a folder to populate this bucket.</p>
                        </Box>
                      }
                    />
                  </SpaceBetween>
                ),
              },
              {
                label: 'Properties & Hosting',
                id: 'properties',
                content: (
                  <SpaceBetween size="l">
                    <KeyValuePairs
                      columns={3}
                      items={[
                        { label: 'Bucket ARN', value: `arn:aws:s3:::${activeBucket.Name}` },
                        { label: 'AWS Region', value: activeBucket.Region || 'us-east-1' },
                        { label: 'Creation Date', value: activeBucket.CreationDate },
                        { label: 'Default Encryption', value: 'Server-Side Encryption with Amazon S3 Managed Keys (SSE-S3)' },
                        { label: 'Bucket Versioning', value: 'Disabled' },
                        { label: 'Object Lock', value: 'Disabled' },
                      ]}
                    />

                    {/* Static Website Hosting */}
                    <Container
                      header={
                        <Header
                          variant="h3"
                          description="Host a static website on this bucket using local HTTP resolution."
                          actions={
                            websiteConfig ? (
                              <Button loading={savingWebsite} onClick={() => handleSaveWebsite(false)}>
                                Disable Website Hosting
                              </Button>
                            ) : (
                              <Button variant="primary" loading={savingWebsite} onClick={() => handleSaveWebsite(true)}>
                                Enable Website Hosting
                              </Button>
                            )
                          }
                        >
                          Static Website Hosting
                        </Header>
                      }
                    >
                      <SpaceBetween size="m">
                        <Box>
                          Status:{' '}
                          {websiteConfig ? (
                            <StatusIndicator type="success">Enabled</StatusIndicator>
                          ) : (
                            <StatusIndicator type="stopped">Disabled</StatusIndicator>
                          )}
                        </Box>

                        {websiteConfig && (
                          <Alert type="info">
                            Website Endpoint:{' '}
                            <Link href={websiteUrl} external>
                              {websiteUrl}
                            </Link>
                          </Alert>
                        )}

                        <Grid gridDefinition={[{ colspan: { default: 12, m: 6 } }, { colspan: { default: 12, m: 6 } }]}>
                          <FormField label="Index Document" description="The home or default page of the website.">
                            <Input
                              value={websiteIndexDoc}
                              onChange={({ detail }) => setWebsiteIndexDoc(detail.value)}
                              placeholder="index.html"
                            />
                          </FormField>
                          <FormField label="Error Document (Optional)" description="Returned for 4XX class errors.">
                            <Input
                              value={websiteErrorDoc}
                              onChange={({ detail }) => setWebsiteErrorDoc(detail.value)}
                              placeholder="error.html"
                            />
                          </FormField>
                        </Grid>

                        {websiteConfig && (
                          <Button variant="primary" loading={savingWebsite} onClick={() => handleSaveWebsite(true)}>
                            Save Website Changes
                          </Button>
                        )}
                      </SpaceBetween>
                    </Container>

                    {/* Event Notifications */}
                    <Container
                      header={
                        <Header
                          variant="h3"
                          description="Send notifications to SQS queues, SNS topics, or Lambda functions when objects are created or removed."
                          actions={
                            <Button variant="primary" iconName="add-plus" onClick={() => setAddNotificationOpen(true)}>
                              Create Event Notification
                            </Button>
                          }
                        >
                          Event Notifications
                        </Header>
                      }
                    >
                      <SpaceBetween size="m">
                        {((notificationsConfig.QueueConfigurations || []).length > 0 ||
                          (notificationsConfig.TopicConfigurations || []).length > 0 ||
                          (notificationsConfig.LambdaFunctionConfigurations || []).length > 0) ? (
                          <SpaceBetween size="s">
                            {(notificationsConfig.QueueConfigurations || []).map((q: any, i: number) => (
                              <Box key={i}>
                                <Badge color="blue">SQS Queue</Badge> <code>{q.QueueArn}</code> (Events: {q.Events?.join(', ')})
                              </Box>
                            ))}
                            {(notificationsConfig.TopicConfigurations || []).map((t: any, i: number) => (
                              <Box key={i}>
                                <Badge color="green">SNS Topic</Badge> <code>{t.TopicArn}</code> (Events: {t.Events?.join(', ')})
                              </Box>
                            ))}
                            {(notificationsConfig.LambdaFunctionConfigurations || []).map((l: any, i: number) => (
                              <Box key={i}>
                                <Badge color="grey">Lambda Function</Badge> <code>{l.LambdaFunctionArn}</code> (Events: {l.Events?.join(', ')})
                              </Box>
                            ))}
                          </SpaceBetween>
                        ) : (
                          <Box color="text-status-inactive">No event notifications configured for this bucket.</Box>
                        )}
                      </SpaceBetween>
                    </Container>
                  </SpaceBetween>
                ),
              },
              {
                label: 'Permissions & Policy',
                id: 'permissions',
                content: (
                  <SpaceBetween size="m">
                    <Container header={<Header variant="h3">Block Public Access (Bucket Settings)</Header>}>
                      <StatusIndicator type="success">Block all public access is ON</StatusIndicator>
                    </Container>
                    <Container header={<Header variant="h3">Bucket Policy (JSON)</Header>}>
                      <CodeSnippet
                        language="json"
                        code={JSON.stringify(
                          {
                            Version: '2012-10-17',
                            Statement: [
                              {
                                Sid: 'FlociLocalAccess',
                                Effect: 'Allow',
                                Principal: '*',
                                Action: 's3:*',
                                Resource: [
                                  `arn:aws:s3:::${activeBucket.Name}`,
                                  `arn:aws:s3:::${activeBucket.Name}/*`,
                                ],
                              },
                            ],
                          },
                          null,
                          2
                        )}
                      />
                    </Container>
                  </SpaceBetween>
                ),
              },
            ]}
          />
        </Container>
      )}

      {/* Create Bucket Modal */}
      <Modal
        visible={createBucketOpen}
        onDismiss={() => setCreateBucketOpen(false)}
        header="Create S3 Bucket"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateBucketOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creatingBucket} onClick={handleCreateBucket}>
                Create Bucket
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField
            label="Bucket Name"
            description="Bucket name must be globally unique and not contain spaces or uppercase letters."
          >
            <Input
              value={newBucketName}
              onChange={({ detail }) => setNewBucketName(detail.value)}
              placeholder="e.g. my-production-assets"
            />
          </FormField>
          <FormField label="AWS Region">
            <Input value="us-east-1 (US East N. Virginia)" disabled />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Upload Object Modal */}
      <Modal
        visible={uploadModalOpen}
        onDismiss={() => setUploadModalOpen(false)}
        header={`Upload Object to ${activeBucket?.Name}`}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setUploadModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={uploading} onClick={handleUploadObject}>
                Upload Object
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Object Key / Path" description="Path including filename, e.g. index.html or assets/logo.png">
            <Input
              value={uploadKey}
              onChange={({ detail }) => setUploadKey(detail.value)}
              placeholder="index.html"
            />
          </FormField>

          <FormField label="Content Type">
            <Input
              value={uploadContentType}
              onChange={({ detail }) => setUploadContentType(detail.value)}
              placeholder="text/html or application/json"
            />
          </FormField>

          <FormField label="Object Body (Text Content)">
            <Textarea
              rows={8}
              value={uploadContent}
              onChange={({ detail }) => setUploadContent(detail.value)}
              placeholder="<h1>Hello from Floci S3 Static Website!</h1>"
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Create Folder Modal */}
      <Modal
        visible={folderModalOpen}
        onDismiss={() => setFolderModalOpen(false)}
        header={`Create Folder in ${activeBucket?.Name}`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setFolderModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creatingFolder} onClick={handleCreateFolder}>
                Create Folder
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <FormField label="Folder Name" description="Folder path suffix will automatically append a trailing slash.">
          <Input
            value={folderName}
            onChange={({ detail }) => setFolderName(detail.value)}
            placeholder="images or logs"
          />
        </FormField>
      </Modal>

      {/* Presigned URL Generator Modal */}
      <Modal
        visible={presignModalOpen}
        onDismiss={() => setPresignModalOpen(false)}
        header={`Generate Presigned URL: ${selectedObjects[0]?.Key || selectedObjects[0]?.key}`}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setPresignModalOpen(false)}>
                Close
              </Button>
              <Button variant="primary" loading={generatingPresign} onClick={handleGeneratePresignedUrl}>
                Generate URL
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Expiration Duration" description="How long the presigned URL remains valid.">
            <Select
              selectedOption={presignExpires}
              onChange={({ detail }) => setPresignExpires(detail.selectedOption as any)}
              options={[
                { label: '15 Minutes (900s)', value: '900' },
                { label: '1 Hour (3,600s)', value: '3600' },
                { label: '12 Hours (43,200s)', value: '43200' },
                { label: '24 Hours (86,400s)', value: '86400' },
                { label: '7 Days (604,800s)', value: '604800' },
              ]}
            />
          </FormField>

          {presignedUrl && (
            <Container header={<Header variant="h3">Generated Presigned GET URL</Header>}>
              <SpaceBetween size="s">
                <div style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '12px', background: '#0f1b2a', padding: '12px', borderRadius: '4px', color: '#58a6ff' }}>
                  {presignedUrl}
                </div>
                <Button
                  iconName="copy"
                  onClick={() => {
                    navigator.clipboard.writeText(presignedUrl);
                    setCopiedPresign(true);
                    setTimeout(() => setCopiedPresign(false), 2000);
                  }}
                >
                  {copiedPresign ? 'Copied to Clipboard!' : 'Copy Presigned URL'}
                </Button>
              </SpaceBetween>
            </Container>
          )}
        </SpaceBetween>
      </Modal>

      {/* Add Event Notification Modal */}
      <Modal
        visible={addNotificationOpen}
        onDismiss={() => setAddNotificationOpen(false)}
        header="Add S3 Event Notification"
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setAddNotificationOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={savingNotifications} onClick={handleAddNotification}>
                Add Notification
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Event Type">
            <Input
              value={notifEventType}
              onChange={({ detail }) => setNotifEventType(detail.value)}
              placeholder="s3:ObjectCreated:* or s3:ObjectRemoved:*"
            />
          </FormField>

          <FormField label="Destination Target Type">
            <Select
              selectedOption={notifTargetType}
              onChange={({ detail }) => setNotifTargetType(detail.selectedOption as any)}
              options={[
                { label: 'Amazon SQS Queue', value: 'sqs' },
                { label: 'Amazon SNS Topic', value: 'sns' },
                { label: 'AWS Lambda Function', value: 'lambda' },
              ]}
            />
          </FormField>

          <FormField label="Target ARN" description="Target ARN of the destination SQS queue, SNS topic, or Lambda function.">
            <Input
              value={notifTargetArn}
              onChange={({ detail }) => setNotifTargetArn(detail.value)}
              placeholder="arn:aws:sqs:us-east-1:000000000000:orders-queue"
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
