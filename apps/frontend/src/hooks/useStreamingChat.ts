import { useCallback, useEffect } from 'react';
import { authStorage, agentApi } from '../services/api';
import { QuestionData } from '../components/QuestionCard';
import { parseQuestionBlock, parseQuestionBlocks, extractChoiceListStrict } from '../lib/questionParser';
import { confirmQuestions } from '../lib/questionConfirm';
import { streamLogger } from '../lib/streamLogger';

// ──────────────────────────────────────────────────────────────
// ZeroClaw 工具名 / 输出归一化（2026-07-22 实证修复）
//
// 抓帧实证：ZeroClaw 推给前端的 tool_call / tool_result 帧里，工具名带
// `finestem__` 前缀（如 `finestem__ask_question`），但前端所有判断都用
// 无前缀的短名（`=== 'ask_question'`）→ 永远不匹配 → 选项卡不显示、
// 阶段推进事件丢失。根因是 ZeroClaw 按 MCP server name 给工具加了前缀。
//
// 同时 tool_result.output 是 MCP 双层 JSON：
//   "{ "content": [{ "type":"text", "text": "<内层JSON字符串>" }], "isError": false }"
// 前端需要解析出内层 JSON 的 data 字段才能拿到工具真实返回值。
// ──────────────────────────────────────────────────────────────

const MCP_TOOL_PREFIX = 'finestem__';

/** 把 `finestem__ask_question` 归一化成 `ask_question`；已是短名则原样返回。 */
export function normalizeToolName(rawName: unknown): string {
  const name = typeof rawName === 'string' ? rawName : '';
  return name.startsWith(MCP_TOOL_PREFIX) ? name.slice(MCP_TOOL_PREFIX.length) : name;
}

/**
 * 解析 MCP tool_result 的双层 JSON 输出。
 *
 * 实际帧结构（2026-07-22 抓帧实证）：
 *   output = '{"content":[{"type":"text","text":"<内层JSON>"}],"isError":false}'
 * 内层 JSON 是工具真实返回值（如 {"success":true,"data":{...}}）。
 *
 * 解析失败时原样返回（容错：有些工具输出可能是纯文本）。
 */
export function parseMcpOutput(rawOutput: unknown): { success: boolean; data: unknown } {
  if (rawOutput == null) return { success: true, data: null };
  // 已经是对象（理论上 ZeroClaw 不会这样，但容错）
  if (typeof rawOutput === 'object') {
    const obj = rawOutput as Record<string, any>;
    // 尝试 MCP content[0].text 结构
    if (Array.isArray(obj.content) && obj.content[0]?.text) {
      return _extractInnerJson(obj.content[0].text, obj.isError);
    }
    return { success: obj.isError !== true, data: obj };
  }
  // 字符串：尝试解析成 MCP 外层 JSON
  const str = String(rawOutput);
  try {
    const outer = JSON.parse(str);
    if (outer && typeof outer === 'object') {
      // MCP 标准结构
      if (Array.isArray(outer.content) && outer.content[0]?.text) {
        return _extractInnerJson(outer.content[0].text, outer.isError);
      }
      // 可能直接就是结果对象
      return { success: outer.isError !== true, data: outer };
    }
  } catch {
    // 不是 JSON，当纯文本
  }
  return { success: !/error|failed/i.test(str), data: str };
}

function _extractInnerJson(text: string, isError?: boolean): { success: boolean; data: unknown } {
  try {
    const inner = JSON.parse(text);
    // 内层是 {success, data, error} 结构
    if (inner && typeof inner === 'object' && ('success' in inner || 'data' in inner || 'error' in inner)) {
      return { success: inner.success !== false && isError !== true, data: inner.data ?? inner };
    }
    return { success: isError !== true, data: inner };
  } catch {
    return { success: isError !== true, data: text };
  }
}

interface StreamPayload {
  message: string;
  sessionId?: string;
  projectId?: string;
  context?: Record<string, unknown>;
  skillId?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface StreamResult {
  content: string;
  sessionId?: string;
  /** Q-023：流式因空闲超时被判定卡死（30s 无新 chunk）。调用方据此显示"继续生成"按钮。 */
  stalled?: boolean;
}

export interface CodeGeneratedEvent {
  project_id?: string;
  code: string;
  language: string;
  filename?: string;
  files?: Array<{ name: string; language: string; content: string; is_main?: boolean }>;
  saved_at?: string;
  source?: string;
}

export interface CodeGenerationFailedEvent {
  project_id?: string;
  reason: string;
  message: string;
}

interface StreamEvents {
  onSkillActivated?: (data: { skill_id: string; skill_name: string; sub_skill_id?: string; sub_skill_name?: string }) => void;
  onProjectCreated?: (data: { project_id: string; project_name: string; current_stage?: string }) => void;
  onToolCall?: (data: { tool_name: string; success: boolean; data?: unknown; phase: 'call' | 'result' }) => void;
  onStageChanged?: (data: { stage: string; stage_name: string }) => void;
  onQuestion?: (data: QuestionData) => void;
  /**
   * 多卡 question 事件（2026-07-19 新增）。
   * 当 AI 在一条回复里输出多个 <question> 块时，一次性把所有解析出的卡片传给调用方。
   * 比 onQuestion（单数，只传第一个）更完整。调用方应优先用 onQuestions；
   * onQuestion 保留只是为了向后兼容。
   */
  onQuestions?: (questions: QuestionData[]) => void;
  onCodeGenerated?: (data: CodeGeneratedEvent) => void;
  onCodeGenerationFailed?: (data: CodeGenerationFailedEvent) => void;
  onContentUpdate?: (content: string) => void;
  onEnd?: (content: string) => void;
  /**
   * 思考链（推理过程）回调。ZeroClaw 通过 `thinking` 帧推送模型的推理内容，
   * 不应混入正文（否则会让回复显得混乱）。调用方可以把它渲染到可折叠的
   * "思考过程"区域。如果未注册此回调，思考内容会被静默忽略（保持旧行为）。
   */
  onThinking?: (chunk: string) => void;
  /**
   * 代码提取门禁：返回 false 时，本 hook 不再从 LLM 文本兜底提取代码块（done 帧的 extractCodeEvent）。
   * 调用方（Create.tsx）用它实现 PBL 阶段门禁——选题/规划阶段不允许把 AI 举例的代码块写入编辑器。
   * 注意：只影响"从文本兜底提取"这条路径；project_code_writer 工具事件（onCodeGenerated 直发）
   * 不受此门禁影响，因为那是 AI 显式调用工具写代码，属于主动行为。
   * 默认（未传）视为允许，保持向后兼容。
   */
  shouldExtractCode?: () => boolean;
  /**
   * 自动续接状态回调（2026-07-21 新增）。
   * 当 AI 输出被截断并触发自动续接时，通知 UI 显示续接状态。
   */
  onAutoContinue?: (data: { attempt: number; maxAttempts: number; status: 'started' | 'completed' | 'failed' }) => void;
  /**
   * SOP 流程启动回调（2026-07-22 SOP/Memory 集成新增）。
   * 当 AI 调用 sop_execute 工具启动 SOP 流程时触发。
   */
  onSopStarted?: (runId: string) => void;
  /**
   * SOP 步骤状态更新回调（2026-07-22 SOP/Memory 集成新增）。
   * 当 sop_state_sync 或 sop_status 工具更新 SOP 进度时触发。
   */
  onSopStatusUpdate?: (data: { currentStep: string; stepStatus: string }) => void;
}

function getAnonymousId(): string {
  const key = 'anonymous_chat_id';
  const cached = localStorage.getItem(key);
  if (cached) return cached;
  const generated = `anon-${Date.now()}`;
  localStorage.setItem(key, generated);
  return generated;
}

function buildMessageWithSkillHint(message: string, skillId?: string): string {
  if (!skillId) {
    return message;
  }
  return `[[skill:${skillId}]] ${message}`;
}

/**
 * PBL 9 阶段顺序（与后端 stage_constants.STAGE_ORDER 对齐）。
 * 用于计算 stage_progress（如 3/9）注入上下文。
 */
const PBL_STAGE_ORDER = [
  'stage_00_bootstrap',
  'stage_01_brainstorm',
  'stage_02_brief',
  'stage_03_constraints',
  'stage_04_track_plan',
  'stage_05_design',
  'stage_06_step_plan',
  'stage_07_execute',
  'stage_08_evaluate',
] as const;

/**
 * 构造发给 ZeroClaw 的最终消息文本，注入项目上下文。
 *
 * 背景（2026-07-19 修复）：此前项目上下文靠 connect 帧的 cwd 字段
 * `finestem://${projectId}` 传递，但 ZeroClaw 0.8.3 把 cwd 当真实磁盘路径校验，
 * Windows 拒绝（os error 123）。删掉 cwd 后 AI 失去了项目感知。
 *
 * 现在改为在每条用户消息前注入结构化上下文块，AI 读到即知当前项目。
 * 上下文用明确分隔符包裹，避免污染用户原意。
 *
 * 2026-07-22 SOP/Memory 集成增强：新增 mode / stage_progress / evidence_count
 * 和 memory hint，帮助 AI 感知项目进度并触发记忆召回。
 */
function buildOutgoingMessage(
  message: string,
  skillId: string | undefined,
  context: Record<string, unknown> | undefined,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>,
): string {
  const parts: string[] = [];

  // 2026-07-31 Q-038：场景化指令注入。
  // daemon 只读 config.toml 内嵌的 PBL 导向 system_prompt，不感知“问问题/解释代码/
  // 写报告”等场景差异。后端 SCENE_SYSTEM_PROMPTS 的场景段落由 Create.tsx 通过
  // context.scene_instructions 传入，这里注入消息文本最前部（daemon 一定会读），
  // 并声明其优先级高于默认项目流程，让纯问答场景不再被强拉进 PBL 九步。
  const sceneInstructions = context?.scene_instructions as string | undefined;
  if (sceneInstructions && sceneInstructions.trim()) {
    parts.push(
      `<scene_instructions>\n本轮会话的场景要求（优先级高于默认项目流程，必须遵守）：\n${sceneInstructions.trim()}\n</scene_instructions>`,
    );
  }

  // 2026-07-30 Q-025 修复：注入近期对话历史。
  // 根因：此前 payload.messages（buildStreamHistory 构造）传进了 hook 却从未发送给 daemon，
  // AI 只靠 ZeroClaw session 记忆，而 session 不可靠（不回放上文）→ AI 失忆，记不住"已决定重写"
  // 这种近期对话。现在把历史原文注入 <conversation_history> 块，AI 每轮都能看到上文。
  if (Array.isArray(history) && history.length > 0) {
    // 每条 assistant 内容若过长（含代码块）截断到 ~500 字（保留首尾），避免 context 爆炸。
    // user 内容一般短，不截断。
    const MAX_ASSISTANT_LEN = 500;
    const lines = history.map((m) => {
      const speaker = m.role === 'user' ? '学生' : '导师';
      let c = m.content || '';
      if (m.role === 'assistant' && c.length > MAX_ASSISTANT_LEN) {
        c = `${c.slice(0, 200)}\n…（省略中段）…\n${c.slice(-200)}`;
      }
      return `[${speaker}]: ${c}`;
    });
    parts.push(`<conversation_history>\n${lines.join('\n')}\n</conversation_history>`);
  }

  // 项目上下文（关键：让 AI 知道当前在哪个项目）
  if (context && (context.project_id || context.project_name)) {
    const ctxLines: string[] = [];
    if (context.project_id) ctxLines.push(`project_id: ${context.project_id}`);
    if (context.project_name) ctxLines.push(`project_name: ${context.project_name}`);
    if (context.current_stage) ctxLines.push(`current_stage: ${context.current_stage}`);
    if (context.teaching_mode) ctxLines.push(`teaching_mode: ${context.teaching_mode}`);

    // 2026-07-22 SOP/Memory：注入教学模式和阶段进度
    const mode = context.mode as string | undefined;
    if (mode) ctxLines.push(`mode: ${mode}`);

    const currentStage = context.current_stage as string | undefined;
    if (currentStage) {
      const idx = PBL_STAGE_ORDER.indexOf(
        currentStage as (typeof PBL_STAGE_ORDER)[number],
      );
      if (idx >= 0) {
        ctxLines.push(`stage_progress: ${idx + 1}/9`);
      }
    }

    const evidenceCount = context.evidence_count as number | undefined;
    if (typeof evidenceCount === 'number' && evidenceCount > 0) {
      ctxLines.push(`evidence_count: ${evidenceCount}`);
    }

    // 2026-07-23 Q-005 修复：注入已收集的学生信息（具体答案值），防止 AI 重复问
    // 格式如 "年级 = 初中; 时间预算 = 6小时"
    const studentProfile = context.student_profile as string[] | undefined;
    if (Array.isArray(studentProfile) && studentProfile.length > 0) {
      ctxLines.push(`student_profile: ${studentProfile.join('; ')}`);
    }

    parts.push(`<context>\n${ctxLines.join('\n')}\n</context>`);

    // memory hint：当项目已有进度时，强制 AI 读取历史记忆，避免失忆重复问（Q-017）。
    // 升级为强制指令：新会话第一件事必须调 skill_state_reader 读画像和工件。
    if (currentStage && currentStage !== 'stage_00_bootstrap') {
      parts.push(
        `<memory_hint>该项目已有历史进度（${currentStage}）。` +
          `【强制】如果是新会话或你不确定学生之前选过什么，第一件事必须调用 ` +
          `skill_state_reader（include 含 standard_step_data 和 metadata）读取已收集的学生画像` +
          `（metadata.student_profile）和各阶段工件，严禁重复问已答过的问题` +
          `（如年级、兴趣、方向、选题等）。</memory_hint>`,
      );
    } else if (Array.isArray(studentProfile) && studentProfile.length > 0) {
      // 2026-07-30 失忆修复：初始化阶段（stage_00/无阶段）也要防重复问——
      // 此前 memory_hint 只在非 stage_00 注入，初始化三轮提问中途续聊时 AI 无任何
      // 防重复指令，会重走初始化提问流程（用户反馈的"重复问阶段初始化问题"）。
      parts.push(
        `<memory_hint>学生已回答过 <context> 中 student_profile 列出的问题，` +
          `严禁重复提问这些已有答案的问题（如年级、兴趣、方向），` +
          `请直接基于已有答案继续下一步。</memory_hint>`,
      );
    }
  }

  // skill 标识（保留原有机制）
  if (skillId) {
    parts.push(`[[skill:${skillId}]]`);
  }

  parts.push(message);
  return parts.join('\n\n');
}

// -----------------------------------------------------------------------------
// ZeroClaw Gateway 连接配置
// 真实部署：H:\dev-env\zeroclaw，监听 http://127.0.0.1:42617
// 不再走 FastAPI 的 /api/v1/agent/ws。
//   - 文档: docs/技术与架构/ZeroClaw_技术知识库_v1.0.0.md
//   - 鉴权: require_pairing=true，使用 Bearer Token
// -----------------------------------------------------------------------------
function getZeroClawWsBaseUrl(): string {
  const override = import.meta.env.VITE_ZC_URL as string | undefined;
  if (override) {
    const httpUrl = override.startsWith('http')
      ? override
      : `${window.location.protocol}//${override}`;
    const url = new URL(httpUrl);
    const proto = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${url.host}`;
  }
  // 开发默认：本机 ZeroClaw daemon
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//127.0.0.1:42617`;
}

function getZeroClawBearerToken(): string {
  const fromEnv = import.meta.env.VITE_ZC_TOKEN as string | undefined;
  if (fromEnv) return fromEnv;
  // 浏览器允许同一个 origin 顺手拿 localStorage，便于本地开发
  const fromLs = localStorage.getItem('zeroclaw_bearer_token');
  if (fromLs) return fromLs;
  throw new Error('未配置 ZeroClaw Bearer Token，请设置 VITE_ZC_TOKEN 或在 localStorage 存储 zeroclaw_bearer_token');
}

// ── 模型策略：offpeak_deepseek 开关缓存 ──
// 从后端 feature flag 拉取，localStorage 兜底（admin 改后用户刷新页面即生效）。
// 默认全程 qwen-plus；开关开启且非高峰时段才走 deepseek-v4-flash。
let _offpeakDsEnabled = false;
const _OFFPEAK_DS_LS_KEY = 'finestem_offpeak_deepseek';
try { _offpeakDsEnabled = localStorage.getItem(_OFFPEAK_DS_LS_KEY) === '1'; } catch {/* 无存储时默认 false */}

/** 从后端刷新"非高峰用 DeepSeek"开关到缓存（hook 挂载时调用） */
export function refreshModelStrategyFlag(): void {
  agentApi.featureFlags().then((res) => {
    _offpeakDsEnabled = res.data?.offpeak_deepseek?.enabled ?? false;
    try { localStorage.setItem(_OFFPEAK_DS_LS_KEY, _offpeakDsEnabled ? '1' : '0'); } catch {/* */}
  }).catch(() => {/* 拉取失败沿用缓存值 */});
}

/** 当前是否为 DeepSeek 高峰时段（北京时间 9-12、14-18，DS 此时最贵） */
function _isDeepSeekPeakHour(): boolean {
  const h = Number(new Intl.DateTimeFormat('zh-CN',
    { timeZone: 'Asia/Shanghai', hour: '2-digit', hour12: false }).format(new Date()));
  return (h >= 9 && h < 12) || (h >= 14 && h < 18);
}

function getZcAgentAlias(): string {
  // 允许手动覆盖（调试/锁定某个 agent）
  const explicit = import.meta.env.VITE_ZC_AGENT as string | undefined;
  if (explicit) return explicit;
  // 管理员开启"非高峰用 DeepSeek"且当前非高峰 → deepseek-v4-flash
  if (_offpeakDsEnabled && !_isDeepSeekPeakHour()) return 'assistant';
  // 默认 / 高峰 → qwen-plus（主力，最省）
  return 'assistant_qwen';
}

// -----------------------------------------------------------------------------
// LLM 文本里的 <question> XML 解析（从后端 orchestrator._parse_question_block 移植）
// ZeroClaw 不发业务事件，前端直接解析 LLM 流式输出
// -----------------------------------------------------------------------------
function containsQuestionBlock(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  const markers = ['<question>', '<question ', '<question\n', '【提问】', '[提问]', '::question::', '{{question}}'];
  if (markers.some((m) => lower.includes(m))) return true;
  if (/<option\s+id=["']/.test(text)) return true;
  return false;
}

function stripQuestionXml(text: string): { clean: string; hasQuestion: boolean } {
  if (!text) return { clean: text, hasQuestion: false };
  const hasQuestion = containsQuestionBlock(text);
  const cleaned = text
    .replace(/<question[^>]*>[\s\S]*?<\/question>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<option[^>]*>[\s\S]*?<\/option>/gi, '')
    .trim();
  return { clean: cleaned, hasQuestion };
}

// 2026-07-20 智能截断检测：检测内容是否看起来不完整
function _detectIncompleteContent(text: string): boolean {
  if (!text || text.length < 10) return false;
  
  const trimmed = text.trim();
  
  // 1. 以未闭合的代码块结尾（奇数个 ```）
  const codeBlockMatches = trimmed.match(/```/g);
  if (codeBlockMatches && codeBlockMatches.length % 2 === 1) {
    return true;
  }
  
  // 2. 以未闭合的 XML/HTML 标签结尾
  const openTags = trimmed.match(/<([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g);
  const closeTags = trimmed.match(/<\/[a-zA-Z][a-zA-Z0-9]*>/g);
  if (openTags && closeTags && openTags.length > closeTags.length) {
    // 检查最后是否有未闭合标签
    const lastOpenMatch = trimmed.match(/<([a-zA-Z][a-zA-Z0-9]*)[^>]*>[^<]*$/);
    if (lastOpenMatch) {
      const tagName = lastOpenMatch[1];
      const closePattern = new RegExp(`</${tagName}>`);
      if (!closePattern.test(trimmed)) {
        return true;
      }
    }
  }
  
  // 3. 以编程语言名称结尾（可能想输出代码块但被截断）
  const langPattern = /(python|javascript|typescript|html|css|java|c\+\+|go|rust|php|ruby|swift|kotlin)\s*$/i;
  if (langPattern.test(trimmed)) {
    return true;
  }
  
  // 4. 以列表项开头但未完成（如 "1. "、"- "、"* " 结尾）
  const lines = trimmed.split('\n');
  const lastLine = lines[lines.length - 1].trim();
  if (/^(\d+\.\s*[-*]\s*)$/.test(lastLine)) {
    return true;
  }
  
  // 5. 以问句结尾但太短（可能是被截断的引导）
  if (/[？?]\s*$/.test(trimmed) && trimmed.length < 100) {
    // 检查是否是完整的问句（有上下文）
    const sentences = trimmed.split(/[。！？.!?]/);
    if (sentences.length <= 2) {
      return true;
    }
  }
  
  // 6. 以 "接下来"、"首先"、"第一步" 等引导词结尾
  const guidePatterns = /(接下来|首先|第一步|然后|接着|最后|总之|综上所述|综上所述)\s*$/i;
  if (guidePatterns.test(trimmed)) {
    return true;
  }
  
  // 7. 以冒号或破折号结尾（可能想列举但被截断）
  if (/[：:—–-]\s*$/.test(trimmed)) {
    return true;
  }
  
  return false;
}


// 从 LLM 文本中提取可执行代码块 → 触发 onCodeGenerated
function extractCodeEvent(text: string, projectId?: string): CodeGeneratedEvent | null {
  if (!text) return null;
  const executableLangs = new Set(['python', 'py', 'javascript', 'js', 'typescript', 'ts', 'tsx', 'jsx', 'html', 'css']);
  const pattern = /```(\w+)?\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let htmlCandidate: CodeGeneratedEvent | null = null;
  let longest: CodeGeneratedEvent | null = null;
  while ((m = pattern.exec(text)) !== null) {
    const langRaw = (m[1] || '').toLowerCase();
    const code = (m[2] || '').trim();
    if (!executableLangs.has(langRaw) || code.length <= 30) continue;
    const normalized = normalizeLang(langRaw);
    const filename = guessFilename(normalized);
    const event: CodeGeneratedEvent = {
      project_id: projectId,
      code,
      language: normalized,
      filename,
      source: 'llm_text',
    };
    if (normalized === 'html') htmlCandidate = event;
    if (!longest || event.code.length > longest.code.length) longest = event;
  }
  return htmlCandidate || longest;
}

function normalizeLang(lang: string): string {
  if (lang === 'py') return 'python';
  if (lang === 'js') return 'javascript';
  if (lang === 'ts') return 'typescript';
  return lang;
}

function guessFilename(lang: string): string {
  switch (lang) {
    case 'html': return 'index.html';
    case 'javascript': return 'main.js';
    case 'typescript': return 'main.ts';
    case 'css': return 'style.css';
    case 'python': return 'main.py';
    default: return 'main.txt';
  }
}

// -----------------------------------------------------------------------------
// useStreamingChat
//   连接真实 ZeroClaw ws://127.0.0.1:42617/ws/chat
//   - query: ?token=<bearer>&agent=<alias>&session_id=<id>
//   - 握手: session_start → 客户端发 connect → server 回 connected
//   - 用户消息: {"type":"message","content":"<text>"}
//   - 流式事件:
//       chunk / thinking / tool_call / tool_result / done / aborted /
//       approval_request / history_trimmed / plan / error
// -----------------------------------------------------------------------------

// 自动续接配置
const AUTO_CONTINUE_CONFIG = {
  // 2026-07-29 Q-023-A：从 2 提到 3。大段代码（HTML+CSS+JS 教学项目）单次 max_tokens
  // 可能仍不够（即使配了 16384），需多次自动续接才能完整输出。
  maxAttempts: 3,           // 最多尝试续接次数
  enableAutoContinue: true, // 是否启用自动续接
};

// ------------------------------------------------------------------
// 2026-07-31 Q-038：活跃流中止能力。
// 背景：此前 WS 意外关闭时 promise 永不 settle → Create.tsx 的 isLoading
// 永久 true → 输入框死锁（用户反馈“卡死在对话框、重新写入也无反应”）。
// 除修复 onclose 外，这里提供显式中止入口：停止按钮 / 新建项目时调用，
// 立即关闭连接并以 aborted 错误 settle，解除 loading。
// 模块级单例：同一时刻最多一条活跃流（Create 页串行发送）。
// ------------------------------------------------------------------
let activeAbort: (() => void) | null = null;

/** 中止当前活跃的流式对话（若有）。返回是否真的中止了一条流。 */
export function abortActiveStream(): boolean {
  if (activeAbort) {
    try { activeAbort(); } catch (e) { console.error('[useStreamingChat] abort failed', e); }
    return true;
  }
  return false;
}

/** 判断错误是否来自用户主动中止（调用方据此静默处理，不当成失败报错）。 */
export function isAbortError(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { aborted?: boolean }).aborted === true);
}

export function useStreamingChat() {
  // 挂载时刷新模型策略开关（offpeak_deepseek），决定走 qwen-plus 还是 deepseek-flash
  useEffect(() => { refreshModelStrategyFlag(); }, []);

  const stream = useCallback(async (
    payload: StreamPayload,
    onToken: (token: string) => void,
    events?: StreamEvents,
  ): Promise<StreamResult> => {
    const token = getZeroClawBearerToken();
    const agent = getZcAgentAlias();
    const baseUrl = getZeroClawWsBaseUrl();
    const sessionId = payload.sessionId || `finestem-${Date.now()}`;
    
    // 启动日志会话
    streamLogger.startSession(sessionId, payload.projectId);

    // 执行带自动续接的流式对话
    return await _doStreamWithAutoContinue(
      payload,
      onToken,
      events,
      token,
      agent,
      baseUrl,
      sessionId,
      0,  // 续接尝试次数
      ''  // 累积的内容
    );
  }, []);

  return { stream };
}

// 内部函数：执行流式对话，支持自动续接
//
// 关键修复（2026-07-21）：续接时必须复用同一个 ZeroClaw session_id。
// 原实现在续接时把 sessionId 改成 `sessionId_c1`，新会话没有任何对话历史，
// ZeroClaw 不知道"上面的输出"是什么，续接请求就变成一个没有上文的孤立问题，
// 要么答非所问，要么再次被截断 → 表现为"自动续接/继续按钮没用"。
// 正确做法：保持 session_id 不变，让 ZeroClaw 在同一会话内继续，AI 自然
// 能看到前一轮自己的输出并从截断处接续。
async function _doStreamWithAutoContinue(
  payload: StreamPayload,
  onToken: (token: string) => void,
  events: StreamEvents | undefined,
  token: string,
  agent: string,
  baseUrl: string,
  sessionId: string,
  continueAttempt: number,
  accumulatedContent: string
): Promise<StreamResult> {
  // 复用原始 session_id：ZeroClaw 会保留同一会话的历史，续接才有效
  const wsUrl = `${baseUrl}/ws/chat?token=${encodeURIComponent(token)}&agent=${encodeURIComponent(agent)}&session_id=${encodeURIComponent(sessionId)}`;
  const ws = new WebSocket(wsUrl);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket 连接超时'));
    }, 10000);

    ws.onopen = () => {
      clearTimeout(timeout);
      resolve();
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      // R8 修复：daemon 单点防护。给学生友好提示，给开发者技术信息。
      const err = new Error('AI 服务暂时不可用，请稍后重试。如果问题持续，请检查网络连接。') as Error & { isDaemonDown?: boolean };
      err.isDaemonDown = true;
      console.error('[useStreamingChat] WebSocket 连接失败 — ZeroClaw daemon 可能未运行。检查 127.0.0.1:42617/health');
      reject(err);
    };
  });

  return await new Promise<StreamResult>((resolveRaw, rejectRaw) => {
    let fullContent = accumulatedContent;  // 从累积内容开始
    let sessionContent = '';               // 本次会话的新内容
    let connectedOk = false;
    let codeEventFired = false;
    let questionFired = false;  // ask_question 工具路径已渲染卡片时设 true，防止 done 帧重复渲染
    let receivedSessionStart = false;
    let finishReason: string | null = null;

    // 2026-07-31 Q-038 死锁修复：settled 包装 + 意外关闭兜底。
    // 根因：原 ws.onclose 只清计时器不 settle promise，且把唯一兜底的 totalTimeout
    // 也清掉了 → WS 意外关闭（daemon 重启/网络闪断/浏览器挂起）时 promise 永久
    // 挂起 → Create.tsx 的 finally 永远不执行 → isLoading 永久 true → 输入框死锁
    // （用户反馈“卡死在对话框、哪怕从菜单重新写入也无反应”的直接根因）。
    // settled 保证只 settle 一次；deliberateSettle 标记“即将由业务分支 settle”，
    // 避免自动续接等路径主动 close 后被 onclose 兜底误 settle。
    let settled = false;
    let deliberateSettle = false;
    const resolve = (value: StreamResult) => {
      if (settled) return;
      settled = true;
      if (activeAbort === abortThisStream) activeAbort = null;
      resolveRaw(value);
    };
    const reject = (err: Error) => {
      if (settled) return;
      settled = true;
      if (activeAbort === abortThisStream) activeAbort = null;
      rejectRaw(err);
    };
    // 显式中止（停止按钮 / 新建项目）：立即关连接并以 aborted 错误 settle
    const abortThisStream = () => {
      deliberateSettle = true;
      const err = new Error('已停止本次回复') as Error & { aborted?: boolean };
      err.aborted = true;
      streamLogger.log('user_abort', { contentLength: fullContent.length });
      try { ws.close(); } catch (e) { /* ignore */ }
      reject(err);
    };
    activeAbort = abortThisStream;

    // 2026-07-30 Q-023 残留截断修复：totalTimeout 120s→300s 且随非终态帧重置。
    // 根因：原 120s 从握手后一次性计时，chunk 期间从不重置（clearTimeout 只在终态帧）。
    // 讲解式生成大段代码（多工具调用+长文本）整体响应超 120s → reject 超时 → catch 追加
    // "[输出被截断]"。改为"自最后一个活动帧起 300s 无活动才超时"——只要流还活着就不超时。
    // idleTimer(90s) 兜底"真卡死"的快速判定；totalTimeout(300s,随活动重置)兜底"永久挂起"。
    const TOTAL_TIMEOUT_MS = 300000;
    const resetTotalTimeout = () => {
      clearTimeout(totalTimeout);
      totalTimeout = setTimeout(() => {
        deliberateSettle = true;
        ws.close();
        reject(new Error('AI 响应超时，请稍后重试'));
      }, TOTAL_TIMEOUT_MS);
    };
    let totalTimeout = setTimeout(() => {
      deliberateSettle = true;
      ws.close();
      reject(new Error('AI 响应超时，请稍后重试'));
    }, TOTAL_TIMEOUT_MS);

    // 2026-07-29 Q-023 修复A：chunk 间空闲超时（idleTimer）。
    // 背景：totalTimeout（120s）从握手后一次性计时，不随 chunk 重置。
    // AI 吐字到一半（如"词库 ="）卡住后，要干等满 120s 才报超时——用户看到的是
    // 三个点无止境转圈。idleTimer 在收到首个 chunk 后启动，每来一个新 chunk 重置；
    // 30s 无新 chunk → 判定卡死 → 保留已收到内容（不丢"词库 ="那段）+ resolve
    // （非 reject），让上层走"显示继续生成按钮"路径。
    // 2026-07-30 截断死循环根因修复（项目 8a7c155e 实证）：30s → 90s。
    // 原 30s 阈值会在 AI 调用工具（project_code_writer 写大段代码 / skill_state_reader 读 DB）
    // 期间误判卡死——工具执行期间 daemon 不发 chunk，30s 一到就判定 stalled → 追加中断标记 +
    // 触发续接 → 死循环。实证：该项目多条带"中断"标记的消息正文含"代码已写入编辑器""现在写入
    // 完整代码"，正是工具执行期间的误判。90s 给足工具执行窗口（写 30k 字符代码 + 存 DB）。
    const IDLE_TIMEOUT_MS = 90000;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let idleFired = false;
    // 2026-07-30 Q-023 深度修复：idleTimer 误判根因。
    // 原实现 resetIdleTimer 写在 onmessage 回调内部，依赖"回调被执行"来重置计时器。
    // 但前端渲染积压时，WS 帧虽已到达并进事件队列，React 渲染占满主线程导致 onmessage
    // 迟迟不跑 → 计时器到点 → 误判卡死 → 触发自动续接 → 续接塞更多字 → 更卡，恶性循环。
    // 修复：lastWsDataTs 在 onmessage 最开头（JSON.parse 前）记录帧到达时间。
    // 计时器到点时检查：若距上一帧到达不足阈值，说明帧还在来只是没处理完，重置计时器继续等，
    // 不误判卡死。只有真的超过阈值无新帧才判定 stalled。
    let lastWsDataTs = 0;
    function resetIdleTimer() {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (idleFired) return;
        // 帧仍在到达（只是渲染积压没处理完），不判定卡死，继续等待
        if (lastWsDataTs > 0 && Date.now() - lastWsDataTs < IDLE_TIMEOUT_MS) {
          resetIdleTimer();
          return;
        }
        idleFired = true;
        deliberateSettle = true;
        console.warn('[useStreamingChat] chunk 空闲超时（90s 无新内容），判定流式疑似卡死，保留已收到的内容', {
          contentLength: fullContent.length,
          continueAttempt,
        });
        streamLogger.log('idle_timeout', { contentLength: fullContent.length, idleMs: IDLE_TIMEOUT_MS });
        try { ws.close(); } catch (e) { /* ignore */ }
        // 2026-07-31 Q-038：有内容时保留内容走“继续生成”路径；完全无内容时
        // reject 友好错误（此前 resolve 空内容 + stalled 会让用户看到空气泡+继续按钮，莫名其妙）
        if (fullContent.trim().length > 0) {
          resolve({ content: fullContent, sessionId, stalled: true });
        } else {
          const err = new Error('AI 长时间未响应，请重试。如果反复出现，请检查 AI 服务状态。') as Error & { isTimeoutError?: boolean };
          err.isTimeoutError = true;
          reject(err);
        }
      }, IDLE_TIMEOUT_MS);
    }
    function clearIdleTimer() {
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    }

    const handshakeTimeout = setTimeout(() => {
      if (!connectedOk) {
        deliberateSettle = true;
        ws.close();
        reject(new Error('ZeroClaw 握手失败：等不到 connected 帧'));
      }
    }, 8000);

      ws.onmessage = async (event) => {
        // 2026-07-30 Q-023 深度修复：帧一到达立即记录时间戳（在所有解析/业务逻辑之前）。
        // 这样即使后续同步 JS 执行被渲染积压阻塞，idleTimer 也能基于"真实收帧时间"判定，
        // 而非"回调执行时间"。是避免渲染积压误判卡死的关键。
        lastWsDataTs = Date.now();
        let data: Record<string, any>;
        try {
          data = JSON.parse(event.data as string);
        } catch {
          return;
        }

        const type = data.type as string | undefined;

        // 2026-07-29 Q-023 修复A（回归修正）：idleTimer 必须在收到任何"活动帧"时重置，
        // 而非仅在 chunk 帧时。AI 生成代码时会穿插 thinking（推理）/ tool_call
        // （skill_state_reader/project_code_writer）/ tool_result / code_generated 等帧，
        // 这些期间没有 chunk 但流是活的（daemon 在正常工作）。若只靠 chunk 重置，
        // 一次工具调用或长推理超过 30s 就会被误判卡死、截断正常输出。
        // 终态帧（done/aborted/error）在各自分支里 clearIdleTimer，不在这里重置。
        if (idleTimer && type && type !== 'done' && type !== 'aborted' && type !== 'error') {
          resetIdleTimer();
          // 2026-07-30 Q-023 残留截断修复：totalTimeout 也随活动帧重置，
          // 避免大段代码生成整体超时被强制截断。
          resetTotalTimeout();
        }

        // 握手阶段
        if (type === 'session_start') {
          receivedSessionStart = true;
          // 客户端必须显式回 connect 帧，才能进入 connected 状态
          // 注意：不要传 cwd 字段。此前这里曾传 `finestem://${projectId}` 作为虚拟
          // workspace 标识，但 ZeroClaw 0.8.3 的 ws.rs:1460 会把它当真实磁盘路径校验，
          // Windows 拒绝（os error 123 = ERROR_INVALID_NAME）。不传则使用 daemon 默认
          // workspace（H:\dev-env\zeroclaw\config\agents\assistant\workspace）。
          // 项目上下文已经通过 messages / tool_call 的 project_id 参数传递，不需要 cwd。
          ws.send(JSON.stringify({
            type: 'connect',
            session_id: sessionId,
            device_name: 'finestem-web',
            capabilities: ['tool_calls', 'streaming'],
          }));
          return;
        }

        if (type === 'connected') {
          connectedOk = true;
          clearTimeout(handshakeTimeout);
          // 握手完成，发出第一条用户消息
          // 通过 buildOutgoingMessage 把项目上下文 + 近期对话历史注入消息文本（替代被删的 cwd 字段）
          // Q-025：传入 payload.messages 让 AI 看到上文，避免失忆
          const outgoing = buildOutgoingMessage(payload.message, payload.skillId, payload.context, payload.messages);
          ws.send(JSON.stringify({
            type: 'message',
            content: outgoing,
          }));
          // 2026-07-31 Q-038 首帧超时收紧：发出消息后立即启动 idleTimer。
          // 此前 idleTimer 只在收到首个 chunk 后才启动，首帧之前只有 300s 的
          // totalTimeout 兜底 —— AI 完全不回复时用户要干等 5 分钟才见到错误。
          // 现在首帧窗口也受 90s idle 约束，无响应时 90s 内就能给出友好提示。
          resetIdleTimer();
          return;
        }

        // 业务事件
        if (type === 'chunk' && typeof data.content === 'string') {
          fullContent += data.content;
          sessionContent += data.content;  // 记录本次会话的新内容
          streamLogger.logToken(data.content, {
            rawAssistantContentLength: fullContent.length,
            sessionContentLength: sessionContent.length,
            continueAttempt,
          });
          onToken(data.content);
          // Q-023 修复A：收到 chunk 重置空闲计时器（吐字正常时每 30s 内必有新内容）
          resetIdleTimer();
          return;
        }

        if (type === 'thinking' && typeof data.content === 'string') {
          // 思考链（推理过程）。原来直接 return 导致内容被丢弃，用户看不到。
          // 现在通过专门回调 onThinking 透传给上层，由 Create.tsx 决定如何渲染
          // （可折叠的"思考过程"区域）。不混入正文，避免污染最终回复。
          streamLogger.log('thinking', { length: data.content.length });
          try { events?.onThinking?.(data.content as string); } catch (e) { console.error('[useStreamingChat] onThinking failed', e); }
          return;
        }

        if (type === 'tool_call') {
          try {
            // 2026-07-22 实证修复：ZeroClaw 工具名带 finestem__ 前缀，
            // 必须归一化成短名（ask_question / project_creator 等）才能匹配后续判断。
            const toolName = normalizeToolName(data.name);
            // 2026-07-30 可观测性：每个工具调用打一条控制台日志。此前前端不打印
            // 工具名，E2E 脚本靠匹配控制台文本断言"AI 调用了 project_code_reader"
            // 永远捕不到（2026-07-30 实测报告 A1.7/TC-07 假阴性根因）。
            console.info('[tool_call]', toolName);
            events?.onToolCall?.({
              tool_name: toolName,
              success: true,
              data: data.args,
              phase: 'call',
            });
            // ask_question 工具：AI 通过工具调用表达结构化提问。
            // 实证：args 含 title/options/step/total_steps，结构完整可直接渲染。
            if (toolName === 'ask_question' && data.args) {
              const args = data.args as Record<string, any>;
              const questionData: QuestionData = {
                id: `tool-${data.id || Date.now()}`,
                title: args.title || '请选择',
                multiple: args.multiple === true,
                step: args.step,
                totalSteps: args.total_steps,
                options: (args.options || []).map((opt: any, idx: number) => ({
                  id: opt.id || `opt-${idx}`,
                  label: opt.label || opt.id || `选项 ${idx + 1}`,
                  description: opt.description,
                })),
              };
              if (questionData.options.length > 0) {
                console.info('[useStreamingChat] ask_question 工具调用，渲染卡片:', questionData.title);
                questionFired = true;  // 标记已通过工具路径渲染，防止 done 帧重复
                if (events?.onQuestions) {
                  events.onQuestions([questionData]);
                } else if (events?.onQuestion) {
                  events.onQuestion(questionData);
                }
              }
            }
          } catch (e) {
            console.error('[useStreamingChat] onToolCall failed', e);
          }
          return;
        }

        if (type === 'tool_result') {
          try {
            // 2026-07-22 实证修复：工具名归一化 + MCP 双层 output 解析。
            // 实际 output 是 '{"content":[{"text":"<内层JSON>"}],"isError":false}'，
            // 需要解析出内层 JSON 的 data 才是工具真实返回值。
            const toolName = normalizeToolName(data.name);
            const parsed = parseMcpOutput(data.output);
            const success = parsed.success;
            const outData = parsed.data;
            // 2026-07-30 可观测性：与 tool_call 对称，结果也打日志（含成败）
            console.info('[tool_result]', toolName, success ? 'ok' : 'failed');
            events?.onToolCall?.({
              tool_name: toolName,
              success,
              data: outData,
              phase: 'result',
            });
            // project_creator：创建项目后拿 project_id / current_stage
            if (toolName === 'project_creator' && success && outData) {
              const out = outData as Record<string, any>;
              events?.onProjectCreated?.({
                project_id: out.project_id || out.id || '',
                project_name: out.name || out.project_name || '新项目',
                current_stage: out.current_stage,
              });
              if (out.current_stage) {
                events?.onStageChanged?.({
                  stage: out.current_stage,
                  stage_name: out.current_stage,
                });
              }
            }
            // project_code_writer：代码写入工作区
            if (toolName === 'project_code_writer' && success && outData) {
              const out = outData as Record<string, any>;
              codeEventFired = true;
              events?.onCodeGenerated?.({
                project_id: out.project_id || payload.projectId,
                code: out.code || '',
                language: out.language || 'html',
                filename: out.filename,
                files: out.files,
                saved_at: out.saved_at,
                source: 'tool',
              });
            }
            // stage_advancer：阶段推进
            if (toolName === 'stage_advancer' && success && outData) {
              const out = outData as Record<string, any>;
              const stage = out.new_stage || out.current_stage || '';
              if (stage) {
                events?.onStageChanged?.({ stage, stage_name: stage });
              }
            }
            // 2026-07-22 SOP/Memory 集成：5 种新工具结果处理
            // project_memory_store：记忆存储结果（主要用于日志，不需 UI 反馈）
            if (toolName === 'project_memory_store' && success && outData) {
              const out = outData as Record<string, any>;
              console.info('[useStreamingChat] memory stored:', out.key, out.action);
            }
            // project_memory_recall：记忆召回结果
            if (toolName === 'project_memory_recall' && success && outData) {
              const out = outData as Record<string, any>;
              console.info('[useStreamingChat] memory recalled:', out.count, 'entries');
            }
            // sop_state_sync：SOP 状态同步到项目
            if (toolName === 'sop_state_sync' && success && outData) {
              const out = outData as Record<string, any>;
              events?.onSopStatusUpdate?.({
                currentStep: out.current_step || '',
                stepStatus: out.step_status || '',
              });
            }
            // sop_execute：SOP 流程启动
            if (toolName === 'sop_execute' && success && outData) {
              const out = outData as Record<string, any>;
              const runId = out.run_id || out.sop_run_id || '';
              if (runId) {
                events?.onSopStarted?.(runId);
              }
            }
            // sop_status：SOP 状态查询结果
            if (toolName === 'sop_status' && success && outData) {
              const out = outData as Record<string, any>;
              events?.onSopStatusUpdate?.({
                currentStep: out.current_step || out.step || '',
                stepStatus: out.step_status || out.status || '',
              });
            }
          } catch (e) {
            console.error('[useStreamingChat] onToolCall result mapping failed', e);
          }
          return;
        }

        // 2026-07-28 Q-019 修复：后端 orchestrator 在 project_code_writer 工具成功后，
        // 会从 DB workspace 读取完整 code/files 并专门 yield 一个 code_generated 事件
        // （orchestrator.py:1015-1023）。这是数据最全、最权威的代码来源。
        // 但此前前端没有任何 type === 'code_generated' 的处理分支，导致该事件被整体忽略。
        // 唯一读代码的 tool_result 路径（line 684-697）读的 out.code/out.files，
        // 后端 ToolResult.data 又恰好不返回这两个字段 → 编辑器永远空白。
        // 这里补上独立分支，读后端权威数据，并复用 codeEventFired 防止与文本兜底重复触发。
        if (type === 'code_generated' && data) {
          const d = data as Record<string, any>;
          const codeStr = typeof d.code === 'string' ? d.code : '';
          if (codeStr && codeStr.trim().length > 10) {
            codeEventFired = true;
            try {
              events?.onCodeGenerated?.({
                project_id: d.project_id || payload.projectId,
                code: codeStr,
                language: d.language || 'html',
                filename: d.filename,
                files: Array.isArray(d.files) ? d.files : undefined,
                saved_at: d.saved_at,
                source: d.source || 'tool',
              });
            } catch (e) {
              console.error('[useStreamingChat] code_generated event failed', e);
            }
          }
          return;
        }

        if (type === 'done') {
          deliberateSettle = true;  // Q-038：后续一定会由本分支 settle，onclose 兜底不要接管
          clearTimeout(totalTimeout);
          clearIdleTimer();  // Q-023 修复A：正常结束，清空闲计时器
          let content = typeof data.full_response === 'string' ? data.full_response : fullContent;
          sessionContent = content.substring(accumulatedContent.length); // 本次新内容

          // 2026-07-20 智能截断检测
          const finishReason = data.finish_reason || data.finishReason;
          const isLengthTruncated = finishReason === 'length';
          const isContentIncomplete = _detectIncompleteContent(content);
          // 2026-07-29 Q-023-A 截断深度修复：daemon done 帧不带 finish_reason（WS 诊断实证），
          // 但带 output_tokens。当 output_tokens 接近 max_tokens（>90%）时，几乎一定是
          // token 上限截断（代码作为工具参数被切）。这是不依赖 finish_reason 的可靠检测。
          const outputTokens = typeof data.output_tokens === 'number' ? data.output_tokens : 0;
          const MAX_TOKENS_ESTIMATE = 65536;  // 与 config.toml max_tokens 对齐
          const isTokenLimitHit = outputTokens > 0 && outputTokens >= MAX_TOKENS_ESTIMATE * 0.9;
          // 2026-07-30 截断死循环根因修复（项目 8a7c155e 实证）：
          // 启发式 _detectIncompleteContent（看结尾字符：奇数 fence/冒号/破折号/引导词）会把 AI
          // 正常停顿（如讲解代码时写"词库 ="+开了 ```）误判为截断 → 追加"[输出可能不完整]"
          // + 触发自动续接 → 续接失灵 AI 从头讲 → 又被误判 → 死循环。实证：该项目 72 条对话
          // 最长才 1996 字符（~1500 token），全部远低于 max_tokens=65536，根本不是 token 截断。
          // daemon done 帧不带 finish_reason，唯一可靠的截断信号是 output_tokens >= 上限*0.9。
          // 故 shouldSuggestContinue 只信 isTokenLimitHit（+ daemon 偶尔带的 finish_reason=length）。
          // _detectIncompleteContent/isContentIncomplete 保留计算仅用于诊断日志，不再驱动截断判定。
          const shouldSuggestContinue = isLengthTruncated || isTokenLimitHit;

          // === 诊断日志（2026-07-19）：帮助定位"AI 没输出 XML 时为什么没卡片"===
          console.info('[useStreamingChat][done] AI 原始回复长度:', content?.length || 0);
          console.info('[useStreamingChat][done] finish_reason:', finishReason);
          console.info('[useStreamingChat][done] output_tokens:', outputTokens, isTokenLimitHit ? '(⚠️接近上限=截断)' : '');
          console.info('[useStreamingChat][done] 是否截断:', shouldSuggestContinue, '(启发式incomplete=', isContentIncomplete, '仅日志，不驱动续接)');
          console.info('[useStreamingChat][done] 是否含 <question> 标签:', /<question/i.test(content || ''));

          // 记录到详细日志
          streamLogger.log('done', {
            fullContentLength: fullContent.length,
            finishReason,
            outputTokens,
            isTokenLimitHit,
            isLengthTruncated,
            isContentIncomplete,
            shouldSuggestContinue,
            hasQuestionTag: /<question/i.test(content || ''),
            continueAttempt,
          });

          // ========== 自动续接逻辑 ==========
          if (shouldSuggestContinue && 
              AUTO_CONTINUE_CONFIG.enableAutoContinue && 
              continueAttempt < AUTO_CONTINUE_CONFIG.maxAttempts) {
            console.info(`[useStreamingChat] 检测到截断，自动续接 (尝试 ${continueAttempt + 1}/${AUTO_CONTINUE_CONFIG.maxAttempts})`);
            streamLogger.log('auto_continue_triggered', {
              attempt: continueAttempt + 1,
              maxAttempts: AUTO_CONTINUE_CONFIG.maxAttempts,
              reason: isLengthTruncated ? 'length' : 'incomplete_content',
              contentLength: content.length,
            });
            
            // 通知 UI 续接开始
            try { events?.onAutoContinue?.({ attempt: continueAttempt + 1, maxAttempts: AUTO_CONTINUE_CONFIG.maxAttempts, status: 'started' }); } catch (e) { console.error(e); }
            
            ws.close();

            // 构建续接消息：发接续指令 + 显式带上上一轮已输出内容。
            // 2026-07-29 Q-023 修复B：原假设"ZeroClaw 复用 session 会保留上一轮输出"被证伪——
            // daemon 续接时未必回放上文，导致 AI 看不到被截断的内容、从 Step1 重讲。
            // 现在把 accumulatedContent（已输出全文）显式拼进续接消息，AI 能看到断点
            // 从"词库 ="接着写。保留 sessionId 复用作双保险（daemon 若有记忆则更准）。
            // 2026-07-29 截断回归修正：slice(-2000) 只给末尾 2000 字，AI 看不到完整
            // HTML/CSS 结构，续接输出会重复或答非所问。扩大到 8000 字覆盖整个代码块。
            const prevOutput = content.trim();
            const continueMessage = prevOutput
              ? `请继续完成上一条回复，从被截断处接着输出，不要重复已输出的内容，保持格式一致，确保代码块和标签正确闭合。\n\n上一条已输出内容（请勿重复，从此内容结尾处接着写）：\n<previous_output>\n${prevOutput.slice(-8000)}\n</previous_output>`
              : '请继续完成上一条回复，从被截断处接着输出，不要重复已输出的内容，保持格式一致，确保代码块和标签正确闭合。';
            const continuePayload: StreamPayload = {
              ...payload,
              message: continueMessage,
              messages: undefined,
              sessionId, // 显式复用同一 session
            };

            // 递归调用进行续接
            try {
              const result = await _doStreamWithAutoContinue(
                continuePayload,
                onToken,
                events,
                token,
                agent,
                baseUrl,
                sessionId,
                continueAttempt + 1,
                content  // 传递累积的内容
              );
              // 通知 UI 续接完成
              try { events?.onAutoContinue?.({ attempt: continueAttempt + 1, maxAttempts: AUTO_CONTINUE_CONFIG.maxAttempts, status: 'completed' }); } catch (e) { console.error(e); }
              resolve(result);
              return;
            } catch (e) {
              console.error('[useStreamingChat] 自动续接失败:', e);
              // 通知 UI 续接失败
              try { events?.onAutoContinue?.({ attempt: continueAttempt + 1, maxAttempts: AUTO_CONTINUE_CONFIG.maxAttempts, status: 'failed' }); } catch (e) { console.error(e); }
              // 续接失败，返回当前内容（继续执行后续代码）
            }
          }

          // 2026-07-30 截断死循环根因修复：删除"检测到截断就在 content 追加[输出可能不完整]"逻辑。
          // 此前启发式 _detectIncompleteContent 频繁误判正常回复为截断 → 追加这句吓人提示 →
          // 用户看到"输出可能不完整"以为真截断了 → 点继续 → 死循环。现在 shouldSuggestContinue
          // 只在真正 token 上限截断（isTokenLimitHit）时为 true，且真正截断时由自动续接逻辑
          // 处理，不需要在正文里追加污染性文本。

          // 解析问题卡片——三条路径：
          // 1. ask_question tool_call 帧（主路径，在 tool_call 分支已处理，questionFired=true）
          // 2. <question> XML（旧格式兼容，parseQuestionBlocks）
          // 3. 精确选项列表兜底（extractChoiceListStrict）——仅在 1 和 2 都没命中时启用
          //    处理 Q-011：DeepSeek ~10-15% 轮次在文字里列选项但不调 ask_question。
          //    只提取"上方有选择意图标题+下方是短词选项"的列表，不误识别总结/状态汇报。
          // ⚠️ 防重复卡（Q-004）：done 帧到达时 tool_call 帧可能还没到（异步乱序）。
          //    如果 questionFired=false，延迟 500ms 再检查一次——给迟到的 tool_call 帧留窗口。
          //    500ms 后仍为 false 才走兜底。
          let hasRenderedQuestion = questionFired;
          if (!questionFired) {
            // 等 500ms 让可能迟到的 tool_call 帧到达
            await new Promise(resolve => setTimeout(resolve, 500));
            if (questionFired) {
              console.info('[useStreamingChat][done] 延迟 500ms 后检测到 questionFired=true（tool_call 迟到），跳过兜底');
              hasRenderedQuestion = true;
            }
          }
          if (!hasRenderedQuestion) {
            try {
              let questions = parseQuestionBlocks(content);
              let fromTextFallback = false;
              console.info('[useStreamingChat][done] parseQuestionBlocks(XML) 解析出', questions.length, '张卡片');
              // XML 没命中时，尝试精确选项列表兜底（Q-011）
              if (questions.length === 0) {
                questions = extractChoiceListStrict(content);
                if (questions.length > 0) {
                  fromTextFallback = true;
                  console.info('[useStreamingChat][done] extractChoiceListStrict(精确兜底) 解析出', questions.length, '张卡片');
                }
              }
              if (questions.length > 0) {
                // Q-003 修复：文本兜底路径需后端二次确认，拦截功能介绍等误识别。
                // XML 路径结构化可信，不确认；ask_question 工具路径已在上方 questionFired 处理。
                let finalQuestions = questions;
                if (fromTextFallback) {
                  finalQuestions = await confirmQuestions(questions);
                  console.info('[useStreamingChat][done] 后端二次确认后保留', finalQuestions.length, '/', questions.length, '张卡片');
                }
                if (finalQuestions.length > 0) {
                  hasRenderedQuestion = true;
                  if (events?.onQuestions) {
                    events.onQuestions(finalQuestions);
                  } else if (events?.onQuestion) {
                    events.onQuestion(finalQuestions[0]);
                  }
                }
              }
            } catch (e) {
              console.error('[useStreamingChat] parseQuestionBlocks failed', e);
            }
          } else {
            console.info('[useStreamingChat][done] ask_question 已通过工具路径渲染，跳过文本解析');
          }
          // 剥离 XML 块 → 用户看到的内容
          const { clean } = stripQuestionXml(content);
          streamLogger.logContentUpdate(clean, 'stripQuestionXml', {
            rawAssistantContentLength: content.length,
            assistantContentLength: clean.length,
          });
          if (clean !== content) {
            content = clean;
            try { events?.onContentUpdate?.(clean); } catch (e) { console.error(e); }
          }
          // 兜底从文本里提取代码（当 LLM 未走 project_code_writer 但产出代码块时）
          // 门禁：调用方可通过 shouldExtractCode 回调禁用文本兜底提取。
          // 典型场景：选题/规划阶段 AI 举例的代码块不应被写入编辑器（前端 isCodeExtractionAllowed 判定）。
          // 注意：project_code_writer 工具事件路径（codeEventFired=true）不受此门禁影响。
          const extractionAllowed = events?.shouldExtractCode ? events.shouldExtractCode() : true;
          if (!codeEventFired && extractionAllowed) {
            const codeEvent = extractCodeEvent(content, payload.projectId);
            if (codeEvent && events?.onCodeGenerated) {
              try { events.onCodeGenerated(codeEvent); } catch (e) { console.error(e); }
            }
          } else if (!codeEventFired && !extractionAllowed) {
            console.info('[useStreamingChat] shouldExtractCode=false，跳过 done 帧文本代码兜底提取');
          }
          try { events?.onEnd?.(content); } catch (e) { console.error('[useStreamingChat] onEnd failed', e); }

          // 记录结束事件并导出日志
          streamLogger.logEnd(content, {
            rawAssistantContentLength: fullContent.length,
            assistantContentLength: content.length,
            continueAttempts: continueAttempt,
          });

          ws.close();
          resolve({ content, sessionId });
          return;
        }

        if (type === 'aborted') {
          deliberateSettle = true;
          clearTimeout(totalTimeout);
          clearIdleTimer();  // Q-023 修复A
          ws.close();
          reject(new Error('AI 响应被中断'));
          return;
        }

        if (type === 'error') {
          deliberateSettle = true;
          clearTimeout(totalTimeout);
          clearIdleTimer();  // Q-023 修复 A
          const errMsg = typeof data.message === 'string' ? data.message : 'ZeroClaw 错误';
          streamLogger.logError(errMsg, 'websocket_error');
          ws.close();
          // 2026-07-30 截断治理：daemon 的 "Invalid JSON: unexpected end of hex escape" 类错误
          // 是工具调用 JSON 参数被 token 上限切在 unicode 转义中间后，daemon 解析失败报的错
          // （与截断同源，闭源不可修）。此前这里无条件 reject → catch 把整条消息替换成
          // “请求失败：Invalid JSON...”，已生成的内容全丢。
          // 现在：只要本轮已有内容，就保留内容并 resolve({stalled:true})，让上层显示
          // “继续生成”按钮，用户可接着写；只有完全没内容时才 reject 报错。
          if (fullContent.trim().length > 0) {
            console.warn('[useStreamingChat] daemon error 帧但已有内容，保留内容走续接路径:', errMsg, {
              contentLength: fullContent.length,
            });
            resolve({ content: fullContent, sessionId, stalled: true });
          } else if (
            /invalid json|unexpected end/i.test(errMsg) &&
            AUTO_CONTINUE_CONFIG.enableAutoContinue &&
            continueAttempt < AUTO_CONTINUE_CONFIG.maxAttempts
          ) {
            // 2026-07-30 截断治理二期：无内容时的 Invalid JSON——AI 本轮第一步就发了超长
            // 工具调用（如 project_code_writer 带整段代码），JSON 参数被 token 上限切在
            // 转义符中间，daemon 解析失败。此前直接 reject → 气泡只剩"请求失败"，用户手动
            // 发"继续"后 AI 原样重发超长调用，再次撞墙（项目 8a7c155e 实测：连续 3 条
            // Invalid JSON 气泡）。现在同一 session 自动重试，并在重试消息里运行时纠偏
            // （复述 ≤300 行分块规则），让 AI 改用分块写入而不是原样重发。
            console.warn(`[useStreamingChat] Invalid JSON 且无内容，自动重试并纠偏 (${continueAttempt + 1}/${AUTO_CONTINUE_CONFIG.maxAttempts}):`, errMsg);
            streamLogger.log('invalid_json_auto_retry', { attempt: continueAttempt + 1, errMsg });
            try { events?.onAutoContinue?.({ attempt: continueAttempt + 1, maxAttempts: AUTO_CONTINUE_CONFIG.maxAttempts, status: 'started' }); } catch (e) { console.error(e); }
            const retryPayload: StreamPayload = {
              ...payload,
              message: '刚才你的工具调用参数太长，被输出上限截断，系统报了 Invalid JSON 错误，那次调用没有生效。请重新执行刚才的操作，并严格遵守：project_code_writer 单次 code 参数不超过 300 行；更长的代码拆成多块——第一块 mode="replace"，后续每块 mode="append"（同一 filename），在完整语句边界处断开。现在先写第一块。',
              messages: undefined,
              sessionId,
            };
            _doStreamWithAutoContinue(retryPayload, onToken, events, token, agent, baseUrl, sessionId, continueAttempt + 1, accumulatedContent)
              .then((result) => {
                try { events?.onAutoContinue?.({ attempt: continueAttempt + 1, maxAttempts: AUTO_CONTINUE_CONFIG.maxAttempts, status: 'completed' }); } catch (e) { console.error(e); }
                resolve(result);
              })
              .catch((retryErr) => {
                try { events?.onAutoContinue?.({ attempt: continueAttempt + 1, maxAttempts: AUTO_CONTINUE_CONFIG.maxAttempts, status: 'failed' }); } catch (e) { console.error(e); }
                reject(retryErr instanceof Error ? retryErr : new Error(errMsg));
              });
          } else {
            reject(new Error(errMsg));
          }
          return;
        }

        if (type === 'approval_request') {
          // 开发环境下默认 approve，避免阻塞；生产建议弹出审批 UI
          console.warn('[useStreamingChat] tool approval requested, auto-approve (dev):', data);
          try {
            ws.send(JSON.stringify({
              type: 'approval_response',
              request_id: data.request_id,
              decision: 'approve',
            }));
          } catch (e) {
            console.error(e);
          }
          return;
        }
      };

      ws.onclose = () => {
        clearTimeout(totalTimeout);
        clearTimeout(handshakeTimeout);
        clearIdleTimer();  // Q-023 修复A
        // 2026-07-31 Q-038 死锁修复：WS 意外关闭（daemon 重启/网络闪断）时必须
        // settle promise，否则 Create.tsx 的 finally 永不执行、isLoading 永久 true。
        // deliberateSettle=true 表示业务分支（done/error/续接/中止/超时）已经或
        // 即将 settle，这里不接管；否则就是意外关闭，有内容保内容，无内容报友好错。
        if (!settled && !deliberateSettle) {
          streamLogger.log('ws_unexpected_close', { contentLength: fullContent.length, connectedOk });
          if (fullContent.trim().length > 0) {
            console.warn('[useStreamingChat] WS 意外关闭，保留已收到的内容走续接路径');
            resolve({ content: fullContent, sessionId, stalled: true });
          } else {
            const err = new Error('与 AI 服务的连接意外断开，请重试') as Error & { isDaemonDown?: boolean };
            err.isDaemonDown = !connectedOk;
            reject(err);
          }
        }
      };

      ws.onerror = () => {
        clearTimeout(totalTimeout);
        clearTimeout(handshakeTimeout);
        clearIdleTimer();  // Q-023 修复A
        reject(new Error('ZeroClaw WebSocket 错误'));
      };
    });
  }