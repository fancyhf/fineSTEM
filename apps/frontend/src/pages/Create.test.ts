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

describe('salvageAnswerFromThinking - 思考链抢救（2026-08-16 v2 防回归）', () => {
  // 以下用例取自线上真实数据（项目 b9e0f446，复制引导验证回复）
  it('形态一：正文极短 + 思考长 → 提升非元叙述内容为正文', async () => {
    const { salvageAnswerFromThinking } = await import('./Create');
    const out = salvageAnswerFromThinking(
      '卡片已经发出去啦！',
      '我应该先调用工具读取状态。\n让我看看代码。\n页面标题在 index.html 第 1 行的 <title> 标签里，改成自己的项目名。\n副标题在 <h1> 标签里，两处都要改成项目名。\n改完后运行一次页面，确认浏览器标签和页面大标题都变了，再点"我改好了"让我检查。',
    );
    expect(out).toBeTruthy();
    expect(out).toContain('<title>');
    expect(out).not.toContain('我应该');
    expect(out).toContain('卡片已经发出去啦');
  });

  it('形态二（v2 新增）：正文是泛泛引导语，验证结论藏在思考尾部"回复计划"里 → 结论提到正文开头', async () => {
    const { salvageAnswerFromThinking } = await import('./Create');
    const content = '卡片已经发出去啦！你点一个选项告诉我下一步怎么做就行～**小复习一下**：标题有两处要改，都在 index.html 里。';
    const thinking =
      'verifier 返回 auto_passed=false，first_issue 是未命中关键词。'.repeat(60) +
      '\n所以我的回复应该是：\n1. 明确告诉学生：我检查了代码，验证还没通过\n2. 指出具体问题：页面上的大标题 <h1> 还是"词频分析器"，没改成项目名\n3. 给一层提示：在 index.html 里找到 <h1> 那一行改成自己的项目名\n4. 用 ask_question 给出选项卡';
    const out = salvageAnswerFromThinking(content, thinking);
    expect(out).toBeTruthy();
    expect(out).toContain('验证还没通过');
    expect(out).toContain('<h1>');
    // 原正文保留在后
    expect(out).toContain('小复习一下');
    // 元叙述行不进入正文
    expect(out).not.toContain('ask_question');
  });

  it('正文已充分（>=400 字）时不兜底，避免污染正常回复', async () => {
    const { salvageAnswerFromThinking } = await import('./Create');
    const longContent = '这是一段足够长的正常回答。'.repeat(40);
    const out = salvageAnswerFromThinking(longContent, '我的回复应该是： blah '.repeat(200));
    expect(out).toBeNull();
  });

  it('思考里没有计划标记时不兜底', async () => {
    const { salvageAnswerFromThinking } = await import('./Create');
    // 注意 content >= 40 字，否则会命中形态一
    const content = '卡片已经发出去啦！你点一个选项告诉我下一步怎么做就行～标题有两处要改，都在 index.html 里，改完记得保存。';
    const thinking = '学生还没改代码。'.repeat(200); // >1500 字但无计划标记
    const out = salvageAnswerFromThinking(content, thinking);
    expect(out).toBeNull();
  });
});

describe('salvageAnswerFromThinking - 2026-08-18 线上案例（讲解写进 artifact_writer，正文只剩引导语）', () => {
  it('形态二（扩充标记词）：思考尾部"讲解内容规划/我决定："的计划段提升为正文', async () => {
    const { salvageAnswerFromThinking } = await import('./Create');
    // 取自项目 b9e0f446 msg31：content 39 字，thinking 2757 字
    const content = '卡片已经发出去啦，你点一个告诉我就行 🙌\n我在这里等你，选好后马上带你走～ 💪';
    const thinking =
      '学生选择了讲讲 placeholder 是什么。根据要求思考过程不展示给学生。'.repeat(60) +
      '\n讲解内容规划（正文）：\n- 一句话定义：placeholder 是输入框里的"灰色提示文字"\n- 用比喻：就像便利贴占座\n- 结合他的代码拆解 textarea 的 placeholder 属性\n- 三个特点：输入后消失、不是真实内容、不会被提交' +
      '\n我决定：\n1. 正文中完整讲解 placeholder\n2. 调用 artifact_writer 沉淀讲解要点';
    const out = salvageAnswerFromThinking(content, thinking);
    expect(out).toBeTruthy();
    expect(out).toContain('灰色提示文字');
    expect(out).toContain('placeholder');
    expect(out).toContain('卡片已经发出去啦');
  });

  it('形态一阈值内的讲解案例也能兜底（正文<40字 + 思考>120字）', async () => {
    const { salvageAnswerFromThinking } = await import('./Create');
    const content = '卡片已经发出去啦，你点一个告诉我就行 🙌';
    const thinking =
      '我应该先想想怎么讲。\n一句话定义：placeholder 是输入框里的灰色提示文字，输入内容后会自动消失。\n它不是真实内容，提交表单时也不会被发送。\n在你的 index.html 里，textarea 标签的 placeholder 属性就是它。';
    const out = salvageAnswerFromThinking(content, thinking);
    expect(out).toBeTruthy();
    expect(out).toContain('灰色提示文字');
    expect(out).not.toContain('我应该');
  });
});

describe('resolveFinalAssistantContent - 多段回复末段覆盖修复（2026-08-18 任务3布置消失）', () => {
  it('服务端 final 只是本地全文的尾段 → 恢复完整本地版本', async () => {
    const { resolveFinalAssistantContent } = await import('./Create');
    const local =
      '任务 2 已完成！现在进入 **任务 3：修改一个交互或样式参数**。\n\n任务内容：把按钮文字「分析」改成你喜欢的文案。\n完成条件：页面按钮显示新文字。\n定位：用 Ctrl+F 搜「>分析<」。\n\n卡片已经发出去啦！你在四个选项里点一个就行～';
    const final = '卡片已经发出去啦！你在四个选项里点一个就行～';
    const out = resolveFinalAssistantContent(final, local, '');
    expect(out).toBe(local);
    expect(out).toContain('任务 3');
  });

  it('服务端 final 与本地分叉（重写/深度清理）→ 仍以服务端为准', async () => {
    const { resolveFinalAssistantContent } = await import('./Create');
    const local = '流式中途的脏内容 d3b07384-aaaa 未能清理的片段';
    const final = '这是服务端重写后的干净回复';
    const out = resolveFinalAssistantContent(final, local, '');
    expect(out).toBe(final);
  });

  it('final 为空 → 回落 maxVisible', async () => {
    const { resolveFinalAssistantContent } = await import('./Create');
    expect(resolveFinalAssistantContent('', '', '历史可见内容')).toBe('历史可见内容');
  });

  it('本地与 final 相同 → 不变', async () => {
    const { resolveFinalAssistantContent } = await import('./Create');
    const out = resolveFinalAssistantContent('一样的回复', '一样的 回复', '');
    expect(out).toBe('一样的回复');
  });
});
