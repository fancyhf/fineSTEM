import { ProjectProgress } from '../types';

interface GrowthTimelineProps {
  progress: ProjectProgress | null;
}

// 阶段 key → 中文标签映射（与 StandardProjectSteps / ProjectStageBar 对齐）
const STAGE_LABELS: Record<string, string> = {
  stage_00_bootstrap: '阶段 0：准备启动',
  stage_01_brainstorm: '阶段 1：脑暴选题',
  stage_02_brief: '阶段 2：开题立项',
  stage_03_constraints: '阶段 3：范围裁剪',
  stage_04_track: '阶段 4：轨道选择',
  stage_05_design: '阶段 5：设计蓝图',
  stage_06_step_plan: '阶段 6：分步计划',
  stage_07_execute: '阶段 7：执行开发',
  stage_08_evaluate: '阶段 8：评估展示',
  step_1: '步骤 1：想法与方向',
  step_2: '步骤 2：设计与实现',
  step_3: '步骤 3：展示与反思',
};

function formatStage(stage?: string) {
  if (!stage) return '未知阶段';
  // 优先查表命中中文标签
  if (STAGE_LABELS[stage]) return STAGE_LABELS[stage];
  // fallback：简单格式化（未识别的 key）
  return stage.replace('stage_', '阶段 ').replace(/_/g, ' ').trim();
}

function formatTime(iso?: string) {
  if (!iso) return '进行中';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', { hour12: false });
}

export function GrowthTimeline({ progress }: GrowthTimelineProps) {
  const history = (progress?.stage_history ?? []).filter((item) => !!item?.stage);

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
