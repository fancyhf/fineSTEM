# fineSTEM 香港部署计划表 (简化版,无 EdgeOne)

> 版本: v1.1.0 | 创建: 2026-08-22 | 更新: 2026-08-23 | 维护: AI Agent + 项目负责人
> 完成一项打勾,填写实际值

---

## 一、选型一览

| 项 | 选型 | 规格 | 月成本 |
|----|------|------|-------|
| 服务器 | 腾讯云轻量 Lighthouse 香港入门型 | 2核2G/40G SSD/20Mbps/512G Ubuntu 22.04 | ¥38 |
| 域名 | 腾讯云/DNSPod 注册 | finestem.com | ~¥6 |
| DNS | DNSPod 免费版 | 域名解析到服务器 IP | ¥0 |
| SSL | Let's Encrypt 免费 | certbot 自动签发+续签 | ¥0 |
| AI 底座 | ZeroClaw Linux x86_64 | 官方二进制 + systemd | ¥0 |
| 数据库 | SQLite (WAL) | 单文件,随项目迁移 | ¥0 |
| 反代 | Nginx | 前端静态 + API/WS 反代 | ¥0 |
| **合计** | | | **~¥44/月 (~¥530/年)** |

> 不用 EdgeOne。理由: 几十用户场景无需 WAF/DDoS,EdgeOne 境外节点对国内加速有限,直连香港已够快。未来用户增长或遇攻击再加。

---

## 二、执行步骤表

### 阶段 1: 买资源 (您操作,1-2天)

| # | 步骤 | 谁做 | 入口 | 完成打勾 | 实际值 |
|---|------|------|------|----------|-------|
| 1 | 注册域名 | 您 | https://dnspod.cloud.tencent.com/ 搜 finestem.com | [ ] | 域名:____ |
| 2 | 购买服务器 | 您 | https://cloud.tencent.com/product/lighthouse 香港/入门型2核2G/Ubuntu22.04/¥38月 | [ ] | IP:______ |
| 3 | 把域名+IP告诉AI | 您 | 对话告知 | [ ] | — |

### 阶段 2: 配解析+SSL (AI Agent,0.5天)

| # | 步骤 | 谁做 | 要点 | 完成打勾 |
|---|------|------|------|----------|
| 4 | DNSPod 解析 | AI Agent | A记录 finestem.com → 服务器IP | [ ] |
| 5 | 装 Let's Encrypt SSL | AI Agent | certbot 一键签发,自动续签 | [ ] |

### 阶段 3: 装服务器 (AI Agent,1天)

| # | 步骤 | 谁做 | 要点 | 完成打勾 |
|---|------|------|------|----------|
| 6 | 系统初始化 | AI Agent | apt装Nginx/Python3.12/Node18/git,开ufw防火墙(80+443+22) | [ ] |
| 7 | 部署ZeroClaw | AI Agent | 下载Linux二进制→config.toml→systemd守护→健康检查 | [ ] |

### 阶段 4: 装应用 (AI Agent,1-2天)

| # | 步骤 | 谁做 | 要点 | 完成打勾 |
|---|------|------|------|----------|
| 8 | 部署后端FastAPI | AI Agent | git clone→pip装依赖→.env配置→alembic迁移→systemd守护 | [ ] |
| 9 | 部署前端+Nginx | AI Agent | npm build→上传dist→配nginx反代→reload | [ ] |

### 阶段 5: 验证切流 (AI Agent+您,0.5天)

| # | 步骤 | 谁做 | 验证标准 | 完成打勾 |
|---|------|------|----------|----------|
| 10 | 端到端验证 | AI Agent+您 | https://finestem.com 能开/AI能对话/国内<80ms | [ ] |
| 11 | 释放旧服务器 | 您 | 北京Lighthouse+宝塔Win给别的项目 | [ ] |

---

## 三、关键信息登记表

> 完成后填写,项目内部用

| 项 | 值 |
|----|-----|
| 域名 | finestem.com |
| 服务器公网IP | _________ |
| 服务器SSH用户 | ubuntu |
| 服务器SSH密码 | (自己保存,不要告诉AI) |
| 服务器到期时间 | _________ |
| SSL证书到期时间 | _________ (Let's Encrypt 90天,自动续) |
| 生产访问地址 | https://finestem.com |
| API文档地址 | https://finestem.com/api/docs |
| AI对话WS地址 | wss://finestem.com/zeroclaw/ws |

---

## 四、您现在的动作

**第 1 项**: 打开 https://dnspod.cloud.tencent.com/ ,搜 finestem.com,注册支付 (~¥75/年)

**第 2 项**: 打开 https://cloud.tencent.com/product/lighthouse ,香港/入门型2核2G/Ubuntu22.04/¥38月,买1个月

**第 3 项**: 把域名 + 服务器公网IP 发给我,我接管后面。
