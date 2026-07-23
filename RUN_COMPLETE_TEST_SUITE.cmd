@echo off
chcp 65001
cls
echo ========================================
echo AI 自动续接功能 - 完整测试套件
echo ========================================
echo.
echo 本脚本将：
echo   1. 启动后端服务
echo   2. 启动前端服务
echo   3. 运行后端 API 测试
echo   4. 运行前端 Playwright E2E 测试
echo.
echo 预计总耗时：15-20 分钟
echo.
pause

set BACKEND_PID=
set FRONTEND_PID=

REM 启动后端服务
echo.
echo [1/6] 启动后端服务...
start /B cmd /c "cd apps/backend && python -m app.main > test_logs_backend.txt 2>&1"
timeout /t 3 /nobreak >nul
echo   ✅ 后端服务已启动
echo   日志: apps/backend/test_logs_backend.txt

REM 启动前端服务
echo.
echo [2/6] 启动前端服务...
start /B cmd /c "cd apps/frontend && npm run dev > test_logs_frontend.txt 2>&1"
timeout /t 5 /nobreak >nul
echo   ✅ 前端服务已启动
echo   日志: apps/frontend/test_logs_frontend.txt

REM 等待服务完全启动
echo.
echo [3/6] 等待服务启动（10秒）...
timeout /t 10 /nobreak >nul

REM 运行后端测试
echo.
echo [4/6] 运行后端 API 测试...
cd apps/backend

echo   - 截断检测测试
python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_truncation_detection -v --tb=short
if errorlevel 1 goto test_failed

echo   - 短代码生成测试（约1分钟）
python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_short_code_no_truncation -v --timeout=120 --tb=short
if errorlevel 1 goto test_failed

echo   - 长代码自动续接测试（约3分钟）
python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_long_code_auto_continue -v --timeout=300 --tb=short
if errorlevel 1 goto test_failed

echo   - 超长代码多次续接测试（约8分钟）
python -m pytest tests/test_auto_continue_api.py::TestAutoContinueAPI::test_ultra_long_code_multiple_continues -v --timeout=600 --tb=short
if errorlevel 1 goto test_failed

cd ../..

REM 运行前端测试
echo.
echo [5/6] 运行前端 Playwright E2E 测试（约5分钟）...
cd apps/frontend
set E2E_API_URL=http://localhost:3200/api/v1
npx playwright test tests/specs/ai-auto-continue.spec.ts --reporter=list --timeout=300000
if errorlevel 1 goto test_failed
cd ../..

REM 生成报告
echo.
echo [6/6] 生成测试报告...
echo ======================================== > test_report.txt
echo AI 自动续接功能 - 测试报告 >> test_report.txt
echo ======================================== >> test_report.txt
echo. >> test_report.txt
echo 执行时间: %date% %time% >> test_report.txt
echo 状态: ✅ 所有测试通过 >> test_report.txt
echo. >> test_report.txt
echo 测试覆盖: >> test_report.txt
echo   - 后端单元测试: 截断检测逻辑 >> test_report.txt
echo   - 后端集成测试: 短代码/长代码/超长代码生成 >> test_report.txt
echo   - 前端 E2E 测试: 自动续接流程 >> test_report.txt
echo. >> test_report.txt
echo 详细日志: >> test_report.txt
echo   - 后端日志: apps/backend/test_logs_backend.txt >> test_report.txt
echo   - 前端日志: apps/frontend/test_logs_frontend.txt >> test_report.txt
echo ======================================== >> test_report.txt

echo   报告已保存: test_report.txt

REM 停止服务
echo.
echo 停止服务...
taskkill /F /FI "WINDOWTITLE eq *python -m app.main*" 2>nul
taskkill /F /FI "WINDOWTITLE eq *npm run dev*" 2>nul

echo.
echo ========================================
echo ✅ 完整测试套件执行成功！
echo ========================================
echo.
type test_report.txt
echo.
pause
exit /b 0

:test_failed
echo.
echo ========================================
echo ❌ 测试失败！
echo ========================================
echo.
echo 正在停止服务...
taskkill /F /FI "WINDOWTITLE eq *python -m app.main*" 2>nul
taskkill /F /FI "WINDOWTITLE eq *npm run dev*" 2>nul
pause
exit /b 1
