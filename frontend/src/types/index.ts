export interface ServiceActionParam {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  default?: any;
  placeholder?: string;
  help?: string;
  choices?: Array<{ value: string; label: string }>;
}

export interface ServiceAction {
  key: string;
  label: string;
  description?: string;
  method?: string;
  path?: string;
  category?: string;
  params?: ServiceActionParam[];
}

export interface ServiceDefinition {
  key: string;
  title: string;
  eyebrow: string;
  category: string;
  maturity: 'missing' | 'inventory_only' | 'read_only_inspector' | 'interactive_workbench' | 'tutorial_ready';
  api_path: string;
  page_path: string;
  docs_url?: string;
  tags?: string[];
  actions?: ServiceAction[];
  count?: number;
  running?: boolean;
  status?: string;
}

export interface LabStepSnippet {
  cli: string;
  boto3: string;
  terraform: string;
}

export interface LabStep {
  key: string;
  title: string;
  command: string;
  explanation: string;
  artifact?: string;
  artifact_label?: string;
  secondary_artifact?: string;
  secondary_artifact_label?: string;
  snippets?: LabStepSnippet;
  status?: {
    verified?: boolean;
    verification?: {
      message?: string;
      verified?: boolean;
    };
  };
}

export interface LabDefinition {
  key: string;
  service: string;
  title: string;
  description: string;
  steps: LabStep[];
  complete?: boolean;
}

export interface IdentityInfo {
  account_id: string;
  user_id: string;
  arn: string;
  role: string;
  region: string;
  endpoint: string;
}
