# 测试报告 R1 — 多卡并列 + 批量提交回归

- 时间：2026-06-30 13:00:12.118 → 2026-06-30 13:08:55.000（UTC）
- 环境：FE=5184 BE=3200 backend_health=ok
- 总览：0/10 通过；1 失败；9 跳过
- 整体 status：**failed**

> 注：按 `qa-agent-prompt.md` v1.1.0 §2 硬约束「失败用例发现后立即停止新用例派发，先把已有结果落盘报告」，TC-MQ-008（P0 后端单测回归）连续 3 次复跑稳定失败后，QA Agent 立即停止派发后续 E2E / smoke 用例，避免在底层解析回归未修前消耗真实 LLM 配额并产生级联噪音。

---

## 给开发 Agent 的话

- **P0 必修**：TC-MQ-008 — `_parse_question_block` 对正文编号列表的解析回归。建议关注：
  - [orchestrator.py: _parse_question_block](file:///g:/mediaProjects/fineSTEM/apps/backend/app/services/orchestrator.py#L2132)
  - [orchestrator.py: _extract_plaintext_question_options](file:///g:/mediaProjects/fineSTEM/apps/backend/app/services/orchestrator.py#L1947)
  - [orchestrator.py: _extract_plaintext_question_blocks](file:///g:/mediaProjects/fineSTEM/apps/backend/app/services/orchestrator.py#L1955)
  - 关键日志关键字：`option_pattern`、`is_status_list_block`、`selectable_blocks`
  - 复测最小子集：`pytest -q tests/test_projects.py::TestQuestionFallbackBehavior`
- **P1 待补**：TC-MQ-009 — `_extract_plaintext_question_blocks` 缺少独立单测（仅有 `_parse_question_block` 间接覆盖）；登记为 spec-ambiguity，由开发 Agent 决定是否补测试代码。QA Agent 不创建测试代码。
- **P1 暂缓**：TC-MQ-001/003/004/005/006/010 — 多卡渲染、批量提交、单卡兼容、历史恢复、step 同源覆盖、smoke 真实链路。**等 P0 修复后下一轮重跑**。
- **下一轮入口建议**：先跑 `pytest -q tests/test_projects.py::TestQuestionFallbackBehavior`（5 分钟），全绿后再触发 R2 完整矩阵。

---

## 失败用例

### TC-MQ-008 _parse_question_block 解析正文编号列表（多块识别向后兼容入口）
- **预期**：parsed_question 非 None；`title='下面这三个方向里，你更想先做哪一个？'`；options 长度=3；`options[0].label='古诗词生成器'`，`description='输入关键词，自动生成一首短诗'`
- **实际**：`_parse_question_block` 返回 `None`，断言 `assert parsed_question is not None` 失败
- **分类 / 严重度 / 复现性**：regression / P0 / always（连续 3 次复跑全部失败）
- **复现步骤**：
  1. `cd g:\mediaProjects\fineSTEM\apps\backend`
  2. `python -m pytest -q tests/test_projects.py::TestQuestionFallbackBehavior::test_parse_question_block_supports_plaintext_numbered_options`
  3. 观察输出：返回 `1 failed`，断言点 `tests/test_projects.py:628`
- **证据**：
  ```
  tests/test_projects.py:628: AssertionError
  assert None is not None
  >       assert parsed_question is not None
  ```
  ```
  RUN 1: 1 failed in 0.30s
  RUN 2: 1 failed in 0.33s
  RUN 3: 1 failed in 0.31s
  ```
- **同 TestClass 上下文**：其余 6 条断言全部通过（`test_parse_question_block_returns_none_without_real_options` / `supports_ask_user_question_json` / `filters_generic_prompt_buttons` / `reads_step_and_total_steps_from_xml_attributes` 等），仅本条 plaintext_numbered_options 失败。
- **建议关注（不写修复方案）**：[_parse_question_block](file:///g:/mediaProjects/fineSTEM/apps/backend/app/services/orchestrator.py#L2132) 与 [_extract_plaintext_question_blocks](file:///g:/mediaProjects/fineSTEM/apps/backend/app/services/orchestrator.py#L1955) 的衔接；输入文本为 pytest 三引号字符串原貌（每行带 12 空格缩进），`option_pattern` / `is_status_list_block` 是否仍能命中需复核。

---

## 跳过用例（按硬约束停止派发）

| 用例 ID | 路径 | 类型 | 严重度 | 标题 |
|---|---|---|---|---|
| TC-MQ-009 | C | unit | P2 | `_extract_plaintext_question_blocks` 不把状态列表（含 `✅ docs/`）误识别为选项（**spec-ambiguity**：未找到现成 pytest 用例） |
| TC-MQ-001 | A | e2e | P1 | /create 多维度提问 → 渲染 ≥2 张 QuestionCard + 批量提交工具条 |
| TC-MQ-002 | A | e2e | P2 | 暂存其中 1 张卡 → answered 灰态 + 提交按钮 disabled |
| TC-MQ-003 | A | e2e | P1 | 暂存全部卡后点提交全部回答 → 单条 `[批量回答]` 消息 |
| TC-MQ-004 | A | e2e | P1 | 单卡场景 → 走原直接发送路径，按钮文案『确定』 |
| TC-MQ-005 | B | e2e | P1 | 刷新页面 / 切换历史 → pendingQuestions 至少恢复 1 张 |
| TC-MQ-006 | B | e2e | P1 | step 同源切换（step=1→step=2） → 不入多卡 list，覆盖渲染同卡 |
| TC-MQ-007 | C | e2e | P2 | 多卡场景关闭/取消单张卡 → 仅该卡消失 |
| TC-MQ-010 | A | smoke | P1 | `scripts/run_create_smoke.py` 真实链路 smoke |

---

## 通过用例

无（失败用例发现后停止派发，未产生 passed 计数）。

---

## 阻塞项 (blockers)

### ENV-1（P3，仅声明，不阻塞）
- **现象**：`netstat -ano` 显示 `[::1]:5184 LISTENING`；`http://127.0.0.1:5184/` 连接被拒，而 `http://localhost:5184/` 与 `http://[::1]:5184/` 均返回 200
- **影响**：Playwright 默认 `baseURL=http://localhost:5184` 可正常解析到 IPv6，理论不影响 E2E；任何强制 IPv4 的脚本（如 `curl 127.0.0.1:5184`）会失败
- **结论**：仅作环境声明，**不阻塞本轮测试**

---

## 回归项 (regressions)

| 用例 ID | 起始版本 | 证据 |
|---|---|---|
| TC-MQ-008 | 本轮（多卡并列 + 批量提交改造） | `test_parse_question_block_supports_plaintext_numbered_options` 在历史构建中应为通过基线（用例文件 v1.0.0 起即存在），现连续 3 次复跑全部失败 |

---

## 产物

- JSON 摘要（机读）：[round1_summary.json](file:///g:/mediaProjects/fineSTEM/.trae/documents/testing/round1_summary.json)
- 本报告（人读）：[round1_report.md](file:///g:/mediaProjects/fineSTEM/.trae/documents/testing/round1_report.md)
