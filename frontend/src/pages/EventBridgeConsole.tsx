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
import Badge from '@cloudscape-design/components/badge';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Grid from '@cloudscape-design/components/grid';
import Alert from '@cloudscape-design/components/alert';
import TextFilter from '@cloudscape-design/components/text-filter';
import Tabs from '@cloudscape-design/components/tabs';
import { fetchInventory, executeServiceAction } from '../api/client';
import { CodeSnippet } from '../components/CodeSnippet';

export const EventBridgeConsole: React.FC = () => {
  const [data, setData] = useState<any>({ rules: [], event_buses: [] });
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [selectedRules, setSelectedRules] = useState<any[]>([]);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create Rule Modal
  const [createRuleOpen, setCreateRuleOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [busName, setBusName] = useState('default');
  const [eventPattern, setEventPattern] = useState('{\n  "source": ["my.application"],\n  "detail-type": ["UserSignup"]\n}');
  const [creatingRule, setCreatingRule] = useState(false);

  // Send Event Form
  const [eventSource, setEventSource] = useState('ecommerce.orders');
  const [detailType, setDetailType] = useState('OrderPlaced');
  const [eventDetail, setEventDetail] = useState('{\n  "orderId": "ord-98214",\n  "amount": 49.99,\n  "customer": "Alice"\n}');
  const [sendingEvent, setSendingEvent] = useState(false);
  const [sendResult, setSendResult] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchInventory('eventbridge');
      setData(res || { rules: [], event_buses: [] });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateRule = async () => {
    if (!ruleName.trim()) return;
    setCreatingRule(true);
    setActionMessage(null);
    try {
      let parsedPattern = {};
      try {
        parsedPattern = JSON.parse(eventPattern);
      } catch (e) {}

      await executeServiceAction('eventbridge', 'put_rule', {
        name: ruleName.trim(),
        event_bus_name: busName.trim() || 'default',
        event_pattern: JSON.stringify(parsedPattern),
        state: 'ENABLED',
      });
      setActionMessage({ type: 'success', text: `Rule "${ruleName.trim()}" created successfully.` });
      setCreateRuleOpen(false);
      setRuleName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create rule' });
    } finally {
      setCreatingRule(false);
    }
  };

  const handleSendEvent = async () => {
    setSendingEvent(true);
    setSendResult(null);
    try {
      let parsedDetail = {};
      try {
        parsedDetail = JSON.parse(eventDetail);
      } catch (e) {}

      const res = await executeServiceAction('eventbridge', 'put_events', {
        entries: [
          {
            EventBusName: busName || 'default',
            Source: eventSource,
            DetailType: detailType,
            Detail: JSON.stringify(parsedDetail),
          },
        ],
      });
      setSendResult(res);
      setActionMessage({ type: 'success', text: 'Event sent to EventBridge bus successfully' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to send event' });
    } finally {
      setSendingEvent(false);
    }
  };

  const rulesList = (data.rules || []).map((r: any) => ({
    ...r,
    Name: r.Name || r.name,
    Arn: r.Arn || r.arn,
    State: r.State || r.state || 'ENABLED',
    EventBusName: r.EventBusName || r.event_bus_name || 'default',
    EventPattern: r.EventPattern || r.event_pattern || '—',
  }));

  const filteredRules = rulesList.filter((r: any) => {
    const text = `${r.Name} ${r.EventBusName} ${r.EventPattern}`.toLowerCase();
    return text.includes(filterText.toLowerCase());
  });

  return (
    <SpaceBetween size="l">
      {/* Header */}
      <Container
        header={
          <Header
            variant="h1"
            description="Serverless event bus that connects applications using data from custom sources and AWS services."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <Button variant="primary" iconName="add-plus" onClick={() => setCreateRuleOpen(true)}>
                  Create Event Rule
                </Button>
              </SpaceBetween>
            }
          >
            Amazon EventBridge
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
            <Box variant="awsui-key-label">Event Rules</Box>
            <Box variant="h1" color="text-status-info">
              {rulesList.length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Event Buses</Box>
            <Box variant="h1" color="text-status-info">
              {(data.event_buses || [{ Name: 'default' }]).length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Event Routing Engine</Box>
            <Box variant="h2" color="text-status-info">
              <StatusIndicator type="success">EventBridge Bus Active</StatusIndicator>
            </Box>
          </Box>
        </Grid>
      </Container>

      {/* Tabs */}
      <Tabs
        tabs={[
          {
            label: `Event Rules (${rulesList.length})`,
            id: 'rules',
            content: (
              <Container
                header={
                  <Header
                    variant="h2"
                    description="Event pattern matchers and scheduled event rules."
                  >
                    Event Rules
                  </Header>
                }
              >
                <SpaceBetween size="m">
                  <TextFilter
                    filteringText={filterText}
                    filteringPlaceholder="Filter rules by name, event bus..."
                    onChange={({ detail }) => setFilterText(detail.filteringText)}
                  />

                  <Table
                    columnDefinitions={[
                      {
                        id: 'name',
                        header: 'Rule Name',
                        cell: (item) => <strong>{item.Name}</strong>,
                      },
                      {
                        id: 'bus',
                        header: 'Event Bus',
                        cell: (item) => <Badge color="blue">{item.EventBusName}</Badge>,
                        width: 140,
                      },
                      {
                        id: 'status',
                        header: 'Status',
                        cell: (item) => (
                          <StatusIndicator type={item.State === 'ENABLED' ? 'success' : 'stopped'}>
                            {item.State}
                          </StatusIndicator>
                        ),
                        width: 130,
                      },
                      {
                        id: 'pattern',
                        header: 'Event Pattern / Schedule',
                        cell: (item) => (
                          <div style={{ maxWidth: '400px', wordBreak: 'break-all' }}>
                            <code>{item.EventPattern}</code>
                          </div>
                        ),
                      },
                    ]}
                    items={filteredRules}
                    selectionType="single"
                    selectedItems={selectedRules}
                    onSelectionChange={({ detail }) => setSelectedRules(detail.selectedItems)}
                    empty={
                      <Box textAlign="center" color="inherit">
                        <b>No EventBridge rules found</b>
                        <p>Create a rule to match incoming events and route them to targets.</p>
                      </Box>
                    }
                  />
                </SpaceBetween>
              </Container>
            ),
          },
          {
            label: 'Publish Custom Events',
            id: 'send',
            content: (
              <Container
                header={
                  <Header
                    variant="h2"
                    description="Send custom event payloads into EventBridge to trigger target Lambdas, SQS queues, or Step Functions."
                  >
                    Event Publisher Sandbox
                  </Header>
                }
              >
                <SpaceBetween size="m">
                  <Grid gridDefinition={[{ colspan: { default: 12, m: 6 } }, { colspan: { default: 12, m: 6 } }]}>
                    <FormField label="Event Source" description="Identifier for your subsystem.">
                      <Input
                        value={eventSource}
                        onChange={({ detail }) => setEventSource(detail.value)}
                        placeholder="ecommerce.orders"
                      />
                    </FormField>
                    <FormField label="Detail Type" description="Event classification name.">
                      <Input
                        value={detailType}
                        onChange={({ detail }) => setDetailType(detail.value)}
                        placeholder="OrderPlaced"
                      />
                    </FormField>
                  </Grid>

                  <FormField
                    label="Event Detail (JSON Payload)"
                    description="Enter the JSON event details payload."
                  >
                    <Textarea
                      rows={6}
                      value={eventDetail}
                      onChange={({ detail }) => setEventDetail(detail.value)}
                      placeholder="{\n  &quot;orderId&quot;: &quot;123&quot;\n}"
                    />
                  </FormField>

                  <Button variant="primary" iconName="caret-right-filled" loading={sendingEvent} onClick={handleSendEvent}>
                    Publish Event to EventBridge
                  </Button>

                  {sendResult && (
                    <Container header={<Header variant="h3">Event Delivery Confirmation</Header>}>
                      <CodeSnippet language="json" code={JSON.stringify(sendResult, null, 2)} />
                    </Container>
                  )}
                </SpaceBetween>
              </Container>
            ),
          },
        ]}
      />

      {/* Create Rule Modal */}
      <Modal
        visible={createRuleOpen}
        onDismiss={() => setCreateRuleOpen(false)}
        header="Create EventBridge Rule"
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateRuleOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creatingRule} onClick={handleCreateRule}>
                Create Rule
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Rule Name" description="Unique name for the EventBridge rule.">
            <Input
              value={ruleName}
              onChange={({ detail }) => setRuleName(detail.value)}
              placeholder="order-processor-rule"
            />
          </FormField>

          <FormField label="Event Bus" description="Target event bus (defaults to 'default').">
            <Input
              value={busName}
              onChange={({ detail }) => setBusName(detail.value)}
              placeholder="default"
            />
          </FormField>

          <FormField
            label="Event Pattern (JSON)"
            description="Specify the event pattern filtering syntax."
          >
            <Textarea
              rows={6}
              value={eventPattern}
              onChange={({ detail }) => setEventPattern(detail.value)}
              placeholder="{\n  &quot;source&quot;: [&quot;my.app&quot;]\n}"
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
