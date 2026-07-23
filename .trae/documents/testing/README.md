# testing/ — 测试计划、报告与 QA 交接

version: v1.0.0
created_at: 2026-07-23 00:00:00.000
maintainer: 测试 Agent
status: active
change_log:
  - 2026-07-23 00:00:00.000 初始创建：测试目录索引与 Agent 同步规则。

## 用途

本目录是 fineSTEM 项目测试工作的唯一归档入口，包含：

- 测试体系总览与测试工作指南
- 测试计划、测试用例、测试 Prompt
- 测试报告（按轮次归档）
- 测试日志与抓帧数据
- E2E 截图与 QA 交接文件

## 子目录说明

| 子目录 | 用途 | 状态 |
|--------|------|------|
| [reports/](reports/) | 各轮次测试报告（R01/R02/R03...） | 🟡 高频更新 |
| [log/](log/) | pytest/vitest/Playwright 原始日志与汇总 | 🟡 高频更新 |
| [qa-handoff/](qa-handoff/) | 交给第三方 QA 的 Prompt 文件 | 🟢 稳定 |
| [e2e_multicard/](e2e_multicard/) | 多卡 E2E 测试脚本与截图 | 🟢 已归档 |
| [pbl-conversation-flow/](pbl-conversation-flow/) | PBL 对话流程测试计划与报告 | 🟢 已归档 |

## 核心必读文档

| 文档 | 说明 | 必读对象 |
|------|------|----------|
| [测试体系总览_v2.0.0.md](测试体系总览_v2.0.0.md) | 完整用例编号体系、覆盖率对照 | 所有 Agent |
| [测试工作指南_v1.0.0.md](测试工作指南_v1.0.0.md) | 测试 Agent 唯一操作手册 | 测试 Agent、开发 Agent |
| [SOP_Memory专项测试计划_v1.0.0.md](SOP_Memory专项测试计划_v1.0.0.md) | SOP & Memory 专项测试 | 测试 Agent |
| [对话系统回归测试计划_v1.0.0.md](对话系统回归测试计划_v1.0.0.md) | 对话系统回归测试 | 测试 Agent |

## 最新测试报告

| 报告 | 日期 | 轮次 | 结论 | 状态 |
|------|------|------|------|------|
| [reports/对话系统回归测试报告_2026-07-23.md](reports/对话系统回归测试报告_2026-07-23.md) | 2026-07-23 | 回归 | 待补充 | 🟡 进行中 |
| [reports/SOP_Memory测试报告_2026-