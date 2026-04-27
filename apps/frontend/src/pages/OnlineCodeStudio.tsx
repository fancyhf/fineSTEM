import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

type EditorTab = 'html' | 'css' | 'js';
type RunMode = 'iframe' | 'webcontainer';

interface StudioFiles {
  html: string;
  css: string;
  js: string;
}

type MonacoLanguage = 'html' | 'css' | 'javascript';

interface MonacoModel {
  getValue: () => string;
  setValue: (value: string) => void;
  dispose: () => void;
}

interface MonacoEditorInstance {
  getModel: () => MonacoModel | null;
  setModel: (model: MonacoModel) => void;
  addCommand: (keybinding: number, handler: () => void) => number;
  layout: () => void;
  onDidChangeModelContent: (listener: () => void) => { dispose: () => void };
  dispose: () => void;
}

interface MonacoApi {
  KeyMod: { CtrlCmd: number };
  KeyCode: { KeyS: number };
  editor: {
    create: (container: HTMLElement, options: Record<string, unknown>) => MonacoEditorInstance;
    createModel: (value: string, language?: MonacoLanguage) => MonacoModel;
    setModelLanguage: (model: MonacoModel, language: MonacoLanguage) => void;
    setTheme: (themeName: 'vs' | 'vs-dark') => void;
  };
}

interface RequireWithConfig {
  (deps: string[], onLoad: () => void, onError?: (error: unknown) => void): void;
  config: (config: { paths: Record<string, string> }) => void;
}

declare global {
  interface Window {
    monaco?: MonacoApi;
    require?: RequireWithConfig;
  }
}

const DEFAULT_FILES: StudioFiles = {
  html: `<main class="container">
  <h1>fineSTEM Code Studio</h1>
  <p>支持 HTML / CSS / JS 三文件联调，也可切换 WebContainer 模式运行 Node.js。</p>
  <button id="demoBtn">点我触发日志</button>
</main>`,
  css: `body {
  margin: 0;
  font-family: "Segoe UI", sans-serif;
  background: #f8fafc;
}

.container {
  max-width: 720px;
  margin: 40px auto;
  padding: 24px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
}

h1 {
  color: #0f766e;
}`,
  js: `const button = document.getElementById("demoBtn");
button?.addEventListener("click", () => {
  console.log("Hello from fineSTEM studio");
});`,
};

const NODE_TEMPLATE_FILES: Record<string, string> = {
  'package.json': JSON.stringify({ name: 'finestem-project', type: 'module', scripts: { start: 'node index.js' } }, null, 2),
  'index.js': `console.log("Hello from WebContainer + Node.js!");\nconsole.log("Node version:", process.version);`,
};

function buildPreviewDoc(files: StudioFiles): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>${files.css}</style>
  </head>
  <body>
    ${files.html}
    <script>
      (function () {
        const send = function (payload) {
          window.parent.postMessage({ type: 'finestem-studio-log', payload: payload }, '*');
        };
        const originalLog = console.log;
        console.log = function () {
          const values = Array.from(arguments).map(function (item) {
            try { return typeof item === 'string' ? item : JSON.stringify(item); } catch { return String(item); }
          });
          send({ level: 'log', message: values.join(' ') });
          originalLog.apply(console, arguments);
        };
        window.addEventListener('error', function (event) {
          send({ level: 'error', message: event.message });
        });
        window.addEventListener('unhandledrejection', function (event) {
          send({ level: 'error', message: String(event.reason) });
        });
      })();
    </script>
    <script>${files.js}<\/script>
  </body>
</html>`;
}

function downloadText(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function loadMonacoFromCdn(): Promise<MonacoApi> {
  if (window.monaco) return window.monaco;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-monaco-loader="true"]');
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js';
    script.async = true;
    script.dataset.monacoLoader = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Monaco Loader 加载失败'));
    document.body.appendChild(script);
  });

  const req = window.require;
  if (!req) throw new Error('Monaco AMD Loader 不可用');

  req.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });

  await new Promise<void>((resolve, reject) => {
    req(['vs/editor/editor.main'], () => resolve(), (error) => reject(error));
  });

  if (!window.monaco) throw new Error('Monaco 初始化失败');
  return window.monaco;
}

async function bootWebContainer() {
  const { WebContainer } = await import('@webcontainer/api');
  const instance = await WebContainer.boot();
  return instance;
}

interface WcProcess {
  exit: Promise<number>;
  output: ReadableStream<string>;
}

export default function OnlineCodeStudio() {
  const [files, setFiles] = useState<StudioFiles>(DEFAULT_FILES);
  const [activeTab, setActiveTab] = useState<EditorTab>('html');
  const [autoRun, setAutoRun] = useState(true);
  const [theme, setTheme] = useState<'vs' | 'vs-dark'>('vs');
  const [previewDoc, setPreviewDoc] = useState<string>(buildPreviewDoc(DEFAULT_FILES));
  const [logs, setLogs] = useState<string[]>([]);
  const [editorState, setEditorState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [editorError, setEditorError] = useState('');
  const [runMode, setRunMode] = useState<RunMode>('iframe');
  const [wcStatus, setWcStatus] = useState<'idle' | 'booting' | 'running' | 'error'>('idle');
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const modelsRef = useRef<Record<EditorTab, MonacoModel> | null>(null);
  const runNowRef = useRef<(() => void) | null>(null);
  const wcRef = useRef<Awaited<ReturnType<typeof bootWebContainer>> | null>(null);

  useEffect(() => {
    if (!autoRun || runMode !== 'iframe') return;
    setPreviewDoc(buildPreviewDoc(files));
  }, [files, autoRun, runMode]);

  useEffect(() => {
    let disposed = false;
    const bootstrap = async () => {
      if (!editorContainerRef.current) return;
      try {
        const monaco = await loadMonacoFromCdn();
        if (disposed || !editorContainerRef.current) return;
        monacoRef.current = monaco;

        const models: Record<EditorTab, MonacoModel> = {
          html: monaco.editor.createModel(DEFAULT_FILES.html, 'html'),
          css: monaco.editor.createModel(DEFAULT_FILES.css, 'css'),
          js: monaco.editor.createModel(DEFAULT_FILES.js, 'javascript'),
        };
        modelsRef.current = models;

        const editor = monaco.editor.create(editorContainerRef.current, {
          model: models.html,
          minimap: { enabled: false },
          fontSize: 14,
          automaticLayout: true,
          roundedSelection: true,
          scrollBeyondLastLine: false,
          theme: 'vs',
          wordWrap: 'on',
        });
        editorRef.current = editor;
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          runNowRef.current?.();
        });
        editor.onDidChangeModelContent(() => {
          const allModels = modelsRef.current;
          if (!allModels) return;
          setFiles({
            html: allModels.html.getValue(),
            css: allModels.css.getValue(),
            js: allModels.js.getValue(),
          });
        });
        setEditorState('ready');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Monaco 初始化失败';
        setEditorError(message);
        setEditorState('error');
      }
    };
    void bootstrap();

    return () => {
      disposed = true;
      editorRef.current?.dispose();
      editorRef.current = null;
      const models = modelsRef.current;
      if (models) {
        models.html.dispose();
        models.css.dispose();
        models.js.dispose();
      }
      modelsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const models = modelsRef.current;
    const editor = editorRef.current;
    if (!models || !editor) return;
    editor.setModel(models[activeTab]);
    editor.layout();
  }, [activeTab]);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    monaco.editor.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; payload?: { level?: string; message?: string } } | null;
      if (!data || data.type !== 'finestem-studio-log') return;
      const level = data.payload?.level ?? 'log';
      const message = data.payload?.message ?? '';
      const line = `${new Date().toLocaleTimeString('zh-CN', { hour12: false })} [${level}] ${message}`;
      setLogs((prev) => [line, ...prev].slice(0, 80));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const runIframe = useCallback(() => {
    setLogs([]);
    setPreviewDoc(buildPreviewDoc(files));
  }, [files]);

  const runWebContainer = useCallback(async () => {
    setLogs([]);
    setWcStatus('booting');
    try {
      let wc = wcRef.current;
      if (!wc) {
        wc = await bootWebContainer();
        wcRef.current = wc;
      }

      const jsContent = files.js;
      await wc.mount({
        'package.json': { file: { contents: JSON.stringify({ name: 'finestem-project', type: 'module', scripts: { start: 'node index.js' } }, null, 2) } },
        'index.js': { file: { contents: jsContent } },
      });

      const installProcess = await wc.spawn('npm', ['install']);
      const installExit = await installProcess.exit;
      if (installExit !== 0) {
        setWcStatus('error');
        setLogs((prev) => [`${new Date().toLocaleTimeString('zh-CN', { hour12: false })} [error] npm install 失败，退出码: ${installExit}`, ...prev].slice(0, 80));
        return;
      }

      const runProcess = await wc.spawn('npm', ['start']);
      runProcess.output.pipeTo(new WritableStream({
        write(data) {
          const lines = data.split('\n').filter(Boolean);
          for (const line of lines) {
            const entry = `${new Date().toLocaleTimeString('zh-CN', { hour12: false })} [stdout] ${line}`;
            setLogs((prev) => [entry, ...prev].slice(0, 80));
          }
        },
      }));

      const exitCode = await runProcess.exit;
      if (exitCode !== 0) {
        setWcStatus('error');
      } else {
        setWcStatus('running');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'WebContainer 启动失败';
      setLogs((prev) => [`${new Date().toLocaleTimeString('zh-CN', { hour12: false })} [error] ${msg}`, ...prev].slice(0, 80));
      setWcStatus('error');
    }
  }, [files.js]);

  const runNow = useCallback(() => {
    if (runMode === 'webcontainer') {
      void runWebContainer();
    } else {
      runIframe();
    }
  }, [runMode, runIframe, runWebContainer]);

  runNowRef.current = runNow;

  useEffect(() => {
    const onSaveHotkey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        runNowRef.current?.();
      }
    };
    window.addEventListener('keydown', onSaveHotkey, true);
    return () => window.removeEventListener('keydown', onSaveHotkey, true);
  }, []);

  const resetTemplate = () => {
    setFiles(DEFAULT_FILES);
    setLogs([]);
    if (runMode === 'iframe') {
      setPreviewDoc(buildPreviewDoc(DEFAULT_FILES));
    }
    const models = modelsRef.current;
    if (models) {
      models.html.setValue(DEFAULT_FILES.html);
      models.css.setValue(DEFAULT_FILES.css);
      models.js.setValue(DEFAULT_FILES.js);
    }
  };

  const exportHtml = () => {
    downloadText('finestem-preview.html', buildPreviewDoc(files));
  };

  const TABS: Array<{ key: EditorTab; label: string }> = [
    { key: 'html', label: 'HTML' },
    { key: 'css', label: 'CSS' },
    { key: 'js', label: 'JavaScript' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">在线代码编辑器</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 border rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => setRunMode('iframe')}
              className={`text-xs px-3 py-1 ${runMode === 'iframe' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600'}`}
            >
              iframe 预览
            </button>
            <button
              type="button"
              onClick={() => setRunMode('webcontainer')}
              className={`text-xs px-3 py-1 ${runMode === 'webcontainer' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600'}`}
            >
              WebContainer (Node.js)
            </button>
          </div>
          <label className="text-sm text-gray-700 flex items-center gap-2">
            <input type="checkbox" checked={autoRun} onChange={(event) => setAutoRun(event.target.checked)} />
            自动运行
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setTheme((prev) => (prev === 'vs' ? 'vs-dark' : 'vs'))}
          >
            主题：{theme === 'vs' ? '亮色' : '暗色'}
          </Button>
          <Button variant="secondary" size="sm" onClick={runNow}>
            {runMode === 'webcontainer' && wcStatus === 'booting' ? '启动中...' : '运行'}
          </Button>
          <Button variant="secondary" size="sm" onClick={resetTemplate}>重置模板</Button>
          {runMode === 'iframe' && <Button size="sm" onClick={exportHtml}>导出HTML</Button>}
        </div>
      </div>

      {runMode === 'webcontainer' && (
        <div className={`text-xs px-3 py-1.5 rounded ${
          wcStatus === 'booting' ? 'bg-yellow-50 text-yellow-700' :
          wcStatus === 'running' ? 'bg-green-50 text-green-700' :
          wcStatus === 'error' ? 'bg-red-50 text-red-700' :
          'bg-gray-50 text-gray-500'
        }`}>
          {wcStatus === 'idle' && 'WebContainer 就绪，点击"运行"启动 Node.js 环境'}
          {wcStatus === 'booting' && 'WebContainer 正在启动...'}
          {wcStatus === 'running' && 'WebContainer 运行中'}
          {wcStatus === 'error' && 'WebContainer 运行出错，请检查 JS 代码'}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="mb-3">
            <CardTitle className="text-base">编辑区</CardTitle>
            <div className="flex gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`text-xs px-3 py-1 rounded-full border ${
                    activeTab === tab.key
                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {editorState === 'error' ? (
              <div className="w-full min-h-[420px] border rounded p-3 text-sm text-red-600 bg-red-50">
                Monaco 加载失败：{editorError}
              </div>
            ) : (
              <>
                {editorState === 'loading' && (
                  <div className="text-sm text-gray-500 mb-2">Monaco 编辑器加载中...</div>
                )}
                <div ref={editorContainerRef} className="w-full min-h-[420px] border rounded overflow-hidden" />
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {runMode === 'iframe' && (
            <Card>
              <CardHeader className="mb-2">
                <CardTitle className="text-base">运行预览</CardTitle>
              </CardHeader>
              <CardContent>
                <iframe
                  title="code-preview"
                  className="w-full min-h-[420px] border rounded"
                  sandbox="allow-scripts"
                  srcDoc={previewDoc}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="mb-2">
              <CardTitle className="text-base">
                {runMode === 'webcontainer' ? 'Node.js 输出' : '控制台输出'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`overflow-auto rounded border border-gray-200 bg-gray-950 text-gray-100 p-3 text-xs font-mono ${
                runMode === 'webcontainer' ? 'min-h-[420px] max-h-[560px]' : 'min-h-[140px] max-h-[220px]'
              }`}>
                {logs.length === 0 ? (
                  <div className="text-gray-400">
                    {runMode === 'webcontainer'
                      ? '暂无输出。点击"运行"启动 Node.js 执行。'
                      : '暂无输出。点击"运行"或触发脚本行为查看日志。'}
                  </div>
                ) : (
                  logs.map((line, idx) => <div key={`${line}-${idx}`}>{line}</div>)
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
