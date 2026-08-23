# fineSTEM 后端 — 开发与测试 Agent 代码导航

> **目标读者**：开发 Agent、测试 Agent。接到模糊需求/bug 时，从这里快速定位代码。
> **使用方式**：先看 §代码定位速查表 找到目标文件，再读对应模块说明。

---

## 代码定位速查表

| 需求 / Bug 关键词 | 去这里 | 具体文件 |
|-------------------|--------|----------|
| 项目 CRUD / 工作区 / 导出 | `app/api/projects.py` | 路由 + `export_project_to_disk()` |
| 用户注册 / 登录 / JWT | `app/api/auth.py` | `get_current_user()` 依赖 |
| Demo 墙 / 灵感墙数据 | `app/api/demos.py` | |
| 成果档案卡 / 分享 / 精选 | `app/api/achievement_cards.py` | |
| 证据采集 / 上传 | `app/api/evidence.py` | |
| 聊天历史落库 | `app/api/chat.py` | |
| 课程库 | `app/api/courses.py` | |
| 文件上传 / 下载 | `app/api/files.py` | |
| 代码执行沙箱 | `app/api/code_execution.py` + `app/services/code_sandbox.py` | |
| 能力标签 | `app/api/capability_tags.py` | |
| 系统健康 / 版本 | `app/api/system.py` | |
| **AI 工具（MCP）** | `app/services/tools.py` | `TOOL_REGISTRY`（15 个工具） |
| **PBL 阶段 / 门禁** | `app/services/stage_constants.py` → `pbl_engine.py` | 常量单一来源 → 引擎逻辑 |
| **问题卡片后端校验** | `app/services/question_verifier.py` | 纯规则，无 LLM |
| **ZeroClaw 记忆** | `app/services/zeroclaw_memory.py` | 直读 `brain.db` |
| MCP Server 协议 | `app/mcp_server/server.py` | JSON-RPC stdio |
| 数据库表定义 | `app/db/models.py` | 9 张表 |
| 数据库连接 / Session | `app/db/database.py` | SQLAlchemy engine |
| 运行时内存数据库（旧） | `app/repositories/runtime_db.py` | 兼容层 |
| 配置 / 环境变量 | `app/core/config.py` | `Settings` 类 |
| 数据库备份 | `app/services/backup_service.py` | 每日自动备份 |
| 截图服务 | `app/services/screenshot_service.py` | |
| 文档服务 | `app/services/document_service.py` | 项目文档生成 |
| 图片生成 | `app/services/providers/image_provider.py` | AI 封面图 |
| LLM Provider（旧） | `app/services/providers/zeroclaw_provider.py` | 直连 LLM API，现由 ZeroClaw 替代 |
| ❌ 退役死代码 | `app/services/orchestrator.py` | **勿改，勿用** |

---

## 技术栈

- **框架**: FastAPI (Python 3.12+), 端口 `3200`
- **ORM**: SQLAlchemy 2.0 + SQLite
- **迁移**: Alembic
- **配置**: pydantic-settings (`.env` 文件)
- **MCP**: 原生 JSON-RPC 2.0 over stdio（不引入第三方 MCP 库）

---

## 目录结构（按调用链排列）

```
app/
├── main.py                  # FastAPI 入口：注册 14 路由 + 静态目录 + 备份定时任务
├── core/
│   ├── config.py            # Settings 类：所有配置项的唯一来源
│   └── time_utils.py        # UTC 时间工具（全项目统一用这个，勿直接调 datetime.now）
├── api/                     # 路由层（14 个 router，统一前缀 /api/v1）
│   ├── auth.py              # /auth — 注册/登录/JWT/用户信息
│   ├── projects.py          # /projects — 项目 CRUD/工作区/导出/代码保存（最大的路由文件）
│   ├── demos.py             # /demos — Demo 墙展示
│   ├── achievement_cards.py # /achievement-cards — 成果卡/分享/精选
│   ├── evidence.py          # /evidence — 证据采集
│   ├── chat.py              # /chat — 聊天历史落库
│   ├── documents.py         # /documents — 项目文档
│   ├── files.py             # /files — 文件上传下载
│   ├── courses.py           # /courses + /course-library — 课程库
│   ├── skills.py            # /skills — Skill 管理
│   ├── agent.py             # /agent — Agent 配置/灰度
│   ├── code_execution.py    # /code-execution — 代码执行
│   ├── capability_tags.py   # /capability-tags — 能力标签
│   └── system.py            # /system — 健康检查/版本
├── services/                # 业务逻辑层
│   ├── tools.py             # ★ MCP 工具注册表（15 个工具，ZeroClaw 调用入口）
│   ├── stage_constants.py   # ★ PBL 阶段常量（单一事实来源，勿在别处重复定义）
│   ├── pbl_engine.py        # ★ PBL 引擎：门禁校验/阶段推进/工件落盘
│   ├── question_verifier.py # ★ 问题卡片后端二次校验（Q-003 修复，纯规则）
│   ├── zeroclaw_memory.py   # ★ ZeroClaw brain.db 直接读写（跨 session 记忆）
│   ├── mcp_server/          # MCP Server（实际在 app/mcp_server/，见下方）
│   ├── code_sandbox.py      # 代码沙箱执行
│   ├── sandbox_executor.py  # 沙箱执行器
│   ├── backup_service.py    # 数据库自动备份
│   ├── document_service.py  # 项目文档生成
│   ├── storage_service.py   # 文件存储服务
│   ├── screenshot_service.py # 截图服务
│   ├── stage08_sync.py      # stage_08 验收数据同步
│   ├── feature_flags.py     # 灰度开关
│   ├── observability.py     # 可观测性
│   ├── skill_loader.py      # Skill 加载器
│   ├── skill_registry.py    # Skill 注册表
│   ├── skill_policy.py      # Skill 安全策略
│   ├── skill_runtime.py     # Skill 运行时
│   ├── orchestrator.py      # ❌ 退役死代码（ZeroClaw 已接管 AI 编排）
│   └── providers/
│       ├── zeroclaw_provider.py  # LLM Provider（旧，ZeroClaw 已替代）
│       └── image_provider.py     # AI 封面图生成
├── mcp_server/
│   └── server.py            # ★ MCP 1.0 stdio server：把 tools.py 的工具暴露给 ZeroClaw
├── db/
│   ├── models.py            # ★ 9 张 ORM 表定义
│   ├── database.py          # SQLAlchemy engine + SessionLocal
│   ├── sqlite_db.py         # SQLite 专用工具
│   ├── memory.py            # 内存数据库（旧，已被 SQLite 替代）
│   └── migrations/          # Alembic 迁移脚本
│       └── versions/        # 5 个迁移版本
├── repositories/            # 数据访问层（每个实体一个 repo）
│   ├── project_repo.py      # 项目数据访问
│   ├── user_repo.py         # 用户数据访问
│   ├── demo_repo.py         # Demo 数据访问
│   ├── achievement_repo.py  # 成果卡数据访问
│   ├── evidence_repo.py     # 证据数据访问
│   ├── course_repo.py       # 课程数据访问
│   ├── skill_record_repo.py # Skill 记录数据访问
│   ├── runtime_db.py        # ★ 运行时内存数据库（兼容层，部分工具仍用它）
│   ├── base.py              # Repository 基类
│   └── utils.py             # 仓储工具函数
├── schemas/                 # Pydantic 请求/响应模型
│   ├── projects.py          # 项目相关 Schema（最大的）
│   ├── auth.py              # 认证 Schema
│   ├── demos.py             # Demo Schema
│   ├── achievements.py      # 成果卡 Schema
│   ├── evidence.py          # 证据 Schema
│   ├── documents.py         # 文档 Schema
│   ├── skills.py            # Skill Schema
│   ├── agent.py             # Agent Schema
│   ├── course_library.py    # 课程库 Schema
│   └── common.py            # 通用响应包装（ApiResponse/PaginationResult）
└── skill_runners/
    └── skill_runner.py      # Skill 执行器
```

---

## 数据架构

### 数据库表（SQLite，`app/db/models.py`）

| 表名 | ORM 类 | 说明 | 关键字段 |
|------|--------|------|----------|
| `users` | `UserModel` | 用户账号 | `id`, `email`, `password`(hashed), `role`(student/admin), `level`, `capability_tags`(JSON) |
| `demos` | `DemoModel` | Demo 墙展示项目 | `id`, `name`, `tech_stack`(JSON), `difficulty`, `iframe_url`, `code_url` |
| `projects` | `ProjectModel` | 用户研学项目 | `id`, `author_id`→users, `name`, `mode`(light/standard), `current_stage`, `from_demo_id`→demos |
| `skill_states` | `SkillStateModel` | PBL 状态（每项目一行） | `project_id`→projects, `mode`, `current_stage`, `stages`(JSON), `standard_step_data`(JSON) |
| `achievement_cards` | `AchievementCardModel` | 成果档案卡 | `id`, `project_id`→projects, `title`, `share_token`, `is_public`, `is_featured` |
| `evidence` | `EvidenceModel` | 证据采集 | `id`, `project_id`→projects, `type`, `title`, `content` |
| `courses` | `CourseModel` | 课程库 | `id`, `owner_id`→users, `title`, `subject`, `difficulty` |
| `project_capability_tags` | `ProjectCapabilityTagModel` | 项目能力标签 | `project_id`→projects, `tags`(JSON) |
| `skill_records` | `SkillRecordModel` | 已安装 Skill | `id`, `owner_id`→users, `source`, `status`, `manifest`(JSON) |

### 表关系

```
users (1) ──< projects (N)
users (1) ──< achievement_cards (N)
users (1) ──< evidence (N)
users (1) ──< courses (N)
users (1) ──< skill_records (N)

projects (1) ──(1) skill_states        # 1:1，PBL 状态
projects (1) ──(1) achievement_cards    # 1:1，成果卡（完成后才有）
projects (1) ──< evidence (N)           # 1:N，证据
projects (1) ──(1) project_capability_tags  # 1:1
demos (1) ──< projects (N)              # demo → fork 出项目
```

### 数据存储路径

| 存储 | 路径 | 配置项 |
|------|------|--------|
| SQLite 数据库 | `D:/data/finestem/finestem.db` | `DATABASE_URL` |
| 用户上传文件 | `D:/data/finestem/uploads/` | `STORAGE_BASE_PATH` + `STORAGE_UPLOAD_DIR` |
| AI 生成图片 | `D:/data/finestem/generated/` | `STORAGE_BASE_PATH` + `generated/` |
| 导出资料包 | 项目根 `out/` | `AUTO_EXPORT_DIR` |
| 数据库备份 | `D:/data/finestem/backups/` | `BACKUP_DIR` |
| ZeroClaw 记忆 | `H:/dev-env/zeroclaw/config/data/memory/brain.db` | `ZEROCLAW_DATA_DIR` |

### 数据流（一次完整 PBL 对话）

```
用户在浏览器输入消息
  → 前端 useStreamingChat.ts 发送到 ZeroClaw WS (ws://127.0.0.1:42617/ws/chat)
  → ZeroClaw Agent Loop 决策：直接回复 OR 调用 MCP 工具
  → 若调用工具：ZeroClaw → MCP stdio → app/mcp_server/server.py → app/services/tools.py
    → tools.py 调用 pbl_engine / repositories / zeroclaw_memory
    → 工具返回 JSON → MCP server → ZeroClaw → 前端
  → ZeroClaw 流式返回文本 + tool_call/tool_result 事件 → 前端渲染
  → 前端按需调用后端 REST API（保存代码/聊天历史等）
```

---

## MCP 工具注册表（15 个）

> 定义在 `app/services/tools.py` 的 `TOOL_REGISTRY`，通过 `app/mcp_server/server.py` 暴露给 ZeroClaw。
> ZeroClaw 调用时工具名带 `finestem__` 前缀（如 `finestem__ask_question`），前端会归一化。

| 工具名 | 类 | 说明 |
|--------|-----|------|
| `skill_state_reader` | `SkillStateReaderTool` | 读取项目 PBL 状态（阶段/工件/步骤数据） |
| `ask_question` | `AskQuestionTool` | ★ AI 向学生提问（生成选项卡片） |
| `skill_state_writer` | `SkillStateWriterTool` | 写入项目 PBL 状态 |
| `stage_advancer` | `StageAdvancerTool` | ★ 推进 PBL 阶段（带门禁校验） |
| `artifact_reader` | `ArtifactReaderTool` | 读取阶段工件（brainstorm/brief/design...） |
| `artifact_writer` | `ArtifactWriterTool` | ★ 保存阶段工件（触发门禁检查） |
| `evidence_saver` | `EvidenceSaverTool` | 保存证据 |
| `code_runner` | `CodeRunnerTool` | 运行学生代码 |
| `project_code_writer` | `ProjectCodeWriterTool` | ★ 写入学生项目代码文件 |
| `resource_searcher` | `ResourceSearcherTool` | 搜索学习资源 |
| `project_creator` | `ProjectCreatorTool` | 创建项目 |
| `achievement_card` | `AchievementCardTool` | ★ 生成成果档案卡 |
| `project_memory_store` | `ProjectMemoryStoreTool` | ★ 存储项目记忆（→ ZeroClaw brain.db） |
| `project_memory_recall` | `ProjectMemoryRecallTool` | ★ 回忆项目记忆（← ZeroClaw brain.db） |
| `sop_state_sync` | `SopStateSyncTool` | SOP 状态同步 |

> ★ = 高频调用，改这些要特别小心回归。

---

## PBL 9 阶段引擎

### 阶段定义（`app/services/stage_constants.py` — 单一事实来源）

| 索引 | 阶段 ID | 工件名 | 落盘文件 | 允许代码 |
|------|---------|--------|----------|----------|
| 0 | `stage_00_bootstrap` | — | — | ❌ |
| 1 | `stage_01_brainstorm` | `brainstorm` | `00_brainstorm.md` | ❌ |
| 2 | `stage_02_brief` | `project_brief` | `01_project_brief.md` | ❌ |
| 3 | `stage_03_constraints` | `constraints` | `02_constraints.md` | ❌ |
| 4 | `stage_04_track` | `track_plan` | `03_track_plan.md` | ❌ |
| 5 | `stage_05_design` | `design` | `04_design.md` | ✅ 代码框架 |
| 6 | `stage_06_step_plan` | `step_plan` | `05_step_plan.md` | ❌ |
| 7 | `stage_07_execute` | `dev_log` | `06_dev_log.md` | ✅ 正式开发 |
| 8 | `stage_08_evaluate` | `evaluate` | `07_evaluation.md` | ✅ 修订验收 |

### 核心逻辑（`app/services/pbl_engine.py`）

| 函数 | 说明 |
|------|------|
| `check_gate(stage, standard_step_data)` | 检查阶段门禁：工件是否存在/非空 |
| `advance_with_gate(project_id, target_stage)` | 带门禁校验的阶段推进（推进只能向前） |
| `save_artifact(project_id, artifact_name, content)` | 保存工件到 `standard_step_data` + 落盘到项目目录 |

### 轻项目 3 步

```
step_1 → step_2 → step_3  （可升级为 standard）
```

---

## API 路由总览

> 统一前缀 `/api/v1`，响应包装 `{code, message, data}`，字段 camelCase。

| 路由前缀 | 文件 | 主要功能 |
|----------|------|----------|
| `/auth` | `auth.py` | 注册/登录/改密/用户信息 |
| `/projects` | `projects.py` | 项目 CRUD/工作区/代码保存/聊天保存/导出/升级 |
| `/demos` | `demos.py` | Demo 列表/详情/fork |
| `/achievement-cards` | `achievement_cards.py` | 成果卡 CRUD/分享/精选管理 |
| `/evidence` | `evidence.py` | 证据 CRUD/自动采集 |
| `/chat` | `chat.py` | 聊天历史保存/读取 |
| `/documents` | `documents.py` | 项目文档 CRUD |
| `/files` | `files.py` | 文件上传/下载 |
| `/courses` + `/course-library` | `courses.py` | 课程库 CRUD |
| `/skills` | `skills.py` | Skill 安装/列表/删除 |
| `/agent` | `agent.py` | Agent 配置/灰度/指标 |
| `/code-execution` | `code_execution.py` | 代码执行 |
| `/capability-tags` | `capability_tags.py` | 能力标签建议 |
| `/system` | `system.py` | 健康检查/版本信息 |

---

## 配置项速查（`app/core/config.py`）

> **LLM API Key 唯一设置点：`apps/backend/.env`**（`GLM_API_KEY` / `DEEPSEEK_API_KEY`，
> 旧命名 `glm_key` / `deepseek_key` 自动映射兼容）。根目录 `.env`、前端 `.env*`、
> 脚本里都不放模型 key；AI 聊天主链路的模型 key 在 ZeroClaw daemon 的
> config.toml（keyring 加密）。自检：`python scripts/check_llm_keys.py --live`。

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `BACKEND_PORT` | `3200` | 后端端口 |
| `DATABASE_URL` | `sqlite:///D:/data/finestem/finestem.db` | 数据库路径 |
| `STORAGE_BASE_PATH` | `D:\data\finestem` | 文件存储根目录 |
| `GLM_API_KEY` | `None` | 智谱 GLM key（截图识别/封面图/GLM 直连） |
| `DEEPSEEK_API_KEY` | `None` | DeepSeek key（直连回退链路） |
| `ZEROCLAW_GATEWAY_URL` | `None`（自动推断） | LLM Gateway URL |
| `ZEROCLAW_API_KEY` | `None`（由上两个 key 顺延） | 直连回退链路用 LLM API Key |
| `ZEROCLAW_MAX_TOKENS` | `16384` | 最大 token 数 |
| `ZEROCLAW_TIMEOUT_SECONDS` | `120` | 超时秒数 |
| `BACKUP_ENABLED` | `True` | 数据库自动备份 |
| `BACKUP_HOUR` | `3` | 每日备份时间 |
| `AUTO_EXPORT_ON_COMPLETE` | `True` | 项目完成自动导出 |
| `SECRET_KEY` | `dev-secret-key`（DEBUG） | JWT 密钥（生产必须覆盖） |

---

## 开发命令

```bash
# 启动开发服务
python main.py                    # 端口 3200，热重载

# 执行数据库迁移
python -m alembic upgrade head

# API 文档
http://localhost:3200/docs        # Swagger UI
http://localhost:3200/redoc       # ReDoc

# 运行测试
pytest                            # 全部
pytest tests/test_pbl_engine.py   # 单个文件
pytest -k "stage"                 # 按关键词
```

---

## 已知陷阱

| 陷阱 | 说明 |
|------|------|
| `orchestrator.py` 是退役死代码 | ZeroClaw 已接管 AI 编排，不要修改也不要引用 |
| `runtime_db.py` 是兼容层 | 部分旧工具仍用内存数据库，新代码应该用 repositories + SQLAlchemy |
| `memory.py` 是旧内存数据库 | 已被 SQLite 替代，不要新增使用 |
| `tools.py.bak.*` 是备份文件 | 不要引用，可能是旧版本 |
| MCP 工具名带 `finestem__` 前缀 | ZeroClaw 按 MCP server name 加前缀，前端用 `normalizeToolName` 去除 |
| `stage_constants.py` 是单一事实来源 | 不要在 `tools.py`/`pbl_engine.py`/`project_repo.py` 重复定义阶段常量 |

---
version: 2.0.0
created_at: 2026-04-23
last_updated: 2026-07-30
maintainer: AI Agent
