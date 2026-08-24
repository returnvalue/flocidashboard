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

interface KMSConsoleProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export const KMSConsole: React.FC<KMSConsoleProps> = ({ activeTab, onTabChange }) => {
  const [data, setData] = useState<any>({ keys: [], aliases: [] });
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<any[]>([]);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedTabId, setSelectedTabId] = useState(activeTab || 'keys');

  useEffect(() => {
    if (activeTab) {
      setSelectedTabId(activeTab);
    }
  }, [activeTab]);

  // Create Key Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [keySpec, setKeySpec] = useState({ label: 'SYMMETRIC_DEFAULT', value: 'SYMMETRIC_DEFAULT' });
  const [keyUsage, setKeyUsage] = useState({ label: 'ENCRYPT_DECRYPT', value: 'ENCRYPT_DECRYPT' });
  const [aliasName, setAliasName] = useState('');
  const [creating, setCreating] = useState(false);

  // Crypto Workbench
  const [cryptoKeyId, setCryptoKeyId] = useState('');
  const [plaintextInput, setPlaintextInput] = useState('Hello Floci KMS');
  const [ciphertextOutput, setCiphertextOutput] = useState('');
  const [decryptInput, setDecryptInput] = useState('');
  const [decryptedOutput, setDecryptedOutput] = useState('');
  const [encrypting, setEncrypting] = useState(false);
  const [decrypting, setDecrypting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchInventory('kms');
      setData(res || { keys: [], aliases: [] });
      if (res.keys?.length > 0 && !cryptoKeyId) {
        setCryptoKeyId(res.keys[0].KeyId || res.keys[0].key_id);
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

  const handleCreateKey = async () => {
    setCreating(true);
    setActionMessage(null);
    try {
      const res = await executeServiceAction('kms', 'create_key', {
        description,
        key_spec: keySpec.value,
        key_usage: keyUsage.value,
      });
      const newKeyId = res?.KeyMetadata?.KeyId || res?.key?.KeyId;
      if (aliasName.trim() && newKeyId) {
        const fullAlias = aliasName.startsWith('alias/') ? aliasName.trim() : `alias/${aliasName.trim()}`;
        await executeServiceAction('kms', 'create_alias', {
          alias_name: fullAlias,
          target_key_id: newKeyId,
        });
      }
      setActionMessage({ type: 'success', text: `KMS Key created successfully${newKeyId ? `: ${newKeyId}` : ''}` });
      setCreateModalOpen(false);
      setDescription('');
      setAliasName('');
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create KMS key' });
    } finally {
      setCreating(false);
    }
  };

  const handleEncrypt = async () => {
    if (!cryptoKeyId || !plaintextInput) return;
    setEncrypting(true);
    try {
      const res = await executeServiceAction('kms', 'encrypt', {
        key_id: cryptoKeyId,
        plaintext: plaintextInput,
      });
      const ct = res.CiphertextBlob || res.ciphertext || '';
      setCiphertextOutput(ct);
      setDecryptInput(ct);
      setActionMessage({ type: 'success', text: 'Plaintext encrypted successfully' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Encryption failed' });
    } finally {
      setEncrypting(false);
    }
  };

  const handleDecrypt = async () => {
    if (!decryptInput) return;
    setDecrypting(true);
    try {
      const res = await executeServiceAction('kms', 'decrypt', {
        ciphertext: decryptInput,
      });
      setDecryptedOutput(res.Plaintext || res.plaintext || '');
      setActionMessage({ type: 'success', text: 'Ciphertext decrypted successfully' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Decryption failed' });
    } finally {
      setDecrypting(false);
    }
  };

  const keysList = (data.keys || []).map((k: any) => {
    const matchingAlias = (data.aliases || []).find((a: any) => (a.TargetKeyId || a.target_key_id) === (k.KeyId || k.key_id));
    return {
      ...k,
      KeyId: k.KeyId || k.key_id,
      Arn: k.Arn || k.arn,
      Description: k.Description || k.description || '—',
      KeySpec: k.KeySpec || k.key_spec || 'SYMMETRIC_DEFAULT',
      KeyUsage: k.KeyUsage || k.key_usage || 'ENCRYPT_DECRYPT',
      Enabled: k.Enabled !== false,
      AliasName: matchingAlias ? (matchingAlias.AliasName || matchingAlias.alias_name) : '—',
    };
  });

  const filteredKeys = keysList.filter((k: any) => {
    const text = `${k.KeyId} ${k.AliasName} ${k.Description} ${k.Arn}`.toLowerCase();
    return text.includes(filterText.toLowerCase());
  });

  return (
    <SpaceBetween size="l">
      {/* Header */}
      <Container
        header={
          <Header
            variant="h1"
            description="Create and manage cryptographic keys and control their use across local mock AWS services."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadData} loading={loading}>
                  Refresh
                </Button>
                <Button variant="primary" iconName="add-plus" onClick={() => setCreateModalOpen(true)}>
                  Create KMS Key
                </Button>
              </SpaceBetween>
            }
          >
            AWS Key Management Service (KMS)
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
            <Box variant="awsui-key-label">Customer Managed Keys</Box>
            <Box variant="h1" color="text-status-info">
              {keysList.length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Aliases Defined</Box>
            <Box variant="h1" color="text-status-info">
              {(data.aliases || []).length}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Status</Box>
            <Box variant="h2" color="text-status-info">
              <StatusIndicator type="success">KMS Engine Active</StatusIndicator>
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
            label: `KMS Keys (${keysList.length})`,
            id: 'keys',
            content: (
              <Container
                header={
                  <Header
                    variant="h2"
                    description="Customer-managed encryption keys provisioned in Floci."
                  >
                    KMS Key Inventory
                  </Header>
                }
              >
                <SpaceBetween size="m">
                  <TextFilter
                    filteringText={filterText}
                    filteringPlaceholder="Filter keys by ID, alias, description..."
                    onChange={({ detail }) => setFilterText(detail.filteringText)}
                  />

                  <Table
                    columnDefinitions={[
                      {
                        id: 'alias',
                        header: 'Alias / Name',
                        cell: (item) => (
                          <div>
                            <strong>{item.AliasName !== '—' ? item.AliasName : item.KeyId}</strong>
                            {item.AliasName !== '—' && (
                              <div style={{ color: '#879596', fontSize: '11px' }}>{item.KeyId}</div>
                            )}
                          </div>
                        ),
                      },
                      {
                        id: 'description',
                        header: 'Description',
                        cell: (item) => item.Description,
                      },
                      {
                        id: 'spec',
                        header: 'Key Spec',
                        cell: (item) => <Badge color="grey">{item.KeySpec}</Badge>,
                        width: 180,
                      },
                      {
                        id: 'usage',
                        header: 'Key Usage',
                        cell: (item) => <Badge color="blue">{item.KeyUsage}</Badge>,
                        width: 160,
                      },
                      {
                        id: 'status',
                        header: 'State',
                        cell: (item) => (
                          <StatusIndicator type={item.Enabled ? 'success' : 'stopped'}>
                            {item.Enabled ? 'Enabled' : 'Disabled'}
                          </StatusIndicator>
                        ),
                        width: 120,
                      },
                    ]}
                    items={filteredKeys}
                    selectionType="single"
                    selectedItems={selectedKeys}
                    onSelectionChange={({ detail }) => setSelectedKeys(detail.selectedItems)}
                    empty={
                      <Box textAlign="center" color="inherit">
                        <b>No KMS keys found</b>
                        <p>Create a KMS key to start encrypting and decrypting data.</p>
                      </Box>
                    }
                  />
                </SpaceBetween>
              </Container>
            ),
          },
          {
            label: 'Encrypt & Decrypt Playground',
            id: 'crypto',
            content: (
              <Container
                header={
                  <Header
                    variant="h2"
                    description="Interactive cryptographic test workbench for symmetrical KMS keys."
                  >
                    KMS Cryptographic Workbench
                  </Header>
                }
              >
                <Grid gridDefinition={[{ colspan: { default: 12, m: 6 } }, { colspan: { default: 12, m: 6 } }]}>
                  {/* Encrypt Card */}
                  <Container header={<Header variant="h3">Encrypt Plaintext</Header>}>
                    <SpaceBetween size="m">
                      <FormField label="KMS Key ID / Alias">
                        <Input
                          value={cryptoKeyId}
                          onChange={({ detail }) => setCryptoKeyId(detail.value)}
                          placeholder="Key ID or alias/my-key"
                        />
                      </FormField>

                      <FormField label="Plaintext Data">
                        <Textarea
                          rows={3}
                          value={plaintextInput}
                          onChange={({ detail }) => setPlaintextInput(detail.value)}
                          placeholder="Enter message to encrypt..."
                        />
                      </FormField>

                      <Button variant="primary" loading={encrypting} onClick={handleEncrypt}>
                        Encrypt with KMS
                      </Button>

                      {ciphertextOutput && (
                        <FormField label="Ciphertext (Base64 Blob)">
                          <CodeSnippet language="cli" code={ciphertextOutput} />
                        </FormField>
                      )}
                    </SpaceBetween>
                  </Container>

                  {/* Decrypt Card */}
                  <Container header={<Header variant="h3">Decrypt Ciphertext</Header>}>
                    <SpaceBetween size="m">
                      <FormField label="Ciphertext Blob">
                        <Textarea
                          rows={4}
                          value={decryptInput}
                          onChange={({ detail }) => setDecryptInput(detail.value)}
                          placeholder="Paste ciphertext blob..."
                        />
                      </FormField>

                      <Button variant="primary" loading={decrypting} onClick={handleDecrypt}>
                        Decrypt with KMS
                      </Button>

                      {decryptedOutput && (
                        <FormField label="Decrypted Plaintext">
                          <CodeSnippet language="cli" code={decryptedOutput} />
                        </FormField>
                      )}
                    </SpaceBetween>
                  </Container>
                </Grid>
              </Container>
            ),
          },
        ]}
      />

      {/* Create Key Modal */}
      <Modal
        visible={createModalOpen}
        onDismiss={() => setCreateModalOpen(false)}
        header="Create Customer Managed Key"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={creating} onClick={handleCreateKey}>
                Create Key
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Key Description" description="Optional description for the key.">
            <Input
              value={description}
              onChange={({ detail }) => setDescription(detail.value)}
              placeholder="Primary app encryption key"
            />
          </FormField>

          <FormField label="Key Alias (Optional)" description="e.g. alias/app-key or app-key">
            <Input
              value={aliasName}
              onChange={({ detail }) => setAliasName(detail.value)}
              placeholder="alias/app-key"
            />
          </FormField>

          <FormField label="Key Spec">
            <Select
              selectedOption={keySpec}
              onChange={({ detail }) => setKeySpec(detail.selectedOption as any)}
              options={[
                { label: 'SYMMETRIC_DEFAULT (AES-256-GCM)', value: 'SYMMETRIC_DEFAULT' },
                { label: 'RSA_2048', value: 'RSA_2048' },
                { label: 'RSA_4096', value: 'RSA_4096' },
                { label: 'ECC_NIST_P256', value: 'ECC_NIST_P256' },
              ]}
            />
          </FormField>

          <FormField label="Key Usage">
            <Select
              selectedOption={keyUsage}
              onChange={({ detail }) => setKeyUsage(detail.selectedOption as any)}
              options={[
                { label: 'ENCRYPT_DECRYPT', value: 'ENCRYPT_DECRYPT' },
                { label: 'SIGN_VERIFY', value: 'SIGN_VERIFY' },
                { label: 'GENERATE_VERIFY_MAC', value: 'GENERATE_VERIFY_MAC' },
              ]}
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
