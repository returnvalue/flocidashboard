/* global ServiceConsole */

const BackupConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('backup-console-root');
  const breadcrumbsEl = document.getElementById('backup-breadcrumbs');
  const summaryEl = document.getElementById('backup-summary');
  const loadedAtEl = document.getElementById('backup-loaded-at');

  const state = {
    inventory: null,
    selectedVaultName: '',
    selectedPlanId: '',
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'backup',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'backup');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'backup',
      toast,
    });

  function vaults() {
    return state.inventory?.vaults || [];
  }

  function plans() {
    return state.inventory?.plans || [];
  }

  function jobs() {
    return state.inventory?.backup_jobs || [];
  }

  function vaultName(vault) {
    return vault?.name || vault?.BackupVaultName || '';
  }

  function planId(plan) {
    return plan?.id || plan?.BackupPlanId || '';
  }

  function selectedVault() {
    return vaults().find((vault) => vaultName(vault) === state.selectedVaultName) || vaults()[0] || null;
  }

  function selectedPlan() {
    return plans().find((plan) => planId(plan) === state.selectedPlanId) || plans()[0] || null;
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

  function backupPlanTemplate(vault = selectedVault()) {
    return {
      BackupPlanName: 'daily-backup',
      Rules: [{
        RuleName: 'daily',
        TargetBackupVaultName: vaultName(vault) || 'my-vault',
        ScheduleExpression: 'cron(0 12 * * ? *)',
        StartWindowMinutes: 60,
        CompletionWindowMinutes: 120,
      }],
    };
  }

  function selectionTemplate() {
    return {
      SelectionName: 'local-resources',
      IamRoleArn: 'arn:aws:iam::000000000000:role/backup-role',
      Resources: ['arn:aws:dynamodb:us-east-1:000000000000:table/my-table'],
    };
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('AWS Backup', null, () => {
      state.selectedVaultName = vaults()[0] ? vaultName(vaults()[0]) : '';
      state.selectedPlanId = plans()[0] ? planId(plans()[0]) : '';
      render();
    }));
    const vault = selectedVault();
    if (vault) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, vaultName(vault)));
    }
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'backup',
      targets: {
        vaults: 'Backup vaults',
        plans: 'Backup plans',
        backup_jobs: 'Backup jobs',
        restore_jobs: 'Restore jobs',
        protected_resources: 'Protected resources',
        recovery_points: 'Backup vaults',
      },
    });
  }

  function showCreateVaultModal() {
    const form = el('div', 'backup-modal-form');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'my-vault';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{"env":"dev"}';
    const keyInput = document.createElement('input');
    keyInput.placeholder = 'arn:aws:kms:us-east-1:000000000000:key/local-key';
    form.append(
      el('label', null, 'Backup vault name'),
      nameInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
      el('label', null, 'Encryption key ARN'),
      keyInput,
    );
    openModal('Create backup vault', form, 'Create', async (close) => {
      const data = await apiJson('/api/backup/vaults/', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.value.trim(),
          tags: parseJson(tagsInput.value, {}, 'Tags'),
          encryption_key_arn: keyInput.value.trim(),
        }),
      });
      state.selectedVaultName = data.vault_name || nameInput.value.trim();
      state.lastResult = data;
      close();
      toast('Backup vault created');
      await refresh();
    });
  }

  function showCreatePlanModal() {
    const form = el('div', 'backup-modal-form');
    const planInput = document.createElement('textarea');
    planInput.value = JSON.stringify(backupPlanTemplate(), null, 2);
    form.append(el('label', null, 'Backup plan JSON'), planInput);
    openModal('Create backup plan', form, 'Create', async (close) => {
      const data = await apiJson('/api/backup/plans/', {
        method: 'POST',
        body: JSON.stringify({ backup_plan: parseJson(planInput.value, {}, 'Backup plan') }),
      });
      state.selectedPlanId = data.backup_plan_id || '';
      state.lastResult = data;
      close();
      toast('Backup plan created');
      await refresh();
    });
  }

  function showCreateSelectionModal(plan = selectedPlan()) {
    const form = el('div', 'backup-modal-form');
    const planInput = document.createElement('input');
    planInput.value = planId(plan);
    const selectionInput = document.createElement('textarea');
    selectionInput.value = JSON.stringify(selectionTemplate(), null, 2);
    form.append(
      el('label', null, 'Backup plan ID'),
      planInput,
      el('label', null, 'Backup selection JSON'),
      selectionInput,
    );
    openModal('Create backup selection', form, 'Create', async (close) => {
      const id = planInput.value.trim();
      const data = await apiJson(`/api/backup/plans/${encodeURIComponent(id)}/selections/`, {
        method: 'POST',
        body: JSON.stringify({ backup_selection: parseJson(selectionInput.value, {}, 'Backup selection') }),
      });
      state.selectedPlanId = id;
      state.lastResult = data;
      close();
      toast('Backup selection created');
      await refresh();
    });
  }

  function showStartJobModal(vault = selectedVault()) {
    const form = el('div', 'backup-modal-form');
    const vaultInput = document.createElement('input');
    vaultInput.value = vaultName(vault);
    const resourceInput = document.createElement('input');
    resourceInput.value = 'arn:aws:dynamodb:us-east-1:000000000000:table/my-table';
    const roleInput = document.createElement('input');
    roleInput.value = 'arn:aws:iam::000000000000:role/backup-role';
    const lifecycleInput = document.createElement('textarea');
    lifecycleInput.placeholder = '{"DeleteAfterDays":30}';
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{"team":"platform"}';
    form.append(
      el('label', null, 'Backup vault name'),
      vaultInput,
      el('label', null, 'Resource ARN'),
      resourceInput,
      el('label', null, 'IAM role ARN'),
      roleInput,
      el('label', null, 'Lifecycle JSON'),
      lifecycleInput,
      el('label', null, 'Recovery point tags JSON'),
      tagsInput,
    );
    openModal('Start backup job', form, 'Start', async (close) => {
      const data = await apiJson('/api/backup/jobs/', {
        method: 'POST',
        body: JSON.stringify({
          backup_vault_name: vaultInput.value.trim(),
          resource_arn: resourceInput.value.trim(),
          iam_role_arn: roleInput.value.trim(),
          lifecycle: parseJson(lifecycleInput.value, {}, 'Lifecycle'),
          recovery_point_tags: parseJson(tagsInput.value, {}, 'Recovery point tags'),
        }),
      });
      state.selectedVaultName = vaultInput.value.trim();
      state.lastResult = data;
      close();
      toast('Backup job started');
      await refresh();
    });
  }

  function showTagModal(resourceArn = '') {
    const form = el('div', 'backup-modal-form');
    const arnInput = document.createElement('input');
    arnInput.value = resourceArn;
    const tagsInput = document.createElement('textarea');
    tagsInput.placeholder = '{"team":"platform"}';
    form.append(
      el('label', null, 'Resource ARN'),
      arnInput,
      el('label', null, 'Tags JSON'),
      tagsInput,
    );
    openModal('Tag backup resource', form, 'Save', async (close) => {
      const data = await apiJson('/api/backup/tags/', {
        method: 'POST',
        body: JSON.stringify({
          resource_arn: arnInput.value.trim(),
          tags: parseJson(tagsInput.value, {}, 'Tags'),
        }),
      });
      state.lastResult = data;
      close();
      toast('Tags saved');
      await refresh();
    });
  }

  async function deleteVault(vault) {
    if (!window.confirm(`Delete empty backup vault ${vaultName(vault)}?`)) {
      return;
    }
    const data = await apiJson(`/api/backup/vaults/${encodeURIComponent(vaultName(vault))}/`, { method: 'DELETE' });
    state.lastResult = data;
    state.selectedVaultName = '';
    toast('Backup vault deleted');
    await refresh();
  }

  async function deletePlan(plan) {
    if (!window.confirm(`Delete backup plan ${plan.name || planId(plan)}? Active selections must be removed first.`)) {
      return;
    }
    const data = await apiJson(`/api/backup/plans/${encodeURIComponent(planId(plan))}/`, { method: 'DELETE' });
    state.lastResult = data;
    state.selectedPlanId = '';
    toast('Backup plan deleted');
    await refresh();
  }

  async function deleteSelection(plan, selection) {
    const selectionId = selection.SelectionId || selection.SelectionName || '';
    if (!window.confirm(`Delete backup selection ${selectionId}?`)) {
      return;
    }
    const data = await apiJson(`/api/backup/plans/${encodeURIComponent(planId(plan))}/selections/${encodeURIComponent(selectionId)}/`, {
      method: 'DELETE',
    });
    state.lastResult = data;
    toast('Backup selection deleted');
    await refresh();
  }

  async function stopJob(job) {
    if (!window.confirm(`Stop backup job ${job.BackupJobId}?`)) {
      return;
    }
    const data = await apiJson(`/api/backup/jobs/${encodeURIComponent(job.BackupJobId)}/stop/`, { method: 'POST' });
    state.lastResult = data;
    toast('Backup job stopped');
    await refresh();
  }

  async function deleteRecoveryPoint(vault, recoveryPoint) {
    const arn = recoveryPoint.RecoveryPointArn || recoveryPoint.recovery_point_arn || '';
    if (!window.confirm('Delete this recovery point?')) {
      return;
    }
    const data = await apiJson(`/api/backup/vaults/${encodeURIComponent(vaultName(vault))}/recovery-points/`, {
      method: 'DELETE',
      body: JSON.stringify({ recovery_point_arn: arn }),
    });
    state.lastResult = data;
    toast('Recovery point deleted');
    await refresh();
  }

  function renderVaultList() {
    const panel = el('section', 'backup-panel');
    panel.append(el('div', 'backup-panel-heading', 'Backup vaults'));
    const list = el('div', 'backup-item-list');
    if (!vaults().length) {
      list.append(el('div', 'backup-empty', 'No backup vaults found.'));
    } else {
      vaults().forEach((vault) => {
        const active = vaultName(vault) === vaultName(selectedVault());
        const row = el('button', `backup-item-row${active ? ' backup-item-row-active' : ''}`);
        row.append(
          el('span', 'backup-item-name', vaultName(vault)),
          el('span', 'backup-item-meta', `${vault.recovery_point_count || 0} recovery points`),
        );
        row.addEventListener('click', () => {
          state.selectedVaultName = vaultName(vault);
          render();
        });
        list.append(row);
      });
    }
    panel.append(list);
    return panel;
  }

  function renderFacts(item, fields) {
    const facts = document.createElement('dl');
    fields.forEach(([label, key]) => consoleUi.addField(facts, label, item?.[key]));
    return facts;
  }

  function renderVaultDetail(vault) {
    const panel = el('section', 'backup-panel');
    panel.append(el('div', 'backup-panel-heading', vault ? vaultName(vault) : 'Backup vault'));
    const body = el('div', 'backup-detail');
    if (!vault) {
      body.append(el('div', 'backup-empty', 'Create a backup vault to start.'));
      panel.append(body);
      return panel;
    }
    body.append(renderFacts(vault, [
      ['ARN', 'arn'],
      ['Created', 'created'],
      ['Recovery points', 'recovery_points'],
      ['Recovery point count', 'recovery_point_count'],
      ['Encryption key ARN', 'encryption_key_arn'],
    ]));
    const actions = el('div', 'backup-action-row');
    actions.append(
      btn('Start backup job', null, () => showStartJobModal(vault)),
      btn('Tag vault', 'backup-btn-secondary', () => showTagModal(vault.arn)),
      btn('Delete vault', 'backup-btn-danger', () => deleteVault(vault).catch((error) => toast(error.message, true))),
    );
    body.append(actions, el('h3', null, 'Recovery points'), renderRecoveryPoints(vault));
    panel.append(body);
    return panel;
  }

  function renderRecoveryPoints(vault) {
    const list = el('div', 'backup-card-list');
    const points = vault.recovery_point_details || [];
    if (!points.length) {
      list.append(el('p', 'backup-empty', 'No recovery points found in this vault.'));
      return list;
    }
    points.forEach((point) => {
      const card = el('article', 'backup-card');
      card.append(el('h3', null, point.RecoveryPointArn || 'Recovery point'));
      card.append(renderFacts(point, [
        ['Resource ARN', 'ResourceArn'],
        ['Resource type', 'ResourceType'],
        ['Status', 'Status'],
        ['Created', 'CreationDate'],
        ['Backup size bytes', 'BackupSizeInBytes'],
      ]));
      card.append(btn('Delete recovery point', 'backup-btn-danger', () => deleteRecoveryPoint(vault, point).catch((error) => toast(error.message, true))));
      list.append(card);
    });
    return list;
  }

  function renderPlansPanel() {
    const panel = el('section', 'backup-panel');
    panel.append(el('div', 'backup-panel-heading', `Backup plans (${plans().length})`));
    const body = el('div', 'backup-card-list');
    if (!plans().length) {
      body.append(el('p', 'backup-empty', 'No backup plans found.'));
    }
    plans().forEach((plan) => {
      const card = el('article', 'backup-card');
      card.append(el('h3', null, plan.name || planId(plan)));
      card.append(renderFacts(plan, [
        ['Plan ID', 'id'],
        ['ARN', 'arn'],
        ['Version ID', 'version_id'],
        ['Rules', 'rules'],
        ['Selection count', 'selection_count'],
      ]));
      const actions = el('div', 'backup-action-row');
      actions.append(
        btn('Add selection', null, () => showCreateSelectionModal(plan)),
        btn('Delete plan', 'backup-btn-danger', () => deletePlan(plan).catch((error) => toast(error.message, true))),
      );
      card.append(actions);
      (plan.selections || []).forEach((selection) => {
        const selectionCard = el('article', 'backup-subcard');
        selectionCard.append(el('h3', null, selection.SelectionName || selection.SelectionId || 'Selection'));
        selectionCard.append(renderFacts(selection, [
          ['Selection ID', 'SelectionId'],
          ['IAM role ARN', 'IamRoleArn'],
          ['Resources', 'Resources'],
        ]));
        selectionCard.append(btn('Delete selection', 'backup-btn-danger', () => deleteSelection(plan, selection).catch((error) => toast(error.message, true))));
        card.append(selectionCard);
      });
      body.append(card);
    });
    panel.append(body);
    return panel;
  }

  function renderJobsPanel() {
    const panel = el('section', 'backup-panel');
    panel.append(el('div', 'backup-panel-heading', `Backup jobs (${jobs().length})`));
    const body = el('div', 'backup-card-list');
    if (!jobs().length) {
      body.append(el('p', 'backup-empty', 'No backup jobs found.'));
    }
    jobs().forEach((job) => {
      const card = el('article', 'backup-card');
      card.append(el('h3', null, job.BackupJobId || 'Backup job'));
      card.append(renderFacts(job, [
        ['State', 'State'],
        ['Vault name', 'BackupVaultName'],
        ['Resource ARN', 'ResourceArn'],
        ['Resource type', 'ResourceType'],
        ['Recovery point ARN', 'RecoveryPointArn'],
        ['Created', 'CreationDate'],
        ['Completed', 'CompletionDate'],
        ['Percent done', 'PercentDone'],
      ]));
      if (['CREATED', 'RUNNING'].includes(job.State)) {
        card.append(btn('Stop job', 'backup-btn-danger', () => stopJob(job).catch((error) => toast(error.message, true))));
      }
      body.append(card);
    });
    panel.append(body);
    return panel;
  }

  function renderLastResult() {
    if (!state.lastResult) {
      return null;
    }
    const panel = el('section', 'backup-panel');
    panel.append(el('div', 'backup-panel-heading', 'Last action result'));
    const pre = el('pre', 'backup-result');
    pre.textContent = JSON.stringify(consoleUi.displayValue(state.lastResult), null, 2);
    panel.append(pre);
    return panel;
  }

  function renderWorkbench() {
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create vault', null, showCreateVaultModal),
        btn('Create plan', 'backup-btn-secondary', showCreatePlanModal),
        btn('Create selection', 'backup-btn-secondary', () => showCreateSelectionModal()),
        btn('Start job', 'backup-btn-secondary', () => showStartJobModal()),
        btn('Tag resource', 'backup-btn-secondary', () => showTagModal()),
        btn('Refresh', 'backup-btn-secondary', () => refresh().catch((error) => toast(error.message, true))),
      ],
      [el('span', 'backup-toolbar-note', 'Jobs are simulated and create recovery points after the completion delay')],
    ));
    const workbench = el('div', 'backup-workbench');
    const detail = el('div', 'backup-detail-stack');
    detail.append(renderVaultDetail(selectedVault()), renderPlansPanel(), renderJobsPanel());
    const result = renderLastResult();
    if (result) {
      detail.append(result);
    }
    workbench.append(renderVaultList(), detail);
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
    const data = await apiJson('/api/backup/');
    state.inventory = data;
    if (!selectedVault() && vaults().length) {
      state.selectedVaultName = vaultName(vaults()[0]);
    }
    if (!selectedPlan() && plans().length) {
      state.selectedPlanId = planId(plans()[0]);
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'backup-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.BackupConsole = BackupConsole;

if (document.getElementById('backup-console-root')) {
  BackupConsole.init();
}
