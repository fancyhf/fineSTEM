# fineSTEM

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

fineSTEM 面向小学到高中的孩子，为孩子们提供自助式、PBL式、伴学式的STEM和AI编程的体验，这是一个 AI + 创意学习体系的教育项目。

项目为不同学段的孩子提供差异化的**学习路径**：
- **中学生**：使用 AI 编程导师 SKILLs，在 AI IDE 中自主完成 STEM 项目；也可参考 projects 目录中的完整案例。
- **小学生**：通过 apps 互动网页，在可视化界面中体验编程乐趣，无需配置开发环境。

---

## 项目体验中心 (Apps)

fineSTEM Apps 是**互动式项目展示平台**，让孩子直接体验 STEM 项目，无需配置开发环境。

### 当前阶段：MVP 1

[public-web](apps/public-web/) 提供三个互动模块：
- **物理模拟** - Matter.js 物理沙盒，理解物理原理
- **数据分析** - ECharts 数据可视化，学习数据思维
- **AI 助手** - LLM 智能对话，获得实时指导

### 未来规划

Apps 将逐步集成 `projects/` 下的案例项目，形成完整的项目体验库。

详细信息请参考 [apps/README.md](apps/README.md)

---

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

## Sample 案例项目

`projects/` 目录存放由 **STEM PBL Guide** 生成的 sample 案例项目，展示了 STEM 项目式学习(PBL)的完整流程。这些项目可作为学生学习和参考的范例。

### 快速启动案例项目

```bash
# Windows
# 文学知识卡 (端口 4001)
cd projects/my-first-ai-project && start.bat

# UP主视频分析器 (端口 4002)
cd projects/up-video-analyzer && start.bat

# 智能待办清单 (端口 4003)
cd projects/smart-todo-list && start.bat
```

```bash
# Linux/macOS
# 文学知识卡 (端口 4001)
cd projects/my-first-ai-project && ./start.sh

# UP主视频分析器 (端口 4002)
cd projects/up-video-analyzer && ./start.sh

# 智能待办清单 (端口 4003)
cd projects/smart-todo-list && ./start.sh
```

### 案例项目列表

| 项目 | 说明 | 技术栈 | 端口 | 状态 |
|------|------|--------|------|------|
| **文学知识卡** | 二次元漫画风格的古诗词学习应用 | Python Flask | 4001 | 已完成 |
| **UP主视频内容分析器** | AI自动生成词云和统计分析 | Python Streamlit | 4002 | 已完成 |
| **智能待办清单** | 自动排序优先级的待办App | HTML/JS | 4003 | 已完成 |

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
├── projects/                     # 学生案例项目
│   ├── my-first-ai-project/    # 文学知识卡 (端口 4001)
│   ├── up-video-analyzer/       # UP主视频分析器 (端口 4002)
│   └── smart-todo-list/        # 智能待办清单 (端口 4003)
└── deploysettings/               # 部署配置
    ├── PORT_REGISTRY.json        # 端口分配登记表
    └── README.md               # 部署配置说明
```

---

## 快速启动

### Apps 启动

```bash
# 启动 public-web 后端 (端口 8001)
cd apps/public-web/src/features/mvp/phase1/backend
./start.sh    # Linux/macOS
# 或
start.ps1    # Windows

# 启动 public-web 前端 (端口 5174/8081)
cd apps/public-web/src/features/mvp/phase1/web
./start.sh    # Linux/macOS
# 或
start.ps1    # Windows
```

### Projects 启动

```bash
# 启动文学知识卡 (端口 4001)
cd projects/my-first-ai-project
./start.sh    # Linux/macOS
# 或
start.bat    # Windows

# 启动 UP主视频分析器 (端口 4002)
cd projects/up-video-analyzer
./start.sh    # Linux/macOS
# 或
start.bat    # Windows

# 启动智能待办清单 (端口 4003)
cd projects/smart-todo-list
./start.sh    # Linux/macOS
# 或
start.bat    # Windows
```

---

## 端口分配

为了端口管理的清晰和避免冲突，fineSTEM 使用以下端口范围：

| 应用类型 | 端口范围 | 说明 |
|---------|---------|------|
| Apps (生产/演示) | 8000-8999 | public-web 等正式应用 |
| Projects (开发/测试) | 4000-4999 | 学生案例项目 |

### 当前端口分配

| 端口 | 服务 | 说明 | 健康检查 |
|-------|------|------|----------|
| 8001 | public-web-backend | 后端 API | http://localhost:8001/api/health |
| 8081 | public-web-frontend | 前端 Web | http://localhost:8081/health |
| 4001 | my-first-ai-project | 文学知识卡 | http://localhost:4001 |
| 4002 | up-video-analyzer | 视频分析器 | http://localhost:4002 |
| 4003 | smart-todo-list | 智能待办清单 | http://localhost:4003 |

**注意**：分配新端口前，请先检查端口是否被占用，并更新 `deploysettings/PORT_REGISTRY.json`。

详细信息请参考 [deploysettings/README.md](deploysettings/README.md)

详细部署指南请参考 [deploy/README.md](deploy/README.md) 及 [deploysettings/](deploysettings/) 下的相关文档。

---

## 许可证 (License)

本项目采用 [CC BY-NC-SA 4.0](LICENSE) 许可证。
