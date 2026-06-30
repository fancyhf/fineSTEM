import React from 'react';
import { Link } from 'react-router-dom';

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

function isProjectPath(text: string): boolean {
  const value = text.trim();
  return (
    /^(src|docs|reports|assets|code|data|tests|public|app|pages|components|server|backend|frontend)\//i.test(value) ||
    /^[\w./\-\u4e00-\u9fff]+?\.(html|css|js|jsx|ts|tsx|py|md|json|pdf|docx|pptx|zip)$/i.test(value)
  );
}

function splitInline(text: string, projectId?: string | null): React.ReactNode[] {
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
      const inlineCode = token.slice(1, -1);
      if (projectId && isProjectPath(inlineCode)) {
        result.push(
          <Link
            key={`code-link-${match.index}`}
            to={`/research/projects/${projectId}?file=${encodeURIComponent(inlineCode)}`}
            className="px-1 py-0.5 rounded bg-teal-50 text-teal-700 underline decoration-teal-300 underline-offset-2 hover:bg-teal-100"
            title="打开项目主页查看资料与下载"
          >
            {inlineCode}
          </Link>
        );
      } else {
      result.push(
        <code key={`code-${match.index}`} className="px-1 py-0.5 rounded bg-gray-100 text-pink-700">
          {inlineCode}
        </code>
      );
      }
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

export function MarkdownText({ content, projectId }: { content: string; projectId?: string | null }) {
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLang = 'text';
  const codeBuffer: string[] = [];
  // 表格解析状态
  let tableHeader: string[] | null = null;
  let tableAlign: ('left' | 'center' | 'right')[] = [];
  const tableRows: string[][] = [];

  const flushTable = (key: string) => {
    if (!tableHeader) return null;
    const rendered = (
      <div key={key} className="overflow-x-auto my-2">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-gray-300">
              {tableHeader.map((cell, ci) => (
                <th key={ci} className={`px-3 py-1.5 font-semibold text-gray-800 ${tableAlign[ci] === 'center' ? 'text-center' : tableAlign[ci] === 'right' ? 'text-right' : 'text-left'}`}>
                  {splitInline(cell.trim(), projectId)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, ri) => (
              <tr key={ri} className="border-b border-gray-200">
                {row.map((cell, ci) => (
                  <td key={ci} className={`px-3 py-1.5 text-gray-700 ${tableAlign[ci] === 'center' ? 'text-center' : tableAlign[ci] === 'right' ? 'text-right' : 'text-left'}`}>
                    {splitInline(cell.trim(), projectId)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableHeader = null;
    tableAlign = [];
    tableRows.length = 0;
    return rendered;
  };

  const isTableSeparator = (line: string): boolean => {
    const trimmed = line.trim();
    return /^\|[-: |]+\|$/.test(trimmed) && trimmed.includes('-');
  };

  const parseAlignments = (separatorLine: string): ('left' | 'center' | 'right')[] => {
    return separatorLine
      .split('|')
      .filter(s => s.trim())
      .map(s => {
        const t = s.trim();
        if (t.startsWith(':') && t.endsWith(':')) return 'center';
        if (t.endsWith(':')) return 'right';
        return 'left';
      });
  };

  const parseTableRow = (line: string): string[] => {
    return line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
  };

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
    codeBuffer.length = 0;
    return rendered;
  };

  lines.forEach((line, idx) => {
    if (line.startsWith('```')) {
      // 先 flush 未完成的表格
      const tbl = flushTable(`table-${idx}`);
      if (tbl) nodes.push(tbl);
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

    // 表格解析
    if (line.trim().startsWith('|')) {
      // 跳过表格分隔符行（|---|:---:|---|）
      if (isTableSeparator(line)) {
        return;
      }
      if (tableHeader) {
        // 已在表格中 → 收集数据行
        tableRows.push(parseTableRow(line));
        return;
      }
      // 检查下一行是否为分隔符
      const nextLine = idx + 1 < lines.length ? lines[idx + 1] : '';
      if (isTableSeparator(nextLine)) {
        tableHeader = parseTableRow(line);
        tableAlign = parseAlignments(nextLine);
        return;
      }
      // 非表格，按普通行处理
    } else if (tableHeader) {
      // 表格结束 → flush
      const tbl = flushTable(`table-${idx}`);
      if (tbl) nodes.push(tbl);
      // 继续处理当前行
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
      nodes.push(<p key={`li-${idx}`}>• {splitInline(line.slice(2), projectId)}</p>);
      return;
    }
    if (line.trim() === '') {
      nodes.push(<div key={`sp-${idx}`} className="h-2" />);
      return;
    }
    nodes.push(<p key={`p-${idx}`}>{splitInline(line, projectId)}</p>);
  });

  // flush 末尾未完成的表格
  const finalTable = flushTable(`table-end`);
  if (finalTable) nodes.push(finalTable);

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
