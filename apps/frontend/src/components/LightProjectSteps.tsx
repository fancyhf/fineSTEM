import React, { useState } from 'react';
import {
  LightProjectStep1Data,
  LightProjectStep2Data,
  LightProjectStep3Data,
  ProjectProgress,
} from '../types';
import { LightProjectStep1 } from './LightProjectStep1';
import { LightProjectStep2 } from './LightProjectStep2';
import { LightProjectStep3 } from './LightProjectStep3';
import { projectsApi } from '../services/api';
import { useParams } from 'react-router-dom';

type LightStepData = Partial<LightProjectStep1Data & LightProjectStep2Data & LightProjectStep3Data>;

interface LightProjectStepsProps {
  progress: ProjectProgress;
  onProgressUpdate?: (progress: ProjectProgress) => void;
  onCreateAchievement?: () => void;
}

export function LightProjectSteps({ progress, onProgressUpdate, onCreateAchievement }: LightProjectStepsProps) {
  const { id: projectId } = useParams<{ id: string }>();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const lightStepData = progress.light_step_data as LightStepData | undefined;

  // 从 progress 中提取各步骤数据
  const step1Data: LightProjectStep1Data | undefined = lightStepData
    ? {
        topic: lightStepData.topic || '',
        goal: lightStepData.goal || '',
      }
    : undefined;

  const step2Data: LightProjectStep2Data | undefined = lightStepData
    ? {
        steps: lightStepData.steps || [],
      }
    : undefined;

  const step3Data: LightProjectStep3Data | undefined = lightStepData
    ? {
        result: lightStepData.result || '',
        reflection: lightStepData.reflection || '',
      }
    : undefined;

  // 根据当前阶段确定步骤
  React.useEffect(() => {
    const stage = progress.current_stage;
    if (stage.includes('step1') || stage.includes('01')) {
      setCurrentStep(1);
    } else if (stage.includes('step2') || stage.includes('02')) {
      setCurrentStep(2);
    } else if (stage.includes('step3') || stage.includes('03') || stage.includes('04')) {
      setCurrentStep(3);
    }
  }, [progress.current_stage]);

  const handleSaveStep1 = async (data: LightProjectStep1Data) => {
    if (!projectId) return;
    try {
      setSaving(true);
      const response = await projectsApi.saveLightStep1(projectId, data);
      if (response.data && onProgressUpdate) {
        onProgressUpdate(response.data);
      }
    } catch (err) {
      console.error('Failed to save step 1:', err);
      alert('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStep2 = async (data: LightProjectStep2Data) => {
    if (!projectId) return;
    try {
      setSaving(true);
      const response = await projectsApi.saveLightStep2(projectId, data);
      if (response.data && onProgressUpdate) {
        onProgressUpdate(response.data);
      }
    } catch (err) {
      console.error('Failed to save step 2:', err);
      alert('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStep3 = async (data: LightProjectStep3Data) => {
    if (!projectId) return;
    try {
      setSaving(true);
      const response = await projectsApi.saveLightStep3(projectId, data);
      if (response.data && onProgressUpdate) {
        onProgressUpdate(response.data);
      }
    } catch (err) {
      console.error('Failed to save step 3:', err);
      alert('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {currentStep === 1 && (
        <LightProjectStep1
          initialData={step1Data}
          onSave={handleSaveStep1}
          onNext={() => setCurrentStep(2)}
          saving={saving}
        />
      )}
      {currentStep === 2 && (
        <LightProjectStep2
          initialData={step2Data}
          onSave={handleSaveStep2}
          onNext={() => setCurrentStep(3)}
          onBack={() => setCurrentStep(1)}
          saving={saving}
        />
      )}
      {currentStep === 3 && (
        <LightProjectStep3
          initialData={step3Data}
          onSave={handleSaveStep3}
          onBack={() => setCurrentStep(2)}
          onCreateAchievement={onCreateAchievement}
          saving={saving}
        />
      )}
    </div>
  );
}
