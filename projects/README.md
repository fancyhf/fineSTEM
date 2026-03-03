# Projects 项目目录

本目录存放由 **STEM PBL Guide** 生成的学生项目。

这些项目展示了 STEM 项目式学习(PBL)的完整流程，从需求分析、设计规划到代码实现。

---

## 项目列表

| 项目 | 当前阶段 | 状态 | 技术栈 |
|------|---------|------|--------|
| [my-first-ai-project](./my-first-ai-project/) | stage_07_execute | 执行开发中 | Python Flask |
| [up-video-analyzer](./up-video-analyzer/) | stage_08_evaluate | 已完成 | Python Streamlit |
| [smart-todo-list](./smart-todo-list/) | stage_01_brainstorm | 脑爆阶段 | Next.js |

---

## 项目详情

### 1. my-first-ai-project - 文学知识卡

**二次元漫画风格的古诗词学习应用**

- **当前阶段**: 执行开发 (stage_07_execute)
- **年龄组**: 13-15岁
- **时间预算**: 12h+
- **技术栈**: Python Flask + HTML/CSS/JS
- **功能**: 卡片式学习、搜索筛选、收藏、添加诗词
- **项目入口**: [my-first-ai-project](./my-first-ai-project/)

---

### 2. up-video-analyzer - UP主视频内容分析器

**上传视频字幕，AI自动生成词云和统计分析**

- **当前阶段**: 验收展示 (stage_08_evaluate) - 已通过
- **年龄组**: 高中
- **时间预算**: 6h
- **技术栈**: Python + Streamlit + jieba + wordcloud
- **功能**: 词云可视化、数据统计、AI智能总结、导出报告
- **项目入口**: [up-video-analyzer](./up-video-analyzer/)

---

### 3. smart-todo-list - 智能待办清单

**自动排序优先级的待办App，AI帮你决定先做什么**

- **当前阶段**: 脑爆 (stage_01_brainstorm)
- **年龄组**: 13-15岁
- **时间预算**: 6h
- **技术栈**: Next.js + React + TypeScript
- **功能**: 任务管理、智能排序、优先级可视化
- **项目入口**: [smart-todo-list](./smart-todo-list/)

---

## 阶段状态说明

| 阶段 | 名称 | 说明 |
|------|------|------|
| stage_00_bootstrap | 初始化 | 项目创建，目录结构搭建 |
| stage_01_brainstorm | 脑爆 | 创意发散，选择项目方向 |
| stage_02_brief | 开题卡 | 确定目标、成功标准、风险 |
| stage_03_constraints | 范围裁剪 | 明确必须做/不做的事 |
| stage_04_track | 轨道选择 | 技术选型和资源确认 |
| stage_05_design | 设计蓝图 | UI设计、组件规划、验收用例 |
| stage_06_step_plan | 分步计划 | 里程碑和步骤拆解 |
| stage_07_execute | 执行开发 | 编码实现，记录日志 |
| stage_08_evaluate | 验收展示 | 测试验收，反思总结 |

---

## 目录结构说明

```
projects/
├── README.md                    # 本文件
├── my-first-ai-project/         # 文学知识卡项目
│   ├── src/                     # 源代码
│   ├── templates/               # HTML模板
│   ├── static/                  # 静态资源
│   ├── data/                    # 数据文件
│   ├── docs/                    # 项目文档
│   │   ├── README.md            # 文档索引
│   │   └── research/            # 研学文档
│   ├── SKILL_STATE.json         # 项目状态
│   └── README.md                # 项目说明
├── up-video-analyzer/           # 视频分析器项目
│   ├── docs/                    # 项目文档
│   │   ├── README.md            # 文档索引
│   │   └── research/            # 研学文档
│   ├── SKILL_STATE.json         # 项目状态
│   └── README.md                # 项目说明
└── smart-todo-list/             # 智能待办清单项目
    ├── docs/                    # 项目文档
    │   └── README.md            # 文档索引
    ├── SKILL_STATE.json         # 项目状态
    └── README.md                # 项目说明
```

---

## 快速开始

每个项目都有独立的 README 文件，请参考各项目目录下的 README 获取详细的安装和运行指南。

---

*最后更新: 2026-03-03*
