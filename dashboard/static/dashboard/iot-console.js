/* global ServiceConsole */

const IoTConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('iot-console-root');
  const breadcrumbsEl = document.getElementById('iot-breadcrumbs');
  const summaryEl = document.getElementById('iot-summary');
  const loadedAtEl = document.getElementById('iot-loaded-at');
  const params = new URLSearchParams(window.location.search);

  const validViews = new Set(['mqtt', 'things', 'rules']);
  const state = {
    inventory: null,
    activeView: validViews.has(params.get('view')) ? params.get('view') : 'mqtt',
    selectedThingName: params.get('thing') || '',
    activeShadow: null,
    publishedMessages: [],
    subscribedTopic: '#',
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'iot', type: isError ? 'error' : 'success',
  });
  const toolbar = (left, right) => consoleUi.toolbar(left, right, 'iot');
  const openModal = (title, body, label, submit) => consoleUi.openModal(title, body, label, submit, { classPrefix: 'iot', toast });

  function things() { return state.inventory?.things || []; }
  function rules() { return state.inventory?.topic_rules || []; }
  function selectedThing() { return things().find((t) => (t.thingName || t.name) === state.selectedThingName) || things()[0] || null; }
  function thingName(t) { return t?.thingName || t?.name || ''; }

  function urlFor(view, thing = '') {
    const query = new URLSearchParams();
    query.set('view', view);
    if (thing) query.set('thing', thing);
    return `${window.location.pathname}?${query}`;
  }

  function syncUrl() {
    window.history.replaceState({}, '', urlFor(state.activeView, state.selectedThingName));
  }

  function choose(view, thing = '') {
    state.activeView = view;
    if (thing) state.selectedThingName = thing;
    syncUrl();
    render();
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'iot',
      targets: {
        things: 'Things',
        certificates: 'Certificates',
        policies: 'Policies',
        topic_rules: 'Rules',
        billing_groups: 'Billing groups',
        thing_types: 'Thing types',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) return;
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('AWS IoT Core', null, () => choose('mqtt')));
    const labels = { mqtt: 'MQTT test client', things: 'Things & Shadows', rules: 'Message routing rules' };
    breadcrumbsEl.append(el('span', null, '/'), el('span', null, labels[state.activeView] || state.activeView));
    if (state.activeView === 'things' && state.selectedThingName) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, state.selectedThingName));
    }
  }

  function parseJson(value, fallback = null, label = 'JSON') {
    const clean = String(value || '').trim();
    if (!clean) return fallback;
    try { return JSON.parse(clean); } catch (e) { throw new Error(`${label} must be valid JSON: ${e.message}`); }
  }

  async function mutate(url, method, payload, message) {
    const data = await apiJson(url, { method, body: payload ? JSON.stringify(payload) : undefined });
    toast(message);
    await refresh();
    return data;
  }

  function showCreateThingModal() {
    const form = el('div', 'iot-modal-form');
    const name = document.createElement('input'); name.placeholder = 'temperature-sensor-01';
    const type = document.createElement('input'); type.placeholder = 'SensorDevice';
    const attrs = document.createElement('textarea'); attrs.placeholder = '{\n  "location": "Warehouse B",\n  "firmware": "v2.1.0"\n}';
    form.append(el('label', null, 'Thing name'), name, el('label', null, 'Thing type name (optional)'), type, el('label', null, 'Attributes JSON (optional)'), attrs);

    openModal('Create IoT Thing', form, 'Create thing', async (close) => {
      const cleanName = name.value.trim();
      await mutate('/api/iot/things/', 'POST', {
        thing_name: cleanName,
        thing_type_name: type.value.trim() || undefined,
        attributes: parseJson(attrs.value, {}, 'Attributes'),
      }, `Thing ${cleanName} created`);
      state.selectedThingName = cleanName;
      close();
      choose('things', cleanName);
    });
  }

  function showCreateRuleModal() {
    const form = el('div', 'iot-modal-form');
    const name = document.createElement('input'); name.placeholder = 'process-telemetry-rule';
    const sql = document.createElement('textarea'); sql.value = "SELECT * FROM 'sensors/+/telemetry' WHERE temperature > 50";
    const desc = document.createElement('input'); desc.placeholder = 'High temperature alert rule';

    form.append(el('label', null, 'Rule name'), name, el('label', null, 'SQL Statement'), sql, el('label', null, 'Description'), desc);

    openModal('Create Topic Rule', form, 'Create rule', async (close) => {
      const cleanName = name.value.trim();
      await mutate('/api/iot/topic-rules/', 'POST', {
        rule_name: cleanName,
        sql: sql.value.trim(),
        description: desc.value.trim() || undefined,
      }, `Topic rule ${cleanName} created`);
      close();
      choose('rules');
    });
  }

  async function loadShadow(tName) {
    if (!tName) return;
    try {
      const res = await apiJson(`/api/iot/things/${encodeURIComponent(tName)}/shadow/`);
      state.activeShadow = res.payload || { state: { desired: {}, reported: {} } };
    } catch (e) {
      state.activeShadow = { state: { desired: {}, reported: {} } };
    }
  }

  function renderMqttView() {
    const container = el('div', 'iot-mqtt-workbench');

    // Left column: Publish client
    const pubCol = el('div', 'iot-panel');
    pubCol.append(el('div', 'iot-panel-heading', 'Publish to a topic'));
    const pubBody = el('div', 'iot-panel-body');

    const presets = {
      telemetry: {
        name: 'Device Telemetry',
        topic: 'sensors/sensor-101/telemetry',
        qos: 0,
        payload: { deviceId: 'sensor-101', temperature: 24.8, humidity: 62, battery: 94, timestamp: Date.now() },
      },
      alert: {
        name: 'Critical Status Alert',
        topic: 'alerts/temperature-high',
        qos: 1,
        payload: { alertType: 'OVERHEAT', deviceId: 'sensor-101', reading: 78.5, threshold: 50.0, severity: 'CRITICAL' },
      },
      shadow_update: {
        name: 'Thing Shadow Desired State',
        topic: '$aws/things/sensor-101/shadow/update',
        qos: 0,
        payload: { state: { desired: { power: 'ON', reportingIntervalSec: 10 } } },
      },
    };

    const presetSelect = document.createElement('select');
    Object.entries(presets).forEach(([k, v]) => {
      const opt = el('option', null, v.name);
      opt.value = k;
      presetSelect.append(opt);
    });

    const topicInput = document.createElement('input');
    topicInput.value = presets.telemetry.topic;
    topicInput.placeholder = 'Topic (e.g. devices/sensor-01/telemetry)';

    const qosSelect = document.createElement('select');
    [0, 1].forEach((q) => {
      const opt = el('option', null, `QoS ${q}`);
      opt.value = q;
      qosSelect.append(opt);
    });

    const payloadArea = document.createElement('textarea');
    payloadArea.className = 'iot-code-editor';
    payloadArea.style.minHeight = '140px';
    payloadArea.value = JSON.stringify(presets.telemetry.payload, null, 2);

    presetSelect.addEventListener('change', () => {
      const selected = presets[presetSelect.value];
      if (selected) {
        topicInput.value = selected.topic;
        qosSelect.value = selected.qos;
        payloadArea.value = JSON.stringify(selected.payload, null, 2);
      }
    });

    const publishBtn = btn('Publish MQTT message', 'primary-button', async () => {
      try {
        const top = topicInput.value.trim();
        if (!top) throw new Error('Topic cannot be empty');
        const pl = parseJson(payloadArea.value, payloadArea.value, 'Payload');
        const res = await apiJson('/api/iot/mqtt/publish/', {
          method: 'POST',
          body: JSON.stringify({
            topic: top,
            qos: Number(qosSelect.value),
            payload: pl,
          }),
        });

        const msgEntry = {
          topic: top,
          qos: Number(qosSelect.value),
          payload: pl,
          time: new Date().toLocaleTimeString(),
          bytes: res.payload_size_bytes,
        };
        state.publishedMessages.unshift(msgEntry);
        toast(`Message published to ${top} (${res.payload_size_bytes} bytes)`);
        render();
      } catch (err) {
        toast(err.message, true);
      }
    });

    pubBody.append(
      el('label', null, 'Quick Presets'),
      presetSelect,
      el('label', null, 'Topic'),
      topicInput,
      el('label', null, 'Quality of Service'),
      qosSelect,
      el('label', null, 'Message Payload (JSON/text)'),
      payloadArea,
      publishBtn,
    );
    pubCol.append(pubBody);

    // Right column: Activity feed
    const feedCol = el('div', 'iot-panel');
    const feedHeading = el('div', 'iot-panel-heading');
    feedHeading.append(
      el('span', null, 'MQTT Message Feed & Timeline'),
      el('span', 'iot-chip', `${state.publishedMessages.length} published`),
    );
    feedCol.append(feedHeading);

    const feedBody = el('div', 'iot-panel-body');
    const filterRow = el('div', 'iot-filter-row');
    const topicSubInput = document.createElement('input');
    topicSubInput.value = state.subscribedTopic;
    topicSubInput.placeholder = 'Topic filter (e.g. sensors/#)';
    const clearBtn = btn('Clear feed', 'secondary-button', () => {
      state.publishedMessages = [];
      render();
    });
    filterRow.append(el('label', null, 'Filter:'), topicSubInput, clearBtn);
    feedBody.append(filterRow);

    const msgList = el('div', 'iot-message-list');
    if (!state.publishedMessages.length) {
      msgList.append(el('p', 'iot-empty', 'No MQTT messages published yet. Publish a message to view the timeline feed.'));
    } else {
      state.publishedMessages.forEach((msg) => {
        const item = el('article', 'iot-message-item');
        const itemHead = el('div', 'iot-message-header');
        itemHead.append(
          el('strong', 'iot-topic-badge', msg.topic),
          el('span', 'iot-chip', `QoS ${msg.qos}`),
          el('span', 'iot-meta', msg.time),
        );
        item.append(itemHead);
        item.append(el('pre', 'iot-code-preview', typeof msg.payload === 'object' ? JSON.stringify(msg.payload, null, 2) : String(msg.payload)));
        msgList.append(item);
      });
    }
    feedBody.append(msgList);
    feedCol.append(feedBody);

    container.append(pubCol, feedCol);
    return container;
  }

  function renderThingsView() {
    const tList = things();
    const t = selectedThing();
    const container = el('div', 'iot-things-workbench');

    // Left column: Things list
    const leftCol = el('div', 'iot-panel');
    const leftHead = el('div', 'iot-panel-heading');
    leftHead.append(el('span', null, 'Things'), btn('+ Create Thing', 'secondary-button', showCreateThingModal));
    leftCol.append(leftHead);

    const list = el('div', 'iot-list');
    if (!tList.length) {
      list.append(el('p', 'iot-empty', 'No IoT things found. Click + Create Thing to get started.'));
    } else {
      tList.forEach((item) => {
        const name = thingName(item);
        const row = el('button', `iot-row${name === thingName(t) ? ' iot-row-active' : ''}`);
        row.append(
          el('span', 'iot-name', name),
          el('span', 'iot-meta', item.thingTypeName || 'Device'),
        );
        row.addEventListener('click', () => {
          state.selectedThingName = name;
          loadShadow(name).then(() => render());
        });
        list.append(row);
      });
    }
    leftCol.append(list);

    // Right column: Thing detail & shadow
    const rightCol = el('div', 'iot-panel');
    rightCol.append(el('div', 'iot-panel-heading', t ? thingName(t) : 'Thing Detail'));
    const content = el('div', 'iot-panel-body');

    if (!t) {
      content.append(el('p', 'iot-empty', 'Select or create a thing to inspect device attributes and manage device shadow state.'));
    } else {
      const summary = document.createElement('dl');
      consoleUi.addField(summary, 'Thing Name', thingName(t));
      consoleUi.addField(summary, 'Thing ARN', t.thingArn || t.arn);
      consoleUi.addField(summary, 'Thing Type', t.thingTypeName || 'None');
      if (t.attributes) {
        consoleUi.addField(summary, 'Attributes', JSON.stringify(t.attributes));
      }
      content.append(summary);

      // Shadow Editor Section
      const shadowSection = el('div', 'iot-shadow-section');
      shadowSection.append(el('h4', null, 'Classic Device Shadow (JSON State)'));

      const shadowArea = document.createElement('textarea');
      shadowArea.className = 'iot-code-editor';
      shadowArea.style.minHeight = '180px';
      shadowArea.value = JSON.stringify(state.activeShadow || { state: { desired: { power: 'ON' }, reported: { power: 'OFF' } } }, null, 2);

      const shadowActionRow = el('div', 'iot-action-row');
      shadowActionRow.append(
        btn('Update Shadow', 'primary-button', async () => {
          try {
            const payload = parseJson(shadowArea.value, {}, 'Shadow state');
            const res = await apiJson(`/api/iot/things/${encodeURIComponent(thingName(t))}/shadow/`, {
              method: 'POST',
              body: JSON.stringify({ payload }),
            });
            state.activeShadow = res.payload;
            toast('Device shadow updated successfully');
            render();
          } catch (e) {
            toast('Failed to update shadow: ' + e.message, true);
          }
        }),
        btn('Get Latest Shadow', 'secondary-button', async () => {
          await loadShadow(thingName(t));
          toast('Shadow reloaded');
          render();
        }),
        btn('Delete Shadow', 'iot-btn-danger', async () => {
          if (window.confirm(`Delete device shadow for ${thingName(t)}?`)) {
            await mutate(`/api/iot/things/${encodeURIComponent(thingName(t))}/shadow/`, 'DELETE', {}, 'Device shadow deleted');
            state.activeShadow = null;
            render();
          }
        }),
        btn('Delete Thing', 'iot-btn-danger', async () => {
          if (window.confirm(`Delete thing ${thingName(t)}?`)) {
            await mutate(`/api/iot/things/${encodeURIComponent(thingName(t))}/`, 'DELETE', {}, `Thing ${thingName(t)} deleted`);
            state.selectedThingName = '';
            choose('things');
          }
        }),
      );

      shadowSection.append(shadowArea, shadowActionRow);
      content.append(shadowSection);
    }

    rightCol.append(content);
    container.append(leftCol, rightCol);
    return container;
  }

  function renderRulesView() {
    const rList = rules();
    const container = el('div', 'iot-panel');
    const header = el('div', 'iot-panel-heading');
    header.append(
      el('span', null, 'IoT Topic Rules (Message Routing)'),
      btn('+ Create Rule', 'primary-button', showCreateRuleModal),
    );
    container.append(header);

    const body = el('div', 'iot-panel-body');
    if (!rList.length) {
      body.append(el('p', 'iot-empty', 'No topic rules configured. Topic rules evaluate MQTT messages with SQL and forward to SQS, SNS, Lambda, and DynamoDB.'));
    } else {
      const grid = el('div', 'iot-card-grid');
      rList.forEach((r) => {
        const card = el('article', 'iot-rule-card');
        const h = el('div', 'iot-rule-heading');
        h.append(
          el('strong', null, r.ruleName || r.name),
          el('span', `iot-chip ${!r.ruleDisabled ? 'iot-chip-success' : ''}`, r.ruleDisabled ? 'DISABLED' : 'ENABLED'),
        );
        card.append(h);
        if (r.description) card.append(el('p', 'iot-desc', r.description));
        if (r.sql) card.append(el('pre', 'iot-sql-preview', r.sql));

        const actions = el('div', 'iot-action-row');
        actions.append(
          btn('Delete rule', 'iot-btn-danger', async () => {
            if (window.confirm(`Delete rule ${r.ruleName || r.name}?`)) {
              await mutate(`/api/iot/topic-rules/${encodeURIComponent(r.ruleName || r.name)}/`, 'DELETE', {}, `Rule ${r.ruleName || r.name} deleted`);
              choose('rules');
            }
          }),
        );
        card.append(actions);
        grid.append(card);
      });
      body.append(grid);
    }
    container.append(body);
    return container;
  }

  function renderView() {
    const container = el('div');
    const nav = el('nav', 'iot-view-nav');
    [
      ['mqtt', 'MQTT Test Client'],
      ['things', 'Things & Shadows'],
      ['rules', 'Topic Rules'],
    ].forEach(([view, label]) => {
      const active = state.activeView === view;
      const button = el('button', `iot-view-tab${active ? ' iot-view-tab-active' : ''}`, label);
      button.addEventListener('click', () => choose(view, state.selectedThingName));
      nav.append(button);
    });
    container.append(nav);

    if (state.activeView === 'mqtt') {
      container.append(renderMqttView());
    } else if (state.activeView === 'things') {
      container.append(renderThingsView());
    } else if (state.activeView === 'rules') {
      container.append(renderRulesView());
    }
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
    const data = await apiJson('/api/iot/');
    state.inventory = data;
    if (!state.selectedThingName && things().length) {
      state.selectedThingName = thingName(things()[0]);
      await loadShadow(state.selectedThingName);
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) return;
    root.append(el('p', 'iot-empty', 'Loading IoT Core workbench...'));
    refresh().catch((err) => toast(err.message, true));
  }

  return { init, refresh };
})();

window.IoTConsole = IoTConsole;

if (document.getElementById('iot-console-root')) {
  IoTConsole.init();
}
