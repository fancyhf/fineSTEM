import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { LightProjectStep1Data } from '../types';

interface LightProjectStep1Props {
  initialData?: LightProjectStep1Data;
  onSave: (data: LightProjectStep1Data) => void;
  onNext: () => void;
  saving?: boolean;
}

export function LightProjectStep1({ initialData, onSave, onNext, saving = false }: LightProjectStep1Props) {
  const [topic, setTopic] = useState(initialData?.topic || '');
  const [goal, setGoal] = useState(initialData?.goal || '');

  const handleSave = async () => {
    await onSave({ topic, goal });
  };

  const handleNext = async () => {
    await onSave({ topic, goal });
    onNext();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>第一步：想法与方向</CardTitle>
        <p className="text-gray-600 text-sm">确定你的项目主题和想要达成的目标</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            项目主题 <span className="text-red-500">*</span>
          </label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例如：制作一个计算器、创建一个诗词生成器..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            项目目标 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="描述你想要通过这个项目实现什么..."
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            required
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={handleSave} disabled={saving}>
            保存
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={handleNext}
            disabled={!topic || !goal || saving}
          >
            下一步
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
