/* global ServiceConsole */

const ApiGatewayConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('apigateway-console-root');
  const breadcrumbsEl = document.getElementById('apigateway-breadcrumbs');
  const summaryEl = document.getElementById('apigateway-summary');
  const loadedAtEl = document.getElementById('apigateway-loaded-at');

  const state = {
    inventory: null,
    selectedKey: '',
    lastResponse: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'apigateway',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'apigateway');

  function restApis() {
    return state.inventory?.rest_apis || [];
  }

  function httpApis() {
    return state.inventory?.http_apis || [];
  }

  function allApis() {
    return [
      ...restApis().map((api) => ({ type: 'rest', key: `rest:${api.id}`, api })),
      ...httpApis().map((api) => ({ type: 'http', key: `http:${api.id}`, api })),
    ];
  }

  function selectedApi() {
    const apis = allApis();
    return apis.find((item) => item.key === state.selectedKey) || apis[0] || null;
  }

  function apiName(item) {
    return item?.api?.name || item?.api?.id || 'Unnamed API';
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'Amazon API Gateway');
    home.addEventListener('click', () => {
      state.selectedKey = allApis()[0]?.key || '';
      render();
    });
    breadcrumbsEl.append(home);
    const item = selectedApi();
    if (item) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, `${item.type.toUpperCase()} ${apiName(item)}`));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'apigateway',
      targets: {
        rest_apis: 'REST APIs (v1)',
        http_apis: 'HTTP APIs (v2)',
        routes_and_resources: 'REST APIs (v1)',
        methods: 'REST APIs (v1)',
        integrations: 'REST APIs (v1)',
        stages: 'REST APIs (v1)',
        api_keys: 'API keys',
        usage_plans: 'Usage plans',
      },
    });
  }

  function parseJsonObject(value, label) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return {};
    }
    const parsed = JSON.parse(trimmed);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error(`${label} must be a JSON object`);
    }
    return parsed;
  }

  function firstStage(api) {
    return (api.stages || [])[0]?.stageName || (api.stages || [])[0]?.name || '';
  }

  function firstPath(item) {
    if (!item) {
      return '/';
    }
    if (item.type === 'rest') {
      return (item.api.resources || []).find((resource) => resource.path)?.path || '/';
    }
    const route = (item.api.routes || []).find((candidate) => candidate.RouteKey || candidate.routeKey);
    const routeKey = route?.RouteKey || route?.routeKey || '';
    const parts = routeKey.split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : '/';
  }

  function routeMethods(item) {
    if (!item) {
      return ['GET'];
    }
    if (item.type === 'rest') {
      const methods = new Set();
      (item.api.resources || []).forEach((resource) => {
        Object.keys(resource.resourceMethods || {}).forEach((method) => methods.add(method));
      });
      return methods.size ? Array.from(methods).sort() : ['GET', 'POST'];
    }
    const methods = new Set();
    (item.api.routes || []).forEach((route) => {
      const key = route.RouteKey || route.routeKey || '';
      const method = key.split(/\s+/)[0];
      if (method && method !== '$default') {
        methods.add(method);
      }
    });
    return methods.size ? Array.from(methods).sort() : ['GET', 'POST'];
  }

  function renderApiRow(item) {
    const active = item.key === selectedApi()?.key;
    const api = item.api;
    const row = el('button', `apigateway-api-row${active ? ' apigateway-api-row-active' : ''}`);
    const counts = item.type === 'rest'
      ? `${api.resource_count || 0} resource${api.resource_count === 1 ? '' : 's'} / ${api.method_count || 0} method${api.method_count === 1 ? '' : 's'}`
      : `${api.route_count || 0} route${api.route_count === 1 ? '' : 's'} / ${api.integration_count || 0} integration${api.integration_count === 1 ? '' : 's'}`;
    row.append(
      el('span', 'apigateway-api-name', apiName(item)),
      el('span', 'apigateway-api-meta', `${item.type.toUpperCase()} / ${counts}`),
    );
    row.addEventListener('click', () => {
      state.selectedKey = item.key;
      render();
    });
    return row;
  }

  function renderApiList() {
    const panel = el('section', 'apigateway-panel');
    panel.append(el('div', 'apigateway-panel-heading', 'APIs'));
    const list = el('div', 'apigateway-api-list');
    const apis = allApis();
    if (!apis.length) {
      list.append(el('div', 'apigateway-empty', 'No REST or HTTP APIs found.'));
    } else {
      apis.forEach((api) => list.append(renderApiRow(api)));
    }
    panel.append(list);
    return panel;
  }

  function renderStageSelect(item) {
    const select = document.createElement('select');
    const stages = item?.api?.stages || [];
    if (!stages.length) {
      select.append(new Option(item?.type === 'rest' ? 'No stages found' : '$default', item?.type === 'rest' ? '' : '$default'));
    } else {
      stages.forEach((stage) => {
        const name = stage.stageName || stage.name || '$default';
        select.append(new Option(name, name));
      });
    }
    select.disabled = item?.type !== 'rest';
    return select;
  }

  function renderMethodSelect(item) {
    const select = document.createElement('select');
    routeMethods(item).forEach((method) => select.append(new Option(method, method)));
    return select;
  }

  function renderResponse() {
    if (!state.lastResponse) {
      return el('div', 'apigateway-empty apigateway-empty-compact', 'Send a request to see the response.');
    }
    const response = state.lastResponse;
    const card = el('article', 'apigateway-response');
    const heading = el('div', 'apigateway-response-heading');
    heading.append(
      el('h4', null, `${response.status_code} ${response.method}`),
      el('span', 'apigateway-api-meta', response.url),
    );
    const details = document.createElement('dl');
    consoleUi.addField(details, 'Status', response.status_code);
    consoleUi.addField(details, 'Headers', response.headers || {});
    consoleUi.addField(details, 'JSON', response.json);
    consoleUi.addField(details, 'Body', response.body);
    card.append(heading, details);
    return card;
  }

  function renderRequestPanel(item) {
    const panel = el('section', 'apigateway-panel');
    const heading = el('div', 'apigateway-panel-heading');
    heading.append(
      el('span', null, item ? apiName(item) : 'Request tester'),
      el('span', 'apigateway-api-meta', item ? item.type.toUpperCase() : 'No API selected'),
    );
    panel.append(heading);

    const body = el('div', 'apigateway-request');
    if (!item) {
      body.append(el('div', 'apigateway-empty', 'Create an API with your app or CLI, then refresh to test local requests here.'));
      panel.append(body);
      return panel;
    }

    const methodInput = renderMethodSelect(item);
    const stageInput = renderStageSelect(item);
    const pathInput = document.createElement('input');
    pathInput.value = firstPath(item);
    pathInput.placeholder = '/orders';
    const queryInput = document.createElement('textarea');
    queryInput.className = 'apigateway-small-textarea';
    queryInput.placeholder = '{"debug":"true"}';
    const headersInput = document.createElement('textarea');
    headersInput.className = 'apigateway-small-textarea';
    headersInput.placeholder = '{"Content-Type":"application/json"}';
    const bodyInput = document.createElement('textarea');
    bodyInput.className = 'apigateway-body-input';
    bodyInput.placeholder = '{"hello":"world"}';

    const form = el('div', 'apigateway-form-grid');
    form.append(
      el('label', null, 'Method'),
      methodInput,
      el('label', null, item.type === 'rest' ? 'Stage' : 'Stage'),
      stageInput,
      el('label', null, 'Path'),
      pathInput,
      el('label', null, 'Query JSON'),
      queryInput,
      el('label', null, 'Headers JSON'),
      headersInput,
      el('label', null, 'Body'),
      bodyInput,
    );

    const send = btn('Send request', null, async () => {
      send.disabled = true;
      try {
        const payload = {
          api_type: item.type,
          api_id: item.api.id,
          endpoint: item.api.api_endpoint || '',
          method: methodInput.value,
          stage: stageInput.value,
          path: pathInput.value,
          query: parseJsonObject(queryInput.value, 'Query'),
          headers: parseJsonObject(headersInput.value, 'Headers'),
          body: bodyInput.value,
        };
        state.lastResponse = await apiJson('/api/apigateway/requests/test/', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast(`Request returned ${state.lastResponse.status_code}`);
        render();
      } catch (error) {
        toast(error.message, true);
      } finally {
        send.disabled = false;
      }
    });

    body.append(form, send, renderResponse());
    panel.append(body);
    return panel;
  }

  function renderWorkbench() {
    const item = selectedApi();
    const container = el('div');
    container.append(toolbar([
      btn('Refresh APIs', 'apigateway-btn-secondary', refresh),
    ], []));
    const workbench = el('div', 'apigateway-workbench');
    workbench.append(renderApiList(), renderRequestPanel(item));
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
    const data = await apiJson('/api/apigateway/');
    state.inventory = data;
    if (!selectedApi() && allApis().length) {
      state.selectedKey = allApis()[0].key;
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'apigateway-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.ApiGatewayConsole = ApiGatewayConsole;

if (document.getElementById('apigateway-console-root')) {
  ApiGatewayConsole.init();
}
