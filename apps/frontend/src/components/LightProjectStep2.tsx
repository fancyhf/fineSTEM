import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { LightProjectStep2Data } from '../types';

interface LightProjectStep2Props {
  initialData?: LightProjectStep2Data;
  onSave: (data: LightProjectStep2Data) => void;
  onNext: () => void;
  onBack: () => void;
  saving?: boolean;
}

export function LightProjectStep2({ initialData, onSave, onNext, onBack, saving = false }: LightProjectStep2Props) {
  const [steps, setSteps] = useState<string[]>(initialData?.steps || ['']);

  const handleStepChange = (index: number, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = value;
    setSteps(newSteps);
  };

  const handleAddStep = () => {
    setSteps([...steps, '']);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length > 1) {
      const newSteps = steps.filter((_, i) => i !== index);
      setSteps(newSteps);
    }
  };

  const handleSave = async () => {
    const validSteps = steps.filter((s) => s.trim() !== '');
    await onSave({ steps: validSteps });
  };

  const handleNext = async () => {
    const validSteps = steps.filter((s) => s.trim() !== '');
    await onSave({ steps: validSteps });
    onNext();
  };

  const isValid = steps.some((s) => s.trim() !== '');

  return (
    <Card>
      <CardHeader>
        <CardTitle>第二步：设计与实现</CardTitle>
        <p className="text-gray-600 text-sm">列出你实现这个项目的步骤</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-2">
              <div className="flex-shrink-0 w-8 h-8 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center font-medium mt-2">
                {index + 1}
              </div>
              <div className="flex-grow">
                <Input
                  value={step}
                  onChange={(e) => handleStepChange(index, e.target.value)}
                  placeholder={`步骤 ${index + 1}：...`}
                />
              </div>
              {steps.length > 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRemoveStep(index)}
                  className="mt-2"
                >
                  删除
                </Button>
              )}
            </div>
          ))}
        </div>

        <Button variant="secondary" onClick={handleAddStep} className="w-full">
          + 添加步骤
        </Button>

        <div className="flex justify-between pt-4">
          <Button variant="secondary" onClick={onBack}>
            上一步
          </Button>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleSave} disabled={saving}>
              保存
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleNext}
              disabled={!isValid || saving}
            >
              下一步
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
