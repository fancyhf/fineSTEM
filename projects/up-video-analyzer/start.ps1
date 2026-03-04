@echo off
REM UP主视频内容分析器启动脚本 (Windows)
REM 端口: 4002

cd /d "%~dp0"
set PORT=4002

echo === 启动 UP主视频内容分析器 ===
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

REM 检查 Streamlit
streamlit --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到 Streamlit
    echo 正在安装依赖...
    pip install -r requirements.txt
)

REM 启动应用
echo 启动应用...
streamlit run src/main.py --server.port=%PORT% --server.headless=true

echo 应用已停止
pause
