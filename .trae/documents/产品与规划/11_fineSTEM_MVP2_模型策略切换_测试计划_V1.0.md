# fineSTEM MVP2 模型策略切换 测试计划 V1.0

> 日期：2026-08-13 ｜ 维护：AI Agent ｜ 关联改动：ZeroClaw 双 provider/agent + 后端 feature-flag 写接口 + 前端路由

## 1. 背景与目标

将主链路 LLM 从 `deepseek-v4-pro`（高峰输出 27元/M，过贵）切换为：
- **默认全程 `qwen-plus`**（输出 2元/M，主力 agent = `assistant_qwen`）
- **admin 可在「精选管理」开启 `offpeak_deepseek` 开关**：开启后**非高峰时段**(北京时间 9-12、14-18 之外)自动切 `deepseek-v4-flash`（agent = `assistant`）；高峰仍用 qwen

本测试验证该功能在 ZeroClaw 配置层、后端 API、前端路由、LLM 端到端连通四个层面均正确。

## 2. 测试分层

| 层级 | 范围 | 依赖服务 |
|---|---|---|
| L1 | ZeroClaw 配置层（provider / agent 定义） | ZeroClaw daemon（已在线 42617） |
| L2 | 后端 feature-flag API（读/写/鉴权/持久化） | 后端（需启动 3200） |
| L3 | 前端模型路由逻辑（getZcAgentAlias） | 代码审查（离线） |
| L4 | LLM 端到端连通（qwen-plus / deepseek-flash） | ZeroClaw CLI |

## 3. 环境与路径

```
ZeroClaw CLI : H:\dev-env\zeroclaw\bin\zeroclaw.exe
ZeroClaw cfg  : H:\dev-env\zeroclaw\config\config.toml
后端根目录    : G:\mediaProjects\fineSTEM\apps\backend
后端 venv     : H:\dev-env\dependencies\fineSTEM-backend\.venv\Scripts\python.exe
数据库        : D:\data\finestem\finestem.db  (sqlite)
daemon 端口   : 127.0.0.1:42617（已在线）
后端端口      : 3200（需启动）
```

## 4. 测试用例

### L1 — ZeroClaw 配置层（只读，不启动后端）

| ID | 步骤（命令） | 预期 |
|---|---|---|
| L1.1 | `zeroclaw agents list` | 输出含 `assistant` 与 `assistant_qwen` 两行 |
| L1.2 | `zeroclaw config list --filter providers.models.qwen` | `endpoint=cn`、`model=qwen-plus`、`max_tokens=8192`、`api_key=****`(🔒非空) |
| L1.3 | `zeroclaw config list --filter providers.models.deepseek` | `model=deepseek-v4-flash` |
| L1.4 | `zeroclaw config list --filter agents.assistant_qwen` | `model_provider=qwen.default`、`mcp_bundles=["pbl"]`、`risk_profile=standard`、`runtime_profile=default` |
| L1.5 | `zeroclaw status` | 同时列出 `qwen.default/qwen-plus` 与 `deepseek.default/deepseek-v4-flash`；Agents 含 `assistant_qwen=Supervised` |

### L2 — 后端 feature-flag API（需启动后端）

前置：在 `apps/backend` 目录用 venv 启动 `uvicorn main:app --port 3200`（后台）。再用 sqlite 查 `users` 表找 `role='admin'` 用户，登录拿 token。

| ID | 步骤 | 预期 |
|---|---|---|
| L2.1 | `GET /api/v1/agent/feature-flags`（任意登录 token） | 200；`data` 含 `offpeak_deepseek`，默认 `enabled=false, rollout_percent=100` |
| L2.2 | `PATCH /api/v1/agent/feature-flags/offpeak_deepseek` body `{"enabled":true}`（admin token） | 200；`data.offpeak_deepseek.enabled=true`；message 含"已开启" |
| L2.3 | 再次 `GET /agent/feature-flags`；查 `apps/backend/runtime/feature_flags.json` | enabled 持久化为 true（文件含 `"offpeak_deepseek":{"enabled":true,...}`） |
| L2.4 | `PATCH /agent/feature-flags/offpeak_deepseek`（**非 admin** token） | 403 |
| L2.5 | `PATCH /agent/feature-flags/nonexist_flag` body `{"enabled":true}`（admin token） | 404，detail 含"未知的开关" |
| L2.6 | `PATCH` 恢复 `offpeak_deepseek` `{"enabled":false}`（admin token） | 200；恢复默认 |

### L3 — 前端模型路由逻辑（代码审查）

读 `apps/frontend/src/hooks/useStreamingChat.ts` 中 `getZcAgentAlias` / `_isDeepSeekPeakHour` / `_offpeakDsEnabled`：

| ID | 条件 | 预期返回 |
|---|---|---|
| L3.1 | `VITE_ZC_AGENT` 已设置 | 返回该值（手动覆盖优先） |
| L3.2 | 开关关（`_offpeakDsEnabled=false`） | `assistant_qwen` |
| L3.3 | 开关开 + 非高峰（如 22 点） | `assistant`（deepseek-flash） |
| L3.4 | 开关开 + 高峰（如 10 点） | `assistant_qwen`（qwen-plus） |
| L3.5 | `_isDeepSeekPeakHour`：h∈[9,12) 或 [14,18) 为 true，其余 false | 逻辑正确，时区 `Asia/Shanghai` |

### L4 — LLM 端到端连通（zeroclaw CLI，真实调用）

| ID | 步骤（命令） | 预期（看 -v 日志的 zc_attrs） |
|---|---|---|
| L4.1 | `zeroclaw agent -a assistant_qwen -m "你好，一句话介绍你能做什么，不要调任何工具" -v` | `model:"qwen-plus"`、`model_provider:"qwen.default"`、`zc_outcome:success`、有中文回复、`MCP server finestem connected — 16 tool(s)` |
| L4.2 | `zeroclaw agent -a assistant -m "你好，一句话介绍你能做什么，不要调任何工具" -v` | `model:"deepseek-v4-flash"`、`zc_outcome:success`、有中文回复 |

## 5. 注意事项

- L1/L4 **只读** ZeroClaw，禁止修改 `config.toml`。
- L2 测完务必执行 L2.6 恢复开关为 false，并关闭后端进程。
- L4 每条会真实消耗少量 token（admin 已知成本极低）。
- 报告格式：每个用例给 ✅Pass / ❌Fail + 关键证据（命令输出摘要）。

## 6. 测试 Prompt（供测试 agent 使用）

见独立执行入口；测试 agent 按本文件 L1→L2→L3→L4 顺序执行并汇总。
