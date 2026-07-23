# fineSTEM AI 对话流设计规格

**版本**: v1.1.0  
**日期**: 2026-07-20  
**状态**: 实现中  
**作者**: AI Agent  
**对应主文档**: `04_fineSTEM_BS平台产品方案_V3.3.md`  
**技术基座**: `ZeroClaw_技术知识库_v1.0.0.md`  
**Skill 蓝本**: `.trae/skills/stem-pbl-guide/SKILL.md`  

---

## 版本变更记录

### v1.1.0 (2026-07-20)

**主要变更**:
1. **提问机制统一**: 从 XML `<question>` 格式全面转向 `ask_question` 工具调用
2. **选择消息格式标准化**: 定义 `[选择:选项ID]` 标准格式，前后端统一解析
3. **教学模式扩展**: 新增 `html_visual` 模式，支持可视化讲解
4. **阶段门禁强化**: 明确各阶段代码生成权限和推进条件
5. **截断检测机制**: 前端智能检测 AI 输出截断，自动触发续接

**修复问题**:
- AI 问答交互不稳定（强制工具调用替代文本解析）
- Option 选项模式不稳定（标准化选择消息格式）
- 教学模式缺失（补全 html_visual 模式）

---

## 1. 设计背景与问题

### 1.1 当前问题

fineSTEM 平台的 AI 对话流存在根本性断裂：

| 问题 | 现状 | 应有状态 |
|------|------|---------|
| AI 角色 | 通用聊天机器人 | 三角色智能切换（PBL导师/编程助手/平台引导） |
| 项目感知 | AI 不知道学生在哪个项目、哪个阶段 | AI 读取项目状态，感知阶段进度 |
| 流程驱动 | AI 被动回答，不主动推进 | AI 检测完成条件，自动推进阶段 |
| Skill 集成 | stem-pbl-guide Skill 已接入但提问机制混乱 | Skill 通过 ask_question 工具稳定驱动对话 |
| 代码能力 | 对话与代码编辑器割裂 | 对话中生成代码 → 写入编辑器 → 运行预览 |
| 文档产出 | 无文档生成能力 | 自动生成开题报告、技术报告、结题报告、论文 |
| 记忆 | 对话历史存前端，刷新即丢失 | 项目级记忆、用户画像、能力标签积累 |
| **提问机制** | **XML + 工具双轨制，解析不稳定** | **统一 ask_question 工具调用** |
| **选择消息** | **格式不统一，后端无法识别** | **标准化 [选择:选项ID] 格式** |

### 1.2 核心定位

**fineSTEM 不是豆包编程，不是 Codex。**

```text
豆包编程：用户 → 描述需求 → AI 生成代码 → 预览/编辑 → 分享
  本质：AI 代码生成器，目标是"更快地做出东西"

fineSTEM：学生 → 发现兴趣 → 选择项目 → 研学过程（AI引导）→ 成果展示
  本质：AI 研学导师，目标是"学会做项目的方法"
```

**一句话区分**：豆包编程让 AI 替用户做事，fineSTEM 让 AI 教学生做事。

**PBL 完整含义**：学生既要做出**可运行的成品**（app/网页/数据分析），又要产出**研学文档**（开题报告、技术报告、论文）。代码和论文不是二选一，而是**都要**。

---

## 2. AI 角色定义

### 2.1 三角色模型

AI 根据对话意图自然切换角色，不是硬切换：

| 角色 | 占比 | 触发条件 | 核心行为 |
|------|------|---------|---------|
| **PBL 研学导师** | 70% | 涉及项目流程/阶段推进/选题/文档 | 引导选题→开题→设计→编码→验收，推进阶段，生成文档 |
| **编程学习助手** | 20% | 编程/代码/技术问题 | 教学式回答，引导调试，推荐学习路径 |
| **平台引导者** | 10% | 平台操作/工具使用问题 | 解释功能，推荐资源，引导注册 |

### 2.2 意图识别规则（优先级从高到低）

1. 明确的平台/工具操作问题 → 平台引导者
2. 涉及项目流程/阶段推进 → PBL 研学导师
3. 编程/代码/技术问题 → 编程学习助手
4. 模糊意图 → 保持当前角色，对话中自然判断

### 2.3 教学化改造原则

所有"AI 直接完成"的功能都改造成"AI 引导学生完成"：

| 豆包编程做法 | fineSTEM 改造 |
|------------|--------------|
| AI 直接生成完整代码 | 按 teaching_mode 控制粒度：guided=框架+TODO，demo=完整+注释，hands_on=只有签名，lecture=原理+代码，html_visual=可视化讲解 |
| AI 直接修复错误 | 引导式调试：指出错误位置→提示方向→学生尝试→给反馈 |
| AI 直接设计界面 | 引导学生选择设计方向，AI 生成代码框架 |
| AI 直接部署项目 | 生成项目包，引导到 AI IDE 继续开发 |

---

## 3. 交互模型

### 3.1 双形态交互

AI 有两种存在形态，共享同一个 ZeroClaw Agent 后端和对话引擎：

**形态一：独立 AI 页面（"创造"菜单）**

```text
┌──────────────────────────────────────────────────────────────┐
│  场景选择 │            对话区（Skill 驱动）          │ 项目上下文 │
│  ──────── │                                          │ ────────── │
│  问问题    │  [PBL 阶段进度条]                         │ 当前项目    │
│  解释代码  │  对话内容...                              │ 阶段进度    │
│  开始项目  │  代码块 [复制] [运行▶] [写入编辑器]        │ 证据列表    │
│  写报告    │                                          │ [快捷入口]  │
│           │──────────────────────────────────────────│ 教学模式    │
│  ──────── │  输入框                                   │            │
│  📍当前项目│                                          │            │
│  新建项目  │                                          │            │
└──────────────────────────────────────────────────────────────┘
```

**形态二：嵌入式侧边栏（其他功能页面）**

```text
┌───────────────────────────────────────────┬─────────────────┐
│                                           │  fineSTEM AI    │
│         当前页面内容                        │  [对话区]       │
│         （Demo墙 / 项目页 / 编辑器 / ...）  │  感知当前页面    │
│                                           │  主动提供帮助    │
│                                           │  [收起] [新对话] │
└───────────────────────────────────────────┴─────────────────┘
```

**两种形态的关系**：
- 侧边栏是轻量辅助（1-3 轮快速问答）
- 复杂对话（写代码、做项目）自动引导到独立 AI 页面
- 共享对话历史和项目上下文

### 3.2 场景自动感知

| 当前页面 | AI 自动角色 | AI 主动提示 |
|---------|-----------|-----------|
| 首页 | 探索引导 | "想看看有什么有趣的 STEM 项目吗？" |
| Demo 墙 / Demo 详情 | Demo 解说员 | "想了解这个 Demo 是怎么做的吗？" |
| 项目页（轻项目） | PBL 轻项目导师 | "你现在在 Step X，接下来我们..." |
| 项目页（标准研学） | PBL 研学导师 | "当前阶段：XX，完成标准：..." |
| 代码编辑器 | 编程助手 | "代码有问题随时问我" |
| 成果档案卡 | 成果整理助手 | "帮你总结一下这个项目的亮点" |

### 3.3 代码编辑器集成

"创造"页面支持对话区与代码编辑器的联动：

```text
交互流程：
1. AI 在对话中生成代码片段
2. 学生点击"写入编辑器" → 代码出现在 Monaco Editor
3. 学生点击"运行" → WebContainer(JS) / Pyodide(Python) 执行
4. 右侧显示预览/运行结果
5. 运行出错 → AI 引导调试（不是直接修复）
6. 运行成功 → AI 自动保存为证据，建议下一步
7. 阶段完成 → AI 生成文档（技术报告、开发日志等）
```

---

## 4. 提问机制规范（v1.1.0 核心变更）

### 4.1 ask_question 工具（强制使用）

**从 v1.1.0 开始，所有提问必须使用 `ask_question` 工具**，禁止在回复文本中直接输出选项列表或 XML。

#### 工具参数定义

```json
{
  "title": "问题标题，显示在卡片顶部",
  "subtitle": "副标题（可选）",
  "multiple": false,
  "step": 1,
  "total_steps": 3,
  "options": [
    {
      "id": "选项唯一标识",
      "label": "选项显示文本",
      "description": "选项描述（可选）",
      "recommended": true
    }
  ]
}
```

#### 使用规则

1. **每次 2-6 个选项**，可标注 "recommended": true
2. **多选设置** `"multiple": true`
3. **进度显示** 用 `step` 和 `total_steps`
4. **禁止在工具调用外重复文字描述选项内容**
5. **一次回复可连续调用多次**，实现多张卡片

### 4.2 用户选择消息格式

当用户做出选择后，前端发送标准格式消息：

```
[选择:选项ID] 选项标签文本
```

**示例**：
- `[选择:time-2h] 2小时`
- `[选择:web] Web应用（推荐）`
- `[选择:brainstorm] 完全没想法，需要脑爆`

#### 后端解析函数

```python
def _parse_selection_format(message: str) -> tuple[str, str] | None:
    """解析 [选择:选项ID] 格式"""
    if not message:
        return None
    match = re.search(r'\[选择[:：]\s*([^\]]+)\]', message.strip())
    if match:
        return ("[选择]", match.group(1).strip())
    return None
```

### 4.3 前端实现规范

#### QuestionCard 组件

```typescript
interface QuestionData {
  id: string;
  title: string;
  subtitle?: string;
  options: QuestionOption[];
  multiple?: boolean;
  step?: number;
  totalSteps?: number;
}

interface QuestionOption {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
}
```

#### 选择消息构造

```typescript
const handleQuestionAnswer = (selectedIds: string[], customText?: string) => {
  const selectedId = selectedIds[0] || '';
  const answerText = getOptionLabel(selectedId);
  const sendText = `[选择:${selectedId}] ${answerText}`;
  handleSend(sendText);
};
```

---

## 5. 教学模式定义（v1.1.0 扩展）

### 5.1 五种教学模式

| 模式 | 标识 | 适用场景 | AI 行为 |
|------|------|---------|---------|
| **引导式** | guided | 默认模式 | 给框架+TODO，指出"下一步你来补什么" |
| **演示式** | demo | 学生需要参考 | 展示完整代码+模块拆解+修改建议 |
| **动手式** | hands_on | 学生想自己尝试 | 给任务+验证标准+报错提示，不给完整答案 |
| **讲解式** | lecture | 概念学习阶段 | 先讲原理→设计思路→关键代码→结果验证 |
| **可视化** | html_visual | 复杂架构讲解 | 生成带流程图、架构图的交互式 HTML 讲解页 |

### 5.2 html_visual 模式详解

**触发条件**：
- 学生选择"可视化讲解"教学模式
- AI 判断需要讲解复杂架构或数据流程

**输出要求**：
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    /* 包含代码高亮、折叠块、tooltip 样式 */
  </style>
</head>
<body>
  <!-- 架构图 -->
  <div class="mermaid">
    graph TD
      A[用户输入] --> B[核心处理]
      B --> C[结果展示]
  </div>
  
  <!-- 代码讲解 -->
  <div class="code-section">
    <div class="code-comment">💡 萌新理解：这是程序的"大门"</div>
    <pre><code>...</code></pre>
  </div>
</body>
</html>
```

---

## 6. 架构设计：基于 ZeroClaw 底座的 Skill 驱动架构

### 6.1 整体架构

```text
┌─────────────────────────────────────────────────────────────────┐
│                        fineSTEM B/S 平台                         │
├─────────────────────────────────────────────────────────────────┤
│  前端（React SPA）                                               │
│  ├─ 独立 AI 页面（"创造"）── 场景入口 + Skill 驱动对话 + 代码编辑  │
│  ├─ 嵌入式侧边栏 ──────── 页面感知 + 轻量 AI 辅助               │
│  └─ 功能页面 ──────────── Demo墙 / 项目 / 成果 / 编辑器          │
├─────────────────────────────────────────────────────────────────┤
│  FastAPI 业务层                                                  │
│  ├─ 用户 / 项目 / Demo / 成果档案卡 CRUD                         │
│  ├─ SKILL_STATE 持久化（数据库）                                  │
│  ├─ 工件存储（数据库 + 文件系统）                                  │
│  ├─ 代码沙箱编排（WebContainer / Pyodide）                       │
│  └─ ZeroClaw Gateway 代理（WebSocket 流式对话）                  │
├─────────────────────────────────────────────────────────────────┤
│                    ZeroClaw AI 运行时                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Agent Core（对话主循环 + Tool Calling 编排）              │   │
│  │                                                          │   │
│  │  Provider 层                                              │   │
│  │  ├─ DeepSeek（主）                                        │   │
│  │  ├─ 智谱 GLM（回退）                                      │   │
│  │  └─ Mock（兜底）                                          │   │
│  │                                                          │   │
│  │  Skill 注册表（可插拔）                                    │   │
│  │  ├─ stem-pbl-guide ★ PBL 项目引导（蓝本）                  │   │
│  │  │   ├─ 00_project_bootstrap  初始化项目                   │   │
│  │  │   ├─ 01_brainstorm_studio  脑爆选题                     │   │
│  │  │   ├─ 02_idea_to_spec        开题立项                    │   │
│  │  │   ├─ 03_scope_cutter        范围裁剪                    │   │
│  │  │   ├─ 04_track_router        轨道选择                    │   │
│  │  │   ├─ 05_designer            设计蓝图                    │   │
│  │  │   ├─ 06_task_decomposer     分步计划                    │   │
│  │  │   ├─ 07_coder_coach         编码教练                    │   │
│  │  │   └─ 08_evaluator_showcase  验收展示                    │   │
│  │  └─ [未来 Skill...]      更多可插拔能力                     │   │
│  │                                                          │   │
│  │  Tool 层                                                 │   │
│  │  ├─ ask_question         ★ 结构化提问（主路径）            │   │
│  │  ├─ skill_state_reader   读取 SKILL_STATE                 │   │
│  │  ├─ skill_state_writer   更新 SKILL_STATE                 │   │
│  │  ├─ artifact_writer      生成/更新工件                    │   │
│  │  ├─ stage_advancer       推进项目阶段                      │   │
│  │  ├─ project_creator      创建项目                         │   │
│  │  ├─ project_code_writer  写入代码                         │   │
│  │  └─ code_runner          执行代码                         │   │
│  │                                                          │   │
│  │  Memory 层                                                │   │
│  │  ├─ 对话历史（项目级隔离）                                  │   │
│  │  ├─ 用户画像（编程偏好、年级、兴趣）                         │   │
│  │  └─ 能力标签（已掌握技能积累）                               │   │
│  │                                                          │   │
│  │  Channel 层                                               │   │
│  │  └─ WebSocket（流式对话）                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Agent Loop 核心流程

```text
学生消息
  │
  ▼
┌─────────────────────────────────────────────┐
│           Agent Loop（编排层）                │
│                                             │
│  1. 组装上下文                               │
│     ├─ 项目状态（projectId, currentStage）    │
│     ├─ 页面场景（page, scene）               │
│     ├─ SKILL_STATE（阶段、工件、教学模式）     │
│     ├─ 证据列表                              │
│     ├─ 代码片段（如果有）                     │
│     └─ 对话历史                              │
│                                             │
│  2. 意图识别 + Skill 路由                    │
│     ├─ 匹配 Skill triggers                  │
│     └─ "我想做一个项目" → stem-pbl-guide     │
│                                             │
│  3. 加载 Skill 上下文                        │
│     ├─ 注入 Skill 的 system_prompt          │
│     ├─ 强调 ask_question 工具使用规范        │
│     └─ 读取当前工件状态                      │
│                                             │
│  4. 调用 LLM（带 Tool 定义）                  │
│     └─ DeepSeek API / GLM 回退              │
│                                             │
│  5. 处理响应                                 │
│     ├─ 纯文本 → 直接返回学生                  │
│     ├─ Tool Call → 执行工具 → 结果注入       │
│     └─ ask_question → 前端渲染 QuestionCard  │
│                                             │
│  6. 后处理                                   │
│     ├─ 阶段完成检测 → 自动推进               │
│     ├─ 截断检测 → 自动续接                   │
│     └─ 证据自动保存                          │
└─────────────────────────────────────────────┘
```

---

## 7. Tool Calling 定义

### 7.1 核心 Tool 清单

#### Tool 1: ask_question —— 结构化提问（★ 主路径）

```text
触发场景：AI 需要向学生提问、让学生做选择
调用方式：AI 必须调用（禁止文本输出选项）

输入：
  title: string（必填）
  subtitle: string（可选）
  multiple: boolean（可选，默认 false）
  step: number（可选，当前步骤）
  total_steps: number（可选，总步骤）
  options: array（必填，2-6 个选项）
    - id: string（选项唯一标识）
    - label: string（显示文本）
    - description: string（可选，描述）
    - recommended: boolean（可选，是否推荐）

输出：
  前端收到 tool_call 事件，渲染 QuestionCard
  用户选择后发送：[选择:选项ID] 选项标签

示例：
  {
    "title": "你打算花多长时间完成这个项目？",
    "step": 2,
    "total_steps": 3,
    "options": [
      {"id": "time-2h", "label": "2小时", "description": "适合做可运行版本"},
      {"id": "time-6h", "label": "6小时", "description": "适合完成完整小项目", "recommended": true}
    ]
  }
```

#### Tool 2: skill_state_reader —— 读取 SKILL_STATE

```text
触发场景：AI 需要了解学生当前项目状态
调用方式：AI 自动调用

输入：
  project_id: string（必填）
  include: ["stage", "artifacts", "modes", "history"]（可选）

输出：
  {
    project_name: "我的计算器",
    mode: "light",
    current_stage: "stage_07_execute",
    stage_status: "draft",
    stage_passed: { stage_00: true, ..., stage_06: true, stage_07: false },
    artifacts: { brainstorm: "valid", ..., dev_log: "draft" },
    modes: { teaching_mode: "guided", research_docs: true }
  }
```

#### Tool 3: stage_advancer —— 推进项目阶段

```text
触发场景：AI 检测到当前阶段完成条件已满足
调用方式：AI 自动调用 + 通知学生

输入：
  project_id: string（必填）
  target_stage: string（必填）
  evidence: { summary: string, artifacts: string[] }（可选）

输出：
  {
    success: true,
    previous_stage: "stage_01_brainstorm",
    current_stage: "stage_02_brief",
    message: "已从「脑爆选题」推进到「开题立项」"
  }

门禁检查：
  stage_01：至少1轮脑爆；候选题>=6
  stage_02：schema_valid=true；success_criteria>=2
  stage_03：schema_valid=true；must_have<=3
  stage_04：schema_valid=true；template_id在白名单
  stage_05：schema_valid=true；验收用例>=3
  stage_06：schema_valid=true；每步都有run/check/rollback
  stage_07：至少完成1个milestone；有证据
  stage_08：schema_valid=true；验收项>=2；反思learned>=2
```

#### Tool 4: project_code_writer —— 写入代码

```text
触发场景：AI 生成代码后需要保存到项目
调用方式：AI 显式调用（唯一合法写入入口）

输入：
  project_id: string（必填）
  code: string（必填）
  language: string（必填，如 "python", "javascript", "html"）
  filename: string（可选，默认根据语言推断）

输出：
  {
    success: true,
    filename: "main.py",
    saved_at: "2026-07-20T10:30:00Z"
  }

注意：
  - 只有 stage_05_design / stage_07_execute / stage_08_evaluate 允许产出可执行代码
  - stage_00~stage_04 禁止直接生成代码，应引导回当前阶段任务
```

### 7.2 Tool Calling 安全边界

| 规则 | 说明 |
|------|------|
| 只能操作当前用户的项目 | project_id 必须属于当前用户，后端二次校验 |
| 阶段只能前进不能后退 | stage_advancer 不允许回退 |
| 代码执行有超时限制 | code_runner 最长 10 秒，超时自动终止 |
| 证据不能删除 | evidence_saver 只能新增 |
| 项目创建需学生确认 | project_creator 必须由学生触发或确认 |
| 工具白名单 | 每个 Skill 只能调用其注册时声明的工具 |
| **提问必须用工具** | **ask_question 是唯一合法提问方式** |

---

## 8. 截断检测与续接机制（v1.1.0 新增）

### 8.1 前端截断检测

```typescript
function _detectIncompleteContent(text: string): boolean {
  if (!text || text.length < 10) return false;
  const trimmed = text.trim();
  
  // 1. 未闭合的代码块（奇数个 ```）
  const codeBlockMatches = trimmed.match(/```/g);
  if (codeBlockMatches && codeBlockMatches.length % 2 === 1) {
    return true;
  }
  
  // 2. 未闭合的 XML/HTML 标签
  const openTags = trimmed.match(/<([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g);
  const closeTags = trimmed.match(/<\/[a-zA-Z][a-zA-Z0-9]*>/g);
  if (openTags && closeTags && openTags.length > closeTags.length) {
    const lastOpenMatch = trimmed.match(/<([a-zA-Z][a-zA-Z0-9]*)[^>]*>[^<]*$/);
    if (lastOpenMatch) {
      const tagName = lastOpenMatch[1];
      const closePattern = new RegExp(`</${tagName}>`);
      if (!closePattern.test(trimmed)) {
        return true;
      }
    }
  }
  
  // 3. 以编程语言名称结尾（可能想输出代码块但被截断）
  const langPattern = /(python|javascript|typescript|html|css|java|c\+\+|go|rust)\s*$/i;
  if (langPattern.test(trimmed)) {
    return true;
  }
  
  // 4. 以引导词结尾
  const guidePatterns = /(接下来|首先|第一步|然后|接着|最后|总之|综上所述)\s*$/i;
  if (guidePatterns.test(trimmed)) {
    return true;
  }
  
  return false;
}
```

### 8.2 续接流程

```text
1. 前端检测到截断（finish_reason=length 或 _detectIncompleteContent=true）
2. 在对话末尾显示"继续生成"按钮
3. 用户点击后，发送"继续"消息
4. 后端识别续接意图，携带上下文重新调用 LLM
5. 新内容无缝拼接到原内容后
```

---

## 9. ZeroClaw 能力利用率与演进路线

### 9.1 当前利用率 vs 目标

```text
ZeroClaw 模块          当前    目标    差距说明
─────────────────────────────────────────────────────
Provider 抽象           100%    100%   已用足
Agent Loop              70%     90%    需强化阶段门禁
Tool Calling            80%     90%    ask_question 已统一
Memory                  30%     80%    需项目级记忆/用户画像
SOP Engine              10%     70%    研学阶段需声明式定义
Channel                 80%     90%    WebSocket 流式已稳定
Security                50%     70%    需工具白名单/阶段门禁
Observability           40%     60%    需追踪/指标/告警
```

### 9.2 实现路线

**Phase 1（当前）**：ask_question 工具统一 + 截断检测
- ✅ ask_question 工具作为主路径
- ✅ [选择:选项ID] 标准格式
- ✅ 前端截断检测与续接
- ✅ html_visual 教学模式

**Phase 2（下一步）**：阶段门禁强化 + SOP 引擎
- 声明式阶段定义（门禁条件、通过标准）
- 自动阶段推进（满足条件时自动调用 stage_advancer）
- 工件依赖追踪（前置工件变更时后置工件自动过期）

**Phase 3（未来）**：Memory 增强 + AI IDE 集成
- 项目级对话历史持久化
- 用户画像与能力标签
- AI IDE Channel 实现

---

## 10. 附录

### 10.1 相关文件

| 文件 | 说明 |
|------|------|
| `.trae/skills/stem-pbl-guide/SKILL.md` | Skill 完整定义 |
| `apps/backend/app/services/orchestrator.py` | Agent 编排服务 |
| `apps/backend/app/services/skill_loader.py` | Skill 动态加载器 |
| `apps/backend/app/services/tools.py` | Tool 定义与实现 |
| `apps/frontend/src/hooks/useStreamingChat.ts` | 前端 WebSocket 流式对话 |
| `apps/frontend/src/components/QuestionCard.tsx` | 选项卡片组件 |
| `apps/frontend/src/pages/Create.tsx` | 创造页面主逻辑 |

### 10.2 关键配置

```python
# 教学模式列表
VALID_TEACHING_MODES = {"guided", "demo", "hands_on", "lecture", "html_visual"}

# 允许代码生成的阶段
ALLOWED_CODE_STAGES = {
    "stage_05_design",
    "stage_07_execute",
    "stage_08_evaluate",
}

# 阶段顺序列表
STAGE_ORDER_LIST = [
    "stage_00_bootstrap",
    "stage_01_brainstorm",
    "stage_02_brief",
    "stage_03_constraints",
    "stage_04_track",
    "stage_05_design",
    "stage_06_step_plan",
    "stage_07_execute",
    "stage_08_evaluate",
]
```

---

**文档结束**
