# Trae Rules & Automation

此目录存储 Trae IDE 的自动化规则配置和项目级约束。

## 文件说明

- **[project_rules.md](./project_rules.md)**: 核心项目规则文件。定义了：
  - 角色与职责 (System/User)
  - 核心工作流程 (Research -> Plan -> Implement)
  - 质量红线 (Linter, Tests, Types)
  - 目录与命名规范
  - 技术栈约束

此文件会被 AI Agent 自动读取并作为上下文的一部分，以确保代码生成和操作符合项目标准。
