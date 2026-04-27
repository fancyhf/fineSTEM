import { FormEvent, useEffect, useState } from 'react';
import { questionnaireEngineApi } from '../services/api';
import { QuestionnaireTemplate } from '../types';

export default function QuestionnaireEngine() {
  const [templates, setTemplates] = useState<QuestionnaireTemplate[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [questionText, setQuestionText] = useState('');

  const load = async () => {
    const res = await questionnaireEngineApi.listTemplates();
    setTemplates(res.data ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await questionnaireEngineApi.createTemplate({
      name,
      description,
      questions: [
        {
          id: `q_${Date.now()}`,
          text: questionText || '你最想提升的能力是什么？',
          question_type: 'text',
          required: true,
          options: [],
        },
      ],
    });
    setName('');
    setDescription('');
    setQuestionText('');
    await load();
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">问卷引擎</h1>
      <form onSubmit={submit} className="bg-white border rounded-lg p-4 grid gap-3">
        <input className="border rounded px-3 py-2" placeholder="模板名称" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="border rounded px-3 py-2" placeholder="模板描述" value={description} onChange={(e) => setDescription(e.target.value)} />
        <textarea className="border rounded px-3 py-2" placeholder="默认问题" value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={3} />
        <button className="bg-teal-600 text-white rounded px-4 py-2 w-fit">创建模板</button>
      </form>
      <div className="space-y-3">
        {templates.map((item) => (
          <div key={item.id} className="bg-white border rounded-lg p-4">
            <div className="font-medium">{item.name}</div>
            <div className="text-sm text-gray-700">{item.description}</div>
            <div className="text-sm text-gray-500 mt-1">问题数：{item.questions.length}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
