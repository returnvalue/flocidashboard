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
import Grid from '@cloudscape-design/components/grid';
import Box from '@cloudscape-design/components/box';
import Badge from '@cloudscape-design/components/badge';
import Alert from '@cloudscape-design/components/alert';
import {
  fetchServiceInventory,
  createApiGatewayApi,
  deleteApiGatewayApi,
  testApiGatewayRequest,
  fetchApiGatewayResources,
  createApiGatewayResource,
  createApiGatewayMethod,
  deleteApiGatewayResource,
  fetchApiGatewayStages,
  createApiGatewayStage,
  createApiGatewayDeployment,
  fetchApiGatewayAuthorizers,
  createApiGatewayAuthorizer,
} from '../api/client';

interface ApiGatewayConsoleProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export const ApiGatewayConsole: React.FC<ApiGatewayConsoleProps> = ({ activeTab, onTabChange }) => {
  const [data, setData] = useState<any>({ apis: [] });
  const [loading, setLoading] = useState(true);
  const [selectedApis, setSelectedApis] = useState<any[]>([]);
  const [filterText, setFilterText] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedTabId, setSelectedTabId] = useState(activeTab || 'resources');

  useEffect(() => {
    if (activeTab) {
      setSelectedTabId(activeTab);
    }
  }, [activeTab]);

  // Create API Modal
  const [createApiOpen, setCreateApiOpen] = useState(false);
  const [apiName, setApiName] = useState('');
  const [protocolType, setProtocolType] = useState({ label: 'HTTP API (Fast, low-latency)', value: 'HTTP' });
  const [apiDescription, setApiDescription] = useState('Production Microservice Gateway');
  const [creatingApi, setCreatingApi] = useState(false);

  // Resources State
  const [resources, setResources] = useState<any[]>([]);
  const [createResourceOpen, setCreateResourceOpen] = useState(false);
  const [resourcePathPart, setResourcePathPart] = useState('');
  const [parentResourceId, setParentResourceId] = useState('');
  const [creatingResource, setCreatingResource] = useState(false);

  // Method Modal State
  const [createMethodOpen, setCreateMethodOpen] = useState(false);
  const [methodHttpMethod, setMethodHttpMethod] = useState({ label: 'GET', value: 'GET' });
  const [methodAuthType, setMethodAuthType] = useState({ label: 'NONE', value: 'NONE' });
  const [targetResourceId, setTargetResourceId] = useState('');
  const [creatingMethod, setCreatingMethod] = useState(false);

  // Stages & Deployments State
  const [stages, setStages] = useState<any[]>([]);
  const [createStageOpen, setCreateStageOpen] = useState(false);
  const [stageName, setStageName] = useState('');
  const [deploymentDesc, setDeploymentDesc] = useState('Initial production deployment');
  const [creatingStage, setCreatingStage] = useState(false);

  // Authorizers State
  const [authorizers, setAuthorizers] = useState<any[]>([]);
  const [createAuthOpen, setCreateAuthOpen] = useState(false);
  const [authName, setAuthName] = useState('');
  const [authType, setAuthType] = useState({ label: 'COGNITO_USER_POOLS', value: 'COGNITO_USER_POOLS' });
  const [authUri, setAuthUri] = useState('');
  const [creatingAuth, setCreatingAuth] = useState(false);

  // Test Request Runner State
  const [testPath, setTestPath] = useState('/items');
  const [testMethod, setTestMethod] = useState({ label: 'GET', value: 'GET' });
  const [testHeaders, setTestHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
  const [testBody, setTestBody] = useState('{\n  "name": "Widget"\n}');
  const [testResponse, setTestResponse] = useState<any | null>(null);
  const [testingRequest, setTestingRequest] = useState(false);
  const [testLatency, setTestLatency] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchServiceInventory('apigateway');
      const items = res.apis || res.items || [];
      setData({ apis: items });
      if (items.length > 0 && selectedApis.length === 0) {
        setSelectedApis([items[0]]);
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

  const activeApi = selectedApis[0] || null;
  const activeApiId = activeApi ? activeApi.ApiId || activeApi.id : '';

  const loadApiSubresources = async (apiId: string) => {
    if (!apiId) return;
    try {
      const [resList, stageList, authList]: any[] = await Promise.all([
        fetchApiGatewayResources(apiId),
        fetchApiGatewayStages(apiId),
        fetchApiGatewayAuthorizers(apiId),
      ]);
      const rItems = resList?.items || resList?.resources || [];
      setResources(rItems);
      if (rItems.length > 0 && !parentResourceId) {
        setParentResourceId(rItems[0].id || '');
      }
      setStages(stageList?.item || stageList?.stages || []);
      setAuthorizers(authList?.items || authList?.authorizers || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeApiId) {
      loadApiSubresources(activeApiId);
    }
  }, [activeApiId]);

  const handleCreateApi = async () => {
    if (!apiName.trim()) return;
    setCreatingApi(true);
    setActionMessage(null);
    try {
      await createApiGatewayApi(apiName.trim(), protocolType.value, apiDescription.trim());
      setActionMessage({ type: 'success', text: `API "${apiName.trim()}" created successfully.` });
      setCreateApiOpen(false);
      setApiName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create API' });
    } finally {
      setCreatingApi(false);
    }
  };

  const handleDeleteApi = async () => {
    if (!activeApiId) return;
    try {
      await deleteApiGatewayApi(activeApiId);
      setActionMessage({ type: 'success', text: `API "${activeApi.Name || activeApi.name}" deleted.` });
      setSelectedApis([]);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete API' });
    }
  };

  const handleCreateResource = async () => {
    if (!activeApiId || !resourcePathPart.trim()) return;
    setCreatingResource(true);
    try {
      const pId = parentResourceId || (resources[0]?.id ?? '');
      await createApiGatewayResource(activeApiId, pId, resourcePathPart.trim());
      setActionMessage({ type: 'success', text: `Resource "/${resourcePathPart.trim()}" created.` });
      setCreateResourceOpen(false);
      setResourcePathPart('');
      await loadApiSubresources(activeApiId);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create resource' });
    } finally {
      setCreatingResource(false);
    }
  };

  const handleCreateMethod = async () => {
    if (!activeApiId || !targetResourceId) return;
    setCreatingMethod(true);
    try {
      await createApiGatewayMethod(activeApiId, targetResourceId, methodHttpMethod.value, methodAuthType.value);
      setActionMessage({ type: 'success', text: `Method ${methodHttpMethod.value} added to resource.` });
      setCreateMethodOpen(false);
      await loadApiSubresources(activeApiId);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create method' });
    } finally {
      setCreatingMethod(false);
    }
  };

  const handleDeleteResource = async (resId: string) => {
    if (!activeApiId || !resId) return;
    try {
      await deleteApiGatewayResource(activeApiId, resId);
      setActionMessage({ type: 'success', text: 'Resource deleted.' });
      await loadApiSubresources(activeApiId);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete resource' });
    }
  };

  const handleCreateStage = async () => {
    if (!activeApiId || !stageName.trim()) return;
    setCreatingStage(true);
    try {
      const dep = await createApiGatewayDeployment(activeApiId, stageName.trim(), deploymentDesc.trim());
      const depId = dep.id || dep.deploymentId || 'd-default';
      await createApiGatewayStage(activeApiId, stageName.trim(), depId, deploymentDesc.trim());
      setActionMessage({ type: 'success', text: `Stage "${stageName.trim()}" created and deployed.` });
      setCreateStageOpen(false);
      setStageName('');
      await loadApiSubresources(activeApiId);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create stage' });
    } finally {
      setCreatingStage(false);
    }
  };

  const handleCreateAuthorizer = async () => {
    if (!activeApiId || !authName.trim()) return;
    setCreatingAuth(true);
    try {
      const isCognito = authType.value === 'COGNITO_USER_POOLS';
      await createApiGatewayAuthorizer(
        activeApiId,
        authName.trim(),
        authType.value as any,
        isCognito && authUri.trim() ? [authUri.trim()] : undefined,
        !isCognito && authUri.trim() ? authUri.trim() : undefined
      );
      setActionMessage({ type: 'success', text: `Authorizer "${authName.trim()}" created.` });
      setCreateAuthOpen(false);
      setAuthName('');
      setAuthUri('');
      await loadApiSubresources(activeApiId);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create authorizer' });
    } finally {
      setCreatingAuth(false);
    }
  };

  const handleSendTestRequest = async () => {
    if (!activeApiId) return;
    setTestingRequest(true);
    setTestResponse(null);
    const start = performance.now();
    try {
      let parsedHeaders = {};
      try {
        parsedHeaders = JSON.parse(testHeaders);
      } catch (e) {}

      let parsedBody = null;
      if (testMethod.value !== 'GET' && testBody.trim()) {
        try {
          parsedBody = JSON.parse(testBody);
        } catch (e) {
          parsedBody = testBody;
        }
      }

      const res = await testApiGatewayRequest(activeApiId, testPath, testMethod.value, parsedHeaders, parsedBody);
      setTestLatency(Math.round(performance.now() - start));
      setTestResponse(res);
      setActionMessage({ type: 'success', text: 'API Gateway request dispatched and response received.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Test request failed' });
    } finally {
      setTestingRequest(false);
    }
  };

  const apisList = (data.apis || []).map((a: any) => ({
    ...a,
    Id: a.ApiId || a.id,
    Name: a.Name || a.name,
    ProtocolType: a.ProtocolType || a.protocolType || 'HTTP',
    ApiEndpoint: a.ApiEndpoint || a.apiEndpoint || `http://localhost:4566/restapis/${a.ApiId || a.id}/`,
  }));

  const filteredApis = apisList.filter((a: any) =>
    (a.Name || '').toLowerCase().includes(filterText.toLowerCase()) ||
    (a.Id || '').toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <SpaceBetween size="l">
      {/* Header Container */}
      <Container
        header={
          <Header
            variant="h1"
            description="Create, publish, maintain, monitor, and secure REST and HTTP APIs at any scale."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>Refresh</Button>
                <Button disabled={!activeApi} onClick={handleDeleteApi}>Delete API</Button>
                <Button variant="primary" iconName="add-plus" onClick={() => setCreateApiOpen(true)}>Create API</Button>
              </SpaceBetween>
            }
          >
            Amazon API Gateway
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
            <Box variant="awsui-key-label">Active APIs</Box>
            <Box variant="h1" color="text-status-info">
              {apisList.length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Total Stages</Box>
            <Box variant="h1" color="text-status-info">
              {stages.length || 1}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Gateway Engine</Box>
            <Box variant="h2" color="text-status-info">
              <StatusIndicator type="success">HTTP / REST Ready</StatusIndicator>
            </Box>
          </Box>
        </Grid>
      </Container>

      {/* APIs Table */}
      <Container
        header={
          <Header variant="h2" description="API Gateway definitions running in Floci.">
            APIs ({apisList.length})
          </Header>
        }
      >
        <SpaceBetween size="m">
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Find API by name or ID..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />

          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: 'API Name',
                cell: (item) => (
                  <Button variant="inline-link" onClick={() => setSelectedApis([item])}>
                    <strong>{item.Name}</strong>
                  </Button>
                ),
              },
              {
                id: 'id',
                header: 'API ID',
                cell: (item) => <code>{item.Id}</code>,
                width: 220,
              },
              {
                id: 'protocol',
                header: 'Protocol',
                cell: (item) => <Badge color={item.ProtocolType === 'HTTP' ? 'blue' : 'green'}>{item.ProtocolType}</Badge>,
                width: 120,
              },
            ]}
            items={filteredApis}
            selectionType="single"
            selectedItems={selectedApis}
            onSelectionChange={({ detail }) => setSelectedApis(detail.selectedItems)}
            empty={<Box textAlign="center">No APIs found.</Box>}
          />
        </SpaceBetween>
      </Container>

      {/* Active API Details */}
      {activeApi && (
        <Container header={<Header variant="h2">API: {activeApi.Name || activeApi.name}</Header>}>
          <Tabs
            activeTabId={selectedTabId}
            onChange={({ detail }) => {
              setSelectedTabId(detail.activeTabId);
              onTabChange?.(detail.activeTabId);
            }}
            tabs={[
              {
                label: `Resources & Methods (${resources.length})`,
                id: 'resources',
                content: (
                  <SpaceBetween size="m">
                    <Box float="right">
                      <Button variant="primary" iconName="add-plus" onClick={() => setCreateResourceOpen(true)}>
                        Create Resource
                      </Button>
                    </Box>

                    <Table
                      columnDefinitions={[
                        { id: 'path', header: 'Resource Path', cell: (r: any) => <strong>{r.path || `/${r.pathPart || ''}`}</strong> },
                        { id: 'id', header: 'Resource ID', cell: (r: any) => <code>{r.id}</code> },
                        {
                          id: 'methods',
                          header: 'HTTP Methods',
                          cell: (r: any) => {
                            const mKeys = Object.keys(r.resourceMethods || {});
                            return mKeys.length > 0 ? (
                              <SpaceBetween direction="horizontal" size="xs">
                                {mKeys.map((m) => (
                                  <Badge key={m} color="blue">{m}</Badge>
                                ))}
                              </SpaceBetween>
                            ) : (
                              <span style={{ color: '#879596' }}>None</span>
                            );
                          },
                        },
                        {
                          id: 'act',
                          header: 'Actions',
                          cell: (r: any) => (
                            <SpaceBetween direction="horizontal" size="xs">
                              <Button
                                onClick={() => {
                                  setTargetResourceId(r.id);
                                  setCreateMethodOpen(true);
                                }}
                              >
                                Add Method
                              </Button>
                              <Button iconName="remove" onClick={() => handleDeleteResource(r.id)}>Delete</Button>
                            </SpaceBetween>
                          ),
                          width: 230,
                        },
                      ]}
                      items={resources}
                      empty={<Box textAlign="center">No resources configured.</Box>}
                    />
                  </SpaceBetween>
                ),
              },
              {
                label: `Stages (${stages.length})`,
                id: 'stages',
                content: (
                  <SpaceBetween size="m">
                    <Box float="right">
                      <Button variant="primary" iconName="add-plus" onClick={() => setCreateStageOpen(true)}>
                        Create & Deploy Stage
                      </Button>
                    </Box>

                    <Table
                      columnDefinitions={[
                        { id: 'name', header: 'Stage Name', cell: (s: any) => <strong>{s.stageName || s.name || 'prod'}</strong> },
                        { id: 'dep', header: 'Deployment ID', cell: (s: any) => <code>{s.deploymentId || 'd-12345'}</code> },
                        { id: 'desc', header: 'Description', cell: (s: any) => s.description || '—' },
                      ]}
                      items={stages.length > 0 ? stages : [{ stageName: 'prod', deploymentId: 'd-live', description: 'Default deployed stage' }]}
                    />
                  </SpaceBetween>
                ),
              },
              {
                label: `Authorizers (${authorizers.length})`,
                id: 'authorizers',
                content: (
                  <SpaceBetween size="m">
                    <Box float="right">
                      <Button variant="primary" iconName="add-plus" onClick={() => setCreateAuthOpen(true)}>
                        Create Authorizer
                      </Button>
                    </Box>

                    <Table
                      columnDefinitions={[
                        { id: 'name', header: 'Authorizer Name', cell: (a: any) => <strong>{a.name || a.Name}</strong> },
                        { id: 'type', header: 'Type', cell: (a: any) => <Badge color="blue">{a.type || a.Type || 'COGNITO_USER_POOLS'}</Badge> },
                        { id: 'id', header: 'Authorizer ID', cell: (a: any) => <code>{a.id || a.Id}</code> },
                      ]}
                      items={authorizers}
                      empty={<Box textAlign="center">No authorizers attached to this API.</Box>}
                    />
                  </SpaceBetween>
                ),
              },
              {
                label: 'Test Request Runner',
                id: 'test',
                content: (
                  <SpaceBetween size="m">
                    <Grid gridDefinition={[{ colspan: { default: 12, m: 3 } }, { colspan: { default: 12, m: 9 } }]}>
                      <FormField label="Method">
                        <Select
                          selectedOption={testMethod}
                          onChange={({ detail }) => setTestMethod(detail.selectedOption as any)}
                          options={[
                            { label: 'GET', value: 'GET' },
                            { label: 'POST', value: 'POST' },
                            { label: 'PUT', value: 'PUT' },
                            { label: 'DELETE', value: 'DELETE' },
                            { label: 'PATCH', value: 'PATCH' },
                          ]}
                        />
                      </FormField>

                      <FormField label="Route Path">
                        <Input value={testPath} onChange={({ detail }) => setTestPath(detail.value)} placeholder="/items" />
                      </FormField>
                    </Grid>

                    <FormField label="Request Headers (JSON)">
                      <Textarea rows={3} value={testHeaders} onChange={({ detail }) => setTestHeaders(detail.value)} />
                    </FormField>

                    {testMethod.value !== 'GET' && (
                      <FormField label="Request Payload (JSON)">
                        <Textarea rows={4} value={testBody} onChange={({ detail }) => setTestBody(detail.value)} />
                      </FormField>
                    )}

                    <Button variant="primary" iconName="caret-right-filled" loading={testingRequest} onClick={handleSendTestRequest}>
                      Send API Request
                    </Button>

                    {testLatency !== null && <Badge color="green">Latency: {testLatency}ms</Badge>}

                    {testResponse && (
                      <Container header={<Header variant="h3">Response</Header>}>
                        <Textarea rows={8} value={JSON.stringify(testResponse, null, 2)} readOnly />
                      </Container>
                    )}
                  </SpaceBetween>
                ),
              },
            ]}
          />
        </Container>
      )}

      {/* Create API Modal */}
      <Modal
        visible={createApiOpen}
        onDismiss={() => setCreateApiOpen(false)}
        header="Create API"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateApiOpen(false)}>Cancel</Button>
              <Button variant="primary" loading={creatingApi} onClick={handleCreateApi}>Create API</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="API Name">
            <Input value={apiName} onChange={({ detail }) => setApiName(detail.value)} placeholder="OrderProcessingApi" />
          </FormField>

          <FormField label="Protocol Type">
            <Select
              selectedOption={protocolType}
              onChange={({ detail }) => setProtocolType(detail.selectedOption as any)}
              options={[
                { label: 'HTTP API (Fast, low-latency)', value: 'HTTP' },
                { label: 'REST API (Full-featured REST gateway)', value: 'REST' },
              ]}
            />
          </FormField>

          <FormField label="Description">
            <Input value={apiDescription} onChange={({ detail }) => setApiDescription(detail.value)} placeholder="Production Microservice Gateway" />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Create Resource Modal */}
      <Modal
        visible={createResourceOpen}
        onDismiss={() => setCreateResourceOpen(false)}
        header="Create Resource"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateResourceOpen(false)}>Cancel</Button>
              <Button variant="primary" loading={creatingResource} onClick={handleCreateResource}>Create Resource</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Resource Path Part" description="e.g. items or {id}">
            <Input value={resourcePathPart} onChange={({ detail }) => setResourcePathPart(detail.value)} placeholder="items" />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Create Method Modal */}
      <Modal
        visible={createMethodOpen}
        onDismiss={() => setCreateMethodOpen(false)}
        header="Create HTTP Method"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateMethodOpen(false)}>Cancel</Button>
              <Button variant="primary" loading={creatingMethod} onClick={handleCreateMethod}>Create Method</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="HTTP Method">
            <Select
              selectedOption={methodHttpMethod}
              onChange={({ detail }) => setMethodHttpMethod(detail.selectedOption as any)}
              options={[
                { label: 'GET', value: 'GET' },
                { label: 'POST', value: 'POST' },
                { label: 'PUT', value: 'PUT' },
                { label: 'DELETE', value: 'DELETE' },
                { label: 'ANY', value: 'ANY' },
              ]}
            />
          </FormField>
          <FormField label="Authorization">
            <Select
              selectedOption={methodAuthType}
              onChange={({ detail }) => setMethodAuthType(detail.selectedOption as any)}
              options={[
                { label: 'NONE (Public)', value: 'NONE' },
                { label: 'AWS_IAM', value: 'AWS_IAM' },
                { label: 'COGNITO_USER_POOLS', value: 'COGNITO_USER_POOLS' },
              ]}
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Create Stage Modal */}
      <Modal
        visible={createStageOpen}
        onDismiss={() => setCreateStageOpen(false)}
        header="Create & Deploy Stage"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateStageOpen(false)}>Cancel</Button>
              <Button variant="primary" loading={creatingStage} onClick={handleCreateStage}>Deploy Stage</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Stage Name">
            <Input value={stageName} onChange={({ detail }) => setStageName(detail.value)} placeholder="v1 or staging" />
          </FormField>
          <FormField label="Deployment Description">
            <Input value={deploymentDesc} onChange={({ detail }) => setDeploymentDesc(detail.value)} placeholder="Release notes..." />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Create Authorizer Modal */}
      <Modal
        visible={createAuthOpen}
        onDismiss={() => setCreateAuthOpen(false)}
        header="Create Authorizer"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateAuthOpen(false)}>Cancel</Button>
              <Button variant="primary" loading={creatingAuth} onClick={handleCreateAuthorizer}>Create Authorizer</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Authorizer Name">
            <Input value={authName} onChange={({ detail }) => setAuthName(detail.value)} placeholder="CognitoAuth" />
          </FormField>
          <FormField label="Type">
            <Select
              selectedOption={authType}
              onChange={({ detail }) => setAuthType(detail.selectedOption as any)}
              options={[
                { label: 'COGNITO_USER_POOLS', value: 'COGNITO_USER_POOLS' },
                { label: 'TOKEN (Lambda Authorizer)', value: 'TOKEN' },
                { label: 'REQUEST (Lambda Request Authorizer)', value: 'REQUEST' },
              ]}
            />
          </FormField>
          <FormField label="Provider ARN / Lambda URI">
            <Input value={authUri} onChange={({ detail }) => setAuthUri(detail.value)} placeholder="arn:aws:cognito-idp:..." />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
