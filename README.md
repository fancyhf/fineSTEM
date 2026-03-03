# fineSTEM

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

fineSTEM 是一个致力于为 7-10 年级学生提供 AI + 创意学习体系的教育项目。

## 项目结构

```
fineSTEM/
├── apps/                        # 独立应用
│   └── public-web/              # 对外公众网站 (MVP 核心)
│       └── src/features/mvp/phase1/  # 第一阶段 MVP 代码
│           ├── backend/         # FastAPI 后端服务
│           └── web/             # React 前端应用
├── .trae/                       # 规则、文档与配置
│   ├── documents/               # 项目文档统一归档
│   ├── rules/                   # 自动化规则
│   └── skills/                  # AI 编程导师 Skill
│       └── stem-pbl-guide/       # STEM项目式学习导师（详见下方介绍）
├── deploy/                      # 部署脚本与指南
├── deploysettings/              # 部署配置文件
├── server/                      # 服务器运维脚本 (Nginx 等)
├── maintain/                    # 维护文档
├── projects/                    # STEM PBL Guide 生成的 Demo 案例项目
├── references/                  # 参考资料
└── README.md                    # 项目说明文档
```

## 技术栈

### 前端 (MVP Phase 1)
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Matter.js (物理引擎)
- ECharts (数据可视化)

### 后端 (MVP Phase 1)
- FastAPI
- Python 3.12+
- Pandas / NumPy
- Uvicorn / Gunicorn

### 部署
- Docker + Docker Compose
- Nginx

## 快速开始

### 本地开发

#### 快速启动（推荐）

使用提供的启动脚本快速启动本地开发环境：

```bash
# Windows
start_system.bat

# 脚本将自动：
# 1. 启动后端服务器（端口 8000）
# 2. 启动前端开发服务器（端口 5173）
# 3. 在浏览器中打开 http://localhost:5173
```

#### 手动启动

**后端**

```bash
cd apps/public-web/src/features/mvp/phase1/backend
# 安装依赖
pip install -r requirements.txt
# 启动
uvicorn main:app --reload --port 8000
```

**前端**

```bash
cd apps/public-web/src/features/mvp/phase1/web
# 安装依赖
npm install
# 启动
npm run dev
```

## 部署说明

详细部署指南请参考 [deploy/README.md](deploy/README.md) 及 [deploysettings/](deploysettings/) 下的相关文档。

## Demo 案例项目

`projects/` 目录存放由 **STEM PBL Guide** 生成的 Demo 案例项目，展示了 STEM 项目式学习(PBL)的完整流程。这些项目可作为学生学习和参考的范例。

目前包含以下案例：
- **文学知识卡** - 二次元漫画风格的古诗词学习应用
- **UP主视频内容分析器** - AI自动生成词云和统计分析
- **智能待办清单** - 自动排序优先级的待办App

详细信息请参考 [projects/README.md](projects/README.md)

## AI 编程导师 Skill

fineSTEM 包含一套专为 10-18 岁学生设计的 STEM 项目式学习 (PBL) 导师 Skill，位于 `.trae/skills/stem-pbl-guide/`。

### 功能特点

- **9 阶段项目流程** - 从选题脑爆到验收展示的完整项目开发指导
- **4 种代码教学模式** - 引导式（填空）、演示式（模仿）、动手式（试错）、讲解式（先讲原理）
- **研学文档自动生成** - 开题报告、需求文档、技术报告、结题报告、论文（可选）
- **对话式交互** - 像导师一样聊天，不是冷冰冰的问答
- **多项目支持** - 每个项目独立工作区，互不干扰

### 快速使用

在 AI 对话中说出以下触发语即可启动：

```
"我想做一个项目"      # 创建新项目
"给我选题"            # 开始脑爆选题
"写代码"              # 进入编码阶段
"讲解一下原理"        # 切换到讲解式教学模式
"写开题报告"          # 生成研学文档
```

详细使用指南请参考：[.trae/skills/stem-pbl-guide/README.md](.trae/skills/stem-pbl-guide/README.md)

---

## 许可证 (License)

本项目采用 [CC BY-NC-SA 4.0](LICENSE) 许可证。
