# PBL 对话流程 E2E 测试计划 v1.0.0

## 1. 测试概述

### 1.1 测试目标
验证 fineSTEM PBL（项目式学习）对话流程的完整功能，确保用户从提出项目需求到完成项目的全流程体验流畅。重点验证 QuestionCard 选项卡选择后系统能继续对话，不会卡住。

### 1.2 测试范围
| 层级 | 模块 | 关键文件 |
|------|------|---------|
| **前端** | Create 页面、聊天界面 | `apps/frontend/src/pages/Create.tsx` |
| **前端** | QuestionCard 组件 | `apps/frontend/src/components/QuestionCard.tsx` |
| **前端** | 流式聊天 Hook | `apps/frontend/src/hooks/useStreamingChat.ts` |
| **后端** | WebSocket API | `apps/backend/app/api/agent.py` |
| **后端** | AI 编排服务 | `apps/backend/app/services/orchestrator.py` |
| **后端** | System Prompt | `apps/backend/app/services/providers/zeroclaw_provider.py` |

### 1.3 测试环境
- **前端地址**: http://localhost:5174/finestem
- **后端地址**: http://localhost:3000/api/v1
- **WebSocket**: ws://localhost:3000/api/v1/agent/ws
- **测试框架**: Playwright v1.59.1
- **浏览器引擎**: Chromium

## 2. 测试场景

### 场景 1: 基础对话与 AI 回复
| 步骤 | 操作 | 期望结果 |
|------|------|---------|
| 1.1 | 从首页进入创造页面 | 页面加载成功，聊天输入框可见 |
| 1.2 | 输入项目请求并发送 | WebSocket 连接成功，消息已发送 |
| 1.3 | 等待 AI 回复 | 回复内容可见，包含 "fineSTEM AI" 标识 |
| 1.4 | 继续对话 | 对话流畅，无卡顿 |

### 场景 2: QuestionCard 选项卡交互（核心）
| 步骤 | 操作 | 期望结果 |
|------|------|---------|
| 2.1 | AI 输出 `<question>` XML 块 | QuestionCard 组件正确渲染 |
| 2.2 | 点击选项 | 选项高亮选中，确认按钮可用 |
| 2.3 | 点击"确定"确认选择 | 选择结果以 `[选择]` 格式发送 |
| 2.4 | AI 收到选择后继续回复 | 系统正常响应，对话流程继续，不会卡住 |

### 场景 3: 工流 - 代码生成与运行
| 步骤 | 操作 | 期望结果 |
|------|------|---------|
| 3.1 | 多轮交互后请求生成代码 | AI 输出完整代码块 |
| 3.2 | 代码编辑器自动展开 | Monaco 编辑器展示代码 |
| 3.3 | 点击"运行"按钮 | 代码发送到后端执行 |
| 3.4 | 查看运行结果 | 结果显示在预览区 |

## 3. 测试用例

### TC-001: 基础对话流程 [P0]
```
前置条件: 系统已启动，用户可匿名或登录
输入内容: "我想做一个学生成绩管理系统"
期望输出:
  1. AI 回复内容可见（文本包含 "fineSTEM AI" 标识）
  2. 如有选项卡（<question> XML），能正确解析并渲染
  3. 选择选项后能继续对话，无卡顿
执行方式: 自动化 (Playwright)
```

### TC-002: QuestionCard 单选交互 [P0]
```
前置条件: AI 在流式回复中输出了 <question> XML 块
输入内容: 点击第一个选项 → 点击"确定"
期望输出:
  1. 选项被选中（视觉高亮反馈）
  2. 选择结果以 "[选择] 标题\n回答：选项标签" 格式发送
  3. 系统继续对话，AI 收到选择后正常回复
  4. 无卡顿、无重复发送、无静默失败
执行方式: 自动化 (Playwright) + WebSocket 直接测试
```

### TC-003: QuestionCard 多选交互 [P1]
```
前置条件: AI 输出多选型 <question type="multiple">
输入内容: 勾选多个选项 → 点击"确定"
期望输出:
  1. 多个选项同时选中
  2. 选择结果格式为 "选项1、选项2、选项3"
  3. AI 收到后继续对话
执行方式: 自动化 (Playwright)
```

### TC-004: QuestionCard 自定义输入 [P1]
```
前置条件: AI 输出带 allow_custom 的 question
输入内容: 选择选项 + 输入自定义文本
期望输出: 自定义文本合并到回答中
执行方式: 自动化 (Playwright)
```

### TC-005: 代码生成与编辑器展开 [P0]
```
前置条件: 已完成多轮需求分析对话
输入内容: "请生成完整代码" 或 AI 自主输出代码
期望输出:
  1. AI 输出代码块（```python / ```javascript）
  2. 代码编辑器自动展开显示
  3. 代码语法高亮正确
执行方式: 自动化 (Playwright)
```

### TC-006: 代码运行与结果展示 [P0]
```
前置条件: 代码已生成并在编辑器中展示
输入内容: 点击"运行"按钮
期望输出:
  1. 代码发送到后端执行（/api/v1/code-execution）
  2. 结果在预览区正确显示
  3. 超时场景有合理处理
执行方式: 自动化 (Playwright)
```

### TC-007: 项目名称修改 [P1]
```
前置条件: 项目已创建
输入内容: 点击编辑图标 → 输入新名称 → 回车确认
期望输出:
  1. 编辑输入框弹出
  2. 新名称保存成功
  3. 界面标题更新为新名称
执行方式: 自动化 (Playwright)
```

### TC-008: 完整端到端流程（一键回归） [P0]
```
前置条件: 系统已启动
输入内容: 从项目请求到代码运行的完整 PBL 流程
期望输出:
  1. 所有步骤顺利衔接
  2. QuestionCard 交互不卡住
  3. 代码生成并运行成功
  4. 项目正确保存到后端
执行方式: 自动化 (Playwright - 完整 E2E)
```

## 4. 缺陷记录

### 4.1 已知已修复缺陷

| ID | 描述 | 严重程度 | 根因分析 | 修复方案 | 修复文件 | 状态 |
|----|------|---------|---------|---------|---------|------|
| BUG-001 | QuestionCard 选择后对话卡住 | 🔴 P0 | `handleQuestionAnswer(useCallback([pendingQuestion]))` 捕获了陈旧的 `handleSend`，其中 `isLoading` 仍为 `true`。时序：Render C(isLoading=true) → handleQuestionAnswer 创建 → Render D(isLoading=false, pendingQuestion 未变) → handleQuestionAnswer 未重建 → 用户点击 → handleSend 看到 isLoading=true → 直接 return | 添加 `handleSendRef` 并在每次渲染更新，`handleQuestionAnswer` 通过 `handleSendRef.current` 调用最新 `handleSend` | `Create.tsx` L260, L365, L607 | ✅ 已修复 |
| BUG-002 | AI 不输出 `<question>` XML | 🔴 P0 | System Prompt 缺少选项卡 XML 格式指导，LLM 不知道要用 `<question>` 标签 | 在 `zeroclaw_provider.py` 的 `STEM_SYSTEM_PROMPT` 中添加 XML 格式规范和示例 | `zeroclaw_provider.py` L39-50 | ⏳ 待验证 |

### 4.2 修复关键技术说明
```typescript
// 问题：useCallback 闭包陈旧引用
const handleQuestionAnswer = useCallback((ids) => {
  setTimeout(() => handleSend(sendText), 50);  // handleSend 捕获 isLoading=true
}, [pendingQuestion]);

// 修复：ref 模式确保始终调用最新函数
const handleSendRef = useRef(handleSend);
handleSendRef.current = handleSend;  // 每次渲染更新
const handleQuestionAnswer = useCallback((ids) => {
  setTimeout(() => handleSendRef.current(sendText), 50);  // 始终是最新的
}, [pendingQuestion]);
```

## 5. 验收标准

### 5.1 功能验收
- [ ] TC-001 基础对话流程通过
- [x] TC-002 QuestionCard 单选交互通过（已修复 BUG-001）
- [ ] TC-005 代码生成通过
- [ ] TC-008 完整 E2E 流程通过

### 5.2 性能验收指标
| 指标 | 目标 | 测量方式 |
|------|------|---------|
| 页面加载时间 | < 3s | Playwright load 事件 |
| AI 首次 Token 响应 | < 10s | WebSocket onmessage 时间戳差值 |
| QuestionCard 渲染 | < 2s | DOM 出现时间 |
| 代码运行 | < 5s | Button click → 结果出现 |

### 5.3 稳定性验收
- 连续 10 次 QuestionCard 交互无卡顿
- WebSocket 连接 100% 成功率
- 无状态泄漏（React 内存检测）

## 6. 执行命令

```bash
# 进入测试目录
cd g:\mediaProjects\fineSTEM\apps\frontend\tests

# 运行所有 PBL 测试（命令行）
.\node_modules\.bin\playwright test specs/pbl-conversation-flow.spec.ts --headed --reporter=list --timeout=120000

# 运行指定测试
.\node_modules\.bin\playwright test specs/pbl-conversation-flow.spec.ts -g "步骤3" --headed

# 生成 HTML 报告
.\node_modules\.bin\playwright test specs/pbl-conversation-flow.spec.ts --reporter=html

# 列出所有可用测试
.\node_modules\.bin\playwright test specs/pbl-conversation-flow.spec.ts --list

# WebSocket 直连测试（Python）
cd g:\mediaProjects\fineSTEM\apps\backend
python test_ws.py
python test_ws_proxy.py
```

## 7. 附录

### 7.1 完整数据流图
```
用户输入 → Create.tsx handleSend()
  → useStreamingChat stream()
    → WebSocket ws://.../agent/ws
      → agent.py ws_chat
        → orchestrator stream_chat_with_events
          → LLM 调用 → token 流式返回
          → 解析 <question> XML
          → yield ("question", data)
        → websocket.send_json
      ← onmessage: question event
    ← events.onQuestion → setPendingQuestion(data)
  ← QuestionCard 渲染
用户点击选项 → handleQuestionAnswer
  → handleSendRef.current(sendText)  ← 关键修复点
    → 新一轮 stream()
```

### 7.2 相关文档
- [AI 对话流设计规格](file:///g:/mediaProjects/fineSTEM/.trae/documents/产品与规划/fineSTEM_AI对话流设计规格_v1.0.0.md)
- [ZeroClaw 技术知识库](file:///g:/mediaProjects/fineSTEM/.trae/documents/技术与架构/ZeroClaw_技术知识库_v1.0.0.md)
- [项目结构管理标准](file:///g:/mediaProjects/fineSTEM/.trae/documents/project-structure-and-docs-standard-tech-neutral.md)

---
**文档版本**: v1.0.0  
**创建时间**: 2026-05-01 22:40:00.000  
**维护者**: AI Agent  
**关联分支**: `feature/fix-questioncard-stuck`
