# Skill 06 — Task Decomposer（分步指令生成器）

## 用途
把设计拆成 `step_plan.json`：里程碑 + 小步（每步≤30行≤2文件）+ run/check/rollback。

## 输入
- `design.json` + `constraints.json` + `track_plan.json`

## 输出
- `step_plan.json`（必须通过 `step_plan.schema.json`）

## Prompt 模板（可复制）
```text
你是“分步指令生成器”。根据design与constraints生成step_plan：
规则：
1) milestones数量<=time_budget对应上限（2h=2，6h=3，12h=4）。
2) steps总数<=time_budget对应上限（2h=6，6h=12，12h=18）。
3) 每个step必须包含：goal, change_budget(max_lines<=30,max_files<=2), run, check(>=2条), rollback, teach_point, quiz(可空但建议填)。
4) 每个milestone必须写demo描述，保证可演示。
输出严格JSON匹配step_plan.schema.json。
```

## 门禁 Rubric
- 每步都有可观察的 `check`（>=2条）
- 有保底路径（卡住时可跳过增强步骤仍能 demo）
- steps/milestones 不超预算

## File I/O Contract（读写约定）

**读取路径**：
- `projects/{project_slug}/SKILL_STATE.json` → 读取项目状态
- `projects/{project_slug}/docs/02_constraints.json` → 读取范围约束（确定步骤数量上限）
- `projects/{project_slug}/docs/03_track_plan.json` → 读取技术轨道规划
- `projects/{project_slug}/docs/04_design.json` → 读取设计方案

**写入路径**：
- `projects/{project_slug}/docs/05_step_plan.json` → 写入分步执行计划
- `projects/{project_slug}/SKILL_STATE.json` → 更新状态字段

**SKILL_STATE.json 更新字段**：
- `current_stage`: "06_task_decomposer"
- `step_plan_ready`: true（步骤计划完成标记）
- `current_step`: 0（初始化为第0步，开发过程中递增）
- `current_milestone`: 0（当前里程碑索引）

**输出文件结构**：
`05_step_plan.json` 必须包含以下字段：
- `milestones`: 里程碑数组（数量按 time_budget: 2h=2, 6h=3, 12h=4）
  - 每个 milestone 包含: `name`, `demo_description`, `steps_range`
- `steps`: 步骤数组（数量按 time_budget: 2h=6, 6h=12, 12h=18）
  - 每个 step 包含: `goal`, `change_budget` (max_lines<=30, max_files<=2), `run`, `check` (>=2条), `rollback`, `teach_point`, `quiz`

**步骤约束**：
- 每步都有可观察的 `check`（>=2条）
- 有保底路径（卡住时可跳过增强步骤仍能 demo）
- steps/milestones 数量不超预算限制

## 触发语（Triggers）

**触发本 Skill 的表达：**
- "拆解步骤"
- "里程碑"
- "一步一步"
- "先做什么"
- "任务分解"
- "怎么开始"
- "开发计划"
- "时间规划"

**常见反例（不该触发本 Skill）：**
- "帮我设计架构"（应去 Skill 05）
- "写这段代码"（应去 Skill 07）
- "项目做完了"（应去 Skill 08）
