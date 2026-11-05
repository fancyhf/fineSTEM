import React, { useEffect } from 'react';
import { BookOpen, X } from 'lucide-react';
import { MarkdownText } from './MarkdownText';

interface DocumentViewerModalProps {
  title: string;
  content: string;
  onClose: () => void;
}

/**
 * 过程文档在线查看弹窗
 * 用途：以只读 Markdown 展示文档全文，不跳转到原作者项目编辑路径
 * 维护者：AI Agent
 * links: .trae/documents/api-specs/v1/spec.json#projects-documents
 */
export function DocumentViewerModal({ title, content, onClose }: DocumentViewerModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      data-testid="document-viewer-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-[80vw] h-[80vh] max-w-5xl bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-teal-600" />
            {title}
          </span>
          <button
            type="button"
            aria-label="关闭文档"
            data-testid="document-viewer-modal-close"
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:bg-gray-200 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div data-testid="document-viewer-content" className="flex-1 overflow-auto p-5 text-sm text-gray-700 leading-relaxed">
          <MarkdownText content={content} />
        </div>
      </div>
    </div>
  );
}
