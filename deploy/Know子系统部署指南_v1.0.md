# Know 子系统（"与孩子对话"节目频道）部署指南

> version: 1.1.0 · created_at: 2026-08-23 · updated: 2026-08-24
> 目标：`https://know.wostemstudio.site` 与 fineSTEM 主站同机部署（43.128.8.131），
> 复用同一后端进程（finestem-backend, 8001），新增成本 ¥0。
> **分发原则（ADR-002）**：一切部署所需（代码+内容+说明）都在 git 仓库里，
> 服务器只从 GitHub 拿（git pull）；视频不进仓库（B 站链接形态存于 episode.json）。
> 设计文档：`.trae/documents/产品与规划/13_内容节目展示子系统_产品与技术设计_V1.0.md`

> 下文 `$REPO` 指服务器上的仓库根。现网 fineSTEM 仓库克隆在 `/opt/finestem/backend`
> （以香港部署文档为准）；若实际目录结构不同，只需同步调整 `KNOW_CONTENT_DIR`
> 环境变量与 nginx 里的两个路径。

---

## 1. 一次性初始化（首次上线）

### 1.1 DNS

DNSPod 控制台给 `wostemstudio.site` 添加 A 记录：`know` → `43.128.8.131`。

### 1.2 证书

```bash
sudo certbot --nginx -d know.wostemstudio.site
# 独立一张证书，不动主站证书；certbot.timer 已有自动续签
```

### 1.3 Nginx

把仓库 `deploy/know.conf` 上传到 `/etc/nginx/sites-enabled/know.conf`，
核对其中两个路径（`root` 与 `/content/` alias）指向 `$REPO` 下实际位置：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 1.4 后端（已在跑的 finestem-backend）

```bash
cd $REPO && git pull
systemctl restart finestem-backend
```

- `.env` 追加：`KNOW_CONTENT_DIR=$REPO/content/know`
- `CORS_ORIGINS` 追加 `https://know.wostemstudio.site`（同域代理下非必需，双保险）

### 1.5 前端构建（服务器上构建，dist 不进 git）

```bash
cd $REPO && npm install && npm run build:know
# 产物 $REPO/apps/know/dist（gitignore 已忽略 dist/）
```

### 1.6 验收

```bash
curl -s https://know.wostemstudio.site/api/v1/know/home | head -c 300
curl -sI https://know.wostemstudio.site/content/assets/default-cover.svg
# 浏览器走一遍：首页 → 筛选/搜索 → 节目详情（互动 tab）→ 全屏页
```

---

## 2. 日常工作流

### 2.1 发布新一集（搬运 SOP，ADR-002 §4）

内容在各个工作空间（如 `G:\buddyspace\鸡娃先自鸡\`）生产，**做完后负责人告知
Agent 源路径**，由 Agent 执行搬运入库：

1. 互动 web 代码 → `content/know/series/<系列>/<集>/interactive/`（原样复制，不改写）
2. 说明文档（脚本/指引/文案）→ 同集 `docs/`
3. 填 `episode.json`（标题、摘要、说明、资料清单；封面 SVG 可让 Agent 生成）
4. `npm run validate:content` **零错误**才继续
5. `git commit` + `git push`（内容与代码全部入库，这是服务器能拿到的唯一途径）
6. 服务器 `cd $REPO && git pull` → **即生效**（后端按文件指纹自动重扫，无需重启）

### 2.2 视频接入

视频一律 B 站（服务器不存视频）。负责人把 B 站链接发给 Agent，Agent 在
`episode.json` 的 `resources.videos` 里填：

```json
{ "id": "child-video", "audience": "child", "title": "儿童视频 · 第 1 集",
  "embed_url": "//player.bilibili.com/player.html?bvid=BVxxxx&autoplay=0" }
```

上线前的空位在 `announce` 里占位（页面自动显示"即将上线"）。改动同样走
validate → commit → push → 服务器 git pull。

### 2.3 代码更新

```bash
# 服务器上：
cd $REPO && git pull && npm run build:know   # 前端
systemctl restart finestem-backend            # 后端有改动时
```

---

## 3. 排障速查

| 症状 | 检查 |
|------|------|
| 首页空白/接口 404 | `journalctl -u finestem-backend -f`；确认 git pull 后已 restart |
| 封面/动画 404 | `$REPO/content/know/...` 文件在不在；nginx `/content/` alias 路径是否对 |
| 首页有壳但没数据 | `KNOW_CONTENT_DIR` 是否指向真实内容目录（目录缺失时接口会静默返回空数据） |
| 动画字体不对 | 字体已入库（`content/know/assets/fonts/`），确认 git pull 完整、nginx alias 正确 |
| 证书告警 | `certbot certificates`；确认包含 know.wostemstudio.site |
| B 站播放器空白 | 检查 embed_url 是否带 bvid；必要时补全参数（`&page=1&high_quality=1`） |

---

**文档结束**
