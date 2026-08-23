import React, { useState, useEffect } from 'react';
import { TopNav } from './components/TopNav';
import { ConsoleLayout } from './components/ConsoleLayout';
import { ConsoleHome } from './pages/ConsoleHome';
import { S3Console } from './pages/S3Console';
import { EC2Console } from './pages/EC2Console';
import { IAMConsole } from './pages/IAMConsole';
import { LabsConsole } from './pages/LabsConsole';
import { fetchIdentity, fetchServices } from './api/client';
import { IdentityInfo, ServiceDefinition } from './types';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';

export const App: React.FC = () => {
  const [identity, setIdentity] = useState<IdentityInfo | null>(null);
  const [services, setServices] = useState<ServiceDefinition[]>([]);
  const [currentView, setCurrentView] = useState<string>('home');

  useEffect(() => {
    fetchIdentity().then(setIdentity);
    fetchServices().then(setServices);
  }, []);

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
        text: 'Core Services',
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
            onSelectService={(key) => setCurrentView(key)}
            onNavigateLabs={() => setCurrentView('labs')}
          />
        );
      case 's3':
        return <S3Console />;
      case 'ec2':
        return <EC2Console />;
      case 'iam':
        return <IAMConsole />;
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
                  <Button variant="primary" href={`/service/${currentView}/`}>
                    Open Dedicated Workbench
                  </Button>
                }
              >
                {svc ? svc.title : currentView.toUpperCase()}
              </Header>
            }
          >
            <SpaceBetween size="m">
              <p>
                Service <strong>{svc?.title || currentView}</strong> is active in Floci.
              </p>
              <Button href={`/service/${currentView}/labs/`}>
                Open {svc?.title || currentView} Guided Labs ↗
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
        onSelectService={(key) => setCurrentView(key)}
        onNavigateHome={() => setCurrentView('home')}
        onNavigateLabs={() => setCurrentView('labs')}
      />
      <ConsoleLayout
        breadcrumbs={getBreadcrumbs()}
        sideNavHeader={{ href: 'home', text: 'AWS Console' }}
        sideNavItems={getSideNavItems()}
        activeSideNavHref={currentView}
        onSideNavFollow={(href) => setCurrentView(href)}
      >
        {renderContent()}
      </ConsoleLayout>
    </div>
  );
};
