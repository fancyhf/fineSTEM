import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { demosApi, projectsApi } from '../services/api';
import { Demo, ForkTemplate, ProjectCreate } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { LightRegisterPrompt } from '../components/LightRegisterPrompt';

export default function ExploreDemoDetail() {
  const { demoId } = useParams<{ demoId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [demo, setDemo] = useState<Demo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forking, setForking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<'fork' | 'save' | null>(null);
  const [breakdown, setBreakdown] = useState<string>('');
  const [forkTemplate, setForkTemplate] = useState<ForkTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<'experience' | 'breakdown' | 'code'>('experience');
  const [selectedTemplateFile, setSelectedTemplateFile] = useState<string>('');

  const loadDemo = async () => {
    if (!demoId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await demosApi.get(demoId);
      if (response.data) {
        setDemo(response.data);
      }
      const breakdownRes = await demosApi.getBreakdown(demoId);
      setBreakdown(breakdownRes.data?.project_breakdown || '');
      const templateRes = await demosApi.getForkTemplate(demoId);
      const template = templateRes.data ?? null;
      setForkTemplate(template);
      if (template?.entry_file) {
        setSelectedTemplateFile(template.entry_file);
      } else if (template?.template_files) {
        const keys = Object.keys(template.template_files);
        setSelectedTemplateFile(keys[0] || '');
      }
    } catch (err) {
      console.error('Failed to load demo:', err);
      setError('加载 Demo 详情失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDemo();
  }, [demoId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const action = params.get('action');
    if (tab === 'breakdown' || tab === 'code' || tab === 'experience') {
      setActiveTab(tab);
    }
    if (action === 'save' && user && demo) {
      void handleSaveProject();
    }
  }, [location.search, user, demo]);

  const createProjectFromDemo = async (): Promise<string | null> => {
    if (!user) {
      setPendingAction('fork');
      setShowRegisterPrompt(true);
      return null;
    }
    if (!demo) return null;

    try {
      const projectData: ProjectCreate = {
        name: `${demo.name} - 我的版本`,
        description: demo.description,
        mode: 'light',
        from_demo_id: demo.id,
        tech_stack: demo.tech_stack,
        subjects: demo.subjects,
        display_mode: demo.display_mode,
      };

      const response = await projectsApi.create(projectData);
      if (response.data) {
        return response.data.id;
      }
    } catch (err) {
      console.error('Failed to fork demo:', err);
      setError('创建项目失败，请稍后重试');
      return null;
    }
    return null;
  };

  const handleFork = async () => {
    try {
      setForking(true);
      const projectId = await createProjectFromDemo();
      if (projectId) {
        navigate(`/research/projects/${projectId}`);
      }
    } finally {
      setForking(false);
    }
  };

  const handleSaveProject = async () => {
    if (!user) {
      setPendingAction('save');
      setShowRegisterPrompt(true);
      return;
    }
    try {
      setSaving(true);
      const projectId = await createProjectFromDemo();
      if (projectId) {
        navigate('/research');
      }
    } finally {
      setSaving(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  useEffect(() => {
    if (user && pendingAction) {
      const action = pendingAction;
      setPendingAction(null);
      setShowRegisterPrompt(false);
      if (action === 'fork') void handleFork();
      else if (action === 'save') void handleSaveProject();
    }
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

  if (error || !demo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Demo 不存在'}</p>
          <Button variant="secondary" onClick={() => navigate('/explore/demos')}>
            返回 Demo 列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <Button
          variant="secondary"
          className="mb-6"
          onClick={() => navigate('/explore/demos')}
        >
          ← 返回 Demo 列表
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge className={getDifficultyColor(demo.difficulty)}>
                    {demo.difficulty === 'beginner' ? '入门' : demo.difficulty === 'intermediate' ? '中级' : '高级'}
                  </Badge>
                  {demo.subjects.map((subject, idx) => (
                    <Badge key={idx} variant="secondary">
                      {subject}
                    </Badge>
                  ))}
                </div>
                <CardTitle className="text-3xl">{demo.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 text-lg mb-6">{demo.description}</p>

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">技术栈</h3>
                  <div className="flex flex-wrap gap-2">
                    {demo.tech_stack.map((tech, idx) => (
                      <Badge key={idx} variant="secondary">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>

                {demo.tags.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">标签</h3>
                    <div className="flex flex-wrap gap-2">
                      {demo.tags.map((tag, idx) => (
                        <Badge key={idx} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t border-gray-100">
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => setActiveTab('experience')}
                  >
                    试玩
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => setActiveTab('breakdown')}
                  >
                    看拆解
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
                      variant={activeTab === 'experience' ? 'primary' : 'secondary'}
                      onClick={() => setActiveTab('experience')}
                    >
                      体验
                    </Button>
                    <Button
                      size="sm"
                      variant={activeTab === 'breakdown' ? 'primary' : 'secondary'}
                      onClick={() => setActiveTab('breakdown')}
                    >
                      拆解
                    </Button>
                    <Button
                      size="sm"
                      variant={activeTab === 'code' ? 'primary' : 'secondary'}
                      onClick={() => setActiveTab('code')}
                    >
                      代码
                    </Button>
                  </div>

                  {activeTab === 'experience' && (
                    <div className="p-4 bg-gray-50 border rounded-lg">
                      {(demo.iframe_url || demo.content_url) ? (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-600">可通过新窗口体验完整 Demo 运行效果。</p>
                          <Button
                            variant="secondary"
                            onClick={() => window.open(demo.iframe_url || demo.content_url, '_blank')}
                          >
                            打开体验窗口
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">当前 Demo 无在线体验地址，请查看拆解与代码说明。</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'breakdown' && (
                    <div className="p-4 bg-gray-50 border rounded-lg space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">项目拆解</h3>
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{breakdown || '暂无拆解内容'}</pre>
                      </div>
                      {forkTemplate && (
                        <div className="pt-3 border-t border-gray-200 space-y-3">
                          <h4 className="text-base font-semibold text-gray-900">最小可改版建议</h4>
                          <p className="text-sm text-gray-700">{forkTemplate.default_goal}</p>
                          <div>
                            <p className="text-sm font-medium text-gray-800 mb-1">你可以改这里：</p>
                            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                              {forkTemplate.editable_markers.map((marker) => (
                                <li key={marker}>{marker}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800 mb-1">改动建议：</p>
                            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                              {forkTemplate.suggestions.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'code' && (
                    <div className="p-4 bg-gray-50 border rounded-lg space-y-3">
                      <p className="text-sm text-gray-600">代码与模板资源：</p>
                      <div className="flex flex-wrap gap-2">
                        {demo.code_url && (
                          <Button size="sm" variant="secondary" onClick={() => window.open(demo.code_url, '_blank')}>
                            查看代码
                          </Button>
                        )}
                        {demo.download_url && (
                          <Button size="sm" variant="secondary" onClick={() => window.open(demo.download_url, '_blank')}>
                            下载源码
                          </Button>
                        )}
                      </div>
                      {forkTemplate?.skeleton_code && (
                        <p className="text-xs text-gray-500">
                          模板骨架位置：{forkTemplate.skeleton_code}
                        </p>
                      )}
                      {!!forkTemplate?.template_files && (
                        <div className="space-y-2 pt-2 border-t border-gray-200">
                          <p className="text-sm font-medium text-gray-800">Fork 模板文件</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.keys(forkTemplate.template_files).map((filePath) => (
                              <Button
                                key={filePath}
                                size="sm"
                                variant={selectedTemplateFile === filePath ? 'primary' : 'secondary'}
                                onClick={() => setSelectedTemplateFile(filePath)}
                              >
                                {filePath}
                              </Button>
                            ))}
                          </div>
                          {selectedTemplateFile && (
                            <pre className="text-xs bg-slate-900 text-slate-100 rounded-md p-3 overflow-auto max-h-80">
                              {forkTemplate.template_files[selectedTemplateFile]}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>项目信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">查看次数</span>
                  <span className="font-medium">{demo.view_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">创建时间</span>
                  <span className="font-medium">
                    {new Date(demo.created_at).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">更新时间</span>
                  <span className="font-medium">
                    {new Date(demo.updated_at).toLocaleDateString('zh-CN')}
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
        description="登录或轻注册后，即可从 Demo 创建你自己的项目。"
        onClose={() => { setShowRegisterPrompt(false); setPendingAction(null); }}
      />
    </div>
  );
}
