import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, FileText, Play, Plus, Trophy } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { projectsApi } from '../services/api';
import { Project } from '../types';

export function Research() {
  const [activeTab, setActiveTab] = useState<'in_progress' | 'completed'>('in_progress');
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
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

  const displayed = useMemo(() => {
    // 判断项目是否已完成：标准项目到 stage_08_evaluate，轻量项目到 step_3
    const isDone = (stage?: string) =>
      stage === 'stage_08_evaluate' || stage === 'step_3';
    if (activeTab === 'completed') {
      return items.filter((item) => isDone(item.current_stage));
    }
    return items.filter((item) => !isDone(item.current_stage));
  }, [activeTab, items]);

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

      {loading ? (
        <div className="text-sm text-gray-500">加载中...</div>
      ) : (
        <ProjectList items={displayed} completed={activeTab === 'completed'} />
      )}
    </div>
  );
}

function ProjectList({ items, completed }: { items: Project[]; completed: boolean }) {
  if (items.length === 0) {
    return <div className="text-sm text-gray-500">暂无项目</div>;
  }
  return <div className="space-y-4">{items.map((item) => <ProjectCard key={item.id} item={item} completed={completed} />)}</div>;
}

interface ProjectCardProps {
  item: Project;
  completed: boolean;
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

function ProjectCard({ item, completed }: ProjectCardProps) {
  const navigate = useNavigate();
  const progress = completed ? 100 : getProgressByStage(item.current_stage);

  const handleContinue = async () => {
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
      navigate(`/research/projects/${item.id}`);
    }
  };

  /**
   * 跳转到 AI 工作台生成成果卡
   * 与 handleContinue 相同的恢复机制，附加 scene 标记让 AI 知道要引导成果卡生成
   */
  const handleGenerateAchievement = async () => {
    try {
      const workspaceRes = await projectsApi.getWorkspace(item.id);
      const restoreData: Record<string, unknown> = {
        projectId: item.id,
        projectName: item.name,
        mode: item.mode,
        currentStage: workspaceRes.data?.progress.current_stage || item.current_stage,
        scene: 'generate_achievement',
      };
      if (workspaceRes.data?.workspace) {
        restoreData.code = workspaceRes.data.workspace.code;
        restoreData.language = workspaceRes.data.workspace.language || 'python';
        restoreData.messages = workspaceRes.data.workspace.chat_messages || [];
      }
      sessionStorage.setItem('finestem_restore_project', JSON.stringify(restoreData));
      navigate('/create');
    } catch (error) {
      console.error('[research:generate_achievement] 恢复项目失败:', error);
      navigate(`/research/projects/${item.id}`);
    }
  };

  return (
    <Card hoverable>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-800">
                {item.name}
              </h3>
              <Badge variant={completed ? 'success' : 'primary'}>
                {completed ? '已完成' : item.mode === 'standard' ? '标准研学' : '轻项目'}
              </Badge>
            </div>
            <p className="text-gray-600 mb-4">{item.description || '暂无描述'}</p>
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
            {completed && (
              <>
                <Button variant="ghost" className="w-full justify-center whitespace-nowrap" onClick={() => void handleGenerateAchievement()}>
                  <Trophy className="w-4 h-4 mr-1.5 shrink-0" />
                  AI引导生成成果卡
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
