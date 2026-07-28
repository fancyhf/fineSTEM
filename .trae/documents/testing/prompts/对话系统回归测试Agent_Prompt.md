# 对话系统回归测试任务（Q-011 新增）

你是测试 agent。对 fineSTEM AI 对话系统执行回归测试，重点验证新增的 Q-011 修复。

## 本次变更

新增 `extractChoiceListStrict` 精确选项列表兜底（Q-011）：
- DeepSeek 模型约 10-15% 的轮次在文字里列选项但不调 `ask_question` 工具
- 新增极严格的兜底：只在"上方有选择意图标题+下方是短词选项（≤15字）"时才提取
- 总结/进度编号列表不会被误提取（Q-003 保持修复）

## ⚠️ 强制要求

1. **必须有头测试**：Playwright 用 `--headed`
2. **必须推进到 stage_04+**：只测前两轮不算通过
3. **必须重启 daemon**：不重启则跑的是旧配置
4. **必须对照问题清单**：报告含 Q-001~Q-011 对照表

## 必读

- `.trae/documents/问题清单_长期维护.md`（Q-011 是新增项）
- `.trae/documents/testing/plans/对话系统回归测试计划_v1.0.0.md`

## 执行

### 步骤 0：重启 daemon + 前端
```
Stop-Process -Name zeroclaw -Force
H:\dev-env\zeroclaw\bin\zeroclaw.exe daemon
# 等 6 秒，curl health 确认

cd apps/frontend && npm run dev
# 等 3 秒
```

### 步骤 1：单元测试
```
cd apps/frontend && npx vitest run      # 应 55 passed（含 Q-011 的 8 个新测试）
cd apps/frontend && npx tsc --noEmit     # 0 error
cd apps/frontend && npx vite build       # 成功
cd apps/backend && python -m pytest tests/test_mcp_server.py tests/test_stage_constants.py tests/test_tools_gates.py tests/test_check_gate_structural.py -v  # 87 passed
```

**重点验证**：
- questionParser.test.ts 的 `extractChoiceListStrict` 测试（3 正例 + 4 反例 + 1 空文本 = 8 个测试）
- 正例：文字选项列表 → 生成卡片
- 反例：总结编号列表 → 不生成卡片；状态标记 ✅/❌ → 不提取；长句 → 不提取

### 步骤 2：WS 回归
```
cd apps/backend && set PYTHONIOENCODING=utf-8 && python scripts/ws_regression_test.py
# 预期 7 轮 0 问题。Q-011 检测：AI 无 tool_call 但有文字列表时标记"前端应兜底"
```

### 步骤 3：Playwright 有头 E2E（最核心）
```
cd apps/frontend && set RUN_AI_E2E=1
npx playwright test zeroclaw-integration --project=chromium --headed --video=retain-on-failure --screenshot=on
```

**关键新增用例**：
- TC-DLG-011：AI 文字选项列表时前端兜底渲染（走多轮观察兜底是否触发）
- TC-DLG-012：总结请求不误产生卡片（发"总结进度"→检查卡片标题不含"进度/完成"）

**回归用例**（不能退化）：
- TC-DLG-001~009：之前通过的用例必须保持通过
- 特别注意 TC-DLG-006（Q-005 不重复问）和 TC-DLG-009（推进到 stage_04）

## 报告

写到 `reports/对话系统回归测试报告_2026-07-23_Q011.md`，必须含 Q-001~Q-011 对照表。

特别关注：
- Q-011：extractChoiceListStrict 在真实对话中是否兜底命中（有文字列表时渲染卡片）
- Q-003：总结文本是否仍然不误提取（不能因为加了兜底而退化）
