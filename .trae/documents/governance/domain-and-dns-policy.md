# 域名与部署登记（Living Document）

> 用途：wostemstudio.site 域名体系下所有子域名/入口的**唯一台账**。
> 任何新子域名、新 nginx 入口、新部署路径，必须先在本表登记。
> 原则见 ADR-002（发布契约）；服务器与域名底座见 ADR-001。
> 维护者：AI Agent + 项目负责人 · 创建：2026-08-24

---

## 1. 域名体系

| 域名/子域名 | DNS 记录 | 指向 | 证书 | 登记状态 |
|------------|---------|------|------|---------|
| wostemstudio.site | A @ | 43.128.8.131 | Let's Encrypt（主站，2026-11 到期自动续签） | ✅ 在用 |
| www.wostemstudio.site | A www | 43.128.8.131 | 同上（含在主站证书内） | ✅ 在用 |
| know.wostemstudio.site | A know | 43.128.8.131 | Let's Encrypt 独立一张（部署时签） | 📝 已登记，待部署 |
| （预留） | — | — | — | 新入口按 §3 流程申请 |

> 分发原则：一切部署所需（代码+内容+说明）进 git 仓库，服务器只从 GitHub 拿；视频以 B 站链接形态存于 episode.json，不进仓库（ADR-002）。

## 2. 在线入口登记

| 入口 | 类型/契约 | 代码位置 | 服务器路径 | nginx 配置 | 状态 |
|------|----------|---------|-----------|-----------|------|
| `wostemstudio.site`（fineSTEM 主站） | 平台主站 | `apps/frontend` + `apps/backend` | `/opt/finestem/frontend/dist` + backend:8001 | `finestem.conf`（已在服务器） | ✅ 在用 |
| `know.wostemstudio.site`（Know 节目频道，代号 Know，品牌名"与孩子对话"） | 契约②（独立 Web 应用）+ 契约①（内容库）+ 契约③（只读 API `/api/v1/know/*`） | `apps/know`（前端）、`app/api/know.py`（后端）、`content/know/`（内容） | `$REPO/apps/know/dist` + `$REPO/content/know`（随 git 仓库分发，服务器 git pull 即生效） | `deploy/know.conf` | 📝 已开发，待部署 |
| 《递推之美》互动动画等内容产物 | 契约① | 生产于 `G:\buddyspace\鸡娃先自鸡\`（创作工作区，技术不限），产物复制进 `content/know/series/.../interactive/` | 同上 `/opt/finestem/know/content` | 同上（`/content/` 静态区） | ✅ 第 1 集已接入 |

> 视频承载：全部 B 站嵌入（`player.bilibili.com` iframe），服务器不存视频（ADR-002 原则 1）。

## 3. 新增入口流程（审批口）

1. 在本表"预留"行提案：子域名、契约类型（ADR-002 三选一）、代码位置
2. 契约①：过 `npm run validate:content`；契约②：构建通过 + 独立 `dist/`；契约③：必须是只读接口
3. 项目负责人确认 → 加 DNS A 记录 → nginx server block（用 `deploy/know.conf` 作模板）→ certbot 签证书
4. 更新本表与相关 ADR

## 4. 反向规则（不上线清单）

以下任务**不接入**本服务器：重计算（视频转码/AI 训练/爬虫批量）、自带数据库或用户体系的系统、需要 GPU 的任何东西。它们在别处完成，产物以契约①静态形态展示。

---

**文档结束**
