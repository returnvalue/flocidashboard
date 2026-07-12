const AwsCliConsole = (() => {
  const HISTORY_KEY = 'floci-dashboard:aws-cli-console:v1';
  const HISTORY_LIMIT = 20;
  const COMMANDS = [
    { category: 'Identity', label: 'caller identity', command: 'aws sts get-caller-identity' },
    { category: 'Identity', label: 'list users', command: 'aws iam list-users' },
    { category: 'Identity', label: 'list roles', command: 'aws iam list-roles' },
    { category: 'Identity', label: 'list groups', command: 'aws iam list-groups' },
    { category: 'Identity', label: 'local policies', command: 'aws iam list-policies --scope Local' },
    { category: 'Identity', label: 'account summary', command: 'aws iam get-account-summary' },
    { category: 'Identity', label: 'access keys', command: 'aws iam list-access-keys --user-name <user-name>' },
    { category: 'Identity', label: 'attached user policies', command: 'aws iam list-attached-user-policies --user-name <user-name>' },
    { category: 'Identity', label: 'role policies', command: 'aws iam list-role-policies --role-name <role-name>' },
    { category: 'Identity', label: 'instance profiles', command: 'aws iam list-instance-profiles' },
    { category: 'Storage', label: 's3 ls', command: 'aws s3 ls' },
    { category: 'Storage', label: 'list buckets', command: 'aws s3api list-buckets' },
    { category: 'Storage', label: 'list objects', command: 'aws s3api list-objects-v2 --bucket <bucket>' },
    { category: 'Storage', label: 'bucket location', command: 'aws s3api get-bucket-location --bucket <bucket>' },
    { category: 'Storage', label: 'bucket versioning', command: 'aws s3api get-bucket-versioning --bucket <bucket>' },
    { category: 'Storage', label: 'bucket encryption', command: 'aws s3api get-bucket-encryption --bucket <bucket>' },
    { category: 'Storage', label: 'bucket policy status', command: 'aws s3api get-bucket-policy-status --bucket <bucket>' },
    { category: 'Storage', label: 'public access block', command: 'aws s3api get-public-access-block --bucket <bucket>' },
    { category: 'Storage', label: 'object metadata', command: 'aws s3api head-object --bucket <bucket> --key <key>' },
    { category: 'Storage', label: 'bucket notification', command: 'aws s3api get-bucket-notification-configuration --bucket <bucket>' },
    { category: 'Queues', label: 'list queues', command: 'aws sqs list-queues' },
    { category: 'Queues', label: 'queue attributes', command: 'aws sqs get-queue-attributes --queue-url <queue-url> --attribute-names All' },
    { category: 'Queues', label: 'queue tags', command: 'aws sqs list-queue-tags --queue-url <queue-url>' },
    { category: 'Queues', label: 'receive message', command: 'aws sqs receive-message --queue-url <queue-url> --max-number-of-messages 1 --attribute-names All --message-attribute-names All' },
    { category: 'Queues', label: 'send message', command: 'aws sqs send-message --queue-url <queue-url> --message-body hello' },
    { category: 'Queues', label: 'list topics', command: 'aws sns list-topics' },
    { category: 'Queues', label: 'list subscriptions', command: 'aws sns list-subscriptions' },
    { category: 'Queues', label: 'topic attributes', command: 'aws sns get-topic-attributes --topic-arn <topic-arn>' },
    { category: 'Queues', label: 'list schedules', command: 'aws scheduler list-schedules' },
    { category: 'Queues', label: 'schedule groups', command: 'aws scheduler list-schedule-groups' },
    { category: 'Compute', label: 'list functions', command: 'aws lambda list-functions' },
    { category: 'Compute', label: 'function config', command: 'aws lambda get-function-configuration --function-name <function-name>' },
    { category: 'Compute', label: 'invoke function', command: 'aws lambda invoke --function-name <function-name> /tmp/floci-lambda-output.json' },
    { category: 'Compute', label: 'event source mappings', command: 'aws lambda list-event-source-mappings' },
    { category: 'Compute', label: 'list layers', command: 'aws lambda list-layers' },
    { category: 'Compute', label: 'describe instances', command: 'aws ec2 describe-instances' },
    { category: 'Compute', label: 'describe images', command: 'aws ec2 describe-images' },
    { category: 'Compute', label: 'ecs clusters', command: 'aws ecs list-clusters' },
    { category: 'Compute', label: 'ecs services', command: 'aws ecs list-services --cluster <cluster-arn>' },
    { category: 'Compute', label: 'eks clusters', command: 'aws eks list-clusters' },
    { category: 'Database', label: 'dynamodb tables', command: 'aws dynamodb list-tables' },
    { category: 'Database', label: 'describe table', command: 'aws dynamodb describe-table --table-name <table-name>' },
    { category: 'Database', label: 'scan table', command: 'aws dynamodb scan --table-name <table-name> --limit 10' },
    { category: 'Database', label: 'query table', command: 'aws dynamodb query --table-name <table-name> --key-condition-expression "<pk> = :value" --expression-attribute-values "{\\\":value\\\":{\\\"S\\\":\\\"demo\\\"}}"' },
    { category: 'Database', label: 'rds instances', command: 'aws rds describe-db-instances' },
    { category: 'Database', label: 'rds clusters', command: 'aws rds describe-db-clusters' },
    { category: 'Database', label: 'docdb clusters', command: 'aws docdb describe-db-clusters' },
    { category: 'Database', label: 'elasticache clusters', command: 'aws elasticache describe-cache-clusters' },
    { category: 'Database', label: 'memorydb clusters', command: 'aws memorydb describe-clusters' },
    { category: 'Database', label: 'neptune clusters', command: 'aws neptune describe-db-clusters' },
    { category: 'Events', label: 'event buses', command: 'aws events list-event-buses' },
    { category: 'Events', label: 'rules', command: 'aws events list-rules' },
    { category: 'Events', label: 'targets', command: 'aws events list-targets-by-rule --rule <rule-name>' },
    { category: 'Events', label: 'put event', command: 'aws events put-events --entries "[{\\\"Source\\\":\\\"local.demo\\\",\\\"DetailType\\\":\\\"Demo\\\",\\\"Detail\\\":\\\"{}\\\"}]"' },
    { category: 'Events', label: 'pipes', command: 'aws pipes list-pipes' },
    { category: 'Events', label: 'describe pipe', command: 'aws pipes describe-pipe --name <pipe-name>' },
    { category: 'Events', label: 'firehose streams', command: 'aws firehose list-delivery-streams' },
    { category: 'Events', label: 'kinesis streams', command: 'aws kinesis list-streams' },
    { category: 'Events', label: 'stream shards', command: 'aws kinesis list-shards --stream-name <stream-name>' },
    { category: 'Events', label: 'put record', command: 'aws kinesis put-record --stream-name <stream-name> --partition-key demo --data hello' },
    { category: 'Networking', label: 'vpcs', command: 'aws ec2 describe-vpcs' },
    { category: 'Networking', label: 'subnets', command: 'aws ec2 describe-subnets' },
    { category: 'Networking', label: 'security groups', command: 'aws ec2 describe-security-groups' },
    { category: 'Networking', label: 'route tables', command: 'aws ec2 describe-route-tables' },
    { category: 'Networking', label: 'internet gateways', command: 'aws ec2 describe-internet-gateways' },
    { category: 'Networking', label: 'vpc endpoints', command: 'aws ec2 describe-vpc-endpoints' },
    { category: 'Networking', label: 'load balancers', command: 'aws elbv2 describe-load-balancers' },
    { category: 'Networking', label: 'target groups', command: 'aws elbv2 describe-target-groups' },
    { category: 'Networking', label: 'hosted zones', command: 'aws route53 list-hosted-zones' },
    { category: 'Networking', label: 'cloud map namespaces', command: 'aws servicediscovery list-namespaces' },
    { category: 'Deploy', label: 'stacks', command: 'aws cloudformation list-stacks' },
    { category: 'Deploy', label: 'stack resources', command: 'aws cloudformation list-stack-resources --stack-name <stack-name>' },
    { category: 'Deploy', label: 'stack events', command: 'aws cloudformation describe-stack-events --stack-name <stack-name>' },
    { category: 'Deploy', label: 'change sets', command: 'aws cloudformation list-change-sets --stack-name <stack-name>' },
    { category: 'Deploy', label: 'codebuild projects', command: 'aws codebuild list-projects' },
    { category: 'Deploy', label: 'codebuild builds', command: 'aws codebuild list-builds' },
    { category: 'Deploy', label: 'codedeploy apps', command: 'aws deploy list-applications' },
    { category: 'Deploy', label: 'codepipeline pipelines', command: 'aws codepipeline list-pipelines' },
    { category: 'Deploy', label: 'appconfig apps', command: 'aws appconfig list-applications' },
    { category: 'Deploy', label: 'elastic beanstalk apps', command: 'aws elasticbeanstalk describe-applications' },
    { category: 'Observability', label: 'log groups', command: 'aws logs describe-log-groups' },
    { category: 'Observability', label: 'log streams', command: 'aws logs describe-log-streams --log-group-name <log-group-name> --order-by LastEventTime --descending' },
    { category: 'Observability', label: 'log events', command: 'aws logs get-log-events --log-group-name <log-group-name> --log-stream-name <stream-name>' },
    { category: 'Observability', label: 'metric alarms', command: 'aws cloudwatch describe-alarms' },
    { category: 'Observability', label: 'cloudtrail trails', command: 'aws cloudtrail describe-trails' },
    { category: 'Observability', label: 'cloudtrail events', command: 'aws cloudtrail lookup-events --max-results 10' },
    { category: 'Observability', label: 'config rules', command: 'aws configservice describe-config-rules' },
    { category: 'Observability', label: 'config recorders', command: 'aws configservice describe-configuration-recorders' },
    { category: 'Observability', label: 'xray groups', command: 'aws xray get-groups' },
    { category: 'Observability', label: 'resource groups', command: 'aws resource-groups list-groups' },
    { category: 'Security', label: 'kms keys', command: 'aws kms list-keys' },
    { category: 'Security', label: 'kms aliases', command: 'aws kms list-aliases' },
    { category: 'Security', label: 'key metadata', command: 'aws kms describe-key --key-id <key-id>' },
    { category: 'Security', label: 'secrets', command: 'aws secretsmanager list-secrets' },
    { category: 'Security', label: 'secret metadata', command: 'aws secretsmanager describe-secret --secret-id <secret-id>' },
    { category: 'Security', label: 'secret value', command: 'aws secretsmanager get-secret-value --secret-id <secret-id>' },
    { category: 'Security', label: 'parameters', command: 'aws ssm describe-parameters' },
    { category: 'Security', label: 'get parameter', command: 'aws ssm get-parameter --name <parameter-name> --with-decryption' },
    { category: 'Security', label: 'certificates', command: 'aws acm list-certificates' },
    { category: 'Security', label: 'certificate detail', command: 'aws acm describe-certificate --certificate-arn <certificate-arn>' },
    { category: 'App', label: 'api gateway rest apis', command: 'aws apigateway get-rest-apis' },
    { category: 'App', label: 'api gateway http apis', command: 'aws apigatewayv2 get-apis' },
    { category: 'App', label: 'http api routes', command: 'aws apigatewayv2 get-routes --api-id <api-id>' },
    { category: 'App', label: 'http api integrations', command: 'aws apigatewayv2 get-integrations --api-id <api-id>' },
    { category: 'App', label: 'appsync apis', command: 'aws appsync list-graphql-apis' },
    { category: 'App', label: 'cognito pools', command: 'aws cognito-idp list-user-pools --max-results 20' },
    { category: 'App', label: 'ses identities', command: 'aws ses list-identities' },
    { category: 'App', label: 'ses templates', command: 'aws ses list-templates' },
    { category: 'App', label: 'cloudfront distributions', command: 'aws cloudfront list-distributions' },
    { category: 'App', label: 'transfer servers', command: 'aws transfer list-servers' },
  ];

  const form = document.querySelector('#aws-console-form');
  const input = document.querySelector('#aws-console-command');
  const runButton = document.querySelector('#aws-console-run');
  const state = document.querySelector('#aws-console-state');
  const output = document.querySelector('#aws-console-output');
  const history = document.querySelector('#aws-console-history');
  const clear = document.querySelector('#aws-console-clear');
  const categories = document.querySelector('#aws-console-categories');
  const commandStrip = document.querySelector('#aws-console-command-strip');
  const debug = (...args) => console.debug('[AWS CLI Console]', ...args);

  let selectedCategory = 'All';

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text != null) {
      node.textContent = text;
    }
    return node;
  }

  function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || '';
  }

  function loadHistory() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch (_error) {
      return [];
    }
  }

  function saveHistory(commands) {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(commands.slice(0, HISTORY_LIMIT)));
    } catch (_error) {
      // Command history is a convenience layer.
    }
  }

  function remember(command) {
    const commands = loadHistory().filter((item) => item !== command);
    saveHistory([command, ...commands]);
    renderHistory();
  }

  function setCommand(command) {
    if (!input) {
      debug('setCommand skipped: input not found', { command });
      return;
    }
    debug('setCommand writing input', { command, previousValue: input.value });
    input.value = command;
    input.focus();
    input.setSelectionRange?.(command.length, command.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    debug('setCommand complete', { value: input.value, activeElementId: document.activeElement?.id });
  }

  function categoryNames() {
    return ['All', ...Array.from(new Set(COMMANDS.map((item) => item.category)))];
  }

  function renderCategories() {
    if (!categories) {
      return;
    }
    categories.textContent = '';
    categoryNames().forEach((category) => {
      const button = el('button', 'aws-console-category', category);
      button.type = 'button';
      button.setAttribute('aria-pressed', category === selectedCategory ? 'true' : 'false');
      button.addEventListener('click', () => {
        selectedCategory = category;
        renderCategories();
        renderCommandStrip();
      });
      categories.append(button);
    });
  }

  function renderCommandStrip() {
    if (!commandStrip) {
      return;
    }
    const commands = selectedCategory === 'All'
      ? COMMANDS
      : COMMANDS.filter((item) => item.category === selectedCategory);
    commandStrip.textContent = '';
    commands.forEach((item) => {
      const button = el('button', 'aws-console-command-chip');
      button.type = 'button';
      button.title = item.command;
      button.dataset.command = item.command;
      button.append(
        el('span', 'aws-console-command-chip-label', item.label),
        el('span', 'aws-console-command-chip-command', item.command),
      );
      commandStrip.append(button);
    });
  }

  function enableCommandSelection() {
    if (!commandStrip) {
      return;
    }
    commandStrip.addEventListener('click', (event) => {
      const button = event.target.closest('.aws-console-command-chip');
      debug('command strip click', {
        targetTag: event.target?.tagName,
        targetClass: event.target?.className,
        foundChip: Boolean(button),
        command: button?.dataset?.command,
      });
      if (!button || !commandStrip.contains(button)) {
        debug('command strip click ignored: no command chip found');
        return;
      }
      setCommand(button.dataset.command || '');
    });
  }

  function enableStripDrag() {
    if (!commandStrip) {
      return;
    }
    let dragging = false;
    let didDrag = false;
    let startX = 0;
    let startScroll = 0;
    let pointerId = null;
    let pointerDownChip = null;

    commandStrip.addEventListener('pointerdown', (event) => {
      dragging = true;
      didDrag = false;
      pointerId = event.pointerId;
      pointerDownChip = event.target.closest('.aws-console-command-chip');
      startX = event.clientX;
      startScroll = commandStrip.scrollLeft;
      commandStrip.classList.add('aws-console-command-strip-dragging');
      commandStrip.setPointerCapture?.(event.pointerId);
    });
    commandStrip.addEventListener('pointermove', (event) => {
      if (!dragging) {
        return;
      }
      const delta = event.clientX - startX;
      if (Math.abs(delta) > 12) {
        didDrag = true;
      }
      if (didDrag) {
        commandStrip.scrollLeft = startScroll - delta;
        debug('command strip drag scroll', { delta, scrollLeft: commandStrip.scrollLeft });
        event.preventDefault();
      }
    });
    const endDrag = (event) => {
      if (!dragging) {
        return;
      }
      dragging = false;
      if (!didDrag && event.type === 'pointerup' && pointerDownChip?.dataset?.command) {
        debug('command strip pointerup selection', {
          command: pointerDownChip.dataset.command,
          clickTargetTag: event.target?.tagName,
          clickTargetClass: event.target?.className,
        });
        setCommand(pointerDownChip.dataset.command);
      }
      pointerDownChip = null;
      commandStrip.classList.remove('aws-console-command-strip-dragging');
      if (pointerId != null) {
        commandStrip.releasePointerCapture?.(pointerId);
      }
    };
    commandStrip.addEventListener('pointerup', endDrag);
    commandStrip.addEventListener('pointercancel', endDrag);
    commandStrip.addEventListener('pointerleave', endDrag);
  }

  function renderHistory() {
    if (!history) {
      return;
    }
    const commands = loadHistory();
    history.textContent = '';
    if (!commands.length) {
      history.append(el('div', 'activity-empty', 'No recent commands yet.'));
      return;
    }
    commands.forEach((command) => {
      const row = el('button', 'aws-console-history-item');
      row.type = 'button';
      row.textContent = command;
      row.addEventListener('click', () => {
        setCommand(command);
      });
      history.append(row);
    });
  }

  function openConfirm(message) {
    return new Promise((resolve) => {
      const previousFocus = document.activeElement;
      const overlay = el('div', 'aws-console-modal-overlay');
      const modal = el('div', 'aws-console-modal');
      const title = el('h3', null, 'Run destructive AWS command?');
      const copy = el('p', 'aws-console-modal-copy', message);
      const actions = el('div', 'aws-console-modal-actions');
      const cancel = el('button', 'secondary-button', 'Cancel');
      const confirm = el('button', 'secondary-button destructive-action', 'Run command');
      const titleId = 'aws-console-confirm-title';

      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', titleId);
      title.id = titleId;
      cancel.type = 'button';
      confirm.type = 'button';

      const close = (confirmed) => {
        document.removeEventListener('keydown', onKeydown);
        overlay.remove();
        if (previousFocus && typeof previousFocus.focus === 'function') {
          previousFocus.focus();
        }
        resolve(confirmed);
      };
      function onKeydown(event) {
        if (event.key === 'Escape') {
          close(false);
        }
      }

      cancel.addEventListener('click', () => close(false));
      confirm.addEventListener('click', () => close(true));
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          close(false);
        }
      });
      document.addEventListener('keydown', onKeydown);

      actions.append(cancel, confirm);
      modal.append(title, copy, actions);
      overlay.append(modal);
      document.body.append(overlay);
      confirm.focus();
    });
  }

  function metadataLine(data) {
    return [
      `Exit ${data.exit_code}`,
      `${data.duration_ms} ms`,
      data.endpoint_url,
      data.region,
      data.profile ? `profile ${data.profile}` : data.credential_source,
    ].filter(Boolean).join(' / ');
  }

  function renderPre(title, text, className = '') {
    const block = el('div', `aws-console-block ${className}`.trim());
    block.append(el('h3', null, title));
    block.append(el('pre', 'aws-console-pre', text || ''));
    return block;
  }

  function renderRawOutput(text) {
    const disclosure = el('details', 'aws-console-raw-output');
    disclosure.append(
      el('summary', null, 'View raw output'),
      el('pre', 'aws-console-pre', text || ''),
    );
    return disclosure;
  }

  function renderResult(data) {
    output.textContent = '';
    const card = el('article', `aws-console-result ${data.ok ? 'aws-console-result-ok' : 'aws-console-result-error'}`);
    const heading = el('div', 'aws-console-result-heading');
    heading.append(
      el('strong', null, data.command),
      el('span', 'activity-item-meta', metadataLine(data)),
    );
    card.append(heading);
    if (data.json != null) {
      card.append(
        renderPre('Output', JSON.stringify(data.json, null, 2)),
        renderRawOutput(data.stdout || ''),
      );
    } else {
      card.append(renderPre('Output', data.stdout || ''));
    }
    if (data.stderr) {
      card.append(renderPre('stderr', data.stderr, 'aws-console-stderr'));
    }
    output.append(card);
  }

  function renderError(message) {
    output.textContent = '';
    const card = el('article', 'aws-console-result aws-console-result-error');
    card.append(el('strong', null, 'Command failed'), el('p', 'activity-summary', message));
    output.append(card);
  }

  async function postCommand(command, confirmed = false) {
    const response = await fetch('/api/console/run/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken(),
      },
      body: JSON.stringify({ command, confirmed }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 409 && data.requires_confirmation) {
      const ok = await openConfirm(data.message || 'This command may remove or stop local resources.');
      if (!ok) {
        state.textContent = 'Ready';
        return null;
      }
      return postCommand(command, true);
    }
    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
  }

  async function run(command) {
    const value = String(command || '').trim();
    if (!value) {
      input.focus();
      return;
    }
    runButton.disabled = true;
    state.textContent = 'Running...';
    try {
      const result = await postCommand(value);
      if (result) {
        renderResult(result);
        remember(value);
        state.textContent = result.ok ? 'Completed' : 'Exited with error';
      }
    } catch (error) {
      renderError(error.message);
      state.textContent = 'Failed';
    } finally {
      runButton.disabled = false;
    }
  }

  function init() {
    if (!form || !input) {
      return;
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      run(input.value);
    });
    clear?.addEventListener('click', () => {
      saveHistory([]);
      renderHistory();
    });
    renderCategories();
    renderCommandStrip();
    enableCommandSelection();
    enableStripDrag();
    renderHistory();
  }

  return { init, run };
})();

window.AwsCliConsole = AwsCliConsole;
AwsCliConsole.init();
