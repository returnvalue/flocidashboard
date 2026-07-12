/* global ServiceConsole */

const S3Console = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('s3-console-root');
  const breadcrumbsEl = document.getElementById('s3-breadcrumbs');
  const loadedAtEl = document.getElementById('s3-loaded-at');
  const summaryEl = document.getElementById('s3-summary');

  const state = {
    buckets: [],
    bucketDetail: null,
    objects: null,
    selected: new Set(),
    showVersions: false,
    continuationToken: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const formatDate = consoleUi.formatDate;
  const formatBytes = consoleUi.formatBytes;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 's3',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 's3');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 's3',
      toast,
    });

  function getRoute() {
    const params = new URLSearchParams(window.location.search);
    return {
      bucket: params.get('bucket') || '',
      prefix: params.get('prefix') || '',
      tab: params.get('tab') || 'objects',
      key: params.get('key') || '',
      versionId: params.get('versionId') || '',
    };
  }

  function navigate(updates, replace = false) {
    const route = { ...getRoute(), ...updates };
    const params = new URLSearchParams();
    if (route.bucket) {
      params.set('bucket', route.bucket);
    }
    if (route.prefix) {
      params.set('prefix', route.prefix);
    }
    if (route.bucket && route.tab && route.tab !== 'objects') {
      params.set('tab', route.tab);
    }
    if (route.key) {
      params.set('key', route.key);
    }
    if (route.versionId) {
      params.set('versionId', route.versionId);
    }
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
    if (replace) {
      window.history.replaceState({}, '', url);
    } else {
      window.history.pushState({}, '', url);
    }
    clearSelection();
    state.continuationToken = null;
    render();
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 's3',
      targets: {
        buckets: 'Buckets',
        objects: 'Object operations',
        total_bytes: 'Buckets',
        versioned_buckets: 'Buckets',
      },
    });
    summaryEl?.querySelectorAll('a').forEach((card) => {
      card.href = '#s3-console-root';
      const label = card.querySelector('span')?.textContent;
      if (label === 'total bytes') {
        const value = card.querySelector('strong');
        if (value) {
          value.textContent = formatBytes(summary.total_bytes || 0);
        }
      }
    });
  }

  function selectionKey(item) {
    return `${item.key}::${item.version_id || ''}`;
  }

  function clearSelection() {
    state.selected.clear();
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const route = getRoute();
    const addSep = () => breadcrumbsEl.append(el('span', null, '/'));
    const addBtn = (label, onClick) => {
      const btn = el('button', null, label);
      btn.addEventListener('click', onClick);
      breadcrumbsEl.append(btn);
    };

    addBtn('Amazon S3', () => navigate({ bucket: '', prefix: '', tab: 'objects', key: '', versionId: '' }));
    if (!route.bucket) {
      return;
    }
    addSep();
    addBtn(route.bucket, () => navigate({ prefix: '', tab: 'objects', key: '', versionId: '' }));
    if (route.prefix) {
      const parts = route.prefix.split('/').filter(Boolean);
      let built = '';
      parts.forEach((part, index) => {
        built += `${part}/`;
        addSep();
        if (index === parts.length - 1) {
          breadcrumbsEl.append(el('span', null, part));
        } else {
          addBtn(part, () => navigate({ prefix: built, key: '', versionId: '' }));
        }
      });
    }
    if (route.key) {
      addSep();
      breadcrumbsEl.append(el('span', null, route.key.split('/').pop()));
    }
  }

  function showCreateBucketModal() {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.required = true;
    nameInput.minLength = 3;
    nameInput.maxLength = 63;
    nameInput.pattern = '[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]';
    nameInput.placeholder = 'my-bucket';
    const regionInput = document.createElement('input');
    regionInput.placeholder = 'us-east-1';
    form.append(el('label', null, 'Bucket name'), nameInput, el('label', null, 'Region (optional)'), regionInput);
    openModal('Create bucket', form, 'Create', async (close) => {
      const payload = { name: nameInput.value.trim() };
      if (regionInput.value.trim()) {
        payload.region = regionInput.value.trim();
      }
      await apiJson('/api/s3/buckets/', { method: 'POST', body: JSON.stringify(payload) });
      close();
      toast('Bucket created');
      await refresh();
    });
  }

  function showUploadModal(bucket) {
    const route = getRoute();
    const form = el('div');
    const keyInput = document.createElement('input');
    keyInput.placeholder = route.prefix ? `${route.prefix}filename.txt` : 'filename.txt';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    const zone = el('div', 's3-upload-zone', 'Drag and drop files here');
    zone.append(fileInput);
    ['dragenter', 'dragover'].forEach((name) => {
      zone.addEventListener(name, (e) => {
        e.preventDefault();
        zone.classList.add('s3-drag-over');
      });
    });
    ['dragleave', 'drop'].forEach((name) => {
      zone.addEventListener(name, (e) => {
        e.preventDefault();
        zone.classList.remove('s3-drag-over');
      });
    });
    zone.addEventListener('drop', (e) => {
      fileInput.files = e.dataTransfer.files;
    });
    form.append(el('label', null, 'Object key prefix (optional)'), keyInput, zone);
    openModal('Upload objects', form, 'Upload', async (close) => {
      const files = fileInput.files;
      if (!files.length) {
        throw new Error('Select at least one file');
      }
      const prefix = keyInput.value.trim() || route.prefix || '';
      for (const file of files) {
        const key = prefix ? `${prefix.replace(/\/?$/, '/')}${file.name}` : file.name;
        const fd = new FormData();
        fd.append('key', key);
        fd.append('file', file);
        await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/objects/`, {
          method: 'POST',
          body: fd,
        });
      }
      close();
      toast('Upload complete');
      await loadObjects(bucket);
      render();
    });
  }

  function showCreateFolderModal(bucket) {
    const route = getRoute();
    const input = document.createElement('input');
    input.placeholder = 'newfolder';
    const form = el('div');
    form.append(el('label', null, 'Folder name'), input);
    openModal('Create folder', form, 'Create', async (close) => {
      let folder = input.value.trim();
      if (!folder) {
        throw new Error('Folder name is required');
      }
      const base = route.prefix || '';
      folder = base ? `${base.replace(/\/?$/, '/')}${folder}` : folder;
      await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/folders/`, {
        method: 'PUT',
        body: JSON.stringify({ folder }),
      });
      close();
      toast('Folder created');
      await loadObjects(bucket);
      render();
    });
  }

  function showCopyModal(bucket, items, options = {}) {
    const destKey = document.createElement('input');
    const destBucket = document.createElement('input');
    destBucket.value = bucket;
    const form = el('div');
    form.append(
      el('label', null, 'Destination bucket'),
      destBucket,
      el('label', null, 'Destination key'),
      destKey,
    );
    if (items.length === 1) {
      destKey.value = items[0].key;
    }
    openModal('Copy objects', form, 'Copy', async (close) => {
      for (const item of items) {
        await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/objects/copy/`, {
          method: 'POST',
          body: JSON.stringify({
            source_key: item.key,
            dest_key: destKey.value.trim() || item.key,
            dest_bucket: destBucket.value.trim() || bucket,
            source_version_id: item.version_id || undefined,
          }),
        });
      }
      close();
      toast('Copy complete');
      clearSelection();
      if (options.afterComplete) {
        await options.afterComplete();
        return;
      }
      await loadObjects(bucket);
      render();
    });
  }

  async function deleteObjects(bucket, items, options = {}) {
    if (!items.length) {
      return;
    }
    openModal('Delete objects', el('p', null, `Delete ${items.length} object(s)?`), 'Delete', async (close) => {
      await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/objects/`, {
        method: 'DELETE',
        body: JSON.stringify({
          keys: items.map((item) => ({
            key: item.key,
            version_id: item.version_id || undefined,
          })),
        }),
      });
      close();
      toast('Deleted');
      clearSelection();
      if (options.afterComplete) {
        await options.afterComplete();
        return;
      }
      await loadObjects(bucket);
      render();
    });
  }

  async function deleteSelected(bucket) {
    await deleteObjects(bucket, getSelectedItems());
  }

  function getSelectedItems() {
    if (!state.objects) {
      return [];
    }
    const all = [...(state.objects.folders || []), ...(state.objects.objects || [])];
    return all.filter((item) => state.selected.has(selectionKey(item)));
  }

  function buildTable(columns, rows, onRowClick, options = {}) {
    const wrap = el('div', 's3-table-wrap');
    const table = el('table', 's3-table');
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    columns.forEach((col) => {
      const th = document.createElement('th');
      th.textContent = col.label;
      if (col.className) {
        th.className = col.className;
      }
      if (col.selectAll) {
        th.textContent = '';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.setAttribute('aria-label', col.selectAllLabel || 'Select all visible resources');
        cb.checked = Boolean(rows.length) && rows.every((row) => row._selected);
        cb.indeterminate = !cb.checked && rows.some((row) => row._selected);
        cb.addEventListener('change', () => col.onSelectAll?.(cb.checked, rows));
        th.append(cb);
      }
      headRow.append(th);
    });
    thead.append(headRow);
    const tbody = document.createElement('tbody');
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      if (row._selected) {
        tr.classList.add('s3-row-selected');
      }
      columns.forEach((col) => {
        const td = document.createElement('td');
        if (col.className) {
          td.className = col.className;
        }
        const content = col.render(row);
        if (content instanceof Node) {
          td.append(content);
        } else {
          td.textContent = content ?? '—';
        }
        if (col.primary) {
          td.classList.add('s3-primary-cell');
        }
        tr.append(td);
      });
      if (onRowClick) {
        tr.addEventListener('click', (event) => {
          if (event.target.closest('input, button, a')) {
            return;
          }
          onRowClick(row);
        });
      }
      tbody.append(tr);
    });
    table.append(thead, tbody);
    if (options.caption) {
      const caption = document.createElement('caption');
      caption.textContent = options.caption;
      table.prepend(caption);
    }
    wrap.append(table);
    return wrap;
  }

  function primaryLink(label, onClick) {
    const link = document.createElement('a');
    link.href = '#';
    link.className = 's3-primary-link';
    link.textContent = label || 'Unnamed';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return link;
  }

  function selectedActionBar(count, actions = []) {
    if (!count) {
      return null;
    }
    const bar = el('div', 's3-selected-action-bar');
    bar.append(el('strong', null, `${count} selected`), ...actions);
    return bar;
  }

  function renderBucketsView() {
    const panel = el('div', 's3-panel');
    panel.append(el('div', 's3-panel-heading', 'General purpose buckets'));
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Find buckets by name';
    const bar = toolbar(
      [search, el('span', 's3-toolbar-note', `${state.buckets.length} buckets`)],
      [el('span', 's3-toolbar-note', `Last refreshed ${new Date().toLocaleTimeString()}`), btn('Create bucket', null, showCreateBucketModal)],
    );
    panel.append(bar);

    const renderTable = (filter) => {
      const existing = panel.querySelector('.s3-table-wrap');
      if (existing) {
        existing.remove();
      }
      panel.querySelectorAll('.s3-empty').forEach((node) => node.remove());
      const buckets = state.buckets.filter((b) =>
        !filter || (b.name || '').toLowerCase().includes(filter.toLowerCase()),
      );
      if (!buckets.length) {
        panel.append(el('div', 's3-empty', 'No buckets'));
        return;
      }
      const table = buildTable(
        [
          {
            label: 'Bucket name',
            primary: true,
            render: (r) => primaryLink(r.name, () => navigate({ bucket: r.name, prefix: '', tab: 'objects', key: '', versionId: '' })),
          },
          { label: 'Region', render: (r) => r.region || '—' },
          { label: 'Creation date', render: (r) => formatDate(r.created) },
          {
            label: 'Actions',
            render: (r) => {
              const del = btn('Delete', 's3-btn-danger', (e) => {
                e.stopPropagation();
                openModal(
                  'Delete bucket',
                  el('p', null, `Delete bucket "${r.name}"? It must be empty.`),
                  'Delete',
                  async (close) => {
                    try {
                      await apiJson(`/api/s3/buckets/${encodeURIComponent(r.name)}/`, { method: 'DELETE' });
                    } catch (error) {
                      if (error.message.includes('BucketNotEmpty') || error.message.includes('not empty')) {
                        openModal(
                          'Empty bucket first?',
                          el('p', null, 'Bucket is not empty. Empty all objects and retry?'),
                          'Empty and delete',
                          async (closeEmpty) => {
                            await apiJson(`/api/s3/buckets/${encodeURIComponent(r.name)}/empty/`, { method: 'POST' });
                            await apiJson(`/api/s3/buckets/${encodeURIComponent(r.name)}/`, { method: 'DELETE' });
                            closeEmpty();
                            close();
                            toast('Bucket deleted');
                            await refresh();
                          },
                        );
                        return;
                      }
                      throw error;
                    }
                    close();
                    toast('Bucket deleted');
                    await refresh();
                  },
                );
              });
              return del;
            },
          },
        ],
        buckets,
        (row) => navigate({ bucket: row.name, prefix: '', tab: 'objects', key: '', versionId: '' }),
      );
      panel.append(table);
    };

    search.addEventListener('input', () => renderTable(search.value.trim()));
    renderTable('');
    return panel;
  }

  function renderTabs(route) {
    const tabs = el('div', 's3-tabs');
    const defs = [
      { id: 'objects', label: 'Objects' },
      { id: 'properties', label: 'Properties' },
      { id: 'permissions', label: 'Permissions' },
      { id: 'management', label: 'Management' },
    ];
    defs.forEach((tab) => {
      const button = btn(tab.label, `s3-tab${route.tab === tab.id ? ' s3-tab-active' : ''}`, () => {
        navigate({ tab: tab.id, key: '', versionId: '' });
      });
      tabs.append(button);
    });
    return tabs;
  }

  async function loadObjects(bucket, token = null) {
    const route = getRoute();
    const params = new URLSearchParams({
      prefix: route.prefix,
      delimiter: '/',
      max_keys: '100',
    });
    if (token) {
      params.set('continuation_token', token);
    }
    if (state.showVersions) {
      params.set('versions', 'true');
    }
    state.objects = await apiJson(
      `/api/s3/buckets/${encodeURIComponent(bucket)}/objects/?${params}`,
    );
    state.continuationToken = state.objects.next_continuation_token || null;
  }

  function renderObjectsView(bucket) {
    const route = getRoute();
    const container = el('div');

    const versioningEnabled =
      state.bucketDetail?.versioning?.Status === 'Enabled';
    const versionToggle = el('label', 's3-toggle');
    const versionCheck = document.createElement('input');
    versionCheck.type = 'checkbox';
    versionCheck.checked = state.showVersions;
    versionCheck.disabled = !versioningEnabled;
    versionToggle.append(versionCheck, document.createTextNode(' Show versions'));
    versionCheck.addEventListener('change', async () => {
      state.showVersions = versionCheck.checked;
      state.continuationToken = null;
      await loadObjects(bucket);
      render();
    });

    const selected = getSelectedItems();
    const filesOnly = selected.filter((i) => i.type === 'file' || i.type === 'delete_marker');
    const downloadButton = btn('Download', 's3-btn-secondary', () => {
      if (filesOnly.length !== 1) {
        toast('Select exactly one file to download', true);
        return;
      }
      const item = filesOnly[0];
      const params = new URLSearchParams({ key: item.key });
      if (item.version_id) {
        params.set('versionId', item.version_id);
      }
      window.location.href = `/api/s3/buckets/${encodeURIComponent(bucket)}/objects/download/?${params}`;
    });
    downloadButton.disabled = filesOnly.length !== 1;
    const copyButton = btn('Copy', 's3-btn-secondary', () => {
      if (!filesOnly.length) {
        toast('Select objects to copy', true);
        return;
      }
      showCopyModal(bucket, filesOnly);
    });
    copyButton.disabled = filesOnly.length === 0;
    const deleteButton = btn('Delete', 's3-btn-danger', () => deleteSelected(bucket));
    deleteButton.disabled = selected.length === 0;

    const bar = toolbar(
      [versionToggle, el('span', 's3-toolbar-note', `${(state.objects?.folders || []).length + (state.objects?.objects || []).length} resources`)],
      [
        el('span', 's3-toolbar-note', `Last refreshed ${new Date().toLocaleTimeString()}`),
        btn('Upload', null, () => showUploadModal(bucket)),
        btn('Create folder', 's3-btn-secondary', () => showCreateFolderModal(bucket)),
      ],
    );
    container.append(bar);
    const actionBar = selectedActionBar(selected.length, [downloadButton, copyButton, deleteButton]);
    if (actionBar) {
      container.append(actionBar);
    }

    const panel = el('div', 's3-panel');
    const rows = [];
    (state.objects?.folders || []).forEach((folder) => {
      rows.push({
        ...folder,
        _type: 'folder',
        key: folder.prefix,
        name: folder.name || folder.prefix,
        size: null,
        last_modified: null,
        storage_class: null,
        version_id: null,
        _selected: state.selected.has(selectionKey({ key: folder.prefix, version_id: '' })),
      });
    });
    (state.objects?.objects || []).forEach((obj) => {
      rows.push({
        ...obj,
        _type: obj.type || 'file',
        _selected: state.selected.has(selectionKey(obj)),
      });
    });

    if (!rows.length) {
      panel.append(el('div', 's3-empty', 'No objects'));
    } else {
      const cols = [
        {
          label: '',
          className: 's3-col-check',
          selectAll: true,
          onSelectAll: (checked, visibleRows) => {
            visibleRows.forEach((row) => {
              const key = selectionKey(row);
              if (checked) {
                state.selected.add(key);
              } else {
                state.selected.delete(key);
              }
            });
            render();
          },
          render: (row) => {
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = row._selected;
            cb.addEventListener('click', (e) => e.stopPropagation());
            cb.addEventListener('change', () => {
              const key = selectionKey(row);
              if (cb.checked) {
                state.selected.add(key);
              } else {
                state.selected.delete(key);
              }
              render();
            });
            return cb;
          },
        },
        {
          label: 'Name',
          primary: true,
          render: (row) => {
            const cell = el('div', 's3-name-cell');
            cell.append(
              el('span', row._type === 'folder' ? 's3-icon-folder' : 's3-icon-file'),
              primaryLink(row.name || row.key, () => {
                if (row._type === 'folder') {
                  navigate({ prefix: row.prefix || row.key, key: '', versionId: '' });
                  return;
                }
                navigate({ key: row.key, versionId: row.version_id || '' });
              }),
            );
            return cell;
          },
        },
        { label: 'Key', render: (r) => r.key || r.prefix || '—' },
        { label: 'Type', render: (r) => (r._type === 'folder' ? 'Folder' : 'File') },
        { label: 'Last modified', render: (r) => formatDate(r.last_modified) },
        { label: 'Size', render: (r) => formatBytes(r.size) },
        { label: 'Storage class', render: (r) => r.storage_class || '—' },
        { label: 'Status', render: (r) => r._type === 'delete_marker' ? 'Delete marker' : 'Available' },
      ];
      if (state.showVersions) {
        cols.push({ label: 'Version ID', render: (r) => r.version_id || '—' });
      }
      panel.append(
        buildTable(cols, rows, (row) => {
          if (row._type === 'folder') {
            navigate({ prefix: row.prefix || row.key, key: '', versionId: '' });
            return;
          }
          navigate({ key: row.key, versionId: row.version_id || '' });
        }),
      );
    }

    if (state.objects?.is_truncated || state.continuationToken) {
      const pag = el('div', 's3-pagination');
      if (state.continuationToken) {
        pag.append(
          btn('Previous page', 's3-btn-secondary', async () => {
            state.continuationToken = null;
            await loadObjects(bucket);
            render();
          }),
        );
      }
      if (state.objects?.is_truncated) {
        pag.append(
          btn('Next page', null, async () => {
            await loadObjects(bucket, state.continuationToken);
            render();
          }),
        );
      }
      panel.append(pag);
    }

    container.append(panel);
    return container;
  }

  function settingsTextarea(label, value, onSave, onDelete = null) {
    const section = el('div', 's3-settings-section');
    section.append(el('h4', null, label));
    const textarea = document.createElement('textarea');
    textarea.value = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const actions = el('div', 's3-settings-actions');
    actions.append(
      btn('Save', null, async () => {
        try {
          const parsed = JSON.parse(textarea.value);
          await onSave(parsed);
          toast('Saved');
          state.bucketDetail = await apiJson(`/api/s3/buckets/${encodeURIComponent(getRoute().bucket)}/`);
          render();
        } catch (error) {
          toast(error.message, true);
        }
      }),
    );
    if (onDelete) {
      actions.append(btn('Delete', 's3-btn-danger', async () => {
        try {
          await onDelete();
          toast('Deleted');
          state.bucketDetail = await apiJson(`/api/s3/buckets/${encodeURIComponent(getRoute().bucket)}/`);
          render();
        } catch (error) {
          toast(error.message, true);
        }
      }));
    }
    section.append(textarea, actions);
    return section;
  }

  function renderPropertiesTab(bucket) {
    const detail = state.bucketDetail || {};
    const panel = el('div', 's3-panel');
    const info = el('div', 's3-settings-section');
    info.innerHTML = `
      <p><strong>ARN:</strong> ${detail.arn || '—'}</p>
      <p><strong>Region:</strong> ${detail.region || '—'}</p>
      <p><strong>Created:</strong> ${formatDate(detail.created)}</p>
      <p><strong>URL:</strong> ${detail.path_style_url || '—'}</p>
    `;
    panel.append(info);

    const versionSection = el('div', 's3-settings-section');
    versionSection.append(el('h4', null, 'Bucket versioning'));
    const statusSelect = document.createElement('select');
    ['Suspended', 'Enabled'].forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      if (detail.versioning?.Status === s) {
        opt.selected = true;
      }
      statusSelect.append(opt);
    });
    const versionRow = el('div', 's3-settings-row');
    versionRow.append(
      statusSelect,
      btn('Apply', null, async () => {
        await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/versioning/`, {
          method: 'PUT',
          body: JSON.stringify({ status: statusSelect.value }),
        });
        toast('Versioning updated');
        state.bucketDetail = await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/`);
        render();
      }),
    );
    versionSection.append(versionRow);
    panel.append(versionSection);
    return panel;
  }

  function renderPermissionsTab(bucket) {
    const panel = el('div', 's3-panel');
    panel.append(el('p', 's3-badge', 'Policy is stored in Floci but not enforced on access.'));
    panel.append(
      settingsTextarea('Bucket policy (JSON)', state.bucketDetail?.policy || {}, async (policy) => {
        await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/policy/`, {
          method: 'PUT',
          body: JSON.stringify({ policy }),
        });
      }),
    );
    panel.append(
      settingsTextarea(
        'Block public access',
        state.bucketDetail?.public_access_block || {},
        async (configuration) => {
          await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/public-access-block/`, {
            method: 'PUT',
            body: JSON.stringify({ configuration }),
          });
        },
      ),
    );
    return panel;
  }

  function renderManagementTab(bucket) {
    const panel = el('div', 's3-panel');
    panel.append(el('p', 's3-badge', 'Lifecycle rules are stored but not executed automatically in Floci.'));
    panel.append(
      settingsTextarea('CORS rules', state.bucketDetail?.cors || [], async (rules) => {
        await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/cors/`, {
          method: 'PUT',
          body: JSON.stringify({ rules }),
        });
      }),
    );
    panel.append(
      settingsTextarea('Lifecycle rules', state.bucketDetail?.lifecycle || [], async (rules) => {
        await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/lifecycle/`, {
          method: 'PUT',
          body: JSON.stringify({ rules }),
        });
      }),
    );
    panel.append(
      settingsTextarea('Default encryption', state.bucketDetail?.encryption || {}, async (configuration) => {
        await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/encryption/`, {
          method: 'PUT',
          body: JSON.stringify({ configuration }),
        });
      }),
    );
    panel.append(
      settingsTextarea('Notifications', state.bucketDetail?.notification || {}, async (config) => {
        await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/notifications/`, {
          method: 'PUT',
          body: JSON.stringify(config),
        });
      }),
    );
    panel.append(
      settingsTextarea(
        'Website hosting',
        state.bucketDetail?.website || {
          IndexDocument: { Suffix: 'index.html' },
          ErrorDocument: { Key: 'error.html' },
        },
        async (configuration) => {
          await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/website/`, {
            method: 'PUT',
            body: JSON.stringify({ configuration }),
          });
        },
        async () => {
          await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/website/`, {
            method: 'DELETE',
            body: JSON.stringify({}),
          });
        },
      ),
    );
    panel.append(
      settingsTextarea('Bucket tags', state.bucketDetail?.tagging || [], async (tags) => {
        await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/tags/`, {
          method: 'PUT',
          body: JSON.stringify({ tags }),
        });
      }),
    );
    const disabled = el('div', 's3-settings-section');
    disabled.append(
      el('h4', null, 'Not available in Floci'),
      el('p', null, 'Replication, inventory, and metrics configurations.'),
    );
    panel.append(disabled);
    return panel;
  }

  async function openObjectDrawer(bucket, key, versionId) {
    const params = new URLSearchParams({ key });
    if (versionId) {
      params.set('versionId', versionId);
    }
    const head = await apiJson(
      `/api/s3/buckets/${encodeURIComponent(bucket)}/objects/head/?${params}`,
    );
    let tags = [];
    try {
      const tagData = await apiJson(
        `/api/s3/buckets/${encodeURIComponent(bucket)}/objects/tags/?${params}`,
      );
      tags = tagData.tags || [];
    } catch {
      tags = [];
    }

    const overlay = el('div', 's3-drawer-overlay');
    const drawer = el('div', 's3-drawer');
    const closeDrawer = () => {
      overlay.remove();
      drawer.remove();
      navigate({ key: '', versionId: '' }, true);
    };
    const closeBtn = btn('×', 's3-drawer-close s3-btn-secondary', closeDrawer);
    drawer.append(closeBtn, el('h3', null, key.split('/').pop()));

    const meta = el('dl');
    [
      ['Key', key],
      ['Size', formatBytes(head.content_length)],
      ['Last modified', formatDate(head.last_modified)],
      ['ETag', head.etag || '—'],
      ['Storage class', head.storage_class || '—'],
      ['Content type', head.content_type || '—'],
      ['User metadata', Object.keys(head.metadata || {}).length ? JSON.stringify(head.metadata) : '—'],
      ['Version ID', head.versioning || versionId || '—'],
    ].forEach(([label, value]) => {
      const row = el('div');
      row.innerHTML = `<dt>${label}</dt><dd>${value}</dd>`;
      meta.append(row);
    });
    drawer.append(meta);

    drawer.append(el('h4', null, 'Tags (JSON array)'));
    const tagArea = document.createElement('textarea');
    tagArea.value = JSON.stringify(tags, null, 2);
    drawer.append(tagArea);
    const actions = el('div', 's3-drawer-actions');
    const drawerItem = { key, version_id: versionId || undefined, type: 'file' };
    actions.append(
      btn('Save tags', null, async () => {
        const parsed = JSON.parse(tagArea.value);
        await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/objects/tags/`, {
          method: 'PUT',
          body: JSON.stringify({ key, tags: parsed, version_id: versionId || undefined }),
        });
        toast('Tags saved');
      }),
    );
    actions.append(
      btn('Download', null, () => {
        window.location.href = `/api/s3/buckets/${encodeURIComponent(bucket)}/objects/download/?${params}`;
      }),
    );
    actions.append(
      btn('Copy object', 's3-btn-secondary', () => {
        showCopyModal(bucket, [drawerItem], { afterComplete: closeDrawer });
      }),
    );
    actions.append(
      btn('Copy presigned URL', 's3-btn-secondary', async () => {
        const data = await apiJson(`/api/s3/buckets/${encodeURIComponent(bucket)}/objects/presign/`, {
          method: 'POST',
          body: JSON.stringify({ key, version_id: versionId || undefined, expires_in: 3600 }),
        });
        await navigator.clipboard.writeText(data.url);
        toast('URL copied to clipboard');
      }),
    );
    actions.append(
      btn('Delete object', 's3-btn-danger', () => {
        deleteObjects(bucket, [drawerItem], { afterComplete: closeDrawer });
      }),
    );
    drawer.append(actions);

    overlay.addEventListener('click', closeDrawer);
    drawer.addEventListener('click', (e) => e.stopPropagation());
    document.body.append(overlay, drawer);
  }

  async function renderBucketView(bucket) {
    const route = getRoute();
    const container = el('div');
    container.append(renderTabs(route));

    if (route.tab === 'objects') {
      container.append(renderObjectsView(bucket));
    } else if (route.tab === 'properties') {
      container.append(renderPropertiesTab(bucket));
    } else if (route.tab === 'permissions') {
      container.append(renderPermissionsTab(bucket));
    } else if (route.tab === 'management') {
      container.append(renderManagementTab(bucket));
    }

    return container;
  }

  async function render() {
    if (!root) {
      return;
    }
    renderBreadcrumbs();
    root.textContent = '';
    root.append(el('div', 's3-empty', 'Loading...'));

    const route = getRoute();
    try {
      if (!route.bucket) {
        root.textContent = '';
        root.append(renderBucketsView());
      } else {
        if (!state.bucketDetail || state.bucketDetail.name !== route.bucket) {
          state.bucketDetail = await apiJson(`/api/s3/buckets/${encodeURIComponent(route.bucket)}/`);
        }
        if (route.tab === 'objects' || !route.tab) {
          await loadObjects(route.bucket, state.continuationToken);
        }
        root.textContent = '';
        root.append(await renderBucketView(route.bucket));
        if (route.key) {
          await openObjectDrawer(route.bucket, route.key, route.versionId);
        }
      }
      if (loadedAtEl) {
        loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
      }
    } catch (error) {
      root.textContent = '';
      root.append(el('div', 's3-empty', error.message));
      toast(error.message, true);
    }
  }

  async function refresh() {
    const route = getRoute();
    const [bucketData, inventoryData] = await Promise.all([
      apiJson('/api/s3/buckets/'),
      apiJson('/api/s3/'),
    ]);
    state.buckets = bucketData.buckets || [];
    renderSummary(inventoryData.summary || {});
    if (route.bucket) {
      state.bucketDetail = await apiJson(`/api/s3/buckets/${encodeURIComponent(route.bucket)}/`);
      if (route.tab === 'objects' || !route.tab) {
        await loadObjects(route.bucket);
      }
    }
    await render();
  }

  function init() {
    if (!root) {
      return;
    }
    window.addEventListener('popstate', () => {
      clearSelection();
      state.continuationToken = null;
      render();
    });
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.S3Console = S3Console;

if (document.getElementById('s3-console-root')) {
  S3Console.init();
}
