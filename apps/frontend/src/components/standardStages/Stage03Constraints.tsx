import React from 'react';
import { StageComponentProps, splitLines, joinLines, updateField } from './types';

export interface Stage03Payload {
  must_have: string[];
  nice_to_have: string[];
  wont_do: string[];
}

export function Stage03Constraints({ value, onChange }: StageComponentProps<Stage03Payload>) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div>
        <label className="block text-sm text-gray-700 mb-1">必须完成</label>
        <textarea
          value={joinLines(value.must_have)}
          onChange={(e) => updateField(value, 'must_have', splitLines(e.target.value), onChange)}
          className="w-full min-h-28 p-3 border border-gray-300 rounded-lg"
          placeholder="本轮一定要交付的内容"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">可以加分</label>
        <textarea
          value={joinLines(value.nice_to_have)}
          onChange={(e) => updateField(value, 'nice_to_have', splitLines(e.target.value), onChange)}
          className="w-full min-h-28 p-3 border border-gray-300 rounded-lg"
          placeholder="时间允许时再做的扩展"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">暂不纳入</label>
        <textarea
          value={joinLines(value.wont_do)}
          onChange={(e) => updateField(value, 'wont_do', splitLines(e.target.value), onChange)}
          className="w-full min-h-28 p-3 border border-gray-300 rounded-lg"
          placeholder="本轮明确不做的内容"
        />
      </div>
    </div>
  );
}
