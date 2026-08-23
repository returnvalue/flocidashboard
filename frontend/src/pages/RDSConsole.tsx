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

interface DBInstanceItem {
  DBInstanceIdentifier: string;
  Engine: string;
  DBInstanceStatus: string;
  DBInstanceClass: string;
  Endpoint?: { Address: string; Port: number };
  AllocatedStorage?: number;
}

export const RDSConsole: React.FC = () => {
  const [databases, setDatabases] = useState<DBInstanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<DBInstanceItem[]>([]);
  const [filterText, setFilterText] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [dbName, setDbName] = useState('');
  const [engine, setEngine] = useState('postgres');
  const [creating, setCreating] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchServiceInventory('rds');
      const list = (data.databases || data.DBInstances || []).map((db: any) => ({
        DBInstanceIdentifier: db.DBInstanceIdentifier || db.name || 'db-instance-1',
        Engine: db.Engine || 'postgres',
        DBInstanceStatus: db.DBInstanceStatus || db.status || 'available',
        DBInstanceClass: db.DBInstanceClass || 'db.t3.micro',
        Endpoint: db.Endpoint || { Address: 'localhost', Port: 5432 },
        AllocatedStorage: db.AllocatedStorage || 20,
      }));
      setDatabases(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateDB = async () => {
    if (!dbName.trim()) return;
    setCreating(true);
    try {
      await executeServiceAction('rds', 'create_db_instance', {
        DBInstanceIdentifier: dbName,
        Engine: engine,
        DBInstanceClass: 'db.t3.micro',
        AllocatedStorage: 20,
        MasterUsername: 'postgres',
        MasterUserPassword: 'password123',
      });
      setActionMessage({ type: 'success', text: `Database "${dbName}" created successfully.` });
      setCreateModalOpen(false);
      setDbName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create database' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDB = async () => {
    if (!selectedItems.length) return;
    try {
      await executeServiceAction('rds', 'delete_db_instance', {
        DBInstanceIdentifier: selectedItems[0].DBInstanceIdentifier,
        SkipFinalSnapshot: true,
      });
      setActionMessage({ type: 'success', text: 'Database deleted.' });
      setSelectedItems([]);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete database' });
    }
  };

  const filteredDBs = databases.filter((db) =>
    db.DBInstanceIdentifier.toLowerCase().includes(filterText.toLowerCase())
  );

  const activeDB = selectedItems[0];

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
            counter={`(${databases.length})`}
            description="Relational databases (PostgreSQL, MySQL, MariaDB) running in Floci."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <Button disabled={!selectedItems.length} onClick={handleDeleteDB}>
                  Delete database
                </Button>
                <Button
                  variant="primary"
                  iconName="add-plus"
                  onClick={() => setCreateModalOpen(true)}
                >
                  Create database
                </Button>
              </SpaceBetween>
            }
          >
            Databases
          </Header>
        }
        columnDefinitions={[
          {
            id: 'name',
            header: 'DB identifier',
            cell: (item) => (
              <Button variant="inline-link" onClick={() => setSelectedItems([item])}>
                <strong>{item.DBInstanceIdentifier}</strong>
              </Button>
            ),
            sortingField: 'DBInstanceIdentifier',
            isRowHeader: true,
          },
          {
            id: 'status',
            header: 'Status',
            cell: (item) => (
              <StatusIndicator type={item.DBInstanceStatus === 'available' ? 'success' : 'info'}>
                {item.DBInstanceStatus}
              </StatusIndicator>
            ),
          },
          {
            id: 'engine',
            header: 'Engine',
            cell: (item) => item.Engine,
          },
          {
            id: 'class',
            header: 'Size',
            cell: (item) => item.DBInstanceClass,
          },
          {
            id: 'endpoint',
            header: 'Endpoint & Port',
            cell: (item) => item.Endpoint ? `${item.Endpoint.Address}:${item.Endpoint.Port}` : 'localhost:5432',
          },
        ]}
        items={filteredDBs}
        loading={loading}
        loadingText="Loading RDS databases..."
        selectionType="single"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Filter databases by identifier..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
        }
        pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
        empty={
          <Box textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No databases found</b>
              <p>You have not created any RDS database instances yet.</p>
              <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
                Create database
              </Button>
            </SpaceBetween>
          </Box>
        }
      />

      {activeDB && (
        <Container header={<Header variant="h2">Database: {activeDB.DBInstanceIdentifier}</Header>}>
          <Tabs
            tabs={[
              {
                label: 'Connectivity & Security',
                id: 'connectivity',
                content: (
                  <KeyValuePairs
                    columns={2}
                    items={[
                      { label: 'Endpoint', value: activeDB.Endpoint?.Address || 'localhost' },
                      { label: 'Port', value: String(activeDB.Endpoint?.Port || 5432) },
                      { label: 'VPC Security groups', value: 'default-rds-sg (active)' },
                      { label: 'Publicly Accessible', value: 'Yes (Localhost bound)' },
                    ]}
                  />
                ),
              },
              {
                label: 'Configuration',
                id: 'config',
                content: (
                  <KeyValuePairs
                    columns={3}
                    items={[
                      { label: 'Engine', value: activeDB.Engine },
                      { label: 'DB instance class', value: activeDB.DBInstanceClass },
                      { label: 'Allocated storage', value: `${activeDB.AllocatedStorage || 20} GiB` },
                      { label: 'Storage type', value: 'General Purpose SSD (gp2)' },
                      { label: 'Master username', value: 'postgres' },
                      { label: 'Multi-AZ deployment', value: 'No (Single-AZ)' },
                    ]}
                  />
                ),
              },
            ]}
          />
        </Container>
      )}

      <Modal
        visible={createModalOpen}
        onDismiss={() => setCreateModalOpen(false)}
        header="Create RDS database instance"
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateDB} loading={creating}>
                Create database
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="DB instance identifier" description="A unique identifier for your database.">
            <Input
              value={dbName}
              onChange={({ detail }) => setDbName(detail.value)}
              placeholder="e.g. production-db"
            />
          </FormField>
          <FormField label="Database engine">
            <Input value={engine} onChange={({ detail }) => setEngine(detail.value)} />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
