/* global ServiceConsole */

const AppConfigConsole = (() => {
  const ui = window.ServiceConsole;
  const root = document.getElementById('appconfig-console-root');
  const summaryEl = document.getElementById('appconfig-summary');
  const loadedAtEl = document.getElementById('appconfig-loaded-at');
  const state = { inventory: null, selectedApplicationId: '', configurationToken: '', lastResult: null };
  const el = ui.el;
  const apiJson = ui.apiJson;
  const btn = ui.button;
  const toast = (message, isError = false) => ui.toast(message, { classPrefix: 'appconfig', type: isError ? 'error' : 'success' });
  const toolbar = (left, right) => ui.toolbar(left, right, 'appconfig');
  const openModal = (title, body, label, confirm) => ui.openModal(title, body, label, confirm, { classPrefix: 'appconfig', toast });

  function applications() { return state.inventory?.applications || []; }
  function strategies() { return state.inventory?.deployment_strategies || []; }
  function selectedApplication() { return applications().find((application) => application.id === state.selectedApplicationId) || applications()[0] || null; }
  function option(select, value, label, selected = false) { const node = document.createElement('option'); node.value = value || ''; node.textContent = label || value || ''; node.selected = selected; select.append(node); }
  function addOptions(select, items, selected = '') { items.forEach((item) => option(select, item.id ?? item.version_number, item.name || item.id || String(item.version_number), (item.id ?? String(item.version_number)) === selected)); }
  function input(value = '', placeholder = '') { const node = document.createElement('input'); node.value = value; node.placeholder = placeholder; return node; }
  function textarea(value = '', placeholder = '') { const node = document.createElement('textarea'); node.value = value; node.placeholder = placeholder; return node; }
  function field(form, label, control) { form.append(el('label', null, label), control); }
  function renderSummary(summary) { ui.renderSummary(summary, summaryEl, { serviceKey: 'appconfig', targets: { applications: 'Applications', environments: 'Environments', configuration_profiles: 'Configuration profiles', hosted_versions: 'Hosted configuration versions', deployment_strategies: 'Deployment strategies', deployments: 'Deployments' } }); }

  function showCreateApplication() {
    const form = el('div', 'appconfig-modal-form'); const name = input('my-app'); const description = input('', 'Local application configuration');
    field(form, 'Application name', name); field(form, 'Description', description);
    openModal('Create application', form, 'Create', async (close) => {
      const data = await apiJson('/api/appconfig/applications/', { method: 'POST', body: JSON.stringify({ name: name.value.trim(), description: description.value.trim() }) });
      state.selectedApplicationId = data.application_id; state.lastResult = data; close(); toast('Application created'); await refresh();
    });
  }

  function showCreateEnvironment(application = selectedApplication()) {
    const form = el('div', 'appconfig-modal-form'); const name = input('dev'); const description = input('', 'Development environment');
    field(form, 'Application ID', input(application?.id || '')); field(form, 'Environment name', name); field(form, 'Description', description);
    openModal('Create environment', form, 'Create', async (close) => {
      const data = await apiJson(`/api/appconfig/applications/${encodeURIComponent(application?.id || '')}/environments/`, { method: 'POST', body: JSON.stringify({ name: name.value.trim(), description: description.value.trim() }) });
      state.lastResult = data; close(); toast('Environment created'); await refresh();
    });
  }

  function showCreateProfile(application = selectedApplication()) {
    const form = el('div', 'appconfig-modal-form'); const name = input('my-profile'); const location = input('hosted'); const type = input('AWS.Freeform'); const description = input('', 'Hosted JSON configuration');
    field(form, 'Application ID', input(application?.id || '')); field(form, 'Profile name', name); field(form, 'Location URI', location); field(form, 'Type', type); field(form, 'Description', description);
    openModal('Create configuration profile', form, 'Create', async (close) => {
      const data = await apiJson(`/api/appconfig/applications/${encodeURIComponent(application?.id || '')}/profiles/`, { method: 'POST', body: JSON.stringify({ name: name.value.trim(), location_uri: location.value.trim(), profile_type: type.value.trim(), description: description.value.trim() }) });
      state.lastResult = data; close(); toast('Configuration profile created'); await refresh();
    });
  }

  function showCreateVersion(application = selectedApplication()) {
    const form = el('div', 'appconfig-modal-form'); const profile = document.createElement('select'); addOptions(profile, application?.configuration_profiles || []);
    const content = textarea('{"foo":"bar"}'); const contentType = input('application/json'); const description = input('', 'Local hosted configuration');
    field(form, 'Configuration profile', profile); field(form, 'Content', content); field(form, 'Content type', contentType); field(form, 'Description', description);
    openModal('Create hosted configuration version', form, 'Create', async (close) => {
      const data = await apiJson(`/api/appconfig/applications/${encodeURIComponent(application?.id || '')}/profiles/${encodeURIComponent(profile.value)}/versions/`, { method: 'POST', body: JSON.stringify({ content: content.value, content_type: contentType.value.trim(), description: description.value.trim() }) });
      state.lastResult = data; close(); toast('Hosted configuration version created'); await refresh();
    });
  }

  function showCreateStrategy() {
    const form = el('div', 'appconfig-modal-form'); const name = input('immediate'); const duration = input('0'); const growth = input('100'); const bake = input('0'); const description = input('', 'Immediate local deployment');
    field(form, 'Strategy name', name); field(form, 'Duration minutes', duration); field(form, 'Growth factor', growth); field(form, 'Final bake minutes', bake); field(form, 'Description', description);
    openModal('Create deployment strategy', form, 'Create', async (close) => {
      const data = await apiJson('/api/appconfig/deployment-strategies/', { method: 'POST', body: JSON.stringify({ name: name.value.trim(), duration_minutes: Number(duration.value), growth_factor: Number(growth.value), final_bake_minutes: Number(bake.value), description: description.value.trim() }) });
      state.lastResult = data; close(); toast('Deployment strategy created'); await refresh();
    });
  }

  function showStartDeployment(application = selectedApplication()) {
    const form = el('div', 'appconfig-modal-form'); const environment = document.createElement('select'); addOptions(environment, application?.environments || []);
    const profile = document.createElement('select'); addOptions(profile, application?.configuration_profiles || []);
    const version = input('1'); const strategy = document.createElement('select'); addOptions(strategy, strategies()); const description = input('', 'Dashboard deployment');
    field(form, 'Environment', environment); field(form, 'Configuration profile', profile); field(form, 'Configuration version', version); field(form, 'Deployment strategy', strategy); field(form, 'Description', description);
    openModal('Start deployment', form, 'Deploy', async (close) => {
      const data = await apiJson('/api/appconfig/deployments/start/', { method: 'POST', body: JSON.stringify({ application_id: application?.id || '', environment_id: environment.value, profile_id: profile.value, configuration_version: version.value.trim(), deployment_strategy_id: strategy.value, description: description.value.trim() }) });
      state.lastResult = data; close(); toast('Deployment started'); await refresh();
    });
  }

  function showStartSession(application = selectedApplication()) {
    const form = el('div', 'appconfig-modal-form'); const environment = document.createElement('select'); addOptions(environment, application?.environments || []);
    const profile = document.createElement('select'); addOptions(profile, application?.configuration_profiles || []);
    field(form, 'Application ID', input(application?.id || '')); field(form, 'Environment', environment); field(form, 'Configuration profile', profile);
    openModal('Start configuration session', form, 'Start', async (close) => {
      const data = await apiJson('/api/appconfig/sessions/start/', { method: 'POST', body: JSON.stringify({ application_id: application?.id || '', environment_id: environment.value, profile_id: profile.value }) });
      state.configurationToken = data.initial_configuration_token || ''; state.lastResult = data; close(); toast('Configuration session started'); render();
    });
  }

  function showGetLatest() {
    const form = el('div', 'appconfig-modal-form'); const token = textarea(state.configurationToken, 'Configuration token');
    field(form, 'Configuration token', token);
    openModal('Get latest configuration', form, 'Get', async (close) => {
      const data = await apiJson('/api/appconfig/configuration/latest/', { method: 'POST', body: JSON.stringify({ configuration_token: token.value.trim() }) });
      state.configurationToken = data.next_poll_configuration_token || token.value.trim(); state.lastResult = data; close(); toast('Latest configuration loaded'); render();
    });
  }

  async function deleteSelectedApplication() {
    const application = selectedApplication(); if (!application || !window.confirm(`Delete AppConfig application ${application.name}?`)) return;
    state.lastResult = await apiJson(`/api/appconfig/applications/${encodeURIComponent(application.id)}/`, { method: 'DELETE' }); state.selectedApplicationId = ''; toast('Application deleted'); await refresh();
  }

  function renderApplicationList() {
    const panel = el('section', 'appconfig-panel'); panel.append(el('div', 'appconfig-panel-heading', 'Applications')); const list = el('div', 'appconfig-list');
    if (!applications().length) list.append(el('p', 'appconfig-empty', 'No AppConfig applications found.'));
    applications().forEach((application) => {
      const row = el('button', `appconfig-row${application.id === selectedApplication()?.id ? ' appconfig-row-active' : ''}`);
      row.append(el('span', 'appconfig-name', application.name), el('span', 'appconfig-meta', `${application.environment_count || 0} environments / ${application.configuration_profile_count || 0} profiles`));
      row.addEventListener('click', () => { state.selectedApplicationId = application.id; render(); }); list.append(row);
    });
    panel.append(list); return panel;
  }

  function renderCards(title, items, fields) {
    const wrapper = el('div', 'appconfig-section'); wrapper.append(el('h3', null, title)); const list = el('div', 'appconfig-card-list');
    if (!items.length) list.append(el('p', 'appconfig-empty', `No ${title.toLowerCase()} found.`));
    items.forEach((item) => { const card = el('article', 'appconfig-card'); card.append(el('h4', null, item.name || item.id || String(item.version_number))); const facts = document.createElement('dl'); fields.forEach(([label, key]) => ui.addField(facts, label, item[key])); card.append(facts); list.append(card); });
    wrapper.append(list); return wrapper;
  }

  function renderDetail(application) {
    const panel = el('section', 'appconfig-panel'); const heading = el('div', 'appconfig-panel-heading'); heading.append(el('span', null, application?.name || 'AppConfig workflow'), el('span', 'appconfig-meta', application?.id || 'Create an application to begin')); panel.append(heading);
    const content = el('div', 'appconfig-detail');
    if (!application) content.append(el('p', 'appconfig-empty', 'Create an application, then add an environment and hosted configuration profile.'));
    else {
      const actions = el('div', 'appconfig-action-row'); actions.append(btn('Create environment', null, () => showCreateEnvironment(application)), btn('Create profile', 'appconfig-btn-secondary', () => showCreateProfile(application)), btn('Create hosted version', 'appconfig-btn-secondary', () => showCreateVersion(application)), btn('Start deployment', 'appconfig-btn-secondary', () => showStartDeployment(application)), btn('Start session', 'appconfig-btn-secondary', () => showStartSession(application)), btn('Delete application', 'appconfig-btn-danger', () => deleteSelectedApplication().catch((error) => toast(error.message, true)))); content.append(actions);
      content.append(renderCards('Environments', application.environments || [], [['ID', 'id'], ['State', 'state'], ['Deployments', 'deployment_count']]));
      content.append(renderCards('Configuration profiles', application.configuration_profiles || [], [['ID', 'id'], ['Location URI', 'location_uri'], ['Type', 'type'], ['Hosted versions', 'hosted_version_count']]));
    }
    content.append(renderCards('Deployment strategies', strategies(), [['ID', 'id'], ['Duration minutes', 'deployment_duration_in_minutes'], ['Growth factor', 'growth_factor']]));
    if (state.lastResult) { const result = el('pre', 'appconfig-result'); result.textContent = JSON.stringify(ui.displayValue(state.lastResult), null, 2); content.append(el('h3', null, 'Last action result'), result); }
    panel.append(content); return panel;
  }

  function render() {
    if (!root) return; root.textContent = '';
    root.append(toolbar([btn('Create application', null, showCreateApplication), btn('Create strategy', 'appconfig-btn-secondary', showCreateStrategy), btn('Get latest configuration', 'appconfig-btn-secondary', showGetLatest), btn('Refresh', 'appconfig-btn-secondary', () => refresh().catch((error) => toast(error.message, true)))], [el('span', 'appconfig-toolbar-note', state.configurationToken ? 'A configuration session token is ready' : 'Management plane + AppConfigData')]));
    const workbench = el('div', 'appconfig-workbench'); workbench.append(renderApplicationList(), renderDetail(selectedApplication())); root.append(workbench);
    if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
  }

  async function refresh() { const data = await apiJson('/api/appconfig/'); state.inventory = data; if (!selectedApplication() && applications().length) state.selectedApplicationId = applications()[0].id; renderSummary(data.summary || {}); render(); }
  function init() { if (!root) return; root.append(el('div', 'appconfig-empty', 'Loading...')); refresh().catch((error) => toast(error.message, true)); }
  return { init, refresh };
})();

window.AppConfigConsole = AppConfigConsole;
if (document.getElementById('appconfig-console-root')) AppConfigConsole.init();
