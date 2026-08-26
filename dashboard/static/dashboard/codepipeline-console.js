/* global ServiceConsole */

const CodePipelineConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('codepipeline-console-root');
  const breadcrumbsEl = document.getElementById('codepipeline-breadcrumbs');
  const summaryEl = document.getElementById('codepipeline-summary');
  const loadedAtEl = document.getElementById('codepipeline-loaded-at');
  const params = new URLSearchParams(window.location.search);

  const state = {
    inventory: null,
    selectedPipelineName: params.get('pipeline') || '',
    pipelineState: null,
    pipelineExecutions: [],
    lastResult: null,
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'codepipeline', type: isError ? 'error' : 'success',
  });
  const toolbar = (left, right) => consoleUi.toolbar(left, right, 'codepipeline');
  const openModal = (title, body, label, submit) => consoleUi.openModal(title, body, label, submit, { classPrefix: 'codepipeline', toast });

  function pipelines() { return state.inventory?.pipelines || []; }
  function selectedPipeline() {
    return pipelines().find((p) => (p.name || p.Name) === state.selectedPipelineName) || pipelines()[0] || null;
  }
  function pipelineName(p = selectedPipeline()) { return p?.name || p?.Name || ''; }

  function urlFor(pName = '') {
    const query = new URLSearchParams();
    if (pName) query.set('pipeline', pName);
    return `${window.location.pathname}?${query}`;
  }

  function syncUrl() {
    window.history.replaceState({}, '', urlFor(state.selectedPipelineName));
  }

  function choose(pName = '') {
    state.selectedPipelineName = pName;
    syncUrl();
    loadPipelineDetails(pName).then(() => render());
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'codepipeline',
      targets: {
        pipelines: 'Pipelines',
        stages: 'Stages',
        executions: 'Executions',
        webhooks: 'Webhooks',
        custom_action_types: 'Action types',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) return;
    breadcrumbsEl.textContent = '';
    breadcrumbsEl.append(btn('CodePipeline', null, () => choose('')));
    if (selectedPipeline()) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, pipelineName()));
    }
  }

  function parseJson(value, fallback = null, label = 'JSON') {
    const clean = String(value || '').trim();
    if (!clean) return fallback;
    try { return JSON.parse(clean); } catch (e) { throw new Error(`${label} must be valid JSON: ${e.message}`); }
  }

  async function mutate(url, payload, message) {
    const data = await apiJson(url, { method: 'POST', body: JSON.stringify(payload) });
    toast(message);
    await refresh();
    return data;
  }

  async function loadPipelineDetails(pName) {
    if (!pName) return;
    try {
      const [stateRes, execRes] = await Promise.all([
        apiJson(`/api/codepipeline/pipelines/${encodeURIComponent(pName)}/state/`),
        apiJson(`/api/codepipeline/pipelines/${encodeURIComponent(pName)}/executions/`),
      ]);
      state.pipelineState = stateRes;
      state.pipelineExecutions = execRes.pipeline_execution_summaries || [];
    } catch (e) {
      state.pipelineState = null;
      state.pipelineExecutions = [];
    }
  }

  function showCreatePipelineModal() {
    const form = el('div', 'codepipeline-modal-form');
    const nameInput = document.createElement('input'); nameInput.placeholder = 'my-delivery-pipeline';
    const roleInput = document.createElement('input'); roleInput.value = 'arn:aws:iam::000000000000:role/service-role/pipeline-role';
    const bucketInput = document.createElement('input'); bucketInput.value = 'my-pipeline-artifacts-bucket';
    const presetSelect = document.createElement('select');

    const presets = [
      { name: 'Source (S3) -> Build (CodeBuild) -> Deploy (CodeDeploy)', val: 's3_build_deploy' },
      { name: 'Source (S3) -> Approval -> Deploy (ECS)', val: 's3_approval_ecs' },
    ];
    presets.forEach((pr) => {
      const opt = el('option', null, pr.name);
      opt.value = pr.val;
      presetSelect.append(opt);
    });

    form.append(
      el('label', null, 'Pipeline name'), nameInput,
      el('label', null, 'Service role ARN'), roleInput,
      el('label', null, 'Artifact bucket name'), bucketInput,
      el('label', null, 'Pipeline Structure Preset'), presetSelect,
    );

    openModal('Create Pipeline', form, 'Create pipeline', async (close) => {
      const pName = nameInput.value.trim();
      if (!pName) throw new Error('Pipeline name is required');

      let stages = [];
      if (presetSelect.value === 's3_build_deploy') {
        stages = [
          {
            name: 'Source',
            actions: [{
              name: 'S3Source',
              actionTypeId: { category: 'Source', owner: 'AWS', provider: 'S3', version: '1' },
              configuration: { S3Bucket: bucketInput.value.trim(), S3ObjectKey: 'app.zip' },
              outputArtifacts: [{ name: 'SourceArtifact' }],
            }],
          },
          {
            name: 'Build',
            actions: [{
              name: 'BuildApp',
              actionTypeId: { category: 'Build', owner: 'AWS', provider: 'CodeBuild', version: '1' },
              configuration: { ProjectName: 'my-build-project' },
              inputArtifacts: [{ name: 'SourceArtifact' }],
              outputArtifacts: [{ name: 'BuildArtifact' }],
            }],
          },
          {
            name: 'Deploy',
            actions: [{
              name: 'DeployApp',
              actionTypeId: { category: 'Deploy', owner: 'AWS', provider: 'CodeDeploy', version: '1' },
              configuration: { ApplicationName: 'MyApplication', DeploymentGroupName: 'ProductionGroup' },
              inputArtifacts: [{ name: 'BuildArtifact' }],
            }],
          },
        ];
      } else {
        stages = [
          {
            name: 'Source',
            actions: [{
              name: 'S3Source',
              actionTypeId: { category: 'Source', owner: 'AWS', provider: 'S3', version: '1' },
              configuration: { S3Bucket: bucketInput.value.trim(), S3ObjectKey: 'app.zip' },
              outputArtifacts: [{ name: 'SourceArtifact' }],
            }],
          },
          {
            name: 'Approval',
            actions: [{
              name: 'ProductionApproval',
              actionTypeId: { category: 'Approval', owner: 'AWS', provider: 'Manual', version: '1' },
              configuration: { CustomData: 'Please approve deployment to production.' },
            }],
          },
          {
            name: 'Deploy',
            actions: [{
              name: 'DeployECS',
              actionTypeId: { category: 'Deploy', owner: 'AWS', provider: 'ECS', version: '1' },
              configuration: { ClusterName: 'production-cluster', ServiceName: 'web-service' },
              inputArtifacts: [{ name: 'SourceArtifact' }],
            }],
          },
        ];
      }

      await mutate('/api/codepipeline/pipelines/', {
        pipeline: {
          name: pName,
          roleArn: roleInput.value.trim(),
          artifactStore: { type: 'S3', location: bucketInput.value.trim() },
          stages,
        },
      }, `Pipeline ${pName} created`);

      state.selectedPipelineName = pName;
      close();
      choose(pName);
    });
  }

  function showApprovalModal(pName, stageName, actionName) {
    const form = el('div', 'codepipeline-modal-form');
    const statusSelect = document.createElement('select');
    statusSelect.append(el('option', null, 'Approved'), el('option', null, 'Rejected'));
    const summaryInput = document.createElement('textarea');
    summaryInput.placeholder = 'Approval comments (e.g. QA testing passed, approved for release)';

    form.append(
      el('label', null, `Review manual approval for stage "${stageName}" / action "${actionName}"`),
      el('label', null, 'Status Decision'), statusSelect,
      el('label', null, 'Comments / Summary'), summaryInput,
    );

    openModal('Manual Approval Gate', form, 'Submit Decision', async (close) => {
      await mutate(`/api/codepipeline/pipelines/${encodeURIComponent(pName)}/approve/`, {
        pipeline_name: pName,
        stage_name: stageName,
        action_name: actionName,
        status: statusSelect.value,
        summary: summaryInput.value.trim(),
      }, `Approval decision (${statusSelect.value}) submitted`);
      close();
      await loadPipelineDetails(pName);
      render();
    });
  }

  function showTransitionModal(pName, stageName, currentlyEnabled) {
    const form = el('div', 'codepipeline-modal-form');
    const reasonInput = document.createElement('input');
    reasonInput.placeholder = 'Lock reason (e.g. Deployment freeze for holiday)';
    form.append(
      el('label', null, `${currentlyEnabled ? 'Disable' : 'Enable'} inbound transition for stage "${stageName}"?`),
      currentlyEnabled ? el('label', null, 'Reason') : el('span', null, ''),
      currentlyEnabled ? reasonInput : el('span', null, ''),
    );

    openModal(`${currentlyEnabled ? 'Disable' : 'Enable'} Stage Transition`, form, currentlyEnabled ? 'Lock Transition' : 'Unlock Transition', async (close) => {
      await mutate(`/api/codepipeline/pipelines/${encodeURIComponent(pName)}/transitions/`, {
        pipeline_name: pName,
        stage_name: stageName,
        enabled: !currentlyEnabled,
        reason: reasonInput.value.trim(),
      }, `Transition for stage ${stageName} ${currentlyEnabled ? 'disabled' : 'enabled'}`);
      close();
      await loadPipelineDetails(pName);
      render();
    });
  }

  function renderVisualGraph(p) {
    const wrapper = el('div', 'codepipeline-graph-container');
    const stageStates = state.pipelineState?.stage_states || [];
    const stages = p.stages || [];

    if (!stages.length && !stageStates.length) {
      wrapper.append(el('p', 'codepipeline-empty', 'No stages defined for this pipeline.'));
      return wrapper;
    }

    const displayStages = stages.length ? stages : stageStates.map((s) => ({
      name: s.stageName,
      actions: (s.actionStates || []).map((a) => ({ name: a.actionName })),
    }));

    const stageNodes = el('div', 'codepipeline-stage-row');

    displayStages.forEach((st, idx) => {
      const sState = stageStates.find((item) => item.stageName === st.name);
      const isTransitionDisabled = sState?.inboundTransitionState && !sState.inboundTransitionState.enabled;

      // Inbound transition connector between stages
      if (idx > 0) {
        const transNode = el('div', 'codepipeline-transition-node');
        const lockBtn = el(
          'button',
          `codepipeline-transition-btn${isTransitionDisabled ? ' codepipeline-transition-locked' : ''}`,
          isTransitionDisabled ? '🔒' : '➔',
        );
        lockBtn.title = isTransitionDisabled ? `Transition locked: ${sState.inboundTransitionState.disabledReason || 'Disabled'}` : 'Transition enabled. Click to toggle lock.';
        lockBtn.addEventListener('click', () => showTransitionModal(pipelineName(p), st.name, !isTransitionDisabled));
        transNode.append(lockBtn);
        stageNodes.append(transNode);
      }

      // Stage Card
      const card = el('div', 'codepipeline-stage-card');
      const head = el('div', 'codepipeline-stage-header');
      head.append(
        el('strong', 'codepipeline-stage-title', st.name),
        el('span', 'codepipeline-stage-status', sState?.latestExecution?.status || 'Active'),
      );
      card.append(head);

      const actionsList = el('div', 'codepipeline-actions-list');
      const actionItems = st.actions || [];

      actionItems.forEach((act) => {
        const actState = (sState?.actionStates || []).find((a) => a.actionName === act.name);
        const status = actState?.latestExecution?.status || 'Succeeded';
        const isApproval = (act.actionTypeId?.category === 'Approval' || act.name.toLowerCase().includes('approval'));

        const actNode = el('div', `codepipeline-action-card codepipeline-status-${status.toLowerCase()}`);
        const actHead = el('div', 'codepipeline-action-header');
        actHead.append(
          el('span', 'codepipeline-action-name', act.name),
          el('span', `codepipeline-badge codepipeline-badge-${status.toLowerCase()}`, status),
        );
        actNode.append(actHead);

        const metaRow = el('div', 'codepipeline-action-meta');
        metaRow.append(el('span', null, `${act.actionTypeId?.provider || 'AWS'} · ${act.actionTypeId?.category || 'Action'}`));
        actNode.append(metaRow);

        if (isApproval) {
          const approveBtn = btn('Review approval', 'codepipeline-btn-approval', () => {
            showApprovalModal(pipelineName(p), st.name, act.name);
          });
          actNode.append(approveBtn);
        }

        actionsList.append(actNode);
      });

      card.append(actionsList);

      // Retry action if stage failed
      if (sState?.latestExecution?.status === 'Failed' && sState?.latestExecution?.pipelineExecutionId) {
        const retryBtn = btn('↻ Retry stage', 'secondary-button', async () => {
          await mutate(`/api/codepipeline/pipelines/${encodeURIComponent(pipelineName(p))}/retry/`, {
            pipeline_name: pipelineName(p),
            stage_name: st.name,
            pipeline_execution_id: sState.latestExecution.pipelineExecutionId,
          }, `Stage ${st.name} retried`);
          await loadPipelineDetails(pipelineName(p));
          render();
        });
        card.append(retryBtn);
      }

      stageNodes.append(card);
    });

    wrapper.append(stageNodes);
    return wrapper;
  }

  function renderExecutionsTable() {
    const section = el('div', 'codepipeline-panel');
    section.append(el('div', 'codepipeline-panel-heading', 'Recent Pipeline Executions'));
    const body = el('div', 'codepipeline-panel-body');

    if (!state.pipelineExecutions.length) {
      body.append(el('p', 'codepipeline-empty', 'No recent executions found for this pipeline. Click "Release change" to run.'));
    } else {
      const table = document.createElement('table');
      table.className = 'codepipeline-table';
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Execution ID</th><th>Status</th><th>Start Time</th><th>Last Updated</th></tr>';
      table.append(thead);

      const tbody = document.createElement('tbody');
      state.pipelineExecutions.forEach((ex) => {
        const tr = document.createElement('tr');
        const idTd = document.createElement('td');
        idTd.append(el('code', null, (ex.pipelineExecutionId || '').substring(0, 18) + '...'));
        const stTd = document.createElement('td');
        stTd.append(el('span', `codepipeline-badge codepipeline-badge-${(ex.status || '').toLowerCase()}`, ex.status || 'InProgress'));
        const startTd = document.createElement('td');
        startTd.textContent = consoleUi.formatDate(ex.startTime);
        const upTd = document.createElement('td');
        upTd.textContent = consoleUi.formatDate(ex.lastUpdateTime);
        tr.append(idTd, stTd, startTd, upTd);
        tbody.append(tr);
      });
      table.append(tbody);
      body.append(table);
    }
    section.append(body);
    return section;
  }

  function renderWorkbench() {
    const p = selectedPipeline();
    const container = el('div');

    container.append(toolbar(
      [
        btn('+ Create pipeline', 'primary-button', showCreatePipelineModal),
        btn('▶ Release change', 'secondary-button', async () => {
          if (!p) return;
          const res = await mutate(`/api/codepipeline/pipelines/${encodeURIComponent(pipelineName(p))}/start/`, {
            name: pipelineName(p),
          }, `Pipeline execution ${res?.pipeline_execution_id || 'started'}`);
          await loadPipelineDetails(pipelineName(p));
          render();
        }),
        btn('Delete pipeline', 'codepipeline-btn-danger', async () => {
          if (!p) return;
          if (window.confirm(`Delete pipeline ${pipelineName(p)}?`)) {
            await mutate('/api/codepipeline/pipelines/delete/', { name: pipelineName(p) }, `Pipeline ${pipelineName(p)} deleted`);
            state.selectedPipelineName = '';
            choose('');
          }
        }),
      ],
      [],
    ));

    [...container.querySelectorAll('button')].slice(1).forEach((b) => { b.disabled = !p; });

    const wb = el('div', 'codepipeline-workbench');

    // Left column: Pipeline list
    const listPanel = el('div', 'codepipeline-panel');
    listPanel.append(el('div', 'codepipeline-panel-heading', 'Delivery Pipelines'));
    const listBody = el('div', 'codepipeline-list');

    if (!pipelines().length) {
      listBody.append(el('p', 'codepipeline-empty', 'No CodePipeline pipelines found. Click + Create pipeline to build a delivery flow.'));
    } else {
      pipelines().forEach((item) => {
        const name = pipelineName(item);
        const row = el('button', `codepipeline-row${name === pipelineName(p) ? ' codepipeline-row-active' : ''}`);
        row.append(
          el('strong', 'codepipeline-name', name),
          el('span', 'codepipeline-meta', `${(item.stages || []).length} stages`),
        );
        row.addEventListener('click', () => choose(name));
        listBody.append(row);
      });
    }
    listPanel.append(listBody);
    wb.append(listPanel);

    // Right column: Detail & Visual Graph
    const detailPanel = el('div', 'codepipeline-panel');
    detailPanel.append(el('div', 'codepipeline-panel-heading', p ? `Pipeline: ${pipelineName(p)}` : 'Pipeline Detail'));
    const detailBody = el('div', 'codepipeline-panel-body');

    if (!p) {
      detailBody.append(el('p', 'codepipeline-empty', 'Select or create a pipeline to inspect stages, executions, and visual flow.'));
    } else {
      const summary = document.createElement('dl');
      consoleUi.addField(summary, 'Pipeline Name', pipelineName(p));
      consoleUi.addField(summary, 'Role ARN', p.roleArn);
      consoleUi.addField(summary, 'Artifact Store', p.artifactStore?.location || 'S3');
      consoleUi.addField(summary, 'Version', p.version || 1);
      detailBody.append(summary);

      // Visual DAG
      detailBody.append(renderVisualGraph(p));

      // Executions table
      detailBody.append(renderExecutionsTable());
    }

    detailPanel.append(detailBody);
    wb.append(detailPanel);

    container.append(wb);
    return container;
  }

  function render() {
    if (!root) return;
    renderBreadcrumbs();
    root.textContent = '';
    root.append(renderWorkbench());
    if (loadedAtEl) loadedAtEl.textContent = `Loaded ${new Date().toLocaleTimeString()}`;
  }

  async function refresh() {
    const data = await apiJson('/api/codepipeline/');
    state.inventory = data;
    if (!state.selectedPipelineName && pipelines().length) {
      state.selectedPipelineName = pipelineName(pipelines()[0]);
    }
    if (state.selectedPipelineName) {
      await loadPipelineDetails(state.selectedPipelineName);
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) return;
    root.append(el('p', 'codepipeline-empty', 'Loading CodePipeline workbench...'));
    refresh().catch((err) => toast(err.message, true));
  }

  return { init, refresh };
})();

window.CodePipelineConsole = CodePipelineConsole;

if (document.getElementById('codepipeline-console-root')) {
  CodePipelineConsole.init();
}
