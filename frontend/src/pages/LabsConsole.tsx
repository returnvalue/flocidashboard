import React, { useState, useEffect, useRef } from 'react';
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
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { fetchLabsCatalog, fetchLabsProgress, fetchLabStatus, runLabStep, resetLab } from '../api/client';
import { LabDefinition, LabStep } from '../types';
import { CodeSnippet } from '../components/CodeSnippet';

export const LabsConsole: React.FC = () => {
  const [allLabsList, setAllLabsList] = useState<LabDefinition[]>([]);
  const [completedLabsMap, setCompletedLabsMap] = useState<Record<string, boolean>>({});
  const [activeLab, setActiveLab] = useState<LabDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [runningStepKey, setRunningStepKey] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [activeSdk, setActiveSdkState] = useState<'cli' | 'boto3' | 'terraform'>(() => {
    try {
      const saved = localStorage.getItem('floci_labs_active_sdk');
      if (saved === 'cli' || saved === 'boto3' || saved === 'terraform') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'cli';
  });

  const handleSdkChange = (sdk: 'cli' | 'boto3' | 'terraform') => {
    setActiveSdkState(sdk);
    try {
      localStorage.setItem('floci_labs_active_sdk', sdk);
    } catch {
      // ignore
    }
  };

  const [stepOutputs, setStepOutputs] = useState<Record<string, { status: string; body: string }>>({});
  const [stepCompleted, setStepCompleted] = useState<Record<string, boolean>>({});

  const cancelRunAllRef = useRef(false);
  const stepRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const data = await fetchLabsCatalog();
      const flattened = (data.services || []).flatMap((s) => s.labs);
      setAllLabsList(flattened);

      // Check URL query parameters for direct lab link
      const params = new URLSearchParams(window.location.search);
      const urlLabKey = params.get('lab');
      const urlServiceKey = params.get('service');
      if (urlLabKey) {
        const found = flattened.find((l) => l.key === urlLabKey && (!urlServiceKey || l.service === urlServiceKey));
        if (found) {
          openLab(found);
        }
      }

      // Background fetch of completion status for all labs
      fetchLabsProgress().then((prog) => {
        const map: Record<string, boolean> = {};
        (prog.labs || []).forEach((l) => {
          if (l.complete) {
            map[`${l.service}:${l.key}`] = true;
          }
        });
        setCompletedLabsMap(map);
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const openLab = async (lab: LabDefinition) => {
    setActiveLab(lab);
    setStepOutputs({});
    setStepCompleted({});
    setStatusLoading(true);

    // Update URL query parameters
    const url = new URL(window.location.href);
    url.searchParams.set('lab', lab.key);
    url.searchParams.set('service', lab.service);
    window.history.pushState(null, '', url.pathname + url.search);

    try {
      const statusData = await fetchLabStatus(lab.service, lab.key);
      const completedMap: Record<string, boolean> = {};
      const outputMap: Record<string, { status: string; body: string }> = {};

      Object.entries(statusData.steps || {}).forEach(([k, v]) => {
        completedMap[k] = Boolean(v.verified);
        if (v.verification) {
          outputMap[k] = {
            status: v.verified ? 'Verified' : 'Unverified',
            body: v.verification.message || JSON.stringify(v.verification, null, 2),
          };
        }
      });
      setStepCompleted(completedMap);
      setStepOutputs(outputMap);

      if (statusData.complete) {
        setCompletedLabsMap((prev) => ({
          ...prev,
          [`${lab.service}:${lab.key}`]: true,
        }));
      }
    } catch (err) {
      console.error('Failed to load lab status:', err);
    } finally {
      setStatusLoading(false);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeLab = () => {
    cancelRunAllRef.current = true;
    setIsRunningAll(false);
    setActiveLab(null);
    setStepOutputs({});
    setStepCompleted({});

    const url = new URL(window.location.href);
    url.searchParams.delete('lab');
    url.searchParams.delete('service');
    window.history.pushState(null, '', url.pathname);
  };

  const scrollToStep = (stepKey: string) => {
    const el = stepRefs.current[stepKey];
    if (el) {
      const rect = el.getBoundingClientRect();
      const offsetTop = window.pageYOffset + rect.top - 10;
      window.scrollTo({ top: Math.max(0, offsetTop), behavior: 'smooth' });
    }
  };

  const handleRunStep = async (step: LabStep): Promise<boolean> => {
    if (!activeLab) return false;
    setRunningStepKey(step.key);
    scrollToStep(step.key);

    try {
      const data = await runLabStep(activeLab.service, activeLab.key, step.key);
      const isVerified = Boolean(data.verified);
      const outputBody = data.stdout || JSON.stringify(data.verification || data.json || data, null, 2);

      setStepOutputs((prev) => ({
        ...prev,
        [step.key]: {
          status: isVerified ? 'Verified' : 'Succeeded',
          body: outputBody,
        },
      }));
      setStepCompleted((prev) => {
        const next = { ...prev, [step.key]: isVerified };
        const allDone = activeLab.steps?.every((s) => s.key === step.key ? isVerified : next[s.key]);
        if (allDone) {
          setCompletedLabsMap((cmap) => ({
            ...cmap,
            [`${activeLab.service}:${activeLab.key}`]: true,
          }));
        }
        return next;
      });
      return isVerified;
    } catch (err: any) {
      setStepOutputs((prev) => ({
        ...prev,
        [step.key]: {
          status: 'Failed',
          body: err.message || 'Execution error',
        },
      }));
      return false;
    } finally {
      setRunningStepKey(null);
    }
  };

  const handleRunAllSteps = async () => {
    if (!activeLab || isRunningAll) return;
    setIsRunningAll(true);
    cancelRunAllRef.current = false;

    const steps = activeLab.steps || [];
    for (let i = 0; i < steps.length; i++) {
      if (cancelRunAllRef.current) break;
      const step = steps[i];
      if (stepCompleted[step.key]) continue; // Skip already verified steps

      await handleRunStep(step);
      // Short delay for visual clarity before next step
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    setIsRunningAll(false);
  };

  const handleResetLab = async () => {
    if (!activeLab) return;
    cancelRunAllRef.current = true;
    setIsRunningAll(false);
    setStatusLoading(true);
    try {
      await resetLab(activeLab.service, activeLab.key);
      setStepCompleted({});
      setStepOutputs({});
      setCompletedLabsMap((prev) => ({
        ...prev,
        [`${activeLab.service}:${activeLab.key}`]: false,
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setStatusLoading(false);
    }
  };

  const completedCount = activeLab?.steps?.filter((s) => stepCompleted[s.key] || s.status?.verified).length || 0;
  const totalCount = activeLab?.steps?.length || 1;
  const percentComplete = Math.round((completedCount / totalCount) * 100);
  const isLabComplete = (completedCount === totalCount && totalCount > 0) || Boolean(completedLabsMap[`${activeLab?.service}:${activeLab?.key}`]);

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
                  <Button onClick={handleResetLab} loading={statusLoading}>
                    Reset lab
                  </Button>
                  <Button
                    variant="primary"
                    iconName="caret-right-filled"
                    onClick={handleRunAllSteps}
                    loading={isRunningAll}
                    disabled={isLabComplete || statusLoading}
                  >
                    {isLabComplete ? '✓ Lab Fully Completed' : isRunningAll ? 'Running steps...' : '▶ Run all remaining steps'}
                  </Button>
                </SpaceBetween>
              }
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Badge color="blue">{activeLab.service.toUpperCase()}</Badge>
                <span>{activeLab.title}</span>
                {isLabComplete && <StatusIndicator type="success">Completed</StatusIndicator>}
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
            const isDone = Boolean(stepCompleted[step.key] || step.status?.verified);
            const output = stepOutputs[step.key];

            return (
              <div
                key={step.key}
                ref={(el) => (stepRefs.current[step.key] = el)}
                style={{
                  borderRadius: '8px',
                  border: isDone ? '2px solid #1d8102' : '1px solid #232f3e',
                  transition: 'border 0.3s ease',
                }}
              >
                <Container
                  header={
                    <Header
                      variant="h3"
                      actions={
                        <SpaceBetween direction="horizontal" size="xs">
                          {isDone && <StatusIndicator type="success">Verified</StatusIndicator>}
                          <Button
                            variant={isDone ? 'normal' : 'primary'}
                            iconName={isDone ? 'status-positive' : 'caret-right-filled'}
                            onClick={() => handleRunStep(step)}
                            loading={runningStepKey === step.key}
                            disabled={isDone || isRunningAll}
                          >
                            {isDone ? '✓ Step Complete' : 'Run step'}
                          </Button>
                        </SpaceBetween>
                      }
                    >
                      Step {idx + 1}: {step.title}
                    </Header>
                  }
                >
                  <SpaceBetween size="m">
                    <Tabs
                      activeTabId={activeSdk}
                      onChange={({ detail }) => handleSdkChange(detail.activeTabId as any)}
                      tabs={[
                        {
                          label: 'AWS CLI',
                          id: 'cli',
                          content: (
                            <CodeSnippet language="cli" code={step.command} />
                          ),
                        },
                        {
                          label: 'Python (boto3)',
                          id: 'boto3',
                          content: (
                            <CodeSnippet
                              language="boto3"
                              code={step.snippets?.boto3 || step.command}
                            />
                          ),
                        },
                        {
                          label: 'Terraform (HCL)',
                          id: 'terraform',
                          content: (
                            <CodeSnippet
                              language="terraform"
                              code={step.snippets?.terraform || step.command}
                            />
                          ),
                        },
                      ]}
                    />

                    <ExpandableSection headerText="Explain command & concept">
                      <p style={{ lineHeight: '1.6', margin: 0 }}>{step.explanation}</p>
                    </ExpandableSection>

                    {output && (
                      <Container
                        header={
                          <Header variant="h3">
                            <StatusIndicator type={output.status === 'Failed' ? 'error' : 'success'}>
                              Execution Result: {output.status}
                            </StatusIndicator>
                          </Header>
                        }
                      >
                        <CodeSnippet language="json" code={output.body} />
                      </Container>
                    )}
                  </SpaceBetween>
                </Container>
              </div>
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
              <Button iconName="refresh" onClick={loadCatalog} loading={loading}>
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
              header: (item) => {
                const isComplete = Boolean(completedLabsMap[`${item.service}:${item.key}`]);
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Button variant="inline-link" onClick={() => openLab(item)}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {isComplete && <StatusIndicator type="success" />}
                        <strong style={{ color: isComplete ? '#4ec9b0' : 'inherit' }}>{item.title}</strong>
                      </span>
                    </Button>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {isComplete && <Badge color="green">✓ COMPLETE</Badge>}
                      <Badge color="blue">{item.service.toUpperCase()}</Badge>
                    </div>
                  </div>
                );
              },
              sections: [
                {
                  id: 'description',
                  content: (item) => {
                    const isComplete = Boolean(completedLabsMap[`${item.service}:${item.key}`]);
                    return (
                      <div
                        style={{
                          borderRadius: '6px',
                          padding: isComplete ? '8px 10px' : undefined,
                          border: isComplete ? '1px solid #1d8102' : undefined,
                          background: isComplete ? 'rgba(29, 129, 2, 0.08)' : undefined,
                        }}
                      >
                        {item.description}
                      </div>
                    );
                  },
                },
                {
                  id: 'steps',
                  header: 'Runnable Steps',
                  content: (item) => `${item.step_count || item.steps?.length || 1} steps (CLI / Boto3 / Terraform)`,
                },
                {
                  id: 'action',
                  content: (item) => {
                    const isComplete = Boolean(completedLabsMap[`${item.service}:${item.key}`]);
                    return (
                      <Button
                        variant={isComplete ? 'normal' : 'primary'}
                        iconName={isComplete ? 'status-positive' : 'caret-right-filled'}
                        onClick={() => openLab(item)}
                      >
                        {isComplete ? 'Review Completed Lab' : 'Start Lab Lesson'}
                      </Button>
                    );
                  },
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
