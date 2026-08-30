import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { showApi } from '../api';
import type { KnowHome } from '../types';
import { emptyFilters, filterEpisodes, type EpisodeFilters } from '../lib/filter';
import FilterBar from '../components/FilterBar';
import EpisodeCard from '../components/EpisodeCard';
import { AudienceBadges, ResourceBadges } from '../components/Badges';

/** 频道首页：本期主打 + 系列/面向/标签筛选 + 卡片流（搜索词由顶栏经 ?q= 传入） */
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
    document.title = '与孩子对话 · STEM 与亲子共学节目频道';
  }, []);

  const episodes = useMemo(
    () => (home ? filterEpisodes(home.episodes, filters) : []),
    [home, filters]
  );

  const featured = home?.featured ?? null;

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

  return (
    <>
      {featured && !hasFilter && (
        <section className="hero" aria-label="本期主打">
          <div
            className="hero__card"
            style={{ '--theme': featured.episode.theme_color } as React.CSSProperties}
          >
            <div>
              {featured.note && <div className="hero__note">{featured.note}</div>}
              <div className="hero__series">
                {featured.episode.series_title} · 第 {featured.episode.episode_no} 集
              </div>
              <h1 className="hero__title">{featured.episode.title}</h1>
              <p className="hero__summary">{featured.episode.summary}</p>
              <div className="hero__actions">
                <Link className="btn-primary" to={featured.episode.url}>
                  立即观看 →
                </Link>
                <AudienceBadges
                  audience={featured.episode.audience}
                  themeColor={featured.episode.theme_color}
                />
                <ResourceBadges episode={featured.episode} />
              </div>
            </div>
            <Link className="hero__cover" to={featured.episode.url} aria-hidden>
              <img
                src={featured.episode.cover ?? '/content/assets/default-cover.svg'}
                alt={featured.episode.title}
              />
            </Link>
          </div>
        </section>
      )}

      <FilterBar
        filters={filters}
        series={home.series}
        tags={home.tags}
        onChange={setFilters}
      />

      {episodes.length === 0 ? (
        <div className="empty-state">
          没有找到相关节目
          <br />
          <button
            onClick={() =>
              setFilters({ ...emptyFilters, q: '' })
            }
          >
            清除筛选
          </button>
        </div>
      ) : (
        <div className="ep-grid">
          {episodes.map((e) => (
            <EpisodeCard key={`${e.series_slug}/${e.slug}`} episode={e} />
          ))}
        </div>
      )}

      {/* 频道介绍放在流末尾，保持首屏克制 */}
      {!hasFilter && home.site.description && (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          {home.site.description}
        </div>
      )}
    </>
  );
}
