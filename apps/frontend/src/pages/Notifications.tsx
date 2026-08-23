/**
 * 通知中心页面
 *
 * 用途：分页浏览通知、批量标记已读、点击跳转关联页面
 * 维护者：AI Agent
 * links: .trae/documents/api-specs/v1/spec.json
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { notificationsApi } from '../services/api';
import { showToast } from '../services/toast';
import type { Notification } from '../types';

type TabKey = 'all' | 'unread';

const PAGE_SIZE = 20;

function formatDateTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export default function Notifications(): JSX.Element {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('all');
  const [items, setItems] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.list({
        page,
        pageSize: PAGE_SIZE,
        unreadOnly: tab === 'unread',
      });
      setItems(res.data?.items ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (err) {
      console.error('[Notifications] 加载失败', err);
      showToast('error', '通知加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [page, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleTabChange = (next: TabKey) => {
    if (next === tab) return;
    setTab(next);
    setPage(1);
  };

  const handleMarkAllRead = async () => {
    setBusy(true);
    try {
      const res = await notificationsApi.markAllRead();
      const updated = res.data?.updatedCount ?? 0;
      showToast('success', `已标记 ${updated} 条为已读`);
      await load();
    } catch (err) {
      console.error('[Notifications] 全部已读失败', err);
      showToast('error', '操作失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      await notificationsApi.delete(id);
      showToast('success', '已删除');
      await load();
    } catch (err) {
      console.error('[Notifications] 删除失败', err);
      showToast('error', '删除失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  const handleItemClick = async (item: Notification) => {
    if (!item.isRead) {
      try {
        await notificationsApi.markRead(item.id);
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
        );
      } catch (err) {
        console.warn('[Notifications] 标记已读失败', err);
      }
    }
    if (item.linkUrl) {
      navigate(item.linkUrl);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">通知中心</h1>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || loading}
          onClick={() => {
            void handleMarkAllRead();
          }}
        >
          <CheckCheck className="mr-1.5 h-4 w-4" />
          全部标记为已读
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-2 border-b border-gray-200">
        {(['all', 'unread'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleTabChange(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {key === 'all' ? '全部' : '未读'}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {tab === 'unread' ? '没有未读通知' : '暂无通知'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`flex gap-3 px-4 py-4 transition-colors hover:bg-gray-50 ${
                    item.isRead ? 'bg-white' : 'bg-teal-50/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      void handleItemClick(item);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-start gap-2">
                      {!item.isRead && (
                        <span className="mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-teal-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {item.title}
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm text-gray-600">
                          {item.content}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void handleDelete(item.id);
                    }}
                    className="self-start rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                    aria-label="删除通知"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <span className="text-gray-500">
            第 {page} / {totalPages} 页
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
