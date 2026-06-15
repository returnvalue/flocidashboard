/* global ServiceConsole */

const SESConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('ses-console-root');
  const breadcrumbsEl = document.getElementById('ses-breadcrumbs');
  const summaryEl = document.getElementById('ses-summary');
  const loadedAtEl = document.getElementById('ses-loaded-at');

  const state = {
    inventory: null,
    selectedIdentity: '',
    selectedTemplate: '',
    selectedConfigurationSet: '',
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'ses',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'ses');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'ses',
      toast,
    });

  function identities() {
    return state.inventory?.identities || [];
  }

  function templates() {
    return state.inventory?.templates || [];
  }

  function configurationSets() {
    return state.inventory?.v2_configuration_sets || [];
  }

  function messages() {
    return state.inventory?.mailbox?.messages || [];
  }

  function identityName(identity) {
    return identity?.name || identity?.IdentityName || identity?.Identity || '';
  }

  function templateName(template) {
    return template?.name || template?.Name || template?.TemplateName || '';
  }

  function configurationSetName(configurationSet) {
    return configurationSet?.name || configurationSet?.Name || configurationSet?.ConfigurationSetName || '';
  }

  function selectedIdentity() {
    return identities().find((identity) => identityName(identity) === state.selectedIdentity) || identities()[0] || null;
  }

  function selectedTemplate() {
    return templates().find((template) => templateName(template) === state.selectedTemplate) || templates()[0] || null;
  }

  function selectedConfigurationSet() {
    return configurationSets().find((item) => configurationSetName(item) === state.selectedConfigurationSet) || configurationSets()[0] || null;
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

  function parseList(value, label) {
    if (Array.isArray(value)) {
      return value;
    }
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return [];
    }
    if (trimmed.startsWith('[')) {
      return parseJson(trimmed, [], label);
    }
    return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  }

  function templateDataString(value) {
    const parsed = parseJson(value, {}, 'Template data');
    return JSON.stringify(parsed);
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('SES', null, () => {
      state.selectedIdentity = identities()[0] ? identityName(identities()[0]) : '';
      render();
    }));
    const identity = selectedIdentity();
    if (identity) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, identityName(identity)));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'ses',
      targets: {
        identities: 'Identities',
        verified_email_addresses: 'Verified email addresses',
        templates: 'Templates',
        captured_messages: 'Captured mailbox',
        v2_identities: 'SES v2 identities',
        v2_templates: 'SES v2 templates',
        v2_configuration_sets: 'SES v2 configuration sets',
        v2_event_destinations: 'SES v2 configuration sets',
      },
    });
  }

  function showVerifyEmailModal() {
    const form = el('div', 'ses-modal-form');
    const emailInput = document.createElement('input');
    emailInput.value = 'sender@example.com';
    form.append(el('label', null, 'Email address'), emailInput);
    openModal('Verify email identity', form, 'Verify', async (close) => {
      const data = await apiJson('/api/ses/identities/email/', {
        method: 'POST',
        body: JSON.stringify({ email_address: emailInput.value.trim() }),
      });
      state.selectedIdentity = emailInput.value.trim();
      state.lastResult = data;
      close();
      toast('Email identity verified');
      await refresh();
    });
  }

  function showVerifyDomainModal() {
    const form = el('div', 'ses-modal-form');
    const domainInput = document.createElement('input');
    domainInput.value = 'example.com';
    form.append(el('label', null, 'Domain'), domainInput);
    openModal('Verify domain identity', form, 'Verify', async (close) => {
      const data = await apiJson('/api/ses/identities/domain/', {
        method: 'POST',
        body: JSON.stringify({ domain: domainInput.value.trim() }),
      });
      state.selectedIdentity = domainInput.value.trim();
      state.lastResult = data;
      close();
      toast('Domain identity verified');
      await refresh();
    });
  }

  function showSendEmailModal(identity = selectedIdentity()) {
    const form = el('div', 'ses-modal-form');
    const sourceInput = document.createElement('input');
    sourceInput.value = identity?.type === 'email' ? identityName(identity) : 'sender@example.com';
    const toInput = document.createElement('textarea');
    toInput.value = JSON.stringify(['recipient@example.com'], null, 2);
    const subjectInput = document.createElement('input');
    subjectInput.value = 'Hello from Floci SES';
    const textInput = document.createElement('textarea');
    textInput.value = 'Sent from the Floci Dashboard SES workbench.';
    const htmlInput = document.createElement('textarea');
    htmlInput.placeholder = '<p>Sent from Floci SES</p>';
    const configInput = document.createElement('input');
    configInput.value = configurationSetName(selectedConfigurationSet());
    form.append(
      el('label', null, 'Source email'),
      sourceInput,
      el('label', null, 'To addresses JSON'),
      toInput,
      el('label', null, 'Subject'),
      subjectInput,
      el('label', null, 'Text body'),
      textInput,
      el('label', null, 'HTML body'),
      htmlInput,
      el('label', null, 'Configuration set name'),
      configInput,
    );
    openModal('Send SES email', form, 'Send', async (close) => {
      const data = await apiJson('/api/ses/email/send/', {
        method: 'POST',
        body: JSON.stringify({
          source: sourceInput.value.trim(),
          to_addresses: parseList(toInput.value, 'To addresses'),
          subject: subjectInput.value.trim(),
          text: textInput.value,
          html: htmlInput.value,
          configuration_set_name: configInput.value.trim(),
        }),
      });
      state.lastResult = data;
      close();
      toast('Email sent');
      await refresh();
    });
  }

  function showSendRawModal(identity = selectedIdentity()) {
    const form = el('div', 'ses-modal-form');
    const sourceInput = document.createElement('input');
    sourceInput.value = identity?.type === 'email' ? identityName(identity) : 'sender@example.com';
    const destinationsInput = document.createElement('textarea');
    destinationsInput.value = JSON.stringify(['recipient@example.com'], null, 2);
    const rawInput = document.createElement('textarea');
    rawInput.value = 'Subject: Raw test\r\n\r\nHello from raw Floci SES';
    form.append(
      el('label', null, 'Source email'),
      sourceInput,
      el('label', null, 'Destinations JSON'),
      destinationsInput,
      el('label', null, 'Raw MIME message'),
      rawInput,
    );
    openModal('Send raw SES email', form, 'Send', async (close) => {
      const data = await apiJson('/api/ses/email/send-raw/', {
        method: 'POST',
        body: JSON.stringify({
          source: sourceInput.value.trim(),
          destinations: parseList(destinationsInput.value, 'Destinations'),
          raw_message: rawInput.value,
        }),
      });
      state.lastResult = data;
      close();
      toast('Raw email sent');
      await refresh();
    });
  }

  function showCreateTemplateModal(template = null) {
    const editing = Boolean(template);
    const form = el('div', 'ses-modal-form');
    const nameInput = document.createElement('input');
    nameInput.value = templateName(template);
    nameInput.placeholder = 'order-receipt';
    nameInput.disabled = editing;
    const details = template?.details || {};
    const subjectInput = document.createElement('input');
    subjectInput.value = details.SubjectPart || 'Order {{orderId}}';
    const textInput = document.createElement('textarea');
    textInput.value = details.TextPart || 'Hello {{name}}, your order {{orderId}} is ready.';
    const htmlInput = document.createElement('textarea');
    htmlInput.value = details.HtmlPart || '<p>Hello {{name}}, your order {{orderId}} is ready.</p>';
    form.append(
      el('label', null, 'Template name'),
      nameInput,
      el('label', null, 'Subject'),
      subjectInput,
      el('label', null, 'Text body'),
      textInput,
      el('label', null, 'HTML body'),
      htmlInput,
    );
    openModal(editing ? 'Update SES template' : 'Create SES template', form, editing ? 'Save' : 'Create', async (close) => {
      const name = editing ? templateName(template) : nameInput.value.trim();
      const data = await apiJson(editing ? `/api/ses/templates/${encodeURIComponent(name)}/` : '/api/ses/templates/', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({
          template_name: name,
          subject: subjectInput.value.trim(),
          text: textInput.value,
          html: htmlInput.value,
        }),
      });
      state.selectedTemplate = name;
      state.lastResult = data;
      close();
      toast(editing ? 'Template updated' : 'Template created');
      await refresh();
    });
  }

  function showTemplatedEmailModal(template = selectedTemplate()) {
    const form = el('div', 'ses-modal-form');
    const sourceInput = document.createElement('input');
    sourceInput.value = 'sender@example.com';
    const toInput = document.createElement('textarea');
    toInput.value = JSON.stringify(['recipient@example.com'], null, 2);
    const templateInput = document.createElement('input');
    templateInput.value = templateName(template);
    const dataInput = document.createElement('textarea');
    dataInput.value = JSON.stringify({ name: 'Alice', orderId: 'A-100' }, null, 2);
    const configInput = document.createElement('input');
    configInput.value = configurationSetName(selectedConfigurationSet());
    form.append(
      el('label', null, 'Source email'),
      sourceInput,
      el('label', null, 'To addresses JSON'),
      toInput,
      el('label', null, 'Template name'),
      templateInput,
      el('label', null, 'Template data JSON'),
      dataInput,
      el('label', null, 'Configuration set name'),
      configInput,
    );
    openModal('Send templated email', form, 'Send', async (close) => {
      const data = await apiJson('/api/ses/email/send-templated/', {
        method: 'POST',
        body: JSON.stringify({
          source: sourceInput.value.trim(),
          to_addresses: parseList(toInput.value, 'To addresses'),
          template_name: templateInput.value.trim(),
          template_data: templateDataString(dataInput.value),
          configuration_set_name: configInput.value.trim(),
        }),
      });
      state.selectedTemplate = templateInput.value.trim();
      state.lastResult = data;
      close();
      toast('Templated email sent');
      await refresh();
    });
  }

  function showRenderTemplateModal(template = selectedTemplate()) {
    const form = el('div', 'ses-modal-form');
    const dataInput = document.createElement('textarea');
    dataInput.value = JSON.stringify({ name: 'Alice', orderId: 'A-100' }, null, 2);
    form.append(el('label', null, 'Template data JSON'), dataInput);
    openModal('Render SES template', form, 'Render', async (close) => {
      const name = templateName(template);
      const data = await apiJson(`/api/ses/templates/${encodeURIComponent(name)}/render/`, {
        method: 'POST',
        body: JSON.stringify({ template_data: templateDataString(dataInput.value) }),
      });
      state.selectedTemplate = name;
      state.lastResult = data;
      close();
      toast('Template rendered');
      await refresh();
    });
  }

  function showCreateConfigurationSetModal() {
    const form = el('div', 'ses-modal-form');
    const nameInput = document.createElement('input');
    nameInput.value = 'local-events';
    const tagsInput = document.createElement('textarea');
    tagsInput.value = JSON.stringify([{ Key: 'env', Value: 'dev' }], null, 2);
    form.append(
      el('label', null, 'Configuration set name'),
      nameInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Create SES configuration set', form, 'Create', async (close) => {
      const data = await apiJson('/api/ses/configuration-sets/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          tags: parseJson(tagsInput.value, [], 'Tags'),
        }),
      });
      state.selectedConfigurationSet = nameInput.value.trim();
      state.lastResult = data;
      close();
      toast('Configuration set created');
      await refresh();
    });
  }

  function showEventDestinationModal(configurationSet = selectedConfigurationSet()) {
    const form = el('div', 'ses-modal-form');
    const nameInput = document.createElement('input');
    nameInput.value = 'sns-events';
    const destinationInput = document.createElement('textarea');
    destinationInput.value = JSON.stringify({
      Enabled: true,
      MatchingEventTypes: ['SEND', 'DELIVERY', 'BOUNCE', 'COMPLAINT'],
      SnsDestination: {
        TopicArn: 'arn:aws:sns:us-east-1:000000000000:ses-events',
      },
    }, null, 2);
    form.append(
      el('label', null, 'Event destination name'),
      nameInput,
      el('label', null, 'Event destination JSON'),
      destinationInput,
    );
    openModal('Create event destination', form, 'Create', async (close) => {
      const setName = configurationSetName(configurationSet);
      const data = await apiJson(`/api/ses/configuration-sets/${encodeURIComponent(setName)}/event-destinations/`, {
        method: 'POST',
        body: JSON.stringify({
          event_destination_name: nameInput.value.trim(),
          event_destination: parseJson(destinationInput.value, {}, 'Event destination'),
        }),
      });
      state.selectedConfigurationSet = setName;
      state.lastResult = data;
      close();
      toast('Event destination created');
      await refresh();
    });
  }

  async function deleteIdentity(identity) {
    const name = identityName(identity);
    if (!window.confirm(`Delete SES identity ${name}?`)) {
      return;
    }
    const data = await apiJson(`/api/ses/identities/${encodeURIComponent(name)}/`, { method: 'DELETE' });
    state.selectedIdentity = '';
    state.lastResult = data;
    toast('Identity deleted');
    await refresh();
  }

  async function deleteTemplate(template) {
    const name = templateName(template);
    if (!window.confirm(`Delete SES template ${name}?`)) {
      return;
    }
    const data = await apiJson(`/api/ses/templates/${encodeURIComponent(name)}/`, { method: 'DELETE' });
    state.selectedTemplate = '';
    state.lastResult = data;
    toast('Template deleted');
    await refresh();
  }

  async function updateSending(enabled) {
    const data = await apiJson('/api/ses/account/sending/', {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
    state.lastResult = data;
    toast(`Account sending ${enabled ? 'enabled' : 'disabled'}`);
    await refresh();
  }

  async function updateConfigurationSetSending(configurationSet, enabled) {
    const name = configurationSetName(configurationSet);
    const data = await apiJson(`/api/ses/configuration-sets/${encodeURIComponent(name)}/sending/`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
    state.selectedConfigurationSet = name;
    state.lastResult = data;
    toast(`Configuration set sending ${enabled ? 'enabled' : 'disabled'}`);
    await refresh();
  }

  async function deleteConfigurationSet(configurationSet) {
    const name = configurationSetName(configurationSet);
    if (!window.confirm(`Delete SES configuration set ${name}?`)) {
      return;
    }
    const data = await apiJson(`/api/ses/configuration-sets/${encodeURIComponent(name)}/`, { method: 'DELETE' });
    state.selectedConfigurationSet = '';
    state.lastResult = data;
    toast('Configuration set deleted');
    await refresh();
  }

  async function deleteEventDestination(configurationSet, eventDestination) {
    const setName = configurationSetName(configurationSet);
    const name = eventDestination?.Name || eventDestination?.EventDestinationName || '';
    if (!window.confirm(`Delete event destination ${name} from ${setName}?`)) {
      return;
    }
    const data = await apiJson(`/api/ses/configuration-sets/${encodeURIComponent(setName)}/event-destinations/${encodeURIComponent(name)}/`, {
      method: 'DELETE',
    });
    state.lastResult = data;
    toast('Event destination deleted');
    await refresh();
  }

  async function clearCapturedMailbox() {
    if (!window.confirm('Clear all captured SES messages?')) {
      return;
    }
    const data = await apiJson('/api/ses/mailbox/', { method: 'DELETE' });
    state.lastResult = data;
    toast('SES mailbox cleared');
    await refresh();
  }

  function renderIdentityRow(identity) {
    const name = identityName(identity);
    const active = name === identityName(selectedIdentity());
    const row = el('button', `ses-identity-row${active ? ' ses-identity-row-active' : ''}`);
    const verification = identity?.verification?.VerificationStatus || identity?.verification?.verification_status || 'verified locally';
    row.append(
      el('span', 'ses-identity-name', name || 'Identity'),
      el('span', 'ses-identity-meta', `${identity?.type || 'identity'} / ${verification}`),
    );
    row.addEventListener('click', () => {
      state.selectedIdentity = name;
      render();
    });
    return row;
  }

  function renderIdentityList() {
    const panel = el('section', 'ses-panel');
    panel.append(el('div', 'ses-panel-heading', 'Identities'));
    const list = el('div', 'ses-identity-list');
    if (!identities().length) {
      list.append(el('div', 'ses-empty', 'No SES identities found.'));
    } else {
      identities().forEach((identity) => list.append(renderIdentityRow(identity)));
    }
    panel.append(list);
    return panel;
  }

  function renderIdentityFacts(identity) {
    const facts = document.createElement('dl');
    consoleUi.addField(facts, 'Type', identity.type);
    consoleUi.addField(facts, 'Verification', identity.verification);
    consoleUi.addField(facts, 'Notifications', identity.notifications);
    consoleUi.addField(facts, 'DKIM', identity.dkim);
    return facts;
  }

  function renderTemplates() {
    const wrapper = el('div', 'ses-card-list');
    if (!templates().length) {
      wrapper.append(el('p', 'ses-empty', 'No SES templates found.'));
      return wrapper;
    }
    templates().forEach((template) => {
      const card = el('article', 'ses-card');
      card.append(el('h3', null, templateName(template)));
      const facts = document.createElement('dl');
      consoleUi.addField(facts, 'Created', template.created);
      consoleUi.addField(facts, 'Subject', template.details?.SubjectPart);
      consoleUi.addField(facts, 'Text', template.details?.TextPart);
      consoleUi.addField(facts, 'HTML', template.details?.HtmlPart);
      card.append(facts);
      const actions = el('div', 'ses-action-row');
      actions.append(
        btn('Send templated', null, () => showTemplatedEmailModal(template)),
        btn('Render', 'ses-btn-secondary', () => showRenderTemplateModal(template)),
        btn('Update', 'ses-btn-secondary', () => showCreateTemplateModal(template)),
        btn('Delete', 'ses-btn-danger', () => deleteTemplate(template).catch((error) => toast(error.message, true))),
      );
      card.append(actions);
      wrapper.append(card);
    });
    return wrapper;
  }

  function renderConfigurationSets() {
    const wrapper = el('div', 'ses-card-list');
    if (!configurationSets().length) {
      wrapper.append(el('p', 'ses-empty', 'No SES v2 configuration sets found.'));
      return wrapper;
    }
    configurationSets().forEach((configurationSet) => {
      const card = el('article', 'ses-card');
      card.append(el('h3', null, configurationSetName(configurationSet)));
      const facts = document.createElement('dl');
      consoleUi.addField(facts, 'Details', configurationSet.details);
      consoleUi.addField(facts, 'Sending enabled', configurationSet.sending_enabled);
      consoleUi.addField(facts, 'Sending options', configurationSet.sending_options);
      consoleUi.addField(facts, 'Delivery options', configurationSet.delivery_options);
      consoleUi.addField(facts, 'Reputation options', configurationSet.reputation_options);
      consoleUi.addField(facts, 'Suppression options', configurationSet.suppression_options);
      consoleUi.addField(facts, 'Tracking options', configurationSet.tracking_options);
      consoleUi.addField(facts, 'Event destinations', configurationSet.event_destination_count);
      card.append(facts);
      const actions = el('div', 'ses-action-row');
      const sendingEnabled = configurationSet.sending_enabled !== false;
      actions.append(
        btn('Add event destination', null, () => showEventDestinationModal(configurationSet)),
        btn(sendingEnabled ? 'Disable set sending' : 'Enable set sending', 'ses-btn-secondary', () => updateConfigurationSetSending(configurationSet, !sendingEnabled).catch((error) => toast(error.message, true))),
        btn('Delete set', 'ses-btn-danger', () => deleteConfigurationSet(configurationSet).catch((error) => toast(error.message, true))),
      );
      card.append(actions);
      (configurationSet.event_destinations || []).forEach((destination) => {
        const destinationCard = el('div', 'ses-subcard');
        destinationCard.append(el('strong', null, destination.Name || destination.EventDestinationName || 'Event destination'));
        const pre = el('pre', 'ses-result');
        pre.textContent = JSON.stringify(consoleUi.displayValue(destination), null, 2);
        destinationCard.append(pre, btn('Delete destination', 'ses-btn-danger', () => deleteEventDestination(configurationSet, destination).catch((error) => toast(error.message, true))));
        card.append(destinationCard);
      });
      wrapper.append(card);
    });
    return wrapper;
  }

  function renderMessages() {
    const wrapper = el('div', 'ses-card-list');
    if (!messages().length) {
      wrapper.append(el('p', 'ses-empty', 'No captured SES messages found.'));
      return wrapper;
    }
    messages().forEach((message) => {
      const card = el('article', 'ses-card');
      card.append(el('h3', null, message.subject || message.id || 'Captured message'));
      const facts = document.createElement('dl');
      consoleUi.addField(facts, 'Message ID', message.id);
      consoleUi.addField(facts, 'From', message.from);
      consoleUi.addField(facts, 'To', message.to);
      consoleUi.addField(facts, 'Timestamp', message.timestamp);
      consoleUi.addField(facts, 'Body preview', message.body_preview);
      card.append(facts);
      wrapper.append(card);
    });
    return wrapper;
  }

  function renderLastResult() {
    if (!state.lastResult) {
      return null;
    }
    const result = el('div', 'ses-last-result');
    result.append(el('h3', null, 'Last action result'));
    const pre = el('pre', 'ses-result');
    pre.textContent = JSON.stringify(consoleUi.displayValue(state.lastResult), null, 2);
    result.append(pre);
    return result;
  }

  function renderDetail(identity) {
    const panel = el('section', 'ses-panel');
    const heading = el('div', 'ses-panel-heading');
    heading.append(
      el('span', null, identity ? identityName(identity) : 'SES workbench'),
      el('span', 'ses-identity-meta', identity ? `${identity.type || 'identity'} / local email` : 'No identity selected'),
    );
    panel.append(heading);

    const content = el('div', 'ses-detail');
    if (!identity) {
      content.append(el('div', 'ses-empty', 'Verify an identity or refresh after your app creates one.'));
    } else {
      content.append(renderIdentityFacts(identity));
      const actions = el('div', 'ses-action-row');
      actions.append(
        btn('Send email', null, () => showSendEmailModal(identity)),
        btn('Send raw', 'ses-btn-secondary', () => showSendRawModal(identity)),
        btn('Delete identity', 'ses-btn-danger', () => deleteIdentity(identity).catch((error) => toast(error.message, true))),
      );
      content.append(actions);
    }
    content.append(
      el('h3', null, 'Templates'),
      renderTemplates(),
      el('h3', null, 'Configuration sets'),
      renderConfigurationSets(),
      el('h3', null, 'Captured mailbox'),
      renderMessages(),
    );
    const result = renderLastResult();
    if (result) {
      content.append(result);
    }
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const identity = selectedIdentity();
    const sendingEnabled = Boolean(state.inventory?.account_sending_enabled?.Enabled);
    const container = el('div');
    container.append(toolbar(
      [
        btn('Verify email', null, showVerifyEmailModal),
        btn('Verify domain', 'ses-btn-secondary', showVerifyDomainModal),
        btn('Send email', 'ses-btn-secondary', () => showSendEmailModal()),
        btn('Create template', 'ses-btn-secondary', () => showCreateTemplateModal()),
        btn('Create configuration set', 'ses-btn-secondary', showCreateConfigurationSetModal),
        btn(sendingEnabled ? 'Disable sending' : 'Enable sending', 'ses-btn-secondary', () => updateSending(!sendingEnabled).catch((error) => toast(error.message, true))),
        btn('Clear mailbox', 'ses-btn-danger', () => clearCapturedMailbox().catch((error) => toast(error.message, true))),
        btn('Refresh', 'ses-btn-secondary', () => refresh().catch((error) => toast(error.message, true))),
      ],
      [el('span', 'ses-toolbar-note', 'Captured messages are stored at /_aws/ses')],
    ));
    const workbench = el('div', 'ses-workbench');
    workbench.append(renderIdentityList(), renderDetail(identity));
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
    const data = await apiJson('/api/ses/');
    state.inventory = data;
    if (!selectedIdentity() && identities().length) {
      state.selectedIdentity = identityName(identities()[0]);
    }
    if (!selectedTemplate() && templates().length) {
      state.selectedTemplate = templateName(templates()[0]);
    }
    if (!selectedConfigurationSet() && configurationSets().length) {
      state.selectedConfigurationSet = configurationSetName(configurationSets()[0]);
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'ses-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.SESConsole = SESConsole;

if (document.getElementById('ses-console-root')) {
  SESConsole.init();
}
