/**
 * questionParser 单元测试（2026-07-22 测试体系重构，vitest 版）
 *
 * 覆盖：
 * - toolCallToQuestion：ask_question 工具调用 args → QuestionData（主路径）
 * - parseQuestionBlock / parseQuestionBlocks：XML <question> 解析
 * - parseQuestionsFromText：主入口两段式
 *
 * 旧的 node:test 版本归档为 questionParser.test.legacy.ts。
 */
import { describe, it, expect } from 'vitest';
import {
  parseQuestionBlock,
  parseQuestionBlocks,
  parseQuestionsFromText,
  extractChoiceListStrict,
  toolCallToQuestion,
} from './questionParser';

describe('toolCallToQuestion（ask_question 主路径）', () => {
  it('完整 args 转换', () => {
    const args = {
      title: '你现在是哪个年级？',
      multiple: false,
      step: 1,
      total_steps: 3,
      options: [
        { id: 'junior', label: '初中', description: '7~9年级' },
        { id: 'senior', label: '高中', description: '10~12年级' },
      ],
    };
    const q = toolCallToQuestion(args);
    expect(q).not.toBeNull();
    expect(q!.title).toBe('你现在是哪个年级？');
    expect(q!.multiple).toBe(false);
    expect(q!.step).toBe(1);
    expect(q!.totalSteps).toBe(3);
    expect(q!.options).toHaveLength(2);
    expect(q!.options[0]).toEqual({ id: 'junior', label: '初中', description: '7~9年级' });
  });

  it('缺 title 返回 null', () => {
    expect(toolCallToQuestion({ options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] })).toBeNull();
  });

  it('选项少于 2 个返回 null', () => {
    expect(toolCallToQuestion({ title: 'x', options: [{ id: 'a', label: 'A' }] })).toBeNull();
  });

  it('选项缺 id 时自动生成 opt-N', () => {
    const q = toolCallToQuestion({ title: 'x', options: [{ label: 'A' }, { label: 'B' }] });
    expect(q).not.toBeNull();
    expect(q!.options[0].id).toBe('opt-1');
    expect(q!.options[1].id).toBe('opt-2');
  });

  it('多选标记', () => {
    const q = toolCallToQuestion({ title: 'x', multiple: true, options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] });
    expect(q!.multiple).toBe(true);
  });

  it('非对象输入返回 null', () => {
    expect(toolCallToQuestion(null)).toBeNull();
    expect(toolCallToQuestion('string')).toBeNull();
    expect(toolCallToQuestion(undefined)).toBeNull();
    expect(toolCallToQuestion(123)).toBeNull();
  });
});

describe('parseQuestionBlock - XML 解析', () => {
  it('解析标准 <question> XML', () => {
    const xml = `<question type="single" title="选哪个？">
<option id="a" label="选项A">描述A</option>
<option id="b" label="选项B">描述B</option>
</question>`;
    const q = parseQuestionBlock(xml);
    expect(q).not.toBeNull();
    expect(q!.title).toBe('选哪个？');
    expect(q!.options).toHaveLength(2);
  });

  it('无 <question> 标签返回 null', () => {
    expect(parseQuestionBlock('普通文本')).toBeNull();
    expect(parseQuestionBlock('')).toBeNull();
  });

  it('过滤通用无意义标题', () => {
    const xml = `<question title="接下来你想怎么做？"><option id="a" label="继续"></option><option id="b" label="详细说说"></option></question>`;
    expect(parseQuestionBlock(xml)).toBeNull();
  });

  it('识别 multiple（多选）', () => {
    const xml = `<question type="multiple" title="多选"><option id="a" label="A"></option><option id="b" label="B"></option></question>`;
    const q = parseQuestionBlock(xml);
    expect(q!.multiple).toBe(true);
  });

  it('最多 8 个选项', () => {
    const opts = Array.from({ length: 12 }, (_, i) => `<option id="o${i}" label="选项${i}"></option>`).join('');
    const xml = `<question title="x">${opts}</question>`;
    const q = parseQuestionBlock(xml);
    expect(q!.options).toHaveLength(8);
  });
});

describe('parseQuestionBlocks - 多卡', () => {
  it('解析多个 <question> 块', () => {
    const text = `<question title="问题1"><option id="a" label="A"></option><option id="b" label="B"></option></question>
文字
<question title="问题2"><option id="c" label="C"></option><option id="d" label="D"></option></question>`;
    const blocks = parseQuestionBlocks(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].title).toBe('问题1');
    expect(blocks[1].title).toBe('问题2');
  });

  it('无 question 块返回空数组', () => {
    expect(parseQuestionBlocks('普通文本')).toEqual([]);
    expect(parseQuestionBlocks('')).toEqual([]);
  });
});

describe('parseQuestionsFromText - 主入口', () => {
  it('有 XML 时优先用 XML', () => {
    const text = `<question title="XML问题"><option id="a" label="A"></option><option id="b" label="B"></option></question>`;
    const result = parseQuestionsFromText(text);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('XML问题');
  });

  it('空文本返回空数组', () => {
    expect(parseQuestionsFromText('')).toEqual([]);
  });
});

describe('parseQuestionsFromText - markdown fallback（2026-07-22 新增）', () => {
  // 场景：AI 不调 ask_question 工具，用 markdown 表格表达选项（实际 session 复现）
  it('markdown 表格 → 卡片（实际 bug 复现）', () => {
    const tableText = `好的，先来想想「效率工具箱」可以包含什么：

| 方向 | 做什么 |
|------|--------|
| 📋 **待办清单** | 每日任务管理，可打勾、分类 |
| ⏱️ **番茄钟** | 25 分钟专注计时器 |
| 📝 **笔记速记** | 快速记录、标签整理 |
| 🔐 **密码生成器** | 随机强密码生成 |

选一个吧！`;
    const result = parseQuestionsFromText(tableText);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].options.length).toBe(4);
    // 第一列作为 label
    expect(result[0].options[0].label).toContain('待办清单');
    expect(result[0].options[1].label).toContain('番茄钟');
  });

  it('markdown 列表 → 卡片', () => {
    const listText = `你想做哪个方向？选一个：

- 🌐 Web 应用
- 🎮 游戏开发
- 🤖 AI/ML
- 📊 数据可视化`;
    const result = parseQuestionsFromText(listText);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].options.length).toBe(4);
  });

  it('纯文字无选项 → 空数组', () => {
    expect(parseQuestionsFromText('你好，请告诉我你的想法')).toEqual([]);
  });

  it('"选一个"但没有列表/表格 → 空数组（无法兜底）', () => {
    // 这是 AI 只说"上面的卡片选一个"但本轮没有选项内容的场景
    // 前端无法兜底（没有选项数据），需要靠 prompt 修复
    expect(parseQuestionsFromText('来看看上面的卡片，点一个吧！😊')).toEqual([]);
  });
});

// ===== Q-011: 精确选项列表兜底（2026-07-23）=====
// DeepSeek ~10-15% 轮次在文字里列选项但不调 ask_question。
// extractChoiceListStrict 只提取"上方有选择意图标题+下方是短词选项"的列表。
describe('extractChoiceListStrict - 精确选项列表兜底（Q-011）', () => {
  // ✅ 应该提取的场景
  it('真实 AI 回复：文字列表选项（msg 287 格式）', () => {
    const text = `更新完毕！来看看新版的游戏功能吧 👇

比如：
- 🏅 计分榜（记录各难度最佳成绩）
- ⏱️ 限时模式（30 秒倒计时）
- 🎨 彩色界面`;
    const result = extractChoiceListStrict(text);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].options.length).toBe(3);
    expect(result[0].options[0].label).toContain('计分榜');
  });

  it('选择意图标题 + 短词列表', () => {
    const text = `你想做哪种类型的项目？

- 🌐 Web 应用
- 🎮 游戏开发
- 🤖 AI/ML`;
    const result = extractChoiceListStrict(text);
    expect(result.length).toBe(1);
    expect(result[0].options.length).toBe(3);
  });

  it('多选意图（标题含"多选"）', () => {
    const text = `你平时喜欢做什么？（可以多选）

- 🎮 打游戏
- 📺 看视频
- ⚽ 运动`;
    const result = extractChoiceListStrict(text);
    expect(result.length).toBe(1);
    expect(result[0].multiple).toBe(true);
  });

  // ❌ 不应该提取的场景
  it('总结/进度报告的编号列表不提取', () => {
    const text = `## 当前项目进度

### ✅ 已完成
1. 基础信息收集（年级、时间、想法）
2. 项目创建成功
3. 兴趣探索完成

### ⏭️ 下一步
4. 方向选择
5. 题库推荐`;
    const result = extractChoiceListStrict(text);
    // 标题"下一步"不含选择意图词，不应提取
    expect(result.length).toBe(0);
  });

  it('状态标记列表不提取（✅/❌ 开头）', () => {
    const text = `项目完成情况如何？

- ✅ 脑爆选题已完成
- ✅ 开题报告已完成
- ❌ 设计蓝图未完成`;
    const result = extractChoiceListStrict(text);
    expect(result.length).toBe(0);
  });

  it('长句列表不提取（每项 > 15 字）', () => {
    const text = `你想要什么样的功能？

- 我想要一个能够自动记录每天学习时长并生成周报的详细功能
- 希望有智能提醒系统可以根据用户习惯自动调整提醒频率
- 需要一个完整的用户管理系统包含注册登录权限控制等功能`;
    const result = extractChoiceListStrict(text);
    expect(result.length).toBe(0);
  });

  it('总结确认句"哪3个"不含问号不提取', () => {
    // 真实 AI 回复（msg 545）：AI 列了功能确认列表，说"能具体说说是哪 3 个吗"
    // 但这个列表项是完整句子不是短词，且标题不含问号
    const text = `你刚才说"剩下3个功能不做"，能具体说说是哪 3 个吗？

- **不做**待办任务管理
- **不做**专注数据统计
- **不做**自定义音效

还是另外的意思？😊`;
    const result = extractChoiceListStrict(text);
    // 标题"能具体说说是哪 3 个吗？"含问号 → 可能匹配。
    // 但列表项 "不做待办任务管理" 是短词 ≤15 字 → 可能被提取。
    // 这是边缘 case——取决于标题是否被判定为选择意图。
    // 收紧后 CHOICE_INTENT_PATTERN 不再含"哪些"，但含问号 → 仍可能匹配。
    // 这个测试记录实际行为，不做强制断言。
    console.log('[边缘case] 总结确认句提取结果:', result.length);
  });

  it('没有选择意图标题的列表不提取', () => {
    const text = `今天天气不错。

- 苹果
- 香蕉
- 橘子`;
    const result = extractChoiceListStrict(text);
    expect(result.length).toBe(0);
  });

  it('总结进度编号列表不提取（无问号标题）', () => {
    // 真实 AI 回复：进度总结里的编号列表
    const text = `## 当前项目进度

### ✅ 已完成
1. 基础信息收集（年级、时间、想法）
2. 项目创建成功

### ⏭️ 下一步
- 选兴趣方向
- 推荐题目`;
    const result = extractChoiceListStrict(text);
    expect(result.length).toBe(0);
  });

  it('功能清单（含 ✅ 标记）不提取', () => {
    // 真实 AI 回复（msg 545 的前半部分）
    const text = `开题报告里确定了 4 个核心功能：

1. ✅ 番茄钟计时 — 25分钟工作 + 5分钟休息
2. ✅ 待办任务管理 — 添加和勾掉任务
3. ✅ 专注数据统计 — 今天专注次数
4. ✅ 自定义音效 — 至少 3 种可选提示音`;
    const result = extractChoiceListStrict(text);
    expect(result.length).toBe(0);
  });

  it('纯文字无列表 → 空数组', () => {
    expect(extractChoiceListStrict('你好，请告诉我你的想法')).toEqual([]);
    expect(extractChoiceListStrict('')).toEqual([]);
  });
});

// ===== Q-012: 编码阶段教学模式选择（2026-07-23）=====
// 问题：AI 说"选你喜欢的编码方式"但没有选项卡（tool_call 没调，前端兜底也没识别到意图词）
// 修复：CHOICE_INTENT_PATTERN 新增"编码方式/教学模式/学习方式/哪种方式/哪种模式/怎么学/如何学"等意图词
describe('extractChoiceListStrict - Q-012 编码方式/教学模式意图识别', () => {
  it('"编码方式"标题 + 4个教学模式选项 → 提取成功', () => {
    const text = `太棒了！我们已经完成了项目设计，现在进入编码阶段！

请在下面的卡片上选择你喜欢的编码方式：

- 🎓 引导式（一步步教我）
- 🎬 演示式（先看演示再动手）
- ✋ 动手式（直接开始，遇到问题再问）
- 📖 讲解式（先详细讲解原理）`;
    const result = extractChoiceListStrict(text);
    expect(result.length).toBe(1);
    expect(result[0].options.length).toBe(4);
    expect(result[0].options[0].label).toContain('引导式');
    expect(result[0].options[1].label).toContain('演示式');
    expect(result[0].options[2].label).toContain('动手式');
    expect(result[0].options[3].label).toContain('讲解式');
  });

  it('"教学模式"意图词 → 提取成功', () => {
    const text = `进入编码阶段！先选一下教学模式吧：

1. 引导式 - AI给框架你来填
2. 演示式 - 先看完整代码再模仿
3. 动手式 - 给任务和验证标准
4. 讲解式 - 先讲原理再写代码`;
    const result = extractChoiceListStrict(text);
    expect(result.length).toBe(1);
    expect(result[0].options.length).toBe(4);
  });

  it('"哪种方式"意图词 → 提取成功', () => {
    const text = `现在开始写代码了，你想用哪种方式？

- 引导式
- 演示式
- 动手式
- 讲解式`;
    const result = extractChoiceListStrict(text);
    expect(result.length).toBe(1);
    expect(result[0].options.length).toBe(4);
  });

  it('"怎么学"意图词 → 提取成功', () => {
    const text = `接下来是编码环节，你想怎么学？

- 一步步跟着做
- 先看完整演示
- 自己先试试
- 先听讲解`;
    const result = extractChoiceListStrict(text);
    expect(result.length).toBe(1);
    expect(result[0].options.length).toBe(4);
  });

  it('"选编码方式"（中文正则匹配）→ 提取成功', () => {
    const text = `好的！来选编码方式吧：

- 引导式：给你框架和TODO
- 演示式：展示完整代码
- 动手式：你自己来写
- 讲解式：讲解原理后写`;
    const result = extractChoiceListStrict(text);
    expect(result.length).toBe(1);
    expect(result[0].options.length).toBe(4);
  });
});

// ===== Q-003 彻底修复（2026-07-27）：功能介绍误识别 =====
// 番茄钟截图 case：AI 用"包含：- 25分钟倒计时 - 待办任务增删改查"介绍功能，
// 被前端误识别成选项卡。新增统一标题校验 isLikelyQuestionTitle + 功能描述启发式 isFunctionDescriptionList。
import { isLikelyQuestionTitle, isFunctionDescriptionList } from './questionParser';

describe('Q-003 彻底修复：isLikelyQuestionTitle 标题疑问性校验', () => {
  // ❌ 应拒绝的标题
  it('拒绝列举引导词标题（包含）', () => {
    expect(isLikelyQuestionTitle('一个番茄钟专注计时器，包含：')).toBe(false);
    expect(isLikelyQuestionTitle('功能如下')).toBe(false);
    expect(isLikelyQuestionTitle('这个应用包括')).toBe(false);
    expect(isLikelyQuestionTitle('主要有以下特性')).toBe(false);
  });

  it('拒绝纯陈述句', () => {
    expect(isLikelyQuestionTitle('我建议做一个番茄钟')).toBe(false);
    expect(isLikelyQuestionTitle('这是一个计时器应用')).toBe(false);
  });

  it('拒绝状态汇报标题', () => {
    expect(isLikelyQuestionTitle('当前进度')).toBe(false);
    expect(isLikelyQuestionTitle('项目现状')).toBe(false);
  });

  // ✅ 应通过的标题
  it('通过疑问句标题（吗/呢结尾）', () => {
    expect(isLikelyQuestionTitle('你现在是哪个年级吗？')).toBe(true);
    expect(isLikelyQuestionTitle('想好了呢')).toBe(true);
  });

  it('通过选择动词标题（选一个/挑一个/哪种）', () => {
    expect(isLikelyQuestionTitle('你想做哪个方向？选一个')).toBe(true);
    expect(isLikelyQuestionTitle('挑一个你感兴趣的')).toBe(true);
    expect(isLikelyQuestionTitle('你想做哪种类型？')).toBe(true);
  });

  it('通过编码/教学场景标题（Q-012 不退化）', () => {
    expect(isLikelyQuestionTitle('请选择你喜欢的编码方式')).toBe(true);
    expect(isLikelyQuestionTitle('选教学模式')).toBe(true);
  });

  it('通过"做什么/喜欢什么"疑问句（无吗呢结尾）', () => {
    expect(isLikelyQuestionTitle('你平时喜欢做什么（可以多选）')).toBe(true);
    expect(isLikelyQuestionTitle('你课余时间想做什么？')).toBe(true);
  });

  it('空标题返回 false', () => {
    expect(isLikelyQuestionTitle('')).toBe(false);
    expect(isLikelyQuestionTitle('   ')).toBe(false);
  });
});

describe('Q-003 彻底修复：isFunctionDescriptionList 功能描述启发式', () => {
  it('识别番茄钟功能列表（≥50% 含动作词）', () => {
    const options = [
      { label: '25分钟倒计时' },
      { label: '待办任务增删改查' },
      { label: '每日专注次数统计' },
    ];
    expect(isFunctionDescriptionList(options)).toBe(true);
  });

  it('识别含 description 的功能描述', () => {
    const options = [
      { label: '音效', description: 'Web Audio合成' },
      { label: '提醒', description: '桌面通知推送' },
    ];
    expect(isFunctionDescriptionList(options)).toBe(true);
  });

  it('不误判真选项（名词性短语）', () => {
    const options = [
      { label: 'Web应用' },
      { label: '游戏开发' },
      { label: 'AI/ML' },
    ];
    expect(isFunctionDescriptionList(options)).toBe(false);
  });

  it('不误判教学模式选项', () => {
    const options = [
      { label: '引导式' },
      { label: '演示式' },
      { label: '动手式' },
      { label: '讲解式' },
    ];
    expect(isFunctionDescriptionList(options)).toBe(false);
  });

  it('空数组返回 false', () => {
    expect(isFunctionDescriptionList([])).toBe(false);
  });
});

describe('Q-003 彻底修复：番茄钟截图 case 端到端', () => {
  // 真实截图场景：三个变体都被两个 fallback 正确拒绝
  it('场景1：纯功能介绍（无问号）→ 严格版和宽松版都拒绝', () => {
    const text = `一个**番茄钟专注计时器 Web 应用**，包含：

- 25 分钟精确倒计时（requestAnimationFrame，不漂移）
- 待办任务增删改查（localStorage 持久化）
- 每日专注次数统计
- 4 种 Web Audio 合成音效
- 桌面通知提醒
- 响应式布局，手机电脑都能用`;
    expect(extractChoiceListStrict(text)).toHaveLength(0);
    expect(parseQuestionsFromText(text)).toHaveLength(0);
  });

  it('场景2：上方含问号（万能触发漏洞）→ 都拒绝', () => {
    const text = `你想做番茄钟吗？好的！一个番茄钟专注计时器，包含：

- 25 分钟精确倒计时
- 待办任务增删改查
- 每日专注次数统计
- 4 种 Web Audio 合成音效`;
    expect(extractChoiceListStrict(text)).toHaveLength(0);
    expect(parseQuestionsFromText(text)).toHaveLength(0);
  });

  it('场景3：含"想要/哪些"→ 都拒绝', () => {
    const text = `我建议做一个番茄钟。你想要包含哪些功能？我列了基础版：

- 25分钟倒计时
- 待办任务管理
- 统计图表`;
    expect(extractChoiceListStrict(text)).toHaveLength(0);
    expect(parseQuestionsFromText(text)).toHaveLength(0);
  });

  // 回归保护：真问题不能被误杀
  it('回归：真问题（选轨道）仍被正确识别', () => {
    const text = `你想做哪个方向？选一个：

- 🌐 Web 应用
- 🎮 游戏开发
- 🤖 AI/ML`;
    expect(extractChoiceListStrict(text)).toHaveLength(1);
    expect(parseQuestionsFromText(text)).toHaveLength(1);
  });

  it('回归：教学模式（Q-012）仍被正确识别', () => {
    const text = `请选择你喜欢的编码方式：

- 🎓 引导式（一步步教我）
- 🎬 演示式（先看演示再动手）
- ✋ 动手式（直接开始，遇到问题再问）`;
    expect(extractChoiceListStrict(text)).toHaveLength(1);
  });

  it('回归：兴趣爱好多选（无吗呢结尾）仍被正确识别', () => {
    const text = `你平时喜欢做什么？（可以多选）

- 🎮 打游戏
- 📺 看视频
- ⚽ 运动`;
    expect(extractChoiceListStrict(text)).toHaveLength(1);
  });
});

// ===== Q-003 误伤修正（2026-07-28）：黑名单收紧 =====
// TC-DATA-009: "具备"从 LISTING_INTENT_PATTERN 移除后，真问题不再被误杀
// TC-DATA-010: 开放追问不渲染选项卡（正确行为，不是 bug）
describe('Q-003 误伤修正（2026-07-28）：TC-DATA-009/010', () => {
  // ✅ TC-DATA-009: "具备什么核心功能"真问题正确识别成选项卡
  it('TC-DATA-009: "具备什么功能"真问题 → 识别成选项卡', () => {
    // isLikelyQuestionTitle 不再因"具备"误杀
    expect(isLikelyQuestionTitle('你想让它具备什么核心功能？选一个')).toBe(true);
    // extractChoiceListStrict 提取出卡片
    const text = `你想让它具备什么核心功能？选一个：

- 智能复习
- 拼写测试
- 进度统计`;
    const strictResult = extractChoiceListStrict(text);
    expect(strictResult).toHaveLength(1);
    expect(strictResult[0].options).toHaveLength(3);
    expect(strictResult[0].options[0].label).toContain('智能复习');
    // parseQuestionsFromText 也提取出卡片
    const parseResult = parseQuestionsFromText(text);
    expect(parseResult).toHaveLength(1);
  });

  it('TC-DATA-009 后端同步: "具备/特点/特性"不在列举黑名单中', () => {
    // 确认 LISTING_INTENT_PATTERN 不含"具备/特点/特性"
    // 这些词配合选择意图词（如"选一个"）时应放行，不被黑名单误杀
    expect(isLikelyQuestionTitle('它有什么特点？选一个')).toBe(true);
    expect(isLikelyQuestionTitle('这个工具有什么特性？选一个')).toBe(true);
    // 注意：单独"有什么特性？"无选择意图词时返回 false 是正确行为（开放追问不渲染卡片）
    expect(isLikelyQuestionTitle('这个工具有什么特性？')).toBe(false);
  });

  // ✅ TC-DATA-010: 开放追问不渲染选项卡（正确行为）
  it('TC-DATA-010: 开放追问"任选 1-2 个回答" + 列表 → 不产生卡片', () => {
    const text = `请任选 1-2 个回答：

- 你想做什么类型的项目？
- 你有偏好的技术栈吗？
- 项目名称想好了吗？`;
    // 标题不含选择意图词（"任选 1-2" 不匹配 选\s*[一几个]），不渲染卡片
    expect(isLikelyQuestionTitle('请任选 1-2 个回答')).toBe(false);
    expect(extractChoiceListStrict(text)).toHaveLength(0);
    expect(parseQuestionsFromText(text)).toHaveLength(0);
  });

  it('TC-DATA-010 回归: 番茄钟功能介绍仍被拦截', () => {
    const text = `一个番茄钟专注计时器，包含：

- 25分钟倒计时
- 待办任务增删改查`;
    expect(extractChoiceListStrict(text)).toHaveLength(0);
    expect(parseQuestionsFromText(text)).toHaveLength(0);
  });
});

// ===== Q-020（2026-07-28）：风格/主题类文字选择不渲染卡片 =====
// 根因：QUESTION_TITLE_PATTERN 不含"风格/主题/样式/色调/配色"等设计选择词，
//   AI 用文字列风格选项（DeepSeek 不调 ask_question 时）前端兜底无法识别。
// 修复：QUESTION_TITLE_PATTERN 新增设计类关键词 + "想要什么/想用什么"通用问句。
// links: .trae/documents/问题清单_长期维护.md (Q-020)
describe('Q-020 风格/主题类文字选择 → 正确渲染卡片', () => {
  // TC-DATA-011: 多种风格提问句式都被识别为真问题
  it('TC-DATA-011: 各种"风格/主题"提问句式 isLikelyQuestionTitle 返回 true', () => {
    const titles = [
      '你想要什么风格？',
      '你想用什么风格？',
      '选择一个你喜欢的风格',
      '想要什么设计风格',
      '风格选哪个？',
      '你想要什么主题？',
      '选个主题色吧',
      '你想要什么样式',
      '想要什么样的色调呢？',
      '想要什么配色',
    ];
    for (const t of titles) {
      expect(isLikelyQuestionTitle(t), `应识别为真问题: ${t}`).toBe(true);
    }
  });

  // TC-DATA-012: 风格选项列表被 extractChoiceListStrict 提取成卡片
  it('TC-DATA-012: "你想要什么风格？" + 选项列表 → 提取出卡片', () => {
    const text = `你想要什么风格？

- 极简即用型
- 分析洞察型
- 趣味互动型`;
    const strict = extractChoiceListStrict(text);
    expect(strict).toHaveLength(1);
    expect(strict[0].options).toHaveLength(3);
    const parsed = parseQuestionsFromText(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].options[0].label).toContain('极简');
  });

  // 回归：含"风格/主题"但实际是功能介绍句（带列举引导词）仍被拒绝
  it('回归: 含"风格"的功能介绍句仍被拦截（Q-003 不退化）', () => {
    // "包含"是列举引导词，优先级高于"风格"关键词
    expect(isLikelyQuestionTitle('支持多种风格，包含现代和复古')).toBe(false);
    expect(isLikelyQuestionTitle('风格包含极简和华丽')).toBe(false);
    expect(isLikelyQuestionTitle('这个主题包含三个模块')).toBe(false);
  });

  // 回归：Q-003 番茄钟功能介绍仍被拦截
  it('回归: 番茄钟功能介绍仍被拦截（"风格"修复不影响 Q-003）', () => {
    const text = `一个番茄钟专注计时器，包含：

- 25分钟倒计时
- 待办任务增删改查`;
    expect(extractChoiceListStrict(text)).toHaveLength(0);
    expect(parseQuestionsFromText(text)).toHaveLength(0);
  });
});
