/* global ServiceConsole */

const CognitoConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('cognito-console-root');
  const breadcrumbsEl = document.getElementById('cognito-breadcrumbs');
  const summaryEl = document.getElementById('cognito-summary');
  const loadedAtEl = document.getElementById('cognito-loaded-at');

  const state = {
    inventory: null,
    selectedPoolId: '',
    selectedUser: '',
    selectedGroup: '',
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'cognito',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'cognito');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'cognito',
      toast,
    });

  function pools() {
    return state.inventory?.user_pools || [];
  }

  function selectedPool() {
    return pools().find((pool) => pool.id === state.selectedPoolId) || pools()[0] || null;
  }

  function users(pool = selectedPool()) {
    return pool?.users || [];
  }

  function groups(pool = selectedPool()) {
    return Array.isArray(pool?.groups) ? pool.groups : [];
  }

  function clients(pool = selectedPool()) {
    return pool?.clients || [];
  }

  function resourceServers(pool = selectedPool()) {
    return Array.isArray(pool?.resource_servers) ? pool.resource_servers : [];
  }

  function selectedUser(pool = selectedPool()) {
    return users(pool).find((user) => user.name === state.selectedUser) || users(pool)[0] || null;
  }

  function selectedGroup(pool = selectedPool()) {
    return groups(pool).find((group) => group.GroupName === state.selectedGroup || group.name === state.selectedGroup) || groups(pool)[0] || null;
  }

  function enc(value) {
    return encodeURIComponent(value || '');
  }

  function parseJsonInput(value) {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    return JSON.parse(trimmed);
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'cognito',
      targets: {
        user_pools: 'User pools',
        clients: 'App clients',
        users: 'Users',
        groups: 'Groups',
        resource_servers: 'Resource servers',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = btn('Amazon Cognito', null, () => {
      state.selectedPoolId = '';
      state.selectedUser = '';
      state.selectedGroup = '';
      state.lastResult = null;
      render();
    });
    breadcrumbsEl.append(home);
    const pool = selectedPool();
    if (pool) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, pool.name || pool.id));
    }
  }

  function showJsonModal(title, value) {
    const body = el('div');
    body.append(el('pre', 'cognito-code-block', consoleUi.valueText(value)));
    openModal(title, body, 'Close', (close) => close());
  }

  function showCreatePoolModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'MyApp';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{\n  "floci:override-id": "local-pool"\n}';
    tagsInput.rows = 4;
    form.append(el('label', null, 'Pool name'), nameInput, el('label', null, 'Tags JSON'), tagsInput);
    openModal('Create user pool', form, 'Create', async (close) => {
      const data = await apiJson('/api/cognito/user-pools/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          tags: parseJsonInput(tagsInput.value),
        }),
      });
      close();
      toast('User pool created');
      state.selectedPoolId = data.pool_id || '';
      await refresh();
    });
  }

  function showDeletePoolModal(pool) {
    const body = el('div');
    body.append(el('p', 'cognito-warning', 'Delete this user pool?'), el('pre', 'cognito-code-block', pool.id));
    openModal('Delete user pool', body, 'Delete', async (close) => {
      await apiJson(`/api/cognito/user-pools/${enc(pool.id)}/`, { method: 'DELETE' });
      close();
      state.selectedPoolId = '';
      toast('User pool deleted');
      await refresh();
    });
  }

  function showCreateClientModal(pool) {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'my-client';
    const secretInput = document.createElement('input');
    secretInput.type = 'checkbox';
    secretInput.checked = true;
    const secretLabel = el('label', 'cognito-checkbox');
    secretLabel.append(secretInput, el('span', null, 'Generate secret'));
    const scopesInput = document.createElement('input');
    scopesInput.placeholder = 'notes/read notes/write';
    form.append(el('label', null, 'Client name'), nameInput, secretLabel, el('label', null, 'Allowed OAuth scopes'), scopesInput);
    openModal('Create app client', form, 'Create', async (close) => {
      const data = await apiJson(`/api/cognito/user-pools/${enc(pool.id)}/clients/`, {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          generate_secret: secretInput.checked,
          allowed_oauth_scopes: scopesInput.value.trim().split(/\s+/).filter(Boolean),
        }),
      });
      close();
      toast('App client created');
      state.lastResult = data.client_secret ? data : null;
      await refresh();
    });
  }

  function showCreateResourceServerModal(pool) {
    const form = el('div');
    const identifierInput = document.createElement('input');
    identifierInput.placeholder = 'notes';
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'Notes API';
    const scopesInput = document.createElement('textarea');
    scopesInput.value = JSON.stringify({ read: 'Read notes', write: 'Write notes' }, null, 2);
    scopesInput.rows = 5;
    form.append(
      el('label', null, 'Identifier'),
      identifierInput,
      el('label', null, 'Name'),
      nameInput,
      el('label', null, 'Scopes JSON'),
      scopesInput,
    );
    openModal('Create resource server', form, 'Create', async (close) => {
      await apiJson(`/api/cognito/user-pools/${enc(pool.id)}/resource-servers/`, {
        method: 'POST',
        body: JSON.stringify({
          identifier: identifierInput.value.trim(),
          name: nameInput.value.trim(),
          scopes: parseJsonInput(scopesInput.value),
        }),
      });
      close();
      toast('Resource server created');
      await refresh();
    });
  }

  function showCreateUserModal(pool) {
    const form = el('div');
    const usernameInput = document.createElement('input');
    usernameInput.placeholder = 'alice@example.com';
    const passwordInput = document.createElement('input');
    passwordInput.placeholder = 'Temp1234!';
    const attributesInput = document.createElement('textarea');
    attributesInput.value = JSON.stringify({ email: 'alice@example.com', email_verified: 'true' }, null, 2);
    attributesInput.rows = 5;
    form.append(
      el('label', null, 'Username'),
      usernameInput,
      el('label', null, 'Temporary password'),
      passwordInput,
      el('label', null, 'Attributes JSON'),
      attributesInput,
    );
    openModal('Create user', form, 'Create', async (close) => {
      await apiJson(`/api/cognito/user-pools/${enc(pool.id)}/users/`, {
        method: 'POST',
        body: JSON.stringify({
          username: usernameInput.value.trim(),
          temporary_password: passwordInput.value,
          attributes: parseJsonInput(attributesInput.value),
          message_action: 'SUPPRESS',
        }),
      });
      close();
      toast('User created');
      state.selectedUser = usernameInput.value.trim();
      await refresh();
    });
  }

  function showSetPasswordModal(pool, user = selectedUser(pool)) {
    const form = el('div');
    const usernameInput = document.createElement('input');
    usernameInput.value = user?.name || '';
    const passwordInput = document.createElement('input');
    passwordInput.placeholder = 'Perm1234!';
    const permanentInput = document.createElement('input');
    permanentInput.type = 'checkbox';
    permanentInput.checked = true;
    const permanentLabel = el('label', 'cognito-checkbox');
    permanentLabel.append(permanentInput, el('span', null, 'Permanent password'));
    form.append(el('label', null, 'Username'), usernameInput, el('label', null, 'Password'), passwordInput, permanentLabel);
    openModal('Set user password', form, 'Set password', async (close) => {
      await apiJson(`/api/cognito/user-pools/${enc(pool.id)}/users/${enc(usernameInput.value.trim())}/password/`, {
        method: 'POST',
        body: JSON.stringify({
          password: passwordInput.value,
          permanent: permanentInput.checked,
        }),
      });
      close();
      toast('Password set');
      await refresh();
    });
  }

  function showDeleteUserModal(pool, user) {
    const body = el('div');
    body.append(el('p', 'cognito-warning', 'Delete this user?'), el('pre', 'cognito-code-block', user.name));
    openModal('Delete user', body, 'Delete', async (close) => {
      await apiJson(`/api/cognito/user-pools/${enc(pool.id)}/users/${enc(user.name)}/`, { method: 'DELETE' });
      close();
      state.selectedUser = '';
      toast('User deleted');
      await refresh();
    });
  }

  function showCreateGroupModal(pool) {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'admin';
    const descriptionInput = document.createElement('input');
    descriptionInput.placeholder = 'Admin group';
    form.append(el('label', null, 'Group name'), nameInput, el('label', null, 'Description'), descriptionInput);
    openModal('Create group', form, 'Create', async (close) => {
      await apiJson(`/api/cognito/user-pools/${enc(pool.id)}/groups/`, {
        method: 'POST',
        body: JSON.stringify({ group_name: nameInput.value.trim(), description: descriptionInput.value.trim() }),
      });
      close();
      toast('Group created');
      state.selectedGroup = nameInput.value.trim();
      await refresh();
    });
  }

  function showAddToGroupModal(pool) {
    const form = el('div');
    const usernameInput = document.createElement('input');
    usernameInput.value = selectedUser(pool)?.name || '';
    const groupInput = document.createElement('input');
    groupInput.value = selectedGroup(pool)?.GroupName || selectedGroup(pool)?.name || '';
    form.append(el('label', null, 'Username'), usernameInput, el('label', null, 'Group name'), groupInput);
    openModal('Add user to group', form, 'Add', async (close) => {
      await apiJson(`/api/cognito/user-pools/${enc(pool.id)}/groups/${enc(groupInput.value.trim())}/users/${enc(usernameInput.value.trim())}/`, {
        method: 'POST',
      });
      close();
      toast('User added to group');
      await refresh();
    });
  }

  function showAuthModal(pool) {
    const form = el('div');
    const clientInput = document.createElement('input');
    clientInput.value = clients(pool)[0]?.client_id || '';
    const usernameInput = document.createElement('input');
    usernameInput.value = selectedUser(pool)?.name || '';
    const passwordInput = document.createElement('input');
    passwordInput.placeholder = 'Perm1234!';
    const flowInput = document.createElement('input');
    flowInput.value = 'USER_PASSWORD_AUTH';
    form.append(
      el('label', null, 'Client ID'),
      clientInput,
      el('label', null, 'Username'),
      usernameInput,
      el('label', null, 'Password'),
      passwordInput,
      el('label', null, 'Auth flow'),
      flowInput,
    );
    openModal('Test user auth', form, 'Authenticate', async (close) => {
      const data = await apiJson('/api/cognito/auth/initiate/', {
        method: 'POST',
        body: JSON.stringify({
          client_id: clientInput.value.trim(),
          username: usernameInput.value.trim(),
          password: passwordInput.value,
          auth_flow: flowInput.value.trim(),
        }),
      });
      close();
      toast('Auth request complete');
      state.lastResult = data;
      render();
    });
  }

  function showOAuthModal(pool) {
    const form = el('div');
    const clientInput = document.createElement('input');
    clientInput.value = clients(pool)[0]?.client_id || '';
    const secretInput = document.createElement('input');
    secretInput.placeholder = 'Client secret';
    const scopeInput = document.createElement('input');
    scopeInput.placeholder = 'notes/read notes/write';
    form.append(el('label', null, 'Client ID'), clientInput, el('label', null, 'Client secret'), secretInput, el('label', null, 'Scope'), scopeInput);
    openModal('Get OAuth token', form, 'Get token', async (close) => {
      const data = await apiJson('/api/cognito/oauth/token/', {
        method: 'POST',
        body: JSON.stringify({
          client_id: clientInput.value.trim(),
          client_secret: secretInput.value,
          scope: scopeInput.value.trim(),
        }),
      });
      close();
      toast('OAuth token loaded');
      state.lastResult = data;
      render();
    });
  }

  function renderPoolRow(pool) {
    const active = pool.id === selectedPool()?.id;
    const row = el('button', `cognito-pool-row${active ? ' cognito-pool-row-active' : ''}`);
    row.append(
      el('span', 'cognito-pool-name', pool.name || pool.id || 'User pool'),
      el('span', 'cognito-pool-meta', `${pool.id || 'no id'} / ${users(pool).length} users / ${clients(pool).length} clients`),
    );
    row.addEventListener('click', () => {
      state.selectedPoolId = pool.id;
      state.selectedUser = '';
      state.selectedGroup = '';
      state.lastResult = null;
      render();
    });
    return row;
  }

  function renderPoolList() {
    const panel = el('section', 'cognito-panel');
    panel.append(el('div', 'cognito-panel-heading', 'User pools'));
    const list = el('div', 'cognito-pool-list');
    if (!pools().length) {
      list.append(el('div', 'cognito-empty', 'No user pools found. Create one to start a local auth flow.'));
    } else {
      pools().forEach((pool) => list.append(renderPoolRow(pool)));
    }
    panel.append(list);
    return panel;
  }

  function renderPoolDetail(pool) {
    const panel = el('section', 'cognito-panel');
    const heading = el('div', 'cognito-panel-heading');
    heading.append(el('span', null, pool ? pool.name : 'Pool detail'), el('span', 'cognito-pool-meta', pool?.id || ''));
    panel.append(heading);
    if (!pool) {
      panel.append(el('div', 'cognito-empty', 'Select or create a user pool.'));
      return panel;
    }
    const details = document.createElement('dl');
    consoleUi.addField(details, 'Pool ID', pool.id);
    consoleUi.addField(details, 'ARN', pool.arn);
    consoleUi.addField(details, 'Created', consoleUi.formatDate(pool.created));
    consoleUi.addField(details, 'Discovery URL', pool.discovery_url);
    consoleUi.addField(details, 'JWKS URL', pool.jwks_url);
    consoleUi.addField(details, 'OAuth token URL', pool.oauth_token_url);
    consoleUi.addField(details, 'Tags', pool.tags || {});
    panel.append(details);
    return panel;
  }

  function renderClients(pool) {
    const panel = el('section', 'cognito-panel');
    panel.append(el('div', 'cognito-panel-heading', 'App clients'));
    if (!clients(pool).length) {
      panel.append(el('div', 'cognito-empty cognito-empty-compact', 'No app clients found.'));
      return panel;
    }
    const list = el('div', 'cognito-card-list');
    clients(pool).forEach((client) => {
      const item = el('article', 'cognito-card');
      item.append(el('strong', null, client.name || client.client_id), el('code', null, client.client_id || ''));
      const details = client.details || {};
      const meta = [
        details.GenerateSecret ? 'secret enabled' : '',
        (details.AllowedOAuthFlows || []).join(', '),
        (details.AllowedOAuthScopes || []).join(' '),
      ].filter(Boolean).join(' / ');
      item.append(el('span', 'cognito-pool-meta', meta || 'No OAuth settings returned'));
      list.append(item);
    });
    panel.append(list);
    return panel;
  }

  function renderResourceServers(pool) {
    const panel = el('section', 'cognito-panel');
    panel.append(el('div', 'cognito-panel-heading', 'Resource servers'));
    if (!resourceServers(pool).length) {
      panel.append(el('div', 'cognito-empty cognito-empty-compact', 'No resource servers found.'));
      return panel;
    }
    const list = el('div', 'cognito-card-list');
    resourceServers(pool).forEach((server) => {
      const item = el('article', 'cognito-card');
      item.append(el('strong', null, server.Name || server.name || server.Identifier), el('code', null, server.Identifier || server.identifier || ''));
      item.append(el('pre', 'cognito-mini-json', consoleUi.valueText(server.Scopes || server.scopes || [])));
      list.append(item);
    });
    panel.append(list);
    return panel;
  }

  function renderUsers(pool) {
    const panel = el('section', 'cognito-panel');
    panel.append(el('div', 'cognito-panel-heading', 'Users'));
    if (!users(pool).length) {
      panel.append(el('div', 'cognito-empty cognito-empty-compact', 'No users found.'));
      return panel;
    }
    const list = el('div', 'cognito-card-list');
    users(pool).forEach((user) => {
      const active = user.name === selectedUser(pool)?.name;
      const item = el('button', `cognito-user-card${active ? ' cognito-user-card-active' : ''}`);
      item.append(
        el('strong', null, user.name),
        el('span', 'cognito-pool-meta', `${user.status || 'UNKNOWN'} / ${user.enabled === false ? 'disabled' : 'enabled'}`),
      );
      item.addEventListener('click', () => {
        state.selectedUser = user.name;
        render();
      });
      list.append(item);
    });
    panel.append(list);
    return panel;
  }

  function renderGroups(pool) {
    const panel = el('section', 'cognito-panel');
    panel.append(el('div', 'cognito-panel-heading', 'Groups'));
    if (!groups(pool).length) {
      panel.append(el('div', 'cognito-empty cognito-empty-compact', 'No groups found.'));
      return panel;
    }
    const list = el('div', 'cognito-card-list');
    groups(pool).forEach((group) => {
      const name = group.GroupName || group.name;
      const active = name === (selectedGroup(pool)?.GroupName || selectedGroup(pool)?.name);
      const item = el('button', `cognito-user-card${active ? ' cognito-user-card-active' : ''}`);
      item.append(el('strong', null, name), el('span', 'cognito-pool-meta', `${group.user_count || 0} users`));
      item.addEventListener('click', () => {
        state.selectedGroup = name;
        render();
      });
      list.append(item);
    });
    panel.append(list);
    return panel;
  }

  function renderLastResult() {
    const panel = el('section', 'cognito-panel');
    panel.append(el('div', 'cognito-panel-heading', 'Last auth result'));
    if (!state.lastResult) {
      panel.append(el('div', 'cognito-empty cognito-empty-compact', 'Run user auth or OAuth token flow to inspect the response.'));
      return panel;
    }
    panel.append(el('pre', 'cognito-code-block', consoleUi.valueText(state.lastResult)));
    return panel;
  }

  function renderWorkbench() {
    const pool = selectedPool();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create pool', null, showCreatePoolModal),
        btn('Create client', null, () => pool && showCreateClientModal(pool)),
        btn('Resource server', null, () => pool && showCreateResourceServerModal(pool)),
        btn('Create user', null, () => pool && showCreateUserModal(pool)),
        btn('Create group', null, () => pool && showCreateGroupModal(pool)),
      ],
      [
        btn('Set password', null, () => pool && showSetPasswordModal(pool)),
        btn('Add to group', null, () => pool && showAddToGroupModal(pool)),
        btn('Test auth', null, () => pool && showAuthModal(pool)),
        btn('OAuth token', null, () => pool && showOAuthModal(pool)),
        btn('Delete user', 'cognito-btn-danger', () => pool && selectedUser(pool) && showDeleteUserModal(pool, selectedUser(pool))),
        btn('Delete pool', 'cognito-btn-danger', () => pool && showDeletePoolModal(pool)),
      ],
    ));
    Array.from(container.querySelectorAll('.cognito-toolbar button')).forEach((button) => {
      if (button.textContent !== 'Create pool') {
        button.disabled = !pool;
      }
    });

    const workbench = el('div', 'cognito-workbench');
    const detail = el('div', 'cognito-detail-stack');
    detail.append(
      renderPoolDetail(pool),
      renderClients(pool),
      renderResourceServers(pool),
      renderUsers(pool),
      renderGroups(pool),
      renderLastResult(),
    );
    workbench.append(renderPoolList(), detail);
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
    const data = await apiJson('/api/cognito/');
    state.inventory = data;
    if (!selectedPool() && pools().length) {
      state.selectedPoolId = pools()[0].id;
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'cognito-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh, showJsonModal };
})();

window.CognitoConsole = CognitoConsole;

if (document.getElementById('cognito-console-root')) {
  CognitoConsole.init();
}
