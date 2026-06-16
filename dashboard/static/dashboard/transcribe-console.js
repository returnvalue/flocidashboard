/* global ServiceConsole */

const TranscribeConsole = (() => {
  const ui = window.ServiceConsole;
  const root = document.getElementById('transcribe-console-root');
  const breadcrumbsEl = document.getElementById('transcribe-breadcrumbs');
  const summaryEl = document.getElementById('transcribe-summary');
  const loadedAtEl = document.getElementById('transcribe-loaded-at');
  const ACTION_FALLBACKS = [
    { name: 'start_transcription_job', label: 'Start transcription job', kind: 'execute', safety: 'mutating' },
    { name: 'get_transcription_job', label: 'Get transcription job', kind: 'read', safety: 'safe' },
    { name: 'delete_transcription_job', label: 'Delete transcription job', kind: 'delete', safety: 'destructive', confirm: 'Delete this transcription job?' },
    { name: 'create_vocabulary', label: 'Create vocabulary', kind: 'create', safety: 'mutating' },
    { name: 'get_vocabulary', label: 'Get vocabulary', kind: 'read', safety: 'safe' },
    { name: 'delete_vocabulary', label: 'Delete vocabulary', kind: 'delete', safety: 'destructive', confirm: 'Delete this vocabulary?' },
  ];
  const ACTION_LABELS = {
    start_transcription_job: 'Start job',
    get_transcription_job: 'Get job',
    create_vocabulary: 'Create vocabulary',
    get_vocabulary: 'Get vocabulary',
    delete_transcription_job: 'Delete job',
    delete_vocabulary: 'Delete',
  };
  const state = { inventory: null, selectedJob: '', lastResult: null, actions: ACTION_FALLBACKS, actionsLoaded: false };
  const el = ui.el;
  const apiJson = ui.apiJson;
  const btn = ui.button;
  const toast = (message, isError = false) => ui.toast(message, { classPrefix: 'transcribe', type: isError ? 'error' : 'success' });
  const toolbar = (left, right) => ui.toolbar(left, right, 'transcribe');
  const openModal = (title, body, label, confirm) => ui.openModal(title, body, label, confirm, { classPrefix: 'transcribe', toast });

  function jobs() { return state.inventory?.transcription_jobs || []; }
  function vocabularies() { return state.inventory?.vocabularies || []; }
  function jobName(job) { return job?.TranscriptionJobName || job?.name || ''; }
  function vocabularyName(vocabulary) { return vocabulary?.VocabularyName || vocabulary?.name || ''; }
  function selectedJob() { return jobs().find((job) => jobName(job) === state.selectedJob) || jobs()[0] || null; }
  function parseJson(value, fallback, label) {
    const text = String(value || '').trim(); if (!text) return fallback;
    try { return JSON.parse(text); } catch (error) { throw new Error(`${label} must be valid JSON`); }
  }
  function renderSummary(summary) {
    ui.renderSummary(summary, summaryEl, { serviceKey: 'transcribe', targets: { transcription_jobs: 'Transcription jobs', vocabularies: 'Vocabularies', available_sdk_operations: 'Available SDK operations' } });
  }
  function serviceActions(names) {
    const byName = new Map(state.actions.map((action) => [action.name, action]));
    return names.map((name) => byName.get(name)).filter(Boolean);
  }
  function renderActionButtons(names, handlers) {
    return ui.renderActionButtons(serviceActions(names), handlers, { classPrefix: 'transcribe', labels: ACTION_LABELS });
  }
  async function loadActions() {
    if (state.actionsLoaded) return;
    try {
      const payload = await apiJson('/api/services/');
      const service = (payload.services || []).find((item) => item.key === 'transcribe');
      if (service?.actions?.length) state.actions = service.actions;
    } catch (_error) {
      state.actions = ACTION_FALLBACKS;
    } finally {
      state.actionsLoaded = true;
    }
  }
  function renderBreadcrumbs() {
    if (!breadcrumbsEl) return;
    breadcrumbsEl.textContent = ''; breadcrumbsEl.append(btn('Transcribe', null, () => { state.selectedJob = jobs()[0] ? jobName(jobs()[0]) : ''; render(); }));
    const job = selectedJob(); if (job) breadcrumbsEl.append(el('span', null, '/'), el('span', null, jobName(job)));
  }
  function showStartJobModal() {
    const form = el('div', 'transcribe-modal-form');
    const name = document.createElement('input'); name.value = 'floci-demo';
    const media = document.createElement('input'); media.value = 's3://my-bucket/audio.mp3';
    const language = document.createElement('input'); language.value = 'en-US';
    const format = document.createElement('input'); format.value = 'mp3';
    const options = document.createElement('textarea'); options.placeholder = '{"Settings":{"VocabularyName":"floci-vocab"}}';
    form.append(el('label', null, 'Job name'), name, el('label', null, 'Media URI'), media, el('label', null, 'Language code'), language, el('label', null, 'Media format'), format, el('label', null, 'Job options JSON'), options);
    openModal('Start transcription job', form, 'Start', async (close) => {
      const data = await apiJson('/api/transcribe/jobs/start/', { method: 'POST', body: JSON.stringify({ name: name.value.trim(), media_uri: media.value.trim(), language_code: language.value.trim(), media_format: format.value.trim(), options: parseJson(options.value, {}, 'Job options') }) });
      state.selectedJob = name.value.trim(); state.lastResult = data; close(); toast('Transcription job started'); await refresh();
    });
  }
  function showGetJobModal(job = selectedJob()) {
    const form = el('div', 'transcribe-modal-form'); const input = document.createElement('input'); input.value = jobName(job);
    form.append(el('label', null, 'Job name'), input);
    openModal('Get transcription job', form, 'Get', async (close) => {
      const data = await apiJson('/api/transcribe/jobs/get/', { method: 'POST', body: JSON.stringify({ name: input.value.trim() }) });
      state.selectedJob = input.value.trim(); state.lastResult = data; close(); toast('Transcription job loaded'); render();
    });
  }
  function showCreateVocabularyModal() {
    const form = el('div', 'transcribe-modal-form');
    const name = document.createElement('input'); name.value = 'floci-vocab';
    const language = document.createElement('input'); language.value = 'en-US';
    const phrases = document.createElement('textarea'); phrases.value = JSON.stringify(['Floci', 'local cloud'], null, 2);
    const uri = document.createElement('input'); uri.placeholder = 's3://my-bucket/vocabulary.txt';
    form.append(el('label', null, 'Vocabulary name'), name, el('label', null, 'Language code'), language, el('label', null, 'Phrases JSON'), phrases, el('label', null, 'Vocabulary file URI'), uri);
    openModal('Create custom vocabulary', form, 'Create', async (close) => {
      const data = await apiJson('/api/transcribe/vocabularies/', { method: 'POST', body: JSON.stringify({ name: name.value.trim(), language_code: language.value.trim(), phrases: parseJson(phrases.value, [], 'Phrases'), vocabulary_file_uri: uri.value.trim() }) });
      state.lastResult = data; close(); toast('Vocabulary created'); await refresh();
    });
  }
  function showGetVocabularyModal(vocabulary = null) {
    const form = el('div', 'transcribe-modal-form'); const input = document.createElement('input'); input.value = vocabularyName(vocabulary);
    form.append(el('label', null, 'Vocabulary name'), input);
    openModal('Get custom vocabulary', form, 'Get', async (close) => {
      const data = await apiJson('/api/transcribe/vocabularies/get/', { method: 'POST', body: JSON.stringify({ name: input.value.trim() }) });
      state.lastResult = data; close(); toast('Vocabulary loaded'); render();
    });
  }
  async function deleteJob(job, options = {}) {
    const name = jobName(job); if (options.confirm !== false && !ui.confirmAction(`Delete transcription job ${name}?`)) return;
    state.lastResult = await apiJson(`/api/transcribe/jobs/${encodeURIComponent(name)}/`, { method: 'DELETE' }); state.selectedJob = ''; toast('Transcription job deleted'); await refresh();
  }
  async function deleteVocabulary(vocabulary, options = {}) {
    const name = vocabularyName(vocabulary); if (options.confirm !== false && !ui.confirmAction(`Delete vocabulary ${name}?`)) return;
    state.lastResult = await apiJson(`/api/transcribe/vocabularies/${encodeURIComponent(name)}/`, { method: 'DELETE' }); toast('Vocabulary deleted'); await refresh();
  }
  function renderJobList() {
    const panel = el('section', 'transcribe-panel'); panel.append(el('div', 'transcribe-panel-heading', 'Transcription jobs'));
    const list = el('div', 'transcribe-list');
    if (!jobs().length) list.append(el('div', 'transcribe-empty', 'No transcription jobs found.'));
    jobs().forEach((job) => {
      const row = el('button', `transcribe-row${jobName(job) === jobName(selectedJob()) ? ' transcribe-row-active' : ''}`);
      row.append(el('span', 'transcribe-name', jobName(job)), el('span', 'transcribe-meta', `${job.TranscriptionJobStatus || 'COMPLETED'} / ${job.LanguageCode || 'en-US'}`));
      row.addEventListener('click', () => { state.selectedJob = jobName(job); render(); }); list.append(row);
    });
    panel.append(list); return panel;
  }
  function renderLastResult() {
    if (!state.lastResult) return null;
    const wrapper = el('div', 'transcribe-last-result'); wrapper.append(el('h3', null, 'Last action result'));
    const pre = el('pre', 'transcribe-result'); pre.textContent = JSON.stringify(ui.displayValue(state.lastResult), null, 2); wrapper.append(pre); return wrapper;
  }
  function renderDetail(job) {
    const panel = el('section', 'transcribe-panel');
    const heading = el('div', 'transcribe-panel-heading'); heading.append(el('span', null, job ? jobName(job) : 'Transcribe workbench'), el('span', 'transcribe-meta', job ? `${job.TranscriptionJobStatus || 'COMPLETED'} / synthetic transcript` : 'No job selected')); panel.append(heading);
    const content = el('div', 'transcribe-detail');
    if (!job) content.append(el('p', 'transcribe-empty', 'Start a transcription job or refresh after your app creates one.'));
    else {
      const facts = document.createElement('dl'); ui.addField(facts, 'Status', job.TranscriptionJobStatus); ui.addField(facts, 'Language', job.LanguageCode); ui.addField(facts, 'Created', job.CreationTime); ui.addField(facts, 'Completed', job.CompletionTime); ui.addField(facts, 'Output', job.Transcript);
      const actions = renderActionButtons(['get_transcription_job', 'delete_transcription_job'], {
        get_transcription_job: () => showGetJobModal(job),
        delete_transcription_job: () => deleteJob(job, { confirm: false }).catch((error) => toast(error.message, true)),
      });
      content.append(facts, actions);
    }
    content.append(el('h3', null, 'Custom vocabularies'));
    const list = el('div', 'transcribe-card-list');
    if (!vocabularies().length) list.append(el('p', 'transcribe-empty', 'No custom vocabularies found.'));
    vocabularies().forEach((vocabulary) => {
      const card = el('article', 'transcribe-card'); card.append(el('h3', null, vocabularyName(vocabulary)));
      const dl = document.createElement('dl'); ui.addField(dl, 'Language', vocabulary.LanguageCode); ui.addField(dl, 'State', vocabulary.VocabularyState); ui.addField(dl, 'Last modified', vocabulary.LastModifiedTime); card.append(dl);
      const actions = renderActionButtons(['get_vocabulary', 'delete_vocabulary'], {
        get_vocabulary: () => showGetVocabularyModal(vocabulary),
        delete_vocabulary: () => deleteVocabulary(vocabulary, { confirm: false }).catch((error) => toast(error.message, true)),
      }); card.append(actions); list.append(card);
    });
    content.append(list); const result = renderLastResult(); if (result) content.append(result); panel.append(content); return panel;
  }
  function renderWorkbench() {
    const container = el('div');
    const actions = renderActionButtons(['start_transcription_job', 'get_transcription_job', 'create_vocabulary', 'get_vocabulary'], {
      start_transcription_job: showStartJobModal,
      get_transcription_job: () => showGetJobModal(),
      create_vocabulary: showCreateVocabularyModal,
      get_vocabulary: () => showGetVocabularyModal(),
    });
    container.append(toolbar([...actions.children, btn('Refresh', 'transcribe-btn-secondary', () => refresh().catch((error) => toast(error.message, true)))], [el('span', 'transcribe-toolbar-note', 'Jobs complete and vocabularies become ready immediately')]));
    const workbench = el('div', 'transcribe-workbench'); workbench.append(renderJobList(), renderDetail(selectedJob())); container.append(workbench); return container;
  }
  function render() { if (!root) return; renderBreadcrumbs(); root.textContent = ''; root.append(renderWorkbench()); if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`; }
  async function refresh() { const [data] = await Promise.all([apiJson('/api/transcribe/'), loadActions()]); state.inventory = data; if (!selectedJob() && jobs().length) state.selectedJob = jobName(jobs()[0]); renderSummary(data.summary || {}); render(); }
  function init() { if (!root) return; root.append(el('div', 'transcribe-empty', 'Loading...')); refresh().catch((error) => toast(error.message, true)); }
  return { init, refresh };
})();

window.TranscribeConsole = TranscribeConsole;
if (document.getElementById('transcribe-console-root')) TranscribeConsole.init();
