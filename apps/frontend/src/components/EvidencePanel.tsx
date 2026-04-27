import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { evidenceApi } from '../services/api';
import { Evidence } from '../types';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';

type EvidenceFilter = 'all' | Evidence['type'];

const FILTER_OPTIONS: Array<{ value: EvidenceFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'auto_stage_change', label: '阶段变更' },
  { value: 'auto_ai_summary', label: 'AI总结' },
  { value: 'screenshot', label: '截图' },
  { value: 'text_log', label: '文本记录' },
  { value: 'code_snapshot', label: '代码快照' },
  { value: 'file_upload', label: '文件上传' },
  { value: 'video_record', label: '视频记录' },
];

const TYPE_LABELS: Record<Evidence['type'], string> = {
  auto_stage_change: '自动阶段变更',
  auto_ai_summary: '自动AI总结',
  screenshot: '截图',
  text_log: '文本记录',
  code_snapshot: '代码快照',
  file_upload: '文件上传',
  video_record: '视频记录',
};

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function getEvidenceLink(contentUrl?: string): string | null {
  if (!contentUrl) return null;
  if (contentUrl.startsWith('http://') || contentUrl.startsWith('https://')) return contentUrl;
  return `${window.location.origin}${contentUrl}`;
}

interface EvidencePanelProps {
  projectId: string;
  className?: string;
}

export function EvidencePanel({ projectId, className }: EvidencePanelProps) {
  const [items, setItems] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<EvidenceFilter>('all');
  const [textLog, setTextLog] = useState('');
  const [submittingText, setSubmittingText] = useState(false);
  const [submittingAutoSummary, setSubmittingAutoSummary] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const loadEvidence = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await evidenceApi.list(projectId, { page: 1, page_size: 100 });
      setItems(response.data?.items ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : '证据加载失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvidence();
  }, [projectId]);

  const filteredItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    if (filter === 'all') return sorted;
    return sorted.filter((item) => item.type === filter);
  }, [items, filter]);

  const onUploadScreenshot = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      await evidenceApi.uploadScreenshot(projectId, file);
      await loadEvidence();
    } catch (err) {
      const message = err instanceof Error ? err.message : '截图上传失败';
      setUploadError(message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const onCreateTextLog = async (event: FormEvent) => {
    event.preventDefault();
    const content = textLog.trim();
    if (!content) return;
    setSubmittingText(true);
    try {
      await evidenceApi.create(projectId, {
        project_id: projectId,
        type: 'text_log',
        content,
      });
      setTextLog('');
      await loadEvidence();
    } finally {
      setSubmittingText(false);
    }
  };

  const onCreateAutoSummary = async () => {
    const content = textLog.trim();
    if (!content) return;
    setSubmittingAutoSummary(true);
    try {
      await evidenceApi.autoCollect(projectId, {
        type: 'auto_ai_summary',
        content,
        source: 'agent',
      });
      setTextLog('');
      await loadEvidence();
    } finally {
      setSubmittingAutoSummary(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="mb-3">
        <CardTitle className="text-lg">证据采集</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`text-xs rounded-full px-3 py-1 border ${
                filter === option.value
                  ? 'bg-teal-50 border-teal-200 text-teal-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="inline-flex items-center">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void onUploadScreenshot(event)}
            />
            <span className="inline-flex items-center justify-center h-9 px-4 text-sm rounded-lg border border-gray-200 bg-gray-100 text-gray-700 cursor-pointer hover:bg-gray-200">
              {uploading ? '上传中...' : '上传截图'}
            </span>
          </label>
          {uploadError && <span className="text-xs text-red-600">{uploadError}</span>}
        </div>

        <form onSubmit={onCreateTextLog} className="space-y-2">
          <textarea
            value={textLog}
            onChange={(event) => setTextLog(event.target.value)}
            rows={3}
            placeholder="记录实验结论、调试日志或 AI 总结..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submittingText || !textLog.trim()}>
              {submittingText ? '提交中...' : '添加文本证据'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={submittingAutoSummary || !textLog.trim()}
              onClick={() => void onCreateAutoSummary()}
            >
              {submittingAutoSummary ? '提交中...' : '标记为AI总结'}
            </Button>
          </div>
        </form>

        {loading ? (
          <div className="text-sm text-gray-500">加载中...</div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-sm text-gray-500">暂无证据，先上传截图或添加文本记录。</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {filteredItems.map((item) => {
              const link = getEvidenceLink(item.content_url);
              return (
                <article key={item.id} className="border border-gray-200 rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" size="sm">
                      {TYPE_LABELS[item.type]}
                    </Badge>
                    <span className="text-xs text-gray-500">{formatTime(item.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{item.content}</p>
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-teal-600 hover:text-teal-700"
                    >
                      查看附件
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
