/* global ServiceConsole */

const ElastiCacheConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('elasticache-console-root');
  const breadcrumbsEl = document.getElementById('elasticache-breadcrumbs');
  const summaryEl = document.getElementById('elasticache-summary');
  const loadedAtEl = document.getElementById('elasticache-loaded-at');

  const state = {
    inventory: null,
    selectedGroupId: '',
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'elasticache',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'elasticache');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'elasticache',
      toast,
    });

  function replicationGroups() {
    return state.inventory?.replication_groups || [];
  }

  function users() {
    return state.inventory?.users || [];
  }

  function groupId(group) {
    return group?.name || group?.ReplicationGroupId || '';
  }

  function selectedGroup() {
    return replicationGroups().find((group) => groupId(group) === state.selectedGroupId) || replicationGroups()[0] || null;
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

  function primaryEndpoint(group) {
    const nodeGroup = Array.isArray(group?.node_groups) ? group.node_groups[0] : null;
    return nodeGroup?.PrimaryEndpoint || group?.configuration_endpoint || null;
  }

  function endpointText(endpoint) {
    if (!endpoint) {
      return '';
    }
    const address = endpoint.Address || endpoint.address || 'localhost';
    const port = endpoint.Port || endpoint.port || '';
    return port ? `${address}:${port}` : address;
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'elasticache',
      targets: {
        cache_clusters: 'Cache clusters',
        replication_groups: 'Replication groups',
        serverless_caches: 'Serverless caches',
        subnet_groups: 'Subnet groups',
        parameter_groups: 'Parameter groups',
        snapshots: 'Snapshots',
        users: 'Users',
        user_groups: 'User groups',
        global_replication_groups: 'Global replication groups',
        events: 'Recent events',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('ElastiCache', null, () => {
      state.selectedGroupId = replicationGroups()[0] ? groupId(replicationGroups()[0]) : '';
      render();
    }));
    const group = selectedGroup();
    if (group) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, groupId(group)));
    }
  }

  function showCreateReplicationGroupModal() {
    const form = el('div', 'elasticache-modal-form');
    const idInput = document.createElement('input');
    idInput.placeholder = 'my-cache';
    const descriptionInput = document.createElement('input');
    descriptionInput.value = 'Dev cache';
    const engineSelect = document.createElement('select');
    ['redis', 'valkey'].forEach((value) => option(engineSelect, value, value));
    const nodeTypeInput = document.createElement('input');
    nodeTypeInput.placeholder = 'cache.t4g.micro';
    const countInput = document.createElement('input');
    countInput.type = 'number';
    countInput.min = '1';
    countInput.value = '1';
    const portInput = document.createElement('input');
    portInput.type = 'number';
    portInput.placeholder = '6379';
    const userGroupsInput = document.createElement('input');
    userGroupsInput.placeholder = 'user-group-1,user-group-2';
    const transitWrap = el('label', 'elasticache-checkbox');
    const transitInput = document.createElement('input');
    transitInput.type = 'checkbox';
    transitWrap.append(transitInput, el('span', null, 'Transit encryption'));
    const atRestWrap = el('label', 'elasticache-checkbox');
    const atRestInput = document.createElement('input');
    atRestInput.type = 'checkbox';
    atRestWrap.append(atRestInput, el('span', null, 'At-rest encryption'));
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{"env":"local","team":"platform"}';
    form.append(
      el('label', null, 'Replication group ID'),
      idInput,
      el('label', null, 'Description'),
      descriptionInput,
      el('label', null, 'Engine'),
      engineSelect,
      el('label', null, 'Cache node type'),
      nodeTypeInput,
      el('label', null, 'Cache cluster count'),
      countInput,
      el('label', null, 'Port'),
      portInput,
      el('label', null, 'User group IDs'),
      userGroupsInput,
      transitWrap,
      atRestWrap,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Create replication group', form, 'Create', async (close) => {
      const data = await apiJson('/api/elasticache/replication-groups/', {
        method: 'POST',
        body: JSON.stringify({
          replication_group_id: idInput.value.trim(),
          description: descriptionInput.value.trim(),
          engine: engineSelect.value,
          cache_node_type: nodeTypeInput.value.trim(),
          num_cache_clusters: Number(countInput.value || 1),
          port: portInput.value,
          user_group_ids: parseList(userGroupsInput.value),
          transit_encryption_enabled: transitInput.checked,
          at_rest_encryption_enabled: atRestInput.checked,
          tags: parseJson(tagsInput.value, [], 'Tags'),
        }),
      });
      state.selectedGroupId = data.replication_group_id || idInput.value.trim();
      state.lastResult = data;
      close();
      toast('Replication group created');
      await refresh();
    });
  }

  function showCreateUserModal() {
    const form = el('div', 'elasticache-modal-form');
    const userIdInput = document.createElement('input');
    userIdInput.placeholder = 'alice';
    const userNameInput = document.createElement('input');
    userNameInput.placeholder = 'alice';
    const engineSelect = document.createElement('select');
    ['redis', 'valkey'].forEach((value) => option(engineSelect, value, value));
    const accessInput = document.createElement('textarea');
    accessInput.value = 'on ~* +@all';
    const authSelect = document.createElement('select');
    ['iam', 'password', 'no-password', ''].forEach((value) => option(authSelect, value, value || 'custom/none'));
    const passwordsInput = document.createElement('input');
    passwordsInput.placeholder = 'optional-password-1,optional-password-2';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{"env":"local"}';
    form.append(
      el('label', null, 'User ID'),
      userIdInput,
      el('label', null, 'User name'),
      userNameInput,
      el('label', null, 'Engine'),
      engineSelect,
      el('label', null, 'Access string'),
      accessInput,
      el('label', null, 'Auth type'),
      authSelect,
      el('label', null, 'Passwords'),
      passwordsInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Create user', form, 'Create', async (close) => {
      const data = await apiJson('/api/elasticache/users/', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userIdInput.value.trim(),
          user_name: userNameInput.value.trim(),
          engine: engineSelect.value,
          access_string: accessInput.value.trim(),
          auth_type: authSelect.value,
          passwords: parseList(passwordsInput.value),
          tags: parseJson(tagsInput.value, [], 'Tags'),
        }),
      });
      state.lastResult = data;
      close();
      toast('User created');
      await refresh();
    });
  }

  function showModifyUserModal(user) {
    const form = el('div', 'elasticache-modal-form');
    const userIdInput = document.createElement('input');
    userIdInput.value = user?.UserId || '';
    const accessInput = document.createElement('textarea');
    accessInput.value = user?.AccessString || '';
    const appendInput = document.createElement('input');
    appendInput.placeholder = '+@read';
    const authSelect = document.createElement('select');
    ['', 'iam', 'password', 'no-password'].forEach((value) => option(authSelect, value, value || 'Keep current auth'));
    const passwordsInput = document.createElement('input');
    passwordsInput.placeholder = 'optional-password-1,optional-password-2';
    const noPasswordWrap = el('label', 'elasticache-checkbox');
    const noPasswordInput = document.createElement('input');
    noPasswordInput.type = 'checkbox';
    noPasswordWrap.append(noPasswordInput, el('span', null, 'No password required'));
    form.append(
      el('label', null, 'User ID'),
      userIdInput,
      el('label', null, 'Access string'),
      accessInput,
      el('label', null, 'Append access string'),
      appendInput,
      el('label', null, 'Auth type'),
      authSelect,
      el('label', null, 'Passwords'),
      passwordsInput,
      noPasswordWrap,
    );
    openModal('Modify user', form, 'Save', async (close) => {
      const data = await apiJson('/api/elasticache/users/modify/', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userIdInput.value.trim(),
          access_string: accessInput.value.trim(),
          append_access_string: appendInput.value.trim(),
          auth_type: authSelect.value,
          passwords: parseList(passwordsInput.value),
          no_password_required: noPasswordInput.checked ? true : null,
        }),
      });
      state.lastResult = data;
      close();
      toast('User modified');
      await refresh();
    });
  }

  function showValidateTokenModal(user = null) {
    const form = el('div', 'elasticache-modal-form');
    const tokenInput = document.createElement('textarea');
    tokenInput.placeholder = 'IAM auth token';
    const userIdInput = document.createElement('input');
    userIdInput.value = user?.UserId || '';
    const userNameInput = document.createElement('input');
    userNameInput.value = user?.UserName || '';
    form.append(
      el('label', null, 'Auth token'),
      tokenInput,
      el('label', null, 'User ID'),
      userIdInput,
      el('label', null, 'User name'),
      userNameInput,
    );
    openModal('Validate IAM auth token', form, 'Validate', async (close) => {
      const data = await apiJson('/api/elasticache/iam-auth/validate/', {
        method: 'POST',
        body: JSON.stringify({
          auth_token: tokenInput.value.trim(),
          user_id: userIdInput.value.trim(),
          user_name: userNameInput.value.trim(),
        }),
      });
      state.lastResult = data;
      close();
      toast('Token validation complete');
      render();
    });
  }

  async function deleteReplicationGroup(group) {
    if (!window.confirm('Delete this replication group and stop its local cache container?')) {
      return;
    }
    const data = await apiJson('/api/elasticache/replication-groups/delete/', {
      method: 'POST',
      body: JSON.stringify({ replication_group_id: groupId(group) }),
    });
    state.lastResult = data;
    state.selectedGroupId = '';
    toast('Replication group deleted');
    await refresh();
  }

  async function deleteUser(user) {
    if (!window.confirm('Delete this ElastiCache user?')) {
      return;
    }
    const data = await apiJson('/api/elasticache/users/delete/', {
      method: 'POST',
      body: JSON.stringify({ user_id: user.UserId }),
    });
    state.lastResult = data;
    toast('User deleted');
    await refresh();
  }

  function renderGroupList() {
    const panel = el('section', 'elasticache-panel');
    panel.append(el('div', 'elasticache-panel-heading', 'Replication groups'));
    const list = el('div', 'elasticache-group-list');
    if (!replicationGroups().length) {
      list.append(el('div', 'elasticache-empty', 'No replication groups found.'));
    } else {
      replicationGroups().forEach((group) => {
        const endpoint = endpointText(primaryEndpoint(group));
        const active = groupId(group) === groupId(selectedGroup());
        const row = el('button', `elasticache-group-row${active ? ' elasticache-group-row-active' : ''}`);
        row.append(
          el('span', 'elasticache-group-name', groupId(group)),
          el('span', 'elasticache-group-meta', `${group.status || 'Unknown'}${endpoint ? ` / ${endpoint}` : ''}`),
        );
        row.addEventListener('click', () => {
          state.selectedGroupId = groupId(group);
          render();
        });
        list.append(row);
      });
    }
    panel.append(list);
    return panel;
  }

  function renderGroupDetail(group) {
    const panel = el('section', 'elasticache-panel');
    panel.append(el('div', 'elasticache-panel-heading', 'Selected replication group'));
    const body = el('div', 'elasticache-detail');
    const facts = el('dl', 'elasticache-facts');
    const endpoint = primaryEndpoint(group);
    consoleUi.addField(facts, 'Replication group', groupId(group));
    consoleUi.addField(facts, 'Status', group.status);
    consoleUi.addField(facts, 'Description', group.description);
    consoleUi.addField(facts, 'Primary endpoint', endpoint);
    consoleUi.addField(facts, 'Member clusters', group.member_clusters);
    consoleUi.addField(facts, 'Node groups', group.node_groups);
    consoleUi.addField(facts, 'User group IDs', group.user_group_ids);
    consoleUi.addField(facts, 'Transit encryption', group.transit_encryption_enabled);
    consoleUi.addField(facts, 'Auth token enabled', group.auth_token_enabled);
    body.append(facts);
    if (endpointText(endpoint)) {
      const snippet = el('pre', 'elasticache-code');
      snippet.textContent = `redis-cli -h localhost -p ${endpoint.Port || endpoint.port || 6379} ping`;
      body.append(snippet);
    }
    const actions = el('div', 'elasticache-action-row');
    actions.append(
      btn('Validate token', 'elasticache-btn-secondary', () => showValidateTokenModal()),
      btn('Delete group', 'elasticache-btn-danger', () => deleteReplicationGroup(group).catch((error) => toast(error.message, true))),
    );
    body.append(actions);
    panel.append(body);
    return panel;
  }

  function renderUsersPanel() {
    const panel = el('section', 'elasticache-panel');
    panel.append(el('div', 'elasticache-panel-heading', `Users (${users().length})`));
    const body = el('div', 'elasticache-card-list');
    users().forEach((user) => {
      const card = el('article', 'elasticache-card');
      card.append(el('h3', null, user.UserId || user.UserName || 'User'));
      const facts = el('dl', 'elasticache-facts');
      consoleUi.addField(facts, 'User name', user.UserName);
      consoleUi.addField(facts, 'Status', user.Status);
      consoleUi.addField(facts, 'Engine', user.Engine);
      consoleUi.addField(facts, 'Access string', user.AccessString);
      consoleUi.addField(facts, 'Authentication', user.Authentication);
      consoleUi.addField(facts, 'User groups', user.UserGroupIds);
      card.append(facts);
      const actions = el('div', 'elasticache-action-row');
      actions.append(
        btn('Modify', null, () => showModifyUserModal(user)),
        btn('Validate token', 'elasticache-btn-secondary', () => showValidateTokenModal(user)),
        btn('Delete', 'elasticache-btn-danger', () => deleteUser(user).catch((error) => toast(error.message, true))),
      );
      card.append(actions);
      body.append(card);
    });
    if (!users().length) {
      body.append(el('p', 'elasticache-empty', 'No ElastiCache users found.'));
    }
    panel.append(body);
    return panel;
  }

  function renderResult() {
    if (!state.lastResult) {
      return null;
    }
    const panel = el('section', 'elasticache-panel');
    panel.append(el('div', 'elasticache-panel-heading', 'Last action result'));
    const pre = el('pre', 'elasticache-result');
    pre.textContent = JSON.stringify(consoleUi.displayValue(state.lastResult), null, 2);
    panel.append(pre);
    return panel;
  }

  function renderWorkbench() {
    const workbench = el('div', 'elasticache-workbench');
    const group = selectedGroup();
    workbench.append(renderGroupList());
    const detail = el('div', 'elasticache-detail-stack');
    if (!group) {
      detail.append(el('section', 'elasticache-panel elasticache-empty-panel', 'Create a replication group to start a local Redis or Valkey container.'));
    } else {
      detail.append(renderGroupDetail(group));
    }
    detail.append(renderUsersPanel());
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
        btn('Create replication group', null, showCreateReplicationGroupModal),
        btn('Create user', 'elasticache-btn-secondary', showCreateUserModal),
        btn('Validate token', 'elasticache-btn-secondary', () => showValidateTokenModal()),
      ],
      [el('span', 'elasticache-toolbar-note', 'Local Redis/Valkey containers, proxy endpoints, and IAM users')],
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
    const data = await apiJson('/api/elasticache/');
    state.inventory = data;
    if (!state.selectedGroupId && replicationGroups()[0]) {
      state.selectedGroupId = groupId(replicationGroups()[0]);
    }
    render();
  }

  return { refresh };
})();

window.ElastiCacheConsole = ElastiCacheConsole;
