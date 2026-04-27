# fineSTEM Agent + Skill 开发计划 v1.0.0

- created_at: 2026-04-25 00:00:00.000
- owner: AI Agent
- strategy: 一次性全面落地（单主线执行，不拆阶段发布）

## 1. 目标定义
- 完成 AI 助手平台化升级，具备 OpenClaw 类核心能力：
- 可安装 Skill、可启停 Skill、对话自动调 Skill、统一编排与可观测。
- 集成 ZeroClaw 作为能力增强层，并保留兼容接口。

## 2. 一次性执行清单
- 后端：
- 新增 Skill 注册表、运行时、编排器、ZeroClaw Provider 适配层。
- 新增 Skills 管理 API 与 Agent 同步/流式/WS API。
- 改造旧 `/chat/completions` 兼容入口，内部转发 Agent 编排。
- 扩展内存数据库以支持 Skill 安装记录。
- 前端：
- 扩展类型定义与 API SDK。
- 改造 AI 对话面板，接入 Agent 编排结果与 Skill 调用回显。
- 改造 Connect 页面，接入 Skill 市场与安装启停操作。
- 文档：
- 输出开发文档、开发计划与最终交付说明。

## 3. 功能验收标准
- 用户可在 Connect 页面查看 Skill 市场并执行安装。
- 用户可启停已安装 Skill，状态实时反映在列表。
- AI 对话接口可返回 `used_tools` 调用痕迹。
- `/agent/chat`、`/agent/stream`、`/agent/ws` 可被调用。
- 旧 `/chat/completions` 保持可用。

## 4. 风险与对策
- 风险：ZeroClaw 网关不可达导致回答失败。
- 对策：编排层内置降级文案，优先返回 Skill 分析结果。
- 风险：前后端协议偏差导致页面报错。
- 对策：统一 `AgentChatRequest/AgentChatResponse` 类型。
- 风险：Skill 执行越权。
- 对策：仅启用已安装 Skill，后续补充沙箱隔离。

## 5. 审计记录要求
- 变更原因：实现 AI 助手平台化能力升级。
- 影响范围：后端 AI 能力链路、前端 Connect 和 AI 对话组件。
- 负责人：AI Agent
- 截止日期：2026-04-25 23:59:59.000
