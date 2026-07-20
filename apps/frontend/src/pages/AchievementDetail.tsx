import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { achievementCardsApi } from '../services/api';
import { AchievementCard } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LightRegisterPrompt } from '../components/LightRegisterPrompt';
import { MarkdownText } from '../components/MarkdownText';
import { useAuth } from '../contexts/AuthContext';
import { resolveImageUrl } from '../lib/image';

type DetailTab = 'intro' | 'method' | 'reflection';

/**
 * 成果档案卡主页（公开可读）
 *
 * 用途：首页「精选作品/灵感墙」与探索区「灵感墙」卡片点开后落到这里。
 *      页面骨架严格对齐 ExploreDemoDetail（Demo 详情页），仅数据源不同。
 * 维护者：AI Agent
 */
export default function AchievementDetail() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [card, setCard] = useState<AchievementCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forking, setForking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<'fork' | 'save' | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('intro');
  const [currentScreenshot, setCurrentScreenshot] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!cardId) return;
      try {
        setLoading(true);
        setError(null);
        const res = await achievementCardsApi.getPublic(cardId);
        if (res.data) {
          setCard(res.data);
        } else {
          setError('档案卡不存在或未公开');
        }
      } catch (err) {
        console.error('Failed to load achievement card:', err);
        setError('档案卡不存在或未公开');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [cardId]);

  // Fork 成果卡 → 创建新项目，返回新项目 ID（对齐 Demo 详情页的 createProjectFromDemo）
  const forkProjectFromCard = async (): Promise<string | null> => {
    if (!card) return null;
    try {
      const res = await achievementCardsApi.forkProjectFromCard(card.id);
      return res.data?.id ?? null;
    } catch (err) {
      console.error('Failed to fork from card:', err);
      setError('Fork 失败，请稍后重试');
      return null;
    }
  };

  // 我也做一个：创建后立刻跳进项目工作台
  const handleFork = async () => {
    if (!user) {
      setPendingAction('fork');
      setShowRegisterPrompt(true);
      return;
    }
    try {
      setForking(true);
      const projectId = await forkProjectFromCard();
      if (projectId) {
        navigate(`/research/projects/${projectId}`);
      }
    } finally {
      setForking(false);
    }
  };

  // 保存到我的项目：创建后只放到列表，不进工作台
  const handleSaveProject = async () => {
    if (!user) {
      setPendingAction('save');
      setShowRegisterPrompt(true);
      return;
    }
    try {
      setSaving(true);
      const projectId = await forkProjectFromCard();
      if (projectId) {
        navigate('/research');
      }
    } finally {
      setSaving(false);
    }
  };

  // 登录/轻注册成功后，按用户之前点的按钮继续执行
  useEffect(() => {
    if (user && pendingAction) {
      const action = pendingAction;
      setPendingAction(null);
      setShowRegisterPrompt(false);
      if (action === 'fork') void handleFork();
      else if (action === 'save') void handleSaveProject();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 注册回调只消费 pendingAction
  }, [user, pendingAction]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || '档案卡不存在'}</p>
          <Button variant="secondary" onClick={() => navigate('/explore/inspiration')}>
            ← 返回灵感墙
          </Button>
        </div>
      </div>
    );
  }

  const screenshots = card.screenshots || [];
  const tags = card.capability_tags || [];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <Button
          variant="secondary"
          className="mb-6"
          onClick={() => navigate('/explore/inspiration')}
        >
          ← 返回灵感墙
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge className="bg-teal-100 text-teal-800">
                    {card.project_mode === 'standard' ? '进阶项目' : '轻量项目'}
                  </Badge>
                  <Badge variant="secondary">
                    {card.is_public ? '已公开展示' : '作品'}
                  </Badge>
                  {tags.slice(0, 3).map((tag, idx) => (
                    <Badge key={idx} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <CardTitle className="text-3xl">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {screenshots.length > 0 && (
                  <div className="mb-6 rounded-lg overflow-hidden border border-gray-200 bg-white">
                    <img
                      src={resolveImageUrl(screenshots[0])}
                      alt={card.title}
                      className="w-full h-auto max-h-[300px] object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <p className="text-gray-700 text-lg mb-6">{card.one_liner}</p>

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">能力标签</h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.length > 0 ? (
                      tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400">暂无能力标签</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t border-gray-100">
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => setActiveTab('intro')}
                  >
                    看介绍
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => setActiveTab('method')}
                  >
                    看方法
                  </Button>
                  <Button
                    size="lg"
                    className="bg-teal-600 hover:bg-teal-700"
                    onClick={handleFork}
                    disabled={forking}
                  >
                    {forking ? '创建中...' : '我也做一个'}
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={handleSaveProject}
                    disabled={saving}
                  >
                    {saving ? '保存中...' : '保存到我的项目'}
                  </Button>
                </div>

                <div className="mt-8">
                  <div className="flex gap-2 mb-4">
                    <Button
                      size="sm"
                      variant={activeTab === 'intro' ? 'primary' : 'secondary'}
                      onClick={() => setActiveTab('intro')}
                    >
                      介绍
                    </Button>
                    <Button
                      size="sm"
                      variant={activeTab === 'method' ? 'primary' : 'secondary'}
                      onClick={() => setActiveTab('method')}
                    >
                      方法
                    </Button>
                    <Button
                      size="sm"
                      variant={activeTab === 'reflection' ? 'primary' : 'secondary'}
                      onClick={() => setActiveTab('reflection')}
                    >
                      反思
                    </Button>
                  </div>

                  {activeTab === 'intro' && (
                    <div className="p-4 bg-gray-50 border rounded-lg space-y-3">
                      {screenshots.length > 0 ? (
                        <div className="space-y-3">
                          <div
                            className="relative w-full bg-white rounded-lg overflow-hidden border border-gray-200"
                            style={{ minHeight: 360 }}
                          >
                            <img
                              src={resolveImageUrl(screenshots[currentScreenshot])}
                              alt={`${card.title} 截图 ${currentScreenshot + 1}`}
                              className="w-full h-auto object-contain"
                              loading="lazy"
                            />
                          </div>
                          {screenshots.length > 1 && (
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={currentScreenshot === 0}
                                onClick={() => setCurrentScreenshot((i) => Math.max(0, i - 1))}
                              >
                                上一张
                              </Button>
                              <span className="text-sm text-gray-500">
                                {currentScreenshot + 1} / {screenshots.length}
                              </span>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={currentScreenshot === screenshots.length - 1}
                                onClick={() =>
                                  setCurrentScreenshot((i) =>
                                    Math.min(screenshots.length - 1, i + 1),
                                  )
                                }
                              >
                                下一张
                              </Button>
                            </div>
                          )}
                          <p className="text-xs text-gray-400 text-center">项目截图预览</p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">该作品暂无截图。</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'method' && (
                    <div className="p-4 bg-gray-50 border rounded-lg space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">我解决了什么问题</h3>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                          <MarkdownText content={card.problem_solved} projectId={card.project_id} />
                        </div>
                      </div>
                      <div className="pt-3 border-t border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">我用了什么方法</h3>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                          <MarkdownText content={card.method_used} projectId={card.project_id} />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'reflection' && (
                    <div className="p-4 bg-gray-50 border rounded-lg space-y-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">我的反思</h3>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                          <MarkdownText content={card.reflection} projectId={card.project_id} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>档案信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">项目模式</span>
                  <span className="font-medium">
                    {card.project_mode === 'standard' ? '进阶' : '轻量'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">展示状态</span>
                  <span className="font-medium">{card.is_public ? '已公开' : '私有'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">创建时间</span>
                  <span className="font-medium">
                    {new Date(card.created_at).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">更新时间</span>
                  <span className="font-medium">
                    {new Date(card.updated_at).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <LightRegisterPrompt
        open={showRegisterPrompt}
        title="注册后可创建项目"
        description="登录或轻注册后，即可基于这个成果创建你自己的项目。"
        onClose={() => { setShowRegisterPrompt(false); setPendingAction(null); }}
      />
    </div>
  );
}
