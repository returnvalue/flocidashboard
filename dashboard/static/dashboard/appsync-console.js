/* global ServiceConsole */

const AppSyncConsole = (() => {
  const ui = window.ServiceConsole;
  const root = document.getElementById('appsync-console-root');
  const breadcrumbsEl = document.getElementById('appsync-breadcrumbs');
  const summaryEl = document.getElementById('appsync-summary');
  const loadedAtEl = document.getElementById('appsync-loaded-at');
  const state = { inventory: null, selectedApiId: '', lastResult: null };
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
      if (deleteHandler) card.append(btn('Delete', 'appsync-btn-danger', () => deleteHandler(item).catch((error) => toast(error.message, true))));
      list.append(card);
    });
    section.append(list); return section;
  }

  function renderDetail(api) {
    const panel = el('section', 'appsync-panel'); panel.append(el('div', 'appsync-panel-heading', api?.name || 'AppSync workflow')); const body = el('div', 'appsync-detail');
    if (!api) body.append(el('p', 'appsync-empty', 'Create a GraphQL API to begin configuring AppSync resolver resources.'));
    else {
      const facts = el('dl', 'appsync-facts'); [['API ID', apiId(api)], ['ARN', api.arn], ['Authentication', api.authenticationType], ['URIs', api.uris], ['Schema status', api.schema_status], ['Tags', api.tags]].forEach(([label, value]) => ui.addField(facts, label, value)); body.append(facts);
      const actions = el('div', 'appsync-action-row'); actions.append(btn('Upload schema', null, () => showSchema(api)), btn('Create API key', 'appsync-btn-secondary', () => showApiKey(api)), btn('Create data source', 'appsync-btn-secondary', () => showDataSource(api)), btn('Create resolver', 'appsync-btn-secondary', () => showResolver(api)), btn('Create function', 'appsync-btn-secondary', () => showFunction(api)), btn('Create type', 'appsync-btn-secondary', () => showType(api)), btn('Tags', 'appsync-btn-secondary', () => showTags(api)), btn('Delete API', 'appsync-btn-danger', () => deleteApi(api).catch((error) => toast(error.message, true)))); body.append(actions);
      const base = `/api/appsync/apis/${encodeURIComponent(apiId(api))}`;
      body.append(
        renderCards('API keys', api.api_keys || [], [['ID', 'id'], ['Description', 'description'], ['Expires', 'expires']], (item) => deleteItem(`${base}/api-keys/`, { key_id: item.id }, 'API key')),
        renderCards('Data sources', api.data_sources || [], [['Type', 'type'], ['Description', 'description']], (item) => deleteItem(`${base}/data-sources/`, { name: item.name }, 'data source')),
        renderCards('Resolvers', api.resolvers || [], [['Type', 'typeName'], ['Field', 'fieldName'], ['Data source', 'dataSourceName']], (item) => deleteItem(`${base}/resolvers/`, { type_name: item.typeName, field_name: item.fieldName }, 'resolver')),
        renderCards('Functions', api.functions || [], [['Function ID', 'functionId'], ['Data source', 'dataSourceName'], ['Description', 'description']], (item) => deleteItem(`${base}/functions/`, { function_id: item.functionId }, 'function')),
        renderCards('Types', api.types || [], [['Definition', 'definition']], (item) => deleteItem(`${base}/types/`, { type_name: item.name }, 'type')),
      );
    }
    if (state.lastResult) { const result = el('pre', 'appsync-result'); result.textContent = JSON.stringify(ui.displayValue(state.lastResult), null, 2); body.append(el('h3', null, 'Last action result'), result); }
    panel.append(body); return panel;
  }

  function render() {
    if (!root) return;
    root.textContent = ''; renderBreadcrumbs(); renderSummary(state.inventory?.summary || {});
    root.append(toolbar([btn('Create GraphQL API', null, showCreateApi), btn('Refresh', 'appsync-btn-secondary', () => refresh().catch((error) => toast(error.message, true)))], [el('span', 'appsync-toolbar-note', 'Resolver configuration with Phase 4 VTL engine support')]));
    const workbench = el('div', 'appsync-workbench'); workbench.append(renderApiList(), renderDetail(selectedApi())); root.append(workbench);
    if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
  }

  async function refresh() { const data = await apiJson('/api/appsync/'); state.inventory = data; if (!selectedApi() && apis().length) state.selectedApiId = apiId(apis()[0]); render(); }
  function init() { if (!root) return; root.append(el('div', 'appsync-empty', 'Loading...')); refresh().catch((error) => toast(error.message, true)); }
  return { init, refresh };
})();

window.AppSyncConsole = AppSyncConsole;
if (document.getElementById('appsync-console-root')) AppSyncConsole.init();
