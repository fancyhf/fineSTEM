import React from 'react';
import { StageComponentProps, splitLines, joinLines, updateField } from './types';

export interface Stage02Payload {
  problem_statement: string;
  target_user: string;
  success_criteria: string[];
}

export function Stage02Brief({ value, onChange }: StageComponentProps<Stage02Payload>) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm text-gray-700 mb-1">Problem Statement</label>
        <textarea
          value={value.problem_statement}
          onChange={(e) => updateField(value, 'problem_statement', e.target.value, onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">Target User</label>
        <input
          value={value.target_user}
          onChange={(e) => updateField(value, 'target_user', e.target.value, onChange)}
          className="w-full p-3 border border-gray-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">Success Criteria (one per line)</label>
        <textarea
          value={joinLines(value.success_criteria)}
          onChange={(e) => updateField(value, 'success_criteria', splitLines(e.target.value), onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
        />
      </div>
    </div>
  );
}
