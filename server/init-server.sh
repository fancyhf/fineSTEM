#!/bin/bash

# Tencent Lighthouse 多项目服务器初始化脚本
# 创建标准的目录结构和安装主机级 Nginx

set -e

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
NC="\033[0m"

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  多项目服务器初始化脚本${NC}"
echo -e "${GREEN}==========================================${NC}"
echo

# 1. 创建目录结构
echo -e "${YELLOW}1. 创建目录结构${NC}"
mkdir -p /root/projects
mkdir -p /root/docker/nginx/conf.d
echo -e "${GREEN}✓ 目录创建完成${NC}"
echo

# 2. 安装主机级 Nginx（如果未安装）
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}2. 安装主机级 Nginx${NC}"
    apt update
    apt install -y nginx
    systemctl enable nginx
    echo -e "${GREEN}✓ Nginx 安装完成${NC}"
else
    echo -e "${GREEN}✓ Nginx 已安装${NC}"
fi
echo

# 3. 配置主机级 Nginx
echo -e "${YELLOW}3. 配置主机级 Nginx${NC}"
if [ -f "nginx-projects.conf" ]; then
    cp nginx-projects.conf /root/docker/nginx/conf.d/projects.conf
    echo -e "${GREEN}✓ 主机 Nginx 配置已复制${NC}"
else
    echo -e "${YELLOW}⚠ 未找到 nginx-projects.conf，请手动配置${NC}"
fi

# 4. 配置 Nginx 主配置文件
echo -e "${YELLOW}4. 配置 Nginx 主配置${NC}"
cat > /etc/nginx/sites-available/projects.conf << 'EOF'
# 项目路由配置
include /root/docker/nginx/conf.d/*.conf;
EOF

# 创建符号链接
ln -sf /etc/nginx/sites-available/projects.conf /etc/nginx/sites-enabled/projects.conf

# 删除默认配置
rm -f /etc/nginx/sites-enabled/default

echo -e "${GREEN}✓ Nginx 主配置完成${NC}"
echo

# 5. 测试并重启 Nginx
echo -e "${YELLOW}5. 测试并重启 Nginx${NC}"
nginx -t
systemctl restart nginx

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}         初始化完成！${NC}"
echo -e "${GREEN}==========================================${NC}"
echo
echo -e "${YELLOW}下一步操作:${NC}"
echo -e "1. 部署每个项目："
echo -e "   - finestem:  git clone /path/to/finestem /root/projects/finestem/app"
echo -e "   - project2: git clone /path/to/project2 /root/projects/project2/app"
echo
echo -e "2. 为每个项目配置环境变量并运行 docker-compose"
echo
echo -e "${GREEN}==========================================${NC}"
