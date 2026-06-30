import React, { useState } from 'react';
import { Play, Maximize2, Minimize2 } from 'lucide-react';

interface CodePreviewProps {
  htmlContent: string;
  title?: string;
}

export const CodePreview: React.FC<CodePreviewProps> = ({
  htmlContent,
  title = '预览',
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!htmlContent || !htmlContent.trim()) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400">
        <Play className="w-8 h-8 mb-2 text-gray-300" />
        <p className="text-sm font-medium">点击"运行"按钮查看代码执行结果</p>
        <p className="text-xs mt-1 text-gray-300">支持 HTML / JavaScript 实时预览</p>
      </div>
    );
  }

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
        <iframe
          srcDoc={htmlContent}
          title={title}
          className="w-full h-full border-0 block"
          style={{ minHeight: '100%', height: '100%' }}
          sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups"
          loading="lazy"
        />
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
