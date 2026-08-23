import React, { useRef, useCallback, useEffect } from 'react';
import Editor, { OnMount, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { needsAutoFormat, formatCode } from '../lib/codeFormat';

loader.init().then((monacoInstance) => {
  monacoInstance.editor.defineTheme('fineSTEM-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: { 'editor.background': '#1e1e2e' },
  });
});

interface CodeEditorProps {
  code: string;
  language: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  /** Ctrl/Cmd+S 快捷保存（2026-08-16：编辑器无保存入口，学生不知道改动已保存） */
  onSaveShortcut?: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  language,
  onChange,
  readOnly = false,
  onSaveShortcut,
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  // 快捷键回调走 ref，避免每次渲染重新 addCommand
  const saveShortcutRef = useRef(onSaveShortcut);
  useEffect(() => { saveShortcutRef.current = onSaveShortcut; }, [onSaveShortcut]);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.updateOptions({
      fontSize: 14,
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      tabSize: 4,
      automaticLayout: true,
      padding: { top: 12 },
    });
    // Ctrl/Cmd+S：交给上层保存，并阻止浏览器默认"保存网页"行为
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveShortcutRef.current?.();
    });
  };

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (onChange && value !== undefined) {
        onChange(value);
      }
    },
    [onChange]
  );

  // 2026-08-16 修复"HTML 挤在一行"：挂载/换值时发现严重单行代码就自动格式化一次，
  // 结果经 onChange 回传父组件（editorCode 更新 → 自动保存写回 workspace，存量自愈）。
  // 每次键入也会进这里，但 needsAutoFormat 是两次除法，开销可忽略；格式化后即不再命中。
  useEffect(() => {
    if (readOnly || !onChange) return;
    if (!needsAutoFormat(code, language)) return;
    const formatted = formatCode(code, language);
    if (formatted && formatted !== code) {
      onChange(formatted);
    }
  }, [code, language, onChange, readOnly]);

  const monacoLanguage =
    language === 'python'
      ? 'python'
      : language === 'javascript'
        ? 'javascript'
        : language === 'html'
          ? 'html'
          : language === 'css'
            ? 'css'
            : 'plaintext';

  return (
    <div className="h-full w-full min-h-0" data-testid="code-editor">
      <Editor
        height="100%"
        defaultLanguage={monacoLanguage}
        language={monacoLanguage}
        value={code}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme="vs-dark"
        options={{
          readOnly,
          fontSize: 14,
          lineNumbers: 'on',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 4,
          automaticLayout: true,
          padding: { top: 12 },
        }}
      />
    </div>
  );
};
