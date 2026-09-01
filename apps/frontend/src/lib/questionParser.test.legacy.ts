/**
 * questionParser 自动化测试
 *
 * 覆盖需求："要有 option 按钮，而且可以多个问题、多个卡片、一个卡片上有多个 option、
 * option 存在单选或多选的情况"
 *
 * 运行：见同目录 questionParser.run.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseQuestionBlock,
  parseQuestionBlocks,
  parseQuestionsFromText,
  extractQuestionsFromMarkdown,
  toolCallToQuestion,
} from './questionParser';

// ============ 场景 1：单张 XML 卡片（基础）============
test('场景1: 单张 XML 卡片 - 应解析出 1 张卡 + 多个 option', () => {
  const text = `欢迎来到未来科技学院！

<question type="single" title="你现在是哪个年级？" step="1" total_steps="3">
  <option id="junior" label="初中（7-9 年级）">适合刚接触编程的同学</option>
  <option id="senior" label="高中（10-12 年级）">有一定基础的同学</option>
</question>`;

  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 1, '应解析出 1 张卡片');
  assert.equal(result[0].title, '你现在是哪个年级？');
  assert.equal(result[0].options.length, 2, '应有 2 个选项');
  assert.equal(result[0].options[0].label, '初中（7-9 年级）');
  assert.equal(result[0].options[1].label, '高中（10-12 年级）');
  assert.equal(result[0].multiple, false, 'type="single" 应为单选');
  assert.equal(result[0].step, 1);
  assert.equal(result[0].totalSteps, 3);
});

// ============ 场景 2：多张 XML 卡片（多个问题、多个卡片）============
test('场景2: 多张 XML 卡片 - 一条回复里有多个问题，应解析出多张卡', () => {
  const text = `我们需要确认几个信息：

<question type="single" title="项目的一句话描述是什么？">
  <option id="opt1" label="待办清单">一个简单的任务管理工具</option>
  <option id="opt2" label="计算器">能做四则运算</option>
</question>

<question type="single" title="这个项目要解决什么问题？">
  <option id="opt1" label="学习编程">为了掌握基础语法</option>
  <option id="opt2" label="完成作业">学校的研学任务</option>
</question>

<question type="multi" title="目标用户是谁？（可多选）">
  <option id="opt1" label="自己用">个人工具</option>
  <option id="opt2" label="给同学">同学之间分享</option>
  <option id="opt3" label="给老师">教学演示</option>
</question>`;

  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 3, '应解析出 3 张卡片（多卡支持）');
  assert.equal(result[0].title, '项目的一句话描述是什么？');
  assert.equal(result[1].title, '这个项目要解决什么问题？');
  assert.equal(result[2].title, '目标用户是谁？（可多选）');
  assert.equal(result[2].multiple, true, '第 3 张应是多选');
  assert.equal(result[2].options.length, 3, '第 3 张应有 3 个选项');
});

// ============ 场景 3：一张卡片多个 option（6 个）============
test('场景3: 一张卡片 6 个 option', () => {
  const text = `<question type="single" title="你平时最喜欢做什么？（可多选）">
  <option id="opt1" label="🎮 打游戏">喜欢电子游戏</option>
  <option id="opt2" label="📺 看视频">看视频/动漫</option>
  <option id="opt3" label="⚽ 运动">各种体育运动</option>
  <option id="opt4" label="✂️ 手工">DIY/手工制作</option>
  <option id="opt5" label="📖 阅读">看书/漫画</option>
  <option id="opt6" label="🎵 音乐">听歌/演奏</option>
</question>`;

  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 1);
  assert.equal(result[0].options.length, 6, '应有 6 个选项');
  assert.ok(result[0].options[0].label.includes('打游戏'));
});

// ============ 场景 4：单选 type="single" ============
test('场景4: 单选 type="single"', () => {
  const text = `<question type="single" title="选一个"><option id="a" label="A">x</option><option id="b" label="B">y</option></question>`;
  const result = parseQuestionsFromText(text);
  assert.equal(result[0].multiple, false);
});

// ============ 场景 5：多选 type="multiple" / "multi" ============
test('场景5a: 多选 type="multiple"', () => {
  const text = `<question type="multiple" title="选多个"><option id="a" label="A">x</option><option id="b" label="B">y</option></question>`;
  const result = parseQuestionsFromText(text);
  assert.equal(result[0].multiple, true);
});

test('场景5b: 多选 type="multi"', () => {
  const text = `<question type="multi" title="选多个"><option id="a" label="A">x</option><option id="b" label="B">y</option></question>`;
  const result = parseQuestionsFromText(text);
  assert.equal(result[0].multiple, true);
});

test('场景5c: 多选关键词"多选"', () => {
  const text = `<question title="选多个（多选）"><option id="a" label="A">x</option><option id="b" label="B">y</option></question>`;
  const result = parseQuestionsFromText(text);
  assert.equal(result[0].multiple, true);
});

// ============ 场景 6：XML 格式变体（鲁棒性）============
test('场景6a: <option> 无 id 属性也能解析', () => {
  const text = `<question type="single" title="选一个">
  <option label="选项A">描述A</option>
  <option label="选项B">描述B</option>
</question>`;
  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 1);
  assert.equal(result[0].options.length, 2);
  assert.equal(result[0].options[0].label, '选项A');
  // 无 id 时应自动生成
  assert.ok(result[0].options[0].id);
});

test('场景6b: label 在 id 之前', () => {
  const text = `<question type="single" title="选一个">
  <option label="选项A" id="a">描述A</option>
  <option label="选项B" id="b">描述B</option>
</question>`;
  const result = parseQuestionsFromText(text);
  assert.equal(result[0].options[0].id, 'a');
  assert.equal(result[0].options[0].label, '选项A');
});

test('场景6c: label 用子标签 <label>xxx</label>', () => {
  const text = `<question type="single" title="选一个">
  <option id="a"><label>选项A</label><desc>描述A</desc></option>
  <option id="b"><label>选项B</label><desc>描述B</desc></option>
</question>`;
  const result = parseQuestionsFromText(text);
  assert.equal(result[0].options[0].label, '选项A');
  assert.equal(result[0].options[0].description, '描述A');
});

test('场景6d: title 用子标签 <title>xxx</title>', () => {
  const text = `<question type="single">
  <title>这是标题</title>
  <option id="a" label="选项A">x</option>
</question>`;
  const result = parseQuestionsFromText(text);
  assert.equal(result[0].title, '这是标题');
});

// ============ 场景 7：markdown fallback（AI 没用 XML）============
test('场景7a: markdown 项目符号列表应解析成卡片', () => {
  const text = `你现在是哪个年级？

- 初中（7-9 年级）
- 高中（10-12 年级）`;

  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 1, '应解析出 1 张卡片');
  assert.equal(result[0].title, '你现在是哪个年级？');
  assert.equal(result[0].options.length, 2);
  assert.equal(result[0].options[0].label, '初中（7-9 年级）');
});

test('场景7b: markdown 编号列表应解析成卡片', () => {
  const text = `选一个方向：

1. 网页开发
2. 游戏开发
3. 数据分析`;

  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 1);
  assert.equal(result[0].options.length, 3);
  assert.equal(result[0].options[0].label, '网页开发');
});

test('场景7c: markdown label：description 格式', () => {
  const text = `选一个：

- 初中：适合刚接触编程的同学
- 高中：有一定基础的同学`;

  const result = parseQuestionsFromText(text);
  assert.equal(result[0].options[0].label, '初中');
  assert.equal(result[0].options[0].description, '适合刚接触编程的同学');
});

// ============ 场景 8：排除状态汇报（之前 bug）============
test('场景8a: 状态汇报列表不应被解析成卡片', () => {
  const text = `当前情况很清楚了：
- 当前阶段：stage_01_brainstorm
- 教学模式：guided
- brainstorm 文档：已创建但是空白

让我开始引导你。`;

  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 0, '状态汇报不应解析成卡片');
});

test('场景8b: 状态汇报后跟真选项，只应解析真选项', () => {
  const text = `当前情况很清楚了：
- 当前阶段：stage_01_brainstorm
- 教学模式：guided

---

第一步：确定项目方向

- 网页开发
- 游戏开发
- 数据分析`;

  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 1, '只应解析出真选项那 1 张卡');
  assert.equal(result[0].title, '第一步：确定项目方向');
  assert.equal(result[0].options.length, 3);
});

// ============ 场景 9：排除对话式多问（之前 bug）============
test('场景9: 对话式多问（编号问句+子列表）不应被解析成卡片', () => {
  const text = `先了解一下你的情况：

1. 你目前什么阶段？
   - 初中生 / 高中生 / 大学生 / 其他？
2. 你对什么领域感兴趣？
   - 比如：编程、电子硬件、机器人、数据分析
3. 你大概有多少时间做这个项目？
   - 几天（快速原型）/ 几周（学期项目）`;

  const result = parseQuestionsFromText(text);
  // 对话式多问应被排除（编号问句 + 子列表展开），不渲染成卡片
  assert.equal(result.length, 0, '对话式多问不应解析成卡片');
});

// ============ 场景 10：markdown 多卡（多个独立选项块）============
test('场景10: markdown 多个独立选项块应解析成多张卡', () => {
  const text = `我们确认两个信息：

年级
- 初中
- 高中

时间预算
- 2 小时
- 6 小时
- 12 小时+`;

  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 2, '应解析出 2 张独立卡片');
  assert.equal(result[0].title, '年级');
  assert.equal(result[0].options.length, 2);
  assert.equal(result[1].title, '时间预算');
  assert.equal(result[1].options.length, 3);
});

// ============ 场景 11：空文本/无选项 ============
test('场景11a: 空文本返回空数组', () => {
  assert.equal(parseQuestionsFromText('').length, 0);
});

test('场景11b: 纯对话无列表返回空数组', () => {
  const text = `你好！欢迎来到未来科技学院。我来引导你完成一个 STEM 项目。请问你想做什么？`;
  assert.equal(parseQuestionsFromText(text).length, 0);
});

// ============ 场景 12：XML 主路径优先于 fallback ============
test('场景12: 有 XML 时优先用 XML，不走 fallback', () => {
  const text = `一些引导文字

<question type="single" title="XML 标题">
  <option id="a" label="XML 选项A">x</option>
</question>

- 这是一些 markdown 列表
- 不应被使用`;

  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'XML 标题');
});

// ============ 回归测试：模拟实际截图里的真实 AI 输出 ============

test('回归1: AI 用 <question> XML 问"年级"(单卡 2 选项,带 step)', () => {
  // 模拟 stem-pbl-guide skill 规范的 stage_00 第 1 轮输出
  const text = `欢迎来到未来科技学院！🎉

我先了解一下你的基本情况，这样才能帮你选到合适的题目。

<question type="single" title="你现在是哪个年级？" step="1" total_steps="3">
  <option id="junior" label="初中（7-9 年级）">适合刚接触编程的同学</option>
  <option id="senior" label="高中（10-12 年级）">有一定基础的同学</option>
</question>`;

  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, '你现在是哪个年级？');
  assert.equal(result[0].options.length, 2);
  assert.equal(result[0].multiple, false);
  assert.equal(result[0].step, 1);
  assert.equal(result[0].totalSteps, 3);
});

test('回归2: AI 一次输出 3 张 <question> 多卡(stage_02 一次问 3 个问题)', () => {
  // 模拟 stem-pbl-guide skill 的 stage_02_brief 多卡场景
  const text = `好的，我们继续完善项目立项。请回答下面 3 个问题：

<question type="single" title="项目的一句话描述是什么？">
  <option id="opt1" label="待办清单 App">一个简单的任务管理工具</option>
  <option id="opt2" label="计算器">能做四则运算的工具</option>
  <option id="opt3" label="天气查询">显示当前天气</option>
</question>

<question type="single" title="这个项目主要解决什么问题？">
  <option id="opt1" label="学习编程基础">掌握 HTML/JS</option>
  <option id="opt2" label="完成学校作业">研学任务需要</option>
</question>

<question type="multi" title="目标用户是谁？（可多选）">
  <option id="opt1" label="自己用">个人工具</option>
  <option id="opt2" label="给同学用">分享给同学</option>
  <option id="opt3" label="给老师演示">课堂展示</option>
</question>`;

  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 3, '应解析出 3 张多卡');
  // 第 1 张：3 选项，单选
  assert.equal(result[0].options.length, 3);
  assert.equal(result[0].multiple, false);
  // 第 2 张：2 选项，单选
  assert.equal(result[1].options.length, 2);
  assert.equal(result[1].multiple, false);
  // 第 3 张：3 选项，多选
  assert.equal(result[2].options.length, 3);
  assert.equal(result[2].multiple, true);
});

test('回归3: AI 用 markdown 列表(没用 XML)问单选 - 必须解析出卡片', () => {
  // LLM 不保证 100% 用 XML，经常用 markdown。这种情况必须有卡片(用户要求)
  const text = `好的，我们先确定你的年级。

- 初中生（7-9 年级）
- 高中生（10-12 年级）`;

  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 1, 'markdown 列表必须解析出卡片');
  assert.equal(result[0].title, '好的，我们先确定你的年级。');
  assert.equal(result[0].options.length, 2);
  assert.equal(result[0].options[0].label, '初中生（7-9 年级）');
});

test('回归4: 状态汇报(- 当前阶段：stage_01)后跟 markdown 选项 - 只解析选项', () => {
  // 模拟之前截图里的 bug：AI 开头汇报状态，后面才是真选项
  const text = `当前情况很清楚了：
- 当前阶段：stage_01_brainstorm
- 教学模式：guided
- brainstorm 文档：已创建但是空白

---

第一步：确定项目方向

- 网页开发（HTML/CSS/JS）
- 游戏开发（Canvas/Phaser）
- 数据分析（Python）`;

  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 1, '只应解析出真选项 1 张卡');
  assert.equal(result[0].title, '第一步：确定项目方向', '标题应是真选项的标题，不是状态汇报');
  assert.equal(result[0].options.length, 3);
  assert.ok(result[0].options[0].label.includes('网页开发'));
});

test('回归5: 多选场景 - type="multiple" 带 6 个 option', () => {
  const text = `<question type="multiple" title="你平时喜欢做什么？（可多选）" step="1" total_steps="3">
  <option id="game" label="🎮 打游戏">喜欢电子游戏</option>
  <option id="video" label="📺 看视频/动漫">看视频和动漫</option>
  <option id="sport" label="⚽ 运动">各种体育运动</option>
  <option id="diy" label="✂️ 手工/DIY">动手制作</option>
  <option id="read" label="📖 阅读">看书/漫画</option>
  <option id="music" label="🎵 音乐">听歌/演奏</option>
</question>`;

  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 1);
  assert.equal(result[0].options.length, 6, '6 个 option');
  assert.equal(result[0].multiple, true, '多选');
  assert.equal(result[0].options[0].label, '🎮 打游戏');
  assert.equal(result[0].options[0].description, '喜欢电子游戏');
});

test('回归6: 技术轨道 5 选 1(stage_04)', () => {
  const text = `<question type="single" title="你想用哪个技术轨道？">
  <option id="web" label="🌐 Web 应用">网站、工具、展示（难度 ⭐⭐）</option>
  <option id="game" label="🎮 游戏开发">2D 小游戏、互动故事（难度 ⭐⭐⭐）</option>
  <option id="ai" label="🤖 AI/ML">聊天机器人、数据分析（难度 ⭐⭐⭐）</option>
  <option id="viz" label="📊 数据可视化">仪表板、信息图（难度 ⭐⭐）</option>
  <option id="creative" label="🎨 创意编程">生成艺术、音乐可视化（难度 ⭐⭐）</option>
</question>`;

  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 1);
  assert.equal(result[0].options.length, 5, '5 个轨道');
  assert.equal(result[0].multiple, false, '单选');
  assert.ok(result[0].options[0].label.includes('Web'));
  assert.ok(result[0].options[0].description?.includes('难度'));
});

test('回归7: 教学模式 4 选 1(stage_07)', () => {
  const text = `<question type="single" title="你希望我怎么教你写代码？">
  <option id="guided" label="🧑‍🏫 引导式">提供框架让我填空（适合初学者）</option>
  <option id="demo" label="🎬 演示式">先演示完整代码再让我模仿</option>
  <option id="hands_on" label="🔧 动手式">让我先自己尝试，出错再指导</option>
  <option id="lecture" label="📚 讲解式">先讲原理再写代码</option>
</question>`;

  const result = parseQuestionsFromText(text);
  assert.equal(result[0].options.length, 4);
  assert.equal(result[0].options[0].label, '🧑‍🏫 引导式');
});

// ============ 回归8：真实截图场景（破折号分隔的长选项）============
test('回归8: 真实截图场景 - 破折号分隔的长选项必须解析出卡片', () => {
  // 这是 2026-07-19 实际截图里 AI 的输出，被 fallback 错误过滤掉了
  const text = `好，清楚了。已经确认过你的偏好，我来总结确认：

---

记账 App — 需求确认清单 ✔️

接下来是选题阶段的正事。我帮你确认选题方向：

你这个记账工具，想做成什么样？

1. 极简即用型 — 一打开就用，没有任何多余配置，类似一个漂亮的小本子
2. 分析洞察型 — 侧重图表报表，帮你搞清楚钱花哪了，带可视化分析
3. 习惯养成型 — 结合记账培养消费习惯，有打卡/目标反馈机制`;

  const result = parseQuestionsFromText(text);
  assert.equal(result.length, 1, '必须解析出 1 张卡片');
  assert.equal(result[0].title, '你这个记账工具，想做成什么样？');
  assert.equal(result[0].options.length, 3, '3 个选项');
  assert.equal(result[0].options[0].label, '极简即用型');
  assert.ok(result[0].options[0].description?.includes('一打开就用'));
});

// ============ 回归9：多种分隔符识别 label + description ============
test('回归9: 多种分隔符(冒号/破折号)都能识别 label + description', () => {
  // 冒号分隔（每个子场景至少 2 个选项，否则不形成卡片）
  let text = `选一个：\n- 初中：适合刚接触编程\n- 高中：有一定基础`;
  let r = parseQuestionsFromText(text);
  assert.equal(r[0].options[0].label, '初中');
  assert.equal(r[0].options[0].description, '适合刚接触编程');

  // 破折号分隔（中文长破折号 —）
  text = `选一个：\n- 极简型 — 一打开就用\n- 分析型 — 侧重图表`;
  r = parseQuestionsFromText(text);
  assert.equal(r[0].options[0].label, '极简型');
  assert.ok(r[0].options[0].description?.includes('一打开就用'));

  // 破折号分隔（英文 hyphen 带空格）
  text = `选一个：\n- Web 应用 - 做网站和工具\n- 游戏 - 做互动`;
  r = parseQuestionsFromText(text);
  assert.equal(r[0].options[0].label, 'Web 应用');
  assert.ok(r[0].options[0].description?.includes('做网站'));
});

// ============ 回归10：长 label 无分隔符 → 截断保留，不丢失 ============
test('回归10: 长 label 无分隔符时截断保留，不丢失选项', () => {
  // 整句很长但没有分隔符，不应被过滤掉，应截断 label 保留选项
  const text = `你想要什么风格？\n- 极简即用型一打开就用没有任何多余配置类似漂亮小本子\n- 分析洞察型侧重图表报表可视化`;
  const r = parseQuestionsFromText(text);
  assert.equal(r.length, 1, '应解析出卡片');
  assert.equal(r[0].options.length, 2, '2 个选项都应保留');
});

// ============ 工具调用路径：toolCallToQuestion ============
test('工具1: ask_question args 完整 → 正确转换', () => {
  const args = {
    title: '你现在是哪个年级？',
    multiple: false,
    step: 1,
    total_steps: 3,
    options: [
      { id: 'junior', label: '初中', description: '7-9 年级' },
      { id: 'senior', label: '高中', description: '10-12 年级' },
    ],
  };
  const q = toolCallToQuestion(args);
  assert.ok(q, '应返回 QuestionData');
  assert.equal(q!.title, '你现在是哪个年级？');
  assert.equal(q!.options.length, 2);
  assert.equal(q!.options[0].id, 'junior');
  assert.equal(q!.options[0].label, '初中');
  assert.equal(q!.options[0].description, '7-9 年级');
  assert.equal(q!.multiple, false);
  assert.equal(q!.step, 1);
  assert.equal(q!.totalSteps, 3);
});

test('工具2: 多选 multiple=true', () => {
  const args = {
    title: '你平时喜欢做什么？（可多选）',
    multiple: true,
    options: [
      { id: 'game', label: '🎮 打游戏' },
      { id: 'video', label: '📺 看视频' },
      { id: 'sport', label: '⚽ 运动' },
    ],
  };
  const q = toolCallToQuestion(args);
  assert.equal(q!.multiple, true);
  assert.equal(q!.options.length, 3);
});

test('工具3: option 缺 id → 自动生成', () => {
  const args = {
    title: '选一个',
    options: [
      { label: '选项A' },
      { label: '选项B' },
    ],
  };
  const q = toolCallToQuestion(args);
  assert.equal(q!.options[0].id, 'opt-1' === q!.options[0].id ? 'opt-1' : q!.options[0].id);
  assert.ok(q!.options[0].id, 'id 应非空');
  assert.ok(q!.options[1].id, 'id 应非空');
  assert.notEqual(q!.options[0].id, q!.options[1].id, '两个 id 应不同');
});

test('工具4: 缺 title → 返回 null', () => {
  assert.equal(toolCallToQuestion({ options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }), null);
});

test('工具5: options 少于 2 个 → 返回 null', () => {
  assert.equal(toolCallToQuestion({ title: 'x', options: [{ id: 'a', label: 'A' }] }), null);
});

test('工具6: 非 object 参数 → 返回 null', () => {
  assert.equal(toolCallToQuestion(null), null);
  assert.equal(toolCallToQuestion('string'), null);
  assert.equal(toolCallToQuestion(undefined), null);
});

test('工具7: option 缺 label → 用"选项N"兜底', () => {
  const args = {
    title: '选一个',
    options: [
      { id: 'a' },
      { id: 'b' },
    ],
  };
  const q = toolCallToQuestion(args);
  assert.equal(q!.options[0].label, '选项1');
  assert.equal(q!.options[1].label, '选项2');
});

console.log('所有测试场景已定义，运行中...');


