# 多项目部署指南 - Lighthouse 服务器

## 概述

本指南适用于在腾讯云 Lighthouse 单台服务器上部署多个项目。每个项目独立运行，通过路径区分访问。**fineSTEM 是服务器上的其中一个项目**。

## ⚠️ 关键架构说明

### 服务器架构（多项目部署）

```
Lighthouse 服务器 (80 端口)
├── 主机级 Nginx (路径分发)
│   ├── /project1 → project1 容器
│   ├── /project2 → project2 容器
│   └── /finestem → fineSTEM 容器
└── fineSTEM 项目（其中一个）
    ├── Home (首页)
    ├── TrackA (子页签：双摆混沌模拟)
    └── TrackE (子页签：编程语言热度)
```

### 核心原则

- **多项目服务器**：Lighthouse 支持多项目部署，fineSTEM 是其中一个项目
- **项目独立性**：每个项目有独立的容器、独立的端口、独立的网络
- **项目内部子路由**：track-a、track-e 是 fineSTEM 内部的 React Router 子路由，**不是服务器级别的独立项目**
- **路径分离**：
  - 服务器级别：通过不同路径区分不同项目（`/finestem`、`/project1`、`/project2`）
  - 项目内部：通过 React Router 区分子页签（`/track-a`、`/track-e`）

### URL 结构

#### 服务器级别（项目区分）

- **项目 1 入口**：`http://43.140.204.127/project1`
- **项目 2 入口**：`http://43.140.204.127/project2`
- **fineSTEM 入口**：`http://43.140.204.127/finestem`

#### fineSTEM 项目内部（子页签）

- **主页面**：`http://43.140.204.127/finestem/`
- **子页签 A**：`http://43.140.204.127/finestem/track-a`
- **子页签 E**：`http://43.140.204.127/finestem/track-e`
- **API 路径**：`http://43.140.204.127/finestem/api/*`

### 🚫 严禁行为

- ❌ 将 track-a、track-e 作为服务器级别的独立项目部署
- ❌ 为 fineSTEM 的子页签分配独立的容器或端口
- ❌ 在主机 Nginx 中配置 track-a、track-e 的路由
- ❌ 将 track-a/e 与 project1、project2 等同列为服务器项目
- ❌ 使用硬编码的 URL 或端口

### 部署架构

```
Lighthouse 服务器 (80 端口)
    ↓
主机级 Nginx (路径分发)
    ├── /project1 → project1-frontend 容器 (8081:80)
    ├── /project2 → project2-frontend 容器 (8082:80)
    └── /finestem → finestem-frontend 容器 (80:80)
              ├── /finestem → React 应用
              └── /finestem/api → finestem-backend 容器 (8000:8000)
```

**关键点**：

- 主机 Nginx 只负责根据路径分发到不同项目容器
- 每个项目有独立的前端容器和后端容器（如果需要）
- 项目的内部子路由（如 track-a、track-e）由项目自己处理

## 1. 服务器目录结构

```
/opt/
└── projects/              # 所有项目的根目录
    ├── finestem/         # fineSTEM 项目
    │   ├── app/         # 代码目录（git clone）
    │   ├── data/        # 数据卷（可选）
    │   └── logs/        # 日志卷（可选）
    ├── project2/         # 其他项目
    │   ├── app/
    │   └── logs/
    └── project3/
        ├── app/
        └── logs/
```

## 2. 端口分配

| 项目  | 前端容器端口 | 后端容器端口 | 访问路径 | 完整 URL |
| --- | --- | --- | --- | --- |
| finestem | 80  | 8000 | /finestem | http://43.140.204.127/finestem |
| project2 | 8081 | 18081 | /project2 | http://43.140.204.127/project2 |
| project3 | 8082 | 18082 | /project3 | http://43.140.204.127/project3 |

**注意**：

- 前端容器端口映射到主机，主机 Nginx 路由到对应端口
- 后端容器端口仅用于容器间通信，不对外暴露
- fineSTEM 使用 80 端口（可直接通过域名根路径访问，或通过 /finestem 路径）

## 4. 环境变量说明

### docker-compose.yml 环境变量

| 变量名 | 默认值 | 说明  |
| --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | finestem | 项目唯一标识（用于容器名、网络名、卷名） |
| `FRONTEND_HOST_PORT` | 80  | 前端容器在主机上的暴露端口 |
| `BACKEND_HOST_PORT` | 8000 | 后端容器在主机上的暴露端口 |
| `BASE_PATH` | /finestem/ | 前端路径前缀（影响 fineSTEM 内部路由） |
| `API_BASE_URL` | /finestem/api | API 请求前缀（确保前端API请求使用正确路径） |
| `ROOT_PATH` | /finestem/api | 后端根路径（用于 Swagger 文档适配） |
| `DEEPSEEK_API_KEY` | - | DeepSeek API 密钥 |

### 前端 nginx.conf 环境变量

| 变量名 | 默认值 | 说明  |
| --- | --- | --- |
| `BASE_PATH` | /finestem | 前端路由的基础路径（影响 nginx location 匹配） |

## 5. fineSTEM 项目内部结构

### 5.1 React Router 配置

```typescript
<BrowserRouter basename="/finestem">
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/track-a" element={<TrackA />} />
    <Route path="/track-e" element={<TrackE />} />
    <Route path="*" element={<Home />} />
  </Routes>
</BrowserRouter>
```

**关键点**：

- ✅ 必须设置 `basename="/finestem"`（项目路径）
- ❌ 禁止使用无 basename 的 `BrowserRouter`

### 5.2 API 请求配置

```typescript
// 正确：使用 /api 前缀 (前端构建时会自动替换为 API_BASE_URL)
fetch('/api/track-e/dataset/mock')
fetch('/api/track-a/config/export')

// 错误：硬编码端口或路径
fetch('/track-e/dataset/mock')
fetch('http://localhost:8000/track-e/dataset/mock')
```

### 5.3 Nginx 配置（项目内部）

```nginx
server {
    listen 80;
    server_name _;

    # 根路径重定向到 /finestem
    location = / {
        return 301 /finestem;
    }

    # fineSTEM 应用（包括所有子路由）
    location /finestem {
        alias /usr/share/nginx/html/;
        try_files $uri $uri/ /finestem/index.html;
    }

    # API 路径代理到后端 (关键修复：剥离前缀)
    location /finestem/api/ {
        proxy_pass http://backend:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 后端健康检查
    location /health {
        proxy_pass http://backend:8000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**关键点**：

- ✅ 根路径重定向到 `/finestem`
- ✅ `/finestem` 使用 `try_files` 处理前端路由
- ✅ `/finestem/api/` 代理到后端服务，并使用 `/` 结尾剥离前缀
- ❌ 禁止在主机 Nginx 中配置 track-a、track-e 路由

## 7. 管理命令

### 查看项目状态

```bash
# 查看 fineSTEM 容器
docker ps | grep finestem

# 查看 project2 容器
docker ps | grep project2

# 查看所有项目
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### 查看项目日志

```bash
# 查看 fineSTEM 日志
cd /opt/projects/finestem
docker-compose logs -f

# 查看 project2 日志
cd /opt/projects/project2
docker-compose logs -f
```

### 重启单个项目

```bash
# 重启 fineSTEM
cd /opt/projects/finestem
docker-compose restart

# 重启 project2
cd /opt/projects/project2
docker-compose restart
```

### 停止单个项目

```bash
# 停止 fineSTEM
cd /opt/projects/finestem
docker-compose down

# 停止 project2
cd /opt/projects/project2
docker-compose down
```

### 查看主机 Nginx 日志

```bash
journalctl -u nginx -f
# 或
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## 8. 验证部署

### 验证 fineSTEM 项目

```bash
# 1. 检查容器状态
docker ps | grep finestem

# 2. 检查前端访问
curl -I http://43.140.204.127/finestem

# 3. 检查后端健康
curl http://43.140.204.127/finestem/api/health

# 4. 浏览器访问
# 打开 http://43.140.204.127/finestem
# 测试子页签 /track-a 和 /track-e
```

### 验证 project2 项目

```bash
# 1. 检查容器状态
docker ps | grep project2

# 2. 检查前端访问
curl -I http://43.140.204.127/project2

# 3. 检查后端健康（如果有）
curl http://43.140.204.127/project2/api/health

# 4. 浏览器访问
# 打开 http://43.140.204.127/project2
```

## 9. 故障排除

### 端口冲突

**问题**：`Error: Bind for 0.0.0.0.0:8080 failed: port is already allocated`

**解决方案**：

```bash
# 1. 检查端口占用
netstat -tulnp | grep 8080

# 2. 找到占用端口的服务
docker ps --format "table {{.Names}}\t{{.Ports}}"

# 3. 停止占用端口的服务或更改端口配置
```

### 容器名冲突

**问题**：`Error: container name "finestem-backend" is already in use`

**解决方案**：

```bash
# 1. 重命名旧容器
docker rename finestem-backend finestem-backend-old

# 2. 停止旧容器
docker stop finestem-backend-old

# 3. 使用不同的 COMPOSE_PROJECT_NAME
export COMPOSE_PROJECT_NAME=finestem-v2
docker-compose up -d
```

### 主机 Nginx 路由不生效

**问题**：访问 `/finestem` 返回 404

**解决方案**：

```bash
# 1. 检查配置文件语法
nginx -t

# 2. 重新加载配置
nginx -s reload

# 3. 完全重启 Nginx
systemctl restart nginx

# 4. 检查主机 Nginx 日志
journalctl -u nginx -n 50
```

### fineSTEM 子页签 404

**问题**：访问 `/finestem/track-a` 返回 404

**解决方案**：

1. 检查 fineSTEM 项目的 BrowserRouter 是否设置了 `basename="/finestem"`
  
2. 检查 fineSTEM 的 nginx.conf 的 `try_files` 配置
  
3. 重新构建 fineSTEM 前端容器：
  
  ```bash
  cd /opt/projects/finestem
  docker-compose up -d --build frontend
  ```
  

### API 请求 404

**问题**：fineSTEM 前端 API 请求失败

**解决方案**：

1. 检查后端容器是否正常运行：
  
  ```bash
  docker logs finestem-backend
  ```
  
2. 检查 fineSTEM 的 nginx.conf 的 `/finestem/api/` 代理配置（注意末尾斜杠）
  
3. 测试后端健康：
  
  ```bash
  curl http://43.140.204.127/finestem/api/health
  ```
  
4. 检查前端代码中的 API 路径是否使用 `/api` 前缀
  

### Docker 网络隔离问题

**问题**：项目间无法通信

**解决方案**：

```bash
# 1. 检查网络列表
docker network ls

# 2. 检查容器网络连接
docker inspect finestem-frontend | grep NetworkMode

# 3. 确保使用独立网络（finestem-network vs project2-network）
```

## 10. 扩展新项目

**重要说明**：扩展新项目的工作由IDE的AI agent自动完成，无需手动执行命令。IDE支持Lighthouse集成，可以自动完成项目添加和配置。

**部署流程**：
1. 在 IDE 中使用 Lighthouse 集成功能
2. 选择添加新项目
3. AI agent 会自动执行以下步骤：
   - 克隆项目代码到服务器独立目录（`/opt/projects/newproject`）
   - 自动配置环境变量：
     - `FRONTEND_HOST_PORT=8083`（自动分配，避免冲突）
     - `BACKEND_HOST_PORT=18083`（自动分配，避免冲突）
     - `BASE_PATH=/newproject`
     - `API_BASE_URL=/newproject/api`
     - `COMPOSE_PROJECT_NAME=newproject`
   - 自动更新主机 Nginx 配置，添加项目路由
   - 自动重启主机 Nginx 服务
   - 启动项目容器：`docker-compose up -d --build`
   - 自动验证部署状态

**无需手动执行**：
- ❌ 不需要手动克隆代码（`git clone`）
- ❌ 不需要手动配置环境变量
- ❌ 不需要手动编辑 Nginx 配置文件
- ❌ 不需要手动执行 nginx -t 和 systemctl restart nginx
- ❌ 不需要手动执行 docker-compose 命令
- ✅ 所有步骤由 IDE 的 AI agent 自动完成

## 11. 最佳实践

1. **端口规划**：预先规划所有项目端口，避免冲突
2. **命名规范**：
  - 项目目录：使用项目名（如 finestem、project2）
  - 容器名：使用 COMPOSE_PROJECT_NAME（如 finestem-frontend、project2-backend）
  - 网络名：使用项目名（如 finestem-network、project2-network）
3. **数据隔离**：每个项目使用独立的数据卷，避免数据混淆
4. **监控告警**：为每个关键项目配置独立的监控和告警
5. **备份策略**：定期备份每个项目的配置和数据卷
6. **文档记录**：维护项目清单，记录端口、路径、环境变量等信息

## 12. 关键要点总结

### 服务器级别

- Lighthouse 是多项目服务器
- 主机 Nginx 负责根据路径分发到不同项目
- 每个项目独立运行、独立管理

### 项目级别（以 fineSTEM 为例）

- fineSTEM 是服务器上的一个项目
- track-a、track-e 是 fineSTEM 内部的子页签
- 不需要为子页签分配独立容器或端口
- 通过 React Router 管理内部路由

### 部署原则

- 确保往 Lighthouse 部署时，fineSTEM 作为多项目中的一个项目
- track-a、track-e 作为子页签，不作为独立项目部署
- 禁止混淆服务器多项目与项目内部子页签

## 总结

通过本架构，可以在单台 Lighthouse 服务器上稳定运行多个项目。关键要点：

1. **多项目架构**：服务器支持多项目部署，每个项目独立运行
2. **项目独立性**：fineSTEM 是一个项目，内部有子页签
3. **路径分离**：服务器级路径区分项目（`/finestem`），项目内路由区分子页签（`/track-a`）
4. **避免混淆**：严禁将 track-a/e 当作服务器级项目，严禁在主机 Nginx 中配置子页签路由

如有问题，请参考故障排除章节或查看诊断报告：`deploysettings/DIAGNOSIS_REPORT_20251227.md`
