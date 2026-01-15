@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo ========================================
echo fineSTM 后端服务管理工具
echo ========================================
echo.

if "%1"=="" goto :menu
if "%1"=="start" goto :start
if "%1"=="stop" goto :stop
if "%1"=="restart" goto :restart
if "%1"=="status" goto :status
if "%1"=="test" goto :test
goto :menu

:menu
echo 请选择操作:
echo 1. 启动服务
echo 2. 停止服务
echo 3. 重启服务
echo 4. 查看状态
echo 5. 测试连接
echo 6. 退出
echo.
set /p choice=请输入选项 (1-6):

if "%choice%"=="1" call :start
if "%choice%"=="2" call :stop
if "%choice%"=="3" call :restart
if "%choice%"=="4" call :status
if "%choice%"=="5" call :test
if "%choice%"=="6" exit /b 0
goto :menu

:start
echo ========================================
echo 正在启动后端服务...
echo ========================================
echo.

cd /d "%~dp0..\apps\public-web\src\features\mvp\phase1\backend"
echo 工作目录: %CD%
echo.

echo 检查 Python 环境...
python --version
if errorlevel 1 (
    echo [错误] Python 未安装或不在 PATH 中
    pause
    exit /b 1
)
echo.

echo 检查依赖...
python -c "import fastapi, uvicorn, pandas, requests" 2>nul
if errorlevel 1 (
    echo [警告] 部分依赖缺失，正在安装...
    pip install -r requirements_py38.txt
)
echo.

echo 检查端口占用...
netstat -ano | findstr ":8000" >nul
if not errorlevel 1 (
    echo [警告] 端口 8000 已被占用
    echo 正在尝试停止现有服务...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000"') do (
        taskkill /F /PID %%a 2>nul
    )
    timeout /t 2 >nul
)
echo.

echo 启动服务...
echo API 地址: http://0.0.0.0:8000/finestem/api
echo 公网地址: http://122.51.71.4:8000/finestem/api
echo.
echo 按 Ctrl+C 停止服务
echo ========================================
echo.

start "fineSTEM Backend" python -m uvicorn main:app --host 0.0.0.0 --port 8000 --root-path /finestem/api

timeout /t 3 >nul
goto :status

:stop
echo ========================================
echo 正在停止后端服务...
echo ========================================
echo.

netstat -ano | findstr ":8000" >nul
if errorlevel 1 (
    echo [信息] 端口 8000 没有运行的进程
    goto :end
)

echo 正在停止进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000"') do (
    echo 停止 PID: %%a
    taskkill /F /PID %%a 2>nul
)

timeout /t 2 >nul
echo.
echo [成功] 后端服务已停止
goto :end

:restart
call :stop
timeout /t 2 >nul
call :start
goto :end

:status
echo ========================================
echo 服务状态检查
echo ========================================
echo.

echo 检查端口 8000:
netstat -ano | findstr ":8000"
if errorlevel 1 (
    echo [状态] 端口 8000 未使用
) else (
    echo [状态] 端口 8000 正在使用
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
        echo 进程 PID: %%a
    )
)
echo.

echo 测试后端 API:
python -c "import requests; r=requests.get('http://localhost:8000/finestem/api/health', timeout=2); print('响应:', r.text if r.status_code==200 else '失败')" 2>nul
if errorlevel 1 (
    echo [状态] API 连接失败
) else (
    echo [状态] API 响应正常
)
echo.
goto :end

:test
echo ========================================
echo API 连接测试
echo ========================================
echo.

python -c "import requests; r=requests.get('http://localhost:8000/finestem/api/health', timeout=5); print(r.text)"
if errorlevel 1 (
    echo [错误] 无法连接到后端服务
    echo 请先启动服务: manage_backend.bat start
)
echo.

:end
pause
