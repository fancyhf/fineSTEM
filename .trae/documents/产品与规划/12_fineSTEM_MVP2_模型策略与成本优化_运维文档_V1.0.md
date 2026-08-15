# fineSTEM MVP2 模型策略与成本优化 运维文档 V1.0

> 日期：2026-08-13 ｜ 维护：AI Agent ｜ 关联：问题清单 Q-039、测试计划 11_
> 目的：记录 LLM 模型从 deepseek-v4-pro 切换为 qwen-plus（+ admin 可选 deepseek-v4-flash）的全部配置、成本机制与运维操作，供后续查阅与变更。

---

## 1. 背景与决策

DeepSeek 实行峰谷定价后（2026-08-17 生效），`deepseek-v4-pro` 高峰输出 **27元/百万token**，日均花费 10+ 元。评估后决定：

- **默认全程 `qwen-plus`**（阿里云百炼，输出 2元/M，编程/工具调用能力第一梯队，已验证胜任 PBL 9 阶段引导 + 16 个 MCP 工具）
- **admin 可在「精选管理」开启 `offpeak_deepseek` 开关**：开启后**非高峰时段**(北京时间 9-12、14-18 之外)切 `deepseek-v4-flash`；高峰仍 qwen（DS 高峰太贵）
- 开关默认**关**（即默认全程 qwen，最省最稳）

> 经济性提醒：非高峰 `deepseek-v4-flash`（输出 4.5元/M）仍比 `qwen-plus`（2元/M）贵 2.25 倍。开关仅作"用 DS 余额/偏好"的可选项，纯粹省钱不需要开。

---

## 2. 架构（关键事实，运维必读）

主链路：**前端 `useStreamingChat.ts` → WebSocket → ZeroClaw daemon(127.0.0.1:42617) → LLM**

- 模型**完全由 ZeroClaw `config.toml`** 的 `[agents.<别名>].model_provider` 决定
- 前端只能通过 WS URL `?agent=<别名>` 选 agent，**无法按请求指定 model**
- 后端 `.env` 的 `ZEROCLAW_DEFAULT_MODEL` 与废弃 `orchestrator.py` **不在主链路上**（不要在那里改模型）
- daemon **热重载** config.toml（改完无需重启，`zeroclaw status` 即可确认）

### 双 agent / 双 provider

| agent 别名 | model_provider | 模型 | 用途 |
|---|---|---|---|
| `assistant` | deepseek.default | deepseek-v4-flash | 非高峰（开关开启时） |
| `assistant_qwen` | qwen.default | qwen-plus | **主力**（默认/高峰） |

两个 agent 共享同一份 PBL system_prompt（~12KB）、mcp_bundles=`["pbl"]`、risk/runtime profile，仅 model_provider 不同。

---

## 3. ZeroClaw 配置（H:\dev-env\zeroclaw\config\config.toml）

### 3.1 providers 段
```toml
[providers.models.deepseek.default]
model = "deepseek-v4-flash"
api_key = "enc2:..."          # 加密存储
max_tokens = 65536            # 代码作为工具参数输出，需大（Q-023 经验，勿降）
pricing = { "deepseek-v4-flash.input" = 0.21, "deepseek-v4-flash.output" = 0.63 }

[providers.models.qwen.default]
endpoint = "cn"               # 国内 DashScope（必须 cn，默认 intl 会认证失败）
model = "qwen-plus"
api_key = "enc2:..."
max_tokens = 8192             # 若长代码被截断可调高
pricing = { "qwen-plus.input" = 0.11, "qwen-plus.output" = 0.28 }
```
> pricing 单位：USD/1M tokens（1USD≈7.2RMB）。deepseek 用空闲价（仅非高峰用）。cost 是**上界估计**（未计缓存折扣，实际更低）。

### 3.2 agents 段
- `[agents.assistant]`（现有，底层模型已从 v4-pro 改为 flash）
- `[agents.assistant_qwen]`（新增，复制自 assistant，仅 `model_provider = "qwen.default"`）

---

## 4. 后端 feature-flag 开关（fineSTEM 项目内）

- `config.py`：`FF_OFFPEAK_DEEPSEEK_ENABLED: bool = False`（默认关）
- `feature_flags.py`：注册 `offpeak_deepseek` + `set_flag()`/`_save_to_file()`（写回 `runtime/feature_flags.json`）
- API：
  - `GET /api/v1/agent/feature-flags`（任意登录用户读）
  - `PATCH /api/v1/agent/feature-flags/{name}` body `{"enabled":bool}`（**require_admin**，403/404 已处理）

---

## 5. 前端

### 5.1 模型路由（`useStreamingChat.ts`）
- `getZcAgentAlias()`：`VITE_ZC_AGENT` 覆盖优先 → 开关开且非高峰返 `assistant` → 否则 `assistant_qwen`
- `_isDeepSeekPeakHour()`：北京时间 h∈[9,12)∪[14,18)（时区 `Asia/Shanghai`）
- `refreshModelStrategyFlag()`：hook 挂载时从后端拉开关，存 localStorage（`finestem_offpeak_deepseek`）兜底

### 5.2 admin UI（`AdminFeatured.tsx` `/admin/featured`）
- 顶部「AI 模型策略」开关：读 `offpeak_deepseek`，切换调 PATCH，toast 提示
- admin 改开关后，其他用户**刷新页面**生效（localStorage 兜底 + 重新 fetch）

---

## 6. prompt caching（自动生效，无需配置）

- DashScope qwen-plus **自动缓存共享前缀**：实测连发相同请求，第2次 `cached_tokens` 命中 92%（1152/1257）
- 主链路的 `system_prompt`（config.toml 固定 12KB ≈ 20K token）是天然缓存对象，连续对话命中 → system 部分按更低价计费
- **之前测出 `cached_tokens:0` 是单次首次请求的假象**（首次必 miss，需连续相同请求才命中）
- 无法从 ZeroClaw agent trace 直接观测 `cached_tokens`（字段未记录）；看真实命中去**阿里云百炼控制台用量统计**

---

## 7. 成本预期

| 场景 | 输出价（元/M） | vs 原 v4-pro 高峰 |
|---|---|---|
| 默认全程 qwen-plus | 2 | 降 ~93%（原 27） |
| 开关切非高峰 deepseek-flash | 4.5（空闲） | 仍远低于原 v4-pro |
| 叠加 system_prompt 缓存命中 | 实际更低 | 缓存部分按更低计费 |

按原日均估算：从 10+元/天 → 1元以内/天。

---

## 8. 常见运维操作

### 改主力模型（如 qwen-plus → qwen-max）
```bash
zeroclaw config set providers.models.qwen.default.model qwen-max --no-interactive
# daemon 自动热重载；改 pricing 同理需手动编辑 config.toml 的 pricing inline table
```

### 换 DeepSeek key
```bash
# 从 .env 读新 key（避免命令行硬编码）
KEY=$(grep '^deepseek_key=' /g/mediaProjects/fineSTEM/.env | cut -d= -f2-)
zeroclaw config set providers.models.deepseek.default.api_key "$KEY" --no-interactive
# 验证：zeroclaw agent -a assistant -m "你好" -v
```
> key 加密存 config.toml（enc2）。根 `.env` 与 `apps/backend/.env` 的 `deepseek_key` 应保持同步（后者主链路不用，但 config.py model_post_init 会读）。

### 查当前配置/成本
```bash
zeroclaw status                    # 看 provider/agent/cost 面板
zeroclaw agents list               # 确认 assistant + assistant_qwen
zeroclaw config list --filter providers.models.qwen
```

### 临时锁定某 agent（调试）
前端设 `VITE_ZC_AGENT=assistant_qwen`，绕过时段/开关逻辑。

### 回滚（恢复全程 deepseek-v4-pro）
```bash
cp H:/dev-env/zeroclaw/config/config.toml.bak.before-dualmodel H:/dev-env/zeroclaw/config/config.toml
# 前端 git checkout useStreamingChat.ts；后端删 offpeak_deepseek 相关
```

---

## 9. 不要动的"放大器"（高回归风险）

以下看似"浪费"的机制，实为问题清单（Q-001~Q-038）中多个 bug 的**修复代价**，动任何一个会导致对应问题回归：

| 机制 | 对应问题 |
|---|---|
| 超长 system_prompt(12KB) | Q-029（规则唯一载体）、Q-013/Q-026/Q-028 等 30+ |
| 场景指令每条注入 | Q-038③（daemon 单 system_prompt 限制） |
| 历史对话每条注入 | Q-025（session 记忆不可靠致失忆） |
| 工具上限 100 次 | Q-008（验收阶段 10+ 工具） |
| max_tokens 65536 | Q-023（代码作为工具参数截断） |
| 自动续接 3 次 | Q-023（大段代码多次续接） |

降本应优先：① 换便宜模型（已完成）② prompt caching（已自动生效）③ pricing 观测（已配）。**不要砍上述机制。**

---

## 10. 关联文件

- ZeroClaw 配置：`H:\dev-env\zeroclaw\config\config.toml`
- 测试计划：`.trae/documents/产品与规划/11_fineSTEM_MVP2_模型策略切换_测试计划_V1.0.md`
- 问题清单：`.trae/documents/问题清单_长期维护.md`（Q-039）
- 后端：`app/core/config.py`、`app/services/feature_flags.py`、`app/api/agent.py`
- 前端：`src/hooks/useStreamingChat.ts`、`src/pages/AdminFeatured.tsx`、`src/services/api.ts`
