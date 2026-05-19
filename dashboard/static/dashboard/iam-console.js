/* global ServiceConsole */

const IAMConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('iam-console-root');
  const breadcrumbsEl = document.getElementById('iam-breadcrumbs');
  const summaryEl = document.getElementById('iam-summary');
  const loadedAtEl = document.getElementById('iam-loaded-at');

  const state = {
    inventory: null,
    selectedType: 'user',
    selectedName: '',
    selectedPolicy: null,
    lastCredentials: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'iam',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'iam');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'iam',
      toast,
    });

  const principalTypes = [
    ['user', 'Users', 'users'],
    ['role', 'Roles', 'roles'],
    ['group', 'Groups', 'groups'],
    ['policy', 'Customer policies', 'policies'],
  ];

  function principals(type = state.selectedType) {
    const entry = principalTypes.find(([key]) => key === type);
    return entry ? (state.inventory?.[entry[2]] || []) : [];
  }

  function selectedPrincipal() {
    const items = principals();
    return items.find((item) => item.name === state.selectedName) || items[0] || null;
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'iam',
      targets: {
        users: 'Users',
        groups: 'Groups',
        roles: 'Roles',
        customer_policies: 'Customer policies',
        instance_profiles: 'Instance profiles',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'AWS IAM');
    home.addEventListener('click', () => {
      state.selectedName = '';
      state.selectedPolicy = null;
      render();
    });
    breadcrumbsEl.append(home);
    const principal = selectedPrincipal();
    if (principal) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, principal.name || state.selectedType));
    }
  }

  function pretty(value) {
    return consoleUi.valueText(value);
  }

  function parsePolicyDocument(value) {
    if (!value) {
      return null;
    }
    if (typeof value === 'string') {
      return consoleUi.parsedJsonString(value) || value;
    }
    return value;
  }

  function policyStatements(documentValue) {
    const doc = parsePolicyDocument(documentValue);
    if (!doc || typeof doc !== 'object') {
      return [];
    }
    const statements = doc.Statement || [];
    return Array.isArray(statements) ? statements : [statements];
  }

  function compactList(value) {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (value && typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value || 'None';
  }

  function renderStatementSummary(documentValue) {
    const wrapper = el('div', 'iam-policy-summary');
    const statements = policyStatements(documentValue);
    wrapper.append(el('h3', null, `Statement summary (${statements.length})`));
    if (!statements.length) {
      wrapper.append(el('div', 'iam-empty iam-empty-compact', 'No policy statements found.'));
      return wrapper;
    }

    statements.forEach((statement, index) => {
      const card = el('article', 'iam-policy-statement');
      card.append(el('h4', null, statement.Sid || `Statement ${index + 1}`));
      const list = document.createElement('dl');
      consoleUi.addField(list, 'Effect', statement.Effect);
      consoleUi.addField(list, 'Actions', compactList(statement.Action || statement.NotAction));
      consoleUi.addField(list, 'Resources', compactList(statement.Resource || statement.NotResource));
      consoleUi.addField(list, 'Conditions', statement.Condition || 'None');
      card.append(list);
      wrapper.append(card);
    });
    return wrapper;
  }

  function renderPolicyViewer() {
    const panel = el('section', 'iam-panel-console');
    const heading = el('div', 'iam-panel-heading-console');
    heading.append(el('span', null, 'Policy document'), el('span', 'iam-principal-meta', state.selectedPolicy?.label || ''));
    panel.append(heading);
    const content = el('div', 'iam-policy-viewer');
    if (!state.selectedPolicy) {
      content.append(el('div', 'iam-empty', 'Select a trust, inline, or managed policy to inspect its JSON and statement summary.'));
      panel.append(content);
      return panel;
    }

    const documentValue = parsePolicyDocument(state.selectedPolicy.document);
    content.append(renderStatementSummary(documentValue));
    content.append(el('h3', null, 'JSON'));
    content.append(el('pre', 'iam-policy-json', pretty(documentValue || 'No document returned.')));
    panel.append(content);
    return panel;
  }

  async function copyText(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      toast(successMessage);
    } catch (error) {
      toast('Copy failed', true);
    }
  }

  function credentialEnv(credentials) {
    if (!credentials) {
      return '';
    }
    return [
      `export AWS_ACCESS_KEY_ID=${credentials.access_key_id || ''}`,
      `export AWS_SECRET_ACCESS_KEY=${credentials.secret_access_key || ''}`,
      credentials.session_token ? `export AWS_SESSION_TOKEN=${credentials.session_token}` : '',
    ].filter(Boolean).join('\n');
  }

  function selectPolicy(policy) {
    state.selectedPolicy = policy;
    render();
  }

  async function loadInlinePolicy(principal, policyName) {
    const data = await apiJson(
      `/api/iam/principals/${encodeURIComponent(state.selectedType)}/${encodeURIComponent(principal.name)}/inline-policies/${encodeURIComponent(policyName)}/document/`,
    );
    selectPolicy({
      label: `${principal.name} / ${policyName}`,
      document: data.document,
    });
  }

  async function loadManagedPolicy(policy) {
    const data = await apiJson('/api/iam/policies/document/', {
      method: 'POST',
      body: JSON.stringify({ policy_arn: policy.arn }),
    });
    selectPolicy({
      label: data.name || policy.name,
      document: data.document,
    });
  }

  function showCreateAccessKeyModal(user) {
    openModal('Create access key', el('p', null, `Create a new access key for ${user.name}?`), 'Create', async (close) => {
      const data = await apiJson(`/api/iam/users/${encodeURIComponent(user.name)}/access-keys/`, { method: 'POST' });
      state.lastCredentials = {
        access_key_id: data.access_key_id,
        secret_access_key: data.secret_access_key,
      };
      close();
      toast('Access key created');
      await refresh();
    });
  }

  function showAssumeRoleModal(role) {
    const form = el('div');
    const sessionInput = document.createElement('input');
    sessionInput.value = `${role.name}-dashboard`;
    const durationInput = document.createElement('input');
    durationInput.type = 'number';
    durationInput.min = '900';
    durationInput.placeholder = '3600';
    form.append(
      el('label', null, 'Role ARN'),
      el('pre', 'iam-arn-preview', role.arn),
      el('label', null, 'Session name'),
      sessionInput,
      el('label', null, 'Duration seconds'),
      durationInput,
    );
    openModal('Assume role', form, 'Assume', async (close) => {
      const data = await apiJson(`/api/iam/roles/${encodeURIComponent(role.name)}/assume/`, {
        method: 'POST',
        body: JSON.stringify({
          role_arn: role.arn,
          session_name: sessionInput.value.trim(),
          duration_seconds: durationInput.value ? Number(durationInput.value) : null,
        }),
      });
      state.lastCredentials = data.credentials;
      close();
      toast('Role assumed');
      render();
    });
  }

  function showAttachManagedPolicyModal(principal) {
    const form = el('div');
    const policyInput = document.createElement('input');
    policyInput.placeholder = 'arn:aws:iam::000000000000:policy/example';
    form.append(el('label', null, 'Policy ARN'), policyInput);
    openModal('Attach managed policy', form, 'Attach', async (close) => {
      await apiJson(`/api/iam/principals/${encodeURIComponent(state.selectedType)}/${encodeURIComponent(principal.name)}/attached-policies/`, {
        method: 'POST',
        body: JSON.stringify({ policy_arn: policyInput.value.trim() }),
      });
      close();
      toast('Policy attached');
      await refresh();
    });
  }

  function showInlinePolicyModal(principal, existingName = '') {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.value = existingName;
    nameInput.placeholder = 'local-dev-policy';
    const documentInput = document.createElement('textarea');
    documentInput.value = '{\n  "Version": "2012-10-17",\n  "Statement": [\n    {\n      "Effect": "Allow",\n      "Action": "*",\n      "Resource": "*"\n    }\n  ]\n}';
    form.append(el('label', null, 'Policy name'), nameInput, el('label', null, 'Policy document JSON'), documentInput);
    openModal(existingName ? 'Update inline policy' : 'Add inline policy', form, 'Save', async (close) => {
      const policyName = nameInput.value.trim();
      await apiJson(`/api/iam/principals/${encodeURIComponent(state.selectedType)}/${encodeURIComponent(principal.name)}/inline-policies/${encodeURIComponent(policyName)}/`, {
        method: 'PUT',
        body: JSON.stringify({ document: JSON.parse(documentInput.value) }),
      });
      close();
      toast('Inline policy saved');
      await refresh();
    });
  }

  function showCreateManagedPolicyModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'local-dev-policy';
    const descriptionInput = document.createElement('input');
    descriptionInput.placeholder = 'optional';
    const documentInput = document.createElement('textarea');
    documentInput.value = '{\n  "Version": "2012-10-17",\n  "Statement": [\n    {\n      "Effect": "Allow",\n      "Action": "*",\n      "Resource": "*"\n    }\n  ]\n}';
    form.append(
      el('label', null, 'Policy name'),
      nameInput,
      el('label', null, 'Description'),
      descriptionInput,
      el('label', null, 'Policy document JSON'),
      documentInput,
    );
    openModal('Create managed policy', form, 'Create', async (close) => {
      await apiJson('/api/iam/policies/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          description: descriptionInput.value.trim() || null,
          document: JSON.parse(documentInput.value),
        }),
      });
      close();
      toast('Managed policy created');
      await refresh();
    });
  }

  function confirmDetachPolicy(principal, policy) {
    openModal('Detach managed policy', el('p', null, `Detach ${policy.name || policy.arn} from ${principal.name}?`), 'Detach', async (close) => {
      await apiJson(`/api/iam/principals/${encodeURIComponent(state.selectedType)}/${encodeURIComponent(principal.name)}/attached-policies/`, {
        method: 'DELETE',
        body: JSON.stringify({ policy_arn: policy.arn }),
      });
      close();
      toast('Policy detached');
      await refresh();
    });
  }

  function confirmDeleteInlinePolicy(principal, policyName) {
    openModal('Delete inline policy', el('p', null, `Delete inline policy ${policyName} from ${principal.name}?`), 'Delete', async (close) => {
      await apiJson(`/api/iam/principals/${encodeURIComponent(state.selectedType)}/${encodeURIComponent(principal.name)}/inline-policies/${encodeURIComponent(policyName)}/`, {
        method: 'DELETE',
      });
      close();
      toast('Inline policy deleted');
      await refresh();
    });
  }

  async function updateAccessKey(user, key, status) {
    await apiJson(`/api/iam/users/${encodeURIComponent(user.name)}/access-keys/${encodeURIComponent(key.id)}/`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    toast(`Access key ${status.toLowerCase()}`);
    await refresh();
  }

  function confirmDeleteAccessKey(user, key) {
    openModal('Delete access key', el('p', null, `Delete access key ${key.id}?`), 'Delete', async (close) => {
      await apiJson(`/api/iam/users/${encodeURIComponent(user.name)}/access-keys/${encodeURIComponent(key.id)}/`, {
        method: 'DELETE',
      });
      close();
      toast('Access key deleted');
      await refresh();
    });
  }

  function renderPrincipalTypeTabs() {
    const tabs = el('div', 'iam-principal-tabs');
    principalTypes.forEach(([type, label]) => {
      const tab = el('button', state.selectedType === type ? 'iam-principal-tab-active' : null, label);
      tab.addEventListener('click', () => {
        state.selectedType = type;
        state.selectedName = '';
        state.selectedPolicy = null;
        render();
      });
      tabs.append(tab);
    });
    return tabs;
  }

  function renderPrincipalRow(type, principal) {
    const active = type === state.selectedType && principal.name === selectedPrincipal()?.name;
    const row = el('button', `iam-principal-row${active ? ' iam-principal-row-active' : ''}`);
    const meta = [
      type,
      principal.arn,
      principal.status,
    ].filter(Boolean);
    row.append(
      el('span', 'iam-principal-name', principal.name || principal.arn || 'Unnamed'),
      el('span', 'iam-principal-meta', meta.join(' / ') || 'No summary'),
    );
    row.addEventListener('click', () => {
      state.selectedType = type;
      state.selectedName = principal.name;
      state.selectedPolicy = null;
      render();
    });
    return row;
  }

  function renderPrincipalList() {
    const panel = el('section', 'iam-panel-console');
    panel.append(el('div', 'iam-panel-heading-console', 'Principal explorer'));
    panel.append(renderPrincipalTypeTabs());
    const list = el('div', 'iam-principal-list');
    const items = principals();
    if (!items.length) {
      list.append(el('div', 'iam-empty', `No ${state.selectedType}s found.`));
    } else {
      items.forEach((principal) => list.append(renderPrincipalRow(state.selectedType, principal)));
    }
    panel.append(list);
    return panel;
  }

  function renderPolicyList(principal) {
    const wrapper = el('div', 'iam-policy-list-wrap');
    wrapper.append(el('h3', null, 'Policies'));
    if (principal.trust_policy) {
      const trust = btn('Trust policy', 'iam-btn-secondary', () => selectPolicy({
        label: `${principal.name} trust policy`,
        document: principal.trust_policy,
      }));
      wrapper.append(trust);
    }

    (principal.attached_policies || []).forEach((policy) => {
      const row = el('div', 'iam-policy-row');
      row.append(btn(policy.name || policy.arn, 'iam-btn-secondary', () => loadManagedPolicy(policy).catch((error) => toast(error.message, true))));
      if (state.selectedType !== 'policy') {
        row.append(btn('Detach', 'iam-btn-danger', () => confirmDetachPolicy(principal, policy)));
      }
      wrapper.append(row);
    });

    (principal.inline_policies || []).forEach((policyName) => {
      const row = el('div', 'iam-policy-row');
      row.append(btn(policyName, 'iam-btn-secondary', () => loadInlinePolicy(principal, policyName).catch((error) => toast(error.message, true))));
      row.append(btn('Edit', 'iam-btn-secondary', () => showInlinePolicyModal(principal, policyName)));
      row.append(btn('Delete', 'iam-btn-danger', () => confirmDeleteInlinePolicy(principal, policyName)));
      wrapper.append(row);
    });

    if (!principal.trust_policy && !(principal.attached_policies || []).length && !(principal.inline_policies || []).length) {
      wrapper.append(el('div', 'iam-empty iam-empty-compact', 'No policies attached.'));
    }
    return wrapper;
  }

  function renderAccessKeys(user) {
    const wrapper = el('div', 'iam-access-keys');
    wrapper.append(el('h3', null, 'Access keys'));
    const keys = user.access_keys || [];
    if (!keys.length) {
      wrapper.append(el('div', 'iam-empty iam-empty-compact', 'No access keys found.'));
    } else {
      keys.forEach((key) => {
        const row = el('div', 'iam-access-key-row');
        row.append(el('span', 'iam-principal-name', key.id), el('span', 'iam-principal-meta', key.status || 'Unknown'));
        row.append(btn(key.status === 'Active' ? 'Deactivate' : 'Activate', 'iam-btn-secondary', () => {
          updateAccessKey(user, key, key.status === 'Active' ? 'Inactive' : 'Active').catch((error) => toast(error.message, true));
        }));
        row.append(btn('Delete', 'iam-btn-danger', () => confirmDeleteAccessKey(user, key)));
        wrapper.append(row);
      });
    }
    if (state.lastCredentials?.access_key_id && state.selectedType === 'user') {
      const credentials = el('div', 'iam-credentials');
      credentials.append(el('h3', null, 'Latest credentials'));
      credentials.append(el('pre', 'iam-policy-json', credentialEnv(state.lastCredentials)));
      credentials.append(btn('Copy env vars', 'iam-btn-secondary', () => copyText(credentialEnv(state.lastCredentials), 'Env vars copied')));
      wrapper.append(credentials);
    }
    return wrapper;
  }

  function renderAssumeRoleResult() {
    if (!state.lastCredentials?.session_token || state.selectedType !== 'role') {
      return null;
    }
    const credentials = el('div', 'iam-credentials');
    credentials.append(el('h3', null, 'Assumed role credentials'));
    credentials.append(el('pre', 'iam-policy-json', credentialEnv(state.lastCredentials)));
    credentials.append(btn('Copy env vars', 'iam-btn-secondary', () => copyText(credentialEnv(state.lastCredentials), 'Env vars copied')));
    return credentials;
  }

  function renderPrincipalDetail(principal) {
    const panel = el('section', 'iam-panel-console');
    const heading = el('div', 'iam-panel-heading-console');
    heading.append(el('span', null, principal ? principal.name : 'Principal detail'), el('span', 'iam-principal-meta', state.selectedType));
    panel.append(heading);
    const content = el('div', 'iam-principal-detail');
    if (!principal) {
      content.append(el('div', 'iam-empty', 'Select a principal to inspect policies and credentials.'));
      panel.append(content);
      return panel;
    }

    const details = document.createElement('dl');
    consoleUi.addField(details, 'ARN', principal.arn);
    consoleUi.addField(details, 'Created', consoleUi.formatDate(principal.created));
    consoleUi.addField(details, 'Groups', principal.groups || principal.users);
    consoleUi.addField(details, 'Permission boundary', principal.permissions_boundary);
    consoleUi.addField(details, 'Instance profiles', principal.instance_profiles);
    consoleUi.addField(details, 'Default version', principal.default_version);
    consoleUi.addField(details, 'Attachment count', principal.attachment_count);
    content.append(details);

    if (state.selectedType === 'policy') {
      content.append(btn('Open default version', 'iam-btn-secondary', () => loadManagedPolicy(principal).catch((error) => toast(error.message, true))));
    } else {
      content.append(renderPolicyList(principal));
    }
    if (state.selectedType === 'user') {
      content.append(renderAccessKeys(principal));
    }
    if (state.selectedType === 'role') {
      const assumed = renderAssumeRoleResult();
      if (assumed) {
        content.append(assumed);
      }
    }
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const principal = selectedPrincipal();
    const container = el('div');
    const leftButtons = [];
    const rightButtons = [];
    if (state.selectedType === 'user' && principal) {
      leftButtons.push(btn('Create access key', null, () => showCreateAccessKeyModal(principal)));
    }
    if (state.selectedType === 'role' && principal) {
      leftButtons.push(btn('Assume role', null, () => showAssumeRoleModal(principal)));
    }
    if (state.selectedType !== 'policy' && principal) {
      leftButtons.push(btn('Attach managed policy', 'iam-btn-secondary', () => showAttachManagedPolicyModal(principal)));
      leftButtons.push(btn('Add inline policy', 'iam-btn-secondary', () => showInlinePolicyModal(principal)));
    }
    rightButtons.push(btn('Create managed policy', 'iam-btn-secondary', showCreateManagedPolicyModal));
    container.append(toolbar(leftButtons, rightButtons));

    const workbench = el('div', 'iam-workbench');
    const detail = el('div', 'iam-detail-stack');
    detail.append(renderPrincipalDetail(principal), renderPolicyViewer());
    workbench.append(renderPrincipalList(), detail);
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
    const data = await apiJson('/api/iam/');
    state.inventory = data;
    if (!selectedPrincipal() && principals().length) {
      state.selectedName = principals()[0].name;
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'iam-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.IAMConsole = IAMConsole;

if (document.getElementById('iam-console-root')) {
  IAMConsole.init();
}
