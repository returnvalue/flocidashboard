/* global ServiceConsole */

const CloudMapConsole = (() => {
  const ui = window.ServiceConsole;
  const root = document.getElementById('cloudmap-console-root');
  const summaryEl = document.getElementById('cloudmap-summary');
  const loadedAtEl = document.getElementById('cloudmap-loaded-at');
  const state = { inventory: null, selectedServiceId: '', lastResult: null };
  const el = ui.el;
  const btn = ui.button;
  const apiJson = ui.apiJson;
  const toast = (message, isError = false) => ui.toast(message, { classPrefix: 'cloudmap', type: isError ? 'error' : 'success' });
  const openModal = (title, body, label, confirm) => ui.openModal(title, body, label, confirm, { classPrefix: 'cloudmap', toast });

  function namespaces() { return state.inventory?.namespaces || []; }
  function services() { return state.inventory?.services || []; }
  function selectedService() { return services().find((service) => service.id === state.selectedServiceId) || services()[0] || null; }
  function input(value = '', placeholder = '') { const node = document.createElement('input'); node.value = value; node.placeholder = placeholder; return node; }
  function textarea(value = '', placeholder = '') { const node = document.createElement('textarea'); node.value = value; node.placeholder = placeholder; return node; }
  function select(options, value = '') { const node = document.createElement('select'); options.forEach(([itemValue, label]) => { const option = document.createElement('option'); option.value = itemValue; option.textContent = label; if (itemValue === value) option.selected = true; node.append(option); }); return node; }
  function field(form, label, control) { form.append(el('label', null, label), control); }
  function parseJson(value, fallback, label) { const text = String(value || '').trim(); if (!text) return fallback; try { return JSON.parse(text); } catch (_error) { throw new Error(`${label} must be valid JSON`); } }
  function parseList(value) { return String(value || '').split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean); }
  function renderSummary(summary) { ui.renderSummary(summary, summaryEl, { serviceKey: 'cloudmap', targets: { namespaces: 'Namespaces', services: 'Services', instances: 'Instances', operations: 'Operations' } }); }

  async function runAction(path, method, body, message, close) {
    state.lastResult = await apiJson(path, { method, body: JSON.stringify(body || {}) });
    if (close) close();
    toast(message);
    await refresh();
  }

  function showCreateNamespace() {
    const form = el('div', 'cloudmap-modal-form');
    const name = input('local.test');
    const type = select([['HTTP', 'HTTP'], ['PUBLIC_DNS', 'Public DNS'], ['PRIVATE_DNS', 'Private DNS']], 'HTTP');
    const description = input('', 'Local discovery namespace');
    const vpc = input('', 'vpc-...');
    const tags = textarea('{"env":"local"}');
    field(form, 'Namespace name', name); field(form, 'Type', type); field(form, 'Description', description); field(form, 'VPC ID', vpc); field(form, 'Tags JSON', tags);
    openModal('Create namespace', form, 'Create', (close) => runAction('/api/cloudmap/namespaces/', 'POST', { name: name.value.trim(), namespace_type: type.value, description: description.value.trim(), vpc: vpc.value.trim(), tags: parseJson(tags.value, {}, 'Tags') }, 'Namespace creation started', close));
  }

  function showCreateService(namespace = namespaces()[0]) {
    const form = el('div', 'cloudmap-modal-form');
    const name = input('api');
    const namespaceId = input(namespace?.id || '', 'ns-...');
    const description = input('', 'Local service');
    const dnsConfig = textarea('', '{"DnsRecords":[{"Type":"A","TTL":30}]}');
    const customHealth = textarea('{"FailureThreshold":1}');
    const tags = textarea('{"env":"local"}');
    field(form, 'Service name', name); field(form, 'Namespace ID', namespaceId); field(form, 'Description', description); field(form, 'DNS config JSON', dnsConfig); field(form, 'Custom health JSON', customHealth); field(form, 'Tags JSON', tags);
    openModal('Create service', form, 'Create', (close) => runAction('/api/cloudmap/services/', 'POST', { name: name.value.trim(), namespace_id: namespaceId.value.trim(), description: description.value.trim(), dns_config: parseJson(dnsConfig.value, {}, 'DNS config'), health_check_custom_config: parseJson(customHealth.value, {}, 'Custom health config'), tags: parseJson(tags.value, {}, 'Tags') }, 'Service created', close));
  }

  function showRegisterInstance(service = selectedService()) {
    const form = el('div', 'cloudmap-modal-form');
    const instanceId = input('instance-1');
    const attributes = textarea('{"AWS_INSTANCE_IPV4":"127.0.0.1","port":"8080"}');
    field(form, 'Instance ID', instanceId); field(form, 'Attributes JSON', attributes);
    openModal('Register instance', form, 'Register', (close) => runAction(`/api/cloudmap/services/${encodeURIComponent(service.id)}/instances/`, 'POST', { instance_id: instanceId.value.trim(), attributes: parseJson(attributes.value, {}, 'Attributes') }, 'Instance registration started', close));
  }

  function showDiscover() {
    const service = selectedService();
    const namespace = namespaces().find((item) => item.id === service?.namespace_id) || namespaces()[0];
    const form = el('div', 'cloudmap-modal-form');
    const namespaceName = input(namespace?.name || '');
    const serviceName = input(service?.name || '');
    const query = textarea('', '{"stage":"local"}');
    field(form, 'Namespace name', namespaceName); field(form, 'Service name', serviceName); field(form, 'Query parameters JSON', query);
    openModal('Discover instances', form, 'Discover', async (close) => {
      state.lastResult = await apiJson('/api/cloudmap/discover/', { method: 'POST', body: JSON.stringify({ namespace_name: namespaceName.value.trim(), service_name: serviceName.value.trim(), query_parameters: parseJson(query.value, {}, 'Query parameters') }) });
      close(); toast('Discovery complete'); render();
    });
  }

  function showTags(resource) {
    const form = el('div', 'cloudmap-modal-form');
    const tags = textarea('{"env":"local"}');
    const keys = input('', 'env,team');
    field(form, 'Add tags JSON', tags);
    form.append(btn('Add tags', null, () => runAction('/api/cloudmap/tags/', 'POST', { resource_arn: resource.arn, tags: parseJson(tags.value, {}, 'Tags') }, 'Tags added').catch((error) => toast(error.message, true))));
    field(form, 'Remove tag keys', keys);
    form.append(btn('Remove tags', 'cloudmap-btn-secondary', () => runAction('/api/cloudmap/tags/', 'DELETE', { resource_arn: resource.arn, tag_keys: parseList(keys.value) }, 'Tags removed').catch((error) => toast(error.message, true))));
    openModal('Resource tags', form, 'Done', (close) => close());
  }

  async function deleteNamespace(namespace) {
    if (!ui.confirmAction(`Delete namespace ${namespace.name || namespace.id}?`)) return;
    await runAction(`/api/cloudmap/namespaces/${encodeURIComponent(namespace.id)}/`, 'DELETE', {}, 'Namespace deletion started');
  }

  async function deleteService(service) {
    if (!ui.confirmAction(`Delete service ${service.name || service.id}?`)) return;
    await runAction(`/api/cloudmap/services/${encodeURIComponent(service.id)}/`, 'DELETE', {}, 'Service deleted');
    state.selectedServiceId = '';
  }

  async function deregister(service, instance) {
    if (!ui.confirmAction(`Deregister instance ${instance.id}?`)) return;
    await runAction(`/api/cloudmap/services/${encodeURIComponent(service.id)}/instances/${encodeURIComponent(instance.id)}/`, 'DELETE', {}, 'Instance deregistration started');
  }

  function renderNamespaces() {
    const panel = el('section', 'cloudmap-panel'); panel.append(el('div', 'cloudmap-panel-heading', 'Namespaces'));
    const list = el('div', 'cloudmap-list');
    if (!namespaces().length) list.append(el('p', 'cloudmap-empty', 'No Cloud Map namespaces found.'));
    namespaces().forEach((namespace) => {
      const row = el('article', 'cloudmap-card');
      row.append(el('h4', null, namespace.name || namespace.id));
      const facts = el('dl', 'cloudmap-facts');
      [['Namespace ID', namespace.id], ['Type', namespace.type], ['Services', namespace.service_count], ['ARN', namespace.arn], ['Tags', namespace.tags]].forEach(([label, value]) => ui.addField(facts, label, value));
      row.append(facts);
      const actions = el('div', 'cloudmap-action-row');
      actions.append(btn('Create service', null, () => showCreateService(namespace)), namespace.arn ? btn('Tags', 'cloudmap-btn-secondary', () => showTags(namespace)) : '', btn('Delete', 'cloudmap-btn-danger', () => deleteNamespace(namespace).catch((error) => toast(error.message, true))));
      row.append(actions); list.append(row);
    });
    panel.append(list); return panel;
  }

  function renderServices() {
    const panel = el('section', 'cloudmap-panel'); panel.append(el('div', 'cloudmap-panel-heading', 'Services'));
    const list = el('div', 'cloudmap-list');
    if (!services().length) list.append(el('p', 'cloudmap-empty', 'No Cloud Map services found.'));
    services().forEach((service) => {
      const row = el('button', `cloudmap-row${service.id === selectedService()?.id ? ' cloudmap-row-active' : ''}`);
      row.append(el('span', 'cloudmap-name', service.name || service.id), el('span', 'cloudmap-meta', `${service.instance_count || 0} instances / ${service.namespace_id || 'namespace unset'}`));
      row.addEventListener('click', () => { state.selectedServiceId = service.id; render(); });
      list.append(row);
    });
    panel.append(list); return panel;
  }

  function renderServiceDetail(service) {
    const panel = el('section', 'cloudmap-panel'); panel.append(el('div', 'cloudmap-panel-heading', service?.name || 'Service detail'));
    const body = el('div', 'cloudmap-detail');
    if (!service) body.append(el('p', 'cloudmap-empty', 'Create a namespace and service to start registering discoverable instances.'));
    else {
      const facts = el('dl', 'cloudmap-facts');
      [['Service ID', service.id], ['Namespace ID', service.namespace_id], ['ARN', service.arn], ['Description', service.description], ['DNS config', service.dns_config], ['Custom health check', service.health_check_custom_config], ['Tags', service.tags]].forEach(([label, value]) => ui.addField(facts, label, value));
      body.append(facts);
      const actions = el('div', 'cloudmap-action-row');
      actions.append(btn('Register instance', null, () => showRegisterInstance(service)), btn('Discover', 'cloudmap-btn-secondary', showDiscover), service.arn ? btn('Tags', 'cloudmap-btn-secondary', () => showTags(service)) : '', btn('Delete service', 'cloudmap-btn-danger', () => deleteService(service).catch((error) => toast(error.message, true))));
      body.append(actions);
      const instances = el('div', 'cloudmap-card-list');
      if (!(service.instances || []).length) instances.append(el('p', 'cloudmap-empty', 'No registered instances found.'));
      (service.instances || []).forEach((instance) => {
        const card = el('article', 'cloudmap-card'); card.append(el('h4', null, instance.id || 'Instance'));
        const instanceFacts = el('dl', 'cloudmap-facts'); [['Attributes', instance.attributes], ['Creator request ID', instance.creator_request_id]].forEach(([label, value]) => ui.addField(instanceFacts, label, value)); card.append(instanceFacts);
        const row = el('div', 'cloudmap-action-row');
        row.append(btn('Mark healthy', 'cloudmap-btn-secondary', () => runAction(`/api/cloudmap/services/${encodeURIComponent(service.id)}/instances/${encodeURIComponent(instance.id)}/health/`, 'POST', { status: 'HEALTHY' }, 'Health status updated').catch((error) => toast(error.message, true))), btn('Mark unhealthy', 'cloudmap-btn-secondary', () => runAction(`/api/cloudmap/services/${encodeURIComponent(service.id)}/instances/${encodeURIComponent(instance.id)}/health/`, 'POST', { status: 'UNHEALTHY' }, 'Health status updated').catch((error) => toast(error.message, true))), btn('Deregister', 'cloudmap-btn-danger', () => deregister(service, instance).catch((error) => toast(error.message, true))));
        card.append(row); instances.append(card);
      });
      body.append(el('h3', null, 'Instances'), instances);
    }
    if (state.lastResult) { const result = el('pre', 'cloudmap-result'); result.textContent = JSON.stringify(ui.displayValue(state.lastResult), null, 2); body.append(el('h3', null, 'Last action result'), result); }
    panel.append(body); return panel;
  }

  function render() {
    if (!root) return;
    root.textContent = ''; renderSummary(state.inventory?.summary || {});
    const toolbar = ui.toolbar([btn('Create namespace', null, showCreateNamespace), btn('Create service', 'cloudmap-btn-secondary', () => showCreateService()), btn('Refresh', 'cloudmap-btn-secondary', () => refresh().catch((error) => toast(error.message, true)))], [el('span', 'cloudmap-toolbar-note', 'Service discovery management API')], 'cloudmap');
    const workbench = el('div', 'cloudmap-workbench'); workbench.append(renderNamespaces(), renderServices(), renderServiceDetail(selectedService()));
    root.append(toolbar, workbench);
    if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
  }

  async function refresh() {
    const data = await apiJson('/api/cloudmap/');
    state.inventory = data;
    if (!selectedService() && services().length) state.selectedServiceId = services()[0].id;
    render();
  }

  function init() { if (!root) return; root.append(el('div', 'cloudmap-empty', 'Loading...')); refresh().catch((error) => toast(error.message, true)); }
  return { init, refresh };
})();

window.CloudMapConsole = CloudMapConsole;
if (document.getElementById('cloudmap-console-root')) CloudMapConsole.init();
