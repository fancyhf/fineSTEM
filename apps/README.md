# apps/ — 应用代码

> **目标读者**：开发 Agent、测试 Agent。从这里进入前后端代码。
> **导航**：后端 → [`backend/README.md`](./backend/README.md) ｜ 前端 → [`frontend/README.md`](./frontend/README.md)

## 目录

| 目录 | 技术栈 | 端口 | README | 说明 |
|------|--------|------|--------|------|
| `backend/` | FastAPI + SQLAlchemy + SQLite | `3200` | [→ README](./backend/README.md) | REST API + MCP 工具服务（15 个工具暴露给 ZeroClaw） |
| `frontend/` | React 18 + TypeScript + Vite + Tailwind | `5184` | [→ README](./frontend/README.md) | 用户界面，直连 ZeroClaw WebSocket |
| `public-web/` | 旧 MVP（Docker） | — | — | 非主开发栈，可忽略 |

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

# 前端
cd apps/frontend && npm install && npm run dev
```

---
version: 2.0.0
created_at: 2026-04-23
last_updated: 2026-07-30
maintainer: AI Agent
