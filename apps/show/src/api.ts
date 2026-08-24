/**
 * Show 频道 API 客户端
 *
 * 同域相对路径（开发走 vite proxy → 3200，生产走 nginx → 8001），
 * 复用主站 ApiResponse 包装（success/data/message）。
 */

import type { ShowHome, SeriesDetail, EpisodeDetail } from './types';

const BASE = '/api/v1/show';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`请求失败（${res.status}）：${path}`);
  }
  const body = await res.json();
  if (body?.success !== true) {
    throw new Error(body?.message || `接口返回异常：${path}`);
  }
  return body.data as T;
}

export const showApi = {
  home: () => get<ShowHome>('/home'),
  series: (slug: string) => get<SeriesDetail>(`/series/${encodeURIComponent(slug)}`),
  episode: (seriesSlug: string, slug: string) =>
    get<EpisodeDetail>(
      `/episodes/${encodeURIComponent(seriesSlug)}/${encodeURIComponent(slug)}`
    ),
};

/** 协议相对嵌入地址（//player.bilibili.com/…）补全为 https，供 iframe src 使用 */
export function normalizeEmbedUrl(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}
