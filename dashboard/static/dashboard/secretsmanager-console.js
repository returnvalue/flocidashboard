/* global ServiceConsole */

const SecretsManagerConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('secretsmanager-console-root');
  const breadcrumbsEl = document.getElementById('secretsmanager-breadcrumbs');
  const summaryEl = document.getElementById('secretsmanager-summary');
  const loadedAtEl = document.getElementById('secretsmanager-loaded-at');

  const state = {
    inventory: null,
    selectedSecretName: '',
    revealed: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'secretsmanager',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'secretsmanager');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'secretsmanager',
      toast,
    });

  function secrets() {
    return state.inventory?.secrets || [];
  }

  function secretName(secret) {
    return secret?.name || secret?.arn || '';
  }

  function selectedSecret() {
    return secrets().find((secret) => secretName(secret) === state.selectedSecretName) || secrets()[0] || null;
  }

  function secretPath(secret) {
    return encodeURIComponent(secretName(secret));
  }

  function parseSecretValue(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      throw new Error('Secret value is required');
    }
    if (!['{', '['].includes(trimmed[0])) {
      return trimmed;
    }
    return JSON.parse(trimmed);
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'AWS Secrets Manager');
    home.addEventListener('click', () => {
      state.selectedSecretName = secrets()[0] ? secretName(secrets()[0]) : '';
      state.revealed = null;
      render();
    });
    breadcrumbsEl.append(home);
    const secret = selectedSecret();
    if (secret) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, secretName(secret)));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'secretsmanager',
      targets: {
        secrets: 'Secrets',
        scheduled_for_deletion: 'Secrets',
        rotation_enabled: 'Secrets',
        with_resource_policy: 'Secrets',
        versions: 'Secrets',
      },
    });
  }

  function showCreateSecretModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.required = true;
    nameInput.placeholder = '/local/app/database';
    const descriptionInput = document.createElement('input');
    descriptionInput.placeholder = 'Local app database credentials';
    const kmsInput = document.createElement('input');
    kmsInput.placeholder = 'Optional KMS key ID';
    const valueInput = document.createElement('textarea');
    valueInput.className = 'secretsmanager-value-input';
    valueInput.value = JSON.stringify({ username: 'local', password: 'secret' }, null, 2);

    form.append(
      el('label', null, 'Secret name'),
      nameInput,
      el('label', null, 'Description'),
      descriptionInput,
      el('label', null, 'KMS key ID'),
      kmsInput,
      el('label', null, 'Secret value'),
      valueInput,
    );

    openModal('Create secret', form, 'Create secret', async (close) => {
      await apiJson('/api/secretsmanager/secrets/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          description: descriptionInput.value.trim(),
          kms_key_id: kmsInput.value.trim(),
          value: parseSecretValue(valueInput.value),
        }),
      });
      close();
      toast('Secret created');
      state.selectedSecretName = nameInput.value.trim();
      state.revealed = null;
      await refresh();
    });
  }

  function showUpdateValueModal(secret) {
    const form = el('div');
    const valueInput = document.createElement('textarea');
    valueInput.className = 'secretsmanager-value-input';
    valueInput.value = state.revealed?.name === secretName(secret)
      ? (typeof state.revealed.json === 'object' && state.revealed.json !== null
        ? JSON.stringify(state.revealed.json, null, 2)
        : state.revealed.value || '')
      : '';
    valueInput.placeholder = '{"username":"local","password":"new-secret"}';
    form.append(
      el('label', null, 'Secret'),
      el('pre', 'secretsmanager-secret-preview', secretName(secret)),
      el('label', null, 'New value'),
      valueInput,
    );

    openModal('Update secret value', form, 'Update value', async (close) => {
      await apiJson(`/api/secretsmanager/secrets/${secretPath(secret)}/value/`, {
        method: 'PUT',
        body: JSON.stringify({ value: parseSecretValue(valueInput.value) }),
      });
      close();
      toast('Secret value updated');
      state.revealed = null;
      await refresh();
    });
  }

  function showDeleteSecretModal(secret) {
    const form = el('div');
    const recoveryInput = document.createElement('input');
    recoveryInput.type = 'number';
    recoveryInput.min = '7';
    recoveryInput.max = '30';
    recoveryInput.value = '7';
    const forceInput = document.createElement('input');
    forceInput.type = 'checkbox';
    const forceLabel = el('label', 'secretsmanager-checkbox');
    forceLabel.append(forceInput, el('span', null, 'Force delete without recovery'));
    form.append(
      el('p', 'secretsmanager-warning', `Schedule ${secretName(secret)} for deletion?`),
      el('label', null, 'Recovery window days'),
      recoveryInput,
      forceLabel,
    );

    openModal('Delete secret', form, 'Delete secret', async (close) => {
      await apiJson(`/api/secretsmanager/secrets/${secretPath(secret)}/value/`, {
        method: 'DELETE',
        body: JSON.stringify({
          recovery_window_days: Number(recoveryInput.value || 7),
          force_delete_without_recovery: forceInput.checked,
        }),
      });
      close();
      toast('Secret deletion scheduled');
      state.revealed = null;
      await refresh();
    });
  }

  async function revealSecret(secret) {
    const data = await apiJson(`/api/secretsmanager/secrets/${secretPath(secret)}/value/`);
    state.revealed = data;
    toast('Secret value loaded');
    render();
  }

  function renderSecretRow(secret) {
    const name = secretName(secret);
    const active = name === secretName(selectedSecret());
    const row = el('button', `secretsmanager-secret-row${active ? ' secretsmanager-secret-row-active' : ''}`);
    const flags = [
      secret.deleted ? 'scheduled deletion' : 'active',
      secret.rotation_enabled ? 'rotation on' : 'rotation off',
    ];
    row.append(
      el('span', 'secretsmanager-secret-name', name || 'Unnamed secret'),
      el('span', 'secretsmanager-secret-meta', flags.join(' / ')),
    );
    row.addEventListener('click', () => {
      state.selectedSecretName = name;
      state.revealed = null;
      render();
    });
    return row;
  }

  function renderSecretList() {
    const panel = el('section', 'secretsmanager-panel');
    panel.append(el('div', 'secretsmanager-panel-heading', 'Secrets'));
    const list = el('div', 'secretsmanager-secret-list');
    if (!secrets().length) {
      list.append(el('div', 'secretsmanager-empty', 'No secrets found.'));
    } else {
      secrets().forEach((secret) => list.append(renderSecretRow(secret)));
    }
    panel.append(list);
    return panel;
  }

  function renderRevealedValue(secret) {
    if (!state.revealed || state.revealed.name !== secretName(secret)) {
      return el('div', 'secretsmanager-empty secretsmanager-empty-compact', 'Reveal the selected local secret value when you need to debug an app read.');
    }
    const card = el('article', 'secretsmanager-value-card');
    const heading = el('div', 'secretsmanager-value-heading');
    heading.append(
      el('h4', null, 'Revealed value'),
      el('span', 'secretsmanager-secret-meta', `${state.revealed.type} / ${consoleUi.formatBytes(state.revealed.size_bytes)}`),
    );
    const details = document.createElement('dl');
    consoleUi.addField(details, 'Version ID', state.revealed.version_id);
    consoleUi.addField(details, 'Stages', state.revealed.version_stages);
    consoleUi.addField(details, 'JSON', state.revealed.json);
    consoleUi.addField(details, 'Value', state.revealed.value);
    card.append(heading, details);
    return card;
  }

  function renderSecretDetail(secret) {
    const panel = el('section', 'secretsmanager-panel');
    const heading = el('div', 'secretsmanager-panel-heading');
    heading.append(
      el('span', null, secret ? secretName(secret) : 'Secret workbench'),
      el('span', 'secretsmanager-secret-meta', secret ? (secret.deleted ? 'Scheduled for deletion' : 'Active') : 'No secret selected'),
    );
    panel.append(heading);

    const content = el('div', 'secretsmanager-detail');
    if (!secret) {
      content.append(el('div', 'secretsmanager-empty', 'Create a secret or refresh after your app creates one.'));
      panel.append(content);
      return panel;
    }

    const details = document.createElement('dl');
    consoleUi.addField(details, 'ARN', secret.arn);
    consoleUi.addField(details, 'Description', secret.description);
    consoleUi.addField(details, 'KMS key ID', secret.kms_key_id);
    consoleUi.addField(details, 'Created', consoleUi.formatDate(secret.created));
    consoleUi.addField(details, 'Last changed', consoleUi.formatDate(secret.last_changed));
    consoleUi.addField(details, 'Current value preview', secret.current_value);
    content.append(details);

    const actions = el('div', 'secretsmanager-actions');
    actions.append(
      btn('Reveal value', null, () => revealSecret(secret).catch((error) => toast(error.message, true))),
      btn('Update value', 'secretsmanager-btn-secondary', () => showUpdateValueModal(secret)),
      btn('Delete secret', 'secretsmanager-btn-danger', () => showDeleteSecretModal(secret)),
    );
    content.append(actions, renderRevealedValue(secret));
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const secret = selectedSecret();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create secret', null, showCreateSecretModal),
        btn('Refresh secrets', 'secretsmanager-btn-secondary', () => refresh().catch((error) => toast(error.message, true))),
      ],
      [],
    ));
    const workbench = el('div', 'secretsmanager-workbench');
    workbench.append(renderSecretList(), renderSecretDetail(secret));
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
    const data = await apiJson('/api/secretsmanager/');
    state.inventory = data;
    if (!selectedSecret() && secrets().length) {
      state.selectedSecretName = secretName(secrets()[0]);
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'secretsmanager-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.SecretsManagerConsole = SecretsManagerConsole;

if (document.getElementById('secretsmanager-console-root')) {
  SecretsManagerConsole.init();
}
