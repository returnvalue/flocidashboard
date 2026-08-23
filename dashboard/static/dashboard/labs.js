(() => {
  const shell = document.querySelector('.labs-shell');
  if (!shell) {
    return;
  }

  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
  const labState = document.querySelector('#lab-state');
  const resetButton = document.querySelector('#lab-reset');
  const runAllButton = document.querySelector('#lab-run-all');
  const progressFill = document.querySelector('#lab-progress-fill');
  const progressText = document.querySelector('#lab-progress-text');
  const progressBar = document.querySelector('#lab-progress-bar');
  const activeGuide = document.querySelector('#lab-active-guide');
  const activeStepTitle = document.querySelector('#lab-active-step-title');
  const activeStepExplanation = document.querySelector('#lab-active-step-explanation');
  const labsSidebarToggle = document.querySelector('#labs-sidebar-toggle');
  const labsSidebarCollapsedStorageKey = 'floci-dashboard-labs-sidebar-collapsed';

  let isAutoRunning = false;
  let shouldCancelAutoRun = false;

  function smoothScrollToStep(step) {
    const rect = step.getBoundingClientRect();
    const targetY = window.pageYOffset + rect.top - (window.innerHeight / 2) + (rect.height / 2);
    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth',
    });
  }

  function isLabsSidebarCollapsed() {
    try {
      return window.localStorage.getItem(labsSidebarCollapsedStorageKey) === 'true';
    } catch (error) {
      return false;
    }
  }

  function setLabsSidebarCollapsed(collapsed) {
    shell.classList.toggle('labs-sidebar-collapsed', collapsed);
    if (labsSidebarToggle) {
      labsSidebarToggle.textContent = collapsed ? '>' : '<';
      labsSidebarToggle.title = collapsed ? 'Expand labs navigation' : 'Collapse labs navigation';
      labsSidebarToggle.setAttribute('aria-label', collapsed ? 'Expand labs navigation' : 'Collapse labs navigation');
      labsSidebarToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
    try {
      window.localStorage.setItem(labsSidebarCollapsedStorageKey, collapsed ? 'true' : 'false');
    } catch (error) {
      // Local storage is a convenience layer only.
    }
  }

  setLabsSidebarCollapsed(isLabsSidebarCollapsed());

  labsSidebarToggle?.addEventListener('click', () => {
    setLabsSidebarCollapsed(!shell.classList.contains('labs-sidebar-collapsed'));
  });

  function updateProgress() {
    const steps = Array.from(document.querySelectorAll('.lab-step'));
    const total = steps.length;
    if (total === 0) {
      return;
    }
    const completed = steps.filter((step) => step.classList.contains('lab-step-complete')).length;
    const percent = Math.round((completed / total) * 100);

    if (progressFill) {
      progressFill.style.width = `${percent}%`;
    }
    if (progressBar) {
      progressBar.setAttribute('aria-valuenow', String(percent));
    }
    if (progressText) {
      progressText.textContent = `${completed} / ${total} steps complete (${percent}%)`;
    }

    if (completed === total) {
      if (runAllButton && !isAutoRunning) {
        runAllButton.disabled = true;
        runAllButton.textContent = '✓ All steps complete';
      }
      if (labState && labState.textContent !== 'Status unavailable') {
        labState.textContent = 'Complete';
      }
    } else {
      if (runAllButton && !isAutoRunning) {
        runAllButton.disabled = false;
        runAllButton.textContent = completed > 0 ? '▶ Run remaining steps' : '▶ Run all steps';
      }
      if (labState && labState.textContent !== 'Status unavailable' && !isAutoRunning) {
        labState.textContent = completed > 0 ? 'In progress' : 'Not started';
      }
    }

    const activeLabKey = shell.dataset.lab;
    const activePicker = document.querySelector(`.lab-picker[data-lab-key="${activeLabKey}"]`) || document.querySelector('.lab-picker-active');
    if (activePicker) {
      activePicker.classList.toggle('lab-picker-complete', completed === total);
    }
  }

  function removeNextBatchCard() {
    document.querySelector('.lab-next-batch')?.remove();
  }

  function renderNextBatchCard(nextBatch) {
    removeNextBatchCard();
    if (!nextBatch) {
      return;
    }

    const card = document.createElement('section');
    card.className = 'lab-next-batch';

    const copy = document.createElement('div');
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'Next recommended batch';
    const title = document.createElement('h2');
    title.textContent = nextBatch.title || 'Next labs';
    const summary = document.createElement('p');
    summary.textContent = nextBatch.summary || '';
    copy.append(eyebrow, title, summary);

    const actions = document.createElement('div');
    actions.className = 'lab-next-batch-actions';
    if (nextBatch.href) {
      const link = document.createElement('a');
      link.className = 'primary-action';
      link.href = nextBatch.href;
      link.textContent = `Open ${nextBatch.title || 'next labs'}`;
      actions.append(link);
    } else {
      const note = document.createElement('span');
      note.className = 'lab-next-note';
      note.textContent = 'Ready to build';
      actions.append(note);
    }

    card.append(copy, actions);
    document.querySelector('.labs-heading')?.before(card);
  }

  function activeResponsePanel() {
    const firstStep = document.querySelector('.lab-step');
    return {
      step: firstStep,
      panel: firstStep?.querySelector('.lab-response'),
      status: firstStep?.querySelector('.lab-response-status'),
      body: firstStep?.querySelector('.lab-response-body'),
      verification: firstStep?.querySelector('.lab-verification'),
    };
  }

  async function runStep(step) {
    const service = shell.dataset.service;
    const lab = shell.dataset.lab;
    const stepKey = step.dataset.stepKey;
    const button = step.querySelector('.lab-run-step');
    const responsePanel = step.querySelector('.lab-response');
    const responseStatus = step.querySelector('.lab-response-status');
    const responseBody = step.querySelector('.lab-response-body');
    const verification = step.querySelector('.lab-verification');
    const stateVerification = step.querySelector('.lab-state-verification');

    button.disabled = true;
    button.textContent = 'Running...';
    labState.textContent = 'Running';
    responsePanel.hidden = false;
    responseStatus.textContent = '';
    responseBody.textContent = '';
    verification.textContent = '';
    stateVerification?.remove();

    try {
      const response = await fetch(`/api/labs/${service}/${lab}/steps/${stepKey}/run/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken,
        },
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Lab step failed');
      }

      responseStatus.textContent = data.verified ? 'Verified' : 'Succeeded';
      responseBody.textContent = data.stdout || JSON.stringify(data.json || data, null, 2);
      verification.textContent = data.status_warning || data.verification?.message || '';
      step.classList.toggle('lab-step-complete', Boolean(data.verified));
      button.disabled = Boolean(data.verified);
      button.textContent = data.verified ? '\u2713 Done' : 'Run';
      labState.textContent = data.status_warning ? 'Status unavailable' : data.verified ? 'Complete' : 'Needs review';
      if (data.lab_complete) {
        renderNextBatchCard(data.next_batch);
      }
      updateProgress();
      document.dispatchEvent(new CustomEvent('floci:lab-changed'));
      return { ok: Boolean(data.verified), data };
    } catch (error) {
      responseStatus.textContent = 'Failed';
      responseBody.textContent = error.message;
      step.classList.remove('lab-step-complete');
      labState.textContent = 'Failed';
      updateProgress();
      return { ok: false, error: error.message };
    } finally {
      if (!step.classList.contains('lab-step-complete')) {
        button.disabled = false;
        button.textContent = 'Run';
      }
    }
  }

  async function runAllSteps() {
    if (isAutoRunning) {
      shouldCancelAutoRun = true;
      if (runAllButton) {
        runAllButton.disabled = true;
        runAllButton.textContent = 'Stopping...';
      }
      return;
    }

    const steps = Array.from(document.querySelectorAll('.lab-step'));
    const unverifiedSteps = steps.filter((step) => !step.classList.contains('lab-step-complete'));
    if (unverifiedSteps.length === 0) {
      return;
    }

    isAutoRunning = true;
    shouldCancelAutoRun = false;
    if (runAllButton) {
      runAllButton.disabled = false;
      runAllButton.textContent = '⏹ Stop auto-run';
      runAllButton.classList.add('danger-button');
    }
    if (resetButton) {
      resetButton.disabled = true;
    }

    try {
      for (const step of unverifiedSteps) {
        if (shouldCancelAutoRun) {
          break;
        }

        // Highlight active step
        steps.forEach((s) => s.classList.remove('lab-step-active'));
        step.classList.add('lab-step-active');

        // Extract explanation & title to render in the live guide banner and expand step details
        const title = step.querySelector('.lab-step-heading h3')?.textContent || '';
        const explanation = step.querySelector('.lab-explanation p')?.textContent || '';
        const stepNum = step.querySelector('.lab-step-heading .eyebrow')?.textContent || '';
        const details = step.querySelector('.lab-explanation');
        if (details) {
          details.open = true;
        }
        if (activeGuide) {
          activeGuide.hidden = false;
          if (activeStepTitle) activeStepTitle.textContent = `${stepNum}: ${title}`;
          if (activeStepExplanation) activeStepExplanation.textContent = explanation;
        }

        smoothScrollToStep(step);

        // Allow 750ms for learner to see active step and start reading explanation before dispatch
        await new Promise((resolve) => setTimeout(resolve, 750));
        if (shouldCancelAutoRun) {
          break;
        }

        const result = await runStep(step);
        step.classList.remove('lab-step-active');

        if (!result.ok || shouldCancelAutoRun) {
          break;
        }

        // Comfortable 1400ms pause so the learner can digest the output, verification note, and checkmark
        await new Promise((resolve) => setTimeout(resolve, 1400));
      }
    } finally {
      isAutoRunning = false;
      steps.forEach((s) => s.classList.remove('lab-step-active'));
      if (activeGuide) {
        activeGuide.hidden = true;
      }
      if (runAllButton) {
        runAllButton.classList.remove('danger-button');
      }
      if (resetButton) {
        resetButton.disabled = false;
      }
      updateProgress();
    }
  }

  document.querySelectorAll('.lab-step').forEach((step) => {
    step.querySelector('.lab-run-step')?.addEventListener('click', () => {
      runStep(step);
    });
  });

  runAllButton?.addEventListener('click', runAllSteps);

  resetButton?.addEventListener('click', async () => {
    const service = shell.dataset.service;
    const lab = shell.dataset.lab;
    const response = activeResponsePanel();

    resetButton.disabled = true;
    resetButton.textContent = 'Resetting...';
    labState.textContent = 'Resetting';
    if (runAllButton) {
      runAllButton.disabled = true;
    }

    try {
      const fetchResponse = await fetch(`/api/labs/${service}/${lab}/reset/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken,
        },
      });
      const data = await fetchResponse.json();
      if (!fetchResponse.ok || data.error) {
        throw new Error(data.error || 'Lab reset failed');
      }

      document.querySelectorAll('.lab-step').forEach((step) => {
        step.classList.remove('lab-step-complete');
        const button = step.querySelector('.lab-run-step');
        if (button) {
          button.disabled = false;
          button.textContent = 'Run';
        }
      });
      removeNextBatchCard();
      if (response.panel) {
        response.panel.hidden = false;
        response.status.textContent = 'Reset';
        response.body.textContent = data.stdout || JSON.stringify(data.json || data, null, 2);
        response.verification.textContent = data.verification?.message || '';
      }
      labState.textContent = 'Not started';
      updateProgress();
      document.dispatchEvent(new CustomEvent('floci:lab-changed'));
    } catch (error) {
      if (response.panel) {
        response.panel.hidden = false;
        response.status.textContent = 'Failed';
        response.body.textContent = error.message;
        response.verification.textContent = '';
      }
      labState.textContent = 'Failed';
    } finally {
      resetButton.disabled = false;
      resetButton.textContent = 'Reset';
      updateProgress();
    }
  });

  // Multi-SDK Tab switching and local storage persistence
  const preferredSdkStorageKey = 'floci-dashboard-preferred-sdk';

  function getPreferredSdk() {
    try {
      return window.localStorage.getItem(preferredSdkStorageKey) || 'cli';
    } catch (e) {
      return 'cli';
    }
  }

  function setStepSdk(step, sdk) {
    const tabs = step.querySelectorAll('.lab-sdk-tab');
    const panels = step.querySelectorAll('.lab-code-panel');

    tabs.forEach((tab) => {
      const match = tab.dataset.sdk === sdk;
      tab.classList.toggle('lab-sdk-tab-active', match);
      tab.setAttribute('aria-selected', match ? 'true' : 'false');
    });

    panels.forEach((panel) => {
      const match = panel.dataset.sdk === sdk;
      panel.classList.toggle('lab-code-panel-active', match);
      panel.hidden = !match;
    });
  }

  function applySdkPreference(sdk) {
    document.querySelectorAll('.lab-step').forEach((step) => {
      setStepSdk(step, sdk);
    });
    try {
      window.localStorage.setItem(preferredSdkStorageKey, sdk);
    } catch (e) {}
  }

  document.querySelectorAll('.lab-step').forEach((step) => {
    step.querySelectorAll('.lab-sdk-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const sdk = tab.dataset.sdk;
        applySdkPreference(sdk);
      });
    });
  });

  // Apply initial preferred SDK
  applySdkPreference(getPreferredSdk());

  // Initial progress bar calculation
  updateProgress();
})();
