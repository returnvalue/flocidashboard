import React, { useState } from 'react';
import Button from '@cloudscape-design/components/button';

interface CodeSnippetProps {
  code: string;
  language: 'cli' | 'boto3' | 'terraform' | 'json';
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightPython(code: string): string {
  const raw = String(code || '');
  const regex = /(#.*?$)|("""[\s\S]*?"""|'''[\s\S]*?''')|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d+(?:\.\d+)?\b)|(\b(?:import|from|as|def|class|return|if|else|elif|for|in|while|try|except|with|and|or|not|is|raise|pass|break|continue|lambda|yield|async|await)\b)|(\b(?:True|False|None)\b)|(\b(?:boto3|print|dict|list|set|str|int|float|bool|len|range|enumerate|zip|open|type)\b)|(\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\())|(\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*=))/gm;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let html = '';

  while ((match = regex.exec(raw)) !== null) {
    html += escapeHtml(raw.slice(lastIndex, match.index));
    const [full, comment, multiStr, str, num, kw, boolVal, builtin, func, param] = match;
    if (comment) {
      html += `<span style="color: #6a9955; font-style: italic;">${escapeHtml(comment)}</span>`;
    } else if (multiStr || str) {
      html += `<span style="color: #ce9178;">${escapeHtml(multiStr || str)}</span>`;
    } else if (num) {
      html += `<span style="color: #b5cea8;">${escapeHtml(num)}</span>`;
    } else if (kw) {
      html += `<span style="color: #569cd6; font-weight: 600;">${escapeHtml(kw)}</span>`;
    } else if (boolVal) {
      html += `<span style="color: #569cd6;">${escapeHtml(boolVal)}</span>`;
    } else if (builtin) {
      html += `<span style="color: #4ec9b0;">${escapeHtml(builtin)}</span>`;
    } else if (func) {
      html += `<span style="color: #dcdcaa;">${escapeHtml(func)}</span>`;
    } else if (param) {
      html += `<span style="color: #9cdcfe;">${escapeHtml(param)}</span>`;
    } else {
      html += escapeHtml(full);
    }
    lastIndex = regex.lastIndex;
  }

  html += escapeHtml(raw.slice(lastIndex));
  return html;
}

function highlightHCL(code: string): string {
  const raw = String(code || '');
  const regex = /(#.*?$|\/\/.*?$|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*")|(\b\d+(?:\.\d+)?\b)|(\b(?:resource|data|variable|output|provider|terraform|locals|module|dynamic|content)\b)|(\b(?:string|number|bool|list|map|set|object|any)\b)|(\b(?:true|false|null)\b)|(\b[a-zA-Z0-9_-]+(?=\s*=))|(\b(?:aws_[a-zA-Z0-9_]+)\b)/gm;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let html = '';

  while ((match = regex.exec(raw)) !== null) {
    html += escapeHtml(raw.slice(lastIndex, match.index));
    const [full, comment, str, num, blockKw, typeKw, boolVal, prop, resourceType] = match;
    if (comment) {
      html += `<span style="color: #6a9955; font-style: italic;">${escapeHtml(comment)}</span>`;
    } else if (str) {
      html += `<span style="color: #ce9178;">${escapeHtml(str)}</span>`;
    } else if (num) {
      html += `<span style="color: #b5cea8;">${escapeHtml(num)}</span>`;
    } else if (blockKw) {
      html += `<span style="color: #c586c0; font-weight: 600;">${escapeHtml(blockKw)}</span>`;
    } else if (typeKw) {
      html += `<span style="color: #4ec9b0;">${escapeHtml(typeKw)}</span>`;
    } else if (boolVal) {
      html += `<span style="color: #569cd6;">${escapeHtml(boolVal)}</span>`;
    } else if (prop) {
      html += `<span style="color: #9cdcfe;">${escapeHtml(prop)}</span>`;
    } else if (resourceType) {
      html += `<span style="color: #4ec9b0; font-weight: 600;">${escapeHtml(resourceType)}</span>`;
    } else {
      html += escapeHtml(full);
    }
    lastIndex = regex.lastIndex;
  }

  html += escapeHtml(raw.slice(lastIndex));
  return html;
}

function highlightCLI(code: string): string {
  const raw = String(code || '');
  const regex = /(#.*?$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\baws\b)|(--[a-zA-Z0-9_-]+)|(\b\d+(?:\.\d+)?\b)/gm;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let html = '';

  while ((match = regex.exec(raw)) !== null) {
    html += escapeHtml(raw.slice(lastIndex, match.index));
    const [full, comment, str, awsCmd, flag, num] = match;
    if (comment) {
      html += `<span style="color: #6a9955; font-style: italic;">${escapeHtml(comment)}</span>`;
    } else if (str) {
      html += `<span style="color: #ce9178;">${escapeHtml(str)}</span>`;
    } else if (awsCmd) {
      html += `<span style="color: #4ec9b0; font-weight: 600;">${escapeHtml(awsCmd)}</span>`;
    } else if (flag) {
      html += `<span style="color: #9cdcfe;">${escapeHtml(flag)}</span>`;
    } else if (num) {
      html += `<span style="color: #b5cea8;">${escapeHtml(num)}</span>`;
    } else {
      html += escapeHtml(full);
    }
    lastIndex = regex.lastIndex;
  }

  html += escapeHtml(raw.slice(lastIndex));
  return html;
}

function highlightJSON(code: string): string {
  const raw = String(code || '');
  const regex = /("(?:\\.|[^"\\])*")(\s*:)?|(\b\d+(?:\.\d+)?\b)|(\b(?:true|false|null)\b)/gm;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let html = '';

  while ((match = regex.exec(raw)) !== null) {
    html += escapeHtml(raw.slice(lastIndex, match.index));
    const [full, str, isKey, num, boolVal] = match;
    if (str && isKey) {
      html += `<span style="color: #9cdcfe;">${escapeHtml(str)}</span>:`;
    } else if (str) {
      html += `<span style="color: #ce9178;">${escapeHtml(str)}</span>`;
    } else if (num) {
      html += `<span style="color: #b5cea8;">${escapeHtml(num)}</span>`;
    } else if (boolVal) {
      html += `<span style="color: #569cd6;">${escapeHtml(boolVal)}</span>`;
    } else {
      html += escapeHtml(full);
    }
    lastIndex = regex.lastIndex;
  }

  html += escapeHtml(raw.slice(lastIndex));
  return html;
}

export const CodeSnippet: React.FC<CodeSnippetProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const getHighlightedHtml = () => {
    switch (language) {
      case 'boto3':
        return highlightPython(code);
      case 'terraform':
        return highlightHCL(code);
      case 'cli':
        return highlightCLI(code);
      case 'json':
        return highlightJSON(code);
      default:
        return escapeHtml(code);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid #232f3e' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#0d1520',
          padding: '6px 12px',
          borderBottom: '1px solid #1b2636',
          fontSize: '11px',
          color: '#879596',
          textTransform: 'uppercase',
          fontWeight: 600,
          letterSpacing: '0.5px',
        }}
      >
        <span>{language === 'cli' ? 'AWS CLI v2' : language === 'boto3' ? 'Python (Boto3)' : language === 'terraform' ? 'Terraform (HCL)' : 'JSON'}</span>
        <Button
          variant="inline-icon"
          iconName={copied ? 'status-positive' : 'copy'}
          onClick={handleCopy}
          ariaLabel="Copy code"
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '14px 16px',
          background: '#0a1017',
          color: '#d4d4d4',
          fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, Monaco, monospace",
          fontSize: '13px',
          lineHeight: '1.6',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
        dangerouslySetInnerHTML={{ __html: getHighlightedHtml() }}
      />
    </div>
  );
};
