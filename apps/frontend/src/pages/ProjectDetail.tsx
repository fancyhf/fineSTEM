import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ArrowLeft, Download, FileText, Sparkles, Trash2, Award, TrendingUp, Code } from 'lucide-react';
import { projectsApi, achievementCardsApi, documentsApi, capabilityTagsApi } from '../services/api';
import { Project, ProjectProgress, AchievementCard } from '../types';
import { ProjectStageBar } from '../components/ProjectStageBar';
import { LightProjectSteps } from '../components/LightProjectSteps';
import { StandardProjectSteps } from '../components/StandardProjectSteps';
import { AchievementCardView } from '../components/AchievementCardView';
import { EvidencePanel } from '../components/EvidencePanel';
import { CapabilityRadarChart } from '../components/CapabilityRadarChart';
import { GrowthTimeline } from '../components/GrowthTimeline';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [achievement, setAchievement] = useState<AchievementCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAchievementForm, setShowAchievementForm] = useState(false);
  const [capabilityTags, setCapabilityTags] = useState<string[]>([]);
  const [downloading, setDownloading] = useState<string>('');
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadProjectData(id);
  }, [id]);

  const loadProjectData = async (projectId: string) => {
    try {
      setLoading(true);
      const [projectRes, progressRes, achievementRes] = await Promise.allSettled([
        projectsApi.get(projectId),
        projectsApi.getProgress(projectId),
        achievementCardsApi.getByProject(projectId),
      ]);

      if (projectRes.status === 'fulfilled' && projectRes.value.data) {
        setProject(projectRes.value.data);
      }
      if (progressRes.status === 'fulfilled' && progressRes.value.data) {
        setProgress(progressRes.value.data);
      }
      if (achievementRes.status === 'fulfilled' && achievementRes.value.data) {
        setAchievement(achievementRes.value.data);
      }
      const tagsRes = await capabilityTagsApi.get(projectId);
      setCapabilityTags(tagsRes.data ?? []);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('确定要删除这个项目吗？')) return;
    
    try {
      await projectsApi.delete(id);
      navigate('/dashboard');
    } catch (err: any) {
      alert('删除失败：' + err.message);
    }
  };

  const handleCreateAchievement = () => {
    setShowAchievementForm(true);
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportProject = async (format: 'zip' | 'pdf' | 'docx') => {
    if (!project?.id) return;
    setDownloading(format);
    try {
      const res = await projectsApi.exportFile(project.id, format);
      downloadBlob(res.blob, res.fileName || `${project.id}.${format}`);
    } finally {
      setDownloading('');
    }
  };

  const handleGenerateDocument = async (
    documentType: 'proposal' | 'technical' | 'final',
    format: 'pdf' | 'docx',
  ) => {
    if (!project?.id) return;
    setDownloading(`${documentType}_${format}`);
    try {
      const res = await documentsApi.generate(project.id, documentType, format);
      downloadBlob(res.blob, res.fileName || `${project.id}_${documentType}.${format}`);
    } finally {
      setDownloading('');
    }
  };

  const handleRecommendTags = async () => {
    if (!project?.id) return;
    const res = await capabilityTagsApi.recommend(project.id);
    const tags = res.data?.tags ?? [];
    await capabilityTagsApi.apply(project.id, tags);
    setCapabilityTags(tags);
  };

  const handleUpgradeToStandard = async () => {
    if (!project?.id || !confirm('确定要将轻量项目升级为标准研学项目吗？升级后可使用完整的 9 阶段研究流程。')) return;
    setUpgrading(true);
    try {
      await projectsApi.upgrade(project.id, { confirm_upgrade: true });
      await loadProjectData(project.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '升级失败';
      alert(msg);
    } finally {
      setUpgrading(false);
    }
  };

  const handleEnterCodeEditor = async () => {
    if (!project?.id) return;
    try {
      const workspaceRes = await projectsApi.getWorkspace(project.id);
      const restoreData: Record<string, any> = {
        projectId: project.id,
        projectName: project.name,
        mode: project.mode,
        currentStage: workspaceRes.data?.progress.current_stage || project.current_stage,
      };
      if (workspaceRes.data?.workspace) {
        restoreData.code = workspaceRes.data.workspace.code;
        restoreData.language = workspaceRes.data.workspace.language || 'python';
        restoreData.messages = workspaceRes.data.workspace.chat_messages || [];
      }

      sessionStorage.setItem('finestem_restore_project', JSON.stringify(restoreData));
    } catch (err) {
      console.error('[handleEnterCodeEditor] 恢复数据失败:', err);
    }
    navigate('/create');
  };

  const getModeColor = (mode: string) => {
    return mode === 'light' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-32 bg-gray-200 rounded" />
            <div className="h-48 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <p className="text-red-600">{error || '项目不存在'}</p>
          <Button
            className="mt-4"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  if (showAchievementForm) {
    return (
      <ProjectAchievement 
        project={project}
        onBack={() => setShowAchievementForm(false)}
        onCreated={(card) => {
          setAchievement(card);
          setShowAchievementForm(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* 头部 */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="secondary"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Badge className={getModeColor(project.mode)}>
                {project.mode === 'light' ? '轻量项目' : '标准项目'}
              </Badge>
              {project.tech_stack?.map((tech, idx) => (
                <Badge key={idx} variant="outline">
                  {tech}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </Button>
          </div>
        </div>

        {/* 项目描述 */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <p className="text-gray-700">{project.description}</p>
          </CardContent>
        </Card>

        {/* 进度条 */}
        {progress && (
          <div className="mb-6">
            <ProjectStageBar
              currentStage={progress.current_stage}
              mode={project.mode}
            />
          </div>
        )}

        {/* 主要内容区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {project.mode === 'light' && progress ? (
              <LightProjectSteps
                progress={progress}
                onProgressUpdate={setProgress}
                onCreateAchievement={handleCreateAchievement}
              />
            ) : project.mode === 'standard' && progress ? (
              <StandardProjectSteps
                projectId={project.id}
                progress={progress}
                onProgressUpdate={setProgress}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>标准项目流程</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">标准项目流程开发中，敬请期待...</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {/* 快速操作 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">快速操作</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button
                    className="w-full justify-start bg-blue-600 hover:bg-blue-700"
                    onClick={handleEnterCodeEditor}
                  >
                    <Code className="mr-2 h-4 w-4" />
                    进入代码编辑器
                  </Button>
                  {project.mode === 'light' && (
                    <Button
                      className="w-full justify-start bg-purple-600 hover:bg-purple-700"
                      onClick={handleUpgradeToStandard}
                      disabled={upgrading}
                    >
                      <TrendingUp className="mr-2 h-4 w-4" />
                      {upgrading ? '升级中...' : '升级到标准研学'}
                    </Button>
                  )}
                  {achievement ? (
                    <Button
                      className="w-full justify-start"
                      onClick={() => navigate(`/research/projects/${id}/achievement`)}
                    >
                      <Award className="mr-2 h-4 w-4" />
                      查看成果档案卡
                    </Button>
                  ) : (
                    <Button
                      className="w-full justify-start bg-teal-600 hover:bg-teal-700"
                      onClick={handleCreateAchievement}
                    >
                      <Award className="mr-2 h-4 w-4" />
                      生成成果档案卡
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => void handleExportProject('zip')}
                    disabled={!!downloading}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    导出项目ZIP
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => void handleExportProject('pdf')}
                    disabled={!!downloading}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    导出结题PDF
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => void handleExportProject('docx')}
                    disabled={!!downloading}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    导出结题DOCX
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => void handleGenerateDocument('proposal', 'docx')}
                    disabled={!!downloading}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    生成开题DOCX
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => void handleGenerateDocument('technical', 'docx')}
                    disabled={!!downloading}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    生成技术DOCX
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => void handleRecommendTags()}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    推荐能力标签
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">能力标签</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {capabilityTags.length ? capabilityTags.map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  )) : <span className="text-sm text-gray-500">暂无标签，点击“推荐能力标签”生成</span>}
                </div>
                <CapabilityRadarChart tags={capabilityTags} />
                <GrowthTimeline progress={progress} />
              </CardContent>
            </Card>

            <EvidencePanel projectId={project.id} />

            {/* 成果卡片预览 */}
            {achievement && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">成果档案卡预览</CardTitle>
                </CardHeader>
                <CardContent>
                  <AchievementCardView achievement={achievement} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 成就卡片创建组件
function ProjectAchievement({
  project,
  onBack,
  onCreated,
}: {
  project: Project;
  onBack: () => void;
  onCreated: (achievement: AchievementCard) => void;
}) {
  const [title, setTitle] = useState(project.name);
  const [oneLiner, setOneLiner] = useState(project.description || '');
  const [problemSolved, setProblemSolved] = useState('');
  const [methodUsed, setMethodUsed] = useState('');
  const [reflection, setReflection] = useState('');
  const [tags, setTags] = useState<string[]>(project.tech_stack || []);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleCreate = async () => {
    try {
      setLoading(true);
      const response = await achievementCardsApi.create(project.id, {
        title,
        one_liner: oneLiner,
        problem_solved: problemSolved,
        method_used: methodUsed,
        screenshots: [],
        reflection,
        capability_tags: tags,
        project_mode: project.mode,
      });
      if (response.data) {
        onCreated(response.data);
      }
    } catch (err: any) {
      alert('创建失败：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <Button variant="secondary" className="mb-6" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回项目
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>生成成果档案卡</CardTitle>
            <p className="text-gray-600 text-sm">填写信息，生成你的项目成果档案卡</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">项目名称</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">一句话介绍</label>
              <textarea
                value={oneLiner}
                onChange={(e) => setOneLiner(e.target.value)}
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">我解决了什么问题</label>
              <textarea
                value={problemSolved}
                onChange={(e) => setProblemSolved(e.target.value)}
                placeholder="描述你最终完成了什么..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">我用了什么方法</label>
              <textarea
                value={methodUsed}
                onChange={(e) => setMethodUsed(e.target.value)}
                placeholder="描述你采用的方法和实现思路..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">我的反思</label>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="这个项目中你学到的关键点和改进想法..."
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">标签</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-red-500">×</button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="添加标签..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <Button variant="secondary" onClick={handleAddTag}>添加</Button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={onBack}>取消</Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                onClick={handleCreate}
                disabled={loading || !title || !oneLiner || !problemSolved || !methodUsed || !reflection}
              >
                {loading ? '创建中...' : '生成档案卡'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
