import React, { useEffect, useState } from 'react';
import { Search as SearchIcon, Filter } from 'lucide-react';
import { Card, CardContent, CardFooter, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { achievementCardsApi, demosApi, coursesApi } from '../services/api';
import { AchievementCard, Course, Demo } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { LightRegisterPrompt } from '../components/LightRegisterPrompt';
import { useNavigate } from 'react-router-dom';
import { resolveImageUrl } from '../lib/image';

type TabType = 'demos' | 'courses' | 'inspiration';

export function Explore() {
  const [activeTab, setActiveTab] = useState<TabType>('demos');
  const [keyword, setKeyword] = useState('');
  const [demos, setDemos] = useState<Demo[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [inspirations, setInspirations] = useState<AchievementCard[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [demoRes, inspirationRes] = await Promise.all([
        demosApi.list({ page: 1, page_size: 12, search: keyword || undefined }),
        achievementCardsApi.listPublic({ page: 1, page_size: 12 }),
      ]);
      setDemos(demoRes.data?.items ?? []);
      setInspirations(inspirationRes.data?.items ?? []);
      if (user) {
        const courseRes = await coursesApi.listCourses();
        setCourses(courseRes.data ?? []);
      } else {
        setCourses([]);
      }
    };
    void load();
  }, [keyword, user]);

  const handleForkFromCard = async (cardId: string) => {
    if (!user) {
      setShowRegisterPrompt(true);
      return;
    }
    const res = await achievementCardsApi.forkProjectFromCard(cardId);
    if (res.data) navigate(`/research/projects/${res.data.id}`);
  };

  const handleWithdraw = async (cardId: string) => {
    await achievementCardsApi.withdrawPublic(cardId);
    const res = await achievementCardsApi.listPublic({ page: 1, page_size: 12 });
    setInspirations(res.data?.items ?? []);
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'demos', label: 'Demo 墙' },
    { id: 'courses', label: '课程库' },
    { id: 'inspiration', label: '灵感墙' },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex space-x-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="搜索..." className="pl-10" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <Button variant="secondary">
          <Filter className="w-4 h-4 mr-2" />
          筛选
        </Button>
      </div>

      {/* Content */}
      {activeTab === 'demos' && <DemosContent demos={demos} />}
      {activeTab === 'courses' && <CoursesContent courses={courses} />}
      {activeTab === 'inspiration' && (
        <InspirationContent
          cards={inspirations}
          userId={user?.id}
          onFork={handleForkFromCard}
          onWithdraw={handleWithdraw}
        />
      )}
      <LightRegisterPrompt
        open={showRegisterPrompt}
        title="注册后可 Fork 项目"
        description="登录或轻注册后，即可从灵感墙 Fork 项目。"
        onClose={() => setShowRegisterPrompt(false)}
      />
    </div>
  );
}

function DemosContent({ demos }: { demos: Demo[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {demos.map((demo) => {
        const cover = demo.screenshots && demo.screenshots.length > 0
          ? resolveImageUrl(demo.screenshots[0]) : null;
        return (
        <Card key={demo.id} hoverable className="overflow-hidden">
          {cover ? (
            <img src={cover} alt={demo.name} className="h-40 w-full object-cover" loading="lazy" />
          ) : (
            <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200" />
          )}
          <CardContent className="pt-4">
            <CardTitle className="text-base">{demo.name}</CardTitle>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{demo.description}</p>
            <div className="flex flex-wrap gap-1 mt-3">
              {(demo.subjects || []).slice(0, 2).map((subject) => (
                <Badge key={subject} variant="primary" size="sm">{subject}</Badge>
              ))}
              <Badge size="sm">{demo.difficulty}</Badge>
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1">
              试玩
            </Button>
            <Button variant="ghost" size="sm" className="flex-1">
              拆解
            </Button>
          </CardFooter>
          <div className="px-4 pb-4">
            <Button className="w-full">我也做一个</Button>
          </div>
        </Card>
        );
      })}
    </div>
  );
}

function CoursesContent({ courses }: { courses: Course[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {courses.map((course) => (
        <Card key={course.id} hoverable className="overflow-hidden">
          <div className="h-36 bg-gradient-to-br from-blue-50 to-blue-100" />
          <CardContent className="pt-4">
            <CardTitle className="text-base">{course.title}</CardTitle>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{course.summary}</p>
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <span>{course.subject || '综合'}</span>
              <span>•</span>
              <span>{course.difficulty}</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full">开始学习</Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function InspirationContent({
  cards,
  userId,
  onFork,
  onWithdraw,
}: {
  cards: AchievementCard[];
  userId?: string;
  onFork: (cardId: string) => void;
  onWithdraw: (cardId: string) => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {cards.map((card) => {
        const cover = card.screenshots && card.screenshots.length > 0
          ? resolveImageUrl(card.screenshots[0]) : null;
        return (
        <Card key={card.id} hoverable className="overflow-hidden">
          {cover ? (
            <img src={cover} alt={card.title} className="h-40 w-full object-cover" loading="lazy" />
          ) : (
            <div className="h-40 bg-gradient-to-br from-primary-50 to-primary-100" />
          )}
          <CardContent className="pt-4">
            <CardTitle className="text-base">{card.title}</CardTitle>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{card.one_liner}</p>
            <div className="flex flex-wrap gap-1 mt-3">
              {(card.capability_tags || []).slice(0, 2).map((tag) => (
                <Badge key={tag} size="sm">{tag}</Badge>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => onFork(card.id)}>Fork</Button>
            {userId === card.author_id ? (
              <Button variant="secondary" className="flex-1" onClick={() => onWithdraw(card.id)}>撤回</Button>
            ) : (
              <Button variant="ghost" className="flex-1">查看详情</Button>
            )}
          </CardFooter>
        </Card>
        );
      })}
    </div>
  );
}
