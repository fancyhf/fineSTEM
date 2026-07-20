import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Filter } from 'lucide-react';
import { Card, CardContent, CardFooter, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { achievementCardsApi, demosApi, coursesApi } from '../services/api';
import { AchievementCard, Course, Demo, DemoListQuery } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { LightRegisterPrompt } from '../components/LightRegisterPrompt';
import { DemoCard } from '../components/DemoCard';
import { DemoFilter } from '../components/DemoFilter';
import { resolveImageUrl } from '../lib/image';

type TabType = 'demos' | 'courses' | 'inspiration';

const VALID_TABS: TabType[] = ['demos', 'courses', 'inspiration'];

export function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType | null);
  const [activeTab, setActiveTab] = useState<TabType>(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'demos',
  );
  const [showFilter, setShowFilter] = useState(false);
  const [demoFilters, setDemoFilters] = useState<{
    search?: string;
    difficulty?: string;
    subject?: string;
  }>({});
  const [demos, setDemos] = useState<Demo[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [inspirations, setInspirations] = useState<AchievementCard[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [demoRes, inspirationRes] = await Promise.all([
        demosApi.list({
          page: 1,
          page_size: 12,
          search: demoFilters.search || undefined,
          difficulty: demoFilters.difficulty,
          subject: demoFilters.subject,
        } as DemoListQuery),
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
  }, [demoFilters, user]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const handleFilter = (filters: {
    search?: string;
    difficulty?: string;
    subject?: string;
  }) => {
    setDemoFilters(filters);
  };

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
            onClick={() => handleTabChange(tab.id)}
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

      {/* Filter row: 切换/筛选按钮 (仅 Demo 墙需要筛选) */}
      {activeTab === 'demos' && (
        <div className="flex justify-end">
          <Button
            variant={showFilter ? 'primary' : 'secondary'}
            onClick={() => setShowFilter((v) => !v)}
          >
            <Filter className="w-4 h-4 mr-2" />
            {showFilter ? '收起筛选' : '筛选'}
          </Button>
        </div>
      )}

      {/* DemoFilter: 筛选 + 搜索合一入口 */}
      {activeTab === 'demos' && showFilter && (
        <DemoFilter onFilter={handleFilter} initialFilters={demoFilters} />
      )}

      {/* Content */}
      {activeTab === 'demos' && (
        <DemosContent
          demos={demos}
          onOpenDemo={(demo) => navigate(`/explore/demos/${demo.id}`)}
        />
      )}
      {activeTab === 'courses' && <CoursesContent courses={courses} />}
      {activeTab === 'inspiration' && (
        <InspirationContent
          cards={inspirations}
          userId={user?.id}
          onFork={handleForkFromCard}
          onWithdraw={handleWithdraw}
          onOpenCard={(cardId) => navigate(`/explore/inspiration/${cardId}`)}
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

function DemosContent({
  demos,
  onOpenDemo,
}: {
  demos: Demo[];
  onOpenDemo: (demo: Demo) => void;
}) {
  if (demos.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500 text-lg mb-4">暂无 Demo</p>
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {demos.map((demo) => (
        <DemoCard
          key={demo.id}
          demo={demo}
          onFork={(d) => onOpenDemo(d)}
        />
      ))}
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
  onOpenCard,
}: {
  cards: AchievementCard[];
  userId?: string;
  onFork: (cardId: string) => void;
  onWithdraw: (cardId: string) => void;
  onOpenCard: (cardId: string) => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {cards.map((card) => {
        const cover = card.screenshots && card.screenshots.length > 0
          ? resolveImageUrl(card.screenshots[0]) : null;
        return (
        <Card key={card.id} hoverable className="overflow-hidden">
          {/* 封面与标题区域可点击查看详情 */}
          <div
            className="cursor-pointer"
            onClick={() => onOpenCard(card.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenCard(card.id);
              }
            }}
          >
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
          </div>
          <CardFooter className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => onFork(card.id)}>Fork</Button>
            {userId === card.author_id ? (
              <Button variant="secondary" className="flex-1" onClick={() => onWithdraw(card.id)}>撤回</Button>
            ) : (
              <Button variant="ghost" className="flex-1" onClick={() => onOpenCard(card.id)}>查看详情</Button>
            )}
          </CardFooter>
        </Card>
        );
      })}
    </div>
  );
}
