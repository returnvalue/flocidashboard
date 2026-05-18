/* global ServiceConsole */

const CloudWatchConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('cloudwatch-console-root');
  const breadcrumbsEl = document.getElementById('cloudwatch-breadcrumbs');
  const summaryEl = document.getElementById('cloudwatch-summary');
  const loadedAtEl = document.getElementById('cloudwatch-loaded-at');

  const state = {
    inventory: null,
    selectedGroupName: new URLSearchParams(window.location.search).get('logGroup') || '',
    selectedStreamName: '',
    streams: [],
    events: [],
    limit: 50,
    autoRefresh: false,
    timer: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'cloudwatch',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'cloudwatch');

  function groups() {
    return state.inventory?.log_groups || [];
  }

  function selectedGroup() {
    return groups().find((group) => group.name === state.selectedGroupName) || groups()[0] || null;
  }

  function selectedStream() {
    return state.streams.find((stream) => stream.logStreamName === state.selectedStreamName) || state.streams[0] || null;
  }

  function formatMillis(value) {
    if (!value) {
      return 'None';
    }
    return new Date(value).toLocaleString();
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'CloudWatch Logs');
    home.addEventListener('click', () => {
      state.selectedGroupName = '';
      state.selectedStreamName = '';
      state.streams = [];
      state.events = [];
      render();
    });
    breadcrumbsEl.append(home);
    const group = selectedGroup();
    if (group) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, group.name));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'cloudwatch',
      targets: {
        log_groups: 'Log groups',
        log_streams: 'Log groups',
        recent_log_events: 'Log groups',
        metrics: 'Metrics',
        alarms: 'Alarms',
      },
    });
  }

  async function loadStreams(group = selectedGroup()) {
    if (!group) {
      return;
    }
    const data = await apiJson('/api/cloudwatch/log-streams/', {
      method: 'POST',
      body: JSON.stringify({
        log_group_name: group.name,
        limit: state.limit,
      }),
    });
    state.streams = data.streams || [];
    if (!selectedStream() && state.streams.length) {
      state.selectedStreamName = state.streams[0].logStreamName;
    }
  }

  async function loadEvents(group = selectedGroup(), stream = selectedStream()) {
    if (!group || !stream) {
      return;
    }
    const data = await apiJson('/api/cloudwatch/log-events/', {
      method: 'POST',
      body: JSON.stringify({
        log_group_name: group.name,
        log_stream_name: stream.logStreamName,
        limit: state.limit,
      }),
    });
    state.events = data.events || [];
  }

  async function refreshLogs({ reloadStreams = true } = {}) {
    const group = selectedGroup();
    if (!group) {
      return;
    }
    if (reloadStreams) {
      await loadStreams(group);
    }
    await loadEvents(group, selectedStream());
    render();
  }

  function setAutoRefresh(enabled) {
    state.autoRefresh = enabled;
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = null;
    }
    if (enabled) {
      state.timer = window.setInterval(() => {
        refreshLogs({ reloadStreams: false }).catch((error) => toast(error.message, true));
      }, 5000);
    }
    render();
  }

  function renderGroupRow(group) {
    const active = group.name === selectedGroup()?.name;
    const row = el('button', `cloudwatch-group-row${active ? ' cloudwatch-group-row-active' : ''}`);
    row.append(
      el('span', 'cloudwatch-group-name', group.name || 'Unnamed group'),
      el('span', 'cloudwatch-group-meta', `${group.stream_count || 0} stream${group.stream_count === 1 ? '' : 's'} / ${group.stored_bytes || 0} bytes`),
    );
    row.addEventListener('click', async () => {
      state.selectedGroupName = group.name;
      state.selectedStreamName = '';
      state.streams = [];
      state.events = [];
      render();
      await refreshLogs();
    });
    return row;
  }

  function renderGroupList() {
    const panel = el('section', 'cloudwatch-panel');
    panel.append(el('div', 'cloudwatch-panel-heading', 'Log groups'));
    const list = el('div', 'cloudwatch-group-list');
    if (!groups().length) {
      list.append(el('div', 'cloudwatch-empty', 'No log groups found.'));
    } else {
      groups().forEach((group) => list.append(renderGroupRow(group)));
    }
    panel.append(list);
    return panel;
  }

  function renderStreamRow(stream) {
    const active = stream.logStreamName === selectedStream()?.logStreamName;
    const row = el('button', `cloudwatch-stream-row${active ? ' cloudwatch-stream-row-active' : ''}`);
    row.append(
      el('span', 'cloudwatch-stream-name', stream.logStreamName || 'Unnamed stream'),
      el('span', 'cloudwatch-group-meta', `Last event: ${formatMillis(stream.lastEventTimestamp)}`),
    );
    row.addEventListener('click', async () => {
      state.selectedStreamName = stream.logStreamName;
      state.events = [];
      render();
      await refreshLogs({ reloadStreams: false });
    });
    return row;
  }

  function renderStreamsPanel() {
    const panel = el('section', 'cloudwatch-panel');
    const heading = el('div', 'cloudwatch-panel-heading');
    heading.append(el('span', null, 'Streams'), el('span', 'cloudwatch-group-meta', `${state.streams.length} loaded`));
    panel.append(heading);
    const list = el('div', 'cloudwatch-stream-list');
    if (!selectedGroup()) {
      list.append(el('div', 'cloudwatch-empty', 'Select a log group.'));
    } else if (!state.streams.length) {
      list.append(el('div', 'cloudwatch-empty', 'No streams loaded.'));
    } else {
      state.streams.forEach((stream) => list.append(renderStreamRow(stream)));
    }
    panel.append(list);
    return panel;
  }

  function renderEvent(event, index) {
    const card = el('article', 'cloudwatch-event');
    const heading = el('div', 'cloudwatch-event-heading');
    heading.append(
      el('span', null, formatMillis(event.timestamp) || `Event ${index + 1}`),
      el('span', 'cloudwatch-group-meta', `Ingested: ${formatMillis(event.ingestionTime)}`),
    );
    card.append(heading, el('pre', 'cloudwatch-event-message', event.message || ''));
    return card;
  }

  function renderEventsPanel() {
    const panel = el('section', 'cloudwatch-panel cloudwatch-events-panel');
    const heading = el('div', 'cloudwatch-panel-heading');
    heading.append(
      el('span', null, selectedStream()?.logStreamName || 'Events'),
      el('span', 'cloudwatch-group-meta', `${state.events.length} event${state.events.length === 1 ? '' : 's'}`),
    );
    panel.append(heading);
    const list = el('div', 'cloudwatch-event-list');
    if (!selectedStream()) {
      list.append(el('div', 'cloudwatch-empty', 'Select a stream to load events.'));
    } else if (!state.events.length) {
      list.append(el('div', 'cloudwatch-empty', 'No events loaded.'));
    } else {
      state.events.forEach((event, index) => list.append(renderEvent(event, index)));
    }
    panel.append(list);
    return panel;
  }

  function renderWorkbench() {
    const limitSelect = document.createElement('select');
    [25, 50, 100].forEach((limit) => {
      const option = document.createElement('option');
      option.value = String(limit);
      option.textContent = `${limit} results`;
      option.selected = state.limit === limit;
      limitSelect.append(option);
    });
    limitSelect.addEventListener('change', async () => {
      state.limit = Number(limitSelect.value);
      await refreshLogs();
    });

    const auto = btn(state.autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off', 'cloudwatch-btn-secondary', () => {
      setAutoRefresh(!state.autoRefresh);
    });

    const container = el('div');
    container.append(toolbar(
      [
        btn('Refresh logs', null, () => refreshLogs().catch((error) => toast(error.message, true))),
        limitSelect,
      ],
      [auto],
    ));
    const workbench = el('div', 'cloudwatch-workbench');
    workbench.append(renderGroupList(), renderStreamsPanel(), renderEventsPanel());
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
    const data = await apiJson('/api/cloudwatch/');
    state.inventory = data;
    if (!selectedGroup() && groups().length) {
      state.selectedGroupName = groups()[0].name;
    }
    renderSummary(data.summary || {});
    render();
    if (selectedGroup()) {
      await refreshLogs();
    }
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'cloudwatch-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.CloudWatchConsole = CloudWatchConsole;

if (document.getElementById('cloudwatch-console-root')) {
  CloudWatchConsole.init();
}
