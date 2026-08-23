# 香港部署执行清单 (Runbook)

- **版本**: v1.0.0
- **创建时间**: 2026-08-22
- **维护者**: AI Agent + 项目负责人
- **关联 ADR**: `.trae/documents/adr/ADR-001-hk-deployment.md`
- **状态**: 执行中

> 本文档是 fineSTEM 香港部署的**唯一执行清单**。每完成一项,把 `[ ]` 改为 `[x]` 并填写实际值。分为"您操作"和"AI Agent 操作"两类步骤。

---

## 阶段 1: 资源准备 (您操作)

### 步骤 1: 注册域名

- [ ] **1.1** 打开腾讯云域名注册: https://dnspod.cloud.tencent.com/
- [ ] **1.2** 搜索 `finestem.com`,确认可注册
  - 若被占用,备选 `finestem.net` / `finestem.ai` / `finestem.cn`
  - **实际注册域名**: `____________________`
- [ ] **1.3** 加入购物车,支付 (约 ¥75/年)
- [ ] **1.4** 完成实名认证 (上传身份证)
- [ ] **1.5** 注册成功,记录域名管理账号
  - **腾讯云账号**: `____________________`
  - **域名**: `____________________`
  - **到期时间**: `____________________`

### 步骤 2: 购买香港服务器

- [ ] **2.1** 打开腾讯云轻量应用服务器: https://cloud.tencent.com/product/lighthouse
- [ ] **2.2** 地域选择: **中国香港**
- [ ] **2.3** 套餐选择: **锐驰型**
  - 规格: 2核2G / 40G SSD / 200Mbps / 无限流量
  - 价格: ¥55/月
- [ ] **2.4** 操作系统选择: **Ubuntu 22.04 LTS**
- [ ] **2.5** 购买时长: 先买 **1 个月** (验证稳定后续费年付)
- [ ] **2.6** 设置 SSH 登录密码 (强密码,记录保存)
- [ ] **2.7** 购买成功,记录服务器信息
  - **服务器公网 IP**: `____________________`
  - **实例 ID**: `____________________`
  - **SSH 登录命令**: `ssh ubuntu@<公网IP>`
  - **SSH 密码**: `____________________` (仅自己保存,不要告诉 AI)
  - **到期时间**: `____________________`

> **重要**: SSH 密码请妥善保存,不要在对话中明文告知 AI Agent。AI Agent 通过腾讯云控制台的 Web Shell 或您授权的 SSH 密钥登录操作。

### 步骤 3: 交接信息给 AI Agent

- [ ] **3.1** 告知 AI Agent 以下信息:
  - 域名: `finestem.com` (或实际注册的域名)
  - 服务器公网 IP: `xxx.xxx.xxx.xxx`
  - 腾讯云账号已就绪 (EdgeOne/DNSPod 同账号)
- [ ] **3.2** AI Agent 接管后续 EdgeOne + 服务器部署

---

## 阶段 2: 边缘加速层配置 (您操作 + AI Agent 指导)

### 步骤 4: 申请 EdgeOne 免费版

- [ ] **4.1** 打开腾讯云 EdgeOne: https://cloud.tencent.com/product/teo
- [ ] **4.2** 点击"免费版"或"个人开发者扶持计划"
- [ ] **4.3** 创建站点,填写主域名: `finestem.com`
- [ ] **4.4** 加速区域选择: **全球可用区 (不含中国大陆)** ← 免备案
- [ ] **4.5** 接入方式选择: **NS 接入**
- [ ] **4.6** EdgeOne 分配 NS 服务器,记录:
  - **NS 服务器 1**: `____________________`
  - **NS 服务器 2**: `____________________`
- [ ] **4.7** 去 DNSPod 修改域名 NS 记录,指向 EdgeOne 分配的 NS
- [ ] **4.8** 等待 NS 生效 (通常 10 分钟~2 小时)
- [ ] **4.9** EdgeOne 控制台显示"站点已接入",SSL 证书自动签发

### 步骤 5: 配置 EdgeOne 回源 (AI Agent 操作)

- [ ] **5.1** AI Agent 在 EdgeOne 控制台添加加速域名 `finestem.com`
- [ ] **5.2** 配置回源地址: 服务器公网 IP
- [ ] **5.3** 配置回源端口: 80
- [ ] **5.4** 配置回源协议: HTTP (EdgeOne 终结 HTTPS,回源走 HTTP)
- [ ] **5.5** 配置缓存规则:
  - 静态资源 (.js/.css/.png/.jpg/.woff2) 缓存 7 天
  - API 路径 `/api/*` 不缓存
  - WebSocket 路径 `/zeroclaw/ws` 不缓存
- [ ] **5.6** 配置 HTTPS: 强制跳转 HTTPS (HTTP 301 → HTTPS)
- [ ] **5.7** 验证: `curl -I https://finestem.com` 应返回 502 (服务器还没服务,正常)

---

## 阶段 3: 服务器初始化 (AI Agent 操作)

### 步骤 6: 系统基础初始化

- [ ] **6.1** SSH 登录服务器
- [ ] **6.2** 系统更新: `apt update && apt upgrade -y`
- [ ] **6.3** 创建项目目录:
  ```
  /opt/finestem/
  ├── app/          # 代码
  ├── data/         # SQLite 数据
  ├── logs/         # 日志
  └── frontend/dist/  # 前端构建产物
  ```
- [ ] **6.4** 安装依赖:
  - Nginx
  - Python 3.12 + pip + venv
  - Node.js 18 + npm
  - git
  - curl, wget, vim, ufw
- [ ] **6.5** 配置防火墙 (ufw):
  - 仅开放 80 (EdgeOne 回源)
  - 开放 22 (SSH,限腾讯云 IP 段)
  - 关闭其余端口
- [ ] **6.6** 配置时区: `Asia/Hong_Kong`
- [ ] **6.7** 验证: `nginx -v`, `python3 --version`, `node --version`

### 步骤 7: 部署 ZeroClaw daemon

- [ ] **7.1** 从 GitHub Releases 下载 ZeroClaw Linux x86_64 二进制
  - 下载地址: https://github.com/zeroclaw-labs/zeroclaw/releases
  - 目标路径: `/opt/zeroclaw/bin/zeroclaw`
- [ ] **7.2** 创建配置目录: `/opt/zeroclaw/{config,data}`
- [ ] **7.3** 迁移 `config.toml` 配置 (从本地 `H:\dev-env\zeroclaw\config\config.toml` 复制)
- [ ] **7.4** 设置 DeepSeek API Key (加密存储):
  ```
  zeroclaw config set providers.models.deepseek.default.api_key --no-interactive "sk-xxx"
  ```
- [ ] **7.5** 生成新的 pairing token:
  ```
  zeroclaw gateway get-paircode --new
  ```
  - **记录新 token**: `zc_xxxxxxxx` (用于前端 `.env.production`)
- [ ] **7.6** 创建 systemd 服务: `/etc/systemd/system/zeroclaw.service`
- [ ] **7.7** 启动并设为开机自启:
  ```
  systemctl daemon-reload
  systemctl enable zeroclaw
  systemctl start zeroclaw
  ```
- [ ] **7.8** 验证健康: `curl http://127.0.0.1:42617/health` 返回 `{"status":"ok"}`

---

## 阶段 4: 应用部署 (AI Agent 操作)

### 步骤 8: 部署后端 FastAPI

- [ ] **8.1** 克隆项目代码到 `/opt/finestem/app`
- [ ] **8.2** 创建 Python 虚拟环境: `python3 -m venv /opt/finestem/app/venv`
- [ ] **8.3** 安装依赖: `pip install -r apps/backend/requirements.txt`
- [ ] **8.4** 配置 `.env`:
  ```
  DATABASE_URL=sqlite:////opt/finestem/data/finestem.db
  ZEROCLAW_GATEWAY_URL=http://127.0.0.1:42617
  ZEROCLAW_DEFAULT_MODEL=deepseek-v4-pro
  CORS_ALLOW_ORIGINS=["https://finestem.com"]
  SECRET_KEY=<新生成强随机密钥>
  BACKEND_PORT=3200
  DEBUG=False
  ```
- [ ] **8.5** 迁移数据库: `alembic upgrade head`
- [ ] **8.6** 创建 systemd 服务: `/etc/systemd/system/finestem-backend.service`
- [ ] **8.7** 启动并设为开机自启:
  ```
  systemctl enable finestem-backend
  systemctl start finestem-backend
  ```
- [ ] **8.8** 验证健康: `curl http://127.0.0.1:3200/health` 返回 `{"status":"ok"}`

### 步骤 9: 部署前端 + Nginx 反代

- [ ] **9.1** 本地构建前端 (在开发机执行):
  ```
  cd apps/frontend
  npm run build
  ```
  - 构建参数:
    - `VITE_API_BASE_URL=/api`
    - `VITE_ZC_URL=finestem.com` (生产域名,WS 走 wss://)
    - `VITE_ZC_TOKEN=zc_xxxxxxxx` (步骤 7.5 生成的新 token)
- [ ] **9.2** 上传 `dist/` 到服务器 `/opt/finestem/frontend/dist/`
- [ ] **9.3** 配置 Nginx: `/etc/nginx/sites-available/finestem.conf`
  - `/` → 前端静态文件 `/opt/finestem/frontend/dist`
  - `/api/` → `http://127.0.0.1:3200`
  - `/zeroclaw/ws` → `http://127.0.0.1:42617/ws/chat` (WebSocket Upgrade)
- [ ] **9.4** 启用站点: `ln -s /etc/nginx/sites-available/finestem.conf /etc/nginx/sites-enabled/`
- [ ] **9.5** 测试配置: `nginx -t`
- [ ] **9.6** 重载: `nginx -s reload`
- [ ] **9.7** 验证: `curl http://localhost/` 返回前端 HTML

---

## 阶段 5: 验证与切流 (AI Agent 操作 + 您验证)

### 步骤 10: 端到端验证

- [ ] **10.1** 前端访问: `https://finestem.com` 正常显示首页
- [ ] **10.2** API 健康: `https://finestem.com/api/health` 返回 `{"status":"ok"}`
- [ ] **10.3** AI 对话: WebSocket 连接 `wss://finestem.com/zeroclaw/ws`,AI 响应流式输出
- [ ] **10.4** 项目 CRUD: 创建项目,数据写入 SQLite 成功
- [ ] **10.5** 子路由: `/track-a`、`/track-e` 等子页签正常 (如有)
- [ ] **10.6** 国内访问: 手机/电脑访问,延迟 <50ms,无卡顿
- [ ] **10.7** 国外访问: (如有条件) 正常加载
- [ ] **10.8** HTTPS 证书: 浏览器显示绿色锁,证书有效
- [ ] **10.9** 日志检查: Nginx / FastAPI / ZeroClaw 日志无错误

### 步骤 11: 收尾

- [ ] **11.1** 旧北京 Lighthouse (43.140.204.127) 释放给其他项目
- [ ] **11.2** 旧 Windows 宝塔服务器 (122.51.71.4) 释放给其他项目
- [ ] **11.3** `deploy/` 和 `deploysettings/` 旧文档标记归档 (后续单独处理)
- [ ] **11.4** 更新项目 README.md 的部署章节 (后续单独处理)
- [ ] **11.5** 设置服务器续费提醒 (到期前 7 天)

---

## 里程碑与时间线

| 阶段 | 步骤 | 责任人 | 预计耗时 | 产出 |
|------|------|-------|---------|------|
| 1 资源准备 | 1 注册域名 | 您 | 0.5 天 | 域名 finestem.com |
| 1 资源准备 | 2 购买服务器 | 您 | 0.5 天 | 服务器 IP + SSH |
| 1 资源准备 | 3 交接信息 | 您 | 即时 | 把 IP/域名告诉 AI |
| 2 边缘加速 | 4 申请 EdgeOne | 您+我指导 | 0.5 天 | EdgeOne 接入完成 |
| 2 边缘加速 | 5 配置回源 | AI Agent | 0.5 天 | 回源规则生效 |
| 3 服务器初始化 | 6 系统初始化 | AI Agent | 0.5 天 | 服务器就绪 |
| 3 服务器初始化 | 7 部署 ZeroClaw | AI Agent | 0.5 天 | daemon 健康 |
| 4 应用部署 | 8 部署后端 | AI Agent | 1 天 | API 健康 |
| 4 应用部署 | 9 部署前端+Nginx | AI Agent | 1 天 | 前端可访问 |
| 5 验证切流 | 10 端到端验证 | AI Agent+您 | 0.5 天 | 生产可用 |
| 5 验证切流 | 11 收尾 | 您 | 0.5 天 | 旧资源释放 |

**总预计: 5-7 天** (其中您需要参与约 2 天,AI Agent 操作约 3-5 天)

---

## 关键信息登记表

> 完成部署后,在此登记关键信息 (仅项目内部使用,不对外公开)

| 项目 | 值 |
|------|-----|
| 域名 | `finestem.com` |
| 服务器公网 IP | `____________________` |
| 服务器 SSH 用户 | `ubuntu` |
| 服务器 SSH 密码 | (不填写,仅自己保存) |
| 服务器到期时间 | `____________________` |
| EdgeOne 站点 ID | `____________________` |
| ZeroClaw pairing token | `zc_xxxxxxxx` |
| 后端 SECRET_KEY | `____________________` |
| DeepSeek API Key | `sk-xxxx` (仅 config.toml 加密存储) |
| 生产访问地址 | `https://finestem.com` |
| API 文档地址 | `https://finestem.com/api/docs` |
| AI 对话 WS 地址 | `wss://finestem.com/zeroclaw/ws` |

---

## 常见问题

**Q: 锐驰型 2核2G 断货怎么办?**
A: 蹲点抢购,或临时降级到腾讯云国际版入门型 2核2G/20Mbps/512G $6/月 (~¥43)。EdgeOne 配置无需改,只需改回源 IP。

**Q: EdgeOne NS 接入后多久生效?**
A: 通常 10 分钟~2 小时。可在 EdgeOne 控制台查看接入状态。

**Q: ZeroClaw Linux 二进制在哪下载?**
A: https://github.com/zeroclaw-labs/zeroclaw/releases ,选 `zeroclaw-x86_64-unknown-linux-gnu.tar.gz`。

**Q: 部署过程中如何与 AI Agent 协作?**
A: 您完成"您操作"步骤后,把关键信息 (域名、IP) 告诉 AI Agent。AI Agent 通过腾讯云控制台 Web Shell 或您提供的 SSH 访问执行后续步骤。SSH 密码不要在对话中明文传递。

**Q: 如果 ZeroClaw 在 Linux 跑不起来怎么办?**
A: 先在服务器上跑 `zeroclaw doctor` 排查。若确实不兼容,降级方案:后端直连 DeepSeek API (后端已有 `ZEROCLAW_GATEWAY_URL` 配置项,设为空则走直连),但会丢失 MCP 工具调用能力,PBL 阶段门禁功能受限。

---

**文档结束。每完成一项请打勾并填写实际值。**
