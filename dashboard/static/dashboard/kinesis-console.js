/* global ServiceConsole */

const KinesisConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('kinesis-console-root');
  const breadcrumbsEl = document.getElementById('kinesis-breadcrumbs');
  const summaryEl = document.getElementById('kinesis-summary');
  const loadedAtEl = document.getElementById('kinesis-loaded-at');

  const state = {
    inventory: null,
    selectedStreamName: '',
    selectedShardId: '',
    lastPut: null,
    records: [],
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'kinesis',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'kinesis');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'kinesis',
      toast,
    });

  function streams() {
    return state.inventory?.streams || [];
  }

  function streamName(stream) {
    return stream?.name || stream?.arn || '';
  }

  function selectedStream() {
    return streams().find((stream) => streamName(stream) === state.selectedStreamName) || streams()[0] || null;
  }

  function shardId(shard) {
    return shard?.ShardId || shard?.shard_id || shard?.name || '';
  }

  function streamShards(stream) {
    return stream?.shards || [];
  }

  function selectedShard(stream = selectedStream()) {
    const shards = streamShards(stream);
    return shards.find((shard) => shardId(shard) === state.selectedShardId) || shards[0] || null;
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'Amazon Kinesis');
    home.addEventListener('click', () => {
      state.selectedStreamName = streams()[0] ? streamName(streams()[0]) : '';
      state.selectedShardId = '';
      render();
    });
    breadcrumbsEl.append(home);
    const stream = selectedStream();
    if (stream) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, streamName(stream)));
      const shard = selectedShard(stream);
      if (shard) {
        breadcrumbsEl.append(el('span', null, '/'), el('span', null, shardId(shard)));
      }
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'kinesis',
      targets: {
        streams: 'Streams',
        active_streams: 'Streams',
        shards: 'Shards',
        consumers: 'Consumers',
        tagged_streams: 'Streams',
      },
    });
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

  function showCreateStreamModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.required = true;
    nameInput.placeholder = 'orders-stream';
    const modeInput = document.createElement('select');
    modeInput.append(new Option('Provisioned', 'PROVISIONED'), new Option('On-demand', 'ON_DEMAND'));
    const shardInput = document.createElement('input');
    shardInput.type = 'number';
    shardInput.min = '1';
    shardInput.value = '1';

    modeInput.addEventListener('change', () => {
      shardInput.disabled = modeInput.value === 'ON_DEMAND';
    });

    form.append(
      el('label', null, 'Stream name'),
      nameInput,
      el('label', null, 'Mode'),
      modeInput,
      el('label', null, 'Shard count'),
      shardInput,
    );

    openModal('Create stream', form, 'Create stream', async (close) => {
      await apiJson('/api/kinesis/streams/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          mode: modeInput.value,
          shard_count: Number(shardInput.value || 1),
        }),
      });
      close();
      toast('Stream created');
      state.selectedStreamName = nameInput.value.trim();
      await refresh();
    });
  }

  async function putRecord(stream, partitionKeyInput, dataInput) {
    const data = await apiJson(`/api/kinesis/streams/${encodeURIComponent(streamName(stream))}/records/`, {
      method: 'POST',
      body: JSON.stringify({
        partition_key: partitionKeyInput.value.trim(),
        data: parseRecordData(dataInput.value),
      }),
    });
    state.lastPut = data;
    toast(data.sequence_number ? `Record written: ${data.sequence_number}` : 'Record written');
    render();
  }

  async function readRecords(stream, shard, iteratorInput, limitInput, sequenceInput) {
    const data = await apiJson(
      `/api/kinesis/streams/${encodeURIComponent(streamName(stream))}/shards/${encodeURIComponent(shardId(shard))}/records/`,
      {
        method: 'POST',
        body: JSON.stringify({
          iterator_type: iteratorInput.value,
          limit: Number(limitInput.value || 25),
          sequence_number: sequenceInput.value.trim(),
        }),
      },
    );
    state.records = data.records || [];
    toast(`${state.records.length} record${state.records.length === 1 ? '' : 's'} read`);
    render();
  }

  function renderStreamRow(stream) {
    const name = streamName(stream);
    const active = name === streamName(selectedStream());
    const row = el('button', `kinesis-stream-row${active ? ' kinesis-stream-row-active' : ''}`);
    row.append(
      el('span', 'kinesis-stream-name', name || 'Unnamed stream'),
      el('span', 'kinesis-stream-meta', `${stream.status || 'UNKNOWN'} / ${stream.shard_count || 0} shard${stream.shard_count === 1 ? '' : 's'}`),
    );
    row.addEventListener('click', () => {
      state.selectedStreamName = name;
      state.selectedShardId = '';
      state.records = [];
      render();
    });
    return row;
  }

  function renderStreamList() {
    const panel = el('section', 'kinesis-panel');
    panel.append(el('div', 'kinesis-panel-heading', 'Streams'));
    const list = el('div', 'kinesis-stream-list');
    if (!streams().length) {
      list.append(el('div', 'kinesis-empty', 'No streams found.'));
    } else {
      streams().forEach((stream) => list.append(renderStreamRow(stream)));
    }
    panel.append(list);
    return panel;
  }

  function renderShardSelect(stream) {
    const select = document.createElement('select');
    const shards = streamShards(stream);
    if (!shards.length) {
      select.append(new Option('No shards found', ''));
      select.disabled = true;
    } else {
      shards.forEach((shard) => select.append(new Option(shardId(shard), shardId(shard))));
      select.value = shardId(selectedShard(stream));
    }
    select.addEventListener('change', () => {
      state.selectedShardId = select.value;
      state.records = [];
      render();
    });
    return select;
  }

  function renderRecord(record) {
    const card = el('article', 'kinesis-record');
    const heading = el('div', 'kinesis-record-heading');
    heading.append(
      el('h4', null, record.sequence_number || 'Record'),
      el('span', 'kinesis-stream-meta', record.approximate_arrival_timestamp ? consoleUi.formatDate(record.approximate_arrival_timestamp) : 'No arrival timestamp'),
    );
    const details = document.createElement('dl');
    consoleUi.addField(details, 'Partition key', record.partition_key);
    consoleUi.addField(details, 'Size', consoleUi.formatBytes(record.size_bytes));
    consoleUi.addField(details, 'JSON', record.data_json);
    consoleUi.addField(details, 'Data', record.data_text);
    card.append(heading, details);
    return card;
  }

  function renderRecords() {
    const section = el('div', 'kinesis-record-list');
    if (!state.records.length) {
      section.append(el('div', 'kinesis-empty kinesis-empty-compact', 'Read a shard to see records here.'));
      return section;
    }
    state.records.forEach((record) => section.append(renderRecord(record)));
    return section;
  }

  function renderStreamDetail(stream) {
    const panel = el('section', 'kinesis-panel');
    const heading = el('div', 'kinesis-panel-heading');
    heading.append(
      el('span', null, stream ? streamName(stream) : 'Stream workbench'),
      el('span', 'kinesis-stream-meta', stream ? `${stream.status || 'UNKNOWN'} / ${stream.shard_count || 0} shard${stream.shard_count === 1 ? '' : 's'}` : 'No stream selected'),
    );
    panel.append(heading);

    const content = el('div', 'kinesis-detail');
    if (!stream) {
      content.append(el('div', 'kinesis-empty', 'Create a stream or refresh after your app creates one.'));
      panel.append(content);
      return panel;
    }

    const partitionKeyInput = document.createElement('input');
    partitionKeyInput.placeholder = 'customer-123';
    partitionKeyInput.value = 'local-test';
    const dataInput = document.createElement('textarea');
    dataInput.className = 'kinesis-record-input';
    dataInput.value = JSON.stringify({ event: 'local-test', ok: true }, null, 2);

    const putForm = el('div', 'kinesis-form-grid');
    putForm.append(
      el('label', null, 'Partition key'),
      partitionKeyInput,
      el('label', null, 'Record data'),
      dataInput,
    );

    const putButton = btn('Put record', null, async () => {
      putButton.disabled = true;
      try {
        await putRecord(stream, partitionKeyInput, dataInput);
      } catch (error) {
        toast(error.message, true);
      } finally {
        putButton.disabled = false;
      }
    });

    const shardInput = renderShardSelect(stream);
    const iteratorInput = document.createElement('select');
    ['TRIM_HORIZON', 'LATEST', 'AT_SEQUENCE_NUMBER', 'AFTER_SEQUENCE_NUMBER'].forEach((type) => {
      iteratorInput.append(new Option(type.replaceAll('_', ' '), type));
    });
    const limitInput = document.createElement('input');
    limitInput.type = 'number';
    limitInput.min = '1';
    limitInput.max = '100';
    limitInput.value = '25';
    const sequenceInput = document.createElement('input');
    sequenceInput.placeholder = 'Required for sequence-number iterators';

    const readForm = el('div', 'kinesis-form-grid');
    readForm.append(
      el('label', null, 'Shard'),
      shardInput,
      el('label', null, 'Iterator'),
      iteratorInput,
      el('label', null, 'Limit'),
      limitInput,
      el('label', null, 'Sequence number'),
      sequenceInput,
    );

    const readButton = btn('Read records', 'kinesis-btn-secondary', async () => {
      readButton.disabled = true;
      try {
        await readRecords(stream, selectedShard(stream), iteratorInput, limitInput, sequenceInput);
      } catch (error) {
        toast(error.message, true);
      } finally {
        readButton.disabled = false;
      }
    });
    readButton.disabled = !selectedShard(stream);

    content.append(
      el('h3', null, 'Write test record'),
      putForm,
      putButton,
      el('h3', null, 'Read shard records'),
      readForm,
      readButton,
    );

    if (state.lastPut?.stream_name === streamName(stream)) {
      const lastPut = el('div', 'kinesis-last-put');
      lastPut.append(el('h3', null, 'Last write'));
      const details = document.createElement('dl');
      consoleUi.addField(details, 'Shard ID', state.lastPut.shard_id);
      consoleUi.addField(details, 'Sequence number', state.lastPut.sequence_number);
      consoleUi.addField(details, 'Partition key', state.lastPut.partition_key);
      lastPut.append(details);
      content.append(lastPut);
    }

    content.append(renderRecords());
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const stream = selectedStream();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create stream', null, showCreateStreamModal),
        btn('Refresh streams', 'kinesis-btn-secondary', () => refresh().catch((error) => toast(error.message, true))),
      ],
      [],
    ));
    const workbench = el('div', 'kinesis-workbench');
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
    const data = await apiJson('/api/kinesis/');
    state.inventory = data;
    if (!selectedStream() && streams().length) {
      state.selectedStreamName = streamName(streams()[0]);
      state.selectedShardId = '';
    }
    if (!selectedShard()) {
      state.selectedShardId = shardId(selectedShard()) || '';
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'kinesis-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.KinesisConsole = KinesisConsole;

if (document.getElementById('kinesis-console-root')) {
  KinesisConsole.init();
}
