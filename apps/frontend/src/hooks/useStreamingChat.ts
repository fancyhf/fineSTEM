import { useCallback } from 'react';
import { authStorage } from '../services/api';

interface StreamPayload {
  message: string;
  sessionId?: string;
  projectId?: string;
  context?: Record<string, unknown>;
}

interface StreamResult {
  content: string;
  sessionId?: string;
}

function getAnonymousId(): string {
  const key = 'anonymous_chat_id';
  const cached = localStorage.getItem(key);
  if (cached) return cached;
  const generated = `anon-${Date.now()}`;
  localStorage.setItem(key, generated);
  return generated;
}

export function useStreamingChat() {
  const stream = useCallback(async (
    payload: StreamPayload,
    onToken: (token: string) => void,
  ): Promise<StreamResult> => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = authStorage.getToken();
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/agent/ws${tokenQuery}`);
    const user = authStorage.getUser();
    const userId = user?.id || getAnonymousId();

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('WebSocket 连接失败'));
    });

    return await new Promise<StreamResult>((resolve, reject) => {
      let finalContent = '';
      let finalSessionId: string | undefined = payload.sessionId;
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data) as {
          event: string;
          message?: string;
          data?: { token?: string; content?: string; session_id?: string };
        };
        if (data.event === 'token' && data.data?.token) {
          finalContent += data.data.token;
          onToken(data.data.token);
        }
        if (data.event === 'final') {
          finalContent = data.data?.content || finalContent;
          finalSessionId = data.data?.session_id || finalSessionId;
          ws.close();
          resolve({ content: finalContent, sessionId: finalSessionId });
        }
        if (data.event === 'error') {
          ws.close();
          reject(new Error(data.message || '流式对话失败'));
        }
      };
      ws.send(JSON.stringify({
        user_id: userId,
        message: payload.message,
        session_id: payload.sessionId,
        project_id: payload.projectId,
        context: payload.context || {},
        enable_tools: true,
      }));
    });
  }, []);

  return { stream };
}
