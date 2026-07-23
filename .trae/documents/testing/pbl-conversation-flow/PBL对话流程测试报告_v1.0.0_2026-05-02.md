# PBL 对话流程 E2E 测试报告 v1.0.0

## 1. 测试执行摘要

| 项目 | 数据 |
|------|------|
| **测试时间** | 2026-05-02 11:42:00 |
| **测试执行者** | AI Agent (自动化) |
| **测试环境** | 本地开发：前端 localhost:5174 / 后端 localhost:3000 |
| **测试框架** | Playwright v1.59.1 + Python WebSocket 直连 |

### 1.1 总体结果

| 测试类别 | 通过 | 失败 | 总计 |
|---------|------|------|------|
| WebSocket 直连 (Python) | 2 | 0 | 2 |
| Playwright E2E 步骤测试 | 10 | 0 | 10 |
| Playwright 完整流程 | 1 | 0 | 1 |
| **总计** | **13** | **0** | **13** |

**通过率: 100%**

## 2. 详细结果

### 2.1 WebSocket 自动化测试 (Python)

| 测试项 | 事件数 | Token 数 | 结果 |
|--------|--------|---------|------|
| 第1轮: 项目请求 | 176 | 174 | ✅ final 正常 |
| 第2轮: 继续对话 | 399 | 394 | ✅ final 正常 |
| 压力第1轮 | 85 | 84 | ✅ final 正常 |
| 压力第2轮 | 88 | 84 | ✅ final 正常 |
| 压力第3轮 | 93 | 89 | ✅ final 正常 |
| **总计** | **841** | **825** | **✅ 全部通过** |

### 2.2 Playwright E2E 测试

| 测试ID | 描述 | 耗时 | 结果 |
|--------|------|------|------|
| ST-001 | 冒烟测试 | 2.9s | ✅ |
| TC-001 | 步骤1: 发送请求+AI 回复 | 4.4s | ✅ |
| TC-002 | 步骤2: QuestionCard 弹出验证 | 19.3s | ✅ |
| TC-003 | 步骤3: 选择选项后继续对话 | 15.9s | ✅ |
| TC-004 | 步骤4-5: 多轮交互产生代码 | 38.0s | ✅ |
| TC-005 | 步骤6: 代码编辑器展开 | 38.1s | ✅ |
| TC-006 | 步骤7-8: 运行代码查看结果 | 19.4s | ✅ |
| TC-007 | 步骤9: 修改项目名字 | 15.1s | ✅ |
| TC-008 | 步骤10: 项目保存状态 | 19.9s | ✅ |
| TC-009 | 步骤11: 打开历史项目 | 14.5s | ✅ |
| TC-010 | 完整 E2E 流程 | 49.4s | ✅ |

## 3. 缺陷修复记录

### BUG-001: QuestionCard 选择后对话卡住 [P0] ✅ 已修复

**根因分析（详细时序追踪）**:
```
Render A: pendingQuestion=null, isLoading=false
  → 用户发送消息
  → handleSend() → setIsLoading(true)

Render B: pendingQuestion=null, isLoading=true
  → AI 开始流式回复...
  → onQuestion 回调 → setPendingQuestion(data)

Render C: pendingQuestion=data, isLoading=true
  → handleQuestionAnswer 重新创建 (pendingQuestion 从 null→data)
  → useCallback 捕获 handleSend，其中 isLoading=true (陈旧!)

Render D: pendingQuestion=data, isLoading=false  ← AI 流式完成
  → pendingQuestion 引用未变 → handleQuestionAnswer 未重建
  → 仍持有 Render C 中的 handleSend(isLoading=true)

用户点击选项:
  → handleQuestionAnswer() 
  → setTimeout → handleSend(sendText)
  → if (!message || isLoading) return;  ← isLoading=true → 直接 return!
```

**修复方案**:
```typescript
// Create.tsx: 添加 handleSendRef 绕过闭包陈旧引用
const handleSendRef = useRef<typeof handleSend>(handleSend);
handleSendRef.current = handleSend;  // 每次渲染更新

const handleQuestionAnswer = useCallback((selectedIds, customText) => {
  // ...
  setTimeout(() => handleSendRef.current(sendText), 50);  // ← 始终是最新的
}, [pendingQuestion]);
```

**修复文件**: [Create.tsx](file:///g:/mediaProjects/fineSTEM/apps/frontend/src/pages/Create.tsx#L261-L608)

### BUG-002: AI 不输出 `<question>` XML [P0] ✅ 已修复

**修复文件**: [zeroclaw_provider.py](file:///g:/mediaProjects/fineSTEM/apps/backend/app/services/providers/zeroclaw_provider.py#L39-L50)

## 4. 交付物清单

| 文件 | 路径 |
|------|------|
| 测试计划 | `.trae/documents/testing/pbl-conversation-flow/PBL对话流程测试计划_v1.0.0_2026-05-01.md` |
| 测试报告 | `.trae/documents/testing/pbl-conversation-flow/PBL对话流程测试报告_v1.0.0_2026-05-02.md` |
| E2E 测试代码 | `apps/frontend/tests/specs/pbl-conversation-flow.spec.ts` |
| WS 验证脚本 | `apps/backend/test_question_flow.py` |
| WS 诊断脚本 | `apps/backend/test_ws.py` |
| 前端修复 | `apps/frontend/src/pages/Create.tsx` |
| 后端修复 | `apps/backend/app/services/providers/zeroclaw_provider.py` |

## 5. 结论

QuestionCard 选择后卡住的问题已通过 `handleSendRef` 模式彻底修复。经过 13 个自动化测试验证（含 5 轮 WebSocket 直连 + 11 个 Playwright E2E），系统连续多轮对话全部正常，无卡顿。

---
**报告版本**: v1.0.0  
**生成时间**: 2026-05-02 11:46:00.000  
**维护者**: AI Agent
