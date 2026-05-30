/* global ServiceConsole */

const PipesConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('pipes-console-root');
  const breadcrumbsEl = document.getElementById('pipes-breadcrumbs');
  const summaryEl = document.getElementById('pipes-summary');
  const loadedAtEl = document.getElementById('pipes-loaded-at');

  const state = {
    inventory: null,
    selectedPipeName: '',
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'pipes',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'pipes');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'pipes',
      toast,
    });

  function pipes() {
    return state.inventory?.pipes || [];
  }

  function pipeName(pipe) {
    return pipe?.name || pipe?.Name || '';
  }

  function selectedPipe() {
    return pipes().find((pipe) => pipeName(pipe) === state.selectedPipeName) || pipes()[0] || null;
  }

  function currentState(pipe) {
    return pipe?.current_state || pipe?.CurrentState || 'UNKNOWN';
  }

  function desiredState(pipe) {
    return pipe?.desired_state || pipe?.DesiredState || 'RUNNING';
  }

  function parseJsonObject(value, fallback = null) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return fallback;
    }
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Value must be a JSON object');
    }
    return parsed;
  }

  function defaultSourceParameters() {
    return JSON.stringify({}, null, 2);
  }

  function defaultTargetParameters() {
    return JSON.stringify({}, null, 2);
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'Pipes');
    home.addEventListener('click', () => {
      state.selectedPipeName = pipes()[0] ? pipeName(pipes()[0]) : '';
      render();
    });
    breadcrumbsEl.append(home);
    const pipe = selectedPipe();
    if (pipe) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, pipeName(pipe)));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'pipes',
      targets: {
        pipes: 'Pipes',
        running: 'Pipes',
        stopped: 'Pipes',
        creating: 'Pipes',
        deleting: 'Pipes',
      },
    });
  }

  function showPipeModal(pipe = null) {
    const isEdit = Boolean(pipe);
    const form = el('div', 'pipes-modal-form pipes-modal-form-wide');
    const nameInput = document.createElement('input');
    nameInput.value = pipeName(pipe);
    nameInput.disabled = isEdit;
    nameInput.placeholder = 'orders-to-worker';

    const sourceInput = document.createElement('input');
    sourceInput.value = pipe?.source || '';
    sourceInput.placeholder = 'arn:aws:sqs:us-east-1:000000000000:source-queue';

    const targetInput = document.createElement('input');
    targetInput.value = pipe?.target || '';
    targetInput.placeholder = 'arn:aws:lambda:us-east-1:000000000000:function:worker';

    const roleInput = document.createElement('input');
    roleInput.value = pipe?.role_arn || '';
    roleInput.placeholder = 'arn:aws:iam::000000000000:role/pipe-role';

    const desiredStateInput = document.createElement('select');
    desiredStateInput.append(new Option('Running', 'RUNNING'), new Option('Stopped', 'STOPPED'));
    desiredStateInput.value = desiredState(pipe);

    const descriptionInput = document.createElement('input');
    descriptionInput.value = pipe?.description || '';
    descriptionInput.placeholder = 'Local event handoff';

    const sourceParametersInput = document.createElement('textarea');
    sourceParametersInput.value = pipe?.source_parameters
      ? JSON.stringify(pipe.source_parameters, null, 2)
      : defaultSourceParameters();

    const targetParametersInput = document.createElement('textarea');
    targetParametersInput.value = pipe?.target_parameters
      ? JSON.stringify(pipe.target_parameters, null, 2)
      : defaultTargetParameters();

    const enrichmentInput = document.createElement('input');
    enrichmentInput.value = pipe?.enrichment || '';
    enrichmentInput.placeholder = 'Optional enrichment ARN';

    const enrichmentParametersInput = document.createElement('textarea');
    enrichmentParametersInput.value = pipe?.enrichment_parameters
      ? JSON.stringify(pipe.enrichment_parameters, null, 2)
      : '';

    const logConfigurationInput = document.createElement('textarea');
    logConfigurationInput.value = pipe?.log_configuration
      ? JSON.stringify(pipe.log_configuration, null, 2)
      : '';

    const tagsInput = document.createElement('textarea');
    tagsInput.value = pipe?.tags ? JSON.stringify(pipe.tags, null, 2) : '';
    tagsInput.disabled = isEdit;
    tagsInput.placeholder = '{"env":"local"}';

    form.append(
      el('label', null, 'Pipe name'),
      nameInput,
      el('label', null, 'Source ARN'),
      sourceInput,
      el('label', null, 'Target ARN'),
      targetInput,
      el('label', null, 'Role ARN'),
      roleInput,
      el('label', null, 'Desired state'),
      desiredStateInput,
      el('label', null, 'Description'),
      descriptionInput,
      el('label', null, 'Source parameters JSON'),
      sourceParametersInput,
      el('label', null, 'Target parameters JSON'),
      targetParametersInput,
      el('label', null, 'Enrichment ARN'),
      enrichmentInput,
      el('label', null, 'Enrichment parameters JSON'),
      enrichmentParametersInput,
      el('label', null, 'Log configuration JSON'),
      logConfigurationInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );

    openModal(isEdit ? 'Update pipe' : 'Create pipe', form, isEdit ? 'Update pipe' : 'Create pipe', async (close) => {
      const name = nameInput.value.trim();
      const payload = {
        name,
        source: sourceInput.value.trim(),
        target: targetInput.value.trim(),
        role_arn: roleInput.value.trim(),
        desired_state: desiredStateInput.value,
        description: descriptionInput.value.trim(),
        source_parameters: parseJsonObject(sourceParametersInput.value, {}),
        target_parameters: parseJsonObject(targetParametersInput.value, {}),
        enrichment: enrichmentInput.value.trim(),
        enrichment_parameters: parseJsonObject(enrichmentParametersInput.value, null),
        log_configuration: parseJsonObject(logConfigurationInput.value, null),
        tags: parseJsonObject(tagsInput.value, {}),
      };
      const path = isEdit ? `/api/pipes/pipes/${encodeURIComponent(name)}/` : '/api/pipes/pipes/';
      await apiJson(path, {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      state.selectedPipeName = name;
      close();
      toast(isEdit ? 'Pipe updated' : 'Pipe created');
      await refresh();
    });
  }

  async function startPipe(pipe) {
    await apiJson(`/api/pipes/pipes/${encodeURIComponent(pipeName(pipe))}/start/`, { method: 'POST' });
    toast('Pipe started');
    await refresh();
  }

  async function stopPipe(pipe) {
    await apiJson(`/api/pipes/pipes/${encodeURIComponent(pipeName(pipe))}/stop/`, { method: 'POST' });
    toast('Pipe stopped');
    await refresh();
  }

  async function deletePipe(pipe) {
    if (!window.confirm('Delete this pipe?')) {
      return;
    }
    await apiJson(`/api/pipes/pipes/${encodeURIComponent(pipeName(pipe))}/`, { method: 'DELETE' });
    state.selectedPipeName = '';
    toast('Pipe deleted');
    await refresh();
  }

  function renderPipeRow(pipe) {
    const active = pipeName(pipe) === pipeName(selectedPipe());
    const row = el('button', `pipes-pipe-row${active ? ' pipes-pipe-row-active' : ''}`);
    row.append(
      el('span', 'pipes-pipe-name', pipeName(pipe) || 'Unnamed pipe'),
      el('span', 'pipes-pipe-meta', `${currentState(pipe)} / ${pipe.source || 'source'} to ${pipe.target || 'target'}`),
    );
    row.addEventListener('click', () => {
      state.selectedPipeName = pipeName(pipe);
      render();
    });
    return row;
  }

  function renderPipeList() {
    const panel = el('section', 'pipes-panel');
    panel.append(el('div', 'pipes-panel-heading', 'Pipes'));
    const list = el('div', 'pipes-list');
    if (!pipes().length) {
      list.append(el('div', 'pipes-empty', 'No pipes found.'));
    } else {
      pipes().forEach((pipe) => list.append(renderPipeRow(pipe)));
    }
    panel.append(list);
    return panel;
  }

  function renderPipeDetail(pipe) {
    const panel = el('section', 'pipes-panel');
    panel.append(el('div', 'pipes-panel-heading', 'Selected pipe'));
    const body = el('div', 'pipes-detail');
    if (!pipe) {
      body.append(el('p', 'pipes-empty-compact', 'Create a pipe to connect a local event source to a target.'));
      panel.append(body);
      return panel;
    }

    const facts = el('dl', 'pipes-facts');
    consoleUi.addField(facts, 'Name', pipeName(pipe));
    consoleUi.addField(facts, 'Current state', currentState(pipe));
    consoleUi.addField(facts, 'Desired state', desiredState(pipe));
    consoleUi.addField(facts, 'Source', pipe.source);
    consoleUi.addField(facts, 'Target', pipe.target);
    consoleUi.addField(facts, 'Role ARN', pipe.role_arn);
    consoleUi.addField(facts, 'Source parameters', pipe.source_parameters);
    consoleUi.addField(facts, 'Target parameters', pipe.target_parameters);
    consoleUi.addField(facts, 'Enrichment', pipe.enrichment);
    consoleUi.addField(facts, 'Tags', pipe.tags);
    body.append(facts);

    const actions = el('div', 'pipes-action-row');
    actions.append(
      btn('Edit pipe', null, () => showPipeModal(pipe)),
      btn('Start', 'pipes-btn-secondary', () => startPipe(pipe).catch((error) => toast(error.message, true))),
      btn('Stop', 'pipes-btn-secondary', () => stopPipe(pipe).catch((error) => toast(error.message, true))),
      btn('Delete pipe', 'pipes-btn-danger', () => deletePipe(pipe).catch((error) => toast(error.message, true))),
    );
    body.append(actions);
    panel.append(body);
    return panel;
  }

  function renderWorkbench() {
    const workbench = el('div', 'pipes-workbench');
    workbench.append(renderPipeList(), renderPipeDetail(selectedPipe()));
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
      [btn('Create pipe', null, () => showPipeModal())],
      [el('span', 'pipes-toolbar-note', 'Local event source to target routing')],
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
    const data = await apiJson('/api/pipes/');
    state.inventory = data;
    if (!state.selectedPipeName && pipes()[0]) {
      state.selectedPipeName = pipeName(pipes()[0]);
    }
    render();
  }

  return { refresh };
})();

window.PipesConsole = PipesConsole;
