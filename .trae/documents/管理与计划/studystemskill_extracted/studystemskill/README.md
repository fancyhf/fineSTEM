# Interactive Project Guide (studystemskill v3)

**Description:** 专为 10-18 岁学生设计的 AI 编程项目导师。引导学生选择"建模类（AI Scientist）"或"项目类（AI Creator）"方向，从选题、开题、架构选择到代码实现的全流程。

> **核心理念**：Vibe Coding —— 鼓励的、启发式的、有趣的。
> **适用场景**：学生说"我想做一个项目"、"不知道做什么"时调用。
> **运行模式**：Workspace 多项目模式 —— 支持同时管理多个独立项目。

## Workspace 多项目模式

本 Skill 采用 **Workspace 多项目模式**，所有项目统一存放在 `projects/` 根目录下：

```
workspace/
├── projects/
│   ├── smart-plant-watering/     # 项目1
│   │   ├── SKILL_STATE.json
│   │   ├── docs/
│   │   ├── src/
│   │   └── assets/
│   ├── ai-image-classifier/      # 项目2
│   │   ├── SKILL_STATE.json
│   │   ├── docs/
│   │   ├── src/
│   │   └── assets/
│   └── ...
└── .trae/skills/studystemskill/  # Skill 规格包
```

### 项目目录结构

每个项目创建时自动生成以下结构：

```
projects/<project_slug>/
  SKILL_STATE.json          # 项目状态跟踪文件
  docs/
    00_brainstorm.md        # 脑爆记录（支持多轮迭代追加）
    01_project_brief.json   # 项目立项书
    02_constraints.json     # 范围约束定义
    03_track_plan.json      # 技术轨道规划
    04_design.json          # 设计方案
    05_step_plan.json       # 分步执行计划
    06_evaluation.json      # 验收与展示评估
  src/                      # 源代码目录（初始为空）
  assets/                   # 资源文件目录（初始为空）
```

## 快速开始

### 最小启动示例

**用户**: "创建新项目：智能植物浇水系统（6小时）"

**系统**:
1. 解析项目名称为 slug: `smart-plant-watering-system`
2. 创建 `projects/smart-plant-watering-system/` 目录
3. 生成 SKILL_STATE.json 和 docs/ 下的空模板文件
4. 返回: "✅ 项目已创建！路径：`projects/smart-plant-watering-system/`
   现在可以开始 Phase 1: 脑爆选题。请说'开始脑爆'或'给我选题'。"

**用户**: "开始脑爆"

**系统**: 进入 Skill 01，开始多轮脑爆对话，每轮追加写入 `docs/00_brainstorm.md`

## 核心流程 (The Journey)

本 Skill 遵循 9 个阶段引导学生完成项目：

### Phase 0: 项目初始化 (Project Bootstrap)
- **Skill**: `skills/00_project_bootstrap.md`
- **触发语**: "创建新项目"、"开始新项目"、"新建项目"
- **目标**: 创建项目目录结构，初始化 SKILL_STATE.json
- **输出**: `projects/<slug>/SKILL_STATE.json` + docs/ 空模板

### Phase 1: 路径与灵感 (Brainstorm Studio)
- **Skill**: `skills/01_brainstorm_studio.md`
- **触发语**: "选题"、"brainstorm"、"给我灵感"
- **目标**: 确定方向（科学家 vs 创造者），提供灵感，生成候选题
- **输出**: 追加写入 `docs/00_brainstorm.md`，更新 SKILL_STATE.json

### Phase 2: 项目立项 (Idea to Spec)
- **Skill**: `skills/02_idea_to_spec.md`
- **触发语**: "写需求"、"开题"、"立项"
- **目标**: 明确核心问题/功能，生成立项书
- **输出**: `docs/01_project_brief.json`

### Phase 3: 范围裁剪 (Scope Cutter)
- **Skill**: `skills/03_scope_cutter.md`
- **触发语**: "裁剪范围"、"MVP"、"简化"
- **目标**: 定义 must_have / wont_do 边界
- **输出**: `docs/02_constraints.json`

### Phase 4: 轨道选择 (Track Router)
- **Skill**: `skills/04_track_router.md`
- **触发语**: "选方向"、"网页还是硬件"、"用什么技术"
- **目标**: 选择技术栈（Web/Hardware/Kaggle/Course）
- **输出**: `docs/03_track_plan.json`

### Phase 5: 设计 (Designer)
- **Skill**: `skills/05_designer.md`
- **触发语**: "设计"、"架构"、"页面设计"
- **目标**: 生成设计蓝图（页面/实验/教案/硬件方案）
- **输出**: `docs/04_design.json`

### Phase 6: 任务拆解 (Task Decomposer)
- **Skill**: `skills/06_task_decomposer.md`
- **触发语**: "拆解步骤"、"里程碑"、"开发计划"
- **目标**: 生成里程碑和步骤计划
- **输出**: `docs/05_step_plan.json`

### Phase 7: 编码指导 (Coder Coach)
- **Skill**: `skills/07_coder_coach.md`
- **触发语**: "写代码"、"报错了"、"卡住了"
- **目标**: 分步编码、调试教学
- **输入**: 读取 `docs/05_step_plan.json` 的当前 step
- **输出**: 可选写入 `docs/07_dev_log.md`

### Phase 8: 验收展示 (Evaluator & Showcase)
- **Skill**: `skills/08_evaluator_showcase.md`
- **触发语**: "验收"、"展示"、"完成了"
- **目标**: 项目评估与展示脚本
- **输出**: `docs/06_evaluation.json`

## 工件（Artifacts）

流程中生成的结构化文档，按阶段落盘：

| 阶段 | 文件路径 | 说明 |
|------|----------|------|
| 初始化 | `SKILL_STATE.json` | 项目状态跟踪 |
| 脑爆 | `docs/00_brainstorm.md` | 多轮脑爆记录 |
| 立项 | `docs/01_project_brief.json` | 项目需求定义 |
| 裁剪 | `docs/02_constraints.json` | 范围边界 |
| 选轨 | `docs/03_track_plan.json` | 技术栈选择 |
| 设计 | `docs/04_design.json` | 架构设计 |
| 拆解 | `docs/05_step_plan.json` | 任务分解 |
| 开发 | `docs/07_dev_log.md` (可选) | 开发日志 |
| 验收 | `docs/06_evaluation.json` | 项目评估 |

## 技术架构

支持四种技术轨道，每种有 2h/6h/12h 模板：

- **Web（Next.js）**: `web_nextjs_mvp_2h` / `web_nextjs_standard_6h` / `web_nextjs_plus_12h`
- **硬件（Pico MicroPython）**: `pico_mvp_2h` / `pico_standard_6h` / `pico_plus_12h`
- **Notebook（Kaggle）**: `kaggle_mvp_2h` / `kaggle_standard_6h` / `kaggle_plus_12h`
- **Course（教案设计）**: `course_mvp_2h` / `course_standard_6h` / `course_plus_12h`

## 目录导航

- `SKILL.md`: 完整规格定义
- `routing.yml`: 路由配置与触发语
- `skills/`: 9 个核心阶段的 Prompt 模板 (00-08)
- `artifacts/`: JSON 工件模板与 Schema
- `libraries/`: 题库、主题库与项目命名规范

## 题库（Libraries）

- `libraries/topic_library_kaggle.md` (AI Scientist)
- `libraries/topic_library_web.md` (AI Creator - Web)
- `libraries/topic_library_hw_pico.md` (AI Creator - Hardware)
- `libraries/topic_library_course.md` (Course Fusion)
- `libraries/project_naming.md` (项目命名规范)
