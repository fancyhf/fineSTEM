import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquare, Code, Rocket, FileText, ChevronUp, Paperclip, Link2, FolderOpen, Plus, Sparkles, User, Settings, Zap, ClipboardList, FileCode, Image, Play, Copy, Check, ArrowRight, BookOpen, PanelLeftClose, PanelLeftOpen, Terminal, Eye, ChevronDown, Pencil, MoreHorizontal } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useStreamingChat } from '../hooks/useStreamingChat';
import { MarkdownText } from '../components/MarkdownText';
import { LightRegisterPrompt } from '../components/LightRegisterPrompt';
import { CodePreview } from '../components/CodePreview';
import { QuestionCard, QuestionData } from '../components/QuestionCard';
import { useAuth } from '../contexts/AuthContext';
import { projectsApi, codeExecutionApi } from '../services/api';

const CodeEditor = lazy(() => import('../components/CodeEditor').then(m => ({ default: m.CodeEditor })));

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  skillInfo?: { skill_id: string; skill_name: string; sub_skill_name?: string };
  toolCalls?: { tool_name: string; success: boolean; data?: any }[];
}

interface ProjectContext {
  projectId: string | null;
  projectName: string;
  mode: 'light' | 'standard' | null;
  currentStage: string;
  stageProgress: number;
  evidenceCount: number;
  teachingMode: string;
}

interface SkillOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const SKILL_OPTIONS: SkillOption[] = [
  {
    id: 'stem-pbl-guide',
    name: 'STEM PBL 研学导师',
    description: '引导学生走完选题→开题→设计→编码→验收的完整 PBL 研学流程',
    icon: <Rocket className="w-4 h-4" />,
  },
  {
    id: 'coding-tutor',
    name: '编程学习助手',
    description: '解答编程问题、解释代码、提供学习建议',
    icon: <Code className="w-4 h-4" />,
  },
  {
    id: 'qa-mentor',
    name: 'STEM 问题咨询',
    description: '回答科学、技术、工程、数学相关问题',
    icon: <MessageSquare className="w-4 h-4" />,
  },
  {
    id: 'writing-assistant',
    name: '文档撰写助手',
    description: '帮助撰写研究报告、论文、成果文档',
    icon: <FileText className="w-4 h-4" />,
  },
];

const SCENE_ENTRIES = [
  { icon: MessageSquare, label: '问问题', desc: 'STEM 相关问题咨询' },
  { icon: Code, label: '解释代码', desc: '代码分析与讲解' },
  { icon: Rocket, label: '开始项目', desc: '从 Demo Fork 或新建' },
  { icon: FileText, label: '写报告', desc: '论文与成果文档撰写' },
];

const CODEX_SUGGESTIONS = [
  '我想做一个项目，帮我选题',
  '帮我用 Python 写一个简单的计算器程序',
  '分析这段代码的时间复杂度，并给出优化建议',
];

const LIGHT_STEPS = [
  { key: 'step_1', label: '想法与方向', icon: '💡' },
  { key: 'step_2', label: '设计与实现', icon: '🔨' },
  { key: 'step_3', label: '展示与反思', icon: '🏆' },
];

const STANDARD_STAGES = [
  { key: 'stage_00', label: '初始化', icon: '🚀' },
  { key: 'stage_01', label: '脑爆选题', icon: '💭' },
  { key: 'stage_02', label: '开题立项', icon: '📋' },
  { key: 'stage_03', label: '范围裁剪', icon: '✂️' },
  { key: 'stage_04', label: '轨道选择', icon: '🛤️' },
  { key: 'stage_05', label: '设计蓝图', icon: '📐' },
  { key: 'stage_06', label: '分步计划', icon: '📝' },
  { key: 'stage_07', label: '编码实现', icon: '💻' },
  { key: 'stage_08', label: '验收展示', icon: '🎯' },
];

const DEFAULT_CODE = `# 在这里写代码，或让 AI 生成代码后点击"写入编辑器"
# 试试输入："帮我用 Python 写一个猜数字游戏"

def hello():
    print("Hello, fineSTEM!")

hello()
`;

function StageProgressBar({ projectContext }: { projectContext: ProjectContext }) {
  if (!projectContext.mode) return null;
  const steps = projectContext.mode === 'light' ? LIGHT_STEPS : STANDARD_STAGES;
  const currentIdx = steps.findIndex(s => projectContext.currentStage.startsWith(s.key));
  return (
    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
      <div className="flex items-center gap-1">
        {steps.map((step, idx) => (
          <React.Fragment key={step.key}>
            {idx > 0 && <div className={`flex-1 h-0.5 ${idx <= currentIdx ? 'bg-teal-400' : 'bg-gray-200'}`} />}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
              idx < currentIdx ? 'bg-teal-100 text-teal-700' : idx === currentIdx ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-400'
            }`}>
              <span>{step.icon}</span>
              <span className="hidden xl:inline">{step.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function CodeBlock({ code, language, onWriteToEditor, onRun }: { code: string; language: string; onWriteToEditor: () => void; onRun: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }, [code]);
  return (
    <div className="relative group my-2">
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 text-gray-400 text-xs">
          <span>{language}</span>
          <div className="flex items-center gap-1">
            <button onClick={handleCopy} className="flex items-center gap-1 px-2 py-0.5 hover:bg-gray-700 rounded text-gray-300 transition-colors">
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              {copied ? '已复制' : '复制'}
            </button>
            <button onClick={onRun} className="flex items-center gap-1 px-2 py-0.5 hover:bg-gray-700 rounded text-green-300 transition-colors">
              <Play className="w-3 h-3" /> 运行
            </button>
            <button onClick={onWriteToEditor} className="flex items-center gap-1 px-2 py-0.5 hover:bg-gray-700 rounded text-blue-300 transition-colors">
              <ArrowRight className="w-3 h-3" /> 写入编辑器
            </button>
          </div>
        </div>
        <pre className="p-3 overflow-x-auto text-sm"><code className="text-gray-100">{code}</code></pre>
      </div>
    </div>
  );
}

function parseQuestionFromText(text: string): QuestionData | null {
  const qMatch = text.match(/<question[^>]*>/);
  if (!qMatch) return null;
  const qTagMatch = text.match(/<question[^>]*title=["']([^"']*)["']/);
  const title = qTagMatch ? qTagMatch[1] : '请选择';
  const options: { id: string; label: string; description?: string }[] = [];
  const optRegex = /<option\s+id=["']([^"']*)["'][^>]*?(?:label=["']([^"']*)["'])?[^>]*>(.*?)<\/option>/gs;
  let optMatch;
  while ((optMatch = optRegex.exec(text)) !== null) {
    const optId = optMatch[1];
    const attrLabel = optMatch[2]?.trim() || '';
    const rawBody = (optMatch[3] || '').trim();
    const childLabelMatch = rawBody.match(/<label>([\s\S]*?)<\/label>/i);
    const descMatch = rawBody.match(/<desc>([\s\S]*?)<\/desc>/i);
    let finalLabel: string;
    if (attrLabel) {
      finalLabel = attrLabel;
    } else if (childLabelMatch) {
      finalLabel = childLabelMatch[1].trim().split('\n')[0]?.slice(0, 100) || attrLabel || `选项${options.length + 1}`;
    } else {
      finalLabel = rawBody.replace(/<\/?(?:label|desc)[^>]*>/gi, '').trim().split('\n')[0]?.slice(0, 100) || `选项${options.length + 1}`;
    }
    const description = descMatch ? descMatch[1].trim().slice(0, 200) : undefined;
    options.push({ id: optId, label: finalLabel, description });
  }
  if (options.length === 0) return null;
  return { id: `q-fallback-${Date.now()}`, title, options };
}

function EnhancedMarkdownText({ content, onWriteCode, onRunCode }: { content: string; onWriteCode: (code: string, lang: string) => void; onRunCode: (code: string, lang: string) => void }) {
  const parts: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push(<MarkdownText key={key++} content={content.slice(lastIndex, match.index)} />);
    const language = match[1] || 'text';
    const code = match[2].trim();
    parts.push(<CodeBlock key={key++} code={code} language={language} onWriteToEditor={() => onWriteCode(code, language)} onRun={() => onRunCode(code, language)} />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) parts.push(<MarkdownText key={key++} content={content.slice(lastIndex)} />);
  return <>{parts}</>;
}

function EditorLoading() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-[#1e1e1e]">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-400">加载编辑器...</p>
      </div>
    </div>
  );
}

function buildHtmlFromCode(code: string, language: string): string {
  if (language === 'html') return code;
  if (language === 'javascript' || language === 'js') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>${code}<\/script></body></html>`;
  }
  return `<pre class="p-4 bg-gray-50 rounded text-sm overflow-x-auto"><code>${code.replace(/</g, '&lt;')}</code></pre>`;
}

function buildExecutionResultHtml(result: { success: boolean; output: string; error?: string }, code: string): string {
  const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapedOutput = (result.output || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapedError = (result.error || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px;">
      <div style="margin-bottom: 12px; padding: 8px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 13px;">
        <span style="color: #16a34a;">✓ 代码执行${result.success ? '成功' : '完成'} (退出码: ${result.exit_code ?? 0})</span>
      </div>
      ${result.output ? `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">📤 输出结果：</div>
        <pre style="background: #fafafa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; overflow-x: auto;">${escapedOutput}</pre>
      </div>` : ''}
      ${result.error ? `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 12px; color: #dc2626; margin-bottom: 4px;">⚠ 错误/警告：</div>
        <pre style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; overflow-x: auto; color: #dc2626;">${escapedError}</pre>
      </div>` : ''}
    </div>
  `;
}

function buildErrorHtml(message: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px; text-align: center;">
      <div style="padding: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #dc2626; font-size: 14px;">
        ⚠ ${message}
      </div>
    </div>
  `;
}

export function Create() {
  const { stream } = useStreamingChat();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeScene, setActiveScene] = useState<string | null>(null);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [projectContext, setProjectContext] = useState<ProjectContext>({
    projectId: null, projectName: '', mode: null, currentStage: '', stageProgress: 0, evidenceCount: 0, teachingMode: 'guided',
  });
  const [userProjects, setUserProjects] = useState<Array<{id: string; name: string; mode: string; current_stage?: string}>>([]);

  const [editorCode, setEditorCode] = useState(DEFAULT_CODE);
  const [editorLanguage, setEditorLanguage] = useState('python');
  const [previewHtml, setPreviewHtml] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editorTab, setEditorTab] = useState<'code' | 'preview'>('code');
  const [runningCode, setRunningCode] = useState(false);
  const [activeSkill, setActiveSkill] = useState<SkillOption>(SKILL_OPTIONS[0]);
  const [showSkillSelector, setShowSkillSelector] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [moreMenuProjectId, setMoreMenuProjectId] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<QuestionData | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const messageSeqRef = useRef(0);
  const handleSendRef = useRef<typeof handleSend>(null! as unknown as typeof handleSend);

  useEffect(() => {
    if (user) {
      loadUserProjects();
    }
  }, [user]);

  useEffect(() => { const q = searchParams.get('q'); if (q && messages.length === 0) handleSend(q); }, [searchParams]);
  useEffect(() => { if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'; } }, [inputValue]);

  const codeSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!projectContext.projectId || !projectContext.projectId.startsWith('local-')) return;
    if (codeSaveTimerRef.current) clearTimeout(codeSaveTimerRef.current);
    codeSaveTimerRef.current = setTimeout(() => {
      projectsApi.saveCode(projectContext.projectId, { code: editorCode, language: editorLanguage }).catch(() => {});
    }, 2000);
    return () => { if (codeSaveTimerRef.current) clearTimeout(codeSaveTimerRef.current); };
  }, [editorCode, projectContext.projectId, editorLanguage]);

  const loadUserProjects = useCallback(async () => {
    try {
      console.log('[loadUserProjects] 正在加载项目列表...');
      const res = await projectsApi.list({ page: 1, page_size: 20 });
      console.log('[loadUserProjects] API响应:', res);
      if (res.data?.items) {
        setUserProjects(res.data.items.map(p => ({
          id: p.id,
          name: p.name,
          mode: p.mode,
          current_stage: p.current_stage,
        })));
        console.log('[loadUserProjects] 已加载', res.data.items.length, '个项目');
      }
    } catch (error) {
      console.error('[loadUserProjects] 加载项目列表失败:', error);
    }
  }, []);

  const createProjectViaAPI = useCallback(async (name: string, mode: 'light' | 'standard' = 'light') => {
    if (!user) {
      console.warn('[createProject] 未登录，无法调用项目创建API');
      return null;
    }
    try {
      console.log('[createProject] 正在调用API创建项目:', { name, mode, userId: user.id });
      const res = await projectsApi.create({ name, mode });
      console.log('[createProject] API响应:', JSON.stringify(res));
      if (res.data) {
        await loadUserProjects();
        return res.data;
      }
      console.warn('[createProject] API响应中无data字段');
      return null;
    } catch (error) {
      console.error('[createProject] 创建项目失败:', error);
      return null;
    }
  }, [user, loadUserProjects]);

  const nextMessageId = () => { messageSeqRef.current += 1; return String(messageSeqRef.current); };

  const startEditProject = useCallback((projId: string, currentName: string) => {
    setEditingProjectId(projId);
    setEditProjectName(currentName);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }, []);

  const saveEditProject = useCallback(async () => {
    if (!editingProjectId || !editProjectName.trim()) {
      cancelEditProject();
      return;
    }
    const newName = editProjectName.trim();
    const isLocalProject = editingProjectId.startsWith('local-');
    try {
      if (!isLocalProject && user) {
        await projectsApi.update(editingProjectId, { name: newName });
        setUserProjects(prev => prev.map(p => p.id === editingProjectId ? { ...p, name: newName } : p));
      }
      setProjectContext(prev => ({ ...prev, projectName: newName }));
    } catch (error) {
      console.error('更新项目名称失败:', error);
      if (isLocalProject) {
        setProjectContext(prev => ({ ...prev, projectName: newName }));
      }
    }
    setEditingProjectId(null);
    setEditProjectName('');
  }, [editingProjectId, editProjectName, user]);

  const cancelEditProject = useCallback(() => {
    setEditingProjectId(null);
    setEditProjectName('');
  }, []);

  const handleQuestionAnswer = useCallback((selectedIds: string[], customText?: string) => {
    const question = pendingQuestion;
    if (!question) return;

    const selectedLabels = selectedIds
      .map(id => question.options.find(o => o.id === id)?.label || id)
      .filter(Boolean);

    let answerText = selectedLabels.join('、');
    if (customText) {
      answerText = answerText ? `${answerText}（其他：${customText}）` : customText;
    }

    const sendText = `[选择] ${question.title}\n回答：${answerText}`;
    setPendingQuestion(null);
    setInputValue('');
    setIsLoading(false);
    setTimeout(() => handleSendRef.current(sendText), 50);
  }, [pendingQuestion]);

  const dismissQuestion = useCallback(() => {
    setPendingQuestion(null);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuProjectId) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-more-menu]')) {
          setMoreMenuProjectId(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreMenuProjectId]);

  const handleWriteCodeToEditor = useCallback((code: string, language: string) => {
    setEditorCode(code);
    setEditorLanguage(language === 'python' ? 'python' : language === 'javascript' ? 'javascript' : language === 'html' ? 'html' : 'plaintext');
    setShowEditor(true);
    setEditorTab('code');
  }, []);

  const handleRunCode = useCallback(async (code: string, language: string) => {
    setEditorCode(code);
    setEditorLanguage(language === 'python' ? 'python' : language === 'javascript' ? 'javascript' : language === 'html' ? 'html' : 'plaintext');
    setShowEditor(true);
    
    if (language === 'python' || language === 'py') {
      setRunningCode(true);
      try {
        const result = await codeExecutionApi.execute(code, 'python');
        const outputHtml = buildExecutionResultHtml(result.data, code);
        setPreviewHtml(outputHtml);
      } catch (error) {
        console.error('代码执行失败:', error);
        setPreviewHtml(buildErrorHtml('连接服务器失败，请稍后重试'));
      } finally {
        setRunningCode(false);
      }
      setEditorTab('preview');
    } else {
      const html = buildHtmlFromCode(code, language);
      setPreviewHtml(html);
      setEditorTab('preview');
    }
  }, []);

  const handleRunEditorCode = useCallback(async () => {
    if (editorLanguage === 'python' || editorLanguage === 'py') {
      setRunningCode(true);
      try {
        const result = await codeExecutionApi.execute(editorCode, 'python');
        const outputHtml = buildExecutionResultHtml(result.data, editorCode);
        setPreviewHtml(outputHtml);
      } catch (error) {
        console.error('代码执行失败:', error);
        setPreviewHtml(buildErrorHtml('连接服务器失败，请稍后重试'));
      } finally {
        setRunningCode(false);
      }
      setEditorTab('preview');
    } else {
      const html = buildHtmlFromCode(editorCode, editorLanguage);
      setPreviewHtml(html);
      setEditorTab('preview');
    }
  }, [editorCode, editorLanguage]);

  const extractCodeFromResponse = useCallback((content: string): { code: string; language: string } | null => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const matches: Array<{ code: string; language: string }> = [];
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();
      if (code.length > 10) {
        matches.push({ code, language });
      }
    }
    return matches.length > 0 ? matches[matches.length - 1] : null;
  }, []);

  const handleSend = async (text?: string, sceneOverride?: string) => {
    const message = (text || inputValue).trim();
    if (!message || isLoading) return;
    if (!user) {
      const used = Number(localStorage.getItem('anonymous_chat_count') || '0');
      if (used >= 5) { setShowRegisterPrompt(true); return; }
    }
    const userMsg: Message = { id: nextMessageId(), role: 'user', content: message };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setShowChatHistory(true);
    setIsLoading(true);
    let assistantContent = '';
    setMessages((prev) => [...prev, { id: nextMessageId(), role: 'assistant', content: '' }]);

    try {
      await stream(
        {
          message,
          context: { page: 'create', scene: sceneOverride || activeScene, authenticated: !!user, project_id: projectContext.projectId },
          skillId: activeSkill.id,
        },
        (token) => {
          assistantContent += token;
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === 'assistant') last.content += token;
            return copy;
          });
        },
        {
          onSkillActivated: (data) => {
            setActiveSkill(prev => ({
              ...prev,
              id: data.skill_id,
              name: data.skill_name,
            }));
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last && last.role === 'assistant') {
                last.skillInfo = {
                  skill_id: data.skill_id,
                  skill_name: data.skill_name,
                  sub_skill_name: data.sub_skill_name,
                };
              }
              return copy;
            });
          },
          onProjectCreated: (data) => {
            setProjectContext(prev => ({
              ...prev,
              projectId: data.project_id,
              projectName: data.project_name,
              mode: 'standard',
              currentStage: 'stage_01',
            }));
          },
          onToolCall: (data) => {
            if (data.tool_name === 'project_creator' && data.success) {
              setShowEditor(true);
              setEditorTab('code');
            }
          },
          onStageChanged: (data) => {
            setProjectContext(prev => ({
              ...prev,
              currentStage: data.stage,
            }));
          },
          onQuestion: (data) => {
            setPendingQuestion(data);
          },
          onContentUpdate: (dedupedContent) => {
            setMessages(prev => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                updated[lastIdx] = { ...updated[lastIdx], content: dedupedContent };
              }
              return updated;
            });
            if (!pendingQuestion) {
              const fallback = parseQuestionFromText(dedupedContent);
              if (fallback) setPendingQuestion(fallback);
            }
          },
        },
      );

      if (!pendingQuestion) {
        const finalFallback = parseQuestionFromText(assistantContent);
        if (finalFallback) setPendingQuestion(finalFallback);
      }

      const codeResult = extractCodeFromResponse(assistantContent);
      if (codeResult) {
        handleWriteCodeToEditor(codeResult.code, codeResult.language);

        if (!projectContext.projectId) {
          const projectName = message.length > 20 ? message.slice(0, 20) + '...' : message;
          const createdProject = await createProjectViaAPI(projectName, 'standard');
          if (createdProject) {
            setProjectContext(prev => ({
              ...prev,
              projectId: createdProject.id,
              projectName: createdProject.name,
              mode: createdProject.mode as 'light' | 'standard',
              currentStage: 'stage_07',
            }));
            projectsApi.saveCode(createdProject.id, {
              code: codeResult.code,
              language: codeResult.language,
            }).catch(() => {});
          } else {
            setProjectContext(prev => ({
              ...prev,
              projectId: `local-${Date.now()}`,
              projectName: projectName,
              mode: 'standard' as const,
              currentStage: 'stage_07',
            }));
          }
          setShowEditor(true);
        }
      }

      if (!projectContext.projectId && (message.includes('项目') || message.includes('创建') || message.includes('新建'))) {
        const fallbackName = message.length > 30 ? message.slice(0, 30) + '...' : message;
        const createdProject = await createProjectViaAPI(fallbackName, 'light');
        if (createdProject) {
          setProjectContext(prev => ({
            ...prev,
            projectId: createdProject.id,
            projectName: createdProject.name,
            mode: createdProject.mode as 'light' | 'standard',
            currentStage: 'step_2',
          }));
        } else {
          setProjectContext(prev => ({
            ...prev,
            projectId: `local-${Date.now()}`,
            projectName: fallbackName,
            mode: 'light' as const,
            currentStage: 'step_2',
          }));
        }
      }
    } catch (error) {
      if (!user) {
        const used = Number(localStorage.getItem('anonymous_chat_count') || '0');
        const next = used + 1;
        localStorage.setItem('anonymous_chat_count', String(next));
        if (next >= 5) setShowRegisterPrompt(true);
      }
      const errMsg = error instanceof Error ? error.message : '请求失败，请稍后重试';
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant') last.content = `请求失败：${errMsg}`;
        return copy;
      });
    } finally {
      setIsLoading(false);
    }
  };
  handleSendRef.current = handleSend;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSceneClick = (label: string) => {
    setActiveScene(label);
    const prompts: Record<string, string> = {
      '问问题': '我想问一个 STEM 相关的问题',
      '解释代码': '帮我分析一段代码的问题',
      '开始项目': '我想做一个项目，帮我选题和规划',
      '写报告': '我需要帮助撰写一份研究报告或论文',
    };
    handleSend(prompts[label] || `切换到${label}模式`, label);
  };

  return (
    <div className="h-[calc(100vh-88px)] flex gap-3">
      <div className="w-48 flex-shrink-0 space-y-2">
        <Card className="p-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-xs">场景</h3>
          </div>
          <div className="p-1 space-y-0.5">
            {SCENE_ENTRIES.map((entry) => (
              <button key={entry.label} onClick={() => handleSceneClick(entry.label)}
                className={`w-full flex items-center px-2.5 py-1.5 rounded-lg text-left transition-colors group ${
                  activeScene === entry.label ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <entry.icon className={`w-3.5 h-3.5 mr-2 ${activeScene === entry.label ? 'text-teal-600' : 'text-gray-400'}`} />
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{entry.label}</div>
                  <div className="text-[10px] text-gray-400 truncate">{entry.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-gray-500" />
            <h3 className="font-semibold text-gray-800 text-xs">项目</h3>
          </div>
          <div className="p-2 space-y-1 max-h-[200px] overflow-y-auto">
            {userProjects.length > 0 && userProjects.map((proj) => (
              <div key={proj.id} className={`group rounded-lg transition-colors ${
                projectContext.projectId === proj.id ? 'bg-teal-50 border border-teal-200' : ''
              }`}>
                {editingProjectId === proj.id ? (
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <input
                      ref={editInputRef}
                      value={editProjectName}
                      onChange={(e) => setEditProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditProject();
                        if (e.key === 'Escape') cancelEditProject();
                      }}
                      onBlur={saveEditProject}
                      className="flex-1 text-xs font-medium text-gray-800 bg-white border border-teal-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-teal-400"
                      maxLength={50}
                    />
                  </div>
                ) : (
                  <div className="flex items-center px-2 py-1.5">
                    <div
                      onClick={() => {
                        setProjectContext(prev => ({
                          ...prev,
                          projectId: proj.id,
                          projectName: proj.name,
                          mode: proj.mode as 'light' | 'standard',
                          currentStage: proj.current_stage || '',
                        }));
                        projectsApi.getCode(proj.id).then(res => {
                          if (res.data?.has_code) {
                            handleWriteCodeToEditor(res.data.code, res.data.language);
                            setShowEditor(true);
                            setEditorTab('code');
                          }
                        }).catch(() => {});
                      }}
                      className="flex-1 text-left min-w-0 cursor-pointer"
                    >
                      <div className={`text-xs truncate ${projectContext.projectId === proj.id ? 'text-teal-700 font-medium' : 'text-gray-600'}`}>
                        📍 {proj.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          startEditProject(proj.id, proj.name);
                        }}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-teal-600 transition-colors"
                        title="修改项目名"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <div className="relative" data-more-menu>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMoreMenuProjectId(moreMenuProjectId === proj.id ? null : proj.id);
                          }}
                          className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
                          title="更多操作"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                        {moreMenuProjectId === proj.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[100px]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMoreMenuProjectId(null);
                                startEditProject(proj.id, proj.name);
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Pencil className="w-3 h-3" /> 修改名称
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {editingProjectId !== proj.id && (
                  <div className="text-[10px] text-gray-400 px-2 pb-0.5">{proj.mode === 'light' ? '轻量' : '标准'}</div>
                )}
              </div>
            ))}
            {projectContext.projectId && !userProjects.find(p => p.id === projectContext.projectId) && (
              <div className="px-2 py-1 text-xs text-teal-700 font-medium truncate bg-teal-50 rounded">
                <div className="flex items-center justify-between">
                  <span className="truncate">📍 {projectContext.projectName || '未命名项目'}</span>
                  <button
                    onClick={() => startEditProject(projectContext.projectId!, projectContext.projectName)}
                    className="p-0.5 hover:bg-teal-100 rounded text-teal-600 ml-1 flex-shrink-0"
                    title="修改项目名"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
                {projectContext.mode && (
                  <div className="text-[10px] text-gray-400 mt-0.5">模式: {projectContext.mode === 'light' ? '轻量' : '标准'} (本地)</div>
                )}
              </div>
            )}
            <button
              onClick={() => handleSend('我想创建一个新项目，帮我选题和规划')}
              className="w-full flex items-center justify-center px-2 py-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:text-teal-600 hover:border-teal-300 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" /><span className="text-xs font-medium">新建项目</span>
            </button>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden border-teal-200 bg-teal-50">
          <div className="px-3 py-2 border-b border-teal-100">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span className="text-xs font-semibold text-teal-700">当前 Skill</span>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowSkillSelector(!showSkillSelector)}
                className="w-full flex items-center justify-between px-2 py-1.5 bg-white border border-teal-200 rounded-lg text-xs text-teal-700 hover:border-teal-300 transition-colors"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {activeSkill.icon}
                  <span className="truncate font-medium">{activeSkill.name}</span>
                </div>
                <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${showSkillSelector ? 'rotate-180' : ''}`} />
              </button>
              {showSkillSelector && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {SKILL_OPTIONS.map((skill) => (
                    <button
                      key={skill.id}
                      onClick={() => {
                        setActiveSkill(skill);
                        setShowSkillSelector(false);
                      }}
                      className={`w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                        skill.id === activeSkill.id ? 'bg-teal-50' : ''
                      }`}
                    >
                      <div className={`mt-0.5 ${skill.id === activeSkill.id ? 'text-teal-600' : 'text-gray-400'}`}>
                        {skill.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-medium truncate ${skill.id === activeSkill.id ? 'text-teal-700' : 'text-gray-800'}`}>
                          {skill.name}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">
                          {skill.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-gray-500" />
            <h3 className="font-semibold text-gray-800 text-xs">快捷</h3>
          </div>
          <div className="p-1 space-y-0.5">
            <button onClick={() => handleSceneClick('解释代码')} className="w-full flex items-center px-2.5 py-1.5 rounded-lg text-left text-xs text-gray-600 hover:bg-gray-50 transition-colors">
              <Code className="w-3 h-3 mr-1.5 text-gray-400" /> 解释当前代码
            </button>
            <button onClick={() => handleSend('下一步做什么？')} className="w-full flex items-center px-2.5 py-1.5 rounded-lg text-left text-xs text-gray-600 hover:bg-gray-50 transition-colors">
              <ArrowRight className="w-3 h-3 mr-1.5 text-gray-400" /> 推进下一阶段
            </button>
          </div>
        </Card>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <Card className="flex-1 flex flex-col p-0 overflow-hidden border-gray-200 shadow-sm">
          {projectContext.mode && showChatHistory && <StageProgressBar projectContext={projectContext} />}

          {showChatHistory ? (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-3 bg-white">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user' ? 'bg-teal-600 text-white rounded-br-sm' : 'bg-gray-50 text-gray-800 rounded-bl-sm border border-gray-100'
                    }`}>
                      <div className={`flex items-center gap-1.5 mb-1 text-xs ${msg.role === 'user' ? 'text-teal-200' : 'text-gray-400'}`}>
                        {msg.role === 'user' ? <User className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                        <span>{msg.role === 'user' ? '你' : 'fineSTEM AI'}</span>
                        {msg.skillInfo && <span className="text-teal-500 ml-1">[{msg.skillInfo.sub_skill_name || msg.skillInfo.skill_name}]</span>}
                      </div>
                      {msg.role === 'assistant' ? (
                        <EnhancedMarkdownText content={msg.content} onWriteCode={handleWriteCodeToEditor} onRunCode={handleRunCode} />
                      ) : (
                        <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-50 rounded-2xl rounded-bl-sm px-4 py-3 border border-gray-100 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                {pendingQuestion && (
                  <QuestionCard
                    data={pendingQuestion}
                    onAnswer={handleQuestionAnswer}
                    onCancel={dismissQuestion}
                    onDismiss={dismissQuestion}
                  />
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-white to-gray-50">
              <div className="w-14 h-14 bg-teal-100 rounded-2xl flex items-center justify-center mb-3">
                <Zap className="w-7 h-7 text-teal-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">fineSTEM AI</h2>
              <p className="text-sm text-gray-500 mb-5 max-w-md text-center">AI 研学导师，帮你选题、规划、编码、写报告</p>
              <div className="mb-4 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-teal-700">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-medium">当前模式: {activeSkill.name}</span>
                </div>
                <p className="text-[11px] text-teal-600 mt-1">{activeSkill.description}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {CODEX_SUGGESTIONS.map((suggestion, idx) => (
                  <button key={idx} onClick={() => handleSend(suggestion)} disabled={isLoading}
                    className="text-left text-sm text-gray-500 hover:text-gray-700 hover:bg-white hover:shadow-sm px-3 py-2 rounded-lg transition-colors leading-relaxed line-clamp-2 border border-transparent">
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="px-3 pt-2 pb-3">
            <div className="relative border border-gray-200 rounded-xl bg-white focus-within:border-teal-400 focus-within:ring-1 focus-within:ring-teal-100 transition-all">
              <textarea ref={textareaRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} rows={1}
                placeholder={isLoading ? 'AI 正在思考...' : showChatHistory ? '继续对话...' : `描述你想实现的功能，或说"我想做一个项目"...`}
                disabled={isLoading}
                className="w-full resize-none border-0 bg-transparent px-3 py-2.5 text-sm outline-none placeholder-gray-400 max-h-48" />
              <div className="flex items-center justify-between px-2 py-1">
                <div className="flex items-center gap-1">
                  <button className="p-1 hover:bg-gray-100 rounded text-gray-400 transition-colors"><Paperclip className="w-3.5 h-3.5" /></button>
                  <button className="p-1 hover:bg-gray-100 rounded text-gray-400 transition-colors"><Link2 className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex items-center gap-2">
                  {!user && <span className="text-[10px] text-amber-600">匿名剩余 {5 - Number(localStorage.getItem('anonymous_chat_count') || '0')} 次</span>}
                  <button onClick={() => handleSend()} disabled={!inputValue.trim() && !showChatHistory}
                    className="p-1 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 text-white rounded-lg transition-colors">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className={`flex-shrink-0 flex flex-col gap-2 transition-all duration-300 ${showEditor ? 'w-[480px]' : 'w-10'}`}>
        {showEditor ? (
          <>
            <Card className="flex-1 flex flex-col p-0 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-100">
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditorTab('code')} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${editorTab === 'code' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
                    <Terminal className="w-3 h-3" /> 代码
                  </button>
                  <button onClick={() => setEditorTab('preview')} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${editorTab === 'preview' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
                    <Eye className="w-3 h-3" /> 预览
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <select value={editorLanguage} onChange={(e) => setEditorLanguage(e.target.value)}
                    className="text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white text-gray-600 outline-none">
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                  </select>
                  <button onClick={handleRunEditorCode} className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors">
                    <Play className="w-3 h-3" /> 运行
                  </button>
                  <button onClick={() => setShowEditor(false)} className="p-1 hover:bg-gray-200 rounded text-gray-400 transition-colors">
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className={`flex-1 min-h-0 ${editorTab === 'code' ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
                {editorTab === 'code' ? (
                  <Suspense fallback={<EditorLoading />}>
                    <CodeEditor code={editorCode} language={editorLanguage} onChange={(v) => setEditorCode(v)} />
                  </Suspense>
                ) : (
                  <CodePreview htmlContent={previewHtml} title="运行结果" />
                )}
              </div>
            </Card>
          </>
        ) : (
          <button onClick={() => setShowEditor(true)}
            className="flex flex-col items-center justify-center gap-1 py-4 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 text-gray-400 hover:text-teal-600 transition-colors">
            <PanelLeftOpen className="w-4 h-4" />
            <span className="text-[10px] font-medium">编辑器</span>
          </button>
        )}
      </div>

      <LightRegisterPrompt open={showRegisterPrompt} onClose={() => setShowRegisterPrompt(false)} />
    </div>
  );
}
