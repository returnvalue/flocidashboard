import { IdentityInfo, LabDefinition, ServiceAction, ServiceDefinition } from '../types';

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

export const fetchInventory = fetchServiceInventory;

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
    headers: { 'X-CSRFToken': getCsrfToken() },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function fetchSesMessages(): Promise<{ mailbox_url: string; messages: any[]; raw: any }> {
  try {
    const res = await fetch('/api/inspector/ses/messages/');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch SES messages:', err);
    return { mailbox_url: '', messages: [], raw: {} };
  }
}

export async function clearSesMessages(): Promise<any> {
  const res = await fetch('/api/inspector/ses/messages/clear/', {
    method: 'DELETE',
    headers: { 'X-CSRFToken': getCsrfToken() },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function fetchInspectorSqsQueues(): Promise<{ queues: Array<{ name: string; url: string; arn: string; available: number; in_flight: number }> }> {
  try {
    const res = await fetch('/api/inspector/sqs/queues/');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch SQS queues:', err);
    return { queues: [] };
  }
}

export async function fetchInspectorSqsMessages(queueUrl: string, maxNumber: number = 10): Promise<{ queue_url: string; queue_name: string; messages: any[] }> {
  try {
    const res = await fetch(`/api/inspector/sqs/messages/?queue_url=${encodeURIComponent(queueUrl)}&max_number=${maxNumber}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch SQS messages:', err);
    return { queue_url: queueUrl, queue_name: '', messages: [] };
  }
}

export async function fetchInspectorLogGroups(): Promise<{ log_groups: Array<{ logGroupName: string; creationTime: number; storedBytes: number }> }> {
  try {
    const res = await fetch('/api/inspector/lambda/log-groups/');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch Lambda log groups:', err);
    return { log_groups: [] };
  }
}

export async function fetchInspectorLogEvents(logGroupName: string, limit: number = 50): Promise<{ log_group_name: string; streams: any[]; events: Array<{ timestamp: number; message: string; ingestionTime: number; logStreamName: string }> }> {
  try {
    const res = await fetch(`/api/inspector/lambda/log-events/?log_group_name=${encodeURIComponent(logGroupName)}&limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch Lambda log events:', err);
    return { log_group_name: logGroupName, streams: [], events: [] };
  }
}

export async function fetchSettings(): Promise<any> {
  try {
    const res = await fetch('/api/settings/');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch settings:', err);
    return {};
  }
}

export async function saveEndpoint(endpointUrl: string): Promise<any> {
  const res = await fetch('/api/settings/endpoint/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
    body: JSON.stringify({ endpoint_url: endpointUrl }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Failed to save endpoint');
  return data;
}

export async function resetEndpoint(): Promise<any> {
  const res = await fetch('/api/settings/endpoint/reset/', {
    method: 'POST',
    headers: { 'X-CSRFToken': getCsrfToken() },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function testConnection(endpointUrl?: string): Promise<any> {
  const res = await fetch('/api/settings/test-connection/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
    body: JSON.stringify(endpointUrl ? { endpoint_url: endpointUrl } : {}),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Connection test failed');
  return data;
}

export async function resetFlociState(): Promise<any> {
  const res = await fetch('/api/settings/floci-reset/', {
    method: 'POST',
    headers: { 'X-CSRFToken': getCsrfToken() },
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Floci reset failed');
  return data;
}

export async function fetchIdentityDetail(): Promise<any> {
  try {
    const res = await fetch('/api/session-identity/');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch identity detail:', err);
    return {};
  }
}

export async function useAdminIdentity(): Promise<any> {
  const res = await fetch('/api/session-identity/use-admin/', {
    method: 'POST',
    headers: { 'X-CSRFToken': getCsrfToken() },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function useUserIdentity(userName: string, rotateAccessKeys: boolean = false): Promise<any> {
  const res = await fetch('/api/session-identity/use-user/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
    body: JSON.stringify({ user_name: userName, rotate_access_keys: rotateAccessKeys }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Failed to switch user identity');
  return data;
}

export async function assumeRoleIdentity(roleName: string, sessionName?: string, accountId?: string): Promise<any> {
  const res = await fetch('/api/session-identity/assume-role/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
    body: JSON.stringify({ role_name: roleName, session_name: sessionName, account_id: accountId }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Failed to assume role');
  return data;
}

export async function clearSessionIdentity(): Promise<any> {
  const res = await fetch('/api/session-identity/clear/', {
    method: 'POST',
    headers: { 'X-CSRFToken': getCsrfToken() },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function runCliCommand(command: string, confirmed: boolean = false): Promise<any> {
  const res = await fetch('/api/console/run/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
    body: JSON.stringify({ command, confirmed }),
  });
  const data = await res.json();
  if (!res.ok && !data.confirmation_required) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export function executeServiceAction(
  serviceKey: string,
  actionKey: string,
  payload: Record<string, any>
): Promise<any>;
export function executeServiceAction(
  action: ServiceAction,
  formValues: Record<string, any>,
  fileValues?: Record<string, File>
): Promise<any>;
export async function executeServiceAction(
  actionOrServiceKey: string | ServiceAction,
  actionKeyOrFormValues: string | Record<string, any>,
  payloadOrFileValues: Record<string, any> = {}
): Promise<any> {
  if (typeof actionOrServiceKey === 'string') {
    const serviceKey = actionOrServiceKey;
    const actionKey = actionKeyOrFormValues as string;
    const payload = payloadOrFileValues as Record<string, any>;
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

  const action = actionOrServiceKey;
  const formValues = (actionKeyOrFormValues || {}) as Record<string, any>;
  const fileValues = (payloadOrFileValues || {}) as Record<string, File>;

  let targetPath = action.path;
  const queryParams = new URLSearchParams();
  const payload: Record<string, any> = {};
  const hasFiles = Object.keys(fileValues).length > 0;

  // Substitute {param} in path or populate payload
  (action.fields || []).forEach((f) => {
    const value = formValues[f.name];
    if (targetPath.includes(`{${f.name}}`)) {
      targetPath = targetPath.replace(`{${f.name}}`, encodeURIComponent(value != null ? String(value) : ''));
    } else if (value !== undefined && value !== '') {
      if (action.method === 'GET') {
        queryParams.set(f.name, String(value));
      } else {
        if (f.field_type === 'number') {
          payload[f.name] = Number(value);
        } else if (f.field_type === 'boolean') {
          payload[f.name] = Boolean(value);
        } else if (f.field_type === 'object' || f.field_type === 'array') {
          try {
            payload[f.name] = typeof value === 'string' ? JSON.parse(value) : value;
          } catch {
            payload[f.name] = value;
          }
        } else {
          payload[f.name] = value;
        }
      }
    }
  });

  const queryString = queryParams.toString();
  const fullUrl = queryString ? `${targetPath}?${queryString}` : targetPath;

  const options: RequestInit = {
    method: action.method || 'POST',
    headers: {
      'X-CSRFToken': getCsrfToken(),
    },
  };

  if (action.method !== 'GET') {
    if (hasFiles) {
      const formData = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        formData.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      });
      Object.entries(fileValues).forEach(([k, file]) => {
        formData.append(k, file);
      });
      options.body = formData;
    } else {
      (options.headers as Record<string, string>)['Content-Type'] = 'application/json';
      options.body = JSON.stringify(payload);
    }
  }

  const res = await fetch(fullUrl, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return data;
}
