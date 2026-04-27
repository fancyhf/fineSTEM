import { FormEvent, useEffect, useState } from 'react';
import { internationalAdmissionsApi } from '../services/api';
import { InternationalPlan } from '../types';

export default function InternationalAdmissions() {
  const [items, setItems] = useState<InternationalPlan[]>([]);
  const [studentName, setStudentName] = useState('');
  const [grade, setGrade] = useState('');
  const [country, setCountry] = useState('');
  const [timeline, setTimeline] = useState('');
  const [summary, setSummary] = useState('');

  const load = async () => {
    const res = await internationalAdmissionsApi.list();
    setItems(res.data ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await internationalAdmissionsApi.create({
      student_name: studentName,
      grade,
      target_country: country,
      target_school_level: 'undergraduate',
      timeline,
      requirement_summary: summary,
      status: 'draft',
    });
    setStudentName('');
    setGrade('');
    setCountry('');
    setTimeline('');
    setSummary('');
    await load();
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">国际升学</h1>
      <form onSubmit={submit} className="bg-white border rounded-lg p-4 grid gap-3">
        <input className="border rounded px-3 py-2" placeholder="学生姓名" value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
        <input className="border rounded px-3 py-2" placeholder="年级" value={grade} onChange={(e) => setGrade(e.target.value)} required />
        <input className="border rounded px-3 py-2" placeholder="目标国家" value={country} onChange={(e) => setCountry(e.target.value)} required />
        <input className="border rounded px-3 py-2" placeholder="时间线" value={timeline} onChange={(e) => setTimeline(e.target.value)} />
        <textarea className="border rounded px-3 py-2" placeholder="要求摘要" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
        <button className="bg-teal-600 text-white rounded px-4 py-2 w-fit">新建计划</button>
      </form>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-white border rounded-lg p-4">
            <div className="font-medium">{item.student_name} / {item.grade} / {item.target_country}</div>
            <div className="text-sm text-gray-600">{item.timeline}</div>
            <div className="text-sm text-gray-700 mt-1">{item.requirement_summary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
