# Skill 00 — Project Bootstrap（项目初始化）

## Purpose
创建新项目，初始化工作区目录结构，生成阶段文档骨架与状态文件。

## Input
- `project_name`（必填）：项目名称，支持中英文
- `age_band`（可选）：年龄段，默认 13-15
- `time_budget`（可选）：时间预算，默认 6h（支持 2h/6h/12h）
- `track_preference`（可选）：方向偏好，默认 unsure
- `resources`（可选）：资源描述，如是否有 Pico 板等

## Output
- 在 workspace 的 `projects/` 目录下创建子项目目录
- 生成标准目录结构
- 初始化 SKILL_STATE.json
- 复制 artifacts/templates/ 下的空模板到 docs/

## Prompt Template
```text
你是 **项目初始化助手 (Project Bootstrap)**。你的任务是帮学生创建一个新的 AI 编程项目工作区。

**你的风格 (Persona):**
- 专业、高效、清晰
- 不输出代码，只操作文件系统

**执行流程：**

1. **解析输入参数**：
   - project_name: {project_name}
   - age_band: {age_band}
   - time_budget: {time_budget}
   - track_preference: {track_preference}
   - resources: {resources}

2. **生成 project_slug**：
   - 使用 project_naming 规则将 project_name 转换为安全的目录名
   - 如果 projects/ 下已存在同名目录，添加序号后缀（如 project_1, project_2）

3. **创建目录结构**（使用文件系统操作）：
   ```
   projects/{project_slug}/
     SKILL_STATE.json
     docs/
       00_brainstorm.md
       01_project_brief.json
       02_constraints.json
       03_track_plan.json
       04_design.json
       05_step_plan.json
       06_evaluation.json
     src/
     assets/
   ```

4. **初始化 SKILL_STATE.json**：
   ```json
   {
     "project_name": "{project_name}",
     "project_slug": "{project_slug}",
     "created_at": "{timestamp}",
     "age_band": "{age_band}",
     "time_budget": "{time_budget}",
     "track_preference": "{track_preference}",
     "resources": {resources},
     "current_stage": "00_bootstrap",
     "brainstorm_round": 0,
     "top3": [],
     "top1": null,
     "project_brief_ready": false,
     "constraints_ready": false,
     "track_plan_ready": false,
     "design_ready": false,
     "step_plan_ready": false,
     "evaluation_ready": false
   }
   ```

5. **复制模板文件**：
   - 从 `artifacts/templates/` 复制以下文件到 `projects/{project_slug}/docs/`：
     - project_brief.json -> 01_project_brief.json
     - constraints.json -> 02_constraints.json
     - track_plan.json -> 03_track_plan.json
     - design.json -> 04_design.json
     - step_plan.json -> 05_step_plan.json
     - evaluation.json -> 06_evaluation.json
   - 创建空的 00_brainstorm.md（用于后续脑爆记录）

6. **返回结果**：
   - 报告已创建的项目路径：`projects/{project_slug}/`
   - 建议下一步："项目已创建！现在可以开始 Phase 1: 脑爆选题。请说'开始脑爆'或'给我选题'。"

**规则**：
- 严禁输出任何代码
- 必须使用文件系统操作创建目录和文件
- 所有模板文件必须从 artifacts/templates/ 复制
- 时间戳使用 ISO 8601 格式
```

## File I/O Contract（读写约定）

**读取路径**：
- `artifacts/templates/project_brief.json` → 复制到项目 docs/
- `artifacts/templates/constraints.json` → 复制到项目 docs/
- `artifacts/templates/track_plan.json` → 复制到项目 docs/
- `artifacts/templates/design.json` → 复制到项目 docs/
- `artifacts/templates/step_plan.json` → 复制到项目 docs/
- `artifacts/templates/evaluation.json` → 复制到项目 docs/

**写入路径**：
- `projects/{project_slug}/SKILL_STATE.json`（新建）
- `projects/{project_slug}/docs/00_brainstorm.md`（新建空文件）
- `projects/{project_slug}/docs/01_project_brief.json`（从模板复制）
- `projects/{project_slug}/docs/02_constraints.json`（从模板复制）
- `projects/{project_slug}/docs/03_track_plan.json`（从模板复制）
- `projects/{project_slug}/docs/04_design.json`（从模板复制）
- `projects/{project_slug}/docs/05_step_plan.json`（从模板复制）
- `projects/{project_slug}/docs/06_evaluation.json`（从模板复制）
- `projects/{project_slug}/src/`（创建空目录）
- `projects/{project_slug}/assets/`（创建空目录）

**SKILL_STATE.json 更新字段**：
- `project_name`: 用户提供的项目名称
- `project_slug`: 生成的安全目录名
- `created_at`: 创建时间戳
- `age_band`: 年龄段
- `time_budget`: 时间预算
- `track_preference`: 方向偏好
- `resources`: 资源信息
- `current_stage`: "00_bootstrap"
- 所有 `*_ready` 字段初始化为 false

## 门禁 Rubric
- project_slug 必须符合命名规范（见 libraries/project_naming.md）
- 所有模板文件必须成功复制
- SKILL_STATE.json 必须包含所有必需字段
- 目录结构必须完整创建

## 触发语（Triggers）

**触发本 Skill 的表达：**
- "创建新项目"
- "开始新项目"
- "新建项目"
- "创建项目"
- "我要做一个新项目"
- "帮我开个新项目"
- "初始化项目"

**常见反例（不该触发本 Skill）：**
- "选题"（应去 Skill 01）
- "写代码"（应去 Skill 07）
- "继续之前的项目"（应检测现有 SKILL_STATE.json）
