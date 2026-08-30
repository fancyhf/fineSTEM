#!/usr/bin/env bash
# Know 子系统（与孩子对话）服务器初始化脚本
# 在服务器上以 root（或 sudo bash）执行：bash know-server-setup.sh
# 幂等：可重复执行。前置：DNS A 记录 know -> 43.128.8.131 已生效。
set -euo pipefail

DOMAIN=know.wostemstudio.site
REPO="${REPO:-/opt/finestem/backend}"   # 现网 git 仓库根，不同则 REPO=/路径 bash 本脚本

echo "== 0. 前置检查 =="
command -v certbot >/dev/null || apt install -y certbot python3-certbot-nginx
if ! getent hosts "$DOMAIN" >/dev/null; then
  echo "!! DNS 未生效：先在 DNSPod 给 wostemstudio.site 加 A 记录 know -> 43.128.8.131"
  exit 1
fi

echo "== 1. 仓库布局探测 =="
cd "$REPO" && git pull --ff-only
if [ -d "$REPO/apps/backend" ]; then
  echo "   monorepo 布局 ✓"
  BACKEND_DIR="$REPO/apps/backend"
else
  echo "   !! 扁平布局：$REPO 下直接是 app/，不含 monorepo 的 apps/backend。"
  echo "   !! know 后端代码在 monorepo 的 apps/backend 里，本次 git pull 不会带来它——"
  echo "   !! 需先把现网仓库切换/合并为 monorepo（联系项目负责人确认后再继续）。"
  exit 1
fi

echo "== 2. 证书 =="
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect
fi

echo "== 3. nginx =="
cp "$REPO/deploy/know.conf" /etc/nginx/sites-enabled/know.conf
nginx -t && systemctl reload nginx

echo "== 4. 后端环境与重启 =="
ENVF="$BACKEND_DIR/.env"
touch "$ENVF"
grep -q '^KNOW_CONTENT_DIR=' "$ENVF" || echo "KNOW_CONTENT_DIR=$REPO/content/know" >> "$ENVF"
if grep -q '^CORS_ORIGINS=' "$ENVF"; then
  grep -q 'know.wostemstudio.site' "$ENVF" || \
    sed -i 's#^CORS_ORIGINS=.*#&,https://know.wostemstudio.site#' "$ENVF"
else
  echo "CORS_ORIGINS=https://wostemstudio.site,https://know.wostemstudio.site" >> "$ENVF"
fi
systemctl restart finestem-backend

echo "== 5. 前端构建 =="
cd "$REPO" && npm install && npm run build:know

echo "== 6. 验收 =="
sleep 2
echo -n "本机后端 know API: "; curl -s http://127.0.0.1:8001/api/v1/know/home | head -c 100; echo
echo -n "公网 HTTPS: "; curl -sI "https://$DOMAIN" | head -1
echo -n "公网内容资源: "; curl -s -o /dev/null -w "%{http_code}\n" "https://$DOMAIN/content/series/recursive-beauty/ep01/cover.jpg"
echo "全部完成。浏览器打开 https://$DOMAIN 走一遍验收清单（部署指南 §1.6）。"
