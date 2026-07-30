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

| 你要做的事 | 先读这个 | 关键代码入口 |
|------------|----------|-------------|
| **理解整体架构** | 本文档 §技术架构 + [后端 README](./apps/backend/README.md) + [前端 README](./apps/frontend/README.md) | — |
| **改后端 API / 业务逻辑** | [后端 README](./apps/backend/README.md) | `apps/backend/app/api/` → `app/services/` → `app/repositories/` |
| **改前端页面 / 交互** | [前端 README](./apps/frontend/README.md) | `apps/frontend/src/pages/` → `src/components/` |
| **改 AI 对话流 / WebSocket** | [前端 README §核心链路](./apps/frontend/README.md#核心数据流) | `apps/frontend/src/hooks/useStreamingChat.ts` |
| **改 AI 工具（MCP）** | [后端 README §MCP 工具](./apps/backend/README.md#mcp-工具注册表15-个) | `apps/backend/app/services/tools.py` + `app/mcp_server/server.py` |
| **改 PBL 阶段 / 门禁逻辑** | [后端 README §PBL 引擎](./apps/backend/README.md#pbl-9-阶段引擎) | `apps/backend/app/services/stage_constants.py` + `pbl_engine.py` |
| **改数据库表结构** | [后端 README §数据架构](./apps/backend/README.md#数据架构) | `apps/backend/app/db/models.py` + `db/migrations/` |
| **改问题卡片解析** | [前端 README §问题卡片](./apps/frontend/README.md#问题卡片双重防线) | `apps/frontend/src/lib/questionParser.ts` + `apps/backend/app/services/question_verifier.py` |
| **查已知 bug / 回归** | [问题清单](./.trae/documents/问题清单_长期维护.md) | Q-001 ~ Q-023 |
| **跑测试** | [后端测试 README](./apps/backend/tests/README.md) + [前端测试 README](./apps/frontend/tests/README.md) | `apps/backend/tests/` + `apps/frontend/tests/` |
| **查产品需求** | [产品与规划](./.trae/documents/产品与规划/) | `04_fineSTEM_BS平台产品方案_V3.3.md` |
| **查技术文档** | [技术与架构](./.trae/documents/技术与架构/) | `01-04` 四份核心文档 |
| **查 ZeroClaw 配置** | [ZeroClaw 技术知识库](./.trae/documents/技术与架构/ZeroClaw_技术知识库_v1.0.0.md) | `H:\dev-env\zeroclaw\config\config.toml` |

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
│  │ 14 个 API 路由   ││              │  ┌───────────────────┐  │
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
- API 文档：http://localhost:3200/api/v1/docs
- ZeroClaw 健康：http://127.0.0.1:42617/health

### 环境配置

复制 `.env.example` 为 `.env`，关键配置：
- `VITE_ZC_TOKEN`：ZeroClaw Bearer Token（运行 `zeroclaw` 后用 `POST /pair` 获取）
- `DATABASE_URL`：SQLite 路径（默认 `sqlite:///D:/data/finestem/finestem.db`）

---

## 目录结构

```
fineSTEM/
├── apps/
│   ├── frontend/              # React 前端（端口 5184）→ 详见 apps/frontend/README.md
│   ├── backend/               # FastAPI 后端（端口 3200）→ 详见 apps/backend/README.md
│   └── public-web/            # 旧 MVP（docker-compose 用，非主开发栈）
├── .trae/
│   ├── skills/stem-pbl-guide/ # PBL 导师 AI 规范（SKILL.md）
│   ├── documents/             # 产品与技术文档 → 详见 .trae/documents/README.md
│   │   ├── 产品与规划/        # 产品方案 V3.3
│   │   ├── 技术与架构/        # 4 份核心架构文档（01-04）
│   │   ├── testing/           # 测试计划/报告/prompt
│   │   ├── 问题清单_长期维护.md  # Q-001~Q-023 问题追踪（回归必检）
│   │   └── 术语与字典/        # 统一术语表
│   └── rules/                 # 项目规范
├── scripts/                   # 工具脚本（含 diag_truncation.py WS 诊断）
├── deploy/                    # 部署脚本与指南
└── start_system.bat           # 一键启动
```

---

## 技术文档索引

| 文档 | 说明 |
|------|------|
| [整体功能需求](./.trae/documents/技术与架构/01_整体功能需求.md) | 四大模块 + 9 阶段 PBL + MVP 范围 |
| [模块说明](./.trae/documents/技术与架构/02_模块说明.md) | 前后端各模块职责 + AI 主链路 |
| [技术架构](./.trae/documents/技术与架构/03_技术架构.md) | 技术栈 + 端口 + ZeroClaw 集成 |
| [数据结构和数据架构](./.trae/documents/技术与架构/04_数据结构和数据架构.md) | 数据库表 + workspace + 数据关系 |
| [问题清单（长期维护）](./.trae/documents/问题清单_长期维护.md) | Q-001~Q-023 已知问题与修复（回归必检） |
| [ZeroClaw 技术知识库](./.trae/documents/技术与架构/ZeroClaw_技术知识库_v1.0.0.md) | AI 底座架构详解 |

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

---
version: 3.0.0
created_at: 2026-04-23
last_updated: 2026-07-30
maintainer: AI Agent
