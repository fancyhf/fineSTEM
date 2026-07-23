# 测试报告 R2 — 多卡并列 + 批量提交 + 解析回归修复

- 时间：2026-06-30 13:48:00.000 → 2026-06-30 14:08:30.000（UTC）
- 环境：FE=5184 BE=3200 backend_health=ok
- 总览：4/14 通过；5 失败；5 跳过
- 整体 status：**failed**

> 注：R1 的 P0 回归（TC-MQ-008 `_parse_question_block` 解析正文编号列表失败）已在本轮修复并验证通过（U-01/02/03/04 全绿）。本轮新发现 1 个 P1 功能问题（TC-MQ-005 刷新恢复失败）和 3 个环境/脚本问题。

---

## 给开发 Agent 的话

- **P1 必修**：TC-MQ-005 — 刷新页面后 pendingQuestions 恢复 0 张卡。建议关注：
  - [Create.tsx: restore 逻辑 L1392-1399](file:///g:/mediaProjects/fineSTEM/apps/frontend/src/pages/Create.tsx#L1392) — 仅对最后一条 assistant 消息调用 `parseQuestionFromText`
  - [useStreamingChat.ts: WS onmessage L157-173](file:///g:/mediaProjects/fineSTEM/apps/frontend/src/hooks/useStreamingChat.ts#L157) — `question` 事件数据未持久化到 chat_history
  - 关键场景：AI 通过 WS `question` 事件派发结构化问题数据时，`final` 事件文本（如"好的，收到！接下来想确认你的时间安排。"）不含 question 格式，`parseQuestionFromText` 返回 null
  - 复测最小子集：`npx playwright test specs/create-question-options-restore.spec.ts`（已验证含格式文本时 restore 正常）
- **P1 待补**：TC-MQ-003/006 — 多卡批量提交和 step 同源覆盖渲染。需要 AI 在单轮中派发 ≥2 个 question 事件，当前 E2E 无法稳定触发。建议：1) 构造特定 prompt；2) 或 mock WS
- **P2 环境**：S-01 — smoke 脚本 `run_create_smoke.py` L198 `print(result.stdout)` 在 Windows GBK 终端下 `UnicodeEncodeError`。后端 58 passed 正常，前端 E2E 输出未落盘。建议设 `PYTHONIOENCODING=utf-8` 或在 print 前 `errors='replace'`
- **P3 环境**：U-05 — 后端全量 pytest 169 errors（DB schema 未初始化）+ 5 failed（async 配置缺失），与本轮改动无关
- **下一轮入口建议**：先修 TC-MQ-005（前端 chat_history 持久化 question 数据），再构造多卡 E2E 场景验证 TC-MQ-001/002/003/007

---

## 失败用例

### TC-MQ-005 刷新页面 / 切换历史 → pendingQuestions 至少恢复 1 张
- **预期**：pendingQuestions 至少恢复 1 张（理想全部恢复）
- **实际**：刷新后恢复 0 张卡
- **分类 / 严重度 / 复现性**：functional-bug / P1 / always
- **复现步骤**：
  1. 登录 → 创建项目 → /create 打开项目
  2. 发送消息，等待 AI 通过 WS `question` 事件派发问题
  3. 确认 QuestionCard 渲染正常
  4. 刷新页面（`page.reload()`）
  5. 检查：0 张卡恢复
- **证据**：
  - 截图：`e2e_multicard/screenshots/tc-mq-005-after-refresh.png`（0 cards）
  - WS final content: `"好的，收到！接下来想确认你的时间安排。"` → `parseQuestionFromText` → `null`
  - 对照：`create-question-options-restore.spec.ts` (2 passed) 验证当 chat_history 文本含 JSON/编号列表格式时 restore 正常
- **根因分析（QA 侧观察，不写修复方案）**：AI 通过 WS `question` 事件派发结构化问题数据（id/title/options），但 `final` 事件仅包含文本内容。chat_history 仅保存文本，`question` 事件数据未持久化。restore 时 `parseQuestionFromText` 解析文本，若文本不含 question 格式则返回 null。
- **建议关注**：`Create.tsx` L1392-1399 restore 逻辑 + `useStreamingChat.ts` WS `question` 事件处理

---

### TC-MQ-001 /create 多维度提问 → 渲染 ≥2 张 QuestionCard + 批量提交工具条
- **预期**：messagesEnd 上方渲染 ≥2 张 QuestionCard + 1 个批量提交工具条
- **实际**：仅渲染 1 张 QuestionCard（标题："你现在是哪个年级？"，step=1/3）；无批量提交工具条
- **分类 / 严重度 / 复现性**：spec-ambiguity / P2 / sometimes
- **复现步骤**：
  1. 登录 → 创建项目 → /create
  2. 发送 `"帮我设计一个互动故事网页，我是零基础新手，想做一个适合小学生玩的故事冒险游戏，大概有6小时时间"`
  3. 等待 AI 响应（~16s）
  4. 检查 QuestionCard 数量：仅 1 张
- **证据**：
  - 截图：`tc-mq-001-after-response.png`（1 card only）
  - WS question events: 1（id: `q-1782828069968`）
  - Card button: "下一步"（step=1, total_steps=3）
- **说明**：AI 走了 `stage_00_bootstrap` 引导路径（step 逐步提问），未触发 `_extract_plaintext_question_blocks` 多块识别。多卡渲染的前端代码已就位（`pendingQuestions.length >= 2` 时渲染多卡+工具条），但需 AI 在单轮中派发多个 question 事件。

---

### TC-MQ-004 单卡场景 → 走原直接发送路径，按钮文案『确定』
- **预期**：单卡路径，按钮文案"确定"，点击直接发送；无批量工具条
- **实际**：单卡直发路径功能正常（点击按钮 → 答案发送 → AI 响应下一轮），但按钮文案为"下一步"（因 AI 派发了 step=1/total_steps=3 的多步问题）。提交后出现 step=2 新卡，非卡片消失。
- **分类 / 严重度 / 复现性**：spec-ambiguity / P2 / sometimes
- **证据**：
  - 截图：`tc-mq-004-before-submit.png` + `tc-mq-004-after-submit.png`（step=2 card appeared）
  - WS 第2轮 question: `{ id: 'q-bootstrap-time-1782828078', title: '你打算花多长时间完成这个项目？', step: 2, total_steps: 3 }`
- **说明**：`QuestionCard` 组件按设计在 `data.step < data.totalSteps` 时显示"下一步"。要测"确定"按钮需触发无 step 属性的单步问题场景。单卡直发机制（`handleQuestionAnswer` → `list.length <= 1` → `clearQuestionFlow` → `handleSend`）功能本身正常。

---

### U-05 后端全量 pytest
- **预期**：全量绿
- **实际**：5 failed, 10 passed, 169 errors in 47.35s
- **分类 / 严重度 / 复现性**：env-issue / P3 / always
- **证据**：
  - 5 failed：均为 `async def functions are not natively supported`（pytest-asyncio 配置）
  - 169 errors：均为 `sqlalchemy.exc.OperationalError: no such table: users`（后端运行中 + 测试 DB schema 未初始化）
  - `TestQuestionFallbackBehavior` 隔离运行（U-04）9 passed in 0.20s
- **说明**：与本轮改动无关。5 个 async 失败为预存配置问题；169 个 errors 为环境问题（后端运行锁库 + conftest 未建表）。

---

### S-01 scripts/run_create_smoke.py 主链路 smoke
- **预期**：`overall_passed: true`；summary JSON 落盘
- **实际**：后端 58 passed in 14.10s（通过）；前端 E2E 因脚本 `UnicodeEncodeError` 崩溃，summary JSON 未落盘
- **分类 / 严重度 / 复现性**：env-issue / P2 / always
- **证据**：
  ```
  后端 /create 关键回归: 58 passed in 14.10s
  前端 /create 关键 E2E: UnicodeEncodeError: 'gbk' codec can't encode character '\u203a'
  ```
- **说明**：`run_create_smoke.py` L198 `print(result.stdout)` 在 Windows GBK 终端下无法编码 Playwright 输出中的 Unicode 字符。已单独运行 `create-question-options-restore.spec.ts` (2 passed) 和 `create-history-restore.spec.ts` (1 passed) 验证前端 E2E 基线绿。

---

## 跳过用例（按硬约束或场景缺失停止派发）

| 用例 ID | 路径 | 类型 | 严重度 | 标题 | 跳过原因 |
|---|---|---|---|---|---|
| TC-MQ-002 | A | e2e | P2 | 暂存其中 1 张卡 → answered 灰态 | 需要多卡场景（当前为单卡） |
| TC-MQ-003 | A | e2e | P1 | 暂存全部卡后点提交全部回答 → [批量回答] | 需要多卡场景（当前为单卡） |
| TC-MQ-006 | B | e2e | P1 | step 同源切换 → 不入多卡 list | 需 AI 单轮内连续派发 step=1→2（当前跨轮次） |
| TC-MQ-007 | C | e2e | P2 | 多卡场景关闭/取消单张卡 | 需要多卡场景（当前为单卡） |
| S-02 | C | smoke | P2 | WS 多 question 事件 id 互不相同 | 本轮仅 1 个 question 事件/轮，不足 2 个 |

---

## 通过用例

| 用例 ID | 标题 | 耗时 |
|---|---|---|
| U-01 | `_extract_plaintext_question_blocks` 解析正文编号列表（R1 P0 回归闭环） | 140ms |
| U-02 | `_extract_plaintext_question_blocks` 过滤状态列表 | 240ms |
| U-03 | `_extract_plaintext_question_blocks` 多维度块识别 | 130ms |
| U-04 | `TestQuestionFallbackBehavior` 全类回归（9 passed） | 200ms |

### 补充验证（已有 Playwright spec）

| Spec | 结果 | 耗时 | 关联 |
|---|---|---|---|
| `create-question-options-restore.spec.ts` | 2 passed | 14.4s | TC-MQ-005 补充：含格式文本时 restore 正常 |
| `create-history-restore.spec.ts` | 1 passed | 13.0s | TC-MQ-006 补充：历史项目恢复正常 |

---

## 阻塞项 (blockers)

### ENV-1（P3，不阻塞）
- **现象**：前端 5184 仅监听 IPv6 `(::1)`，IPv4 `0.0.0.0` 未监听
- **影响**：Playwright `baseURL=http://localhost:5184` 正常解析到 IPv6，不影响 E2E

### ENV-2（P3，不阻塞）
- **现象**：后端全量 pytest 169 errors（DB schema 未初始化）+ 5 failed（async 配置缺失）
- **影响**：全量 pytest 无法通过，但 `TestQuestionFallbackBehavior` 隔离运行全绿。与本轮改动无关

### ENV-3（P2，部分阻塞）
- **现象**：smoke 脚本 `run_create_smoke.py` L198 `print()` 在 Windows GBK 终端下 `UnicodeEncodeError`
- **影响**：smoke 前端 E2E 输出未落盘，summary JSON 未生成。后端 58 passed 正常。已单独运行关键 spec 补充验证

---

## R1 P0 回归闭环确认

R1 抓到的 TC-MQ-008（`_parse_question_block` 解析正文编号列表失败）已在本轮修复并验证：
- **U-01 通过**：`test_parse_question_block_supports_plaintext_numbered_options` 迁移到 `_extract_plaintext_question_blocks` 断言后通过
- **U-02 通过**：状态列表过滤新用例通过
- **U-03 通过**：多维度块识别新用例通过
- **U-04 通过**：`TestQuestionFallbackBehavior` 全类 9 passed

R1 TC-MQ-009（`_extract_plaintext_question_blocks` 缺少独立单测）已在本轮通过 U-02/U-03 补充覆盖。

---

## E2E 浏览器测试详情

### 测试环境
- 浏览器：Chrome 149.0.7827.197（headless）
- 测试脚本：`.trae/documents/testing/e2e_multicard/run_e2e_multicard.mjs`
- 截图目录：`.trae/documents/testing/e2e_multicard/screenshots/`
- WS 拦截：`page.on('websocket')` 捕获 `question`/`final`/`error` 事件

### WS 消息记录
| 序号 | 事件 | ID/标题 | step | 时间戳 |
|---|---|---|---|---|
| 1 | question | `q-1782828069968` / 你现在是哪个年级？ | 1/3 | 14:01:10.036 |
| 2 | final | 我来帮你开启项目之旅！… | - | 14:01:14.981 |
| 3 | question | `q-bootstrap-time-1782828078` / 你打算花多长时间完成这个项目？ | 2/3 | 14:01:18.913 |
| 4 | final | 好的，收到！接下来想确认你的时间安排。 | - | 14:01:18.913 |

注：2 个 question 事件分属不同 WS 轮次（第1轮 → 用户提交 → 第2轮），非单轮多卡场景。

---

## 产物

- JSON 摘要（机读）：[logs/2026-06-30/round2_summary.json](file:///g:/mediaProjects/fineSTEM/.trae/documents/testing/logs/2026-06-30/round2_summary.json)
- 本报告（人读）：[reports/round2_report.md](file:///g:/mediaProjects/fineSTEM/.trae/documents/testing/reports/round2_report.md)
- E2E 测试脚本：[run_e2e_multicard.mjs](file:///g:/mediaProjects/fineSTEM/.trae/documents/testing/e2e_multicard/run_e2e_multicard.mjs)
- E2E 结果 JSON：[e2e_results.json](file:///g:/mediaProjects/fineSTEM/.trae/documents/testing/e2e_multicard/e2e_results.json)
- E2E 截图：`e2e_multicard/screenshots/` 目录下 5 张 PNG
- smoke 后端日志：`create-smoke-backend-tests_20260630_140407.log`（58 passed）
