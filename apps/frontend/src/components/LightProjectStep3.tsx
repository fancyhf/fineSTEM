import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { LightProjectStep3Data } from '../types';

interface LightProjectStep3Props {
  initialData?: LightProjectStep3Data;
  onSave: (data: LightProjectStep3Data) => void;
  onBack: () => void;
  onCreateAchievement?: () => void;
  saving?: boolean;
}

export function LightProjectStep3({
  initialData,
  onSave,
  onBack,
  onCreateAchievement,
  saving = false,
}: LightProjectStep3Props) {
  const [result, setResult] = useState(initialData?.result || '');
  const [reflection, setReflection] = useState(initialData?.reflection || '');

  const handleSave = async () => {
    await onSave({ result, reflection });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>第三步：展示与反思</CardTitle>
        <p className="text-gray-600 text-sm">展示你的成果并总结反思</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            项目成果 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder="描述你最终完成了什么，有什么成果..."
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            反思与收获 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="通过这个项目你学到了什么？有什么心得体会？..."
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            required
          />
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="secondary" onClick={onBack}>
            上一步
          </Button>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleSave} disabled={saving}>
              保存
            </Button>
            {onCreateAchievement && (
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                onClick={async () => {
                  await onSave({ result, reflection });
                  onCreateAchievement();
                }}
                disabled={!result || !reflection || saving}
              >
                生成成果档案卡
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
