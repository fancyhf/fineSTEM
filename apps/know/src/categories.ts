/**
 * 频道四大栏目定义：独立栏目页（/c/:cid）、首页大入口、顶部页签共用。
 * color = 栏目主题色（页面着色 + 入口磁贴 + 栏目页头部）。
 */
export interface Category {
  cid: string;
  title: string;
  short: string; // 页签短名
  sub: string;
  color: string;
  icon: string;
  /** 归属的系列 slug；空数组 = 动态口径（儿童互动视频：含互动演示或儿童视频的节目） */
  series: string[];
}

export const CATEGORIES: Category[] = [
  {
    cid: 'podcast',
    title: '家长减负博客 · 与孩子互动',
    short: '家长减负博客',
    sub: '一期一个话题：家长播客讲清楚，互动演示一起玩',
    color: '#3E6B8C',
    icon: '◉',
    series: ['recursive-beauty'],
  },
  {
    cid: 'kids',
    title: '儿童互动视频',
    short: '儿童互动视频',
    sub: '给孩子看的：点一点、玩一玩、跟着动画走',
    color: '#B8503D',
    icon: '▷',
    series: [],
  },
  {
    cid: 'shengxue',
    title: '升学和学位',
    short: '升学和学位',
    sub: '路更多、境更大：规划要趁早，学位要看懂',
    color: '#A8574C',
    icon: '⇉',
    series: ['duoyuan-shengxue', 'mengmu-xuewei'],
  },
  {
    cid: 'stem',
    title: 'STEM 和 CS 学习',
    short: 'STEM 和 CS',
    sub: '几岁学什么、怎么学不焦虑：编程、数理、哲思与工具',
    color: '#C9972E',
    icon: '</>',
    series: ['stem-cs', 'cs-resources'],
  },
];

/** 栏目口径选集：按系列归属，kids 按儿童资源动态判定（泛型保留完整节目类型） */
export function episodesOfCategory<T extends EpisodeSummaryLike>(
  cat: Category,
  episodes: T[]
): T[] {
  if (cat.series.length > 0) {
    return episodes.filter((e) => cat.series.includes(e.series_slug));
  }
  return episodes.filter(
    (e) => e.has_interactive || e.video_audiences.includes('child')
  );
}

export interface EpisodeSummaryLike {
  series_slug: string;
  has_interactive: boolean;
  video_audiences: string[];
}
