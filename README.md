# fineSTEM

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

fineSTEM 面向小学到高中的孩子，为孩子们提供自助式、PBL式、伴学式的STEM和AI编程的体验，这是一个 AI + 创意学习体系的教育项目。
项目给不同学段少年儿童不同的**体验入口**：
- **中学生**：可以直接通过 SKILLs 开始 STEM 项目，或者查看 projects 目录中的 demo 案例项目。
- **小学生**：可以通过 app 的网页来体验。

---

## 应用项目 (Apps)

fineSTEM 提供面向小学生的网页应用，通过直观、互动的界面让 younger learners 轻松体验 STEM 和 AI 编程的乐趣。

### 核心应用
- **公众网站 (public-web)**：面向小学生的互动学习平台，提供可视化编程、趣味实验和项目展示功能。

详细信息请参考 [apps/public-web/README.md](apps/public-web/README.md)

## AI 编程导师 Skills

fineSTEM 提供开源的 AI 编程导师 Skill 集合，帮助学生在任何 AI IDE 中获得个性化的项目指导。

### 兼容性

| AI IDE | 兼容性 | 说明 |
|--------|--------|------|
| **Trae IDE** | 完全兼容 | 原生支持 |
| **Cursor** | 兼容 | 作为系统提示 |
| **Windsurf** | 兼容 | 作为系统提示 |
| **VS Code + Copilot** | 兼容 | 作为上下文 |
| **其他 AI IDE** | 基本兼容 | 复制粘贴即可 |

### 快速使用

**最简单方式** - 复制粘贴：
1. 打开 [SKILLs/stem-pbl-guide/SKILL.md](./SKILLs/stem-pbl-guide/SKILL.md)
2. 复制全部内容
3. 粘贴到你的 AI IDE 对话框
4. 开始对话

**触发语**：
```
"我想做一个项目"      # 创建新项目
"给我选题"            # 开始脑爆选题
"写代码"              # 进入编码阶段
```

### 功能特点

- **9 阶段项目流程** - 从选题脑爆到验收展示
- **4 种代码教学模式** - 引导式、演示式、动手式、讲解式
- **研学文档自动生成** - 开题报告、技术报告、结题报告
- **对话式交互** - 像导师一样聊天

详细使用指南：[SKILLs/README.md](./SKILLs/README.md)

---

## Demo 案例项目

`projects/` 目录存放由 **STEM PBL Guide** 生成的 Demo 案例项目，展示了 STEM 项目式学习(PBL)的完整流程。这些项目可作为学生学习和参考的范例。

目前包含以下案例：
- **文学知识卡** - 二次元漫画风格的古诗词学习应用
- **UP主视频内容分析器** - AI自动生成词云和统计分析
- **智能待办清单** - 自动排序优先级的待办App

详细信息请参考 [projects/README.md](projects/README.md)

---


## 项目结构

```
fineSTEM/
├── SKILLs/                      # AI 编程导师 Skill 集合（对外发布）
│   ├── stem-pbl-guide/          # STEM 项目式学习导师
│   ├── install.ps1              # Windows 安装脚本
│   ├── install.sh               # macOS/Linux 安装脚本
│   └── README.md                # Skill 使用指南
├── .trae/                       # Trae IDE 配置
│   ├── documents/               # 项目文档统一归档
│   ├── rules/                   # 自动化规则
│   └── skills/                  # AI 编程导师 Skill（开发版）
│       └── stem-pbl-guide/      # STEM项目式学习导师
├── apps/                        # 独立应用
│   └── public-web/              # 对外公众网站 (MVP 核心)
│       └── src/features/mvp/phase1/  # 第一阶段 MVP 代码
│           ├── backend/         # FastAPI 后端服务
│           └── web/             # React 前端应用
├── deploy/                      # 部署脚本与指南
├── deploysettings/              # 部署配置文件
├── server/                      # 服务器运维脚本 (Nginx 等)
├── maintain/                    # 维护文档
├── projects/                    # STEM PBL Guide 生成的 Demo 案例项目
├── references/                  # 参考资料
└── README.md                    # 项目说明文档
```

---

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

---

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

---

## 部署说明

详细部署指南请参考 [deploy/README.md](deploy/README.md) 及 [deploysettings/](deploysettings/) 下的相关文档。

---

## 许可证 (License)

本项目采用 [CC BY-NC-SA 4.0](LICENSE) 许可证。
