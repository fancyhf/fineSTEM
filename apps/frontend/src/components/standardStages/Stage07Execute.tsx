import React from 'react';
import { StageComponentProps, splitLines, joinLines, updateField } from './types';

export interface Stage07Payload {
  milestones: string[];
  issue_log: string[];
  evidence_links: string[];
}

export function Stage07Execute({ value, onChange }: StageComponentProps<Stage07Payload>) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm text-gray-700 mb-1">Milestones (one per line)</label>
        <textarea
          value={joinLines(value.milestones)}
          onChange={(e) => updateField(value, 'milestones', splitLines(e.target.value), onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">Issue Log (one per line)</label>
        <textarea
          value={joinLines(value.issue_log)}
          onChange={(e) => updateField(value, 'issue_log', splitLines(e.target.value), onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">Evidence Links (one per line)</label>
        <textarea
          value={joinLines(value.evidence_links)}
          onChange={(e) => updateField(value, 'evidence_links', splitLines(e.target.value), onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
        />
      </div>
    </div>
  );
}
