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
import { LabsConsole } from './pages/LabsConsole';
import { InspectorConsole } from './pages/InspectorConsole';
import { SettingsConsole } from './pages/SettingsConsole';
import { EnvironmentConsole } from './pages/EnvironmentConsole';
import { ActivityConsole } from './pages/ActivityConsole';
import { CliConsole } from './pages/CliConsole';
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

function getInitialView(): string {
  const path = window.location.pathname.replace(/^\/app\/?/, '').replace(/^\//, '').replace(/\/$/, '');
  if (!path || path === 'app' || path === 'home') return 'home';
  if (path === 'labs' || path.endsWith('/labs') || path.startsWith('labs/')) return 'labs';
  if (path === 'inspector' || path.endsWith('/inspector') || path.startsWith('inspector/')) return 'inspector';
  if (path === 'settings' || path.endsWith('/settings') || path.startsWith('settings/')) return 'settings';
  if (path === 'environment' || path.endsWith('/environment') || path.startsWith('environment/')) return 'environment';
  if (path === 'activity' || path.endsWith('/activity') || path.startsWith('activity/')) return 'activity';
  if (path === 'console' || path.endsWith('/console') || path.startsWith('console/')) return 'console';
  if (path.startsWith('service/')) {
    const parts = path.split('/');
    return parts[1] || 'home';
  }
  return path;
}

export const App: React.FC = () => {
  const [identity, setIdentity] = useState<IdentityInfo | null>(null);
  const [services, setServices] = useState<ServiceDefinition[]>([]);
  const [currentView, setCurrentView] = useState<string>(getInitialView);

  useEffect(() => {
    fetchIdentity().then(setIdentity);
    fetchServices().then(setServices);

    const handlePopState = () => {
      setCurrentView(getInitialView());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (view: string) => {
    setCurrentView(view);
    const targetPath = view === 'home' ? '/' : `/${view}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
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
        { text: 'Local Developer Inspector Inbox', href: 'inspector' },
      ];
    }
    if (currentView === 'settings') {
      return [
        { text: 'AWS Management Console', href: 'home' },
        { text: 'Settings & Endpoint Configuration', href: 'settings' },
      ];
    }
    if (currentView === 'environment') {
      return [
        { text: 'AWS Management Console', href: 'home' },
        { text: 'Session Identity & Environment', href: 'environment' },
      ];
    }
    if (currentView === 'activity') {
      return [
        { text: 'AWS Management Console', href: 'home' },
        { text: 'Activity & Audit Log', href: 'activity' },
      ];
    }
    const crumbs = [{ text: 'AWS Management Console', href: 'home' }];
    if (currentView !== 'home') {
      const svc = services.find((s) => s.key === currentView);
      const title = svc ? svc.title : currentView.toUpperCase();
      crumbs.push({ text: title, href: currentView });
    }
    return crumbs;
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

    // Context-specific navigation per service
    switch (currentView) {
      case 's3':
        return [
          { type: 'link' as const, text: 'Buckets', href: 's3', icon: <AwsServiceIcon service="s3" size={18} /> },
          { type: 'link' as const, text: 'Access Points', href: 's3' },
          { type: 'link' as const, text: 'Static Website Hosting', href: 's3' },
          { type: 'link' as const, text: 'Event Notifications Hub', href: 's3' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'ec2':
        return [
          {
            type: 'section' as const,
            text: 'Instances',
            items: [
              { type: 'link' as const, text: 'Instances', href: 'ec2', icon: <AwsServiceIcon service="ec2" size={18} /> },
              { type: 'link' as const, text: 'Launch Templates', href: 'ec2' },
              { type: 'link' as const, text: 'Spot Requests', href: 'ec2' },
            ],
          },
          {
            type: 'section' as const,
            text: 'Network & Security',
            items: [
              { type: 'link' as const, text: 'Security Groups', href: 'ec2' },
              { type: 'link' as const, text: 'VPCs & Subnets', href: 'ec2' },
              { type: 'link' as const, text: 'Elastic IPs', href: 'ec2' },
            ],
          },
          {
            type: 'section' as const,
            text: 'Elastic Block Store',
            items: [
              { type: 'link' as const, text: 'Volumes', href: 'ec2' },
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
              { type: 'link' as const, text: 'User Groups', href: 'iam' },
              { type: 'link' as const, text: 'Users', href: 'iam' },
              { type: 'link' as const, text: 'Roles', href: 'iam', icon: <AwsServiceIcon service="iam" size={18} /> },
              { type: 'link' as const, text: 'Policies', href: 'iam' },
            ],
          },
          {
            type: 'section' as const,
            text: 'Access Analysis',
            items: [
              { type: 'link' as const, text: 'Policy Simulator', href: 'iam' },
              { type: 'link' as const, text: 'Session Identity & STS', href: 'environment' },
            ],
          },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'dynamodb':
        return [
          { type: 'link' as const, text: 'Tables', href: 'dynamodb', icon: <AwsServiceIcon service="dynamodb" size={18} /> },
          { type: 'link' as const, text: 'Explore Items (CRUD)', href: 'dynamodb' },
          { type: 'link' as const, text: 'PartiQL SQL Editor', href: 'dynamodb' },
          { type: 'link' as const, text: 'Overview & Schema', href: 'dynamodb' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'lambda':
        return [
          { type: 'link' as const, text: 'Functions', href: 'lambda', icon: <AwsServiceIcon service="lambda" size={18} /> },
          { type: 'link' as const, text: 'Function URLs (Public)', href: 'lambda' },
          { type: 'link' as const, text: 'Triggers (Event Sources)', href: 'lambda' },
          { type: 'link' as const, text: 'Versions & Aliases', href: 'lambda' },
          { type: 'link' as const, text: 'Test Invocation Studio', href: 'lambda' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'sqs':
        return [
          { type: 'link' as const, text: 'Queues', href: 'sqs', icon: <AwsServiceIcon service="sqs" size={18} /> },
          { type: 'link' as const, text: 'Dead-Letter Queues (DLQ)', href: 'sqs' },
          { type: 'link' as const, text: 'Send & Receive Messages', href: 'sqs' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'sns':
        return [
          { type: 'link' as const, text: 'Topics', href: 'sns', icon: <AwsServiceIcon service="sns" size={18} /> },
          { type: 'link' as const, text: 'Subscriptions', href: 'sns' },
          { type: 'link' as const, text: 'Publish Messages', href: 'sns' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'rds':
        return [
          { type: 'link' as const, text: 'Databases', href: 'rds', icon: <AwsServiceIcon service="rds" size={18} /> },
          { type: 'link' as const, text: 'Subnet Groups', href: 'rds' },
          { type: 'link' as const, text: 'Parameter Groups', href: 'rds' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'kms':
        return [
          { type: 'link' as const, text: 'Customer Managed Keys', href: 'kms', icon: <AwsServiceIcon service="kms" size={18} /> },
          { type: 'link' as const, text: 'Key Aliases', href: 'kms' },
          { type: 'link' as const, text: 'Cryptographic Workbench', href: 'kms' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'secretsmanager':
        return [
          { type: 'link' as const, text: 'Secrets', href: 'secretsmanager', icon: <AwsServiceIcon service="secretsmanager" size={18} /> },
          { type: 'link' as const, text: 'Store Secret Wizard', href: 'secretsmanager' },
          { type: 'link' as const, text: 'Decryption & Reveal Studio', href: 'secretsmanager' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'cloudformation':
        return [
          { type: 'link' as const, text: 'Stacks', href: 'cloudformation', icon: <AwsServiceIcon service="cloudformation" size={18} /> },
          { type: 'link' as const, text: 'Stack Outputs & Resources', href: 'cloudformation' },
          { type: 'link' as const, text: 'Template YAML/JSON Viewer', href: 'cloudformation' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'route53':
        return [
          { type: 'link' as const, text: 'Hosted Zones', href: 'route53', icon: <AwsServiceIcon service="route53" size={18} /> },
          { type: 'link' as const, text: 'DNS Resource Records', href: 'route53' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'eventbridge':
        return [
          { type: 'link' as const, text: 'Event Buses', href: 'eventbridge', icon: <AwsServiceIcon service="eventbridge" size={18} /> },
          { type: 'link' as const, text: 'Rules & Patterns', href: 'eventbridge' },
          { type: 'link' as const, text: 'Publish Custom Events', href: 'eventbridge' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'cloudwatch':
        return [
          { type: 'link' as const, text: 'Alarms', href: 'cloudwatch', icon: <AwsServiceIcon service="cloudwatch" size={18} /> },
          { type: 'link' as const, text: 'Log Streams & Groups', href: 'cloudwatch' },
          { type: 'link' as const, text: 'Alarm State Simulator', href: 'cloudwatch' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'stepfunctions':
        return [
          { type: 'link' as const, text: 'State Machines', href: 'stepfunctions', icon: <AwsServiceIcon service="stepfunctions" size={18} /> },
          { type: 'link' as const, text: 'Executions Studio', href: 'stepfunctions' },
          { type: 'link' as const, text: 'ASL JSON Definition', href: 'stepfunctions' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'cognito':
        return [
          { type: 'link' as const, text: 'User Pools', href: 'cognito', icon: <AwsServiceIcon service="cognito" size={18} /> },
          { type: 'link' as const, text: 'App Clients', href: 'cognito' },
          { type: 'link' as const, text: 'Users Directory', href: 'cognito' },
          { type: 'link' as const, text: 'Authentication Sandbox', href: 'cognito' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'apigateway':
        return [
          { type: 'link' as const, text: 'APIs Catalog', href: 'apigateway', icon: <AwsServiceIcon service="apigateway" size={18} /> },
          { type: 'link' as const, text: 'Routes & Resources', href: 'apigateway' },
          { type: 'link' as const, text: 'Test Request Runner', href: 'apigateway' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'ssm':
        return [
          { type: 'link' as const, text: 'Parameter Store', href: 'ssm', icon: <AwsServiceIcon service="ssm" size={18} /> },
          { type: 'link' as const, text: 'Hierarchical Explorer', href: 'ssm' },
          { type: 'link' as const, text: 'KMS Decryption Revealer', href: 'ssm' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'topology':
        return [
          { type: 'link' as const, text: 'Application Topology', href: 'topology', icon: <AwsServiceIcon service="topology" size={18} /> },
          { type: 'link' as const, text: 'Layered Canvas', href: 'topology' },
          { type: 'link' as const, text: 'Node & Edge Evidence', href: 'topology' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'labs':
        return [
          { type: 'link' as const, text: 'Labs Catalog (63)', href: 'labs', icon: <AwsServiceIcon service="labs" size={18} /> },
          { type: 'link' as const, text: 'Sequential Play-Through', href: 'labs' },
          { type: 'link' as const, text: 'Multi-SDK Inspector', href: 'labs' },
          { type: 'divider' as const },
          { type: 'link' as const, text: '← Console Home', href: 'home' },
        ];
      case 'inspector':
        return [
          { type: 'link' as const, text: 'SES Mailbox', href: 'inspector', icon: <AwsServiceIcon service="inspector" size={18} /> },
          { type: 'link' as const, text: 'SQS Message Peek', href: 'inspector' },
          { type: 'link' as const, text: 'Lambda Log Streams', href: 'inspector' },
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
        return <S3Console />;
      case 'ec2':
        return <EC2Console />;
      case 'iam':
        return <IAMConsole />;
      case 'dynamodb':
        return <DynamoDBConsole />;
      case 'lambda':
        return <LambdaConsole />;
      case 'sqs':
        return <SQSConsole />;
      case 'sns':
        return <SNSConsole />;
      case 'rds':
        return <RDSConsole />;
      case 'kms':
        return <KMSConsole />;
      case 'secretsmanager':
        return <SecretsManagerConsole />;
      case 'cloudformation':
        return <CloudFormationConsole />;
      case 'route53':
        return <Route53Console />;
      case 'eventbridge':
        return <EventBridgeConsole />;
      case 'cloudwatch':
        return <CloudWatchConsole />;
      case 'stepfunctions':
        return <StepFunctionsConsole />;
      case 'cognito':
        return <CognitoConsole />;
      case 'apigateway':
        return <ApiGatewayConsole />;
      case 'ssm':
        return <SSMConsole />;
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
        activeSideNavHref={currentView}
        onSideNavFollow={(href) => navigateTo(href)}
      >
        {renderContent()}
      </ConsoleLayout>
    </div>
  );
};
