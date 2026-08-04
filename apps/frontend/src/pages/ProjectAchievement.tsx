import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { achievementCardsApi, notificationsApi, projectsApi } from '../services/api';
import { AchievementCard, AchievementCardUpdate, AchievementRecommendation, Project } from '../types';
import { AchievementCardView } from '../components/AchievementCardView';
import { CoverPicker } from '../components/CoverPicker';
import { MarkdownText } from '../components/MarkdownText';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { ArrowLeft, Share2, Copy, ExternalLink, Globe, EyeOff, FileText, Save, Wand2, Plus, X, Pencil, Check, Award, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from '../services/toast';

/**
 * 后端返回的 share_url 是相对路径（如 /share/xxx），<a href> 会自动基于当前 origin 解析，
 * 但直接复制相对路径粘贴到其他地方无法访问。此处拼上 origin 返回完整绝对 URL。
 * 若后端已返回绝对 URL（http/https 开头）则原样使用。
 */
function toAbsoluteShareUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function ProjectAchievement() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const wantCreate = searchParams.get('action') === 'create';
  const [achievement, setAchievement] = useState<AchievementCard | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingShare, setGeneratingShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recommendations, setRecommendations] = useState<AchievementRecommendation[]>([]);
  const [publishing, setPublishing] = useState(false);
  // 创建表单状态
  const [showCreateForm, setShowCreateForm] = useState(false);
  // AI 草稿状态（从 Markdown 文件解析的结构化数据）
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  // AI 一键生成成果卡状态（2026-08-04：与项目详情页"生成成果档案卡"主流程一致）
  const [generatingCard, setGeneratingCard] = useState(false);
  // 管理员通知作者补齐成果卡（admin 非本人项目场景）
  const [notifyingAuthor, setNotifyingAuthor] = useState(false);
  // 成果卡内联编辑状态（2026-08-04：已保存的卡支持编辑标签/字段）
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newTag, setNewTag] = useState('');
  const [cardSaving, setCardSaving] = useState(false);
  const [syncingTags, setSyncingTags] = useState(false);

  /** 保存成果卡字段（通用 PATCH） */
  const saveCardField = async (field: keyof AchievementCard, value: unknown) => {
    if (!achievement) return;
    setCardSaving(true);
    try {
      const res = await achievementCardsApi.update(achievement.id, { [field]: value } as AchievementCardUpdate);
      if (res.data) setAchievement(res.data);
    } catch {
      // ignore
    } finally {
      setCardSaving(false);
      setEditingField(null);
    }
  };

  /** 添加能力标签 */
  const addTag = (tag: string) => {
    if (!achievement) return;
    const t = tag.trim();
    if (!t) return;
    if ((achievement.capability_tags || []).includes(t)) return;
    saveCardField('capability_tags', [...(achievement.capability_tags || []), t]);
    setNewTag('');
  };

  /** 删除能力标签 */
  const removeTag = (tag: string) => {
    if (!achievement) return;
    saveCardField('capability_tags', (achievement.capability_tags || []).filter((t) => t !== tag));
  };

  /** 自动同步能力标签（拉取项目标签 + 兜底推荐） */
  const handleSyncTags = async () => {
    if (!achievement) return;
    setSyncingTags(true);
    try {
      const res = await achievementCardsApi.syncCapabilityTags(achievement.id);
      if (res.data) {
        setAchievement(res.data);
      }
    } catch {
      // ignore
    } finally {
      setSyncingTags(false);
    }
  };

  const loadAchievement = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setDraft(null); // 每次重新加载时重置草稿
      const [projectResponse, achievementResponse] = await Promise.allSettled([
        projectsApi.get(projectId),
        achievementCardsApi.getByProject(projectId),
      ]);
      if (projectResponse.status === 'fulfilled' && projectResponse.value.data) {
        setProject(projectResponse.value.data);
      }
      if (achievementResponse.status === 'fulfilled' && achievementResponse.value.data) {
        setAchievement(achievementResponse.value.data);
        const recRes = await achievementCardsApi.recommendations(achievementResponse.value.data.id);
        setRecommendations(recRes.data ?? []);
      } else {
        setAchievement(null);
        setRecommendations([]);
        // DB 无记录 → 检查 AI 是否已经生成了草稿文件
        try {
          const draftRes = await achievementCardsApi.getDraft(projectId);
          if (draftRes.data && typeof draftRes.data === 'object' && Object.keys(draftRes.data).length > 0) {
            setDraft(draftRes.data);
            setShowCreateForm(false);
          } else if (wantCreate) {
            setShowCreateForm(true);
          }
        } catch {
          // 草稿接口不可用时静默忽略
          if (wantCreate) {
            setShowCreateForm(true);
          }
        }
      }
    } catch (err) {
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps -- 异步加载成就卡数据，loadAchievement 依赖 projectId，无需重复触发 */
  useEffect(() => {
    if (!projectId) return;
    loadAchievement();
  }, [projectId]);
  /* eslint-enable react-hooks/exhaustive-deps */

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
      await navigator.clipboard.writeText(toAbsoluteShareUrl(shareUrl));
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

  /**
   * AI 一键生成成果档案卡（2026-08-04）
   * 与项目详情页 handleCreateAchievement、精选管理 handleGenerateCard 保持一致主流程：
   * 系统不存在"手动从空白起步建立成果卡"的正规入口，
   * 成果档案卡是根据项目历史（对话、文档、代码）自动化生成的。
   * 若 AI 生成失败，用户可退化到"手动填写"次要入口作为兜底。
   */
  const handleAIGenerateCard = async () => {
    if (!projectId || generatingCard) return;
    try {
      setGeneratingCard(true);
      const response = await projectsApi.generateAchievementCard(projectId);
      if (response.data) {
        setAchievement(response.data);
        setDraft(null);
        setShowCreateForm(false);
        // 生成成功后清除可能残留的 ?action=create
        navigate(`/research/projects/${projectId}/achievement`, { replace: true });
        return;
      }
      throw new Error(response.message || '成果档案卡生成失败');
    } catch (err) {
      console.error('[project_achievement:ai_generate] 自动生成失败:', err);
      const msg = err instanceof Error ? err.message : 'AI 生成失败，请稍后重试或使用手动填写';
      alert(msg);
    } finally {
      setGeneratingCard(false);
    }
  };

  /**
   * 管理员通知作者补齐成果卡（admin 非本人项目场景）：
   * 向项目作者发送 achievement_missing 通知，linkUrl 指向本页面。
   */
  const handleNotifyAuthor = async () => {
    if (!project || !projectId || notifyingAuthor) return;
    if (!project.author_id) {
      showToast('error', '无法获取项目作者信息');
      return;
    }
    setNotifyingAuthor(true);
    try {
      await notificationsApi.adminCreate({
        recipientId: project.author_id,
        type: 'achievement_missing',
        title: `请补齐项目「${project.name}」的成果档案卡`,
        content: '管理员希望您尽快补齐该项目的成果档案卡，以便进入 Demo 收录与精选流程。点击可直接前往设置。',
        relatedType: 'project',
        relatedId: projectId,
        linkUrl: `/research/projects/${projectId}/achievement`,
      });
      showToast('success', '已发送通知给作者');
    } catch {
      showToast('error', '发送通知失败，请稍后重试');
    } finally {
      setNotifyingAuthor(false);
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button variant="secondary" onClick={() => navigate(`/research/projects/${projectId}`)}>
            返回项目
          </Button>
        </div>
      </div>
    );
  }

  if (!achievement && !showCreateForm) {
    // 如果有 AI 生成的草稿，展示预览
    if (draft && project) {
      const draftTitle = (draft.title as string) || project.name;
      const draftOneLiner = (draft.one_liner as string) || project.description || '';
      const draftProblemSolved = (draft.problem_solved as string) || '';
      const draftMethodUsed = (draft.method_used as string) || '';
      const draftReflection = (draft.reflection as string) || '';
      const draftTags = (draft.capability_tags as string[]) || [];
      const draftSource = (draft.source as string) || 'auto_generated';
      const hasContent = !!(draftOneLiner || draftProblemSolved || draftMethodUsed || draftReflection);

      // 根据来源展示不同提示
      const sourceLabel: Record<string, { icon: React.ReactNode; title: string; hint: string }> = {
        markdown_file: {
          icon: <FileText className="h-5 w-5 text-teal-600" />,
          title: 'AI 已生成成果卡草稿',
          hint: 'AI 在工作台中根据项目文档自动整理了以下内容。请检查并确认保存。',
        },
        chat_history: {
          icon: <FileText className="h-5 w-5 text-teal-600" />,
          title: '从工作台对话中提取',
          hint: '从你在工作台与 AI 的对话中提取了成果卡信息。请核对并补充完善。',
        },
        auto_generated: {
          icon: <FileText className="h-5 w-5 text-amber-500" />,
          title: '自动生成的基础信息',
          hint: '项目已完成，系统根据项目信息自动生成了基础内容。你可以直接保存，或回到工作台让 AI 帮你补充细节。',
        },
      };
      const sourceInfo = sourceLabel[draftSource] || sourceLabel.auto_generated;

      const handleSaveDraft = async () => {
        try {
          setSavingDraft(true);
          const response = await achievementCardsApi.create(project.id, {
            title: draftTitle,
            one_liner: draftOneLiner,
            problem_solved: draftProblemSolved,
            method_used: draftMethodUsed,
            screenshots: [],
            reflection: draftReflection,
            capability_tags: draftTags,
            project_mode: project.mode,
          });
          if (response.data) {
            setAchievement(response.data);
            setDraft(null);
            navigate(`/research/projects/${projectId}/achievement`, { replace: true });
          }
        } catch (err) {
          alert(err instanceof Error ? err.message : '保存失败，请重试');
        } finally {
          setSavingDraft(false);
        }
      };

      return (
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-3xl mx-auto px-4">
            <Button variant="secondary" className="mb-6" onClick={() => navigate(`/research/projects/${projectId}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回项目
            </Button>

            <Card className="mb-6">
               <CardHeader>
                 <CardTitle className="flex items-center gap-2 text-lg">
                   {sourceInfo.icon}
                   {sourceInfo.title}
                 </CardTitle>
                 <p className="text-sm text-gray-500">{sourceInfo.hint}</p>
               </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700">项目名称</h4>
                  <p className="text-gray-900">{draftTitle}</p>
                </div>
                {draftOneLiner && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">一句话介绍</h4>
                    <MarkdownText content={draftOneLiner} projectId={projectId} />
                  </div>
                )}
                {draftProblemSolved && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">解决了什么问题</h4>
                    <MarkdownText content={draftProblemSolved} projectId={projectId} />
                  </div>
                )}
                {draftMethodUsed && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">用了什么方法</h4>
                    <MarkdownText content={draftMethodUsed} projectId={projectId} />
                  </div>
                )}
                {draftReflection && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">反思</h4>
                    <MarkdownText content={draftReflection} projectId={projectId} />
                  </div>
                )}
                {draftTags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">能力标签</h4>
                    <div className="flex flex-wrap gap-2">
                      {draftTags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {!hasContent && (
                  <p className="text-sm text-amber-600">
                    草稿内容解析后为空。AI 可能还在生成中，你可以回到工作台继续对话，或手动创建。
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSaveDraft} disabled={savingDraft || !hasContent} className="bg-teal-600 hover:bg-teal-700">
                <Save className="w-4 h-4 mr-2" />
                {savingDraft ? '保存中...' : '确认保存到成果卡'}
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/research/projects/${projectId}/achievement?action=create`)}>
                手动编辑后创建
              </Button>
              <Button variant="secondary" disabled title="请先保存为成果卡后再生成封面">
                <Wand2 className="w-4 h-4 mr-2" />
                生成封面
              </Button>
              <Button variant="ghost" onClick={() => navigate(`/research/projects/${projectId}`)}>
                去项目详情
              </Button>
              <Button variant="ghost" onClick={() => navigate('/research')}>
                返回研究列表
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // 无草稿 → 引导页（2026-08-04 调整：主 CTA 改为 AI 一键生成，与系统主流程保持一致）
    // 管理员非本人项目场景：隐藏 AI 生成/手动填写按钮，仅显示"通知作者补齐成果卡"入口
    const isAdmin = user?.role === 'admin';
    const isOwn = !!user && !!project && project.author_id === user.id;
    const adminForOthers = isAdmin && !isOwn && !!project;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-teal-600" />
              该项目还没有成果档案卡
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {adminForOthers ? (
              <>
                <p className="text-sm text-gray-600">
                  {`「${project!.name}」的成果档案卡需由项目作者本人（${project!.author_name || project!.author_id}）生成。作为管理员，你可以直接向作者发送通知，提醒其尽快补齐。`}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleNotifyAuthor}
                    disabled={notifyingAuthor}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    {notifyingAuthor ? '发送中...' : '通知作者补齐成果卡'}
                  </Button>
                  <Button variant="secondary" onClick={() => navigate(`/research/projects/${projectId}`)}>
                    去项目详情
                  </Button>
                  <Button variant="secondary" onClick={() => navigate('/admin/featured')}>
                    返回精选管理
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  {project
                    ? `「${project.name}」的成果档案卡由 AI 根据项目历史（工作台对话、文档与代码）自动生成。点击下方"AI 生成成果档案卡"，系统会一键整理出可分享的档案卡。`
                    : '成果档案卡由 AI 根据项目历史（工作台对话、文档与代码）自动生成。点击下方"AI 生成成果档案卡"，系统会一键整理出可分享的档案卡。'}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleAIGenerateCard}
                    disabled={generatingCard}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    {generatingCard ? 'AI 生成中...' : 'AI 生成成果档案卡'}
                  </Button>
                  <Button variant="secondary" onClick={() => navigate(`/research/projects/${projectId}`)}>
                    去项目详情
                  </Button>
                  <Button variant="secondary" onClick={() => navigate('/research')}>
                    返回研究列表
                  </Button>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2">若 AI 生成失败或希望手动填写：</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateForm(true)}
                    disabled={generatingCard}
                  >
                    <FileText className="w-3.5 h-3.5 mr-1" />
                    手动填写成果卡（兜底）
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // 创建表单（当 showCreateForm 为 true 且 achievement 不存在时显示）
  if (!achievement && showCreateForm && project) {
    return (
      <AchievementCreateForm
        project={project}
        onBack={() => setShowCreateForm(false)}
        onCreated={(card) => {
          setAchievement(card);
          setShowCreateForm(false);
          // 创建成功后清除 URL 上的 ?action=create
          navigate(`/research/projects/${projectId}/achievement`, { replace: true });
        }}
      />
    );
  }

  // 经过前面的 early return 后，到这里 achievement 必定存在；显式断言以通过 TS 严格模式
  if (!achievement) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <Button variant="secondary" className="mb-6" onClick={() => navigate(`/research/projects/${projectId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回项目
        </Button>

        <AchievementCardView achievement={achievement} />

        {/* 成果卡信息编辑（2026-08-04：已保存的卡支持内联编辑能力标签和关键字段） */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              成果卡信息
              {cardSaving && <span className="text-xs text-gray-400 font-normal">保存中...</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 能力标签：增删 + 自动同步 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">能力标签</label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="!text-xs"
                  disabled={syncingTags}
                  onClick={handleSyncTags}
                >
                  <Wand2 className="w-3.5 h-3.5 mr-1" />
                  {syncingTags ? '同步中...' : '自动同步能力标签'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {(achievement.capability_tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-xs"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="text-purple-400 hover:text-purple-600"
                      title="移除标签"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <div className="inline-flex items-center gap-1">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(newTag); } }}
                    placeholder="添加标签"
                    className="!h-8 !text-xs !w-28"
                  />
                  {newTag.trim() && (
                    <button
                      onClick={() => addTag(newTag)}
                      className="p-1 text-purple-600 hover:text-purple-800"
                      title="添加"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                能力标签用于 Demo 收录校验和首页展示。点"自动同步"可从项目能力标签 + 智能推荐补全。
              </p>
            </div>

            {/* 一句话介绍 */}
            <EditableField
              label="一句话介绍"
              value={achievement.one_liner}
              fieldKey="one_liner"
              editingField={editingField}
              editValue={editValue}
              onStartEdit={(field, val) => { setEditingField(field); setEditValue(val); }}
              onChange={setEditValue}
              onSave={(field) => saveCardField(field as keyof AchievementCard, editValue)}
              onCancel={() => setEditingField(null)}
            />
            {/* 我解决了什么问题 */}
            <EditableField
              label="我解决了什么问题"
              value={achievement.problem_solved}
              fieldKey="problem_solved"
              editingField={editingField}
              editValue={editValue}
              onStartEdit={(field, val) => { setEditingField(field); setEditValue(val); }}
              onChange={setEditValue}
              onSave={(field) => saveCardField(field as keyof AchievementCard, editValue)}
              onCancel={() => setEditingField(null)}
              multiline
            />
            {/* 我用了什么方法 */}
            <EditableField
              label="我用了什么方法"
              value={achievement.method_used}
              fieldKey="method_used"
              editingField={editingField}
              editValue={editValue}
              onStartEdit={(field, val) => { setEditingField(field); setEditValue(val); }}
              onChange={setEditValue}
              onSave={(field) => saveCardField(field as keyof AchievementCard, editValue)}
              onCancel={() => setEditingField(null)}
              multiline
            />
            {/* 反思 */}
            <EditableField
              label="我的反思"
              value={achievement.reflection}
              fieldKey="reflection"
              editingField={editingField}
              editValue={editValue}
              onStartEdit={(field, val) => { setEditingField(field); setEditValue(val); }}
              onChange={setEditValue}
              onSave={(field) => saveCardField(field as keyof AchievementCard, editValue)}
              onCancel={() => setEditingField(null)}
              multiline
            />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">封面图</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              {achievement.screenshots && achievement.screenshots.length > 0
                ? '当前已有封面图。可以选择项目运行截图、AI 生成或上传图片来更换。'
                : '选择封面来源：项目运行截图（默认）、AI 生成或上传图片。封面展示在灵感墙和首页精选区。'}
            </p>
            <CoverPicker card={achievement} projectId={projectId!} onUpdated={setAchievement} />
          </CardContent>
        </Card>

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
                    {toAbsoluteShareUrl(shareUrl)}
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

// 成果卡创建表单组件
function AchievementCreateForm({
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建失败';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <Button variant="secondary" className="mb-6" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
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
              <Button variant="secondary" disabled title="请先生成档案卡后再生成封面">
                <Wand2 className="w-4 h-4 mr-2" />
                生成封面
              </Button>
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

// 成果卡字段内联编辑组件
function EditableField({
  label,
  value,
  fieldKey,
  editingField,
  editValue,
  onStartEdit,
  onChange,
  onSave,
  onCancel,
  multiline = false,
}: {
  label: string;
  value: string;
  fieldKey: string;
  editingField: string | null;
  editValue: string;
  onStartEdit: (field: string, value: string) => void;
  onChange: (value: string) => void;
  onSave: (field: string) => void;
  onCancel: () => void;
  multiline?: boolean;
}) {
  const isEditing = editingField === fieldKey;
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {isEditing ? (
        <div className="space-y-2">
          {multiline ? (
            <textarea
              value={editValue}
              onChange={(e) => onChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm min-h-[80px] focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              autoFocus
            />
          ) : (
            <Input
              value={editValue}
              onChange={(e) => onChange(e.target.value)}
              autoFocus
            />
          )}
          <div className="flex gap-2">
            <Button size="sm" className="!bg-purple-600 hover:!bg-purple-700" onClick={() => onSave(fieldKey)}>
              <Check className="w-3.5 h-3.5 mr-1" />保存
            </Button>
            <Button size="sm" variant="secondary" onClick={onCancel}>取消</Button>
          </div>
        </div>
      ) : (
        <div
          className="group flex items-start gap-2 cursor-pointer rounded-lg hover:bg-gray-50 px-2 py-1.5 -mx-2"
          onClick={() => onStartEdit(fieldKey, value || '')}
        >
          <p className="text-sm text-gray-600 flex-1 whitespace-pre-wrap">{value || <span className="text-gray-400 italic">点击编辑</span>}</p>
          <Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-purple-500 mt-0.5 flex-shrink-0" />
        </div>
      )}
    </div>
  );
}
