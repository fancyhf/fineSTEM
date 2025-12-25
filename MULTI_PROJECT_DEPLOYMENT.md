# 多项目部署指南

## 概述

本指南适用于在腾讯云 Lighthouse 单台服务器上部署多个项目，每个项目独立运行，通过路径区分访问。

## 1. 服务器目录结构

```
/root/
├── projects/              # 所有项目的根目录
│   ├── finestem/         # fineSTEM 项目
│   │   ├── app/         # 代码目录（git clone）
│   │   ├── data/        # 数据卷（可选）
│   │   └── logs/        # 日志卷（可选）
│   ├── project2/         # 其他项目
│   │   ├── app/
│   │   └── logs/
│   └── project3/
├── docker/
│   └── nginx/
│       └── conf.d/
│           └── projects.conf  # 主机级 Nginx 配置
```

## 2. 端口分配

| 项目 | 前端端口 | 后端端口 | 访问路径 | 完整 URL |
|------|----------|----------|----------|-----------|
| finestem | 8080 | 18080 | /finestem | http://43.140.204.127:8080/fineSTEM |
| project2 | 8081 | 18081 | /project2 | http://43.140.204.127:8081/project2 |
| project3 | 8082 | 18082 | /project3 | http://43.140.204.127:8082/project3 |

**注意**：前端端口用于主机级 Nginx 路由，后端端口仅用于容器间通信。

## 3. 部署步骤

### 3.1 初始化服务器（一次性）

```bash
# 1. 上传服务器配置文件
scp server/init-server.sh root@43.140.204.127:/root/
scp server/nginx-projects.conf root@43.140.204.127:/root/docker/nginx/conf.d/

# 2. SSH 登录服务器
ssh root@43.140.204.127

# 3. 运行初始化脚本
cd /root
chmod +x init-server.sh
./init-server.sh
```

初始化脚本会：
- 创建 `/root/projects` 目录
- 安装主机级 Nginx
- 配置 Nginx 多项目路由
- 重启 Nginx 服务

### 3.2 部署单个项目

以 fineSTEM 为例：

```bash
# 1. 克隆项目代码到独立目录
cd /root/projects
git clone https://github.com/fancyhf/fineSTEM.git finestem
cd finestem

# 2. 配置环境变量（可选，使用默认值可跳过）
export FRONTEND_HOST_PORT=8080
export BACKEND_HOST_PORT=18080
export BASE_PATH=/finestem
export COMPOSE_PROJECT_NAME=finestem

# 3. 启动项目
docker-compose up -d --build
```

### 3.3 配置主机级 Nginx 路由

编辑 `/root/docker/nginx/conf.d/projects.conf`，添加项目路由：

```nginx
# fineSTEM 项目
location /finestem {
    proxy_pass http://localhost:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# project2 项目
location /project2 {
    proxy_pass http://localhost:8081;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

然后重启主机 Nginx：

```bash
nginx -t
systemctl restart nginx
```

## 4. 环境变量说明

### docker-compose.yml 环境变量

| 变量名 | 默认值 | 说明 |
|--------|---------|------|
| `COMPOSE_PROJECT_NAME` | finestem | 项目唯一标识（用于容器名、网络名、卷名） |
| `FRONTEND_HOST_PORT` | 8080 | 前端容器在主机上的暴露端口 |
| `BACKEND_HOST_PORT` | 18080 | 后端容器在主机上的暴露端口 |
| `BASE_PATH` | / | 前端路径前缀（由主机 Nginx 使用） |

### 前端 nginx.conf 环境变量

| 变量名 | 默认值 | 说明 |
|--------|---------|------|
| `BASE_PATH` | / | 前端路由的基础路径（影响 nginx location 匹配） |

## 5. 远程部署脚本使用

使用 `scripts/remote-deploy.sh` 进行远程部署时，可通过环境变量配置：

```bash
# 方式 1：使用默认配置（fineSTEM 项目）
cd scripts
bash remote-deploy.sh

# 方式 2：自定义配置
export PROJECT_DIR=/root/projects/finestem/app
export FRONTEND_HOST_PORT=8080
export BACKEND_HOST_PORT=18080
export BASE_PATH=/finestem
export COMPOSE_PROJECT_NAME=finestem
bash remote-deploy.sh

# 方式 3：部署新项目
export PROJECT_DIR=/root/projects/project2/app
export FRONTEND_HOST_PORT=8081
export BACKEND_HOST_PORT=18081
export BASE_PATH=/project2
export COMPOSE_PROJECT_NAME=project2
bash remote-deploy.sh
```

## 6. 管理命令

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
cd /root/projects/finestem/app
docker-compose logs -f

# 查看 project2 日志
cd /root/projects/project2/app
docker-compose logs -f
```

### 重启单个项目

```bash
# 重启 fineSTEM
cd /root/projects/finestem/app
docker-compose restart

# 重启 project2
cd /root/projects/project2/app
docker-compose restart
```

### 停止单个项目

```bash
# 停止 fineSTEM
cd /root/projects/finestem/app
docker-compose down

# 停止 project2
cd /root/projects/project2/app
docker-compose down
```

### 查看主机 Nginx 日志

```bash
journalctl -u nginx -f
# 或
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## 7. 验证部署

### 验证 fineSTEM 项目

```bash
# 1. 检查容器状态
docker ps | grep finestem

# 2. 检查前端访问
curl -I http://43.140.204.127:8080/fineSTEM

# 3. 检查后端健康
curl http://localhost:18080/health

# 4. 浏览器访问
# 打开 http://43.140.204.127/fineSTEM
```

### 验证 project2 项目

```bash
# 1. 检查容器状态
docker ps | grep project2

# 2. 检查前端访问
curl -I http://43.140.204.127:8081/project2

# 3. 检查后端健康
curl http://localhost:18081/health

# 4. 浏览器访问
# 打开 http://43.140.204.127/project2
```

## 8. 故障排除

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

### Docker 网络隔离问题

**问题**：项目间无法通信

**解决方案**：
```bash
# 1. 检查网络列表
docker network ls

# 2. 检查容器网络连接
docker inspect finestem-frontend | grep NetworkMode

# 3. 确保使用独立网络（ finestem-network vs project2-network ）
```

## 9. 扩展新项目

要添加新项目 `newproject`：

```bash
# 1. 克隆项目代码
cd /root/projects
git clone <newproject-repo> newproject
cd newproject

# 2. 配置端口（避免冲突）
export FRONTEND_HOST_PORT=8083
export BACKEND_HOST_PORT=18083
export BASE_PATH=/newproject
export COMPOSE_PROJECT_NAME=newproject

# 3. 更新主机 Nginx 配置
# 编辑 /root/docker/nginx/conf.d/projects.conf
# 添加：
location /newproject {
    proxy_pass http://localhost:8083;
    ...
}

# 4. 重启 Nginx
systemctl restart nginx

# 5. 启动项目
docker-compose up -d --build
```

## 10. 最佳实践

1. **端口规划**：预先规划所有项目端口，避免冲突
2. **命名规范**：使用有意义的 COMPOSE_PROJECT_NAME（如 finestem, project2）
3. **数据隔离**：每个项目使用独立的数据卷，避免数据混淆
4. **监控告警**：为每个关键项目配置独立的监控和告警
5. **备份策略**：定期备份每个项目的配置和数据卷
6. **文档记录**：维护项目清单，记录端口、路径、环境变量等信息

## 总结

通过本架构，可以在单台 Lighthouse 服务器上稳定运行多个项目，每个项目独立运行、独立管理，通过主机级 Nginx 统一路由访问。
