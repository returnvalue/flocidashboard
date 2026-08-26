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
    lastDevToolsResult: null,
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
    if (!trimmed) return fallback;
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`${label} must be valid JSON`);
    }
  }

  function parseList(value) {
    return String(value || '').split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
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
    if (!breadcrumbsEl) return;
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
          instance_count: Number(countInput.value || '1'),
          ebs_enabled: ebsInput.checked,
          volume_type: volumeTypeInput.value.trim(),
          volume_size: Number(volumeSizeInput.value || '10'),
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

  function showDevToolsModal(domain) {
    const form = el('div', 'opensearch-modal-form');
    const dName = domainName(domain);

    const presets = {
      health: { name: 'Cluster Health (GET /_cluster/health)', method: 'GET', path: '/_cluster/health', body: '' },
      cat_indices: { name: 'List Indices (GET /_cat/indices?v)', method: 'GET', path: '/_cat/indices?v', body: '' },
      create_index: { name: 'Create Index (PUT /products)', method: 'PUT', path: '/products', body: '{\n  "settings": {\n    "number_of_shards": 1\n  },\n  "mappings": {\n    "properties": {\n      "name": { "type": "text" },\n      "price": { "type": "float" }\n    }\n  }\n}' },
      index_doc: { name: 'Index Document (POST /products/_doc/1)', method: 'POST', path: '/products/_doc/1', body: '{\n  "name": "Wireless Headphones",\n  "price": 79.99\n}' },
      search_all: { name: 'Search Match All (POST /products/_search)', method: 'POST', path: '/products/_search', body: '{\n  "query": {\n    "match_all": {}\n  }\n}' },
    };

    const presetSelect = document.createElement('select');
    Object.entries(presets).forEach(([k, v]) => {
      const opt = el('option', null, v.name);
      opt.value = k;
      presetSelect.append(opt);
    });

    const methodSelect = document.createElement('select');
    ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'].forEach((m) => {
      const opt = el('option', null, m);
      opt.value = m;
      methodSelect.append(opt);
    });

    const pathInput = document.createElement('input');
    pathInput.value = '/_cluster/health';

    const bodyArea = document.createElement('textarea');
    bodyArea.className = 'opensearch-code-area';
    bodyArea.style.minHeight = '140px';
    bodyArea.placeholder = 'Optional request body JSON/NDJSON';

    presetSelect.addEventListener('change', () => {
      const selected = presets[presetSelect.value];
      if (selected) {
        methodSelect.value = selected.method;
        pathInput.value = selected.path;
        bodyArea.value = selected.body;
      }
    });

    form.append(
      el('label', null, 'DevTools Quick Presets'),
      presetSelect,
      el('label', null, 'HTTP Method'),
      methodSelect,
      el('label', null, 'Endpoint Path'),
      pathInput,
      el('label', null, 'Request Body (JSON / text)'),
      bodyArea,
    );

    openModal(`OpenSearch DevTools: ${dName}`, form, 'Send Request', async (close) => {
      const path = pathInput.value.trim();
      if (!path) throw new Error('Endpoint path is required');

      const res = await apiJson('/api/opensearch/devtools/request/', {
        method: 'POST',
        body: JSON.stringify({
          domain_name: dName,
          method: methodSelect.value,
          path,
          body: bodyArea.value.trim() || undefined,
        }),
      });

      state.lastDevToolsResult = res;
      toast(`HTTP ${res.status_code} received in ${res.latency_ms}ms`);
      close();
      render();
    });
  }

  function renderDevToolsResult() {
    if (!state.lastDevToolsResult) return null;
    const res = state.lastDevToolsResult;
    const card = el('section', 'opensearch-section');
    const heading = el('div', 'opensearch-panel-heading');
    heading.append(
      el('span', null, `DevTools REST Result: ${res.method} ${res.path}`),
      el('span', 'opensearch-meta', `${res.latency_ms}ms · HTTP ${res.status_code}`),
    );
    card.append(heading);

    card.append(el('h4', null, 'Response Body'));
    card.append(el('pre', 'opensearch-output', res.json ? JSON.stringify(res.json, null, 2) : res.body || res.error || 'Empty response'));
    return card;
  }

  function renderDomainList() {
    const panel = el('section', 'opensearch-panel');
    panel.append(el('div', 'opensearch-panel-heading', 'Domains'));
    const list = el('div', 'opensearch-list');
    if (!domains().length) {
      list.append(el('p', 'opensearch-empty', 'No OpenSearch domains found.'));
    }
    domains().forEach((domain) => {
      const name = domainName(domain);
      const row = el('button', `opensearch-row${name === domainName(selectedDomain()) ? ' opensearch-row-active' : ''}`);
      row.append(
        el('span', 'opensearch-name', name),
        el('span', 'opensearch-meta', `${domain.engine_version || domain.EngineVersion || 'OpenSearch'} / ${domain.cluster_config?.InstanceType || 'm5.large.search'}`),
      );
      row.addEventListener('click', () => {
        state.selectedDomainName = name;
        render();
      });
      list.append(row);
    });
    panel.append(list);
    return panel;
  }

  function renderWorkbench() {
    const domain = selectedDomain();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create domain', null, showCreateDomainModal),
        btn('DevTools REST console', 'opensearch-btn-primary', () => domain && showDevToolsModal(domain)),
        btn('Delete domain', 'opensearch-btn-danger', async () => {
          if (domain && window.confirm(`Delete domain ${domainName(domain)}?`)) {
            state.selectedDomainName = '';
            await apiJson('/api/opensearch/domains/delete/', { method: 'POST', body: JSON.stringify({ domain_name: domainName(domain) }) });
            toast('Domain deleted');
            await refresh();
          }
        }),
      ],
      [],
    ));

    [...container.querySelectorAll('button')].slice(1).forEach((button) => { button.disabled = !domain; });

    const workbench = el('div', 'opensearch-workbench');
    workbench.append(renderDomainList());

    const detail = el('section', 'opensearch-panel');
    detail.append(el('div', 'opensearch-panel-heading', domain ? domainName(domain) : 'Domain detail'));
    const content = el('div', 'opensearch-content');
    if (!domain) {
      content.append(el('p', 'opensearch-empty', 'Create or select an OpenSearch domain to inspect its cluster status, endpoints, and DevTools query runner.'));
    } else {
      const summary = document.createElement('dl');
      [
        ['Domain name', domainName(domain)],
        ['ARN', domain.arn || domain.ARN],
        ['Engine version', domain.engine_version || domain.EngineVersion],
        ['Endpoint', domain.endpoint || domain.Endpoint || 'http://localhost:4566/opensearch/' + domainName(domain)],
        ['Created', consoleUi.formatDate(domain.created || domain.Created)],
        ['Processing', domain.processing ? 'True' : 'False'],
      ].forEach(([l, v]) => consoleUi.addField(summary, l, v));
      content.append(summary);

      const devResult = renderDevToolsResult();
      if (devResult) content.append(devResult);
    }
    detail.append(content);
    workbench.append(detail);
    container.append(workbench);
    return container;
  }

  function render() {
    if (!root) return;
    renderBreadcrumbs();
    root.textContent = '';
    root.append(renderWorkbench());
    if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
  }

  async function refresh() {
    const data = await apiJson('/api/opensearch/');
    state.inventory = data;
    if (!selectedDomain() && domains().length) state.selectedDomainName = domainName(domains()[0]);
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) return;
    root.append(el('p', 'opensearch-empty', 'Loading OpenSearch workbench...'));
    refresh().catch((err) => toast(err.message, true));
  }

  return { init, refresh };
})();

window.OpenSearchConsole = OpenSearchConsole;

if (document.getElementById('opensearch-console-root')) {
  OpenSearchConsole.init();
}
