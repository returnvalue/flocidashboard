/* global ServiceConsole */

const TextractConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('textract-console-root');
  const breadcrumbsEl = document.getElementById('textract-breadcrumbs');
  const summaryEl = document.getElementById('textract-summary');
  const loadedAtEl = document.getElementById('textract-loaded-at');

  const state = {
    inventory: null,
    lastResult: null,
    lastJobId: '',
    lastJobType: 'text',
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'textract',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'textract');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'textract',
      toast,
    });

  function parseJson(value, fallback, label) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return fallback;
    }
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`${label} must be valid JSON`);
    }
  }

  function defaultDocument() {
    return { S3Object: { Bucket: 'my-bucket', Name: 'test.pdf' } };
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(el('span', null, 'Textract'));
    if (state.lastJobId) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, state.lastJobId));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'textract',
      targets: {
        adapters: 'Adapters',
        adapter_versions: 'Adapter versions',
        available_sdk_operations: 'Available SDK operations',
        supported_operations: 'Supported from SDK',
      },
    });
  }

  function showDetectModal() {
    const form = el('div', 'textract-modal-form');
    const documentInput = document.createElement('textarea');
    documentInput.value = JSON.stringify(defaultDocument(), null, 2);
    form.append(el('label', null, 'Document JSON'), documentInput);
    openModal('Detect document text', form, 'Detect', async (close) => {
      const data = await apiJson('/api/textract/document-text/detect/', {
        method: 'POST',
        body: JSON.stringify({ document: parseJson(documentInput.value, {}, 'Document') }),
      });
      state.lastResult = data;
      close();
      toast('Document text detected');
      render();
    });
  }

  function showAnalyzeModal() {
    const form = el('div', 'textract-modal-form');
    const documentInput = document.createElement('textarea');
    documentInput.value = JSON.stringify(defaultDocument(), null, 2);
    const featuresInput = document.createElement('textarea');
    featuresInput.value = JSON.stringify(['TABLES', 'FORMS'], null, 2);
    form.append(
      el('label', null, 'Document JSON'),
      documentInput,
      el('label', null, 'Feature types JSON'),
      featuresInput,
    );
    openModal('Analyze document', form, 'Analyze', async (close) => {
      const data = await apiJson('/api/textract/document/analyze/', {
        method: 'POST',
        body: JSON.stringify({
          document: parseJson(documentInput.value, {}, 'Document'),
          feature_types: parseJson(featuresInput.value, ['TABLES', 'FORMS'], 'Feature types'),
        }),
      });
      state.lastResult = data;
      close();
      toast('Document analyzed');
      render();
    });
  }

  function showStartJobModal(jobType) {
    const form = el('div', 'textract-modal-form');
    const locationInput = document.createElement('textarea');
    locationInput.value = JSON.stringify({ S3Object: { Bucket: 'my-bucket', Name: 'test.pdf' } }, null, 2);
    const featuresInput = document.createElement('textarea');
    featuresInput.value = JSON.stringify(['TABLES', 'FORMS'], null, 2);
    form.append(el('label', null, 'Document location JSON'), locationInput);
    if (jobType === 'analysis') {
      form.append(el('label', null, 'Feature types JSON'), featuresInput);
    }
    openModal(jobType === 'analysis' ? 'Start document analysis' : 'Start text detection', form, 'Start', async (close) => {
      const path = jobType === 'analysis' ? '/api/textract/jobs/analysis/start/' : '/api/textract/jobs/text/start/';
      const body = {
        document_location: parseJson(locationInput.value, {}, 'Document location'),
      };
      if (jobType === 'analysis') {
        body.feature_types = parseJson(featuresInput.value, ['TABLES', 'FORMS'], 'Feature types');
      }
      const data = await apiJson(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      state.lastJobId = data.job_id || '';
      state.lastJobType = jobType;
      state.lastResult = data;
      close();
      toast('Textract job started');
      render();
    });
  }

  function showPollJobModal() {
    const form = el('div', 'textract-modal-form');
    const jobInput = document.createElement('input');
    jobInput.value = state.lastJobId;
    const typeSelect = document.createElement('select');
    [['text', 'Text detection'], ['analysis', 'Document analysis']].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      option.selected = value === state.lastJobType;
      typeSelect.append(option);
    });
    form.append(
      el('label', null, 'Job ID'),
      jobInput,
      el('label', null, 'Job type'),
      typeSelect,
    );
    openModal('Poll Textract job', form, 'Poll', async (close) => {
      const path = typeSelect.value === 'analysis' ? '/api/textract/jobs/analysis/get/' : '/api/textract/jobs/text/get/';
      const data = await apiJson(path, {
        method: 'POST',
        body: JSON.stringify({ job_id: jobInput.value.trim() }),
      });
      state.lastJobId = jobInput.value.trim();
      state.lastJobType = typeSelect.value;
      state.lastResult = data;
      close();
      toast('Textract job loaded');
      render();
    });
  }

  function renderBlockCards(blocks = []) {
    const list = el('div', 'textract-card-list');
    if (!blocks.length) {
      list.append(el('p', 'textract-empty', 'No blocks returned yet.'));
      return list;
    }
    blocks.forEach((block) => {
      const card = el('article', 'textract-card');
      card.append(el('h3', null, `${block.BlockType || 'Block'}${block.Text ? `: ${block.Text}` : ''}`));
      const facts = document.createElement('dl');
      consoleUi.addField(facts, 'ID', block.Id);
      consoleUi.addField(facts, 'Confidence', block.Confidence);
      consoleUi.addField(facts, 'Page', block.Page);
      consoleUi.addField(facts, 'Relationships', block.Relationships);
      consoleUi.addField(facts, 'Geometry', block.Geometry);
      card.append(facts);
      list.append(card);
    });
    return list;
  }

  function renderResult() {
    const panel = el('section', 'textract-panel');
    const heading = el('div', 'textract-panel-heading');
    heading.append(
      el('span', null, 'Stub response inspector'),
      el('span', 'textract-meta', state.lastJobId ? `Last job ${state.lastJobId}` : 'Fixed PAGE / LINE / WORD blocks'),
    );
    panel.append(heading);

    const content = el('div', 'textract-detail');
    if (!state.lastResult) {
      content.append(el('p', 'textract-empty', 'Run a sync operation or start and poll an async job to inspect the stub Textract response.'));
      panel.append(content);
      return panel;
    }

    const facts = document.createElement('dl');
    consoleUi.addField(facts, 'Job ID', state.lastResult.job_id);
    consoleUi.addField(facts, 'Job type', state.lastResult.job_type);
    consoleUi.addField(facts, 'Job status', state.lastResult.job_status);
    consoleUi.addField(facts, 'Block count', state.lastResult.block_count);
    consoleUi.addField(facts, 'Feature types', state.lastResult.feature_types);
    content.append(facts, el('h3', null, 'Blocks'), renderBlockCards(state.lastResult.blocks || []));

    const pre = el('pre', 'textract-result');
    pre.textContent = JSON.stringify(consoleUi.displayValue(state.lastResult.response || state.lastResult), null, 2);
    content.append(el('h3', null, 'Raw response'), pre);
    panel.append(content);
    return panel;
  }

  function renderNotes() {
    const panel = el('section', 'textract-panel');
    panel.append(el('div', 'textract-panel-heading', 'Local behavior'));
    const content = el('div', 'textract-detail');
    const facts = document.createElement('dl');
    consoleUi.addField(facts, 'Protocol', 'JSON 1.1 with X-Amz-Target: Textract.<Action>');
    consoleUi.addField(facts, 'OCR', 'Not performed');
    consoleUi.addField(facts, 'Stub text', 'Floci');
    consoleUi.addField(facts, 'Async jobs', 'Immediately SUCCEEDED, in-memory only');
    content.append(facts);
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const container = el('div');
    container.append(toolbar(
      [
        btn('Detect text', null, showDetectModal),
        btn('Analyze document', 'textract-btn-secondary', showAnalyzeModal),
        btn('Start text job', 'textract-btn-secondary', () => showStartJobModal('text')),
        btn('Start analysis job', 'textract-btn-secondary', () => showStartJobModal('analysis')),
        btn('Poll job', 'textract-btn-secondary', showPollJobModal),
        btn('Refresh', 'textract-btn-secondary', () => refresh().catch((error) => toast(error.message, true))),
      ],
      [el('span', 'textract-toolbar-note', 'Inputs are accepted but not parsed by Floci')],
    ));
    const workbench = el('div', 'textract-workbench');
    workbench.append(renderResult(), renderNotes());
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
    const data = await apiJson('/api/textract/');
    state.inventory = data;
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'textract-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.TextractConsole = TextractConsole;

if (document.getElementById('textract-console-root')) {
  TextractConsole.init();
}
