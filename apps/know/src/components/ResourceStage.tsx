import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { normalizeEmbedUrl } from '../api';
import { buildTabs, pickDefaultTab } from '../lib/resourceTabs';
import type { EpisodeDetail } from '../types';

/** tab 上的占位提示：去掉与 label 重复的前缀（如“儿童视频 · 即将上线”→“即将上线”） */
function tabNoteText(label: string, note?: string): string {
  if (!note) return '即将上线';
  const stripped = note.replace(label, '').replace(/^[·\s]+/, '').trim();
  return stripped || '即将上线';
}

/** 节目主资源区：tabs + 16:9 舞台（嵌入视频 / 互动 iframe，激活时才加载） */
export default function ResourceStage({ episode }: { episode: EpisodeDetail }) {
  const tabs = useMemo(() => buildTabs(episode), [episode]);
  const [active, setActive] = useState(() => pickDefaultTab(episode, tabs));
  const activeTab = tabs.find((t) => t.id === active) ?? tabs.find((t) => !t.disabled);

  const playUrl = `/ep/${episode.series_slug}/${episode.slug}/play`;

  return (
    <div>
      <div className="stage-bar">
        <span className="stage-bar__title">{activeTab?.label ?? '资源'}</span>
        {activeTab?.id === 'interactive' && (
          <Link className="btn-ghost" to={playUrl}>
            全屏观看 ⛶
          </Link>
        )}
        {activeTab?.video?.page && (
          <a
            className="btn-ghost"
            href={activeTab.video.page}
            target="_blank"
            rel="noopener noreferrer"
          >
            去原站看 ↗
          </a>
        )}
      </div>

      <div className="stage">
        <div className="stage__frame">
          {activeTab?.disabled && (
            <div className="stage__placeholder">
              <span>{activeTab.note ?? '即将上线'}</span>
            </div>
          )}
          {activeTab && !activeTab.disabled && activeTab.kind === 'video' && activeTab.video && (
            <iframe
              key={activeTab.video.id}
              src={normalizeEmbedUrl(activeTab.video.embed_url)}
              title={activeTab.video.title}
              allow="fullscreen; autoplay"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
          {activeTab && !activeTab.disabled && activeTab.kind === 'interactive' && (
            <iframe
              key="interactive"
              src={episode.resources.interactive!.url}
              title={episode.resources.interactive!.title}
              sandbox="allow-scripts allow-pointer-lock"
            />
          )}
        </div>
      </div>

      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === activeTab?.id}
            className={[
              'tab',
              t.id === activeTab?.id ? 'is-active' : '',
              t.disabled ? 'is-disabled' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => !t.disabled && setActive(t.id)}
          >
            {t.label}
            {t.disabled && <span className="tab__note">{tabNoteText(t.label, t.note)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
