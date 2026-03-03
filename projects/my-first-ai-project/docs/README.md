# 项目文档中心

欢迎来到文学知识卡项目的文档中心! 这里汇集了项目的所有文档，分为**项目文档**和**研学文档**两大类。

---

## 快速导航

### 项目文档 (开发流程)

这些文档记录了项目从创意到实现的完整过程：

| 文档 | 说明 | 状态 | 链接 |
|------|------|------|------|
| 00_brainstorm.md | 脑爆记录 - 创意发散 | 已完成 | [查看](./00_brainstorm.md) |
| 01_project_brief.json | 项目立项书 - 目标与成功标准 | 已完成 | [查看](./01_project_brief.json) |
| 02_constraints.json | 范围约束 - 必须做/不做的事 | 已完成 | [查看](./02_constraints.json) |
| 03_track_plan.json | 技术轨道规划 - 技术选型 | 已完成 | [查看](./03_track_plan.json) |
| 04_design.json | 设计方案 - UI与组件设计 | 已完成 | [查看](./04_design.json) |
| 05_step_plan.json | 分步执行计划 - 里程碑与步骤 | 已完成 | [查看](./05_step_plan.json) |
| 06_dev_log.md | 开发日志 - 编码记录 | 待创建 | [查看](./06_dev_log.md) |

### 研学文档 (学习报告)

这些文档适合用于研学报告、项目展示和学习总结：

| 文档 | 说明 | 状态 | 链接 |
|------|------|------|------|
| 10_proposal.md | 开题报告 - 研究动机与问题 | 草稿 | [查看](./research/10_proposal.md) |
| 20_prd_design.md | 需求与设计文档 | 草稿 | [查看](./research/20_prd_design.md) |
| 30_prototype_spec.md | 原型设计说明书 | 草稿 | [查看](./research/30_prototype_spec.md) |
| 40_tech_report.md | 技术报告 - 实现细节 | 草稿 | [查看](./research/40_tech_report.md) |
| 50_final_report.md | 结题报告 - 成果与反思 | 草稿 | [查看](./research/50_final_report.md) |
| 60_paper.md | 论文 (可选) | 未启用 | [查看](./research/60_paper.md) |

---

## 文档说明

### 项目文档详解

#### 00_brainstorm.md - 脑爆记录
记录了项目初期的创意发散过程，包括：
- 候选项目列表
- 优缺点分析
- 最终选择理由

#### 01_project_brief.json - 项目立项书
项目的"身份证"，包含：
- 项目名称和一句话描述
- 要解决的问题
- 目标用户
- 核心功能
- 成功标准
- 风险与应对方案

#### 02_constraints.json - 范围约束
明确项目边界，防止范围蔓延：
- 必须实现的功能 (must_have)
- 锦上添花的功能 (nice_to_have)
- 明确不做的事 (wont_do)

#### 03_track_plan.json - 技术轨道规划
技术选型的决策记录：
- 选择的技术栈
- 开发环境配置
- 资源检查清单

#### 04_design.json - 设计方案
详细的设计蓝图：
- UI风格和布局
- 组件设计
- 数据流程
- 验收测试用例

#### 05_step_plan.json - 分步执行计划
将设计拆解为可执行的步骤：
- 里程碑划分
- 每步的执行/验证/回退方案
- 时间估算

#### 06_dev_log.md - 开发日志
记录编码过程中的：
- 完成的功能
- 遇到的问题
- 解决方案
- 学习心得

---

### 研学文档详解

#### 10_proposal.md - 开题报告
适合用于项目开题答辩，包含：
- 研究背景与动机
- 研究问题 (RQ)
- 预期目标

#### 20_prd_design.md - 需求与设计文档
产品需求文档，包含：
- 功能需求
- 非功能需求
- 界面设计

#### 30_prototype_spec.md - 原型设计说明书
原型设计的详细说明：
- 界面原型
- 交互流程
- 设计决策

#### 40_tech_report.md - 技术报告
技术实现的详细记录：
- 技术架构
- 关键代码说明
- 测试方案

#### 50_final_report.md - 结题报告
项目总结报告：
- 完成情况
- 成果展示
- 反思与收获

#### 60_paper.md - 论文
学术论文格式 (需要老师开启)：
- 摘要
- 引言
- 方法
- 结果
- 讨论

---

## 文档使用建议

### 如果你是学生

1. **开始新项目**: 先看 [00_brainstorm.md](./00_brainstorm.md) 了解脑爆过程
2. **了解项目目标**: 看 [01_project_brief.json](./01_project_brief.json)
3. **写研学报告**: 参考 research/ 目录下的模板

### 如果你是老师

1. **评估项目进度**: 查看 SKILL_STATE.json 了解阶段状态
2. **检查文档完整性**: 对照上表检查各文档状态
3. **指导学生改进**: 根据文档内容提供反馈

---

## 目录结构

```
docs/
├── README.md                  # 本文件 (文档索引)
├── 00_brainstorm.md           # 脑爆记录
├── 01_project_brief.json      # 项目立项书
├── 02_constraints.json        # 范围约束
├── 03_track_plan.json         # 技术轨道规划
├── 04_design.json             # 设计方案
├── 05_step_plan.json          # 分步执行计划
├── 06_dev_log.md              # 开发日志
└── research/                  # 研学文档目录
    ├── 10_proposal.md         # 开题报告
    ├── 20_prd_design.md       # 需求与设计文档
    ├── 30_prototype_spec.md   # 原型设计说明书
    ├── 40_tech_report.md      # 技术报告
    ├── 50_final_report.md     # 结题报告
    └── 60_paper.md            # 论文 (可选)
```

---

*最后更新: 2026-03-03*
