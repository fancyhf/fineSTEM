# 腾讯轻量云 Agent 部署 Prompt（Know 节目频道）

> 用法：整段复制给腾讯轻量云 Agent 执行。前置：DNSPod 已添加 A 记录 know → 43.128.8.131。

---

## 任务：把 Know 节目频道（与孩子对话，know.wostemstudio.site）部署到本服务器

### 背景与环境（已核实，直接使用）

- 服务器：腾讯云轻量香港，Ubuntu 22.04，公网 IP 43.128.8.131
- 已在运行、**不许改动**：nginx 443 上的主站（wostemstudio.site，配置在
  /etc/nginx/sites-enabled/finestem.conf）、ZeroClaw 服务（端口 42617）
- 后端：finestem-backend（FastAPI，systemd 单元 finestem-backend，监听 127.0.0.1:8001），
  API 前缀 /api/v1
- 代码仓库：GitHub fancyhf/fineSTEM（monorepo），分支 main；本次要部署的代码已在
  origin/main（提交 2ee82b9 或更新），包含三块新东西：
  1. 后端只读路由 app/api/know.py（/api/v1/know/*，挂在本机同一 backend 进程）
  2. 前端应用 apps/know（构建命令 npm run build:know，产物 apps/know/dist）
  3. 内容库 content/know（静态资源：封面/互动动画 html/字体/文档）
- 仓库内参考文件：deploy/Know子系统部署指南_v1.0.md、deploy/know.conf、deploy/know-server-setup.sh

### 第 0 步：前置检查（任一不满足就停下输出报告，不要猜）

1. `getent hosts know.wostemstudio.site` 必须解析到 43.128.8.131；
   否则停止，报告："请在 DNSPod 给 wostemstudio.site 添加 A 记录 know → 43.128.8.131，加好后重新运行"
2. `git -C /opt/finestem/backend remote -v` 与 `ls /opt/finestem/backend`（确认仓库与布局）
3. `systemctl cat finestem-backend`（记下 WorkingDirectory / ExecStart / EnvironmentFile 的实际路径）
4. `node -v`：低于 v18 则先通过 NodeSource 安装 Node 20（vite 5 构建需要）

### 第 1 步：代码与布局判断

- 若存在 /opt/finestem/backend/apps/backend → monorepo 布局：
  `REPO=/opt/finestem/backend`，`BACKEND_DIR=$REPO/apps/backend`
- 若 $REPO 下直接是 app/（扁平布局，无 apps/）→ **停下**：输出
  `git remote -v`、`systemctl cat finestem-backend`、`ls` 的完整结果，等人工确认。
  不要自行迁移仓库。
- 布局确认后：`cd $REPO && git pull --ff-only`；有冲突就停止并原样贴出错误。

### 第 2 步：证书与 nginx

1. 先写一个仅 80 端口的引导配置 /etc/nginx/sites-enabled/know.conf：
   - server_name know.wostemstudio.site
   - root $REPO/apps/know/dist（此刻目录可能还不存在，没关系，第 4 步会构建出来）
   - `location /api/` → proxy_pass http://127.0.0.1:8001（**保留 /api/ 前缀**，
     加 proxy_set_header Host $host 与 X-Real-IP）
   - `location /content/` → alias $REPO/content/know/（带尾部斜杠）
   - `location /` → try_files $uri $uri/ /index.html
2. `nginx -t && systemctl reload nginx`
3. `certbot --nginx -d know.wostemstudio.site --non-interactive --agree-tos --redirect`
   （自动签证书并把该配置升级为 443 + 80 跳转；证书会落在
   /etc/letsencrypt/live/know.wostemstudio.site/）
4. **不要动 finestem.conf（主站配置）**。

### 第 3 步：后端

1. 备份：`cp $BACKEND_DIR/.env $BACKEND_DIR/.env.bak-know`（不要在任何输出里打印 .env 内容）
2. 幂等追加到 .env：
   - `KNOW_CONTENT_DIR=$REPO/content/know`
   - CORS_ORIGINS 已有则在该行末尾追加 `,https://know.wostemstudio.site`，没有则新增
     `CORS_ORIGINS=https://wostemstudio.site,https://know.wostemstudio.site`
3. `systemctl restart finestem-backend`，然后 `journalctl -u finestem-backend -n 20 --no-pager` 确认无报错
4. `curl -s http://127.0.0.1:8001/api/v1/know/home`：
   期望返回 {"success":true,...}，且 featured 的 episode title 为「数学思维：花里藏数列」

### 第 4 步：前端构建

- `cd $REPO && npm install && npm run build:know`
- 确认产物 $REPO/apps/know/dist/index.html 与 dist/assets/ 存在

### 第 5 步：验收（逐条执行并把结果写进汇报）

1. `curl -sI https://know.wostemstudio.site` → 期望 HTTP 200
2. `curl -s https://know.wostemstudio.site/api/v1/know/home` → 期望 success true
3. `curl -s -o /dev/null -w "%{http_code}" https://know.wostemstudio.site/content/series/recursive-beauty/ep01/cover.jpg` → 期望 200
4. `curl -sI http://know.wostemstudio.site` → 期望 301 跳 https
5. `curl -sI https://wostemstudio.site` → 仍 200（主站未受影响）

### 汇报要求

- 按步骤列出：执行了什么、关键命令输出、与上述期望的偏差
- 任何一步失败：贴出错误原文、说明已完成的步骤并停止；**不要回滚或修改主站相关的任何配置**
- 全程不要在回复里输出 .env 文件内容或任何密钥

---

**Prompt 结束**
