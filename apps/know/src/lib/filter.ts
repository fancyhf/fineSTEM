/**
 * 首页节目筛选（纯函数，与服务端 /episodes 语义一致）
 *
 * - q：命中标题/摘要/标签/系列名（不区分大小写包含）
 * - tags：多选任一命中（OR）
 * - audience：parent/child 筛选包含 family（亲子内容双向适用）
 */

export interface EpisodeFilters {
  q: string;
  seriesSlug: string; // '' = 全部
  audience: '' | 'parent' | 'child' | 'family';
  tags: string[];
}

export const emptyFilters: EpisodeFilters = {
  q: '',
  seriesSlug: '',
  audience: '',
  tags: [],
};

function haystackOf(e: {
  title: string;
  summary: string;
  series_title: string;
  tags: string[];
}): string {
  return `${e.title} ${e.summary} ${e.series_title} ${e.tags.join(' ')}`.toLowerCase();
}

function audienceAllowed(episodeAudience: string, filter: string): boolean {
  if (!filter) return true;
  const allow = new Set<string>(['family']);
  if (filter === 'parent') allow.add('parent');
  else if (filter === 'child') allow.add('child');
  else allow.add(filter);
  return allow.has(episodeAudience);
}

export function filterEpisodes<E extends { title: string; summary: string; series_title: string; tags: string[]; audience: string; series_slug: string }>(
  episodes: E[],
  filters: EpisodeFilters
): E[] {
  const needle = filters.q.trim().toLowerCase();
  const tagSet = new Set(filters.tags);
  return episodes.filter((e) => {
    if (filters.seriesSlug && e.series_slug !== filters.seriesSlug) return false;
    if (needle && !haystackOf(e).includes(needle)) return false;
    if (tagSet.size > 0 && !e.tags.some((t) => tagSet.has(t))) return false;
    if (!audienceAllowed(e.audience, filters.audience)) return false;
    return true;
  });
}
