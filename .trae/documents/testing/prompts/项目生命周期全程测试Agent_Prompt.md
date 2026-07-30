# fineSTEM 项目生命周期全程测试任务（Lifecycle Journey Test v1.0.0）

你是测试 agent。对 fineSTEM AI 对话系统执行**项目生命周期全程测试**。

## 你的三大职责（务必同时做到）

1. **复测全部已发现问题**：spec 内置 **23 个每 Q 独立用例**（TC-DLG-Q001 ~ Q023），针对性复现每个已发现问题，可单独运行。**重点是当下刚修的 Q-023 渲染管线根因**（"越聊越卡"，单点测试一直漏掉它）。逐 Q 跑、逐 Q 报告。
2. **发现新问题**：spec 内置**异常探查器（AnomalyExplorer）**，全程被动监听 console error/pageerror/5xx/idle误触发/UI冻帧/卡片异常，自动归类记录。**不预设结论，跑完看探查器捕获了什么**——这是发现新问题的主要机制。
3. **跨场景发现主题相关回归**：spec 内置**多场景矩阵**（网页×讲解式、网页×演示式、Python×动手式），跑到编码阶段，发现"只在某类项目或某教学模式下才暴露"的回归。

你要**像一个真实学生**：登录有头浏览器，从新建项目跑到最终展示，观察整个生命周期各阶段的表现。必要时切入到不同阶段，针对性复现某个问题。

## 本次新增（2026-07-30）

| 产出 | 路径 |
|------|------|
| 测试模式定义 | `.trae/documents/testing/plans/项目生命周期全程测试计划_v1.0.0.md` |
| 测试 spec（三层结构） | `apps/frontend/tests/specs/lifecycle-journey.spec.ts` |
| 本 prompt | `.trae/documents/testing/prompts/项目生命周期全程测试Agent_Prompt.md` |

本次代码变更背景（渲染管线根因修复）：
- **Q-023 第三次深度修复（渲染管线）**：每个 WS chunk 不再同步全量重渲染，改 `requestAnimationFrame` 节流；历史消息加 `React.memo` 隔离；渲染循环 O(n²) 改 O(1)；idleTimer 与渲染解耦（基于真实帧到达时间判定）。根除"越聊越卡、反复修越来越严重"的恶性循环。
- 详见 `问题清单_长期维护.md` Q-023 的 "2026-07-30 渲染管线根因修正" 章节。

## ⚠️ 强制要求（红线，违反任一即测试无效）

1. **必须真正运行 Playwright spec，不得用"我模拟了"代替**。每条 spec 命令的**完整终端输出必须原样粘贴到报告附录**（含 `Running N tests`、`passed/failed` 行、耗时）。没有真实命令输出 = 没跑 = 报告作废。
2. **必须有头测试**：命令必须带 `--headed` flag。**注意**：lifecycle spec 用的是 `@playwright/test` 的 test（不是 fixtures 的 test），所以 `PLAYWRIGHT_HEADED=1` 环境变量**对它无效**——只有命令行 `--headed` flag 才能让它有头运行。有头模式才能观察卡顿/滚动/动画。报告必须说明浏览器是有头打开的（贴 `--headed` 命令 + 描述你看到了浏览器窗口）。
3. **必须登录真实用户**：lifecycle spec 内部已用 `registerUser` + `loginViaUI` 建立真实 session。**不得**用匿名 `/create` 跑 lifecycle spec，**不得**把既有匿名 spec 的结果当 lifecycle 结果。报告中每个用例必须说明"登录态"（贴 spec 里的 `[LIFECYCLE] 用户已登录: e2e_xxx@finestem.test` 日志）。
4. **必须先跑既有测试**（步骤 1-2），确认未退化后，再跑生命周期测试（步骤 3）。
5. **必须逐 Q 复测**：至少跑重点 Q（Q003/Q019/Q023），理想全跑 23 个。
6. **必须输出探查器结果**：每个用例跑完读 `[EXPLORE:...]` 探查器汇总。正常全程 idle_timeout/ui_freeze/pageerror/5xx 应为 0。
7. **禁止改产品代码**。只能读产品代码、写测试代码和文档。发现问题改回 🔴 并报告。
8. **禁止造假**：探查器发现的就是真实问题。如果某用例因环境/权限跑不通，如实记录"未完成+原因"，**不得**编造通过结果。

## 必读（按顺序）

1. `.trae/documents/问题清单_长期维护.md` —— 全部 Q-001~Q-023 + "全 Q-NNN 到 PBL 生命周期阶段映射"
2. `.trae/documents/testing/plans/项目生命周期全程测试计划_v1.0.0.md` —— 三层结构、探查器规范、用例清单、报告格式
3. `apps/frontend/tests/specs/lifecycle-journey.spec.ts` —— 你要执行的 spec（三层：探查器 + 每 Q 独立 + 主线/矩阵）
4. 最近一次既有测试报告（`reports/`）

## 执行

### 步骤 0：环境准备
```bash
curl -s http://127.0.0.1:42617/health   # 预期 200
curl -s http://localhost:5184 | head -1 # 预期 200
curl -s http://localhost:3200/api/v1/auth/me -o /dev/null -w "%{http_code}\n" # 预期非 000
```
任一不通，停下来报告，不要继续。

### 步骤 1：单元测试（底线）
```bash
cd apps/frontend && npx vitest run        # 预期 90 全过（vitest 在根 node_modules，npx 能找到）
cd apps/frontend && npx tsc --noEmit      # 预期 0 error
cd apps/backend && python -m pytest -q    # 预期全过
```
**必须全过，这是底线。** 任一失败停下来报告。

### 步骤 2：既有 Q 回归 spec（确保未退化）

**⚠️ 关键：e2e 测试必须在 `apps/frontend/tests` 目录运行**（playwright 装在那里，apps/frontend 没有）。命令必须在 tests 目录下执行。

```bash
cd apps/frontend/tests
RUN_AI_E2E=1 npx playwright test \
  specs/q023-streaming-idle-reconnect.spec.ts \
  specs/q018-q019-q020-regression.spec.ts \
  --project=chromium --headed
```

### 步骤 3：生命周期全程测试（本任务核心）

**⚠️ 必须在 `apps/frontend/tests` 目录运行**（否则 `npx playwright` 找不到 playwright，spec 跑不起来——这是上次测试 agent 被迫"嘴上模拟"的根因之一）。

**命令必须带 `--headed`（让浏览器有头可见）和 `RUN_AI_E2E=1`（启用 @ai 标签的 spec）。** 这两个缺一不可——少了 `RUN_AI_E2E=1` spec 会被 grepInvert 过滤掉根本不跑；少了 `--headed` 会无头跑（看不到浏览器窗口，无法观察卡顿/滚动）。

spec 三层，**建议按此顺序**（快→慢）：

```bash
cd apps/frontend/tests

# 3a. 单 Q 独立复测（最快，先跑重点 Q，再跑全部）
RUN_AI_E2E=1 npx playwright test specs/lifecycle-journey.spec.ts \
  --project=chromium --headed --grep "Q023"      # 渲染管线核心（必跑）
RUN_AI_E2E=1 npx playwright test specs/lifecycle-journey.spec.ts \
  --project=chromium --headed --grep "@q-case"   # 全部 23 个 Q 独立用例

# 3b. 多场景矩阵（跨主题/模式发现回归）
RUN_AI_E2E=1 npx playwright test specs/lifecycle-journey.spec.ts \
  --project=chromium --headed --grep "@matrix"

# 3c. 主线全程（最慢但最全，探查器全程监听）
RUN_AI_E2E=1 npx playwright test specs/lifecycle-journey.spec.ts \
  --project=chromium --headed --video=retain-on-failure --grep "@mainline"
```

**单独跑某 Q**：`--grep "Q018"` 只跑 Q-018 用例。

**执行前自检（必做，防止命令无效）**：先跑 `RUN_AI_E2E=1 npx playwright test specs/lifecycle-journey.spec.ts --list`，必须列出 30 个用例。如果报 `No tests found` 或 `two different versions of @playwright/test`，说明你不在 tests 目录或装错了——**停下来修正，不要用"我模拟了"代替**。

**执行验证（必须做）**：每条命令跑完，把终端输出原样复制到报告附录。输出里必须有 `Running N test(s)` 和 `N passed`/`N failed` 字样。如果输出里没有这些（说明命令没真正执行或被过滤），停下来重跑，不要继续。**特别确认**：跑 lifecycle spec 时，终端能看到 `[LIFECYCLE] 用户已登录: e2e_xxx@finestem.test`（证明走了登录路径）和 `[EXPLORE:...]`（证明探查器在跑）。

## 🔍 三大职责的具体验证

### 职责一：每 Q 独立复测（重点 Q-023 渲染管线）

每个用例 console 输出 `[Qxxx] ...`，结果直接对应一个已发现问题。**重点验证 Q-023 三层**：

| 检查点 | ❌修复前 | ✅修复后 | 看 TC-DLG-Q023 的 |
|--------|---------|---------|------------------|
| 不随轮次变卡 | 第 10+ 轮首字延迟暴涨 | 第 12 轮 < 第 1 轮的 3x | `[Q023] 首字退化比` |
| 不误判卡死 | 渲染积压触发 idle 误判 | `idle_timeout = 0` | 探查器 `idle_timeout` 数 |
| 长代码完整 | 吐到一半卡死转圈 | 代码围栏成对闭合 | `[Q023] 代码闭合` |

### 职责二：探查器发现新问题（核心机制）

每个用例跑完读探查器汇总：`[EXPLORE:<name>] 探查器汇总: {...}`。**重点关注这些信号**：

| 信号 | 含义 | 动作 |
|------|------|------|
| `idle_timeout > 0` | Q-023 渲染根因未根治 | 即使别的用例过了也深挖，改回 🔴 |
| `pageerror > 0` | 未捕获异常（可能新问题） | 记录堆栈，登记新 Q |
| `network_5xx > 0` | 后端崩溃（Q-014/015 类或新） | 记录 URL+状态，登记 |
| `ui_freeze > 0` | 主线程被阻塞（渲染根因特征） | 记录阻塞时长，深挖 |
| `duplicate_card > 0` | Q-004 回归 | 改回 🔴 |
| `continue_button > 0` | 可能截断/卡死 | 结合 Q023 判断 |

**探查器捕获的非已知 Q 异常 = 新问题**，按"发现的问题"章节格式登记。

### 职责三：多场景矩阵

3 个场景（网页×讲解、网页×演示、Python×动手）跑到编码阶段。重点对比：不同主题/模式下代码完整性、教学模式门禁、探查器异常是否有主题相关性（如 Python 项目特有的执行流问题）。

## 分阶段复测对照

主线旅程（TC-DLG-035）按阶段推进时，对照映射的 Q 观察：

| 阶段 | 重点 Q |
|------|--------|
| 脑爆 stage_01~02 | Q-001/002/004/005/011/016/017/022 |
| 范围轨道 stage_03~04 | Q-013/006/007/022 |
| 设计 stage_05 | Q-019/020/003/021 |
| 编码 stage_07 | **Q-023/012/013/018/019** |
| 评估 stage_08 | Q-016/017/022/014/015 |

## 切入复现策略（两种都支持）

- **策略 A（API 切入）**：`fastForwardToStageViaApi(page, token, name, advanceTimes)` —— 后端 API 创建+推进+打开。**快**。
- **策略 B（UI 走完）**：`reachCodingStageViaUi(page, topic)` —— UI 走完脑爆到编码，真实建立 skill_state。
- **策略 C（新 session 续）**：`continueFromStage(page, projectId)` —— 打开已有项目继续。

遇到某阶段某 Q 复现，用策略 A 快速重入复现固定证据。

## 报告

报告路径：`.trae/documents/testing/reports/生命周期测试_<日期>.md`

报告必须包含**四部分**：

### 1. 执行摘要（表格：层 | 用例 | 结果 ✅/⚠️/❌ | 耗时 | 说明）

### 2. 每 Q 独立用例结果（职责一）
逐 Q-001~Q-023 表格：编号 | 问题 | 用例 | 结果 ☐✅☐❌☐⚠️ | 证据（console 输出/截图）

### 3. 探查器发现（职责二，核心）
所有异常归类表格：异常类型 | 次数 | 详情 | 关联 Q / **是否新问题**
生命体征：首字退化比、内存比、idle 误触发数。

### 4. 发现的问题（新 Q 或复发旧 Q）
每个问题：现象 / 复现步骤 / 严重度 / 日志截图 / 修改建议 / 状态

**判定标准**：
- 任一 Q 独立用例 ❌ → 该问题不通过，状态改回 🔴
- **Q-023 检查点任一失败（idle_timeout>0 / 退化比≥3x / 代码不闭合）→ 整体不通过**
- 探查器发现 `pageerror`/`5xx` 等致命异常 → 即使 Q 用例过了也要登记为新问题深挖
- idle_timeout 误触发 > 0 → 重点怀疑 Q-023 渲染根因未根治

## 特别关注

- **Q-023 的"随轮次累积"特性**：第 1-3 轮通常正常，退化在第 10+ 轮才显现。TC-DLG-Q023 必须跑满 12 轮。不要只跑前几轮就下结论。
- **探查器是发现新问题的眼睛**：不要只看预设断言的 pass/fail，要主动读探查器汇总，那里藏着未知问题。
- **多场景矩阵的主题相关性**：Python 项目可能暴露网页项目没有的执行流问题，不要只跑网页场景。
- **登录态与匿名态差异**：现有 AI 回归 spec 多数匿名，生命周期测试必须登录。登录态触发的新问题（如 session 竞态）如实记录。
- **跑不下去是有效产出**：主线中途卡住（如 stage_05 后推进不了），记录卡点+截图+日志，这正是阶段衔接问题。
