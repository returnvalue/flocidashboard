/* global ServiceConsole */

const ResourceGroupsTaggingConsole = (() => {
  const ui = window.ServiceConsole;
  const root = document.getElementById('resourcegroupstagging-console-root');
  const summaryEl = document.getElementById('resourcegroupstagging-summary');
  const loadedAtEl = document.getElementById('resourcegroupstagging-loaded-at');
  const state = { inventory: null, selectedArn: '', searchResults: null, lastResult: null };
  const el = ui.el; const apiJson = ui.apiJson; const btn = ui.button;
  const toast = (message, isError = false) => ui.toast(message, { classPrefix: 'resourcegroupstagging', type: isError ? 'error' : 'success' });
  const toolbar = (left, right) => ui.toolbar(left, right, 'resourcegroupstagging');
  const openModal = (title, body, label, confirm) => ui.openModal(title, body, label, confirm, { classPrefix: 'resourcegroupstagging', toast });
  function resources() { return state.searchResults?.resources || state.inventory?.resources || []; }
  function selectedResource() { return resources().find((resource) => (resource.ResourceARN || resource.arn) === state.selectedArn) || resources()[0] || null; }
  function arn(resource) { return resource?.ResourceARN || resource?.arn || ''; }
  function tags(resource) { return resource?.Tags || resource?.tags || []; }
  function parseJson(value, fallback, label) { const text = String(value || '').trim(); if (!text) return fallback; try { return JSON.parse(text); } catch (error) { throw new Error(`${label} must be valid JSON`); } }
  function renderSummary(summary) { ui.renderSummary(summary, summaryEl, { serviceKey: 'resourcegroupstagging', targets: { tagged_resources: 'Tagged resources', tag_keys: 'Tag keys', tag_value_keys_sampled: 'Tag values', resource_types: 'Resource types' } }); }
  function formField(form, label, control) { form.append(el('label', null, label), control); }
  function input(value = '', placeholder = '') { const node = document.createElement('input'); node.value = value; node.placeholder = placeholder; return node; }
  function textarea(value = '', placeholder = '') { const node = document.createElement('textarea'); node.value = value; node.placeholder = placeholder; return node; }

  function showTagModal(resource = selectedResource()) {
    const form = el('div', 'resourcegroupstagging-modal-form'); const arns = textarea(JSON.stringify([arn(resource) || 'arn:aws:lambda:us-east-1:000000000000:function/my-func'], null, 2)); const tagMap = textarea(JSON.stringify({ Environment: 'dev', Team: 'platform' }, null, 2));
    formField(form, 'Resource ARNs JSON', arns); formField(form, 'Tags JSON', tagMap);
    openModal('Tag resources', form, 'Tag', async (close) => {
      const data = await apiJson('/api/resourcegroupstagging/resources/tag/', { method: 'POST', body: JSON.stringify({ resource_arns: parseJson(arns.value, [], 'Resource ARNs'), tags: parseJson(tagMap.value, {}, 'Tags') }) });
      state.lastResult = data; close(); toast('Resources tagged'); await refresh();
    });
  }
  function showUntagModal(resource = selectedResource()) {
    const form = el('div', 'resourcegroupstagging-modal-form'); const arns = textarea(JSON.stringify([arn(resource) || 'arn:aws:lambda:us-east-1:000000000000:function/my-func'], null, 2)); const keys = textarea(JSON.stringify(['Team'], null, 2));
    formField(form, 'Resource ARNs JSON', arns); formField(form, 'Tag keys JSON', keys);
    openModal('Untag resources', form, 'Untag', async (close) => {
      const data = await apiJson('/api/resourcegroupstagging/resources/untag/', { method: 'POST', body: JSON.stringify({ resource_arns: parseJson(arns.value, [], 'Resource ARNs'), tag_keys: parseJson(keys.value, [], 'Tag keys') }) });
      state.lastResult = data; close(); toast('Tags removed'); await refresh();
    });
  }
  function showSearchModal() {
    const form = el('div', 'resourcegroupstagging-modal-form'); const arns = textarea('', '["arn:aws:s3:::my-bucket"]'); const tagFilters = textarea('[{"Key":"Environment","Values":["dev"]}]'); const types = textarea('', '["lambda","ec2:instance"]'); const perPage = input('50');
    formField(form, 'Resource ARNs JSON', arns); formField(form, 'Tag filters JSON', tagFilters); formField(form, 'Resource type filters JSON', types); formField(form, 'Resources per page', perPage);
    openModal('Search tagged resources', form, 'Search', async (close) => {
      const data = await apiJson('/api/resourcegroupstagging/resources/search/', { method: 'POST', body: JSON.stringify({ resource_arns: parseJson(arns.value, [], 'Resource ARNs'), tag_filters: parseJson(tagFilters.value, [], 'Tag filters'), resource_type_filters: parseJson(types.value, [], 'Resource type filters'), resources_per_page: Number(perPage.value || 50) }) });
      state.searchResults = data; state.selectedArn = data.resources?.[0]?.ResourceARN || ''; state.lastResult = data; close(); toast(`${data.resources?.length || 0} tagged resources found`); render();
    });
  }
  function showTagValuesModal() {
    const form = el('div', 'resourcegroupstagging-modal-form'); const key = input('Environment'); formField(form, 'Tag key', key);
    openModal('Get tag values', form, 'Get', async (close) => {
      const data = await apiJson('/api/resourcegroupstagging/tag-values/', { method: 'POST', body: JSON.stringify({ key: key.value.trim() }) });
      state.lastResult = data; close(); toast(`${data.values?.length || 0} values found`); render();
    });
  }
  function clearSearch() { state.searchResults = null; state.selectedArn = ''; render(); }

  function renderResourceList() {
    const panel = el('section', 'resourcegroupstagging-panel'); const heading = el('div', 'resourcegroupstagging-panel-heading'); heading.append(el('span', null, state.searchResults ? 'Search results' : 'Tagged resources'), el('span', 'resourcegroupstagging-meta', String(resources().length))); panel.append(heading);
    const list = el('div', 'resourcegroupstagging-list'); if (!resources().length) list.append(el('p', 'resourcegroupstagging-empty', 'No tagged resources found.'));
    resources().forEach((resource) => { const resourceArn = arn(resource); const row = el('button', `resourcegroupstagging-row${resourceArn === arn(selectedResource()) ? ' resourcegroupstagging-row-active' : ''}`); row.append(el('span', 'resourcegroupstagging-name', resourceArn.split('/').pop().split(':').pop()), el('span', 'resourcegroupstagging-meta', resourceArn)); row.addEventListener('click', () => { state.selectedArn = resourceArn; render(); }); list.append(row); }); panel.append(list); return panel;
  }
  function renderDetail(resource) {
    const panel = el('section', 'resourcegroupstagging-panel'); const heading = el('div', 'resourcegroupstagging-panel-heading'); heading.append(el('span', null, resource ? 'Resource tags' : 'Tag explorer'), el('span', 'resourcegroupstagging-meta', resource ? `${tags(resource).length} tags` : 'Select or tag a resource')); panel.append(heading);
    const content = el('div', 'resourcegroupstagging-detail');
    if (!resource) content.append(el('p', 'resourcegroupstagging-empty', 'Tag an AWS-shaped ARN or search for matching tagged resources.'));
    else { const facts = document.createElement('dl'); ui.addField(facts, 'ARN', arn(resource)); ui.addField(facts, 'Tags', tags(resource)); content.append(facts, el('div', 'resourcegroupstagging-action-row', null)); const actions = content.querySelector('.resourcegroupstagging-action-row'); actions.append(btn('Add or update tags', null, () => showTagModal(resource)), btn('Remove tags', 'resourcegroupstagging-btn-danger', () => showUntagModal(resource))); }
    if (state.lastResult) { const pre = el('pre', 'resourcegroupstagging-result'); pre.textContent = JSON.stringify(ui.displayValue(state.lastResult), null, 2); content.append(el('h3', null, 'Last action result'), pre); }
    panel.append(content); return panel;
  }
  function render() {
    if (!root) return; root.textContent = ''; const left = [btn('Tag resources', null, () => showTagModal()), btn('Untag resources', 'resourcegroupstagging-btn-secondary', () => showUntagModal()), btn('Search', 'resourcegroupstagging-btn-secondary', showSearchModal), btn('Get tag values', 'resourcegroupstagging-btn-secondary', showTagValuesModal), btn('Refresh', 'resourcegroupstagging-btn-secondary', () => refresh().catch((error) => toast(error.message, true)))]; if (state.searchResults) left.push(btn('Clear search', 'resourcegroupstagging-btn-secondary', clearSearch));
    root.append(toolbar(left, [el('span', 'resourcegroupstagging-toolbar-note', 'Tags can reference arbitrary AWS-shaped ARNs')])); const workbench = el('div', 'resourcegroupstagging-workbench'); workbench.append(renderResourceList(), renderDetail(selectedResource())); root.append(workbench); if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
  }
  async function refresh() { const data = await apiJson('/api/resourcegroupstagging/'); state.inventory = data; state.searchResults = null; if (!selectedResource() && resources().length) state.selectedArn = arn(resources()[0]); renderSummary(data.summary || {}); render(); }
  function init() { if (!root) return; root.append(el('p', 'resourcegroupstagging-empty', 'Loading...')); refresh().catch((error) => toast(error.message, true)); }
  return { init, refresh };
})();
window.ResourceGroupsTaggingConsole = ResourceGroupsTaggingConsole;
if (document.getElementById('resourcegroupstagging-console-root')) ResourceGroupsTaggingConsole.init();
