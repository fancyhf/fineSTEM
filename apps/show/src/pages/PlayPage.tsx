import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { showApi } from '../api';
import type { EpisodeDetail } from '../types';

/**
 * 互动全屏页：整屏即动画（学习机/电视/投屏场景，孩子向多端独立观看）。
 * 无互动资源的节目自动回落到详情页。
 */
export default function PlayPage() {
  const { seriesSlug, epSlug } = useParams<{ seriesSlug: string; epSlug: string }>();
  const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!seriesSlug || !epSlug) return;
    showApi
      .episode(seriesSlug, epSlug)
      .then(setEpisode)
      .catch((e: Error) => setError(e.message));
  }, [seriesSlug, epSlug]);

  useEffect(() => {
    document.title = episode
      ? `${episode.resources.interactive?.title ?? episode.title} · 放映室`
      : '放映室';
  }, [episode]);

  if (error || (episode && !episode.resources.interactive)) {
    // 无互动资源：回到详情页
    if (episode) {
      return <FullscreenBack to={episode.url} />;
    }
    return (
      <div className="play-page">
        <div className="page-error">
          <div className="page-error__title">节目不存在</div>
          <p className="page-error__desc">
            <Link to="/">回首页 →</Link>
          </p>
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="play-page">
        <div className="loading">加载中…</div>
      </div>
    );
  }

  return (
    <div className="play-page">
      <iframe
        src={episode.resources.interactive!.url}
        title={episode.resources.interactive!.title}
        sandbox="allow-scripts allow-pointer-lock"
      />
      <Link className="play-page__exit" to={episode.url}>
        退出全屏
      </Link>
    </div>
  );
}

/** 极简回落：链接回详情页（不用 <Navigate>，保留浏览器历史自然回退） */
function FullscreenBack({ to }: { to: string }) {
  return (
    <div className="play-page">
      <div className="page-error">
        <div className="page-error__title">本集没有互动演示</div>
        <p className="page-error__desc">
          <Link to={to}>回节目页 →</Link>
        </p>
      </div>
    </div>
  );
}
