@echo off

REM FineSTEM 生产环境启动脚本

REM 颜色定义
color 0A

REM 配置变量
set PROJECT_DIR=%~dp0
set DOCKER_COMPOSE_FILE=%PROJECT_DIR%docker-compose.yml

REM 显示欢迎信息
echo ==========================================
echo       FineSTEM 生产环境启动脚本
echo ==========================================
echo.

REM 检查 Docker 是否运行
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

REM 检查命令格式（兼容新版和旧版 Docker）
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

REM 构建和启动服务
echo 正在构建和启动服务...
echo.

REM 停止并移除旧容器
echo [1/3] 停止并移除旧容器...
%DOCKER_CMD% -f "%DOCKER_COMPOSE_FILE%" down
echo.

REM 构建新镜像
echo [2/3] 构建新镜像...
%DOCKER_CMD% -f "%DOCKER_COMPOSE_FILE%" build --no-cache
echo.

REM 启动新容器
echo [3/3] 启动新容器...
%DOCKER_CMD% -f "%DOCKER_COMPOSE_FILE%" up -d
echo.

REM 等待服务启动
echo 等待服务初始化...
timeout /t 10 >nul
echo.

REM 显示状态
echo 显示服务状态...
%DOCKER_CMD% -f "%DOCKER_COMPOSE_FILE%" ps
echo.

REM 显示访问地址
echo ==========================================
echo       服务启动完成！
echo ==========================================
echo 前端访问地址: http://localhost:8081/finestem
echo 后端 API 地址: http://localhost:8001/api
echo 健康检查地址: http://localhost:8081/health
echo ==========================================
echo.
echo 查看日志命令: %DOCKER_CMD% -f "%DOCKER_COMPOSE_FILE%" logs -f
echo 停止服务命令: %DOCKER_CMD% -f "%DOCKER_COMPOSE_FILE%" down
echo.
echo 按任意键退出...
pause >nul
