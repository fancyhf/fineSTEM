import React from 'react';
import { SkillStage, SKILL_STAGES } from '../types';

interface ProjectStageBarProps {
  currentStage: SkillStage;
  mode: 'light' | 'standard';
}

export function ProjectStageBar({ currentStage, mode }: ProjectStageBarProps) {
  const lightStages = [
    { id: 'step1', label: '想法与方向', description: '确定项目主题和目标' },
    { id: 'step2', label: '设计与实现', description: '设计方案并开始实现' },
    { id: 'step3', label: '展示与反思', description: '展示成果并总结反思' },
  ];

  const standardStages = SKILL_STAGES.map((stage, idx) => ({
    id: stage,
    label: getStageLabel(stage),
    description: getStageDescription(stage),
  }));

  const stages = mode === 'light' ? lightStages : standardStages;
  const currentIndex = stages.findIndex((s) => s.id === currentStage);
  const completedRatio = currentIndex >= 0 ? ((currentIndex + 1) / stages.length) * 100 : 0;

  return (
    <div className="w-full">
      <div className="relative pt-2">
        <div className="absolute top-6 left-0 right-0 h-1 bg-gray-200 rounded-full"></div>
        <div
          className="absolute top-6 left-0 h-1 bg-teal-500 rounded-full transition-all duration-500"
          style={{
            width: `${completedRatio}%`,
          }}
        />

        <div className="flex justify-between relative">
          {stages.map((stage, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            const dotClass = isCompleted
              ? 'bg-teal-500 border-teal-500 text-white'
              : isCurrent
              ? 'bg-white border-teal-500 text-teal-700'
              : 'bg-white border-gray-300 text-gray-400';

            return (
              <div key={stage.id} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 transition-all duration-300 ${dotClass} ${
                    isCurrent ? 'animate-pulse shadow-md shadow-teal-200' : ''
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-sm font-medium">{idx + 1}</span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={`text-sm font-medium ${
                      isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {stage.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 max-w-24">{stage.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getStageLabel(stage: SkillStage): string {
  const stageMap: Record<string, string> = {
    'stage_00_bootstrap': '准备阶段',
    'stage_01_brainstorm': '脑爆选题',
    'stage_02_brief': '开题立项',
    'stage_03_constraints': '范围裁剪',
    'stage_04_track': '轨道选择',
    'stage_05_design': '设计蓝图',
    'stage_06_step_plan': '分步计划',
    'stage_07_execute': '执行开发',
    'stage_08_evaluate': '评估阶段',
  };
  return stageMap[stage] || stage;
}

function getStageDescription(stage: SkillStage): string {
  const stageMap: Record<string, string> = {
    'stage_00_bootstrap': '项目初始化',
    'stage_01_brainstorm': '产出候选方向',
    'stage_02_brief': '明确目标标准',
    'stage_03_constraints': '锁定范围边界',
    'stage_04_track': '选定技术路线',
    'stage_05_design': '完成方案设计',
    'stage_06_step_plan': '拆解执行步骤',
    'stage_07_execute': '落实开发记录',
    'stage_08_evaluate': '总结评估',
  };
  return stageMap[stage] || '';
}
