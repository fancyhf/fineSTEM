# Research Docs Track（研学文档轨）规范

> 版本: v1.0.0
> 用途: 为 AI 编程项目自动产出研学文档，支持开题、设计、开发、结题全流程

---

## 1. 目录结构

每个项目启用研学文档轨后，在 `projects/<slug>/` 下新增：

```
projects/<slug>/
├── docs/
│   ├── research/              # 研学文档目录
│   │   ├── 10_proposal.md     # 开题报告
│   │   ├── 20_prd_design.md   # 需求与设计文档
│   │   ├── 30_prototype_spec.md # 原型设计说明书
│   │   ├── 40_tech_report.md  # 技术报告
│   │   ├── 50_final_report.md # 结题报告
│   │   ├── 60_paper.md        # 论文（可选，受 paper_mode 控制）
│   │   └── assets/            # 证据文件目录
│   │       ├── screenshots/   # 截图
│   │       ├── charts/        # 图表
│   │       ├── logs/          # 日志
│   │       └── results/       # 结果文件
│   └── ...                    # 原有 00~07 文档
└── ...
```

---

## 2. 模式开关（SKILL_STATE.json）

### 2.1 新增字段

```json
{
  "modes": {
    "research_docs": true,
    "paper_mode": "off"
  }
}
```

### 2.2 字段说明

| 字段 | 类型 | 默认值 | 可选值 | 说明 |
|------|------|--------|--------|------|
| `research_docs` | boolean | `true` | `true`/`false` | 是否启用研学文档轨 |
| `paper_mode` | string | `"off"` | `"off"`/`"basic"`/`"advanced"` | 论文模式级别 |

### 2.3 模式切换规则

- **research_docs**: 项目创建时默认开启；用户明确说"不需要研学报告"时关闭
- **paper_mode**:
  - `off`: 不生成 60_paper.md（默认）
  - `basic`: 生成简化版论文（适合 12h+ 项目或老师指定）
  - `advanced`: 生成完整学术论文（适合竞赛/发表，需老师审核）

---

## 3. 阶段映射（Stage → Research Doc）

| Stage | 阶段名称 | 更新文档 | 更新方式 | 关键内容 |
|-------|---------|---------|---------|---------|
| stage_01_brainstorm | 脑爆 | 10_proposal.md | 追加 | 动机、RQ、候选对比 |
| stage_02_brief | 开题 | 10_proposal.md | 更新 | 目标、成功标准、风险、里程碑 |
| stage_03_constraints | 范围裁剪 | 20_prd_design.md | 创建/更新 | must/wont-do、范围约束 |
| stage_04_track | 轨道选择 | 20_prd_design.md | 更新 | 选型理由、替代方案 |
| stage_05_design | 设计蓝图 | 30_prototype_spec.md + 20_prd_design.md | 创建/更新 | 原型设计 + 架构补充 |
| stage_06_step_plan | 分步计划 | 40_tech_report.md | 创建 | 计划、测试方案 |
| stage_07_execute | 执行开发 | 40_tech_report.md | 追加 | 日志、问题修复、证据路径 |
| stage_08_evaluate | 验收展示 | 50_final_report.md (+ 60_paper.md) | 创建 | 结果、反思、下一步 |

---

## 4. 文档最小必填门禁

### 4.1 10_proposal.md（开题报告）

**必须填写**:
- [ ] 背景与动机（≤150字，非空）
- [ ] 研究问题（1-3条，至少1条）
- [ ] 目标与成功标准（≥2条，可测）
- [ ] 风险与应对（≥2条）
- [ ] 里程碑计划（2-4个）

**可选**:
- 伦理与安全（硬件项目必填）

### 4.2 20_prd_design.md（需求与设计）

**必须填写**:
- [ ] Must-have（≤3条，至少1条）
- [ ] Won't-do（≥2条）
- [ ] 验收标准（3-5条，Given/When/Then格式）
- [ ] 按轨道的技术设计（对应轨道章节）

**可选**:
- Nice-to-have
- 用户故事
- 决策记录

### 4.3 30_prototype_spec.md（原型设计）

**必须填写**:
- [ ] 原型目标（≤80字）
- [ ] 页面/界面清单（≤4个，每个含组件和交互）
- [ ] 验收用例（≥3条）

**可选**:
- 信息架构
- 关键用户流程
- 文案与反馈

### 4.4 40_tech_report.md（技术报告）

**必须填写**:
- [ ] 技术架构概览（≤150字）
- [ ] 测试/评测计划（≥3条）
- [ ] 开发/实验日志（至少1条，执行阶段持续追加）

**可选**:
- 问题与修复清单
- 关键决策与取舍

### 4.5 50_final_report.md（结题报告）

**必须填写**:
- [ ] 项目摘要（≤120字）
- [ ] 目标完成情况（对照 success_criteria，每条有结果+证据）
- [ ] 成果证据（≥3项）
- [ ] 亮点（2-4条）
- [ ] 局限与反思（≥2条）

**可选**:
- 下一步计划
- 分工与贡献

### 4.6 60_paper.md（论文）- 仅 paper_mode != off

**必须填写**:
- [ ] Title
- [ ] Abstract（≤150字）
- [ ] Introduction（含 RQ）
- [ ] Method
- [ ] Experiments / Evaluation
- [ ] Conclusion

---

## 5. 证据文件管理

### 5.1 存放位置

所有证据文件统一放在 `docs/research/assets/` 下：

```
assets/
├── screenshots/     # 界面截图、运行结果截图
│   └── YYYY-MM-DD_description.png
├── charts/          # 数据图表、流程图、架构图
│   └── YYYY-MM-DD_chart_name.png
├── logs/            # 运行日志、测试日志
│   └── YYYY-MM-DD_log_type.txt
└── results/         # 输出结果、模型文件、数据集
    └── result_description.ext
```

### 5.2 命名规范

```
{YYYY-MM-DD}_{description}.{ext}

示例:
- 2026-03-01_homepage_ui.png
- 2026-03-02_accuracy_chart.png
- 2026-03-03_training_log.txt
```

### 5.3 引用方式

在文档中引用证据：

```markdown
- 证据: [首页UI截图](assets/screenshots/2026-03-01_homepage_ui.png)
- 结果图表见 `assets/charts/2026-03-02_accuracy_chart.png`
```

---

## 6. 与原有工件的关联

| Research Doc | 关联原工件 | 数据流向 |
|-------------|-----------|---------|
| 10_proposal.md | 00_brainstorm.md, 01_project_brief.json | 脑爆记录 → RQ；brief → 目标/风险 |
| 20_prd_design.md | 02_constraints.json, 03_track_plan.json, 04_design.json | constraints → must/wont-do；track → 技术选型；design → 架构 |
| 30_prototype_spec.md | 04_design.json | design.ui_design → 原型页面 |
| 40_tech_report.md | 05_step_plan.json, 06_dev_log.md | step_plan → 里程碑/测试计划；dev_log → 日志条目 |
| 50_final_report.md | 07_evaluation.json | evaluation → 完成情况/反思 |

---

## 7. 触发语与路由

用户说以下话语时，触发对应操作：

| 触发语 | 操作 | 路由目标 |
|-------|------|---------|
| "生成研学报告" / "我要写开题" | 创建/更新 10_proposal.md | stage_01_brainstorm |
| "写需求文档" / "设计文档" | 创建/更新 20_prd_design.md | stage_03_constraints / stage_04_track |
| "原型设计" / "画界面" | 创建/更新 30_prototype_spec.md | stage_05_design |
| "写技术报告" / "记录日志" | 追加 40_tech_report.md | stage_07_execute |
| "写结题报告" / "项目总结" | 创建 50_final_report.md | stage_08_evaluate |
| "写论文" / "生成论文" | 创建 60_paper.md（需 paper_mode != off） | stage_08_evaluate |

---

## 8. 模板文件位置

研学文档模板存放在 skill 包内：

```
.trae/skills/stem-pbl-guide/artifacts/templates/research/
├── 10_proposal.md
├── 20_prd_design.md
├── 30_prototype_spec.md
├── 40_tech_report.md
├── 50_final_report.md
└── 60_paper.md
```

Project Bootstrap 阶段会将这些模板复制到每个项目的 `docs/research/` 目录。

---

*规范版本: v1.0.0 | 最后更新: 2026-03-03*
