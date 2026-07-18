/**
 * 精选作品管理页面
 *
 * 用途：管理员浏览已公开发布的成果档案卡，标记/取消首页精选，调整排序权重。
 * 维护者：AI Agent
 */

import { useState, useEffect, useCallback } from 'react';
import { Star, Check, X } from 'lucide-react';
import { Card, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { achievementCardsApi } from '../services/api';
import { showToast } from '../services/toast';
import { AchievementCard, PaginationResult } from '../types';
import { resolveImageUrl } from '../lib/image';

export default function AdminFeatured() {
  const [cards, setCards] = useState<AchievementCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Omit<PaginationResult<AchievementCard>, 'items'> | null>(null);
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sortEdits, setSortEdits] = useState<Record<string, number>>({});

  const pageSize = 9;

  const loadCards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await achievementCardsApi.listPublic({ page, page_size: pageSize });
      if (res.data) {
        setCards(res.data.items);
        setPagination({
          total: res.data.total,
          page: res.data.page,
          page_size: res.data.page_size,
          total_pages: res.data.total_pages,
        });
      }
    } catch (err) {
      console.error('Failed to load achievement cards:', err);
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const handleFeature = async (cardId: string) => {
    setActionLoading(cardId);
    try {
      await achievementCardsApi.setFeatured(cardId, true, 0);
      showToast('success', '已设为精选');
      await loadCards();
    } catch (err) {
      showToast('error', '操作失败，请稍后重试');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnfeature = async (cardId: string) => {
    setActionLoading(cardId);
    try {
      await achievementCardsApi.setFeatured(cardId, false);
      showToast('success', '已取消精选');
      await loadCards();
    } catch (err) {
      showToast('error', '操作失败，请稍后重试');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSortChange = (cardId: string, value: number) => {
    setSortEdits((prev) => ({ ...prev, [cardId]: value }));
  };

  const handleSortSave = async (cardId: string) => {
    const newOrder = sortEdits[cardId];
    if (newOrder === undefined) return;
    setActionLoading(`sort-${cardId}`);
    try {
      await achievementCardsApi.setFeatured(cardId, true, newOrder);
      showToast('success', '排序已更新');
      await loadCards();
      setSortEdits((prev) => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
    } catch (err) {
      showToast('error', '排序更新失败');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && cards.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error && cards.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadCards}>重试</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Star className="h-6 w-6 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900">精选作品管理</h1>
          </div>
          <p className="text-gray-600">
            浏览已公开发布的成果档案卡，选择要展示在首页精选区的作品。排序权重越大越靠前。
          </p>
        </div>

        {cards.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">暂无公开发布的成果档案卡</p>
            <p className="text-gray-400 text-sm">
              学生发布作品到灵感墙后，会出现在这里供管理员精选。
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {cards.map((card) => {
                const featured = !!card.is_featured;
                const isLoading = actionLoading === card.id;
                const isSortLoading = actionLoading === `sort-${card.id}`;
                const cover = card.screenshots && card.screenshots.length > 0
                  ? resolveImageUrl(card.screenshots[0]) : null;
                return (
                  <Card key={card.id} className="overflow-hidden flex flex-col">
                    <div className="relative">
                      {cover ? (
                        <img src={cover} alt={card.title} className="h-40 w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="h-40 bg-gradient-to-br from-purple-50 to-purple-100" />
                      )}
                      <div className="absolute top-3 right-3">
                        {featured ? (
                          <Badge variant="success" size="sm">
                            <Check className="w-3 h-3 mr-0.5" />
                            精选
                          </Badge>
                        ) : (
                          <Badge variant="default" size="sm">未精选</Badge>
                        )}
                      </div>
                    </div>
                    <CardContent className="pt-4 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-800 text-base truncate flex-1">
                          {card.title}
                        </h3>
                        {card.project_mode && (
                          <Badge variant="secondary" size="sm">
                            {card.project_mode === 'standard' ? '进阶' : '轻量'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{card.one_liner}</p>
                      {card.capability_tags && card.capability_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {card.capability_tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="primary" size="sm">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex items-center gap-2">
                      {featured ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 whitespace-nowrap">排序</span>
                            <Input
                              type="number"
                              min={0}
                              className="!w-20 !h-9 !px-2 !py-1 text-sm"
                              value={sortEdits[card.id] ?? card.featured_sort_order ?? 0}
                              onChange={(e) => handleSortChange(card.id, parseInt(e.target.value, 10) || 0)}
                              onBlur={() => handleSortSave(card.id)}
                              disabled={isSortLoading}
                            />
                          </div>
                          <Button
                            variant="error"
                            size="sm"
                            className="flex-1"
                            disabled={isLoading}
                            onClick={() => handleUnfeature(card.id)}
                          >
                            {isLoading ? (
                              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                            ) : (
                              <>
                                <X className="w-4 h-4 mr-1" />
                                取消精选
                              </>
                            )}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="success"
                          size="sm"
                          className="flex-1"
                          disabled={isLoading}
                          onClick={() => handleFeature(card.id)}
                        >
                          {isLoading ? (
                            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                          ) : (
                            <>
                              <Star className="w-4 h-4 mr-1" />
                              设为精选
                            </>
                          )}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            {pagination && pagination.total_pages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(pagination.page - 1)}
                >
                  上一页
                </Button>
                <span className="flex items-center px-4 text-gray-600 text-sm">
                  第 {pagination.page} 页 / 共 {pagination.total_pages} 页
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page >= pagination.total_pages}
                  onClick={() => setPage(pagination.page + 1)}
                >
                  下一页
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
