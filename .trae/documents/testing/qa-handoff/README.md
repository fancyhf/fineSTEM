# qa-handoff/ — 第三方 QA 交接文件

- version: v1.0.1
- created_at: 2026-06-30 14:30:00.000
- updated_at: 2026-07-23 12:00:00.000
- maintainer: AI Agent（开发 Agent）
- change_log:
  - 2026-06-30 14:30:00.000 初始创建。
  - 2026-07-23 12:00:00.000 更新：QA 报告产物路径调整为 `../reports/` 与 `../log/`。

## 用途

本目录**只**存放需要交给第三方 QA 工具/AI 测试平台的交接 Prompt 文件。

## 触发规则

只有同时满足以下条件，开发 Agent 才在本目录生成新文件：

1. 完成了**大型修改**（跨 ≥2 个文件 / 改动核心路径 / 改动协议）
2. 即将让用户**手动测试**

不进本目录的情况：
- 小改 / 局部修复 / 文档调整
- 开发 Agent 只在内部跑了单测就闭环的修复
- 用户主动触发的轻量验证
- 测试 Agent 内部操作指令（见 `../prompts/`）

## 命名规则

`qa-handoff_<YYYY-MM-DD>_<scope-slug>.md`

例：`qa-handoff_2026-06-30_multi-question-cards.md`

## 配套文档

- 通用模板：[.trae/templates/qa-agent-prompt.md](../../../templates/qa-agent-prompt.md)
- QA 报告产物（Markdown）：`../reports/round{N}_report.md`
- QA 摘要产物（JSON）：`../logs/2026-06-30/round{N}_summary.json`

## 工作流

```
开发 Agent 大改 ─→ 生成本目录 handoff ─→ 用户喂第三方 QA
                                              │
                                              ▼
              .trae/documents/testing/logs/2026-06-30/round{N}_summary.json
                                              │
                                              ▼
                  开发 Agent check + 修复 ─→ R{N+1} handoff ─→ 全绿后人工复测
```
