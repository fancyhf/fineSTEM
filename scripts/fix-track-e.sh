#!/bin/bash

# Track E 修复部署脚本
# 修复 localhost:8001 硬编码问题

# 颜色定义
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m"

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}    Track E 修复部署脚本${NC}"
echo -e "${GREEN}==========================================${NC}"
echo

# 1. 拉取最新代码
echo -e "${BLUE}1. 拉取最新代码${NC}"
cd /root/fineSTEM_20251222134107
git pull origin main
echo -e "${GREEN}✓ 代码拉取完成${NC}"
echo

# 2. 停止并删除旧容器
echo -e "${BLUE}2. 停止并删除旧容器${NC}"
docker-compose down --remove-orphans
docker rmi finestem-frontend 2>/dev/null || true
echo -e "${GREEN}✓ 容器清理完成${NC}"
echo

# 3. 清理 Docker 缓存（重要！）
echo -e "${BLUE}3. 清理 Docker 构建缓存${NC}"
docker builder prune -f
docker system prune -f --volumes
echo -e "${GREEN}✓ 缓存清理完成${NC}"
echo

# 4. 重新构建前端（无缓存）
echo -e "${BLUE}4. 重新构建前端镜像（无缓存）${NC}"
docker-compose build frontend --no-cache
echo -e "${GREEN}✓ 前端构建完成${NC}"
echo

# 5. 启动服务
echo -e "${BLUE}5. 启动服务${NC}"
docker-compose up -d
echo -e "${GREEN}✓ 服务启动完成${NC}"
echo

# 6. 等待服务就绪
echo -e "${YELLOW}等待服务启动...${NC}"
sleep 15

# 7. 验证构建结果
echo -e "${BLUE}6. 验证构建结果${NC}"
echo -e "${YELLOW}检查前端 JS 文件中的 API_BASE_URL...${NC}"
docker exec finestem-frontend sh -c 'find /usr/share/nginx/html -name "*.js" -type f -exec grep -o "VITE_API_BASE_URL[^,\\\"]*" {} \; | head -5'
echo

# 8. 健康检查
echo -e "${BLUE}7. 健康检查${NC}"

BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
if [ "$BACKEND_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✓ 后端服务正常: http://localhost:8000/health${NC}"
else
    echo -e "${RED}✗ 后端服务异常，状态码: $BACKEND_STATUS${NC}"
fi

FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✓ 前端服务正常: http://localhost:80${NC}"
else
    echo -e "${RED}✗ 前端服务异常，状态码: $FRONTEND_STATUS${NC}"
fi

echo

# 9. 最终说明
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}         部署完成！${NC}"
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}访问地址: ${NC}http://43.140.204.127"
echo -e "${GREEN}Track E:  ${NC}http://43.140.204.127/track-e"
echo
echo -e "${YELLOW}如果问题仍然存在：${NC}"
echo -e "1. 清除浏览器缓存（Ctrl+Shift+Delete）"
echo -e "2. 使用隐私/无痕模式访问"
echo -e "3. 在 URL 后添加版本参数: ?v=20251225"
echo -e "4. 检查浏览器控制台中的网络请求 URL"
echo
echo -e "${BLUE}管理命令:${NC}"
echo -e "查看日志: ${YELLOW}docker-compose logs -f frontend${NC}"
echo -e "重启服务: ${YELLOW}docker-compose restart frontend${NC}"
echo -e "${GREEN}==========================================${NC}"
