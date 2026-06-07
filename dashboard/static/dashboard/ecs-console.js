/* global ServiceConsole */

const ECSConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('ecs-console-root');
  const breadcrumbsEl = document.getElementById('ecs-breadcrumbs');
  const summaryEl = document.getElementById('ecs-summary');
  const loadedAtEl = document.getElementById('ecs-loaded-at');

  const state = {
    inventory: null,
    selectedClusterArn: '',
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'ecs',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'ecs');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'ecs',
      toast,
    });

  function clusters() {
    return state.inventory?.clusters || [];
  }

  function taskDefinitions() {
    return state.inventory?.task_definitions || [];
  }

  function clusterArn(cluster) {
    return cluster?.arn || cluster?.clusterArn || cluster?.name || '';
  }

  function selectedCluster() {
    return clusters().find((cluster) => clusterArn(cluster) === state.selectedClusterArn) || clusters()[0] || null;
  }

  function clusterName(cluster) {
    return cluster?.name || cluster?.clusterName || clusterArn(cluster) || 'default';
  }

  function taskDefArn(definition) {
    return definition?.arn || definition?.taskDefinitionArn || definition?.name || '';
  }

  function serviceName(service) {
    return service?.serviceName || service?.service_name || service?.serviceArn || '';
  }

  function taskArn(task) {
    return task?.taskArn || task?.task_arn || '';
  }

  function parseJson(value, fallback, label) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return fallback;
    }
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`${label} must be valid JSON`);
    }
  }

  function parseList(value) {
    return String(value || '')
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function option(select, value, label, selected = false) {
    const node = document.createElement('option');
    node.value = value || '';
    node.textContent = label || value || '';
    node.selected = selected;
    select.append(node);
  }

  function addClusterOptions(select, selectedValue = '') {
    clusters().forEach((cluster) => option(
      select,
      clusterArn(cluster),
      clusterName(cluster),
      clusterArn(cluster) === selectedValue,
    ));
    if (!clusters().length) {
      option(select, '', 'Create a cluster first');
    }
  }

  function addTaskDefinitionOptions(select, selectedValue = '') {
    taskDefinitions().forEach((definition) => option(
      select,
      taskDefArn(definition),
      definition.name || taskDefArn(definition),
      taskDefArn(definition) === selectedValue,
    ));
    if (!taskDefinitions().length) {
      option(select, '', 'Register a task definition first');
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'ecs',
      targets: {
        clusters: 'Clusters',
        task_definitions: 'Task definitions',
        task_definition_families: 'Task definition families',
        tasks: 'Clusters',
        services: 'Clusters',
        task_sets: 'Clusters',
        container_instances: 'Clusters',
        capacity_providers: 'Capacity providers',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = btn('ECS', null, () => {
      state.selectedClusterArn = clusters()[0] ? clusterArn(clusters()[0]) : '';
      render();
    });
    breadcrumbsEl.append(home);
    const cluster = selectedCluster();
    if (cluster) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, clusterName(cluster)));
    }
  }

  function showCreateClusterModal() {
    const form = el('div', 'ecs-modal-form');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'local-cluster';
    const providersInput = document.createElement('input');
    providersInput.placeholder = 'FARGATE,FARGATE_SPOT';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '[{"key":"env","value":"local"}]';
    form.append(
      el('label', null, 'Cluster name'),
      nameInput,
      el('label', null, 'Capacity providers'),
      providersInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Create cluster', form, 'Create', async (close) => {
      const data = await apiJson('/api/ecs/clusters/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          capacity_providers: parseList(providersInput.value),
          tags: parseJson(tagsInput.value, [], 'Tags'),
        }),
      });
      state.selectedClusterArn = data.arn || nameInput.value.trim();
      state.lastResult = data;
      close();
      toast('Cluster created');
      await refresh();
    });
  }

  function showRegisterTaskDefinitionModal() {
    const form = el('div', 'ecs-modal-form');
    const familyInput = document.createElement('input');
    familyInput.placeholder = 'web';
    const containerInput = document.createElement('textarea');
    containerInput.value = JSON.stringify([{
      name: 'app',
      image: 'nginx:latest',
      cpu: 256,
      memory: 512,
      essential: true,
      portMappings: [{ containerPort: 80, protocol: 'tcp' }],
      mountPoints: [{ sourceVolume: 'app-data', containerPath: '/usr/share/nginx/html', readOnly: false }],
    }], null, 2);
    const volumesInput = document.createElement('textarea');
    volumesInput.value = JSON.stringify([{ name: 'app-data' }], null, 2);
    const compatInput = document.createElement('input');
    compatInput.value = 'FARGATE';
    const networkMode = document.createElement('select');
    ['awsvpc', 'bridge', 'host', 'none'].forEach((value) => option(networkMode, value, value));
    const cpuInput = document.createElement('input');
    cpuInput.value = '256';
    const memoryInput = document.createElement('input');
    memoryInput.value = '512';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '[{"key":"app","value":"web"}]';
    form.append(
      el('label', null, 'Family'),
      familyInput,
      el('label', null, 'Container definitions JSON'),
      containerInput,
      el('label', null, 'Volumes JSON'),
      volumesInput,
      el('label', null, 'Requires compatibilities'),
      compatInput,
      el('label', null, 'Network mode'),
      networkMode,
      el('label', null, 'CPU'),
      cpuInput,
      el('label', null, 'Memory'),
      memoryInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Register task definition', form, 'Register', async (close) => {
      const data = await apiJson('/api/ecs/task-definitions/', {
        method: 'POST',
        body: JSON.stringify({
          family: familyInput.value.trim(),
          container_definitions: parseJson(containerInput.value, [], 'Container definitions'),
          volumes: parseJson(volumesInput.value, [], 'Volumes'),
          requires_compatibilities: parseList(compatInput.value),
          network_mode: networkMode.value,
          cpu: cpuInput.value.trim(),
          memory: memoryInput.value.trim(),
          tags: parseJson(tagsInput.value, [], 'Tags'),
        }),
      });
      state.lastResult = data;
      close();
      toast('Task definition registered');
      await refresh();
    });
  }

  function showRunTaskModal(cluster = selectedCluster()) {
    const form = el('div', 'ecs-modal-form');
    const clusterSelect = document.createElement('select');
    addClusterOptions(clusterSelect, clusterArn(cluster));
    const taskDefSelect = document.createElement('select');
    addTaskDefinitionOptions(taskDefSelect);
    const launchType = document.createElement('select');
    ['FARGATE', 'EC2', 'EXTERNAL'].forEach((value) => option(launchType, value, value));
    const countInput = document.createElement('input');
    countInput.type = 'number';
    countInput.min = '1';
    countInput.value = '1';
    const startedByInput = document.createElement('input');
    startedByInput.placeholder = 'dashboard';
    const networkInput = document.createElement('textarea');
    networkInput.placeholder = '{"awsvpcConfiguration":{"subnets":["subnet-123"],"assignPublicIp":"ENABLED"}}';
    const overridesInput = document.createElement('textarea');
    overridesInput.placeholder = '{"containerOverrides":[{"name":"app","command":["echo","hello"],"environment":[{"name":"MODE","value":"local"}]}]}';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '[{"key":"run","value":"local"}]';
    form.append(
      el('label', null, 'Cluster'),
      clusterSelect,
      el('label', null, 'Task definition'),
      taskDefSelect,
      el('label', null, 'Launch type'),
      launchType,
      el('label', null, 'Count'),
      countInput,
      el('label', null, 'Started by'),
      startedByInput,
      el('label', null, 'Network configuration JSON'),
      networkInput,
      el('label', null, 'Container overrides JSON'),
      overridesInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Run task', form, 'Run', async (close) => {
      const data = await apiJson('/api/ecs/tasks/run/', {
        method: 'POST',
        body: JSON.stringify({
          cluster: clusterSelect.value,
          task_definition: taskDefSelect.value,
          launch_type: launchType.value,
          count: Number(countInput.value || 1),
          started_by: startedByInput.value.trim(),
          network_configuration: parseJson(networkInput.value, {}, 'Network configuration'),
          overrides: parseJson(overridesInput.value, {}, 'Container overrides'),
          tags: parseJson(tagsInput.value, [], 'Tags'),
        }),
      });
      state.lastResult = data;
      close();
      toast('Task started');
      await refresh();
    });
  }

  function showCreateServiceModal(cluster = selectedCluster()) {
    const form = el('div', 'ecs-modal-form');
    const clusterSelect = document.createElement('select');
    addClusterOptions(clusterSelect, clusterArn(cluster));
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'web-service';
    const taskDefSelect = document.createElement('select');
    addTaskDefinitionOptions(taskDefSelect);
    const desiredInput = document.createElement('input');
    desiredInput.type = 'number';
    desiredInput.value = '1';
    const launchType = document.createElement('select');
    ['FARGATE', 'EC2', 'EXTERNAL'].forEach((value) => option(launchType, value, value));
    const networkInput = document.createElement('textarea');
    networkInput.placeholder = '{"awsvpcConfiguration":{"subnets":["subnet-123"],"assignPublicIp":"ENABLED"}}';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '[{"key":"service","value":"web"}]';
    form.append(
      el('label', null, 'Cluster'),
      clusterSelect,
      el('label', null, 'Service name'),
      nameInput,
      el('label', null, 'Task definition'),
      taskDefSelect,
      el('label', null, 'Desired count'),
      desiredInput,
      el('label', null, 'Launch type'),
      launchType,
      el('label', null, 'Network configuration JSON'),
      networkInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Create service', form, 'Create', async (close) => {
      const data = await apiJson('/api/ecs/services/', {
        method: 'POST',
        body: JSON.stringify({
          cluster: clusterSelect.value,
          service_name: nameInput.value.trim(),
          task_definition: taskDefSelect.value,
          desired_count: Number(desiredInput.value || 1),
          launch_type: launchType.value,
          network_configuration: parseJson(networkInput.value, {}, 'Network configuration'),
          tags: parseJson(tagsInput.value, [], 'Tags'),
        }),
      });
      state.lastResult = data;
      close();
      toast('Service created');
      await refresh();
    });
  }

  function showUpdateServiceModal(cluster, service) {
    const form = el('div', 'ecs-modal-form');
    const desiredInput = document.createElement('input');
    desiredInput.type = 'number';
    desiredInput.value = service.desiredCount ?? service.desired_count ?? 1;
    const taskDefSelect = document.createElement('select');
    option(taskDefSelect, '', 'Keep current task definition');
    addTaskDefinitionOptions(taskDefSelect, service.taskDefinition || '');
    const forceWrap = el('label', 'ecs-checkbox');
    const forceInput = document.createElement('input');
    forceInput.type = 'checkbox';
    forceWrap.append(forceInput, el('span', null, 'Force new deployment'));
    form.append(
      el('label', null, 'Desired count'),
      desiredInput,
      el('label', null, 'Task definition'),
      taskDefSelect,
      forceWrap,
    );
    openModal('Update service', form, 'Update', async (close) => {
      const data = await apiJson('/api/ecs/services/update/', {
        method: 'POST',
        body: JSON.stringify({
          cluster: clusterArn(cluster),
          service: serviceName(service),
          desired_count: desiredInput.value,
          task_definition: taskDefSelect.value,
          force_new_deployment: forceInput.checked,
        }),
      });
      state.lastResult = data;
      close();
      toast('Service updated');
      await refresh();
    });
  }

  function showTagsModal(resourceArn) {
    const form = el('div', 'ecs-modal-form');
    const arnInput = document.createElement('input');
    arnInput.value = resourceArn || '';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '[{"key":"env","value":"local"}]';
    const keysInput = document.createElement('input');
    keysInput.placeholder = 'env,owner';
    form.append(
      el('label', null, 'Resource ARN'),
      arnInput,
      el('label', null, 'Add tags JSON'),
      tagsInput,
      btn('Add tags', null, async () => {
        try {
          await apiJson('/api/ecs/tags/', {
            method: 'POST',
            body: JSON.stringify({
              resource_arn: arnInput.value.trim(),
              tags: parseJson(tagsInput.value, [], 'Tags'),
            }),
          });
          toast('Tags added');
          await refresh();
        } catch (error) {
          toast(error.message, true);
        }
      }),
      el('label', null, 'Remove tag keys'),
      keysInput,
      btn('Remove tags', 'ecs-btn-secondary', async () => {
        try {
          await apiJson('/api/ecs/tags/', {
            method: 'DELETE',
            body: JSON.stringify({
              resource_arn: arnInput.value.trim(),
              tag_keys: parseList(keysInput.value),
            }),
          });
          toast('Tags removed');
          await refresh();
        } catch (error) {
          toast(error.message, true);
        }
      }),
    );
    openModal('Resource tags', form, 'Done', (close) => close());
  }

  function showAccountSettingModal() {
    const form = el('div', 'ecs-modal-form');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'containerInsights';
    const valueInput = document.createElement('input');
    valueInput.placeholder = 'enabled';
    const principalInput = document.createElement('input');
    principalInput.placeholder = 'optional principal ARN';
    form.append(
      el('label', null, 'Setting name'),
      nameInput,
      el('label', null, 'Setting value'),
      valueInput,
      el('label', null, 'Principal ARN'),
      principalInput,
    );
    openModal('Put account setting', form, 'Save', async (close) => {
      const data = await apiJson('/api/ecs/account-settings/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          value: valueInput.value.trim(),
          principal_arn: principalInput.value.trim(),
        }),
      });
      state.lastResult = data;
      close();
      toast('Account setting saved');
      await refresh();
    });
  }

  async function deleteCluster(cluster) {
    if (!window.confirm('Delete this empty cluster?')) {
      return;
    }
    const data = await apiJson('/api/ecs/clusters/delete/', {
      method: 'POST',
      body: JSON.stringify({ cluster: clusterArn(cluster) }),
    });
    state.lastResult = data;
    state.selectedClusterArn = '';
    toast('Cluster deleted');
    await refresh();
  }

  async function stopTask(cluster, task) {
    if (!window.confirm('Stop this task?')) {
      return;
    }
    const data = await apiJson('/api/ecs/tasks/stop/', {
      method: 'POST',
      body: JSON.stringify({
        cluster: clusterArn(cluster),
        task: taskArn(task),
        reason: 'Stopped from Floci Dashboard',
      }),
    });
    state.lastResult = data;
    toast('Task stopped');
    await refresh();
  }

  async function deleteService(cluster, service) {
    if (!window.confirm('Delete this ECS service?')) {
      return;
    }
    const data = await apiJson('/api/ecs/services/delete/', {
      method: 'POST',
      body: JSON.stringify({
        cluster: clusterArn(cluster),
        service: serviceName(service),
        force: true,
      }),
    });
    state.lastResult = data;
    toast('Service deleted');
    await refresh();
  }

  function renderClusterList() {
    const panel = el('section', 'ecs-panel');
    panel.append(el('div', 'ecs-panel-heading', 'Clusters'));
    const list = el('div', 'ecs-cluster-list');
    if (!clusters().length) {
      list.append(el('div', 'ecs-empty', 'No ECS clusters found.'));
    } else {
      clusters().forEach((cluster) => {
        const active = clusterArn(cluster) === clusterArn(selectedCluster());
        const row = el('button', `ecs-cluster-row${active ? ' ecs-cluster-row-active' : ''}`);
        row.append(
          el('span', 'ecs-cluster-name', clusterName(cluster)),
          el('span', 'ecs-cluster-meta', `${cluster.status || 'Unknown'} / ${cluster.task_count || 0} tasks / ${cluster.service_count || 0} services`),
        );
        row.addEventListener('click', () => {
          state.selectedClusterArn = clusterArn(cluster);
          render();
        });
        list.append(row);
      });
    }
    panel.append(list);
    return panel;
  }

  function renderClusterDetail(cluster) {
    const panel = el('section', 'ecs-panel');
    panel.append(el('div', 'ecs-panel-heading', 'Selected cluster'));
    const body = el('div', 'ecs-detail');
    const facts = el('dl', 'ecs-facts');
    consoleUi.addField(facts, 'Cluster', clusterName(cluster));
    consoleUi.addField(facts, 'ARN', clusterArn(cluster));
    consoleUi.addField(facts, 'Status', cluster.status);
    consoleUi.addField(facts, 'Running tasks', cluster.running_tasks);
    consoleUi.addField(facts, 'Pending tasks', cluster.pending_tasks);
    consoleUi.addField(facts, 'Active services', cluster.active_services);
    consoleUi.addField(facts, 'Container instances', cluster.registered_container_instances);
    consoleUi.addField(facts, 'Capacity providers', cluster.capacity_providers);
    consoleUi.addField(facts, 'Settings', cluster.settings);
    consoleUi.addField(facts, 'Tags', cluster.tags);
    body.append(facts);
    const actions = el('div', 'ecs-action-row');
    actions.append(
      btn('Run task', null, () => showRunTaskModal(cluster)),
      btn('Create service', 'ecs-btn-secondary', () => showCreateServiceModal(cluster)),
      btn('Tags', 'ecs-btn-secondary', () => showTagsModal(clusterArn(cluster))),
      btn('Delete cluster', 'ecs-btn-danger', () => deleteCluster(cluster).catch((error) => toast(error.message, true))),
    );
    body.append(actions);
    panel.append(body);
    return panel;
  }

  function renderTasksPanel(cluster) {
    const panel = el('section', 'ecs-panel');
    panel.append(el('div', 'ecs-panel-heading', `Tasks (${cluster.tasks?.length || 0})`));
    const body = el('div', 'ecs-card-list');
    (cluster.tasks || []).forEach((task) => {
      const card = el('article', 'ecs-card');
      card.append(el('h3', null, task.group || taskArn(task) || 'Task'));
      const facts = el('dl', 'ecs-facts');
      consoleUi.addField(facts, 'Task ARN', taskArn(task));
      consoleUi.addField(facts, 'Task definition', task.taskDefinitionArn);
      consoleUi.addField(facts, 'Last status', task.lastStatus);
      consoleUi.addField(facts, 'Desired status', task.desiredStatus);
      consoleUi.addField(facts, 'Launch type', task.launchType);
      consoleUi.addField(facts, 'Containers', task.containers);
      card.append(facts, btn('Stop task', 'ecs-btn-danger', () => stopTask(cluster, task).catch((error) => toast(error.message, true))));
      body.append(card);
    });
    if (!cluster.tasks?.length) {
      body.append(el('p', 'ecs-empty', 'No tasks found in this cluster.'));
    }
    panel.append(body);
    return panel;
  }

  function renderServicesPanel(cluster) {
    const panel = el('section', 'ecs-panel');
    panel.append(el('div', 'ecs-panel-heading', `Services (${cluster.services?.length || 0})`));
    const body = el('div', 'ecs-card-list');
    (cluster.services || []).forEach((service) => {
      const card = el('article', 'ecs-card');
      card.append(el('h3', null, serviceName(service) || 'Service'));
      const facts = el('dl', 'ecs-facts');
      consoleUi.addField(facts, 'ARN', service.serviceArn);
      consoleUi.addField(facts, 'Status', service.status);
      consoleUi.addField(facts, 'Task definition', service.taskDefinition);
      consoleUi.addField(facts, 'Desired count', service.desiredCount);
      consoleUi.addField(facts, 'Running count', service.runningCount);
      consoleUi.addField(facts, 'Pending count', service.pendingCount);
      consoleUi.addField(facts, 'Deployments', service.deployments);
      card.append(facts);
      const actions = el('div', 'ecs-action-row');
      actions.append(
        btn('Update', null, () => showUpdateServiceModal(cluster, service)),
        btn('Tags', 'ecs-btn-secondary', () => showTagsModal(service.serviceArn)),
        btn('Delete', 'ecs-btn-danger', () => deleteService(cluster, service).catch((error) => toast(error.message, true))),
      );
      card.append(actions);
      body.append(card);
    });
    if (!cluster.services?.length) {
      body.append(el('p', 'ecs-empty', 'No services found in this cluster.'));
    }
    panel.append(body);
    return panel;
  }

  function renderTaskDefinitionsPanel() {
    const panel = el('section', 'ecs-panel');
    panel.append(el('div', 'ecs-panel-heading', `Task definitions (${taskDefinitions().length})`));
    const body = el('div', 'ecs-card-list');
    taskDefinitions().slice(0, 6).forEach((definition) => {
      const card = el('article', 'ecs-card');
      card.append(el('h3', null, definition.name || taskDefArn(definition)));
      const facts = el('dl', 'ecs-facts');
      consoleUi.addField(facts, 'ARN', taskDefArn(definition));
      consoleUi.addField(facts, 'Status', definition.status);
      consoleUi.addField(facts, 'Network mode', definition.network_mode);
      consoleUi.addField(facts, 'CPU', definition.cpu);
      consoleUi.addField(facts, 'Memory', definition.memory);
      consoleUi.addField(facts, 'Containers', definition.containers);
      card.append(facts, btn('Tags', 'ecs-btn-secondary', () => showTagsModal(taskDefArn(definition))));
      body.append(card);
    });
    if (!taskDefinitions().length) {
      body.append(el('p', 'ecs-empty', 'No task definitions registered.'));
    }
    panel.append(body);
    return panel;
  }

  function renderResult() {
    if (!state.lastResult) {
      return null;
    }
    const panel = el('section', 'ecs-panel');
    panel.append(el('div', 'ecs-panel-heading', 'Last action result'));
    const pre = el('pre', 'ecs-result');
    pre.textContent = JSON.stringify(consoleUi.displayValue(state.lastResult), null, 2);
    panel.append(pre);
    return panel;
  }

  function renderWorkbench() {
    const workbench = el('div', 'ecs-workbench');
    const cluster = selectedCluster();
    workbench.append(renderClusterList());
    const detail = el('div', 'ecs-detail-stack');
    if (!cluster) {
      detail.append(el('section', 'ecs-panel ecs-empty-panel', 'Create a cluster to start testing local container workloads.'));
    } else {
      detail.append(renderClusterDetail(cluster), renderServicesPanel(cluster), renderTasksPanel(cluster));
    }
    detail.append(renderTaskDefinitionsPanel());
    const result = renderResult();
    if (result) {
      detail.append(result);
    }
    workbench.append(detail);
    return workbench;
  }

  function render() {
    if (!root) {
      return;
    }
    root.textContent = '';
    renderBreadcrumbs();
    renderSummary(state.inventory?.summary || {});
    root.append(toolbar(
      [
        btn('Create cluster', null, showCreateClusterModal),
        btn('Register task definition', 'ecs-btn-secondary', showRegisterTaskDefinitionModal),
        btn('Run task', 'ecs-btn-secondary', () => showRunTaskModal()),
        btn('Account setting', 'ecs-btn-secondary', showAccountSettingModal),
      ],
      [el('span', 'ecs-toolbar-note', 'Local clusters, task definitions, tasks, and services')],
    ));
    root.append(renderWorkbench());
    if (loadedAtEl) {
      loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
    }
  }

  async function refresh() {
    if (!root) {
      return;
    }
    const data = await apiJson('/api/ecs/');
    state.inventory = data;
    if (!state.selectedClusterArn && clusters()[0]) {
      state.selectedClusterArn = clusterArn(clusters()[0]);
    }
    render();
  }

  return { refresh };
})();

window.ECSConsole = ECSConsole;
