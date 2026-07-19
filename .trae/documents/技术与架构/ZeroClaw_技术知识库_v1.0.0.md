# ZeroClaw 技术知识库（独立版）

## 文档信息
- version: `1.2.0`
- created_at: `2026-04-25 07:41:04.266` (UTC)
- updated_at: `2026-07-19` (UTC)
- maintainer: `AI Agent`
- scope: `通用技术文档 + fineSTEM 集成实践`
- 当前部署：ZeroClaw v0.8.3 @ `H:\dev-env\zeroclaw\`（真实 Rust 二进制，非 FastAPI 模拟）

## 1. ZeroClaw 是什么
ZeroClaw 是一个面向 AI 助手系统的基础设施底座，核心特征是可插拔、可替换、可组合。它不等同于某一个模型 SDK，而是位于业务应用与模型供应商之间的中间层，提供统一的网关、编排、能力扩展与治理能力。

从工程视角看，它更接近“AI Agent Runtime + Gateway + Provider Abstraction + Tool/Memory Integration”的组合平台。

## 2. 设计定位与边界
### 2.1 定位
- 统一 AI 调用入口：上层业务通过单一接口接入。
- 降低厂商耦合：通过 Provider 抽象切换不同模型服务。
- 支持 Agent 化执行：在对话循环中触发工具调用与上下文检索。
- 提供控制平面：会话、配置、实时连接与外部集成可集中管理。

### 2.2 边界
- ZeroClaw 负责“AI 基础设施能力”。
- 业务系统负责“领域数据、业务流程、权限策略、产品交互”。
- 模型选择、回退、重试、密钥策略应优先收敛到底座层，不应散落在每个业务服务中。

## 3. 核心架构（概念模型）
根据官方 Wiki 与文档描述，ZeroClaw 的核心可概括为以下模块：

- Agent Core：对话与工具调用主循环，管理消息生命周期。
- Channels：对接输入输出通道（CLI、聊天平台、Webhook 等）。
- Providers：统一封装 LLM 厂商接口，隔离各家 API 差异。
- Tools：可调用的外部能力（系统工具、业务工具、脚本工具等）。
- Memory：会话与长期记忆层，支持可替换存储后端。
- Gateway：HTTP/WS/SSE 控制平面，承载会话、实时通信、webhook 等。

可将其理解为：`用户/系统事件 -> Channel/Gateway -> Agent Loop -> Provider + Tools + Memory -> 响应输出`。

## 4. Trait 驱动可插拔架构
ZeroClaw 强调 trait 驱动（接口驱动）设计：每个子系统都可通过统一契约替换实现，而不是在业务代码中深度绑定具体组件。

典型收益：
- 组件可替换：不同 Provider/Memory/Channel 可按配置切换。
- 风险可隔离：单组件升级或故障不必牵动全系统。
- 部署可迁移：本地、边缘、VPS、容器化环境都可落地。

## 5. Gateway 控制平面
ZeroClaw Gateway 是核心运行入口之一，公开 HTTP/WS/SSE 能力，为外部系统提供统一接入面。

常见职责：
- 会话与在线状态管理
- 实时交互连接（WS/SSE）
- webhook 入口
- 控制台/仪表板相关能力
- 与 Agent 主循环联动

公开资料显示其默认倾向本地优先部署（如本机回环地址绑定），以降低暴露面与部署复杂度。

## 6. Provider 抽象与可靠性策略
Provider 层统一了模型调用接口，关键价值包括：
- 多模型供应商兼容（统一调用语义）
- 凭证解析与配置注入
- 重试与指数退避
- 多 Provider 回退链（fallback chain）
- 在限流或临时故障时提升可用性

这意味着上层业务通常只需面向“一个底座接口”，而非直接耦合某一家模型 API。

## 7. 安全与治理模型（实践视角）
在底座化架构中，建议将以下能力优先放在 ZeroClaw 层：
- 凭证托管与最小化暴露
- 工具调用策略与白名单
- 外部请求出站策略（域名/IP/协议约束）
- 审计与可追踪日志（请求链路、工具调用、错误原因）
- 配置分层（dev/staging/prod）与变更可回滚

业务层应保留域内鉴权与数据权限，但不应重复实现底座级安全治理。

## 8. 部署拓扑（通用）
### 8.1 本地单机
- 适合开发、调试、教学演示
- Gateway 本地监听
- 本地/远程模型 Provider 可按配置接入

### 8.2 服务器部署
- Gateway 独立服务化
- 上层业务通过内网或受控出口访问 Gateway
- 结合反向代理、TLS、访问控制与日志系统

### 8.3 分层部署
- ZeroClaw 作为统一 AI 中台
- 多业务系统共享同一底座
- 通过命名空间/租户/策略隔离不同业务线

## 9. 性能与成本考量
公开资料将 ZeroClaw 定位为轻量与高效率底座，强调低资源占用与快速启动。实际效果受以下因素影响：
- Provider 网络延迟
- 工具调用复杂度
- 记忆存储后端性能
- 并发会话规模

工程上应优先做压测与指标化验证，而非仅依赖宣传指标。

## 10. 与“直接 SDK 接入”方案对比
### ZeroClaw 底座方案优势
- 统一接入与策略管理
- 快速切模型与跨供应商能力
- 便于审计、治理、观测
- 多业务复用同一 AI 基础设施

### 直接 SDK 方案优势
- 路径短、初期上手快
- 小型原型开发成本低

### 何时优先 ZeroClaw
- 需要多模型/多通道
- 需要可靠性与策略治理
- 需要长期演进与团队协作

## 11. 实施建议（通用，不绑定项目）
- 先定义底座边界：业务服务禁止绕过网关直连模型。
- 抽象统一请求协议：消息、上下文、模型提示、追踪 ID。
- 建立故障分级：未配置、不可达、超时、Provider 失败、格式异常。
- 落地可观测：成功率、P95/P99、重试率、回退命中率、工具失败率。
- 建立验收基线：连通性、可靠性、安全性、回归稳定性。

## 12. 常见误区
- 将 ZeroClaw 误当作某家模型 SDK。
- 在业务层重复实现回退/重试/凭证逻辑，导致治理分裂。
- 只接入调用不做观测，故障时难定位到底座还是业务问题。
- 配置散落多处，环境切换容易出现“本地可用、线上不可用”。

## 13. FAQ
### Q1: ZeroClaw 是否绑定某个模型厂商？
不是。其价值之一是 Provider 抽象与可替换能力。

### Q2: 是否可以只用 Gateway，不启用复杂工具链？
可以。可从最小链路开始，再逐步引入 Tools/Memory/策略能力。

### Q3: 业务是否还需要做权限控制？
需要。底座负责 AI 基础治理，业务仍需做领域权限与数据边界控制。

### Q4: 是否适合中小团队？
适合。尤其在多模型切换、统一治理、长期维护场景中收益更明显。

## 14. 参考资料
- ZeroClaw 官方 Wiki 概览：<https://github.com/zeroclaw-labs/zeroclaw/wiki/01-Overview>
- ZeroClaw 核心架构：<https://github.com/zeroclaw-labs/zeroclaw/wiki/03-Core-Architecture>
- ZeroClaw Trait Driven Design：<https://github.com/zeroclaw-labs/zeroclaw/wiki/03.1-Trait-Driven-Design>
- ZeroClaw Providers：<https://github.com/zeroclaw-labs/zeroclaw/wiki/05-Providers>
- ZeroClaw Built-In Providers：<https://github.com/zeroclaw-labs/zeroclaw/wiki/05.1-Built-In-Providers>
- ZeroClaw Custom Providers：<https://github.com/zeroclaw-labs/zeroclaw/wiki/05.2-Custom-Providers>
- ZeroClaw 官方站点：<https://www.zeroclaw.dev/>
- ZeroClaw 中文介绍页：<https://zeroclaw.space/zh/guides/what-is-zeroclaw>

## 15. fineSTEM 集成实践

### 15.1 当前架构（MVP 阶段）

```text
前端 (useStreamingChat.ts)
  ↳ ws://127.0.0.1:42617/ws/chat?token=zc_xxx&agent=assistant
ZeroClaw Gateway (Rust 二进制, daemon 后台常驻)
  ↳ providers.models.deepseek.default → DeepSeek API
  ↳ mcp.servers.finestem (stdio 子进程)
      ↳ apps/backend/app/mcp_server/server.py
      ↳ TOOL_REGISTRY['*'] (11 个 PBL 工具)
```

`apps/backend/app/services/providers/zeroclaw_provider.py` 已退役（保留为冷备份）；
所有 AI 调用、工具循环、Function Call、Memory、Tool Receipts、配对鉴权
全部由 **真实 ZeroClaw v0.8.3**（Rust 单二进制）承担。

### 15.2 部署清单（H 盘 / Windows）

| 资产 | 路径 | 说明 |
|------|------|------|
| ZeroClaw 二进制 | `H:\dev-env\zeroclaw\bin\zeroclaw.exe` | v0.8.3 预编译 Windows x64 |
| 配置目录 | `H:\dev-env\zeroclaw\config\` | 通过 `ZEROCLAW_CONFIG_DIR` 指定 |
| 数据目录 | `H:\dev-env\zeroclaw\data\` | 通过 `ZEROCLAW_DATA_DIR` 指定 |
| 主配置 | `H:\dev-env\zeroclaw\config\config.toml` | DeepSeek + 配对鉴权 + MCP finestem 注册 |
| 自启动脚本 | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\zeroclaw-daemon.vbs` | 登录后静默启动 daemon |
| 启动包装 | `H:\dev-env\zeroclaw\zeroclaw-daemon.cmd` | 含环境变量注入 |
| MCP server | `apps/backend/app/mcp_server/server.py` | 11 个 PBL 工具 stdio JSON-RPC | 
| 前端 Bearer Token | `apps/frontend/.env.development` 的 `VITE_ZC_TOKEN` | 由 `POST /pair` 派发后写入 |

### 15.3 关键配置片段

```toml
# Provider —— DeepSeek 作主，后续可加 GLM 作 fallback
[providers.models.deepseek.default]
model = "deepseek-chat"
api_key = "sk-xxx"

# Agent
[agents.assistant]
model_provider = "deepseek.default"
risk_profile = "standard"
runtime_profile = "default"
mcp_bundles = ["pbl"]
system_prompt = "..."

# MCP server 注册（stdio）
[mcp]
enabled = true

[[mcp.servers]]
name = "finestem"
transport = "stdio"
command = "H:\\dev-env\\dependencies\\fineSTEM-backend\\.venv\\Scripts\\pythonw.exe"
args = ["G:\\mediaProjects\\fineSTEM\\apps\\backend\\app\\mcp_server\\server.py"]

[mcp.servers.finestem.env]
PYTHONPATH = "G:\\mediaProjects\\fineSTEM\\apps\\backend"
FINESTEM_BACKEND_DIR = "G:\\mediaProjects\\fineSTEM\\apps\\backend"

# Bundle 通过 alias 引到 agent
[mcp_bundles.pbl]
servers = ["finestem"]

# agentic 模式 + 工具循环上限
[runtime_profiles.default]
agentic = true
max_tool_iterations = 20
parallel_tools = true

# 必须显式声明 tool_filter_groups 让 finestem__* 工具进入 LLM 上下文
[[runtime_profiles.default.tool_filter_groups]]
mode = "always"
tools = ["finestem__*"]
keywords = []

# 自动放行 PBL 工具调用，避免每次都被 approval_gate 拦截
[risk_profiles.standard]
autonomy = "supervised"
auto_approve = ["finestem__*"]

# 鉴权
[gateway]
bind_addr = "127.0.0.1:42617"
require_pairing = true
```

### 15.4 WebSocket 协议（前端 → ZeroClaw）

- 握手：`ws://127.0.0.1:42617/ws/chat?token=<bearer>&agent=assistant&session_id=<id>`
- 服务器先发 `{"type":"session_start","session_id":"...","resumed":false,"message_count":0}`
- 客户端回 `{"type":"connect","session_id":"<id>","device_name":"finestem-web","capabilities":["tool_calls","streaming"]}`
- 服务器回 `{"type":"connected","message":"Connection established"}`
- 用户消息：`{"type":"message","content":"<text>"}`
- 流式帧：`chunk` / `thinking` / `tool_call` / `tool_result` / `plan` / `history_trimmed` / `approval_request` / `aborted` / `done` / `error`
- `done` 帧：`{"type":"done","full_response":"...","tokens_used":N,"cost_usd":E,"model":"deepseek-chat","provider":"deepseek"}`

### 15.5 PBL 业务事件来源

由于 ZeroClaw 是 trait 驱动的 AI 基础设施，不清楚"研学阶段""成果档案卡"等业务语义，
事件分发由 MCP Tool 回包承担：

| 前端事件 | 来源 |
|------|------|
| `skill_activated` | 暂不触发（system prompt 中已携带场景） |
| `project_created` | MCP 工具 `finestem__project_creator` 返回成功 |
| `stage_changed` | MCP 工具 `finestem__stage_advancer` / `project_creator` 返回 |
| `code_generated` | MCP 工具 `finestem__project_code_writer` 返回，或 LLM 文本代码块兜底解析 |
| `question` | LLM 文本里的 `<question>...</question>` XML 块（前端解析，搬自 Python 实现） |
| `tool_call` | ZeroClaw 直接转发的 `tool_call` / `tool_result` 帧 |

### 15.6 ZeroClaw 核心能力与 fineSTEM 对应关系（最新）

| ZeroClaw 能力 | fineSTEM 对应 | 当前状态 |
|--------------|-------------|---------|
| Provider 抽象 + Fallback | DeepSeek 主，可后续加 GLM fallback | ✅ 已实现（真实 ZC） |
| Agent Loop | ZeroClaw agentic=true + max_tool_iterations=20 | ✅ 已实现 |
| Tools（工具调用） | finestem MCP server 11 个 PBL 工具 | ✅ 已实现 |
| Memory（对话记忆） | sqlite memory backend | ✅ 已实现 |
| Gateway（HTTP/WS/SSE） | 127.0.0.1:42617 `POST /webhook` + `/ws/chat` | ✅ 已实现 |
| MCP（外部工具协议） | finestem stdio server | ✅ 已实现 |
| Channel（消息通道） | CLI（默认开启），其余未启用 | 部分实现 |
| SOP（标准操作流程） | 由 finestem__stage_advancer 驱动 | ✅ 已实现 |
| Security（策略） | require_pairing=true + Bearer 派发 | ✅ 已实现 |
| Tool Receipts（审计） | ZeroClaw 内置 trace 日志 | ✅ 已实现 |

## 16. 变更记录

- `2026-07-19`：撤回 FastAPI 模拟 ZeroClaw 路线，部署真实 ZeroClaw v0.8.3 到 `H:\dev-env\zeroclaw`；
  11 个 PBL 工具改为 MCP stdio server 暴露；`useStreamingChat.ts` 直连 ZeroClaw 网关版本 1.2.0
- `2026-04-27`: 新增 §15 fineSTEM 集成实践，更新版本至 1.1.0
- `2026-04-25 07:41:04.266` (UTC): 创建独立版 ZeroClaw 技术知识库文档
