import React from 'react';
import { StageComponentProps, updateField } from './types';

export interface Stage08Payload {
  acceptance_summary: string;
  reflection: string;
  next_iteration: string;
}

export function Stage08Evaluate({ value, onChange }: StageComponentProps<Stage08Payload>) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm text-gray-700 mb-1">Acceptance Summary</label>
        <textarea
          value={value.acceptance_summary}
          onChange={(e) => updateField(value, 'acceptance_summary', e.target.value, onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">Reflection</label>
        <textarea
          value={value.reflection}
          onChange={(e) => updateField(value, 'reflection', e.target.value, onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">Next Iteration</label>
        <textarea
          value={value.next_iteration}
          onChange={(e) => updateField(value, 'next_iteration', e.target.value, onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
        />
      </div>
    </div>
  );
}
