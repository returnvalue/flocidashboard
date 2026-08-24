import React, { useState, useEffect } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Grid from '@cloudscape-design/components/grid';
import Box from '@cloudscape-design/components/box';
import Badge from '@cloudscape-design/components/badge';
import Tabs from '@cloudscape-design/components/tabs';
import Table from '@cloudscape-design/components/table';
import { fetchResourceGraph } from '../api/client';

interface GraphNode {
  id: string;
  name: string;
  service: string;
  kind: string;
  layer: string;
  status: 'healthy' | 'disabled' | 'broken' | 'unverified' | 'unsupported';
  state: string;
  href: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  status: 'healthy' | 'disabled' | 'broken' | 'unverified' | 'unsupported';
  detail?: string;
  evidence: {
    label: string;
    value: any;
  };
}

interface ResourceGraphData {
  scenario: string;
  title: string;
  description: string;
  layers: string[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: Record<string, number>;
}

interface ResourceGraphConsoleProps {
  onNavigateService?: (serviceKey: string) => void;
}

export const ResourceGraphConsole: React.FC<ResourceGraphConsoleProps> = ({ onNavigateService }) => {
  const [graphData, setGraphData] = useState<ResourceGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const loadGraph = async () => {
    setLoading(true);
    try {
      const data = await fetchResourceGraph('eventbridge-application-spine');
      setGraphData(data);
      if (data?.nodes?.length > 0) {
        setSelectedNode(data.nodes[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return '#1d8102';
      case 'disabled':
        return '#879596';
      case 'broken':
        return '#d13212';
      default:
        return '#0972d3';
    }
  };

  const getServiceColor = (service: string) => {
    switch (service) {
      case 'lambda':
        return '#d45b07';
      case 'events':
      case 'eventbridge':
        return '#eb5f07';
      case 'sqs':
        return '#d45b07';
      case 'apigateway':
      case 'apigatewayv2':
        return '#0972d3';
      case 'iam':
        return '#d13212';
      case 'logs':
      case 'cloudwatch':
        return '#e07941';
      default:
        return '#0972d3';
    }
  };

  const layers = graphData?.layers || ['entrypoint', 'compute', 'routing', 'target', 'observability'];

  return (
    <SpaceBetween size="l">
      {/* Header */}
      <Container
        header={
          <Header
            variant="h1"
            description="Interactive relationship topology discovered dynamically across your AWS environment."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadGraph} loading={loading}>
                  Refresh Topology
                </Button>
              </SpaceBetween>
            }
          >
            AWS Architecture Topology Graph
          </Header>
        }
      >
        <Grid gridDefinition={[{ colspan: { default: 12, s: 3 } }, { colspan: { default: 12, s: 3 } }, { colspan: { default: 12, s: 3 } }, { colspan: { default: 12, s: 3 } }]}>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Total Discovered Nodes</Box>
            <Box variant="h1" color="text-status-info">
              {graphData?.nodes?.length ?? 0}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Active Relationships</Box>
            <Box variant="h1" color="text-status-info">
              {graphData?.edges?.length ?? 0}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Healthy Connections</Box>
            <Box variant="h1" color="text-status-success">
              {graphData?.summary?.healthy ?? 0}
            </Box>
          </Box>
          <Box padding="m" textAlign="center">
            <Box variant="awsui-key-label">Topology Health</Box>
            <Box variant="h2" color="text-status-info">
              <StatusIndicator type="success">Spine Online</StatusIndicator>
            </Box>
          </Box>
        </Grid>
      </Container>

      {/* Visual Canvas */}
      <Container
        header={
          <Header
            variant="h2"
            description={graphData?.description || 'Architectural flow from entrypoints to compute, rules, targets, and logs.'}
          >
            {graphData?.title || 'Event-Driven Order Spine'}
          </Header>
        }
      >
        <div
          style={{
            background: '#0a101d',
            borderRadius: '8px',
            border: '1px solid #232f3e',
            padding: '24px',
            overflowX: 'auto',
            minHeight: '380px',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '24px',
              minWidth: '900px',
              justifyContent: 'space-between',
            }}
          >
            {layers.map((layer) => {
              const layerNodes = (graphData?.nodes || []).filter((n) => n.layer === layer);
              return (
                <div
                  key={layer}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    background: 'rgba(35, 47, 62, 0.4)',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px dashed #344258',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      fontWeight: 'bold',
                      color: '#879596',
                      letterSpacing: '1px',
                      textAlign: 'center',
                      paddingBottom: '6px',
                      borderBottom: '1px solid #232f3e',
                    }}
                  >
                    {layer}
                  </div>

                  {layerNodes.map((node) => {
                    const isSelected = selectedNode?.id === node.id;
                    return (
                      <div
                        key={node.id}
                        onClick={() => {
                          setSelectedNode(node);
                        }}
                        style={{
                          background: isSelected ? '#162338' : '#0f1724',
                          border: `2px solid ${isSelected ? '#0972d3' : getStatusColor(node.status)}`,
                          borderRadius: '6px',
                          padding: '10px',
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 0 10px rgba(9, 114, 211, 0.4)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              textTransform: 'uppercase',
                              fontWeight: 'bold',
                              color: getServiceColor(node.service),
                              background: 'rgba(255,255,255,0.06)',
                              padding: '2px 6px',
                              borderRadius: '3px',
                            }}
                          >
                            {node.service}
                          </span>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: getStatusColor(node.status),
                            }}
                          />
                        </div>
                        <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#fbfbfb', wordBreak: 'break-word' }}>
                          {node.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#879596', marginTop: '4px' }}>
                          {node.kind}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </Container>

      {/* Node / Edge Inspector Drawer */}
      {selectedNode && (
        <Container
          header={
            <Header
              variant="h2"
              description={`Inspecting ${selectedNode.kind} (${selectedNode.service})`}
              actions={
                onNavigateService && (
                  <Button
                    variant="primary"
                    iconName="external"
                    onClick={() => onNavigateService(selectedNode.service.replace('v2', ''))}
                  >
                    Open {selectedNode.service.toUpperCase()} Console
                  </Button>
                )
              }
            >
              Selected Node: {selectedNode.name}
            </Header>
          }
        >
          <Tabs
            tabs={[
              {
                label: 'Overview & Status',
                id: 'overview',
                content: (
                  <KeyValuePairs
                    columns={3}
                    items={[
                      { label: 'Node ID', value: selectedNode.id },
                      { label: 'Resource Name', value: selectedNode.name },
                      { label: 'AWS Service', value: selectedNode.service.toUpperCase() },
                      { label: 'Resource Kind', value: selectedNode.kind },
                      { label: 'Architecture Layer', value: selectedNode.layer },
                      {
                        label: 'Relationship Status',
                        value: (
                          <StatusIndicator type={selectedNode.status === 'healthy' ? 'success' : 'error'}>
                            {selectedNode.state || selectedNode.status}
                          </StatusIndicator>
                        ),
                      },
                    ]}
                  />
                ),
              },
              {
                label: `Connected Edges (${(graphData?.edges || []).filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).length})`,
                id: 'edges',
                content: (
                  <Table
                    columnDefinitions={[
                      { id: 'rel', header: 'Relationship', cell: (e: any) => <strong>{e.relation}</strong> },
                      { id: 'source', header: 'Source', cell: (e: any) => <code>{e.source}</code> },
                      { id: 'target', header: 'Target', cell: (e: any) => <code>{e.target}</code> },
                      {
                        id: 'status',
                        header: 'Status',
                        cell: (e: any) => <Badge color={e.status === 'healthy' ? 'green' : 'red'}>{e.status}</Badge>,
                        width: 120,
                      },
                      { id: 'evidence', header: 'Evidence Type', cell: (e: any) => e.evidence?.label || '—' },
                    ]}
                    items={(graphData?.edges || []).filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)}
                  />
                ),
              },
            ]}
          />
        </Container>
      )}
    </SpaceBetween>
  );
};
