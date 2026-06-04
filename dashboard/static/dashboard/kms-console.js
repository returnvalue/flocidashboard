/* global ServiceConsole */

const KMSConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('kms-console-root');
  const breadcrumbsEl = document.getElementById('kms-breadcrumbs');
  const summaryEl = document.getElementById('kms-summary');
  const loadedAtEl = document.getElementById('kms-loaded-at');

  const state = {
    inventory: null,
    selectedKeyId: '',
    lastCrypto: null,
    lastDataKey: null,
    lastRandom: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'kms',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'kms');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'kms',
      toast,
    });

  function keys() {
    return state.inventory?.keys || [];
  }

  function aliases() {
    return state.inventory?.aliases || [];
  }

  function keyId(key) {
    return key?.key_id || key?.name || '';
  }

  function selectedKey() {
    return keys().find((key) => keyId(key) === state.selectedKeyId) || keys()[0] || null;
  }

  function keyAliases(key) {
    return (key?.aliases || []).map((alias) => alias.AliasName || alias.alias_name).filter(Boolean);
  }

  function keyState(key) {
    return key?.metadata?.KeyState || key?.metadata?.key_state || 'Unknown';
  }

  function keyDescription(key) {
    return key?.metadata?.Description || key?.metadata?.description || '';
  }

  function keySpec(key) {
    return key?.metadata?.KeySpec || key?.metadata?.CustomerMasterKeySpec || 'Unknown';
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'KMS');
    home.addEventListener('click', () => {
      state.selectedKeyId = keys()[0] ? keyId(keys()[0]) : '';
      render();
    });
    breadcrumbsEl.append(home);
    const key = selectedKey();
    if (key) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, keyAliases(key)[0] || keyId(key)));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'kms',
      targets: {
        keys: 'Keys',
        aliases: 'Aliases',
        enabled_keys: 'Keys',
        pending_deletion: 'Keys',
        rotation_enabled: 'Keys',
      },
    });
  }

  function parseTags(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return [];
    }
    return JSON.parse(trimmed).map((tag) => ({
      TagKey: tag.TagKey || tag.key,
      TagValue: tag.TagValue ?? tag.value ?? '',
    }));
  }

  function parsePlaintext(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      throw new Error('Plaintext is required');
    }
    if (!['{', '['].includes(trimmed[0])) {
      return trimmed;
    }
    return JSON.parse(trimmed);
  }

  function copyText(value, label) {
    navigator.clipboard?.writeText(value).then(
      () => toast(`${label} copied`),
      () => toast(`${label}: ${value}`),
    );
  }

  function showCreateKeyModal() {
    const form = el('div', 'kms-modal-form');
    const description = document.createElement('input');
    description.placeholder = 'Local app encryption key';
    const keySpecInput = document.createElement('select');
    ['SYMMETRIC_DEFAULT', 'RSA_2048', 'RSA_3072', 'RSA_4096', 'ECC_NIST_P256', 'HMAC_256'].forEach((value) => {
      keySpecInput.append(new Option(value, value));
    });
    const keyUsageInput = document.createElement('select');
    ['ENCRYPT_DECRYPT', 'SIGN_VERIFY', 'GENERATE_VERIFY_MAC'].forEach((value) => {
      keyUsageInput.append(new Option(value, value));
    });
    const overrideId = document.createElement('input');
    overrideId.placeholder = 'optional-test-key-id';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '[{"TagKey":"env","TagValue":"local"}]';
    form.append(
      el('label', null, 'Description'),
      description,
      el('label', null, 'Key spec'),
      keySpecInput,
      el('label', null, 'Key usage'),
      keyUsageInput,
      el('label', null, 'Deterministic key ID'),
      overrideId,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );

    openModal('Create key', form, 'Create key', async (close) => {
      const data = await apiJson('/api/kms/keys/', {
        method: 'POST',
        body: JSON.stringify({
          description: description.value.trim(),
          key_spec: keySpecInput.value,
          key_usage: keyUsageInput.value,
          override_id: overrideId.value.trim(),
          tags: parseTags(tagsInput.value),
        }),
      });
      state.selectedKeyId = data.key_id || '';
      close();
      toast('Key created');
      await refresh();
    });
  }

  function showAliasModal(key) {
    const form = el('div', 'kms-modal-form');
    const aliasName = document.createElement('input');
    aliasName.placeholder = 'alias/my-key';
    form.append(el('label', null, 'Alias name'), aliasName);
    openModal('Create alias', form, 'Create alias', async (close) => {
      await apiJson('/api/kms/aliases/', {
        method: 'POST',
        body: JSON.stringify({
          alias_name: aliasName.value.trim(),
          target_key_id: keyId(key),
        }),
      });
      close();
      toast('Alias created');
      await refresh();
    });
  }

  function showDeleteAliasModal() {
    const form = el('div', 'kms-modal-form');
    const aliasInput = document.createElement('select');
    const aliasList = aliases().filter((alias) => alias.AliasName && alias.TargetKeyId);
    aliasList.forEach((alias) => aliasInput.append(new Option(alias.AliasName, alias.AliasName)));
    if (!aliasList.length) {
      aliasInput.append(new Option('No aliases found', ''));
      aliasInput.disabled = true;
    }
    form.append(el('label', null, 'Alias'), aliasInput);
    openModal('Delete alias', form, 'Delete alias', async (close) => {
      if (!aliasInput.value) {
        throw new Error('Alias is required');
      }
      await apiJson('/api/kms/aliases/', {
        method: 'DELETE',
        body: JSON.stringify({ alias_name: aliasInput.value }),
      });
      close();
      toast('Alias deleted');
      await refresh();
    });
  }

  async function encryptValue(key, plaintextInput) {
    const data = await apiJson('/api/kms/crypto/encrypt/', {
      method: 'POST',
      body: JSON.stringify({
        key_id: keyAliases(key)[0] || keyId(key),
        plaintext: parsePlaintext(plaintextInput.value),
      }),
    });
    state.lastCrypto = { type: 'encrypt', ...data };
    toast('Plaintext encrypted');
    render();
  }

  async function decryptValue(ciphertextInput) {
    const data = await apiJson('/api/kms/crypto/decrypt/', {
      method: 'POST',
      body: JSON.stringify({ ciphertext_blob: ciphertextInput.value.trim() }),
    });
    state.lastCrypto = { type: 'decrypt', ...data };
    toast('Ciphertext decrypted');
    render();
  }

  async function generateDataKey(key, keySpecInput, bytesInput) {
    const data = await apiJson('/api/kms/data-keys/', {
      method: 'POST',
      body: JSON.stringify({
        key_id: keyAliases(key)[0] || keyId(key),
        key_spec: keySpecInput.value,
        number_of_bytes: bytesInput.value.trim(),
      }),
    });
    state.lastDataKey = data;
    toast('Data key generated');
    render();
  }

  async function generateRandom(bytesInput) {
    const data = await apiJson('/api/kms/random/', {
      method: 'POST',
      body: JSON.stringify({ number_of_bytes: bytesInput.value.trim() || 32 }),
    });
    state.lastRandom = data;
    toast('Random bytes generated');
    render();
  }

  async function setRotation(key, enabled) {
    await apiJson('/api/kms/rotation/', {
      method: 'POST',
      body: JSON.stringify({ key_id: keyId(key), enabled }),
    });
    toast(enabled ? 'Rotation enabled' : 'Rotation disabled');
    await refresh();
  }

  async function scheduleDeletion(key) {
    const days = window.prompt('Pending window days (7-30)', '7');
    if (days == null) {
      return;
    }
    if (!window.confirm('Schedule this key for deletion?')) {
      return;
    }
    await apiJson('/api/kms/deletion/schedule/', {
      method: 'POST',
      body: JSON.stringify({ key_id: keyId(key), pending_window_in_days: Number(days || 7) }),
    });
    toast('Key deletion scheduled');
    await refresh();
  }

  async function cancelDeletion(key) {
    await apiJson('/api/kms/deletion/cancel/', {
      method: 'POST',
      body: JSON.stringify({ key_id: keyId(key) }),
    });
    toast('Key deletion canceled');
    await refresh();
  }

  function renderKeyRow(key) {
    const active = keyId(key) === keyId(selectedKey());
    const row = el('button', `kms-key-row${active ? ' kms-key-row-active' : ''}`);
    row.append(
      el('span', 'kms-key-name', keyAliases(key)[0] || keyId(key) || 'Unnamed key'),
      el('span', 'kms-key-meta', `${keyState(key)} / ${keySpec(key)}`),
    );
    row.addEventListener('click', () => {
      state.selectedKeyId = keyId(key);
      render();
    });
    return row;
  }

  function renderKeyList() {
    const panel = el('section', 'kms-panel');
    panel.append(el('div', 'kms-panel-heading', 'Keys'));
    const list = el('div', 'kms-key-list');
    if (!keys().length) {
      list.append(el('div', 'kms-empty', 'No KMS keys found.'));
    } else {
      keys().forEach((key) => list.append(renderKeyRow(key)));
    }
    panel.append(list);
    return panel;
  }

  function renderCryptoPanel(key) {
    const panel = el('section', 'kms-panel');
    panel.append(el('div', 'kms-panel-heading', 'Encrypt and decrypt'));
    const body = el('div', 'kms-detail');
    const plaintextInput = document.createElement('textarea');
    plaintextInput.className = 'kms-textarea';
    plaintextInput.placeholder = 'Hello, World!';
    const ciphertextInput = document.createElement('textarea');
    ciphertextInput.className = 'kms-textarea';
    ciphertextInput.placeholder = 'Base64 CiphertextBlob';
    if (state.lastCrypto?.ciphertext_blob) {
      ciphertextInput.value = state.lastCrypto.ciphertext_blob;
    }
    body.append(
      el('label', null, 'Plaintext'),
      plaintextInput,
      btn('Encrypt', null, () => encryptValue(key, plaintextInput).catch((error) => toast(error.message, true))),
      el('label', null, 'Ciphertext blob'),
      ciphertextInput,
      btn('Decrypt', 'kms-btn-secondary', () => decryptValue(ciphertextInput).catch((error) => toast(error.message, true))),
    );
    if (state.lastCrypto) {
      body.append(renderResult('Last crypto result', state.lastCrypto));
    }
    panel.append(body);
    return panel;
  }

  function renderDataKeyPanel(key) {
    const panel = el('section', 'kms-panel');
    panel.append(el('div', 'kms-panel-heading', 'Data key'));
    const body = el('div', 'kms-detail');
    const keySpecInput = document.createElement('select');
    keySpecInput.append(new Option('AES_256', 'AES_256'), new Option('AES_128', 'AES_128'));
    const bytesInput = document.createElement('input');
    bytesInput.type = 'number';
    bytesInput.min = '1';
    bytesInput.placeholder = 'Optional bytes';
    body.append(
      el('label', null, 'Key spec'),
      keySpecInput,
      el('label', null, 'Number of bytes'),
      bytesInput,
      btn('Generate data key', null, () => generateDataKey(key, keySpecInput, bytesInput).catch((error) => toast(error.message, true))),
    );
    if (state.lastDataKey) {
      body.append(renderResult('Last data key', state.lastDataKey));
    }
    panel.append(body);
    return panel;
  }

  function renderRandomPanel() {
    const panel = el('section', 'kms-panel');
    panel.append(el('div', 'kms-panel-heading', 'Random bytes'));
    const body = el('div', 'kms-detail');
    const bytesInput = document.createElement('input');
    bytesInput.type = 'number';
    bytesInput.min = '1';
    bytesInput.max = '1024';
    bytesInput.value = '32';
    body.append(
      el('label', null, 'Number of bytes'),
      bytesInput,
      btn('Generate random bytes', null, () => generateRandom(bytesInput).catch((error) => toast(error.message, true))),
    );
    if (state.lastRandom) {
      body.append(renderResult('Last random bytes', state.lastRandom));
    }
    panel.append(body);
    return panel;
  }

  function renderKeyDetail(key) {
    const panel = el('section', 'kms-panel');
    panel.append(el('div', 'kms-panel-heading', 'Selected key'));
    const body = el('div', 'kms-detail');
    const facts = el('dl', 'kms-facts');
    consoleUi.addField(facts, 'Key ID', keyId(key));
    consoleUi.addField(facts, 'ARN', key.key_arn);
    consoleUi.addField(facts, 'State', keyState(key));
    consoleUi.addField(facts, 'Description', keyDescription(key));
    consoleUi.addField(facts, 'Aliases', keyAliases(key));
    consoleUi.addField(facts, 'Rotation enabled', key.rotation_enabled);
    body.append(facts);
    const actions = el('div', 'kms-action-row');
    actions.append(
      btn('Create alias', null, () => showAliasModal(key)),
      btn(key.rotation_enabled ? 'Disable rotation' : 'Enable rotation', 'kms-btn-secondary', () => setRotation(key, !key.rotation_enabled).catch((error) => toast(error.message, true))),
      btn('Cancel deletion', 'kms-btn-secondary', () => cancelDeletion(key).catch((error) => toast(error.message, true))),
      btn('Schedule deletion', 'kms-btn-danger', () => scheduleDeletion(key).catch((error) => toast(error.message, true))),
    );
    body.append(actions);
    panel.append(body);
    return panel;
  }

  function renderResult(title, value) {
    const card = el('article', 'kms-result');
    const heading = el('div', 'kms-result-heading');
    heading.append(el('h3', null, title));
    card.append(heading);
    const pre = el('pre');
    pre.textContent = JSON.stringify(consoleUi.displayValue(value), null, 2);
    card.append(pre);
    if (value.ciphertext_blob) {
      card.append(btn('Copy ciphertext', 'kms-btn-secondary', () => copyText(value.ciphertext_blob, 'Ciphertext')));
    }
    if (value.plaintext_base64) {
      card.append(btn('Copy plaintext key', 'kms-btn-secondary', () => copyText(value.plaintext_base64, 'Plaintext key')));
    }
    return card;
  }

  function renderWorkbench() {
    const workbench = el('div', 'kms-workbench');
    const key = selectedKey();
    workbench.append(renderKeyList());
    const detail = el('div', 'kms-detail-stack');
    if (!key) {
      detail.append(
        el('section', 'kms-panel kms-empty-panel', 'Create a key to start encrypting local test payloads.'),
        renderRandomPanel(),
      );
    } else {
      detail.append(renderKeyDetail(key), renderCryptoPanel(key), renderDataKeyPanel(key), renderRandomPanel());
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
      [btn('Create key', null, showCreateKeyModal), btn('Delete alias', 'kms-btn-secondary', showDeleteAliasModal)],
      [el('span', 'kms-toolbar-note', 'Local key lifecycle and crypto test flows')],
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
    const data = await apiJson('/api/kms/');
    state.inventory = data;
    if (!state.selectedKeyId && keys()[0]) {
      state.selectedKeyId = keyId(keys()[0]);
    }
    render();
  }

  return { refresh };
})();

window.KMSConsole = KMSConsole;
