# SOP & Memory 集成技术实现总结

**文档版本**: v1.0.0  
**创建时间**: 2026-07-22  
**被测版本**: git commit 13b2666  
**ZeroClaw 版本**: v0.8.3  
**审核对象**: SOP 流程控制 + Memory 项目级记忆持久化  
**目标读者**: 架构部门  

---

## 1. 变更概述

本次变更在 fineSTEM PBL 平台上集成了 ZeroClaw 的两项核心能力：SOP（标准操作流程）门禁控制和 Memory（项目级记忆持久化）。目标是让 AI 导师在 9 阶段研学流程中具备跨会话记忆能力，并通过 SOP 定义约束阶段推进路径。

### 1.1 核心指标

| 指标 | 值 |
|------|---|
| 修改/新建文件 | 7 个 |
| MCP 工具总数 | 15（原 12 + 新增 3） |
| 测试用例总数 | 76 |
| 验证阶段修复 | 3 项 |
| 测试 R01 发现阻塞 | 2 项（已修复） |

### 1.2 改动清单

| # | 层 | 文件 | 改动类型 | 核心变化 |
|---|---|------|---------|---------|
| M1 | 配置 | `config.toml` [memory] | 扩展 | backend=sqlite, search_mode=bm25, embedding_provider=none, keyword_weight=1.0 |
| M2 | 配置 | `config.toml` system_prompt | 追加 | 5 条记忆使用规范（项目画像/阶段历史/能力标签） |
| M3 | 配置 | `config.toml` auto_approve | 扩展 | 新增 3 个 finestem__ 前缀工具 + 7 个 ZeroClaw 内置工具 |
| M4 | 后端 | `zeroclaw_memory.py` | 新建 | brain.db 直接访问层（295 行）：store/recall/forget + FTS5 + 路径回退 |
| M5 | 后端 | `tools.py` | 新增 | 3 个工具类：ProjectMemoryStoreTool / ProjectMemoryRecallTool / SopStateSyncTool |
| M6 | 后端 | `tools.py` | 增强 | StageAdvancerTool 自动存储阶段历史 + ProjectCreatorTool 自动存储项目画像 |
| M7 | 前端 | `useStreamingChat.ts` | 增强 | buildOutgoingMessage context 注入 + tool_result 处理 5 种新工具 + StreamEvents 扩展 |
| S1 | 配置 | `config.toml` [sop] | 新增 | sops_dir 绝对路径 + persist_runs + step enforcement 参数 |
| S2 | SOP | `SOP.toml` + `SOP.md` | 新建 | pbl-stage-flow：9 阶段步骤 + manual 触发 |
| S3 | Workspace | `TOOLS.md` | 追加 | 3 个新工具的 AI 可读说明 |
| S4 | 后端 | `TOOL_REGISTRY` | 扩展 | 12 → 15 工具注册 |

---

## 2. 系统架构与数据流

### 2.1 整体架构

系统分为四层：前端（React + Vite）、ZeroClaw Daemon（Rust 运行时）、后端 MCP Server（Python stdio）、数据层（SQLite）。

前端通过 WebSocket 直连 ZeroClaw Gateway（ws://127.0.0.1:42617/ws/chat），ZeroClaw Agent Loop 通过 MCP stdio 协议调用后端 Python 工具。Memory 数据存储在 ZeroClaw 的 brain.db 中，业务数据存储在 finestem.db 中。

### 2.2 关键数据流路径

**路径 A — 项目创建到记忆自动存储**：用户在前端发起项目创建，ZeroClaw Agent 调用 `finestem__project_creator`，MCP Server 执行 `ProjectCreatorTool.execute()`，写入 finestem.db 后调用 `store_project_profile()` 写入 brain.db，记忆持久化。

**路径 B — 跨会话记忆召回**：用户在新会话中提问，前端 `buildOutgoingMessage` 注入 `stage_progress` 和 memory hint，Agent 根据 system_prompt 规范调用 `finestem__project_memory_recall`，MCP Server 执行 `ProjectMemoryRecallTool.execute()`，通过 `zeroclaw_memory.recall_memory()` 从 brain.db 读取，返回历史记忆给 Agent。

**路径 C — SOP 阶段门禁**：Agent 调用 `finestem__stage_advancer`，`StageAdvancerTool.execute()` 执行 `can_advance_to()` + `check_gate()` 双层校验，通过后推进阶段并调用 `store_stage_history()` 存储阶段历史，同时调用 `sop_state_sync` 更新 SKILL_STATE metadata。

### 2.3 架构决策：Memory 访问路径

Memory 访问采用"Path B — 直接 SQLite 访问"而非"Path A — 纯 prompt 引导"。原因是 MCP 工具运行在独立进程中，无法直接调用 ZeroClaw 内置的 `memory_store`/`memory_recall` Agent 工具。通过 `zeroclaw_memory.py` 直接读写 brain.db，绕过进程边界，同时利用 SQLite 的 `UNIQUE(agent_id, key)` 约束保证幂等性。

---

## 3. Memory 层技术实现

### 3.1 数据模型

Memory 数据存储在 ZeroClaw 的 brain.db 中。`memories` 表包含 15 个字段，关键约束为 `UNIQUE(agent_id, key)`，保证同一 Agent 下同一 key 的记忆不会重复。FTS5 虚拟表 `memories_fts` 建立在 `key` 和 `content` 列上，提供 BM25 全文检索。

Agent ID 固定为 `9cd44b6d-779e-4e88-9602-2f75079f0eec`（assistant agent）。

### 3.2 访问层设计

`zeroclaw_memory.py`（295 行）封装了 5 个核心函数：

| 函数 | SQL 操作 | Key 格式 | 用途 |
|------|---------|---------|------|
| `store_memory(key, value, category)` | INSERT OR REPLACE | 自定义 | 通用记忆存储 |
| `recall_memory(key=None, query=None)` | SELECT by key / FTS5 MATCH | - | 精确匹配或全文搜索 |
| `forget_memory(key)` | DELETE | 自定义 | 删除记忆 |
| `store_project_profile(project_id, profile)` | INSERT OR REPLACE | `finestem:project:{id}:profile` | 项目画像存储 |
| `store_stage_history(project_id, stage, completed)` | INSERT OR REPLACE | `finestem:project:{id}:stage_history` | 阶段进度存储 |

### 3.3 关键技术决策

**路径回退逻辑**：环境变量 `ZEROCLAW_DATA_DIR` 可能指向空目录（实测发现）。代码实现了三级回退：环境变量路径 → `config_dir/data` → 默认值。只有当目标路径实际存在 brain.db 文件时才采用，并输出 warning 日志。

**FTS5 查询转义**：记忆 key 使用冒号分隔（如 `finestem:project:abc:profile`），而 FTS5 MATCH 语法将冒号解释为列限定符，导致 "no such column: finestem" 错误。修复方式是将查询字符串用双引号包裹为 FTS5 字符串字面量，内部双引号转义为 `""`。

**幂等性保证**：利用 `UNIQUE(agent_id, key)` 约束 + `INSERT OR REPLACE` 语法。同一 key 的重复存储会更新 `content` 和 `updated_at`，不会产生重复记录。函数返回 `action="created"` 或 `action="updated"` 区分操作类型。

---

## 4. SOP 层技术实现

### 4.1 SOP 定义结构

采用 ZeroClaw 官方 SOP 格式，由两个文件组成。`SOP.toml` 包含元数据（name/description/version/max_concurrent/admission_policy）和触发器定义（`[[triggers]] type = "manual"`）。`SOP.md` 包含 9 个步骤定义，每个步骤对应一个 PBL 阶段，通过 `tools:` 指令声明该阶段可用的 MCP 工具，通过 `on_failure: retry:N` 声明失败重试策略。

### 4.2 SOP 配置参数

| 参数 | 值 | 含义 |
|------|---|------|
| `sops_dir` | 绝对路径 | SOP 定义目录（必须用绝对路径，相对路径无法解析） |
| `persist_runs` | true | SOP 运行状态持久化到 SQLite |
| `run_store_backend` | "sqlite" | 运行状态存储后端 |
| `step_schema_enforce` | false | 不强制步骤 schema 校验（柔性模式） |
| `step_mandatory_tools` | ["sop_advance", "sop_approve", "sop_status"] | 步骤必须可用的 ZeroClaw 内置工具 |
| `max_step_retries` | 3 | 单步骤最大重试次数 |

`step_schema_enforce` 和 `step_scope_enforce` 当前设为 false，SOP 处于柔性模式——不强制工具调用顺序和范围。PBL 门禁的实际强制力仍依赖 `StageAdvancerTool` 的 `can_advance_to()` + `check_gate()` 双层校验，而非 SOP 引擎本身。

### 4.3 SopStateSyncTool 设计

`SopStateSyncTool` 是连接 ZeroClaw SOP 引擎和 fineSTEM 业务层的桥梁。它将 SOP 运行状态（run_id、current_step、step_status）同步写入 finestem.db 的 `SKILL_STATE.metadata` JSON 字段，使前端可以通过 API 读取 SOP 进度。

必填参数为 `project_id`、`current_step`、`step_status`，可选参数为 `sop_run_id`。写入的 metadata 字段包括 `sop_run_id`、`sop_current_step`、`sop_step_status`、`sop_last_sync`（ISO 时间戳）。

---

## 5. 前端集成层技术实现

### 5.1 Context 注入增强

`buildOutgoingMessage` 函数在发送消息给 ZeroClaw 时，新增了 4 个上下文字段：

| 字段 | 来源 | 用途 |
|------|------|------|
| `mode` | SKILL_STATE.mode | standard / light 模式标识 |
| `stage_progress` | STAGE_ORDER.indexOf(current_stage) | 当前阶段进度（如 3/9） |
| `evidence_count` | SKILL_STATE 中 evidence 数量 | 已收集证据数 |
| memory hint 文本 | 当 stage_progress > 0 时追加 | 提示 AI 该项目有历史记忆可召回 |

### 5.2 tool_result 处理扩展

WebSocket 消息处理中，`tool_result` 事件处理器新增了 5 种工具类型的处理逻辑：`project_memory_store`（解析存储结果）、`project_memory_recall`（解析召回的记忆内容）、`sop_state_sync`（更新前端 SOP 进度显示）、`sop_execute`（触发 `onSopStarted` 回调）、`sop_status`（触发 `onSopStatusUpdate` 回调）。

### 5.3 StreamEvents 接口扩展

新增两个可选回调：`onSopStarted?: (runId: string) => void` 和 `onSopStatusUpdate?: (data: { currentStep: string; stepStatus: string }) => void`，使上层组件可以响应 SOP 事件。

---

## 6. 配置层改动

### 6.1 [memory] 段

配置策略为纯关键词检索模式。不使用 embedding（`embedding_provider = "none"`），向量权重为 0，完全依赖 FTS5 BM25 全文搜索。这简化了部署（无需 embedding 模型），同时满足 PBL 场景的精确 key 匹配和关键词搜索需求。

### 6.2 [sop] 段

`sops_dir` 必须使用绝对路径。相对路径 `"sops"` 在 ZeroClaw v0.8.3 中无法正确解析——CLI 会回退到 `<workspace>/sops` 做离线检查，但运行时 SOP 执行被禁用。通过 `zeroclaw config set sop.sops_dir "<绝对路径>"` 设置。

### 6.3 auto_approve 扩展

auto_approve 列表控制哪些工具可以自动执行而无需用户确认。本次新增了两类工具名：

- MCP 工具名（带 `finestem__` 前缀，AI 实际调用名）：`finestem__project_memory_store`、`finestem__project_memory_recall`、`finestem__sop_state_sync`
- ZeroClaw 内置工具名（Agent Loop 内部调用名）：`memory_store`、`memory_recall`、`memory_forget`、`sop_execute`、`sop_status`、`sop_approve`、`sop_advance`

初版仅添加了 ZeroClaw 内置工具名，但 AI 实际调用的是 MCP 暴露的工具名。名称不匹配导致 auto_approve 不生效，AI 调用新工具时 120s 超时无 tool_result。R01 测试发现此问题，已补充 `finestem__` 前缀工具名修复。

### 6.4 system_prompt 追加

在 Agent 的 system_prompt 末尾追加了 5 条记忆使用规范：

1. 项目创建后，调用 `project_memory_store` 存储项目画像
2. 每次阶段推进后，调用 `project_memory_store` 更新阶段历史
3. 新会话开始时，调用 `project_memory_recall` 查询项目历史记忆
4. 记忆 key 必须使用 `finestem:project:{project_id}:{type}` 格式
5. 不要存储临时性/过程性内容，只存储项目级持久信息

---

## 7. 测试验证结果

### 7.1 验证阶段（开发自测）

| 验证项 | 结果 | 说明 |
|--------|------|------|
| Python 语法检查 | 通过 | tools.py / zeroclaw_memory.py / server.py 全部通过 |
| TOOL_REGISTRY 工具数 | 15 | 原 12 + 新增 3 |
| Memory 功能测试 | 6/6 通过 | store/recall/forget/profile/stage_history/FTS5 全通过 |
| SOP 集成测试 | 4/4 通过 | validate/schema/必填校验/可选参数 全通过 |
| TypeScript 编译 | 0 error | useStreamingChat.ts 零类型错误 |
| ZeroClaw config migrate | 通过 | 配置解析无错误 |
| SOP 加载验证 | 9 steps | pbl-stage-flow 有效 |
| Daemon 工具加载 | 15 tools | 启动日志确认 15 个工具 |
| test_mcp_server.py | 10/10 通过 | 修复 12→15 断言后全通过 |

### 7.2 测试 Agent R01 结果

| 组 | 通过/总计 | 关键发现 |
|---|---|---|
| 配置验证 | 3/10 | R01 时 auto_approve 缺 MCP 工具名（已修复） |
| 后端单元 | 25/28 | test_mcp_server 3 例回归（已修复） |
| 前端 | 10/10 | vitest 43/43 + tsc 0 error + vite build OK |
| E2E @ai | 3/3 | headless + headed 双跑全通过 |
| WebSocket | 3/6 | AI 调用了新工具但 tool_result 120s 超时（auto_approve 已修复） |
| 回归 | 3/5 | test_mcp_server 回归（已修复） |
| Memory | 15→15 | R01 时端到端链路不通（已修复） |

R01 报告发现的两个阻塞项已在 R01 后立即修复：auto_approve 补充 `finestem__` 前缀工具名；test_mcp_server.py 断言 12→15。修复后 daemon 重启加载 15 个工具，配置验证全通过，test_mcp_server 10/10 通过。R02 待测试 agent 执行。

---

## 8. 已知问题与修复记录

### 8.1 已修复问题

| # | 问题 | 根因 | 修复方式 | 发现阶段 |
|---|------|------|---------|---------|
| F1 | brain.db 路径指向空目录 | ZEROCLAW_DATA_DIR 环境变量指向错误路径 | 添加三级回退逻辑：env → config_dir/data → 默认值 | 开发自测 |
| F2 | FTS5 搜索报 "no such column" | key 中的冒号被 FTS5 解释为列限定符 | 查询字符串用双引号包裹为字符串字面量 | 开发自测 |
| F3 | SOP 不被 ZeroClaw 识别 | 相对路径 "sops" 无法解析 | 改为绝对路径 + config set 命令设置 | 开发自测 |
| F4 | 新工具 120s 超时无 tool_result | auto_approve 放了 ZeroClaw 内置名而非 MCP 工具名 | 补充 3 个 finestem__ 前缀工具名 | R01 测试 |
| F5 | test_mcp_server.py 3 例回归 | 断言期望 12 工具，实际 15 | 4 处断言更新 12→15 | R01 测试 |

### 8.2 待验证项（R02）

| 项 | 状态 | 说明 |
|---|---|---|
| 跨会话记忆持久化 | 待验证 | R01 时 auto_approve 未生效导致链路不通，修复后需 R02 验证 |
| 项目创建后 brain.db 有 profile 记忆 | 待验证 | 同上 |
| 阶段推进后 brain.db 有 stage_history 记忆 | 待验证 | 同上 |
| WebSocket SOP 工具触发 | 待验证 | 同上 |

---

## 9. 架构评估与建议

### 9.1 架构合理性评估

| 维度 | 评估 | 说明 |
|------|------|------|
| 分层清晰度 | 优 | 配置层 / Memory 访问层 / 工具层 / 前端层职责分明，无跨层调用 |
| 数据一致性 | 优 | UNIQUE(agent_id, key) + INSERT OR REPLACE 保证幂等，FTS5 与主表通过 rowid 关联 |
| 错误隔离 | 优 | 记忆存储失败不影响主流程（try/except 包裹），FTS5 失败回退到精确匹配 |
| 可扩展性 | 良 | 新增工具只需注册到 TOOL_REGISTRY + 添加 auto_approve，SOP 步骤可在 SOP.md 中增删 |
| 安全性 | 注意 | brain.db 直接 SQLite 访问绕过 ZeroClaw 的 memory 工具权限控制，需评估并发写入风险 |
| 可观测性 | 待改进 | 记忆操作有 logging 但无结构化指标，建议后续接入 ZeroClaw metrics |

### 9.2 风险项

**风险 1：SQLite 并发写入**。ZeroClaw Memory Engine 和 `zeroclaw_memory.py` 都会写入 brain.db。虽然 SQLite 支持 WAL 模式下的并发读写，但在高并发写入时可能出现 `database is locked`。当前 PBL 场景为单用户单项目，风险较低，但多用户场景需评估。建议确认 ZeroClaw brain.db 是否启用 WAL 模式，如未启用，建议在 `zeroclaw_memory.py` 的连接中添加 `PRAGMA busy_timeout=5000`。

**风险 2：SOP 步骤强制力度**。当前 `step_schema_enforce = false` 且 `step_scope_enforce = false`，SOP 处于柔性模式。AI 理论上可以跳过 SOP 步骤直接调用后续工具。PBL 门禁的实际强制力仍依赖 `StageAdvancerTool` 的双层校验，而非 SOP 引擎本身。如需 SOP 真正强制流程，应在 R02 验证后逐步启用 `step_schema_enforce = true`，但需先确认对现有 AI 对话流畅度的影响。

**风险 3：auto_approve 双重命名**。auto_approve 列表中同时存在 ZeroClaw 内置工具名和 MCP 工具名。这是因为 ZeroClaw Agent Loop 可能通过两种路径调用工具。当前两者都已在列表中，但后续新增工具时容易遗漏其中一种命名。建议在 TOOLS.md 中明确标注每个工具的两种名称，并在新增工具时同步更新 auto_approve 的两个名称。

### 9.3 后续优化方向

1. **Embedding 检索**：当前使用纯 BM25 关键词检索。如需语义搜索能力（如"帮我回忆之前讨论过的环保方案"），需配置 `embedding_provider` 并启用向量权重。建议评估 OpenAI text-embedding-3-small 或本地 BGE 模型。

2. **记忆生命周期管理**：当前无记忆过期/清理机制。长期使用后 brain.db 会持续增长。建议增加 `importance` 字段的实际使用（当前固定 0.5）和定期清理低重要性记忆的机制。

3. **SOP 可视化**：前端目前无法可视化展示 SOP 流程进度。可利用 `SopStateSyncTool` 写入的 metadata 字段，在前端渲染阶段进度条和当前步骤高亮。

4. **记忆命中率监控**：在 `recall_memory` 函数中增加命中/未命中计数，通过 ZeroClaw metrics 暴露，用于评估记忆策略的有效性。

---

## 10. 文件路径索引

| 文件 | 路径 |
|------|------|
| 交接文档 | `.trae/documents/SOP_Memory_交接文档_给开发Agent.md` |
| 测试计划 | `.trae/documents/testing/plans/SOP_Memory专项测试计划_v1.0.0.md` |
| 测试 Agent Prompt | `.trae/documents/testing/prompts/SOP_Memory测试Agent_Prompt.md` |
| 测试报告 R01 | `.trae/documents/testing/reports/SOP_Memory测试报告_2026-07-22_R01.md` |
| ZeroClaw 配置 | `H:\dev-env\zeroclaw\config\config.toml` |
| Memory 访问层 | `apps/backend/app/services/zeroclaw_memory.py` |
| 工具定义 | `apps/backend/app/services/tools.py` |
| 前端 Hook | `apps/frontend/src/hooks/useStreamingChat.ts` |
| SOP 定义 | `H:\dev-env\zeroclaw\config\data\sops\pbl-stage-flow\SOP.toml` + `SOP.md` |
| Memory 测试脚本 | `apps/backend/scripts/test_memory_persistence.py` |
| SOP 测试脚本 | `apps/backend/scripts/test_sop_integration.py` |
| WS SOP 测试 | `apps/backend/scripts/ws_sop_test.py` |
| WS Memory 测试 | `apps/backend/scripts/ws_memory_test.py` |

---

**文档结束**
