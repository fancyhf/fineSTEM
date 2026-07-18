import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquare, Code, Rocket, FileText, ChevronUp, Paperclip, Link2, FolderOpen, Plus, Sparkles, User, Zap, Play, Copy, Check, ArrowRight, BookOpen, PanelLeftClose, PanelLeftOpen, Terminal, Eye, Pencil, MoreHorizontal, Maximize2, PanelLeft, Loader2 } from 'lucide-react';
import { ContinueButton } from '../components/ContinueButton';
import { Card } from '../components/ui/Card';
import { CodeGeneratedEvent, useStreamingChat } from '../hooks/useStreamingChat';
import { MarkdownText } from '../components/MarkdownText';
import { LightRegisterPrompt } from '../components/LightRegisterPrompt';
import { CodePreview } from '../components/CodePreview';
import { CodeEditor } from '../components/CodeEditor';
import { ProjectFilesPanel } from '../components/ProjectFilesPanel';
import { QuestionCard, QuestionData } from '../components/QuestionCard';
import { useAuth } from '../contexts/AuthContext';
import { projectsApi, codeExecutionApi } from '../services/api';
import { ProjectWorkspaceResponse, FileEntry } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  skillInfo?: { skill_id: string; skill_name: string; sub_skill_name?: string };
  toolCalls?: { tool_name: string; success: boolean; data?: unknown }[];
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

/**
 * 移除指定标签（支持属性值含 > 的引号边界解析）
 * 例如：<option id="x" label="正常 > 异常">运行报错</option>
 */
function removeTagWithQuoteAware(text: string, tagName: string): string {
  const tagPattern = new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}>`, 'gi');
  return text.replace(tagPattern, (match) => {
    // 校验：起始标签的开标签范围是否正确（找到引号外的首个 >）
    const openEnd = findTagEnd(match, `<${tagName}`);
    if (openEnd < 0) return match;
    // 校验：闭合标签存在
    if (!new RegExp(`<\\/${tagName}>`, 'i').test(match)) return match;
    return '';
  });
}

/**
 * 找到标签的结束 > 位置（跳过引号内的 >）
 * 例如：在 <option label="A>B"> 中找到 label 后的 " 边界后的 >
 */
function findTagEnd(text: string, tagStart: string): number {
  const start = text.indexOf(tagStart);
  if (start < 0) return -1;
  let i = start + tagStart.length;
  let inSingle = false;
  let inDouble = false;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '>' && !inSingle && !inDouble) return i;
    i++;
  }
  return -1;
}

function sanitizeAssistantNarration(content: string): string {
  let cleaned = content;
  const originalLength = cleaned.length;

  // ── 精确移除 DSML 标签本身（只删标签，保留标签间的正文）──
  // DSML 标签格式：<｜｜DSML｜｜xxx> 或 </｜｜DSML｜｜>
  // | 是全角 U+FF5C（｜），不是半角 U+007C（|）
  // 关键：标签必须以 < 开头（行首或空白后），防止误吃行中间的内容
  // 例如 "projects/xxx.json</| | DSML | parameter>" 中的 "</|..." 之前是路径文本，
  // 不应被识别为 DSML 闭合标签的开始位置
  const dsmlTagPattern = /(?:^|(?<=[\s\n]))<\/?[|\uff5c]?[|\uff5c]?DSML[|\uff5c]?[^\n]*>/gi;
  cleaned = cleaned.replace(dsmlTagPattern, '');

  // ── 移除独立行的 invoke/parameter/tool_calls 关键字行（整行只有这些关键字）──
  cleaned = cleaned.replace(/^\s*(?:invoke|parameter)\s+name=\S+.*$/gim, '');
  cleaned = cleaned.replace(/^\s*tool_calls\s*$/gim, '');

  // ── 兜底：清理残破的 DSML 工具调用行（典型特征是含 <| / {/| 模式）──
  // 删除任意行内出现 DSML 残破 XML 的整行
  // 关键安全约束：行首必须有 DSML 残破模式才算可疑，正常正文中的 "<" 不删
  // 已知 LLM 残破模式：
  //   - <|...| DSML | ...>  （开标签）
  //   - </|...| DSML | ...> （闭合标签，正常不应该出现）
  //   - {/| DSML || parameter }  （LLM 残破闭合标签变体，{ 误生成 < 的产物）
  //   - | DSML | xxx  （孤立的 DSML 段）
  //   - |parameter| 或 | invoke |  （孤立的管道包裹工具调用）
  cleaned = cleaned.split('\n').map((line) => {
    const trimmed = line.trim();
    // 关键修复：放宽到"行内任意位置出现 DSML 残破模式"也清掉
    // 之前要求行首 <| 才清，导致"句末挂载的 </|...|>"（"我先问你：xxx</|...|>"）漏过
    // 安全约束：仅当行内 < 数量 ≤3 且行长度 < 2000 时才触发，避免误伤长正文
    const isShortLine = trimmed.length < 2000;
    const hasOpenAngle = (trimmed.match(/</g) || []).length;
    const isBrokenDsml =
      /<\|\s*\|?\s*DSML\s*\|/.test(trimmed) ||
      /<\/\s*\|\s*\|?\s*DSML\s*\|/.test(trimmed) ||
      /<\|\s*\|/.test(trimmed) ||
      /^\{\s*[/｜|]\s*\|/.test(trimmed) ||          // 残破闭合 {/| 或 {｜|
      /^\{\/\s*\|\s*DSML/i.test(trimmed) ||           // 残破闭合 {/| DSML
      /^<\/?\s*[|\uff5c]/.test(trimmed) ||
      // 末尾挂载的 DSML 残破（如 "projects/xx.json</| | DSML | parameter>"）
      /<\/?\s*[|\uff5c]\s*[|\uff5c]?\s*DSML/i.test(trimmed) ||
      // 关键：句中/句末出现的 DSML 闭合标签（"<|...| DSML ...>" 整段）也清
      // 安全约束：必须 < 数 ≤3 且行较短，避免误伤正常正文
      (isShortLine && hasOpenAngle <= 3 && (
        /[|\uff5c]\s*DSML\s*\|/i.test(trimmed) ||
        /<\/?\s*[|\uff5c][^>]{0,80}parameter/i.test(trimmed) ||
        // 关键：行末挂载的孤悬残片（"xxx</|...|DSML|parameter>"）
        />\s*<\s*[|\uff5c][^>]*$/i.test(trimmed) ||
        /<\/?\s*[|\uff5c][^>]*$/i.test(trimmed)
      )) ||
      /\bDSML\s*\|/i.test(trimmed) ||
      /^\s*[|｜]\s*parameter\s*[|｜]/i.test(trimmed) ||
      /^\s*[|｜]\s*invoke\s+name\s*=/i.test(trimmed) ||
      // 关键：UUID + 未闭合 < 的孤悬残片（如 "a1b57213-b531-...2055a</"）
      // 这是 LLM 工具调用 trace_id 泄露到 content 中，完全不是用户可见内容
      (isShortLine && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}<\/?\s*$/.test(trimmed));
    return isBrokenDsml ? '' : line;
  }).join('\n');

  // ── 清理 LLM 模拟工具调用的命令行/代码残片 ──
  // AI 有时不用真正的 tool_calls，而是输出 cat/ls/os.walk/import os 等来"模拟读文件"
  // 这些不是用户可见的有效内容，必须清除
  cleaned = cleaned.split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    // 模式 1：shell 命令（cat/ls/find/grep/head/tail/wc 等 + 文件路径）
    if (/^\s*(cat|ls|find|grep|head|tail|wc|less|more|file|stat|tree|diff|echo)\s+[\w/.-~]/.test(trimmed)) return '';
    // 模式 2：Python 文件操作代码（import os; os.walk / open(...).read() / pathlib）
    if (/^\s*(import\s+os|from\s+os\s+import|from\s+pathlib|os\.walk|os\.path\.exists|os\.listdir|open\(['"][\w/.]+['"]\)\.read|Path\(['"])/.test(trimmed)) return '';
    // 模式 3：纯文件路径行（projects/xxx/docs/xx.json、/dev/null、/tmp/xxx 等）
    if (/^\/(dev|null|tmp|home|usr|var|etc|opt)\//.test(trimmed)) return '';
    if (/^(projects\/|docs\/|src\/|apps\/)[\w/.-]+\.(json|md|txt|py|js|ts|yaml|yml|csv)$/.test(trimmed)) return '';
    // 模式 4：孤立的 UUID 行（trace_id / project_id 泄露，大小写均匹配）
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(trimmed)) return '';
    // 模式 4a：工具结果 JSON / JSON Patch 泄露，不属于用户可读对话内容
    if (/["']op["']\s*:\s*["'](?:replace|add|remove)["']/.test(trimmed)) return '';
    if (/["']path["']\s*:\s*["']\//.test(trimmed)) return '';
    if (/^[{[].*(project_id|tool_call_id|stage_passed|current_stage|teaching_mode).*[\]}]?$/i.test(trimmed)) return '';
    // 模式 4b：孤立的 "Skill" / skill 单词行（LLM 伪造工具调用残留）
    if (/^skill$/i.test(trimmed)) return '';
    // 模式 4c：孤立的内部标记行：仅由 UUID + 可选的 "Skill" 组成
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\s+skill$/i.test(trimmed)) return '';
    // 模式 5：孤立的残缺标签碎片（常见于流式输出被中途截断时的 "</"）
    if (/^<\/?$/.test(trimmed) || /^\/>$/.test(trimmed) || /^>$/.test(trimmed)) return '';
    return line;
  }).join('\n');

  // 删除空行
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').replace(/^\s*\n/gm, '');

  // ── 末尾兜底清理：流式输出被中途截断时残留的孤悬 < / </ / <｜ 等碎片 ──
  // 例如 AI 输出末尾出现 "好的<" 或 "正在生成代码</"，这些都是流式中断遗留
  // 仅处理整段文本末尾，避免误伤正常的 < 字符（如 "a < b"）
  cleaned = cleaned.replace(/[\s\n]*<\/?[\s\S]{0,30}$/u, (match) => {
    // 只清理"看起来是不完整标签"的末尾片段
    // 安全条件：片段不含 > （即未闭合），且长度 ≤ 30
    if (match.includes('>')) return match;
    // 检查是否仅为残破标签开始（< / </ / <｜...）
    const trimmed = match.trim();
    if (/^<\/?[\s|｜\w-]{0,30}$/.test(trimmed)) {
      return '';
    }
    return match;
  });

  // ── 移除 question/option 结构化标签 ──
  // 关键：
  //   1. 标签内的属性值可能含 >（如 label="正常 > 异常"），需要正确解析引号边界
  //   2. option 标签始终清理（由 QuestionCard 独立渲染，原始内容由 parseQuestionFromText 解析）
  //   3. question 标签也始终清理

  // 始终彻底删除所有 option 标签
  cleaned = cleaned.replace(/<option\b[^>]*>[\s\S]*?<\/option>/gi, (m) => {
    return /<\/option>/i.test(m) ? '' : m;
  });
  cleaned = removeTagWithQuoteAware(cleaned, 'option');
  // 兜底：单行 option 标签
  cleaned = cleaned.replace(/^\s*<\/?option\b.*$/gim, '');

  // 始终彻底删除所有 question 标签
  cleaned = cleaned.replace(/<question\b[^>]*>[\s\S]*?<\/question>/gi, '');
  cleaned = removeTagWithQuoteAware(cleaned, 'question');
  // 兜底：单行 question/label/desc 标签
  cleaned = removeTagWithQuoteAware(cleaned, 'label');
  cleaned = removeTagWithQuoteAware(cleaned, 'desc');
  cleaned = cleaned.replace(/^\s*<\/?(?:question|label|desc)\b.*$/gim, '');

  // ── 清理杂项 ──
  cleaned = cleaned.replace(/^\s*```(?:markdown|md)?\s*复制\s*$/gim, '```');

  // 调试日志
  if (cleaned.length !== originalLength) {
    console.log('[sanitize] 输入:', originalLength, '→ 输出:', cleaned.length, '移除:', originalLength - cleaned.length);
    if (cleaned.includes('DSML') || /[|\uff5c]DSML/.test(cleaned)) {
      console.warn('[sanitize] ⚠️ 残留! 前200字:', cleaned.slice(0, 200));
    }
  }

  cleaned = collapseRepeatedFragments(cleaned);
  return cleaned;
}

/**
 * 清理历史 assistant 消息内容（兜底删除所有 option 标签）
 * 由于 cleanAssistantMessageContent 已始终清理 option，此函数等价于 cleanAssistantMessageContent
 */
function cleanHistoricalAssistantContent(content: string): string {
  return cleanAssistantMessageContent(content);
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
  { key: 'stage_00', label: '第 1 阶段：准备阶段', shortLabel: '1. 准备阶段', icon: '🚀' },
  { key: 'stage_01', label: '第 2 阶段：脑暴选题', shortLabel: '2. 脑暴选题', icon: '💭' },
  { key: 'stage_02', label: '第 3 阶段：开题立项', shortLabel: '3. 开题立项', icon: '📋' },
  { key: 'stage_03', label: '第 4 阶段：范围裁剪', shortLabel: '4. 范围裁剪', icon: '✂️' },
  { key: 'stage_04', label: '第 5 阶段：轨道选择', shortLabel: '5. 轨道选择', icon: '🛤️' },
  { key: 'stage_05', label: '第 6 阶段：设计蓝图', shortLabel: '6. 设计蓝图', icon: '📐' },
  { key: 'stage_06', label: '第 7 阶段：分步计划', shortLabel: '7. 分步计划', icon: '📝' },
  { key: 'stage_07', label: '第 8 阶段：编码实现', shortLabel: '8. 编码实现', icon: '💻' },
  { key: 'stage_08', label: '第 9 阶段：评估展示', shortLabel: '9. 评估展示', icon: '🎯' },
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
  return /(开始编码|开始开发|给我完整的代码|完整代码|用\s*(Python|JavaScript|TypeScript|HTML|CSS)\s*实现|直接进入编码|直接推进到编码|进入执行阶段|直接做|立即做|马上做|不要再问|别再问|别问了|直接实现|直接开发|跳过引导|跳过开题|跳过前置|直接给代码|直接输出代码|直接给出完整代码|写到编辑器|写入编辑器|代码为空|代码是空|没有代码|没代码|重新生成代码|重新写代码|生成代码文件|main\.py\s*(为空|没有|没|空的)|代码文件.*(为空|没有|没|空的))/i.test(message);
}

function hasStrongCodingIntent(message: string): boolean {
  return /(开始编码|开始开发|给我完整的代码|完整代码|用\s*(Python|JavaScript|TypeScript|HTML|CSS)\s*实现|直接进入编码|直接推进到编码|进入执行阶段|直接实现|直接开发|直接给代码|直接输出代码|直接给出完整代码|写到编辑器|写入编辑器)/i.test(message);
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

function buildFallbackCode(language: string): { code: string; language: string; filename: string } | null {
  // 不再返回硬编码的 MVP 模板代码
  // 返回 null 让调用方知道没有 fallback 代码可用
  return null;
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
              <span className="hidden xl:inline">{'shortLabel' in step && typeof step.shortLabel === 'string' ? step.shortLabel : step.label}</span>
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
  const createBootstrapIdeaFallback = (): QuestionData => ({
    id: `q-bootstrap-idea-fallback-${Date.now()}`,
    title: '你有初步想法了吗？',
    options: [
      {
        id: 'brainstorm',
        label: '完全没想法，需要脑爆',
        description: '从零开始，一起探索可做的项目方向',
      },
      {
        id: 'direction',
        label: '有个大概方向',
        description: '我知道想做什么类型，但还需要一起收敛',
      },
      {
        id: 'idea',
        label: '已经有具体想法',
        description: '直接基于我的想法进入立项和方案设计',
        recommended: true,
      },
    ],
    multiple: false,
    step: 3,
    totalSteps: 3,
  });
  const extractQuestionProgress = (source: string): { step?: number; totalSteps?: number } => {
    const stepMatch = source.match(/\bstep\b\s*(?:=|:)\s*["']?(\d+)/i);
    const totalMatch = source.match(/\b(?:total_steps|totalSteps|total)\b\s*(?:=|:)\s*["']?(\d+)/i);
    return {
      step: stepMatch ? Number(stepMatch[1]) : undefined,
      totalSteps: totalMatch ? Number(totalMatch[1]) : undefined,
    };
  };
  const isGenericQuestion = (
    title: string,
    options: Array<{ id: string; label: string; description?: string }>,
  ): boolean => {
    const normalizedTitle = title.trim();
    const normalizedLabels = new Set(options.map((option) => option.label.trim()).filter(Boolean));
    const genericTitles = new Set([
      '请选择',
      '接下来你想怎么做？',
      '接下来你想怎么做',
      '你想怎么继续？',
      '你想怎么继续',
    ]);
    const genericLabels = new Set(['继续', '详细说说', '换个方向', '了解更多', '其他']);
    if (genericTitles.has(normalizedTitle)) return true;
    return normalizedLabels.size > 0 && Array.from(normalizedLabels).every((label) => genericLabels.has(label));
  };
  const extractJsonQuestion = (source: string): { title: string; options: { id: string; label: string; description?: string }[]; multiple: boolean } | null => {
    const candidates = [...source.matchAll(/```json\s*([\s\S]*?)```/gi)].map(match => match[1].trim());
    if (source.includes('"questions"')) {
      candidates.push(source.trim());
    }

    for (const candidate of candidates) {
      if (!candidate.includes('"questions"')) continue;
      const startIndexes = Array.from(candidate.matchAll(/\{/g)).map(match => match.index ?? -1).filter(index => index >= 0);
      for (const startIndex of startIndexes) {
        try {
          const payload = JSON.parse(candidate.slice(startIndex));
          if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { questions?: unknown[] }).questions)) continue;
          const firstQuestion = (payload as { questions: Array<Record<string, unknown>> }).questions[0];
          if (!firstQuestion || !Array.isArray(firstQuestion.options)) continue;
          const options = firstQuestion.options.flatMap((option, index) => {
            if (!option || typeof option !== 'object') return [];
            const label = String((option as { label?: unknown }).label ?? '').trim();
            if (!label) return [];
            const description = String((option as { description?: unknown }).description ?? '').trim() || undefined;
            return [{ id: `opt-${index + 1}`, label: label.slice(0, 100), description: description?.slice(0, 200) }];
          });
          if (options.length === 0) continue;
          return {
            title: String(firstQuestion.question ?? firstQuestion.header ?? '请选择').trim(),
            options,
            multiple: Boolean(firstQuestion.multiSelect),
          };
        } catch {
          continue;
        }
      }
    }
    return null;
  };
  const extractPlaintextOptions = (source: string): {
    title: string | null;
    options: { id: string; label: string; description?: string; groupId?: string; groupTitle?: string }[];
    optionGroups?: { id: string; title: string; optionIds: string[] }[];
    requireEachGroup?: boolean;
    multiple?: boolean;
  } => {
    const lines = source.split('\n').map((line) => line.replace(/\r/g, ''));
    const optionPattern = /^\s*(?:[-*•]\s+|(?:\d{1,2}|[A-Za-z]|[一二三四五六七八九十]+)[.)、]\s+|(?:[0-9]\uFE0F?\u20E3|🔟|[①②③④⑤⑥⑦⑧⑨⑩])\s*)(.+?)\s*$/u;
    const candidateBlocks: Array<{ start: number; end: number }> = [];
    let blockStart = -1;

    lines.forEach((line, index) => {
      if (optionPattern.test(line)) {
        if (blockStart < 0) blockStart = index;
      } else if (blockStart >= 0) {
        if (index - blockStart >= 2) candidateBlocks.push({ start: blockStart, end: index });
        blockStart = -1;
      }
    });
    if (blockStart >= 0 && lines.length - blockStart >= 2) {
      candidateBlocks.push({ start: blockStart, end: lines.length });
    }
    if (candidateBlocks.length === 0) return { title: null, options: [] };

    const lastBlock = candidateBlocks[candidateBlocks.length - 1];
    const trailingQuestionLine = lines
      .slice(lastBlock.end)
      .map((line) => line.trim())
      .filter(Boolean)
      .find((line) => /[？?]/.test(line) && line.length <= 120) ?? null;

    const lastSeparatorBeforeOptions = lines
      .slice(0, lastBlock.end)
      .reduce((lastIndex, line, index) => (/^\s*-{3,}\s*$/.test(line) ? index : lastIndex), -1);
    const selectedBlocks = trailingQuestionLine
      ? candidateBlocks.filter((block) => block.start > lastSeparatorBeforeOptions)
      : [lastBlock];

    let title: string | null = null;
    if (trailingQuestionLine) {
      title = trailingQuestionLine;
    } else {
      for (let index = lastBlock.start - 1; index >= 0; index -= 1) {
        const candidate = lines[index].trim();
        if (!candidate) continue;
        if (/[？?：:]/.test(candidate) || candidate.length <= 80) {
          title = candidate.replace(/[：:]\s*$/, '');
          break;
        }
      }
    }

    const getGroupTitle = (block: { start: number; end: number }, groupIndex: number): string => {
      for (let index = block.start - 1; index > lastSeparatorBeforeOptions; index -= 1) {
        const candidate = lines[index].trim();
        if (!candidate || optionPattern.test(candidate) || /^\s*-{3,}\s*$/.test(candidate)) continue;
        return candidate.replace(/^[#\s]+/, '').replace(/[：:]\s*$/, '').trim() || `第 ${groupIndex + 1} 类`;
      }
      return `第 ${groupIndex + 1} 类`;
    };

    const usedLabels = new Set<string>();
    const options: { id: string; label: string; description?: string; groupId?: string; groupTitle?: string }[] = [];
    const optionGroups: { id: string; title: string; optionIds: string[] }[] = [];

    const isStatusListLine = (line: string): boolean => {
      return /[\u2705\u274c\u2714\u2718\u274e\u2611\u2612\u26a0\u2757\u2753]/.test(line) ||
        /\b(?:docs|src|assets|tests|reports|public|app|pages|components|backend|frontend)\//.test(line) ||
        /\.(json|md|py|ts|tsx|js|html|css)\b/.test(line) ||
        /（已补|已生成|缺失|已完成|未完成|待完成）/.test(line) ||
        /\(已补|已生成|缺失|已完成|未完成|待完成\)/.test(line);
    };

    const isStatusListBlock = (block: { start: number; end: number }): boolean => {
      const blockLines = lines.slice(block.start, block.end).filter((line) => optionPattern.test(line));
      if (blockLines.length === 0) return false;
      const statusCount = blockLines.filter(isStatusListLine).length;
      return statusCount / blockLines.length >= 0.5;
    };

    selectedBlocks.forEach((block, groupIndex) => {
      if (isStatusListBlock(block)) return;
      const groupId = `group-${groupIndex + 1}`;
      const groupTitle = getGroupTitle(block, groupIndex);
      const optionIds: string[] = [];
      lines.slice(block.start, block.end).forEach((line) => {
        const match = line.match(optionPattern);
        if (!match) return;
        const body = match[1].trim();
        if (!body) return;
        let label = body;
        let description: string | undefined;
        const cnParts = body.split('：');
        const enParts = body.split(':');
        if (cnParts.length > 1) {
          label = cnParts[0].trim();
          description = cnParts.slice(1).join('：').trim() || undefined;
        } else if (enParts.length > 1) {
          label = enParts[0].trim();
          description = enParts.slice(1).join(':').trim() || undefined;
        }
        const normalizedLabel = label.replace(/^[*_`\s]+|[*_`\s]+$/g, '').slice(0, 100);
        if (!normalizedLabel || usedLabels.has(normalizedLabel)) return;
        const optionId = `opt-${options.length + 1}`;
        usedLabels.add(normalizedLabel);
        optionIds.push(optionId);
        options.push({
          id: optionId,
          label: normalizedLabel,
          description: description?.slice(0, 200),
          groupId,
          groupTitle,
        });
      });
      if (optionIds.length > 0) {
        optionGroups.push({ id: groupId, title: groupTitle, optionIds });
      }
    });

    const hasMultipleGroups = optionGroups.length > 1;
    return {
      title,
      options,
      optionGroups: hasMultipleGroups ? optionGroups : undefined,
      requireEachGroup: hasMultipleGroups || undefined,
      multiple: hasMultipleGroups || undefined,
    };
  };

  if (!hasQuestionWrapper && !hasBareOptions) {
    const progress = extractQuestionProgress(text);
    const jsonResult = extractJsonQuestion(text);
    if (jsonResult) {
      if (isGenericQuestion(jsonResult.title, jsonResult.options)) return null;
      return {
        id: `q-fallback-${Date.now()}`,
        title: jsonResult.title,
        options: jsonResult.options,
        multiple: jsonResult.multiple,
        step: progress.step,
        totalSteps: progress.totalSteps,
      };
    }
    const plaintextResult = extractPlaintextOptions(text);
    if (plaintextResult.options.length === 0) {
      const trimmedText = text.trim();
      if (
        /(最后一个问题|最后一题)[:：]?\s*$/.test(trimmedText) ||
        (/(最后一个问题|最后一题)/.test(text) && /(初步项目想法|初步想法|项目想法|你的起点)/.test(text))
      ) {
        return createBootstrapIdeaFallback();
      }
      return null;
    }
    if (isGenericQuestion(plaintextResult.title || '请选择', plaintextResult.options)) return null;
    return {
      id: `q-fallback-${Date.now()}`,
      title: plaintextResult.title || '请选择',
      options: plaintextResult.options,
      optionGroups: plaintextResult.optionGroups,
      requireEachGroup: plaintextResult.requireEachGroup,
      multiple: plaintextResult.multiple,
      step: progress.step,
      totalSteps: progress.totalSteps,
    };
  }

  // 关键修复：只解析**最后一个** question 块或最后一段裸 option
  // 防止历史 question 标签在累积内容中被重复解析
  const lastQuestionStart = (() => {
    const matches = [...text.matchAll(/<question\b[^>]*>/gi)];
    return matches.length > 0 ? matches[matches.length - 1].index ?? -1 : -1;
  })();
  const lastOptionStart = (() => {
    const matches = [...text.matchAll(/<option\s+id=["'][^"']*["']/gi)];
    return matches.length > 0 ? matches[matches.length - 1].index ?? -1 : -1;
  })();

  // 取最后一次 question/option 出现的起始位置
  const lastRelevantStart = Math.max(
    hasQuestionWrapper ? lastQuestionStart : -1,
    hasBareOptions ? lastOptionStart : -1,
  );
  if (lastRelevantStart < 0) return null;

  // 截取最后一段相关的文本
  const textFromLast = text.slice(lastRelevantStart);
  const progress = extractQuestionProgress(textFromLast);

  const jsonResult = extractJsonQuestion(textFromLast);
  if (jsonResult) {
    if (isGenericQuestion(jsonResult.title, jsonResult.options)) return null;
    return {
      id: `q-fallback-${Date.now()}`,
      title: jsonResult.title,
      options: jsonResult.options,
      multiple: jsonResult.multiple,
      step: progress.step,
      totalSteps: progress.totalSteps,
    };
  }

  let title = '请选择';
  const questionBlockMatch = textFromLast.match(/<question\b[^>]*title=["']([^"']*)["']/i);
  if (questionBlockMatch) {
    title = questionBlockMatch[1];
  } else {
    // 裸 option：取该段在最后一个 option 之前的第一行非空文本作为标题
    const beforeOptions = textFromLast.split(/<option\s+id=["'][^"']*["'][^>]*>/i)[0] || '';
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
  // 只在截取后的文本中搜索 option
  const optRegex = /<option\s+id=["']([^"']*)["'][^>]*?(?:label=["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/option>/gi;
  let optMatch;
  while ((optMatch = optRegex.exec(textFromLast)) !== null) {
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
  if (options.length === 0) {
    const plaintextResult = extractPlaintextOptions(textFromLast);
    if (plaintextResult.options.length === 0) return null;
    if (isGenericQuestion(plaintextResult.title || title, plaintextResult.options)) return null;
    return {
      id: `q-fallback-${Date.now()}`,
      title: plaintextResult.title || title,
      options: plaintextResult.options,
      optionGroups: plaintextResult.optionGroups,
      requireEachGroup: plaintextResult.requireEachGroup,
      multiple: plaintextResult.multiple,
      step: progress.step,
      totalSteps: progress.totalSteps,
    };
  }

  if (isGenericQuestion(title, options)) return null;

  return {
    id: `q-fallback-${Date.now()}`,
    title,
    options,
    step: progress.step,
    totalSteps: progress.totalSteps,
  };
}

function isSameQuestionData(left: QuestionData | null, right: QuestionData | null): boolean {
  if (!left || !right) return false;
  if (left.title !== right.title) return false;
  if ((left.step ?? null) !== (right.step ?? null)) return false;
  if ((left.totalSteps ?? null) !== (right.totalSteps ?? null)) return false;
  if (left.options.length !== right.options.length) return false;
  return left.options.every((option, index) => {
    const candidate = right.options[index];
    return candidate
      && option.id === candidate.id
      && option.label === candidate.label
      && (option.description ?? null) === (candidate.description ?? null);
  });
}

function isRedundantProjectNameQuestion(question: QuestionData, projectContext: ProjectContext): boolean {
  const hasConfirmedProjectName = Boolean(projectContext.projectName.trim());
  if (!hasConfirmedProjectName) return false;
  const normalizedTitle = question.title.replace(/\s+/g, '');
  const asksProjectName = /(项目名称|项目名|叫什么名字|名字是什么)/.test(normalizedTitle);
  if (asksProjectName) return true;

  const normalizedProjectName = projectContext.projectName.trim();
  return question.options.some((option) => {
    const label = option.label.trim();
    return label === normalizedProjectName || /换个名字|改名|重新命名/.test(label);
  });
}

function normalizeQuestionProgress(
  question: QuestionData,
  previousQuestions: QuestionData[],
  knownQuestions: QuestionData[] = previousQuestions,
): QuestionData {
  const derivedStep = question.step ?? (previousQuestions.length + 1);
  const highestKnownTotal = knownQuestions.reduce(
    (max, item) => Math.max(max, item.totalSteps ?? 0),
    question.totalSteps ?? 0,
  );
  return {
    ...question,
    step: derivedStep,
    totalSteps: question.totalSteps ?? (highestKnownTotal > 0 ? Math.max(highestKnownTotal, derivedStep) : undefined),
  };
}

function EnhancedMarkdownText({
  content,
  isCurrentQuestion = true,
  projectId,
  onWriteCode,
  onRunCode,
}: {
  content: string;
  isCurrentQuestion?: boolean;
  projectId?: string | null;
  onWriteCode: (code: string, lang: string) => void;
  onRunCode: (code: string, lang: string) => void;
}) {
  // 历史消息（非当前问题）：彻底删除所有 option 标签，避免已答问题在历史消息中显示
  const displayContent = isCurrentQuestion ? content : cleanHistoricalAssistantContent(content);
  const parts: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = codeBlockRegex.exec(displayContent)) !== null) {
    if (match.index > lastIndex) parts.push(<MarkdownText key={key++} content={displayContent.slice(lastIndex, match.index)} projectId={projectId} />);
    const language = match[1] || 'text';
    const code = match[2].trim();
    parts.push(<CodeBlock key={key++} code={code} language={language} onWriteToEditor={() => onWriteCode(code, language)} onRun={() => onRunCode(code, language)} />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < displayContent.length) parts.push(<MarkdownText key={key++} content={displayContent.slice(lastIndex)} projectId={projectId} />);
  return <>{parts}</>;
}

function _escHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildHtmlFromCode(code: string, language: string): string {
  if (!code || !code.trim()) return '';
  if (language === 'html') return code.includes('<!DOCTYPE') || code.includes('<html') ? code : `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0}body{font-family:-apple-system,sans-serif;padding:20px;background:#f9fafb}</style></head><body>${code}</body></html>`;
  if (language === 'javascript' || language === 'js') {
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
  console.warn=function(){add(Array.prototype.slice.call(arguments).join('\\n'),'info');_warn.apply(console,arguments)};
  try { (new Function(${JSON.stringify(code)}))(); if(!has) add('OK - no output','ok'); }
  catch(e) {
    var d=document.createElement('div');d.className='err';
    var btnId = '__fix_err_btn_' + Date.now();
    d.innerHTML='<b>语法错误 / 运行错误：</b><br>'+_escHtml(e.message)+'<br><br><button class="btn" id="'+btnId+'">让 AI 修复此错误</button>';
    setTimeout(function() {
      var btn = document.getElementById(btnId);
      if (btn) {
        btn.onclick = function() {
          window.parent && window.parent.postMessage({type: 'code-error', msg: e.message}, '*');
          btn.textContent = '已发送给AI...';
          btn.disabled = true;
          btn.style.background = '#94a3b8';
        };
      }
    }, 0);
    out.appendChild(d);
    window.__codeError=e.message;
  }
  function _escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
})();
</script></body></html>`;
  }
  if (language === 'css') {
    // CSS 代码：创建一个示例 HTML 来展示样式效果
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${code}</style></head><body>
<div style="padding:20px;font-family:-apple-system,sans-serif;">
<h3>CSS 预览</h3>
<div class="css-preview-demo" style="border:1px solid #e5e7eb;border-radius:8px;padding:20px;background:#fff;">
  <h4>标题示例 (h4)</h4>
  <p>段落示例 - 这是一段文字用来展示 CSS 样式效果。</p>
  <button class="btn-demo">按钮示例</button>
  <div class="box-demo">盒子示例</div>
</div>
</div></body></html>`;
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
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">📤 输出结果：</div>
        <pre style="background: #fafafa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; overflow-x: auto;">${escapedOutput}</pre>
      </div>` : ''}
      ${hasError ? `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 12px; color: #dc2626; margin-bottom: 4px;">错误 / 警告：</div>
        <pre style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; overflow-x: auto; color: #dc2626;">${escapedError}</pre>
        <button id="__ask_ai_btn" style="display:inline-block;margin-top:8px;padding:8px 16px;background:#0ea5e9;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;" onclick="(function(){window.parent.postMessage({type:'code-error',msg:${JSON.stringify(result.error)}},'*');this.textContent='已发送给AI...';this.disabled=true;this.style.background='#94a3b8';})()">让 AI 修复此错误</button>
      </div>` : ''}
      ${!result.output && !hasError ? `<div style="font-size:12px;color:#9ca3af;margin-bottom:12px;">(无标准输出)</div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;">
        <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:8px;">📋 代码分析</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
          <span style="padding:2px 8px;background:#e0e7ff;color:#4338ca;border-radius:4px;font-size:11px;">${code.split('\n').filter(function(l){return l.trim();}).length} 行代码</span>
          ${/^\s*import\s|^\s*from\s/.test(code) ? '<span style="padding:2px 8px;background:#dbeafe;color:#1d4ed8;border-radius:4px;font-size:11px;">📦 有导入</span>' : ''}
          ${/\bdef\s+\w+\s*\(/.test(code) ? '<span style="padding:2px 8px;background:#dcfce7;color:#16a34a;border-radius:4px;font-size:11px;">⚡ 有函数</span>' : ''}
          ${code.includes('print(') ? '<span style="padding:2px 8px;background:#d1fae5;color:#059669;border-radius:4px;font-size:11px;">🖨️ 有打印</span>' : '<span style="padding:2px 8px;background:#fef9c3;color:#a16207;border-radius:4px;font-size:11px;">💡 无打印语句</span>'}
        </div>
        <details open style="cursor:pointer;">
          <summary style="font-size:12px;color:#64748b;outline:none;">📄 查看完整代码 ▼</summary>
          <pre style="margin-top:8px;background:#1e293b;color:#e2e8f0;padding:12px;border-radius:6px;font-size:11px;line-height:1.5;overflow-x:auto;max-height:300px;">${escapedCode}</pre>
        </details>
        ${!code.includes('print(') ? '<div style="margin-top:10px;padding:10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;font-size:11px;color:#1e40af;">💡 <strong>提示：</strong>此代码没有 print() 输出语句。如需查看运行效果，请在代码中添加 print(变量名) 来输出变量的值。</div>' : ''}
      </div>` : ''}
    </div>
  `;
}

function upsertWorkspaceFiles(
  files: FileEntry[],
  fileName: string,
  code: string,
  language: string,
): FileEntry[] {
  if (!fileName || files.length === 0) {
    return files;
  }
  let matched = false;
  const nextFiles = files.map((file) => {
    if (file.name !== fileName) {
      return file;
    }
    matched = true;
    return {
      ...file,
      content: code,
      language,
    };
  });
  return matched ? nextFiles : files;
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

function buildStreamlitIframeHtml(url: string, statusMsg: string): string {
  // Streamlit 模式：嵌入 iframe 真实预览 UI
  // 使用宽高 100% 让 Streamlit 自适应容器，并禁用其默认的 max-width
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        html, body { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        /* Streamlit 内部主容器使用 100% 宽度 */
        [data-testid="stAppViewContainer"] > .main { max-width: 100% !important; padding-left: 1rem !important; padding-right: 1rem !important; }
      </style>
    </head>
    <body>
      <div style="height: 100vh; width: 100%; display: flex; flex-direction: column;">
        <div style="padding: 6px 10px; background: #ecfdf5; border-bottom: 1px solid #d1fae5; display: flex; align-items: center; justify-content: space-between; font-size: 12px; flex-shrink: 0;">
          <span style="color: #065f46; font-weight: 500;">${statusMsg || '🚀 Streamlit 服务已启动'}</span>
          <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #059669; text-decoration: none; font-size: 11px; padding: 2px 8px; background: white; border: 1px solid #d1fae5; border-radius: 4px;">
            🔗 新窗口打开
          </a>
        </div>
        <iframe
          src="${url}"
          style="flex: 1 1 auto; width: 100%; min-height: 0; height: 100%; border: none; background: white; display: block;"
          title="Streamlit App Preview"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
        ></iframe>
      </div>
    </body>
    </html>
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
  const [showRunResultModal, setShowRunResultModal] = useState(false);
const [runResultHtml, setRunResultHtml] = useState('');
const [runResultUrl, setRunResultUrl] = useState<string | null>(null); // Streamlit 等直接 URL 预览
const [runResultBlobUrl, setRunResultBlobUrl] = useState<string | null>(null); // Blob URL 用于 HTML/JS/CSS 预览
  const [projectFiles, setProjectFiles] = useState<FileEntry[]>([]);
  const [activeFileName, setActiveFileName] = useState('main.py');
  const [showFilesPanel, setShowFilesPanel] = useState(false);
  const [runStatus, setRunStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [editorWidth, setEditorWidth] = useState(() => {
    const saved = localStorage.getItem('finestem_editor_width');
    return saved ? Number(saved) : 480;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [activeSkill, setActiveSkill] = useState<SkillOption>(SKILL_OPTIONS[0]);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [moreMenuProjectId, setMoreMenuProjectId] = useState<string | null>(null);
    const [pendingQuestion, setPendingQuestion] = useState<QuestionData | null>(null);
    const [questionStack, setQuestionStack] = useState<QuestionData[]>([]);
    const [showContinueButton, setShowContinueButton] = useState(false);
    const [isContinuing, setIsContinuing] = useState(false);
    const lastMessageRef = useRef<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const messageSeqRef = useRef(0);
  const handleSendRef = useRef<typeof handleSend>(null! as unknown as typeof handleSend);
  const pendingQuestionRef = useRef<QuestionData | null>(null);
  const questionStackRef = useRef<QuestionData[]>([]);
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

  useEffect(() => {
    if (user) {
      loadUserProjects();
    }
  }, [user, loadUserProjects]);

  const [_restoreDone, setRestoreDone] = useState(false);
  const restoreRef = useRef(false);
  /** 恢复后的场景标识（如 'generate_achievement' 表示需要 AI 引导生成成果卡） */
  const restoreSceneRef = useRef<string | undefined>(undefined);
  /** 恢复时携带的额外上下文（如 stageId） */
  const restoreSceneExtraRef = useRef<Record<string, unknown>>({});
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
  const buildWorkspaceSavePayload = useCallback((code: string, language: string, fileName: string) => {
    const filesSnapshot = upsertWorkspaceFiles(projectFiles, fileName, code, language);
    return {
      code,
      language,
      filename: fileName,
      files: filesSnapshot.length > 0 ? filesSnapshot : undefined,
      // 始终带上当前 previewHtml，让后端 workspace 保持最新（用于成果卡封面自动截图）
      preview_html: previewHtml || '',
    };
  }, [projectFiles, previewHtml]);
  const applyWorkspaceRestore = useCallback((payload: ProjectWorkspaceResponse) => {
    const { project, progress, workspace } = payload;
    const wsFiles = (workspace as { files?: FileEntry[] }).files;
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
    // 优化代码展示逻辑：有代码则展示，无代码则保留默认提示
    const rawCode = workspace.code || '';
    const trimmedCode = rawCode.trim();
    // 检测是否为 JSON/结构化数据（非源码），如果是则视为无代码
    const isJsonLike = /^\s*[{[]/.test(trimmedCode) && trimmedCode.length > 10;
    const hasRealCode = !isJsonLike && trimmedCode.length > 5;
    if (hasRealCode) {
      setEditorCode(rawCode);
    } else if (isJsonLike) {
      // 关键修复：workspace.code 已被污染为 JSON（早期 bug 导致 evaluation.json 等被存为 code）
      // 主动清理：直接重置为默认代码，并尝试用 saveCode 把后端存为正常 code
      console.warn('[restore] workspace.code 是 JSON 格式，疑似被污染，重置为默认代码');
      setEditorCode(DEFAULT_CODE);
      projectsApi.saveCode(project.id, {
        code: DEFAULT_CODE,
        language: workspace.language || 'python',
        filename: workspace.filename || 'main.py',
        files: wsFiles && wsFiles.length > 0 ? wsFiles : undefined,
      }).catch(() => {});
    } else {
      // workspace.code 为空，尝试从 getCode 接口获取
      projectsApi.getCode(project.id).then((codeRes) => {
        if (codeRes.data?.has_code && codeRes.data.code) {
          const fetched = (codeRes.data.code || '').trim();
          const fetchedIsJson = /^\s*[{[]/.test(fetched) && fetched.length > 10;
          if (fetchedIsJson) {
            setEditorCode(DEFAULT_CODE);
          } else {
            setEditorCode(codeRes.data.code);
            setEditorLanguage(toEditorLanguage(codeRes.data.language || 'python'));
          }
        } else {
          setEditorCode(DEFAULT_CODE);
        }
      }).catch(() => {
        setEditorCode(DEFAULT_CODE);
      });
    }
    setEditorLanguage(toEditorLanguage(workspace.language));
    setPreviewHtml(workspace.preview_html || '');
    // 多文件支持
    if (wsFiles && wsFiles.length > 0) {
      setProjectFiles(wsFiles);
      const mainFile = wsFiles.find(f => f.is_main) || wsFiles[0];
      setActiveFileName(mainFile.name);
    } else {
      setProjectFiles([]);
      setActiveFileName('main.py');
    }
    setShowEditor(true);
    setEditorTab('code');
    setRunStatus('idle');
    const restoredMessages = normalizeWorkspaceMessages(workspace.chat_messages);
    setMessages(restoredMessages);
    clearQuestionFlow();
    setIsLoading(false);
    setShowChatHistory(true);
    setRestoreDone(true);
    // 恢复后：检查最后一条原始 assistant 消息是否含未答问题，若有则恢复 pendingQuestion
    // 必须用原始未清理内容（已清理内容里的 option 标签已删除，无法解析）
    if (Array.isArray(workspace.chat_messages) && workspace.chat_messages.length > 0) {
      const lastRaw = workspace.chat_messages[workspace.chat_messages.length - 1];
      if (lastRaw && lastRaw.role === 'assistant' && typeof lastRaw.content === 'string') {
        const rawContent = lastRaw.content;
        const parsed = parseQuestionFromText(rawContent);
        if (parsed) showPendingQuestion(parsed);
      }
    }
  }, [clearQuestionFlow, showPendingQuestion]);

  useEffect(() => {
    pendingQuestionRef.current = pendingQuestion;
  }, [pendingQuestion]);

  useEffect(() => {
    questionStackRef.current = questionStack;
  }, [questionStack]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- 该函数只重置本地问题流状态，依赖为空且由 ref 保证当前值同步
  function clearQuestionFlow() {
    questionStackRef.current = [];
    pendingQuestionRef.current = null;
    setQuestionStack([]);
    setPendingQuestion(null);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- 该函数参与多处流式回调，projectContext 读取需保持当前 render 语义
  function showPendingQuestion(nextQuestion: QuestionData) {
    if (isRedundantProjectNameQuestion(nextQuestion, projectContext)) {
      console.warn('[question] 已过滤重复的项目名称提问:', nextQuestion.title);
      return;
    }
    const statusOptionCount = nextQuestion.options.filter((option) => {
      const text = `${option.label || ''} ${option.description || ''}`;
      return /[\u2705\u274c\u2714\u2718\u274e\u2611\u2612\u26a0\u2757\u2753]/.test(text) ||
        /\b(?:docs|src|assets|tests|reports|public|app|pages|components|backend|frontend)\//.test(text) ||
        /\.(json|md|py|ts|tsx|js|html|css)\b/.test(text) ||
        /（已补|已生成|缺失|已完成|未完成|待完成）/.test(text) ||
        /\(已补|已生成|缺失|已完成|未完成|待完成\)/.test(text);
    }).length;
    if (nextQuestion.options.length > 0 && statusOptionCount / nextQuestion.options.length >= 0.5) {
      console.warn('[question] 已过滤状态清单误解析的选项:', nextQuestion.title);
      return;
    }
    setQuestionStack((prev) => {
      const normalizedQuestion = normalizeQuestionProgress(nextQuestion, prev);
      const current = prev[prev.length - 1] ?? null;
      if (isSameQuestionData(current, normalizedQuestion)) {
        pendingQuestionRef.current = current;
        setPendingQuestion(current);
        return prev;
      }
      pendingQuestionRef.current = normalizedQuestion;
      setPendingQuestion(normalizedQuestion);
      return [...prev, normalizedQuestion];
    });
  }

  function handleQuestionBack() {
    const stack = questionStackRef.current;
    if (stack.length < 2) return;
    const nextStack = stack.slice(0, -1);
    const baseQuestion = nextStack[nextStack.length - 1] ?? null;
    const previousQuestion = baseQuestion
      ? normalizeQuestionProgress(baseQuestion, nextStack.slice(0, -1), stack)
      : null;
    questionStackRef.current = nextStack;
    setQuestionStack(previousQuestion ? [...nextStack.slice(0, -1), previousQuestion] : nextStack);
    pendingQuestionRef.current = previousQuestion;
    setPendingQuestion(previousQuestion);
    setInputValue('');
    setIsLoading(false);
  }

  useEffect(() => {
    if (restoreRef.current) return;
    const restore = sessionStorage.getItem('finestem_restore_project');
    if (!restore) return;
    restoreRef.current = true;
    sessionStorage.removeItem('finestem_restore_project');
    try {
      const data = JSON.parse(restore);
      console.log('[restore] 恢复数据:', { projectId: data.projectId, hasCode: !!data.code, msgCount: data.messages?.length, scene: data.scene });
      // 存储场景标识，待恢复完成后由 useEffect 触发对应动作
      restoreSceneRef.current = data.scene || undefined;
      restoreSceneExtraRef.current = {
        stage: data.stage,
        currentStage: data.currentStage,
      };
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
            clearQuestionFlow();
            setIsLoading(false);
            setShowChatHistory(true);
            setRestoreDone(true);
          });
      }
    } catch (e) {
      console.error('[restore] 恢复失败:', e);
    }
  }, [applyWorkspaceRestore]);

  useEffect(() => { const q = searchParams.get('q'); if (q && messages.length === 0) handleSendRef.current?.(q); }, [messages.length, searchParams]);

  /** 处理 URL 中的 file 参数：自动在代码编辑器中打开指定文件 */
  useEffect(() => {
    const fileParam = searchParams.get('file');
    if (!fileParam || !projectContext.projectId || projectFiles.length === 0) return;

    // 解码文件路径
    const targetPath = decodeURIComponent(fileParam);
    
    // 在项目文件列表中查找匹配的文件
    // 支持精确匹配和模糊匹配（如 docs/05_step_plan.json）
    const matchedFile = projectFiles.find(f =>
      f.name === targetPath ||
      f.name.endsWith('/' + targetPath) ||
      f.name.endsWith(targetPath)
    );

    if (matchedFile) {
      console.log('[file-param] 找到文件，正在打开:', matchedFile.name);
      // 延迟执行，确保 UI 已完全渲染
      setTimeout(() => {
        handleSelectFile(matchedFile);
        setShowFilesPanel(true); // 同时展开文件面板，让用户看到文件位置
      }, 300);
    } else {
      console.warn('[file-param] 未找到文件:', targetPath, '可用文件:', projectFiles.map(f => f.name));
      
      // 如果是 docs/ 路径的文件但不在项目文件中，尝试从后端获取
      if (targetPath.startsWith('docs/') || targetPath.startsWith('reports/')) {
        console.log('[file-param] 尝试从后端获取文档文件...');
        // 这里可以扩展：调用 API 获取文档内容并显示
      }
    }
    // 只执行一次，清理 URL 参数避免重复触发
    // 注意：不在这里清除参数，因为用户可能需要分享链接
  }, [searchParams, projectContext.projectId, projectFiles]);

  /** 场景驱动：从 sessionStorage 恢复后，根据 scene 标识触发对应 AI 引导 */
  useEffect(() => {
    if (!_restoreDone || !projectContext.projectId) return;
    const scene = restoreSceneRef.current;
    if (!scene) return;
    restoreSceneRef.current = undefined; // 一次性消费，防止重复触发

    if (scene === 'generate_achievement') {
      // 延迟确保 chat UI 已渲染完毕
      setTimeout(() => {
        handleSendRef.current?.(
          '请帮我为当前项目生成一份成果档案卡。请先读取项目阶段文档、评估结果和历史对话，整理成果卡所需字段；如果信息已经足够，请直接调用 achievement_card 工具创建或更新成果档案卡；只有在关键字段缺失时，才用 question 选项向我补充确认。',
        );
      }, 600);
    } else if (scene === 'continue_stage') {
      // 用户在 ProjectDetail 详情卡点了"让 AI 协助本阶段"
      // 触发 AI 引导用户完成当前阶段
      const stageLabelMap: Record<string, string> = {
        stage_00_bootstrap: '第 1 阶段：准备阶段',
        stage_01_brainstorm: '第 2 阶段：脑爆选题',
        stage_02_brief: '第 3 阶段：开题立项',
        stage_03_constraints: '第 4 阶段：范围裁剪',
        stage_04_track: '第 5 阶段：技术轨道',
        stage_05_design: '第 6 阶段：设计蓝图',
        stage_06_step_plan: '第 7 阶段：分步计划',
        stage_07_execute: '第 8 阶段：执行开发',
        stage_08_evaluate: '第 9 阶段：评估展示',
      };
      const stageId = (restoreSceneExtraRef.current.stage as string | undefined)
        || (restoreSceneExtraRef.current.currentStage as string | undefined);
      const stageLabel = stageId ? stageLabelMap[stageId] || stageId : '当前阶段';
      setTimeout(() => {
        if (stageId === 'stage_08_evaluate') {
          handleSendRef.current?.(
            '我们继续完成【第 9 阶段：评估展示】。请先查看我当前的项目文档、验收内容和历史对话，判断评估材料是否已经足够；如果已经足够，请直接整理并调用 achievement_card 工具生成或更新成果档案卡；如果还缺关键信息，再明确告诉我缺什么，并用 question 选项让我补充。',
          );
          return;
        }
        handleSendRef.current?.(
          `我们继续完成【${stageLabel}】。请先查看我当前的项目文档和进度，然后告诉我本阶段还差什么、按什么顺序补全。`,
        );
      }, 600);
    }
    // 清理 extra（一次性）
    restoreSceneExtraRef.current = {};
  }, [_restoreDone, projectContext.projectId]);
  useEffect(() => { if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'; } }, [inputValue]);

  useEffect(() => {
    if (!projectContext.projectId) return;
    const projectId = projectContext.projectId;
    if (consumeRestoreAutosaveGuard('code', projectId)) return;
    if (codeSaveTimerRef.current) clearTimeout(codeSaveTimerRef.current);
    codeSaveTimerRef.current = setTimeout(() => {
      projectsApi.saveCode(projectId, buildWorkspaceSavePayload(editorCode, editorLanguage, activeFileName)).catch((error) => {
        console.error('[autosave:code] 保存失败:', error);
      });
    }, 2000);
    return () => { if (codeSaveTimerRef.current) clearTimeout(codeSaveTimerRef.current); };
  }, [activeFileName, buildWorkspaceSavePayload, consumeRestoreAutosaveGuard, editorCode, projectContext.projectId, editorLanguage]);

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
        projectsApi.saveCode(
          projectContext.projectId,
          buildWorkspaceSavePayload(codeResult.code, codeResult.language, activeFileName),
        ).catch((error) => {
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
        projectsApi.saveCode(
          createdProject.id,
          buildWorkspaceSavePayload(codeResult.code, codeResult.language, activeFileName),
        ).catch((error) => {
          console.error('[ensureProjectCreated] 新项目代码保存失败:', error);
        });
      }
      return createdProject;
    } else {
      projectCreatingRef.current = false;
      return null;
    }
  }, [activeFileName, buildWorkspaceSavePayload, projectContext.projectId, projectContext.currentStage, projectContext.mode, projectContext.projectName, createProjectViaAPI]);

  const nextMessageId = () => { messageSeqRef.current += 1; return String(messageSeqRef.current); };

  const cancelEditProject = useCallback(() => {
    setEditingProjectId(null);
    setEditProjectName('');
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
  }, [editingProjectId, editProjectName, user, cancelEditProject]);

  const startEditProject = useCallback((projId: string, currentName: string) => {
    setEditingProjectId(projId);
    setEditProjectName(currentName);
    setTimeout(() => editInputRef.current?.focus(), 50);
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
    clearQuestionFlow();
    setShowEditor(false);
    setEditorCode(DEFAULT_CODE);
    setEditorLanguage('html');
    setPreviewHtml('');
    setEditorTab('code');
  }, [clearQuestionFlow]);

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
    pendingQuestionRef.current = null;
    setPendingQuestion(null);
    setInputValue('');
    setIsLoading(false);
    setTimeout(() => handleSendRef.current(sendText), 50);
  }, [pendingQuestion]);

  const dismissQuestion = useCallback(() => {
    clearQuestionFlow();
  }, [clearQuestionFlow]);

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
  const normalizedLang = normalizeCodeLanguage(language);
  const currentLang = normalizeCodeLanguage(editorLanguage);
  
  console.log('[handleWriteCodeToEditor] 接收代码:', { language: normalizedLang, codeLength: code.length, currentLang, editorCodeLength: editorCode.length });
  
  // 智能合并：如果编辑器已有 HTML 代码，新来的 CSS/JS 应该合并进去而非覆盖
  const isValidEditorCode = editorCode && editorCode.trim().length > 50 && !editorCode.includes('在这里查看或修改');
  const shouldMerge = currentLang === 'html' && isValidEditorCode
    && (normalizedLang === 'css' || normalizedLang === 'javascript' || normalizedLang === 'typescript');
  console.log('[handleWriteCodeToEditor] 是否合并:', shouldMerge, { currentLang, editorCodeLength: editorCode?.length, isValidEditorCode, normalizedLang });

  if (shouldMerge) {
    let merged = editorCode;
    if (normalizedLang === 'css' && !/<style[\s>]/i.test(editorCode)) {
      // 注入 CSS - 优先注入到 </head> 前，如果没有 head 则注入到开头
      const styleBlock = `<style>\n${code}\n</style>`;
      if (/<\/head>/i.test(editorCode)) {
        merged = editorCode.replace(/<\/head>/i, `${styleBlock}\n</head>`);
      } else if (/<head>/i.test(editorCode)) {
        merged = editorCode.replace(/<head>/i, `<head>\n${styleBlock}`);
      } else {
        // 没有 head 标签，在开头添加
        merged = styleBlock + '\n' + editorCode;
      }
      console.log('[handleWriteCodeToEditor] CSS 已合并到现有 HTML，新长度:', merged.length);
    } else if ((normalizedLang === 'javascript' || normalizedLang === 'typescript') && !/<script[\s>]/i.test(editorCode)) {
      // 注入 JS - 优先注入到 </body> 前，如果没有 body 则追加到末尾
      const scriptBlock = `<script>\n${code}\n</script>`;
      if (/<\/body>/i.test(editorCode)) {
        merged = editorCode.replace(/<\/body>/i, `${scriptBlock}\n</body>`);
      } else {
        merged = editorCode + '\n' + scriptBlock;
      }
      console.log('[handleWriteCodeToEditor] JS 已合并到现有 HTML，新长度:', merged.length);
    } else {
      console.log('[handleWriteCodeToEditor] 已有 style/script 标签或不是 CSS/JS，跳过合并');
    }
    setEditorCode(merged);
    setEditorLanguage('html');
  } else {
    // 直接覆盖（新 HTML、Python，或编辑器为空/占位符时）
    console.log('[handleWriteCodeToEditor] 直接覆盖编辑器内容');
    setEditorCode(code);
    setEditorLanguage(toEditorLanguage(language));
  }
  setShowEditor(true);
  setEditorTab('code');
}, [editorCode, editorLanguage]);

  const handleRunCode = useCallback(async (code: string, language: string) => {
    setEditorCode(code);
    setEditorLanguage(toEditorLanguage(language));
    setShowEditor(true);

    if (language === 'python' || language === 'py') {
      setRunningCode(true);
      try {
        const result = await codeExecutionApi.execute(code, 'python', projectFiles.length > 0 ? projectFiles : undefined);
        const data = result.data ?? { success: false, output: '', error: '执行结果为空' };
        setRunStatus(data.success ? 'success' : 'error');
        // Streamlit 模式：直接 URL 预览
        if (data.mode === 'streamlit' && data.preview_url) {
          setRunResultUrl(data.preview_url);
          setRunResultHtml('');
        } else {
          setRunResultUrl(null);
          setRunResultHtml(buildExecutionResultHtml(data, code));
        }
        // 同时更新编辑器预览标签
        const newPreviewHtml = data.mode === 'streamlit' && data.preview_url
          ? buildStreamlitIframeHtml(data.preview_url, data.output)
          : buildExecutionResultHtml(data, code);
        setPreviewHtml(newPreviewHtml);
        setEditorTab('preview');
        // 弹出运行结果模态框
        setShowRunResultModal(true);
        // 运行成功后立即把 preview_html 持久化到 workspace，供成果卡封面自动截图使用
        if (projectContext.projectId && !projectContext.projectId.startsWith('local-') && newPreviewHtml) {
          projectsApi.saveCode(projectContext.projectId, {
            ...buildWorkspaceSavePayload(code, 'python', activeFileName),
            preview_html: newPreviewHtml,
          }).catch(() => {/* 静默：预览持久化失败不阻断运行 */});
        }
      } catch (error) {
        console.error('代码执行失败:', error);
        setRunStatus('error');
        const errHtml = buildErrorHtml('连接服务器失败，请稍后重试');
        setRunResultUrl(null);
        setRunResultHtml(errHtml);
        setPreviewHtml(errHtml);
        setShowRunResultModal(true);
      } finally {
        setRunningCode(false);
      }
    } else {
      const html = buildHtmlFromCode(code, language);
      setRunStatus('success');
      setRunResultUrl(null);
      setRunResultHtml(html);
      setPreviewHtml(html);
      setEditorTab('preview');
      // HTML/JS 也弹出预览
      setShowRunResultModal(true);
      // 同样持久化 preview_html
      if (projectContext.projectId && !projectContext.projectId.startsWith('local-')) {
        projectsApi.saveCode(projectContext.projectId, {
          ...buildWorkspaceSavePayload(code, language, activeFileName),
          preview_html: html,
        }).catch(() => {/* 静默 */});
      }
    }
  }, [projectFiles, projectContext.projectId, activeFileName, buildWorkspaceSavePayload]);

  const handleRunEditorCode = useCallback(async () => {
    if (editorLanguage === 'python' || editorLanguage === 'py') {
      setRunningCode(true);
      try {
        const result = await codeExecutionApi.execute(editorCode, 'python', projectFiles.length > 0 ? projectFiles : undefined);
        const data = result.data ?? { success: false, output: '', error: '执行结果为空' };
        setRunStatus(data.success ? 'success' : 'error');
        // Streamlit 模式：直接 URL 预览
        if (data.mode === 'streamlit' && data.preview_url) {
          setRunResultUrl(data.preview_url);
          setRunResultHtml('');
        } else {
          setRunResultUrl(null);
          setRunResultHtml(buildExecutionResultHtml(data, editorCode));
        }
        // 同时更新编辑器预览标签
        const newPreviewHtml = data.mode === 'streamlit' && data.preview_url
          ? buildStreamlitIframeHtml(data.preview_url, data.output)
          : buildExecutionResultHtml(data, editorCode);
        setPreviewHtml(newPreviewHtml);
        setEditorTab('preview');
        // 弹出运行结果模态框
        setShowRunResultModal(true);
        // 运行成功后立即把 preview_html 持久化到 workspace，供成果卡封面自动截图使用
        if (projectContext.projectId && !projectContext.projectId.startsWith('local-') && newPreviewHtml) {
          projectsApi.saveCode(projectContext.projectId, {
            ...buildWorkspaceSavePayload(editorCode, 'python', activeFileName),
            preview_html: newPreviewHtml,
          }).catch(() => {/* 静默 */});
        }
      } catch (error) {
        console.error('代码执行失败:', error);
        setRunStatus('error');
        const errHtml = buildErrorHtml('连接服务器失败，请稍后重试');
        setRunResultUrl(null);
        setRunResultHtml(errHtml);
        setPreviewHtml(errHtml);
        setShowRunResultModal(true);
      } finally {
        setRunningCode(false);
      }
} else {
      const html = buildHtmlFromCode(editorCode, editorLanguage);
      console.log('[handleRunEditorCode] 生成的 HTML 预览，长度:', html.length, '前200字符:', html.substring(0, 200));
      setRunStatus('success');
      setRunResultUrl(null);
      setRunResultBlobUrl(null); // 清除 Blob URL
      setRunResultHtml(html);
      setPreviewHtml(html);
      setEditorTab('preview');
      // HTML/JS 也弹出预览
      setShowRunResultModal(true);
      // 同样持久化 preview_html
      if (projectContext.projectId && !projectContext.projectId.startsWith('local-')) {
        projectsApi.saveCode(projectContext.projectId, {
          ...buildWorkspaceSavePayload(editorCode, editorLanguage, activeFileName),
          preview_html: html,
        }).catch(() => {/* 静默 */});
      }
    }
  }, [editorCode, editorLanguage, projectFiles, projectContext.projectId, activeFileName, buildWorkspaceSavePayload]);

  /** 拖拽分割线：调整聊天区与代码区的宽度比例 */
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = editorWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX; // 向左拖 = 编辑器变宽
      const newWidth = Math.max(280, Math.min(800, startWidth + delta));
      setEditorWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem('finestem_editor_width', String(editorWidth));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [editorWidth]);

  /** 选择文件加载到编辑器 */
  const handleSelectFile = useCallback((file: FileEntry) => {
    setProjectFiles((prev) => upsertWorkspaceFiles(prev, activeFileName, editorCode, editorLanguage));
    if (file.content) {
      setEditorCode(file.content);
    }
    setEditorLanguage(toEditorLanguage(file.language));
    setActiveFileName(file.name);
    setEditorTab('code');
  }, [activeFileName, editorCode, editorLanguage]);

  /** 导出项目 ZIP */
  const handleExportZip = useCallback(async () => {
    if (!projectContext.projectId) return;
    try {
      const res = await projectsApi.exportFile(projectContext.projectId, 'zip');
      // 创建下载链接
      const url = window.URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.fileName || `${projectContext.projectName || '项目'}_资料包.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[export] 导出失败:', error);
    }
  }, [projectContext.projectId, projectContext.projectName]);

  /** ESC 键关闭运行结果模态框 */
  useEffect(() => {
    if (!showRunResultModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowRunResultModal(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showRunResultModal]);

  /** 从 DSML tool_call 参数标签中提取代码和语言 */
  const extractCodeFromDsmlTags = useCallback((content: string): { code: string; language: string } | null => {
    // 关键：DSML 标签中的 | 是全角字符 U+FF5C（｜），不是半角 U+007C（|）
    const vb = '[|\uff5c]';
    const vbn = '[^|\uff5c]';

    // 策略 A：精确匹配 parameter 标签
    const codeParamRegex = new RegExp(`<[^\\n]*${vb}${vbn}*parameter\\s+name=["']code["'][^>]*string=["']true["'][^>]*>([\\s\\S]*?)<\\/[^\\n]*${vb}${vbn}*parameter>`, 'gi');
    const langParamRegex = new RegExp(`<[^\\n]*${vb}${vbn}*parameter\\s+name=["']language["'][^>]*string=["'][^"']*?["'][^>]*>([\\s\\S]*?)<\\/[^\\n]*${vb}${vbn}*parameter>`, 'gi');

    // 策略 B：广谱特征匹配
    const broadCodeRegex = new RegExp(`${vb}${vbn}*parameter\\s+name=["']code["']${vbn}*${vb}([\\s\\S]*?)(?=${vb}${vbn}*parameter|${vb}${vbn}*invoke|$)`, 'gi');
    const broadLangRegex = new RegExp(`${vb}${vbn}*parameter\\s+name=["']language["']${vbn}*${vb}([^${vb}]*?)(?=${vb}${vbn}*parameter|${vb}${vbn}*invoke|$)`, 'gi');

    let codeMatch: RegExpExecArray | null;
    let extractedCode = '';
    let extractedLang = '';

    // 策略 A：精确匹配 parameter 标签
    while ((codeMatch = codeParamRegex.exec(content)) !== null) {
      const candidate = (codeMatch[1] || '').trim();
      if (candidate.length > extractedCode.length) {
        extractedCode = candidate;
      }
    }

    // 策略 B：如果精确匹配失败，尝试广谱特征匹配
    if (!extractedCode || extractedCode.length < 10) {
      while ((codeMatch = broadCodeRegex.exec(content)) !== null) {
        const candidate = (codeMatch[1] || '').trim();
        // 过滤掉非代码内容（如 JSON 字符串）
        if (candidate.length > extractedCode.length && (candidate.includes('\n') || candidate.includes('def ') || candidate.includes('import ') || candidate.includes('function ') || candidate.includes('const ') || candidate.includes('<html') || candidate.includes('# '))) {
          extractedCode = candidate;
        }
      }
    }

    if (!extractedCode || extractedCode.length < 10) return null;

    // 尝试从 language 参数获取语言标识
    let langMatch: RegExpExecArray | null;
    while ((langMatch = langParamRegex.exec(content)) !== null) {
      const lang = (langMatch[1] || '').trim();
      if (lang) {
        extractedLang = normalizeCodeLanguage(lang);
        break;
      }
    }

    // 策略 B 语言回退：广谱特征匹配
    if (!extractedLang) {
      while ((langMatch = broadLangRegex.exec(content)) !== null) {
        const lang = (langMatch[1] || '').trim();
        if (lang && lang.length < 20) {  // 合理的语言名长度
          extractedLang = normalizeCodeLanguage(lang);
          break;
        }
      }
    }

    // fallback: 根据 code 参数标签中的语言推断
    if (!extractedLang && extractedCode) {
      if (extractedCode.includes('def ') || extractedCode.includes('import ')) extractedLang = 'python';
      else if (extractedCode.includes('function ') || extractedCode.includes('const ')) extractedLang = 'javascript';
      else if (extractedCode.includes('<html') || extractedCode.includes('<div') || extractedCode.includes('<style')) extractedLang = 'html';
    }

    // 关键修复：DSML 提取的代码也必须经过可执行语言校验
    // 避免 evaluation.json 等结构化数据被当成可运行代码
    if (!extractedLang || !isExecutableCodeLanguage(extractedLang)) return null;
    return extractedCode.length > 10 ? { code: extractedCode, language: extractedLang } : null;
  }, []);

  const extractCodeFromResponse = useCallback((content: string): { code: string; language: string } | null => {
    // 优先从 markdown 代码块提取
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const matches: Array<{ code: string; language: string }> = [];
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = normalizeCodeLanguage(match[1] || 'text');
      const code = match[2].trim();
      // 关键修复：只保留可执行语言（python/javascript/typescript/html/css）
      // 避免把 ```json (evaluation.json)、```markdown 等阶段文档/配置数据当成代码塞进编辑器
      if (code.length > 10 && isExecutableCodeLanguage(language)) {
        matches.push({ code, language });
      }
    }
    // 兜底：如果未找到完整代码块，尝试解析"未闭合"的代码块（流式中断常见）
    if (matches.length === 0) {
      const openBlockRegex = /```(\w+)?\n([\s\S]+)$/;
      const openMatch = content.match(openBlockRegex);
      if (openMatch) {
        const language = normalizeCodeLanguage(openMatch[1] || 'text');
        const code = openMatch[2].replace(/[\s\n]*<\/?[\s\S]{0,20}$/u, '').trim();
        if (code.length > 10 && isExecutableCodeLanguage(language)) {
          matches.push({ code, language });
        }
      }
    }
    // 兜底2：没有 markdown 代码块时，尝试通过特征匹配提取裸 CSS/JS 代码
    // 例如 AI 直接贴出 CSS 样式代码而没有 ```css 包裹
    if (matches.length === 0) {
      // 匹配 CSS 代码块：查找包含多个 CSS 规则的大段代码
      // 策略：找包含 * { ... } 或 body { ... } 或 .class { ... } 的大段文本
      const cssBlockPattern = /(?:\/\*[\s\S]{0,200}?\*\/\s*)?(?:\*|[\w#\.\-:\[\]]+)\s*\{[\s\S]{100,}?\}(?:\s*(?:[\w#\.\-:\[\]]+)\s*\{[\s\S]*?\})*/;
      const cssMatch = content.match(cssBlockPattern);
      if (cssMatch && cssMatch[0].length > 100) {
        const cssCode = cssMatch[0].trim();
        // 验证确实是 CSS（包含至少2个典型 CSS 属性）
        const cssProps = (cssCode.match(/\b(margin|padding|background|color|font-size|display|border|position|width|height|flex|grid|opacity|transform|transition|animation|z-index|overflow|text-align|line-height|font-family|box-shadow|border-radius):/gi) || []);
        if (cssProps.length >= 2) {
          console.log('[extractCodeFromResponse] 通过特征匹配提取到裸 CSS 代码，长度:', cssCode.length);
          matches.push({ code: cssCode, language: 'css' });
        }
      }
      // 匹配 JS 代码块：包含函数定义或变量声明
      if (matches.length === 0) {
        const jsPattern = /(?:const\s+\w+\s*=\s*(?:function|\([^)]*\)\s*=>)|function\s+\w+\s*\([^)]*\))[\s\S]{50,}/;
        const jsMatch = content.match(jsPattern);
        if (jsMatch && jsMatch[0].length > 60) {
          console.log('[extractCodeFromResponse] 通过特征匹配提取到裸 JS 代码，长度:', jsMatch[0].length);
          matches.push({ code: jsMatch[0].trim(), language: 'javascript' });
        }
      }
    }
    if (matches.length === 0) {
      // markdown 代码块未找到时，尝试从 DSML tool_call 标签中提取代码
      return extractCodeFromDsmlTags(content);
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
  }, [extractCodeFromDsmlTags]);

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
        isContinue?: boolean;
      },
    ) => {
      const message = (text || inputValue).trim();
      if (!message || isLoading) return;
      
      // 保存最后一条消息用于续接
      if (!requestOverrides?.isContinue) {
        lastMessageRef.current = message;
      }
      
      // 隐藏继续按钮
      setShowContinueButton(false);
    const directCodingIntent = hasDirectCodingIntent(message);
    const requestedOutputLanguage = inferRequestedOutputLanguage(message);
    const historyMessages = buildStreamHistory(messages);
    type StreamedProjectInfo = { project_id: string; project_name: string; current_stage?: string };
    const streamedProjectState: { current?: StreamedProjectInfo } = {};
    let streamedCodeGenerated: CodeGeneratedEvent | null = null;
    let effectiveProjectId = requestOverrides?.projectId ?? projectContext.projectId ?? undefined;
    let effectiveContext: Record<string, unknown> = {
      page: 'create',
      scene: sceneOverride || activeScene,
      authenticated: !!user,
      project_id: effectiveProjectId,
      project_name: projectContext.projectName,
      teaching_mode: projectContext.teachingMode,
      current_stage: projectContext.currentStage,
      ...(requestOverrides?.context || {}),
    };
    // 与 stem-pbl-guide Skill 状态机严格对齐：仅 stage_05_design / stage_07_execute / stage_08_evaluate 允许代码生成。
    // stage_03_constraints 等阶段即使用户说"代码为空 / 没代码"也不进入 force_code_generation，
    // 由后端系统提示词引导回当前阶段任务。
    const ALLOWED_CODE_STAGES = ['stage_05_design', 'stage_07_execute', 'stage_08_evaluate'];
    const stageAllowsCode = ALLOWED_CODE_STAGES.includes(String(effectiveContext.current_stage || ''));
    const strongCodingIntent = hasStrongCodingIntent(message);
    const shouldForceCodeGeneration = strongCodingIntent || (stageAllowsCode && (
      directCodingIntent || effectiveContext.current_stage === 'stage_07_execute'
    ));
    if (shouldForceCodeGeneration) {
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

    if (strongCodingIntent && effectiveProjectId) {
      const fallback = buildFallbackCode(requestedOutputLanguage);
      // 不再使用硬编码的 MVP 模板，等待 AI 生成真正的项目代码
      if (fallback) {
        handleWriteCodeToEditor(fallback.code, fallback.language);
        setActiveFileName(fallback.filename);
        setProjectFiles([{ name: fallback.filename, language: fallback.language, content: fallback.code, is_main: true }]);
        setShowEditor(true);
        setEditorTab('code');
        await projectsApi.saveCode(effectiveProjectId, buildWorkspaceSavePayload(fallback.code, fallback.language, fallback.filename));
      }
    }

    const userMsg: Message = { id: nextMessageId(), role: 'user', content: message };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setShowChatHistory(true);
    const isStructuredQuestionAnswer = /^\[选择\]\s/.test(message);
    // 普通新对话需要清空旧 question 流；但 QuestionCard 自动提交的结构化回答必须保留题目栈，
    // 否则第三问虽然能显示“上一步”，点击后也回不到第二问。
    if (!isStructuredQuestionAnswer) {
      clearQuestionFlow();
    } else {
      pendingQuestionRef.current = null;
      setPendingQuestion(null);
    }
    setIsLoading(true);
    let rawAssistantContent = '';
    let assistantContent = '';
    // 追踪 content_update 事件是否可能导致内容丢失
    let receivedContentUpdate = false;
    // 保存 content_update 之前累积的最大可见内容，防止被清空
    let maxVisibleContent = '';
    // 追踪最近一次的未清理累积内容（用于 parseQuestionFromText 解析 option 标签）
    let lastRawAccumulated = '';
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
          // 持续追踪最大的可见内容（防止后续 content_update 清空）
          if (assistantContent.length > maxVisibleContent.length) {
            maxVisibleContent = assistantContent;
          }
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
          onCodeGenerated: (data) => {
            if (!data.code || data.code.trim().length <= 10) return;
            streamedCodeGenerated = data;
            handleWriteCodeToEditor(data.code, data.language || 'html');
            if (data.filename) setActiveFileName(data.filename);
            if (Array.isArray(data.files) && data.files.length > 0) {
              setProjectFiles(data.files.map((file) => ({
                name: file.name,
                language: file.language,
                content: file.content,
                is_main: file.is_main === true,
              })));
            }
            if (data.project_id) {
              effectiveProjectId = data.project_id;
              setProjectContext(prev => ({
                ...prev,
                projectId: data.project_id || prev.projectId,
              }));
            }
            setShowEditor(true);
            setEditorTab('code');
          },
          onCodeGenerationFailed: (data) => {
            console.warn('[handleSend] 服务端代码生成失败:', data.reason, data.message);
          },
          onToolCall: (data) => {
            if (data.tool_name === 'project_creator' && data.success) {
              setShowEditor(true);
              setEditorTab('code');
            }
            if (data.tool_name === 'achievement_card' && data.success) {
              const toolMessage = typeof data.data === 'object' && data.data && 'message' in data.data
                ? String((data.data as { message?: unknown }).message || '')
                : '';
              const content = toolMessage || '成果档案卡已生成，你可以回到项目详情或成果卡页面查看。';
              setMessages((prev) => [
                ...prev,
                { id: nextMessageId(), role: 'assistant', content },
              ]);
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
              showPendingQuestion(data);
            }
          },
          onContentUpdate: (dedupedContent) => {
            receivedContentUpdate = true;
            lastRawAccumulated = dedupedContent;
            const cleanedDeduped = cleanAssistantMessageContent(dedupedContent);
            // 智能合并：只有当 content_update 的内容比当前累积的内容更有价值时才使用
            // 防止 content_update 发送纯工具标记（清理后变空）导致可见内容被清空
            if (cleanedDeduped.length >= maxVisibleContent.length) {
              assistantContent = cleanedDeduped;
              if (assistantContent.length > maxVisibleContent.length) {
                maxVisibleContent = assistantContent;
              }
            } else if (cleanedDeduped.length === 0 && maxVisibleContent.length > 0) {
              // content_update 内容被清理为空时，保留已有的最大可见内容
              console.warn('[handleSend] content_update 内容被清理为空，保留已有内容 (长度:', maxVisibleContent.length, ')');
              return; // 不更新 UI，保留当前显示的内容
            }
            setMessages(prev => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                updated[lastIdx] = { ...updated[lastIdx], content: assistantContent || maxVisibleContent };
              }
              return updated;
            });
            if (!requestOverrides?.suppressQuestionCard && !pendingQuestionRef.current) {
              // 关键修复：必须用**未清理的 dedupedContent** 解析 question，
              // 因为 assistantContent（清理后）已经删除了 option 标签
              const fallback = parseQuestionFromText(dedupedContent);
              if (fallback) {
                showPendingQuestion(fallback);
              }
            }
          },
          onEnd: (finalContent) => {
            // 流末兜底：服务端最终事件抵达时，立即尝试代码提取并写入编辑器
            // 这是修复"AI 说生成了代码但编辑器为空"的关键路径
            try {
              const finalRaw = finalContent || lastRawAccumulated || rawAssistantContent;
              if (!finalRaw) return;
              const codeResult = extractCodeFromResponse(finalRaw);
              if (codeResult && codeResult.code.trim().length > 10) {
                console.log('[handleSend][onEnd] 流末兜底：提取到代码', codeResult.language, codeResult.code.length, '字符');
                handleWriteCodeToEditor(codeResult.code, codeResult.language);
                setShowEditor(true);
              } else {
                console.warn('[handleSend][onEnd] 流末兜底：未从最终内容中提取到代码');
              }
            } catch (err) {
              console.error('[handleSend][onEnd] 流末兜底执行失败', err);
            }
          },
        },
      );

      // 最终内容以服务端 final/content_update 的清理结果为准，避免把流式中途的 UUID/Skill 等脏片段
      // 因为“最长可见内容”策略重新带回聊天气泡。
      const rawFinal = streamResult.content || lastRawAccumulated || rawAssistantContent || assistantContent;
      const finalCleaned = cleanAssistantMessageContent(rawFinal);
      assistantContent = finalCleaned || maxVisibleContent;
      if (receivedContentUpdate && assistantContent.length === 0 && maxVisibleContent.length > 0) {
        console.warn('[handleSend] 最终内容为空但存在历史可见内容，恢复历史内容');
        assistantContent = maxVisibleContent;
      }
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
          updated[lastIdx] = { ...updated[lastIdx], content: assistantContent };
        }
        return updated;
      });

      if (!requestOverrides?.suppressQuestionCard && !pendingQuestionRef.current) {
        // 关键修复：必须用**未清理的累积内容**解析 question
        // 优先用 lastRawAccumulated（onContentUpdate 累积），fallback 到 rawFinal
        const finalFallback = parseQuestionFromText(lastRawAccumulated || rawFinal);
        if (finalFallback) {
          showPendingQuestion(finalFallback);
        }
      }

      // 代码提取必须基于原始内容（rawFinal），因为代码可能被包裹在 DSML 标签中
      // 清理后的内容（assistantContent）已移除 DSML 标签，会导致代码丢失
      // 注意：即使 streamedCodeGenerated 已有值（之前的 code_generated 事件），仍需尝试提取
      // 因为 AI 可能在后续文本中给出了 CSS/JS 修复代码
      console.log('[handleSend][onEnd] rawFinal 长度:', rawFinal?.length || 0);
      console.log('[handleSend][onEnd] rawFinal 前500字符:', rawFinal?.substring(0, 500) || 'empty');
      const codeResult = extractCodeFromResponse(rawFinal);
      console.log('[handleSend][onEnd] codeResult:', codeResult ? `${codeResult.language} (${codeResult.code.length} chars)` : 'null');
      if (codeResult) {
        console.log('[handleSend][onEnd] 提取到代码，准备写入编辑器');
        handleWriteCodeToEditor(codeResult.code, codeResult.language);
        if (effectiveProjectId) {
          await projectsApi.saveCode(
            effectiveProjectId,
            buildWorkspaceSavePayload(codeResult.code, codeResult.language, activeFileName),
          );
        } else {
          await ensureProjectCreated(message, codeResult);
        }
        setShowEditor(true);
        // 写入代码后自动运行预览，让用户立即看到效果
        setTimeout(() => handleRunEditorCode(), 300);
      } else if (!streamedCodeGenerated) {
        let restoredFromWorkspace = false;
        let workspaceProjectId = effectiveProjectId;
        if (!workspaceProjectId && user) {
          try {
            const projectListRes = await projectsApi.list({ page: 1, page_size: 1 });
            workspaceProjectId = projectListRes.data?.items?.[0]?.id;
          } catch (error) {
            console.warn('[handleSend] 获取最近项目失败:', error);
          }
        }
        if (workspaceProjectId) {
          try {
            const workspaceRes = await projectsApi.getWorkspace(workspaceProjectId);
            const workspace = workspaceRes.data?.workspace;
            const workspaceCode = workspace?.code || '';
            const isPlaceholder = workspaceCode.includes('在这里查看或修改 AI 生成的代码');
            let restoredCode = workspaceCode;
            let restoredLanguage = workspace?.language || 'html';
            let restoredFilename = workspace?.filename || (restoredLanguage === 'python' ? 'main.py' : 'index.html');
            let restoredFiles = workspace?.files;
            if ((workspaceCode.trim().length <= 80 || isPlaceholder) && shouldForceCodeGeneration) {
              const fallback = buildFallbackCode(requestedOutputLanguage);
              // 不再使用硬编码的 MVP 模板，保持代码区为空等待 AI 生成
              if (fallback) {
                restoredCode = fallback.code;
                restoredLanguage = fallback.language;
                restoredFilename = fallback.filename;
                restoredFiles = [{ name: fallback.filename, language: fallback.language, content: fallback.code, is_main: true }];
                await projectsApi.saveCode(workspaceProjectId, buildWorkspaceSavePayload(fallback.code, fallback.language, fallback.filename));
              }
            }
            if (restoredCode.trim().length > 80 && !restoredCode.includes('在这里查看或修改 AI 生成的代码')) {
              handleWriteCodeToEditor(restoredCode, restoredLanguage);
              if (restoredFilename) setActiveFileName(restoredFilename);
              if (Array.isArray(restoredFiles) && restoredFiles.length > 0) {
                setProjectFiles(restoredFiles.map((file) => ({
                  name: file.name,
                  language: file.language,
                  content: file.content,
                  is_main: file.is_main === true,
                })));
              }
              setShowEditor(true);
              setEditorTab('code');
              restoredFromWorkspace = true;
            }
          } catch (error) {
            console.warn('[handleSend] 工作区代码回读失败:', error);
          }
        }
        if (restoredFromWorkspace) {
          // 后端已经通过工具或兜底写入代码，本轮不再提示重试。
        } else {
        // 兜底提示：在编码阶段（stage_07_execute）但未提取到代码块时，给出明确反馈
        // 避免用户看到"已生成代码"的叙述但编辑器仍是空的
        const isExecuteStage = typeof effectiveContext.current_stage === 'string'
          && effectiveContext.current_stage === 'stage_07_execute';
        const forcedCode = (effectiveContext as Record<string, unknown>).force_code_generation === true;
        if (isExecuteStage || forcedCode) {
          console.warn('[handleSend] 编码阶段未提取到代码，提示用户重试');
          setMessages((prev) => [
            ...prev,
            {
              id: nextMessageId(),
              role: 'assistant',
              content: 'AI 已尝试生成代码，但本轮未输出可写入编辑器的代码块（可能因流式输出被中途截断）。请再发送一次"请直接给出完整可运行代码"以重试。',
            },
          ]);
        }
        }
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
      
      // 检查是否是超时或连接错误
      const isTimeoutError = errMsg.includes('超时') || errMsg.includes('timeout') || errMsg.includes('aborted');
      const isConnectionError = errMsg.includes('连接') || errMsg.includes('connection') || errMsg.includes('closed');
      
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant') {
          if (isTimeoutError || isConnectionError) {
            last.content = `${assistantContent}\n\n[输出被截断，请点击下方"继续生成"按钮]`;
          } else {
            last.content = `请求失败：${errMsg}`;
          }
        }
        return copy;
      });
      
      // 如果是超时或连接错误，显示继续按钮
      if (isTimeoutError || isConnectionError) {
        setShowContinueButton(true);
      }
    } finally {
      setIsLoading(false);
      setIsContinuing(false);
    }
  };
  // handleSendRef 更新放在 useEffect 中，避免 render 期间修改 ref
  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  // 处理继续生成
  const handleContinue = useCallback(async () => {
    if (!lastMessageRef.current || isLoading) return;
    
    setIsContinuing(true);
    setShowContinueButton(false);
    
    // 发送续接请求
    await handleSend('继续', undefined, {
      isContinue: true,
      suppressQuestionCard: true,
    });
  }, [handleSend, isLoading]);

  // Listen for code-error messages from preview iframe (让 AI 修复此错误 按钮)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data && e.data.type === 'code-error' && e.data.msg) {
        const fn = handleSendRef.current;
        if (fn) {
          fn(`我的代码运行出错了，错误信息是：${e.data.msg}\n\n请帮我修复这个错误。`);
        } else {
          // ref 尚未就绪，延迟重试一次
          setTimeout(() => {
            handleSendRef.current?.(`我的代码运行出错了，错误信息是：${e.data.msg}\n\n请帮我修复这个错误。`);
          }, 300);
        }
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

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
    <div className="h-[calc(100vh-56px)] flex">
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
          {projectContext.projectId && !projectContext.projectId.startsWith('local-') && (
            <div className="px-2 pt-2">
              <Link
                to={`/research/projects/${projectContext.projectId}`}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                打开项目主页
              </Link>
            </div>
          )}
          <div className="p-2 space-y-1 max-h-[200px] overflow-y-auto">
            {userProjects.length > 0 && userProjects.map((proj) => (
              <div key={proj.id} data-project-id={proj.id} className={`group rounded-lg transition-colors ${
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
                            clearQuestionFlow();
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
          {/* 聊天区顶部工具栏：项目文件面板入口 */}
          {projectContext.projectId && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 border-b border-gray-100">
              <button
                onClick={() => setShowFilesPanel(!showFilesPanel)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
                  showFilesPanel ? 'bg-teal-100 text-teal-700 font-medium' : 'text-gray-500 hover:bg-gray-200'
                }`}
                title={showFilesPanel ? '收起项目资源' : '查看项目资源'}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {showFilesPanel ? '资源' : '项目资源'}
              </button>
              <span className="text-[10px] text-gray-300">|</span>
              <span className="text-[10px] text-gray-400 truncate">{projectContext.projectName}</span>
            </div>
          )}
          {projectContext.mode && showChatHistory && <StageProgressBar projectContext={projectContext} />}

          {showChatHistory ? (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-3 bg-white">
                {messages.map((msg, msgIdx) => {
                  // 当前问题：仅最后一条 assistant 消息且其后无 user 回复
                  const isLastAssistant = msg.role === 'assistant' &&
                    msgIdx === messages.length - 1;
                  const hasUserReply = msgIdx < messages.length - 1 &&
                    messages.slice(msgIdx + 1).some(m => m.role === 'user');
                  const isCurrentQuestion = isLastAssistant && !hasUserReply;
                  return (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user' ? 'bg-teal-600 text-white rounded-br-sm' : 'bg-gray-50 text-gray-800 rounded-bl-sm border border-gray-100'
                    }`}>
                      <div className={`flex items-center gap-1.5 mb-1 text-xs ${msg.role === 'user' ? 'text-teal-200' : 'text-gray-400'}`}>
                        {msg.role === 'user' ? <User className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                        <span>{msg.role === 'user' ? '你' : 'fineSTEM AI'}</span>
                      </div>
                      {msg.role === 'assistant' ? (
                        <EnhancedMarkdownText
                          content={msg.content}
                          isCurrentQuestion={isCurrentQuestion}
                          projectId={projectContext.projectId?.startsWith('local-') ? null : projectContext.projectId}
                          onWriteCode={handleWriteCodeToEditor}
                          onRunCode={handleRunCode}
                        />
                      ) : (
                        <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>
                  </div>
                  );
                })}
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
                  onBack={handleQuestionBack}
                  onDismiss={dismissQuestion}
                />
              )}
              
              {/* 继续生成按钮 */}
              {showContinueButton && (
                <div className="flex justify-center py-4">
                  <ContinueButton
                    onContinue={handleContinue}
                    isLoading={isContinuing}
                    visible={showContinueButton}
                  />
                </div>
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

      {/* 项目文件面板（可折叠） */}
      {showFilesPanel && projectContext.projectId && (
        <div className="flex-shrink-0 h-full" style={{ width: 220 }}>
          <ProjectFilesPanel
            projectId={projectContext.projectId}
            projectName={projectContext.projectName}
            projectMode={projectContext.mode || 'light'}
            currentStage={projectContext.currentStage}
            files={projectFiles}
            activeFileName={activeFileName}
            chatMessages={messages}
            onSelectFile={handleSelectFile}
            onExportZip={handleExportZip}
            onClose={() => setShowFilesPanel(false)}
          />
        </div>
      )}

      {/* 拖拽分割线：仅在编辑器展开时显示 */}
      {showEditor && (
        <div
          onMouseDown={handleResizeStart}
          className={`w-1 flex-shrink-0 cursor-col-resize transition-colors duration-150 ${isResizing ? 'bg-teal-400' : 'bg-gray-200 hover:bg-teal-300'}`}
          title="拖拽调整宽度"
        />
      )}

      {/* 代码编辑器区 */}
      <div
        className={`flex-shrink-0 transition-all duration-300 self-stretch ${showEditor ? '' : 'w-10'}`}
        style={showEditor ? { width: editorWidth, height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr' } : undefined}
      >
        {showEditor ? (
          <>
            {/* 工具栏 - grid auto 行，高度由内容决定，Monaco 无法影响 */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-100 rounded-t-xl border-x border-t border-gray-200">
              <div className="flex items-center gap-2">
                {/* 项目文件面板切换 */}
                {projectContext.projectId && (
                  <button
                    onClick={() => setShowFilesPanel(!showFilesPanel)}
                    className={`p-1 rounded transition-colors ${showFilesPanel ? 'bg-teal-100 text-teal-600' : 'text-gray-400 hover:bg-gray-200'}`}
                    title="项目资源"
                  >
                    <PanelLeft className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => setEditorTab('code')} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${editorTab === 'code' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
                  <Terminal className="w-3 h-3" /> 代码
                </button>
                <button onClick={() => setEditorTab('preview')} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${editorTab === 'preview' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
                  <Eye className="w-3 h-3" /> 预览
                </button>
                {/* 运行状态徽章 */}
                {runStatus === 'success' && (
                  <span className="flex items-center gap-0.5 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded" title="上次运行成功">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> 通过
                  </span>
                )}
                {runStatus === 'error' && (
                  <span className="flex items-center gap-0.5 text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded" title="上次运行失败">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full" /> 有错误
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <select value={editorLanguage} onChange={(e) => setEditorLanguage(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white text-gray-600 outline-none">
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                </select>
                <button onClick={handleRunEditorCode} disabled={runningCode} className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded text-xs font-medium transition-colors">
                  {runningCode ? (
                    <><span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin inline-block" /> 运行中</>
                  ) : (
                    <><Play className="w-3 h-3" /> 运行</>
                  )}
                </button>
                {editorTab === 'preview' && previewHtml && (
                  <button
                    onClick={() => {
                      const iframe = document.querySelector('iframe[title="运行结果"]') as HTMLIFrameElement | null;
                      const target = iframe?.contentDocument?.documentElement;
                      if (target?.requestFullscreen) {
                        target.requestFullscreen().catch(() => {});
                      } else if (iframe?.requestFullscreen) {
                        iframe.requestFullscreen().catch(() => {});
                      }
                    }}
                    className="p-1 hover:bg-gray-200 rounded text-gray-400 transition-colors"
                    title="全屏预览"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setShowEditor(false)} className="p-1 hover:bg-gray-200 rounded text-gray-400 transition-colors" title="收起编辑器">
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* 内容区 - flex-1 填满剩余空间 */}
            <div className={`flex-1 min-h-0 ${editorTab === 'code' ? 'bg-[#1e1e1e]' : 'bg-white'} rounded-b-xl border-x border-b border-gray-200 overflow-hidden`}>
              {editorTab === 'code' ? (
                <CodeEditor code={editorCode} language={editorLanguage} onChange={(v) => setEditorCode(v)} />
              ) : (
                <CodePreview htmlContent={previewHtml} title="运行结果" />
              )}
            </div>
          </>
        ) : (
          <button onClick={() => setShowEditor(true)}
            className="flex flex-col items-center justify-center gap-1 py-4 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 text-gray-400 hover:text-teal-600 transition-colors">
            <PanelLeftOpen className="w-4 h-4" />
            <span className="text-[10px] font-medium">编辑器</span>
          </button>
        )}
      </div>

      {/* 运行结果全屏模态框 */}
      {showRunResultModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowRunResultModal(false); }}
        >
          <div className="relative w-[95vw] h-[92vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
            {/* 模态框顶栏 */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">运行结果</span>
                {runResultUrl && (
                  <a
                    href={runResultUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:text-blue-700 ml-2 underline"
                  >
                    新窗口打开
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRunResultModal(false)}
                  className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                >
                  关闭 (ESC)
                </button>
              </div>
            </div>
            {/* 模态框内容区 */}
            <div className="flex-1 min-h-0 bg-white">
              {runResultUrl ? (
                // Streamlit 等服务：直接 iframe 嵌入真实 URL
                <iframe
                  src={runResultUrl}
                  className="w-full h-full border-0 block"
                  title="应用预览"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                />
              ) : runResultBlobUrl ? (
                // HTML/JS/CSS 预览：使用 Blob URL
                <iframe
                  src={runResultBlobUrl}
                  className="w-full h-full border-0 block"
                  title="运行结果"
                  sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups"
                />
              ) : (
                // 普通输出（Python等）：srcDoc 渲染
                <iframe
                  srcDoc={runResultHtml}
                  className="w-full h-full border-0 block"
                  title="运行结果"
                  sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups"
                />
              )}
            </div>
          </div>
        </div>
      )}

      <LightRegisterPrompt open={showRegisterPrompt} onClose={() => setShowRegisterPrompt(false)} />
    </div>
  );
}
