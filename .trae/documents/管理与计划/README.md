# 管理与计划/ — 项目计划、交接文档与 Skill 规范

version: v1.0.0
created_at: 2026-07-23 00:00:00.000
maintainer: 项目经理
status: active
change_log:
  - 2026-07-23 00:00:00.000 初始创建：管理目录索引与同步规则。

## 用途

本目录归档 fineSTEM 项目的管理、计划与协作文档，包括：

- 项目创建到回顾的完整流程文档
- 开发/测试 Agent 交接文档
- 研究文档模板与 Skill 规范
- 流程断点修复计划

## 子目录说明

| 子目录 | 用途 | 状态 |
|--------|------|------|
| [research_docs_templates_v2/](research_docs_templates_v2/) | 研究文档模板套件 | 🟢 稳定 |
| [studystemskill/](studystemskill/) | StudyStem Skill 规范、模板、Schema 与库 | 🟢 稳定 |

## 当前核心文档

| 文档 | 类型 | 状态 | 说明 |
|------|------|------|------|
| [SOP_Memory_交接文档_给开发Agent.md](SOP_Memory_交接文档_给开发Agent.md) | 交接文档 | 🟢 已实施 | SOP & Memory 功能开发交接 |
| [项目创建到回顾流程完善-交接文档.md](项目创建到回顾流程完善-交接文档.md) | 流程文档 | 🟢 已归档 | 项目全生命周期流程 |
| [流程断点修复计划-2026-06-17.md](流程断点修复计划-2026-06-17.md) | 修复计划 | 🟢 已归档 | 流程断点修复 |

## 命名规则

`<主题>_<类型>[_YYYY-MM-DD].<ext>`

例：`SOP_Memory_交接文档_给开发Agent.md`

## Agent 同步规则

| 动作 | 负责 Agent | 更新位置 |
|------|------------|----------|
| 新增交接文档 | 项目经理 / 开发 Agent | 本 README“当前核心文档”表 |
| 更新 Skill 规范 | 课程设计 Agent | [studystemskill/README.md](studystemskill/README.md) |
| 流程变更 | 项目经理 | 新增/更新流程文档 + 本表登记 |
| 断点修复 | 开发 Agent / 测试 Agent | 更新修复计划 + [../reports/findings.md](../reports/findings.md) |

## 当前关键待办

| 编号 | 事项 | 负责 | 状态 | 关联文档 |
|------|------|------|------|----------|
| M-01 | 根据 R02/R03 测试结果更新交接文档 | 项目经理 | 🟡 待启动 | [SOP_Memory_交接文档_给开发Agent.md](SOP_Memory_交接文档_给开发Agent.md) |
| M-02 | 整理 Skill 模板与代码实现的映射 | 课程设计 Agent | 🔴 待启动 | [studystemskill/](studystemskill/) |
