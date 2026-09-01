/**
 * 流式对话日志记录器
 * 用于诊断 AI 回复被截断/吞掉的问题
 *
 * 使用 localStorage 控制开关：
 *   localStorage.setItem('FINESTEM_STREAM_LOG_ENABLED', 'true')  // 开启
 *   localStorage.setItem('FINESTEM_STREAM_LOG_ENABLED', 'false') // 关闭
 */

interface LogEntry {
  timestamp: string;
  sessionId: string;
  projectId?: string;
  // 类型放宽：涵盖所有实际使用过的事件名（session_start/done/auto_continue_triggered
  // 在代码里已长期使用，加上 thinking 是 2026-07-21 新增），同时用 string 兜底，
  // 避免每次新增事件名都要回头改这里的联合类型。
  type: string;
  data: unknown;
  metadata?: {
    rawAssistantContentLength?: number;
    assistantContentLength?: number;
    maxVisibleContentLength?: number;
    messageCount?: number;
    // 以下为截断/续接诊断所需字段
    sessionContentLength?: number;
    continueAttempt?: number;
    continueAttempts?: number;
    finishReason?: string | null;
    isLengthTruncated?: boolean;
    isContentIncomplete?: boolean;
    shouldSuggestContinue?: boolean;
    hasQuestionTag?: boolean;
    reason?: string;
    contentLength?: number;
    attempt?: number;
    maxAttempts?: number;
    length?: number;
  };
}

class StreamLogger {
  private enabled: boolean = false;
  private sessionId: string = '';
  private projectId: string = '';
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000; // 最多保留 1000 条

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    if (typeof window !== 'undefined') {
      this.enabled = localStorage.getItem('FINESTEM_STREAM_LOG_ENABLED') === 'true';
    }
  }

  /**
   * 检查日志是否启用
   */
  isEnabled(): boolean {
    this.loadConfig();
    return this.enabled;
  }

  /**
   * 设置日志开关
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('FINESTEM_STREAM_LOG_ENABLED', enabled ? 'true' : 'false');
    }
  }

  /**
   * 开始新会话
   */
  startSession(sessionId: string, projectId?: string) {
    this.sessionId = sessionId;
    this.projectId = projectId || '';
    this.logs = [];

    if (this.enabled) {
      this.log('session_start', {
        sessionId,
        projectId,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      });
    }
  }

  /**
   * 记录日志
   */
  log(
    type: LogEntry['type'],
    data: unknown,
    metadata?: LogEntry['metadata']
  ) {
    if (!this.enabled) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      projectId: this.projectId,
      type,
      data,
      metadata,
    };

    this.logs.push(entry);

    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // 同时输出到控制台
    console.log(`[StreamLog][${type}]`, entry);
  }

  /**
   * 记录 token 事件
   */
  logToken(token: string, metadata?: LogEntry['metadata']) {
    this.log('token', { token, tokenLength: token.length }, metadata);
  }

  /**
   * 记录 content_update 事件
   */
  logContentUpdate(content: string, source: string, metadata?: LogEntry['metadata']) {
    this.log('content_update', {
      content: content.slice(0, 500), // 只记录前 500 字符
      contentLength: content.length,
      source,
    }, metadata);
  }

  /**
   * 记录 UI 更新
   */
  logUIUpdate(
    action: string,
    contentLength: number,
    metadata?: LogEntry['metadata']
  ) {
    this.log('ui_update', { action, contentLength }, metadata);
  }

  /**
   * 记录 question 事件
   */
  logQuestion(questionData: unknown) {
    this.log('question', questionData);
  }

  /**
   * 记录 tool_call 事件
   */
  logToolCall(toolName: string, success: boolean, data?: unknown) {
    this.log('tool_call', { toolName, success, data });
  }

  /**
   * 记录结束事件
   */
  logEnd(finalContent: string, metadata?: LogEntry['metadata']) {
    this.log('end', {
      finalContent: finalContent.slice(0, 500),
      finalContentLength: finalContent.length,
    }, metadata);

    // 会话结束时，导出日志到文件
    this.exportToFile();
  }

  /**
   * 记录错误
   */
  logError(error: unknown, context?: string) {
    this.log('error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
    });
  }

  /**
   * 获取所有日志
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * 清空日志
   */
  clear() {
    this.logs = [];
  }

  /**
   * 导出日志到文件
   */
  exportToFile() {
    if (!this.enabled || this.logs.length === 0) return;

    const logData = {
      sessionId: this.sessionId,
      projectId: this.projectId,
      exportTime: new Date().toISOString(),
      totalEntries: this.logs.length,
      logs: this.logs,
    };

    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `finestem-stream-log-${this.sessionId}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    console.log(`[StreamLogger] 日志已导出: ${a.download}`);
  }

  /**
   * 获取日志摘要（用于快速查看）
   */
  getSummary(): {
    sessionId: string;
    projectId: string;
    totalEntries: number;
    tokenCount: number;
    contentUpdateCount: number;
    questionCount: number;
    maxContentLength: number;
  } {
    const tokenCount = this.logs.filter(l => l.type === 'token').length;
    const contentUpdateCount = this.logs.filter(l => l.type === 'content_update').length;
    const questionCount = this.logs.filter(l => l.type === 'question').length;

    let maxContentLength = 0;
    this.logs.forEach(l => {
      if (l.metadata?.assistantContentLength) {
        maxContentLength = Math.max(maxContentLength, l.metadata.assistantContentLength);
      }
      if (l.metadata?.maxVisibleContentLength) {
        maxContentLength = Math.max(maxContentLength, l.metadata.maxVisibleContentLength);
      }
    });

    return {
      sessionId: this.sessionId,
      projectId: this.projectId,
      totalEntries: this.logs.length,
      tokenCount,
      contentUpdateCount,
      questionCount,
      maxContentLength,
    };
  }
}

// 单例导出
export const streamLogger = new StreamLogger();

// 便捷的开关控制函数
export function enableStreamLog() {
  streamLogger.setEnabled(true);
  console.log('[StreamLogger] 日志已启用');
}

export function disableStreamLog() {
  streamLogger.setEnabled(false);
  console.log('[StreamLogger] 日志已禁用');
}

export function isStreamLogEnabled(): boolean {
  return streamLogger.isEnabled();
}
