# fineSTEM × ZeroClaw 部署与运维指南

**版本**: v1.0.0
**日期**: 2026-07-22
**适用对象**: 开发 agent / 运维 / 部署人员
**前置文档**: `ZeroClaw集成重构_v1.0.0.md`（架构）、`ZeroClaw架构审计报告_v1.0.0`（审计）

> 本文档是 ZeroClaw 部署的**唯一权威指南**。包含开发环境搭建、生产部署、密钥管理、端口规范、反代方案、以及 SOP/memory 两个待实施功能的设计方案。

---

## 1. 系统架构（部署视角）

```
┌──────────────────────────────────────────────────────────────────┐
│ 生产环境                                                          │
│                                                                  │
│  浏览器 ──HTTPS──> Nginx (443)                                    │
│                    ├─ / → 前端静态文件 (dist/)                     │
│                    ├─ /api/ → FastAPI (127.0.0.1:3200)            │
│                    └─ /zeroclaw/ws → ZeroClaw Gateway (127.0.0.1:42617) │
│                                                                  │
│  ZeroClaw daemon (127.0.0.1:42617)                               │
│    ├─ config.toml (密钥用 enc2: 加密，不明文)                      │
│    ├─ MCP → FastAPI 后端 tools.py (stdio)                         │
│    └─ Provider → DeepSeek API (HTTPS)                             │
│                                                                  │
│  FastAPI 后端 (127.0.0.1:3200)                                   │
│    └─ SQLite (D:/data/finestem/finestem.db)                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. 开发环境搭建

### 2.1 前置条件

| 组件 | 版本 | 用途 |
|------|------|------|
| Node.js | ≥18 | 前端构建 |
| Python | ≥3.12 | 后端 + MCP server |
| ZeroClaw | 0.8.3 | AI 运行时 daemon |
| SQLite | 内置 | 数据库 |

### 2.2 ZeroClaw 安装

```bash
# ZeroClaw 是单一 Rust 二进制，下载后解压到固定目录
# Windows: H:\dev-env\zeroclaw\
#   ├── bin\zeroclaw.exe
#   ├── bin\web\           (Dashboard 静态文件)
#   └── config\            (配置目录)
```

### 2.3 密钥配置（R1 修复后的正确方式）

**禁止**：直接在 config.toml 里写明文 `api_key = "sk-xxx"`。

**正确方式**：用 `zeroclaw config set`，ZeroClaw 会用 OS keyring + enc2 加密存储：

```bash
# 设置 DeepSeek API Key（会被加密成 enc2:xxx 存入 config.toml）
zeroclaw config set providers.models.deepseek.default.api_key --no-interactive "sk-你的真实key"

# 验证（显示 **** 说明已加密存储）
zeroclaw config list --secrets
# 预期输出: providers.models.deepseek.default.api_key = **** 🔒

# 如果要设 GLM fallback（可选，需要 GLM API Key）
zeroclaw config set providers.models.glm.default.api_key --no-interactive "你的glm-key"
# 然后取消 config.toml 里 [providers.models.glm.default] 段的注释
```

### 2.4 启动顺序

```bash
# 1. ZeroClaw daemon（必须第一个启动）
cd H:/dev-env/zeroclaw
set ZEROCLAW_CONFIG_DIR=H:\dev-env\zeroclaw\config
set ZEROCLAW_DATA_DIR=H:\dev-env\zeroclaw\data
.\bin\zeroclaw.exe daemon
# 验证: curl -s http://127.0.0.1:42617/health 应返回 {"status":"ok"}

# 2. 后端 FastAPI（MCP server 依赖它）
cd G:/mediaProjects/fineSTEM/apps/backend
python main.py
# 验证: curl -s http://localhost:3200/health

# 3. 前端 dev server
cd G:/mediaProjects/fineSTEM/apps/frontend
npm run dev
# 验证: curl -s http://localhost:5184/
```

### 2.5 前端环境变量

`apps/frontend/.env.development`：

```env
VITE_ZC_TOKEN=zc_xxx          # ZeroClaw pairing token（从 zeroclaw gateway get-paircode 获取）
VITE_ZC_URL=127.0.0.1:42617   # ZeroClaw 地址（开发环境本机）
VITE_ZC_AGENT=assistant       # ZeroClaw agent alias
```

生产环境用 `.env.production`，`VITE_ZC_URL` 设为生产域名。

---

## 3. 生产部署

### 3.1 Nginx 反向代理（R4 方案）

生产环境浏览器无法直接访问 `127.0.0.1:42617`。用 Nginx 反代：

```nginx
# /etc/nginx/sites-available/finestem
upstream finestem_frontend {
    server 127.0.0.1:5184;
}
upstream finestem_backend {
    server 127.0.0.1:3200;
}
upstream zeroclaw_gateway {
    server 127.0.0.1:42617;
}

server {
    listen 443 ssl http2;
    server_name finestem.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 前端静态文件
    location / {
        proxy_pass http://finestem_frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://finestem_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # ZeroClaw WebSocket（关键：Upgrade 头）
    location /zeroclaw/ws {
        proxy_pass http://zeroclaw_gateway/ws/chat;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;  # AI 对话可能较长
    }
}
```

前端 `.env.production`：
```env
VITE_ZC_URL=finestem.example.com   # 生产域名
VITE_ZC_TOKEN=zc_生产环境pairing_token
```

前端 `useStreamingChat.ts` 的 `getZeroClawWsBaseUrl()` 会自动用 `VITE_ZC_URL` 构造 WebSocket URL：
- 开发: `ws://127.0.0.1:42617`
- 生产: `wss://finestem.example.com/zeroclaw/ws`（通过 Nginx 反代）

### 3.2 端口规范（R2 决策：不改端口）

| 端口 | 服务 | 暴露范围 | 说明 |
|------|------|---------|------|
| 42617 | ZeroClaw Gateway | 仅 127.0.0.1 | ZeroClaw 官方默认端口，**不改**。生产通过 Nginx 反代 `/zeroclaw/ws` |
| 3200 | FastAPI 后端 | 仅 127.0.0.1 | 生产通过 Nginx 反代 `/api/` |
| 5184 | 前端 dev server | 仅 127.0.0.1 | 生产用 `vite build` 产出静态文件，Nginx 直接 serve |

**所有端口只绑 127.0.0.1，对外只通过 Nginx 443 暴露。**

### 3.3 进程管理

用 systemd（Linux）或 NSSM（Windows）管理三个进程：

```ini
# /etc/systemd/system/zeroclaw.service
[Unit]
Description=ZeroClaw AI Agent Runtime
After=network.target

[Service]
Type=simple
Environment=ZEROCLAW_CONFIG_DIR=/opt/zeroclaw/config
Environment=ZEROCLAW_DATA_DIR=/opt/zeroclaw/data
ExecStart=/opt/zeroclaw/bin/zeroclaw daemon
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## 4. daemon 健康检查与容灾（R8 方案）

### 4.1 已实现的防护

前端 `useStreamingChat.ts` 在 WebSocket 连接失败时：
- 抛出带 `isDaemonDown: true` 标记的错误
- 控制台输出技术诊断信息（开发者看）
- Create.tsx 显示友好提示："🔌 AI 导师暂时离线了。请稍等片刻再试，或刷新页面。"（学生看）
- **不显示"继续生成"按钮**（daemon 挂了点继续也没用）

### 4.2 运维监控

```bash
# 定期健康检查（cron 每分钟）
curl -sf http://127.0.0.1:42617/health || systemctl restart zeroclaw

# 或用 ZeroClaw 自带诊断
zeroclaw doctor
zeroclaw status
```

### 4.3 待实施：前端自动重连

当前 daemon 恢复后，学生需要手动重发消息。未来可加自动重连逻辑（exponential backoff），但优先级不高——daemon 用 systemd Restart=always 管理，通常 5 秒内恢复。

---

## 5. 待实施功能设计方案

> 以下两个功能**设计已完整，实施待排期**。不是"以后再说"的模糊计划，而是随时可以启动的详细方案。

### 5.1 SOP 承载 PBL 阶段门禁

#### 为什么值得做

当前 PBL 门禁是"prompt 规则 + 工具硬门禁"两层：
- prompt 层：config.toml system_prompt 告诉 AI"必须按 stage_00→01→...→08 推进"
- 工具层：stage_advancer 的 `can_advance_to` 硬拦截跨阶段跳

问题：AI 可以**选择不调 stage_advancer**——系统无法强制 AI 走完每个阶段。虽然实测 AI 大多数时候遵守，但不是 100% 可靠。

ZeroClaw 的 SOP（Standard Operating Procedure）能定义**声明式节点图**，AI 必须按图走，每步有进入/退出条件。

#### 设计方案

```
sops/pbl-stage-flow/
├── SOP.toml          # 节点图定义
└── SOP.md            # 节点详细说明
```

**SOP.toml 设计**（9 阶段 = 9 个节点）：

```toml
[sop]
name = "pbl-stage-flow"
version = "1.0.0"
description = "PBL 9 阶段研学流程门禁"

# 节点 = 阶段
[[sop.nodes]]
id = "stage_00_bootstrap"
name = "项目初始化"
entry_condition = "学生说'我想做项目'"
exit_condition = "ask_question 完成 3 轮 + project_creator 调用成功"
on_exit = "stage_01_brainstorm"

[[sop.nodes]]
id = "stage_01_brainstorm"
name = "脑爆选题"
entry_condition = "上一节点 stage_00 已完成"
exit_condition = "artifact_writer(brainstorm) 成功 + check_gate 通过"
on_exit = "stage_02_brief"

# ... 其余 7 个节点同理
```

**实施步骤**（预计 2-3 天）：
1. 确认 SOP.toml 的完整语法规范（查 ZeroClaw 官方文档 `zeroclaw sop validate`）
2. 定义 9 个节点的 entry/exit condition
3. `zeroclaw sop validate pbl-stage-flow` 验证
4. `zeroclaw sop graph pbl-stage-flow` 查看节点图
5. config.toml 里给 agent 绑定此 SOP
6. 跑多轮对话测试，确认 AI 被强制按图走

**风险**：SOP 可能比工具硬门禁更"死板"——如果 AI 在某个节点卡住（如门禁不通过），SOP 可能阻止它回退尝试。需要设计 failover 机制。

### 5.2 项目级持久记忆（Project Memory）

#### 为什么重要

PBL 项目不可能一次做完。学生做到 stage_03 后关电脑，下次打开应该**直接从 stage_03 继续**——不用重新回答年级/时间/想法。当前 ZeroClaw session 记忆在刷新/新开 session 后丢失。

#### 设计方案

两层记忆：

**层 1：项目状态持久化**（已有基础设施）
- `SKILL_STATE` 已经在数据库里存了 `current_stage` / `standard_step_data` / `metadata`
- 前端打开项目时调 `skill_state_reader` 工具恢复状态
- **缺口**：前端 `useStreamingChat` 每次新对话都开新 session，没有关联到项目的 skill_state。需要：前端打开已有项目时，把 skill_state 注入 WebSocket 握手的 context

**层 2：ZeroClaw memory 集成**（待实施）
- ZeroClaw 有 `zeroclaw memory` CLI（store/recall/forget），支持分类记忆 + FTS + embedding
- 设计：把学生的年级/兴趣/能力标签存到 ZeroClaw memory，AI 跨 session 可 recall
- 存储键：`finestem:project:{project_id}:profile`（年级、时间预算、想法）
- 存储键：`finestem:user:{user_id}:capability_tags`（已掌握技能）

```
学生打开项目 → 前端 skill_state_reader 读 current_stage
             → ZeroClaw memory recall finestem:project:{id}:profile
             → AI 知道"这个学生是初中、6小时预算、做到 stage_03"
             → 直接从 stage_03 继续，不重复问
```

**实施步骤**（预计 3-5 天）：
1. 新增 MCP 工具 `memory_store` / `memory_recall`（封装 ZeroClaw memory CLI 或直接用 sqlite memory backend）
2. config.toml 的 system_prompt 加记忆使用规范
3. 前端打开已有项目时，在 buildOutgoingMessage 注入 `<memory>` 块
4. stage_advancer 推进时自动 store 当前阶段进度
5. 测试：做到 stage_03 → 关 session → 重开 → 确认从 stage_03 继续

---

## 6. 配置项速查

### 6.1 config.toml 关键配置

| 配置项 | 当前值 | 说明 |
|--------|--------|------|
| `schema_version` | 3 | V3 配置格式 |
| `providers.models.deepseek.default` | enc2: 加密 key | 主 provider |
| `providers.models.glm.default` | 注释掉（R3） | 无 key，不启用 |
| `risk_profiles.standard` | supervised + auto_approve 12 工具 | 自动放行 PBL 工具 |
| `agents.assistant` | system_prompt(309行) + mcp_bundles=[pbl] | PBL 导师 |
| `runtime_profiles.default` | agentic=true, max_tool_iterations=100 | 启用工具调用循环 |
| `tool_filter_groups` | always/finestem__* | 工具始终可见 |
| `[mcp.servers.finestem]` | stdio → server.py | MCP server |
| `[gateway]` | 127.0.0.1:42617, require_pairing=true | 网关 |

### 6.2 密钥清单

| 密钥 | 存储方式 | 设置命令 |
|------|---------|---------|
| DeepSeek API Key | enc2: 加密（config.toml） | `zeroclaw config set providers.models.deepseek.default.api_key` |
| ZeroClaw Pairing Token | paired_tokens（config.toml） | `zeroclaw gateway get-paircode --new` |
| 前端 Bearer Token | .env.development（VITE_ZC_TOKEN）| 从 pairing 流程获取 |

---

## 7. 故障排查

| 症状 | 排查 | 修复 |
|------|------|------|
| 前端"AI 导师暂时离线" | `curl http://127.0.0.1:42617/health` 不通 | `systemctl restart zeroclaw` |
| config.toml 解析失败 | `zeroclaw config migrate` 看错误行 | 修复 TOML 语法（常见：多行字符串 `"""` 未闭合）|
| AI 不调工具 | `zeroclaw status` 检查 agentic=true | 确认 runtime_profiles.default.agentic = true |
| 工具不可见 | `zeroclaw status` 检查 tool_filter_groups | 确认 `mode = "always"`, `tools = ["finestem__*"]` |
| API 401 | `zeroclaw config list --secrets` 检查 key | `zeroclaw config set providers.models.deepseek.default.api_key` |
| MCP server 崩溃 | 看 `H:/dev-env/zeroclaw/config/logs/daemon.log` | 检查 server.py 的 PYTHONPATH / DB_URL |

---

**文档结束。SOP 和 memory 的实施排期由项目负责人决定，设计方案随时可启动。**
