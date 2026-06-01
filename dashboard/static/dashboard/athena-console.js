/* global ServiceConsole */

const AthenaConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('athena-console-root');
  const breadcrumbsEl = document.getElementById('athena-breadcrumbs');
  const summaryEl = document.getElementById('athena-summary');
  const loadedAtEl = document.getElementById('athena-loaded-at');

  const state = {
    inventory: null,
    selectedQueryId: '',
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'athena',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'athena');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'athena',
      toast,
    });

  function queries() {
    return state.inventory?.query_executions || [];
  }

  function workgroups() {
    return state.inventory?.workgroups || [];
  }

  function queryId(query) {
    return query?.id || query?.name || '';
  }

  function selectedQuery() {
    return queries().find((query) => queryId(query) === state.selectedQueryId) || queries()[0] || null;
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

  function addWorkgroupOptions(select, selectedValue = '') {
    option(select, '', 'Default workgroup', !selectedValue);
    workgroups().forEach((workgroup) => option(
      select,
      workgroup.name,
      workgroup.name,
      workgroup.name === selectedValue,
    ));
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'athena',
      targets: {
        workgroups: 'Workgroups',
        query_executions: 'Query executions',
        succeeded: 'Query executions',
        failed: 'Query executions',
        running: 'Query executions',
        queued: 'Query executions',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('Athena', null, () => {
      state.selectedQueryId = queries()[0] ? queryId(queries()[0]) : '';
      render();
    }));
    const query = selectedQuery();
    if (query) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, queryId(query)));
    }
  }

  function showStartQueryModal() {
    const form = el('div', 'athena-modal-form');
    const queryInput = document.createElement('textarea');
    queryInput.value = 'SELECT 42 AS answer';
    const databaseInput = document.createElement('input');
    databaseInput.placeholder = 'analytics';
    const catalogInput = document.createElement('input');
    catalogInput.placeholder = 'AwsDataCatalog';
    const workgroupSelect = document.createElement('select');
    addWorkgroupOptions(workgroupSelect);
    const outputInput = document.createElement('input');
    outputInput.placeholder = 's3://query-results/';
    const paramsInput = document.createElement('input');
    paramsInput.placeholder = 'param-1,param-2';
    form.append(
      el('label', null, 'SQL query'),
      queryInput,
      el('label', null, 'Database'),
      databaseInput,
      el('label', null, 'Catalog'),
      catalogInput,
      el('label', null, 'Workgroup'),
      workgroupSelect,
      el('label', null, 'Output S3 location'),
      outputInput,
      el('label', null, 'Execution parameters'),
      paramsInput,
    );
    openModal('Start query', form, 'Start', async (close) => {
      const data = await apiJson('/api/athena/queries/start/', {
        method: 'POST',
        body: JSON.stringify({
          query_string: queryInput.value.trim(),
          database: databaseInput.value.trim(),
          catalog: catalogInput.value.trim(),
          workgroup: workgroupSelect.value,
          output_location: outputInput.value.trim(),
          execution_parameters: parseList(paramsInput.value),
        }),
      });
      state.selectedQueryId = data.query_execution_id || '';
      state.lastResult = data;
      close();
      toast('Query started');
      await refresh();
    });
  }

  function showCreateWorkgroupModal() {
    const form = el('div', 'athena-modal-form');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'analytics';
    const descriptionInput = document.createElement('input');
    descriptionInput.placeholder = 'Local analytics queries';
    const outputInput = document.createElement('input');
    outputInput.placeholder = 's3://query-results/';
    const configInput = document.createElement('textarea');
    configInput.placeholder = '{"EnforceWorkGroupConfiguration":false}';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{"env":"local"}';
    form.append(
      el('label', null, 'Workgroup name'),
      nameInput,
      el('label', null, 'Description'),
      descriptionInput,
      el('label', null, 'Output S3 location'),
      outputInput,
      el('label', null, 'Configuration JSON'),
      configInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Create workgroup', form, 'Create', async (close) => {
      const data = await apiJson('/api/athena/workgroups/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          description: descriptionInput.value.trim(),
          output_location: outputInput.value.trim(),
          configuration: parseJson(configInput.value, {}, 'Configuration'),
          tags: parseJson(tagsInput.value, [], 'Tags'),
        }),
      });
      state.lastResult = data;
      close();
      toast('Workgroup created');
      await refresh();
    });
  }

  async function fetchResults(query) {
    const data = await apiJson('/api/athena/queries/results/', {
      method: 'POST',
      body: JSON.stringify({
        query_execution_id: queryId(query),
        max_results: 25,
      }),
    });
    state.lastResult = data;
    toast('Results loaded');
    render();
  }

  async function loadQueryDetail(query) {
    const data = await apiJson('/api/athena/queries/detail/', {
      method: 'POST',
      body: JSON.stringify({ query_execution_id: queryId(query) }),
    });
    state.lastResult = data;
    toast('Query execution loaded');
    render();
  }

  async function stopQuery(query) {
    if (!window.confirm('Stop this Athena query execution?')) {
      return;
    }
    const data = await apiJson('/api/athena/queries/stop/', {
      method: 'POST',
      body: JSON.stringify({ query_execution_id: queryId(query) }),
    });
    state.lastResult = data;
    toast('Query stopped');
    await refresh();
  }

  function renderQueryList() {
    const panel = el('section', 'athena-panel');
    panel.append(el('div', 'athena-panel-heading', 'Query executions'));
    const list = el('div', 'athena-query-list');
    if (!queries().length) {
      list.append(el('div', 'athena-empty', 'No Athena query executions found.'));
    } else {
      queries().forEach((query) => {
        const active = queryId(query) === queryId(selectedQuery());
        const row = el('button', `athena-query-row${active ? ' athena-query-row-active' : ''}`);
        row.append(
          el('span', 'athena-query-name', queryId(query)),
          el('span', 'athena-query-meta', `${query.state || 'Unknown'} / ${query.database || 'no database'}`),
        );
        row.addEventListener('click', () => {
          state.selectedQueryId = queryId(query);
          render();
        });
        list.append(row);
      });
    }
    panel.append(list);
    return panel;
  }

  function renderQueryDetail(query) {
    const panel = el('section', 'athena-panel');
    panel.append(el('div', 'athena-panel-heading', 'Selected query'));
    const body = el('div', 'athena-detail');
    const facts = el('dl', 'athena-facts');
    consoleUi.addField(facts, 'Query execution ID', queryId(query));
    consoleUi.addField(facts, 'State', query.state);
    consoleUi.addField(facts, 'Reason', query.state_change_reason);
    consoleUi.addField(facts, 'Database', query.database);
    consoleUi.addField(facts, 'Catalog', query.catalog);
    consoleUi.addField(facts, 'Workgroup', query.workgroup);
    consoleUi.addField(facts, 'Submitted', query.submission_time);
    consoleUi.addField(facts, 'Completed', query.completion_time);
    consoleUi.addField(facts, 'Query', query.query);
    consoleUi.addField(facts, 'Result configuration', query.result_configuration);
    consoleUi.addField(facts, 'Result preview', query.result_preview);
    body.append(facts);
    const actions = el('div', 'athena-action-row');
    actions.append(
      btn('Load detail', 'athena-btn-secondary', () => loadQueryDetail(query).catch((error) => toast(error.message, true))),
      btn('Get results', null, () => fetchResults(query).catch((error) => toast(error.message, true))),
    );
    if (['QUEUED', 'RUNNING'].includes(query.state)) {
      actions.append(btn('Stop query', 'athena-btn-danger', () => stopQuery(query).catch((error) => toast(error.message, true))));
    }
    body.append(actions);
    panel.append(body);
    return panel;
  }

  function renderWorkgroupsPanel() {
    const panel = el('section', 'athena-panel');
    panel.append(el('div', 'athena-panel-heading', `Workgroups (${workgroups().length})`));
    const body = el('div', 'athena-card-list');
    workgroups().forEach((workgroup) => {
      const card = el('article', 'athena-card');
      card.append(el('h3', null, workgroup.name || 'Workgroup'));
      const facts = el('dl', 'athena-facts');
      consoleUi.addField(facts, 'State', workgroup.state);
      consoleUi.addField(facts, 'Description', workgroup.description);
      consoleUi.addField(facts, 'Created', workgroup.creation_time);
      consoleUi.addField(facts, 'Configuration', workgroup.configuration);
      card.append(facts);
      body.append(card);
    });
    if (!workgroups().length) {
      body.append(el('p', 'athena-empty', 'No Athena workgroups found.'));
    }
    panel.append(body);
    return panel;
  }

  function renderResult() {
    if (!state.lastResult) {
      return null;
    }
    const panel = el('section', 'athena-panel');
    panel.append(el('div', 'athena-panel-heading', 'Last action result'));
    const pre = el('pre', 'athena-result');
    pre.textContent = JSON.stringify(consoleUi.displayValue(state.lastResult), null, 2);
    panel.append(pre);
    return panel;
  }

  function renderWorkbench() {
    const workbench = el('div', 'athena-workbench');
    const query = selectedQuery();
    workbench.append(renderQueryList());
    const detail = el('div', 'athena-detail-stack');
    if (!query) {
      detail.append(el('section', 'athena-panel athena-empty-panel', 'Start a SQL query to exercise the local DuckDB-backed Athena flow.'));
    } else {
      detail.append(renderQueryDetail(query));
    }
    detail.append(renderWorkgroupsPanel());
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
        btn('Start query', null, showStartQueryModal),
        btn('Create workgroup', 'athena-btn-secondary', showCreateWorkgroupModal),
      ],
      [el('span', 'athena-toolbar-note', 'DuckDB-backed SQL over Glue tables and S3 data')],
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
    const data = await apiJson('/api/athena/');
    state.inventory = data;
    if (!state.selectedQueryId && queries()[0]) {
      state.selectedQueryId = queryId(queries()[0]);
    }
    render();
  }

  return { refresh };
})();

window.AthenaConsole = AthenaConsole;
