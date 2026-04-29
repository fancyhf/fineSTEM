# fineSTEM B/S 平台产品方案：青少年 STEM 研学助手

**版本**: v3.3
**日期**: 2026-04-21
**状态**: 需求定义
**作者**: AI Agent (基于与用户的深度讨论)
**变更说明**: v3.3 在 v3.2 基础上继续收口，新增 MVP 成功判据、匿名试玩与注册时机、私有分享与公开边界、轻项目升级映射引用，并统一版本口径
**前置文档**:
- `01_产品架构与需求蓝图_V1.0.md` (双轮驱动架构)
- `AI PBL 项目式伴学体系_v2.0.md` (PBL 七步法)
- `AI PBL编程研学智慧系统需求升级v2.md` (Agent 升级)
- `fineSTEM 产品需求文档 (PRD) -MVP1 v0.1.md` (MVP1 定义)
- `初期思路.md` (项目白皮书)
- `04_fineSTEM_BS平台产品方案_V3.0.md` (v3.0 基础方案)
- `04_fineSTEM_BS平台产品方案_V3.1.md` (v3.1 转化闭环方案)
- `04_fineSTEM_BS平台产品方案_V3.2.md` (v3.2 收口方案)
- `04_fineSTEM_BS平台产品方案_V3.3_MVP成功判据与关键流程定义.md` (关键补充附件)
- `04_fineSTEM_BS平台产品方案_V3.3_接口级技术规格.md` (接口级设计附件)

---

## 1. 产品定位

### 1.1 一句话定义

**面向青少年的 STEM 研学助手平台：在线体验、AI 引导、过程驱动，从兴趣启蒙到成果展示一站式。**

### 1.2 与历史定位的演进

| 版本 | 定位 | 核心形态 | AI 角色 |
|------|------|---------|---------|
| v1.0 (白皮书) | "不用背语法，也能让计算机听你的话" | 媒体驱动 + Web终端 + IDE插件 | 苏格拉底导师 |
| v2.0 (PBL体系) | "AI PBL 项目式编程伴学体系" | Web Agent + IDE Agent | 流程引导 + 多角色Agent |
| v3.0 (基础方案) | "青少年 STEM 研学助手平台" | B/S 平台 + ZeroClaw + AI IDE 互联 | ZeroClaw Skill 驱动 |
| v3.1 | 同 v3.0 + 转化闭环 + 成果闭环 | 场景化入口 + 渐进式引导 | 过程引导增强 |
| v3.2 | 同 v3.1 + 运营边界 + MVP 收口 | 半运营式 fork + 展示规则 | 路径和边界更清晰 |
| **v3.3 (本方案)** | **青少年 STEM 研学助手平台** | **同 v3.2 + 成功判据 + 关键流程定义** | **可验证、可排期、可渐进落地** |

### 1.3 核心差异：不是编程平台

```text
传统编程平台（豆包编程 / Scratch / Code.org）：
  学生 -> 学编程 -> 做作品 -> 展示

fineSTEM v3.3：
  学生 -> 发现兴趣 -> 试玩项目 -> 我也做一个 -> 研究过程（AI引导） -> 成果展示
         ↑                                                           │
         └──────────────── AI 助手全程陪伴引导 ───────────────────────┘
```

传统平台教“怎么写代码”，fineSTEM 教“怎么完成一个项目”。代码只是工具之一。

### 1.4 核心价值主张

1. **过程驱动**：引导学生完成选题、设计、开发、验收与成果整理
2. **AI 陪伴**：AI 不是冷问答，而是有上下文的研学助手
3. **成果导向**：最终形成成果档案卡、项目作品、研学文档
4. **开放互联**：与 Trae / Cursor / VS Code 等 AI IDE 接力协作
5. **轻量起步**：30 分钟可完成一个轻项目，不要求一开始走完整流程

---

## 2. 用户模型与路径

### 2.1 核心用户：学生

学生按参与深度自然分为三级，**不是静态分层，而是逐步升级的使用路径**：

```text
Level 1 体验者 —— 先看见、先试玩、先理解
Level 2 创作者 —— 我也做一个、做出自己的版本
Level 3 深度开发者 —— 下载到 AI IDE，做完整项目
```

### 2.2 用户路径与转化目标

#### 体验路径（Level 1）

| 维度 | 设计 |
|------|------|
| 入口 | Demo 墙、课程库、灵感墙 |
| 最小目标 | 试玩一个 Demo + 问 AI 一个问题 |
| 转化触发 | 点击“我也做一个” |
| 转化机制 | 一键 fork 项目 -> 自动创建轻项目 -> AI 引导第一步改动 |

#### 创作路径（Level 2）

| 维度 | 设计 |
|------|------|
| 入口 | fork / 选题推荐 / 场景化 AI 入口“开始项目” |
| 最小目标 | 完成一个轻项目 + 生成成果档案卡 |
| 转化触发 | 代码变复杂 / 想做更完整项目 |
| 转化机制 | 提示下载项目包 + Skill 安装指引，进入 AI IDE 深度开发 |

#### 深度开发路径（Level 3）

| 维度 | 设计 |
|------|------|
| 入口 | 项目下载中心 / Skill 市场 / 远程 AI 咨询 |
| 最小目标 | 在 AI IDE 中完成标准研学项目 |
| 转化触发 | 想展示成果 |
| 转化机制 | 上传成果档案卡到灵感墙，形成回流 |

**核心转化链路**：

```text
看见 -> 体验 -> 理解 -> 我也做 -> 变成我的 -> 完善 -> 成果 -> 展示 -> 激励他人
  │      │      │       │         │         │      │      │
Demo墙  试玩    AI解释   fork项目   轻项目    标准项目  档案卡  灵感墙
```

### 2.3 用户范围

平台长期采用单一用户形态：**学生**。

| 用户类型 | 使用方式 | 权限 | 可见内容 |
|---------|---------|------|---------|
| 学生 | 浏览、创作、分享、发布成果 | 全部（限本人项目） | 本人项目与公开展示内容 |

**分享与展示机制**：

| 规则 | 说明 |
|------|------|
| 默认私有 | 档案卡默认私有，仅生成分享链接 |
| 学生主动分享 | 学生主动复制分享链接 |
| 可发布到灵感墙 | 学生主动开启“发布到灵感墙” |
| 可撤回展示 | 学生可关闭公开展示 |
| 匿名展示 | 灵感墙默认不展示真实姓名和头像 |

**业务状态建议统一**：凡是涉及“分享链接 / 发布到灵感墙”的内容，统一采用同一套轻量展示字段，详见 `9.1 分享与展示字段规范`。

### 2.4 匿名试玩与注册时机

MVP 阶段采用：**试玩匿名化，保存注册化。**

| 场景 | 是否要求注册 | 说明 |
|------|-------------|------|
| 浏览 Demo 墙 | 否 | 允许匿名浏览 |
| 试玩 Demo | 否 | 允许匿名体验 |
| 问一个简单问题 | 否 | 允许匿名试用，次数受限 |
| 点击“我也做一个” | 建议注册 | 创建个人项目前弹出轻注册 |
| 保存到“我的项目” | 是 | 项目必须归属账号 |
| 生成成果档案卡 | 是 | 需要归属与可追踪 |
| 分享链接 | 是 | 需要稳定链接归属 |

更细的定义见：`04_fineSTEM_BS平台产品方案_V3.3_MVP成功判据与关键流程定义.md`

---

## 3. 功能模块

### 3.1 模块全景

```text
┌──────────────────────────────────────────────────────────────┐
│                     fineSTEM 平台                             │
├────────────┬─────────────────┬───────────────┬───────────────┤
│  探索中心   │   AI 工作台      │  研学流程      │  AI IDE 互联  │
│  Explore   │   Create        │  Research     │  Connect      │
├────────────┼─────────────────┼───────────────┼───────────────┤
│ Demo 墙    │ 场景化 AI 入口   │ 我的项目       │ Skill 市场    │
│ 课程库     │ AI 对话面板      │ 研学工单       │ 项目导入导出  │
│ 灵感墙     │ 在线代码编辑器   │ 研学文档       │ 远程 AI 咨询  │
│            │ 项目下载中心     │ 成果档案卡     │               │
└────────────┴─────────────────┴───────────────┴───────────────┘
```

### 3.2 探索中心

#### 3.2.1 Demo 墙

**设计原则**：Demo 墙不只是展示，而是主转化入口。

每个 Demo 卡统一提供 4 个动作：

| 动作 | 说明 | 转化目标 |
|------|------|---------|
| 先试玩 | HTML/JS 可交互试玩；动态项目提供增强静态展示 | 让学生先看见 |
| 看拆解 | AI 解释代码 / 架构 / 关键片段 | 让学生先理解 |
| 我也做一个 | 一键 fork，不跳空白聊天框 | 让学生动手 |
| 保存到我的项目 | 保存 fork 项目 | 让学生拥有 |

**fork 最小可改版原则**：

- 保留核心逻辑
- 去掉复杂功能
- 标记“你可以改这里”
- 附带 3 个改动建议
- 预填推荐目标和默认成果页模板

**fork 模板生成策略**：

| 阶段 | 策略 | 说明 |
|------|------|------|
| MVP | 人工模板 | 为 3 个初始 Demo 各做 1 个高质量模板 |
| 验证期 | 收集反馈 | 观察完成率与改动模式 |
| 增长期 | 半自动生成 | 基于模板规则 + AI 辅助，人工审核 |

**展示方式**：

| 项目类型 | 方式 |
|---------|------|
| 纯 HTML/JS | iframe 交互嵌入 |
| Flask / Streamlit | 截图 + 录屏 + 输入输出示例 + 项目拆解卡 + 最小可复刻版 |

#### 3.2.2 课程库

- 融合式学习 Demo
- 按学科 / 难度 / 年级 / 标签筛选
- 每个课程关联 Demo 与 AI 问答入口

#### 3.2.3 灵感墙

- 展示学生的成果档案卡，而不是直接展示代码
- 支持“我也能做”回流到 fork
- MVP 阶段只需要预留结构；公开投稿与审核在后续强化

### 3.3 AI 工作台

#### 3.3.1 场景化 AI 入口

采用“场景化入口优先，自由输入为辅”。

| 入口 | 场景 | 自动上下文 |
|------|------|-----------|
| 问问题 | 看 Demo 时有疑问 | 当前 Demo |
| 解释代码 | 看代码时不懂 | 当前代码片段 |
| 开始项目 | 想做一个东西 | fork 来源 / 当前题目 |
| 写报告 | 项目已接近完成 | 当前项目阶段与证据 |

#### 3.3.2 在线代码编辑器

- `Monaco Editor`
- JS 优先支持 `WebContainer`
- Python 后续支持 `Pyodide`
- 复杂代码引导到 AI IDE 本地继续

#### 3.3.3 项目下载中心

- 项目包下载
- AI IDE 安装指引
- Skill 使用教程

### 3.4 研学流程

#### 3.4.1 我的项目

- 进行中 / 已完成
- 阶段进度条 + 工件状态 + 时间线
- 项目模式标识：轻项目 / 标准研学（见 `3.4.2`）

#### 3.4.2 双项目模式

**设计原则**：轻项目是默认入口，标准研学是升级路径。

##### 轻项目模式

| 维度 | 设计 |
|------|------|
| 时长 | 30 分钟 ~ 2 小时 |
| 结构 | 3 步流程 |
| 目标 | 做出一个可运行 Demo + 一段简短反思 |
| 产出 | 成果档案卡（轻量版） |
| 升级 | 随时升级到标准研学，已有数据继承 |

**轻项目 3 步**：

```text
Step 1 想法与方向 -> 项目名称 + 一句话描述 + 核心功能列表
Step 2 设计与实现 -> 可运行代码 + 关键截图
Step 3 展示与反思 -> 成果档案卡 + 简短反思
```

##### 标准研学模式

| 维度 | 设计 |
|------|------|
| 时长 | 6 小时 ~ 12 小时+ |
| 结构 | 完整 9 阶段 |
| 目标 | 完成完整研学项目 |
| 产出 | 成果档案卡 + 研学文档包 |

**升级映射原则**：

- 轻项目不是重开
- 已填内容尽量继承
- 已有代码和截图直接复用
- 系统先帮学生生成草稿，再补缺失内容

更细的字段映射见：`04_fineSTEM_BS平台产品方案_V3.3_MVP成功判据与关键流程定义.md`

#### 3.4.3 研学工单

**表达原则**：强调“阶段成就”，弱化“流程负担”。

每个阶段统一展示：

- 你现在在哪一步
- 做完这一步会得到什么
- 最小完成标准是什么
- AI 可以怎么帮你

**标准研学 9 阶段**：

| 阶段 | 名称 | 主要产出 | 成就描述 |
|------|------|---------|---------|
| stage_00 | 初始化 | 项目目录 + `SKILL_STATE.json` | 项目已创建 |
| stage_01 | 脑爆选题 | 脑爆记录 + 选题方向 | 找到了方向 |
| stage_02 | 开题立项 | 项目立项书 | 立项成功 |
| stage_03 | 范围裁剪 | 范围约束文档 | 范围明确 |
| stage_04 | 轨道选择 | 技术轨道规划 | 技术选定 |
| stage_05 | 设计蓝图 | 设计方案 + 代码框架 | 蓝图完成 |
| stage_06 | 分步计划 | 分步执行计划 | 计划就绪 |
| stage_07 | 执行开发 | 源代码 + 开发日志 | 代码跑起来了 |
| stage_08 | 验收展示 | 验收评估 | 项目完成 |

#### 3.4.4 研学文档

- 开题报告 / 技术报告 / 结题报告 / 论文（可选）
- AI 辅助生成结构和引导，不代写
- 导出 `PDF / DOCX / PPTX`
- 证据优先使用自动采集结果

#### 3.4.5 成果档案卡

**定位**：成果展示的核心单元，也是学生对外展示项目的最小载体。

**字段**：

- 项目名称
- 一句话介绍
- 我解决了什么问题
- 我用了什么方法
- 项目截图或演示链接
- 我的反思
- AI 总结的能力标签
- 项目模式
- 完成时间

**分享机制**：

- 默认私有
- 可复制分享链接
- 可发布到灵感墙
- 可随时撤回展示

**下一步推荐**：

成果页底部展示“下一步挑战”，基于能力标签和当前难度，推荐：

- 同难度变体项目
- 难度升级项目
- 下载到 AI IDE 深度开发

MVP 阶段采用规则匹配，不做复杂推荐算法。

#### 3.4.6 自动证据采集机制

原则：**平台自动优先，手动补充为辅**。

| 层级 | 机制 |
|------|------|
| 平台自动 | 阶段变更记录 |
| 平台自动 | AI 对话摘要 |
| 扩展自动 | 代码版本记录 |
| 半自动 | 截图按钮 / 保存运行结果 |
| 手动 | 外部文件上传 |

### 3.5 AI IDE 互联

#### 3.5.1 Skill 市场

- fineSTEM Skill 列表
- 安装指引
- 使用教程

#### 3.5.2 项目导入 / 导出

| 状态 | 说明 |
|------|------|
| 导出副本 | 默认，不持续同步 |
| 绑定项目 | 后续支持，持续同步 |
| 冲突处理 | 后续支持，定义优先规则 |

MVP 阶段只实现“导出副本”。

#### 3.5.3 远程 AI 咨询

- 不在 AI IDE 里也能问 AI
- 支持项目上下文关联

---

## 4. 技术架构

### 4.1 整体架构

```text
浏览器：Vite + React + TypeScript + Tailwind CSS（SPA）
  ├─ 探索中心
  ├─ AI 工作台
  ├─ 研学流程
  └─ AI IDE 互联

服务端：
  ├─ API Server（FastAPI + Python 3.12+）
  │   ├─ 用户认证
  │   ├─ 项目 CRUD + SKILL_STATE
  │   ├─ Demo / 课程 / 档案卡管理
  │   ├─ 文件存储
  │   ├─ 证据采集服务
  │   └─ 代码沙箱编排
  └─ ZeroClaw Runtime
      ├─ Provider（云端 LLM）
      ├─ Memory（SQLite + 向量嵌入）
      ├─ Tunnel（WebSocket）
      └─ fineSTEM Skills
```

### 4.2 技术选型（已决策）

| 层 | 选型 | 决策理由 | 备注 |
|---|------|---------|------|
| **前端** | Vite + React + TypeScript + Tailwind CSS | MVP1 已验证；SPA 不需要 SSR；轻量快速；不再更换 | 不使用 Next.js（SEO 不需要） |
| **后端** | FastAPI + Python 3.12+ | MVP1 已验证；Python 生态丰富；团队熟悉；不再更换 | 与 ZeroClaw 通过 Gateway API 对接（语言无关） |
| **数据库** | SQLite（开发）/ PostgreSQL（生产） | 轻量起步，后续按需升级 | — |
| **代码沙箱** | WebContainer（JS）/ Pyodide（Python） | 浏览器内运行，零服务器成本 | JS 优先，Python 后续 |
| **AI 运行时** | ZeroClaw | 极致轻量；Trait 可插拔；Rust 安全性 | Phase 2 集成 |

**ZeroClaw 集成方式**：FastAPI 与 ZeroClaw 通过 Gateway API 对接（HTTP/WebSocket），不要求同语言。FastAPI 处理业务逻辑，ZeroClaw 处理 AI 对话和 Skill 执行，两者独立部署、独立扩展。

### 4.3 技术选型原则

1. 已选型不再更换（FastAPI + Vite/React/Tailwind）
2. 不考虑 SEO（纯 SPA）
3. 在线体验优先
4. 优先复用已有 Demo 与 stem-pbl-guide 资产
5. ZeroClaw 通过 Gateway API 对接，语言无关

### 4.3 分阶段集成

```text
Phase 1: 平台骨架 + 转化闭环
  - Demo 墙
  - fork 模板
  - 轻项目模式
  - 成果档案卡

Phase 2: ZeroClaw 集成 + AI 能力
  - 场景化 AI 入口
  - StemPblGuide Skill 移植
  - KnowledgeBase

Phase 3: 研学引擎 + 成果闭环
  - 标准研学模式
  - 研学工单
  - 研学文档
  - 证据采集
  - 项目下载

Phase 4: 完整体验 + 互联
  - 在线代码编辑器
  - CodeRunner
  - IDEConnector
  - Skill 市场
  - 灵感墙强化
```

### 4.4 服务边界与上下文协议

FastAPI 与 ZeroClaw 是两个独立服务，AI 必须知道"当前是谁、在哪个项目、处于哪个阶段"，否则会出现跨项目串上下文或读到不该读的数据。

#### 4.4.1 会话与上下文传递链路

```text
浏览器
  │ HTTP 请求携带 Authorization: Bearer <jwt>
  ▼
FastAPI
  │ 1. 验证 JWT → 解出 userId
  │ 2. 从业务库查询用户当前 projectId / currentStage
  │ 3. 生成 sessionId = f(userId, projectId, timestamp)
  │ 4. 调用 ZeroClaw Gateway API 时附加上下文头
  ▼
ZeroClaw Gateway API
  │ 接收上下文头：
  │   X-Session-Id:    <sessionId>
  │   X-User-Id:       <userId>
  │   X-Project-Id:    <projectId>
  │   X-Current-Stage: <currentStage>
  │   X-User-Role:     <role>
  ▼
ZeroClaw Runtime
  │ 1. 按 sessionId 隔离 Memory（项目级记忆不跨项目）
  │ 2. Skill 执行时从上下文头获取 projectId / currentStage
  │ 3. Skill 需要读写业务数据时，回调 FastAPI API（不直接访问业务库）
```

#### 4.4.2 上下文字段定义

| 字段 | 生成方 | 传递方式 | 用途 |
|------|--------|---------|------|
| `userId` | FastAPI（JWT 解析） | 上下文头 | AI 知道"谁在问" |
| `projectId` | FastAPI（业务库查询） | 上下文头 | AI 知道"在哪个项目" |
| `currentStage` | FastAPI（业务库查询） | 上下文头 | AI 知道"处于哪个阶段" |
| `sessionId` | FastAPI（生成） | 上下文头 | 隔离 AI Memory，防止跨项目串上下文 |
| `userRole` | FastAPI（JWT 解析） | 上下文头 | 权限透传 |

#### 4.4.3 工具调用鉴权

ZeroClaw Skill 执行工具调用时，必须遵守项目级鉴权：

| 规则 | 说明 |
|------|------|
| Skill 只能访问当前 projectId 的数据 | 通过上下文头中的 projectId 约束 |
| Skill 读写业务数据必须回调 FastAPI API | ZeroClaw 不直接访问业务数据库 |
| Skill 不可跨项目读取 | sessionId 隔离 Memory，projectId 约束 API 调用 |
| FastAPI API 侧二次鉴权 | 即使 ZeroClaw 传了 projectId，FastAPI 仍验证该用户是否有权访问此项目 |

```text
Skill 需要读取项目数据时：
  Skill → ZeroClaw Runtime → FastAPI API（带 userId + projectId）→ 验证权限 → 返回数据

Skill 不可直接：
  Skill → 业务数据库（禁止）
  Skill → 其他项目的 Memory（禁止，sessionId 隔离）
```

### 4.5 状态主从原则

系统存在两个状态源：FastAPI 业务数据库和 ZeroClaw Memory。必须明确主从关系，否则会出现状态不一致。

#### 4.5.1 核心原则

**业务数据库是唯一事实来源（Source of Truth）。ZeroClaw Memory 仅作 AI 辅助缓存，不承载业务状态主记录。**

| 数据类别 | 事实来源 | 辅助缓存 | 说明 |
|---------|---------|---------|------|
| 项目阶段（currentStage） | FastAPI 业务库 | — | 不缓存到 Memory |
| SKILL_STATE | FastAPI 业务库 | — | 不缓存到 Memory |
| 证据（Evidence） | FastAPI 业务库 | — | 不缓存到 Memory |
| 成果档案卡 | FastAPI 业务库 | — | 不缓存到 Memory |
| 用户信息 | FastAPI 业务库 | — | 不缓存到 Memory |
| AI 对话历史 | ZeroClaw Memory | — | AI 对话是 Memory 的本职 |
| AI 对话摘要 | ZeroClaw Memory → 回写 FastAPI | ZeroClaw Memory | 摘要生成后回写业务库作为证据 |
| 项目上下文快照 | — | ZeroClaw Memory | AI 需要的项目背景信息，从业务库注入 |

#### 4.5.2 同步规则

```text
写入方向：
  前端 → FastAPI → 业务库（事实来源）
  前端 → FastAPI → ZeroClaw（上下文头注入，不写 Memory）
  ZeroClaw AI 摘要 → 回写 FastAPI → 业务库（作为证据）

读取方向：
  前端 ← FastAPI ← 业务库（所有业务状态查询）
  ZeroClaw ← 上下文头（每次请求注入最新状态，不依赖 Memory 缓存业务状态）

禁止方向：
  ZeroClaw Memory → 作为业务状态来源（禁止）
  ZeroClaw → 直接写业务库（禁止，必须通过 FastAPI API）
```

#### 4.5.3 导出一致性保证

导出项目包时，所有数据从业务库读取，不从 ZeroClaw Memory 读取。这保证导出内容与业务状态一致。

### 4.6 异步任务层

产品中存在一批不适合纯同步请求的长耗时动作，需要异步执行机制。

#### 4.6.1 异步任务清单

| 任务 | 触发方式 | 预估耗时 | 优先级 |
|------|---------|---------|--------|
| 项目包生成（.zip） | 学生点击"下载项目包" | 2-5 秒 | P0 |
| 研学文档导出（PDF/DOCX/PPTX） | 学生点击"导出" | 3-10 秒 | P1 |
| AI 对话摘要生成 | 对话结束时自动触发 | 1-3 秒 | P0 |
| 证据整理与编排 | 生成成果档案卡前自动触发 | 1-3 秒 | P1 |
| 嵌入向量生成 | 项目内容变更后 | 1-5 秒 | P2 |

#### 4.6.2 最小架构设计

MVP 阶段不引入完整消息队列，采用 FastAPI 内置的 `BackgroundTasks` + 轮询模式：

```text
前端
  │ POST /api/tasks { type: "generate_project_package", projectId: "xxx" }
  ▼
FastAPI
  │ 1. 创建 TaskRecord（taskId, status=pending, createdAt）
  │ 2. 将任务加入 BackgroundTasks 队列
  │ 3. 立即返回 { taskId, status: "pending" }
  ▼
前端
  │ GET /api/tasks/{taskId}  （轮询）
  ▼
FastAPI BackgroundTasks
  │ 执行任务 → 更新 TaskRecord（status=completed/failed, resultUrl/errorMessage）
```

#### 4.6.3 数据模型

```text
TaskRecord {
  id: string
  type: "generate_project_package" | "export_document" | "ai_summary"
      | "compile_evidence" | "generate_embedding"
  status: "pending" | "running" | "completed" | "failed"
  userId: string
  projectId: string
  resultUrl: string?       // 完成后的下载链接
  errorMessage: string?    // 失败原因
  // inherits AuditFields
}
```

#### 4.6.4 后续演进

MVP 跑通后，如果任务量增大或需要更可靠的执行保障，可升级为：
- Celery + Redis（Python 生态成熟方案）
- 或简单的任务表 + Worker 进程

### 4.7 文件与对象存储策略

#### 4.7.1 文件分类与存储位置

| 文件类型 | 存储位置 | 访问方式 | 说明 |
|---------|---------|---------|------|
| 项目包（.zip） | `D:\data\finestem\packages\` | 临时下载链接（有效期24h） | 按需生成，定期清理 |
| 截图（证据/档案卡） | `D:\data\finestem\uploads\` | 通过 FastAPI 鉴权后返回 | 按 projectId 组织目录 |
| 导出文档（PDF/DOCX/PPTX） | `D:\data\finestem\exports\` | 临时下载链接（有效期24h） | 按需生成，定期清理 |
| Demo 静态资源（截图/录屏） | `D:\data\finestem\demos\` | FastAPI 静态文件服务 | 开发者上传 |
| fork 模板 | `D:\data\finestem\templates\` | FastAPI 读取 | 开发者维护 |
| AI 对话摘要 | 业务数据库（文本字段） | API 查询 | 不单独存文件 |

#### 4.7.2 目录结构

```text
D:\data\finestem\
├── packages\              # 项目包下载
│   └── {projectId}\
│       └── {timestamp}.zip
├── uploads\               # 用户上传文件
│   └── {projectId}\
│       ├── screenshots\
│       └── evidence\
├── exports\               # 文档导出
│   └── {projectId}\
│       └── {timestamp}.{pdf|docx|pptx}
├── demos\                 # Demo 资源
│   └── {demoId}\
│       ├── screenshots\
│       ├── videos\
│       └── breakdown.md
└── templates\             # fork 模板
    └── {demoId}\
        ├── skeleton\      # 代码骨架
        └── meta.json      # 模板元数据（改动建议等）
```

#### 4.7.3 环境分层

| 环境 | 数据库 | 文件存储 | AI Runtime |
|------|--------|---------|-----------|
| 开发 | SQLite（项目目录下） | 本地磁盘 `D:\data\finestem\` | 不部署（Mock AI） |
| 生产 | PostgreSQL | 对象存储（如 S3/MinIO）或本地磁盘 | ZeroClaw Runtime |

**开发与生产同构原则**：文件访问统一通过 FastAPI API 抽象层，开发环境用本地磁盘实现，生产环境可无缝切换到对象存储，业务代码不感知底层存储差异。

```text
FastAPI 文件服务抽象层：
  FileStorageService.store(category, projectId, filename, content) → url
  FileStorageService.retrieve(url) → content
  FileStorageService.delete(url) → void

开发环境实现：LocalFileStorageService（本地磁盘）
生产环境实现：S3FileStorageService 或 MinIOFileStorageService
```

---

## 5. ZeroClaw Skills 规划

### 5.1 核心 Skills

#### StemPblGuide

- 9 阶段状态机
- 轻项目 / 标准研学双模式
- 教学模式支持
- `SKILL_STATE.json` 兼容

#### CodeRunner

- 在线代码执行
- JS 先行，Python 后续

#### KnowledgeBase

- 课程库 + 案例库 + 题库检索
- 支持按学科 / 兴趣词 / 竞赛类型等检索

#### DemoExplorer

- Demo 解释
- 引导“我也做一个”
- 生成最小可改版 fork

#### IDEConnector

- 项目下载包
- Skill 安装指引
- 后续扩展项目绑定同步

### 5.2 Skill 开发原则

1. 自主开发
2. 聚焦教育研学
3. 平台 / AI IDE 双跑
4. 数据格式兼容

---

## 6. 与历史文档的查漏补缺

### 6.1 已覆盖的历史需求

| 历史需求 | 本方案覆盖 |
|---------|-----------|
| Web 自适应交互终端 | AI 工作台 |
| IDE Agent 伴学系统 | AI IDE 互联 |
| PBL 七步法 | 标准研学 9 阶段 |
| 半定制课程 | 课程库 + AI 推荐 |
| 文档产出标准 | 研学文档 |
| 苏格拉底式教学 | StemPblGuide 教学模式 |

### 6.2 v3.x 关键新增

- 用户路径与转化目标
- 轻项目 / 标准研学双模式
- Demo -> fork -> 项目 -> 成果 的闭环
- 成果档案卡
- 自动证据采集
- 场景化 AI 入口
- 匿名试玩与注册时机
- 分享与公开边界
- fork 半运营式策略
- 内容维护最小模型

---

## 7. MVP 实施范围

### 7.1 MVP 原则

**先验证转化闭环，再补强技术能力。**

MVP 核心问题不是“功能够不够多”，而是：

**学生是否愿意从 Demo 出发，在 AI 引导下完成一个轻项目，并生成可分享的成果。**

### 7.2 MVP 模块优先级

| 模块 | MVP 范围 | 优先级 |
|------|---------|--------|
| 首页 / 导航 | 三入口 + 学生等级引导 | P0 |
| Demo 墙 | 含 fork 机制（人工模板） | P0 |
| 场景化 AI 入口 | 4 个高频入口 + 上下文注入 | P0 |
| AI 对话 | ZeroClaw 集成 + 场景入口驱动 | P0 |
| 轻项目模式 | 3 步流程 + 成果档案卡生成 | P0 |
| 标准研学模式（数据层） | 9 阶段数据模型 + 接口预留 | P0 |
| 标准研学模式（UI 层） | 9 阶段完整界面 | P1 |
| 成果档案卡 | 生成 + 分享 + 下一步推荐 | P0 |
| 自动证据采集（最小版） | 阶段变更 + AI 摘要 | P0 |
| 自动证据采集（扩展版） | 代码版本 + 截图按钮 | P1 |
| 研学文档 | 模板 + AI 辅助生成 + 导出 | P1 |
| 在线代码编辑器 | Monaco + JS 沙箱 | P1 |
| 项目下载 | 项目包 + AI IDE 指引 | P0 |
| Skill 市场 | Skill 列表 + 安装命令 | P1 |
| 灵感墙 | 成果档案卡展示 + 一键 fork | P2 |
| 用户系统 | 注册 / 登录 + 项目归属 | P0 |
| ZeroClaw 集成 | Runtime + Traits + 核心 Skills | P0 |

### 7.3 MVP 核心验证闭环

```text
1. 学生进入平台
2. 看到 Demo
3. 点击“我也做一个”
4. 获得一个高质量 fork 模板
5. 在 AI 引导下完成轻项目
6. 生成成果档案卡
7. 复制分享链接
```

**灵感墙展示属于 P2，不作为 MVP 是否成功的前置条件。**

### 7.4 MVP 成功判据

MVP 阶段建议至少持续观测以下 4 个核心指标：

| 指标 | 定义 |
|------|------|
| Demo -> fork 点击率 | 试玩 Demo 后点击“我也做一个”的比例 |
| fork -> 轻项目完成率 | 创建项目后完成轻项目并生成档案卡的比例 |
| 成果档案卡生成率 | 创建项目后最终生成成果页的比例 |
| 成果分享率 | 生成成果页后主动分享的比例 |

只要以下三件事成立，就可判定 MVP 主闭环初步成立：

1. 学生能从 Demo 进入自己的项目
2. 学生能在 AI 引导下完成一个轻项目
3. 学生完成后愿意生成并分享成果档案卡

更细指标定义见附件：`04_fineSTEM_BS平台产品方案_V3.3_MVP成功判据与关键流程定义.md`

### 7.5 实施阶段

```text
Phase 1: 平台骨架 + 转化闭环
Phase 2: ZeroClaw 集成 + AI 能力
Phase 3: 研学引擎 + 成果闭环
Phase 4: 完整体验 + 互联
```

---

## 8. 关键设计决策

### 8.1 引导强度：渐进式解锁

- 轻项目是默认入口
- 轻项目可升级为标准研学
- AI 建议但不强制
- 门禁保证最低质量底线

### 8.2 转化机制：Demo -> 项目 -> 成果

- “我也做一个”不跳到空白聊天框
- fork 项目自带骨架与最小任务
- 成果档案卡是一处生成、多处复用的核心展示单元

### 8.3 平台与 AI IDE 的关系：接力而非竞争

- 平台负责轻体验和流程引导
- AI IDE 负责深度开发
- 通过项目包和 Skill 自然接力

### 8.4 AI 入口策略：场景化优先

- 问问题
- 解释代码
- 开始项目
- 写报告

### 8.5 证据策略：自动优先

- 平台自动采集 > 半自动提醒 > 手动上传
- 报告自动引用证据

### 8.6 内容维护最小模型

| 职责 | MVP 阶段 |
|------|---------|
| Demo 维护 | 开发者手动维护 |
| fork 模板维护 | 开发者制作 3 个模板 |
| 课程元数据 | 开发者手动编辑 |
| 灵感墙展示开关 | 学生自主控制 |
| 推荐位管理 | 固定排序 |

最小维护动作：

- Demo 增删改
- fork 模板增删改
- 课程元数据维护
- 推荐位顺序调整

---

## 9. 数据模型核心实体

### 9.0 通用审计字段规范

所有核心表统一继承同一套审计字段，不在各实体中重复定义，以避免字段缺失或口径不一致。

**时间字段格式统一**：所有时间字段均采用统一时间格式 `YYYY-MM-DD HH:MM:SS.fff`（UTC）。

```text
AuditFields {
  createdAt: timestamp
  createdBy: string
  updatedAt: timestamp
  updatedBy: string
  deletedAt: timestamp?
  deletedBy: string?
  isDeleted: boolean
}
```

说明：

- `createdAt / updatedAt / deletedAt` 为系统审计时间
- `createdBy / updatedBy / deletedBy` 记录操作者标识
- `isDeleted` 表示逻辑删除状态
- 业务状态字段不并入审计字段，例如 `visibility`、`shareToken`、`currentStage`

### 9.1 分享与展示字段规范

审计字段解决“谁在什么时间改了数据”，分享字段只解决“链接分享与灵感墙展示状态”。

适用对象：

- 成果档案卡（分享链接与灵感墙展示）
- 其他需要“学生主动展示”的内容实体

```text
ShareFields {
  shareToken: string?
  visibility: "private" | "link" | "wall"
  sharedAt: timestamp?
}
```

说明：

- `shareToken`：分享链接令牌
- `visibility`：私有、链接可见、灵感墙展示
- `sharedAt`：最近一次开启分享或展示的时间
- 时间字段同样采用 `YYYY-MM-DD HH:MM:SS.fff`（UTC）

业务边界：

- `currentStage` 等流程状态字段不混入分享字段
- 审计字段与分享字段可以同时存在，互不替代

### 9.2 用户

```text
User {
  id: string
  name: string
  email: string
  role: "student"
  level: 1 | 2 | 3
  capabilityTags: string[]
  // inherits AuditFields
}
```

### 9.3 项目

```text
Project {
  id: string
  userId: string
  name: string
  mode: "light" | "standard"
  sourceDemoId: string?
  skillState: SKILL_STATE
  currentStage: string
  evidenceItems: Evidence[]
  // inherits AuditFields
}
```

### 9.4 Demo

```text
Demo {
  id: string
  name: string
  techStack: string
  displayMode: "iframe" | "static"
  screenshots: string[]
  demoVideoUrl: string?
  projectBreakdown: string?
  minimalReplica: string?
  codeUrl: string
  downloadUrl: string
  // inherits AuditFields
  // may inherit ShareFields when enabled for showcase
}
```

### 9.5 成果档案卡

```text
AchievementCard {
  id: string
  projectId: string
  title: string
  oneLiner: string
  problemSolved: string
  methodUsed: string
  screenshots: string[]
  reflection: string
  capabilityTags: string[]
  projectMode: "light" | "standard"
  // inherits AuditFields
  // inherits ShareFields for sharing and showcase
}
```

### 9.6 证据

```text
Evidence {
  id: string
  projectId: string
  type: "auto_stage_change" | "auto_ai_summary" | "auto_code_version"
      | "semi_screenshot" | "semi_run_result" | "manual_upload"
  content: string
  stageTag: string?
  // inherits AuditFields
}
```

---

## 10. 风险与待决事项

### 10.1 待决事项

| 事项 | 影响 | 建议 |
|------|------|------|
| WebContainer 兼容性 | 在线运行 | 先验证主流浏览器支持 |
| Pyodide 包支持范围 | Python 沙箱 | 标准库先行 |
| stem-pbl-guide 移植工作量 | 核心功能 | 优先复用逻辑层 |
| 轻项目 -> 标准研学映射 | 数据兼容 | 先做最小继承，再精细化 |
| fork 模板质量 | 转化效果 | 先手工做 3 个高质量模板 |

### 10.2 已决策事项

| 事项 | 决策 | 日期 | 理由 |
|------|------|------|------|
| API Server 技术选型 | **FastAPI + Python 3.12+** | 2026-04-21 | MVP1 已验证；不再更换 |
| 前端框架选型 | **Vite + React + TypeScript + Tailwind CSS** | 2026-04-21 | MVP1 已验证；SPA 不需要 SSR；不再更换 |
| ZeroClaw 集成方式 | **Gateway API 对接（语言无关）** | 2026-04-21 | FastAPI 处理业务，ZeroClaw 处理 AI，独立部署 |

### 10.3 风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| ZeroClaw API 变化 | 中 | 高 | 抽象适配层 |
| 云端 LLM 成本 | 高 | 中 | 用量限制 + 缓存 |
| 代码沙箱安全 | 低 | 高 | WebContainer / Pyodide 隔离 |
| Level 1 不转化 | 中 | 中 | fork 模板 + 轻项目模式 |
| fork 模板质量不稳定 | 中 | 中 | 先手工验证后再自动化 |

### 10.4 明确不在 MVP 范围内的功能

以下功能在 V3.3 需求中不存在，不应出现在代码库中：

| 功能 | 说明 | 处理方式 |
|------|------|---------|
| 升学规划（港澳/国际/背景提升） | 历史版本残留，V3.3 已收口为 STEM 研学 | 已删除 |
| 问卷引擎 | 不属于学生主闭环 | 已删除 |
| 知识来源管理 | 不属于学生主闭环 | 已删除 |
| 独立对话页面 | AI 对话应嵌入创造页 | 已合并 |
| 独立代码编辑器页面 | 编辑器应嵌入项目/创造页 | 已合并 |
| 审计日志用户面 | 审计是内部治理，不面向学生 | 已移除用户面 |
| 旧赛道（TrackA/TrackE） | V3.3 已统一为轻项目/标准研学双模式 | 已删除 |
| 独立课程库页面 | 课程库应在探索中心 Tab 内 | 已合并 |
| 仪表板页面 | 需求中无此页面 | 已删除 |

完整功能清单见：`04_fineSTEM_BS平台系统功能清单_V1.0.md`

---

## 11. 版本信息

- **版本**: v3.3
- **日期**: 2026-04-21
- **变更说明**: v3.3 补齐 MVP 成功判据、匿名试玩与注册时机、分享与展示边界、轻项目升级映射引用；技术选型已决策（FastAPI + Vite/React/Tailwind + ZeroClaw Gateway API 对接）；补齐服务边界与上下文协议、状态主从原则、异步任务层、文件与对象存储策略；接口级技术规格见附件
- **前置文档**: 本方案继承并升级 v1.0~v3.2 的核心需求
