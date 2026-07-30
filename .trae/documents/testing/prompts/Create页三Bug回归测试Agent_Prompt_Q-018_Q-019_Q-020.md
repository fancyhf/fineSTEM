# Create 页面三个顽固 Bug 回归测试任务（Q-018 / Q-019 / Q-020 新增）

你是测试 agent。对 fineSTEM AI 对话系统执行回归测试，重点验证本次修复的三个长期顽固 Bug。

## 本次变更（2026-07-28）

修复三个用户反复反馈、长期存在的顽固 Bug，根因已定位到代码行级：

- **Q-018**：「修复错误」按钮失效，`onclick` 文本渲染到屏幕
  - 根因：`Create.tsx` `buildExecutionResultHtml` 按钮写内联 `onclick="..."`，`JSON.stringify(error)` 的双引号提前闭合 HTML 属性，后续 JS 当文本渲染
  - 修复：改用「按钮骨架 + `<script>` 内 `btn.onclick` 赋值」，错误信息双重 stringify 传入
- **Q-019**：生成代码后编辑器空白、无代码文件
  - 根因：前端 `useStreamingChat.ts` 无 `code_generated` 事件分支（后端权威事件被整体忽略）+ 后端 `ProjectCodeWriterTool` 返回缺 `code/files`
  - 修复：前端新增 `code_generated` 分支（主）+ 后端 tool data 补 `code/files`（双保险）
- **Q-020**：AI 让选风格/主题但不给选项
  - 根因：前后端 `QUESTION_TITLE_PATTERN` 不含"风格/主题/样式/色调/配色"等设计选择词
  - 修复：前后端同步追加关键词；`LISTING_INTENT_PATTERN` 优先级更高保证 Q-003 不退化

## ⚠️ 强制要求（红线）

1. **必须有头测试**：Playwright 用 `--headed`（截图/录屏留证据）
2. **必须推进到 stage_05+（生成代码阶段）**：只测前几轮不算 Q-019 通过
3. **必须重启 daemon**：不重启则跑的是旧配置，测试无效
4. **必须对照问题清单**：报告含 Q-018/Q-019/Q-020 三项对照表（✅/❌ + 证据）
5. **禁止改产品代码**：`apps/` 非测试文件、`H:/dev-env/zeroclaw/config/` 只读；发现 bug 只记录 + 给建议，让开发 agent 修
6. **必须覆盖 Q-003 回归**：Q-020 新增"风格/主题"关键词，需确认番茄钟功能介绍等仍被拦截不退化

## 必读（按顺序）

1. `.trae/documents/问题清单_长期维护.md`（Q-018、Q-019、Q-020 是本次新增项；RT-18、RT-19、RT-20 是回归项）
2. `.trae/documents/testing/reports/Create页三bug修复回归测试_Q-018_Q-019_Q-020_2026-07-28.md`（开发 agent 已做的代码层+单测层验证）
3. `.trae/documents/testing/plans/对话系统回归测试计划_v1.0.0.md`

## 执行

### 步骤 0：重启 daemon + 启动前后端

```bash
# 停掉旧 daemon（不重启 = 无效测试，跑的是旧配置）
Stop-Process -Name zeroclaw -Force -ErrorAction SilentlyContinue
# 或 taskkill /F /IM zeroclaw.exe
H:\dev-env\zeroclaw\bin\zeroclaw.exe daemon
# 等 6 秒
curl http://localhost:3200/api/health   # 确认后端起来了

# 前端
cd apps/frontend && npm run dev
# 等 3 秒，确认 http://localhost:5184 可访问
```

### 步骤 1：单元测试（必须全过，这是底线）

```bash
cd apps/frontend
npx tsc --noEmit                 # 预期：0 error
npx vitest run                   # 预期：90 passed（含 Q-020 新增的 questionParser 4 个 it）

cd ../backend
python -m pytest tests/test_question_verifier.py -v   # 预期：35 passed（含 Q-020 新增 14 用例）
```

**重点验证 Q-020 单测**：
- `questionParser.test.ts` 的 `describe('Q-020 风格/主题类文字选择')`：4 个 it
  - TC-DATA-011：9 种风格/主题句式 `isLikelyQuestionTitle` 全 true
  - TC-DATA-012：`你想要什么风格？` + 选项 → 提取出卡片
  - 回归：含"风格"+列举词的功能介绍句仍拒绝
  - 回归：番茄钟功能介绍仍拦截
- `test_question_verifier.py`：`test_accept_style_theme_questions`（9 参数化）+ `test_accept_style_question_full_case` + `test_reject_style_in_feature_intro`（3 参数化）

### 步骤 2：WS 真实对话回归

```bash
cd apps/backend
set PYTHONIOENCODING=utf-8 && python scripts/ws_regression_test.py
# 预期 7 轮 0 问题
```

### 步骤 3：Playwright 有头 E2E（最核心，三个 bug 都要实测）

```bash
cd apps/frontend
set RUN_AI_E2E=1
npx playwright test --project=chromium --headed --video=retain-on-failure --screenshot=on
```

---

## 🔍 三个 Bug 的具体测试用例（逐项验证）

### 【Q-018】「修复错误」按钮可点击、无文本泄漏（RT-18）

**前提**：需要一个会报错的代码。最简单方式——

1. 进入 Create 页，让 AI 生成一段会引用未定义变量的代码（或手动在编辑器粘贴 `print(x)`，x 未定义）
2. 点「运行」按钮（▶ 运行），打开运行结果弹窗
3. **检查点 A（文本泄漏）**：弹窗里**不应**出现 `onclick="(function(){window.parent.postMessage...` 这样的原始 JS 文本
   - ❌ 修复前：按钮旁/下方有一长串 onclick JS 文本
   - ✅ 修复后：只有干净的「让 AI 修复此错误」按钮，无任何 JS 文本泄漏
4. **检查点 B（按钮可点）**：点「让 AI 修复此错误」按钮
   - ✅ 修复后：按钮变灰显示「已发送给AI...」+ 聊天框自动发出一条消息"我的代码运行出错了，错误信息是：... 请帮我修复这个错误"
   - ❌ 修复前：点击无反应
5. **检查点 C（含双引号的错误）**：用会报含双引号错误的代码（如 `import nonexistent` 产生的 `ModuleNotFoundError: No module named 'nonexistent'`，或直接 `x = "y"; print(z)`）
   - ✅ 修复后：即使错误信息含双引号/换行，按钮仍正常工作（这正是原先触发 bug 的场景）

**证据要求**：弹窗截图（显示无文本泄漏）+ 点击后聊天框消息截图。

---

### 【Q-019】生成代码后编辑器有代码、文件区有文件（RT-19）

**这是最关键的实测项**——必须真实走到 AI 调 `project_code_writer`。

1. 走完整 PBL 流程推进到 stage_05（设计蓝图）或 stage_07（执行开发）
   - 注意：stage_07 必须先选教学模式（Q-012/Q-013 门禁），选完才允许写代码
2. 让 AI 生成代码（发"请直接给出完整可运行代码"或类似指令）
3. **检查点 A（编辑器有代码）**：AI 调 `project_code_writer` 后，**右侧编辑器立即显示代码**（非空白）
   - ❌ 修复前：AI 文字说"已生成代码"，但编辑器空白
   - ✅ 修复后：编辑器有完整代码
4. **检查点 B（文件区有真实文件）**：左侧「代码文件」区显示**真实文件名**（如 `index.html` / `main.py`），**不是硬编码的 `main.py`**
   - ❌ 修复前：文件区空，或显示与代码语言不符的硬编码 `main.py`
   - ✅ 修复后：文件名与代码语言匹配（HTML→index.html，Python→main.py）
5. **检查点 C（刷新不丢）**：刷新页面重新打开该项目 → 代码仍在编辑器里
6. **诊断日志**：打开浏览器控制台，应能看到 `[handleSend][onEnd]` 提取代码日志 + `onCodeGenerated` 回调触发

**关键技术验证**（可选，用控制台 Network/WS 抓帧）：
- WS 抓帧看后端是否推送了 `event: code_generated`（带 `data.code` 和 `data.files`）
- 确认前端收到该事件并写入了编辑器

**证据要求**：编辑器有代码的截图 + 文件区有真实文件名的截图 + 刷新后代码仍在的截图。

---

### 【Q-020】风格/主题文字选择渲染卡片（RT-20）

**两种方式验证**：

**方式 1：真实对话（依赖 DeepSeek 不调 ask_question 的概率，可能不稳定）**
1. 推进到 stage_05（设计蓝图阶段）
2. 引导 AI 问风格/主题（发"我想选个风格，给我选项"）
3. 若 AI 用**文字**列出风格选项（如"- 极简即用型 - 分析洞察型"）但**不**调用 ask_question 工具
4. **检查点**：前端应兜底渲染出**可点击的选项卡**
   - ❌ 修复前：文字选项无法点击（没渲染卡片）
   - ✅ 修复后：渲染成可点击卡片，点选项 + 确定 → 流程推进

**方式 2：后端 verify-question 接口直接验证（更稳定，推荐）**
```bash
# 直接调后端二次确认接口，验证风格/主题标题被判为真问题
curl -X POST http://localhost:3200/api/chat/verify-question ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"你想要什么风格？\",\"options\":[{\"label\":\"极简即用型\"},{\"label\":\"分析洞察型\"}]}"
# 预期：{"is_real_question": true, "reason": "通过"}

curl -X POST http://localhost:3200/api/chat/verify-question ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"你想用什么风格？\",\"options\":[{\"label\":\"极简\"},{\"label\":\"分析\"}]}"
# 预期：is_real_question=true（修复前为 false）
```

**检查点 C（Q-003 不退化，必测）**：
- 发"总结一下进度"或让 AI 介绍项目功能 → **不应**产生选项卡（番茄钟功能介绍仍被拦截）
- `verify-question` 对 `"一个番茄钟专注计时器，包含"` + 功能选项 → 应返回 `is_real_question=false`

**证据要求**：verify-question 接口返回截图（4 个 case：风格/主题 true × 2 + 功能介绍 false × 2）+ 真实对话兜底渲染截图（若触发）。

---

## 报告

写到 `.trae/documents/testing/reports/Create页三bug回归测试报告_Q-018_Q-019_Q-020_<日期>.md`，**必须含以下对照表**：

| 编号 | 问题 | 验证方法 | 结果 | 证据 |
|------|------|---------|------|------|
| Q-018 | 修复错误按钮 + 文本泄漏 | RT-18（运行报错代码→点按钮） | ✅/❌ | 截图链接 |
| Q-019 | 生成代码后编辑器空白 | RT-19（走 stage_05/07→生成代码） | ✅/❌ | 截图链接 |
| Q-020 | 风格/主题选择不渲染 | RT-20（verify 接口 + 真实对话） | ✅/❌ | 接口返回 + 截图 |
| Q-003 回归 | 功能介绍误识别 | 发"总结进度" + 番茄钟 | ✅/❌ | 截图 |

**判定标准**：
- 任一 ❌ → 整体不通过，状态改回 🔴，在报告里写清复现步骤 + 控制台/WS 日志
- Q-003 回归 ❌ → Q-020 修复判定为"引入退化"，即使 Q-020 主功能通过也需回炉

特别关注：
- Q-019 是最高频顽固 bug，必须真实走到代码生成阶段验证，**不能用 mock/跳过**
- Q-018 的"含双引号错误"场景是原先触发 bug 的关键，必须测到
- Q-020 若真实对话中 DeepSeek 总是调 ask_question（不退化为文字），用 verify-question 接口验证即可（方式 2）
