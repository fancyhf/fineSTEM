# 部署 Agent 修复指令：wostemstudio.top AI 导师 + Know 链接 + 残留清理

日期：2026-11-02｜性质：本地已验证的配置变更，服务器侧重建前端即可生效；另含一项数据库级残留清理。
适用：任何拥有该香港生产服务器执行权限的部署 Agent（腾讯云 Agent 或其他）。把下方"指令正文"整段发给它执行。

---

## 背景一句话

线上前端构建时未加载 `.env.production`（无 ZeroClaw token/地址），且其中残留旧域名 `.site`（已停用）；导致 AI 导师对所有用户不可用、Know 链接指向死域名。nginx 的 `/ws/chat` 反代配置文档记载已存在（→127.0.0.1:42617），本次不动后端、不动 ZeroClaw，只改前端环境文件并重建。

## 指令正文（粘贴给腾讯云 Agent）

```text
请在香港生产服务器上完成以下操作，每步输出结果，任何一步失败就停下并报告，不要继续：

【第 1 步：定位前端源码目录】
find /opt/finestem -maxdepth 4 -type f -name "vite.config.*" 2>/dev/null
记下其所在目录（应为 /opt/finestem/app/apps/frontend 或类似路径），后续称为 FRONTEND_DIR。
如果找不到，列出 /opt/finestem 的两层目录结构并停止。

【第 2 步：修正 .env.production 的两处域名】
cd FRONTEND_DIR
cp .env.production .env.production.bak-20261102
sed -i 's/^VITE_ZC_URL=.*/VITE_ZC_URL=wostemstudio.top/' .env.production
sed -i 's|^VITE_KNOW_URL=.*|VITE_KNOW_URL=https://know.wostemstudio.top|' .env.production
grep -E "^VITE_ZC_URL=|^VITE_ZC_TOKEN=|^VITE_KNOW_URL=" .env.production
要求：VITE_ZC_URL=wostemstudio.top；VITE_KNOW_URL=https://know.wostemstudio.top；
VITE_ZC_TOKEN 必须存在且以 zc_ 开头。如果 VITE_ZC_TOKEN 不存在或为空：
  curl -s -X POST http://127.0.0.1:42617/pair
从返回 JSON 中取 token（zc_ 开头），用
  echo "VITE_ZC_TOKEN=<新token>" >> .env.production
追加，然后继续。

【第 3 步：重建前端】
cd FRONTEND_DIR
npm install --include=dev
npx vite build
（用 npx vite build 跳过 tsc 类型检查以避免无关报错；产物在 FRONTEND_DIR/dist/）

【第 4 步：核对新产物】
grep -c "zc_" FRONTEND_DIR/dist/assets/index-*.js
grep -c "wostemstudio.site" FRONTEND_DIR/dist/assets/index-*.js || true
要求：第一行 ≥1；第二行应为 0（grep 无匹配）。

【第 5 步：发布到 nginx 站点目录】
先找站点 root（wostemstudio.top 对应的 server 块）：
  grep -r "root\s" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | grep -v "#"
备份旧目录后整目录替换（把 <NGINX_ROOT> 替换为上一步找到的路径）：
  cp -r <NGINX_ROOT> <NGINX_ROOT>.bak-20261102
  rsync -a --delete FRONTEND_DIR/dist/ <NGINX_ROOT>/
  chown -R www-data:www-data <NGINX_ROOT> 2>/dev/null || true

【第 6 步：确认 /ws/chat 反代存在】
grep -rn "ws/chat" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null
如果没有任何输出（即 .top 的 server 块里没有 /ws/chat），在该 server 块内补上：
  location /ws/chat {
      proxy_pass http://127.0.0.1:42617/ws/chat;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_read_timeout 3600s;
  }
然后 nginx -t && systemctl reload nginx（只有改了配置才需要 reload）。

【第 7 步：服务器侧自检】
curl -s https://wostemstudio.top/ | grep -o 'assets/index-[^"]*\.js'
# 记下文件名，然后：
grep -c "zc_" <NGINX_ROOT>/assets/<上一步文件名>
curl -s -o /dev/null -w "%{http_code}\n" -i -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" -H "Sec-WebSocket-Version: 13" \
  "https://wostemstudio.top/ws/chat?token=selftest&agent=assistant_qwen&session_id=selftest"
systemctl is-active zeroclaw
要求：index 文件里 zc_ 计数 ≥1；WS 探测返回 101（Switching Protocols）或 4xx（说明反代通、鉴权拦截，也算通）；不能是 404/502。zeroclaw 服务 active。

全部完成后输出：改动文件清单、新 index 文件名、第 7 步三项结果。
注意：不要动 /opt/zeroclaw、后端服务、证书；不要 git commit。
```

## 附加清理（同一次会话内顺手完成，需数据库访问）

背景：2026-11-02 有一个测试项目及其成果卡已被作者账号删除，但成果卡的**分享 token 仍可匿名访问**（分享接口不校验项目删除状态，平台层无卡片删除接口）。需在数据库层软删该卡片：

```text
【第 8 步：软删孤儿成果卡】
sqlite3 /opt/finestem/data/finestem.db \
  "UPDATE achievement_cards SET is_deleted=1, updated_at=datetime('now') WHERE id='6c2d893e-eac4-4a3e-a3b0-5c3e301fa96a';"
然后验证匿名分享已失效（预期 404）：
curl -s -o /dev/null -w "%{http_code}\n" \
  https://wostemstudio.top/api/v1/achievement-cards/share/9OU5pGv4ROMjGm4tnkqh4w
如果仍返回 200，输出 achievement_cards 表中该行的 is_deleted 值并停止。
```

说明：数据库路径来自部署文档 §5（`DATABASE_URL=sqlite:////opt/finestem/data/finestem.db`）。若服务器上 sqlite3 不可用，跳过本步并在报告中注明"遗留：分享 token 9OU5…仍可达"，由后续处理。

## 执行完之后

- 我已挂了每小时自动检查任务：发现线上 bundle 烘焙了 token 且 WS 握手成功即报告"AI 导师已修复"并自停。
- 如果自检 WS 返回 4xx 且后续实测聊天仍报鉴权错：说明 daemon 的 paired_tokens 里没有这个 token，重跑【第 2 步】的 /pair 分支换新 token 再重建即可。
- 回滚：`.env.production.bak-20261102` 和 `<NGINX_ROOT>.bak-20261102` 都已备份，恢复即可。

## 本次业务代码变更清单（公共约定 §2 要求单独列明）

- `apps/frontend/.env.production`：`VITE_ZC_URL` wostemstudio.site→wostemstudio.top；`VITE_KNOW_URL` know.wostemstudio.site→know.wostemstudio.top（本地已构建验证，新主 bundle `index-BWKm4tTx.js` 含 token、无旧域名）
- 本地构建产物 `apps/frontend/dist/`（未提交 git；服务器以相同配置重建为准）
