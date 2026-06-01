/* global ServiceConsole */

const OpenSearchConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('opensearch-console-root');
  const breadcrumbsEl = document.getElementById('opensearch-breadcrumbs');
  const summaryEl = document.getElementById('opensearch-summary');
  const loadedAtEl = document.getElementById('opensearch-loaded-at');

  const state = {
    inventory: null,
    selectedDomainName: '',
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'opensearch',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'opensearch');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'opensearch',
      toast,
    });

  function domains() {
    return state.inventory?.domains || [];
  }

  function domainName(domain) {
    return domain?.name || domain?.DomainName || '';
  }

  function selectedDomain() {
    return domains().find((domain) => domainName(domain) === state.selectedDomainName) || domains()[0] || null;
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

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'opensearch',
      targets: {
        domains: 'Domains',
        nodes: 'Nodes',
        packages: 'Packages',
        versions: 'Versions',
        vpc_endpoints: 'VPC endpoints',
        inbound_connections: 'Inbound connections',
        outbound_connections: 'Outbound connections',
        applications: 'Applications',
        direct_query_data_sources: 'Direct query data sources',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('OpenSearch', null, () => {
      state.selectedDomainName = domains()[0] ? domainName(domains()[0]) : '';
      render();
    }));
    const domain = selectedDomain();
    if (domain) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, domainName(domain)));
    }
  }

  function showCreateDomainModal() {
    const form = el('div', 'opensearch-modal-form');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'my-search';
    const versionInput = document.createElement('input');
    versionInput.value = 'OpenSearch_2.19';
    const typeInput = document.createElement('input');
    typeInput.value = 'm5.large.search';
    const countInput = document.createElement('input');
    countInput.type = 'number';
    countInput.min = '1';
    countInput.value = '1';
    const ebsWrap = el('label', 'opensearch-checkbox');
    const ebsInput = document.createElement('input');
    ebsInput.type = 'checkbox';
    ebsInput.checked = true;
    ebsWrap.append(ebsInput, el('span', null, 'EBS enabled'));
    const volumeTypeInput = document.createElement('input');
    volumeTypeInput.value = 'gp2';
    const volumeSizeInput = document.createElement('input');
    volumeSizeInput.type = 'number';
    volumeSizeInput.value = '10';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{"env":"local","team":"search"}';
    form.append(
      el('label', null, 'Domain name'),
      nameInput,
      el('label', null, 'Engine version'),
      versionInput,
      el('label', null, 'Instance type'),
      typeInput,
      el('label', null, 'Instance count'),
      countInput,
      ebsWrap,
      el('label', null, 'Volume type'),
      volumeTypeInput,
      el('label', null, 'Volume size GiB'),
      volumeSizeInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Create domain', form, 'Create', async (close) => {
      const data = await apiJson('/api/opensearch/domains/', {
        method: 'POST',
        body: JSON.stringify({
          domain_name: nameInput.value.trim(),
          engine_version: versionInput.value.trim(),
          instance_type: typeInput.value.trim(),
          instance_count: Number(countInput.value || 1),
          ebs_enabled: ebsInput.checked,
          volume_type: volumeTypeInput.value.trim(),
          volume_size: Number(volumeSizeInput.value || 10),
          tags: parseJson(tagsInput.value, [], 'Tags'),
        }),
      });
      state.selectedDomainName = data.domain_name || nameInput.value.trim();
      state.lastResult = data;
      close();
      toast('Domain created');
      await refresh();
    });
  }

  function showUpdateDomainModal(domain = selectedDomain()) {
    const form = el('div', 'opensearch-modal-form');
    const nameInput = document.createElement('input');
    nameInput.value = domainName(domain);
    const versionInput = document.createElement('input');
    versionInput.placeholder = 'OpenSearch_3.0';
    const clusterInput = document.createElement('textarea');
    clusterInput.placeholder = '{"InstanceCount":3}';
    const ebsInput = document.createElement('textarea');
    ebsInput.placeholder = '{"EBSEnabled":true,"VolumeType":"gp2","VolumeSize":20}';
    form.append(
      el('label', null, 'Domain name'),
      nameInput,
      el('label', null, 'Engine version'),
      versionInput,
      el('label', null, 'Cluster config JSON'),
      clusterInput,
      el('label', null, 'EBS options JSON'),
      ebsInput,
    );
    openModal('Update domain config', form, 'Update', async (close) => {
      const data = await apiJson('/api/opensearch/domains/update/', {
        method: 'POST',
        body: JSON.stringify({
          domain_name: nameInput.value.trim(),
          engine_version: versionInput.value.trim(),
          cluster_config: parseJson(clusterInput.value, {}, 'Cluster config'),
          ebs_options: parseJson(ebsInput.value, {}, 'EBS options'),
        }),
      });
      state.lastResult = data;
      close();
      toast('Domain config updated');
      await refresh();
    });
  }

  function showUpgradeDomainModal(domain = selectedDomain()) {
    const form = el('div', 'opensearch-modal-form');
    const nameInput = document.createElement('input');
    nameInput.value = domainName(domain);
    const targetInput = document.createElement('input');
    targetInput.placeholder = 'OpenSearch_3.0';
    const checkWrap = el('label', 'opensearch-checkbox');
    const checkInput = document.createElement('input');
    checkInput.type = 'checkbox';
    checkWrap.append(checkInput, el('span', null, 'Perform check only'));
    form.append(
      el('label', null, 'Domain name'),
      nameInput,
      el('label', null, 'Target version'),
      targetInput,
      checkWrap,
    );
    openModal('Upgrade domain', form, 'Upgrade', async (close) => {
      const data = await apiJson('/api/opensearch/domains/upgrade/', {
        method: 'POST',
        body: JSON.stringify({
          domain_name: nameInput.value.trim(),
          target_version: targetInput.value.trim(),
          perform_check_only: checkInput.checked,
        }),
      });
      state.lastResult = data;
      close();
      toast('Domain upgrade requested');
      await refresh();
    });
  }

  function showTagsModal(domain = selectedDomain()) {
    const form = el('div', 'opensearch-modal-form');
    const arnInput = document.createElement('input');
    arnInput.value = domain?.arn || '';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{"env":"local"}';
    const keysInput = document.createElement('input');
    keysInput.placeholder = 'env,team';
    const result = el('pre', 'opensearch-result');
    result.hidden = true;
    form.append(
      el('label', null, 'ARN'),
      arnInput,
      el('label', null, 'Add tags JSON'),
      tagsInput,
      btn('Add tags', null, async () => {
        try {
          const data = await apiJson('/api/opensearch/tags/', {
            method: 'POST',
            body: JSON.stringify({
              arn: arnInput.value.trim(),
              tags: parseJson(tagsInput.value, [], 'Tags'),
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
      btn('Remove tags', 'opensearch-btn-secondary', async () => {
        try {
          const data = await apiJson('/api/opensearch/tags/', {
            method: 'DELETE',
            body: JSON.stringify({
              arn: arnInput.value.trim(),
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
      btn('Load tags', 'opensearch-btn-secondary', async () => {
        try {
          const data = await apiJson('/api/opensearch/tags/list/', {
            method: 'POST',
            body: JSON.stringify({ arn: arnInput.value.trim() }),
          });
          result.hidden = false;
          result.textContent = JSON.stringify(consoleUi.displayValue(data.tags || []), null, 2);
          state.lastResult = data;
        } catch (error) {
          toast(error.message, true);
        }
      }),
      result,
    );
    openModal('Domain tags', form, 'Done', (close) => close());
  }

  function showVersionsModal() {
    const form = el('div', 'opensearch-modal-form');
    const domainInput = document.createElement('input');
    domainInput.value = selectedDomain() ? domainName(selectedDomain()) : '';
    const engineInput = document.createElement('input');
    engineInput.value = selectedDomain()?.engine_version || 'OpenSearch_2.19';
    const typeInput = document.createElement('input');
    typeInput.value = selectedDomain()?.cluster_config?.InstanceType || 'm5.large.search';
    const result = el('pre', 'opensearch-result');
    result.hidden = true;
    form.append(
      btn('List versions', null, async () => {
        try {
          const data = await apiJson('/api/opensearch/versions/');
          result.hidden = false;
          result.textContent = JSON.stringify(consoleUi.displayValue(data.versions || []), null, 2);
          state.lastResult = data;
        } catch (error) {
          toast(error.message, true);
        }
      }),
      el('label', null, 'Domain name'),
      domainInput,
      btn('Compatible versions', 'opensearch-btn-secondary', async () => {
        try {
          const data = await apiJson('/api/opensearch/compatible-versions/', {
            method: 'POST',
            body: JSON.stringify({ domain_name: domainInput.value.trim() }),
          });
          result.hidden = false;
          result.textContent = JSON.stringify(consoleUi.displayValue(data.compatible_versions || []), null, 2);
          state.lastResult = data;
        } catch (error) {
          toast(error.message, true);
        }
      }),
      el('label', null, 'Engine version'),
      engineInput,
      el('label', null, 'Instance type'),
      typeInput,
      btn('Instance type limits', 'opensearch-btn-secondary', async () => {
        try {
          const data = await apiJson('/api/opensearch/instance-type-limits/', {
            method: 'POST',
            body: JSON.stringify({
              engine_version: engineInput.value.trim(),
              instance_type: typeInput.value.trim(),
            }),
          });
          result.hidden = false;
          result.textContent = JSON.stringify(consoleUi.displayValue(data.limits_by_role || data.response), null, 2);
          state.lastResult = data;
        } catch (error) {
          toast(error.message, true);
        }
      }),
      result,
    );
    openModal('Versions and limits', form, 'Done', (close) => close());
  }

  async function deleteDomain(domain) {
    if (!window.confirm('Delete this OpenSearch domain and stop its local container?')) {
      return;
    }
    const data = await apiJson('/api/opensearch/domains/delete/', {
      method: 'POST',
      body: JSON.stringify({ domain_name: domainName(domain) }),
    });
    state.lastResult = data;
    state.selectedDomainName = '';
    toast('Domain deleted');
    await refresh();
  }

  function renderDomainList() {
    const panel = el('section', 'opensearch-panel');
    panel.append(el('div', 'opensearch-panel-heading', 'Domains'));
    const list = el('div', 'opensearch-domain-list');
    if (!domains().length) {
      list.append(el('div', 'opensearch-empty', 'No OpenSearch domains found.'));
    } else {
      domains().forEach((domain) => {
        const active = domainName(domain) === domainName(selectedDomain());
        const row = el('button', `opensearch-domain-row${active ? ' opensearch-domain-row-active' : ''}`);
        row.append(
          el('span', 'opensearch-domain-name', domainName(domain)),
          el('span', 'opensearch-domain-meta', `${domain.created ? 'Created' : 'Pending'} / ${domain.engine_version || 'default version'}`),
        );
        row.addEventListener('click', () => {
          state.selectedDomainName = domainName(domain);
          render();
        });
        list.append(row);
      });
    }
    panel.append(list);
    return panel;
  }

  function renderDomainDetail(domain) {
    const panel = el('section', 'opensearch-panel');
    panel.append(el('div', 'opensearch-panel-heading', 'Selected domain'));
    const body = el('div', 'opensearch-detail');
    const facts = el('dl', 'opensearch-facts');
    consoleUi.addField(facts, 'Domain', domainName(domain));
    consoleUi.addField(facts, 'ARN', domain.arn);
    consoleUi.addField(facts, 'Engine version', domain.engine_version);
    consoleUi.addField(facts, 'Created', domain.created);
    consoleUi.addField(facts, 'Processing', domain.processing);
    consoleUi.addField(facts, 'Endpoint', domain.endpoint || domain.endpoints);
    consoleUi.addField(facts, 'Cluster config', domain.cluster_config);
    consoleUi.addField(facts, 'EBS options', domain.ebs_options);
    consoleUi.addField(facts, 'Health', domain.health);
    consoleUi.addField(facts, 'Tags', domain.tags);
    body.append(facts);
    if (domain.endpoint) {
      const snippet = el('pre', 'opensearch-code');
      snippet.textContent = `curl http://${domain.endpoint}/_cluster/health`;
      body.append(snippet);
    }
    const actions = el('div', 'opensearch-action-row');
    actions.append(
      btn('Update config', null, () => showUpdateDomainModal(domain)),
      btn('Upgrade', 'opensearch-btn-secondary', () => showUpgradeDomainModal(domain)),
      btn('Tags', 'opensearch-btn-secondary', () => showTagsModal(domain)),
      btn('Delete domain', 'opensearch-btn-danger', () => deleteDomain(domain).catch((error) => toast(error.message, true))),
    );
    body.append(actions);
    panel.append(body);
    return panel;
  }

  function renderRelatedPanel(domain) {
    const panel = el('section', 'opensearch-panel');
    panel.append(el('div', 'opensearch-panel-heading', 'Domain details'));
    const body = el('div', 'opensearch-card-list');
    const facts = el('dl', 'opensearch-facts');
    consoleUi.addField(facts, 'Nodes', domain.nodes || []);
    consoleUi.addField(facts, 'Packages', domain.packages || []);
    consoleUi.addField(facts, 'Maintenance', domain.maintenance || []);
    consoleUi.addField(facts, 'Scheduled actions', domain.scheduled_actions || []);
    consoleUi.addField(facts, 'VPC endpoint access', domain.vpc_endpoint_access || []);
    body.append(facts);
    panel.append(body);
    return panel;
  }

  function renderResult() {
    if (!state.lastResult) {
      return null;
    }
    const panel = el('section', 'opensearch-panel');
    panel.append(el('div', 'opensearch-panel-heading', 'Last action result'));
    const pre = el('pre', 'opensearch-result');
    pre.textContent = JSON.stringify(consoleUi.displayValue(state.lastResult), null, 2);
    panel.append(pre);
    return panel;
  }

  function renderWorkbench() {
    const workbench = el('div', 'opensearch-workbench');
    const domain = selectedDomain();
    workbench.append(renderDomainList());
    const detail = el('div', 'opensearch-detail-stack');
    if (!domain) {
      detail.append(el('section', 'opensearch-panel opensearch-empty-panel', 'Create a domain to start a local OpenSearch or Elasticsearch container.'));
    } else {
      detail.append(renderDomainDetail(domain), renderRelatedPanel(domain));
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
      [
        btn('Create domain', null, showCreateDomainModal),
        btn('Versions', 'opensearch-btn-secondary', showVersionsModal),
      ],
      [el('span', 'opensearch-toolbar-note', 'Domain lifecycle, config updates, tags, versions, and limits')],
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
    const data = await apiJson('/api/opensearch/');
    state.inventory = data;
    if (!state.selectedDomainName && domains()[0]) {
      state.selectedDomainName = domainName(domains()[0]);
    }
    render();
  }

  return { refresh };
})();

window.OpenSearchConsole = OpenSearchConsole;
