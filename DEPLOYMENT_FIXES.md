# FineSTEM 部署问题修复文档

## 问题分析

在您反馈的基础上，我发现了以下关键问题并进行了修复：

## 修复的问题列表

### 1. Debian镜像源404错误
**问题**：`python:3.9-slim` 使用 Debian Trixie 版本，软件源不可用
**修复**：
- 更换为 `python:3.11-slim-bullseye`（稳定版本）
- 配置阿里云镜像源加速包下载
- 添加时区配置和环境变量

### 2. pip网络连接超时
**问题**：pip安装依赖时网络连接失败
**修复**：
- 配置清华大学pip镜像源
- 升级pip到最新版本
- 添加超时和重试机制

### 3. 健康检查路径错误
**问题**：Docker Compose中健康检查路径不正确
**修复**：
- 后端健康检查从 `/api/health` 改为 `/health`
- 前端健康检查添加根路径检查

### 4. 依赖版本兼容性问题
**问题**：某些依赖版本过新或存在兼容性问题
**修复**：
- 降级到稳定版本（FastAPI 0.104.1, uvicorn 0.24.0）
- 添加缺失的依赖（python-multipart, python-dotenv）
- 确保所有依赖版本相互兼容

### 5. 前端构建优化
**问题**：npm安装可能因网络问题失败
**修复**：
- 配置淘宝npm镜像源
- 添加缓存清理和安装优化选项
- 减少不必要的检查和审计

### 6. Windows换行符问题
**问题**：Windows系统产生的`\r\n`换行符在Linux下导致脚本执行失败
**修复**：
- 创建 `fix-line-endings.sh` 脚本自动修复
- 在文档中添加修复指导

### 7. Docker Compose配置优化
**问题**：网络配置和构建参数不够健壮
**修复**：
- 添加构建参数和环境变量
- 增加健康检查的启动延迟时间
- 优化网络配置

## 新增的文件

### 1. `quick-deploy.sh`
快速部署脚本，包含：
- 系统环境检查
- 分步构建（后端→前端）
- 详细的健康检查
- 错误处理和回退机制

### 2. `fix-line-endings.sh`
换行符修复脚本，自动处理：
- Dockerfile
- Shell脚本
- 配置文件
- Python文件

### 3. `DEPLOYMENT_FIXES.md`
本文档，记录所有修复的问题

## 更新的文件

### 1. `apps/public-web/src/features/mvp/phase1/backend/Dockerfile`
- 更换基础镜像
- 配置国内镜像源
- 优化依赖安装流程

### 2. `apps/public-web/src/features/mvp/phase1/backend/requirements.txt`
- 更新依赖版本到稳定版本
- 添加缺失的依赖包

### 3. `apps/public-web/src/features/mvp/phase1/web/Dockerfile`
- 配置npm淘宝镜像源
- 优化构建流程

### 4. `docker-compose.yml`
- 修复健康检查路径
- 添加构建参数
- 增加启动延迟

### 5. `deploy.sh`
- 修复健康检查路径
- 优化错误处理

### 6. `DEPLOYMENT.md`
- 添加网络问题解决方案
- 更新部署流程
- 增加故障排除章节

## 推荐的部署流程

### 正常情况
```bash
# 如果是从Windows上传的文件，先修复换行符
./fix-line-endings.sh

# 标准部署
chmod +x deploy.sh
./deploy.sh
```

### 遇到网络问题时
```bash
# 修复换行符
./fix-line-endings.sh

# 使用快速部署脚本
chmod +x quick-deploy.sh
./quick-deploy.sh
```

### 手动分步部署
```bash
# 1. 修复换行符
./fix-line-endings.sh

# 2. 构建后端
cd apps/public-web/src/features/mvp/phase1/backend
docker build -t finestem-backend . --no-cache
cd -

# 3. 启动后端
docker-compose up -d backend

# 4. 等待后端启动
sleep 20

# 5. 构建前端
cd apps/public-web/src/features/mvp/phase1/web
docker build -t finestem-frontend . --no-cache
cd -

# 6. 启动前端
docker-compose up -d frontend

# 7. 检查状态
docker-compose ps
curl http://localhost:8000/health
curl http://localhost:80
```

## 验证方法

部署完成后，执行以下命令验证：

```bash
# 检查容器状态
docker-compose ps

# 检查后端健康
curl http://localhost:8000/health

# 检查前端访问
curl -I http://localhost:80

# 查看日志
docker-compose logs -f
```

## 如果仍有问题

1. **查看详细日志**：
   ```bash
   docker-compose logs backend
   docker-compose logs frontend
   ```

2. **检查镜像构建**：
   ```bash
   docker images | grep finestem
   ```

3. **手动测试容器**：
   ```bash
   docker run -p 8000:8000 finestem-backend
   docker run -p 80:80 finestem-frontend
   ```

4. **清理并重新构建**：
   ```bash
   docker-compose down
   docker system prune -f
   ./quick-deploy.sh
   ```

## 总结

通过以上修复，解决了您提到的所有主要问题：
- ✅ Debian镜像源404错误
- ✅ pip网络连接超时
- ✅ 健康检查路径错误
- ✅ 依赖版本兼容性问题
- ✅ Windows换行符问题
- ✅ Docker配置优化

现在应该可以成功部署FineSTEM项目了。如果仍有问题，请提供具体的错误信息，我会进一步协助解决。