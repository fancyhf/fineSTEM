import type { Audience, EpisodeSummary } from '../types';

const AUDIENCE_TEXT: Record<Audience, string> = {
  family: '亲子',
  parent: '家长',
  child: '儿童',
};

interface AudienceBadgesProps {
  audience: Audience;
  themeColor?: string;
}

/** 面向徽标：家长（墨框）/ 儿童（系列主题色框）/ 亲子（双签） */
export function AudienceBadges({ audience, themeColor }: AudienceBadgesProps) {
  const style = themeColor ? ({ '--theme': themeColor } as React.CSSProperties) : undefined;
  if (audience === 'family') {
    return (
      <span className="badges" style={style}>
        <span className="badge badge--parent">家长</span>
        <span className="badge badge--child">儿童</span>
      </span>
    );
  }
  return (
    <span className="badges" style={style}>
      <span className={`badge badge--${audience === 'parent' ? 'parent' : 'child'}`}>
        {AUDIENCE_TEXT[audience]}
      </span>
    </span>
  );
}

/** 资源类型提示：互动 / 家长视频 / 儿童视频 / 视频 / 资料 */
export function ResourceBadges({ episode }: { episode: EpisodeSummary }) {
  const items: string[] = [];
  if (episode.has_interactive) items.push('互动');
  if (episode.video_audiences.includes('parent')) items.push('家长视频');
  if (episode.video_audiences.includes('child')) items.push('儿童视频');
  if (episode.video_audiences.includes('video')) items.push('视频');
  if (episode.has_docs) items.push('资料');
  return (
    <span className="badges">
      {items.map((t) => (
        <span key={t} className="badge badge--ghost">
          {t}
        </span>
      ))}
    </span>
  );
}
