import React from 'react';

const LANG_KEYWORDS: Record<string, string[]> = {
  ts: ['const', 'let', 'function', 'return', 'type', 'interface', 'if', 'else', 'await', 'async'],
  tsx: ['const', 'let', 'function', 'return', 'type', 'interface', 'if', 'else', 'await', 'async'],
  js: ['const', 'let', 'function', 'return', 'if', 'else', 'await', 'async', 'new'],
  javascript: ['const', 'let', 'function', 'return', 'if', 'else', 'await', 'async', 'new'],
  python: ['def', 'return', 'if', 'else', 'elif', 'for', 'while', 'import', 'from', 'class'],
  py: ['def', 'return', 'if', 'else', 'elif', 'for', 'while', 'import', 'from', 'class'],
  html: ['div', 'span', 'script', 'style', 'body', 'head'],
  css: ['color', 'display', 'position', 'padding', 'margin', 'background', 'font-size'],
};

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitInline(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = pattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      result.push(<React.Fragment key={`plain-${lastIndex}`}>{text.slice(lastIndex, match.index)}</React.Fragment>);
    }
    const token = match[0];
    if (token.startsWith('**')) {
      result.push(<strong key={`strong-${match.index}`} className="font-semibold">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      result.push(
        <code key={`code-${match.index}`} className="px-1 py-0.5 rounded bg-gray-100 text-pink-700">
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    result.push(<React.Fragment key={`plain-end-${lastIndex}`}>{text.slice(lastIndex)}</React.Fragment>);
  }
  return result;
}

function highlightCodeLine(line: string, lang: string): React.ReactNode {
  const commentsPattern = /(\/\/.*$|#.*$)/;
  const stringsPattern = /(".*?"|'.*?'|`.*?`)/g;
  const commentMatch = line.match(commentsPattern);
  const commentText = commentMatch?.[0] ?? '';
  const mainText = commentMatch ? line.slice(0, commentMatch.index ?? line.length) : line;

  const keywordSet = new Set(LANG_KEYWORDS[lang.toLowerCase()] ?? []);
  const keywordRegex = keywordSet.size > 0
    ? new RegExp(`\\b(${Array.from(keywordSet).map((k) => escapeRegExp(k)).join('|')})\\b`, 'g')
    : null;

  const segments: React.ReactNode[] = [];
  let cursor = 0;
  const withStrings = Array.from(mainText.matchAll(stringsPattern));
  withStrings.forEach((match, index) => {
    const start = match.index ?? 0;
    const text = match[0];
    if (start > cursor) {
      const chunk = mainText.slice(cursor, start);
      segments.push(
        <span key={`kw-${index}-${start}`}>
          {keywordRegex
            ? chunk.split(keywordRegex).map((part, idx) => (
              keywordSet.has(part) ? <span key={`${part}-${idx}`} className="text-cyan-300">{part}</span> : <React.Fragment key={`${part}-${idx}`}>{part}</React.Fragment>
            ))
            : chunk}
        </span>
      );
    }
    segments.push(<span key={`str-${index}-${start}`} className="text-amber-300">{text}</span>);
    cursor = start + text.length;
  });

  if (cursor < mainText.length || (!withStrings.length && mainText.length > 0)) {
    const chunk = mainText.slice(cursor);
    segments.push(
      <span key={`tail-${cursor}`}>
        {keywordRegex
          ? chunk.split(keywordRegex).map((part, idx) => (
            keywordSet.has(part) ? <span key={`${part}-${idx}`} className="text-cyan-300">{part}</span> : <React.Fragment key={`${part}-${idx}`}>{part}</React.Fragment>
          ))
          : chunk}
      </span>
    );
  }

  if (commentText) {
    segments.push(<span key="comment" className="text-gray-400">{commentText}</span>);
  }

  return <>{segments}</>;
}

export function MarkdownText({ content }: { content: string }) {
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLang = 'text';
  let codeBuffer: string[] = [];

  const flushCodeBlock = (key: string) => {
    if (!codeBuffer.length) return null;
    const rendered = (
      <pre key={key} className="bg-gray-900 text-gray-100 rounded-lg p-3 overflow-auto text-xs leading-6">
        <code>
          {codeBuffer.map((line, idx) => (
            <div key={`${key}-${idx}`}>{highlightCodeLine(line, codeLang)}</div>
          ))}
        </code>
      </pre>
    );
    codeBuffer = [];
    return rendered;
  };

  lines.forEach((line, idx) => {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        const codeNode = flushCodeBlock(`code-${idx}`);
        if (codeNode) nodes.push(codeNode);
        inCodeBlock = false;
        codeLang = 'text';
      } else {
        inCodeBlock = true;
        codeLang = line.replace('```', '').trim() || 'text';
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    if (line.startsWith('### ')) {
      nodes.push(<h3 key={`h3-${idx}`} className="text-base font-semibold mt-2">{line.slice(4)}</h3>);
      return;
    }
    if (line.startsWith('## ')) {
      nodes.push(<h2 key={`h2-${idx}`} className="text-lg font-semibold mt-2">{line.slice(3)}</h2>);
      return;
    }
    if (line.startsWith('# ')) {
      nodes.push(<h1 key={`h1-${idx}`} className="text-xl font-semibold mt-2">{line.slice(2)}</h1>);
      return;
    }
    if (line.startsWith('- ')) {
      nodes.push(<p key={`li-${idx}`}>• {splitInline(line.slice(2))}</p>);
      return;
    }
    if (line.trim() === '') {
      nodes.push(<div key={`sp-${idx}`} className="h-2" />);
      return;
    }
    nodes.push(<p key={`p-${idx}`}>{splitInline(line)}</p>);
  });

  if (inCodeBlock) {
    const codeNode = flushCodeBlock(`code-last-${lines.length}`);
    if (codeNode) nodes.push(codeNode);
  }

  return (
    <div className="text-sm whitespace-pre-wrap leading-relaxed">
      {nodes}
    </div>
  );
}
