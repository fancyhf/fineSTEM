@echo off
chcp 65001
cls
echo ========================================
echo AI 自动续接功能 - Playwright E2E 测试
echo ========================================
echo.

REM 设置环境变量
set E2E_API_URL=http://localhost:3200/api/v1
set BASE_URL=http://localhost:5184/create

echo [配置]
echo   E2E_API_URL=%E2E_API_URL%
echo   BASE_URL=%BASE_URL%
echo.

REM 检查后端服务
echo [检查] 检查后端的API服务...
powershell -Command "try { $r = Invoke-WebRequest -Uri '%E2E_API_URL%/health' -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
    echo   ⚠️  后端服务未运行，请先启动后端服务
echo   运行: cd apps/backend ^&^& python -m app.main
    pause
    exit /b 1
)
echo   ✅ 后端服务运行中
echo.

REM 检查前端服务
echo [检查] 检查前端服务...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5184' -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
    echo   ⚠️  前端服务未运行，请先启动前端服务
echo   运行: cd apps/frontend ^&^& npm run dev
    pause
    exit /b 1
)
echo   ✅ 前端服务运行中
echo.

REM 进入前端目录
cd apps/frontend

echo [测试] 开始运行 Playwright 测试...
echo   测试文件: tests/specs/ai-auto-continue.spec.ts
echo   预计耗时: 5-10 分钟
echo.

REM 运行测试
npx playwright test tests/specs/ai-auto-continue.spec.ts --reporter=list --timeout=300000

if errorlevel 1 (
    echo.
    echo ========================================
    echo ❌ 测试失败
    echo ========================================
    echo 查看测试报告: npx playwright show-report
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ 所有 Playwright 测试通过！
echo ========================================
echo.
echo 查看详细报告:
echo   npx playwright show-report
echo.
pause
