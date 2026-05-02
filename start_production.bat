@echo off

REM FineSTEM 生产环境启动脚本

color 0A

set PROJECT_DIR=%~dp0
set DOCKER_COMPOSE_FILE=%PROJECT_DIR%docker-compose.yml

echo ==========================================
echo       FineSTEM 生产环境启动脚本
echo ==========================================
echo.

docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo 错误: Docker 未运行
    echo 请先启动 Docker Desktop
    echo.
    echo 如果你想本地开发（不需要 Docker），请使用 start_system.bat
    echo.
    pause
    exit /b 1
)

echo 检查 Docker 服务状态: 正常
echo.

docker compose version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set DOCKER_CMD=docker compose
) else (
    docker-compose --version >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        set DOCKER_CMD=docker-compose
    ) else (
        echo 错误: 找不到 docker compose 命令
        echo 请确保 Docker Desktop 已正确安装
        pause
        exit /b 1
    )
)

echo 使用 Docker 命令: %DOCKER_CMD%
echo.

echo 正在构建和启动服务...
echo.

echo [1/3] 停止并移除旧容器...
%DOCKER_CMD% -f "%DOCKER_COMPOSE_FILE%" down
echo.

echo [2/3] 构建新镜像...
%DOCKER_CMD% -f "%DOCKER_COMPOSE_FILE%" build --no-cache
echo.

echo [3/3] 启动新容器...
%DOCKER_CMD% -f "%DOCKER_COMPOSE_FILE%" up -d
echo.

echo 等待服务初始化...
timeout /t 10 >nul
echo.

echo 显示服务状态...
%DOCKER_CMD% -f "%DOCKER_COMPOSE_FILE%" ps
echo.

echo ==========================================
echo       服务启动完成！
echo ==========================================
echo 前端访问地址: http://localhost:5174/finestem
echo 后端 API 地址: http://localhost:3000/api
echo 健康检查地址: http://localhost:5174/finestem/health
echo ==========================================
echo.
echo 查看日志命令: %DOCKER_CMD% -f "%DOCKER_COMPOSE_FILE%" logs -f
echo 停止服务命令: %DOCKER_CMD% -f "%DOCKER_COMPOSE_FILE%" down
echo.
echo 按任意键退出...
pause >nul
