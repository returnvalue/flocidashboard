/* global ServiceConsole */

const SNSConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('sns-console-root');
  const breadcrumbsEl = document.getElementById('sns-breadcrumbs');
  const summaryEl = document.getElementById('sns-summary');
  const loadedAtEl = document.getElementById('sns-loaded-at');

  const state = {
    inventory: null,
    selectedTopicArn: '',
    lastPublish: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'sns',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'sns');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'sns',
      toast,
    });

  function topicName(topicArn) {
    return String(topicArn || '').split(':').pop() || 'Unnamed topic';
  }

  function topics() {
    return state.inventory?.topics || [];
  }

  function subscriptions() {
    return state.inventory?.subscriptions || [];
  }

  function selectedTopic() {
    return topics().find((topic) => topic.arn === state.selectedTopicArn) || topics()[0] || null;
  }

  function topicSubscriptions(topic) {
    if (!topic) return [];
    return subscriptions().filter((sub) => sub.topic_arn === topic.arn);
  }

  function isFifoTopic(topic) {
    const attributes = topic?.attributes || {};
    return Boolean(topic?.arn?.endsWith('.fifo') || attributes.FifoTopic === 'true');
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) return;
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'Amazon SNS');
    home.addEventListener('click', () => {
      state.selectedTopicArn = '';
      render();
    });
    breadcrumbsEl.append(home);
    const topic = selectedTopic();
    if (topic) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, topic.name || topicName(topic.arn)));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'sns',
      targets: {
        topics: 'Topics',
        subscriptions: 'Subscriptions',
        sqs_subscriptions: 'Subscriptions',
        lambda_subscriptions: 'Subscriptions',
        http_subscriptions: 'Subscriptions',
        pending_subscriptions: 'Subscriptions',
      },
    });
  }

  function parseAttributes(value) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Message attributes must be a JSON object');
    }
    return parsed;
  }

  function showCreateTopicModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'orders-events or orders-events.fifo';
    nameInput.required = true;

    const fifoCheckbox = document.createElement('input');
    fifoCheckbox.type = 'checkbox';
    const fifoLabel = el('label');
    fifoLabel.append(fifoCheckbox, ' FIFO Topic (Message deduplication & ordering)');

    const displayInput = document.createElement('input');
    displayInput.placeholder = 'e.g. Order Events Hub';

    form.append(
      el('label', null, 'Topic Name'),
      nameInput,
      fifoLabel,
      el('label', null, 'Display Name (Optional)'),
      displayInput,
    );

    openModal('Create Topic', form, 'Create Topic', async (close) => {
      const name = nameInput.value.trim();
      if (!name) throw new Error('Topic name is required');
      await apiJson('/api/sns/topics/', {
        method: 'POST',
        body: JSON.stringify({
          name,
          fifo: fifoCheckbox.checked,
          display_name: displayInput.value.trim() || undefined,
        }),
      });
      toast(`Topic ${name} created`);
      close();
      await refresh();
    });
  }

  function showDeleteTopicModal(topic) {
    const form = el('div');
    form.append(
      el('p', null, `Are you sure you want to delete topic "${topic.name || topicName(topic.arn)}"?`),
      el('pre', 'sns-topic-arn-preview', topic.arn),
    );

    openModal('Delete Topic', form, 'Delete', async (close) => {
      await apiJson(`/api/sns/topics/${encodeURIComponent(topic.arn)}/`, {
        method: 'DELETE',
      });
      toast('Topic deleted');
      state.selectedTopicArn = '';
      close();
      await refresh();
    });
  }

  function showCreateSubscriptionModal(topic) {
    const form = el('div');
    const protoSelect = document.createElement('select');
    [['sqs', 'Amazon SQS Queue'], ['lambda', 'AWS Lambda Function'], ['http', 'HTTP Webhook'], ['https', 'HTTPS Webhook'], ['email', 'Email Address']].forEach(([val, label]) => {
      const opt = el('option', null, label);
      opt.value = val;
      protoSelect.append(opt);
    });

    const endpointInput = document.createElement('input');
    endpointInput.placeholder = 'Queue ARN, Lambda ARN, HTTP URL, or Email';
    endpointInput.required = true;

    const rawDeliveryCheckbox = document.createElement('input');
    rawDeliveryCheckbox.type = 'checkbox';
    const rawDeliveryLabel = el('label');
    rawDeliveryLabel.append(rawDeliveryCheckbox, ' Raw Message Delivery (Skip SNS JSON wrapper for SQS/HTTP)');

    const filterPolicyInput = document.createElement('textarea');
    filterPolicyInput.placeholder = '{"event_type": ["order_created", "order_paid"], "amount": [{"numeric": [">=", 100]}]}';

    form.append(
      el('label', null, 'Topic ARN'),
      el('pre', 'sns-topic-arn-preview', topic.arn),
      el('label', null, 'Protocol'),
      protoSelect,
      el('label', null, 'Endpoint Target'),
      endpointInput,
      rawDeliveryLabel,
      el('label', null, 'Subscription Filter Policy (JSON object, Optional)'),
      filterPolicyInput,
    );

    openModal('Create Subscription', form, 'Subscribe', async (close) => {
      const proto = protoSelect.value;
      const endpoint = endpointInput.value.trim();
      if (!endpoint) throw new Error('Endpoint target is required');

      let filterPolicy = null;
      if (filterPolicyInput.value.trim()) {
        try {
          filterPolicy = JSON.parse(filterPolicyInput.value.trim());
        } catch (e) {
          throw new Error('Filter policy must be valid JSON: ' + e.message);
        }
      }

      await apiJson('/api/sns/subscriptions/', {
        method: 'POST',
        body: JSON.stringify({
          topic_arn: topic.arn,
          protocol: proto,
          endpoint,
          filter_policy: filterPolicy,
          raw_message_delivery: rawDeliveryCheckbox.checked,
        }),
      });
      toast('Subscription created');
      close();
      await refresh();
    });
  }

  function showPublishModal(topic) {
    const form = el('div');
    const messageInput = document.createElement('textarea');
    messageInput.required = true;
    messageInput.placeholder = '{"event":"created","source":"local"}';
    const subjectInput = document.createElement('input');
    subjectInput.placeholder = 'optional';
    const attributesInput = document.createElement('textarea');
    attributesInput.className = 'sns-attributes-input';
    attributesInput.placeholder = '{"eventType":"created","attempt":1}';
    const structureSelect = document.createElement('select');
    [
      ['', 'Default'],
      ['json', 'JSON structure'],
    ].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      structureSelect.append(option);
    });
    const groupInput = document.createElement('input');
    groupInput.placeholder = 'default';
    const dedupeInput = document.createElement('input');
    dedupeInput.placeholder = 'optional';

    form.append(
      el('label', null, 'Topic ARN'),
      el('pre', 'sns-topic-arn-preview', topic.arn),
      el('label', null, 'Message body'),
      messageInput,
      el('label', null, 'Subject'),
      subjectInput,
      el('label', null, 'Message structure'),
      structureSelect,
      el('label', null, 'Message attributes JSON'),
      attributesInput,
    );
    if (isFifoTopic(topic)) {
      form.append(
        el('label', null, 'Message group ID'),
        groupInput,
        el('label', null, 'Deduplication ID'),
        dedupeInput,
      );
    }

    openModal('Publish message', form, 'Publish', async (close) => {
      const payload = {
        topic_arn: topic.arn,
        message: messageInput.value,
      };
      if (subjectInput.value.trim()) {
        payload.subject = subjectInput.value.trim();
      }
      if (structureSelect.value) {
        payload.message_structure = structureSelect.value;
      }
      const attributes = parseAttributes(attributesInput.value);
      if (attributes) {
        payload.message_attributes = attributes;
      }
      if (isFifoTopic(topic)) {
        payload.message_group_id = groupInput.value.trim();
        payload.message_deduplication_id = dedupeInput.value.trim();
      }
      const data = await apiJson('/api/sns/messages/publish/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      state.lastPublish = data;
      close();
      toast(data.message_id ? `Message published: ${data.message_id}` : 'Message published');
      await refresh();
    });
  }

  function renderTopicRow(topic) {
    const active = topic.arn === selectedTopic()?.arn;
    const row = el('button', `sns-topic-row${active ? ' sns-topic-row-active' : ''}`);
    const meta = [
      `${topic.subscription_count || 0} subscription${topic.subscription_count === 1 ? '' : 's'}`,
      topic.attributes?.DisplayName ? `Display: ${topic.attributes.DisplayName}` : '',
    ].filter(Boolean);
    row.append(
      el('span', 'sns-topic-name', topic.name || topicName(topic.arn)),
      el('span', 'sns-topic-meta', meta.join(' / ')),
    );
    if (isFifoTopic(topic)) {
      row.append(el('span', 'sns-badge', 'FIFO'));
    }
    row.addEventListener('click', () => {
      state.selectedTopicArn = topic.arn;
      render();
    });
    return row;
  }

  function renderTopicList() {
    const panel = el('section', 'sns-panel');
    panel.append(el('div', 'sns-panel-heading', 'Topics'));
    const list = el('div', 'sns-topic-list');
    if (!topics().length) {
      list.append(el('div', 'sns-empty', 'No topics found.'));
    } else {
      topics().forEach((topic) => list.append(renderTopicRow(topic)));
    }
    panel.append(list);
    return panel;
  }

  function renderSubscription(subscription) {
    const card = el('article', 'sns-subscription');
    const heading = el('div', 'sns-card-heading');
    heading.append(
      el('h4', null, `${subscription.protocol || 'Subscription'} → ${subscription.endpoint || ''}`),
      btn('Unsubscribe', 'sns-btn-danger', () => {
        openModal('Unsubscribe', el('p', null, `Delete subscription ${subscription.arn}?`), 'Delete', async (close) => {
          await apiJson(`/api/sns/subscriptions/${encodeURIComponent(subscription.arn)}/`, { method: 'DELETE' });
          toast('Unsubscribed');
          close();
          await refresh();
        });
      }),
    );
    card.append(heading);

    const details = document.createElement('dl');
    consoleUi.addField(details, 'Endpoint', subscription.endpoint);
    consoleUi.addField(details, 'ARN', subscription.arn);
    consoleUi.addField(details, 'Owner', subscription.owner);
    consoleUi.addField(details, 'Attributes', subscription.attributes || {});
    card.append(details);
    return card;
  }

  function renderSelectedTopic(topic) {
    const panel = el('section', 'sns-panel');
    const heading = el('div', 'sns-panel-heading');
    const title = el('span', null, topic ? (topic.name || topicName(topic.arn)) : 'Topic Details');
    const count = el('span', 'sns-topic-meta', `${topicSubscriptions(topic).length} subscription${topicSubscriptions(topic).length === 1 ? '' : 's'}`);
    heading.append(title, count);
    panel.append(heading);

    const content = el('div', 'sns-topic-detail');
    if (!topic) {
      content.append(el('div', 'sns-empty', 'Create or select a topic to publish messages.'));
    } else {
      const details = document.createElement('dl');
      consoleUi.addField(details, 'Topic ARN', topic.arn);
      consoleUi.addField(details, 'Attributes', topic.attributes || {});
      consoleUi.addField(details, 'Tags', topic.tags || []);
      content.append(details);

      const topicSubs = topicSubscriptions(topic);
      const subHeading = el('div', 'sns-card-heading');
      subHeading.append(
        el('h3', null, 'Topic Subscriptions'),
        btn('+ Add Subscription', 'sns-btn-secondary', () => showCreateSubscriptionModal(topic)),
      );
      content.append(subHeading);

      if (!topicSubs.length) {
        content.append(el('div', 'sns-empty sns-empty-compact', 'No subscriptions for this topic.'));
      } else {
        const list = el('div', 'sns-subscription-list');
        topicSubs.forEach((subscription) => list.append(renderSubscription(subscription)));
        content.append(list);
      }

      if (state.lastPublish?.topic_arn === topic.arn) {
        const result = el('div', 'sns-publish-result');
        result.append(el('h3', null, 'Last publish result'));
        const publishDetails = document.createElement('dl');
        consoleUi.addField(publishDetails, 'Message ID', state.lastPublish.message_id);
        consoleUi.addField(publishDetails, 'Sequence number', state.lastPublish.sequence_number);
        result.append(publishDetails);
        content.append(result);
      }
    }
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const topic = selectedTopic();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create Topic', null, showCreateTopicModal),
        btn('Publish Message', 'sns-btn-secondary', () => topic && showPublishModal(topic)),
        btn('Add Subscription', 'sns-btn-secondary', () => topic && showCreateSubscriptionModal(topic)),
      ],
      [
        btn('Delete Topic', 'sns-btn-danger', () => topic && showDeleteTopicModal(topic)),
      ],
    ));

    const topicButtons = container.querySelectorAll('.sns-btn-secondary, .sns-btn-danger');
    topicButtons.forEach((button) => {
      button.disabled = !topic;
    });

    const workbench = el('div', 'sns-workbench');
    workbench.append(renderTopicList(), renderSelectedTopic(topic));
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
    const data = await apiJson('/api/sns/');
    state.inventory = data;
    if (!selectedTopic() && topics().length) {
      state.selectedTopicArn = topics()[0].arn;
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) return;
    root.append(el('div', 'sns-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.SNSConsole = SNSConsole;

if (document.getElementById('sns-console-root')) {
  SNSConsole.init();
}
