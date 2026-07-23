# fineSTEM AI 对话流修复报告

## 问题总结

升级到 ZeroClaw v0.8.3 后，Create 功能的 AI 对话流出现严重退化：

1. **对话被截断**：AI 回复经常只有一句话，详细内容全部被截断
2. **选项卡不显示**：结构化选项卡无法正确渲染
3. **选择识别失败**：用户点击选项后，AI 无法识别已做选择，重复提问
4. **阶段推进受阻**：PBL 流程无法正常推进

## 根本原因分析

### 1. AI 回复截断问题
- **原因**：ZeroClaw config.toml 的 `system_prompt` 缺乏"详细回复"的明确指令
- **表现**：AI 倾向于生成简短回复，有时只有一句话

### 2. 选项卡渲染问题
- **原因1**：`ask_question` 工具调用事件未被前端正确处理
- **原因2**：前端过度依赖 XML `<question>` 解析，而 AI 输出格式不稳定
- **表现**：选项卡时有时无，依赖 AI 输出格式

### 3. 选择识别失败
- **原因**：ZeroClaw 的 `system_prompt` 未定义 `[选择]` 格式消息的语义
- **表现**：用户发送 `[选择] 问题\n回答：选项` 后，AI 说"你没选"

## 修复方案

### 1. ZeroClaw Config 更新 (`H:\dev-env\zeroclaw\config\config.toml`)

#### 新增回复完整性要求
```toml
system_prompt = """你是 fineSTEM 的 AI 导师...

## 你的核心身份与风格
...
- **回复完整性**：回复要有实质内容，解决用户问题。避免无意义的简短回复（如"好的"、"明白了"）。
"""
```

#### 新增用户选择格式识别
```toml
## 📝 理解用户选择格式（重要！2026-07-20 新增）

当学生点击选项卡片回答问题时，前端会发送如下格式的消息：

```
[选择] {问题标题}
回答：{选项标签}
```

**你必须正确识别这种格式**：
1. 消息以 `[选择]` 开头表示这是选项回答
2. 第一行是问题标题（和 ask_question 的 title 参数一致）
3. 第二行以 `回答：` 开头，后面是用户选择的选项 label

**正确回应方式**：
- ✅ 确认用户的选择："好的，你选择了【极简即开即用型】..."
- ✅ 基于选择继续对话或推进流程
- ❌ 不要说"你没选"或"等你选一个"——用户已经选了
- ❌ 不要重复问同一个问题
"""
```

### 2. 前端 Hook 强化 (`apps/frontend/src/hooks/useStreamingChat.ts`)

#### 处理 ask_question 工具调用事件
```typescript
if (type === 'tool_call') {
  // ... 原有代码 ...
  
  // 2026-07-20 关键修复：处理 ask_question 工具调用
  if (data.name === 'ask_question' && data.args) {
    const args = data.args as Record<string, any>;
    const questionData: QuestionData = {
      id: `tool-${Date.now()}`,
      title: args.title || '请选择',
      multiple: args.multiple === true,
      step: args.step,
      totalSteps: args.total_steps,
      options: (args.options || []).map((opt: any, idx: number) => ({
        id: opt.id || `opt-${idx}`,
        label: opt.label || opt.id || `选项 ${idx + 1}`,
        description: opt.description,
      })),
    };
    if (questionData.options.length > 0) {
      if (events?.onQuestions) {
        events.onQuestions([questionData]);
      } else if (events?.onQuestion) {
        events.onQuestion(questionData);
      }
    }
  }
}
```

### 3. 智能截断检测

新增 `_detectIncompleteContent` 函数，检测以下截断特征：

1. **未闭合的代码块**：奇数个 ```
2. **未闭合的 XML/HTML 标签**：开标签多于闭标签
3. **以编程语言名称结尾**：如 "接下来我将用 Python"
4. **以引导词结尾**：如 "首先"、"接下来"、"然后"
5. **以冒号/破折号结尾**：可能想列举但被截断
6. **以问句结尾但太短**：且缺乏上下文

检测到截断时，在内容末尾添加提示：
```
[输出可能不完整，如需继续请说"继续"]
```

### 4. 策略总结

| 问题 | 修复前 | 修复后 |
|------|--------|--------|
| 选项渲染 | 依赖 XML 解析 | **工具调用为主** + XML 兜底 |
| 选择识别 | AI 不理解格式 | **Prompt 明确定义** `[选择]` 语义 |
| 回复截断 | 无法检测 | **智能截断检测** + 提示继续 |
| 阶段推进 | 工具调用不可靠 | **强化工具事件处理** |

## 测试覆盖

### 单元测试
- `apps/frontend/src/hooks/__tests__/useStreamingChat.test.ts`
  - ask_question 工具参数解析
  - 用户选择消息格式识别
  - XML question 解析（向后兼容）

- `apps/backend/tests/test_ask_question_tool.py`
  - AskQuestionTool 基本功能
  - 参数验证
  - PBL 各阶段标准问题

### E2E 测试
- `apps/frontend/tests/specs/create-pbl-flow.spec.ts`
  - 选项卡片渲染
  - 用户选择交互
  - AI 选择识别
  - 回复完整性
  - 9 阶段流程验证

## 验证步骤

1. **重启 ZeroClaw** 以加载新配置：
   ```powershell
   # 停止现有进程
   Stop-Process -Name "zeroclaw" -Force
   
   # 重新启动
   H:\dev-env\zeroclaw\zeroclaw-daemon.cmd
   ```

2. **运行测试**：
   ```bash
   # 后端测试
   cd apps/backend && pytest tests/test_ask_question_tool.py -v
   
   # 前端单元测试
   cd apps/frontend && npm test useStreamingChat
   
   # E2E 测试
   cd apps/frontend && npx playwright test create-pbl-flow.spec.ts
   ```

3. **手动验证**：
   - 打开 Create 页面
   - 发送"我想做一个新项目"
   - 验证选项卡片正确渲染
   - 点击选项，验证 AI 正确识别选择
   - 验证回复完整（>100 字）

## 后续优化建议

1. **监控和告警**：
   - 添加对话截断检测（统计回复长度 < 50 字的比例）
   - 监控选项卡渲染成功率

2. **A/B 测试**：
   - 对比新旧配置的 AI 回复质量
   - 收集用户满意度数据

3. **文档更新**：
   - 更新 AI Prompt 编写指南
   - 添加工具调用最佳实践

## 相关文件

- `H:\dev-env\zeroclaw\config\config.toml` - ZeroClaw 配置
- `apps/frontend/src/hooks/useStreamingChat.ts` - WebSocket 流处理
- `apps/frontend/src/pages/Create.tsx` - Create 页面
- `apps/backend/app/services/tools.py` - 工具定义
- `apps/backend/app/services/providers/zeroclaw_provider.py` - Provider 配置（备份）

## 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-20 | 修复 AI 对话流截断、选项卡、选择识别问题 | AI Agent |
