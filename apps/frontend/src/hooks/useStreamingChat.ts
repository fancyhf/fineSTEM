import { useCallback } from 'react';
import { authStorage } from '../services/api';
import { QuestionData } from '../components/QuestionCard';

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
  onCodeGenerated?: (data: CodeGeneratedEvent) => void;
  onCodeGenerationFailed?: (data: CodeGenerationFailedEvent) => void;
  onContentUpdate?: (content: string) => void;
  onEnd?: (content: string) => void;
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

function parseQuestionBlock(text: string): QuestionData | null {
  if (!text) return null;

  const match = text.match(/<question[^>]*>([\s\S]*?)<\/question>/i);
  if (!match) return null;
  const raw = match[1].trim();
  if (!raw) return null;

  const tagAttrMatch = text.match(/<question[^>]*title=["']([^"']*)["']/i);
  const titleMatch = raw.match(/<title>([\s\S]*?)<\/title>/i);
  let title = '请选择';
  if (titleMatch) {
    title = titleMatch[1].trim();
  } else if (tagAttrMatch) {
    title = tagAttrMatch[1].trim();
  } else if (!/<option\s/.test(raw.split('\n')[0])) {
    title = raw.split('\n')[0].slice(0, 200);
  }

  const options: QuestionData['options'] = [];
  const optPattern = /<option\s+id=["']([^"']*)["'](?:[^>]*?label=["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/option>/gi;
  let om: RegExpExecArray | null;
  while ((om = optPattern.exec(raw)) !== null) {
    const optId = om[1].trim();
    const attrLabel = om[2] ? om[2].trim() : null;
    const optBody = om[3].trim();

    const childLabelMatch = optBody.match(/<label>([\s\S]*?)<\/label>/i);
    const descMatch = optBody.match(/<desc>([\s\S]*?)<\/desc>/i);

    let finalLabel = attrLabel;
    if (!finalLabel) {
      if (childLabelMatch) {
        finalLabel = childLabelMatch[1].trim();
      } else {
        const cleanBody = optBody.replace(/<\/?(?:label|desc)[^>]*>/g, '').trim();
        finalLabel = cleanBody.split('\n')[0].slice(0, 100);
      }
    }

    options.push({
      id: optId || `opt-${options.length}`,
      label: finalLabel,
      description: descMatch ? descMatch[1].trim() : undefined,
      recommended: /推荐/.test(optBody) || /recommended/i.test(optBody),
    });
  }

  if (options.length === 0) return null;

  const rawMatch = text.match(/<question[^>]*>[\s\S]*?<\/question>/i);
  const source = rawMatch ? rawMatch[0] : raw;
  const multiple = /multiple/i.test(source) || /多选/.test(source);
  const stepM = source.match(/\bstep\b\s*(?:=|:)\s*["']?(\d+)/i);
  const totalM = source.match(/\b(?:total_steps|totalSteps|total)\b\s*(?:=|:)\s*["']?(\d+)/i);

  const questionData: QuestionData = {
    id: `q-${Date.now()}`,
    title,
    options: options.slice(0, 8),
    multiple,
    allowCustom: true,
    step: stepM ? parseInt(stepM[1], 10) : undefined,
    totalSteps: totalM ? parseInt(totalM[1], 10) : undefined,
  };

  // 过滤掉无意义的通用问句
  const genericTitles = new Set([
    '请选择',
    '接下来你想怎么做？',
    '接下来你想怎么做',
    '你想怎么继续？',
    '你想怎么继续',
  ]);
  const genericOptionLabels = new Set(['继续', '详细说说', '换个方向', '了解更多', '其他']);
  const optLabels = new Set(
    options.map((o) => (o.label || '').trim()).filter(Boolean),
  );
  if (genericTitles.has(title.trim())) return null;
  if (optLabels.size > 0 && [...optLabels].every((l) => genericOptionLabels.has(l))) return null;

  return questionData;
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
          ws.send(JSON.stringify({
            type: 'connect',
            session_id: sessionId,
            device_name: 'finestem-web',
            capabilities: ['tool_calls', 'streaming'],
            cwd: payload.projectId ? `finestem://${payload.projectId}` : undefined,
          }));
          return;
        }

        if (type === 'connected') {
          connectedOk = true;
          clearTimeout(handshakeTimeout);
          // 握手完成，发出第一条用户消息
          const outgoing = buildMessageWithSkillHint(payload.message, payload.skillId);
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
          // 解析 XML question → onQuestion
          try {
            const q = parseQuestionBlock(content);
            if (q && events?.onQuestion) events.onQuestion(q);
          } catch (e) {
            console.error('[useStreamingChat] parseQuestionBlock failed', e);
          }
          // 剥离 XML 块 → 用户看到的内容
          const { clean } = stripQuestionXml(content);
          if (clean !== content) {
            content = clean;
            try { events?.onContentUpdate?.(clean); } catch (e) { console.error(e); }
          }
          // 兜底从文本里提取代码（当 LLM 未走 project_code_writer 但产出代码块时）
          if (!codeEventFired) {
            const codeEvent = extractCodeEvent(content, payload.projectId);
            if (codeEvent && events?.onCodeGenerated) {
              try { events.onCodeGenerated(codeEvent); } catch (e) { console.error(e); }
            }
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