import { FormEvent, useEffect, useState } from 'react';
import { courseLibraryApi } from '../services/api';
import { Course } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export default function CourseLibrary() {
  const [items, setItems] = useState<Course[]>([]);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [resourceUrl, setResourceUrl] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [query, setQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | Course['difficulty']>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'title'>('latest');
  const [showAdvancedForm, setShowAdvancedForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadCourses = async () => {
    const res = await courseLibraryApi.listCourses();
    setItems(res.data ?? []);
  };

  useEffect(() => {
    void loadCourses();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await courseLibraryApi.createCourse({
        title,
        summary,
        subject,
        difficulty,
        resource_url: resourceUrl,
        tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setTitle('');
      setSummary('');
      setSubject('');
      setDifficulty('beginner');
      setResourceUrl('');
      setTagsText('');
      await loadCourses();
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items
    .filter((item) => {
      const matchedQuery = !query.trim() || [item.title, item.summary, item.subject, item.tags.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchedSubject = !subjectFilter.trim() || item.subject.toLowerCase().includes(subjectFilter.toLowerCase());
      const matchedDifficulty = difficultyFilter === 'all' || item.difficulty === difficultyFilter;
      return matchedQuery && matchedSubject && matchedDifficulty;
    })
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title, 'zh-CN');
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const difficultyCount = {
    beginner: items.filter((item) => item.difficulty === 'beginner').length,
    intermediate: items.filter((item) => item.difficulty === 'intermediate').length,
    advanced: items.filter((item) => item.difficulty === 'advanced').length,
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">课程资源库</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">课程总数</div>
            <div className="text-2xl font-semibold text-gray-900 mt-1">{items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">初级</div>
            <div className="text-2xl font-semibold text-emerald-700 mt-1">{difficultyCount.beginner}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">中级</div>
            <div className="text-2xl font-semibold text-amber-700 mt-1">{difficultyCount.intermediate}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">高级</div>
            <div className="text-2xl font-semibold text-red-700 mt-1">{difficultyCount.advanced}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="mb-2">
          <CardTitle className="text-lg">新增课程</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded px-3 py-2" placeholder="课程标题" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <select className="border rounded px-3 py-2" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Course['difficulty'])}>
                <option value="beginner">初级</option>
                <option value="intermediate">中级</option>
                <option value="advanced">高级</option>
              </select>
              <input className="border rounded px-3 py-2" placeholder="学科（如 物理/计算机）" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <input className="border rounded px-3 py-2" placeholder="标签，逗号分隔" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
              <input className="border rounded px-3 py-2 md:col-span-2" placeholder="课程简介" value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>
            <button
              type="button"
              className="text-sm text-teal-700 hover:text-teal-800"
              onClick={() => setShowAdvancedForm((prev) => !prev)}
            >
              {showAdvancedForm ? '收起高级字段' : '展开高级字段'}
            </button>
            {showAdvancedForm && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="border rounded px-3 py-2 md:col-span-2" placeholder="资源链接（可选）" value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} />
              </div>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? '提交中...' : '新增课程'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="mb-2">
          <CardTitle className="text-lg">筛选与检索</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="border rounded px-3 py-2 md:col-span-2" placeholder="关键词（标题/简介/标签）" value={query} onChange={(e) => setQuery(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="按学科筛选" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} />
          <div className="flex gap-2">
            <select className="border rounded px-3 py-2 flex-1" value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value as 'all' | Course['difficulty'])}>
              <option value="all">全部难度</option>
              <option value="beginner">初级</option>
              <option value="intermediate">中级</option>
              <option value="advanced">高级</option>
            </select>
            <select className="border rounded px-3 py-2 flex-1" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'latest' | 'title')}>
              <option value="latest">最新优先</option>
              <option value="title">标题排序</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.map((item) => (
          <article key={item.id} className="bg-white border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-gray-900">{item.title}</h2>
              <Badge variant={item.difficulty === 'advanced' ? 'error' : item.difficulty === 'intermediate' ? 'warning' : 'success'} size="sm">
                {item.difficulty === 'advanced' ? '高级' : item.difficulty === 'intermediate' ? '中级' : '初级'}
              </Badge>
            </div>
            <p className="text-sm text-gray-600">{item.summary || '暂无简介'}</p>
            <div className="text-xs text-gray-500">学科：{item.subject || '未填写'}</div>
            <div className="flex flex-wrap gap-2">
              {item.tags.length ? item.tags.map((tag) => (
                <span key={tag} className="text-xs bg-gray-100 rounded px-2 py-1">{tag}</span>
              )) : <span className="text-xs text-gray-400">暂无标签</span>}
            </div>
            <div className="text-xs text-gray-400">
              创建时间：{new Date(item.created_at).toLocaleString('zh-CN', { hour12: false })}
            </div>
            {item.resource_url && (
              <a href={item.resource_url} target="_blank" rel="noreferrer" className="inline-flex text-sm text-teal-600 hover:text-teal-700">
                打开资源链接
              </a>
            )}
          </article>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-10 text-sm text-gray-500 border border-dashed rounded-lg">
          当前筛选条件下暂无课程，试试调整关键词、学科或难度筛选。
        </div>
      )}
    </div>
  );
}
