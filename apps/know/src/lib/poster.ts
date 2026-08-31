/**
 * 分享海报生成（1080×1920 竖版，朋友圈 9:16 标准）
 *
 * 结构遵循教育类分享海报的三段式（全网通用范式）：
 *   头部：品牌行 + 系列名 + 主标题 + 一句话摘要（顶部留刘海安全区）
 *   中部：本集包含的卖点罗列（家长播客/互动演示/儿童视频/配套资料）
 *   底部：二维码 + 行动号召「扫码直接收看」
 *
 * 视觉沿用频道封面语言：节目主题色深底 + 米白宋体 + 金色点缀。
 * 全部元素本地绘制（矢量+文字+本地生成二维码），canvas 无跨域污染，可直接导出 PNG。
 */

import qrcode from 'qrcode-generator';
import type { EpisodeDetail } from '../types';

const W = 1080;
const H = 1920;
const PAPER = '#F7F5F1';
const GOLD = '#E3B83A';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 自动换行：返回行数组 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(cur);
      cur = '';
      continue;
    }
    if (ctx.measureText(cur + ch).width > maxWidth) {
      lines.push(cur);
      cur = ch;
      if (lines.length === maxLines) break;
    } else {
      cur += ch;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (ctx.measureText(last).width > maxWidth || text.length > lines.join('').length) {
      lines[maxLines - 1] = last.slice(0, Math.max(0, last.length - 1)) + '…';
    }
  }
  return lines;
}

/** 本集卖点（按实际资源动态生成，最多 4 条） */
export function episodeHighlights(ep: EpisodeDetail): string[] {
  const items: string[] = [];
  const va = ep.video_audiences ?? [];
  if (va.includes('parent')) items.push('家长播客 · 把一个话题讲透');
  if (ep.has_interactive) items.push('互动演示 · 和孩子一起玩');
  if (va.includes('child')) items.push('儿童视频 · 孩子自己就能看');
  if (ep.has_docs) items.push('配套资料 · 拿走就能用');
  if (items.length === 0) items.push('一次讲透一个话题');
  return items.slice(0, 4);
}

/** 确保 webfont 就绪（canvas 使用前必须显式加载） */
async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('700 80px "Noto Serif SC"', '与孩子对话'),
      document.fonts.load('400 34px "Noto Serif SC"', '与孩子对话'),
    ]);
    await document.fonts.ready;
  } catch {
    /* 字体加载失败则回退系统字体 */
  }
}

export interface PosterPalette {
  id: string;
  name: string;
  bgTop: string;
  bgBottom: string;
  accent: string; // 高亮点缀（系列行/勾选框）
}

/** 三套鲜亮活泼配色（朋友圈海报可选） */
export const POSTER_PALETTES: PosterPalette[] = [
  { id: 'orange', name: '活力橙', bgTop: '#FF8A3D', bgBottom: '#F5532C', accent: '#FFEDB8' },
  { id: 'blue', name: '清新蓝', bgTop: '#2BB3B0', bgBottom: '#1E7EC8', accent: '#FFF3C4' },
  { id: 'pink', name: '莓果粉', bgTop: '#FF6B9D', bgBottom: '#F0426E', accent: '#FFF3C4' },
];

async function drawQR(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number
): Promise<void> {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 4; // 二维码静区（规范建议 4 模块）
  const cell = size / (count + quiet * 2);
  // 白底圆角卡片保证扫码对比度
  ctx.fillStyle = PAPER;
  roundRect(ctx, x, y, size, size, 18);
  ctx.fill();
  ctx.fillStyle = '#29251F';
  const origin = x + quiet * cell;
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect(
          origin + c * cell,
          y + quiet * cell + r * cell,
          Math.ceil(cell),
          Math.ceil(cell)
        );
      }
    }
  }
}

/** 生成分享海报，返回 canvas（调用方 toDataURL / toBlob）。paletteIdx 选三套配色之一 */
export async function buildPosterCanvas(
  ep: EpisodeDetail,
  paletteIdx = 0
): Promise<HTMLCanvasElement> {
  await ensureFonts();

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const pal = POSTER_PALETTES[paletteIdx] ?? POSTER_PALETTES[0];
  const serif = '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif';

  // 鲜亮渐变底
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, pal.bgTop);
  grad.addColorStop(1, pal.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 活泼装饰：大半透明圆
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.arc(W - 60, 210, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, 780, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W - 120, 1160, 90, 0, Math.PI * 2);
  ctx.fill();

  // 内框（细白线）
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  roundRect(ctx, 36, 36, W - 72, H - 72, 28);
  ctx.stroke();

  const LX = 90; // 左边距

  // ── 头部（刘海安全区之下）：品牌行 ──
  let y = 168;
  // 双气泡台标（简版）
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 6;
  roundRect(ctx, LX, y - 34, 56, 40, 14);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  roundRect(ctx, LX + 34, y - 16, 32, 24, 9);
  ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.font = `700 42px ${serif}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('与孩子对话', LX + 84, y);
  ctx.font = `400 26px ${serif}`;
  ctx.fillStyle = 'rgba(247,245,241,0.66)';
  ctx.fillText('给家长的播客与互动节目', LX + 84, y + 44);

  // 系列名（点缀色） + 线
  y = 380;
  ctx.fillStyle = pal.accent;
  ctx.font = `700 34px ${serif}`;
  ctx.fillText(ep.series_title, LX, y);
  const sw = ctx.measureText(ep.series_title).width;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(`第 ${ep.episode_no} 集`, LX + sw + 28, y);
  ctx.fillStyle = pal.accent;
  ctx.fillRect(LX, y + 26, 340, 5);

  // 主标题：优先单行（自动缩字号），实在放不下再换行，避免孤字
  y = 540;
  ctx.fillStyle = PAPER;
  const maxTitleW = W - LX * 2 - 40;
  let titleSize = 88;
  ctx.font = `700 ${titleSize}px ${serif}`;
  while (titleSize > 60 && ctx.measureText(ep.title).width >= maxTitleW) {
    titleSize -= 8;
    ctx.font = `700 ${titleSize}px ${serif}`;
  }
  const fits = ctx.measureText(ep.title).width < maxTitleW;
  const titleLines = fits ? [ep.title] : wrapText(ctx, ep.title, maxTitleW, 3);
  for (const line of titleLines) {
    ctx.fillText(line, LX, y);
    y += titleSize * 1.32;
  }

  // 摘要（最多 3 行）
  y += 26;
  ctx.font = `400 34px ${serif}`;
  ctx.fillStyle = 'rgba(247,245,241,0.78)';
  const sumLines = wrapText(ctx, ep.summary || '', W - LX * 2 - 40, 3);
  for (const line of sumLines) {
    ctx.fillText(line, LX, y);
    y += 54;
  }

  // ── 中部：本集包含 ──
  y += 66;
  ctx.fillStyle = pal.accent;
  ctx.font = `700 30px ${serif}`;
  ctx.fillText('本 集 包 含', LX, y);
  y += 56;
  ctx.font = `400 36px ${serif}`;
  for (const item of episodeHighlights(ep)) {
    // 勾选框
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 5;
    roundRect(ctx, LX, y - 34, 40, 40, 9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(LX + 9, y - 15);
    ctx.lineTo(LX + 17, y - 6);
    ctx.lineTo(LX + 31, y - 24);
    ctx.stroke();
    ctx.fillStyle = PAPER;
    ctx.fillText(item, LX + 64, y);
    y += 76;
  }

  // ── 底部：二维码 + 行动号召 ──
  const panelY = H - 470;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, 60, panelY, W - 120, 360, 20);
  ctx.fill();

  const qrSize = 270;
  const shareUrl = `${window.location.origin}${ep.url}`;
  await drawQR(ctx, shareUrl, LX, panelY + 45, qrSize);

  const tx = LX + qrSize + 56;
  ctx.fillStyle = PAPER;
  ctx.font = `700 44px ${serif}`;
  ctx.fillText('扫码直接收看', tx, panelY + 118);
  ctx.font = `400 26px ${serif}`;
  ctx.fillStyle = 'rgba(247,245,241,0.66)';
  ctx.fillText('家长播客 × 互动演示 × 配套资料', tx, panelY + 172);
  ctx.font = `400 22px monospace`;
  ctx.fillStyle = 'rgba(247,245,241,0.45)';
  ctx.fillText(shareUrl.slice(0, 42), tx, panelY + 214);

  ctx.fillStyle = pal.accent;
  ctx.font = `700 26px ${serif}`;
  ctx.fillText('与孩子对话 × fineSTEM 出品', tx, panelY + 258);

  return canvas;
}
