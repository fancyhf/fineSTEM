# 智能待办清单 - Smart Todo List

## 项目状态

| 属性 | 值 |
|------|-----|
| 当前阶段 | stage_08_evaluate (验收展示) |
| 阶段状态 | completed |
| 年龄组 | 13-15岁 |
| 时间预算 | 6h |
| 项目锁定 | 是 |

### 阶段进度

| 阶段 | 状态 |
|------|------|
| stage_00_bootstrap 初始化 | 已通过 |
| stage_01_brainstorm 脑爆 | 已通过 |
| stage_02_brief 开题卡 | 已通过 |
| stage_03_constraints 范围裁剪 | 已通过 |
| stage_04_track 轨道选择 | 已通过 |
| stage_05_design 设计蓝图 | 已通过 |
| stage_06_step_plan 分步计划 | 已通过 |
| stage_07_execute 执行开发 | 已通过 |
| stage_08_evaluate 验收展示 | 已通过 |

---

## 项目介绍

自动排序优先级的待办App，AI帮你决定先做什么。

这是一个使用 HTML/JS 开发的智能待办清单应用，适合初中生学习 Web 开发。应用会根据任务的重要性、紧急程度和截止日期自动计算优先级并排序。

## 核心功能

- 任务管理: 添加、编辑、删除、标记完成任务
- 智能排序: 基于截止日期、重要性、紧急程度自动排序
- 优先级可视化: 用颜色和标签直观显示任务优先级
- 本地存储: 数据保存在浏览器本地，刷新不丢失
- 统计面板: 显示待办和已完成任务数量

## 技术栈

- 前端: HTML5 + CSS3 + JavaScript (原生)
- 样式: CSS 渐变背景 + 卡片式布局
- 存储: LocalStorage
- 部署: Python HTTP Server

## 快速开始

### 方式一：使用启动脚本（推荐）

**Windows:**
```bash
start.bat
```

**Linux/macOS:**
```bash
./start.sh
```

### 方式二：手动运行

```bash
# 进入源码目录
cd src

# 启动 HTTP 服务器
python -m http.server 4003
```

### 访问应用

在浏览器中打开: http://localhost:4003

## 项目结构

```
smart-todo-list/
├── src/                    # 源代码
│   ├── index.html         # 主页面 (单页应用)
│   └── app/               # Next.js 版本 (可选)
│       ├── layout.tsx
│       ├── page.tsx
│       └── page.module.css
├── docs/                   # 项目文档
│   ├── 00_brainstorm.md   # 脑爆记录
│   └── 01_project_brief.json # 项目立项书
├── start.bat              # Windows启动脚本
├── start.sh               # Linux/macOS启动脚本
├── package.json           # Node.js配置 (可选)
├── next.config.js         # Next.js配置 (可选)
├── tsconfig.json          # TypeScript配置 (可选)
├── SKILL_STATE.json       # 项目状态管理
└── README.md              # 本文件
```

## 使用说明

### 添加任务

1. 点击 "+ Add New Task" 按钮
2. 填写任务标题（必填）
3. 可选：填写描述、截止日期
4. 选择重要性和紧急程度
5. 点击 "Add Task" 保存

### 完成任务

- 点击任务卡片左侧的复选框标记完成
- 已完成的任务会自动移到底部

### 删除任务

- 点击任务卡片右上角的 "Delete" 按钮

### 优先级说明

应用会自动计算优先级分数：
- **High (红色)**: 分数 ≥ 70，高重要性或高紧急度，或即将到期
- **Medium (橙色)**: 分数 ≥ 40，中等优先级
- **Low (绿色)**: 分数 < 40，低优先级

优先级计算因素：
- 重要性权重: High=30分, Medium=20分, Low=10分
- 紧急度权重: High=30分, Medium=20分, Low=10分
- 截止日期加成: 1天内+50分, 3天内+30分, 7天内+10分

## 学习目标

- 掌握 HTML/CSS/JavaScript 基础
- 理解浏览器 LocalStorage 本地存储
- 学习优先级算法设计
- 体验响应式网页设计
- 实践完整的 Web 应用开发流程

## 扩展方向

- 添加任务分类标签
- 实现任务编辑功能
- 添加任务搜索和筛选
- 实现数据导出功能
- 添加任务提醒通知
- 支持多设备同步

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

---

## 文档入口

详细文档请查看 [docs/README.md](./docs/README.md)

---

*创建时间: 2026-02-27*
*最后更新: 2026-03-06*
