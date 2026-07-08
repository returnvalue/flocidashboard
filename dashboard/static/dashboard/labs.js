(() => {
  const shell = document.querySelector('.labs-shell');
  if (!shell) {
    return;
  }

  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
  const labState = document.querySelector('#lab-state');
  const resetButton = document.querySelector('#lab-reset');
  const labsSidebarToggle = document.querySelector('#labs-sidebar-toggle');
  const labsSidebarCollapsedStorageKey = 'floci-dashboard-labs-sidebar-collapsed';

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

    button.disabled = true;
    button.textContent = 'Running...';
    labState.textContent = 'Running';
    responsePanel.hidden = false;
    responseStatus.textContent = '';
    responseBody.textContent = '';
    verification.textContent = '';

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
      verification.textContent = data.verification?.message || '';
      step.classList.toggle('lab-step-complete', Boolean(data.verified));
      button.disabled = Boolean(data.verified);
      button.textContent = data.verified ? '\u2713 Done' : 'Run';
      labState.textContent = data.verified ? 'Complete' : 'Needs review';
      if (data.lab_complete) {
        renderNextBatchCard(data.next_batch);
      }
    } catch (error) {
      responseStatus.textContent = 'Failed';
      responseBody.textContent = error.message;
      step.classList.remove('lab-step-complete');
      labState.textContent = 'Failed';
    } finally {
      if (!step.classList.contains('lab-step-complete')) {
        button.disabled = false;
        button.textContent = 'Run';
      }
    }
  }

  document.querySelectorAll('.lab-step').forEach((step) => {
    step.querySelector('.lab-run-step')?.addEventListener('click', () => {
      runStep(step);
    });
  });

  resetButton?.addEventListener('click', async () => {
    const service = shell.dataset.service;
    const lab = shell.dataset.lab;
    const response = activeResponsePanel();

    resetButton.disabled = true;
    resetButton.textContent = 'Resetting...';
    labState.textContent = 'Resetting';

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
    }
  });
})();
