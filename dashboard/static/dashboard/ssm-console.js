/* global ServiceConsole */

const SSMConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('ssm-console-root');
  const breadcrumbsEl = document.getElementById('ssm-breadcrumbs');
  const summaryEl = document.getElementById('ssm-summary');
  const loadedAtEl = document.getElementById('ssm-loaded-at');

  const state = {
    inventory: null,
    selectedParameterName: '',
    revealed: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'ssm',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'ssm');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'ssm',
      toast,
    });

  function parameters() {
    return state.inventory?.parameters || [];
  }

  function parameterName(parameter) {
    return parameter?.name || '';
  }

  function selectedParameter() {
    return parameters().find((parameter) => parameterName(parameter) === state.selectedParameterName) || parameters()[0] || null;
  }

  function parameterPath(parameter) {
    return encodeURIComponent(parameterName(parameter));
  }

  function parseParameterValue(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      throw new Error('Parameter value is required');
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
    const home = el('button', null, 'AWS Systems Manager');
    home.addEventListener('click', () => {
      state.selectedParameterName = parameters()[0] ? parameterName(parameters()[0]) : '';
      state.revealed = null;
      render();
    });
    breadcrumbsEl.append(home);
    const parameter = selectedParameter();
    if (parameter) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, parameterName(parameter)));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'ssm',
      targets: {
        parameters: 'Parameters',
        documents: 'Documents',
        managed_instances: 'Managed instances',
        sessions: 'Sessions',
        automations: 'Automation executions',
        commands: 'Commands',
        ops_items: 'Ops items',
      },
    });
  }

  function parameterTypeSelect(value = 'String') {
    const select = document.createElement('select');
    ['String', 'StringList', 'SecureString'].forEach((type) => {
      select.append(new Option(type, type));
    });
    select.value = value || 'String';
    return select;
  }

  function showParameterModal(parameter = null) {
    const isUpdate = !!parameter;
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.required = true;
    nameInput.placeholder = '/local/app/config';
    nameInput.value = parameter ? parameterName(parameter) : '';
    nameInput.disabled = isUpdate;
    const typeInput = parameterTypeSelect(parameter?.type || 'String');
    const descriptionInput = document.createElement('input');
    descriptionInput.placeholder = 'Local app configuration';
    descriptionInput.value = parameter?.description || '';
    const overwriteInput = document.createElement('input');
    overwriteInput.type = 'checkbox';
    overwriteInput.checked = isUpdate;
    const overwriteLabel = el('label', 'ssm-checkbox');
    overwriteLabel.append(overwriteInput, el('span', null, 'Overwrite existing parameter'));
    const valueInput = document.createElement('textarea');
    valueInput.className = 'ssm-value-input';
    valueInput.value = state.revealed?.name === parameterName(parameter)
      ? (typeof state.revealed.json === 'object' && state.revealed.json !== null
        ? JSON.stringify(state.revealed.json, null, 2)
        : state.revealed.value || '')
      : '';
    valueInput.placeholder = isUpdate ? 'New parameter value' : '{"feature_enabled":true}';

    form.append(
      el('label', null, 'Parameter name'),
      nameInput,
      el('label', null, 'Type'),
      typeInput,
      el('label', null, 'Description'),
      descriptionInput,
      el('label', null, 'Value'),
      valueInput,
    );
    if (!isUpdate) {
      form.append(overwriteLabel);
    }

    openModal(isUpdate ? 'Update parameter' : 'Create parameter', form, isUpdate ? 'Update value' : 'Create parameter', async (close) => {
      const payload = {
        name: nameInput.value.trim(),
        type: typeInput.value,
        description: descriptionInput.value.trim(),
        value: parseParameterValue(valueInput.value),
        overwrite: overwriteInput.checked,
      };
      if (isUpdate) {
        await apiJson(`/api/ssm/parameters/${parameterPath(parameter)}/value/`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiJson('/api/ssm/parameters/', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      close();
      toast(isUpdate ? 'Parameter updated' : 'Parameter saved');
      state.selectedParameterName = nameInput.value.trim();
      state.revealed = null;
      await refresh();
    });
  }

  function showDeleteParameterModal(parameter) {
    const body = el('div');
    body.append(el('p', 'ssm-warning', `Delete ${parameterName(parameter)}?`));
    openModal('Delete parameter', body, 'Delete parameter', async (close) => {
      await apiJson(`/api/ssm/parameters/${parameterPath(parameter)}/value/`, { method: 'DELETE' });
      close();
      toast('Parameter deleted');
      state.selectedParameterName = '';
      state.revealed = null;
      await refresh();
    });
  }

  async function revealParameter(parameter) {
    const data = await apiJson(`/api/ssm/parameters/${parameterPath(parameter)}/value/`);
    state.revealed = data;
    toast('Parameter value loaded');
    render();
  }

  function renderParameterRow(parameter) {
    const name = parameterName(parameter);
    const active = name === parameterName(selectedParameter());
    const row = el('button', `ssm-parameter-row${active ? ' ssm-parameter-row-active' : ''}`);
    row.append(
      el('span', 'ssm-parameter-name', name || 'Unnamed parameter'),
      el('span', 'ssm-parameter-meta', `${parameter.type || 'Unknown'} / version ${parameter.version || 'n/a'}`),
    );
    row.addEventListener('click', () => {
      state.selectedParameterName = name;
      state.revealed = null;
      render();
    });
    return row;
  }

  function renderParameterList() {
    const panel = el('section', 'ssm-panel');
    panel.append(el('div', 'ssm-panel-heading', 'Parameters'));
    const list = el('div', 'ssm-parameter-list');
    if (!parameters().length) {
      list.append(el('div', 'ssm-empty', 'No parameters found.'));
    } else {
      parameters().forEach((parameter) => list.append(renderParameterRow(parameter)));
    }
    panel.append(list);
    return panel;
  }

  function renderRevealedValue(parameter) {
    if (!state.revealed || state.revealed.name !== parameterName(parameter)) {
      return el('div', 'ssm-empty ssm-empty-compact', 'Reveal the selected local parameter value when you need to debug an app read.');
    }
    const card = el('article', 'ssm-value-card');
    const heading = el('div', 'ssm-value-heading');
    heading.append(
      el('h4', null, 'Revealed value'),
      el('span', 'ssm-parameter-meta', `${state.revealed.type} / ${consoleUi.formatBytes(state.revealed.size_bytes)}`),
    );
    const details = document.createElement('dl');
    consoleUi.addField(details, 'Version', state.revealed.version);
    consoleUi.addField(details, 'Last modified', consoleUi.formatDate(state.revealed.last_modified));
    consoleUi.addField(details, 'JSON', state.revealed.json);
    consoleUi.addField(details, 'Value', state.revealed.value);
    card.append(heading, details);
    return card;
  }

  function renderParameterDetail(parameter) {
    const panel = el('section', 'ssm-panel');
    const heading = el('div', 'ssm-panel-heading');
    heading.append(
      el('span', null, parameter ? parameterName(parameter) : 'Parameter Store workbench'),
      el('span', 'ssm-parameter-meta', parameter ? `${parameter.type || 'Unknown'} / version ${parameter.version || 'n/a'}` : 'No parameter selected'),
    );
    panel.append(heading);

    const content = el('div', 'ssm-detail');
    if (!parameter) {
      content.append(el('div', 'ssm-empty', 'Create a parameter or refresh after your app creates one.'));
      panel.append(content);
      return panel;
    }

    const details = document.createElement('dl');
    consoleUi.addField(details, 'Type', parameter.type);
    consoleUi.addField(details, 'Tier', parameter.tier);
    consoleUi.addField(details, 'Version', parameter.version);
    consoleUi.addField(details, 'Data type', parameter.data_type);
    consoleUi.addField(details, 'Description', parameter.description);
    consoleUi.addField(details, 'Last modified', consoleUi.formatDate(parameter.last_modified));
    consoleUi.addField(details, 'Tags', parameter.tags);
    content.append(details);

    const actions = el('div', 'ssm-actions');
    actions.append(
      btn('Reveal value', null, () => revealParameter(parameter).catch((error) => toast(error.message, true))),
      btn('Update value', 'ssm-btn-secondary', () => showParameterModal(parameter)),
      btn('Delete parameter', 'ssm-btn-danger', () => showDeleteParameterModal(parameter)),
    );
    content.append(actions, renderRevealedValue(parameter));
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const parameter = selectedParameter();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create parameter', null, () => showParameterModal()),
        btn('Refresh parameters', 'ssm-btn-secondary', () => refresh().catch((error) => toast(error.message, true))),
      ],
      [],
    ));
    const workbench = el('div', 'ssm-workbench');
    workbench.append(renderParameterList(), renderParameterDetail(parameter));
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
    const data = await apiJson('/api/ssm/');
    state.inventory = data;
    if (!selectedParameter() && parameters().length) {
      state.selectedParameterName = parameterName(parameters()[0]);
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'ssm-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.SSMConsole = SSMConsole;

if (document.getElementById('ssm-console-root')) {
  SSMConsole.init();
}
