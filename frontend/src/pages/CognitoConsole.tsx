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
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Grid from '@cloudscape-design/components/grid';
import Box from '@cloudscape-design/components/box';
import Badge from '@cloudscape-design/components/badge';
import Alert from '@cloudscape-design/components/alert';
import {
  fetchServiceInventory,
  createCognitoUserPool,
  createCognitoUser,
  createCognitoAppClient,
  initiateCognitoAuth,
  deleteCognitoUser,
} from '../api/client';
import { CodeSnippet } from '../components/CodeSnippet';

export const CognitoConsole: React.FC = () => {
  const [data, setData] = useState<any>({ user_pools: [] });
  const [loading, setLoading] = useState(true);
  const [selectedPools, setSelectedPools] = useState<any[]>([]);
  const [filterText, setFilterText] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create User Pool Modal
  const [createPoolOpen, setCreatePoolOpen] = useState(false);
  const [poolName, setPoolName] = useState('');
  const [creatingPool, setCreatingPool] = useState(false);

  // Create User Modal
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('Password123!');
  const [creatingUser, setCreatingUser] = useState(false);

  // Create App Client Modal
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);

  // Auth Sandbox State
  const [authUsername, setAuthUsername] = useState('developer-alice');
  const [authPassword, setAuthPassword] = useState('Password123!');
  const [authClientId, setAuthClientId] = useState('');
  const [authResult, setAuthResult] = useState<any | null>(null);
  const [authenticating, setAuthenticating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchServiceInventory('cognito');
      setData(res || { user_pools: [] });
      if (res.user_pools?.length > 0 && selectedPools.length === 0) {
        setSelectedPools([res.user_pools[0]]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activePool = selectedPools[0];

  useEffect(() => {
    if (activePool?.clients?.length > 0) {
      setAuthClientId(activePool.clients[0].ClientId || activePool.clients[0].id || '');
    } else if (activePool?.id) {
      setAuthClientId(`client-${activePool.id.substring(0, 8)}`);
    }
    setAuthResult(null);
  }, [activePool?.id, activePool?.Id]);

  const handleCreatePool = async () => {
    if (!poolName.trim()) return;
    setCreatingPool(true);
    setActionMessage(null);
    try {
      await createCognitoUserPool(poolName.trim());
      setActionMessage({ type: 'success', text: `User Pool "${poolName.trim()}" created successfully.` });
      setCreatePoolOpen(false);
      setPoolName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create user pool' });
    } finally {
      setCreatingPool(false);
    }
  };

  const handleCreateUser = async () => {
    if (!activePool || !userName.trim()) return;
    setCreatingUser(true);
    const poolId = activePool.Id || activePool.id;
    try {
      await createCognitoUser(poolId, userName.trim(), userPassword, userEmail.trim() || undefined);
      setActionMessage({ type: 'success', text: `User "${userName.trim()}" created in pool.` });
      setCreateUserOpen(false);
      setUserName('');
      setUserEmail('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create user' });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (uName: string) => {
    if (!activePool || !uName) return;
    const poolId = activePool.Id || activePool.id;
    try {
      await deleteCognitoUser(poolId, uName);
      setActionMessage({ type: 'success', text: `User "${uName}" deleted.` });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete user' });
    }
  };

  const handleCreateClient = async () => {
    if (!activePool || !clientName.trim()) return;
    setCreatingClient(true);
    const poolId = activePool.Id || activePool.id;
    try {
      await createCognitoAppClient(poolId, clientName.trim());
      setActionMessage({ type: 'success', text: `App Client "${clientName.trim()}" created.` });
      setCreateClientOpen(false);
      setClientName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create app client' });
    } finally {
      setCreatingClient(false);
    }
  };

  const handleTestAuth = async () => {
    if (!authClientId || !authUsername) return;
    setAuthenticating(true);
    setAuthResult(null);
    try {
      const res = await initiateCognitoAuth(authClientId, authUsername, authPassword);
      setAuthResult(res);
      setActionMessage({ type: 'success', text: 'Authentication successful: JWT tokens received.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Authentication failed' });
    } finally {
      setAuthenticating(false);
    }
  };

  const poolsList = (data.user_pools || []).map((p: any) => ({
    ...p,
    Id: p.Id || p.id,
    Name: p.Name || p.name,
    UsersCount: p.users?.length ?? p.user_count ?? 0,
    ClientsCount: p.clients?.length ?? p.client_count ?? 0,
    Status: p.Status || 'Active',
    CreationDate: p.CreationDate || p.created || new Date().toISOString().split('T')[0],
  }));

  const filteredPools = poolsList.filter((p: any) =>
    `${p.Name} ${p.Id}`.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <SpaceBetween size="l">
      {/* Header */}
      <Container
        header={
          <Header
            variant="h1"
            description="Simple and secure user identity management and authentication service."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <Button variant="primary" iconName="add-plus" onClick={() => setCreatePoolOpen(true)}>
                  Create User Pool
                </Button>
              </SpaceBetween>
            }
          >
            Amazon Cognito
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
            <Box variant="awsui-key-label">User Pools</Box>
            <Box variant="h1" color="text-status-info">
              {poolsList.length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Identity Provider</Box>
            <Box variant="h2" color="text-status-info">
              <Badge color="blue">OIDC & JWT Tokens</Badge>
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Engine Health</Box>
            <Box variant="h2" color="text-status-info">
              <StatusIndicator type="success">Cognito Active</StatusIndicator>
            </Box>
          </Box>
        </Grid>
      </Container>

      {/* User Pools List */}
      <Container
        header={
          <Header
            variant="h2"
            description="User directory pools for customer authentication."
          >
            User Pools ({poolsList.length})
          </Header>
        }
      >
        <SpaceBetween size="m">
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Find user pool by name or ID..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />

          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: 'User Pool Name',
                cell: (item) => <strong>{item.Name}</strong>,
              },
              {
                id: 'id',
                header: 'User Pool ID',
                cell: (item) => <code>{item.Id}</code>,
                width: 220,
              },
              {
                id: 'users',
                header: 'Users',
                cell: (item) => item.UsersCount,
                width: 100,
              },
              {
                id: 'clients',
                header: 'App Clients',
                cell: (item) => item.ClientsCount,
                width: 120,
              },
              {
                id: 'status',
                header: 'Status',
                cell: () => <StatusIndicator type="success">Active</StatusIndicator>,
                width: 120,
              },
            ]}
            items={filteredPools}
            selectionType="single"
            selectedItems={selectedPools}
            onSelectionChange={({ detail }) => setSelectedPools(detail.selectedItems)}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No user pools found</b>
                <p>Create a User Pool to manage user sign-up and authentication.</p>
              </Box>
            }
          />
        </SpaceBetween>
      </Container>

      {/* Active Pool Deepened Tabs */}
      {activePool && (
        <Container
          header={
            <Header
              variant="h2"
              description={`Directory management for ${activePool.Name || activePool.name}`}
            >
              User Pool: {activePool.Name || activePool.name}
            </Header>
          }
        >
          <Tabs
            tabs={[
              {
                label: `Users (${activePool.users?.length ?? 0})`,
                id: 'users',
                content: (
                  <SpaceBetween size="m">
                    <Box float="right">
                      <Button variant="primary" iconName="add-plus" onClick={() => setCreateUserOpen(true)}>
                        Create User
                      </Button>
                    </Box>

                    <Table
                      columnDefinitions={[
                        { id: 'username', header: 'Username', cell: (i: any) => <strong>{i.Username || i.username}</strong> },
                        { id: 'status', header: 'User Status', cell: (i: any) => <Badge color="green">{i.UserStatus || i.status || 'CONFIRMED'}</Badge>, width: 150 },
                        { id: 'email', header: 'Email', cell: (i: any) => i.Attributes?.find((a: any) => a.Name === 'email')?.Value || i.email || '—' },
                        {
                          id: 'action',
                          header: 'Action',
                          cell: (i: any) => (
                            <Button onClick={() => handleDeleteUser(i.Username || i.username)}>
                              Delete
                            </Button>
                          ),
                          width: 100,
                        },
                      ]}
                      items={activePool.users || []}
                      empty={<Box textAlign="center">No users in this pool. Click "Create User" to add one.</Box>}
                    />
                  </SpaceBetween>
                ),
              },
              {
                label: `App Clients (${activePool.clients?.length ?? 0})`,
                id: 'clients',
                content: (
                  <SpaceBetween size="m">
                    <Box float="right">
                      <Button variant="primary" iconName="add-plus" onClick={() => setCreateClientOpen(true)}>
                        Create App Client
                      </Button>
                    </Box>

                    <Table
                      columnDefinitions={[
                        { id: 'name', header: 'Client Name', cell: (i: any) => <strong>{i.ClientName || i.name}</strong> },
                        { id: 'id', header: 'App Client ID', cell: (i: any) => <code>{i.ClientId || i.id}</code> },
                      ]}
                      items={activePool.clients || []}
                      empty={<Box textAlign="center">No app clients configured. Create one to enable application login.</Box>}
                    />
                  </SpaceBetween>
                ),
              },
              {
                label: 'Authentication Sandbox',
                id: 'auth',
                content: (
                  <Container
                    header={
                      <Header
                        variant="h3"
                        description="Test USER_PASSWORD_AUTH login flow against this user pool and inspect issued JWT tokens."
                      >
                        Cognito Login Simulator
                      </Header>
                    }
                  >
                    <SpaceBetween size="m">
                      <Grid gridDefinition={[{ colspan: { default: 12, m: 4 } }, { colspan: { default: 12, m: 4 } }, { colspan: { default: 12, m: 4 } }]}>
                        <FormField label="App Client ID">
                          <Input
                            value={authClientId}
                            onChange={({ detail }) => setAuthClientId(detail.value)}
                            placeholder="client-id"
                          />
                        </FormField>

                        <FormField label="Username">
                          <Input
                            value={authUsername}
                            onChange={({ detail }) => setAuthUsername(detail.value)}
                            placeholder="developer-alice"
                          />
                        </FormField>

                        <FormField label="Password">
                          <Input
                            type="password"
                            value={authPassword}
                            onChange={({ detail }) => setAuthPassword(detail.value)}
                          />
                        </FormField>
                      </Grid>

                      <Button variant="primary" iconName="caret-right-filled" loading={authenticating} onClick={handleTestAuth}>
                        Authenticate User (InitiateAuth)
                      </Button>

                      {authResult && (
                        <Container header={<Header variant="h3">Authentication Response & Tokens</Header>}>
                          <CodeSnippet language="json" code={JSON.stringify(authResult, null, 2)} />
                        </Container>
                      )}
                    </SpaceBetween>
                  </Container>
                ),
              },
              {
                label: 'Pool Overview',
                id: 'overview',
                content: (
                  <KeyValuePairs
                    columns={3}
                    items={[
                      { label: 'User Pool ID', value: activePool.Id || activePool.id },
                      { label: 'Pool Name', value: activePool.Name || activePool.name },
                      { label: 'Creation Date', value: activePool.CreationDate },
                      { label: 'MFA Configuration', value: 'Optional (SMS & TOTP)' },
                      { label: 'Estimated Users', value: String(activePool.users?.length ?? 0) },
                    ]}
                  />
                ),
              },
            ]}
          />
        </Container>
      )}

      {/* Create User Pool Modal */}
      <Modal
        visible={createPoolOpen}
        onDismiss={() => setCreatePoolOpen(false)}
        header="Create User Pool"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreatePoolOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creatingPool} onClick={handleCreatePool}>
                Create Pool
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <FormField label="User Pool Name" description="Unique identifier for this user directory.">
          <Input
            value={poolName}
            onChange={({ detail }) => setPoolName(detail.value)}
            placeholder="MyAppUserPool"
          />
        </FormField>
      </Modal>

      {/* Create User Modal */}
      <Modal
        visible={createUserOpen}
        onDismiss={() => setCreateUserOpen(false)}
        header={`Create User in ${activePool?.Name}`}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateUserOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creatingUser} onClick={handleCreateUser}>
                Create User
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Username" description="Login username for the customer/developer.">
            <Input
              value={userName}
              onChange={({ detail }) => setUserName(detail.value)}
              placeholder="developer-alice"
            />
          </FormField>

          <FormField label="Email Address (Optional)">
            <Input
              value={userEmail}
              onChange={({ detail }) => setUserEmail(detail.value)}
              placeholder="alice@example.com"
            />
          </FormField>

          <FormField label="Initial Password">
            <Input
              type="password"
              value={userPassword}
              onChange={({ detail }) => setUserPassword(detail.value)}
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Create App Client Modal */}
      <Modal
        visible={createClientOpen}
        onDismiss={() => setCreateClientOpen(false)}
        header={`Create App Client in ${activePool?.Name}`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateClientOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creatingClient} onClick={handleCreateClient}>
                Create App Client
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <FormField label="App Client Name" description="Identifier for your web or mobile frontend application.">
          <Input
            value={clientName}
            onChange={({ detail }) => setClientName(detail.value)}
            placeholder="WebAppClient"
          />
        </FormField>
      </Modal>
    </SpaceBetween>
  );
};
