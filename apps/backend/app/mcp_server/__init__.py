"""
fineSTEM MCP Server package.

将项目原有的 PBL 工具（`app.services.tools.TOOL_REGISTRY`）通过 MCP 1.0 stdio
协议暴露给 ZeroClaw Agent Loop，由 ZeroClaw daemon spawn 本进程作为外部 MCP server。

- 部署：详见 `docs/技术与架构/ZeroClaw_技术知识库_v1.0.0.md` 与
  `H:\\dev-env\\zeroclaw\\config\\config.toml` 的 `[mcp.servers.finestem]` 段。
- 启动方式：`python -m app.mcp_server.server`（由 ZeroClaw daemon spawn，不直接运行）。
- 工具列表：复用 `app.services.tools.TOOL_REGISTRY` 的 11 个工具注册项
  （project_creator / stage_advancer / artifact_writer / code_runner / ...）。
"""

__all__ = ["server"]