/* global ServiceConsole */

const CodeBuildConsole = (() => {
  const ui = window.ServiceConsole;
  const root = document.getElementById('codebuild-console-root');
  const breadcrumbsEl = document.getElementById('codebuild-breadcrumbs');
  const summaryEl = document.getElementById('codebuild-summary');
  const loadedAtEl = document.getElementById('codebuild-loaded-at');
  const state = { inventory: null, selectedProject: '', lastResult: null };
  const el = ui.el;
  const apiJson = ui.apiJson;
  const btn = ui.button;
  const toast = (message, isError = false) => ui.toast(message, { classPrefix: 'codebuild', type: isError ? 'error' : 'success' });
  const toolbar = (left, right) => ui.toolbar(left, right, 'codebuild');
  const openModal = (title, body, label, confirm) => ui.openModal(title, body, label, confirm, { classPrefix: 'codebuild', toast });

  function projects() { return state.inventory?.projects || []; }
  function builds() { return state.inventory?.builds || []; }
  function reportGroups() { return state.inventory?.report_groups || []; }
  function credentials() { return state.inventory?.source_credentials || []; }
  function projectName(project) { return project?.name || ''; }
  function buildId(build) { return build?.id || build?.name || ''; }
  function selectedProject() { return projects().find((project) => projectName(project) === state.selectedProject) || projects()[0] || null; }
  function projectBuilds(project = selectedProject()) { return builds().filter((build) => build.project_name === projectName(project)); }
  function parseJson(value, fallback, label) {
    const text = String(value || '').trim();
    if (!text) return fallback;
    try { return JSON.parse(text); } catch (error) { throw new Error(`${label} must be valid JSON`); }
  }
  function renderSummary(summary) {
    ui.renderSummary(summary, summaryEl, { serviceKey: 'codebuild', targets: { projects: 'Projects', builds: 'Builds', report_groups: 'Report groups', reports: 'Reports', source_credentials: 'Source credentials' } });
  }
  function renderBreadcrumbs() {
    if (!breadcrumbsEl) return;
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('CodeBuild', null, () => { state.selectedProject = projects()[0] ? projectName(projects()[0]) : ''; render(); }));
    const project = selectedProject(); if (project) breadcrumbsEl.append(el('span', null, '/'), el('span', null, projectName(project)));
  }
  function defaultProjectOptions() {
    return {
      source: { type: 'NO_SOURCE' },
      artifacts: { type: 'NO_ARTIFACTS' },
      environment: { type: 'LINUX_CONTAINER', image: 'public.ecr.aws/docker/library/alpine:latest', computeType: 'BUILD_GENERAL1_SMALL' },
      serviceRole: 'arn:aws:iam::000000000000:role/codebuild-role',
    };
  }
  function defaultBuildspec() {
    return 'version: 0.2\nphases:\n  build:\n    commands:\n      - echo hello from Floci CodeBuild\n';
  }
  function showProjectModal(project = null) {
    const form = el('div', 'codebuild-modal-form');
    const nameInput = document.createElement('input'); nameInput.value = projectName(project) || 'my-project'; nameInput.disabled = Boolean(project);
    const optionsInput = document.createElement('textarea');
    optionsInput.value = JSON.stringify(project ? { description: project.description || 'Updated local build project' } : defaultProjectOptions(), null, 2);
    form.append(el('label', null, 'Project name'), nameInput, el('label', null, 'Project options JSON'), optionsInput);
    openModal(project ? 'Update CodeBuild project' : 'Create CodeBuild project', form, project ? 'Save' : 'Create', async (close) => {
      const name = projectName(project) || nameInput.value.trim();
      const data = await apiJson(project ? `/api/codebuild/projects/${encodeURIComponent(name)}/` : '/api/codebuild/projects/', { method: project ? 'PATCH' : 'POST', body: JSON.stringify({ name, options: parseJson(optionsInput.value, {}, 'Project options') }) });
      state.selectedProject = name; state.lastResult = data; close(); toast(project ? 'Project updated' : 'Project created'); await refresh();
    });
  }
  function showStartBuildModal(project = selectedProject()) {
    const form = el('div', 'codebuild-modal-form');
    const projectInput = document.createElement('input'); projectInput.value = projectName(project);
    const buildspecInput = document.createElement('textarea'); buildspecInput.value = defaultBuildspec();
    const optionsInput = document.createElement('textarea'); optionsInput.placeholder = '{"environmentVariablesOverride":[{"name":"ENV","value":"local","type":"PLAINTEXT"}]}';
    form.append(el('label', null, 'Project name'), projectInput, el('label', null, 'Buildspec override'), buildspecInput, el('label', null, 'Additional build overrides JSON'), optionsInput);
    openModal('Start CodeBuild build', form, 'Start', async (close) => {
      const options = parseJson(optionsInput.value, {}, 'Build overrides'); options.buildspecOverride = buildspecInput.value;
      const data = await apiJson('/api/codebuild/builds/start/', { method: 'POST', body: JSON.stringify({ project_name: projectInput.value.trim(), options }) });
      state.selectedProject = projectInput.value.trim(); state.lastResult = data; close(); toast('Build started'); await refresh();
    });
  }
  function showBuildActionModal(action, build = null) {
    const form = el('div', 'codebuild-modal-form');
    const input = document.createElement('input'); input.value = buildId(build);
    form.append(el('label', null, 'Build ID'), input);
    const title = action === 'get' ? 'Get build' : action === 'stop' ? 'Stop build' : 'Retry build';
    openModal(title, form, action === 'get' ? 'Get' : action === 'stop' ? 'Stop' : 'Retry', async (close) => {
      const data = await apiJson(`/api/codebuild/builds/${action}/`, { method: 'POST', body: JSON.stringify({ build_id: input.value.trim() }) });
      state.lastResult = data; close(); toast(action === 'get' ? 'Build loaded' : action === 'stop' ? 'Build stopped' : 'Build retried'); await refresh();
    });
  }
  function showReportGroupModal() {
    const form = el('div', 'codebuild-modal-form');
    const name = document.createElement('input'); name.value = 'local-reports';
    const options = document.createElement('textarea'); options.value = JSON.stringify({ type: 'TEST', exportConfig: { exportConfigType: 'NO_EXPORT' } }, null, 2);
    form.append(el('label', null, 'Report group name'), name, el('label', null, 'Report group options JSON'), options);
    openModal('Create report group', form, 'Create', async (close) => {
      const data = await apiJson('/api/codebuild/report-groups/', { method: 'POST', body: JSON.stringify({ name: name.value.trim(), options: parseJson(options.value, {}, 'Report group options') }) });
      state.lastResult = data; close(); toast('Report group created'); await refresh();
    });
  }
  function showCredentialsModal() {
    const form = el('div', 'codebuild-modal-form');
    const server = document.createElement('input'); server.value = 'GITHUB';
    const auth = document.createElement('input'); auth.value = 'PERSONAL_ACCESS_TOKEN';
    const token = document.createElement('input'); token.type = 'password';
    const username = document.createElement('input');
    form.append(el('label', null, 'Server type'), server, el('label', null, 'Auth type'), auth, el('label', null, 'Token'), token, el('label', null, 'Username'), username);
    openModal('Import source credentials', form, 'Import', async (close) => {
      const data = await apiJson('/api/codebuild/source-credentials/', { method: 'POST', body: JSON.stringify({ server_type: server.value.trim(), auth_type: auth.value.trim(), token: token.value, username: username.value.trim() }) });
      state.lastResult = data; close(); toast('Source credentials imported'); await refresh();
    });
  }
  async function deleteProject(project) {
    const name = projectName(project); if (!window.confirm(`Delete CodeBuild project ${name}?`)) return;
    const data = await apiJson(`/api/codebuild/projects/${encodeURIComponent(name)}/`, { method: 'DELETE' });
    state.selectedProject = ''; state.lastResult = data; toast('Project deleted'); await refresh();
  }
  async function loadImages() {
    state.lastResult = await apiJson('/api/codebuild/curated-images/'); toast('Curated images loaded'); render();
  }
  function renderProjectList() {
    const panel = el('section', 'codebuild-panel'); panel.append(el('div', 'codebuild-panel-heading', 'Projects'));
    const list = el('div', 'codebuild-list');
    if (!projects().length) list.append(el('div', 'codebuild-empty', 'No CodeBuild projects found.'));
    projects().forEach((project) => {
      const row = el('button', `codebuild-row${projectName(project) === projectName(selectedProject()) ? ' codebuild-row-active' : ''}`);
      row.append(el('span', 'codebuild-name', projectName(project)), el('span', 'codebuild-meta', `${project.environment?.image || 'image pending'} / ${projectBuilds(project).length} builds`));
      row.addEventListener('click', () => { state.selectedProject = projectName(project); render(); }); list.append(row);
    });
    panel.append(list); return panel;
  }
  function renderLastResult() {
    if (!state.lastResult) return null;
    const wrapper = el('div', 'codebuild-last-result'); wrapper.append(el('h3', null, 'Last action result'));
    const pre = el('pre', 'codebuild-result'); pre.textContent = JSON.stringify(ui.displayValue(state.lastResult), null, 2); wrapper.append(pre); return wrapper;
  }
  function renderDetail(project) {
    const panel = el('section', 'codebuild-panel');
    const heading = el('div', 'codebuild-panel-heading'); heading.append(el('span', null, project ? projectName(project) : 'CodeBuild workbench'), el('span', 'codebuild-meta', project ? `${projectBuilds(project).length} builds` : 'No project selected')); panel.append(heading);
    const content = el('div', 'codebuild-detail');
    if (!project) { content.append(el('p', 'codebuild-empty', 'Create a project or refresh after your app creates one.')); panel.append(content); return panel; }
    const facts = document.createElement('dl');
    ui.addField(facts, 'ARN', project.arn); ui.addField(facts, 'Source', project.source); ui.addField(facts, 'Artifacts', project.artifacts); ui.addField(facts, 'Environment', project.environment); ui.addField(facts, 'Service role', project.service_role); ui.addField(facts, 'Logs', project.logs_config);
    content.append(facts);
    const actions = el('div', 'codebuild-action-row'); actions.append(btn('Start build', null, () => showStartBuildModal(project)), btn('Update', 'codebuild-btn-secondary', () => showProjectModal(project)), btn('Delete', 'codebuild-btn-danger', () => deleteProject(project).catch((error) => toast(error.message, true)))); content.append(actions, el('h3', null, 'Builds'));
    const list = el('div', 'codebuild-card-list');
    if (!projectBuilds(project).length) list.append(el('p', 'codebuild-empty', 'No builds found for this project.'));
    projectBuilds(project).forEach((build) => {
      const card = el('article', 'codebuild-card'); card.append(el('h3', null, buildId(build)));
      const dl = document.createElement('dl'); ui.addField(dl, 'Status', build.status); ui.addField(dl, 'Current phase', build.current_phase); ui.addField(dl, 'Build complete', build.build_complete); ui.addField(dl, 'Phases', build.phases); ui.addField(dl, 'Logs', build.logs); ui.addField(dl, 'Artifacts', build.artifacts); card.append(dl);
      const row = el('div', 'codebuild-action-row'); row.append(btn('Get', null, () => showBuildActionModal('get', build)), btn('Stop', 'codebuild-btn-secondary', () => showBuildActionModal('stop', build)), btn('Retry', 'codebuild-btn-secondary', () => showBuildActionModal('retry', build))); card.append(row); list.append(card);
    });
    content.append(list, el('h3', null, 'Report groups'));
    const reports = el('div', 'codebuild-card-list');
    if (!reportGroups().length) reports.append(el('p', 'codebuild-empty', 'No report groups found.'));
    reportGroups().forEach((group) => {
      const card = el('article', 'codebuild-card'); card.append(el('h3', null, group.name || group.arn));
      const dl = document.createElement('dl'); ui.addField(dl, 'ARN', group.arn); ui.addField(dl, 'Type', group.type); ui.addField(dl, 'Export config', group.export_config); card.append(dl); reports.append(card);
    });
    content.append(reports);
    const result = renderLastResult(); if (result) content.append(result);
    panel.append(content); return panel;
  }
  function renderWorkbench() {
    const container = el('div');
    container.append(toolbar([btn('Create project', null, () => showProjectModal()), btn('Start build', 'codebuild-btn-secondary', () => showStartBuildModal()), btn('Create report group', 'codebuild-btn-secondary', showReportGroupModal), btn('Import credentials', 'codebuild-btn-secondary', showCredentialsModal), btn('Curated images', 'codebuild-btn-secondary', () => loadImages().catch((error) => toast(error.message, true))), btn('Refresh', 'codebuild-btn-secondary', () => refresh().catch((error) => toast(error.message, true)))], [el('span', 'codebuild-toolbar-note', 'Builds run asynchronously in Docker containers')]));
    const workbench = el('div', 'codebuild-workbench'); workbench.append(renderProjectList(), renderDetail(selectedProject())); container.append(workbench); return container;
  }
  function render() { if (!root) return; renderBreadcrumbs(); root.textContent = ''; root.append(renderWorkbench()); if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`; }
  async function refresh() { const data = await apiJson('/api/codebuild/'); state.inventory = data; if (!selectedProject() && projects().length) state.selectedProject = projectName(projects()[0]); renderSummary(data.summary || {}); render(); }
  function init() { if (!root) return; root.append(el('div', 'codebuild-empty', 'Loading...')); refresh().catch((error) => toast(error.message, true)); }
  return { init, refresh };
})();

window.CodeBuildConsole = CodeBuildConsole;
if (document.getElementById('codebuild-console-root')) CodeBuildConsole.init();
