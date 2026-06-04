/* global ServiceConsole */

const CodeDeployConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('codedeploy-console-root');
  const breadcrumbsEl = document.getElementById('codedeploy-breadcrumbs');
  const summaryEl = document.getElementById('codedeploy-summary');
  const loadedAtEl = document.getElementById('codedeploy-loaded-at');

  const state = { inventory: null, selectedApplication: '', lastResult: null };
  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, { classPrefix: 'codedeploy', type: isError ? 'error' : 'success' });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'codedeploy');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) => consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, { classPrefix: 'codedeploy', toast });

  function applications() { return state.inventory?.applications || []; }
  function groups() { return state.inventory?.deployment_groups || []; }
  function deployments() { return state.inventory?.deployments || []; }
  function configs() { return state.inventory?.deployment_configs || []; }
  function appName(app) { return app?.name || app?.applicationName || ''; }
  function groupName(group) { return group?.name || group?.deploymentGroupName || ''; }
  function deploymentId(deployment) { return deployment?.deployment_id || deployment?.deploymentId || deployment?.name || ''; }
  function selectedApplication() {
    return applications().find((app) => appName(app) === state.selectedApplication) || applications()[0] || null;
  }
  function appGroups(app = selectedApplication()) {
    const name = appName(app);
    return groups().filter((group) => group.application_name === name);
  }
  function appDeployments(app = selectedApplication()) {
    const name = appName(app);
    return deployments().filter((deployment) => deployment.application_name === name);
  }
  function parseJson(value, fallback, label) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return fallback;
    try { return JSON.parse(trimmed); } catch (error) { throw new Error(`${label} must be valid JSON`); }
  }
  function lambdaAppSpec() {
    return {
      version: 0.0,
      Resources: [{ myFunction: { Type: 'AWS::Lambda::Function', Properties: { Name: 'my-function', Alias: 'live', CurrentVersion: '1', TargetVersion: '2' } } }],
    };
  }
  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'codedeploy',
      targets: { applications: 'Applications', deployment_groups: 'Deployment groups', deployments: 'Deployments', deployment_configs: 'Deployment configs', on_prem_instances: 'On-premises instances' },
    });
  }
  function renderBreadcrumbs() {
    if (!breadcrumbsEl) return;
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('CodeDeploy', null, () => { state.selectedApplication = applications()[0] ? appName(applications()[0]) : ''; render(); }));
    const app = selectedApplication();
    if (app) breadcrumbsEl.append(el('span', null, '/'), el('span', null, appName(app)));
  }
  function showCreateApplicationModal() {
    const form = el('div', 'codedeploy-modal-form');
    const nameInput = document.createElement('input'); nameInput.value = 'my-app';
    const platformInput = document.createElement('input'); platformInput.value = 'Lambda';
    form.append(el('label', null, 'Application name'), nameInput, el('label', null, 'Compute platform'), platformInput);
    openModal('Create CodeDeploy application', form, 'Create', async (close) => {
      const data = await apiJson('/api/codedeploy/applications/', { method: 'POST', body: JSON.stringify({ name: nameInput.value.trim(), compute_platform: platformInput.value.trim() }) });
      state.selectedApplication = nameInput.value.trim(); state.lastResult = data; close(); toast('Application created'); await refresh();
    });
  }
  function showCreateGroupModal(app = selectedApplication()) {
    const form = el('div', 'codedeploy-modal-form');
    const nameInput = document.createElement('input'); nameInput.value = app?.compute_platform === 'ECS' ? 'my-ecs-group' : 'my-group';
    const optionsInput = document.createElement('textarea');
    optionsInput.value = JSON.stringify({
      serviceRoleArn: 'arn:aws:iam::000000000000:role/codedeploy-role',
      deploymentConfigName: app?.compute_platform === 'ECS' ? 'CodeDeployDefault.ECSAllAtOnce' : 'CodeDeployDefault.LambdaAllAtOnce',
      deploymentStyle: { deploymentType: 'BLUE_GREEN', deploymentOption: 'WITH_TRAFFIC_CONTROL' },
    }, null, 2);
    form.append(el('label', null, 'Deployment group name'), nameInput, el('label', null, 'Deployment group options JSON'), optionsInput);
    openModal('Create deployment group', form, 'Create', async (close) => {
      const appValue = appName(app);
      const data = await apiJson(`/api/codedeploy/applications/${encodeURIComponent(appValue)}/deployment-groups/`, { method: 'POST', body: JSON.stringify({ deployment_group_name: nameInput.value.trim(), options: parseJson(optionsInput.value, {}, 'Deployment group options') }) });
      state.selectedApplication = appValue; state.lastResult = data; close(); toast('Deployment group created'); await refresh();
    });
  }
  function showCreateDeploymentModal(group = appGroups()[0]) {
    const form = el('div', 'codedeploy-modal-form');
    const appInput = document.createElement('input'); appInput.value = group?.application_name || appName(selectedApplication());
    const groupInput = document.createElement('input'); groupInput.value = groupName(group);
    const revisionInput = document.createElement('textarea');
    revisionInput.value = JSON.stringify({ revisionType: 'AppSpecContent', appSpecContent: { content: JSON.stringify(lambdaAppSpec()) } }, null, 2);
    const optionsInput = document.createElement('textarea'); optionsInput.placeholder = '{"description":"Local deployment"}';
    form.append(el('label', null, 'Application name'), appInput, el('label', null, 'Deployment group name'), groupInput, el('label', null, 'Revision JSON'), revisionInput, el('label', null, 'Deployment options JSON'), optionsInput);
    openModal('Create deployment', form, 'Deploy', async (close) => {
      const data = await apiJson('/api/codedeploy/deployments/', { method: 'POST', body: JSON.stringify({ application_name: appInput.value.trim(), deployment_group_name: groupInput.value.trim(), revision: parseJson(revisionInput.value, {}, 'Revision'), options: parseJson(optionsInput.value, {}, 'Deployment options') }) });
      state.selectedApplication = appInput.value.trim(); state.lastResult = data; close(); toast('Deployment created'); await refresh();
    });
  }
  function showConfigModal() {
    const form = el('div', 'codedeploy-modal-form');
    const nameInput = document.createElement('input'); nameInput.value = 'LocalAllAtOnce';
    const optionsInput = document.createElement('textarea'); optionsInput.value = JSON.stringify({ minimumHealthyHosts: { type: 'HOST_COUNT', value: 0 }, computePlatform: 'Server' }, null, 2);
    form.append(el('label', null, 'Deployment config name'), nameInput, el('label', null, 'Deployment config options JSON'), optionsInput);
    openModal('Create deployment config', form, 'Create', async (close) => {
      const data = await apiJson('/api/codedeploy/deployment-configs/', { method: 'POST', body: JSON.stringify({ name: nameInput.value.trim(), options: parseJson(optionsInput.value, {}, 'Deployment config options') }) });
      state.lastResult = data; close(); toast('Deployment config created'); await refresh();
    });
  }
  function showDeploymentActionModal(action, deployment = null) {
    const form = el('div', 'codedeploy-modal-form');
    const idInput = document.createElement('input'); idInput.value = deploymentId(deployment);
    form.append(el('label', null, 'Deployment ID'), idInput);
    if (action === 'stop') {
      const rollback = document.createElement('input'); rollback.type = 'checkbox';
      form.append(el('label', null, 'Auto rollback enabled'), rollback);
      openModal('Stop deployment', form, 'Stop', async (close) => {
        const data = await apiJson('/api/codedeploy/deployments/stop/', { method: 'POST', body: JSON.stringify({ deployment_id: idInput.value.trim(), auto_rollback_enabled: rollback.checked }) });
        state.lastResult = data; close(); toast('Deployment stopped'); await refresh();
      });
      return;
    }
    openModal(action === 'continue' ? 'Continue deployment' : 'Get deployment', form, action === 'continue' ? 'Continue' : 'Get', async (close) => {
      const path = action === 'continue' ? '/api/codedeploy/deployments/continue/' : '/api/codedeploy/deployments/get/';
      const data = await apiJson(path, { method: 'POST', body: JSON.stringify({ deployment_id: idInput.value.trim() }) });
      state.lastResult = data; close(); toast(action === 'continue' ? 'Deployment continued' : 'Deployment loaded'); await refresh();
    });
  }
  function showHookModal() {
    const form = el('div', 'codedeploy-modal-form');
    const deploymentInput = document.createElement('input');
    const hookInput = document.createElement('input');
    const statusInput = document.createElement('input'); statusInput.value = 'Succeeded';
    form.append(el('label', null, 'Deployment ID'), deploymentInput, el('label', null, 'Hook execution ID'), hookInput, el('label', null, 'Status'), statusInput);
    openModal('Report lifecycle hook', form, 'Report', async (close) => {
      const data = await apiJson('/api/codedeploy/lifecycle-hooks/status/', { method: 'POST', body: JSON.stringify({ deployment_id: deploymentInput.value.trim(), hook_execution_id: hookInput.value.trim(), status: statusInput.value.trim() }) });
      state.lastResult = data; close(); toast('Lifecycle hook reported'); await refresh();
    });
  }
  function showTagModal(resourceArn = '', remove = false) {
    const form = el('div', 'codedeploy-modal-form');
    const arnInput = document.createElement('input'); arnInput.value = resourceArn;
    const valueInput = document.createElement('textarea'); valueInput.value = JSON.stringify(remove ? ['env'] : [{ Key: 'env', Value: 'dev' }], null, 2);
    form.append(el('label', null, 'Resource ARN'), arnInput, el('label', null, remove ? 'Tag keys JSON' : 'Tags JSON'), valueInput);
    openModal(remove ? 'Untag CodeDeploy resource' : 'Tag CodeDeploy resource', form, remove ? 'Remove' : 'Save', async (close) => {
      const data = await apiJson('/api/codedeploy/tags/', { method: remove ? 'DELETE' : 'POST', body: JSON.stringify(remove ? { resource_arn: arnInput.value.trim(), tag_keys: parseJson(valueInput.value, [], 'Tag keys') } : { resource_arn: arnInput.value.trim(), tags: parseJson(valueInput.value, [], 'Tags') }) });
      state.lastResult = data; close(); toast(remove ? 'Resource untagged' : 'Resource tagged'); await refresh();
    });
  }
  async function deleteApplication(app) {
    const name = appName(app); if (!window.confirm(`Delete CodeDeploy application ${name}?`)) return;
    const data = await apiJson(`/api/codedeploy/applications/${encodeURIComponent(name)}/`, { method: 'DELETE' });
    state.selectedApplication = ''; state.lastResult = data; toast('Application deleted'); await refresh();
  }
  async function deleteGroup(group) {
    if (!window.confirm(`Delete deployment group ${groupName(group)}?`)) return;
    const data = await apiJson(`/api/codedeploy/applications/${encodeURIComponent(group.application_name)}/deployment-groups/${encodeURIComponent(groupName(group))}/`, { method: 'DELETE' });
    state.lastResult = data; toast('Deployment group deleted'); await refresh();
  }
  function renderAppList() {
    const panel = el('section', 'codedeploy-panel'); panel.append(el('div', 'codedeploy-panel-heading', 'Applications'));
    const list = el('div', 'codedeploy-list');
    if (!applications().length) list.append(el('div', 'codedeploy-empty', 'No CodeDeploy applications found.'));
    applications().forEach((app) => {
      const row = el('button', `codedeploy-row${appName(app) === appName(selectedApplication()) ? ' codedeploy-row-active' : ''}`);
      row.append(el('span', 'codedeploy-name', appName(app)), el('span', 'codedeploy-meta', `${app.compute_platform || 'Server'} / ${app.deployment_group_count || 0} groups`));
      row.addEventListener('click', () => { state.selectedApplication = appName(app); render(); });
      list.append(row);
    });
    panel.append(list); return panel;
  }
  function renderLastResult() {
    if (!state.lastResult) return null;
    const wrapper = el('div', 'codedeploy-last-result'); wrapper.append(el('h3', null, 'Last action result'));
    const pre = el('pre', 'codedeploy-result'); pre.textContent = JSON.stringify(consoleUi.displayValue(state.lastResult), null, 2);
    wrapper.append(pre); return wrapper;
  }
  function renderDetail(app) {
    const panel = el('section', 'codedeploy-panel');
    const heading = el('div', 'codedeploy-panel-heading'); heading.append(el('span', null, app ? appName(app) : 'CodeDeploy workbench'), el('span', 'codedeploy-meta', app ? `${app.compute_platform || 'Server'} deployments` : 'No application selected'));
    panel.append(heading);
    const content = el('div', 'codedeploy-detail');
    if (!app) {
      content.append(el('p', 'codedeploy-empty', 'Create an application or refresh after your app creates one.'));
      panel.append(content); return panel;
    }
    const facts = document.createElement('dl');
    consoleUi.addField(facts, 'Application ID', app.application_id);
    consoleUi.addField(facts, 'Compute platform', app.compute_platform);
    consoleUi.addField(facts, 'Deployment groups', app.deployment_group_count);
    consoleUi.addField(facts, 'Deployments', app.deployment_count);
    content.append(facts);
    const actions = el('div', 'codedeploy-action-row');
    actions.append(btn('Create group', null, () => showCreateGroupModal(app)), btn('Create deployment', 'codedeploy-btn-secondary', () => showCreateDeploymentModal(appGroups(app)[0])), btn('Delete app', 'codedeploy-btn-danger', () => deleteApplication(app).catch((error) => toast(error.message, true))));
    content.append(actions, el('h3', null, 'Deployment groups'));
    const groupList = el('div', 'codedeploy-card-list');
    if (!appGroups(app).length) groupList.append(el('p', 'codedeploy-empty', 'No deployment groups found.'));
    appGroups(app).forEach((group) => {
      const card = el('article', 'codedeploy-card'); card.append(el('h3', null, groupName(group)));
      const dl = document.createElement('dl');
      consoleUi.addField(dl, 'Config', group.deployment_config_name); consoleUi.addField(dl, 'Style', group.deployment_style); consoleUi.addField(dl, 'ECS services', group.ecs_services); consoleUi.addField(dl, 'Load balancer', group.load_balancer_info);
      card.append(dl);
      const row = el('div', 'codedeploy-action-row');
      row.append(btn('Deploy', null, () => showCreateDeploymentModal(group)), btn('Delete', 'codedeploy-btn-danger', () => deleteGroup(group).catch((error) => toast(error.message, true))));
      card.append(row); groupList.append(card);
    });
    content.append(groupList, el('h3', null, 'Deployments'));
    const deploymentList = el('div', 'codedeploy-card-list');
    if (!appDeployments(app).length) deploymentList.append(el('p', 'codedeploy-empty', 'No deployments found.'));
    appDeployments(app).forEach((deployment) => {
      const card = el('article', 'codedeploy-card'); card.append(el('h3', null, deploymentId(deployment)));
      const dl = document.createElement('dl');
      consoleUi.addField(dl, 'Group', deployment.deployment_group_name); consoleUi.addField(dl, 'Status', deployment.status); consoleUi.addField(dl, 'Config', deployment.deployment_config_name); consoleUi.addField(dl, 'Overview', deployment.deployment_overview);
      card.append(dl);
      const row = el('div', 'codedeploy-action-row');
      row.append(btn('Get', null, () => showDeploymentActionModal('get', deployment)), btn('Stop', 'codedeploy-btn-secondary', () => showDeploymentActionModal('stop', deployment)), btn('Continue', 'codedeploy-btn-secondary', () => showDeploymentActionModal('continue', deployment)));
      card.append(row); deploymentList.append(card);
    });
    content.append(deploymentList);
    const result = renderLastResult(); if (result) content.append(result);
    panel.append(content); return panel;
  }
  function renderWorkbench() {
    const app = selectedApplication();
    const container = el('div');
    container.append(toolbar([
      btn('Create application', null, showCreateApplicationModal),
      btn('Create config', 'codedeploy-btn-secondary', showConfigModal),
      btn('Create deployment', 'codedeploy-btn-secondary', () => showCreateDeploymentModal()),
      btn('Get deployment', 'codedeploy-btn-secondary', () => showDeploymentActionModal('get')),
      btn('Report hook', 'codedeploy-btn-secondary', showHookModal),
      btn('Tag resource', 'codedeploy-btn-secondary', () => showTagModal()),
      btn('Untag resource', 'codedeploy-btn-secondary', () => showTagModal('', true)),
      btn('Refresh', 'codedeploy-btn-secondary', () => refresh().catch((error) => toast(error.message, true))),
    ], [el('span', 'codedeploy-toolbar-note', 'Lambda and ECS deployments can shift real local traffic')]));
    const workbench = el('div', 'codedeploy-workbench'); workbench.append(renderAppList(), renderDetail(app)); container.append(workbench); return container;
  }
  function render() {
    if (!root) return;
    renderBreadcrumbs(); root.textContent = ''; root.append(renderWorkbench());
    if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
  }
  async function refresh() {
    const data = await apiJson('/api/codedeploy/'); state.inventory = data;
    if (!selectedApplication() && applications().length) state.selectedApplication = appName(applications()[0]);
    renderSummary(data.summary || {}); render();
  }
  function init() { if (!root) return; root.append(el('div', 'codedeploy-empty', 'Loading...')); refresh().catch((error) => toast(error.message, true)); }
  return { init, refresh };
})();

window.CodeDeployConsole = CodeDeployConsole;
if (document.getElementById('codedeploy-console-root')) CodeDeployConsole.init();
