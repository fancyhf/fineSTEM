# Student Project Guide (学生项目导师)

专为 10-18 岁学生设计的 AI 编程项目导师 Skill。

## 版本

**v6.0 - 状态机规范版**

## 核心理念

对话引导 → 生成文档 → 落盘保存 → 基于文档生成代码

## 目录结构

```
.trae/skills/student-project-guide/
├── SKILL.md                    # 主 Skill 文件（完整规范）
├── README.md                   # 本文件
├── artifacts/
│   ├── schemas/                # JSON Schema 定义（预留）
│   └── templates/              # 文档模板（预留）
├── libraries/                  # 题库资源（预留）
└── skills/                     # 子 Skill（预留）
```

## 项目工作区

每个项目在 `projects/{project_slug}/` 下创建：

```
projects/{project_slug}/
├── SKILL_STATE.json            # 状态机与历史记录
├── docs/                       # 阶段工件
│   ├── 00_brainstorm.md        # 脑爆记录
│   ├── 01_project_brief.json   # 项目立项书
│   ├── 02_constraints.json     # 范围约束
│   ├── 03_track_plan.json      # 技术轨道规划
│   ├── 04_design.json          # 设计方案
│   ├── 05_step_plan.json       # 分步执行计划
│   ├── 06_dev_log.md           # 开发日志
│   └── 07_evaluation.json      # 验收评估
├── src/                        # 源代码
└── assets/                     # 素材/数据
```

## 9 阶段工作流

| 阶段 | 名称 | 产出 | 通过条件 |
|------|------|------|---------|
| stage_00 | 初始化 | 目录 + SKILL_STATE.json | 工件存在 |
| stage_01 | 脑爆 | 00_brainstorm.md | 1轮+候选≥6+Top3 |
| stage_02 | 开题卡 | 01_project_brief.json | schema+success≥2+risks≥2 |
| stage_03 | 范围裁剪 | 02_constraints.json | schema+must≤3+wont≥2 |
| stage_04 | 轨道选择 | 03_track_plan.json | schema+template白名单 |
| stage_05 | 设计蓝图 | 04_design.json + src/ | schema+用例≥3 |
| stage_06 | 分步计划 | 05_step_plan.json | schema+不超预算 |
| stage_07 | 执行开发 | 06_dev_log.md + src/ | 完成1个milestone |
| stage_08 | 验收展示 | 07_evaluation.json | schema+验收≥2+反思≥2 |

## 启动方式

在 AI IDE 中说出以下任意话语：

- "我想做一个项目"
- "创建新项目"
- "开始脑爆"
- "不知道做什么"

## 导航命令

| 命令 | 动作 |
|------|------|
| "下一步" / "next" | 进入下一阶段（需通过门禁） |
| "上一步" / "back" | 软回退（后置工件变 stale） |
| "重做" / "redo" | 重做当前阶段 |
| "查看状态" / "status" | 显示当前状态和 stale 工件 |
| "锁定项目" / "lock" | 锁定项目（防止改方向） |
| "解锁项目" / "unlock" | 解锁项目 |

## 状态机规范

### SKILL_STATE.json 核心字段

```json
{
  "project_id": "string",
  "project_slug": "string",
  "current_stage": "stage_00_bootstrap",
  "stage_status": "draft|passed|needs_redo",
  "stage_passed": {
    "stage_00_bootstrap": true,
    "stage_01_brainstorm": false,
    "...": false
  },
  "artifacts": {
    "brainstorm": {
      "path": "docs/00_brainstorm.md",
      "status": "draft|valid|stale|archived",
      "schema_valid": false,
      "rubric_passed": false
    }
  },
  "dependency_graph": {
    "brainstorm": [],
    "project_brief": ["brainstorm"],
    "...": ["..."]
  },
  "stale_artifacts": [],
  "project_locked": false,
  "history": []
}
```

### 依赖链

```
brainstorm → project_brief → constraints → track_plan → design → step_plan → dev_log → evaluation
```

**Stale 规则**: 前置工件变更 → 所有后置工件变 `stale` → 必须重做

## 资源库

### Web 项目题库（20题）

待办清单、小测验、记账本、单词卡、心情打卡、图片画廊、天气展示、番茄钟、投票、课程资料站、书单收藏、聊天室、任务看板、学习进度条、词典查询、博客编辑器、电影推荐器、习惯打卡、猜数字、反应速度测试

### Kaggle/建模题库（10题）

泰坦尼克号、房价预测、手写数字、鸢尾花分类、客户流失、信用卡欺诈、电影评分、情感分析、猫狗识别、时间序列

### 硬件创客题库（10题）

智能植物浇水、温湿度监测、感应小夜灯、简易电子琴、倒计时器、智能门禁、环境监测站、音乐律动灯、遥控小车、智能鱼缸

## 风格指南

- 🌟 鼓励、启发、有趣
- Emoji 友好
- 适合 10-18 岁学生理解
- 每步都有明确产出

## 维护

- 创建时间: 2026-02-28
- 版本: v6.0
- 状态机规范: 完整 9 阶段
