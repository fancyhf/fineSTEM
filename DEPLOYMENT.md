# FineSTEM MVP 部署文档

## 1. 部署计划概述

### 1.1 项目目标
将 FineSTEM MVP 部署为可访问的互联网应用，确保系统稳定运行，支持用户访问和使用。

### 1.2 部署架构
- **前端**：React 静态文件，部署到 Nginx
- **后端**：FastAPI 服务，使用 Gunicorn + Uvicorn
- **反向代理**：Nginx 处理静态文件和 API 转发
- **容器化**：Docker + Docker Compose 实现一键部署

### 1.3 技术栈
- 前端：React 18 + TypeScript + Vite
- 后端：FastAPI + Python 3.9+
- 部署：Docker + Docker Compose + Nginx

## 2. 已完成的部署准备工作

### 2.1 后端部署文件
| 文件名 | 说明 | 位置 |
|--------|------|------|
| Dockerfile | 后端 Docker 镜像配置 | apps/public-web/src/features/mvp/phase1/backend/ |
| gunicorn.conf.py | Gunicorn 生产服务器配置 | apps/public-web/src/features/mvp/phase1/backend/ |
| .env.production | 后端生产环境变量配置 | apps/public-web/src/features/mvp/phase1/backend/ |

### 2.2 前端部署文件
| 文件名 | 说明 | 位置 |
|--------|------|------|
| Dockerfile | 前端 Docker 镜像配置 | apps/public-web/src/features/mvp/phase1/web/ |
| nginx.conf | 前端 Nginx 配置 | apps/public-web/src/features/mvp/phase1/web/ |
| .env.production | 前端生产环境变量配置 | apps/public-web/src/features/mvp/phase1/web/ |
| .env.production.example | 前端环境变量配置示例 | apps/public-web/src/features/mvp/phase1/web/ |

### 2.3 项目级部署文件
| 文件名 | 说明 | 位置 |
|--------|------|------|
| docker-compose.yml | Docker Compose 配置 | 项目根目录 |
| nginx.conf | 项目级 Nginx 反向代理配置 | 项目根目录 |
| deploy.sh | Linux 自动化部署脚本 | 项目根目录 |
| start_production.bat | Windows 生产环境启动脚本 | 项目根目录 |

### 2.4 更新的文档
| 文件名 | 说明 | 位置 |
|--------|------|------|
| README.md | 添加了部署说明和快速开始指南 | 项目根目录 |

## 3. 互联网部署步骤

### 3.1 前置准备

#### 3.1.1 服务器准备
1. **选择云服务器**：推荐使用阿里云、腾讯云或 AWS 等主流云服务商
2. **操作系统**：Ubuntu 20.04 LTS 或 CentOS 7+
3. **配置要求**：
   - CPU：2核或以上
   - 内存：4GB或以上
   - 磁盘：40GB SSD
4. **安全组配置**：
   - 开放端口 80（HTTP）
   - 开放端口 443（HTTPS，推荐）
   - 开放端口 22（SSH，用于远程管理）

#### 3.1.2 域名准备
1. **注册域名**：在域名注册商处注册您的域名（如 finestem.example.com）
2. **DNS 配置**：将域名 A 记录指向您的服务器公网 IP

#### 3.1.3 环境安装
在服务器上安装以下软件：

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y docker.io docker-compose curl

# CentOS
sudo yum update
sudo yum install -y docker docker-compose curl
sudo systemctl start docker
sudo systemctl enable docker
```

### 3.2 部署实施

#### 3.2.1 获取项目代码

```bash
# 克隆项目代码到服务器
git clone https://github.com/fancyhf/fineSTEM.git
cd finestem
```

#### 3.2.2 配置环境变量

1. **配置后端环境变量**：

```bash
cp apps/public-web/src/features/mvp/phase1/backend/.env.production.example apps/public-web/src/features/mvp/phase1/backend/.env.production
# 编辑环境变量文件
nano apps/public-web/src/features/mvp/phase1/backend/.env.production
```

主要配置项：
- `DEEPSEEK_API_KEY`：您的 DeepSeek API 密钥
- `PORT`：后端服务端口（默认 8000）
- `ALLOWED_ORIGINS`：允许的前端域名，如 `https://finestem.example.com`
- `LOG_LEVEL`：日志级别（推荐生产环境使用 INFO）

2. **配置前端环境变量**：

```bash
cp apps/public-web/src/features/mvp/phase1/web/.env.production.example apps/public-web/src/features/mvp/phase1/web/.env.production
# 编辑环境变量文件
nano apps/public-web/src/features/mvp/phase1/web/.env.production
```

主要配置项：
- `VITE_API_BASE_URL`：后端 API 地址，如 `https://finestem.example.com/api`
- `VITE_APP_NAME`：应用名称
- `VITE_ENV`：环境标识（production）

#### 3.2.3 配置 Nginx

编辑项目根目录下的 `nginx.conf` 文件，更新域名配置：

```bash
nano nginx.conf
```

将 `server_name finestem.example.com;` 替换为您的实际域名。

#### 3.2.4 执行部署

**方法一：标准部署（推荐）**
```bash
# 赋予脚本执行权限
chmod +x deploy.sh

# 执行部署脚本
./deploy.sh
```

**方法二：快速部署（网络优化版）**
```bash
# 如果遇到网络问题，使用快速部署脚本
chmod +x quick-deploy.sh
./quick-deploy.sh
```

**部署前准备（如果从Windows上传文件）**
```bash
# 修复Windows换行符问题
chmod +x fix-line-endings.sh
./fix-line-endings.sh
```

部署脚本会自动完成以下操作：
1. 检查 Docker 和 Docker Compose 依赖
2. 检查环境变量配置
3. 停止并移除旧容器
4. 构建新镜像
5. 启动新容器
6. 执行健康检查

#### 3.2.5 配置 SSL 证书（推荐）

使用 Let's Encrypt 获取免费 SSL 证书：

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d finestem.example.com

# 配置自动续订
sudo certbot renew --dry-run
```

Certbot 会自动更新 Nginx 配置，启用 HTTPS。

### 3.3 验证部署

1. **访问前端应用**：在浏览器中访问 `https://finestem.example.com`
2. **检查 API 健康状态**：访问 `https://finestem.example.com/api/health`，应返回 `OK`
3. **查看服务状态**：

```bash
docker-compose ps
```

4. **查看日志**：

```bash
docker-compose logs -f
```

## 4. 维护和监控

### 4.1 日常维护

1. **查看服务状态**：
   ```bash
   docker-compose ps
   ```

2. **查看日志**：
   ```bash
   # 查看所有日志
   docker-compose logs -f
   
   # 查看特定服务日志
   docker-compose logs -f backend
   docker-compose logs -f frontend
   ```

3. **重启服务**：
   ```bash
   docker-compose restart
   ```

4. **更新代码和重启**：
   ```bash
   git pull
   ./deploy.sh
   ```

### 4.2 监控配置

#### 4.2.1 服务器监控

- 使用云服务商提供的监控服务（如阿里云云监控、腾讯云监控）
- 或安装第三方监控工具（如 Prometheus + Grafana）

#### 4.2.2 应用监控

- 配置日志收集和分析（如 ELK Stack、Loki + Grafana）
- 实现应用性能监控（如 New Relic、Datadog）

### 4.3 备份策略

1. **数据备份**：定期备份应用数据和配置文件
2. **镜像备份**：定期保存 Docker 镜像到私有仓库
3. **配置备份**：将环境变量配置文件备份到安全位置

## 5. 常见问题解决

### 5.1 网络和镜像构建问题

#### 5.1.1 Debian镜像源404错误
**错误**：`Failed to fetch http://deb.debian.org/debian/dists/trixie/main/binary-amd64/Packages 404 Not Found`

**解决方案**：
1. 使用稳定的镜像版本（已在Dockerfile中修复）
2. 配置国内镜像源加速下载
3. 如果仍有问题，可以手动修改Dockerfile中的镜像源

#### 5.1.2 pip安装依赖失败
**错误**：网络超时或连接失败

**解决方案**：
1. 配置pip国内镜像源（已在Dockerfile中配置清华源）
2. 使用`--no-cache-dir`选项避免缓存问题
3. 如果仍有问题，可以离线下载依赖包

#### 5.1.3 Windows换行符问题
**错误**：脚本执行失败或Docker构建错误

**解决方案**：
```bash
# 执行换行符修复脚本
chmod +x fix-line-endings.sh
./fix-line-endings.sh

# 或手动修复特定文件
sed -i 's/\r$//' Dockerfile
sed -i 's/\r$//' deploy.sh
```

#### 5.1.4 构建超时问题
**解决方案**：
1. 使用快速部署脚本：
   ```bash
   chmod +x quick-deploy.sh
   ./quick-deploy.sh
   ```
2. 增加Docker构建内存限制
3. 分步构建：先构建后端，再构建前端

### 5.2 容器启动失败

查看容器日志：
```bash
docker-compose logs -f [service-name]
```

常见原因：
- 环境变量配置错误
- 端口冲突
- 依赖服务未启动

### 5.2 API 请求失败

1. 检查后端服务是否运行：
   ```bash
docker-compose ps backend
   ```

2. 检查后端健康状态：
   ```bash
curl http://localhost:8000/health
   ```

3. 检查 CORS 配置是否允许前端域名：
   ```bash
# 查看后端 CORS 配置
cat apps/public-web/src/features/mvp/phase1/backend/main.py | grep -A 5 "allow_origins"
   ```

4. 查看后端日志：
   ```bash
docker-compose logs backend
   ```

### 5.3 SSL 证书问题

1. 检查证书是否过期：
   ```bash
certbot certificates
   ```

2. 手动续订证书：
   ```bash
certbot renew
   ```

3. 检查 Nginx SSL 配置：
   ```bash
nano /etc/nginx/sites-available/finestem
   ```

## 6. 扩展考虑

### 6.1 水平扩展

1. **多容器部署**：
   ```bash
   # 在 docker-compose.yml 中添加更多服务实例
   docker-compose up -d --scale backend=3
   ```

2. **负载均衡**：使用 Nginx 或云服务商提供的负载均衡服务

### 6.2 数据库配置

如果后续需要添加数据库，可以在 `docker-compose.yml` 中添加数据库服务：

```yaml
db:
  image: postgres:14
  restart: always
  environment:
    POSTGRES_DB: finestem
    POSTGRES_USER: finestem
    POSTGRES_PASSWORD: your-password
  volumes:
    - postgres-data:/var/lib/postgresql/data
  ports:
    - "5432:5432"
  networks:
    - finestem-network
```

### 6.3 缓存配置

添加 Redis 缓存服务：

```yaml
redis:
  image: redis:alpine
  restart: always
  ports:
    - "6379:6379"
  networks:
    - finestem-network
```

## 7. 总结

通过本部署文档，您可以将 FineSTEM MVP 成功部署为互联网应用。主要步骤包括：

1. 准备服务器和域名
2. 安装必要的软件依赖
3. 获取项目代码
4. 配置环境变量
5. 执行部署脚本
6. 配置 SSL 证书
7. 验证部署结果
8. 配置监控和备份

部署完成后，您的 FineSTEM 应用将可以通过互联网访问，为 7-10 年级学生提供 AI + 创意学习体验。

## 8. 联系方式

如有部署问题或需要技术支持，请联系项目维护团队。

---

**文档版本**：v1.0.0  
**创建时间**：2025-12-16  
**维护者**：AI Agent  
**适用项目**：FineSTEM MVP
