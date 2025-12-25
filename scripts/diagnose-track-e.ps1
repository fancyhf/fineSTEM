# Track E 诊断脚本
# 用于排查 localhost:8001 问题

Write-Host "==========================================" -ForegroundColor Blue
Write-Host "    Track E 诊断脚本" -ForegroundColor Blue
Write-Host "==========================================" -ForegroundColor Blue
Write-Host ""

# 1. 检查 Git 状态
Write-Host "1. 检查 Git 状态" -ForegroundColor Blue
Set-Location /root/fineSTEM_20251222134107
Write-Host "当前分支:" -ForegroundColor Yellow
git branch --show-current
Write-Host "最新提交:" -ForegroundColor Yellow
git log --oneline -1
Write-Host "Dockerfile 最后修改:" -ForegroundColor Yellow
Get-Item apps/public-web/src/features/mvp/phase1/web/Dockerfile | Select-Object Name, LastWriteTime
Write-Host ""

# 2. 检查 Dockerfile 内容
Write-Host "2. 检查 Dockerfile 内容" -ForegroundColor Blue
Write-Host "查找 COPY .env*:" -ForegroundColor Yellow
$dockerfileContent = Get-Content apps/public-web/src/features/mvp/phase1/web/Dockerfile -Raw
if ($dockerfileContent -match "COPY.*env.*") {
    $matches | Select-Object -First 1 | ForEach-Object { Write-Host $_ -ForegroundColor Green }
} else {
    Write-Host "未找到 COPY .env* 行！" -ForegroundColor Red
}
Write-Host ""

# 3. 检查前端镜像
Write-Host "3. 检查前端镜像" -ForegroundColor Blue
Write-Host "前端镜像列表:" -ForegroundColor Yellow
docker images | Select-String "finestem-frontend"
Write-Host ""

# 4. 检查容器状态
Write-Host "4. 检查容器状态" -ForegroundColor Blue
docker ps -a | Select-String "finestem-frontend"
Write-Host ""

# 5. 检查容器内的 JS 文件
Write-Host "5. 检查容器内的 JS 文件" -ForegroundColor Blue
Write-Host "查找 JS 文件:" -ForegroundColor Yellow
docker exec finestem-frontend ls -la /usr/share/nginx/html/assets/ 2>$null | Select-String "\.js$" | Select-Object -First 10
Write-Host ""

# 6. 检查 JS 文件中的 API_BASE_URL
Write-Host "6. 检查 JS 文件中的 API_BASE_URL" -ForegroundColor Blue
Write-Host "搜索 VITE_API_BASE_URL:" -ForegroundColor Yellow
docker exec finestem-frontend sh -c 'find /usr/share/nginx/html -name "*.js" -type f | head -3 | xargs grep -o "VITE_API_BASE_URL[^,\\\"]*" 2>/dev/null'
Write-Host ""

# 7. 检查 .env.production 文件
Write-Host "7. 检查 .env.production 文件" -ForegroundColor Blue
Write-Host "本地文件内容:" -ForegroundColor Yellow
Get-Content apps/public-web/src/features/mvp/phase1/web/.env.production
Write-Host ""

# 8. 检查 nginx 配置
Write-Host "8. 检查 nginx 配置" -ForegroundColor Blue
Write-Host "nginx 配置文件:" -ForegroundColor Yellow
docker exec finestem-frontend cat /etc/nginx/conf.d/default.conf
Write-Host ""

# 9. 检查后端 API
Write-Host "9. 检查后端 API" -ForegroundColor Blue
Write-Host "直接访问后端:" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -ErrorAction Stop
    Write-Host $health -ForegroundColor Green
} catch {
    Write-Host "后端访问失败" -ForegroundColor Red
}

Write-Host "访问 Track E API:" -ForegroundColor Yellow
try {
    $trackE = Invoke-RestMethod -Uri "http://localhost:8000/track-e/dataset/mock" -Method Get -ErrorAction Stop
    $trackE | ConvertTo-Json -Depth 3 | Select-Object -First 5
} catch {
    Write-Host "Track E API 访问失败" -ForegroundColor Red
}
Write-Host ""

# 10. 检查通过前端访问
Write-Host "10. 检查通过前端访问" -ForegroundColor Blue
Write-Host "通过 nginx 访问 health:" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost/health" -Method Get -ErrorAction Stop
    Write-Host $health -ForegroundColor Green
} catch {
    Write-Host "nginx 代理失败" -ForegroundColor Red
}

Write-Host "通过 nginx 访问 Track E:" -ForegroundColor Yellow
try {
    $trackE = Invoke-RestMethod -Uri "http://localhost/track-e/dataset/mock" -Method Get -ErrorAction Stop
    $trackE | ConvertTo-Json -Depth 3 | Select-Object -First 5
} catch {
    Write-Host "nginx 代理 Track E 失败" -ForegroundColor Red
}
Write-Host ""

Write-Host "==========================================" -ForegroundColor Green
Write-Host "    诊断完成！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "关键检查点:" -ForegroundColor Yellow
Write-Host "1. Dockerfile 是否包含 COPY .env* ./" -ForegroundColor White
Write-Host "2. 前端镜像创建时间是否是最近" -ForegroundColor White
Write-Host "3. JS 文件中是否还有 localhost:8001" -ForegroundColor Red
Write-Host "4. nginx 是否正确代理到 backend" -ForegroundColor White
Write-Host "5. 后端 API 是否正常工作" -ForegroundColor White
Write-Host ""
