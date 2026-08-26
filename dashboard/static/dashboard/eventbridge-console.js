/* global ServiceConsole */

const EventBridgeConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('eventbridge-console-root');
  const breadcrumbsEl = document.getElementById('eventbridge-breadcrumbs');
  const summaryEl = document.getElementById('eventbridge-summary');
  const loadedAtEl = document.getElementById('eventbridge-loaded-at');
  const params = new URLSearchParams(window.location.search);
  const validViews = new Set(['buses', 'rules', 'targets', 'send', 'tester']);
  const state = {
    inventory: null,
    activeView: validViews.has(params.get('view')) ? params.get('view') : 'buses',
    selectedBusName: params.get('bus') || 'default',
    selectedRuleName: params.get('rule') || '',
    selectedTargetId: params.get('target') || '',
    filters: { buses: '', rules: '', targets: '' },
    filterFocus: {},
    lastPut: null,
    sampleEvents: null,
    lastPatternTest: null,
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
    const labels = { buses: 'Event buses', rules: 'Rules', targets: 'Targets', send: 'Send events', tester: 'Pattern tester' };
    breadcrumbsEl.append(el('span', null, '/'), el('span', null, labels[state.activeView] || state.activeView));
    if (state.selectedBusName && state.activeView !== 'buses' && state.activeView !== 'tester') breadcrumbsEl.append(el('span', null, '/'), el('span', null, state.selectedBusName));
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

  async function loadSampleEvents() {
    if (!state.sampleEvents) {
      try {
        state.sampleEvents = await apiJson('/api/eventbridge/sample-events/');
      } catch (e) {
        state.sampleEvents = {};
      }
    }
    return state.sampleEvents;
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
    const source = document.createElement('input'); source.value = replay?.source || 'custom.app'; source.placeholder = 'custom.app';
    const detailType = document.createElement('input'); detailType.value = replay?.detail_type || 'AppEvent'; detailType.placeholder = 'AppEvent';
    const detail = document.createElement('textarea'); detail.value = replay?.detail ? JSON.stringify(replay.detail, null, 2) : '{\n  "status": "SUCCESS",\n  "timestamp": ' + Date.now() + '\n}';
    form.append(el('label', null, 'Source'), source, el('label', null, 'Detail type'), detailType, el('label', null, 'Event detail JSON'), detail);
    openModal(`Send event to ${busName(bus)}`, form, 'Send event', async (close) => {
      const data = await apiJson('/api/eventbridge/events/put/', {
        method: 'POST',
        body: JSON.stringify({
          event_bus_name: busName(bus),
          source: source.value.trim(),
          detail_type: detailType.value.trim(),
          detail: parseJson(detail.value, {}, 'Detail'),
        }),
      });
      state.lastPut = { bus: busName(bus), source: source.value.trim(), detail_type: detailType.value.trim(), detail: parseJson(detail.value, {}), ...data };
      toast(data.failed_entry_count ? 'Event failed to send' : 'Event sent successfully', Boolean(data.failed_entry_count));
      close(); choose('send', busName(bus));
    });
  }

  function renderPatternTesterView() {
    const wrapper = el('div', 'eventbridge-tester-workbench');
    const header = el('div', 'eventbridge-panel-heading');
    header.append(
      el('h3', null, 'EventBridge Event Pattern Sandbox & Match Tester'),
      el('span', 'eventbridge-chip', 'Rule Pattern Validation'),
    );
    wrapper.append(header);

    const controls = el('div', 'eventbridge-tester-controls');
    const presetSelect = document.createElement('select');
    presetSelect.append(el('option', null, '-- Choose AWS Sample Event Preset --'));
    loadSampleEvents().then((samples) => {
      Object.entries(samples).forEach(([k, v]) => {
        const opt = el('option', null, v.name);
        opt.value = k;
        presetSelect.append(opt);
      });
    });

    controls.append(el('label', null, 'Sample Preset:'), presetSelect);
    wrapper.append(controls);

    const grid = el('div', 'eventbridge-tester-grid');

    const patternCol = el('div', 'eventbridge-tester-col');
    patternCol.append(el('h4', null, 'Event Pattern (JSON)'));
    const patternArea = document.createElement('textarea');
    patternArea.className = 'eventbridge-code-editor';
    patternArea.value = JSON.stringify({
      source: ['aws.ec2'],
      detail: {
        state: ['running', 'stopped'],
      },
    }, null, 2);
    patternCol.append(patternArea);

    const eventCol = el('div', 'eventbridge-tester-col');
    eventCol.append(el('h4', null, 'Sample Event (JSON)'));
    const eventArea = document.createElement('textarea');
    eventArea.className = 'eventbridge-code-editor';
    eventArea.value = JSON.stringify({
      version: '0',
      id: 'sample-event-id-123',
      'detail-type': 'EC2 Instance State-change Notification',
      source: 'aws.ec2',
      time: '2026-08-25T12:00:00Z',
      region: 'us-east-1',
      detail: {
        'instance-id': 'i-1234567890abcdef0',
        state: 'running',
      },
    }, null, 2);
    eventCol.append(eventArea);

    presetSelect.addEventListener('change', () => {
      const selected = state.sampleEvents?.[presetSelect.value];
      if (selected) {
        patternArea.value = JSON.stringify(selected.pattern, null, 2);
        eventArea.value = JSON.stringify(selected.event, null, 2);
      }
    });

    grid.append(patternCol, eventCol);
    wrapper.append(grid);

    const actionRow = el('div', 'eventbridge-tester-action-row');
    const resultBox = el('div', 'eventbridge-tester-result');

    const testBtn = btn('Test Event Pattern', 'primary-button', async () => {
      try {
        const patternObj = JSON.parse(patternArea.value);
        const eventObj = JSON.parse(eventArea.value);
        const res = await apiJson('/api/eventbridge/patterns/test/', {
          method: 'POST',
          body: JSON.stringify({
            event_pattern: patternObj,
            event: eventObj,
          }),
        });
        state.lastPatternTest = res;
        resultBox.textContent = '';
        if (res.result) {
          resultBox.className = 'eventbridge-tester-result eventbridge-tester-match';
          resultBox.append(el('strong', null, '✔ MATCH: '), el('span', null, 'The sample event matches the event pattern!'));
        } else {
          resultBox.className = 'eventbridge-tester-result eventbridge-tester-mismatch';
          resultBox.append(el('strong', null, '✖ NO MATCH: '), el('span', null, res.summary));
          if (res.mismatches?.length) {
            const ul = document.createElement('ul');
            res.mismatches.forEach((m) => ul.append(el('li', null, m)));
            resultBox.append(ul);
          }
        }
      } catch (err) {
        toast('Validation error: ' + err.message, true);
      }
    });

    actionRow.append(testBtn, resultBox);
    wrapper.append(actionRow);

    return wrapper;
  }

  function renderView() {
    const bus = selectedBus();
    const container = el('div');
    const nav = el('nav', 'eventbridge-view-nav');
    [
      ['buses', 'Event buses'],
      ['rules', 'Rules'],
      ['targets', 'Targets'],
      ['send', 'Send events'],
      ['tester', 'Pattern Tester'],
    ].forEach(([view, label]) => {
      const active = state.activeView === view;
      const button = el('button', `eventbridge-view-tab${active ? ' eventbridge-view-tab-active' : ''}`, label);
      button.addEventListener('click', () => choose(view, state.selectedBusName));
      nav.append(button);
    });
    container.append(nav);

    if (state.activeView === 'tester') {
      container.append(renderPatternTesterView());
      return container;
    }

    if (state.activeView === 'send') {
      const sendPanel = el('div', 'eventbridge-workbench');
      const sendCard = el('div', 'eventbridge-panel');
      sendCard.append(el('div', 'eventbridge-panel-heading', `Send Event to ${busName(bus)}`));
      const body = el('div', 'eventbridge-send-body');
      const source = document.createElement('input'); source.value = 'custom.analytics'; source.placeholder = 'Source (e.g. myapp.orders)';
      const detailType = document.createElement('input'); detailType.value = 'UserSignedUp'; detailType.placeholder = 'Detail type';
      const detail = document.createElement('textarea'); detail.style.minHeight = '140px'; detail.value = JSON.stringify({ userId: 'u-991', plan: 'enterprise', timestamp: Date.now() }, null, 2);

      const sendBtn = btn('Send Event', 'primary-button', async () => {
        try {
          const res = await apiJson('/api/eventbridge/events/put/', {
            method: 'POST',
            body: JSON.stringify({
              event_bus_name: busName(bus),
              source: source.value.trim(),
              detail_type: detailType.value.trim(),
              detail: JSON.parse(detail.value),
            }),
          });
          state.lastPut = { bus: busName(bus), ...res };
          toast('Event published with ID: ' + (res.event_id || 'ok'));
          render();
        } catch (e) {
          toast('Failed to send event: ' + e.message, true);
        }
      });

      body.append(
        el('label', null, 'Target Event Bus: ' + busName(bus)),
        el('label', null, 'Source'), source,
        el('label', null, 'Detail Type'), detailType,
        el('label', null, 'Detail JSON'), detail,
        sendBtn,
      );

      if (state.lastPut) {
        const resultCard = el('div', 'eventbridge-result-card');
        resultCard.append(el('h4', null, 'Last Published Event'));
        const dl = document.createElement('dl');
        consoleUi.addField(dl, 'Event Bus', state.lastPut.bus);
        consoleUi.addField(dl, 'Event ID', state.lastPut.event_id);
        consoleUi.addField(dl, 'Failed Entries', state.lastPut.failed_entry_count || 0);
        resultCard.append(dl);
        body.append(resultCard);
      }

      sendCard.append(body);
      sendPanel.append(sendCard);
      container.append(sendPanel);
      return container;
    }

    // Default buses/rules/targets workbench
    container.append(toolbar(
      [
        btn('Create event bus', null, showCreateBusModal),
        btn('Create rule', null, () => bus && showRuleModal(bus)),
        btn('Send custom event', null, () => bus && showPutEventModal(bus)),
      ],
      [],
    ));

    const wb = el('div', 'eventbridge-workbench');
    const busPanel = el('div', 'eventbridge-panel');
    busPanel.append(el('div', 'eventbridge-panel-heading', 'Event Buses'));
    const busList = el('div', 'eventbridge-list');
    buses().forEach((b) => {
      const row = el('button', `eventbridge-row${busName(b) === state.selectedBusName ? ' eventbridge-row-active' : ''}`);
      row.append(el('strong', null, busName(b)), el('span', 'eventbridge-chip', (b.rules || []).length + ' rules'));
      row.addEventListener('click', () => choose(state.activeView, busName(b)));
      busList.append(row);
    });
    busPanel.append(busList);

    const rulePanel = el('div', 'eventbridge-panel');
    rulePanel.append(el('div', 'eventbridge-panel-heading', `Rules in ${busName(bus)}`));
    const ruleList = el('div', 'eventbridge-list');
    const curRules = bus?.rules || [];
    if (!curRules.length) {
      ruleList.append(el('div', 'eventbridge-empty', 'No rules defined in this event bus.'));
    } else {
      curRules.forEach((r) => {
        const card = el('article', 'eventbridge-rule-card');
        const h = el('div', 'eventbridge-rule-heading');
        h.append(el('strong', null, r.name), el('span', `eventbridge-chip ${r.state === 'ENABLED' ? 'eventbridge-chip-success' : ''}`, r.state));
        card.append(h);
        if (r.description) card.append(el('p', 'eventbridge-desc', r.description));
        if (r.event_pattern) card.append(el('pre', 'eventbridge-pattern-preview', r.event_pattern));
        const actions = el('div', 'eventbridge-action-row');
        actions.append(
          btn('Add target', 'secondary-button', () => showTargetModal(bus, r)),
          btn(r.state === 'ENABLED' ? 'Disable' : 'Enable', 'secondary-button', async () => {
            await mutate('/api/eventbridge/rules/state/', { name: r.name, event_bus_name: busName(bus), enabled: r.state !== 'ENABLED' }, `Rule ${r.name} updated`);
          }),
          btn('Delete', 'eventbridge-btn-danger', async () => {
            if (window.confirm(`Delete rule ${r.name}?`)) {
              await mutate('/api/eventbridge/rules/delete/', { name: r.name, event_bus_name: busName(bus) }, `Rule ${r.name} deleted`);
            }
          }),
        );
        card.append(actions);
        ruleList.append(card);
      });
    }
    rulePanel.append(ruleList);

    wb.append(busPanel, rulePanel);
    container.append(wb);
    return container;
  }

  function render() {
    if (!root) return;
    renderBreadcrumbs();
    root.textContent = '';
    root.append(renderView());
    if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
  }

  async function refresh() {
    const data = await apiJson('/api/eventbridge/');
    state.inventory = data;
    if (!selectedBus() && buses().length) state.selectedBusName = busName(buses()[0]);
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) return;
    window.addEventListener('eventbridge-rule-requested', (event) => {
      if (event.detail?.bus) state.selectedBusName = event.detail.bus;
      if (event.detail?.rule) state.selectedRuleName = event.detail.rule;
      choose('rules', state.selectedBusName, state.selectedRuleName);
    });
    root.append(el('div', 'eventbridge-empty', 'Loading EventBridge workbench...'));
    refresh().catch((err) => toast(err.message, true));
  }

  return { init, refresh };
})();

window.EventBridgeConsole = EventBridgeConsole;

if (document.getElementById('eventbridge-console-root')) {
  EventBridgeConsole.init();
}
