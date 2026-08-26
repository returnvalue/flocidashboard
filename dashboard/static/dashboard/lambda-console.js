/* global ServiceConsole */

const LambdaConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('lambda-console-root');
  const breadcrumbsEl = document.getElementById('lambda-breadcrumbs');
  const summaryEl = document.getElementById('lambda-summary');
  const loadedAtEl = document.getElementById('lambda-loaded-at');

  const state = {
    inventory: null,
    selectedFunctionName: '',
    lastInvoke: null,
    lastUrlTest: null,
    templates: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'lambda',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'lambda');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'lambda',
      toast,
    });

  function functions() {
    return state.inventory?.functions || [];
  }

  function selectedFunction() {
    return functions().find((fn) => fn.name === state.selectedFunctionName) || functions()[0] || null;
  }

  function logGroupName(fn) {
    return fn?.name ? `/aws/lambda/${fn.name}` : '';
  }

  function getSavedEvents(fnName) {
    try {
      const raw = localStorage.getItem(`floci_lambda_saved_events_${fnName}`);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveEvent(fnName, eventName, payload) {
    const events = getSavedEvents(fnName);
    events[eventName] = payload;
    localStorage.setItem(`floci_lambda_saved_events_${fnName}`, JSON.stringify(events));
  }

  function deleteSavedEvent(fnName, eventName) {
    const events = getSavedEvents(fnName);
    delete events[eventName];
    localStorage.setItem(`floci_lambda_saved_events_${fnName}`, JSON.stringify(events));
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) return;
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'AWS Lambda');
    home.addEventListener('click', () => {
      state.selectedFunctionName = '';
      render();
    });
    breadcrumbsEl.append(home);
    const fn = selectedFunction();
    if (fn) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, fn.name));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'lambda',
      targets: {
        functions: 'Functions',
        event_source_mappings: 'Event source mappings',
        function_urls: 'Functions',
        aliases: 'Functions',
        published_versions: 'Functions',
      },
    });
  }

  function parsePayload(value) {
    const trimmed = value.trim();
    if (!trimmed) return {};
    return JSON.parse(trimmed);
  }

  function invokePath(functionName) {
    return `/api/lambda/functions/${encodeURIComponent(functionName)}/invoke/`;
  }

  async function mutate(path, method, body, message) {
    const data = await apiJson(path, {
      method,
      body: body === null ? undefined : JSON.stringify(body),
    });
    toast(message);
    await refresh();
    return data;
  }

  function showJsonModal(title, fields, confirmLabel, onSubmit) {
    const form = el('div', 'lambda-modal-form');
    const inputs = {};
    fields.forEach((field) => {
      const input = document.createElement(field.multiline ? 'textarea' : 'input');
      input.value = field.value || '';
      input.placeholder = field.placeholder || '';
      if (field.type) input.type = field.type;
      inputs[field.name] = input;
      form.append(el('label', null, field.label), input);
    });
    openModal(title, form, confirmLabel, async (close) => {
      await onSubmit(inputs);
      close();
    });
  }

  function jsonInput(input, label) {
    try {
      return JSON.parse(input.value || '{}');
    } catch (error) {
      throw new Error(`${label} must be valid JSON`);
    }
  }

  function showCreateFunctionModal() {
    showJsonModal('Create Lambda function', [
      { name: 'name', label: 'Function name', placeholder: 'worker' },
      { name: 'role', label: 'Execution role ARN', value: 'arn:aws:iam::000000000000:role/lambda-role' },
      { name: 'configuration', label: 'Configuration JSON', multiline: true, value: '{\n  "Runtime": "python3.13",\n  "Handler": "lambda_function.lambda_handler",\n  "Timeout": 10,\n  "MemorySize": 128\n}' },
      { name: 'code', label: 'Code JSON', multiline: true, value: '{\n  "S3Bucket": "hot-reload",\n  "S3Key": "/absolute/host/path"\n}' },
      { name: 'tags', label: 'Tags JSON', multiline: true, value: '{}' },
    ], 'Create', async (inputs) => {
      state.selectedFunctionName = inputs.name.value.trim();
      await mutate('/api/lambda/functions/', 'POST', {
        name: inputs.name.value.trim(), role: inputs.role.value.trim(),
        configuration: jsonInput(inputs.configuration, 'Configuration'),
        code: jsonInput(inputs.code, 'Code'), tags: jsonInput(inputs.tags, 'Tags'),
      }, 'Function created');
    });
  }

  function showConfigurationModal(fn) {
    const config = fn.configuration && !fn.configuration.error ? fn.configuration : {};
    const editable = ['Runtime', 'Role', 'Handler', 'Description', 'Timeout', 'MemorySize', 'Environment', 'TracingConfig', 'Layers', 'Architectures', 'EphemeralStorage', 'SnapStart', 'LoggingConfig']
      .reduce((result, key) => (config[key] !== undefined ? { ...result, [key]: config[key] } : result), {});
    showJsonModal('Update function configuration', [{ name: 'configuration', label: 'Configuration JSON', multiline: true, value: JSON.stringify(editable, null, 2) }], 'Update', async (inputs) => {
      await mutate(`/api/lambda/functions/${encodeURIComponent(fn.name)}/`, 'PATCH', { configuration: jsonInput(inputs.configuration, 'Configuration') }, 'Configuration updated');
    });
  }

  function showCodeModal(fn) {
    showJsonModal('Update function code', [
      { name: 'code', label: 'Code JSON', multiline: true, value: '{\n  "S3Bucket": "deployment-bucket",\n  "S3Key": "function.zip"\n}' },
      { name: 'publish', label: 'Publish immediately (true/false)', value: 'false' },
    ], 'Update', async (inputs) => {
      await mutate(`/api/lambda/functions/${encodeURIComponent(fn.name)}/code/`, 'PUT', { code: jsonInput(inputs.code, 'Code'), publish: inputs.publish.value.trim().toLowerCase() === 'true' }, 'Function code updated');
    });
  }

  function showAliasModal(fn, alias = null) {
    showJsonModal(alias ? 'Update alias' : 'Create alias', [
      { name: 'name', label: 'Alias name', value: alias?.Name || '' },
      { name: 'version', label: 'Function version', value: alias?.FunctionVersion || '' },
      { name: 'description', label: 'Description', value: alias?.Description || '' },
    ], alias ? 'Update' : 'Create', async (inputs) => {
      const name = inputs.name.value.trim();
      const path = `/api/lambda/functions/${encodeURIComponent(fn.name)}/aliases/${alias ? `${encodeURIComponent(alias.Name)}/` : ''}`;
      await mutate(path, alias ? 'PUT' : 'POST', { name, function_version: inputs.version.value.trim(), description: inputs.description.value }, alias ? 'Alias updated' : 'Alias created');
    });
  }

  function showMappingModal(fn, mapping = null) {
    const options = mapping ? {
      Enabled: mapping.State !== 'Disabled', BatchSize: mapping.BatchSize,
      MaximumBatchingWindowInSeconds: mapping.MaximumBatchingWindowInSeconds,
      MaximumRecordAgeInSeconds: mapping.MaximumRecordAgeInSeconds,
      MaximumRetryAttempts: mapping.MaximumRetryAttempts,
      DestinationConfig: mapping.DestinationConfig, ScalingConfig: mapping.ScalingConfig,
    } : { EventSourceArn: 'arn:aws:sqs:us-east-1:000000000000:queue-name', Enabled: true, BatchSize: 10 };
    showJsonModal(mapping ? 'Update trigger' : 'Create trigger', [{ name: 'options', label: 'Event source mapping JSON', multiline: true, value: JSON.stringify(options, null, 2) }], mapping ? 'Update' : 'Create', async (inputs) => {
      const path = mapping ? `/api/lambda/event-source-mappings/${encodeURIComponent(mapping.UUID)}/` : `/api/lambda/functions/${encodeURIComponent(fn.name)}/event-source-mappings/`;
      await mutate(path, mapping ? 'PUT' : 'POST', { options: jsonInput(inputs.options, 'Event source mapping') }, mapping ? 'Trigger updated' : 'Trigger created');
    });
  }

  async function loadTemplates() {
    if (!state.templates) {
      try {
        state.templates = await apiJson('/api/lambda/test-events/templates/');
      } catch (e) {
        state.templates = {};
      }
    }
    return state.templates;
  }

  async function invokeFunction(fn, payload) {
    const data = await apiJson(invokePath(fn.name), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.lastInvoke = data;
    consoleUi.recordActivity({
      service: 'lambda',
      action: 'invoke',
      title: fn.name,
      summary: payload.qualifier ? `Qualifier ${payload.qualifier}` : 'Unqualified invoke',
      detail: data.function_error ? `Error ${data.function_error}` : `Status ${data.status_code}`,
      replayLabel: 'Prefill',
      payload: {
        function_name: fn.name,
        ...payload,
      },
    });
    return data;
  }

  function replayInvoke(item) {
    const payload = item.payload || {};
    const fn = functions().find((candidate) => candidate.name === payload.function_name) || selectedFunction();
    if (payload.function_name) {
      state.selectedFunctionName = payload.function_name;
    }
    render();
    if (fn) {
      showInvokeModal(fn, payload);
    }
  }

  async function showInvokeModal(fn, replay = null) {
    const templates = await loadTemplates();
    const savedEvents = getSavedEvents(fn.name);

    const form = el('div', 'lambda-modal-form');

    const templateSelect = document.createElement('select');
    const defaultTemplateOpt = el('option', null, '-- Choose Built-in AWS Event Template --');
    defaultTemplateOpt.value = '';
    templateSelect.append(defaultTemplateOpt);
    Object.entries(templates).forEach(([key, info]) => {
      const opt = el('option', null, info.name);
      opt.value = key;
      templateSelect.append(opt);
    });

    const savedSelect = document.createElement('select');
    const defaultSavedOpt = el('option', null, '-- Choose Saved Custom Test Event --');
    defaultSavedOpt.value = '';
    savedSelect.append(defaultSavedOpt);
    Object.keys(savedEvents).forEach((name) => {
      const opt = el('option', null, name);
      opt.value = name;
      savedSelect.append(opt);
    });

    const payloadInput = document.createElement('textarea');
    payloadInput.required = true;
    payloadInput.style.minHeight = '180px';
    payloadInput.value = JSON.stringify(replay?.payload || { source: 'floci-dashboard' }, null, 2);

    templateSelect.addEventListener('change', () => {
      const selected = templates[templateSelect.value];
      if (selected) {
        payloadInput.value = JSON.stringify(selected.event, null, 2);
      }
    });

    savedSelect.addEventListener('change', () => {
      const eventData = savedEvents[savedSelect.value];
      if (eventData) {
        payloadInput.value = JSON.stringify(eventData, null, 2);
      }
    });

    const saveEventRow = el('div', 'lambda-save-event-row');
    const saveNameInput = document.createElement('input');
    saveNameInput.placeholder = 'Event name (e.g. valid-order-event)';
    const saveBtn = btn('Save Test Event', 'lambda-btn-secondary', () => {
      const name = saveNameInput.value.trim();
      if (!name) {
        toast('Please enter a test event name', true);
        return;
      }
      try {
        const payloadObj = JSON.parse(payloadInput.value);
        saveEvent(fn.name, name, payloadObj);
        toast(`Test event "${name}" saved in browser storage`);
      } catch (e) {
        toast('Payload must be valid JSON to save: ' + e.message, true);
      }
    });
    saveEventRow.append(saveNameInput, saveBtn);

    const qualifierInput = document.createElement('input');
    qualifierInput.placeholder = 'optional version or alias';
    qualifierInput.value = replay?.qualifier || '';
    const qualifierList = document.createElement('datalist');
    qualifierList.id = 'lambda-qualifiers';
    [...(fn.aliases || []).map((alias) => alias.Name), ...(fn.versions || []).map((version) => version.Version)].forEach((value) => qualifierList.append(el('option', null, value)));
    qualifierInput.setAttribute('list', qualifierList.id);

    const typeInput = document.createElement('select');
    [['RequestResponse', 'Synchronous (RequestResponse)'], ['Event', 'Asynchronous (Event)'], ['DryRun', 'Validate only (DryRun)']].forEach(([value, label]) => {
      const option = el('option', null, label); option.value = value; typeInput.append(option);
    });
    typeInput.value = replay?.invocation_type || 'RequestResponse';

    form.append(
      el('label', null, 'Function'),
      el('pre', 'lambda-function-preview', fn.name),
      el('label', null, 'Event Template Presets'),
      templateSelect,
      el('label', null, 'Saved Test Events'),
      savedSelect,
      el('label', null, 'JSON Payload Editor'),
      payloadInput,
      el('label', null, 'Save as Named Test Event'),
      saveEventRow,
      el('label', null, 'Qualifier (Alias or Version)'),
      qualifierInput,
      qualifierList,
      el('label', null, 'Invocation Type'),
      typeInput,
    );

    openModal('Invoke Lambda Function', form, 'Invoke', async (close) => {
      const data = await invokeFunction(fn, {
        payload: parsePayload(payloadInput.value),
        qualifier: qualifierInput.value.trim() || null,
        invocation_type: typeInput.value,
      });
      state.lastInvoke = data;
      close();
      toast(data.function_error ? `Function error: ${data.function_error}` : 'Function invoked');
      render();
    });
  }

  function showFunctionUrlTestModal(fn) {
    const form = el('div', 'lambda-modal-form');
    const fnUrl = fn.function_url?.FunctionUrl || `http://localhost:4566/2021-10-31/functions/${encodeURIComponent(fn.name)}/invocations`;

    const urlInput = document.createElement('input');
    urlInput.value = fnUrl;
    urlInput.placeholder = 'Function URL endpoint (e.g. http://...)';

    const methodSelect = document.createElement('select');
    ['POST', 'GET', 'PUT', 'DELETE', 'PATCH', 'HEAD'].forEach((m) => {
      const opt = el('option', null, m);
      opt.value = m;
      methodSelect.append(opt);
    });

    const headersInput = document.createElement('textarea');
    headersInput.className = 'lambda-json-input';
    headersInput.placeholder = '{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer test-token"\n}';
    headersInput.value = '{\n  "Content-Type": "application/json"\n}';

    const bodyInput = document.createElement('textarea');
    bodyInput.className = 'lambda-json-input';
    bodyInput.style.minHeight = '120px';
    bodyInput.placeholder = '{\n  "message": "Hello from Function URL test"\n}';
    bodyInput.value = '{\n  "message": "Hello from Function URL test"\n}';

    form.append(
      el('label', null, 'Function URL Endpoint'),
      urlInput,
      el('label', null, 'HTTP Method'),
      methodSelect,
      el('label', null, 'Request Headers (JSON object, Optional)'),
      headersInput,
      el('label', null, 'Request Body (Optional)'),
      bodyInput,
    );

    openModal('Direct Function URL HTTP Tester', form, 'Send HTTP Request', async (close) => {
      const url = urlInput.value.trim();
      if (!url) throw new Error('Function URL endpoint is required');

      let headers = null;
      if (headersInput.value.trim()) {
        try {
          headers = JSON.parse(headersInput.value.trim());
        } catch (e) {
          throw new Error('Headers must be valid JSON: ' + e.message);
        }
      }

      const res = await apiJson('/api/lambda/function-url/test/', {
        method: 'POST',
        body: JSON.stringify({
          url,
          method: methodSelect.value,
          headers,
          body: bodyInput.value,
        }),
      });
      state.lastUrlTest = res;
      toast(`HTTP ${res.status_code} received in ${res.latency_ms}ms`);
      close();
      render();
    });
  }

  function renderFunctionRow(fn) {
    const active = fn.name === selectedFunction()?.name;
    const row = el('button', `lambda-function-row${active ? ' lambda-function-row-active' : ''}`);
    const meta = [
      fn.runtime || fn.package_type,
      fn.handler,
      fn.state,
    ].filter(Boolean);
    row.append(
      el('span', 'lambda-function-name', fn.name || 'Unnamed function'),
      el('span', 'lambda-function-meta', meta.join(' / ') || 'No configuration summary'),
    );
    row.addEventListener('click', () => {
      state.selectedFunctionName = fn.name;
      render();
    });
    return row;
  }

  function renderFunctionList() {
    const panel = el('section', 'lambda-panel');
    panel.append(el('div', 'lambda-panel-heading', 'Functions'));
    const list = el('div', 'lambda-function-list');
    if (!functions().length) {
      list.append(el('div', 'lambda-empty', 'No functions found.'));
    } else {
      functions().forEach((fn) => list.append(renderFunctionRow(fn)));
    }
    panel.append(list);
    return panel;
  }

  function renderInvokeResult(fn) {
    if (!state.lastInvoke || state.lastInvoke.function_name !== fn?.name) {
      return el('div', 'lambda-empty lambda-empty-compact', 'Invoke this function to inspect the response payload and log tail.');
    }

    const wrapper = el('div', 'lambda-invoke-result');
    const status = document.createElement('dl');
    consoleUi.addField(status, 'Status code', state.lastInvoke.status_code);
    consoleUi.addField(status, 'Function error', state.lastInvoke.function_error || 'None');
    consoleUi.addField(status, 'Executed version', state.lastInvoke.executed_version);
    consoleUi.addField(status, 'Log group', state.lastInvoke.log_group || logGroupName(fn));
    wrapper.append(el('h3', null, 'Last invoke'), status);

    const payload = state.lastInvoke.payload?.json ?? state.lastInvoke.payload?.raw ?? '';
    wrapper.append(el('h3', null, 'Response payload'));
    wrapper.append(el('pre', 'lambda-output', typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)));

    wrapper.append(el('h3', null, 'Log tail'));
    wrapper.append(el('pre', 'lambda-output', state.lastInvoke.log_tail || 'No log tail returned.'));
    return wrapper;
  }

  function renderUrlTestResult() {
    if (!state.lastUrlTest) return null;
    const res = state.lastUrlTest;
    const card = el('section', 'lambda-card');
    const heading = el('div', 'lambda-card-heading');
    heading.append(
      el('h3', null, 'Last Function URL HTTP Test Result'),
      el('span', 'lambda-function-meta', `${res.latency_ms}ms · HTTP ${res.status_code}`),
    );
    card.append(heading);

    const details = document.createElement('dl');
    consoleUi.addField(details, 'URL', res.url);
    consoleUi.addField(details, 'Method', res.method);
    consoleUi.addField(details, 'Status', res.status_code);
    consoleUi.addField(details, 'Latency', `${res.latency_ms} ms`);
    consoleUi.addField(details, 'Response Headers', res.headers || {});
    card.append(details);

    card.append(el('h4', null, 'Response Body'));
    card.append(el('pre', 'lambda-output', res.json ? JSON.stringify(res.json, null, 2) : res.body || 'Empty body'));
    return card;
  }

  function section(title, actions = []) {
    const wrapper = el('section', 'lambda-detail-section');
    const heading = el('div', 'lambda-detail-section-heading');
    heading.append(el('h3', null, title));
    const controls = el('div', 'lambda-action-row');
    actions.forEach((action) => controls.append(action));
    heading.append(controls);
    wrapper.append(heading);
    return wrapper;
  }

  function renderConfiguration(fn) {
    const wrapper = section('Configuration', [btn('Edit', 'lambda-btn-secondary', () => showConfigurationModal(fn)), btn('Update code', 'lambda-btn-secondary', () => showCodeModal(fn))]);
    const details = document.createElement('dl');
    [
      ['ARN', fn.arn], ['Runtime', fn.runtime], ['Handler', fn.handler], ['Package type', fn.package_type],
      ['State', fn.state], ['Last modified', fn.last_modified], ['Memory (MB)', fn.memory_size],
      ['Timeout (seconds)', fn.timeout], ['Role', fn.role], ['Architectures', fn.architectures],
      ['Environment', fn.environment], ['Tracing', fn.tracing_config], ['Layers', fn.layers], ['Tags', fn.tags],
    ].forEach(([label, value]) => consoleUi.addField(details, label, value));
    wrapper.append(details);
    return wrapper;
  }

  function renderVersionsAndAliases(fn) {
    const wrapper = section('Versions and aliases', [
      btn('Publish version', 'lambda-btn-secondary', () => showJsonModal('Publish version', [{ name: 'description', label: 'Description' }], 'Publish', async (inputs) => mutate(`/api/lambda/functions/${encodeURIComponent(fn.name)}/versions/`, 'POST', { description: inputs.description.value }, 'Version published'))),
      btn('Create alias', 'lambda-btn-secondary', () => showAliasModal(fn)),
    ]);
    const versions = el('div', 'lambda-chip-list');
    (fn.versions || []).forEach((version) => versions.append(el('span', 'lambda-chip', `v${version.Version} · ${version.Description || 'No description'}`)));
    wrapper.append(el('h4', null, 'Published versions'), versions.childNodes.length ? versions : el('div', 'lambda-empty lambda-empty-compact', 'No published versions.'));
    const aliases = el('div', 'lambda-card-list');
    (fn.aliases || []).forEach((alias) => {
      const card = el('article', 'lambda-mini-card');
      card.append(el('strong', null, alias.Name), el('span', null, `Version ${alias.FunctionVersion}`));
      const controls = el('div', 'lambda-action-row');
      controls.append(btn('Edit', 'lambda-btn-secondary', () => showAliasModal(fn, alias)), btn('Delete', 'lambda-btn-danger', async () => {
        if (window.confirm(`Delete alias ${alias.Name}?`)) await mutate(`/api/lambda/functions/${encodeURIComponent(fn.name)}/aliases/${encodeURIComponent(alias.Name)}/`, 'DELETE', null, 'Alias deleted');
      }));
      card.append(controls); aliases.append(card);
    });
    wrapper.append(el('h4', null, 'Aliases'), aliases.childNodes.length ? aliases : el('div', 'lambda-empty lambda-empty-compact', 'No aliases.'));
    return wrapper;
  }

  function renderTriggers(fn) {
    const wrapper = section('Triggers', [btn('Add trigger', 'lambda-btn-secondary', () => showMappingModal(fn))]);
    const cards = el('div', 'lambda-card-list');
    (fn.event_source_mappings || []).forEach((mapping) => {
      const card = el('article', 'lambda-mini-card');
      const facts = document.createElement('dl');
      [['UUID', mapping.UUID], ['Source', mapping.EventSourceArn], ['State', mapping.State], ['Batch size', mapping.BatchSize], ['Batching window', mapping.MaximumBatchingWindowInSeconds], ['Scaling', mapping.ScalingConfig], ['Last result', mapping.LastProcessingResult], ['Failure destination', mapping.DestinationConfig?.OnFailure?.Destination]].forEach(([label, value]) => consoleUi.addField(facts, label, value));
      const controls = el('div', 'lambda-action-row');
      controls.append(btn('Edit', 'lambda-btn-secondary', () => showMappingModal(fn, mapping)), btn('Delete', 'lambda-btn-danger', async () => {
        if (window.confirm('Delete this event source mapping?')) await mutate(`/api/lambda/event-source-mappings/${encodeURIComponent(mapping.UUID)}/`, 'DELETE', null, 'Trigger deleted');
      }));
      card.append(facts, controls); cards.append(card);
    });
    wrapper.append(cards.childNodes.length ? cards : el('div', 'lambda-empty lambda-empty-compact', 'No event source mappings.'));
    return wrapper;
  }

  function renderAccessAndRuntime(fn) {
    const wrapper = section('Access and runtime controls');
    const facts = document.createElement('dl');
    [['Reserved concurrency', fn.concurrency?.ReservedConcurrentExecutions], ['Function URL', fn.function_url], ['Resource policy', fn.policy], ['Code signing', fn.code_signing_config]].forEach(([label, value]) => consoleUi.addField(facts, label, value));
    wrapper.append(facts);
    const controls = el('div', 'lambda-action-row');
    controls.append(
      btn('Set concurrency', 'lambda-btn-secondary', () => showJsonModal('Reserved concurrency', [{ name: 'value', label: 'Concurrent executions', type: 'number', value: fn.concurrency?.ReservedConcurrentExecutions ?? '' }], 'Save', async (inputs) => mutate(`/api/lambda/functions/${encodeURIComponent(fn.name)}/concurrency/`, 'PUT', { reserved_concurrency: inputs.value.value }, 'Concurrency updated'))),
      btn(fn.function_url ? 'Edit URL' : 'Create URL', 'lambda-btn-secondary', () => showJsonModal('Function URL configuration', [{ name: 'options', label: 'Configuration JSON', multiline: true, value: JSON.stringify(fn.function_url && !fn.function_url.error ? { AuthType: fn.function_url.AuthType, Cors: fn.function_url.Cors } : { AuthType: 'NONE' }, null, 2) }], 'Save', async (inputs) => mutate(`/api/lambda/functions/${encodeURIComponent(fn.name)}/url/`, fn.function_url ? 'PUT' : 'POST', { options: jsonInput(inputs.options, 'URL configuration') }, 'Function URL saved'))),
      btn('Test Function URL', 'lambda-btn-secondary', () => showFunctionUrlTestModal(fn)),
      btn('Add permission', 'lambda-btn-secondary', () => showJsonModal('Add permission', [{ name: 'statement', label: 'Permission JSON', multiline: true, value: '{\n  "StatementId": "allow-local",\n  "Action": "lambda:InvokeFunction",\n  "Principal": "*"\n}' }], 'Add', async (inputs) => mutate(`/api/lambda/functions/${encodeURIComponent(fn.name)}/permissions/`, 'POST', { statement: jsonInput(inputs.statement, 'Permission') }, 'Permission added'))),
      btn('Edit tags', 'lambda-btn-secondary', () => showJsonModal('Tag function', [{ name: 'tags', label: 'Tags JSON', multiline: true, value: JSON.stringify(fn.tags || {}, null, 2) }], 'Save', async (inputs) => mutate(`/api/lambda/functions/${encodeURIComponent(fn.name)}/tags/`, 'POST', { resource_arn: fn.arn, tags: jsonInput(inputs.tags, 'Tags') }, 'Tags updated'))),
      btn('Clear concurrency', 'lambda-btn-secondary', async () => mutate(`/api/lambda/functions/${encodeURIComponent(fn.name)}/concurrency/`, 'DELETE', null, 'Reserved concurrency cleared')),
      btn('Remove permission', 'lambda-btn-secondary', () => showJsonModal('Remove permission', [{ name: 'statement_id', label: 'Statement ID' }], 'Remove', async (inputs) => mutate(`/api/lambda/functions/${encodeURIComponent(fn.name)}/permissions/`, 'DELETE', { statement_id: inputs.statement_id.value.trim() }, 'Permission removed'))),
      btn('Remove tags', 'lambda-btn-secondary', () => showJsonModal('Remove tags', [{ name: 'tag_keys', label: 'Tag keys (comma-separated)' }], 'Remove', async (inputs) => mutate(`/api/lambda/functions/${encodeURIComponent(fn.name)}/tags/`, 'DELETE', { resource_arn: fn.arn, tag_keys: inputs.tag_keys.value.split(',').map((key) => key.trim()).filter(Boolean) }, 'Tags removed'))),
    );
    if (fn.function_url) {
      controls.append(btn('Delete URL', 'lambda-btn-danger', async () => {
        if (window.confirm('Delete this function URL?')) await mutate(`/api/lambda/functions/${encodeURIComponent(fn.name)}/url/`, 'DELETE', null, 'Function URL deleted');
      }));
    }
    wrapper.append(controls);
    return wrapper;
  }

  function renderSelectedFunction(fn) {
    const panel = el('section', 'lambda-panel');
    const heading = el('div', 'lambda-panel-heading');
    heading.append(
      el('span', null, fn ? fn.name : 'Invoke'),
      el('span', 'lambda-function-meta', fn?.state || ''),
    );
    panel.append(heading);

    const content = el('div', 'lambda-function-detail');
    if (!fn) {
      content.append(el('div', 'lambda-empty', 'Create or select a function to invoke it.'));
      panel.append(content);
      return panel;
    }

    content.append(renderConfiguration(fn), renderVersionsAndAliases(fn), renderTriggers(fn), renderAccessAndRuntime(fn));
    if (fn.code?.Location) {
      const codeLink = document.createElement('a');
      codeLink.className = 'lambda-log-link';
      codeLink.href = fn.code.Location;
      codeLink.textContent = 'Download function package';
      codeLink.rel = 'noopener';
      content.append(codeLink);
    }
    const logLink = document.createElement('a');
    logLink.className = 'lambda-log-link';
    logLink.href = `/service/cloudwatch/?logGroup=${encodeURIComponent(logGroupName(fn))}`;
    logLink.textContent = `Open logs: ${logGroupName(fn)}`;
    content.append(logLink);
    content.append(el('h3', null, 'Test and invoke'));
    content.append(renderInvokeResult(fn));

    const urlResult = renderUrlTestResult();
    if (urlResult) content.append(urlResult);

    content.append(consoleUi.renderActivityPanel({
      service: 'lambda',
      classPrefix: 'lambda',
      title: 'Recent invokes',
      actions: ['invoke'],
      emptyText: 'Invoke a function to build a local replay history.',
      onReplay: replayInvoke,
      onClear: render,
    }));
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const fn = selectedFunction();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create function', null, showCreateFunctionModal),
        btn('Invoke function', null, () => fn && showInvokeModal(fn)),
        btn('Test Function URL', 'lambda-btn-secondary', () => fn && showFunctionUrlTestModal(fn)),
        btn('Delete function', 'lambda-btn-danger', async () => {
          if (fn && window.confirm(`Delete Lambda function ${fn.name}?`)) {
            state.selectedFunctionName = '';
            await mutate(`/api/lambda/functions/${encodeURIComponent(fn.name)}/`, 'DELETE', null, 'Function deleted');
          }
        }),
      ],
      [],
    ));

    [...container.querySelectorAll('button')].slice(1).forEach((button) => { button.disabled = !fn; });

    const workbench = el('div', 'lambda-workbench');
    workbench.append(renderFunctionList(), renderSelectedFunction(fn));
    container.append(workbench);
    return container;
  }

  function render() {
    if (!root) return;
    renderBreadcrumbs();
    root.textContent = '';
    root.append(renderWorkbench());
    if (loadedAtEl) {
      loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
    }
  }

  async function refresh() {
    const data = await apiJson('/api/lambda/');
    state.inventory = data;
    if (!selectedFunction() && functions().length) {
      state.selectedFunctionName = functions()[0].name;
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) return;
    root.append(el('div', 'lambda-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.LambdaConsole = LambdaConsole;

if (document.getElementById('lambda-console-root')) {
  LambdaConsole.init();
}
