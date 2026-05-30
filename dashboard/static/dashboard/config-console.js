/* global ServiceConsole */

const ConfigConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('config-console-root');
  const breadcrumbsEl = document.getElementById('config-breadcrumbs');
  const summaryEl = document.getElementById('config-summary');
  const loadedAtEl = document.getElementById('config-loaded-at');

  const state = {
    inventory: null,
    selectedKind: 'rule',
    selectedName: '',
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'config',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'config');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'config',
      toast,
    });

  function rules() {
    return state.inventory?.config_rules || [];
  }

  function recorders() {
    return state.inventory?.configuration_recorders || [];
  }

  function channels() {
    return state.inventory?.delivery_channels || [];
  }

  function packs() {
    return state.inventory?.conformance_packs || [];
  }

  function ruleName(rule) {
    return rule?.ConfigRuleName || rule?.name || '';
  }

  function recorderName(recorder) {
    return recorder?.name || recorder?.Name || '';
  }

  function channelName(channel) {
    return channel?.name || channel?.Name || '';
  }

  function packName(pack) {
    return pack?.ConformancePackName || pack?.name || '';
  }

  function selectedItems() {
    if (state.selectedKind === 'recorder') {
      return recorders();
    }
    if (state.selectedKind === 'channel') {
      return channels();
    }
    if (state.selectedKind === 'pack') {
      return packs();
    }
    return rules();
  }

  function itemName(item) {
    if (state.selectedKind === 'recorder') {
      return recorderName(item);
    }
    if (state.selectedKind === 'channel') {
      return channelName(item);
    }
    if (state.selectedKind === 'pack') {
      return packName(item);
    }
    return ruleName(item);
  }

  function selectedItem() {
    return selectedItems().find((item) => itemName(item) === state.selectedName) || selectedItems()[0] || null;
  }

  function parseJsonObject(value, fallback = null) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return fallback;
    }
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Value must be a JSON object');
    }
    return parsed;
  }

  function parseJsonArray(value, fallback = []) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return fallback;
    }
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error('Value must be a JSON array');
    }
    return parsed;
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'AWS Config');
    home.addEventListener('click', () => {
      state.selectedKind = 'rule';
      state.selectedName = rules()[0] ? ruleName(rules()[0]) : '';
      render();
    });
    breadcrumbsEl.append(home, el('span', null, '/'), el('span', null, state.selectedKind));
    const item = selectedItem();
    if (item) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, itemName(item)));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'config',
      targets: {
        configuration_recorders: 'Configuration recorders',
        delivery_channels: 'Delivery channels',
        config_rules: 'Config rules',
        conformance_packs: 'Conformance packs',
      },
    });
  }

  function defaultRuleJson() {
    return JSON.stringify({
      ConfigRuleName: 's3-bucket-versioning',
      Source: {
        Owner: 'AWS',
        SourceIdentifier: 'S3_BUCKET_VERSIONING_ENABLED',
      },
    }, null, 2);
  }

  function defaultRecorderJson() {
    return JSON.stringify({
      name: 'default',
      roleARN: 'arn:aws:iam::000000000000:role/config-role',
      recordingGroup: {
        allSupported: true,
        includeGlobalResourceTypes: true,
      },
    }, null, 2);
  }

  function defaultChannelJson() {
    return JSON.stringify({
      name: 'default',
      s3BucketName: 'config-bucket',
      configSnapshotDeliveryProperties: {
        deliveryFrequency: 'TwentyFour_Hours',
      },
    }, null, 2);
  }

  function showJsonModal(title, textareaValue, confirmLabel, onConfirm) {
    const form = el('div', 'config-modal-form');
    const input = document.createElement('textarea');
    input.value = textareaValue;
    form.append(el('label', null, title), input);
    openModal(title, form, confirmLabel, async (close) => {
      await onConfirm(parseJsonObject(input.value));
      close();
      await refresh();
    });
  }

  function showRuleModal(rule = null) {
    showJsonModal('Config rule JSON', rule ? JSON.stringify(rule, null, 2) : defaultRuleJson(), 'Save rule', async (configRule) => {
      await apiJson('/api/config/rules/', {
        method: 'POST',
        body: JSON.stringify({ config_rule: configRule }),
      });
      state.selectedKind = 'rule';
      state.selectedName = configRule.ConfigRuleName || '';
      toast('Config rule saved');
    });
  }

  function showRecorderModal(recorder = null) {
    showJsonModal('Configuration recorder JSON', recorder ? JSON.stringify(recorder, null, 2) : defaultRecorderJson(), 'Save recorder', async (configurationRecorder) => {
      await apiJson('/api/config/recorders/', {
        method: 'POST',
        body: JSON.stringify({ configuration_recorder: configurationRecorder }),
      });
      state.selectedKind = 'recorder';
      state.selectedName = configurationRecorder.name || configurationRecorder.Name || '';
      toast('Recorder saved');
    });
  }

  function showChannelModal(channel = null) {
    showJsonModal('Delivery channel JSON', channel ? JSON.stringify(channel, null, 2) : defaultChannelJson(), 'Save channel', async (deliveryChannel) => {
      await apiJson('/api/config/delivery-channels/', {
        method: 'POST',
        body: JSON.stringify({ delivery_channel: deliveryChannel }),
      });
      state.selectedKind = 'channel';
      state.selectedName = deliveryChannel.name || deliveryChannel.Name || '';
      toast('Delivery channel saved');
    });
  }

  function showPackModal(pack = null) {
    const form = el('div', 'config-modal-form config-modal-form-wide');
    const nameInput = document.createElement('input');
    nameInput.value = packName(pack);
    nameInput.placeholder = 'local-conformance-pack';
    const templateInput = document.createElement('textarea');
    templateInput.value = 'Resources: {}';
    const paramsInput = document.createElement('textarea');
    paramsInput.placeholder = '[]';
    form.append(
      el('label', null, 'Pack name'),
      nameInput,
      el('label', null, 'Template body'),
      templateInput,
      el('label', null, 'Input parameters JSON'),
      paramsInput,
    );
    openModal('Put conformance pack', form, 'Save pack', async (close) => {
      await apiJson('/api/config/conformance-packs/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          template_body: templateInput.value,
          input_parameters: parseJsonArray(paramsInput.value, []),
        }),
      });
      state.selectedKind = 'pack';
      state.selectedName = nameInput.value.trim();
      close();
      toast('Conformance pack saved');
      await refresh();
    });
  }

  async function deleteRule(rule) {
    if (!window.confirm('Delete this config rule?')) {
      return;
    }
    await apiJson(`/api/config/rules/${encodeURIComponent(ruleName(rule))}/`, { method: 'DELETE' });
    state.selectedName = '';
    toast('Config rule deleted');
    await refresh();
  }

  async function deletePack(pack) {
    if (!window.confirm('Delete this conformance pack?')) {
      return;
    }
    await apiJson(`/api/config/conformance-packs/${encodeURIComponent(packName(pack))}/`, { method: 'DELETE' });
    state.selectedName = '';
    toast('Conformance pack deleted');
    await refresh();
  }

  async function evaluateRule(rule) {
    await apiJson('/api/config/rules/evaluation/start/', {
      method: 'POST',
      body: JSON.stringify({ rule_names: [ruleName(rule)] }),
    });
    toast('Config rule evaluation started');
  }

  async function setRecorderRecording(recorder, recording) {
    const path = `/api/config/recorders/${encodeURIComponent(recorderName(recorder))}/${recording ? 'start' : 'stop'}/`;
    await apiJson(path, { method: 'POST' });
    toast(recording ? 'Recorder started' : 'Recorder stopped');
    await refresh();
  }

  function renderKindTabs() {
    const tabs = el('div', 'config-tabs');
    [
      ['rule', 'Rules'],
      ['recorder', 'Recorders'],
      ['channel', 'Channels'],
      ['pack', 'Packs'],
    ].forEach(([kind, label]) => {
      const tab = btn(label, `config-tab${state.selectedKind === kind ? ' config-tab-active' : ''}`, () => {
        state.selectedKind = kind;
        state.selectedName = '';
        render();
      });
      tabs.append(tab);
    });
    return tabs;
  }

  function renderItemRow(item) {
    const active = itemName(item) === itemName(selectedItem());
    const row = el('button', `config-item-row${active ? ' config-item-row-active' : ''}`);
    row.append(
      el('span', 'config-item-name', itemName(item) || 'Unnamed'),
      el('span', 'config-item-meta', state.selectedKind === 'rule' ? (item.ConfigRuleState || 'Rule') : state.selectedKind),
    );
    row.addEventListener('click', () => {
      state.selectedName = itemName(item);
      render();
    });
    return row;
  }

  function renderItemList() {
    const panel = el('section', 'config-panel');
    panel.append(el('div', 'config-panel-heading', 'Config resources'), renderKindTabs());
    const list = el('div', 'config-list');
    if (!selectedItems().length) {
      list.append(el('div', 'config-empty', 'None found.'));
    } else {
      selectedItems().forEach((item) => list.append(renderItemRow(item)));
    }
    panel.append(list);
    return panel;
  }

  function renderDetailActions(item) {
    const actions = el('div', 'config-action-row');
    if (state.selectedKind === 'rule') {
      actions.append(
        btn('Edit rule', null, () => showRuleModal(item)),
        btn('Evaluate', 'config-btn-secondary', () => evaluateRule(item).catch((error) => toast(error.message, true))),
        btn('Delete rule', 'config-btn-danger', () => deleteRule(item).catch((error) => toast(error.message, true))),
      );
    } else if (state.selectedKind === 'recorder') {
      actions.append(
        btn('Edit recorder', null, () => showRecorderModal(item)),
        btn('Start', 'config-btn-secondary', () => setRecorderRecording(item, true).catch((error) => toast(error.message, true))),
        btn('Stop', 'config-btn-secondary', () => setRecorderRecording(item, false).catch((error) => toast(error.message, true))),
      );
    } else if (state.selectedKind === 'channel') {
      actions.append(btn('Edit channel', null, () => showChannelModal(item)));
    } else if (state.selectedKind === 'pack') {
      actions.append(
        btn('Edit pack', null, () => showPackModal(item)),
        btn('Delete pack', 'config-btn-danger', () => deletePack(item).catch((error) => toast(error.message, true))),
      );
    }
    return actions;
  }

  function renderDetail() {
    const panel = el('section', 'config-panel');
    panel.append(el('div', 'config-panel-heading', 'Selected resource'));
    const body = el('div', 'config-detail');
    const item = selectedItem();
    if (!item) {
      body.append(el('p', 'config-empty-compact', 'Create a Config resource to test local compliance setup.'));
      panel.append(body);
      return panel;
    }
    const facts = el('dl', 'config-facts');
    consoleUi.addField(facts, 'Name', itemName(item));
    consoleUi.addField(facts, 'Details', item);
    body.append(facts, renderDetailActions(item));
    panel.append(body);
    return panel;
  }

  function renderWorkbench() {
    const workbench = el('div', 'config-workbench');
    workbench.append(renderItemList(), renderDetail());
    return workbench;
  }

  function render() {
    if (!root) {
      return;
    }
    root.textContent = '';
    renderBreadcrumbs();
    renderSummary(state.inventory?.summary || {});
    root.append(toolbar(
      [
        btn('Put rule', null, () => showRuleModal()),
        btn('Put recorder', null, () => showRecorderModal()),
        btn('Put channel', null, () => showChannelModal()),
        btn('Put pack', null, () => showPackModal()),
      ],
      [el('span', 'config-toolbar-note', 'Local compliance resources and recorder state')],
    ));
    root.append(renderWorkbench());
    if (loadedAtEl) {
      loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
    }
  }

  async function refresh() {
    if (!root) {
      return;
    }
    state.inventory = await apiJson('/api/config/');
    if (!state.selectedName && selectedItems()[0]) {
      state.selectedName = itemName(selectedItems()[0]);
    }
    render();
  }

  return { refresh };
})();

window.ConfigConsole = ConfigConsole;
