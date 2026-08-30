import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { showApi } from '../api';
import { CATEGORIES, episodesOfCategory } from '../categories';
import type { KnowHome } from '../types';
import { emptyFilters, filterEpisodes, type EpisodeFilters } from '../lib/filter';
import FilterBar from '../components/FilterBar';
import EpisodeCard from '../components/EpisodeCard';
import EntryRow from '../components/EntryRow';
import { AudienceBadges, ResourceBadges } from '../components/Badges';

/**
 * 首页 = 门户布局：
 *   ① 家长减负博客 大卡 → ② 四栏目大入口 → ③ 各栏目分区（预览）
 * 搜索态（?q= 或筛选）退回通用筛选结果流。
 */
const PODCAST_SERIES = 'recursive-beauty';
const SHENGXUE_SERIES = ['duoyuan-shengxue', 'mengmu-xuewei'];
const STEM_SERIES = 'stem-cs';

function SectionHead({
  title,
  sub,
  cid,
  color,
}: {
  title: string;
  sub?: string;
  cid: string;
  color: string;
}) {
  return (
    <header className="home-section__head">
      <h2 style={{ color }}>{title}</h2>
      {sub && <span className="home-section__sub">{sub}</span>}
      <span className="home-section__rule" style={{ backgroundImage: `linear-gradient(90deg, ${color}66, var(--line))` }} />
      <Link className="home-section__more" to={`/c/${cid}`}>
        进入栏目 →
      </Link>
    </header>
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

  // ── 门户态 ──
  const cat = (cid: string) => CATEGORIES.find((c) => c.cid === cid)!;
  const catEps = (cid: string) => episodesOfCategory(cat(cid), home.episodes);
  const seriesMeta = (slug: string) => home.series.find((s) => s.slug === slug);

  const podcastCat = cat('podcast');
  const podcastEps = catEps('podcast');
  const podcastMain = home.featured?.episode ?? podcastEps[0] ?? null;
  const podcastRest = podcastEps.filter((e) => e.slug !== podcastMain?.slug);
  const kidEps = catEps('kids');
  const stemEps = catEps('stem');

  const tiles = CATEGORIES.map((c) => ({
    ...c,
    count: catEps(c.cid).length,
  }));

  return (
    <>
      {/* ① 家长减负博客 大卡 */}
      {podcastMain && (
        <section
          className="home-section"
          id="sec-podcast"
          aria-label="家长减负博客"
          style={{ '--theme': podcastCat.color } as React.CSSProperties}
        >
          <SectionHead
            title={podcastCat.title}
            sub={podcastCat.sub}
            cid="podcast"
            color={podcastCat.color}
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
        </section>
      )}

      {/* ② 四栏目大入口 */}
      <nav className="portal-nav" aria-label="栏目入口">
        {tiles.map((t) => (
          <Link
            className="portal-tile"
            key={t.cid}
            to={`/c/${t.cid}`}
            style={{ '--tile': t.color } as React.CSSProperties}
          >
            <span className="portal-tile__icon" aria-hidden>{t.icon}</span>
            <span className="portal-tile__main">
              <span className="portal-tile__title">{t.short}</span>
              <span className="portal-tile__sub">{t.sub}</span>
            </span>
            <span className="portal-tile__count">{t.count} 集</span>
          </Link>
        ))}
      </nav>

      {/* ③ 儿童互动视频 */}
      {kidEps.length > 0 && (
        <section
          className="home-section"
          id="sec-kids"
          aria-label="儿童互动视频"
          style={{ '--theme': cat('kids').color } as React.CSSProperties}
        >
          <SectionHead
            title={cat('kids').title}
            sub={cat('kids').sub}
            cid="kids"
            color={cat('kids').color}
          />
          <div className="kid-grid">
            {kidEps.map((e) => (
              <EpisodeCard key={`kid-${e.url}`} episode={e} />
            ))}
          </div>
        </section>
      )}

      {/* ④ 升学和学位 */}
      {catEps('shengxue').length > 0 && (
        <section
          className="home-section"
          id="sec-shengxue"
          aria-label="升学和学位"
          style={{ '--theme': cat('shengxue').color } as React.CSSProperties}
        >
          <SectionHead
            title={cat('shengxue').title}
            sub={cat('shengxue').sub}
            cid="shengxue"
            color={cat('shengxue').color}
          />
          <div className="shengxue-cols">
            {SHENGXUE_SERIES.map((slug) => {
              const meta = seriesMeta(slug);
              const eps = home.episodes.filter((e) => e.series_slug === slug);
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

      {/* ⑤ STEM 和 CS 学习 */}
      {stemEps.length > 0 && (
        <section
          className="home-section"
          id="sec-stem"
          aria-label="STEM 和 CS 学习"
          style={{ '--theme': cat('stem').color } as React.CSSProperties}
        >
          <SectionHead
            title={cat('stem').title}
            sub={cat('stem').sub}
            cid="stem"
            color={cat('stem').color}
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
