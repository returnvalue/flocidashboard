(() => {
  const resetButton = document.querySelector('#labs-global-reset');
  const status = document.querySelector('#labs-global-reset-status');
  const stepCount = document.querySelector('#labs-progress-count');
  const labCount = document.querySelector('#labs-complete-count');
  const labProgress = new Map(
    [...document.querySelectorAll('[data-lab-progress]')].map((item) => [
      item.dataset.labProgress,
      item,
    ])
  );
  if (!resetButton || !status) {
    return;
  }

  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
  let completedLabCount = 0;

  const pluralize = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

  const applyProgress = (data) => {
    completedLabCount = data.completed_lab_count || 0;
    if (stepCount) {
      stepCount.textContent = `${data.completed_step_count} of ${data.total_step_count}`;
    }
    if (labCount) {
      labCount.textContent = `${data.completed_lab_count} of ${data.total_lab_count}`;
    }

    for (const lab of data.labs || []) {
      const progress = labProgress.get(`${lab.service}:${lab.lab}`);
      if (!progress) {
        continue;
      }
      progress.textContent = `${lab.completed_steps} / ${lab.total_steps}`;
      progress.classList.toggle('is-complete', Boolean(lab.complete));
      progress.classList.toggle('has-error', Boolean(lab.error));
    }

    if (data.progress_error_count) {
      status.textContent = `${data.completed_lab_count} of ${data.total_lab_count} labs complete. Some lab progress could not be checked.`;
    } else {
      status.textContent = `${data.completed_lab_count} of ${data.total_lab_count} labs complete.`;
    }
    resetButton.disabled = completedLabCount === 0;
  };

  const loadProgress = async () => {
    try {
      const response = await fetch('/api/labs/progress/');
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Lab progress could not be checked');
      }
      applyProgress(data);
    } catch (error) {
      status.textContent = error.message;
      if (stepCount) {
        stepCount.textContent = 'Unavailable';
      }
      if (labCount) {
        labCount.textContent = 'Unavailable';
      }
      resetButton.disabled = true;
    }
  };

  resetButton.addEventListener('click', async () => {
    if (completedLabCount === 0) {
      return;
    }
    if (!window.confirm('Reset every lab currently marked complete?')) {
      return;
    }

    resetButton.disabled = true;
    resetButton.textContent = 'Resetting...';
    status.textContent = 'Resetting completed labs.';

    try {
      const response = await fetch('/api/labs/reset-completed/', {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken,
        },
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Global lab reset failed');
      }

      if (data.reset_error_count) {
        status.textContent = `Reset ${pluralize(data.reset_lab_count, 'completed lab')}; ${data.reset_error_count} failed.`;
        resetButton.textContent = 'Reset completed labs';
        resetButton.disabled = false;
        loadProgress();
        return;
      }

      status.textContent = `Reset ${pluralize(data.reset_lab_count, 'completed lab')}. Refreshing.`;
      window.location.reload();
    } catch (error) {
      status.textContent = error.message;
      resetButton.textContent = 'Reset completed labs';
      resetButton.disabled = false;
    }
  });

  loadProgress();
})();
