const ServiceConsole = (() => {
  const ACTIVITY_STORAGE_KEY = 'floci-dashboard:recent-activity:v1';
  const ACTIVITY_LIMIT = 40;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text != null) {
      node.textContent = text;
    }
    return node;
  }

  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  }

  async function apiJson(path, options = {}) {
    const headers = {
      Accept: 'application/json',
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(options.method && options.method !== 'GET' ? { 'X-CSRFToken': getCsrfToken() } : {}),
      ...options.headers,
    };
    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const label = data.operation_label || (data.operation ? data.operation.replaceAll('_', ' ') : '');
      const prefix = label ? `${label} failed: ` : '';
      const error = new Error(`${prefix}${data.error || `Request failed (${response.status})`}`);
      error.status = data.status || response.status;
      error.code = data.code;
      error.service = data.service;
      error.operation = data.operation;
      error.payload = data;
      throw error;
    }
    return data;
  }

  function toast(message, options = {}) {
    const type = options.type || (options.isError ? 'error' : 'success');
    const classPrefix = options.classPrefix || 'service';
    const timeout = options.timeout ?? 3200;
    const existing = Array.from(document.querySelectorAll(`.${classPrefix}-toast`));
    const node = el('div', `${classPrefix}-toast ${classPrefix}-toast-${type}`, message);
    node.setAttribute('role', type === 'error' ? 'alert' : 'status');
    document.body.append(node);
    node.style.bottom = `${22 + existing.length * 54}px`;
    setTimeout(() => node.remove(), timeout);
  }

  function formatDate(value) {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  function formatBytes(bytes) {
    if (bytes == null || bytes === '') {
      return '—';
    }
    const n = Number(bytes);
    if (n < 1024) {
      return `${n} B`;
    }
    if (n < 1024 * 1024) {
      return `${(n / 1024).toFixed(1)} KB`;
    }
    if (n < 1024 * 1024 * 1024) {
      return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function nowLabel(timestamp) {
    const date = new Date(timestamp);
    const diff = Date.now() - date.getTime();
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    if (diff < 60000) {
      return 'Just now';
    }
    if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}m ago`;
    }
    if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}h ago`;
    }
    return date.toLocaleString();
  }

  function statusIndicator(status, options = {}) {
    const raw = String(status || '').trim();
    if (!raw || raw === '—' || raw === 'null' || raw === 'undefined') {
      return el('span', 'status-indicator status-indicator-empty', '—');
    }

    const lower = raw.toLowerCase();
    let variant = 'info';

    if (
      /^(available|active|running|issued|success|enabled|ready|completed|online|ok|in-sync|healthy|passed|true)$/.test(lower) ||
      lower.includes('available') ||
      lower.includes('active') ||
      lower.includes('running') ||
      lower.includes('success') ||
      lower.includes('issued')
    ) {
      variant = 'positive';
    } else if (
      /^(pending|creating|updating|in-progress|in_progress|modifying|rebooting|delayed|deleting|backing-up)$/.test(lower) ||
      lower.includes('pending') ||
      lower.includes('creating') ||
      lower.includes('updating')
    ) {
      variant = 'warning';
    } else if (
      /^(failed|stopped|terminated|error|alarm|denied|unhealthy|disabled|false|rejected)$/.test(lower) ||
      lower.includes('failed') ||
      lower.includes('error') ||
      lower.includes('stopped') ||
      lower.includes('alarm') ||
      lower.includes('terminated')
    ) {
      variant = 'negative';
    } else if (
      /^(inactive|empty|none|draft|deleted|unknown|not configured)$/.test(lower) ||
      lower.includes('inactive')
    ) {
      variant = 'inactive';
    }

    const node = el('span', `status-indicator status-indicator-${variant}`);
    const dot = el('span', `status-indicator-dot status-indicator-dot-${variant}`);
    const text = el('span', 'status-indicator-text', options.label || raw);
    node.append(dot, text);
    return node;
  }

  function kvGrid(attributes, options = {}) {
    const grid = el('div', options.className || 'cloudscape-kv-grid');
    (attributes || []).forEach(({ label, value, isStatus }) => {
      const item = el('div', 'cloudscape-kv-item');
      const lbl = el('span', 'cloudscape-kv-label', label);
      const val = el('span', 'cloudscape-kv-value');
      if (isStatus) {
        val.append(statusIndicator(value));
      } else if (value instanceof Node) {
        val.append(value);
      } else {
        val.textContent = displayValue(label, value);
      }
      item.append(lbl, val);
      grid.append(item);
    });
    return grid;
  }

  function loadActivity() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(ACTIVITY_STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : [];
    } catch (_error) {
      return [];
    }
  }

  function saveActivity(items) {
    try {
      window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(items.slice(0, ACTIVITY_LIMIT)));
    } catch (_error) {
      // Ignore storage failures; activity history is a convenience layer.
    }
  }

  function recordActivity(entry) {
    if (!entry || !entry.service || !entry.action) {
      return null;
    }
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      replayable: true,
      ...entry,
    };
    const items = loadActivity();
    saveActivity([item, ...items]);
    return item;
  }

  function clearActivity(filter = {}) {
    const items = loadActivity();
    const filtered = items.filter((item) => {
      if (filter.service && item.service !== filter.service) {
        return true;
      }
      if (filter.action && item.action !== filter.action) {
        return true;
      }
      return false;
    });
    saveActivity(filtered);
  }

  function activityTitle(item) {
    return item.title || item.summary || item.action || 'Activity';
  }

  function activitySummary(item) {
    const parts = [item.summary, item.detail].filter(Boolean);
    return parts.join(' / ');
  }

  function renderActivityPanel(options = {}) {
    const service = options.service || '';
    const classPrefix = options.classPrefix || service || 'service';
    const title = options.title || 'Recent activity';
    const limit = options.limit || 5;
    const actions = new Set(options.actions || []);
    const replay = options.onReplay || (() => {});
    const onClear = options.onClear || (() => {});
    const panel = el('section', `${classPrefix}-panel service-activity-panel`);
    const heading = el('div', `${classPrefix}-panel-heading service-activity-heading`);
    const clear = button('Clear', `${classPrefix}-btn-secondary service-activity-clear`, () => {
      clearActivity({ service });
      onClear();
    });
    heading.append(el('span', null, title), clear);
    panel.append(heading);

    const items = loadActivity()
      .filter((item) => (!service || item.service === service) && (!actions.size || actions.has(item.action)))
      .slice(0, limit);
    if (!items.length) {
      panel.append(el('div', `${classPrefix}-empty ${classPrefix}-empty-compact service-activity-empty`, options.emptyText || 'No recent activity yet.'));
      return panel;
    }

    const list = el('div', 'service-activity-list');
    items.forEach((item) => {
      const row = el('article', 'service-activity-item');
      const main = el('div', 'service-activity-main');
      main.append(
        el('strong', null, activityTitle(item)),
        el('span', 'service-activity-meta', [activitySummary(item), nowLabel(item.timestamp)].filter(Boolean).join(' / ')),
      );
      const replayButton = button(item.replayLabel || 'Replay', `${classPrefix}-btn-secondary service-activity-replay`, () => replay(item));
      replayButton.disabled = item.replayable === false;
      row.append(main, replayButton);
      list.append(row);
    });
    panel.append(list);
    return panel;
  }

  function sectionSlug(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replaceAll('&', 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function sectionIdForLabel(serviceKey, label) {
    return `${serviceKey}-section-${sectionSlug(label)}`;
  }

  function emptySectionText(title) {
    return `No ${title} found yet.`;
  }

  function renderSummary(summary, container, options = {}) {
    if (!container) {
      return;
    }
    const serviceKey = options.serviceKey || 'service';
    const targets = options.targets || {};
    const entries = Object.entries(summary || {});
    container.textContent = '';
    container.classList.toggle('summary-grid-dense', entries.length > 8);

    if (entries.length === 0) {
      container.append(el('div', 'summary-empty', 'No summary metrics yet.'));
      return;
    }

    const renderCard = ([label, value]) => {
      const displayLabel = label.replaceAll('_', ' ');
      const card = document.createElement('a');
      const number = document.createElement('strong');
      const caption = document.createElement('span');
      card.href = `#${sectionIdForLabel(serviceKey, targets[label] || displayLabel)}`;
      card.className = 'summary-card';
      card.setAttribute('aria-label', `Jump to ${displayLabel}`);
      number.textContent = value ?? 0;
      caption.textContent = displayLabel;
      card.append(number, caption);
      return card;
    };

    entries.forEach((entry) => container.append(renderCard(entry)));
  }

  function parsedJsonString(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed || !['{', '['].includes(trimmed[0])) {
      return null;
    }

    try {
      return JSON.parse(trimmed);
    } catch (error) {
      return null;
    }
  }

  function displayValue(value) {
    if (Array.isArray(value)) {
      return value.map(displayValue);
    }
    if (typeof value === 'string') {
      const parsed = parsedJsonString(value);
      return parsed ? displayValue(parsed) : value;
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, item]) => item !== null && item !== undefined && item !== '')
          .map(([key, item]) => [key, displayValue(item)]),
      );
    }
    return value;
  }

  function stringifyItem(item) {
    return JSON.stringify(displayValue(item), null, 2);
  }

  function valueText(value) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return 'None';
      }
      return value.map((item) => {
        if (typeof item === 'string') {
          const parsed = parsedJsonString(item);
          return parsed ? JSON.stringify(parsed, null, 2) : item;
        }
        return stringifyItem(item);
      }).join('\n');
    }
    if (value && typeof value === 'object') {
      return stringifyItem(value);
    }
    if (typeof value === 'string') {
      const parsed = parsedJsonString(value);
      if (parsed) {
        return JSON.stringify(parsed, null, 2);
      }
    }
    return value ?? 'None';
  }

  function addField(list, label, value) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const details = document.createElement('dd');
    term.textContent = label;
    details.textContent = valueText(value);
    row.append(term, details);
    list.append(row);
  }

  function renderDetailList(serviceKey, title, items, fields = []) {
    const section = document.createElement('section');
    section.className = 'iam-panel collection-panel';
    section.id = sectionIdForLabel(serviceKey, title);
    const normalizedItems = Array.isArray(items) ? items : (items ? [{ name: 'Response', details: items }] : []);

    const heading = el('div', 'card-heading collection-heading');
    const titleEl = document.createElement('h3');
    const count = el('span', 'count', normalizedItems.length);
    titleEl.textContent = title;
    heading.append(titleEl, count);
    section.append(heading);

    if (normalizedItems.length === 0) {
      section.append(el('p', 'muted empty-state', emptySectionText(title)));
      return section;
    }

    normalizedItems.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'iam-item collection-item';

      const name = document.createElement('h4');
      name.textContent = item.name || item.arn || item.id || 'Unnamed';
      card.append(name);

      const list = document.createElement('dl');
      fields.forEach(([label, key]) => addField(list, label, item[key]));
      card.append(list);
      section.append(card);
    });

    return section;
  }

  function defaultCollectionSearchText(item) {
    if (item == null) {
      return '';
    }
    if (typeof item === 'string') {
      return item;
    }
    return Object.values(item)
      .map((value) => typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value || ''))
      .join(' ');
  }

  function renderCollection(options = {}) {
    const {
      container = null,
      title = 'Items',
      items = [],
      itemRenderer,
      mode = 'cards',
      columns = [],
      primaryColumn = null,
      primaryHref = null,
      itemKey = null,
      itemSearchText = defaultCollectionSearchText,
      filterPlaceholder = `Filter ${String(title).toLowerCase()}`,
      emptyTitle = `No ${String(title).toLowerCase()} found`,
      emptyFilteredTitle = 'No matches',
      countLabel = 'items',
      classPrefix = 'service',
      panelClassName = '',
      filterText = '',
      onFilterTextChange = null,
      restoreFocus = false,
      selectionStart = null,
      selectionEnd = null,
      actions = [],
      selectedKeys = new Set(),
      onSelectedKeysChange = null,
      selectedActions = [],
      lastUpdatedLabel = '',
    } = options;
    const normalizedItems = Array.isArray(items) ? items : [];
    const normalizedFilter = String(filterText || '').trim().toLowerCase();
    const visibleItems = normalizedFilter
      ? normalizedItems.filter((item) => String(itemSearchText(item) || '').toLowerCase().includes(normalizedFilter))
      : normalizedItems;
    const panel = el('section', `${classPrefix}-collection collection-panel${panelClassName ? ` ${panelClassName}` : ''}`);
    const heading = el('div', `${classPrefix}-collection-heading collection-heading`);
    const headingTitle = document.createElement('h3');
    const count = el('span', 'count', visibleItems.length);
    headingTitle.textContent = title;
    heading.append(headingTitle, count);
    panel.append(heading);

    const toolbar = el('div', 'collection-toolbar');
    const filter = document.createElement('input');
    filter.className = 'collection-filter';
    filter.type = 'search';
    filter.placeholder = filterPlaceholder;
    filter.value = filterText;
    filter.setAttribute('aria-label', filterPlaceholder);
    filter.addEventListener('input', () => {
      if (onFilterTextChange) {
        onFilterTextChange(filter.value, {
          restoreFocus: true,
          selectionStart: filter.selectionStart,
          selectionEnd: filter.selectionEnd,
        });
      }
    });
    const summary = el(
      'span',
      'collection-count',
      `${visibleItems.length} of ${normalizedItems.length} ${countLabel}`,
    );
    const meta = el('div', 'collection-toolbar-meta');
    meta.append(summary);
    if (lastUpdatedLabel) {
      meta.append(el('span', 'collection-refreshed-at', lastUpdatedLabel));
    }
    toolbar.append(filter, meta, ...actions);
    panel.append(toolbar);

    const selectedSet = selectedKeys instanceof Set ? selectedKeys : new Set(selectedKeys || []);
    if (mode === 'table' && selectedSet.size) {
      const selectedBar = el('div', 'collection-selected-bar');
      selectedBar.append(el('strong', null, `${selectedSet.size} selected`));
      const clearSelected = button('Clear selection', 'collection-action-secondary', () => {
        selectedSet.clear();
        if (onSelectedKeysChange) {
          onSelectedKeysChange(new Set(selectedSet));
        }
      });
      selectedBar.append(clearSelected, ...selectedActions);
      panel.append(selectedBar);
    }

    const list = el('div', `${classPrefix}-collection-list collection-list${mode === 'table' ? ' collection-list-table' : ''}`);
    if (!normalizedItems.length) {
      list.append(el('p', 'muted empty-state', emptyTitle));
    } else if (!visibleItems.length) {
      list.append(el('p', 'muted empty-state', emptyFilteredTitle));
    } else if (mode === 'table') {
      list.append(renderResourceTable({
        columns,
        primaryColumn,
        primaryHref,
        itemKey,
        items: visibleItems,
        selectedKeys: selectedSet,
        onSelectedKeysChange,
      }));
    } else {
      visibleItems.forEach((item, index) => list.append(itemRenderer ? itemRenderer(item, index) : el('div', 'collection-item', valueText(item))));
    }
    panel.append(list);

    if (container) {
      container.textContent = '';
      container.append(panel);
    }

    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        filter.focus();
        if (selectionStart != null && selectionEnd != null) {
          filter.setSelectionRange(selectionStart, selectionEnd);
        }
      });
    }

    return panel;
  }

  function collectionItemKey(item, index, itemKey) {
    if (typeof itemKey === 'function') {
      return String(itemKey(item, index));
    }
    if (itemKey && item?.[itemKey] != null) {
      return String(item[itemKey]);
    }
    return String(
      item?.arn
      || item?.ARN
      || item?.url
      || item?.id
      || item?.name
      || item?.table_name
      || item?.ResourceArn
      || item?.ResourceARN
      || item?.QueueUrl
      || item?.TopicArn
      || item?.InstanceId
      || index
    );
  }

  function columnValue(item, column) {
    if (!column) {
      return '';
    }
    if (typeof column.value === 'function') {
      return column.value(item);
    }
    if (column.key) {
      return item?.[column.key];
    }
    return '';
  }

  function renderResourceTable(options = {}) {
    const {
      columns = [],
      primaryColumn = columns[0] || null,
      primaryHref = null,
      itemKey = null,
      items = [],
      selectedKeys = new Set(),
      onSelectedKeysChange = null,
    } = options;
    const effectivePrimaryColumn = primaryColumn || columns.find((column) => column.primary) || columns[0] || null;
    const tableWrap = el('div', 'collection-table-wrap');
    const table = document.createElement('table');
    table.className = 'collection-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const selectHead = document.createElement('th');
    selectHead.className = 'collection-table-select';
    const selectAll = document.createElement('input');
    selectAll.type = 'checkbox';
    selectAll.setAttribute('aria-label', 'Select all visible resources');
    selectAll.checked = Boolean(items.length) && items.every((item, index) => selectedKeys.has(collectionItemKey(item, index, itemKey)));
    selectAll.indeterminate = !selectAll.checked && items.some((item, index) => selectedKeys.has(collectionItemKey(item, index, itemKey)));
    selectAll.addEventListener('change', () => {
      const next = new Set(selectedKeys);
      items.forEach((item, index) => {
        const key = collectionItemKey(item, index, itemKey);
        if (selectAll.checked) {
          next.add(key);
        } else {
          next.delete(key);
        }
      });
      if (onSelectedKeysChange) {
        onSelectedKeysChange(next);
      }
    });
    selectHead.append(selectAll);
    headerRow.append(selectHead);
    columns.forEach((column) => {
      const th = document.createElement('th');
      th.textContent = column.label || column.key || '';
      headerRow.append(th);
    });
    thead.append(headerRow);

    const tbody = document.createElement('tbody');
    items.forEach((item, index) => {
      const rowKey = collectionItemKey(item, index, itemKey);
      const row = document.createElement('tr');
      if (selectedKeys.has(rowKey)) {
        row.className = 'collection-table-row-selected';
      }
      const selectCell = document.createElement('td');
      selectCell.className = 'collection-table-select';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedKeys.has(rowKey);
      checkbox.setAttribute('aria-label', `Select ${valueText(columnValue(item, effectivePrimaryColumn) || rowKey)}`);
      checkbox.addEventListener('change', () => {
        const next = new Set(selectedKeys);
        if (checkbox.checked) {
          next.add(rowKey);
        } else {
          next.delete(rowKey);
        }
        if (onSelectedKeysChange) {
          onSelectedKeysChange(next);
        }
      });
      selectCell.append(checkbox);
      row.append(selectCell);

      columns.forEach((column) => {
        const td = document.createElement('td');
        const value = columnValue(item, column);
        if (column === effectivePrimaryColumn || column.primary) {
          const href = typeof primaryHref === 'function' ? primaryHref(item) : primaryHref;
          const link = document.createElement('a');
          link.className = 'collection-primary-link';
          link.href = href || '#';
          link.textContent = valueText(value || rowKey);
          td.append(link);
        } else if (
          column.type === 'status' ||
          /^(status|state|alarm_state|execution_status|instance_state|certificate_status|table_status|vault_state|health)$/i.test(String(column.key || column.label || ''))
        ) {
          td.append(statusIndicator(value));
        } else {
          td.textContent = valueText(value);
        }
        row.append(td);
      });
      tbody.append(row);
    });

    table.append(thead, tbody);
    tableWrap.append(table);
    return tableWrap;
  }

  function button(label, className, onClick) {
    const node = el('button', className, label);
    node.type = 'button';
    if (onClick) {
      node.addEventListener('click', onClick);
    }
    return node;
  }

  function toolbar(leftItems, rightItems, classPrefix = 'service') {
    const bar = el('div', `${classPrefix}-toolbar`);
    const left = el('div', `${classPrefix}-toolbar-left`);
    const right = el('div', `${classPrefix}-toolbar-right`);
    leftItems.forEach((item) => left.append(item));
    rightItems.forEach((item) => right.append(item));
    bar.append(left, right);
    return bar;
  }

  function confirmAction(message) {
    return window.confirm(message);
  }

  function actionButtonClass(action, classPrefix) {
    if (action.safety === 'destructive' || action.kind === 'delete') {
      return `${classPrefix}-btn-danger`;
    }
    if (action.safety === 'safe' || action.kind === 'read') {
      return `${classPrefix}-btn-secondary`;
    }
    return null;
  }

  function renderActionButtons(actions, handlers = {}, options = {}) {
    const classPrefix = options.classPrefix || 'service';
    const row = el('div', options.className || `${classPrefix}-action-row`);
    const labels = options.labels || {};
    (actions || []).forEach((action) => {
      if (!action || !action.name || !action.label) {
        return;
      }
      const handler = handlers[action.name];
      if (!handler && !options.includeDisabled) {
        return;
      }
      const node = button(labels[action.name] || action.label, actionButtonClass(action, classPrefix), async (event) => {
        if (!handler) {
          return;
        }
        if (action.confirm && !confirmAction(action.confirm)) {
          return;
        }
        await handler(action, event);
      });
      node.dataset.actionName = action.name;
      node.dataset.actionKind = action.kind || '';
      node.dataset.actionSafety = action.safety || '';
      node.disabled = !handler;
      if (action.description) {
        node.title = action.description;
      }
      row.append(node);
    });
    return row;
  }

  async function loadServiceActions(serviceKey, fallbacks = []) {
    let actions = fallbacks;
    try {
      const payload = await apiJson('/api/services/');
      const service = (payload.services || []).find((item) => item.key === serviceKey);
      if (service?.actions?.length) {
        actions = service.actions;
      }
    } catch (_error) {
      actions = fallbacks;
    }

    const byName = new Map(actions.map((action) => [action.name, action]));
    return {
      all: actions,
      get(name) {
        return byName.get(name) || null;
      },
      select(names) {
        return names.map((name) => byName.get(name)).filter(Boolean);
      },
      renderButtons(names, handlers = {}, options = {}) {
        return renderActionButtons(this.select(names), handlers, options);
      },
    };
  }

  function openModal(title, bodyNode, confirmLabel, onConfirm, options = {}) {
    const classPrefix = options.classPrefix || 'service';
    const showToast = options.toast || ((message, isError) => toast(message, {
      classPrefix,
      type: isError ? 'error' : 'success',
    }));
    const overlay = el('div', `${classPrefix}-modal-overlay`);
    const modal = el('div', `${classPrefix}-modal`);
    modal.append(el('h3', null, title), bodyNode);
    const actions = el('div', `${classPrefix}-modal-actions`);
    const cancel = el('button', `${classPrefix}-btn-secondary`, 'Cancel');
    const confirm = el('button', null, confirmLabel || 'Confirm');
    const close = () => overlay.remove();
    cancel.addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close();
      }
    });
    confirm.addEventListener('click', async () => {
      confirm.disabled = true;
      try {
        await onConfirm(close);
      } catch (error) {
        showToast(error.message, true);
        confirm.disabled = false;
      }
    });
    actions.append(cancel, confirm);
    modal.append(actions);
    overlay.append(modal);
    document.body.append(overlay);
  }

  return {
    addField,
    apiJson,
    button,
    confirmAction,
    clearActivity,
    el,
    formatBytes,
    formatDate,
    getCsrfToken,
    displayValue,
    kvGrid,
    loadServiceActions,
    loadActivity,
    openModal,
    parsedJsonString,
    recordActivity,
    renderActivityPanel,
    renderCollection,
    renderActionButtons,
    renderDetailList,
    renderSummary,
    sectionIdForLabel,
    sectionSlug,
    statusIndicator,
    toast,
    toolbar,
    valueText,
  };
})();

window.ServiceConsole = ServiceConsole;
