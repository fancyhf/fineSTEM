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
│   └── rules/                   # 自动化规则
├── deploy/                      # 部署脚本与指南
├── deploysettings/              # 部署配置文件
├── server/                      # 服务器运维脚本 (Nginx 等)
├── maintain/                    # 维护文档
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

## 许可证 (License)

本项目采用 [CC BY-NC-SA 4.0](LICENSE) 许可证。
