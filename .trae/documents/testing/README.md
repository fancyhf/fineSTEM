# testing/ — 测试计划、报告与 QA 交接

version: v1.0.1
created_at: 2026-07-23 00:00:00.000
maintainer: 测试 Agent
status: active
change_log:
  - 2026-07-23 00:00:00.000 初始创建：测试目录索引与 Agent 同步规则。
  - 2026-07-23 12:00:00.000 结构调整：将根目录下的测试计划、Prompt、报告、PBL 用例/指南、E2E 脚本、清理指令归集到对应子目录，根目录仅保留导航文档。

## 用途

本目录是 fineSTEM 项目测试工作的唯一归档入口，包含：

- 测试体系总览与测试工作指南（根目录导航文档）
- 测试计划（`plans/`）
- 测试 Agent Prompt（`prompts/`）
- 测试报告（`reports/`）
- 测试日志与抓帧数据（`log/`、`logs/` 待合并）
- E2E 截图与脚本（`e2e_multicard/`）
- QA 交接与清理指令（`qa-handoff/`）
- PBL 对话流程用例与报告（`pbl-conversation-flow/`）

## 子目录说明

| 子目录 | 用途 | 状态 |
|--------|------|------|
| [plans/](plans/) | 各专项/回归/验收测试计划 | 🟡 高频更新 |
| [prompts/](prompts/) | 测试 Agent 执行 Prompt 与清理指令 | 🟢 稳定 |
| [reports/](reports/) | 各轮次测试报告（R01/R02/R03...） | 🟡 高频更新 |
| [logs/](logs/) | pytest/vitest/Playwright 原始日志与汇总，按日期分子目录 | 🟢 已统一 |
| [qa-handoff/](qa-handoff/) | 交给第三方 QA 的 Prompt | 🟢 稳定 |
| [e2e_multicard/](e2e_multicard/) | 多卡 E2E 测试脚本、验收脚本与截图 | 🟢 已归档 |
| [pbl-conversation-flow/](pbl-conversation-flow/) | PBL 对话流程测试计划、用例、观察指南与报告 | 🟢 已归档 |

## 核心必读文档

| 文档 | 说明 | 必读对象 |
|------|------|----------|
| [测试体系总览_v2.0.0.md](测试体系总览_v2.0.0.md) | 完整用例编号体系、覆盖率对照 | 所有 Agent |
| [测试工作指南_v1.0.0.md](测试工作指南_v1.0.0.md) | 测试 Agent 唯一操作手册 | 测试 Agent、开发 Agent |
| [plans/SOP_Memory专项测试计划_v1.0.0.md](plans/SOP_Memory专项测试计划_v1.0.0.md) | SOP & Memory 专项测试 | 测试 Agent |
| [plans/对话系统回归测试计划_v1.0.0.md](plans/对话系统回归测试计划_v1.0.0.md) | 对话系统回归测试 | 测试 Agent |

## 最新测试报告

| 报告 | 日期 | 轮次 | 结论 | 状态 |
|------|------|------|------|------|
| [reports/对话系统回归测试报告_2026-07-23.md](reports/对话系统回归测试报告_2026-07-23.md) | 2026-07-23 | 回归 | 待补充 | 🟡 进行中 |
| [reports/SOP_Memory测试报告_2026-07-22_R03.md](reports/SOP_Memory测试报告_2026-07-22_R03.md) | 2026-07-22 | R03 | 配置修复后通过 | 🟢 已归档 |
| [reports/SOP_Memory测试报告_2026-07-22_R02.md](reports/SOP_Memory测试报告_2026-07-22_R02.md) | 2026-07-22 | R02 | WebSocket 端到端需人工验证 | 🟡 待验证 |
| [reports/SOP_Memory测试报告_2026-07-22_R01.md](reports/SOP_Memory测试报告_2026-07-22_R01.md) | 2026-07-22 | R01 | 发现配置缺失与 auto_approve 问题 | 🟢 已归档 |
| [reports/ZeroClaw重构测试报告_2026-07-22.md](reports/ZeroClaw重构测试报告_2026-07-22.md) | 2026-07-22 | - | ZeroClaw 重构验证 | 🟢 已归档 |
| [reports/PBL_AI对话流测试报告_v1.0.0_2026-07-20_180630.md](reports/PBL_AI对话流测试报告_v1.0.0_2026-07-20_180630.md) | 2026-07-20 | - | PBL AI 对话流测试 | 🟢 已归档 |
| [reports/round1_report.md](reports/round1_report.md) | 历史 | R01 | 早期 QA 报告 | 🟢 已归档 |
| [reports/round2_report.md](reports/round2_report.md) | 历史 | R02 | 早期 QA 报告 | 🟢 已归档 |

## 命名规则

- 测试计划：`plans/测试计划_v<版本>.md`
- 测试报告：`reports/测试报告_<YYYY-MM-DD>_R<轮次>.md`
- 测试 Prompt：`prompts/测试Agent执行Prompt_<主题>.md`
- 测试用例：`pbl-conversation-flow/测试用例文档_v<版本>.md`
- 日志：`logs/<YYYY-MM-DD>/<tool>-<round>.log`

## Agent 同步规则

| 动作 | 负责 Agent | 更新位置 |
|------|------------|----------|
| 新增测试计划 | 测试 Agent | 本 README“核心必读文档” + `plans/` |
| 新增测试 Prompt | 测试 Agent | 本 README + `prompts/` |
| 新增测试报告 | 测试 Agent | 本 README“最新测试报告”表 + `reports/` |
| 新增日志/截图 | 测试 Agent | `logs/<YYYY-MM-DD>/` 或 `e2e_multicard/screenshots/` |
| 新增 QA handoff | 开发 Agent | `qa-handoff/` + [qa-handoff/README.md](qa-handoff/README.md) |
| 新增测试 Agent 清理/操作指令 | 测试 Agent | `prompts/` |
| 修复后回归 | 测试 Agent | 更新对应报告状态 + 新增回归报告 |

## 当前关键待办

| 编号 | 事项 | 负责 | 状态 | 关联文档 |
|------|------|------|------|----------|
| TE-01 | 完成 ws_sop_test.py / ws_memory_test.py 端到端验证 | 测试 Agent | 🟡 需前端人工确认 | [reports/SOP_Memory测试报告_2026-07-22_R02.md](reports/SOP_Memory测试报告_2026-07-22_R02.md) |
| TE-02 | 补充 Playwright 各菜单 spec | 测试 Agent | 🔴 待启动 | [测试工作指南_v1.0.0.md](测试工作指南_v1.0.0.md) |
| TE-03 | 确认历史 report_local / create-smoke 归档无遗漏 | 测试 Agent | 🟢 已完成 | [logs/](logs/) |

## 禁止事项

- 禁止删除历史测试报告（只能追加）。
- 禁止测试 Agent 修改 `apps/backend/app/` 或 `apps/frontend/src/` 产品代码。
- 禁止无日志/截图直接给出测试结论。
- 禁止在 testing/ 根目录新增非导航类文档；新增计划/报告/Prompt 必须放入对应子目录。
