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

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
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
    if (!trimmed) {
      return {};
    }
    return JSON.parse(trimmed);
  }

  function invokePath(functionName) {
    return `/api/lambda/functions/${encodeURIComponent(functionName)}/invoke/`;
  }

  function showInvokeModal(fn) {
    const form = el('div');
    const payloadInput = document.createElement('textarea');
    payloadInput.required = true;
    payloadInput.value = '{\n  "source": "floci-dashboard"\n}';
    const qualifierInput = document.createElement('input');
    qualifierInput.placeholder = 'optional version or alias';

    form.append(
      el('label', null, 'Function'),
      el('pre', 'lambda-function-preview', fn.name),
      el('label', null, 'JSON payload'),
      payloadInput,
      el('label', null, 'Qualifier'),
      qualifierInput,
    );

    openModal('Invoke function', form, 'Invoke', async (close) => {
      const data = await apiJson(invokePath(fn.name), {
        method: 'POST',
        body: JSON.stringify({
          payload: parsePayload(payloadInput.value),
          qualifier: qualifierInput.value.trim() || null,
        }),
      });
      state.lastInvoke = data;
      close();
      toast(data.function_error ? `Function error: ${data.function_error}` : 'Function invoked');
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

    const details = document.createElement('dl');
    consoleUi.addField(details, 'ARN', fn.arn);
    consoleUi.addField(details, 'Runtime', fn.runtime);
    consoleUi.addField(details, 'Handler', fn.handler);
    consoleUi.addField(details, 'Package type', fn.package_type);
    consoleUi.addField(details, 'Memory', fn.memory_size);
    consoleUi.addField(details, 'Timeout', fn.timeout);
    consoleUi.addField(details, 'Role', fn.role);
    consoleUi.addField(details, 'Log group', logGroupName(fn));
    consoleUi.addField(details, 'Event source mappings', fn.event_source_mappings || []);
    content.append(details);
    content.append(renderInvokeResult(fn));
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const fn = selectedFunction();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Invoke function', null, () => fn && showInvokeModal(fn)),
      ],
      [],
    ));

    const invokeButton = container.querySelector('button');
    if (invokeButton) {
      invokeButton.disabled = !fn;
    }

    const workbench = el('div', 'lambda-workbench');
    workbench.append(renderFunctionList(), renderSelectedFunction(fn));
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
    const data = await apiJson('/api/lambda/');
    state.inventory = data;
    if (!selectedFunction() && functions().length) {
      state.selectedFunctionName = functions()[0].name;
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'lambda-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.LambdaConsole = LambdaConsole;

if (document.getElementById('lambda-console-root')) {
  LambdaConsole.init();
}
