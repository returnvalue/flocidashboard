/* global ServiceConsole */

const CloudMapConsole = (() => {
  const ui = window.ServiceConsole;
  const root = document.getElementById('cloudmap-console-root');
  const summaryEl = document.getElementById('cloudmap-summary');
  const loadedAtEl = document.getElementById('cloudmap-loaded-at');
  const ACTION_FALLBACKS = [
    { name: 'create_namespace', label: 'Create namespace', kind: 'create', safety: 'mutating' },
    { name: 'delete_namespace', label: 'Delete namespace', kind: 'delete', safety: 'destructive', confirm: 'Delete this Cloud Map namespace?' },
    { name: 'create_service', label: 'Create service', kind: 'create', safety: 'mutating' },
    { name: 'delete_service', label: 'Delete service', kind: 'delete', safety: 'destructive', confirm: 'Delete this Cloud Map service?' },
    { name: 'register_instance', label: 'Register instance', kind: 'create', safety: 'mutating' },
    { name: 'deregister_instance', label: 'Deregister instance', kind: 'delete', safety: 'destructive', confirm: 'Deregister this Cloud Map instance?' },
    { name: 'discover_instances', label: 'Discover instances', kind: 'read', safety: 'safe' },
    { name: 'update_instance_custom_health_status', label: 'Update instance health', kind: 'update', safety: 'mutating' },
    { name: 'tag_resource', label: 'Tag resource', kind: 'update', safety: 'mutating' },
    { name: 'untag_resource', label: 'Untag resource', kind: 'update', safety: 'mutating' },
  ];
  const ACTION_LABELS = {
    create_namespace: 'Create namespace',
    delete_namespace: 'Delete',
    create_service: 'Create service',
    delete_service: 'Delete service',
    register_instance: 'Register instance',
    deregister_instance: 'Deregister',
    discover_instances: 'Discover',
    tag_resource: 'Tags',
    untag_resource: 'Remove tags',
  };
  const state = { inventory: null, selectedServiceId: '', lastResult: null, actions: null };
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
  function renderActionButtons(names, handlers) {
    return state.actions.renderButtons(names, handlers, { classPrefix: 'cloudmap', labels: ACTION_LABELS });
  }

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
    form.append(renderActionButtons(['tag_resource'], {
      tag_resource: () => runAction('/api/cloudmap/tags/', 'POST', { resource_arn: resource.arn, tags: parseJson(tags.value, {}, 'Tags') }, 'Tags added').catch((error) => toast(error.message, true)),
    }));
    field(form, 'Remove tag keys', keys);
    form.append(renderActionButtons(['untag_resource'], {
      untag_resource: () => runAction('/api/cloudmap/tags/', 'DELETE', { resource_arn: resource.arn, tag_keys: parseList(keys.value) }, 'Tags removed').catch((error) => toast(error.message, true)),
    }));
    openModal('Resource tags', form, 'Done', (close) => close());
  }

  async function deleteNamespace(namespace) {
    await runAction(`/api/cloudmap/namespaces/${encodeURIComponent(namespace.id)}/`, 'DELETE', {}, 'Namespace deletion started');
  }

  async function deleteService(service) {
    await runAction(`/api/cloudmap/services/${encodeURIComponent(service.id)}/`, 'DELETE', {}, 'Service deleted');
    state.selectedServiceId = '';
  }

  async function deregister(service, instance) {
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
      row.append(renderActionButtons(['create_service', 'tag_resource', 'delete_namespace'], {
        create_service: () => showCreateService(namespace),
        tag_resource: namespace.arn ? () => showTags(namespace) : null,
        delete_namespace: () => deleteNamespace(namespace).catch((error) => toast(error.message, true)),
      }));
      list.append(row);
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
      body.append(renderActionButtons(['register_instance', 'discover_instances', 'tag_resource', 'delete_service'], {
        register_instance: () => showRegisterInstance(service),
        discover_instances: showDiscover,
        tag_resource: service.arn ? () => showTags(service) : null,
        delete_service: () => deleteService(service).catch((error) => toast(error.message, true)),
      }));
      const instances = el('div', 'cloudmap-card-list');
      if (!(service.instances || []).length) instances.append(el('p', 'cloudmap-empty', 'No registered instances found.'));
      (service.instances || []).forEach((instance) => {
        const card = el('article', 'cloudmap-card'); card.append(el('h4', null, instance.id || 'Instance'));
        const instanceFacts = el('dl', 'cloudmap-facts'); [['Attributes', instance.attributes], ['Creator request ID', instance.creator_request_id]].forEach(([label, value]) => ui.addField(instanceFacts, label, value)); card.append(instanceFacts);
        const row = el('div', 'cloudmap-action-row');
        row.append(btn('Mark healthy', 'cloudmap-btn-secondary', () => runAction(`/api/cloudmap/services/${encodeURIComponent(service.id)}/instances/${encodeURIComponent(instance.id)}/health/`, 'POST', { status: 'HEALTHY' }, 'Health status updated').catch((error) => toast(error.message, true))), btn('Mark unhealthy', 'cloudmap-btn-secondary', () => runAction(`/api/cloudmap/services/${encodeURIComponent(service.id)}/instances/${encodeURIComponent(instance.id)}/health/`, 'POST', { status: 'UNHEALTHY' }, 'Health status updated').catch((error) => toast(error.message, true))));
        row.append(...renderActionButtons(['deregister_instance'], {
          deregister_instance: () => deregister(service, instance).catch((error) => toast(error.message, true)),
        }).children);
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
    const actions = renderActionButtons(['create_namespace', 'create_service'], {
      create_namespace: showCreateNamespace,
      create_service: () => showCreateService(),
    });
    const toolbar = ui.toolbar([...actions.children, btn('Refresh', 'cloudmap-btn-secondary', () => refresh().catch((error) => toast(error.message, true)))], [el('span', 'cloudmap-toolbar-note', 'Service discovery management API')], 'cloudmap');
    const workbench = el('div', 'cloudmap-workbench'); workbench.append(renderNamespaces(), renderServices(), renderServiceDetail(selectedService()));
    root.append(toolbar, workbench);
    if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
  }

  async function refresh() {
    const [data, actions] = await Promise.all([apiJson('/api/cloudmap/'), state.actions || ui.loadServiceActions('cloudmap', ACTION_FALLBACKS)]);
    state.inventory = data;
    state.actions = actions;
    if (!selectedService() && services().length) state.selectedServiceId = services()[0].id;
    render();
  }

  function init() { if (!root) return; root.append(el('div', 'cloudmap-empty', 'Loading...')); refresh().catch((error) => toast(error.message, true)); }
  return { init, refresh };
})();

window.CloudMapConsole = CloudMapConsole;
if (document.getElementById('cloudmap-console-root')) CloudMapConsole.init();
