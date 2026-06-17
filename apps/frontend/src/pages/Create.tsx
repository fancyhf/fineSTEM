import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquare, Code, Rocket, FileText, ChevronUp, Paperclip, Link2, FolderOpen, Plus, Sparkles, User, Settings, Zap, ClipboardList, FileCode, Image, Play, Copy, Check, ArrowRight, BookOpen, PanelLeftClose, PanelLeftOpen, Terminal, Eye, Pencil, MoreHorizontal } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useStreamingChat } from '../hooks/useStreamingChat';
import { MarkdownText } from '../components/MarkdownText';
import { LightRegisterPrompt } from '../components/LightRegisterPrompt';
import { CodePreview } from '../components/CodePreview';
import { CodeEditor } from '../components/CodeEditor';
import { QuestionCard, QuestionData } from '../components/QuestionCard';
import { useAuth } from '../contexts/AuthContext';
import { projectsApi, codeExecutionApi } from '../services/api';
import { ProjectWorkspaceResponse } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  skillInfo?: { skill_id: string; skill_name: string; sub_skill_name?: string };
  toolCalls?: { tool_name: string; success: boolean; data?: any }[];
}

function buildStreamHistory(messages: Message[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .map((message) => ({
      role: message.role,
      content: cleanAssistantMessageContent(message.content || '').trim(),
    }))
    .filter((message) => Boolean(message.content))
    .slice(-12);
}

function collapseRepeatedFragments(content: string): string {
  if (!content || content.length < 4) return content;
  let cleaned = content;
  for (let i = 0; i < 3; i += 1) {
    cleaned = cleaned.replace(/([\u4e00-\u9fff])\1{1,3}/g, '$1');
    cleaned = cleaned.replace(/([\u4e00-\u9fff]{2,12})\1{1,2}/g, '$1');
    cleaned = cleaned.replace(/([A-Za-z]{2,})\1{1,2}/g, '$1');
    cleaned = cleaned.replace(/([，。！？、；：,.!?])\1+/g, '$1');
  }
  const lines = cleaned.split('\n');
  const compactLines: string[] = [];
  lines.forEach((line) => {
    if (compactLines[compactLines.length - 1] === line && line.trim()) {
      return;
    }
    compactLines.push(line);
  });
  return compactLines.join('\n');
}

function sanitizeAssistantNarration(content: string): string {
  let cleaned = content;
  cleaned = cleaned.replace(/<｜｜DSML｜｜[\s\S]*?tool_calls>/gi, '');
  cleaned = cleaned.replace(/<\|[\s\S]*?\|>/g, '');
  cleaned = cleaned.replace(/<option\s+id=["'][^"']*["'][^>]*>[\s\S]*?<\/option>/gi, '');
  cleaned = cleaned.replace(/^\s*(tool_calls|invoke name=|parameter name=|artifact_writer|artifact_reader).*$\n?/gim, '');
  cleaned = cleaned.replace(/^\s*```(?:markdown|md)?\s*复制\s*$/gim, '```');
  cleaned = cleaned.replace(/^\s*<[^>\n]*calls[^>\n]*>\s*$/gim, '');
  cleaned = cleaned.replace(/^\s*<\/?(?:option|label|desc)[^>]*>\s*$/gim, '');
  cleaned = cleaned.replace(/^\s*<\/?question[^>]*>\s*$/gim, '');
  cleaned = collapseRepeatedFragments(cleaned);
  return cleaned;
}

function cleanAssistantMessageContent(content: string): string {
  if (!content) return '';
  const segments = content.split(/(```[\s\S]*?```)/g);
  let cleaned = segments
    .map((segment) => (segment.startsWith('```') ? segment : sanitizeAssistantNarration(segment)))
    .join('');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

function cleanRestoredMessageContent(content: string): string {
  return cleanAssistantMessageContent(content);
}

function normalizeWorkspaceMessages(items: Array<Record<string, unknown>> | undefined): Message[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => typeof item?.role === 'string' && typeof item?.content === 'string')
    .map((item, index) => {
      const role: Message['role'] = item.role === 'user' ? 'user' : 'assistant';
      const content = cleanRestoredMessageContent(String(item.content || ''));
      return {
        id: typeof item.id === 'string' ? item.id : `restored-${index}`,
        role,
        content,
        skillInfo: typeof item.skillInfo === 'object' && item.skillInfo
          ? {
              skill_id: String((item.skillInfo as Record<string, unknown>).skill_id || ''),
              skill_name: String((item.skillInfo as Record<string, unknown>).skill_name || ''),
              sub_skill_name: (item.skillInfo as Record<string, unknown>).sub_skill_name
                ? String((item.skillInfo as Record<string, unknown>).sub_skill_name)
                : undefined,
            }
          : undefined,
      };
    })
    .filter((item) => item.role === 'user' || Boolean(item.content));
}

interface ProjectContext {
  projectId: string | null;
  projectName: string;
  mode: 'light' | 'standard' | null;
  currentStage: string;
  stageProgress: number;
  evidenceCount: number;
  teachingMode: 'guided' | 'demo' | 'hands_on' | 'lecture';
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
  { icon: MessageSquare, label: '问问题', desc: '快速提问与获取答案' },
  { icon: Code, label: '解释代码', desc: '读懂代码并找到优化点' },
  { icon: Rocket, label: '开始项目', desc: '新建项目或继续创作' },
  { icon: FileText, label: '写报告', desc: '整理结果并生成文稿' },
];

const CODEX_SUGGESTIONS = [
  '直接给我一个可运行版本，并自动写入编辑器',
  '把这段代码讲清楚，并指出还能怎么优化',
  '帮我把一个想法整理成可执行的项目方案',
];

const TEACHING_MODES: Array<{
  key: 'guided' | 'demo' | 'hands_on' | 'lecture';
  label: string;
  desc: string;
}> = [
  { key: 'guided', label: '引导式', desc: '先给骨架，再一步步补全' },
  { key: 'demo', label: '演示式', desc: '先看完整示例，再拆解模仿' },
  { key: 'hands_on', label: '动手式', desc: '先自己尝试，卡住再提示' },
  { key: 'lecture', label: '讲解式', desc: '先讲原理，再进入代码' },
];

const LIGHT_STEPS = [
  { key: 'step_1', label: '想法与方向', icon: '💡' },
  { key: 'step_2', label: '设计与实现', icon: '🔨' },
  { key: 'step_3', label: '展示与反思', icon: '🏆' },
];

const PBL_GUIDE_STEPS = [
  { key: 'guide_1', title: '选题与目标', desc: '明确要做什么、为谁解决问题', icon: '💡' },
  { key: 'guide_2', title: '设计与拆解', desc: '把想法变成步骤、界面和规则', icon: '🧭' },
  { key: 'guide_3', title: '实现与调试', desc: '生成代码、运行、修改并验证', icon: '💻' },
  { key: 'guide_4', title: '展示与反思', desc: '整理成果、说明思路并复盘', icon: '🏆' },
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

const STAGE_ACTION_HINTS: Record<string, string> = {
  stage_00: '先确认项目方向，再进入下一步。',
  stage_01: '可以继续细化选题，或者直接让我收敛成一个可执行项目。',
  stage_02: '可以补充目标、受众和成果形式，让开题更清楚。',
  stage_03: '可以删掉不必要的功能，把范围收紧到可完成版本。',
  stage_04: '可以让我帮你选择更合适的实现路线或学习轨道。',
  stage_05: '可以继续让我输出方案、界面、数据结构或分工草图。',
  stage_06: '可以让我把任务拆成更具体的实现步骤。',
  stage_07: '现在可以直接生成代码、写入编辑器并开始调试。',
  stage_08: '现在可以整理结果、展示成果，或继续补充报告内容。',
};

function getStageDisplayInfo(currentStage: string): { label: string; hint: string } {
  const matchedStage = STANDARD_STAGES.find((stage) => currentStage.startsWith(stage.key));
  if (!matchedStage) {
    return { label: currentStage || '下一阶段', hint: '你可以继续告诉我当前想完成的内容。' };
  }
  return {
    label: matchedStage.label,
    hint: STAGE_ACTION_HINTS[matchedStage.key] || '你可以继续告诉我当前想完成的内容。',
  };
}

function hasDirectCodingIntent(message: string): boolean {
  return /(直接进入编码|直接推进到编码|进入执行阶段|直接做|立即做|马上做|不要再问|别再问|别问了|直接实现|直接开发|跳过引导|跳过开题|跳过前置|直接给代码|直接输出代码|直接给出完整代码|写到编辑器|写入编辑器)/.test(message);
}

function isTeachingModeStage(currentStage: string): boolean {
  return currentStage.startsWith('stage_07') || currentStage.startsWith('stage_08');
}

const DEFAULT_CODE = `<!-- 在这里查看或修改 AI 生成的代码 -->
<!-- 你也可以直接让 AI 生成 HTML / JavaScript / Python 版本 -->
`;

const EXECUTABLE_CODE_LANGUAGES = new Set([
  'python',
  'py',
  'javascript',
  'js',
  'html',
  'css',
  'typescript',
  'ts',
  'tsx',
]);

function normalizeCodeLanguage(language: string | undefined): string {
  const normalized = (language || 'text').toLowerCase();
  if (normalized === 'py') return 'python';
  if (normalized === 'js') return 'javascript';
  if (normalized === 'ts' || normalized === 'tsx') return 'typescript';
  return normalized;
}

function toEditorLanguage(language: string | undefined): string {
  const normalized = normalizeCodeLanguage(language);
  if (normalized === 'python') return 'python';
  if (normalized === 'javascript' || normalized === 'typescript') return 'javascript';
  if (normalized === 'html') return 'html';
  if (normalized === 'css') return 'css';
  return 'plaintext';
}

function isExecutableCodeLanguage(language: string | undefined): boolean {
  return EXECUTABLE_CODE_LANGUAGES.has(normalizeCodeLanguage(language));
}

function inferRequestedOutputLanguage(message: string): string {
  const normalizedMessage = message.toLowerCase();
  const wantsWebCode = /(html|css|javascript|\bjs\b|typescript|\bts\b|网页|网站|web|页面|界面|浏览器|前端|可视化)/i.test(message);
  const wantsPythonCode = /(python|\bpy\b|脚本|命令行|算法|数据处理)/i.test(normalizedMessage);

  if (wantsWebCode) {
    return 'html';
  }

  if (wantsPythonCode) {
    return 'python';
  }

  return 'auto';
}

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
  const canWriteToEditor = isExecutableCodeLanguage(language);
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
            {canWriteToEditor && (
              <>
                <button onClick={onRun} className="flex items-center gap-1 px-2 py-0.5 hover:bg-gray-700 rounded text-green-300 transition-colors">
                  <Play className="w-3 h-3" /> 运行
                </button>
                <button onClick={onWriteToEditor} className="flex items-center gap-1 px-2 py-0.5 hover:bg-gray-700 rounded text-blue-300 transition-colors">
                  <ArrowRight className="w-3 h-3" /> 写入编辑器
                </button>
              </>
            )}
          </div>
        </div>
        <pre className="p-3 overflow-x-auto text-sm"><code className="text-gray-100">{code}</code></pre>
      </div>
    </div>
  );
}

function parseQuestionFromText(text: string): QuestionData | null {
  const hasQuestionWrapper = /<question[^>]*>/i.test(text);
  const hasBareOptions = /<option\s+id=["'][^"']*["']/i.test(text);
  if (!hasQuestionWrapper && !hasBareOptions) return null;

  let title = '请选择';
  if (hasQuestionWrapper) {
    const qTagMatch = text.match(/<question[^>]*title=["']([^"']*)["']/);
    title = qTagMatch ? qTagMatch[1] : title;
  } else {
    const beforeOptions = text.split(/<option\s+id=["'][^"']*["'][^>]*>/i)[0] || '';
    const titleCandidate = beforeOptions
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-1)[0];
    if (titleCandidate) {
      title = titleCandidate.replace(/^接下来我需要更具体地了解你的想法[👇:：]?\s*/u, '').trim() || title;
    }
  }
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

function _escHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildHtmlFromCode(code: string, language: string): string {
  if (!code || !code.trim()) return '';
  if (language === 'html') return code.includes('<!DOCTYPE') || code.includes('<html') ? code : `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0}body{font-family:-apple-system,sans-serif;padding:20px;background:#f9fafb}</style></head><body>${code}</body></html>`;
  if (language === 'javascript' || language === 'js') {
    const escaped = _escHtml(code);
    // Use new Function() to catch BOTH syntax errors and runtime errors
    const safeCode = code
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px;background:#f9fafb;color:#1f2937;line-height:1.6}
#out{margin-top:16px}pre{background:#1f2937;color:#e5e7eb;padding:16px;border-radius:8px;overflow-x:auto;margin:8px 0;font-size:13px}
.err{color:#ef4444;font-weight:500;background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:8px;margin:8px 0;font-size:13px}
.ok{color:#10b981;font-weight:500}.info{color:#3b82f6}h3{color:#374151;margin-bottom:12px;font-size:16px}
.btn{display:inline-block;margin-top:12px;padding:8px 16px;background:#0ea5e9;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500}
.btn:hover{background:#0284c7}</style></head>
<body>
<h3>JavaScript Result</h3><div id="out"></div>
<script>
(function(){
  var out=document.getElementById('out'),has=false;
  function add(t,c){has=true;var p=document.createElement('pre');p.textContent=String(t);if(c)p.className=c;out.appendChild(p)}
  var _log=console.log,_err=console.error,_warn=console.warn;
  console.log=function(){add(Array.prototype.slice.call(arguments).map(function(a){return typeof a==='object'?JSON.stringify(a,null,2):String(a)}).join(' '),'info');_log.apply(console,arguments)};
  console.error=function(){add(Array.prototype.slice.call(arguments).join('\\n'),'err');_err.apply(console,arguments)};
  console.warn=function(){add(Array.prototype.slice.call(arguments).join\\n'),'info');_warn.apply(console,arguments)};
  try { (new Function(${JSON.stringify(code)}))(); if(!has) add('OK - no output','ok'); }
  catch(e) {
    var d=document.createElement('div');d.className='err';
    d.innerHTML='<b>SyntaxError / Runtime Error:</b><br>'+_escHtml(e.message)+'<br><br><button class="btn" onclick="window.parent&&window.parent.postMessage({type:\\'code-error\\',msg:e.message},\\'*\\')">Ask AI to fix this error</button>';
    out.appendChild(d);
    window.__codeError=e.message;
  }
  function _escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
})();
<\/script></body></html>`;
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:monospace;padding:20px;background:#f9fafb}pre{background:#1f2937;color:#e5e7eb;padding:16px;border-radius:8px;overflow-x:auto;white-space:pre-wrap}</style></head><body><pre>${_escHtml(code)}</pre></body></html>`;
}

function buildExecutionResultHtml(result: { success: boolean; output: string; error?: string; exit_code?: number }, code: string): string {
  const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapedOutput = (result.output || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapedError = (result.error || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const hasError = !!(result.error && result.error.trim());
  const isFailure = !result.success || (result.exit_code !== undefined && result.exit_code !== 0);

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px;">
      <div style="margin-bottom: 12px; padding: 8px 12px; background: ${isFailure ? '#fef2f2' : '#f0fdf4'}; border: 1px solid ${isFailure ? '#fecaca' : '#bbf7d0'}; border-radius: 6px; font-size: 13px;">
        <span style="color: ${isFailure ? '#dc2626' : '#16a34a'};">${isFailure ? '✗' : '✓'} 代码执行${result.success ? '成功' : '完成'}${result.exit_code !== undefined ? ' (退出码: ' + result.exit_code + ')' : ''}</span>
      </div>
      ${result.output ? `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">输出结果：</div>
        <pre style="background: #fafafa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; overflow-x: auto;">${escapedOutput}</pre>
      </div>` : ''}
      ${hasError ? `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 12px; color: #dc2626; margin-bottom: 4px;">错误 / 警告：</div>
        <pre style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; overflow-x: auto; color: #dc2626;">${escapedError}</pre>
        <button id="__ask_ai_btn" style="display:inline-block;margin-top:8px;padding:8px 16px;background:#0ea5e9;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;" onclick="(function(){window.parent.postMessage({type:'code-error',msg:${JSON.stringify(result.error)}},'*');this.textContent='已发送给AI...';this.disabled=true;this.style.background='#94a3b8';})()">Ask AI to fix this error</button>
      </div>` : ''}
      ${!result.output && !hasError ? '<div style="font-size:12px;color:#9ca3af;padding:8px 0;">(无输出)</div>' : ''}
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
  const [userProjects, setUserProjects] = useState<Array<{id: string; name: string; mode: string; current_stage?: string; created_at?: string}>>([]);

  const [editorCode, setEditorCode] = useState(DEFAULT_CODE);
  const [editorLanguage, setEditorLanguage] = useState('html');
  const [previewHtml, setPreviewHtml] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editorTab, setEditorTab] = useState<'code' | 'preview'>('code');
  const [runningCode, setRunningCode] = useState(false);
  const [activeSkill, setActiveSkill] = useState<SkillOption>(SKILL_OPTIONS[0]);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [moreMenuProjectId, setMoreMenuProjectId] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<QuestionData | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const messageSeqRef = useRef(0);
  const handleSendRef = useRef<typeof handleSend>(null! as unknown as typeof handleSend);
  const handleAdvanceStageRef = useRef<() => void>(() => {});
  const projectCreatingRef = useRef(false);
  const codeSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevProjectIdRef = useRef<string | null>(null);
  const restoreAutosaveGuardRef = useRef<{
    projectId: string | null;
    skipCodeAutosave: boolean;
    skipChatAutosave: boolean;
  }>({
    projectId: null,
    skipCodeAutosave: false,
    skipChatAutosave: false,
  });

  useEffect(() => {
    if (user) {
      loadUserProjects();
    }
  }, [user]);

  const [_restoreDone, setRestoreDone] = useState(false);
  const restoreRef = useRef(false);
  const consumeRestoreAutosaveGuard = useCallback((kind: 'code' | 'chat', projectId: string) => {
    const guard = restoreAutosaveGuardRef.current;
    if (guard.projectId !== projectId) {
      return false;
    }

    if (kind === 'code' && !guard.skipCodeAutosave) {
      return false;
    }

    if (kind === 'chat' && !guard.skipChatAutosave) {
      return false;
    }

    const nextGuard = {
      projectId,
      skipCodeAutosave: kind === 'code' ? false : guard.skipCodeAutosave,
      skipChatAutosave: kind === 'chat' ? false : guard.skipChatAutosave,
    };

    restoreAutosaveGuardRef.current =
      !nextGuard.skipCodeAutosave && !nextGuard.skipChatAutosave
        ? { projectId: null, skipCodeAutosave: false, skipChatAutosave: false }
        : nextGuard;

    return true;
  }, []);
  const applyWorkspaceRestore = useCallback((payload: ProjectWorkspaceResponse) => {
    const { project, progress, workspace } = payload;
    if (codeSaveTimerRef.current) clearTimeout(codeSaveTimerRef.current);
    if (chatSaveTimerRef.current) clearTimeout(chatSaveTimerRef.current);
    restoreAutosaveGuardRef.current = {
      projectId: project.id,
      skipCodeAutosave: true,
      skipChatAutosave: true,
    };
    projectCreatingRef.current = false;
    setProjectContext(prev => ({
      ...prev,
      projectId: project.id,
      projectName: project.name || '',
      mode: project.mode as 'light' | 'standard',
      currentStage: progress.current_stage || project.current_stage || '',
      teachingMode: progress.teaching_mode || 'guided',
    }));
    setEditorCode(workspace.code || DEFAULT_CODE);
    setEditorLanguage(toEditorLanguage(workspace.language));
    setPreviewHtml(workspace.preview_html || '');
    setShowEditor(true);
    setEditorTab('code');
    setMessages(normalizeWorkspaceMessages(workspace.chat_messages));
    setPendingQuestion(null);
    setIsLoading(false);
    setShowChatHistory(true);
    setRestoreDone(true);
  }, []);

  useEffect(() => {
    if (restoreRef.current) return;
    const restore = sessionStorage.getItem('finestem_restore_project');
    if (!restore) return;
    restoreRef.current = true;
    sessionStorage.removeItem('finestem_restore_project');
    try {
      const data = JSON.parse(restore);
      console.log('[restore] 恢复数据:', { projectId: data.projectId, hasCode: !!data.code, msgCount: data.messages?.length });
      if (data.projectId) {
        projectsApi.getWorkspace(data.projectId)
          .then((res) => {
            if (res.data) {
              applyWorkspaceRestore(res.data);
              console.log('[restore] 已通过 workspace 接口恢复项目', data.projectId);
              return;
            }
            throw new Error('workspace 数据为空');
          })
          .catch((error) => {
            console.error('[restore] workspace 恢复失败，回退旧缓存数据:', error);
            setProjectContext({
              projectId: data.projectId,
              projectName: data.projectName || '',
              mode: (data.mode || 'standard') as 'light' | 'standard',
              currentStage: data.currentStage || '',
              stageProgress: 0,
              evidenceCount: 0,
              teachingMode: 'guided',
            });
            setEditorCode(data.code || DEFAULT_CODE);
            setEditorLanguage(toEditorLanguage(data.language));
            setShowEditor(true);
            setEditorTab('code');
            setMessages(normalizeWorkspaceMessages(Array.isArray(data.messages) ? data.messages : []));
            setPendingQuestion(null);
            setIsLoading(false);
            setShowChatHistory(true);
            setRestoreDone(true);
          });
      }
    } catch (e) {
      console.error('[restore] 恢复失败:', e);
    }
  }, [applyWorkspaceRestore]);

  useEffect(() => { const q = searchParams.get('q'); if (q && messages.length === 0) handleSend(q); }, [searchParams]);
  useEffect(() => { if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'; } }, [inputValue]);

  useEffect(() => {
    if (!projectContext.projectId) return;
    const projectId = projectContext.projectId;
    if (consumeRestoreAutosaveGuard('code', projectId)) return;
    if (codeSaveTimerRef.current) clearTimeout(codeSaveTimerRef.current);
    codeSaveTimerRef.current = setTimeout(() => {
      projectsApi.saveCode(projectId, { code: editorCode, language: editorLanguage }).catch((error) => {
        console.error('[autosave:code] 保存失败:', error);
      });
    }, 2000);
    return () => { if (codeSaveTimerRef.current) clearTimeout(codeSaveTimerRef.current); };
  }, [consumeRestoreAutosaveGuard, editorCode, projectContext.projectId, editorLanguage]);

  useEffect(() => {
    if (!projectContext.projectId || projectContext.projectId.startsWith('local-')) return;
    if (messages.length === 0) return;
    const isNewProject = prevProjectIdRef.current !== projectContext.projectId;
    prevProjectIdRef.current = projectContext.projectId;
    const projectId = projectContext.projectId;
    if (consumeRestoreAutosaveGuard('chat', projectId)) return;
    const saveNow = () => {
      projectsApi.saveChatHistory(projectId, { messages }).catch((error) => {
        console.error('[autosave:chat] 保存失败:', error);
      });
    };
    if (isNewProject) {
      saveNow();
    } else {
      if (chatSaveTimerRef.current) clearTimeout(chatSaveTimerRef.current);
      chatSaveTimerRef.current = setTimeout(saveNow, 3000);
    }
    return () => { if (chatSaveTimerRef.current) clearTimeout(chatSaveTimerRef.current); };
  }, [consumeRestoreAutosaveGuard, messages, projectContext.projectId]);

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
          created_at: p.created_at,
        })));
        console.log('[loadUserProjects] 已加载', res.data.items.length, '个项目');
      }
    } catch (error) {
      console.error('[loadUserProjects] 加载项目列表失败:', error);
    }
  }, []);

  const ensureActiveProjectForAdvance = useCallback(async () => {
    if (projectContext.projectId && !projectContext.projectId.startsWith('local-')) {
      return {
        projectId: projectContext.projectId,
        currentStage: projectContext.currentStage,
      };
    }

    const fallbackProject = userProjects[0];
    if (!fallbackProject) {
      return null;
    }

    try {
      const res = await projectsApi.getWorkspace(fallbackProject.id);
      if (res.data) {
        applyWorkspaceRestore(res.data);
        return {
          projectId: fallbackProject.id,
          currentStage: res.data.progress.current_stage || fallbackProject.current_stage || '',
        };
      }
    } catch (error) {
      console.error('[advance-stage] 自动恢复最近项目失败:', error);
    }

    setProjectContext((prev) => ({
      ...prev,
      projectId: fallbackProject.id,
      projectName: fallbackProject.name,
      mode: fallbackProject.mode as 'light' | 'standard',
      currentStage: fallbackProject.current_stage || '',
    }));
    setShowChatHistory(true);
    return {
      projectId: fallbackProject.id,
      currentStage: fallbackProject.current_stage || '',
    };
  }, [applyWorkspaceRestore, projectContext.currentStage, projectContext.projectId, userProjects]);

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

  const ensureProjectCreated = useCallback(async (name: string, codeResult?: { code: string; language: string }) => {
    if (projectCreatingRef.current) return null;
    if (projectContext.projectId) {
      if (codeResult && !projectContext.projectId.startsWith('local-')) {
        projectsApi.saveCode(projectContext.projectId, {
          code: codeResult.code,
          language: codeResult.language,
        }).catch((error) => {
          console.error('[ensureProjectCreated] 初始代码保存失败:', error);
        });
      }
      return {
        id: projectContext.projectId,
        name: projectContext.projectName,
        current_stage: projectContext.currentStage,
        mode: projectContext.mode,
      };
    }
    projectCreatingRef.current = true;
    const projectName = name.length > 20 ? name.slice(0, 20) + '...' : name;
    const createdProject = await createProjectViaAPI(projectName, 'standard');
    if (createdProject) {
      setProjectContext(prev => ({
        ...prev,
        projectId: createdProject.id,
        projectName: createdProject.name,
        mode: createdProject.mode as 'light' | 'standard',
        currentStage: createdProject.current_stage || '',
      }));
      if (codeResult) {
        projectsApi.saveCode(createdProject.id, {
          code: codeResult.code,
          language: codeResult.language,
        }).catch((error) => {
          console.error('[ensureProjectCreated] 新项目代码保存失败:', error);
        });
      }
      return createdProject;
    } else {
      projectCreatingRef.current = false;
      return null;
    }
  }, [user, projectContext.projectId, createProjectViaAPI]);

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

  const handleStartNewProject = useCallback(() => {
    projectCreatingRef.current = false;
    setProjectContext({
      projectId: null,
      projectName: '',
      mode: null,
      currentStage: '',
      stageProgress: 0,
      evidenceCount: 0,
      teachingMode: 'guided',
    });
    setMessages([]);
    setInputValue('');
    setIsLoading(false);
    setActiveScene('开始项目');
    setShowChatHistory(false);
    setPendingQuestion(null);
    setShowEditor(false);
    setEditorCode(DEFAULT_CODE);
    setEditorLanguage('html');
    setPreviewHtml('');
    setEditorTab('code');
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
    setEditorLanguage(toEditorLanguage(language));
    setShowEditor(true);
    setEditorTab('code');
  }, []);

  const handleRunCode = useCallback(async (code: string, language: string) => {
    setEditorCode(code);
    setEditorLanguage(toEditorLanguage(language));
    setShowEditor(true);
    
    if (language === 'python' || language === 'py') {
      setRunningCode(true);
      try {
        const result = await codeExecutionApi.execute(code, 'python');
        const outputHtml = buildExecutionResultHtml(result.data ?? { success: false, output: '', error: '执行结果为空' }, code);
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
        const outputHtml = buildExecutionResultHtml(result.data ?? { success: false, output: '', error: '执行结果为空' }, editorCode);
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
      const language = normalizeCodeLanguage(match[1] || 'text');
      const code = match[2].trim();
      if (code.length > 10) {
        matches.push({ code, language });
      }
    }
    if (matches.length === 0) {
      return null;
    }
    const htmlBlock = matches.find((item) => item.language === 'html');
    const cssBlocks = matches.filter((item) => item.language === 'css');
    const jsBlocks = matches.filter((item) => item.language === 'javascript' || item.language === 'typescript');
    if (htmlBlock) {
      let mergedHtml = htmlBlock.code;
      if (cssBlocks.length > 0 && !/<style[\s>]/i.test(mergedHtml)) {
        const cssContent = cssBlocks.map((item) => item.code).join('\n\n');
        const styleBlock = `<style>\n${cssContent}\n</style>`;
        mergedHtml = /<\/head>/i.test(mergedHtml)
          ? mergedHtml.replace(/<\/head>/i, `${styleBlock}\n</head>`)
          : `${styleBlock}\n${mergedHtml}`;
      }
      if (jsBlocks.length > 0 && !/<script[\s>]/i.test(mergedHtml)) {
        const jsContent = jsBlocks.map((item) => item.code).join('\n\n');
        const scriptBlock = `<script>\n${jsContent}\n</script>`;
        mergedHtml = /<\/body>/i.test(mergedHtml)
          ? mergedHtml.replace(/<\/body>/i, `${scriptBlock}\n</body>`)
          : `${mergedHtml}\n${scriptBlock}`;
      }
      return { code: mergedHtml, language: 'html' };
    }
    const executableMatches = matches.filter((item) => isExecutableCodeLanguage(item.language));
    const candidatePool = executableMatches.length > 0 ? executableMatches : matches;
    return candidatePool.reduce((best, current) => {
      if (!best) {
        return current;
      }
      return current.code.length > best.code.length ? current : best;
    }, null as { code: string; language: string } | null);
  }, []);

  const handleAdvanceStage = useCallback(async () => {
    const activeProject = await ensureActiveProjectForAdvance();
    if (!activeProject?.projectId) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: 'assistant',
          content: '请先新建一个项目，或先从左侧项目列表打开一个项目，再推进下一阶段。',
        },
      ]);
      setShowChatHistory(true);
      return;
    }
    try {
      const response = await projectsApi.advanceStage(activeProject.projectId);
      if (!response.data) {
        throw new Error(response.message || '阶段推进失败');
      }
      const nextStage = response.data.current_stage || activeProject.currentStage;
      const stageDisplay = getStageDisplayInfo(nextStage || '');
      setProjectContext((prev) => ({
        ...prev,
        projectId: activeProject.projectId,
        currentStage: nextStage || prev.currentStage,
      }));
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: 'assistant',
          content: `已进入：${stageDisplay.label}\n${stageDisplay.hint}`,
        },
      ]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '阶段推进失败，请稍后重试';
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: 'assistant',
          content: `请求失败：${errMsg}`,
        },
      ]);
    }
  }, [ensureActiveProjectForAdvance]);

  const handleTeachingModeChange = useCallback(async (teachingMode: 'guided' | 'demo' | 'hands_on' | 'lecture') => {
    if (!projectContext.projectId || projectContext.projectId.startsWith('local-')) {
      setProjectContext((prev) => ({ ...prev, teachingMode }));
      return;
    }
    try {
      const response = await projectsApi.updateTeachingMode(projectContext.projectId, teachingMode);
      setProjectContext((prev) => ({
        ...prev,
        teachingMode: response.data?.teaching_mode || teachingMode,
      }));
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: 'assistant',
          content: `已切换到${TEACHING_MODES.find((item) => item.key === teachingMode)?.label || teachingMode}，接下来我会按这种教学方式继续。`,
        },
      ]);
      setShowChatHistory(true);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '教学模式切换失败';
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: 'assistant',
          content: `教学模式切换失败：${errMsg}`,
        },
      ]);
      setShowChatHistory(true);
    }
  }, [projectContext.projectId]);

  const handleSend = async (
    text?: string,
    sceneOverride?: string,
    requestOverrides?: {
      projectId?: string;
      context?: Record<string, unknown>;
      suppressQuestionCard?: boolean;
    },
  ) => {
    const message = (text || inputValue).trim();
    if (!message || isLoading) return;
    const directCodingIntent = hasDirectCodingIntent(message);
    const requestedOutputLanguage = inferRequestedOutputLanguage(message);
    const historyMessages = buildStreamHistory(messages);
    type StreamedProjectInfo = { project_id: string; project_name: string; current_stage?: string };
    const streamedProjectState: { current?: StreamedProjectInfo } = {};
    let effectiveProjectId = requestOverrides?.projectId ?? projectContext.projectId ?? undefined;
    let effectiveContext: Record<string, unknown> = {
      page: 'create',
      scene: sceneOverride || activeScene,
      authenticated: !!user,
      project_id: effectiveProjectId,
      teaching_mode: projectContext.teachingMode,
      current_stage: projectContext.currentStage,
      ...(requestOverrides?.context || {}),
    };
    if (directCodingIntent) {
      effectiveContext = {
        ...effectiveContext,
        force_code_generation: true,
        preferred_output_language: requestedOutputLanguage,
      };
    }
    if (!user) {
      const used = Number(localStorage.getItem('anonymous_chat_count') || '0');
      if (used >= 5) { setShowRegisterPrompt(true); return; }
    }

    if (directCodingIntent && !effectiveProjectId && user) {
      const bootstrapName = message.length > 20 ? `${message.slice(0, 20)}...` : message;
      const bootstrapProject = await createProjectViaAPI(bootstrapName, 'standard');
      if (bootstrapProject?.id) {
        effectiveProjectId = bootstrapProject.id;
        effectiveContext = {
          ...effectiveContext,
          project_id: bootstrapProject.id,
          current_stage: bootstrapProject.current_stage || 'stage_01_brainstorm',
          force_code_generation: true,
          preferred_output_language: requestedOutputLanguage,
        };
        setProjectContext(prev => ({
          ...prev,
          projectId: bootstrapProject.id,
          projectName: bootstrapProject.name,
          mode: (bootstrapProject.mode as 'light' | 'standard') || 'standard',
          currentStage: bootstrapProject.current_stage || prev.currentStage,
        }));
      }
    }
    if (directCodingIntent && effectiveProjectId) {
      effectiveContext = {
        ...effectiveContext,
        project_id: effectiveProjectId,
        current_stage: typeof effectiveContext.current_stage === 'string'
          ? effectiveContext.current_stage
          : (projectContext.currentStage || 'stage_01_brainstorm'),
      };
    }

    const userMsg: Message = { id: nextMessageId(), role: 'user', content: message };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setShowChatHistory(true);
    setIsLoading(true);
    let rawAssistantContent = '';
    let assistantContent = '';
    setMessages((prev) => [...prev, { id: nextMessageId(), role: 'assistant', content: '' }]);

    try {
      const streamResult = await stream(
        {
          message,
          projectId: effectiveProjectId,
          context: effectiveContext,
          skillId: activeSkill.id,
          messages: historyMessages,
        },
        (token) => {
          rawAssistantContent += token;
          assistantContent = cleanAssistantMessageContent(rawAssistantContent);
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === 'assistant') {
              last.content = assistantContent;
            }
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
            streamedProjectState.current = data;
            setProjectContext(prev => ({
              ...prev,
              projectId: data.project_id,
              projectName: data.project_name,
              mode: 'standard',
              currentStage: data.current_stage || prev.currentStage,
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
            if (!requestOverrides?.suppressQuestionCard) {
              setPendingQuestion(data);
            }
          },
          onContentUpdate: (dedupedContent) => {
            assistantContent = cleanAssistantMessageContent(dedupedContent);
            setMessages(prev => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                updated[lastIdx] = { ...updated[lastIdx], content: assistantContent };
              }
              return updated;
            });
            if (!requestOverrides?.suppressQuestionCard && !pendingQuestion) {
              const fallback = parseQuestionFromText(assistantContent);
              if (fallback) setPendingQuestion(fallback);
            }
          },
        },
      );

      assistantContent = cleanAssistantMessageContent(streamResult.content || assistantContent || rawAssistantContent);
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
          updated[lastIdx] = { ...updated[lastIdx], content: assistantContent };
        }
        return updated;
      });

      if (!requestOverrides?.suppressQuestionCard && !pendingQuestion) {
        const finalFallback = parseQuestionFromText(assistantContent);
        if (finalFallback) setPendingQuestion(finalFallback);
      }

      const codeResult = extractCodeFromResponse(assistantContent);
      if (codeResult) {
        handleWriteCodeToEditor(codeResult.code, codeResult.language);
        if (effectiveProjectId) {
          await projectsApi.saveCode(effectiveProjectId, {
            code: codeResult.code,
            language: codeResult.language,
          });
        } else {
          await ensureProjectCreated(message, codeResult);
        }
        setShowEditor(true);
      }

      let fallbackProject: Awaited<ReturnType<typeof ensureProjectCreated>> = null;
      const streamedProject = streamedProjectState.current;
      const resolvedProjectId = streamedProject?.project_id || effectiveProjectId || projectContext.projectId;
      const resolvedStage = streamedProject?.current_stage
        || (typeof effectiveContext.current_stage === 'string' ? effectiveContext.current_stage : '')
        || projectContext.currentStage
        || 'stage_01_brainstorm';
      if (!resolvedProjectId && !projectCreatingRef.current && (message.includes('项目') || message.includes('创建') || message.includes('新建'))) {
        const fallbackName = message.length > 30 ? message.slice(0, 30) + '...' : message;
        fallbackProject = await ensureProjectCreated(fallbackName);
      }

      const finalProjectId = streamedProject?.project_id || fallbackProject?.id || effectiveProjectId || projectContext.projectId;
      const finalProjectName = streamedProject?.project_name || fallbackProject?.name || projectContext.projectName;
      const finalStage = streamedProject?.current_stage || fallbackProject?.current_stage || resolvedStage;
      if (finalProjectId) {
        setProjectContext(prev => ({
          ...prev,
          projectId: finalProjectId || prev.projectId,
          projectName: finalProjectName || prev.projectName,
          mode: 'standard',
          currentStage: finalStage,
        }));
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

  // Listen for code-error messages from preview iframe (Ask AI button)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data && e.data.type === 'code-error' && e.data.msg) {
        handleSend(`我的代码运行出错了，错误信息是：${e.data.msg}\n\n请帮我修复这个错误。`);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [handleSend]);

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

        <Card className="p-0 overflow-hidden border-amber-100 bg-gradient-to-b from-amber-50 to-white">
          <div className="px-3 py-2 border-b border-amber-100 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-amber-600" />
            <h3 className="font-semibold text-amber-800 text-xs">项目过程</h3>
          </div>
          <div className="p-2 space-y-1.5">
            {PBL_GUIDE_STEPS.map((step, idx) => (
              <div key={step.key} className="rounded-lg border border-amber-100 bg-white px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-semibold">
                    {idx + 1}
                  </div>
                  <div className="text-base leading-none">{step.icon}</div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-800">{step.title}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{step.desc}</div>
                  </div>
                </div>
              </div>
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
                        projectsApi.getWorkspace(proj.id)
                          .then((res) => {
                            if (res.data) {
                              applyWorkspaceRestore(res.data);
                            }
                          })
                          .catch((error) => {
                            console.error('[project-open] 工作台恢复失败:', error);
                            if (codeSaveTimerRef.current) clearTimeout(codeSaveTimerRef.current);
                            if (chatSaveTimerRef.current) clearTimeout(chatSaveTimerRef.current);
                            setProjectContext(prev => ({
                              ...prev,
                              projectId: proj.id,
                              projectName: proj.name,
                              mode: proj.mode as 'light' | 'standard',
                              currentStage: proj.current_stage || '',
                            }));
                            setEditorCode(DEFAULT_CODE);
                            setShowEditor(true);
                            setEditorTab('code');
                            setMessages([]);
                            setPendingQuestion(null);
                            setIsLoading(false);
                            setShowChatHistory(true);
                          });
                      }}
                      className="flex-1 text-left min-w-0 cursor-pointer"
                    >
                      <div className={`text-xs truncate ${projectContext.projectId === proj.id ? 'text-teal-700 font-medium' : 'text-gray-600'}`}>
                        📍 {proj.name}
                      </div>
                      {proj.created_at && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(proj.created_at).toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
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
              onClick={handleStartNewProject}
              className="w-full flex items-center justify-center px-2 py-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:text-teal-600 hover:border-teal-300 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" /><span className="text-xs font-medium">新建项目</span>
            </button>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-gray-500" />
            <h3 className="font-semibold text-gray-800 text-xs">快捷</h3>
          </div>
          <div className="p-1 space-y-0.5">
            {projectContext.projectId && isTeachingModeStage(projectContext.currentStage) && (
              <div className="px-1.5 py-1.5 mb-1 rounded-lg border border-teal-100 bg-teal-50/60">
                <div className="text-[10px] font-medium text-teal-800 mb-1.5">教学模式</div>
                <div className="grid grid-cols-2 gap-1">
                  {TEACHING_MODES.map((mode) => (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => void handleTeachingModeChange(mode.key)}
                      className={`rounded-md border px-2 py-1 text-[10px] text-left transition-colors ${
                        projectContext.teachingMode === mode.key
                          ? 'border-teal-400 bg-white text-teal-700'
                          : 'border-transparent bg-white/70 text-gray-600 hover:border-teal-200 hover:text-teal-700'
                      }`}
                      title={mode.desc}
                    >
                      <div className="font-medium">{mode.label}</div>
                      <div className="text-[9px] text-gray-400 truncate">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => handleSceneClick('解释代码')} className="w-full flex items-center px-2.5 py-1.5 rounded-lg text-left text-xs text-gray-600 hover:bg-gray-50 transition-colors">
              <Code className="w-3 h-3 mr-1.5 text-gray-400" /> 解释当前代码
            </button>
            <button onClick={handleAdvanceStage} className="w-full flex items-center px-2.5 py-1.5 rounded-lg text-left text-xs text-gray-600 hover:bg-gray-50 transition-colors">
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
              <h2 className="text-lg font-semibold text-gray-800 mb-1">开始你的项目</h2>
              <p className="text-sm text-gray-500 mb-5 max-w-md text-center">描述你的目标、代码需求或项目想法，我会直接帮你推进。</p>
              <div className="grid grid-cols-2 gap-2 max-w-xl w-full mb-5">
                {PBL_GUIDE_STEPS.map((step) => (
                  <div key={step.key} className="rounded-xl border border-amber-100 bg-white/90 px-3 py-2 text-left shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-800">
                      <span className="text-sm">{step.icon}</span>
                      <span>{step.title}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-gray-500 mt-1">{step.desc}</p>
                  </div>
                ))}
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
                placeholder={isLoading ? 'AI 正在思考...' : showChatHistory ? '继续对话...' : '输入你的目标、项目想法或代码需求...'}
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
                  <CodeEditor code={editorCode} language={editorLanguage} onChange={(v) => setEditorCode(v)} />
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
