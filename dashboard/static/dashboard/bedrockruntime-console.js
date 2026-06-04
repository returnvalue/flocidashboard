/* global ServiceConsole */

const BedrockRuntimeConsole = (() => {
  const ui = window.ServiceConsole;
  const root = document.getElementById('bedrockruntime-console-root');
  const summaryEl = document.getElementById('bedrockruntime-summary');
  const loadedAtEl = document.getElementById('bedrockruntime-loaded-at');
  const state = {
    inventory: null,
    selectedModelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    lastOperation: '',
    lastResult: null,
  };
  const el = ui.el;
  const apiJson = ui.apiJson;
  const btn = ui.button;
  const toast = (message, isError = false) => ui.toast(message, { classPrefix: 'bedrockruntime', type: isError ? 'error' : 'success' });
  const toolbar = (left, right) => ui.toolbar(left, right, 'bedrockruntime');
  const openModal = (title, body, label, confirm) => ui.openModal(title, body, label, confirm, { classPrefix: 'bedrockruntime', toast });

  function parseJson(value, fallback, label) {
    const text = String(value || '').trim();
    if (!text) return fallback;
    try { return JSON.parse(text); } catch (error) { throw new Error(`${label} must be valid JSON`); }
  }

  function modelIds() {
    const configured = state.inventory?.model_id_support?.map((model) => model.example).filter(Boolean) || [];
    return configured.length ? configured : [state.selectedModelId];
  }

  function renderSummary(summary) {
    ui.renderSummary(summary, summaryEl, {
      serviceKey: 'bedrockruntime',
      targets: {
        supported_operations: 'Supported operations',
        unsupported_streaming_operations: 'Unsupported streaming operations',
        management_plane_resources: 'Management-plane resources',
        real_inference: 'Real inference',
      },
    });
  }

  function showConverseModal() {
    const form = el('div', 'bedrockruntime-modal-form');
    const model = document.createElement('input'); model.value = state.selectedModelId;
    const messages = document.createElement('textarea'); messages.value = JSON.stringify([{ role: 'user', content: [{ text: 'hi' }] }], null, 2);
    const system = document.createElement('textarea'); system.placeholder = '[{"text":"You are a concise assistant."}]';
    const inference = document.createElement('textarea'); inference.value = JSON.stringify({ maxTokens: 100 }, null, 2);
    const tools = document.createElement('textarea'); tools.placeholder = '{"tools":[]}';
    form.append(el('label', null, 'Model ID'), model, el('label', null, 'Messages JSON'), messages, el('label', null, 'System JSON'), system, el('label', null, 'Inference config JSON'), inference, el('label', null, 'Tool config JSON'), tools);
    openModal('Converse', form, 'Converse', async (close) => {
      const data = await apiJson('/api/bedrockruntime/converse/', {
        method: 'POST',
        body: JSON.stringify({
          model_id: model.value.trim(),
          messages: parseJson(messages.value, [], 'Messages'),
          system: parseJson(system.value, null, 'System'),
          inference_config: parseJson(inference.value, null, 'Inference config'),
          tool_config: parseJson(tools.value, null, 'Tool config'),
        }),
      });
      state.selectedModelId = model.value.trim(); state.lastOperation = 'Converse'; state.lastResult = data; close(); toast('Conversation response returned'); render();
    });
  }

  function showInvokeModal() {
    const form = el('div', 'bedrockruntime-modal-form');
    const model = document.createElement('input'); model.value = state.selectedModelId;
    const body = document.createElement('textarea'); body.value = JSON.stringify({ anthropic_version: 'bedrock-2023-05-31', max_tokens: 100, messages: [{ role: 'user', content: 'hi' }] }, null, 2);
    const contentType = document.createElement('input'); contentType.value = 'application/json';
    const accept = document.createElement('input'); accept.value = 'application/json';
    form.append(el('label', null, 'Model ID'), model, el('label', null, 'Request body JSON'), body, el('label', null, 'Content type'), contentType, el('label', null, 'Accept'), accept);
    openModal('Invoke model', form, 'Invoke', async (close) => {
      const data = await apiJson('/api/bedrockruntime/invoke/', {
        method: 'POST',
        body: JSON.stringify({ model_id: model.value.trim(), body: parseJson(body.value, {}, 'Request body'), content_type: contentType.value.trim(), accept: accept.value.trim() }),
      });
      state.selectedModelId = model.value.trim(); state.lastOperation = 'InvokeModel'; state.lastResult = data; close(); toast('Model response returned'); render();
    });
  }

  function renderModels() {
    const panel = el('section', 'bedrockruntime-panel');
    panel.append(el('div', 'bedrockruntime-panel-heading', 'Model ID examples'));
    const list = el('div', 'bedrockruntime-list');
    modelIds().forEach((modelId) => {
      const row = el('button', `bedrockruntime-row${modelId === state.selectedModelId ? ' bedrockruntime-row-active' : ''}`);
      row.append(el('span', 'bedrockruntime-name', modelId), el('span', 'bedrockruntime-meta', modelId.startsWith('arn:') ? 'Inference profile ARN' : modelId.startsWith('us.') ? 'Inference profile ID' : 'Plain model ID'));
      row.addEventListener('click', () => { state.selectedModelId = modelId; render(); });
      list.append(row);
    });
    panel.append(list); return panel;
  }

  function renderResult() {
    const panel = el('section', 'bedrockruntime-panel');
    const heading = el('div', 'bedrockruntime-panel-heading');
    heading.append(el('span', null, state.lastOperation || 'Runtime response'), el('span', 'bedrockruntime-meta', state.lastResult ? state.selectedModelId : 'Run Converse or InvokeModel'));
    const content = el('div', 'bedrockruntime-detail');
    if (!state.lastResult) {
      content.append(el('p', 'bedrockruntime-empty', 'Choose a model ID example, then run a supported operation to inspect the fixed local response.'));
    } else {
      const response = el('pre', 'bedrockruntime-result'); response.textContent = JSON.stringify(ui.displayValue(state.lastResult), null, 2); content.append(response);
    }
    content.append(el('h3', null, 'Local behavior'));
    const facts = document.createElement('dl');
    ui.addField(facts, 'Inference', 'Fixed stub response');
    ui.addField(facts, 'Converse validation', 'Messages must be a non-empty array');
    ui.addField(facts, 'InvokeModel request', 'Accepted as opaque bytes');
    ui.addField(facts, 'Streaming', 'Unsupported (501)');
    content.append(facts); panel.append(heading, content); return panel;
  }

  function render() {
    if (!root) return;
    root.textContent = '';
    root.append(toolbar(
      [btn('Converse', null, showConverseModal), btn('Invoke model', 'bedrockruntime-btn-secondary', showInvokeModal), btn('Refresh', 'bedrockruntime-btn-secondary', () => refresh().catch((error) => toast(error.message, true)))],
      [el('span', 'bedrockruntime-toolbar-note', 'Responses are synthetic; no model is called')],
    ));
    const workbench = el('div', 'bedrockruntime-workbench'); workbench.append(renderModels(), renderResult()); root.append(workbench);
    if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
  }

  async function refresh() {
    const data = await apiJson('/api/bedrockruntime/');
    state.inventory = data; renderSummary(data.summary || {}); render();
  }

  function init() {
    if (!root) return;
    root.append(el('div', 'bedrockruntime-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.BedrockRuntimeConsole = BedrockRuntimeConsole;
if (document.getElementById('bedrockruntime-console-root')) BedrockRuntimeConsole.init();
