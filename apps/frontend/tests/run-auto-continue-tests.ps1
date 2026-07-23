# AI 自动续接功能测试运行脚本
# 用法: .\run-auto-continue-tests.ps1

param(
    [string]$TestPattern = "",
    [switch]$Headed,
    [switch]$Debug
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AI 自动续接功能测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查环境
Write-Host "📋 检查测试环境..." -ForegroundColor Yellow

# 检查 Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Error "❌ Node.js 未安装"
    exit 1
}
Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green

# 检查 Playwright
$npxList = npx playwright --version 2>$null
if (-not $npxList) {
    Write-Host "⚠️ Playwright 未安装，正在安装..." -ForegroundColor Yellow
    npm install -g @playwright/test
    npx playwright install
}
Write-Host "✅ Playwright 已安装" -ForegroundColor Green

# 检查后端服务
Write-Host ""
Write-Host "🔍 检查后端服务..." -ForegroundColor Yellow
$backendRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3200/api/v1/health" -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        $backendRunning = $true
        Write-Host "✅ 后端服务运行中 (http://localhost:3200)" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ 后端服务未运行，请先启动后端服务" -ForegroundColor Yellow
    Write-Host "   运行: cd apps/backend && python -m app.main" -ForegroundColor Gray
}

# 检查前端服务
Write-Host ""
Write-Host "🔍 检查前端服务..." -ForegroundColor Yellow
$frontendRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5184" -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        $frontendRunning = $true
        Write-Host "✅ 前端服务运行中 (http://localhost:5184)" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ 前端服务未运行，请先启动前端服务" -ForegroundColor Yellow
    Write-Host "   运行: cd apps/frontend && npm run dev" -ForegroundColor Gray
}

if (-not $backendRunning -or -not $frontendRunning) {
    Write-Host ""
    Write-Host "❌ 服务未完全启动，是否继续? (y/N)" -ForegroundColor Red -NoNewline
    $continue = Read-Host
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

# 运行测试
Write-Host ""
Write-Host "🚀 开始运行测试..." -ForegroundColor Cyan
Write-Host "注意: 这些测试需要较长时间（每个 2-5 分钟）" -ForegroundColor Yellow
Write-Host ""

$testFile = "tests/specs/ai-auto-continue.spec.ts"
$args = @("test", $testFile)

if ($TestPattern) {
    $args += "-g"
    $args += $TestPattern
}

if ($Headed) {
    $args += "--headed"
}

if ($Debug) {
    $args += "--debug"
}

$args += "--reporter=list"
$args += "--output=test-results/auto-continue"

Write-Host "执行命令: npx playwright $args" -ForegroundColor Gray
Write-Host ""

try {
    & npx playwright @args

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "测试完成!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green

    # 打开测试报告
    $reportPath = "test-results/auto-continue/index.html"
    if (Test-Path $reportPath) {
        Write-Host ""
        Write-Host "📊 测试报告: $reportPath" -ForegroundColor Cyan
        # Start-Process $reportPath
    }
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "测试失败!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
