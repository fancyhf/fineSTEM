/**
 * Toaster 全局容器
 *
 * 用途：监听 finestem:toast 事件，在右下角渲染 toast 列表。
 *       挂载到 App 根节点即可全局生效。
 * 维护者：AI Agent
 */

import { useEffect, useState, useCallback } from 'react';
import { TOAST_EVENT, ToastPayload } from '../services/toast';

const LEVEL_CLASS: Record<ToastPayload['level'], string> = {
  info: 'bg-slate-800 text-white',
  success: 'bg-emerald-600 text-white',
  warning: 'bg-amber-500 text-white',
  error: 'bg-rose-600 text-white',
};

export function Toaster() {
  const [items, setItems] = useState<ToastPayload[]>([]);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const onToast = (ev: Event) => {
      const detail = (ev as CustomEvent<ToastPayload>).detail;
      if (!detail) return;
      setItems((prev) => {
        // 同 id 去重（避免短时间相同事件刷屏）
        if (prev.some((t) => t.id === detail.id)) return prev;
        return [...prev, detail];
      });
      if (detail.duration > 0) {
        window.setTimeout(() => remove(detail.id), detail.duration);
      }
    };
    window.addEventListener(TOAST_EVENT, onToast as EventListener);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast as EventListener);
    };
  }, [remove]);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed z-[9999] right-4 bottom-4 flex flex-col gap-2 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg max-w-sm text-sm leading-relaxed ${LEVEL_CLASS[t.level]}`}
          onClick={() => remove(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
