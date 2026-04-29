# fineSTEM AI 对话流设计规格

**版本**: v1.0.0
**日期**: 2026-04-28
**状态**: 设计确认
**作者**: AI Agent（基于与用户的深度讨论）
**对应主文档**: `04_fineSTEM_BS平台产品方案_V3.3.md`
**技术基座**: `ZeroClaw_技术知识库_v1.0.0.md`
**Skill 蓝本**: `.trae/skills/stem-pbl-guide/SKILL.md`

---

## 1. 设计背景与问题

### 1.1 当前问题

fineSTEM 平台的 AI 对话流存在根本性断裂：

| 问题 | 现状 | 应有状态 |
|------|------|---------|
| AI 角色 | 通用聊天机器人 | 三角色智能切换（PBL导师/编程助手/平台引导） |
| 项目感知 | AI 不知道学生在哪个项目、哪个阶段 | AI 读取项目状态，感知阶段进度 |
| 流程驱动 | AI 被动回答，不主动推进 | AI 检测完成条件，自动推进阶段 |
| Skill 集成 | stem-pbl-guide Skill 未接入对话流 | Skill 作为 ZeroClaw 可插拔能力驱动对话 |
| 代码能力 | 对话与代码编辑器割裂 | 对话中生成代码 → 写入编辑器 → 运行预览 |
| 文档产出 | 无文档生成能力 | 自动生成开题报告、技术报告、结题报告、论文 |
| 记忆 | 对话历史存前端，刷新即丢失 | 项目级记忆、用户画像、能力标签积累 |

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
| AI 直接生成完整代码 | 按 teaching_mode 控制粒度：guided=框架+TODO，demo=完整+注释，hands_on=只有签名，lecture=原理+代码 |
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

## 4. 架构设计：基于 ZeroClaw 底座的 Skill 驱动架构

### 4.1 整体架构

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
│  └─ ZeroClaw Gateway 代理（当前 MVP）→ 原生 ZeroClaw（Phase 2）  │
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
│  │  ├─ code-runner          代码执行                          │   │
│  │  ├─ demo-explorer        Demo 解释与 Fork                  │   │
│  │  ├─ knowledge-base       知识检索                          │   │
│  │  ├─ ide-connector        AI IDE 互联                       │   │
│  │  └─ [未来 Skill...]      更多可插拔能力                     │   │
│  │                                                          │   │
│  │  Memory 层                                                │   │
│  │  ├─ 对话历史（项目级隔离）                                  │   │
│  │  ├─ 用户画像（编程偏好、年级、兴趣）                         │   │
│  │  ├─ 能力标签（已掌握技能积累）                               │   │
│  │  └─ 对话摘要（自动生成，下次对话先读摘要）                    │   │
│  │                                                          │   │
│  │  Channel 层                                               │   │
│  │  ├─ WebSocket（流式对话）                                  │   │
│  │  └─ [Phase 3] AI IDE Channel / Webhook                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Agent Loop 核心流程

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
│     ├─ "我想做一个项目" → stem-pbl-guide     │
│     ├─ "帮我跑一下代码" → code-runner        │
│     ├─ "这个 Demo 怎么做的" → demo-explorer  │
│     └─ 编程问题 → 编程学习助手角色            │
│                                             │
│  3. 加载 Skill 上下文                        │
│     ├─ 注入 Skill 的 system_prompt          │
│     ├─ 读取 SKILL_STATE                     │
│     ├─ 读取当前工件状态                      │
│     └─ 确定当前子 Skill                     │
│                                             │
│  4. 调用 LLM（带 Tool 定义）                  │
│     └─ DeepSeek API / GLM 回退              │
│                                             │
│  5. 判断响应类型                             │
│     ├─ 纯文本 → 直接返回学生                  │
│     └─ Tool Call → 执行工具 → 结果注入 →     │
│        再次调用 LLM（带工具结果）→ 返回学生    │
│                                             │
│  6. 后处理                                   │
│     ├─ 阶段完成检测 → 自动推进               │
│     ├─ 证据自动保存                          │
│     ├─ 对话摘要生成                          │
│     └─ 能力标签更新                          │
└─────────────────────────────────────────────┘
```

### 4.3 Skill 注册与执行模型

每个 Skill 在 ZeroClaw 中以统一格式注册：

```text
Skill 注册信息：
  skill_id:         唯一标识（如 "stem-pbl-guide"）
  name:             显示名称
  description:      功能描述
  triggers:         触发关键词列表
  sub_skills:       子 Skill 列表（如有）
  tools:            该 Skill 需要的工具列表
  system_prompt:    该 Skill 的角色 Prompt
  state_schema:     状态结构定义
  artifact_schemas: 工件结构定义
  routing:          路由规则（触发语 → 子 Skill）
```

**stem-pbl-guide 子 Skill 路由表**（基于 `.trae/skills/stem-pbl-guide/routing.yml`）：

| 触发语 | 子 Skill |
|--------|---------|
| "创建新项目"/"开始新项目" | 00_project_bootstrap |
| "选题"/"脑爆"/"给我灵感" | 01_brainstorm_studio |
| "开题"/"立项"/"写需求" | 02_idea_to_spec |
| "裁剪范围"/"MVP"/"简化" | 03_scope_cutter |
| "选技术"/"用什么技术" | 04_track_router |
| "设计"/"架构"/"页面设计" | 05_designer |
| "拆任务"/"计划"/"里程碑" | 06_task_decomposer |
| "写代码"/"编码"/"开发" | 07_coder_coach |
| "验收"/"完成了"/"测试" | 08_evaluator_showcase |

---

## 5. Tool Calling 定义

### 5.1 核心 Tool 清单

#### Tool 1: skill_state_reader —— 读取 SKILL_STATE

```text
触发场景：AI 需要了解学生当前项目状态
调用方式：AI 自动调用

输入：
  project_id: string（必填）
  include: ["stage" | "artifacts" | "modes" | "history"]（可选，默认全部）

输出：
  {
    project_name: "我的计算器",
    mode: "light",
    current_stage: "stage_07_execute",
    stage_status: "draft",
    stage_passed: { stage_00: true, ..., stage_06: true, stage_07: false },
    artifacts: { brainstorm: "valid", ..., dev_log: "draft" },
    modes: { teaching_mode: "guided", research_docs: true, paper_mode: "off" },
    project_locked: true
  }
```

#### Tool 2: skill_state_writer —— 更新 SKILL_STATE

```text
触发场景：阶段推进、工件状态变更、模式切换
调用方式：AI 自动调用

输入：
  project_id: string（必填）
  updates: object（必填，要更新的字段）
  history_entry: { action: string, from_stage: string, to_stage: string, note: string }（可选）

输出：
  { success: true, updated_fields: [...] }
```

#### Tool 3: artifact_reader —— 读取工件内容

```text
触发场景：AI 需要读取已生成的工件文档
调用方式：AI 自动调用

输入：
  project_id: string（必填）
  artifact_name: string（必填，如 "brainstorm", "project_brief", "design"）

输出：
  { artifact_name: "design", status: "valid", content: {...}, last_updated_at: "..." }
```

#### Tool 4: artifact_writer —— 生成/更新工件

```text
触发场景：AI 生成文档、代码、报告
调用方式：AI 自动调用

输入：
  project_id: string（必填）
  artifact_name: string（必填）
  content: string | object（必填，文档内容）
  artifact_type: "document" | "code" | "report"（必填）

输出：
  { success: true, artifact_name: "project_brief", path: "docs/01_project_brief.json" }
```

#### Tool 5: stage_advancer —— 推进项目阶段

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
    message: "已从「脑爆选题」推进到「开题立项」",
    next_hint: "现在来写项目立项书，定义项目目标和成功标准"
  }

门禁检查（推进前自动执行）：
  轻项目：
    step_1 → step_2：项目名称 + 一句话描述 + 核心功能列表 已填写
    step_2 → step_3：可运行代码已提交 + 关键截图已保存
    step_3 → 完成：成果档案卡已生成 + 简短反思已填写

  标准研学（基于 stem-pbl-guide 的门禁条件）：
    stage_01：至少1轮脑爆；候选题>=6；有Top3选择
    stage_02：schema_valid=true；success_criteria>=2；risks>=2
    stage_03：schema_valid=true；must_have<=3；wont_do>=2
    stage_04：schema_valid=true；template_id在白名单
    stage_05：schema_valid=true；验收用例>=3
    stage_06：schema_valid=true；每步都有run/check/rollback
    stage_07：至少完成1个milestone；有证据
    stage_08：schema_valid=true；验收项>=2；反思learned>=2
```

#### Tool 6: evidence_saver —— 保存证据

```text
触发场景：AI 生成有价值代码 / 对话产生关键结论 / 代码运行结果
调用方式：AI 自动调用

输入：
  project_id: string（必填）
  type: "code" | "dialogue_summary" | "screenshot" | "run_result"（必填）
  title: string（必填）
  content: string（必填）
  stage: string（可选）

输出：
  { success: true, evidence_id: "ev_xxx", message: "已保存为证据：..." }
```

#### Tool 7: code_runner —— 执行代码

```text
触发场景：学生让 AI 运行代码，或 AI 生成代码后主动运行验证
调用方式：学生请求 或 AI 自动调用

输入：
  code: string（必填）
  language: "python" | "javascript"（必填）
  stdin: string（可选）

输出：
  {
    success: true,
    stdout: "...",
    stderr: "",
    exit_code: 0,
    execution_time_ms: 120
  }

MVP 实现：
  JavaScript：WebContainer（浏览器端执行）
  Python：Pyodide（浏览器端）或后端沙箱
```

#### Tool 8: resource_searcher —— 检索和推荐资源

```text
触发场景：学生问"有什么 Demo"/ AI 判断有匹配 Demo / 学生想学某知识点
调用方式：AI 自动调用

输入：
  query: string（必填）
  type: "demo" | "course" | "knowledge"（可选，默认全部）
  tags: string[]（可选）
  limit: number（可选，默认 5）

输出：
  {
    results: [
      { id: "demo_001", type: "demo", title: "...", tags: [...], difficulty: "beginner", match_reason: "..." },
      ...
    ]
  }
```

#### Tool 9: project_creator —— 创建项目 / Fork Demo

```text
触发场景：学生说"我想做一个项目" / Demo页点击"我也做一个"
调用方式：学生请求 或 AI 建议后学生确认

输入：
  source_type: "demo_fork" | "blank"（必填）
  source_demo_id: string（demo_fork 时必填）
  name: string（必填）
  description: string（可选）
  mode: "light" | "standard"（可选，默认 light）

输出：
  {
    success: true,
    project_id: "proj_xxx",
    name: "我的计算器",
    mode: "light",
    initial_code: "...",
    suggestions: ["试试修改...", "添加...", "让..."]
  }
```

### 5.2 Tool Calling 安全边界

| 规则 | 说明 |
|------|------|
| 只能操作当前用户的项目 | project_id 必须属于当前用户，后端二次校验 |
| 阶段只能前进不能后退 | stage_advancer 不允许回退（回退用 skill_state_writer + back 规则） |
| 代码执行有超时限制 | code_runner 最长 10 秒，超时自动终止 |
| 证据不能删除 | evidence_saver 只能新增 |
| 项目创建需学生确认 | project_creator 必须由学生触发或确认 |
| 工具白名单 | 每个 Skill 只能调用其注册时声明的工具 |

---

## 6. stem-pbl-guide Skill 集成

### 6.1 文件系统 → 数据库映射

stem-pbl-guide 原本通过文件系统操作，适配到 B/S 平台后通过 Tool Calling 间接操作：

| 原始操作（Trae IDE） | 适配后操作（B/S + ZeroClaw） |
|---------------------|----------------------------|
| 直接读写 SKILL_STATE.json | skill_state_reader / writer |
| 直接创建 docs/ 目录和文件 | artifact_writer |
| 直接写 src/ 代码文件 | artifact_writer（type=code） |
| AskUserQuestion 通过 IDE | 前端对话按钮呈现 |
| 直接运行代码 | code_runner |
| Playwright MCP 测试 | code_runner（test 模式） |

### 6.2 SKILL_STATE 数据库映射

```text
Project 表（已有）：
  id, userId, name, mode, sourceDemoId, currentStage

新增 ProjectSkillState 表：
  projectId          → 项目ID
  stageStatus        → 当前阶段状态 (draft/passed/needs_redo)
  stagePassed        → JSON: 各阶段是否通过
  artifacts          → JSON: 各工件状态
  dependencyGraph    → JSON: 依赖关系
  staleArtifacts     → JSON: 过期工件
  defaults           → JSON: 运行参数 (ageBand, timeBudget, trackPreference)
  modes              → JSON: 模式配置 (researchDocs, paperMode, teachingMode)
  projectLocked      → boolean
  history            → JSON: 操作历史

工件文档存储：
  轻量工件（brainstorm.md, dev_log.md）→ 数据库 TEXT 字段
  结构化工件（project_brief.json 等）→ 数据库 JSON 字段
  文件类工件（代码、截图）→ D:\data\finestem\uploads\{projectId}\
```

### 6.3 Skill 触发与路由

```text
场景入口触发（"创造"页面左侧）：
  "开始项目" → 启动 stem-pbl-guide → stage_00_bootstrap

对话意图触发（任何对话中）：
  "我想做一个项目" → 识别为 PBL 引导意图 → 加载 Skill 上下文
  "下一步" → 识别为阶段推进 → 调用 stage_advancer
  "写代码" → 识别为编码阶段 → 切换到 Coder Coach 角色

页面上下文触发（嵌入式侧边栏）：
  项目详情页 → 自动加载当前项目的 SKILL_STATE
  → AI 知道学生在哪个阶段，主动提供引导
```

### 6.4 多 Skill 协作

```text
规则：
1. 同一时刻只有一个 Skill 是"主导"角色
2. 主导 Skill 可以调用其他 Skill 的工具
3. 项目上下文在 Skill 间共享（通过数据库）
4. Skill 切换时保持对话连续性

示例：
  stem-pbl-guide（主导）→ 学生在 stage_07 遇到代码问题
  → 自动路由到 07_coder_coach 子 Skill
  → coder_coach 调用 code_runner 执行代码
  → 编码完成 → evidence_saver 保存证据
  → 检查里程碑完成条件 → stage_advancer 推进
```

---

## 7. ZeroClaw 能力利用率与演进路线

### 7.1 当前利用率 vs 目标

```text
ZeroClaw 模块          当前    目标    差距说明
─────────────────────────────────────────────────────
Provider 抽象           100%    100%   已用足
Agent Loop              50%     90%   需要多步/并行 Tool Calling
Tools                   50%     85%   需要实现 9 个核心 Tool
Memory                  15%     80%   需要项目级记忆/用户画像/能力标签
SOP Engine               0%     70%   研学 9 阶段应定义为声明式 SOP
Channel                  0%     60%   MVP 只需 WebSocket，IDE 集成是 Phase 3
Security                30%     70%   需要工具白名单/出站策略
Observability           20%     60%   需要追踪/指标/告警
```

### 7.2 渐进式实现路线

```text
Phase 1（MVP）：核心 Skill 集成 + 基础 Tool Calling
  ├─ 实现 9 个核心 Tool
  │   └─ MVP 优先级：skill_state_reader/writer > stage_advancer > artifact_writer > code_runner > project_creator > evidence_saver > resource_searcher > artifact_reader
  ├─ stem-pbl-guide Skill 接入对话流（仅轻项目 3 步 + 标准 stage_00~02）
  ├─ SKILL_STATE 数据库持久化（新增 ProjectSkillState 表）
  ├─ "创造"页面 Skill 驱动对话（保留 4 个场景入口）
  ├─ 代码编辑器联动（Monaco + WebContainer for JS，Pyodide for Python）
  ├─ 基础 Memory（项目级对话历史，存数据库）
  └─ MVP 不做：嵌入式侧边栏、向量记忆、SOP 引擎、AI IDE Channel

Phase 2：Memory 增强 + SOP 引擎
  ├─ 向量嵌入记忆（跨会话检索）
  ├─ 用户画像积累
  ├─ 能力标签自动生成
  ├─ 对话摘要自动生成
  ├─ SOP 引擎驱动研学 9 阶段
  └─ 部署 ZeroClaw Gateway 本地实例

Phase 3：Channel 扩展 + AI IDE 集成
  ├─ AI IDE Channel（Trae/Cursor/VS Code）
  ├─ Webhook Channel（事件驱动通知）
  ├─ 项目下载 + Skill 安装指引
  └─ 远程 AI 咨询

Phase 4：完整体验 + 互联
  ├─ 研学文档轨（自动生成开题/技术/结题报告）
  ├─ 测试模式（Playwright 集成）
  ├─ 成果档案卡生成 + 分享
  ├─ 正式报告导出（PDF/DOCX/PPTX）
  ├─ 灵感墙强化
  └─ 移动端 Channel
```

---

## 8. 功能裁剪：fineSTEM vs 豆包编程

### 8.1 保留且强化的功能

| 功能 | 豆包编程 | fineSTEM 差异化 |
|------|---------|----------------|
| AI 对话引导 | 自由问答 | PBL 流程驱动，AI 主动推进阶段 |
| 代码编辑器 | 内嵌编辑器 | Monaco + 实时预览 + AI 联动 |
| 代码生成 | 核心功能 | 教学工具，按 teaching_mode 控制粒度 |
| 代码运行 | 一键运行 | 验证+反思，运行结果作为证据 |
| 项目创建 | 从零生成 | 从 Demo Fork，先体验再创作 |
| 文档生成 | 无 | 核心产出：开题报告、技术报告、结题报告、论文 |
| 过程记录 | 版本历史 | 证据采集：对话摘要、阶段变更、代码版本 |
| 成果展示 | 分享链接 | 成果档案卡：项目名+方法+反思+能力标签 |
| 课程学习 | 无 | 学科融合：物理+编程、数学+数据分析 |
| 编程问答 | 核心功能 | 辅助功能，教学方式回答 |

### 8.2 裁剪掉的功能

| 功能 | 裁剪理由 |
|------|---------|
| 所见即所得网页编辑器 | 我们要学生理解代码，不是绕过代码 |
| 图片/设计稿生成代码 | 5-12 年级学生不会提供设计稿 |
| 文本秒变网页 | 内容工具，非学习工具 |
| AI 绘图/搜图 | 与编程学习无关 |
| 专业开发者工具（Git/终端/包管理/部署） | 引导到 AI IDE 接力 |
| API 兼容 Claude Code | 面向开发者，非学生 |

### 8.3 PBL 完整产出模型

```text
fineSTEM PBL 项目产出 = 代码成品 + 研学文档

代码成品（可运行）：
  ├─ Web 应用（HTML/JS/Streamlit/Flask）
  ├─ 数据分析（Python + Jupyter）
  ├─ 游戏（Pygame）
  ├─ 硬件项目（Pico 代码）
  └─ 其他（AI 应用、工具等）

研学文档（可导出 PDF/DOCX/PPTX）：
  ├─ 开题报告（10_proposal.md）
  ├─ 需求与设计文档（20_prd_design.md）
  ├─ 原型设计说明书（30_prototype_spec.md）
  ├─ 技术报告（40_tech_report.md）
  ├─ 结题报告（50_final_report.md）
  ├─ 论文（60_paper.md，可选）
  └─ 证据素材（截图/日志/图表）

成果档案卡（可分享）：
  ├─ 项目名称 + 一句话介绍
  ├─ 我解决了什么问题
  ├─ 我用了什么方法
  ├─ 项目截图/演示链接
  ├─ 我的反思
  └─ AI 总结的能力标签
```

---

## 9. 验证清单

- [ ] AI 能感知学生当前项目状态（projectId, currentStage, SKILL_STATE）
- [ ] AI 能根据意图自动切换三角色
- [ ] stem-pbl-guide 的 9 阶段能通过对话驱动推进
- [ ] 阶段门禁检查能自动执行
- [ ] 代码生成后能写入 Monaco 编辑器
- [ ] 代码能运行并显示结果
- [ ] 运行结果能保存为证据
- [ ] 工件文档能生成并持久化
- [ ] 对话历史能跨会话保留
- [ ] 独立 AI 页面和嵌入式侧边栏共享上下文
