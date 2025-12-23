#!/bin/bash

# FineSTEM 自动化部署脚本

# 颜色定义
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

# 配置变量
PROJECT_DIR="$(pwd)"
DOCKER_COMPOSE_FILE="docker-compose.yml"
ENV_FILE="apps/public-web/src/features/mvp/phase1/backend/.env.production"

# 显示欢迎信息
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}       FineSTEM 自动化部署脚本${NC}"
echo -e "${GREEN}==========================================${NC}"
echo

# 检查 Docker 和 Docker Compose 是否安装
check_dependencies() {
    echo -e "${YELLOW}检查依赖...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}错误: Docker 未安装${NC}"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}错误: Docker Compose 未安装${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}依赖检查通过${NC}"
    echo
}

# 检查环境变量配置
check_env() {
    echo -e "${YELLOW}检查环境变量配置...${NC}"
    
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${YELLOW}警告: 环境变量文件 $ENV_FILE 不存在，将使用默认配置${NC}"
        echo
        return
    fi
    
    # 检查必填环境变量
    if grep -q "your-production-deepseek-key" "$ENV_FILE"; then
        echo -e "${YELLOW}警告: 请更新 $ENV_FILE 中的 DEEPSEEK_API_KEY${NC}"
    fi
    
    echo -e "${GREEN}环境变量检查完成${NC}"
    echo
}

# 构建和部署
deploy() {
    echo -e "${YELLOW}开始构建和部署...${NC}"
    
    # 拉取最新代码（如果使用 Git）
    if [ -d ".git" ]; then
        echo -e "${YELLOW}拉取最新代码...${NC}"
        git pull
        echo
    fi
    
    # 停止并移除旧容器
    echo -e "${YELLOW}停止并移除旧容器...${NC}"
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    echo
    
    # 构建新镜像
    echo -e "${YELLOW}构建新镜像...${NC}"
    docker-compose -f "$DOCKER_COMPOSE_FILE" build --no-cache
    echo
    
    # 启动新容器
    echo -e "${YELLOW}启动新容器...${NC}"
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    echo
    
    # 等待服务启动
    echo -e "${YELLOW}等待服务启动...${NC}"
    sleep 10
    echo
}

# 健康检查
health_check() {
    echo -e "${YELLOW}执行健康检查...${NC}"
    
    # 检查前端服务
    FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80)
    if [ "$FRONTEND_STATUS" -eq 200 ]; then
        echo -e "${GREEN}前端服务健康检查通过: http://localhost:80${NC}"
    else
        echo -e "${RED}前端服务健康检查失败，状态码: $FRONTEND_STATUS${NC}"
        return 1
    fi
    
    # 检查后端服务
    BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
    if [ "$BACKEND_STATUS" -eq 200 ]; then
        echo -e "${GREEN}后端服务健康检查通过: http://localhost:8000/health${NC}"
    else
        echo -e "${RED}后端服务健康检查失败，状态码: $BACKEND_STATUS${NC}"
        return 1
    fi
    
    echo -e "${GREEN}所有服务健康检查通过${NC}"
    echo
    return 0
}

# 显示部署结果
show_result() {
    echo -e "${GREEN}==========================================${NC}"
    echo -e "${GREEN}       部署完成！${NC}"
    echo -e "${GREEN}==========================================${NC}"
    echo -e "${GREEN}前端访问地址:${NC} http://localhost:80"
    echo -e "${GREEN}后端 API 地址:${NC} http://localhost:8000"
    echo -e "${GREEN}后端健康检查:${NC} http://localhost:8000/health"
    echo -e "${GREEN}==========================================${NC}"
}

# 主流程
main() {
    check_dependencies
    check_env
    deploy
    if health_check; then
        show_result
        exit 0
    else
        echo -e "${RED}部署失败，部分服务健康检查未通过${NC}"
        echo -e "${YELLOW}请查看日志: docker-compose -f $DOCKER_COMPOSE_FILE logs${NC}"
        exit 1
    fi
}

# 执行主流程
main
