# fineSTEM V3.3 全量开发计划：从当前状态到完整产品

**版本**: v1.0
**日期**: 2026-04-25
**状态**: 计划
**遵循规范**: `g:\mediaProjects\fineSTEM\.trae\rules\project_rules.md`
**产品规格**: `04_fineSTEM_BS平台产品方案_V3.3.md` 及其附件
**替代说明**: 本文档整合并替代 `phase2_development_plan.md`、`二期开发计划_v2.1`、`phase3_plus_development_plan.md`，作为唯一执行口径

---

## 0. 当前状态评估

### 0.1 已完成功能

| 模块 | 功能 | 完成度 |
|------|------|--------|
| 用户认证 | 注册/登录/JWT | 100% |
| Demo 墙 | 列表/筛选/分页/详情 | 80%（缺试玩/拆解按钮） |
| Demo Fork | "我也做一个"创建项目 | 70%（无最小可改版模板） |
| 轻项目 3 步 | Step1/2/3 完整流程 | 90% |
| 标准研学数据层 | 9 阶段 SKILL_STATE + API | 80%（UI 仅最小 textarea） |
| 成果档案卡 | 创建/展示/分享/灵感墙发布 | 85%（缺下一步推荐） |
| AI 对话 | Agent 编排层 + HTTP 对话 | 70%（未接入 WebSocket 流式） |
| Skill 市场 | 4 个内置 Skill + 安装/启停 | 60%（前端展示不完整） |
| 项目下载 | MD/JSON 导出 | 50%（无 zip 打包） |

### 0.2 核心差距（对比 V3.3 产品规格）

| 差距 | 严重度 | 说明 |
|------|--------|------|
| 数据库仍为内存 | P0 | 重启数据丢失，无法生产使用 |
| Research.tsx 未接入 API | P0 | 项目列表页硬编码占位 |
| 前后端 Schema 不一致 | P0 | Demo/AchievementCard 字段偏差 |
| 无文件存储服务 | P0 | 截图/附件无法上传 |
| Demo 缺试玩/拆解 | P1 | 卡片只有 2 个按钮，缺 4 个 |
| 无在线代码编辑器 | P1 | Monaco + WebContainer 缺失 |
| 标准 9 阶段 UI 不完整 | P1 | 仅 textarea，无结构化表单 |
| 无研学文档生成/导出 | P1 | 开题/技术/结题报告缺失 |
| 无自动证据采集 | P1 | 阶段变更/AI 摘要未自动记录 |
| 无课程库 | P2 | 后端 API 和前端页面均缺失 |
| 无能力标签体系 | P2 | AI 生成能力标签缺失 |
| 无 CI/CD | P1 | 无自动化质量保障 |

### 0.3 MVP 核心闭环验证状态

```
Demo 墙 -> Demo 详情 -> "我也做一个" Fork -> 轻项目 3 步 -> 成果档案卡 -> 分享链接
   ✓          ✓              ✓                    ✓              ✓           ✓
```

**主闭环已基本打通**，但存在技术债影响稳定性。

---

## 1. 开发阶段总览

### 1.1 阶段划分

| 阶段 | 名称 | 核心目标 | 预估周期 |
|------|------|---------|---------|
| Phase A | 技术债修复 + 基础加固 | 修复 P0 技术债，数据库持久化，文件存储 | 2 周 |
| Phase B | 学生主闭环强化 | Demo 4 动作、Fork 模板、Research 接入、标准研学 UI | 2 周 |
| Phase C | AI 能力 + 代码编辑器 | WebSocket 流式、Monaco 编辑器、WebContainer | 2 周 |
| Phase D | 研学引擎 + 成果闭环 | 文档生成导出、证据采集、灵感墙完整版 | 2 周 |
| Phase E | 完整体验 + 互联 | 课程库、能力标签、Skill 市场完善、CI/CD | 2 周 |
| Phase F | 生态与增长 | UGC 社区、媒体闭环、推荐算法等 | 持续迭代 |

### 1.2 依赖关系

```
Phase A (技术债+基础)
  ├── Phase B (主闭环强化) ── 依赖 A
  ├── Phase C (AI+编辑器) ── 依赖 A
  └── Phase D (研学引擎) ── 依赖 A + B
        └── Phase E (完整体验) ── 依赖 B + C + D
              └── Phase F (生态) ── 依赖 E
```

### 1.3 可并行策略

- Phase A 完成后，Phase B 和 Phase C 可并行启动
- Phase D 依赖 Phase B 的标准研学 UI 基础
- Phase E 需要等 B/C/D 均完成

---

## 2. Phase A：技术债修复 + 基础加固（2 周）

### Step A.0：前后端 Schema 对齐与安全修复

**目标**：修复所有 P0 技术债，确保核心 API 稳定可用。

**后端改动**：

1. **成果档案卡 Schema 对齐到 V3.3**
   - 文件：`apps/backend/app/schemas/achievements.py`
   - 统一字段：`title`、`oneLiner`、`problemSolved`、`methodUsed`、`screenshots`、`reflection`、`capabilityTags`、`projectMode`
   - 前端 `AchievementCardView.tsx` 同步更新

2. **Demo Schema 对齐**
   - 文件：`apps/backend/app/schemas/demos.py`
   - `tech_stack` 改为 `string[]`（前端已用数组）
   - `display_mode` 枚举值统一为 `"iframe"` | `"static"`

3. **MemoryDatabase 方法补全**
   - 文件：`apps/backend/app/db/memory.py`
   - 补齐：`list_projects`、`count_projects`、`advance_skill_state`、`count_evidence`、`update_evidence`
   - 修正：`update_skill_state` 参数签名、`delete_project` 的 `deleted_by` 处理

4. **安全修复**
   - `SECRET_KEY` 改为环境变量读取
   - 补充 `.env.example`

**验收标准**：
- [ ] 注册/登录/鉴权可用
- [ ] Demo 列表筛选和搜索可用
- [ ] "我也做一个"可创建项目
- [ ] 轻项目 3 步可保存
- [ ] 成果档案卡可创建并分享
- [ ] 关键 API 无缺失方法异常

### Step A.1：数据库持久化迁移

**目标**：将内存数据库迁移到 SQLAlchemy ORM + SQLite/PostgreSQL，确保数据不丢失。

**后端新增文件**：

```
apps/backend/
├── app/
│   ├── db/
│   │   ├── database.py          # SQLAlchemy 引擎与 Session
│   │   ├── models.py            # ORM 模型定义
│   │   ├── memory.py            # 保留：作为测试 Mock
│   │   └── migrations/          # Alembic 迁移脚本
│   │       ├── env.py
│   │       └── versions/
│   ├── repositories/            # 数据访问层
│   │   ├── base.py
│   │   ├── user_repo.py
│   │   ├── demo_repo.py
│   │   ├── project_repo.py
│   │   ├── achievement_repo.py
│   │   └── evidence_repo.py
│   └── services/                # 业务逻辑层
│       ├── auth_service.py
│       ├── demo_service.py
│       ├── project_service.py
│       ├── achievement_service.py
│       └── evidence_service.py
├── alembic.ini
└── requirements.txt             # 添加 sqlalchemy/alembic/aiosqlite
```

**ORM 模型映射**：

| Schema 模型 | ORM 模型 | 表名 |
|-------------|---------|------|
| User | UserModel | users |
| Demo | DemoModel | demos |
| Project | ProjectModel | projects |
| SkillState | SkillStateModel | skill_states |
| AchievementCard | AchievementCardModel | achievement_cards |
| Evidence | EvidenceModel | evidence |
| TaskRecord | TaskRecordModel | task_records |

**分层重构**：`controller(api) -> service -> repository -> model(ORM) -> infra(database)`

**审计字段统一**：所有 ORM 模型继承 `AuditFields` mixin（`created_at`、`created_by`、`updated_at`、`updated_by`、`deleted_at`、`deleted_by`、`is_deleted`）

**数据库路径**：开发环境 `D:\data\finestem\finestem.db`，生产环境 PostgreSQL

**验收标准**：
- [ ] 所有现有 API 端点功能不变
- [ ] 数据重启后不丢失
- [ ] Alembic 迁移脚本可执行
- [ ] 开发环境 SQLite，生产环境可切换 PostgreSQL

### Step A.2：文件存储服务

**目标**：建立统一的文件存储抽象层，支持截图/附件/项目包的存储。

**后端新增文件**：

```
apps/backend/app/
├── api/
│   └── files.py                 # 文件上传/下载 API
├── services/
│   └── storage_service.py       # 存储抽象层
└── core/
    └── config.py                # 更新：添加存储配置
```

**API 端点**：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/files/upload` | 上传文件（multipart/form-data） |
| GET | `/api/v1/files/{fileId}` | 获取文件 |
| DELETE | `/api/v1/files/{fileId}` | 删除文件 |

**存储策略**：
- 开发环境：本地磁盘 `D:\data\finestem\uploads\`
- 生产环境：对象存储（S3/MinIO）或本地磁盘
- 统一通过 `FileStorageService` 抽象层访问

**文件目录结构**：

```
D:\data\finestem\
├── packages\              # 项目包下载
├── uploads\               # 用户上传文件
│   └── {projectId}\
│       ├── screenshots\
│       └── evidence\
├── exports\               # 文档导出
├── demos\                 # Demo 资源
└── templates\             # fork 模板
```

**验收标准**：
- [ ] 文件上传 API 可用
- [ ] 文件可通过 API 鉴权后下载
- [ ] 开发环境本地磁盘存储正常
- [ ] 存储抽象层支持未来切换到对象存储

### Step A.3：Research.tsx 接入真实 API

**目标**：将 Research 页面从硬编码占位改为调用真实后端 API。

**前端改动**：

1. **Research.tsx**：调用 `GET /api/v1/projects` 获取项目列表
2. **项目卡片**：展示项目名称、模式标签、阶段进度、更新时间
3. **Tab 切换**：进行中/已完成筛选
4. **新建项目**：跳转到 Create 页面或弹出创建对话框

**验收标准**：
- [ ] 项目列表从 API 加载
- [ ] 进行中/已完成 Tab 筛选正常
- [ ] 点击项目卡片跳转到项目详情
- [ ] 新建项目功能可用

---

## 3. Phase B：学生主闭环强化（2 周）

### Step B.0：Demo 卡片 4 动作按钮

**目标**：Demo 卡片统一提供"试玩"、"看拆解"、"我也做一个"、"保存到我的项目"4 个动作。

**前端改动**：

1. **DemoCard.tsx**：添加 4 个动作按钮
   - "试玩"：HTML/JS 项目打开 iframe 模态框；其他项目展示截图+录屏
   - "看拆解"：跳转到 Demo 详情页的拆解 Tab
   - "我也做一个"：Fork 创建项目（已有）
   - "保存到我的项目"：Fork 并保存到项目列表

2. **ExploreDemoDetail.tsx**：增强 Demo 详情页
   - 添加 Tab 切换：体验 / 拆解 / 代码
   - 体验 Tab：iframe 嵌入（HTML/JS）或截图+录屏轮播
   - 拆解 Tab：项目架构图 + 关键代码片段 + AI 解释入口
   - 代码 Tab：代码高亮展示

**后端改动**：

1. **demos.py**：新增拆解端点
   - `GET /api/v1/demos/{demoId}/breakdown` - 获取 Demo 拆解说明

**验收标准**：
- [ ] Demo 卡片展示 4 个动作按钮
- [ ] 试玩按钮可打开 iframe 或截图展示
- [ ] 拆解按钮可查看项目架构和关键代码
- [ ] "我也做一个"可 Fork 创建项目

### Step B.1：Fork 最小可改版模板

**目标**：为 3 个初始 Demo 各制作 1 个高质量 Fork 模板，实现"最小可改版"原则。

**后端改动**：

1. **demos.py**：新增模板端点
   - `GET /api/v1/demos/{demoId}/fork-template` - 获取最小可改版模板

2. **Fork 模板数据结构**：

```text
ForkTemplate {
  demoId: string
  skeletonCode: string          # 保留核心逻辑的代码骨架
  editableMarkers: string[]     # 标记"你可以改这里"的位置
  suggestions: string[3]        # 3 个改动建议
  defaultGoal: string           # 预填推荐目标
  defaultTemplate: string       # 默认成果页模板
}
```

3. **为 3 个初始 Demo 制作模板**：
   - 诗词生成器：保留诗词生成逻辑，标记可改的诗词风格/主题
   - 智能计算器：保留计算逻辑，标记可改的运算符/界面
   - 待办清单：保留增删改查逻辑，标记可改的分类/筛选

**前端改动**：

1. **ExploreDemoDetail.tsx**：Fork 时加载模板，展示改动建议
2. **Create.tsx**：Fork 创建项目后，AI 引导第一步改动

**验收标准**：
- [ ] 3 个 Demo 各有 1 个 Fork 模板
- [ ] Fork 后展示"你可以改这里"标记
- [ ] 展示 3 个改动建议
- [ ] 预填推荐目标和默认模板

### Step B.2：标准研学 9 阶段完整 UI

**目标**：为标准研学模式提供完整的 9 阶段 UI，替代当前的 textarea 占位。

**前端新增文件**：

```
apps/frontend/src/components/
├── StandardProjectFlow.tsx      # 标准研学流程容器
└── stages/
    ├── Stage00Bootstrap.tsx     # 初始化
    ├── Stage01Brainstorm.tsx    # 脑爆选题
    ├── Stage02Brief.tsx        # 开题立项
    ├── Stage03Constraints.tsx   # 范围裁剪
    ├── Stage04Track.tsx        # 轨道选择
    ├── Stage05Design.tsx       # 设计蓝图
    ├── Stage06StepPlan.tsx     # 分步计划
    ├── Stage07Execute.tsx      # 执行开发
    └── Stage08Evaluate.tsx     # 验收展示
```

**每个阶段组件包含**：
- 阶段标题 + 成就描述（"你现在在哪一步"、"做完得到什么"、"最小完成标准"、"AI 怎么帮你"）
- 数据输入表单（对应 StageData Schema）
- AI 辅助入口（上下文注入当前阶段）
- "保存草稿"与"完成本阶段"按钮
- 阶段完成检查（必填字段验证）

**阶段进度条**：按 UI 布局规格实现 9 节点横向进度条（圆形 32px + 连接线 + 脉冲动画）

**验收标准**：
- [ ] 9 个阶段各有独立页面和表单
- [ ] 阶段进度条正确显示当前/完成/锁定状态
- [ ] 保存草稿和完成本阶段功能正常
- [ ] AI 辅助入口可跳转到 Create 页面并注入上下文

### Step B.3：成果档案卡下一步推荐

**目标**：成果档案卡底部展示"下一步挑战"，基于能力标签和当前难度推荐。

**前端改动**：

1. **ProjectAchievement.tsx**：添加 NextStepRecommend 组件
2. **NextStepRecommend 组件**：
   - 展示"你已经掌握了 [能力标签]"
   - 推荐同难度变体项目（规则匹配）
   - 推荐难度升级项目
   - 推荐下载到 AI IDE 深度开发

**后端改动**：

1. **achievement_cards.py**：新增推荐端点
   - `GET /api/v1/achievement-cards/{cardId}/recommendations` - 获取下一步推荐

**MVP 推荐策略**：规则匹配（基于 `capabilityTags` + `projectMode` + 难度标签），不做复杂推荐算法。

**验收标准**：
- [ ] 成果档案卡底部展示"下一步挑战"区域
- [ ] 推荐项基于能力标签和难度
- [ ] 点击推荐项可跳转到对应 Demo 或项目

---

## 4. Phase C：AI 能力 + 代码编辑器（2 周）

### Step C.0：AI 对话 WebSocket 流式升级

**目标**：将 AI 对话从 HTTP 升级为 WebSocket/SSE，实现流式响应和打字机效果。

**后端改动**：

1. **agent.py**：已有 WebSocket 端点 `/api/v1/agent/ws`，需验证和完善
2. **chat.py**：更新为支持 SSE 流式输出
3. 上下文注入：每次请求携带 `X-Session-Id`、`X-User-Id`、`X-Project-Id`、`X-Current-Stage`

**前端改动**：

1. **新增 `useChat.ts` Hook**：
   - WebSocket 连接管理
   - 流式消息接收
   - 自动重连
   - 项目上下文注入

2. **Create.tsx**：接入 WebSocket 流式对话
   - AI 消息逐字显示（打字机效果）
   - 支持 Markdown 渲染（代码块高亮）

3. **Home.tsx**：首页 AI 对话区同步升级

**验收标准**：
- [ ] AI 对话支持流式响应
- [ ] 打字机效果正常显示
- [ ] WebSocket 断线自动重连
- [ ] 项目上下文正确注入

### Step C.1：在线代码编辑器（Monaco + WebContainer）

**目标**：集成 Monaco Editor 和 WebContainer，支持 JS 代码在线编辑和运行。

**前端新增文件**：

```
apps/frontend/src/
├── components/
│   └── CodeEditor.tsx           # Monaco Editor 封装
├── hooks/
│   └── useWebContainer.ts       # WebContainer 运行 Hook
└── pages/
    └── CodePlayground.tsx       # 代码编辑器页面
```

**路由新增**：`/create/code` -> CodePlayground

**功能**：
- Monaco Editor：语法高亮、代码补全、多文件支持
- WebContainer：浏览器内运行 JS/TS 代码
- 代码保存：`POST /api/v1/projects/{projectId}/code/save`
- 运行结果展示：控制台输出 + 错误信息

**后端改动**：

1. **新增代码相关 API**：
   - `POST /api/v1/sandbox/execute` - 执行代码（服务端沙箱，备用）
   - `GET /api/v1/projects/{projectId}/code` - 获取项目代码
   - `POST /api/v1/projects/{projectId}/code/save` - 保存项目代码

**验收标准**：
- [ ] Monaco Editor 可编辑 JS 代码
- [ ] WebContainer 可运行 JS 代码
- [ ] 运行结果正确展示
- [ ] 代码可保存到项目

### Step C.2：场景化 AI 入口增强

**目标**：4 个场景化 AI 入口（问问题/解释代码/开始项目/写报告）自动注入上下文。

**前端改动**：

1. **Create.tsx**：场景入口点击时，自动注入上下文到 AI 对话
   - "问问题"：注入当前 Demo 信息
   - "解释代码"：注入当前代码片段
   - "开始项目"：注入 Fork 来源/当前题目
   - "写报告"：注入当前项目阶段与证据

2. **AI 对话面板**：展示上下文标签（如"当前项目: xxx"、"阶段: Step 2"）

**后端改动**：

1. **agent.py**：上下文头解析和注入 ZeroClaw Gateway

**验收标准**：
- [ ] 4 个场景入口点击后 AI 对话自动携带上下文
- [ ] AI 回复基于上下文生成
- [ ] 上下文标签正确展示

---

## 5. Phase D：研学引擎 + 成果闭环（2 周）

### Step D.0：自动证据采集

**目标**：实现平台自动采集项目过程证据。

**证据类型实现**：

| 类型 | 分类 | 实现方式 |
|------|------|---------|
| `auto_stage_change` | 自动 | 阶段推进时自动创建证据记录 |
| `auto_ai_summary` | 自动 | AI 对话结束时自动生成摘要并保存 |
| `auto_code_version` | 自动 | 代码保存时自动创建版本快照 |
| `semi_screenshot` | 半自动 | 前端截图按钮 + 上传 |
| `semi_run_result` | 半自动 | 保存运行结果按钮 |
| `manual_upload` | 手动 | 文件上传 |

**后端改动**：

1. **evidence.py**：更新证据 API，添加半自动端点
2. **project_service.py**：阶段推进时自动创建 `auto_stage_change` 证据
3. **chat_service.py**：AI 对话结束时自动创建 `auto_ai_summary` 证据
4. **新增截图端点**：`POST /api/v1/evidence/projects/{projectId}/screenshot`

**前端新增文件**：

```
apps/frontend/src/components/
├── EvidenceList.tsx             # 证据列表
├── EvidenceUpload.tsx           # 证据上传
└── EvidenceViewer.tsx           # 证据查看
```

**验收标准**：
- [ ] 阶段推进自动记录证据
- [ ] AI 对话结束自动生成摘要证据
- [ ] 代码保存自动创建版本证据
- [ ] 截图按钮可上传截图证据
- [ ] 证据列表正确展示

### Step D.1：研学文档生成与导出

**目标**：支持研学文档的 AI 辅助生成和多格式导出。

**后端新增文件**：

```
apps/backend/app/
├── api/
│   └── documents.py             # 文档 API
├── services/
│   └── document_service.py      # 文档生成服务
└── repositories/
    └── document_repo.py
```

**API 端点**：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/projects/{id}/documents/generate` | AI 辅助生成文档 |
| GET | `/api/v1/projects/{id}/documents` | 获取项目文档列表 |
| GET | `/api/v1/documents/{docId}/export` | 导出文档（PDF/DOCX/PPTX） |

**文档类型**：
- 开题报告（stage_02 产出）
- 技术报告（stage_05-07 产出）
- 结题报告（stage_08 产出）
- 论文（可选，stage_08 产出）

**导出格式**：
- PDF（优先，使用 reportlab/weasyprint）
- DOCX（使用 python-docx）
- PPTX（使用 python-pptx）

**异步任务**：文档导出使用 `BackgroundTasks` + 轮询模式

**前端改动**：

1. **ProjectDetail.tsx**：添加"生成文档"和"导出"按钮
2. **新增文档预览组件**

**验收标准**：
- [ ] AI 可辅助生成开题/技术/结题报告
- [ ] 文档可导出为 PDF
- [ ] 文档可导出为 DOCX
- [ ] 异步导出状态可查询

### Step D.2：灵感墙完整版

**目标**：建立完整的灵感墙功能，包括公开展示、审核流程、fork 回流。

**前端新增文件**：

```
apps/frontend/src/
├── pages/
│   └── ExploreInspiration.tsx   # 灵感墙页面
├── components/
│   ├── InspirationCard.tsx      # 灵感卡片
│   └── InspirationFilter.tsx    # 灵感筛选器
```

**后端改动**：

1. **achievement_cards.py**：完善灵感墙 API
   - `GET /api/v1/inspiration-wall` - 灵感墙列表（分页/筛选/排序）
   - `POST /api/v1/achievement-cards/{id}/submit-public` - 申请公开（已有）
   - `POST /api/v1/achievement-cards/{id}/unpublish` - 从灵感墙撤回
   - `POST /api/v1/inspiration-wall/{id}/fork` - 从灵感墙 fork 项目

**展示规则**：
- 灵感墙默认不展示真实姓名和头像
- 默认展示成果档案卡摘要，不直接暴露完整代码仓库
- 学生可随时关闭灵感墙展示

**审核流程**（MVP 简化版）：
- 学生点击"发布到灵感墙" -> 状态变为 `wall`
- 学生自主发布到灵感墙，无需审核
- 其他学生可从灵感墙 fork 项目

**验收标准**：
- [ ] 灵感墙页面展示公开的成果档案卡
- [ ] 学生可发布/撤回灵感墙展示
- [ ] 匿名展示（不显示真实姓名和头像）
- [ ] 可从灵感墙 fork 项目

### Step D.3：项目下载打包

**目标**：生成项目包（.zip），包含代码、README、SKILL_STATE 等。

**后端改动**：

1. **新增打包 API**：
   - `POST /api/v1/projects/{projectId}/package` - 生成项目包
   - `GET /api/v1/tasks/{taskId}` - 查询打包任务状态

2. **项目包内容**：
   - 源代码文件
   - `README.md`（项目说明 + 运行指引）
   - `SKILL_STATE.json`（项目状态）
   - 成果档案卡数据

3. **异步任务**：使用 `BackgroundTasks` + `TaskRecord`

**前端改动**：

1. **Connect.tsx**：项目下载中心接入真实打包 API
2. **ProjectDetail.tsx**：添加"下载项目包"按钮

**验收标准**：
- [ ] 点击"下载项目包"可生成 .zip
- [ ] .zip 包含代码、README、SKILL_STATE
- [ ] 异步打包状态可查询
- [ ] 下载链接有效期 24 小时

---

## 6. Phase E：完整体验 + 互联（2 周）

### Step E.0：课程库

**目标**：建立融合式学习 Demo 课程库，按学科/难度/年级筛选。

**后端新增文件**：

```
apps/backend/app/
├── api/
│   └── courses.py               # 课程 API
├── services/
│   └── course_service.py
└── repositories/
    └── course_repo.py
```

**API 端点**：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/courses` | 课程列表（筛选/分页） |
| GET | `/api/v1/courses/{id}` | 课程详情 |
| GET | `/api/v1/courses/{id}/demos` | 课程关联 Demo |

**前端新增文件**：

```
apps/frontend/src/
├── pages/
│   └── ExploreCourses.tsx       # 课程库页面
└── components/
    └── CourseCard.tsx            # 课程卡片
```

**验收标准**：
- [ ] 课程库页面展示课程列表
- [ ] 按学科/难度/年级筛选
- [ ] 课程详情展示关联 Demo
- [ ] 课程关联 AI 问答入口

### Step E.1：能力标签体系

**目标**：AI 自动生成能力标签，积累学生成长记录。

**8 大能力维度**：

| 标签 | 说明 |
|------|------|
| 数据处理 | 数据收集、清洗、分析能力 |
| 界面设计 | UI/UX 设计与实现能力 |
| 项目管理 | 项目规划、进度管理能力 |
| 逻辑推理 | 算法设计与逻辑思维 |
| 创意表达 | 创新思维与表达能力 |
| 代码实现 | 编码与调试能力 |
| 文档撰写 | 技术文档与报告撰写 |
| 问题分析 | 问题定义与拆解能力 |

**后端新增**：

```
apps/backend/app/
├── api/
│   └── capabilities.py          # 能力标签 API
├── services/
│   └── capability_service.py    # AI 生成能力标签
```

**API 端点**：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/users/me/capabilities` | 获取我的能力画像 |
| GET | `/api/v1/users/me/growth` | 获取成长记录时间线 |
| POST | `/api/v1/achievement-cards/{id}/generate-tags` | AI 生成能力标签 |

**前端新增**：

```
apps/frontend/src/components/
├── CapabilityRadar.tsx          # 能力雷达图
└── GrowthTimeline.tsx           # 成长时间线
```

**验收标准**：
- [ ] AI 可根据项目内容生成能力标签
- [ ] 能力雷达图正确展示
- [ ] 成长时间线展示历史项目

### Step E.2：Skill 市场完善

**目标**：完善 Skill 市场展示，添加安装指引和使用教程。

**前端改动**：

1. **Connect.tsx**：重写 Skill 市场区域
   - Skill 卡片：名称、描述、版本、安装命令
   - 安装指引：复制安装命令 + AI IDE 安装步骤
   - 使用教程：每个 Skill 的使用说明

2. **5 个核心 Skill 完善**：

| Skill | 功能 | 状态 |
|-------|------|------|
| StemPblGuide | 9 阶段状态机 + 双模式 | 已内置 |
| CodeRunner | 在线代码执行 | 需完善 |
| KnowledgeBase | 课程库+案例库检索 | 需新增 |
| DemoExplorer | Demo 解释 + 引导 fork | 已内置 |
| IDEConnector | 项目包 + Skill 安装 | 需完善 |

**验收标准**：
- [ ] Skill 市场展示 5 个核心 Skill
- [ ] 安装命令可复制
- [ ] 使用教程可查看
- [ ] Skill 安装/启停/卸载功能正常

### Step E.3：CI/CD 流水线与生产部署

**目标**：建立完整的 CI/CD 流水线和生产部署方案。

**流水线阶段**：

```
checkout -> deps cache -> lint -> format -> typecheck -> unit & integration tests
-> coverage gates -> security/SAST -> OpenAPI contract check -> build
-> package/artifact -> deploy -> smoke tests -> notify
```

**部署方案**：
- Docker 化（更新 Dockerfile）
- docker-compose 更新
- Nginx 反向代理配置
- 生产环境配置（环境变量、密钥管理）

**验收标准**：
- [ ] CI/CD 流水线可自动运行
- [ ] lint/typecheck/test 全部通过
- [ ] Docker 镜像可构建
- [ ] 生产环境可部署

---

## 7. Phase F：生态与增长（持续迭代）

> **重要说明**：V3.3 产品规格明确"平台长期采用单一用户形态：学生"，不存在管理员、老师、家长角色。此前版本中的 Phase F（多角色+运营体系）属于误判，已移除。

以下功能按需排期，不在当前开发计划的时间范围内：

| 功能 | 优先级 | 说明 |
|------|--------|------|
| UGC 社区 | P3 | 学生作品社区、点赞/评论/收藏 |
| 媒体闭环 | P3 | 短视频引流 -> 平台体验 -> 作品产出 -> 回流 |
| 半定制 DIY 课程 | P3 | AI 生成学习计划 + 推送课件 |
| 低年级移动端 App | P3 | React Native / Flutter 简化版 |
| 推荐算法 | P3 | 基于热度/标签/难度的智能推荐 |
| 组队协作 | P3 | 多人参与同一项目 |
| 综评素材包 | P3 | 导出为 PDF 用于综合素质评价 |
| 竞赛对接 | P3 | 科创/建模竞赛素材生成 |
| C/C++ 算法衔接 | P4 | 高年级算法学习、OI 竞赛对接 |

---

## 9. 匿名试玩与注册时机实现

根据 V3.3 MVP 成功判据附件，需实现以下匿名访问策略：

| 场景 | 是否要求注册 | 实现方式 |
|------|-------------|---------|
| 浏览 Demo 墙 | 否 | 路由守卫放行 `/explore/demos` |
| 试玩 Demo | 否 | iframe 嵌入无需登录 |
| 问一个简单问题 | 否 | 匿名 AI 对话（次数受限，3 次/天） |
| 点击"我也做一个" | 建议注册 | 弹出轻注册对话框，可跳过 |
| 保存到"我的项目" | 是 | 必须登录，跳转登录页 |
| 生成成果档案卡 | 是 | 必须登录 |
| 复制分享链接 | 是 | 必须登录 |

**前端改动**：

1. **路由守卫**：区分"必须登录"和"建议登录"
2. **轻注册弹窗**：点击"我也做一个"时弹出，最少信息（邮箱+验证码），昵称可选
3. **匿名 AI 对话限制**：前端计数 + 后端 IP 限制

---

## 10. 轻项目升级为标准研学映射

根据 V3.3 附件定义：

| 轻项目步骤 | 标准研学映射 | 数据继承 |
|-----------|-------------|---------|
| Step 1 想法与方向 | `stage_00` ~ `stage_02` | 项目名称、描述、核心功能列表 |
| Step 2 设计与实现 | `stage_03` ~ `stage_07` | 可运行代码、关键截图 |
| Step 3 展示与反思 | `stage_08` | 成果档案卡、反思 |

**后端已有**：`POST /api/v1/projects/{projectId}/upgrade` + `LightToStandardMapping`

**前端改动**：

1. **ProjectDetail.tsx**：升级按钮和确认对话框
2. 升级后自动跳转到标准研学流程，已有数据预填

---

## 11. UI 布局规格对齐

根据 V3.3 UI 布局规格附件，需对齐以下关键规格：

### 11.1 全局导航改造

**当前**：顶部 Navbar
**目标**：xl/lg 断点侧边导航（64px 收起/200px 展开），md/sm 顶部导航

**改动**：
1. 新增 `Sidebar.tsx`（已有但未使用，需激活）
2. `Layout.tsx`：根据断点切换侧边/顶部导航
3. 侧边导航项：探索/创造/研究/互联

### 11.2 页面布局对齐

| 页面 | 当前 | 目标（V3.3 规格） |
|------|------|-------------------|
| 首页 | AI 聊天 + 三入口 | Hero + 三入口卡片 + 精选 Demo + 灵感墙精选 |
| 探索中心 | Tab 占位 | Tab（Demo 墙/课程库/灵感墙）+ 筛选 + 网格 |
| AI 工作台 | Codex 风格 | 三栏（场景入口 200px / 对话区 flex / 上下文 280px） |
| 研学流程 | 硬编码占位 | 项目卡片列表 + 进度条 |
| 项目详情 | 轻项目 3 步 | 双栏（阶段内容 flex / 侧边面板 320px） |
| 成果档案卡 | 内嵌 | 单栏居中 max720px + 下一步推荐 |
| 分享页 | 已实现 | 单栏居中 max600px + 品牌标识 |
| AI IDE 互联 | Skill 列表 | Skill 卡片 + IDE 图标 + 下载中心 |

### 11.3 设计系统对齐

根据 V3.3 设计系统规范：
- 主色调：蓝绿色系（Primary 500: `#14B8A6`）
- 按钮：4 种变体（Primary/Secondary/Text/Ghost）
- 字体：中文 PingFang SC / 英文 Inter / 代码 Fira Code
- 圆角：SM 4px / MD 8px / LG 12px / XL 16px
- 阴影：SM / MD / LG / XL 四级

---

## 12. 总体时间线

```
Phase A (2周)  ████████████████ 技术债修复 + 数据库持久化 + 文件存储 + Research接入
Phase B (2周)  ████████████████ Demo 4动作 + Fork模板 + 标准9阶段UI + 下一步推荐
Phase C (2周)  ████████████████ WebSocket流式 + Monaco编辑器 + 场景入口增强
Phase D (2周)  ████████████████ 证据采集 + 文档生成导出 + 灵感墙 + 项目打包
Phase E (2周)  ████████████████ 课程库 + 能力标签 + Skill市场 + CI/CD
Phase F (持续) ████████████████████████████████ 生态与增长
```

**Phase A-E 总预估**：10 周（约 2.5 个月）
**Phase G**：持续迭代，按需排期

---

## 13. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 数据库迁移复杂度 | Phase B+ 全部依赖 | Phase A 优先完成，保持 API 接口不变 |
| ZeroClaw Gateway 稳定性 | AI 对话/文档生成/能力标签依赖 | 明确错误返回 + 重试机制，不做假回复 |
| WebContainer 兼容性 | 在线代码运行 | 先验证主流浏览器支持 |
| Schema 再次分叉 | 高 | 以 V3.3 字段为唯一口径，接口契约冻结 |
| Pyodide 包体积 | Python 在线运行加载慢 | 按需加载 + CDN 缓存（Phase G） |
| 文档导出格式兼容性 | DOCX/PPTX 模板复杂 | 先做 PDF，后续扩展 |
---

## 14. 交付物清单

### Phase A 交付

| 交付物 | 对应步骤 |
|--------|---------|
| 前后端 Schema 对齐代码 | Step A.0 |
| SQLAlchemy ORM 模型 + Alembic 迁移 | Step A.1 |
| Repository + Service 分层重构 | Step A.1 |
| 文件存储服务（上传/下载/抽象层） | Step A.2 |
| Research.tsx 接入真实 API | Step A.3 |

### Phase B 交付

| 交付物 | 对应步骤 |
|--------|---------|
| Demo 卡片 4 动作按钮 | Step B.0 |
| 3 个 Fork 最小可改版模板 | Step B.1 |
| 标准 9 阶段完整 UI（9 个 Stage 组件） | Step B.2 |
| 成果档案卡下一步推荐 | Step B.3 |

### Phase C 交付

| 交付物 | 对应步骤 |
|--------|---------|
| AI 对话 WebSocket 流式响应 | Step C.0 |
| Monaco Editor + WebContainer 集成 | Step C.1 |
| 场景化 AI 入口上下文注入 | Step C.2 |

### Phase D 交付

| 交付物 | 对应步骤 |
|--------|---------|
| 自动证据采集（3 自动 + 2 半自动 + 1 手动） | Step D.0 |
| 研学文档生成 + PDF/DOCX/PPTX 导出 | Step D.1 |
| 灵感墙完整版（展示/发布/撤回/fork） | Step D.2 |
| 项目下载打包（.zip） | Step D.3 |

### Phase E 交付

| 交付物 | 对应步骤 |
|--------|---------|
| 课程库 + 课程卡片 | Step E.0 |
| 能力标签体系 + 雷达图 + 成长时间线 | Step E.1 |
| Skill 市场完善 | Step E.2 |
| CI/CD 流水线 + 生产部署 | Step E.3 |

---

## 15. 执行原则

1. **接口契约冻结**：以 V3.3 字段为唯一口径，Schema 不再分叉
2. **分层架构**：后端严格 `controller -> service -> repository -> model -> infra`
3. **渐进式交付**：每个 Step 完成后可独立验证，不依赖后续 Step
4. **质量红线**：lint 零警告、类型检查通过、核心 API 测试覆盖
5. **环境合规**：所有工具安装到 D:/H:，PATH 不含第三方 C:\
6. **中文规范**：日志/异常/UI 文本使用简体中文，变量命名保持英文
7. **ZeroClaw 不做假回复**：网关不可用时返回明确错误
