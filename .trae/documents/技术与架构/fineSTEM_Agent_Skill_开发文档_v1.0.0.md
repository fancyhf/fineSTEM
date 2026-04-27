# fineSTEM Agent + Skill 开发文档 v1.0.0

- created_at: 2026-04-25 00:00:00.000
- owner: AI Agent
- scope: AI 助手能力平台化（OpenClaw/ZeroClaw 能力对齐）

## 1. 目标
- 将原有单轮聊天接口升级为 Agent 编排架构。
- 支持 Skill 市场、Skill 安装、Skill 启停、Skill 调用链可观测。
- 通过 ZeroClaw Gateway 提供模型能力增强，并保留降级路径。

## 2. 架构概览
- 前端：`Connect` 页面管理 Skill，`AIChatPanel` 通过 `agentApi` 调用编排接口。
- 后端：
- `skills` API：市场、安装、启停、卸载。
- `agent` API：同步对话、SSE、WebSocket。
- `orchestrator`：识别问题意图，决定调用哪些 Skill，再调用 ZeroClaw Provider 生成最终回复。
- `skill_runtime`：执行内置 Skill 并返回结构化结果。
- `skill_registry`：维护可安装 Skill 清单与 Manifest。

## 3. 新增与改造文件
- 后端新增：
- `apps/backend/app/schemas/skills.py`
- `apps/backend/app/schemas/agent.py`
- `apps/backend/app/services/skill_registry.py`
- `apps/backend/app/services/skill_runtime.py`
- `apps/backend/app/services/orchestrator.py`
- `apps/backend/app/services/providers/zeroclaw_provider.py`
- `apps/backend/app/api/skills.py`
- `apps/backend/app/api/agent.py`
- 后端修改：
- `apps/backend/app/api/chat.py`
- `apps/backend/app/core/config.py`
- `apps/backend/app/db/memory.py`
- `apps/backend/main.py`
- 前端修改：
- `apps/frontend/src/types/index.ts`
- `apps/frontend/src/services/api.ts`
- `apps/frontend/src/components/Shared/AIChatPanel.tsx`
- `apps/frontend/src/pages/Connect.tsx`

## 4. API 设计
- `GET /api/v1/skills/marketplace`：获取市场 Skill Manifest。
- `GET /api/v1/skills`：获取当前用户已安装 Skill。
- `POST /api/v1/skills/install`：安装 Skill。
- `POST /api/v1/skills/{skill_id}/toggle`：启停 Skill。
- `DELETE /api/v1/skills/{skill_id}`：卸载 Skill。
- `POST /api/v1/agent/chat`：统一同步对话接口。
- `GET /api/v1/agent/stream`：SSE 事件流接口。
- `WS /api/v1/agent/ws`：实时双向接口。
- `POST /api/v1/chat/completions`：兼容旧入口，内部转发到 Orchestrator。

## 5. Skill Manifest 规范（当前实现）
- 核心字段：
- `skill_id`, `name`, `version`, `description`, `entrypoint`
- `permissions`, `timeout_ms`, `tags`, `provider_tags`, `requires_approval`
- 安装记录字段：
- `status`, `config`, `install_date`, `last_used_at`

## 6. 编排逻辑
- 步骤 1：读取用户消息，按关键字匹配已启用 Skill。
- 步骤 2：并行执行匹配 Skill，收集 `summary/payload/latency`。
- 步骤 3：将 Skill 结果注入模型上下文，调用 ZeroClaw Provider。
- 步骤 4：返回统一响应结构 `trace_id/session_id/used_tools`。
- 步骤 5：若存在 `project_id`，自动写入一条 evidence 作为对话证据。

## 7. 安全与治理
- 仅已登录用户允许安装、启停和调用私有 Skill。
- Skill 调用仅允许已安装且启用的记录进入运行时。
- Provider 网关不可用时走本地降级回复，避免链路完全中断。

## 8. 兼容与迁移
- 前端新页面通过 `agentApi` 调用新接口。
- 旧页面继续使用 `/chat/completions` 不中断，已内部迁移至 Orchestrator。

## 9. 待继续增强项
- 本轮已落地增强：
- Skill 策略沙箱：超时上限、网络型 Skill 开关、启用态强校验。
- 真沙箱执行器：Skill 改为子进程 `python -I` 执行，隔离主进程上下文。
- Provider 多路回退：主网关 + 备用网关 + 本地安全模型降级标识。
- 流式事件增强：SSE/WS 输出 token 事件与 final 事件。
- 观测增强：新增 `/api/v1/agent/metrics` 输出成功率、P95、P99。
- 指标持久化：指标落盘到 `AGENT_METRICS_STORAGE_PATH`，重启后自动恢复。
- 灰度开关：支持功能开关与按用户百分比放量（feature flags）。

## 10. 生产级硬化配置
- `AGENT_METRICS_STORAGE_PATH`：指标持久化文件路径。
- `AGENT_FEATURE_FLAGS_PATH`：灰度开关文件路径（JSON）。
- `FF_AGENT_STREAM_ENABLED/FF_AGENT_STREAM_ROLLOUT_PERCENT`
- `FF_AGENT_WS_ENABLED/FF_AGENT_WS_ROLLOUT_PERCENT`
- `FF_SKILL_SANDBOX_ENABLED/FF_SKILL_SANDBOX_ROLLOUT_PERCENT`
- `FF_PROVIDER_FALLBACK_ENABLED/FF_PROVIDER_FALLBACK_ROLLOUT_PERCENT`
- `FF_METRICS_PERSISTENCE_ENABLED`
