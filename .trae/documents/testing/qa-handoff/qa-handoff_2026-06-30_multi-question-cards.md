# QA 交接说明（R2）— 多卡并列 + 批量提交 + 解析回归修复

- version: v1.0.0
- created_at: 2026-06-30 14:00:00.000
- maintainer: AI Agent（开发 Agent）
- status: ready-for-qa
- 本文件用途：**直接交给第三方 QA 工具/AI 测试平台**，作为本轮独立测试的完整输入。
- 触发条件：开发 Agent 完成大型修改后、准备让用户手动测试**之前**，才生成本目录下的交接文件；小改/局部修复不进本目录。
- 配套通用模板：[.trae/templates/qa-agent-prompt.md](../../../templates/qa-agent-prompt.md) v1.1.0
- 上一轮 QA 报告：[reports/round1_report.md](../reports/round1_report.md) / [logs/2026-06-30/round1_summary.json](../logs/2026-06-30/round1_summary.json)

---

## 1. 给 QA 工具的指令（直接复制为系统 Prompt）

```text
你是 fineSTEM 项目的 QA Bot（独立测试 Agent）。
你只跑测试、采集证据、写问题清单；NEVER 修改任何业务代码、配置、密钥。
若发现环境问题，登记到 blockers，不主动重启。

# 项目信息
- 项目根目录：g:\mediaProjects\fineSTEM
- 技术栈：FastAPI + SQLite + React 18 + Vite + Playwright
- 启动方式：.\start_system.bat（如未运行需用户先启动；不要自行启动）
- 健康检查：http://127.0.0.1:3200/health（应返回 200 + {"status":"healthy"}）
- 端口白名单：FE 5184、BE 3200（不得擅自切换）

# 本轮测试范围
- 改动摘要：AI 多卡并列 + 批量提交 + TC-MQ-008 解析回归修复
- 重点验证：见本文件第 3 节测试矩阵
- 测试入口：
  - 后端单测：cd apps/backend && python -m pytest -q tests/test_projects.py::TestQuestionFallbackBehavior
  - 后端全量：cd apps/backend && python -m pytest -q
  - smoke 端到端：python scripts/run_create_smoke.py
  - 前端 E2E：cd apps/frontend && npx playwright test specs/create-*.spec.ts
- 已知历史用例：
  - apps/backend/tests/test_projects.py
  - apps/frontend/tests/specs/create-*.spec.ts

# 工作流（严格 6 步）
1. Setup：核对 BE/FE 健康；不健康直接进 blockers，不要自己重启系统超过 1 次
2. Plan：把第 3 节矩阵列入 plan 段（report 顶部）
3. Execute：按矩阵跑用例；失败立即停止派发新用例（保留已有证据）
4. Diagnose：每个失败按 functional-bug / regression / flaky / data-issue / env-issue / spec-ambiguity 分类
5. Report：写两份产物
   - Markdown：.trae/documents/testing/reports/round2_report.md
   - JSON：.trae/documents/testing/logs/2026-06-30/round2_summary.json（schema 见本文件第 5 节）
6. Handoff：在 Markdown 末尾写「给开发 Agent 的话」段——只列 P0/P1 + 复现 ID + 建议关注的文件/函数（不写修复方案）

# 硬约束
- 不得修改任何 *.py / *.ts / *.tsx / *.json 业务文件；只能写 .trae/documents/testing/ 目录
- 不得读取 .env、密钥、用户密码；测试账号使用既有 testing 配置
- 时间戳一律使用 MCP 格式 YYYY-MM-DD HH:MM:SS.fff（UTC）
- 报告语言：简体中文；代码片段保留英文
- 测试一旦失败 ≥1 个，整体 status 必须是 "failed"，不允许 partial-pass 美化
- flaky 必须连续重跑 3 次都失败才能升 P1
- 不要分析"为什么会出 bug"——那是开发 Agent 的活
```

---

## 2. 本轮改动清单（开发 Agent 已交付）

| # | 文件 | 关键改动 | 验证目标 |
|---|---|---|---|
| 1 | [apps/backend/app/services/orchestrator.py](../../../../apps/backend/app/services/orchestrator.py) L1955-2055 | 新增 `_extract_plaintext_question_blocks(text)` → `list[(title, options)]`，按出现顺序识别多个独立维度块 | TC-MQ-008/009/U-01/U-02/U-03 |
| 2 | [apps/backend/app/services/orchestrator.py](../../../../apps/backend/app/services/orchestrator.py) L1120-1162 | 流式兜底分支：遍历 valid_blocks 多次 `yield ("question", ...)`；id 加 `block_idx` 后缀防覆盖 | TC-MQ-001/002 |
| 3 | [apps/backend/app/services/orchestrator.py](../../../../apps/backend/app/services/orchestrator.py) L1325-1326 | xml_instruction 改为"按维度调 N 次本工具" | （观察项，无独立用例） |
| 4 | [apps/backend/app/services/tools.py](../../../../apps/backend/app/services/tools.py) L60-70 | tool description 引导一轮多次调用 ask_user_question | （观察项） |
| 5 | [apps/frontend/src/pages/Create.tsx](../../../../apps/frontend/src/pages/Create.tsx) L1217-1230 | 新增 `pendingQuestions: QuestionData[]` + `pendingAnswers` 草稿 | TC-MQ-001/002/003/004/005 |
| 6 | [apps/frontend/src/pages/Create.tsx](../../../../apps/frontend/src/pages/Create.tsx) L1444-1518 | `showPendingQuestion` 双分支：同源步骤栈式覆盖、非同源进多卡 list | TC-MQ-006 |
| 7 | [apps/frontend/src/pages/Create.tsx](../../../../apps/frontend/src/pages/Create.tsx) L1864-1909 | `handleQuestionAnswer` 双行为（单卡直发/多卡入草稿）+ `handleBatchSubmit` 拼 `[批量回答]` | TC-MQ-003/004 |
| 8 | [apps/frontend/src/components/QuestionCard.tsx](../../../../apps/frontend/src/components/QuestionCard.tsx) | 新增 `answered` / `answeredSummary` / `submitLabel` props；answered 灰态 | TC-MQ-002 |
| 9 | [apps/backend/tests/test_projects.py](../../../../apps/backend/tests/test_projects.py) L618-677 | 旧用例迁移到新入口；补 2 条新单测（状态列表过滤、多维度块识别） | TC-MQ-008/009 / U-01/U-02/U-03 |

---

## 3. 测试矩阵（必须按 ID 顺序执行）

### 3.1 单元测试层（U）— 必跑

| 用例 ID | 路径 | 入口 | 预期 | 证据 |
|---|---|---|---|---|
| U-01 | A 单测 | `python -m pytest -q tests/test_projects.py::TestQuestionFallbackBehavior::test_parse_question_block_supports_plaintext_numbered_options` | 1 passed；新断言走 `_extract_plaintext_question_blocks`，返回 1 块 + title + 3 options | pytest 输出 |
| U-02 | A 单测 | `python -m pytest -q tests/test_projects.py::TestQuestionFallbackBehavior::test_extract_plaintext_question_blocks_filters_status_lists` | 1 passed；状态列表（含 ✅ / docs/ 路径）返回空 list | pytest 输出 |
| U-03 | A 单测 | `python -m pytest -q tests/test_projects.py::TestQuestionFallbackBehavior::test_extract_plaintext_question_blocks_supports_multiple_dimensions` | 1 passed；2 个独立维度返回 2 块 | pytest 输出 |
| U-04 | B 回归 | `cd apps/backend && python -m pytest -q tests/test_projects.py::TestQuestionFallbackBehavior` | 9 passed in <2s | pytest 输出 |
| U-05 | B 回归 | `cd apps/backend && python -m pytest -q` | 全量绿；记录失败用例（若有） | pytest 输出 |

### 3.2 集成 / smoke 层（S）

| 用例 ID | 路径 | 入口 | 预期 | 证据 |
|---|---|---|---|---|
| S-01 | A smoke | `python scripts/run_create_smoke.py` | `overall_passed: true`；产物 summary JSON 落盘 `.trae/documents/testing/logs/<YYYY-MM-DD>/create-smoke-summary_*.json` | summary JSON |
| S-02 | C 边界 | smoke 中观察 WS 消息 | 当 AI 一轮 emit 多个 question 事件时，事件 id 互不相同（含 block_idx 后缀） | WS payload 录摘 |

### 3.3 端到端层（E2E）

| 用例 ID | 路径 | 入口建议 | 步骤要点 | 预期 | 证据 |
|---|---|---|---|---|---|
| TC-MQ-001 | A E2E | `cd apps/frontend && npx playwright test specs/create-question-options-restore.spec.ts` 或手动 /create | 触发 AI 多维度提问的 prompt（如"帮我设计一个互动故事网页"） | messagesEnd 上方渲染 ≥2 张 QuestionCard + 1 个批量提交工具条 | 截图 + DOM 快照 |
| TC-MQ-002 | A E2E | 手动/Playwright | 暂存其中 1 张卡（点确定） | 该卡变 answered 灰态、文案变"已暂存"；工具条提交按钮仍 disabled；其他卡仍可交互 | 截图 |
| TC-MQ-003 | A E2E | 手动/Playwright + network 录制 | 暂存全部卡 → 点"提交全部回答" | network 单条消息文本以 `[批量回答]\n1.…\n2.…` 开头；所有卡消失 | network payload + 截图 |
| TC-MQ-004 | A E2E | 手动 | 触发只问 1 个维度的场景（简单需求） | 单卡路径，按钮文案"确定"，点击直接发送；无批量工具条 | 截图 + WS log |
| TC-MQ-005 | B E2E | `npx playwright test specs/create-history-restore.spec.ts` | 多卡未答状态下刷新页面 | pendingQuestions 至少恢复 1 张（理想全部恢复） | 截图 |
| TC-MQ-006 | B E2E | 手动 | 同 stage 内 step=1 → step=2 切换 | 不入多卡 list，覆盖渲染同一张卡 | DOM 快照 |
| TC-MQ-007 | C E2E | 手动 | 多卡场景关闭/取消单张卡 | 仅该卡消失，其他卡保持 | 截图 |

### 3.4 路径分类说明
- **A 改动直接路径**（必跑）：U-01/02/03、S-01、TC-MQ-001/002/003/004
- **B 关联回归**：U-04/05、TC-MQ-005/006
- **C 边界/异常**：S-02、TC-MQ-007

---

## 4. 已修复的 R1 P0（基线对照）

R1 抓到的 TC-MQ-008（`_parse_question_block` 解析正文编号列表失败）已在本轮修复：
- **根因**：测试用例期望与已废弃旧架构匹配（`_parse_question_block` 已主动移除纯文本反向解析以防"选项卡乱弹"，新逻辑下沉到 `_extract_plaintext_question_blocks`）
- **修复**：测试断言迁移到新入口（[test_projects.py L618-638](../../../../apps/backend/tests/test_projects.py#L618-L638)）
- **本地验证**：`TestQuestionFallbackBehavior` 9 passed in 0.32s

QA 工具本轮请重点确认 U-01 通过，证明回归已闭环。

---

## 5. 报告输出 Schema（机读，给开发 Agent 解析）

QA 工具必须按此 schema 写 `.trae/documents/testing/logs/2026-06-30/round2_summary.json`：

```json
{
  "report_id": "qa-2026-06-30T<HHMMSS>",
  "round": 2,
  "started_at": "YYYY-MM-DD HH:MM:SS.fff",
  "finished_at": "YYYY-MM-DD HH:MM:SS.fff",
  "scope": {
    "change_summary": "多卡并列 + 批量提交 + TC-MQ-008 解析回归修复",
    "commits_or_files": [
      "apps/backend/app/services/orchestrator.py",
      "apps/backend/app/services/tools.py",
      "apps/backend/tests/test_projects.py",
      "apps/frontend/src/pages/Create.tsx",
      "apps/frontend/src/components/QuestionCard.tsx"
    ]
  },
  "environment": {
    "frontend_port": 5184,
    "backend_port": 3200,
    "backend_health": "ok | degraded | down",
    "browser": "Chromium <version>",
    "python": "3.12.x",
    "pytest": "8.x"
  },
  "summary": {
    "status": "passed | failed",
    "total": 0,
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "blockers": []
  },
  "cases": [
    {
      "id": "U-01",
      "title": "...",
      "category": "A | B | C",
      "type": "unit | integration | smoke | e2e | api",
      "entry": "<可复制命令>",
      "status": "passed | failed | skipped",
      "duration_ms": 0,
      "expected": "...",
      "actual": "...",
      "evidence": [
        {"type": "stack | console | screenshot | payload | command | context", "snippet": "...", "path": "可选"}
      ],
      "classification": "functional-bug | regression | flaky | data-issue | env-issue | spec-ambiguity",
      "severity": "P0 | P1 | P2 | P3",
      "reproducible": "always | sometimes | once",
      "repro_steps": ["1. ...", "2. ..."],
      "first_seen_round": 2,
      "notes_to_dev": "建议关注的文件/函数/日志关键字（不写修复方案）"
    }
  ],
  "regressions": [],
  "flaky": [],
  "blockers": []
}
```

字段约束：
- `severity`：P0 核心路径不可用 / P1 影响明确 / P2 边角可绕 / P3 可推后
- `notes_to_dev`：**禁止**写修复方案；只写"建议看 X 文件 / X 函数 / X 日志关键字"

---

## 6. Markdown 报告模板

```markdown
# 测试报告 R2 — 多卡并列 + 批量提交 + 解析回归修复

- 时间：${STARTED_AT} → ${FINISHED_AT}
- 环境：FE=5184 BE=3200 backend_health=${HEALTH}
- 总览：${PASSED}/${TOTAL} 通过；${FAILED} 失败；${SKIPPED} 跳过

## 给开发 Agent 的话
- P0：<用例 ID> → 关注 <file:func>
- P1：<用例 ID> → 关注 <file:func>
- 建议下一轮先修 P0，跑 <最小子集> 复测

## 失败用例
（按 P0→P3 排序，每条含 预期 / 实际 / 证据 / 分类 / 复现步骤）

## 通过用例
（仅列 ID + 标题 + 耗时）

## 阻塞项 (blockers)
（环境/账号/依赖问题登记）
```

---

## 7. 提示词输入字段（给 QA 工具的占位变量）

如 QA 工具需要 JSON 形式的输入：

```json
{
  "project_root": "g:\\mediaProjects\\fineSTEM",
  "round": 2,
  "scope_title": "多卡并列 + 批量提交 + TC-MQ-008 解析回归修复",
  "fe_port": 5184,
  "be_port": 3200,
  "health_url": "http://127.0.0.1:3200/health",
  "report_md_path": ".trae/documents/testing/reports/round2_report.md",
  "report_json_path": ".trae/documents/testing/logs/2026-06-30/round2_summary.json",
  "matrix_ref": ".trae/documents/testing/qa-handoff/qa-handoff_2026-06-30_multi-question-cards.md#3-测试矩阵必须按-id-顺序执行",
  "schema_ref": ".trae/documents/testing/qa-handoff/qa-handoff_2026-06-30_multi-question-cards.md#5-报告输出-schema机读给开发-agent-解析"
}
```

---

## 8. 完成判定

QA 工具完成本轮的标志：
1. `round2_summary.json` 落盘且通过 schema 自检
2. `round2_report.md` 包含「给开发 Agent 的话」段
3. 摘要回传开发 Agent，至少包含：
   - status (passed/failed)
   - total/passed/failed/skipped
   - blockers 列表
   - 前 3 个 P0/P1 用例 ID

开发 Agent 收到摘要后：解析 failed[] → 按 P0 优先排序 → 修复 → 触发 R3。
人工复测节点仅在 QA 全绿（status=passed 且至少覆盖 A/B/C 三类路径）后启动。

---

> 本文件为本轮 R2 专用交接说明。下一轮（R3 或后续大型修改且需要先派 QA 时）需重新生成新交接文件，命名规则：`qa-handoff_<YYYY-MM-DD>_<scope-slug>.md`，统一放置 `.trae/documents/testing/qa-handoff/`。
