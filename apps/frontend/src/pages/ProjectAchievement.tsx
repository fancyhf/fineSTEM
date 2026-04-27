import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { achievementCardsApi } from '../services/api';
import { AchievementCard, AchievementRecommendation, ShareTokenResponse } from '../types';
import { AchievementCardView } from '../components/AchievementCardView';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { ArrowLeft, Share2, Copy, ExternalLink, Globe, EyeOff } from 'lucide-react';

export default function ProjectAchievement() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [achievement, setAchievement] = useState<AchievementCard | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingShare, setGeneratingShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recommendations, setRecommendations] = useState<AchievementRecommendation[]>([]);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    loadAchievement();
  }, [projectId]);

  const loadAchievement = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const response = await achievementCardsApi.getByProject(projectId);
      if (response.data) {
        setAchievement(response.data);
        const recRes = await achievementCardsApi.recommendations(response.data.id);
        setRecommendations(recRes.data ?? []);
      }
    } catch (err) {
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateShareLink = async () => {
    if (!achievement) return;
    try {
      setGeneratingShare(true);
      const response = await achievementCardsApi.createShareLink(achievement.id);
      if (response.data) {
        setShareUrl(response.data.share_url);
      }
    } catch (err) {
      alert('生成分享链接失败');
    } finally {
      setGeneratingShare(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('复制失败');
    }
  };

  const handlePublishToWall = async () => {
    if (!achievement) return;
    try {
      setPublishing(true);
      await achievementCardsApi.submitPublic(achievement.id);
      await loadAchievement();
    } catch {
      alert('发布失败，请稍后重试');
    } finally {
      setPublishing(false);
    }
  };

  const handleWithdrawFromWall = async () => {
    if (!achievement) return;
    try {
      setPublishing(true);
      await achievementCardsApi.withdrawPublic(achievement.id);
      await loadAchievement();
    } catch {
      alert('撤回失败，请稍后重试');
    } finally {
      setPublishing(false);
    }
  };

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

  if (error || !achievement) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || '成果档案卡不存在'}</p>
          <Button variant="secondary" onClick={() => navigate(`/research/projects/${projectId}`)}>
            返回项目
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <Button variant="secondary" className="mb-6" onClick={() => navigate(`/research/projects/${projectId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回项目
        </Button>

        <AchievementCardView achievement={achievement} />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">分享成果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {achievement.is_public ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-sm text-green-700">
                <Globe className="h-4 w-4" />
                已发布到灵感墙
                <Button
                  size="sm"
                  variant="secondary"
                  className="ml-auto"
                  onClick={handleWithdrawFromWall}
                  disabled={publishing}
                >
                  <EyeOff className="h-3 w-3 mr-1" />
                  撤回
                </Button>
              </div>
            ) : (
              <Button
                onClick={handlePublishToWall}
                className="w-full"
                disabled={publishing}
              >
                <Globe className="h-4 w-4 mr-2" />
                {publishing ? '发布中...' : '发布到灵感墙'}
              </Button>
            )}
            {shareUrl ? (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 break-all">
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    {shareUrl}
                  </a>
                </div>
                <Button onClick={handleCopyShareLink} className="w-full">
                  <Copy className="h-4 w-4 mr-2" />
                  {copied ? '已复制！' : '复制链接'}
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleGenerateShareLink}
                className="w-full bg-teal-600 hover:bg-teal-700"
                disabled={generatingShare}
              >
                <Share2 className="h-4 w-4 mr-2" />
                {generatingShare ? '生成中...' : '生成分享链接'}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">下一步挑战</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.length === 0 ? (
              <p className="text-sm text-gray-500">暂无推荐，先完善成果卡能力标签。</p>
            ) : (
              recommendations.map((item, idx) => (
                <div key={`${item.type}-${item.id || idx}`} className="border rounded-lg p-3 bg-gray-50">
                  <div className="font-medium text-gray-900">{item.title}</div>
                  <p className="text-sm text-gray-700 mt-1">{item.description}</p>
                  {item.target_url && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      onClick={() => navigate(item.target_url!)}
                    >
                      去完成
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
