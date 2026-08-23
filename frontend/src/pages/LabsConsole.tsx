import React, { useState, useEffect } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ProgressBar from '@cloudscape-design/components/progress-bar';
import Tabs from '@cloudscape-design/components/tabs';
import Select from '@cloudscape-design/components/select';
import FormField from '@cloudscape-design/components/form-field';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import { fetchLabs, runLabStep, resetLab } from '../api/client';
import { LabDefinition, LabStep } from '../types';

export const LabsConsole: React.FC = () => {
  const [labs, setLabs] = useState<LabDefinition[]>([]);
  const [selectedLabKey, setSelectedLabKey] = useState<string>('create-bucket');
  const [loading, setLoading] = useState(true);
  const [runningStepKey, setRunningStepKey] = useState<string | null>(null);
  const [activeSdk, setActiveSdk] = useState<'cli' | 'boto3' | 'terraform'>('cli');
  const [stepOutputs, setStepOutputs] = useState<Record<string, { status: string; body: string }>>({});
  const [stepCompleted, setStepCompleted] = useState<Record<string, boolean>>({});

  const loadLabs = async () => {
    setLoading(true);
    try {
      const list = await fetchLabs();
      setLabs(list);
      if (list.length > 0 && !list.find((l) => l.key === selectedLabKey)) {
        setSelectedLabKey(list[0].key);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLabs();
  }, []);

  const activeLab = labs.find((l) => l.key === selectedLabKey) || labs[0];

  const handleRunStep = async (step: LabStep) => {
    setRunningStepKey(step.key);
    try {
      const data = await runLabStep(activeLab.service, activeLab.key, step.key);
      setStepOutputs((prev) => ({
        ...prev,
        [step.key]: {
          status: data.verified ? 'Verified' : 'Succeeded',
          body: data.stdout || JSON.stringify(data.json || data, null, 2),
        },
      }));
      setStepCompleted((prev) => ({
        ...prev,
        [step.key]: Boolean(data.verified),
      }));
    } catch (err: any) {
      setStepOutputs((prev) => ({
        ...prev,
        [step.key]: {
          status: 'Failed',
          body: err.message || 'Execution error',
        },
      }));
    } finally {
      setRunningStepKey(null);
    }
  };

  const handleResetLab = async () => {
    if (!activeLab) return;
    try {
      await resetLab(activeLab.service, activeLab.key);
      setStepCompleted({});
      setStepOutputs({});
      await loadLabs();
    } catch (err) {
      console.error(err);
    }
  };

  const completedCount = activeLab?.steps?.filter((s) => stepCompleted[s.key] || s.status?.verified).length || 0;
  const totalCount = activeLab?.steps?.length || 1;
  const percentComplete = Math.round((completedCount / totalCount) * 100);

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h1"
            description="Hands-on interactive cloud architecture lessons running directly against Floci."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadLabs} loading={loading}>
                  Refresh labs
                </Button>
                <Button onClick={handleResetLab}>Reset lab</Button>
              </SpaceBetween>
            }
          >
            Workflow Labs (63 Curated Lessons)
          </Header>
        }
      >
        <SpaceBetween size="m">
          <FormField label="Select Lab Lesson">
            <Select
              selectedOption={{
                label: activeLab ? `${activeLab.service.toUpperCase()}: ${activeLab.title}` : 'Select a lab...',
                value: activeLab?.key || '',
              }}
              onChange={({ detail }) => setSelectedLabKey(detail.selectedOption.value || '')}
              options={labs.map((l) => ({
                label: `[${l.service.toUpperCase()}] ${l.title}`,
                value: l.key,
              }))}
            />
          </FormField>

          <ProgressBar
            value={percentComplete}
            label="Lab Progress"
            description={`${completedCount} of ${totalCount} steps complete (${percentComplete}%)`}
            status={percentComplete === 100 ? 'success' : 'in-progress'}
          />
        </SpaceBetween>
      </Container>

      {activeLab && (
        <SpaceBetween size="m">
          <Container header={<Header variant="h2">{activeLab.title}</Header>}>
            <p>{activeLab.description}</p>
          </Container>

          {activeLab.steps?.map((step, idx) => {
            const isDone = stepCompleted[step.key] || step.status?.verified;
            const output = stepOutputs[step.key];

            return (
              <Container
                key={step.key}
                header={
                  <Header
                    variant="h3"
                    actions={
                      <Button
                        variant={isDone ? 'normal' : 'primary'}
                        iconName={isDone ? 'status-positive' : undefined}
                        onClick={() => handleRunStep(step)}
                        loading={runningStepKey === step.key}
                        disabled={isDone}
                      >
                        {isDone ? '✓ Step Complete' : 'Run step'}
                      </Button>
                    }
                  >
                    Step {idx + 1}: {step.title}
                  </Header>
                }
              >
                <SpaceBetween size="m">
                  <Tabs
                    activeTabId={activeSdk}
                    onChange={({ detail }) => setActiveSdk(detail.activeTabId as any)}
                    tabs={[
                      {
                        label: 'AWS CLI',
                        id: 'cli',
                        content: (
                          <pre style={{ background: '#161e2e', color: '#569cd6', padding: '12px', borderRadius: '4px', overflowX: 'auto' }}>
                            <code>{step.command}</code>
                          </pre>
                        ),
                      },
                      {
                        label: 'Python (boto3)',
                        id: 'boto3',
                        content: (
                          <pre style={{ background: '#161e2e', color: '#4ec9b0', padding: '12px', borderRadius: '4px', overflowX: 'auto' }}>
                            <code>{step.snippets?.boto3 || step.command}</code>
                          </pre>
                        ),
                      },
                      {
                        label: 'Terraform (HCL)',
                        id: 'terraform',
                        content: (
                          <pre style={{ background: '#161e2e', color: '#ce9178', padding: '12px', borderRadius: '4px', overflowX: 'auto' }}>
                            <code>{step.snippets?.terraform || step.command}</code>
                          </pre>
                        ),
                      },
                    ]}
                  />

                  <ExpandableSection headerText="Explain command">
                    <p>{step.explanation}</p>
                  </ExpandableSection>

                  {output && (
                    <Container header={<Header variant="h3">Execution Result: {output.status}</Header>}>
                      <pre style={{ background: '#0a1017', color: '#a6acb9', padding: '10px', borderRadius: '4px', overflowX: 'auto' }}>
                        <code>{output.body}</code>
                      </pre>
                    </Container>
                  )}
                </SpaceBetween>
              </Container>
            );
          })}
        </SpaceBetween>
      )}
    </SpaceBetween>
  );
};
