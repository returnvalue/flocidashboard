import React, { useState } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import FormField from '@cloudscape-design/components/form-field';
import Textarea from '@cloudscape-design/components/textarea';
import Modal from '@cloudscape-design/components/modal';
import Box from '@cloudscape-design/components/box';
import Badge from '@cloudscape-design/components/badge';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Alert from '@cloudscape-design/components/alert';
import { runCliCommand } from '../api/client';
import { CodeSnippet } from '../components/CodeSnippet';

const QUICK_COMMANDS = [
  { label: 'S3: List Buckets', cmd: 'aws s3 ls' },
  { label: 'IAM: List Users', cmd: 'aws iam list-users' },
  { label: 'SQS: List Queues', cmd: 'aws sqs list-queues' },
  { label: 'DynamoDB: List Tables', cmd: 'aws dynamodb list-tables' },
  { label: 'Lambda: List Functions', cmd: 'aws lambda list-functions' },
  { label: 'EC2: Describe Instances', cmd: 'aws ec2 describe-instances' },
  { label: 'SNS: List Topics', cmd: 'aws sns list-topics' },
  { label: 'RDS: Describe DB Instances', cmd: 'aws rds describe-db-instances' },
];

export const CliConsole: React.FC = () => {
  const [command, setCommand] = useState('aws s3 ls');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDestructiveModal, setShowDestructiveModal] = useState(false);
  const [destructiveWarning, setDestructiveWarning] = useState('');

  const executeCommand = async (confirmed: boolean = false) => {
    if (!command.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const res = await runCliCommand(command.trim(), confirmed);
      if (res.confirmation_required) {
        setDestructiveWarning(res.destructive_warning || 'This command may modify or delete resources.');
        setShowDestructiveModal(true);
        setRunning(false);
        return;
      }
      setResult(res);
      setShowDestructiveModal(false);
    } catch (err: any) {
      setError(err.message || 'Execution error');
    } finally {
      setRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      executeCommand(false);
    }
  };

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h1"
            description="Execute real AWS CLI v2 commands against your local Floci environment directly from the browser."
          >
            Interactive AWS CLI Terminal Sandbox
          </Header>
        }
      >
        <SpaceBetween size="m">
          {/* Quick Presets */}
          <FormField label="Quick Command Presets">
            <SpaceBetween direction="horizontal" size="xs">
              {QUICK_COMMANDS.map((item) => (
                <Button
                  key={item.cmd}
                  variant="normal"
                  onClick={() => {
                    setCommand(item.cmd);
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </SpaceBetween>
          </FormField>

          {/* Command Input Area */}
          <FormField
            label="AWS CLI Command"
            description="Enter any valid AWS CLI command. Use Ctrl+Enter or Cmd+Enter to run."
          >
            <div onKeyDown={handleKeyDown}>
              <Textarea
                value={command}
                onChange={({ detail }) => setCommand(detail.value)}
                placeholder="aws s3 ls"
                rows={3}
              />
            </div>
          </FormField>

          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="primary"
              iconName="caret-right-filled"
              loading={running}
              onClick={() => executeCommand(false)}
            >
              Run AWS CLI Command
            </Button>
            <Button
              onClick={() => {
                setResult(null);
                setError(null);
              }}
            >
              Clear Output
            </Button>
          </SpaceBetween>

          {error && (
            <Alert type="error" dismissible onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Execution Output Panel */}
          {result && (
            <Container
              header={
                <Header
                  variant="h3"
                  actions={
                    <SpaceBetween direction="horizontal" size="xs">
                      <StatusIndicator type={result.status === 0 ? 'success' : 'error'}>
                        Exit Code {result.status}
                      </StatusIndicator>
                      {result.elapsed_ms != null && (
                        <Badge color="grey">{result.elapsed_ms}ms</Badge>
                      )}
                    </SpaceBetween>
                  }
                >
                  Execution Output
                </Header>
              }
            >
              <SpaceBetween size="s">
                <div style={{ color: '#879596', fontSize: '12px' }}>
                  <strong>Executed Command: </strong> <code>{result.command || command}</code>
                </div>
                <CodeSnippet
                  language={result.stdout && result.stdout.trim().startsWith('{') ? 'json' : 'cli'}
                  code={result.stdout || result.stderr || '(No output returned)'}
                />
              </SpaceBetween>
            </Container>
          )}
        </SpaceBetween>
      </Container>

      {/* Destructive Command Warning Modal */}
      <Modal
        visible={showDestructiveModal}
        onDismiss={() => setShowDestructiveModal(false)}
        header="Confirm Potentially Destructive Command"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowDestructiveModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={running} onClick={() => executeCommand(true)}>
                Confirm & Run
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Alert type="warning">
          <strong>Warning: </strong> {destructiveWarning || 'This command is marked as potentially destructive.'}
        </Alert>
        <p style={{ marginTop: '12px' }}>
          Are you sure you want to execute: <code>{command}</code>?
        </p>
      </Modal>
    </SpaceBetween>
  );
};
