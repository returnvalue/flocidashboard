/* global ServiceConsole */

const NeptuneConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('neptune-console-root');
  const breadcrumbsEl = document.getElementById('neptune-breadcrumbs');
  const summaryEl = document.getElementById('neptune-summary');
  const loadedAtEl = document.getElementById('neptune-loaded-at');

  const state = {
    inventory: null,
    selectedClusterId: '',
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'neptune',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'neptune');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'neptune',
      toast,
    });

  function clusters() {
    return state.inventory?.clusters || [];
  }

  function instances() {
    return state.inventory?.instances || [];
  }

  function clusterId(cluster) {
    return cluster?.DBClusterIdentifier || cluster?.DBClusterArn || '';
  }

  function instanceId(instance) {
    return instance?.DBInstanceIdentifier || instance?.DBInstanceArn || '';
  }

  function selectedCluster() {
    return clusters().find((cluster) => clusterId(cluster) === state.selectedClusterId) || clusters()[0] || null;
  }

  function clusterInstances(cluster = selectedCluster()) {
    const id = clusterId(cluster);
    return instances().filter((instance) => instance.DBClusterIdentifier === id);
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

  function gremlinEndpoint(cluster) {
    const endpoint = cluster?.Endpoint || 'localhost';
    const port = cluster?.Port || 8182;
    return `ws://${endpoint}:${port}/gremlin`;
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('Neptune', null, () => {
      state.selectedClusterId = clusters()[0] ? clusterId(clusters()[0]) : '';
      render();
    }));
    const cluster = selectedCluster();
    if (cluster) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, clusterId(cluster)));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'neptune',
      targets: {
        clusters: 'Clusters',
        instances: 'Instances',
        subnet_groups: 'Subnet groups',
        cluster_snapshots: 'Cluster snapshots',
        available_sdk_operations: 'Available SDK operations',
      },
    });
  }

  function showCreateClusterModal() {
    const form = el('div', 'neptune-modal-form');
    const identifierInput = document.createElement('input');
    identifierInput.placeholder = 'my-neptune';
    const engineInput = document.createElement('input');
    engineInput.value = 'neptune';
    const optionsInput = document.createElement('textarea');
    optionsInput.placeholder = '{"BackupRetentionPeriod":1}';
    form.append(
      el('label', null, 'DB cluster identifier'),
      identifierInput,
      el('label', null, 'Engine'),
      engineInput,
      el('label', null, 'Cluster options JSON'),
      optionsInput,
    );
    openModal('Create Neptune cluster', form, 'Create', async (close) => {
      const data = await apiJson('/api/neptune/clusters/', {
        method: 'POST',
        body: JSON.stringify({
          identifier: identifierInput.value.trim(),
          engine: engineInput.value.trim(),
          options: parseJson(optionsInput.value, {}, 'Cluster options'),
        }),
      });
      state.selectedClusterId = data.cluster_identifier || identifierInput.value.trim();
      state.lastResult = data;
      close();
      toast('Cluster created');
      await refresh();
    });
  }

  function showModifyClusterModal(cluster) {
    const form = el('div', 'neptune-modal-form');
    const optionsInput = document.createElement('textarea');
    optionsInput.value = JSON.stringify({ ApplyImmediately: true }, null, 2);
    form.append(
      el('label', null, 'Cluster options JSON'),
      optionsInput,
    );
    openModal('Modify cluster', form, 'Save', async (close) => {
      const data = await apiJson(`/api/neptune/clusters/${encodeURIComponent(clusterId(cluster))}/`, {
        method: 'PATCH',
        body: JSON.stringify({ options: parseJson(optionsInput.value, {}, 'Cluster options') }),
      });
      state.lastResult = data;
      close();
      toast('Cluster modified');
      await refresh();
    });
  }

  function showCreateInstanceModal(cluster = selectedCluster()) {
    const form = el('div', 'neptune-modal-form');
    const identifierInput = document.createElement('input');
    identifierInput.placeholder = 'my-neptune-instance';
    const clusterInput = document.createElement('input');
    clusterInput.value = cluster ? clusterId(cluster) : '';
    const classInput = document.createElement('input');
    classInput.value = 'db.r5.large';
    const engineInput = document.createElement('input');
    engineInput.value = 'neptune';
    const optionsInput = document.createElement('textarea');
    optionsInput.placeholder = '{"AutoMinorVersionUpgrade":true}';
    form.append(
      el('label', null, 'DB instance identifier'),
      identifierInput,
      el('label', null, 'DB cluster identifier'),
      clusterInput,
      el('label', null, 'DB instance class'),
      classInput,
      el('label', null, 'Engine'),
      engineInput,
      el('label', null, 'Instance options JSON'),
      optionsInput,
    );
    openModal('Create Neptune instance', form, 'Create', async (close) => {
      const data = await apiJson('/api/neptune/instances/', {
        method: 'POST',
        body: JSON.stringify({
          identifier: identifierInput.value.trim(),
          cluster_identifier: clusterInput.value.trim(),
          instance_class: classInput.value.trim(),
          engine: engineInput.value.trim(),
          options: parseJson(optionsInput.value, {}, 'Instance options'),
        }),
      });
      state.selectedClusterId = clusterInput.value.trim();
      state.lastResult = data;
      close();
      toast('Instance created');
      await refresh();
    });
  }

  function showModifyInstanceModal(instance) {
    const form = el('div', 'neptune-modal-form');
    const optionsInput = document.createElement('textarea');
    optionsInput.value = JSON.stringify({ ApplyImmediately: true }, null, 2);
    form.append(
      el('label', null, 'Instance options JSON'),
      optionsInput,
    );
    openModal('Modify instance', form, 'Save', async (close) => {
      const data = await apiJson(`/api/neptune/instances/${encodeURIComponent(instanceId(instance))}/`, {
        method: 'PATCH',
        body: JSON.stringify({ options: parseJson(optionsInput.value, {}, 'Instance options') }),
      });
      state.lastResult = data;
      close();
      toast('Instance modified');
      await refresh();
    });
  }

  async function deleteCluster(cluster) {
    if (!window.confirm(`Delete Neptune cluster ${clusterId(cluster)} and stop its Gremlin container?`)) {
      return;
    }
    const data = await apiJson(`/api/neptune/clusters/${encodeURIComponent(clusterId(cluster))}/`, {
      method: 'DELETE',
      body: JSON.stringify({ skip_final_snapshot: true }),
    });
    state.lastResult = data;
    state.selectedClusterId = '';
    toast('Cluster deleted');
    await refresh();
  }

  async function deleteInstance(instance) {
    if (!window.confirm(`Delete Neptune instance ${instanceId(instance)}?`)) {
      return;
    }
    const data = await apiJson(`/api/neptune/instances/${encodeURIComponent(instanceId(instance))}/`, {
      method: 'DELETE',
    });
    state.lastResult = data;
    toast('Instance deleted');
    await refresh();
  }

  async function copyEndpoint(cluster) {
    await navigator.clipboard.writeText(gremlinEndpoint(cluster));
    toast('Gremlin endpoint copied');
  }

  function renderClusterRow(cluster) {
    const id = clusterId(cluster);
    const active = id === clusterId(selectedCluster());
    const row = el('button', `neptune-cluster-row${active ? ' neptune-cluster-row-active' : ''}`);
    row.append(
      el('span', 'neptune-cluster-name', id || 'Cluster'),
      el('span', 'neptune-cluster-meta', `${cluster.Status || 'UNKNOWN'} / ${cluster.Endpoint || 'endpoint pending'}`),
    );
    row.addEventListener('click', () => {
      state.selectedClusterId = id;
      render();
    });
    return row;
  }

  function renderClusterList() {
    const panel = el('section', 'neptune-panel');
    panel.append(el('div', 'neptune-panel-heading', 'Clusters'));
    const list = el('div', 'neptune-cluster-list');
    if (!clusters().length) {
      list.append(el('div', 'neptune-empty', 'No Neptune clusters found.'));
    } else {
      clusters().forEach((cluster) => list.append(renderClusterRow(cluster)));
    }
    panel.append(list);
    return panel;
  }

  function renderClusterFacts(cluster) {
    const facts = document.createElement('dl');
    consoleUi.addField(facts, 'ARN', cluster.DBClusterArn);
    consoleUi.addField(facts, 'Status', cluster.Status);
    consoleUi.addField(facts, 'Engine', cluster.Engine);
    consoleUi.addField(facts, 'Engine version', cluster.EngineVersion);
    consoleUi.addField(facts, 'Endpoint', cluster.Endpoint);
    consoleUi.addField(facts, 'Port', cluster.Port);
    consoleUi.addField(facts, 'Gremlin WebSocket', gremlinEndpoint(cluster));
    consoleUi.addField(facts, 'Reader endpoint', cluster.ReaderEndpoint);
    consoleUi.addField(facts, 'Members', cluster.DBClusterMembers);
    return facts;
  }

  function renderInstances(cluster) {
    const wrapper = el('div', 'neptune-card-list');
    const related = clusterInstances(cluster);
    if (!related.length) {
      wrapper.append(el('p', 'neptune-empty', 'No instances found for this cluster.'));
      return wrapper;
    }
    related.forEach((instance) => {
      const card = el('article', 'neptune-card');
      card.append(el('h3', null, instanceId(instance)));
      const facts = document.createElement('dl');
      consoleUi.addField(facts, 'Status', instance.DBInstanceStatus);
      consoleUi.addField(facts, 'Class', instance.DBInstanceClass);
      consoleUi.addField(facts, 'Engine', instance.Engine);
      consoleUi.addField(facts, 'Endpoint', instance.Endpoint);
      card.append(facts);
      const actions = el('div', 'neptune-action-row');
      actions.append(
        btn('Modify', 'neptune-btn-secondary', () => showModifyInstanceModal(instance)),
        btn('Delete', 'neptune-btn-danger', () => deleteInstance(instance).catch((error) => toast(error.message, true))),
      );
      card.append(actions);
      wrapper.append(card);
    });
    return wrapper;
  }

  function renderSnippet(cluster) {
    const snippet = el('pre', 'neptune-snippet');
    snippet.textContent = [
      'from gremlin_python.driver import client, serializer',
      '',
      `gremlin = client.Client("${gremlinEndpoint(cluster)}", "g",`,
      '    message_serializer=serializer.GraphSONSerializersV2d0())',
      'gremlin.submit("g.V().valueMap(true)").all().result()',
      'gremlin.close()',
    ].join('\n');
    return snippet;
  }

  function renderLastResult() {
    if (!state.lastResult) {
      return null;
    }
    const result = el('div', 'neptune-last-result');
    result.append(el('h3', null, 'Last action result'));
    const pre = el('pre', 'neptune-result');
    pre.textContent = JSON.stringify(consoleUi.displayValue(state.lastResult), null, 2);
    result.append(pre);
    return result;
  }

  function renderClusterDetail(cluster) {
    const panel = el('section', 'neptune-panel');
    const heading = el('div', 'neptune-panel-heading');
    heading.append(
      el('span', null, cluster ? clusterId(cluster) : 'Neptune workbench'),
      el('span', 'neptune-cluster-meta', cluster ? `${cluster.Status || 'UNKNOWN'} / Gremlin proxy` : 'No cluster selected'),
    );
    panel.append(heading);

    const content = el('div', 'neptune-detail');
    if (!cluster) {
      content.append(el('div', 'neptune-empty', 'Create a cluster or refresh after your app creates one.'));
      panel.append(content);
      return panel;
    }
    content.append(renderClusterFacts(cluster));
    const actions = el('div', 'neptune-action-row');
    actions.append(
      btn('Create instance', null, () => showCreateInstanceModal(cluster)),
      btn('Copy endpoint', 'neptune-btn-secondary', () => copyEndpoint(cluster).catch((error) => toast(error.message, true))),
      btn('Modify cluster', 'neptune-btn-secondary', () => showModifyClusterModal(cluster)),
      btn('Delete cluster', 'neptune-btn-danger', () => deleteCluster(cluster).catch((error) => toast(error.message, true))),
    );
    content.append(actions, el('h3', null, 'Gremlin client snippet'), renderSnippet(cluster), el('h3', null, 'Instances'), renderInstances(cluster));
    const result = renderLastResult();
    if (result) {
      content.append(result);
    }
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const cluster = selectedCluster();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create cluster', null, showCreateClusterModal),
        btn('Create instance', 'neptune-btn-secondary', () => showCreateInstanceModal()),
        btn('Refresh', 'neptune-btn-secondary', () => refresh().catch((error) => toast(error.message, true))),
      ],
      [el('span', 'neptune-toolbar-note', 'Gremlin Server containers are exposed through local proxy ports')],
    ));
    const workbench = el('div', 'neptune-workbench');
    workbench.append(renderClusterList(), renderClusterDetail(cluster));
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
    const data = await apiJson('/api/neptune/');
    state.inventory = data;
    if (!selectedCluster() && clusters().length) {
      state.selectedClusterId = clusterId(clusters()[0]);
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'neptune-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.NeptuneConsole = NeptuneConsole;

if (document.getElementById('neptune-console-root')) {
  NeptuneConsole.init();
}
