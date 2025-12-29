# 合规检查手册（技术中立）

目标：人工执行目录/命名/文档/流程/环境策略检查并生成审计结论。

步骤：
1. 目录存在性与命名规则检查（参考 `.trae/templates/structure-validation-rules.md`）。
2. 文档元信息头完整性检查（version/created_at/maintainer/status/change_log）。
3. 数据字典与接口占位一致性检查（`.trae/documents/glossary` ↔ `src/domain`；`.trae/documents/api-specs` ↔ `src/interfaces`）。
4. MCP/Agent 协作与门禁记录检查（`.trae/documents/agents`、`mcp`、`checklists`）。
5. 媒体工程模板与质检说明齐备性检查（`media/templates`、`quality`）。
6. 生成审计草案至 `.trae/documents/audit/` 与报告至 `.trae/documents/reports/`。

