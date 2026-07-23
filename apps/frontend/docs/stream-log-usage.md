# 流式对话日志使用说明

## 功能说明

用于诊断 AI 回复被截断/吞掉的问题。日志会记录：
- 每个 token 的接收
- content_update 事件
- UI 更新操作
- 会话结束时的完整内容

## 开启/关闭日志

### 在浏览器控制台操作：

```javascript
// 开启日志
localStorage.setItem('FINESTEM_STREAM_LOG_ENABLED', 'true')

// 关闭日志
localStorage.setItem('FINESTEM_STREAM_LOG_ENABLED', 'false')
```

### 使用便捷函数：

```javascript
// 在浏览器控制台
enableStreamLog()    // 开启
disableStreamLog()   // 关闭
isStreamLogEnabled() // 检查状态
```

## 日志内容

每次对话会话会生成一个 JSON 文件，包含：
- `sessionId`: 会话 ID
- `projectId`: 项目 ID
- `timestamp`: 时间戳
- `type`: 事件类型 (token/content_update/ui_update/end/error)
- `data`: 事件数据
- `metadata`: 元数据（内容长度等）

## 日志文件导出

会话结束时，日志会自动导出为 JSON 文件，文件名格式：
```
finestem-stream-log-{sessionId}-{timestamp}.json
```

## 查看日志摘要

在浏览器控制台：
```javascript
streamLogger.getSummary()
```

返回：
- 总会话数
- token 数量
- content_update 次数
- question 数量
- 最大内容长度

## 手动导出日志

```javascript
streamLogger.exportToFile()
```

## 日志示例

```json
{
  "sessionId": "finestem-1234567890",
  "projectId": "abc-123",
  "exportTime": "2026-07-21T10:30:00.000Z",
  "totalEntries": 150,
  "logs": [
    {
      "timestamp": "2026-07-21T10:29:00.000Z",
      "sessionId": "finestem-1234567890",
      "projectId": "abc-123",
      "type": "token",
      "data": { "token": "你好", "tokenLength": 2 },
      "metadata": { "rawAssistantContentLength": 100 }
    },
    {
      "timestamp": "2026-07-21T10:29:05.000Z",
      "sessionId": "finestem-1234567890",
      "projectId": "abc-123",
      "type": "ui_update",
      "data": { "action": "setMessages_update", "contentLength": 500 },
      "metadata": { "assistantContentLength": 500, "maxVisibleContentLength": 500 }
    }
  ]
}
```

## 问题诊断

当 AI 回复被吞掉时，检查日志中的：

1. **token 数量**: 如果 token 很少，可能是后端截断
2. **content_update 长度**: 对比 `rawAssistantContentLength` 和 `assistantContentLength`
3. **ui_update 动作**: 查看是否有 `skip_shorter_content` 或 `skip_empty_content`
4. **最终内容长度**: 检查 `onEnd` 事件中的内容长度

## 注意事项

- 日志默认关闭，需要手动开启
- 日志最多保留 1000 条记录
- 日志存储在内存中，页面刷新会丢失
- 会话结束时自动导出到下载文件夹
