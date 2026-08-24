import React, { useState, useEffect } from 'react';
import { TopNav } from './components/TopNav';
import { ConsoleLayout } from './components/ConsoleLayout';
import { ConsoleHome } from './pages/ConsoleHome';
import { S3Console } from './pages/S3Console';
import { EC2Console } from './pages/EC2Console';
import { IAMConsole } from './pages/IAMConsole';
import { DynamoDBConsole } from './pages/DynamoDBConsole';
import { LambdaConsole } from './pages/LambdaConsole';
import { SQSConsole } from './pages/SQSConsole';
import { SNSConsole } from './pages/SNSConsole';
import { RDSConsole } from './pages/RDSConsole';
import { KMSConsole } from './pages/KMSConsole';
import { SecretsManagerConsole } from './pages/SecretsManagerConsole';
import { CloudFormationConsole } from './pages/CloudFormationConsole';
import { Route53Console } from './pages/Route53Console';
import { EventBridgeConsole } from './pages/EventBridgeConsole';
import { CloudWatchConsole } from './pages/CloudWatchConsole';
import { StepFunctionsConsole } from './pages/StepFunctionsConsole';
import { CognitoConsole } from './pages/CognitoConsole';
import { ApiGatewayConsole } from './pages/ApiGatewayConsole';
import { SSMConsole } from './pages/SSMConsole';
import { LabsConsole } from './pages/LabsConsole';
import { InspectorConsole } from './pages/InspectorConsole';
import { SettingsConsole } from './pages/SettingsConsole';
import { EnvironmentConsole } from './pages/EnvironmentConsole';
import { ActivityConsole } from './pages/ActivityConsole';
import { CliConsole } from './pages/CliConsole';
import { ResourceGraphConsole } from './pages/ResourceGraphConsole';
import { GenericServiceWorkbench } from './pages/GenericServiceWorkbench';
import { AwsServiceIcon } from './components/AwsServiceIcons';
import { FavoritesBar } from './components/FavoritesBar';
import { fetchIdentity, fetchServices } from './api/client';
import { IdentityInfo, ServiceDefinition } from './types';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';

function parseUrlPath(): { mainView: string; subTab?: string } {
  const path = window.location.pathname.replace(/^\/app\/?/, '').replace(/^\//, '').replace(/\/$/, '');
  if (!path || path === 'app' || path === 'home') return { mainView: 'home' };
  const parts = path.split('/');
  return { mainView: parts[0] || 'home', subTab: parts[1] };
}

export const App: React.FC = () => {
  const initial = parseUrlPath();
  const [identity, setIdentity] = useState<IdentityInfo | null>(null);
  const [services, setServices] = useState<ServiceDefinition[]>([]);
  const [currentView, setCurrentView] = useState<string>(initial.mainView);
  const [activeSubView, setActiveSubView] = useState<string>(window.location.pathname.replace(/^\//, '') || 'home');
  const [activeTabOverride, setActiveTabOverride] = useState<Record<string, string>>(() => {
    if (initial.subTab) {
      return { [initial.mainView]: initial.subTab };
    }
    return {};
  });

  useEffect(() => {
    fetchIdentity().then(setIdentity);
    fetchServices().then(setServices);

    const handlePopState = () => {
      const parsed = parseUrlPath();
      setCurrentView(parsed.mainView);
      setActiveSubView(window.location.pathname.replace(/^\//, '') || 'home');
      if (parsed.subTab) {
        setActiveTabOverride((prev) => ({ ...prev, [parsed.mainView]: parsed.subTab! }));
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (view: string) => {
    if (view === 'home' || !view) {
      setCurrentView('home');
      setActiveSubView('home');
      if (window.location.pathname !== '/') {
        window.history.pushState(null, '', '/');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const [main, sub] = view.split('/');
    setCurrentView(main);
    setActiveSubView(view);
    if (sub) {
      setActiveTabOverride((prev) => ({ ...prev, [main]: sub }));
    }

    const targetPath = `/${view}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getBreadcrumbs = () => {
    if (currentView === 'home') {
      return [{ text: 'AWS Management Console', href: '#' }];
    }
    if (currentView === 'labs') {
      return [
        { text: 'AWS Management Console', href: 'home' },
        { text: 'Workflow Labs', href: 'labs' },
      ];
    }
    if (currentView === 'inspector') {
      return [
        { text: 'AWS Management Console', href: 'home' },
        { text: 'Developer Inspector', href: 'inspector' },
      ];
    }
    if (currentView === 'topology') {
      return [
        { text: 'AWS Management Console', href: 'home' },
        { text: 'Architecture Topology Graph', href: 'topology' },
      ];
    }
    if (currentView === 'settings') {
      return [
        { text: 'AWS Management Console', href: 'home' },
        { text: 'Dashboard Settings', href: 'settings' },
      ];
    }
    if (currentView === 'environment') {
      return [
        { text: 'AWS Management Console', href: 'home' },
        { text: 'Session Identity & STS', href: 'environment' },
      ];
    }
    if (currentView === 'activity') {
      return [
        { text: 'AWS Management Console', href: 'home' },
        { text: 'Activity & Audit Log', href: 'activity' },
      ];
    }
    const svc = services.find((s) => s.key === currentView);
    return [
      { text: 'AWS Management Console', href: 'home' },
      { text: svc ? svc.title : currentView.toUpperCase(), href: currentView },
    ];
  };

  const getSideNavHeader = () => {
    if (currentView === 'home') {
      return { href: 'home', text: 'AWS Management Console' };
    }
    const svc = services.find((s) => s.key === currentView);
    if (svc) {
      return { href: currentView, text: svc.title };
    }
    const specialHeaders: Record<string, string> = {
      labs: 'Workflow Labs',
      inspector: 'Developer Inspector',
      topology: 'Architecture Topology Graph',
      settings: 'Dashboard Settings',
      environment: 'Session Identity & STS',
      activity: 'Activity Audit Log',
      console: 'AWS CLI Terminal',
    };
    return { href: currentView, text: specialHeaders[currentView] || currentView.toUpperCase() };
  };

  const getSideNavItems = () => {
    if (currentView === 'home') {
      return [
        { type: 'link' as const, text: 'Console Home', href: 'home', icon: <AwsServiceIcon service="aws" size={18} /> },
        { type: 'link' as const, text: 'Workflow Labs (63)', href: 'labs', icon: <AwsServiceIcon service="labs" size={18} /> },
        { type: 'link' as const, text: 'Local Inspector Inbox', href: 'inspector', icon: <AwsServiceIcon service="inspector" size={18} /> },
        { type: 'link' as const, text: 'Architecture Topology Graph', href: 'topology', icon: <AwsServiceIcon service="topology" size={18} /> },
        { type: 'divider' as const },
        {
          type: 'section' as const,
          text: 'Developer Tools & Management',
          items: [
            { type: 'link' as const, text: 'AWS CLI Terminal', href: 'console', icon: <AwsServiceIcon service="aws" size={18} /> },
            { type: 'link' as const, text: 'Activity Audit Log', href: 'activity', icon: <AwsServiceIcon service="cloudwatch" size={18} /> },
            { type: 'link' as const, text: 'Session Identity & STS', href: 'environment', icon: <AwsServiceIcon service="iam" size={18} /> },
            { type: 'link' as const, text: 'Dashboard Settings', href: 'settings', icon: <AwsServiceIcon service="ssm" size={18} /> },
          ],
        },
        { type: 'divider' as const },
        {
          type: 'section' as const,
          text: 'Core AWS Services',
          items: [
            { type: 'link' as const, text: 'Amazon S3', href: 's3', icon: <AwsServiceIcon service="s3" size={18} /> },
            { type: 'link' as const, text: 'Amazon EC2', href: 'ec2', icon: <AwsServiceIcon service="ec2" size={18} /> },
            { type: 'link' as const, text: 'AWS IAM', href: 'iam', icon: <AwsServiceIcon service="iam" size={18} /> },
            { type: 'link' as const, text: 'Amazon DynamoDB', href: 'dynamodb', icon: <AwsServiceIcon service="dynamodb" size={18} /> },
            { type: 'link' as const, text: 'AWS Lambda', href: 'lambda', icon: <AwsServiceIcon service="lambda" size={18} /> },
            { type: 'link' as const, text: 'Amazon SQS', href: 'sqs', icon: <AwsServiceIcon service="sqs" size={18} /> },
            { type: 'link' as const, text: 'Amazon SNS', href: 'sns', icon: <AwsServiceIcon service="sns" size={18} /> },
            { type: 'link' as const, text: 'Amazon RDS', href: 'rds', icon: <AwsServiceIcon service="rds" size={18} /> },
            { type: 'link' as const, text: 'AWS KMS', href: 'kms', icon: <AwsServiceIcon service="kms" size={18} /> },
            { type: 'link' as const, text: 'AWS Secrets Manager', href: 'secretsmanager', icon: <AwsServiceIcon service="secretsmanager" size={18} /> },
            { type: 'link' as const, text: 'AWS CloudFormation', href: 'cloudformation', icon: <AwsServiceIcon service="cloudformation" size={18} /> },
            { type: 'link' as const, text: 'Amazon Route 53', href: 'route53', icon: <AwsServiceIcon service="route53" size={18} /> },
            { type: 'link' as const, text: 'Amazon EventBridge', href: 'eventbridge', icon: <AwsServiceIcon service="eventbridge" size={18} /> },
            { type: 'link' as const, text: 'Amazon CloudWatch', href: 'cloudwatch', icon: <AwsServiceIcon service="cloudwatch" size={18} /> },
            { type: 'link' as const, text: 'AWS Step Functions', href: 'stepfunctions', icon: <AwsServiceIcon service="stepfunctions" size={18} /> },
            { type: 'link' as const, text: 'Amazon Cognito', href: 'cognito', icon: <AwsServiceIcon service="cognito" size={18} /> },
            { type: 'link' as const, text: 'Amazon API Gateway', href: 'apigateway', icon: <AwsServiceIcon service="apigateway" size={18} /> },
            { type: 'link' as const, text: 'AWS Systems Manager (SSM)', href: 'ssm', icon: <AwsServiceIcon service="ssm" size={18} /> },
          ],
        },
      ];
    }

    // Context-specific active navigation per service
    switch (currentView) {
      case 's3':
        return [
          { type: 'link' as const, text: 'Buckets & Objects', href: 's3/objects', icon: <AwsServiceIcon service="s3" size={18} /> },
          { type: 'link' as const, text: 'Static Website Hosting', href: 's3/website' },
          { type: 'link' as const, text: 'Event Notifications Hub', href: 's3/notifications' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'ec2':
        return [
          {
            type: 'section' as const,
            text: 'Instances',
            items: [
              { type: 'link' as const, text: 'Instances', href: 'ec2/instances', icon: <AwsServiceIcon service="ec2" size={18} /> },
            ],
          },
          {
            type: 'section' as const,
            text: 'Network & Security',
            items: [
              { type: 'link' as const, text: 'Security Groups', href: 'ec2/security_groups' },
              { type: 'link' as const, text: 'Virtual Private Clouds (VPC)', href: 'ec2/vpcs' },
              { type: 'link' as const, text: 'Subnets', href: 'ec2/subnets' },
            ],
          },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'iam':
        return [
          {
            type: 'section' as const,
            text: 'Access Management',
            items: [
              { type: 'link' as const, text: 'Roles', href: 'iam/roles', icon: <AwsServiceIcon service="iam" size={18} /> },
              { type: 'link' as const, text: 'Users', href: 'iam/users' },
              { type: 'link' as const, text: 'User Groups', href: 'iam/groups' },
              { type: 'link' as const, text: 'Policies', href: 'iam/policies' },
            ],
          },
          {
            type: 'section' as const,
            text: 'Access Analysis',
            items: [
              { type: 'link' as const, text: 'Policy Simulator', href: 'iam/simulator' },
              { type: 'link' as const, text: 'Session Identity & STS', href: 'environment' },
            ],
          },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'dynamodb':
        return [
          { type: 'link' as const, text: 'Explore Items (CRUD)', href: 'dynamodb/items', icon: <AwsServiceIcon service="dynamodb" size={18} /> },
          { type: 'link' as const, text: 'PartiQL SQL Query Editor', href: 'dynamodb/partiql' },
          { type: 'link' as const, text: 'Tables & Schema', href: 'dynamodb/schema' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'lambda':
        return [
          { type: 'link' as const, text: 'Functions & Code Preview', href: 'lambda/code', icon: <AwsServiceIcon service="lambda" size={18} /> },
          { type: 'link' as const, text: 'Function URLs (Public)', href: 'lambda/urls' },
          { type: 'link' as const, text: 'Triggers (Event Sources)', href: 'lambda/triggers' },
          { type: 'link' as const, text: 'Versions & Snapshots', href: 'lambda/versions' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'sqs':
        return [
          { type: 'link' as const, text: 'Queues & Dead-Letter Hub', href: 'sqs', icon: <AwsServiceIcon service="sqs" size={18} /> },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'sns':
        return [
          { type: 'link' as const, text: 'Topics & Subscriptions', href: 'sns', icon: <AwsServiceIcon service="sns" size={18} /> },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'rds':
        return [
          { type: 'link' as const, text: 'Databases & Subnet Groups', href: 'rds', icon: <AwsServiceIcon service="rds" size={18} /> },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'kms':
        return [
          { type: 'link' as const, text: 'Customer Managed Keys', href: 'kms/keys', icon: <AwsServiceIcon service="kms" size={18} /> },
          { type: 'link' as const, text: 'Cryptographic Workbench', href: 'kms/workbench' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'secretsmanager':
        return [
          { type: 'link' as const, text: 'Secrets & Decryption Vault', href: 'secretsmanager', icon: <AwsServiceIcon service="secretsmanager" size={18} /> },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'cloudformation':
        return [
          { type: 'link' as const, text: 'Stacks & YAML Templates', href: 'cloudformation', icon: <AwsServiceIcon service="cloudformation" size={18} /> },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'route53':
        return [
          { type: 'link' as const, text: 'Hosted Zones & DNS Records', href: 'route53', icon: <AwsServiceIcon service="route53" size={18} /> },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'eventbridge':
        return [
          { type: 'link' as const, text: 'Event Buses & Rule Patterns', href: 'eventbridge', icon: <AwsServiceIcon service="eventbridge" size={18} /> },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'cloudwatch':
        return [
          { type: 'link' as const, text: 'Metric Alarms', href: 'cloudwatch/alarms', icon: <AwsServiceIcon service="cloudwatch" size={18} /> },
          { type: 'link' as const, text: 'Log Groups & Streams', href: 'cloudwatch/logs' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'stepfunctions':
        return [
          { type: 'link' as const, text: 'State Machines & Executions', href: 'stepfunctions', icon: <AwsServiceIcon service="stepfunctions" size={18} /> },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'cognito':
        return [
          { type: 'link' as const, text: 'User Pools & Users', href: 'cognito/users', icon: <AwsServiceIcon service="cognito" size={18} /> },
          { type: 'link' as const, text: 'App Clients', href: 'cognito/clients' },
          { type: 'link' as const, text: 'Authentication Sandbox', href: 'cognito/auth' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'apigateway':
        return [
          { type: 'link' as const, text: 'APIs & Routes', href: 'apigateway/test', icon: <AwsServiceIcon service="apigateway" size={18} /> },
          { type: 'link' as const, text: 'Test Request Runner', href: 'apigateway/test' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'ssm':
        return [
          { type: 'link' as const, text: 'Parameter Store & Path Tree', href: 'ssm/val', icon: <AwsServiceIcon service="ssm" size={18} /> },
          { type: 'link' as const, text: 'KMS Decryption Revealer', href: 'ssm/val' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'topology':
        return [
          { type: 'link' as const, text: 'Application Spines & Canvas', href: 'topology', icon: <AwsServiceIcon service="topology" size={18} /> },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'labs':
        return [
          { type: 'link' as const, text: 'Workflow Labs Catalog (63)', href: 'labs', icon: <AwsServiceIcon service="labs" size={18} /> },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'inspector':
        return [
          { type: 'link' as const, text: 'Developer Inspector Inbox', href: 'inspector', icon: <AwsServiceIcon service="inspector" size={18} /> },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'settings':
      case 'environment':
      case 'activity':
      case 'console':
        return [
          { type: 'link' as const, text: 'Dashboard Settings', href: 'settings', icon: <AwsServiceIcon service="ssm" size={18} /> },
          { type: 'link' as const, text: 'Session Identity & STS', href: 'environment', icon: <AwsServiceIcon service="iam" size={18} /> },
          { type: 'link' as const, text: 'Activity Audit Log', href: 'activity', icon: <AwsServiceIcon service="cloudwatch" size={18} /> },
          { type: 'link' as const, text: 'AWS CLI Terminal', href: 'console', icon: <AwsServiceIcon service="aws" size={18} /> },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      default:
        return [
          { type: 'link' as const, text: 'Actions & Operations', href: currentView, icon: <AwsServiceIcon service={currentView} size={18} /> },
          { type: 'link' as const, text: 'Service Inventory & Health', href: currentView },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'home':
        return (
          <ConsoleHome
            services={services}
            onSelectService={(key) => navigateTo(key)}
            onNavigateLabs={() => navigateTo('labs')}
            onNavigateInspector={() => navigateTo('inspector')}
          />
        );
      case 's3':
        return (
          <S3Console
            activeTab={activeTabOverride['s3']}
            onTabChange={(tab) => {
              setActiveTabOverride((prev) => ({ ...prev, s3: tab }));
              setActiveSubView(`s3/${tab}`);
            }}
          />
        );
      case 'ec2':
        return (
          <EC2Console
            activeTab={activeTabOverride['ec2']}
            onTabChange={(tab) => {
              setActiveTabOverride((prev) => ({ ...prev, ec2: tab }));
              setActiveSubView(`ec2/${tab}`);
            }}
          />
        );
      case 'iam':
        return (
          <IAMConsole
            activeTab={activeTabOverride['iam']}
            onTabChange={(tab) => {
              setActiveTabOverride((prev) => ({ ...prev, iam: tab }));
              setActiveSubView(`iam/${tab}`);
            }}
          />
        );
      case 'dynamodb':
        return (
          <DynamoDBConsole
            activeTab={activeTabOverride['dynamodb']}
            onTabChange={(tab) => {
              setActiveTabOverride((prev) => ({ ...prev, dynamodb: tab }));
              setActiveSubView(`dynamodb/${tab}`);
            }}
          />
        );
      case 'lambda':
        return (
          <LambdaConsole
            activeTab={activeTabOverride['lambda']}
            onTabChange={(tab) => {
              setActiveTabOverride((prev) => ({ ...prev, lambda: tab }));
              setActiveSubView(`lambda/${tab}`);
            }}
          />
        );
      case 'sqs':
        return <SQSConsole />;
      case 'sns':
        return <SNSConsole />;
      case 'rds':
        return <RDSConsole />;
      case 'kms':
        return (
          <KMSConsole
            activeTab={activeTabOverride['kms']}
            onTabChange={(tab) => {
              setActiveTabOverride((prev) => ({ ...prev, kms: tab }));
              setActiveSubView(`kms/${tab}`);
            }}
          />
        );
      case 'secretsmanager':
        return <SecretsManagerConsole />;
      case 'cloudformation':
        return <CloudFormationConsole />;
      case 'route53':
        return <Route53Console />;
      case 'eventbridge':
        return <EventBridgeConsole />;
      case 'cloudwatch':
        return (
          <CloudWatchConsole
            activeTab={activeTabOverride['cloudwatch']}
            onTabChange={(tab) => {
              setActiveTabOverride((prev) => ({ ...prev, cloudwatch: tab }));
              setActiveSubView(`cloudwatch/${tab}`);
            }}
          />
        );
      case 'stepfunctions':
        return <StepFunctionsConsole />;
      case 'cognito':
        return (
          <CognitoConsole
            activeTab={activeTabOverride['cognito']}
            onTabChange={(tab) => {
              setActiveTabOverride((prev) => ({ ...prev, cognito: tab }));
              setActiveSubView(`cognito/${tab}`);
            }}
          />
        );
      case 'apigateway':
        return (
          <ApiGatewayConsole
            activeTab={activeTabOverride['apigateway']}
            onTabChange={(tab) => {
              setActiveTabOverride((prev) => ({ ...prev, apigateway: tab }));
              setActiveSubView(`apigateway/${tab}`);
            }}
          />
        );
      case 'ssm':
        return (
          <SSMConsole
            activeTab={activeTabOverride['ssm']}
            onTabChange={(tab) => {
              setActiveTabOverride((prev) => ({ ...prev, ssm: tab }));
              setActiveSubView(`ssm/${tab}`);
            }}
          />
        );
      case 'labs':
        return <LabsConsole />;
      case 'inspector':
        return <InspectorConsole />;
      case 'settings':
        return <SettingsConsole />;
      case 'environment':
        return <EnvironmentConsole />;
      case 'activity':
        return <ActivityConsole onNavigateService={(s) => navigateTo(s)} />;
      case 'console':
        return <CliConsole />;
      case 'topology':
        return <ResourceGraphConsole onNavigateService={(s) => navigateTo(s)} />;
      default:
        const svc = services.find((s) => s.key === currentView);
        if (svc) {
          return (
            <GenericServiceWorkbench
              service={svc}
              onNavigateLabs={() => navigateTo('labs')}
            />
          );
        }
        return (
          <Container
            header={
              <Header variant="h1" description="Service Not Found">
                {currentView.toUpperCase()}
              </Header>
            }
          >
            <SpaceBetween size="m">
              <p>The requested service was not found or is not registered.</p>
              <Button onClick={() => navigateTo('home')}>
                ← Return to Console Home
              </Button>
            </SpaceBetween>
          </Container>
        );
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopNav
        identity={identity}
        services={services}
        onSelectService={(key) => navigateTo(key)}
        onNavigateHome={() => navigateTo('home')}
        onNavigateLabs={() => navigateTo('labs')}
      />
      <FavoritesBar
        activeService={currentView}
        onSelectService={(key) => navigateTo(key)}
        allServices={services}
      />
      <ConsoleLayout
        breadcrumbs={getBreadcrumbs()}
        sideNavHeader={getSideNavHeader()}
        sideNavItems={getSideNavItems()}
        activeSideNavHref={activeSubView}
        onSideNavFollow={(href) => navigateTo(href)}
      >
        {renderContent()}
      </ConsoleLayout>
    </div>
  );
};
