# AI 自动续接功能 - 智能测试运行器
# 利用后端热重载特性，无需重启服务即可运行测试

param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$All,
    [switch]$Watch
)

$ErrorActionPreference = "Stop"

function Write-Header($text) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host $text -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-Service($url, $name) {
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 3 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✅ $name 运行中" -ForegroundColor Green
            return $true
        }
    } catch {
        Write-Host "   ⚠️  $name 未运行" -ForegroundColor Yellow
        return $false
    }
    return $false
}

function Start-BackendTest() {
    Write-Header "后端 API 测试"
    
    Set-Location apps/backend
    
    # 检查 pytest 是否可用
    $pytest = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pytest) {
        Write-Error "Python 未安装"
        return
    }
    
    # 运行测试
    Write-Host "[1/4] 截断检测测试..." -ForegroundColor Yellow
    python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_truncation_detection -v --tb=short
    if ($LASTEXITCODE -ne 0) { return $false }
    
    Write-Host ""
    Write-Host "[2/4] 短代码生成测试（约1分钟）..." -ForegroundColor Yellow
    python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_short_code_no_truncation -v --timeout=120 --tb=short
    if ($LASTEXITCODE -ne 0) { return $false }
    
    Write-Host ""
    Write-Host "[3/4] 长代码自动续接测试（约3分钟）..." -ForegroundColor Yellow
    python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_long_code_auto_continue -v --timeout=300 --tb=short
    if ($LASTEXITCODE -ne 0) { return $false }
    
    Write-Host ""
    Write-Host "[4/4] 超长代码多次续接测试（约8分钟）..." -ForegroundColor Yellow
    python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_ultra_long_code_multiple_continues -v --timeout=600 --tb=short
    if ($LASTEXITCODE -ne 0) { return $false }
    
    Set-Location ../..
    return $true
}

function Start-FrontendTest() {
    Write-Header "前端 Playwright E2E 测试"
    
    # 检查服务
    $backendRunning = Test-Service "http://localhost:3200/health" "后端服务"
    $frontendRunning = Test-Service "http://localhost:5184" "前端服务"
    
    if (-not $backendRunning) {
        Write-Host ""
        Write-Host "请先启动后端服务：" -ForegroundColor Red
        Write-Host "   cd apps/backend" -ForegroundColor Gray
        Write-Host "   python main.py" -ForegroundColor Gray
        Write-Host ""
        Write-Host "注意：main.py 已配置 reload=True，支持热重载" -ForegroundColor Green
        return $false
    }
    
    if (-not $frontendRunning) {
        Write-Host ""
        Write-Host "请先启动前端服务：" -ForegroundColor Red
        Write-Host "   cd apps/frontend" -ForegroundColor Gray
        Write-Host "   npm run dev" -ForegroundColor Gray
        return $false
    }
    
    Set-Location apps/frontend
    
    # 设置环境变量
    $env:E2E_API_URL = "http://localhost:3200/api/v1"
    $env:BASE_URL = "http://localhost:5184/create"
    
    Write-Host ""
    Write-Host "环境配置：" -ForegroundColor Yellow
    Write-Host "   E2E_API_URL: $env:E2E_API_URL"
    Write-Host "   BASE_URL: $env:BASE_URL"
    Write-Host ""
    Write-Host "开始运行 Playwright 测试（约5-10分钟）..." -ForegroundColor Yellow
    Write-Host "利用后端热重载，无需重启服务" -ForegroundColor Green
    Write-Host ""
    
    npx playwright test tests/specs/ai-auto-continue.spec.ts --reporter=list --timeout=300000
    
    $success = $LASTEXITCODE -eq 0
    
    Set-Location ../..
    return $success
}

# 主逻辑
Write-Header "AI 自动续接功能 - 智能测试运行器"

# 检查参数
if ($BackendOnly) {
    $result = Start-BackendTest
    exit $result ? 0 : 1
}

if ($FrontendOnly) {
    $result = Start-FrontendTest
    exit $result ? 0 : 1
}

if ($All -or (-not $BackendOnly -and -not $FrontendOnly)) {
    # 运行所有测试
    $backendResult = Start-BackendTest
    
    if (-not $backendResult) {
        Write-Header "❌ 后端测试失败，停止执行"
        exit 1
    }
    
    $frontendResult = Start-FrontendTest
    
    if ($frontendResult) {
        Write-Header "✅ 所有测试通过！"
        exit 0
    } else {
        Write-Header "❌ 前端测试失败"
        exit 1
    }
}
