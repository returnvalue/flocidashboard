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
    redriveTasks: [],
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

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (!value) return '';
    if (value >= 1024 * 1024) return `${value / (1024 * 1024)} MB`;
    if (value >= 1024) return `${value / 1024} KB`;
    return `${value} bytes`;
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) return;
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

  function queueActivitySummary(queue) {
    return queue?.name || queueNameFromUrl(queue?.url) || 'Queue';
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

  async function sendMessage(queue, payload) {
    const data = await apiJson(`/api/sqs/queues/${encodeURIComponent(queue.name)}/messages/send/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    consoleUi.recordActivity({
      service: 'sqs',
      action: 'send_message',
      title: `Send to ${queue.name}`,
      summary: queueActivitySummary(queue),
      detail: payload.delay_seconds ? `Delay ${payload.delay_seconds}s` : 'Immediate',
      replayLabel: 'Prefill',
      payload: {
        queue_name: queue.name,
        fifo: !!queue.fifo,
        ...payload,
      },
    });
    return data;
  }

  function showSendMessageModal(queue, replay = null) {
    const form = el('div');
    const bodyInput = document.createElement('textarea');
    bodyInput.required = true;
    bodyInput.placeholder = '{"event":"created"}';
    bodyInput.value = replay?.body || '';
    const delayInput = document.createElement('input');
    delayInput.type = 'number';
    delayInput.min = '0';
    delayInput.max = '900';
    delayInput.placeholder = '0';
    delayInput.value = replay?.delay_seconds ?? '';
    const groupInput = document.createElement('input');
    groupInput.placeholder = 'default';
    groupInput.value = replay?.message_group_id || '';
    const dedupeInput = document.createElement('input');
    dedupeInput.placeholder = 'optional';
    dedupeInput.value = replay?.message_deduplication_id || '';

    const attrsInput = document.createElement('textarea');
    attrsInput.placeholder = '{"CorrelationId": "req-1234", "TraceId": {"DataType": "String", "StringValue": "trace-5678"}}';
    if (replay?.message_attributes) {
      attrsInput.value = typeof replay.message_attributes === 'string' ? replay.message_attributes : JSON.stringify(replay.message_attributes, null, 2);
    }

    form.append(
      el('label', null, 'Message body'),
      bodyInput,
      el('label', null, 'Delay seconds'),
      delayInput,
      el('label', null, 'Message attributes (JSON object, Optional)'),
      attrsInput,
    );
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
      if (attrsInput.value.trim()) {
        try {
          payload.message_attributes = JSON.parse(attrsInput.value.trim());
        } catch (e) {
          throw new Error('Message attributes must be valid JSON: ' + e.message);
        }
      }
      await sendMessage(queue, payload);
      close();
      toast('Message sent');
      await refresh();
    });
  }

  async function receiveMessages(queue, payload) {
    const data = await apiJson(`/api/sqs/queues/${encodeURIComponent(queue.name)}/messages/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.messages = data.messages || [];
    consoleUi.recordActivity({
      service: 'sqs',
      action: 'receive_messages',
      title: `Poll ${queue.name}`,
      summary: queueActivitySummary(queue),
      detail: `${state.messages.length} received`,
      replayLabel: 'Prefill',
      payload: {
        queue_name: queue.name,
        ...payload,
      },
    });
    return data;
  }

  function showReceiveMessagesModal(queue, replay = null) {
    const form = el('div');
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.min = '1';
    maxInput.max = '10';
    maxInput.value = replay?.max_number || '5';
    const visibilityInput = document.createElement('input');
    visibilityInput.type = 'number';
    visibilityInput.min = '0';
    visibilityInput.placeholder = '30';
    visibilityInput.value = replay?.visibility_timeout ?? '';
    const waitInput = document.createElement('input');
    waitInput.type = 'number';
    waitInput.min = '0';
    waitInput.max = '20';
    waitInput.value = replay?.wait_time_seconds ?? '0';
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
      await receiveMessages(queue, payload);
      close();
      toast(state.messages.length ? `Received ${state.messages.length} message(s)` : 'No messages available');
      render();
    });
  }

  function showRedriveModal(queue) {
    const form = el('div');
    const queueArn = queue.arn || queue.attributes?.QueueArn || `arn:aws:sqs:us-east-1:000000000000:${queue.name}`;

    const destSelect = document.createElement('select');
    const defOpt = el('option', null, 'Default (Redrive to Original Source Queues)');
    defOpt.value = '';
    destSelect.append(defOpt);
    queues().filter((q) => q.name !== queue.name).forEach((q) => {
      const opt = el('option', null, `Queue: ${q.name}`);
      opt.value = q.arn || `arn:aws:sqs:us-east-1:000000000000:${q.name}`;
      destSelect.append(opt);
    });

    const rateInput = document.createElement('input');
    rateInput.type = 'number';
    rateInput.min = '1';
    rateInput.placeholder = 'e.g. 50 (unlimited if empty)';

    form.append(
      el('p', null, `Start Dead-Letter Queue (DLQ) message redrive task for ${queue.name}.`),
      el('label', null, 'Destination Queue ARN (Optional)'),
      destSelect,
      el('label', null, 'Max Messages Per Second Rate (Optional)'),
      rateInput,
    );

    openModal('Start DLQ Redrive', form, 'Start Redrive', async (close) => {
      const payload = { source_arn: queueArn };
      if (destSelect.value) payload.destination_arn = destSelect.value;
      if (rateInput.value) payload.max_number_of_messages_per_second = Number(rateInput.value);

      const res = await apiJson(`/api/sqs/queues/${encodeURIComponent(queue.name)}/redrive/`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast(`DLQ redrive task started (Task ID: ${res.task_handle || 'active'})`);
      close();
      await refresh();
    });
  }

  function showAttributesModal(queue) {
    const form = el('div');
    const attrs = queue.attributes || {};

    const visInput = document.createElement('input');
    visInput.value = attrs.VisibilityTimeout || '30';

    const delayInput = document.createElement('input');
    delayInput.value = attrs.DelaySeconds || '0';

    const waitInput = document.createElement('input');
    waitInput.value = attrs.ReceiveMessageWaitTimeSeconds || '0';

    const redrivePolicyInput = document.createElement('textarea');
    redrivePolicyInput.placeholder = '{"deadLetterTargetArn": "arn:aws:sqs:...", "maxReceiveCount": 5}';
    redrivePolicyInput.value = attrs.RedrivePolicy || '';

    form.append(
      el('label', null, 'Visibility Timeout (Seconds)'),
      visInput,
      el('label', null, 'Delivery Delay (Seconds)'),
      delayInput,
      el('label', null, 'Receive Message Wait Time (Seconds)'),
      waitInput,
      el('label', null, 'Redrive Policy / DLQ Configuration (JSON string)'),
      redrivePolicyInput,
    );

    openModal('Configure Queue Attributes', form, 'Save Changes', async (close) => {
      const newAttrs = {
        VisibilityTimeout: visInput.value.trim(),
        DelaySeconds: delayInput.value.trim(),
        ReceiveMessageWaitTimeSeconds: waitInput.value.trim(),
      };
      if (redrivePolicyInput.value.trim()) {
        newAttrs.RedrivePolicy = redrivePolicyInput.value.trim();
      }
      await apiJson(`/api/sqs/queues/${encodeURIComponent(queue.name)}/attributes/`, {
        method: 'POST',
        body: JSON.stringify({ attributes: newAttrs }),
      });
      toast('Queue attributes updated');
      close();
      await refresh();
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
    } else {
      const facts = document.createElement('dl');
      const maxSize = queue.attributes?.MaximumMessageSize || state.inventory?.configuration?.max_message_size_bytes;
      consoleUi.addField(facts, 'Queue ARN', queue.arn || queue.attributes?.QueueArn);
      consoleUi.addField(facts, 'Visible messages', queue.approximate_messages);
      consoleUi.addField(facts, 'In-flight messages', queue.approximate_not_visible);
      consoleUi.addField(facts, 'Delayed messages', queue.approximate_delayed);
      consoleUi.addField(facts, 'Maximum message size', formatBytes(maxSize));
      if (queue.attributes?.RedrivePolicy) {
        consoleUi.addField(facts, 'Redrive Policy (DLQ)', queue.attributes.RedrivePolicy);
      }
      list.append(facts);

      const queueActionRow = el('div', 'sqs-action-row');
      queueActionRow.append(
        btn('Redrive DLQ Messages', 'sqs-btn-secondary', () => showRedriveModal(queue)),
        btn('Configure Attributes', 'sqs-btn-secondary', () => showAttributesModal(queue)),
      );
      list.append(queueActionRow);

      if (!state.messages.length) {
        list.append(el('div', 'sqs-empty', 'No received messages. Poll the queue to inspect available messages.'));
      } else {
        state.messages.forEach((message, index) => list.append(renderMessage(queue, message, index)));
      }
      list.append(consoleUi.renderActivityPanel({
        service: 'sqs',
        classPrefix: 'sqs',
        title: 'Recent sends and polls',
        actions: ['send_message', 'receive_messages'],
        emptyText: 'Send or poll messages to build a local replay history.',
        onReplay: (item) => {
          if (item.action === 'send_message') {
            state.selectedQueue = item.payload?.queue_name || state.selectedQueue;
            render();
            showSendMessageModal(selectedQueue(), item.payload);
          } else {
            state.selectedQueue = item.payload?.queue_name || state.selectedQueue;
            render();
            showReceiveMessagesModal(selectedQueue(), item.payload);
          }
        },
        onClear: render,
      }));
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
        btn('DLQ Redrive', 'sqs-btn-secondary', () => queue && showRedriveModal(queue)),
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
    if (!root) return;
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
    if (!root) return;
    root.append(el('div', 'sqs-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.SQSConsole = SQSConsole;

if (document.getElementById('sqs-console-root')) {
  SQSConsole.init();
}
