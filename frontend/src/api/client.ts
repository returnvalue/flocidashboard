import { IdentityInfo, LabDefinition, ServiceDefinition } from '../types';

function getCsrfToken(): string {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta) {
    return meta.getAttribute('content') || '';
  }
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

export async function fetchServices(): Promise<ServiceDefinition[]> {
  try {
    const res = await fetch('/api/services/');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.services || [];
  } catch (err) {
    console.error('Failed to fetch services:', err);
    return [];
  }
}

export async function fetchIdentity(): Promise<IdentityInfo> {
  try {
    const res = await fetch('/api/session-identity/');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      account_id: data.account_id || '000000000000',
      user_id: data.user_id || 'floci-root',
      arn: data.arn || 'arn:aws:iam::000000000000:root',
      role: data.role || 'Administrator',
      region: data.region || 'us-east-1',
      endpoint: data.endpoint || 'http://localhost:4566',
    };
  } catch (err) {
    return {
      account_id: '000000000000',
      user_id: 'floci-root',
      arn: 'arn:aws:iam::000000000000:root',
      role: 'Administrator',
      region: 'us-east-1',
      endpoint: 'http://localhost:4566',
    };
  }
}

export async function fetchServiceInventory(serviceKey: string): Promise<any> {
  try {
    const res = await fetch(`/api/${serviceKey}/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Failed to fetch inventory for ${serviceKey}:`, err);
    return {};
  }
}

export async function executeServiceAction(
  serviceKey: string,
  actionKey: string,
  payload: Record<string, any>
): Promise<any> {
  const res = await fetch(`/api/${serviceKey}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
    },
    body: JSON.stringify({
      action: actionKey,
      ...payload,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || `Action failed with status ${res.status}`);
  }
  return data;
}

export async function fetchLabs(serviceKey?: string): Promise<LabDefinition[]> {
  try {
    const url = serviceKey ? `/api/labs/catalog/?service=${serviceKey}` : '/api/labs/catalog/';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.labs || [];
  } catch (err) {
    console.error('Failed to fetch labs:', err);
    return [];
  }
}

export async function fetchLabsCatalog(): Promise<{ services: Array<{ service_key: string; service_title: string; lab_count: number; labs: LabDefinition[] }>; total_labs: number }> {
  try {
    const res = await fetch('/api/labs/catalog/');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch labs catalog:', err);
    return { services: [], total_labs: 0 };
  }
}

export async function fetchLabsProgress(): Promise<{ completed_lab_count: number; labs: Array<{ service: string; key: string; complete: boolean }> }> {
  try {
    const res = await fetch('/api/labs/progress/');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch labs progress:', err);
    return { completed_lab_count: 0, labs: [] };
  }
}

export async function fetchLabStatus(serviceKey: string, labKey: string): Promise<{ complete: boolean; steps: Record<string, { verified: boolean; verification?: any }> }> {
  try {
    const res = await fetch(`/api/labs/${serviceKey}/${labKey}/status/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch lab status:', err);
    return { complete: false, steps: {} };
  }
}

export async function runLabStep(
  serviceKey: string,
  labKey: string,
  stepKey: string
): Promise<any> {
  const res = await fetch(`/api/labs/${serviceKey}/${labKey}/steps/${stepKey}/run/`, {
    method: 'POST',
    headers: {
      'X-CSRFToken': getCsrfToken(),
    },
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Step failed');
  }
  return data;
}

export async function resetLab(serviceKey: string, labKey: string): Promise<any> {
  const res = await fetch(`/api/labs/${serviceKey}/${labKey}/reset/`, {
    method: 'POST',
    headers: {
      'X-CSRFToken': getCsrfToken(),
    },
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Reset failed');
  }
  return data;
}
