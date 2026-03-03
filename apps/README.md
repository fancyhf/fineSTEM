# Applications - 项目体验中心

此目录是 fineSTEM 的**应用端入口**，为孩子提供可直接体验的 STEM 项目集合。

## 定位与目标

fineSTEM Apps 是一个**互动式项目展示平台**，让孩子：
- 直接体验完整的 STEM 项目，无需配置开发环境
- 通过可视化界面了解代码如何运作
- 在互动中学习编程思维和 STEM 知识

## 当前阶段：MVP 1

### [public-web](./public-web/) - 公众网站

MVP 1 阶段的核心体验平台，包含三个互动模块：

| 模块 | 功能 | 学习目标 |
|------|------|---------|
| **物理模拟 (Track A)** | Matter.js 物理沙盒 | 理解物理原理、力学概念 |
| **数据分析 (Track E)** | ECharts 数据可视化 | 学习数据思维、图表解读 |
| **AI 助手** | LLM 智能对话 | 获得实时学习指导 |

**技术实现：**
- 前端：React 18 + TypeScript + Vite + Tailwind CSS
- 后端：FastAPI + Python 3.12+
- 物理引擎：Matter.js
- 数据可视化：ECharts

## 未来规划

Apps 将逐步集成 `projects/` 目录下的案例项目，形成完整的项目体验库：

```
Apps 体验中心
├── MVP 1 (当前)
│   ├── 物理模拟模块
│   ├── 数据分析模块
│   └── AI 助手
│
├── MVP 2 (规划中)
│   ├── 文学知识卡 - 古诗词学习应用
│   ├── UP主视频分析器 - 词云生成工具
│   └── 智能待办清单 - 优先级管理App
│
└── 持续扩展...
    └── 更多 projects/ 下的案例项目
```

## 目录结构

```
apps/
└── public-web/              # MVP 1 体验平台
    ├── src/
    │   └── features/
    │       └── mvp/
    │           └── phase1/
    │               ├── backend/  # FastAPI 后端服务
    │               │   ├── routers/   # API 路由
    │               │   ├── models/    # 数据模型
    │               │   └── data/      # 本地数据存储
    │               └── web/      # React 前端应用
    │                   ├── src/
    │                   │   ├── pages/      # 体验页面
    │                   │   ├── components/ # 互动组件
    │                   │   └── hooks/      # 交互逻辑
    │                   └── dist/       # 构建产物
    └── README.md
```

## 快速体验

### 本地启动

```bash
# Windows 一键启动
start_system.bat

# 自动启动：
# - 后端服务（端口 8000）
# - 前端应用（端口 5173）
# - 浏览器打开 http://localhost:5173
```

### 手动启动

**后端：**
```bash
cd apps/public-web/src/features/mvp/phase1/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**前端：**
```bash
cd apps/public-web/src/features/mvp/phase1/web
npm install
npm run dev
```

## 与 projects/ 的关系

| 目录 | 定位 | 目标用户 |
|------|------|---------|
| **apps/** | 项目体验中心 | 小学生、体验者 |
| **projects/** | 案例源码库 | 中学生、开发者 |

- `projects/` 存放完整的案例项目源码，适合中学生学习开发流程
- `apps/` 将这些项目转化为可互动体验的版本，适合小学生直接体验

## 相关链接

- [案例项目源码](../../projects/README.md) - 查看完整的项目代码
- [AI 编程导师](../../SKILLs/README.md) - 开始自己的项目开发
- [部署指南](../../deploy/README.md) - 部署到生产环境
