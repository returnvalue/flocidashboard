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
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
  }

  function toast(message, isError = false, classPrefix = 'service') {
    const node = el('div', `${classPrefix}-toast${isError ? ` ${classPrefix}-toast-error` : ''}`, message);
    document.body.append(node);
    setTimeout(() => node.remove(), 3200);
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

  function renderSummary(summary, container, options = {}) {
    if (!container) {
      return;
    }
    const serviceKey = options.serviceKey || 'service';
    const targets = options.targets || {};
    container.textContent = '';
    Object.entries(summary || {}).forEach(([label, value]) => {
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

  function stringifyItem(item) {
    const compact = Object.fromEntries(
      Object.entries(item).filter(([, value]) => value !== null && value !== undefined && value !== ''),
    );
    return JSON.stringify(compact, null, 2);
  }

  function valueText(value) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return 'None';
      }
      return value.map((item) => (typeof item === 'string' ? item : stringifyItem(item))).join('\n');
    }
    if (value && typeof value === 'object') {
      return stringifyItem(value);
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

  function renderDetailList(serviceKey, title, items, fields) {
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
      section.append(el('p', 'muted', 'None found.'));
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

  function openModal(title, bodyNode, confirmLabel, onConfirm, options = {}) {
    const classPrefix = options.classPrefix || 'service';
    const showToast = options.toast || ((message, isError) => toast(message, isError, classPrefix));
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
    el,
    formatBytes,
    formatDate,
    getCsrfToken,
    openModal,
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
