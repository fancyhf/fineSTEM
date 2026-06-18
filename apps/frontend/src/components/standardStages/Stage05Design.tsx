import React from 'react';
import { StageComponentProps, splitLines, joinLines, updateField } from './types';

export interface Stage05Payload {
  module_list: string[];
  data_flow: string;
  acceptance_criteria: string[];
}

export function Stage05Design({ value, onChange }: StageComponentProps<Stage05Payload>) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm text-gray-700 mb-1">功能模块（每行一个）</label>
        <textarea
          value={joinLines(value.module_list)}
          onChange={(e) => updateField(value, 'module_list', splitLines(e.target.value), onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">数据流说明</label>
        <textarea
          value={value.data_flow}
          onChange={(e) => updateField(value, 'data_flow', e.target.value, onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">验收条件（每行一个）</label>
        <textarea
          value={joinLines(value.acceptance_criteria)}
          onChange={(e) => updateField(value, 'acceptance_criteria', splitLines(e.target.value), onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
        />
      </div>
    </div>
  );
}
