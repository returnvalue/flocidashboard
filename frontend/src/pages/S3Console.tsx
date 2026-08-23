import React, { useState, useEffect } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Table from '@cloudscape-design/components/table';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import TextFilter from '@cloudscape-design/components/text-filter';
import Pagination from '@cloudscape-design/components/pagination';
import Tabs from '@cloudscape-design/components/tabs';
import Modal from '@cloudscape-design/components/modal';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Grid from '@cloudscape-design/components/grid';
import Box from '@cloudscape-design/components/box';
import { fetchServiceInventory, executeServiceAction } from '../api/client';

interface BucketItem {
  Name: string;
  CreationDate: string;
  Region?: string;
  ObjectCount?: number;
  Size?: number;
}

export const S3Console: React.FC = () => {
  const [buckets, setBuckets] = useState<BucketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<BucketItem[]>([]);
  const [filterText, setFilterText] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [creating, setCreating] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBucket = async () => {
    if (!newBucketName.trim()) return;
    setCreating(true);
    try {
      await executeServiceAction('s3', 'create_bucket', { Bucket: newBucketName });
      setActionMessage({ type: 'success', text: `Bucket "${newBucketName}" created successfully.` });
      setCreateModalOpen(false);
      setNewBucketName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create bucket' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBucket = async () => {
    if (!selectedItems.length) return;
    const bucket = selectedItems[0];
    try {
      await executeServiceAction('s3', 'delete_bucket', { Bucket: bucket.Name });
      setActionMessage({ type: 'success', text: `Bucket "${bucket.Name}" deleted.` });
      setSelectedItems([]);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete bucket' });
    }
  };

  const filteredBuckets = buckets.filter((b) =>
    b.Name.toLowerCase().includes(filterText.toLowerCase())
  );

  const activeBucket = selectedItems[0];

  return (
    <SpaceBetween size="l">
      {actionMessage && (
        <StatusIndicator type={actionMessage.type === 'success' ? 'success' : 'error'}>
          {actionMessage.text}
        </StatusIndicator>
      )}

      <Table
        header={
          <Header
            variant="h1"
            counter={`(${buckets.length})`}
            description="Buckets are containers for data stored in Amazon S3."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <Button
                  disabled={!selectedItems.length}
                  onClick={handleDeleteBucket}
                >
                  Delete
                </Button>
                <Button
                  variant="primary"
                  iconName="add-plus"
                  onClick={() => setCreateModalOpen(true)}
                >
                  Create bucket
                </Button>
              </SpaceBetween>
            }
          >
            Buckets
          </Header>
        }
        columnDefinitions={[
          {
            id: 'name',
            header: 'Bucket name',
            cell: (item) => (
              <Button variant="inline-link" onClick={() => setSelectedItems([item])}>
                <strong>{item.Name}</strong>
              </Button>
            ),
            sortingField: 'Name',
            isRowHeader: true,
          },
          {
            id: 'region',
            header: 'AWS Region',
            cell: (item) => item.Region || 'us-east-1',
          },
          {
            id: 'access',
            header: 'Access',
            cell: () => <StatusIndicator type="success">Bucket and objects not public</StatusIndicator>,
          },
          {
            id: 'creationDate',
            header: 'Creation date',
            cell: (item) => item.CreationDate,
          },
        ]}
        items={filteredBuckets}
        loading={loading}
        loadingText="Loading S3 buckets from Floci..."
        selectionType="single"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Find buckets by name..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
        }
        pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
        empty={
          <Box textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No buckets</b>
              <p>You do not have any S3 buckets in this region.</p>
              <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
                Create bucket
              </Button>
            </SpaceBetween>
          </Box>
        }
      />

      {activeBucket && (
        <Container header={<Header variant="h2">Bucket: {activeBucket.Name}</Header>}>
          <Tabs
            tabs={[
              {
                label: 'Properties',
                id: 'properties',
                content: (
                  <SpaceBetween size="l">
                    <KeyValuePairs
                      columns={3}
                      items={[
                        { label: 'Bucket ARN', value: `arn:aws:s3:::${activeBucket.Name}` },
                        { label: 'AWS Region', value: activeBucket.Region || 'us-east-1' },
                        { label: 'Creation date', value: activeBucket.CreationDate },
                        { label: 'Default Encryption', value: 'Server-side encryption with Amazon S3 managed keys (SSE-S3)' },
                        { label: 'Bucket Versioning', value: 'Disabled' },
                        { label: 'Object Locking', value: 'Disabled' },
                      ]}
                    />
                  </SpaceBetween>
                ),
              },
              {
                label: 'Permissions',
                id: 'permissions',
                content: (
                  <SpaceBetween size="m">
                    <Container header={<Header variant="h3">Block Public Access (bucket settings)</Header>}>
                      <StatusIndicator type="success">Block all public access is ON</StatusIndicator>
                    </Container>
                    <Container header={<Header variant="h3">Bucket Policy</Header>}>
                      <pre style={{ background: '#1b2a3a', color: '#79c0ff', padding: '12px', borderRadius: '4px', margin: 0 }}>
                        {JSON.stringify({
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
                        }, null, 2)}
                      </pre>
                    </Container>
                  </SpaceBetween>
                ),
              },
              {
                label: 'Metrics',
                id: 'metrics',
                content: (
                  <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
                    <Container header={<Header variant="h3">Total bucket size</Header>}>
                      <Box variant="h1">0 Bytes</Box>
                    </Container>
                    <Container header={<Header variant="h3">Total number of objects</Header>}>
                      <Box variant="h1">0 Objects</Box>
                    </Container>
                  </Grid>
                ),
              },
            ]}
          />
        </Container>
      )}

      <Modal
        visible={createModalOpen}
        onDismiss={() => setCreateModalOpen(false)}
        header="Create S3 bucket"
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateBucket} loading={creating}>
                Create bucket
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField
            label="Bucket name"
            description="Bucket name must be globally unique and not contain spaces or uppercase letters."
          >
            <Input
              value={newBucketName}
              onChange={({ detail }) => setNewBucketName(detail.value)}
              placeholder="e.g. my-app-production-assets"
            />
          </FormField>
          <FormField label="AWS Region">
            <Input value="us-east-1 (US East N. Virginia)" disabled />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
