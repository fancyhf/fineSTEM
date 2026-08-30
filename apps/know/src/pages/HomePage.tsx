import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { showApi } from '../api';
import type { EpisodeSummary, KnowHome } from '../types';
import { emptyFilters, filterEpisodes, type EpisodeFilters } from '../lib/filter';
import FilterBar from '../components/FilterBar';
import EpisodeCard from '../components/EpisodeCard';
import Seal from '../components/Seal';
import { AudienceBadges, ResourceBadges } from '../components/Badges';

/**
 * 首页 = 门户布局（对齐 FlowUs 知识库主页的分区习惯）：
 *   ① 家长减负博客（与孩子互动）—— 大卡 + 集列表
 *   ② 儿童互动视频 —— 卡片
 *   ③ 升学和学位 —— 按子系列分组的条目列表
 *   ④ STEM 和 CS 学习 —— 条目列表
 * 搜索态（?q= 或筛选）下退回通用筛选结果流。
 */
const PODCAST_SERIES = 'recursive-beauty';
const SHENGXUE_SERIES = ['duoyuan-shengxue', 'mengmu-xuewei'];
const STEM_SERIES = 'stem-cs';

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="home-section__head">
      <h2>{title}</h2>
      {sub && <span className="home-section__sub">{sub}</span>}
      <span className="home-section__rule" />
    </header>
  );
}

/** FlowUs 式条目行：卷次章 + 标题 + 一句话 + 箭头 */
function EntryRow({ e }: { e: EpisodeSummary }) {
  return (
    <Link className="entry" to={e.url} style={{ '--theme': e.theme_color } as React.CSSProperties}>
      <Seal no={e.episode_no} />
      <span className="entry__main">
        <span className="entry__title">{e.title}</span>
        <span className="entry__summary">{e.summary}</span>
      </span>
      <span className="entry__arrow">→</span>
    </Link>
  );
}

export default function HomePage() {
  const [params] = useSearchParams();
  const [home, setHome] = useState<KnowHome | null>(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<EpisodeFilters>({
    ...emptyFilters,
    q: params.get('q') ?? '',
  });

  useEffect(() => {
    showApi
      .home()
      .then(setHome)
      .catch((e: Error) => setError(e.message));
  }, []);

  // 顶栏搜索 → /?q=xxx → 同步进筛选状态
  useEffect(() => {
    const q = params.get('q') ?? '';
    setFilters((f) => (f.q === q ? f : { ...f, q }));
  }, [params]);

  useEffect(() => {
    document.title = '与孩子对话 · 给家长的播客与节目频道';
  }, []);

  const episodes = useMemo(
    () => (home ? filterEpisodes(home.episodes, filters) : []),
    [home, filters]
  );

  if (error) {
    return (
      <div className="page-error">
        <div className="page-error__title">出错了</div>
        <p className="page-error__desc">{error}</p>
      </div>
    );
  }

  if (!home) return <div className="loading">加载中…</div>;

  const hasFilter =
    filters.q.trim() !== '' ||
    filters.seriesSlug !== '' ||
    filters.audience !== '' ||
    filters.tags.length > 0;

  // ── 搜索/筛选态：通用结果流 ──
  if (hasFilter) {
    return (
      <>
        <FilterBar
          filters={filters}
          series={home.series.filter((s) => s.episode_count > 0)}
          tags={home.tags}
          onChange={setFilters}
        />
        {episodes.length === 0 ? (
          <div className="empty-state">
            没有找到相关节目
            <br />
            <button onClick={() => setFilters({ ...emptyFilters, q: '' })}>清除筛选</button>
          </div>
        ) : (
          <div className="ep-grid">
            {episodes.map((e) => (
              <EpisodeCard key={`${e.series_slug}/${e.slug}`} episode={e} />
            ))}
          </div>
        )}
      </>
    );
  }

  // ── 门户态：分栏目展示 ──
  const bySeries = (slugs: string[]) =>
    home.episodes.filter((e) => slugs.includes(e.series_slug));
  const podcastEps = bySeries([PODCAST_SERIES]);
  const podcastMain = home.featured?.episode ?? podcastEps[0] ?? null;
  const podcastRest = podcastEps.filter(
    (e) => e.slug !== podcastMain?.slug
  );
  const kidEps = home.episodes.filter(
    (e) => e.has_interactive || e.video_audiences.includes('child')
  );
  const shengxueEps = bySeries(SHENGXUE_SERIES);
  const stemEps = bySeries([STEM_SERIES]);

  const seriesMeta = (slug: string) => home.series.find((s) => s.slug === slug);

  return (
    <>
      {/* ① 家长减负博客（与孩子互动） */}
      {podcastMain && (
        <section className="home-section" aria-label="家长减负博客">
          <SectionHead
            title="家长减负博客 · 与孩子互动"
            sub="一期一个话题：家长播客讲清楚，互动演示一起玩"
          />
          <div
            className="hero__card"
            style={{ '--theme': podcastMain.theme_color } as React.CSSProperties}
          >
            <div>
              {home.featured?.note && <div className="hero__note">{home.featured.note}</div>}
              <div className="hero__series">
                {podcastMain.series_title} · 第 {podcastMain.episode_no} 集
              </div>
              <h1 className="hero__title">{podcastMain.title}</h1>
              <p className="hero__summary">{podcastMain.summary}</p>
              <div className="hero__actions">
                <Link className="btn-primary" to={podcastMain.url}>
                  立即收看 →
                </Link>
                <AudienceBadges
                  audience={podcastMain.audience}
                  themeColor={podcastMain.theme_color}
                />
                <ResourceBadges episode={podcastMain} />
              </div>
            </div>
            <Link className="hero__cover" to={podcastMain.url} aria-hidden>
              <img
                src={podcastMain.cover ?? '/content/assets/default-cover.svg'}
                alt={podcastMain.title}
              />
            </Link>
          </div>
          {podcastRest.length > 0 && (
            <div className="entry-list">
              {podcastRest.map((e) => (
                <EntryRow key={e.url} e={e} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ② 儿童互动视频 */}
      {kidEps.length > 0 && (
        <section className="home-section" aria-label="儿童互动视频">
          <SectionHead title="儿童互动视频" sub="给孩子看的：点一点、玩一玩、跟着动画走" />
          <div className="kid-grid">
            {kidEps.map((e) => (
              <EpisodeCard key={`kid-${e.url}`} episode={e} />
            ))}
          </div>
        </section>
      )}

      {/* ③ 升学和学位 */}
      {shengxueEps.length > 0 && (
        <section className="home-section" aria-label="升学和学位">
          <SectionHead title="升学和学位" sub="路更多、境更大：规划要趁早，学位要看懂" />
          <div className="shengxue-cols">
            {SHENGXUE_SERIES.map((slug) => {
              const meta = seriesMeta(slug);
              const eps = shengxueEps.filter((e) => e.series_slug === slug);
              if (!meta || eps.length === 0) return null;
              return (
                <div className="shengxue-group" key={slug}>
                  <div className="shengxue-group__title">
                    <span className="dot" style={{ background: meta.theme_color }} />
                    {meta.title}
                    <span className="count">{eps.length}</span>
                  </div>
                  <div className="entry-list entry-list--one">
                    {eps.map((e) => (
                      <EntryRow key={e.url} e={e} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ④ STEM 和 CS 学习 */}
      {stemEps.length > 0 && (
        <section className="home-section" aria-label="STEM 和 CS 学习">
          <SectionHead
            title="STEM 和 CS 学习"
            sub="几岁学什么、怎么学不焦虑：编程、数理、哲思与工具"
          />
          <div className="entry-list entry-list--tri">
            {stemEps.map((e) => (
              <EntryRow key={e.url} e={e} />
            ))}
          </div>
        </section>
      )}

      {/* 频道介绍 */}
      {home.site.description && (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          {home.site.description}
        </div>
      )}
    </>
  );
}
