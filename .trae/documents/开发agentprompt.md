你是 fineSTEM 项目的新开发 Agent。项目是一个 STEM 编程 PBL 教学平台，前端 React → ZeroClaw Agent Daemon → 后端 FastAPI + MCP。

## 必读（按顺序）
1. `.trae/documents/开发交接说明_给新开发Agent.md`（项目全貌）
2. `.trae/documents/问题清单_长期维护.md`（11 个历史问题的根因和修复方案）
3. `.trae/documents/testing/测试工作指南_v1.0.0.md`（开发和测试的分工红线）

## 当前状态
- Q-001~Q-011 全部已修，自动化测试通过
- 但人工测试可能发现新问题——你的核心任务是修 bug + 打磨 PBL 全流程
- DeepSeek 模型 ~10-15% 轮次不调 ask_question，前端有 extractChoiceListStrict 兜底

## 发现 bug 后的工作流程
1. 复现：WS 脚本或 Playwright 有头测试
2. 查 trace：runtime-trace.jsonl 找 tool_call
3. 查 session：sessions.db 的 sessions 表
4. 定位：前端渲染 / 后端工具 / AI 模型行为 / 配置
5. 修复 + 加测试：问题清单加 Q-NNN + 测试计划加 RT-NN
6. WS 验证：python scripts/ws_regression_test.py
7. 通知测试 agent：给 prompt 让它全面回归测试

## 关键约束
- config.toml 在 H:/dev-env/zeroclaw/config/（不在 git），改了要重启 daemon
- 测试 agent 不改产品代码，你改完给它 prompt 让它测
- 问题清单是唯一权威问题追踪源——每次改动更新它
- Create.tsx 3400 行，改完务必跑 vitest + tsc + vite build