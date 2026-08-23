# fineSTEM — 青少年 STEM 研学助手

> 面向 12-18 岁青少年的 STEM 项目式学习（PBL）平台——AI 引导、过程驱动，从兴趣启蒙到成果展示一站式。

## 项目简介

fineSTEM 不是"编程平台"，而是**教学生怎么完成一个项目**的平台。核心能力：

- 🔍 **探索中心** — Demo 墙 + 灵感墙，先看见、先试玩、先理解
- ✨ **AI 工作台** — 与 AI 导师实时对话，在线代码编辑器，轻量/标准双项目模式
- 🔬 **研学流程** — 标准 9 阶段 PBL 引擎，阶段门禁，成果档案卡，证据采集
- 🎓 **成果展示** — 成果档案卡，分享链接，灵感墙发布

**双项目模式**：
- **轻项目**（30 分钟~2 小时）：3 步快速完成，随时可升级
- **标准研学**（6~12 小时+）：完整 9 阶段 PBL，产出档案卡 + 研学文档

---

## Agent 快速导航

> 接到模糊需求/bug 时，按此表定位代码与文档，避免全局搜索浪费 token。

### 按任务类型定位

| 你要做的事 | 先读这个 | 关键代码入口 |
|------------|----------|-------------|
| **理解整体架构** | 本文档 §技术架构 + [后端 README](./apps/backend/README.md) + [前端 README](./apps/frontend/README.md) | — |
| **改后端 API / 业务逻辑** | [后端 README](./apps/backend/README.md) | `apps/backend/app/api/` → `app/services/` → `app/repositories/` |
| **改前端页面 / 交互** | [前端 README](./apps/frontend/README.md) | `apps/frontend/src/pages/` → `src/components/` |
| **改 AI 对话流 / WebSocket** | [前端 README §核心链路](./apps/frontend/README.md#核心数据流) | `apps/frontend/src/hooks/useStreamingChat.ts` |
| **改 AI 工具（MCP）** | [后端 README §MCP 工具](./apps/backend/README.md#mcp-工具注册表15-个) | `apps/backend/app/services/tools.py` + `app/mcp_server/server.py` |
| **改 PBL 阶段 / 门禁逻辑** | [后端 README §PBL 引擎](./apps/backend/README.md#pbl-9-阶段引擎) | `apps/backend/app/services/stage_constants.py` + `pbl_engine.py` |
| **改数据库表结构** | [后端 README §数据架构](./apps/backend/README.md#数据架构) | `apps/backend/app/db/models.py` + `db/migrations/` |
| **改问题卡片解析** | [前端 README §问题卡片](./apps/frontend/README.md#问题卡片双重防线) | `apps/frontend/src/pages/Create.tsx`（`parseQuestionFromText` 函数） + `apps/backend/app/services/question_verifier.py` |
| **查已知 bug / 回归** | [问题清单](./.trae/documents/问题清单_长期维护.md) | Q-001 ~ Q-048 |
| **跑测试** | [后端测试 README](./apps/backend/tests/README.md) + [前端测试 README](./apps/frontend/tests/README.md) | `apps/backend/tests/` + `apps/frontend/tests/` |
| **查产品需求** | [产品与规划](./.trae/documents/产品与规划/) | `04_fineSTEM_BS平台产品方案_V3.3.md`（基础） + `05~12_MVP2` 系列（最新） |
| **查技术文档** | [技术与架构](./.trae/documents/技术与架构/) | `01-04` 四份核心文档 |
| **查 ZeroClaw 配置** | [ZeroClaw 技术知识库](./.trae/documents/技术与架构/ZeroClaw_技术知识库_v1.0.0.md) | `H:\dev-env\zeroclaw\config\config.toml` |

### 按用户自然语言定位（功能 ↔ URL ↔ 代码）

> 用户说"探索页" / "AI 工作台" / "项目列表" 时，直接查此表。

| 用户可能说的 | URL 路由 | 前端文件 | 后端 API | 说明 |
|-------------|---------|---------|---------|------|
| 首页/主页 | `/` | `Home.tsx` | — | 平台入口，展示核心功能快捷入口 |
| 探索/灵感墙/Demo墙 | `/explore` | `Explore.tsx` | `demos.py` / `achievement_cards.py` | Demo 墙 + 灵感墙 |
| Demo 详情/试玩/拆解 | `/explore/demos/:demoId` | `ExploreDemoDetail.tsx` | `demos.py` | Demo 试玩、拆解、Fork |
| 灵感/成果卡详情 | `/explore/inspiration/:cardId` | `AchievementDetail.tsx` | `achievement_cards.py` | 精选成果档案卡详情 |
| AI 工作台/创造/对话 | `/create` | `Create.tsx` | `chat.py` + `agent.py` | AI 对话 + 代码编辑器（核心页面，4500+ 行） |
| 研学/项目列表 | `/research` | `Research.tsx` | `projects.py` | 项目列表，进行中/已完成分组 |
| 项目详情/工作区 | `/research/projects/:id` | `ProjectDetail.tsx` | `projects.py` + `evidence.py` + `documents.py` | 项目详情、证据、文档查看 |
| 成果档案卡/生成 | `/research/projects/:projectId/achievement` | `ProjectAchievement.tsx` | `achievement_cards.py` | 成果档案卡生成与预览 |
| 项目编辑器 | `/projects/:id/edit` | `ProjectEditor.tsx` | `projects.py` | 独立项目编辑 |
| 登录 | `/login` | `Login.tsx` | `auth.py` | 登录，成功后跳 `/` |
| 注册 | `/register` | `Register.tsx` | `auth.py` | 注册，成功后跳 `/` |
| 个人中心/资料 | `/profile` | `UserProfile.tsx` | `auth.py` + `capability_tags.py` | 用户信息、能力雷达图 |
| 通知 | `/notifications` | `Notifications.tsx` | `notifications.py` | 通知列表 |
| 精选管理（管理员） | `/admin/featured` | `AdminFeatured.tsx` | `demos.py` + `achievement_cards.py` | 精选 Demo/灵感墙管理 |
| 分享/成果展示 | `/share/:token` | `SharedAchievement.tsx` | `achievement_cards.py` | 公开分享链接（无需登录） |
| 连接/Connect | `/connect` | `Connect.tsx` | — | 设备/服务连接页 |

### 按后端 API 路由定位

| API 前缀 | 路由文件 | 服务层 / 仓储层 | 功能 |
|----------|---------|----------------|------|
| `/api/v1/auth` | `app/api/auth.py` | `auth.py`(schema) + `user_repo.py` | 登录、注册、获取/更新当前用户 |
| `/api/v1/projects` | `app/api/projects.py` | `project_repo.py` | 项目 CRUD、workspace 获取/保存、阶段切换 |
| `/api/v1/demos` | `app/api/demos.py` | `demo_repo.py` | Demo 列表、详情、Fork |
| `/api/v1/achievement-cards` | `app/api/achievement_cards.py` | `achievement_repo.py` | 成果档案卡 CRUD、Fork 项目 |
| `/api/v1/evidence` | `app/api/evidence.py` | `evidence_repo.py` | 进度证据上传与查看 |
| `/api/v1/documents` | `app/api/documents.py` | `document_service.py` | 开题/技术/结题文档生成（Markdown/PDF） |
| `/api/v1/chat` | `app/api/chat.py` | — | 非流式对话接口（辅助） |
| `/api/v1/agent` | `app/api/agent.py` | — | Agent 状态查询 |
| `/api/v1/code` | `app/api/code_execution.py` | `code_sandbox.py` | 在线代码执行 |
| `/api/v1/skills` | `app/api/skills.py` | `skill_registry.py` + `skill_loader.py` | Skill 列表、详情 |
| `/api/v1/files` | `app/api/files.py` | `storage_service.py` | 文件上传/下载 |
| `/api/v1/courses` | `app/api/courses.py` | `course_repo.py` | 课程库 |
| `/api/v1/capability-tags` | `app/api/capability_tags.py` | — | 能力标签管理 |
| `/api/v1/notifications` | `app/api/notifications.py` | `notification_repo.py` | 通知 CRUD |
| `/api/v1/system` | `app/api/system.py` | — | 系统信息（健康检查等） |
| WebSocket | — | ZeroClaw :42617 | `ws://127.0.0.1:42617/ws/chat` AI 对话流 |

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器 (用户)                          │
│                   http://localhost:5184                       │
└──────────┬──────────────────────────────────┬────────────────┘
           │ HTTP REST (CRUD)                  │ WebSocket (AI 对话)
           ▼                                   ▼
┌─────────────────────┐              ┌─────────────────────────┐
│  后端 FastAPI :3200  │              │  ZeroClaw :42617         │
│  ┌─────────────────┐│              │  (Rust AI 底座)          │
│  │ 15 个 API 路由   ││              │  ┌───────────────────┐  │
│  │ projects/auth/  ││              │  │ Agent Loop         │  │
│  │ demos/evidence..││              │  │ (对话编排/工具调用) │  │
│  └────────┬────────┘│              │  └────────┬──────────┘  │
│           │          │              │           │ MCP stdio    │
│  ┌────────▼────────┐│              │  ┌────────▼───────────┐  │
│  │  SQLite 数据库   ││              │  │ finestem MCP Server│  │
│  │  9 张业务表      ││◄─────────────│  │ 15 个 PBL 工具     │  │
│  └─────────────────┘│   工具调用    │  └────────────────────┘  │
│  ┌─────────────────┐│              │  ┌────────────────────┐  │
│  │ 文件存储         ││              │  │ memory/brain.db    │  │
│  │ D:\data\finestem ││              │  │ (项目记忆 SQLite)  │  │
│  └─────────────────┘│              │  └────────────────────┘  │
└─────────────────────┘              └─────────────────────────┘
```

| 层 | 技术 | 端口 | 说明 |
|----|------|------|------|
| **前端** | React 18 + TypeScript + Vite + Tailwind CSS + Monaco Editor | `5184` | 用户界面，直连 ZeroClaw WS |
| **后端** | FastAPI + SQLAlchemy 2.0 + SQLite | `3200` | CRUD + MCP 工具服务，不参与 AI 编排 |
| **AI 底座** | [ZeroClaw](https://github.com/zeroclaw-labs/zeroclaw) v0.8.3（Rust 二进制）+ DeepSeek/GLM | `42617` | AI 编排（对话/工具调用/记忆）全部由 ZeroClaw 承担 |

> **架构要点**：前端直连 ZeroClaw WebSocket（`ws://127.0.0.1:42617/ws/chat`），AI 编排（对话/工具调用/记忆）全部由 ZeroClaw 承担。后端 FastAPI 仅负责 projects/evidence/documents 等 CRUD + 通过 MCP stdio 暴露 15 个 PBL 工具给 ZeroClaw 调用。后端 `orchestrator.py` 为退役死代码。

📖 详细架构文档：[`.trae/documents/技术与架构/`](./.trae/documents/技术与架构/)

---

## 快速开始

### 前置条件

- Python 3.12+
- Node.js 18+
- ZeroClaw v0.8.3（部署在 `H:\dev-env\zeroclaw\`）

### 一键启动

```bash
start_system.bat   # 启动 ZeroClaw daemon + 后端 + 前端
```

### 分步启动

1. **ZeroClaw daemon**（AI 底座）
```bash
H:\dev-env\zeroclaw\bin\zeroclaw.exe daemon
```

2. **后端**
```bash
cd apps/backend
pip install -r requirements.txt
python main.py          # 端口 3200
```

3. **前端**
```bash
cd apps/frontend
npm install
npm run dev             # 端口 5184
```

4. **访问**
- 应用：http://localhost:5184
- API 文档：http://localhost:3200/docs
- ZeroClaw 健康：http://127.0.0.1:42617/health

### 环境配置

复制 `.env.example` 为 `.env`，关键配置：
- `VITE_ZC_TOKEN`：ZeroClaw Bearer Token（运行 `zeroclaw` 后用 `POST /pair` 获取）
- `DATABASE_URL`：SQLite 路径（默认 `sqlite:///D:/data/finestem/finestem.db`）

---

## 后端代码地图

> 入口文件：`apps/backend/main.py`（FastAPI 应用初始化 + 路由注册 + 建表 + 每日备份）

| 目录 | 文件 | 职责 |
|------|------|------|
| `app/api/` | 15 个路由文件 | REST API 端点（见上方 API 路由表） |
| `app/services/` | `tools.py` | MCP 工具注册（15 个 PBL 工具） |
| | `pbl_engine.py` | PBL 9 阶段引擎 + 阶段门禁 |
| | `stage_constants.py` | 阶段常量定义（stage_01 ~ stage_08 + 轻项目 step_1~3） |
| | `question_verifier.py` | 问题卡片后端二次确认 |
| | `feature_flags.py` | 功能开关 |
| | `orchestrator.py` | ⚠️ 退役死代码，勿改 |
| | `code_sandbox.py` | 在线代码执行沙箱 |
| | `document_service.py` | 文档生成（开题/技术/结题） |
| | `demo_fork.py` | Demo Fork 服务 |
| | `skill_registry.py` / `skill_loader.py` | Skill 注册与加载 |
| | `storage_service.py` | 文件存储 |
| | `backup_service.py` | 数据库每日备份 |
| `app/repositories/` | 11 个 repo 文件 | 数据库 CRUD（project/user/demo/evidence/...） |
| `app/db/` | `models.py` | SQLAlchemy 模型（9 张业务表） |
| | `database.py` | 引擎 + Session + Base |
| `app/schemas/` | 11 个 schema 文件 | Pydantic 请求/响应模型 |
| `app/core/` | `config.py` | 配置项（端口/路径/开关） |
| `app/mcp_server/` | `server.py` | MCP stdio 服务入口（ZeroClaw 调用） |
| `app/skill_runners/` | `skill_runner.py` | Skill 运行器 |

---

## 前端代码地图

> 入口文件：`apps/frontend/src/App.tsx`（路由配置） + `apps/frontend/src/main.tsx`（React 挂载）

| 目录 | 文件 | 职责 |
|------|------|------|
| `src/pages/` | `Create.tsx` | **核心页面** AI 工作台（4500+ 行，含对话/编辑器/问题卡片） |
| | `Research.tsx` | 项目列表（进行中/已完成） |
| | `ProjectDetail.tsx` | 项目详情（证据/文档/编辑器） |
| | `Explore.tsx` / `ExploreDemos.tsx` / `ExploreDemoDetail.tsx` | 探索中心 |
| | `Home.tsx` | 首页 |
| | `Login.tsx` / `Register.tsx` | 认证 |
| | `AdminFeatured.tsx` | 精选管理 |
| | `Notifications.tsx` | 通知 |
| | 其余页面 | 见上方 URL 路由表 |
| `src/hooks/` | `useStreamingChat.ts` | WebSocket 流式对话（核心 Hook） |
| `src/components/` | `CodeEditor.tsx` | Monaco 代码编辑器 |
| | `QuestionCard.tsx` | 问题卡片组件 |
| | `MarkdownText.tsx` | Markdown 渲染 |
| | `LightProjectStep1~3.tsx` | 轻项目 3 步组件 |
| | `StandardProjectSteps.tsx` | 标准项目阶段步骤条 |
| | `EvidencePanel.tsx` | 证据面板 |
| | `AchievementCardView.tsx` | 成果档案卡视图 |
| | `NotificationBell.tsx` | 通知铃铛 |
| | `ErrorBoundary.tsx` | 错误边界 |
| `src/services/` | `api.ts` | 所有后端 API 调用封装 |
| | `apiError.ts` | API 错误处理 |
| | `toast.ts` | Toast 提示 |
| `src/types/` | `index.ts` | TypeScript 类型定义 |
| | `system.ts` | 系统类型 |

---

## 目录结构

```
fineSTEM/
├── apps/
│   ├── frontend/              # React 前端（端口 5184）→ 详见 apps/frontend/README.md
│   ├── backend/               # FastAPI 后端（端口 3200）→ 详见 apps/backend/README.md
│   └── public-web/            # 旧 MVP（docker-compose 用，非主开发栈）
├── .trae/
│   ├── skills/stem-pbl-guide/ # PBL 导师 AI 规范（SKILL.md + 8 个子 Skill）
│   │   └── skills/00~08_*.md  # 00_bootstrap → 08_evaluator（8 个阶段 Skill）
│   ├── documents/             # 产品与技术文档 → 详见 .trae/documents/README.md
│   │   ├── 产品与规划/        # 04_V3.3 产品方案 + 05~12_MVP2 系列文档
│   │   ├── 技术与架构/        # 01-04 核心架构 + ZeroClaw 集成
│   │   ├── testing/           # 测试计划/报告/prompt
│   │   ├── 问题清单_长期维护.md  # Q-001~Q-048 问题追踪（回归必检）
│   │   └── 术语与字典/        # 统一术语表
│   └── rules/                 # 项目规范
├── scripts/                   # 工具脚本（含 diag_truncation.py WS 诊断）
├── deploy/                    # 部署脚本与指南
└── start_system.bat           # 一键启动
```

---

## 生产环境（香港）

> 已部署上线：**https://wostemstudio.site**

| 项 | 值 |
|----|-----|
| 服务器 | 腾讯云轻量 Lighthouse 香港入门型 2核2G（¥38/月） |
| 域名 | wostemstudio.site（DNSPod，Let's Encrypt 免费 SSL） |
| AI 底座 | ZeroClaw v0.8.4（高峰切百炼 qwen / 夜间 DeepSeek） |
| 数据库 | SQLite WAL，605 用户 / 674 项目 |

- 部署文档：[香港生产环境部署文档](./.trae/documents/技术与架构/香港生产环境部署文档_v1.0.0.md)
- 决策记录：[ADR-001 香港部署方案](./.trae/documents/adr/ADR-001-hk-deployment.md)
- ZeroClaw 运维：[ZeroClaw 部署与运维指南](./.trae/documents/技术与架构/ZeroClaw部署与运维指南_v1.0.0.md)

---

## 技术文档索引

| 文档 | 说明 |
|------|------|
| [整体功能需求](./.trae/documents/技术与架构/01_整体功能需求.md) | 四大模块 + 9 阶段 PBL + MVP 范围 |
| [模块说明](./.trae/documents/技术与架构/02_模块说明.md) | 前后端各模块职责 + AI 主链路 |
| [技术架构](./.trae/documents/技术与架构/03_技术架构.md) | 技术栈 + 端口 + ZeroClaw 集成 |
| [数据结构和数据架构](./.trae/documents/技术与架构/04_数据结构和数据架构.md) | 数据库表 + workspace + 数据关系 |
| [香港生产环境部署文档](./.trae/documents/技术与架构/香港生产环境部署文档_v1.0.0.md) | **生产环境部署与运维（wostemstudio.site）** |
| [问题清单（长期维护）](./.trae/documents/问题清单_长期维护.md) | Q-001~Q-048 已知问题与修复（回归必检） |
| [ZeroClaw 技术知识库](./.trae/documents/技术与架构/ZeroClaw_技术知识库_v1.0.0.md) | AI 底座架构详解 |
| [ZeroClaw 部署与运维指南](./.trae/documents/技术与架构/ZeroClaw部署与运维指南_v1.0.0.md) | ZeroClaw 服务端部署与 Key 配置 |
| [MVP2 产品说明书](./.trae/documents/产品与规划/05_fineSTEM_MVP2_产品说明书_项目实验室与课程内容_V1.1.md) | MVP2 项目实验室与课程内容 |
| [MVP2 Create 任务引导](./.trae/documents/产品与规划/09_fineSTEM_MVP2_Create任务引导_功能与开发说明书_V1.0.md) | Create 任务引导功能说明 |
| [MVP2 模型策略切换](./.trae/documents/产品与规划/11_fineSTEM_MVP2_模型策略切换_测试计划_V1.0.md) | 模型策略切换测试方案 |

---

## 项目规范

遵循 `.trae/rules/project_rules.md`：
- API/JSON 用 camelCase，类名用 PascalCase
- 公共方法有中文文档，日志使用中文
- Conventional Commits 提交规范
- 研究 → 计划 → 实现 → 测试 开发流程

---

## 开发阶段

- ✅ **阶段 1**：平台搭建与规范确立
- ✅ **阶段 2**：MVP 功能开发（探索/Create/Research 闭环）
- ✅ **阶段 3**：ZeroClaw 集成 + PBL 9 阶段引擎
- 🔄 **阶段 4**：测试优化与稳定性（进行中）
- 🔄 **阶段 5**：MVP2 增强（Create 任务引导、模型策略切换、文档沉淀）

---
version: 4.0.0
created_at: 2026-04-23
last_updated: 2026-08-20
maintainer: AI Agent
