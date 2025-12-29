# fineSTEM

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

fineSTEM 是一个致力于为 7-10 年级学生提供 AI + 创意学习体系的教育项目。

## 项目结构

```
fineSTEM/
├── .trae/               # 项目文档和规则
├── apps/                # 应用代码
│   └── public-web/      # 公共网站
│       └── src/features/mvp/phase1/  # MVP 第一阶段
│           ├── backend/ # 后端 API
│           └── web/     # 前端应用
├── media/               # 媒体资源
├── pbl/                 # 项目式学习内容
├── references/          # 参考资料
├── scripts/             # 脚本工具
├── src/                 # 核心源代码
├── tests/               # 测试代码
├── docker-compose.yml   # Docker Compose 配置
├── nginx.conf           # Nginx 配置
├── deploy.sh            # Linux 部署脚本
├── start_production.bat # Windows 生产启动脚本
└── README.md            # 项目说明文档
```

## 技术栈

### 前端
- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router

### 后端
- FastAPI
- Python 3.9+
- Gunicorn + Uvicorn

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

> **注意**：本地开发不需要 Docker，直接运行即可。

#### 手动启动（可选）

##### 后端

```bash
# 进入后端目录
cd apps/public-web/src/features/mvp/phase1/backend

# 安装依赖（首次运行）
pip install -r requirements.txt

# 启动开发服务器（端口 8000）
uvicorn main:app --reload --port 8000
```

##### 前端

```bash
# 进入前端目录
cd apps/public-web/src/features/mvp/phase1/web

# 安装依赖（首次运行）
npm install

# 启动开发服务器（端口 5173）
npm run dev
```

### 服务器部署

本项目部署到腾讯云轻量应用服务器，使用 Docker 运行。详细部署步骤请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)。

**部署方式**：
- **服务器**：腾讯云 Lighthouse（北京地域）
- **容器化**：Docker + Docker Compose
- **访问地址**：`http://43.140.204.127/finestem/`

**多项目支持**：
- 服务器支持多个项目部署，通过路径区分
- fineSTEM 是服务器上的一个项目
- Track A、Track E 是 fineSTEM 内部的子页签，不是独立项目

## 部署说明

### 部署架构

```
本地开发环境（Windows）
├── start_system.bat 启动
│   ├── 后端：uvicorn main:app --reload --port 8000
│   └── 前端：npm run dev（端口 5173）
└── 不需要 Docker

服务器部署环境（腾讯云 Lighthouse）
├── Docker + Docker Compose
│   ├── 后端容器：FastAPI（端口 8000）
│   ├── 前端容器：Nginx（端口 8080）
│   └── 通过路径区分：/finestem/
└── 多项目支持
```

### 本地开发

**无需 Docker，直接运行**：

```bash
# 启动本地开发环境
start_system.bat
```

访问地址：
- 前端：http://localhost:5173
- 后端 API：http://localhost:8000
- 健康检查：http://localhost:8000/health

### 服务器部署

**使用 Docker 部署到腾讯云轻量应用服务器**：

#### 前提条件

- 已购买腾讯云轻量应用服务器
- 服务器已安装 Docker 和 Docker Compose
- 已配置好 DeepSeek API Key

#### 部署步骤

详细部署步骤请参考以下文档：

1. **部署综合报告**：[deploysettings/FineSTEM部署综合报告_20251229.md](./deploysettings/FineSTEM部署综合报告_20251229.md)
2. **部署模板**：[deploysettings/DEPLOYMENT_TEMPLATE.md](./deploysettings/DEPLOYMENT_TEMPLATE.md)
3. **多项目部署指南**：[deploysettings/MULTI_PROJECT_DEPLOYMENT.md](./deploysettings/MULTI_PROJECT_DEPLOYMENT.md)

#### 端口配置

**服务器端（Docker 容器）**：
- 后端容器：`8000:8000`
- 前端容器：`8080:80`

**访问路径**：
- 前端：`http://服务器IP/finestem/`
- 后端 API：`http://服务器IP/finestem/api`
- 健康检查：`http://服务器IP/health`

#### 环境变量

需要在 `docker-compose.yml` 或 `.env` 文件中配置：

```bash
# 必须配置的变量
DEEPSEEK_API_KEY=your-api-key-here

# 可选配置变量
PORT=8000
ROOT_PATH=/finestem/api
```

### 多项目部署

服务器支持部署多个项目，通过路径区分：

- 项目 1：`http://服务器IP/project1`
- 项目 2：`http://服务器IP/project2`
- fineSTEM：`http://服务器IP/finestem`

**重要说明**：
- Track A、Track E 是 fineSTEM 内部的子页签（React Router 路由）
- 不是服务器级别的独立项目
- 不需要为 track-a、track-e 分配独立容器或端口

详细多项目部署说明请参考 [MULTI_PROJECT_DEPLOYMENT.md](./deploysettings/MULTI_PROJECT_DEPLOYMENT.md)。

## 访问地址

### 本地开发

使用 `start_system.bat` 启动后：

- **前端应用**：http://localhost:5173 (Vite 开发服务器)
- **后端 API**：http://localhost:8000 (FastAPI 服务器)
- **健康检查**：http://localhost:8000/health

### 服务器部署（腾讯云 Lighthouse）

使用 Docker 部署到腾讯云后：

- **前端应用**：http://43.140.204.127/finestem/ (Nginx 容器)
- **后端 API**：http://43.140.204.127/finestem/api (FastAPI 容器)
- **健康检查**：http://43.140.204.127/health

**多项目部署路径**：
- 项目 1：http://43.140.204.127/project1
- 项目 2：http://43.140.204.127/project2
- fineSTEM：http://43.140.204.127/finestem

**fineSTEM 内部子页签**：
- 主页：http://43.140.204.127/finestem/
- Track A：http://43.140.204.127/finestem/track-a
- Track E：http://43.140.204.127/finestem/track-e

> **注意**：
> - 本地开发不需要 Docker，直接运行即可
> - 服务器部署使用 Docker，通过路径前缀区分不同项目
> - Track A、Track E 是 fineSTEM 的内部路由，不是独立项目
>
> 详细部署步骤请参考 [DEPLOYMENT.md](./DEPLOYMENT.md) 和 [deploysettings/FineSTEM部署综合报告_20251229.md](./deploysettings/FineSTEM部署综合报告_20251229.md)

## 日志管理

### 本地开发日志

使用 `start_system.bat` 启动后，日志会显示在对应的终端窗口：

- **后端日志**：显示在"FineSTEM Backend"终端窗口
- **前端日志**：显示在"FineSTEM Frontend"终端窗口
- **调试日志**：使用浏览器开发者工具（F12）查看前端运行日志

### 服务器部署日志（Docker）

在服务器上使用 Docker Compose 管理日志：

```bash
# 查看所有容器日志
docker compose logs -f

# 查看后端服务日志
docker compose logs -f backend

# 查看前端服务日志
docker compose logs -f frontend

# 查看最近 100 行日志
docker compose logs --tail=100

# 查看指定时间范围的日志
docker compose logs --since="2024-12-29T00:00:00" --until="2024-12-29T23:59:59"
```

### 日志文件位置（服务器部署）

Docker Compose 使用命名卷持久化日志：

- 后端日志：`finestem-logs:/app/logs`
- 前端日志：`finestem-logs:/var/log/nginx`

在服务器上查看卷详细信息：

```bash
docker volume inspect fineSTEM_finestem-logs
```

## 维护命令

### 本地开发维护

```bash
# 停止本地开发环境
# 直接关闭启动的终端窗口，或按 Ctrl+C

# 重新启动
# 重新运行 start_system.bat

# 清理（可选）
# 删除后端虚拟环境、node_modules 等
```

### 服务器部署维护（Docker）

#### Docker 服务管理

```bash
# 停止服务
docker compose down

# 重启服务
docker compose restart

# 查看服务状态
docker compose ps

# 查看服务资源使用情况
docker compose stats

# 重新构建并启动
docker compose up -d --build

# 停止并删除所有容器、网络、卷（谨慎使用）
docker compose down -v
```

#### 容器管理

```bash
# 进入后端容器
docker compose exec backend bash

# 进入前端容器
docker compose exec frontend sh

# 查看容器详细信息
docker compose inspect backend
docker compose inspect frontend

# 清理未使用的镜像和卷
docker image prune -a
docker volume prune
```

### 多项目部署支持

服务器支持部署多个项目，通过路径区分：

**架构说明**：
- 每个项目有独立的容器、独立的端口
- 服务器级别通过路径区分不同项目（`/project1`、`/project2`、`/finestem`）
- 项目内部通过 React Router 区分子页签（`/track-a`、`/track-e`）

**部署多个项目**：

1. 为每个项目修改 `docker-compose.yml` 中的端口映射：
   ```yaml
   services:
     backend:
       ports:
         - "8001:8000"  # project1 后端
     frontend:
       ports:
         - "8081:80"     # project1 前端
   ```

2. 修改 Nginx 配置，添加路径分发规则

3. 启动不同项目：
   ```bash
   # 启动 project1
   docker compose -p project1 up -d

   # 启动 project2
   docker compose -p project2 up -d

   # 启动 finestem
   docker compose -p finestem up -d
   ```

详细多项目部署说明请参考 [deploysettings/MULTI_PROJECT_DEPLOYMENT.md](./deploysettings/MULTI_PROJECT_DEPLOYMENT.md)。

## 更新日志 (Changelog)

### [v1.0.0-mvp-phase1-release] - 2025-12-29

#### 新增功能
- 集成 DeepSeek API Key 支持，实现 AI 功能
- Track A、Track E 功能在本地和服务端均可稳定运行
- 初步支持服务端多项目部署，不同项目使用不同端口
- 后端 API 路径配置优化（`/finestem/api`）

#### 技术改进
- 优化 Docker Compose 配置，支持多实例部署
- 完善部署文档和脚本，提供标准版/简洁版/重建版部署 prompt
- 添加 Git 标签标准规范文档
- 后端健康检查和容器健康检查机制完善

#### 部署配置
- 前端容器：端口 8080，访问路径 `/finestem/`
- 后端容器：端口 8000，API 路径 `/finestem/api`
- 健康检查：`http://localhost:8000/health`

#### 详细发布说明
查看完整版本说明，请运行：
```bash
git show v1.0.0-mvp-phase1-release
```
或访问 GitHub Releases 页面。

---

## 许可证 (License)

本项目采用 **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)** 许可证。

这意味着您可以：
*   **共享** — 在任何媒介以任何形式复制、发行本作品。
*   **演绎** — 修改、转换或以本作品为基础进行创作。

只要您遵守以下条件：
*   **署名** — 您必须给出适当的署名，提供指向本许可协议的链接，同时标明是否（对原始作品）作了修改。
*   **非商业性使用** — 您不得将本作品用于商业目的。
*   **相同方式共享** — 如果您再混合、转换或者基于本作品进行创作，您必须基于与原先许可协议相同的许可协议分发您贡献的作品。

查看 [LICENSE](./LICENSE) 文件以获取完整的许可证文本。
