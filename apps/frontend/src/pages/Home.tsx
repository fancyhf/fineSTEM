import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Sparkles, ClipboardList, ArrowRight, User, Paperclip, Link2, ChevronUp, FileText } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { useStreamingChat } from '../hooks/useStreamingChat';
import { MarkdownText } from '../components/MarkdownText';
import { LightRegisterPrompt } from '../components/LightRegisterPrompt';
import { achievementCardsApi, demosApi } from '../services/api';
import { AchievementCard, Demo } from '../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_SUGGESTIONS = [
  '帮我整理论文综述、编写 PPT、分析 Excel 等日常工作，输出专业级工作成果。',
  '我想做一个 AI 诗词生成器项目，帮我规划一下步骤',
  '用 Python 写一个简单的计算器程序',
];

export function Home() {
  const { user } = useAuth();
  const { stream } = useStreamingChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [demos, setDemos] = useState<Demo[]>([]);
  const [inspirationCards, setInspirationCards] = useState<AchievementCard[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [inputValue]);

  useEffect(() => {
    const load = async () => {
      const [demoRes, cardsRes] = await Promise.all([
        demosApi.list({ page: 1, page_size: 4 }),
        achievementCardsApi.listPublic({ page: 1, page_size: 4 }),
      ]);
      setDemos(demoRes.data?.items ?? []);
      setInspirationCards(cardsRes.data?.items ?? []);
    };
    void load();
  }, []);

  const ANON_CHAT_LIMIT = 5;

  const getAnonUsage = () => Number(localStorage.getItem('anonymous_chat_count') || '0');

  const handleSend = async (text?: string) => {
    const message = (text || inputValue).trim();
    if (!message || isLoading) return;

    if (!user) {
      const used = getAnonUsage();
      if (used >= ANON_CHAT_LIMIT) {
        setShowRegisterPrompt(true);
        return;
      }
    }

    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setInputValue('');
    setShowChatHistory(true);
    setIsLoading(true);

    try {
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
      await stream({
        message,
        context: {
          page: 'home',
          user_level: user?.level || 1,
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
      if (!user) {
        const used = getAnonUsage();
        localStorage.setItem('anonymous_chat_count', String(used + 1));
        if (used + 1 >= ANON_CHAT_LIMIT) setShowRegisterPrompt(true);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: getLocalResponse(message)
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getLocalResponse = (msg: string): string => {
    const lower = msg.toLowerCase();
    if (lower.includes('课题') || lower.includes('选题') || lower.includes('推荐')) {
      return '好的！这里有几个适合中学生的 STEM 项目方向：\n\n1. **AI 诗词生成器** - 用 Python 和 NLP 创作古诗\n2. **智能计算器** - 支持语音输入的计算器应用\n3. **数据可视化** - 用 ECharts 展示真实世界数据\n4. **物理模拟** - 用 Matter.js 模拟双摆混沌系统\n\n点击"从 Demo 开始"可以查看更多灵感！';
    }
    if (lower.includes('python') || lower.includes('程序') || lower.includes('代码') || lower.includes('计算器')) {
      return '太棒了！我来帮你创建一个计算器项目。\n\n建议步骤：\n1. 先浏览 Demo 墙找灵感\n2. 选择一个感兴趣的 Demo 点击"我也做一个"\n3. 按照引导完成轻项目的 3 个步骤\n\n准备好了吗？点击"开始探索"开始吧！';
    }
    if (lower.includes('demo') || lower.includes('示例')) {
      return '我们有很多精彩的 Demo 可以参考：\n\n- AI 诗词生成器（入门级）\n- 智能计算器（中级）\n- 待办清单管理器（入门级）\n\n每个 Demo 都可以一键 Fork 变成你自己的项目哦！';
    }
    if (lower.includes('论文') || lower.includes('ppt') || lower.includes('excel') || lower.includes('整理')) {
      return '我可以帮你完成以下学术工作：\n\n- 整理文献综述和论文大纲\n- 编写 PPT 大纲和内容框架\n- 数据分析与可视化（Excel / Python）\n- 项目文档和成果档案卡撰写\n\n请告诉我具体需要什么帮助？';
    }
    return '收到！我可以帮你：\n\n- 推荐适合的 STEM 项目课题\n- 规划项目步骤和方案\n- 解答编程和技术问题\n- 整理论文、PPT、数据分析等学术工作\n- 引导你创建第一个项目\n\n告诉我你想做什么，我来帮你！';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-8">
      <section className="text-center py-4">
        <div className="inline-flex items-center px-3 py-1.5 bg-teal-50 text-teal-700 rounded-full text-sm font-medium mb-3">
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          青少年 STEM 研学助手
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          从兴趣到成果，AI 陪你做项目
        </h1>
        <p className="text-base text-gray-500 max-w-xl mx-auto">
          探索精彩项目，使用 AI 助手，完成你的研究，分享你的成就
        </p>
      </section>

      <section>
        <Card className="overflow-hidden border-gray-200 shadow-sm">
          {showChatHistory ? (
            <div className="max-h-[360px] overflow-y-auto">
              <div className="p-4 space-y-3 bg-white">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
            <div className="p-6 pb-0">
              <div className="flex flex-wrap gap-2">
                {QUICK_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(suggestion)}
                    disabled={isLoading}
                    className="text-left text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors leading-relaxed line-clamp-2"
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
                placeholder={isLoading ? 'AI 正在思考...' : showChatHistory ? '继续对话...' : '帮我整理论文综述、编写 PPT、分析 Excel 等日常工作，输出专业级工作成果。'}
                disabled={isLoading}
                className="w-full resize-none border-0 bg-transparent px-4 py-3 text-sm outline-none placeholder-gray-400 max-h-40"
              />

              <div className="flex items-center justify-between px-2 py-1.5">
                <div className="flex items-center gap-0.5">
                  <button className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-gray-100 rounded-lg text-gray-500 text-xs font-medium transition-colors">
                    <FileText className="w-3.5 h-3.5" />
                    我的DataChart
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
                  {!user && (
                    <span className="text-xs text-amber-600">
                      匿名用户剩余 {ANON_CHAT_LIMIT - getAnonUsage()} 次
                    </span>
                  )}
                  <span className="text-xs text-gray-400">fineSTEM AI</span>
                  <button
                    onClick={() => handleSend()}
                    disabled={!inputValue.trim() || isLoading}
                    className="p-1.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 text-white rounded-lg transition-colors"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <div className="grid md:grid-cols-3 gap-5">
          <Link to="/explore" className="block">
            <Card hoverable className="h-full">
              <CardHeader>
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                  <Search className="w-5 h-5 text-blue-600" />
                </div>
                <CardTitle>探索</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm">
                  试玩精彩 Demo，查看丰富案例，发现灵感
                </p>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <span className="text-teal-600 font-medium text-sm">进入</span>
                <ArrowRight className="w-4 h-4 text-teal-600" />
              </CardFooter>
            </Card>
          </Link>

          <Link to="/create" className="block">
            <Card hoverable className="h-full">
              <CardHeader>
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <CardTitle>创造</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm">
                  与 AI 助手对话，编写代码，开启你的项目
                </p>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <span className="text-teal-600 font-medium text-sm">进入</span>
                <ArrowRight className="w-4 h-4 text-teal-600" />
              </CardFooter>
            </Card>
          </Link>

          <Link to="/research" className="block">
            <Card hoverable className="h-full">
              <CardHeader>
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                  <ClipboardList className="w-5 h-5 text-green-600" />
                </div>
                <CardTitle>研究</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm">
                  按照过程工单，完成研究，产出论文
                </p>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <span className="text-teal-600 font-medium text-sm">进入</span>
                <ArrowRight className="w-4 h-4 text-teal-600" />
              </CardFooter>
            </Card>
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">精选 Demo</h2>
          <Link to="/explore/demos" className="text-teal-600 hover:text-teal-700 font-medium text-sm">
            查看全部
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {demos.map((demo) => (
            <Card key={demo.id} hoverable className="overflow-hidden">
              <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200" />
              <CardContent className="pt-3">
                <h3 className="font-semibold text-gray-800 text-sm">{demo.name}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{demo.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">灵感墙</h2>
          <Link to="/explore/inspiration" className="text-teal-600 hover:text-teal-700 font-medium text-sm">
            查看全部
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {inspirationCards.map((card) => (
            <Card key={card.id} hoverable className="overflow-hidden">
              <div className="h-32 bg-gradient-to-br from-teal-50 to-teal-100" />
              <CardContent className="pt-3">
                <h3 className="font-semibold text-gray-800 text-sm">{card.title}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{card.one_liner}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <LightRegisterPrompt
        open={showRegisterPrompt}
        onClose={() => setShowRegisterPrompt(false)}
      />
    </div>
  );
}
