import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { showApi } from '../api';
import type { SeriesDetail } from '../types';
import Seal from '../components/Seal';
import { AudienceBadges } from '../components/Badges';
import { DocList } from '../components/DocList';

const DEFAULT_COVER = '/content/assets/default-cover.svg';

const BRAND_TEXT: Record<string, string> = {
  jiwa: '鸡娃先自鸡',
  finestem: 'fineSTEM',
};

/** 系列页：系列介绍 + 连载时间线（最新在上） */
export default function SeriesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [detail, setDetail] = useState<SeriesDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setDetail(null);
    setError('');
    if (!slug) return;
    showApi
      .series(slug)
      .then(setDetail)
      .catch((e: Error) => setError(e.message));
  }, [slug]);

  useEffect(() => {
    if (detail) document.title = `${detail.title} · 与孩子对话`;
  }, [detail]);

  if (error) {
    return (
      <div className="page-error">
        <div className="page-error__title">系列不存在</div>
        <p className="page-error__desc">
          <Link to="/">回首页 →</Link>
        </p>
      </div>
    );
  }
  if (!detail) return <div className="loading">加载中…</div>;

  return (
    <div style={{ '--theme': detail.theme_color } as React.CSSProperties}>
      <header className="series-head">
        <div className="series-head__brand">
          {BRAND_TEXT[detail.brand] ?? detail.brand} · {detail.episode_count} 集
        </div>
        <h1 className="series-head__title">{detail.title}</h1>
        {detail.subtitle && <div className="series-head__subtitle">{detail.subtitle}</div>}
        {detail.description && <p className="series-head__desc">{detail.description}</p>}
        <div style={{ marginTop: 14 }}>
          <AudienceBadges audience={detail.audience} themeColor={detail.theme_color} />
        </div>
      </header>

      {detail.episodes.length === 0 ? (
        <div className="empty-state">本系列尚未发布节目</div>
      ) : (
        <div className="timeline">
          {detail.episodes.map((e) => (
            <Link key={e.slug} to={e.url} className="tl-item">
              <span className="tl-item__dot">
                <Seal no={e.episode_no} />
              </span>
              <div className="tl-item__main">
                <div className="tl-item__date">
                  {e.published_at ? `发布于 ${e.published_at}` : '待发布'}
                </div>
                <div className="tl-item__title">
                  第 {e.episode_no} 集 · {e.title}
                </div>
                <p className="tl-item__summary">{e.summary}</p>
              </div>
              <span className="tl-item__thumb">
                <img src={e.cover ?? DEFAULT_COVER} alt="" loading="lazy" />
              </span>
            </Link>
          ))}
        </div>
      )}

      {detail.docs.length > 0 && (
        <>
          <h2 className="section-title">系列资料</h2>
          <DocList docs={detail.docs} />
        </>
      )}
    </div>
  );
}
