/**
 * API 错误归一化
 *
 * 用途：把 fetch / WebSocket / 业务错误统一为 ApiError，
 *       让上层只需要一个 try/catch 就能区分网络错、密码错、服务异常。
 * 维护者：AI Agent
 */

export type ApiErrorKind =
  | 'network'   // 后端不可达（fetch TypeError、CORS 失败、DNS 失败等）
  | 'timeout'   // 请求超时
  | 'auth'      // 401 未登录或令牌过期
  | 'forbidden' // 403 权限不足
  | 'not_found' // 404
  | 'server'    // 5xx 服务异常
  | 'business'  // 4xx 业务错（密码错、参数校验失败等）
  | 'unknown';

export class ApiError extends Error {
  kind: ApiErrorKind;
  status: number;
  /** 可直接展示给 C 端用户看的中文文案 */
  userMessage: string;
  /** 后端原始 body（debug 用，不展示给用户） */
  body?: unknown;

  constructor(kind: ApiErrorKind, status: number, userMessage: string, body?: unknown) {
    super(userMessage);
    this.kind = kind;
    this.status = status;
    this.userMessage = userMessage;
    this.body = body;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** 默认面向用户的中文文案，按错误类型映射 */
export const DEFAULT_USER_MESSAGES: Record<ApiErrorKind, string> = {
  network: '服务器暂时无法连接，请稍后再试',
  timeout: '请求超时，请稍后再试',
  auth: '登录已失效，请重新登录',
  forbidden: '当前账号没有权限执行此操作',
  not_found: '请求的资源不存在',
  server: '服务器异常，请稍后再试',
  business: '操作失败',
  unknown: '操作失败，请稍后再试',
};

export function classifyHttpStatus(status: number): ApiErrorKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status >= 500) return 'server';
  if (status >= 400) return 'business';
  return 'unknown';
}
