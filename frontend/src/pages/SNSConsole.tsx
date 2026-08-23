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

interface TopicItem {
  TopicArn: string;
  TopicName: string;
  SubscriptionsPending?: number;
  SubscriptionsConfirmed?: number;
}

export const SNSConsole: React.FC = () => {
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<TopicItem[]>([]);
  const [filterText, setFilterText] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [topicName, setTopicName] = useState('');
  const [messageText, setMessageText] = useState('{"alert": "Order Processed"}');
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchServiceInventory('sns');
      const list = (data.topics || data.Topics || []).map((t: any) => {
        const arn = typeof t === 'string' ? t : t.TopicArn || t.arn;
        const name = arn.split(':').pop() || 'topic';
        return {
          TopicArn: arn,
          TopicName: name,
          SubscriptionsPending: t.SubscriptionsPending ?? 0,
          SubscriptionsConfirmed: t.SubscriptionsConfirmed ?? 1,
        };
      });
      setTopics(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTopic = async () => {
    if (!topicName.trim()) return;
    setCreating(true);
    try {
      await executeServiceAction('sns', 'create_topic', { Name: topicName });
      setActionMessage({ type: 'success', text: `Topic "${topicName}" created.` });
      setCreateModalOpen(false);
      setTopicName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create topic' });
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedItems.length) return;
    setPublishing(true);
    try {
      await executeServiceAction('sns', 'publish', {
        TopicArn: selectedItems[0].TopicArn,
        Message: messageText,
      });
      setActionMessage({ type: 'success', text: 'Message published to topic.' });
      setPublishModalOpen(false);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to publish' });
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteTopic = async () => {
    if (!selectedItems.length) return;
    try {
      await executeServiceAction('sns', 'delete_topic', { TopicArn: selectedItems[0].TopicArn });
      setActionMessage({ type: 'success', text: 'Topic deleted.' });
      setSelectedItems([]);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete topic' });
    }
  };

  const filteredTopics = topics.filter((t) =>
    t.TopicName.toLowerCase().includes(filterText.toLowerCase())
  );

  const activeTopic = selectedItems[0];

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
            counter={`(${topics.length})`}
            description="Fully managed pub/sub messaging service for application integration."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <Button
                  disabled={!selectedItems.length}
                  iconName="share"
                  onClick={() => setPublishModalOpen(true)}
                >
                  Publish message
                </Button>
                <Button disabled={!selectedItems.length} onClick={handleDeleteTopic}>
                  Delete topic
                </Button>
                <Button
                  variant="primary"
                  iconName="add-plus"
                  onClick={() => setCreateModalOpen(true)}
                >
                  Create topic
                </Button>
              </SpaceBetween>
            }
          >
            Topics
          </Header>
        }
        columnDefinitions={[
          {
            id: 'name',
            header: 'Topic name',
            cell: (item) => (
              <Button variant="inline-link" onClick={() => setSelectedItems([item])}>
                <strong>{item.TopicName}</strong>
              </Button>
            ),
            sortingField: 'TopicName',
            isRowHeader: true,
          },
          {
            id: 'arn',
            header: 'Topic ARN',
            cell: (item) => item.TopicArn,
          },
          {
            id: 'subscriptions',
            header: 'Subscriptions',
            cell: (item) => `${item.SubscriptionsConfirmed || 0} active`,
          },
        ]}
        items={filteredTopics}
        loading={loading}
        loadingText="Loading SNS topics..."
        selectionType="single"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Filter topics by name..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />
        }
        pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
        empty={
          <Box textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No topics found</b>
              <p>You have not created any SNS topics yet.</p>
              <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
                Create topic
              </Button>
            </SpaceBetween>
          </Box>
        }
      />

      {activeTopic && (
        <Container header={<Header variant="h2">Topic: {activeTopic.TopicName}</Header>}>
          <Tabs
            tabs={[
              {
                label: 'Details',
                id: 'details',
                content: (
                  <KeyValuePairs
                    columns={3}
                    items={[
                      { label: 'Topic ARN', value: activeTopic.TopicArn },
                      { label: 'Topic Name', value: activeTopic.TopicName },
                      { label: 'Type', value: 'Standard' },
                      { label: 'Display name', value: activeTopic.TopicName },
                      { label: 'Encryption', value: 'Server-side encryption enabled (SSE)' },
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
        header="Create SNS topic"
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateTopic} loading={creating}>
                Create topic
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Topic name" description="Specify a name for your SNS notification topic.">
            <Input
              value={topicName}
              onChange={({ detail }) => setTopicName(detail.value)}
              placeholder="e.g. system-alerts"
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      <Modal
        visible={publishModalOpen}
        onDismiss={() => setPublishModalOpen(false)}
        header={`Publish message to ${activeTopic?.TopicName || 'topic'}`}
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setPublishModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handlePublish} loading={publishing}>
                Publish
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Message text">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
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
