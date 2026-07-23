# 对话系统回归测试任务

你是测试 agent。对 fineSTEM AI 对话系统执行全面回归测试，验证问题清单 Q-001~Q-010 全部修复。

## 背景

对话系统有 10 个历史问题（选项卡丢失、总结误识别、重复问、多选不生效等），开发 agent 已全部修复。
你的任务是**验证这些修复确实生效，且没有引入新问题**。

## ⚠️ 强制要求（违反 = 测试无效）

1. **必须有头测试**：Playwright 必须用 `--headed`，不用 headless。出问题时要能看截图。
2. **必须推进到 stage_04**：测试脚本必须走完 stage_00→01→02→03→04，只测前两轮不算通过。
3. **必须重启 daemon**：config.toml 和 prompt 改了，不重启则跑的是旧配置。
4. **不改产品代码**：你只测试 + 出报告，不改 `apps/` 或 `H:/dev-env/zeroclaw/config/` 下的任何代码。

## 必读

1. `.trae/documents/问题清单_长期维护.md` — 10 个问题的详细描述和测试要求
2. `.trae/documents/testing/plans/对话系统回归测试计划_v1.0.0.md` — 完整测试计划（25 个用例）

## 执行步骤

### 步骤 0：重启 daemon（最关键！）

```bash
powershell: Stop-Process -Name zeroclaw -Force
# 等 3 秒
H:\dev-env\zeroclaw\bin\zeroclaw.exe daemon
# 等 6 秒
curl http://127.0.0.1:42617/health  # 确认 status=ok
```

### 步骤 1：启动前端

```bash
cd apps/frontend && npm run dev
# 等 3 秒
curl http://localhost:5184/  # 确认返回 HTML
```

### 步骤 2：单元测试

```bash
cd apps/frontend
npx vitest run                    # 应 47 passed
npx tsc --noEmit                  # useStreamingChat.ts + Create.tsx 零错误
npx vite build                    # 构建成功

cd ../backend
python -m pytest tests/test_mcp_server.py tests/test_stage_constants.py tests/test_tools_gates.py tests/test_check_gate_structural.py -v  # 应 87 passed
```

### 步骤 3：WS 回归测试

```bash
cd apps/backend
set PYTHONIOENCODING=utf-8
python scripts/ws_regression_test.py
# 预期：7 轮对话，0 问题检出
```

### 步骤 4：⚠️ Playwright 有头 E2E（最核心）

```bash
cd apps/frontend
set RUN_AI_E2E=1
npx playwright test zeroclaw-integration --project=chromium --headed --video=retain-on-failure --screenshot=on
```

**关键验证点**（对照问题清单）：
- TC-DLG-001/002：选项卡不丢（Q-001）—— 3 轮连续各有卡片
- TC-DLG-003：无重复卡（Q-004）—— 同一问题 ≤1 张卡
- TC-DLG-004：[选择] 格式识别（Q-010）—— 点选项后 AI 推进
- TC-DLG-005：多选可多选（Q-006）—— stage_01 兴趣卡选 2 个
- TC-DLG-006：不重复问年级（Q-005）—— stage_01 不再问年级
- TC-DLG-007：总结不误产生卡（Q-003）—— "总结进度"后无新卡片
- TC-DLG-009：全流程到 stage_04（核心覆盖）—— 推进到技术轨道选择

### 步骤 5：出报告

报告写到 `.trae/documents/testing/reports/对话系统回归测试报告_<date>.md`。

**报告必须含问题清单对照表**：

| 编号 | 问题 | TC 用例 | 结果 | 证据 |
|------|------|---------|------|------|
| Q-001 | 选项卡丢失 | TC-DLG-001~002 | ✅/❌ | 截图路径 |
| Q-002 | AI 不调 ask_question | WS 回归 | ✅/❌ | tool_call 率 |
| Q-003 | 总结误识别 | TC-DLG-007 | ✅/❌ | 截图路径 |
| Q-004 | 重复卡 | TC-DLG-003 | ✅/❌ | 截图路径 |
| Q-005 | 重复问 | TC-DLG-006 | ✅/❌ | 截图路径 |
| Q-006 | 多选不生效 | TC-DLG-005 | ✅/❌ | 截图路径 |
| Q-007 | 只总结无下一步 | TC-DLG-009 | ✅/❌ | 日志 |
| Q-008 | 回复截断 | TC-DLG-003 | ✅/❌ | 日志 |
| Q-009 | 思考链不显示 | TC-DLG-010 | ✅/❌ | 日志 |
| Q-010 | [选择] 格式 | TC-DLG-004 | ✅/❌ | 截图路径 |

## 失败时的取证

任何用例失败，必须收集：
1. 完整错误输出
2. 截图（test-results/ 目录）
3. 录屏（test-results/ 目录）
4. 初步判断（前端/后端/配置/AI 模型行为）
5. 复现命令
