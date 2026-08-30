# Know 子系统（"与孩子对话"节目频道）部署指南

> version: 1.2.0 · created_at: 2026-08-23 · updated: 2026-08-30（按首次实际上线校正路径）
> 状态：**已上线** https://know.wostemstudio.site（2026-08-30）
> 目标：与 fineSTEM 主站同机部署（43.128.8.131），复用同一后端进程（finestem-backend, 8001），新增成本 ¥0。
> **分发原则（ADR-002）**：一切部署所需（代码+内容+说明）都在 git 仓库里，
> 服务器只从 GitHub 拿；视频不进仓库（B 站链接形态存于 episode.json）。
> 设计文档：`.trae/documents/产品与规划/13_内容节目展示子系统_产品与技术设计_V1.0.md`
> 运维总文档：`.trae/documents/技术与架构/香港生产环境部署文档_v1.0.0.md` §10

---

## 0. 服务器实际布局（先读这一节，别按 monorepo 直觉操作）

服务器上的代码**不是** `git clone` 出来的 monorepo，而是**扁平单应用**布局。
以下路径是实测值，所有操作以此为准：

| 用途 | 服务器路径 | 对应仓库路径 |
|------|-----------|-------------|
| 后端运行目录（systemd WorkingDirectory） | `/opt/finestem/app` | `apps/backend` |
| 后端入口 | `/opt/finestem/app/main.py` | `apps/backend/main.py` |
| 后端包 | `/opt/finestem/app/app/` | `apps/backend/app/` |
| Python 虚拟环境 | `/opt/finestem/venv` | — |
| **代码来源**（GitHub 浅克隆，仅取文件用） | `/opt/finestem/repo` | 仓库根 |
| Know 前端构建处 | `/opt/finestem/repo/apps/know` | `apps/know` |
| Know 前端产物（nginx root） | `/opt/finestem/know/dist` | 构建生成 |
| Know 内容库（nginx /content/） | `/opt/finestem/content/know` | `content/know` |
| 主站前端产物 | `/opt/finestem/frontend/dist` | `apps/frontend` 构建生成 |

> ⚠️ **`/opt/finestem/backend` 这个目录不存在**。早期文档里的这个路径是错的，
> 照抄会 `cd` 失败。见下方"更新代码"的正确对应关系。

### 后端部署单元对应关系

```
仓库 repo/apps/backend/app/api/know.py        → /opt/finestem/app/app/api/know.py
仓库 repo/apps/backend/app/schemas/know.py    → /opt/finestem/app/app/schemas/know.py
仓库 repo/apps/backend/app/services/know_content.py → /opt/finestem/app/app/services/know_content.py
仓库 repo/content/know/*                      → /opt/finestem/content/know/
仓库 repo/apps/know 构建后的 dist/*           → /opt/finestem/know/dist/
```

---

## 1. 首次上线（已完成，此处为留档）

### 1.1 DNS

DNSPod 控制台给 `wostemstudio.site` 添加 A 记录：`know` → `43.128.8.131`。
上线前确认：`getent hosts know.wostemstudio.site` 必须解析到该 IP。

### 1.2 代码来源：建立仓库克隆

```bash
cd /opt/finestem && git clone --depth 1 https://github.com/fancyhf/fineSTEM.git repo
# 约 350MB；仅作为文件来源，不直接运行
```

### 1.3 后端

```bash
R=/opt/finestem/repo; A=/opt/finestem/app
# 备份
cp $A/main.py $A/main.py.bak-know
cp $A/app/core/config.py $A/app/core/config.py.bak-know
cp $A/.env $A/.env.bak-know
# 复制新文件
cp $R/apps/backend/app/api/know.py          $A/app/api/know.py
cp $R/apps/backend/app/schemas/know.py      $A/app/schemas/know.py
cp $R/apps/backend/app/services/know_content.py $A/app/services/know_content.py
```

两处**必须**的改动（脚本化插入，不要整文件覆盖 `main.py`，服务器版本可能落后于仓库）：

1. `app/core/config.py` 增加字段：

```python
    # 节目频道（Know 子系统）内容目录：生产指向 /opt/finestem/content/know
    KNOW_CONTENT_DIR: Optional[str] = None
```

2. `main.py` 增加三处：

```python
from pathlib import Path                    # 若尚未导入

from app.api import (
    ...
    files,
    know,                                   # 新增
    notifications,
    ...
)

# 节目频道（Know 子系统）只读接口
app.include_router(know.router, prefix=API_PREFIX)

# Know 内容静态资源（生产优先走 nginx /content/）
# main.py 位于 /opt/finestem/app/，上溯 1 级到 /opt/finestem
_KNOW_CONTENT_DIR = settings.KNOW_CONTENT_DIR or str(
    Path(__file__).resolve().parents[1] / "content" / "know"
)
if Path(_KNOW_CONTENT_DIR).is_dir():
    app.mount("/content", StaticFiles(directory=_KNOW_CONTENT_DIR, html=True), name="know-content")
```

> **上溯层级因布局而异**：仓库里 `main.py` 在 `apps/backend/`，上溯 **2** 级到仓库根；
> 服务器上在 `/opt/finestem/app/`，上溯 **1** 级。所以生产环境**必须**靠
> `KNOW_CONTENT_DIR` 环境变量显式指定，不要依赖默认值（否则静默返回空数据）。

3. `.env` 追加：

```ini
KNOW_CONTENT_DIR=/opt/finestem/content/know
CORS_ALLOW_ORIGINS=["https://wostemstudio.site","https://know.wostemstudio.site"]
```

> 注意键名是 `CORS_ALLOW_ORIGINS`（不是 `CORS_ORIGINS`），值为 **JSON 数组**格式。

```bash
systemctl restart finestem-backend
journalctl -u finestem-backend -n 20 --no-pager   # 确认无报错
curl -s http://127.0.0.1:8001/api/v1/know/home    # 期望 success:true
```

### 1.4 内容库

```bash
mkdir -p /opt/finestem/content
cp -r /opt/finestem/repo/content/know /opt/finestem/content/know
```

### 1.5 前端构建

在仓库内构建（Node v18.20.8 已满足 vite 5），产物复制到独立目录：

```bash
cd /opt/finestem/repo/apps/know && npm install --no-audit --no-fund
npm run build                                  # tsc && vite build → apps/know/dist
mkdir -p /opt/finestem/know
cp -r /opt/finestem/repo/apps/know/dist /opt/finestem/know/dist
```

> 用仓库根的 `npm run build:know`（workspace 模式）也可以，但会连带安装
> 主站前端依赖，耗时更长；单独构建 `apps/know` 更快（约 180 个包 / 2 秒）。

### 1.6 证书与 Nginx

```bash
# 先放 80 端口引导配置（见 deploy/know.conf，root 与 alias 已按实际路径写好）
cp /opt/finestem/repo/deploy/know.conf /etc/nginx/sites-enabled/know.conf
nginx -t && systemctl reload nginx

# 签证书，certbot 会自动把配置升级为 443 + 80 跳转
certbot --nginx -d know.wostemstudio.site --non-interactive --agree-tos --redirect
```

**不要动 `finestem.conf`（主站配置）。**

### 1.7 验收

```bash
curl -sI https://know.wostemstudio.site                                          # 200
curl -s  https://know.wostemstudio.site/api/v1/know/home                         # success:true
curl -sI https://know.wostemstudio.site/content/index.json                       # 200
curl -sI https://know.wostemstudio.site/content/series/recursive-beauty/ep01/cover.jpg   # 200
curl -sI http://know.wostemstudio.site                                           # 301 → https
curl -sI https://wostemstudio.site                                               # 200（主站不受影响）
```

---

## 2. 日常工作流

### 2.1 发布新一集（搬运 SOP，ADR-002 §4）

内容在各个工作空间（如 `G:\buddyspace\鸡娃先自鸡\`）生产，**做完后负责人告知
Agent 源路径**，由 Agent 执行搬运入库：

1. 互动 web 代码 → `content/know/series/<系列>/<集>/interactive/`（原样复制，不改写）
2. 说明文档（脚本/指引/文案）→ 同集 `docs/`
3. 填 `episode.json`（标题、摘要、说明、资料清单；封面可让 Agent 生成）
4. `npm run validate:content` **零错误**才继续
5. `git commit` + `git push`（内容与代码全部入库，这是服务器能拿到的唯一途径）
6. 服务器同步（见 2.3）→ **即生效**（后端按文件指纹自动重扫，无需重启）

### 2.2 视频接入

视频一律 B 站（服务器不存视频）。负责人把 B 站链接发给 Agent，Agent 在
`episode.json` 的 `resources.videos` 里填：

```json
{ "id": "child-video", "audience": "child", "title": "儿童视频 · 第 1 集",
  "embed_url": "//player.bilibili.com/player.html?bvid=BVxxxx&autoplay=0" }
```

上线前的空位在 `announce` 里占位（页面自动显示"即将上线"）。改动同样走
validate → commit → push → 服务器同步。

### 2.3 服务器同步（更新部署）

```bash
# 1) 取最新代码
cd /opt/finestem/repo && git pull --ff-only

# 2) 内容库（内容改动走这一步，无需重启后端）
cp -r /opt/finestem/repo/content/know/* /opt/finestem/content/know/

# 3) 前端有改动时重新构建
cd /opt/finestem/repo/apps/know && npm run build \
  && cp -r dist/* /opt/finestem/know/dist/

# 4) 后端有改动时：按 §0 的对应关系复制文件，再重启
cp /opt/finestem/repo/apps/backend/app/api/know.py /opt/finestem/app/app/api/know.py
systemctl restart finestem-backend
```

---

## 3. 排障速查

| 症状 | 检查 |
|------|------|
| 首页空白/接口 404 | `journalctl -u finestem-backend -f`；确认后端改动已复制且已 restart |
| 封面/动画 404 | `ls /opt/finestem/content/know/...` 文件在不在；nginx `/content/` alias 是否正确 |
| 首页有壳但没数据 | `KNOW_CONTENT_DIR` 是否指向真实目录（**目录缺失时接口会静默返回空数据**，不报错） |
| 后端启动报 `Settings` 属性错误 | `config.py` 是否漏加 `KNOW_CONTENT_DIR` 字段 |
| 动画字体不对 | 字体已入库（`content/know/assets/fonts/`），确认同步完整 |
| 构建报 TS2307 找不到 `../lib/filter` | 仓库缺文件，确认本地已 `git push`；曾因 `.gitignore` 的 `lib/` 规则误伤 `apps/know/src/lib/`（已加例外） |
| 证书告警 | `certbot certificates`；应包含 know.wostemstudio.site |
| B 站播放器空白 | 检查 embed_url 是否带 bvid；必要时补全参数（`&page=1&high_quality=1`） |
| 主站图片/功能异常 | 检查是否误改了 `/etc/nginx/sites-enabled/finestem.conf` |

---

**文档结束**
