/* global ServiceConsole */

const AppSyncConsole = (() => {
  const ui = window.ServiceConsole;
  const root = document.getElementById('appsync-console-root');
  const breadcrumbsEl = document.getElementById('appsync-breadcrumbs');
  const summaryEl = document.getElementById('appsync-summary');
  const loadedAtEl = document.getElementById('appsync-loaded-at');
  const state = { inventory: null, selectedApiId: '', lastResult: null, lastGraphqlResult: null };
  const el = ui.el;
  const apiJson = ui.apiJson;
  const btn = ui.button;
  const toast = (message, isError = false) => ui.toast(message, { classPrefix: 'appsync', type: isError ? 'error' : 'success' });
  const toolbar = (left, right) => ui.toolbar(left, right, 'appsync');
  const openModal = (title, body, label, confirm) => ui.openModal(title, body, label, confirm, { classPrefix: 'appsync', toast });

  function apis() { return state.inventory?.graphql_apis || []; }
  function selectedApi() { return apis().find((api) => (api.apiId || api.id) === state.selectedApiId) || apis()[0] || null; }
  function apiId(api = selectedApi()) { return api?.apiId || api?.id || ''; }
  function input(value = '', placeholder = '') { const node = document.createElement('input'); node.value = value; node.placeholder = placeholder; return node; }
  function textarea(value = '', placeholder = '') { const node = document.createElement('textarea'); node.value = value; node.placeholder = placeholder; return node; }
  function field(form, label, control) { form.append(el('label', null, label), control); }
  function parseJson(value, fallback, label) { const text = String(value || '').trim(); if (!text) return fallback; try { return JSON.parse(text); } catch (_error) { throw new Error(`${label} must be valid JSON`); } }
  function parseList(value) { return String(value || '').split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean); }
  function renderSummary(summary) { ui.renderSummary(summary, summaryEl, { serviceKey: 'appsync', targets: { graphql_apis: 'GraphQL APIs', api_keys: 'API keys', data_sources: 'Data sources', functions: 'Functions', types: 'Types', resolvers: 'Resolvers' } }); }

  async function runAction(path, method, body, message, close) {
    state.lastResult = await apiJson(path, { method, body: JSON.stringify(body) });
    if (close) close();
    toast(message);
    await refresh();
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) return;
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('AppSync', null, () => { state.selectedApiId = apis()[0] ? apiId(apis()[0]) : ''; render(); }));
    if (selectedApi()) breadcrumbsEl.append(el('span', null, '/'), el('span', null, selectedApi().name || apiId()));
  }

  function showCreateApi() {
    const form = el('div', 'appsync-modal-form'); const name = input('local-graphql-api'); const auth = input('API_KEY'); const tags = textarea('{"env":"local"}');
    field(form, 'API name', name); field(form, 'Authentication type', auth); field(form, 'Tags JSON', tags);
    openModal('Create GraphQL API', form, 'Create', async (close) => {
      const data = await apiJson('/api/appsync/apis/', { method: 'POST', body: JSON.stringify({ name: name.value.trim(), authentication_type: auth.value.trim(), tags: parseJson(tags.value, {}, 'Tags') }) });
      state.selectedApiId = data.api_id || ''; state.lastResult = data; close(); toast('GraphQL API created'); await refresh();
    });
  }

  function showGraphiqlModal(api) {
    const form = el('div', 'appsync-modal-form');
    const presets = {
      introspection: {
        name: 'Introspection (__schema)',
        query: 'query GetSchemaTypes {\n  __schema {\n    types {\n      name\n      kind\n      description\n    }\n  }\n}',
        vars: '{}',
      },
      sample_query: {
        name: 'Sample Query (hello)',
        query: 'query HelloQuery {\n  hello\n}',
        vars: '{}',
      },
      custom_mutation: {
        name: 'Sample Mutation',
        query: 'mutation CreateItem($input: String!) {\n  createItem(name: $input) {\n    id\n    name\n  }\n}',
        vars: '{\n  "input": "Sample Item"\n}',
      },
    };

    const presetSelect = document.createElement('select');
    Object.entries(presets).forEach(([k, v]) => {
      const opt = el('option', null, v.name);
      opt.value = k;
      presetSelect.append(opt);
    });

    const apiKeyVal = (api?.api_keys || [])[0]?.id || '';
    const apiKeyInput = input(apiKeyVal, 'Optional API Key');
    const queryArea = textarea(presets.introspection.query, 'GraphQL Query');
    queryArea.style.minHeight = '150px';
    queryArea.className = 'appsync-code-area';

    const varsArea = textarea(presets.introspection.vars, 'Variables JSON');
    varsArea.style.minHeight = '80px';
    varsArea.className = 'appsync-code-area';

    presetSelect.addEventListener('change', () => {
      const selected = presets[presetSelect.value];
      if (selected) {
        queryArea.value = selected.query;
        varsArea.value = selected.vars;
      }
    });

    field(form, 'Query Preset', presetSelect);
    field(form, 'API Key (x-api-key)', apiKeyInput);
    field(form, 'GraphQL Query String', queryArea);
    field(form, 'Query Variables JSON', varsArea);

    openModal('GraphiQL Query Runner', form, 'Execute Query', async (close) => {
      const query = queryArea.value.trim();
      if (!query) throw new Error('GraphQL query cannot be empty');
      let varsObj = null;
      if (varsArea.value.trim()) {
        try {
          varsObj = JSON.parse(varsArea.value.trim());
        } catch (e) {
          throw new Error('Variables must be valid JSON: ' + e.message);
        }
      }

      const res = await apiJson('/api/appsync/graphql/run/', {
        method: 'POST',
        body: JSON.stringify({
          api_id: apiId(api),
          query,
          variables: varsObj,
          api_key: apiKeyInput.value.trim() || undefined,
        }),
      });

      state.lastGraphqlResult = res;
      toast(`Query finished (HTTP ${res.status_code}, ${res.latency_ms}ms)`);
      close();
      render();
    });
  }

  function showSchema(api) {
    const form = el('div', 'appsync-modal-form'); const definition = textarea('type Query {\n  hello: String\n}', 'GraphQL SDL');
    field(form, 'GraphQL schema', definition);
    openModal('Upload schema', form, 'Upload', (close) => runAction(`/api/appsync/apis/${encodeURIComponent(apiId(api))}/schema/`, 'POST', { definition: definition.value }, 'Schema uploaded', close));
  }

  function showApiKey(api) {
    const form = el('div', 'appsync-modal-form'); const description = input('local development key'); const expires = input('', 'optional epoch seconds');
    field(form, 'Description', description); field(form, 'Expires epoch seconds', expires);
    openModal('Create API key', form, 'Create', (close) => runAction(`/api/appsync/apis/${encodeURIComponent(apiId(api))}/api-keys/`, 'POST', { description: description.value.trim(), expires: expires.value.trim() || null }, 'API key created', close));
  }

  function showDataSource(api) {
    const form = el('div', 'appsync-modal-form'); const name = input('none-ds'); const type = input('NONE'); const description = input('', 'Local data source');
    field(form, 'Data source name', name); field(form, 'Type', type); field(form, 'Description', description);
    openModal('Create data source', form, 'Create', (close) => runAction(`/api/appsync/apis/${encodeURIComponent(apiId(api))}/data-sources/`, 'POST', { name: name.value.trim(), source_type: type.value.trim(), description: description.value.trim() }, 'Data source created', close));
  }

  function showResolver(api) {
    const form = el('div', 'appsync-modal-form'); const type = input('Query'); const fieldName = input('hello'); const source = input('none-ds');
    field(form, 'Type name', type); field(form, 'Field name', fieldName); field(form, 'Data source name', source);
    openModal('Create resolver', form, 'Create', (close) => runAction(`/api/appsync/apis/${encodeURIComponent(apiId(api))}/resolvers/`, 'POST', { type_name: type.value.trim(), field_name: fieldName.value.trim(), data_source_name: source.value.trim() }, 'Resolver created', close));
  }

  function showFunction(api) {
    const form = el('div', 'appsync-modal-form'); const name = input('local-function'); const source = input('none-ds'); const description = input('', 'Pipeline function');
    field(form, 'Function name', name); field(form, 'Data source name', source); field(form, 'Description', description);
    openModal('Create function', form, 'Create', (close) => runAction(`/api/appsync/apis/${encodeURIComponent(apiId(api))}/functions/`, 'POST', { name: name.value.trim(), data_source_name: source.value.trim(), description: description.value.trim() }, 'Function created', close));
  }

  function showType(api) {
    const form = el('div', 'appsync-modal-form'); const definition = textarea('type Item {\n  id: ID!\n  name: String\n}'); const format = input('SDL');
    field(form, 'Type definition', definition); field(form, 'Format', format);
    openModal('Create type', form, 'Create', (close) => runAction(`/api/appsync/apis/${encodeURIComponent(apiId(api))}/types/`, 'POST', { definition: definition.value, format: format.value.trim() }, 'Type created', close));
  }

  function showTags(api) {
    const form = el('div', 'appsync-modal-form'); const tags = textarea(JSON.stringify(api.tags || {}, null, 2)); const keys = input('', 'env,team');
    field(form, 'Add tags JSON', tags); form.append(btn('Add tags', null, () => runAction('/api/appsync/tags/', 'POST', { resource_arn: api.arn, tags: parseJson(tags.value, {}, 'Tags') }, 'Tags added')));
    field(form, 'Remove tag keys', keys); form.append(btn('Remove tags', 'appsync-btn-secondary', () => runAction('/api/appsync/tags/', 'DELETE', { resource_arn: api.arn, tag_keys: parseList(keys.value) }, 'Tags removed')));
    openModal('GraphQL API tags', form, 'Done', (close) => close());
  }

  async function deleteItem(path, body, label) {
    if (!window.confirm(`Delete this ${label}?`)) return;
    await runAction(path, 'DELETE', body, `${label} deleted`);
  }

  async function deleteApi(api) {
    if (!window.confirm(`Delete AppSync GraphQL API ${api.name || apiId(api)} and its related resources?`)) return;
    await runAction(`/api/appsync/apis/${encodeURIComponent(apiId(api))}/`, 'DELETE', {}, 'GraphQL API deleted');
    state.selectedApiId = '';
  }

  function renderApiList() {
    const panel = el('section', 'appsync-panel'); panel.append(el('div', 'appsync-panel-heading', 'GraphQL APIs')); const list = el('div', 'appsync-list');
    if (!apis().length) list.append(el('p', 'appsync-empty', 'No AppSync GraphQL APIs found.'));
    apis().forEach((api) => {
      const row = el('button', `appsync-row${apiId(api) === apiId(selectedApi()) ? ' appsync-row-active' : ''}`);
      row.append(el('span', 'appsync-name', api.name || apiId(api)), el('span', 'appsync-meta', `${api.authenticationType || 'auth unset'} / ${api.resolver_count || 0} resolvers`));
      row.addEventListener('click', () => { state.selectedApiId = apiId(api); render(); }); list.append(row);
    });
    panel.append(list); return panel;
  }

  function renderCards(title, items, facts, deleteHandler) {
    const section = el('section', 'appsync-section'); section.append(el('h3', null, title)); const list = el('div', 'appsync-card-list');
    if (!items.length) list.append(el('p', 'appsync-empty', `No ${title.toLowerCase()} found.`));
    items.forEach((item) => {
      const card = el('article', 'appsync-card'); card.append(el('h4', null, item.name || item.fieldName || item.functionId || item.id || 'Resource'));
      const dl = document.createElement('dl'); facts.forEach(([label, key]) => ui.addField(dl, label, item[key])); card.append(dl);
      if (deleteHandler) card.append(btn('Delete', 'appsync-btn-danger', () => deleteHandler(item)));
      list.append(card);
    });
    section.append(list); return section;
  }

  function renderGraphqlResult() {
    if (!state.lastGraphqlResult) return null;
    const res = state.lastGraphqlResult;
    const card = el('section', 'appsync-section');
    const heading = el('div', 'appsync-panel-heading');
    heading.append(
      el('span', null, 'Last GraphQL Execution Result'),
      el('span', 'appsync-meta', `${res.latency_ms}ms · HTTP ${res.status_code}`),
    );
    card.append(heading);

    if (res.data) {
      card.append(el('h4', null, 'Data'));
      card.append(el('pre', 'appsync-output', JSON.stringify(res.data, null, 2)));
    }
    if (res.errors) {
      card.append(el('h4', null, 'Errors'));
      card.append(el('pre', 'appsync-output appsync-output-error', JSON.stringify(res.errors, null, 2)));
    }
    if (!res.data && !res.errors && res.raw) {
      card.append(el('pre', 'appsync-output', JSON.stringify(res.raw, null, 2)));
    }
    return card;
  }

  function renderWorkbench() {
    const api = selectedApi();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create GraphQL API', null, showCreateApi),
        btn('Run GraphQL query', 'appsync-btn-primary', () => api && showGraphiqlModal(api)),
        btn('Upload schema', null, () => api && showSchema(api)),
        btn('Create API key', null, () => api && showApiKey(api)),
        btn('Create data source', null, () => api && showDataSource(api)),
        btn('Create resolver', null, () => api && showResolver(api)),
        btn('Create function', null, () => api && showFunction(api)),
        btn('Create type', null, () => api && showType(api)),
        btn('Manage tags', 'appsync-btn-secondary', () => api && showTags(api)),
        btn('Delete API', 'appsync-btn-danger', () => api && deleteApi(api)),
      ],
      [],
    ));

    [...container.querySelectorAll('button')].slice(1).forEach((button) => { button.disabled = !api; });

    const workbench = el('div', 'appsync-workbench');
    workbench.append(renderApiList());

    const detail = el('section', 'appsync-panel');
    detail.append(el('div', 'appsync-panel-heading', api ? (api.name || apiId(api)) : 'API detail'));
    const content = el('div', 'appsync-content');
    if (!api) {
      content.append(el('p', 'appsync-empty', 'Create or select an AppSync GraphQL API to inspect its schema, data sources, resolvers, and functions.'));
    } else {
      const summary = document.createElement('dl');
      [['API ID', apiId(api)], ['ARN', api.arn], ['Authentication type', api.authenticationType], ['GraphQL endpoint', api.uris?.GRAPHQL || api.uris?.graphql], ['Realtime endpoint', api.uris?.REALTIME || api.uris?.realtime], ['Resolver count', api.resolver_count]].forEach(([l, v]) => ui.addField(summary, l, v));
      content.append(summary);
      if (api.schema_definition) {
        const schemaBlock = el('section', 'appsync-section');
        schemaBlock.append(el('h3', null, 'GraphQL Schema Definition'), el('pre', 'appsync-output', api.schema_definition));
        content.append(schemaBlock);
      }
      const resCard = renderGraphqlResult();
      if (resCard) content.append(resCard);
      content.append(renderCards('API keys', api.api_keys || [], [['Key ID', 'id'], ['Description', 'description'], ['Expires', 'expires']], (item) => deleteItem(`/api/appsync/apis/${encodeURIComponent(apiId(api))}/api-keys/`, { key_id: item.id }, 'API key')));
      content.append(renderCards('Data sources', api.data_sources || [], [['Name', 'name'], ['Type', 'type'], ['Description', 'description']], (item) => deleteItem(`/api/appsync/apis/${encodeURIComponent(apiId(api))}/data-sources/`, { name: item.name }, 'data source')));
      content.append(renderCards('Resolvers', api.resolvers || [], [['Type', 'typeName'], ['Field', 'fieldName'], ['Data source', 'dataSourceName']], (item) => deleteItem(`/api/appsync/apis/${encodeURIComponent(apiId(api))}/resolvers/`, { type_name: item.typeName, field_name: item.fieldName }, 'resolver')));
      content.append(renderCards('Functions', api.functions || [], [['ID', 'functionId'], ['Name', 'name'], ['Data source', 'dataSourceName']], (item) => deleteItem(`/api/appsync/apis/${encodeURIComponent(apiId(api))}/functions/`, { function_id: item.functionId }, 'function')));
      content.append(renderCards('Types', api.types || [], [['Name', 'name'], ['Format', 'format'], ['Description', 'description']], (item) => deleteItem(`/api/appsync/apis/${encodeURIComponent(apiId(api))}/types/`, { type_name: item.name }, 'type')));
    }
    detail.append(content);
    workbench.append(detail);
    container.append(workbench);
    return container;
  }

  function render() {
    if (!root) return;
    renderBreadcrumbs();
    root.textContent = '';
    root.append(renderWorkbench());
    if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
  }

  async function refresh() {
    const data = await apiJson('/api/appsync/');
    state.inventory = data;
    if (!selectedApi() && apis().length) state.selectedApiId = apiId(apis()[0]);
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) return;
    root.append(el('p', 'appsync-empty', 'Loading AppSync workbench...'));
    refresh().catch((err) => toast(err.message, true));
  }

  return { init, refresh };
})();

window.AppSyncConsole = AppSyncConsole;

if (document.getElementById('appsync-console-root')) {
  AppSyncConsole.init();
}
