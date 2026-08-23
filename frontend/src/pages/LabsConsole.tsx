import React, { useState, useEffect } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ProgressBar from '@cloudscape-design/components/progress-bar';
import Tabs from '@cloudscape-design/components/tabs';
import TextFilter from '@cloudscape-design/components/text-filter';
import Cards from '@cloudscape-design/components/cards';
import Badge from '@cloudscape-design/components/badge';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import Box from '@cloudscape-design/components/box';
import { fetchLabsCatalog, runLabStep, resetLab } from '../api/client';
import { LabDefinition, LabStep } from '../types';

export const LabsConsole: React.FC = () => {
  const [allLabsList, setAllLabsList] = useState<LabDefinition[]>([]);
  const [activeLab, setActiveLab] = useState<LabDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [runningStepKey, setRunningStepKey] = useState<string | null>(null);
  const [activeSdk, setActiveSdk] = useState<'cli' | 'boto3' | 'terraform'>('cli');
  const [stepOutputs, setStepOutputs] = useState<Record<string, { status: string; body: string }>>({});
  const [stepCompleted, setStepCompleted] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchLabsCatalog();
      const flattened = (data.services || []).flatMap((s) => s.labs);
      setAllLabsList(flattened);

      // Check URL query parameters for direct lab link
      const params = new URLSearchParams(window.location.search);
      const urlLabKey = params.get('lab');
      if (urlLabKey) {
        const found = flattened.find((l) => l.key === urlLabKey);
        if (found) setActiveLab(found);
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

  const openLab = (lab: LabDefinition) => {
    setActiveLab(lab);
    setStepOutputs({});
    setStepCompleted({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeLab = () => {
    setActiveLab(null);
    setStepOutputs({});
    setStepCompleted({});
  };

  const handleRunStep = async (step: LabStep) => {
    if (!activeLab) return;
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
    } catch (err) {
      console.error(err);
    }
  };

  const completedCount = activeLab?.steps?.filter((s) => stepCompleted[s.key] || s.status?.verified).length || 0;
  const totalCount = activeLab?.steps?.length || 1;
  const percentComplete = Math.round((completedCount / totalCount) * 100);

  const filteredLabs = allLabsList.filter(
    (l) =>
      l.title.toLowerCase().includes(filterText.toLowerCase()) ||
      l.service.toLowerCase().includes(filterText.toLowerCase()) ||
      l.description.toLowerCase().includes(filterText.toLowerCase())
  );

  // If a lab is open, show the active Lab Studio
  if (activeLab) {
    return (
      <SpaceBetween size="l">
        <Container
          header={
            <Header
              variant="h1"
              description={activeLab.description}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button onClick={closeLab}>← Back to Labs Directory</Button>
                  <Button onClick={handleResetLab}>Reset lab</Button>
                </SpaceBetween>
              }
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Badge color="blue">{activeLab.service.toUpperCase()}</Badge>
                <span>{activeLab.title}</span>
              </div>
            </Header>
          }
        >
          <ProgressBar
            value={percentComplete}
            label="Lab Step Completion"
            description={`${completedCount} of ${totalCount} steps complete (${percentComplete}%)`}
            status={percentComplete === 100 ? 'success' : 'in-progress'}
          />
        </Container>

        <SpaceBetween size="m">
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
      </SpaceBetween>
    );
  }

  // Otherwise, render the instant Labs Directory view
  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h1"
            description="Choose from 63 hands-on local cloud architecture lessons across 17 AWS services."
            actions={
              <Button iconName="refresh" onClick={loadData} loading={loading}>
                Refresh catalog
              </Button>
            }
          >
            AWS Workflow Labs Directory (63 Lessons)
          </Header>
        }
      >
        <SpaceBetween size="m">
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Filter labs by service (e.g. S3, IAM, EC2, Lambda) or title..."
            onChange={({ detail }) => setFilterText(detail.filteringText)}
          />

          <Cards
            cardDefinition={{
              header: (item) => (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button variant="inline-link" onClick={() => openLab(item)}>
                    <strong>{item.title}</strong>
                  </Button>
                  <Badge color="blue">{item.service.toUpperCase()}</Badge>
                </div>
              ),
              sections: [
                {
                  id: 'description',
                  content: (item) => item.description,
                },
                {
                  id: 'steps',
                  header: 'Runnable Steps',
                  content: (item) => `${item.step_count || item.steps?.length || 1} steps (CLI / Boto3 / Terraform)`,
                },
                {
                  id: 'action',
                  content: (item) => (
                    <Button variant="primary" iconName="caret-right-filled" onClick={() => openLab(item)}>
                      Start Lab Lesson
                    </Button>
                  ),
                },
              ],
            }}
            items={filteredLabs}
            cardsPerRow={[{ cards: 1 }, { minWidth: 600, cards: 3 }]}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No matching labs found</b>
                <p>Try searching for a different keyword or service.</p>
              </Box>
            }
          />
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
};
