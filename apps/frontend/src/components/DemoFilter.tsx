import React from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface DemoFilterProps {
  onFilter: (filters: { search?: string; difficulty?: string; subject?: string }) => void;
  initialFilters?: { search?: string; difficulty?: string; subject?: string };
}

export function DemoFilter({ onFilter, initialFilters = {} }: DemoFilterProps) {
  const [search, setSearch] = React.useState(initialFilters.search || '');
  const [difficulty, setDifficulty] = React.useState(initialFilters.difficulty || '');
  const [subject, setSubject] = React.useState(initialFilters.subject || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilter({
      search: search || undefined,
      difficulty: difficulty || undefined,
      subject: subject || undefined,
    });
  };

  const handleReset = () => {
    setSearch('');
    setDifficulty('');
    setSubject('');
    onFilter({});
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl border border-gray-200 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <Input
            placeholder="搜索 Demo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full h-10 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="">所有难度</option>
            <option value="beginner">入门</option>
            <option value="intermediate">中级</option>
            <option value="advanced">高级</option>
          </select>
        </div>
        <div>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full h-10 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="">所有学科</option>
            <option value="math">数学</option>
            <option value="physics">物理</option>
            <option value="chemistry">化学</option>
            <option value="biology">生物</option>
            <option value="computer_science">计算机科学</option>
            <option value="general">通用</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 mt-4 justify-end">
        <Button type="button" variant="secondary" onClick={handleReset}>
          重置
        </Button>
        <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
          搜索
        </Button>
      </div>
    </form>
  );
}
