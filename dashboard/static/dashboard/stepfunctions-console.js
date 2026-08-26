/* global ServiceConsole */

const StepFunctionsConsole = (() => {
  const consoleUi = window.ServiceConsole;
  const root = document.getElementById('stepfunctions-console-root');
  const breadcrumbsEl = document.getElementById('stepfunctions-breadcrumbs');
  const summaryEl = document.getElementById('stepfunctions-summary');
  const loadedAtEl = document.getElementById('stepfunctions-loaded-at');

  const state = {
    inventory: null,
    selectedStateMachineArn: '',
    selectedExecutionArn: '',
    selectedStepName: '',
    lastStartedExecutionArn: '',
  };

  const el = consoleUi.el;
  const apiJson = consoleUi.apiJson;
  const btn = consoleUi.button;
  const toast = (message, isError = false) => consoleUi.toast(message, {
    classPrefix: 'stepfunctions',
    type: isError ? 'error' : 'success',
  });
  const toolbar = (leftItems, rightItems) => consoleUi.toolbar(leftItems, rightItems, 'stepfunctions');
  const openModal = (title, bodyNode, confirmLabel, onConfirm) =>
    consoleUi.openModal(title, bodyNode, confirmLabel, onConfirm, {
      classPrefix: 'stepfunctions',
      toast,
    });

  function stateMachines() {
    return state.inventory?.state_machines || [];
  }

  function selectedStateMachine() {
    return stateMachines().find((m) => m.arn === state.selectedStateMachineArn) || stateMachines()[0] || null;
  }

  function executions(machine = selectedStateMachine()) {
    return machine?.executions || [];
  }

  function selectedExecution(machine = selectedStateMachine()) {
    const items = executions(machine);
    return items.find((execution) => execution.arn === state.selectedExecutionArn)
      || items.find((execution) => execution.arn === state.lastStartedExecutionArn)
      || items[0]
      || null;
  }

  function renderSummary(summary) {
    consoleUi.renderSummary(summary, summaryEl, {
      serviceKey: 'stepfunctions',
      targets: {
        state_machines: 'State machines',
        executions: 'Executions',
        running: 'Executions',
        succeeded: 'Executions',
        failed: 'Executions',
        versions: 'Versions',
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) return;
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'AWS Step Functions');
    home.addEventListener('click', () => {
      state.selectedStateMachineArn = '';
      state.selectedExecutionArn = '';
      state.selectedStepName = '';
      render();
    });
    breadcrumbsEl.append(home);
    const machine = selectedStateMachine();
    if (machine) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, machine.name || 'State machine'));
    }
    const execution = selectedExecution(machine);
    if (execution) {
      breadcrumbsEl.append(el('span', null, '/'), el('span', null, execution.name || 'Execution'));
    }
  }

  function parseJson(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      return {};
    }
  }

  function statusClass(status) {
    return `stepfunctions-status stepfunctions-status-${String(status || 'unknown').toLowerCase()}`;
  }

  function parseDefinition(definition) {
    if (!definition) return null;
    if (typeof definition === 'object') return definition;
    try {
      return JSON.parse(definition);
    } catch (e) {
      return null;
    }
  }

  function showCreateStateMachineModal() {
    const form = el('div', 'stepfunctions-modal-form');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'my-workflow';
    nameInput.value = 'order-processing-workflow';

    const roleInput = document.createElement('input');
    roleInput.value = 'arn:aws:iam::000000000000:role/StepFunctionsExecutionRole';

    const typeSelect = document.createElement('select');
    ['STANDARD', 'EXPRESS'].forEach((t) => {
      const opt = el('option', null, t);
      opt.value = t;
      typeSelect.append(opt);
    });

    const presetSelect = document.createElement('select');
    const presets = {
      order_flow: {
        name: 'Order Processing (Task -> Choice -> SQS/Fail)',
        def: {
          Comment: 'Process and validate customer order',
          StartAt: 'ValidateOrder',
          States: {
            ValidateOrder: {
              Type: 'Task',
              Resource: 'arn:aws:lambda:us-east-1:000000000000:function:ValidateOrderFunction',
              Next: 'CheckPaymentStatus',
            },
            CheckPaymentStatus: {
              Type: 'Choice',
              Choices: [
                {
                  Variable: '$.status',
                  StringEquals: 'APPROVED',
                  Next: 'SendOrderConfirmation',
                },
              ],
              Default: 'HandleFailedPayment',
            },
            SendOrderConfirmation: {
              Type: 'Task',
              Resource: 'arn:aws:sqs:us-east-1:000000000000:order-confirmations',
              End: true,
            },
            HandleFailedPayment: {
              Type: 'Fail',
              Error: 'PaymentDeclined',
              Cause: 'Order payment was not approved by payment processor',
            },
          },
        },
      },
      parallel_flow: {
        name: 'Parallel Branching Workflow',
        def: {
          Comment: 'Execute concurrent steps',
          StartAt: 'ParallelCheck',
          States: {
            ParallelCheck: {
              Type: 'Parallel',
              Branches: [
                {
                  StartAt: 'CheckInventory',
                  States: {
                    CheckInventory: { Type: 'Pass', Result: { inStock: true }, End: true },
                  },
                },
                {
                  StartAt: 'CheckFraud',
                  States: {
                    CheckFraud: { Type: 'Pass', Result: { riskScore: 5 }, End: true },
                  },
                },
              ],
              Next: 'AllChecksComplete',
            },
            AllChecksComplete: {
              Type: 'Succeed',
            },
          },
        },
      },
      simple_pass: {
        name: 'Simple Pass & Wait Workflow',
        def: {
          StartAt: 'Init',
          States: {
            Init: { Type: 'Pass', Result: { message: 'Initialized' }, Next: 'WaitBriefly' },
            WaitBriefly: { Type: 'Wait', Seconds: 2, Next: 'Finish' },
            Finish: { Type: 'Succeed' },
          },
        },
      },
    };

    Object.entries(presets).forEach(([k, v]) => {
      const opt = el('option', null, v.name);
      opt.value = k;
      presetSelect.append(opt);
    });

    const defArea = document.createElement('textarea');
    defArea.className = 'stepfunctions-json-input';
    defArea.style.minHeight = '200px';
    defArea.value = JSON.stringify(presets.order_flow.def, null, 2);

    presetSelect.addEventListener('change', () => {
      const selected = presets[presetSelect.value];
      if (selected) {
        defArea.value = JSON.stringify(selected.def, null, 2);
      }
    });

    form.append(
      el('label', null, 'State Machine Name'),
      nameInput,
      el('label', null, 'IAM Execution Role ARN'),
      roleInput,
      el('label', null, 'Type'),
      typeSelect,
      el('label', null, 'Workflow Template Presets'),
      presetSelect,
      el('label', null, 'Amazon States Language (ASL) JSON Definition'),
      defArea,
    );

    openModal('Create State Machine', form, 'Create', async (close) => {
      const name = nameInput.value.trim();
      if (!name) throw new Error('State machine name is required');
      const role = roleInput.value.trim();
      if (!role) throw new Error('Execution role ARN is required');
      let defObj;
      try {
        defObj = JSON.parse(defArea.value);
      } catch (e) {
        throw new Error('ASL Definition must be valid JSON: ' + e.message);
      }

      const res = await apiJson('/api/stepfunctions/state-machines/', {
        method: 'POST',
        body: JSON.stringify({
          name,
          role_arn: role,
          type: typeSelect.value,
          definition: defObj,
        }),
      });
      state.selectedStateMachineArn = res.state_machine_arn || '';
      toast(`State machine ${name} created`);
      close();
      await refresh();
    });
  }

  function showStartExecutionModal(machine) {
    const form = el('div', 'stepfunctions-modal-form');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'optional execution name';
    const inputText = document.createElement('textarea');
    inputText.required = true;
    inputText.style.minHeight = '140px';
    inputText.value = JSON.stringify({
      orderId: 'ord-' + Math.floor(Math.random() * 90000 + 10000),
      amount: 149.99,
      status: 'APPROVED',
      customer: 'customer@example.com',
    }, null, 2);
    const traceInput = document.createElement('input');
    traceInput.placeholder = 'optional trace header';

    form.append(
      el('label', null, 'State machine'),
      el('pre', 'stepfunctions-arn-preview', machine.arn),
      el('label', null, 'Execution name'),
      nameInput,
      el('label', null, 'JSON input'),
      inputText,
      el('label', null, 'Trace header'),
      traceInput,
    );

    openModal('Start execution', form, 'Start', async (close) => {
      const data = await apiJson('/api/stepfunctions/executions/start/', {
        method: 'POST',
        body: JSON.stringify({
          state_machine_arn: machine.arn,
          name: nameInput.value.trim() || null,
          input: parseJson(inputText.value),
          trace_header: traceInput.value.trim() || null,
        }),
      });
      state.lastStartedExecutionArn = data.execution_arn || '';
      state.selectedExecutionArn = data.execution_arn || '';
      close();
      toast('Execution started');
      await refresh();
    });
  }

  function showStopExecutionModal(execution) {
    const form = el('div', 'stepfunctions-modal-form');
    const errorInput = document.createElement('input');
    errorInput.placeholder = 'StoppedByDashboard';
    const causeInput = document.createElement('textarea');
    causeInput.placeholder = 'Optional stop reason';
    form.append(
      el('label', null, 'Execution'),
      el('pre', 'stepfunctions-arn-preview', execution.arn),
      el('label', null, 'Error'),
      errorInput,
      el('label', null, 'Cause'),
      causeInput,
    );

    openModal('Stop execution', form, 'Stop', async (close) => {
      await apiJson('/api/stepfunctions/executions/stop/', {
        method: 'POST',
        body: JSON.stringify({
          execution_arn: execution.arn,
          error: errorInput.value.trim() || null,
          cause: causeInput.value.trim() || null,
        }),
      });
      close();
      toast('Execution stopped');
      await refresh();
    });
  }

  function deleteVersion(version) {
    if (!window.confirm(`Delete state machine version ${version.arn}?`)) return Promise.resolve();
    return apiJson('/api/stepfunctions/state-machine-versions/delete/', {
      method: 'DELETE',
      body: JSON.stringify({ state_machine_version_arn: version.arn }),
    }).then(() => {
      toast('State machine version deleted');
      return refresh();
    });
  }

  function renderExecutionRow(execution) {
    const active = execution.arn === selectedExecution()?.arn;
    const row = el('button', `stepfunctions-execution-row${active ? ' stepfunctions-execution-row-active' : ''}`);
    row.append(
      el('span', 'stepfunctions-execution-name', execution.name || 'Unnamed execution'),
      el('span', statusClass(execution.status), execution.status || 'UNKNOWN'),
      el('span', 'stepfunctions-machine-meta', consoleUi.formatDate(execution.start_date)),
    );
    row.addEventListener('click', () => {
      state.selectedExecutionArn = execution.arn;
      state.selectedStepName = '';
      render();
    });
    return row;
  }

  function renderExecutions(machine) {
    const wrapper = el('div', 'stepfunctions-executions');
    wrapper.append(el('h3', null, 'Executions'));
    if (!executions(machine).length) {
      wrapper.append(el('div', 'stepfunctions-empty stepfunctions-empty-compact', 'No executions found. Start one to inspect its workflow graph, input, output, and step history.'));
      return wrapper;
    }
    const list = el('div', 'stepfunctions-execution-list');
    executions(machine).forEach((execution) => list.append(renderExecutionRow(execution)));
    wrapper.append(list);
    return wrapper;
  }

  function renderVersions(machine) {
    const wrapper = el('div', 'stepfunctions-executions');
    wrapper.append(el('h3', null, 'State machine versions'));
    const versions = machine?.versions || [];
    if (!versions.length) {
      wrapper.append(el('div', 'stepfunctions-empty stepfunctions-empty-compact', 'No published versions found.'));
      return wrapper;
    }
    const list = el('div', 'stepfunctions-execution-list');
    versions.forEach((version) => {
      const row = el('button', 'stepfunctions-execution-row');
      row.append(
        el('span', 'stepfunctions-execution-name', version.arn || 'Unnamed version'),
        el('span', 'stepfunctions-machine-meta', version.revision_id || ''),
        el('span', 'stepfunctions-machine-meta', consoleUi.formatDate(version.creation_date)),
      );
      row.addEventListener('click', () => deleteVersion(version).catch((error) => toast(error.message, true)));
      list.append(row);
    });
    wrapper.append(list);
    return wrapper;
  }

  function extractStepExecutionStatus(execution, stateName) {
    if (!execution) return 'NOT_RUN';
    const history = execution.history || [];
    let entered = false;
    let failed = false;
    let succeeded = false;

    history.forEach((evt) => {
      const name = evt.state_entered_event_details?.name || evt.state_exited_event_details?.name || evt.name;
      if (name === stateName) {
        entered = true;
        if (evt.type?.includes('Failed') || evt.type?.includes('ExecutionFailed')) failed = true;
        if (evt.type?.includes('Exited') || evt.type?.includes('Succeeded')) succeeded = true;
      }
    });

    if (failed) return 'FAILED';
    if (succeeded) return 'SUCCEEDED';
    if (entered) return 'RUNNING';
    if (execution.status === 'SUCCEEDED') return 'SUCCEEDED';
    if (execution.status === 'FAILED') return 'FAILED';
    return 'NOT_RUN';
  }

  function renderAslGraph(machine, execution) {
    const def = parseDefinition(machine?.definition);
    const graphSection = el('section', 'stepfunctions-graph-section');
    const header = el('div', 'stepfunctions-graph-header');
    header.append(
      el('h3', null, 'Visual Workflow Graph'),
      el('span', 'stepfunctions-machine-meta', execution ? `Execution: ${execution.name} (${execution.status})` : 'Workflow ASL Topology'),
    );
    graphSection.append(header);

    if (!def || !def.States) {
      graphSection.append(el('div', 'stepfunctions-empty stepfunctions-empty-compact', 'Invalid or empty state machine definition.'));
      return graphSection;
    }

    const states = def.States;
    const startAt = def.StartAt;
    const graphContainer = el('div', 'stepfunctions-graph-container');

    // Start node
    const startNode = el('div', 'stepfunctions-node stepfunctions-node-terminal', 'Start');
    graphContainer.append(startNode);
    graphContainer.append(el('div', 'stepfunctions-edge-arrow', '↓'));

    // Linear/DAG step nodes
    const stateKeys = Object.keys(states);
    // Sort so StartAt is first
    if (startAt && stateKeys.includes(startAt)) {
      stateKeys.sort((a, b) => (a === startAt ? -1 : b === startAt ? 1 : 0));
    }

    stateKeys.forEach((name, idx) => {
      const stateObj = states[name];
      const type = stateObj.Type || 'Pass';
      const stepStatus = extractStepExecutionStatus(execution, name);
      const isSelected = state.selectedStepName === name;

      const node = el('div', `stepfunctions-node stepfunctions-node-${type.toLowerCase()} stepfunctions-node-status-${stepStatus.toLowerCase()}${isSelected ? ' stepfunctions-node-selected' : ''}`);
      
      const nodeHeader = el('div', 'stepfunctions-node-header');
      nodeHeader.append(
        el('strong', 'stepfunctions-node-title', name),
        el('span', 'stepfunctions-node-type-badge', type),
      );
      node.append(nodeHeader);

      if (stateObj.Resource) {
        node.append(el('div', 'stepfunctions-node-meta', stateObj.Resource.split(':').pop()));
      }

      if (execution) {
        const statusBadge = el('span', `stepfunctions-step-status-tag stepfunctions-step-status-${stepStatus.toLowerCase()}`, stepStatus);
        node.append(statusBadge);
      }

      node.addEventListener('click', () => {
        state.selectedStepName = name;
        render();
      });

      graphContainer.append(node);

      if (idx < stateKeys.length - 1 || stateObj.End || type === 'Succeed' || type === 'Fail') {
        const nextTarget = stateObj.Next || (stateObj.End ? 'End' : type === 'Choice' ? 'Branch' : 'Next');
        const arrow = el('div', 'stepfunctions-edge-arrow', `↓ (${nextTarget})`);
        graphContainer.append(arrow);
      }
    });

    const endNode = el('div', 'stepfunctions-node stepfunctions-node-terminal', 'End');
    graphContainer.append(endNode);

    graphSection.append(graphContainer);
    return graphSection;
  }

  function renderStepInspector(machine, execution) {
    const def = parseDefinition(machine?.definition);
    const states = def?.States || {};
    const stepNames = Object.keys(states);
    const currentStepName = state.selectedStepName || def?.StartAt || stepNames[0];
    const currentStep = states[currentStepName];

    const inspector = el('div', 'stepfunctions-step-inspector');
    inspector.append(el('h3', null, 'Step Inspector'));

    if (!currentStep) {
      inspector.append(el('div', 'stepfunctions-empty stepfunctions-empty-compact', 'Select a step from the graph to inspect details.'));
      return inspector;
    }

    const stepStatus = extractStepExecutionStatus(execution, currentStepName);
    const card = el('div', 'stepfunctions-inspector-card');

    const heading = el('div', 'stepfunctions-inspector-heading');
    heading.append(
      el('h4', null, currentStepName),
      el('span', `stepfunctions-node-type-badge`, currentStep.Type || 'Pass'),
    );
    card.append(heading);

    const facts = document.createElement('dl');
    consoleUi.addField(facts, 'Type', currentStep.Type);
    consoleUi.addField(facts, 'Status', stepStatus);
    if (currentStep.Resource) consoleUi.addField(facts, 'Resource ARN', currentStep.Resource);
    if (currentStep.Next) consoleUi.addField(facts, 'Next State', currentStep.Next);
    if (currentStep.End) consoleUi.addField(facts, 'End State', 'True');
    card.append(facts);

    card.append(el('h5', null, 'State Definition'));
    card.append(el('pre', 'stepfunctions-output', JSON.stringify(currentStep, null, 2)));

    if (execution) {
      card.append(el('h5', null, 'Execution Input'));
      card.append(el('pre', 'stepfunctions-output', consoleUi.valueText(execution.input || {})));

      card.append(el('h5', null, 'Execution Output / Result'));
      card.append(el('pre', 'stepfunctions-output', consoleUi.valueText(execution.output || execution.error || 'Running or no output yet')));
    }

    inspector.append(card);
    return inspector;
  }

  function renderSelectedMachine(machine) {
    const panel = el('section', 'stepfunctions-panel');
    const heading = el('div', 'stepfunctions-panel-heading');
    heading.append(
      el('span', null, machine ? machine.name : 'Executions'),
      el('span', 'stepfunctions-machine-meta', machine?.type || ''),
    );
    panel.append(heading);

    const content = el('div', 'stepfunctions-machine-detail');
    if (!machine) {
      content.append(el('div', 'stepfunctions-empty', 'Create or select a state machine to start executions.'));
      panel.append(content);
      return panel;
    }

    const details = document.createElement('dl');
    consoleUi.addField(details, 'ARN', machine.arn);
    consoleUi.addField(details, 'Type', machine.type);
    consoleUi.addField(details, 'Status', machine.status);
    consoleUi.addField(details, 'Created', consoleUi.formatDate(machine.created));
    consoleUi.addField(details, 'Role ARN', machine.role_arn);
    consoleUi.addField(details, 'Revision ID', machine.revision_id);
    content.append(details);

    const exec = selectedExecution(machine);

    // Visual Graph + Inspector Row
    const visualRow = el('div', 'stepfunctions-visual-workbench');
    visualRow.append(renderAslGraph(machine, exec));
    visualRow.append(renderStepInspector(machine, exec));
    content.append(visualRow);

    content.append(renderVersions(machine));
    content.append(renderExecutions(machine));
    panel.append(content);
    return panel;
  }

  function renderExecutionDetail(execution) {
    const panel = el('section', 'stepfunctions-panel');
    const heading = el('div', 'stepfunctions-panel-heading');
    heading.append(
      el('span', null, execution ? execution.name : 'Execution detail'),
      el('span', execution ? statusClass(execution.status) : 'stepfunctions-machine-meta', execution?.status || ''),
    );
    panel.append(heading);

    const content = el('div', 'stepfunctions-execution-detail');
    if (!execution) {
      content.append(el('div', 'stepfunctions-empty', 'Select or start an execution to inspect its result.'));
      panel.append(content);
      return panel;
    }

    const details = document.createElement('dl');
    consoleUi.addField(details, 'Execution ARN', execution.arn);
    consoleUi.addField(details, 'State machine ARN', execution.state_machine_arn);
    consoleUi.addField(details, 'Status', execution.status);
    consoleUi.addField(details, 'Started', consoleUi.formatDate(execution.start_date));
    consoleUi.addField(details, 'Stopped', consoleUi.formatDate(execution.stop_date));
    content.append(details);

    content.append(el('h3', null, 'Execution Input'));
    content.append(el('pre', 'stepfunctions-output', consoleUi.valueText(execution.input || {})));

    content.append(el('h3', null, 'Execution Output'));
    content.append(el('pre', 'stepfunctions-output', consoleUi.valueText(execution.output || execution.error || 'No output recorded')));

    panel.append(content);
    return panel;
  }

  function renderMachineList() {
    const panel = el('section', 'stepfunctions-panel');
    panel.append(el('div', 'stepfunctions-panel-heading', 'State machines'));
    const list = el('div', 'stepfunctions-machine-list');
    if (!stateMachines().length) {
      list.append(el('div', 'stepfunctions-empty', 'No state machines found.'));
    } else {
      stateMachines().forEach((machine) => {
        const active = machine.arn === selectedStateMachine()?.arn;
        const row = el('button', `stepfunctions-machine-row${active ? ' stepfunctions-machine-row-active' : ''}`);
        row.append(
          el('span', 'stepfunctions-machine-name', machine.name || 'Unnamed machine'),
          el('span', 'stepfunctions-machine-meta', `${machine.type || 'STANDARD'} · ${machine.status || 'ACTIVE'}`),
        );
        row.addEventListener('click', () => {
          state.selectedStateMachineArn = machine.arn;
          state.selectedExecutionArn = '';
          state.selectedStepName = '';
          render();
        });
        list.append(row);
      });
    }
    panel.append(list);
    return panel;
  }

  function renderWorkbench() {
    const machine = selectedStateMachine();
    const execution = selectedExecution(machine);
    const container = el('div');
    container.append(toolbar(
      [
        btn('Create state machine', null, showCreateStateMachineModal),
        btn('Start execution', null, () => machine && showStartExecutionModal(machine)),
        btn('Stop execution', 'stepfunctions-btn-danger', () => execution && showStopExecutionModal(execution)),
        btn('Delete state machine', 'stepfunctions-btn-danger', async () => {
          if (machine && window.confirm(`Delete state machine ${machine.name}?`)) {
            state.selectedStateMachineArn = '';
            await apiJson(`/api/stepfunctions/state-machines/${encodeURIComponent(machine.arn)}/`, { method: 'DELETE' });
            toast('State machine deleted');
            await refresh();
          }
        }),
      ],
      [],
    ));

    const buttons = [...container.querySelectorAll('button')];
    if (buttons[1]) buttons[1].disabled = !machine;
    if (buttons[2]) buttons[2].disabled = !execution || execution.status !== 'RUNNING';
    if (buttons[3]) buttons[3].disabled = !machine;

    const workbench = el('div', 'stepfunctions-workbench');
    workbench.append(renderMachineList(), renderSelectedMachine(machine), renderExecutionDetail(execution));
    container.append(workbench);
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
    const data = await apiJson('/api/stepfunctions/');
    state.inventory = data;
    if (!selectedStateMachine() && stateMachines().length) {
      state.selectedStateMachineArn = stateMachines()[0].arn;
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) return;
    root.append(el('div', 'stepfunctions-empty', 'Loading Step Functions workbench...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.StepFunctionsConsole = StepFunctionsConsole;

if (document.getElementById('stepfunctions-console-root')) {
  StepFunctionsConsole.init();
}
