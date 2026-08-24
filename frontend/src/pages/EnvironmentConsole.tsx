import React, { useState, useEffect } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Tabs from '@cloudscape-design/components/tabs';
import Box from '@cloudscape-design/components/box';
import Badge from '@cloudscape-design/components/badge';
import Grid from '@cloudscape-design/components/grid';
import Alert from '@cloudscape-design/components/alert';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Checkbox from '@cloudscape-design/components/checkbox';
import {
  fetchIdentityDetail,
  useAdminIdentity,
  useUserIdentity,
  assumeRoleIdentity,
  clearSessionIdentity,
} from '../api/client';
import { CodeSnippet } from '../components/CodeSnippet';

export const EnvironmentConsole: React.FC = () => {
  const [identityData, setIdentityData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('admin');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // User switcher form
  const [userName, setUserName] = useState('');
  const [rotateKeys, setRotateKeys] = useState(false);
  const [switchingUser, setSwitchingUser] = useState(false);

  // Assume role form
  const [roleName, setRoleName] = useState('');
  const [sessionName, setSessionName] = useState('floci-session');
  const [accountId, setAccountId] = useState('000000000000');
  const [assumingRole, setAssumingRole] = useState(false);

  const loadIdentity = async () => {
    setLoading(true);
    try {
      const data = await fetchIdentityDetail();
      setIdentityData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIdentity();
  }, []);

  const handleUseAdmin = async () => {
    setLoading(true);
    setNotification(null);
    try {
      const updated = await useAdminIdentity();
      setIdentityData(updated);
      setNotification({ type: 'success', message: 'Restored default administrator session identity' });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to switch to admin identity' });
    } finally {
      setLoading(false);
    }
  };

  const handleUseUser = async () => {
    if (!userName.trim()) return;
    setSwitchingUser(true);
    setNotification(null);
    try {
      const updated = await useUserIdentity(userName.trim(), rotateKeys);
      setIdentityData(updated);
      setNotification({ type: 'success', message: `Active session switched to IAM user: ${userName.trim()}` });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to switch user' });
    } finally {
      setSwitchingUser(false);
    }
  };

  const handleAssumeRole = async () => {
    if (!roleName.trim()) return;
    setAssumingRole(true);
    setNotification(null);
    try {
      const updated = await assumeRoleIdentity(roleName.trim(), sessionName.trim(), accountId.trim());
      setIdentityData(updated);
      setNotification({ type: 'success', message: `Successfully assumed IAM role: ${roleName.trim()}` });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to assume role' });
    } finally {
      setAssumingRole(false);
    }
  };

  const handleClear = async () => {
    setLoading(true);
    setNotification(null);
    try {
      const updated = await clearSessionIdentity();
      setIdentityData(updated);
      setNotification({ type: 'info', message: 'Session credentials cleared' });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to clear session' });
    } finally {
      setLoading(false);
    }
  };

  const caller = identityData.caller_identity || {};
  const session = identityData.session_identity;

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h1"
            description="Inspect active AWS caller credentials, switch IAM user identities, or assume temporary IAM roles."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadIdentity} loading={loading}>
                  Refresh
                </Button>
                {session && (
                  <Button onClick={handleClear}>
                    Clear Session Override
                  </Button>
                )}
              </SpaceBetween>
            }
          >
            AWS Session Identity & Environment
          </Header>
        }
      >
        {notification && (
          <Box margin={{ bottom: 'l' }}>
            <Alert
              type={notification.type}
              dismissible
              onDismiss={() => setNotification(null)}
            >
              {notification.message}
            </Alert>
          </Box>
        )}

        <Grid gridDefinition={[{ colspan: { default: 12, s: 4 } }, { colspan: { default: 12, s: 4 } }, { colspan: { default: 12, s: 4 } }]}>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Active Session Type</Box>
            <Box variant="h2" color="text-status-info">
              <Badge color={session?.type === 'assumed_role' ? 'blue' : session?.type === 'user' ? 'green' : 'grey'}>
                {session?.type ? session.type.toUpperCase() : 'DEFAULT (ADMIN)'}
              </Badge>
            </Box>
            <Box variant="small">{session?.label || 'Root Admin'}</Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Resolved Account ID</Box>
            <Box variant="h2" color="text-status-info">
              <code>{caller.Account || '000000000000'}</code>
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Resolved Caller Identity</Box>
            <Box variant="small" color="text-status-info">
              <div style={{ wordBreak: 'break-all' }}>
                <code>{caller.Arn || 'arn:aws:iam::000000000000:root'}</code>
              </div>
            </Box>
          </Box>
        </Grid>
      </Container>

      {/* Identity Switcher Tabs */}
      <Tabs
        activeTabId={activeTab}
        onChange={({ detail }) => setActiveTab(detail.activeTabId)}
        tabs={[
          {
            label: 'Default Administrator',
            id: 'admin',
            content: (
              <Container
                header={
                  <Header
                    variant="h2"
                    description="Run console operations with unrestricted mock administrator credentials."
                    actions={
                      <Button variant="primary" onClick={handleUseAdmin} loading={loading}>
                        Use Admin Identity
                      </Button>
                    }
                  >
                    Administrator Credentials
                  </Header>
                }
              >
                <KeyValuePairs
                  columns={2}
                  items={[
                    { label: 'Caller ARN', value: <code>arn:aws:iam::000000000000:root</code> },
                    { label: 'Access Level', value: <Badge color="green">Full AdministratorAccess</Badge> },
                    { label: 'Session Expiry', value: 'Persistent (Never expires)' },
                    { label: 'STS Token', value: 'None required' },
                  ]}
                />
              </Container>
            ),
          },
          {
            label: 'Switch to IAM User',
            id: 'user',
            content: (
              <Container
                header={
                  <Header
                    variant="h2"
                    description="Execute requests as a specific IAM user with attached user policies."
                  >
                    IAM User Session
                  </Header>
                }
              >
                <SpaceBetween size="m">
                  <FormField
                    label="IAM User Name"
                    description="Enter the name of the IAM user to assume (e.g. Alice, Bob, Developer)."
                  >
                    <Input
                      value={userName}
                      onChange={({ detail }) => setUserName(detail.value)}
                      placeholder="Alice"
                    />
                  </FormField>

                  <Checkbox
                    checked={rotateKeys}
                    onChange={({ detail }) => setRotateKeys(detail.checked)}
                  >
                    Create or rotate user access keys automatically
                  </Checkbox>

                  <Button
                    variant="primary"
                    onClick={handleUseUser}
                    loading={switchingUser}
                    disabled={!userName.trim()}
                  >
                    Switch to User Identity
                  </Button>
                </SpaceBetween>
              </Container>
            ),
          },
          {
            label: 'Assume IAM Role (STS)',
            id: 'role',
            content: (
              <Container
                header={
                  <Header
                    variant="h2"
                    description="Call sts:AssumeRole to receive temporary session credentials."
                  >
                    STS Role Assumption
                  </Header>
                }
              >
                <SpaceBetween size="m">
                  <FormField label="Role Name" description="Target IAM role name to assume.">
                    <Input
                      value={roleName}
                      onChange={({ detail }) => setRoleName(detail.value)}
                      placeholder="MyLambdaExecutionRole"
                    />
                  </FormField>

                  <FormField label="Session Name" description="Identifier for the temporary role session.">
                    <Input
                      value={sessionName}
                      onChange={({ detail }) => setSessionName(detail.value)}
                      placeholder="floci-session"
                    />
                  </FormField>

                  <FormField label="AWS Account ID" description="12-digit AWS account ID.">
                    <Input
                      value={accountId}
                      onChange={({ detail }) => setAccountId(detail.value)}
                      placeholder="000000000000"
                    />
                  </FormField>

                  <Button
                    variant="primary"
                    onClick={handleAssumeRole}
                    loading={assumingRole}
                    disabled={!roleName.trim()}
                  >
                    Assume Role via STS
                  </Button>
                </SpaceBetween>
              </Container>
            ),
          },
        ]}
      />

      {/* Raw Identity Payload Inspector */}
      <Container
        header={
          <Header variant="h2" description="Raw caller identity metadata returned by the Floci STS / IAM engine.">
            Identity Context
          </Header>
        }
      >
        <CodeSnippet language="json" code={JSON.stringify(identityData, null, 2)} />
      </Container>
    </SpaceBetween>
  );
};
