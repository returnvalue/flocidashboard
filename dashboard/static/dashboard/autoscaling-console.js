/* global ServiceConsole */

const AutoScalingConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('autoscaling-console-root');
  const breadcrumbsEl = document.getElementById('autoscaling-breadcrumbs');
  const summaryEl = document.getElementById('autoscaling-summary');
  const loadedAtEl = document.getElementById('autoscaling-loaded-at');

  const state = {
    inventory: null,
    selectedGroupName: '',
    selectedLaunchConfigName: '',
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'autoscaling',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'autoscaling');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'autoscaling',
      toast,
    });

  function groups() {
    return state.inventory?.groups || [];
  }

  function launchConfigurations() {
    return state.inventory?.launch_configurations || [];
  }

  function selectedGroup() {
    return groups().find((group) => group.name === state.selectedGroupName) || groups()[0] || null;
  }

  function selectedLaunchConfiguration() {
    return launchConfigurations().find((config) => (
      config.LaunchConfigurationName === state.selectedLaunchConfigName
    )) || launchConfigurations()[0] || null;
  }

  function enc(value) {
    return encodeURIComponent(value || '');
  }

  function parseList(value) {
    return value.trim().split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'autoscaling',
      targets: {
        groups: 'Auto Scaling groups',
        instances: 'Auto Scaling groups',
        in_service_instances: 'Auto Scaling groups',
        launch_configurations: 'Launch configurations',
        scaling_policies: 'Scaling policies',
        activities: 'Scaling activities',
        lifecycle_hooks: 'Lifecycle hooks',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = btn('EC2 Auto Scaling', null, () => {
      state.selectedGroupName = '';
      render();
    });
    breadcrumbsEl.append(home);
    const group = selectedGroup();
    if (group) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, group.name || 'Group'));
    }
  }

  function checkbox(label, checked = false) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    const wrapper = el('label', 'autoscaling-checkbox');
    wrapper.append(input, el('span', null, label));
    return { wrapper, input };
  }

  function launchConfigName(config) {
    return config?.LaunchConfigurationName || config?.name || '';
  }

  function option(select, value, label, selected = false) {
    const node = document.createElement('option');
    node.value = value || '';
    node.textContent = label || value || '';
    node.selected = selected;
    select.append(node);
  }

  function showCreateLaunchConfigModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'my-lc';
    const imageInput = document.createElement('input');
    imageInput.placeholder = 'ami-12345678';
    const typeInput = document.createElement('input');
    typeInput.value = 't3.micro';
    const keyInput = document.createElement('input');
    keyInput.placeholder = 'optional key name';
    const groupsInput = document.createElement('textarea');
    groupsInput.placeholder = 'sg-default';
    const profileInput = document.createElement('input');
    profileInput.placeholder = 'optional instance profile';
    const userDataInput = document.createElement('textarea');
    userDataInput.placeholder = '#!/bin/sh\necho hello';
    form.append(
      el('label', null, 'Launch configuration name'),
      nameInput,
      el('label', null, 'Image ID'),
      imageInput,
      el('label', null, 'Instance type'),
      typeInput,
      el('label', null, 'Key name'),
      keyInput,
      el('label', null, 'Security groups'),
      groupsInput,
      el('label', null, 'IAM instance profile'),
      profileInput,
      el('label', null, 'UserData'),
      userDataInput,
    );
    openModal('Create launch configuration', form, 'Create', async (close) => {
      await apiJson('/api/autoscaling/launch-configurations/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          image_id: imageInput.value.trim(),
          instance_type: typeInput.value.trim(),
          key_name: keyInput.value.trim(),
          security_groups: parseList(groupsInput.value),
          iam_instance_profile: profileInput.value.trim(),
          user_data: userDataInput.value,
        }),
      });
      close();
      toast('Launch configuration created');
      state.selectedLaunchConfigName = nameInput.value.trim();
      await refresh();
    });
  }

  function showCreateGroupModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'my-asg';
    const configSelect = document.createElement('select');
    launchConfigurations().forEach((config) => option(configSelect, launchConfigName(config), launchConfigName(config)));
    if (!launchConfigurations().length) {
      option(configSelect, '', 'Create a launch configuration first');
    }
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.value = '1';
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.value = '3';
    const desiredInput = document.createElement('input');
    desiredInput.type = 'number';
    desiredInput.value = '1';
    const zonesInput = document.createElement('input');
    zonesInput.placeholder = 'us-east-1a,us-east-1b';
    const targetGroupsInput = document.createElement('textarea');
    targetGroupsInput.placeholder = 'optional target group ARNs';
    form.append(
      el('label', null, 'Auto Scaling group name'),
      nameInput,
      el('label', null, 'Launch configuration'),
      configSelect,
      el('label', null, 'Min size'),
      minInput,
      el('label', null, 'Max size'),
      maxInput,
      el('label', null, 'Desired capacity'),
      desiredInput,
      el('label', null, 'Availability zones'),
      zonesInput,
      el('label', null, 'Target group ARNs'),
      targetGroupsInput,
    );
    openModal('Create Auto Scaling group', form, 'Create', async (close) => {
      await apiJson('/api/autoscaling/groups/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          launch_configuration_name: configSelect.value,
          min_size: Number(minInput.value || 1),
          max_size: Number(maxInput.value || 1),
          desired_capacity: Number(desiredInput.value || minInput.value || 1),
          availability_zones: parseList(zonesInput.value),
          target_group_arns: parseList(targetGroupsInput.value),
        }),
      });
      close();
      toast('Auto Scaling group created');
      state.selectedGroupName = nameInput.value.trim();
      await refresh();
    });
  }

  function showSetDesiredModal(group) {
    const form = el('div');
    const desiredInput = document.createElement('input');
    desiredInput.type = 'number';
    desiredInput.value = group.desired_capacity ?? group.min_size ?? 1;
    const honor = checkbox('Honor cooldown', false);
    form.append(el('label', null, 'Desired capacity'), desiredInput, honor.wrapper);
    openModal('Set desired capacity', form, 'Scale', async (close) => {
      await apiJson(`/api/autoscaling/groups/${enc(group.name)}/desired-capacity/`, {
        method: 'POST',
        body: JSON.stringify({
          desired_capacity: Number(desiredInput.value),
          honor_cooldown: honor.input.checked,
        }),
      });
      close();
      toast('Desired capacity updated');
      await refresh();
    });
  }

  function showUpdateGroupModal(group) {
    const form = el('div');
    const configSelect = document.createElement('select');
    option(configSelect, '', 'Keep current launch configuration');
    launchConfigurations().forEach((config) => option(
      configSelect,
      launchConfigName(config),
      launchConfigName(config),
      launchConfigName(config) === group.launch_configuration_name,
    ));
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.value = group.min_size ?? '';
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.value = group.max_size ?? '';
    const desiredInput = document.createElement('input');
    desiredInput.type = 'number';
    desiredInput.value = group.desired_capacity ?? '';
    form.append(
      el('label', null, 'Launch configuration'),
      configSelect,
      el('label', null, 'Min size'),
      minInput,
      el('label', null, 'Max size'),
      maxInput,
      el('label', null, 'Desired capacity'),
      desiredInput,
    );
    openModal('Update Auto Scaling group', form, 'Update', async (close) => {
      await apiJson(`/api/autoscaling/groups/${enc(group.name)}/`, {
        method: 'PUT',
        body: JSON.stringify({
          launch_configuration_name: configSelect.value,
          min_size: minInput.value ? Number(minInput.value) : null,
          max_size: maxInput.value ? Number(maxInput.value) : null,
          desired_capacity: desiredInput.value ? Number(desiredInput.value) : null,
        }),
      });
      close();
      toast('Auto Scaling group updated');
      await refresh();
    });
  }

  function showDeleteGroupModal(group) {
    const force = checkbox('Force delete and terminate tracked instances', true);
    const form = el('div');
    form.append(el('p', 'autoscaling-warning', 'Delete this Auto Scaling group?'), el('pre', 'autoscaling-code-block', group.name), force.wrapper);
    openModal('Delete Auto Scaling group', form, 'Delete', async (close) => {
      await apiJson(`/api/autoscaling/groups/${enc(group.name)}/`, {
        method: 'DELETE',
        body: JSON.stringify({ force_delete: force.input.checked }),
      });
      close();
      state.selectedGroupName = '';
      toast('Auto Scaling group deleted');
      await refresh();
    });
  }

  function showAttachInstancesModal(group, detach = false) {
    const form = el('div');
    const idsInput = document.createElement('textarea');
    idsInput.placeholder = 'i-1234567890abcdef0';
    const decrement = checkbox('Decrement desired capacity', false);
    form.append(el('label', null, 'Instance IDs'), idsInput);
    if (detach) {
      form.append(decrement.wrapper);
    }
    openModal(detach ? 'Detach instances' : 'Attach instances', form, detach ? 'Detach' : 'Attach', async (close) => {
      await apiJson(`/api/autoscaling/groups/${enc(group.name)}/instances/`, {
        method: detach ? 'DELETE' : 'POST',
        body: JSON.stringify({
          instance_ids: parseList(idsInput.value),
          decrement_desired_capacity: decrement.input.checked,
        }),
      });
      close();
      toast(detach ? 'Instances detached' : 'Instances attached');
      await refresh();
    });
  }

  function showTerminateInstanceModal(instance) {
    const decrement = checkbox('Decrement desired capacity', false);
    const form = el('div');
    form.append(el('p', 'autoscaling-warning', 'Terminate this Auto Scaling instance?'), el('pre', 'autoscaling-code-block', instance.InstanceId || instance.id), decrement.wrapper);
    openModal('Terminate ASG instance', form, 'Terminate', async (close) => {
      await apiJson(`/api/autoscaling/instances/${enc(instance.InstanceId || instance.id)}/terminate/`, {
        method: 'POST',
        body: JSON.stringify({ decrement_desired_capacity: decrement.input.checked }),
      });
      close();
      toast('Instance termination started');
      await refresh();
    });
  }

  function showTargetGroupsModal(group, detach = false) {
    const form = el('div');
    const arnsInput = document.createElement('textarea');
    arnsInput.value = detach ? (group.target_group_arns || []).join('\n') : '';
    arnsInput.placeholder = 'arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/my-tg/abc123';
    form.append(el('label', null, 'Target group ARNs'), arnsInput);
    openModal(detach ? 'Detach target groups' : 'Attach target groups', form, detach ? 'Detach' : 'Attach', async (close) => {
      await apiJson(`/api/autoscaling/groups/${enc(group.name)}/target-groups/`, {
        method: detach ? 'DELETE' : 'POST',
        body: JSON.stringify({ target_group_arns: parseList(arnsInput.value) }),
      });
      close();
      toast(detach ? 'Target groups detached' : 'Target groups attached');
      await refresh();
    });
  }

  function showLifecycleHookModal(group) {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'launch-wait';
    const transitionInput = document.createElement('input');
    transitionInput.value = 'autoscaling:EC2_INSTANCE_LAUNCHING';
    const resultInput = document.createElement('input');
    resultInput.value = 'CONTINUE';
    const heartbeatInput = document.createElement('input');
    heartbeatInput.type = 'number';
    heartbeatInput.value = '3600';
    form.append(
      el('label', null, 'Hook name'),
      nameInput,
      el('label', null, 'Lifecycle transition'),
      transitionInput,
      el('label', null, 'Default result'),
      resultInput,
      el('label', null, 'Heartbeat timeout seconds'),
      heartbeatInput,
    );
    openModal('Save lifecycle hook', form, 'Save', async (close) => {
      await apiJson(`/api/autoscaling/groups/${enc(group.name)}/lifecycle-hooks/`, {
        method: 'POST',
        body: JSON.stringify({
          hook_name: nameInput.value.trim(),
          transition: transitionInput.value.trim(),
          default_result: resultInput.value.trim(),
          heartbeat_timeout: Number(heartbeatInput.value || 3600),
        }),
      });
      close();
      toast('Lifecycle hook saved');
      await refresh();
    });
  }

  function showScalingPolicyModal(group) {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'scale-out-one';
    const typeInput = document.createElement('input');
    typeInput.value = 'ChangeInCapacity';
    const adjustmentInput = document.createElement('input');
    adjustmentInput.type = 'number';
    adjustmentInput.value = '1';
    const cooldownInput = document.createElement('input');
    cooldownInput.type = 'number';
    cooldownInput.value = '60';
    form.append(
      el('label', null, 'Policy name'),
      nameInput,
      el('label', null, 'Adjustment type'),
      typeInput,
      el('label', null, 'Scaling adjustment'),
      adjustmentInput,
      el('label', null, 'Cooldown seconds'),
      cooldownInput,
    );
    openModal('Save scaling policy', form, 'Save', async (close) => {
      await apiJson(`/api/autoscaling/groups/${enc(group.name)}/policies/`, {
        method: 'POST',
        body: JSON.stringify({
          policy_name: nameInput.value.trim(),
          adjustment_type: typeInput.value.trim(),
          scaling_adjustment: Number(adjustmentInput.value || 1),
          cooldown: Number(cooldownInput.value || 60),
        }),
      });
      close();
      toast('Scaling policy saved');
      await refresh();
    });
  }

  function statusClass(status) {
    return `autoscaling-status autoscaling-status-${String(status || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }

  function renderGroupRow(group) {
    const active = group.name === selectedGroup()?.name;
    const row = el('button', `autoscaling-group-row${active ? ' autoscaling-group-row-active' : ''}`);
    row.append(
      el('span', 'autoscaling-group-name', group.name || 'Auto Scaling group'),
      el('span', 'autoscaling-group-meta', `desired ${group.desired_capacity ?? 0} / in service ${group.in_service_instances ?? 0} / max ${group.max_size ?? 0}`),
    );
    row.addEventListener('click', () => {
      state.selectedGroupName = group.name;
      render();
    });
    return row;
  }

  function renderGroupList() {
    const panel = el('section', 'autoscaling-panel');
    panel.id = consoleUi.sectionIdForLabel('autoscaling', 'Auto Scaling groups');
    panel.append(el('div', 'autoscaling-panel-heading', 'Auto Scaling groups'));
    const list = el('div', 'autoscaling-group-list');
    if (!groups().length) {
      list.append(el('div', 'autoscaling-empty', 'No Auto Scaling groups found. Create a launch configuration, then create a group.'));
    } else {
      groups().forEach((group) => list.append(renderGroupRow(group)));
    }
    panel.append(list);
    return panel;
  }

  function renderGroupDetail(group) {
    const panel = el('section', 'autoscaling-panel');
    const heading = el('div', 'autoscaling-panel-heading');
    heading.append(el('span', null, group ? group.name : 'Group detail'), el('span', 'autoscaling-group-meta', group ? `desired ${group.desired_capacity ?? 0}` : ''));
    panel.append(heading);
    if (!group) {
      panel.append(el('div', 'autoscaling-empty', 'Select or create an Auto Scaling group.'));
      return panel;
    }
    const details = document.createElement('dl');
    consoleUi.addField(details, 'Launch configuration', group.launch_configuration_name);
    consoleUi.addField(details, 'Capacity', `min ${group.min_size} / desired ${group.desired_capacity} / max ${group.max_size}`);
    consoleUi.addField(details, 'Availability zones', group.availability_zones || []);
    consoleUi.addField(details, 'Target groups', group.target_group_arns || []);
    consoleUi.addField(details, 'Created', consoleUi.formatDate(group.created_time));
    consoleUi.addField(details, 'Tags', group.tags || []);
    panel.append(details);
    return panel;
  }

  function renderInstances(group) {
    const panel = el('section', 'autoscaling-panel');
    panel.append(el('div', 'autoscaling-panel-heading', 'Tracked instances'));
    const items = group?.instances || [];
    if (!items.length) {
      panel.append(el('div', 'autoscaling-empty autoscaling-empty-compact', 'No tracked instances yet. The reconciler may still be launching capacity.'));
      return panel;
    }
    const list = el('div', 'autoscaling-card-list');
    items.forEach((instance) => {
      const card = el('article', 'autoscaling-card');
      card.append(
        el('strong', null, instance.InstanceId || instance.id || 'Instance'),
        el('span', statusClass(instance.LifecycleState), instance.LifecycleState || 'UNKNOWN'),
        el('span', 'autoscaling-group-meta', instance.HealthStatus || ''),
      );
      const actions = el('div', 'autoscaling-inline-actions');
      actions.append(btn('Terminate', 'autoscaling-btn-danger', () => showTerminateInstanceModal(instance)));
      card.append(actions);
      list.append(card);
    });
    panel.append(list);
    return panel;
  }

  function renderLaunchConfigurations() {
    const panel = el('section', 'autoscaling-panel');
    panel.id = consoleUi.sectionIdForLabel('autoscaling', 'Launch configurations');
    panel.append(el('div', 'autoscaling-panel-heading', 'Launch configurations'));
    if (!launchConfigurations().length) {
      panel.append(el('div', 'autoscaling-empty autoscaling-empty-compact', 'No launch configurations found.'));
      return panel;
    }
    const list = el('div', 'autoscaling-card-list');
    launchConfigurations().forEach((config) => {
      const card = el('article', 'autoscaling-card');
      card.append(
        el('strong', null, launchConfigName(config)),
        el('span', 'autoscaling-group-meta', `${config.ImageId || ''} / ${config.InstanceType || ''}`),
        el('span', 'autoscaling-group-meta', config.IamInstanceProfile || ''),
      );
      list.append(card);
    });
    panel.append(list);
    return panel;
  }

  function renderActivities(group) {
    const panel = el('section', 'autoscaling-panel');
    panel.id = consoleUi.sectionIdForLabel('autoscaling', 'Scaling activities');
    panel.append(el('div', 'autoscaling-panel-heading', 'Recent scaling activities'));
    const items = group?.activities || state.inventory?.activities || [];
    if (!items.length) {
      panel.append(el('div', 'autoscaling-empty autoscaling-empty-compact', 'No scaling activities recorded yet.'));
      return panel;
    }
    const list = el('div', 'autoscaling-card-list');
    items.slice(0, 20).forEach((activity) => {
      const card = el('article', 'autoscaling-card');
      card.append(
        el('strong', null, activity.Description || activity.ActivityId || 'Scaling activity'),
        el('span', statusClass(activity.StatusCode), activity.StatusCode || ''),
        el('span', 'autoscaling-group-meta', activity.Cause || ''),
      );
      list.append(card);
    });
    panel.append(list);
    return panel;
  }

  function renderPoliciesAndHooks(group) {
    const panel = el('section', 'autoscaling-panel');
    panel.append(el('div', 'autoscaling-panel-heading', 'Policies and lifecycle hooks'));
    const content = el('div', 'autoscaling-split');
    content.append(el('pre', 'autoscaling-code-block', consoleUi.valueText({
      policies: group?.policies || [],
      lifecycle_hooks: group?.lifecycle_hooks || [],
    })));
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const group = selectedGroup();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create launch config', null, showCreateLaunchConfigModal),
        btn('Create group', null, showCreateGroupModal),
      ],
      [
        btn('Scale', null, () => group && showSetDesiredModal(group)),
        btn('Update group', null, () => group && showUpdateGroupModal(group)),
        btn('Attach instances', null, () => group && showAttachInstancesModal(group, false)),
        btn('Detach instances', null, () => group && showAttachInstancesModal(group, true)),
        btn('Target groups', null, () => group && showTargetGroupsModal(group, false)),
        btn('Lifecycle hook', null, () => group && showLifecycleHookModal(group)),
        btn('Scaling policy', null, () => group && showScalingPolicyModal(group)),
        btn('Delete group', 'autoscaling-btn-danger', () => group && showDeleteGroupModal(group)),
      ],
    ));
    Array.from(container.querySelectorAll('.autoscaling-toolbar-right button')).forEach((button) => {
      button.disabled = !group;
    });
    const workbench = el('div', 'autoscaling-workbench');
    const detail = el('div', 'autoscaling-detail-stack');
    detail.append(
      renderGroupDetail(group),
      renderInstances(group),
      renderLaunchConfigurations(),
      renderActivities(group),
      renderPoliciesAndHooks(group),
    );
    workbench.append(renderGroupList(), detail);
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
    const data = await apiJson('/api/autoscaling/');
    state.inventory = data;
    if (!selectedGroup() && groups().length) {
      state.selectedGroupName = groups()[0].name;
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'autoscaling-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.AutoScalingConsole = AutoScalingConsole;

if (document.getElementById('autoscaling-console-root')) {
  AutoScalingConsole.init();
}
