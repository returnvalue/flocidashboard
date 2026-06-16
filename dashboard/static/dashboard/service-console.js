const ServiceConsole = (() => {
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

    if (entries.length === 0) {
      container.append(el('div', 'summary-empty', 'No summary metrics yet.'));
      return;
    }

    entries.forEach(([label, value]) => {
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
      container.append(card);
    });
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
    section.className = 'iam-panel';
    section.id = sectionIdForLabel(serviceKey, title);
    const normalizedItems = Array.isArray(items) ? items : (items ? [{ name: 'Response', details: items }] : []);

    const heading = el('div', 'card-heading');
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
      card.className = 'iam-item';

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
    el,
    formatBytes,
    formatDate,
    getCsrfToken,
    displayValue,
    loadServiceActions,
    openModal,
    parsedJsonString,
    renderActionButtons,
    renderDetailList,
    renderSummary,
    sectionIdForLabel,
    sectionSlug,
    toast,
    toolbar,
    valueText,
  };
})();

window.ServiceConsole = ServiceConsole;
