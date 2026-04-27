import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DemoCard } from '../components/DemoCard';
import { DemoFilter } from '../components/DemoFilter';
import { demosApi } from '../services/api';
import { Demo, PaginationResult, ApiResponse } from '../types';
import { Button } from '../components/ui/Button';

export default function ExploreDemos() {
  const navigate = useNavigate();
  const [demos, setDemos] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Omit<PaginationResult, 'items'> | null>(null);
  const [filters, setFilters] = useState<{
    search?: string;
    difficulty?: string;
    subject?: string;
    page?: number;
    page_size?: number;
  }>({ page: 1, page_size: 9 });

  const loadDemos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await demosApi.list(filters);
      if (response.data) {
        setDemos(response.data.items);
        setPagination({
          total: response.data.total,
          page: response.data.page,
          page_size: response.data.page_size,
          total_pages: response.data.total_pages,
        });
      }
    } catch (err) {
      console.error('Failed to load demos:', err);
      setError('加载 Demo 失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDemos();
  }, [filters]);

  const handleFilter = (newFilters: { search?: string; difficulty?: string; subject?: string }) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handleFork = async (demo: Demo) => {
    navigate(`/explore/demos/${demo.id}`);
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  if (loading && demos.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error && demos.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadDemos}>重试</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">探索 Demo</h1>
          <p className="text-gray-600">发现有趣的项目，开始你的 STEM 之旅</p>
        </div>

        <DemoFilter onFilter={handleFilter} initialFilters={filters} />

        {demos.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">暂无 Demo</p>
            <Button variant="secondary" onClick={() => setFilters({ page: 1, page_size: 9 })}>
              重置筛选
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {demos.map((demo) => (
                <DemoCard key={demo.id} demo={demo} onFork={handleFork} />
              ))}
            </div>

            {pagination && pagination.total_pages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  上一页
                </Button>
                <span className="flex items-center px-4 text-gray-600">
                  第 {pagination.page} 页 / 共 {pagination.total_pages} 页
                </span>
                <Button
                  variant="secondary"
                  disabled={pagination.page >= pagination.total_pages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  下一页
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
