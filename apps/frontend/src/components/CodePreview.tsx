import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Maximize2, Minimize2, Terminal, Trash2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface PreviewLogEntry {
  level: 'log' | 'warn' | 'error';
  text: string;
  ts: number;
}

interface CodePreviewProps {
  htmlContent: string;
  title?: string;
  /** 学生点"让 AI 诊断"时回调，父组件接入聊天 handleSend */
  onAskAI?: (text: string) => void;
}

// 2026-07-30 控制台日志捕获：向预览 HTML 注入脚本，拦截 console.* / 未捕获异常 /
// Promise 异常，postMessage 回传给父页。学生汇报"按钮没反应"时，点击报错按钮时抛的
// Uncaught ReferenceError 等以前只进浏览器控制台，学生和 AI 都看不到；现在预览区
// 自带控制台面板，并可一键把日志发给 AI 诊断。只在渲染时注入，不污染保存到
// 后端的 preview_html。
function instrumentHtmlForConsole(html: string, sourceId: string): string {
  if (!html || !html.trim()) return html;
  const script = `<script>(function(){
  var SID = ${JSON.stringify(sourceId)};
  function send(level, args){
    var parts = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      try { parts.push(typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)); }
      catch (e) { parts.push(String(a)); }
    }
    var text = parts.join(' ');
    if (text.length > 600) text = text.slice(0, 600) + '…';
    try { parent.postMessage({ type: 'preview-console', sourceId: SID, level: level, text: text, ts: Date.now() }, '*'); } catch (e) { /* ignore */ }
  }
  ['log', 'info', 'warn', 'error'].forEach(function(m){
    var orig = console[m];
    console[m] = function(){ send(m === 'info' ? 'log' : m, arguments); if (orig) orig.apply(console, arguments); };
  });
  window.addEventListener('error', function(e){
    send('error', ['Uncaught ' + (e.message || '脚本错误') + (e.lineno ? ' (第 ' + e.lineno + ' 行)' : '')]);
  });
  window.addEventListener('unhandledrejection', function(e){
    var r = e.reason;
    send('error', ['未处理的 Promise 异常: ' + (r && r.message ? r.message : String(r))]);
  });
})();</` + `script>`;
  // 插在 <head> 开标签后，确保比学生代码先执行；无 head 则直接前置（浏览器仍会执行）
  const headMatch = html.match(/<head[^>]*>/i);
  if (headMatch && typeof headMatch.index === 'number') {
    const insertAt = headMatch.index + headMatch[0].length;
    return html.slice(0, insertAt) + script + html.slice(insertAt);
  }
  return script + html;
}

const LOG_LEVEL_STYLE: Record<PreviewLogEntry['level'], string> = {
  log: 'text-gray-300',
  warn: 'text-amber-300',
  error: 'text-red-400',
};

export const CodePreview: React.FC<CodePreviewProps> = ({
  htmlContent,
  title = '预览',
  onAskAI,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [logs, setLogs] = useState<PreviewLogEntry[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const sourceIdRef = useRef(`preview-${Math.random().toString(36).slice(2, 10)}`);
  const logListRef = useRef<HTMLDivElement>(null);

  const instrumentedHtml = useMemo(
    () => instrumentHtmlForConsole(htmlContent, sourceIdRef.current),
    [htmlContent],
  );

  // 每次重新运行（htmlContent 变化）清空上一轮日志
  useEffect(() => { setLogs([]); }, [htmlContent]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as { type?: string; sourceId?: string; level?: string; text?: string; ts?: number } | null;
      if (!d || d.type !== 'preview-console' || d.sourceId !== sourceIdRef.current) return;
      const level: PreviewLogEntry['level'] = d.level === 'error' ? 'error' : d.level === 'warn' ? 'warn' : 'log';
      setLogs((prev) => {
        const next = [...prev, { level, text: String(d.text || ''), ts: d.ts || Date.now() }];
        return next.length > 200 ? next.slice(-200) : next;
      });
      // 出现报错时自动展开控制台，让学生第一时间看到
      if (level === 'error') setConsoleOpen(true);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // 新日志到达时滚到底部
  useEffect(() => {
    if (consoleOpen && logListRef.current) {
      logListRef.current.scrollTop = logListRef.current.scrollHeight;
    }
  }, [logs, consoleOpen]);

  const errorCount = logs.filter((l) => l.level === 'error').length;

  const handleAskAI = () => {
    if (!onAskAI || logs.length === 0) return;
    const recent = logs.slice(-30);
    const NL = String.fromCharCode(10);
    const lines = recent.map((l) => `[${l.level}] ${l.text}`).join(NL);
    onAskAI([
      `我运行了页面，浏览器控制台有以下输出（最近 ${recent.length} 条，其中 ${errorCount} 条报错）：`,
      '```',
      lines,
      '```',
      '请根据这些控制台日志帮我诊断问题并修复。',
    ].join(NL));
  };

  // 2026-07-31 复测修复：空态不再提前 return——那样控制台面板不在 DOM 里，
  // 运行慢/失败时学生（和 E2E 脚本）都找不到它。改为占位符内嵌、面板常驻。
  const isEmpty = !htmlContent || !htmlContent.trim();

  return (
    <div className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 border-b border-gray-200">
        <span className="text-xs text-gray-500 font-medium">{title}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 hover:bg-gray-200 rounded text-gray-400 transition-colors"
            title={isFullscreen ? '退出全屏' : '全屏预览'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-white overflow-auto">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400">
            <Play className="w-8 h-8 mb-2 text-gray-300" />
            <p className="text-sm font-medium">点击"运行"按钮查看代码执行结果</p>
            <p className="text-xs mt-1 text-gray-300">支持 HTML / JavaScript 实时预览</p>
          </div>
        ) : (
          <iframe
            srcDoc={instrumentedHtml}
            title={title}
            className="w-full h-full border-0 block"
            style={{ minHeight: '100%', height: '100%' }}
            sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups"
            loading="lazy"
          />
        )}
      </div>
      {/* 控制台面板：捕获预览页的 console 输出与运行时报错 */}
      <div data-testid="preview-console" className="border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <button
          data-testid="preview-console-toggle"
          onClick={() => setConsoleOpen(!consoleOpen)}
          className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-gray-100 transition-colors"
        >
          <span className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Terminal className="w-3.5 h-3.5" />
            控制台
            {logs.length > 0 && <span className="text-gray-400">({logs.length})</span>}
            {errorCount > 0 && (
              <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px] font-semibold">
                {errorCount} 错误
              </span>
            )}
          </span>
          {consoleOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronUp className="w-3.5 h-3.5 text-gray-400" />}
        </button>
        {consoleOpen && (
          <div className="border-t border-gray-200">
            <div ref={logListRef} data-testid="preview-console-logs" className="max-h-36 overflow-y-auto bg-gray-900 px-3 py-2 font-mono text-[11px] leading-relaxed">
              {logs.length === 0 ? (
                <div className="text-gray-500">暂无输出。页面里的 console.log / 报错会显示在这里。</div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className={`whitespace-pre-wrap break-all ${LOG_LEVEL_STYLE[l.level]}`}>
                    {l.level === 'error' ? '❌ ' : l.level === 'warn' ? '⚠️ ' : ''}{l.text}
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-2 py-1 bg-gray-50">
              <button
                onClick={() => setLogs([])}
                disabled={logs.length === 0}
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> 清空
              </button>
              {onAskAI && (
                <button
                  data-testid="preview-console-ask-ai"
                  onClick={handleAskAI}
                  disabled={logs.length === 0}
                  className="flex items-center gap-1 px-2.5 py-0.5 text-[11px] bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white rounded transition-colors"
                >
                  <Sparkles className="w-3 h-3" /> 让 AI 诊断
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export function buildHtmlFromCode(code: string, language: string): string {
  if (!code || !code.trim()) {
    return '';
  }

  if (language === 'html') {
    if (code.includes('<!DOCTYPE') || code.includes('<html')) {
      return code;
    }
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px;background:#f9fafb;color:#1f2937;line-height:1.6}</style></head>
<body>${code}</body></html>`;
  }

  if (language === 'javascript') {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px;background:#f9fafb;color:#1f2937;line-height:1.6}#output{margin-top:16px}pre{background:#1f2937;color:#e5e7eb;padding:16px;border-radius:8px;overflow-x:auto;margin:8px 0;font-size:13px}.error{color:#ef4444;font-weight:500}.success{color:#10b981;font-weight:500}h3{color:#374151;margin-bottom:12px;font-size:16px}</style></head>
<body>
<h3>📋 JavaScript 执行结果</h3>
<div id="output"></div>
<script>
(function(){
  var output = document.getElementById('output');
  var hasOutput = false;

  function addLine(text, type) {
    hasOutput = true;
    var pre = document.createElement('pre');
    pre.textContent = String(text);
    if (type) pre.className = type;
    output.appendChild(pre);
  }

  var origLog = console.log;
  var origError = console.error;
  var origWarn = console.warn;

  console.log = function() {
    var args = Array.prototype.slice.call(arguments);
    addLine(args.map(function(a){return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a);}).join(' '), 'info');
    origLog.apply(console, arguments);
  };

  console.error = function() {
    var args = Array.prototype.slice.call(arguments);
    addLine(args.map(String).join('\\n'), 'error');
    origError.apply(console, arguments);
  };

  console.warn = function() {
    var args = Array.prototype.slice.call(arguments);
    addLine(args.map(String).join('\\n'), '');
    origWarn.apply(console, arguments);
  };

  try {
${code.split('\\n').map(function(line){ return '    ' + line; }).join('\\n')}
    if (!hasOutput) {
      addLine('✅ 代码执行完成（无输出）', 'success');
    }
  } catch(e) {
    addLine('❌ 错误: ' + e.message, 'error');
  }
})();
</script></body></html>`;
  }

  if (language === 'python') {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:monospace;padding:20px;background:#f9fafb;color:#1f2937;line-height:1.6}pre{background:#1f2937;color:#e5e7eb;padding:20px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}.notice{background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;margin-bottom:16px;color:#92400e}h3{color:#374151;margin-bottom:16px}</style></head>
<body>
<h3>🐍 Python 代码</h3>
<div class="notice">⚠️ Python 代码需要在后端沙箱执行，当前仅展示代码内容</div>
<pre>${escapeHtml(code)}</pre>
</body></html>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:monospace;padding:20px;background:#f9fafb;color:#1f2937}pre{background:#1f2937;color:#e5e7eb;padding:16px;border-radius:8px;overflow-x-auto;white-space:pre-wrap;word-wrap:break-word}</style></head>
<body><pre>${escapeHtml(code)}</pre></body></html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
