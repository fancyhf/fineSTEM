import React, { useState, useEffect, useCallback } from 'react';
import { Dice5, BarChart3, Globe, Rocket, Calculator, CheckSquare, Loader2 } from 'lucide-react';
import { codeExecutionApi } from '../services/api';
import { CodeTemplate } from '../types';

interface CodeTemplatesProps {
  onUseTemplate: (code: string, language: string, title: string) => void;
}

// 图标映射
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  dice: Dice5,
  chart: BarChart3,
  globe: Globe,
  rocket: Rocket,
  calculator: Calculator,
  check: CheckSquare,
};

/**
 * 代码模板卡片组件
 * 用途：展示适合少儿的入门代码模板，点击即填充到编辑器
 * 维护者：AI Agent
 * links: .trae/documents/api-specs/v1/spec.json#code-templates
 */
export const CodeTemplates: React.FC<CodeTemplatesProps> = ({ onUseTemplate }) => {
  const [templates, setTemplates] = useState<CodeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await codeExecutionApi.listTemplates();
      setTemplates(res.data || []);
    } catch (error) {
      console.error('[CodeTemplates] 加载模板失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleUseTemplate = useCallback(async (templateId: string) => {
    setLoadingId(templateId);
    try {
      const res = await codeExecutionApi.getTemplate(templateId);
      if (res.data) {
        onUseTemplate(res.data.code, res.data.language, res.data.title);
      }
    } catch (error) {
      console.error('[CodeTemplates] 获取模板详情失败:', error);
    } finally {
      setLoadingId(null);
    }
  }, [onUseTemplate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (templates.length === 0) {
    return null;
  }

  return (
    <div className="p-3">
      <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
        <Rocket className="w-3 h-3" />
        <span>快速开始 - 选择一个模板</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {templates.map((tpl) => {
          const Icon = ICON_MAP[tpl.icon] || Dice5;
          const isLoading = loadingId === tpl.id;
          return (
            <button
              key={tpl.id}
              onClick={() => handleUseTemplate(tpl.id)}
              disabled={isLoading}
              className="group flex flex-col items-start p-2.5 bg-white border border-gray-200 rounded-lg hover:border-teal-300 hover:shadow-sm transition-all text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-4 h-4 text-teal-500" />
                <span className="text-xs font-medium text-gray-700 group-hover:text-teal-600">{tpl.title}</span>
              </div>
              <p className="text-[10px] text-gray-400 line-clamp-2 leading-tight">{tpl.description}</p>
              <div className="flex items-center gap-1 mt-1.5">
                <span className={`text-[9px] px-1 py-0.5 rounded ${
                  tpl.difficulty === '初级' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                }`}>
                  {tpl.difficulty}
                </span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">
                  {tpl.language}
                </span>
              </div>
              {isLoading && <Loader2 className="w-3 h-3 text-teal-500 animate-spin mt-1" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
