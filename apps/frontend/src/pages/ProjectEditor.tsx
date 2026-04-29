import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardFooter } from '../components/ui/Card';
import { 
  ArrowLeft, 
  Save, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2,
  Clock
} from 'lucide-react';
import { projectsApi } from '../services/api';

type EditorStep = 'info' | 'content' | 'progress' | 'finish';
type ProjectMode = 'light' | 'standard';

export default function ProjectEditor() {
  const { id } = useParams<{ id: string }>();
  const [step, setStep] = useState<EditorStep>('info');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    mode: 'light' as ProjectMode,
    tech_stack: [] as string[],
    subjects: [] as string[],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useAuth();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  useEffect(() => {
    if (!isNew && id) {
      loadProject(id);
    } else {
      setLoading(false);
    }
  }, [id, isNew]);

  const loadProject = async (projectId: string) => {
    try {
      setLoading(true);
      const [projectRes, progressRes] = await Promise.all([
        projectsApi.get(projectId),
        projectsApi.getProgress(projectId),
      ]);
      
      if (projectRes.data) {
        setFormData({
          name: projectRes.data.name,
          description: projectRes.data.description || '',
          mode: projectRes.data.mode,
          tech_stack: projectRes.data.tech_stack || [],
          subjects: projectRes.data.subjects || [],
        });
      }
      void progressRes;
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (isNew) {
        const newProject = await projectsApi.create(formData);
        if (newProject.data?.id) {
          navigate(`/projects/${newProject.data.id}/edit`);
        }
      } else if (id) {
        await projectsApi.update(id, formData);
      }
    } catch (error) {
      console.error('Failed to save project:', error);
    } finally {
      setSaving(false);
    }
  };

  const steps: { step: EditorStep; label: string }[] = [
    { step: 'info', label: '基本信息' },
    { step: 'content', label: '项目内容' },
    { step: 'progress', label: '进度记录' },
    { step: 'finish', label: '完成' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate(isNew ? '/create' : `/projects/${id}`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">
              {isNew ? '创建新项目' : '编辑项目'}
            </h1>
          </div>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>

        {/* 步骤导航 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((s, idx) => (
              <React.Fragment key={s.step}>
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step === s.step ? 'bg-teal-600 text-white' : 
                    steps.findIndex(x => x.step === step) > idx ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {steps.findIndex(x => x.step === step) > idx ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  <span className={`text-sm mt-2 ${step === s.step ? 'text-teal-600 font-medium' : 'text-gray-600'}`}>
                    {s.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className="flex-1 h-1 bg-gray-200 mx-4">
                    {steps.findIndex(x => x.step === step) > idx && (
                      <div className="h-full bg-green-500" />
                    )}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* 步骤内容 */}
        <Card>
          <CardContent className="p-8">
            {step === 'info' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">项目名称</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="输入项目名称"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">项目描述</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full min-h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="描述您的项目目标和内容"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">项目模式</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="mode"
                        value="light"
                        checked={formData.mode === 'light'}
                        onChange={(e) => setFormData({ ...formData, mode: e.target.value as 'light' | 'standard' })}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span>轻量模式</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="mode"
                        value="standard"
                        checked={formData.mode === 'standard'}
                        onChange={(e) => setFormData({ ...formData, mode: e.target.value as 'light' | 'standard' })}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span>标准模式</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">技术栈</label>
                  <Input
                    value={formData.tech_stack.join(', ')}
                    onChange={(e) => setFormData({ ...formData, tech_stack: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                    placeholder="输入技术栈，用逗号分隔"
                  />
                </div>
              </div>
            )}

            {step === 'content' && (
              <div className="text-center py-8">
                <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">项目内容编辑</h3>
                <p className="text-gray-600">根据您选择的模式，填写相应的项目内容</p>
              </div>
            )}

            {step === 'progress' && (
              <div className="text-center py-8">
                <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">进度记录</h3>
                <p className="text-gray-600">记录您的项目进展和证据</p>
              </div>
            )}

            {step === 'finish' && (
              <div className="text-center py-8">
                <CheckCircle2 className="h-16 w-16 text-teal-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">项目已保存！</h3>
                <p className="text-gray-600 mb-6">您可以继续编辑或查看项目详情</p>
                <div className="flex justify-center gap-4">
                  <Button onClick={() => navigate('/dashboard')}>
                    返回首页
                  </Button>
                  {!isNew && (
                    <Button
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                      onClick={() => navigate(`/projects/${id}`)}
                    >
                      查看详情
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>

          {step !== 'finish' && (
            <CardFooter className="flex justify-between border-t p-6">
              <Button
                variant="ghost"
                onClick={() => {
                  const currentIdx = steps.findIndex(s => s.step === step);
                  if (currentIdx > 0) {
                    setStep(steps[currentIdx - 1].step);
                  }
                }}
                disabled={step === 'info'}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                上一步
              </Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white"
                onClick={() => {
                  const currentIdx = steps.findIndex(s => s.step === step);
                  if (currentIdx < steps.length - 1) {
                    setStep(steps[currentIdx + 1].step);
                  }
                }}
              >
                下一步
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
