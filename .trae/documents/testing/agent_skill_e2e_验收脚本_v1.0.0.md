# Agent + Skill E2E 验收脚本 v1.0.0

- created_at: 2026-04-25 00:00:00.000
- owner: AI Agent

## 1. 前置条件
- 后端已启动，`/api/v1` 可访问。
- 前端已启动并可登录。
- 环境变量可选配置：
- `ZEROCLAW_GATEWAY_URL`
- `ZEROCLAW_FALLBACK_GATEWAY_URL`

## 2. Skill 管理验收
- 登录后进入 Connect 页面。
- 验证可看到 Skill 市场列表。
- 安装任意 Skill，确认状态变为 `enabled`。
- 切换停用/启用，确认状态切换成功。

## 3. Agent 对话验收
- 调用 `POST /api/v1/agent/chat`，输入项目相关问题。
- 验证返回包含：
- `trace_id`
- `used_tools[]`
- `model`
- 若 `project_id` 有值，验证项目 evidence 数量增加。

## 4. 流式验收
- 调用 `GET /api/v1/agent/stream?message=xxx`。
- 验证依次收到：
- `tool_trace` 事件
- 多个 `token` 事件
- `final` 事件
- 使用 WebSocket `/api/v1/agent/ws` 验证 `token/final` 事件。

## 5. 回退与稳定性验收
- 主网关断开，仅保留备用网关，确认仍可返回内容。
- 主备网关都断开，确认返回本地降级文案且接口不 500。

## 6. 观测验收
- 连续调用对话接口 10 次。
- 调用 `GET /api/v1/agent/metrics`。
- 验证 `total_requests/success_rate/p95_ms/p99_ms` 有合理数值。

## 7. 持久化与灰度验收
- 指标持久化：
- 触发若干次对话后重启后端服务。
- 再次调用 `GET /api/v1/agent/metrics`，验证累计值未清零。
- 灰度开关：
- 在 `AGENT_FEATURE_FLAGS_PATH` 指向的 JSON 中将 `agent_stream.enabled=false`。
- 调用 `/api/v1/agent/stream`，验证返回 403。
- 将 `agent_stream.rollout_percent` 设置为较小比例并使用不同用户 ID 验证放量效果。

## 8. 数据持久化与文件存储链路验收
- 运行命令：`python scripts/verify_persistence_and_storage.py`
- 验证输出包含：`status=ok`
- 验证 `tables_checked` 至少包含：
- `users`
- `demos`
- `projects`
- `skill_states`
- `achievement_cards`
- `evidence`
- 验证 `file_flow` 包含：
- `project_id`
- `file_id`
- `uploaded_size > 0`
