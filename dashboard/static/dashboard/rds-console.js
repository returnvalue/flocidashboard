/* global ServiceConsole */

const RDSConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('rds-console-root');
  const breadcrumbsEl = document.getElementById('rds-breadcrumbs');
  const summaryEl = document.getElementById('rds-summary');
  const loadedAtEl = document.getElementById('rds-loaded-at');

  const state = {
    inventory: null,
    selectedInstanceId: '',
    selectedClusterId: '',
    selectedParameterGroup: '',
    lastAction: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'rds',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'rds');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'rds',
      toast,
    });

  function instances() {
    return state.inventory?.instances || [];
  }

  function clusters() {
    return state.inventory?.clusters || [];
  }

  function parameterGroups() {
    return state.inventory?.parameter_groups || [];
  }

  function engines() {
    return state.inventory?.supported_engines || [];
  }

  function selectedInstance() {
    return instances().find((instance) => instance.name === state.selectedInstanceId) || instances()[0] || null;
  }

  function selectedCluster() {
    return clusters().find((cluster) => cluster.name === state.selectedClusterId) || clusters()[0] || null;
  }

  function selectedParameterGroup() {
    return parameterGroups().find((group) => group.name === state.selectedParameterGroup) || parameterGroups()[0] || null;
  }

  function enc(value) {
    return encodeURIComponent(value || '');
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'rds',
      targets: {
        instances: 'Instances',
        clusters: 'Clusters',
        parameter_groups: 'Parameter groups',
        available_instances: 'Instances',
        proxy_endpoints: 'Instances',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = btn('Amazon RDS', null, () => {
      state.selectedInstanceId = '';
      state.selectedClusterId = '';
      state.selectedParameterGroup = '';
      render();
    });
    breadcrumbsEl.append(home);
    const instance = selectedInstance();
    if (instance) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, instance.name || 'Instance'));
    }
  }

  function option(select, value, label, selected = false) {
    const node = document.createElement('option');
    node.value = value || '';
    node.textContent = label || value || '';
    node.selected = selected;
    select.append(node);
  }

  function engineSelect(defaultEngine = 'postgres') {
    const select = document.createElement('select');
    const known = new Set();
    engines().forEach((engine) => {
      known.add(engine.name);
      option(select, engine.name, `${engine.name} (${engine.default_image})`, engine.name === defaultEngine);
    });
    ['postgres', 'mysql', 'mariadb'].forEach((engine) => {
      if (!known.has(engine)) {
        option(select, engine, engine, engine === defaultEngine);
      }
    });
    return select;
  }

  function checkbox(label, checked = false) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    const wrapper = el('label', 'rds-checkbox');
    wrapper.append(input, el('span', null, label));
    return { wrapper, input };
  }

  function showCreateInstanceModal() {
    const form = el('div');
    const idInput = document.createElement('input');
    idInput.placeholder = 'mypostgres';
    const engineInput = engineSelect('postgres');
    const classInput = document.createElement('input');
    classInput.value = 'db.t3.micro';
    const usernameInput = document.createElement('input');
    usernameInput.value = 'admin';
    const passwordInput = document.createElement('input');
    passwordInput.placeholder = 'secret123';
    const storageInput = document.createElement('input');
    storageInput.type = 'number';
    storageInput.value = '20';
    const dbNameInput = document.createElement('input');
    dbNameInput.placeholder = 'appdb';
    const versionInput = document.createElement('input');
    versionInput.placeholder = 'optional image or version';
    const iam = checkbox('Enable IAM database authentication', false);
    form.append(
      el('label', null, 'DB instance identifier'),
      idInput,
      el('label', null, 'Engine'),
      engineInput,
      el('label', null, 'DB instance class'),
      classInput,
      el('label', null, 'Master username'),
      usernameInput,
      el('label', null, 'Master user password'),
      passwordInput,
      el('label', null, 'Allocated storage GB'),
      storageInput,
      el('label', null, 'Database name'),
      dbNameInput,
      el('label', null, 'Engine version / image override'),
      versionInput,
      iam.wrapper,
    );
    openModal('Create DB instance', form, 'Create', async (close) => {
      const data = await apiJson('/api/rds/instances/', {
        method: 'POST',
        body: JSON.stringify({
          identifier: idInput.value.trim(),
          engine: engineInput.value,
          db_instance_class: classInput.value.trim(),
          username: usernameInput.value.trim(),
          password: passwordInput.value,
          allocated_storage: Number(storageInput.value || 20),
          db_name: dbNameInput.value.trim(),
          engine_version: versionInput.value.trim(),
          enable_iam_auth: iam.input.checked,
        }),
      });
      close();
      toast('DB instance create started');
      state.selectedInstanceId = data.identifier || idInput.value.trim();
      await refresh();
    });
  }

  function showModifyInstanceModal(instance) {
    const form = el('div');
    const classInput = document.createElement('input');
    classInput.value = instance.class || '';
    const storageInput = document.createElement('input');
    storageInput.type = 'number';
    storageInput.value = instance.allocated_storage || '';
    const passwordInput = document.createElement('input');
    passwordInput.placeholder = 'optional new master password';
    const apply = checkbox('Apply immediately', true);
    form.append(
      el('label', null, 'DB instance'),
      el('pre', 'rds-code-block', instance.name),
      el('label', null, 'DB instance class'),
      classInput,
      el('label', null, 'Allocated storage GB'),
      storageInput,
      el('label', null, 'New master password'),
      passwordInput,
      apply.wrapper,
    );
    openModal('Modify DB instance', form, 'Modify', async (close) => {
      await apiJson(`/api/rds/instances/${enc(instance.name)}/`, {
        method: 'PUT',
        body: JSON.stringify({
          db_instance_class: classInput.value.trim(),
          allocated_storage: storageInput.value ? Number(storageInput.value) : null,
          master_user_password: passwordInput.value,
          apply_immediately: apply.input.checked,
        }),
      });
      close();
      toast('DB instance modified');
      await refresh();
    });
  }

  function showRebootInstanceModal(instance) {
    const body = el('div');
    body.append(el('p', null, 'Reboot this local database container?'), el('pre', 'rds-code-block', instance.name));
    openModal('Reboot DB instance', body, 'Reboot', async (close) => {
      await apiJson(`/api/rds/instances/${enc(instance.name)}/reboot/`, { method: 'POST' });
      close();
      toast('DB instance reboot started');
      await refresh();
    });
  }

  function showDeleteInstanceModal(instance) {
    const form = el('div');
    const skip = checkbox('Skip final snapshot', true);
    const snapshotInput = document.createElement('input');
    snapshotInput.placeholder = `${instance.name}-final`;
    form.append(
      el('p', 'rds-warning', 'Delete this DB instance and stop its local container?'),
      el('pre', 'rds-code-block', instance.name),
      skip.wrapper,
      el('label', null, 'Final snapshot identifier'),
      snapshotInput,
    );
    openModal('Delete DB instance', form, 'Delete', async (close) => {
      await apiJson(`/api/rds/instances/${enc(instance.name)}/`, {
        method: 'DELETE',
        body: JSON.stringify({
          skip_final_snapshot: skip.input.checked,
          final_snapshot_identifier: snapshotInput.value.trim(),
        }),
      });
      close();
      state.selectedInstanceId = '';
      toast('DB instance delete started');
      await refresh();
    });
  }

  function showCreateClusterModal() {
    const form = el('div');
    const idInput = document.createElement('input');
    idInput.placeholder = 'myaurora';
    const engineInput = engineSelect('postgres');
    const usernameInput = document.createElement('input');
    usernameInput.value = 'admin';
    const passwordInput = document.createElement('input');
    passwordInput.placeholder = 'secret123';
    const dbNameInput = document.createElement('input');
    dbNameInput.placeholder = 'appdb';
    const versionInput = document.createElement('input');
    const iam = checkbox('Enable IAM database authentication', false);
    form.append(
      el('label', null, 'DB cluster identifier'),
      idInput,
      el('label', null, 'Engine'),
      engineInput,
      el('label', null, 'Master username'),
      usernameInput,
      el('label', null, 'Master user password'),
      passwordInput,
      el('label', null, 'Database name'),
      dbNameInput,
      el('label', null, 'Engine version / image override'),
      versionInput,
      iam.wrapper,
    );
    openModal('Create DB cluster', form, 'Create', async (close) => {
      const data = await apiJson('/api/rds/clusters/', {
        method: 'POST',
        body: JSON.stringify({
          identifier: idInput.value.trim(),
          engine: engineInput.value,
          username: usernameInput.value.trim(),
          password: passwordInput.value,
          database_name: dbNameInput.value.trim(),
          engine_version: versionInput.value.trim(),
          enable_iam_auth: iam.input.checked,
        }),
      });
      close();
      toast('DB cluster create started');
      state.selectedClusterId = data.identifier || idInput.value.trim();
      await refresh();
    });
  }

  function showCreateParameterGroupModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'local-postgres';
    const familyInput = document.createElement('input');
    familyInput.value = 'postgres16';
    const descriptionInput = document.createElement('input');
    descriptionInput.placeholder = 'Local PostgreSQL parameters';
    form.append(
      el('label', null, 'Parameter group name'),
      nameInput,
      el('label', null, 'Parameter group family'),
      familyInput,
      el('label', null, 'Description'),
      descriptionInput,
    );
    openModal('Create parameter group', form, 'Create', async (close) => {
      await apiJson('/api/rds/parameter-groups/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          family: familyInput.value.trim(),
          description: descriptionInput.value.trim(),
        }),
      });
      close();
      toast('Parameter group created');
      state.selectedParameterGroup = nameInput.value.trim();
      await refresh();
    });
  }

  function statusClass(status) {
    return `rds-status rds-status-${String(status || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }

  function connectionCommand(instance) {
    const host = instance?.connect_host || 'localhost';
    const port = instance?.connect_port || '<port>';
    const user = instance?.master_username || '<user>';
    if (instance?.engine === 'mysql' || instance?.engine === 'mariadb') {
      return `mysql -h ${host} -P ${port} -u ${user} -p`;
    }
    return `psql -h ${host} -p ${port} -U ${user}${instance?.db_name ? ` -d ${instance.db_name}` : ''}`;
  }

  function renderInstanceRow(instance) {
    const active = instance.name === selectedInstance()?.name;
    const row = el('button', `rds-instance-row${active ? ' rds-instance-row-active' : ''}`);
    row.append(
      el('span', 'rds-instance-name', instance.name || 'DB instance'),
      el('span', statusClass(instance.status), instance.status || 'UNKNOWN'),
      el('span', 'rds-instance-meta', `${instance.engine || 'engine'} / ${instance.connect_host || 'localhost'}:${instance.connect_port || 'pending'}`),
    );
    row.addEventListener('click', () => {
      state.selectedInstanceId = instance.name;
      render();
    });
    return row;
  }

  function renderInstanceList() {
    const panel = el('section', 'rds-panel');
    panel.id = consoleUi.sectionIdForLabel('rds', 'Instances');
    panel.append(el('div', 'rds-panel-heading', 'DB instances'));
    const list = el('div', 'rds-instance-list');
    if (!instances().length) {
      list.append(el('div', 'rds-empty', 'No DB instances found. Create one to get a local proxy endpoint.'));
    } else {
      instances().forEach((instance) => list.append(renderInstanceRow(instance)));
    }
    panel.append(list);
    return panel;
  }

  function renderInstanceDetail(instance) {
    const panel = el('section', 'rds-panel');
    const heading = el('div', 'rds-panel-heading');
    heading.append(el('span', null, instance ? instance.name : 'Instance detail'), el('span', instance ? statusClass(instance.status) : 'rds-instance-meta', instance?.status || ''));
    panel.append(heading);
    if (!instance) {
      panel.append(el('div', 'rds-empty', 'Select or create a DB instance.'));
      return panel;
    }
    const details = document.createElement('dl');
    consoleUi.addField(details, 'Engine', `${instance.engine || ''} ${instance.engine_version || ''}`.trim());
    consoleUi.addField(details, 'Class', instance.class);
    consoleUi.addField(details, 'Storage', instance.allocated_storage ? `${instance.allocated_storage} GB` : null);
    consoleUi.addField(details, 'Master username', instance.master_username);
    consoleUi.addField(details, 'IAM auth', instance.iam_authentication ? 'enabled' : 'disabled');
    consoleUi.addField(details, 'Endpoint', instance.endpoint || {});
    consoleUi.addField(details, 'Created', consoleUi.formatDate(instance.created));
    panel.append(details);
    const connection = el('div', 'rds-connection');
    connection.append(el('h3', null, 'Connect locally'), el('pre', 'rds-code-block', connectionCommand(instance)));
    panel.append(connection);
    return panel;
  }

  function renderClusters() {
    const panel = el('section', 'rds-panel');
    panel.id = consoleUi.sectionIdForLabel('rds', 'Clusters');
    panel.append(el('div', 'rds-panel-heading', 'DB clusters'));
    if (!clusters().length) {
      panel.append(el('div', 'rds-empty rds-empty-compact', 'No DB clusters found.'));
      return panel;
    }
    const list = el('div', 'rds-card-list');
    clusters().forEach((cluster) => {
      const item = el('article', 'rds-card');
      item.append(
        el('strong', null, cluster.name || 'DB cluster'),
        el('span', statusClass(cluster.status), cluster.status || 'UNKNOWN'),
        el('span', 'rds-instance-meta', `${cluster.engine || 'engine'} / ${cluster.endpoint || 'no endpoint'}`),
      );
      list.append(item);
    });
    panel.append(list);
    return panel;
  }

  function renderParameterGroups() {
    const panel = el('section', 'rds-panel');
    panel.id = consoleUi.sectionIdForLabel('rds', 'Parameter groups');
    panel.append(el('div', 'rds-panel-heading', 'Parameter groups'));
    if (!parameterGroups().length) {
      panel.append(el('div', 'rds-empty rds-empty-compact', 'No parameter groups found.'));
      return panel;
    }
    const list = el('div', 'rds-card-list');
    parameterGroups().forEach((group) => {
      const item = el('article', 'rds-card');
      item.append(
        el('strong', null, group.name || 'Parameter group'),
        el('span', 'rds-instance-meta', `${group.family || 'family'} / ${group.parameter_count || 0} parameters`),
        el('span', 'rds-instance-meta', group.description || ''),
      );
      list.append(item);
    });
    panel.append(list);
    return panel;
  }

  function renderEngines() {
    const panel = el('section', 'rds-panel');
    panel.append(el('div', 'rds-panel-heading', 'Supported engines'));
    const list = el('div', 'rds-card-list');
    engines().forEach((engine) => {
      const item = el('article', 'rds-card');
      item.append(el('strong', null, engine.name), el('code', null, engine.default_image));
      list.append(item);
    });
    panel.append(list);
    return panel;
  }

  function renderConfiguration() {
    const panel = el('section', 'rds-panel');
    panel.append(el('div', 'rds-panel-heading', 'Proxy configuration'));
    const details = document.createElement('dl');
    const config = state.inventory?.configuration || {};
    consoleUi.addField(details, 'Proxy ports', `${config.proxy_base_port || 7001}-${config.proxy_max_port || 7099}`);
    consoleUi.addField(details, 'Postgres image', config.default_postgres_image);
    consoleUi.addField(details, 'MySQL image', config.default_mysql_image);
    consoleUi.addField(details, 'MariaDB image', config.default_mariadb_image);
    panel.append(details);
    return panel;
  }

  function renderWorkbench() {
    const instance = selectedInstance();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create instance', null, showCreateInstanceModal),
        btn('Create cluster', null, showCreateClusterModal),
        btn('Parameter group', null, showCreateParameterGroupModal),
      ],
      [
        btn('Modify instance', null, () => instance && showModifyInstanceModal(instance)),
        btn('Reboot instance', null, () => instance && showRebootInstanceModal(instance)),
        btn('Delete instance', 'rds-btn-danger', () => instance && showDeleteInstanceModal(instance)),
      ],
    ));
    Array.from(container.querySelectorAll('.rds-toolbar-right button')).forEach((button) => {
      button.disabled = !instance;
    });

    const workbench = el('div', 'rds-workbench');
    const detail = el('div', 'rds-detail-stack');
    detail.append(
      renderInstanceDetail(instance),
      renderClusters(),
      renderParameterGroups(),
      renderEngines(),
      renderConfiguration(),
    );
    workbench.append(renderInstanceList(), detail);
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
    const data = await apiJson('/api/rds/');
    state.inventory = data;
    if (!selectedInstance() && instances().length) {
      state.selectedInstanceId = instances()[0].name;
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'rds-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.RDSConsole = RDSConsole;

if (document.getElementById('rds-console-root')) {
  RDSConsole.init();
}
