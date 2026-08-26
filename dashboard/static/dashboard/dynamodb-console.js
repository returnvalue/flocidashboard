/* global ServiceConsole */

const DynamoDBConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('dynamodb-console-root');
  const breadcrumbsEl = document.getElementById('dynamodb-breadcrumbs');
  const summaryEl = document.getElementById('dynamodb-summary');
  const loadedAtEl = document.getElementById('dynamodb-loaded-at');

  const state = {
    inventory: null,
    selectedTableName: '',
    selectedItemIndex: 0,
    scanResult: null,
    partiqlResult: null,
    lastQueryMode: 'scan',
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'dynamodb',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'dynamodb');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'dynamodb',
      toast,
    });

  function tables() {
    return state.inventory?.tables || [];
  }

  function selectedTable() {
    return tables().find((table) => table.name === state.selectedTableName) || tables()[0] || null;
  }

  function selectedItems() {
    return state.scanResult?.items || selectedTable()?.scan_preview?.items || [];
  }

  function selectedItem() {
    return selectedItems()[state.selectedItemIndex] || selectedItems()[0] || null;
  }

  function getKeySchema(table) {
    const pkDef = (table?.key_schema || []).find((k) => k.KeyType === 'HASH') || { AttributeName: 'id' };
    const skDef = (table?.key_schema || []).find((k) => k.KeyType === 'RANGE');
    return { pk: pkDef.AttributeName, sk: skDef?.AttributeName || null };
  }

  function extractKey(table, item) {
    if (!table || !item) return null;
    const { pk, sk } = getKeySchema(table);
    const key = {};
    if (pk in item) key[pk] = item[pk];
    if (sk && sk in item) key[sk] = item[sk];
    return Object.keys(key).length ? key : null;
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'Amazon DynamoDB');
    home.addEventListener('click', () => {
      state.selectedTableName = '';
      state.selectedItemIndex = 0;
      render();
    });
    breadcrumbsEl.append(home);
    const table = selectedTable();
    if (table) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, table.name));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'dynamodb',
      targets: {
        tables: 'Tables',
        items: 'Tables',
        global_secondary_indexes: 'Tables',
        streams: 'Streams',
        ttl_enabled: 'Tables',
      },
    });
  }

  async function scanTable(table, options = {}) {
    const payload = {
      limit: options.limit || 25,
      exclusive_start_key: options.exclusive_start_key || null,
      filter_expression: options.filter_expression || null,
      expression_attribute_values: options.expression_attribute_values || null,
      index_name: options.index_name || null,
    };
    const data = await apiJson(`/api/dynamodb/tables/${encodeURIComponent(table.name)}/scan/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.scanResult = data;
    state.partiqlResult = null;
    state.lastQueryMode = 'scan';
    state.selectedItemIndex = 0;
    toast(`Scanned ${data.count || 0} item(s)`);
    render();
  }

  async function queryTable(table, options = {}) {
    const payload = {
      key_condition_expression: options.key_condition_expression,
      expression_attribute_values: options.expression_attribute_values,
      expression_attribute_names: options.expression_attribute_names || null,
      filter_expression: options.filter_expression || null,
      index_name: options.index_name || null,
      limit: options.limit || 25,
      scan_index_forward: options.scan_index_forward ?? true,
      exclusive_start_key: options.exclusive_start_key || null,
    };
    const data = await apiJson(`/api/dynamodb/tables/${encodeURIComponent(table.name)}/query/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.scanResult = data;
    state.partiqlResult = null;
    state.lastQueryMode = 'query';
    state.selectedItemIndex = 0;
    toast(`Query returned ${data.count || 0} item(s)`);
    render();
  }

  function showQueryScanModal(table) {
    const form = el('div', 'dynamodb-form');
    const modeSelect = document.createElement('select');
    [['scan', 'Scan (Entire Table / Index)'], ['query', 'Query (Partition Key Condition)']].forEach(([val, label]) => {
      const opt = el('option', null, label);
      opt.value = val;
      modeSelect.append(opt);
    });
    modeSelect.value = state.lastQueryMode || 'scan';

    const indexSelect = document.createElement('select');
    const baseOpt = el('option', null, 'Table Base Primary Index');
    baseOpt.value = '';
    indexSelect.append(baseOpt);
    (table.global_secondary_indexes || []).forEach((gsi) => {
      const opt = el('option', null, `GSI: ${gsi.IndexName}`);
      opt.value = gsi.IndexName;
      indexSelect.append(opt);
    });

    const keyConditionGroup = el('div');
    const pkInput = document.createElement('input');
    const { pk, sk } = getKeySchema(table);
    pkInput.placeholder = `e.g. ${pk || 'id'}`;
    const pkValInput = document.createElement('input');
    pkValInput.placeholder = 'Partition key value (e.g. 123 or user-abc)';

    const skOpSelect = document.createElement('select');
    [['', 'None (PK only)'], ['=', '='], ['<', '<'], ['<=', '<='], ['>', '>'], ['>=', '>='], ['begins_with', 'begins_with'], ['between', 'between']].forEach(([val, label]) => {
      const opt = el('option', null, label);
      opt.value = val;
      skOpSelect.append(opt);
    });
    const skInput = document.createElement('input');
    skInput.placeholder = `Sort key name (${sk || 'optional'})`;
    const skVal1 = document.createElement('input');
    skVal1.placeholder = 'Sort key value';
    const skVal2 = document.createElement('input');
    skVal2.placeholder = 'Sort key upper bound (for between)';
    skVal2.style.display = 'none';

    skOpSelect.addEventListener('change', () => {
      skVal2.style.display = skOpSelect.value === 'between' ? 'block' : 'none';
    });

    keyConditionGroup.append(
      el('label', null, 'Partition Key Name & Value (Required for Query)'),
      pkInput,
      pkValInput,
      el('label', null, 'Sort Key Condition (Optional)'),
      skOpSelect,
      skInput,
      skVal1,
      skVal2,
    );

    const filterInput = document.createElement('input');
    filterInput.placeholder = 'e.g. age > :min_age AND status = :st';
    const filterValuesInput = document.createElement('textarea');
    filterValuesInput.className = 'dynamodb-json-input';
    filterValuesInput.placeholder = '{"status": "ACTIVE"} or {":st": "ACTIVE"}';

    const limitInput = document.createElement('input');
    limitInput.type = 'number';
    limitInput.min = '1';
    limitInput.max = '100';
    limitInput.value = '25';

    function updateModeVisibility() {
      keyConditionGroup.style.display = modeSelect.value === 'query' ? 'block' : 'none';
    }
    modeSelect.addEventListener('change', updateModeVisibility);
    updateModeVisibility();

    form.append(
      el('label', null, 'Operation Mode'),
      modeSelect,
      el('label', null, 'Index to Query/Scan'),
      indexSelect,
      keyConditionGroup,
      el('label', null, 'Filter Expression (Optional)'),
      filterInput,
      el('label', null, 'Filter Values (JSON, Optional)'),
      filterValuesInput,
      el('label', null, 'Limit'),
      limitInput,
    );

    openModal('Query or Scan Table', form, 'Execute', async (close) => {
      const mode = modeSelect.value;
      const indexName = indexSelect.value || null;
      const limit = Number(limitInput.value || 25);
      const filterExpr = filterInput.value.trim() || null;
      let filterVals = null;
      if (filterValuesInput.value.trim()) {
        try {
          filterVals = JSON.parse(filterValuesInput.value.trim());
        } catch (e) {
          throw new Error('Filter values must be valid JSON: ' + e.message);
        }
      }

      if (mode === 'scan') {
        await scanTable(table, {
          limit,
          filter_expression: filterExpr,
          expression_attribute_values: filterVals,
          index_name: indexName,
        });
      } else {
        const pkName = (pkInput.value.trim() || pk || 'id');
        const pkVal = pkValInput.value.trim();
        if (!pkVal) {
          throw new Error('Partition key value is required for Query');
        }
        let keyCond = `${pkName} = :pk`;
        const exprVals = { ':pk': isNaN(Number(pkVal)) || pkVal === '' ? pkVal : Number(pkVal) };

        const skOp = skOpSelect.value;
        const skName = skInput.value.trim() || sk;
        if (skOp && skName) {
          const v1 = skVal1.value.trim();
          const parsedV1 = isNaN(Number(v1)) || v1 === '' ? v1 : Number(v1);
          if (skOp === 'begins_with') {
            keyCond += ` AND begins_with(${skName}, :sk1)`;
            exprVals[':sk1'] = v1;
          } else if (skOp === 'between') {
            const v2 = skVal2.value.trim();
            const parsedV2 = isNaN(Number(v2)) || v2 === '' ? v2 : Number(v2);
            keyCond += ` AND ${skName} BETWEEN :sk1 AND :sk2`;
            exprVals[':sk1'] = parsedV1;
            exprVals[':sk2'] = parsedV2;
          } else {
            keyCond += ` AND ${skName} ${skOp} :sk1`;
            exprVals[':sk1'] = parsedV1;
          }
        }

        if (filterVals) {
          Object.assign(exprVals, filterVals);
        }

        await queryTable(table, {
          key_condition_expression: keyCond,
          expression_attribute_values: exprVals,
          filter_expression: filterExpr,
          index_name: indexName,
          limit,
        });
      }
      close();
    });
  }

  function showCreateItemModal(table, existingItem = null) {
    const form = el('div', 'dynamodb-form');
    const { pk, sk } = getKeySchema(table);

    let defaultItem = {};
    if (existingItem) {
      defaultItem = JSON.parse(JSON.stringify(existingItem));
    } else {
      defaultItem[pk || 'id'] = 'item-1001';
      if (sk) defaultItem[sk] = 'metadata';
      defaultItem.name = 'Sample Item';
      defaultItem.status = 'ACTIVE';
      defaultItem.created_at = new Date().toISOString();
    }

    const itemInput = document.createElement('textarea');
    itemInput.className = 'dynamodb-json-input';
    itemInput.style.minHeight = '180px';
    itemInput.value = JSON.stringify(defaultItem, null, 2);

    form.append(
      el('label', null, existingItem ? 'Edit Item JSON' : 'New Item JSON (Must include primary key attributes)'),
      itemInput,
      el('small', 'dynamodb-table-meta', `Primary Key: ${pk}${sk ? ' / Sort Key: ' + sk : ''}`),
    );

    openModal(existingItem ? 'Edit item' : 'Create item', form, 'Save Item', async (close) => {
      let itemObj;
      try {
        itemObj = JSON.parse(itemInput.value.trim());
      } catch (e) {
        throw new Error('Item must be valid JSON: ' + e.message);
      }
      if (!itemObj || typeof itemObj !== 'object' || Array.isArray(itemObj)) {
        throw new Error('Item must be a JSON object');
      }

      await apiJson(`/api/dynamodb/tables/${encodeURIComponent(table.name)}/items/`, {
        method: 'POST',
        body: JSON.stringify({ item: itemObj }),
      });
      toast(`Item saved in table ${table.name}`);
      close();
      await scanTable(table);
      await refresh();
    });
  }

  function showDeleteItemModal(table, item) {
    const key = extractKey(table, item);
    if (!key) {
      toast('Could not extract primary key from item', true);
      return;
    }

    const form = el('div');
    form.append(
      el('p', null, `Are you sure you want to delete this item from table "${table.name}"?`),
      el('pre', 'dynamodb-json-output', JSON.stringify(key, null, 2)),
    );

    openModal('Delete item', form, 'Delete', async (close) => {
      await apiJson(`/api/dynamodb/tables/${encodeURIComponent(table.name)}/items/delete/`, {
        method: 'POST',
        body: JSON.stringify({ key }),
      });
      toast('Item deleted');
      close();
      await scanTable(table);
      await refresh();
    });
  }

  function showTtlModal(table) {
    const form = el('div', 'dynamodb-form');
    const enabledCheckbox = document.createElement('input');
    enabledCheckbox.type = 'checkbox';
    enabledCheckbox.checked = Boolean(table.ttl?.TimeToLiveStatus === 'ENABLED');

    const attrInput = document.createElement('input');
    attrInput.placeholder = 'e.g. ttl or expires_at';
    attrInput.value = table.ttl?.AttributeName || 'ttl';

    const checkLabel = el('label', null);
    checkLabel.append(enabledCheckbox, ' Enable Time to Live (TTL)');

    form.append(
      checkLabel,
      el('label', null, 'TTL Attribute Name (epoch timestamp in seconds)'),
      attrInput,
    );

    openModal('Configure Time to Live (TTL)', form, 'Save TTL', async (close) => {
      const attrName = attrInput.value.trim();
      if (!attrName) throw new Error('TTL attribute name is required');
      await apiJson(`/api/dynamodb/tables/${encodeURIComponent(table.name)}/ttl/`, {
        method: 'POST',
        body: JSON.stringify({
          attribute_name: attrName,
          enabled: enabledCheckbox.checked,
        }),
      });
      toast('TTL configuration updated');
      close();
      await refresh();
    });
  }

  function showPartiqlModal(table) {
    const form = el('div');
    const statementInput = document.createElement('textarea');
    statementInput.className = 'dynamodb-json-input';
    statementInput.value = `SELECT * FROM "${table.name}"`;
    const limitInput = document.createElement('input');
    limitInput.type = 'number';
    limitInput.min = '1';
    limitInput.max = '100';
    limitInput.value = '25';
    form.append(
      el('label', null, 'SELECT statement'),
      statementInput,
      el('label', null, 'Limit'),
      limitInput,
    );

    openModal('Execute PartiQL SELECT', form, 'Execute', async (close) => {
      const data = await apiJson('/api/dynamodb/partiql/', {
        method: 'POST',
        body: JSON.stringify({
          statement: statementInput.value,
          limit: Number(limitInput.value || 25),
        }),
      });
      state.partiqlResult = data;
      state.scanResult = {
        table: table.name,
        count: data.count,
        scanned_count: data.count,
        items: data.items || [],
      };
      state.selectedItemIndex = 0;
      close();
      toast(`Returned ${data.count || 0} item(s)`);
      render();
    });
  }

  function renderTableRow(table) {
    const active = table.name === selectedTable()?.name;
    const row = el('button', `dynamodb-table-row${active ? ' dynamodb-table-row-active' : ''}`);
    const meta = [
      table.status,
      `${table.item_count || 0} item${table.item_count === 1 ? '' : 's'}`,
      `${(table.global_secondary_indexes || []).length} GSI`,
    ].filter(Boolean);
    row.append(
      el('span', 'dynamodb-table-name', table.name || 'Unnamed table'),
      el('span', 'dynamodb-table-meta', meta.join(' / ')),
    );
    row.addEventListener('click', () => {
      state.selectedTableName = table.name;
      state.selectedItemIndex = 0;
      state.scanResult = null;
      state.partiqlResult = null;
      render();
    });
    return row;
  }

  function renderTableList() {
    const panel = el('section', 'dynamodb-panel');
    panel.append(el('div', 'dynamodb-panel-heading', 'Tables'));
    const list = el('div', 'dynamodb-table-list');
    if (!tables().length) {
      list.append(el('div', 'dynamodb-empty', 'No tables found.'));
    } else {
      tables().forEach((table) => list.append(renderTableRow(table)));
    }
    panel.append(list);
    return panel;
  }

  function renderSchema(table) {
    const card = el('section', 'dynamodb-card');
    const heading = el('div', 'dynamodb-card-heading');
    heading.append(
      el('h3', null, 'Schema & Indexes'),
      btn('Configure TTL', 'dynamodb-btn-secondary', () => showTtlModal(table)),
    );
    card.append(heading);

    const details = document.createElement('dl');
    consoleUi.addField(details, 'ARN', table.arn);
    consoleUi.addField(details, 'Status', table.status);
    consoleUi.addField(details, 'Item count', table.item_count);
    consoleUi.addField(details, 'Size bytes', table.size_bytes);
    consoleUi.addField(details, 'Billing mode', table.billing_mode);
    consoleUi.addField(details, 'Key schema', table.key_schema || []);
    consoleUi.addField(details, 'Attributes', table.attribute_definitions || []);
    consoleUi.addField(details, 'Global secondary indexes', table.global_secondary_indexes || []);
    consoleUi.addField(details, 'Local secondary indexes', table.local_secondary_indexes || []);
    consoleUi.addField(details, 'TTL', table.ttl || {});
    consoleUi.addField(details, 'Stream specification', table.stream_specification || {});
    consoleUi.addField(details, 'Latest stream ARN', table.latest_stream_arn);
    card.append(details);
    return card;
  }

  function renderItemList(table) {
    const items = selectedItems();
    const card = el('section', 'dynamodb-card');
    const heading = el('div', 'dynamodb-card-heading');
    const title = state.partiqlResult
      ? 'PartiQL results'
      : (state.lastQueryMode === 'query' ? 'Query Results' : 'Scanned Items');
    heading.append(
      el('h3', null, title),
      el('span', 'dynamodb-table-meta', `${items.length} shown`),
    );
    card.append(heading);

    const actionsBar = el('div', 'dynamodb-action-row');
    actionsBar.append(
      btn('+ Create Item', null, () => showCreateItemModal(table)),
      btn('Query / Scan Filter', 'dynamodb-btn-secondary', () => showQueryScanModal(table)),
    );
    card.append(actionsBar);

    if (state.scanResult?.last_evaluated_key) {
      const next = btn('Next page', 'dynamodb-btn-secondary', () => scanTable(
        table,
        { limit: 25, exclusive_start_key: state.scanResult.last_evaluated_key },
      ));
      card.append(next);
    }

    const list = el('div', 'dynamodb-item-list');
    if (!items.length) {
      list.append(el('div', 'dynamodb-empty dynamodb-empty-compact', 'No items match current query/scan.'));
    } else {
      items.forEach((item, index) => {
        const row = el('button', `dynamodb-item-row${index === state.selectedItemIndex ? ' dynamodb-item-row-active' : ''}`);
        const keys = Object.keys(item).slice(0, 4);
        row.textContent = keys.length
          ? keys.map((key) => `${key}: ${JSON.stringify(item[key])}`).join(' / ')
          : `Item ${index + 1}`;
        row.addEventListener('click', () => {
          state.selectedItemIndex = index;
          render();
        });
        list.append(row);
      });
    }
    card.append(list);
    return card;
  }

  function renderItemDetail(table) {
    const card = el('section', 'dynamodb-card');
    const item = selectedItem();
    const heading = el('div', 'dynamodb-card-heading');
    heading.append(el('h3', null, 'Selected Item Detail'));

    if (item) {
      const controls = el('div', 'dynamodb-action-row');
      controls.append(
        btn('Edit Item', 'dynamodb-btn-secondary', () => showCreateItemModal(table, item)),
        btn('Delete Item', 'dynamodb-btn-danger', () => showDeleteItemModal(table, item)),
      );
      heading.append(controls);
    }
    card.append(heading);
    card.append(el('pre', 'dynamodb-json-output', item ? JSON.stringify(item, null, 2) : 'No item selected.'));
    return card;
  }

  function renderTableDetail(table) {
    const panel = el('section', 'dynamodb-panel');
    const heading = el('div', 'dynamodb-panel-heading');
    heading.append(
      el('span', null, table ? table.name : 'Table explorer'),
      el('span', 'dynamodb-table-meta', table?.status || ''),
    );
    panel.append(heading);

    const content = el('div', 'dynamodb-table-detail');
    if (!table) {
      content.append(el('div', 'dynamodb-empty', 'Create or select a table to inspect items.'));
    } else {
      content.append(renderSchema(table), renderItemList(table), renderItemDetail(table));
      if (state.partiqlResult) {
        const query = el('section', 'dynamodb-card');
        query.append(el('h3', null, 'Last PartiQL statement'));
        query.append(el('pre', 'dynamodb-json-output', state.partiqlResult.statement));
        content.append(query);
      }
    }
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const table = selectedTable();
    const container = el('div');
    container.append(toolbar(
      [
        btn('Query / Scan Builder', null, () => table && showQueryScanModal(table)),
        btn('+ Create Item', 'dynamodb-btn-secondary', () => table && showCreateItemModal(table)),
        btn('PartiQL SELECT', 'dynamodb-btn-secondary', () => table && showPartiqlModal(table)),
        btn('Configure TTL', 'dynamodb-btn-secondary', () => table && showTtlModal(table)),
      ],
      [
        btn('Refresh Table', 'dynamodb-btn-secondary', async () => {
          if (table) {
            await scanTable(table);
            await refresh();
          }
        }),
      ],
    ));

    container.querySelectorAll('button').forEach((button) => {
      button.disabled = !table;
    });

    const workbench = el('div', 'dynamodb-workbench');
    workbench.append(renderTableList(), renderTableDetail(table));
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
    const data = await apiJson('/api/dynamodb/');
    state.inventory = data;
    if (!selectedTable() && tables().length) {
      state.selectedTableName = tables()[0].name;
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'dynamodb-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.DynamoDBConsole = DynamoDBConsole;

if (document.getElementById('dynamodb-console-root')) {
  DynamoDBConsole.init();
}

