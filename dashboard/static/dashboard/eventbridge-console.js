/* global ServiceConsole */

const EventBridgeConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('eventbridge-console-root');
  const breadcrumbsEl = document.getElementById('eventbridge-breadcrumbs');
  const summaryEl = document.getElementById('eventbridge-summary');
  const loadedAtEl = document.getElementById('eventbridge-loaded-at');
  const requestedBusName = new URLSearchParams(window.location.search).get('bus') || 'default';
  const requestedRuleName = new URLSearchParams(window.location.search).get('rule') || '';

  const state = {
    inventory: null,
    selectedBusName: requestedBusName,
    lastPut: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'eventbridge',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'eventbridge');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'eventbridge',
      toast,
    });

  async function mutate(url, payload, message) {
    const data = await apiJson(url, { method: 'POST', body: JSON.stringify(payload) });
    toast(message);
    await refresh();
    return data;
  }

  function showCreateBusModal() {
    const form = el('div');
    const name = document.createElement('input');
    name.placeholder = 'application-events';
    const description = document.createElement('input');
    form.append(el('label', null, 'Name'), name, el('label', null, 'Description'), description);
    openModal('Create event bus', form, 'Create bus', async (close) => {
      await mutate('/api/eventbridge/buses/create/', { name: name.value, description: description.value }, `Event bus ${name.value} created`);
      state.selectedBusName = name.value.trim(); close(); render();
    });
  }

  function showRuleModal(bus, rule = null) {
    const form = el('div');
    const name = document.createElement('input'); name.value = rule?.name || ''; name.placeholder = 'order-created';
    const description = document.createElement('input'); description.value = rule?.description || '';
    const pattern = document.createElement('textarea'); pattern.value = rule?.event_pattern || '{\n  "source": ["com.example.orders"]\n}';
    const schedule = document.createElement('input'); schedule.value = rule?.schedule_expression || ''; schedule.placeholder = 'rate(5 minutes)';
    form.append(el('label', null, 'Rule name'), name, el('label', null, 'Description'), description, el('label', null, 'Event pattern JSON'), pattern, el('label', null, 'Schedule expression (alternative)'), schedule);
    openModal(rule ? 'Update rule' : 'Create rule', form, rule ? 'Save rule' : 'Create rule', async (close) => {
      let eventPattern = null;
      if (pattern.value.trim()) eventPattern = JSON.parse(pattern.value);
      await mutate('/api/eventbridge/rules/put/', { name: name.value, event_bus_name: busName(bus), description: description.value, event_pattern: eventPattern, schedule_expression: schedule.value, state: rule?.state || 'ENABLED' }, `Rule ${name.value} saved`);
      close();
    });
  }

  function showTargetModal(bus, rule) {
    const form = el('div');
    const id = document.createElement('input'); id.placeholder = 'orders-queue';
    const arn = document.createElement('input'); arn.placeholder = 'arn:aws:sqs:us-east-1:000000000000:orders';
    const role = document.createElement('input'); role.placeholder = 'Optional execution role ARN';
    const input = document.createElement('textarea'); input.placeholder = 'Optional constant JSON input';
    form.append(el('label', null, 'Target ID'), id, el('label', null, 'Target ARN'), arn, el('label', null, 'Role ARN'), role, el('label', null, 'Constant input JSON'), input);
    openModal('Add or update target', form, 'Save target', async (close) => {
      await mutate('/api/eventbridge/targets/put/', { rule_name: rule.name, event_bus_name: busName(bus), target_id: id.value, arn: arn.value, role_arn: role.value, input: input.value.trim() ? JSON.parse(input.value) : null }, `Target ${id.value} saved`);
      close();
    });
  }

  function buses() {
    return state.inventory?.event_buses || [];
  }

  function busName(bus) {
    return bus?.name || bus?.arn || 'default';
  }

  function selectedBus() {
    return buses().find((bus) => busName(bus) === state.selectedBusName) || buses()[0] || null;
  }

  function busRules(bus) {
    return bus?.rules || [];
  }

  function busTargetCount(bus) {
    return busRules(bus).reduce((total, rule) => total + (rule.target_count || 0), 0);
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'Amazon EventBridge');
    home.addEventListener('click', () => {
      state.selectedBusName = 'default';
      render();
    });
    breadcrumbsEl.append(home);
    const bus = selectedBus();
    if (bus) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, busName(bus)));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'eventbridge',
      targets: {
        event_buses: 'Event buses',
        rules: 'Event buses',
        targets: 'Event buses',
        enabled_rules: 'Event buses',
      },
    });
  }

  function parseDetail(value) {
    const trimmed = value.trim();
    if (!trimmed) {
      return {};
    }
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Event detail must be a JSON object or array');
    }
    return parsed;
  }

  function eventTitle(payload) {
    return `${payload.source || 'event'} / ${payload.detail_type || 'Detail'}`;
  }

  async function putEvent(payload) {
    const data = await apiJson('/api/eventbridge/events/put/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.lastPut = data;
    consoleUi.recordActivity({
      service: 'eventbridge',
      action: 'put_event',
      title: eventTitle(payload),
      summary: payload.event_bus_name || 'default',
      detail: data.event_id ? `Event ${data.event_id}` : `${data.failed_entry_count || 0} failed`,
      replayLabel: 'Replay',
      payload,
    });
    return data;
  }

  function replayPutEvent(item) {
    const payload = item.payload || {};
    state.selectedBusName = payload.event_bus_name || 'default';
    render();
    showPutEventModal(selectedBus(), payload);
  }

  function showPutEventModal(bus, replay = null) {
    const form = el('div');
    const sourceInput = document.createElement('input');
    sourceInput.required = true;
    sourceInput.placeholder = 'com.example.orders';
    sourceInput.value = replay?.source || '';
    const detailTypeInput = document.createElement('input');
    detailTypeInput.required = true;
    detailTypeInput.placeholder = 'OrderCreated';
    detailTypeInput.value = replay?.detail_type || '';
    const detailInput = document.createElement('textarea');
    detailInput.className = 'eventbridge-detail-input';
    detailInput.value = JSON.stringify(replay?.detail || { order_id: 'local-123', status: 'created' }, null, 2);

    form.append(
      el('label', null, 'Event bus'),
      el('pre', 'eventbridge-bus-preview', busName(bus)),
      el('label', null, 'Source'),
      sourceInput,
      el('label', null, 'Detail type'),
      detailTypeInput,
      el('label', null, 'Event detail JSON'),
      detailInput,
    );

    openModal('Put event', form, 'Send event', async (close) => {
      const payload = {
        event_bus_name: busName(bus),
        source: sourceInput.value.trim(),
        detail_type: detailTypeInput.value.trim(),
        detail: parseDetail(detailInput.value),
      };
      const data = await putEvent(payload);
      close();
      if (data.failed_entry_count) {
        toast(data.error_message || 'Event was not accepted', true);
      } else {
        toast(data.event_id ? `Event sent: ${data.event_id}` : 'Event sent');
      }
      await refresh();
    });
  }

  function renderBusRow(bus) {
    const name = busName(bus);
    const active = name === busName(selectedBus());
    const row = el('button', `eventbridge-bus-row${active ? ' eventbridge-bus-row-active' : ''}`);
    const meta = [
      `${bus.rule_count || 0} rule${bus.rule_count === 1 ? '' : 's'}`,
      `${busTargetCount(bus)} target${busTargetCount(bus) === 1 ? '' : 's'}`,
    ];
    row.append(
      el('span', 'eventbridge-bus-name', name),
      el('span', 'eventbridge-bus-meta', meta.join(' / ')),
    );
    row.addEventListener('click', () => {
      state.selectedBusName = name;
      render();
    });
    return row;
  }

  function renderBusList() {
    const panel = el('section', 'eventbridge-panel');
    panel.append(el('div', 'eventbridge-panel-heading', 'Event buses'));
    const list = el('div', 'eventbridge-bus-list');
    if (!buses().length) {
      list.append(el('div', 'eventbridge-empty', 'No event buses found.'));
    } else {
      buses().forEach((bus) => list.append(renderBusRow(bus)));
    }
    panel.append(list);
    return panel;
  }

  function renderTarget(bus, rule, target) {
    const card = el('article', 'eventbridge-target');
    card.append(el('h4', null, target.Id || target.id || 'Target'));
    const details = document.createElement('dl');
    consoleUi.addField(details, 'ARN', target.Arn || target.arn);
    consoleUi.addField(details, 'Role ARN', target.RoleArn || target.role_arn);
    consoleUi.addField(details, 'Input', target.Input || target.input);
    consoleUi.addField(details, 'Input path', target.InputPath || target.input_path);
    const remove = btn('Remove target', 'eventbridge-btn-danger', () => {
      const targetId = target.Id || target.id;
      if (!window.confirm(`Remove target ${targetId} from ${rule.name}?`)) return;
      mutate('/api/eventbridge/targets/remove/', { rule_name: rule.name, event_bus_name: busName(bus), target_id: targetId }, `Target ${targetId} removed`).catch((error) => toast(error.message, true));
    });
    card.append(details, remove);
    return card;
  }

  function renderRule(bus, rule) {
    const card = el('article', `eventbridge-rule${requestedRuleName === rule.name ? ' eventbridge-rule-requested' : ''}`);
    card.id = `eventbridge-rule-${rule.name}`;
    const heading = el('div', 'eventbridge-rule-heading');
    heading.append(el('h4', null, rule.name || 'Rule'));
    heading.append(el('span', `eventbridge-rule-state eventbridge-rule-state-${String(rule.state || '').toLowerCase()}`, rule.state || 'UNKNOWN'));
    card.append(heading);

    const details = document.createElement('dl');
    consoleUi.addField(details, 'ARN', rule.arn);
    consoleUi.addField(details, 'Description', rule.description);
    consoleUi.addField(details, 'Schedule', rule.schedule_expression);
    consoleUi.addField(details, 'Event pattern', rule.event_pattern);
    consoleUi.addField(details, 'Targets', rule.target_count || 0);
    const actions = el('div', 'eventbridge-rule-actions');
    actions.append(
      btn('Edit rule', 'eventbridge-btn-secondary', () => showRuleModal(bus, rule)),
      btn(rule.state === 'ENABLED' ? 'Disable' : 'Enable', 'eventbridge-btn-secondary', () => mutate('/api/eventbridge/rules/state/', { name: rule.name, event_bus_name: busName(bus), enabled: rule.state !== 'ENABLED' }, `Rule ${rule.name} ${rule.state === 'ENABLED' ? 'disabled' : 'enabled'}`).catch((error) => toast(error.message, true))),
      btn('Add target', 'eventbridge-btn-secondary', () => showTargetModal(bus, rule)),
      btn('Delete rule', 'eventbridge-btn-danger', () => {
        if (!window.confirm(`Delete rule ${rule.name}? Remove its targets first.`)) return;
        mutate('/api/eventbridge/rules/delete/', { name: rule.name, event_bus_name: busName(bus) }, `Rule ${rule.name} deleted`).catch((error) => toast(error.message, true));
      }),
    );
    card.append(details, actions);

    const targets = rule.targets || [];
    if (targets.length) {
      const list = el('div', 'eventbridge-target-list');
      targets.forEach((target) => list.append(renderTarget(bus, rule, target)));
      card.append(list);
    }
    return card;
  }

  function renderSelectedBus(bus) {
    const panel = el('section', 'eventbridge-panel');
    const heading = el('div', 'eventbridge-panel-heading');
    heading.append(
      el('span', null, bus ? busName(bus) : 'Send event'),
      el('span', 'eventbridge-bus-meta', bus ? `${busRules(bus).length} rule${busRules(bus).length === 1 ? '' : 's'}` : 'No bus selected'),
    );
    panel.append(heading);

    const content = el('div', 'eventbridge-bus-detail');
    if (!bus) {
      content.append(el('div', 'eventbridge-empty', 'Select an event bus to send test events.'));
    } else {
      const details = document.createElement('dl');
      consoleUi.addField(details, 'ARN', bus.arn);
      consoleUi.addField(details, 'Description', bus.description);
      consoleUi.addField(details, 'Policy', bus.policy);
      content.append(details);

      const rules = busRules(bus);
      content.append(el('h3', null, 'Rules and targets'));
      if (!rules.length) {
        content.append(el('div', 'eventbridge-empty eventbridge-empty-compact', 'No rules on this bus. PutEvents can still accept events, but no target will run.'));
      } else {
        const list = el('div', 'eventbridge-rule-list');
        rules.forEach((rule) => list.append(renderRule(bus, rule)));
        content.append(list);
      }

      if (state.lastPut?.event_bus_name === busName(bus)) {
        const result = el('div', 'eventbridge-put-result');
        result.append(el('h3', null, 'Last event'));
        const resultDetails = document.createElement('dl');
        consoleUi.addField(resultDetails, 'Event ID', state.lastPut.event_id);
        consoleUi.addField(resultDetails, 'Failed entries', state.lastPut.failed_entry_count);
        consoleUi.addField(resultDetails, 'Error code', state.lastPut.error_code);
        consoleUi.addField(resultDetails, 'Error message', state.lastPut.error_message);
        consoleUi.addField(resultDetails, 'Entries', state.lastPut.entries || []);
        result.append(resultDetails);
        content.append(result);
      }

      content.append(consoleUi.renderActivityPanel({
        service: 'eventbridge',
        classPrefix: 'eventbridge',
        title: 'Recent events',
        actions: ['put_event'],
        emptyText: 'Send an event to build a local replay history.',
        onReplay: replayPutEvent,
        onClear: render,
      }));
    }
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const bus = selectedBus();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create event bus', null, showCreateBusModal),
        btn('Send event', null, () => bus && showPutEventModal(bus)),
        btn('Create rule', 'eventbridge-btn-secondary', () => bus && showRuleModal(bus)),
        btn('Refresh', 'eventbridge-btn-secondary', refresh),
      ],
      [bus && busName(bus) !== 'default' ? btn('Delete bus', 'eventbridge-btn-danger', () => {
        if (!window.confirm(`Delete event bus ${busName(bus)}? Delete its rules first.`)) return;
        mutate('/api/eventbridge/buses/delete/', { name: busName(bus) }, `Event bus ${busName(bus)} deleted`).catch((error) => toast(error.message, true));
      }) : null].filter(Boolean),
    ));

    const sendButton = container.querySelector('button');
    if (sendButton) {
      sendButton.disabled = !bus;
    }

    const workbench = el('div', 'eventbridge-workbench');
    workbench.append(renderBusList(), renderSelectedBus(bus));
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
    const data = await apiJson('/api/eventbridge/');
    state.inventory = data;
    if (!buses().some((bus) => busName(bus) === state.selectedBusName) && buses().length) {
      state.selectedBusName = busName(buses()[0]);
    }
    renderSummary(data.summary || {});
    render();
    if (requestedRuleName) {
      document.getElementById(`eventbridge-rule-${requestedRuleName}`)?.scrollIntoView({ block: 'center' });
    }
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'eventbridge-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.EventBridgeConsole = EventBridgeConsole;

if (document.getElementById('eventbridge-console-root')) {
  EventBridgeConsole.init();
}
