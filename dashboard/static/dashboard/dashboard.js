const refreshButton = document.querySelector('#refresh');
const loadedAt = document.querySelector('#loaded-at');
const iamLoadedAt = document.querySelector('#iam-loaded-at');
const health = document.querySelector('#health');
const endpoint = document.querySelector('#endpoint');
const profile = document.querySelector('#profile');
const identity = document.querySelector('#identity');
const serviceGrid = document.querySelector('#service-grid');
const iamGrid = document.querySelector('#iam-grid');
const iamSummary = document.querySelector('#iam-summary');
const s3Grid = document.querySelector('#s3-grid');
const s3Summary = document.querySelector('#s3-summary');
const s3LoadedAt = document.querySelector('#s3-loaded-at');
const ec2Grid = document.querySelector('#ec2-grid');
const ec2Summary = document.querySelector('#ec2-summary');
const ec2LoadedAt = document.querySelector('#ec2-loaded-at');
const kmsGrid = document.querySelector('#kms-grid');
const kmsSummary = document.querySelector('#kms-summary');
const kmsLoadedAt = document.querySelector('#kms-loaded-at');
const lambdaGrid = document.querySelector('#lambda-grid');
const lambdaSummary = document.querySelector('#lambda-summary');
const lambdaLoadedAt = document.querySelector('#lambda-loaded-at');
const sqsGrid = document.querySelector('#sqs-grid');
const sqsSummary = document.querySelector('#sqs-summary');
const sqsLoadedAt = document.querySelector('#sqs-loaded-at');
const secretsmanagerGrid = document.querySelector('#secretsmanager-grid');
const secretsmanagerSummary = document.querySelector('#secretsmanager-summary');
const secretsmanagerLoadedAt = document.querySelector('#secretsmanager-loaded-at');
const dynamodbGrid = document.querySelector('#dynamodb-grid');
const dynamodbSummary = document.querySelector('#dynamodb-summary');
const dynamodbLoadedAt = document.querySelector('#dynamodb-loaded-at');
const cloudwatchGrid = document.querySelector('#cloudwatch-grid');
const cloudwatchSummary = document.querySelector('#cloudwatch-summary');
const cloudwatchLoadedAt = document.querySelector('#cloudwatch-loaded-at');
const codebuildGrid = document.querySelector('#codebuild-grid');
const codebuildSummary = document.querySelector('#codebuild-summary');
const codebuildLoadedAt = document.querySelector('#codebuild-loaded-at');
const codedeployGrid = document.querySelector('#codedeploy-grid');
const codedeploySummary = document.querySelector('#codedeploy-summary');
const codedeployLoadedAt = document.querySelector('#codedeploy-loaded-at');
const eventbridgeGrid = document.querySelector('#eventbridge-grid');
const eventbridgeSummary = document.querySelector('#eventbridge-summary');
const eventbridgeLoadedAt = document.querySelector('#eventbridge-loaded-at');
const cognitoGrid = document.querySelector('#cognito-grid');
const cognitoSummary = document.querySelector('#cognito-summary');
const cognitoLoadedAt = document.querySelector('#cognito-loaded-at');
const apigatewayGrid = document.querySelector('#apigateway-grid');
const apigatewaySummary = document.querySelector('#apigateway-summary');
const apigatewayLoadedAt = document.querySelector('#apigateway-loaded-at');
const appconfigGrid = document.querySelector('#appconfig-grid');
const appconfigSummary = document.querySelector('#appconfig-summary');
const appconfigLoadedAt = document.querySelector('#appconfig-loaded-at');
const ecsGrid = document.querySelector('#ecs-grid');
const ecsSummary = document.querySelector('#ecs-summary');
const ecsLoadedAt = document.querySelector('#ecs-loaded-at');
const eksGrid = document.querySelector('#eks-grid');
const eksSummary = document.querySelector('#eks-summary');
const eksLoadedAt = document.querySelector('#eks-loaded-at');
const elasticacheGrid = document.querySelector('#elasticache-grid');
const elasticacheSummary = document.querySelector('#elasticache-summary');
const elasticacheLoadedAt = document.querySelector('#elasticache-loaded-at');
const elasticloadbalancingGrid = document.querySelector('#elasticloadbalancing-grid');
const elasticloadbalancingSummary = document.querySelector('#elasticloadbalancing-summary');
const elasticloadbalancingLoadedAt = document.querySelector('#elasticloadbalancing-loaded-at');
const firehoseGrid = document.querySelector('#firehose-grid');
const firehoseSummary = document.querySelector('#firehose-summary');
const firehoseLoadedAt = document.querySelector('#firehose-loaded-at');
const kinesisGrid = document.querySelector('#kinesis-grid');
const kinesisSummary = document.querySelector('#kinesis-summary');
const kinesisLoadedAt = document.querySelector('#kinesis-loaded-at');
const kafkaGrid = document.querySelector('#kafka-grid');
const kafkaSummary = document.querySelector('#kafka-summary');
const kafkaLoadedAt = document.querySelector('#kafka-loaded-at');
const opensearchGrid = document.querySelector('#opensearch-grid');
const opensearchSummary = document.querySelector('#opensearch-summary');
const opensearchLoadedAt = document.querySelector('#opensearch-loaded-at');
const pipesGrid = document.querySelector('#pipes-grid');
const pipesSummary = document.querySelector('#pipes-summary');
const pipesLoadedAt = document.querySelector('#pipes-loaded-at');
const resourcegroupstaggingGrid = document.querySelector('#resourcegroupstagging-grid');
const resourcegroupstaggingSummary = document.querySelector('#resourcegroupstagging-summary');
const resourcegroupstaggingLoadedAt = document.querySelector('#resourcegroupstagging-loaded-at');
const ssmGrid = document.querySelector('#ssm-grid');
const ssmSummary = document.querySelector('#ssm-summary');
const ssmLoadedAt = document.querySelector('#ssm-loaded-at');
const athenaGrid = document.querySelector('#athena-grid');
const athenaSummary = document.querySelector('#athena-summary');
const athenaLoadedAt = document.querySelector('#athena-loaded-at');
const autoscalingGrid = document.querySelector('#autoscaling-grid');
const autoscalingSummary = document.querySelector('#autoscaling-summary');
const autoscalingLoadedAt = document.querySelector('#autoscaling-loaded-at');
const backupGrid = document.querySelector('#backup-grid');
const backupSummary = document.querySelector('#backup-summary');
const backupLoadedAt = document.querySelector('#backup-loaded-at');
const bedrockruntimeGrid = document.querySelector('#bedrockruntime-grid');
const bedrockruntimeSummary = document.querySelector('#bedrockruntime-summary');
const bedrockruntimeLoadedAt = document.querySelector('#bedrockruntime-loaded-at');
const snsGrid = document.querySelector('#sns-grid');
const snsSummary = document.querySelector('#sns-summary');
const snsLoadedAt = document.querySelector('#sns-loaded-at');
const sesGrid = document.querySelector('#ses-grid');
const sesSummary = document.querySelector('#ses-summary');
const sesLoadedAt = document.querySelector('#ses-loaded-at');
const cloudformationGrid = document.querySelector('#cloudformation-grid');
const cloudformationSummary = document.querySelector('#cloudformation-summary');
const cloudformationLoadedAt = document.querySelector('#cloudformation-loaded-at');
const ecrGrid = document.querySelector('#ecr-grid');
const ecrSummary = document.querySelector('#ecr-summary');
const ecrLoadedAt = document.querySelector('#ecr-loaded-at');
const rdsGrid = document.querySelector('#rds-grid');
const rdsSummary = document.querySelector('#rds-summary');
const rdsLoadedAt = document.querySelector('#rds-loaded-at');
const route53Grid = document.querySelector('#route53-grid');
const route53Summary = document.querySelector('#route53-summary');
const route53LoadedAt = document.querySelector('#route53-loaded-at');
const transferGrid = document.querySelector('#transfer-grid');
const transferSummary = document.querySelector('#transfer-summary');
const transferLoadedAt = document.querySelector('#transfer-loaded-at');
const acmGrid = document.querySelector('#acm-grid');
const acmSummary = document.querySelector('#acm-summary');
const acmLoadedAt = document.querySelector('#acm-loaded-at');
const stepfunctionsGrid = document.querySelector('#stepfunctions-grid');
const stepfunctionsSummary = document.querySelector('#stepfunctions-summary');
const stepfunctionsLoadedAt = document.querySelector('#stepfunctions-loaded-at');
const schedulerGrid = document.querySelector('#scheduler-grid');
const schedulerSummary = document.querySelector('#scheduler-summary');
const schedulerLoadedAt = document.querySelector('#scheduler-loaded-at');
const glueGrid = document.querySelector('#glue-grid');
const glueSummary = document.querySelector('#glue-summary');
const glueLoadedAt = document.querySelector('#glue-loaded-at');

let latestHealthData = null;

const flociCloudImage = '/static/dashboard/flocicloud.png';
const minimumLoadingMs = 2000;

function waitForMinimumLoadingTime(startedAt) {
  const elapsed = performance.now() - startedAt;
  const remaining = Math.max(0, minimumLoadingMs - elapsed);

  return new Promise((resolve) => window.setTimeout(resolve, remaining));
}

function activeInventoryGrids() {
  return Array.from(document.querySelectorAll('#service-grid, .iam-grid'));
}

function loadingLabelForGrid(grid) {
  if (grid.id === 'service-grid') {
    return 'services';
  }

  return titleCaseService(grid.id.replace(/-grid$/, ''));
}

function loadedAtForGrid(grid) {
  if (grid.id === 'service-grid') {
    return loadedAt;
  }

  return document.querySelector(`#${grid.id.replace(/-grid$/, '')}-loaded-at`);
}

function renderLoadingState(grid) {
  const label = loadingLabelForGrid(grid);
  const loading = document.createElement('section');
  loading.className = grid.id === 'service-grid' ? 'loading-card loading-card-services' : 'iam-panel loading-card';
  loading.setAttribute('role', 'status');
  loading.setAttribute('aria-live', 'polite');

  const imageWrap = document.createElement('div');
  imageWrap.className = 'loading-image-wrap';

  const image = document.createElement('img');
  image.className = 'loading-image';
  image.src = flociCloudImage;
  image.alt = 'Floci cloud';
  image.loading = 'eager';
  imageWrap.append(image);

  const content = document.createElement('div');
  content.className = 'loading-content';

  const title = document.createElement('p');
  title.className = 'loading-title';
  title.textContent = `Loading ${label}`;

  const indicator = document.createElement('div');
  indicator.className = 'loading-indicator';
  indicator.setAttribute('aria-hidden', 'true');

  const spinner = document.createElement('span');
  spinner.className = 'loading-spinner';

  const bar = document.createElement('span');
  bar.className = 'loading-bar';
  indicator.append(spinner, bar);

  content.append(title, indicator);
  loading.append(imageWrap, content);

  grid.setAttribute('aria-busy', 'true');
  grid.textContent = '';
  grid.append(loading);

  const loadedAtElement = loadedAtForGrid(grid);
  if (loadedAtElement) {
    loadedAtElement.textContent = 'Loading...';
  }
}

function showLoadingStates() {
  activeInventoryGrids().forEach(renderLoadingState);
}

function clearLoadingStates() {
  activeInventoryGrids().forEach((grid) => grid.setAttribute('aria-busy', 'false'));
}

const serviceDetailPages = {
  acm: '/service/acm/',
  apigateway: '/service/apigateway/',
  apigatewayv2: '/service/apigateway/',
  appconfig: 'http://127.0.0.1:8000/service/appconfig/',
  appconfigdata: 'http://127.0.0.1:8000/service/appconfig/',
  athena: '/service/athena/',
  'auto-scaling': '/service/autoscaling/',
  autoscaling: '/service/autoscaling/',
  backup: '/service/backup/',
  'bedrock-runtime': 'http://127.0.0.1:8000/service/bedrockruntime/',
  bedrockruntime: 'http://127.0.0.1:8000/service/bedrockruntime/',
  codebuild: 'http://127.0.0.1:8000/service/codebuild/',
  codedeploy: 'http://127.0.0.1:8000/service/codedeploy/',
  cloudformation: '/service/cloudformation/',
  'cognito-idp': '/service/cognito/',
  monitoring: '/service/cloudwatch/',
  logs: '/service/cloudwatch/',
  dynamodb: '/service/dynamodb/',
  ec2: '/service/ec2/',
  ecr: '/service/ecr/',
  ecs: '/service/ecs/',
  eks: 'http://127.0.0.1:8000/service/eks/',
  elasticache: 'http://127.0.0.1:8000/service/elasticache/',
  elb: 'http://127.0.0.1:8000/service/elasticloadbalancing/',
  elbv2: 'http://127.0.0.1:8000/service/elasticloadbalancing/',
  elasticloadbalancing: 'http://127.0.0.1:8000/service/elasticloadbalancing/',
  events: '/service/eventbridge/',
  firehose: 'http://127.0.0.1:8000/service/firehose/',
  glue: '/service/glue/',
  iam: '/service/iam/',
  kafka: 'http://127.0.0.1:8000/service/kafka/',
  kinesis: 'http://127.0.0.1:8000/service/kinesis/',
  kms: '/service/kms/',
  lambda: '/service/lambda/',
  es: 'http://127.0.0.1:8000/service/opensearch/',
  opensearch: 'http://127.0.0.1:8000/service/opensearch/',
  pipes: 'http://127.0.0.1:8000/service/pipes/',
  resourcegroupstagging: 'http://127.0.0.1:8000/service/resourcegroupstagging/',
  resourcegroupstaggingapi: 'http://127.0.0.1:8000/service/resourcegroupstagging/',
  rds: '/service/rds/',
  route53: '/service/route53/',
  s3: '/service/s3/',
  scheduler: '/service/scheduler/',
  secretsmanager: '/service/secretsmanager/',
  ssm: 'http://127.0.0.1:8000/service/ssm/',
  tagging: 'http://127.0.0.1:8000/service/resourcegroupstagging/',
  email: '/service/ses/',
  ses: '/service/ses/',
  sns: '/service/sns/',
  sqs: '/service/sqs/',
  states: '/service/stepfunctions/',
  stepfunctions: '/service/stepfunctions/',
  transfer: '/service/transfer/',
};

function canonicalServiceKey(name) {
  const aliases = {
    apigatewayv2: 'apigateway',
    appconfigdata: 'appconfig',
    'auto-scaling': 'autoscaling',
    bedrockruntime: 'bedrock-runtime',
    codebuild: 'codebuild',
    codedeploy: 'codedeploy',
    elb: 'elasticloadbalancing',
    elbv2: 'elasticloadbalancing',
    es: 'opensearch',
    email: 'ses',
    resourcegroupstaggingapi: 'resourcegroupstagging',
    tagging: 'resourcegroupstagging',
    states: 'stepfunctions',
  };

  return aliases[name] || name;
}

function stringifyItem(item) {
  const compact = Object.fromEntries(
    Object.entries(item).filter(([, value]) => value !== null && value !== undefined && value !== '')
  );

  return JSON.stringify(compact, null, 2);
}

function valueText(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'None';
    }

    return value.map((item) => {
      if (typeof item === 'string') {
        return item;
      }

      return stringifyItem(item);
    }).join('\n');
  }

  if (value && typeof value === 'object') {
    return stringifyItem(value);
  }

  return value || 'None';
}

function addField(card, label, value) {
  const row = document.createElement('div');
  const term = document.createElement('dt');
  const details = document.createElement('dd');

  term.textContent = label;
  details.textContent = valueText(value);
  row.append(term, details);
  card.append(row);
}

function renderSummary(summary, container) {
  container.textContent = '';

  Object.entries(summary || {}).forEach(([label, value]) => {
    const card = document.createElement('div');
    const number = document.createElement('strong');
    const caption = document.createElement('span');

    number.textContent = value;
    caption.textContent = label.replaceAll('_', ' ');
    card.append(number, caption);
    container.append(card);
  });
}

function renderDetailList(title, items, fields) {
  const section = document.createElement('section');
  section.className = 'iam-panel';
  items = Array.isArray(items) ? items : (items ? [{ name: 'Response', details: items }] : []);

  const heading = document.createElement('div');
  heading.className = 'card-heading';

  const h3 = document.createElement('h3');
  const count = document.createElement('span');
  count.className = 'count';
  h3.textContent = title;
  count.textContent = items.length;
  heading.append(h3, count);
  section.append(heading);

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'None found.';
    section.append(empty);
    return section;
  }

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'iam-item';

    const name = document.createElement('h4');
    name.textContent = item.name || item.arn || item.id || 'Unnamed';
    card.append(name);

    const list = document.createElement('dl');
    fields.forEach(([label, key]) => addField(list, label, item[key]));
    card.append(list);
    section.append(card);
  });

  return section;
}

function renderIam(data) {
  iamGrid.textContent = '';
  renderSummary(data.summary, iamSummary);

  const panels = [
    renderDetailList('Users', data.users || [], [
      ['ARN', 'arn'],
      ['Groups', 'groups'],
      ['Attached policies', 'attached_policies'],
      ['Inline policies', 'inline_policies'],
      ['Permission boundary', 'permissions_boundary'],
      ['Access keys', 'access_keys'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Groups', data.groups || [], [
      ['ARN', 'arn'],
      ['Users', 'users'],
      ['Attached policies', 'attached_policies'],
      ['Inline policies', 'inline_policies'],
    ]),
    renderDetailList('Roles', data.roles || [], [
      ['ARN', 'arn'],
      ['Trust policy', 'trust_policy'],
      ['Attached policies', 'attached_policies'],
      ['Inline policies', 'inline_policies'],
      ['Permission boundary', 'permissions_boundary'],
      ['Instance profiles', 'instance_profiles'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Customer policies', data.policies || [], [
      ['ARN', 'arn'],
      ['Default version', 'default_version'],
      ['Attachment count', 'attachment_count'],
      ['Boundary usage count', 'permissions_boundary_usage_count'],
      ['Versions', 'versions'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Instance profiles', data.instance_profiles || [], [
      ['ARN', 'arn'],
      ['Roles', 'roles'],
    ]),
  ];

  iamGrid.append(...panels);
  iamLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderS3(data) {
  s3Grid.textContent = '';
  renderSummary(data.summary, s3Summary);

  const supportPanel = renderDetailList('Floci S3 support notes', [
    {
      name: 'Supported locally',
      bucket_configuration: data.supported?.bucket_configuration || [],
      objects: data.supported?.objects || [],
      not_implemented: data.supported?.not_implemented || [],
    },
  ], [
    ['Bucket configuration', 'bucket_configuration'],
    ['Object operations', 'objects'],
    ['Not implemented', 'not_implemented'],
  ]);

  const bucketPanel = renderDetailList('Buckets', data.buckets || [], [
    ['ARN', 'arn'],
    ['Path-style URL', 'path_style_url'],
    ['Location', 'location'],
    ['Versioning', 'versioning'],
    ['Tags', 'tagging'],
    ['Bucket policy', 'policy'],
    ['CORS', 'cors'],
    ['Lifecycle', 'lifecycle'],
    ['ACL', 'acl'],
    ['Encryption', 'encryption'],
    ['Notifications', 'notification'],
    ['Public access block', 'public_access_block'],
    ['Object lock', 'object_lock'],
    ['Object count', 'object_count'],
    ['Total bytes', 'total_bytes'],
    ['Objects', 'objects'],
    ['Object versions', 'object_versions'],
  ]);

  s3Grid.append(supportPanel, bucketPanel);
  s3LoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderEC2(data) {
  ec2Grid.textContent = '';
  renderSummary(data.summary, ec2Summary);

  const panels = [
    renderDetailList('Default resources', data.default_resources || [], [
      ['Type', 'type'],
      ['ID', 'id'],
      ['Details', 'details'],
    ]),
    renderDetailList('Instances', data.instances || [], [
      ['Image ID', 'image_id'],
      ['Instance type', 'instance_type'],
      ['State', 'state'],
      ['VPC', 'vpc_id'],
      ['Subnet', 'subnet_id'],
      ['Private IP', 'private_ip'],
      ['Public IP', 'public_ip'],
      ['Security groups', 'security_groups'],
      ['Launch time', 'launch_time'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('VPCs', data.vpcs || [], [
      ['VPC ID', 'VpcId'],
      ['CIDR', 'CidrBlock'],
      ['Default', 'IsDefault'],
      ['State', 'State'],
      ['CIDR associations', 'CidrBlockAssociationSet'],
      ['Tags', 'Tags'],
    ]),
    renderDetailList('Subnets', data.subnets || [], [
      ['Subnet ID', 'SubnetId'],
      ['VPC ID', 'VpcId'],
      ['CIDR', 'CidrBlock'],
      ['Availability zone', 'AvailabilityZone'],
      ['Default for AZ', 'DefaultForAz'],
      ['Available IPs', 'AvailableIpAddressCount'],
      ['State', 'State'],
      ['Tags', 'Tags'],
    ]),
    renderDetailList('Security groups', data.security_groups || [], [
      ['Group ID', 'GroupId'],
      ['Group name', 'GroupName'],
      ['VPC ID', 'VpcId'],
      ['Description', 'Description'],
      ['Ingress', 'IpPermissions'],
      ['Egress', 'IpPermissionsEgress'],
      ['Tags', 'Tags'],
    ]),
    renderDetailList('Security group rules', data.security_group_rules || [], [
      ['Rule ID', 'SecurityGroupRuleId'],
      ['Group ID', 'GroupId'],
      ['Direction', 'IsEgress'],
      ['Protocol', 'IpProtocol'],
      ['From port', 'FromPort'],
      ['To port', 'ToPort'],
      ['CIDR IPv4', 'CidrIpv4'],
      ['Description', 'Description'],
    ]),
    renderDetailList('Internet gateways', data.internet_gateways || [], [
      ['Gateway ID', 'InternetGatewayId'],
      ['Attachments', 'Attachments'],
      ['Tags', 'Tags'],
    ]),
    renderDetailList('Route tables', data.route_tables || [], [
      ['Route table ID', 'RouteTableId'],
      ['VPC ID', 'VpcId'],
      ['Associations', 'Associations'],
      ['Routes', 'Routes'],
      ['Tags', 'Tags'],
    ]),
    renderDetailList('Elastic IPs', data.addresses || [], [
      ['Allocation ID', 'AllocationId'],
      ['Association ID', 'AssociationId'],
      ['Public IP', 'PublicIp'],
      ['Private IP', 'PrivateIpAddress'],
      ['Instance ID', 'InstanceId'],
      ['Network interface', 'NetworkInterfaceId'],
      ['Domain', 'Domain'],
    ]),
    renderDetailList('Key pairs', data.key_pairs || [], [
      ['Key name', 'KeyName'],
      ['Key pair ID', 'KeyPairId'],
      ['Fingerprint', 'KeyFingerprint'],
      ['Tags', 'Tags'],
    ]),
    renderDetailList('AMIs', data.images || [], [
      ['Image ID', 'ImageId'],
      ['Name', 'Name'],
      ['Description', 'Description'],
      ['Architecture', 'Architecture'],
      ['Platform', 'Platform'],
      ['Root device type', 'RootDeviceType'],
      ['State', 'State'],
    ]),
    renderDetailList('Availability zones', data.availability_zones || [], [
      ['Zone name', 'ZoneName'],
      ['Zone ID', 'ZoneId'],
      ['Region', 'RegionName'],
      ['State', 'State'],
    ]),
    renderDetailList('Regions', data.regions || [], [
      ['Region name', 'RegionName'],
      ['Endpoint', 'Endpoint'],
      ['Opt-in status', 'OptInStatus'],
    ]),
    renderDetailList('Account attributes', data.account_attributes || [], [
      ['Attribute name', 'AttributeName'],
      ['Values', 'AttributeValues'],
    ]),
    renderDetailList('Instance types', data.instance_types || [], [
      ['Instance type', 'InstanceType'],
      ['vCPU info', 'VCpuInfo'],
      ['Memory info', 'MemoryInfo'],
      ['Network info', 'NetworkInfo'],
    ]),
    renderDetailList('Tags', data.tags || [], [
      ['Resource ID', 'ResourceId'],
      ['Resource type', 'ResourceType'],
      ['Key', 'Key'],
      ['Value', 'Value'],
    ]),
    renderDetailList('Floci EC2 notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  ec2Grid.append(...panels);
  ec2LoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderKMS(data) {
  kmsGrid.textContent = '';
  renderSummary(data.summary, kmsSummary);

  const panels = [
    renderDetailList('Keys', data.keys || [], [
      ['Key ID', 'key_id'],
      ['Key ARN', 'key_arn'],
      ['Metadata', 'metadata'],
      ['Aliases', 'aliases'],
      ['Tags', 'tags'],
      ['Policy', 'policy'],
      ['Rotation enabled', 'rotation_enabled'],
    ]),
    renderDetailList('Aliases', data.aliases || [], [
      ['Alias name', 'AliasName'],
      ['Alias ARN', 'AliasArn'],
      ['Target key ID', 'TargetKeyId'],
      ['Creation date', 'CreationDate'],
      ['Last updated', 'LastUpdatedDate'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Floci KMS notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  kmsGrid.append(...panels);
  kmsLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderLambda(data) {
  lambdaGrid.textContent = '';
  renderSummary(data.summary, lambdaSummary);

  const panels = [
    renderDetailList('Functions', data.functions || [], [
      ['ARN', 'arn'],
      ['Runtime', 'runtime'],
      ['Handler', 'handler'],
      ['Package type', 'package_type'],
      ['State', 'state'],
      ['Role', 'role'],
      ['Memory', 'memory_size'],
      ['Timeout', 'timeout'],
      ['Architectures', 'architectures'],
      ['Environment', 'environment'],
      ['Tracing', 'tracing_config'],
      ['Layers', 'layers'],
      ['Code', 'code'],
      ['Configuration', 'configuration'],
      ['Versions', 'versions'],
      ['Aliases', 'aliases'],
      ['Event source mappings', 'event_source_mappings'],
      ['Policy', 'policy'],
      ['Function URL', 'function_url'],
      ['Code signing config', 'code_signing_config'],
      ['Concurrency', 'concurrency'],
      ['Tags', 'tags'],
      ['Last modified', 'last_modified'],
    ]),
    renderDetailList('Event source mappings', data.event_source_mappings || [], [
      ['UUID', 'UUID'],
      ['Function ARN', 'FunctionArn'],
      ['Event source ARN', 'EventSourceArn'],
      ['State', 'State'],
      ['Batch size', 'BatchSize'],
      ['Scaling config', 'ScalingConfig'],
      ['Last modified', 'LastModified'],
    ]),
    renderDetailList('Supported operations', (data.supported || []).map((operation) => ({
      name: operation,
      operation,
    })), [
      ['Operation', 'operation'],
    ]),
    renderDetailList('Not implemented', (data.not_implemented || []).map((feature) => ({
      name: feature,
      feature,
    })), [
      ['Feature', 'feature'],
    ]),
    renderDetailList('Floci Lambda notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  lambdaGrid.append(...panels);
  lambdaLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderSQS(data) {
  sqsGrid.textContent = '';
  renderSummary(data.summary, sqsSummary);

  const panels = [
    renderDetailList('Queues', data.queues || [], [
      ['URL', 'url'],
      ['ARN', 'arn'],
      ['FIFO', 'fifo'],
      ['Visible messages', 'approximate_messages'],
      ['In-flight messages', 'approximate_not_visible'],
      ['Delayed messages', 'approximate_delayed'],
      ['Attributes', 'attributes'],
      ['Tags', 'tags'],
      ['Dead-letter source queues', 'dead_letter_source_queues'],
      ['Message move tasks', 'message_move_tasks'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Configuration notes', data.configuration ? [{
      name: 'Local defaults',
      ...data.configuration,
    }] : [], [
      ['Default visibility timeout seconds', 'default_visibility_timeout_seconds'],
      ['Max message size bytes', 'max_message_size_bytes'],
      ['Queue URL format', 'queue_url_format'],
    ]),
  ];

  sqsGrid.append(...panels);
  sqsLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderSecretsManager(data) {
  secretsmanagerGrid.textContent = '';
  renderSummary(data.summary, secretsmanagerSummary);

  const panels = [
    renderDetailList('Secrets', data.secrets || [], [
      ['ARN', 'arn'],
      ['Description', 'description'],
      ['KMS key ID', 'kms_key_id'],
      ['Created', 'created'],
      ['Last changed', 'last_changed'],
      ['Last accessed', 'last_accessed'],
      ['Deleted', 'deleted'],
      ['Rotation enabled', 'rotation_enabled'],
      ['Rotation Lambda ARN', 'rotation_lambda_arn'],
      ['Rotation rules', 'rotation_rules'],
      ['Version stages', 'version_ids_to_stages'],
      ['Versions', 'versions'],
      ['Tags', 'tags'],
      ['Resource policy', 'resource_policy'],
      ['Current string value', 'current_value'],
      ['Current binary value', 'current_binary_value'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Configuration notes', data.configuration ? [{
      name: 'Local defaults',
      ...data.configuration,
    }] : [], [
      ['Default recovery window days', 'default_recovery_window_days'],
      ['Protocol', 'protocol'],
      ['Value display', 'value_display'],
    ]),
  ];

  secretsmanagerGrid.append(...panels);
  secretsmanagerLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderDynamoDB(data) {
  dynamodbGrid.textContent = '';
  renderSummary(data.summary, dynamodbSummary);

  const panels = [
    renderDetailList('Tables', data.tables || [], [
      ['ARN', 'arn'],
      ['Status', 'status'],
      ['Item count', 'item_count'],
      ['Size bytes', 'size_bytes'],
      ['Billing mode', 'billing_mode'],
      ['Key schema', 'key_schema'],
      ['Attribute definitions', 'attribute_definitions'],
      ['Provisioned throughput', 'provisioned_throughput'],
      ['Global secondary indexes', 'global_secondary_indexes'],
      ['Local secondary indexes', 'local_secondary_indexes'],
      ['Stream specification', 'stream_specification'],
      ['Latest stream ARN', 'latest_stream_arn'],
      ['TTL', 'ttl'],
      ['Tags', 'tags'],
      ['Scan preview', 'scan_preview'],
    ]),
    renderDetailList('Streams', data.streams || [], [
      ['Table name', 'table_name'],
      ['Stream ARN', 'stream_arn'],
      ['Label', 'label'],
      ['Description', 'description'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Streams actions', (data.streams_supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
  ];

  dynamodbGrid.append(...panels);
  dynamodbLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderCloudWatch(data) {
  cloudwatchGrid.textContent = '';
  renderSummary(data.summary, cloudwatchSummary);

  const panels = [
    renderDetailList('Log groups', data.log_groups || [], [
      ['ARN', 'arn'],
      ['Created', 'created'],
      ['Retention days', 'retention_days'],
      ['Stored bytes', 'stored_bytes'],
      ['Metric filter count', 'metric_filter_count'],
      ['Tags', 'tags'],
      ['Stream count', 'stream_count'],
      ['Streams', 'streams'],
    ]),
    renderDetailList('Metrics', data.metrics || [], [
      ['Namespace', 'Namespace'],
      ['Metric name', 'MetricName'],
      ['Dimensions', 'Dimensions'],
    ]),
    renderDetailList('Alarms', data.alarms || [], [
      ['Alarm ARN', 'AlarmArn'],
      ['State', 'StateValue'],
      ['Metric name', 'MetricName'],
      ['Namespace', 'Namespace'],
      ['Statistic', 'Statistic'],
      ['Threshold', 'Threshold'],
      ['Comparison', 'ComparisonOperator'],
      ['Evaluation periods', 'EvaluationPeriods'],
      ['Period', 'Period'],
      ['Dimensions', 'Dimensions'],
    ]),
    renderDetailList('Logs actions', (data.logs_supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Metrics actions', (data.metrics_supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Configuration notes', data.configuration ? [{
      name: 'Local defaults',
      ...data.configuration,
    }] : [], [
      ['Logs max events per query', 'logs_max_events_per_query'],
      ['Logs protocol', 'logs_protocol'],
      ['Metrics protocol', 'metrics_protocol'],
    ]),
  ];

  cloudwatchGrid.append(...panels);
  cloudwatchLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderCodeBuild(data) {
  codebuildGrid.textContent = '';
  renderSummary(data.summary, codebuildSummary);

  const panels = [
    renderDetailList('Projects', data.projects || [], [
      ['ARN', 'arn'],
      ['Description', 'description'],
      ['Source', 'source'],
      ['Artifacts', 'artifacts'],
      ['Secondary sources', 'secondary_sources'],
      ['Secondary artifacts', 'secondary_artifacts'],
      ['Environment', 'environment'],
      ['Service role', 'service_role'],
      ['Timeout minutes', 'timeout_in_minutes'],
      ['Queued timeout minutes', 'queued_timeout_in_minutes'],
      ['Encryption key', 'encryption_key'],
      ['Tags', 'tags'],
      ['Created', 'created'],
      ['Last modified', 'last_modified'],
      ['Webhook', 'webhook'],
      ['VPC config', 'vpc_config'],
      ['Badge', 'badge'],
      ['Logs config', 'logs_config'],
      ['File system locations', 'file_system_locations'],
      ['Build batch config', 'build_batch_config'],
      ['Concurrent build limit', 'concurrent_build_limit'],
      ['Project visibility', 'project_visibility'],
      ['Resource access role', 'resource_access_role'],
    ]),
    renderDetailList('Builds', data.builds || [], [
      ['ID', 'id'],
      ['ARN', 'arn'],
      ['Build number', 'build_number'],
      ['Project name', 'project_name'],
      ['Status', 'status'],
      ['Source version', 'source_version'],
      ['Resolved source version', 'resolved_source_version'],
      ['Start time', 'start_time'],
      ['End time', 'end_time'],
      ['Current phase', 'current_phase'],
      ['Phases', 'phases'],
      ['Source', 'source'],
      ['Secondary sources', 'secondary_sources'],
      ['Artifacts', 'artifacts'],
      ['Secondary artifacts', 'secondary_artifacts'],
      ['Environment', 'environment'],
      ['Logs', 'logs'],
      ['Timeout minutes', 'timeout_in_minutes'],
      ['Queued timeout minutes', 'queued_timeout_in_minutes'],
      ['Build complete', 'build_complete'],
      ['Initiator', 'initiator'],
      ['VPC config', 'vpc_config'],
      ['Debug session', 'debug_session'],
      ['Encryption key', 'encryption_key'],
      ['Exported environment variables', 'exported_environment_variables'],
      ['Report ARNs', 'report_arns'],
      ['File system locations', 'file_system_locations'],
      ['Build batch ARN', 'build_batch_arn'],
    ]),
    renderDetailList('Report groups', data.report_groups || [], [
      ['ARN', 'arn'],
      ['Type', 'type'],
      ['Export config', 'export_config'],
      ['Created', 'created'],
      ['Last modified', 'last_modified'],
      ['Tags', 'tags'],
      ['Status', 'status'],
    ]),
    renderDetailList('Reports', data.reports || [], [
      ['ARN', 'arn'],
      ['Type', 'type'],
      ['Report group ARN', 'report_group_arn'],
      ['Execution ID', 'execution_id'],
      ['Status', 'status'],
      ['Created', 'created'],
      ['Expired', 'expired'],
      ['Export config', 'export_config'],
      ['Truncated', 'truncated'],
      ['Test summary', 'test_summary'],
      ['Code coverage summary', 'code_coverage_summary'],
    ]),
    renderDetailList('Source credentials', data.source_credentials || [], [
      ['ARN', 'arn'],
      ['Server type', 'serverType'],
      ['Auth type', 'authType'],
      ['Resource', 'resource'],
    ]),
    renderDetailList('Supported from SDK', (data.supported_from_sdk || []).map((operation) => ({
      name: operation,
      operation,
    })), [
      ['Operation', 'operation'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  codebuildGrid.append(...panels);
  codebuildLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderCodeDeploy(data) {
  codedeployGrid.textContent = '';
  renderSummary(data.summary, codedeploySummary);

  const panels = [
    renderDetailList('Applications', data.applications || [], [
      ['Application ID', 'application_id'],
      ['Compute platform', 'compute_platform'],
      ['Linked to GitHub', 'linked_to_github'],
      ['GitHub account name', 'git_hub_account_name'],
      ['Deployment group count', 'deployment_group_count'],
      ['Deployment count', 'deployment_count'],
      ['Deployment groups', 'deployment_groups'],
      ['Deployments', 'deployments'],
      ['Details', 'details'],
      ['Deployment groups error', 'deployment_groups_error'],
      ['Deployments error', 'deployments_error'],
    ]),
    renderDetailList('Deployment groups', data.deployment_groups || [], [
      ['Application name', 'application_name'],
      ['Deployment group ID', 'deployment_group_id'],
      ['Service role ARN', 'service_role_arn'],
      ['Deployment config name', 'deployment_config_name'],
      ['EC2 tag filters', 'ec2_tag_filters'],
      ['On-premises instance tag filters', 'on_premises_instance_tag_filters'],
      ['Auto scaling groups', 'auto_scaling_groups'],
      ['Trigger configurations', 'trigger_configurations'],
      ['Alarm configuration', 'alarm_configuration'],
      ['Auto rollback configuration', 'auto_rollback_configuration'],
      ['Deployment style', 'deployment_style'],
      ['Blue-green deployment configuration', 'blue_green_deployment_configuration'],
      ['Load balancer info', 'load_balancer_info'],
      ['Last successful deployment', 'last_successful_deployment'],
      ['Last attempted deployment', 'last_attempted_deployment'],
      ['Outdated instances strategy', 'outdated_instances_strategy'],
      ['Compute platform', 'compute_platform'],
      ['ECS services', 'ecs_services'],
      ['Termination hook enabled', 'termination_hook_enabled'],
      ['Deployment count', 'deployment_count'],
      ['Deployments', 'deployments'],
      ['Details', 'details'],
      ['Deployments error', 'deployments_error'],
    ]),
    renderDetailList('Deployments', data.deployments || [], [
      ['Deployment ID', 'deployment_id'],
      ['Application name', 'application_name'],
      ['Deployment group name', 'deployment_group_name'],
      ['Deployment config name', 'deployment_config_name'],
      ['Status', 'status'],
      ['Error information', 'error_information'],
      ['Create time', 'create_time'],
      ['Start time', 'start_time'],
      ['Complete time', 'complete_time'],
      ['Deployment overview', 'deployment_overview'],
      ['Description', 'description'],
      ['Creator', 'creator'],
      ['Ignore application stop failures', 'ignore_application_stop_failures'],
      ['Auto rollback configuration', 'auto_rollback_configuration'],
      ['Update outdated instances only', 'update_outdated_instances_only'],
      ['Rollback info', 'rollback_info'],
      ['Deployment style', 'deployment_style'],
      ['Target instances', 'target_instances'],
      ['Instance termination wait started', 'instance_termination_wait_time_started'],
      ['Blue-green deployment configuration', 'blue_green_deployment_configuration'],
      ['Load balancer info', 'load_balancer_info'],
      ['Additional status info', 'additional_deployment_status_info'],
      ['File exists behavior', 'file_exists_behavior'],
      ['Deployment status messages', 'deployment_status_messages'],
      ['Compute platform', 'compute_platform'],
      ['External ID', 'external_id'],
      ['Related deployments', 'related_deployments'],
      ['Override alarm configuration', 'override_alarm_configuration'],
      ['Revision', 'revision'],
      ['Details', 'details'],
    ]),
    renderDetailList('Deployment configs', data.deployment_configs || [], [
      ['Deployment config ID', 'deployment_config_id'],
      ['Minimum healthy hosts', 'minimum_healthy_hosts'],
      ['Traffic routing config', 'traffic_routing_config'],
      ['Compute platform', 'compute_platform'],
      ['Zonal config', 'zonal_config'],
      ['Details', 'details'],
    ]),
    renderDetailList('On-premises instances', data.on_prem_instances || [], [
      ['ARN', 'instanceArn'],
      ['Instance name', 'instanceName'],
      ['IAM session ARN', 'iamSessionArn'],
      ['IAM user ARN', 'iamUserArn'],
      ['Registration status', 'registrationStatus'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Supported from SDK', (data.supported_from_sdk || []).map((operation) => ({
      name: operation,
      operation,
    })), [
      ['Operation', 'operation'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  codedeployGrid.append(...panels);
  codedeployLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderEventBridge(data) {
  eventbridgeGrid.textContent = '';
  renderSummary(data.summary, eventbridgeSummary);

  const panels = [
    renderDetailList('Event buses', data.event_buses || [], [
      ['ARN', 'arn'],
      ['Description', 'description'],
      ['Policy', 'policy'],
      ['Details', 'details'],
      ['Rule count', 'rule_count'],
      ['Target count', 'target_count'],
      ['Rules', 'rules'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  eventbridgeGrid.append(...panels);
  eventbridgeLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderCognito(data) {
  cognitoGrid.textContent = '';
  renderSummary(data.summary, cognitoSummary);

  const panels = [
    renderDetailList('User pools', data.user_pools || [], [
      ['Pool ID', 'id'],
      ['ARN', 'arn'],
      ['Status', 'status'],
      ['Created', 'created'],
      ['Last modified', 'last_modified'],
      ['Details', 'details'],
      ['Tags', 'tags'],
      ['Clients', 'clients'],
      ['Resource servers', 'resource_servers'],
      ['Users', 'users'],
      ['Groups', 'groups'],
      ['Discovery URL', 'discovery_url'],
      ['JWKS URL', 'jwks_url'],
      ['OAuth token URL', 'oauth_token_url'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Well-known and OAuth endpoints', (data.endpoints || []).map((endpointValue) => ({
      name: endpointValue,
      endpoint: endpointValue,
    })), [
      ['Endpoint', 'endpoint'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  cognitoGrid.append(...panels);
  cognitoLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderApiGateway(data) {
  apigatewayGrid.textContent = '';
  renderSummary(data.summary, apigatewaySummary);

  const supportedV1 = Object.entries(data.supported_v1 || {}).map(([category, actions]) => ({
    name: category,
    actions,
  }));
  const supportedV2 = Object.entries(data.supported_v2 || {}).map(([category, actions]) => ({
    name: category,
    actions,
  }));

  const panels = [
    renderDetailList('REST APIs (v1)', data.rest_apis || [], [
      ['API ID', 'id'],
      ['Description', 'description'],
      ['Created', 'created'],
      ['Version', 'version'],
      ['API key source', 'api_key_source'],
      ['Endpoint configuration', 'endpoint_configuration'],
      ['Tags', 'tags'],
      ['Execute URL pattern', 'execute_url_pattern'],
      ['Resources', 'resource_count'],
      ['Methods', 'method_count'],
      ['Integrations', 'integration_count'],
      ['Deployments', 'deployment_count'],
      ['Stages', 'stage_count'],
      ['Authorizers', 'authorizer_count'],
      ['Request validators', 'validator_count'],
      ['Models', 'model_count'],
      ['Resource tree', 'resources'],
      ['Deployments detail', 'deployments'],
      ['Stages detail', 'stages'],
      ['Authorizers detail', 'authorizers'],
      ['Request validators detail', 'request_validators'],
      ['Models detail', 'models'],
    ]),
    renderDetailList('HTTP APIs (v2)', data.http_apis || [], [
      ['API ID', 'id'],
      ['Protocol', 'protocol_type'],
      ['Endpoint', 'api_endpoint'],
      ['Description', 'description'],
      ['Created', 'created'],
      ['Route selection expression', 'route_selection_expression'],
      ['Tags', 'tags'],
      ['Routes', 'route_count'],
      ['Integrations', 'integration_count'],
      ['Authorizers', 'authorizer_count'],
      ['Stages', 'stage_count'],
      ['Deployments', 'deployment_count'],
      ['Route detail', 'routes'],
      ['Integration detail', 'integrations'],
      ['Authorizer detail', 'authorizers'],
      ['Stage detail', 'stages'],
      ['Deployment detail', 'deployments'],
    ]),
    renderDetailList('API keys', data.api_keys || [], [
      ['ID', 'id'],
      ['Description', 'description'],
      ['Enabled', 'enabled'],
      ['Created', 'createdDate'],
      ['Last updated', 'lastUpdatedDate'],
      ['Stage keys', 'stageKeys'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Usage plans', data.usage_plans || [], [
      ['ID', 'id'],
      ['Description', 'description'],
      ['API stages', 'apiStages'],
      ['Throttle', 'throttle'],
      ['Quota', 'quota'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Domain names', data.domain_names || [], [
      ['Domain', 'domainName'],
      ['Regional domain', 'regionalDomainName'],
      ['Endpoint configuration', 'endpointConfiguration'],
      ['Security policy', 'securityPolicy'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Supported v1 operations', supportedV1, [
      ['Actions', 'actions'],
    ]),
    renderDetailList('Supported v2 operations', supportedV2, [
      ['Actions', 'actions'],
    ]),
    renderDetailList('Not implemented in v1', (data.not_implemented_v1 || []).map((operation) => ({
      name: operation,
      operation,
    })), [
      ['Operation family', 'operation'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  apigatewayGrid.append(...panels);
  apigatewayLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderAppConfig(data) {
  appconfigGrid.textContent = '';
  renderSummary(data.summary, appconfigSummary);

  const panels = [
    renderDetailList('Applications', data.applications || [], [
      ['ID', 'id'],
      ['Description', 'description'],
      ['Environment count', 'environment_count'],
      ['Configuration profile count', 'configuration_profile_count'],
      ['Hosted version count', 'hosted_version_count'],
      ['Deployment count', 'deployment_count'],
      ['Environments', 'environments'],
      ['Configuration profiles', 'configuration_profiles'],
      ['Details', 'details'],
      ['Environment error', 'environments_error'],
      ['Configuration profile error', 'configuration_profiles_error'],
    ]),
    renderDetailList('Environments', data.environments || [], [
      ['ID', 'id'],
      ['Application ID', 'application_id'],
      ['Description', 'description'],
      ['State', 'state'],
      ['Monitors', 'monitors'],
      ['Deployment count', 'deployment_count'],
      ['Deployments', 'deployments'],
      ['Details', 'details'],
      ['Deployment error', 'deployments_error'],
    ]),
    renderDetailList('Configuration profiles', data.configuration_profiles || [], [
      ['ID', 'id'],
      ['Application ID', 'application_id'],
      ['Description', 'description'],
      ['Location URI', 'location_uri'],
      ['Type', 'type'],
      ['Retrieval role ARN', 'retrieval_role_arn'],
      ['Validators', 'validators'],
      ['KMS key ARN', 'kms_key_arn'],
      ['KMS key identifier', 'kms_key_identifier'],
      ['Hosted version count', 'hosted_version_count'],
      ['Hosted versions', 'hosted_versions'],
      ['Details', 'details'],
      ['Hosted versions error', 'hosted_versions_error'],
    ]),
    renderDetailList('Hosted configuration versions', data.hosted_versions || [], [
      ['Version number', 'version_number'],
      ['Application ID', 'application_id'],
      ['Configuration profile ID', 'configuration_profile_id'],
      ['Description', 'description'],
      ['Content type', 'content_type'],
      ['Version label', 'version_label'],
      ['KMS key ARN', 'kms_key_arn'],
      ['Content size bytes', 'content_size_bytes'],
      ['Content encoding', 'content_encoding'],
      ['Content preview', 'content_preview'],
      ['Details', 'details'],
    ]),
    renderDetailList('Deployments', data.deployments || [], [
      ['Deployment number', 'deployment_number'],
      ['Application ID', 'application_id'],
      ['Environment ID', 'environment_id'],
      ['State', 'state'],
      ['Configuration name', 'configuration_name'],
      ['Configuration profile ID', 'configuration_profile_id'],
      ['Configuration version', 'configuration_version'],
      ['Deployment strategy ID', 'deployment_strategy_id'],
      ['Percentage complete', 'percentage_complete'],
      ['Started at', 'started_at'],
      ['Completed at', 'completed_at'],
      ['Event log', 'event_log'],
      ['Applied extensions', 'applied_extensions'],
      ['Version label', 'version_label'],
      ['Details', 'details'],
    ]),
    renderDetailList('Deployment strategies', data.deployment_strategies || [], [
      ['ID', 'id'],
      ['Description', 'description'],
      ['Deployment duration minutes', 'deployment_duration_in_minutes'],
      ['Growth type', 'growth_type'],
      ['Growth factor', 'growth_factor'],
      ['Final bake time minutes', 'final_bake_time_in_minutes'],
      ['Replicate to', 'replicate_to'],
      ['Details', 'details'],
    ]),
    renderDetailList('Management plane actions', (data.management_supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Data plane actions', (data.data_supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  appconfigGrid.append(...panels);
  appconfigLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderBedrockRuntime(data) {
  bedrockruntimeGrid.textContent = '';
  renderSummary(data.summary, bedrockruntimeSummary);

  const panels = [
    renderDetailList('Runtime operations', data.operations || [], [
      ['Operation', 'operation'],
      ['Method', 'method'],
      ['Endpoint', 'endpoint'],
      ['Status', 'status'],
      ['Notes', 'notes'],
    ]),
    renderDetailList('Configuration', data.configuration ? [{
      name: 'Local endpoint',
      ...data.configuration,
    }] : [], [
      ['Service key', 'service_key'],
      ['Enabled setting', 'enabled_variable'],
      ['Endpoint pattern', 'endpoint_pattern'],
      ['Protocol', 'protocol'],
    ]),
    renderDetailList('Accepted model identifiers', data.model_id_support || [], [
      ['Example', 'example'],
    ]),
    renderDetailList('Request behavior', data.request_behavior || [], [
      ['Detail', 'detail'],
    ]),
    renderDetailList('Examples', data.examples || [], [
      ['CLI', 'cli'],
    ]),
    renderDetailList('Available SDK operations', (data.available_sdk_operations || []).map((operation) => ({
      name: operation,
      operation,
    })), [
      ['Operation', 'operation'],
    ]),
    renderDetailList('Out of scope', (data.out_of_scope || []).map((item) => ({
      name: item,
      item,
    })), [
      ['Item', 'item'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  bedrockruntimeGrid.append(...panels);
  bedrockruntimeLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderECS(data) {
  ecsGrid.textContent = '';
  renderSummary(data.summary, ecsSummary);

  const supported = Object.entries(data.supported || {}).map(([category, actions]) => ({
    name: category,
    actions,
  }));

  const panels = [
    renderDetailList('Clusters', data.clusters || [], [
      ['ARN', 'arn'],
      ['Status', 'status'],
      ['Running tasks', 'running_tasks'],
      ['Pending tasks', 'pending_tasks'],
      ['Active services', 'active_services'],
      ['Registered container instances', 'registered_container_instances'],
      ['Capacity providers', 'capacity_providers'],
      ['Default capacity provider strategy', 'default_capacity_provider_strategy'],
      ['Settings', 'settings'],
      ['Configuration', 'configuration'],
      ['Statistics', 'statistics'],
      ['Attachments', 'attachments'],
      ['Tags', 'tags'],
      ['Task count', 'task_count'],
      ['Service count', 'service_count'],
      ['Task set count', 'task_set_count'],
      ['Container instance count', 'container_instance_count'],
      ['Service deployment count', 'service_deployment_count'],
      ['Tasks', 'tasks'],
      ['Services', 'services'],
      ['Task sets', 'task_sets'],
      ['Container instances', 'container_instances'],
      ['Service deployments', 'service_deployments'],
      ['Service revisions', 'service_revisions'],
    ]),
    renderDetailList('Task definitions', data.task_definitions || [], [
      ['ARN', 'arn'],
      ['Family', 'family'],
      ['Revision', 'revision'],
      ['Status', 'status'],
      ['Network mode', 'network_mode'],
      ['Requires compatibilities', 'requires_compatibilities'],
      ['CPU', 'cpu'],
      ['Memory', 'memory'],
      ['Task role ARN', 'task_role_arn'],
      ['Execution role ARN', 'execution_role_arn'],
      ['Registered at', 'registered_at'],
      ['Deregistered at', 'deregistered_at'],
      ['Containers', 'containers'],
      ['Volumes', 'volumes'],
      ['Placement constraints', 'placement_constraints'],
      ['Tags', 'tags'],
      ['Details', 'details'],
    ]),
    renderDetailList('Task definition families', (data.task_definition_families || []).map((family) => ({
      name: family,
      family,
    })), [
      ['Family', 'family'],
    ]),
    renderDetailList('Capacity providers', data.capacity_providers || [], [
      ['ARN', 'capacityProviderArn'],
      ['Status', 'status'],
      ['Auto scaling group provider', 'autoScalingGroupProvider'],
      ['Managed scaling', 'managedScaling'],
      ['Managed termination protection', 'managedTerminationProtection'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Account settings', data.account_settings || [], [
      ['Name', 'name'],
      ['Value', 'value'],
      ['Principal ARN', 'principalArn'],
      ['Type', 'type'],
    ]),
    renderDetailList('Attributes', data.attributes || [], [
      ['Name', 'name'],
      ['Value', 'value'],
      ['Target type', 'targetType'],
      ['Target ID', 'targetId'],
    ]),
    renderDetailList('Agent endpoint', data.agent_poll_endpoint ? [{
      name: 'DiscoverPollEndpoint',
      ...data.agent_poll_endpoint,
    }] : [], [
      ['Endpoint', 'endpoint'],
      ['Telemetry endpoint', 'telemetryEndpoint'],
      ['Service Connect endpoint', 'serviceConnectEndpoint'],
    ]),
    renderDetailList('Supported operations', supported, [
      ['Actions', 'actions'],
    ]),
    renderDetailList('Configuration defaults', data.configuration ? [{
      name: 'Local defaults',
      ...data.configuration,
    }] : [], [
      ['Mock mode', 'mock'],
      ['Docker network', 'docker_network'],
      ['Default memory MB', 'default_memory_mb'],
      ['Default CPU units', 'default_cpu_units'],
    ]),
    renderDetailList('Environment variables', (data.environment_variables || []).map((variable) => ({
      name: variable,
      variable,
    })), [
      ['Variable', 'variable'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  ecsGrid.append(...panels);
  ecsLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderEKS(data) {
  eksGrid.textContent = '';
  renderSummary(data.summary, eksSummary);

  const panels = [
    renderDetailList('Clusters', data.clusters || [], [
      ['ARN', 'arn'],
      ['Created at', 'created_at'],
      ['Version', 'version'],
      ['Endpoint', 'endpoint'],
      ['Role ARN', 'role_arn'],
      ['Status', 'status'],
      ['Platform version', 'platform_version'],
      ['VPC config', 'resources_vpc_config'],
      ['Kubernetes network config', 'kubernetes_network_config'],
      ['Logging', 'logging'],
      ['Identity', 'identity'],
      ['Certificate authority', 'certificate_authority'],
      ['Tags', 'tags'],
      ['Encryption config', 'encryption_config'],
      ['Connector config', 'connector_config'],
      ['Access config', 'access_config'],
      ['Upgrade policy', 'upgrade_policy'],
      ['Nodegroup count', 'nodegroup_count'],
      ['Fargate profile count', 'fargate_profile_count'],
      ['Add-on count', 'addon_count'],
      ['Identity provider config count', 'identity_provider_config_count'],
      ['Access entry count', 'access_entry_count'],
      ['Nodegroups', 'nodegroups'],
      ['Fargate profiles', 'fargate_profiles'],
      ['Add-ons', 'addons'],
      ['Identity provider configs', 'identity_provider_configs'],
      ['Access entries', 'access_entries'],
      ['Details', 'details'],
    ]),
    renderDetailList('Node groups', data.nodegroups || [], [
      ['Cluster name', 'cluster_name'],
      ['ARN', 'arn'],
      ['Created at', 'created_at'],
      ['Modified at', 'modified_at'],
      ['Status', 'status'],
      ['Capacity type', 'capacity_type'],
      ['Scaling config', 'scaling_config'],
      ['Instance types', 'instance_types'],
      ['Subnets', 'subnets'],
      ['Remote access', 'remote_access'],
      ['AMI type', 'ami_type'],
      ['Node role', 'node_role'],
      ['Labels', 'labels'],
      ['Taints', 'taints'],
      ['Resources', 'resources'],
      ['Disk size', 'disk_size'],
      ['Health', 'health'],
      ['Update config', 'update_config'],
      ['Launch template', 'launch_template'],
      ['Version', 'version'],
      ['Release version', 'release_version'],
      ['Tags', 'tags'],
      ['Details', 'details'],
    ]),
    renderDetailList('Fargate profiles', data.fargate_profiles || [], [
      ['Cluster name', 'cluster_name'],
      ['ARN', 'arn'],
      ['Created at', 'created_at'],
      ['Pod execution role ARN', 'pod_execution_role_arn'],
      ['Subnets', 'subnets'],
      ['Selectors', 'selectors'],
      ['Status', 'status'],
      ['Tags', 'tags'],
      ['Health', 'health'],
      ['Details', 'details'],
    ]),
    renderDetailList('Add-ons', data.addons || [], [
      ['Cluster name', 'cluster_name'],
      ['ARN', 'arn'],
      ['Version', 'version'],
      ['Status', 'status'],
      ['Service account role ARN', 'service_account_role_arn'],
      ['Configuration values', 'configuration_values'],
      ['Health', 'health'],
      ['Created at', 'created_at'],
      ['Modified at', 'modified_at'],
      ['Tags', 'tags'],
      ['Publisher', 'publisher'],
      ['Owner', 'owner'],
      ['Marketplace information', 'marketplace_information'],
      ['Pod identity associations', 'pod_identity_associations'],
      ['Details', 'details'],
    ]),
    renderDetailList('Identity provider configs', data.identity_provider_configs || [], [
      ['Cluster name', 'cluster_name'],
      ['Type', 'type'],
      ['Status', 'status'],
      ['Issuer URL', 'issuer_url'],
      ['Client ID', 'client_id'],
      ['Username claim', 'username_claim'],
      ['Username prefix', 'username_prefix'],
      ['Groups claim', 'groups_claim'],
      ['Groups prefix', 'groups_prefix'],
      ['Required claims', 'required_claims'],
      ['Tags', 'tags'],
      ['Details', 'details'],
    ]),
    renderDetailList('Access entries', data.access_entries || [], [
      ['Cluster name', 'cluster_name'],
      ['Principal ARN', 'principal_arn'],
      ['Kubernetes groups', 'kubernetes_groups'],
      ['Access entry ARN', 'access_entry_arn'],
      ['Created at', 'created_at'],
      ['Modified at', 'modified_at'],
      ['Tags', 'tags'],
      ['Username', 'username'],
      ['Type', 'type'],
      ['Associated policies', 'associated_policies'],
      ['Details', 'details'],
    ]),
    renderDetailList('Supported from SDK', (data.supported_from_sdk || []).map((operation) => ({
      name: operation,
      operation,
    })), [
      ['Operation', 'operation'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  eksGrid.append(...panels);
  eksLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderElastiCache(data) {
  elasticacheGrid.textContent = '';
  renderSummary(data.summary, elasticacheSummary);

  const panels = [
    renderDetailList('Cache clusters', data.cache_clusters || [], [
      ['ARN', 'arn'],
      ['Engine', 'engine'],
      ['Engine version', 'engine_version'],
      ['Status', 'status'],
      ['Node type', 'node_type'],
      ['Cache nodes', 'num_cache_nodes'],
      ['Availability zone', 'preferred_availability_zone'],
      ['Subnet group', 'cache_subnet_group_name'],
      ['Replication group', 'replication_group_id'],
      ['Security groups', 'security_groups'],
      ['Cache security groups', 'cache_security_groups'],
      ['Parameter group', 'cache_parameter_group'],
      ['Node details', 'cache_nodes'],
      ['Configuration endpoint', 'configuration_endpoint'],
      ['Notification configuration', 'notification_configuration'],
      ['Pending modifications', 'pending_modified_values'],
      ['Created', 'created'],
      ['Maintenance window', 'preferred_maintenance_window'],
      ['Auto minor version upgrade', 'auto_minor_version_upgrade'],
      ['Snapshot retention limit', 'snapshot_retention_limit'],
      ['Snapshot window', 'snapshot_window'],
      ['Auth token enabled', 'auth_token_enabled'],
      ['Transit encryption enabled', 'transit_encryption_enabled'],
      ['At-rest encryption enabled', 'at_rest_encryption_enabled'],
      ['Log delivery configurations', 'log_delivery_configurations'],
    ]),
    renderDetailList('Replication groups', data.replication_groups || [], [
      ['ARN', 'arn'],
      ['Description', 'description'],
      ['Status', 'status'],
      ['Pending modifications', 'pending_modified_values'],
      ['Member clusters', 'member_clusters'],
      ['Node groups', 'node_groups'],
      ['Snapshotting cluster ID', 'snapshotting_cluster_id'],
      ['Automatic failover', 'automatic_failover'],
      ['Multi-AZ', 'multi_az'],
      ['Configuration endpoint', 'configuration_endpoint'],
      ['Snapshot retention limit', 'snapshot_retention_limit'],
      ['Snapshot window', 'snapshot_window'],
      ['Cluster enabled', 'cluster_enabled'],
      ['Cache node type', 'cache_node_type'],
      ['Auth token enabled', 'auth_token_enabled'],
      ['Transit encryption enabled', 'transit_encryption_enabled'],
      ['At-rest encryption enabled', 'at_rest_encryption_enabled'],
      ['KMS key ID', 'kms_key_id'],
      ['User group IDs', 'user_group_ids'],
      ['Log delivery configurations', 'log_delivery_configurations'],
      ['Data tiering', 'data_tiering'],
    ]),
    renderDetailList('Serverless caches', data.serverless_caches || [], [
      ['ARN', 'arn'],
      ['Engine', 'engine'],
      ['Major engine version', 'major_engine_version'],
      ['Full engine version', 'full_engine_version'],
      ['Status', 'status'],
      ['Endpoint', 'endpoint'],
      ['Reader endpoint', 'reader_endpoint'],
      ['Description', 'description'],
      ['Cache usage limits', 'cache_usage_limits'],
      ['KMS key ID', 'kms_key_id'],
      ['Security group IDs', 'security_group_ids'],
      ['Subnet IDs', 'subnet_ids'],
      ['User group ID', 'user_group_id'],
      ['Created', 'created'],
      ['Snapshot retention limit', 'snapshot_retention_limit'],
      ['Daily snapshot time', 'daily_snapshot_time'],
    ]),
    renderDetailList('Subnet groups', data.subnet_groups || [], [
      ['Description', 'CacheSubnetGroupDescription'],
      ['VPC ID', 'VpcId'],
      ['Subnets', 'Subnets'],
      ['ARN', 'ARN'],
      ['Supported network types', 'SupportedNetworkTypes'],
    ]),
    renderDetailList('Parameter groups', data.parameter_groups || [], [
      ['Family', 'CacheParameterGroupFamily'],
      ['Description', 'Description'],
      ['ARN', 'ARN'],
      ['Is global', 'IsGlobal'],
    ]),
    renderDetailList('Security groups', data.security_groups || [], [
      ['Description', 'Description'],
      ['EC2 security groups', 'EC2SecurityGroups'],
      ['ARN', 'ARN'],
    ]),
    renderDetailList('Snapshots', data.snapshots || [], [
      ['ARN', 'ARN'],
      ['Status', 'SnapshotStatus'],
      ['Source', 'SnapshotSource'],
      ['Cache cluster ID', 'CacheClusterId'],
      ['Replication group ID', 'ReplicationGroupId'],
      ['Engine', 'Engine'],
      ['Engine version', 'EngineVersion'],
      ['Node type', 'CacheNodeType'],
      ['Node snapshots', 'NodeSnapshots'],
    ]),
    renderDetailList('Users', data.users || [], [
      ['User ID', 'UserId'],
      ['User name', 'UserName'],
      ['Status', 'Status'],
      ['Engine', 'Engine'],
      ['Access string', 'AccessString'],
      ['User group IDs', 'UserGroupIds'],
      ['ARN', 'ARN'],
      ['Authentication', 'Authentication'],
    ]),
    renderDetailList('User groups', data.user_groups || [], [
      ['User group ID', 'UserGroupId'],
      ['Status', 'Status'],
      ['Engine', 'Engine'],
      ['User IDs', 'UserIds'],
      ['Pending changes', 'PendingChanges'],
      ['ARN', 'ARN'],
    ]),
    renderDetailList('Global replication groups', data.global_replication_groups || [], [
      ['Status', 'Status'],
      ['ARN', 'ARN'],
      ['Description', 'GlobalReplicationGroupDescription'],
      ['Members', 'Members'],
      ['Cluster enabled', 'ClusterEnabled'],
      ['Engine', 'Engine'],
      ['Engine version', 'EngineVersion'],
      ['Cache node type', 'CacheNodeType'],
      ['Auth token enabled', 'AuthTokenEnabled'],
      ['Transit encryption enabled', 'TransitEncryptionEnabled'],
      ['At-rest encryption enabled', 'AtRestEncryptionEnabled'],
    ]),
    renderDetailList('Recent events', data.events || [], [
      ['Source identifier', 'SourceIdentifier'],
      ['Source type', 'SourceType'],
      ['Message', 'Message'],
      ['Date', 'Date'],
    ]),
    renderDetailList('Supported from SDK', (data.supported_from_sdk || []).map((operation) => ({
      name: operation,
      operation,
    })), [
      ['Operation', 'operation'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  elasticacheGrid.append(...panels);
  elasticacheLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderElasticLoadBalancing(data) {
  elasticloadbalancingGrid.textContent = '';
  renderSummary(data.summary, elasticloadbalancingSummary);

  const panels = [
    renderDetailList('V2 load balancers', data.v2_load_balancers || [], [
      ['ARN', 'arn'],
      ['DNS name', 'dns_name'],
      ['Canonical hosted zone ID', 'canonical_hosted_zone_id'],
      ['Created', 'created'],
      ['Scheme', 'scheme'],
      ['VPC ID', 'vpc_id'],
      ['State', 'state'],
      ['Type', 'type'],
      ['Availability zones', 'availability_zones'],
      ['Security groups', 'security_groups'],
      ['IP address type', 'ip_address_type'],
      ['Customer owned IPv4 pool', 'customer_owned_ipv4_pool'],
      ['PrivateLink inbound rule enforcement', 'enforce_security_group_inbound_rules_on_private_link_traffic'],
      ['Attributes', 'attributes'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Listeners', data.listeners || [], [
      ['Load balancer', 'load_balancer_name'],
      ['ARN', 'arn'],
      ['Port', 'port'],
      ['Protocol', 'protocol'],
      ['Certificates', 'certificates'],
      ['SSL policy', 'ssl_policy'],
      ['Default actions', 'default_actions'],
      ['ALPN policy', 'alpn_policy'],
      ['Mutual authentication', 'mutual_authentication'],
    ]),
    renderDetailList('Rules', data.rules || [], [
      ['Load balancer', 'load_balancer_name'],
      ['Listener ARN', 'listener_arn'],
      ['ARN', 'arn'],
      ['Priority', 'priority'],
      ['Conditions', 'conditions'],
      ['Actions', 'actions'],
      ['Default', 'is_default'],
    ]),
    renderDetailList('Target groups', data.target_groups || [], [
      ['ARN', 'arn'],
      ['Protocol', 'protocol'],
      ['Port', 'port'],
      ['VPC ID', 'vpc_id'],
      ['Health check protocol', 'health_check_protocol'],
      ['Health check port', 'health_check_port'],
      ['Health check enabled', 'health_check_enabled'],
      ['Health check interval seconds', 'health_check_interval_seconds'],
      ['Health check timeout seconds', 'health_check_timeout_seconds'],
      ['Healthy threshold count', 'healthy_threshold_count'],
      ['Unhealthy threshold count', 'unhealthy_threshold_count'],
      ['Health check path', 'health_check_path'],
      ['Matcher', 'matcher'],
      ['Load balancer ARNs', 'load_balancer_arns'],
      ['Target type', 'target_type'],
      ['Protocol version', 'protocol_version'],
      ['IP address type', 'ip_address_type'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Target health', data.target_health || [], [
      ['Target group ARN', 'target_group_arn'],
      ['Target health descriptions', 'target_health_descriptions'],
    ]),
    renderDetailList('Classic load balancers', data.classic_load_balancers || [], [
      ['DNS name', 'dns_name'],
      ['Canonical hosted zone name', 'canonical_hosted_zone_name'],
      ['Canonical hosted zone name ID', 'canonical_hosted_zone_name_id'],
      ['Listeners', 'listener_descriptions'],
      ['Policies', 'policies'],
      ['Backend servers', 'backend_server_descriptions'],
      ['Availability zones', 'availability_zones'],
      ['Subnets', 'subnets'],
      ['VPC ID', 'vpc_id'],
      ['Instances', 'instances'],
      ['Health check', 'health_check'],
      ['Source security group', 'source_security_group'],
      ['Security groups', 'security_groups'],
      ['Created', 'created'],
      ['Scheme', 'scheme'],
      ['Attributes', 'attributes'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Classic instance health', data.classic_instance_health || [], [
      ['Instance states', 'instance_states'],
    ]),
    renderDetailList('Classic policies', data.classic_policies || [], [
      ['Policies', 'policies'],
    ]),
    renderDetailList('Classic policy types', data.classic_policy_types || [], [
      ['Description', 'Description'],
      ['Policy attributes', 'PolicyAttributeTypeDescriptions'],
    ]),
    renderDetailList('Supported from SDK', (data.supported_from_sdk || []).map((operation) => ({
      name: operation,
      operation,
    })), [
      ['Operation', 'operation'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  elasticloadbalancingGrid.append(...panels);
  elasticloadbalancingLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderFirehose(data) {
  firehoseGrid.textContent = '';
  renderSummary(data.summary, firehoseSummary);

  const panels = [
    renderDetailList('Delivery streams', data.delivery_streams || [], [
      ['ARN', 'arn'],
      ['Status', 'status'],
      ['Type', 'type'],
      ['Version ID', 'version_id'],
      ['Created', 'created'],
      ['Updated', 'updated'],
      ['Source', 'source'],
      ['Encryption configuration', 'delivery_stream_encryption_configuration'],
      ['Failure description', 'failure_description'],
      ['Has more destinations', 'has_more_destinations'],
      ['Destination count', 'destination_count'],
      ['Destinations', 'destinations'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Destinations', data.destinations || [], [
      ['Delivery stream', 'delivery_stream_name'],
      ['Destination ID', 'destination_id'],
      ['S3 destination', 's3_destination_description'],
      ['Extended S3 destination', 'extended_s3_destination_description'],
      ['Redshift destination', 'redshift_destination_description'],
      ['Elasticsearch destination', 'elasticsearch_destination_description'],
      ['OpenSearch destination', 'amazonopensearchservice_destination_description'],
      ['Splunk destination', 'splunk_destination_description'],
      ['HTTP endpoint destination', 'http_endpoint_destination_description'],
      ['Snowflake destination', 'snowflake_destination_description'],
      ['Iceberg destination', 'iceberg_destination_description'],
    ]),
    renderDetailList('Supported from SDK', (data.supported_from_sdk || []).map((operation) => ({
      name: operation,
      operation,
    })), [
      ['Operation', 'operation'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  firehoseGrid.append(...panels);
  firehoseLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderKinesis(data) {
  kinesisGrid.textContent = '';
  renderSummary(data.summary, kinesisSummary);

  const panels = [
    renderDetailList('Streams', data.streams || [], [
      ['ARN', 'arn'],
      ['Status', 'status'],
      ['Mode', 'mode'],
      ['Retention period hours', 'retention_period_hours'],
      ['Created', 'created'],
      ['Enhanced monitoring', 'enhanced_monitoring'],
      ['Encryption type', 'encryption_type'],
      ['Key ID', 'key_id'],
      ['Open shard count', 'open_shard_count'],
      ['Consumer count', 'consumer_count'],
      ['Shard count', 'shard_count'],
      ['Shards', 'shards'],
      ['Consumers', 'consumers'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Shards', data.shards || [], [
      ['Stream name', 'stream_name'],
      ['Shard ID', 'shard_id'],
      ['Parent shard ID', 'parent_shard_id'],
      ['Adjacent parent shard ID', 'adjacent_parent_shard_id'],
      ['Hash key range', 'hash_key_range'],
      ['Sequence number range', 'sequence_number_range'],
    ]),
    renderDetailList('Consumers', data.consumers || [], [
      ['Stream ARN', 'stream_arn'],
      ['Consumer ARN', 'consumer_arn'],
      ['Status', 'status'],
      ['Creation timestamp', 'creation_timestamp'],
    ]),
    renderDetailList('Account settings', data.account_settings ? [{
      name: 'Account settings',
      ...data.account_settings,
    }] : [], [
      ['Settings', 'AccountSettings'],
    ]),
    renderDetailList('Limits', data.limits ? [{
      name: 'Account limits',
      ...data.limits,
    }] : [], [
      ['Shard limit', 'ShardLimit'],
      ['Open shard count', 'OpenShardCount'],
      ['On-demand stream count', 'OnDemandStreamCount'],
      ['On-demand stream count limit', 'OnDemandStreamCountLimit'],
    ]),
    renderDetailList('Supported from SDK', (data.supported_from_sdk || []).map((operation) => ({
      name: operation,
      operation,
    })), [
      ['Operation', 'operation'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  kinesisGrid.append(...panels);
  kinesisLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderKafka(data) {
  kafkaGrid.textContent = '';
  renderSummary(data.summary, kafkaSummary);

  const panels = [
    renderDetailList('Clusters', data.clusters || [], [
      ['ARN', 'arn'],
      ['Type', 'type'],
      ['State', 'state'],
      ['Created', 'created'],
      ['Current version', 'current_version'],
      ['Kafka version', 'kafka_version'],
      ['Broker nodes', 'number_of_broker_nodes'],
      ['Broker node group info', 'broker_node_group_info'],
      ['Serverless config', 'serverless'],
      ['Provisioned config', 'provisioned'],
      ['Encryption info', 'encryption_info'],
      ['Client authentication', 'client_authentication'],
      ['Logging info', 'logging_info'],
      ['Open monitoring', 'open_monitoring'],
      ['Storage mode', 'storage_mode'],
      ['Connectivity info', 'connectivity_info'],
      ['Bootstrap brokers', 'bootstrap_brokers'],
      ['Node count', 'node_count'],
      ['Operation count', 'operation_count'],
      ['SCRAM secret count', 'scram_secret_count'],
      ['VPC connection count', 'vpc_connection_count'],
      ['Nodes', 'nodes'],
      ['Operations', 'operations'],
      ['SCRAM secrets', 'scram_secrets'],
      ['Client VPC connections', 'client_vpc_connections'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Nodes', data.nodes || [], [
      ['Cluster name', 'cluster_name'],
      ['Node ARN', 'node_arn'],
      ['Node type', 'node_type'],
      ['Broker node info', 'broker_node_info'],
      ['ZooKeeper node info', 'zookeeper_node_info'],
    ]),
    renderDetailList('Operations', data.operations || [], [
      ['Cluster name', 'cluster_name'],
      ['Operation ARN', 'operation_arn'],
      ['Operation type', 'operation_type'],
      ['Operation state', 'operation_state'],
      ['Creation time', 'creation_time'],
      ['End time', 'end_time'],
      ['Source cluster info', 'source_cluster_info'],
      ['Target cluster info', 'target_cluster_info'],
    ]),
    renderDetailList('Configurations', data.configurations || [], [
      ['ARN', 'arn'],
      ['Description', 'description'],
      ['Kafka versions', 'kafka_versions'],
      ['Latest revision', 'latest_revision'],
      ['State', 'state'],
      ['Created', 'created'],
    ]),
    renderDetailList('Kafka versions', data.kafka_versions || [], [
      ['Version', 'Version'],
      ['Status', 'Status'],
    ]),
    renderDetailList('Supported from SDK', (data.supported_from_sdk || []).map((operation) => ({
      name: operation,
      operation,
    })), [
      ['Operation', 'operation'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  kafkaGrid.append(...panels);
  kafkaLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderOpenSearch(data) {
  opensearchGrid.textContent = '';
  renderSummary(data.summary, opensearchSummary);

  const panels = [
    renderDetailList('Domains', data.domains || [], [
      ['ARN', 'arn'],
      ['Engine version', 'engine_version'],
      ['Created', 'created'],
      ['Deleted', 'deleted'],
      ['Processing', 'processing'],
      ['Upgrade processing', 'upgrade_processing'],
      ['Endpoint', 'endpoint'],
      ['Endpoints', 'endpoints'],
      ['Cluster config', 'cluster_config'],
      ['EBS options', 'ebs_options'],
      ['VPC options', 'vpc_options'],
      ['Endpoint options', 'endpoint_options'],
      ['Advanced security options', 'advanced_security_options'],
      ['Encryption at rest', 'encryption_at_rest_options'],
      ['Node-to-node encryption', 'node_to_node_encryption_options'],
      ['Service software', 'service_software_options'],
      ['Health', 'health'],
      ['Config', 'config'],
      ['Nodes', 'nodes'],
      ['Package count', 'package_count'],
      ['Maintenance count', 'maintenance_count'],
      ['Scheduled action count', 'scheduled_action_count'],
      ['VPC endpoint principal count', 'vpc_endpoint_principal_count'],
      ['Data source count', 'data_source_count'],
      ['Packages', 'packages'],
      ['Maintenance', 'maintenance'],
      ['Scheduled actions', 'scheduled_actions'],
      ['VPC endpoint access', 'vpc_endpoint_access'],
      ['Data sources', 'data_sources'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Nodes', data.nodes || [], [
      ['Domain name', 'domain_name'],
      ['Node ID', 'node_id'],
      ['Availability zone', 'availability_zone'],
      ['Instance type', 'instance_type'],
      ['Node status', 'node_status'],
      ['Storage type', 'storage_type'],
      ['Storage volume type', 'storage_volume_type'],
      ['Node options', 'node_options'],
    ]),
    renderDetailList('Packages', data.packages || [], [
      ['Package ID', 'PackageID'],
      ['Package type', 'PackageType'],
      ['Status', 'PackageStatus'],
      ['Available version', 'AvailablePackageVersion'],
      ['Created', 'CreatedAt'],
      ['Last updated', 'LastUpdatedAt'],
    ]),
    renderDetailList('Versions', (data.versions || []).map((version) => ({
      name: version,
      version,
    })), [
      ['Version', 'version'],
    ]),
    renderDetailList('VPC endpoints', data.vpc_endpoints || [], [
      ['VPC endpoint ID', 'VpcEndpointId'],
      ['VPC ID', 'VpcId'],
      ['Domain ARN', 'DomainArn'],
      ['Status', 'Status'],
      ['Endpoint', 'Endpoint'],
    ]),
    renderDetailList('Inbound connections', data.inbound_connections || [], [
      ['Connection ID', 'ConnectionId'],
      ['Status', 'ConnectionStatus'],
      ['Local domain', 'LocalDomainInfo'],
      ['Remote domain', 'RemoteDomainInfo'],
    ]),
    renderDetailList('Outbound connections', data.outbound_connections || [], [
      ['Connection ID', 'ConnectionId'],
      ['Status', 'ConnectionStatus'],
      ['Local domain', 'LocalDomainInfo'],
      ['Remote domain', 'RemoteDomainInfo'],
    ]),
    renderDetailList('Applications', data.applications || [], [
      ['ID', 'id'],
      ['ARN', 'arn'],
      ['Status', 'status'],
      ['Created', 'createdAt'],
    ]),
    renderDetailList('Direct query data sources', data.direct_query_data_sources || [], [
      ['ARN', 'DataSourceArn'],
      ['Type', 'DataSourceType'],
      ['Description', 'Description'],
    ]),
    renderDetailList('Supported from SDK', (data.supported_from_sdk || []).map((operation) => ({
      name: operation,
      operation,
    })), [
      ['Operation', 'operation'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  opensearchGrid.append(...panels);
  opensearchLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderPipes(data) {
  pipesGrid.textContent = '';
  renderSummary(data.summary, pipesSummary);

  const panels = [
    renderDetailList('Pipes', data.pipes || [], [
      ['ARN', 'arn'],
      ['Description', 'description'],
      ['Desired state', 'desired_state'],
      ['Current state', 'current_state'],
      ['State reason', 'state_reason'],
      ['Source', 'source'],
      ['Source parameters', 'source_parameters'],
      ['Enrichment', 'enrichment'],
      ['Enrichment parameters', 'enrichment_parameters'],
      ['Target', 'target'],
      ['Target parameters', 'target_parameters'],
      ['Role ARN', 'role_arn'],
      ['Log configuration', 'log_configuration'],
      ['KMS key identifier', 'kms_key_identifier'],
      ['Created', 'created'],
      ['Last modified', 'last_modified'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('States', data.states || [], [
      ['State', 'state'],
      ['Count', 'count'],
    ]),
    renderDetailList('Supported from SDK', (data.supported_from_sdk || []).map((operation) => ({
      name: operation,
      operation,
    })), [
      ['Operation', 'operation'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  pipesGrid.append(...panels);
  pipesLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderResourceGroupsTagging(data) {
  resourcegroupstaggingGrid.textContent = '';
  renderSummary(data.summary, resourcegroupstaggingSummary);

  const reportItems = data.report ? [{
    name: data.report.Status || 'Report creation',
    status: data.report.Status,
    s3_location: data.report.S3Location,
    error_message: data.report.ErrorMessage,
  }] : [];

  const panels = [
    renderDetailList('Tagged resources', data.resources || [], [
      ['ARN', 'arn'],
      ['Resource type', 'resource_type'],
      ['Tag count', 'tag_count'],
      ['Tags', 'tags'],
      ['Compliance details', 'compliance_details'],
    ]),
    renderDetailList('Resource types', data.resource_types || [], [
      ['Resource type', 'resource_type'],
      ['Count', 'count'],
    ]),
    renderDetailList('Tag keys', data.tag_keys || [], [
      ['Key', 'key'],
    ]),
    renderDetailList('Tag values', data.tag_values || [], [
      ['Key', 'key'],
      ['Value count', 'value_count'],
      ['Values', 'values'],
    ]),
    renderDetailList('Top tags', data.top_tags || [], [
      ['Key', 'key'],
      ['Resource count', 'resource_count'],
    ]),
    renderDetailList('Compliance summary', data.compliance_summary || [], [
      ['Target ID', 'TargetId'],
      ['Region', 'Region'],
      ['Resource type', 'ResourceType'],
      ['Noncompliant resources', 'NonCompliantResources'],
    ]),
    renderDetailList('Report creation', reportItems, [
      ['Status', 'status'],
      ['S3 location', 's3_location'],
      ['Error message', 'error_message'],
    ]),
    renderDetailList('Supported from SDK', (data.supported_from_sdk || []).map((operation) => ({
      name: operation,
      operation,
    })), [
      ['Operation', 'operation'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  resourcegroupstaggingGrid.append(...panels);
  resourcegroupstaggingLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderSsm(data) {
  ssmGrid.textContent = '';
  renderSummary(data.summary, ssmSummary);

  const panels = [
    renderDetailList('Parameters', data.parameters || [], [
      ['Type', 'type'],
      ['Key ID', 'key_id'],
      ['Last modified', 'last_modified'],
      ['Last modified user', 'last_modified_user'],
      ['Description', 'description'],
      ['Version', 'version'],
      ['Tier', 'tier'],
      ['Policies', 'policies'],
      ['Data type', 'data_type'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Parameter types', data.parameter_types || [], [
      ['Type', 'type'],
      ['Count', 'count'],
    ]),
    renderDetailList('Documents', data.documents || [], [
      ['Owner', 'owner'],
      ['Platform types', 'platform_types'],
      ['Document version', 'document_version'],
      ['Document type', 'document_type'],
      ['Schema version', 'schema_version'],
      ['Document format', 'document_format'],
      ['Target type', 'target_type'],
      ['Status', 'status'],
      ['Created', 'created'],
      ['Description', 'description'],
      ['Parameters', 'parameters'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Managed instances', data.managed_instances || [], [
      ['Instance ID', 'InstanceId'],
      ['Ping status', 'PingStatus'],
      ['Last ping', 'LastPingDateTime'],
      ['Agent version', 'AgentVersion'],
      ['Platform type', 'PlatformType'],
      ['Platform name', 'PlatformName'],
      ['Platform version', 'PlatformVersion'],
      ['Resource type', 'ResourceType'],
    ]),
    renderDetailList('Sessions', data.sessions || [], [
      ['Session ID', 'SessionId'],
      ['Target', 'Target'],
      ['Status', 'Status'],
      ['Start date', 'StartDate'],
      ['End date', 'EndDate'],
      ['Owner', 'Owner'],
      ['Output URL', 'OutputUrl'],
    ]),
    renderDetailList('Automation executions', data.automation_executions || [], [
      ['Execution ID', 'AutomationExecutionId'],
      ['Document name', 'DocumentName'],
      ['Document version', 'DocumentVersion'],
      ['Status', 'AutomationExecutionStatus'],
      ['Execution start', 'ExecutionStartTime'],
      ['Execution end', 'ExecutionEndTime'],
      ['Executed by', 'ExecutedBy'],
    ]),
    renderDetailList('Maintenance windows', data.maintenance_windows || [], [
      ['Window ID', 'WindowId'],
      ['Description', 'Description'],
      ['Enabled', 'Enabled'],
      ['Duration', 'Duration'],
      ['Cutoff', 'Cutoff'],
      ['Schedule', 'Schedule'],
      ['Next execution time', 'NextExecutionTime'],
    ]),
    renderDetailList('Patch baselines', data.patch_baselines || [], [
      ['Baseline ID', 'BaselineId'],
      ['Operating system', 'OperatingSystem'],
      ['Description', 'BaselineDescription'],
      ['Default baseline', 'DefaultBaseline'],
    ]),
    renderDetailList('Associations', data.associations || [], [
      ['Association ID', 'AssociationId'],
      ['Instance ID', 'InstanceId'],
      ['Document version', 'DocumentVersion'],
      ['Targets', 'Targets'],
      ['Schedule expression', 'ScheduleExpression'],
      ['Overview', 'Overview'],
    ]),
    renderDetailList('Commands', data.commands || [], [
      ['Command ID', 'CommandId'],
      ['Document name', 'DocumentName'],
      ['Status', 'Status'],
      ['Status details', 'StatusDetails'],
      ['Requested date', 'RequestedDateTime'],
      ['Instance IDs', 'InstanceIds'],
      ['Targets', 'Targets'],
    ]),
    renderDetailList('Command invocations', data.command_invocations || [], [
      ['Command ID', 'CommandId'],
      ['Instance ID', 'InstanceId'],
      ['Status', 'Status'],
      ['Status details', 'StatusDetails'],
      ['Command plugins', 'CommandPlugins'],
    ]),
    renderDetailList('Compliance summaries', data.compliance_summaries || [], [
      ['Compliance type', 'ComplianceType'],
      ['Compliant summary', 'CompliantSummary'],
      ['Noncompliant summary', 'NonCompliantSummary'],
    ]),
    renderDetailList('Resource compliance summaries', data.resource_compliance_summaries || [], [
      ['Resource ID', 'ResourceId'],
      ['Resource type', 'ResourceType'],
      ['Compliance type', 'ComplianceType'],
      ['Status', 'Status'],
      ['Overall severity', 'OverallSeverity'],
    ]),
    renderDetailList('Resource data syncs', data.resource_data_syncs || [], [
      ['Sync name', 'SyncName'],
      ['Sync type', 'SyncType'],
      ['Sync source', 'SyncSource'],
      ['S3 destination', 'S3Destination'],
      ['Last sync status', 'LastStatus'],
    ]),
    renderDetailList('OpsItems', data.ops_items || [], [
      ['OpsItem ID', 'OpsItemId'],
      ['Status', 'Status'],
      ['Severity', 'Severity'],
      ['Category', 'Category'],
      ['Source', 'Source'],
      ['Priority', 'Priority'],
      ['Created', 'CreatedTime'],
      ['Last modified', 'LastModifiedTime'],
    ]),
    renderDetailList('Ops metadata', data.ops_metadata || [], [
      ['Resource ID', 'ResourceId'],
      ['ARN', 'OpsMetadataArn'],
      ['Last modified', 'LastModifiedDate'],
      ['Created', 'CreationDate'],
    ]),
    renderDetailList('Supported from SDK', (data.supported_from_sdk || []).map((operation) => ({
      name: operation,
      operation,
    })), [
      ['Operation', 'operation'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  ssmGrid.append(...panels);
  ssmLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderAthena(data) {
  athenaGrid.textContent = '';
  renderSummary(data.summary, athenaSummary);

  const formatInference = Object.entries(data.format_inference || {}).map(([format, reader]) => ({
    name: format,
    reader,
  }));

  const panels = [
    renderDetailList('Workgroups', data.workgroups || [], [
      ['State', 'state'],
      ['Description', 'description'],
      ['Created', 'creation_time'],
      ['Configuration', 'configuration'],
      ['Details', 'details'],
    ]),
    renderDetailList('Query executions', data.query_executions || [], [
      ['Query execution ID', 'id'],
      ['State', 'state'],
      ['State change reason', 'state_change_reason'],
      ['Submitted', 'submission_time'],
      ['Completed', 'completion_time'],
      ['Query', 'query'],
      ['Database', 'database'],
      ['Catalog', 'catalog'],
      ['Workgroup', 'workgroup'],
      ['Engine version', 'engine_version'],
      ['Statement type', 'statement_type'],
      ['Substatement type', 'substatement_type'],
      ['Result configuration', 'result_configuration'],
      ['Statistics', 'statistics'],
      ['Result preview', 'result_preview'],
      ['Details', 'details'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('How it works', (data.how_it_works || []).map((note, index) => ({
      name: `Step ${index + 1}`,
      note,
    })), [
      ['Detail', 'note'],
    ]),
    renderDetailList('Format inference', formatInference, [
      ['DuckDB reader', 'reader'],
    ]),
    renderDetailList('Configuration defaults', data.configuration ? [{
      name: 'Local defaults',
      ...data.configuration,
    }] : [], [
      ['Mock mode', 'mock'],
      ['Default image', 'default_image'],
      ['Duck URL', 'duck_url'],
    ]),
    renderDetailList('Environment variables', (data.environment_variables || []).map((variable) => ({
      name: variable,
      variable,
    })), [
      ['Variable', 'variable'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  athenaGrid.append(...panels);
  athenaLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderAutoScaling(data) {
  autoscalingGrid.textContent = '';
  renderSummary(data.summary, autoscalingSummary);

  const panels = [
    renderDetailList('Auto Scaling groups', data.groups || [], [
      ['ARN', 'arn'],
      ['Launch configuration', 'launch_configuration_name'],
      ['Launch template', 'launch_template'],
      ['Mixed instances policy', 'mixed_instances_policy'],
      ['Min size', 'min_size'],
      ['Max size', 'max_size'],
      ['Desired capacity', 'desired_capacity'],
      ['Default cooldown', 'default_cooldown'],
      ['Availability zones', 'availability_zones'],
      ['Load balancers', 'load_balancer_names'],
      ['Target groups', 'target_group_arns'],
      ['Health check type', 'health_check_type'],
      ['Health check grace period', 'health_check_grace_period'],
      ['Placement group', 'placement_group'],
      ['VPC zone identifier', 'vpc_zone_identifier'],
      ['Status', 'status'],
      ['Created', 'created_time'],
      ['Suspended processes', 'suspended_processes'],
      ['Enabled metrics', 'enabled_metrics'],
      ['Termination policies', 'termination_policies'],
      ['Scale-in protection', 'new_instances_protected_from_scale_in'],
      ['Service linked role ARN', 'service_linked_role_arn'],
      ['Capacity rebalance', 'capacity_rebalance'],
      ['Traffic sources', 'traffic_sources'],
      ['Availability zone distribution', 'availability_zone_distribution'],
      ['Availability zone impairment policy', 'availability_zone_impairment_policy'],
      ['Capacity reservation specification', 'capacity_reservation_specification'],
      ['Instance count', 'instance_count'],
      ['In-service instances', 'in_service_instances'],
      ['Instances', 'instances'],
      ['Policies', 'policies'],
      ['Scheduled actions', 'scheduled_actions'],
      ['Activities', 'activities'],
      ['Lifecycle hooks', 'lifecycle_hooks'],
      ['Warm pool', 'warm_pool'],
      ['Instance refreshes', 'instance_refreshes'],
      ['Notifications', 'notification_configurations'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Launch configurations', data.launch_configurations || [], [
      ['ARN', 'LaunchConfigurationARN'],
      ['Image ID', 'ImageId'],
      ['Key name', 'KeyName'],
      ['Security groups', 'SecurityGroups'],
      ['ClassicLink VPC', 'ClassicLinkVPCId'],
      ['ClassicLink security groups', 'ClassicLinkVPCSecurityGroups'],
      ['User data', 'UserData'],
      ['Instance type', 'InstanceType'],
      ['Kernel ID', 'KernelId'],
      ['RAM disk ID', 'RamdiskId'],
      ['Block device mappings', 'BlockDeviceMappings'],
      ['Instance monitoring', 'InstanceMonitoring'],
      ['Spot price', 'SpotPrice'],
      ['IAM instance profile', 'IamInstanceProfile'],
      ['Created', 'CreatedTime'],
      ['EBS optimized', 'EbsOptimized'],
      ['Associate public IP address', 'AssociatePublicIpAddress'],
      ['Placement tenancy', 'PlacementTenancy'],
      ['Metadata options', 'MetadataOptions'],
    ]),
    renderDetailList('Scaling policies', data.scaling_policies || [], [
      ['ARN', 'PolicyARN'],
      ['Group', 'AutoScalingGroupName'],
      ['Type', 'PolicyType'],
      ['Adjustment type', 'AdjustmentType'],
      ['Scaling adjustment', 'ScalingAdjustment'],
      ['Cooldown', 'Cooldown'],
      ['Metric aggregation type', 'MetricAggregationType'],
      ['Step adjustments', 'StepAdjustments'],
      ['Estimated instance warmup', 'EstimatedInstanceWarmup'],
      ['Alarms', 'Alarms'],
      ['Target tracking configuration', 'TargetTrackingConfiguration'],
      ['Predictive scaling configuration', 'PredictiveScalingConfiguration'],
      ['Enabled', 'Enabled'],
    ]),
    renderDetailList('Scheduled actions', data.scheduled_actions || [], [
      ['ARN', 'ScheduledActionARN'],
      ['Group', 'AutoScalingGroupName'],
      ['Time', 'Time'],
      ['Start time', 'StartTime'],
      ['End time', 'EndTime'],
      ['Recurrence', 'Recurrence'],
      ['Min size', 'MinSize'],
      ['Max size', 'MaxSize'],
      ['Desired capacity', 'DesiredCapacity'],
      ['Time zone', 'TimeZone'],
    ]),
    renderDetailList('Scaling activities', data.activities || [], [
      ['Activity ID', 'ActivityId'],
      ['Group', 'AutoScalingGroupName'],
      ['Description', 'Description'],
      ['Cause', 'Cause'],
      ['Start time', 'StartTime'],
      ['End time', 'EndTime'],
      ['Status code', 'StatusCode'],
      ['Status message', 'StatusMessage'],
      ['Progress', 'Progress'],
      ['Details', 'Details'],
      ['Auto scaling group state', 'AutoScalingGroupState'],
    ]),
    renderDetailList('Notification configurations', data.notification_configurations || [], [
      ['Group', 'AutoScalingGroupName'],
      ['Topic ARN', 'TopicARN'],
      ['Notification type', 'NotificationType'],
    ]),
    renderDetailList('Tags', data.tags || [], [
      ['Resource ID', 'ResourceId'],
      ['Resource type', 'ResourceType'],
      ['Key', 'Key'],
      ['Value', 'Value'],
      ['Propagate at launch', 'PropagateAtLaunch'],
    ]),
    renderDetailList('Account limits', data.account_limits ? [{
      name: 'Account limits',
      ...data.account_limits,
    }] : [], [
      ['Max groups', 'MaxNumberOfAutoScalingGroups'],
      ['Max launch configurations', 'MaxNumberOfLaunchConfigurations'],
      ['Groups', 'NumberOfAutoScalingGroups'],
      ['Launch configurations', 'NumberOfLaunchConfigurations'],
    ]),
    renderDetailList('Adjustment types', data.adjustment_types || [], [
      ['Type', 'AdjustmentType'],
    ]),
    renderDetailList('Metric collection types', data.metric_collection_types ? [{
      name: 'Metric collection types',
      ...data.metric_collection_types,
    }] : [], [
      ['Granularities', 'Granularities'],
      ['Metrics', 'Metrics'],
    ]),
    renderDetailList('Scaling process types', data.scaling_process_types || [], [
      ['Process name', 'ProcessName'],
    ]),
    renderDetailList('Termination policy types', (data.termination_policy_types || []).map((policy) => ({
      name: policy,
      policy,
    })), [
      ['Policy', 'policy'],
    ]),
    renderDetailList('Supported from SDK', (data.supported_from_sdk || []).map((operation) => ({
      name: operation,
      operation,
    })), [
      ['Operation', 'operation'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  autoscalingGrid.append(...panels);
  autoscalingLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderSNS(data) {
  snsGrid.textContent = '';
  renderSummary(data.summary, snsSummary);

  const panels = [
    renderDetailList('Topics', data.topics || [], [
      ['ARN', 'arn'],
      ['Attributes', 'attributes'],
      ['Tags', 'tags'],
      ['Subscription count', 'subscription_count'],
      ['Subscriptions', 'subscriptions'],
    ]),
    renderDetailList('Subscriptions', data.subscriptions || [], [
      ['ARN', 'arn'],
      ['Topic ARN', 'topic_arn'],
      ['Protocol', 'protocol'],
      ['Endpoint', 'endpoint'],
      ['Owner', 'owner'],
      ['Attributes', 'attributes'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('SNS to SQS fan-out', (data.fanout || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
    renderDetailList('Protocols', (data.protocols || []).map((protocol) => ({
      name: protocol,
      protocol,
    })), [
      ['Protocol', 'protocol'],
    ]),
  ];

  snsGrid.append(...panels);
  snsLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderSES(data) {
  sesGrid.textContent = '';
  renderSummary(data.summary, sesSummary);

  const panels = [
    renderDetailList('Identities', data.identities || [], [
      ['Type', 'type'],
      ['Verification', 'verification'],
      ['Notifications', 'notifications'],
      ['DKIM', 'dkim'],
    ]),
    renderDetailList('Verified email addresses', data.verified_email_addresses || [], [
      ['Email', 'email'],
    ]),
    renderDetailList('Templates', data.templates || [], [
      ['Created', 'created'],
      ['Details', 'details'],
    ]),
    renderDetailList('Captured mailbox', data.mailbox?.messages || [], [
      ['Message ID', 'id'],
      ['From', 'from'],
      ['To', 'to'],
      ['Subject', 'subject'],
      ['Timestamp', 'timestamp'],
      ['Body preview', 'body_preview'],
    ]),
    renderDetailList('SES v2 identities', data.v2_identities || [], [
      ['Identity type', 'IdentityType'],
      ['Sending enabled', 'SendingEnabled'],
      ['Verification status', 'VerificationStatus'],
    ]),
    renderDetailList('SES v2 templates', data.v2_templates || [], [
      ['Created', 'CreatedTimestamp'],
    ]),
    renderDetailList('Send quota', data.send_quota ? [{
      name: 'Quota',
      ...data.send_quota,
    }] : [], [
      ['Max 24 hour send', 'Max24HourSend'],
      ['Max send rate', 'MaxSendRate'],
      ['Sent last 24 hours', 'SentLast24Hours'],
    ]),
    renderDetailList('Send statistics', data.send_statistics || [], [
      ['Timestamp', 'Timestamp'],
      ['Delivery attempts', 'DeliveryAttempts'],
      ['Bounces', 'Bounces'],
      ['Complaints', 'Complaints'],
      ['Rejects', 'Rejects'],
    ]),
    renderDetailList('Account sending', data.account_sending_enabled ? [{
      name: 'Sending status',
      ...data.account_sending_enabled,
    }] : [], [
      ['Enabled', 'Enabled'],
    ]),
    renderDetailList('Supported v1 actions', (data.supported_v1 || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Supported v2 operations', (data.supported_v2 || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Operation', 'action'],
    ]),
    renderDetailList('Inspection endpoints', (data.inspection_endpoints || []).map((endpointValue) => ({
      name: endpointValue,
      endpoint: endpointValue,
    })), [
      ['Endpoint', 'endpoint'],
    ]),
    renderDetailList('Configuration defaults', data.configuration ? [{
      name: 'Local defaults',
      ...data.configuration,
    }] : [], [
      ['SMTP host', 'smtp_host'],
      ['SMTP port', 'smtp_port'],
      ['SMTP STARTTLS', 'smtp_starttls'],
    ]),
    renderDetailList('Environment variables', (data.environment_variables || []).map((variable) => ({
      name: variable,
      variable,
    })), [
      ['Variable', 'variable'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  sesGrid.append(...panels);
  sesLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderCloudFormation(data) {
  cloudformationGrid.textContent = '';
  renderSummary(data.summary, cloudformationSummary);

  const panels = [
    renderDetailList('Stacks', data.stacks || [], [
      ['Stack ID', 'id'],
      ['Status', 'status'],
      ['Status reason', 'status_reason'],
      ['Created', 'created'],
      ['Updated', 'updated'],
      ['Deleted', 'deleted'],
      ['Description', 'description'],
      ['Parameters', 'parameters'],
      ['Outputs', 'outputs'],
      ['Tags', 'tags'],
      ['Capabilities', 'capabilities'],
      ['Disable rollback', 'disable_rollback'],
      ['Rollback configuration', 'rollback_configuration'],
      ['Resource count', 'resource_count'],
      ['Resources', 'resources'],
      ['Resource summaries', 'resource_summaries'],
      ['Event count', 'event_count'],
      ['Events', 'events'],
      ['Change set count', 'change_set_count'],
      ['Change sets', 'change_sets'],
      ['Template', 'template'],
      ['Stack policy', 'stack_policy'],
      ['Details', 'details'],
    ]),
    renderDetailList('StackSets', data.stack_sets || [], [
      ['StackSet ID', 'id'],
      ['Status', 'status'],
      ['Description', 'description'],
      ['Created', 'created'],
      ['Updated', 'updated'],
      ['Details', 'details'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Protocol', data.protocol ? [{
      name: data.protocol,
      protocol: data.protocol,
    }] : [], [
      ['Protocol', 'protocol'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  cloudformationGrid.append(...panels);
  cloudformationLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderECR(data) {
  ecrGrid.textContent = '';
  renderSummary(data.summary, ecrSummary);

  const panels = [
    renderDetailList('Repositories', data.repositories || [], [
      ['ARN', 'arn'],
      ['Registry ID', 'registry_id'],
      ['URI', 'uri'],
      ['Created', 'created'],
      ['Tag mutability', 'tag_mutability'],
      ['Encryption', 'encryption_configuration'],
      ['Scanning', 'scanning_configuration'],
      ['Image count', 'image_count'],
      ['Images', 'images'],
      ['Image details', 'image_details'],
      ['Tags', 'tags'],
      ['Lifecycle policy', 'lifecycle_policy'],
      ['Repository policy', 'repository_policy'],
    ]),
    renderDetailList('Auth proxy endpoints', data.auth_endpoints || [], [
      ['Proxy endpoint', 'proxy_endpoint'],
      ['Expires at', 'expires_at'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Admin endpoints', (data.admin_endpoints || []).map((endpointValue) => ({
      name: endpointValue,
      endpoint: endpointValue,
    })), [
      ['Endpoint', 'endpoint'],
    ]),
    renderDetailList('Configuration defaults', data.configuration ? [{
      name: 'Local defaults',
      ...data.configuration,
    }] : [], [
      ['Registry image', 'registry_image'],
      ['Registry container', 'registry_container_name'],
      ['Registry base port', 'registry_base_port'],
      ['Registry max port', 'registry_max_port'],
      ['Data path', 'data_path'],
      ['TLS enabled', 'tls_enabled'],
      ['Keep running on shutdown', 'keep_running_on_shutdown'],
      ['URI style', 'uri_style'],
    ]),
    renderDetailList('Environment variables', (data.environment_variables || []).map((variable) => ({
      name: variable,
      variable,
    })), [
      ['Variable', 'variable'],
    ]),
    renderDetailList('Not implemented', (data.not_implemented || []).map((item) => ({
      name: item,
      item,
    })), [
      ['Feature', 'item'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  ecrGrid.append(...panels);
  ecrLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderRDS(data) {
  rdsGrid.textContent = '';
  renderSummary(data.summary, rdsSummary);

  const panels = [
    renderDetailList('DB instances', data.instances || [], [
      ['ARN', 'arn'],
      ['Status', 'status'],
      ['Engine', 'engine'],
      ['Engine version', 'engine_version'],
      ['Class', 'class'],
      ['Allocated storage', 'allocated_storage'],
      ['Storage type', 'storage_type'],
      ['Multi-AZ', 'multi_az'],
      ['Publicly accessible', 'publicly_accessible'],
      ['IAM auth', 'iam_authentication'],
      ['Master username', 'master_username'],
      ['Endpoint', 'endpoint'],
      ['Connect host', 'connect_host'],
      ['Connect port', 'connect_port'],
      ['DB name', 'db_name'],
      ['Parameter groups', 'parameter_groups'],
      ['Subnet group', 'subnet_group'],
      ['Security groups', 'security_groups'],
      ['Created', 'created'],
      ['Cluster identifier', 'cluster_identifier'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('DB clusters', data.clusters || [], [
      ['ARN', 'arn'],
      ['Status', 'status'],
      ['Engine', 'engine'],
      ['Engine version', 'engine_version'],
      ['Database name', 'database_name'],
      ['Master username', 'master_username'],
      ['Endpoint', 'endpoint'],
      ['Reader endpoint', 'reader_endpoint'],
      ['Port', 'port'],
      ['Members', 'members'],
      ['Parameter group', 'parameter_group'],
      ['Created', 'created'],
      ['IAM auth', 'iam_authentication'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Parameter groups', data.parameter_groups || [], [
      ['ARN', 'arn'],
      ['Family', 'family'],
      ['Description', 'description'],
      ['Parameter count', 'parameter_count'],
      ['Parameters', 'parameters'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Supported engines', data.supported_engines || [], [
      ['Default image', 'default_image'],
    ]),
    renderDetailList('Configuration defaults', data.configuration ? [{
      name: 'Local defaults',
      ...data.configuration,
    }] : [], [
      ['Proxy base port', 'proxy_base_port'],
      ['Proxy max port', 'proxy_max_port'],
      ['Default Postgres image', 'default_postgres_image'],
      ['Default MySQL image', 'default_mysql_image'],
      ['Default MariaDB image', 'default_mariadb_image'],
    ]),
    renderDetailList('Environment variables', (data.environment_variables || []).map((variable) => ({
      name: variable,
      variable,
    })), [
      ['Variable', 'variable'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  rdsGrid.append(...panels);
  rdsLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderBackup(data) {
  backupGrid.textContent = '';
  renderSummary(data.summary, backupSummary);

  const panels = [
    renderDetailList('Backup vaults', data.vaults || [], [
      ['ARN', 'arn'],
      ['Created', 'created'],
      ['Creator request ID', 'creator_request_id'],
      ['Encryption key ARN', 'encryption_key_arn'],
      ['Recovery points', 'recovery_points'],
      ['Locked', 'locked'],
      ['Minimum retention days', 'min_retention_days'],
      ['Maximum retention days', 'max_retention_days'],
      ['Recovery point count', 'recovery_point_count'],
      ['Recovery point details', 'recovery_point_details'],
    ]),
    renderDetailList('Backup plans', data.plans || [], [
      ['ARN', 'arn'],
      ['Plan ID', 'id'],
      ['Version ID', 'version_id'],
      ['Created', 'created'],
      ['Deleted', 'deleted'],
      ['Last execution', 'last_execution'],
      ['Advanced backup settings', 'advanced_backup_settings'],
      ['Rules', 'rules'],
      ['Selection count', 'selection_count'],
      ['Selections', 'selections'],
    ]),
    renderDetailList('Backup jobs', data.backup_jobs || [], [
      ['Job ID', 'BackupJobId'],
      ['Vault name', 'BackupVaultName'],
      ['Vault ARN', 'BackupVaultArn'],
      ['Recovery point ARN', 'RecoveryPointArn'],
      ['Resource ARN', 'ResourceArn'],
      ['Resource type', 'ResourceType'],
      ['State', 'State'],
      ['Status message', 'StatusMessage'],
      ['Created', 'CreationDate'],
      ['Started', 'StartBy'],
      ['Completed', 'CompletionDate'],
      ['Percent done', 'PercentDone'],
      ['Backup size bytes', 'BackupSizeInBytes'],
      ['IAM role ARN', 'IamRoleArn'],
    ]),
    renderDetailList('Restore jobs', data.restore_jobs || [], [
      ['Job ID', 'RestoreJobId'],
      ['Recovery point ARN', 'RecoveryPointArn'],
      ['Resource ARN', 'ResourceArn'],
      ['Resource type', 'ResourceType'],
      ['Status', 'Status'],
      ['Status message', 'StatusMessage'],
      ['Created', 'CreationDate'],
      ['Completed', 'CompletionDate'],
      ['IAM role ARN', 'IamRoleArn'],
      ['Expected completion time minutes', 'ExpectedCompletionTimeMinutes'],
      ['Percent done', 'PercentDone'],
    ]),
    renderDetailList('Protected resources', data.protected_resources || [], [
      ['Resource ARN', 'ResourceArn'],
      ['Resource type', 'ResourceType'],
      ['Last backup time', 'LastBackupTime'],
      ['Last backup vault ARN', 'LastBackupVaultArn'],
      ['Last recovery point ARN', 'LastRecoveryPointArn'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  backupGrid.append(...panels);
  backupLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderRoute53(data) {
  route53Grid.textContent = '';
  renderSummary(data.summary, route53Summary);

  const panels = [
    renderDetailList('Hosted zones', data.hosted_zones || [], [
      ['ID', 'id'],
      ['Clean ID', 'clean_id'],
      ['Caller reference', 'caller_reference'],
      ['Private zone', 'private_zone'],
      ['Comment', 'comment'],
      ['Resource record set count', 'resource_record_set_count'],
      ['Delegation set', 'delegation_set'],
      ['VPCs', 'vpcs'],
      ['Query logging configs', 'query_logging_configs'],
      ['Record count', 'record_count'],
      ['Records', 'records'],
    ]),
    renderDetailList('Health checks', data.health_checks || [], [
      ['ID', 'Id'],
      ['Caller reference', 'CallerReference'],
      ['Health check version', 'HealthCheckVersion'],
      ['Config', 'HealthCheckConfig'],
      ['Linked service', 'LinkedService'],
      ['CloudWatch alarm configuration', 'CloudWatchAlarmConfiguration'],
    ]),
    renderDetailList('Traffic policies', data.traffic_policies || [], [
      ['ID', 'Id'],
      ['Type', 'Type'],
      ['Latest version', 'LatestVersion'],
      ['Traffic policy count', 'TrafficPolicyCount'],
    ]),
    renderDetailList('Traffic policy instances', data.traffic_policy_instances || [], [
      ['ID', 'Id'],
      ['Hosted zone ID', 'HostedZoneId'],
      ['Name', 'Name'],
      ['TTL', 'TTL'],
      ['State', 'State'],
      ['Message', 'Message'],
      ['Traffic policy ID', 'TrafficPolicyId'],
      ['Traffic policy version', 'TrafficPolicyVersion'],
      ['Traffic policy type', 'TrafficPolicyType'],
    ]),
    renderDetailList('Reusable delegation sets', data.delegation_sets || [], [
      ['ID', 'Id'],
      ['Caller reference', 'CallerReference'],
      ['Name servers', 'NameServers'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  route53Grid.append(...panels);
  route53LoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderTransfer(data) {
  transferGrid.textContent = '';
  renderSummary(data.summary, transferSummary);

  const panels = [
    renderDetailList('Servers', data.servers || [], [
      ['Server ID', 'id'],
      ['ARN', 'arn'],
      ['State', 'state'],
      ['Endpoint type', 'endpoint_type'],
      ['Domain', 'domain'],
      ['Identity provider type', 'identity_provider_type'],
      ['Protocols', 'protocols'],
      ['Endpoint details', 'endpoint_details'],
      ['Logging role', 'logging_role'],
      ['Structured log destinations', 'structured_log_destinations'],
      ['Security policy name', 'security_policy_name'],
      ['Workflow details', 'workflow_details'],
      ['Certificate', 'certificate'],
      ['Tags', 'tags'],
      ['User count', 'user_count'],
      ['Users', 'users'],
      ['Host key count', 'host_key_count'],
      ['Host keys', 'host_keys'],
      ['Agreement count', 'agreement_count'],
      ['Agreements', 'agreements'],
    ]),
    renderDetailList('Workflows', data.workflows || [], [
      ['Workflow ID', 'WorkflowId'],
      ['ARN', 'Arn'],
      ['Description', 'Description'],
    ]),
    renderDetailList('Profiles', data.profiles || [], [
      ['Profile ID', 'id'],
      ['ARN', 'arn'],
      ['AS2 ID', 'as2_id'],
      ['Profile type', 'profile_type'],
      ['Certificate IDs', 'certificate_ids'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Certificates', data.certificates || [], [
      ['Certificate ID', 'id'],
      ['ARN', 'arn'],
      ['Status', 'status'],
      ['Type', 'type'],
      ['Usage', 'usage'],
      ['Certificate', 'certificate'],
      ['Active date', 'active_date'],
      ['Inactive date', 'inactive_date'],
      ['Serial', 'serial'],
      ['Not before', 'not_before_date'],
      ['Not after', 'not_after_date'],
      ['Description', 'description'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Connectors', data.connectors || [], [
      ['Connector ID', 'id'],
      ['ARN', 'arn'],
      ['URL', 'url'],
      ['AS2 config', 'as2_config'],
      ['Access role', 'access_role'],
      ['Logging role', 'logging_role'],
      ['Security policy name', 'security_policy_name'],
      ['Tags', 'tags'],
    ]),
    renderDetailList('Security policies', (data.security_policies || []).map((policy) => ({
      name: policy,
      policy,
    })), [
      ['Policy', 'policy'],
    ]),
    renderDetailList('Web apps', data.web_apps || [], [
      ['Web app ID', 'WebAppId'],
      ['ARN', 'Arn'],
      ['Endpoint', 'Endpoint'],
      ['Identity provider details', 'IdentityProviderDetails'],
      ['Access endpoint', 'AccessEndpoint'],
      ['Tags', 'Tags'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  transferGrid.append(...panels);
  transferLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderACM(data) {
  acmGrid.textContent = '';
  renderSummary(data.summary, acmSummary);

  const panels = [
    renderDetailList('Certificates', data.certificates || [], [
      ['ARN', 'arn'],
      ['Domain', 'domain_name'],
      ['Status', 'status'],
      ['Type', 'type'],
      ['Key algorithm', 'key_algorithm'],
      ['Created', 'created'],
      ['Issued at', 'issued_at'],
      ['Not before', 'not_before'],
      ['Not after', 'not_after'],
      ['Renewal eligibility', 'renewal_eligibility'],
      ['Subject alternative names', 'subject_alternative_names'],
      ['Validation options', 'domain_validation_options'],
      ['In use by', 'in_use_by'],
      ['Signature algorithm', 'signature_algorithm'],
      ['Has certificate PEM', 'has_certificate_pem'],
      ['Has certificate chain', 'has_certificate_chain'],
      ['Tags', 'tags'],
      ['Details', 'details'],
      ['Certificate error', 'certificate_error'],
    ]),
    renderDetailList('Account configuration', data.account_configuration ? [{
      name: 'Account configuration',
      ...data.account_configuration,
    }] : [], [
      ['Configuration', 'ExpiryEvents'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Key algorithms', (data.key_algorithms || []).map((algorithm) => ({
      name: algorithm,
      algorithm,
    })), [
      ['Algorithm', 'algorithm'],
    ]),
    renderDetailList('Certificate types', (data.certificate_types || []).map((type) => ({
      name: type,
      type,
    })), [
      ['Type', 'type'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  acmGrid.append(...panels);
  acmLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderStepFunctions(data) {
  stepfunctionsGrid.textContent = '';
  renderSummary(data.summary, stepfunctionsSummary);

  const panels = [
    renderDetailList('State machines', data.state_machines || [], [
      ['ARN', 'arn'],
      ['Type', 'type'],
      ['Status', 'status'],
      ['Created', 'created'],
      ['Role ARN', 'role_arn'],
      ['Definition', 'definition'],
      ['Logging configuration', 'logging_configuration'],
      ['Tracing configuration', 'tracing_configuration'],
      ['Execution count', 'execution_count'],
      ['Running executions', 'running_executions'],
      ['Succeeded executions', 'succeeded_executions'],
      ['Failed executions', 'failed_executions'],
      ['Executions', 'executions'],
      ['Details', 'details'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Protocol', data.protocol ? [{
      name: data.protocol,
      protocol: data.protocol,
    }] : [], [
      ['Protocol', 'protocol'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  stepfunctionsGrid.append(...panels);
  stepfunctionsLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderScheduler(data) {
  schedulerGrid.textContent = '';
  renderSummary(data.summary, schedulerSummary);

  const panels = [
    renderDetailList('Schedule groups', data.groups || [], [
      ['ARN', 'arn'],
      ['State', 'state'],
      ['Created', 'created'],
      ['Last modified', 'last_modified'],
      ['Schedule count', 'schedule_count'],
      ['Schedules', 'schedules'],
      ['Details', 'details'],
    ]),
    renderDetailList('Schedules', data.schedules || [], [
      ['ARN', 'arn'],
      ['Group', 'group'],
      ['State', 'state'],
      ['Expression', 'expression'],
      ['Timezone', 'timezone'],
      ['Start date', 'start_date'],
      ['End date', 'end_date'],
      ['Action after completion', 'action_after_completion'],
      ['Flexible time window', 'flexible_time_window'],
      ['Target', 'target'],
      ['Created', 'created'],
      ['Last modified', 'last_modified'],
      ['Description', 'description'],
      ['KMS key ARN', 'kms_key_arn'],
      ['Details', 'details'],
    ]),
    renderDetailList('Supported actions', (data.supported || []).map((action) => ({
      name: action,
      action,
    })), [
      ['Action', 'action'],
    ]),
    renderDetailList('Supported expressions', (data.supported_expressions || []).map((expression) => ({
      name: expression,
      expression,
    })), [
      ['Expression', 'expression'],
    ]),
    renderDetailList('Supported targets', (data.supported_targets || []).map((target) => ({
      name: target,
      target,
    })), [
      ['Target', 'target'],
    ]),
    renderDetailList('Not yet supported', (data.not_supported || []).map((item) => ({
      name: item,
      item,
    })), [
      ['Feature', 'item'],
    ]),
    renderDetailList('Configuration defaults', data.configuration ? [{
      name: 'Local defaults',
      ...data.configuration,
    }] : [], [
      ['Invocation enabled', 'invocation_enabled'],
      ['Tick interval seconds', 'tick_interval_seconds'],
    ]),
    renderDetailList('Notes', (data.notes || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Note', 'note'],
    ]),
  ];

  schedulerGrid.append(...panels);
  schedulerLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function renderGlue(data) {
  glueGrid.textContent = '';
  renderSummary(data.summary, glueSummary);

  const supported = Object.entries(data.supported || {}).map(([category, actions]) => ({
    name: category,
    actions,
  }));
  const formatInference = Object.entries(data.format_inference || {}).map(([format, reader]) => ({
    name: format,
    reader,
  }));

  const panels = [
    renderDetailList('Databases', data.databases || [], [
      ['Description', 'description'],
      ['Location URI', 'location_uri'],
      ['Parameters', 'parameters'],
      ['Created', 'created'],
      ['Table count', 'table_count'],
      ['Partition count', 'partition_count'],
      ['Tables', 'tables'],
      ['Details', 'details'],
    ]),
    renderDetailList('Supported actions', supported, [
      ['Actions', 'actions'],
    ]),
    renderDetailList('Athena integration', (data.athena_integration || []).map((note, index) => ({
      name: `Note ${index + 1}`,
      note,
    })), [
      ['Detail', 'note'],
    ]),
    renderDetailList('Format inference', formatInference, [
      ['DuckDB reader', 'reader'],
    ]),
  ];

  glueGrid.append(...panels);
  glueLoadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

function titleCaseService(name) {
  const labels = {
    acm: 'ACM',
    apigateway: 'API Gateway',
    apigatewayv2: 'API Gateway v2',
    appconfig: 'AppConfig',
    appconfigdata: 'AppConfig Data',
    athena: 'Athena',
    'auto-scaling': 'Auto Scaling',
    autoscaling: 'Auto Scaling',
    'bedrock-runtime': 'Bedrock Runtime',
    bedrockruntime: 'Bedrock Runtime',
    codebuild: 'CodeBuild',
    codedeploy: 'CodeDeploy',
    cloudformation: 'CloudFormation',
    'cognito-idp': 'Cognito IDP',
    dynamodb: 'DynamoDB',
    ec2: 'EC2',
    ecr: 'ECR',
    ecs: 'ECS',
    eks: 'EKS',
    elasticache: 'ElastiCache',
    elasticloadbalancing: 'Elastic Load Balancing',
    elb: 'Classic ELB',
    elbv2: 'Elastic Load Balancing v2',
    email: 'SES',
    es: 'OpenSearch',
    events: 'EventBridge',
    firehose: 'Firehose',
    glue: 'Glue',
    iam: 'IAM',
    kafka: 'MSK / Kafka',
    kinesis: 'Kinesis',
    kms: 'KMS',
    lambda: 'Lambda',
    logs: 'CloudWatch Logs',
    opensearch: 'OpenSearch',
    monitoring: 'CloudWatch Metrics',
    pipes: 'EventBridge Pipes',
    rds: 'RDS',
    route53: 'Route 53',
    resourcegroupstagging: 'Resource Groups Tagging',
    resourcegroupstaggingapi: 'Resource Groups Tagging',
    s3: 'S3',
    scheduler: 'EventBridge Scheduler',
    secretsmanager: 'Secrets Manager',
    ses: 'SES',
    sns: 'SNS',
    sqs: 'SQS',
    ssm: 'SSM',
    stepfunctions: 'Step Functions',
    states: 'Step Functions',
    tagging: 'Resource Groups Tagging',
    transfer: 'Transfer Family',
  };

  return labels[name] || name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function serviceHref(name) {
  return serviceDetailPages[name] || serviceDetailPages[canonicalServiceKey(name)] || null;
}

function resourceServiceName(resource) {
  if (resource.name === 'route53-resources') {
    return 'Route 53';
  }

  if (resource.name === 'transfer-resources') {
    return 'Transfer Family';
  }

  if (resource.name.startsWith('iam-')) {
    return 'IAM';
  }

  return resource.label.replace(/\s+(users|roles|buckets|queues|tables|topics|functions|keys|secrets|groups)$/i, '');
}

function serviceDescription(resource) {
  if (resource.error) {
    return resource.error;
  }

  if (resource.count === 0) {
    return 'No local resources found yet.';
  }

  return `${resource.count} local item${resource.count === 1 ? '' : 's'} found.`;
}

function resourceServiceKey(resource) {
  const keys = {
    'acm-certificates': 'acm',
    'cloudwatch-metrics': 'monitoring',
    'cloudformation-resources': 'cloudformation',
    'cognito-resources': 'cognito-idp',
    'athena-resources': 'athena',
    'autoscaling-resources': 'autoscaling',
    'dynamodb-tables': 'dynamodb',
    'ec2-resources': 'ec2',
    'ecr-resources': 'ecr',
    'ecs-resources': 'ecs',
    'eks-resources': 'eks',
    'elasticache-resources': 'elasticache',
    'elasticloadbalancing-resources': 'elasticloadbalancing',
    'eventbridge-resources': 'events',
    'firehose-resources': 'firehose',
    'glue-resources': 'glue',
    'kafka-resources': 'kafka',
    'kinesis-resources': 'kinesis',
    'opensearch-resources': 'opensearch',
    'pipes-resources': 'pipes',
    'resourcegroupstagging-resources': 'resourcegroupstagging',
    'appconfig-resources': 'appconfig',
    'apigateway-apis': 'apigateway',
    'bedrockruntime-resources': 'bedrock-runtime',
    'codebuild-resources': 'codebuild',
    'codedeploy-resources': 'codedeploy',
    'iam-roles': 'iam',
    'iam-users': 'iam',
    'kms-keys': 'kms',
    'lambda-functions': 'lambda',
    'log-groups': 'logs',
    'rds-resources': 'rds',
    's3-buckets': 's3',
    'secrets': 'secretsmanager',
    'ssm-resources': 'ssm',
    'ses-resources': 'ses',
    'scheduler-resources': 'scheduler',
    'sns-topics': 'sns',
    'sqs-queues': 'sqs',
    'stepfunctions-resources': 'stepfunctions',
    'transfer-resources': 'transfer',
  };

  if (keys[resource.name]) {
    return keys[resource.name];
  }

  if (resource.name.startsWith('iam-')) {
    return 'iam';
  }

  return canonicalServiceKey(resource.name.replace(/-.*/, ''));
}

function mergeServiceCards(resources, healthServices = {}) {
  const services = new Map();

  Object.entries(healthServices).forEach(([name, status]) => {
    const key = canonicalServiceKey(name);
    const existing = services.get(key);

    if (existing) {
      existing.status = existing.status || status;
      existing.descriptions.push(`Service status: ${status}`);
      return;
    }

    services.set(key, {
      key,
      name: titleCaseService(key),
      status,
      count: 0,
      error: null,
      href: serviceHref(key),
      descriptions: [`Service status: ${status}`],
    });
  });

  resources.forEach((resource) => {
    const key = resourceServiceKey(resource);
    const existing = services.get(key);
    const count = Number.isInteger(resource.count) ? resource.count : 0;

    if (!existing) {
      services.set(key, {
        key,
        name: resourceServiceName(resource),
        status: null,
        count,
        error: resource.error,
        href: serviceHref(key),
        descriptions: [serviceDescription(resource)],
      });
      return;
    }

    existing.count += count;
    existing.error = existing.error || resource.error;
    existing.descriptions.push(`${resource.label}: ${serviceDescription(resource)}`);
  });

  return Array.from(services.values()).sort((left, right) => {
    const leftHasResources = left.count > 0 ? 1 : 0;
    const rightHasResources = right.count > 0 ? 1 : 0;

    if (leftHasResources !== rightHasResources) {
      return rightHasResources - leftHasResources;
    }

    if (left.count !== right.count) {
      return right.count - left.count;
    }

    const leftHasPage = left.href ? 1 : 0;
    const rightHasPage = right.href ? 1 : 0;

    if (leftHasPage !== rightHasPage) {
      return rightHasPage - leftHasPage;
    }

    return left.name.localeCompare(right.name);
  });
}

function renderServices(resources, healthServices = {}) {
  serviceGrid.textContent = '';
  serviceGrid.setAttribute('aria-busy', 'false');

  mergeServiceCards(resources, healthServices).forEach((service) => {
    const card = document.createElement(service.href ? 'a' : 'article');
    card.className = 'service-card';
    card.dataset.service = service.key;

    if (service.href) {
      card.href = service.href;
      card.classList.add('service-card-linked');
    }

    const heading = document.createElement('div');
    heading.className = 'card-heading';

    const h3 = document.createElement('h3');
    const status = document.createElement('span');
    status.className = `service-status service-status-${service.status || 'unknown'}`;
    status.title = service.status || 'unknown';
    h3.textContent = service.name;
    heading.append(h3, status);

    const message = document.createElement('p');
    message.className = service.error ? 'message error' : 'message';
    message.textContent = service.href
      ? `${service.descriptions.join(' ')} Details available.`
      : service.descriptions.join(' ');

    const meta = document.createElement('p');
    meta.className = 'service-meta';
    meta.textContent = service.error ? 'Resource count unavailable' : `${service.count} tracked resource${service.count === 1 ? '' : 's'}`;

    if (service.href) {
      const open = document.createElement('span');
      open.className = 'service-open';
      open.textContent = 'Open details';
      card.append(heading, message, meta, open);
      serviceGrid.append(card);
      return;
    }

    card.append(heading, message, meta);
    serviceGrid.append(card);
  });

  loadedAt.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
}

async function loadIdentity() {
  const response = await fetch('/api/identity/');
  const data = await response.json();

  endpoint.textContent = data.endpoint_url || 'Unknown';
  profile.textContent = data.profile || 'Environment credentials';

  if (!response.ok || data.error) {
    identity.textContent = data.error || 'Unable to resolve identity';
    return;
  }

  identity.textContent = data.identity?.arn || data.identity?.user_id || 'Unknown';
}

async function loadHealth() {
  const response = await fetch('/api/health/');
  const data = await response.json();

  if (!response.ok || !data.ok) {
    health.textContent = data.error || 'Unavailable';
    return false;
  }

  const edition = data.data?.edition;
  const version = data.data?.version;
  latestHealthData = data.data || null;
  health.textContent = [edition, version].filter(Boolean).join(' / ') || 'Healthy';
  return true;
}

async function loadHome(loadingStartedAt) {
  const resourcesPromise = fetch('/api/resources/');

  await waitForMinimumLoadingTime(loadingStartedAt);
  renderServices([], latestHealthData?.services || {});
  loadedAt.textContent = 'Loading resource counts...';

  const response = await resourcesPromise;
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || 'Unable to load service resources');
  }

  renderServices(data.resources || [], latestHealthData?.services || {});
}

async function loadIamPage() {
  const iamResponse = await fetch('/api/iam/');
  const iamData = await iamResponse.json();

  if (!iamResponse.ok || iamData.error) {
    throw new Error(iamData.error || 'Unable to load IAM inventory');
  }

  renderIam(iamData);
}

async function loadS3Page() {
  const s3Response = await fetch('/api/s3/');
  const s3Data = await s3Response.json();

  if (!s3Response.ok || s3Data.error) {
    throw new Error(s3Data.error || 'Unable to load S3 inventory');
  }

  renderS3(s3Data);
}

async function loadEC2Page() {
  const ec2Response = await fetch('/api/ec2/');
  const ec2Data = await ec2Response.json();

  if (!ec2Response.ok || ec2Data.error) {
    throw new Error(ec2Data.error || 'Unable to load EC2 inventory');
  }

  renderEC2(ec2Data);
}

async function loadKMSPage() {
  const kmsResponse = await fetch('/api/kms/');
  const kmsData = await kmsResponse.json();

  if (!kmsResponse.ok || kmsData.error) {
    throw new Error(kmsData.error || 'Unable to load KMS inventory');
  }

  renderKMS(kmsData);
}

async function loadLambdaPage() {
  const lambdaResponse = await fetch('/api/lambda/');
  const lambdaData = await lambdaResponse.json();

  if (!lambdaResponse.ok || lambdaData.error) {
    throw new Error(lambdaData.error || 'Unable to load Lambda inventory');
  }

  renderLambda(lambdaData);
}

async function loadSQSPage() {
  const sqsResponse = await fetch('/api/sqs/');
  const sqsData = await sqsResponse.json();

  if (!sqsResponse.ok || sqsData.error) {
    throw new Error(sqsData.error || 'Unable to load SQS inventory');
  }

  renderSQS(sqsData);
}

async function loadSecretsManagerPage() {
  const secretsmanagerResponse = await fetch('/api/secretsmanager/');
  const secretsmanagerData = await secretsmanagerResponse.json();

  if (!secretsmanagerResponse.ok || secretsmanagerData.error) {
    throw new Error(secretsmanagerData.error || 'Unable to load Secrets Manager inventory');
  }

  renderSecretsManager(secretsmanagerData);
}

async function loadDynamoDBPage() {
  const dynamodbResponse = await fetch('/api/dynamodb/');
  const dynamodbData = await dynamodbResponse.json();

  if (!dynamodbResponse.ok || dynamodbData.error) {
    throw new Error(dynamodbData.error || 'Unable to load DynamoDB inventory');
  }

  renderDynamoDB(dynamodbData);
}

async function loadCloudWatchPage() {
  const cloudwatchResponse = await fetch('/api/cloudwatch/');
  const cloudwatchData = await cloudwatchResponse.json();

  if (!cloudwatchResponse.ok || cloudwatchData.error) {
    throw new Error(cloudwatchData.error || 'Unable to load CloudWatch inventory');
  }

  renderCloudWatch(cloudwatchData);
}

async function loadCodeBuildPage() {
  const codebuildResponse = await fetch('/api/codebuild/');
  const codebuildData = await codebuildResponse.json();

  if (!codebuildResponse.ok || codebuildData.error) {
    throw new Error(codebuildData.error || 'Unable to load CodeBuild inventory');
  }

  renderCodeBuild(codebuildData);
}

async function loadCodeDeployPage() {
  const codedeployResponse = await fetch('/api/codedeploy/');
  const codedeployData = await codedeployResponse.json();

  if (!codedeployResponse.ok || codedeployData.error) {
    throw new Error(codedeployData.error || 'Unable to load CodeDeploy inventory');
  }

  renderCodeDeploy(codedeployData);
}

async function loadEventBridgePage() {
  const eventbridgeResponse = await fetch('/api/eventbridge/');
  const eventbridgeData = await eventbridgeResponse.json();

  if (!eventbridgeResponse.ok || eventbridgeData.error) {
    throw new Error(eventbridgeData.error || 'Unable to load EventBridge inventory');
  }

  renderEventBridge(eventbridgeData);
}

async function loadCognitoPage() {
  const cognitoResponse = await fetch('/api/cognito/');
  const cognitoData = await cognitoResponse.json();

  if (!cognitoResponse.ok || cognitoData.error) {
    throw new Error(cognitoData.error || 'Unable to load Cognito inventory');
  }

  renderCognito(cognitoData);
}

async function loadApiGatewayPage() {
  const apigatewayResponse = await fetch('/api/apigateway/');
  const apigatewayData = await apigatewayResponse.json();

  if (!apigatewayResponse.ok || apigatewayData.error) {
    throw new Error(apigatewayData.error || 'Unable to load API Gateway inventory');
  }

  renderApiGateway(apigatewayData);
}

async function loadAppConfigPage() {
  const appconfigResponse = await fetch('/api/appconfig/');
  const appconfigData = await appconfigResponse.json();

  if (!appconfigResponse.ok || appconfigData.error) {
    throw new Error(appconfigData.error || 'Unable to load AppConfig inventory');
  }

  renderAppConfig(appconfigData);
}

async function loadECSPage() {
  const ecsResponse = await fetch('/api/ecs/');
  const ecsData = await ecsResponse.json();

  if (!ecsResponse.ok || ecsData.error) {
    throw new Error(ecsData.error || 'Unable to load ECS inventory');
  }

  renderECS(ecsData);
}

async function loadEKSPage() {
  const eksResponse = await fetch('/api/eks/');
  const eksData = await eksResponse.json();

  if (!eksResponse.ok || eksData.error) {
    throw new Error(eksData.error || 'Unable to load EKS inventory');
  }

  renderEKS(eksData);
}

async function loadElastiCachePage() {
  const elasticacheResponse = await fetch('/api/elasticache/');
  const elasticacheData = await elasticacheResponse.json();

  if (!elasticacheResponse.ok || elasticacheData.error) {
    throw new Error(elasticacheData.error || 'Unable to load ElastiCache inventory');
  }

  renderElastiCache(elasticacheData);
}

async function loadElasticLoadBalancingPage() {
  const elasticloadbalancingResponse = await fetch('/api/elasticloadbalancing/');
  const elasticloadbalancingData = await elasticloadbalancingResponse.json();

  if (!elasticloadbalancingResponse.ok || elasticloadbalancingData.error) {
    throw new Error(elasticloadbalancingData.error || 'Unable to load Elastic Load Balancing inventory');
  }

  renderElasticLoadBalancing(elasticloadbalancingData);
}

async function loadFirehosePage() {
  const firehoseResponse = await fetch('/api/firehose/');
  const firehoseData = await firehoseResponse.json();

  if (!firehoseResponse.ok || firehoseData.error) {
    throw new Error(firehoseData.error || 'Unable to load Data Firehose inventory');
  }

  renderFirehose(firehoseData);
}

async function loadKinesisPage() {
  const kinesisResponse = await fetch('/api/kinesis/');
  const kinesisData = await kinesisResponse.json();

  if (!kinesisResponse.ok || kinesisData.error) {
    throw new Error(kinesisData.error || 'Unable to load Kinesis inventory');
  }

  renderKinesis(kinesisData);
}

async function loadKafkaPage() {
  const kafkaResponse = await fetch('/api/kafka/');
  const kafkaData = await kafkaResponse.json();

  if (!kafkaResponse.ok || kafkaData.error) {
    throw new Error(kafkaData.error || 'Unable to load MSK / Kafka inventory');
  }

  renderKafka(kafkaData);
}

async function loadOpenSearchPage() {
  const opensearchResponse = await fetch('/api/opensearch/');
  const opensearchData = await opensearchResponse.json();

  if (!opensearchResponse.ok || opensearchData.error) {
    throw new Error(opensearchData.error || 'Unable to load OpenSearch inventory');
  }

  renderOpenSearch(opensearchData);
}

async function loadPipesPage() {
  const pipesResponse = await fetch('/api/pipes/');
  const pipesData = await pipesResponse.json();

  if (!pipesResponse.ok || pipesData.error) {
    throw new Error(pipesData.error || 'Unable to load EventBridge Pipes inventory');
  }

  renderPipes(pipesData);
}

async function loadResourceGroupsTaggingPage() {
  const resourcegroupstaggingResponse = await fetch('/api/resourcegroupstagging/');
  const resourcegroupstaggingData = await resourcegroupstaggingResponse.json();

  if (!resourcegroupstaggingResponse.ok || resourcegroupstaggingData.error) {
    throw new Error(resourcegroupstaggingData.error || 'Unable to load Resource Groups Tagging inventory');
  }

  renderResourceGroupsTagging(resourcegroupstaggingData);
}

async function loadSsmPage() {
  const ssmResponse = await fetch('/api/ssm/');
  const ssmData = await ssmResponse.json();

  if (!ssmResponse.ok || ssmData.error) {
    throw new Error(ssmData.error || 'Unable to load SSM inventory');
  }

  renderSsm(ssmData);
}

async function loadAthenaPage() {
  const athenaResponse = await fetch('/api/athena/');
  const athenaData = await athenaResponse.json();

  if (!athenaResponse.ok || athenaData.error) {
    throw new Error(athenaData.error || 'Unable to load Athena inventory');
  }

  renderAthena(athenaData);
}

async function loadAutoScalingPage() {
  const autoscalingResponse = await fetch('/api/autoscaling/');
  const autoscalingData = await autoscalingResponse.json();

  if (!autoscalingResponse.ok || autoscalingData.error) {
    throw new Error(autoscalingData.error || 'Unable to load Auto Scaling inventory');
  }

  renderAutoScaling(autoscalingData);
}

async function loadBedrockRuntimePage() {
  const bedrockruntimeResponse = await fetch('/api/bedrockruntime/');
  const bedrockruntimeData = await bedrockruntimeResponse.json();

  if (!bedrockruntimeResponse.ok || bedrockruntimeData.error) {
    throw new Error(bedrockruntimeData.error || 'Unable to load Bedrock Runtime inventory');
  }

  renderBedrockRuntime(bedrockruntimeData);
}

async function loadSNSPage() {
  const snsResponse = await fetch('/api/sns/');
  const snsData = await snsResponse.json();

  if (!snsResponse.ok || snsData.error) {
    throw new Error(snsData.error || 'Unable to load SNS inventory');
  }

  renderSNS(snsData);
}

async function loadSESPage() {
  const sesResponse = await fetch('/api/ses/');
  const sesData = await sesResponse.json();

  if (!sesResponse.ok || sesData.error) {
    throw new Error(sesData.error || 'Unable to load SES inventory');
  }

  renderSES(sesData);
}

async function loadCloudFormationPage() {
  const cloudformationResponse = await fetch('/api/cloudformation/');
  const cloudformationData = await cloudformationResponse.json();

  if (!cloudformationResponse.ok || cloudformationData.error) {
    throw new Error(cloudformationData.error || 'Unable to load CloudFormation inventory');
  }

  renderCloudFormation(cloudformationData);
}

async function loadECRPage() {
  const ecrResponse = await fetch('/api/ecr/');
  const ecrData = await ecrResponse.json();

  if (!ecrResponse.ok || ecrData.error) {
    throw new Error(ecrData.error || 'Unable to load ECR inventory');
  }

  renderECR(ecrData);
}

async function loadRDSPage() {
  const rdsResponse = await fetch('/api/rds/');
  const rdsData = await rdsResponse.json();

  if (!rdsResponse.ok || rdsData.error) {
    throw new Error(rdsData.error || 'Unable to load RDS inventory');
  }

  renderRDS(rdsData);
}

async function loadBackupPage() {
  const backupResponse = await fetch('/api/backup/');
  const backupData = await backupResponse.json();

  if (!backupResponse.ok || backupData.error) {
    throw new Error(backupData.error || 'Unable to load Backup inventory');
  }

  renderBackup(backupData);
}

async function loadRoute53Page() {
  const route53Response = await fetch('/api/route53/');
  const route53Data = await route53Response.json();

  if (!route53Response.ok || route53Data.error) {
    throw new Error(route53Data.error || 'Unable to load Route 53 inventory');
  }

  renderRoute53(route53Data);
}

async function loadTransferPage() {
  const transferResponse = await fetch('/api/transfer/');
  const transferData = await transferResponse.json();

  if (!transferResponse.ok || transferData.error) {
    throw new Error(transferData.error || 'Unable to load Transfer Family inventory');
  }

  renderTransfer(transferData);
}

async function loadACMPage() {
  const acmResponse = await fetch('/api/acm/');
  const acmData = await acmResponse.json();

  if (!acmResponse.ok || acmData.error) {
    throw new Error(acmData.error || 'Unable to load ACM inventory');
  }

  renderACM(acmData);
}

async function loadStepFunctionsPage() {
  const stepfunctionsResponse = await fetch('/api/stepfunctions/');
  const stepfunctionsData = await stepfunctionsResponse.json();

  if (!stepfunctionsResponse.ok || stepfunctionsData.error) {
    throw new Error(stepfunctionsData.error || 'Unable to load Step Functions inventory');
  }

  renderStepFunctions(stepfunctionsData);
}

async function loadSchedulerPage() {
  const schedulerResponse = await fetch('/api/scheduler/');
  const schedulerData = await schedulerResponse.json();

  if (!schedulerResponse.ok || schedulerData.error) {
    throw new Error(schedulerData.error || 'Unable to load EventBridge Scheduler inventory');
  }

  renderScheduler(schedulerData);
}

async function loadGluePage() {
  const glueResponse = await fetch('/api/glue/');
  const glueData = await glueResponse.json();

  if (!glueResponse.ok || glueData.error) {
    throw new Error(glueData.error || 'Unable to load Glue inventory');
  }

  renderGlue(glueData);
}

async function refresh() {
  refreshButton.disabled = true;
  refreshButton.textContent = 'Refreshing';
  const loadingStartedAt = performance.now();
  showLoadingStates();

  try {
    await loadHealth();
    await loadIdentity();

    if (serviceGrid) {
      await loadHome(loadingStartedAt);
    }

    if (iamGrid) {
      await loadIamPage();
    }

    if (s3Grid) {
      await loadS3Page();
    }

    if (ec2Grid) {
      await loadEC2Page();
    }

    if (kmsGrid) {
      await loadKMSPage();
    }

    if (lambdaGrid) {
      await loadLambdaPage();
    }

    if (sqsGrid) {
      await loadSQSPage();
    }

    if (secretsmanagerGrid) {
      await loadSecretsManagerPage();
    }

    if (dynamodbGrid) {
      await loadDynamoDBPage();
    }

    if (cloudwatchGrid) {
      await loadCloudWatchPage();
    }

    if (codebuildGrid) {
      await loadCodeBuildPage();
    }

    if (codedeployGrid) {
      await loadCodeDeployPage();
    }

    if (eventbridgeGrid) {
      await loadEventBridgePage();
    }

    if (cognitoGrid) {
      await loadCognitoPage();
    }

    if (apigatewayGrid) {
      await loadApiGatewayPage();
    }

    if (appconfigGrid) {
      await loadAppConfigPage();
    }

    if (ecsGrid) {
      await loadECSPage();
    }

    if (eksGrid) {
      await loadEKSPage();
    }

    if (elasticacheGrid) {
      await loadElastiCachePage();
    }

    if (elasticloadbalancingGrid) {
      await loadElasticLoadBalancingPage();
    }

    if (firehoseGrid) {
      await loadFirehosePage();
    }

    if (kinesisGrid) {
      await loadKinesisPage();
    }

    if (kafkaGrid) {
      await loadKafkaPage();
    }

    if (opensearchGrid) {
      await loadOpenSearchPage();
    }

    if (pipesGrid) {
      await loadPipesPage();
    }

    if (resourcegroupstaggingGrid) {
      await loadResourceGroupsTaggingPage();
    }

    if (ssmGrid) {
      await loadSsmPage();
    }

    if (athenaGrid) {
      await loadAthenaPage();
    }

    if (autoscalingGrid) {
      await loadAutoScalingPage();
    }

    if (bedrockruntimeGrid) {
      await loadBedrockRuntimePage();
    }

    if (snsGrid) {
      await loadSNSPage();
    }

    if (sesGrid) {
      await loadSESPage();
    }

    if (cloudformationGrid) {
      await loadCloudFormationPage();
    }

    if (ecrGrid) {
      await loadECRPage();
    }

    if (rdsGrid) {
      await loadRDSPage();
    }

    if (backupGrid) {
      await loadBackupPage();
    }

    if (route53Grid) {
      await loadRoute53Page();
    }

    if (transferGrid) {
      await loadTransferPage();
    }

    if (acmGrid) {
      await loadACMPage();
    }

    if (stepfunctionsGrid) {
      await loadStepFunctionsPage();
    }

    if (schedulerGrid) {
      await loadSchedulerPage();
    }

    if (glueGrid) {
      await loadGluePage();
    }
  } catch (error) {
    if (serviceGrid) {
      renderServices([
        {
          label: 'Dashboard error',
          name: 'dashboard-error',
          count: null,
          items: [],
          error: error.message,
        },
      ], latestHealthData?.services || {});
    }

    if (iamGrid) {
      iamGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      iamGrid.append(panel);
    }

    if (s3Grid) {
      s3Grid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      s3Grid.append(panel);
    }

    if (ec2Grid) {
      ec2Grid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      ec2Grid.append(panel);
    }

    if (kmsGrid) {
      kmsGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      kmsGrid.append(panel);
    }

    if (lambdaGrid) {
      lambdaGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      lambdaGrid.append(panel);
    }

    if (sqsGrid) {
      sqsGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      sqsGrid.append(panel);
    }

    if (secretsmanagerGrid) {
      secretsmanagerGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      secretsmanagerGrid.append(panel);
    }

    if (dynamodbGrid) {
      dynamodbGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      dynamodbGrid.append(panel);
    }

    if (cloudwatchGrid) {
      cloudwatchGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      cloudwatchGrid.append(panel);
    }

    if (codebuildGrid) {
      codebuildGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      codebuildGrid.append(panel);
    }

    if (codedeployGrid) {
      codedeployGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      codedeployGrid.append(panel);
    }

    if (eventbridgeGrid) {
      eventbridgeGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      eventbridgeGrid.append(panel);
    }

    if (cognitoGrid) {
      cognitoGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      cognitoGrid.append(panel);
    }

    if (apigatewayGrid) {
      apigatewayGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      apigatewayGrid.append(panel);
    }

    if (appconfigGrid) {
      appconfigGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      appconfigGrid.append(panel);
    }

    if (ecsGrid) {
      ecsGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      ecsGrid.append(panel);
    }

    if (eksGrid) {
      eksGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      eksGrid.append(panel);
    }

    if (elasticacheGrid) {
      elasticacheGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      elasticacheGrid.append(panel);
    }

    if (elasticloadbalancingGrid) {
      elasticloadbalancingGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      elasticloadbalancingGrid.append(panel);
    }

    if (firehoseGrid) {
      firehoseGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      firehoseGrid.append(panel);
    }

    if (kinesisGrid) {
      kinesisGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      kinesisGrid.append(panel);
    }

    if (kafkaGrid) {
      kafkaGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      kafkaGrid.append(panel);
    }

    if (opensearchGrid) {
      opensearchGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      opensearchGrid.append(panel);
    }

    if (pipesGrid) {
      pipesGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      pipesGrid.append(panel);
    }

    if (resourcegroupstaggingGrid) {
      resourcegroupstaggingGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      resourcegroupstaggingGrid.append(panel);
    }

    if (ssmGrid) {
      ssmGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      ssmGrid.append(panel);
    }

    if (athenaGrid) {
      athenaGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      athenaGrid.append(panel);
    }

    if (autoscalingGrid) {
      autoscalingGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      autoscalingGrid.append(panel);
    }

    if (bedrockruntimeGrid) {
      bedrockruntimeGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      bedrockruntimeGrid.append(panel);
    }

    if (snsGrid) {
      snsGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      snsGrid.append(panel);
    }

    if (sesGrid) {
      sesGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      sesGrid.append(panel);
    }

    if (cloudformationGrid) {
      cloudformationGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      cloudformationGrid.append(panel);
    }

    if (ecrGrid) {
      ecrGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      ecrGrid.append(panel);
    }

    if (rdsGrid) {
      rdsGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      rdsGrid.append(panel);
    }

    if (backupGrid) {
      backupGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      backupGrid.append(panel);
    }

    if (route53Grid) {
      route53Grid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      route53Grid.append(panel);
    }

    if (transferGrid) {
      transferGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      transferGrid.append(panel);
    }

    if (acmGrid) {
      acmGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      acmGrid.append(panel);
    }

    if (stepfunctionsGrid) {
      stepfunctionsGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      stepfunctionsGrid.append(panel);
    }

    if (schedulerGrid) {
      schedulerGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      schedulerGrid.append(panel);
    }

    if (glueGrid) {
      glueGrid.textContent = '';
      const panel = document.createElement('section');
      panel.className = 'iam-panel';
      const message = document.createElement('p');
      message.className = 'message error';
      message.textContent = error.message;
      panel.append(message);
      glueGrid.append(panel);
    }
  } finally {
    clearLoadingStates();
    refreshButton.disabled = false;
    refreshButton.textContent = 'Refresh';
  }
}

refreshButton.addEventListener('click', refresh);
refresh();
