import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Sparkles, ClipboardList, ArrowRight, MessageCircle, Paperclip, Image, Send } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { achievementCardsApi, demosApi } from '../services/api';
import { AchievementCard, Demo, FeaturedCard } from '../types';
import { resolveImageUrl } from '../lib/image';

export function Home() {
  useAuth();
  const navigate = useNavigate();
  const [demos, setDemos] = useState<Demo[]>([]);
  const [inspirationCards, setInspirationCards] = useState<AchievementCard[]>([]);
  const [featuredCards, setFeaturedCards] = useState<FeaturedCard[]>([]);
  const [quickInput, setQuickInput] = useState('');

  useEffect(() => {
    const load = async () => {
      const [demoRes, cardsRes, featuredRes] = await Promise.all([
        demosApi.list({ page: 1, page_size: 4 }),
        achievementCardsApi.listPublic({ page: 1, page_size: 4 }),
        achievementCardsApi.listFeatured({ page: 1, page_size: 4 }),
      ]);
      setDemos(demoRes.data?.items ?? []);
      setInspirationCards(cardsRes.data?.items ?? []);
      setFeaturedCards(featuredRes.data?.items ?? []);
    };
    void load();
  }, []);

  const handleQuickAsk = () => {
    const message = quickInput.trim();
    if (!message) return;
    navigate(`/create?q=${encodeURIComponent(message)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuickAsk();
    }
  };

  return (
    <div className="space-y-8">
      <section className="text-center py-8 md:py-12">
        <div className="inline-flex items-center px-3 py-1.5 bg-teal-50 text-teal-700 rounded-full text-sm font-medium mb-4">
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          青少年 STEM 研学助手
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          从兴趣到成果，AI 陪你做项目
        </h1>
        <p className="text-base text-gray-500 max-w-xl mx-auto mb-6">
          探索精彩项目，使用 AI 助手，完成你的研究，分享你的成就
        </p>
        <div className="max-w-lg mx-auto">
          <div className="relative border border-gray-200 rounded-xl bg-white focus-within:border-teal-400 focus-within:ring-1 focus-within:ring-teal-100 transition-all">
            <div className="flex items-start gap-2 px-3 pt-3 pb-2">
              <MessageCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-2" />
              <textarea
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="问一个问题，开始你的探索..."
                rows={2}
                className="w-full border-0 bg-transparent text-sm outline-none placeholder-gray-400 resize-none leading-relaxed"
              />
            </div>
            <div className="flex items-center justify-between px-3 pb-2.5 pt-0 border-t border-gray-50">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {}}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                  title="添加附件"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {}}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                  title="添加图片"
                >
                  <Image className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleQuickAsk}
                disabled={!quickInput.trim()}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1 flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                提问
              </button>
            </div>
          </div>
        </div>
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
          {demos.map((demo) => {
            const cover = demo.screenshots && demo.screenshots.length > 0
              ? resolveImageUrl(demo.screenshots[0]) : null;
            return (
            <Card key={demo.id} hoverable className="overflow-hidden">
              {cover ? (
                <img src={cover} alt={demo.name} className="h-32 w-full object-cover" loading="lazy" />
              ) : (
                <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200" />
              )}
              <CardContent className="pt-3">
                <h3 className="font-semibold text-gray-800 text-sm">{demo.name}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{demo.description}</p>
              </CardContent>
            </Card>
            );
          })}
        </div>
      </section>

      {featuredCards.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">精选作品</h2>
            <Link to="/explore/inspiration" className="text-teal-600 hover:text-teal-700 font-medium text-sm">
              查看全部
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredCards.map((card) => {
              const cover = card.screenshots && card.screenshots.length > 0
                ? resolveImageUrl(card.screenshots[0]) : null;
              return (
              <Card key={card.id} hoverable className="overflow-hidden">
                {cover ? (
                  <img src={cover} alt={card.title} className="h-32 w-full object-cover" loading="lazy" />
                ) : (
                  <div className="h-32 bg-gradient-to-br from-purple-50 to-purple-100" />
                )}
                <CardContent className="pt-3">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800 text-sm truncate flex-1">{card.title}</h3>
                    {card.project_mode && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px] font-medium">
                        {card.project_mode === 'standard' ? '进阶' : '轻量'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{card.one_liner}</p>
                  {card.capability_tags && card.capability_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {card.capability_tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">灵感墙</h2>
          <Link to="/explore/inspiration" className="text-teal-600 hover:text-teal-700 font-medium text-sm">
            查看全部
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {inspirationCards.map((card) => {
            const cover = card.screenshots && card.screenshots.length > 0
              ? resolveImageUrl(card.screenshots[0]) : null;
            return (
            <Card key={card.id} hoverable className="overflow-hidden">
              {cover ? (
                <img src={cover} alt={card.title} className="h-32 w-full object-cover" loading="lazy" />
              ) : (
                <div className="h-32 bg-gradient-to-br from-teal-50 to-teal-100" />
              )}
              <CardContent className="pt-3">
                <h3 className="font-semibold text-gray-800 text-sm">{card.title}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{card.one_liner}</p>
              </CardContent>
            </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
