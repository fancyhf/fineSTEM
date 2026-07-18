/**
 * 封面图选择器
 *
 * 提供三种封面来源：项目运行截图（默认）、AI 生成、用户上传。
 * 由父组件通过 onUpdated 回调接收更新后的 AchievementCard。
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Sparkles, Upload, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';
import { achievementCardsApi, codeExecutionApi } from '../services/api';
import { showToast } from '../services/toast';
import { resolveImageUrl } from '../lib/image';
import { AchievementCard, ScreenshotOption } from '../types';

interface CoverPickerProps {
  /** 成果档案卡（必须有） */
  card: AchievementCard;
  /** 项目 ID（用于拉取项目截图） */
  projectId: string;
  /** 是否禁用（如成果卡尚未保存时） */
  disabled?: boolean;
  /** 封面更新后的回调 */
  onUpdated: (card: AchievementCard) => void;
  /**
   * 外部触发打开信号：父组件每次让此值递增，CoverPicker 就会自动展开面板。
   * 用于"右侧菜单按钮点击 → 滚动到此处 → 自动展开"的联动场景。
   */
  openSignal?: number;
}

export function CoverPicker({ card, projectId, disabled, onUpdated, openSignal }: CoverPickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'screenshots'>('menu');
  const [screenshots, setScreenshots] = useState<ScreenshotOption[]>([]);
  const [loadingScreenshots, setLoadingScreenshots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureHint, setCaptureHint] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // 记录上次处理过的 openSignal，避免重复触发
  const lastOpenSignalRef = useRef<number | undefined>(openSignal);

  const loadScreenshots = useCallback(async () => {
    setLoadingScreenshots(true);
    try {
      const res = await achievementCardsApi.listProjectScreenshots(projectId);
      setScreenshots(res.data ?? []);
    } catch {
      setScreenshots([]);
    } finally {
      setLoadingScreenshots(false);
    }
  }, [projectId]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setView('menu');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 响应外部 openSignal：递增即展开（disabled 时不响应）
  useEffect(() => {
    if (openSignal === undefined) return;
    if (openSignal === lastOpenSignalRef.current) return;
    lastOpenSignalRef.current = openSignal;
    if (disabled) return;
    setView('menu');
    void loadScreenshots();
    setOpen(true);
  }, [openSignal, disabled, loadScreenshots]);

  const handleSelectScreenshot = async (url: string) => {
    setBusy(true);
    try {
      const res = await achievementCardsApi.update(card.id, { screenshots: [url] });
      if (res.data) {
        onUpdated(res.data);
        showToast('success', '封面已更新');
      }
    } catch {
      showToast('error', '设置封面失败');
    } finally {
      setBusy(false);
      setOpen(false);
      setView('menu');
    }
  };

  const handleAiGenerate = async () => {
    setBusy(true);
    try {
      const res = await achievementCardsApi.generateCover(card.id);
      if (res.data) {
        onUpdated(res.data);
        showToast('success', '封面图生成成功');
      }
    } catch {
      showToast('error', '封面图生成失败，请稍后重试');
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const res = await achievementCardsApi.uploadCover(card.id, file);
      if (res.data) {
        onUpdated(res.data);
        showToast('success', '封面上传成功');
      }
    } catch {
      showToast('error', '封面上传失败');
    } finally {
      setBusy(false);
      e.target.value = '';
      setOpen(false);
    }
  };

  const handleOpen = () => {
    if (disabled) return;
    if (!open) {
      setView('menu');
      void loadScreenshots();
    }
    setOpen(!open);
  };

  /** 调后端无头浏览器对当前运行预览自动截图，并刷新截图列表 */
  const handleCaptureRunningScreenshot = useCallback(async () => {
    setCapturing(true);
    setCaptureHint('');
    try {
      console.log('[CoverPicker] capturePreview start, projectId=', projectId);
      const res = await codeExecutionApi.capturePreview(projectId);
      console.log('[CoverPicker] capturePreview OK', res);
      showToast('success', '运行截图已自动采集');
      await loadScreenshots();
    } catch (err) {
      const e = err as Error & { status?: number; body?: unknown };
      console.error('[CoverPicker] capturePreview FAILED', { status: e.status, body: e.body, message: e.message });
      const detail = (e.body as { detail?: string } | undefined)?.detail || e.message || '';
      const hint = e.status === 409
        ? '当前没有可截图的运行预览，请先在创建页运行项目代码后再采集'
        : detail || '采集运行截图失败';
      setCaptureHint(hint);
      showToast('error', hint);
    } finally {
      setCapturing(false);
    }
  }, [projectId, loadScreenshots]);

  /** 进入「项目运行截图」子视图时，自动触发一次截图采集 */
  const handleEnterScreenshotsView = useCallback(() => {
    setView('screenshots');
    void loadScreenshots();
    setCaptureHint('');
    void handleCaptureRunningScreenshot();
  }, [loadScreenshots, handleCaptureRunningScreenshot]);

  const hasCover = card.screenshots && card.screenshots.length > 0;

  return (
    <div className="relative inline-block" ref={containerRef}>
      <Button
        variant="secondary"
        onClick={handleOpen}
        disabled={disabled || busy}
        title={disabled ? '请先保存为成果卡后再生成封面' : undefined}
      >
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
        {busy ? '处理中...' : hasCover ? '更换封面' : '设置封面'}
        <ChevronDown className="w-3.5 h-3.5 ml-1" />
      </Button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
          {view === 'menu' && (
            <div className="p-2">
              <p className="px-3 py-2 text-xs text-gray-400 font-medium">选择封面来源</p>
              <button
                className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg text-left"
                onClick={handleEnterScreenshotsView}
              >
                <Camera className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <div>
                  <div className="font-medium">项目运行截图</div>
                  <div className="text-xs text-gray-400">{screenshots.length > 0 ? `${screenshots.length} 张可选` : '点击自动采集'}</div>
                </div>
              </button>
              <button
                className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg text-left"
                onClick={handleAiGenerate}
              >
                <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <div>
                  <div className="font-medium">AI 生成封面</div>
                  <div className="text-xs text-gray-400">根据标题和简介自动生成</div>
                </div>
              </button>
              <button
                className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg text-left"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div>
                  <div className="font-medium">上传图片</div>
                  <div className="text-xs text-gray-400">从本地选择一张图片</div>
                </div>
              </button>
            </div>
          )}

          {view === 'screenshots' && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">项目运行截图</span>
                <div className="flex items-center gap-2">
                  <button
                    className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 disabled:text-gray-300"
                    onClick={() => void handleCaptureRunningScreenshot()}
                    disabled={capturing}
                    title="对当前运行预览重新截图"
                  >
                    {capturing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {capturing ? '采集中…' : '重新采集'}
                  </button>
                  <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setView('menu')}>返回</button>
                </div>
              </div>
              {capturing && screenshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Loader2 className="w-5 h-5 text-teal-500 animate-spin" />
                  <p className="text-xs text-gray-500">正在用无头浏览器对运行预览截图…</p>
                </div>
              ) : captureHint ? (
                <div className="text-center py-8 px-4">
                  <Camera className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-1">暂无可用截图</p>
                  <p className="text-xs text-amber-600">{captureHint}</p>
                </div>
              ) : loadingScreenshots ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                </div>
              ) : screenshots.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <Camera className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-1">暂无项目截图</p>
                  <p className="text-xs text-gray-400">点击右上角「重新采集」对运行预览截图</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {screenshots.map((shot) => (
                    <button
                      key={shot.id}
                      className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 hover:border-teal-400 transition-colors"
                      onClick={() => handleSelectScreenshot(shot.url)}
                      title={shot.title}
                    >
                      <img src={resolveImageUrl(shot.url)} alt={shot.title} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
