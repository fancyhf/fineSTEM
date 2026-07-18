import React, { useState, useEffect, useCallback } from 'react';
import { FileText, FileCode, Download, Folder, ChevronRight, ChevronDown, Loader2, Package, X, MessageSquare, Code2 } from 'lucide-react';
import { projectsApi } from '../services/api';
import { ProjectDocument, FileEntry } from '../types';

interface ChatCodeSnippet {
  id: string;
  language: string;
  preview: string; // first meaningful line
  fullCode: string; // complete code for loading into editor
  priority: number; // lower = higher priority (0=best)
}

interface ProjectFilesPanelProps {
  projectId: string;
  projectName: string;
  projectMode: string;
  currentStage: string;
  files: FileEntry[];
  activeFileName: string;
  chatMessages?: Array<{ role?: unknown; content?: unknown }>;
  onSelectFile: (file: FileEntry) => void;
  onExportZip: () => void;
  onClose?: () => void;
}

/**
 * 项目资源面板
 * 用途：展示项目文件树、阶段文档列表、聊天代码片段、导出功能
 * 维护者：AI Agent
 * links: .trae/documents/api-specs/v1/spec.json#projects-documents
 */
export const ProjectFilesPanel: React.FC<ProjectFilesPanelProps> = ({
  projectId,
  projectName,
  projectMode,
  currentStage,
  files,
  activeFileName,
  chatMessages = [],
  onSelectFile,
  onExportZip,
  onClose,
}) => {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    files: true,
    docs: true,
    chatCode: true,
    export: false,
  });
  const [viewingDoc, setViewingDoc] = useState<{ stage: string; name: string; content: string } | null>(null);
  const [chatSnippets, setChatSnippets] = useState<ChatCodeSnippet[]>([]);

  // 从聊天记录中提取代码片段（过滤JSON，优先源码语言）
  useEffect(() => {
    if (!chatMessages || chatMessages.length === 0) return;
    const allSnippets: ChatCodeSnippet[] = [];
    let snippetIndex = 0;

    // 语言优先级：真实源码语言优先，JSON/文本排后
    const langPriority: Record<string, number> = {
      python: 0, py: 0,
      streamlit: 1,
      html: 2, javascript: 2, js: 2, css: 2,
      typescript: 3, ts: 3, tsx: 3, jsx: 3,
      text: 10, json: 99, // JSON 几乎不展示
    };

    // 判断是否为JSON内容（step_plan等数据，非源码）
    const isJsonContent = (code: string): boolean => {
      const trimmed = code.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) return true;
      // 检查是否有典型的JSON键名模式
      if (/^\s*["']?(report_theme|use_theme|milestone|step_plan|project_brief|constraints|track|design)/.test(trimmed)) return true;
      return false;
    };

    for (let i = chatMessages.length - 1; i >= Math.max(0, chatMessages.length - 80); i--) {
      const msg = chatMessages[i];
      if (!msg || msg.role !== 'assistant') continue;
      const content = typeof msg.content === 'string' ? msg.content : '';
      const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
      let match;
      while ((match = codeBlockRegex.exec(content)) !== null && allSnippets.length < 20) {
        const rawLang = (match[1] || 'text').toLowerCase().trim();
        const code = match[2];
        if (code.trim().length < 8) continue;

        // 跳过纯JSON内容（step_plan等结构化数据）
        if (isJsonContent(code)) continue;

        // 标准化语言标识
        let lang = rawLang;
        if (rawLang === '' && (code.includes('import ') || code.includes('def ') || code.includes('print('))) {
          lang = 'python';
        }
        if (rawLang === '' && (code.includes('<html') || code.includes('<div') || code.includes('<!DOCTYPE'))) {
          lang = 'html';
        }

        const priority = langPriority[lang] ?? 5;
        const lines = code.split('\n').filter(l => l.trim());

        // 找第一行有意义的预览（跳过空行和注释头）
        let preview = '';
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          if (t.startsWith('#') || t.startsWith('//') || t.startsWith('/*')) continue;
          preview = t.substring(0, 45) + (t.length > 45 ? '...' : '');
          break;
        }
        if (!preview) preview = lines[0]?.trim()?.substring(0, 45) + '...' || '(代码块)';

        allSnippets.push({
          id: `snippet-${i}-${snippetIndex++}`,
          language: lang,
          preview,
          fullCode: code,
          priority,
        });
      }
    }

    // 按优先级排序：源码在前，低优先级在后，最多取10个
    allSnippets.sort((a, b) => a.priority - b.priority);
    setChatSnippets(allSnippets.slice(0, 10));
  }, [chatMessages]);

  // 加载项目阶段文档列表
  const loadDocuments = useCallback(async () => {
    if (!projectId) return;
    setLoadingDocs(true);
    try {
      const res = await projectsApi.listDocuments(projectId);
      setDocuments(res.data || []);
    } catch (error) {
      console.error('[ProjectFilesPanel] 加载文档列表失败:', error);
    } finally {
      setLoadingDocs(false);
    }
  }, [projectId]);

  useEffect(() => {
    // 2026-07-18 修复：只要有 projectId 就预取文档列表，不依赖 docs 是否展开。
    // 此前依赖 expandedSections.docs，导致默认折叠时用户以为"没文档"（实际后端有）。
    // 渲染仍受折叠控制——数据预取只影响再展开时的速度和"计数"显示。
    if (projectId) {
      loadDocuments();
    }
  }, [projectId, loadDocuments]);

  // 查看文档内容
  const handleViewDoc = useCallback(async (stage: string, name: string) => {
    try {
      const res = await projectsApi.getDocument(projectId, stage);
      if (res.data) {
        setViewingDoc({ stage, name, content: res.data.content || '(此文档暂无内容)' });
      }
    } catch (error) {
      console.error('[ProjectFilesPanel] 加载文档内容失败:', error);
      setViewingDoc({ stage, name, content: '加载失败' });
    }
  }, [projectId]);

  // 从聊天代码片段加载完整代码到编辑器
  const handleSelectChatSnippet = useCallback((snippetId: string) => {
    const snippet = chatSnippets.find(s => s.id === snippetId);
    if (!snippet) return;
    const extMap: Record<string, string> = {
      python: 'py', py: 'py', streamlit: 'py',
      html: 'html', javascript: 'js', js: 'js', css: 'css',
      typescript: 'ts', ts: 'ts',
    };
    onSelectFile({
      name: `chat_${snippetId.slice(0, 8)}.${extMap[snippet.language] || 'txt'}`,
      language: snippet.language,
      content: snippet.fullCode,
      is_main: true,
    });
  }, [chatSnippets, onSelectFile]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 获取语言图标颜色
  const getLanguageColor = (lang: string): string => {
    const colors: Record<string, string> = {
      python: 'text-blue-500',
      html: 'text-orange-500',
      javascript: 'text-yellow-500',
      css: 'text-purple-500',
      json: 'text-yellow-600',
      text: 'text-gray-400',
    };
    return colors[lang] || 'text-gray-400';
  };

  // 阶段进度计算
  const stageOrder = [
    'stage_01_brainstorm', 'stage_02_opening', 'stage_03_scope', 'stage_04_track',
    'stage_05_design', 'stage_06_plan', 'stage_07_execute', 'stage_08_review',
  ];
  const stageLabels: Record<string, string> = {
    stage_01_brainstorm: '选题',
    stage_02_opening: '立项',
    stage_03_scope: '范围',
    stage_04_track: '技术',
    stage_05_design: '设计',
    stage_06_plan: '计划',
    stage_07_execute: '编码',
    stage_08_review: '验收',
  };
  const currentStageIndex = stageOrder.indexOf(currentStage);
  const docsHaveContent = documents.some(d => d.has_content);

  return (
    <div className="h-full flex flex-col bg-gray-50 border-r border-gray-200 overflow-hidden">
      {/* 项目信息头部 */}
      <div className="px-3 py-2.5 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-1.5 mb-1">
          <Folder className="w-3.5 h-3.5 text-teal-500" />
          <span className="text-xs font-semibold text-gray-700 truncate flex-1">{projectName || '未命名项目'}</span>
          {onClose && (
            <button onClick={onClose} className="p-0.5 hover:bg-gray-200 rounded text-gray-400 transition-colors" title="关闭面板">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-400">
          <span className={`px-1.5 py-0.5 rounded ${projectMode === 'standard' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
            {projectMode === 'standard' ? '标准' : '轻量'}
          </span>
          {currentStage && stageLabels[currentStage] && (
            <span>当前: {stageLabels[currentStage]}</span>
          )}
        </div>
        {/* 阶段进度条 */}
        <div className="mt-1.5 flex items-center gap-1">
          {stageOrder.map((stage, i) => (
            <React.Fragment key={stage}>
              <div
                className={`h-1 flex-1 rounded-full ${i <= currentStageIndex ? 'bg-teal-400' : 'bg-gray-200'}`}
                title={stageLabels[stage] || stage}
              />
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 可滚动内容区 */}
      <div className="flex-1 overflow-y-auto">
        {/* 代码文件区 */}
        <div className="border-b border-gray-100">
          <button
            onClick={() => toggleSection('files')}
            className="w-full flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {expandedSections.files ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <FileCode className="w-3.5 h-3.5 text-gray-400" />
            <span>代码文件</span>
            <span className="ml-auto text-[10px] text-gray-400">{files.length || 1}</span>
          </button>
          {expandedSections.files && (
            <div className="pb-1">
              {files.length > 0 ? (
                files.map((file, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectFile(file)}
                    className={`w-full flex items-center gap-1.5 px-5 py-1.5 text-xs transition-colors ${
                      activeFileName === file.name ? 'bg-teal-50 text-teal-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <FileCode className={`w-3 h-3 ${getLanguageColor(file.language)}`} />
                    <span className="truncate">{file.name}</span>
                    {file.is_main && <span className="text-[9px] text-teal-500 ml-auto">主</span>}
                  </button>
                ))
              ) : (
                /* 单文件模式：显示当前编辑器中的代码 */
                <div className="px-5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 cursor-pointer flex items-center gap-1.5"
                  onClick={() => onSelectFile({ name: 'main.py', language: 'python', content: '', is_main: true })}
                >
                  <FileCode className="w-3 h-3 text-blue-500" />
                  <span>main.py</span>
                  <span className="text-[9px] text-teal-500 ml-auto">主</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 聊天中的代码片段 */}
        {chatSnippets.length > 0 && (
          <div className="border-b border-gray-100">
            <button
              onClick={() => toggleSection('chatCode')}
              className="w-full flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {expandedSections.chatCode ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <span>对话中的代码</span>
              <span className="ml-auto text-[10px] text-gray-400">{chatSnippets.length} 段</span>
            </button>
            {expandedSections.chatCode && (
              <div className="pb-1 max-h-[200px] overflow-y-auto">
                {chatSnippets.map((snip) => (
                  <button
                    key={snip.id}
                    onClick={() => handleSelectChatSnippet(snip.id)}
                    className="w-full flex items-center gap-1.5 px-5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <Code2 className={`w-3 h-3 ${getLanguageColor(snip.language)}`} />
                    <span className="truncate flex-1 text-left">{snip.preview}</span>
                    <span className="text-[9px] text-gray-300 ml-1">{snip.language}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 阶段文档区 */}
        <div className="border-b border-gray-100">
          <button
            onClick={() => toggleSection('docs')}
            className="w-full flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {expandedSections.docs ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            <span>阶段文档</span>
            {loadingDocs && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
            <span className="ml-auto text-[10px] text-gray-400">{docsHaveContent ? documents.filter(d => d.has_content).length : '-'}</span>
          </button>
          {expandedSections.docs && (
            <div className="pb-1">
              {documents.length === 0 && !loadingDocs ? (
                <div className="px-5 py-3 text-[11px] text-gray-400 leading-relaxed">
                  <p>项目还在早期阶段，</p>
                  <p className="mt-0.5">暂无阶段文档。</p>
                  <p className="mt-1 text-gray-300">继续与 AI 对话推进项目后自动生成</p>
                </div>
              ) : loadingDocs ? (
                <div className="px-5 py-3 text-[11px] text-gray-400">
                  正在加载文档...
                </div>
              ) : !docsHaveContent ? (
                <div className="px-5 py-3 text-[11px] text-gray-400 leading-relaxed">
                  <p>所有文档待生成</p>
                  <p className="mt-0.5 text-gray-300">完成对应阶段后自动填充</p>
                </div>
              ) : (
                documents.map((doc) => (
                  <button
                    key={doc.stage}
                    onClick={() => doc.has_content && handleViewDoc(doc.stage, doc.name)}
                    disabled={!doc.has_content}
                    className={`w-full flex items-center gap-1.5 px-5 py-1.5 text-xs transition-colors ${
                      doc.has_content ? 'text-gray-600 hover:bg-gray-100 cursor-pointer' : 'text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <FileText className={`w-3 h-3 ${doc.has_content ? 'text-green-500' : 'text-gray-300'}`} />
                    <span className="truncate">{doc.name}</span>
                    {doc.has_content && <span className="text-[9px] text-gray-400 ml-auto">✓</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* 导出区 */}
        <div>
          <button
            onClick={() => toggleSection('export')}
            className="w-full flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {expandedSections.export ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <Package className="w-3.5 h-3.5 text-gray-400" />
            <span>导出项目</span>
          </button>
          {expandedSections.export && (
            <div className="pb-1">
              <button
                onClick={onExportZip}
                className="w-full flex items-center gap-1.5 px-5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Download className="w-3 h-3 text-teal-500" />
                <span>下载资料包 (ZIP)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 文档查看模态框 */}
      {viewingDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setViewingDoc(null); }}
        >
          <div className="w-[80vw] h-[80vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700">{viewingDoc.name}</span>
              <button
                onClick={() => setViewingDoc(null)}
                className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-200 rounded"
              >
                关闭
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                {viewingDoc.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
