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
import { fetchIdentity, fetchServices } from './api/client';
import { IdentityInfo, ServiceDefinition } from './types';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';

function getInitialView(): string {
  const path = window.location.pathname.replace(/^\/app\/?/, '').replace(/^\//, '').replace(/\/$/, '');
  if (!path || path === 'app' || path === 'home') return 'home';
  if (path.startsWith('service/')) return path.replace('service/', '');
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
    const svc = services.find((s) => s.key === currentView);
    return [
      { text: 'AWS Management Console', href: 'home' },
      { text: svc ? svc.title : currentView.toUpperCase(), href: currentView },
    ];
  };

  const getSideNavItems = () => {
    return [
      { type: 'link' as const, text: 'Console Home', href: 'home' },
      { type: 'link' as const, text: 'Workflow Labs (63)', href: 'labs' },
      { type: 'divider' as const },
      {
        type: 'section' as const,
        text: 'Core AWS Services',
        items: [
          { type: 'link' as const, text: 'Amazon S3', href: 's3' },
          { type: 'link' as const, text: 'Amazon EC2', href: 'ec2' },
          { type: 'link' as const, text: 'AWS IAM', href: 'iam' },
          { type: 'link' as const, text: 'Amazon DynamoDB', href: 'dynamodb' },
          { type: 'link' as const, text: 'AWS Lambda', href: 'lambda' },
          { type: 'link' as const, text: 'Amazon SQS', href: 'sqs' },
          { type: 'link' as const, text: 'Amazon SNS', href: 'sns' },
          { type: 'link' as const, text: 'Amazon RDS', href: 'rds' },
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
      case 'labs':
        return <LabsConsole />;
      default:
        const svc = services.find((s) => s.key === currentView);
        return (
          <Container
            header={
              <Header
                variant="h1"
                description={svc?.eyebrow || 'Local AWS Service Workbench'}
                actions={
                  <Button variant="primary" onClick={() => navigateTo('labs')}>
                    Open Guided Labs
                  </Button>
                }
              >
                {svc ? svc.title : currentView.toUpperCase()}
              </Header>
            }
          >
            <SpaceBetween size="m">
              <p>
                Service <strong>{svc?.title || currentView}</strong> is active and healthy in Floci.
              </p>
              <p>
                Category: <strong>{svc?.category || 'Database / Compute'}</strong>
              </p>
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
