/* global ServiceConsole */

const Route53Console = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('route53-console-root');
  const breadcrumbsEl = document.getElementById('route53-breadcrumbs');
  const summaryEl = document.getElementById('route53-summary');
  const loadedAtEl = document.getElementById('route53-loaded-at');

  const state = {
    inventory: null,
    selectedZoneId: '',
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'route53',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'route53');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'route53',
      toast,
    });

  function hostedZones() {
    return state.inventory?.hosted_zones || [];
  }

  function healthChecks() {
    return state.inventory?.health_checks || [];
  }

  function selectedZone() {
    return hostedZones().find((zone) => zone.clean_id === state.selectedZoneId || zone.id === state.selectedZoneId) || hostedZones()[0] || null;
  }

  function cleanZoneId(zone) {
    return zone?.clean_id || String(zone?.id || '').split('/').pop() || '';
  }

  function recordValues(record) {
    return (record.ResourceRecords || record.resource_records || []).map((item) => item.Value || item.value).filter(Boolean);
  }

  function healthCheckId(item) {
    return item.Id || item.id || '';
  }

  function healthCheckConfig(item) {
    return item.HealthCheckConfig || item.health_check_config || {};
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
      serviceKey: 'route53',
      targets: {
        hosted_zones: 'Hosted zones',
        record_sets: 'Records',
        health_checks: 'Health checks',
        private_zones: 'Hosted zones',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = btn('Route 53', null, () => {
      state.selectedZoneId = '';
      render();
    });
    breadcrumbsEl.append(home);
    const zone = selectedZone();
    if (zone) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, zone.name || cleanZoneId(zone)));
    }
  }

  function addField(list, label, value) {
    consoleUi.addField(list, label, value);
  }

  function showCreateZoneModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'example.com';
    const callerInput = document.createElement('input');
    callerInput.value = `dashboard-${Date.now()}`;
    const commentInput = document.createElement('input');
    form.append(
      el('label', null, 'Zone name'),
      nameInput,
      el('label', null, 'Caller reference'),
      callerInput,
      el('label', null, 'Comment'),
      commentInput,
    );
    openModal('Create hosted zone', form, 'Create', async (close) => {
      await apiJson('/api/route53/hosted-zones/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          caller_reference: callerInput.value.trim(),
          comment: commentInput.value.trim(),
        }),
      });
      close();
      toast('Hosted zone created');
      await refresh();
    });
  }

  function showDeleteZoneModal(zone) {
    const form = el('div');
    form.append(el('p', 'route53-resource-meta', 'Hosted zones can only be deleted when they contain no records beyond the default SOA and NS records.'));
    openModal('Delete hosted zone', form, 'Delete', async (close) => {
      await apiJson(`/api/route53/hosted-zones/${encodeURIComponent(cleanZoneId(zone))}/`, { method: 'DELETE' });
      close();
      toast('Hosted zone deleted');
      await refresh();
    });
  }

  function showRecordModal(zone, existingRecord = null) {
    const form = el('div');
    const actionInput = document.createElement('select');
    ['UPSERT', 'CREATE', 'DELETE'].forEach((value) => option(actionInput, value, value, value === (existingRecord ? 'UPSERT' : 'UPSERT')));
    const nameInput = document.createElement('input');
    nameInput.value = existingRecord?.Name || existingRecord?.name || '';
    nameInput.placeholder = `www.${zone?.name || 'example.com'}`;
    const typeInput = document.createElement('select');
    ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'SRV', 'NS', 'SOA'].forEach((value) => option(typeInput, value, value, value === (existingRecord?.Type || 'A')));
    const ttlInput = document.createElement('input');
    ttlInput.type = 'number';
    ttlInput.value = existingRecord?.TTL || existingRecord?.ttl || 300;
    const valuesInput = document.createElement('textarea');
    valuesInput.value = recordValues(existingRecord || {}).join('\n');
    valuesInput.placeholder = '1.2.3.4';
    const commentInput = document.createElement('input');
    form.append(
      el('label', null, 'Action'),
      actionInput,
      el('label', null, 'Record name'),
      nameInput,
      el('label', null, 'Type'),
      typeInput,
      el('label', null, 'TTL'),
      ttlInput,
      el('label', null, 'Values'),
      valuesInput,
      el('label', null, 'Comment'),
      commentInput,
    );
    openModal(existingRecord ? 'Change record set' : 'Add record set', form, 'Submit', async (close) => {
      await apiJson(`/api/route53/hosted-zones/${encodeURIComponent(cleanZoneId(zone))}/record-sets/`, {
        method: 'POST',
        body: JSON.stringify({
          action: actionInput.value,
          name: nameInput.value.trim(),
          type: typeInput.value,
          ttl: Number(ttlInput.value),
          values: parseList(valuesInput.value),
          comment: commentInput.value.trim(),
        }),
      });
      close();
      toast('Record set change submitted');
      await refresh();
    });
  }

  function showHealthCheckModal(existing = null) {
    const form = el('div');
    const callerInput = document.createElement('input');
    callerInput.value = `dashboard-hc-${Date.now()}`;
    const typeInput = document.createElement('select');
    ['HTTP', 'HTTPS', 'TCP'].forEach((value) => option(typeInput, value, value, value === (healthCheckConfig(existing || {}).Type || 'HTTPS')));
    const domainInput = document.createElement('input');
    domainInput.value = healthCheckConfig(existing || {}).FullyQualifiedDomainName || '';
    domainInput.placeholder = 'example.com';
    const ipInput = document.createElement('input');
    ipInput.value = healthCheckConfig(existing || {}).IPAddress || '';
    const portInput = document.createElement('input');
    portInput.type = 'number';
    portInput.value = healthCheckConfig(existing || {}).Port || 443;
    const pathInput = document.createElement('input');
    pathInput.value = healthCheckConfig(existing || {}).ResourcePath || '/health';
    if (!existing) {
      form.append(el('label', null, 'Caller reference'), callerInput, el('label', null, 'Type'), typeInput);
    }
    form.append(
      el('label', null, 'Domain name'),
      domainInput,
      el('label', null, 'IP address'),
      ipInput,
      el('label', null, 'Port'),
      portInput,
      el('label', null, 'Resource path'),
      pathInput,
    );
    openModal(existing ? 'Update health check' : 'Create health check', form, existing ? 'Save' : 'Create', async (close) => {
      const body = {
        domain_name: domainInput.value.trim(),
        ip_address: ipInput.value.trim(),
        port: portInput.value ? Number(portInput.value) : null,
        resource_path: pathInput.value.trim(),
      };
      if (existing) {
        await apiJson(`/api/route53/health-checks/${encodeURIComponent(healthCheckId(existing))}/`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await apiJson('/api/route53/health-checks/', {
          method: 'POST',
          body: JSON.stringify({
            ...body,
            caller_reference: callerInput.value.trim(),
            type: typeInput.value,
          }),
        });
      }
      close();
      toast(existing ? 'Health check updated' : 'Health check created');
      await refresh();
    });
  }

  function showDeleteHealthCheckModal(check) {
    const form = el('div');
    form.append(el('p', 'route53-resource-meta', healthCheckId(check)));
    openModal('Delete health check', form, 'Delete', async (close) => {
      await apiJson(`/api/route53/health-checks/${encodeURIComponent(healthCheckId(check))}/`, { method: 'DELETE' });
      close();
      toast('Health check deleted');
      await refresh();
    });
  }

  function showTagsModal(resourceType, resourceId) {
    const form = el('div');
    const addInput = document.createElement('textarea');
    addInput.placeholder = '{"env":"local"}';
    const removeInput = document.createElement('textarea');
    removeInput.placeholder = 'old-key, another-key';
    form.append(
      el('label', null, 'Add tags JSON'),
      addInput,
      el('label', null, 'Remove tag keys'),
      removeInput,
    );
    openModal('Change tags', form, 'Save', async (close) => {
      await apiJson(`/api/route53/tags/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}/`, {
        method: 'POST',
        body: JSON.stringify({
          add_tags: parseObject(addInput.value),
          remove_tag_keys: parseList(removeInput.value),
        }),
      });
      close();
      toast('Tags changed');
      await refresh();
    });
  }

  function renderZoneList() {
    const panel = el('section', 'route53-panel');
    panel.id = consoleUi.sectionIdForLabel('route53', 'Hosted zones');
    panel.append(el('div', 'route53-panel-heading', 'Hosted zones'));
    if (!hostedZones().length) {
      panel.append(el('div', 'route53-empty', 'No hosted zones found.'));
      return panel;
    }
    const list = el('div', 'route53-resource-list');
    hostedZones().forEach((zone) => {
      const row = btn('', `route53-resource-row ${cleanZoneId(zone) === cleanZoneId(selectedZone()) ? 'route53-resource-row-active' : ''}`, () => {
        state.selectedZoneId = cleanZoneId(zone);
        render();
      });
      row.append(
        el('span', 'route53-resource-name', zone.name || cleanZoneId(zone)),
        el('span', 'route53-resource-meta', cleanZoneId(zone)),
        el('span', 'route53-resource-meta', `${zone.record_count || 0} records`),
      );
      list.append(row);
    });
    panel.append(list);
    return panel;
  }

  function renderZoneDetail(zone) {
    const panel = el('section', 'route53-panel');
    if (!zone) {
      panel.append(el('div', 'route53-empty route53-empty-compact', 'Select or create a hosted zone.'));
      return panel;
    }
    const actions = el('div', 'route53-inline-actions');
    actions.append(
      btn('Add record', null, () => showRecordModal(zone)),
      btn('Tag', 'route53-btn-secondary', () => showTagsModal('hostedzone', cleanZoneId(zone))),
      btn('Delete zone', 'route53-btn-danger', () => showDeleteZoneModal(zone)),
    );
    const heading = el('div', 'route53-panel-heading');
    heading.append(el('span', null, zone.name || cleanZoneId(zone)), actions);
    panel.append(heading);
    const list = document.createElement('dl');
    addField(list, 'Hosted zone ID', cleanZoneId(zone));
    addField(list, 'Caller reference', zone.caller_reference);
    addField(list, 'Private zone', zone.private_zone);
    addField(list, 'Comment', zone.comment);
    addField(list, 'Delegation set', zone.delegation_set);
    panel.append(list);
    return panel;
  }

  function renderRecords(zone) {
    const panel = el('section', 'route53-panel');
    panel.id = consoleUi.sectionIdForLabel('route53', 'Records');
    panel.append(el('div', 'route53-panel-heading', 'Records'));
    const records = zone?.records || [];
    if (!records.length) {
      panel.append(el('div', 'route53-empty route53-empty-compact', 'No records found.'));
      return panel;
    }
    const list = el('div', 'route53-card-list');
    records.forEach((record) => {
      const card = el('article', 'route53-card');
      const actions = el('div', 'route53-inline-actions');
      actions.append(btn('Change', 'route53-btn-secondary', () => showRecordModal(zone, record)));
      const title = el('div', 'route53-inline-actions');
      title.append(el('strong', null, `${record.Name || record.name} ${record.Type || record.type}`));
      card.append(
        title,
        el('span', 'route53-resource-meta', `TTL ${record.TTL || record.ttl || 'alias'}`),
        el('pre', 'route53-code-block', consoleUi.valueText(recordValues(record) || record)),
        actions,
      );
      list.append(card);
    });
    panel.append(list);
    return panel;
  }

  function renderHealthChecks() {
    const panel = el('section', 'route53-panel');
    panel.id = consoleUi.sectionIdForLabel('route53', 'Health checks');
    panel.append(el('div', 'route53-panel-heading', 'Health checks'));
    if (!healthChecks().length) {
      panel.append(el('div', 'route53-empty route53-empty-compact', 'No health checks found.'));
      return panel;
    }
    const list = el('div', 'route53-card-list');
    healthChecks().forEach((check) => {
      const config = healthCheckConfig(check);
      const card = el('article', 'route53-card');
      const actions = el('div', 'route53-inline-actions');
      actions.append(
        btn('Update', 'route53-btn-secondary', () => showHealthCheckModal(check)),
        btn('Tag', 'route53-btn-secondary', () => showTagsModal('healthcheck', healthCheckId(check))),
        btn('Delete', 'route53-btn-danger', () => showDeleteHealthCheckModal(check)),
      );
      card.append(
        el('strong', null, healthCheckId(check)),
        el('span', 'route53-resource-meta', `${config.Type || ''} ${config.FullyQualifiedDomainName || config.IPAddress || ''}`),
        el('pre', 'route53-code-block', consoleUi.valueText(config)),
        actions,
      );
      list.append(card);
    });
    panel.append(list);
    return panel;
  }

  function renderWorkbench() {
    const zone = selectedZone();
    const container = el('div');
    container.append(toolbar(
      [btn('Create hosted zone', null, showCreateZoneModal), btn('Add record', null, () => zone && showRecordModal(zone))],
      [btn('Create health check', 'route53-btn-secondary', () => showHealthCheckModal())],
    ));
    const workbench = el('div', 'route53-workbench');
    const detail = el('div', 'route53-detail-stack');
    detail.append(renderZoneDetail(zone), renderRecords(zone), renderHealthChecks());
    workbench.append(renderZoneList(), detail);
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
    const data = await apiJson('/api/route53/');
    state.inventory = data;
    if (!selectedZone() && hostedZones().length) {
      state.selectedZoneId = cleanZoneId(hostedZones()[0]);
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'route53-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.Route53Console = Route53Console;

if (document.getElementById('route53-console-root')) {
  Route53Console.init();
}
