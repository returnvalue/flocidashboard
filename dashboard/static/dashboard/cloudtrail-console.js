/* global ServiceConsole */

(() => {
  const ui = window.ServiceConsole;
  const root = document.getElementById('cloudtrail-console-root');
  if (!ui || !root) return;
  const summaryEl = document.getElementById('cloudtrail-summary');
  const loadedAtEl = document.getElementById('cloudtrail-loaded-at');
  const breadcrumbsEl = document.getElementById('cloudtrail-breadcrumbs');
  const state = { inventory: null, selected: '', query: '', tab: 'overview' };
  const el = ui.el;
  const button = ui.button;
  const toast = (message, error = false) => ui.toast(message, { classPrefix: 'cloudtrail', type: error ? 'error' : 'success' });
  const modal = (title, body, label, confirm) => ui.openModal(title, body, label, confirm, { classPrefix: 'cloudtrail', toast });

  const trails = () => state.inventory?.trails || [];
  const selected = () => trails().find((trail) => trail.name === state.selected) || trails()[0] || null;
  const path = (trail) => encodeURIComponent(trail.name);
  const truth = (value) => value ? 'Yes' : 'No';
  const status = (trail) => trail.status || {};

  function field(label, value) {
    return [el('dt', null, label), el('dd', null, value ?? '—')];
  }

  function checkbox(label, checked = false) {
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = checked;
    const wrapper = el('label', 'cloudtrail-check'); wrapper.append(input, el('span', null, label));
    return { wrapper, input };
  }

  function createModal() {
    const form = el('div', 'cloudtrail-form');
    const name = document.createElement('input'); name.placeholder = 'local-audit';
    const bucket = document.createElement('input'); bucket.placeholder = 'local-audit-logs';
    const global = checkbox('Include global service events', true);
    const multi = checkbox('Multi-Region trail');
    const organization = checkbox('Organization trail');
    form.append(el('label', null, 'Trail name'), name, el('label', null, 'S3 bucket name'), bucket, global.wrapper, multi.wrapper, organization.wrapper);
    modal('Create trail', form, 'Create trail', async (close) => {
      await ui.apiJson('/api/cloudtrail/trails/', { method: 'POST', body: JSON.stringify({ name: name.value.trim(), s3_bucket_name: bucket.value.trim(), include_global_service_events: global.input.checked, is_multi_region_trail: multi.input.checked, is_organization_trail: organization.input.checked }) });
      state.selected = name.value.trim(); close(); toast('Trail created'); await refresh();
    });
  }

  function updateModal(trail) {
    const form = el('div', 'cloudtrail-form');
    const bucket = document.createElement('input'); bucket.value = trail.s3_bucket_name || '';
    const global = checkbox('Include global service events', trail.include_global_service_events);
    const multi = checkbox('Multi-Region trail', trail.is_multi_region_trail);
    form.append(el('label', null, 'S3 bucket name'), bucket, global.wrapper, multi.wrapper);
    modal(`Update ${trail.name}`, form, 'Save changes', async (close) => {
      await ui.apiJson(`/api/cloudtrail/trails/${path(trail)}/`, { method: 'PATCH', body: JSON.stringify({ s3_bucket_name: bucket.value.trim(), include_global_service_events: global.input.checked, is_multi_region_trail: multi.input.checked }) });
      close(); toast('Trail updated'); await refresh();
    });
  }

  function deleteModal(trail) {
    const body = el('div', 'cloudtrail-form', `Delete ${trail.name}? This removes the persisted trail configuration.`);
    modal('Delete trail', body, 'Delete trail', async (close) => {
      await ui.apiJson(`/api/cloudtrail/trails/${path(trail)}/`, { method: 'DELETE' });
      state.selected = ''; close(); toast('Trail deleted'); await refresh();
    });
  }

  async function toggleLogging(trail) {
    const enabled = !status(trail).IsLogging;
    await ui.apiJson(`/api/cloudtrail/trails/${path(trail)}/logging/`, { method: 'POST', body: JSON.stringify({ enabled }) });
    toast(enabled ? 'Logging started' : 'Logging stopped'); await refresh();
  }

  function renderList() {
    const panel = el('section', 'cloudtrail-panel');
    panel.append(el('div', 'cloudtrail-panel-heading', `Trails (${trails().length})`));
    const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Filter trails'; search.value = state.query;
    search.addEventListener('input', () => { state.query = search.value; render(); });
    panel.append(search);
    const list = el('div', 'cloudtrail-list');
    const filtered = trails().filter((trail) => JSON.stringify(trail).toLowerCase().includes(state.query.toLowerCase()));
    if (!filtered.length) list.append(el('div', 'cloudtrail-empty', trails().length ? 'No matching trails.' : 'No trails yet. Create one to begin.'));
    filtered.forEach((trail) => {
      const row = el('button', `cloudtrail-row${selected()?.name === trail.name ? ' cloudtrail-row-active' : ''}`);
      row.type = 'button'; row.append(el('strong', null, trail.name), el('span', null, `${status(trail).IsLogging ? 'Logging' : 'Stopped'} · ${trail.home_region || 'local region'}`));
      row.addEventListener('click', () => { state.selected = trail.name; render(); }); list.append(row);
    }); panel.append(list); return panel;
  }

  function renderDetail(trail) {
    const stack = el('div', 'cloudtrail-detail-stack');
    if (!trail) { stack.append(el('section', 'cloudtrail-panel cloudtrail-empty', 'Create or select a trail to inspect its configuration.')); return stack; }
    const tabs = el('div', 'cloudtrail-tabs');
    ['overview', 'configuration', 'events'].forEach((name) => {
      const tab = button(name[0].toUpperCase() + name.slice(1), state.tab === name ? 'cloudtrail-btn-active' : 'cloudtrail-btn-secondary', () => { state.tab = name; render(); });
      tabs.append(tab);
    }); stack.append(tabs);
    const panel = el('section', 'cloudtrail-panel');
    const heading = el('div', 'cloudtrail-panel-heading'); heading.append(el('span', null, trail.name));
    const actions = el('div', 'cloudtrail-actions');
    const logging = button(status(trail).IsLogging ? 'Stop logging' : 'Start logging', 'cloudtrail-btn-secondary', () => toggleLogging(trail).catch((e) => toast(e.message, true)));
    const update = button('Edit', 'cloudtrail-btn-secondary', () => updateModal(trail));
    const remove = button('Delete', 'cloudtrail-btn-danger', () => deleteModal(trail));
    actions.append(logging, update, remove); heading.append(actions); panel.append(heading);
    const content = el('div', 'cloudtrail-detail');
    if (state.tab === 'events') {
      content.append(el('h3', null, 'Event lookup'), el('div', 'cloudtrail-callout', 'Floci accepts LookupEvents polling but does not record live API activity. Event results are therefore empty by design.'));
    } else {
      const dl = el('dl');
      if (state.tab === 'overview') dl.append(...field('Logging', status(trail).IsLogging ? 'Active' : 'Stopped'), ...field('Latest delivery time', status(trail).LatestDeliveryTime || 'No delivery recorded'), ...field('Home Region', trail.home_region), ...field('Trail ARN', trail.arn));
      else dl.append(...field('S3 bucket', trail.s3_bucket_name), ...field('Global service events', truth(trail.include_global_service_events)), ...field('Multi-Region', truth(trail.is_multi_region_trail)), ...field('Organization trail', truth(trail.is_organization_trail)));
      content.append(dl);
      if (state.tab === 'configuration' && trail.s3_bucket_name) { const link = el('a', 'cloudtrail-service-link', 'Open bucket in S3'); link.href = `/service/s3/?bucket=${encodeURIComponent(trail.s3_bucket_name)}`; content.append(link); }
    }
    panel.append(content); stack.append(panel); return stack;
  }

  function render() {
    const trail = selected(); if (trail && !state.selected) state.selected = trail.name;
    root.textContent = ''; const bar = el('div', 'cloudtrail-toolbar');
    const create = button('Create trail', null, createModal);
    const reload = button('Refresh', 'cloudtrail-btn-secondary', () => refresh().catch((e) => toast(e.message, true)));
    bar.append(create, reload); root.append(bar);
    const workbench = el('div', 'cloudtrail-workbench'); workbench.append(renderList(), renderDetail(trail)); root.append(workbench);
    if (breadcrumbsEl) { breadcrumbsEl.textContent = ''; breadcrumbsEl.append(el('span', null, 'CloudTrail'), ...(trail ? [el('span', null, '/'), el('strong', null, trail.name)] : [])); }
  }

  async function refresh() {
    state.inventory = await ui.apiJson('/api/cloudtrail/');
    if (state.selected && !trails().some((trail) => trail.name === state.selected)) state.selected = '';
    ui.renderSummary(state.inventory.summary || {}, summaryEl, { serviceKey: 'cloudtrail', targets: { trails: 'Trails', logging: 'Trails', multi_region_trails: 'Trails', lookup_events: 'Events' } });
    if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
    render();
  }

  refresh().catch((error) => { root.textContent = error.message; toast(error.message, true); });
})();
