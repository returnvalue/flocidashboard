import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// Official AWS Console 2D SVG Service Icons with authentic gradients, accents, and shapes

export const S3Icon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#5A8835" fillOpacity="0.15" />
    <path d="M12 16C12 13.79 17.37 12 24 12C30.63 12 36 13.79 36 16V32C36 34.21 30.63 36 24 36C17.37 36 12 34.21 12 32V16Z" fill="#7AA116" />
    <ellipse cx="24" cy="16" rx="12" ry="4" fill="#95C822" />
    <path d="M12 22C12 24.21 17.37 26 24 26C30.63 26 36 24.21 36 22" stroke="#527806" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 28C12 30.21 17.37 32 24 32C30.63 32 36 30.21 36 28" stroke="#527806" strokeWidth="1.5" strokeLinecap="round" />
    <ellipse cx="24" cy="16" rx="6" ry="2" fill="#527806" fillOpacity="0.4" />
  </svg>
);

export const EC2Icon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#ED7100" fillOpacity="0.15" />
    <rect x="12" y="12" width="24" height="24" rx="3" fill="#FF9900" />
    <path d="M16 18H32M16 24H32M16 30H32" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    <circle cx="28" cy="18" r="1.5" fill="#232F3E" />
    <circle cx="28" cy="24" r="1.5" fill="#232F3E" />
    <circle cx="28" cy="30" r="1.5" fill="#232F3E" />
    <path d="M8 20L12 20M8 28L12 28M36 20L40 20M36 28L40 28M20 8L20 12M28 8L28 12M20 36L20 40M28 36L28 40" stroke="#ED7100" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const IAMIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#DD344C" fillOpacity="0.15" />
    <path d="M24 10L36 14.5V23C36 30.5 30.8 37.3 24 39C17.2 37.3 12 30.5 12 23V14.5L24 10Z" fill="#DD344C" />
    <path d="M24 18C21.8 18 20 19.8 20 22C20 23.8 21.2 25.3 22.8 25.8L21 31H27L25.2 25.8C26.8 25.3 28 23.8 28 22C28 19.8 26.2 18 24 18Z" fill="#FFFFFF" />
  </svg>
);

export const DynamoDBIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#2E27AD" fillOpacity="0.15" />
    <rect x="13" y="12" width="22" height="24" rx="4" fill="#3B48CC" />
    <ellipse cx="24" cy="16" rx="11" ry="4" fill="#5263FF" />
    <path d="M13 22C13 24.2 17.9 26 24 26C30.1 26 35 24.2 35 22" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M13 28C13 30.2 17.9 32 24 32C30.1 32 35 30.2 35 28" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M25 18L21 24H26L23 30" stroke="#FFD814" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const LambdaIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#ED7100" fillOpacity="0.15" />
    <path d="M24 10L36 17V31L24 38L12 31V17L24 10Z" fill="#FF9900" />
    <path d="M19 31L23.5 22.5L20.5 17H24.5L26 20.5L30 17H32.5L25.5 23L29 31H25L23 25.5L19 31Z" fill="#FFFFFF" />
  </svg>
);

export const SQSIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#D91535" fillOpacity="0.15" />
    <rect x="12" y="15" width="24" height="18" rx="3" fill="#E7157B" />
    <path d="M14 17L24 25L34 17" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    <path d="M18 36L24 40L30 36" stroke="#E7157B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18 12L24 8L30 12" stroke="#E7157B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SNSIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#D91535" fillOpacity="0.15" />
    <rect x="12" y="14" width="24" height="20" rx="3" fill="#E7157B" />
    <circle cx="24" cy="24" r="4" fill="#FFFFFF" />
    <path d="M30 18C31.5 19.5 32 21.7 32 24C32 26.3 31.5 28.5 30 30" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    <path d="M18 18C16.5 19.5 16 21.7 16 24C16 26.3 16.5 28.5 18 30" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const RDSIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#2E27AD" fillOpacity="0.15" />
    <ellipse cx="24" cy="15" rx="12" ry="4.5" fill="#3B48CC" />
    <path d="M12 15V33C12 35.5 17.4 37.5 24 37.5C30.6 37.5 36 35.5 36 33V15" stroke="#3B48CC" strokeWidth="2" fill="#2E27AD" fillOpacity="0.4" />
    <ellipse cx="24" cy="24" rx="12" ry="4.5" stroke="#3B48CC" strokeWidth="1.5" />
    <ellipse cx="24" cy="33" rx="12" ry="4.5" stroke="#3B48CC" strokeWidth="1.5" />
    <circle cx="24" cy="24" r="2.5" fill="#5263FF" />
  </svg>
);

export const KMSIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#DD344C" fillOpacity="0.15" />
    <rect x="14" y="20" width="20" height="16" rx="3" fill="#DD344C" />
    <path d="M18 20V16C18 12.7 20.7 10 24 10C27.3 10 30 12.7 30 16V20" stroke="#DD344C" strokeWidth="3" strokeLinecap="round" />
    <circle cx="24" cy="27" r="2.5" fill="#FFFFFF" />
    <path d="M24 29.5V33" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const SecretsManagerIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#DD344C" fillOpacity="0.15" />
    <path d="M13 14H35V34H13V14Z" fill="#DD344C" rx="3" />
    <path d="M19 14V11C19 8.2 21.2 6 24 6C26.8 6 29 8.2 29 11V14" stroke="#DD344C" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="24" cy="22" r="3" fill="#FFD814" />
    <path d="M24 25V30M21 28H27" stroke="#FFD814" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const CloudFormationIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#ED7100" fillOpacity="0.15" />
    <path d="M24 11L35 17.5V30.5L24 37L13 30.5V17.5L24 11Z" fill="#FF9900" />
    <path d="M24 11V37M13 17.5L35 30.5M35 17.5L13 30.5" stroke="#FFFFFF" strokeWidth="1.5" />
    <circle cx="24" cy="24" r="3" fill="#232F3E" />
  </svg>
);

export const Route53Icon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#8C4FFF" fillOpacity="0.15" />
    <circle cx="24" cy="24" r="13" fill="#8C4FFF" />
    <path d="M11 24H37M24 11C27.5 15 29.5 19.5 29.5 24C29.5 28.5 27.5 33 24 37C20.5 33 18.5 28.5 18.5 24C18.5 19.5 20.5 15 24 11Z" stroke="#FFFFFF" strokeWidth="1.5" />
    <path d="M29 17L34 22L29 27" stroke="#FFD814" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const EventBridgeIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#D91535" fillOpacity="0.15" />
    <rect x="12" y="12" width="24" height="24" rx="4" fill="#E7157B" />
    <circle cx="18" cy="18" r="2.5" fill="#FFFFFF" />
    <circle cx="30" cy="18" r="2.5" fill="#FFFFFF" />
    <circle cx="24" cy="30" r="2.5" fill="#FFFFFF" />
    <path d="M18 18L24 24L30 18M24 24V30" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const CloudWatchIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#ED7100" fillOpacity="0.15" />
    <rect x="12" y="12" width="24" height="24" rx="4" fill="#FF9900" />
    <path d="M15 30L21 23L27 27L33 18" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="33" cy="18" r="2" fill="#232F3E" />
  </svg>
);

export const StepFunctionsIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#D91535" fillOpacity="0.15" />
    <rect x="13" y="11" width="10" height="10" rx="2" fill="#E7157B" />
    <rect x="25" y="19" width="10" height="10" rx="2" fill="#E7157B" />
    <rect x="13" y="27" width="10" height="10" rx="2" fill="#E7157B" />
    <path d="M18 21V27M23 16H25M25 29H23" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const CognitoIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#DD344C" fillOpacity="0.15" />
    <path d="M24 10L35 15V24C35 31 29.8 37 24 39C18.2 37 13 31 13 24V15L24 10Z" fill="#DD344C" />
    <circle cx="24" cy="20" r="3.5" fill="#FFFFFF" />
    <path d="M18 31C18 27.7 20.7 25 24 25C27.3 25 30 27.7 30 31" fill="#FFFFFF" />
  </svg>
);

export const ApiGatewayIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#8C4FFF" fillOpacity="0.15" />
    <path d="M14 36V16C14 13.8 15.8 12 18 12H30C32.2 12 34 13.8 34 16V36" stroke="#8C4FFF" strokeWidth="3" fill="#8C4FFF" fillOpacity="0.3" />
    <rect x="20" y="22" width="8" height="14" rx="2" fill="#FFFFFF" />
    <path d="M24 12V22M14 24H20M28 24H34" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const SSMIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#2E27AD" fillOpacity="0.15" />
    <rect x="12" y="12" width="24" height="24" rx="4" fill="#3B48CC" />
    <path d="M16 18H32M16 24H32M16 30H32" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    <circle cx="20" cy="18" r="2.5" fill="#FFD814" />
    <circle cx="28" cy="24" r="2.5" fill="#FFD814" />
    <circle cx="22" cy="30" r="2.5" fill="#FFD814" />
  </svg>
);

export const TopologyGraphIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#0972D3" fillOpacity="0.15" />
    <circle cx="15" cy="24" r="4" fill="#FF9900" />
    <circle cx="33" cy="15" r="4" fill="#5263FF" />
    <circle cx="33" cy="33" r="4" fill="#E7157B" />
    <path d="M15 24L33 15M15 24L33 33" stroke="#0972D3" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const LabsIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#FF9900" fillOpacity="0.15" />
    <path d="M21 11H27V17L33 29C34 31 32.5 33 30.5 33H17.5C15.5 33 14 31 15 29L21 17V11Z" fill="#FF9900" />
    <path d="M17 26C19 25 21 27 24 26C27 25 29 27 31 26L32.5 29C33 30.5 32 31.5 30.5 31.5H17.5C16 31.5 15 30.5 15.5 29L17 26Z" fill="#FFFFFF" fillOpacity="0.4" />
  </svg>
);

export const ECSIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#ED7100" fillOpacity="0.15" />
    <path d="M24 10L37 17.5V32.5L24 40L11 32.5V17.5L24 10Z" fill="#ED7100" />
    <path d="M24 10V25L37 17.5M24 25L11 17.5M24 25V40" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="18" y="19" width="12" height="12" rx="2" fill="#FFFFFF" />
    <rect x="21" y="22" width="6" height="6" rx="1" fill="#ED7100" />
  </svg>
);

export const ECRIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#ED7100" fillOpacity="0.15" />
    <path d="M24 10L36 17V31L24 38L12 31V17L24 10Z" fill="#ED7100" />
    <circle cx="24" cy="24" r="7" fill="#FFFFFF" />
    <circle cx="24" cy="24" r="4" fill="#ED7100" />
    <path d="M24 12V17M24 31V36M14 24H19M29 24H34" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const CloudFrontIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#8C4FFF" fillOpacity="0.15" />
    <circle cx="24" cy="24" r="14" fill="#8C4FFF" />
    <circle cx="24" cy="24" r="10" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 3" />
    <circle cx="24" cy="24" r="5" fill="#FFFFFF" />
    <circle cx="14" cy="24" r="2.5" fill="#FFD814" />
    <circle cx="34" cy="24" r="2.5" fill="#FFD814" />
    <circle cx="24" cy="14" r="2.5" fill="#FFD814" />
    <circle cx="24" cy="34" r="2.5" fill="#FFD814" />
  </svg>
);

export const ELBv2Icon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#8C4FFF" fillOpacity="0.15" />
    <rect x="12" y="14" width="24" height="20" rx="4" fill="#8C4FFF" />
    <circle cx="18" cy="24" r="3" fill="#FFFFFF" />
    <circle cx="30" cy="19" r="2.5" fill="#FFFFFF" />
    <circle cx="30" cy="29" r="2.5" fill="#FFFFFF" />
    <path d="M21 24L27.5 19M21 24L27.5 29" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const AthenaIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#2E27AD" fillOpacity="0.15" />
    <circle cx="24" cy="24" r="14" fill="#3B48CC" />
    <circle cx="21" cy="21" r="6" stroke="#FFFFFF" strokeWidth="2.5" fill="none" />
    <path d="M26 26L33 33" stroke="#FFD814" strokeWidth="3" strokeLinecap="round" />
    <path d="M18 21H24M21 18V24" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const AppSyncIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#E7157B" fillOpacity="0.15" />
    <path d="M24 10L36 17V31L24 38L12 31V17L24 10Z" stroke="#E7157B" strokeWidth="2.5" fill="#E7157B" fillOpacity="0.2" />
    <circle cx="24" cy="17" r="3" fill="#E7157B" />
    <circle cx="16" cy="30" r="3" fill="#E7157B" />
    <circle cx="32" cy="30" r="3" fill="#E7157B" />
    <path d="M24 17L16 30M24 17L32 30M16 30H32" stroke="#E7157B" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const SESIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#D91535" fillOpacity="0.15" />
    <rect x="11" y="14" width="26" height="20" rx="3" fill="#E7157B" />
    <path d="M13 16L24 25L35 16" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 32L20 25M35 32L28 25" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const InspectorIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#0972D3" fillOpacity="0.15" />
    <circle cx="22" cy="22" r="8" stroke="#0972D3" strokeWidth="3" fill="none" />
    <path d="M28 28L36 36" stroke="#0972D3" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M19 22H25M22 19V25" stroke="#0972D3" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const AwsGenericServiceIcon: React.FC<IconProps & { serviceKey?: string }> = ({ size = 24, style, serviceKey }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#545B64" fillOpacity="0.2" />
    <rect x="12" y="12" width="24" height="24" rx="4" fill="#545B64" />
    <text x="24" y="28" fill="#FFFFFF" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
      {(serviceKey || 'AWS').substring(0, 3).toUpperCase()}
    </text>
  </svg>
);

// Helper to resolve an icon by AWS service key
export const AwsServiceIcon: React.FC<IconProps & { service: string }> = ({ service, size = 24, style }) => {
  const s = (service || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  switch (s) {
    case 's3':
      return <S3Icon size={size} style={style} />;
    case 'ec2':
    case 'vpc':
      return <EC2Icon size={size} style={style} />;
    case 'ecs':
      return <ECSIcon size={size} style={style} />;
    case 'ecr':
      return <ECRIcon size={size} style={style} />;
    case 'iam':
    case 'sts':
      return <IAMIcon size={size} style={style} />;
    case 'dynamodb':
      return <DynamoDBIcon size={size} style={style} />;
    case 'lambda':
      return <LambdaIcon size={size} style={style} />;
    case 'sqs':
      return <SQSIcon size={size} style={style} />;
    case 'sns':
      return <SNSIcon size={size} style={style} />;
    case 'ses':
      return <SESIcon size={size} style={style} />;
    case 'rds':
      return <RDSIcon size={size} style={style} />;
    case 'kms':
      return <KMSIcon size={size} style={style} />;
    case 'secretsmanager':
      return <SecretsManagerIcon size={size} style={style} />;
    case 'cloudformation':
      return <CloudFormationIcon size={size} style={style} />;
    case 'cloudfront':
      return <CloudFrontIcon size={size} style={style} />;
    case 'elasticloadbalancing':
    case 'elbv2':
    case 'elb':
      return <ELBv2Icon size={size} style={style} />;
    case 'athena':
      return <AthenaIcon size={size} style={style} />;
    case 'appsync':
      return <AppSyncIcon size={size} style={style} />;
    case 'route53':
      return <Route53Icon size={size} style={style} />;
    case 'events':
    case 'eventbridge':
      return <EventBridgeIcon size={size} style={style} />;
    case 'logs':
    case 'cloudwatch':
      return <CloudWatchIcon size={size} style={style} />;
    case 'stepfunctions':
    case 'states':
      return <StepFunctionsIcon size={size} style={style} />;
    case 'cognito':
    case 'cognitoidp':
      return <CognitoIcon size={size} style={style} />;
    case 'apigateway':
    case 'apigatewayv2':
      return <ApiGatewayIcon size={size} style={style} />;
    case 'ssm':
      return <SSMIcon size={size} style={style} />;
    case 'topology':
    case 'resourcegraph':
      return <TopologyGraphIcon size={size} style={style} />;
    case 'labs':
      return <LabsIcon size={size} style={style} />;
    case 'inspector':
      return <InspectorIcon size={size} style={style} />;
    default:
      return <AwsGenericServiceIcon serviceKey={service} size={size} style={style} />;
  }
};
