@echo off
chcp 65001 >nul
echo ========================================
echo AI 自动续接功能 - 完整自动化测试
echo ========================================
echo.

set BACKEND_PID=
set FRONTEND_PID=

REM 启动后端服务
echo [1/5] 启动后端服务...
start /B cmd /c "cd apps/backend && python -m app.main > backend_test.log 2>&1"
for /f "tokens=2" %%a in ('tasklist ^| findstr "python.exe"') do set BACKEND_PID=%%a
echo 后端服务 PID: %BACKEND_PID%
timeout /t 3 /nobreak >nul

REM 启动前端服务
echo [2/5] 启动前端服务...
start /B cmd /c "cd apps/frontend && npm run dev > frontend_test.log 2>&1"
timeout /t 5 /nobreak >nul

REM 等待服务启动
echo [3/5] 等待服务启动...
timeout /t 10 /nobreak >nul

REM 运行后端测试
echo [4/5] 运行后端 API 测试...
cd apps/backend
python -m pytest tests/test_auto_continue_api.py -v --timeout=600 --tb=short > ..\..\test_results_backend.log 2>&1
echo 后端测试完成，结果保存在 test_results_backend.log

REM 运行前端测试
echo [5/5] 运行前端 E2E 测试...
cd ../frontend
set E2E_API_URL=http://localhost:3200/api/v1
npx playwright test tests/specs/ai-auto-continue.spec.ts --reporter=list --timeout=300000 > ..\..\test_results_frontend.log 2>&1
echo 前端测试完成，结果保存在 test_results_frontend.log

REM 生成测试报告
echo.
echo ========================================
echo 测试报告
echo ========================================
echo.

echo [后端测试结果]
type ..\..\test_results_backend.log | findstr /C:"PASSED" /C:"FAILED" /C:"ERROR" /C:"test session"
echo.

echo [前端测试结果]
type ..\..\test_results_frontend.log | findstr /C:"Passed" /C:"Failed" /C:"Error" /C:"Test"
echo.

REM 清理
echo 清理进程...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM node.exe 2>nul

echo.
echo ========================================
echo 测试完成！
echo ========================================
pause
