# Show 子系统（节目频道）部署指南

> version: 1.0.0 · created_at: 2026-08-23
> 目标：`https://show.wostemstudio.site` 与 fineSTEM 主站同机部署（43.128.8.131），
> 复用同一后端进程（finestem-backend, 8001），新增成本 ¥0。
> 设计文档：`.trae/documents/产品与规划/13_内容节目展示子系统_产品与技术设计_V1.0.md`

---

## 1. 一次性初始化（首次上线）

### 1.1 DNS

DNSPod 控制台给 `wostemstudio.site` 添加 A 记录：`show` → `43.128.8.131`。

### 1.2 服务器目录

```bash
ssh ubuntu@43.128.8.131
mkdir -p /opt/finestem/show/content
```

### 1.3 证书

```bash
sudo certbot --nginx -d show.wostemstudio.site
# 独立一张证书，不动主站证书；certbot.timer 已有自动续签
```

### 1.4 Nginx

把仓库 `deploy/show.conf` 上传到 `/etc/nginx/sites-enabled/show.conf`：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 1.5 后端（已在跑的 finestem-backend 只需两步）

```bash
cd /opt/finestem/backend && git pull
systemctl restart finestem-backend
```

- 新增路由 `/api/v1/show/*`（只读，复用现有进程，无新 systemd 服务）
- `.env` 追加一行：`SHOW_CONTENT_DIR=/opt/finestem/show/content`
- `CORS_ORIGINS` 追加 `https://show.wostemstudio.site`（同域代理下非必需，双保险）

### 1.6 前端构建与同步

```bash
# 本地（或服务器有 node 时直接在服务器构建）
npm run build:show          # 产物 apps/show/dist/
rsync -av --delete apps/show/dist/ ubuntu@43.128.8.131:/opt/finestem/show/dist/
```

### 1.7 内容同步

```bash
npm run validate:content    # 校验不过禁止上传
rsync -av --delete content/show/ ubuntu@43.128.8.131:/opt/finestem/show/content/
```

内容按 mtime 缓存失效，**上传即生效，无需重启任何服务**。

### 1.8 验收

```bash
curl -s https://show.wostemstudio.site/api/v1/show/home | head -c 300
curl -sI https://show.wostemstudio.site/content/assets/default-cover.svg
# 浏览器走一遍：首页 → 筛选/搜索 → 节目详情（互动 tab）→ 全屏页
```

---

## 2. 日常发布 SOP

### 2.1 发布新一集节目（不改代码）

1. 本地 `content/show/series/<系列>/<新集>/` 放 `episode.json` + 封面 + `interactive/index.html` + `docs/`
2. 视频：先传 B 站，拿到 bvid 后在 `episode.json` 的 `resources.videos` 填
   `"embed_url": "//player.bilibili.com/player.html?bvid=BVxxx&autoplay=0"`；
   没上线前在 `announce` 里占位（页面自动显示"即将上线"禁用 tab）
3. `npm run validate:content` 必须零错误
4. `rsync -av --delete content/show/ ubuntu@43.128.8.131:/opt/finestem/show/content/`
5. 刷新 `show.wostemstudio.site` 即见（首页主打位在 `content/show/index.json` 的 `featured` 手工切换）

### 2.2 更新前端/后端代码

```bash
# 后端
ssh … 'cd /opt/finestem/backend && git pull && systemctl restart finestem-backend'
# 前端
npm run build:show && rsync -av --delete apps/show/dist/ …:/opt/finestem/show/dist/
```

---

## 3. 排障速查

| 症状 | 检查 |
|------|------|
| 首页空白/接口 404 | `journalctl -u finestem-backend -f`；确认 `git pull` 后已 restart |
| 封面/动画 404 | `ls /opt/finestem/show/content/…`；nginx `location /content/` alias 是否生效 |
| 动画字体不是圆胖体 | `curl -I https://show.wostemstudio.site/content/assets/fonts/zcool-kuaile/index.css` |
| 证书告警 | `certbot certificates`；确认包含 show.wostemstudio.site |
| B 站播放器空白 | 检查 embed_url 是否带了 bvid；B 站偶尔要求完整参数（`&page=1&high_quality=1`） |

---

**文档结束**
