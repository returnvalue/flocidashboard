/* global ServiceConsole */

const SchedulerConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('scheduler-console-root');
  const breadcrumbsEl = document.getElementById('scheduler-breadcrumbs');
  const summaryEl = document.getElementById('scheduler-summary');
  const loadedAtEl = document.getElementById('scheduler-loaded-at');

  const state = {
    inventory: null,
    selectedGroupName: '',
    selectedScheduleName: '',
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'scheduler',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'scheduler');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'scheduler',
      toast,
    });

  function groups() {
    return state.inventory?.groups || [];
  }

  function schedules() {
    return state.inventory?.schedules || [];
  }

  function groupName(group) {
    return group?.name || group?.Name || 'default';
  }

  function scheduleName(schedule) {
    return schedule?.name || schedule?.Name || '';
  }

  function scheduleGroup(schedule) {
    return schedule?.group || schedule?.GroupName || 'default';
  }

  function selectedGroup() {
    return groups().find((group) => groupName(group) === state.selectedGroupName) || groups()[0] || { name: 'default' };
  }

  function selectedGroupName() {
    return groupName(selectedGroup());
  }

  function schedulesForSelectedGroup() {
    const group = selectedGroupName();
    return schedules().filter((schedule) => scheduleGroup(schedule) === group);
  }

  function selectedSchedule() {
    const groupSchedules = schedulesForSelectedGroup();
    return groupSchedules.find((schedule) => scheduleName(schedule) === state.selectedScheduleName) || groupSchedules[0] || null;
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'Scheduler');
    home.addEventListener('click', () => {
      state.selectedGroupName = groups()[0] ? groupName(groups()[0]) : 'default';
      state.selectedScheduleName = '';
      render();
    });
    breadcrumbsEl.append(home);
    const group = selectedGroup();
    breadcrumbsEl.append(el('span', null, '/'), el('span', null, groupName(group)));
    const schedule = selectedSchedule();
    if (schedule) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, scheduleName(schedule)));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'scheduler',
      targets: {
        groups: 'Schedule groups',
        schedules: 'Schedules',
        enabled: 'Schedules',
        disabled: 'Schedules',
      },
    });
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

  function parseJsonValue(value, fallback = null) {
    const trimmed = String(value || '').trim();
    return trimmed ? JSON.parse(trimmed) : fallback;
  }

  function defaultTargetJson() {
    return JSON.stringify({
      Arn: 'arn:aws:lambda:us-east-1:000000000000:function:my-func',
      RoleArn: 'arn:aws:iam::000000000000:role/scheduler-role',
      Input: '{"source":"floci.dashboard"}',
    }, null, 2);
  }

  function scheduleTarget(schedule) {
    return schedule?.target || schedule?.Target || {};
  }

  function flexibleTimeWindow(schedule) {
    return schedule?.flexible_time_window || schedule?.FlexibleTimeWindow || { Mode: 'OFF' };
  }

  function showCreateGroupModal() {
    const form = el('div', 'scheduler-modal-form');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'local-jobs';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '[{"Key":"env","Value":"local"}]';
    form.append(
      el('label', null, 'Group name'),
      nameInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );

    openModal('Create schedule group', form, 'Create group', async (close) => {
      await apiJson('/api/scheduler/groups/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          tags: parseJsonValue(tagsInput.value, []),
        }),
      });
      state.selectedGroupName = nameInput.value.trim();
      close();
      toast('Schedule group created');
      await refresh();
    });
  }

  function showScheduleModal(schedule = null) {
    const isEdit = Boolean(schedule);
    const form = el('div', 'scheduler-modal-form scheduler-modal-form-wide');
    const nameInput = document.createElement('input');
    nameInput.value = scheduleName(schedule);
    nameInput.disabled = isEdit;
    nameInput.placeholder = 'hourly-worker';

    const groupInput = document.createElement('select');
    groups().forEach((group) => groupInput.append(new Option(groupName(group), groupName(group))));
    if (!groups().length) {
      groupInput.append(new Option('default', 'default'));
    }
    groupInput.value = scheduleGroup(schedule) || selectedGroupName();
    groupInput.disabled = isEdit;

    const expressionInput = document.createElement('input');
    expressionInput.value = schedule?.expression || '';
    expressionInput.placeholder = 'rate(5 minutes)';

    const stateInput = document.createElement('select');
    stateInput.append(new Option('Enabled', 'ENABLED'), new Option('Disabled', 'DISABLED'));
    stateInput.value = schedule?.state || 'ENABLED';

    const timezoneInput = document.createElement('input');
    timezoneInput.value = schedule?.timezone || '';
    timezoneInput.placeholder = 'UTC';

    const actionAfterInput = document.createElement('select');
    actionAfterInput.append(new Option('None', ''), new Option('Delete after completion', 'DELETE'));
    actionAfterInput.value = schedule?.action_after_completion || '';

    const descriptionInput = document.createElement('input');
    descriptionInput.value = schedule?.description || '';
    descriptionInput.placeholder = 'Local smoke-test schedule';

    const flexibleInput = document.createElement('textarea');
    flexibleInput.value = JSON.stringify(flexibleTimeWindow(schedule), null, 2);

    const targetInput = document.createElement('textarea');
    targetInput.className = 'scheduler-target-input';
    targetInput.value = schedule ? JSON.stringify(scheduleTarget(schedule), null, 2) : defaultTargetJson();

    form.append(
      el('label', null, 'Schedule name'),
      nameInput,
      el('label', null, 'Group'),
      groupInput,
      el('label', null, 'Expression'),
      expressionInput,
      el('label', null, 'State'),
      stateInput,
      el('label', null, 'Timezone'),
      timezoneInput,
      el('label', null, 'Action after completion'),
      actionAfterInput,
      el('label', null, 'Description'),
      descriptionInput,
      el('label', null, 'Flexible time window JSON'),
      flexibleInput,
      el('label', null, 'Target JSON'),
      targetInput,
    );

    openModal(isEdit ? 'Update schedule' : 'Create schedule', form, isEdit ? 'Update schedule' : 'Create schedule', async (close) => {
      const group = groupInput.value || 'default';
      const name = nameInput.value.trim();
      const path = isEdit
        ? `/api/scheduler/schedules/${encodeURIComponent(group)}/${encodeURIComponent(name)}/`
        : '/api/scheduler/schedules/';
      await apiJson(path, {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify({
          name,
          group_name: group,
          schedule_expression: expressionInput.value.trim(),
          state: stateInput.value,
          timezone: timezoneInput.value.trim(),
          action_after_completion: actionAfterInput.value,
          description: descriptionInput.value.trim(),
          flexible_time_window: parseJsonObject(flexibleInput.value, { Mode: 'OFF' }),
          target: parseJsonObject(targetInput.value),
        }),
      });
      state.selectedGroupName = group;
      state.selectedScheduleName = name;
      close();
      toast(isEdit ? 'Schedule updated' : 'Schedule created');
      await refresh();
    });
  }

  async function deleteGroup(group) {
    const name = groupName(group);
    if (name === 'default') {
      toast('The default group cannot be deleted', true);
      return;
    }
    if (!window.confirm('Delete this schedule group and its schedules?')) {
      return;
    }
    await apiJson(`/api/scheduler/groups/${encodeURIComponent(name)}/`, { method: 'DELETE' });
    state.selectedGroupName = 'default';
    state.selectedScheduleName = '';
    toast('Schedule group deleted');
    await refresh();
  }

  async function deleteSchedule(schedule) {
    if (!window.confirm('Delete this schedule?')) {
      return;
    }
    await apiJson(
      `/api/scheduler/schedules/${encodeURIComponent(scheduleGroup(schedule))}/${encodeURIComponent(scheduleName(schedule))}/`,
      { method: 'DELETE' },
    );
    state.selectedScheduleName = '';
    toast('Schedule deleted');
    await refresh();
  }

  async function setScheduleState(schedule, nextState) {
    await apiJson(
      `/api/scheduler/schedules/${encodeURIComponent(scheduleGroup(schedule))}/${encodeURIComponent(scheduleName(schedule))}/`,
      {
        method: 'PUT',
        body: JSON.stringify({
          schedule_expression: schedule.expression,
          state: nextState,
          timezone: schedule.timezone || '',
          action_after_completion: schedule.action_after_completion || '',
          description: schedule.description || '',
          flexible_time_window: flexibleTimeWindow(schedule),
          target: scheduleTarget(schedule),
        }),
      },
    );
    toast(nextState === 'ENABLED' ? 'Schedule enabled' : 'Schedule disabled');
    await refresh();
  }

  function renderGroupRow(group) {
    const active = groupName(group) === selectedGroupName();
    const row = el('button', `scheduler-group-row${active ? ' scheduler-group-row-active' : ''}`);
    row.append(
      el('span', 'scheduler-group-name', groupName(group)),
      el('span', 'scheduler-group-meta', `${group.schedule_count || 0} schedule${group.schedule_count === 1 ? '' : 's'}`),
    );
    row.addEventListener('click', () => {
      state.selectedGroupName = groupName(group);
      state.selectedScheduleName = '';
      render();
    });
    return row;
  }

  function renderGroupList() {
    const panel = el('section', 'scheduler-panel');
    panel.append(el('div', 'scheduler-panel-heading', 'Schedule groups'));
    const list = el('div', 'scheduler-list');
    const source = groups().length ? groups() : [{ name: 'default', schedule_count: 0 }];
    source.forEach((group) => list.append(renderGroupRow(group)));
    panel.append(list);
    return panel;
  }

  function renderScheduleRow(schedule) {
    const active = scheduleName(schedule) === scheduleName(selectedSchedule());
    const row = el('button', `scheduler-schedule-row${active ? ' scheduler-schedule-row-active' : ''}`);
    row.append(
      el('span', 'scheduler-schedule-name', scheduleName(schedule) || 'Unnamed schedule'),
      el('span', 'scheduler-schedule-meta', `${schedule.state || 'UNKNOWN'} / ${schedule.expression || 'No expression'}`),
    );
    row.addEventListener('click', () => {
      state.selectedScheduleName = scheduleName(schedule);
      render();
    });
    return row;
  }

  function renderScheduleList() {
    const panel = el('section', 'scheduler-panel');
    panel.append(el('div', 'scheduler-panel-heading', 'Schedules'));
    const list = el('div', 'scheduler-list');
    const groupSchedules = schedulesForSelectedGroup();
    if (!groupSchedules.length) {
      list.append(el('div', 'scheduler-empty', 'No schedules found in this group.'));
    } else {
      groupSchedules.forEach((schedule) => list.append(renderScheduleRow(schedule)));
    }
    panel.append(list);
    return panel;
  }

  function renderScheduleDetail(schedule) {
    const panel = el('section', 'scheduler-panel');
    panel.append(el('div', 'scheduler-panel-heading', 'Selected schedule'));
    const body = el('div', 'scheduler-detail');
    if (!schedule) {
      body.append(el('p', 'scheduler-empty-compact', 'Create a schedule to test local timed invocations.'));
      panel.append(body);
      return panel;
    }
    const facts = el('dl', 'scheduler-facts');
    consoleUi.addField(facts, 'Name', scheduleName(schedule));
    consoleUi.addField(facts, 'Group', scheduleGroup(schedule));
    consoleUi.addField(facts, 'State', schedule.state);
    consoleUi.addField(facts, 'Expression', schedule.expression);
    consoleUi.addField(facts, 'Timezone', schedule.timezone || 'UTC');
    consoleUi.addField(facts, 'Action after completion', schedule.action_after_completion);
    consoleUi.addField(facts, 'Target', scheduleTarget(schedule));
    body.append(facts);
    const actions = el('div', 'scheduler-action-row');
    const nextState = schedule.state === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    actions.append(
      btn('Edit schedule', null, () => showScheduleModal(schedule)),
      btn(nextState === 'ENABLED' ? 'Enable' : 'Disable', 'scheduler-btn-secondary', () => setScheduleState(schedule, nextState).catch((error) => toast(error.message, true))),
      btn('Delete schedule', 'scheduler-btn-danger', () => deleteSchedule(schedule).catch((error) => toast(error.message, true))),
    );
    body.append(actions);
    panel.append(body);
    return panel;
  }

  function renderWorkbench() {
    const workbench = el('div', 'scheduler-workbench');
    workbench.append(renderGroupList());
    const stack = el('div', 'scheduler-detail-stack');
    stack.append(renderScheduleList(), renderScheduleDetail(selectedSchedule()));
    workbench.append(stack);
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
        btn('Create group', null, showCreateGroupModal),
        btn('Create schedule', null, () => showScheduleModal()),
        btn('Delete group', 'scheduler-btn-secondary', () => deleteGroup(selectedGroup()).catch((error) => toast(error.message, true))),
      ],
      [el('span', 'scheduler-toolbar-note', 'Local scheduled invocations for SQS, Lambda, SNS, and EventBridge')],
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
    const data = await apiJson('/api/scheduler/');
    state.inventory = data;
    if (!state.selectedGroupName) {
      state.selectedGroupName = groups()[0] ? groupName(groups()[0]) : 'default';
    }
    render();
  }

  return { refresh };
})();

window.SchedulerConsole = SchedulerConsole;
