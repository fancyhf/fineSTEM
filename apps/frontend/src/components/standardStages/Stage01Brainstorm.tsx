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
        <label className="block text-sm text-gray-700 mb-1">Candidate Topics (one per line)</label>
        <textarea
          value={joinLines(value.candidate_topics)}
          onChange={(e) => updateField(value, 'candidate_topics', splitLines(e.target.value), onChange)}
          className="w-full min-h-24 p-3 border border-gray-300 rounded-lg"
          placeholder="Example: Campus energy dashboard"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">Selected Topic</label>
        <input
          value={value.selected_topic}
          onChange={(e) => updateField(value, 'selected_topic', e.target.value, onChange)}
          className="w-full p-3 border border-gray-300 rounded-lg"
          placeholder="Final selected topic"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">Selection Reason</label>
        <textarea
          value={value.selection_reason}
          onChange={(e) => updateField(value, 'selection_reason', e.target.value, onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
          placeholder="Why is this the best option?"
        />
      </div>
    </div>
  );
}
