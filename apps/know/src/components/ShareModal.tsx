import { useEffect, useState } from 'react';

import { buildPosterCanvas } from '../lib/poster';
import type { EpisodeDetail } from '../types';

/**
 * 分享海报弹窗：生成 1080×1920 竖版海报（带二维码）。
 * 手机：长按图片保存 → 发朋友圈；桌面：点「下载海报」。
 */
export default function ShareModal({
  episode,
  onClose,
}: {
  episode: EpisodeDetail;
  onClose: () => void;
}) {
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    buildPosterCanvas(episode)
      .then((canvas) => {
        if (alive) setDataUrl(canvas.toDataURL('image/png'));
      })
      .catch((e: Error) => {
        if (alive) setError(e.message || '生成失败');
      });
    return () => {
      alive = false;
    };
  }, [episode]);

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
    a.download = `与孩子对话-${episode.series_title}-${episode.title}.png`.replace(/[\\/:*?"<>|]/g, '');
    a.click();
  };

  return (
    <div className="share-overlay" onClick={onClose} role="dialog" aria-label="分享海报">
      <div className="share-panel" onClick={(e) => e.stopPropagation()}>
        <button className="share-close" onClick={onClose} aria-label="关闭">
          ✕
        </button>

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
