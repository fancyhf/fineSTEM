# starter_kits/ — 开发启动套件

version: v1.0.0
created_at: 2026-07-23 00:00:00.000
maintainer: 课程设计 Agent
status: active
change_log:
  - 2026-07-23 00:00:00.000 初始创建：启动套件目录索引。

## 用途

本目录归档 fineSTEM 各 Track 的启动套件设计文档。启动套件用于：

- 为学生提供项目式学习的入门模板
- 定义每个 Track 的核心功能、示例场景、技术栈
- 指导前端 Web Terminal、AI 引导语、交付物规范

## 范围

- 每个 Track 一个独立文档
- 不包含具体实现代码（代码在 `apps/` 或 `pbl/projects/`）
- 不包含课程化评价体系（见 [../pbl/](../pbl/)）

## 当前内容

| 文档 | Track | 状态 | 说明 |
|------|-------|------|------|
| [track_e_data_analysis_kit.md](track_e_data_analysis_kit.md) | Track E: 数据分析 | 🟢 已设计 | “我的第一份数据侦探报告”入门套件 |

## 命名规则

`track_<标识>_<主题>_kit.md`

例：`track_e_data_analysis_kit.md`

## Agent 同步规则

| 动作 | 负责 Agent | 更新位置 |
|------|------------|----------|
| 新增 Track 套件 | 课程设计 Agent | 本 README“当前内容”表 + 新增文档 |
| 更新套件设计 | 课程设计 Agent | 对应文档 + 本表状态/日期 |
| 套件转开发任务 | 产品经理 | [../管理与计划/](../管理与计划/) 与 [../reports/](../reports/) |

## 待跟进

- 当前仅 Track E 有套件，需根据产品规划补充 Track A/B/C/D 等套件。
