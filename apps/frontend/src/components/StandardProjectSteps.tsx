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
  { step: 0, stageId: 'stage_00_bootstrap', label: 'Stage 0: Bootstrap', gain: 'Define context and boundaries.', minimumDone: 'Goal, resources, and constraints are clear.', aiSupport: 'AI drafts checklist and risk list.' },
  { step: 1, stageId: 'stage_01_brainstorm', label: 'Stage 1: Brainstorm', gain: 'Pick the most valuable topic.', minimumDone: 'Candidate list and final topic selected.', aiSupport: 'AI expands options and compares trade-offs.' },
  { step: 2, stageId: 'stage_02_brief', label: 'Stage 2: Brief', gain: 'Build an executable project brief.', minimumDone: 'Problem, users, and success criteria defined.', aiSupport: 'AI refines scope and acceptance criteria.' },
  { step: 3, stageId: 'stage_03_constraints', label: 'Stage 3: Scope Matrix', gain: 'Lock MVP scope.', minimumDone: 'Must-have / nice-to-have / won\'t-do are complete.', aiSupport: 'AI warns about over-scope risk.' },
  { step: 4, stageId: 'stage_04_track', label: 'Stage 4: Track Selection', gain: 'Choose route and stack.', minimumDone: 'Track, tools, and dependencies are confirmed.', aiSupport: 'AI provides route cost comparison.' },
  { step: 5, stageId: 'stage_05_design', label: 'Stage 5: Design', gain: 'Finalize module plan and acceptance checks.', minimumDone: 'Modules, data flow, and criteria are complete.', aiSupport: 'AI suggests architecture and interfaces.' },
  { step: 6, stageId: 'stage_06_step_plan', label: 'Stage 6: Step Plan', gain: 'Create actionable sequence.', minimumDone: 'Execution steps, checks, and rollback are clear.', aiSupport: 'AI decomposes tasks into small steps.' },
  { step: 7, stageId: 'stage_07_execute', label: 'Stage 7: Execute', gain: 'Deliver implementation with evidence.', minimumDone: 'Milestones, issues, and evidence are logged.', aiSupport: 'AI helps debug and unblock.' },
  { step: 8, stageId: 'stage_08_evaluate', label: 'Stage 8: Evaluate', gain: 'Close with review and next iteration plan.', minimumDone: 'Acceptance summary and reflection completed.', aiSupport: 'AI drafts presentation and retrospective.' },
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
  const [activeStep, setActiveStep] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [contents, setContents] = useState<Record<number, StandardProjectStepData>>({});

  const stageMap = useMemo(() => {
    const mapped: Record<number, StandardProjectStepData> = {};
    STANDARD_STAGES.forEach((stage) => {
      const key = `step${stage.step}`;
      mapped[stage.step] = normalizeStandardStep(stage.step, progress.standard_step_data?.[key]);
    });
    return mapped;
  }, [progress.standard_step_data]);

  useEffect(() => {
    setContents(stageMap);
  }, [stageMap]);

  useEffect(() => {
    setActiveStep(resolveActiveStep(progress.current_stage));
  }, [progress.current_stage]);

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
      setSavedMessage('Saved current stage data.');
    } catch {
      setSavedMessage('Save failed. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdvance = async () => {
    if (isFinalStage) {
      return;
    }
    if (!isReady(activeStage.step, (activeData.payload ?? {}) as Record<string, unknown>)) {
      setSavedMessage('Please complete required fields before advancing.');
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
      setSavedMessage('Moved to next stage.');
    } catch {
      setSavedMessage('Advance failed. Please retry.');
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
        <CardTitle>Standard Learning Workflow</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {STANDARD_STAGES.map((stage) => {
            const isCurrent = stage.step === activeStep;
            const isDone = stage.step < activeStep;
            return (
              <button key={stage.stageId} type="button" onClick={() => setActiveStep(stage.step)} className="text-left">
                <Badge variant={isCurrent ? 'primary' : isDone ? 'success' : 'secondary'}>
                  {stage.step}. {stage.label.replace(/^Stage \d+: /, '')}
                </Badge>
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{activeStage.label}</h3>
            <p className="text-sm text-gray-600 mt-1">Outcome: {activeStage.gain}</p>
            <p className="text-sm text-gray-600 mt-1">Minimum done: {activeStage.minimumDone}</p>
            <p className="text-sm text-gray-600 mt-1">AI support: {activeStage.aiSupport}</p>
          </div>

          {renderStageForm(activeStage.step, (activeData.payload ?? createDefaultPayload(activeStage.step)) as Record<string, unknown>)}

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={handleSaveCurrent} disabled={saving}>
              {saving ? 'Saving...' : 'Save Stage'}
            </Button>
            <Button onClick={handleAdvance} disabled={advancing || isFinalStage}>
              {advancing ? 'Advancing...' : isFinalStage ? 'Final Stage Reached' : 'Advance'}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                navigate(
                  `/create?scene=${encodeURIComponent('Start Project')}&projectId=${encodeURIComponent(projectId)}&stage=${encodeURIComponent(
                    activeStage.stageId
                  )}`
                )
              }
            >
              AI Assistant For This Stage
            </Button>
          </div>

          {savedMessage && <p className="text-sm text-gray-600">{savedMessage}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
