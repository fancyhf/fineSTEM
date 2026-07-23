# ZeroClaw 集成重构 — 专项测试计划 v1.0.0

**版本**: v1.0.0
**日期**: 2026-07-22
**被测对象**: ZeroClaw 集成重构（详见 `技术与架构/ZeroClaw集成重构_v1.0.0.md`）
**测试目标**: 验证本次重构的全部 15 项改动正确、无回归
**执行人**: 测试 agent（按 `测试工作指南_v1.0.0.md` 规范执行）

> **本计划针对"本次重构"这一个变更集**。用例编号采用 `TC-ZC-<层>-<序号>` 前缀（ZC=ZeroClaw重构），与常规用例区分。测试 agent 跑完产出报告后，开发 agent 据此诊断修复。

---

## 0. 本次重构改动清单（被测对象）

测试 agent 必须先读 `ZeroClaw集成重构_v1.0.0.md` 了解每项改动。摘要：

| # | 改动 | 文件 | 根治症状 |
|---|------|------|---------|
| A1 | config.toml 字符串闭合修复 | `H:/dev-env/zeroclaw/config/config.toml` | 整个 PBL 配置失效 |
| A2 | ZeroClaw 专用 skill 新建 | `.../workspace/skills/stem-pbl-guide/SKILL.md` | AI 无 PBL 规范 |
| A3 | workspace 文档改写（SOUL/IDENTITY/TOOLS） | `.../workspace/*.md` | AI 身份冲突 |
| B1 | stage_advancer 禁跨阶段跳 | `tools.py` | 阶段乱跳 |
| B2 | skill_state_writer 白名单 | `tools.py` | 绕门禁改阶段 |
| B3 | check_gate 双层校验 | `pbl_engine.py` | 门禁形同虚设 |
| B4 | Evidence type 枚举映射 | `tools.py` | pydantic 崩溃 |
| B5 | artifact_writer/achievement_card 门禁 | `tools.py` | 越权写工件 |
| B6 | stage_constants.py 统一常量 | `stage_constants.py`（新建） | 5 处重复定义 |
| C1 | sanitizeAssistantNarration 简化 | `Create.tsx` | 回答被吞 |
| C2 | ask_question 双路径消除 | `Create.tsx` | 卡片时灵时不灵 |
| C3 | finestem__ 前缀归一化 + MCP 双层 JSON 解析 | `useStreamingChat.ts` | **选项卡不显示（根因）** |
| D2 | Stage04TrackData 枚举扩展 | `schemas/projects.py` | 枚举不全 |
| T1 | pytest.ini 补 asyncio 配置 | `pytest.ini` | async 测试误判失败 |
| T2 | vitest 配置 + data-testid | `vitest.config.ts` + 组件 | 测试基础设施 |

---

## 1. 测试范围与策略

### 1.1 范围矩阵

| 改动 | 单元测试 | 集成 | E2E 离线 | E2E @ai | 配置验证 |
|---|:---:|:---:|:---:|:---:|:---:|
| A1 config 修复 | | | | | ✅ |
| A2 skill 装载 | | | | | ✅ |
| A3 workspace 文档 | | | | | ✅ |
| B1 stage_advancer | ✅ | | | | |
| B2 writer 白名单 | ✅ | | | | |
| B3 check_gate | ✅ | | | | |
| B4 Evidence 映射 | ✅ | | | | |
| B5 artifact/achievement 门禁 | ✅ | | | | |
| B6 stage_constants | ✅ | | | | |
| C1 清洗简化 | ✅（前端） | | ✅ | ✅ | |
| C2 双路径消除 | ✅（前端） | | | ✅ | |
| C3 前缀归一化 | ✅（前端） | ✅（MCP） | | ✅ | |
| D2 schema 对齐 | ✅ | | | | |
| T1 pytest 配置 | ✅（自身可跑即验证） | | | | |
| T2 vitest+testid | ✅（自身可跑即验证） | | ✅ | | |

### 1.2 策略

1. **先跑现有单元测试**（已写好，87 后端 + 43 前端），确认无回归
2. **配置验证**：跑 `zeroclaw status` / `skills audit` 确认 ZeroClaw 侧改动生效
3. **E2E @ai**：启动真实 ZeroClaw daemon，跑多轮 PBL 对话，验证端到端链路
4. **回归检查**：确认坏死测试被正确 skip（不中断收集）、历史可跑测试无新增失败

---

## 2. 测试用例清单

### 2.1 配置验证（TC-ZC-CFG，5 例）

| 编号 | 用例 | 命令 | 预期 | 对应改动 |
|------|------|------|------|---------|
| TC-ZC-CFG-001 | config.toml 解析无错误 | `zeroclaw config migrate` | 输出"配置已为当前架构版本"，退出码 0 | A1 |
| TC-ZC-CFG-002 | ZeroClaw 加载了 provider | `zeroclaw status` | 含 `ModelProvider: deepseek.default` | A1 |
| TC-ZC-CFG-003 | ZeroClaw 加载了 agent | `zeroclaw status` | 含 `Agents: assistant=Supervised` | A1 |
| TC-ZC-CFG-004 | skill 通过审计 | `zeroclaw skills audit <skill路径>` | `Skill audit passed` | A2 |
| TC-ZC-CFG-005 | workspace 文档是 PBL 导师身份 | 读 `SOUL.md` | 含"fineSTEM PBL 导师"，不含"你是 assistant，不是任何产品" | A3 |

### 2.2 后端单元测试（TC-ZC-BE，已有 77 例，回归验证）

| 编号 | 测试文件 | 用例数 | 验证点 | 对应改动 |
|------|---------|--------|--------|---------|
| TC-ZC-BE-001~027 | `test_stage_constants.py` | 27 | 门禁常量、can_advance_to、artifact_stage_gate、代码锁 | B6/B1/B5 |
| TC-ZC-BE-028~044 | `test_tools_gates.py` | 17 | writer 白名单、Evidence 映射、artifact/achievement/advancer 门禁 | B2/B4/B5/B1 |
| TC-ZC-BE-045~067 | `test_check_gate_structural.py` | 23 | 双层门禁（非空硬+结构软） | B3 |
| TC-ZC-BE-068~077 | `test_mcp_server.py` | 10 | 12 工具暴露、双层 JSON、真实帧 | C3 |
| TC-ZC-BE-078 | `pytest.ini` 自身可跑 | 1 | `pytest --collect-only` 无 error | T1 |

**回归断言**：这 77 例必须全 passed（开发 agent 已验证过，测试 agent 确认无回归）。

### 2.3 坏死测试 skip 验证（TC-ZC-SKIP，2 例）

| 编号 | 文件 | 预期 |
|------|------|------|
| TC-ZC-SKIP-001 | `test_pbl_dialogue_flow.py` | collected + skipped（不中断） |
| TC-ZC-SKIP-002 | `test_stream_truncation.py` | collected + skipped（不中断） |

**命令**：`pytest tests/test_pbl_dialogue_flow.py tests/test_stream_truncation.py -v`，应显示 `SKIPPED`。

### 2.4 前端单元测试（TC-ZC-FE，已有 43 例）

| 编号 | 测试文件 | 用例数 | 验证点 | 对应改动 |
|------|---------|--------|--------|---------|
| TC-ZC-FE-001~018 | `useStreamingChat.test.ts` | 18 | normalizeToolName（finestem__ 剥离）、parseMcpOutput（双层 JSON） | C3 |
| TC-ZC-FE-019~036 | `Create.test.ts` | 18 | sanitize 不误杀 cat/ls/import os、保留 DSML/UUID 清理 | C1 |
| TC-ZC-FE-037~043 |（间接覆盖 ask_question 单路径）| 归入 001~018 | toolCallToQuestion、双路径消除后不重复 | C2 |

### 2.5 前端构建验证（TC-ZC-BUILD，2 例）

| 编号 | 命令 | 预期 |
|------|------|------|
| TC-ZC-BUILD-001 | `cd apps/frontend && npx tsc --noEmit` | 源码零 error（测试文件的 jest 配置警告不算） |
| TC-ZC-BUILD-002 | `cd apps/frontend && npx vite build` | 构建成功，产出 dist/ |

### 2.6 E2E 离线（TC-ZC-E2E，2 例）

| 编号 | 用例 | 验证点 | 对应改动 |
|------|------|--------|---------|
| TC-ZC-E2E-001 | Create 页加载，`chat-input`/`send-button` 可见 | data-testid 暴露（T2） | T2 |
| TC-ZC-E2E-002 | 输入框接受文本 | 基础交互 | T2 |

**命令**：`cd apps/frontend/tests && npx playwright test zeroclaw-integration --project=chromium`（需前端 dev server）

### 2.7 E2E @ai 真实对话（TC-ZC-AI，5 例，核心验证）

> **这组是最重要的**——验证整个 PBL 链路端到端打通。需要 ZeroClaw daemon + 前端。

| 编号 | 用例 | 操作 | 预期 | 对应改动 |
|------|------|------|------|---------|
| TC-ZC-AI-001 | 单轮：ask_question 卡片渲染 | 发"我想做一个项目" | 60s 内出现 `[data-testid=question-card]`，标题是问句 | **C3 前缀归一化（根因修复）** |
| TC-ZC-AI-002 | 多轮：stage_00 三轮提问 | 001 后点选项→重复 3 轮 | 每轮都出新卡片，标题分别是年级/时间/想法 | A1+C3+B1 |
| TC-ZC-AI-003 | 创建项目 | 三轮答完后 | AI 调用 `project_creator`，前端收到 `onProjectCreated` 事件 | A1+C3 |
| TC-ZC-AI-004 | AI 回复完整不截断 | 发"解释 print 函数" | AI 回复 >20 字，含代码则代码完整 | C1 |
| TC-ZC-AI-005 | 思考链展示（如模型输出） | 观察 AI 消息 | 如有 thinking 帧，可折叠"思考过程"区域可见 | C1（thinking 回调） |

**命令**：
```bash
# 方式一：Playwright（需前端 dev server）
RUN_AI_E2E=1 cd apps/frontend/tests && npx playwright test zeroclaw-integration --project=chromium --grep "@ai"

# 方式二：Python 脚本（更稳定，不依赖前端渲染）
cd apps/backend && python scripts/ws_multi_turn_test.py
```

**方式二更可靠**——它直接连 ZeroClaw WebSocket，不经过前端渲染层，能纯粹验证后端+ZeroClaw 链路。如果方式二通过但方式一失败，说明问题在前端渲染（C3 字段映射），而非后端。

### 2.8 回归：历史可跑测试（TC-ZC-REG）

确认本次改动没有破坏改动前就能跑的测试。

| 编号 | 范围 | 预期 |
|------|------|------|
| TC-ZC-REG-001 | `test_api.py` | 通过（或与改动前一致） |
| TC-ZC-REG-002 | `test_contains.py` | 通过 |
| TC-ZC-REG-003 | `test_pbl_engine.py`（如存在）| 通过或与改动前一致 |

**判定标准**：对比改动前的通过情况。本次重构**不应引入新的失败**（已有的、与本次无关的失败记录但不算回归）。

---

## 3. 测试数据与取证要求

### 3.1 必须留存的数据

| 数据 | 存放 | 用途 |
|------|------|------|
| pytest 完整输出 | `logs/<date>/backend-unit.log` | 诊断失败用例 |
| pytest JUnit XML | `logs/<date>/junit-backend.xml` | 结构化比对 |
| vitest JSON | `logs/<date>/vitest-results.json` | 结构化比对 |
| Playwright 截图 | `test-results/`（自动）| UI 问题取证 |
| ws_multi_turn dump | `logs/<date>/ws-multiturn.json` | AI 对话帧数据 |
| `zeroclaw status` 输出 | `logs/<date>/zeroclaw-status.txt` | 配置生效证据 |

### 3.2 失败用例的强制取证

任何 `TC-ZC-*` 用例失败时，测试 agent 必须收集：
1. 完整错误输出（不是截断的）
2. 复现命令（能让开发 agent 一键重跑）
3. 如果是 E2E/AI：失败时的截图 + WebSocket 帧数据
4. 测试 agent 的初步判断（是前端问题/后端问题/配置问题/环境问题）

---

## 4. 通过/失败判定标准

### 4.1 必须全通过（阻塞级）

- TC-ZC-CFG-001~005（配置没生效则整个系统不可用）
- TC-ZC-BE-001~077（门禁是安全底线）
- TC-ZC-BUILD-001~002（构建不过无法部署）
- TC-ZC-SKIP-001~002（坏死测试中断收集会遮蔽其他问题）

### 4.2 允许部分受环境影响（非阻塞）

- TC-ZC-AI-001~005：依赖 ZeroClaw daemon + DeepSeek API 可用 + 网络。如果 daemon 没启动或 API 限流，记录为"环境受限未跑"，不算失败。但**如果 daemon 正常却失败，是阻塞**。
- TC-ZC-E2E-001~002：依赖前端 dev server。同上。

### 4.3 回归判定

- TC-ZC-REG-* 出现**改动前没有的新失败** = 回归，阻塞
- 改动前就失败的 = 记录但不阻塞

---

## 5. 测试 agent 产出物

测试 agent 跑完后必须产出：

1. **测试报告**：`.trae/documents/testing/reports/ZeroClaw重构测试报告_<date>.md`（按指南 8.2 模板）
2. **问题清单**：报告内"三、问题清单"章节，每个问题含编号/用例/现象/复现步骤/截图路径/修改建议/严重度
3. **日志数据**：`logs/<date>/` 下完整数据

**报告交付给开发 agent 后，开发 agent 按 `诊断修复SOP`（见下文）处理。**
