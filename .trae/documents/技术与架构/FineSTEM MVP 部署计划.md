# FineSTEM MVP 互联网应用部署计划

## 1. 项目结构分析

### 前端
- 位置：`apps/public-web/src/features/mvp/phase1/web/`
- 技术栈：Vite + React + TypeScript
- 构建脚本：`npm run build`

### 后端
- 位置：`apps/public-web/src/features/mvp/phase1/backend/`
- 技术栈：FastAPI + Python
- 依赖：`requirements.txt` 中的包

## 2. 互联网应用部署方案

### 2.1 架构设计
- **前端**：Vite 构建的静态文件，部署到 CDN 或 Nginx
- **后端**：FastAPI 服务，部署到容器或云服务器
- **反向代理**：Nginx 或 Cloudflare 处理请求转发
- **SSL/TLS**：Let's Encrypt 或云服务提供的 SSL 证书
- **域名**：配置 A 记录指向服务器 IP

### 2.2 部署选项

#### 选项 A：云服务器直接部署（推荐）
- 使用阿里云、腾讯云或 AWS 云服务器
- 配置安全组，开放必要端口（80、443）
- 安装 Nginx、Python、Node.js

#### 选项 B：容器化部署
- 使用 Docker 和 Docker Compose
- 容器化前端、后端和 Nginx
- 便于扩展和管理

#### 选项 C：Serverless 部署
- 前端部署到 Vercel 或 Netlify
- 后端部署到 AWS Lambda 或阿里云函数计算
- 适合低流量场景

## 3. 部署文件清单

### 3.1 后端部署文件
- `Dockerfile.backend`：后端 Docker 镜像配置
- `gunicorn.conf.py`：Gunicorn 生产服务器配置
- `.env.production`：生产环境变量配置
- `requirements-prod.txt`：生产环境依赖

### 3.2 前端部署文件
- `Dockerfile.frontend`：前端 Docker 镜像配置
- `vite.production.config.ts`：生产环境构建配置

### 3.3 容器编排和代理
- `docker-compose.yml`：Docker Compose 配置
- `nginx.conf`：Nginx 反向代理配置

### 3.4 安全配置
- `ssl.conf`：Nginx SSL 配置
- `security-headers.conf`：安全头配置

### 3.5 部署脚本
- `deploy.sh`：自动化部署脚本
- `healthcheck.sh`：健康检查脚本

## 4. 互联网应用部署步骤

### 4.1 前置准备
1. 注册域名（如 finestem.example.com）
2. 购买云服务器或容器服务
3. 配置 DNS 解析，将域名指向服务器 IP
4. 安装 Docker 和 Docker Compose（容器化部署）
5. 安装 Certbot 用于获取 SSL 证书

### 4.2 环境配置
1. 配置服务器安全组，仅开放 80、443 端口
2. 更新系统和安装必要软件
3. 创建专门的部署用户，禁用 root 登录
4. 配置 SSH 密钥登录，禁用密码登录

### 4.3 SSL 证书配置
1. 使用 Certbot 获取 Let's Encrypt 证书
2. 配置证书自动续订
3. 配置 Nginx SSL 支持

### 4.4 构建和部署前端
1. 进入前端目录：`cd apps/public-web/src/features/mvp/phase1/web/`
2. 安装依赖：`npm install`
3. 构建生产版本：`npm run build`
4. 将构建产物（dist 目录）复制到 Nginx 静态文件目录

### 4.5 部署后端
1. 进入后端目录：`cd apps/public-web/src/features/mvp/phase1/backend/`
2. 安装依赖：`pip install -r requirements.txt gunicorn`
3. 配置生产环境变量：`.env.production`
4. 启动后端服务：`gunicorn -c gunicorn.conf.py -k uvicorn.workers.UvicornWorker main:app --daemon`

### 4.6 配置 Nginx
1. 创建 Nginx 配置文件 `/etc/nginx/sites-available/finestem`
2. 配置静态文件服务和 API 转发
3. 配置 SSL 和安全头
4. 启用站点：`ln -s /etc/nginx/sites-available/finestem /etc/nginx/sites-enabled/`
5. 测试配置：`nginx -t`
6. 重启 Nginx：`systemctl restart nginx`

### 4.7 使用 Docker Compose 部署（推荐）
1. 在项目根目录创建 `docker-compose.yml`
2. 配置前端、后端和 Nginx 服务
3. 配置环境变量和卷挂载
4. 启动所有服务：`docker-compose up -d`
5. 配置 Certbot 获取 SSL 证书

## 5. 互联网应用安全配置

### 5.1 前端安全
- 配置 Content Security Policy (CSP)
- 启用 HTTP Strict Transport Security (HSTS)
- 配置 X-XSS-Protection 和 X-Frame-Options
- 使用 HTTPS 资源

### 5.2 后端安全
- 配置 CORS 允许特定域名访问
- 实现请求速率限制
- 配置日志记录，包括访问日志和错误日志
- 定期更新依赖，修复安全漏洞
- 配置 API 密钥或身份验证（如果需要）

### 5.3 服务器安全
- 定期更新系统和软件
- 配置防火墙，仅开放必要端口
- 使用 Fail2ban 防止暴力破解
- 配置入侵检测系统（可选）
- 定期备份数据

## 6. 验证部署

1. 访问域名：`https://finestem.example.com`
2. 检查 SSL 证书：浏览器地址栏显示绿色锁
3. 测试 API 访问：`https://finestem.example.com/api/health`
4. 测试核心功能：
   - 访问主页
   - 测试 API 调用
   - 测试交互功能
5. 检查日志：确保没有错误信息
6. 性能测试：使用工具测试页面加载速度和 API 响应时间

## 7. 监控和维护

### 7.1 监控配置
- 配置服务器监控（CPU、内存、磁盘使用情况）
- 配置应用监控（请求量、响应时间、错误率）
- 配置日志监控和告警
- 使用 Prometheus + Grafana 或云服务商提供的监控服务

### 7.2 定期维护
1. 每周检查服务器状态和日志
2. 每月更新系统和依赖
3. 每季度进行安全审计
4. 定期备份数据，测试恢复流程
5. 根据访问量调整服务器配置

## 8. 扩展考虑

1. 配置 CDN 加速静态资源
2. 实现负载均衡，支持多实例部署
3. 配置数据库（如 PostgreSQL）和缓存（如 Redis）
4. 实现自动扩缩容
5. 配置 CI/CD 流水线，实现自动化部署

## 9. 故障恢复

1. 定期备份配置和数据
2. 配置自动故障检测和恢复
3. 制定详细的故障恢复计划
4. 定期演练故障恢复流程

## 10. 文档更新

1. 更新 README.md 中的互联网部署说明
2. 编写详细的部署文档，包括：
   - 服务器配置
   - 域名和 SSL 配置
   - 部署步骤
   - 安全配置
   - 监控和维护
3. 记录常见问题和解决方案

---

### 预期成果

- 成功部署 FineSTEM MVP 为互联网应用
- 配置了域名和 SSL 证书
- 实现了安全的 HTTPS 访问
- 配置了适当的安全措施
- 服务稳定运行，便于后续扩展和维护