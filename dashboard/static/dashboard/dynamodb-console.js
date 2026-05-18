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

  function tableScanPath(tableName) {
    return `/api/dynamodb/tables/${encodeURIComponent(tableName)}/scan/`;
  }

  async function scanTable(table, limit = 25, exclusiveStartKey = null) {
    const payload = { limit };
    if (exclusiveStartKey) {
      payload.exclusive_start_key = exclusiveStartKey;
    }
    const data = await apiJson(tableScanPath(table.name), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.scanResult = data;
    state.selectedItemIndex = 0;
    toast(`Scanned ${data.count || 0} item(s)`);
    render();
  }

  function showScanModal(table) {
    const form = el('div');
    const limitInput = document.createElement('input');
    limitInput.type = 'number';
    limitInput.min = '1';
    limitInput.max = '100';
    limitInput.value = '25';
    const startKeyInput = document.createElement('textarea');
    startKeyInput.className = 'dynamodb-json-input';
    startKeyInput.placeholder = '{"pk":"next-key"}';
    form.append(
      el('label', null, 'Limit'),
      limitInput,
      el('label', null, 'Exclusive start key JSON'),
      startKeyInput,
    );

    openModal('Scan table', form, 'Scan', async (close) => {
      let startKey = null;
      if (startKeyInput.value.trim()) {
        startKey = JSON.parse(startKeyInput.value);
      }
      await scanTable(table, Number(limitInput.value || 25), startKey);
      close();
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
    card.append(el('h3', null, 'Schema and indexes'));
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

  function renderItemList() {
    const items = selectedItems();
    const card = el('section', 'dynamodb-card');
    const heading = el('div', 'dynamodb-card-heading');
    heading.append(
      el('h3', null, state.partiqlResult ? 'PartiQL results' : 'Items'),
      el('span', 'dynamodb-table-meta', `${items.length} shown`),
    );
    card.append(heading);

    if (state.scanResult?.last_evaluated_key) {
      const next = btn('Scan next page', 'dynamodb-btn-secondary', () => scanTable(
        selectedTable(),
        25,
        state.scanResult.last_evaluated_key,
      ));
      card.append(next);
    }

    const list = el('div', 'dynamodb-item-list');
    if (!items.length) {
      list.append(el('div', 'dynamodb-empty dynamodb-empty-compact', 'No scanned items to show.'));
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

  function renderItemDetail() {
    const card = el('section', 'dynamodb-card');
    card.append(el('h3', null, 'Selected item JSON'));
    const item = selectedItem();
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
      content.append(renderSchema(table), renderItemList(), renderItemDetail());
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
        btn('Scan table', null, () => table && showScanModal(table)),
        btn('PartiQL SELECT', 'dynamodb-btn-secondary', () => table && showPartiqlModal(table)),
      ],
      [],
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
