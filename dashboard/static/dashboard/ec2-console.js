/* global ServiceConsole */

const EC2Console = (() => {
  const ui = window.ServiceConsole;
  const root = document.getElementById('ec2-console-root');
  const breadcrumbsEl = document.getElementById('ec2-breadcrumbs');
  const summaryEl = document.getElementById('ec2-summary');
  const loadedAtEl = document.getElementById('ec2-loaded-at');
  const transitionalStates = new Set(['pending', 'stopping', 'shutting-down']);
  const activeCommandStates = new Set(['Pending', 'InProgress', 'Delayed']);

  const state = {
    inventory: null,
    view: 'overview',
    selectedInstanceId: '',
    selectedIds: new Set(),
    filter: '',
    commands: [],
    activeCommand: null,
    refreshTimer: null,
    commandTimer: null,
    loading: false,
    advancedSection: 'nacls',
  };

  const el = ui.el;
  const btn = ui.button;
  const apiJson = ui.apiJson;
  const toast = (message, isError = false) => ui.toast(message, {
    classPrefix: 'ec2',
    type: isError ? 'error' : 'success',
  });

  function instances() { return state.inventory?.instances || []; }
  function images() { return state.inventory?.images || []; }
  function instanceTypes() { return state.inventory?.instance_types || []; }
  function subnets() { return state.inventory?.subnets || []; }
  function securityGroups() { return state.inventory?.security_groups || []; }
  function keyPairs() { return state.inventory?.key_pairs || []; }
  function vpcs() { return state.inventory?.vpcs || []; }
  function routeTables() { return state.inventory?.route_tables || []; }
  function internetGateways() { return state.inventory?.internet_gateways || []; }
  function elasticIps() { return state.inventory?.addresses || []; }
  function natGateways() { return state.inventory?.nat_gateways || []; }
  function vpcEndpoints() { return state.inventory?.vpc_endpoints || []; }
  function networkAcls() { return state.inventory?.network_acls || []; }
  function flowLogs() { return state.inventory?.flow_logs || []; }
  function volumes() { return state.inventory?.volumes || []; }
  function snapshots() { return state.inventory?.snapshots || []; }
  function launchTemplates() { return state.inventory?.launch_templates || []; }
  function launchTemplateVersions() { return state.inventory?.launch_template_versions || []; }
  function spotRequests() { return state.inventory?.spot_instance_requests || []; }
  function selectedInstance() {
    return instances().find((item) => item.id === state.selectedInstanceId) || null;
  }

  function tagMap(tags) {
    return Object.fromEntries((tags || []).filter((tag) => tag.Key).map((tag) => [tag.Key, tag.Value || '']));
  }

  function instanceName(instance) {
    return tagMap(instance?.tags).Name || instance?.id || 'Unnamed instance';
  }

  function setLocation() {
    const url = new URL(window.location.href);
    url.searchParams.set('ec2View', state.view);
    if (state.selectedInstanceId) url.searchParams.set('instance', state.selectedInstanceId);
    else url.searchParams.delete('instance');
    window.history.replaceState({}, '', url);
  }

  function readLocation() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('ec2View');
    if (['overview', 'instances', 'network', 'security', 'advanced', 'commands'].includes(view)) state.view = view;
    const advanced = params.get('advanced');
    if (['nacls', 'flow-logs', 'storage', 'images', 'templates', 'spot'].includes(advanced)) state.advancedSection = advanced;
    state.selectedInstanceId = params.get('instance') || '';
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) return;
    breadcrumbsEl.textContent = '';
    const home = btn('EC2', null, () => setView('overview'));
    breadcrumbsEl.append(home);
    if (state.view !== 'overview') breadcrumbsEl.append(el('span', null, '/'), el('span', null, ({ instances: 'Instances', network: 'Network', security: 'Security', advanced: 'Advanced', commands: 'Commands' })[state.view]));
    if (selectedInstance()) breadcrumbsEl.append(el('span', null, '/'), el('span', null, instanceName(selectedInstance())));
  }

  function renderSummary(summary) {
    ui.renderSummary(summary || {}, summaryEl, {
      serviceKey: 'ec2',
      targets: { instances: 'instances', vpcs: 'network', subnets: 'network', security_groups: 'security' },
    });
  }

  function setView(view) {
    state.view = view;
    if (view === 'overview') state.selectedInstanceId = '';
    setLocation();
    render();
  }

  function navigation() {
    const nav = el('nav', 'ec2-section-nav');
    nav.setAttribute('aria-label', 'EC2 workbench');
    [['overview', 'Overview'], ['instances', 'Instances'], ['network', 'Network'], ['security', 'Security'], ['advanced', 'Advanced'], ['commands', 'Run Command']].forEach(([key, label]) => {
      const item = btn(label, key === state.view ? 'ec2-nav-active' : null, () => setView(key));
      item.setAttribute('aria-current', key === state.view ? 'page' : 'false');
      nav.append(item);
    });
    return nav;
  }

  function stateBadge(value) {
    return el('span', `ec2-state ec2-state-${value || 'unknown'}`, value || 'unknown');
  }

  function canStart(instance) { return instance?.state === 'stopped'; }
  function canStop(instance) { return ['pending', 'running'].includes(instance?.state); }
  function canReboot(instance) { return instance?.state === 'running'; }
  function canTerminate(instance) { return instance && !['terminated', 'shutting-down'].includes(instance.state); }

  function filteredInstances() {
    const query = state.filter.trim().toLowerCase();
    if (!query) return instances();
    return instances().filter((instance) => [
      instanceName(instance), instance.id, instance.state, instance.image_id, instance.instance_type,
      instance.private_ip, instance.public_ip, instance.vpc_id, instance.subnet_id,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }

  function table() {
    const wrap = el('div', 'ec2-table-wrap');
    const node = document.createElement('table');
    node.className = 'ec2-instance-table';
    const head = document.createElement('thead');
    const header = document.createElement('tr');
    ['Select', 'Name', 'Instance ID', 'State', 'Type', 'Private IP', 'VPC / Subnet', 'Launched'].forEach((label, index) => {
      const th = document.createElement('th');
      th.textContent = index === 0 ? '' : label;
      if (index === 0) th.className = 'ec2-select-column';
      header.append(th);
    });
    head.append(header);
    const body = document.createElement('tbody');
    filteredInstances().forEach((instance) => {
      const row = document.createElement('tr');
      if (instance.id === state.selectedInstanceId) row.className = 'ec2-table-row-active';
      const selectCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = state.selectedIds.has(instance.id);
      checkbox.setAttribute('aria-label', `Select ${instance.id}`);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) state.selectedIds.add(instance.id); else state.selectedIds.delete(instance.id);
        render();
      });
      selectCell.append(checkbox);
      const nameCell = document.createElement('td');
      const link = btn(instanceName(instance), 'ec2-table-link', () => selectInstance(instance.id));
      nameCell.append(link);
      const values = [instance.id, null, instance.instance_type || '—', instance.private_ip || '—', [instance.vpc_id, instance.subnet_id].filter(Boolean).join(' / ') || '—', ui.formatDate(instance.launch_time)];
      row.append(selectCell, nameCell);
      values.forEach((value, index) => {
        const cell = document.createElement('td');
        if (index === 1) cell.append(stateBadge(instance.state)); else cell.textContent = value;
        row.append(cell);
      });
      body.append(row);
    });
    node.append(head, body);
    wrap.append(node);
    if (!filteredInstances().length) wrap.append(el('div', 'ec2-empty', state.filter ? 'No instances match this filter.' : 'No instances found. Launch one to begin.'));
    return wrap;
  }

  function selectInstance(instanceId) {
    state.selectedInstanceId = instanceId;
    state.view = 'instances';
    setLocation();
    loadCommands(instanceId, false);
    render();
  }

  async function instanceAction(instance, action) {
    if (!instance) return;
    if (action === 'terminate' && !ui.confirmAction(`Terminate ${instance.id}? This removes its local container.`)) return;
    await apiJson(`/api/ec2/instances/${encodeURIComponent(instance.id)}/${action}/`, { method: 'POST' });
    toast(`${instance.id}: ${action} requested`);
    await refresh({ quiet: true });
  }

  async function bulkAction(action) {
    const targets = instances().filter((instance) => state.selectedIds.has(instance.id)).filter((instance) => {
      if (action === 'start') return canStart(instance);
      if (action === 'stop') return canStop(instance);
      return canTerminate(instance);
    });
    if (!targets.length) return toast(`No selected instances can ${action}.`, true);
    if (action === 'terminate' && !ui.confirmAction(`Terminate ${targets.length} selected instance(s)?`)) return;
    for (const instance of targets) {
      await apiJson(`/api/ec2/instances/${encodeURIComponent(instance.id)}/${action}/`, { method: 'POST' });
    }
    state.selectedIds.clear();
    toast(`${action} requested for ${targets.length} instance(s)`);
    await refresh({ quiet: true });
  }

  function listToolbar() {
    const search = document.createElement('input');
    search.className = 'ec2-search';
    search.type = 'search';
    search.placeholder = 'Find instances by name, ID, state, IP, VPC, or subnet';
    search.value = state.filter;
    search.addEventListener('input', () => { state.filter = search.value; render(); });
    const launch = btn('Launch instance', null, showLaunchWizard);
    const importKey = btn('Import key pair', 'ec2-btn-secondary', showImportKeyModal);
    const selected = state.selectedIds.size;
    const selectedLabel = el('span', 'ec2-selected-count', selected ? `${selected} selected` : '');
    const start = btn('Start', 'ec2-btn-secondary', () => bulkAction('start'));
    const stop = btn('Stop', 'ec2-btn-secondary', () => bulkAction('stop'));
    const terminate = btn('Terminate', 'ec2-btn-danger', () => bulkAction('terminate'));
    [start, stop, terminate].forEach((button) => { button.disabled = !selected; });
    return ui.toolbar([launch, importKey, search], [selectedLabel, start, stop, terminate], 'ec2');
  }

  function overview() {
    const running = instances().filter((item) => item.state === 'running').length;
    const stopped = instances().filter((item) => item.state === 'stopped').length;
    const panel = el('div', 'ec2-overview-grid');
    const welcome = el('section', 'ec2-panel ec2-overview-hero');
    welcome.append(el('p', 'ec2-kicker', 'LOCAL COMPUTE'), el('h2', null, 'Operate Docker-backed EC2 instances with AWS-shaped workflows.'), el('p', null, 'Launch from Floci AMIs, inspect placement and identity, run shell commands through Systems Manager, and follow lifecycle state without leaving the dashboard.'));
    const actions = el('div', 'ec2-action-row');
    actions.append(btn('Launch instance', null, showLaunchWizard), btn('View instances', 'ec2-btn-secondary', () => setView('instances')));
    welcome.append(actions);
    const health = el('section', 'ec2-panel ec2-overview-stats');
    health.append(el('h3', null, 'Instance health'));
    [['Running', running], ['Stopped', stopped], ['Total', instances().length], ['Available AMIs', images().length], ['Instance types', instanceTypes().length]].forEach(([label, value]) => {
      const item = el('div', 'ec2-overview-stat'); item.append(el('strong', null, value), el('span', null, label)); health.append(item);
    });
    panel.append(welcome, health);
    const recent = el('section', 'ec2-panel');
    recent.append(el('div', 'ec2-panel-heading', 'Instances'));
    recent.append(table());
    const container = el('div');
    container.append(panel, recent);
    return container;
  }

  function field(details, label, value) { ui.addField(details, label, value); }

  function detailTabs(instance) {
    const content = el('div', 'ec2-detail-sections');
    const overviewDetails = document.createElement('dl');
    field(overviewDetails, 'Instance ID', instance.id);
    field(overviewDetails, 'AMI', instance.image_id);
    field(overviewDetails, 'Instance type', instance.instance_type);
    field(overviewDetails, 'Architecture', instance.architecture);
    field(overviewDetails, 'Launch time', instance.launch_time);
    field(overviewDetails, 'Key pair', instance.key_name);
    field(overviewDetails, 'IAM instance profile', instance.iam_instance_profile);
    field(overviewDetails, 'Monitoring', instance.monitoring);
    const network = document.createElement('dl');
    field(network, 'VPC', instance.vpc_id); field(network, 'Subnet', instance.subnet_id);
    field(network, 'Availability zone', instance.placement?.AvailabilityZone);
    field(network, 'Private IP', instance.private_ip); field(network, 'Private DNS', instance.private_dns);
    field(network, 'Public IP', instance.public_ip); field(network, 'Public DNS', instance.public_dns);
    field(network, 'Security groups', instance.security_groups || []); field(network, 'Network interfaces', instance.network_interfaces || []);
    const storage = document.createElement('dl');
    field(storage, 'Root device', [instance.root_device_name, instance.root_device_type].filter(Boolean).join(' / '));
    field(storage, 'Block devices', instance.block_device_mappings || []);
    const tags = document.createElement('dl'); field(tags, 'Tags', instance.tags || []);
    [['Details', overviewDetails], ['Networking', network], ['Storage', storage], ['Tags', tags]].forEach(([title, node]) => {
      const section = el('section', 'ec2-detail-card'); section.append(el('h3', null, title), node); content.append(section);
    });
    return content;
  }

  function instanceDetail(instance) {
    const panel = el('section', 'ec2-panel ec2-instance-detail-panel');
    const heading = el('div', 'ec2-panel-heading ec2-detail-heading');
    const title = el('div'); title.append(el('strong', null, instanceName(instance)), el('span', 'ec2-detail-id', instance.id));
    heading.append(title, stateBadge(instance.state)); panel.append(heading);
    const actions = el('div', 'ec2-action-row ec2-detail-actions');
    const start = btn('Start', null, () => instanceAction(instance, 'start'));
    const stop = btn('Stop', null, () => instanceAction(instance, 'stop'));
    const reboot = btn('Reboot', 'ec2-btn-secondary', () => instanceAction(instance, 'reboot'));
    const editTags = btn('Edit tags', 'ec2-btn-secondary', () => showTagModal(instance));
    const command = btn('Run command', 'ec2-btn-secondary', () => { state.view = 'commands'; setLocation(); render(); });
    const terminate = btn('Terminate', 'ec2-btn-danger', () => instanceAction(instance, 'terminate'));
    start.disabled = !canStart(instance); stop.disabled = !canStop(instance); reboot.disabled = !canReboot(instance); command.disabled = instance.state !== 'running'; terminate.disabled = !canTerminate(instance);
    actions.append(start, stop, reboot, editTags, command, terminate); panel.append(actions, detailTabs(instance));
    return panel;
  }

  function instancesView() {
    const container = el('div'); container.append(listToolbar());
    const layout = el('div', selectedInstance() ? 'ec2-instances-layout' : null);
    const list = el('section', 'ec2-panel');
    const heading = el('div', 'ec2-panel-heading'); heading.append(el('span', null, `Instances (${filteredInstances().length})`), state.loading ? el('span', 'ec2-loading', 'Refreshing…') : el('span'));
    list.append(heading, table()); layout.append(list);
    if (selectedInstance()) layout.append(instanceDetail(selectedInstance()));
    container.append(layout); return container;
  }

  function option(select, value, label, selected = false) {
    const item = document.createElement('option'); item.value = value || ''; item.textContent = label; item.selected = selected; select.append(item);
  }

  function labeled(label, control, description = '') {
    const group = el('div', 'ec2-form-field'); group.append(el('label', null, label));
    if (description) group.append(el('span', 'ec2-form-help', description)); group.append(control); return group;
  }

  function showLaunchWizard() {
    const body = el('div', 'ec2-launch-wizard');
    const steps = el('ol', 'ec2-wizard-steps'); ['Image & compute', 'Network & identity', 'Bootstrap & tags', 'Review'].forEach((label, index) => { const item = el('li', index === 0 ? 'active' : null); item.append(el('span', null, index + 1), document.createTextNode(label)); steps.append(item); });
    const image = document.createElement('select'); images().forEach((item, index) => option(image, item.ImageId, `${item.Name || item.ImageId} · ${item.Architecture || 'architecture unknown'}`, index === 0));
    const type = document.createElement('select'); instanceTypes().forEach((item, index) => option(type, item.InstanceType, `${item.InstanceType} · ${item.VCpuInfo?.DefaultVCpus || '?'} vCPU · ${Math.round((item.MemoryInfo?.SizeInMiB || 0) / 1024)} GiB`, index === 0));
    const subnet = document.createElement('select'); option(subnet, '', 'Use default subnet'); subnets().forEach((item) => option(subnet, item.SubnetId, `${item.SubnetId} · ${item.AvailabilityZone || ''} · ${item.CidrBlock || ''}`));
    const groups = el('div', 'ec2-check-list'); securityGroups().forEach((group) => { const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.value = group.GroupId; if (group.GroupName === 'default') input.checked = true; label.append(input, document.createTextNode(`${group.GroupName || group.GroupId} (${group.GroupId})`)); groups.append(label); });
    const key = document.createElement('select'); option(key, '', 'No key pair'); keyPairs().forEach((item) => option(key, item.KeyName, item.KeyName));
    const profile = document.createElement('input'); profile.placeholder = 'arn:aws:iam::000000000000:instance-profile/app';
    const userData = document.createElement('textarea'); userData.placeholder = '#!/bin/sh\necho hello-from-floci > /tmp/hello.txt';
    const tags = document.createElement('textarea'); tags.value = '{\n  "Name": "local-app",\n  "Environment": "development"\n}';
    const review = el('pre', 'ec2-launch-review');
    const updateReview = () => { review.textContent = JSON.stringify({ image_id: image.value, instance_type: type.value, subnet_id: subnet.value || 'default', security_group_ids: Array.from(groups.querySelectorAll('input:checked')).map((item) => item.value), key_name: key.value || null, iam_instance_profile_arn: profile.value || null }, null, 2); };
    [image, type, subnet, key, profile].forEach((control) => control.addEventListener('change', updateReview)); groups.addEventListener('change', updateReview); updateReview();
    const grid = el('div', 'ec2-wizard-grid');
    grid.append(labeled('AMI', image, 'Floci maps the selected AMI to a local Docker image.'), labeled('Instance type', type, 'Architecture must be compatible with the selected AMI.'), labeled('Subnet', subnet), labeled('Security groups', groups, 'Select one or more groups.'), labeled('Key pair', key), labeled('IAM instance profile ARN', profile, 'Enables temporary credentials through IMDS.'), labeled('UserData', userData, 'Runs after the local container starts.'), labeled('Tags (JSON object)', tags));
    const reviewGroup = labeled('Launch review', review, 'The dashboard sends one AWS RunInstances request.'); reviewGroup.classList.add('ec2-review-field'); grid.append(reviewGroup);
    body.append(steps, grid);
    ui.openModal('Launch EC2 instance', body, 'Launch instance', async (close) => {
      let parsedTags;
      try { parsedTags = JSON.parse(tags.value || '{}'); } catch (_error) { throw new Error('Tags must be valid JSON.'); }
      const payload = { image_id: image.value, instance_type: type.value, subnet_id: subnet.value || null, security_group_ids: Array.from(groups.querySelectorAll('input:checked')).map((item) => item.value), key_name: key.value || null, iam_instance_profile_arn: profile.value.trim() || null, user_data: userData.value, tags: parsedTags };
      const result = await apiJson('/api/ec2/instances/', { method: 'POST', body: JSON.stringify(payload) });
      close(); state.selectedInstanceId = result.instance_id || ''; state.view = 'instances'; setLocation(); toast(`Instance launched: ${result.instance_id || 'pending'}`); await refresh({ quiet: true });
    }, { classPrefix: 'ec2', toast });
  }

  function showImportKeyModal() {
    const body = el('div'); const name = document.createElement('input'); const material = document.createElement('textarea'); name.placeholder = 'floci-key'; material.placeholder = 'ssh-ed25519 AAAA…';
    body.append(labeled('Key name', name), labeled('Public key material', material, 'Import a real public key to enable SSH injection at launch.'));
    ui.openModal('Import key pair', body, 'Import', async (close) => { const result = await apiJson('/api/ec2/key-pairs/import/', { method: 'POST', body: JSON.stringify({ key_name: name.value.trim(), public_key_material: material.value.trim() }) }); close(); toast(`Imported ${result.key_name}`); await refresh({ quiet: true }); }, { classPrefix: 'ec2', toast });
  }

  function showTagModal(instance) {
    const input = document.createElement('textarea'); input.value = JSON.stringify(tagMap(instance.tags), null, 2);
    const body = el('div'); body.append(labeled('Instance tags', input, 'Use a JSON object. Removing a key here removes it from the instance.'));
    ui.openModal(`Edit tags · ${instance.id}`, body, 'Save tags', async (close) => { let tags; try { tags = JSON.parse(input.value || '{}'); } catch (_error) { throw new Error('Tags must be valid JSON.'); } await apiJson(`/api/ec2/instances/${encodeURIComponent(instance.id)}/tags/`, { method: 'PUT', body: JSON.stringify({ tags }) }); close(); toast('Instance tags updated'); await refresh({ quiet: true }); }, { classPrefix: 'ec2', toast });
  }

  async function loadCommands(instanceId, rerender = true) {
    if (!instanceId) { state.commands = []; return; }
    try { const result = await apiJson(`/api/ec2/instances/${encodeURIComponent(instanceId)}/commands/`); state.commands = result.commands || []; if (rerender) render(); } catch (error) { if (rerender) toast(error.message, true); }
  }

  async function pollCommand(instanceId, commandId) {
    window.clearTimeout(state.commandTimer);
    try {
      const result = await apiJson(`/api/ec2/instances/${encodeURIComponent(instanceId)}/commands/${encodeURIComponent(commandId)}/`);
      state.activeCommand = result; render();
      if (activeCommandStates.has(result.status)) state.commandTimer = window.setTimeout(() => pollCommand(instanceId, commandId), 1000);
      else { await loadCommands(instanceId, false); render(); toast(`Command ${String(result.status || '').toLowerCase()}`); }
    } catch (error) { toast(error.message, true); }
  }

  function commandHistory(instance) {
    const panel = el('section', 'ec2-panel'); panel.append(el('div', 'ec2-panel-heading', 'Command history'));
    const list = el('div', 'ec2-command-history');
    if (!state.commands.length) list.append(el('div', 'ec2-empty', 'No commands have been run on this instance.'));
    state.commands.forEach((command) => { const row = btn('', 'ec2-command-row', () => pollCommand(instance.id, command.command_id)); row.append(el('strong', null, command.command_id), el('span', null, command.document_name || 'AWS-RunShellScript'), stateBadge(command.status)); list.append(row); });
    panel.append(list); return panel;
  }

  function commandResult() {
    const panel = el('section', 'ec2-panel ec2-command-result'); panel.append(el('div', 'ec2-panel-heading', 'Command result'));
    if (!state.activeCommand) { panel.append(el('div', 'ec2-empty', 'Run or select a command to inspect its output.')); return panel; }
    const meta = el('div', 'ec2-command-meta'); meta.append(stateBadge(state.activeCommand.status), el('span', null, `Exit code: ${state.activeCommand.response_code ?? '—'}`), el('span', null, state.activeCommand.command_id));
    const stdout = el('pre', 'ec2-command-output', state.activeCommand.stdout || '(no standard output)');
    const stderr = el('pre', 'ec2-command-output ec2-command-error', state.activeCommand.stderr || '(no standard error)');
    panel.append(meta, el('h3', null, 'Standard output'), stdout, el('h3', null, 'Standard error'), stderr); return panel;
  }

  function commandsView() {
    const container = el('div'); const running = instances().filter((item) => item.state === 'running');
    const selector = document.createElement('select'); option(selector, '', 'Select a running instance'); running.forEach((item) => option(selector, item.id, `${instanceName(item)} · ${item.id}`, item.id === state.selectedInstanceId));
    selector.addEventListener('change', () => { state.selectedInstanceId = selector.value; state.activeCommand = null; setLocation(); loadCommands(selector.value); });
    const command = document.createElement('textarea'); command.className = 'ec2-command-input'; command.placeholder = 'uname -a\nprintf "hello from %s\\n" "$HOSTNAME"';
    const timeout = document.createElement('input'); timeout.type = 'number'; timeout.min = '30'; timeout.max = '86400'; timeout.value = '3600';
    const run = btn('Run command', null, async () => { const instance = selectedInstance(); if (!instance || instance.state !== 'running') return toast('Select a running instance.', true); const result = await apiJson(`/api/ec2/instances/${encodeURIComponent(instance.id)}/commands/`, { method: 'POST', body: JSON.stringify({ command: command.value, timeout_seconds: Number(timeout.value) }) }); ui.recordActivity({ service: 'ec2', action: 'run-command', title: `Run command on ${instance.id}`, summary: command.value.split('\n')[0], detail: result.command_id, payload: { instance_id: instance.id, command: command.value } }); state.activeCommand = { ...result, stdout: '', stderr: '' }; toast(`Command submitted: ${result.command_id}`); await loadCommands(instance.id, false); pollCommand(instance.id, result.command_id); });
    const form = el('section', 'ec2-panel ec2-command-form'); form.append(el('div', 'ec2-panel-heading', 'AWS Systems Manager Run Command'), el('p', null, 'Runs AWS-RunShellScript through Floci SSM and records stdout, stderr, and exit status.'), labeled('Running instance', selector), labeled('Shell command', command), labeled('Timeout seconds', timeout), run);
    const layout = el('div', 'ec2-command-layout'); layout.append(form, commandHistory(selectedInstance() || {}), commandResult()); container.append(layout); return container;
  }

  async function networkMutation(path, method, payload, message) {
    const result = await apiJson(path, { method, ...(payload == null ? {} : { body: JSON.stringify(payload) }) });
    toast(message);
    await refresh({ quiet: true });
    return result;
  }

  function modalForm(title, confirmLabel, fields, onSubmit) {
    const body = el('div', 'ec2-network-form');
    const controls = {};
    fields.forEach((field) => {
      let control;
      if (field.type === 'select') {
        control = document.createElement('select');
        (field.options || []).forEach((item) => option(control, item.value, item.label, item.value === field.value));
      } else if (field.type === 'checkbox') {
        control = document.createElement('input'); control.type = 'checkbox'; control.checked = Boolean(field.value);
      } else if (field.type === 'textarea') {
        control = document.createElement('textarea'); control.value = field.value || '';
      } else {
        control = document.createElement('input'); control.type = field.type || 'text'; control.value = field.value || ''; control.placeholder = field.placeholder || '';
      }
      controls[field.name] = control;
      body.append(labeled(field.label, control, field.help || ''));
    });
    ui.openModal(title, body, confirmLabel, async (close) => {
      const values = {};
      Object.entries(controls).forEach(([name, control]) => { values[name] = control.type === 'checkbox' ? control.checked : control.value; });
      await onSubmit(values); close();
    }, { classPrefix: 'ec2', toast });
  }

  function resourceName(item, idKey) {
    const tags = item.Tags || [];
    return tags.find((tag) => tag.Key === 'Name')?.Value || item[idKey] || 'Unnamed';
  }

  function resourceTable(title, items, columns, actions = [], rowActions = null) {
    const panel = el('section', 'ec2-panel ec2-network-resource');
    const heading = el('div', 'ec2-panel-heading');
    const headingActions = el('div', 'ec2-action-row'); actions.forEach((action) => headingActions.append(action));
    heading.append(el('span', null, `${title} (${items.length})`), headingActions); panel.append(heading);
    const wrap = el('div', 'ec2-table-wrap'); const tableNode = document.createElement('table'); tableNode.className = 'ec2-network-table';
    const thead = document.createElement('thead'); const hr = document.createElement('tr');
    [...columns.map((column) => column.label), ...(rowActions ? ['Actions'] : [])].forEach((label) => { const th = document.createElement('th'); th.textContent = label; hr.append(th); }); thead.append(hr);
    const tbody = document.createElement('tbody');
    items.forEach((item) => { const row = document.createElement('tr'); columns.forEach((column) => { const td = document.createElement('td'); const value = typeof column.value === 'function' ? column.value(item) : item[column.key]; if (value instanceof Node) td.append(value); else td.textContent = value == null || value === '' ? '—' : String(value); row.append(td); }); if (rowActions) { const td = document.createElement('td'); td.append(rowActions(item)); row.append(td); } tbody.append(row); });
    tableNode.append(thead, tbody); wrap.append(tableNode); if (!items.length) wrap.append(el('div', 'ec2-empty', `No ${title.toLowerCase()} found.`)); panel.append(wrap); return panel;
  }

  function diagnosticsPanel() {
    const diagnostics = state.inventory?.diagnostics || [];
    const panel = el('section', 'ec2-panel ec2-diagnostics');
    panel.append(el('div', 'ec2-panel-heading', `Connectivity diagnostics (${diagnostics.length})`));
    const body = el('div', 'ec2-diagnostic-list');
    if (!diagnostics.length) body.append(el('div', 'ec2-diagnostic ec2-diagnostic-ok', 'No obvious connectivity gaps were found in the current EC2 control-plane state.'));
    diagnostics.forEach((item) => { const row = el('article', `ec2-diagnostic ec2-diagnostic-${item.severity}`); const main = el('div'); main.append(el('strong', null, item.title), el('span', null, `${item.resource_id || item.resource_type} · ${item.detail}`)); row.append(el('span', 'ec2-diagnostic-severity', item.severity), main); body.append(row); });
    panel.append(body); return panel;
  }

  function topologyView() {
    const panel = el('section', 'ec2-panel ec2-topology-panel');
    panel.append(el('div', 'ec2-panel-heading', 'Relationship topology'));
    const canvas = el('div', 'ec2-topology');
    vpcs().forEach((vpc) => {
      const vpcId = vpc.VpcId;
      const card = el('article', 'ec2-topology-vpc');
      const header = el('div', 'ec2-topology-vpc-header'); header.append(el('strong', null, resourceName(vpc, 'VpcId')), el('span', null, `${vpcId} · ${vpc.CidrBlock}`)); card.append(header);
      const edge = el('div', 'ec2-topology-edge');
      const attached = internetGateways().filter((gateway) => (gateway.Attachments || []).some((attachment) => attachment.VpcId === vpcId));
      attached.forEach((gateway) => edge.append(el('span', 'ec2-topology-node ec2-node-igw', `IGW ${gateway.InternetGatewayId}`)));
      vpcEndpoints().filter((endpoint) => endpoint.VpcId === vpcId).forEach((endpoint) => edge.append(el('span', 'ec2-topology-node ec2-node-endpoint', `${endpoint.VpcEndpointType} endpoint ${endpoint.VpcEndpointId}`)));
      natGateways().filter((gateway) => gateway.VpcId === vpcId).forEach((gateway) => edge.append(el('span', 'ec2-topology-node ec2-node-nat', `NAT ${gateway.NatGatewayId}`)));
      if (!edge.children.length) edge.append(el('span', 'ec2-topology-muted', 'No edge resources'));
      card.append(edge);
      const subnetGrid = el('div', 'ec2-topology-subnets');
      subnets().filter((subnet) => subnet.VpcId === vpcId).forEach((subnet) => { const subnetCard = el('section', 'ec2-topology-subnet'); subnetCard.append(el('strong', null, resourceName(subnet, 'SubnetId')), el('span', null, `${subnet.SubnetId} · ${subnet.CidrBlock} · ${subnet.AvailabilityZone}`)); const placed = instances().filter((instance) => instance.subnet_id === subnet.SubnetId && instance.state !== 'terminated'); if (!placed.length) subnetCard.append(el('em', null, 'No instances')); placed.forEach((instance) => { const node = el('div', 'ec2-topology-instance'); node.append(stateBadge(instance.state), el('span', null, `${instanceName(instance)} · ${instance.private_ip || 'no private IP'}`)); subnetCard.append(node); }); subnetGrid.append(subnetCard); });
      if (!subnetGrid.children.length) subnetGrid.append(el('div', 'ec2-topology-muted', 'No subnets')); card.append(subnetGrid);
      const routing = el('div', 'ec2-topology-routing'); routeTables().filter((table) => table.VpcId === vpcId).forEach((table) => routing.append(el('span', 'ec2-topology-node ec2-node-route', `Route table ${table.RouteTableId} · ${(table.Routes || []).length} routes`))); card.append(routing);
      canvas.append(card);
    });
    if (!vpcs().length) canvas.append(el('div', 'ec2-empty', 'Create a VPC to build a network topology.')); panel.append(canvas); return panel;
  }

  function createVpcModal() { modalForm('Create VPC', 'Create VPC', [{ name: 'name', label: 'Name', value: 'local-network' }, { name: 'cidr_block', label: 'IPv4 CIDR block', value: '10.0.0.0/16' }], (values) => networkMutation('/api/ec2/vpcs/', 'POST', values, 'VPC created')); }
  function createSubnetModal() { modalForm('Create subnet', 'Create subnet', [{ name: 'name', label: 'Name', value: 'app-subnet' }, { name: 'vpc_id', label: 'VPC', type: 'select', options: vpcs().map((vpc) => ({ value: vpc.VpcId, label: `${resourceName(vpc, 'VpcId')} · ${vpc.VpcId}` })) }, { name: 'cidr_block', label: 'IPv4 CIDR block', value: '10.0.1.0/24' }, { name: 'availability_zone', label: 'Availability zone', type: 'select', options: (state.inventory?.availability_zones || []).map((zone) => ({ value: zone.ZoneName, label: zone.ZoneName })) }], (values) => networkMutation('/api/ec2/subnets/', 'POST', values, 'Subnet created')); }
  function createIgwModal() { networkMutation('/api/ec2/internet-gateways/', 'POST', {}, 'Internet gateway created'); }
  function createRouteTableModal() { modalForm('Create route table', 'Create route table', [{ name: 'vpc_id', label: 'VPC', type: 'select', options: vpcs().map((vpc) => ({ value: vpc.VpcId, label: `${resourceName(vpc, 'VpcId')} · ${vpc.VpcId}` })) }], (values) => networkMutation('/api/ec2/route-tables/', 'POST', values, 'Route table created')); }
  function createNatModal() { modalForm('Create NAT gateway', 'Create NAT gateway', [{ name: 'subnet_id', label: 'Subnet', type: 'select', options: subnets().map((subnet) => ({ value: subnet.SubnetId, label: `${resourceName(subnet, 'SubnetId')} · ${subnet.SubnetId}` })) }, { name: 'allocation_id', label: 'Elastic IP', type: 'select', options: elasticIps().filter((ip) => !ip.AssociationId).map((ip) => ({ value: ip.AllocationId, label: `${ip.PublicIp} · ${ip.AllocationId}` })) }, { name: 'connectivity_type', label: 'Connectivity type', type: 'select', options: [{ value: 'public', label: 'Public' }, { value: 'private', label: 'Private' }] }], (values) => networkMutation('/api/ec2/nat-gateways/', 'POST', values, 'NAT gateway created')); }
  function createEndpointModal() { modalForm('Create VPC endpoint', 'Create endpoint', [{ name: 'vpc_id', label: 'VPC', type: 'select', options: vpcs().map((vpc) => ({ value: vpc.VpcId, label: vpc.VpcId })) }, { name: 'service_name', label: 'Service name', value: 'com.amazonaws.us-east-1.s3' }, { name: 'endpoint_type', label: 'Endpoint type', type: 'select', options: [{ value: 'Gateway', label: 'Gateway' }, { value: 'Interface', label: 'Interface' }] }, { name: 'route_table_ids', label: 'Route table IDs', help: 'Comma-separated for Gateway endpoints.' }, { name: 'subnet_ids', label: 'Subnet IDs', help: 'Comma-separated for Interface endpoints.' }, { name: 'security_group_ids', label: 'Security group IDs', help: 'Comma-separated for Interface endpoints.' }], (values) => networkMutation('/api/ec2/vpc-endpoints/', 'POST', { ...values, route_table_ids: values.route_table_ids.split(',').map((v) => v.trim()).filter(Boolean), subnet_ids: values.subnet_ids.split(',').map((v) => v.trim()).filter(Boolean), security_group_ids: values.security_group_ids.split(',').map((v) => v.trim()).filter(Boolean) }, 'VPC endpoint created')); }

  function networkView() {
    const container = el('div'); container.append(topologyView(), diagnosticsPanel());
    const createBar = ui.toolbar([btn('Create VPC', null, createVpcModal), btn('Create subnet', null, createSubnetModal), btn('Create internet gateway', 'ec2-btn-secondary', createIgwModal), btn('Create route table', 'ec2-btn-secondary', createRouteTableModal), btn('Allocate Elastic IP', 'ec2-btn-secondary', () => networkMutation('/api/ec2/elastic-ips/', 'POST', {}, 'Elastic IP allocated')), btn('Create NAT gateway', 'ec2-btn-secondary', createNatModal), btn('Create VPC endpoint', 'ec2-btn-secondary', createEndpointModal)], [], 'ec2'); container.append(createBar);
    container.append(resourceTable('VPCs', vpcs(), [{ label: 'Name', value: (item) => resourceName(item, 'VpcId') }, { label: 'VPC ID', key: 'VpcId' }, { label: 'CIDR', key: 'CidrBlock' }, { label: 'Default', value: (item) => item.IsDefault ? 'Yes' : 'No' }], [], (item) => { const actions = el('div', 'ec2-action-row'); const remove = btn('Delete', 'ec2-btn-danger', () => { if (ui.confirmAction(`Delete ${item.VpcId}?`)) networkMutation(`/api/ec2/vpcs/${encodeURIComponent(item.VpcId)}/`, 'DELETE', null, 'VPC deleted'); }); remove.disabled = item.IsDefault; actions.append(remove); return actions; }));
    container.append(resourceTable('Subnets', subnets(), [{ label: 'Name', value: (item) => resourceName(item, 'SubnetId') }, { label: 'Subnet ID', key: 'SubnetId' }, { label: 'VPC', key: 'VpcId' }, { label: 'CIDR', key: 'CidrBlock' }, { label: 'AZ', key: 'AvailabilityZone' }], [], (item) => { const actions = el('div', 'ec2-action-row'); const remove = btn('Delete', 'ec2-btn-danger', () => { if (ui.confirmAction(`Delete ${item.SubnetId}?`)) networkMutation(`/api/ec2/subnets/${encodeURIComponent(item.SubnetId)}/`, 'DELETE', null, 'Subnet deleted'); }); remove.disabled = item.DefaultForAz; actions.append(remove); return actions; }));
    container.append(resourceTable('Internet gateways', internetGateways(), [{ label: 'Gateway ID', key: 'InternetGatewayId' }, { label: 'Attached VPC', value: (item) => item.Attachments?.[0]?.VpcId }, { label: 'State', value: (item) => item.Attachments?.[0]?.State || 'detached' }], [], (item) => { const actions = el('div', 'ec2-action-row'); const attachment = item.Attachments?.[0]; if (attachment) actions.append(btn('Detach', 'ec2-btn-secondary', () => networkMutation(`/api/ec2/internet-gateways/${item.InternetGatewayId}/attachment/`, 'DELETE', { vpc_id: attachment.VpcId }, 'Internet gateway detached'))); else actions.append(btn('Attach', 'ec2-btn-secondary', () => modalForm('Attach internet gateway', 'Attach', [{ name: 'vpc_id', label: 'VPC', type: 'select', options: vpcs().map((vpc) => ({ value: vpc.VpcId, label: vpc.VpcId })) }], (values) => networkMutation(`/api/ec2/internet-gateways/${item.InternetGatewayId}/attachment/`, 'PUT', values, 'Internet gateway attached')))); const remove = btn('Delete', 'ec2-btn-danger', () => { if (ui.confirmAction(`Delete ${item.InternetGatewayId}?`)) networkMutation(`/api/ec2/internet-gateways/${item.InternetGatewayId}/`, 'DELETE', null, 'Internet gateway deleted'); }); remove.disabled = Boolean(attachment); actions.append(remove); return actions; }));
    container.append(resourceTable('Route tables', routeTables(), [{ label: 'Route table ID', key: 'RouteTableId' }, { label: 'VPC', key: 'VpcId' }, { label: 'Main', value: (item) => (item.Associations || []).some((a) => a.Main) ? 'Yes' : 'No' }, { label: 'Routes', value: (item) => (item.Routes || []).map((route) => `${route.DestinationCidrBlock} → ${route.GatewayId}`).join('\n') }], [], (item) => { const actions = el('div', 'ec2-action-row'); actions.append(btn('Add route', 'ec2-btn-secondary', () => modalForm('Add route', 'Add route', [{ name: 'destination_cidr', label: 'Destination CIDR', value: '0.0.0.0/0' }, { name: 'gateway_id', label: 'Gateway ID', type: 'select', options: internetGateways().map((gateway) => ({ value: gateway.InternetGatewayId, label: gateway.InternetGatewayId })) }], (values) => networkMutation(`/api/ec2/route-tables/${item.RouteTableId}/routes/`, 'POST', values, 'Route created'))), btn('Associate subnet', 'ec2-btn-secondary', () => modalForm('Associate route table', 'Associate', [{ name: 'subnet_id', label: 'Subnet', type: 'select', options: subnets().filter((subnet) => subnet.VpcId === item.VpcId).map((subnet) => ({ value: subnet.SubnetId, label: subnet.SubnetId })) }], (values) => networkMutation(`/api/ec2/route-tables/${item.RouteTableId}/associations/`, 'POST', values, 'Route table associated')))); const remove = btn('Delete', 'ec2-btn-danger', () => { if (ui.confirmAction(`Delete ${item.RouteTableId}?`)) networkMutation(`/api/ec2/route-tables/${item.RouteTableId}/`, 'DELETE', null, 'Route table deleted'); }); remove.disabled = (item.Associations || []).some((a) => a.Main); actions.append(remove); return actions; }));
    container.append(resourceTable('Elastic IPs', elasticIps(), [{ label: 'Public IP', key: 'PublicIp' }, { label: 'Allocation ID', key: 'AllocationId' }, { label: 'Instance', key: 'InstanceId' }, { label: 'Association', key: 'AssociationId' }], [], (item) => { const actions = el('div', 'ec2-action-row'); if (item.AssociationId) actions.append(btn('Disassociate', 'ec2-btn-secondary', () => networkMutation(`/api/ec2/elastic-ips/${item.AllocationId}/association/`, 'DELETE', { association_id: item.AssociationId }, 'Elastic IP disassociated'))); else actions.append(btn('Associate', 'ec2-btn-secondary', () => modalForm('Associate Elastic IP', 'Associate', [{ name: 'instance_id', label: 'Instance', type: 'select', options: instances().filter((instance) => instance.state !== 'terminated').map((instance) => ({ value: instance.id, label: `${instanceName(instance)} · ${instance.id}` })) }], (values) => networkMutation(`/api/ec2/elastic-ips/${item.AllocationId}/association/`, 'PUT', values, 'Elastic IP associated')))); const release = btn('Release', 'ec2-btn-danger', () => { if (ui.confirmAction(`Release ${item.AllocationId}?`)) networkMutation(`/api/ec2/elastic-ips/${item.AllocationId}/`, 'DELETE', null, 'Elastic IP released'); }); release.disabled = Boolean(item.AssociationId); actions.append(release); return actions; }));
    container.append(resourceTable('NAT gateways', natGateways(), [{ label: 'NAT gateway ID', key: 'NatGatewayId' }, { label: 'State', key: 'State' }, { label: 'VPC', key: 'VpcId' }, { label: 'Subnet', key: 'SubnetId' }], [], (item) => { const actions = el('div', 'ec2-action-row'); actions.append(btn('Delete', 'ec2-btn-danger', () => { if (ui.confirmAction(`Delete ${item.NatGatewayId}?`)) networkMutation(`/api/ec2/nat-gateways/${item.NatGatewayId}/`, 'DELETE', null, 'NAT gateway deleted'); })); return actions; }));
    container.append(resourceTable('VPC endpoints', vpcEndpoints(), [{ label: 'Endpoint ID', key: 'VpcEndpointId' }, { label: 'Type', key: 'VpcEndpointType' }, { label: 'Service', key: 'ServiceName' }, { label: 'VPC', key: 'VpcId' }, { label: 'State', key: 'State' }], [], (item) => { const actions = el('div', 'ec2-action-row'); actions.append(btn('Delete', 'ec2-btn-danger', () => { if (ui.confirmAction(`Delete ${item.VpcEndpointId}?`)) networkMutation(`/api/ec2/vpc-endpoints/${item.VpcEndpointId}/`, 'DELETE', null, 'VPC endpoint deleted'); })); return actions; }));
    return container;
  }

  function createSecurityGroupModal() { modalForm('Create security group', 'Create security group', [{ name: 'name', label: 'Group name', value: 'app-sg' }, { name: 'description', label: 'Description', value: 'Local application access' }, { name: 'vpc_id', label: 'VPC', type: 'select', options: vpcs().map((vpc) => ({ value: vpc.VpcId, label: `${resourceName(vpc, 'VpcId')} · ${vpc.VpcId}` })) }], (values) => networkMutation('/api/ec2/security-groups/', 'POST', values, 'Security group created')); }
  function ruleModal(group, direction) { modalForm(`Add ${direction} rule`, 'Add rule', [{ name: 'protocol', label: 'Protocol', type: 'select', options: [{ value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }, { value: '-1', label: 'All traffic' }] }, { name: 'from_port', label: 'From port', value: '80' }, { name: 'to_port', label: 'To port', value: '80' }, { name: 'cidr', label: 'Source / destination CIDR', value: '0.0.0.0/0' }, { name: 'description', label: 'Description', value: 'Local application traffic' }], (values) => networkMutation(`/api/ec2/security-groups/${group.GroupId}/rules/`, 'POST', { direction, rule: values }, 'Security group rule added')); }

  function permissionRows(group, direction, permissions) {
    const list = el('div', 'ec2-rule-list');
    if (!permissions.length) list.append(el('span', 'ec2-topology-muted', `No ${direction} rules`));
    permissions.forEach((permission) => { const ranges = permission.IpRanges?.length ? permission.IpRanges : [{ CidrIp: '—' }]; ranges.forEach((range) => { const row = el('div', 'ec2-rule-row'); const label = el('span', null, `${permission.IpProtocol} · ${permission.FromPort ?? 'all'}${permission.ToPort != null && permission.ToPort !== permission.FromPort ? `–${permission.ToPort}` : ''} · ${range.CidrIp}`); const remove = btn('Remove', 'ec2-btn-danger', () => { if (ui.confirmAction('Remove this security group rule?')) networkMutation(`/api/ec2/security-groups/${group.GroupId}/rules/`, 'DELETE', { direction, rule: { protocol: permission.IpProtocol, from_port: permission.FromPort, to_port: permission.ToPort, cidr: range.CidrIp } }, 'Security group rule removed'); }); row.append(label, remove); list.append(row); }); }); return list;
  }

  function securityView() {
    const container = el('div'); container.append(diagnosticsPanel(), ui.toolbar([btn('Create security group', null, createSecurityGroupModal)], [], 'ec2'));
    const grid = el('div', 'ec2-security-grid');
    securityGroups().forEach((group) => { const card = el('section', 'ec2-panel ec2-security-card'); const heading = el('div', 'ec2-panel-heading'); const title = el('div'); title.append(el('strong', null, group.GroupName || group.GroupId), el('span', 'ec2-detail-id', `${group.GroupId} · ${group.VpcId}`)); const actions = el('div', 'ec2-action-row'); actions.append(btn('Add inbound', 'ec2-btn-secondary', () => ruleModal(group, 'ingress')), btn('Add outbound', 'ec2-btn-secondary', () => ruleModal(group, 'egress'))); const remove = btn('Delete', 'ec2-btn-danger', () => { if (ui.confirmAction(`Delete ${group.GroupId}?`)) networkMutation(`/api/ec2/security-groups/${group.GroupId}/`, 'DELETE', null, 'Security group deleted'); }); remove.disabled = group.GroupName === 'default'; actions.append(remove); heading.append(title, actions); card.append(heading); const body = el('div', 'ec2-security-body'); body.append(el('p', null, group.Description || 'No description'), el('h3', null, 'Inbound rules'), permissionRows(group, 'ingress', group.IpPermissions || []), el('h3', null, 'Outbound rules'), permissionRows(group, 'egress', group.IpPermissionsEgress || [])); card.append(body); grid.append(card); });
    if (!securityGroups().length) grid.append(el('div', 'ec2-empty', 'No security groups found.')); container.append(grid); return container;
  }

  function setAdvancedSection(section) {
    state.advancedSection = section;
    const url = new URL(window.location.href);
    url.searchParams.set('advanced', section);
    window.history.replaceState({}, '', url);
    render();
  }

  function advancedNav() {
    const nav = el('div', 'ec2-advanced-nav');
    [['nacls', 'Network ACLs'], ['flow-logs', 'Flow logs'], ['storage', 'Volumes & snapshots'], ['images', 'AMIs'], ['templates', 'Launch templates'], ['spot', 'Spot requests']].forEach(([key, label]) => {
      nav.append(btn(label, key === state.advancedSection ? 'ec2-advanced-active' : null, () => setAdvancedSection(key)));
    });
    return nav;
  }

  function createNaclModal() {
    modalForm('Create network ACL', 'Create network ACL', [{ name: 'vpc_id', label: 'VPC', type: 'select', options: vpcs().map((vpc) => ({ value: vpc.VpcId, label: `${resourceName(vpc, 'VpcId')} · ${vpc.VpcId}` })) }], (values) => networkMutation('/api/ec2/network-acls/', 'POST', values, 'Network ACL created'));
  }

  function naclEntryModal(acl, egress) {
    modalForm(`Add ${egress ? 'outbound' : 'inbound'} ACL entry`, 'Save entry', [
      { name: 'rule_number', label: 'Rule number', value: '100' },
      { name: 'protocol', label: 'Protocol', type: 'select', options: [{ value: '-1', label: 'All traffic' }, { value: '6', label: 'TCP' }, { value: '17', label: 'UDP' }] },
      { name: 'rule_action', label: 'Action', type: 'select', options: [{ value: 'allow', label: 'Allow' }, { value: 'deny', label: 'Deny' }] },
      { name: 'cidr', label: 'CIDR', value: '0.0.0.0/0' },
      { name: 'from_port', label: 'From port' },
      { name: 'to_port', label: 'To port' },
    ], (values) => networkMutation(`/api/ec2/network-acls/${acl.NetworkAclId}/entries/`, 'PUT', {
      entry: { ...values, egress, rule_number: Number(values.rule_number), from_port: values.from_port || null, to_port: values.to_port || null },
    }, 'Network ACL entry saved'));
  }

  function naclSection() {
    const container = el('div');
    container.append(ui.toolbar([btn('Create network ACL', null, createNaclModal)], [], 'ec2'));
    const grid = el('div', 'ec2-advanced-grid');
    networkAcls().forEach((acl) => {
      const card = el('section', 'ec2-panel ec2-advanced-card');
      const heading = el('div', 'ec2-panel-heading');
      const title = el('div');
      title.append(el('strong', null, acl.NetworkAclId), el('span', 'ec2-detail-id', `${acl.VpcId} · ${acl.IsDefault ? 'default' : 'custom'}`));
      const actions = el('div', 'ec2-action-row');
      actions.append(btn('Add inbound', 'ec2-btn-secondary', () => naclEntryModal(acl, false)), btn('Add outbound', 'ec2-btn-secondary', () => naclEntryModal(acl, true)));
      const remove = btn('Delete', 'ec2-btn-danger', () => { if (ui.confirmAction(`Delete ${acl.NetworkAclId}?`)) networkMutation(`/api/ec2/network-acls/${acl.NetworkAclId}/`, 'DELETE', null, 'Network ACL deleted'); });
      remove.disabled = acl.IsDefault;
      actions.append(remove); heading.append(title, actions); card.append(heading);
      const body = el('div', 'ec2-advanced-body');
      body.append(el('h3', null, 'Subnet associations'));
      const associations = el('div', 'ec2-chip-list');
      (acl.Associations || []).forEach((association) => {
        const chip = el('span', 'ec2-resource-chip', `${association.SubnetId} · ${association.NetworkAclAssociationId}`);
        chip.append(btn('Move', 'ec2-btn-secondary', () => modalForm('Replace ACL association', 'Replace', [{ name: 'network_acl_id', label: 'Target ACL', type: 'select', options: networkAcls().filter((item) => item.VpcId === acl.VpcId).map((item) => ({ value: item.NetworkAclId, label: item.NetworkAclId })) }], (values) => networkMutation(`/api/ec2/network-acls/${values.network_acl_id}/associations/`, 'PUT', { association_id: association.NetworkAclAssociationId }, 'Network ACL association replaced'))));
        associations.append(chip);
      });
      if (!(acl.Associations || []).length) associations.append(el('span', 'ec2-topology-muted', 'No subnet associations'));
      body.append(associations, el('h3', null, 'Entries'));
      const entries = el('div', 'ec2-nacl-entries');
      (acl.Entries || []).sort((a, b) => Number(a.RuleNumber) - Number(b.RuleNumber)).forEach((entry) => {
        const row = el('div', 'ec2-nacl-entry');
        row.append(el('span', null, `${entry.Egress ? 'OUT' : 'IN'} · ${entry.RuleNumber} · ${entry.RuleAction} · protocol ${entry.Protocol} · ${entry.CidrBlock}`));
        const removeEntry = btn('Delete', 'ec2-btn-danger', () => { if (ui.confirmAction(`Delete ACL rule ${entry.RuleNumber}?`)) networkMutation(`/api/ec2/network-acls/${acl.NetworkAclId}/entries/`, 'DELETE', { rule_number: entry.RuleNumber, egress: entry.Egress }, 'Network ACL entry deleted'); });
        removeEntry.disabled = Number(entry.RuleNumber) === 32767;
        row.append(removeEntry); entries.append(row);
      });
      body.append(entries); card.append(body); grid.append(card);
    });
    container.append(grid); return container;
  }

  function createFlowLogModal() {
    modalForm('Create VPC flow log', 'Create flow log', [
      { name: 'resource_type', label: 'Resource type', type: 'select', options: [{ value: 'VPC', label: 'VPC' }, { value: 'Subnet', label: 'Subnet' }, { value: 'NetworkInterface', label: 'Network interface' }] },
      { name: 'resource_id', label: 'Resource ID', value: 'vpc-default' },
      { name: 'traffic_type', label: 'Traffic type', type: 'select', options: [{ value: 'ALL', label: 'All' }, { value: 'ACCEPT', label: 'Accepted' }, { value: 'REJECT', label: 'Rejected' }] },
      { name: 'destination', label: 'S3 destination ARN', value: 'arn:aws:s3:::floci-flow-logs' },
      { name: 'max_aggregation_interval', label: 'Aggregation interval', type: 'select', options: [{ value: '60', label: '60 seconds' }, { value: '600', label: '600 seconds' }] },
    ], (values) => networkMutation('/api/ec2/flow-logs/', 'POST', { ...values, max_aggregation_interval: Number(values.max_aggregation_interval) }, 'Flow log created'));
  }

  async function showFlowLog(flowLog) {
    try {
      const result = await apiJson(`/api/ec2/flow-logs/${flowLog.FlowLogId}/view/`);
      const body = el('div', 'ec2-flow-viewer');
      body.append(el('p', null, result.latest_key || `No flow files found in ${result.bucket}.`), el('pre', 'ec2-flow-records', (result.records || []).join('\n') || 'No records yet. Launch an instance in the selected resource to generate correlated flows.'));
      ui.openModal(`Flow log · ${flowLog.FlowLogId}`, body, 'Close', (close) => close(), { classPrefix: 'ec2', toast });
    } catch (error) { toast(error.message, true); }
  }

  function flowLogSection() {
    return resourceTable('Flow logs', flowLogs(), [
      { label: 'Flow log ID', key: 'FlowLogId' }, { label: 'Resource', key: 'ResourceId' }, { label: 'Traffic', key: 'TrafficType' }, { label: 'Destination', key: 'LogDestination' }, { label: 'Status', key: 'FlowLogStatus' },
    ], [btn('Create flow log', null, createFlowLogModal)], (item) => {
      const actions = el('div', 'ec2-action-row');
      actions.append(btn('View records', 'ec2-btn-secondary', () => showFlowLog(item)), btn('Delete', 'ec2-btn-danger', () => { if (ui.confirmAction(`Delete ${item.FlowLogId}?`)) networkMutation(`/api/ec2/flow-logs/${item.FlowLogId}/`, 'DELETE', null, 'Flow log deleted'); }));
      return actions;
    });
  }

  function createVolumeModal() {
    modalForm('Create EBS volume', 'Create volume', [
      { name: 'availability_zone', label: 'Availability zone', type: 'select', options: (state.inventory?.availability_zones || []).map((zone) => ({ value: zone.ZoneName, label: zone.ZoneName })) },
      { name: 'size', label: 'Size (GiB)', type: 'number', value: '8' },
      { name: 'volume_type', label: 'Volume type', type: 'select', options: [{ value: 'gp3', label: 'gp3' }, { value: 'gp2', label: 'gp2' }, { value: 'io1', label: 'io1' }] },
      { name: 'encrypted', label: 'Encrypted', type: 'checkbox', value: false },
      { name: 'iops', label: 'IOPS' }, { name: 'throughput', label: 'Throughput' }, { name: 'snapshot_id', label: 'Snapshot ID' },
      { name: 'tags', label: 'Tags JSON', type: 'textarea', value: '{"Name":"local-volume"}' },
    ], (values) => {
      let tags; try { tags = JSON.parse(values.tags || '{}'); } catch (_error) { throw new Error('Tags must be valid JSON.'); }
      return networkMutation('/api/ec2/volumes/', 'POST', { ...values, size: Number(values.size), tags }, 'Volume created');
    });
  }

  function storageSection() {
    const container = el('div');
    container.append(resourceTable('Volumes', volumes(), [
      { label: 'Volume ID', key: 'VolumeId' }, { label: 'State', key: 'State' }, { label: 'Type', key: 'VolumeType' }, { label: 'Size', value: (item) => `${item.Size} GiB` }, { label: 'AZ', key: 'AvailabilityZone' }, { label: 'Snapshot', key: 'SnapshotId' },
    ], [btn('Create volume', null, createVolumeModal)], (item) => { const actions = el('div', 'ec2-action-row'); const remove = btn('Delete', 'ec2-btn-danger', () => { if (ui.confirmAction(`Delete ${item.VolumeId}?`)) networkMutation(`/api/ec2/volumes/${item.VolumeId}/`, 'DELETE', null, 'Volume deleted'); }); remove.disabled = (item.Attachments || []).length > 0; actions.append(remove); return actions; }));
    container.append(resourceTable('Snapshots', snapshots(), [{ label: 'Snapshot ID', key: 'SnapshotId' }, { label: 'State', key: 'State' }, { label: 'Volume ID', key: 'VolumeId' }, { label: 'Size', value: (item) => item.VolumeSize ? `${item.VolumeSize} GiB` : '—' }, { label: 'Description', key: 'Description' }]));
    return container;
  }

  function registerImageModal() {
    modalForm('Register AMI', 'Register image', [
      { name: 'name', label: 'Image name', value: 'local-app-image' }, { name: 'description', label: 'Description', value: 'Registered from the Floci Dashboard' },
      { name: 'architecture', label: 'Architecture', type: 'select', options: [{ value: 'x86_64', label: 'x86_64' }, { value: 'arm64', label: 'arm64' }] },
      { name: 'root_device_name', label: 'Root device name', value: '/dev/xvda' },
      { name: 'block_device_mappings', label: 'Block device mappings JSON', type: 'textarea', value: '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":8,"VolumeType":"gp3","DeleteOnTermination":true}}]' },
    ], (values) => { let mappings; try { mappings = JSON.parse(values.block_device_mappings || '[]'); } catch (_error) { throw new Error('Block device mappings must be valid JSON.'); } return networkMutation('/api/ec2/images/', 'POST', { ...values, block_device_mappings: mappings }, 'AMI registered'); });
  }

  function imageSection() {
    return resourceTable('AMIs', images(), [{ label: 'Image ID', key: 'ImageId' }, { label: 'Name', key: 'Name' }, { label: 'Architecture', key: 'Architecture' }, { label: 'State', key: 'State' }, { label: 'Root device', key: 'RootDeviceName' }, { label: 'Description', key: 'Description' }], [btn('Register AMI', null, registerImageModal)]);
  }

  function launchDataFields() {
    return [
      { name: 'image_id', label: 'AMI', type: 'select', options: images().map((image) => ({ value: image.ImageId, label: `${image.Name || image.ImageId} · ${image.ImageId}` })) },
      { name: 'instance_type', label: 'Instance type', type: 'select', options: instanceTypes().map((item) => ({ value: item.InstanceType, label: item.InstanceType })) },
      { name: 'key_name', label: 'Key name' }, { name: 'security_group_ids', label: 'Security group IDs', value: 'sg-default' },
      { name: 'user_data', label: 'UserData', type: 'textarea' }, { name: 'tags', label: 'Instance tags JSON', type: 'textarea', value: '{"Name":"template-instance"}' },
    ];
  }

  function parsedLaunchData(values) {
    let tags; try { tags = JSON.parse(values.tags || '{}'); } catch (_error) { throw new Error('Tags must be valid JSON.'); }
    return { image_id: values.image_id, instance_type: values.instance_type, key_name: values.key_name || null, security_group_ids: values.security_group_ids.split(',').map((value) => value.trim()).filter(Boolean), user_data: values.user_data, tags };
  }

  function createTemplateModal() {
    modalForm('Create launch template', 'Create template', [{ name: 'name', label: 'Template name', value: 'local-app-template' }, ...launchDataFields()], (values) => networkMutation('/api/ec2/launch-templates/', 'POST', { name: values.name, data: parsedLaunchData(values) }, 'Launch template created'));
  }

  function templateSection() {
    const container = el('div'); container.append(ui.toolbar([btn('Create launch template', null, createTemplateModal)], [], 'ec2'));
    const grid = el('div', 'ec2-advanced-grid');
    launchTemplates().forEach((template) => {
      const card = el('section', 'ec2-panel ec2-advanced-card'); const heading = el('div', 'ec2-panel-heading'); const title = el('div');
      title.append(el('strong', null, template.LaunchTemplateName), el('span', 'ec2-detail-id', `${template.LaunchTemplateId} · default v${template.DefaultVersionNumber} · latest v${template.LatestVersionNumber}`));
      const actions = el('div', 'ec2-action-row');
      actions.append(btn('New version', 'ec2-btn-secondary', () => modalForm('Create launch template version', 'Create version', [{ name: 'source_version', label: 'Source version', value: String(template.DefaultVersionNumber || 1) }, ...launchDataFields()], (values) => networkMutation(`/api/ec2/launch-templates/${template.LaunchTemplateId}/versions/`, 'POST', { source_version: values.source_version, data: parsedLaunchData(values) }, 'Launch template version created'))), btn('Delete', 'ec2-btn-danger', () => { if (ui.confirmAction(`Delete ${template.LaunchTemplateName}?`)) networkMutation(`/api/ec2/launch-templates/${template.LaunchTemplateId}/`, 'DELETE', null, 'Launch template deleted'); }));
      heading.append(title, actions); card.append(heading);
      const versions = el('div', 'ec2-template-versions');
      launchTemplateVersions().filter((version) => version.LaunchTemplateId === template.LaunchTemplateId).forEach((version) => { const row = el('div', 'ec2-template-version'); row.append(el('span', null, `Version ${version.VersionNumber}${version.DefaultVersion ? ' · default' : ''} · ${version.LaunchTemplateData?.ImageId || 'inherited image'} · ${version.LaunchTemplateData?.InstanceType || 'inherited type'}`)); const setDefault = btn('Set default', 'ec2-btn-secondary', () => networkMutation(`/api/ec2/launch-templates/${template.LaunchTemplateId}/default-version/`, 'PUT', { version: version.VersionNumber }, 'Default version updated')); setDefault.disabled = Boolean(version.DefaultVersion); row.append(setDefault); versions.append(row); });
      card.append(versions); grid.append(card);
    });
    container.append(grid); return container;
  }

  function requestSpotModal() {
    modalForm('Request Spot instances', 'Request Spot instances', [
      { name: 'image_id', label: 'AMI', type: 'select', options: images().map((image) => ({ value: image.ImageId, label: `${image.Name || image.ImageId} · ${image.ImageId}` })) },
      { name: 'instance_type', label: 'Instance type', type: 'select', options: instanceTypes().map((item) => ({ value: item.InstanceType, label: item.InstanceType })) },
      { name: 'spot_price', label: 'Maximum Spot price', value: '0.01' }, { name: 'instance_count', label: 'Instance count', type: 'number', value: '1' },
      { name: 'subnet_id', label: 'Subnet', type: 'select', options: subnets().map((subnet) => ({ value: subnet.SubnetId, label: subnet.SubnetId })) },
      { name: 'security_group_ids', label: 'Security group IDs', value: 'sg-default' }, { name: 'tags', label: 'Request tags JSON', type: 'textarea', value: '{"Name":"local-spot-request"}' },
    ], (values) => { let tags; try { tags = JSON.parse(values.tags || '{}'); } catch (_error) { throw new Error('Tags must be valid JSON.'); } return networkMutation('/api/ec2/spot-requests/', 'POST', { ...values, instance_count: Number(values.instance_count), security_group_ids: values.security_group_ids.split(',').map((value) => value.trim()).filter(Boolean), tags }, 'Spot request created'); });
  }

  function spotSection() {
    return resourceTable('Spot requests', spotRequests(), [{ label: 'Request ID', key: 'SpotInstanceRequestId' }, { label: 'State', key: 'State' }, { label: 'Status', value: (item) => item.Status?.Message || item.Status?.Code }, { label: 'Price', key: 'SpotPrice' }, { label: 'Instance', key: 'InstanceId' }, { label: 'AMI / type', value: (item) => `${item.LaunchSpecification?.ImageId || '—'} / ${item.LaunchSpecification?.InstanceType || '—'}` }], [btn('Request Spot instances', null, requestSpotModal)], (item) => { const actions = el('div', 'ec2-action-row'); const cancel = btn('Cancel', 'ec2-btn-danger', () => { if (ui.confirmAction(`Cancel ${item.SpotInstanceRequestId}?`)) networkMutation(`/api/ec2/spot-requests/${item.SpotInstanceRequestId}/cancel/`, 'POST', {}, 'Spot request cancelled'); }); cancel.disabled = item.State === 'cancelled' || item.State === 'closed'; actions.append(cancel); return actions; });
  }

  function advancedView() {
    const container = el('div'); container.append(advancedNav());
    const sections = { nacls: naclSection, 'flow-logs': flowLogSection, storage: storageSection, images: imageSection, templates: templateSection, spot: spotSection };
    container.append((sections[state.advancedSection] || naclSection)()); return container;
  }

  function render() {
    if (!root) return;
    renderBreadcrumbs(); root.textContent = ''; root.append(navigation());
    if (state.view === 'overview') root.append(overview());
    else if (state.view === 'commands') root.append(commandsView());
    else if (state.view === 'network') root.append(networkView());
    else if (state.view === 'security') root.append(securityView());
    else if (state.view === 'advanced') root.append(advancedView());
    else root.append(instancesView());
    if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
  }

  function scheduleStatePoll() {
    window.clearTimeout(state.refreshTimer);
    if (instances().some((item) => transitionalStates.has(item.state))) state.refreshTimer = window.setTimeout(() => refresh({ quiet: true }), 2000);
  }

  async function refresh(options = {}) {
    if (state.loading) return;
    state.loading = true;
    if (!options.quiet) render();
    try {
      const data = await apiJson('/api/ec2/'); state.inventory = data;
      if (state.selectedInstanceId && !selectedInstance()) state.selectedInstanceId = '';
      state.loading = false;
      renderSummary(data.summary); render(); scheduleStatePoll();
      if (state.selectedInstanceId) loadCommands(state.selectedInstanceId, false);
    } finally { state.loading = false; }
  }

  function init() {
    if (!root) return;
    readLocation(); root.append(el('div', 'ec2-empty', 'Loading EC2 workbench…'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.EC2Console = EC2Console;
if (document.getElementById('ec2-console-root')) EC2Console.init();
