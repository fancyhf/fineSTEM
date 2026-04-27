import React from 'react';
import { StageComponentProps, splitLines, joinLines, updateField } from './types';

export interface Stage04Payload {
  selected_track: 'web' | 'kaggle' | 'hardware';
  tool_chain: string[];
  dependencies: string[];
}

export function Stage04Track({ value, onChange }: StageComponentProps<Stage04Payload>) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm text-gray-700 mb-2">Technical Track</label>
        <div className="flex flex-wrap gap-3">
          {(['web', 'kaggle', 'hardware'] as const).map((track) => (
            <label key={track} className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="selected_track"
                checked={value.selected_track === track}
                onChange={() => updateField(value, 'selected_track', track, onChange)}
              />
              {track}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">Tool Chain (one per line)</label>
        <textarea
          value={joinLines(value.tool_chain)}
          onChange={(e) => updateField(value, 'tool_chain', splitLines(e.target.value), onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">Dependencies (one per line)</label>
        <textarea
          value={joinLines(value.dependencies)}
          onChange={(e) => updateField(value, 'dependencies', splitLines(e.target.value), onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
        />
      </div>
    </div>
  );
}
