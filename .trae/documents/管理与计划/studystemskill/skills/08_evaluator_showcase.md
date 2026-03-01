# Skill 08 — Evaluator & Showcase（验收与展示）

## 用途
产出 `evaluation.json`：验收结果、证据、展示脚本、反思与下一步。

## 输入
- `project_brief.json`、`constraints.json`、`track_plan.json`、`design.json`、`step_plan.json`
- 学生完成情况与证据（截图/日志/提交链接/课堂记录）

## 输出
- `evaluation.json`（必须通过 `evaluation.schema.json`）

## Prompt 模板（可复制）
```text
你是“验收与展示教练”。根据项目轨道生成evaluation.json：
- acceptance_results：至少2条验收项（pass/fail）并写evidence字段提示学生填什么证据
- metrics_or_scores：若kaggle写指标；若course写rubric评分维度；web/hw写用例/日志
- showcase_script：给出1分钟演示脚本要点（3-6条）
- reflection：learned 3条，next_steps 1-3条
输出严格JSON匹配evaluation.schema.json。
```

## 门禁 Rubric
- 验收项 ≥ 2 且有 `evidence` 指引
- `reflection.learned` ≥ 2
- `next_steps` ≤ 3

## File I/O Contract（读写约定）

**读取路径**：
- `projects/{project_slug}/SKILL_STATE.json` → 读取项目状态
- `projects/{project_slug}/docs/01_project_brief.json` → 读取项目立项书（成功标准）
- `projects/{project_slug}/docs/02_constraints.json` → 读取范围约束
- `projects/{project_slug}/docs/03_track_plan.json` → 读取技术轨道规划
- `projects/{project_slug}/docs/04_design.json` → 读取设计方案（验收标准）
- `projects/{project_slug}/docs/05_step_plan.json` → 读取步骤计划（里程碑完成情况）
- `projects/{project_slug}/docs/07_dev_log.md`（如存在）→ 读取开发日志

**写入路径**：
- `projects/{project_slug}/docs/06_evaluation.json` → 写入验收评估结果
- `projects/{project_slug}/SKILL_STATE.json` → 更新状态字段

**SKILL_STATE.json 更新字段**：
- `current_stage`: "08_evaluator_showcase"
- `evaluation_ready`: true（评估完成标记）
- `project_status`: "completed" / "partial" / "incomplete"

**输出文件结构**：
`06_evaluation.json` 必须包含以下字段：
- `acceptance_results`: 验收结果数组（至少2项）
  - 每项包含: `criterion`, `result` (pass/fail), `evidence`, `notes`
- `metrics_or_scores`: 指标或评分
  - Kaggle: 模型指标
  - Course: rubric 评分维度
  - Web/HW: 测试用例/日志结果
- `showcase_script`: 演示脚本要点（3-6条）
- `reflection`: 反思总结
  - `learned`: 学到的内容（至少2条）
  - `challenges`: 遇到的挑战
  - `next_steps`: 下一步建议（1-3条）

**验收约束**：
- 验收项 >= 2 且有 `evidence` 指引
- `reflection.learned` >= 2
- `next_steps` <= 3

## 触发语（Triggers）

**触发本 Skill 的表达：**
- "验收"
- "展示"
- "复盘"
- "演示脚本"
- "完成了"
- "怎么展示"
- "我做得怎么样"
- "下一步学什么"

**常见反例（不该触发本 Skill）：**
- "帮我写代码"（应去 Skill 07）
- "怎么拆步骤"（应去 Skill 06）
- "选什么方向"（应去 Skill 04）
