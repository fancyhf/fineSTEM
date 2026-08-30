# apps/ — 应用代码

> **目标读者**：开发 Agent、测试 Agent。从这里进入前后端代码。
> **导航**：后端 → [`backend/README.md`](./backend/README.md) ｜ 前端 → [`frontend/README.md`](./frontend/README.md)
> **根目录**：[← 返回根 README](../README.md)

## 目录

| 目录 | 技术栈 | 端口 | README | 说明 |
|------|--------|------|--------|------|
| `backend/` | FastAPI + SQLAlchemy + SQLite | `3200` | [→ README](./backend/README.md) | REST API（16 个路由） + MCP 工具服务（15 个工具暴露给 ZeroClaw） |
| `frontend/` | React 18 + TypeScript + Vite + Tailwind | `5184` | [→ README](./frontend/README.md) | 主站用户界面，直连 ZeroClaw WebSocket |
| `know/` | React 18 + TypeScript + Vite | `5185` | — | **Know 频道**前端（内容节目「与孩子对话」），生产 https://know.wostemstudio.site |
| `public-web/` | 旧 MVP（Docker） | — | — | 非主开发栈，可忽略 |

> `know/` 是**内容展示型**前端，不依赖 ZeroClaw、无用户态；
> 数据来自 `content/know` 内容库（content-as-code）经后端 `/api/v1/know` 只读接口暴露。

---

## 后端代码地图（`apps/backend/`）

> 入口：`apps/backend/main.py` — FastAPI 应用初始化 + 路由注册 + 启动建表 + 每日备份

### API 路由层（`app/api/`）

| 文件 | API 前缀 | 功能 | 关键服务/Repo |
|------|----------|------|-------------|
| `auth.py` | `/api/v1/auth` | 登录、注册、获取/更新当前用户 | `user_repo.py` |
| `projects.py` | `/api/v1/projects` | 项目 CRUD、workspace 获取/保存、阶段切换 | `project_repo.py` |
| `demos.py` | `/api/v1/demos` | Demo 列表、详情、Fork | `demo_repo.py` |
| `achievement_cards.py` | `/api/v1/achievement-cards` | 成果档案卡 CRUD、Fork 项目 | `achievement_repo.py` |
| `evidence.py` | `/api/v1/evidence` | 进度证据上传与查看 | `evidence_repo.py` |
| `documents.py` | `/api/v1/documents` | 开题/技术/结题文档生成 | `document_service.py` |
| `chat.py` | `/api/v1/chat` | 非流式对话接口（辅助） | — |
| `agent.py` | `/api/v1/agent` | Agent 状态查询 | — |
| `code_execution.py` | `/api/v1/code` | 在线代码执行 | `code_sandbox.py` |
| `skills.py` | `/api/v1/skills` | Skill 列表、详情 | `skill_registry.py` |
| `files.py` | `/api/v1/files` | 文件上传/下载 | `storage_service.py` |
| `courses.py` | `/api/v1/courses` + `/course-library` | 课程库 | `course_repo.py` |
| `capability_tags.py` | `/api/v1/capability-tags` | 能力标签管理 | — |
| `notifications.py` | `/api/v1/notifications` | 通知 CRUD | `notification_repo.py` |
| `system.py` | `/api/v1/system` | 系统信息 | — |
| `know.py` | `/api/v1/know` | **Know 频道**只读接口（内容节目） | `know_content.py` |

### 服务层（`app/services/`）

| 文件 | 职责 | 改动场景 |
|------|------|---------|
| `tools.py` | MCP 工具注册（15 个 PBL 工具） | 改 AI 工具行为 |
| `pbl_engine.py` | PBL 9 阶段引擎 + 阶段门禁 | 改阶段流转/门禁 |
| `stage_constants.py` | 阶段常量（stage_01~08 + step_1~3） | 改阶段定义/编号 |
| `question_verifier.py` | 问题卡片后端二次确认 | 改问题卡片验证 |
| `feature_flags.py` | 功能开关 | 开关功能 |
| `code_sandbox.py` | 代码执行沙箱 | 改代码执行 |
| `document_service.py` | 文档生成 | 改文档输出 |
| `demo_fork.py` | Demo Fork | 改 Fork 逻辑 |
| `skill_registry.py` / `skill_loader.py` | Skill 注册/加载 | 改 Skill 管理 |
| `skill_runtime.py` / `skill_policy.py` | Skill 运行/策略 | 改 Skill 调度 |
| `storage_service.py` | 文件存储 | 改文件路径 |
| `backup_service.py` | 数据库备份 | 改备份策略 |
| `observability.py` | 可观测性 | 改监控 |
| `know_content.py` | **Know 频道**内容服务（扫描 `content/know`，只读，无数据库） | 改 Know 内容读取 |
| `orchestrator.py` | ⚠️ **退役死代码，勿改** | — |

### 数据层

| 目录/文件 | 说明 |
|-----------|------|
| `app/db/models.py` | SQLAlchemy 模型（9 张业务表） |
| `app/db/database.py` | 引擎 + Session + Base |
| `app/repositories/` | 11 个 repo 文件（project/user/demo/evidence/notification/achievement/course/skill_record/runtime/...） |
| `app/schemas/` | 11 个 Pydantic schema 文件 |
| `app/core/config.py` | 配置项（端口/路径/开关） |

### MCP 工具

| 文件 | 说明 |
|------|------|
| `app/mcp_server/server.py` | MCP stdio 服务入口（ZeroClaw 调用） |
| `app/services/tools.py` | 15 个 PBL 工具注册 |

---

## 前端代码地图（`apps/frontend/`）

> 入口：`src/App.tsx`（路由） + `src/main.tsx`（React 挂载）

### 页面层（`src/pages/`）

| 文件 | URL | 功能 | 行数 |
|------|-----|------|------|
| `Create.tsx` | `/create` | **核心页面** AI 工作台（对话/编辑器/问题卡片） | 4500+ |
| `Research.tsx` | `/research` | 项目列表（进行中/已完成分组） | ~450 |
| `ProjectDetail.tsx` | `/research/projects/:id` | 项目详情（证据/文档/编辑器） | ~500 |
| `Explore.tsx` | `/explore` | 探索中心入口 | ~200 |
| `ExploreDemos.tsx` | `/explore/demos` | Demo 列表 | ~150 |
| `ExploreDemoDetail.tsx` | `/explore/demos/:demoId` | Demo 详情/试玩/拆解 | ~350 |
| `Home.tsx` | `/` | 首页 | ~100 |
| `Login.tsx` | `/login` | 登录 | ~60 |
| `Register.tsx` | `/register` | 注册 | ~80 |
| `UserProfile.tsx` | `/profile` | 个人中心/能力雷达 | ~200 |
| `ProjectAchievement.tsx` | `/research/projects/:id/achievement` | 成果档案卡 | ~200 |
| `ProjectEditor.tsx` | `/projects/:id/edit` | 项目编辑器 | ~150 |
| `AdminFeatured.tsx` | `/admin/featured` | 精选管理（管理员） | ~250 |
| `Notifications.tsx` | `/notifications` | 通知列表 | ~100 |
| `AchievementDetail.tsx` | `/explore/inspiration/:cardId` | 灵感墙卡片详情 | ~100 |
| `SharedAchievement.tsx` | `/share/:token` | 公开分享（无需登录） | ~100 |
| `Connect.tsx` | `/connect` | 连接/设备页 | ~50 |

### Hooks / 组件 / 服务

| 目录 | 关键文件 | 说明 |
|------|---------|------|
| `src/hooks/` | `useStreamingChat.ts` | WebSocket 流式对话核心 Hook |
| `src/components/` | `CodeEditor.tsx` | Monaco 代码编辑器 |
| | `QuestionCard.tsx` | 问题卡片（AI 多选/确认交互） |
| | `MarkdownText.tsx` | Markdown 渲染 |
| | `LightProjectStep1~3.tsx` | 轻项目 3 步组件 |
| | `StandardProjectSteps.tsx` | 标准项目阶段步骤条 |
| | `EvidencePanel.tsx` | 证据面板 |
| | `AchievementCardView.tsx` | 成果档案卡视图 |
| | `NotificationBell.tsx` | 通知铃铛 |
| | `ErrorBoundary.tsx` | 错误边界 |
| `src/services/` | `api.ts` | 所有后端 API 调用封装（authApi/projectsApi/demosApi/...） |
| | `apiError.ts` | API 错误处理 |
| | `toast.ts` | Toast 提示 |
| `src/types/` | `index.ts` | TypeScript 类型定义 |
| | `system.ts` | 系统类型 |

---

## 架构关系

```
浏览器 ──HTTP REST──→ backend:3200 (CRUD + MCP 工具)
       └─WebSocket──→ ZeroClaw:42617 (AI 编排)
                         └─MCP stdio──→ backend/mcp_server (15 个 PBL 工具)
```

> 后端不参与 AI 编排（`orchestrator.py` 是退役死代码）。AI 对话/工具调用/记忆全由 ZeroClaw 承担。

## 开发规范

遵循 `.trae/rules/project_rules.md`：
- API/JSON 用 camelCase，类名用 PascalCase
- 公共方法有中文文档，日志使用中文
- Conventional Commits 提交规范

## 快速开始

```bash
# 后端
cd apps/backend && pip install -r requirements.txt && python main.py

# 主站前端
cd apps/frontend && npm install && npm run dev

# Know 频道前端（内容节目）
cd apps/know && npm install && npm run dev

# 内容校验（发布新节目/新集前必做）
npm run validate:content
```

---
version: 3.1.0
created_at: 2026-04-23
last_updated: 2026-08-30
maintainer: AI Agent
