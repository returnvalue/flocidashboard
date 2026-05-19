/* global ServiceConsole */

const EC2Console = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('ec2-console-root');
  const breadcrumbsEl = document.getElementById('ec2-breadcrumbs');
  const summaryEl = document.getElementById('ec2-summary');
  const loadedAtEl = document.getElementById('ec2-loaded-at');

  const state = {
    inventory: null,
    selectedInstanceId: '',
    lastAction: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'ec2',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'ec2');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'ec2',
      toast,
    });

  function instances() {
    return state.inventory?.instances || [];
  }

  function images() {
    return state.inventory?.images || [];
  }

  function subnets() {
    return state.inventory?.subnets || [];
  }

  function securityGroups() {
    return state.inventory?.security_groups || [];
  }

  function keyPairs() {
    return state.inventory?.key_pairs || [];
  }

  function instanceTypes() {
    return state.inventory?.instance_types || [];
  }

  function selectedInstance() {
    return instances().find((instance) => instance.id === state.selectedInstanceId) || instances()[0] || null;
  }

  function stateName(instance) {
    return instance?.state || 'unknown';
  }

  function canStart(instance) {
    return ['stopped'].includes(stateName(instance));
  }

  function canStop(instance) {
    return ['pending', 'running'].includes(stateName(instance));
  }

  function canReboot(instance) {
    return stateName(instance) === 'running';
  }

  function canTerminate(instance) {
    return !['terminated', 'shutting-down'].includes(stateName(instance));
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'Amazon EC2');
    home.addEventListener('click', () => {
      state.selectedInstanceId = '';
      render();
    });
    breadcrumbsEl.append(home);
    const instance = selectedInstance();
    if (instance) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, instance.id));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'ec2',
      targets: {
        instances: 'Instances',
        vpcs: 'VPCs',
        subnets: 'Subnets',
        security_groups: 'Security groups',
        internet_gateways: 'Internet gateways',
        route_tables: 'Route tables',
        elastic_ips: 'Elastic IPs',
        key_pairs: 'Key pairs',
      },
    });
  }

  function option(select, value, label, selected = false) {
    const node = document.createElement('option');
    node.value = value || '';
    node.textContent = label || value || '';
    node.selected = selected;
    select.append(node);
  }

  function firstImageId() {
    const preferred = images().find((image) => image.ImageId === 'ami-amazonlinux2023');
    return preferred?.ImageId || images()[0]?.ImageId || 'ami-amazonlinux2023';
  }

  function firstInstanceType() {
    const preferred = instanceTypes().find((item) => item.InstanceType === 't2.micro');
    return preferred?.InstanceType || instanceTypes()[0]?.InstanceType || 't2.micro';
  }

  function firstSubnetId() {
    const preferred = subnets().find((subnet) => subnet.SubnetId === 'subnet-default-c' || subnet.DefaultForAz);
    return preferred?.SubnetId || subnets()[0]?.SubnetId || '';
  }

  function firstSecurityGroupId() {
    const preferred = securityGroups().find((group) => group.GroupId === 'sg-default' || group.GroupName === 'default');
    return preferred?.GroupId || securityGroups()[0]?.GroupId || '';
  }

  function firstKeyName() {
    const preferred = keyPairs().find((key) => key.KeyName === 'floci-key');
    return preferred?.KeyName || keyPairs()[0]?.KeyName || '';
  }

  function showLaunchModal() {
    const form = el('div');
    const imageSelect = document.createElement('select');
    const knownImageIds = new Set();
    images().forEach((image) => {
      knownImageIds.add(image.ImageId);
      option(imageSelect, image.ImageId, `${image.ImageId} ${image.Name ? `- ${image.Name}` : ''}`, image.ImageId === firstImageId());
    });
    ['ami-amazonlinux2023', 'ami-ubuntu2204'].forEach((imageId) => {
      if (!knownImageIds.has(imageId)) {
        option(imageSelect, imageId, imageId, imageId === firstImageId());
      }
    });

    const typeSelect = document.createElement('select');
    const knownTypes = new Set();
    instanceTypes().forEach((item) => {
      knownTypes.add(item.InstanceType);
      option(typeSelect, item.InstanceType, item.InstanceType, item.InstanceType === firstInstanceType());
    });
    ['t2.micro', 't3.micro'].forEach((instanceType) => {
      if (!knownTypes.has(instanceType)) {
        option(typeSelect, instanceType, instanceType, instanceType === firstInstanceType());
      }
    });

    const subnetSelect = document.createElement('select');
    option(subnetSelect, '', 'Default subnet');
    subnets().forEach((subnet) => option(
      subnetSelect,
      subnet.SubnetId,
      `${subnet.SubnetId} ${subnet.AvailabilityZone ? `(${subnet.AvailabilityZone})` : ''}`,
      subnet.SubnetId === firstSubnetId(),
    ));

    const sgSelect = document.createElement('select');
    option(sgSelect, '', 'Default security group');
    securityGroups().forEach((group) => option(
      sgSelect,
      group.GroupId,
      `${group.GroupId} ${group.GroupName ? `(${group.GroupName})` : ''}`,
      group.GroupId === firstSecurityGroupId(),
    ));

    const keySelect = document.createElement('select');
    option(keySelect, '', 'No key pair');
    keyPairs().forEach((key) => option(keySelect, key.KeyName, key.KeyName, key.KeyName === firstKeyName()));

    const profileInput = document.createElement('input');
    profileInput.placeholder = 'arn:aws:iam::000000000000:instance-profile/my-role';
    const userDataInput = document.createElement('textarea');
    userDataInput.className = 'ec2-userdata-input';
    userDataInput.placeholder = '#!/bin/sh\necho hello-from-floci > /tmp/hello.txt';

    form.append(
      el('label', null, 'AMI'),
      imageSelect,
      el('label', null, 'Instance type'),
      typeSelect,
      el('label', null, 'Subnet'),
      subnetSelect,
      el('label', null, 'Security group'),
      sgSelect,
      el('label', null, 'Key pair'),
      keySelect,
      el('label', null, 'IAM instance profile ARN'),
      profileInput,
      el('label', null, 'UserData script'),
      userDataInput,
    );

    openModal('Launch instance', form, 'Launch', async (close) => {
      const payload = {
        image_id: imageSelect.value,
        instance_type: typeSelect.value,
        subnet_id: subnetSelect.value || null,
        security_group_ids: sgSelect.value ? [sgSelect.value] : [],
        key_name: keySelect.value || null,
        iam_instance_profile_arn: profileInput.value.trim() || null,
        user_data: userDataInput.value,
      };
      const data = await apiJson('/api/ec2/instances/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      close();
      state.lastAction = data;
      state.selectedInstanceId = data.instance_id || state.selectedInstanceId;
      toast(data.instance_id ? `Instance launched: ${data.instance_id}` : 'Instance launched');
      await refresh();
    });
  }

  function showImportKeyModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'floci-key';
    const materialInput = document.createElement('textarea');
    materialInput.className = 'ec2-key-input';
    materialInput.placeholder = 'ssh-rsa AAAA... user@host';
    form.append(
      el('label', null, 'Key name'),
      nameInput,
      el('label', null, 'Public key material'),
      materialInput,
    );

    openModal('Import key pair', form, 'Import', async (close) => {
      const data = await apiJson('/api/ec2/key-pairs/import/', {
        method: 'POST',
        body: JSON.stringify({
          key_name: nameInput.value.trim(),
          public_key_material: materialInput.value.trim(),
        }),
      });
      close();
      toast(data.key_name ? `Key imported: ${data.key_name}` : 'Key imported');
      await refresh();
    });
  }

  function instanceActionPath(instance, action) {
    return `/api/ec2/instances/${encodeURIComponent(instance.id)}/${action}/`;
  }

  async function runInstanceAction(instance, action, label, destructive = false) {
    if (!instance) {
      return;
    }
    if (destructive && !window.confirm(`Terminate ${instance.id}?`)) {
      return;
    }
    const data = await apiJson(instanceActionPath(instance, action), { method: 'POST' });
    state.lastAction = data;
    toast(label);
    await refresh();
  }

  function renderInstanceRow(instance) {
    const active = instance.id === selectedInstance()?.id;
    const row = el('button', `ec2-instance-row${active ? ' ec2-instance-row-active' : ''}`);
    const meta = [
      instance.image_id,
      instance.instance_type,
      instance.private_ip,
      instance.key_name,
    ].filter(Boolean);
    row.append(
      el('span', 'ec2-instance-id', instance.id || 'Unnamed instance'),
      el('span', `ec2-state ec2-state-${stateName(instance)}`, stateName(instance)),
      el('span', 'ec2-instance-meta', meta.join(' / ') || 'No instance details'),
    );
    row.addEventListener('click', () => {
      state.selectedInstanceId = instance.id;
      render();
    });
    return row;
  }

  function renderInstanceList() {
    const panel = el('section', 'ec2-panel');
    panel.append(el('div', 'ec2-panel-heading', 'Instances'));
    const list = el('div', 'ec2-instance-list');
    if (!instances().length) {
      list.append(el('div', 'ec2-empty', 'No instances found.'));
    } else {
      instances().forEach((instance) => list.append(renderInstanceRow(instance)));
    }
    panel.append(list);
    return panel;
  }

  function cliSnippet(instance, command) {
    return `aws ec2 ${command} --instance-ids ${instance.id} --endpoint-url http://localhost:4566`;
  }

  function renderCliHints(instance) {
    const panel = el('div', 'ec2-hints');
    panel.append(el('h3', null, 'CLI snippets'));
    [
      `aws ec2 describe-instances --instance-ids ${instance.id} --endpoint-url http://localhost:4566`,
      cliSnippet(instance, 'stop-instances'),
      cliSnippet(instance, 'start-instances'),
      cliSnippet(instance, 'terminate-instances'),
    ].forEach((snippet) => panel.append(el('pre', 'ec2-snippet', snippet)));
    return panel;
  }

  function renderConnectionHints(instance) {
    const panel = el('div', 'ec2-hints');
    panel.append(el('h3', null, 'Connection and metadata'));
    const details = document.createElement('dl');
    consoleUi.addField(details, 'Public DNS', instance.public_dns);
    consoleUi.addField(details, 'Public IP', instance.public_ip);
    consoleUi.addField(details, 'Key name', instance.key_name);
    consoleUi.addField(details, 'IMDS host port', '9169 by default');
    consoleUi.addField(details, 'IMDS endpoints', [
      '/latest/meta-data/instance-id',
      '/latest/meta-data/local-ipv4',
      '/latest/meta-data/iam/security-credentials/',
      '/latest/user-data',
    ]);
    panel.append(details);
    return panel;
  }

  function renderSelectedInstance(instance) {
    const panel = el('section', 'ec2-panel');
    const heading = el('div', 'ec2-panel-heading');
    heading.append(
      el('span', null, instance ? instance.id : 'Instance details'),
      el('span', `ec2-state ec2-state-${stateName(instance)}`, instance ? stateName(instance) : ''),
    );
    panel.append(heading);

    const content = el('div', 'ec2-instance-detail');
    if (!instance) {
      content.append(el('div', 'ec2-empty', 'Launch or select an instance to manage it.'));
      panel.append(content);
      return panel;
    }

    const actions = el('div', 'ec2-action-row');
    const start = btn('Start', null, () => runInstanceAction(instance, 'start', 'Instance started'));
    const stop = btn('Stop', null, () => runInstanceAction(instance, 'stop', 'Instance stopped'));
    const reboot = btn('Reboot', null, () => runInstanceAction(instance, 'reboot', 'Instance rebooted'));
    const terminate = btn('Terminate', 'ec2-btn-danger', () => runInstanceAction(instance, 'terminate', 'Instance terminated', true));
    start.disabled = !canStart(instance);
    stop.disabled = !canStop(instance);
    reboot.disabled = !canReboot(instance);
    terminate.disabled = !canTerminate(instance);
    actions.append(start, stop, reboot, terminate);
    content.append(actions);

    const details = document.createElement('dl');
    consoleUi.addField(details, 'AMI', instance.image_id);
    consoleUi.addField(details, 'Instance type', instance.instance_type);
    consoleUi.addField(details, 'Architecture', instance.architecture);
    consoleUi.addField(details, 'State code', instance.state_code);
    consoleUi.addField(details, 'Launch time', instance.launch_time);
    consoleUi.addField(details, 'Availability zone', instance.placement?.AvailabilityZone);
    consoleUi.addField(details, 'VPC', instance.vpc_id);
    consoleUi.addField(details, 'Subnet', instance.subnet_id);
    consoleUi.addField(details, 'Private IP', instance.private_ip);
    consoleUi.addField(details, 'Private DNS', instance.private_dns);
    consoleUi.addField(details, 'Public IP', instance.public_ip);
    consoleUi.addField(details, 'Public DNS', instance.public_dns);
    consoleUi.addField(details, 'Security groups', instance.security_groups || []);
    consoleUi.addField(details, 'Network interfaces', instance.network_interfaces || []);
    consoleUi.addField(details, 'Root device', [instance.root_device_name, instance.root_device_type].filter(Boolean).join(' / '));
    consoleUi.addField(details, 'Monitoring', instance.monitoring);
    consoleUi.addField(details, 'Tags', instance.tags || []);
    content.append(details, renderConnectionHints(instance), renderCliHints(instance));
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const instance = selectedInstance();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Launch instance', null, showLaunchModal),
        btn('Import key pair', 'ec2-btn-secondary', showImportKeyModal),
      ],
      [],
    ));

    const workbench = el('div', 'ec2-workbench');
    workbench.append(renderInstanceList(), renderSelectedInstance(instance));
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
    const data = await apiJson('/api/ec2/');
    state.inventory = data;
    if (!selectedInstance() && instances().length) {
      state.selectedInstanceId = instances()[0].id;
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'ec2-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.EC2Console = EC2Console;

if (document.getElementById('ec2-console-root')) {
  EC2Console.init();
}
