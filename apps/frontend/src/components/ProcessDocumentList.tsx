import React from 'react';
import { BookOpen, FileText, Loader2 } from 'lucide-react';
import { ProjectDocument } from '../types';

const SUMMARY_LENGTH = 100;

interface ProcessDocumentListProps {
  documents: ProjectDocument[];
  loading?: boolean;
  variant?: 'compact' | 'detailed';
  emptyMessage?: string;
  onView: (document: ProjectDocument) => void;
}

/**
 * 过程文档列表
 * 用途：统一工作台紧凑列表与项目/公开页摘要列表的展示和空态
 * 维护者：AI Agent
 * links: .trae/documents/api-specs/v1/spec.json#projects-documents
 */
export function ProcessDocumentList({
  documents,
  loading = false,
  variant = 'detailed',
  emptyMessage = '该项目未沉淀过程文档',
  onView,
}: ProcessDocumentListProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-xs text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        正在加载文档...
      </div>
    );
  }

  const visibleDocuments = documents.filter((document) => document.has_content);
  if (visibleDocuments.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-gray-500 leading-relaxed">
        <p>{emptyMessage}</p>
        <p className="mt-1 text-gray-400">完成对应阶段后自动生成</p>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="pb-1">
        {visibleDocuments.map((document) => (
          <button
            type="button"
            key={document.stage}
            onClick={() => document.has_content && onView(document)}
            disabled={!document.has_content}
            className={`w-full flex items-center gap-1.5 px-5 py-1.5 text-xs transition-colors ${
              document.has_content ? 'text-gray-600 hover:bg-gray-100 cursor-pointer' : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            {document.stage === 'explanation' ? (
              <BookOpen className={`w-3 h-3 ${document.has_content ? 'text-teal-500' : 'text-gray-300'}`} />
            ) : (
              <FileText className={`w-3 h-3 ${document.has_content ? 'text-green-500' : 'text-gray-300'}`} />
            )}
            <span className="truncate">{document.name}</span>
            {document.has_content && <span className="text-[9px] text-gray-400 ml-auto">已生成</span>}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="process-document-list">
      {visibleDocuments.map((document) => (
        <button
          type="button"
          key={document.stage}
          onClick={() => document.has_content && onView(document)}
          disabled={!document.has_content}
          className="w-full flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 text-left transition-colors hover:border-teal-500 hover:bg-teal-50 disabled:border-gray-100 disabled:bg-gray-50 disabled:cursor-not-allowed"
        >
          {document.stage === 'explanation' ? (
            <BookOpen className={`mt-0.5 h-4 w-4 shrink-0 ${document.has_content ? 'text-teal-600' : 'text-gray-300'}`} />
          ) : (
            <FileText className={`mt-0.5 h-4 w-4 shrink-0 ${document.has_content ? 'text-teal-600' : 'text-gray-300'}`} />
          )}
          <span className="min-w-0 flex-1">
            <span className={`block text-sm font-medium ${document.has_content ? 'text-gray-800' : 'text-gray-400'}`}>
              {document.name}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-gray-500">
              {document.has_content ? document.summary.slice(0, SUMMARY_LENGTH) : '待生成'}
            </span>
          </span>
          {document.has_content && (
            <span className="shrink-0 text-xs text-gray-400">{document.content_length} 字</span>
          )}
        </button>
      ))}
    </div>
  );
}
