/**
 * 顶栏通知铃铛
 *
 * 用途：轮询未读数量并弹出最近通知，点击可跳转关联页面
 * 维护者：AI Agent
 * links: .trae/documents/api-specs/v1/spec.json
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notificationsApi } from '../services/api';
import { showToast } from '../services/toast';
import type { Notification } from '../types';

const POLL_INTERVAL_MS = 60_000;
const PREVIEW_LIMIT = 10;

function formatDateTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function NotificationBell(): JSX.Element | null {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const pollingRef = useRef<number | null>(null);

  const refreshUnread = useCallback(async () => {
    try {
      const res = await notificationsApi.unreadCount();
      setUnread(res.data?.unreadCount ?? 0);
    } catch (err) {
      // 静默失败：避免轮询打扰用户
      console.warn('[NotificationBell] 未读计数获取失败', err);
    }
  }, []);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.list({ page: 1, pageSize: PREVIEW_LIMIT });
      setItems(res.data?.items ?? []);
    } catch (err) {
      console.warn('[NotificationBell] 通知列表获取失败', err);
      showToast('error', '通知加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    void refreshUnread();
    pollingRef.current = window.setInterval(() => {
      void refreshUnread();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current !== null) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [user, refreshUnread]);

  if (!user) return null;

  const handleOpen = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      await loadPreview();
    }
  };

  const handleClickItem = async (item: Notification) => {
    if (!item.isRead) {
      try {
        await notificationsApi.markRead(item.id);
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
        );
        setUnread((c) => Math.max(0, c - 1));
      } catch (err) {
        console.warn('[NotificationBell] 标记已读失败', err);
      }
    }
    setOpen(false);
    if (item.linkUrl) {
      navigate(item.linkUrl);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          void handleOpen();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        aria-label="通知"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[92vw] rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-gray-900">通知消息</span>
              <span className="text-xs text-gray-500">未读 {unread}</span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  加载中
                </div>
              ) : items.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  暂无通知
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          void handleClickItem(item);
                        }}
                        className={`block w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                          item.isRead ? 'bg-white' : 'bg-teal-50/40'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {!item.isRead && (
                            <span className="mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-teal-500" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {item.title}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">
                              {item.content}
                            </p>
                            <p className="mt-1 text-[11px] text-gray-400">
                              {formatDateTime(item.createdAt)}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-gray-100 px-4 py-2 text-right">
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-teal-600 hover:text-teal-700"
              >
                查看全部通知
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
