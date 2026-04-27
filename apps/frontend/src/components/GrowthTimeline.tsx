import { ProjectProgress } from '../types';

interface GrowthTimelineProps {
  progress: ProjectProgress | null;
}

function formatStage(stage: string) {
  return stage.replace('stage_', '阶段 ').replace(/_/g, ' ').trim();
}

function formatTime(iso?: string) {
  if (!iso) return '进行中';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', { hour12: false });
}

export function GrowthTimeline({ progress }: GrowthTimelineProps) {
  const history = progress?.stage_history ?? [];

  if (!history.length) {
    return (
      <div className="rounded-lg border border-gray-200 p-3">
        <div className="text-sm font-medium text-gray-700">成长时间线</div>
        <p className="text-xs text-gray-500 mt-2">暂无阶段记录，开始项目后会自动生成。</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="text-sm font-medium text-gray-700 mb-2">成长时间线</div>
      <ol className="space-y-3">
        {history.map((item, index) => (
          <li key={`${item.stage}-${item.started_at}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-500 mt-1" />
              {index < history.length - 1 && <span className="w-px flex-1 bg-gray-200 mt-1" />}
            </div>
            <div className="pb-2">
              <div className="text-sm font-medium text-gray-800">{formatStage(item.stage)}</div>
              <div className="text-xs text-gray-500">开始：{formatTime(item.started_at)}</div>
              <div className="text-xs text-gray-500">完成：{formatTime(item.completed_at)}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
