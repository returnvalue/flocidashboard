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
  createApiGatewayApi,
  deleteApiGatewayApi,
  testApiGatewayRequest,
} from '../api/client';
import { CodeSnippet } from '../components/CodeSnippet';

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
  const [selectedTabId, setSelectedTabId] = useState(activeTab || 'test');

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

  const activeApi = selectedApis[0];

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
    if (!activeApi) return;
    const apiId = activeApi.ApiId || activeApi.id;
    try {
      await deleteApiGatewayApi(apiId);
      setActionMessage({ type: 'success', text: `API "${activeApi.Name || activeApi.name}" deleted.` });
      setSelectedApis([]);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete API' });
    }
  };

  const handleSendTestRequest = async () => {
    if (!activeApi) return;
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

      const apiId = activeApi.ApiId || activeApi.id;
      const res = await testApiGatewayRequest(apiId, testPath, testMethod.value, parsedHeaders, parsedBody);
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
    ProtocolType: a.ProtocolType || a.protocol || 'HTTP',
    ApiEndpoint: a.ApiEndpoint || `http://localhost:4566/restapis/${a.ApiId || a.id}/`,
    CreatedDate: a.CreatedDate || a.created || new Date().toISOString().split('T')[0],
  }));

  const filteredApis = apisList.filter((a: any) =>
    `${a.Name} ${a.Id} ${a.ProtocolType}`.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <SpaceBetween size="l">
      {/* Header */}
      <Container
        header={
          <Header
            variant="h1"
            description="Create, publish, maintain, monitor, and secure REST and HTTP APIs at any scale."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <Button disabled={!activeApi} onClick={handleDeleteApi}>
                  Delete API
                </Button>
                <Button variant="primary" iconName="add-plus" onClick={() => setCreateApiOpen(true)}>
                  Create API
                </Button>
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
            <Box variant="awsui-key-label">Routing Protocols</Box>
            <Box variant="h2" color="text-status-info">
              <Badge color="blue">HTTP & REST</Badge>
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Gateway Engine</Box>
            <Box variant="h2" color="text-status-info">
              <StatusIndicator type="success">Gateway Active</StatusIndicator>
            </Box>
          </Box>
        </Grid>
      </Container>

      {/* APIs List */}
      <Container
        header={
          <Header
            variant="h2"
            description="APIs published in Floci."
          >
            APIs ({apisList.length})
          </Header>
        }
      >
        <SpaceBetween size="m">
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Find API by name, ID..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />

          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: 'API Name',
                cell: (item) => <strong>{item.Name}</strong>,
              },
              {
                id: 'id',
                header: 'API ID',
                cell: (item) => <code>{item.Id}</code>,
                width: 180,
              },
              {
                id: 'protocol',
                header: 'Protocol',
                cell: (item) => <Badge color={item.ProtocolType === 'HTTP' ? 'blue' : 'green'}>{item.ProtocolType}</Badge>,
                width: 120,
              },
              {
                id: 'endpoint',
                header: 'API Endpoint',
                cell: (item) => <code>{item.ApiEndpoint}</code>,
              },
            ]}
            items={filteredApis}
            selectionType="single"
            selectedItems={selectedApis}
            onSelectionChange={({ detail }) => setSelectedApis(detail.selectedItems)}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No APIs found</b>
                <p>Create an HTTP or REST API to route traffic to local Lambda functions and mocks.</p>
              </Box>
            }
          />
        </SpaceBetween>
      </Container>

      {/* Selected API Deepened Tabs */}
      {activeApi && (
        <Container
          header={
            <Header
              variant="h2"
              description={`API details for ${activeApi.Name || activeApi.name}`}
            >
              API: {activeApi.Name || activeApi.name}
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
                label: 'Test Request Runner',
                id: 'test',
                content: (
                  <Container
                    header={
                      <Header
                        variant="h3"
                        description="Dispatch live HTTP requests against your API Gateway routes and inspect response headers and payloads."
                      >
                        Request Simulator
                      </Header>
                    }
                  >
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

                        <FormField label="Route Path" description="Resource path, e.g. /items or /orders">
                          <Input
                            value={testPath}
                            onChange={({ detail }) => setTestPath(detail.value)}
                            placeholder="/items"
                          />
                        </FormField>
                      </Grid>

                      <FormField label="Request Headers (JSON)" description="Custom HTTP headers to send with the request.">
                        <Textarea
                          rows={3}
                          value={testHeaders}
                          onChange={({ detail }) => setTestHeaders(detail.value)}
                        />
                      </FormField>

                      {testMethod.value !== 'GET' && (
                        <FormField label="Request Payload (JSON)">
                          <Textarea
                            rows={4}
                            value={testBody}
                            onChange={({ detail }) => setTestBody(detail.value)}
                          />
                        </FormField>
                      )}

                      <SpaceBetween direction="horizontal" size="xs">
                        <Button variant="primary" iconName="caret-right-filled" loading={testingRequest} onClick={handleSendTestRequest}>
                          Send API Request
                        </Button>
                      </SpaceBetween>

                      {testLatency != null && (
                        <Badge color="green">Latency: {testLatency}ms</Badge>
                      )}

                      {testResponse && (
                        <Container header={<Header variant="h3">Response</Header>}>
                          <CodeSnippet language="json" code={JSON.stringify(testResponse, null, 2)} />
                        </Container>
                      )}
                    </SpaceBetween>
                  </Container>
                ),
              },
              {
                label: 'Overview & Endpoints',
                id: 'overview',
                content: (
                  <KeyValuePairs
                    columns={3}
                    items={[
                      { label: 'API ID', value: activeApi.ApiId || activeApi.id },
                      { label: 'API Name', value: activeApi.Name || activeApi.name },
                      { label: 'Protocol', value: activeApi.ProtocolType || 'HTTP' },
                      { label: 'Base URL', value: activeApi.ApiEndpoint || `http://localhost:4566/restapis/${activeApi.ApiId || activeApi.id}/` },
                      { label: 'Authorization', value: 'AWS_IAM & Open / None' },
                      { label: 'CORS', value: 'Configured' },
                    ]}
                  />
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
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateApiOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creatingApi} onClick={handleCreateApi}>
                Create API
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="API Name" description="Unique API identifier.">
            <Input
              value={apiName}
              onChange={({ detail }) => setApiName(detail.value)}
              placeholder="OrderProcessingApi"
            />
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
            <Input
              value={apiDescription}
              onChange={({ detail }) => setApiDescription(detail.value)}
              placeholder="Production Microservice Gateway"
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
