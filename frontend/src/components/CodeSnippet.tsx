import React, { useState } from 'react';
import Button from '@cloudscape-design/components/button';

interface CodeSnippetProps {
  code: string;
  language: 'cli' | 'boto3' | 'terraform' | 'json';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightPython(code: string): string {
  const escaped = escapeHtml(code);
  return escaped
    .replace(/(#.*$)/gm, '<span style="color: #6a9955; font-style: italic;">$1</span>')
    .replace(/(".*?"|'.*?')/g, '<span style="color: #ce9178;">$1</span>')
    .replace(/\b(import|from|def|return|if|elif|else|for|in|while|try|except|finally|with|as|class|pass|raise|True|False|None)\b/g, '<span style="color: #569cd6; font-weight: 600;">$1</span>')
    .replace(/\b(boto3|client|resource|Session)\b/g, '<span style="color: #4ec9b0;">$1</span>')
    .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*\()/g, '<span style="color: #dcdcaa;">$1</span>')
    .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*=)/g, '<span style="color: #9cdcfe;">$1</span>');
}

function highlightTerraform(code: string): string {
  const escaped = escapeHtml(code);
  return escaped
    .replace(/(#.*$|\/\/.*$)/gm, '<span style="color: #6a9955; font-style: italic;">$1</span>')
    .replace(/(".*?")/g, '<span style="color: #ce9178;">$1</span>')
    .replace(/\b(resource|data|variable|output|provider|terraform|module|locals)\b/g, '<span style="color: #c586c0; font-weight: 600;">$1</span>')
    .replace(/\b(true|false|null)\b/g, '<span style="color: #569cd6;">$1</span>')
    .replace(/\b([a-zA-Z_][a-zA-Z0-9_-]*)(?=\s*=)/g, '<span style="color: #9cdcfe;">$1</span>');
}

function highlightCli(code: string): string {
  const escaped = escapeHtml(code);
  return escaped
    .replace(/(#.*$)/gm, '<span style="color: #6a9955; font-style: italic;">$1</span>')
    .replace(/(".*?"|'.*?')/g, '<span style="color: #ce9178;">$1</span>')
    .replace(/^(\s*aws\s+[a-z0-9-]+(?:\s+[a-z0-9-]+)?)/g, '<span style="color: #4ec9b0; font-weight: 600;">$1</span>')
    .replace(/(--[a-zA-Z0-9-]+)/g, '<span style="color: #9cdcfe;">$1</span>')
    .replace(/(\|\s*[a-z0-9]+)/g, '<span style="color: #c586c0;">$1</span>');
}

function highlightJson(code: string): string {
  const escaped = escapeHtml(code);
  return escaped
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (match) => {
      let cls = '#b5cea8'; // number
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = '#9cdcfe'; // key
        } else {
          cls = '#ce9178'; // string
        }
      } else if (/true|false/.test(match)) {
        cls = '#569cd6'; // boolean
      } else if (/null/.test(match)) {
        cls = '#569cd6'; // null
      }
      return `<span style="color: ${cls};">${match}</span>`;
    });
}

export const CodeSnippet: React.FC<CodeSnippetProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const getHighlightedHtml = () => {
    switch (language) {
      case 'boto3':
        return highlightPython(code);
      case 'terraform':
        return highlightTerraform(code);
      case 'cli':
        return highlightCli(code);
      case 'json':
        return highlightJson(code);
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
