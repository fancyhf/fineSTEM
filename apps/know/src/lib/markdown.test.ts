import { describe, expect, it } from 'vitest';

import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('段落与换行', () => {
    expect(renderMarkdown('第一段\n\n第二段')).toBe('<p>第一段</p>\n<p>第二段</p>');
  });

  it('标题与列表', () => {
    const html = renderMarkdown('## 怎么用\n- 先互动\n- 再看视频');
    expect(html).toContain('<h3>怎么用</h3>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>先互动</li>');
    expect(html).toContain('<li>再看视频</li>');
    expect(html).toContain('</ul>');
  });

  it('加粗与链接（仅 http/https）', () => {
    expect(renderMarkdown('**重点**')).toBe('<p><strong>重点</strong></p>');
    const html = renderMarkdown('[官网](https://example.com)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    // 非 http 协议不渲染为链接
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('<a ');
  });

  it('HTML 全部转义，无注入面', () => {
    const html = renderMarkdown('<script>alert(1)</script> & <img src=x>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });
});
