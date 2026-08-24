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
  createIamRole,
  deleteIamRole,
  createIamGroup,
  simulateIamPolicy,
} from '../api/client';
import { CodeSnippet } from '../components/CodeSnippet';

interface UserItem {
  UserName: string;
  UserId: string;
  Arn: string;
  CreateDate: string;
  Path?: string;
  AttachedPolicies?: Array<{ PolicyName: string; PolicyArn: string }>;
}

interface RoleItem {
  RoleName: string;
  RoleId: string;
  Arn: string;
  CreateDate: string;
  AssumeRolePolicyDocument?: any;
  Description?: string;
}

const TRUST_TEMPLATES: Record<string, { label: string; doc: any }> = {
  lambda: {
    label: 'AWS Lambda (Serverless functions)',
    doc: {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'lambda.amazonaws.com' },
          Action: 'sts:AssumeRole',
        },
      ],
    },
  },
  ec2: {
    label: 'Amazon EC2 (Virtual servers & instances)',
    doc: {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'ec2.amazonaws.com' },
          Action: 'sts:AssumeRole',
        },
      ],
    },
  },
  ecs: {
    label: 'Amazon ECS Tasks (Container tasks)',
    doc: {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'ecs-tasks.amazonaws.com' },
          Action: 'sts:AssumeRole',
        },
      ],
    },
  },
  apigateway: {
    label: 'Amazon API Gateway (REST & HTTP APIs)',
    doc: {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'apigateway.amazonaws.com' },
          Action: 'sts:AssumeRole',
        },
      ],
    },
  },
  states: {
    label: 'AWS Step Functions (State machines)',
    doc: {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'states.amazonaws.com' },
          Action: 'sts:AssumeRole',
        },
      ],
    },
  },
};

export const IAMConsole: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selected Items
  const [selectedUsers, setSelectedUsers] = useState<UserItem[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<RoleItem[]>([]);
  const [userFilter, setUserFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Create User Modal
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  // Create Role Modal
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState({ label: 'AWS Lambda (Serverless functions)', value: 'lambda' });
  const [customTrustDoc, setCustomTrustDoc] = useState(JSON.stringify(TRUST_TEMPLATES.lambda.doc, null, 2));
  const [creatingRole, setCreatingRole] = useState(false);

  // Create Group Modal
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Policy Simulator State
  const [simPrincipal, setSimPrincipal] = useState({ label: 'floci-root (Administrator)', value: 'arn:aws:iam::000000000000:root' });
  const [simActions, setSimActions] = useState('s3:GetObject\nsqs:SendMessage\ndynamodb:PutItem');
  const [simResourceArn, setSimResourceArn] = useState('*');
  const [simResults, setSimResults] = useState<any[]>([]);
  const [simulating, setSimulating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchServiceInventory('iam');
      const uList = (data.users || data.Users || []).map((u: any) => ({
        UserName: u.UserName || u.name || 'Alice',
        UserId: u.UserId || u.id || 'AIDA0123456789EXAMPLE',
        Arn: u.Arn || `arn:aws:iam::000000000000:user/${u.UserName || 'Alice'}`,
        CreateDate: u.CreateDate || u.created || new Date().toISOString().split('T')[0],
        Path: u.Path || '/',
        AttachedPolicies: u.AttachedPolicies || [{ PolicyName: 'AdministratorAccess', PolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess' }],
      }));
      setUsers(uList);
      if (uList.length > 0 && selectedUsers.length === 0) {
        setSelectedUsers([uList[0]]);
      }

      const rList = (data.roles || data.Roles || []).map((r: any) => ({
        RoleName: r.RoleName || r.name,
        RoleId: r.RoleId || r.id,
        Arn: r.Arn || `arn:aws:iam::000000000000:role/${r.RoleName || r.name}`,
        CreateDate: r.CreateDate || r.created || new Date().toISOString().split('T')[0],
        AssumeRolePolicyDocument: r.AssumeRolePolicyDocument || r.assume_role_policy_document || TRUST_TEMPLATES.lambda.doc,
        Description: r.Description || r.description || '—',
      }));
      setRoles(rList);
      if (rList.length > 0 && selectedRoles.length === 0) {
        setSelectedRoles([rList[0]]);
      }

      setGroups(data.groups || data.Groups || []);
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
    setCreatingUser(true);
    setActionMessage(null);
    try {
      await executeServiceAction('iam', 'create_user', { user_name: newUserName.trim() });
      setActionMessage({ type: 'success', text: `IAM User "${newUserName.trim()}" created successfully.` });
      setCreateUserOpen(false);
      setNewUserName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create user' });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUsers.length) return;
    const user = selectedUsers[0];
    try {
      await executeServiceAction('iam', 'cleanup_user', { user_name: user.UserName, force: true });
      setActionMessage({ type: 'success', text: `User "${user.UserName}" deleted.` });
      setSelectedUsers([]);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete user' });
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    setCreatingRole(true);
    setActionMessage(null);
    try {
      let parsedDoc = null;
      try {
        parsedDoc = JSON.parse(customTrustDoc);
      } catch (e) {}

      await createIamRole(newRoleName.trim(), selectedTemplateKey.value, parsedDoc);
      setActionMessage({ type: 'success', text: `IAM Role "${newRoleName.trim()}" created successfully.` });
      setCreateRoleOpen(false);
      setNewRoleName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create role' });
    } finally {
      setCreatingRole(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRoles.length) return;
    const role = selectedRoles[0];
    try {
      await deleteIamRole(role.RoleName);
      setActionMessage({ type: 'success', text: `Role "${role.RoleName}" deleted.` });
      setSelectedRoles([]);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete role' });
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      await createIamGroup(newGroupName.trim());
      setActionMessage({ type: 'success', text: `IAM Group "${newGroupName.trim()}" created.` });
      setCreateGroupOpen(false);
      setNewGroupName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create group' });
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleSimulatePolicy = async () => {
    setSimulating(true);
    try {
      const actionsList = simActions
        .split('\n')
        .map((a) => a.trim())
        .filter(Boolean);
      const res = await simulateIamPolicy(simPrincipal.value, actionsList, [simResourceArn.trim() || '*']);
      setSimResults(res.EvaluationResults || res.results || []);
      setActionMessage({ type: 'success', text: 'Policy simulation evaluated successfully.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Simulation failed' });
    } finally {
      setSimulating(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.UserName.toLowerCase().includes(userFilter.toLowerCase())
  );

  const filteredRoles = roles.filter((r) =>
    r.RoleName.toLowerCase().includes(roleFilter.toLowerCase())
  );

  const activeUser = selectedUsers[0];
  const activeRole = selectedRoles[0];

  return (
    <SpaceBetween size="l">
      {/* Header */}
      <Container
        header={
          <Header
            variant="h1"
            description="Manage access and identity for mock AWS services and local developers."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <Button variant="primary" iconName="add-plus" onClick={() => setCreateUserOpen(true)}>
                  Create User
                </Button>
              </SpaceBetween>
            }
          >
            AWS Identity and Access Management (IAM)
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
            <Box variant="awsui-key-label">IAM Users</Box>
            <Box variant="h1" color="text-status-info">
              {users.length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">IAM Roles</Box>
            <Box variant="h1" color="text-status-info">
              {roles.length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">IAM Groups</Box>
            <Box variant="h1" color="text-status-info">
              {groups.length}
            </Box>
          </Box>
        </Grid>
      </Container>

      {/* Main Tabs */}
      <Tabs
        tabs={[
          {
            label: `Users (${users.length})`,
            id: 'users',
            content: (
              <SpaceBetween size="l">
                <Container
                  header={
                    <Header
                      variant="h2"
                      actions={
                        <SpaceBetween direction="horizontal" size="xs">
                          <Button disabled={!selectedUsers.length} onClick={handleDeleteUser}>
                            Delete User
                          </Button>
                          <Button variant="primary" iconName="add-plus" onClick={() => setCreateUserOpen(true)}>
                            Add User
                          </Button>
                        </SpaceBetween>
                      }
                    >
                      IAM Users
                    </Header>
                  }
                >
                  <SpaceBetween size="m">
                    <TextFilter
                      filteringText={userFilter}
                      filteringPlaceholder="Find user by name..."
                      onChange={({ detail }) => setUserFilter(detail.filteringText)}
                    />

                    <Table
                      columnDefinitions={[
                        {
                          id: 'name',
                          header: 'User Name',
                          cell: (item) => <strong>{item.UserName}</strong>,
                        },
                        {
                          id: 'path',
                          header: 'Path',
                          cell: (item) => item.Path || '/',
                          width: 100,
                        },
                        {
                          id: 'arn',
                          header: 'User ARN',
                          cell: (item) => <code>{item.Arn}</code>,
                        },
                        {
                          id: 'created',
                          header: 'Created Time',
                          cell: (item) => item.CreateDate,
                          width: 140,
                        },
                      ]}
                      items={filteredUsers}
                      selectionType="single"
                      selectedItems={selectedUsers}
                      onSelectionChange={({ detail }) => setSelectedUsers(detail.selectedItems)}
                      empty={<Box textAlign="center">No IAM users found.</Box>}
                    />
                  </SpaceBetween>
                </Container>

                {activeUser && (
                  <Container header={<Header variant="h2">User: {activeUser.UserName}</Header>}>
                    <Tabs
                      tabs={[
                        {
                          label: 'Permissions',
                          id: 'perms',
                          content: (
                            <Table
                              columnDefinitions={[
                                { id: 'policy', header: 'Policy Name', cell: (i) => <strong>{i.PolicyName}</strong> },
                                { id: 'arn', header: 'Policy ARN', cell: (i) => <code>{i.PolicyArn}</code> },
                                { id: 'type', header: 'Type', cell: () => <Badge color="blue">AWS Managed</Badge>, width: 140 },
                              ]}
                              items={activeUser.AttachedPolicies || []}
                              empty={<Box textAlign="center">No policies attached.</Box>}
                            />
                          ),
                        },
                        {
                          label: 'Security Credentials',
                          id: 'creds',
                          content: (
                            <KeyValuePairs
                              columns={2}
                              items={[
                                { label: 'User ARN', value: activeUser.Arn },
                                { label: 'Console Password', value: 'Enabled' },
                                { label: 'Access Keys', value: '1 Active Key' },
                                { label: 'MFA Status', value: 'Not configured' },
                              ]}
                            />
                          ),
                        },
                      ]}
                    />
                  </Container>
                )}
              </SpaceBetween>
            ),
          },
          {
            label: `Roles (${roles.length})`,
            id: 'roles',
            content: (
              <SpaceBetween size="l">
                <Container
                  header={
                    <Header
                      variant="h2"
                      description="An IAM role is an identity with permission policies that determine what the identity can and cannot do in AWS."
                      actions={
                        <SpaceBetween direction="horizontal" size="xs">
                          <Button disabled={!selectedRoles.length} onClick={handleDeleteRole}>
                            Delete Role
                          </Button>
                          <Button variant="primary" iconName="add-plus" onClick={() => setCreateRoleOpen(true)}>
                            Create Role
                          </Button>
                        </SpaceBetween>
                      }
                    >
                      IAM Roles
                    </Header>
                  }
                >
                  <SpaceBetween size="m">
                    <TextFilter
                      filteringText={roleFilter}
                      filteringPlaceholder="Find role by name..."
                      onChange={({ detail }) => setRoleFilter(detail.filteringText)}
                    />

                    <Table
                      columnDefinitions={[
                        {
                          id: 'name',
                          header: 'Role Name',
                          cell: (item) => <strong>{item.RoleName}</strong>,
                        },
                        {
                          id: 'arn',
                          header: 'Role ARN',
                          cell: (item) => <code>{item.Arn}</code>,
                        },
                        {
                          id: 'created',
                          header: 'Created Time',
                          cell: (item) => item.CreateDate,
                          width: 140,
                        },
                      ]}
                      items={filteredRoles}
                      selectionType="single"
                      selectedItems={selectedRoles}
                      onSelectionChange={({ detail }) => setSelectedRoles(detail.selectedItems)}
                      empty={<Box textAlign="center">No IAM roles found.</Box>}
                    />
                  </SpaceBetween>
                </Container>

                {activeRole && (
                  <Container header={<Header variant="h2">Role: {activeRole.RoleName}</Header>}>
                    <Tabs
                      tabs={[
                        {
                          label: 'Trust Relationships',
                          id: 'trust',
                          content: (
                            <SpaceBetween size="m">
                              <Box variant="p">
                                The following trust policy defines which principals or AWS services are trusted to assume this role via <code>sts:AssumeRole</code>.
                              </Box>
                              <CodeSnippet
                                language="json"
                                code={
                                  typeof activeRole.AssumeRolePolicyDocument === 'string'
                                    ? activeRole.AssumeRolePolicyDocument
                                    : JSON.stringify(activeRole.AssumeRolePolicyDocument, null, 2)
                                }
                              />
                            </SpaceBetween>
                          ),
                        },
                        {
                          label: 'Role Details',
                          id: 'details',
                          content: (
                            <KeyValuePairs
                              columns={2}
                              items={[
                                { label: 'Role Name', value: activeRole.RoleName },
                                { label: 'Role ARN', value: activeRole.Arn },
                                { label: 'Creation Date', value: activeRole.CreateDate },
                                { label: 'Max Session Duration', value: '3,600 seconds (1 hour)' },
                              ]}
                            />
                          ),
                        },
                      ]}
                    />
                  </Container>
                )}
              </SpaceBetween>
            ),
          },
          {
            label: `User Groups (${groups.length})`,
            id: 'groups',
            content: (
              <Container
                header={
                  <Header
                    variant="h2"
                    actions={
                      <Button variant="primary" iconName="add-plus" onClick={() => setCreateGroupOpen(true)}>
                        Create Group
                      </Button>
                    }
                  >
                    IAM User Groups
                  </Header>
                }
              >
                <Table
                  columnDefinitions={[
                    { id: 'name', header: 'Group Name', cell: (item) => <strong>{item.GroupName || item.name}</strong> },
                    { id: 'arn', header: 'Group ARN', cell: (item) => <code>{item.Arn || `arn:aws:iam::000000000000:group/${item.GroupName || item.name}`}</code> },
                    { id: 'users', header: 'Users Count', cell: (item) => item.Users?.length ?? 0, width: 140 },
                  ]}
                  items={groups}
                  empty={<Box textAlign="center">No user groups defined.</Box>}
                />
              </Container>
            ),
          },
          {
            label: 'IAM Policy Simulator',
            id: 'simulator',
            content: (
              <Container
                header={
                  <Header
                    variant="h2"
                    description="Test and troubleshoot IAM and resource-based policies by simulating authorization evaluations."
                  >
                    Policy Evaluation Simulator
                  </Header>
                }
              >
                <SpaceBetween size="m">
                  <Grid gridDefinition={[{ colspan: { default: 12, m: 6 } }, { colspan: { default: 12, m: 6 } }]}>
                    <FormField label="Principal (IAM User or Role)" description="The security principal executing the simulated API call.">
                      <Select
                        selectedOption={simPrincipal}
                        onChange={({ detail }) => setSimPrincipal(detail.selectedOption as any)}
                        options={[
                          { label: 'floci-root (Administrator)', value: 'arn:aws:iam::000000000000:root' },
                          ...users.map((u) => ({ label: `User: ${u.UserName}`, value: u.Arn })),
                          ...roles.map((r) => ({ label: `Role: ${r.RoleName}`, value: r.Arn })),
                        ]}
                      />
                    </FormField>

                    <FormField label="Resource ARN" description="Target AWS resource (or '*' for wildcard matching).">
                      <Input
                        value={simResourceArn}
                        onChange={({ detail }) => setSimResourceArn(detail.value)}
                        placeholder="arn:aws:s3:::my-bucket/* or *"
                      />
                    </FormField>
                  </Grid>

                  <FormField
                    label="Actions to Simulate (one per line)"
                    description="Specify AWS API actions to evaluate against attached permission policies."
                  >
                    <Textarea
                      rows={4}
                      value={simActions}
                      onChange={({ detail }) => setSimActions(detail.value)}
                      placeholder="s3:GetObject\nsqs:SendMessage\ndynamodb:PutItem"
                    />
                  </FormField>

                  <Button variant="primary" iconName="caret-right-filled" loading={simulating} onClick={handleSimulatePolicy}>
                    Run Policy Simulation
                  </Button>

                  {simResults.length > 0 && (
                    <Container header={<Header variant="h3">Evaluation Results</Header>}>
                      <Table
                        columnDefinitions={[
                          { id: 'action', header: 'Action Name', cell: (i: any) => <code>{i.EvalActionName || i.action}</code> },
                          { id: 'resource', header: 'Resource Spec', cell: (i: any) => <code>{i.EvalResourceName || i.resource || '*'}</code> },
                          {
                            id: 'decision',
                            header: 'Decision',
                            cell: (i: any) => {
                              const dec = i.EvalDecision || i.decision || 'allowed';
                              const isAllowed = dec.toLowerCase() === 'allowed';
                              return (
                                <StatusIndicator type={isAllowed ? 'success' : 'error'}>
                                  {isAllowed ? 'Allowed' : 'Implicit Deny'}
                                </StatusIndicator>
                              );
                            },
                            width: 160,
                          },
                        ]}
                        items={simResults}
                      />
                    </Container>
                  )}
                </SpaceBetween>
              </Container>
            ),
          },
        ]}
      />

      {/* Create User Modal */}
      <Modal
        visible={createUserOpen}
        onDismiss={() => setCreateUserOpen(false)}
        header="Create IAM User"
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
        <FormField label="User Name" description="Unique alphanumeric IAM username.">
          <Input
            value={newUserName}
            onChange={({ detail }) => setNewUserName(detail.value)}
            placeholder="developer-alice"
          />
        </FormField>
      </Modal>

      {/* Create Role Modal */}
      <Modal
        visible={createRoleOpen}
        onDismiss={() => setCreateRoleOpen(false)}
        header="Create IAM Role"
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateRoleOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creatingRole} onClick={handleCreateRole}>
                Create Role
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Role Name" description="Unique role identifier.">
            <Input
              value={newRoleName}
              onChange={({ detail }) => setNewRoleName(detail.value)}
              placeholder="LambdaExecutionRole"
            />
          </FormField>

          <FormField label="Trusted Entity Service (Trust Template)">
            <Select
              selectedOption={selectedTemplateKey}
              onChange={({ detail }) => {
                const opt = detail.selectedOption as any;
                setSelectedTemplateKey(opt);
                if (TRUST_TEMPLATES[opt.value]) {
                  setCustomTrustDoc(JSON.stringify(TRUST_TEMPLATES[opt.value].doc, null, 2));
                }
              }}
              options={Object.entries(TRUST_TEMPLATES).map(([key, val]) => ({
                label: val.label,
                value: key,
              }))}
            />
          </FormField>

          <FormField label="Trust Policy Document (JSON)">
            <Textarea
              rows={8}
              value={customTrustDoc}
              onChange={({ detail }) => setCustomTrustDoc(detail.value)}
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        visible={createGroupOpen}
        onDismiss={() => setCreateGroupOpen(false)}
        header="Create IAM User Group"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateGroupOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creatingGroup} onClick={handleCreateGroup}>
                Create Group
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <FormField label="Group Name">
          <Input
            value={newGroupName}
            onChange={({ detail }) => setNewGroupName(detail.value)}
            placeholder="Administrators"
          />
        </FormField>
      </Modal>
    </SpaceBetween>
  );
};
