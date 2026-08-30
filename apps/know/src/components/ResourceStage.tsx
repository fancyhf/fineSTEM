import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { normalizeEmbedUrl } from '../api';
import type { EpisodeDetail, VideoResource } from '../types';

interface TabDef {
  id: string;
  label: string;
  kind: 'video' | 'interactive';
  video?: VideoResource;
  disabled?: boolean;
  note?: string;
}

/**
 * Tab 生成规则（固定槽位，有资源才有 tab）：
 *   家长播客 → 互动演示 → 儿童视频 → 其余视频（audience 为空的通用视频）
 *   （频道面向家长：家长播客永远排第一、默认激活）
 * 未上线的槽位若在 announce 里声明，则渲染禁用 tab + 提示文案。
 */
export function buildTabs(ep: EpisodeDetail): TabDef[] {
  const tabs: TabDef[] = [];
  const findVideo = (audience: 'parent' | 'child') =>
    ep.resources.videos.find((v) => v.audience === audience);
  const announce = ep.announce ?? {};

  const slots: { id: string; label: string; kind: TabDef['kind'] }[] = [
    { id: 'parent-video', label: '家长播客', kind: 'video' },
    { id: 'interactive', label: '互动演示', kind: 'interactive' },
    { id: 'child-video', label: '儿童视频', kind: 'video' },
  ];

  const usedVideoIds = new Set<string>();
  for (const slot of slots) {
    if (slot.kind === 'interactive') {
      if (ep.resources.interactive) tabs.push({ ...slot });
      continue;
    }
    const v = findVideo(slot.id === 'parent-video' ? 'parent' : 'child');
    if (v) {
      usedVideoIds.add(v.id);
      tabs.push({ ...slot, video: v });
    } else if (announce[slot.id]) {
      tabs.push({ ...slot, disabled: true, note: announce[slot.id] });
    }
  }

  for (const v of ep.resources.videos) {
    if (usedVideoIds.has(v.id)) continue;
    if (v.audience === 'child' || v.audience === 'parent') continue;
    tabs.push({ id: v.id, label: v.title || '视频', kind: 'video', video: v });
  }

  const known = new Set(tabs.map((t) => t.id));
  for (const [key, note] of Object.entries(announce)) {
    if (known.has(key)) continue;
    tabs.push({
      id: key,
      label: key === 'video' ? '视频' : key,
      kind: 'video',
      disabled: true,
      note,
    });
  }
  return tabs;
}

export function pickDefaultTab(ep: EpisodeDetail, tabs: TabDef[]): string {
  if (ep.default_tab) {
    const t = tabs.find((x) => x.id === ep.default_tab && !x.disabled);
    if (t) return t.id;
  }
  for (const id of ['parent-video', 'interactive', 'child-video', 'video']) {
    const t = tabs.find((x) => x.id === id && !x.disabled);
    if (t) return t.id;
  }
  return tabs.find((t) => !t.disabled)?.id ?? '';
}

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
