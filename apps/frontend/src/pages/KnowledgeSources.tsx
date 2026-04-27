import { FormEvent, useEffect, useState } from 'react';
import { knowledgeSourcesApi } from '../services/api';
import { KnowledgeSource } from '../types';

export default function KnowledgeSources() {
  const [items, setItems] = useState<KnowledgeSource[]>([]);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [summary, setSummary] = useState('');

  const load = async () => {
    const res = await knowledgeSourcesApi.list();
    setItems(res.data ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await knowledgeSourcesApi.create({
      title,
      url,
      summary,
      source_type: 'official',
      tags: [],
      reliability_score: 80,
    });
    setTitle('');
    setUrl('');
    setSummary('');
    await load();
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">知识来源</h1>
      <form onSubmit={submit} className="bg-white border rounded-lg p-4 grid gap-3">
        <input className="border rounded px-3 py-2" placeholder="来源标题" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input className="border rounded px-3 py-2" placeholder="URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <textarea className="border rounded px-3 py-2" placeholder="摘要" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
        <button className="bg-teal-600 text-white rounded px-4 py-2 w-fit">新增来源</button>
      </form>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-white border rounded-lg p-4">
            <div className="font-medium">{item.title}</div>
            <a href={item.url} target="_blank" rel="noreferrer" className="text-sm text-teal-700">{item.url}</a>
            <div className="text-sm text-gray-700 mt-1">{item.summary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
