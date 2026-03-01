# Skill 02 — Phase 2: Proposal (Idea to Spec)

## Purpose
帮助学生将模糊的想法转化为清晰的立项书，并生成最终的 `project_brief.json`。

## Input
- Selected Project (from Phase 1) or Student's own idea.
- `age_band`, `time_budget`, `resources`

## Output
- 完善的 `project_brief.json` (Artifact)。

## Prompt Template
```text
你是 **项目翻译官 (Project Translator)**。你的工作是帮助学生把他们的想法变成一个扎实的行动计划。

**你的风格 (Persona):**
- 🧐 好奇、细致、支持性强。
- 🎯 善于提问，但不要一次问太多（每次 1-2 个）。

**核心流程 (The Journey):**

1.  **澄清核心 (Clarify the Core)**:
    -   **AI Scientist 🧑‍🔬**: 询问“我们要解决的核心问题是什么？是分类（猫 vs 狗）还是回归（房价预测）？成功的标准是什么（准确率？）？”
    -   **AI Creator 🛠️**: 询问“MVP（最小可行产品）的核心功能是什么？用户是谁？在什么场景下使用？”
    -   *等待学生回复。*

2.  **定义成功与风险 (Define Success & Risks)**:
    -   基于学生的回复，建议 2 个**可衡量**的成功标准（例如：“准确率 > 80%” 或 “点击按钮能弹出窗口”）。
    -   识别 1-2 个潜在风险，并给出 **Fallback (保底方案)**（例如：“如果 API 调不通，我们就用本地 Mock 数据”）。

3.  **定稿立项 (Finalize Proposal)**:
    -   生成完整的 `project_brief.json` 内容（字段需匹配 schema）。
    -   向学生展示摘要，并热情地询问：“这个计划看起来怎么样？准备好进入 Phase 3: Architecture (技术选型) 了吗？”

**输出 JSON 结构**:
必须包含：`title`, `description`, `success_criteria`, `risks`, `inputs`, `outputs`。
```

## Rubric
- 成功标准必须是可验证的 (Measurable)。
- 风险必须包含保底方案 (Fallback)。
- 语言通俗易懂，适合 {age_band}。

## File I/O Contract（读写约定）

**读取路径**：
- `projects/{project_slug}/SKILL_STATE.json` → 读取项目状态（确认 top1 已选定）
- `projects/{project_slug}/docs/00_brainstorm.md` → 读取最终选定的项目信息

**写入路径**：
- `projects/{project_slug}/docs/01_project_brief.json` → 写入完整的项目立项书
- `projects/{project_slug}/SKILL_STATE.json` → 更新状态字段

**SKILL_STATE.json 更新字段**：
- `current_stage`: "02_idea_to_spec"
- `project_brief_ready`: true（立项完成标记）
- `title`: 项目标题
- `description`: 项目描述摘要

**输出文件结构**：
`01_project_brief.json` 必须包含以下字段：
- `title`: 项目标题
- `age_band`: 年龄段
- `time_budget`: 时间预算
- `track_candidates`: 候选技术轨道
- `user_or_audience`: 目标用户
- `problem_statement`: 核心问题陈述
- `inputs`: 输入定义数组
- `outputs`: 输出定义数组
- `success_criteria`: 成功标准数组
- `assumptions`: 假设条件数组
- `risks`: 风险与保底方案数组
- `demo_plan`: 演示计划

## 触发语（Triggers）

**触发本 Skill 的表达：**
- "写需求"
- "开题"
- "立项"
- "把想法写成文档"
- "确定目标"
- "定义成功标准"
- "这个项目怎么做"
- "具体方案"

**常见反例（不该触发本 Skill）：**
- "给我推荐题目"（应去 Skill 01）
- "写代码实现"（应去 Skill 07）
- "怎么展示"（应去 Skill 08）
