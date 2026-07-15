/* global ServiceConsole */

const EKSConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('eks-console-root');
  const breadcrumbsEl = document.getElementById('eks-breadcrumbs');
  const summaryEl = document.getElementById('eks-summary');
  const loadedAtEl = document.getElementById('eks-loaded-at');

  const state = {
    inventory: null,
    selectedClusterName: '',
    activeView: 'overview',
    selectedNodegroupName: '',
    selectedFargateProfileName: '',
    resourceQuery: '',
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'eks',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'eks');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'eks',
      toast,
    });

  function clusters() {
    return state.inventory?.clusters || [];
  }

  function clusterName(cluster) {
    return cluster?.name || '';
  }

  function clusterArn(cluster) {
    return cluster?.arn || '';
  }

  function selectedCluster() {
    return clusters().find((cluster) => clusterName(cluster) === state.selectedClusterName) || clusters()[0] || null;
  }

  function nodegroupsForCluster(cluster) {
    const name = clusterName(cluster);
    const detailed = (state.inventory?.nodegroups || []).filter((nodegroup) => nodegroup.cluster_name === name);
    if (detailed.length) {
      return detailed;
    }
    return (cluster?.nodegroups || []).map((nodegroup) => (typeof nodegroup === 'string' ? { name: nodegroup, cluster_name: name } : nodegroup));
  }

  function fargateProfilesForCluster(cluster) {
    const name = clusterName(cluster);
    const detailed = (state.inventory?.fargate_profiles || []).filter((profile) => profile.cluster_name === name);
    if (detailed.length) {
      return detailed;
    }
    return (cluster?.fargate_profiles || []).map((profile) => (typeof profile === 'string' ? { name: profile, cluster_name: name } : profile));
  }

  function parseJson(value, fallback, label) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return fallback;
    }
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`${label} must be valid JSON`);
    }
  }

  function parseList(value) {
    return String(value || '')
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function matchesQuery(...values) {
    const query = state.resourceQuery.trim().toLowerCase();
    return !query || values.some((value) => JSON.stringify(value ?? '').toLowerCase().includes(query));
  }

  function resourceLink(label, href) {
    const link = el('a', 'eks-resource-link', label);
    link.href = href;
    return link;
  }

  async function copyText(value, message = 'Copied') {
    try {
      await navigator.clipboard.writeText(value);
      toast(message);
    } catch (error) {
      toast('Clipboard access is unavailable', true);
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'eks',
      targets: {
        clusters: 'Clusters',
        nodegroups: 'Node groups',
        fargate_profiles: 'Fargate profiles',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('EKS', null, () => {
      state.selectedClusterName = clusters()[0] ? clusterName(clusters()[0]) : '';
      render();
    }));
    const cluster = selectedCluster();
    if (cluster) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, clusterName(cluster)));
    }
  }

  function showCreateClusterModal() {
    const form = el('div', 'eks-modal-form');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'my-cluster';
    const roleInput = document.createElement('input');
    roleInput.value = 'arn:aws:iam::000000000000:role/eks-role';
    const versionInput = document.createElement('input');
    versionInput.placeholder = '1.29';
    const subnetsInput = document.createElement('input');
    subnetsInput.placeholder = 'subnet-123,subnet-456';
    const securityGroupsInput = document.createElement('input');
    securityGroupsInput.placeholder = 'sg-123,sg-456';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{"env":"local","team":"platform"}';
    form.append(
      el('label', null, 'Cluster name'),
      nameInput,
      el('label', null, 'Role ARN'),
      roleInput,
      el('label', null, 'Kubernetes version'),
      versionInput,
      el('label', null, 'Subnet IDs'),
      subnetsInput,
      el('label', null, 'Security group IDs'),
      securityGroupsInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Create EKS cluster', form, 'Create', async (close) => {
      const data = await apiJson('/api/eks/clusters/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          role_arn: roleInput.value.trim(),
          version: versionInput.value.trim(),
          subnet_ids: parseList(subnetsInput.value),
          security_group_ids: parseList(securityGroupsInput.value),
          tags: parseJson(tagsInput.value, {}, 'Tags'),
        }),
      });
      state.selectedClusterName = data.name || nameInput.value.trim();
      state.lastResult = data;
      close();
      toast('Cluster created');
      await refresh();
    });
  }

  function showTagsModal(resourceArn) {
    const form = el('div', 'eks-modal-form');
    const arnInput = document.createElement('input');
    arnInput.value = resourceArn || '';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{"env":"local"}';
    const keysInput = document.createElement('input');
    keysInput.placeholder = 'env,team';
    const result = el('pre', 'eks-result');
    result.hidden = true;
    form.append(
      el('label', null, 'Resource ARN'),
      arnInput,
      el('label', null, 'Add tags JSON'),
      tagsInput,
      btn('Add tags', null, async () => {
        try {
          const data = await apiJson('/api/eks/tags/', {
            method: 'POST',
            body: JSON.stringify({
              resource_arn: arnInput.value.trim(),
              tags: parseJson(tagsInput.value, {}, 'Tags'),
            }),
          });
          state.lastResult = data;
          toast('Tags added');
          await refresh();
        } catch (error) {
          toast(error.message, true);
        }
      }),
      el('label', null, 'Remove tag keys'),
      keysInput,
      btn('Remove tags', 'eks-btn-secondary', async () => {
        try {
          const data = await apiJson('/api/eks/tags/', {
            method: 'DELETE',
            body: JSON.stringify({
              resource_arn: arnInput.value.trim(),
              tag_keys: parseList(keysInput.value),
            }),
          });
          state.lastResult = data;
          toast('Tags removed');
          await refresh();
        } catch (error) {
          toast(error.message, true);
        }
      }),
      btn('Load tags', 'eks-btn-secondary', async () => {
        try {
          const data = await apiJson('/api/eks/tags/list/', {
            method: 'POST',
            body: JSON.stringify({ resource_arn: arnInput.value.trim() }),
          });
          result.hidden = false;
          result.textContent = JSON.stringify(consoleUi.displayValue(data.tags || {}), null, 2);
          state.lastResult = data;
        } catch (error) {
          toast(error.message, true);
        }
      }),
      result,
    );
    openModal('Cluster tags', form, 'Done', (close) => close());
  }

  function showCreateNodeGroupModal(cluster = selectedCluster()) {
    if (!cluster) {
      toast('Create or select a cluster first', true);
      return;
    }
    const form = el('div', 'eks-modal-form');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'local-workers';
    const roleInput = document.createElement('input');
    roleInput.value = 'arn:aws:iam::000000000000:role/eks-node-role';
    const subnetsInput = document.createElement('input');
    const clusterSubnets = cluster.resources_vpc_config?.subnetIds || cluster.resources_vpc_config?.subnet_ids || [];
    subnetsInput.value = Array.isArray(clusterSubnets) ? clusterSubnets.join(',') : '';
    subnetsInput.placeholder = 'subnet-123,subnet-456';
    const scalingInput = document.createElement('textarea');
    scalingInput.value = '{"minSize":1,"maxSize":2,"desiredSize":1}';
    const instanceTypesInput = document.createElement('input');
    instanceTypesInput.placeholder = 't3.small,t3.medium';
    const amiInput = document.createElement('input');
    amiInput.placeholder = 'AL2_x86_64';
    const capacityInput = document.createElement('input');
    capacityInput.placeholder = 'ON_DEMAND';
    const diskInput = document.createElement('input');
    diskInput.placeholder = '20';
    const labelsInput = document.createElement('textarea');
    labelsInput.placeholder = '{"role":"worker"}';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{"env":"local"}';
    form.append(
      el('label', null, 'Node group name'),
      nameInput,
      el('label', null, 'Node role ARN'),
      roleInput,
      el('label', null, 'Subnet IDs'),
      subnetsInput,
      el('label', null, 'Scaling config JSON'),
      scalingInput,
      el('label', null, 'Instance types'),
      instanceTypesInput,
      el('label', null, 'AMI type'),
      amiInput,
      el('label', null, 'Capacity type'),
      capacityInput,
      el('label', null, 'Disk size GiB'),
      diskInput,
      el('label', null, 'Labels JSON'),
      labelsInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Create managed node group', form, 'Create', async (close) => {
      const data = await apiJson(`/api/eks/clusters/${encodeURIComponent(clusterName(cluster))}/nodegroups/`, {
        method: 'POST',
        body: JSON.stringify({
          nodegroup_name: nameInput.value.trim(),
          node_role: roleInput.value.trim(),
          subnets: parseList(subnetsInput.value),
          scaling_config: parseJson(scalingInput.value, {}, 'Scaling config'),
          instance_types: parseList(instanceTypesInput.value),
          ami_type: amiInput.value.trim(),
          capacity_type: capacityInput.value.trim(),
          disk_size: diskInput.value.trim() || null,
          labels: parseJson(labelsInput.value, {}, 'Labels'),
          tags: parseJson(tagsInput.value, {}, 'Tags'),
        }),
      });
      state.lastResult = data;
      close();
      toast('Node group created');
      await refresh();
    });
  }

  function showCreateFargateProfileModal(cluster = selectedCluster()) {
    if (!cluster) {
      toast('Create or select a cluster first', true);
      return;
    }
    const form = el('div', 'eks-modal-form');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'default-workloads';
    const roleInput = document.createElement('input');
    roleInput.value = 'arn:aws:iam::000000000000:role/eks-fargate-pod-execution-role';
    const subnetsInput = document.createElement('input');
    const clusterSubnets = cluster.resources_vpc_config?.subnetIds || cluster.resources_vpc_config?.subnet_ids || [];
    subnetsInput.value = Array.isArray(clusterSubnets) ? clusterSubnets.join(',') : '';
    subnetsInput.placeholder = 'subnet-123,subnet-456';
    const selectorsInput = document.createElement('textarea');
    selectorsInput.value = '[{"namespace":"default","labels":{}}]';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{"env":"local"}';
    form.append(
      el('label', null, 'Fargate profile name'), nameInput,
      el('label', null, 'Pod execution role ARN'), roleInput,
      el('label', null, 'Subnet IDs'), subnetsInput,
      el('label', null, 'Selectors JSON'), selectorsInput,
      el('label', null, 'Tags JSON'), tagsInput,
    );
    openModal('Create Fargate profile', form, 'Create', async (close) => {
      const data = await apiJson(`/api/eks/clusters/${encodeURIComponent(clusterName(cluster))}/fargate-profiles/`, {
        method: 'POST',
        body: JSON.stringify({
          profile_name: nameInput.value.trim(),
          pod_execution_role_arn: roleInput.value.trim(),
          subnets: parseList(subnetsInput.value),
          selectors: parseJson(selectorsInput.value, [], 'Selectors'),
          tags: parseJson(tagsInput.value, {}, 'Tags'),
        }),
      });
      state.lastResult = data;
      close();
      toast('Fargate profile created');
      await refresh();
    });
  }

  async function deleteCluster(cluster) {
    if (!window.confirm('Delete this EKS cluster?')) {
      return;
    }
    const data = await apiJson('/api/eks/clusters/delete/', {
      method: 'POST',
      body: JSON.stringify({ name: clusterName(cluster) }),
    });
    state.lastResult = data;
    state.selectedClusterName = '';
    toast('Cluster deleted');
    await refresh();
  }

  async function deleteNodeGroup(cluster, nodegroup) {
    if (!window.confirm('Delete this EKS managed node group?')) {
      return;
    }
    const name = nodegroup.name || nodegroup.nodegroupName;
    const data = await apiJson(`/api/eks/clusters/${encodeURIComponent(clusterName(cluster))}/nodegroups/${encodeURIComponent(name)}/`, {
      method: 'DELETE',
    });
    state.lastResult = data;
    toast('Node group deleted');
    await refresh();
  }

  async function deleteFargateProfile(cluster, profile) {
    if (!window.confirm('Delete this EKS Fargate profile?')) {
      return;
    }
    const name = profile.name || profile.fargateProfileName;
    const data = await apiJson(`/api/eks/clusters/${encodeURIComponent(clusterName(cluster))}/fargate-profiles/${encodeURIComponent(name)}/`, {
      method: 'DELETE',
    });
    state.lastResult = data;
    toast('Fargate profile deleted');
    await refresh();
  }

  function renderClusterList() {
    const panel = el('section', 'eks-panel');
    panel.append(el('div', 'eks-panel-heading', 'Clusters'));
    const list = el('div', 'eks-cluster-list');
    if (!clusters().length) {
      list.append(el('div', 'eks-empty', 'No EKS clusters found.'));
    } else {
      clusters().forEach((cluster) => {
        const active = clusterName(cluster) === clusterName(selectedCluster());
        const row = el('button', `eks-cluster-row${active ? ' eks-cluster-row-active' : ''}`);
        row.append(
          el('span', 'eks-cluster-name', clusterName(cluster)),
          el('span', 'eks-cluster-meta', `${cluster.status || 'Unknown'} / ${cluster.version || 'default version'}`),
        );
        row.addEventListener('click', () => {
          state.selectedClusterName = clusterName(cluster);
          render();
        });
        list.append(row);
      });
    }
    panel.append(list);
    return panel;
  }

  function renderClusterDetail(cluster) {
    const panel = el('section', 'eks-panel');
    panel.append(el('div', 'eks-panel-heading', 'Selected cluster'));
    const body = el('div', 'eks-detail');
    const facts = el('dl', 'eks-facts');
    consoleUi.addField(facts, 'Cluster', clusterName(cluster));
    consoleUi.addField(facts, 'ARN', clusterArn(cluster));
    consoleUi.addField(facts, 'Status', cluster.status);
    consoleUi.addField(facts, 'Version', cluster.version);
    consoleUi.addField(facts, 'Endpoint', cluster.endpoint);
    consoleUi.addField(facts, 'Role ARN', cluster.role_arn);
    consoleUi.addField(facts, 'Created at', cluster.created_at);
    consoleUi.addField(facts, 'VPC config', cluster.resources_vpc_config);
    consoleUi.addField(facts, 'Certificate authority', cluster.certificate_authority);
    consoleUi.addField(facts, 'Platform version', cluster.platform_version);
    consoleUi.addField(facts, 'Kubernetes network', cluster.kubernetes_network_config);
    consoleUi.addField(facts, 'Tags', cluster.tags);
    body.append(facts);
    if (cluster.role_arn) body.append(resourceLink('Open cluster role in IAM', `/service/iam/?resource=${encodeURIComponent(cluster.role_arn)}`));
    const actions = el('div', 'eks-action-row');
    actions.append(
      btn('Create node group', null, () => showCreateNodeGroupModal(cluster)),
      btn('Create Fargate profile', 'eks-btn-secondary', () => showCreateFargateProfileModal(cluster)),
      btn('Tags', 'eks-btn-secondary', () => showTagsModal(clusterArn(cluster))),
      btn('Delete cluster', 'eks-btn-danger', () => deleteCluster(cluster).catch((error) => toast(error.message, true))),
    );
    body.append(actions);
    panel.append(body);
    return panel;
  }

  function renderNodeGroupsPanel(cluster) {
    const panel = el('section', 'eks-panel');
    const heading = el('div', 'eks-panel-heading');
    heading.append(el('span', null, 'Managed node groups'), btn('Create node group', 'eks-btn-secondary', () => showCreateNodeGroupModal(cluster)));
    panel.append(heading);
    const body = el('div', 'eks-resource-layout');
    const list = el('div', 'eks-resource-list');
    const detail = el('div', 'eks-resource-detail');
    const nodegroups = nodegroupsForCluster(cluster).filter((nodegroup) => matchesQuery(nodegroup.name, nodegroup.arn, nodegroup.status, nodegroup.labels));
    if (!nodegroups.length) {
      detail.append(el('div', 'eks-empty', 'No managed node groups match the current filter.'));
    }
    nodegroups.forEach((nodegroup) => {
      const name = nodegroup.name || nodegroup.nodegroupName || 'Node group';
      list.append(btn(`${name} · ${nodegroup.status || 'Unknown'}`, name === (state.selectedNodegroupName || nodegroups[0]?.name) ? 'eks-btn-active' : 'eks-btn-secondary', () => { state.selectedNodegroupName = name; render(); }));
    });
    const nodegroup = nodegroups.find((item) => (item.name || item.nodegroupName) === state.selectedNodegroupName) || nodegroups[0];
    if (nodegroup) {
      const card = el('article', 'eks-card');
      const name = nodegroup.name || nodegroup.nodegroupName || 'Node group';
      card.append(el('h3', null, name));
      const facts = el('dl', 'eks-facts');
      consoleUi.addField(facts, 'ARN', nodegroup.arn);
      consoleUi.addField(facts, 'Status', nodegroup.status);
      consoleUi.addField(facts, 'Capacity type', nodegroup.capacity_type);
      consoleUi.addField(facts, 'Scaling config', nodegroup.scaling_config);
      consoleUi.addField(facts, 'Instance types', nodegroup.instance_types);
      consoleUi.addField(facts, 'AMI type', nodegroup.ami_type);
      consoleUi.addField(facts, 'Disk size', nodegroup.disk_size);
      consoleUi.addField(facts, 'Version', nodegroup.version);
      consoleUi.addField(facts, 'Subnets', nodegroup.subnets);
      consoleUi.addField(facts, 'Node role', nodegroup.node_role);
      consoleUi.addField(facts, 'Labels', nodegroup.labels);
      consoleUi.addField(facts, 'Tags', nodegroup.tags);
      consoleUi.addField(facts, 'Health', nodegroup.health);
      consoleUi.addField(facts, 'Created', nodegroup.created_at);
      consoleUi.addField(facts, 'Modified', nodegroup.modified_at);
      card.append(facts);
      if (nodegroup.node_role) card.append(resourceLink('Open node role in IAM', `/service/iam/?resource=${encodeURIComponent(nodegroup.node_role)}`));
      const actions = el('div', 'eks-action-row');
      actions.append(btn('Delete node group', 'eks-btn-danger', () => deleteNodeGroup(cluster, nodegroup).catch((error) => toast(error.message, true))));
      card.append(actions);
      detail.append(card);
    }
    body.append(list, detail);
    panel.append(body);
    return panel;
  }

  function renderFargateProfilesPanel(cluster) {
    const panel = el('section', 'eks-panel');
    const heading = el('div', 'eks-panel-heading');
    heading.append(el('span', null, 'Fargate profiles'), btn('Create Fargate profile', 'eks-btn-secondary', () => showCreateFargateProfileModal(cluster)));
    panel.append(heading);
    const body = el('div', 'eks-resource-layout');
    const list = el('div', 'eks-resource-list');
    const detail = el('div', 'eks-resource-detail');
    const profiles = fargateProfilesForCluster(cluster).filter((profile) => matchesQuery(profile.name, profile.arn, profile.status, profile.selectors));
    if (!profiles.length) {
      detail.append(el('div', 'eks-empty', 'No Fargate profiles match the current filter.'));
    }
    profiles.forEach((profile) => {
      const name = profile.name || profile.fargateProfileName || 'Fargate profile';
      list.append(btn(`${name} · ${profile.status || 'Unknown'}`, name === (state.selectedFargateProfileName || profiles[0]?.name) ? 'eks-btn-active' : 'eks-btn-secondary', () => { state.selectedFargateProfileName = name; render(); }));
    });
    const profile = profiles.find((item) => (item.name || item.fargateProfileName) === state.selectedFargateProfileName) || profiles[0];
    if (profile) {
      const card = el('article', 'eks-card');
      const name = profile.name || profile.fargateProfileName || 'Fargate profile';
      card.append(el('h3', null, name));
      const facts = el('dl', 'eks-facts');
      consoleUi.addField(facts, 'ARN', profile.arn);
      consoleUi.addField(facts, 'Status', profile.status);
      consoleUi.addField(facts, 'Pod execution role', profile.pod_execution_role_arn);
      consoleUi.addField(facts, 'Subnets', profile.subnets);
      consoleUi.addField(facts, 'Selectors', profile.selectors);
      consoleUi.addField(facts, 'Tags', profile.tags);
      consoleUi.addField(facts, 'Health', profile.health);
      consoleUi.addField(facts, 'Created', profile.created_at);
      card.append(facts);
      if (profile.pod_execution_role_arn) card.append(resourceLink('Open pod execution role in IAM', `/service/iam/?resource=${encodeURIComponent(profile.pod_execution_role_arn)}`));
      const actions = el('div', 'eks-action-row');
      actions.append(btn('Delete Fargate profile', 'eks-btn-danger', () => deleteFargateProfile(cluster, profile).catch((error) => toast(error.message, true))));
      card.append(actions);
      detail.append(card);
    }
    body.append(list, detail);
    panel.append(body);
    return panel;
  }

  function renderResourceTabs() {
    const tabs = el('div', 'eks-resource-tabs');
    const navigation = el('div', 'eks-resource-tab-buttons');
    [['overview', 'Overview'], ['nodegroups', 'Node groups'], ['fargate', 'Fargate profiles'], ['connection', 'Connection']].forEach(([key, label]) => {
      navigation.append(btn(label, state.activeView === key ? 'eks-btn-active' : 'eks-btn-secondary', () => { state.activeView = key; render(); }));
    });
    const search = document.createElement('input');
    search.type = 'search'; search.placeholder = 'Filter current resources'; search.value = state.resourceQuery;
    search.setAttribute('aria-label', 'Filter current EKS resources');
    search.addEventListener('input', () => { state.resourceQuery = search.value; });
    search.addEventListener('change', render);
    search.addEventListener('keydown', (event) => { if (event.key === 'Enter') render(); });
    tabs.append(navigation, search);
    return tabs;
  }

  function renderConnectionPanel(cluster) {
    const panel = el('section', 'eks-panel');
    panel.append(el('div', 'eks-panel-heading', 'Connect to the local Kubernetes control plane'));
    const body = el('div', 'eks-detail');
    const facts = el('dl', 'eks-facts');
    consoleUi.addField(facts, 'Endpoint', cluster.endpoint);
    consoleUi.addField(facts, 'Certificate authority data', cluster.certificate_authority?.data);
    body.append(facts);
    const updateCommand = `aws eks update-kubeconfig --name ${clusterName(cluster)}`;
    const kubectlCommand = 'kubectl get nodes';
    [[updateCommand, 'Copy update-kubeconfig command'], [kubectlCommand, 'Copy kubectl command']].forEach(([command, label]) => {
      const row = el('div', 'eks-command-row');
      row.append(el('code', null, command), btn(label, 'eks-btn-secondary', () => copyText(command, 'Command copied')));
      body.append(row);
    });
    body.append(el('p', 'eks-empty', 'Floci real mode runs k3s and supports the native AWS update-kubeconfig and token-authentication flow. Mock mode provides metadata only.'));
    panel.append(body); return panel;
  }

  function renderResult() {
    if (!state.lastResult) {
      return null;
    }
    const panel = el('section', 'eks-panel');
    panel.append(el('div', 'eks-panel-heading', 'Last action result'));
    const pre = el('pre', 'eks-result');
    pre.textContent = JSON.stringify(consoleUi.displayValue(state.lastResult), null, 2);
    panel.append(pre);
    return panel;
  }

  function renderWorkbench() {
    const workbench = el('div', 'eks-workbench');
    const cluster = selectedCluster();
    workbench.append(renderClusterList());
    const detail = el('div', 'eks-detail-stack');
    detail.append(renderResourceTabs());
    if (!cluster) {
      detail.append(el('section', 'eks-panel eks-empty-panel', 'Create a cluster to start testing local EKS metadata and k3s-backed control planes.'));
    } else {
      if (state.activeView === 'overview') detail.append(renderClusterDetail(cluster));
      if (state.activeView === 'nodegroups') detail.append(renderNodeGroupsPanel(cluster));
      if (state.activeView === 'fargate') detail.append(renderFargateProfilesPanel(cluster));
      if (state.activeView === 'connection') detail.append(renderConnectionPanel(cluster));
    }
    const result = renderResult();
    if (result) {
      detail.append(result);
    }
    workbench.append(detail);
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
      [btn('Create cluster', null, showCreateClusterModal), btn('Create node group', 'eks-btn-secondary', () => showCreateNodeGroupModal()), btn('Create Fargate profile', 'eks-btn-secondary', () => showCreateFargateProfileModal())],
      [el('span', 'eks-toolbar-note', 'Cluster, managed node group, and Fargate profile lifecycle')],
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
    const data = await apiJson('/api/eks/');
    state.inventory = data;
    if (!state.selectedClusterName && clusters()[0]) {
      state.selectedClusterName = clusterName(clusters()[0]);
    }
    render();
  }

  return { refresh };
})();

window.EKSConsole = EKSConsole;
