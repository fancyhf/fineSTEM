import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { achievementCardsApi, projectsApi } from '../services/api';
import { AchievementCard, AchievementRecommendation, Project } from '../types';
import { AchievementCardView } from '../components/AchievementCardView';
import { MarkdownText } from '../components/MarkdownText';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ArrowLeft, Share2, Copy, ExternalLink, Globe, EyeOff, FileText, Save } from 'lucide-react';

export default function ProjectAchievement() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
        // 如果 URL 带 ?action=create 且没有 achievement，自动显示创建表单
        if (wantCreate) {
          setShowCreateForm(true);
        }
        // DB 无记录 → 检查 AI 是否已经生成了草稿文件
        try {
          const draftRes = await achievementCardsApi.getDraft(projectId);
          if (draftRes.data && typeof draftRes.data === 'object' && Object.keys(draftRes.data).length > 0) {
            setDraft(draftRes.data);
          }
        } catch {
          // 草稿接口不可用时静默忽略
        }
      }
    } catch (err) {
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- 异步加载成就卡数据，loadAchievement 依赖 projectId，无需重复触发 */
  useEffect(() => {
    if (!projectId) return;
    loadAchievement();
  }, [projectId]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

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

    // 无草稿 → 原有引导页
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle className="text-lg">还没有成果档案卡</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              {project ? `「${project.name}」已经可以从项目详情页回顾过程、导出代码和文档。完善成果说明后，就能生成可分享的成果档案卡。` : '项目详情页可以回顾过程、导出代码和文档，并生成可分享的成果档案卡。'}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setShowCreateForm(true)}>
                直接创建成果卡
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/research/projects/${projectId}`)}>
                去项目详情
              </Button>
              <Button variant="secondary" onClick={() => navigate('/research')}>
                返回研究列表
              </Button>
            </div>
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
