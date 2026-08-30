import { Link } from 'react-router-dom';

import Seal from './Seal';

interface EntryE {
  episode_no: number;
  title: string;
  summary: string;
  url: string;
}

/** FlowUs 式条目行：卷次章 + 标题 + 一句话 + 箭头（栏目页/首页共用） */
export default function EntryRow({
  e,
  color,
}: {
  e: EntryE;
  color?: string;
}) {
  return (
    <Link
      className="entry"
      to={e.url}
      style={{ '--theme': color } as React.CSSProperties}
    >
      <Seal no={e.episode_no} />
      <span className="entry__main">
        <span className="entry__title">{e.title}</span>
        <span className="entry__summary">{e.summary}</span>
      </span>
      <span className="entry__arrow">→</span>
    </Link>
  );
}
