# 前端 E2E 测试 — 测试 Agent 导航

> **目标读者**：测试 Agent、开发 Agent。
> **框架**：Playwright（E2E）+ Vitest（单元）
> **配置**：`playwright.config.ts`（testDir: `./specs`，baseURL: `http://localhost:5184`）

---

## 测试定位速查表

| 你要测什么 | 去这个文件 | 说明 |
|------------|-----------|------|
| **冒烟测试** | `specs/smoke-test.spec.ts` | 基本页面加载/导航 |
| **导航与权限守卫** | `specs/navigation-and-guards.spec.ts` | 路由守卫/重定向 |
| **完整用户旅程** | `specs/full-user-journey.spec.ts` | 端到端全流程 |
| **项目生命周期** | `specs/lifecycle-journey.spec.ts` | 项目创建到完成 |
| **Create 页 PBL 主链路** | `specs/create-guided-pbl-mainline.spec.ts` | ★ 引导式 PBL 主线 |
| **Create 页开发预览** | `specs/create-development-preview.spec.ts` | 开发模式预览 |
| **Create 页历史恢复** | `specs/create-history-restore.spec.ts` | 历史对话恢复 |
| **Create 页多文件恢复** | `specs/create-multifile-restore.spec.ts` | 多文件代码恢复 |
| **Create 页 PBL 流程** | `specs/create-pbl-flow.spec.ts` | PBL 流程 |
| **Create 页 PBL 完整闭环** | `specs/create-pbl-full-loop.spec.ts` | PBL 全闭环 |
| **Create 页问题选项恢复** | `specs/create-question-options-restore.spec.ts` | 选项卡恢复 |
| **Create 页教学模式** | `specs/create-teaching-mode.spec.ts` | 教学模式选择 |
| **PBL 对话流** | `specs/pbl-conversation-flow.spec.ts` | PBL 对话 |
| **PBL 全自动** | `specs/pbl-full-auto.spec.ts` | @ai 全自动 PBL |
| **PBL 阶段推进** | `specs/pbl-stage-progression.spec.ts` | 阶段门禁推进 |
| **PBL 问题卡片** | `specs/pbl-question-card-full-test.spec.ts` | 问题卡片完整测试 |
| **AI 自动续接** | `specs/ai-auto-continue.spec.ts` | @ai 截断续接 |
| **流式截断** | `specs/stream-truncation.spec.ts` | 流式输出截断 |
| **ZeroClaw 集成** | `specs/zeroclaw-integration.spec.ts` | @ai ZeroClaw 集成 |
| **多文件 E2E** | `specs/multifile-e2e.spec.ts` | 多文件代码 |
| **MVP Bug E2E** | `specs/mvp-bug-e2e.spec.ts` | MVP 阶段 bug 回归 |
| **项目详情-成果卡草稿** | `specs/project-detail-achievement-draft.spec.ts` | 成果卡草稿 |
| **项目详情-最终报告** | `specs/project-detail-final-report.spec.ts` | 最终报告 |
| **项目详情-生成成果卡** | `specs/project-detail-generate-achievement.spec.ts` | 成果卡生成 |
| **项目详情-Stage08 水合** | `specs/project-detail-stage08-hydration.spec.ts` | Stage08 数据水合 |
| **问题解析 bug** | `specs/question-parsing-bugs.spec.ts` | 问题解析回归 |
| **Q-013 阶段门禁** | `specs/rt-14-q013-stage-gate.spec.ts` | Q-013 回归 |
| **Q-016 聊天持久化** | `specs/q016-chat-persistence.spec.ts` | Q-016 回归 |
| **Q-017 记忆持久化** | `specs/q017-memory-persistence.spec.ts` | Q-017 回归 |
| **Q-018/019/020 回归** | `specs/q018-q019-q020-regression.spec.ts` | 三 bug 回归 |
| **Q-022 项目名同步** | `specs/q022-project-name-sync.spec.ts` | Q-022 回归 |
| **Q-023 流式空闲重连** | `specs/q023-streaming-idle-reconnect.spec.ts` | Q-023 回归 |
| **Q-023A2 大代码截断** | `specs/q023a2-large-code-truncation.spec.ts` | Q-023A2 回归 |
| **引导启动项目** | `specs/guide-start-project.spec.ts` | 引导流程 |

---

## 运行测试

```bash
cd apps/frontend/tests

# 安装依赖（首次）
npm install
npx playwright install chromium

# 全量 E2E（不含 @ai 标记的测试）
npx playwright test

# 包含 @ai 标记的测试（需要 ZeroClaw 运行）
npm run test:e2e:ai

# Create 页冒烟测试套件
npm run test:e2e:create-smoke

# 单个 spec
npx playwright test specs/smoke-test.spec.ts

# 有头模式（看浏览器）
npm run test:e2e:headed

# UI 模式（交互式调试）
npm run test:e2e:ui

# 调试模式
npm run test:e2e:debug

# 查看测试报告
npx playwright show-report ../test-results/e2e-report
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `E2E_BASE_URL` | `http://localhost:5184` | 前端地址 |
| `E2E_API_URL` | `http://localhost:3200/api/v1` | 后端 API 地址 |
| `RUN_AI_E2E` | `0` | 设为 `1` 跑 @ai 标记的测试 |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | 自动检测 | Chrome/Edge 可执行路径 |
| `PLAYWRIGHT_ENABLE_VIDEO` | `0` | 设为 `1` 录制视频 |

### 前置条件

- 后端运行在 `localhost:3200`
- 前端运行在 `localhost:5184`
- @ai 测试还需 ZeroClaw 运行在 `localhost:42617`

---

## 测试文件结构

```
tests/
├── playwright.config.ts     # ★ Playwright 配置
├── package.json             # 测试依赖与脚本
├── fixtures.ts              # ★ 共享 fixtures（注册用户/登录/清理）
├── helpers/
│   ├── api.ts               # API 辅助（创建项目/保存代码/保存聊天）
│   └── test-helpers.ts      # UI 辅助（发送消息/等待 AI 响应/截图）
├── specs/                   # ★ E2E 测试用例（30+ 个）
│   ├── smoke-test.spec.ts   # 冒烟测试
│   ├── q0*.spec.ts          # 问题清单回归测试（Q-013~Q-023）
│   ├── create-*.spec.ts     # Create 页相关测试
│   ├── pbl-*.spec.ts        # PBL 流程测试
│   ├── project-detail-*.spec.ts # 项目详情页测试
│   └── ...                  # 其他
└── test-results/            # 测试截图/报告输出
```

---

## @ai 标记说明

| 标记 | 说明 |
|------|------|
| `@ai` | 需要真实 AI（ZeroClaw）参与的测试 |
| 无标记 | 纯前端/模拟测试（不需要 AI） |

> 默认 `grepInvert: /@ai/` 跳过 @ai 测试。设 `RUN_AI_E2E=1` 可运行。
> @ai 测试较慢且不稳定（依赖 LLM 输出），CI 中默认跳过。

---

## 共享工具

### `fixtures.ts`

| 工具 | 说明 |
|------|------|
| `registerUser(page, suffix)` | 注册测试用户，返回 `{email, password, token, name, id}` |
| `loginUser(page, email, password)` | 登录用户 |
| `createProjectApi(page, token, name)` | 通过 API 创建项目 |
| 自动清理 | 每个测试结束自动清理创建的用户/项目 |

### `helpers/test-helpers.ts`

| 函数 | 说明 |
|------|------|
| `sendMessage(page, message)` | 发送消息到聊天输入框 |
| `waitForAIResponse(page, timeout)` | 等待 AI 响应完成 |
| `getQuestionCards(page)` | 获取问题卡片 |
| `clickQuestionOption(page, cardIndex, optionIndex)` | 点击选项 |
| `waitForStage(page, stage)` | 等待阶段变更 |

### `helpers/api.ts`

| 函数 | 说明 |
|------|------|
| `createProject(page, token, name)` | 创建项目（API） |
| `saveProjectChat(page, token, projectId, messages)` | 保存聊天 |
| `saveProjectCode(page, token, projectId, code, language)` | 保存代码 |

---

## Playwright 配置要点

| 配置 | 值 | 说明 |
|------|-----|------|
| `testDir` | `./specs` | 测试文件目录 |
| `fullyParallel` | `false` | 不并行（避免数据冲突） |
| `workers` | `1` | 单 worker |
| `baseURL` | `http://localhost:5184` | 前端地址 |
| `actionTimeout` | `10000` (10s) | 操作超时 |
| `navigationTimeout` | `15000` (15s) | 导航超时 |
| `screenshot` | `only-on-failure` | 失败时截图 |
| `trace` | `on-first-retry` | 首次重试时记录 trace |
| `grepInvert` | `/@ai/` | 默认跳过 @ai 测试 |

---

## 已知问题

| 问题 | 说明 |
|------|------|
| @ai 测试依赖 ZeroClaw | ZeroClaw 未运行时 @ai 测试会超时失败 |
| 单 worker 运行 | 测试较慢，但避免数据冲突 |
| 部分 spec 缺少 `data-testid` | 测试通过文本选择器，可能因 UI 文案变更而失败 |
| 测试用户在真实数据库创建 | 测试结束自动清理，但中途崩溃可能残留 |

---
version: 1.0.0
created_at: 2026-07-30
maintainer: AI Agent
