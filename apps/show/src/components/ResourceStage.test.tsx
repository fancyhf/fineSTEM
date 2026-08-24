import { describe, expect, it } from 'vitest';

import { buildTabs, pickDefaultTab } from './ResourceStage';
import type { EpisodeDetail, EpisodeResources } from '../types';

function detail(resources: Partial<EpisodeResources>, extra: Partial<EpisodeDetail> = {}): EpisodeDetail {
  return {
    series_slug: 'recursive-beauty',
    series_title: '递推之美',
    brand: 'jiwa',
    theme_color: '#3E6B8C',
    slug: 'ep01',
    episode_no: 1,
    title: '搭积木',
    summary: '',
    audience: 'family',
    tags: [],
    published_at: null,
    cover: null,
    url: '/ep/recursive-beauty/ep01',
    has_interactive: false,
    video_audiences: [],
    has_docs: false,
    has_projects: false,
    description_md: '',
    announce: {},
    default_tab: null,
    resources: { interactive: null, videos: [], docs: [], projects: [], ...resources },
    prev: null,
    next: null,
    ...extra,
  };
}

describe('buildTabs', () => {
  it('槽位顺序：儿童视频 → 互动 → 家长视频，缺资源不出现', () => {
    const tabs = buildTabs(
      detail({
        interactive: { title: '互动', url: '/content/x.html', ratio: '16/9' },
        videos: [
          { id: 'p1', audience: 'parent', title: '家长', embed_url: '//player.bilibili.com/a' },
        ],
      })
    );
    expect(tabs.map((t) => t.id)).toEqual(['interactive', 'parent-video']);
  });

  it('announce 为未上线槽位生成禁用 tab', () => {
    const tabs = buildTabs(
      detail(
        {
          interactive: { title: '互动', url: '/content/x.html', ratio: '16/9' },
        },
        { announce: { 'parent-video': '即将上线', 'child-video': '9 月上线' } }
      )
    );
    const child = tabs.find((t) => t.id === 'child-video');
    expect(child?.disabled).toBe(true);
    expect(child?.note).toBe('9 月上线');
    expect(tabs.find((t) => t.id === 'interactive')?.disabled).toBeFalsy();
  });

  it('audience 为空的视频归入独立 tab', () => {
    const tabs = buildTabs(
      detail({
        videos: [{ id: 'main', audience: null, title: '讲解视频', embed_url: '//x' }],
      })
    );
    expect(tabs.map((t) => t.label)).toEqual(['讲解视频']);
  });
});

describe('pickDefaultTab', () => {
  it('默认优先级：儿童视频 > 互动 > 家长视频', () => {
    const ep = detail({
      interactive: { title: '互动', url: '/x', ratio: '16/9' },
      videos: [
        { id: 'p1', audience: 'parent', title: '家长', embed_url: '//x' },
        { id: 'c1', audience: 'child', title: '儿童', embed_url: '//x' },
      ],
    });
    expect(pickDefaultTab(ep, buildTabs(ep))).toBe('child-video');
  });

  it('default_tab 覆盖默认优先级（仅当该 tab 可用）', () => {
    const ep = detail(
      {
        interactive: { title: '互动', url: '/x', ratio: '16/9' },
        videos: [{ id: 'p1', audience: 'parent', title: '家长', embed_url: '//x' }],
      },
      { default_tab: 'parent-video' }
    );
    expect(pickDefaultTab(ep, buildTabs(ep))).toBe('parent-video');
  });

  it('default_tab 指向禁用 tab 时回退默认顺序', () => {
    const ep = detail(
      { interactive: { title: '互动', url: '/x', ratio: '16/9' } },
      { default_tab: 'child-video', announce: { 'child-video': '即将上线' } }
    );
    expect(pickDefaultTab(ep, buildTabs(ep))).toBe('interactive');
  });
});
