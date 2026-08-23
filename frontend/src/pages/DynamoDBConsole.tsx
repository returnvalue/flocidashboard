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
import Box from '@cloudscape-design/components/box';
import { fetchServiceInventory, executeServiceAction } from '../api/client';

interface TableItem {
  TableName: string;
  TableStatus: string;
  ItemCount?: number;
  TableSizeBytes?: number;
  CreationDateTime?: string;
  PartitionKey?: string;
}

export const DynamoDBConsole: React.FC = () => {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<TableItem[]>([]);
  const [filterText, setFilterText] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [tableName, setTableName] = useState('');
  const [partitionKey, setPartitionKey] = useState('id');
  const [creating, setCreating] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchServiceInventory('dynamodb');
      const list = (data.tables || data.TableNames || []).map((t: any) => ({
        TableName: typeof t === 'string' ? t : t.TableName || t.name,
        TableStatus: t.TableStatus || 'ACTIVE',
        ItemCount: t.ItemCount ?? 0,
        TableSizeBytes: t.TableSizeBytes ?? 0,
        CreationDateTime: t.CreationDateTime || new Date().toISOString().split('T')[0],
        PartitionKey: t.PartitionKey || 'id (String)',
      }));
      setTables(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTable = async () => {
    if (!tableName.trim() || !partitionKey.trim()) return;
    setCreating(true);
    try {
      await executeServiceAction('dynamodb', 'create_table', {
        TableName: tableName,
        KeySchema: [{ AttributeName: partitionKey, KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: partitionKey, AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST',
      });
      setActionMessage({ type: 'success', text: `Table "${tableName}" created successfully.` });
      setCreateModalOpen(false);
      setTableName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create table' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTable = async () => {
    if (!selectedItems.length) return;
    const table = selectedItems[0];
    try {
      await executeServiceAction('dynamodb', 'delete_table', { TableName: table.TableName });
      setActionMessage({ type: 'success', text: `Table "${table.TableName}" deleted.` });
      setSelectedItems([]);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete table' });
    }
  };

  const filteredTables = tables.filter((t) =>
    t.TableName.toLowerCase().includes(filterText.toLowerCase())
  );

  const activeTable = selectedItems[0];

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
            counter={`(${tables.length})`}
            description="Fast, flexible NoSQL database tables running locally."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <Button disabled={!selectedItems.length} onClick={handleDeleteTable}>
                  Delete table
                </Button>
                <Button
                  variant="primary"
                  iconName="add-plus"
                  onClick={() => setCreateModalOpen(true)}
                >
                  Create table
                </Button>
              </SpaceBetween>
            }
          >
            Tables
          </Header>
        }
        columnDefinitions={[
          {
            id: 'name',
            header: 'Table name',
            cell: (item) => (
              <Button variant="inline-link" onClick={() => setSelectedItems([item])}>
                <strong>{item.TableName}</strong>
              </Button>
            ),
            sortingField: 'TableName',
            isRowHeader: true,
          },
          {
            id: 'status',
            header: 'Status',
            cell: (item) => (
              <StatusIndicator type={item.TableStatus === 'ACTIVE' ? 'success' : 'info'}>
                {item.TableStatus}
              </StatusIndicator>
            ),
          },
          {
            id: 'partitionKey',
            header: 'Partition key',
            cell: (item) => item.PartitionKey || 'id (String)',
          },
          {
            id: 'items',
            header: 'Item count',
            cell: (item) => item.ItemCount ?? 0,
          },
          {
            id: 'size',
            header: 'Table size',
            cell: (item) => `${item.TableSizeBytes ?? 0} Bytes`,
          },
        ]}
        items={filteredTables}
        loading={loading}
        loadingText="Loading DynamoDB tables..."
        selectionType="single"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Filter tables by name..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
        }
        pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
        empty={
          <Box textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No tables found</b>
              <p>You have not created any DynamoDB tables yet.</p>
              <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
                Create table
              </Button>
            </SpaceBetween>
          </Box>
        }
      />

      {activeTable && (
        <Container header={<Header variant="h2">Table: {activeTable.TableName}</Header>}>
          <Tabs
            tabs={[
              {
                label: 'Table details',
                id: 'details',
                content: (
                  <KeyValuePairs
                    columns={3}
                    items={[
                      { label: 'Table ARN', value: `arn:aws:dynamodb:us-east-1:000000000000:table/${activeTable.TableName}` },
                      { label: 'Table status', value: activeTable.TableStatus },
                      { label: 'Partition key', value: activeTable.PartitionKey || 'id' },
                      { label: 'Capacity mode', value: 'On-Demand (Pay per request)' },
                      { label: 'Point-in-time recovery', value: 'Enabled' },
                      { label: 'Creation time', value: activeTable.CreationDateTime || '—' },
                    ]}
                  />
                ),
              },
              {
                label: 'Explore items',
                id: 'items',
                content: (
                  <SpaceBetween size="m">
                    <Header variant="h3" actions={<Button iconName="add-plus">Create item</Button>}>
                      Items in table ({activeTable.ItemCount ?? 0})
                    </Header>
                    <Box textAlign="center" padding="l" color="text-body-secondary">
                      Scan returned 0 items. Use <strong>Create item</strong> to write JSON records.
                    </Box>
                  </SpaceBetween>
                ),
              },
            ]}
          />
        </Container>
      )}

      <Modal
        visible={createModalOpen}
        onDismiss={() => setCreateModalOpen(false)}
        header="Create DynamoDB table"
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateTable} loading={creating}>
                Create table
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Table name" description="Enter a friendly name for your table.">
            <Input
              value={tableName}
              onChange={({ detail }) => setTableName(detail.value)}
              placeholder="e.g. users-table"
            />
          </FormField>
          <FormField label="Partition key" description="The primary key attribute name.">
            <Input
              value={partitionKey}
              onChange={({ detail }) => setPartitionKey(detail.value)}
              placeholder="e.g. userId"
            />
          </FormField>
          <FormField label="Table class">
            <Input value="DynamoDB Standard" disabled />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
