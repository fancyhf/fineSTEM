import React from 'react';
import { StageComponentProps, splitLines, joinLines, updateField } from './types';

export interface Stage01Payload {
  candidate_topics: string[];
  selected_topic: string;
  selection_reason: string;
}

export function Stage01Brainstorm({ value, onChange }: StageComponentProps<Stage01Payload>) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm text-gray-700 mb-1">候选主题（每行一个）</label>
        <textarea
          value={joinLines(value.candidate_topics)}
          onChange={(e) => updateField(value, 'candidate_topics', splitLines(e.target.value), onChange)}
          className="w-full min-h-24 p-3 border border-gray-300 rounded-lg"
          placeholder="例如：校园能耗看板"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">最终选题</label>
        <input
          value={value.selected_topic}
          onChange={(e) => updateField(value, 'selected_topic', e.target.value, onChange)}
          className="w-full p-3 border border-gray-300 rounded-lg"
          placeholder="写下最终确定的项目主题"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">选择理由</label>
        <textarea
          value={value.selection_reason}
          onChange={(e) => updateField(value, 'selection_reason', e.target.value, onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
          placeholder="为什么这个方向最适合现在推进？"
        />
      </div>
    </div>
  );
}
