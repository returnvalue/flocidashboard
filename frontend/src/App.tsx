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

  const getSideNavItems = () => {
    return [
      { type: 'link' as const, text: 'Console Home', href: 'home', icon: <AwsServiceIcon service="aws" size={18} /> },
      { type: 'link' as const, text: 'Workflow Labs (63)', href: 'labs', icon: <AwsServiceIcon service="labs" size={18} /> },
      { type: 'link' as const, text: 'Local Inspector Inbox', href: 'inspector', icon: <AwsServiceIcon service="inspector" size={18} /> },
      { type: 'divider' as const },
      {
        type: 'section' as const,
        text: 'Developer Tools & Management',
        items: [
          { type: 'link' as const, text: 'Architecture Topology Graph', href: 'topology', icon: <AwsServiceIcon service="topology" size={18} /> },
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
      <ConsoleLayout
        breadcrumbs={getBreadcrumbs()}
        sideNavHeader={{ href: 'home', text: 'AWS Console' }}
        sideNavItems={getSideNavItems()}
        activeSideNavHref={currentView}
        onSideNavFollow={(href) => navigateTo(href)}
      >
        {renderContent()}
      </ConsoleLayout>
    </div>
  );
};
