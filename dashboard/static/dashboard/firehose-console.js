/* global ServiceConsole */

const FirehoseConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('firehose-console-root');
  const breadcrumbsEl = document.getElementById('firehose-breadcrumbs');
  const summaryEl = document.getElementById('firehose-summary');
  const loadedAtEl = document.getElementById('firehose-loaded-at');

  const state = {
    inventory: null,
    selectedStreamName: '',
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'firehose',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'firehose');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'firehose',
      toast,
    });

  function streams() {
    return state.inventory?.delivery_streams || [];
  }

  function streamName(stream) {
    return stream?.name || stream?.arn || '';
  }

  function selectedStream() {
    return streams().find((stream) => streamName(stream) === state.selectedStreamName) || streams()[0] || null;
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

  function parseRecordData(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      throw new Error('Record data is required');
    }
    if (!['{', '['].includes(trimmed[0])) {
      return trimmed;
    }
    return JSON.parse(trimmed);
  }

  function parseBatchLines(value) {
    const lines = String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) {
      throw new Error('Batch records are required');
    }
    return lines.map((line, index) => {
      try {
        return parseRecordData(line);
      } catch (error) {
        throw new Error(`Batch line ${index + 1} must be valid JSON or plain text`);
      }
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('Data Firehose', null, () => {
      state.selectedStreamName = streams()[0] ? streamName(streams()[0]) : '';
      render();
    }));
    const stream = selectedStream();
    if (stream) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, streamName(stream)));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'firehose',
      targets: {
        delivery_streams: 'Delivery streams',
        active_streams: 'Delivery streams',
        destinations: 'Destinations',
        tagged_streams: 'Delivery streams',
      },
    });
  }

  function showCreateStreamModal() {
    const form = el('div', 'firehose-modal-form');
    const nameInput = document.createElement('input');
    nameInput.required = true;
    nameInput.placeholder = 'my-stream';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '[{"Key":"env","Value":"local"}]';
    form.append(
      el('label', null, 'Delivery stream name'),
      nameInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Create delivery stream', form, 'Create', async (close) => {
      const data = await apiJson('/api/firehose/delivery-streams/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          tags: parseJson(tagsInput.value, [], 'Tags'),
        }),
      });
      state.selectedStreamName = data.name || nameInput.value.trim();
      state.lastResult = data;
      close();
      toast('Delivery stream created');
      await refresh();
    });
  }

  async function deleteStream(stream) {
    if (!window.confirm(`Delete Firehose delivery stream ${streamName(stream)}?`)) {
      return;
    }
    const data = await apiJson(`/api/firehose/delivery-streams/${encodeURIComponent(streamName(stream))}/`, {
      method: 'DELETE',
    });
    state.lastResult = data;
    state.selectedStreamName = '';
    toast('Delivery stream deleted');
    await refresh();
  }

  async function putRecord(stream, dataInput) {
    const data = await apiJson(`/api/firehose/delivery-streams/${encodeURIComponent(streamName(stream))}/records/`, {
      method: 'POST',
      body: JSON.stringify({ data: parseRecordData(dataInput.value) }),
    });
    state.lastResult = data;
    toast(data.record_id ? `Record written: ${data.record_id}` : 'Record written');
    render();
  }

  async function putBatch(stream, batchInput) {
    const records = parseBatchLines(batchInput.value);
    const data = await apiJson(`/api/firehose/delivery-streams/${encodeURIComponent(streamName(stream))}/records/batch/`, {
      method: 'POST',
      body: JSON.stringify({ records }),
    });
    state.lastResult = data;
    toast(`${records.length} record${records.length === 1 ? '' : 's'} written`);
    render();
  }

  function renderStreamRow(stream) {
    const name = streamName(stream);
    const active = name === streamName(selectedStream());
    const row = el('button', `firehose-stream-row${active ? ' firehose-stream-row-active' : ''}`);
    row.append(
      el('span', 'firehose-stream-name', name || 'Unnamed stream'),
      el('span', 'firehose-stream-meta', `${stream.status || 'UNKNOWN'} / ${stream.destination_count || 0} destination${stream.destination_count === 1 ? '' : 's'}`),
    );
    row.addEventListener('click', () => {
      state.selectedStreamName = name;
      render();
    });
    return row;
  }

  function renderStreamList() {
    const panel = el('section', 'firehose-panel');
    panel.append(el('div', 'firehose-panel-heading', 'Delivery streams'));
    const list = el('div', 'firehose-stream-list');
    if (!streams().length) {
      list.append(el('div', 'firehose-empty', 'No delivery streams found.'));
    } else {
      streams().forEach((stream) => list.append(renderStreamRow(stream)));
    }
    panel.append(list);
    return panel;
  }

  function renderStreamFacts(stream) {
    const facts = document.createElement('dl');
    consoleUi.addField(facts, 'ARN', stream.arn);
    consoleUi.addField(facts, 'Status', stream.status);
    consoleUi.addField(facts, 'Type', stream.type);
    consoleUi.addField(facts, 'Version ID', stream.version_id);
    consoleUi.addField(facts, 'Created', stream.created);
    consoleUi.addField(facts, 'Updated', stream.updated);
    consoleUi.addField(facts, 'Destinations', stream.destination_count);
    consoleUi.addField(facts, 'Tags', stream.tags);
    return facts;
  }

  function renderLastResult() {
    if (!state.lastResult) {
      return null;
    }
    const result = el('div', 'firehose-last-result');
    result.append(el('h3', null, 'Last action result'));
    const pre = el('pre', 'firehose-result');
    pre.textContent = JSON.stringify(consoleUi.displayValue(state.lastResult), null, 2);
    result.append(pre);
    return result;
  }

  function renderStreamDetail(stream) {
    const panel = el('section', 'firehose-panel');
    const heading = el('div', 'firehose-panel-heading');
    heading.append(
      el('span', null, stream ? streamName(stream) : 'Firehose workbench'),
      el('span', 'firehose-stream-meta', stream ? `${stream.status || 'UNKNOWN'} / flushes after 5 records` : 'No stream selected'),
    );
    panel.append(heading);

    const content = el('div', 'firehose-detail');
    if (!stream) {
      content.append(el('div', 'firehose-empty', 'Create a delivery stream or refresh after your app creates one.'));
      panel.append(content);
      return panel;
    }

    content.append(renderStreamFacts(stream));

    const dataInput = document.createElement('textarea');
    dataInput.className = 'firehose-record-input';
    dataInput.value = JSON.stringify({ id: 1, amount: 10.5 }, null, 2);
    const putForm = el('div', 'firehose-form-grid');
    putForm.append(
      el('label', null, 'Record data'),
      dataInput,
    );
    const putButton = btn('Put record', null, async () => {
      putButton.disabled = true;
      try {
        await putRecord(stream, dataInput);
      } catch (error) {
        toast(error.message, true);
      } finally {
        putButton.disabled = false;
      }
    });

    const batchInput = document.createElement('textarea');
    batchInput.className = 'firehose-record-input';
    batchInput.value = [
      '{"id":2,"amount":12.25}',
      '{"id":3,"amount":19.5}',
      '{"id":4,"amount":4.75}',
      '{"id":5,"amount":21}',
      '{"id":6,"amount":8.5}',
    ].join('\n');
    const batchForm = el('div', 'firehose-form-grid');
    batchForm.append(
      el('label', null, 'Batch records'),
      batchInput,
    );
    const batchButton = btn('Put batch', 'firehose-btn-secondary', async () => {
      batchButton.disabled = true;
      try {
        await putBatch(stream, batchInput);
      } catch (error) {
        toast(error.message, true);
      } finally {
        batchButton.disabled = false;
      }
    });

    const actions = el('div', 'firehose-action-row');
    actions.append(
      putButton,
      batchButton,
      btn('Delete stream', 'firehose-btn-danger', () => deleteStream(stream).catch((error) => toast(error.message, true))),
    );

    content.append(
      el('h3', null, 'Write test record'),
      putForm,
      el('h3', null, 'Write batch'),
      batchForm,
      actions,
    );
    const result = renderLastResult();
    if (result) {
      content.append(result);
    }
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const stream = selectedStream();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create delivery stream', null, showCreateStreamModal),
        btn('Refresh streams', 'firehose-btn-secondary', () => refresh().catch((error) => toast(error.message, true))),
      ],
      [el('span', 'firehose-toolbar-note', 'Buffers locally and flushes raw NDJSON to S3 after five records')],
    ));
    const workbench = el('div', 'firehose-workbench');
    workbench.append(renderStreamList(), renderStreamDetail(stream));
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
    const data = await apiJson('/api/firehose/');
    state.inventory = data;
    if (!selectedStream() && streams().length) {
      state.selectedStreamName = streamName(streams()[0]);
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'firehose-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.FirehoseConsole = FirehoseConsole;

if (document.getElementById('firehose-console-root')) {
  FirehoseConsole.init();
}
