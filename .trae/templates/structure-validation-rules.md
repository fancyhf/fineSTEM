# 目录结构校验规则说明（技术中立）

检查项：
- 顶层必须存在：src/apps/prototype/pbl/media/config/scripts/tests/logs/.trae
- `.trae/documents` 下必须存在：overview/process/governance/glossary/api-specs/agents/mcp/media/pbl/adr/audit/checklists/reports
- 每个目录需具备 README 与统一元信息头；占位文档允许，但状态为 `draft`。

手动检查步骤：
1. 遍历目录树，记录缺失项与不合规命名。
2. 抽查 README 元信息头完整性与状态字段。
3. 交叉比对 glossary ↔ src/domain 与 api-specs ↔ src/interfaces。
4. 将结论输出至 `.trae/documents/audit/` 与 `.trae/documents/reports/`。

