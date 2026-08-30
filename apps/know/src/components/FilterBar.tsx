import type { EpisodeFilters } from '../lib/filter';
import type { Audience, SeriesSummary, TagStat } from '../types';

const AUDIENCE_OPTIONS: { value: '' | Audience; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'parent', label: '家长' },
  { value: 'child', label: '孩子' },
  { value: 'family', label: '亲子' },
];

interface FilterBarProps {
  filters: EpisodeFilters;
  series: SeriesSummary[];
  tags: TagStat[];
  onChange: (next: EpisodeFilters) => void;
}

/** 系列单选 × 面向单选 × 标签多选（搜索词在顶栏，经 ?q= 传入） */
export default function FilterBar({ filters, series, tags, onChange }: FilterBarProps) {
  const set = (patch: Partial<EpisodeFilters>) => onChange({ ...filters, ...patch });

  const toggleTag = (name: string) => {
    const has = filters.tags.includes(name);
    set({ tags: has ? filters.tags.filter((t) => t !== name) : [...filters.tags, name] });
  };

  return (
    <div className="filterbar">
      <div className="filterbar__row" role="group" aria-label="按系列筛选">
        <span className="filterbar__label">系列</span>
        <button className={`chip${filters.seriesSlug === '' ? ' is-active' : ''}`} onClick={() => set({ seriesSlug: '' })}>
          全部
        </button>
        {series.map((s) => (
          <button
            key={s.slug}
            className={`chip${filters.seriesSlug === s.slug ? ' is-active' : ''}`}
            onClick={() => set({ seriesSlug: s.slug })}
          >
            {s.title}
            <span className="chip__count">{s.episode_count}</span>
          </button>
        ))}
      </div>

      <div className="filterbar__row" role="group" aria-label="按面向筛选">
        <span className="filterbar__label">面向</span>
        {AUDIENCE_OPTIONS.map((o) => (
          <button
            key={o.label}
            className={`chip${filters.audience === o.value ? ' is-active' : ''}`}
            onClick={() => set({ audience: o.value })}
          >
            {o.label}
          </button>
        ))}
      </div>

      {tags.length > 0 && (
        <div className="filterbar__row" role="group" aria-label="按标签筛选">
          <span className="filterbar__label">标签</span>
          {tags.map((t) => (
            <button
              key={t.name}
              className={`chip${filters.tags.includes(t.name) ? ' is-active' : ''}`}
              aria-pressed={filters.tags.includes(t.name)}
              onClick={() => toggleTag(t.name)}
            >
              {t.name}
              <span className="chip__count">{t.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
