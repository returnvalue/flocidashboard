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

interface FunctionItem {
  FunctionName: string;
  FunctionArn: string;
  Runtime: string;
  Handler: string;
  CodeSize?: number;
  Description?: string;
  Timeout?: number;
  MemorySize?: number;
  LastModified?: string;
}

export const LambdaConsole: React.FC = () => {
  const [functions, setFunctions] = useState<FunctionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<FunctionItem[]>([]);
  const [filterText, setFilterText] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [invokeModalOpen, setInvokeModalOpen] = useState(false);
  const [functionName, setFunctionName] = useState('');
  const [runtime, setRuntime] = useState('python3.12');
  const [invokePayload, setInvokePayload] = useState('{\n  "key": "value"\n}');
  const [invokeResponse, setInvokeResponse] = useState<string | null>(null);
  const [invoking, setInvoking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchServiceInventory('lambda');
      const list = (data.functions || data.Functions || []).map((f: any) => ({
        FunctionName: f.FunctionName || f.name || 'my-function',
        FunctionArn: f.FunctionArn || `arn:aws:lambda:us-east-1:000000000000:function:${f.FunctionName || 'my-function'}`,
        Runtime: f.Runtime || 'python3.12',
        Handler: f.Handler || 'index.handler',
        CodeSize: f.CodeSize ?? 512,
        Description: f.Description || 'Serverless compute function',
        Timeout: f.Timeout ?? 30,
        MemorySize: f.MemorySize ?? 128,
        LastModified: f.LastModified || new Date().toISOString().split('T')[0],
      }));
      setFunctions(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateFunction = async () => {
    if (!functionName.trim()) return;
    setCreating(true);
    try {
      await executeServiceAction('lambda', 'create_function', {
        FunctionName: functionName,
        Runtime: runtime,
        Handler: 'lambda_function.lambda_handler',
        Role: 'arn:aws:iam::000000000000:role/lambda-basic-execution',
      });
      setActionMessage({ type: 'success', text: `Function "${functionName}" created successfully.` });
      setCreateModalOpen(false);
      setFunctionName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create function' });
    } finally {
      setCreating(false);
    }
  };

  const handleInvoke = async () => {
    if (!selectedItems.length) return;
    setInvoking(true);
    try {
      const res = await executeServiceAction('lambda', 'invoke', {
        FunctionName: selectedItems[0].FunctionName,
        Payload: invokePayload,
      });
      setInvokeResponse(JSON.stringify(res, null, 2));
    } catch (err: any) {
      setInvokeResponse(`Error: ${err.message}`);
    } finally {
      setInvoking(false);
    }
  };

  const filteredFunctions = functions.filter((f) =>
    f.FunctionName.toLowerCase().includes(filterText.toLowerCase())
  );

  const activeFn = selectedItems[0];

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
            counter={`(${functions.length})`}
            description="Run serverless functions locally without provisioning servers."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <Button
                  disabled={!selectedItems.length}
                  iconName="caret-right-filled"
                  onClick={() => setInvokeModalOpen(true)}
                >
                  Test invoke
                </Button>
                <Button
                  variant="primary"
                  iconName="add-plus"
                  onClick={() => setCreateModalOpen(true)}
                >
                  Create function
                </Button>
              </SpaceBetween>
            }
          >
            Functions
          </Header>
        }
        columnDefinitions={[
          {
            id: 'name',
            header: 'Function name',
            cell: (item) => (
              <Button variant="inline-link" onClick={() => setSelectedItems([item])}>
                <strong>{item.FunctionName}</strong>
              </Button>
            ),
            sortingField: 'FunctionName',
            isRowHeader: true,
          },
          {
            id: 'runtime',
            header: 'Runtime',
            cell: (item) => <StatusIndicator type="info">{item.Runtime}</StatusIndicator>,
          },
          {
            id: 'handler',
            header: 'Handler',
            cell: (item) => item.Handler,
          },
          {
            id: 'memory',
            header: 'Memory',
            cell: (item) => `${item.MemorySize || 128} MB`,
          },
          {
            id: 'timeout',
            header: 'Timeout',
            cell: (item) => `${item.Timeout || 30}s`,
          },
        ]}
        items={filteredFunctions}
        loading={loading}
        loadingText="Loading Lambda functions..."
        selectionType="single"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Filter functions by name..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
        }
        pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
        empty={
          <Box textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No functions found</b>
              <p>You have not created any Lambda functions yet.</p>
              <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
                Create function
              </Button>
            </SpaceBetween>
          </Box>
        }
      />

      {activeFn && (
        <Container header={<Header variant="h2">Function: {activeFn.FunctionName}</Header>}>
          <Tabs
            tabs={[
              {
                label: 'Code & Execution',
                id: 'code',
                content: (
                  <SpaceBetween size="m">
                    <pre style={{ background: '#161e2e', color: '#9cdcfe', padding: '14px', borderRadius: '4px', margin: 0 }}>
                      {`import json

def lambda_handler(event, context):
    # Floci local serverless handler
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Hello from Floci Lambda!'})
    }`}
                    </pre>
                    <Button variant="primary" onClick={() => setInvokeModalOpen(true)}>
                      Test Execution
                    </Button>
                  </SpaceBetween>
                ),
              },
              {
                label: 'Configuration',
                id: 'config',
                content: (
                  <KeyValuePairs
                    columns={3}
                    items={[
                      { label: 'Function ARN', value: activeFn.FunctionArn },
                      { label: 'Runtime', value: activeFn.Runtime },
                      { label: 'Handler', value: activeFn.Handler },
                      { label: 'Memory (MB)', value: `${activeFn.MemorySize || 128} MB` },
                      { label: 'Timeout', value: `${activeFn.Timeout || 30} seconds` },
                      { label: 'Ephemeral storage', value: '512 MB' },
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
        header="Create Lambda function"
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateFunction} loading={creating}>
                Create function
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Function name" description="Enter a unique name for your Lambda function.">
            <Input
              value={functionName}
              onChange={({ detail }) => setFunctionName(detail.value)}
              placeholder="e.g. process-orders"
            />
          </FormField>
          <FormField label="Runtime">
            <Input value={runtime} onChange={({ detail }) => setRuntime(detail.value)} />
          </FormField>
        </SpaceBetween>
      </Modal>

      <Modal
        visible={invokeModalOpen}
        onDismiss={() => setInvokeModalOpen(false)}
        header={`Test invoke: ${activeFn?.FunctionName || 'function'}`}
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setInvokeModalOpen(false)}>
                Close
              </Button>
              <Button variant="primary" onClick={handleInvoke} loading={invoking}>
                Invoke
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Event JSON Payload">
            <textarea
              value={invokePayload}
              onChange={(e) => setInvokePayload(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                background: '#1b2a3a',
                color: '#fff',
                fontFamily: 'monospace',
                padding: '8px',
                borderRadius: '4px',
              }}
            />
          </FormField>
          {invokeResponse && (
            <FormField label="Execution Response">
              <pre style={{ background: '#0a1017', color: '#4ec9b0', padding: '10px', borderRadius: '4px', margin: 0 }}>
                {invokeResponse}
              </pre>
            </FormField>
          )}
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
