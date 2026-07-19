# fineSTEM - 青少年 STEM 研学助手

## 项目简介

fineSTEM 是一个面向青少年的 STEM 学习平台，提供：

- 🎓 探索中心 - 发现有趣的 STEM 项目
- ✨ AI 创作 - 快速启动轻量级项目
- 🔬 研究模式 - 完整的科研流程
- 📜 成果展示 - 成就卡片与灵感墙

## 技术架构

- **后端**: FastAPI (Python，仅保留 projects/evidence/documents/demos 等 CRUD）
- **前端**: React + TypeScript + Vite + Tailwind CSS
- **AI 底座**: [ZeroClaw](https://github.com/zeroclaw-labs/zeroclaw) v0.8.3（真实 Rust 二进制运行时，部署在 `H:\dev-env\zeroclaw\`）
  - Gateway：`http://127.0.0.1:42617`（`POST /webhook` + `GET /ws/chat`，配对鉴权 + Bearer Token）
  - Provider：DeepSeek 主；可后续在 `config.toml` 加 GLM/Qwen 等 fallback
  - PBL 工具：`apps/backend/app/mcp_server/server.py` 通过 stdio 暴露 11 个 MCP 工具（`finestem__*` 前缀）
  - 文档：`.trae/documents/技术与架构/ZeroClaw_技术知识库_v1.0.0.md`
- **UI 风格**: 蓝绿色主题 (#14B8A6)

> 重大变更（2026-07-19）：
> 前端聊天链路从 `apps/backend` FastAPI 的 `/api/v1/agent/ws` 切换为直连 ZeroClaw 网关 `/ws/chat`。
> 旧的 `apps/backend/app/services/providers/zeroclaw_provider.py` 与 `apps/backend/app/api/agent.py / chat.py` 退役（冷备份保留）。
> AI Provider、Tool Loop、Memory、Security、Tool Receipts 全部由真实 ZeroClaw 承担。

## 项目规范

本项目严格遵循 `.trae/rules/project_rules.md` 中的规范：

### 代码规范

- ✅ 命名规范：API/JSON 用 camelCase，类名用 PascalCase
- ✅ 文档规范：所有公共方法有中文文档
- ✅ 日志规范：日志和异常使用中文
- ✅ 文件头部：有标准注释（用途、维护者、links）

### Git 规范

- ✅ 分支策略：main / develop / feature/* / hotfix/*
- ✅ 提交规范：Conventional Commits
- ✅ 变更审计：PR 包含背景、影响范围、兼容策略

### 开发流程

- ✅ 研究 → 计划 → 实现 → 测试
- ✅ 覆盖目标：业务逻辑 ≥80%，关键路径 100%

## 快速开始

### 前置条件

- Python 3.12+
- Node.js 18+
- npm 或 yarn

### 启动项目

1. **后端启动**
```bash
cd apps/backend
pip install -r requirements.txt
python main.py
```

2. **前端启动**
```bash
cd apps/frontend
npm install
npm run dev
```

3. **访问应用**
- 前端: http://localhost:5173
- API 文档: http://localhost:8000/docs

## 目录结构

```
fineSTEM/
├── apps/                    # 应用目录
│   ├── frontend/           # 前端应用
│   └── backend/            # 后端 API
├── .trae/                  # 项目规范与文档
│   ├── rules/             # 项目规则
│   └── documents/         # 产品文档
└── README.md               # 项目说明
```

## 开发阶段

- ✅ **阶段 1**: 项目搭建与规范确立
- 🔄 **阶段 2**: MVP 功能开发（进行中）
- 📝 **阶段 3**: 测试与优化

---
version: 1.0.0
created_at: 2026-04-23
maintainer: AI Agent