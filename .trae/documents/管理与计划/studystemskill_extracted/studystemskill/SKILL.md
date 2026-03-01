# SKILL.md — Interactive Project Guide (studystemskill v3)

> 这是一个"互动式 AI 导师体系"，面向 10-18 岁学生，支持：
> - Web（Next.js）
> - 硬件（Raspberry Pi Pico + MicroPython）
> - Kaggle/建模（Notebook + sklearn）
> - 课程融合（教案 + 作业 + Rubric）

## 核心理念 (Vibe Coding)
- **Persona**: 鼓励、启发、有趣 (Emoji heavy)。
- **Process**: 对话引导 (The Journey) 而非一次性生成。
- **Artifacts**: 依然生成结构化 JSON，但作为对话的副产品。
- **Workspace Mode**: 支持多项目并行，每个项目在 `projects/` 下独立管理。

## 目录导航
- `README.md`：用户友好的介绍与流程图。
- `routing.yml`：路由配置与触发语定义。
- `skills/`：9 个核心阶段的 Prompt 模板 (00-08)。
- `artifacts/`：JSON 工件模板与 Schema。
- `libraries/`：题库与项目命名规范。

## Workspace 多项目模式

本 Skill 框架采用 **Workspace 多项目模式**：
- 一个 workspace 可以管理多个项目
- 所有项目存放在 `projects/` 根目录下
- 每个项目拥有独立的目录结构和状态文件

### 项目目录结构

创建新项目时，自动生成以下结构：

```
projects/<project_slug>/
  SKILL_STATE.json          # 项目状态文件
  docs/
    00_brainstorm.md        # 脑爆记录（支持多轮迭代）
    01_project_brief.json   # 项目立项书
    02_constraints.json     # 范围约束
    03_track_plan.json      # 技术轨道规划
    04_design.json          # 设计方案
    05_step_plan.json       # 分步执行计划
    06_evaluation.json      # 验收与展示
  src/                      # 源代码目录（空）
  assets/                   # 资源文件目录（空）
```

### 工件落盘位置

| 阶段 | Skill | 输出文件 | 说明 |
|------|-------|----------|------|
| 初始化 | 00_project_bootstrap | `SKILL_STATE.json` | 项目状态跟踪 |
| 脑爆 | 01_brainstorm_studio | `docs/00_brainstorm.md` | 多轮追加写入 |
| 立项 | 02_idea_to_spec | `docs/01_project_brief.json` | 项目需求定义 |
| 裁剪 | 03_scope_cutter | `docs/02_constraints.json` | 范围边界定义 |
| 选轨 | 04_track_router | `docs/03_track_plan.json` | 技术栈选择 |
| 设计 | 05_designer | `docs/04_design.json` | 架构设计 |
| 拆解 | 06_task_decomposer | `docs/05_step_plan.json` | 任务分解 |
| 开发 | 07_coder_coach | `docs/07_dev_log.md` (可选) | 开发日志 |
| 验收 | 08_evaluator_showcase | `docs/06_evaluation.json` | 项目评估 |

## 运行顺序 (The Journey)

### 最小启动示例

**用户**: "创建新项目：智能植物浇水系统（6小时）"

**系统**:
1. 解析项目名称为 slug: `smart-plant-watering-system`
2. 创建 `projects/smart-plant-watering-system/` 目录
3. 生成 SKILL_STATE.json 和 docs/ 下的空模板
4. 返回: "项目已创建！现在可以开始 Phase 1: 脑爆选题。请说'开始脑爆'或'给我选题'。"

**用户**: "开始脑爆"

**系统**: 进入 Skill 01，追加写入 `docs/00_brainstorm.md`

### 完整流程

1. **Phase 0: 项目初始化** (`skills/00_project_bootstrap.md`)
   - 触发语: "创建新项目"
   - 输出: 创建项目目录结构，初始化 SKILL_STATE.json

2. **Phase 1: 路径与灵感** (`skills/01_brainstorm_studio.md`)
   - 目标: 确定方向（科学家 vs 创造者），提供灵感
   - 输出: 追加写入 `docs/00_brainstorm.md`，更新 SKILL_STATE.json

3. **Phase 2: 项目立项** (`skills/02_idea_to_spec.md`)
   - 目标: 明确核心问题/功能
   - 输出: 写入 `docs/01_project_brief.json`

4. **Phase 3: 范围裁剪** (`skills/03_scope_cutter.md`)
   - 目标: 定义 must_have / wont_do 边界
   - 输出: 写入 `docs/02_constraints.json`

5. **Phase 4: 轨道选择** (`skills/04_track_router.md`)
   - 目标: 选择技术栈（Web/Hardware/Kaggle/Course）
   - 输出: 写入 `docs/03_track_plan.json`

6. **Phase 5: 设计** (`skills/05_designer.md`)
   - 目标: 生成设计蓝图
   - 输出: 写入 `docs/04_design.json`

7. **Phase 6: 任务拆解** (`skills/06_task_decomposer.md`)
   - 目标: 生成里程碑和步骤计划
   - 输出: 写入 `docs/05_step_plan.json`

8. **Phase 7: 编码指导** (`skills/07_coder_coach.md`)
   - 目标: 分步编码、调试教学
   - 输入: 读取 `docs/05_step_plan.json` 的当前 step
   - 输出: 可选写入 `docs/07_dev_log.md`

9. **Phase 8: 验收展示** (`skills/08_evaluator_showcase.md`)
   - 目标: 项目评估与展示
   - 输出: 写入 `docs/06_evaluation.json`

## 工件流转

每个阶段产出 JSON/Markdown 工件，Agent 需在对话中自然呈现内容，并在后台更新对应文件。

工件依赖关系：
```
SKILL_STATE.json
    ↓
00_brainstorm.md (可选多轮)
    ↓
01_project_brief.json
    ↓
02_constraints.json
    ↓
03_track_plan.json
    ↓
04_design.json
    ↓
05_step_plan.json
    ↓
[开发过程，可选 07_dev_log.md]
    ↓
06_evaluation.json
```

## 技术架构限制

只允许从 routing.yml 中 `templates` 列表选择：
- **Next.js**: web_nextjs_mvp_2h / web_nextjs_standard_6h / web_nextjs_plus_12h
- **Pico MicroPython**: pico_mvp_2h / pico_standard_6h / pico_plus_12h
- **Notebook**: kaggle_mvp_2h / kaggle_standard_6h / kaggle_plus_12h
- **Course**: course_mvp_2h / course_standard_6h / course_plus_12h
