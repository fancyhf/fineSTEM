#!/bin/bash

# Tencent Lighthouse 服务器 Nginx 根路径修复脚本
# 用于 Linux/Mac 环境执行

set -e

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
NC="\033[0m"

SERVER_IP="43.140.204.127"

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}    Nginx 根路径修复${NC}"
echo -e "${GREEN}=========================================${NC}"
echo

# 1. 上传 nginx-root.conf
echo -e "${YELLOW}[1/5] 上传 nginx-root.conf...${NC}"
scp server/nginx-root.conf root@${SERVER_IP}:/root/

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] 上传失败${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] nginx-root.conf 已上传${NC}"
echo

# 2. 上传 fix-root-path.sh
echo -e "${YELLOW}[2/5] 上传 fix-root-path.sh...${NC}"
scp server/fix-root-path.sh root@${SERVER_IP}:/root/

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] 上传失败${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] fix-root-path.sh 已上传${NC}"
echo

# 3. 在服务器上执行修复脚本
echo -e "${YELLOW}[3/5] 在服务器上执行修复脚本...${NC}"
ssh root@${SERVER_IP} "cd /root && chmod +x fix-root-path.sh && ./fix-root-path.sh"

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] 修复失败${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] 修复完成${NC}"
echo

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}         修复完成！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo
echo -e "访问地址：${NC}"
echo -e "  项目列表: http://${SERVER_IP}/"
echo -e "  fineSTEM:  http://${SERVER_IP}/fineSTEM"
echo -e "  project2:  http://${SERVER_IP}/project2"
echo -e "  project3:  http://${SERVER_IP}/project3"
