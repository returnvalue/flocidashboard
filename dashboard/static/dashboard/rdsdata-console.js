/* global ServiceConsole */

const RDSDataConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('rdsdata-console-root');
  const breadcrumbsEl = document.getElementById('rdsdata-breadcrumbs');
  const summaryEl = document.getElementById('rdsdata-summary');
  const loadedAtEl = document.getElementById('rdsdata-loaded-at');

  const state = {
    inventory: null,
    resourceArn: 'arn:aws:rds:us-east-1:000000000000:cluster:floci-db',
    secretArn: 'arn:aws:secretsmanager:us-east-1:000000000000:secret:rds-master-credentials',
    database: 'postgres',
    activeTransactionId: null,
    lastResult: null,
    lastError: null,
    executionTimeMs: 0,
    sqlQuery: 'SELECT 1 AS health_check, NOW() AS server_time;',
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'rdsdata',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'rdsdata');

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) return;
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'Amazon RDS Data API');
    breadcrumbsEl.append(home, el('span', null, '/'), el('span', null, 'SQL Query Runner'));
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'rdsdata',
      targets: {
        available_sdk_operations: 'Operations',
      },
    });
  }

  async function executeQuery() {
    if (!state.sqlQuery.trim()) {
      toast('Please enter a SQL query', true);
      return;
    }
    const startTime = performance.now();
    state.lastResult = null;
    state.lastError = null;
    render();

    try {
      const payload = {
        resource_arn: state.resourceArn,
        secret_arn: state.secretArn,
        sql: state.sqlQuery.trim(),
        database: state.database.trim() || undefined,
        transaction_id: state.activeTransactionId || undefined,
      };
      const data = await apiJson('/api/rdsdata/execute/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      state.executionTimeMs = Math.round(performance.now() - startTime);
      state.lastResult = data;
      toast(`Executed in ${state.executionTimeMs}ms (${data.row_count || data.number_of_records_updated || 0} rows/records)`);
    } catch (err) {
      state.executionTimeMs = Math.round(performance.now() - startTime);
      state.lastError = err.message || String(err);
      toast(state.lastError, true);
    }
    render();
  }

  async function startTx() {
    try {
      const data = await apiJson('/api/rdsdata/transaction/begin/', {
        method: 'POST',
        body: JSON.stringify({
          resource_arn: state.resourceArn,
          secret_arn: state.secretArn,
          database: state.database.trim() || undefined,
        }),
      });
      state.activeTransactionId = data.transaction_id;
      toast(`Transaction started: ${data.transaction_id}`);
      render();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function commitTx() {
    if (!state.activeTransactionId) return;
    try {
      await apiJson('/api/rdsdata/transaction/commit/', {
        method: 'POST',
        body: JSON.stringify({
          resource_arn: state.resourceArn,
          secret_arn: state.secretArn,
          transaction_id: state.activeTransactionId,
        }),
      });
      toast(`Transaction committed: ${state.activeTransactionId}`);
      state.activeTransactionId = null;
      render();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function rollbackTx() {
    if (!state.activeTransactionId) return;
    try {
      await apiJson('/api/rdsdata/transaction/rollback/', {
        method: 'POST',
        body: JSON.stringify({
          resource_arn: state.resourceArn,
          secret_arn: state.secretArn,
          transaction_id: state.activeTransactionId,
        }),
      });
      toast(`Transaction rolled back: ${state.activeTransactionId}`);
      state.activeTransactionId = null;
      render();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function downloadCsv() {
    if (!state.lastResult || !state.lastResult.records || !state.lastResult.records.length) {
      toast('No records to export', true);
      return;
    }
    const cols = state.lastResult.columns;
    const rows = state.lastResult.records;
    const csvLines = [cols.join(',')];
    rows.forEach((row) => {
      const vals = cols.map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      });
      csvLines.push(vals.join(','));
    });
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rds_query_results_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast('CSV downloaded');
  }

  function renderConfigPanel() {
    const panel = el('section', 'rdsdata-panel');
    panel.append(el('div', 'rdsdata-panel-heading', 'Connection Configuration'));

    const form = el('div', 'rdsdata-config-form');

    const resInput = document.createElement('input');
    resInput.value = state.resourceArn;
    resInput.placeholder = 'Database / Cluster ARN (e.g. arn:aws:rds:...:cluster:...)';
    resInput.addEventListener('input', () => { state.resourceArn = resInput.value; });

    const secInput = document.createElement('input');
    secInput.value = state.secretArn;
    secInput.placeholder = 'Secrets Manager Secret ARN';
    secInput.addEventListener('input', () => { state.secretArn = secInput.value; });

    const dbInput = document.createElement('input');
    dbInput.value = state.database;
    dbInput.placeholder = 'Database name (e.g. postgres, appdb, mysql)';
    dbInput.addEventListener('input', () => { state.database = dbInput.value; });

    form.append(
      el('label', null, 'Database / Cluster Resource ARN'),
      resInput,
      el('label', null, 'Credentials Secret ARN'),
      secInput,
      el('label', null, 'Database Name (Optional)'),
      dbInput,
    );

    if (state.activeTransactionId) {
      const txBadge = el('div', 'rdsdata-tx-badge');
      txBadge.append(
        el('span', null, `Active Transaction: ${state.activeTransactionId}`),
        btn('Commit', 'rdsdata-btn-secondary', commitTx),
        btn('Rollback', 'rdsdata-btn-danger', rollbackTx),
      );
      form.append(txBadge);
    } else {
      const txBtn = btn('Begin Transaction', 'rdsdata-btn-secondary', startTx);
      form.append(txBtn);
    }

    panel.append(form);
    return panel;
  }

  function renderQueryEditor() {
    const card = el('section', 'rdsdata-card');
    const heading = el('div', 'rdsdata-card-heading');
    heading.append(
      el('h3', null, 'SQL Query Editor'),
      el('span', 'rdsdata-table-meta', state.activeTransactionId ? 'In Transaction' : 'Auto-Commit Mode'),
    );
    card.append(heading);

    const presetsBar = el('div', 'rdsdata-presets-bar');
    presetsBar.append(el('span', 'rdsdata-presets-label', 'Presets:'));

    const presets = [
      ['Health Check', 'SELECT 1 AS health_check, NOW() AS server_time;'],
      ['List Tables', "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"],
      ['Create Table', 'CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name VARCHAR(100), email VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);'],
      ['Insert Sample', "INSERT INTO users (name, email) VALUES ('Alice Developer', 'alice@example.com'), ('Bob Architect', 'bob@example.com');"],
      ['Select Users', 'SELECT * FROM users ORDER BY id DESC LIMIT 50;'],
    ];

    presets.forEach(([label, sql]) => {
      const pBtn = btn(label, 'rdsdata-btn-pill', () => {
        state.sqlQuery = sql;
        render();
      });
      presetsBar.append(pBtn);
    });
    card.append(presetsBar);

    const textarea = document.createElement('textarea');
    textarea.className = 'rdsdata-sql-input';
    textarea.value = state.sqlQuery;
    textarea.placeholder = 'Enter SQL statements here (SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, etc.)...';
    textarea.addEventListener('input', () => { state.sqlQuery = textarea.value; });
    card.append(textarea);

    const actionRow = el('div', 'rdsdata-action-row');
    actionRow.append(
      btn('▶ Run SQL Query', 'rdsdata-btn-primary', executeQuery),
      btn('Clear', 'rdsdata-btn-secondary', () => { state.sqlQuery = ''; render(); }),
    );
    card.append(actionRow);

    return card;
  }

  function renderResults() {
    const card = el('section', 'rdsdata-card');
    const heading = el('div', 'rdsdata-card-heading');
    heading.append(
      el('h3', null, 'Query Results'),
      el('span', 'rdsdata-table-meta', state.executionTimeMs ? `${state.executionTimeMs}ms` : ''),
    );
    card.append(heading);

    if (state.lastError) {
      const errBox = el('div', 'rdsdata-error-box');
      errBox.append(
        el('strong', null, 'Error executing SQL:'),
        el('pre', null, state.lastError),
      );
      card.append(errBox);
      return card;
    }

    if (!state.lastResult) {
      card.append(el('div', 'rdsdata-empty', 'Execute a SQL query to view results.'));
      return card;
    }

    const res = state.lastResult;
    const metaBar = el('div', 'rdsdata-results-meta');
    metaBar.append(
      el('span', null, `Rows returned: ${res.row_count || 0}`),
      el('span', null, `Records updated: ${res.number_of_records_updated || 0}`),
      btn('Download CSV', 'rdsdata-btn-secondary', downloadCsv),
    );
    card.append(metaBar);

    if (res.records && res.records.length > 0) {
      const tableWrapper = el('div', 'rdsdata-table-wrapper');
      const table = document.createElement('table');
      table.className = 'rdsdata-results-table';

      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      res.columns.forEach((col) => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.append(th);
      });
      thead.append(headerRow);
      table.append(thead);

      const tbody = document.createElement('tbody');
      res.records.forEach((row) => {
        const tr = document.createElement('tr');
        res.columns.forEach((col) => {
          const td = document.createElement('td');
          const val = row[col];
          td.textContent = val === null || val === undefined ? 'NULL' : String(val);
          if (val === null || val === undefined) td.className = 'rdsdata-null-cell';
          tr.append(td);
        });
        tbody.append(tr);
      });
      table.append(tbody);
      tableWrapper.append(table);
      card.append(tableWrapper);
    } else {
      card.append(el('div', 'rdsdata-empty rdsdata-empty-compact', `Query succeeded. Records updated: ${res.number_of_records_updated || 0}`));
    }

    return card;
  }

  function renderWorkbench() {
    const container = el('div');
    container.append(toolbar(
      [
        btn('Run Query', 'rdsdata-btn-primary', executeQuery),
        btn('Begin Transaction', 'rdsdata-btn-secondary', startTx),
      ],
      [
        btn('Refresh', 'rdsdata-btn-secondary', refresh),
      ],
    ));

    const grid = el('div', 'rdsdata-workbench');
    grid.append(renderConfigPanel());

    const mainCol = el('div', 'rdsdata-main-col');
    mainCol.append(renderQueryEditor(), renderResults());
    grid.append(mainCol);

    container.append(grid);
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
    try {
      const data = await apiJson('/api/rdsdata/');
      state.inventory = data;
      renderSummary(data.summary || {});
    } catch (e) {
      // fallback
    }
    render();
  }

  function init() {
    if (!root) return;
    root.append(el('div', 'rdsdata-empty', 'Loading RDS Data API...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.RDSDataConsole = RDSDataConsole;

if (document.getElementById('rdsdata-console-root')) {
  RDSDataConsole.init();
}
