import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { showApi } from '../api';
import type { EpisodeDetail } from '../types';
import { renderMarkdown } from '../lib/markdown';
import ResourceStage from '../components/ResourceStage';
import Seal from '../components/Seal';
import { AudienceBadges } from '../components/Badges';
import { DocList, ProjectList } from '../components/DocList';

/** 节目详情页（核心页面）：资源 tabs + 说明 + 资料 + 相关项目 + 上下集 */
export default function EpisodePage() {
  const { seriesSlug, epSlug } = useParams<{ seriesSlug: string; epSlug: string }>();
  const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setEpisode(null);
    setError('');
    if (!seriesSlug || !epSlug) return;
    showApi
      .episode(seriesSlug, epSlug)
      .then(setEpisode)
      .catch((e: Error) => setError(e.message));
  }, [seriesSlug, epSlug]);

  useEffect(() => {
    if (episode) document.title = `${episode.title} · ${episode.series_title} · 放映室`;
  }, [episode]);

  const descHtml = useMemo(
    () => (episode ? renderMarkdown(episode.description_md) : ''),
    [episode]
  );

  if (error) {
    return (
      <div className="page-error">
        <div className="page-error__title">节目不存在</div>
        <p className="page-error__desc">
          <Link to="/">回首页 →</Link>
        </p>
      </div>
    );
  }
  if (!episode) return <div className="loading">加载中…</div>;

  return (
    <div style={{ '--theme': episode.theme_color } as React.CSSProperties}>
      <nav className="ep-header">
        <Link to="/">放映室</Link> / <Link to={`/series/${episode.series_slug}`}>{episode.series_title}</Link>{' '}
        / 第 {episode.episode_no} 集
      </nav>

      <ResourceStage episode={episode} />

      <div className="ep-meta">
        <Seal no={episode.episode_no} large />
        <div className="ep-meta__main">
          <h1 className="ep-meta__title">{episode.title}</h1>
          {episode.summary && <p className="ep-meta__summary">{episode.summary}</p>}
          <div className="ep-tags">
            <AudienceBadges audience={episode.audience} themeColor={episode.theme_color} />
            {episode.tags.map((t) => (
              <Link key={t} to={`/?q=${encodeURIComponent(t)}`}>
                #{t}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {descHtml && (
        <div className="ep-desc" dangerouslySetInnerHTML={{ __html: descHtml }} />
      )}

      {episode.resources.docs.length > 0 && (
        <>
          <h2 className="section-title">本集资料</h2>
          <DocList docs={episode.resources.docs} />
        </>
      )}

      {episode.resources.projects.length > 0 && (
        <>
          <h2 className="section-title">相关项目</h2>
          <ProjectList projects={episode.resources.projects} />
        </>
      )}

      {(episode.prev || episode.next) && (
        <nav className="ep-nav">
          {episode.prev ? (
            <Link className="ep-nav__btn" to={episode.prev.url}>
              <span className="ep-nav__label">← 上一集</span>
              <span className="ep-nav__title">
                第 {episode.prev.episode_no} 集 · {episode.prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {episode.next && (
            <Link className="ep-nav__btn ep-nav__btn--next" to={episode.next.url}>
              <span className="ep-nav__label">下一集 →</span>
              <span className="ep-nav__title">
                第 {episode.next.episode_no} 集 · {episode.next.title}
              </span>
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
