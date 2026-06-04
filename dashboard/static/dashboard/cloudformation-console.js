/* global ServiceConsole */

const CloudFormationConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('cloudformation-console-root');
  const breadcrumbsEl = document.getElementById('cloudformation-breadcrumbs');
  const summaryEl = document.getElementById('cloudformation-summary');
  const loadedAtEl = document.getElementById('cloudformation-loaded-at');

  const state = {
    inventory: null,
    selectedStackName: '',
    selectedChangeSetName: '',
    describedChangeSet: null,
  };

  const sampleTemplate = `Resources:
  DashboardQueue:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: dashboard-demo-queue
`;
  const ecsAlbTemplate = `Parameters:
  VpcId:
    Type: String
  SubnetId:
    Type: String
Resources:
  DashboardCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: dashboard-cfn-cluster
  DashboardTaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: dashboard-cfn-task
      NetworkMode: awsvpc
      Cpu: "256"
      Memory: "512"
      RequiresCompatibilities:
        - FARGATE
      ContainerDefinitions:
        - Name: web
          Image: nginx:alpine
          Essential: true
          PortMappings:
            - ContainerPort: 80
  DashboardTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: dashboard-cfn-targets
      Port: 80
      Protocol: HTTP
      TargetType: ip
      VpcId:
        Ref: VpcId
  DashboardLoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: dashboard-cfn-alb
      Type: application
      Subnets:
        - Ref: SubnetId
`;

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'cloudformation');
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'cloudformation',
    type: isError ? 'error' : 'success',
  });
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'cloudformation',
      toast,
    });

  function stacks() {
    return state.inventory?.stacks || [];
  }

  function selectedStack() {
    return stacks().find((stack) => stack.name === state.selectedStackName) || stacks()[0] || null;
  }

  function changeSets(stack = selectedStack()) {
    return stack?.change_sets || [];
  }

  function selectedChangeSet(stack = selectedStack()) {
    return changeSets(stack).find((changeSet) => (
      changeSet.ChangeSetName === state.selectedChangeSetName
      || changeSet.change_set_name === state.selectedChangeSetName
      || changeSet.ChangeSetId === state.selectedChangeSetName
    )) || changeSets(stack)[0] || null;
  }

  function encodePart(value) {
    return encodeURIComponent(value || '');
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'cloudformation',
      targets: {
        stacks: 'Stacks',
        active_stacks: 'Stacks',
        resources: 'Resources',
        events: 'Events',
        change_sets: 'Change sets',
        stack_sets: 'Stack sets',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = btn('AWS CloudFormation', null, () => {
      state.selectedStackName = '';
      state.selectedChangeSetName = '';
      render();
    });
    breadcrumbsEl.append(home);
    const stack = selectedStack();
    if (stack) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, stack.name || 'Stack'));
    }
  }

  function parseJsonInput(value) {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    return JSON.parse(trimmed);
  }

  function stackTemplate(stack) {
    const template = stack?.template;
    if (template?.TemplateBody) {
      return consoleUi.valueText(template.TemplateBody);
    }
    if (template?.template_body) {
      return consoleUi.valueText(template.template_body);
    }
    return sampleTemplate;
  }

  function buildTemplateForm(options = {}) {
    const form = el('div');
    const stackInput = document.createElement('input');
    stackInput.value = options.stackName || '';
    stackInput.placeholder = 'my-local-stack';
    const templateInput = document.createElement('textarea');
    templateInput.value = options.templateBody || sampleTemplate;
    templateInput.required = true;
    templateInput.rows = 14;
    const parametersInput = document.createElement('textarea');
    parametersInput.value = options.parameters || '';
    parametersInput.placeholder = '{\n  "Env": "dev"\n}';
    parametersInput.rows = 5;
    const capabilitiesInput = document.createElement('input');
    capabilitiesInput.value = options.capabilities || 'CAPABILITY_NAMED_IAM';
    capabilitiesInput.placeholder = 'CAPABILITY_NAMED_IAM';

    const presetSelect = document.createElement('select');
    presetSelect.append(new Option('SQS queue starter', 'sqs'), new Option('ECS + ALB (Floci 1.5.22)', 'ecs-alb'));
    presetSelect.addEventListener('change', () => {
      templateInput.value = presetSelect.value === 'ecs-alb' ? ecsAlbTemplate : sampleTemplate;
      if (presetSelect.value === 'ecs-alb' && !parametersInput.value.trim()) {
        parametersInput.value = '{\n  "VpcId": "vpc-00000000",\n  "SubnetId": "subnet-00000000"\n}';
      }
    });

    form.append(
      el('label', null, 'Stack name'),
      stackInput,
      el('label', null, 'Starter template'),
      presetSelect,
      el('label', null, 'Template body'),
      templateInput,
      el('label', null, 'Parameters JSON'),
      parametersInput,
      el('label', null, 'Capabilities'),
      capabilitiesInput,
    );

    return {
      form,
      values() {
        return {
          stack_name: stackInput.value.trim(),
          template_body: templateInput.value,
          parameters: parseJsonInput(parametersInput.value),
          capabilities: capabilitiesInput.value,
        };
      },
    };
  }

  function showValidateModal(stack) {
    const form = el('div');
    const templateInput = document.createElement('textarea');
    templateInput.value = stackTemplate(stack);
    templateInput.rows = 16;
    form.append(el('label', null, 'Template body'), templateInput);
    openModal('Validate template', form, 'Validate', async (close) => {
      const data = await apiJson('/api/cloudformation/templates/validate/', {
        method: 'POST',
        body: JSON.stringify({ template_body: templateInput.value }),
      });
      close();
      toast('Template validated');
      state.describedChangeSet = null;
      showJsonModal('Validation result', data.validation || data);
    });
  }

  function showCreateStackModal() {
    const built = buildTemplateForm();
    openModal('Create stack', built.form, 'Create', async (close) => {
      await apiJson('/api/cloudformation/stacks/', {
        method: 'POST',
        body: JSON.stringify({
          ...built.values(),
          disable_rollback: false,
        }),
      });
      close();
      toast('Stack create started');
      await refresh();
    });
  }

  function showUpdateStackModal(stack) {
    const built = buildTemplateForm({
      stackName: stack?.name || '',
      templateBody: stackTemplate(stack),
    });
    const stackInput = built.form.querySelector('input');
    if (stackInput) {
      stackInput.disabled = true;
    }
    openModal('Update stack', built.form, 'Update', async (close) => {
      const values = built.values();
      await apiJson(`/api/cloudformation/stacks/${encodePart(stack.name)}/`, {
        method: 'PUT',
        body: JSON.stringify(values),
      });
      close();
      toast('Stack update started');
      await refresh();
    });
  }

  function showDeleteStackModal(stack) {
    const body = el('div');
    body.append(
      el('p', null, 'Delete this stack and its local resources?'),
      el('pre', 'cloudformation-code-block', stack.name),
    );
    openModal('Delete stack', body, 'Delete', async (close) => {
      await apiJson(`/api/cloudformation/stacks/${encodePart(stack.name)}/`, { method: 'DELETE' });
      close();
      state.selectedStackName = '';
      toast('Stack delete started');
      await refresh();
    });
  }

  function showChangeSetModal(stack) {
    const built = buildTemplateForm({
      stackName: stack?.name || '',
      templateBody: stackTemplate(stack),
    });
    const changeSetInput = document.createElement('input');
    changeSetInput.placeholder = 'dashboard-change-set';
    const typeSelect = document.createElement('select');
    ['UPDATE', 'CREATE'].forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      typeSelect.append(option);
    });
    built.form.prepend(el('label', null, 'Change set type'), typeSelect);
    built.form.prepend(el('label', null, 'Change set name'), changeSetInput);
    openModal('Create change set', built.form, 'Create', async (close) => {
      await apiJson('/api/cloudformation/change-sets/', {
        method: 'POST',
        body: JSON.stringify({
          ...built.values(),
          change_set_name: changeSetInput.value.trim(),
          change_set_type: typeSelect.value,
        }),
      });
      close();
      toast('Change set created');
      await refresh();
    });
  }

  function showJsonModal(title, value) {
    const body = el('div');
    body.append(el('pre', 'cloudformation-code-block', consoleUi.valueText(value)));
    openModal(title, body, 'Close', (close) => close());
  }

  async function describeChangeSet(stack, changeSet) {
    const name = changeSet.ChangeSetName || changeSet.change_set_name || changeSet.ChangeSetId;
    const data = await apiJson(`/api/cloudformation/stacks/${encodePart(stack.name)}/change-sets/${encodePart(name)}/`);
    state.describedChangeSet = data.change_set || data;
    state.selectedChangeSetName = name;
    render();
  }

  function executeChangeSet(stack, changeSet) {
    const name = changeSet.ChangeSetName || changeSet.change_set_name || changeSet.ChangeSetId;
    const body = el('div');
    body.append(el('p', null, 'Execute this change set?'), el('pre', 'cloudformation-code-block', name));
    openModal('Execute change set', body, 'Execute', async (close) => {
      await apiJson(`/api/cloudformation/stacks/${encodePart(stack.name)}/change-sets/${encodePart(name)}/`, { method: 'POST' });
      close();
      toast('Change set executed');
      await refresh();
    });
  }

  function deleteChangeSet(stack, changeSet) {
    const name = changeSet.ChangeSetName || changeSet.change_set_name || changeSet.ChangeSetId;
    const body = el('div');
    body.append(el('p', null, 'Delete this change set?'), el('pre', 'cloudformation-code-block', name));
    openModal('Delete change set', body, 'Delete', async (close) => {
      await apiJson(`/api/cloudformation/stacks/${encodePart(stack.name)}/change-sets/${encodePart(name)}/`, { method: 'DELETE' });
      close();
      state.selectedChangeSetName = '';
      state.describedChangeSet = null;
      toast('Change set deleted');
      await refresh();
    });
  }

  function statusClass(status) {
    return `cloudformation-status cloudformation-status-${String(status || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }

  function renderStackRow(stack) {
    const active = stack.name === selectedStack()?.name;
    const row = btn('', `cloudformation-stack-row${active ? ' cloudformation-stack-row-active' : ''}`, () => {
      state.selectedStackName = stack.name;
      state.selectedChangeSetName = '';
      state.describedChangeSet = null;
      render();
    });
    row.append(
      el('span', 'cloudformation-stack-name', stack.name || 'Unnamed stack'),
      el('span', statusClass(stack.status), stack.status || 'UNKNOWN'),
      el('span', 'cloudformation-stack-meta', `${stack.resource_count || 0} resources / ${stack.event_count || 0} events`),
    );
    return row;
  }

  function renderStackList() {
    const panel = el('section', 'cloudformation-panel');
    panel.append(el('div', 'cloudformation-panel-heading', 'Stacks'));
    const list = el('div', 'cloudformation-stack-list');
    if (!stacks().length) {
      list.append(el('div', 'cloudformation-empty', 'No stacks found. Create one from a local template.'));
    } else {
      stacks().forEach((stack) => list.append(renderStackRow(stack)));
    }
    panel.append(list);
    return panel;
  }

  function renderDetails(stack) {
    const panel = el('section', 'cloudformation-panel');
    const heading = el('div', 'cloudformation-panel-heading');
    heading.append(
      el('span', null, stack ? stack.name : 'Stack detail'),
      el('span', stack ? statusClass(stack.status) : 'cloudformation-stack-meta', stack?.status || ''),
    );
    panel.append(heading);
    if (!stack) {
      panel.append(el('div', 'cloudformation-empty', 'Select or create a stack to inspect details.'));
      return panel;
    }
    const details = document.createElement('dl');
    consoleUi.addField(details, 'Stack ID', stack.id);
    consoleUi.addField(details, 'Created', consoleUi.formatDate(stack.created));
    consoleUi.addField(details, 'Updated', consoleUi.formatDate(stack.updated));
    consoleUi.addField(details, 'Description', stack.description);
    consoleUi.addField(details, 'Parameters', stack.parameters || []);
    consoleUi.addField(details, 'Outputs', stack.outputs || []);
    panel.append(details);
    return panel;
  }

  function renderEvents(stack) {
    const panel = el('section', 'cloudformation-panel', '');
    panel.id = consoleUi.sectionIdForLabel('cloudformation', 'Events');
    panel.append(el('div', 'cloudformation-panel-heading', 'Recent events'));
    const events = stack?.events || [];
    if (!events.length) {
      panel.append(el('div', 'cloudformation-empty cloudformation-empty-compact', 'No stack events returned.'));
      return panel;
    }
    const list = el('div', 'cloudformation-event-list');
    events.slice(0, 30).forEach((event) => {
      const item = el('article', 'cloudformation-event');
      item.append(
        el('strong', null, event.LogicalResourceId || event.logical_resource_id || event.ResourceType || 'Stack event'),
        el('span', statusClass(event.ResourceStatus || event.resource_status), event.ResourceStatus || event.resource_status || 'UNKNOWN'),
        el('span', 'cloudformation-stack-meta', consoleUi.formatDate(event.Timestamp || event.timestamp)),
      );
      const reason = event.ResourceStatusReason || event.resource_status_reason;
      if (reason) {
        item.append(el('p', null, reason));
      }
      list.append(item);
    });
    panel.append(list);
    return panel;
  }

  function renderResources(stack) {
    const panel = el('section', 'cloudformation-panel');
    panel.id = consoleUi.sectionIdForLabel('cloudformation', 'Resources');
    panel.append(el('div', 'cloudformation-panel-heading', 'Resources'));
    const resources = stack?.resource_summaries || stack?.resources || [];
    if (!resources.length) {
      panel.append(el('div', 'cloudformation-empty cloudformation-empty-compact', 'No resources returned for this stack.'));
      return panel;
    }
    const list = el('div', 'cloudformation-resource-list');
    resources.forEach((resource) => {
      const item = el('article', 'cloudformation-resource');
      item.append(
        el('strong', null, resource.LogicalResourceId || resource.logical_resource_id || 'Resource'),
        el('span', 'cloudformation-stack-meta', resource.ResourceType || resource.resource_type || ''),
        el('span', statusClass(resource.ResourceStatus || resource.resource_status), resource.ResourceStatus || resource.resource_status || ''),
      );
      if (resource.PhysicalResourceId || resource.physical_resource_id) {
        item.append(el('code', null, resource.PhysicalResourceId || resource.physical_resource_id));
      }
      list.append(item);
    });
    panel.append(list);
    return panel;
  }

  function renderChangeSets(stack) {
    const panel = el('section', 'cloudformation-panel');
    panel.id = consoleUi.sectionIdForLabel('cloudformation', 'Change sets');
    panel.append(el('div', 'cloudformation-panel-heading', 'Change sets'));
    const sets = changeSets(stack);
    if (!sets.length) {
      panel.append(el('div', 'cloudformation-empty cloudformation-empty-compact', 'No change sets found.'));
      return panel;
    }
    const list = el('div', 'cloudformation-change-set-list');
    sets.forEach((changeSet) => {
      const name = changeSet.ChangeSetName || changeSet.change_set_name || changeSet.ChangeSetId;
      const item = el('article', 'cloudformation-change-set');
      item.append(
        el('strong', null, name || 'Change set'),
        el('span', statusClass(changeSet.Status || changeSet.status), changeSet.Status || changeSet.status || ''),
        el('span', 'cloudformation-stack-meta', changeSet.ExecutionStatus || changeSet.execution_status || ''),
      );
      const actions = el('div', 'cloudformation-inline-actions');
      actions.append(
        btn('Describe', null, () => describeChangeSet(stack, changeSet).catch((error) => toast(error.message, true))),
        btn('Execute', null, () => executeChangeSet(stack, changeSet)),
        btn('Delete', 'cloudformation-btn-danger', () => deleteChangeSet(stack, changeSet)),
      );
      item.append(actions);
      list.append(item);
    });
    if (state.describedChangeSet) {
      panel.append(el('pre', 'cloudformation-code-block', consoleUi.valueText(state.describedChangeSet)));
    }
    panel.append(list);
    return panel;
  }

  function renderTemplate(stack) {
    const panel = el('section', 'cloudformation-panel');
    panel.append(el('div', 'cloudformation-panel-heading', 'Template'));
    panel.append(el('pre', 'cloudformation-code-block', stack ? stackTemplate(stack) : sampleTemplate));
    return panel;
  }

  function renderWorkbench() {
    const stack = selectedStack();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Validate template', null, () => showValidateModal(stack)),
        btn('Create stack', null, showCreateStackModal),
      ],
      [
        btn('Update stack', null, () => stack && showUpdateStackModal(stack)),
        btn('Create change set', null, () => showChangeSetModal(stack)),
        btn('Delete stack', 'cloudformation-btn-danger', () => stack && showDeleteStackModal(stack)),
      ],
    ));
    container.querySelectorAll('.cloudformation-toolbar-right button').forEach((button) => {
      button.disabled = !stack;
    });

    const workbench = el('div', 'cloudformation-workbench');
    const detail = el('div', 'cloudformation-detail-stack');
    detail.append(renderDetails(stack), renderEvents(stack), renderResources(stack), renderChangeSets(stack), renderTemplate(stack));
    workbench.append(renderStackList(), detail);
    container.append(workbench);
    return container;
  }

  function render() {
    if (!root) {
      return;
    }
    renderBreadcrumbs();
    root.textContent = '';
    root.append(renderWorkbench());
    if (loadedAtEl) {
      loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
    }
  }

  async function refresh() {
    const data = await apiJson('/api/cloudformation/');
    state.inventory = data;
    if (!selectedStack() && stacks().length) {
      state.selectedStackName = stacks()[0].name;
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'cloudformation-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.CloudFormationConsole = CloudFormationConsole;

if (document.getElementById('cloudformation-console-root')) {
  CloudFormationConsole.init();
}
