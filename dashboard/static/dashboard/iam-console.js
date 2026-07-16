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
    principalFilterText: '',
    principalFilterRestoreFocus: false,
    principalFilterSelectionStart: null,
    principalFilterSelectionEnd: null,
    selectedPrincipals: new Set(),
    loadedAt: null,
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
    ['profile', 'Instance profiles', 'instance_profiles'],
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
    const summaryTypes = ['user', 'group', 'role', 'policy', 'profile'];
    summaryEl?.querySelectorAll('a').forEach((card, index) => {
      card.href = '#iam-console-root';
      if (summaryTypes[index]) {
        card.addEventListener('click', () => {
          state.selectedType = summaryTypes[index];
          state.selectedName = '';
          state.selectedPolicy = null;
          state.principalFilterText = '';
          state.selectedPrincipals.clear();
          render();
        });
      }
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
    return value ?? 'None';
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

  async function loadManagedPolicy(policy, versionId = '') {
    const data = await apiJson('/api/iam/policies/document/', {
      method: 'POST',
      body: JSON.stringify({ policy_arn: policy.arn, version_id: versionId || null }),
    });
    selectPolicy({
      label: `${data.name || policy.name}${data.version_id ? ` / ${data.version_id}` : ''}`,
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

  async function mutate(path, method, body, message) {
    const data = await apiJson(path, { method, body: body === null ? undefined : JSON.stringify(body) });
    toast(message);
    await refresh();
    return data;
  }

  function showUpdateUserModal(user) {
    const form = el('div');
    const name = document.createElement('input'); name.value = user.name;
    const path = document.createElement('input'); path.value = user.path || '/';
    form.append(el('label', null, 'User name'), name, el('label', null, 'Path'), path);
    openModal('Update user', form, 'Update', async (close) => {
      const newName = name.value.trim();
      await mutate(`/api/iam/users/${encodeURIComponent(user.name)}/`, 'PATCH', { new_name: newName === user.name ? '' : newName, new_path: path.value.trim() }, 'User updated');
      state.selectedName = newName; close();
    });
  }

  function showUpdateRoleModal(role) {
    const form = el('div');
    const description = document.createElement('input'); description.value = role.description || '';
    const duration = document.createElement('input'); duration.type = 'number'; duration.value = role.max_session_duration || 3600;
    form.append(el('label', null, 'Description'), description, el('label', null, 'Maximum session duration'), duration);
    openModal('Update role settings', form, 'Update', async (close) => {
      await mutate(`/api/iam/roles/${encodeURIComponent(role.name)}/`, 'PATCH', { description: description.value, max_session_duration: duration.value }, 'Role updated'); close();
    });
  }

  function showLoginProfileModal(user, update = Boolean(user.login_profile)) {
    const form = el('div');
    const password = document.createElement('input'); password.type = 'password';
    const reset = document.createElement('input'); reset.type = 'checkbox'; reset.checked = true;
    form.append(el('label', null, 'Password'), password, el('label', null, 'Require password reset'), reset);
    openModal(update ? 'Update login profile' : 'Create login profile', form, update ? 'Update' : 'Create', async (close) => {
      await mutate(`/api/iam/users/${encodeURIComponent(user.name)}/login-profile/`, update ? 'PUT' : 'POST', { password: password.value, password_reset_required: reset.checked }, update ? 'Login profile updated' : 'Login profile created'); close();
    });
  }

  function showTagsModal(resource) {
    const type = state.selectedType;
    const resourceName = type === 'policy' ? resource.arn : resource.name;
    const form = el('div');
    const tags = document.createElement('textarea');
    tags.value = JSON.stringify(Object.fromEntries((resource.tags || []).map((tag) => [tag.Key, tag.Value])), null, 2);
    const remove = document.createElement('input'); remove.placeholder = 'tag-key-1,tag-key-2';
    form.append(el('label', null, 'Tags JSON'), tags, el('label', null, 'Remove tag keys'), remove);
    openModal('Edit tags', form, 'Save', async (close) => {
      const keys = remove.value.split(',').map((key) => key.trim()).filter(Boolean);
      const path = `/api/iam/tags/${type}/${encodeURIComponent(resourceName)}/`;
      if (keys.length) await mutate(path, 'DELETE', { tag_keys: keys }, 'Tags removed');
      if (tags.value.trim()) await mutate(path, 'POST', { tags: JSON.parse(tags.value) }, 'Tags updated');
      close();
    });
  }

  function showCreateUserModal() {
    const form = el('div');
    const userInput = document.createElement('input');
    userInput.placeholder = 'charlie';
    const baselineInput = document.createElement('input');
    baselineInput.type = 'checkbox';
    baselineInput.checked = true;
    form.append(
      el('label', null, 'User name'),
      userInput,
      el('label', null, 'Add sts:GetCallerIdentity baseline policy'),
      baselineInput,
    );
    openModal('Create user', form, 'Create', async (close) => {
      const data = await apiJson('/api/iam/users/', {
        method: 'POST',
        body: JSON.stringify({
          user_name: userInput.value.trim(),
          add_baseline_policy: baselineInput.checked,
        }),
      });
      close();
      state.selectedType = 'user';
      state.selectedName = data.user_name;
      state.selectedPolicy = null;
      toast('User created');
      await refresh();
    });
  }

  function showUseUserIdentityModal(user) {
    const form = el('div');
    const note = el('p', 'iam-empty iam-empty-compact', 'Create a session access key for this user without deleting existing keys. If the user already has the maximum number of keys, enter one key ID to replace.');
    const replaceInput = document.createElement('input');
    replaceInput.placeholder = 'optional access key ID to replace';
    form.append(note, el('label', null, 'Replace access key ID'), replaceInput);
    openModal('Use this user', form, 'Use user', async (close) => {
      await useUserIdentity(user, replaceInput.value.trim());
      close();
    });
  }

  async function useUserIdentity(user, replaceAccessKeyId = '') {
    await apiJson('/api/session-identity/use-user/', {
      method: 'POST',
      body: JSON.stringify({
        user_name: user.name,
        replace_access_key_id: replaceAccessKeyId || null,
      }),
    });
    toast(`Dashboard identity switched to ${user.name}`);
    window.location.reload();
  }

  async function useRoleIdentity(role) {
    await apiJson('/api/session-identity/assume-role/', {
      method: 'POST',
      body: JSON.stringify({
        role_name: role.name,
        role_arn: role.arn,
        session_name: 'floci-session',
      }),
    });
    toast(`Dashboard identity switched to ${role.name}`);
    window.location.reload();
  }

  function trustTemplateDocument(template) {
    const service = template === 'ec2' ? 'ec2.amazonaws.com' : 'lambda.amazonaws.com';
    if (template === 'account-root') {
      return {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { AWS: 'arn:aws:iam::000000000000:root' },
          Action: 'sts:AssumeRole',
        }],
      };
    }
    return {
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: { Service: service },
        Action: 'sts:AssumeRole',
      }],
    };
  }

  function option(parent, value, label) {
    const item = document.createElement('option');
    item.value = value;
    item.textContent = label;
    parent.append(item);
  }

  function showCreateRoleModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'local-app-role';
    const templateSelect = document.createElement('select');
    option(templateSelect, 'lambda', 'Lambda service');
    option(templateSelect, 'ec2', 'EC2 service');
    option(templateSelect, 'account-root', 'Account root / STS testing');
    option(templateSelect, 'custom', 'Custom JSON');
    const trustInput = document.createElement('textarea');
    trustInput.value = JSON.stringify(trustTemplateDocument('lambda'), null, 2);
    templateSelect.addEventListener('change', () => {
      if (templateSelect.value !== 'custom') {
        trustInput.value = JSON.stringify(trustTemplateDocument(templateSelect.value), null, 2);
      }
    });
    form.append(el('label', null, 'Role name'), nameInput, el('label', null, 'Trust template'), templateSelect, el('label', null, 'Trust policy JSON'), trustInput);
    openModal('Create role', form, 'Create', async (close) => {
      const data = await apiJson('/api/iam/roles/', {
        method: 'POST',
        body: JSON.stringify({
          role_name: nameInput.value.trim(),
          trust_template: templateSelect.value,
          trust_policy: templateSelect.value === 'custom' ? JSON.parse(trustInput.value) : null,
        }),
      });
      close();
      state.selectedType = 'role';
      state.selectedName = data.role_name;
      state.selectedPolicy = null;
      toast('Role created');
      await refresh();
    });
  }

  function showCreateGroupModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'local-developers';
    form.append(el('label', null, 'Group name'), nameInput);
    openModal('Create group', form, 'Create', async (close) => {
      const data = await apiJson('/api/iam/groups/', {
        method: 'POST',
        body: JSON.stringify({ group_name: nameInput.value.trim() }),
      });
      close();
      state.selectedType = 'group';
      state.selectedName = data.group_name;
      state.selectedPolicy = null;
      toast('Group created');
      await refresh();
    });
  }

  function showCreateInstanceProfileModal() {
    const form = el('div');
    const profileInput = document.createElement('input');
    profileInput.placeholder = 'local-ec2-profile';
    const roleInput = document.createElement('input');
    roleInput.placeholder = 'optional role name';
    form.append(el('label', null, 'Instance profile name'), profileInput, el('label', null, 'Role to add'), roleInput);
    openModal('Create instance profile', form, 'Create', async (close) => {
      const data = await apiJson('/api/iam/instance-profiles/', {
        method: 'POST',
        body: JSON.stringify({ instance_profile_name: profileInput.value.trim() }),
      });
      if (roleInput.value.trim()) {
        await apiJson(`/api/iam/instance-profiles/${encodeURIComponent(data.instance_profile_name)}/roles/`, {
          method: 'POST',
          body: JSON.stringify({ role_name: roleInput.value.trim() }),
        });
      }
      close();
      toast('Instance profile created');
      await refresh();
    });
  }

  function showAddRoleToInstanceProfileModal(profile) {
    const form = el('div');
    const roleInput = document.createElement('input');
    roleInput.placeholder = 'FlociEc2Role';
    form.append(el('label', null, 'Role name'), roleInput);
    openModal('Add role to instance profile', form, 'Add role', async (close) => {
      await apiJson(`/api/iam/instance-profiles/${encodeURIComponent(profile.name)}/roles/`, {
        method: 'POST',
        body: JSON.stringify({ role_name: roleInput.value.trim() }),
      });
      close();
      toast('Role added to instance profile');
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
    const sessionPolicyInput = document.createElement('textarea');
    sessionPolicyInput.placeholder = '{\n  "Version": "2012-10-17",\n  "Statement": []\n}';
    const sessionPolicyArnsInput = document.createElement('textarea');
    sessionPolicyArnsInput.placeholder = '[{"arn":"arn:aws:iam::000000000000:policy/example"}]';
    form.append(
      el('label', null, 'Role ARN'),
      el('pre', 'iam-arn-preview', role.arn),
      el('label', null, 'Session name'),
      sessionInput,
      el('label', null, 'Duration seconds'),
      durationInput,
      el('label', null, 'Session policy JSON'),
      sessionPolicyInput,
      el('label', null, 'Session policy ARNs JSON'),
      sessionPolicyArnsInput,
    );
    openModal('Assume role', form, 'Assume', async (close) => {
      const sessionPolicy = sessionPolicyInput.value.trim()
        ? JSON.parse(sessionPolicyInput.value)
        : null;
      const sessionPolicyArns = sessionPolicyArnsInput.value.trim()
        ? JSON.parse(sessionPolicyArnsInput.value)
        : null;
      const data = await apiJson(`/api/iam/roles/${encodeURIComponent(role.name)}/assume/`, {
        method: 'POST',
        body: JSON.stringify({
          role_arn: role.arn,
          session_name: sessionInput.value.trim(),
          duration_seconds: durationInput.value ? Number(durationInput.value) : null,
          session_policy: sessionPolicy,
          session_policy_arns: sessionPolicyArns,
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

  function showPermissionsBoundaryModal(principal) {
    const form = el('div');
    const policyInput = document.createElement('input');
    policyInput.value = principal.permissions_boundary?.PermissionsBoundaryArn || principal.permissions_boundary || '';
    policyInput.placeholder = 'arn:aws:iam::aws:policy/PowerUserAccess';
    form.append(el('label', null, 'Boundary policy ARN'), policyInput);
    openModal('Set permissions boundary', form, 'Save', async (close) => {
      await apiJson(`/api/iam/principals/${encodeURIComponent(state.selectedType)}/${encodeURIComponent(principal.name)}/permissions-boundary/`, {
        method: 'PUT',
        body: JSON.stringify({ policy_arn: policyInput.value.trim() }),
      });
      close();
      toast('Permissions boundary saved');
      await refresh();
    });
  }

  function clearPermissionsBoundary(principal) {
    openModal('Clear permissions boundary', el('p', null, `Clear the permissions boundary for ${principal.name}?`), 'Clear', async (close) => {
      await apiJson(`/api/iam/principals/${encodeURIComponent(state.selectedType)}/${encodeURIComponent(principal.name)}/permissions-boundary/`, {
        method: 'DELETE',
        body: JSON.stringify({}),
      });
      close();
      toast('Permissions boundary cleared');
      await refresh();
    });
  }

  function showTrustPolicyModal(role) {
    const form = el('div');
    const documentInput = document.createElement('textarea');
    documentInput.value = JSON.stringify(parsePolicyDocument(role.trust_policy) || {
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: { Service: 'lambda.amazonaws.com' },
        Action: 'sts:AssumeRole',
      }],
    }, null, 2);
    form.append(el('label', null, 'Trust policy JSON'), documentInput);
    openModal('Edit trust policy', form, 'Save', async (close) => {
      await apiJson(`/api/iam/roles/${encodeURIComponent(role.name)}/trust-policy/`, {
        method: 'PUT',
        body: JSON.stringify({ document: JSON.parse(documentInput.value) }),
      });
      close();
      toast('Trust policy saved');
      await refresh();
    });
  }

  function showAddUserToGroupModal(options = {}) {
    const form = el('div');
    const userInput = document.createElement('input');
    const groupInput = document.createElement('input');
    userInput.value = options.userName || '';
    groupInput.value = options.groupName || '';
    userInput.placeholder = 'alice';
    groupInput.placeholder = 'admins';
    form.append(el('label', null, 'User name'), userInput, el('label', null, 'Group name'), groupInput);
    openModal('Add user to group', form, 'Add', async (close) => {
      await apiJson(`/api/iam/groups/${encodeURIComponent(groupInput.value.trim())}/members/`, {
        method: 'POST',
        body: JSON.stringify({ user_name: userInput.value.trim() }),
      });
      close();
      toast('User added to group');
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

  function showCreatePolicyVersionModal(policy) {
    const form = el('div');
    const documentInput = document.createElement('textarea');
    documentInput.value = '{\n  "Version": "2012-10-17",\n  "Statement": []\n}';
    const defaultInput = document.createElement('input');
    defaultInput.type = 'checkbox';
    defaultInput.checked = true;
    form.append(
      el('label', null, 'Policy ARN'),
      el('pre', 'iam-arn-preview', policy.arn),
      el('label', null, 'Policy document JSON'),
      documentInput,
      el('label', null, 'Set as default'),
      defaultInput,
    );
    openModal('Create policy version', form, 'Create', async (close) => {
      await apiJson('/api/iam/policies/versions/', {
        method: 'POST',
        body: JSON.stringify({
          policy_arn: policy.arn,
          document: JSON.parse(documentInput.value),
          set_as_default: defaultInput.checked,
        }),
      });
      close();
      toast('Policy version created');
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

  function confirmRemoveUserFromGroup(userName, groupName) {
    openModal('Remove user from group', el('p', null, `Remove ${userName} from ${groupName}?`), 'Remove', async (close) => {
      await apiJson(`/api/iam/groups/${encodeURIComponent(groupName)}/members/`, {
        method: 'DELETE',
        body: JSON.stringify({ user_name: userName }),
      });
      close();
      toast('User removed from group');
      await refresh();
    });
  }

  async function setDefaultPolicyVersion(policy, version) {
    await apiJson('/api/iam/policies/versions/detail/', {
      method: 'PUT',
      body: JSON.stringify({ policy_arn: policy.arn, version_id: version.id }),
    });
    toast('Default policy version updated');
    await refresh();
  }

  function confirmDeletePolicyVersion(policy, version) {
    openModal('Delete policy version', el('p', null, `Delete ${version.id} from ${policy.name || policy.arn}?`), 'Delete', async (close) => {
      await apiJson('/api/iam/policies/versions/detail/', {
        method: 'DELETE',
        body: JSON.stringify({ policy_arn: policy.arn, version_id: version.id }),
      });
      close();
      toast('Policy version deleted');
      await refresh();
    });
  }

  function cleanupPath(principal) {
    if (state.selectedType === 'user') {
      return `/api/iam/users/${encodeURIComponent(principal.name)}/`;
    }
    if (state.selectedType === 'role') {
      return `/api/iam/roles/${encodeURIComponent(principal.name)}/`;
    }
    if (state.selectedType === 'group') {
      return `/api/iam/groups/${encodeURIComponent(principal.name)}/`;
    }
    return null;
  }

  function confirmCleanupPrincipal(principal) {
    const path = cleanupPath(principal);
    if (!path) {
      return;
    }
    const label = state.selectedType;
    openModal(`Clean up ${label}`, el('p', null, `Delete ${principal.name} and clean up dependent IAM resources first?`), 'Delete', async (close) => {
      await apiJson(path, {
        method: 'DELETE',
        body: JSON.stringify({ force: true }),
      });
      close();
      toast(`${label} deleted`);
      state.selectedName = '';
      state.selectedPolicy = null;
      await refresh();
    });
  }

  function renderPermissionTest(principal) {
    if (!principal || !['user', 'role'].includes(state.selectedType)) {
      return null;
    }
    const wrapper = el('div', 'iam-policy-list-wrap');
    wrapper.append(el('h3', null, 'Test permission'));
    const actionInput = document.createElement('input');
    actionInput.placeholder = 's3:ListAllMyBuckets';
    const resourceInput = document.createElement('input');
    resourceInput.placeholder = '*';
    const result = el('pre', 'iam-policy-json', 'No test run yet.');
    wrapper.append(el('label', null, 'Action names'), actionInput, el('label', null, 'Resource ARNs'), resourceInput);
    wrapper.append(btn('Test permission', 'iam-btn-secondary', async () => {
      try {
        const data = await apiJson('/api/iam/policy-simulation/', {
          method: 'POST',
          body: JSON.stringify({
            principal_arn: principal.arn,
            action_names: actionInput.value.trim(),
            resource_arns: resourceInput.value.trim() || '*',
          }),
        });
        result.textContent = pretty(data);
        toast(data.supported === false ? 'Policy simulation unavailable' : 'Permission tested', data.supported === false);
      } catch (error) {
        result.textContent = error.message;
        toast(error.message, true);
      }
    }));
    wrapper.append(result);
    return wrapper;
  }

  function renderPrincipalTypeTabs() {
    const tabs = el('div', 'iam-principal-tabs');
    principalTypes.forEach(([type, label]) => {
      const tab = el('button', state.selectedType === type ? 'iam-principal-tab-active' : null, label);
      tab.addEventListener('click', () => {
        state.selectedType = type;
        state.selectedName = '';
        state.selectedPolicy = null;
        state.principalFilterText = '';
        state.selectedPrincipals.clear();
        render();
      });
      tabs.append(tab);
    });
    return tabs;
  }

  function principalKey(type, principal) {
    return `${type}:${principal.name || principal.arn || ''}`;
  }

  function principalSearchText(principal) {
    return [
      principal.name,
      principal.arn,
      principal.status,
      principal.default_version,
      principal.attachment_count,
      principal.groups,
      principal.users,
      principal.attached_policies,
      principal.inline_policies,
      principal.access_keys,
      principal.instance_profiles,
    ].map((value) => typeof value === 'string' ? value : JSON.stringify(value || '')).join(' ').toLowerCase();
  }

  function principalStatus(type, principal) {
    if (type === 'user') {
      return `${(principal.access_keys || []).length} access keys`;
    }
    if (type === 'group') {
      return `${(principal.users || []).length} users`;
    }
    if (type === 'role') {
      return `${(principal.instance_profiles || []).length} instance profiles`;
    }
    if (type === 'profile') {
      return 'Available';
    }
    return `Default ${principal.default_version || 'unknown'}`;
  }

  function principalPolicyCount(type, principal) {
    if (type === 'policy') {
      return principal.attachment_count || 0;
    }
    if (type === 'profile') {
      return (principal.roles || []).length;
    }
    return (principal.attached_policies || []).length + (principal.inline_policies || []).length;
  }

  function selectPrincipal(type, principal) {
    state.selectedType = type;
    state.selectedName = principal.name;
    state.selectedPolicy = null;
    render();
  }

  function renderPrincipalTable(type, items) {
    const visibleItems = state.principalFilterText
      ? items.filter((item) => principalSearchText(item).includes(state.principalFilterText.trim().toLowerCase()))
      : items;
    const wrapper = el('div', 'iam-principal-table-wrap');
    const table = el('table', 'iam-principal-table');
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const selectHead = document.createElement('th');
    selectHead.className = 'iam-principal-check';
    const selectAll = document.createElement('input');
    selectAll.type = 'checkbox';
    selectAll.setAttribute('aria-label', 'Select all visible principals');
    selectAll.checked = Boolean(visibleItems.length) && visibleItems.every((principal) => state.selectedPrincipals.has(principalKey(type, principal)));
    selectAll.indeterminate = !selectAll.checked && visibleItems.some((principal) => state.selectedPrincipals.has(principalKey(type, principal)));
    selectAll.addEventListener('change', () => {
      visibleItems.forEach((principal) => {
        const key = principalKey(type, principal);
        if (selectAll.checked) {
          state.selectedPrincipals.add(key);
        } else {
          state.selectedPrincipals.delete(key);
        }
      });
      render();
    });
    selectHead.append(selectAll);
    headRow.append(selectHead);
    ['Name', 'Type', 'ARN', 'Status', type === 'profile' ? 'Roles' : 'Policies'].forEach((label) => {
      const th = document.createElement('th');
      th.textContent = label;
      headRow.append(th);
    });
    thead.append(headRow);

    const tbody = document.createElement('tbody');
    visibleItems.forEach((principal) => {
      const key = principalKey(type, principal);
      const active = type === state.selectedType && principal.name === selectedPrincipal()?.name;
      const row = document.createElement('tr');
      if (active) {
        row.classList.add('iam-principal-row-active');
      }
      if (state.selectedPrincipals.has(key)) {
        row.classList.add('iam-principal-row-selected');
      }
      const selectCell = document.createElement('td');
      selectCell.className = 'iam-principal-check';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = state.selectedPrincipals.has(key);
      checkbox.setAttribute('aria-label', `Select ${principal.name || principal.arn || type}`);
      checkbox.addEventListener('click', (event) => event.stopPropagation());
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          state.selectedPrincipals.add(key);
        } else {
          state.selectedPrincipals.delete(key);
        }
        render();
      });
      selectCell.append(checkbox);

      const nameCell = document.createElement('td');
      nameCell.className = 'iam-principal-primary-cell';
      const link = document.createElement('a');
      link.href = '#';
      link.className = 'iam-principal-primary-link';
      link.textContent = principal.name || principal.arn || 'Unnamed';
      link.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectPrincipal(type, principal);
      });
      nameCell.append(link);

      const typeCell = document.createElement('td');
      typeCell.textContent = type;
      const arnCell = document.createElement('td');
      arnCell.textContent = principal.arn || '—';
      const statusCell = document.createElement('td');
      statusCell.textContent = principalStatus(type, principal);
      const policiesCell = document.createElement('td');
      policiesCell.textContent = String(principalPolicyCount(type, principal));
      row.append(selectCell, nameCell, typeCell, arnCell, statusCell, policiesCell);
      row.addEventListener('click', () => selectPrincipal(type, principal));
      tbody.append(row);
    });
    table.append(thead, tbody);
    wrapper.append(table);
    if (!visibleItems.length) {
      wrapper.append(el('div', 'iam-empty iam-empty-compact', state.principalFilterText ? `No ${type}s match this filter.` : `No ${type}s found.`));
    }
    return wrapper;
  }

  function renderPrincipalSelectionBar() {
    if (!state.selectedPrincipals.size) {
      return null;
    }
    const bar = el('div', 'iam-selected-action-bar');
    bar.append(
      el('strong', null, `${state.selectedPrincipals.size} selected`),
      btn('Clear selection', 'iam-btn-secondary', () => {
        state.selectedPrincipals.clear();
        render();
      }),
    );
    return bar;
  }

  function resourceMeta(type, resource) {
    if (type === 'user') {
      const parts = [
        `${(resource.groups || []).length} groups`,
        `${(resource.attached_policies || []).length + (resource.inline_policies || []).length} policies`,
        `${(resource.access_keys || []).length} access keys`,
      ];
      return parts.join(' / ');
    }
    if (type === 'group') {
      const parts = [
        `${(resource.users || []).length} users`,
        `${(resource.attached_policies || []).length + (resource.inline_policies || []).length} policies`,
      ];
      return parts.join(' / ');
    }
    if (type === 'policy') {
      return `${resource.attachment_count || 0} attachments / default ${resource.default_version || 'unknown'}`;
    }
    return resource.arn || '';
  }

  function selectResource(type, name) {
    state.selectedType = type;
    state.selectedName = name;
    state.selectedPolicy = null;
    render();
  }

  function renderOverviewCard(type, label, items) {
    const card = el('section', 'iam-overview-card');
    const heading = el('div', 'iam-overview-heading');
    heading.append(el('span', null, label), el('strong', null, String(items.length)));
    card.append(heading);

    const list = el('div', 'iam-overview-list');
    if (!items.length) {
      list.append(el('div', 'iam-empty iam-empty-compact', `No ${label.toLowerCase()} found.`));
    } else {
      items.forEach((item) => {
        const name = item.name || item.arn || 'Unnamed';
        const row = el('button', 'iam-overview-row');
        row.append(
          el('span', 'iam-principal-name', name),
          el('span', 'iam-principal-meta', resourceMeta(type, item)),
        );
        row.addEventListener('click', () => selectResource(type, name));
        list.append(row);
      });
    }
    card.append(list);
    return card;
  }

  function renderRelationshipOverview() {
    const wrapper = el('div', 'iam-overview-relationships');
    const relationships = [];
    (state.inventory?.users || []).forEach((user) => {
      (user.groups || []).forEach((groupName) => {
        relationships.push(`${user.name} -> ${groupName}`);
      });
      (user.attached_policies || []).forEach((policy) => {
        relationships.push(`${user.name} -> ${policy.name || policy.arn}`);
      });
    });
    (state.inventory?.groups || []).forEach((group) => {
      (group.attached_policies || []).forEach((policy) => {
        relationships.push(`${group.name} -> ${policy.name || policy.arn}`);
      });
    });

    if (!relationships.length) {
      wrapper.append(el('div', 'iam-empty iam-empty-compact', 'No memberships or managed policy attachments found.'));
      return wrapper;
    }

    relationships.slice(0, 8).forEach((relationship) => {
      wrapper.append(el('span', 'iam-relationship-chip', relationship));
    });
    if (relationships.length > 8) {
      wrapper.append(el('span', 'iam-relationship-chip', `+${relationships.length - 8} more`));
    }
    return wrapper;
  }

  function renderResourceOverview() {
    const panel = el('section', 'iam-panel-console iam-resource-overview');
    const heading = el('div', 'iam-panel-heading-console');
    heading.append(el('span', null, 'Resource overview'), el('span', 'iam-principal-meta', 'Live IAM inventory'));
    panel.append(heading);

    const grid = el('div', 'iam-overview-grid');
    grid.append(
      renderOverviewCard('user', 'Users', state.inventory?.users || []),
      renderOverviewCard('group', 'Groups', state.inventory?.groups || []),
      renderOverviewCard('policy', 'Customer policies', state.inventory?.policies || []),
    );
    panel.append(grid);

    const relationHeading = el('div', 'iam-overview-subheading', 'Relationships');
    panel.append(relationHeading, renderRelationshipOverview());
    return panel;
  }

  function renderPrincipalList() {
    const panel = el('section', 'iam-panel-console');
    const heading = el('div', 'iam-panel-heading-console');
    const refreshedAt = state.loadedAt ? state.loadedAt.toLocaleTimeString() : 'pending';
    heading.append(el('span', null, 'Principal explorer'), el('span', 'iam-principal-meta', `Last refreshed ${refreshedAt}`));
    panel.append(heading);
    panel.append(renderPrincipalTypeTabs());
    const items = principals();
    const filterBar = el('div', 'iam-principal-filter-bar');
    const filter = document.createElement('input');
    filter.type = 'search';
    filter.placeholder = `Find ${state.selectedType}s`;
    filter.value = state.principalFilterText;
    filter.setAttribute('aria-label', `Find ${state.selectedType}s`);
    filter.addEventListener('input', () => {
      state.principalFilterText = filter.value;
      state.principalFilterRestoreFocus = true;
      state.principalFilterSelectionStart = filter.selectionStart;
      state.principalFilterSelectionEnd = filter.selectionEnd;
      render();
    });
    filterBar.append(filter, el('span', 'iam-principal-meta', `${items.length} ${state.selectedType}${items.length === 1 ? '' : 's'}`));
    panel.append(filterBar);
    const selectionBar = renderPrincipalSelectionBar();
    if (selectionBar) {
      panel.append(selectionBar);
    }
    panel.append(renderPrincipalTable(state.selectedType, items));
    if (state.principalFilterRestoreFocus) {
      window.requestAnimationFrame(() => {
        filter.focus();
        if (typeof filter.setSelectionRange === 'function') {
          const start = state.principalFilterSelectionStart ?? filter.value.length;
          const end = state.principalFilterSelectionEnd ?? start;
          filter.setSelectionRange(start, end);
        }
        state.principalFilterRestoreFocus = false;
      });
    }
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

  function renderUserGroups(user) {
    const wrapper = el('div', 'iam-policy-list-wrap');
    wrapper.append(el('h3', null, 'Group membership'));
    const groups = user.groups || [];
    if (!groups.length) {
      wrapper.append(el('div', 'iam-empty iam-empty-compact', 'This user is not in any groups.'));
    }
    groups.forEach((groupName) => {
      const row = el('div', 'iam-policy-row');
      row.append(el('span', 'iam-principal-name', groupName));
      row.append(btn('Remove', 'iam-btn-danger', () => confirmRemoveUserFromGroup(user.name, groupName)));
      wrapper.append(row);
    });
    wrapper.append(btn('Add to group', 'iam-btn-secondary', () => showAddUserToGroupModal({ userName: user.name })));
    return wrapper;
  }

  function renderGroupUsers(group) {
    const wrapper = el('div', 'iam-policy-list-wrap');
    wrapper.append(el('h3', null, 'Users'));
    const users = group.users || [];
    if (!users.length) {
      wrapper.append(el('div', 'iam-empty iam-empty-compact', 'No users in this group.'));
    }
    users.forEach((userName) => {
      const row = el('div', 'iam-policy-row');
      row.append(el('span', 'iam-principal-name', userName));
      row.append(btn('Remove', 'iam-btn-danger', () => confirmRemoveUserFromGroup(userName, group.name)));
      wrapper.append(row);
    });
    wrapper.append(btn('Add user', 'iam-btn-secondary', () => showAddUserToGroupModal({ groupName: group.name })));
    return wrapper;
  }

  function renderPolicyVersions(policy) {
    const wrapper = el('div', 'iam-policy-list-wrap');
    wrapper.append(el('h3', null, 'Policy versions'));
    const versions = policy.versions || [];
    if (!versions.length) {
      wrapper.append(el('div', 'iam-empty iam-empty-compact', 'No policy versions found.'));
    }
    versions.forEach((version) => {
      const row = el('div', 'iam-policy-row');
      row.append(
        btn(`${version.id}${version.default ? ' (default)' : ''}`, 'iam-btn-secondary', () => loadManagedPolicy(policy, version.id).catch((error) => toast(error.message, true))),
      );
      if (!version.default) {
        row.append(btn('Set default', 'iam-btn-secondary', () => setDefaultPolicyVersion(policy, version).catch((error) => toast(error.message, true))));
        row.append(btn('Delete', 'iam-btn-danger', () => confirmDeletePolicyVersion(policy, version)));
      }
      wrapper.append(row);
    });
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
        const usage = key.last_used || {};
        const lastUsed = usage.LastUsedDate ? `Last used ${consoleUi.formatDate(usage.LastUsedDate)}${usage.ServiceName ? ` · ${usage.ServiceName}` : ''}` : 'Never used';
        row.append(el('span', 'iam-principal-name', key.id), el('span', 'iam-principal-meta', `${key.status || 'Unknown'} · ${lastUsed}`));
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

  function renderPrincipalActions(principal) {
    const actions = el('div', 'iam-principal-actions');
    if (!principal) {
      return actions;
    }
    if (state.selectedType === 'user') {
      actions.append(
        btn('Use this user', null, () => showUseUserIdentityModal(principal)),
        btn('Update user', 'iam-btn-secondary', () => showUpdateUserModal(principal)),
        btn(principal.login_profile ? 'Update login' : 'Create login', 'iam-btn-secondary', () => showLoginProfileModal(principal)),
        btn('Create access key', 'iam-btn-secondary', () => showCreateAccessKeyModal(principal)),
        btn('Attach managed policy', 'iam-btn-secondary', () => showAttachManagedPolicyModal(principal)),
        btn('Set boundary', 'iam-btn-secondary', () => showPermissionsBoundaryModal(principal)),
        btn('Add inline policy', 'iam-btn-secondary', () => showInlinePolicyModal(principal)),
        btn('Edit tags', 'iam-btn-secondary', () => showTagsModal(principal)),
        btn('Clean up user', 'iam-btn-danger', () => confirmCleanupPrincipal(principal)),
      );
      if (principal.login_profile) {
        actions.append(btn('Delete login', 'iam-btn-danger', async () => {
          if (window.confirm(`Delete the login profile for ${principal.name}?`)) await mutate(`/api/iam/users/${encodeURIComponent(principal.name)}/login-profile/`, 'DELETE', null, 'Login profile deleted');
        }));
      }
      if (principal.permissions_boundary) {
        actions.append(btn('Clear boundary', 'iam-btn-danger', () => clearPermissionsBoundary(principal)));
      }
    } else if (state.selectedType === 'role') {
      actions.append(
        btn('Assume in dashboard', null, () => useRoleIdentity(principal).catch((error) => toast(error.message, true))),
        btn('Get temporary credentials', 'iam-btn-secondary', () => showAssumeRoleModal(principal)),
        btn('Update role', 'iam-btn-secondary', () => showUpdateRoleModal(principal)),
        btn('Attach managed policy', 'iam-btn-secondary', () => showAttachManagedPolicyModal(principal)),
        btn('Set boundary', 'iam-btn-secondary', () => showPermissionsBoundaryModal(principal)),
        btn('Add inline policy', 'iam-btn-secondary', () => showInlinePolicyModal(principal)),
        btn('Edit trust policy', 'iam-btn-secondary', () => showTrustPolicyModal(principal)),
        btn('Edit tags', 'iam-btn-secondary', () => showTagsModal(principal)),
        btn('Clean up role', 'iam-btn-danger', () => confirmCleanupPrincipal(principal)),
      );
      if (principal.permissions_boundary) {
        actions.append(btn('Clear boundary', 'iam-btn-danger', () => clearPermissionsBoundary(principal)));
      }
    } else if (state.selectedType === 'group') {
      actions.append(
        btn('Attach managed policy', 'iam-btn-secondary', () => showAttachManagedPolicyModal(principal)),
        btn('Add inline policy', 'iam-btn-secondary', () => showInlinePolicyModal(principal)),
        btn('Add user', 'iam-btn-secondary', () => showAddUserToGroupModal({ groupName: principal.name })),
        btn('Clean up group', 'iam-btn-danger', () => confirmCleanupPrincipal(principal)),
      );
    } else if (state.selectedType === 'policy') {
      actions.append(
        btn('Open default version', 'iam-btn-secondary', () => loadManagedPolicy(principal).catch((error) => toast(error.message, true))),
        btn('Create version', 'iam-btn-secondary', () => showCreatePolicyVersionModal(principal)),
        btn('Edit tags', 'iam-btn-secondary', () => showTagsModal(principal)),
        btn('Delete policy', 'iam-btn-danger', async () => {
          if (window.confirm(`Delete managed policy ${principal.name}?`)) {
            state.selectedName = '';
            await mutate('/api/iam/policies/', 'DELETE', { policy_arn: principal.arn }, 'Managed policy deleted');
          }
        }),
      );
    } else if (state.selectedType === 'profile') {
      actions.append(btn('Add role', 'iam-btn-secondary', () => showAddRoleToInstanceProfileModal(principal)));
      (principal.roles || []).forEach((role) => {
        const roleName = role.name || role.RoleName || role;
        actions.append(btn(`Remove ${roleName}`, 'iam-btn-secondary', async () => {
          await mutate(`/api/iam/instance-profiles/${encodeURIComponent(principal.name)}/roles/`, 'DELETE', { role_name: roleName }, 'Role removed from instance profile');
        }));
      });
      actions.append(btn('Delete profile', 'iam-btn-danger', async () => {
        if (window.confirm(`Delete instance profile ${principal.name}?`)) {
          state.selectedName = '';
          await mutate(`/api/iam/instance-profiles/${encodeURIComponent(principal.name)}/`, 'DELETE', null, 'Instance profile deleted');
        }
      }));
    }
    return actions;
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

    content.append(renderPrincipalActions(principal));

    const details = document.createElement('dl');
    consoleUi.addField(details, 'ARN', principal.arn);
    consoleUi.addField(details, 'Created', consoleUi.formatDate(principal.created));
    if (state.selectedType === 'user') {
      consoleUi.addField(details, 'Groups', principal.groups);
      consoleUi.addField(details, 'Path', principal.path);
      consoleUi.addField(details, 'Login profile', principal.login_profile ? 'Configured' : 'Not configured');
    }
    if (state.selectedType === 'group') {
      consoleUi.addField(details, 'Users', principal.users);
    }
    if (['user', 'role'].includes(state.selectedType)) {
      consoleUi.addField(details, 'Permission boundary', principal.permissions_boundary);
    }
    if (state.selectedType === 'role') {
      consoleUi.addField(details, 'Instance profiles', principal.instance_profiles);
      consoleUi.addField(details, 'Description', principal.description);
      consoleUi.addField(details, 'Maximum session duration', principal.max_session_duration);
    }
    if (state.selectedType === 'policy') {
      consoleUi.addField(details, 'Default version', principal.default_version);
      consoleUi.addField(details, 'Attachment count', principal.attachment_count);
    }
    if (state.selectedType === 'profile') {
      consoleUi.addField(details, 'Roles', (principal.roles || []).map((role) => role.name || role.RoleName || role));
    }
    content.append(details);

    if (state.selectedType === 'policy') {
      content.append(renderPolicyVersions(principal));
    } else if (state.selectedType !== 'profile') {
      content.append(renderPolicyList(principal));
    }
    if (state.selectedType === 'user') {
      content.append(renderUserGroups(principal));
      content.append(renderAccessKeys(principal));
      content.append(renderPermissionTest(principal));
    }
    if (state.selectedType === 'group') {
      content.append(renderGroupUsers(principal));
    }
    if (state.selectedType === 'role') {
      const assumed = renderAssumeRoleResult();
      if (assumed) {
        content.append(assumed);
      }
      content.append(renderPermissionTest(principal));
    }
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const principal = selectedPrincipal();
    const container = el('div');
    const rightButtons = [];
    rightButtons.push(btn('Create user', 'iam-btn-secondary', showCreateUserModal));
    rightButtons.push(btn('Create group', 'iam-btn-secondary', showCreateGroupModal));
    rightButtons.push(btn('Create role', 'iam-btn-secondary', showCreateRoleModal));
    rightButtons.push(btn('Create instance profile', 'iam-btn-secondary', showCreateInstanceProfileModal));
    rightButtons.push(btn('Create managed policy', 'iam-btn-secondary', showCreateManagedPolicyModal));
    container.append(toolbar([], rightButtons));

    const workbench = el('div', 'iam-workbench');
    const detail = el('div', 'iam-detail-stack');
    detail.append(renderPrincipalDetail(principal));
    if (state.selectedType !== 'profile') {
      detail.append(renderPolicyViewer());
    }
    workbench.append(renderPrincipalList(), detail);
    const users = state.inventory?.users || [];
    if (!users.length) {
      container.append(renderAdminFirstCallout());
    }
    container.append(workbench);
    return container;
  }

  function renderAdminFirstCallout() {
    const panel = el('section', 'iam-admin-first-callout');
    panel.append(
      el('div', 'iam-admin-first-eyebrow', 'First IAM step'),
      el('h2', null, 'Create an admin user before daily work'),
      el('p', null, 'A fresh local Floci account starts with bootstrap root-like credentials. The AWS habit is to use those credentials only long enough to create an administrator identity, then do normal work as that user.'),
    );
    const actions = el('div', 'iam-admin-first-actions');
    const labs = el('a', 'iam-btn-secondary', 'Open IAM labs');
    labs.href = '/service/iam/labs/';
    actions.append(
      labs,
      btn('Create user', 'iam-btn-secondary', showCreateUserModal),
    );
    panel.append(actions);
    return panel;
  }

  function render() {
    if (!root) {
      return;
    }
    renderBreadcrumbs();
    root.textContent = '';
    root.append(renderWorkbench());
    if (loadedAtEl) {
      const loadedAt = state.loadedAt ? state.loadedAt.toLocaleTimeString() : new Date().toLocaleTimeString();
      loadedAtEl.textContent = `Loaded ${loadedAt}`;
    }
  }

  async function returnToDefaultIdentity() {
    await apiJson('/api/session-identity/use-admin/', { method: 'POST' });
    toast('Dashboard identity restored to floci-admin or root');
    window.location.reload();
  }

  function renderIdentityRecovery(error) {
    if (!root) {
      return;
    }
    renderBreadcrumbs();
    root.textContent = '';
    const panel = el('section', 'iam-panel-console iam-identity-recovery');
    const heading = el('div', 'iam-panel-heading-console');
    heading.append(
      el('span', null, 'Restore IAM access'),
      el('span', 'iam-principal-meta', 'Current session identity is restricted'),
    );
    const content = el('div', 'iam-principal-detail');
    content.append(
      el('p', 'iam-empty iam-empty-compact', error.message || 'The active identity cannot load IAM inventory.'),
      el('p', 'iam-identity-recovery-help', 'Clear the current user or assumed-role session and return to the configured floci-admin profile. If that profile is not configured, the dashboard falls back to its root-like bootstrap credentials.'),
      btn('Switch to floci-admin / root', null, () => returnToDefaultIdentity().catch((resetError) => toast(resetError.message, true))),
    );
    panel.append(heading, content);
    root.append(panel);
    if (loadedAtEl) {
      loadedAtEl.textContent = 'IAM inventory blocked by active identity';
    }
  }

  async function refresh() {
    try {
      const data = await apiJson('/api/iam/');
      state.inventory = data;
      state.loadedAt = new Date();
      if (!selectedPrincipal() && principals().length) {
        state.selectedName = principals()[0].name;
      }
      renderSummary(data.summary || {});
      render();
      return data;
    } catch (error) {
      state.inventory = null;
      if (summaryEl) {
        summaryEl.textContent = '';
      }
      renderIdentityRecovery(error);
      return null;
    }
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'iam-empty', 'Loading...'));
    refresh();
  }

  return { init, refresh };
})();

window.IAMConsole = IAMConsole;

if (document.getElementById('iam-console-root')) {
  IAMConsole.init();
}
