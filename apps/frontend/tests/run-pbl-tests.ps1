# PBL AI 对话流测试执行脚本
# 使用方法: .\run-pbl-tests.ps1

param(
    [string]$TestPattern = "",
    [switch]$Headed,
    [switch]$Debug,
    [switch]$UI,
    [string]$BackendUrl = "http://localhost:3200",
    [string]$FrontendUrl = "http://localhost:5184"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PBL AI 对话流测试执行脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查环境变量
if (-not $env:TEST_USER_TOKEN) {
    Write-Host "警告: TEST_USER_TOKEN 环境变量未设置" -ForegroundColor Yellow
    Write-Host "将使用默认测试令牌 'test-token'" -ForegroundColor Yellow
    $env:TEST_USER_TOKEN = "test-token"
}

# 检查后端服务
Write-Host "检查后端服务..." -NoNewline
$backendReady = $false
try {
    $response = Invoke-WebRequest -Uri "$BackendUrl/api/v1/health" -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $backendReady = $true
        Write-Host " ✅ 就绪" -ForegroundColor Green
    }
} catch {
    Write-Host " ❌ 未就绪" -ForegroundColor Red
    Write-Host "后端服务未运行，请先启动后端服务:" -ForegroundColor Yellow
    Write-Host "  cd apps/backend" -ForegroundColor Yellow
    Write-Host "  python -m uvicorn main:app --reload --port 3200" -ForegroundColor Yellow
    exit 1
}

# 检查前端服务
Write-Host "检查前端服务..." -NoNewline
$frontendReady = $false
try {
    $response = Invoke-WebRequest -Uri $FrontendUrl -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $frontendReady = $true
        Write-Host " ✅ 就绪" -ForegroundColor Green
    }
} catch {
    Write-Host " ❌ 未就绪" -ForegroundColor Red
    Write-Host "前端服务未运行，请先启动前端服务:" -ForegroundColor Yellow
    Write-Host "  cd apps/frontend" -ForegroundColor Yellow
    Write-Host "  npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 构建测试命令
$testCmd = "npx playwright test"

if ($TestPattern) {
    $testCmd += " --grep `"$TestPattern`""
}

if ($Headed) {
    $testCmd += " --headed"
}

if ($Debug) {
    $testCmd += " --debug"
}

if ($UI) {
    $testCmd += " --ui"
}

# 设置环境变量
$env:E2E_BASE_URL = $FrontendUrl

Write-Host "执行测试命令: $testCmd" -ForegroundColor Cyan
Write-Host ""

# 执行测试
Invoke-Expression $testCmd

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "测试执行完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
