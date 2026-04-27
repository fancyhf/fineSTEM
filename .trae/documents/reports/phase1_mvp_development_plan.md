# fineSTEM Phase 1: MVP 开发计划

## 版本信息

- **版本**: v1.0
- **日期**: 2026-04-23
- **状态**: 待审批
- **遵循规范**: `g:\mediaProjects\fineSTEM\.trae\rules\project_rules.md`

---

## 项目现状总结

### 已完成的工作

1. ✅ **项目规范制定**：`project_rules.md` 已完善
2. ✅ **产品方案文档**：完整的 V3.3 产品方案 + 技术规格附件
3. ✅ **项目骨架搭建**：前后端基础架构已就绪
4. ✅ **设计系统**：Tailwind 配置 + 蓝绿色主题
5. ✅ **文件头部规范**：已给后端核心文件添加规范注释

### 当前项目结构

```
fineSTEM/
├── apps/
│   ├── backend/          # FastAPI 后端 (已搭建骨架)
│   └── frontend/         # React 前端 (已搭建骨架)
└── .trae/
    ├── rules/
    │   └── project_rules.md  # ✅ 已更新规范
    └── documents/
        ├── 产品与规划/   # ✅ 完整产品文档
        └── api-specs/    # 待完善
```

---

## Phase 1 开发范围（MVP 核心闭环）

### Phase 1 目标

实现 MVP 核心验证闭环：

```
学生进入 → 浏览 Demo → 点击"我也做一个" → fork项目 → 轻项目流程 → 成果档案卡 → 分享
```

### Phase 1 优先级

| 优先级 | 模块 | 说明 |
|--------|------|------|
| **P0** | 用户认证系统 | 注册/登录/获取当前用户 |
| **P0** | Demo 展示 + Fork | Demo 列表/详情/一键 Fork 创建项目 |
| **P0** | 轻项目模式 | 3步流程 + SKILL_STATE 管理 |
| **P0** | 成果档案卡 | 生成/查看/私有分享 |
| **P1** | 前端页面实现 | 首页/探索中心/我的项目/成果页 |
| **P1** | AI 对话集成 | ZeroClaw Gateway API 集成 (Phase 1.5) |

---

## Phase 1 详细开发计划

### Step 1: 后端核心数据模型与接口 (P0)

#### 1.1 完善数据模型 (Schemas)

**需要创建/更新的文件**：

```
apps/backend/app/schemas/
├── common.py           # 已存在，需完善 API 响应格式
├── auth.py            # 新增：用户认证相关 Schema
├── demos.py           # 已存在，需完善完整字段
├── projects.py        # 已存在，需完善 SKILL_STATE Schema
├── achievements.py    # 新增：成果档案卡 Schema
└── evidence.py        # 新增：证据 Schema
```

**具体工作内容**：

1. **`common.py`**：确保 ApiResponse 格式统一
2. **`auth.py`**：
   - User 模型（包含审计字段）
   - LoginRequest
   - RegisterRequest
   - UserResponse
3. **`demos.py`**：补全完整 Demo 字段（按产品方案 V3.3）
4. **`projects.py`**：
   - 完善 Project 模型
   - 完整的 SKILL_STATE JSON Schema (按接口规格第 4 节)
   - LightProjectStep 数据结构
5. **`achievements.py`**：AchievementCard 模型
6. **`evidence.py`**：Evidence 模型

**遵循规范**：
- ✅ API 字段使用 camelCase
- ✅ 数据库字段使用 snake_case
- ✅ 所有 Schema 类有中文 Docstring

---

#### 1.2 完善数据库层 (DB Layer)

**需要更新的文件**：

```
apps/backend/app/db/
├── memory.py          # 已存在，需扩展
├── base.py            # 新增：审计字段基类
└── models.py          # 新增：数据模型（用于真实 DB）
```

**具体工作内容**：

1. **`base.py`**：
   - `AuditFields` 基类 (created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, is_deleted)
   - `PublishFields` 基类 (is_public, submitted_at, reviewed_at, reviewed_by)
2. **`memory.py`** 扩展：
   - 用户数据存储
   - Demo 完整数据（预置 3 个示例 Demo）
   - Project 存储（包含 SKILL_STATE）
   - AchievementCard 存储
   - Evidence 存储
3. **`models.py`**：
   - 为后续 SQLAlchemy 迁移预留的真实 DB 模型定义

**遵循规范**：
- ✅ 所有时间字段使用 MCP 格式：`YYYY-MM-DD HH:MM:SS.fff`
- ✅ 逻辑删除用 is_deleted，不物理删除

---

#### 1.3 完善认证 API (Auth)

**需要创建的文件**：

```
apps/backend/app/api/
├── auth.py            # 新增：认证相关路由
└── __init__.py        # 更新
```

**API 端点清单**：

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| POST | `/api/v1/auth/register` | 用户注册 | 否 |
| POST | `/api/v1/auth/login` | 用户登录 | 否 |
| GET | `/api/v1/auth/me` | 获取当前用户信息 | 是 |
| PATCH | `/api/v1/auth/me` | 更新当前用户信息 | 是 |

**技术实现**：
- JWT 令牌认证
- 密码哈希存储
- 匿名用户访问控制

---

#### 1.4 完善 Demo API

**需要更新的文件**：

```
apps/backend/app/api/demos.py  # 已存在，需扩展
```

**API 端点**：

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/v1/demos` | Demo 列表（分页+筛选） |
| GET | `/api/v1/demos/{demoId}` | Demo 详情 |
| GET | `/api/v1/demos/{demoId}/code` | Demo 代码 |
| POST | `/api/v1/demos/{demoId}/fork` | Fork Demo 创建项目 |

**预置 3 个示例 Demo**（Phase 1）：
1. 诗词生成器（Web，Beginner）
2. 简单计算器（Web，Beginner）
3. 待办事项清单（Web，Beginner）

---

#### 1.5 完善 Projects API

**需要更新的文件**：

```
apps/backend/app/api/projects.py  # 已存在，需扩展
```

**API 端点**：

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/v1/projects` | 我的项目列表 |
| POST | `/api/v1/projects` | 创建项目 |
| GET | `/api/v1/projects/{projectId}` | 项目详情 |
| PATCH | `/api/v1/projects/{projectId}` | 更新项目 |
| DELETE | `/api/v1/projects/{projectId}` | 删除项目 |
| GET | `/api/v1/projects/{projectId}/state` | 获取 SKILL_STATE |
| PATCH | `/api/v1/projects/{projectId}/state` | 更新 SKILL_STATE（阶段推进） |
| POST | `/api/v1/projects/{projectId}/upgrade` | 轻项目升级为标准研学 |

---

#### 1.6 成果档案卡 API

**需要创建的文件**：

```
apps/backend/app/api/
├── achievement_cards.py    # 新增
└── evidence.py             # 新增
```

**AchievementCard API 端点**：

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/v1/projects/{projectId}/achievement-card` | 生成成果档案卡 |
| GET | `/api/v1/projects/{projectId}/achievement-card` | 获取成果档案卡 |
| PATCH | `/api/v1/achievement-cards/{cardId}` | 更新成果档案卡 |
| POST | `/api/v1/achievement-cards/{cardId}/share` | 生成私有分享链接 |
| GET | `/api/v1/share/{shareToken}` | 通过分享链接查看 |

**Evidence API 端点**：

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/v1/projects/{projectId}/evidence` | 获取项目证据列表 |
| POST | `/api/v1/projects/{projectId}/evidence` | 手动上传证据 |

---

#### 1.7 核心服务层 (Services)

**需要创建的文件**：

```
apps/backend/app/services/
├── __init__.py
├── auth_service.py        # 认证服务
├── demo_service.py        # Demo 服务
├── project_service.py     # 项目服务（包含 SKILL_STATE 管理）
├── achievement_service.py # 成果档案卡服务
└── project_mapper.py      # 轻项目→标准研学映射逻辑
```

---

### Step 2: 前端核心页面实现 (P0-P1)

#### 2.1 认证页面

**需要创建/更新的文件**：

```
apps/frontend/src/pages/
├── Login.tsx          # 登录页
└── Register.tsx       # 注册页
apps/frontend/src/
├── hooks/
│   └── useAuth.ts    # 认证 Hook
├── services/
│   └── api.ts        # 已存在，需扩展认证相关方法
└── types/
    └── auth.ts       # 认证类型定义
```

**功能需求**：
- 邮箱/手机号登录
- 轻量注册流程
- JWT 令牌存储
- 路由守卫（需要认证的页面）

---

#### 2.2 首页 (Home Page)

**需要更新的文件**：

```
apps/frontend/src/pages/Home.tsx  # 已存在，需完善
```

**设计要求**：
- 三入口卡片：探索中心 / AI 工作台 / 研学流程
- 学生等级引导（Level 1/2/3）
- 蓝绿色主题
- 响应式设计

---

#### 2.3 探索中心 (Explore)

**需要创建/更新的文件**：

```
apps/frontend/src/pages/
├── Explore.tsx       # 已存在，Tab 切换容器
├── ExploreDemos.tsx  # 新增：Demo 墙
├── ExploreDemoDetail.tsx  # 新增：Demo 详情
└── ExploreInspiration.tsx  # 新增：灵感墙（Phase 1 MVP 简单版）
apps/frontend/src/components/
└── DemoCard.tsx      # 新增：Demo 卡片组件
```

**Demo 墙功能**：
- Demo 网格展示
- 筛选（学科/难度/技术栈）
- 分页
- Demo 卡片：封面/名称/标签/4个动作按钮（试玩/拆解/我也做一个/保存）

**Demo 详情页功能**：
- iframe 试玩
- 项目拆解说明
- "我也做一个"按钮（触发 Fork）
- 保存到我的项目

---

#### 2.4 我的项目 (Research)

**需要创建/更新的文件**：

```
apps/frontend/src/pages/
├── Research.tsx      # 已存在，项目列表
├── ProjectDetail.tsx # 新增：项目详情
└── ProjectAchievement.tsx  # 新增：成果档案卡页
apps/frontend/src/components/
├── ProjectStageBar.tsx  # 新增：阶段进度条
├── LightProjectSteps.tsx # 新增：轻项目 3 步 UI
└── AchievementCardView.tsx # 新增：成果档案卡展示
```

**项目详情页功能**：
- 阶段进度展示
- 轻项目 3 步流程（Step 1: 想法与方向 / Step 2: 设计与实现 / Step 3: 展示与反思）
- 当前步骤表单
- 保存/下一步按钮
- 分享按钮

---

#### 2.5 成果档案卡与分享页

**需要创建/更新的文件**：

```
apps/frontend/src/pages/
├── ProjectAchievement.tsx  # 成果档案卡生成页
└── ShareAchievement.tsx    # 新增：分享查看页（无需登录）
apps/frontend/src/components/
└── AchievementCardView.tsx # 成果档案卡展示组件（复用）
```

**功能需求**：
- 成果档案卡生成（自动从项目数据生成，允许编辑）
- 复制分享链接
- 分享页（无需登录可查看）

---

#### 2.6 路由与布局完善

**需要更新的文件**：

```
apps/frontend/src/
├── App.tsx           # 已存在，完善路由
└── components/layout/
    ├── Layout.tsx    # 已存在
    ├── Navbar.tsx    # 已存在，完善导航
    └── Sidebar.tsx   # 已存在
```

**路由表**（按产品方案第 2 节）：

| 路径 | 页面 | 认证 |
|------|------|------|
| `/` | 首页 | 否 |
| `/explore` | 探索中心 | 否 |
| `/explore/demos` | Demo 墙 | 否 |
| `/explore/demos/:demoId` | Demo 详情 | 否 |
| `/research` | 我的项目 | 是 |
| `/research/projects/:projectId` | 项目详情 | 是 |
| `/research/projects/:projectId/achievement` | 成果档案卡 | 是 |
| `/share/:shareToken` | 分享查看 | 否 |
| `/auth/login` | 登录 | 否 |
| `/auth/register` | 注册 | 否 |

---

### Step 3: 前后端集成与测试 (P0)

#### 3.1 端到端测试流程

**测试用户流程**：
1. 用户访问首页 → 无需登录
2. 用户浏览 Demo 墙 → 点击某个 Demo
3. 在 Demo 详情页 → 点击"我也做一个"
4. 弹出登录/注册 → 用户注册
5. 重定向到新创建的项目页
6. 用户完成轻项目 3 步流程
7. 用户生成成果档案卡
8. 用户复制分享链接
9. 在另一浏览器打开分享链接 → 可查看档案卡

#### 3.2 基础测试覆盖

**后端测试**：
- API 接口测试
- Schema 验证测试
- 认证测试

**前端测试**：
- 组件测试
- 路由测试
- 集成测试

---

## Phase 1.5: AI 对话集成（作为可选增强）

如果 Phase 1 顺利完成，可开始 Phase 1.5 集成 ZeroClaw：

1. ZeroClaw Gateway API 对接
2. WebSocket 聊天服务
3. 场景化 AI 入口
4. 上下文注入（Demo/Project）

*注意：Phase 1.5 不在 MVP 核心验证范围内，属于增强功能。*

---

## Phase 1 交付物清单

### 代码交付

| 交付物 | 说明 |
|--------|------|
| 完整的后端 API | 认证/Demo/项目/成果/证据 |
| 完整的前端页面 | 首页/探索/项目/成果/认证 |
| 3 个预置 Demo | 可试玩 + 可 Fork |
| 完整的数据库层 | 内存数据库（含审计字段） |
| 完整的类型定义 | TypeScript/Pydantic Schemas |

### 文档交付

| 文档 | 说明 |
|------|------|
| `README.md`（根目录） | 已更新项目简介与快速开始 |
| `apps/README.md` | 已更新前后端介绍 |
| `apps/frontend/README.md` | 前端开发文档 |
| `apps/backend/README.md` | 后端开发文档 |
| `.trae/documents/api-specs/phase1_api.md` | Phase 1 API 文档 |
| `.trae/documents/testing/phase1_test_report.md` | Phase 1 测试报告（完成后） |

---

## 实施时间线（按步骤）

| 步骤 | 预估时间 | 依赖步骤 |
|------|---------|---------|
| Step 1.1: 完善数据模型 | 1-2 天 | - |
| Step 1.2: 完善数据库层 | 1 天 | Step 1.1 |
| Step 1.3: 认证 API | 1 天 | Step 1.2 |
| Step 1.4-1.6: Demo/Project/Achievement API | 2-3 天 | Step 1.3 |
| Step 1.7: 服务层 | 1-2 天 | Step 1.4-1.6 |
| Step 2.1-2.2: 认证页 + 首页 | 1-2 天 | Step 1.3 |
| Step 2.3: 探索中心 (Demo 墙) | 2 天 | Step 1.4 |
| Step 2.4: 我的项目 + 轻项目流程 | 2-3 天 | Step 1.5-1.6 |
| Step 2.5: 成果档案卡 + 分享页 | 1-2 天 | Step 2.4 |
| Step 2.6: 路由与布局完善 | 1 天 | 之前所有前端步骤 |
| Step 3: 前后端集成与测试 | 2 天 | 前后端开发完成 |

**总预估时间**: 12-18 天（非连续，可并行部分）

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| ZeroClaw 集成复杂度高 | 高 | Phase 1 不强制集成 AI，先跑通 Demo→fork→项目→成果流程 |
| 项目规范调整 | 中 | 严格遵循已有的 project_rules.md，不随意变更规范 |
| 时间不足 | 中 | 优先实现 P0 功能，P1/P2 后续迭代 |

---

## 下一步行动

### 立即执行（待用户审批后）

1. ✅ 审批此开发计划
2. 🟢 开始 Step 1.1：完善数据模型
3. 🟢 同步进行 Step 2.1-2.2：前端认证页和首页

---

## 附录：Phase 1 不包含的功能（后续版本）

以下功能在 Phase 1 暂不实现：
- ZeroClaw AI 对话集成
- 在线代码编辑器 (Monaco + WebContainer)
- 标准研学完整 9 阶段 UI
- 项目下载包
- Skill 市场
- 灵感墙完整功能（仅简单展示）
- 课程库
- 选题推荐
- 异步任务处理
- WebSocket 实时通讯
