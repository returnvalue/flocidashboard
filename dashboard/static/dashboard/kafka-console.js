/* global ServiceConsole */

const KafkaConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('kafka-console-root');
  const breadcrumbsEl = document.getElementById('kafka-breadcrumbs');
  const summaryEl = document.getElementById('kafka-summary');
  const loadedAtEl = document.getElementById('kafka-loaded-at');

  const state = {
    inventory: null,
    selectedClusterArn: '',
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'kafka',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'kafka');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'kafka',
      toast,
    });

  function clusters() {
    return state.inventory?.clusters || [];
  }

  function clusterArn(cluster) {
    return cluster?.arn || '';
  }

  function clusterName(cluster) {
    return cluster?.name || clusterArn(cluster) || 'Cluster';
  }

  function selectedCluster() {
    return clusters().find((cluster) => clusterArn(cluster) === state.selectedClusterArn) || clusters()[0] || null;
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

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('MSK / Kafka', null, () => {
      state.selectedClusterArn = clusters()[0] ? clusterArn(clusters()[0]) : '';
      render();
    }));
    const cluster = selectedCluster();
    if (cluster) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, clusterName(cluster)));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'kafka',
      targets: {
        clusters: 'Clusters',
        nodes: 'Nodes',
        operations: 'Operations',
        configurations: 'Configurations',
        kafka_versions: 'Kafka versions',
        scram_secrets: 'Clusters',
        client_vpc_connections: 'Clusters',
      },
    });
  }

  function showCreateClusterModal() {
    const form = el('div', 'kafka-modal-form');
    const apiMode = document.createElement('select');
    apiMode.append(new Option('CreateCluster', 'v1'), new Option('CreateClusterV2', 'v2'));
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'my-cluster';
    const versionInput = document.createElement('input');
    versionInput.value = '3.6.1';
    const brokerCountInput = document.createElement('input');
    brokerCountInput.type = 'number';
    brokerCountInput.min = '1';
    brokerCountInput.value = '1';
    const brokerInfoInput = document.createElement('textarea');
    brokerInfoInput.value = JSON.stringify({
      InstanceType: 'kafka.m5.large',
      ClientSubnets: ['subnet-1'],
    }, null, 2);
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{"env":"local"}';
    form.append(
      el('label', null, 'API'),
      apiMode,
      el('label', null, 'Cluster name'),
      nameInput,
      el('label', null, 'Kafka version'),
      versionInput,
      el('label', null, 'Broker nodes'),
      brokerCountInput,
      el('label', null, 'Broker node group info JSON'),
      brokerInfoInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Create MSK cluster', form, 'Create', async (close) => {
      const data = await apiJson(apiMode.value === 'v2' ? '/api/kafka/clusters/v2/' : '/api/kafka/clusters/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          kafka_version: versionInput.value.trim(),
          number_of_broker_nodes: Number(brokerCountInput.value || 1),
          broker_node_group_info: parseJson(brokerInfoInput.value, {}, 'Broker node group info'),
          tags: parseJson(tagsInput.value, {}, 'Tags'),
        }),
      });
      state.selectedClusterArn = data.arn || '';
      state.lastResult = data;
      close();
      toast('Cluster creation requested');
      await refresh();
    });
  }

  async function deleteCluster(cluster) {
    if (!window.confirm(`Delete MSK cluster ${clusterName(cluster)} and remove its Redpanda container?`)) {
      return;
    }
    const data = await apiJson(`/api/kafka/clusters/${encodeURIComponent(clusterArn(cluster))}/`, {
      method: 'DELETE',
    });
    state.lastResult = data;
    state.selectedClusterArn = '';
    toast('Cluster deletion requested');
    await refresh();
  }

  async function loadBootstrapBrokers(cluster) {
    const data = await apiJson(`/api/kafka/clusters/${encodeURIComponent(clusterArn(cluster))}/bootstrap-brokers/`);
    state.lastResult = data;
    toast('Bootstrap brokers loaded');
    render();
  }

  async function copyBootstrap(cluster) {
    const brokers = cluster.bootstrap_brokers || {};
    const text = brokers.BootstrapBrokerString
      || brokers.BootstrapBrokerStringTls
      || brokers.BootstrapBrokerStringSaslScram
      || '';
    if (!text) {
      toast('No bootstrap broker string is available yet', true);
      return;
    }
    await navigator.clipboard.writeText(text);
    toast('Bootstrap brokers copied');
  }

  function renderClusterRow(cluster) {
    const arn = clusterArn(cluster);
    const active = arn === clusterArn(selectedCluster());
    const row = el('button', `kafka-cluster-row${active ? ' kafka-cluster-row-active' : ''}`);
    row.append(
      el('span', 'kafka-cluster-name', clusterName(cluster)),
      el('span', 'kafka-cluster-meta', `${cluster.state || 'UNKNOWN'} / ${cluster.kafka_version || 'version pending'}`),
    );
    row.addEventListener('click', () => {
      state.selectedClusterArn = arn;
      render();
    });
    return row;
  }

  function renderClusterList() {
    const panel = el('section', 'kafka-panel');
    panel.append(el('div', 'kafka-panel-heading', 'Clusters'));
    const list = el('div', 'kafka-cluster-list');
    if (!clusters().length) {
      list.append(el('div', 'kafka-empty', 'No MSK clusters found.'));
    } else {
      clusters().forEach((cluster) => list.append(renderClusterRow(cluster)));
    }
    panel.append(list);
    return panel;
  }

  function renderClusterFacts(cluster) {
    const facts = document.createElement('dl');
    consoleUi.addField(facts, 'ARN', cluster.arn);
    consoleUi.addField(facts, 'State', cluster.state);
    consoleUi.addField(facts, 'Type', cluster.type);
    consoleUi.addField(facts, 'Kafka version', cluster.kafka_version);
    consoleUi.addField(facts, 'Broker nodes', cluster.number_of_broker_nodes);
    consoleUi.addField(facts, 'Current version', cluster.current_version);
    consoleUi.addField(facts, 'Created', cluster.created);
    consoleUi.addField(facts, 'Bootstrap brokers', cluster.bootstrap_brokers);
    consoleUi.addField(facts, 'Broker node group info', cluster.broker_node_group_info);
    consoleUi.addField(facts, 'Nodes', cluster.node_count);
    consoleUi.addField(facts, 'Operations', cluster.operation_count);
    consoleUi.addField(facts, 'Tags', cluster.tags);
    return facts;
  }

  function renderLastResult() {
    if (!state.lastResult) {
      return null;
    }
    const result = el('div', 'kafka-last-result');
    result.append(el('h3', null, 'Last action result'));
    const pre = el('pre', 'kafka-result');
    pre.textContent = JSON.stringify(consoleUi.displayValue(state.lastResult), null, 2);
    result.append(pre);
    return result;
  }

  function renderClusterDetail(cluster) {
    const panel = el('section', 'kafka-panel');
    const heading = el('div', 'kafka-panel-heading');
    heading.append(
      el('span', null, cluster ? clusterName(cluster) : 'MSK workbench'),
      el('span', 'kafka-cluster-meta', cluster ? `${cluster.state || 'UNKNOWN'} / Redpanda-backed` : 'No cluster selected'),
    );
    panel.append(heading);

    const content = el('div', 'kafka-detail');
    if (!cluster) {
      content.append(el('div', 'kafka-empty', 'Create a cluster or refresh after your app creates one.'));
      panel.append(content);
      return panel;
    }

    content.append(renderClusterFacts(cluster));
    const actions = el('div', 'kafka-action-row');
    actions.append(
      btn('Get bootstrap brokers', null, () => loadBootstrapBrokers(cluster).catch((error) => toast(error.message, true))),
      btn('Copy brokers', 'kafka-btn-secondary', () => copyBootstrap(cluster).catch((error) => toast(error.message, true))),
      btn('Delete cluster', 'kafka-btn-danger', () => deleteCluster(cluster).catch((error) => toast(error.message, true))),
    );
    content.append(actions);
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
        btn('Refresh clusters', 'kafka-btn-secondary', () => refresh().catch((error) => toast(error.message, true))),
      ],
      [el('span', 'kafka-toolbar-note', 'Redpanda containers expose Kafka on dynamic localhost ports')],
    ));
    const workbench = el('div', 'kafka-workbench');
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
    const data = await apiJson('/api/kafka/');
    state.inventory = data;
    if (!selectedCluster() && clusters().length) {
      state.selectedClusterArn = clusterArn(clusters()[0]);
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'kafka-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.KafkaConsole = KafkaConsole;

if (document.getElementById('kafka-console-root')) {
  KafkaConsole.init();
}
