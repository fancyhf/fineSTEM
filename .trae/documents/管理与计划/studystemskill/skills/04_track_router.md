# Skill 04 — Track Router（轨道选择与技术卡片）

## 用途
让学生选择项目轨道（web/hw/kaggle/course），自动绑定能力包与默认技术栈，输出 `track_plan.json`。

## 输入
- `project_brief.json` + `constraints.json`
- 学生选择：`track_selected` 或 `unsure`

## 输出
- `track_plan.json`（必须通过 `track_plan.schema.json`）

## Prompt 模板（可复制）
```text
你是“轨道规划器”。根据project_brief与constraints，为学生推荐1-2条轨道，并让学生最终选1条：
- web_nextjs：网页应用（Next.js）
- hw_pico：硬件（Raspberry Pi Pico + MicroPython）
- kaggle_modeling：Kaggle/建模（Notebook + sklearn）
- course_fusion：课程融合（教案+作业+rubric）
若学生unsure，默认推荐web_nextjs（除非has_pico_board=true且题目更适合硬件）。
输出严格JSON匹配track_plan.schema.json，并写一句给学生看的中文说明variant_notes_for_student。
```

## 门禁 Rubric
- 资源不匹配时自动改推荐（没 Pico 不强推 hw）
- `competency_bundle` ≥ 2
- `template_id` 与 `time_budget` 对应（2h/6h/12h）

## File I/O Contract（读写约定）

**读取路径**：
- `projects/{project_slug}/SKILL_STATE.json` → 读取项目状态
- `projects/{project_slug}/docs/01_project_brief.json` → 读取项目立项书
- `projects/{project_slug}/docs/02_constraints.json` → 读取范围约束
- `routing.yml` → 读取可用技术轨道和模板白名单

**写入路径**：
- `projects/{project_slug}/docs/03_track_plan.json` → 写入技术轨道规划
- `projects/{project_slug}/SKILL_STATE.json` → 更新状态字段

**SKILL_STATE.json 更新字段**：
- `current_stage`: "04_track_router"
- `track_plan_ready`: true（轨道规划完成标记）
- `track_selected`: 选定的技术轨道（如 "web_nextjs" / "hw_pico" / "kaggle_modeling" / "course_fusion"）
- `template_id`: 选定的模板ID（必须来自 routing.yml 的 template_whitelist）

**输出文件结构**：
`03_track_plan.json` 必须包含以下字段：
- `track_selected`: 选定的技术轨道
- `template_id`: 模板ID（必须在白名单中）
- `stack_profile`: 技术栈配置
- `runner_type`: 运行器类型
- `competency_bundle`: 能力包数组（至少2项）
- `variant_notes_for_student`: 给学生看的中文说明

**模板白名单约束**：
`template_id` 必须是 routing.yml 中 `template_whitelist.allowed_templates` 列表中的值：
- web_nextjs_mvp_2h / web_nextjs_standard_6h / web_nextjs_plus_12h
- pico_mvp_2h / pico_standard_6h / pico_plus_12h
- kaggle_mvp_2h / kaggle_standard_6h / kaggle_plus_12h
- course_mvp_2h / course_standard_6h / course_plus_12h

## 触发语（Triggers）

**触发本 Skill 的表达：**
- "选方向"
- "网页还是硬件"
- "Kaggle"
- "做网站"
- "做硬件"
- "数据建模"
- "课程设计"
- "用什么技术"

**常见反例（不该触发本 Skill）：**
- "给我灵感选题"（应去 Skill 01）
- "帮我写需求文档"（应去 Skill 02）
- "怎么拆步骤"（应去 Skill 06）
