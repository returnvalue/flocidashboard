import React, { useState } from 'react';
import AppLayout from '@cloudscape-design/components/app-layout';
import SideNavigation, { SideNavigationProps } from '@cloudscape-design/components/side-navigation';
import BreadcrumbGroup, { BreadcrumbGroupProps } from '@cloudscape-design/components/breadcrumb-group';
import Flashbar, { FlashbarProps } from '@cloudscape-design/components/flashbar';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';

interface ConsoleLayoutProps {
  breadcrumbs: BreadcrumbGroupProps.Item[];
  sideNavHeader: { href: string; text: string };
  sideNavItems: SideNavigationProps.Item[];
  activeSideNavHref: string;
  onSideNavFollow: (href: string) => void;
  notifications?: FlashbarProps.MessageDefinition[];
  toolsContent?: React.ReactNode;
  children: React.ReactNode;
}

export const ConsoleLayout: React.FC<ConsoleLayoutProps> = ({
  breadcrumbs,
  sideNavHeader,
  sideNavItems,
  activeSideNavHref,
  onSideNavFollow,
  notifications = [],
  toolsContent,
  children,
}) => {
  const [toolsOpen, setToolsOpen] = useState(false);

  return (
    <AppLayout
      breadcrumbs={
        <BreadcrumbGroup
          items={breadcrumbs}
          onFollow={(e) => {
            e.preventDefault();
            onSideNavFollow(e.detail.href);
          }}
        />
      }
      navigation={
        <SideNavigation
          header={sideNavHeader}
          activeHref={activeSideNavHref}
          onFollow={(e) => {
            e.preventDefault();
            onSideNavFollow(e.detail.href);
          }}
          items={sideNavItems}
        />
      }
      notifications={notifications.length > 0 ? <Flashbar items={notifications} /> : undefined}
      toolsOpen={toolsOpen}
      onToolsChange={(e) => setToolsOpen(e.detail.open)}
      tools={
        toolsContent || (
          <Container header={<Header variant="h2">AWS Console Info & Help</Header>}>
            <SpaceBetween size="m">
              <p>
                You are using the <strong>Floci Local AWS Console</strong> powered by Cloudscape.
              </p>
              <div>
                <strong>Local Endpoint:</strong>
                <p>
                  <code>http://localhost:4566</code>
                </p>
              </div>
              <div>
                <strong>Authentication:</strong>
                <p>IAM policy enforcement active</p>
              </div>
            </SpaceBetween>
          </Container>
        )
      }
      content={children}
    />
  );
};
