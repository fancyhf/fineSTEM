import { useEffect, useState } from 'react';

import { buildPosterCanvas, POSTER_PALETTES } from '../lib/poster';
import type { EpisodeDetail } from '../types';

/**
 * 分享海报弹窗：1080×1920 竖版海报（带二维码），三种鲜亮配色可选，
 * 可勾选是否贴上节目封面。手机长按保存发朋友圈；桌面点下载。
 */
export default function ShareModal({
  episode,
  onClose,
}: {
  episode: EpisodeDetail;
  onClose: () => void;
}) {
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [withCover, setWithCover] = useState(true);
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');

  const hasCover = !!episode.cover;

  useEffect(() => {
    let alive = true;
    setDataUrl('');
    buildPosterCanvas(episode, paletteIdx, withCover && hasCover)
      .then((canvas) => {
        if (alive) setDataUrl(canvas.toDataURL('image/png'));
      })
      .catch((e: Error) => {
        if (alive) setError(e.message || '生成失败');
      });
    return () => {
      alive = false;
    };
  }, [episode, paletteIdx, withCover, hasCover]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const download = () => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `与孩子对话-${episode.series_title}-${episode.title}.png`.replace(
      /[\\/:*?"<>|]/g,
      ''
    );
    a.click();
  };

  return (
    <div className="share-overlay" onClick={onClose} role="dialog" aria-label="分享海报">
      <div className="share-panel" onClick={(e) => e.stopPropagation()}>
        <button className="share-close" onClick={onClose} aria-label="关闭">
          ✕
        </button>

        {/* 配色选择 + 封面勾选 */}
        <div className="share-palettes" role="group" aria-label="选择海报配色">
          {POSTER_PALETTES.map((p, i) => (
            <button
              key={p.id}
              className={`share-palette${i === paletteIdx ? ' is-active' : ''}`}
              onClick={() => setPaletteIdx(i)}
              style={{
                background: `linear-gradient(135deg, ${p.bgTop}, ${p.bgBottom})`,
              }}
            >
              {p.name}
            </button>
          ))}
        </div>

        <label className={`share-cover-toggle${hasCover ? '' : ' is-disabled'}`}>
          <input
            type="checkbox"
            checked={withCover && hasCover}
            disabled={!hasCover}
            onChange={(e) => setWithCover(e.target.checked)}
          />
          在海报中展示节目封面
        </label>

        {error ? (
          <div className="share-error">海报生成失败：{error}</div>
        ) : dataUrl ? (
          <>
            <img className="share-poster" src={dataUrl} alt="分享海报" />
            <div className="share-hint">
              <p className="share-hint__main">📱 长按海报图片，保存到相册后即可发朋友圈</p>
              <button className="btn-ghost" onClick={download}>
                下载海报 ⬇
              </button>
            </div>
          </>
        ) : (
          <div className="share-loading">海报生成中…</div>
        )}
      </div>
    </div>
  );
}
