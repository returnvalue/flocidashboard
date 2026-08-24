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
  putSsmParameter,
  getSsmParameterValue,
  deleteSsmParameter,
} from '../api/client';

export const SSMConsole: React.FC = () => {
  const [data, setData] = useState<any>({ parameters: [] });
  const [loading, setLoading] = useState(true);
  const [selectedParams, setSelectedParams] = useState<any[]>([]);
  const [filterText, setFilterText] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create Parameter Modal
  const [createParamOpen, setCreateParamOpen] = useState(false);
  const [paramName, setParamName] = useState('');
  const [paramType, setParamType] = useState({ label: 'String', value: 'String' });
  const [paramValue, setParamValue] = useState('');
  const [paramDescription, setParamDescription] = useState('');
  const [creatingParam, setCreatingParam] = useState(false);

  // Decryption Revealer State
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchServiceInventory('ssm');
      const list = (res.parameters || res.Parameters || []).map((p: any) => ({
        ...p,
        Name: p.Name || p.name,
        Type: p.Type || p.type || 'String',
        Version: p.Version || p.version || 1,
        LastModifiedDate: p.LastModifiedDate || p.last_modified || new Date().toISOString().split('T')[0],
        Description: p.Description || p.description || '—',
        Value: p.Value || p.value,
      }));
      setData({ parameters: list });
      if (list.length > 0 && selectedParams.length === 0) {
        setSelectedParams([list[0]]);
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

  const activeParam = selectedParams[0];

  useEffect(() => {
    setRevealedValue(null);
  }, [activeParam?.Name]);

  const handleCreateParam = async () => {
    if (!paramName.trim() || !paramValue.trim()) return;
    setCreatingParam(true);
    setActionMessage(null);
    try {
      await putSsmParameter(
        paramName.trim(),
        paramValue.trim(),
        paramType.value as any,
        paramDescription.trim()
      );
      setActionMessage({ type: 'success', text: `Parameter "${paramName.trim()}" created successfully.` });
      setCreateParamOpen(false);
      setParamName('');
      setParamValue('');
      setParamDescription('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create parameter' });
    } finally {
      setCreatingParam(false);
    }
  };

  const handleDeleteParam = async () => {
    if (!activeParam) return;
    try {
      await deleteSsmParameter(activeParam.Name);
      setActionMessage({ type: 'success', text: `Parameter "${activeParam.Name}" deleted.` });
      setSelectedParams([]);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete parameter' });
    }
  };

  const handleRevealDecrypted = async () => {
    if (!activeParam) return;
    setRevealing(true);
    try {
      const res = await getSsmParameterValue(activeParam.Name, true);
      setRevealedValue(res.parameter?.Value || res.Value || res.value || 'Decrypted');
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to decrypt parameter' });
    } finally {
      setRevealing(false);
    }
  };

  const paramsList = data.parameters || [];

  const filteredParams = paramsList.filter((p: any) =>
    `${p.Name} ${p.Type} ${p.Description}`.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <SpaceBetween size="l">
      {/* Header */}
      <Container
        header={
          <Header
            variant="h1"
            description="Secure hierarchical storage for configuration data management and secrets management."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <Button disabled={!activeParam} onClick={handleDeleteParam}>
                  Delete Parameter
                </Button>
                <Button variant="primary" iconName="add-plus" onClick={() => setCreateParamOpen(true)}>
                  Create Parameter
                </Button>
              </SpaceBetween>
            }
          >
            AWS Systems Manager (SSM) Parameter Store
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
            <Box variant="awsui-key-label">Total Parameters</Box>
            <Box variant="h1" color="text-status-info">
              {paramsList.length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">SecureString (Encrypted)</Box>
            <Box variant="h1" color="text-status-info">
              {paramsList.filter((p: any) => p.Type === 'SecureString').length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">KMS Integration</Box>
            <Box variant="h2" color="text-status-info">
              <StatusIndicator type="success">KMS Ready</StatusIndicator>
            </Box>
          </Box>
        </Grid>
      </Container>

      {/* Parameters List */}
      <Container
        header={
          <Header
            variant="h2"
            description="Hierarchical configuration parameters stored in SSM."
          >
            Parameters ({paramsList.length})
          </Header>
        }
      >
        <SpaceBetween size="m">
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Filter parameters by path prefix or name..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />

          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: 'Parameter Name / Path',
                cell: (item) => <strong>{item.Name}</strong>,
              },
              {
                id: 'type',
                header: 'Type',
                cell: (item) => (
                  <Badge color={item.Type === 'SecureString' ? 'green' : 'blue'}>
                    {item.Type}
                  </Badge>
                ),
                width: 140,
              },
              {
                id: 'version',
                header: 'Version',
                cell: (item) => `v${item.Version}`,
                width: 100,
              },
              {
                id: 'modified',
                header: 'Last Modified',
                cell: (item) => (
                  <span style={{ color: '#879596', fontSize: '11px' }}>
                    {item.LastModifiedDate ? new Date(item.LastModifiedDate).toLocaleDateString() : 'Today'}
                  </span>
                ),
                width: 140,
              },
              {
                id: 'description',
                header: 'Description',
                cell: (item) => item.Description,
              },
            ]}
            items={filteredParams}
            selectionType="single"
            selectedItems={selectedParams}
            onSelectionChange={({ detail }) => setSelectedParams(detail.selectedItems)}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No parameters found</b>
                <p>Create an SSM parameter to store hierarchical configuration or secrets.</p>
              </Box>
            }
          />
        </SpaceBetween>
      </Container>

      {/* Active Parameter Inspector */}
      {activeParam && (
        <Container
          header={
            <Header
              variant="h2"
              description={`Inspecting ${activeParam.Name}`}
              actions={
                activeParam.Type === 'SecureString' && (
                  <Button loading={revealing} onClick={handleRevealDecrypted}>
                    {revealedValue ? 'Re-decrypt with KMS' : 'Reveal Decrypted Value'}
                  </Button>
                )
              }
            >
              Parameter: {activeParam.Name}
            </Header>
          }
        >
          <Tabs
            tabs={[
              {
                label: 'Value & Decryption',
                id: 'val',
                content: (
                  <SpaceBetween size="m">
                    <Container header={<Header variant="h3">Stored Value</Header>}>
                      {activeParam.Type === 'SecureString' ? (
                        revealedValue ? (
                          <SpaceBetween size="s">
                            <div style={{ fontFamily: 'monospace', fontSize: '13px', background: '#0f1b2a', padding: '12px', borderRadius: '4px', color: '#58a6ff' }}>
                              {revealedValue}
                            </div>
                            <Button
                              iconName="copy"
                              onClick={() => {
                                navigator.clipboard.writeText(revealedValue);
                              }}
                            >
                              Copy Value
                            </Button>
                          </SpaceBetween>
                        ) : (
                          <Box color="text-status-inactive">
                            ●●●●●●●●●●●● (Encrypted with KMS key). Click "Reveal Decrypted Value" above to decrypt.
                          </Box>
                        )
                      ) : (
                        <div style={{ fontFamily: 'monospace', fontSize: '13px', background: '#0f1b2a', padding: '12px', borderRadius: '4px', color: '#58a6ff' }}>
                          {activeParam.Value || 'Active value'}
                        </div>
                      )}
                    </Container>

                    <KeyValuePairs
                      columns={3}
                      items={[
                        { label: 'Name', value: activeParam.Name },
                        { label: 'Type', value: activeParam.Type },
                        { label: 'Version', value: `v${activeParam.Version}` },
                        { label: 'KMS Key ID', value: activeParam.Type === 'SecureString' ? 'alias/aws/ssm' : 'None' },
                        { label: 'Tier', value: 'Standard' },
                        { label: 'Data Type', value: 'text' },
                      ]}
                    />
                  </SpaceBetween>
                ),
              },
            ]}
          />
        </Container>
      )}

      {/* Create Parameter Modal */}
      <Modal
        visible={createParamOpen}
        onDismiss={() => setCreateParamOpen(false)}
        header="Create Parameter"
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateParamOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creatingParam} onClick={handleCreateParam}>
                Save Parameter
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField
            label="Name / Path"
            description="Use hierarchical paths like /config/prod/db_url or /secrets/api_key."
          >
            <Input
              value={paramName}
              onChange={({ detail }) => setParamName(detail.value)}
              placeholder="/config/prod/database_url"
            />
          </FormField>

          <FormField label="Type">
            <Select
              selectedOption={paramType}
              onChange={({ detail }) => setParamType(detail.selectedOption as any)}
              options={[
                { label: 'String (Plaintext configuration)', value: 'String' },
                { label: 'StringList (Comma-separated list)', value: 'StringList' },
                { label: 'SecureString (Encrypted with KMS)', value: 'SecureString' },
              ]}
            />
          </FormField>

          <FormField label="Value">
            <Textarea
              rows={4}
              value={paramValue}
              onChange={({ detail }) => setParamValue(detail.value)}
              placeholder="postgres://user:secret@localhost:5432/mydb"
            />
          </FormField>

          <FormField label="Description (Optional)">
            <Input
              value={paramDescription}
              onChange={({ detail }) => setParamDescription(detail.value)}
              placeholder="Database connection string for production services"
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
