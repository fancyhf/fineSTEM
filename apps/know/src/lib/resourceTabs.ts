import type { EpisodeDetail, VideoResource } from '../types';

/**
 * 资源区 tab 定义：固定槽位（家长播客 / 互动演示 / 儿童视频）+ 其余通用视频。
 * 来源：.trae/documents/media/know-resource-stage.md（资源区槽位规则）
 */
export interface TabDef {
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

/**
 * 默认激活 tab：优先 episode.default_tab（且该 tab 可用），
 * 否则按 家长播客 > 互动演示 > 儿童视频 > 通用视频 的顺序回退。
 */
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
