# Skill 03 — Scope Cutter（范围裁剪器）

## 用途
把项目砍到“能做完”，并形成明确边界（must_have / wont_do）。

## 输入
- `project_brief.json`

## 输出
- `constraints.json`（必须通过 `constraints.schema.json`）

## Prompt 模板（可复制）
```text
你是“范围裁剪器”。读取project_brief，基于time_budget={time_budget}与age_band={age_band}自动裁剪范围：
- must_have最多3条
- wont_do至少2条，明确不做什么
- nice_to_have最多3条
- 若硬件方向，必须加入safety_rules.hardware
输出严格JSON匹配constraints.schema.json。
```

## 门禁 Rubric
- `must_have` ≤ 3
- `wont_do` ≥ 2
- `resource_limits` 明确
- 硬件方向必须包含安全规则

## File I/O Contract（读写约定）

**读取路径**：
- `projects/{project_slug}/SKILL_STATE.json` → 读取项目状态
- `projects/{project_slug}/docs/01_project_brief.json` → 读取项目立项书

**写入路径**：
- `projects/{project_slug}/docs/02_constraints.json` → 写入范围约束定义
- `projects/{project_slug}/SKILL_STATE.json` → 更新状态字段

**SKILL_STATE.json 更新字段**：
- `current_stage`: "03_scope_cutter"
- `constraints_ready`: true（范围定义完成标记）

**输出文件结构**：
`02_constraints.json` 必须包含以下字段：
- `time_budget`: 时间预算（与立项书一致）
- `difficulty_level`: 难度级别（beginner/intermediate/advanced）
- `must_have`: 必须完成的功能数组（最多3条）
- `nice_to_have`: 可选功能数组（最多3条）
- `wont_do`: 明确不做的功能数组（至少2条）
- `resource_limits`: 资源限制（设备、数据等）
- `safety_rules`: 安全规则（硬件项目必须包含）

## 触发语（Triggers）

**触发本 Skill 的表达：**
- "裁剪范围"
- "做不完"
- "太多了"
- "MVP"
- "砍掉功能"
- "简化"
- "哪些必须做"
- "哪些可以不做"

**常见反例（不该触发本 Skill）：**
- "帮我选题"（应去 Skill 01）
- "怎么设计架构"（应去 Skill 05）
- "下一步写什么代码"（应去 Skill 07）
