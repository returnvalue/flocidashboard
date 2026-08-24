import React, { useState, useEffect } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Table from '@cloudscape-design/components/table';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import Modal from '@cloudscape-design/components/modal';
import Box from '@cloudscape-design/components/box';
import Badge from '@cloudscape-design/components/badge';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Grid from '@cloudscape-design/components/grid';
import Alert from '@cloudscape-design/components/alert';
import TextFilter from '@cloudscape-design/components/text-filter';
import Tabs from '@cloudscape-design/components/tabs';
import { fetchInventory, executeServiceAction, fetchInspectorLogGroups, fetchInspectorLogEvents } from '../api/client';

interface CloudWatchConsoleProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export const CloudWatchConsole: React.FC<CloudWatchConsoleProps> = ({ activeTab, onTabChange }) => {
  const [data, setData] = useState<any>({ metric_alarms: [] });
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [selectedAlarms, setSelectedAlarms] = useState<any[]>([]);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedTabId, setSelectedTabId] = useState(activeTab || 'alarms');

  useEffect(() => {
    if (activeTab) {
      setSelectedTabId(activeTab);
    }
  }, [activeTab]);

  // Create Alarm Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [alarmName, setAlarmName] = useState('');
  const [metricName, setMetricName] = useState('CPUUtilization');
  const [namespace, setNamespace] = useState('AWS/EC2');
  const [threshold, setThreshold] = useState('80');
  const [comparisonOp, setComparisonOp] = useState({ label: 'GreaterThanThreshold (>)', value: 'GreaterThanThreshold' });
  const [creating, setCreating] = useState(false);

  // CloudWatch Logs
  const [logGroups, setLogGroups] = useState<any[]>([]);
  const [selectedLogGroup, setSelectedLogGroup] = useState<any>(null);
  const [logEvents, setLogEvents] = useState<any[]>([]);
  const [logFilter, setLogFilter] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchInventory('cloudwatch');
      setData(res || { metric_alarms: [] });
      const logsRes = await fetchInspectorLogGroups();
      setLogGroups(logsRes.log_groups || []);
      if (logsRes.log_groups?.length > 0 && !selectedLogGroup) {
        setSelectedLogGroup({ label: logsRes.log_groups[0].logGroupName, value: logsRes.log_groups[0].logGroupName });
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

  const loadLogs = async (groupName: string) => {
    if (!groupName) return;
    setLoadingLogs(true);
    try {
      const res = await fetchInspectorLogEvents(groupName);
      setLogEvents(res.events || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (selectedLogGroup?.value) {
      loadLogs(selectedLogGroup.value);
    }
  }, [selectedLogGroup]);

  const handleCreateAlarm = async () => {
    if (!alarmName.trim()) return;
    setCreating(true);
    setActionMessage(null);
    try {
      await executeServiceAction('cloudwatch', 'put_metric_alarm', {
        alarm_name: alarmName.trim(),
        metric_name: metricName,
        namespace,
        threshold: Number(threshold) || 80,
        comparison_operator: comparisonOp.value,
        evaluation_periods: 1,
        period: 300,
        statistic: 'Average',
      });
      setActionMessage({ type: 'success', text: `Metric Alarm "${alarmName.trim()}" created successfully.` });
      setCreateModalOpen(false);
      setAlarmName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create metric alarm' });
    } finally {
      setCreating(false);
    }
  };

  const handleSetAlarmState = async (stateValue: 'OK' | 'ALARM') => {
    if (!selectedAlarms.length) return;
    const alarm = selectedAlarms[0];
    try {
      await executeServiceAction('cloudwatch', 'set_alarm_state', {
        alarm_name: alarm.AlarmName,
        state_value: stateValue,
        state_reason: `Manual override via Floci CloudWatch Console`,
      });
      setActionMessage({ type: 'success', text: `Alarm state updated to ${stateValue}.` });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to update alarm state' });
    }
  };

  const alarmsList = (data.metric_alarms || []).map((a: any) => ({
    ...a,
    AlarmName: a.AlarmName || a.alarm_name,
    MetricName: a.MetricName || a.metric_name || 'CPUUtilization',
    Namespace: a.Namespace || a.namespace || 'AWS/EC2',
    StateValue: a.StateValue || a.state_value || 'OK',
    Threshold: a.Threshold ?? a.threshold ?? 80,
  }));

  const filteredAlarms = alarmsList.filter((a: any) => {
    const text = `${a.AlarmName} ${a.MetricName} ${a.Namespace}`.toLowerCase();
    return text.includes(filterText.toLowerCase());
  });

  const filteredEvents = logEvents.filter((ev) =>
    (ev.message || '').toLowerCase().includes(logFilter.toLowerCase())
  );

  return (
    <SpaceBetween size="l">
      {/* Header */}
      <Container
        header={
          <Header
            variant="h1"
            description="Observability and monitoring service providing data and actionable insights for mock AWS resources."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <Button variant="primary" iconName="add-plus" onClick={() => setCreateModalOpen(true)}>
                  Create Metric Alarm
                </Button>
              </SpaceBetween>
            }
          >
            Amazon CloudWatch
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
            <Box variant="awsui-key-label">Total Metric Alarms</Box>
            <Box variant="h1" color="text-status-info">
              {alarmsList.length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Alarms In Alarm State</Box>
            <Box variant="h1" color="text-status-error">
              {alarmsList.filter((a: any) => a.StateValue === 'ALARM').length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Log Groups Active</Box>
            <Box variant="h1" color="text-status-info">
              {logGroups.length}
            </Box>
          </Box>
        </Grid>
      </Container>

      {/* Tabs */}
      <Tabs
        activeTabId={selectedTabId}
        onChange={({ detail }) => {
          setSelectedTabId(detail.activeTabId);
          onTabChange?.(detail.activeTabId);
        }}
        tabs={[
          {
            label: `Metric Alarms (${alarmsList.length})`,
            id: 'alarms',
            content: (
              <Container
                header={
                  <Header
                    variant="h2"
                    description="Alarms evaluating metric thresholds across compute and storage resources."
                    actions={
                      <SpaceBetween direction="horizontal" size="xs">
                        <Button
                          disabled={!selectedAlarms.length}
                          onClick={() => handleSetAlarmState('ALARM')}
                        >
                          Simulate Alarm (ALARM)
                        </Button>
                        <Button
                          disabled={!selectedAlarms.length}
                          onClick={() => handleSetAlarmState('OK')}
                        >
                          Clear Alarm (OK)
                        </Button>
                      </SpaceBetween>
                    }
                  >
                    Metric Alarms
                  </Header>
                }
              >
                <SpaceBetween size="m">
                  <TextFilter
                    filteringText={filterText}
                    filteringPlaceholder="Filter alarms by name, metric..."
                    onChange={({ detail }) => setFilterText(detail.filteringText)}
                  />

                  <Table
                    columnDefinitions={[
                      {
                        id: 'name',
                        header: 'Alarm Name',
                        cell: (item) => <strong>{item.AlarmName}</strong>,
                      },
                      {
                        id: 'state',
                        header: 'State',
                        cell: (item) => (
                          <StatusIndicator type={item.StateValue === 'OK' ? 'success' : 'error'}>
                            {item.StateValue}
                          </StatusIndicator>
                        ),
                        width: 130,
                      },
                      {
                        id: 'metric',
                        header: 'Metric Name',
                        cell: (item) => <code>{item.MetricName}</code>,
                        width: 180,
                      },
                      {
                        id: 'namespace',
                        header: 'Namespace',
                        cell: (item) => <Badge color="blue">{item.Namespace}</Badge>,
                        width: 140,
                      },
                      {
                        id: 'threshold',
                        header: 'Threshold',
                        cell: (item) => <span>&gt; {item.Threshold}</span>,
                        width: 120,
                      },
                    ]}
                    items={filteredAlarms}
                    selectionType="single"
                    selectedItems={selectedAlarms}
                    onSelectionChange={({ detail }) => setSelectedAlarms(detail.selectedItems)}
                    empty={
                      <Box textAlign="center" color="inherit">
                        <b>No metric alarms found</b>
                        <p>Create an alarm to monitor infrastructure metrics.</p>
                      </Box>
                    }
                  />
                </SpaceBetween>
              </Container>
            ),
          },
          {
            label: `CloudWatch Logs (${logGroups.length})`,
            id: 'logs',
            content: (
              <Container
                header={
                  <Header
                    variant="h2"
                    description="Real-time log events captured from Lambda functions and API requests."
                  >
                    CloudWatch Log Stream Viewer
                  </Header>
                }
              >
                <SpaceBetween size="m">
                  <FormField label="Select Log Group">
                    <Select
                      selectedOption={selectedLogGroup}
                      onChange={({ detail }) => setSelectedLogGroup(detail.selectedOption)}
                      options={logGroups.map((g) => ({ label: g.logGroupName, value: g.logGroupName }))}
                    />
                  </FormField>

                  <TextFilter
                    filteringText={logFilter}
                    filteringPlaceholder="Filter log messages..."
                    onChange={({ detail }) => setLogFilter(detail.filteringText)}
                  />

                  <Table
                    columnDefinitions={[
                      {
                        id: 'time',
                        header: 'Timestamp',
                        cell: (item) => (
                          <span style={{ color: '#879596', fontSize: '11px', whiteSpace: 'nowrap' }}>
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </span>
                        ),
                        width: 120,
                      },
                      {
                        id: 'message',
                        header: 'Log Message',
                        cell: (item) => (
                          <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00e676' }}>
                            {item.message}
                          </div>
                        ),
                      },
                    ]}
                    items={filteredEvents}
                    loading={loadingLogs}
                    empty={<Box textAlign="center">No log events recorded for this group.</Box>}
                  />
                </SpaceBetween>
              </Container>
            ),
          },
        ]}
      />

      {/* Create Alarm Modal */}
      <Modal
        visible={createModalOpen}
        onDismiss={() => setCreateModalOpen(false)}
        header="Create CloudWatch Metric Alarm"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creating} onClick={handleCreateAlarm}>
                Create Alarm
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Alarm Name" description="Unique alarm identifier.">
            <Input
              value={alarmName}
              onChange={({ detail }) => setAlarmName(detail.value)}
              placeholder="HighCPUAlarm"
            />
          </FormField>

          <FormField label="Metric Name">
            <Input
              value={metricName}
              onChange={({ detail }) => setMetricName(detail.value)}
              placeholder="CPUUtilization"
            />
          </FormField>

          <FormField label="Namespace">
            <Input
              value={namespace}
              onChange={({ detail }) => setNamespace(detail.value)}
              placeholder="AWS/EC2"
            />
          </FormField>

          <FormField label="Threshold (Value)">
            <Input
              type="number"
              value={threshold}
              onChange={({ detail }) => setThreshold(detail.value)}
              placeholder="80"
            />
          </FormField>

          <FormField label="Comparison Operator">
            <Select
              selectedOption={comparisonOp}
              onChange={({ detail }) => setComparisonOp(detail.selectedOption as any)}
              options={[
                { label: 'GreaterThanThreshold (>)', value: 'GreaterThanThreshold' },
                { label: 'GreaterThanOrEqualToThreshold (>=)', value: 'GreaterThanOrEqualToThreshold' },
                { label: 'LessThanThreshold (<)', value: 'LessThanThreshold' },
                { label: 'LessThanOrEqualToThreshold (<=)', value: 'LessThanOrEqualToThreshold' },
              ]}
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
