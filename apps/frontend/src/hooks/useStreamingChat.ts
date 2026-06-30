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

function getWsBaseUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const viteApiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (viteApiUrl) {
    const httpUrl = viteApiUrl.startsWith('http')
      ? viteApiUrl
      : `${window.location.protocol}//${viteApiUrl}`;
    const url = new URL(httpUrl);
    return `${protocol}//${url.host}`;
  }
  return `${protocol}//${window.location.host}`;
}

function buildMessageWithSkillHint(message: string, skillId?: string): string {
  if (!skillId) {
    return message;
  }
  return `[[skill:${skillId}]] ${message}`;
}

export function useStreamingChat() {
  const stream = useCallback(async (
    payload: StreamPayload,
    onToken: (token: string) => void,
    events?: StreamEvents,
  ): Promise<StreamResult> => {
    const token = authStorage.getToken();
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    const wsUrl = `${getWsBaseUrl()}/api/v1/agent/ws${tokenQuery}`;
    const ws = new WebSocket(wsUrl);
    const user = authStorage.getUser();
    const userId = user?.id || getAnonymousId();
    const outgoingMessage = buildMessageWithSkillHint(payload.message, payload.skillId);

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
        reject(new Error('WebSocket 连接失败'));
      };
    });

    return await new Promise<StreamResult>((resolve, reject) => {
      let finalContent = '';
      let finalSessionId: string | undefined = payload.sessionId;
      let hasReceivedMessage = false;

      const timeout = setTimeout(() => {
        if (!hasReceivedMessage) {
          ws.close();
          reject(new Error('AI 响应超时，请稍后重试'));
        }
      }, 60000);

      ws.onmessage = (event) => {
        hasReceivedMessage = true;
        try {
          const data = JSON.parse(event.data) as {
            event: string;
            message?: string;
            data?: Record<string, unknown>;
          };

          if (data.event === 'token' && data.data?.token) {
            finalContent += data.data.token as string;
            onToken(data.data.token as string);
          }

          if (data.event === 'skill_activated' && events?.onSkillActivated) {
            events.onSkillActivated(data.data as { skill_id: string; skill_name: string; sub_skill_id?: string; sub_skill_name?: string });
          }

          if (data.event === 'project_created' && events?.onProjectCreated) {
            events.onProjectCreated(data.data as { project_id: string; project_name: string; current_stage?: string });
          }

          if (data.event === 'tool_call' && events?.onToolCall) {
            events.onToolCall(data.data as { tool_name: string; success: boolean; data?: unknown });
          }

          if (data.event === 'stage_changed' && events?.onStageChanged) {
            events.onStageChanged(data.data as { stage: string; stage_name: string });
          }

          if (data.event === 'question' && events?.onQuestion && data.data) {
            const qData = data.data as Record<string, unknown>;
            events.onQuestion({
              id: qData.id as string || `q-${Date.now()}`,
              title: qData.title as string || '',
              subtitle: qData.subtitle as string | undefined,
              options: (qData.options as QuestionData['options']) || [],
              optionGroups: qData.optionGroups as QuestionData['optionGroups'] | undefined,
              requireEachGroup: qData.requireEachGroup as boolean | undefined,
              multiple: qData.multiple as boolean | undefined,
              allowCustom: qData.allow_custom as boolean | undefined,
              step: qData.step as number | undefined,
              totalSteps: qData.total_steps as number | undefined,
              stage: qData.stage as string | undefined,
              isStageFinal: qData.is_stage_final === true,
            });
          }

          if (data.event === 'code_generated' && events?.onCodeGenerated && data.data) {
            events.onCodeGenerated(data.data as unknown as CodeGeneratedEvent);
          }

          if (data.event === 'code_generation_failed' && events?.onCodeGenerationFailed && data.data) {
            events.onCodeGenerationFailed(data.data as unknown as CodeGenerationFailedEvent);
          }

          if (data.event === 'content_update' && events?.onContentUpdate && data.data?.content) {
            finalContent = data.data.content as string;
            events.onContentUpdate(finalContent);
          }

          if (data.event === 'final') {
            clearTimeout(timeout);
            finalContent = (data.data?.content as string) || finalContent;
            finalSessionId = (data.data?.session_id as string) || finalSessionId;
            ws.close();
            try {
              events?.onEnd?.(finalContent);
            } catch (e) {
              console.error('[useStreamingChat] onEnd 回调执行失败', e);
            }
            resolve({ content: finalContent, sessionId: finalSessionId });
          }

          if (data.event === 'error') {
            clearTimeout(timeout);
            ws.close();
            reject(new Error(data.message || '流式对话失败'));
          }
        } catch (error) {
          clearTimeout(timeout);
          ws.close();
          reject(new Error('解析 AI 响应失败'));
        }
      };

      ws.onclose = () => {
        clearTimeout(timeout);
      };

      ws.send(JSON.stringify({
        user_id: userId,
        message: outgoingMessage,
        messages: payload.messages || [],
        session_id: payload.sessionId,
        project_id: payload.projectId,
        context: payload.context || {},
        enable_tools: true,
        skill_id: payload.skillId,
      }));
    });
  }, []);

  return { stream };
}
