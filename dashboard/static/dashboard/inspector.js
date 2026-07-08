const Inspector = (() => {
  const ui = window.ServiceConsole;
  const list = document.querySelector('#inspector-list');
  const detail = document.querySelector('#inspector-detail');
  const alerts = document.querySelector('#inspector-alerts');
  const refresh = document.querySelector('#inspector-refresh');
  const tabs = Array.from(document.querySelectorAll('[data-inspector-tab]'));

  const state = {
    tab: 'messages',
    queues: [],
    selectedQueueUrl: '',
    messages: [],
    emails: [],
    logGroups: [],
    selectedLogGroup: '',
    logEvents: [],
  };

  function showAlert(message, type = 'info') {
    if (!alerts) {
      return;
    }
    alerts.textContent = '';
    const node = ui.el('div', `environment-alert${type === 'info' ? ' environment-alert-info' : ''}`, message);
    alerts.append(node);
  }

  function clearAlert() {
    if (alerts) {
      alerts.textContent = '';
    }
  }

  function pretty(value) {
    return JSON.stringify(value || {}, null, 2);
  }

  function empty(title, body) {
    const panel = ui.el('div', 'inspector-empty');
    panel.append(ui.el('h3', null, title), ui.el('p', null, body));
    return panel;
  }

  function renderDetail(title = 'Select an item', payload = null) {
    detail.textContent = '';
    const heading = ui.el('div', 'inspector-panel-heading');
    heading.append(ui.el('h2', null, title));
    detail.append(heading);
    if (!payload) {
      detail.append(ui.el('p', 'inspector-muted', 'Choose a message, email, or log event to inspect the payload.'));
      return;
    }
    const pre = ui.el('pre', 'inspector-payload');
    pre.textContent = typeof payload === 'string' ? payload : pretty(payload);
    const copy = ui.button('Copy', 'secondary-button', async () => {
      await navigator.clipboard.writeText(pre.textContent);
      ui.toast('Payload copied', { classPrefix: 'inspector' });
    });
    detail.append(copy, pre);
  }

  function row(title, meta, onClick, active = false) {
    const button = ui.el('button', `inspector-row${active ? ' inspector-row-active' : ''}`);
    button.type = 'button';
    button.append(ui.el('strong', null, title), ui.el('span', null, meta || ''));
    button.addEventListener('click', onClick);
    return button;
  }

  function setTab(tab) {
    state.tab = tab;
    tabs.forEach((button) => {
      const active = button.dataset.inspectorTab === tab;
      button.classList.toggle('inspector-tab-active', active);
      button.setAttribute('aria-selected', String(active));
    });
  }

  async function loadMessages() {
    const data = await ui.apiJson('/api/inspector/sqs/queues/');
    state.queues = data.queues || [];
    if (!state.selectedQueueUrl && state.queues.length) {
      state.selectedQueueUrl = state.queues[0].url;
    }
    if (state.selectedQueueUrl) {
      const messages = await ui.apiJson(`/api/inspector/sqs/messages/?queue_url=${encodeURIComponent(state.selectedQueueUrl)}`);
      state.messages = messages.messages || [];
    } else {
      state.messages = [];
    }
  }

  function renderMessages() {
    list.textContent = '';
    const heading = ui.el('div', 'inspector-panel-heading');
    heading.append(ui.el('h2', null, 'SQS Messages'), ui.el('span', null, `${state.messages.length} visible`));
    list.append(heading);

    if (!state.queues.length) {
      list.append(empty('No queues found', 'Create an SQS queue or run a messaging lab, then refresh the Inspector.'));
      renderDetail();
      return;
    }

    const select = document.createElement('select');
    select.className = 'inspector-select';
    state.queues.forEach((queue) => {
      const option = document.createElement('option');
      option.value = queue.url;
      option.textContent = `${queue.name} (${queue.available} available)`;
      option.selected = queue.url === state.selectedQueueUrl;
      select.append(option);
    });
    select.addEventListener('change', async () => {
      state.selectedQueueUrl = select.value;
      await runCurrentTab();
    });
    list.append(select, ui.el('p', 'inspector-muted', 'Messages are received with a zero-second visibility timeout so they remain available to consumers.'));

    if (!state.messages.length) {
      list.append(empty('No visible messages', 'The selected queue has no immediately visible messages.'));
      renderDetail();
      return;
    }

    const rows = ui.el('div', 'inspector-row-list');
    state.messages.forEach((message) => {
      rows.append(row(
        message.MessageId || 'Message',
        `${String(message.Body || '').slice(0, 96)}${String(message.Body || '').length > 96 ? '...' : ''}`,
        () => renderDetail(message.MessageId || 'SQS message', message),
      ));
    });
    list.append(rows);
    renderDetail('SQS message', state.messages[0]);
  }

  async function loadEmail() {
    const data = await ui.apiJson('/api/inspector/ses/messages/');
    state.emails = data.messages || [];
  }

  function emailTitle(message, index) {
    return message.subject || message.Subject || message.headers?.subject || `Email ${index + 1}`;
  }

  function emailMeta(message) {
    const to = message.to || message.To || message.destination || message.Destination || '';
    const source = message.source || message.Source || message.from || '';
    return [source, Array.isArray(to) ? to.join(', ') : to].filter(Boolean).join(' -> ') || 'Captured local email';
  }

  function renderEmail() {
    list.textContent = '';
    const heading = ui.el('div', 'inspector-panel-heading');
    const clear = ui.button('Clear mailbox', 'secondary-button destructive-action', () => {
      if (!window.confirm('Clear the local SES mailbox? This cannot be undone.')) {
        return;
      }
      ui.apiJson('/api/inspector/ses/messages/clear/', { method: 'DELETE' })
        .then(() => runCurrentTab())
        .then(() => ui.toast('Mailbox cleared', { classPrefix: 'inspector' }))
        .catch((error) => showAlert(error.message, 'error'));
    });
    heading.append(ui.el('h2', null, 'SES Mailbox'), clear);
    list.append(heading);

    if (!state.emails.length) {
      list.append(empty('No captured email', 'Send an email through SES, then refresh the Inspector.'));
      renderDetail();
      return;
    }

    const rows = ui.el('div', 'inspector-row-list');
    state.emails.forEach((message, index) => {
      rows.append(row(emailTitle(message, index), emailMeta(message), () => renderDetail(emailTitle(message, index), message)));
    });
    list.append(rows);
    renderDetail(emailTitle(state.emails[0], 0), state.emails[0]);
  }

  function renderNotifications() {
    list.textContent = '';
    const heading = ui.el('div', 'inspector-panel-heading');
    heading.append(ui.el('h2', null, 'SNS Deliveries'));
    list.append(heading, empty(
      'No SNS delivery buffer exposed yet',
      'Use the SNS and SQS workbenches to inspect fan-out. When Floci exposes a local SNS inspection endpoint, this tab can show topic deliveries here.',
    ));
    renderDetail('SNS delivery inspection', {
      status: 'not_exposed',
      next_steps: ['Open SNS workbench', 'Open SQS queues subscribed to SNS topics'],
    });
  }

  async function loadLogs() {
    const groups = await ui.apiJson('/api/inspector/lambda/log-groups/');
    state.logGroups = groups.log_groups || [];
    if (!state.selectedLogGroup && state.logGroups.length) {
      state.selectedLogGroup = state.logGroups[0].logGroupName;
    }
    if (state.selectedLogGroup) {
      const events = await ui.apiJson(`/api/inspector/lambda/log-events/?log_group_name=${encodeURIComponent(state.selectedLogGroup)}`);
      state.logEvents = events.events || [];
    } else {
      state.logEvents = [];
    }
  }

  function renderLogs() {
    list.textContent = '';
    const heading = ui.el('div', 'inspector-panel-heading');
    heading.append(ui.el('h2', null, 'Lambda Logs'), ui.el('a', 'secondary-action', 'Open CloudWatch'));
    heading.querySelector('a').href = '/service/cloudwatch/';
    list.append(heading);

    if (!state.logGroups.length) {
      list.append(empty('No Lambda log groups', 'Invoke a Lambda function, then refresh the Inspector.'));
      renderDetail();
      return;
    }

    const select = document.createElement('select');
    select.className = 'inspector-select';
    state.logGroups.forEach((group) => {
      const option = document.createElement('option');
      option.value = group.logGroupName;
      option.textContent = group.logGroupName;
      option.selected = group.logGroupName === state.selectedLogGroup;
      select.append(option);
    });
    select.addEventListener('change', async () => {
      state.selectedLogGroup = select.value;
      await runCurrentTab();
    });
    list.append(select);

    if (!state.logEvents.length) {
      list.append(empty('No recent events', 'The selected Lambda log group has streams but no recent events.'));
      renderDetail();
      return;
    }

    const rows = ui.el('div', 'inspector-row-list');
    state.logEvents.forEach((event) => {
      rows.append(row(
        ui.formatDate(event.timestamp),
        String(event.message || '').slice(0, 120),
        () => renderDetail('Log event', event),
      ));
    });
    list.append(rows);
    renderDetail('Log event', state.logEvents[0]);
  }

  async function runCurrentTab() {
    clearAlert();
    list.textContent = '';
    list.append(ui.el('p', 'inspector-muted', 'Loading...'));
    try {
      if (state.tab === 'messages') {
        await loadMessages();
        renderMessages();
      } else if (state.tab === 'email') {
        await loadEmail();
        renderEmail();
      } else if (state.tab === 'notifications') {
        renderNotifications();
      } else if (state.tab === 'logs') {
        await loadLogs();
        renderLogs();
      }
    } catch (error) {
      showAlert(error.message, 'error');
      list.textContent = '';
      list.append(empty('Inspector data unavailable', error.message));
      renderDetail();
    }
  }

  function init() {
    if (!list || !detail || !ui) {
      return;
    }
    tabs.forEach((button) => {
      button.addEventListener('click', () => {
        setTab(button.dataset.inspectorTab);
        runCurrentTab();
      });
    });
    refresh?.addEventListener('click', runCurrentTab);
    setTab(state.tab);
    renderDetail();
    runCurrentTab();
  }

  return { init, runCurrentTab };
})();

Inspector.init();
