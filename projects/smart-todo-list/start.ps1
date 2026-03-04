@echo off
REM 智能待办清单启动脚本 (Windows)
REM 端口: 4003

cd /d "%~dp0"
set PORT=4003

echo === 启动智能待办清单 ===
echo 端口: %PORT%
echo 路径: %CD%
echo.

REM 检查端口是否被占用
netstat -ano | findstr ":%PORT%" >nul
if %errorlevel% equ 0 (
    echo 错误: 端口 %PORT% 已被占用
    echo 请检查是否有其他服务正在运行
    pause
    exit /b 1
)

REM 检查 Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到 Node.js
    pause
    exit /b 1
)

REM 安装依赖
if not exist "node_modules" (
    echo 安装依赖...
    call npm install
)

REM 启动应用
echo 启动应用...
call npm run dev

echo 应用已停止
pause
