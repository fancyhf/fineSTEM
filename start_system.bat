@echo off
cd /d "%~dp0"
echo ==========================================
echo       FineSTEM 开发环境启动脚本
echo ==========================================
echo.

echo [1/2] 启动后端服务 (端口 3000)...
start "FineSTEM Backend" cmd /k "cd apps\backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload"

echo.
echo [2/2] 启动前端服务 (端口 5174)...
start "FineSTEM Frontend" cmd /k "cd apps\frontend && npm run dev"

echo.
echo 等待服务初始化...
timeout /t 5 >nul

echo.
echo 正在打开浏览器...
start http://localhost:5174/finestem/

echo.
echo ==========================================
echo       系统启动完成！
echo ==========================================
echo 前端: http://localhost:5174/finestem
echo 后端: http://localhost:3000/api
echo ==========================================
