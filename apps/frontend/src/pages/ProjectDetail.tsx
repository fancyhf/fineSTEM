import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ArrowLeft, Check, Download, FileText, Pencil, Sparkles, Trash2, Award, TrendingUp, Code, X, FolderOpen, Wand2, BookOpen, Star, Eye, EyeOff } from 'lucide-react';
import { projectsApi, achievementCardsApi, documentsApi, capabilityTagsApi } from '../services/api';
import { Project, ProjectProgress, AchievementCard } from '../types';
import { ProjectStageBar } from '../components/ProjectStageBar';
import { LightProjectSteps } from '../components/LightProjectSteps';
import { StandardProjectSteps } from '../components/StandardProjectSteps';
import { AchievementCardView } from '../components/AchievementCardView';
import { CoverPicker } from '../components/CoverPicker';
import { EvidencePanel } from '../components/EvidencePanel';
import { CapabilityRadarChart } from '../components/CapabilityRadarChart';
import { GrowthTimeline } from '../components/GrowthTimeline';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from '../services/toast';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [project, setProject] = useState<Project | null>(null);
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [achievement, setAchievement] = useState<AchievementCard | null>(null);
  const [achievementDraft, setAchievementDraft] = useState<Record<string, unknown> | null>(null);
  const [achievementDraftSource, setAchievementDraftSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [capabilityTags, setCapabilityTags] = useState<string[]>([]);
  const [downloading, setDownloading] = useState<string>('');
  const [generatingAchievement, setGeneratingAchievement] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  // 触发 CoverPicker 展开的信号（右侧菜单"设置/更换封面"按钮 → 滚动 + 自动展开）
  const [coverPickerSignal, setCoverPickerSignal] = useState(0);
  const [searchParams] = useSearchParams();
  const referredFile = searchParams.get('file');
  const [workspaceFilename, setWorkspaceFilename] = useState<string | null>(null);
  // 讲解回顾（2026-07-31）：讲解文档内容 + 查看弹窗
  const [explanationDoc, setExplanationDoc] = useState<string | null>(null);
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [fileBannerDismissed, setFileBannerDismissed] = useState(
    () => sessionStorage.getItem('finestem_filedismiss') === referredFile
  );
  // 精选状态操作 loading
  const [featuredLoading, setFeaturedLoading] = useState<string>('');
  // 在线查看文档（2026-08-11）：开题/技术/结题文档页面内阅读弹窗
  const [viewingDocument, setViewingDocument] = useState<{ type: 'proposal' | 'technical' | 'final'; title: string; markdown: string } | null>(null);
  const [viewDocLoading, setViewDocLoading] = useState(false);
  const documentTypeTitles: Record<'proposal' | 'technical' | 'final', string> = {
    proposal: '开题报告',
    technical: '技术报告',
    final: '结题报告',
  };

  // 当从聊天页带着 ?file= 参数跳入时，取 workspace 确认是否就是当前编辑的代码文件
  useEffect(() => {
    if (!referredFile || !id) return;
    projectsApi.getWorkspace(id).then((res) => {
      if (res.data?.workspace?.filename) {
        setWorkspaceFilename(res.data.workspace.filename);
      }
    }).catch(() => { /* workspace 获取失败不影响主线 */ });
  }, [referredFile, id]);

  const loadProjectData = async (projectId: string) => {
    try {
      setLoading(true);
      setAchievement(null);
      setAchievementDraft(null);
      setAchievementDraftSource(null);
      const [projectRes, progressRes, achievementRes, tagsRes] = await Promise.allSettled([
        projectsApi.get(projectId),
        projectsApi.getProgress(projectId),
        achievementCardsApi.getByProject(projectId),
        capabilityTagsApi.get(projectId),
      ]);

      if (projectRes.status === 'fulfilled' && projectRes.value.data) {
        setProject(projectRes.value.data);
      } else if (projectRes.status === 'rejected') {
        // 项目获取失败（404/403 等），设置错误信息
        const err = projectRes.reason;
        setError(err instanceof Error ? err.message : '项目不存在或无权访问');
        return;
      }
      if (progressRes.status === 'fulfilled' && progressRes.value.data) {
        setProgress(progressRes.value.data);
      }
      if (achievementRes.status === 'fulfilled' && achievementRes.value.data) {
        setAchievement(achievementRes.value.data);
      }
      if (
        (achievementRes.status !== 'fulfilled' || !achievementRes.value.data)
        && projectRes.status === 'fulfilled'
        && projectRes.value.data
      ) {
        try {
          const draftRes = await achievementCardsApi.getDraft(projectId);
          if (draftRes.data && typeof draftRes.data === 'object' && Object.keys(draftRes.data).length > 0) {
            setAchievementDraft(draftRes.data);
            setAchievementDraftSource(typeof draftRes.data.source === 'string' ? draftRes.data.source : null);
          }
        } catch {
          // 草稿读取失败不阻塞详情页主流程
        }
      }
      if (tagsRes.status === 'fulfilled' && tagsRes.value.data) {
        setCapabilityTags(tagsRes.value.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    loadProjectData(id);
  }, [id]);

  // 加载讲解文档（无内容/失败都静默，不阻塞详情页主流程）
  useEffect(() => {
    if (!id) return;
    projectsApi.getDocument(id, 'explanation').then((res) => {
      if (res.data?.has_content && res.data.content) {
        setExplanationDoc(res.data.content);
      }
    }).catch(() => { /* 讲解文档不存在时保持空态 */ });
  }, [id]);

  const handleDelete = async () => {
    if (!id || !confirm('确定要删除这个项目吗？')) return;

    try {
      await projectsApi.delete(id);
      navigate('/research');
    } catch (err) {
      console.error('[project:delete] 删除失败:', err);
      alert('删除项目失败，请重试');
    }
  };

  // 项目重命名
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const editNameInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && project) {
      setEditName(project.name);
      setTimeout(() => editNameInputRef.current?.focus(), 30);
    }
  }, [isEditingName, project]);

  const handleSaveName = async () => {
    const newName = editName.trim();
    if (!newName || !project || newName === project.name) {
      setIsEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await projectsApi.update(project.id, { name: newName });
      setProject({ ...project, name: newName });
      setIsEditingName(false);
    } catch (err) {
      console.error('[project:rename] 改名失败:', err);
      alert('修改项目名称失败，请重试');
    } finally {
      setSavingName(false);
    }
  };

  /**
   * 跳转到 AI 工作台，由 stem-pbl-guide 引导生成成果档案卡
   * 复用 workspace 恢复机制，附加 scene 标记
   */
  const handleCreateAchievement = async () => {
    if (!project?.id) return;
    try {
      setGeneratingAchievement(true);
      const response = await projectsApi.generateAchievementCard(project.id);
      if (response.data) {
        setAchievement(response.data);
        setAchievementDraft(null);
        setAchievementDraftSource(null);
        navigate(`/research/projects/${project.id}/achievement`);
        return;
      }
      throw new Error(response.message || '成果档案卡生成失败');
    } catch (error) {
      console.error('[project_detail:generate_achievement] 自动生成失败:', error);
      const msg = error instanceof Error ? error.message : '成果档案卡生成失败，请稍后重试';
      alert(msg);
    } finally {
      setGeneratingAchievement(false);
    }
  };

  const handleOpenAchievement = () => {
    if (!project?.id) return;
    navigate(`/research/projects/${project.id}/achievement`);
  };

  const hasActionableAchievementDraft = !!achievementDraft && achievementDraftSource !== 'auto_generated';

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

  // 在线查看文档：拉取 Markdown 文本在弹窗内阅读
  const handleViewDocument = async (documentType: 'proposal' | 'technical' | 'final') => {
    if (!project?.id) return;
    setViewDocLoading(true);
    try {
      const markdown = await documentsApi.view(project.id, documentType);
      setViewingDocument({ type: documentType, title: documentTypeTitles[documentType], markdown });
    } catch (err) {
      console.error('[project_detail:view_document] 加载失败:', err);
      alert('文档生成失败，请稍后重试');
    } finally {
      setViewDocLoading(false);
    }
  };

  // 在线预览 PDF：生成后在新窗口用浏览器原生查看器阅读
  const handlePreviewPdf = async (documentType: 'proposal' | 'technical' | 'final') => {
    if (!project?.id) return;
    try {
      const res = await documentsApi.generate(project.id, documentType, 'pdf');
      const url = URL.createObjectURL(res.blob);
      window.open(url, '_blank');
      // 延迟回收，避免预览窗口打开后资源被提前释放
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('[project_detail:preview_pdf] 生成失败:', err);
      alert('PDF 生成失败，请稍后重试');
    }
  };

  // Markdown 轻量渲染（仅支持标题/列表/正文，文本节点渲染无注入风险）
  const renderMarkdown = (md: string) => {
    return md.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-3" />;
      if (trimmed.startsWith('# ')) {
        return <h2 key={idx} className="text-lg font-semibold text-gray-900 mt-2 mb-2">{trimmed.slice(2)}</h2>;
      }
      if (trimmed.startsWith('## ')) {
        return <h3 key={idx} className="text-base font-semibold text-gray-800 mt-3 mb-1.5">{trimmed.slice(3)}</h3>;
      }
      if (trimmed.startsWith('- ')) {
        return (
          <div key={idx} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
            <span className="text-gray-400 flex-shrink-0">•</span>
            <span>{trimmed.slice(2)}</span>
          </div>
        );
      }
      return <p key={idx} className="text-sm text-gray-700 leading-relaxed">{trimmed}</p>;
    });
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
    const fallbackRestoreData: Record<string, unknown> = {
      projectId: project.id,
      projectName: project.name,
      mode: project.mode,
      currentStage: project.current_stage,
    };
    try {
      const workspaceRes = await projectsApi.getWorkspace(project.id);
      const restoreData: Record<string, unknown> = {
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
      sessionStorage.setItem('finestem_restore_project', JSON.stringify(fallbackRestoreData));
    }
    navigate('/create');
  };

  // 「AI 讲解代码」：复用进入工作台的恢复链路，附加 pending_action 让工作台自动发讲解提示词
  const handleExplainCode = async () => {
    sessionStorage.setItem('finestem_pending_action', 'explain');
    await handleEnterCodeEditor();
  };

  // ========== 精选管理操作（仅管理员/作者）==========
  // 数据源统一说明（2026-08-04）：
  //   - 精选作品、灵感墙均以 achievement_cards 为唯一真相源。
  //   - 精选 Demo 的管理已迁移至「精选管理页」的 demos 表收录流程，
  //     不再在项目详情页提供直接入口（避免与 demos 表脱节）。

  /** 切换精选作品状态（管理员）：作用于 achievement_cards.is_featured */
  const handleToggleFeaturedWork = async () => {
    if (!isAdmin || !achievement?.id) {
      showToast('error', '请先生成成果档案卡');
      return;
    }
    if (!achievement.is_public) {
      showToast('error', '仅可精选已发布到灵感墙的档案卡');
      return;
    }
    setFeaturedLoading('work');
    try {
      const newValue = !achievement.is_featured;
      const res = await achievementCardsApi.setFeatured(achievement.id, newValue, newValue ? 10 : 0);
      if (res.data) {
        setAchievement(res.data);
      } else {
        setAchievement({ ...achievement, is_featured: newValue });
      }
      showToast('success', newValue ? '已选入精选作品' : '已撤回精选作品');
    } catch (err) {
      showToast('error', '操作失败，请重试');
    } finally {
      setFeaturedLoading('');
    }
  };

  /** 切换灵感墙（公开）状态：作用于 achievement_cards.is_public */
  const handleToggleVisibility = async () => {
    if (!achievement?.id) {
      showToast('error', '请先生成成果档案卡');
      return;
    }
    // 只有作者或管理员可以操作
    const canModify = isAdmin || achievement.author_id === user?.id;
    if (!canModify) {
      showToast('error', '无权操作');
      return;
    }
    setFeaturedLoading('visibility');
    try {
      const willPublish = !achievement.is_public;
      const res = willPublish
        ? await achievementCardsApi.submitPublic(achievement.id)
        : await achievementCardsApi.withdrawPublic(achievement.id);
      if (res.data) {
        setAchievement(res.data);
      } else {
        setAchievement({ ...achievement, is_public: willPublish });
      }
      showToast('success', willPublish ? '已发布到灵感墙' : '已从灵感墙撤回');
    } catch (err) {
      showToast('error', '操作失败，请重试');
    } finally {
      setFeaturedLoading('');
    }
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
            onClick={() => navigate('/research')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* 头部 */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="secondary"
            onClick={() => navigate('/research')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  ref={editNameInputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleSaveName();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsEditingName(false);
                    }
                  }}
                  disabled={savingName}
                  className="text-2xl font-bold text-gray-900 px-2 py-1 border border-teal-500 rounded outline-none focus:ring-2 focus:ring-teal-200 flex-1 min-w-0"
                  maxLength={100}
                />
                <button
                  type="button"
                  onClick={() => void handleSaveName()}
                  disabled={savingName || !editName.trim()}
                  className="p-1.5 text-teal-600 hover:bg-teal-50 rounded disabled:opacity-50"
                  title="保存（Enter）"
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  disabled={savingName}
                  className="p-1.5 text-gray-400 hover:bg-gray-100 rounded disabled:opacity-50"
                  title="取消（Esc）"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-2xl font-bold text-gray-900 truncate">{project.name}</h1>
                <button
                  type="button"
                  onClick={() => {
                    setEditName(project.name);
                    setIsEditingName(true);
                  }}
                  className="p-1 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded opacity-50 group-hover:opacity-100 transition-opacity"
                  title="修改项目名"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
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
            <p className="mt-2 text-xs text-gray-400 font-mono break-all">
              项目 ID：{project.id}
            </p>
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

        {/* 来自聊天页的文件引用提示 */}
        {referredFile && !fileBannerDismissed && (
          <div className="mb-6 rounded-lg border border-teal-200 bg-teal-50 p-4 flex items-start gap-3">
            <FolderOpen className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-teal-800">
                AI 提到了文件「<span className="font-mono text-teal-900">{referredFile}</span>」
              </p>
              <p className="text-xs text-teal-600 mt-1">
                {workspaceFilename && (
                  workspaceFilename === referredFile ||
                  workspaceFilename.endsWith('/' + referredFile) ||
                  referredFile.endsWith('/' + workspaceFilename)
                ) ? (
                  '该文件是当前项目保存的代码文件，可进入编辑器查看。'
                ) : (
                  '项目完整资料（含代码、文档、证据）请在下方导出 ZIP 包获取。'
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {workspaceFilename && (
                  workspaceFilename === referredFile ||
                  workspaceFilename.endsWith('/' + referredFile) ||
                  referredFile.endsWith('/' + workspaceFilename)
                ) && (
                  <Button size="sm" onClick={handleEnterCodeEditor}>
                    <Code className="mr-1.5 h-3.5 w-3.5" />
                    进入代码编辑器
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleExportProject('zip')}
                  disabled={!!downloading}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  导出 ZIP 资料包
                </Button>
              </div>
            </div>
            <button
              onClick={() => {
                setFileBannerDismissed(true);
                sessionStorage.setItem('finestem_filedismiss', referredFile);
              }}
              className="flex-shrink-0 p-1 rounded hover:bg-teal-100 text-teal-500 hover:text-teal-700 transition-colors"
              title="关闭提示"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

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
          {/* 左侧主区域 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 项目流程步骤 */}
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
                  <CardTitle>{project.mode === 'light' ? '轻量项目流程' : '标准项目流程'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    项目阶段数据尚未初始化。你可以前往工作台开始项目，或点击下方"进入代码编辑器"继续编辑代码。
                  </p>
                  <Button
                    className="mt-4"
                    onClick={handleEnterCodeEditor}
                  >
                    <Code className="mr-2 h-4 w-4" />
                    进入代码编辑器
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* 导出与文档（从右侧边栏移下来） */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  导出与文档
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Button
                    variant="secondary"
                    className="justify-center"
                    onClick={() => void handleExportProject('pdf')}
                    disabled={!!downloading}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    结题PDF
                  </Button>
                  <Button
                    variant="secondary"
                    className="justify-center"
                    onClick={() => void handleExportProject('docx')}
                    disabled={!!downloading}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    结题DOCX
                  </Button>
                  <Button
                    variant="secondary"
                    className="justify-center"
                    onClick={() => void handleGenerateDocument('proposal', 'docx')}
                    disabled={!!downloading}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    开题DOCX
                  </Button>
                  <Button
                    variant="secondary"
                    className="justify-center"
                    onClick={() => void handleGenerateDocument('technical', 'docx')}
                    disabled={!!downloading}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    技术DOCX
                  </Button>
                </div>

                {/* 在线查看（2026-08-11）：无需下载，页面内直接阅读或新窗口预览 PDF */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    在线查看文档（点击在页面内阅读）
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      variant="secondary"
                      className="justify-center"
                      onClick={() => void handleViewDocument('proposal')}
                      disabled={viewDocLoading}
                    >
                      <BookOpen className="mr-2 h-4 w-4" />
                      开题报告
                    </Button>
                    <Button
                      variant="secondary"
                      className="justify-center"
                      onClick={() => void handleViewDocument('technical')}
                      disabled={viewDocLoading}
                    >
                      <BookOpen className="mr-2 h-4 w-4" />
                      技术报告
                    </Button>
                    <Button
                      variant="secondary"
                      className="justify-center"
                      onClick={() => void handleViewDocument('final')}
                      disabled={viewDocLoading}
                    >
                      <BookOpen className="mr-2 h-4 w-4" />
                      结题报告
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 能力标签与成长（从右侧边栏移下来） */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  能力标签与成长
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {capabilityTags.length ? capabilityTags.map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  )) : <span className="text-sm text-gray-500">暂无标签，点击"推荐能力标签"生成</span>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CapabilityRadarChart tags={capabilityTags} />
                  <GrowthTimeline progress={progress} />
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => void handleRecommendTags()}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  推荐能力标签
                </Button>
              </CardContent>
            </Card>

            {/* 证据面板（从右侧边栏移下来） */}
            <EvidencePanel projectId={project.id} />

            {/* 讲解回顾（从右侧边栏移下来） */}
            <Card data-testid="explanation-recap-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-teal-600" />
                  讲解回顾
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {explanationDoc ? (
                  <>
                    <p data-testid="explanation-recap-summary" className="text-xs text-gray-500">
                      已沉淀 {(explanationDoc.match(/^## /gm) || []).length} 段讲解，可随时回顾。
                    </p>
                    <div data-testid="explanation-recap-preview" className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600 whitespace-pre-wrap max-h-28 overflow-hidden">
                      {explanationDoc.replace(/^#+\s*/gm, '').slice(0, 160)}…
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" className="flex-1 justify-center" data-testid="view-explanation-doc" onClick={() => setShowExplanationModal(true)}>
                        <BookOpen className="mr-2 h-4 w-4" />
                        查看讲解
                      </Button>
                      <Button 
                        variant="secondary" 
                        className="flex-1 justify-center"
                        onClick={handleEnterCodeEditor}
                      >
                        <Code className="mr-2 h-4 w-4" />
                        继续学习
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 mb-3">暂无讲解记录</p>
                    <Button 
                      variant="secondary"
                      className="w-full justify-center"
                      onClick={handleEnterCodeEditor}
                    >
                      <Code className="mr-2 h-4 w-4" />
                      进入工作台学习
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右侧边栏 - 只保留核心操作 */}
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
                      onClick={handleOpenAchievement}
                    >
                      <Award className="mr-2 h-4 w-4" />
                      查看成果档案卡
                    </Button>
                  ) : hasActionableAchievementDraft ? (
                    <Button
                      className="w-full justify-start bg-amber-500 hover:bg-amber-600"
                      onClick={handleOpenAchievement}
                    >
                      <Award className="mr-2 h-4 w-4" />
                      查看成果卡草稿
                    </Button>
                  ) : (
                    <Button
                      className="w-full justify-start bg-teal-600 hover:bg-teal-700"
                      onClick={handleCreateAchievement}
                      disabled={generatingAchievement}
                    >
                      <Award className="mr-2 h-4 w-4" />
                      {generatingAchievement ? '生成中...' : '生成成果档案卡'}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    disabled={!achievement}
                    title={achievement ? '在下方成果卡预览区选择封面来源' : '请先创建成果卡后再设置封面'}
                    onClick={() => {
                      if (!achievement) return;
                      const el = document.getElementById('achievement-cover-picker');
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // 简短高亮提示用户封面选择器位置
                        el.classList.add('ring-2', 'ring-teal-400', 'rounded-xl');
                        setTimeout(() => el.classList.remove('ring-2', 'ring-teal-400', 'rounded-xl'), 1600);
                      }
                      // 滚动完成后触发 CoverPicker 自动展开（给浏览器一点时间完成滚动）
                      setTimeout(() => setCoverPickerSignal((n) => n + 1), 350);
                    }}
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    {achievement?.screenshots && achievement.screenshots.length > 0 ? '更换封面' : '设置封面'}
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => void handleExportProject('zip')}
                    disabled={!!downloading}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    导出项目ZIP
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 精选管理（仅管理员可见，且需已有档案卡） */}
            {isAdmin && project && (
              <Card className="border-purple-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-purple-700">
                    <Star className="h-4 w-4" />
                    精选管理
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {!achievement && (
                      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                        需先生成成果档案卡，并发布到灵感墙后才可精选。
                      </div>
                    )}
                    {achievement && !achievement.is_public && (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                        仅可精选已发布到灵感墙的档案卡。
                      </div>
                    )}
                    <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                      精选 Demo 管理已迁移至「精选管理页」，请在管理页中收录本项目为 Demo。
                    </div>
                    <Button
                      variant={achievement?.is_featured ? 'primary' : 'secondary'}
                      className={`w-full justify-start ${achievement?.is_featured ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                      onClick={handleToggleFeaturedWork}
                      disabled={!achievement || !achievement.is_public || featuredLoading === 'work'}
                    >
                      {featuredLoading === 'work' ? (
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      ) : (
                        <Award className="mr-2 h-4 w-4" />
                      )}
                      {achievement?.is_featured ? '已选入精选作品' : '选入精选作品'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 灵感墙发布（作者或管理员可见，需已有档案卡） */}
            {project && achievement && (isAdmin || achievement.author_id === user?.id) && (
              <Card className={achievement.is_public ? 'border-teal-200' : ''}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Eye className="h-4 w-4 text-teal-600" />
                    灵感墙
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">当前状态:</span>
                      <Badge variant={achievement.is_public ? 'success' : 'default'}>
                        {achievement.is_public ? '已发布' : '未发布'}
                      </Badge>
                    </div>
                    <Button
                      variant={achievement.is_public ? 'error' : 'success'}
                      className="w-full justify-start"
                      onClick={handleToggleVisibility}
                      disabled={featuredLoading === 'visibility'}
                    >
                      {featuredLoading === 'visibility' ? (
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      ) : achievement.is_public ? (
                        <EyeOff className="mr-2 h-4 w-4" />
                      ) : (
                        <Eye className="mr-2 h-4 w-4" />
                      )}
                      {achievement.is_public ? '从灵感墙撤回' : '发布到灵感墙'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 成果卡片预览 */}
            {achievement && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">成果档案卡预览</CardTitle>
                </CardHeader>
                <CardContent>
                  <AchievementCardView achievement={achievement} />
                  <div id="achievement-cover-picker" className="mt-4 pt-4 border-t border-gray-100 transition-all">
                    <CoverPicker card={achievement} projectId={project.id} onUpdated={setAchievement} openSignal={coverPickerSignal} />
                  </div>
                </CardContent>
              </Card>
            )}

            {!achievement && hasActionableAchievementDraft && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">成果档案卡草稿</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-600">
                    AI 已经整理出一份成果卡草稿，但还没有保存成正式成果档案卡。
                  </p>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    当前状态：有草稿待确认保存
                  </div>
                  <Button className="w-full" onClick={handleOpenAchievement}>
                    <Award className="mr-2 h-4 w-4" />
                    打开草稿并确认保存
                  </Button>
                  <Button variant="secondary" className="w-full" disabled title="请先保存为成果卡后再生成封面">
                    <Wand2 className="mr-2 h-4 w-4" />
                    生成封面
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* 讲解文档查看弹窗（渲染方式同 ProjectFilesPanel 文档查看） */}
      {showExplanationModal && explanationDoc && (
        <div
          data-testid="explanation-doc-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setShowExplanationModal(false); }}
        >
          <div className="w-[80vw] h-[80vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-teal-600" />
                讲解文档
              </span>
              <button
                data-testid="explanation-doc-modal-close"
                onClick={() => setShowExplanationModal(false)}
                className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-200 rounded"
              >
                关闭
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre data-testid="explanation-doc-modal-content" className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                {explanationDoc}
              </pre>
            </div>
          </div>
        </div>
      )}
    {/* 在线查看文档弹窗（2026-08-11）：开题/技术/结题 Markdown 渲染阅读，可新窗口预览 PDF */}
      {viewingDocument && (
        <div
          data-testid="project-doc-viewer-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setViewingDocument(null); }}
        >
          <div className="w-[80vw] h-[80vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-teal-600" />
                {viewingDocument.title}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handlePreviewPdf(viewingDocument.type)}
                >
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  新窗口预览 PDF
                </Button>
                <button
                  data-testid="project-doc-viewer-modal-close"
                  onClick={() => setViewingDocument(null)}
                  className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-200 rounded"
                >
                  关闭
                </button>
              </div>
            </div>
            <div data-testid="project-doc-viewer-content" className="flex-1 overflow-auto p-4">
              {renderMarkdown(viewingDocument.markdown)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
