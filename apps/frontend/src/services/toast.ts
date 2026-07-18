/**
 * 极简全局 Toast 服务
 *
 * 用途：在任何地方调用 showToast() 即可在右下角弹出提示，
 *       专为 C 端用户的"操作即时反馈"设计。
 * 实现：CustomEvent + 单例 Toaster 组件，无外部依赖。
 * 维护者：AI Agent
 */

export type ToastLevel = 'info' | 'success' | 'warning' | 'error';

export interface ToastPayload {
  id: string;
  level: ToastLevel;
  message: string;
  /** 自动消失毫秒数，<=0 表示常驻 */
  duration: number;
}

export const TOAST_EVENT = 'finestem:toast';

const DEFAULT_DURATION: Record<ToastLevel, number> = {
  info: 2500,
  success: 2500,
  warning: 4000,
  error: 4000,
};

/**
 * 弹出一个 toast
 *
 * @param level   级别（info / success / warning / error）
 * @param message 用户可读的中文提示
 * @param options 可选：自定义 duration、自定义 id（用于去重）
 */
export function showToast(
  level: ToastLevel,
  message: string,
  options?: { duration?: number; id?: string }
): void {
  if (typeof window === 'undefined') return;
  const payload: ToastPayload = {
    id: options?.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    message,
    duration: options?.duration ?? DEFAULT_DURATION[level],
  };
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
}

/**
 * 同一 message 在 dedupeMs 毫秒内只展示一次。
 * 用于避免短时间内多个并行 API 调用全挂时弹出一堆相同 toast。
 */
const lastShownAt = new Map<string, number>();

export function showToastDedup(
  level: ToastLevel,
  message: string,
  dedupeMs = 3000,
  options?: { duration?: number }
): void {
  const key = `${level}:${message}`;
  const now = Date.now();
  const last = lastShownAt.get(key) ?? 0;
  if (now - last < dedupeMs) return;
  lastShownAt.set(key, now);
  showToast(level, message, options);
}
