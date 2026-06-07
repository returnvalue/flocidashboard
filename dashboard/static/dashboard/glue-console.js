/* global ServiceConsole */

const GlueConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('glue-console-root');
  const breadcrumbsEl = document.getElementById('glue-breadcrumbs');
  const summaryEl = document.getElementById('glue-summary');
  const loadedAtEl = document.getElementById('glue-loaded-at');

  const state = {
    inventory: null,
    selectedDatabaseName: '',
    selectedRegistryName: '',
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'glue',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'glue');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'glue',
      toast,
    });

  function databases() {
    return state.inventory?.databases || [];
  }

  function registries() {
    return state.inventory?.registries || [];
  }

  function selectedDatabase() {
    return databases().find((database) => database.name === state.selectedDatabaseName) || databases()[0] || null;
  }

  function selectedRegistry() {
    return registries().find((registry) => registry.name === state.selectedRegistryName) || registries()[0] || null;
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

  function option(select, value, label, selected = false) {
    const node = document.createElement('option');
    node.value = value || '';
    node.textContent = label || value || '';
    node.selected = selected;
    select.append(node);
  }

  function addDatabaseOptions(select, selectedValue = '') {
    databases().forEach((database) => option(select, database.name, database.name, database.name === selectedValue));
  }

  function addRegistryOptions(select, selectedValue = '') {
    registries().forEach((registry) => option(select, registry.name, registry.name, registry.name === selectedValue));
  }

  function schemaDefinition(format = 'AVRO') {
    if (format === 'JSON') {
      return '{"type":"object","properties":{"id":{"type":"integer"}},"required":["id"]}';
    }
    if (format === 'PROTOBUF') {
      return 'syntax = "proto3"; message Order { int64 id = 1; }';
    }
    return '{"type":"record","name":"Order","namespace":"example","fields":[{"name":"id","type":"long"}]}';
  }

  function tableTemplate(databaseName = 'analytics') {
    return {
      Name: 'orders',
      StorageDescriptor: {
        Location: 's3://my-bucket/orders/',
        InputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
        OutputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
        SerdeInfo: {
          SerializationLibrary: 'org.openx.data.jsonserde.JsonSerDe',
        },
        Columns: [
          { Name: 'id', Type: 'int' },
          { Name: 'amount', Type: 'double' },
        ],
      },
      Parameters: {
        'floci:database': databaseName,
      },
    };
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'glue',
      targets: {
        databases: 'Databases',
        tables: 'Databases',
        partitions: 'Databases',
        functions: 'Databases',
        registries: 'Registries',
        schemas: 'Registries',
        schema_versions: 'Registries',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('Glue', null, () => {
      state.selectedDatabaseName = databases()[0] ? databases()[0].name : '';
      state.selectedRegistryName = registries()[0] ? registries()[0].name : '';
      render();
    }));
    const database = selectedDatabase();
    if (database) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, database.name));
    }
  }

  function showCreateDatabaseModal() {
    const form = el('div', 'glue-modal-form');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'analytics';
    const descriptionInput = document.createElement('input');
    descriptionInput.placeholder = 'Local analytics catalog';
    const locationInput = document.createElement('input');
    locationInput.placeholder = 's3://my-bucket/';
    const parametersInput = document.createElement('textarea');
    parametersInput.placeholder = '{"env":"local"}';
    form.append(
      el('label', null, 'Database name'),
      nameInput,
      el('label', null, 'Description'),
      descriptionInput,
      el('label', null, 'Location URI'),
      locationInput,
      el('label', null, 'Parameters JSON'),
      parametersInput,
    );
    openModal('Create database', form, 'Create', async (close) => {
      const data = await apiJson('/api/glue/databases/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          description: descriptionInput.value.trim(),
          location_uri: locationInput.value.trim(),
          parameters: parseJson(parametersInput.value, {}, 'Parameters'),
        }),
      });
      state.selectedDatabaseName = data.database || nameInput.value.trim();
      state.lastResult = data;
      close();
      toast('Database created');
      await refresh();
    });
  }

  function showCreateTableModal(database = selectedDatabase()) {
    const form = el('div', 'glue-modal-form');
    const databaseSelect = document.createElement('select');
    addDatabaseOptions(databaseSelect, database?.name || '');
    const tableInput = document.createElement('textarea');
    tableInput.value = JSON.stringify(tableTemplate(database?.name || 'analytics'), null, 2);
    form.append(
      el('label', null, 'Database'),
      databaseSelect,
      el('label', null, 'Table input JSON'),
      tableInput,
    );
    openModal('Create table', form, 'Create', async (close) => {
      const databaseName = databaseSelect.value.trim();
      const data = await apiJson(`/api/glue/databases/${encodeURIComponent(databaseName)}/tables/`, {
        method: 'POST',
        body: JSON.stringify({ table_input: parseJson(tableInput.value, {}, 'Table input') }),
      });
      state.selectedDatabaseName = databaseName;
      state.lastResult = data;
      close();
      toast('Table created');
      await refresh();
    });
  }

  function showCreatePartitionModal(database = selectedDatabase(), table = null) {
    const form = el('div', 'glue-modal-form');
    const databaseInput = document.createElement('input');
    databaseInput.value = database?.name || '';
    const tableInput = document.createElement('input');
    tableInput.value = table?.name || '';
    const valuesInput = document.createElement('textarea');
    valuesInput.placeholder = '["2026","06","03"]';
    const storageInput = document.createElement('textarea');
    storageInput.placeholder = '{"Location":"s3://my-bucket/orders/dt=2026-06-03/"}';
    const parametersInput = document.createElement('textarea');
    parametersInput.placeholder = '{"createdBy":"dashboard"}';
    form.append(
      el('label', null, 'Database name'),
      databaseInput,
      el('label', null, 'Table name'),
      tableInput,
      el('label', null, 'Partition values JSON'),
      valuesInput,
      el('label', null, 'Storage descriptor JSON'),
      storageInput,
      el('label', null, 'Parameters JSON'),
      parametersInput,
    );
    openModal('Create partition', form, 'Create', async (close) => {
      const databaseName = databaseInput.value.trim();
      const tableName = tableInput.value.trim();
      const data = await apiJson(`/api/glue/databases/${encodeURIComponent(databaseName)}/tables/${encodeURIComponent(tableName)}/partitions/`, {
        method: 'POST',
        body: JSON.stringify({
          values: parseJson(valuesInput.value, [], 'Partition values'),
          storage_descriptor: parseJson(storageInput.value, {}, 'Storage descriptor'),
          parameters: parseJson(parametersInput.value, {}, 'Parameters'),
        }),
      });
      state.selectedDatabaseName = databaseName;
      state.lastResult = data;
      close();
      toast('Partition created');
      await refresh();
    });
  }

  function functionTemplate() {
    return {
      FunctionName: 'normalize_order',
      ClassName: 'com.example.glue.NormalizeOrder',
      OwnerName: 'local',
      OwnerType: 'USER',
      ResourceUris: [
        { ResourceType: 'JAR', Uri: 's3://my-bucket/jars/local-udf.jar' },
      ],
    };
  }

  function showCreateFunctionModal(database = selectedDatabase()) {
    const form = el('div', 'glue-modal-form');
    const databaseSelect = document.createElement('select');
    addDatabaseOptions(databaseSelect, database?.name || '');
    const functionInput = document.createElement('textarea');
    functionInput.value = JSON.stringify(functionTemplate(), null, 2);
    form.append(
      el('label', null, 'Database'),
      databaseSelect,
      el('label', null, 'Function input JSON'),
      functionInput,
    );
    openModal('Create user-defined function', form, 'Create', async (close) => {
      const databaseName = databaseSelect.value.trim();
      const data = await apiJson(`/api/glue/databases/${encodeURIComponent(databaseName)}/functions/`, {
        method: 'POST',
        body: JSON.stringify({ function_input: parseJson(functionInput.value, {}, 'Function input') }),
      });
      state.selectedDatabaseName = databaseName;
      state.lastResult = data;
      close();
      toast('User-defined function created');
      await refresh();
    });
  }

  function showCreateRegistryModal() {
    const form = el('div', 'glue-modal-form');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'local-registry';
    const descriptionInput = document.createElement('input');
    descriptionInput.placeholder = 'Local event schemas';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{"env":"local"}';
    form.append(
      el('label', null, 'Registry name'),
      nameInput,
      el('label', null, 'Description'),
      descriptionInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Create registry', form, 'Create', async (close) => {
      const data = await apiJson('/api/glue/registries/', {
        method: 'POST',
        body: JSON.stringify({
          registry_name: nameInput.value.trim(),
          description: descriptionInput.value.trim(),
          tags: parseJson(tagsInput.value, {}, 'Tags'),
        }),
      });
      state.selectedRegistryName = data.registry || nameInput.value.trim();
      state.lastResult = data;
      close();
      toast('Registry created');
      await refresh();
    });
  }

  function showCreateSchemaModal(registry = selectedRegistry()) {
    const form = el('div', 'glue-modal-form');
    const registrySelect = document.createElement('select');
    addRegistryOptions(registrySelect, registry?.name || '');
    const schemaInput = document.createElement('input');
    schemaInput.placeholder = 'orders';
    const formatSelect = document.createElement('select');
    ['AVRO', 'JSON', 'PROTOBUF'].forEach((format) => option(formatSelect, format, format, format === 'AVRO'));
    const compatibilitySelect = document.createElement('select');
    ['BACKWARD', 'BACKWARD_ALL', 'FORWARD', 'FORWARD_ALL', 'FULL', 'FULL_ALL', 'NONE', 'DISABLED']
      .forEach((mode) => option(compatibilitySelect, mode, mode, mode === 'BACKWARD'));
    const definitionInput = document.createElement('textarea');
    definitionInput.value = schemaDefinition('AVRO');
    const descriptionInput = document.createElement('input');
    descriptionInput.placeholder = 'Order event schema';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{"env":"local"}';
    formatSelect.addEventListener('change', () => {
      definitionInput.value = schemaDefinition(formatSelect.value);
    });
    form.append(
      el('label', null, 'Registry'),
      registrySelect,
      el('label', null, 'Schema name'),
      schemaInput,
      el('label', null, 'Data format'),
      formatSelect,
      el('label', null, 'Compatibility'),
      compatibilitySelect,
      el('label', null, 'Schema definition'),
      definitionInput,
      el('label', null, 'Description'),
      descriptionInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Create schema', form, 'Create', async (close) => {
      const data = await apiJson('/api/glue/schemas/', {
        method: 'POST',
        body: JSON.stringify({
          registry_name: registrySelect.value.trim(),
          schema_name: schemaInput.value.trim(),
          data_format: formatSelect.value,
          compatibility: compatibilitySelect.value,
          schema_definition: definitionInput.value.trim(),
          description: descriptionInput.value.trim(),
          tags: parseJson(tagsInput.value, {}, 'Tags'),
        }),
      });
      state.selectedRegistryName = registrySelect.value.trim();
      state.lastResult = data;
      close();
      toast('Schema created');
      await refresh();
    });
  }

  function showRegisterVersionModal(registry = selectedRegistry(), schema = null) {
    const form = el('div', 'glue-modal-form');
    const registryInput = document.createElement('input');
    registryInput.value = registry?.name || '';
    const schemaInput = document.createElement('input');
    schemaInput.value = schema?.name || '';
    const definitionInput = document.createElement('textarea');
    definitionInput.value = '{"type":"record","name":"Order","namespace":"example","fields":[{"name":"id","type":"long"},{"name":"amount","type":["null","double"],"default":null}]}';
    form.append(
      el('label', null, 'Registry name'),
      registryInput,
      el('label', null, 'Schema name'),
      schemaInput,
      el('label', null, 'Schema definition'),
      definitionInput,
    );
    openModal('Register schema version', form, 'Register', async (close) => {
      const data = await apiJson('/api/glue/schema-versions/', {
        method: 'POST',
        body: JSON.stringify({
          registry_name: registryInput.value.trim(),
          schema_name: schemaInput.value.trim(),
          schema_definition: definitionInput.value.trim(),
        }),
      });
      state.selectedRegistryName = registryInput.value.trim();
      state.lastResult = data;
      close();
      toast('Schema version registered');
      await refresh();
    });
  }

  async function deleteDatabase(database) {
    if (!window.confirm(`Delete Glue database ${database.name}?`)) {
      return;
    }
    const data = await apiJson(`/api/glue/databases/${encodeURIComponent(database.name)}/`, { method: 'DELETE' });
    state.lastResult = data;
    state.selectedDatabaseName = '';
    toast('Database deleted');
    await refresh();
  }

  async function deleteTable(database, table) {
    if (!window.confirm(`Delete Glue table ${table.name}?`)) {
      return;
    }
    const data = await apiJson(`/api/glue/databases/${encodeURIComponent(database.name)}/tables/${encodeURIComponent(table.name)}/`, { method: 'DELETE' });
    state.lastResult = data;
    toast('Table deleted');
    await refresh();
  }

  async function deleteFunction(database, fn) {
    if (!window.confirm(`Delete Glue user-defined function ${fn.name}?`)) {
      return;
    }
    const data = await apiJson(`/api/glue/databases/${encodeURIComponent(database.name)}/functions/${encodeURIComponent(fn.name)}/`, { method: 'DELETE' });
    state.lastResult = data;
    toast('User-defined function deleted');
    await refresh();
  }

  function renderDatabaseList() {
    const panel = el('section', 'glue-panel');
    panel.append(el('div', 'glue-panel-heading', 'Databases'));
    const list = el('div', 'glue-item-list');
    if (!databases().length) {
      list.append(el('div', 'glue-empty', 'No Glue databases found.'));
    } else {
      databases().forEach((database) => {
        const active = database.name === selectedDatabase()?.name;
        const row = el('button', `glue-item-row${active ? ' glue-item-row-active' : ''}`);
        row.append(
          el('span', 'glue-item-name', database.name || 'Database'),
          el('span', 'glue-item-meta', `${database.table_count || 0} tables / ${database.function_count || 0} functions / ${database.partition_count || 0} partitions`),
        );
        row.addEventListener('click', () => {
          state.selectedDatabaseName = database.name;
          render();
        });
        list.append(row);
      });
    }
    panel.append(list);
    return panel;
  }

  function renderTableCards(database) {
    const body = el('div', 'glue-card-list');
    (database.tables || []).forEach((table) => {
      const card = el('article', 'glue-card');
      card.append(el('h3', null, table.name || 'Table'));
      const facts = el('dl', 'glue-facts');
      consoleUi.addField(facts, 'Location', table.location);
      consoleUi.addField(facts, 'DuckDB reader', table.duckdb_reader);
      consoleUi.addField(facts, 'Input format', table.input_format);
      consoleUi.addField(facts, 'SerDe', table.serde);
      consoleUi.addField(facts, 'Columns', table.columns);
      consoleUi.addField(facts, 'Partition keys', table.partition_keys);
      consoleUi.addField(facts, 'Partitions', table.partition_count);
      card.append(facts);
      const actions = el('div', 'glue-action-row');
      actions.append(
        btn('Add partition', 'glue-btn-secondary', () => showCreatePartitionModal(database, table)),
        btn('Delete table', 'glue-btn-danger', () => deleteTable(database, table).catch((error) => toast(error.message, true))),
      );
      card.append(actions);
      body.append(card);
    });
    if (!(database.tables || []).length) {
      body.append(el('p', 'glue-empty', 'No tables found for this database.'));
    }
    return body;
  }

  function renderFunctionCards(database) {
    const body = el('div', 'glue-card-list');
    (database.functions || []).forEach((fn) => {
      const card = el('article', 'glue-card');
      card.append(el('h3', null, fn.name || 'Function'));
      const facts = el('dl', 'glue-facts');
      consoleUi.addField(facts, 'Class name', fn.class_name);
      consoleUi.addField(facts, 'Owner', fn.owner_name);
      consoleUi.addField(facts, 'Owner type', fn.owner_type);
      consoleUi.addField(facts, 'Created', fn.created);
      consoleUi.addField(facts, 'Resource URIs', fn.resource_uris);
      card.append(facts);
      const actions = el('div', 'glue-action-row');
      actions.append(btn('Delete function', 'glue-btn-danger', () => deleteFunction(database, fn).catch((error) => toast(error.message, true))));
      card.append(actions);
      body.append(card);
    });
    if (!(database.functions || []).length) {
      body.append(el('p', 'glue-empty', 'No user-defined functions found for this database.'));
    }
    return body;
  }

  function renderDatabaseDetail(database) {
    const panel = el('section', 'glue-panel');
    panel.append(el('div', 'glue-panel-heading', 'Selected database'));
    const body = el('div', 'glue-detail');
    const facts = el('dl', 'glue-facts');
    consoleUi.addField(facts, 'Name', database.name);
    consoleUi.addField(facts, 'Description', database.description);
    consoleUi.addField(facts, 'Location URI', database.location_uri);
    consoleUi.addField(facts, 'Parameters', database.parameters);
    consoleUi.addField(facts, 'Created', database.created);
    body.append(facts);
    const actions = el('div', 'glue-action-row');
    actions.append(
      btn('Create table', null, () => showCreateTableModal(database)),
      btn('Create function', 'glue-btn-secondary', () => showCreateFunctionModal(database)),
      btn('Delete database', 'glue-btn-danger', () => deleteDatabase(database).catch((error) => toast(error.message, true))),
    );
    body.append(actions);
    body.append(el('h3', null, 'Tables'));
    body.append(renderTableCards(database));
    body.append(el('h3', null, 'User-defined functions'));
    body.append(renderFunctionCards(database));
    panel.append(body);
    return panel;
  }

  function renderRegistryPanel() {
    const panel = el('section', 'glue-panel');
    panel.append(el('div', 'glue-panel-heading', `Registries (${registries().length})`));
    const body = el('div', 'glue-card-list');
    registries().forEach((registry) => {
      const card = el('article', 'glue-card');
      card.append(el('h3', null, registry.name || 'Registry'));
      const facts = el('dl', 'glue-facts');
      consoleUi.addField(facts, 'ARN', registry.arn);
      consoleUi.addField(facts, 'Description', registry.description);
      consoleUi.addField(facts, 'Schemas', registry.schema_count);
      consoleUi.addField(facts, 'Schema versions', registry.version_count);
      card.append(facts);
      const actions = el('div', 'glue-action-row');
      actions.append(
        btn('Create schema', null, () => showCreateSchemaModal(registry)),
        btn('Register version', 'glue-btn-secondary', () => showRegisterVersionModal(registry)),
      );
      card.append(actions);
      (registry.schemas || []).forEach((schema) => {
        const schemaCard = el('article', 'glue-subcard');
        schemaCard.append(el('h3', null, schema.name || 'Schema'));
        const schemaFacts = el('dl', 'glue-facts');
        consoleUi.addField(schemaFacts, 'Format', schema.data_format);
        consoleUi.addField(schemaFacts, 'Compatibility', schema.compatibility);
        consoleUi.addField(schemaFacts, 'Status', schema.status);
        consoleUi.addField(schemaFacts, 'Versions', schema.version_count);
        schemaCard.append(schemaFacts);
        schemaCard.append(btn('Register version', 'glue-btn-secondary', () => showRegisterVersionModal(registry, schema)));
        card.append(schemaCard);
      });
      body.append(card);
    });
    if (!registries().length) {
      body.append(el('p', 'glue-empty', 'No Glue Schema Registry registries found.'));
    }
    panel.append(body);
    return panel;
  }

  function renderResult() {
    if (!state.lastResult) {
      return null;
    }
    const panel = el('section', 'glue-panel');
    panel.append(el('div', 'glue-panel-heading', 'Last action result'));
    const pre = el('pre', 'glue-result');
    pre.textContent = JSON.stringify(consoleUi.displayValue(state.lastResult), null, 2);
    panel.append(pre);
    return panel;
  }

  function renderWorkbench() {
    const workbench = el('div', 'glue-workbench');
    workbench.append(renderDatabaseList());
    const detail = el('div', 'glue-detail-stack');
    const database = selectedDatabase();
    if (!database) {
      detail.append(el('section', 'glue-panel glue-empty-panel', 'Create a Glue database to start modeling local table metadata for Athena.'));
    } else {
      detail.append(renderDatabaseDetail(database));
    }
    detail.append(renderRegistryPanel());
    const result = renderResult();
    if (result) {
      detail.append(result);
    }
    workbench.append(detail);
    return workbench;
  }

  function render() {
    if (!root) {
      return;
    }
    root.textContent = '';
    renderBreadcrumbs();
    renderSummary(state.inventory?.summary || {});
    root.append(toolbar(
      [
        btn('Create database', null, showCreateDatabaseModal),
        btn('Create table', 'glue-btn-secondary', () => showCreateTableModal()),
        btn('Create partition', 'glue-btn-secondary', () => showCreatePartitionModal()),
        btn('Create function', 'glue-btn-secondary', () => showCreateFunctionModal()),
        btn('Create registry', 'glue-btn-secondary', showCreateRegistryModal),
        btn('Create schema', 'glue-btn-secondary', () => showCreateSchemaModal()),
      ],
      [el('span', 'glue-toolbar-note', 'Data Catalog metadata, Schema Registry versions, and Athena table resolution')],
    ));
    root.append(renderWorkbench());
    if (loadedAtEl) {
      loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
    }
  }

  async function refresh() {
    if (!root) {
      return;
    }
    const data = await apiJson('/api/glue/');
    state.inventory = data;
    if (!state.selectedDatabaseName && databases()[0]) {
      state.selectedDatabaseName = databases()[0].name;
    }
    if (!state.selectedRegistryName && registries()[0]) {
      state.selectedRegistryName = registries()[0].name;
    }
    render();
  }

  return { refresh };
})();

window.GlueConsole = GlueConsole;
