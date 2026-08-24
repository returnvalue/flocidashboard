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
import {
  fetchServiceInventory,
  executeServiceAction,
  fetchDynamoDbTableScan,
  executeDynamoDbPartiQL,
  putDynamoDbItem,
  deleteDynamoDbItem,
} from '../api/client';

interface TableItem {
  TableName: string;
  TableStatus: string;
  ItemCount?: number;
  TableSizeBytes?: number;
  CreationDateTime?: string;
  PartitionKey?: string;
  SortKey?: string;
}

interface DynamoDBConsoleProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export const DynamoDBConsole: React.FC<DynamoDBConsoleProps> = ({ activeTab, onTabChange }) => {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTables, setSelectedTables] = useState<TableItem[]>([]);
  const [tableFilter, setTableFilter] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedTabId, setSelectedTabId] = useState(activeTab || 'items');

  useEffect(() => {
    if (activeTab) {
      setSelectedTabId(activeTab);
    }
  }, [activeTab]);

  // Create Table Modal
  const [createTableOpen, setCreateTableOpen] = useState(false);
  const [tableName, setTableName] = useState('');
  const [partitionKeyName, setPartitionKeyName] = useState('id');
  const [partitionKeyType, setPartitionKeyType] = useState({ label: 'String (S)', value: 'S' });
  const [sortKeyName, setSortKeyName] = useState('');
  const [sortKeyType, setSortKeyType] = useState({ label: 'String (S)', value: 'S' });
  const [creatingTable, setCreatingTable] = useState(false);

  // Items Explorer for Active Table
  const [tableItems, setTableItems] = useState<any[]>([]);
  const [selectedItemRows, setSelectedItemRows] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Create / Insert Item Modal
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [itemJson, setItemJson] = useState('{\n  "id": "item-101",\n  "name": "Sample Widget",\n  "price": 19.99,\n  "status": "ACTIVE"\n}');
  const [savingItem, setSavingItem] = useState(false);

  // PartiQL SQL Query Editor
  const [partiqlQuery, setPartiqlQuery] = useState('');
  const [partiqlResults, setPartiqlResults] = useState<any[]>([]);
  const [runningPartiql, setRunningPartiql] = useState(false);
  const [partiqlLatency, setPartiqlLatency] = useState<number | null>(null);

  const loadTables = async () => {
    setLoading(true);
    try {
      const data = await fetchServiceInventory('dynamodb');
      const list = (data.tables || data.TableNames || []).map((t: any) => ({
        TableName: typeof t === 'string' ? t : t.TableName || t.name,
        TableStatus: t.TableStatus || 'ACTIVE',
        ItemCount: t.ItemCount ?? 0,
        TableSizeBytes: t.TableSizeBytes ?? 0,
        CreationDateTime: t.CreationDateTime || new Date().toISOString().split('T')[0],
        PartitionKey: t.PartitionKey || t.KeySchema?.find((k: any) => k.KeyType === 'HASH')?.AttributeName || 'id',
        SortKey: t.SortKey || t.KeySchema?.find((k: any) => k.KeyType === 'RANGE')?.AttributeName || undefined,
      }));
      setTables(list);
      if (list.length > 0 && selectedTables.length === 0) {
        setSelectedTables([list[0]]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const activeTable = selectedTables[0];

  const loadTableItems = async (tbl: TableItem) => {
    setLoadingItems(true);
    try {
      const res = await fetchDynamoDbTableScan(tbl.TableName);
      setTableItems(res.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    if (activeTable) {
      loadTableItems(activeTable);
      setSelectedItemRows([]);
      setPartiqlQuery(`SELECT * FROM "${activeTable.TableName}"`);
      setPartiqlResults([]);
    } else {
      setTableItems([]);
    }
  }, [activeTable?.TableName]);

  const handleCreateTable = async () => {
    if (!tableName.trim() || !partitionKeyName.trim()) return;
    setCreatingTable(true);
    setActionMessage(null);
    try {
      const keySchema = [{ AttributeName: partitionKeyName.trim(), KeyType: 'HASH' }];
      const attrDefs = [{ AttributeName: partitionKeyName.trim(), AttributeType: partitionKeyType.value }];

      if (sortKeyName.trim()) {
        keySchema.push({ AttributeName: sortKeyName.trim(), KeyType: 'RANGE' });
        attrDefs.push({ AttributeName: sortKeyName.trim(), AttributeType: sortKeyType.value });
      }

      await executeServiceAction('dynamodb', 'create_table', {
        TableName: tableName.trim(),
        KeySchema: keySchema,
        AttributeDefinitions: attrDefs,
        BillingMode: 'PAY_PER_REQUEST',
      });
      setActionMessage({ type: 'success', text: `DynamoDB Table "${tableName.trim()}" created successfully.` });
      setCreateTableOpen(false);
      setTableName('');
      await loadTables();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create table' });
    } finally {
      setCreatingTable(false);
    }
  };

  const handleDeleteTable = async () => {
    if (!activeTable) return;
    try {
      await executeServiceAction('dynamodb', 'delete_table', { TableName: activeTable.TableName });
      setActionMessage({ type: 'success', text: `Table "${activeTable.TableName}" deleted.` });
      setSelectedTables([]);
      await loadTables();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete table' });
    }
  };

  const handleSaveItem = async () => {
    if (!activeTable) return;
    setSavingItem(true);
    setActionMessage(null);
    try {
      let parsed = {};
      try {
        parsed = JSON.parse(itemJson);
      } catch (e) {
        throw new Error('Invalid JSON format');
      }

      await putDynamoDbItem(activeTable.TableName, parsed);
      setActionMessage({ type: 'success', text: 'Item inserted into table successfully.' });
      setCreateItemOpen(false);
      await loadTableItems(activeTable);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to save item' });
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!activeTable || !selectedItemRows.length) return;
    const item = selectedItemRows[0];
    const pKey = activeTable.PartitionKey || 'id';
    const keyPayload: Record<string, any> = { [pKey]: item[pKey] };
    if (activeTable.SortKey && item[activeTable.SortKey]) {
      keyPayload[activeTable.SortKey] = item[activeTable.SortKey];
    }

    try {
      await deleteDynamoDbItem(activeTable.TableName, keyPayload);
      setActionMessage({ type: 'success', text: 'Item deleted.' });
      setSelectedItemRows([]);
      await loadTableItems(activeTable);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete item' });
    }
  };

  const handleRunPartiQL = async () => {
    if (!partiqlQuery.trim()) return;
    setRunningPartiql(true);
    setActionMessage(null);
    const start = performance.now();
    try {
      const res = await executeDynamoDbPartiQL(partiqlQuery.trim());
      setPartiqlLatency(Math.round(performance.now() - start));
      setPartiqlResults(res.items || []);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'PartiQL query failed' });
    } finally {
      setRunningPartiql(false);
    }
  };

  const filteredTables = tables.filter((t) =>
    t.TableName.toLowerCase().includes(tableFilter.toLowerCase())
  );

  // Collect dynamic columns from items
  const itemAttributeKeys = Array.from(
    new Set(tableItems.flatMap((it) => Object.keys(it || {})))
  );

  const partiqlAttributeKeys = Array.from(
    new Set(partiqlResults.flatMap((it) => Object.keys(it || {})))
  );

  return (
    <SpaceBetween size="l">
      {/* Header */}
      <Container
        header={
          <Header
            variant="h1"
            description="Fast, flexible NoSQL database service for single-digit millisecond performance at any scale."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadTables} loading={loading}>
                  Refresh
                </Button>
                <Button disabled={!activeTable} onClick={handleDeleteTable}>
                  Delete Table
                </Button>
                <Button variant="primary" iconName="add-plus" onClick={() => setCreateTableOpen(true)}>
                  Create Table
                </Button>
              </SpaceBetween>
            }
          >
            Amazon DynamoDB
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
            <Box variant="awsui-key-label">Active Tables</Box>
            <Box variant="h1" color="text-status-info">
              {tables.length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Billing Mode</Box>
            <Box variant="h2" color="text-status-info">
              <Badge color="blue">Pay-Per-Request (On-Demand)</Badge>
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Engine Health</Box>
            <Box variant="h2" color="text-status-info">
              <StatusIndicator type="success">DynamoDB Ready</StatusIndicator>
            </Box>
          </Box>
        </Grid>
      </Container>

      {/* Tables List */}
      <Container
        header={
          <Header
            variant="h2"
            description="Tables defined in your local DynamoDB environment."
          >
            Tables ({tables.length})
          </Header>
        }
      >
        <SpaceBetween size="m">
          <TextFilter
            filteringText={tableFilter}
            filteringPlaceholder="Find table by name..."
            onChange={({ detail }) => setTableFilter(detail.filteringText)}
          />

          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: 'Table Name',
                cell: (item) => <strong>{item.TableName}</strong>,
              },
              {
                id: 'status',
                header: 'Table Status',
                cell: (item) => <StatusIndicator type="success">{item.TableStatus}</StatusIndicator>,
                width: 140,
              },
              {
                id: 'pk',
                header: 'Partition Key (HASH)',
                cell: (item) => <code>{item.PartitionKey}</code>,
                width: 200,
              },
              {
                id: 'sk',
                header: 'Sort Key (RANGE)',
                cell: (item) => (item.SortKey ? <code>{item.SortKey}</code> : '—'),
                width: 200,
              },
            ]}
            items={filteredTables}
            selectionType="single"
            selectedItems={selectedTables}
            onSelectionChange={({ detail }) => setSelectedTables(detail.selectedItems)}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No DynamoDB tables found</b>
                <p>Create a table with a Partition Key to store NoSQL records.</p>
              </Box>
            }
          />
        </SpaceBetween>
      </Container>

      {/* Active Table Deepened Inspector */}
      {activeTable && (
        <Container
          header={
            <Header
              variant="h2"
              description={`Items and schema for ${activeTable.TableName}`}
            >
              Table: {activeTable.TableName}
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
                label: `Explore Items (${tableItems.length})`,
                id: 'items',
                content: (
                  <SpaceBetween size="m">
                    <Box float="right">
                      <SpaceBetween direction="horizontal" size="xs">
                        <Button iconName="refresh" onClick={() => loadTableItems(activeTable)} loading={loadingItems}>
                          Refresh Items
                        </Button>
                        <Button disabled={!selectedItemRows.length} onClick={handleDeleteItem}>
                          Delete Item
                        </Button>
                        <Button variant="primary" iconName="add-plus" onClick={() => setCreateItemOpen(true)}>
                          Create Item
                        </Button>
                      </SpaceBetween>
                    </Box>

                    <Table
                      columnDefinitions={[
                        ...(itemAttributeKeys.length > 0
                          ? itemAttributeKeys.map((k) => ({
                              id: k,
                              header: k === activeTable.PartitionKey ? `${k} (PK)` : k,
                              cell: (item: any) => {
                                const val = item[k];
                                if (val === undefined) return <span style={{ color: '#879596' }}>—</span>;
                                if (typeof val === 'object') return <code>{JSON.stringify(val)}</code>;
                                return <span>{String(val)}</span>;
                              },
                            }))
                          : [{ id: 'empty', header: 'No Attributes', cell: () => '—' }]),
                      ]}
                      items={tableItems}
                      loading={loadingItems}
                      selectionType="single"
                      selectedItems={selectedItemRows}
                      onSelectionChange={({ detail }) => setSelectedItemRows(detail.selectedItems)}
                      empty={
                        <Box textAlign="center">
                          <b>No items stored in this table</b>
                          <p>Click "Create Item" to insert a JSON document.</p>
                        </Box>
                      }
                    />
                  </SpaceBetween>
                ),
              },
              {
                label: 'PartiQL SQL Query Editor',
                id: 'partiql',
                content: (
                  <SpaceBetween size="m">
                    <FormField
                      label="PartiQL SQL Statement"
                      description="Execute SQL-compatible queries directly against your DynamoDB table."
                    >
                      <Textarea
                        rows={4}
                        value={partiqlQuery}
                        onChange={({ detail }) => setPartiqlQuery(detail.value)}
                        placeholder={`SELECT * FROM "${activeTable.TableName}" WHERE id = '101'`}
                      />
                    </FormField>

                    <SpaceBetween direction="horizontal" size="xs">
                      <Button variant="primary" iconName="caret-right-filled" loading={runningPartiql} onClick={handleRunPartiQL}>
                        Run Query
                      </Button>
                      <Button onClick={() => setPartiqlQuery(`SELECT * FROM "${activeTable.TableName}"`)}>
                        SELECT *
                      </Button>
                    </SpaceBetween>

                    {partiqlLatency != null && (
                      <Badge color="green">Executed in {partiqlLatency}ms ({partiqlResults.length} items returned)</Badge>
                    )}

                    {partiqlResults.length > 0 && (
                      <Table
                        columnDefinitions={partiqlAttributeKeys.map((k) => ({
                          id: k,
                          header: k,
                          cell: (item: any) => {
                            const val = item[k];
                            if (val === undefined) return <span style={{ color: '#879596' }}>—</span>;
                            if (typeof val === 'object') return <code>{JSON.stringify(val)}</code>;
                            return <span>{String(val)}</span>;
                          },
                        }))}
                        items={partiqlResults}
                      />
                    )}
                  </SpaceBetween>
                ),
              },
              {
                label: 'Overview & Schema',
                id: 'overview',
                content: (
                  <KeyValuePairs
                    columns={3}
                    items={[
                      { label: 'Table Name', value: activeTable.TableName },
                      { label: 'Table ARN', value: `arn:aws:dynamodb:us-east-1:000000000000:table/${activeTable.TableName}` },
                      { label: 'Status', value: activeTable.TableStatus },
                      { label: 'Partition Key (HASH)', value: `${activeTable.PartitionKey} (String)` },
                      { label: 'Sort Key (RANGE)', value: activeTable.SortKey ? `${activeTable.SortKey} (String)` : 'None' },
                      { label: 'Billing Mode', value: 'PAY_PER_REQUEST (On-Demand Capacity)' },
                    ]}
                  />
                ),
              },
            ]}
          />
        </Container>
      )}

      {/* Create Table Modal */}
      <Modal
        visible={createTableOpen}
        onDismiss={() => setCreateTableOpen(false)}
        header="Create DynamoDB Table"
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateTableOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creatingTable} onClick={handleCreateTable}>
                Create Table
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Table Name" description="Unique table name.">
            <Input
              value={tableName}
              onChange={({ detail }) => setTableName(detail.value)}
              placeholder="Orders"
            />
          </FormField>

          <Grid gridDefinition={[{ colspan: { default: 12, m: 6 } }, { colspan: { default: 12, m: 6 } }]}>
            <FormField label="Partition Key Name (Required)">
              <Input
                value={partitionKeyName}
                onChange={({ detail }) => setPartitionKeyName(detail.value)}
                placeholder="id"
              />
            </FormField>
            <FormField label="Partition Key Type">
              <Select
                selectedOption={partitionKeyType}
                onChange={({ detail }) => setPartitionKeyType(detail.selectedOption as any)}
                options={[
                  { label: 'String (S)', value: 'S' },
                  { label: 'Number (N)', value: 'N' },
                  { label: 'Binary (B)', value: 'B' },
                ]}
              />
            </FormField>
          </Grid>

          <Grid gridDefinition={[{ colspan: { default: 12, m: 6 } }, { colspan: { default: 12, m: 6 } }]}>
            <FormField label="Sort Key Name (Optional)">
              <Input
                value={sortKeyName}
                onChange={({ detail }) => setSortKeyName(detail.value)}
                placeholder="createdAt or sk"
              />
            </FormField>
            <FormField label="Sort Key Type">
              <Select
                selectedOption={sortKeyType}
                onChange={({ detail }) => setSortKeyType(detail.selectedOption as any)}
                options={[
                  { label: 'String (S)', value: 'S' },
                  { label: 'Number (N)', value: 'N' },
                  { label: 'Binary (B)', value: 'B' },
                ]}
              />
            </FormField>
          </Grid>
        </SpaceBetween>
      </Modal>

      {/* Create / Insert Item Modal */}
      <Modal
        visible={createItemOpen}
        onDismiss={() => setCreateItemOpen(false)}
        header={`Insert Item into ${activeTable?.TableName}`}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateItemOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={savingItem} onClick={handleSaveItem}>
                Save Item
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField
            label="Item Document (JSON)"
            description={`Must include partition key "${activeTable?.PartitionKey || 'id'}".`}
          >
            <Textarea
              rows={10}
              value={itemJson}
              onChange={({ detail }) => setItemJson(detail.value)}
              placeholder="{\n  &quot;id&quot;: &quot;123&quot;\n}"
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
