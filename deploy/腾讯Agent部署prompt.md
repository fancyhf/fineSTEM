# 腾讯轻量云 Agent 部署 Prompt（Know 节目频道）

> 用法：整段复制给腾讯轻量云 Agent 执行。
> 状态：Know 已于 2026-08-30 上线（https://know.wostemstudio.site）。
> 本 Prompt 用于**重新部署 / 迁移 / 排障复盘**，路径均为实测值。
> 前置：DNSPod 已添加 A 记录 know → 43.128.8.131。
> 详细指南见 `deploy/Know子系统部署指南_v1.0.md`。

---

## 任务：把 Know 节目频道（与孩子对话，know.wostemstudio.site）部署到本服务器

### 背景与环境（已核实，直接使用）

- 服务器：腾讯云轻量香港，Ubuntu 22.04，公网 IP 43.128.8.131，Node v18.20.8
- 已在运行、**不许改动**：nginx 443 上的主站（wostemstudio.site，配置在
  `/etc/nginx/sites-enabled/finestem.conf`）、ZeroClaw 服务（端口 42617）
- 后端：finestem-backend（FastAPI，systemd 单元 finestem-backend，
  WorkingDirectory `/opt/finestem/app`，监听 127.0.0.1:8001），API 前缀 `/api/v1`
- **后端是扁平布局**：`/opt/finestem/app` = 仓库里的 `apps/backend`，且**不是 git 仓库**
- 代码仓库：GitHub fancyhf/fineSTEM（monorepo），分支 main
- 本次要部署的三块东西（在仓库里）：
  1. 后端只读路由 `apps/backend/app/api/know.py`（/api/v1/know/*，挂在同一 backend 进程）
  2. 前端应用 `apps/know`（在仓库内 `npm run build`，产物 `apps/know/dist`）
  3. 内容库 `content/know`（静态资源：封面/互动动画 html/字体/文档）
- 仓库内参考文件：`deploy/Know子系统部署指南_v1.0.md`、`deploy/know.conf`

### 第 0 步：前置检查（任一不满足就停下输出报告，不要猜）

1. `getent hosts know.wostemstudio.site` 必须解析到 43.128.8.131；
   否则停止，报告："请在 DNSPod 给 wostemstudio.site 添加 A 记录 know → 43.128.8.131，加好后重新运行"
2. `systemctl cat finestem-backend`：确认 WorkingDirectory=`/opt/finestem/app`、
   EnvironmentFile=`/opt/finestem/app/.env`
3. `ls /opt/finestem`：应有 `app`、`data`、`frontend`、`venv`（若已有 `repo`/`know`/`content` 说明曾部署过）
4. `node -v`：低于 v18 则先通过 NodeSource 安装 Node 20（vite 5 构建需要）

### 第 1 步：取代码

若 `/opt/finestem/repo` 不存在（首次）：

```bash
cd /opt/finestem && git clone --depth 1 https://github.com/fancyhf/fineSTEM.git repo
```

否则：`cd /opt/finestem/repo && git pull --ff-only`（有冲突就停止并原样贴出错误）

> `/opt/finestem/repo` 只作为**文件来源**，不直接运行。运行目录是 `/opt/finestem/app`。

### 第 2 步：后端

```bash
R=/opt/finestem/repo; A=/opt/finestem/app
cp $A/main.py $A/main.py.bak-know
cp $A/app/core/config.py $A/app/core/config.py.bak-know
cp $A/.env $A/.env.bak-know
cp $R/apps/backend/app/api/know.py               $A/app/api/know.py
cp $R/apps/backend/app/schemas/know.py           $A/app/schemas/know.py
cp $R/apps/backend/app/services/know_content.py  $A/app/services/know_content.py
```

**不要整文件覆盖 `main.py`**（服务器版本可能落后于仓库）。用脚本插入三处：

1. `app/core/config.py` 增加字段 `KNOW_CONTENT_DIR: Optional[str] = None`
2. `main.py`：
   - 必要时加 `from pathlib import Path`
   - `from app.api import (...)` 块里加 `know,`
   - 末尾加 `app.include_router(know.router, prefix=API_PREFIX)` 与 `/content` 静态挂载
     （路径回退用 `Path(__file__).resolve().parents[1] / "content" / "know"`，
     因为 main.py 在 `/opt/finestem/app/`，上溯 1 级；仓库里是 `parents[2]`）

`.env` **追加**（不要打印其内容）：

- `KNOW_CONTENT_DIR=/opt/finestem/content/know`
- 键名是 **`CORS_ALLOW_ORIGINS`**（JSON 数组），追加 `https://know.wostemstudio.site`
  → `CORS_ALLOW_ORIGINS=["https://wostemstudio.site","https://know.wostemstudio.site"]`

```bash
systemctl restart finestem-backend
journalctl -u finestem-backend -n 20 --no-pager      # 确认无报错
curl -s http://127.0.0.1:8001/api/v1/know/home       # 期望 success:true
```

> `KNOW_CONTENT_DIR` 必须显式配置：目录缺失时接口**静默返回空数据**，不报错，极易误判。

### 第 3 步：内容库

```bash
mkdir -p /opt/finestem/content
cp -r $R/content/know /opt/finestem/content/know
```

### 第 4 步：前端构建

```bash
cd /opt/finestem/repo/apps/know && npm install --no-audit --no-fund
npm run build                                        # tsc && vite build → apps/know/dist
mkdir -p /opt/finestem/know
cp -r /opt/finestem/repo/apps/know/dist /opt/finestem/know/dist
ls /opt/finestem/know/dist/index.html /opt/finestem/know/dist/assets   # 确认产物存在
```

> 构建若报 `TS2307: Cannot find module '../lib/filter'`，说明 `apps/know/src/lib/`
> 没进仓库（曾被 .gitignore 的 `lib/` 规则误伤），需先在仓库侧修复并 push。

### 第 5 步：证书与 nginx

1. 先放 80 端口引导配置（仓库 `deploy/know.conf`，root 与 alias 已按实际路径写好）：

```bash
cp /opt/finestem/repo/deploy/know.conf /etc/nginx/sites-enabled/know.conf
nginx -t && systemctl reload nginx
```

2. 签证书（certbot 会自动把配置升级为 443 + 80 跳转）：

```bash
certbot --nginx -d know.wostemstudio.site --non-interactive --agree-tos --redirect
```

3. **不要动 `finestem.conf`（主站配置）**。

### 第 6 步：验收（逐条执行并把结果写进汇报）

| # | 命令 | 期望 |
|---|------|------|
| 1 | `curl -sI https://know.wostemstudio.site` | 200 |
| 2 | `curl -s https://know.wostemstudio.site/api/v1/know/home` | `success:true` |
| 3 | `curl -s -o /dev/null -w "%{http_code}" https://know.wostemstudio.site/content/index.json` | 200 |
| 4 | `curl -sI https://know.wostemstudio.site/content/series/recursive-beauty/ep01/cover.jpg` | 200 |
| 5 | `curl -sI http://know.wostemstudio.site` | 301 跳 https |
| 6 | `curl -sI https://wostemstudio.site` | 200（主站未受影响） |
| 7 | `systemctl is-active finestem-backend zeroclaw nginx` | 均 active |

### 汇报要求

- 按步骤列出：执行了什么、关键命令输出、与上述期望的偏差
- 任何一步失败：贴出错误原文、说明已完成的步骤并停止；**不要回滚或修改主站相关的任何配置**
- 全程不要在回复里输出 .env 文件内容或任何密钥

---

**Prompt 结束**
