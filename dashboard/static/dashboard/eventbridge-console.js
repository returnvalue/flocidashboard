/* global ServiceConsole */

const EventBridgeConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('eventbridge-console-root');
  const breadcrumbsEl = document.getElementById('eventbridge-breadcrumbs');
  const summaryEl = document.getElementById('eventbridge-summary');
  const loadedAtEl = document.getElementById('eventbridge-loaded-at');

  const state = {
    inventory: null,
    selectedBusName: 'default',
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

  function showPutEventModal(bus) {
    const form = el('div');
    const sourceInput = document.createElement('input');
    sourceInput.required = true;
    sourceInput.placeholder = 'com.example.orders';
    const detailTypeInput = document.createElement('input');
    detailTypeInput.required = true;
    detailTypeInput.placeholder = 'OrderCreated';
    const detailInput = document.createElement('textarea');
    detailInput.className = 'eventbridge-detail-input';
    detailInput.value = JSON.stringify({ order_id: 'local-123', status: 'created' }, null, 2);

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
      const data = await apiJson('/api/eventbridge/events/put/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      state.lastPut = data;
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

  function renderTarget(target) {
    const card = el('article', 'eventbridge-target');
    card.append(el('h4', null, target.Id || target.id || 'Target'));
    const details = document.createElement('dl');
    consoleUi.addField(details, 'ARN', target.Arn || target.arn);
    consoleUi.addField(details, 'Role ARN', target.RoleArn || target.role_arn);
    consoleUi.addField(details, 'Input', target.Input || target.input);
    consoleUi.addField(details, 'Input path', target.InputPath || target.input_path);
    card.append(details);
    return card;
  }

  function renderRule(rule) {
    const card = el('article', 'eventbridge-rule');
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
    card.append(details);

    const targets = rule.targets || [];
    if (targets.length) {
      const list = el('div', 'eventbridge-target-list');
      targets.forEach((target) => list.append(renderTarget(target)));
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
        rules.forEach((rule) => list.append(renderRule(rule)));
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
    }
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const bus = selectedBus();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Send event', null, () => bus && showPutEventModal(bus)),
      ],
      [],
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
    if (!selectedBus() && buses().length) {
      state.selectedBusName = busName(buses()[0]);
    }
    renderSummary(data.summary || {});
    render();
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
