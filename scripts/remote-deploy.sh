#!/bin/bash

# 远程服务器自动部署脚本
# 用于在 Lighthouse 服务器上部署 FineSTEM

# 颜色定义
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m"

# 服务器配置（可通过环境变量覆盖）
SERVER_IP="${SERVER_IP:-43.140.204.127}"
PROJECT_DIR="${PROJECT_DIR:-/root/fineSTEM_20251222134107}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-80}"

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}    Lighthouse 远程自动部署脚本${NC}"
echo -e "${GREEN}==========================================${NC}"
echo

# 1. 检查 SSH 连接
echo -e "${BLUE}1. 检查 SSH 连接${NC}"
if ! ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@$SERVER_IP "echo 'SSH 连接成功'" 2>/dev/null; then
    echo -e "${RED}✗ SSH 连接失败${NC}"
    exit 1
fi
echo -e "${GREEN}✓ SSH 连接成功${NC}"
echo

# 2. 拉取最新代码
echo -e "${BLUE}2. 拉取最新代码${NC}"
ssh root@$SERVER_IP "cd $PROJECT_DIR && git pull origin main"
echo -e "${GREEN}✓ 代码拉取完成${NC}"
echo

# 3. 停止并删除旧容器
echo -e "${BLUE}3. 停止并删除旧容器${NC}"
ssh root@$SERVER_IP "cd $PROJECT_DIR && docker-compose down --remove-orphans"
ssh root@$SERVER_IP "docker rmi finestem-frontend 2>/dev/null || true"
echo -e "${GREEN}✓ 容器清理完成${NC}"
echo

# 4. 清理 Docker 缓存
echo -e "${BLUE}4. 清理 Docker 构建缓存${NC}"
ssh root@$SERVER_IP "docker builder prune -f"
ssh root@$SERVER_IP "docker system prune -f --volumes"
echo -e "${GREEN}✓ 缓存清理完成${NC}"
echo

# 5. 重新构建前端（无缓存）
echo -e "${BLUE}5. 重新构建前端镜像（无缓存）${NC}"
ssh root@$SERVER_IP "cd $PROJECT_DIR && docker-compose build frontend --no-cache"
echo -e "${GREEN}✓ 前端构建完成${NC}"
echo

# 6. 启动服务
echo -e "${BLUE}6. 启动服务${NC}"
ssh root@$SERVER_IP "cd $PROJECT_DIR && docker-compose up -d"
echo -e "${GREEN}✓ 服务启动完成${NC}"
echo

# 7. 等待服务就绪
echo -e "${YELLOW}等待服务启动...${NC}"
sleep 15
echo

# 8. 验证构建结果
echo -e "${BLUE}7. 验证构建结果${NC}"
echo -e "${YELLOW}检查 nginx 配置:${NC}"
ssh root@$SERVER_IP "docker exec finestem-frontend grep -A 5 'location /track-e' /etc/nginx/conf.d/default.conf"
echo

# 9. 健康检查
echo -e "${BLUE}8. 健康检查${NC}"

BACKEND_STATUS=$(ssh root@$SERVER_IP "curl -s -o /dev/null -w '%{http_code}' http://localhost:${BACKEND_PORT}/health 2>/dev/null || echo '000'")
if [ "$BACKEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ 后端服务正常: http://$SERVER_IP:${BACKEND_PORT}/health${NC}"
else
    echo -e "${RED}✗ 后端服务异常，状态码: $BACKEND_STATUS${NC}"
fi

FRONTEND_STATUS=$(ssh root@$SERVER_IP "curl -s -o /dev/null -w '%{http_code}' http://localhost:${FRONTEND_PORT} 2>/dev/null || echo '000'")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ 前端服务正常: http://$SERVER_IP${NC}"
else
    echo -e "${RED}✗ 前端服务异常，状态码: $FRONTEND_STATUS${NC}"
fi

TRACK_E_STATUS=$(ssh root@$SERVER_IP "curl -s -o /dev/null -w '%{http_code}' http://localhost:${FRONTEND_PORT}/track-e/dataset/mock 2>/dev/null || echo '000'")
if [ "$TRACK_E_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Track E API 正常: http://$SERVER_IP/track-e/dataset/mock${NC}"
else
    echo -e "${YELLOW}⚠ Track E API 状态码: $TRACK_E_STATUS${NC}"
fi

echo

# 10. 最终说明
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}         部署完成！${NC}"
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}访问地址: ${NC}http://$SERVER_IP"
echo -e "${GREEN}Track E:  ${NC}http://$SERVER_IP/track-e"
echo -e "${GREEN}Track A:  ${NC}http://$SERVER_IP/track-a"
echo
echo -e "${BLUE}环境变量:${NC}"
echo -e "  SERVER_IP=${SERVER_IP}"
echo -e "  PROJECT_DIR=${PROJECT_DIR}"
echo -e "  BACKEND_PORT=${BACKEND_PORT}"
echo -e "  FRONTEND_PORT=${FRONTEND_PORT}"
echo
echo -e "${YELLOW}如果问题仍然存在：${NC}"
echo -e "1. 清除浏览器缓存（Ctrl+Shift+Delete）"
echo -e "2. 使用隐私/无痕模式访问"
echo -e "3. 在 URL 后添加版本参数: ?v=$(date +%Y%m%d%H%M)"
echo -e "4. 检查浏览器控制台中的网络请求 URL"
echo
echo -e "${BLUE}管理命令:${NC}"
echo -e "查看日志: ${YELLOW}ssh root@$SERVER_IP 'docker-compose logs -f frontend'${NC}"
echo -e "重启服务: ${YELLOW}ssh root@$SERVER_IP 'docker-compose restart frontend'${NC}"
echo -e "${GREEN}==========================================${NC}"
