import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { achievementCardsApi } from '../services/api';
import { AchievementCard } from '../types';
import { AchievementCardView } from '../components/AchievementCardView';
import { Button } from '../components/ui/Button';
import { ArrowLeft } from 'lucide-react';

export default function SharedAchievement() {
  const { token } = useParams<{ token: string }>();
  const [achievement, setAchievement] = useState<AchievementCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    loadSharedAchievement();
  }, [token]);

  const loadSharedAchievement = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await achievementCardsApi.getShared(token);
      if (response.data) {
        setAchievement(response.data);
      }
    } catch (err) {
      setError('分享链接无效或已过期');
    } finally {
      setLoading(false);
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
          <p className="text-red-600 mb-4 text-lg">{error || '分享链接无效'}</p>
          <Button onClick={() => window.location.href = '/'}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            回到首页
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <AchievementCardView achievement={achievement} />
        <div className="mt-6 text-center">
          <Button variant="secondary" onClick={() => window.location.href = '/'}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            探索更多项目
          </Button>
        </div>
      </div>
    </div>
  );
}
