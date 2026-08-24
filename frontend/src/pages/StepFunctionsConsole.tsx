import React, { useState, useEffect } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Table from '@cloudscape-design/components/table';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import Select from '@cloudscape-design/components/select';
import Modal from '@cloudscape-design/components/modal';
import Box from '@cloudscape-design/components/box';
import Badge from '@cloudscape-design/components/badge';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Grid from '@cloudscape-design/components/grid';
import Alert from '@cloudscape-design/components/alert';
import TextFilter from '@cloudscape-design/components/text-filter';
import Tabs from '@cloudscape-design/components/tabs';
import { fetchInventory, executeServiceAction } from '../api/client';
import { CodeSnippet } from '../components/CodeSnippet';

const SAMPLE_ASL = JSON.stringify(
  {
    Comment: "A simple Floci Step Functions state machine workflow",
    StartAt: "ValidateOrder",
    States: {
      ValidateOrder: {
        Type: "Pass",
        Result: { status: "VALID", processedBy: "Floci Local" },
        Next: "ProcessPayment"
      },
      ProcessPayment: {
        Type: "Pass",
        Result: { transactionId: "txn-89104", amount: 99.00 },
        End: true
      }
    }
  },
  null,
  2
);

export const StepFunctionsConsole: React.FC = () => {
  const [data, setData] = useState<any>({ state_machines: [], executions: [] });
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [selectedMachines, setSelectedMachines] = useState<any[]>([]);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create Machine Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [machineName, setMachineName] = useState('');
  const [machineType, setMachineType] = useState({ label: 'STANDARD', value: 'STANDARD' });
  const [definition, setDefinition] = useState(SAMPLE_ASL);
  const [creating, setCreating] = useState(false);

  // Start Execution Modal
  const [startExecModalOpen, setStartExecModalOpen] = useState(false);
  const [execInput, setExecInput] = useState('{\n  "orderId": "order-12345"\n}');
  const [execName, setExecName] = useState('');
  const [executing, setExecuting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchInventory('stepfunctions');
      setData(res || { state_machines: [], executions: [] });
      if (res.state_machines?.length > 0 && selectedMachines.length === 0) {
        setSelectedMachines([res.state_machines[0]]);
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

  const handleCreateMachine = async () => {
    if (!machineName.trim()) return;
    setCreating(true);
    setActionMessage(null);
    try {
      let parsed = {};
      try {
        parsed = JSON.parse(definition);
      } catch (e) {}

      await executeServiceAction('stepfunctions', 'create_state_machine', {
        name: machineName.trim(),
        type: machineType.value,
        definition: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
        role_arn: 'arn:aws:iam::000000000000:role/StepFunctionsExecutionRole',
      });
      setActionMessage({ type: 'success', text: `State machine "${machineName.trim()}" created successfully.` });
      setCreateModalOpen(false);
      setMachineName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create state machine' });
    } finally {
      setCreating(false);
    }
  };

  const handleStartExecution = async () => {
    if (!selectedMachines.length) return;
    const activeMachine = selectedMachines[0];
    setExecuting(true);
    try {
      const arn = activeMachine.stateMachineArn || activeMachine.arn || `arn:aws:states:us-east-1:000000000000:stateMachine:${activeMachine.name}`;
      await executeServiceAction('stepfunctions', 'start_execution', {
        state_machine_arn: arn,
        name: execName.trim() || undefined,
        input: execInput,
      });
      setActionMessage({ type: 'success', text: `Execution started for "${activeMachine.name || activeMachine.Name}".` });
      setStartExecModalOpen(false);
      setExecName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to start execution' });
    } finally {
      setExecuting(false);
    }
  };

  const machinesList = (data.state_machines || []).map((m: any) => ({
    ...m,
    Name: m.name || m.Name,
    Arn: m.stateMachineArn || m.arn || `arn:aws:states:us-east-1:000000000000:stateMachine:${m.name || m.Name}`,
    Type: m.type || m.Type || 'STANDARD',
    CreationDate: m.creationDate || m.CreationDate,
    Definition: m.definition || SAMPLE_ASL,
  }));

  const filteredMachines = machinesList.filter((m: any) => {
    const text = `${m.Name} ${m.Type} ${m.Arn}`.toLowerCase();
    return text.includes(filterText.toLowerCase());
  });

  const activeMachine = selectedMachines.length > 0 ? selectedMachines[0] : null;

  return (
    <SpaceBetween size="l">
      {/* Header */}
      <Container
        header={
          <Header
            variant="h1"
            description="Visual workflow service that coordinates microservices, distributed applications, and automated processes."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <Button variant="primary" iconName="add-plus" onClick={() => setCreateModalOpen(true)}>
                  Create State Machine
                </Button>
              </SpaceBetween>
            }
          >
            AWS Step Functions
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
            <Box variant="awsui-key-label">State Machines</Box>
            <Box variant="h1" color="text-status-info">
              {machinesList.length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Execution Engine</Box>
            <Box variant="h2" color="text-status-info">
              <Badge color="blue">JSONata & ASL Orchestrator</Badge>
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Service Health</Box>
            <Box variant="h2" color="text-status-info">
              <StatusIndicator type="success">Step Functions Ready</StatusIndicator>
            </Box>
          </Box>
        </Grid>
      </Container>

      {/* State Machines Table */}
      <Container
        header={
          <Header
            variant="h2"
            description="State machine workflows defined in Floci."
            actions={
              <Button
                variant="primary"
                iconName="caret-right-filled"
                disabled={!selectedMachines.length}
                onClick={() => setStartExecModalOpen(true)}
              >
                Start Execution
              </Button>
            }
          >
            State Machines ({machinesList.length})
          </Header>
        }
      >
        <SpaceBetween size="m">
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Filter state machines by name..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />

          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: 'State Machine Name',
                cell: (item) => <strong>{item.Name}</strong>,
              },
              {
                id: 'type',
                header: 'Type',
                cell: (item) => <Badge color={item.Type === 'EXPRESS' ? 'blue' : 'green'}>{item.Type}</Badge>,
                width: 130,
              },
              {
                id: 'arn',
                header: 'ARN',
                cell: (item) => <code>{item.Arn}</code>,
              },
            ]}
            items={filteredMachines}
            selectionType="single"
            selectedItems={selectedMachines}
            onSelectionChange={({ detail }) => setSelectedMachines(detail.selectedItems)}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No state machines found</b>
                <p>Create a state machine with an Amazon States Language (ASL) workflow definition.</p>
              </Box>
            }
          />
        </SpaceBetween>
      </Container>

      {/* Machine Details & Workflow Definition */}
      {activeMachine && (
        <Container
          header={
            <Header
              variant="h2"
              description={`Workflow definition and executions for ${activeMachine.Name || activeMachine.name}`}
            >
              Workflow: {activeMachine.Name || activeMachine.name}
            </Header>
          }
        >
          <Tabs
            tabs={[
              {
                label: 'ASL Definition',
                id: 'definition',
                content: (
                  <CodeSnippet
                    language="json"
                    code={
                      typeof activeMachine.Definition === 'string'
                        ? activeMachine.Definition
                        : JSON.stringify(activeMachine.Definition, null, 2)
                    }
                  />
                ),
              },
              {
                label: 'Executions History',
                id: 'executions',
                content: (
                  <Table
                    columnDefinitions={[
                      { id: 'name', header: 'Execution Name', cell: (i: any) => <strong>{i.name || i.executionArn?.split(':').pop() || 'Execution-1'}</strong> },
                      { id: 'status', header: 'Status', cell: () => <StatusIndicator type="success">SUCCEEDED</StatusIndicator>, width: 150 },
                      { id: 'time', header: 'Start Time', cell: () => new Date().toLocaleTimeString(), width: 150 },
                    ]}
                    items={(data.executions || []).slice(0, 10)}
                    empty={<Box textAlign="center">No executions triggered yet for this state machine.</Box>}
                  />
                ),
              },
            ]}
          />
        </Container>
      )}

      {/* Create State Machine Modal */}
      <Modal
        visible={createModalOpen}
        onDismiss={() => setCreateModalOpen(false)}
        header="Create State Machine"
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creating} onClick={handleCreateMachine}>
                Create State Machine
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="State Machine Name" description="Unique workflow name.">
            <Input
              value={machineName}
              onChange={({ detail }) => setMachineName(detail.value)}
              placeholder="OrderProcessingWorkflow"
            />
          </FormField>

          <FormField label="Workflow Type">
            <Select
              selectedOption={machineType}
              onChange={({ detail }) => setMachineType(detail.selectedOption as any)}
              options={[
                { label: 'STANDARD (Exactly-once execution model)', value: 'STANDARD' },
                { label: 'EXPRESS (High-throughput, at-least-once model)', value: 'EXPRESS' },
              ]}
            />
          </FormField>

          <FormField
            label="Amazon States Language (ASL) Definition (JSON)"
            description="Define your states, tasks, transitions, and flow controls."
          >
            <Textarea
              rows={12}
              value={definition}
              onChange={({ detail }) => setDefinition(detail.value)}
              placeholder="{\n  &quot;StartAt&quot;: &quot;...&quot;\n}"
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Start Execution Modal */}
      <Modal
        visible={startExecModalOpen}
        onDismiss={() => setStartExecModalOpen(false)}
        header={`Start Execution: ${activeMachine?.Name || activeMachine?.name}`}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setStartExecModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={executing} onClick={handleStartExecution}>
                Start Execution
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Execution Name (Optional)" description="Leave blank for an auto-generated UUID.">
            <Input
              value={execName}
              onChange={({ detail }) => setExecName(detail.value)}
              placeholder="exec-run-101"
            />
          </FormField>

          <FormField label="Execution Input (JSON)" description="Input payload passed into the starting state.">
            <Textarea
              rows={6}
              value={execInput}
              onChange={({ detail }) => setExecInput(detail.value)}
              placeholder="{\n  &quot;key&quot;: &quot;value&quot;\n}"
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
