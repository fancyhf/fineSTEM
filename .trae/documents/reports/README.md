# reports/ — 进度、计划与问题报告

version: v1.0.0
created_at: 2026-07-23 00:00:00.000
maintainer: 项目经理
status: active
change_log:
  - 2026-07-23 00:00:00.000 初始创建：报告目录索引与同步规则。

## 用途

本目录归档 fineSTEM 项目的综合报告类文档，包括：

- 开发计划与路线图（分阶段 MVP 计划）
- 进度记录（迭代进展、关键里程碑）
- 问题清单与根因分析（findings、开发遗漏审计）
- 事故报告（代码覆盖、流程断点等）
- 完成度评估与交接文档

## 范围

- 不存放测试报告（见 [../testing/reports/](../testing/reports/)）
- 不存放审计报告（见 [../audit/](../audit/)）
- 不存放产品需求文档（见 [../产品与规划/](../产品与规划/)）

## 当前核心文档

| 文档 | 类型 | 状态 | 说明 |
|------|------|------|------|
| [progress.md](progress.md) | 进度记录 | 🟡 更新中 | 创造主链路重构进度，含已完成项与遗留问题 |
| [findings.md](findings.md) | 关键发现 | 🟡 更新中 | 创造主链路静态排查的关键问题与修复方向 |
| [task_plan.md](task_plan.md) | 任务计划 | 🟢 已归档 | 历史任务规划 |
| [full_development_plan_v3.3.md](full_development_plan_v3.3.md) | 总体开发计划 | 🟢 已归档 | v3.3 全量开发计划 |
| [phase1_mvp_development_plan.md](phase1_mvp_development_plan.md) | 阶段计划 | 🟢 已归档 | Phase 1 MVP 开发计划 |
| [phase2_development_plan.md](phase2_development_plan.md) | 阶段计划 | 🟢 已归档 | Phase 2 开发计划 |
| [phase3_plus_development_plan.md](phase3_plus_development_plan.md) | 阶段计划 | 🟢 已归档 | Phase 3+ 开发计划 |
| [incident_workspace_code_overwrite_2026-07-18.md](incident_workspace_code_overwrite_2026-07-18.md) | 事故报告 | 🟢 已归档 | 代码覆盖事故记录 |
| [开发遗漏深度审计报告_2026-04-26_v9.md](开发遗漏深度审计报告_2026-04-26_v9.md) | 审计报告 | 🟢 已归档 | 需求 vs 代码偏差分析 |

## 命名规则

`<报告主题>_<日期>[_v<版本>].<ext>`

例：`开发遗漏深度审计报告_2026-04-26_v9.md`

## Agent 同步规则

| 动作 | 负责 Agent | 更新位置 |
|------|------------|----------|
| 新增/更新计划 | 项目经理 | 本 README“当前核心文档”表 + 文档本身 |
| 更新进度 | 项目经理 / 开发 Agent | [progress.md](progress.md) |
| 记录问题/发现 | 开发 Agent / 测试 Agent | [findings.md](findings.md) 或新增报告 |
| 事故复盘 | 项目经理 | 新增事故报告 + 本表登记 |

## 当前关键待办

| 编号 | 事项 | 负责 | 状态 | 关联文档 |
|------|------|------|------|----------|
| R-01 | 跟进创造主链路遗留问题清理 | 开发 Agent | 🟡 进行中 | [findings.md](findings.md) |
| R-02 | 更新下一阶段开发计划 | 项目经理 | 🔴 待启动 | [full_development_plan_v3.3.md](full_development_plan_v3.3.md) |
