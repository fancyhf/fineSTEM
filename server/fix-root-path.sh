#!/bin/bash

# 修复主机 Nginx 根路径配置
# 将根路径 / 重定向到项目列表，而不是默认进入 fineSTEM

set -e

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}    修复 Nginx 根路径配置${NC}"
echo -e "${GREEN}==========================================${NC}"
echo

# 1. 备份当前配置
echo -e "${YELLOW}1. 备份当前配置${NC}"
if [ -f /etc/nginx/sites-enabled/default ]; then
    cp /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.backup.$(date +%Y%m%d%H%M%S)
    echo -e "${GREEN}✓ 配置已备份${NC}"
fi
echo

# 2. 检查新的 Nginx 配置
echo -e "${YELLOW}2. 检查配置文件${NC}"
if [ ! -f "nginx-root.conf" ]; then
    echo -e "${RED}✗ 错误: nginx-root.conf 文件不存在${NC}"
    echo -e "${RED}请先上传 nginx-root.conf 到当前目录${NC}"
    exit 1
fi

# 3. 复制新配置
echo -e "${YELLOW}3. 复制新配置${NC}"
cp nginx-root.conf /etc/nginx/sites-available/default
echo -e "${GREEN}✓ 配置文件已更新${NC}"
echo

# 4. 创建符号链接
echo -e "${YELLOW}4. 更新符号链接${NC}"
ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
echo -e "${GREEN}✓ 符号链接已更新${NC}"
echo

# 5. 测试配置
echo -e "${YELLOW}5. 测试配置${NC}"
if nginx -t; then
    echo -e "${GREEN}✓ 配置测试通过${NC}"
else
    echo -e "${RED}✗ 配置测试失败${NC}"
    echo -e "${YELLOW}恢复备份配置...${NC}"
    if [ -f /etc/nginx/sites-enabled/default.backup.* ]; then
        cp /etc/nginx/sites-enabled/default.backup.* /etc/nginx/sites-available/default
        ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
        echo -e "${GREEN}✓ 已恢复备份配置${NC}"
    fi
    exit 1
fi
echo

# 6. 重启 Nginx
echo -e "${YELLOW}6. 重启 Nginx${NC}"
systemctl restart nginx
sleep 2

# 7. 验证服务状态
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx 重启成功${NC}"
else
    echo -e "${RED}✗ Nginx 启动失败${NC}"
    systemctl status nginx
    exit 1
fi
echo

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}         修复完成！${NC}"
echo -e "${GREEN}==========================================${NC}"
echo
echo -e "${BLUE}访问地址:${NC}"
echo -e "  项目列表: http://43.140.204.127/"
echo -e "  fineSTEM:  http://43.140.204.127/fineSTEM"
echo -e "  project2:  http://43.140.204.127/project2"
echo -e "  project3:  http://43.140.204.127/project3"
echo
echo -e "${YELLOW}提示:${NC}"
echo -e "现在访问根路径将显示项目选择页面，而不是直接进入 fineSTEM"
echo -e "${GREEN}==========================================${NC}"
