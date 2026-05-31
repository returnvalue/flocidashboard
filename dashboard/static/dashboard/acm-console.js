/* global ServiceConsole */

const ACMConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('acm-console-root');
  const breadcrumbsEl = document.getElementById('acm-breadcrumbs');
  const summaryEl = document.getElementById('acm-summary');
  const loadedAtEl = document.getElementById('acm-loaded-at');

  const state = {
    inventory: null,
    selectedArn: '',
    lastPem: null,
    lastExport: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'acm',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'acm');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'acm',
      toast,
    });

  function certificates() {
    return state.inventory?.certificates || [];
  }

  function certificateArn(cert) {
    return cert?.arn || cert?.certificate_arn || '';
  }

  function certPath(cert) {
    return `/api/acm/certificates/${encodeURIComponent(certificateArn(cert))}/`;
  }

  function selectedCertificate() {
    return certificates().find((cert) => certificateArn(cert) === state.selectedArn) || certificates()[0] || null;
  }

  function certName(cert) {
    return cert?.domain_name || cert?.name || certificateArn(cert) || 'Unnamed certificate';
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'ACM');
    home.addEventListener('click', () => {
      state.selectedArn = certificates()[0] ? certificateArn(certificates()[0]) : '';
      render();
    });
    breadcrumbsEl.append(home);
    const cert = selectedCertificate();
    if (cert) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, certName(cert)));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'acm',
      targets: {
        certificates: 'Certificates',
        issued: 'Certificates',
        amazon_issued: 'Certificates',
        private: 'Certificates',
      },
    });
  }

  function parseLines(value) {
    return String(value || '')
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function parseTags(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return [];
    }
    return JSON.parse(trimmed).map((tag) => ({
      Key: tag.Key || tag.TagKey || tag.key,
      Value: tag.Value ?? tag.TagValue ?? tag.value ?? '',
    }));
  }

  function copyText(value, label) {
    navigator.clipboard?.writeText(value).then(
      () => toast(`${label} copied`),
      () => toast(`${label}: ${value}`),
    );
  }

  function showRequestModal() {
    const form = el('div', 'acm-modal-form');
    const domain = document.createElement('input');
    domain.placeholder = 'example.com';
    const sans = document.createElement('textarea');
    sans.placeholder = 'www.example.com\n*.example.com';
    const validationMethod = document.createElement('select');
    ['DNS', 'EMAIL'].forEach((value) => validationMethod.append(new Option(value, value)));
    const keyAlgorithm = document.createElement('select');
    (state.inventory?.key_algorithms || ['RSA_2048', 'RSA_3072', 'RSA_4096', 'EC_prime256v1']).forEach((value) => {
      keyAlgorithm.append(new Option(value, value));
    });
    const caArn = document.createElement('input');
    caArn.placeholder = 'arn:aws:acm-pca:us-east-1:123456789012:certificate-authority/...';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '[{"Key":"Environment","Value":"Local"}]';
    form.append(
      el('label', null, 'Domain name'),
      domain,
      el('label', null, 'Subject alternative names'),
      sans,
      el('label', null, 'Validation method'),
      validationMethod,
      el('label', null, 'Key algorithm'),
      keyAlgorithm,
      el('label', null, 'Certificate authority ARN'),
      caArn,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );

    openModal('Request certificate', form, 'Request certificate', async (close) => {
      const data = await apiJson('/api/acm/certificates/', {
        method: 'POST',
        body: JSON.stringify({
          domain_name: domain.value.trim(),
          subject_alternative_names: parseLines(sans.value),
          validation_method: validationMethod.value,
          key_algorithm: keyAlgorithm.value,
          certificate_authority_arn: caArn.value.trim(),
          tags: parseTags(tagsInput.value),
        }),
      });
      state.selectedArn = data.certificate_arn || '';
      close();
      toast('Certificate requested');
      await refresh();
    });
  }

  function showTagsModal(cert) {
    const form = el('div', 'acm-modal-form');
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '[{"Key":"Project","Value":"Demo"}]';
    const removeInput = document.createElement('input');
    removeInput.placeholder = 'Environment,Owner';
    form.append(
      el('label', null, 'Add tags JSON'),
      tagsInput,
      btn('Add tags', null, async () => {
        try {
          await apiJson(`${certPath(cert)}tags/`, {
            method: 'POST',
            body: JSON.stringify({ tags: parseTags(tagsInput.value) }),
          });
          toast('Tags added');
          await refresh();
        } catch (error) {
          toast(error.message, true);
        }
      }),
      el('label', null, 'Remove tag keys'),
      removeInput,
      btn('Remove tags', 'acm-btn-secondary', async () => {
        try {
          await apiJson(`${certPath(cert)}tags/`, {
            method: 'DELETE',
            body: JSON.stringify({ tag_keys: parseLines(removeInput.value) }),
          });
          toast('Tags removed');
          await refresh();
        } catch (error) {
          toast(error.message, true);
        }
      }),
    );
    openModal('Certificate tags', form, 'Done', (close) => close());
  }

  function showExportModal(cert) {
    const form = el('div', 'acm-modal-form');
    const passphrase = document.createElement('input');
    passphrase.placeholder = 'Base64 passphrase';
    form.append(el('label', null, 'Passphrase'), passphrase);
    openModal('Export certificate', form, 'Export', async (close) => {
      const data = await apiJson(`${certPath(cert)}export/`, {
        method: 'POST',
        body: JSON.stringify({ passphrase: passphrase.value.trim() }),
      });
      state.lastExport = data;
      close();
      toast('Certificate exported');
      render();
    });
  }

  function showAccountConfigModal() {
    const form = el('div', 'acm-modal-form');
    const days = document.createElement('input');
    days.type = 'number';
    days.min = '1';
    days.max = '45';
    days.value = state.inventory?.account_configuration?.ExpiryEvents?.DaysBeforeExpiry || 45;
    form.append(el('label', null, 'Days before expiry'), days);
    openModal('Account configuration', form, 'Save', async (close) => {
      await apiJson('/api/acm/account-configuration/', {
        method: 'PUT',
        body: JSON.stringify({ days_before_expiry: days.value }),
      });
      close();
      toast('Account configuration updated');
      await refresh();
    });
  }

  async function getPem(cert) {
    const data = await apiJson(certPath(cert));
    state.lastPem = data;
    state.lastExport = null;
    toast('Certificate PEM loaded');
    render();
  }

  async function renew(cert) {
    await apiJson(`${certPath(cert)}renew/`, { method: 'POST' });
    toast('Renewal requested');
    await refresh();
  }

  async function deleteCert(cert) {
    if (!window.confirm('Delete this certificate?')) {
      return;
    }
    await apiJson(certPath(cert), { method: 'DELETE' });
    state.selectedArn = '';
    state.lastPem = null;
    state.lastExport = null;
    toast('Certificate deleted');
    await refresh();
  }

  function renderCertificateRow(cert) {
    const active = certificateArn(cert) === certificateArn(selectedCertificate());
    const row = el('button', `acm-cert-row${active ? ' acm-cert-row-active' : ''}`);
    row.append(
      el('span', 'acm-cert-name', certName(cert)),
      el('span', 'acm-cert-meta', `${cert.status || 'Unknown'} / ${cert.type || 'Unknown'}`),
    );
    row.addEventListener('click', () => {
      state.selectedArn = certificateArn(cert);
      state.lastPem = null;
      state.lastExport = null;
      render();
    });
    return row;
  }

  function renderCertificateList() {
    const panel = el('section', 'acm-panel');
    panel.append(el('div', 'acm-panel-heading', 'Certificates'));
    const list = el('div', 'acm-cert-list');
    if (!certificates().length) {
      list.append(el('div', 'acm-empty', 'No ACM certificates found.'));
    } else {
      certificates().forEach((cert) => list.append(renderCertificateRow(cert)));
    }
    panel.append(list);
    return panel;
  }

  function renderCertificateDetail(cert) {
    const panel = el('section', 'acm-panel');
    panel.append(el('div', 'acm-panel-heading', 'Selected certificate'));
    const body = el('div', 'acm-detail');
    const facts = el('dl', 'acm-facts');
    consoleUi.addField(facts, 'Domain', cert.domain_name);
    consoleUi.addField(facts, 'ARN', certificateArn(cert));
    consoleUi.addField(facts, 'Status', cert.status);
    consoleUi.addField(facts, 'Type', cert.type);
    consoleUi.addField(facts, 'Key algorithm', cert.key_algorithm);
    consoleUi.addField(facts, 'Issued at', consoleUi.formatDate(cert.issued_at));
    consoleUi.addField(facts, 'Not after', consoleUi.formatDate(cert.not_after));
    consoleUi.addField(facts, 'Subject alternative names', cert.subject_alternative_names);
    consoleUi.addField(facts, 'Validation options', cert.domain_validation_options);
    consoleUi.addField(facts, 'Tags', cert.tags);
    body.append(facts);
    const actions = el('div', 'acm-action-row');
    actions.append(
      btn('Get PEM', null, () => getPem(cert).catch((error) => toast(error.message, true))),
      btn('Tags', 'acm-btn-secondary', () => showTagsModal(cert)),
      btn('Renew', 'acm-btn-secondary', () => renew(cert).catch((error) => toast(error.message, true))),
      btn('Export', 'acm-btn-secondary', () => showExportModal(cert)),
      btn('Delete', 'acm-btn-danger', () => deleteCert(cert).catch((error) => toast(error.message, true))),
    );
    body.append(actions);
    panel.append(body);
    return panel;
  }

  function renderResult(title, value) {
    const card = el('article', 'acm-result');
    card.append(el('div', 'acm-result-heading', title));
    const pre = el('pre');
    pre.textContent = JSON.stringify(consoleUi.displayValue(value), null, 2);
    card.append(pre);
    if (value?.Certificate) {
      card.append(btn('Copy certificate', 'acm-btn-secondary', () => copyText(value.Certificate, 'Certificate')));
    }
    if (value?.PrivateKey) {
      card.append(btn('Copy private key', 'acm-btn-secondary', () => copyText(value.PrivateKey, 'Private key')));
    }
    return card;
  }

  function renderSupportPanel() {
    const panel = el('section', 'acm-panel');
    panel.append(el('div', 'acm-panel-heading', 'Local ACM behavior'));
    const body = el('div', 'acm-detail');
    const facts = el('dl', 'acm-facts');
    consoleUi.addField(facts, 'Key algorithms', state.inventory?.key_algorithms);
    consoleUi.addField(facts, 'Certificate types', state.inventory?.certificate_types);
    consoleUi.addField(facts, 'Notes', state.inventory?.notes);
    body.append(facts);
    panel.append(body);
    return panel;
  }

  function renderWorkbench() {
    const workbench = el('div', 'acm-workbench');
    const cert = selectedCertificate();
    workbench.append(renderCertificateList());
    const detail = el('div', 'acm-detail-stack');
    if (!cert) {
      detail.append(el('section', 'acm-panel acm-empty-panel', 'Request a certificate to start testing local TLS workflows.'));
    } else {
      detail.append(renderCertificateDetail(cert));
      if (state.lastPem) {
        detail.append(renderResult('Certificate PEM', state.lastPem));
      }
      if (state.lastExport) {
        detail.append(renderResult('Exported private certificate', state.lastExport));
      }
    }
    detail.append(renderSupportPanel());
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
      [btn('Request certificate', null, showRequestModal), btn('Account config', 'acm-btn-secondary', showAccountConfigModal)],
      [el('span', 'acm-toolbar-note', 'Local certificate issuance and export workflows')],
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
    const data = await apiJson('/api/acm/');
    state.inventory = data;
    if (!state.selectedArn && certificates()[0]) {
      state.selectedArn = certificateArn(certificates()[0]);
    }
    render();
  }

  return { refresh };
})();

window.ACMConsole = ACMConsole;
