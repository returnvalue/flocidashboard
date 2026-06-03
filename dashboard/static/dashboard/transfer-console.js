/* global ServiceConsole */

const TransferConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('transfer-console-root');
  const breadcrumbsEl = document.getElementById('transfer-breadcrumbs');
  const summaryEl = document.getElementById('transfer-summary');
  const loadedAtEl = document.getElementById('transfer-loaded-at');

  const state = {
    inventory: null,
    selectedServerId: '',
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'transfer',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'transfer');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'transfer',
      toast,
    });

  function servers() {
    return state.inventory?.servers || [];
  }

  function serverId(server) {
    return server?.id || server?.ServerId || server?.name || '';
  }

  function serverArn(server) {
    return server?.arn || server?.Arn || '';
  }

  function selectedServer() {
    return servers().find((server) => serverId(server) === state.selectedServerId) || servers()[0] || null;
  }

  function users(server = selectedServer()) {
    return server?.users || [];
  }

  function userName(user) {
    return user?.UserName || user?.user_name || user?.name || '';
  }

  function userArn(user, server = selectedServer()) {
    return user?.Arn || user?.arn || (serverArn(server) && userName(user) ? `${serverArn(server).replace(':server/', ':user/')}/${userName(user)}` : '');
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

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('Transfer Family', null, () => {
      state.selectedServerId = servers()[0] ? serverId(servers()[0]) : '';
      render();
    }));
    const server = selectedServer();
    if (server) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, serverId(server)));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'transfer',
      targets: {
        servers: 'Servers',
        users: 'Servers',
        host_keys: 'Servers',
        agreements: 'Servers',
        workflows: 'Workflows',
        profiles: 'Profiles',
        certificates: 'Certificates',
        connectors: 'Connectors',
        security_policies: 'Security policies',
        web_apps: 'Web apps',
      },
    });
  }

  function showCreateServerModal() {
    const form = el('div', 'transfer-modal-form');
    const protocolsInput = document.createElement('textarea');
    protocolsInput.value = JSON.stringify(['SFTP'], null, 2);
    const endpointInput = document.createElement('input');
    endpointInput.value = 'PUBLIC';
    const domainInput = document.createElement('input');
    domainInput.value = 'S3';
    const loggingRoleInput = document.createElement('input');
    loggingRoleInput.placeholder = 'arn:aws:iam::000000000000:role/transfer-logs';
    const securityPolicyInput = document.createElement('input');
    securityPolicyInput.placeholder = 'TransferSecurityPolicy-2020-06';
    const tagsInput = document.createElement('textarea');
    tagsInput.value = JSON.stringify([{ Key: 'env', Value: 'dev' }], null, 2);
    form.append(
      el('label', null, 'Protocols JSON'),
      protocolsInput,
      el('label', null, 'Endpoint type'),
      endpointInput,
      el('label', null, 'Domain'),
      domainInput,
      el('label', null, 'Logging role ARN'),
      loggingRoleInput,
      el('label', null, 'Security policy name'),
      securityPolicyInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Create Transfer server', form, 'Create', async (close) => {
      const data = await apiJson('/api/transfer/servers/', {
        method: 'POST',
        body: JSON.stringify({
          protocols: parseJson(protocolsInput.value, ['SFTP'], 'Protocols'),
          endpoint_type: endpointInput.value.trim() || 'PUBLIC',
          domain: domainInput.value.trim() || 'S3',
          logging_role: loggingRoleInput.value.trim(),
          security_policy_name: securityPolicyInput.value.trim(),
          tags: parseJson(tagsInput.value, [], 'Tags'),
        }),
      });
      state.selectedServerId = data.server_id || '';
      state.lastResult = data;
      close();
      toast('Transfer server created');
      await refresh();
    });
  }

  function showUpdateServerModal(server = selectedServer()) {
    const form = el('div', 'transfer-modal-form');
    const optionsInput = document.createElement('textarea');
    optionsInput.value = JSON.stringify({
      Protocols: server?.protocols || ['SFTP'],
      EndpointType: server?.endpoint_type || 'PUBLIC',
    }, null, 2);
    form.append(el('label', null, 'Server options JSON'), optionsInput);
    openModal('Update Transfer server', form, 'Save', async (close) => {
      const id = serverId(server);
      const data = await apiJson(`/api/transfer/servers/${encodeURIComponent(id)}/`, {
        method: 'PATCH',
        body: JSON.stringify({ options: parseJson(optionsInput.value, {}, 'Server options') }),
      });
      state.lastResult = data;
      close();
      toast('Transfer server updated');
      await refresh();
    });
  }

  function showCreateUserModal(server = selectedServer()) {
    const form = el('div', 'transfer-modal-form');
    const serverInput = document.createElement('input');
    serverInput.value = serverId(server);
    const userInput = document.createElement('input');
    userInput.placeholder = 'alice';
    const roleInput = document.createElement('input');
    roleInput.value = 'arn:aws:iam::000000000000:role/transfer-role';
    const homeInput = document.createElement('input');
    homeInput.value = '/uploads';
    const mappingsInput = document.createElement('textarea');
    mappingsInput.placeholder = '[{"Entry":"/","Target":"/bucket/alice"}]';
    const policyInput = document.createElement('textarea');
    policyInput.placeholder = '{"Version":"2012-10-17","Statement":[]}';
    form.append(
      el('label', null, 'Server ID'),
      serverInput,
      el('label', null, 'User name'),
      userInput,
      el('label', null, 'Role ARN'),
      roleInput,
      el('label', null, 'Home directory'),
      homeInput,
      el('label', null, 'Home directory mappings JSON'),
      mappingsInput,
      el('label', null, 'Policy JSON string'),
      policyInput,
    );
    openModal('Create Transfer user', form, 'Create', async (close) => {
      const id = serverInput.value.trim();
      const data = await apiJson(`/api/transfer/servers/${encodeURIComponent(id)}/users/`, {
        method: 'POST',
        body: JSON.stringify({
          user_name: userInput.value.trim(),
          role: roleInput.value.trim(),
          home_directory: homeInput.value.trim(),
          home_directory_mappings: parseJson(mappingsInput.value, [], 'Home directory mappings'),
          policy: policyInput.value.trim(),
        }),
      });
      state.selectedServerId = id;
      state.lastResult = data;
      close();
      toast('Transfer user created');
      await refresh();
    });
  }

  function showUpdateUserModal(user, server = selectedServer()) {
    const form = el('div', 'transfer-modal-form');
    const optionsInput = document.createElement('textarea');
    optionsInput.value = JSON.stringify({
      Role: user?.Role || 'arn:aws:iam::000000000000:role/transfer-role',
      HomeDirectory: user?.HomeDirectory || '/uploads',
    }, null, 2);
    form.append(el('label', null, 'User options JSON'), optionsInput);
    openModal('Update Transfer user', form, 'Save', async (close) => {
      const data = await apiJson(`/api/transfer/servers/${encodeURIComponent(serverId(server))}/users/${encodeURIComponent(userName(user))}/`, {
        method: 'PATCH',
        body: JSON.stringify({ options: parseJson(optionsInput.value, {}, 'User options') }),
      });
      state.lastResult = data;
      close();
      toast('Transfer user updated');
      await refresh();
    });
  }

  function showImportKeyModal(server = selectedServer(), user = null) {
    const form = el('div', 'transfer-modal-form');
    const serverInput = document.createElement('input');
    serverInput.value = serverId(server);
    const userInput = document.createElement('input');
    userInput.value = user ? userName(user) : '';
    userInput.placeholder = 'alice';
    const keyInput = document.createElement('textarea');
    keyInput.value = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQClocaldev alice@example';
    form.append(
      el('label', null, 'Server ID'),
      serverInput,
      el('label', null, 'User name'),
      userInput,
      el('label', null, 'SSH public key body'),
      keyInput,
    );
    openModal('Import SSH public key', form, 'Import', async (close) => {
      const id = serverInput.value.trim();
      const name = userInput.value.trim();
      const data = await apiJson(`/api/transfer/servers/${encodeURIComponent(id)}/users/${encodeURIComponent(name)}/ssh-public-keys/`, {
        method: 'POST',
        body: JSON.stringify({ ssh_public_key_body: keyInput.value.trim() }),
      });
      state.selectedServerId = id;
      state.lastResult = data;
      close();
      toast('SSH public key imported');
      await refresh();
    });
  }

  function showDeleteKeyModal(server = selectedServer(), user = null) {
    const form = el('div', 'transfer-modal-form');
    const serverInput = document.createElement('input');
    serverInput.value = serverId(server);
    const userInput = document.createElement('input');
    userInput.value = user ? userName(user) : '';
    const keyInput = document.createElement('input');
    keyInput.placeholder = 'key-id';
    form.append(
      el('label', null, 'Server ID'),
      serverInput,
      el('label', null, 'User name'),
      userInput,
      el('label', null, 'SSH public key ID'),
      keyInput,
    );
    openModal('Delete SSH public key', form, 'Delete', async (close) => {
      const id = serverInput.value.trim();
      const name = userInput.value.trim();
      const keyId = keyInput.value.trim();
      const data = await apiJson(`/api/transfer/servers/${encodeURIComponent(id)}/users/${encodeURIComponent(name)}/ssh-public-keys/${encodeURIComponent(keyId)}/`, {
        method: 'DELETE',
      });
      state.selectedServerId = id;
      state.lastResult = data;
      close();
      toast('SSH public key deleted');
      await refresh();
    });
  }

  function showTagModal(arn = '') {
    const form = el('div', 'transfer-modal-form');
    const arnInput = document.createElement('input');
    arnInput.value = arn;
    const tagsInput = document.createElement('textarea');
    tagsInput.value = JSON.stringify([{ Key: 'env', Value: 'dev' }], null, 2);
    form.append(
      el('label', null, 'Resource ARN'),
      arnInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Tag Transfer resource', form, 'Save', async (close) => {
      const data = await apiJson('/api/transfer/tags/', {
        method: 'POST',
        body: JSON.stringify({ arn: arnInput.value.trim(), tags: parseJson(tagsInput.value, [], 'Tags') }),
      });
      state.lastResult = data;
      close();
      toast('Transfer resource tagged');
      await refresh();
    });
  }

  function showUntagModal(arn = '') {
    const form = el('div', 'transfer-modal-form');
    const arnInput = document.createElement('input');
    arnInput.value = arn;
    const keysInput = document.createElement('textarea');
    keysInput.value = JSON.stringify(['env'], null, 2);
    form.append(
      el('label', null, 'Resource ARN'),
      arnInput,
      el('label', null, 'Tag keys JSON'),
      keysInput,
    );
    openModal('Untag Transfer resource', form, 'Remove', async (close) => {
      const data = await apiJson('/api/transfer/tags/', {
        method: 'DELETE',
        body: JSON.stringify({ arn: arnInput.value.trim(), tag_keys: parseJson(keysInput.value, [], 'Tag keys') }),
      });
      state.lastResult = data;
      close();
      toast('Transfer resource untagged');
      await refresh();
    });
  }

  async function transitionServer(server, action) {
    const id = serverId(server);
    const data = await apiJson(`/api/transfer/servers/${encodeURIComponent(id)}/${action}/`, { method: 'POST' });
    state.selectedServerId = id;
    state.lastResult = data;
    toast(`Transfer server ${action === 'start' ? 'started' : 'stopped'}`);
    await refresh();
  }

  async function deleteServer(server) {
    const id = serverId(server);
    if (!window.confirm(`Delete Transfer server ${id}? The server must be OFFLINE.`)) {
      return;
    }
    const data = await apiJson(`/api/transfer/servers/${encodeURIComponent(id)}/`, { method: 'DELETE' });
    state.lastResult = data;
    state.selectedServerId = '';
    toast('Transfer server deleted');
    await refresh();
  }

  async function deleteUser(user, server = selectedServer()) {
    if (!window.confirm(`Delete Transfer user ${userName(user)} from ${serverId(server)}?`)) {
      return;
    }
    const data = await apiJson(`/api/transfer/servers/${encodeURIComponent(serverId(server))}/users/${encodeURIComponent(userName(user))}/`, {
      method: 'DELETE',
    });
    state.lastResult = data;
    toast('Transfer user deleted');
    await refresh();
  }

  function renderServerRow(server) {
    const id = serverId(server);
    const active = id === serverId(selectedServer());
    const row = el('button', `transfer-server-row${active ? ' transfer-server-row-active' : ''}`);
    const protocols = Array.isArray(server.protocols) ? server.protocols.join(', ') : (server.protocols || 'protocols pending');
    row.append(
      el('span', 'transfer-server-name', id || 'Server'),
      el('span', 'transfer-server-meta', `${server.state || 'UNKNOWN'} / ${protocols}`),
    );
    row.addEventListener('click', () => {
      state.selectedServerId = id;
      render();
    });
    return row;
  }

  function renderServerList() {
    const panel = el('section', 'transfer-panel');
    panel.append(el('div', 'transfer-panel-heading', 'Servers'));
    const list = el('div', 'transfer-server-list');
    if (!servers().length) {
      list.append(el('div', 'transfer-empty', 'No Transfer servers found.'));
    } else {
      servers().forEach((server) => list.append(renderServerRow(server)));
    }
    panel.append(list);
    return panel;
  }

  function renderServerFacts(server) {
    const facts = document.createElement('dl');
    consoleUi.addField(facts, 'ARN', serverArn(server));
    consoleUi.addField(facts, 'State', server.state);
    consoleUi.addField(facts, 'Endpoint type', server.endpoint_type);
    consoleUi.addField(facts, 'Domain', server.domain);
    consoleUi.addField(facts, 'Identity provider', server.identity_provider_type);
    consoleUi.addField(facts, 'Protocols', server.protocols);
    consoleUi.addField(facts, 'Logging role', server.logging_role);
    consoleUi.addField(facts, 'Security policy', server.security_policy_name);
    consoleUi.addField(facts, 'Tags', server.tags);
    consoleUi.addField(facts, 'Users', server.user_count);
    consoleUi.addField(facts, 'Host keys', server.host_key_count);
    consoleUi.addField(facts, 'Agreements', server.agreement_count);
    return facts;
  }

  function renderUsers(server) {
    const wrapper = el('div', 'transfer-card-list');
    const related = users(server);
    if (!related.length) {
      wrapper.append(el('p', 'transfer-empty', 'No users found for this server.'));
      return wrapper;
    }
    related.forEach((user) => {
      const card = el('article', 'transfer-card');
      card.append(el('h3', null, userName(user) || 'Transfer user'));
      const facts = document.createElement('dl');
      consoleUi.addField(facts, 'ARN', userArn(user, server));
      consoleUi.addField(facts, 'Role', user.Role);
      consoleUi.addField(facts, 'Home directory', user.HomeDirectory);
      consoleUi.addField(facts, 'Home type', user.HomeDirectoryType);
      consoleUi.addField(facts, 'SSH key count', user.SshPublicKeyCount);
      card.append(facts);
      const actions = el('div', 'transfer-action-row');
      actions.append(
        btn('Update', 'transfer-btn-secondary', () => showUpdateUserModal(user, server)),
        btn('Import key', 'transfer-btn-secondary', () => showImportKeyModal(server, user)),
        btn('Delete key', 'transfer-btn-secondary', () => showDeleteKeyModal(server, user)),
        btn('Delete', 'transfer-btn-danger', () => deleteUser(user, server).catch((error) => toast(error.message, true))),
      );
      card.append(actions);
      wrapper.append(card);
    });
    return wrapper;
  }

  function renderSnippet(server) {
    const snippet = el('pre', 'transfer-snippet');
    snippet.textContent = [
      'export AWS_ENDPOINT_URL=http://localhost:4566',
      '',
      `aws transfer describe-server --server-id ${serverId(server)} --endpoint-url $AWS_ENDPOINT_URL`,
      `aws transfer list-users --server-id ${serverId(server)} --endpoint-url $AWS_ENDPOINT_URL`,
    ].join('\n');
    return snippet;
  }

  function renderLastResult() {
    if (!state.lastResult) {
      return null;
    }
    const result = el('div', 'transfer-last-result');
    result.append(el('h3', null, 'Last action result'));
    const pre = el('pre', 'transfer-result');
    pre.textContent = JSON.stringify(consoleUi.displayValue(state.lastResult), null, 2);
    result.append(pre);
    return result;
  }

  function renderServerDetail(server) {
    const panel = el('section', 'transfer-panel');
    const heading = el('div', 'transfer-panel-heading');
    heading.append(
      el('span', null, server ? serverId(server) : 'Transfer workbench'),
      el('span', 'transfer-server-meta', server ? `${server.state || 'UNKNOWN'} / management plane` : 'No server selected'),
    );
    panel.append(heading);

    const content = el('div', 'transfer-detail');
    if (!server) {
      content.append(el('div', 'transfer-empty', 'Create a server or refresh after your app creates one.'));
      panel.append(content);
      return panel;
    }
    content.append(renderServerFacts(server));
    const actions = el('div', 'transfer-action-row');
    actions.append(
      btn('Start', null, () => transitionServer(server, 'start').catch((error) => toast(error.message, true))),
      btn('Stop', 'transfer-btn-secondary', () => transitionServer(server, 'stop').catch((error) => toast(error.message, true))),
      btn('Create user', 'transfer-btn-secondary', () => showCreateUserModal(server)),
      btn('Import key', 'transfer-btn-secondary', () => showImportKeyModal(server)),
      btn('Tag server', 'transfer-btn-secondary', () => showTagModal(serverArn(server))),
      btn('Untag server', 'transfer-btn-secondary', () => showUntagModal(serverArn(server))),
      btn('Update server', 'transfer-btn-secondary', () => showUpdateServerModal(server)),
      btn('Delete server', 'transfer-btn-danger', () => deleteServer(server).catch((error) => toast(error.message, true))),
    );
    content.append(actions, el('h3', null, 'CLI context'), renderSnippet(server), el('h3', null, 'Users'), renderUsers(server));
    const result = renderLastResult();
    if (result) {
      content.append(result);
    }
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const server = selectedServer();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create server', null, showCreateServerModal),
        btn('Create user', 'transfer-btn-secondary', () => showCreateUserModal()),
        btn('Import key', 'transfer-btn-secondary', () => showImportKeyModal()),
        btn('Refresh', 'transfer-btn-secondary', () => refresh().catch((error) => toast(error.message, true))),
      ],
      [el('span', 'transfer-toolbar-note', 'Management-plane server, user, SSH key, and tag workflows')],
    ));
    const workbench = el('div', 'transfer-workbench');
    workbench.append(renderServerList(), renderServerDetail(server));
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
    const data = await apiJson('/api/transfer/');
    state.inventory = data;
    if (!selectedServer() && servers().length) {
      state.selectedServerId = serverId(servers()[0]);
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'transfer-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.TransferConsole = TransferConsole;

if (document.getElementById('transfer-console-root')) {
  TransferConsole.init();
}
