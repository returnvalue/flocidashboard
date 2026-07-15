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
    activeView: 'overview',
    selectedTaskDefinitionArn: '',
    selectedServiceArn: '',
    taskServiceFilter: '',
    resourceQuery: '',
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

  function selectedTaskDefinition() {
    return taskDefinitions().find((definition) => taskDefArn(definition) === state.selectedTaskDefinitionArn) || taskDefinitions()[0] || null;
  }

  function serviceName(service) {
    return service?.serviceName || service?.service_name || service?.serviceArn || '';
  }

  function serviceArn(service) {
    return service?.serviceArn || service?.service_arn || serviceName(service);
  }

  function selectedService(cluster = selectedCluster()) {
    const services = cluster?.services || [];
    return services.find((service) => serviceArn(service) === state.selectedServiceArn) || services[0] || null;
  }

  function matchesQuery(...values) {
    const query = state.resourceQuery.trim().toLowerCase();
    return !query || values.some((value) => JSON.stringify(value ?? '').toLowerCase().includes(query));
  }

  function taskArn(task) {
    return task?.taskArn || task?.task_arn || '';
  }

  function resourceLink(label, href) {
    const link = el('a', 'ecs-resource-link', label);
    link.href = href;
    return link;
  }

  function imageRepository(image) {
    const match = String(image || '').match(/^(?:[^/]+\.dkr\.ecr\.[^/]+\.amazonaws\.com\/)?([^:@]+(?:\/[^:@]+)*)(?::[^@]+|@.+)?$/);
    return match?.[1] || '';
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

  function showRegisterTaskDefinitionModal(source = null) {
    const form = el('div', 'ecs-modal-form');
    const familyInput = document.createElement('input');
    familyInput.placeholder = 'web';
    familyInput.value = source?.family || '';
    const containerInput = document.createElement('textarea');
    containerInput.value = JSON.stringify(source?.container_definitions || [{
      name: 'app',
      image: 'nginx:latest',
      cpu: 256,
      memory: 512,
      essential: true,
      portMappings: [{ containerPort: 80, protocol: 'tcp' }],
      mountPoints: [{ sourceVolume: 'app-data', containerPath: '/usr/share/nginx/html', readOnly: false }],
    }], null, 2);
    const volumesInput = document.createElement('textarea');
    volumesInput.value = JSON.stringify(source?.volumes || [{ name: 'app-data' }], null, 2);
    const compatInput = document.createElement('input');
    compatInput.value = (source?.requires_compatibilities || ['FARGATE']).join(',');
    const networkMode = document.createElement('select');
    ['awsvpc', 'bridge', 'host', 'none'].forEach((value) => option(networkMode, value, value));
    networkMode.value = source?.network_mode || 'awsvpc';
    const cpuInput = document.createElement('input');
    cpuInput.value = source?.cpu || '256';
    const memoryInput = document.createElement('input');
    memoryInput.value = source?.memory || '512';
    const taskRoleInput = document.createElement('input');
    taskRoleInput.value = source?.task_role_arn || '';
    const executionRoleInput = document.createElement('input');
    executionRoleInput.value = source?.execution_role_arn || '';
    const optionsInput = document.createElement('textarea');
    optionsInput.value = JSON.stringify(source ? {
      runtimePlatform: source.runtime_platform,
      ephemeralStorage: source.ephemeral_storage,
      placementConstraints: source.placement_constraints,
      proxyConfiguration: source.proxy_configuration,
      ipcMode: source.ipc_mode,
      pidMode: source.pid_mode,
      inferenceAccelerators: source.inference_accelerators,
    } : {}, (key, value) => value == null ? undefined : value, 2);
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
      el('label', null, 'Task role ARN'), taskRoleInput,
      el('label', null, 'Execution role ARN'), executionRoleInput,
      el('label', null, 'Advanced options JSON'), optionsInput,
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
          task_role_arn: taskRoleInput.value.trim(),
          execution_role_arn: executionRoleInput.value.trim(),
          options: parseJson(optionsInput.value, {}, 'Advanced options'),
          tags: parseJson(tagsInput.value, [], 'Tags'),
        }),
      });
      state.lastResult = data;
      close();
      toast('Task definition registered');
      await refresh();
    });
  }

  function showRunTaskModal(cluster = selectedCluster(), definition = null) {
    const form = el('div', 'ecs-modal-form');
    const clusterSelect = document.createElement('select');
    addClusterOptions(clusterSelect, clusterArn(cluster));
    const taskDefSelect = document.createElement('select');
    addTaskDefinitionOptions(taskDefSelect);
    if (definition) taskDefSelect.value = taskDefArn(definition);
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
    const networkInput = document.createElement('textarea');
    networkInput.value = JSON.stringify(service.networkConfiguration || {}, null, 2);
    form.append(
      el('label', null, 'Desired count'),
      desiredInput,
      el('label', null, 'Task definition'),
      taskDefSelect,
      el('label', null, 'Network configuration JSON'),
      networkInput,
    );
    openModal('Update service', form, 'Update', async (close) => {
      const data = await apiJson('/api/ecs/services/update/', {
        method: 'POST',
        body: JSON.stringify({
          cluster: clusterArn(cluster),
          service: serviceName(service),
          desired_count: desiredInput.value,
          task_definition: taskDefSelect.value,
          network_configuration: parseJson(networkInput.value, {}, 'Network configuration'),
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

  function showTaskProtectionModal(cluster, task) {
    const form = el('div', 'ecs-modal-form');
    const enabledWrap = el('label', 'ecs-checkbox');
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = Boolean(task.protection?.protectionEnabled);
    enabledWrap.append(enabled, el('span', null, 'Protect task from service scale-in'));
    const expires = document.createElement('input');
    expires.type = 'number'; expires.min = '1'; expires.value = '60';
    form.append(enabledWrap, el('label', null, 'Expires in minutes'), expires);
    openModal('Task scale-in protection', form, 'Save', async (close) => {
      const data = await apiJson('/api/ecs/tasks/protection/', {
        method: 'POST',
        body: JSON.stringify({ cluster: clusterArn(cluster), tasks: [taskArn(task)], protection_enabled: enabled.checked, expires_in_minutes: enabled.checked ? expires.value : null }),
      });
      state.lastResult = data; close(); toast(enabled.checked ? 'Task protected' : 'Task protection removed'); await refresh();
    });
  }

  async function updateContainerInstanceState(cluster, instance, status) {
    const arn = instance.containerInstanceArn;
    const data = await apiJson('/api/ecs/container-instances/state/', {
      method: 'POST',
      body: JSON.stringify({ cluster: clusterArn(cluster), container_instances: [arn], status }),
    });
    state.lastResult = data; toast(`Container instance set to ${status}`); await refresh();
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
    const serviceFilter = state.taskServiceFilter;
    const tasks = (cluster.tasks || []).filter((task) => {
      const belongsToService = !serviceFilter || task.group === `service:${serviceFilter}` || task.startedBy === serviceFilter;
      return belongsToService && matchesQuery(taskArn(task), task.group, task.taskDefinitionArn, task.containers);
    });
    const heading = el('div', 'ecs-panel-heading');
    heading.append(el('span', null, `Tasks (${tasks.length})`));
    if (serviceFilter) heading.append(btn(`Clear service filter: ${serviceFilter}`, 'ecs-btn-secondary', () => { state.taskServiceFilter = ''; render(); }));
    panel.append(heading);
    const body = el('div', 'ecs-card-list');
    tasks.forEach((task) => {
      const card = el('article', 'ecs-card');
      card.append(el('h3', null, task.group || taskArn(task) || 'Task'));
      const facts = el('dl', 'ecs-facts');
      consoleUi.addField(facts, 'Task ARN', taskArn(task));
      consoleUi.addField(facts, 'Task definition', task.taskDefinitionArn);
      consoleUi.addField(facts, 'Last status', task.lastStatus);
      consoleUi.addField(facts, 'Desired status', task.desiredStatus);
      consoleUi.addField(facts, 'Launch type', task.launchType);
      consoleUi.addField(facts, 'Capacity provider', task.capacityProviderName);
      consoleUi.addField(facts, 'Started by', task.startedBy);
      consoleUi.addField(facts, 'Stopped reason', task.stoppedReason);
      consoleUi.addField(facts, 'Connectivity', task.connectivity);
      consoleUi.addField(facts, 'Health', task.healthStatus);
      consoleUi.addField(facts, 'Scale-in protection', task.protection);
      consoleUi.addField(facts, 'Attachments', task.attachments);
      card.append(facts);
      (task.containers || []).forEach((container) => {
        const containerFacts = el('dl', 'ecs-facts ecs-container-facts');
        consoleUi.addField(containerFacts, 'Container', container.name);
        consoleUi.addField(containerFacts, 'Image', container.image);
        consoleUi.addField(containerFacts, 'Status', container.lastStatus);
        consoleUi.addField(containerFacts, 'Exit code', container.exitCode);
        consoleUi.addField(containerFacts, 'Reason', container.reason);
        consoleUi.addField(containerFacts, 'Network bindings', container.networkBindings);
        consoleUi.addField(containerFacts, 'Network interfaces', container.networkInterfaces);
        card.append(containerFacts);
        const repository = imageRepository(container.image);
        if (repository) card.append(resourceLink(`Open ECR repository: ${repository}`, `/service/ecr/?repository=${encodeURIComponent(repository)}`));
      });
      const actions = el('div', 'ecs-action-row');
      const definition = taskDefinitions().find((item) => taskDefArn(item) === task.taskDefinitionArn);
      if (definition) actions.append(btn('Task definition', 'ecs-btn-secondary', () => { state.selectedTaskDefinitionArn = taskDefArn(definition); state.activeView = 'definitions'; render(); }));
      if (task.lastStatus !== 'STOPPED') actions.append(btn(task.protection?.protectionEnabled ? 'Edit protection' : 'Protect', 'ecs-btn-secondary', () => showTaskProtectionModal(cluster, task)));
      if (task.lastStatus !== 'STOPPED') actions.append(btn('Stop task', 'ecs-btn-danger', () => stopTask(cluster, task).catch((error) => toast(error.message, true))));
      actions.append(btn('Tags', 'ecs-btn-secondary', () => showTagsModal(taskArn(task))));
      card.append(actions);
      body.append(card);
    });
    if (!tasks.length) {
      body.append(el('p', 'ecs-empty', serviceFilter ? 'No tasks match this service.' : 'No tasks match the current filter.'));
    }
    panel.append(body);
    return panel;
  }

  function renderServicesPanel(cluster) {
    const panel = el('section', 'ecs-panel');
    const services = (cluster.services || []).filter((service) => matchesQuery(serviceName(service), serviceArn(service), service.taskDefinition, service.loadBalancers));
    panel.append(el('div', 'ecs-panel-heading', `Services (${services.length})`));
    const body = el('div', 'ecs-definition-layout');
    const list = el('div', 'ecs-definition-list');
    services.forEach((service) => {
      list.append(btn(`${serviceName(service)} · ${service.status || 'Unknown'}`, serviceArn(service) === serviceArn(selectedService(cluster)) ? 'ecs-btn-active' : 'ecs-btn-secondary', () => {
        state.selectedServiceArn = serviceArn(service);
        render();
      }));
    });
    const detail = el('div', 'ecs-definition-detail');
    const service = services.find((item) => serviceArn(item) === state.selectedServiceArn) || services[0] || null;
    if (service) {
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
      consoleUi.addField(facts, 'Capacity provider strategy', service.capacityProviderStrategy);
      consoleUi.addField(facts, 'Network configuration', service.networkConfiguration);
      consoleUi.addField(facts, 'Load balancers', service.loadBalancers);
      consoleUi.addField(facts, 'Deployment configuration', service.deploymentConfiguration);
      consoleUi.addField(facts, 'Health check grace period', service.healthCheckGracePeriodSeconds);
      consoleUi.addField(facts, 'Placement constraints', service.placementConstraints);
      consoleUi.addField(facts, 'Placement strategy', service.placementStrategy);
      consoleUi.addField(facts, 'Execute command', service.enableExecuteCommand);
      consoleUi.addField(facts, 'Scheduling strategy', service.schedulingStrategy);
      consoleUi.addField(facts, 'Platform version', service.platformVersion);
      consoleUi.addField(facts, 'Created', service.createdAt);
      consoleUi.addField(facts, 'Events', (service.events || []).slice(0, 10));
      card.append(facts);
      const actions = el('div', 'ecs-action-row');
      const definition = taskDefinitions().find((item) => taskDefArn(item) === service.taskDefinition);
      actions.append(
        btn('Update', null, () => showUpdateServiceModal(cluster, service)),
        btn('View tasks', 'ecs-btn-secondary', () => { state.taskServiceFilter = serviceName(service); state.activeView = 'tasks'; render(); }),
        btn('Tags', 'ecs-btn-secondary', () => showTagsModal(service.serviceArn)),
        btn('Delete', 'ecs-btn-danger', () => deleteService(cluster, service).catch((error) => toast(error.message, true))),
      );
      if (definition) actions.insertBefore(btn('Task definition', 'ecs-btn-secondary', () => { state.selectedTaskDefinitionArn = taskDefArn(definition); state.activeView = 'definitions'; render(); }), actions.children[2]);
      card.append(actions);
      detail.append(card);
    }
    if (!services.length) {
      detail.append(el('p', 'ecs-empty', 'No services match the current filter.'));
    }
    body.append(list, detail);
    panel.append(body);
    return panel;
  }

  function renderDeploymentsPanel(cluster) {
    const panel = el('section', 'ecs-panel');
    panel.append(el('div', 'ecs-panel-heading', 'Deployments and task sets'));
    const body = el('div', 'ecs-card-list');
    (cluster.services || []).forEach((service) => {
      (service.deployments || []).forEach((deployment) => {
        const card = el('article', 'ecs-card');
        card.append(el('h3', null, `${serviceName(service)} · ${deployment.status || 'deployment'}`));
        const facts = el('dl', 'ecs-facts');
        [['Task definition', deployment.taskDefinition], ['Desired', deployment.desiredCount], ['Pending', deployment.pendingCount], ['Running', deployment.runningCount], ['Rollout', deployment.rolloutState], ['Reason', deployment.rolloutStateReason], ['Created', deployment.createdAt], ['Updated', deployment.updatedAt]].forEach(([label, value]) => consoleUi.addField(facts, label, value));
        card.append(facts); body.append(card);
      });
    });
    (cluster.task_sets || []).forEach((taskSet) => {
      const card = el('article', 'ecs-card');
      card.append(el('h3', null, `Task set · ${taskSet.status || taskSet.id || ''}`));
      const facts = el('dl', 'ecs-facts');
      [['ARN', taskSet.taskSetArn], ['Service', taskSet.serviceArn], ['Task definition', taskSet.taskDefinition], ['Scale', taskSet.scale], ['Running', taskSet.runningCount], ['Pending', taskSet.pendingCount], ['Stability', taskSet.stabilityStatus]].forEach(([label, value]) => consoleUi.addField(facts, label, value));
      card.append(facts); body.append(card);
    });
    (cluster.service_deployments || []).forEach((deployment) => {
      const pre = el('pre', 'ecs-result', JSON.stringify(consoleUi.displayValue(deployment), null, 2)); body.append(pre);
    });
    if (!body.childNodes.length) body.append(el('p', 'ecs-empty', 'No deployments or task sets found.'));
    panel.append(body); return panel;
  }

  function renderInfrastructurePanel(cluster) {
    const panel = el('section', 'ecs-panel');
    panel.append(el('div', 'ecs-panel-heading', 'Container infrastructure'));
    const body = el('div', 'ecs-card-list');
    (cluster.container_instances || []).forEach((instance) => {
      const card = el('article', 'ecs-card');
      card.append(el('h3', null, instance.ec2InstanceId || instance.containerInstanceArn || 'Container instance'));
      const facts = el('dl', 'ecs-facts');
      [['Status', instance.status], ['Agent connected', instance.agentConnected], ['Running tasks', instance.runningTasksCount], ['Pending tasks', instance.pendingTasksCount], ['Attributes', instance.attributes], ['Resources', instance.remainingResources], ['Health', instance.healthStatus]].forEach(([label, value]) => consoleUi.addField(facts, label, value));
      const actions = el('div', 'ecs-action-row');
      if (instance.status !== 'DRAINING') actions.append(btn('Drain', 'ecs-btn-danger', () => updateContainerInstanceState(cluster, instance, 'DRAINING').catch((error) => toast(error.message, true))));
      if (instance.status !== 'ACTIVE') actions.append(btn('Activate', 'ecs-btn-secondary', () => updateContainerInstanceState(cluster, instance, 'ACTIVE').catch((error) => toast(error.message, true))));
      card.append(facts, actions); body.append(card);
    });
    const globals = el('dl', 'ecs-facts');
    consoleUi.addField(globals, 'Capacity providers', state.inventory?.capacity_providers);
    consoleUi.addField(globals, 'Account settings', state.inventory?.account_settings);
    consoleUi.addField(globals, 'Attributes', state.inventory?.attributes);
    body.append(globals); panel.append(body); return panel;
  }

  function renderResourceTabs() {
    const tabs = el('div', 'ecs-resource-tabs');
    const navigation = el('div', 'ecs-resource-tab-buttons');
    [['overview', 'Overview'], ['services', 'Services'], ['tasks', 'Tasks'], ['definitions', 'Task definitions'], ['deployments', 'Deployments'], ['infrastructure', 'Infrastructure']].forEach(([key, label]) => {
      navigation.append(btn(label, state.activeView === key ? 'ecs-btn-active' : 'ecs-btn-secondary', () => { state.activeView = key; render(); }));
    });
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Filter current resources';
    search.value = state.resourceQuery;
    search.setAttribute('aria-label', 'Filter current ECS resources');
    search.addEventListener('input', () => { state.resourceQuery = search.value; });
    search.addEventListener('change', render);
    search.addEventListener('keydown', (event) => { if (event.key === 'Enter') render(); });
    tabs.append(navigation, search);
    return tabs;
  }

  function renderTaskDefinitionsPanel() {
    const panel = el('section', 'ecs-panel');
    const heading = el('div', 'ecs-panel-heading');
    heading.append(el('span', null, `Task definitions (${taskDefinitions().length})`), btn('Register', 'ecs-btn-secondary', () => showRegisterTaskDefinitionModal()));
    panel.append(heading);
    const body = el('div', 'ecs-definition-layout');
    const list = el('div', 'ecs-definition-list');
    (state.inventory?.task_definition_groups || []).forEach((group) => {
      const revisions = (group.revisions || []).filter((definition) => matchesQuery(group.family, definition.name, definition.status, definition.containers));
      if (!revisions.length) return;
      list.append(el('strong', 'ecs-definition-family', group.family));
      revisions.forEach((definition) => {
        const row = btn(`${definition.family}:${definition.revision} · ${definition.status}`, taskDefArn(definition) === taskDefArn(selectedTaskDefinition()) ? 'ecs-btn-active' : 'ecs-btn-secondary', () => {
          state.selectedTaskDefinitionArn = taskDefArn(definition); render();
        });
        list.append(row);
      });
    });
    const detail = el('div', 'ecs-definition-detail');
    const definition = selectedTaskDefinition();
    if (definition) {
      const card = el('article', 'ecs-card');
      card.append(el('h3', null, definition.name || taskDefArn(definition)));
      const facts = el('dl', 'ecs-facts');
      consoleUi.addField(facts, 'ARN', taskDefArn(definition));
      consoleUi.addField(facts, 'Status', definition.status);
      consoleUi.addField(facts, 'Network mode', definition.network_mode);
      consoleUi.addField(facts, 'CPU', definition.cpu);
      consoleUi.addField(facts, 'Memory', definition.memory);
      consoleUi.addField(facts, 'Task role', definition.task_role_arn);
      consoleUi.addField(facts, 'Execution role', definition.execution_role_arn);
      consoleUi.addField(facts, 'Runtime platform', definition.runtime_platform);
      consoleUi.addField(facts, 'Volumes', definition.volumes);
      consoleUi.addField(facts, 'Placement constraints', definition.placement_constraints);
      const relatedServices = clusters().flatMap((cluster) => (cluster.services || []).filter((service) => service.taskDefinition === taskDefArn(definition)).map((service) => `${clusterName(cluster)} / ${serviceName(service)}`));
      const relatedTasks = clusters().flatMap((cluster) => (cluster.tasks || []).filter((task) => task.taskDefinitionArn === taskDefArn(definition)).map((task) => taskArn(task)));
      consoleUi.addField(facts, 'Related services', relatedServices);
      consoleUi.addField(facts, 'Related tasks', relatedTasks);
      card.append(facts);
      if (definition.task_role_arn) card.append(resourceLink('Open task role in IAM', `/service/iam/?resource=${encodeURIComponent(definition.task_role_arn)}`));
      if (definition.execution_role_arn) card.append(resourceLink('Open execution role in IAM', `/service/iam/?resource=${encodeURIComponent(definition.execution_role_arn)}`));
      (definition.containers || []).forEach((container) => {
        const containerFacts = el('dl', 'ecs-facts ecs-container-facts');
        [['Container', container.name], ['Image', container.image], ['Command', container.command], ['Entry point', container.entry_point], ['Ports', container.port_mappings], ['Environment', container.environment], ['Secrets', container.secrets], ['Mounts', container.mount_points], ['Health check', container.health_check], ['Logging', container.log_configuration], ['Dependencies', container.depends_on]].forEach(([label, value]) => consoleUi.addField(containerFacts, label, value));
        card.append(containerFacts);
        const logGroup = container.log_configuration?.options?.['awslogs-group'];
        if (logGroup) {
          const link = el('a', 'ecs-log-link', `Open logs: ${logGroup}`);
          link.href = `/service/cloudwatch/?logGroup=${encodeURIComponent(logGroup)}`;
          card.append(link);
        }
        const repository = imageRepository(container.image);
        if (repository) card.append(resourceLink(`Open ECR repository: ${repository}`, `/service/ecr/?repository=${encodeURIComponent(repository)}`));
      });
      const actions = el('div', 'ecs-action-row');
      actions.append(btn('Run task', null, () => showRunTaskModal(selectedCluster(), definition)), btn('Clone revision', 'ecs-btn-secondary', () => showRegisterTaskDefinitionModal(definition)), btn('Tags', 'ecs-btn-secondary', () => showTagsModal(taskDefArn(definition))));
      if (definition.status === 'ACTIVE') {
        actions.append(btn('Deregister', 'ecs-btn-danger', async () => {
          if (!window.confirm(`Deregister ${definition.name}?`)) return;
          await apiJson('/api/ecs/task-definitions/detail/', { method: 'POST', body: JSON.stringify({ task_definition: taskDefArn(definition) }) }); await refresh();
        }));
      } else {
        actions.append(btn('Delete permanently', 'ecs-btn-danger', async () => {
          if (!window.confirm(`Permanently delete ${definition.name}?`)) return;
          state.selectedTaskDefinitionArn = '';
          await apiJson('/api/ecs/task-definitions/detail/', { method: 'DELETE', body: JSON.stringify({ task_definitions: [taskDefArn(definition)] }) }); await refresh();
        }));
      }
      card.append(actions); detail.append(card);
    }
    if (!taskDefinitions().length) {
      detail.append(el('p', 'ecs-empty', 'No task definitions registered.'));
    }
    body.append(list, detail);
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
    detail.append(renderResourceTabs());
    if (state.activeView === 'definitions') {
      detail.append(renderTaskDefinitionsPanel());
    } else if (!cluster) {
      detail.append(el('section', 'ecs-panel ecs-empty-panel', 'Create a cluster to start testing local container workloads.'));
    } else {
      if (state.activeView === 'overview') detail.append(renderClusterDetail(cluster));
      if (state.activeView === 'services') detail.append(renderServicesPanel(cluster));
      if (state.activeView === 'tasks') detail.append(renderTasksPanel(cluster));
      if (state.activeView === 'deployments') detail.append(renderDeploymentsPanel(cluster));
      if (state.activeView === 'infrastructure') detail.append(renderInfrastructurePanel(cluster));
    }
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
