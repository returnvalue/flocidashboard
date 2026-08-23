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

interface UserItem {
  UserName: string;
  UserId: string;
  Arn: string;
  CreateDate: string;
  Path?: string;
  AttachedPolicies?: Array<{ PolicyName: string; PolicyArn: string }>;
}

export const IAMConsole: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<UserItem[]>([]);
  const [filterText, setFilterText] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [creating, setCreating] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchServiceInventory('iam');
      const list = (data.users || data.Users || []).map((u: any) => ({
        UserName: u.UserName || u.name || 'Alice',
        UserId: u.UserId || u.id || 'AIDA0123456789EXAMPLE',
        Arn: u.Arn || `arn:aws:iam::000000000000:user/${u.UserName || 'Alice'}`,
        CreateDate: u.CreateDate || u.created || new Date().toISOString().split('T')[0],
        Path: u.Path || '/',
        AttachedPolicies: u.AttachedPolicies || [{ PolicyName: 'AdministratorAccess', PolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess' }],
      }));
      setUsers(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async () => {
    if (!newUserName.trim()) return;
    setCreating(true);
    try {
      await executeServiceAction('iam', 'create_user', { UserName: newUserName });
      setActionMessage({ type: 'success', text: `User "${newUserName}" created successfully.` });
      setCreateModalOpen(false);
      setNewUserName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create user' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedItems.length) return;
    const user = selectedItems[0];
    try {
      await executeServiceAction('iam', 'delete_user', { UserName: user.UserName });
      setActionMessage({ type: 'success', text: `User "${user.UserName}" deleted.` });
      setSelectedItems([]);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete user' });
    }
  };

  const filteredUsers = users.filter((u) =>
    u.UserName.toLowerCase().includes(filterText.toLowerCase())
  );

  const activeUser = selectedItems[0];

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
            counter={`(${users.length})`}
            description="Manage IAM users and their security credentials and permissions."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <Button disabled={!selectedItems.length} onClick={handleDeleteUser}>
                  Delete user
                </Button>
                <Button
                  variant="primary"
                  iconName="add-plus"
                  onClick={() => setCreateModalOpen(true)}
                >
                  Create user
                </Button>
              </SpaceBetween>
            }
          >
            Users
          </Header>
        }
        columnDefinitions={[
          {
            id: 'name',
            header: 'User name',
            cell: (item) => (
              <Button variant="inline-link" onClick={() => setSelectedItems([item])}>
                <strong>{item.UserName}</strong>
              </Button>
            ),
            sortingField: 'UserName',
            isRowHeader: true,
          },
          {
            id: 'path',
            header: 'Path',
            cell: (item) => item.Path || '/',
          },
          {
            id: 'arn',
            header: 'User ARN',
            cell: (item) => item.Arn,
          },
          {
            id: 'creationDate',
            header: 'Created date',
            cell: (item) => item.CreateDate,
          },
        ]}
        items={filteredUsers}
        loading={loading}
        loadingText="Loading IAM users..."
        selectionType="single"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Filter users by name..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
        }
        pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
        empty={
          <Box textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No users found</b>
              <p>You have not created any IAM users yet.</p>
              <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
                Create user
              </Button>
            </SpaceBetween>
          </Box>
        }
      />

      {activeUser && (
        <Container header={<Header variant="h2">User: {activeUser.UserName}</Header>}>
          <Tabs
            tabs={[
              {
                label: 'Permissions',
                id: 'permissions',
                content: (
                  <SpaceBetween size="m">
                    <Header
                      variant="h3"
                      actions={<Button iconName="add-plus">Add permissions</Button>}
                    >
                      Permissions policies (1)
                    </Header>
                    <Table
                      columnDefinitions={[
                        { id: 'name', header: 'Policy name', cell: (i) => <strong>{i.PolicyName}</strong> },
                        { id: 'type', header: 'Type', cell: () => 'AWS managed policy' },
                        { id: 'arn', header: 'Policy ARN', cell: (i) => i.PolicyArn },
                      ]}
                      items={activeUser.AttachedPolicies || []}
                    />
                  </SpaceBetween>
                ),
              },
              {
                label: 'Security credentials',
                id: 'credentials',
                content: (
                  <SpaceBetween size="m">
                    <KeyValuePairs
                      columns={2}
                      items={[
                        { label: 'Console password', value: 'Enabled' },
                        { label: 'Assigned MFA device', value: 'No MFA assigned' },
                        { label: 'Active Access Keys', value: '1 access key (AKIA0123456789EXAMPLE)' },
                        { label: 'Signing certificates', value: '0 certificates' },
                      ]}
                    />
                  </SpaceBetween>
                ),
              },
              {
                label: 'Summary & ARN',
                id: 'summary',
                content: (
                  <KeyValuePairs
                    columns={2}
                    items={[
                      { label: 'User ARN', value: activeUser.Arn },
                      { label: 'User ID', value: activeUser.UserId },
                      { label: 'Path', value: activeUser.Path || '/' },
                      { label: 'Creation time', value: activeUser.CreateDate },
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
        header="Create IAM user"
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateUser} loading={creating}>
                Create user
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField
            label="User name"
            description="Specify user name (e.g. Alice, developer, ci-cd-agent)."
          >
            <Input
              value={newUserName}
              onChange={({ detail }) => setNewUserName(detail.value)}
              placeholder="e.g. Alice"
            />
          </FormField>
          <FormField label="Access type">
            <Input value="Programmatic access & AWS Management Console access" disabled />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
