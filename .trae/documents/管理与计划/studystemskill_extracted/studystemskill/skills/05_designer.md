# Skill 05 — Designer（设计器：架构/实验/教案/硬件方案）

## 用途
生成项目蓝图 `design.json`（按轨道 variant 填对应区块，其余置 null）。

## 输入
- `project_brief.json` + `constraints.json` + `track_plan.json`

## 输出
- `design.json`（必须通过 `design.schema.json`）

## Prompt 模板（可复制）
```text
你是“设计器”。根据track_selected={track_selected}输出design.json：
- 若web_nextjs：输出pages<=限制，components<=限制，data_flow(先mock)，acceptance_tests 3-5条（Given/When/Then）
- 若hw_pico：输出hardware_list<=限制，pin_plan，引脚表，state_machine，safety_checklist
- 若kaggle_modeling：输出dataset_source，baseline_model，metrics，validation_strategy，improvement_ideas<=3，submission_plan
- 若course_fusion：输出learning_objectives<=3，lesson_flow，activity_plan<=2，assignment=1，rubric(评分维度)
输出必须严格JSON，未选中的模块置为null，并设置design_variant为对应值。
```

## 门禁 Rubric
- 字段齐全且数量不超上限
- Web/Kaggle/Course 至少 3 条验收/评测点
- 硬件必须有安全清单与引脚表

## File I/O Contract（读写约定）

**读取路径**：
- `projects/{project_slug}/SKILL_STATE.json` → 读取项目状态
- `projects/{project_slug}/docs/01_project_brief.json` → 读取项目立项书
- `projects/{project_slug}/docs/02_constraints.json` → 读取范围约束
- `projects/{project_slug}/docs/03_track_plan.json` → 读取技术轨道规划（确定 design_variant）

**写入路径**：
- `projects/{project_slug}/docs/04_design.json` → 写入设计方案
- `projects/{project_slug}/SKILL_STATE.json` → 更新状态字段

**SKILL_STATE.json 更新字段**：
- `current_stage`: "05_designer"
- `design_ready`: true（设计完成标记）

**输出文件结构**：
`04_design.json` 必须包含以下字段：
- `design_variant`: 设计类型（"web_nextjs" / "hw_pico" / "kaggle_modeling" / "course_fusion"）
- 根据 design_variant 填充对应模块：
  - web_nextjs: `pages`, `components`, `data_flow`, `acceptance_tests`
  - hw_pico: `hardware_list`, `pin_plan`, `state_machine`, `safety_checklist`
  - kaggle_modeling: `dataset_source`, `baseline_model`, `metrics`, `validation_strategy`, `improvement_ideas`, `submission_plan`
  - course_fusion: `learning_objectives`, `lesson_flow`, `activity_plan`, `assignment`, `rubric`
- 未选中的模块置为 null

**设计约束**：
- Web/Kaggle/Course 至少 3 条验收/评测点
- 硬件必须有安全清单与引脚表
- 字段数量不超过 constraints.json 中定义的上限

## 触发语（Triggers）

**触发本 Skill 的表达：**
- "设计"
- "架构"
- "页面设计"
- "组件设计"
- "实验方案"
- "接线图"
- "引脚规划"
- "教案设计"

**常见反例（不该触发本 Skill）：**
- "选什么技术方向"（应去 Skill 04）
- "怎么拆成步骤"（应去 Skill 06）
- "代码报错了"（应去 Skill 07）
