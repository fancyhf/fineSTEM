import { FormEvent, useEffect, useState } from 'react';
import { assistantDialoguesApi } from '../services/api';
import { AssistantDialogueMessage, AssistantDialogueSession } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useStreamingChat } from '../hooks/useStreamingChat';
import { MarkdownText } from '../components/MarkdownText';

export default function AIAssistantDialogues() {
  const { user } = useAuth();
  const { stream } = useStreamingChat();
  const [sessions, setSessions] = useState<AssistantDialogueSession[]>([]);
  const [currentSession, setCurrentSession] = useState<AssistantDialogueSession | null>(null);
  const [messages, setMessages] = useState<AssistantDialogueMessage[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const loadSessions = async () => {
    const res = await assistantDialoguesApi.listSessions();
    setSessions(res.data ?? []);
  };

  const loadMessages = async (sessionId: string) => {
    const res = await assistantDialoguesApi.listMessages(sessionId);
    setMessages(res.data ?? []);
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const createSession = async () => {
    const res = await assistantDialoguesApi.createSession('新会话');
    if (res.data) {
      setCurrentSession(res.data);
      await loadSessions();
      await loadMessages(res.data.id);
    }
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user || sending) return;
    setSending(true);
    const outgoing = message;
    const sessionId = currentSession?.id;
    const tempSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempUserId = `temp-user-${tempSeed}`;
    const tempAssistantId = `temp-assistant-${tempSeed}`;
    setMessages((prev) => [
      ...prev,
      { id: tempUserId, session_id: sessionId || '', role: 'user', content: outgoing, created_at: new Date().toISOString() },
      { id: tempAssistantId, session_id: sessionId || '', role: 'assistant', content: '', created_at: new Date().toISOString() },
    ]);
    setMessage('');
    try {
      const result = await stream(
        {
          message: outgoing,
          sessionId: sessionId,
          context: { page: 'assistant_dialogues' },
        },
        (token) => {
          setMessages((prev) =>
            prev.map((item) =>
              item.id === tempAssistantId
                ? { ...item, content: item.content + token }
                : item,
            ),
          );
        },
      );
      setMessages((prev) => prev.filter((item) => !item.id.startsWith('temp-')));
      void loadSessions();
      const resolvedSessionId = result.sessionId || sessionId;
      if (resolvedSessionId) {
        void loadMessages(resolvedSessionId);
      }
    } catch {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === tempAssistantId ? { ...item, content: '请求失败，请稍后重试' } : item,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-1 bg-white border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">会话</h2>
          <button className="text-sm bg-teal-600 text-white rounded px-3 py-1" onClick={createSession}>新建</button>
        </div>
        {sessions.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setCurrentSession(item);
              void loadMessages(item.id);
            }}
            className="w-full text-left border rounded p-2 hover:bg-gray-50"
          >
            <div className="font-medium text-sm">{item.title}</div>
            <div className="text-xs text-gray-500">{new Date(item.updated_at).toLocaleString('zh-CN')}</div>
          </button>
        ))}
      </div>
      <div className="md:col-span-2 bg-white border rounded-lg p-4 flex flex-col min-h-[520px]">
        <h1 className="text-xl font-semibold mb-3">AI助手对话</h1>
        <div className="flex-1 overflow-y-auto space-y-2">
          {messages.map((item) => (
            <div key={item.id} className={`rounded p-2 ${item.role === 'assistant' ? 'bg-teal-50' : 'bg-gray-100'}`}>
              <div className="text-xs text-gray-500">{item.role === 'user' ? '你' : 'AI 助手'}</div>
              <div className="text-sm">
                {item.role === 'assistant' ? (
                  <MarkdownText content={item.content} />
                ) : (
                  <span className="whitespace-pre-wrap">{item.content}</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="pt-3 border-t mt-3 flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2"
            placeholder="输入消息..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
          <button className="bg-teal-600 text-white rounded px-4" disabled={sending}>{sending ? '发送中...' : '发送'}</button>
        </form>
      </div>
    </div>
  );
}
