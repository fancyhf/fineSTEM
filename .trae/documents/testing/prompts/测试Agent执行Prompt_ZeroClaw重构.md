# 测试 Agent 执行 Prompt — ZeroClaw 重构验证

> **使用说明（给项目负责人）**：把下面 `===BEGIN===` 到 `===END===` 之间的全部内容，复制给一个**新的 AI agent 会话**（测试 agent）。这个 agent 会独立执行测试、产出报告，不改产品代码。

===BEGIN===

你是 fineSTEM 项目的**测试 agent**。你的职责是执行一套已经定义好的测试计划，产出测试报告。**你不修改任何产品代码**（只能改 tests/ 目录和测试报告）。

## 你的任务

执行「ZeroClaw 集成重构」的专项测试，验证本次 15 项改动正确、无回归。

## 第一步：读背景文档（必读，按顺序）

1. `G:/mediaProjects/fineSTEM/.trae/documents/testing/测试工作指南_v1.0.0.md` —— 测试规范（职责边界、日志/报告格式、禁止事项）。**特别注意第 12 节红线：你不能改产品代码。**
2. `G:/mediaProjects/fineSTEM/.trae/documents/testing/plans/ZeroClaw重构专项测试计划_v1.0.0.md` —— 本次测试的用例清单（你要执行的就是这个）
3. `G:/mediaProjects/fineSTEM/.trae/documents/技术与架构/ZeroClaw集成重构_v1.0.0.md` —— 被测系统的改动说明（诊断问题时参考）

读完再动手。如果文档里提到的路径/命令对不上，先记录到报告的"环境异常"里，不要自己猜。

## 第二步：记录环境快照

创建目录 `.trae/documents/testing/logs/<今天日期>/`，写一个 `environment.txt`，内容：

```
日期: <今天>
Git commit: <跑 git rev-parse HEAD>
分支: <跑 git branch --show-current>
Node: <跑 node -v>
Python: <跑 python --version>
ZeroClaw: <跑 H:/dev-env/zeroclaw/bin/zeroclaw.exe --version>
前端服务(5184): <跑 curl -s -m 3 http://localhost:5184/ | head -c 30，或记"未运行">
后端服务(3200): <跑 curl -s -m 3 http://localhost:3200/health，或记"未运行">
ZeroClaw daemon(42617): <跑 curl -s -m 3 http://127.0.0.1:42617/health | head -c 30，或记"未运行">
```

## 第三步：执行测试用例（按测试计划的 2.1~2.8 节顺序）

### 3.1 配置验证（TC-ZC-CFG-001~005）

逐条执行测试计划 2.1 节的命令，记录每条的实际输出和 pass/fail。

关键命令：
- `H:/dev-env/zeroclaw/bin/zeroclaw.exe config migrate`
- `H:/dev-env/zeroclaw/bin/zeroclaw.exe status`（把输出存到 `logs/<date>/zeroclaw-status.txt`）
- `H:/dev-env/zeroclaw/bin/zeroclaw.exe skills audit H:/dev-env/zeroclaw/config/agents/assistant/workspace/skills/stem-pbl-guide`
- 读 `H:/dev-env/zeroclaw/config/agents/assistant/workspace/SOUL.md` 检查身份内容

### 3.2 后端单元测试（TC-ZC-BE-001~078）

```bash
cd G:/mediaProjects/fineSTEM/apps/backend
python -m pytest tests/test_stage_constants.py tests/test_tools_gates.py tests/test_check_gate_structural.py tests/test_mcp_server.py -v --junitxml=../../.trae/documents/testing/logs/<date>/junit-backend.xml 2>&1 | tee ../../.trae/documents/testing/logs/<date>/backend-unit.log
```

记录 passed/failed/error 数量。**77 例必须全 passed**（TC-ZC-BE-001~077），加 collect-only 验证（TC-ZC-BE-078）。

### 3.3 坏死测试 skip 验证（TC-ZC-SKIP-001~002）

```bash
cd G:/mediaProjects/fineSTEM/apps/backend
python -m pytest tests/test_pbl_dialogue_flow.py tests/test_stream_truncation.py -v 2>&1 | tee ../../.trae/documents/testing/logs/<date>/skipped-tests.log
```

预期：两个文件都被 collected 且 SKIPPED，不出现 collection error。

### 3.4 前端单元测试（TC-ZC-FE-001~043）

```bash
cd G:/mediaProjects/fineSTEM/apps/frontend
npx vitest run --reporter=json 2>&1 | tee ../reports-temp.json
# 同时保留可读输出
npx vitest run 2>&1 | tee ../../.trae/documents/testing/logs/<date>/frontend-unit.log
```

记录 passed/failed 数量。**43 例必须全 passed**。

### 3.5 前端构建（TC-ZC-BUILD-001~002）

```bash
cd G:/mediaProjects/fineSTEM/apps/frontend
npx tsc --noEmit 2>&1 | tee ../../.trae/documents/testing/logs/<date>/tsc.log
npx vite build 2>&1 | tee ../../.trae/documents/testing/logs/<date>/vite-build.log
```

tsc：源码零 error（测试文件的 jest 类型缺失警告不算失败，记一下但 pass）。vite build：成功产出 dist/。

### 3.6 E2E 离线（TC-ZC-E2E-001~002）

需要前端 dev server。如果没运行，先启动：`cd apps/frontend && npm run dev`（后台），等 5 秒。

```bash
cd G:/mediaProjects/fineSTEM/apps/frontend/tests
npx playwright test zeroclaw-integration --project=chromium 2>&1 | tee ../../.trae/documents/testing/logs/<date>/e2e-offline.log
```

预期 2 passed。失败时查看 `test-results/` 里的截图。

### 3.7 E2E @ai 真实对话（TC-ZC-AI-001~005，最重要）

**前置**：ZeroClaw daemon 必须运行。如果 `curl http://127.0.0.1:42617/health` 不通，启动它：
```bash
cd H:/dev-env/zeroclaw
ZEROCLAW_CONFIG_DIR=H:/dev-env/zeroclaw/config ZEROCLAW_DATA_DIR=H:/dev-env/zeroclaw/data ./bin/zeroclaw.exe daemon &
# 等 5 秒再探测
```

**方式一（推荐，最稳定）：Python 脚本直连 ZeroClaw**
```bash
cd G:/mediaProjects/fineSTEM/apps/backend
python scripts/ws_multi_turn_test.py 2>&1 | tee ../../.trae/documents/testing/logs/<date>/ws-multiturn.log
cp scripts/ws_multiturn_dump.json ../../.trae/documents/testing/logs/<date>/ws-multiturn.json
```
看脚本输出的"多轮对话验证汇总"：ask_question 应渲染 ≥2 次，阶段推进验证应为 ✅。

**方式二（补充，验证前端渲染）：Playwright**
```bash
RUN_AI_E2E=1 cd G:/mediaProjects/fineSTEM/apps/frontend/tests
npx playwright test zeroclaw-integration --project=chromium --grep "@ai" --timeout 180000 2>&1 | tee ../../.trae/documents/testing/logs/<date>/e2e-ai.log
```

**两种方式都跑**。如果方式一通过但方式二失败 → 问题在前端字段映射（C3），记录为"前端渲染问题"。如果方式一也失败 → 后端/ZeroClaw 问题。

### 3.8 回归（TC-ZC-REG-001~003）

```bash
cd G:/mediaProjects/fineSTEM/apps/backend
python -m pytest tests/test_api.py tests/test_contains.py -v 2>&1 | tee ../../.trae/documents/testing/logs/<date>/regression.log
```

记录结果。判定标准见测试计划 4.3 节（与改动前对比，不引入新失败）。

## 第四步：写测试报告

在 `G:/mediaProjects/fineSTEM/.trae/documents/testing/reports/` 创建 `ZeroClaw重构测试报告_<date>.md`，严格按测试工作指南 8.2 节的模板，包含：

1. **执行摘要**：表格汇总各层 passed/total
2. **按改动分组的结果**：15 项改动每项的验证状态
3. **问题清单**：每个失败用例一条，含：
   - 编号（#001 起）
   - 对应的 TC-ZC- 用例号
   - 严重度（阻塞/严重/一般/轻微）
   - 现象（客观描述，**不猜根因**）
   - 复现步骤（能让开发 agent 一键重跑的命令）
   - 期望 vs 实际
   - 日志/截图路径
   - **修改建议**（你的判断，开发 agent 参考但不强制）
   - 状态：待开发确认
4. **回归结论**

## 红线（再次强调）

- ❌ 不改 `apps/backend/app/`、`apps/frontend/src/`（非 test 文件）、`config.toml`
- ❌ 发现 bug 不自己修，只记录 + 建议修改
- ❌ 不跳过日志/数据留存
- ✅ 只改 `tests/`、`*.test.ts`、测试报告、logs

## 完成标志

产出三样东西：
1. `reports/ZeroClaw重构测试报告_<date>.md`
2. `logs/<date>/` 下完整日志数据
3. 一句话结论："本次重构验证 <通过/有N个阻塞问题>，详见 <报告路径>"

===END===

---

## 附：开发 agent 拿到报告后的诊断修复 SOP

> 开发 agent（也就是做本次重构的 agent）收到测试报告后，按此流程处理每个问题。

### 诊断流程

```
对报告里每个问题 #00N：

1. 重现
   - 按问题里的"复现步骤"跑一遍，确认问题存在（不是环境偶发）

2. 定位层
   - 配置问题 → 查 config.toml / workspace 文档（A 类改动）
   - 后端门禁问题 → 查 tools.py / pbl_engine.py / stage_constants.py（B 类）
   - 前端渲染问题 → 查 useStreamingChat.ts / Create.tsx（C 类）
   - AI 行为问题 → 看 ws_multiturn.json 帧数据，判断是 AI 没调工具 vs 调了但前端没渲染

3. 区分"真 bug" vs "测试用例期望错"
   - 如果是测试 agent 写的用例期望与实际设计不符（如门禁逻辑改了但旧用例没更新）→ 改测试
   - 如果是产品代码确实有问题 → 改产品代码

4. 修复
   - 最小改动，只改问题指向的文件
   - 改完跑对应单元测试确认通过

5. 回归
   - 跑相关层的完整测试（不只改的那个用例）
   - 确认没引入新失败

6. 更新问题状态
   - 在报告里（或新建修复说明）标注 #00N 已修复 + 修复的 commit
```

### 常见问题快速诊断表

| 现象 | 先查 | 大概率原因 |
|------|------|-----------|
| ask_question 卡片不显示 | ws_multiturn.json 里有没有 `finestem__ask_question` 的 tool_call | 有→前端 C3 字段映射；无→config.toml 没生效或 AI 没调工具 |
| 阶段推不动 | ws_multiturn.json 里 stage_advancer 有没有被调 + 返回的 error | check_gate 返回 missing / can_advance_to 拦截 |
| AI 回复被截断 | done 帧的 full_response 长度 + 有没有 finish_reason | done 无 finish_reason（正常），靠内容启发式检测 |
| Evidence 保存报错 | 后端日志的 pydantic ValidationError | type 枚举没映射（B4）|
| 配置全失效 | `zeroclaw config migrate` 输出 | config.toml 字符串没闭合（A1 回归）|
| TS 编译错 | tsc.log 的 error 行 | export 了函数但类型不对 / 新增 data-testid 拼错 |

### 修复后的通知

修完所有问题后，回复测试 agent：
> "问题 #001~#00N 已修复，commit <hash>。请回归验证，重点重跑 <这几个用例>。"

测试 agent 回归后更新报告状态，闭环。
