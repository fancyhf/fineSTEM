import { useCallback } from 'react';
import { authStorage } from '../services/api';
import { QuestionData } from '../components/QuestionCard';
import { parseQuestionBlock, parseQuestionBlocks } from '../lib/questionParser';

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
  onToolCall?: (data: { tool_name: string; success: boolean; data?: unknown }) => void;
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
   * 代码提取门禁：返回 false 时，本 hook 不再从 LLM 文本兜底提取代码块（done 帧的 extractCodeEvent）。
   * 调用方（Create.tsx）用它实现 PBL 阶段门禁——选题/规划阶段不允许把 AI 举例的代码块写入编辑器。
   * 注意：只影响"从文本兜底提取"这条路径；project_code_writer 工具事件（onCodeGenerated 直发）
   * 不受此门禁影响，因为那是 AI 显式调用工具写代码，属于主动行为。
   * 默认（未传）视为允许，保持向后兼容。
   */
  shouldExtractCode?: () => boolean;
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
 * 构造发给 ZeroClaw 的最终消息文本，注入项目上下文。
 *
 * 背景（2026-07-19 修复）：此前项目上下文靠 connect 帧的 cwd 字段
 * `finestem://${projectId}` 传递，但 ZeroClaw 0.8.3 把 cwd 当真实磁盘路径校验，
 * Windows 拒绝（os error 123）。删掉 cwd 后 AI 失去了项目感知。
 *
 * 现在改为在每条用户消息前注入结构化上下文块，AI 读到即知当前项目。
 * 上下文用明确分隔符包裹，避免污染用户原意。
 */
function buildOutgoingMessage(
  message: string,
  skillId: string | undefined,
  context: Record<string, unknown> | undefined,
): string {
  const parts: string[] = [];

  // 项目上下文（关键：让 AI 知道当前在哪个项目）
  if (context && (context.project_id || context.project_name)) {
    const ctxLines: string[] = [];
    if (context.project_id) ctxLines.push(`project_id: ${context.project_id}`);
    if (context.project_name) ctxLines.push(`project_name: ${context.project_name}`);
    if (context.current_stage) ctxLines.push(`current_stage: ${context.current_stage}`);
    if (context.teaching_mode) ctxLines.push(`teaching_mode: ${context.teaching_mode}`);
    parts.push(`<context>\n${ctxLines.join('\n')}\n</context>`);
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

function getZcAgentAlias(): string {
  return (import.meta.env.VITE_ZC_AGENT as string | undefined) || 'assistant';
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
export function useStreamingChat() {
  const stream = useCallback(async (
    payload: StreamPayload,
    onToken: (token: string) => void,
    events?: StreamEvents,
  ): Promise<StreamResult> => {
    const token = getZeroClawBearerToken();
    const agent = getZcAgentAlias();
    const baseUrl = getZeroClawWsBaseUrl();
    const sessionId = payload.sessionId || `finestem-${Date.now()}`;
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
        reject(new Error('WebSocket 连接失败 — 检查 ZeroClaw daemon 是否运行在 127.0.0.1:42617'));
      };
    });

    return await new Promise<StreamResult>((resolve, reject) => {
      let fullContent = '';
      let connectedOk = false;
      let codeEventFired = false;
      let receivedSessionStart = false;

      const totalTimeout = setTimeout(() => {
        ws.close();
        reject(new Error('AI 响应超时，请稍后重试'));
      }, 120000);

      const handshakeTimeout = setTimeout(() => {
        if (!connectedOk) {
          ws.close();
          reject(new Error('ZeroClaw 握手失败：等不到 connected 帧'));
        }
      }, 8000);

      ws.onmessage = async (event) => {
        let data: Record<string, any>;
        try {
          data = JSON.parse(event.data as string);
        } catch {
          return;
        }

        const type = data.type as string | undefined;

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
          // 通过 buildOutgoingMessage 把项目上下文注入消息文本（替代被删的 cwd 字段）
          const outgoing = buildOutgoingMessage(payload.message, payload.skillId, payload.context);
          ws.send(JSON.stringify({
            type: 'message',
            content: outgoing,
          }));
          return;
        }

        // 业务事件
        if (type === 'chunk' && typeof data.content === 'string') {
          fullContent += data.content;
          onToken(data.content);
          return;
        }

        if (type === 'thinking' && typeof data.content === 'string') {
          // 推理过程暂作为流式 token 输出，可后续改为可折叠展示
          return;
        }

        if (type === 'tool_call') {
          try {
            events?.onToolCall?.({
              tool_name: data.name as string,
              success: true,
              data: data.args,
            });
          } catch (e) {
            console.error('[useStreamingChat] onToolCall failed', e);
          }
          return;
        }

        if (type === 'tool_result') {
          try {
            const success = !/error|failed/i.test(String(data.output || ''));
            events?.onToolCall?.({
              tool_name: data.name as string,
              success,
              data: data.output,
            });
            // 命名为 project_creator / project_code_writer 的工具产出对应 PBL 事件
            if (data.name === 'project_creator' && success && data.output) {
              const out = data.output as Record<string, any>;
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
            if (data.name === 'project_code_writer' && success && data.output) {
              const out = data.output as Record<string, any>;
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
            if (data.name === 'stage_advancer' && success && data.output) {
              const out = data.output as Record<string, any>;
              const stage = out.new_stage || out.current_stage || '';
              if (stage) {
                events?.onStageChanged?.({ stage, stage_name: stage });
              }
            }
          } catch (e) {
            console.error('[useStreamingChat] onToolCall result mapping failed', e);
          }
          return;
        }

        if (type === 'done') {
          clearTimeout(totalTimeout);
          let content = typeof data.full_response === 'string' ? data.full_response : fullContent;
          // === 诊断日志（2026-07-19）：帮助定位"AI 没输出 XML 时为什么没卡片"===
          console.info('[useStreamingChat][done] AI 原始回复长度:', content?.length || 0);
          console.info('[useStreamingChat][done] AI 原始回复全文:', content);
          console.info('[useStreamingChat][done] 是否含 <question> 标签:', /<question/i.test(content || ''));
          // 解析 <question> XML → 优先用多卡回调 onQuestions，同时兼容单卡 onQuestion
          try {
            const questions = parseQuestionBlocks(content);
            console.info('[useStreamingChat][done] parseQuestionBlocks 解析出', questions.length, '张卡片');
            if (questions.length > 0) {
              if (events?.onQuestions) {
                events.onQuestions(questions);
              } else if (events?.onQuestion) {
                // 向后兼容：没注册 onQuestions 时，只传第一个
                events.onQuestion(questions[0]);
              }
            }
          } catch (e) {
            console.error('[useStreamingChat] parseQuestionBlocks failed', e);
          }
          // 剥离 XML 块 → 用户看到的内容
          const { clean } = stripQuestionXml(content);
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
          ws.close();
          resolve({ content, sessionId });
          return;
        }

        if (type === 'aborted') {
          clearTimeout(totalTimeout);
          ws.close();
          reject(new Error('AI 响应被中断'));
          return;
        }

        if (type === 'error') {
          clearTimeout(totalTimeout);
          ws.close();
          reject(new Error(typeof data.message === 'string' ? data.message : 'ZeroClaw 错误'));
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
      };

      ws.onerror = () => {
        clearTimeout(totalTimeout);
        clearTimeout(handshakeTimeout);
        reject(new Error('ZeroClaw WebSocket 错误'));
      };
    });
  }, []);

  return { stream };
}