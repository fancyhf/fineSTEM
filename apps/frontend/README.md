# fineSTEM 前端 — 开发与测试 Agent 代码导航

> **目标读者**：开发 Agent、测试 Agent。接到模糊需求/bug 时，从这里快速定位代码。
> **使用方式**：先看 §代码定位速查表 找到目标文件，再读对应模块说明。

---

## 代码定位速查表

| 需求 / Bug 关键词 | 去这里 | 具体文件 |
|-------------------|--------|----------|
| **AI 对话流 / WebSocket** | `src/hooks/useStreamingChat.ts` | 核心 hook，所有 ZeroClaw WS 通信 |
| 选项卡不显示 / 丢失 | `src/lib/questionParser.ts` + `src/hooks/useStreamingChat.ts` | 前端解析 + WS tool_call 处理 |
| 代码编辑器 | `src/components/CodeEditor.tsx` | Monaco Editor 封装 |
| AI 生成代码不显示 | `src/hooks/useStreamingChat.ts` | `onCodeGenerated` 事件 + `CodeGeneratedEvent` |
| 回复被截断 / "继续"按钮 | `src/hooks/useStreamingChat.ts` | 自动续接逻辑 + `stalled` 状态 |
| 流式日志调试 | `src/lib/streamLogger.ts` | `localStorage.setItem('FINESTEM_STREAM_LOG_ENABLED', 'true')` |
| 项目创建页（AI 工作台） | `src/pages/Create.tsx` | ★ 最大页面（3700+ 行），AI 对话 + 代码编辑 + 阶段展示 |
| 研学详情页 | `src/pages/Research.tsx` | 项目列表 |
| 项目详情（阶段/工件/代码） | `src/pages/ProjectDetail.tsx` | |
| 成果档案卡 | `src/pages/ProjectAchievement.tsx` | |
| 分享页 | `src/pages/SharedAchievement.tsx` | |
| 探索中心 / Demo 墙 | `src/pages/Explore.tsx` + `ExploreDemos.tsx` | |
| 灵感墙详情 | `src/pages/AchievementDetail.tsx` | |
| 登录 / 注册 | `src/pages/Login.tsx` + `Register.tsx` | |
| 用户资料 | `src/pages/UserProfile.tsx` | |
| 管理员精选管理 | `src/pages/AdminFeatured.tsx` | |
| 路由配置 / 权限守卫 | `src/App.tsx` | `ProtectedRoute` / `AdminRoute` / `PublicRoute` |
| 认证状态 | `src/contexts/AuthContext.tsx` | JWT token 管理 |
| REST API 调用 | `src/services/api.ts` | 所有后端接口封装 |
| API 错误处理 | `src/services/apiError.ts` | |
| Toast 通知 | `src/services/toast.ts` | |
| TypeScript 类型 | `src/types/index.ts` + `system.ts` | 所有接口类型定义 |
| 标准研学 9 阶段组件 | `src/components/standardStages/` | Stage00-Stage08，每个阶段一个组件 |
| 轻项目 3 步组件 | `src/components/LightProjectStep1-3.tsx` | |
| 问题卡片 UI | `src/components/QuestionCard.tsx` | |
| 阶段进度条 | `src/components/ProjectStageBar.tsx` | |
| 证据面板 | `src/components/EvidencePanel.tsx` | |
| 项目文件面板 | `src/components/ProjectFilesPanel.tsx` | |
| Markdown 渲染 | `src/components/MarkdownText.tsx` | |
| 错误边界 | `src/components/ErrorBoundary.tsx` | |
| 布局 / 导航 | `src/components/layout/Layout.tsx` + `Navbar.tsx` + `Sidebar.tsx` | |
| 基础 UI 组件 | `src/components/ui/` | Button, Card, Badge, Input |
| AI 聊天面板（共享） | `src/components/Shared/AIChatPanel.tsx` | |
| 交互式代码导览 | `src/components/Shared/InteractiveCodeTour/` | |
| 能力雷达图 | `src/components/CapabilityRadarChart.tsx` | |
| 成长时间线 | `src/components/GrowthTimeline.tsx` | |
| 代码模板 | `src/components/CodeTemplates.tsx` | |
| 代码预览 | `src/components/CodePreview.tsx` | |
| 封面选择器 | `src/components/CoverPicker.tsx` | |
| Demo 卡片 | `src/components/DemoCard.tsx` + `DemoFilter.tsx` | |
| 继续按钮 | `src/components/ContinueButton.tsx` | |
| 轻项目注册提示 | `src/components/LightRegisterPrompt.tsx` | |
| 画布录制 | `src/hooks/useCanvasRecorder.ts` | |
| 数据分析 | `src/hooks/useAnalytics.ts` | |
| 图片工具 | `src/lib/image.ts` | |
| 问题确认 | `src/lib/questionConfirm.ts` | |
| 通用工具 | `src/lib/utils.ts` | |

---

## 技术栈

- **框架**: React 18 + TypeScript
- **构建**: Vite（端口 `5184`）
- **样式**: Tailwind CSS（主色 `#14B8A6` 蓝绿色）
- **路由**: React Router v6
- **代码编辑器**: Monaco Editor
- **图标**: Lucide React
- **测试**: Vitest（单元）+ Playwright（E2E）

---

## 核心数据流

### AI 对话主链路（最重要的链路）

```
用户在 Create.tsx 输入消息
  │
  ▼
useStreamingChat.ts → WebSocket → ZeroClaw (ws://127.0.0.1:42617/ws/chat)
  │
  │  ZeroClaw 流式返回事件：
  │  ├── chunk（文本片段）→ onContentUpdate → 实时渲染
  │  ├── thinking（推理过程）→ onThinking → 可折叠区域
  │  ├── tool_call（工具调用）→ onToolCall（phase: 'call'）
  │  ├── tool_result（工具返回）→ onToolCall（phase: 'result'）
  │  │     ├── ask_question → parseQuestionBlocks → onQuestions → QuestionCard 渲染
  │  │     ├── stage_advancer → onStageChanged → ProjectStageBar 更新
  │  │     ├── project_code_writer → onCodeGenerated → CodeEditor 更新
  │  │     ├── project_creator → onProjectCreated → 项目创建
  │  │     └── skill_state_* → 状态同步
  │  ├── done（完成）→ onEnd → 最终处理
  │  └── error → 错误处理
  │
  │  截断检测：done 帧时检查 finish_reason === 'length'
  │  → 自动续接（最多 2 次）→ onAutoContinue 通知 UI
  │
  ▼
Create.tsx 接收事件 → 更新 UI 状态
  │
  │  按需调用后端 REST API：
  │  ├── projectsApi.saveCode() → 保存代码到后端
  │  ├── chatApi.save() → 保存聊天历史
  │  └── projectsApi.getWorkspace() → 恢复工作区
  ▼
页面渲染
```

### 问题卡片双重防线

```
ZeroClaw 返回文本（可能含 <question> XML 或 markdown 列表）
  │
  ▼ 前端第一防线
questionParser.ts: parseQuestionBlocks()
  ├── 主路径：解析 <question> XML
  └── fallback：解析 markdown 列表（带严格过滤）
  │
  ▼ 前端第二防线（后端 API）
POST /api/v1/chat/verify-question
  └── question_verifier.py：纯规则判断"这是不是真问题"
  │
  ▼
QuestionCard.tsx 渲染选项卡
```

### 路由结构（`src/App.tsx`）

| 路径 | 页面 | 权限 |
|------|------|------|
| `/` | Home | 公开 |
| `/explore` | Explore | 公开 |
| `/explore/demos` | ExploreDemos | 公开 |
| `/explore/demos/:demoId` | ExploreDemoDetail | 公开 |
| `/explore/inspiration/:cardId` | AchievementDetail | 公开 |
| `/create` | Create | 公开 |
| `/connect` | Connect | 公开 |
| `/share/:token` | SharedAchievement | 公开（分享链接） |
| `/login` | Login | PublicRoute（已登录跳转） |
| `/register` | Register | PublicRoute |
| `/profile` | UserProfile | ProtectedRoute |
| `/research` | Research | ProtectedRoute |
| `/research/projects/:id` | ProjectDetail | ProtectedRoute |
| `/research/projects/:projectId/achievement` | ProjectAchievement | ProtectedRoute |
| `/projects/:id/edit` | ProjectEditor | ProtectedRoute |
| `/admin/featured` | AdminFeatured | AdminRoute |

---

## 目录结构

```
src/
├── App.tsx                  # ★ 路由配置 + 权限守卫（ProtectedRoute/AdminRoute/PublicRoute）
├── main.tsx                 # 应用入口（挂载 AuthProvider + App）
├── index.css                # 全局样式（Tailwind 指令）
├── vite-env.d.ts            # Vite 类型声明
├── pages/                   # 页面组件（17 个）
│   ├── Create.tsx           # ★★★ AI 工作台（3700+ 行，项目创建主页面）
│   ├── Research.tsx         # 研学项目列表
│   ├── ProjectDetail.tsx    # 项目详情（阶段/工件/代码/证据）
│   ├── ProjectAchievement.tsx # 成果档案卡生成
│   ├── SharedAchievement.tsx  # 分享页（公开访问）
│   ├── Home.tsx             # 首页
│   ├── Explore.tsx          # 探索中心
│   ├── ExploreDemos.tsx     # Demo 墙
│   ├── ExploreDemoDetail.tsx # Demo 详情
│   ├── AchievementDetail.tsx # 灵感墙详情
│   ├── Login.tsx            # 登录
│   ├── Register.tsx         # 注册
│   ├── UserProfile.tsx      # 用户资料
│   ├── ProjectEditor.tsx    # 项目编辑器
│   ├── AdminFeatured.tsx    # 管理员精选管理
│   └── Connect.tsx          # 连接页
├── components/              # 组件
│   ├── layout/              # 布局（Layout/Navbar/Sidebar）
│   ├── ui/                  # 基础 UI（Button/Card/Badge/Input）
│   ├── standardStages/      # ★ 标准 9 阶段组件（Stage00-Stage08 + types）
│   ├── Shared/              # 共享组件
│   │   ├── AIChatPanel.tsx  # AI 聊天面板（可复用）
│   │   └── InteractiveCodeTour/ # 交互式代码导览
│   ├── QuestionCard.tsx     # ★ 问题选项卡片
│   ├── CodeEditor.tsx       # ★ Monaco 代码编辑器
│   ├── MarkdownText.tsx     # ★ Markdown 渲染（含代码高亮）
│   ├── ProjectStageBar.tsx  # ★ 阶段进度条
│   ├── EvidencePanel.tsx    # 证据面板
│   ├── ProjectFilesPanel.tsx # 项目文件面板
│   ├── CodePreview.tsx      # 代码预览
│   ├── CodeTemplates.tsx    # 代码模板
│   ├── ContinueButton.tsx   # "继续生成"按钮
│   ├── DemoCard.tsx         # Demo 卡片
│   ├── DemoFilter.tsx       # Demo 筛选器
│   ├── CoverPicker.tsx      # 封面选择器
│   ├── CapabilityRadarChart.tsx # 能力雷达图
│   ├── GrowthTimeline.tsx   # 成长时间线
│   ├── ErrorBoundary.tsx    # 错误边界
│   ├── Toaster.tsx          # Toast 通知
│   ├── LightProjectSteps.tsx # 轻项目步骤容器
│   ├── LightProjectStep1.tsx # 轻项目 Step 1
│   ├── LightProjectStep2.tsx # 轻项目 Step 2
│   ├── LightProjectStep3.tsx # 轻项目 Step 3
│   ├── LightRegisterPrompt.tsx # 轻项目注册提示
│   ├── StandardProjectSteps.tsx # 标准项目步骤容器
│   └── AchievementCardView.tsx # 成果卡视图
├── hooks/                   # 自定义 Hooks
│   ├── useStreamingChat.ts  # ★★★ ZeroClaw WebSocket 核心 hook
│   ├── useAnalytics.ts      # 数据分析
│   ├── useCanvasRecorder.ts # 画布录制
│   └── __tests__/           # hook 单元测试
├── lib/                     # 工具函数（纯函数，无 React 依赖）
│   ├── questionParser.ts    # ★ 问题卡片解析（XML + markdown fallback）
│   ├── questionConfirm.ts   # 问题确认
│   ├── streamLogger.ts      # ★ 流式日志（localStorage 开关）
│   ├── image.ts             # 图片工具
│   └── utils.ts             # 通用工具
├── services/                # API 服务
│   ├── api.ts               # ★ REST API 封装（13 个 API 模块）
│   ├── apiError.ts          # API 错误处理
│   └── toast.ts             # Toast 通知
├── contexts/
│   └── AuthContext.tsx      # ★ 认证上下文（JWT + 用户状态）
├── types/
│   ├── index.ts             # ★ 所有 TypeScript 类型定义
│   └── system.ts            # 系统类型
└── styles/                  # 样式文件
```

---

## REST API 模块（`src/services/api.ts`）

> 基础 URL: `import.meta.env.VITE_API_URL || '/api/v1'`
> 认证: `Authorization: Bearer <token>`（从 localStorage 读取）

| API 模块 | 导出名 | 主要功能 |
|----------|--------|----------|
| 通用 | `api` | 通用请求封装 |
| 认证 | `authApi` | 登录/注册/用户信息/改密 |
| Demo | `demosApi` | Demo 列表/详情/fork |
| 项目 | `projectsApi` | 项目 CRUD/工作区/代码保存/导出/升级 |
| 成果卡 | `achievementCardsApi` | 成果卡 CRUD/分享/精选 |
| 证据 | `evidenceApi` | 证据 CRUD |
| Skill | `skillsApi` | Skill 安装/列表/删除 |
| Agent | `agentApi` | Agent 配置/灰度 |
| 聊天 | `chatApi` | 聊天历史保存/读取 |
| 文档 | `documentsApi` | 项目文档 CRUD |
| 能力标签 | `capabilityTagsApi` | 能力标签建议 |
| 课程 | `coursesApi` | 课程库 |
| 代码执行 | `codeExecutionApi` | 代码执行 |
| 认证存储 | `authStorage` | localStorage token/user 管理 |

---

## useStreamingChat.ts 详解（核心 hook）

这是前端最重要的文件，负责所有 ZeroClaw WebSocket 通信。

### 导出函数

| 函数 | 说明 |
|------|------|
| `useStreamingChat()` | 主 hook，返回 `streamChat()` 方法和状态 |
| `normalizeToolName(rawName)` | `finestem__ask_question` → `ask_question` |
| `parseMcpOutput(rawOutput)` | 解析 MCP 双层 JSON 输出 |

### StreamEvents 回调

| 回调 | 触发时机 |
|------|----------|
| `onContentUpdate(content)` | 收到文本片段 |
| `onThinking(chunk)` | 收到推理过程 |
| `onToolCall({tool_name, phase})` | 工具调用/返回（phase: 'call'/'result'） |
| `onQuestions(questions[])` | ★ 解析出问题卡片（多卡） |
| `onQuestion(question)` | 解析出问题卡片（单卡，兼容） |
| `onCodeGenerated(data)` | ★ AI 生成代码 |
| `onCodeGenerationFailed(data)` | 代码生成失败 |
| `onStageChanged({stage})` | ★ PBL 阶段变更 |
| `onProjectCreated({project_id})` | 项目创建 |
| `onSkillActivated({skill_id})` | Skill 激活 |
| `onAutoContinue({attempt})` | 自动续接状态 |
| `onSopStarted(runId)` | SOP 流程启动 |
| `onSopStatusUpdate(data)` | SOP 步骤更新 |
| `onEnd(content)` | 流结束 |
| `shouldExtractCode()` | 代码提取门禁（PBL 阶段锁） |

### 关键机制

| 机制 | 说明 |
|------|------|
| MCP 工具名归一化 | ZeroClaw 推 `finestem__ask_question`，前端归一化为 `ask_question` |
| MCP 输出双层 JSON | `{"content":[{"type":"text","text":"<内层JSON>"}]}` → 解析出真实 data |
| 自动续接 | `finish_reason === 'length'` 时自动发续接请求，最多 2 次 |
| 空闲超时 | 30s 无新 chunk 判定卡死，返回 `stalled: true` |
| 代码提取门禁 | `shouldExtractCode()` 返回 false 时，不从文本兜底提取代码（PBL 阶段锁） |

---

## 开发命令

```bash
# 开发模式（端口 5184）
npm run dev

# 构建生产
npm run build

# 预览构建
npm run preview

# 代码检查
npm run lint

# 单元测试
npm test                    # Vitest

# E2E 测试
npx playwright test         # 全部
npx playwright test specs/smoke-test.spec.ts  # 单个
```

---

## 已知陷阱

| 陷阱 | 说明 |
|------|------|
| `Create.tsx` 有 3700+ 行 | 改动前先全局搜索定位目标函数，不要通读全文 |
| `useStreamingChat.ts.bak.*` 是备份 | 不要引用 |
| `questionParser.test.legacy.ts` 是旧测试 | 不要修改 |
| 工具名必须用 `normalizeToolName` | 直接比较 `=== 'ask_question'` 会失败（带 `finestem__` 前缀） |
| MCP 输出是双层 JSON | 不能直接 `JSON.parse(output)`，要用 `parseMcpOutput()` |
| ZeroClaw WS 地址硬编码 | `ws://127.0.0.1:42617/ws/chat`，非生产环境需注意 |
| `VITE_ZC_TOKEN` 必须配置 | ZeroClaw Bearer Token，否则 WS 连接失败 |

---
version: 2.0.0
created_at: 2026-04-23
last_updated: 2026-07-30
maintainer: AI Agent
