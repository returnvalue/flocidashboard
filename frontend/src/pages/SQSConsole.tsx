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

interface QueueItem {
  QueueName: string;
  QueueUrl: string;
  ApproximateNumberOfMessages?: number;
  CreatedTimestamp?: string;
  Type?: string;
}

export const SQSConsole: React.FC = () => {
  const [queues, setQueues] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<QueueItem[]>([]);
  const [filterText, setFilterText] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [queueName, setQueueName] = useState('');
  const [messageBody, setMessageBody] = useState('{"hello": "world"}');
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchServiceInventory('sqs');
      const list = (data.queues || data.QueueUrls || []).map((q: any) => {
        const url = typeof q === 'string' ? q : q.QueueUrl || q.url;
        const name = typeof q === 'string' ? q.split('/').pop() || q : q.QueueName || q.name;
        return {
          QueueName: name,
          QueueUrl: url,
          ApproximateNumberOfMessages: q.ApproximateNumberOfMessages ?? 0,
          CreatedTimestamp: q.CreatedTimestamp || new Date().toISOString().split('T')[0],
          Type: name.endsWith('.fifo') ? 'FIFO' : 'Standard',
        };
      });
      setQueues(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateQueue = async () => {
    if (!queueName.trim()) return;
    setCreating(true);
    try {
      await executeServiceAction('sqs', 'create_queue', { QueueName: queueName });
      setActionMessage({ type: 'success', text: `Queue "${queueName}" created.` });
      setCreateModalOpen(false);
      setQueueName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create queue' });
    } finally {
      setCreating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedItems.length) return;
    setSending(true);
    try {
      await executeServiceAction('sqs', 'send_message', {
        QueueUrl: selectedItems[0].QueueUrl,
        MessageBody: messageBody,
      });
      setActionMessage({ type: 'success', text: 'Message sent successfully.' });
      setSendModalOpen(false);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to send message' });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteQueue = async () => {
    if (!selectedItems.length) return;
    try {
      await executeServiceAction('sqs', 'delete_queue', { QueueUrl: selectedItems[0].QueueUrl });
      setActionMessage({ type: 'success', text: 'Queue deleted.' });
      setSelectedItems([]);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete queue' });
    }
  };

  const filteredQueues = queues.filter((q) =>
    q.QueueName.toLowerCase().includes(filterText.toLowerCase())
  );

  const activeQueue = selectedItems[0];

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
            counter={`(${queues.length})`}
            description="Fully managed message queues for decoupling and scaling microservices."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <Button
                  disabled={!selectedItems.length}
                  iconName="envelope"
                  onClick={() => setSendModalOpen(true)}
                >
                  Send message
                </Button>
                <Button disabled={!selectedItems.length} onClick={handleDeleteQueue}>
                  Delete queue
                </Button>
                <Button
                  variant="primary"
                  iconName="add-plus"
                  onClick={() => setCreateModalOpen(true)}
                >
                  Create queue
                </Button>
              </SpaceBetween>
            }
          >
            Queues
          </Header>
        }
        columnDefinitions={[
          {
            id: 'name',
            header: 'Name',
            cell: (item) => (
              <Button variant="inline-link" onClick={() => setSelectedItems([item])}>
                <strong>{item.QueueName}</strong>
              </Button>
            ),
            sortingField: 'QueueName',
            isRowHeader: true,
          },
          {
            id: 'type',
            header: 'Type',
            cell: (item) => <StatusIndicator type="info">{item.Type || 'Standard'}</StatusIndicator>,
          },
          {
            id: 'messages',
            header: 'Messages available',
            cell: (item) => item.ApproximateNumberOfMessages ?? 0,
          },
          {
            id: 'created',
            header: 'Created',
            cell: (item) => item.CreatedTimestamp,
          },
        ]}
        items={filteredQueues}
        loading={loading}
        loadingText="Loading SQS queues..."
        selectionType="single"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Filter queues by name..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
        }
        pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
        empty={
          <Box textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No queues found</b>
              <p>You have not created any SQS queues yet.</p>
              <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
                Create queue
              </Button>
            </SpaceBetween>
          </Box>
        }
      />

      {activeQueue && (
        <Container header={<Header variant="h2">Queue: {activeQueue.QueueName}</Header>}>
          <Tabs
            tabs={[
              {
                label: 'Details',
                id: 'details',
                content: (
                  <KeyValuePairs
                    columns={3}
                    items={[
                      { label: 'Queue URL', value: activeQueue.QueueUrl },
                      { label: 'Queue ARN', value: `arn:aws:sqs:us-east-1:000000000000:${activeQueue.QueueName}` },
                      { label: 'Type', value: activeQueue.Type || 'Standard' },
                      { label: 'Default visibility timeout', value: '30 seconds' },
                      { label: 'Message retention period', value: '4 days' },
                      { label: 'Maximum message size', value: '256 KB' },
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
        header="Create SQS queue"
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateQueue} loading={creating}>
                Create queue
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Queue name" description="Enter a queue name (append .fifo for FIFO queues).">
            <Input
              value={queueName}
              onChange={({ detail }) => setQueueName(detail.value)}
              placeholder="e.g. orders-queue"
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      <Modal
        visible={sendModalOpen}
        onDismiss={() => setSendModalOpen(false)}
        header="Send message to SQS queue"
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setSendModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSendMessage} loading={sending}>
                Send message
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Message body">
            <textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
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
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
