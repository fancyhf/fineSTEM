import React from 'react';
import { StageComponentProps, splitLines, joinLines, updateField } from './types';

export interface Stage06Payload {
  execution_steps: string[];
  check_points: string[];
  rollback_plan: string;
}

export function Stage06StepPlan({ value, onChange }: StageComponentProps<Stage06Payload>) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm text-gray-700 mb-1">执行步骤（每行一个）</label>
        <textarea
          value={joinLines(value.execution_steps)}
          onChange={(e) => updateField(value, 'execution_steps', splitLines(e.target.value), onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">检查点（每行一个）</label>
        <textarea
          value={joinLines(value.check_points)}
          onChange={(e) => updateField(value, 'check_points', splitLines(e.target.value), onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">回退方案</label>
        <textarea
          value={value.rollback_plan}
          onChange={(e) => updateField(value, 'rollback_plan', e.target.value, onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
        />
      </div>
    </div>
  );
}
