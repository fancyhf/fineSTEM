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

### 开发环境启动

使用提供的启动脚本快速启动开发环境：

```bash
# Windows
start_system.bat

# Linux/Mac
# 目前仅支持通过 Docker 启动开发环境
```

### 手动启动

#### 后端

```bash
# 进入后端目录
cd apps/public-web/src/features/mvp/phase1/backend

# 安装依赖
pip install -r requirements.txt

# 启动开发服务器
uvicorn main:app --reload --port 8001
```

#### 前端

```bash
# 进入前端目录
cd apps/public-web/src/features/mvp/phase1/web

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 部署说明

### 前提条件

- Docker 和 Docker Compose 已安装
- 域名已注册并指向服务器 IP（用于互联网部署）
- 开放必要端口：80（HTTP）、443（HTTPS，可选）

### 环境变量配置

1. 配置后端环境变量：
   ```bash
   cp apps/public-web/src/features/mvp/phase1/backend/.env.example apps/public-web/src/features/mvp/phase1/backend/.env.production
   # 编辑 .env.production 文件，配置 API 密钥等
   ```

2. 配置前端环境变量：
   ```bash
   cp apps/public-web/src/features/mvp/phase1/web/.env.production.example apps/public-web/src/features/mvp/phase1/web/.env.production
   # 编辑 .env.production 文件，配置 API 地址等
   ```

### 使用 Docker Compose 部署

#### Linux/Mac

```bash
# 赋予脚本执行权限
chmod +x deploy.sh

# 执行部署脚本
./deploy.sh
```

#### Windows

```bash
# 双击运行或在命令行执行
start_production.bat
```

### 手动部署

#### 构建前端

```bash
cd apps/public-web/src/features/mvp/phase1/web
npm install
npm run build
# 构建产物将生成在 dist 目录
```

#### 部署后端

```bash
cd apps/public-web/src/features/mvp/phase1/backend
pip install -r requirements.txt gunicorn
gunicorn -c gunicorn.conf.py -k uvicorn.workers.UvicornWorker main:app --daemon
```

#### 配置 Nginx

```bash
# 将 nginx.conf 复制到 Nginx 配置目录
cp nginx.conf /etc/nginx/sites-available/finestem

# 创建符号链接
sudo ln -s /etc/nginx/sites-available/finestem /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx
```

## 访问地址

部署完成后，可以通过以下地址访问：

- 前端应用：http://localhost:80 或 https://your-domain.com
- 后端 API：http://localhost:8000/api 或 https://your-domain.com/api
- 健康检查：http://localhost:80/health 或 https://your-domain.com/health

## 日志管理

```bash
# 查看 Docker 容器日志
docker-compose logs -f

# 查看后端应用日志
docker-compose logs -f backend

# 查看前端应用日志
docker-compose logs -f frontend
```

## 维护命令

```bash
# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看服务状态
docker-compose ps
```

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
