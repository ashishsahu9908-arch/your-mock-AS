import React, { useMemo } from 'react';
import katex from 'katex';

interface MathRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ content, className = '', inline = false }) => {
  const renderedHtml = useMemo(() => {
    if (!content) return '';

    // Split text by $$ (block math) and $ (inline math)
    // Also support \( ... \) and \[ ... \]
    const parts: string[] = [];
    
    // Replace \[...\] with $$...$$ and \(...\) with $...$
    let normalized = content
      .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
      .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

    // Split by block math $$...$$
    const blockRegex = /\$\$([\s\S]*?)\$\$/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(normalized)) !== null) {
      if (match.index > lastIndex) {
        parts.push(processInlineMath(normalized.substring(lastIndex, match.index)));
      }
      try {
        const mathHtml = katex.renderToString(match[1].trim(), {
          displayMode: true,
          throwOnError: false,
        });
        parts.push(`<div class="my-2 overflow-x-auto py-1">${mathHtml}</div>`);
      } catch (err) {
        parts.push(`<div class="font-mono text-amber-600 bg-amber-50 dark:bg-amber-950/40 p-1 rounded text-sm">${escapeHtml(match[1])}</div>`);
      }
      lastIndex = blockRegex.lastIndex;
    }

    if (lastIndex < normalized.length) {
      parts.push(processInlineMath(normalized.substring(lastIndex)));
    }

    return parts.join('');
  }, [content]);

  return (
    <div
      className={`leading-relaxed text-slate-800 dark:text-slate-100 ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};

function processInlineMath(text: string): string {
  // Regex for $...$
  const inlineRegex = /\$([^\$\n]+?)\$/g;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result += formatPlainText(text.substring(lastIndex, match.index));
    }
    try {
      const mathHtml = katex.renderToString(match[1].trim(), {
        displayMode: false,
        throwOnError: false,
      });
      result += `<span class="inline-block px-0.5">${mathHtml}</span>`;
    } catch {
      result += `<code class="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-sm font-mono">${escapeHtml(match[1])}</code>`;
    }
    lastIndex = inlineRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    result += formatPlainText(text.substring(lastIndex));
  }

  return result;
}

function formatPlainText(str: string): string {
  // Convert newlines to breaks or preserved whitespace
  return escapeHtml(str).replace(/\n/g, '<br/>');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
