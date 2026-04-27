import { FormEvent, useEffect, useState } from 'react';
import { profileEnhancementApi } from '../services/api';
import { ProfileEnhancementPlan } from '../types';

export default function ProfileEnhancement() {
  const [items, setItems] = useState<ProfileEnhancementPlan[]>([]);
  const [studentName, setStudentName] = useState('');
  const [objective, setObjective] = useState('');
  const [activities, setActivities] = useState('');

  const load = async () => {
    const res = await profileEnhancementApi.list();
    setItems(res.data ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsedActivities = activities.split('\n').map((item) => item.trim()).filter(Boolean);
    await profileEnhancementApi.create({
      student_name: studentName,
      objective,
      activities: parsedActivities,
      evidence_targets: [],
      status: 'draft',
    });
    setStudentName('');
    setObjective('');
    setActivities('');
    await load();
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">背景提升</h1>
      <form onSubmit={submit} className="bg-white border rounded-lg p-4 grid gap-3">
        <input className="border rounded px-3 py-2" placeholder="学生姓名" value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
        <input className="border rounded px-3 py-2" placeholder="目标" value={objective} onChange={(e) => setObjective(e.target.value)} required />
        <textarea className="border rounded px-3 py-2" placeholder="活动清单（每行一个）" value={activities} onChange={(e) => setActivities(e.target.value)} rows={4} />
        <button className="bg-teal-600 text-white rounded px-4 py-2 w-fit">新建计划</button>
      </form>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-white border rounded-lg p-4">
            <div className="font-medium">{item.student_name}</div>
            <div className="text-sm text-gray-700">{item.objective}</div>
            <div className="text-sm text-gray-600 mt-1">{item.activities.join(' / ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
