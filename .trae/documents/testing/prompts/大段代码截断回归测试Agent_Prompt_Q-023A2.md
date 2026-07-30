# 大段代码截断回归测试任务（Q-023-A 截断深度修复）

你是测试 agent。验证 AI 生成大段代码时不再被截断，以及续接能完整补全。

## 本次变更（2026-07-29）

用户反馈"AI 写/改代码反复被截断，点继续生成还是被截断"。深度排查发现 3 个叠加根因，已全部修复：

| # | 根因 | 修复 |
|---|------|------|
| 1 | DeepSeek max_tokens 未配置（默认 4096 太小，大段代码必然触发 finish_reason=length 截断） | `config.toml` 加 `max_tokens = 16384` |
| 2 | 续接上文只取末尾 2000 字（AI 看不到完整代码结构，续接输出重复/答非所问） | `slice(-2000)` → `slice(-8000)`（自动续接 + 手动继续） |
| 3 | 手动续接后不显示继续按钮（`!isContinueMessage` 守卫压制，用户体感"无法再续"） | 去掉守卫 + 加 `manualContinueCountRef`（上限 4 次防死循环） |

附加：`AUTO_CONTINUE_CONFIG.maxAttempts` 从 2 提到 3。

## ⚠️ 强制要求

1. **必须重启 daemon**（config.toml 改了 max_tokens，不重启不生效）+ 重启前端
2. **必须有头测试**（`--headed`，截图留证）
3. **必须真实生成大段代码**（完整 HTML+CSS+JS 项目），不能 mock
4. **禁止改产品代码**；发现 bug 只记录 + 给建议
5. 如需登录，用测试用户（问你授权）

## 必读
- `.trae/documents/问题清单_长期维护.md`（Q-023 + RT-23）
- `.trae/documents/testing/plans/对话系统回归测试计划_v1.0.0.md`（TC-DLG-033/034）

## 执行

### 步骤 0：重启 daemon + 前端（必须！config 改了）
```bash
Stop-Process -Name zeroclaw -Force -ErrorAction SilentlyContinue
H:\dev-env\zeroclaw\bin\zeroclaw.exe daemon
# 等 6 秒，curl health 确认
cd apps/frontend && npm run dev   # 等 3 秒
```
**验证 max_tokens 生效**：`zeroclaw config get providers.models.deepseek.default` 应显示 `max_tokens = 16384`（或类似）。如果 daemon 不认这个 key，记录下来。

### 步骤 1：单测 + 类型（底线）
```bash
cd apps/frontend && npx tsc --noEmit   # 0 error
cd apps/frontend && npx vitest run     # 90 passed
```

---

### 步骤 2：核心 —— 大段代码完整输出（TC-DLG-033）

**这是最关键的测试**，验证 max_tokens=16384 是否解决了截断。

1. 用测试用户登录，进入 Create 页
2. 新建项目，走 PBL 流程推进到 stage_07（编码阶段，选讲解式 lecture）
3. 发指令让 AI 生成**完整的大段代码**：
   > "请完整实现这个项目的所有代码，包括完整的 HTML 结构、所有 CSS 样式、所有 JavaScript 交互逻辑，不要省略任何部分"
4. **观察 AI 输出**：
   - ✅ 代码完整输出到 `</html>` 闭合标签（或代码块 ``` 正确闭合）
   - ❌ 如果在 CSS/JS 中段截断（如之前的 `align-self` 处）→ 截断未修复，记录截断点
5. **如果被截断**（max_tokens 仍不够）：
   - 检查是否**自动续接**（控制台 `检测到截断，自动续接` 日志），最多 3 次
   - 自动续接后代码是否补全到闭合
6. **截图**：最终完整代码 + 控制台日志

### 步骤 3：多次续接按钮不消失（TC-DLG-034）

1. 承接步骤 2，如果代码仍被截断
2. 点"继续生成"
3. **检查**：续接后如果内容仍不完整，"继续生成"按钮**应仍显示**（修复前会被 `!isContinueMessage` 压制消失）
4. 可连续点 2-4 次，每次 AI 从断点接着写
5. **达 4 次后**：按钮应隐藏（防死循环），控制台有 `已达手动续接上限` 日志
6. **发新对话**（如"你好"）：计数重置，按钮恢复正常

### 步骤 4：续接从断点接着写（TC-DLG-032 回归）

1. 人为制造截断：发"请只输出代码的前半部分（到词库定义为止）"
2. 点"继续生成"
3. **检查**：AI 从断点接着写（非回到开头重讲），续接内容与前文格式连贯

---

## 报告

写到 `.trae/documents/testing/reports/大段代码截断回归测试_Q-023A2_<日期>.md`，必须含：

| 编号 | 问题 | 结果 | 证据 |
|------|------|------|------|
| TC-DLG-033 | 大段代码完整输出不截断 | ✅/❌ | 完整代码截图 + 是否截断点 |
| TC-DLG-034 | 多次续接按钮不消失 | ✅/❌ | 截图 + 续接次数 |
| TC-DLG-032 | 续接从断点接着写 | ✅/❌ | 截图 |
| config | max_tokens=16384 已生效 | ✅/❌ | `zeroclaw config get` 输出 |

**判定标准**：
- TC-DLG-033 ❌（大段代码仍截断）→ 核心未修复，状态改🔴。需记录：截断点在哪？max_tokens 是否生效？自动续接是否触发？
- TC-DLG-034 ❌（按钮消失）→ 根因3未修复

**如果 max_tokens 配置 daemon 不认**（`zeroclaw config get` 报错或忽略）：记录下来，这需要换其他方式下发 max_tokens（如 daemon 启动参数或别的配置 key），在报告里说明。
