import { Link } from 'react-router-dom';

import type { EpisodeSummary } from '../types';
import Seal from './Seal';
import { AudienceBadges, ResourceBadges } from './Badges';

const DEFAULT_COVER = '/content/assets/default-cover.svg';

/** 节目卡：封面 + 标题 + 一句话 + 印章集数 + 面向/资源徽标 */
export default function EpisodeCard({ episode }: { episode: EpisodeSummary }) {
  const style = { '--theme': episode.theme_color } as React.CSSProperties;
  return (
    <Link to={episode.url} className="ep-card" style={style}>
      <div className="ep-card__cover">
        <img src={episode.cover ?? DEFAULT_COVER} alt="" loading="lazy" />
      </div>
      <div className="ep-card__body">
        <div className="ep-card__title">{episode.title}</div>
        <p className="ep-card__summary">{episode.summary}</p>
        <div className="ep-card__meta">
          <Seal no={episode.episode_no} />
          <span className="ep-card__brand">{episode.series_title}</span>
          <AudienceBadges audience={episode.audience} themeColor={episode.theme_color} />
        </div>
        <ResourceBadges episode={episode} />
      </div>
    </Link>
  );
}
