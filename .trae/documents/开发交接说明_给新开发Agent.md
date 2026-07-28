# fineSTEM 开发交接说明

> **给新接手的开发 AI Agent**。本文档是项目唯一入口——读完即可开始工作。
> 创建时间：2026-07-23 | 上一任开发 Agent 编写

---

## 1. 项目是什么

fineSTEM 是面向 12-18 岁青少年的 STEM 编程 PBL（项目式学习）教学平台。学生通过 AI 导师引导，走完 9 阶段研学流程（脑爆→开题→范围→轨道→设计→计划→编码→验收），最终产出一个可运行的编程项目。

**架构**：前端 React + Vite → ZeroClaw Agent Daemon（Rust，端口 42617）→ 后端 FastAPI + MCP Server（Python，端口 3200）

**核心链路**：前端 WebSocket 直连 ZeroClaw → ZeroClaw Agent Loop 调用 15 个 finestem__ MCP 工具 → 后端处理业务逻辑 + 读写 SQLite

---

## 2. 关键路径速查（改代码前必看）

### 代码

| 文件 | 作用 | 行数 | 注意事项 |
|------|------|------|---------|
| `apps/frontend/src/hooks/useStreamingChat.ts` | WebSocket 连接 + 帧解析 + 卡片渲染 | ~900 | **改动最频繁的文件**。tool_call/done 帧处理、questionFired 标志、延迟检查都在这里 |
| `apps/frontend/src/pages/Create.tsx` | 主聊天页面 | ~3400 | handleQuestionAnswer（多卡提交）、studentProfileRef、showPendingQuestions |
| `apps/frontend/src/components/QuestionCard.tsx` | 选项卡组件 | ~260 | 多选/单选 UI、toggleOption、handleSubmit |
| `apps/frontend/src/lib/questionParser.ts` | 问题解析器 | ~650 | parseQuestionBlocks（XML）、extractChoiceListStrict（精确兜底） |
| `apps/backend/app/services/tools.py` | 15 个 MCP 工具定义 | ~1360 | TOOL_REGISTRY、StageAdvancerTool、AskQuestionTool 等 |
| `apps/backend/app/services/stage_constants.py` | 9 阶段常量 | ~150 | STAGE_ORDER、can_advance_to、check_gate |
| `apps/backend/app/services/pbl_engine.py` | PBL 引擎 | ~300 | check_gate 双层校验（硬门禁+软结构） |
| `apps/backend/app/services/zeroclaw_memory.py` | Memory 访问层 | ~295 | brain.db 直接读写、FTS5 搜索 |
| `apps/backend/app/mcp_server/server.py` | MCP Server 入口 | ~60 | stdio JSON-RPC，ZeroClaw spawn |

### 配置（⚠️ 不在 git 里，在 H 盘）

| 文件 | 作用 |
|------|------|
| `H:/dev-env/zeroclaw/config/config.toml` | ZeroClaw 主配置（model/auto_approve/system_prompt/tool_filter） |
| `H:/dev-env/zeroclaw/config/agents/assistant/workspace/skills/stem-pbl-guide/SKILL.md` | ZeroClaw 专用 PBL 导师 skill |
| `H:/dev-env/zeroclaw/config/agents/assistant/workspace/SOUL.md` | Agent 身份 |
| `H:/dev-env/zeroclaw/config/agents/assistant/workspace/TOOLS.md` | 工具速查 |
| `H:/dev-env/zeroclaw/config/data/sops/pbl-stage-flow/` | SOP 定义（9 阶段） |
| `H:/dev-env/zeroclaw/config/data/memory/brain.db` | Memory 数据库 |

### 数据库

| DB | 路径 | 内容 |
|----|------|------|
| finestem.db | `D:/data/finestem/finestem.db` | 项目、工件、技能状态、证据、成果卡 |
| brain.db | `H:/dev-env/zeroclaw/config/data/memory/brain.db` | 跨会话记忆（项目画像、阶段历史） |
| sessions.db | `H:/dev-env/zeroclaw/config/data/sessions/sessions.db` | ZeroClaw 对话历史 |

### 启动

```bash
# 方法 1：一键启动（自动清理旧进程）
G:/mediaProjects/fineSTEM/start_system.bat

# 方法 2：手动
H:/dev-env/zeroclaw/bin/zeroclaw.exe daemon                    # ZeroClaw
cd apps/backend && python -m uvicorn main:app --port 3200      # 后端
cd apps/frontend && npm run dev                                 # 前端
```

⚠️ **改了 config.toml 或 SKILL.md 后必须重启 daemon**：`Stop-Process -Name zeroclaw -Force` → 重启

---

## 3. 问题清单（最重要）

**文件**：`.trae/documents/问题清单_长期维护.md`

这是对话系统的**唯一权威问题追踪源**。当前 Q-001~Q-011 共 11 个问题全部 🟢已修，但人工测试可能发现新问题或复现。

### 常见问题模式（你一定会遇到的）

| 模式 | 根因 | 排查方法 |
|------|------|---------|
| **选项卡不显示** | AI 没调 ask_question / tool_call 帧丢失 / questionFired 时序 | 查 trace：`tail runtime-trace.jsonl \| grep ask_question` |
| **重复选项卡** | tool_call + extractChoiceListStrict 双路径 / tool_call 帧迟到 | 检查 done 帧的 500ms 延迟检查是否生效 |
| **总结变选项卡** | extractChoiceListStrict 意图词太宽泛 | 测试 extractChoiceListStrict 的正例/反例 |
| **AI 重复问** | student_profile 没注入 / AI 忽略 context | 查 buildOutgoingMessage 输出是否含 student_profile |
| **AI 卡住不推进** | 学生点选项没点确定 / [选择] 格式不识别 | 检查 handleQuestionAnswer 是否被调用 |

### 发现新 bug 时的工作流程

1. **复现**：用 WS 脚本或 Playwright 有头测试复现
2. **查 trace**：`H:/dev-env/zeroclaw/config/data/state/runtime-trace.jsonl` 找 tool_call 和 error
3. **查 session**：`sessions.db` 的 sessions 表存了完整对话文本
4. **定位根因**：是前端渲染问题 / 后端工具问题 / AI 模型行为 / 配置问题？
5. **修复 + 加测试**：修代码后在问题清单加 Q-NNN 条目 + 在测试计划加 RT-NN 检查项
6. **WS 验证**：改完后跑 `python scripts/ws_regression_test.py`
7. **通知测试 agent**：给测试 agent prompt 让它全面回归测试

---

## 4. 如何与测试 agent 合作

### 工作流（5 步循环）

```
你（开发）                          测试 agent
  │                                    │
  ├── 修复 bug + 加单元测试 ──────────→│
  │                                    ├── 拉最新代码
  │                                    ├── 重启 daemon + 前端
  │                                    ├── 跑全套测试（单元+WS+Playwright有头）
  │                                    ├── 写测试报告
  │  ←── 报告（含 Q-NNN 对照表）───────┤
  │                                    │
  ├── 读报告，修复失败项 ─────────────→│
  │                                    ├── 回归验证
  │  ←── 更新报告 ─────────────────────┤
```

### 红线

- **测试 agent 不改产品代码**（`apps/` 下的非测试文件、`H:/dev-env/zeroclaw/config/`）
- **测试 agent 只写报告 + 建议**，你根据报告修
- 你改完后给测试 agent 一段 prompt（见第 6 节模板），它执行测试

### 关键测试文件

| 文件 | 用途 |
|------|------|
| `.trae/documents/testing/plans/对话系统回归测试计划_v1.0.0.md` | 最新测试计划（含 TC-DLG-001~012） |
| `.trae/documents/testing/测试工作指南_v1.0.0.md` | 测试规范（必读） |
| `apps/frontend/tests/specs/zeroclaw-integration.spec.ts` | Playwright E2E spec |
| `apps/backend/scripts/ws_regression_test.py` | WS 7 轮回归脚本 |
| `apps/frontend/src/lib/questionParser.test.ts` | 问题解析器单元测试 |
| `apps/backend/tests/test_*.py` | 后端单元测试（87 个） |

### 给测试 agent 的标准 prompt 模板

```
你是测试 agent。对 fineSTEM AI 对话系统执行回归测试。

## 本次变更
[描述你改了什么、为什么改、改了哪些文件]

## ⚠️ 强制要求
1. 必须有头测试：Playwright --headed
2. 必须推进到 stage_04+（只测前两轮不算通过）
3. 必须重启 daemon（config.toml/prompt 改了）
4. 报告含 Q-001~Q-011 对照表

## 必读
- .trae/documents/问题清单_长期维护.md
- .trae/documents/testing/plans/对话系统回归测试计划_v1.0.0.md
- .trae/documents/testing/测试工作指南_v1.0.0.md

## 执行
0. 重启 daemon + 前端
1. 单元测试：vitest + tsc + vite build + pytest
2. WS 回归：python scripts/ws_regression_test.py
3. Playwright 有头 E2E（最核心）：
   set RUN_AI_E2E=1
   npx playwright test zeroclaw-integration --project=chromium --headed --video=retain-on-failure --screenshot=on

## 报告
写到 reports/对话系统回归测试报告_<date>_<变更标签>.md
```

---

## 5. 深入分析指南（遇到 bug 怎么排查）

### 5.1 工具链路排查

AI 调工具的完整链路：
```
前端 WebSocket → ZeroClaw Gateway → Agent Loop → MCP stdio → 后端 tools.py → DB
     ↑                    ↓
     ← tool_call 帧 ← tool_result ←
```

**排查顺序**（从前到后）：
1. 前端 console 有没有报错？
2. WebSocket 帧对不对？（用 `ws_frame_capture.py` 抓帧）
3. ZeroClaw trace 有没有 tool_call？（`runtime-trace.jsonl`）
4. 后端 MCP server 有没有收到？（看 `isError` 返回）
5. DB 状态对不对？（查 finestem.db 的 skill_states 表）

### 5.2 选项卡渲染排查

选项卡有 **3 条渲染路径**，按优先级：

```
1. ask_question tool_call 帧 → questionFired=true → onQuestions → QuestionCard
2. <question> XML → parseQuestionBlocks → onQuestions → QuestionCard
3. 精确选项列表兜底 → extractChoiceListStrict → onQuestions → QuestionCard
   （仅在 questionFired=false 且延迟 500ms 后仍无 tool_call 时启用）
```

**排查选项卡问题**：
- 没卡片 → 查 trace 有没有 ask_question tool_call → 有 = 前端渲染 bug；无 = AI 没调工具
- 重复卡 → 检查 questionFired 标志 + 500ms 延迟是否生效
- 误识别卡 → 检查 extractChoiceListStrict 的意图词匹配 + 短词过滤

### 5.3 AI 模型行为排查

DeepSeek 模型的问题：
- **~10-15% 轮次不调 ask_question**（用文字列表替代）→ 兜底处理
- **多轮对话后退化为文字**（context 变长后忘记调工具）→ student_profile 注入
- **不 100% 遵守 system_prompt**（prompt 层面已到极限）→ 需要代码层兜底

**查 AI 实际行为**：
```bash
# trace 里找 ask_question 调用
tail -5000 H:/dev-env/zeroclaw/config/data/state/runtime-trace.jsonl | python -c "
import sys, json
for line in sys.stdin:
    d = json.loads(line.strip())
    s = json.dumps(d, ensure_ascii=False)
    if 'ask_question' in s and 'arguments' in str(d.get('attributes',{})):
        ts = d.get('@timestamp','')[:19]
        print(f'[{ts}] {d[\"attributes\"].get(\"arguments\",\"\")[:200]}')
"

# session 里找 AI 文本
python -c "
import sqlite3
conn = sqlite3.connect('H:/dev-env/zeroclaw/config/data/sessions/sessions.db')
conn.row_factory = sqlite3.Row
rows = conn.execute('SELECT id, role, substr(content,1,300) as c, created_at FROM sessions ORDER BY created_at DESC LIMIT 10').fetchall()
for r in reversed(rows):
    print(f'[{r[\"id\"]}] {r[\"role\"]}: {r[\"c\"]}')
"
```

### 5.4 PBL 流程排查

9 阶段流程的门禁在 `stage_constants.py` + `pbl_engine.py`：
```
stage_00 → stage_01 → ... → stage_08
  ↑ can_advance_to 只允许下一阶段
  ↑ check_gate 检查工件是否完成
```

**AI 卡在某个阶段不推进**：
1. 查 skill_states 表的 current_stage
2. 查 stage_advancer 的 check_gate 返回了什么 missing
3. 查 artifact 是否已写入（skill_states.standard_step_data）

---

## 6. 当前状态和已知风险

### 已完成（Q-001~Q-011 全部修复）

| 领域 | 状态 |
|------|------|
| ZeroClaw 集成（config + MCP + skill） | ✅ 完成 |
| 15 个 MCP 工具 | ✅ 完成 |
| 后端门禁（stage_constants + pbl_engine） | ✅ 完成 |
| 前端 WebSocket + 帧解析 | ✅ 完成 |
| 选项卡渲染（tool_call + XML + 兜底） | ✅ 完成 |
| Memory 持久化（brain.db） | ✅ 完成 |
| SOP 流程定义（pbl-stage-flow） | ✅ 完成 |
| 测试体系（单元+WS+Playwright） | ✅ 完成 |
| 问题清单 Q-001~Q-011 | ✅ 全部修复 |

### 已知风险（你可能会踩的坑）

1. **DeepSeek 模型不稳定**：~10-15% 轮次不调 ask_question。extractChoiceListStrict 兜底但不是 100% 覆盖。考虑切换到 Claude/GPT。
2. **config.toml 不在 git 里**：在 `H:/dev-env/zeroclaw/config/`。改了必须重启 daemon。
3. **Create.tsx 3400 行**：太大，改动容易引入副作用。每次改完跑 vitest + tsc。
4. **sessions.db 存的是纯文本**：tool_call 不在 session 记录里，要查 trace。
5. **前端 HMR 偶尔不生效**：改了前端代码如果没效果，重启 dev server。
6. **esbuild 崩溃**：`start_system.bat` 已加自动清理旧进程。
7. **PBL 全流程未必跑通**：stage_05~stage_08 的代码生成/执行/验收环节可能还有隐藏 bug。

### 未完成 / 待打磨

- PBL stage_05~08 的深度验证（设计→编码→验收全链路）
- `orchestrator.py` 标记为 DEPRECATED（不再使用，但未删除）
- Playwright 有时双版本冲突（root vs tests/node_modules）
- 测试日志目录有大量历史文件（`logs/` 约 120 个），可定期清理

---

## 7. 文档索引

### 必读（按优先级）

| # | 文档 | 路径 | 用途 |
|---|------|------|------|
| 1 | **问题清单** | `.trae/documents/问题清单_长期维护.md` | 11 个问题的根因+修复+测试要求 |
| 2 | **测试工作指南** | `.trae/documents/testing/测试工作指南_v1.0.0.md` | 测试规范（开发/测试分工） |
| 3 | **回归测试计划** | `.trae/documents/testing/plans/对话系统回归测试计划_v1.0.0.md` | 最新测试用例（TC-DLG-001~012） |
| 4 | **ZeroClaw 集成重构** | `.trae/documents/技术与架构/ZeroClaw集成重构_v1.0.0.md` | 架构决策和技术细节 |
| 5 | **SOP/Memory 技术总结** | `.trae/documents/技术与架构/SOP_Memory集成技术实现总结_v1.0.0.md` | SOP + Memory 实现细节 |
| 6 | **部署运维指南** | `.trae/documents/技术与架构/ZeroClaw部署与运维指南_v1.0.0.md` | daemon 启停/配置/排查 |

### 按需读

| 文档 | 路径 | 何时读 |
|------|------|--------|
| 测试体系总览 | `.trae/documents/testing/测试体系总览_v2.0.0.md` | 想了解测试架构全貌 |
| 架构审计报告 | `.trae/documents/audit/ZeroClaw架构审计报告_v1.0.0_2026-07-22.md` | 想了解已知风险（R1-R8） |
| SOP/Memory 交接文档 | `.trae/documents/管理与计划/SOP_Memory_交接文档_给开发Agent.md` | 想了解 SOP/Memory 调研结论 |
| 测试 agent prompt | `.trae/documents/testing/prompts/对话系统回归测试Agent_Prompt.md` | 需要给测试 agent 下任务 |
| 产品需求 | `.trae/documents/产品与规划/` | 想了解 PBL 流程设计意图 |

---

## 8. 给新开发的启动 Prompt

把以下内容给新接手的开发 AI Agent：

```
你是 fineSTEM 项目的新开发 Agent。项目是一个 STEM 编程 PBL 教学平台，前端 React → ZeroClaw Agent Daemon → 后端 FastAPI + MCP。

## 必读（按顺序）
1. `.trae/documents/开发交接说明_给新开发Agent.md`（本文档，项目全貌）
2. `.trae/documents/问题清单_长期维护.md`（11 个历史问题的根因和修复方案）
3. `.trae/documents/testing/测试工作指南_v1.0.0.md`（开发和测试的分工红线）

## 当前状态
- Q-001~Q-011 全部已修，自动化测试通过
- 但人工测试可能发现新问题——你的核心任务是修 bug + 打磨 PBL 全流程
- DeepSeek 模型 ~10-15% 轮次不调 ask_question，前端有 extractChoiceListStrict 兜底

## 发现 bug 后的工作流程
1. 复现：用 WS 脚本（`apps/backend/scripts/ws_regression_test.py`）或 Playwright 有头测试
2. 查 trace：`H:/dev-env/zeroclaw/config/data/state/runtime-trace.jsonl` 找 tool_call
3. 查 session：`sessions.db` 的 sessions 表存了对话文本
4. 定位：前端渲染 / 后端工具 / AI 模型行为 / 配置
5. 修复 + 加测试：改代码后在问题清单加 Q-NNN + 测试计划加 RT-NN
6. WS 验证：`python scripts/ws_regression_test.py`
7. 通知测试 agent：给一段 prompt 让它全面回归测试

## 关键约束
- config.toml 在 `H:/dev-env/zeroclaw/config/`（不在 git），改了要重启 daemon
- 测试 agent 不改产品代码，你改完给它 prompt 让它测
- 问题清单是唯一权威问题追踪源——每次改动更新它
- Create.tsx 3400 行，改完务必跑 vitest + tsc + vite build
```

---

*本文档由上一任开发 Agent 编写，2026-07-23。项目处于"Q-001~Q-011 全修 + 自动化测试通过"状态，等待人工测试发现新问题。*
