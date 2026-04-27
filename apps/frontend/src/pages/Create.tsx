import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Code, Rocket, FileText, ChevronUp, Paperclip, Link2, FolderOpen, Plus, Sparkles, User, Settings, Zap } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useStreamingChat } from '../hooks/useStreamingChat';
import { MarkdownText } from '../components/MarkdownText';
import { LightRegisterPrompt } from '../components/LightRegisterPrompt';
import { useAuth } from '../contexts/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SCENE_ENTRIES = [
  { icon: MessageSquare, label: '问问题', desc: 'STEM 相关问题咨询' },
  { icon: Code, label: '解释代码', desc: '代码分析与讲解' },
  { icon: Rocket, label: '开始项目', desc: '从 Demo Fork 或新建' },
  { icon: FileText, label: '写报告', desc: '论文与成果文档撰写' },
];

const CODEX_SUGGESTIONS = [
  '帮我用 Python 写一个简单的计算器程序',
  '分析这段代码的时间复杂度，并给出优化建议',
  '帮我规划一个 AI 图像识别项目的完整方案',
];

export function Create() {
  const { stream } = useStreamingChat();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeScene, setActiveScene] = useState<string | null>(null);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageSeqRef = useRef(0);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [inputValue]);

  const nextMessageId = () => {
    messageSeqRef.current += 1;
    return String(messageSeqRef.current);
  };

  const handleSend = async (text?: string, sceneOverride?: string) => {
    const message = (text || inputValue).trim();
    if (!message || isLoading) return;
    if (!user) {
      const used = Number(localStorage.getItem('anonymous_chat_count') || '0');
      if (used >= 5) {
        setShowRegisterPrompt(true);
        return;
      }
    }

    const userMsg: Message = { id: nextMessageId(), role: 'user', content: message };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setShowChatHistory(true);
    setIsLoading(true);
    setMessages((prev) => [...prev, { id: nextMessageId(), role: 'assistant', content: '' }]);

    try {
      await stream({
        message,
        context: {
          page: 'create',
          scene: sceneOverride || activeScene,
          authenticated: !!user,
        },
      }, (token) => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === 'assistant') {
            last.content += token;
          }
          return copy;
        });
      });
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
        if (last && last.role === 'assistant') {
          last.content = `请求失败：${errMsg}`;
        }
        return copy;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSceneClick = (label: string) => {
    setActiveScene(label);
    const prompts: Record<string, string> = {
      '问问题': '我想问一个 STEM 相关的问题',
      '解释代码': '帮我分析一段代码的问题',
      '开始项目': '我想从头开始一个新的 STEM 项目',
      '写报告': '我需要帮助撰写一份研究报告或论文',
    };
    handleSend(prompts[label] || `切换到${label}模式`, label);
  };

  return (
    <div className="h-[calc(100vh-88px)] flex gap-4">
      <div className="w-56 flex-shrink-0 space-y-3">
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm">场景</h3>
              <button className="p-1 hover:bg-gray-100 rounded text-gray-400 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-1.5 space-y-0.5">
            {SCENE_ENTRIES.map((entry) => (
              <button
                key={entry.label}
                onClick={() => handleSceneClick(entry.label)}
                className={`w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors group ${
                  activeScene === entry.label
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <entry.icon className={`w-4 h-4 mr-2.5 ${activeScene === entry.label ? 'text-teal-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{entry.label}</div>
                  <div className="text-xs text-gray-400 truncate">{entry.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-800 text-sm">项目</h3>
          </div>
          <div className="p-3">
            <button className="w-full flex items-center justify-center px-3 py-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:text-teal-600 hover:border-teal-300 transition-colors group">
              <Plus className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">新建项目</span>
            </button>
          </div>
          <div className="px-3 pb-3">
            <div className="text-xs text-gray-400 mb-2">最近</div>
            <div className="space-y-0.5">
              {['Python 计算器', 'AI 诗词生成器'].map((name) => (
                <Link to="/research" key={name} className="block px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-50 rounded truncate">
                  {name}
                </Link>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <Card className="flex-1 flex flex-col p-0 overflow-hidden border-gray-200 shadow-sm">
          {showChatHistory ? (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-3 bg-white">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-teal-600 text-white rounded-br-sm'
                        : 'bg-gray-50 text-gray-800 rounded-bl-sm border border-gray-100'
                    }`}>
                      <div className={`flex items-center gap-1.5 mb-1 text-xs ${
                        msg.role === 'user' ? 'text-teal-200' : 'text-gray-400'
                      }`}>
                        {msg.role === 'user' ? <User className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                        <span>{msg.role === 'user' ? '你' : 'fineSTEM 助手'}</span>
                      </div>
                      <MarkdownText content={msg.content} />
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
                <div ref={messagesEndRef} />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-white to-gray-50">
              <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-teal-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">fineSTEM Codex</h2>
              <p className="text-sm text-gray-500 mb-6 max-w-md text-center">AI 驱动的编程助手，帮助你快速构建 STEM 项目</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {CODEX_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(suggestion)}
                    disabled={isLoading}
                    className="text-left text-sm text-gray-500 hover:text-gray-700 hover:bg-white hover:shadow-sm px-3 py-2 rounded-lg transition-colors leading-relaxed line-clamp-2 border border-transparent"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 pt-3 pb-4">
            <div className="relative border border-gray-200 rounded-xl bg-white focus-within:border-teal-400 focus-within:ring-1 focus-within:ring-teal-100 transition-all">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={
                  isLoading
                    ? 'AI 正在思考...'
                    : showChatHistory
                    ? '继续对话...'
                    : '描述你想要实现的功能，例如："用 Python 写一个支持加减乘除的计算器..."'
                }
                disabled={isLoading}
                className="w-full resize-none border-0 bg-transparent px-4 py-3 text-sm outline-none placeholder-gray-400 max-h-48"
              />

              <div className="flex items-center justify-between px-2 py-1.5">
                <div className="flex items-center gap-0.5">
                  <button className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-gray-100 rounded-lg text-gray-500 text-xs font-medium transition-colors">
                    <FileText className="w-3.5 h-3.5" />
                    选择文件
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
                    <Link2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-gray-400">fineSTEM Codex</span>
                  <button
                    onClick={() => handleSend()}
                    disabled={!inputValue.trim() && !showChatHistory}
                    className="p-1.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 text-white rounded-lg transition-colors"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2 px-1">
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-1 h-1 bg-green-400 rounded-full" /> Enter 发送</span>
                <span className="flex items-center gap-1"><span className="w-1 h-1 bg-blue-400 rounded-full" /> Shift+Enter 换行</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Settings className="w-3.5 h-3.5" />
                设置
              </div>
            </div>
          </div>
        </Card>
      </div>
      <LightRegisterPrompt
        open={showRegisterPrompt}
        onClose={() => setShowRegisterPrompt(false)}
      />
    </div>
  );
}
