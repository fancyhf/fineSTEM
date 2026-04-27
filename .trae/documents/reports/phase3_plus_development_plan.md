# fineSTEM Phase 3+ 完整开发计划

**版本**: v1.0
**日期**: 2026-04-24
**状态**: 待审批
**前提**: Phase 2（二期开发计划 v2.1）已全部完成
**遵循规范**: `g:\mediaProjects\fineSTEM\.trae\rules\project_rules.md`

---

## 0. Phase 2 完成后的平台状态

Phase 2 完成后，平台将具备以下能力：

| 能力 | 状态 |
|------|------|
| 用户注册/登录/JWT 认证 | 已完成 |
| Demo 墙 + 筛选/搜索/分页 | 已完成 |
| Demo 详情 + "我也做一个" Fork | 已完成 |
| 轻项目 3 步流程 | 已完成 |
| 标准研学 9 阶段数据层 + 基础 UI | 已完成 |
| 成果档案卡创建/展示/分享 | 已完成 |
| AI 对话集成（HTTP + 项目上下文） | 已完成 |
| 在线代码编辑器（Monaco + JS 运行） | 已完成 |
| 项目下载打包 | 已完成 |
| 基础测试覆盖 | 已完成 |

**核心闭环已跑通**：`Demo -> fork -> 轻项目 -> 成果档案卡 -> 分享`

---

## 1. Phase 2 之后剩余功能全景

基于产品方案 V3.3 和统一行动纲领，Phase 2 之后仍需开发的功能按模块分类如下：

### 1.1 探索中心（Explore）- 剩余功能

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 课程库 | 融合式学习 Demo、按学科/难度/年级筛选、AI 问答入口 | P2 |
| 灵感墙完整版 | 成果公开展示、审核流程、fork 回流、匿名展示 | P1 |
| Demo 试玩增强 | HTML/JS iframe 嵌入、截图+录屏+项目拆解卡 | P1 |
| Demo 最小可改版 Fork | 保留核心逻辑、标记"你可以改这里"、3 个改动建议 | P1 |
| 选题推荐 | 多维度启动入口（兴趣词/学科/比赛）、三轨道题库 | P2 |

### 1.2 AI 工作台（Create）- 剩余功能

| 功能 | 说明 | 优先级 |
|------|------|--------|
| AI 对话 WebSocket 升级 | 实时流式响应、打字机效果 | P1 |
| 场景化 AI 入口增强 | 4 个高频入口上下文自动注入 | P1 |
| Python 在线运行 | Pyodide 集成、第三方包支持 | P2 |
| AI 辅助代码补全/解释/调试 | 编辑器内 AI 能力 | P2 |
| 代码分享链接 | 生成可分享的代码片段链接 | P2 |

### 1.3 研学流程（Research）- 剩余功能

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 标准研学 9 阶段完整 UI | 全部 9 阶段独立页面与交互 | P1 |
| 研学文档生成 | 开题报告/技术报告/结题报告/论文 | P1 |
| 研学文档导出 | PDF/DOCX/PPTX 格式导出 | P1 |
| 自动证据采集 | 阶段变更记录 + AI 对话摘要 + 代码版本 | P1 |
| 半自动证据 | 截图按钮 + 保存运行结果 | P1 |
| 能力标签生成 | AI 自动生成能力标签、成长记录 | P2 |
| 成果档案卡公开流程 | 申请公开 -> 自动发布灵感墙 | P1 |
| 成果档案卡下一步推荐 | 基于能力标签推荐同难度变体/升级 | P2 |

### 1.4 AI IDE 互联（Connect）- 剩余功能

| 功能 | 说明 | 优先级 |
|------|------|--------|
| Skill 市场 | Skill 列表 + 安装命令 + 使用教程 | P2 |
| 项目绑定同步 | 平台与 AI IDE 持续同步、冲突处理 | P3 |
| 远程 AI 咨询 | 不在 AI IDE 也能问 AI、项目上下文关联 | P2 |

### 1.5 基础设施 - 剩余功能

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 数据库持久化 | 内存数据库迁移到 SQLite/PostgreSQL | P0 |
| 文件存储服务 | 截图/附件/项目包的统一存储 | P1 |
| 异步任务层 | 项目包生成/文档导出/AI 摘要等异步任务 | P1 |
| CI/CD 流水线 | lint/typecheck/test/coverage/security 全链路 | P1 |
| 生产部署 | Docker 化 + 生产环境配置 | P1 |

### 1.6 远期愿景

| 功能 | 说明 | 优先级 |
|------|------|--------|
| UGC 社区 | 学生作品社区、点赞/评论 | P3 |
| 低年级移动端 App | 演示与讲解 + 简单 AI Chat | P3 |
| 推荐算法 | 基于热度/标签/难度的智能推荐 | P3 |
| 半定制 DIY 课程 | AI 生成学习计划 + 推送课件 | P3 |
| 多角色 AI Agent 矩阵 | 苏格拉底导师/代码审计员/创意缪斯/学科专家 | P3 |
| 组队协作 | 多人参与同一项目 | P3 |
| 综评素材包 | 导出为 PDF 用于综合素质评价 | P3 |
| 竞赛对接 | 科创/建模竞赛素材生成 | P3 |
| 媒体闭环 | 短视频引流 -> 平台体验 -> 作品产出 -> 回流 | P3 |
| C/C++ 算法衔接 | 高年级算法学习、OI 竞赛对接 | P4 |

---

## 2. Phase 3：研学引擎 + 成果闭环（6-8 周）

### 目标

完善研学全流程能力，实现"从选题到成果展示"的完整闭环，包括标准研学完整 UI、文档生成导出、证据采集、灵感墙审核、数据库持久化。

### Step 3.0：数据库持久化迁移（P0，1 周）

**目标**：将内存数据库迁移到 SQLite（开发）/ PostgreSQL（生产），确保数据不丢失。

**后端改动**：

```
apps/backend/
├── app/
│   ├── db/
│   │   ├── database.py          # 新增：SQLAlchemy 引擎与 Session
│   │   ├── models.py            # 新增：ORM 模型定义
│   │   ├── memory.py            # 保留：作为测试 Mock
│   │   └── migrations/          # 新增：Alembic 迁移脚本
│   │       ├── env.py
│   │       └── versions/
│   ├── repositories/            # 新增：数据访问层
│   │   ├── base.py              # 基础 Repository
│   │   ├── user_repo.py
│   │   ├── demo_repo.py
│   │   ├── project_repo.py
│   │   ├── achievement_repo.py
│   │   └── evidence_repo.py
│   └── services/                # 新增：业务逻辑层
│       ├── auth_service.py
│       ├── demo_service.py
│       ├── project_service.py
│       ├── achievement_service.py
│       └── evidence_service.py
├── alembic.ini                  # 新增
└── requirements.txt             # 更新：添加 sqlalchemy/alembic/psycopg2
```

**技术选型**：
- ORM：SQLAlchemy 2.0（async）
- 迁移：Alembic
- 开发数据库：SQLite（`D:\data\finestem\finestem.db`）
- 生产数据库：PostgreSQL（后续配置）

**ORM 模型映射**：

| Schema 模型 | ORM 模型 | 表名 |
|-------------|---------|------|
| User | UserModel | users |
| Demo | DemoModel | demos |
| Project | ProjectModel | projects |
| SkillState | SkillStateModel | skill_states |
| AchievementCard | AchievementCardModel | achievement_cards |
| Evidence | EvidenceModel | evidence |

**分层重构**：`controller(api) -> service -> repository -> model(ORM) -> infra(database)`

**验收标准**：
- [ ] 所有现有 API 端点功能不变
- [ ] 数据重启后不丢失
- [ ] Alembic 迁移脚本可执行
- [ ] 开发环境使用 SQLite，生产环境可切换 PostgreSQL

---

### Step 3.1：灵感墙 + 成果审核流程（P1，1 周）

**目标**：建立完整的成果公开展示、fork 回流机制。

**后端新增/更新**：

```
apps/backend/app/
├── api/
│   └── inspiration.py           # 新增：灵感墙 API
├── services/
│   └── inspiration_service.py   # 新增
└── repositories/
    └── inspiration_repo.py      # 新增
```

**API 端点**：

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/v1/inspiration-wall` | 灵感墙列表（分页/筛选/排序） | 否 |
| POST | `/api/v1/achievement-cards/{id}/submit-public` | 申请公开 | 是 |
| POST | `/api/v1/inspiration-wall/{id}/fork` | 从灵感墙 fork 项目 | 是 |

**前端新增/更新**：

```
apps/frontend/src/
├── pages/
│   └── ExploreInspiration.tsx   # 新增：灵感墙页面
├── components/
│   ├── InspirationCard.tsx      # 新增：灵感卡片
│   └── InspirationFilter.tsx    # 新增：灵感筛选器
```

**公开流程**：
```
学生创建成果档案卡 -> 点击"申请公开" -> 状态变为 is_public=true
-> 展示在灵感墙 -> 其他学生可 fork
```

---

### Step 3.2：标准研学 9 阶段完整 UI（P1，1.5 周）

**目标**：为深度开发者提供完整的标准研学流程 UI，实现 9 阶段状态机的前端交互。

**前端新增**：

```
apps/frontend/src/components/
├── StandardProjectFlow.tsx      # 标准研学流程容器
└── stages/
    ├── Stage00Bootstrap.tsx     # Bootstrapping
    ├── Stage01Brainstorm.tsx    # Brainstorm Studio
    ├── Stage02Brief.tsx        # Idea to Spec
    ├── Stage03Constraints.tsx   # Scope Cutter
    ├── Stage04Track.tsx        # Track Router
    ├── Stage05Design.tsx       # Designer
    ├── Stage06StepPlan.tsx     # Task Decomposer
    ├── Stage07Execute.tsx      # Coder Coach
    └── Stage08Evaluate.tsx     # Evaluator & Showcase
```

**每个阶段组件包含**：
- 阶段标题 + 成就描述
- 数据输入表单（对应 StageData Schema）
- AI 辅助入口（上下文注入当前阶段）
- "保存草稿"与"完成本阶段"按钮
- 阶段完成检查（必填字段验证）

---

### Step 3.3：研学文档生成与导出（P1，1 周）

**目标**：支持研学文档的 AI 辅助生成和多格式导出。

**后端新增**：

```
apps/backend/app/
├── api/
│   └── documents.py             # 新增：文档 API
├── services/
│   └── document_service.py      # 新增：文档生成服务
└── repositories/
    └── document_repo.py         # 新增
```

**API 端点**：

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/v1/projects/{id}/documents/generate` | AI 辅助生成文档 | 是 |
| GET | `/api/v1/projects/{id}/documents` | 获取项目文档列表 | 是 |
| GET | `/api/v1/documents/{docId}/export` | 导出文档（PDF/DOCX/PPTX） | 是 |

**文档类型**：
- 开题报告（stage_02 产出）
- 技术报告（stage_05-07 产出）
- 结题报告（stage_08 产出）
- 论文（可选，stage_08 产出）

**导出格式**：
- PDF（优先，使用 reportlab/weasyprint）
- DOCX（使用 python-docx）
- PPTX（使用 python-pptx）

---

### Step 3.4：自动证据采集（P1，1 周）

**目标**：实现平台自动采集项目过程证据，为文档生成和成果展示提供素材。

**证据类型**：

| 类型 | 分类 | 采集方式 | 说明 |
|------|------|---------|------|
| `auto_stage_change` | 自动 | 平台触发 | 阶段变更自动记录 |
| `auto_ai_summary` | 自动 | AI 生成 | AI 对话摘要 |
| `auto_code_version` | 自动 | 平台触发 | 代码版本快照 |
| `semi_screenshot` | 半自动 | 用户触发 | 手动截图上传 |
| `semi_run_result` | 半自动 | 用户触发 | 保存运行结果 |
| `manual_upload` | 手动 | 用户上传 | 外部文件上传 |

**后端更新**：

```
apps/backend/app/
├── services/
│   └── evidence_service.py      # 更新：添加自动采集逻辑
└── api/
    └── evidence.py              # 更新：添加半自动端点
```

**前端新增**：

```
apps/frontend/src/components/
├── EvidenceList.tsx             # 证据列表
├── EvidenceUpload.tsx           # 证据上传
└── EvidenceViewer.tsx           # 证据查看
```

---

### Step 3.5：AI 对话 WebSocket 升级（P1，0.5 周）

**目标**：将 AI 对话从 HTTP 升级为 WebSocket，实现流式响应。

**后端新增**：

```
apps/backend/app/
├── api/
│   └── chat.py                  # 新增：WebSocket 聊天端点
└── services/
    └── chat_service.py          # 更新：支持流式响应
```

**WebSocket 端点**：
- `ws://host/api/v1/chat/ws` - WebSocket 聊天连接
- 支持流式 token 输出（打字机效果）
- 保持 HTTP 端点兼容

**前端更新**：

```
apps/frontend/src/
├── hooks/
│   └── useChat.ts               # 新增：WebSocket 聊天 Hook
└── components/
    └── Shared/
        └── AIChatPanel.tsx      # 更新：支持流式显示
```

---

### Step 3.6：Demo 增强与 Fork 最小可改版（P1，1 周）

**目标**：增强 Demo 展示体验，实现"最小可改版" Fork 策略。

**后端更新**：

```
apps/backend/app/
├── api/
│   └── demos.py                 # 更新：添加 iframe/拆解/模板端点
└── services/
    └── demo_service.py          # 新增：Demo 增强服务
```

**新增 API 端点**：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/demos/{id}/breakdown` | 获取 Demo 拆解说明 |
| GET | `/api/v1/demos/{id}/fork-template` | 获取最小可改版模板 |

**前端更新**：

```
apps/frontend/src/
└── pages/
    └── ExploreDemoDetail.tsx    # 更新：添加试玩/拆解/最小可改版 Tab
```

**Demo 展示分层**：
- HTML/JS 项目：iframe 交互嵌入
- Flask/Streamlit 项目：截图 + 录屏 + 输入输出示例 + 项目拆解卡

**Fork 最小可改版原则**：
- 保留核心逻辑
- 去掉复杂功能
- 标记"你可以改这里"
- 附带 3 个改动建议
- 预填推荐目标和默认成果页模板

---

### Step 3.7：文件存储服务（P1，0.5 周）

**目标**：建立统一的文件存储抽象层，支持截图/附件/项目包的存储。

**后端新增**：

```
apps/backend/app/
├── api/
│   └── files.py                 # 新增：文件上传/下载 API
├── services/
│   └── storage_service.py       # 新增：存储抽象层
└── core/
    └── config.py                # 更新：添加存储配置
```

**存储策略**：
- 开发环境：本地磁盘 `D:\data\finestem\uploads\`
- 生产环境：对象存储（S3/MinIO）或本地磁盘
- 统一通过 FastAPI 文件服务抽象层访问

---

### Phase 3 时间线

```
Week 1:    Step 3.0 数据库持久化
Week 2:    Step 3.1 灵感墙+审核 | Step 3.5 WebSocket 升级
Week 3-4:  Step 3.2 标准9阶段UI | Step 3.6 Demo增强
Week 5:    Step 3.3 文档生成导出 | Step 3.7 文件存储
Week 6:    Step 3.4 自动证据采集
Week 7-8:  集成测试 + 修复 + 打磨
```

---

## 3. Phase 4：完整体验 + 互联（4-6 周）

### 目标

完善平台体验，实现 AI IDE 互联、Skill 市场、Python 在线运行、能力标签体系，让平台具备"从轻体验到深度开发"的完整用户路径。

### Step 4.1：Skill 市场（P2，1 周）

**目标**：建立 fineSTEM Skill 市场，支持 AI IDE 安装与使用。

**后端新增**：

```
apps/backend/app/
├── api/
│   └── skills.py                # 新增：Skill API
└── services/
    └── skill_service.py         # 新增
```

**API 端点**：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/skills` | Skill 列表 |
| GET | `/api/v1/skills/{id}` | Skill 详情 |
| GET | `/api/v1/skills/{id}/install-command` | 获取安装命令 |

**5 个核心 Skill**：

| Skill | 功能 | Phase |
|-------|------|-------|
| StemPblGuide | 9 阶段状态机 + 双模式 + 教学模式 | Phase 3 已内置 |
| CodeRunner | 在线代码执行 | Phase 4 |
| KnowledgeBase | 课程库+案例库+题库检索 | Phase 4 |
| DemoExplorer | Demo 解释 + 引导 fork | Phase 3 已内置 |
| IDEConnector | 项目包 + Skill 安装 + 状态同步 | Phase 4 |

**前端更新**：

```
apps/frontend/src/
└── pages/
    └── Connect.tsx              # 重写：Skill 市场 + 安装指引
```

---

### Step 4.2：Python 在线运行（P2，1 周）

**目标**：集成 Pyodide，支持 Python 代码在浏览器内运行。

**前端更新**：

```
apps/frontend/src/
├── components/
│   └── CodeEditor.tsx           # 更新：添加 Python 语言支持
└── hooks/
    └── usePyodide.ts            # 新增：Pyodide 运行 Hook
```

**技术方案**：
- 使用 Pyodide（Python 编译为 WebAssembly）
- 支持基础 Python 标准库
- 限制执行时间和内存
- 第三方包支持（numpy/pandas/matplotlib 等，按需加载）

---

### Step 4.3：能力标签体系（P2，1 周）

**目标**：AI 自动生成能力标签，积累学生成长记录，为推荐算法提供数据基础。

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
│   └── capabilities.py          # 新增：能力标签 API
├── services/
│   └── capability_service.py    # 新增：AI 生成能力标签
```

**API 端点**：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/users/me/capabilities` | 获取我的能力画像 |
| GET | `/api/v1/users/me/growth` | 获取成长记录时间线 |
| POST | `/api/v1/achievement-cards/{id}/generate-tags` | AI 生成能力标签 |

**前端新增**：

```
apps/frontend/src/
├── components/
│   ├── CapabilityRadar.tsx      # 能力雷达图
│   └── GrowthTimeline.tsx       # 成长时间线
└── pages/
    └── Dashboard.tsx            # 更新：添加能力画像
```

---

### Step 4.4：课程库（P2，1 周）

**目标**：建立融合式学习 Demo 课程库，按学科/难度/年级筛选。

**后端新增**：

```
apps/backend/app/
├── api/
│   └── courses.py               # 新增：课程 API
├── services/
│   └── course_service.py        # 新增
└── repositories/
    └── course_repo.py           # 新增
```

**API 端点**：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/courses` | 课程列表（筛选/分页） |
| GET | `/api/v1/courses/{id}` | 课程详情 |
| GET | `/api/v1/courses/{id}/demos` | 课程关联 Demo |

**前端新增**：

```
apps/frontend/src/
├── pages/
│   └── ExploreCourses.tsx       # 新增：课程库页面
└── components/
    └── CourseCard.tsx            # 新增：课程卡片
```

---

### Step 4.5：选题推荐（P2，1 周）

**目标**：多维度启动入口，帮助学生快速找到感兴趣的项目方向。

**推荐维度**：
- 从 Demo 启动（已有）
- 从兴趣词启动（AI 推荐）
- 从学科任务启动（学科关联）
- 从比赛题目启动（竞赛对接）

**三轨道题库**：

| 轨道 | 方向 | 题库规模 |
|------|------|---------|
| Web 项目 | 前端/全栈 | 20 个 |
| Kaggle/建模 | 数据分析 | 10 个 |
| 硬件创客 | IoT/嵌入式 | 10 个 |

**后端新增**：

```
apps/backend/app/
├── api/
│   └── recommendations.py       # 新增：推荐 API
└── services/
    └── recommendation_service.py # 新增
```

---

### Step 4.6：CI/CD 流水线与生产部署（P1，1 周）

**目标**：建立完整的 CI/CD 流水线和生产部署方案。

**流水线阶段**：
```
checkout -> deps cache -> lint -> format -> typecheck -> unit & integration tests
-> coverage gates -> security/SAST -> OpenAPI contract check -> build
-> package/artifact -> deploy (blue-green/canary) -> smoke tests -> notify
```

**部署方案**：
- Docker 化（已有 Dockerfile，需更新）
- docker-compose 更新（指向新版后端）
- Nginx 反向代理配置
- 生产环境配置（环境变量、密钥管理）

---

### Phase 4 时间线

```
Week 1:    Step 4.1 Skill 市场 | Step 4.6 CI/CD
Week 2:    Step 4.2 Python 在线运行
Week 3:    Step 4.3 能力标签 | Step 4.4 课程库
Week 4:    Step 4.5 选题推荐
Week 5-6:  集成测试 + 生产部署 + 打磨
```

---

## 4. Phase 5：生态与增长（持续迭代）

### 目标

建立 UGC 社区生态，实现媒体闭环，拓展用户群体。

### Step 6.1：UGC 社区（P3）

- 学生作品社区（点赞/评论/收藏）
- AI 黑客松活动页
- 社区排行榜（周/月/总）
- 优秀作品推荐

### Step 6.2：媒体闭环（P3）

- 短视频引流 -> 平台体验 -> 作品产出 -> 二创素材 -> 回流媒体
- Demo 一键生成短视频脚本
- 成果档案卡生成分享海报
- 社交媒体分享优化

### Step 6.3：半定制 DIY 课程（P3）

- 学生提出学习方向
- AI 生成学习计划
- 推送课件与练习
- 学习进度追踪

### Step 6.4：低年级移动端 App（P3）

- 系统演示功能 -> 讲解代码 -> AI Chat 简单问答
- React Native / Flutter
- 简化版 UI（大字体、语音交互）

### Step 6.5：推荐算法（P3）

- 基于热度/标签/难度的智能推荐
- 协同过滤（相似用户推荐）
- 基于能力标签的进阶推荐

### Step 6.6：组队协作（P3）

- 多人参与同一项目
- 角色分工（前端/后端/设计/文档）
- 协作编辑与版本管理

### Step 6.7：综评素材包（P3）

- 导出为 PDF，直接用于综合素质评价系统填报
- 包含：项目描述/成果/能力标签/教师评语/时间线

### Step 6.8：竞赛对接（P3）

- 科创/建模竞赛素材生成
- 竞赛题库与训练
- 竞赛作品提交与评审

### Step 6.9：C/C++ 算法衔接（P4）

- 高年级算法学习
- OI 竞赛对接
- 在线判题系统（OJ）

---

## 6. 总体时间线总览

```
Phase 1 (已完成)    ████████████ MVP 骨架 + 核心闭环
Phase 2 (进行中)    ████████████ 技术债修复 + AI对话 + 代码编辑器
Phase 3 (6-8周)     ████████████████████ 研学引擎 + 成果闭环 + 数据库持久化
Phase 4 (4-6周)     ████████████████ 完整体验 + 互联 + 能力标签
Phase 5 (4-6周)     ████████████████ 多角色 + 运营体系
Phase 6 (持续)      ████████████████████████████████ 生态与增长
```

**Phase 3-5 总预估**：14-20 周（约 4-5 个月）
**Phase 6**：持续迭代，按需排期

---

## 7. 关键依赖与风险

| 依赖/风险 | 影响 | 缓解措施 |
|-----------|------|---------|
| 数据库迁移复杂度 | Phase 3 全部步骤依赖 | Step 3.0 优先完成，保持 API 接口不变 |
| ZeroClaw Gateway 稳定性 | AI 对话/文档生成/能力标签依赖 | 本地 fallback + 重试机制 |
| Pyodide 包体积 | Python 在线运行加载慢 | 按需加载 + CDN 缓存 |
| 文档导出格式兼容性 | DOCX/PPTX 模板复杂 | 先做 PDF，后续扩展 |
| 多角色权限复杂度 | 权限矩阵设计容易遗漏 | RBAC 模型 + 最小权限原则 |
| 生产部署运维 | 需要持续运维能力 | Docker 化 + 监控告警 |
| UGC 内容安全 | 社区内容审核压力 | AI 辅助预审 + 举报机制 |

---

## 8. 交付物清单

### Phase 3 交付

| 交付物 | 对应步骤 |
|--------|---------|
| SQLite/PostgreSQL 数据库层 + ORM 模型 + 迁移脚本 | Step 3.0 |
| 灵感墙完整功能（列表/筛选/fork/审核） | Step 3.1 |
| 标准 9 阶段完整 UI | Step 3.2 |
| 研学文档生成 + PDF/DOCX/PPTX 导出 | Step 3.3 |
| 自动证据采集（3 种自动 + 2 种半自动 + 1 种手动） | Step 3.4 |
| AI 对话 WebSocket 流式响应 | Step 3.5 |
| Demo 增强 + 最小可改版 Fork | Step 3.6 |
| 文件存储服务 | Step 3.7 |

### Phase 4 交付

| 交付物 | 对应步骤 |
|--------|---------|
| Skill 市场 + 5 个核心 Skill | Step 4.1 |
| Python 在线运行（Pyodide） | Step 4.2 |
| 能力标签体系 + 雷达图 + 成长时间线 | Step 4.3 |
| 课程库 + 课程卡片 | Step 4.4 |
| 选题推荐 + 三轨道题库 | Step 4.5 |
| CI/CD 流水线 + 生产部署 | Step 4.6 |

### Phase 5 交付（按需排期）

| 交付物 | 对应步骤 |
|--------|---------|
| UGC 社区 | Step 6.1 |
| 媒体闭环 | Step 6.2 |
| 半定制 DIY 课程 | Step 6.3 |
| 低年级移动端 App | Step 6.4 |
| 推荐算法 | Step 6.5 |
| 组队协作 | Step 6.6 |
| 综评素材包 | Step 6.7 |
| 竞赛对接 | Step 6.8 |
| C/C++ 算法衔接 | Step 6.9 |

---

## 9. 下一步行动

1. 审批本计划
2. 完成 Phase 2 剩余步骤
3. Phase 2 完成后，启动 Phase 3 Step 3.0（数据库持久化迁移）

---

> 注：本计划基于产品方案 V3.3 和统一行动纲领制定，覆盖了从当前状态到完整平台愿景的全部剩余开发内容。Phase 6 为远期愿景，具体排期需根据 Phase 3-5 的实际进展和用户反馈调整。
