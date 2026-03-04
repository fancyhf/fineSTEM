@echo off
REM 文学知识卡启动脚本 (Windows)
REM 端口: 4001

cd /d "%~dp0"
set PORT=4001

echo === 启动文学知识卡应用 ===
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

REM 检查 Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到 Python
    pause
    exit /b 1
)

REM 安装依赖
echo 检查依赖...
pip install Flask

REM 启动应用
echo 启动应用...
cd src
set FLASK_APP=app.py
set FLASK_PORT=%PORT%
python app.py

echo 应用已停止
pause
