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
        <label className="block text-sm text-gray-700 mb-1">项目目标</label>
        <textarea
          value={value.project_goal}
          onChange={(e) => updateField(value, 'project_goal', e.target.value, onChange)}
          className="w-full min-h-24 p-3 border border-gray-300 rounded-lg"
          placeholder="这个项目要解决什么问题？"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">已知资源</label>
        <textarea
          value={value.known_resources}
          onChange={(e) => updateField(value, 'known_resources', e.target.value, onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
          placeholder="可用时间、设备、材料、资料或指导老师"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">限制条件</label>
        <textarea
          value={value.constraints}
          onChange={(e) => updateField(value, 'constraints', e.target.value, onChange)}
          className="w-full min-h-20 p-3 border border-gray-300 rounded-lg"
          placeholder="预算、周期、技能储备或硬件限制"
        />
      </div>
    </div>
  );
}
