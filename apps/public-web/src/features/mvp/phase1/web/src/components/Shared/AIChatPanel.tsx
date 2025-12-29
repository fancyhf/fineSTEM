import React, { useState, useEffect, useRef } from 'react';
import { X, Bot, Send, User, AlertCircle, Sparkles } from 'lucide-react';
import { InteractiveCodeTour } from './InteractiveCodeTour';
import { CodeTourConfig, PresetQuestion } from '../../types/system';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

interface AIChatPanelProps {
  title: string;
  onClose: () => void;
  contextData: any; 
  contextType: 'code' | 'data';
  tourConfig?: CodeTourConfig;
  presetQuestions?: PresetQuestion[];
  isOpen?: boolean;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({ 
  title, 
  onClose, 
  contextData, 
  contextType,
  tourConfig,
  presetQuestions = [],
  isOpen = true
}) => {
  const [activeTab, setActiveTab] = useState<'tour' | 'chat'>('tour');
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: contextType === 'code' 
        ? '你好！我是你的 AI 编程导师。你可以点击上方的"代码导览"来一步步学习，也可以在这里直接问我问题哦！' 
        : '你好！我是你的 AI 数据分析师。让我们一起探索数据的奥秘吧！你可以先看看"代码导览"了解原理。'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeTab]);

  const handleSendMessage = async (text: string = inputValue) => {
    if (!text.trim() || isLoading) return;

    const userMessage = text.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const contextString = `
Context Type: ${contextType}
Current Data/Config: ${JSON.stringify(contextData, null, 2)}
Code Snippet:
${tourConfig?.codeSnippet || 'No code snippet provided'}
`;

      const response = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }]
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role, content: m.content })),
          context: contextString,
          provider: 'deepseek'
        })
      });

      const data = await response.json();
      
      if (data.role && data.content) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '抱歉，连接服务器失败。请检查后端服务是否启动，或者 API Key 是否配置正确。' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-4 top-[88px] bottom-4 w-[420px] bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col rounded-xl transition-all duration-300 animate-in slide-in-from-right-10 z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900 rounded-t-xl shrink-0">
        <div className="flex items-center gap-2 text-blue-400">
          <Bot size={20} />
          <h2 className="font-bold text-lg">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex bg-gray-800 rounded-lg p-1 mr-4">
            <button
              onClick={() => setActiveTab('tour')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                activeTab === 'tour' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              互动导览
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                activeTab === 'chat' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              AI 问答
            </button>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col relative bg-gray-900">
        
        {/* Tab 1: Interactive Tour */}
        <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 ${activeTab === 'tour' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          {tourConfig ? (
            <InteractiveCodeTour config={tourConfig} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              暂无导览内容
            </div>
          )}
        </div>

        {/* Tab 2: Chat Interface */}
        <div className={`absolute inset-0 flex flex-col bg-gray-900 transition-opacity duration-300 ${activeTab === 'chat' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3 ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-gray-800 text-gray-200 rounded-bl-none border border-gray-700'
                }`}>
                  <div className="flex items-center gap-2 mb-1 opacity-50 text-xs">
                    {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                    <span>{msg.role === 'user' ? '你' : 'AI 导师'}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-2xl p-3 rounded-bl-none border border-gray-700 flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Preset Questions Chips */}
          {presetQuestions.length > 0 && !isLoading && (
            <div className="px-4 py-2 bg-gray-900/90 border-t border-gray-800 flex gap-2 overflow-x-auto custom-scrollbar">
              {presetQuestions.map(q => (
                <button
                  key={q.id}
                  onClick={() => handleSendMessage(q.question)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-xs text-blue-300 whitespace-nowrap transition-colors shrink-0"
                >
                  <Sparkles size={12} />
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-gray-800 bg-gray-900">
            <div className="relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={isLoading ? "AI 正在思考..." : "输入你的问题..."}
                disabled={isLoading}
                className="w-full bg-gray-800 text-white rounded-xl pl-4 pr-12 py-3 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-gray-500"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                className="absolute right-2 top-2 p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
            <div className="mt-2 text-center">
               <span className="text-xs text-gray-600 flex items-center justify-center gap-1">
                 <AlertCircle size={10} />
                 Powered by DeepSeek / Qwen
               </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
