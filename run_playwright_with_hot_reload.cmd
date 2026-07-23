@echo off
chcp 65001
cls
echo ========================================
echo AI 自动续接功能 - Playwright 测试 (热重载模式)
echo ========================================
echo.
echo 此脚本将：
echo   1. 检查后端服务是否运行（使用热重载）
echo   2. 检查前端服务是否运行
echo   3. 直接运行 Playwright 测试（无需重启服务）
echo.

REM 检查后端服务
echo [1/3] 检查后端的API服务...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3200/health' -TimeoutSec 3; if ($r.StatusCode -eq 200) { Write-Host '   ✅ 后端服务运行中 (热重载模式)' -ForegroundColor Green; exit 0 } else { exit 1 } } catch { Write-Host '   ⚠️  后端服务未运行' -ForegroundColor Yellow; exit 1 }"
if errorlevel 1 (
    echo.
    echo 后端服务未运行，请先启动：
    echo   cd apps/backend
    echo   python main.py
    echo.
    echo 注意：main.py 已配置 reload=True，支持热重载
    pause
    exit /b 1
)

REM 检查前端服务
echo.
echo [2/3] 检查前端服务...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5184' -TimeoutSec 3; if ($r.StatusCode -eq 200) { Write-Host '   ✅ 前端服务运行中' -ForegroundColor Green; exit 0 } else { exit 1 } } catch { Write-Host '   ⚠️  前端服务未运行' -ForegroundColor Yellow; exit 1 }"
if errorlevel 1 (
    echo.
    echo 前端服务未运行，请先启动：
    echo   cd apps/frontend
    echo   npm run dev
    pause
    exit /b 1
)

REM 运行 Playwright 测试
echo.
echo [3/3] 运行 Playwright E2E 测试...
echo   测试文件: tests/specs/ai-auto-continue.spec.ts
echo   预计耗时: 5-10 分钟
echo   特点: 利用后端热重载，无需重启服务
echo.

cd apps/frontend
set E2E_API_URL=http://localhost:3200/api/v1
set BASE_URL=http://localhost:5184/create

npx playwright test tests/specs/ai-auto-continue.spec.ts --reporter=list --timeout=300000

if errorlevel 1 (
    echo.
    echo ========================================
    echo ❌ 测试失败
    echo ========================================
    echo.
    echo 查看测试报告:
    echo   npx playwright show-report
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ 所有 Playwright 测试通过！
echo ========================================
echo.
echo 测试利用后端热重载完成，服务仍在运行
echo.
pause
