import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Sparkles, ClipboardList, ArrowRight, MessageCircle, Paperclip, Image as ImageIcon, Send, X } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { achievementCardsApi, demosApi } from '../services/api';
import { AchievementCard, Demo, FeaturedCard } from '../types';
import { resolveImageUrl } from '../lib/image';

interface AttachmentItem {
  kind: 'image' | 'file';
  name: string;
  previewUrl?: string;
}

const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.txt,.md,.zip,.csv,.json';

export function Home() {
  useAuth();
  const navigate = useNavigate();
  const [demos, setDemos] = useState<Demo[]>([]);
  const [inspirationCards, setInspirationCards] = useState<AchievementCard[]>([]);
  const [featuredCards, setFeaturedCards] = useState<FeaturedCard[]>([]);
  const [quickInput, setQuickInput] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // 把附件文件名以行内标注形式追加到提问里，带去 /create。
    // 这样不引入新的上传端点；Create 页 ?q= 解析会把它当作首条消息的一部分。
    const attachmentNote =
      attachments.length > 0
        ? `\n\n[附件: ${attachments.map((a) => a.name).join(', ')}]`
        : '';
    navigate(`/create?q=${encodeURIComponent(message + attachmentNote)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuickAsk();
    }
  };

  const addFiles = (files: FileList | null, kind: 'image' | 'file') => {
    if (!files || files.length === 0) return;
    const items: AttachmentItem[] = Array.from(files).map((f) => ({
      kind,
      name: f.name,
      previewUrl: kind === 'image' ? URL.createObjectURL(f) : undefined,
    }));
    setAttachments((prev) => [...prev, ...items]);
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => {
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files, 'image');
    e.target.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files, 'file');
    e.target.value = '';
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
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                {attachments.map((att, idx) => (
                  <span
                    key={`${att.name}-${idx}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs"
                  >
                    {att.kind === 'image' && att.previewUrl ? (
                      <img src={att.previewUrl} alt={att.name} className="w-4 h-4 object-cover rounded" />
                    ) : null}
                    <span className="max-w-[140px] truncate">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="text-slate-400 hover:text-slate-600"
                      title="移除"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between px-3 pb-2.5 pt-0 border-t border-gray-50">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                  title="添加附件"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                  title="添加图片"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageChange}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ATTACHMENT_ACCEPT}
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
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
            <Link key={demo.id} to={`/explore/demos/${demo.id}`} className="block">
              <Card hoverable className="overflow-hidden h-full cursor-pointer">
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
            </Link>
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
              <Link key={card.id} to={`/explore/inspiration/${card.id}`} className="block">
                <Card hoverable className="overflow-hidden h-full cursor-pointer">
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
              </Link>
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
            <Link key={card.id} to={`/explore/inspiration/${card.id}`} className="block">
              <Card key={card.id} hoverable className="overflow-hidden h-full cursor-pointer">
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
            </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
