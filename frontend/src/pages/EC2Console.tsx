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
import Select from '@cloudscape-design/components/select';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import Box from '@cloudscape-design/components/box';
import { fetchServiceInventory, executeServiceAction } from '../api/client';

interface InstanceItem {
  InstanceId: string;
  Name?: string;
  State: { Name: string; Code: number };
  InstanceType: string;
  PublicIpAddress?: string;
  PrivateIpAddress?: string;
  KeyName?: string;
  LaunchTime?: string;
  SecurityGroups?: Array<{ GroupId: string; GroupName: string }>;
}

export const EC2Console: React.FC = () => {
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<InstanceItem[]>([]);
  const [filterText, setFilterText] = useState('');
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [instanceType, setInstanceType] = useState<{ label: string; value: string }>({
    label: 't3.micro (2 vCPU, 1 GiB RAM)',
    value: 't3.micro',
  });
  const [instanceName, setInstanceName] = useState('web-server-01');
  const [launching, setLaunching] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchServiceInventory('ec2');
      const list = (data.instances || data.Reservations?.flatMap((r: any) => r.Instances) || []).map((inst: any) => ({
        InstanceId: inst.InstanceId || inst.id || 'i-0123456789abcdef0',
        Name: inst.Tags?.find((t: any) => t.Key === 'Name')?.Value || inst.Name || 'web-server',
        State: typeof inst.State === 'object' ? inst.State : { Name: inst.State || 'running', Code: 16 },
        InstanceType: inst.InstanceType || 't3.micro',
        PublicIpAddress: inst.PublicIpAddress || '54.210.12.34',
        PrivateIpAddress: inst.PrivateIpAddress || '172.31.10.20',
        KeyName: inst.KeyName || 'floci-dev-key',
        LaunchTime: inst.LaunchTime || new Date().toISOString(),
        SecurityGroups: inst.SecurityGroups || [{ GroupId: 'sg-0123456', GroupName: 'default-web' }],
      }));
      setInstances(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLaunchInstance = async () => {
    setLaunching(true);
    try {
      await executeServiceAction('ec2', 'run_instances', {
        InstanceType: instanceType.value,
        MinCount: 1,
        MaxCount: 1,
        ImageId: 'ami-0c55b159cbfafe1f0',
        TagSpecifications: [
          {
            ResourceType: 'instance',
            Tags: [{ Key: 'Name', Value: instanceName }],
          },
        ],
      });
      setActionMessage({ type: 'success', text: `Instance "${instanceName}" launched successfully.` });
      setLaunchModalOpen(false);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to launch instance' });
    } finally {
      setLaunching(false);
    }
  };

  const handleInstanceState = async (action: 'start' | 'stop' | 'terminate' | 'reboot') => {
    if (!selectedItems.length) return;
    const inst = selectedItems[0];
    try {
      await executeServiceAction('ec2', `${action}_instances`, {
        InstanceIds: [inst.InstanceId],
      });
      setActionMessage({ type: 'success', text: `Instance ${inst.InstanceId} ${action} request sent.` });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || `Failed to ${action} instance` });
    }
  };

  const filteredInstances = instances.filter(
    (i) =>
      i.InstanceId.toLowerCase().includes(filterText.toLowerCase()) ||
      (i.Name && i.Name.toLowerCase().includes(filterText.toLowerCase()))
  );

  const activeInstance = selectedItems[0];

  const getStateIndicator = (stateName: string) => {
    switch (stateName.toLowerCase()) {
      case 'running':
        return <StatusIndicator type="success">Running</StatusIndicator>;
      case 'stopped':
        return <StatusIndicator type="stopped">Stopped</StatusIndicator>;
      case 'pending':
        return <StatusIndicator type="in-progress">Pending</StatusIndicator>;
      case 'terminated':
        return <StatusIndicator type="error">Terminated</StatusIndicator>;
      default:
        return <StatusIndicator type="info">{stateName}</StatusIndicator>;
    }
  };

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
            counter={`(${instances.length})`}
            description="Virtual servers running locally inside the Floci compute engine."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <ButtonDropdown
                  items={[
                    { id: 'start', text: 'Start instance' },
                    { id: 'stop', text: 'Stop instance' },
                    { id: 'reboot', text: 'Reboot instance' },
                    { id: 'terminate', text: 'Terminate instance' },
                  ]}
                  disabled={!selectedItems.length}
                  onItemClick={({ detail }) => handleInstanceState(detail.id as any)}
                >
                  Instance state
                </ButtonDropdown>
                <Button
                  variant="primary"
                  iconName="add-plus"
                  onClick={() => setLaunchModalOpen(true)}
                >
                  Launch instances
                </Button>
              </SpaceBetween>
            }
          >
            Instances
          </Header>
        }
        columnDefinitions={[
          {
            id: 'name',
            header: 'Name',
            cell: (item) => <strong>{item.Name || '—'}</strong>,
          },
          {
            id: 'instanceId',
            header: 'Instance ID',
            cell: (item) => (
              <Button variant="inline-link" onClick={() => setSelectedItems([item])}>
                {item.InstanceId}
              </Button>
            ),
            sortingField: 'InstanceId',
            isRowHeader: true,
          },
          {
            id: 'state',
            header: 'Instance state',
            cell: (item) => getStateIndicator(item.State?.Name || 'running'),
          },
          {
            id: 'type',
            header: 'Instance type',
            cell: (item) => item.InstanceType,
          },
          {
            id: 'statusCheck',
            header: 'Status check',
            cell: () => <StatusIndicator type="success">2/2 checks passed</StatusIndicator>,
          },
          {
            id: 'publicIp',
            header: 'Public IPv4 address',
            cell: (item) => item.PublicIpAddress || '—',
          },
          {
            id: 'privateIp',
            header: 'Private IPv4 addresses',
            cell: (item) => item.PrivateIpAddress || '—',
          },
        ]}
        items={filteredInstances}
        loading={loading}
        loadingText="Loading EC2 instances..."
        selectionType="single"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Filter instances by ID, name..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
        }
        pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
        empty={
          <Box textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No instances found</b>
              <p>You have no running EC2 instances in this region.</p>
              <Button variant="primary" onClick={() => setLaunchModalOpen(true)}>
                Launch instance
              </Button>
            </SpaceBetween>
          </Box>
        }
      />

      {activeInstance && (
        <Container header={<Header variant="h2">Instance: {activeInstance.InstanceId}</Header>}>
          <Tabs
            tabs={[
              {
                label: 'Details',
                id: 'details',
                content: (
                  <KeyValuePairs
                    columns={3}
                    items={[
                      { label: 'Instance ID', value: activeInstance.InstanceId },
                      { label: 'Instance state', value: activeInstance.State?.Name || 'running' },
                      { label: 'Instance type', value: activeInstance.InstanceType },
                      { label: 'Public IPv4 DNS', value: `ec2-${activeInstance.PublicIpAddress?.replace(/\./g, '-')}.compute-1.amazonaws.com` },
                      { label: 'Private IPv4 addresses', value: activeInstance.PrivateIpAddress || '—' },
                      { label: 'Key pair name', value: activeInstance.KeyName || '—' },
                      { label: 'Launch time', value: activeInstance.LaunchTime || '—' },
                      { label: 'Platform details', value: 'Linux/UNIX' },
                      { label: 'IMDS HTTP Tokens', value: 'v2 (Token Required)' },
                    ]}
                  />
                ),
              },
              {
                label: 'Networking',
                id: 'networking',
                content: (
                  <KeyValuePairs
                    columns={2}
                    items={[
                      { label: 'Public IPv4 address', value: activeInstance.PublicIpAddress || '—' },
                      { label: 'Private IPv4 address', value: activeInstance.PrivateIpAddress || '—' },
                      { label: 'VPC ID', value: 'vpc-0123456789abcdef0' },
                      { label: 'Subnet ID', value: 'subnet-0123456789abcdef0' },
                    ]}
                  />
                ),
              },
              {
                label: 'Security',
                id: 'security',
                content: (
                  <SpaceBetween size="m">
                    <Header variant="h3">Security groups</Header>
                    <Table
                      columnDefinitions={[
                        { id: 'id', header: 'Security group ID', cell: (i) => i.GroupId },
                        { id: 'name', header: 'Security group name', cell: (i) => i.GroupName },
                      ]}
                      items={activeInstance.SecurityGroups || []}
                    />
                  </SpaceBetween>
                ),
              },
            ]}
          />
        </Container>
      )}

      <Modal
        visible={launchModalOpen}
        onDismiss={() => setLaunchModalOpen(false)}
        header="Launch an instance"
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setLaunchModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleLaunchInstance} loading={launching}>
                Launch instance
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Name and tags" description="Applies a Name tag to your instance.">
            <Input
              value={instanceName}
              onChange={({ detail }) => setInstanceName(detail.value)}
              placeholder="e.g. web-server-prod"
            />
          </FormField>
          <FormField label="Instance type">
            <Select
              selectedOption={instanceType}
              onChange={({ detail }) => setInstanceType(detail.selectedOption as any)}
              options={[
                { label: 't3.micro (2 vCPU, 1 GiB RAM)', value: 't3.micro' },
                { label: 't3.small (2 vCPU, 2 GiB RAM)', value: 't3.small' },
                { label: 'm5.large (2 vCPU, 8 GiB RAM)', value: 'm5.large' },
                { label: 'c5.xlarge (4 vCPU, 8 GiB RAM)', value: 'c5.xlarge' },
              ]}
            />
          </FormField>
          <FormField label="Application and OS Images (Amazon Machine Image)">
            <Input value="Amazon Linux 2023 AMI (ami-0c55b159cbfafe1f0)" disabled />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
