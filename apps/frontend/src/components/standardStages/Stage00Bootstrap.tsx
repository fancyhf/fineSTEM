import React from 'react';
import { StageComponentProps, updateField } from './types';

export interface Stage00Payload {
  project_goal: string;
  known_resources: string;
  constraints: string;
}

export function Stage00Bootstrap({ value, onChange }: StageComponentProps<Stage00Payload>) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm text-gray-700 mb-1">Project Goal</label>
        <textarea
          value={value.project_goal}
          onChange={(e) => updateField(value, 'project_goal', e.target.value, onChange)}
          className="w-full min-h-24 p-3 border border-gray-300 rounded-lg"
          placeholder="What problem will this project solve?"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">Known Resources</label>
        <textarea
          value={value.known_resources}
          onChange={(e) => updateField(value, 'known_resources', e.target.value, onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
          placeholder="Time, devices, materials, mentors"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">Constraints</label>
        <textarea
          value={value.constraints}
          onChange={(e) => updateField(value, 'constraints', e.target.value, onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
          placeholder="Budget, timeline, skills, hardware limits"
        />
      </div>
    </div>
  );
}
