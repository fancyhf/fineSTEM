# Track E 修复部署脚本
# 修复 localhost:8001 硬编码问题
# 在服务器上执行此脚本

Write-Host "==========================================" -ForegroundColor Green
Write-Host "    Track E 修复部署脚本" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# 1. 拉取最新代码
Write-Host "1. 拉取最新代码" -ForegroundColor Blue
cd /root/fineSTEM_20251222134107
git pull origin main
Write-Host "✓ 代码拉取完成" -ForegroundColor Green
Write-Host ""

# 2. 停止并删除旧容器
Write-Host "2. 停止并删除旧容器" -ForegroundColor Blue
docker-compose down --remove-orphans
docker rmi finestem-frontend 2>$null
Write-Host "✓ 容器清理完成" -ForegroundColor Green
Write-Host ""

# 3. 清理 Docker 缓存（重要！）
Write-Host "3. 清理 Docker 构建缓存" -ForegroundColor Blue
docker builder prune -f
docker system prune -f --volumes
Write-Host "✓ 缓存清理完成" -ForegroundColor Green
Write-Host ""

# 4. 重新构建前端（无缓存）
Write-Host "4. 重新构建前端镜像（无缓存）" -ForegroundColor Blue
docker-compose build frontend --no-cache
Write-Host "✓ 前端构建完成" -ForegroundColor Green
Write-Host ""

# 5. 启动服务
Write-Host "5. 启动服务" -ForegroundColor Blue
docker-compose up -d
Write-Host "✓ 服务启动完成" -ForegroundColor Green
Write-Host ""

# 6. 等待服务就绪
Write-Host "等待服务启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# 7. 验证构建结果
Write-Host "6. 验证构建结果" -ForegroundColor Blue
Write-Host "检查前端 JS 文件中的 API_BASE_URL..." -ForegroundColor Yellow
docker exec finestem-frontend sh -c 'find /usr/share/nginx/html -name "*.js" -type f -exec grep -o "VITE_API_BASE_URL[^,\\\"]*" {} \; | head -5'
Write-Host ""

# 8. 健康检查
Write-Host "7. 健康检查" -ForegroundColor Blue

$backendStatus = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method GET -ErrorAction SilentlyContinue
if ($backendStatus) {
    Write-Host "✓ 后端服务正常: http://localhost:8000/health" -ForegroundColor Green
} else {
    Write-Host "✗ 后端服务异常" -ForegroundColor Red
}

try {
    $frontendStatus = Invoke-WebRequest -Uri "http://localhost:80" -UseBasicParsing -ErrorAction Stop
    Write-Host "✓ 前端服务正常: http://localhost:80" -ForegroundColor Green
} catch {
    Write-Host "✗ 前端服务异常" -ForegroundColor Red
}

Write-Host ""

# 9. 最终说明
Write-Host "==========================================" -ForegroundColor Green
Write-Host "         部署完成！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "访问地址: http://43.140.204.127" -ForegroundColor Green
Write-Host "Track E:  http://43.140.204.127/track-e" -ForegroundColor Green
Write-Host ""
Write-Host "如果问题仍然存在：" -ForegroundColor Yellow
Write-Host "1. 清除浏览器缓存（Ctrl+Shift+Delete）" -ForegroundColor White
Write-Host "2. 使用隐私/无痕模式访问" -ForegroundColor White
Write-Host "3. 在 URL 后添加版本参数: ?v=20251225" -ForegroundColor White
Write-Host "4. 检查浏览器控制台中的网络请求 URL" -ForegroundColor White
Write-Host ""
Write-Host "管理命令:" -ForegroundColor Blue
Write-Host "查看日志: docker-compose logs -f frontend" -ForegroundColor Yellow
Write-Host "重启服务: docker-compose restart frontend" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Green
