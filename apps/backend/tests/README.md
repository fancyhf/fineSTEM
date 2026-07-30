# 后端测试 — 测试 Agent 导航

> **目标读者**：测试 Agent、开发 Agent。
> **框架**：pytest + pytest-asyncio + FastAPI TestClient
> **配置**：`pytest.ini`（asyncio_mode=auto，testpaths=tests）

---

## 测试定位速查表

| 你要测什么 | 去这个文件 | 说明 |
|------------|-----------|------|
| **PBL 阶段门禁** | `test_pbl_engine.py` | `TestPBLGates` / `TestSaveArtifact` / `TestAdvanceWithGate` |
| **阶段常量** | `test_stage_constants.py` | 阶段顺序/门禁映射/代码允许阶段 |
| **MCP 工具门禁** | `test_tools_gates.py` | 工具白名单/工件写入门禁/阶段推进门禁 |
| **MCP Server 协议** | `test_mcp_server.py` | 工具暴露/初始化握手/输出结构 |
| **问题卡片校验** | `test_question_verifier.py` | Q-003 修复：拒绝/接受各种问题格式 |
| **问题卡片模板** | `test_agent_question_templates.py` | AI 问题模板验证 |
| **流式截断/续接** | `test_stream_truncation.py` | 截断检测/finish_reason/自动续接机制 |
| **流式输出** | `test_stream.py` | 基本流式测试 |
| **自动续接** | `test_auto_continue.py` + `test_auto_continue_api.py` | 自动续接逻辑 + API |
| **WebSocket** | `test_ws.py` + `test_ws_events.py` + `test_ws_proxy.py` | WS 连接/事件/代理 |
| **API 端点** | `test_api.py` | 通用 API 测试 |
| **认证** | `test_auth.py` | 注册/登录/JWT |
| **项目 CRUD** | `test_projects.py` + `test_project.py` | 项目创建/查询/更新 |
| **项目名同步** | `test_project_name_sync.py` | Q-022 修复：AI 对话确定项目名后同步 |
| **成果卡** | `test_achievement_cards.py` | 成果卡 CRUD/分享/精选 |
| **证据** | `test_evidence.py` | 证据 CRUD |
| **代码执行** | `test_code_execution.py` + `test_code_sandbox.py` | 代码沙箱 |
| **Skill/课程** | `test_skills_courses.py` | Skill 安装/课程库/能力标签 |
| **Agent** | `test_agent.py` | Agent 配置/灰度 |
| **PBL 对话流** | `test_pbl_dialogue_flow.py` | 端到端 PBL 流程 |
| **完整旅程** | `test_full_journey.py` | 全流程集成测试 |
| **多文件修复** | `test_multifile_fix.py` | 多文件代码生成 |
| **多问题卡片** | `test_multi_question.py` | 多卡场景 |
| **问题流程** | `test_question_flow.py` + `test_question_debug.py` | 问题卡片流程 |
| **MVP 功能** | `test_mvp*.py`（5 个） | MVP 相关测试 |
| **数据完整性** | `test_data_integrity.py` | 数据一致性检查 |

### 调试/工具脚本（非正式测试）

| 文件 | 说明 |
|------|------|
| `conftest.py` | ★ pytest 配置：fixtures、测试数据库、TestClient |
| `check_db.py` | 数据库检查工具 |
| `check_mvp_content.py` | MVP 内容检查 |
| `check_workspace.py` | 工作区检查 |
| `fix_mvp_workspace.py` | MVP 工作区修复 |
| `fix_workspace_files.py` | 工作区文件修复 |

---

## 运行测试

```bash
cd apps/backend

# 全量测试
pytest

# 单个文件
pytest tests/test_pbl_engine.py

# 按关键词
pytest -k "stage"

按 marker 筛选
pytest -m "not slow"          # 跳过慢测试
pytest -m "integration"       # 只跑集成测试
pytest -m "e2e"               # 只跑 E2E 测试

# 详细输出
pytest -v

# 显示 print
pytest -s
```

---

## 测试环境

| 项目 | 值 |
|------|-----|
| 测试数据库 | `sqlite:///D:/data/finestem/test_finestem.db` |
| 测试存储 | `D:/data/finestem/test_uploads` |
| SECRET_KEY | `test-secret-key-for-automated-testing` |
| DEBUG | `true` |

> `conftest.py` 在 session 开始时自动建表，结束时自动清理。

---

## pytest markers

| Marker | 说明 |
|--------|------|
| `asyncio` | 异步测试（asyncio_mode=auto 后不需要手动加） |
| `slow` | 慢测试（`-m "not slow"` 跳过） |
| `integration` | 集成测试（需要外部服务：ZeroClaw/DB） |
| `e2e` | 端到端测试 |
| `timeout` | 超时标记（需装 pytest-timeout） |

---

## 已知问题

| 问题 | 说明 |
|------|------|
| `test_ws*.py` 需要后端运行 | WebSocket 测试依赖后端服务 |
| `test_mvp*.py` 部分测试过时 | MVP 阶段遗留，可能需要更新 |
| 部分 `test_debug*.py` 是临时调试 | 可以考虑清理 |
| `check_*.py` / `fix_*.py` 不是正式测试 | 是工具脚本，不应计入测试覆盖率 |

---
version: 1.0.0
created_at: 2026-07-30
maintainer: AI Agent
