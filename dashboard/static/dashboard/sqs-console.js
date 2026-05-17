/* global ServiceConsole */

const SQSConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('sqs-console-root');
  const breadcrumbsEl = document.getElementById('sqs-breadcrumbs');
  const summaryEl = document.getElementById('sqs-summary');
  const loadedAtEl = document.getElementById('sqs-loaded-at');

  const state = {
    inventory: null,
    selectedQueue: '',
    messages: [],
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'sqs',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'sqs');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'sqs',
      toast,
    });

  function queueNameFromUrl(queueUrl) {
    return String(queueUrl || '').replace(/\/$/, '').split('/').pop();
  }

  function queues() {
    return state.inventory?.queues || [];
  }

  function selectedQueue() {
    return queues().find((queue) => queue.name === state.selectedQueue) || queues()[0] || null;
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'Amazon SQS');
    home.addEventListener('click', () => {
      state.selectedQueue = '';
      state.messages = [];
      render();
    });
    breadcrumbsEl.append(home);
    const queue = selectedQueue();
    if (queue) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, queue.name));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'sqs',
      targets: {
        queues: 'Queues',
        fifo_queues: 'Queues',
        visible_messages: 'Queues',
        in_flight_messages: 'Queues',
        delayed_messages: 'Queues',
      },
    });
  }

  function showCreateQueueModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.required = true;
    nameInput.placeholder = 'orders or orders.fifo';
    const fifoLabel = el('label');
    const fifoInput = document.createElement('input');
    fifoInput.type = 'checkbox';
    fifoLabel.append(fifoInput, document.createTextNode(' FIFO queue'));
    const visibilityInput = document.createElement('input');
    visibilityInput.type = 'number';
    visibilityInput.min = '0';
    visibilityInput.placeholder = '30';
    form.append(
      el('label', null, 'Queue name'),
      nameInput,
      fifoLabel,
      el('label', null, 'Visibility timeout seconds'),
      visibilityInput,
    );
    openModal('Create queue', form, 'Create', async (close) => {
      const payload = {
        name: nameInput.value.trim(),
        fifo: fifoInput.checked,
      };
      if (visibilityInput.value) {
        payload.visibility_timeout = Number(visibilityInput.value);
      }
      await apiJson('/api/sqs/queues/', { method: 'POST', body: JSON.stringify(payload) });
      close();
      toast('Queue created');
      await refresh();
    });
  }

  function showSendMessageModal(queue) {
    const form = el('div');
    const bodyInput = document.createElement('textarea');
    bodyInput.required = true;
    bodyInput.placeholder = '{"event":"created"}';
    const delayInput = document.createElement('input');
    delayInput.type = 'number';
    delayInput.min = '0';
    delayInput.max = '900';
    delayInput.placeholder = '0';
    const groupInput = document.createElement('input');
    groupInput.placeholder = 'default';
    const dedupeInput = document.createElement('input');
    dedupeInput.placeholder = 'optional';
    form.append(el('label', null, 'Message body'), bodyInput, el('label', null, 'Delay seconds'), delayInput);
    if (queue.fifo) {
      form.append(
        el('label', null, 'Message group ID'),
        groupInput,
        el('label', null, 'Deduplication ID'),
        dedupeInput,
      );
    }
    openModal('Send message', form, 'Send', async (close) => {
      const payload = { body: bodyInput.value };
      if (delayInput.value) {
        payload.delay_seconds = Number(delayInput.value);
      }
      if (queue.fifo) {
        payload.message_group_id = groupInput.value.trim();
        payload.message_deduplication_id = dedupeInput.value.trim();
      }
      await apiJson(`/api/sqs/queues/${encodeURIComponent(queue.name)}/messages/send/`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      close();
      toast('Message sent');
      await refresh();
    });
  }

  function showReceiveMessagesModal(queue) {
    const form = el('div');
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.min = '1';
    maxInput.max = '10';
    maxInput.value = '5';
    const visibilityInput = document.createElement('input');
    visibilityInput.type = 'number';
    visibilityInput.min = '0';
    visibilityInput.placeholder = '30';
    const waitInput = document.createElement('input');
    waitInput.type = 'number';
    waitInput.min = '0';
    waitInput.max = '20';
    waitInput.value = '0';
    form.append(
      el('label', null, 'Max messages'),
      maxInput,
      el('label', null, 'Visibility timeout seconds'),
      visibilityInput,
      el('label', null, 'Wait time seconds'),
      waitInput,
    );
    openModal('Poll messages', form, 'Poll', async (close) => {
      const payload = {
        max_number: Number(maxInput.value || 5),
        wait_time_seconds: Number(waitInput.value || 0),
      };
      if (visibilityInput.value) {
        payload.visibility_timeout = Number(visibilityInput.value);
      }
      const data = await apiJson(`/api/sqs/queues/${encodeURIComponent(queue.name)}/messages/`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      state.messages = data.messages || [];
      close();
      toast(state.messages.length ? `Received ${state.messages.length} message(s)` : 'No messages available');
      render();
    });
  }

  function confirmQueueAction(title, message, confirmLabel, action) {
    const body = el('p', null, message);
    openModal(title, body, confirmLabel, action);
  }

  async function deleteReceivedMessage(queue, message) {
    await apiJson(`/api/sqs/queues/${encodeURIComponent(queue.name)}/messages/delete/`, {
      method: 'DELETE',
      body: JSON.stringify({ receipt_handle: message.ReceiptHandle }),
    });
    state.messages = state.messages.filter((item) => item.ReceiptHandle !== message.ReceiptHandle);
    toast('Message deleted');
    render();
  }

  function renderQueueRow(queue) {
    const row = el('button', `sqs-queue-row${queue.name === selectedQueue()?.name ? ' sqs-queue-row-active' : ''}`);
    const meta = [
      `${queue.approximate_messages || 0} visible`,
      `${queue.approximate_not_visible || 0} in flight`,
      `${queue.approximate_delayed || 0} delayed`,
    ];
    row.append(
      el('span', 'sqs-queue-name', queue.name || queueNameFromUrl(queue.url)),
      el('span', 'sqs-queue-meta', meta.join(' / ')),
    );
    if (queue.fifo) {
      row.append(el('span', 'sqs-badge', 'FIFO'));
    }
    row.addEventListener('click', () => {
      state.selectedQueue = queue.name;
      state.messages = [];
      render();
    });
    return row;
  }

  function renderQueueList() {
    const panel = el('section', 'sqs-panel');
    panel.append(el('div', 'sqs-panel-heading', 'Queues'));
    const list = el('div', 'sqs-queue-list');
    if (!queues().length) {
      list.append(el('div', 'sqs-empty', 'No queues found.'));
    } else {
      queues().forEach((queue) => list.append(renderQueueRow(queue)));
    }
    panel.append(list);
    return panel;
  }

  function renderMessage(queue, message, index) {
    const card = el('article', 'sqs-message');
    const title = el('h4', null, message.MessageId || `Message ${index + 1}`);
    const body = el('pre', null, message.Body || '');
    const details = document.createElement('dl');
    consoleUi.addField(details, 'Receipt handle', message.ReceiptHandle);
    consoleUi.addField(details, 'MD5', message.MD5OfBody);
    consoleUi.addField(details, 'Attributes', message.Attributes || {});
    consoleUi.addField(details, 'Message attributes', message.MessageAttributes || {});
    const actions = el('div');
    actions.append(btn('Delete message', 'sqs-btn-danger', () => {
      confirmQueueAction('Delete message', 'Delete this received message?', 'Delete', async (close) => {
        await deleteReceivedMessage(queue, message);
        close();
      });
    }));
    card.append(title, body, details, actions);
    return card;
  }

  function renderSelectedQueue(queue) {
    const panel = el('section', 'sqs-panel');
    const heading = el('div', 'sqs-panel-heading');
    const title = el('span', null, queue ? queue.name : 'Messages');
    const count = el('span', 'sqs-queue-meta', `${state.messages.length} received`);
    heading.append(title, count);
    panel.append(heading);
    const list = el('div', 'sqs-message-list');
    if (!queue) {
      list.append(el('div', 'sqs-empty', 'Create or select a queue to inspect messages.'));
    } else if (!state.messages.length) {
      list.append(el('div', 'sqs-empty', 'No received messages. Poll the queue to inspect available messages.'));
    } else {
      state.messages.forEach((message, index) => list.append(renderMessage(queue, message, index)));
    }
    panel.append(list);
    return panel;
  }

  function renderWorkbench() {
    const queue = selectedQueue();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create queue', null, showCreateQueueModal),
        btn('Send message', 'sqs-btn-secondary', () => queue && showSendMessageModal(queue)),
        btn('Poll messages', 'sqs-btn-secondary', () => queue && showReceiveMessagesModal(queue)),
      ],
      [
        btn('Purge queue', 'sqs-btn-danger', () => queue && confirmQueueAction(
          'Purge queue',
          `Delete all available messages from ${queue.name}?`,
          'Purge',
          async (close) => {
            await apiJson(`/api/sqs/queues/${encodeURIComponent(queue.name)}/purge/`, { method: 'POST' });
            state.messages = [];
            close();
            toast('Queue purged');
            await refresh();
          },
        )),
        btn('Delete queue', 'sqs-btn-danger', () => queue && confirmQueueAction(
          'Delete queue',
          `Delete ${queue.name}?`,
          'Delete',
          async (close) => {
            await apiJson(`/api/sqs/queues/${encodeURIComponent(queue.name)}/`, { method: 'DELETE' });
            state.selectedQueue = '';
            state.messages = [];
            close();
            toast('Queue deleted');
            await refresh();
          },
        )),
      ],
    ));

    const actionButtons = container.querySelectorAll('.sqs-btn-secondary, .sqs-btn-danger');
    actionButtons.forEach((button) => {
      button.disabled = !queue;
    });

    const workbench = el('div', 'sqs-workbench');
    workbench.append(renderQueueList(), renderSelectedQueue(queue));
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
    const data = await apiJson('/api/sqs/');
    state.inventory = data;
    if (!selectedQueue() && queues().length) {
      state.selectedQueue = queues()[0].name;
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'sqs-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.SQSConsole = SQSConsole;

if (document.getElementById('sqs-console-root')) {
  SQSConsole.init();
}
