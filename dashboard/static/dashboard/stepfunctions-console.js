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
    return stateMachines().find((machine) => machine.arn === state.selectedStateMachineArn) || stateMachines()[0] || null;
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
      },
    });
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsEl) {
      return;
    }
    breadcrumbsEl.textContent = '';
    const home = el('button', null, 'AWS Step Functions');
    home.addEventListener('click', () => {
      state.selectedStateMachineArn = '';
      state.selectedExecutionArn = '';
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
    const trimmed = value.trim();
    if (!trimmed) {
      return {};
    }
    return JSON.parse(trimmed);
  }

  function statusClass(status) {
    return `stepfunctions-status stepfunctions-status-${String(status || 'unknown').toLowerCase()}`;
  }

  function showStartExecutionModal(machine) {
    const form = el('div');
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'optional execution name';
    const inputText = document.createElement('textarea');
    inputText.required = true;
    inputText.value = '{\n  "source": "floci-dashboard"\n}';
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
    const form = el('div');
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

  function renderStateMachineRow(machine) {
    const active = machine.arn === selectedStateMachine()?.arn;
    const row = el('button', `stepfunctions-machine-row${active ? ' stepfunctions-machine-row-active' : ''}`);
    const meta = [
      machine.type,
      `${machine.execution_count || 0} execution${machine.execution_count === 1 ? '' : 's'}`,
      machine.status,
    ].filter(Boolean);
    row.append(
      el('span', 'stepfunctions-machine-name', machine.name || 'Unnamed state machine'),
      el('span', 'stepfunctions-machine-meta', meta.join(' / ') || 'No execution summary'),
    );
    row.addEventListener('click', () => {
      state.selectedStateMachineArn = machine.arn;
      state.selectedExecutionArn = '';
      render();
    });
    return row;
  }

  function renderStateMachineList() {
    const panel = el('section', 'stepfunctions-panel');
    panel.append(el('div', 'stepfunctions-panel-heading', 'State machines'));
    const list = el('div', 'stepfunctions-machine-list');
    if (!stateMachines().length) {
      list.append(el('div', 'stepfunctions-empty', 'No state machines found.'));
    } else {
      stateMachines().forEach((machine) => list.append(renderStateMachineRow(machine)));
    }
    panel.append(list);
    return panel;
  }

  function renderExecutionRow(execution) {
    const active = execution.arn === selectedExecution()?.arn;
    const row = el('button', `stepfunctions-execution-row${active ? ' stepfunctions-execution-row-active' : ''}`);
    row.append(
      el('span', 'stepfunctions-execution-name', execution.name || 'Unnamed execution'),
      el('span', statusClass(execution.status), execution.status || 'UNKNOWN'),
      el('span', 'stepfunctions-machine-meta', consoleUi.formatDate(execution.started)),
    );
    row.addEventListener('click', () => {
      state.selectedExecutionArn = execution.arn;
      render();
    });
    return row;
  }

  function renderExecutions(machine) {
    const wrapper = el('div', 'stepfunctions-executions');
    wrapper.append(el('h3', null, 'Recent executions'));
    if (!executions(machine).length) {
      wrapper.append(el('div', 'stepfunctions-empty stepfunctions-empty-compact', 'No executions found. Start one to inspect its input, output, and history.'));
      return wrapper;
    }
    const list = el('div', 'stepfunctions-execution-list');
    executions(machine).forEach((execution) => list.append(renderExecutionRow(execution)));
    wrapper.append(list);
    return wrapper;
  }

  function renderJsonBlock(title, value) {
    const wrapper = el('div', 'stepfunctions-json-block');
    wrapper.append(el('h3', null, title));
    wrapper.append(el('pre', 'stepfunctions-output', consoleUi.valueText(value)));
    return wrapper;
  }

  function eventTitle(event) {
    return event.type || `Event ${event.id || ''}`.trim() || 'History event';
  }

  function renderHistory(execution) {
    const wrapper = el('div', 'stepfunctions-history');
    wrapper.append(el('h3', null, 'History timeline'));
    const history = execution?.history || [];
    if (!history.length) {
      wrapper.append(el('div', 'stepfunctions-empty stepfunctions-empty-compact', 'No history events returned for this execution.'));
      return wrapper;
    }
    const list = el('div', 'stepfunctions-history-list');
    history.forEach((event) => {
      const item = el('article', 'stepfunctions-history-event');
      const heading = el('div', 'stepfunctions-history-heading');
      heading.append(
        el('span', null, eventTitle(event)),
        el('span', 'stepfunctions-machine-meta', consoleUi.formatDate(event.timestamp)),
      );
      item.append(heading);
      item.append(el('pre', 'stepfunctions-history-detail', consoleUi.valueText(event)));
      list.append(item);
    });
    wrapper.append(list);
    return wrapper;
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
    consoleUi.addField(details, 'Logging', machine.logging_configuration || {});
    consoleUi.addField(details, 'Tracing', machine.tracing_configuration || {});
    content.append(details);
    content.append(renderJsonBlock('Definition', machine.definition || 'No definition returned.'));
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
    consoleUi.addField(details, 'Started', consoleUi.formatDate(execution.started));
    consoleUi.addField(details, 'Stopped', consoleUi.formatDate(execution.stopped));
    consoleUi.addField(details, 'Trace header', execution.trace_header);
    consoleUi.addField(details, 'History events', execution.history_event_count);
    content.append(details);
    content.append(renderJsonBlock('Input', execution.input || 'None'));
    content.append(renderJsonBlock('Output', execution.output || 'None'));
    content.append(renderHistory(execution));
    panel.append(content);
    return panel;
  }

  function renderWorkbench() {
    const machine = selectedStateMachine();
    const execution = selectedExecution(machine);
    const isRunning = execution?.status === 'RUNNING';
    const container = el('div');
    container.append(toolbar(
      [
        btn('Start execution', null, () => machine && showStartExecutionModal(machine)),
      ],
      [
        btn('Stop execution', 'stepfunctions-btn-danger', () => execution && showStopExecutionModal(execution)),
      ],
    ));

    const startButton = container.querySelector('.stepfunctions-toolbar-left button');
    const stopButton = container.querySelector('.stepfunctions-toolbar-right button');
    if (startButton) {
      startButton.disabled = !machine;
    }
    if (stopButton) {
      stopButton.disabled = !execution || !isRunning;
    }

    const workbench = el('div', 'stepfunctions-workbench');
    const detail = el('div', 'stepfunctions-detail-stack');
    detail.append(renderSelectedMachine(machine), renderExecutionDetail(execution));
    workbench.append(renderStateMachineList(), detail);
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
    const data = await apiJson('/api/stepfunctions/');
    state.inventory = data;
    if (!selectedStateMachine() && stateMachines().length) {
      state.selectedStateMachineArn = stateMachines()[0].arn;
    }
    if (!selectedExecution() && selectedStateMachine()) {
      const firstExecution = executions(selectedStateMachine())[0];
      state.selectedExecutionArn = firstExecution?.arn || '';
    }
    renderSummary(data.summary || {});
    render();
  }

  function init() {
    if (!root) {
      return;
    }
    root.append(el('div', 'stepfunctions-empty', 'Loading...'));
    refresh().catch((error) => toast(error.message, true));
  }

  return { init, refresh };
})();

window.StepFunctionsConsole = StepFunctionsConsole;

if (document.getElementById('stepfunctions-console-root')) {
  StepFunctionsConsole.init();
}
