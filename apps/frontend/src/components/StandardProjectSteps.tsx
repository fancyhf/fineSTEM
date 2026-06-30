import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectProgress, StandardProjectStepData } from '../types';
import { projectsApi } from '../services/api';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import {
  Stage00Bootstrap,
  Stage01Brainstorm,
  Stage02Brief,
  Stage03Constraints,
  Stage04Track,
  Stage05Design,
  Stage06StepPlan,
  Stage07Execute,
  Stage08Evaluate,
  Stage00Payload,
  Stage01Payload,
  Stage02Payload,
  Stage03Payload,
  Stage04Payload,
  Stage05Payload,
  Stage06Payload,
  Stage07Payload,
  Stage08Payload,
} from './standardStages';

interface StandardProjectStepsProps {
  projectId: string;
  progress: ProjectProgress;
  onProgressUpdate?: (progress: ProjectProgress) => void;
}

interface StandardStageConfig {
  step: number;
  stageId: string;
  label: string;
  gain: string;
  minimumDone: string;
  aiSupport: string;
}

const STANDARD_STAGES: StandardStageConfig[] = [
  { step: 0, stageId: 'stage_00_bootstrap', label: '第 1 阶段：准备阶段', gain: '明确项目背景、目标和边界。', minimumDone: '目标、资源与限制条件已经写清楚。', aiSupport: 'AI 可以帮你生成检查清单和风险提示。' },
  { step: 1, stageId: 'stage_01_brainstorm', label: '第 2 阶段：脑暴选题', gain: '选出最值得投入的项目方向。', minimumDone: '已有候选主题，并确定最终选题。', aiSupport: 'AI 可以扩展选项并比较取舍。' },
  { step: 2, stageId: 'stage_02_brief', label: '第 3 阶段：开题立项', gain: '形成可执行的项目简述。', minimumDone: '问题、用户和成功标准已经定义。', aiSupport: 'AI 可以收敛范围并完善验收标准。' },
  { step: 3, stageId: 'stage_03_constraints', label: '第 4 阶段：范围裁剪', gain: '锁定 MVP 范围。', minimumDone: '必做、选做、不做事项已经明确。', aiSupport: 'AI 可以提醒过度设计和延期风险。' },
  { step: 4, stageId: 'stage_04_track', label: '第 5 阶段：轨道选择', gain: '确定实现路线和技术栈。', minimumDone: '轨道、工具链和依赖已经确认。', aiSupport: 'AI 可以给出路线成本对比。' },
  { step: 5, stageId: 'stage_05_design', label: '第 6 阶段：设计蓝图', gain: '完成模块计划和验收检查。', minimumDone: '模块、数据流和验收条件已经完整。', aiSupport: 'AI 可以建议架构、接口和页面结构。' },
  { step: 6, stageId: 'stage_06_step_plan', label: '第 7 阶段：分步计划', gain: '拆出可执行的任务序列。', minimumDone: '执行步骤、检查点和回退方案清楚。', aiSupport: 'AI 可以把任务拆成更小的步骤。' },
  { step: 7, stageId: 'stage_07_execute', label: '第 8 阶段：执行开发', gain: '交付实现并留下证据。', minimumDone: '里程碑、问题记录和证据链接已经整理。', aiSupport: 'AI 可以协助调试、生成代码和排障。' },
  { step: 8, stageId: 'stage_08_evaluate', label: '第 9 阶段：评估展示', gain: '完成验收总结和下一轮迭代计划。', minimumDone: '验收总结和反思已经完成。', aiSupport: 'AI 可以帮你整理展示稿和复盘。' },
];

function resolveActiveStep(currentStage: string): number {
  const found = STANDARD_STAGES.find((stage) => stage.stageId === currentStage);
  return found ? found.step : 0;
}

type StagePayloadMap = {
  0: Stage00Payload;
  1: Stage01Payload;
  2: Stage02Payload;
  3: Stage03Payload;
  4: Stage04Payload;
  5: Stage05Payload;
  6: Stage06Payload;
  7: Stage07Payload;
  8: Stage08Payload;
};

function createDefaultPayload(step: number): Record<string, unknown> {
  switch (step) {
    case 0:
      return { project_goal: '', known_resources: '', constraints: '' } satisfies Stage00Payload;
    case 1:
      return { candidate_topics: [], selected_topic: '', selection_reason: '' } satisfies Stage01Payload;
    case 2:
      return { problem_statement: '', target_user: '', success_criteria: [] } satisfies Stage02Payload;
    case 3:
      return { must_have: [], nice_to_have: [], wont_do: [] } satisfies Stage03Payload;
    case 4:
      return { selected_track: 'web', tool_chain: [], dependencies: [] } satisfies Stage04Payload;
    case 5:
      return { module_list: [], data_flow: '', acceptance_criteria: [] } satisfies Stage05Payload;
    case 6:
      return { execution_steps: [], check_points: [], rollback_plan: '' } satisfies Stage06Payload;
    case 7:
      return { milestones: [], issue_log: [], evidence_links: [] } satisfies Stage07Payload;
    case 8:
      return { acceptance_summary: '', reflection: '', next_iteration: '' } satisfies Stage08Payload;
    default:
      return {};
  }
}

function parseLegacyContent(content?: string | null): { goal: string; outputs: string; notes: string } {
  if (!content || !content.trim()) {
    return { goal: '', outputs: '', notes: '' };
  }
  try {
    const parsed = JSON.parse(content) as { goal?: string; outputs?: string; notes?: string };
    return {
      goal: parsed.goal ?? '',
      outputs: parsed.outputs ?? '',
      notes: parsed.notes ?? '',
    };
  } catch {
    return { goal: '', outputs: '', notes: content };
  }
}

function normalizeStandardStep(step: number, raw: StandardProjectStepData | undefined): StandardProjectStepData {
  const defaultPayload = createDefaultPayload(step);
  if (!raw) {
    return { schema_version: '2.0.0', payload: defaultPayload };
  }

  const hasPayload = raw.payload && typeof raw.payload === 'object';
  if (hasPayload) {
    return {
      schema_version: raw.schema_version ?? '2.0.0',
      goal: raw.goal,
      outputs: raw.outputs,
      notes: raw.notes,
      payload: { ...defaultPayload, ...raw.payload },
      content: raw.content,
    };
  }

  const legacy = parseLegacyContent(raw.content);
  const migratedPayload = { ...defaultPayload };
  if (step === 0) {
    (migratedPayload as unknown as Stage00Payload).project_goal = legacy.goal;
    (migratedPayload as unknown as Stage00Payload).known_resources = legacy.outputs;
    (migratedPayload as unknown as Stage00Payload).constraints = legacy.notes;
  }

  return {
    schema_version: '2.0.0',
    goal: legacy.goal,
    outputs: legacy.outputs,
    notes: legacy.notes,
    payload: migratedPayload,
    content: raw.content,
  };
}

function isReady(step: number, payload: Record<string, unknown>): boolean {
  switch (step) {
    case 0:
      return Boolean((payload.project_goal as string)?.trim() && (payload.known_resources as string)?.trim());
    case 1:
      return ((payload.candidate_topics as string[] | undefined)?.length ?? 0) > 0 && Boolean((payload.selected_topic as string)?.trim());
    case 2:
      return Boolean((payload.problem_statement as string)?.trim() && (payload.target_user as string)?.trim());
    case 3:
      return ((payload.must_have as string[] | undefined)?.length ?? 0) > 0;
    case 4:
      return Boolean((payload.selected_track as string)?.trim() && ((payload.tool_chain as string[] | undefined)?.length ?? 0) > 0);
    case 5:
      return ((payload.module_list as string[] | undefined)?.length ?? 0) > 0;
    case 6:
      return ((payload.execution_steps as string[] | undefined)?.length ?? 0) > 0;
    case 7:
      return ((payload.milestones as string[] | undefined)?.length ?? 0) > 0;
    case 8:
      return Boolean((payload.acceptance_summary as string)?.trim() && (payload.reflection as string)?.trim());
    default:
      return false;
  }
}

export function StandardProjectSteps({ projectId, progress, onProgressUpdate }: StandardProjectStepsProps) {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState<number>(resolveActiveStep(progress.current_stage));
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [assisting, setAssisting] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [contents, setContents] = useState<Record<number, StandardProjectStepData>>({});

  // 同步 activeStep：progress 变化时更新当前阶段，同时保留用户手动切换 tab 的能力
  useEffect(() => {
    setActiveStep(resolveActiveStep(progress.current_stage));
  }, [progress.current_stage]);

  const stageMap = useMemo(() => {
    const mapped: Record<number, StandardProjectStepData> = {};
    STANDARD_STAGES.forEach((stage) => {
      const key = `step${stage.step}`;
      mapped[stage.step] = normalizeStandardStep(stage.step, progress.standard_step_data?.[key]);
    });
    return mapped;
  }, [progress.standard_step_data]);

  // 同步 contents：stageMap 变化时（切换项目等），重置本地编辑副本
  useEffect(() => {
    setContents(stageMap);
  }, [stageMap]);

  const activeStage = STANDARD_STAGES.find((stage) => stage.step === activeStep) ?? STANDARD_STAGES[0];
  const isFinalStage = progress.current_stage === 'stage_08_evaluate';
  const activeData = contents[activeStage.step] ?? { schema_version: '2.0.0', payload: createDefaultPayload(activeStage.step) };

  const updatePayload = <S extends keyof StagePayloadMap>(step: S, payload: StagePayloadMap[S]) => {
    setContents((prev) => ({
      ...prev,
      [step]: {
        ...(prev[step] ?? { schema_version: '2.0.0' }),
        schema_version: '2.0.0',
        payload,
      },
    }));
  };

  const buildRequestData = (step: number): StandardProjectStepData => {
    const data = contents[step] ?? { schema_version: '2.0.0', payload: createDefaultPayload(step) };
    return {
      schema_version: '2.0.0',
      goal: data.goal,
      outputs: data.outputs,
      notes: data.notes,
      payload: data.payload ?? createDefaultPayload(step),
    };
  };

  const handleSaveCurrent = async () => {
    try {
      setSaving(true);
      setSavedMessage('');
      const response = await projectsApi.saveStandardStep(projectId, activeStage.step, buildRequestData(activeStage.step));
      if (response.data) {
        onProgressUpdate?.(response.data);
      }
      setSavedMessage('当前阶段已保存。');
    } catch {
      setSavedMessage('保存失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  const handleAdvance = async () => {
    if (isFinalStage) {
      return;
    }
    if (!isReady(activeStage.step, (activeData.payload ?? {}) as Record<string, unknown>)) {
      setSavedMessage('请先补全当前阶段的必填内容，再推进到下一阶段。');
      return;
    }
    try {
      setAdvancing(true);
      setSavedMessage('');
      const saved = await projectsApi.saveStandardStep(projectId, activeStage.step, buildRequestData(activeStage.step));
      if (saved.data) {
        onProgressUpdate?.(saved.data);
      }
      const response = await projectsApi.advanceStage(projectId);
      if (response.data) {
        onProgressUpdate?.(response.data);
      }
      setSavedMessage('已推进到下一阶段。');
    } catch {
      setSavedMessage('推进失败，请重试。');
    } finally {
      setAdvancing(false);
    }
  };

  const renderStageForm = (step: number, payload: Record<string, unknown>) => {
    switch (step) {
      case 0:
        return <Stage00Bootstrap value={payload as unknown as Stage00Payload} onChange={(next) => updatePayload(0, next)} />;
      case 1:
        return <Stage01Brainstorm value={payload as unknown as Stage01Payload} onChange={(next) => updatePayload(1, next)} />;
      case 2:
        return <Stage02Brief value={payload as unknown as Stage02Payload} onChange={(next) => updatePayload(2, next)} />;
      case 3:
        return <Stage03Constraints value={payload as unknown as Stage03Payload} onChange={(next) => updatePayload(3, next)} />;
      case 4:
        return <Stage04Track value={payload as unknown as Stage04Payload} onChange={(next) => updatePayload(4, next)} />;
      case 5:
        return <Stage05Design value={payload as unknown as Stage05Payload} onChange={(next) => updatePayload(5, next)} />;
      case 6:
        return <Stage06StepPlan value={payload as unknown as Stage06Payload} onChange={(next) => updatePayload(6, next)} />;
      case 7:
        return <Stage07Execute value={payload as unknown as Stage07Payload} onChange={(next) => updatePayload(7, next)} />;
      case 8:
        return <Stage08Evaluate value={payload as unknown as Stage08Payload} onChange={(next) => updatePayload(8, next)} />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>标准研学流程</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {STANDARD_STAGES.map((stage) => {
            const isCurrent = stage.step === activeStep;
            const isDone = stage.step < activeStep;
            return (
              <button key={stage.stageId} type="button" onClick={() => setActiveStep(stage.step)} className="text-left">
                <Badge variant={isCurrent ? 'primary' : isDone ? 'success' : 'secondary'}>
                  {stage.step + 1}. {stage.label.replace(/^第 \d+ 阶段：/, '')}
                </Badge>
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{activeStage.label}</h3>
            <p className="text-sm text-gray-600 mt-1">本阶段目标：{activeStage.gain}</p>
            <p className="text-sm text-gray-600 mt-1">最低完成标准：{activeStage.minimumDone}</p>
            <p className="text-sm text-gray-600 mt-1">AI 支持：{activeStage.aiSupport}</p>
          </div>

          {renderStageForm(activeStage.step, (activeData.payload ?? createDefaultPayload(activeStage.step)) as Record<string, unknown>)}

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={handleSaveCurrent} disabled={saving}>
              {saving ? '保存中...' : '保存阶段'}
            </Button>
            <Button onClick={handleAdvance} disabled={advancing || isFinalStage}>
              {advancing ? '推进中...' : isFinalStage ? '已到最终阶段' : '推进下一阶段'}
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                if (activeStage.stageId === 'stage_08_evaluate') {
                  try {
                    setAssisting(true);
                    const response = await projectsApi.generateAchievementCard(projectId);
                    if (response.data) {
                      const progressResponse = await projectsApi.getProgress(projectId);
                      if (progressResponse.data) {
                        onProgressUpdate?.(progressResponse.data);
                      }
                      setSavedMessage('已根据当前项目材料生成成果档案卡，并回填到评估展示阶段。');
                      return;
                    }
                    throw new Error(response.message || '成果档案卡生成失败');
                  } catch (err) {
                    console.error('[steps:ai-assist] 自动生成成果卡失败:', err);
                    setSavedMessage(err instanceof Error ? err.message : '成果档案卡生成失败，请稍后重试。');
                    return;
                  } finally {
                    setAssisting(false);
                  }
                }
                // 关键：先用 sessionStorage 恢复项目状态，再跳转 /create，
                // scene=continue_stage 会触发 Create 页 useEffect 引导 AI 协助当前阶段
                try {
                  setAssisting(true);
                  const wsRes = await projectsApi.getWorkspace(projectId);
                  const restoreData: Record<string, unknown> = {
                    projectId,
                    projectName: wsRes.data?.project?.name || '',
                    mode: 'standard',
                    currentStage: activeStage.stageId,
                    scene: 'continue_stage',
                    stage: activeStage.stageId,
                  };
                  if (wsRes.data?.workspace) {
                    restoreData.code = wsRes.data.workspace.code;
                    restoreData.language = wsRes.data.workspace.language || 'python';
                    restoreData.messages = wsRes.data.workspace.chat_messages || [];
                  }
                  sessionStorage.setItem('finestem_restore_project', JSON.stringify(restoreData));
                } catch (err) {
                  console.error('[steps:ai-assist] 恢复项目失败:', err);
                } finally {
                  setAssisting(false);
                }
                navigate(
                  `/create?scene=continue_stage&projectId=${encodeURIComponent(projectId)}&stage=${encodeURIComponent(
                    activeStage.stageId
                  )}`
                );
              }}
              disabled={assisting}
            >
              {assisting ? '处理中...' : '让 AI 协助本阶段'}
            </Button>
          </div>

          {savedMessage && <p className="text-sm text-gray-600">{savedMessage}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
