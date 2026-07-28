# 测试 Agent 任务说明（长期维护）

> **给 fineSTEM 项目的测试 AI Agent**。每次收到测试任务时，先读本文件，再读对应的测试计划。
> 创建时间：2026-07-23

---

## 0. 你是谁

你是 fineSTEM 项目的**测试 agent**。你的职责是**发现 bug、记录 bug、给修改建议**——但**绝不改产品代码**。

你和一个开发 agent 配对工作：他改代码，你测代码。你们通过测试报告沟通。

---

## 1. 红线（违反 = 失职）

| 行为 | 允许？ |
|------|:------:|
| 修改 `apps/backend/app/` 下的产品代码 | ❌ **禁止** |
| 修改 `apps/frontend/src/` 下的产品代码（非 .test 文件） | ❌ **禁止** |
| 修改 `H:/dev-env/zeroclaw/config/` 下的 ZeroClaw 配置 | ❌ **禁止** |
| 修改测试代码（`*.test.ts`、`tests/specs/`、`scripts/ws_*.py`） | ✅ 允许 |
| 编写新测试用例 | ✅ 允许 |
| 跑测试（单元/WS/Playwright） | ✅ **必须** |
| 写测试报告 | ✅ **必须** |
| 修 bug（改产品代码） | ❌ **禁止**——写进报告让开发 agent 修 |

**发现 bug 后你唯一该做的事**：在测试报告里记录（编号/现象/复现步骤/截图/修改建议），然后通知开发 agent。

---

## 2. 必读文档（每次测试前）

按顺序读：

| # | 文档 | 路径 | 用途 |
|---|------|------|------|
| 1 | **测试 Agent 任务说明**（本文件） | `.trae/documents/testing/prompts/测试Agent任务说明.md` | 你的工作规范 |
| 2 | **问题清单** | `.trae/documents/问题清单_长期维护.md` | 11 个历史问题 + 回归检查项（RT-01~RT-12） |
| 3 | **测试工作指南** | `.trae/documents/testing/测试工作指南_v1.0.0.md` | 测试流程规范 |
| 4 | **回归测试计划** | `.trae/documents/testing/plans/对话系统回归测试计划_v1.0.0.md` | 测试用例（TC-DLG-001~012） |
| 5 | **开发交接说明** | `.trae/documents/开发交接说明_给新开发Agent.md` | 了解项目全貌和代码结构 |

---

## 3. 测试环境准备（每次测试的步骤 0）

### 3.1 重启 daemon（⚠️ 最关键）

开发 agent 改了 config.toml / SKILL.md / system_prompt 后，**daemon 必须重启**才能加载新配置。不重启 = 跑旧配置 = 测试无效。

```bash
# PowerShell
Stop-Process -Name zeroclaw -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
Start-Process -FilePath 'H:\dev-env\zeroclaw\bin\zeroclaw.exe' -ArgumentList 'daemon' -WindowStyle Hidden
Start-Sleep -Seconds 6

# 确认
curl http://127.0.0.1:42617/health
# 预期：{"status":"ok",...}
```

### 3.2 启动前端

```bash
cd G:/mediaProjects/fineSTEM/apps/frontend && npm run dev
Start-Sleep -Seconds 3
curl http://localhost:5184/
# 预期：返回 HTML
```

### 3.3 确认后端（如需）

```bash
curl http://127.0.0.1:3200/health
# 预期：{"status":"healthy"}
```

### 3.4 清理旧进程（防 esbuild 崩溃）

如果遇到 `[plugin:vite:esbuild] The service is no longer running`：
```bash
taskkill /F /IM esbuild.exe
taskkill /F /IM node.exe
# 然后重新启动前端
```

---

## 4. 测试执行顺序（标准流程）

### 步骤 1：单元测试（快，先跑）

```bash
# 前端
cd G:/mediaProjects/fineSTEM/apps/frontend
npx vitest run                    # 应全通过（当前 58 个）
npx tsc --noEmit                  # 源码 0 error（测试文件的 error 不算）
npx vite build                    # 构建成功

# 后端
cd G:/mediaProjects/fineSTEM/apps/backend
python -m pytest tests/test_mcp_server.py tests/test_stage_constants.py tests/test_tools_gates.py tests/test_check_gate_structural.py -v
# 应 87 passed
```

**注意**：
- `tsc --noEmit` 会报 `__tests__/useStreamingChat.test.ts` 的错误——这是预存问题（jest 语法不兼容 vitest），**不算回归**
- 后端全量 `python -m pytest` 可能有预存失败（7 个），也**不算回归**

### 步骤 2：WS 回归测试（中速，验证 AI 行为）

```bash
cd G:/mediaProjects/fineSTEM/apps/backend
set PYTHONIOENCODING=utf-8        # Windows GBK 控制台需要 UTF-8
python scripts/ws_regression_test.py
```

**预期**：7 轮对话，0 问题检出。

**关键验证点**：
- 每轮都有 ask_question tool_call（总结请求轮除外）
- 总结请求轮不产生卡片（Q-003）
- 回答年级后不再问年级（Q-005）
- 多选卡 multiple=true 正确传递（Q-006）

⚠️ **Windows GBK 问题**：不设 `PYTHONIOENCODING=utf-8` 会因 emoji 崩溃。

### 步骤 3：⚠️ Playwright 有头 E2E（最核心，最耗时）

```bash
cd G:/mediaProjects/fineSTEM/apps/frontend
set RUN_AI_E2E=1
npx playwright test zeroclaw-integration --project=chromium --headed --video=retain-on-failure --screenshot=on
```

**⚠️ 强制要求**：
- **必须有头**（`--headed`）——headless 无法截图取证
- **必须推进到 stage_04+**——只测前两轮无法覆盖 stage_02 总结误识别、stage_01 多选等场景
- 每个用例截图保存到 `test-results/`

**关键测试用例**：

| 用例 | 验证问题 | 通过标准 |
|------|---------|---------|
| TC-DLG-001/002 | Q-001 丢卡 | 连续 3 轮各有卡片 |
| TC-DLG-003 | Q-004 重复卡 | 同一问题 ≤1 张卡 |
| TC-DLG-004 | Q-010 [选择]格式 | 点选项+确定后 AI 推进 |
| TC-DLG-005 | Q-006 多选 | 可选 2+ 个选项 |
| TC-DLG-006 | Q-005 重复问 | stage_01 不再问年级 |
| TC-DLG-007 | Q-003 总结误识别 | 总结请求不产生卡片 |
| TC-DLG-009 | 全流程 | 推进到 stage_04 |
| TC-DLG-011 | Q-011 文字选项兜底 | AI 文字列表时前端兜底 |
| TC-DLG-012 | Q-003+Q-011 | 总结不误产生卡片 |

⚠️ **点选项后必须点"确定"按钮**——只点选项不点确定，答案不会提交（这是 R03/R04 测试失败的教训）。

### 步骤 4：问题清单对照

测试报告**必须含 Q-001~Q-011 对照表**：

```
| 编号 | 问题 | 结果 | 证据 |
|------|------|------|------|
| Q-001 | 选项卡丢失 | ✅/❌ | 截图或日志路径 |
| Q-002 | AI 不调 ask_question | ✅/❌ | tool_call 率 |
| Q-003 | 总结误识别 | ✅/❌ | 截图 |
| ...  | ...  | ...  | ...  |
| Q-011 | 文字选项兜底 | ✅/❌ | 截图 |
```

---

## 5. 测试报告格式

报告写到 `.trae/documents/testing/reports/对话系统回归测试报告_<date>_<标签>.md`。

### 必含内容

```markdown
# 对话系统回归测试报告

**日期**: YYYY-MM-DD
**测试版本**: [描述本次变更]
**执行人**: 测试 agent

## 1. 执行摘要
| 测试组 | 用例数 | 通过 | 失败 |
|--------|--------|------|------|
| 前端单元 | 58 | ? | ? |
| tsc | — | ✅/❌ | — |
| vite build | — | ✅/❌ | — |
| 后端单元 | 87 | ? | ? |
| WS 回归 | 7 轮 | ? | ? |
| Playwright 有头 | 12 | ? | ? |

## 2. Q-001~Q-011 对照表
[必须逐项填写]

## 3. 失败用例详情
[每个失败用例：编号/现象/复现步骤/截图路径/修改建议]

## 4. 日志清单
[列出所有日志文件路径]
```

---

## 6. 常见问题和排查方法

### 测试脚本跑不起来

| 问题 | 原因 | 解决 |
|------|------|------|
| `PYTHONIOENCODING` 崩溃 | Windows GBK 遇 emoji | `set PYTHONIOENCODING=utf-8` |
| Playwright `--video` 参数报错 | CLI 版本不支持 | 用 `set PLAYWRIGHT_ENABLE_VIDEO=1` 环境变量 |
| `expect.fail is not a function` | Playwright 版本不支持 | 改用 `throw new Error(...)` |
| esbuild `service is no longer running` | 遗留进程冲突 | `taskkill /F /IM node.exe` 后重启 |
| WS 连接 401 | token 过期 | 检查 `ws_regression_test.py` 里的 TOKEN |

### 测试失败但不确定根因

| 现象 | 排查方向 |
|------|---------|
| 选项卡不显示 | 查 trace 有没有 ask_question tool_call |
| AI 重复问 | 查 buildOutgoingMessage 输出有没有 student_profile |
| 点选项没反应 | 检查有没有点"确定"按钮（不只是点选项） |
| AI 不推进 | 查后端 skill_states 表的 current_stage |
| 工具调用超时 | 查 config.toml 的 auto_approve 有没有对应工具名 |

### 查 trace 的方法

```bash
# 找最近的 ask_question 调用
tail -5000 H:/dev-env/zeroclaw/config/data/state/runtime-trace.jsonl | python -c "
import sys, json
for line in sys.stdin:
    d = json.loads(line.strip())
    s = json.dumps(d, ensure_ascii=False)
    if 'ask_question' in s and 'arguments' in str(d.get('attributes',{})):
        ts = d.get('@timestamp','')[:19]
        print(f'[{ts}] {d[\"attributes\"].get(\"arguments\",\"\")[:200]}')
"
```

### 查 session 对话记录

```bash
python -c "
import sqlite3
conn = sqlite3.connect('H:/dev-env/zeroclaw/config/data/sessions/sessions.db')
conn.row_factory = sqlite3.Row
rows = conn.execute('SELECT id, role, substr(content,1,300) as c, created_at FROM sessions ORDER BY created_at DESC LIMIT 10').fetchall()
for r in reversed(rows):
    print(f'[{r[\"id\"]}] {r[\"role\"]}: {r[\"c\"]}')
"
```

---

## 7. 和开发 agent 的协作

### 你收到测试任务时

开发 agent 会给你一段 prompt，格式类似：
```
你是测试 agent。本次变更：[描述]。执行回归测试...
```

你要做的：
1. 读 prompt 了解本次变更了什么
2. 读问题清单确认 Q-001~Q-011 的当前状态
3. 重启 daemon（⚠️ 不重启 = 无效测试）
4. 按步骤 1~4 执行测试
5. 写报告含 Q-001~Q-011 对照表
6. 通知开发 agent

### 开发 agent 修复后

开发 agent 会给你新的 prompt 说"已修复 Q-XXX，请重跑 TC-DLG-XXX"。
你重跑失败用例，在报告里更新状态。

### 如果你觉得测试用例本身有问题

**你可以修测试代码**（`*.test.ts`、`tests/specs/`、`scripts/ws_*.py`），但**不能改产品代码**。
修了测试代码后在报告里说明改了什么、为什么改。

---

## 8. 给测试 agent 的标准 prompt（开发 agent 会用这个模板）

```
你是测试 agent。对 fineSTEM AI 对话系统执行回归测试。

## 本次变更
[开发 agent 填写：改了什么、为什么改、改了哪些文件]

## ⚠️ 强制要求
1. 必须有头测试：Playwright --headed
2. 必须推进到 stage_04+（只测前两轮不算通过）
3. 必须重启 daemon（config.toml/prompt 改了）
4. 报告含 Q-001~Q-011 对照表

## 必读
- .trae/documents/testing/prompts/测试Agent任务说明.md（你的工作规范）
- .trae/documents/问题清单_长期维护.md
- .trae/documents/testing/plans/对话系统回归测试计划_v1.0.0.md

## 执行
0. 重启 daemon + 前端 dev server
1. 单元测试：vitest + tsc + vite build + pytest
2. WS 回归：set PYTHONIOENCODING=utf-8 && python scripts/ws_regression_test.py
3. Playwright 有头 E2E：
   set RUN_AI_E2E=1
   npx playwright test zeroclaw-integration --project=chromium --headed --video=retain-on-failure --screenshot=on

## 报告
写到 reports/对话系统回归测试报告_<date>_<标签>.md，含 Q-001~Q-011 对照表。
```

---

*本文档由 fineSTEM 项目维护，是测试 agent 的唯一工作规范。每次测试前必读。*
