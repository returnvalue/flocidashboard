/* global ServiceConsole */

const SchedulerConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('scheduler-console-root');
  const breadcrumbsEl = document.getElementById('scheduler-breadcrumbs');
  const summaryEl = document.getElementById('scheduler-summary');
  const loadedAtEl = document.getElementById('scheduler-loaded-at');
  const params = new URLSearchParams(window.location.search);
  const state = {
    inventory: null,
    activeView: params.get('view') === 'schedules' ? 'schedules' : 'groups',
    selectedGroupName: params.get('group') || 'default',
    selectedScheduleName: params.get('schedule') || '',
    filters: { groups: '', schedules: '' },
    filterFocus: {},
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, { classPrefix: 'scheduler', type: isError ? 'error' : 'success' });
  const toolbar = (left, right) => consoleUi.toolbar(left, right, 'scheduler');
  const openModal = (title, body, label, submit) => consoleUi.openModal(title, body, label, submit, { classPrefix: 'scheduler', toast });

  const groups = () => state.inventory?.groups || [];
  const schedules = () => state.inventory?.schedules || [];
  const groupName = (group) => group?.name || group?.Name || 'default';
  const scheduleName = (schedule) => schedule?.name || schedule?.Name || '';
  const scheduleGroup = (schedule) => schedule?.group || schedule?.GroupName || 'default';
  const selectedGroup = () => groups().find((group) => groupName(group) === state.selectedGroupName) || groups()[0] || null;
  const selectedSchedule = () => schedules().find((schedule) => scheduleGroup(schedule) === state.selectedGroupName && scheduleName(schedule) === state.selectedScheduleName) || null;
  const scheduleTarget = (schedule) => schedule?.target || schedule?.Target || {};
  const flexibleTimeWindow = (schedule) => schedule?.flexible_time_window || schedule?.FlexibleTimeWindow || { Mode: 'OFF' };

  function urlFor(view, values = {}) {
    const query = new URLSearchParams(); query.set('view', view);
    if (values.group) query.set('group', values.group);
    if (values.schedule) query.set('schedule', values.schedule);
    return `${window.location.pathname}?${query}`;
  }

  function syncUrl() {
    window.history.replaceState({}, '', urlFor(state.activeView, { group: state.selectedGroupName, schedule: state.selectedScheduleName }));
  }

  function choose(view, group = '', schedule = '') {
    state.activeView = view;
    if (group) state.selectedGroupName = group;
    state.selectedScheduleName = schedule;
    syncUrl(); render();
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, { serviceKey: 'scheduler', targets: { groups: 'Schedule groups', schedules: 'Schedules', enabled: 'Schedules', disabled: 'Schedules' } });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) return;
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('EventBridge Scheduler', null, () => choose('groups')));
    breadcrumbsEl.append(el('span', null, '/'), el('span', null, state.activeView === 'groups' ? 'Schedule groups' : 'Schedules'));
    if (state.activeView === 'schedules' && state.selectedGroupName) breadcrumbsEl.append(el('span', null, '/'), el('span', null, state.selectedGroupName));
    if (state.activeView === 'schedules' && state.selectedScheduleName) breadcrumbsEl.append(el('span', null, '/'), el('span', null, state.selectedScheduleName));
  }

  function parseObject(value, fallback = null, label = 'Value') {
    const text = String(value || '').trim();
    if (!text) return fallback;
    let parsed;
    try { parsed = JSON.parse(text); } catch (error) { throw new Error(`${label} must be valid JSON`); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${label} must be a JSON object`);
    return parsed;
  }

  function parseValue(value, fallback = null, label = 'Value') {
    const text = String(value || '').trim();
    if (!text) return fallback;
    try { return JSON.parse(text); } catch (error) { throw new Error(`${label} must be valid JSON`); }
  }

  async function request(path, method, body, message) {
    const result = await apiJson(path, { method, body: body === null ? undefined : JSON.stringify(body) });
    toast(message); await refresh(); return result;
  }

  function defaultTargetJson() {
    return JSON.stringify({ Arn: 'arn:aws:lambda:us-east-1:000000000000:function:my-func', RoleArn: 'arn:aws:iam::000000000000:role/scheduler-role', Input: '{"source":"floci.dashboard"}' }, null, 2);
  }

  function showCreateGroupModal() {
    const form = el('div', 'scheduler-modal-form');
    const name = document.createElement('input'); name.placeholder = 'local-jobs';
    const tags = document.createElement('textarea'); tags.placeholder = '[{"Key":"env","Value":"local"}]';
    form.append(el('label', null, 'Group name'), name, el('label', null, 'Tags JSON'), tags);
    openModal('Create schedule group', form, 'Create group', async (close) => {
      const cleanName = name.value.trim();
      await request('/api/scheduler/groups/', 'POST', { name: cleanName, tags: parseValue(tags.value, [], 'Tags') }, `Schedule group ${cleanName} created`);
      close(); choose('groups', cleanName);
    });
  }

  function showTagsModal(group) {
    const form = el('div', 'scheduler-modal-form');
    const arn = document.createElement('input'); arn.value = group?.arn || '';
    const tags = document.createElement('textarea'); tags.placeholder = '[{"Key":"env","Value":"local"}]';
    const keys = document.createElement('input'); keys.placeholder = 'env,owner';
    form.append(el('label', null, 'Schedule group ARN'), arn, el('label', null, 'Add tags JSON'), tags,
      btn('Add tags', null, async () => { try { await request('/api/scheduler/tags/', 'POST', { resource_arn: arn.value.trim(), tags: parseValue(tags.value, [], 'Tags') }, 'Group tags saved'); } catch (error) { toast(error.message, true); } }),
      el('label', null, 'Remove tag keys'), keys,
      btn('Remove tags', 'scheduler-btn-secondary', async () => { try { await request('/api/scheduler/tags/', 'DELETE', { resource_arn: arn.value.trim(), tag_keys: keys.value.split(',').map((item) => item.trim()).filter(Boolean) }, 'Group tags removed'); } catch (error) { toast(error.message, true); } }));
    openModal('Manage group tags', form, 'Close', (close) => close());
  }

  function showScheduleModal(schedule = null) {
    const edit = Boolean(schedule);
    const form = el('div', 'scheduler-modal-form scheduler-modal-form-wide');
    const name = document.createElement('input'); name.value = scheduleName(schedule); name.disabled = edit; name.placeholder = 'hourly-worker';
    const group = document.createElement('select');
    (groups().length ? groups() : [{ name: 'default' }]).forEach((item) => group.append(new Option(groupName(item), groupName(item))));
    group.value = scheduleGroup(schedule) || state.selectedGroupName || 'default'; group.disabled = edit;
    const expression = document.createElement('input'); expression.value = schedule?.expression || ''; expression.placeholder = 'rate(5 minutes)';
    const scheduleState = document.createElement('select'); scheduleState.append(new Option('Enabled', 'ENABLED'), new Option('Disabled', 'DISABLED')); scheduleState.value = schedule?.state || 'ENABLED';
    const timezone = document.createElement('input'); timezone.value = schedule?.timezone || ''; timezone.placeholder = 'UTC';
    const startDate = document.createElement('input'); startDate.value = schedule?.start_date || ''; startDate.placeholder = 'Optional ISO 8601 start';
    const endDate = document.createElement('input'); endDate.value = schedule?.end_date || ''; endDate.placeholder = 'Optional ISO 8601 end';
    const completion = document.createElement('select'); completion.append(new Option('None', ''), new Option('Delete after completion', 'DELETE')); completion.value = schedule?.action_after_completion || '';
    const description = document.createElement('input'); description.value = schedule?.description || '';
    const kms = document.createElement('input'); kms.value = schedule?.kms_key_arn || ''; kms.placeholder = 'Optional KMS key ARN';
    const flexible = document.createElement('textarea'); flexible.value = JSON.stringify(flexibleTimeWindow(schedule), null, 2);
    const target = document.createElement('textarea'); target.className = 'scheduler-target-input'; target.value = schedule ? JSON.stringify(scheduleTarget(schedule), null, 2) : defaultTargetJson();
    [[name, 'Schedule name'], [group, 'Group'], [expression, 'Expression'], [scheduleState, 'State'], [timezone, 'Timezone'], [startDate, 'Start date'], [endDate, 'End date'], [completion, 'Action after completion'], [description, 'Description'], [kms, 'KMS key ARN'], [flexible, 'Flexible time window JSON'], [target, 'Target JSON']].forEach(([input, label]) => form.append(el('label', null, label), input));
    openModal(edit ? 'Update schedule' : 'Create schedule', form, edit ? 'Update schedule' : 'Create schedule', async (close) => {
      const groupNameValue = group.value || 'default'; const nameValue = name.value.trim();
      const path = edit ? `/api/scheduler/schedules/${encodeURIComponent(groupNameValue)}/${encodeURIComponent(nameValue)}/` : '/api/scheduler/schedules/';
      await request(path, edit ? 'PUT' : 'POST', {
        name: nameValue, group_name: groupNameValue, schedule_expression: expression.value.trim(), state: scheduleState.value,
        timezone: timezone.value.trim(), start_date: startDate.value.trim() || null, end_date: endDate.value.trim() || null,
        action_after_completion: completion.value, description: description.value.trim(), kms_key_arn: kms.value.trim(),
        flexible_time_window: parseObject(flexible.value, { Mode: 'OFF' }, 'Flexible time window'), target: parseObject(target.value, null, 'Target'),
      }, edit ? `Schedule ${nameValue} updated` : `Schedule ${nameValue} created`);
      close(); choose('schedules', groupNameValue, nameValue);
    });
  }

  async function deleteGroup(group) {
    const name = groupName(group);
    if (name === 'default') { toast('The default group cannot be deleted', true); return; }
    if (!window.confirm(`Delete schedule group ${name} and all schedules in it?`)) return;
    await request(`/api/scheduler/groups/${encodeURIComponent(name)}/`, 'DELETE', null, `Schedule group ${name} deleted`);
    choose('groups', 'default');
  }

  async function deleteSchedule(schedule) {
    if (!window.confirm(`Delete schedule ${scheduleName(schedule)}?`)) return;
    await request(`/api/scheduler/schedules/${encodeURIComponent(scheduleGroup(schedule))}/${encodeURIComponent(scheduleName(schedule))}/`, 'DELETE', null, `Schedule ${scheduleName(schedule)} deleted`);
    choose('schedules', scheduleGroup(schedule));
  }

  async function setScheduleState(schedule, nextState) {
    await request(`/api/scheduler/schedules/${encodeURIComponent(scheduleGroup(schedule))}/${encodeURIComponent(scheduleName(schedule))}/`, 'PUT', {
      schedule_expression: schedule.expression, state: nextState, timezone: schedule.timezone || '', start_date: schedule.start_date || null,
      end_date: schedule.end_date || null, action_after_completion: schedule.action_after_completion || '', description: schedule.description || '',
      kms_key_arn: schedule.kms_key_arn || '', flexible_time_window: flexibleTimeWindow(schedule), target: scheduleTarget(schedule),
    }, `Schedule ${scheduleName(schedule)} ${nextState === 'ENABLED' ? 'enabled' : 'disabled'}`);
  }

  function setFilter(view, value, focus) { state.filters[view] = value; state.filterFocus[view] = focus; render(); }

  function collection(view, title, items, columns, href, actions) {
    const focus = state.filterFocus[view] || {};
    return consoleUi.renderCollection({
      title, items, mode: 'table', columns, primaryColumn: columns[0], primaryHref: href, itemKey: (item) => href(item),
      classPrefix: 'scheduler', filterText: state.filters[view], filterPlaceholder: `Find ${title.toLowerCase()}`,
      countLabel: title.toLowerCase(), actions, lastUpdatedLabel: loadedAtEl?.textContent || '', restoreFocus: focus.restoreFocus,
      selectionStart: focus.selectionStart, selectionEnd: focus.selectionEnd, onFilterTextChange: (value, options) => setFilter(view, value, options),
    });
  }

  function header(title, subtitle, status = '') {
    const node = el('div', 'scheduler-detail-header'); const text = el('div');
    text.append(el('p', 'eyebrow', subtitle), el('h3', null, title)); node.append(text);
    if (status) node.append(el('span', `scheduler-state scheduler-state-${status.toLowerCase()}`, status));
    return node;
  }

  function facts(fields) { const list = el('dl', 'scheduler-facts'); fields.forEach(([label, value]) => consoleUi.addField(list, label, value)); return list; }

  function destination(target) {
    const arn = target?.Arn || ''; const parts = arn.split(':'); const service = parts[2]; const resource = parts.slice(5).join(':');
    if (service === 'sqs') return { label: 'Open queue in SQS', href: `/service/sqs/?queue=${encodeURIComponent(resource)}` };
    if (service === 'lambda') return { label: 'Open function in Lambda', href: `/service/lambda/?function=${encodeURIComponent(resource.replace(/^function:/, ''))}` };
    if (service === 'sns') return { label: 'Open topic in SNS', href: `/service/sns/?topic=${encodeURIComponent(arn)}` };
    if (service === 'events') return { label: 'Open EventBridge', href: '/service/eventbridge/?view=send' };
    if (service === 'ecs') return { label: 'Open ECS', href: '/service/ecs/' };
    return null;
  }

  function renderGroups() {
    const page = el('div', 'scheduler-resource-page');
    page.append(collection('groups', 'Schedule groups', groups(), [
      { label: 'Name', key: 'name', primary: true }, { label: 'State', key: 'state' }, { label: 'Schedules', key: 'schedule_count' },
      { label: 'Created', key: 'created' }, { label: 'Last modified', key: 'last_modified' },
    ], (group) => urlFor('groups', { group: groupName(group) }), [btn('Create schedule group', null, showCreateGroupModal)]));
    const group = selectedGroup();
    if (group) {
      const detail = el('section', 'scheduler-detail-panel'); detail.append(header(groupName(group), 'Schedule group', group.state));
      const actions = el('div', 'scheduler-action-row');
      actions.append(btn('Create schedule', null, () => showScheduleModal()), btn('Manage tags', 'scheduler-btn-secondary', () => showTagsModal(group)), btn('View schedules', 'scheduler-btn-secondary', () => choose('schedules', groupName(group))));
      if (groupName(group) !== 'default') actions.append(btn('Delete group', 'scheduler-btn-danger', () => deleteGroup(group).catch((error) => toast(error.message, true))));
      detail.append(actions, facts([['ARN', group.arn], ['State', group.state], ['Schedule count', group.schedule_count], ['Created', group.created], ['Last modified', group.last_modified]]));
      page.append(detail);
    }
    return page;
  }

  function renderSchedules() {
    const page = el('div', 'scheduler-resource-page');
    page.append(collection('schedules', 'Schedules', schedules(), [
      { label: 'Name', key: 'name', primary: true }, { label: 'Group', key: 'group' }, { label: 'State', key: 'state' },
      { label: 'Expression', key: 'expression' }, { label: 'Timezone', key: 'timezone' }, { label: 'Target', value: (schedule) => scheduleTarget(schedule).Arn || '' },
    ], (schedule) => urlFor('schedules', { group: scheduleGroup(schedule), schedule: scheduleName(schedule) }), [btn('Create schedule', null, () => showScheduleModal())]));
    const schedule = selectedSchedule();
    if (schedule) {
      const detail = el('section', `scheduler-detail-panel${params.get('schedule') === scheduleName(schedule) ? ' scheduler-schedule-requested' : ''}`);
      detail.append(header(scheduleName(schedule), `Schedule in ${scheduleGroup(schedule)}`, schedule.state));
      const actions = el('div', 'scheduler-action-row'); const nextState = schedule.state === 'ENABLED' ? 'DISABLED' : 'ENABLED';
      actions.append(btn('Edit schedule', null, () => showScheduleModal(schedule)), btn(nextState === 'ENABLED' ? 'Enable' : 'Disable', 'scheduler-btn-secondary', () => setScheduleState(schedule, nextState).catch((error) => toast(error.message, true))), btn('Delete schedule', 'scheduler-btn-danger', () => deleteSchedule(schedule).catch((error) => toast(error.message, true))));
      const link = destination(scheduleTarget(schedule));
      if (link) { const anchor = el('a', 'scheduler-resource-link', link.label); anchor.href = link.href; actions.append(anchor); }
      detail.append(actions, facts([['ARN', schedule.arn], ['Expression', schedule.expression], ['Timezone', schedule.timezone || 'UTC'], ['Start date', schedule.start_date], ['End date', schedule.end_date], ['Action after completion', schedule.action_after_completion], ['Description', schedule.description], ['KMS key ARN', schedule.kms_key_arn], ['Flexible time window', flexibleTimeWindow(schedule)], ['Target', scheduleTarget(schedule)], ['Created', schedule.created], ['Last modified', schedule.last_modified]]));
      const boundary = el('p', 'scheduler-boundary-note', 'Floci invokes SQS, Lambda, SNS, ECS RunTask, and EventBridge targets. Retry policy and dead-letter configuration are stored but are not currently enforced; flexible-window jitter is deterministic locally.');
      detail.append(boundary); page.append(detail);
    }
    return page;
  }

  function render() {
    if (!root) return;
    renderBreadcrumbs(); root.textContent = '';
    const tabs = el('nav', 'scheduler-resource-tabs');
    [['groups', 'Schedule groups'], ['schedules', 'Schedules']].forEach(([view, label]) => tabs.append(btn(label, state.activeView === view ? 'scheduler-tab-active' : 'scheduler-btn-secondary', () => choose(view, state.selectedGroupName))));
    const lab = el('a', 'scheduler-lab-link', 'Open SQS delivery lab'); lab.href = '/service/scheduler/labs/?lab=sqs-delivery';
    root.append(toolbar([tabs], [btn('Refresh', 'scheduler-btn-secondary', refresh), lab]));
    root.append(state.activeView === 'schedules' ? renderSchedules() : renderGroups());
  }

  async function refresh() {
    state.inventory = await apiJson('/api/scheduler/');
    if (!groups().some((group) => groupName(group) === state.selectedGroupName)) state.selectedGroupName = groupName(groups()[0]) || 'default';
    if (state.selectedScheduleName && !selectedSchedule()) state.selectedScheduleName = '';
    renderSummary(state.inventory.summary || {});
    if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
    syncUrl(); render();
  }

  function init() { if (!root) return; root.append(el('div', 'scheduler-empty', 'Loading Scheduler resources...')); refresh().catch((error) => toast(error.message, true)); }
  return { init, refresh };
})();

window.SchedulerConsole = SchedulerConsole;
if (document.getElementById('scheduler-console-root')) SchedulerConsole.init();
