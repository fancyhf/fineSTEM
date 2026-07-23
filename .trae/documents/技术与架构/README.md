# 技术与架构/ — 架构设计、部署运维与技术文档

version: v1.0.0
created_at: 2026-07-23 00:00:00.000
maintainer: 技术顾问 / DevOps
status: active
change_log:
  - 2026-07-23 00:00:00.000 初始创建：技术目录索引与同步规则。

## 用途

本目录归档 fineSTEM 项目的技术与架构文档，包括：

- 技术架构设计
- 部署与运维指南
- 技术选型与评估
- 集成重构方案
- 开发文档与 Agent Skill 规范
- 模板工作提示词

## 范围

- 不存放产品需求文档（见 [../产品与规划/](../产品与规划/)）
- 不存放测试报告（见 [../testing/](../testing/)）
- 不存放审计报告（见 [../audit/](../audit/)）

## 当前核心文档

| 文档 | 类型 | 状态 | 说明 |
|------|------|------|------|
| [fineSTEM_MVP_1.0_Technical_Architecture.md](fineSTEM_MVP_1.0_Technical_Architecture.md) | 架构设计 | 🟢 已归档 | MVP 1.0 技术架构 |
| [ZeroClaw_技术知识库_v1.0.0.md](ZeroClaw_技术知识库_v1.0.0.md) | 技术知识库 | 🟢 已归档 | ZeroClaw 技术细节 |
| [ZeroClaw集成重构_v1.0.0.md](ZeroClaw集成重构_v1.0.0.md) | 重构方案 | 🟢 已实施 | ZeroClaw 集成根因分析与修复 |
| [ZeroClaw部署与运维指南_v1.0.0.md](ZeroClaw部署与运维指南_v1.0.0.md) | 运维指南 | 🟢 已归档 | ZeroClaw 部署运维 |
| [FineSTEM MVP 部署计划.md](FineSTEM%20MVP%20部署计划.md) | 部署计划 | 🟢 已归档 | MVP 部署计划 |
| [SOP_Memory集成技术实现总结_v1.0.0.md](SOP_Memory集成技术实现总结_v1.0.0.md) | 实现总结 | 🟢 已实施 | SOP & Memory 集成技术总结 |
| [fineSTEM_Agent_Skill_开发文档_v1.0.0.md](fineSTEM_Agent_Skill_开发文档_v1.0.0.md) | 开发文档 | 🟢 已归档 | Agent Skill 开发规范 |
| [template-work-prompt.md](template-work-prompt.md) | 模板提示词 | 🟢 已归档 | 模板生成任务输入规范 |
| [修复ai对话流20270720.md](修复ai对话流20270720.md) | 修复记录 | 🟢 已归档 | AI 对话流修复记录 |

## 命名规则

`<主题>[_v<版本>][_YYYY-MM-DD].<ext>`

例：`ZeroClaw集成重构_v1.0.0.md`

## Agent 同步规则

| 动作 | 负责 Agent | 更新位置 |
|------|------------|----------|
| 新增架构文档 | 技术顾问 | 本 README“当前核心文档”表 |
| 更新部署运维 | DevOps | 对应文档 + 本表状态/日期 |
| 集成重构后归档 | 开发 Agent | 新增实现总结文档 + 本表登记 |
| 接口变更 | 后端 Agent | 同步更新 [../api-specs/](../api-specs/) |

## 当前关键待办

| 编号 | 事项 | 负责 | 状态 | 关联文档 |
|------|------|------|------|----------|
| T-01 | 评估 ZeroClaw 端口 42617 与 API Key 硬编码风险整改 | DevOps | 🟡 待评估 | [audit/ZeroClaw架构审计报告](../audit/ZeroClaw架构审计报告_v1.0.0_2026-07-22.md) |
| T-02 | 更新 MVP 部署计划以匹配当前架构 | DevOps | 🔴 待启动 | [FineSTEM MVP 部署计划.md](FineSTEM%20MVP%20部署计划.md) |
