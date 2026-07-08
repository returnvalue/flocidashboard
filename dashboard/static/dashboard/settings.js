const settingsEndpointInput = document.querySelector('#settings-endpoint-url');
const settingsSaveButton = document.querySelector('#settings-save');
const settingsTestButton = document.querySelector('#settings-test');
const settingsResetButton = document.querySelector('#settings-reset');
const settingsState = document.querySelector('#settings-state');
const settingsAlerts = document.querySelector('#settings-alerts');

const settingsFields = {
  effectiveEndpoint: document.querySelector('#settings-effective-endpoint'),
  endpointSource: document.querySelector('#settings-endpoint-source'),
  region: document.querySelector('#settings-region'),
  regionSource: document.querySelector('#settings-region-source'),
  credentialSource: document.querySelector('#settings-credential-source'),
  profile: document.querySelector('#settings-profile'),
  defaultEndpoint: document.querySelector('#settings-default-endpoint'),
  runtimeEndpoint: document.querySelector('#settings-runtime-endpoint'),
  testStatus: document.querySelector('#settings-test-status'),
  testVersion: document.querySelector('#settings-test-version'),
  testEdition: document.querySelector('#settings-test-edition'),
  testIdentity: document.querySelector('#settings-test-identity'),
  testError: document.querySelector('#settings-test-error'),
};

function settingsCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
}

async function settingsJson(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.method && options.method !== 'GET' ? { 'X-CSRFToken': settingsCsrfToken() } : {}),
    ...options.headers,
  };
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function settingsText(value) {
  return value || '-';
}

function renderSettingsAlert(message, type = 'info') {
  if (!settingsAlerts) {
    return;
  }
  settingsAlerts.textContent = '';
  const alert = document.createElement('div');
  alert.className = `environment-alert environment-alert-${type}`;
  alert.textContent = message;
  settingsAlerts.append(alert);
}

function renderSettings(data) {
  settingsEndpointInput.value = data.runtime_endpoint_url || data.endpoint_url || '';
  settingsFields.effectiveEndpoint.textContent = settingsText(data.endpoint_url);
  settingsFields.endpointSource.textContent = settingsText(data.endpoint_source);
  settingsFields.region.textContent = settingsText(data.region);
  settingsFields.regionSource.textContent = settingsText(data.region_source);
  settingsFields.credentialSource.textContent = settingsText(data.credential_source);
  settingsFields.profile.textContent = settingsText(data.profile);
  settingsFields.defaultEndpoint.textContent = settingsText(data.default_endpoint_url);
  settingsFields.runtimeEndpoint.textContent = settingsText(data.runtime_endpoint_url);
  settingsState.textContent = data.endpoint_source === 'runtime_override' ? 'Runtime override active' : 'Environment default';
}

function renderConnectionTest(data) {
  const health = data.health || {};
  const healthData = health.data || {};
  settingsFields.testStatus.textContent = health.ok ? 'Reachable' : 'Unavailable';
  settingsFields.testVersion.textContent = settingsText(healthData.version || data.version);
  settingsFields.testEdition.textContent = settingsText(healthData.edition || data.edition);
  settingsFields.testIdentity.textContent = settingsText(data.identity?.arn || data.identity?.account);
  settingsFields.testError.textContent = settingsText(health.error || data.identity_error || 'None');
}

async function loadSettings() {
  settingsState.textContent = 'Loading...';
  try {
    const data = await settingsJson('/api/settings/');
    renderSettings(data);
  } catch (error) {
    settingsState.textContent = 'Error';
    renderSettingsAlert(error.message, 'warning');
  }
}

async function testSettingsConnection() {
  settingsTestButton.disabled = true;
  settingsTestButton.textContent = 'Testing';
  try {
    const data = await settingsJson('/api/settings/test-connection/', {
      method: 'POST',
      body: JSON.stringify({ endpoint_url: settingsEndpointInput.value.trim() }),
    });
    renderConnectionTest(data);
    renderSettingsAlert(data.health?.ok ? 'Connection test succeeded.' : 'Connection test completed with errors.', data.health?.ok ? 'info' : 'warning');
  } catch (error) {
    settingsFields.testStatus.textContent = 'Error';
    settingsFields.testError.textContent = error.message;
    renderSettingsAlert(error.message, 'warning');
  } finally {
    settingsTestButton.disabled = false;
    settingsTestButton.textContent = 'Test connection';
  }
}

async function saveSettingsEndpoint() {
  settingsSaveButton.disabled = true;
  settingsSaveButton.textContent = 'Saving';
  try {
    const data = await settingsJson('/api/settings/endpoint/', {
      method: 'POST',
      body: JSON.stringify({ endpoint_url: settingsEndpointInput.value.trim() }),
    });
    renderSettings(data);
    renderConnectionTest({
      health: data.probe,
      endpoint_url: data.endpoint_url,
    });
    renderSettingsAlert('Runtime endpoint override saved for this session.');
  } catch (error) {
    renderSettingsAlert(error.message, 'warning');
  } finally {
    settingsSaveButton.disabled = false;
    settingsSaveButton.textContent = 'Save endpoint';
  }
}

async function resetSettingsEndpoint() {
  settingsResetButton.disabled = true;
  try {
    const data = await settingsJson('/api/settings/endpoint/reset/', { method: 'DELETE' });
    renderSettings(data);
    renderSettingsAlert('Runtime endpoint override cleared.');
  } catch (error) {
    renderSettingsAlert(error.message, 'warning');
  } finally {
    settingsResetButton.disabled = false;
  }
}

settingsTestButton?.addEventListener('click', testSettingsConnection);
settingsSaveButton?.addEventListener('click', saveSettingsEndpoint);
settingsResetButton?.addEventListener('click', resetSettingsEndpoint);

if (settingsEndpointInput) {
  loadSettings();
}
