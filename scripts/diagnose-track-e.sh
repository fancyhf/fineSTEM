#!/bin/bash

# Track E 诊断脚本
# 用于排查 localhost:8001 问题

# 颜色定义
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m"

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}    Track E 诊断脚本${NC}"
echo -e "${BLUE}==========================================${NC}"
echo

# 1. 检查 Git 状态
echo -e "${BLUE}1. 检查 Git 状态${NC}"
cd /root/fineSTEM_20251222134107
echo -e "${YELLOW}当前分支:${NC}"
git branch --show-current
echo -e "${YELLOW}最新提交:${NC}"
git log --oneline -1
echo -e "${YELLOW}Dockerfile 最后修改:${NC}"
ls -la apps/public-web/src/features/mvp/phase1/web/Dockerfile
echo

# 2. 检查 Dockerfile 内容
echo -e "${BLUE}2. 检查 Dockerfile 内容${NC}"
echo -e "${YELLOW}查找 COPY .env*:${NC}"
grep -n "COPY.*env" apps/public-web/src/features/mvp/phase1/web/Dockerfile || echo -e "${RED}未找到 COPY .env* 行！${NC}"
echo

# 3. 检查前端镜像
echo -e "${BLUE}3. 检查前端镜像${NC}"
echo -e "${YELLOW}前端镜像列表:${NC}"
docker images | grep finestem-frontend
echo -e "${YELLOW}镜像创建时间:${NC}"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}" | grep finestem-frontend
echo

# 4. 检查容器状态
echo -e "${BLUE}4. 检查容器状态${NC}"
docker ps -a | grep finestem-frontend
echo

# 5. 检查容器内的 JS 文件
echo -e "${BLUE}5. 检查容器内的 JS 文件${NC}"
echo -e "${YELLOW}查找 index.js 或类似文件:${NC}"
docker exec finestem-frontend ls -la /usr/share/nginx/html/assets/ 2>/dev/null | grep -E "\.js$" | head -10
echo

# 6. 检查 JS 文件中的 API_BASE_URL
echo -e "${BLUE}6. 检查 JS 文件中的 API_BASE_URL${NC}"
echo -e "${YELLOW}搜索 VITE_API_BASE_URL:${NC}"
docker exec finestem-frontend sh -c 'find /usr/share/nginx/html -name "*.js" -type f | head -3 | xargs grep -o "VITE_API_BASE_URL[^,\\\"]*" 2>/dev/null'
echo

# 7. 检查 .env.production 文件
echo -e "${BLUE}7. 检查 .env.production 文件${NC}"
echo -e "${YELLOW}本地文件内容:${NC}"
cat apps/public-web/src/features/mvp/phase1/web/.env.production
echo

# 8. 检查 nginx 配置
echo -e "${BLUE}8. 检查 nginx 配置${NC}"
echo -e "${YELLOW}nginx 配置文件:${NC}"
docker exec finestem-frontend cat /etc/nginx/conf.d/default.conf
echo

# 9. 检查后端 API
echo -e "${BLUE}9. 检查后端 API${NC}"
echo -e "${YELLOW}直接访问后端:${NC}"
curl -s http://localhost:8000/health || echo -e "${RED}后端访问失败${NC}"
echo
echo -e "${YELLOW}访问 Track E API:${NC}"
curl -s http://localhost:8000/track-e/dataset/mock | head -5 || echo -e "${RED}Track E API 访问失败${NC}"
echo

# 10. 检查通过前端访问
echo -e "${BLUE}10. 检查通过前端访问${NC}"
echo -e "${YELLOW}通过 nginx 访问 health:${NC}"
curl -s http://localhost/health || echo -e "${RED}nginx 代理失败${NC}"
echo
echo -e "${YELLOW}通过 nginx 访问 Track E:${NC}"
curl -s http://localhost/track-e/dataset/mock | head -5 || echo -e "${RED}nginx 代理 Track E 失败${NC}"
echo

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}    诊断完成！${NC}"
echo -e "${GREEN}==========================================${NC}"
echo
echo -e "${YELLOW}关键检查点：${NC}"
echo -e "1. Dockerfile 是否包含 ${GREEN}COPY .env* ./${NC}"
echo -e "2. 前端镜像创建时间是否是最近"
echo -e "3. JS 文件中是否还有 ${RED}localhost:8001${NC}"
echo -e "4. nginx 是否正确代理到 backend"
echo -e "5. 后端 API 是否正常工作"
echo
