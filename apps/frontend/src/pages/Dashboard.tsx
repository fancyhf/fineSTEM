import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { 
  Plus, 
  FolderOpen, 
  Sparkles, 
  TrendingUp, 
  Clock, 
  Award,
  Calendar,
  ArrowRight,
  BookOpen,
  Code
} from 'lucide-react';
import { projectsApi, achievementCardsApi } from '../services/api';
import { Project, AchievementCard } from '../types';

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [achievements, setAchievements] = useState<AchievementCard[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsRes, achievementsRes] = await Promise.all([
        projectsApi.list({ page: 1, page_size: 5 }),
        achievementCardsApi.listPublic({ page: 1, page_size: 3 }),
      ]);
      
      if (projectsRes.data?.items) {
        setProjects(projectsRes.data.items);
      }
      if (achievementsRes.data?.items) {
        setAchievements(achievementsRes.data.items);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getModeColor = (mode: string) => {
    return mode === 'light' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                欢迎回来，{user.name}！
              </h1>
              <p className="text-gray-600 mt-1">
                继续您的 STEM 学习之旅，探索更多可能
              </p>
            </div>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => navigate('/create')}
            >
              <Plus className="mr-2 h-4 w-4" />
              创建新项目
            </Button>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">项目数量</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{projects.length}</p>
                  </div>
                  <div className="bg-teal-100 p-3 rounded-full">
                    <FolderOpen className="h-6 w-6 text-teal-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">学习天数</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">7</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-full">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">成就卡片</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{achievements.length}</p>
                  </div>
                  <div className="bg-yellow-100 p-3 rounded-full">
                    <Award className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">用户等级</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">Lv.{user.level}</p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-full">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 我的项目 */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">我的项目</h2>
              <Link
                to="/create"
                className="text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1"
              >
                查看全部 <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="space-y-4">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="animate-pulse space-y-3">
                        <div className="h-6 bg-gray-200 rounded w-3/4" />
                        <div className="h-4 bg-gray-200 rounded w-1/2" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : projects.length > 0 ? (
                projects.map((project) => (
                  <Link to={`/projects/${project.id}`} key={project.id}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900">{project.name}</h3>
                              <Badge className={getModeColor(project.mode)}>
                                {project.mode === 'light' ? '轻量' : '标准'}
                              </Badge>
                            </div>
                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                              {project.description}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {new Date(project.updated_at).toLocaleDateString('zh-CN')}
                              </span>
                              {project.tech_stack?.slice(0, 2).map((tech, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {tech}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">暂无项目</h3>
                    <p className="text-gray-600 mb-4">创建您的第一个 STEM 项目吧！</p>
                    <Button
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                      onClick={() => navigate('/create')}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      开始创建
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* 灵感墙 */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">灵感墙</h2>
              <Link
                to="/connect"
                className="text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1"
              >
                查看更多 <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="space-y-4">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="animate-pulse space-y-3">
                        <div className="h-6 bg-gray-200 rounded w-3/4" />
                        <div className="h-4 bg-gray-200 rounded w-1/2" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : achievements.length > 0 ? (
                achievements.map((achievement) => (
                  <Card key={achievement.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3">
                        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-3 rounded-lg">
                          <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">{achievement.title}</h3>
                          <p className="text-gray-600 text-sm line-clamp-2">
                            {achievement.one_liner}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {achievement.capability_tags.slice(0, 2).map((tag, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Sparkles className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-base font-medium text-gray-900 mb-1">暂无成就</h3>
                    <p className="text-gray-600 text-sm">完成项目后即可创建成就卡片</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* 快速操作 */}
            <div className="mt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">快速开始</h2>
              <div className="space-y-3">
                <Button
                  className="w-full justify-start bg-white text-gray-900 border hover:bg-gray-50"
                  onClick={() => navigate('/explore')}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  浏览示例项目
                </Button>
                <Button
                  className="w-full justify-start bg-white text-gray-900 border hover:bg-gray-50"
                  onClick={() => navigate('/create')}
                >
                  <Code className="mr-2 h-4 w-4" />
                  从零开始创建
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
