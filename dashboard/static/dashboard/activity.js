/* global ServiceConsole */

const ActivityPage = (() => {
  const consoleUi = window.ServiceConsole;
  const list = document.querySelector('#activity-list');
  const filterInput = document.querySelector('#activity-filter');
  const clearButton = document.querySelector('#activity-clear');
  const count = document.querySelector('#activity-count');

  const serviceLabels = {
    apigateway: 'API Gateway',
    eventbridge: 'EventBridge',
    lambda: 'Lambda',
    sqs: 'SQS',
  };

  const servicePaths = {
    apigateway: '/service/apigateway/',
    eventbridge: '/service/eventbridge/',
    lambda: '/service/lambda/',
    sqs: '/service/sqs/',
  };

  function text(value) {
    return String(value ?? '').trim();
  }

  function serviceLabel(service) {
    return serviceLabels[service] || text(service).toUpperCase() || 'Service';
  }

  function actionLabel(action) {
    return text(action).replaceAll('_', ' ') || 'activity';
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
  }

  function entrySearchText(entry) {
    return [
      entry.service,
      serviceLabel(entry.service),
      entry.action,
      actionLabel(entry.action),
      entry.title,
      entry.summary,
      entry.detail,
      JSON.stringify(entry.payload || {}),
    ].join(' ').toLowerCase();
  }

  function filteredEntries() {
    const query = text(filterInput?.value).toLowerCase();
    const entries = consoleUi.loadActivity();
    if (!query) {
      return entries;
    }
    return entries.filter((entry) => entrySearchText(entry).includes(query));
  }

  function renderEmpty(message) {
    const empty = consoleUi.el('div', 'activity-empty', message);
    list.append(empty);
  }

  function renderPayload(entry) {
    const payload = entry.payload || {};
    const pre = consoleUi.el('pre', 'activity-payload', JSON.stringify(consoleUi.displayValue(payload), null, 2));
    return pre;
  }

  function renderEntry(entry) {
    const item = consoleUi.el('article', 'activity-item');
    const header = consoleUi.el('div', 'activity-item-header');
    const title = consoleUi.el('div', 'activity-item-title');
    title.append(
      consoleUi.el('strong', null, entry.title || actionLabel(entry.action)),
      consoleUi.el('span', 'activity-item-meta', [
        serviceLabel(entry.service),
        actionLabel(entry.action),
        formatDate(entry.timestamp),
      ].filter(Boolean).join(' / ')),
    );
    const actions = consoleUi.el('div', 'activity-item-actions');
    const servicePath = servicePaths[entry.service] || `/service/${entry.service}/`;
    const open = document.createElement('a');
    open.className = 'secondary-action activity-open-link';
    open.href = servicePath;
    open.textContent = entry.replayable === false ? 'Open service' : 'Open to replay';
    actions.append(open);
    header.append(title, actions);

    const summary = consoleUi.el('p', 'activity-summary', [entry.summary, entry.detail].filter(Boolean).join(' / '));
    item.append(header);
    if (summary.textContent) {
      item.append(summary);
    }
    item.append(renderPayload(entry));
    return item;
  }

  function render() {
    if (!list) {
      return;
    }
    const entries = filteredEntries();
    const total = consoleUi.loadActivity().length;
    list.textContent = '';
    if (count) {
      count.textContent = `${entries.length} / ${total}`;
    }
    if (!total) {
      renderEmpty('No recent activity yet. Send API Gateway requests, EventBridge events, Lambda invokes, or SQS messages to build a replay history.');
      return;
    }
    if (!entries.length) {
      renderEmpty('No activity matches this filter.');
      return;
    }
    entries.forEach((entry) => list.append(renderEntry(entry)));
  }

  function clearAll() {
    consoleUi.clearActivity();
    render();
  }

  function init() {
    render();
    filterInput?.addEventListener('input', render);
    clearButton?.addEventListener('click', clearAll);
  }

  return { init, render };
})();

window.ActivityPage = ActivityPage;

ActivityPage.init();
