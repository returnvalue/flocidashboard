/* global ServiceConsole */

const CloudFrontConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('cloudfront-console-root');
  const breadcrumbsEl = document.getElementById('cloudfront-breadcrumbs');
  const summaryEl = document.getElementById('cloudfront-summary');
  const loadedAtEl = document.getElementById('cloudfront-loaded-at');

  const state = {
    inventory: null,
    selectedDistributionId: '',
    selectedFunctionName: '',
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'cloudfront',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'cloudfront');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'cloudfront',
      toast,
    });

  function distributions() {
    return state.inventory?.distributions || [];
  }

  function cachePolicies() {
    return state.inventory?.cache_policies || [];
  }

  function originAccessIdentities() {
    return state.inventory?.origin_access_identities || [];
  }

  function functions() {
    return state.inventory?.functions || [];
  }

  function selectedDistribution() {
    return distributions().find((item) => distributionId(item) === state.selectedDistributionId) || distributions()[0] || null;
  }

  function selectedFunction() {
    return functions().find((item) => functionName(item) === state.selectedFunctionName) || functions()[0] || null;
  }

  function distributionId(item) {
    return item?.id || item?.Id || item?.ARN || item?.arn || '';
  }

  function functionName(item) {
    return item?.name || item?.Name || item?.FunctionMetadata?.Name || item?.FunctionSummary?.Name || '';
  }

  function distributionArn(item) {
    return item?.arn || item?.ARN || '';
  }

  function aliases(item) {
    return item?.aliases?.Items || item?.Aliases?.Items || item?.aliases?.items || [];
  }

  function originItems(item) {
    return item?.origins?.Items || item?.Origins?.Items || item?.origins?.items || [];
  }

  function cacheBehavior(item) {
    return item?.default_cache_behavior || item?.DefaultCacheBehavior || {};
  }

  function statusClass(value) {
    return `cloudfront-status cloudfront-status-${String(value || '').toLowerCase()}`;
  }

  function option(select, value, label, selected = false) {
    const node = document.createElement('option');
    node.value = value || '';
    node.textContent = label || value || '';
    node.selected = selected;
    select.append(node);
  }

  function parseList(value) {
    return String(value || '').trim().split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  }

  function parseObject(value) {
    const trimmed = String(value || '').trim();
    return trimmed ? JSON.parse(trimmed) : {};
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'cloudfront',
      targets: {
        distributions: 'Distributions',
        cache_policies: 'Policies',
        origin_request_policies: 'Policies',
        response_headers_policies: 'Policies',
        origin_access_identities: 'Origin access',
        functions: 'Functions',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = btn('CloudFront', null, () => {
      state.selectedDistributionId = '';
      render();
    });
    breadcrumbsEl.append(home);
    const distribution = selectedDistribution();
    if (distribution) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, distributionId(distribution)));
    }
  }

  function addField(list, label, value) {
    consoleUi.addField(list, label, value);
  }

  function showCreateDistributionModal() {
    const form = el('div');
    const callerInput = document.createElement('input');
    callerInput.value = `dashboard-${Date.now()}`;
    const originIdInput = document.createElement('input');
    originIdInput.placeholder = 'app-origin';
    const domainInput = document.createElement('input');
    domainInput.placeholder = 'mybucket.s3.amazonaws.com';
    const commentInput = document.createElement('input');
    commentInput.placeholder = 'local app CDN';
    const aliasesInput = document.createElement('textarea');
    aliasesInput.placeholder = 'www.local.test, static.local.test';
    const enabledInput = document.createElement('input');
    enabledInput.type = 'checkbox';
    enabledInput.checked = true;
    const policySelect = document.createElement('select');
    option(policySelect, '', 'Use forwarded values', true);
    cachePolicies().forEach((policy) => {
      const config = policy.cache_policy_config || policy.CachePolicyConfig || {};
      option(policySelect, policy.id || policy.Id, config.Name || policy.name || policy.Id);
    });
    const viewerPolicy = document.createElement('select');
    ['redirect-to-https', 'allow-all', 'https-only'].forEach((value) => option(viewerPolicy, value, value, value === 'redirect-to-https'));
    form.append(
      el('label', null, 'Caller reference'),
      callerInput,
      el('label', null, 'Origin ID'),
      originIdInput,
      el('label', null, 'Origin domain name'),
      domainInput,
      el('label', null, 'Comment'),
      commentInput,
      el('label', null, 'Aliases'),
      aliasesInput,
      el('label', null, 'Viewer protocol policy'),
      viewerPolicy,
      el('label', null, 'Cache policy'),
      policySelect,
      el('label', null, 'Enabled'),
      enabledInput,
    );
    openModal('Create distribution', form, 'Create', async (close) => {
      await apiJson('/api/cloudfront/distributions/', {
        method: 'POST',
        body: JSON.stringify({
          caller_reference: callerInput.value.trim(),
          origin_id: originIdInput.value.trim(),
          origin_domain_name: domainInput.value.trim(),
          comment: commentInput.value.trim(),
          aliases: parseList(aliasesInput.value),
          enabled: enabledInput.checked,
          viewer_protocol_policy: viewerPolicy.value,
          cache_policy_id: policySelect.value,
        }),
      });
      close();
      toast('Distribution created');
      await refresh();
    });
  }

  function showUpdateDistributionModal(distribution) {
    const form = el('div');
    const commentInput = document.createElement('input');
    commentInput.value = distribution?.comment || distribution?.Comment || '';
    const enabledInput = document.createElement('input');
    enabledInput.type = 'checkbox';
    enabledInput.checked = distribution?.enabled ?? distribution?.Enabled ?? true;
    const etagInput = document.createElement('input');
    etagInput.placeholder = 'optional; fetched automatically when blank';
    form.append(
      el('label', null, 'Comment'),
      commentInput,
      el('label', null, 'Enabled'),
      enabledInput,
      el('label', null, 'If-Match ETag'),
      etagInput,
    );
    openModal('Update distribution', form, 'Save', async (close) => {
      await apiJson(`/api/cloudfront/distributions/${encodeURIComponent(distributionId(distribution))}/`, {
        method: 'PUT',
        body: JSON.stringify({
          comment: commentInput.value,
          enabled: enabledInput.checked,
          if_match: etagInput.value.trim(),
        }),
      });
      close();
      toast('Distribution updated');
      await refresh();
    });
  }

  function showDeleteDistributionModal(distribution) {
    const form = el('div');
    const etagInput = document.createElement('input');
    etagInput.placeholder = 'optional; fetched automatically when blank';
    form.append(
      el('p', 'cloudfront-resource-meta', 'CloudFront requires a distribution to be disabled before deletion.'),
      el('label', null, 'If-Match ETag'),
      etagInput,
    );
    openModal('Delete distribution', form, 'Delete', async (close) => {
      await apiJson(`/api/cloudfront/distributions/${encodeURIComponent(distributionId(distribution))}/`, {
        method: 'DELETE',
        body: JSON.stringify({ if_match: etagInput.value.trim() }),
      });
      close();
      toast('Distribution deleted');
      await refresh();
    });
  }

  function showInvalidationModal(distribution) {
    const form = el('div');
    const pathsInput = document.createElement('textarea');
    pathsInput.value = '/*';
    const callerInput = document.createElement('input');
    callerInput.value = `dashboard-inv-${Date.now()}`;
    form.append(
      el('label', null, 'Paths'),
      pathsInput,
      el('label', null, 'Caller reference'),
      callerInput,
    );
    openModal('Create invalidation', form, 'Create', async (close) => {
      await apiJson(`/api/cloudfront/distributions/${encodeURIComponent(distributionId(distribution))}/invalidations/`, {
        method: 'POST',
        body: JSON.stringify({
          paths: parseList(pathsInput.value),
          caller_reference: callerInput.value.trim(),
        }),
      });
      close();
      toast('Invalidation created');
      await refresh();
    });
  }

  function showCachePolicyModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'local-static-cache';
    const defaultInput = document.createElement('input');
    defaultInput.type = 'number';
    defaultInput.value = '86400';
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.value = '31536000';
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.value = '0';
    const commentInput = document.createElement('input');
    form.append(
      el('label', null, 'Policy name'),
      nameInput,
      el('label', null, 'Default TTL'),
      defaultInput,
      el('label', null, 'Max TTL'),
      maxInput,
      el('label', null, 'Min TTL'),
      minInput,
      el('label', null, 'Comment'),
      commentInput,
    );
    openModal('Create cache policy', form, 'Create', async (close) => {
      await apiJson('/api/cloudfront/cache-policies/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          default_ttl: Number(defaultInput.value),
          max_ttl: Number(maxInput.value),
          min_ttl: Number(minInput.value),
          comment: commentInput.value.trim(),
        }),
      });
      close();
      toast('Cache policy created');
      await refresh();
    });
  }

  function showOaiModal() {
    const form = el('div');
    const callerInput = document.createElement('input');
    callerInput.value = `dashboard-oai-${Date.now()}`;
    const commentInput = document.createElement('input');
    form.append(
      el('label', null, 'Caller reference'),
      callerInput,
      el('label', null, 'Comment'),
      commentInput,
    );
    openModal('Create origin access identity', form, 'Create', async (close) => {
      await apiJson('/api/cloudfront/origin-access-identities/', {
        method: 'POST',
        body: JSON.stringify({
          caller_reference: callerInput.value.trim(),
          comment: commentInput.value.trim(),
        }),
      });
      close();
      toast('Origin access identity created');
      await refresh();
    });
  }

  function showFunctionModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'viewer-request-normalizer';
    const runtimeInput = document.createElement('input');
    runtimeInput.value = 'cloudfront-js-1.0';
    const commentInput = document.createElement('input');
    const codeInput = document.createElement('textarea');
    codeInput.value = 'function handler(event) {\n  return event.request;\n}';
    form.append(
      el('label', null, 'Function name'),
      nameInput,
      el('label', null, 'Runtime'),
      runtimeInput,
      el('label', null, 'Comment'),
      commentInput,
      el('label', null, 'Function code'),
      codeInput,
    );
    openModal('Create function', form, 'Create', async (close) => {
      await apiJson('/api/cloudfront/functions/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          runtime: runtimeInput.value.trim(),
          comment: commentInput.value.trim(),
          code: codeInput.value,
        }),
      });
      close();
      toast('Function created');
      await refresh();
    });
  }

  function showPublishFunctionModal(fn) {
    const form = el('div');
    const etagInput = document.createElement('input');
    etagInput.placeholder = 'optional; fetched automatically when blank';
    form.append(
      el('p', 'cloudfront-resource-meta', functionName(fn)),
      el('label', null, 'If-Match ETag'),
      etagInput,
    );
    openModal('Publish function', form, 'Publish', async (close) => {
      await apiJson(`/api/cloudfront/functions/${encodeURIComponent(functionName(fn))}/`, {
        method: 'POST',
        body: JSON.stringify({ if_match: etagInput.value.trim() }),
      });
      close();
      toast('Function published');
      await refresh();
    });
  }

  function showTagModal(distribution) {
    const form = el('div');
    const arnInput = document.createElement('input');
    arnInput.value = distributionArn(distribution);
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{"env":"local"}';
    form.append(
      el('label', null, 'Resource ARN'),
      arnInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Tag resource', form, 'Save', async (close) => {
      await apiJson('/api/cloudfront/tags/', {
        method: 'POST',
        body: JSON.stringify({
          resource_arn: arnInput.value.trim(),
          tags: parseObject(tagsInput.value),
        }),
      });
      close();
      toast('Tags saved');
      await refresh();
    });
  }

  function renderDistributionList() {
    const panel = el('section', 'cloudfront-panel');
    panel.id = consoleUi.sectionIdForLabel('cloudfront', 'Distributions');
    panel.append(el('div', 'cloudfront-panel-heading', 'Distributions'));
    if (!distributions().length) {
      panel.append(el('div', 'cloudfront-empty', 'No distributions found.'));
      return panel;
    }
    const list = el('div', 'cloudfront-resource-list');
    distributions().forEach((distribution) => {
      const row = btn('', `cloudfront-resource-row ${distributionId(distribution) === distributionId(selectedDistribution()) ? 'cloudfront-resource-row-active' : ''}`, () => {
        state.selectedDistributionId = distributionId(distribution);
        render();
      });
      row.append(
        el('span', 'cloudfront-resource-name', distributionId(distribution)),
        el('span', 'cloudfront-resource-meta', distribution.domain_name || distribution.DomainName || ''),
        el('span', 'cloudfront-resource-meta', distribution.comment || distribution.Comment || ''),
      );
      list.append(row);
    });
    panel.append(list);
    return panel;
  }

  function renderDistributionDetail(distribution) {
    const panel = el('section', 'cloudfront-panel');
    panel.append(el('div', 'cloudfront-panel-heading', 'Distribution detail'));
    if (!distribution) {
      panel.append(el('div', 'cloudfront-empty cloudfront-empty-compact', 'Select or create a distribution.'));
      return panel;
    }
    const actions = el('div', 'cloudfront-inline-actions');
    actions.append(
      btn('Invalidate paths', null, () => showInvalidationModal(distribution)),
      btn('Update', 'cloudfront-btn-secondary', () => showUpdateDistributionModal(distribution)),
      btn('Tag', 'cloudfront-btn-secondary', () => showTagModal(distribution)),
      btn('Delete', 'cloudfront-btn-danger', () => showDeleteDistributionModal(distribution)),
    );
    const heading = el('div', 'cloudfront-panel-heading');
    heading.append(el('span', null, distributionId(distribution)), actions);
    panel.replaceChildren(heading);
    const list = document.createElement('dl');
    addField(list, 'Domain', distribution.domain_name || distribution.DomainName);
    addField(list, 'Status', distribution.status || distribution.Status);
    addField(list, 'Enabled', distribution.enabled ?? distribution.Enabled);
    addField(list, 'ARN', distributionArn(distribution));
    addField(list, 'Aliases', aliases(distribution));
    addField(list, 'Origins', originItems(distribution));
    addField(list, 'Default behavior', cacheBehavior(distribution));
    panel.append(list);
    return panel;
  }

  function renderPolicies() {
    const panel = el('section', 'cloudfront-panel');
    panel.id = consoleUi.sectionIdForLabel('cloudfront', 'Policies');
    panel.append(el('div', 'cloudfront-panel-heading', 'Policies'));
    const list = el('div', 'cloudfront-card-list');
    [
      ['Cache policies', cachePolicies()],
      ['Origin request policies', state.inventory?.origin_request_policies || []],
      ['Response headers policies', state.inventory?.response_headers_policies || []],
    ].forEach(([label, items]) => {
      const card = el('article', 'cloudfront-card');
      card.append(el('strong', null, `${label} (${items.length})`));
      if (items.length) {
        card.append(el('pre', 'cloudfront-code-block', consoleUi.valueText(items.slice(0, 6))));
      } else {
        card.append(el('span', 'cloudfront-resource-meta', 'None found.'));
      }
      list.append(card);
    });
    panel.append(list);
    return panel;
  }

  function renderOriginAccess() {
    const panel = el('section', 'cloudfront-panel');
    panel.id = consoleUi.sectionIdForLabel('cloudfront', 'Origin access');
    panel.append(el('div', 'cloudfront-panel-heading', 'Origin access'));
    if (!originAccessIdentities().length) {
      panel.append(el('div', 'cloudfront-empty cloudfront-empty-compact', 'No origin access identities found.'));
      return panel;
    }
    const list = el('div', 'cloudfront-card-list');
    originAccessIdentities().forEach((identity) => {
      const card = el('article', 'cloudfront-card');
      card.append(
        el('strong', null, identity.id || identity.Id || 'Origin access identity'),
        el('span', 'cloudfront-resource-meta', identity.comment || identity.Comment || ''),
        el('pre', 'cloudfront-code-block', consoleUi.valueText(identity)),
      );
      list.append(card);
    });
    panel.append(list);
    return panel;
  }

  function renderFunctions() {
    const panel = el('section', 'cloudfront-panel');
    panel.id = consoleUi.sectionIdForLabel('cloudfront', 'Functions');
    panel.append(el('div', 'cloudfront-panel-heading', 'Functions'));
    if (!functions().length) {
      panel.append(el('div', 'cloudfront-empty cloudfront-empty-compact', 'No functions found.'));
      return panel;
    }
    const list = el('div', 'cloudfront-card-list');
    functions().forEach((fn) => {
      const name = functionName(fn);
      const status = fn.status || fn.Status || fn.FunctionMetadata?.Stage || '';
      const card = el('article', 'cloudfront-card');
      const actions = el('div', 'cloudfront-inline-actions');
      actions.append(btn('Publish', 'cloudfront-btn-secondary', () => showPublishFunctionModal(fn)));
      const heading = el('div', 'cloudfront-inline-actions');
      heading.append(el('strong', null, name || 'Function'), status ? el('span', statusClass(status), status) : el('span'));
      card.append(heading, el('span', 'cloudfront-resource-meta', fn.function_metadata?.FunctionARN || fn.FunctionMetadata?.FunctionARN || ''), actions);
      list.append(card);
    });
    panel.append(list);
    return panel;
  }

  function renderWorkbench() {
    const distribution = selectedDistribution();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create distribution', null, showCreateDistributionModal),
        btn('Create invalidation', null, () => distribution && showInvalidationModal(distribution)),
        btn('Create cache policy', null, showCachePolicyModal),
      ],
      [
        btn('Create OAI', 'cloudfront-btn-secondary', showOaiModal),
        btn('Create function', 'cloudfront-btn-secondary', showFunctionModal),
      ],
    ));
    const workbench = el('div', 'cloudfront-workbench');
    const detail = el('div', 'cloudfront-detail-stack');
    detail.append(renderDistributionDetail(distribution), renderPolicies(), renderOriginAccess(), renderFunctions());
    workbench.append(renderDistributionList(), detail);
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
    const data = await apiJson('/api/cloudfront/');
    state.inventory = data;
    if (!selectedDistribution() && distributions().length) {
      state.selectedDistributionId = distributionId(distributions()[0]);
    }
    if (!selectedFunction() && functions().length) {
      state.selectedFunctionName = functionName(functions()[0]);
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'cloudfront-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.CloudFrontConsole = CloudFrontConsole;

if (document.getElementById('cloudfront-console-root')) {
  CloudFrontConsole.init();
}
