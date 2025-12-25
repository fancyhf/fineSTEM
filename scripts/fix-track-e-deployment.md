# Track E 修复部署指南

## 问题原因

Track E 页面显示 "数据加载失败" 的原因是：
- Dockerfile 在构建阶段没有复制 `.env.production` 文件
- 导致 `VITE_API_BASE_URL` 环境变量在构建时不可用
- 最终 JS 文件中包含了硬编码的 `localhost:8001` 默认值

## 修复方案

已在 `apps/public-web/src/features/mvp/phase1/web/Dockerfile` 中添加：
```dockerfile
COPY .env* ./
```

## 部署步骤

### 方式 1：使用自动化脚本（推荐）

登录到服务器后，执行以下命令：

```bash
cd /root/fineSTEM_20251222134107
bash /path/to/scripts/fix-track-e.sh
```

### 方式 2：手动执行命令

如果无法使用脚本，请按顺序执行以下命令：

```bash
# 1. 拉取最新代码
cd /root/fineSTEM_20251222134107
git pull origin main

# 2. 停止并删除旧容器
docker-compose down --remove-orphans
docker rmi finestem-frontend 2>/dev/null || true

# 3. 清理 Docker 构建缓存（关键步骤！）
docker builder prune -f
docker system prune -f --volumes

# 4. 重新构建前端（无缓存）
docker-compose build frontend --no-cache

# 5. 启动服务
docker-compose up -d

# 6. 等待服务启动（15秒）
sleep 15

# 7. 验证构建结果（检查 JS 文件中的 API_BASE_URL）
docker exec finestem-frontend sh -c 'find /usr/share/nginx/html -name "*.js" -type f -exec grep -o "VITE_API_BASE_URL[^,\\\"]*" {} \; | head -5'

# 8. 健康检查
echo "检查后端..."
curl http://localhost:8000/health

echo "检查前端..."
curl -I http://localhost:80

# 9. 查看容器状态
docker-compose ps
```

## 验证修复结果

部署完成后，在浏览器中：

1. **清除浏览器缓存**：
   - Windows/Linux: `Ctrl + Shift + Delete`
   - Mac: `Cmd + Shift + Delete`

2. **使用无痕/隐私模式访问**：
   - Chrome/Edge: `Ctrl + Shift + N`
   - Firefox: `Ctrl + Shift + P`

3. **添加版本参数访问**：
   ```
   http://43.140.204.127/track-e?v=20251225
   ```

4. **打开浏览器开发者工具（F12）**，检查：
   - Network 标签：确认不再请求 `localhost:8001`
   - 应该看到请求 `/track-e/dataset/mock`（相对路径）
   - 响应应该是 JSON 数据，而不是 `net::ERR_CONNECTION_REFUSED`

## 预期结果

修复后，Track E 页面应该：
- ✓ 正确加载数据
- ✓ 显示动态图表
- ✓ 网络请求使用相对路径 `/track-e/dataset/mock`
- ✓ 不再出现 `localhost:8001` 的错误

## 常见问题

### Q1: 仍然请求 localhost:8001
**A:** Docker 缓存可能未清理完整，执行：
```bash
docker system prune -f --volumes
docker-compose build frontend --no-cache
docker-compose up -d --force-recreate frontend
```

### Q2: 浏览器仍显示旧错误
**A:** 确保完全清除浏览器缓存，使用无痕模式，或添加版本参数。

### Q3: API 返回 404
**A:** 检查 nginx 配置是否正确代理到后端：
```bash
docker exec finestem-frontend cat /etc/nginx/conf.d/default.conf
```

## 监控日志

查看前端容器日志：
```bash
docker-compose logs -f frontend
```

查看后端容器日志：
```bash
docker-compose logs -f backend
```

## 回滚方案

如果新版本有问题，可以回滚：
```bash
cd /root/fineSTEM_20251222134107
git log --oneline -10  # 查看提交历史
git checkout <commit-hash>  # 回滚到指定提交
docker-compose build frontend --no-cache
docker-compose up -d --force-recreate frontend
```

## 联系支持

如果问题持续存在，请提供以下信息：
1. 浏览器控制台截图（Network 和 Console 标签）
2. 容器状态：`docker-compose ps`
3. 前端日志：`docker-compose logs frontend`
4. 构建验证输出：步骤 7 的命令结果
