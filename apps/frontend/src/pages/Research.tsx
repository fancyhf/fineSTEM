import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpDown, Check, Clock, Eye, FileText, Pencil, Play, Plus, Trash2, Trophy, X } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { projectsApi } from '../services/api';
import { Project } from '../types';

type SortMode = 'smart' | 'updated' | 'progress' | 'created';

const SORT_OPTIONS: Array<{ key: SortMode; label: string; icon: React.ReactNode; desc: string }> = [
  { key: 'smart', label: '综合排序', icon: <ArrowUpDown className="w-3.5 h-3.5" />, desc: '按进度+更新时间综合权重排序' },
  { key: 'updated', label: '最近更新', icon: <Clock className="w-3.5 h-3.5" />, desc: '按最后修改时间倒序' },
  { key: 'progress', label: '进度优先', icon: <ArrowDown className="w-3.5 h-3.5" />, desc: '按完成进度从高到低' },
  { key: 'created', label: '创建时间', icon: <ArrowRight className="w-3.5 h-3.5" />, desc: '按项目创建时间倒序' },
];

export function Research() {
  const [activeTab, setActiveTab] = useState<'in_progress' | 'completed'>('in_progress');
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('smart');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await projectsApi.list({ page: 1, page_size: 200 });
        if (!cancelled) setItems(res.data?.items ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 按阶段估算进度百分比（与卡片显示保持一致）
  const getProgressByStage = (stage?: string): number => {
    const stages = [
      'stage_00_bootstrap',
      'stage_01_brainstorm',
      'stage_02_brief',
      'stage_03_constraints',
      'stage_04_track',
      'stage_05_design',
      'stage_06_step_plan',
      'stage_07_execute',
      'stage_08_evaluate',
    ];
    const index = Math.max(stages.indexOf(stage ?? ''), 0);
    return Math.round(((index + 1) / stages.length) * 100);
  };

  const displayed = useMemo(() => {
    // 判断项目是否已完成：标准项目到 stage_08_evaluate，轻量项目到 step_3
    const isDone = (stage?: string) =>
      stage === 'stage_08_evaluate' || stage === 'step_3';
    const filtered = activeTab === 'completed'
      ? items.filter((item) => isDone(item.current_stage))
      : items.filter((item) => !isDone(item.current_stage));

    // 排序
    const now = Date.now();
    const sorted = [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'updated':
          // 最近更新优先
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'progress': {
          // 进度从高到低，进度相同按更新时间倒序
          const pa = getProgressByStage(a.current_stage);
          const pb = getProgressByStage(b.current_stage);
          if (pb !== pa) return pb - pa;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }
        case 'created':
          // 创建时间倒序
          return new Date(b.created_at || b.updated_at).getTime() - new Date(a.created_at || a.updated_at).getTime();
        case 'smart':
        default: {
          // 综合排序：进度（归一化到 0-1）×0.4 + 近度（最近更新）×0.6
          const pa = getProgressByStage(a.current_stage) / 100;
          const pb = getProgressByStage(b.current_stage) / 100;
          // 近度：1 / (1 + 距今天数)，越近越接近 1
          const daysA = (now - new Date(a.updated_at).getTime()) / 86400000;
          const daysB = (now - new Date(b.updated_at).getTime()) / 86400000;
          const ra = 1 / (1 + daysA);
          const rb = 1 / (1 + daysB);
          const scoreA = pa * 0.4 + ra * 0.6;
          const scoreB = pb * 0.4 + rb * 0.6;
          return scoreB - scoreA;
        }
      }
    });
    return sorted;
  }, [activeTab, items, sortMode]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">我的项目</h1>
        <Button onClick={() => navigate('/create')}>
          <Plus className="w-4 h-4 mr-2" />
          新建项目
        </Button>
      </div>

      <div className="flex space-x-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('in_progress')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'in_progress'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          进行中
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'completed'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          已完成
        </button>
      </div>

      {/* 排序选择器 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>共 {displayed.length} 个项目</span>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setSortMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            {SORT_OPTIONS.find((o) => o.key === sortMode)?.icon}
            <span>{SORT_OPTIONS.find((o) => o.key === sortMode)?.label}</span>
            <ArrowUpDown className="w-3 h-3 text-gray-400" />
          </button>
          {sortMenuOpen && (
            <>
              {/* 点击外部关闭 */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setSortMenuOpen(false)}
              />
              <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setSortMode(opt.key);
                      setSortMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-gray-50 transition-colors ${
                      sortMode === opt.key ? 'bg-teal-50 text-teal-700' : 'text-gray-700'
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">{opt.icon}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{opt.label}</span>
                      <span className="block text-xs text-gray-500">{opt.desc}</span>
                    </span>
                    {sortMode === opt.key && (
                      <Check className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">加载中...</div>
      ) : (
        <ProjectList
          items={displayed}
          completed={activeTab === 'completed'}
          onRename={(id, newName) => setItems(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p))}
          onDelete={(id) => setItems(prev => prev.filter(p => p.id !== id))}
        />
      )}
    </div>
  );
}

function ProjectList({ items, completed, onRename, onDelete }: { items: Project[]; completed: boolean; onRename: (id: string, newName: string) => void; onDelete: (id: string) => void }) {
  if (items.length === 0) {
    return <div className="text-sm text-gray-500">暂无项目</div>;
  }
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <ProjectCard
          key={item.id}
          item={item}
          completed={completed}
          onRename={(newName) => onRename(item.id, newName)}
          onDelete={() => onDelete(item.id)}
        />
      ))}
    </div>
  );
}

interface ProjectCardProps {
  item: Project;
  completed: boolean;
  onRename: (newName: string) => void;
  onDelete: () => void;
}

function getProgressByStage(stage?: string): number {
  const stages = [
    'stage_00_bootstrap',
    'stage_01_brainstorm',
    'stage_02_brief',
    'stage_03_constraints',
    'stage_04_track',
    'stage_05_design',
    'stage_06_step_plan',
    'stage_07_execute',
    'stage_08_evaluate',
  ];
  const index = Math.max(stages.indexOf(stage ?? ''), 0);
  return Math.round(((index + 1) / stages.length) * 100);
}

function ProjectCard({ item, completed, onRename, onDelete }: ProjectCardProps) {
  const navigate = useNavigate();
  const progress = completed ? 100 : getProgressByStage(item.current_stage);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [saving, setSaving] = useState(false);
  const [generatingAchievement, setGeneratingAchievement] = useState(false);
  const editInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditName(item.name);
      setTimeout(() => editInputRef.current?.focus(), 30);
    }
  }, [isEditing, item.name]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditName(item.name);
  };

  const saveEdit = async () => {
    const newName = editName.trim();
    if (!newName || newName === item.name) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      await projectsApi.update(item.id, { name: newName });
      onRename(newName);
      setIsEditing(false);
    } catch (err) {
      console.error('[research:rename] 改名失败:', err);
      alert('修改项目名称失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = async () => {
    const fallbackRestoreData: Record<string, unknown> = {
      projectId: item.id,
      projectName: item.name,
      mode: item.mode,
      currentStage: item.current_stage,
    };
    try {
      const workspaceRes = await projectsApi.getWorkspace(item.id);
      const restoreData: Record<string, unknown> = {
        projectId: item.id,
        projectName: item.name,
        mode: item.mode,
        currentStage: workspaceRes.data?.progress.current_stage || item.current_stage,
      };
      if (workspaceRes.data?.workspace) {
        restoreData.code = workspaceRes.data.workspace.code;
        restoreData.language = workspaceRes.data.workspace.language || 'python';
        restoreData.messages = workspaceRes.data.workspace.chat_messages || [];
      }
      sessionStorage.setItem('finestem_restore_project', JSON.stringify(restoreData));
      navigate('/create');
    } catch (error) {
      console.error('[research:continue] 恢复项目失败:', error);
      sessionStorage.setItem('finestem_restore_project', JSON.stringify(fallbackRestoreData));
      navigate('/create');
    }
  };

  /**
   * 为已完成项目直接生成成果卡，避免只进入对话但没有落库
   */
  const handleGenerateAchievement = async () => {
    try {
      setGeneratingAchievement(true);
      const response = await projectsApi.generateAchievementCard(item.id);
      if (response.data) {
        navigate(`/research/projects/${item.id}/achievement`);
        return;
      }
      throw new Error(response.message || '成果卡生成失败');
    } catch (error) {
      console.error('[research:generate_achievement] 自动生成失败:', error);
      alert(error instanceof Error ? error.message : '成果卡生成失败，请稍后重试');
    } finally {
      setGeneratingAchievement(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = confirm(`确定要删除项目「${item.name}」吗？\n\n项目 ID：${item.id}\n删除后将无法在项目列表中继续访问。`);
    if (!confirmed) return;
    try {
      await projectsApi.delete(item.id);
      onDelete();
    } catch (error) {
      console.error('[research:delete] 删除项目失败:', error);
      alert('删除项目失败，请重试');
    }
  };

  return (
    <Card hoverable>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 group">
              {isEditing ? (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void saveEdit();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    disabled={saving}
                    className="text-lg font-semibold text-gray-800 px-2 py-0.5 border border-teal-500 rounded outline-none focus:ring-2 focus:ring-teal-200 flex-1 min-w-0"
                    maxLength={100}
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void saveEdit(); }}
                    disabled={saving || !editName.trim()}
                    className="p-1 text-teal-600 hover:bg-teal-50 rounded disabled:opacity-50"
                    title="保存（Enter）"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                    disabled={saving}
                    className="p-1 text-gray-400 hover:bg-gray-100 rounded disabled:opacity-50"
                    title="取消（Esc）"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {item.name}
                  </h3>
                  <button
                    type="button"
                    onClick={startEdit}
                    className="p-1 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="修改项目名"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <Badge variant={completed ? 'success' : 'primary'}>
                {completed ? '已完成' : item.mode === 'standard' ? '标准研学' : '轻项目'}
              </Badge>
            </div>
            <p className="text-gray-600 mb-4">{item.description || '暂无描述'}</p>
            <p className="mb-3 text-xs text-gray-400 font-mono break-all">
              项目 ID：{item.id}
            </p>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">进度</span>
                <span className="text-sm text-gray-600">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <p className="text-sm text-gray-500">
              更新于 {new Date(item.updated_at).toLocaleString('zh-CN')}
            </p>
          </div>
          <div className="flex flex-col gap-2 ml-6 min-w-44 shrink-0">
            <Button className="w-full justify-center whitespace-nowrap" onClick={() => void handleContinue()}>
              <Play className="w-4 h-4 mr-1.5 shrink-0" />
              {completed ? '回到工作台' : '继续'}
            </Button>
            <Button variant="secondary" className="w-full justify-center whitespace-nowrap" onClick={() => navigate(`/research/projects/${item.id}`)}>
              <Eye className="w-4 h-4 mr-1.5 shrink-0" />
              项目详情
            </Button>
            <Button variant="secondary" className="w-full justify-center whitespace-nowrap text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-100 active:bg-red-100" onClick={() => void handleDelete()}>
              <Trash2 className="w-4 h-4 mr-1.5 shrink-0" />
              删除项目
            </Button>
            {completed && (
              <>
                <Button
                  variant="ghost"
                  className="w-full justify-center whitespace-nowrap"
                  onClick={() => void handleGenerateAchievement()}
                  disabled={generatingAchievement}
                >
                  <Trophy className="w-4 h-4 mr-1.5 shrink-0" />
                  {generatingAchievement ? '生成中...' : 'AI引导生成成果卡'}
                </Button>
                <Button variant="ghost" className="w-full justify-center whitespace-nowrap text-gray-400" onClick={() => navigate(`/research/projects/${item.id}/achievement`)}>
                  <FileText className="w-4 h-4 mr-1.5 shrink-0" />
                  查看已有成果卡
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
