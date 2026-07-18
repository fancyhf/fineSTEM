# AI 对话卡断问题解决方案

## 问题分析

用户反馈 AI 在生成长代码或详细回复时频繁中断，需要不断输入"继续"。

### 根本原因

1. **LLM 输出长度限制**：当生成超长代码时，LLM 会因为 `finish_reason=length` 被截断
2. **自动续接机制已存在**：后端已实现自动续接，但可能需要 2+ 分钟完成
3. **前端缺乏用户反馈**：用户无法知道系统正在续接，可能会认为卡住了
4. **网络超时**：弱网环境下 WebSocket 可能断开

## 已实施的解决方案

### 1. 后端自动续接机制（已验证工作正常）

**文件**: `apps/backend/app/services/orchestrator.py`

- **截断检测**: `_is_output_truncated()` 方法检测未闭合代码块、未闭合标签、以编程语言名结尾
- **自动续接**: 检测到截断后自动发送续接请求，最多尝试 2 次
- **配置优化**: 
  - `ZEROCLAW_MAX_TOKENS`: 16384
  - `ZEROCLAW_TIMEOUT_SECONDS`: 120

**测试结果**:
```
测试时间: 141.5 秒
Token 数量: 3656
内容长度: 14,231 字符
代码块状态: 闭合 (3 个完整代码块)
```

### 2. 前端"继续生成"按钮（本次新增）

**新增文件**:
- `apps/frontend/src/components/ContinueButton.tsx` - 继续生成按钮组件

**修改文件**:
- `apps/frontend/src/pages/Create.tsx` - 添加续接功能

**功能**:
1. 当检测到超时或连接错误时，显示"继续生成"按钮
2. 用户点击后发送"继续"消息，触发后端续接
3. 显示加载状态，避免用户重复点击

**关键代码变更**:

```typescript
// 保存最后一条消息用于续接
const lastMessageRef = useRef<string>('');

// 错误处理改进
catch (error) {
  const isTimeoutError = errMsg.includes('超时') || errMsg.includes('timeout');
  const isConnectionError = errMsg.includes('连接') || errMsg.includes('connection');
  
  if (isTimeoutError || isConnectionError) {
    // 显示继续按钮
    setShowContinueButton(true);
    last.content = `${assistantContent}\n\n[输出被截断，请点击下方"继续生成"按钮]`;
  }
}

// 处理继续生成
const handleContinue = useCallback(async () => {
  await handleSend('继续', undefined, { isContinue: true });
}, [handleSend]);
```

## 使用说明

### 对于用户

1. **正常情况**：AI 会自动续接，用户只需等待（可能需要 2-3 分钟）
2. **超时情况**：如果看到"[输出被截断，请点击下方"继续生成"按钮]"，点击按钮即可
3. **网络不稳定**：如果频繁断开，建议检查网络连接或稍后重试

### 对于开发者

1. **调整超时时间**：修改 `apps/backend/app/core/config.py` 中的 `ZEROCLAW_TIMEOUT_SECONDS`
2. **调整最大 Token**：修改 `ZEROCLAW_MAX_TOKENS`（注意成本影响）
3. **查看日志**：后端日志会显示 `output_truncated_detected` 和 `auto_continue_success`

## 后续优化建议

1. **添加进度指示器**：显示"正在续接..."的进度条
2. **优化网络重连**：WebSocket 断开后自动重连并恢复对话
3. **分段生成**：对于超长代码，建议 AI 分段生成而非一次性输出
4. **增加取消按钮**：允许用户取消长时间等待

## 相关文件

- `apps/backend/app/services/orchestrator.py` - 后端续接逻辑
- `apps/backend/app/core/config.py` - 配置参数
- `apps/backend/app/services/providers/zeroclaw_provider.py` - LLM Provider
- `apps/frontend/src/hooks/useStreamingChat.ts` - 前端 WebSocket 处理
- `apps/frontend/src/pages/Create.tsx` - 对话页面
- `apps/frontend/src/components/ContinueButton.tsx` - 继续生成按钮
