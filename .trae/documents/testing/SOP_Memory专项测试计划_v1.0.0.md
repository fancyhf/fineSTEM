# SOP & Memory 专项测试计划 v1.1.0

**版本**: v1.1.0（R03 轮次）
**日期**: 2026-07-22
**被测对象**: ZeroClaw SOP 流程控制 + Memory 项目级记忆持久化
**测试目标**: 验证 R01/R02 遗留阻塞已全部修复 + SOP/Memory 端到端可用 + 无回归
**执行人**: 测试 agent（按 `测试工作指南_v1.0.0.md` 规范执行）

> **本计划针对"SOP + Memory"这一个变更集**。用例编号采用 `TC-SM-<层>-<序号>` 前缀（SM=SOP&Memory）。
>
> **v1.1.0 变更要点**（相比 v1.0.0）：
> - R01 发现 2 项阻塞（[sop] 段缺失 + auto_approve 缺新工具名），R02 修复了 auto_approve 但 SOP 仍未创建
> - **R03 前，开发 agent 已补齐所有 R01/R02 遗留阻塞**：[sop] 段已加、pbl-stage-flow SOP 已创建（Steps: 9）、[memory] 段已扩展、auto_approve 已追加 10 个工具名、前端 M7 已实施
> - R03 的核心任务：**验证这些补齐改动确实生效**（尤其是 daemon 重启后加载新配置）
> - 新增 R01/R02 回归验证段（第 8 节），逐项确认每个历史阻塞已修复

---

## 0. 被测对象改动清单

测试 agent 必须先读 `SOP_Memory_交接文档_给开发Agent.md` 了解每项改动。摘要：

### 0.1 Memory 改动（7 项）

| # | 改动 | 文件 | 核心变化 | R02 状态 |
|---|------|------|---------|---------|
| M1 | config.toml [memory] 段扩展 | `H:/dev-env/zeroclaw/config/config.toml` | 新增 search_mode=bm25/embedding_provider=none/keyword_weight=1.0/vector_weight=0.0/auto_save=true | ❌R02 未修 → ✅R03 已补齐 |
| M2 | system_prompt 追加记忆规范 | `config.toml` system_prompt 末尾 | 5 条记忆使用规则（项目画像/阶段历史/记忆召回/键格式/只存持久信息） | ❌R02 未修 → ✅R03 已补齐 |
| M3 | auto_approve 扩展 | `config.toml` auto_approve 列表 | 新增 3 个 finestem__ 工具 + 7 个 ZeroClaw 内置工具名 | ✅R02 已修（部分），R03 补全 7 个内置名 |
| M4 | zeroclaw_memory.py 新建 | `apps/backend/app/services/zeroclaw_memory.py` | brain.db 直接访问层（store/recall/forget + 项目画像/阶段历史 + FTS5 转义 + 路径回退） | ✅ 已验证 |
| M5 | tools.py 新增 3 工具 | `apps/backend/app/services/tools.py` | ProjectMemoryStoreTool + ProjectMemoryRecallTool + SopStateSyncTool | ✅ 已验证 |
| M6 | tools.py 增强 2 工具 | `apps/backend/app/services/tools.py` | StageAdvancerTool 自动存储阶段历史 + ProjectCreatorTool 自动存储项目画像 | ✅ 已验证 |
| M7 | useStreamingChat.ts 增强 | `apps/frontend/src/hooks/useStreamingChat.ts` | buildOutgoingMessage 注入 mode/stage_progress/evidence_count/memory_hint + tool_result 处理 5 种新工具 + StreamEvents 新增 onSopStarted/onSopStatusUpdate | ❌R02 未实施 → ✅R03 已补齐 |

### 0.2 SOP 改动（4 项）

| # | 改动 | 文件 | 核心变化 | R02 状态 |
|---|------|------|---------|---------|
| S1 | config.toml [sop] 段新增 | `config.toml` | sops_dir 绝对路径 + persist_runs + run_store_backend + step_schema_enforce=false + step_scope_enforce=false | ❌R02 未修 → ✅R03 已补齐 |
| S2 | pbl-stage-flow SOP 定义 | `H:/dev-env/zeroclaw/config/data/sops/pbl-stage-flow/SOP.toml` + `SOP.md` | 9 阶段步骤 + manual 触发 + 每阶段声明可用工具 | ❌R02 未创建 → ✅R03 已创建（Steps: 9，validate 通过） |
| S3 | TOOLS.md 新增工具说明 | `H:/dev-env/zeroclaw/config/agents/assistant/workspace/TOOLS.md` | project_memory_store/recall + sop_state_sync 工具说明 + 双重命名说明 | ❌R02 未更新 → ✅R03 已补齐 |
| S4 | TOOL_REGISTRY 12→15 | `apps/backend/app/services/tools.py` | 注册 3 个新工具到 TOOL_REGISTRY | ✅ 已验证 |

### 0.3 验证阶段修复（3 项）

| # | 改动 | 文件 | 问题 | R02 状态 |
|---|------|------|------|---------|
| F1 | brain.db 路径回退 | `zeroclaw_memory.py` | ZEROCLAW_DATA_DIR 指向空目录，添加 config_dir/data 回退 | ✅ 已验证 |
| F2 | FTS5 查询转义 | `zeroclaw_memory.py` | key 中的冒号被 FTS5 解释为列限定符，双引号包裹修复 | ✅ 已验证 |
| F3 | SOP 目录绝对路径 | `config.toml` | 相对路径 "sops" 无法解析，改为绝对路径 | ❌R02 未修 → ✅R03 已补齐 |

---

## 1. 测试范围与策略

### 1.1 范围矩阵

| 改动 | 单元测试 | 集成 | E2E 离线 | E2E @ai | Playwright UI | 配置验证 | WebSocket |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| M1 config [memory] | | | | | | ✅ | |
| M2 system_prompt 记忆规范 | | | | | ✅ | ✅ | ✅ |
| M3 auto_approve | | | | | | ✅ | ✅ |
| M4 zeroclaw_memory.py | ✅ | | | | | | ✅ |
| M5 新增 3 工具 | ✅ | ✅ | | | | | ✅ |
| M6 增强 2 工具 | ✅ | | | ✅ | | | ✅ |
| M7 前端增强 | ✅ | | ✅ | ✅ | ✅ | | |
| S1 config [sop] | | | | | | ✅ | |
| S2 SOP 定义 | | | | ✅ | | ✅ | ✅ |
| S3 TOOLS.md | | | | | | ✅ | |
| S4 TOOL_REGISTRY | ✅ | | | | | ✅ | |
| F1 路径回退 | ✅ | | | | | | |
| F2 FTS5 转义 | ✅ | | | | | | |
| F3 SOP 目录 | | | | | | ✅ | |

### 1.2 策略

1. **⚠️ 前置：重启 ZeroClaw daemon**（**最关键**）。R03 的所有配置改动都在 config.toml，daemon 必须重启才能加载。R02 测试时 daemon 跑的是旧配置。重启方法见第 7.3 节。
2. **先跑配置验证**：`zeroclaw config migrate` + `zeroclaw config get` 各字段 + `zeroclaw sop list/validate/show`，确认所有补齐改动生效
3. **R01/R02 回归验证**（第 8 节）：逐项确认历史阻塞已修复
4. **后端单元测试**：验证 3 个新工具 + 2 个增强工具 + zeroclaw_memory 模块
5. **前端构建验证**：tsc --noEmit + vite build，确认 M7 改动无类型错误
6. **E2E @ai**：启动真实 ZeroClaw daemon，跑多轮 PBL 对话，验证 Memory 持久化和 SOP 流程
7. **Playwright UI 实测**：有头浏览器 + 截图 + 录屏，验证前端 context 注入和 tool_result 处理
8. **WebSocket 真实对话**：Python 脚本直连 ZeroClaw WS，验证跨会话记忆持久化 + SOP 工具触发
9. **回归检查**：确认原有 12 个工具 + 后端测试 + 前端测试无回归

---

## 2. 测试用例清单

### 2.1 配置验证（TC-SM-CFG，12 例）

> R01/R02 有 7 项失败，R03 需全部验证通过。

| 编号 | 用例 | 命令 | 预期 | 对应改动 | R02 结果 |
|------|------|------|------|---------|---------|
| TC-SM-CFG-001 | config.toml 解析无错误 | `zeroclaw config migrate` | 输出"配置已为当前架构版本"，退出码 0 | M1/S1 | ✅ |
| TC-SM-CFG-002 | [memory] 段 backend 正确 | `zeroclaw config get memory.backend` | `sqlite` | M1 | ✅ |
| TC-SM-CFG-003 | [memory] 段 search_mode 正确 | `zeroclaw config get memory.search_mode` | `bm25`（**不再是 hybrid**） | M1 | ❌R02→需R03验证 |
| TC-SM-CFG-004 | [memory] 段 embedding_provider 正确 | `zeroclaw config get memory.embedding_provider` | `none` | M1 | ✅ |
| TC-SM-CFG-005 | [memory] 段 keyword_weight | `zeroclaw config get memory.keyword_weight` | `1.0` | M1 | 新增 |
| TC-SM-CFG-006 | [memory] 段 auto_save | `zeroclaw config get memory.auto_save` | `true` | M1 | 新增 |
| TC-SM-CFG-007 | [sop] 段 sops_dir 正确 | `zeroclaw config get sop.sops_dir` | 绝对路径 `H:\dev-env\zeroclaw\config\data\sops` | S1/F3 | ❌R02→需R03验证 |
| TC-SM-CFG-008 | SOP pbl-stage-flow 已加载 | `zeroclaw sop list` | 含 `pbl-stage-flow`，Steps: 9，Triggers: manual | S2 | ❌R02→需R03验证 |
| TC-SM-CFG-009 | SOP pbl-stage-flow 校验通过 | `zeroclaw sop validate pbl-stage-flow` | `✅ pbl-stage-flow — 有效` | S2 | ❌R02→需R03验证 |
| TC-SM-CFG-010 | SOP pbl-stage-flow 详情正确 | `zeroclaw sop show pbl-stage-flow` | 含 9 个阶段步骤（stage_00~stage_08）+ 每步 tools 列表 | S2 | ❌R02→需R03验证 |
| TC-SM-CFG-011 | auto_approve 含 finestem__ 新工具 | 读 config.toml auto_approve | 含 `finestem__project_memory_store`、`finestem__project_memory_recall`、`finestem__sop_state_sync` | M3 | ✅R02已修 |
| TC-SM-CFG-012 | auto_approve 含 ZeroClaw 内置工具名 | 读 config.toml auto_approve | 含 `memory_store`、`memory_recall`、`memory_forget`、`sop_execute`、`sop_status`、`sop_approve`、`sop_advance` | M3 | 新增 |

### 2.2 后端单元测试（TC-SM-BE，28 例）

#### 2.2.1 zeroclaw_memory 模块（TC-SM-BE-001~012，12 例）

| 编号 | 用例 | 验证点 | 对应改动 |
|------|------|--------|---------|
| TC-SM-BE-001 | 模块导入 | `from app.services.zeroclaw_memory import store_memory, recall_memory, forget_memory, store_project_profile, store_stage_history` 成功 | M4 |
| TC-SM-BE-002 | BRAIN_DB_PATH 路径正确 | 路径指向 `H:\dev-env\zeroclaw\config\data\memory\brain.db` 且文件存在 | F1 |
| TC-SM-BE-003 | ASSISTANT_AGENT_ID 正确 | 值为 `9cd44b6d-779e-4e88-9602-2f75079f0eec` | M4 |
| TC-SM-BE-004 | store_memory 新建 | 存储新 key，返回 `action=created` | M4 |
| TC-SM-BE-005 | store_memory 更新 | 对同 key 存新值，返回 `action=updated`（非 created） | M4 |
| TC-SM-BE-006 | recall_memory 精确匹配 | 按 key 召回，返回对应 content | M4 |
| TC-SM-BE-007 | recall_memory FTS5 搜索 | 按 query 关键词搜索，返回匹配结果（含冒号的 key 不报错） | F2 |
| TC-SM-BE-008 | recall_memory 不存在 | key 不存在时返回空列表（count=0） | M4 |
| TC-SM-BE-009 | forget_memory 删除 | 删除后 recall 返回 count=0 | M4 |
| TC-SM-BE-010 | store_project_profile | 存储项目画像，key 为 `finestem:project:{id}:profile` | M4 |
| TC-SM-BE-011 | store_stage_history | 存储阶段历史，key 为 `finestem:project:{id}:stage_history` | M4 |
| TC-SM-BE-012 | 路径回退逻辑 | 环境变量指向空目录时回退到 config_dir/data | F1 |

**执行脚本**：`cd apps/backend && python scripts/test_memory_persistence.py -v`

#### 2.2.2 新增工具（TC-SM-BE-013~022，10 例）

| 编号 | 用例 | 验证点 | 对应改动 |
|------|------|--------|---------|
| TC-SM-BE-013 | TOOL_REGISTRY 含 15 工具 | `len(TOOL_REGISTRY) == 15` | S4 |
| TC-SM-BE-014 | project_memory_store 注册 | `'project_memory_store' in TOOL_REGISTRY` | M5 |
| TC-SM-BE-015 | project_memory_recall 注册 | `'project_memory_recall' in TOOL_REGISTRY` | M5 |
| TC-SM-BE-016 | sop_state_sync 注册 | `'sop_state_sync' in TOOL_REGISTRY` | M5 |
| TC-SM-BE-017 | ProjectMemoryStoreTool schema | name/description/parameters_schema 正确 | M5 |
| TC-SM-BE-018 | ProjectMemoryRecallTool schema | name/description/parameters_schema 正确 | M5 |
| TC-SM-BE-019 | SopStateSyncTool schema | name/description/parameters_schema 正确，required=['project_id','current_step','step_status'] | M5 |
| TC-SM-BE-020 | SopStateSyncTool 必填校验 | 缺 project_id/current_step/step_status 各自返回失败 | M5 |
| TC-SM-BE-021 | SopStateSyncTool 更新 metadata | execute 后 SKILL_STATE.metadata 含 sop_run_id/sop_current_step/sop_step_status/sop_last_sync | M5 |
| TC-SM-BE-022 | SopStateSyncTool 可选 sop_run_id | 不传 sop_run_id 时仍成功，metadata 正确 | M5 |

**执行**：`cd apps/backend && python -m pytest tests/test_mcp_server.py -v`

#### 2.2.3 增强工具（TC-SM-BE-023~028，6 例）

| 编号 | 用例 | 验证点 | 对应改动 | R02 状态 |
|------|------|--------|---------|---------|
| TC-SM-BE-023 | StageAdvancerTool 含 store_stage_history | 源码含 `store_stage_history` 调用 | M6 | ✅ |
| TC-SM-BE-024 | ProjectCreatorTool 含 store_project_profile | 源码含 `store_project_profile` 调用 | M6 | ✅ |
| TC-SM-BE-025 | stage_advancer 推进后记忆存在 | 推进阶段后 brain.db 有 stage_history 记忆 | M6 | ⚠️需E2E验证 |
| TC-SM-BE-026 | project_creator 创建后记忆存在 | 创建项目后 brain.db 有 profile 记忆 | M6 | ⚠️需E2E验证 |
| TC-SM-BE-027 | 记忆存储 try/except 包裹 | 记忆存储失败不影响主流程（try/except 保护） | M6 | ✅ |
| TC-SM-BE-028 | MCP server 加载 15 工具 | test_mcp_server.py 10 例通过 | S4 | ✅R02已修 |

### 2.3 前端单元测试（TC-SM-FE，10 例）

> **R02 未覆盖 M7 前端改动（当时未实施），R03 需重点验证。**

| 编号 | 用例 | 验证点 | 对应改动 | R02 状态 |
|------|------|--------|---------|---------|
| TC-SM-FE-001 | buildOutgoingMessage 含 mode | context 传 mode 时输出消息含 `mode: xxx` | M7 | ❌未覆盖 |
| TC-SM-FE-002 | buildOutgoingMessage 含 stage_progress | current_stage 非 bootstrap 时含 `stage_progress: N/9` | M7 | ❌未覆盖 |
| TC-SM-FE-003 | buildOutgoingMessage 含 evidence_count | evidence_count > 0 时含 `evidence_count: N` | M7 | ❌未覆盖 |
| TC-SM-FE-004 | buildOutgoingMessage 含 memory hint | current_stage 非 bootstrap 时消息含 `<memory_hint>` 标签 | M7 | ❌未覆盖 |
| TC-SM-FE-005 | buildOutgoingMessage bootstrap 无 memory hint | current_stage = stage_00_bootstrap 时**不含** memory hint | M7 | ❌未覆盖 |
| TC-SM-FE-006 | tool_result 处理 project_memory_store | 收到 project_memory_store tool_result 时不崩溃，console.info 记录 | M7 | ❌未覆盖 |
| TC-SM-FE-007 | tool_result 处理 project_memory_recall | 收到 project_memory_recall tool_result 时不崩溃 | M7 | ❌未覆盖 |
| TC-SM-FE-008 | tool_result 处理 sop_state_sync | 收到 sop_state_sync tool_result 时触发 onSopStatusUpdate | M7 | ❌未覆盖 |
| TC-SM-FE-009 | tool_result 处理 sop_execute | 收到 sop_execute tool_result 时触发 onSopStarted | M7 | ❌未覆盖 |
| TC-SM-FE-010 | StreamEvents 含新回调 | StreamEvents 接口含 `onSopStarted` 和 `onSopStatusUpdate` 可选回调 | M7 | ❌未覆盖 |

**验证方式**：
- TC-SM-FE-001~005：读 `useStreamingChat.ts` 源码确认 buildOutgoingMessage 含 PBL_STAGE_ORDER 常量 + mode/stage_progress/evidence_count/memory_hint 逻辑
- TC-SM-FE-006~009：读源码确认 tool_result 分支含 5 种新工具处理（project_memory_store/recall/sop_state_sync/sop_execute/sop_status）
- TC-SM-FE-010：读源码确认 StreamEvents 接口含两个新回调定义

### 2.4 前端构建验证（TC-SM-BUILD，2 例）

| 编号 | 命令 | 预期 |
|------|------|------|
| TC-SM-BUILD-001 | `cd apps/frontend && npx tsc --noEmit` | useStreamingChat.ts 零类型错误（预存的 CodeEditor.tsx / test 文件错误不算回归） |
| TC-SM-BUILD-002 | `cd apps/frontend && npx vite build` | 构建成功，产出 dist/ |

### 2.5 E2E 离线（TC-SM-E2E，3 例）

| 编号 | 用例 | 验证点 | 前置条件 |
|------|------|--------|---------|
| TC-SM-E2E-001 | Create 页加载 | `chat-input`/`send-button` 可见 | 前端 dev server |
| TC-SM-E2E-002 | 输入框接受文本 | 输入"测试"后值正确 | 同上 |
| TC-SM-E2E-003 | 前端启动无 console error | 页面加载后无 JS 错误 | 同上 |

### 2.6 E2E @ai 真实对话（TC-SM-AI，8 例，核心验证）

> **这组是最重要的**——验证 Memory 和 SOP 端到端打通。需要 **ZeroClaw daemon 重启后** + 前端。

| 编号 | 用例 | 操作 | 预期 | 对应改动 | R02 状态 |
|------|------|------|------|---------|---------|
| TC-SM-AI-001 | 项目创建后记忆自动存储 | 发"我想做一个项目" → 完成三轮提问 → 创建项目 | brain.db 出现 `finestem:project:{id}:profile` 记忆 | M6 | ⚠️需R03验证 |
| TC-SM-AI-002 | 阶段推进后记忆自动存储 | 在项目中推进阶段（到 stage_01+） | brain.db 出现 `finestem:project:{id}:stage_history` 记忆 | M6 | ⚠️需R03验证 |
| TC-SM-AI-003 | 跨会话记忆持久化 | 会话 A 创建项目 → 新会话 B 发"帮我回忆项目信息" | AI 能召回会话 A 存储的项目画像（或 AI 调用 project_memory_recall） | M4/M7 | ⚠️需R03验证 |
| TC-SM-AI-004 | project_memory_store 工具调用 | AI 主动调用 project_memory_store | tool_result 返回 success=True（**不再 120s 超时**） | M5 | ✅R02已验 |
| TC-SM-AI-005 | project_memory_recall 工具调用 | AI 主动调用 project_memory_recall | tool_result 返回存储的记忆内容 | M5 | ✅R02已验 |
| TC-SM-AI-006 | sop_state_sync 工具调用 | AI 推进阶段时调用 sop_state_sync | SKILL_STATE.metadata 含 sop_current_step | M5 | ⚠️需R03验证 |
| TC-SM-AI-007 | context 注入 memory hint | 项目有进度时发消息 | 发送给 ZeroClaw 的消息含 stage_progress / memory_hint | M7 | ❌未覆盖 |
| TC-SM-AI-008 | AI 回复完整不截断 | 发"解释 print 函数" | AI 回复 >20 字，无截断 | 回归 | ✅ |

**验证 brain.db 记忆的方式**：
```bash
# 测试前快照
H:/dev-env/zeroclaw/bin/zeroclaw.exe memory list --limit 50 > logs/<date>/memory-before.txt

# 测试后查询项目记忆（替换 {project_id}）
H:/dev-env/zeroclaw/bin/zeroclaw.exe memory list --limit 50 > logs/<date>/memory-after.txt

# 或直接查 brain.db
cd apps/backend && python -c "
from app.services.zeroclaw_memory import recall_project_profile, recall_stage_history
import json
profile = recall_project_profile('<project_id>')
history = recall_stage_history('<project_id>')
print('profile:', json.dumps(profile, ensure_ascii=False, indent=2))
print('history:', json.dumps(history, ensure_ascii=False, indent=2))
"
```

### 2.7 Playwright UI 实测（TC-SM-UI，6 例）

> 有头浏览器 + 截图 + 录屏。验证前端渲染和用户交互。

| 编号 | 用例 | 操作 | 预期 | 截图要求 |
|------|------|------|------|---------|
| TC-SM-UI-001 | 创建项目全流程 | 输入"我想做一个项目" → 三轮选项 → 项目创建 | 出现 `question-card` → 最终 `message-assistant` 含项目创建信息 | before/after 各一张 |
| TC-SM-UI-002 | 多轮对话不截断 | 连续发 3 条消息 | 每条 AI 回复完整可见 | 每轮 after 截图 |
| TC-SM-UI-003 | 阶段进度显示 | 项目创建后查看页面 | 页面显示当前阶段信息 | after 截图 |
| TC-SM-UI-004 | 选项卡正常渲染 | AI 提问后 | `question-card` 可见且可点击 | after 截图 |
| TC-SM-UI-005 | 刷新后状态恢复 | 项目创建后刷新页面 | 页面恢复到刷新前状态 | before/after 各一张 |
| TC-SM-UI-006 | 控制台无错误 | 全流程观察 console | 无 JS error / unhandled promise rejection | 失败时录屏 |

### 2.8 WebSocket 真实对话验证（TC-SM-WS，6 例）

> Python 脚本直连 ZeroClaw WS，不经过前端。最可靠的后端链路验证。
> **⚠️ daemon 必须已重启加载新配置。**

| 编号 | 用例 | 脚本 | 验证点 | 对应改动 | R02 状态 |
|------|------|------|--------|---------|---------|
| TC-SM-WS-001 | WS 握手成功 | `ws_frame_capture.py` | 连接 ws://127.0.0.1:42617/ws/chat，收到 connected 帧 | 基础 | ✅ |
| TC-SM-WS-002 | 多轮 PBL 对话 | `ws_multi_turn_test.py` | 4 轮对话完整，tool_call/tool_result 帧正确 | 回归 | ✅ |
| TC-SM-WS-003 | SOP 工具触发 | `ws_sop_test.py` | **R02 失败（pbl-stage-flow 不存在）→ R03 应能验证 SOP 已加载**。AI 调用 sop 相关工具不再 120s 超时 | S2 | ❌R02失败→需R03验证 |
| TC-SM-WS-004 | 记忆存储工具触发 | `ws_memory_test.py` | AI 调用 project_memory_store，返回 success | M5 | ✅R02已验 |
| TC-SM-WS-005 | 跨会话记忆召回 | `ws_memory_test.py` | 会话 A 存储 → 会话 B 召回，内容匹配 | M4 | ✅R02已验 |
| TC-SM-WS-006 | tool_name 归一化 | 抓帧验证 | `finestem__` 前缀正确剥离 | 回归 | ✅ |

**注意**：WS 测试脚本需要设置 `PYTHONIOENCODING=utf-8`（Windows GBK 控制台会因 emoji 崩溃）：
```bash
cd apps/backend
$env:PYTHONIOENCODING="utf-8"  # PowerShell
# 或
export PYTHONIOENCODING=utf-8  # Git Bash
python scripts/ws_memory_test.py
```

### 2.9 回归测试（TC-SM-REG，5 例）

| 编号 | 范围 | 命令 | 预期 | R02 结果 |
|------|------|------|------|---------|
| TC-SM-REG-001 | 后端全部测试 | `cd apps/backend && python -m pytest -v` | 87/87 pass（无新增失败） | ✅ 87/87 |
| TC-SM-REG-002 | 前端全部测试 | `cd apps/frontend && npx vitest run` | 43/43 pass | ✅ 43/43 |
| TC-SM-REG-003 | 原 12 工具正常 | 检查 TOOL_REGISTRY 含原 12 工具 | 全部存在且可用 | ✅ |
| TC-SM-REG-004 | 原有门禁正常 | `test_stage_constants.py` + `test_tools_gates.py` | 全部通过 | ✅ |
| TC-SM-REG-005 | MCP server 正常 | `test_mcp_server.py` | 10 例通过 | ✅ 10/10 |

---

## 3. 测试数据与取证要求

### 3.1 必须留存的数据

| 数据 | 存放 | 用途 |
|------|------|------|
| pytest 完整输出 | `logs/<date>/backend-unit.log` | 诊断失败用例 |
| pytest JUnit XML | `logs/<date>/junit-backend.xml` | 结构化比对 |
| vitest JSON | `logs/<date>/vitest-results.json` | 结构化比对 |
| Playwright 截图 | `test-results/`（自动） | UI 问题取证 |
| Playwright 录屏 | `test-results/`（失败时自动） | 复现 UI 问题 |
| ws 抓帧数据 | `logs/<date>/ws-*.json` | AI 对话帧数据 |
| `zeroclaw status` 输出 | `logs/<date>/zeroclaw-status.txt` | 配置生效证据 |
| `zeroclaw sop list` 输出 | `logs/<date>/zeroclaw-sop-list.txt` | SOP 加载证据 |
| `zeroclaw sop show pbl-stage-flow` 输出 | `logs/<date>/zeroclaw-sop-show.txt` | SOP 步骤详情 |
| daemon 启动日志 | `logs/<date>/daemon-startup.log` | **确认 daemon 加载了新配置（15 工具 + SOP）** |
| brain.db 查询结果 | `logs/<date>/brain-db-query.txt` | 记忆存储证据 |
| 环境快照 | `logs/<date>/environment.txt` | 环境基线 |

### 3.2 失败用例的强制取证

任何 `TC-SM-*` 用例失败时，测试 agent 必须收集：
1. 完整错误输出（不截断）
2. 复现命令（能让开发 agent 一键重跑）
3. 如果是 E2E/AI：失败时的截图 + WebSocket 帧数据
4. 如果是 Memory：brain.db 中相关记忆的查询结果
5. 如果是 SOP：`zeroclaw sop show pbl-stage-flow` 输出
6. 测试 agent 的初步判断（前端/后端/配置/环境问题）

### 3.3 Memory 测试专用数据

| 数据 | 获取方式 | 存放 |
|------|---------|------|
| brain.db 记忆列表 | `zeroclaw memory list --limit 50` | `logs/<date>/memory-list.txt` |
| brain.db 记忆统计 | `zeroclaw memory stats` | `logs/<date>/memory-stats.txt` |
| 测试前记忆快照 | 测试前执行 `memory list` | `logs/<date>/memory-before.txt` |
| 测试后记忆快照 | 测试后执行 `memory list` | `logs/<date>/memory-after.txt` |

---

## 4. 通过/失败判定标准

### 4.1 必须全通过（阻塞级）

| 用例组 | 数量 | 理由 |
|--------|------|------|
| TC-SM-CFG-001~012 | 12 | 配置没生效则整个系统不可用 |
| TC-SM-BE-001~028 | 28 | 工具和记忆层是安全底线 |
| TC-SM-BUILD-001~002 | 2 | 构建不过无法部署 |
| TC-SM-REG-001~005 | 5 | 不能引入回归 |

### 4.2 允许部分受环境影响（非阻塞）

| 用例组 | 依赖 | 非阻塞条件 |
|--------|------|-----------|
| TC-SM-AI-001~008 | ZeroClaw daemon + DeepSeek API + 网络 | daemon 未启动或 API 限流时记录"环境受限未跑" |
| TC-SM-UI-001~006 | 前端 dev server + ZeroClaw daemon | 同上 |
| TC-SM-WS-001~006 | ZeroClaw daemon | daemon 未启动时记录"环境受限未跑" |
| TC-SM-E2E-001~003 | 前端 dev server | server 未启动时记录"环境受限未跑" |

**关键判定**：如果 daemon 正常 + API 可用却失败，是**阻塞**。

### 4.3 回归判定

- TC-SM-REG-* 出现改动前没有的新失败 = 回归，阻塞
- 改动前就失败的 = 记录但不阻塞

---

## 5. 测试 agent 产出物

测试 agent 跑完后必须产出：

1. **测试报告**：`.trae/documents/testing/reports/SOP_Memory测试报告_<date>_R03.md`（按指南 8.2 模板）
2. **问题清单**：报告内"三、问题清单"章节，每个问题含编号/用例/现象/复现步骤/截图路径/修改建议/严重度
3. **日志数据**：`logs/<date>/` 下完整数据
4. **Playwright HTML 报告**：`test-results/e2e-report/`（如跑了 Playwright）

**报告交付给开发 agent 后，开发 agent 按测试工作指南 11 节处理。**

---

## 6. 标准执行顺序

```
0. ⚠️ 前置：重启 ZeroClaw daemon（最关键！）
   taskkill /F /IM zeroclaw.exe  （或找到 daemon 进程 kill）
   H:\dev-env\zeroclaw\bin\zeroclaw.exe daemon
   → 等待 5 秒
   → 存 logs/<date>/daemon-startup.log（重定向 daemon 输出）
   → curl -s http://127.0.0.1:42617/health 确认就绪

1. 拉最新代码 + 记录环境快照
   git pull
   → 写 logs/<date>/environment.txt

2. 配置验证（TC-SM-CFG，12 例）
   zeroclaw config migrate
   zeroclaw config get memory.backend
   zeroclaw config get memory.search_mode        ← R03 重点（R02 是 hybrid）
   zeroclaw config get memory.keyword_weight     ← 新增
   zeroclaw config get memory.auto_save          ← 新增
   zeroclaw config get sop.sops_dir              ← R03 重点（R02 是 unset）
   zeroclaw sop list                             ← R03 重点（R02 无 pbl-stage-flow）
   zeroclaw sop validate pbl-stage-flow          ← R03 重点（R02 是 not found）
   zeroclaw sop show pbl-stage-flow
   zeroclaw status
   → 存 zeroclaw-status.txt / zeroclaw-sop-list.txt / zeroclaw-sop-show.txt

3. 后端单元测试（TC-SM-BE，28 例）
   cd apps/backend
   python -m pytest tests/test_stage_constants.py tests/test_tools_gates.py tests/test_check_gate_structural.py tests/test_mcp_server.py -v --junitxml=../../.trae/documents/testing/logs/<date>/junit-backend.xml
   python scripts/test_memory_persistence.py -v
   python scripts/test_sop_integration.py -v
   → 存 backend-unit.log / junit-backend.xml

4. 前端单元测试 + 构建验证（TC-SM-FE + TC-SM-BUILD）
   cd apps/frontend
   npx vitest run --reporter=json > ../../.trae/documents/testing/logs/<date>/vitest-results.json
   npx tsc --noEmit 2>&1 | tee ../../.trae/documents/testing/logs/<date>/tsc-output.txt
   npx vite build 2>&1 | tee ../../.trae/documents/testing/logs/<date>/vite-build.txt
   → 存 vitest-results.json / tsc-output.txt / vite-build.txt

5. 确认服务（如需 E2E/AI）
   curl -s http://127.0.0.1:42617/health  ← daemon
   cd apps/frontend && npm run dev         ← 前端
   curl -s http://localhost:5184/ | head -c 20

6. E2E 离线（TC-SM-E2E，3 例）
   cd apps/frontend/tests
   npx playwright test --project=chromium --grep "smoke|basic"
   → 存 test-results/

7. E2E @ai（TC-SM-AI，8 例）
   RUN_AI_E2E=1 npx playwright test --project=chromium --grep "@ai"
   → 存 test-results/ + 截图

8. Playwright UI 实测（TC-SM-UI，6 例）
   npx playwright test --headed --video=retain-on-failure --screenshot=on
   → 存 test-results/ + screenshots/

9. WebSocket 真实对话（TC-SM-WS，6 例）
   cd apps/backend
   $env:PYTHONIOENCODING="utf-8"   # PowerShell（Git Bash 用 export）
   python scripts/ws_frame_capture.py
   python scripts/ws_multi_turn_test.py
   python scripts/ws_sop_test.py       ← R03 重点（R02 失败）
   python scripts/ws_memory_test.py
   → 存 logs/<date>/ws-*.json

10. Memory 数据取证
    zeroclaw memory list --limit 50
    zeroclaw memory stats
    → 存 memory-list.txt / memory-stats.txt / memory-before.txt / memory-after.txt

11. 回归测试（TC-SM-REG，5 例）
    cd apps/backend && python -m pytest -v
    cd apps/frontend && npx vitest run
    → 对比改动前结果

12. R01/R02 回归验证（第 8 节）
    → 逐项确认历史问题已修复

13. 编写测试报告
    → 按 8.2 模板写 reports/SOP_Memory测试报告_<date>_R03.md
    → 问题清单按严重度排序
    → 给出修改建议（不改代码！）

14. 通知开发 agent
```

---

## 7. 环境准备清单

### 7.1 服务清单

| 服务 | 端口 | 启动方式 | 何时需要 |
|------|------|---------|---------|
| ZeroClaw daemon | 42617 | `H:\dev-env\zeroclaw\bin\zeroclaw.exe daemon` | @ai / WS / 配置验证（**R03 必须重启**） |
| 后端 FastAPI | 3200 | `cd apps/backend && python main.py` | 集成 / E2E（需 API 时） |
| 前端 dev server | 5184 | `cd apps/frontend && npm run dev` | E2E / Playwright UI |
| sqlite (brain.db) | 文件 | 自动 | Memory 测试 |
| sqlite (finestem.db) | 文件 | 自动（`D:/data/finestem/finestem.db`） | 后端测试 |

### 7.2 关键路径

| 路径 | 用途 |
|------|------|
| `H:\dev-env\zeroclaw\bin\zeroclaw.exe` | ZeroClaw CLI |
| `H:\dev-env\zeroclaw\config\config.toml` | ZeroClaw 配置 |
| `H:\dev-env\zeroclaw\config\data\memory\brain.db` | Memory 数据库 |
| `H:\dev-env\zeroclaw\config\data\sops\pbl-stage-flow\` | SOP 定义（**R03 新增**） |
| `H:\dev-env\zeroclaw\config\agents\assistant\workspace\TOOLS.md` | 工具说明（**R03 更新**） |
| `G:\mediaProjects\fineSTEM\apps\backend\` | 后端代码 |
| `G:\mediaProjects\fineSTEM\apps\frontend\` | 前端代码 |
| `G:\mediaProjects\fineSTEM\apps\frontend\src\hooks\useStreamingChat.ts` | 前端 hook（**R03 M7 实施**） |
| `G:\mediaProjects\fineSTEM\apps\backend\scripts\test_memory_persistence.py` | Memory 测试脚本 |
| `G:\mediaProjects\fineSTEM\apps\backend\scripts\test_sop_integration.py` | SOP 测试脚本 |
| `G:\mediaProjects\fineSTEM\apps\backend\scripts\ws_sop_test.py` | SOP WS 测试 |
| `G:\mediaProjects\fineSTEM\apps\backend\scripts\ws_memory_test.py` | Memory WS 测试 |

### 7.3 ⚠️ 标准启动顺序（R03 最关键）

```bash
# ── 步骤 0：重启 ZeroClaw daemon（最关键！）──
# R03 的所有配置改动都在 config.toml，daemon 必须重启才能加载。
# R02 测试时 daemon 跑的是旧配置（无 [sop] 段、auto_approve 缺工具名）。

# 先停掉旧 daemon（如果运行中）
tasklist | findstr zeroclaw
taskkill /F /IM zeroclaw.exe

# 启动新 daemon（重定向输出到日志，确认加载了新配置）
H:\dev-env\zeroclaw\bin\zeroclaw.exe daemon > logs/<date>/daemon-startup.log 2>&1 &
# 或前台启动观察：
# H:\dev-env\zeroclaw\bin\zeroclaw.exe daemon

# 等待 daemon 就绪
sleep 5
curl -s http://127.0.0.1:42617/health

# ── 步骤 1：验证 daemon 加载了新配置 ──
H:\dev-env\zeroclaw\bin\zeroclaw.exe sop list
# 预期：含 pbl-stage-flow（Steps: 9），不再只有 test-sop

H:\dev-env\zeroclaw\bin\zeroclaw.exe config get sop.sops_dir
# 预期：H:\dev-env\zeroclaw\config\data\sops（不再是 unset）

H:\dev-env\zeroclaw\bin\zeroclaw.exe config get memory.search_mode
# 预期：bm25（不再是 hybrid）

# ── 步骤 2：启动前端（E2E 需要）──
cd G:\mediaProjects\fineSTEM\apps\frontend && npm run dev

# 等待前端就绪
sleep 3
curl -s http://localhost:5184/ | head -c 20
```

---

## 8. R01/R02 回归验证（R03 专项）

> 本节逐项确认 R01/R02 报告中的每个问题在 R03 是否已修复。
> **这是 R03 最核心的验证内容。**

### 8.1 R01 问题验证

| R01 问题 | 严重度 | R02 状态 | R03 预期 | 验证方法 |
|---------|--------|---------|---------|---------|
| #001 [sop] 段 + pbl-stage-flow SOP 不存在 | 阻塞 | ❌未修 | ✅已修复 | `zeroclaw sop list` 含 pbl-stage-flow；`zeroclaw config get sop.sops_dir` 返回绝对路径 |
| #002 auto_approve 缺新工具名（120s 超时） | 阻塞 | ✅已修 | ✅保持 | WS Memory 测试 tool_result success=True |
| #003 [memory] 段仅 backend=sqlite | 严重 | ❌未修 | ✅已修复 | `zeroclaw config get memory.search_mode` = bm25 |
| #004 test_mcp_server 12→15 回归 | 严重 | ✅已修 | ✅保持 | `python -m pytest tests/test_mcp_server.py` 10/10 |

### 8.2 R02 新增验证点

| 验证点 | R03 预期 | 验证方法 |
|--------|---------|---------|
| daemon 重启后加载 SOP | pbl-stage-flow 在 sop list 中 | 重启 daemon 后 `sop list` |
| 前端 M7 buildOutgoingMessage | 含 mode/stage_progress/memory_hint | 读源码 + tsc 编译通过 |
| 前端 M7 tool_result 5 种新工具 | 含 project_memory_store/recall/sop_state_sync/sop_execute/sop_status | 读源码 |
| 前端 M7 StreamEvents 2 回调 | 含 onSopStarted/onSopStatusUpdate | 读源码 |
| TOOLS.md 更新 | 含 3 个新工具 + 双重命名说明 | 读文件 |
| system_prompt 记忆规范 | 末尾含"项目记忆规范"段 | 读 config.toml |
| auto_approve 双重命名 | 含 3 个 finestem__ + 7 个内置名 | 读 config.toml |

---

## 9. 问题严重度定义

| 级别 | 含义 | 处理时效 | 示例 |
|------|------|---------|------|
| **阻塞** | 核心功能完全不可用 | 立即停止发布，开发 agent 立即修 | brain.db 路径错误导致记忆全部丢失 |
| **严重** | 主要功能受损但有 workaround | 发布前必须修 | FTS5 搜索失败但精确匹配可用 |
| **一般** | 次要功能问题或体验差 | 下个迭代修 | memory hint 文本格式不规范 |
| **轻微** | 文案、样式小瑕疵 | 有空再修 | TOOLS.md 描述不够详细 |

---

## 10. 测试 Agent 执行 Prompt（可直接复制给测试 Agent）

```
你是 fineSTEM 项目的测试 agent。现在需要执行 SOP & Memory 专项测试 R03 轮次。

## 背景
R01 发现 2 项阻塞（[sop] 段缺失 + auto_approve 缺新工具名）。
R02 修复了 auto_approve 和 test_mcp_server 回归，但 pbl-stage-flow SOP 仍未创建。
R03 前，开发 agent 已补齐所有遗留问题：
- [sop] 段已加（sops_dir 绝对路径）
- pbl-stage-flow SOP 已创建（Steps: 9，validate 通过）
- [memory] 段已扩展（search_mode=bm25 等）
- auto_approve 已追加 10 个工具名（3 finestem__ + 7 内置）
- 前端 M7 已实施（buildOutgoingMessage + tool_result + StreamEvents）
- TOOLS.md 已更新
- system_prompt 已追加记忆规范

## 你的任务
按 `SOP_Memory专项测试计划_v1.0.0.md`（v1.1.0 版本）执行全部测试。

## 最关键的注意事项
1. **必须先重启 ZeroClaw daemon**——config.toml 改了，旧 daemon 还跑着旧配置。
   不重启的话所有配置验证都会失败（和 R02 一样）。
2. 重点验证 R01/R02 的历史阻塞是否真的修了（第 8 节）。
3. 前端 M7 是 R03 新实施的，R02 没覆盖到，需要重点验证。
4. 你不改任何代码，只测试 + 出报告。
5. WS 测试脚本记得设 PYTHONIOENCODING=utf-8。

## 产出
测试报告写到 `.trae/documents/testing/reports/SOP_Memory测试报告_2026-07-22_R03.md`。
```

---

**文档结束。测试 agent 执行前必须先读本计划 + `测试工作指南_v1.0.0.md`。**
