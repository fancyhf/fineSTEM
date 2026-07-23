/**
 * sanitizeAssistantNarration 清洗逻辑测试（2026-07-22 测试体系重构）
 *
 * 核心验证：2026-07-22 重构移除了会误杀 AI 教学代码的激进规则。
 * 这些规则（cat/ls/import os/文件路径行清理）是"AI 回答被吞"的主因。
 *
 * 同时验证保留的清理仍然有效（DSML 残片、UUID 泄露、question/option 标签）。
 */
import { describe, it, expect } from 'vitest';
import { sanitizeAssistantNarration, cleanAssistantMessageContent } from './Create';

describe('sanitizeAssistantNarration - 不误杀教学代码（2026-07-22 修复核心）', () => {
  it('保留 cat/ls 等 shell 命令讲解', () => {
    const text = '你可以用 `ls` 命令查看目录，用 `cat file.txt` 查看文件内容。';
    const result = sanitizeAssistantNarration(text);
    expect(result).toContain('ls');
    expect(result).toContain('cat');
  });

  it('保留 import os 等 Python 教学代码', () => {
    const text = '示例：\nimport os\nprint(os.getcwd())';
    const result = sanitizeAssistantNarration(text);
    expect(result).toContain('import os');
    expect(result).toContain('os.getcwd()');
  });

  it('保留文件路径讲解', () => {
    const text = '项目结构：\nsrc/index.html\nsrc/main.js';
    const result = sanitizeAssistantNarration(text);
    // 2026-07-22 修复后不再删除这些行（它们是正常教学内容）
    expect(result).toContain('src/index.html');
  });

  it('保留 markdown 代码块完整内容', () => {
    const text = '```python\nimport os\nfor f in os.listdir("."):\n    print(f)\n```';
    const result = sanitizeAssistantNarration(text);
    expect(result).toContain('import os');
    expect(result).toContain('os.listdir');
  });

  it('保留正常含 < 字符的文本（比较运算、HTML 示例）', () => {
    const text = '如果 a < b，就返回 true';
    const result = sanitizeAssistantNarration(text);
    expect(result).toContain('a < b');
  });
});

describe('sanitizeAssistantNarration - 保留有效的垃圾清理', () => {
  it('清理 DSML 残片标签', () => {
    const text = '正常文字\n<｜｜DSML｜｜invoke name=tool>\n更多正常文字';
    const result = sanitizeAssistantNarration(text);
    expect(result).not.toContain('DSML');
    expect(result).toContain('正常文字');
    expect(result).toContain('更多正常文字');
  });

  it('清理孤立的 UUID 行（trace_id 泄露）', () => {
    const uuid = 'a1b57213-b531-4abc-9def-2055a2b3c4d5';
    const text = `正常回答\n${uuid}\n继续回答`;
    const result = sanitizeAssistantNarration(text);
    expect(result).not.toContain(uuid);
    expect(result).toContain('正常回答');
  });

  it('清理 question/option XML 标签（由 QuestionCard 独立渲染）', () => {
    const text = '请选择：\n<question title="x"><option id="a">选项A</option></question>\n谢谢';
    const result = sanitizeAssistantNarration(text);
    expect(result).not.toContain('<question');
    expect(result).not.toContain('<option');
    expect(result).toContain('请选择');
  });

  it('清理 invoke/parameter 关键字行', () => {
    const text = '正常\ninvoke name=read_file\nparameter name=path\n正常';
    const result = sanitizeAssistantNarration(text);
    expect(result).not.toContain('invoke name');
    expect(result).toContain('正常');
  });

  it('清理孤立的残缺标签碎片 </', () => {
    const text = '好的\n</';
    const result = sanitizeAssistantNarration(text);
    expect(result).not.toContain('</');
  });

  it('空字符串安全处理', () => {
    expect(sanitizeAssistantNarration('')).toBe('');
  });

  it('纯正常文本不被修改', () => {
    const text = '这是一段完全正常的中文回答，没有任何特殊内容。';
    expect(sanitizeAssistantNarration(text)).toBe(text);
  });
});

describe('cleanAssistantMessageContent', () => {
  it('保留代码块、清洗代码块外文本', () => {
    const text = `<｜DSML｜invoke>\n\`\`\`python\nprint("hi")\n\`\`\`\n<option>垃圾</option>`;
    const result = cleanAssistantMessageContent(text);
    expect(result).toContain('print');
    expect(result).not.toContain('DSML');
    expect(result).not.toContain('<option');
  });

  it('多个连续空行压缩', () => {
    const text = 'a\n\n\n\n\nb';
    const result = cleanAssistantMessageContent(text);
    expect(result).not.toMatch(/\n{3,}/);
  });
});
