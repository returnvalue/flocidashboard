import React, { useState, useEffect } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Table from '@cloudscape-design/components/table';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import Modal from '@cloudscape-design/components/modal';
import Box from '@cloudscape-design/components/box';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Grid from '@cloudscape-design/components/grid';
import Alert from '@cloudscape-design/components/alert';
import TextFilter from '@cloudscape-design/components/text-filter';
import Tabs from '@cloudscape-design/components/tabs';
import { fetchInventory, executeServiceAction } from '../api/client';
import { CodeSnippet } from '../components/CodeSnippet';

const SAMPLE_TEMPLATE = `AWSTemplateFormatVersion: '2010-09-09'
Description: Sample Floci CloudFormation Stack
Resources:
  MyTestBucket:
    Type: 'AWS::S3::Bucket'
    Properties:
      BucketName: 'floci-cfn-demo-bucket'
  MyTestQueue:
    Type: 'AWS::SQS::Queue'
    Properties:
      QueueName: 'floci-cfn-demo-queue'
Outputs:
  BucketName:
    Description: 'Name of the created S3 bucket'
    Value: !Ref MyTestBucket
`;

export const CloudFormationConsole: React.FC = () => {
  const [data, setData] = useState<any>({ stacks: [] });
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [selectedStacks, setSelectedStacks] = useState<any[]>([]);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create Stack Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [stackName, setStackName] = useState('');
  const [templateBody, setTemplateBody] = useState(SAMPLE_TEMPLATE);
  const [creating, setCreating] = useState(false);

  // Delete Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchInventory('cloudformation');
      setData(res || { stacks: [] });
      if (res.stacks?.length > 0 && selectedStacks.length === 0) {
        setSelectedStacks([res.stacks[0]]);
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

  const handleCreateStack = async () => {
    if (!stackName.trim()) return;
    setCreating(true);
    setActionMessage(null);
    try {
      await executeServiceAction('cloudformation', 'create_stack', {
        stack_name: stackName.trim(),
        template_body: templateBody,
      });
      setActionMessage({ type: 'success', text: `Stack "${stackName.trim()}" deployment initiated successfully.` });
      setCreateModalOpen(false);
      setStackName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create stack' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteStack = async () => {
    if (!selectedStacks.length) return;
    const stack = selectedStacks[0];
    setDeleting(true);
    try {
      await executeServiceAction('cloudformation', 'delete_stack', {
        stack_name: stack.StackName || stack.stack_name,
      });
      setActionMessage({ type: 'success', text: `Stack "${stack.StackName || stack.stack_name}" deletion triggered.` });
      setDeleteModalOpen(false);
      setSelectedStacks([]);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete stack' });
    } finally {
      setDeleting(false);
    }
  };

  const stacksList = (data.stacks || []).map((s: any) => ({
    ...s,
    StackName: s.StackName || s.stack_name,
    StackStatus: s.StackStatus || s.stack_status || 'CREATE_COMPLETE',
    CreationTime: s.CreationTime || s.creation_time,
    Description: s.Description || s.description || '—',
    Outputs: s.Outputs || s.outputs || [],
    Template: s.TemplateBody || s.template_body || SAMPLE_TEMPLATE,
  }));

  const filteredStacks = stacksList.filter((s: any) => {
    const text = `${s.StackName} ${s.StackStatus} ${s.Description}`.toLowerCase();
    return text.includes(filterText.toLowerCase());
  });

  const activeStack = selectedStacks.length > 0 ? selectedStacks[0] : null;

  return (
    <SpaceBetween size="l">
      {/* Header */}
      <Container
        header={
          <Header
            variant="h1"
            description="Speed up cloud provisioning with infrastructure as code templates deployed into local mock services."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <Button variant="primary" iconName="add-plus" onClick={() => setCreateModalOpen(true)}>
                  Create Stack
                </Button>
              </SpaceBetween>
            }
          >
            AWS CloudFormation
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
            <Box variant="awsui-key-label">Active Stacks</Box>
            <Box variant="h1" color="text-status-info">
              {stacksList.length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Stack Deployments</Box>
            <Box variant="h1" color="text-status-info">
              {stacksList.filter((s: any) => s.StackStatus.includes('COMPLETE')).length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Engine Status</Box>
            <Box variant="h2" color="text-status-info">
              <StatusIndicator type="success">CloudFormation Ready</StatusIndicator>
            </Box>
          </Box>
        </Grid>
      </Container>

      {/* Stacks Table */}
      <Container
        header={
          <Header
            variant="h2"
            description="CloudFormation stacks provisioned in Floci."
            actions={
              <Button
                disabled={!selectedStacks.length}
                onClick={() => setDeleteModalOpen(true)}
              >
                Delete Stack
              </Button>
            }
          >
            Stacks ({stacksList.length})
          </Header>
        }
      >
        <SpaceBetween size="m">
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Filter stacks by name, status..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />

          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: 'Stack Name',
                cell: (item) => <strong>{item.StackName}</strong>,
              },
              {
                id: 'status',
                header: 'Status',
                cell: (item) => (
                  <StatusIndicator
                    type={
                      item.StackStatus.includes('COMPLETE')
                        ? 'success'
                        : item.StackStatus.includes('IN_PROGRESS')
                        ? 'in-progress'
                        : 'error'
                    }
                  >
                    {item.StackStatus}
                  </StatusIndicator>
                ),
                width: 200,
              },
              {
                id: 'created',
                header: 'Created Time',
                cell: (item) => (
                  <span style={{ color: '#879596', fontSize: '12px' }}>
                    {item.CreationTime ? new Date(item.CreationTime).toLocaleString() : 'Just now'}
                  </span>
                ),
                width: 200,
              },
              {
                id: 'description',
                header: 'Description',
                cell: (item) => item.Description,
              },
            ]}
            items={filteredStacks}
            selectionType="single"
            selectedItems={selectedStacks}
            onSelectionChange={({ detail }) => setSelectedStacks(detail.selectedItems)}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No CloudFormation stacks found</b>
                <p>Deploy a CloudFormation YAML or JSON template to provision resources.</p>
              </Box>
            }
          />
        </SpaceBetween>
      </Container>

      {/* Stack Details Tabs */}
      {activeStack && (
        <Container
          header={
            <Header variant="h2" description={`Stack details for ${activeStack.StackName}`}>
              Stack: {activeStack.StackName}
            </Header>
          }
        >
          <Tabs
            tabs={[
              {
                label: 'Outputs',
                id: 'outputs',
                content: (
                  <Table
                    columnDefinitions={[
                      { id: 'key', header: 'Output Key', cell: (i: any) => <strong>{i.OutputKey || i.key}</strong> },
                      { id: 'value', header: 'Output Value', cell: (i: any) => <code>{i.OutputValue || i.value}</code> },
                      { id: 'desc', header: 'Description', cell: (i: any) => i.Description || i.description || '—' },
                    ]}
                    items={activeStack.Outputs || []}
                    empty={<Box textAlign="center">No outputs declared in this stack template.</Box>}
                  />
                ),
              },
              {
                label: 'Template Body',
                id: 'template',
                content: (
                  <CodeSnippet
                    language="cli"
                    code={typeof activeStack.Template === 'string' ? activeStack.Template : JSON.stringify(activeStack.Template, null, 2)}
                  />
                ),
              },
            ]}
          />
        </Container>
      )}

      {/* Create Stack Modal */}
      <Modal
        visible={createModalOpen}
        onDismiss={() => setCreateModalOpen(false)}
        header="Create CloudFormation Stack"
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creating} onClick={handleCreateStack}>
                Deploy Stack
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Stack Name" description="Unique name for the CloudFormation stack.">
            <Input
              value={stackName}
              onChange={({ detail }) => setStackName(detail.value)}
              placeholder="my-infrastructure-stack"
            />
          </FormField>

          <FormField
            label="Template Body (YAML or JSON)"
            description="Paste your AWS CloudFormation template."
          >
            <Textarea
              rows={12}
              value={templateBody}
              onChange={({ detail }) => setTemplateBody(detail.value)}
              placeholder="AWSTemplateFormatVersion: '2010-09-09'..."
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalOpen}
        onDismiss={() => setDeleteModalOpen(false)}
        header={`Delete Stack: ${selectedStacks[0]?.StackName}`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={deleting} onClick={handleDeleteStack}>
                Confirm Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Alert type="warning">
          Are you sure you want to delete stack <strong>{selectedStacks[0]?.StackName}</strong>? All resources provisioned by this stack will be terminated.
        </Alert>
      </Modal>
    </SpaceBetween>
  );
};
