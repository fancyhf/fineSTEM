import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { showApi } from '../api';
import { CATEGORIES, episodesOfCategory } from '../categories';
import type { KnowHome } from '../types';
import EpisodeCard from '../components/EpisodeCard';

/** 栏目独立首页：/c/:cid —— 栏目头（主题色）+ 按系列分组的全部节目 */
export default function CategoryPage() {
  const { cid } = useParams<{ cid: string }>();
  const cat = CATEGORIES.find((c) => c.cid === cid);
  const [home, setHome] = useState<KnowHome | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    showApi
      .home()
      .then(setHome)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    document.title = cat ? `${cat.title} · 与孩子对话` : '栏目 · 与孩子对话';
  }, [cat]);

  if (!cat) {
    return (
      <div className="page-error">
        <div className="page-error__title">没有这个栏目</div>
        <p className="page-error__desc">
          <Link to="/">回首页 →</Link>
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-error">
        <div className="page-error__title">出错了</div>
        <p className="page-error__desc">{error}</p>
      </div>
    );
  }
  if (!home) return <div className="loading">加载中…</div>;

  const eps = episodesOfCategory(cat, home.episodes);
  const seriesMeta = (slug: string) => home.series.find((s) => s.slug === slug);

  // 按系列分组（保持栏目定义顺序；kids 单组展示）
  const groups = (cat.series.length === 0)
    ? [{ slug: '', title: cat.title, color: cat.color, desc: '', eps }]
    : cat.series
        .map((slug) => ({
          slug,
          title: seriesMeta(slug)?.title ?? slug,
          color: seriesMeta(slug)?.theme_color ?? cat.color,
          desc: seriesMeta(slug)?.description ?? '',
          eps: eps.filter((e) => e.series_slug === slug),
        }))
        .filter((g) => g.eps.length > 0);

  const style = { '--theme': cat.color } as React.CSSProperties;

  return (
    <div style={style}>
      {/* 栏目头：主题色横幅 */}
      <header className="cat-hero">
        <span className="cat-hero__icon" aria-hidden>{cat.icon}</span>
        <div className="cat-hero__main">
          <h1>{cat.title}</h1>
          <p>{cat.sub}</p>
        </div>
        <span className="cat-hero__count">{eps.length} 集</span>
      </header>

      {eps.length === 0 && <div className="empty-state">本栏目内容筹备中，敬请期待</div>}

      {/* 大图瀑布流：多系列时保留系列分组标题，单一系列直接铺卡片 */}
      {groups.map((g) => (
        <section className="cat-group" key={g.slug || 'kids'}>
          {groups.length > 1 && (
            <>
              <div className="cat-group__title">
                <span className="dot" style={{ background: g.color }} />
                {g.slug && <Link to={`/series/${g.slug}`}>{g.title}</Link>}
                {!g.slug && g.title}
                <span className="count">{g.eps.length} 集</span>
              </div>
              {g.desc && <p className="cat-group__desc">{g.desc}</p>}
            </>
          )}
          <div className="ep-grid">
            {g.eps.map((e) => (
              <EpisodeCard key={e.url} episode={e} />
            ))}
          </div>
        </section>
      ))}

      <p className="cat-back">
        <Link to="/">← 回频道首页</Link>
      </p>
    </div>
  );
}
