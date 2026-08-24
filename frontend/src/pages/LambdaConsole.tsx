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
import Link from '@cloudscape-design/components/link';
import {
  fetchServiceInventory,
  executeServiceAction,
  fetchLambdaFunctionUrl,
  createLambdaFunctionUrl,
  deleteLambdaFunctionUrl,
  fetchLambdaEventSourceMappings,
  createLambdaEventSourceMapping,
  deleteLambdaEventSourceMapping,
  fetchLambdaVersions,
  publishLambdaVersion,
} from '../api/client';
import { CodeSnippet } from '../components/CodeSnippet';

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
  const [selectedFunctions, setSelectedFunctions] = useState<FunctionItem[]>([]);
  const [filterText, setFilterText] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create Function Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [functionName, setFunctionName] = useState('');
  const [runtime, setRuntime] = useState({ label: 'Python 3.12', value: 'python3.12' });
  const [handler, setHandler] = useState('lambda_function.lambda_handler');
  const [creating, setCreating] = useState(false);

  // Test Invocation Modal
  const [invokeModalOpen, setInvokeModalOpen] = useState(false);
  const [invokePayload, setInvokePayload] = useState('{\n  "key1": "value1",\n  "key2": "value2"\n}');
  const [invokeResponse, setInvokeResponse] = useState<string | null>(null);
  const [invoking, setInvoking] = useState(false);

  // Function URL State
  const [functionUrlConfig, setFunctionUrlConfig] = useState<any | null>(null);
  const [urlAuthType, setUrlAuthType] = useState({ label: 'NONE (Public Unauthenticated)', value: 'NONE' });
  const [savingUrl, setSavingUrl] = useState(false);

  // Event Source Mappings (Triggers) State
  const [triggers, setTriggers] = useState<any[]>([]);
  const [addTriggerOpen, setAddTriggerOpen] = useState(false);
  const [triggerSourceArn, setTriggerSourceArn] = useState('arn:aws:sqs:us-east-1:000000000000:my-queue');
  const [triggerBatchSize, setTriggerBatchSize] = useState('10');
  const [savingTrigger, setSavingTrigger] = useState(false);

  // Versions State
  const [versions, setVersions] = useState<any[]>([]);
  const [publishVersionOpen, setPublishVersionOpen] = useState(false);
  const [versionDescription, setVersionDescription] = useState('');
  const [publishingVersion, setPublishingVersion] = useState(false);

  const loadFunctions = async () => {
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
      if (list.length > 0 && selectedFunctions.length === 0) {
        setSelectedFunctions([list[0]]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFunctions();
  }, []);

  const activeFunction = selectedFunctions[0];

  const loadFunctionDetails = async (fn: FunctionItem) => {
    try {
      const [urlRes, triggersRes, versionsRes] = await Promise.all([
        fetchLambdaFunctionUrl(fn.FunctionName),
        fetchLambdaEventSourceMappings(fn.FunctionName),
        fetchLambdaVersions(fn.FunctionName),
      ]);
      setFunctionUrlConfig(urlRes);
      setTriggers(triggersRes || []);
      setVersions(versionsRes || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeFunction) {
      loadFunctionDetails(activeFunction);
      setInvokeResponse(null);
    } else {
      setFunctionUrlConfig(null);
      setTriggers([]);
      setVersions([]);
    }
  }, [activeFunction?.FunctionName]);

  const handleCreateFunction = async () => {
    if (!functionName.trim()) return;
    setCreating(true);
    setActionMessage(null);
    try {
      await executeServiceAction('lambda', 'create_function', {
        FunctionName: functionName.trim(),
        Runtime: runtime.value,
        Handler: handler.trim(),
        Role: 'arn:aws:iam::000000000000:role/lambda-basic-execution',
      });
      setActionMessage({ type: 'success', text: `Function "${functionName.trim()}" created successfully.` });
      setCreateModalOpen(false);
      setFunctionName('');
      await loadFunctions();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create function' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteFunction = async () => {
    if (!activeFunction) return;
    try {
      await executeServiceAction('lambda', 'delete_function', { FunctionName: activeFunction.FunctionName });
      setActionMessage({ type: 'success', text: `Function "${activeFunction.FunctionName}" deleted.` });
      setSelectedFunctions([]);
      await loadFunctions();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete function' });
    }
  };

  const handleInvoke = async () => {
    if (!activeFunction) return;
    setInvoking(true);
    try {
      const res = await executeServiceAction('lambda', 'invoke', {
        FunctionName: activeFunction.FunctionName,
        Payload: invokePayload,
      });
      setInvokeResponse(JSON.stringify(res, null, 2));
    } catch (err: any) {
      setInvokeResponse(JSON.stringify({ error: err.message || 'Invocation failed' }, null, 2));
    } finally {
      setInvoking(false);
    }
  };

  const handleToggleFunctionUrl = async (enable: boolean) => {
    if (!activeFunction) return;
    setSavingUrl(true);
    try {
      if (enable) {
        await createLambdaFunctionUrl(activeFunction.FunctionName, urlAuthType.value as any);
        setActionMessage({ type: 'success', text: 'Lambda Function URL created.' });
      } else {
        await deleteLambdaFunctionUrl(activeFunction.FunctionName);
        setActionMessage({ type: 'success', text: 'Lambda Function URL deleted.' });
      }
      await loadFunctionDetails(activeFunction);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to update Function URL' });
    } finally {
      setSavingUrl(false);
    }
  };

  const handleAddTrigger = async () => {
    if (!activeFunction || !triggerSourceArn.trim()) return;
    setSavingTrigger(true);
    try {
      await createLambdaEventSourceMapping(
        activeFunction.FunctionName,
        triggerSourceArn.trim(),
        Number(triggerBatchSize) || 10
      );
      setActionMessage({ type: 'success', text: 'Trigger added successfully.' });
      setAddTriggerOpen(false);
      await loadFunctionDetails(activeFunction);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to add trigger' });
    } finally {
      setSavingTrigger(false);
    }
  };

  const handleDeleteTrigger = async (uuid: string) => {
    if (!activeFunction) return;
    try {
      await deleteLambdaEventSourceMapping(uuid);
      setActionMessage({ type: 'success', text: 'Trigger removed.' });
      await loadFunctionDetails(activeFunction);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete trigger' });
    }
  };

  const handlePublishVersion = async () => {
    if (!activeFunction) return;
    setPublishingVersion(true);
    try {
      await publishLambdaVersion(activeFunction.FunctionName, versionDescription.trim());
      setActionMessage({ type: 'success', text: 'New Lambda version published.' });
      setPublishVersionOpen(false);
      setVersionDescription('');
      await loadFunctionDetails(activeFunction);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to publish version' });
    } finally {
      setPublishingVersion(false);
    }
  };

  const filteredFunctions = functions.filter((f) =>
    f.FunctionName.toLowerCase().includes(filterText.toLowerCase())
  );

  const functionUrlEndpoint = functionUrlConfig?.FunctionUrl || (activeFunction ? `http://localhost:4566/2021-10-31/functions/${activeFunction.FunctionName}/invocations` : '');

  return (
    <SpaceBetween size="l">
      {/* Header */}
      <Container
        header={
          <Header
            variant="h1"
            description="Run code without thinking about servers or clusters. Scales automatically with demand."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadFunctions} loading={loading}>
                  Refresh
                </Button>
                <Button disabled={!activeFunction} onClick={handleDeleteFunction}>
                  Delete Function
                </Button>
                <Button variant="primary" iconName="add-plus" onClick={() => setCreateModalOpen(true)}>
                  Create Function
                </Button>
              </SpaceBetween>
            }
          >
            AWS Lambda
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
            <Box variant="awsui-key-label">Functions</Box>
            <Box variant="h1" color="text-status-info">
              {functions.length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Serverless Runtime</Box>
            <Box variant="h2" color="text-status-info">
              <Badge color="blue">Local Docker & MicroVM</Badge>
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Engine Health</Box>
            <Box variant="h2" color="text-status-info">
              <StatusIndicator type="success">Lambda Ready</StatusIndicator>
            </Box>
          </Box>
        </Grid>
      </Container>

      {/* Functions Table */}
      <Container
        header={
          <Header
            variant="h2"
            description="Functions deployed in your local serverless environment."
          >
            Functions ({functions.length})
          </Header>
        }
      >
        <SpaceBetween size="m">
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Find functions by name..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />

          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: 'Function Name',
                cell: (item) => <strong>{item.FunctionName}</strong>,
              },
              {
                id: 'runtime',
                header: 'Runtime',
                cell: (item) => <Badge color="blue">{item.Runtime}</Badge>,
                width: 140,
              },
              {
                id: 'handler',
                header: 'Handler',
                cell: (item) => <code>{item.Handler}</code>,
                width: 240,
              },
              {
                id: 'memory',
                header: 'Memory',
                cell: (item) => `${item.MemorySize} MB`,
                width: 120,
              },
            ]}
            items={filteredFunctions}
            selectionType="single"
            selectedItems={selectedFunctions}
            onSelectionChange={({ detail }) => setSelectedFunctions(detail.selectedItems)}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No Lambda functions found</b>
                <p>Create a serverless function to execute Python, Node.js, or Java code.</p>
              </Box>
            }
          />
        </SpaceBetween>
      </Container>

      {/* Deepened Function Inspector */}
      {activeFunction && (
        <Container
          header={
            <Header
              variant="h2"
              description={`Inspecting ${activeFunction.FunctionName}`}
              actions={
                <Button variant="primary" iconName="caret-right-filled" onClick={() => setInvokeModalOpen(true)}>
                  Test / Invoke
                </Button>
              }
            >
              Function: {activeFunction.FunctionName}
            </Header>
          }
        >
          <Tabs
            tabs={[
              {
                label: 'Code Preview',
                id: 'code',
                content: (
                  <SpaceBetween size="m">
                    <CodeSnippet
                      language="boto3"
                      code={`# Handler for ${activeFunction.FunctionName}
import json

def lambda_handler(event, context):
    print("Received event:", json.dumps(event))
    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Hello from Floci Lambda!",
            "function": "${activeFunction.FunctionName}",
            "input": event
        })
    }
`}
                    />
                  </SpaceBetween>
                ),
              },
              {
                label: 'Function URL (Public HTTP Endpoint)',
                id: 'url',
                content: (
                  <Container
                    header={
                      <Header
                        variant="h3"
                        description="Dedicated HTTP(S) endpoint for your function without requiring API Gateway."
                        actions={
                          functionUrlConfig ? (
                            <Button loading={savingUrl} onClick={() => handleToggleFunctionUrl(false)}>
                              Delete Function URL
                            </Button>
                          ) : (
                            <Button variant="primary" loading={savingUrl} onClick={() => handleToggleFunctionUrl(true)}>
                              Create Function URL
                            </Button>
                          )
                        }
                      >
                        Function URL Configuration
                      </Header>
                    }
                  >
                    <SpaceBetween size="m">
                      <Box>
                        Status:{' '}
                        {functionUrlConfig ? (
                          <StatusIndicator type="success">Active</StatusIndicator>
                        ) : (
                          <StatusIndicator type="stopped">Not Configured</StatusIndicator>
                        )}
                      </Box>

                      {functionUrlConfig ? (
                        <Alert type="info">
                          Function URL:{' '}
                          <Link href={functionUrlEndpoint} external>
                            {functionUrlEndpoint}
                          </Link>
                        </Alert>
                      ) : (
                        <FormField label="Authentication Type">
                          <Select
                            selectedOption={urlAuthType}
                            onChange={({ detail }) => setUrlAuthType(detail.selectedOption as any)}
                            options={[
                              { label: 'NONE (Public Unauthenticated)', value: 'NONE' },
                              { label: 'AWS_IAM (Caller must sign request with SigV4)', value: 'AWS_IAM' },
                            ]}
                          />
                        </FormField>
                      )}
                    </SpaceBetween>
                  </Container>
                ),
              },
              {
                label: `Triggers & Mappings (${triggers.length})`,
                id: 'triggers',
                content: (
                  <Container
                    header={
                      <Header
                        variant="h3"
                        description="Event source mappings that automatically poll resources (SQS, DynamoDB Streams, Kinesis) and invoke this function."
                        actions={
                          <Button variant="primary" iconName="add-plus" onClick={() => setAddTriggerOpen(true)}>
                            Add Trigger
                          </Button>
                        }
                      >
                        Event Source Mappings
                      </Header>
                    }
                  >
                    <Table
                      columnDefinitions={[
                        { id: 'source', header: 'Event Source ARN', cell: (i: any) => <code>{i.EventSourceArn || i.eventSourceArn}</code> },
                        { id: 'status', header: 'State', cell: () => <StatusIndicator type="success">Enabled</StatusIndicator>, width: 120 },
                        { id: 'batch', header: 'Batch Size', cell: (i: any) => i.BatchSize || 10, width: 120 },
                        {
                          id: 'action',
                          header: 'Action',
                          cell: (i: any) => (
                            <Button onClick={() => handleDeleteTrigger(i.UUID || i.uuid)}>
                              Delete
                            </Button>
                          ),
                          width: 100,
                        },
                      ]}
                      items={triggers}
                      empty={<Box textAlign="center">No event source triggers attached to this function.</Box>}
                    />
                  </Container>
                ),
              },
              {
                label: `Versions (${versions.length})`,
                id: 'versions',
                content: (
                  <Container
                    header={
                      <Header
                        variant="h3"
                        actions={
                          <Button variant="primary" iconName="add-plus" onClick={() => setPublishVersionOpen(true)}>
                            Publish New Version
                          </Button>
                        }
                      >
                        Published Versions
                      </Header>
                    }
                  >
                    <Table
                      columnDefinitions={[
                        { id: 'version', header: 'Version', cell: (i: any) => <strong>{i.Version || i.version || '$LATEST'}</strong>, width: 120 },
                        { id: 'desc', header: 'Description', cell: (i: any) => i.Description || i.description || '—' },
                        { id: 'arn', header: 'Version ARN', cell: (i: any) => <code>{i.FunctionArn || i.functionArn}</code> },
                      ]}
                      items={versions.length > 0 ? versions : [{ Version: '$LATEST', Description: 'Active working draft', FunctionArn: activeFunction.FunctionArn }]}
                    />
                  </Container>
                ),
              },
              {
                label: 'Configuration',
                id: 'config',
                content: (
                  <KeyValuePairs
                    columns={3}
                    items={[
                      { label: 'Function ARN', value: activeFunction.FunctionArn },
                      { label: 'Runtime', value: activeFunction.Runtime },
                      { label: 'Handler', value: activeFunction.Handler },
                      { label: 'Memory Size', value: `${activeFunction.MemorySize} MB` },
                      { label: 'Timeout', value: `${activeFunction.Timeout} seconds` },
                      { label: 'Execution Role', value: 'arn:aws:iam::000000000000:role/lambda-basic-execution' },
                    ]}
                  />
                ),
              },
            ]}
          />
        </Container>
      )}

      {/* Create Function Modal */}
      <Modal
        visible={createModalOpen}
        onDismiss={() => setCreateModalOpen(false)}
        header="Create Lambda Function"
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creating} onClick={handleCreateFunction}>
                Create Function
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Function Name" description="Unique function identifier.">
            <Input
              value={functionName}
              onChange={({ detail }) => setFunctionName(detail.value)}
              placeholder="processOrderEvent"
            />
          </FormField>

          <FormField label="Runtime">
            <Select
              selectedOption={runtime}
              onChange={({ detail }) => setRuntime(detail.selectedOption as any)}
              options={[
                { label: 'Python 3.12', value: 'python3.12' },
                { label: 'Node.js 20.x', value: 'nodejs20.x' },
                { label: 'Custom Runtime (provided.al2023)', value: 'provided.al2023' },
                { label: 'Java 21', value: 'java21' },
              ]}
            />
          </FormField>

          <FormField label="Handler" description="The entrypoint file and method to execute.">
            <Input
              value={handler}
              onChange={({ detail }) => setHandler(detail.value)}
              placeholder="lambda_function.lambda_handler"
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Test / Invoke Modal */}
      <Modal
        visible={invokeModalOpen}
        onDismiss={() => setInvokeModalOpen(false)}
        header={`Test Invocation: ${activeFunction?.FunctionName}`}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setInvokeModalOpen(false)}>
                Close
              </Button>
              <Button variant="primary" iconName="caret-right-filled" loading={invoking} onClick={handleInvoke}>
                Execute
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Event JSON Payload" description="Input JSON payload passed to the handler function.">
            <Textarea
              rows={6}
              value={invokePayload}
              onChange={({ detail }) => setInvokePayload(detail.value)}
            />
          </FormField>

          {invokeResponse && (
            <Container header={<Header variant="h3">Execution Result</Header>}>
              <CodeSnippet language="json" code={invokeResponse} />
            </Container>
          )}
        </SpaceBetween>
      </Modal>

      {/* Add Trigger Modal */}
      <Modal
        visible={addTriggerOpen}
        onDismiss={() => setAddTriggerOpen(false)}
        header={`Add Event Trigger: ${activeFunction?.FunctionName}`}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setAddTriggerOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={savingTrigger} onClick={handleAddTrigger}>
                Add Trigger
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Event Source ARN" description="ARN of an Amazon SQS Queue, DynamoDB Stream, or Kinesis Stream.">
            <Input
              value={triggerSourceArn}
              onChange={({ detail }) => setTriggerSourceArn(detail.value)}
              placeholder="arn:aws:sqs:us-east-1:000000000000:my-queue"
            />
          </FormField>

          <FormField label="Batch Size" description="Maximum number of records to retrieve in a single batch (1-10000).">
            <Input
              type="number"
              value={triggerBatchSize}
              onChange={({ detail }) => setTriggerBatchSize(detail.value)}
              placeholder="10"
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Publish Version Modal */}
      <Modal
        visible={publishVersionOpen}
        onDismiss={() => setPublishVersionOpen(false)}
        header={`Publish New Version: ${activeFunction?.FunctionName}`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setPublishVersionOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={publishingVersion} onClick={handlePublishVersion}>
                Publish
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <FormField label="Version Description (Optional)">
          <Input
            value={versionDescription}
            onChange={({ detail }) => setVersionDescription(detail.value)}
            placeholder="Production release snapshot"
          />
        </FormField>
      </Modal>
    </SpaceBetween>
  );
};
