#!/bin/bash

# FineSTEM 快速部署脚本（修复版本）
# 解决网络和依赖问题

# 颜色定义
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

# 显示欢迎信息
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}    FineSTEM 快速部署脚本 (修复版本)${NC}"
echo -e "${GREEN}==========================================${NC}"
echo

# 检查系统环境
echo -e "${BLUE}1. 检查系统环境${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}错误: Docker Compose 未安装${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker 和 Docker Compose 已安装${NC}"
echo

# 清理旧的容器和镜像
echo -e "${BLUE}2. 清理旧的容器和镜像${NC}"
docker-compose down --remove-orphans 2>/dev/null || true
docker system prune -f 2>/dev/null || true
echo -e "${GREEN}✓ 清理完成${NC}"
echo

# 创建网络（如果不存在）
echo -e "${BLUE}3. 配置网络${NC}"
docker network create finestem-network 2>/dev/null || true
echo -e "${GREEN}✓ 网络配置完成${NC}"
echo

# 构建后端服务
echo -e "${BLUE}4. 构建后端服务${NC}"
echo -e "${YELLOW}正在构建后端镜像...${NC}"
if docker-compose build backend --no-cache; then
    echo -e "${GREEN}✓ 后端服务构建成功${NC}"
else
    echo -e "${RED}✗ 后端服务构建失败${NC}"
    echo -e "${YELLOW}尝试单独构建后端镜像...${NC}"
    cd ./apps/public-web/src/features/mvp/phase1/backend
    if docker build -t finestem-backend . --no-cache; then
        echo -e "${GREEN}✓ 后端单独构建成功${NC}"
    else
        echo -e "${RED}✗ 后端构建完全失败${NC}"
        exit 1
    fi
    cd - > /dev/null
fi
echo

# 启动后端服务
echo -e "${BLUE}5. 启动后端服务${NC}"
docker-compose up -d backend
echo -e "${YELLOW}等待后端服务启动...${NC}"
sleep 20

# 检查后端健康状态
echo -e "${YELLOW}检查后端健康状态...${NC}"
for i in {1..10}; do
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 后端服务健康${NC}"
        break
    else
        echo -e "${YELLOW}等待后端服务启动... ($i/10)${NC}"
        sleep 5
    fi
    
    if [ $i -eq 10 ]; then
        echo -e "${RED}✗ 后端服务健康检查失败${NC}"
        echo -e "${YELLOW}查看后端日志:${NC}"
        docker-compose logs backend
    fi
done
echo

# 构建前端服务
echo -e "${BLUE}6. 构建前端服务${NC}"
echo -e "${YELLOW}正在构建前端镜像...${NC}"
if docker-compose build frontend --no-cache; then
    echo -e "${GREEN}✓ 前端服务构建成功${NC}"
else
    echo -e "${RED}✗ 前端服务构建失败${NC}"
    echo -e "${YELLOW}尝试单独构建前端镜像...${NC}"
    cd ./apps/public-web/src/features/mvp/phase1/web
    if docker build -t finestem-frontend . --no-cache; then
        echo -e "${GREEN}✓ 前端单独构建成功${NC}"
    else
        echo -e "${RED}✗ 前端构建完全失败${NC}"
        exit 1
    fi
    cd - > /dev/null
fi
echo

# 启动前端服务
echo -e "${BLUE}7. 启动前端服务${NC}"
docker-compose up -d frontend
echo -e "${YELLOW}等待前端服务启动...${NC}"
sleep 10

# 最终健康检查
echo -e "${BLUE}8. 最终健康检查${NC}"

# 检查后端
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
if [ "$BACKEND_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✓ 后端服务正常: http://localhost:8000${NC}"
else
    echo -e "${RED}✗ 后端服务异常，状态码: $BACKEND_STATUS${NC}"
fi

# 检查前端
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✓ 前端服务正常: http://localhost:80${NC}"
else
    echo -e "${RED}✗ 前端服务异常，状态码: $FRONTEND_STATUS${NC}"
fi

echo

# 显示部署结果
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}         部署完成！${NC}"
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}前端访问地址:${NC} http://localhost:80"
echo -e "${GREEN}后端 API 地址:${NC} http://localhost:8000"
echo -e "${GREEN}后端健康检查:${NC} http://localhost:8000/health"
echo
echo -e "${BLUE}管理命令:${NC}"
echo -e "查看状态: ${YELLOW}docker-compose ps${NC}"
echo -e "查看日志: ${YELLOW}docker-compose logs -f${NC}"
echo -e "停止服务: ${YELLOW}docker-compose down${NC}"
echo -e "重启服务: ${YELLOW}docker-compose restart${NC}"
echo -e "${GREEN}==========================================${NC}"