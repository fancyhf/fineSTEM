import { describe, expect, it } from 'vitest';

import { emptyFilters, filterEpisodes } from './filter';
import type { EpisodeSummary } from '../types';

function ep(partial: Partial<EpisodeSummary>): EpisodeSummary {
  return {
    series_slug: 'recursive-beauty',
    series_title: '递推之美',
    brand: 'jiwa',
    theme_color: '#3E6B8C',
    slug: 'ep01',
    episode_no: 1,
    title: '搭积木',
    summary: '从 1 块积木到 21 层塔',
    audience: 'family',
    tags: ['数学启蒙'],
    published_at: '2026-09-01',
    cover: null,
    url: '/ep/recursive-beauty/ep01',
    has_interactive: true,
    video_audiences: [],
    has_docs: false,
    has_projects: false,
    ...partial,
  };
}

const episodes = [
  ep({ title: '搭积木', audience: 'family', tags: ['数学启蒙', '亲子'] }),
  ep({
    slug: 'ep02',
    title: '光的旅程',
    summary: '从影子到太阳灶',
    series_slug: 'finestem-class',
    series_title: 'fineSTEM 课堂',
    audience: 'parent',
    tags: ['STEM', '物理'],
  }),
];

describe('filterEpisodes', () => {
  it('无筛选时全部返回', () => {
    expect(filterEpisodes(episodes, emptyFilters)).toHaveLength(2);
  });

  it('q 命中标题/摘要/系列名/标签（不区分大小写）', () => {
    expect(filterEpisodes(episodes, { ...emptyFilters, q: '积木' })).toHaveLength(1);
    expect(filterEpisodes(episodes, { ...emptyFilters, q: '太阳灶' })).toHaveLength(1);
    expect(filterEpisodes(episodes, { ...emptyFilters, q: '课堂' })).toHaveLength(1);
    expect(filterEpisodes(episodes, { ...emptyFilters, q: 'STEM' })).toHaveLength(1);
    expect(filterEpisodes(episodes, { ...emptyFilters, q: '不存在' })).toHaveLength(0);
  });

  it('audience=parent 包含 family，audience=child 不含 parent', () => {
    expect(filterEpisodes(episodes, { ...emptyFilters, audience: 'parent' })).toHaveLength(2);
    const childOnly = filterEpisodes(episodes, { ...emptyFilters, audience: 'child' });
    expect(childOnly.map((e) => e.audience)).toEqual(['family']);
  });

  it('tags 多选任一命中（OR）', () => {
    expect(filterEpisodes(episodes, { ...emptyFilters, tags: ['物理'] })).toHaveLength(1);
    expect(filterEpisodes(episodes, { ...emptyFilters, tags: ['数学启蒙', '物理'] })).toHaveLength(2);
    expect(filterEpisodes(episodes, { ...emptyFilters, tags: ['升学'] })).toHaveLength(0);
  });

  it('seriesSlug 精确过滤', () => {
    const r = filterEpisodes(episodes, { ...emptyFilters, seriesSlug: 'finestem-class' });
    expect(r).toHaveLength(1);
    expect(r[0].series_title).toBe('fineSTEM 课堂');
  });

  it('多条件叠加取交集', () => {
    expect(
      filterEpisodes(episodes, {
        ...emptyFilters,
        seriesSlug: 'finestem-class',
        audience: 'child',
      })
    ).toHaveLength(0);
  });
});
