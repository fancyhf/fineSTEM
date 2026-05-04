import React, { useRef, useCallback } from 'react';
import Editor, { OnMount, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

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
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  language,
  onChange,
  readOnly = false,
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

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
  };

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (onChange && value !== undefined) {
        onChange(value);
      }
    },
    [onChange]
  );

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
    <div className="h-full w-full">
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
