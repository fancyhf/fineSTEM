/**
 * 极简 Markdown 渲染（节目说明区专用）
 *
 * 支持：段落、##/### 标题、- 列表、**加粗**、[链接](https://…)。
 * 全部输入先做 HTML 转义，仅输出白名单标签，无 XSS 面。
 * 不引入 markdown 依赖：说明文案体量小、格式可控。
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(s: string): string {
  // 链接仅允许 http(s)
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return s;
}

export function renderMarkdown(src: string): string {
  const lines = escapeHtml(src ?? '').split(/\r?\n/);
  const out: string[] = [];
  let listOpen = false;
  const closeList = () => {
    if (listOpen) {
      out.push('</ul>');
      listOpen = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    if (line.startsWith('### ')) {
      closeList();
      out.push(`<h4>${renderInline(line.slice(4))}</h4>`);
    } else if (line.startsWith('## ')) {
      closeList();
      out.push(`<h3>${renderInline(line.slice(3))}</h3>`);
    } else if (/^[-*] /.test(line)) {
      if (!listOpen) {
        out.push('<ul>');
        listOpen = true;
      }
      out.push(`<li>${renderInline(line.replace(/^[-*] /, ''))}</li>`);
    } else {
      closeList();
      out.push(`<p>${renderInline(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}
