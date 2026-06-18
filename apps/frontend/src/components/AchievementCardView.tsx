import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { MarkdownText } from './MarkdownText';
import { AchievementCard } from '../types';
import { Award, Calendar } from 'lucide-react';

interface AchievementCardViewProps {
  achievement: AchievementCard;
  showShareButton?: boolean;
  onShare?: () => void;
}

export function AchievementCardView({ achievement, showShareButton = false, onShare }: AchievementCardViewProps) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-8">
        <div className="flex items-center gap-3 mb-4">
          <Award className="h-12 w-12 text-white" />
          <div>
            <h2 className="text-2xl font-bold text-white">{achievement.title}</h2>
            <p className="text-teal-100 text-sm">成果档案卡</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {achievement.capability_tags.map((tag, idx) => (
            <Badge key={idx} className="bg-white/20 text-white border-white/30">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <CardContent className="pt-6">
        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">一句话介绍</h3>
            <MarkdownText content={achievement.one_liner} projectId={achievement.project_id} />
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">解决的问题</h3>
            <MarkdownText content={achievement.problem_solved} projectId={achievement.project_id} />
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">使用的方法</h3>
            <MarkdownText content={achievement.method_used} projectId={achievement.project_id} />
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">反思</h3>
            <MarkdownText content={achievement.reflection} projectId={achievement.project_id} />
          </section>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4" />
              <span>创建于 {new Date(achievement.created_at).toLocaleDateString('zh-CN')}</span>
            </div>
            {achievement.is_public ? (
              <Badge className="bg-green-100 text-green-800">已公开展示</Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-800">私有</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
