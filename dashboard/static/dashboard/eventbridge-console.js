/* global ServiceConsole */

const EventBridgeConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('eventbridge-console-root');
  const breadcrumbsEl = document.getElementById('eventbridge-breadcrumbs');
  const summaryEl = document.getElementById('eventbridge-summary');
  const loadedAtEl = document.getElementById('eventbridge-loaded-at');
  const params = new URLSearchParams(window.location.search);
  const validViews = new Set(['buses', 'rules', 'targets', 'send']);
  const state = {
    inventory: null,
    activeView: validViews.has(params.get('view')) ? params.get('view') : 'buses',
    selectedBusName: params.get('bus') || 'default',
    selectedRuleName: params.get('rule') || '',
    selectedTargetId: params.get('target') || '',
    filters: { buses: '', rules: '', targets: '' },
    filterFocus: {},
    lastPut: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'eventbridge', type: isError ? 'error' : 'success',
  });
  const toolbar = (left, right) => consoleUi.toolbar(left, right, 'eventbridge');
  const openModal = (title, body, label, submit) => consoleUi.openModal(title, body, label, submit, { classPrefix: 'eventbridge', toast });

  const buses = () => state.inventory?.event_buses || [];
  const busName = (bus) => bus?.name || bus?.arn || 'default';
  const selectedBus = () => buses().find((bus) => busName(bus) === state.selectedBusName) || buses()[0] || null;
  const rules = () => buses().flatMap((bus) => (bus.rules || []).map((rule) => ({ ...rule, event_bus_name: busName(bus) })));
  const selectedRule = () => rules().find((rule) => rule.event_bus_name === state.selectedBusName && rule.name === state.selectedRuleName) || null;
  const targets = () => rules().flatMap((rule) => (rule.targets || []).map((target) => ({
    ...target,
    id: target.Id || target.id,
    arn: target.Arn || target.arn,
    role_arn: target.RoleArn || target.role_arn,
    event_bus_name: rule.event_bus_name,
    rule_name: rule.name,
  })));
  const selectedTarget = () => targets().find((target) => target.event_bus_name === state.selectedBusName && target.rule_name === state.selectedRuleName && target.id === state.selectedTargetId) || null;

  function urlFor(view, values = {}) {
    const query = new URLSearchParams();
    query.set('view', view);
    if (values.bus) query.set('bus', values.bus);
    if (values.rule) query.set('rule', values.rule);
    if (values.target) query.set('target', values.target);
    return `${window.location.pathname}?${query}`;
  }

  function syncUrl() {
    window.history.replaceState({}, '', urlFor(state.activeView, {
      bus: state.selectedBusName, rule: state.selectedRuleName, target: state.selectedTargetId,
    }));
  }

  function choose(view, bus = '', rule = '', target = '') {
    state.activeView = view;
    if (bus) state.selectedBusName = bus;
    state.selectedRuleName = rule;
    state.selectedTargetId = target;
    syncUrl();
    render();
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'eventbridge',
      targets: { event_buses: 'Event buses', rules: 'Rules', targets: 'Targets', enabled_rules: 'Rules' },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) return;
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('Amazon EventBridge', null, () => choose('buses')));
    const labels = { buses: 'Event buses', rules: 'Rules', targets: 'Targets', send: 'Send events' };
    breadcrumbsEl.append(el('span', null, '/'), el('span', null, labels[state.activeView]));
    if (state.selectedBusName && state.activeView !== 'buses') breadcrumbsEl.append(el('span', null, '/'), el('span', null, state.selectedBusName));
    if (state.selectedRuleName && state.activeView === 'targets') breadcrumbsEl.append(el('span', null, '/'), el('span', null, state.selectedRuleName));
  }

  function parseJson(value, fallback = null, label = 'JSON') {
    const clean = String(value || '').trim();
    if (!clean) return fallback;
    try { return JSON.parse(clean); } catch (error) { throw new Error(`${label} must be valid JSON`); }
  }

  async function mutate(url, payload, message) {
    const data = await apiJson(url, { method: 'POST', body: JSON.stringify(payload) });
    toast(message);
    await refresh();
    return data;
  }

  function showCreateBusModal() {
    const form = el('div', 'eventbridge-modal-form');
    const name = document.createElement('input'); name.placeholder = 'application-events';
    const description = document.createElement('input'); description.placeholder = 'Application domain events';
    form.append(el('label', null, 'Name'), name, el('label', null, 'Description'), description);
    openModal('Create event bus', form, 'Create event bus', async (close) => {
      const cleanName = name.value.trim();
      await mutate('/api/eventbridge/buses/create/', { name: cleanName, description: description.value }, `Event bus ${cleanName} created`);
      state.selectedBusName = cleanName; close(); choose('buses', cleanName);
    });
  }

  function showRuleModal(bus, rule = null) {
    const form = el('div', 'eventbridge-modal-form');
    const name = document.createElement('input'); name.value = rule?.name || ''; name.placeholder = 'order-created';
    const description = document.createElement('input'); description.value = rule?.description || '';
    const pattern = document.createElement('textarea'); pattern.value = rule?.event_pattern || '{\n  "source": ["com.example.orders"]\n}';
    const schedule = document.createElement('input'); schedule.value = rule?.schedule_expression || ''; schedule.placeholder = 'Optional: rate(5 minutes)';
    form.append(el('label', null, 'Rule name'), name, el('label', null, 'Description'), description, el('label', null, 'Event pattern JSON'), pattern, el('label', null, 'Schedule expression'), schedule);
    openModal(rule ? 'Update rule' : 'Create rule', form, rule ? 'Save changes' : 'Create rule', async (close) => {
      const cleanName = name.value.trim();
      await mutate('/api/eventbridge/rules/put/', {
        name: cleanName, event_bus_name: busName(bus), description: description.value,
        event_pattern: parseJson(pattern.value, null, 'Event pattern'), schedule_expression: schedule.value,
        state: rule?.state || 'ENABLED',
      }, `Rule ${cleanName} saved`);
      state.selectedBusName = busName(bus); state.selectedRuleName = cleanName; close(); choose('rules', state.selectedBusName, cleanName);
    });
  }

  function showTargetModal(bus, rule, target = null) {
    const form = el('div', 'eventbridge-modal-form');
    const id = document.createElement('input'); id.value = target?.id || ''; id.placeholder = 'orders-queue';
    const arn = document.createElement('input'); arn.value = target?.arn || ''; arn.placeholder = 'arn:aws:sqs:us-east-1:000000000000:orders';
    const role = document.createElement('input'); role.value = target?.role_arn || ''; role.placeholder = 'Optional execution role ARN';
    const input = document.createElement('textarea'); input.value = target?.Input || target?.input || ''; input.placeholder = 'Optional constant JSON input';
    form.append(el('label', null, 'Target ID'), id, el('label', null, 'Target ARN'), arn, el('label', null, 'Role ARN'), role, el('label', null, 'Constant input JSON'), input);
    openModal(target ? 'Update target' : 'Add target', form, 'Save target', async (close) => {
      const cleanId = id.value.trim();
      await mutate('/api/eventbridge/targets/put/', {
        rule_name: rule.name, event_bus_name: busName(bus), target_id: cleanId,
        arn: arn.value.trim(), role_arn: role.value.trim(), input: parseJson(input.value, null, 'Constant input'),
      }, `Target ${cleanId} saved`);
      close(); choose('targets', busName(bus), rule.name, cleanId);
    });
  }

  function showPutEventModal(bus, replay = null) {
    const form = el('div', 'eventbridge-modal-form');
    const source = document.createElement('input'); source.value = replay?.source || ''; source.placeholder = 'com.example.orders';
    const detailType = document.createElement('input'); detailType.value = replay?.detail_type || ''; detailType.placeholder = 'OrderCreated';
    const detail = document.createElement('textarea'); detail.className = 'eventbridge-detail-input'; detail.value = JSON.stringify(replay?.detail || { order_id: 'local-123', status: 'created' }, null, 2);
    form.append(el('label', null, 'Event bus'), el('pre', 'eventbridge-bus-preview', busName(bus)), el('label', null, 'Source'), source, el('label', null, 'Detail type'), detailType, el('label', null, 'Event detail JSON'), detail);
    openModal('Send event', form, 'Send event', async (close) => {
      const payload = { event_bus_name: busName(bus), source: source.value.trim(), detail_type: detailType.value.trim(), detail: parseJson(detail.value, {}, 'Event detail') };
      const data = await apiJson('/api/eventbridge/events/put/', { method: 'POST', body: JSON.stringify(payload) });
      state.lastPut = data;
      consoleUi.recordActivity({ service: 'eventbridge', action: 'put_event', title: `${payload.source} / ${payload.detail_type}`, summary: payload.event_bus_name, detail: data.event_id ? `Event ${data.event_id}` : `${data.failed_entry_count || 0} failed`, replayLabel: 'Replay', payload });
      close(); toast(data.failed_entry_count ? (data.error_message || 'Event was not accepted') : (data.event_id ? `Event sent: ${data.event_id}` : 'Event sent'), Boolean(data.failed_entry_count)); render();
    });
  }

  function setFilter(view, value, focus) {
    state.filters[view] = value;
    state.filterFocus[view] = focus;
    render();
  }

  function resourceCollection(view, title, items, columns, href, actions = []) {
    const focus = state.filterFocus[view] || {};
    return consoleUi.renderCollection({
      title, items, mode: 'table', columns, primaryColumn: columns[0], primaryHref: href,
      itemKey: (item) => href(item), classPrefix: 'eventbridge', filterText: state.filters[view],
      filterPlaceholder: `Find ${title.toLowerCase()}`, countLabel: title.toLowerCase(), actions,
      restoreFocus: focus.restoreFocus, selectionStart: focus.selectionStart, selectionEnd: focus.selectionEnd,
      lastUpdatedLabel: loadedAtEl?.textContent || '',
      onFilterTextChange: (value, options) => setFilter(view, value, options),
    });
  }

  function detailHeader(title, subtitle, status = '') {
    const header = el('div', 'eventbridge-detail-header');
    const text = el('div'); text.append(el('p', 'eyebrow', subtitle), el('h3', null, title));
    header.append(text);
    if (status) header.append(el('span', `eventbridge-rule-state eventbridge-rule-state-${status.toLowerCase()}`, status));
    return header;
  }

  function facts(fields) {
    const list = el('dl', 'eventbridge-facts');
    fields.forEach(([label, value]) => consoleUi.addField(list, label, value));
    return list;
  }

  function destination(arn) {
    const parts = String(arn || '').split(':');
    const service = parts[2];
    const resource = parts.slice(5).join(':');
    if (service === 'sqs') return { label: 'Open queue in SQS', href: `/service/sqs/?queue=${encodeURIComponent(resource)}` };
    if (service === 'lambda') return { label: 'Open function in Lambda', href: `/service/lambda/?function=${encodeURIComponent(resource.replace(/^function:/, ''))}` };
    if (service === 'sns') return { label: 'Open topic in SNS', href: `/service/sns/?topic=${encodeURIComponent(arn)}` };
    if (service === 'states') return { label: 'Open workflow in Step Functions', href: `/service/stepfunctions/?state_machine=${encodeURIComponent(arn)}` };
    if (service === 'firehose') return { label: 'Open stream in Firehose', href: `/service/firehose/?stream=${encodeURIComponent(resource.replace(/^deliverystream\//, ''))}` };
    return null;
  }

  function renderBuses() {
    const panel = el('div', 'eventbridge-resource-page');
    panel.append(resourceCollection('buses', 'Event buses', buses(), [
      { label: 'Name', key: 'name', primary: true }, { label: 'Rules', key: 'rule_count' },
      { label: 'Targets', key: 'target_count' }, { label: 'ARN', key: 'arn' },
    ], (bus) => urlFor('buses', { bus: busName(bus) }), [btn('Create event bus', null, showCreateBusModal)]));
    const bus = selectedBus();
    if (bus) {
      const detail = el('section', 'eventbridge-detail-panel');
      detail.append(detailHeader(busName(bus), 'Event bus'));
      const actions = el('div', 'eventbridge-action-row');
      actions.append(btn('Send event', null, () => showPutEventModal(bus)), btn('Create rule', 'eventbridge-btn-secondary', () => showRuleModal(bus)));
      if (busName(bus) !== 'default') actions.append(btn('Delete event bus', 'eventbridge-btn-danger', () => {
        if (!window.confirm(`Delete event bus ${busName(bus)}? Delete its rules first.`)) return;
        mutate('/api/eventbridge/buses/delete/', { name: busName(bus) }, `Event bus ${busName(bus)} deleted`).then(() => choose('buses')).catch((error) => toast(error.message, true));
      }));
      detail.append(actions, facts([['ARN', bus.arn], ['Description', bus.description], ['Policy', bus.policy], ['Rules', bus.rule_count], ['Targets', bus.target_count]]));
      panel.append(detail);
    }
    return panel;
  }

  function renderRules() {
    const panel = el('div', 'eventbridge-resource-page');
    panel.append(resourceCollection('rules', 'Rules', rules(), [
      { label: 'Name', key: 'name', primary: true }, { label: 'Event bus', key: 'event_bus_name' },
      { label: 'State', key: 'state' }, { label: 'Targets', key: 'target_count' }, { label: 'Schedule', key: 'schedule_expression' },
    ], (rule) => urlFor('rules', { bus: rule.event_bus_name, rule: rule.name }), [btn('Create rule', null, () => showRuleModal(selectedBus()))]));
    const rule = selectedRule();
    if (rule) {
      const bus = buses().find((item) => busName(item) === rule.event_bus_name);
      const detail = el('section', `eventbridge-detail-panel${params.get('rule') === rule.name ? ' eventbridge-rule-requested' : ''}`);
      detail.append(detailHeader(rule.name, `Rule on ${rule.event_bus_name}`, rule.state));
      const actions = el('div', 'eventbridge-action-row');
      actions.append(btn('Edit rule', null, () => showRuleModal(bus, rule)), btn(rule.state === 'ENABLED' ? 'Disable' : 'Enable', 'eventbridge-btn-secondary', () => mutate('/api/eventbridge/rules/state/', { name: rule.name, event_bus_name: rule.event_bus_name, enabled: rule.state !== 'ENABLED' }, `Rule ${rule.name} ${rule.state === 'ENABLED' ? 'disabled' : 'enabled'}`).catch((error) => toast(error.message, true))), btn('Add target', 'eventbridge-btn-secondary', () => showTargetModal(bus, rule)), btn('Delete rule', 'eventbridge-btn-danger', () => {
        if (!window.confirm(`Delete rule ${rule.name}? Remove its targets first.`)) return;
        mutate('/api/eventbridge/rules/delete/', { name: rule.name, event_bus_name: rule.event_bus_name }, `Rule ${rule.name} deleted`).then(() => choose('rules', rule.event_bus_name)).catch((error) => toast(error.message, true));
      }));
      detail.append(actions, facts([['ARN', rule.arn], ['Description', rule.description], ['Event pattern', rule.event_pattern], ['Schedule expression', rule.schedule_expression], ['Role ARN', rule.role_arn], ['Managed by', rule.managed_by], ['Target count', rule.target_count]]));
      panel.append(detail);
    }
    return panel;
  }

  function renderTargets() {
    const panel = el('div', 'eventbridge-resource-page');
    panel.append(resourceCollection('targets', 'Targets', targets(), [
      { label: 'Target ID', key: 'id', primary: true }, { label: 'Rule', key: 'rule_name' },
      { label: 'Event bus', key: 'event_bus_name' }, { label: 'Destination ARN', key: 'arn' },
    ], (target) => urlFor('targets', { bus: target.event_bus_name, rule: target.rule_name, target: target.id })));
    const target = selectedTarget();
    if (target) {
      const bus = buses().find((item) => busName(item) === target.event_bus_name);
      const rule = rules().find((item) => item.event_bus_name === target.event_bus_name && item.name === target.rule_name);
      const detail = el('section', 'eventbridge-detail-panel');
      detail.append(detailHeader(target.id, `Target for ${target.rule_name}`));
      const actions = el('div', 'eventbridge-action-row');
      actions.append(btn('Edit target', null, () => showTargetModal(bus, rule, target)), btn('Remove target', 'eventbridge-btn-danger', () => {
        if (!window.confirm(`Remove target ${target.id} from ${target.rule_name}?`)) return;
        mutate('/api/eventbridge/targets/remove/', { rule_name: target.rule_name, event_bus_name: target.event_bus_name, target_id: target.id }, `Target ${target.id} removed`).then(() => choose('targets', target.event_bus_name, target.rule_name)).catch((error) => toast(error.message, true));
      }));
      const link = destination(target.arn);
      if (link) { const anchor = el('a', 'eventbridge-resource-link', link.label); anchor.href = link.href; actions.append(anchor); }
      detail.append(actions, facts([['Destination ARN', target.arn], ['Role ARN', target.role_arn], ['Constant input', target.Input || target.input], ['Input path', target.InputPath || target.input_path], ['Input transformer', target.InputTransformer], ['Retry policy', target.RetryPolicy], ['Dead-letter configuration', target.DeadLetterConfig]]));
      panel.append(detail);
    }
    return panel;
  }

  function renderSend() {
    const bus = selectedBus();
    const panel = el('section', 'eventbridge-detail-panel eventbridge-send-panel');
    panel.append(detailHeader('Send events', 'Test EventBridge routing'));
    const picker = document.createElement('select');
    buses().forEach((item) => { const option = document.createElement('option'); option.value = busName(item); option.textContent = busName(item); option.selected = option.value === busName(bus); picker.append(option); });
    picker.addEventListener('change', () => { state.selectedBusName = picker.value; syncUrl(); render(); });
    const controls = el('div', 'eventbridge-send-controls');
    controls.append(el('label', null, 'Event bus'), picker, btn('Send event', null, () => selectedBus() && showPutEventModal(selectedBus())));
    panel.append(controls);
    if (state.lastPut) panel.append(facts([['Event bus', state.lastPut.event_bus_name], ['Event ID', state.lastPut.event_id], ['Failed entries', state.lastPut.failed_entry_count], ['Error code', state.lastPut.error_code], ['Error message', state.lastPut.error_message]]));
    panel.append(consoleUi.renderActivityPanel({ service: 'eventbridge', classPrefix: 'eventbridge', title: 'Recent events', actions: ['put_event'], emptyText: 'Send an event to build a local replay history.', onReplay: (item) => { state.selectedBusName = item.payload?.event_bus_name || 'default'; showPutEventModal(selectedBus(), item.payload); }, onClear: render }));
    return panel;
  }

  function render() {
    if (!root) return;
    renderBreadcrumbs();
    root.textContent = '';
    const tabs = el('nav', 'eventbridge-resource-tabs');
    [['buses', 'Event buses'], ['rules', 'Rules'], ['targets', 'Targets'], ['send', 'Send events']].forEach(([view, label]) => tabs.append(btn(label, state.activeView === view ? 'eventbridge-tab-active' : 'eventbridge-btn-secondary', () => choose(view, state.selectedBusName))));
    root.append(toolbar([tabs], [btn('Refresh', 'eventbridge-btn-secondary', refresh), (() => { const link = el('a', 'eventbridge-lab-link', 'Open application lab'); link.href = '/service/eventbridge/labs/?lab=application-spine'; return link; })()]));
    if (state.activeView === 'rules') root.append(renderRules());
    else if (state.activeView === 'targets') root.append(renderTargets());
    else if (state.activeView === 'send') root.append(renderSend());
    else root.append(renderBuses());
  }

  async function refresh() {
    state.inventory = await apiJson('/api/eventbridge/');
    if (!buses().some((bus) => busName(bus) === state.selectedBusName)) state.selectedBusName = busName(buses()[0]);
    if (state.selectedRuleName && !selectedRule()) state.selectedRuleName = '';
    if (state.selectedTargetId && !selectedTarget()) state.selectedTargetId = '';
    renderSummary(state.inventory.summary || {});
    if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
    syncUrl(); render();
  }

  function init() {
    if (!root) return;
    root.append(el('div', 'eventbridge-empty', 'Loading EventBridge resources...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.EventBridgeConsole = EventBridgeConsole;
if (document.getElementById('eventbridge-console-root')) EventBridgeConsole.init();
