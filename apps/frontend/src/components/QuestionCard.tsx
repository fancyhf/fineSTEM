import React, { useState } from 'react';
import { MessageSquare, X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
  groupId?: string;
  groupTitle?: string;
}

export interface QuestionOptionGroup {
  id: string;
  title: string;
  optionIds: string[];
}

export interface QuestionData {
  id: string;
  title: string;
  subtitle?: string;
  options: QuestionOption[];
  optionGroups?: QuestionOptionGroup[];
  requireEachGroup?: boolean;
  multiple?: boolean;
  allowCustom?: boolean;
  step?: number;
  totalSteps?: number;
  stage?: string;
  isStageFinal?: boolean;
}

interface QuestionCardProps {
  data: QuestionData;
  onAnswer: (selectedIds: string[], customText?: string) => void;
  onCancel?: () => void;
  onDismiss?: () => void;
  onBack?: () => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  data,
  onAnswer,
  onCancel,
  onDismiss,
  onBack,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const visibleGroups = data.optionGroups?.filter((group) => group.optionIds.length > 0) ?? [];
  const hasGroupedOptions = visibleGroups.length > 1;
  const isMultiple = data.requireEachGroup || hasGroupedOptions || (data.multiple ?? false);
  // debug: 确认 multiple 传递链路（Q-006 排查）
  if (data.multiple && !isMultiple) {
    console.error('[QuestionCard] multiple=true 但 isMultiple=false!', { data_multiple: data.multiple, isMultiple, requireEachGroup: data.requireEachGroup, hasGroupedOptions });
  }
  const missingRequiredGroups = data.requireEachGroup
    ? visibleGroups.filter((group) => !group.optionIds.some((optionId) => selectedIds.includes(optionId)))
    : [];
  const canSubmit = (selectedIds.length > 0 || !!customText.trim()) && missingRequiredGroups.length === 0;

  const toggleOption = (optionId: string) => {
    if (isMultiple) {
      setSelectedIds(prev =>
        prev.includes(optionId)
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      setSelectedIds([optionId]);
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onAnswer(selectedIds, customText.trim() || undefined);
  };

  const selectedLabels = selectedIds
    .map(id => data.options.find(o => o.id === id)?.label || '')
    .filter(Boolean);

  return (
    <div data-testid="question-card" className="my-3 rounded-xl border border-teal-200 bg-gradient-to-br from-white to-teal-50/30 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-teal-50/80 border-b border-teal-100">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-teal-600" />
          <span className="text-xs font-semibold text-teal-700">提问</span>
        </div>
        {onDismiss && (
          <button
            data-testid="question-dismiss"
            onClick={onDismiss}
            className="p-0.5 hover:bg-teal-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {data.subtitle && (
          <p className="text-[11px] text-gray-400 mb-1.5">{data.subtitle}</p>
        )}
        <p className="text-sm text-gray-800 leading-relaxed mb-3">
          {data.title}
          {isMultiple && (
            <span className="ml-2 px-1.5 py-0.5 text-[10px] font-normal bg-blue-50 text-blue-600 rounded border border-blue-200 align-middle">
              可多选
            </span>
          )}
        </p>

        {/* Options */}
        <div className="space-y-2">
          {(hasGroupedOptions ? visibleGroups : [{ id: 'default', title: '', optionIds: data.options.map((option) => option.id) }]).map((group) => {
            const groupOptions = data.options.filter((option) => group.optionIds.includes(option.id));
            const isGroupMissing = data.requireEachGroup && groupOptions.every((option) => !selectedIds.includes(option.id));
            return (
              <div key={group.id} className="space-y-1.5">
                {hasGroupedOptions && (
                  <div className="flex items-center justify-between px-0.5">
                    <p className="text-[11px] font-semibold text-gray-600">{group.title}</p>
                    {isGroupMissing && (
                      <span className="text-[10px] text-amber-600">至少选 1 项</span>
                    )}
                  </div>
                )}
                {groupOptions.map((option) => {
            const isSelected = selectedIds.includes(option.id);
            return (
              <button
                key={option.id}
                data-testid="question-option"
                data-option-id={option.id}
                onClick={() => toggleOption(option.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all group ${
                  isSelected
                    ? 'border-teal-300 bg-teal-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Radio（单选=圆点） / Checkbox（多选=方框+勾） */}
                  <div className={`mt-0.5 flex-shrink-0 w-4 h-4 border-2 flex items-center justify-center transition-colors ${
                    isMultiple ? 'rounded' : 'rounded-full'
                  } ${
                    isSelected
                      ? 'border-teal-500 bg-teal-500'
                      : 'border-gray-300 group-hover:border-gray-400'
                  }`}>
                    {isSelected && (
                      isMultiple
                        ? <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium ${
                      isSelected ? 'text-teal-800' : 'text-gray-700'
                    }`}>
                      {option.label}
                      {option.recommended && (
                        <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-normal bg-amber-50 text-amber-600 rounded border border-amber-200">
                          推荐
                        </span>
                      )}
                    </div>
                    {option.description && (
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{option.description}</p>
                    )}
                  </div>
                </div>
              </button>
            );
                })}
              </div>
            );
          })}

          {/* Other / Custom option */}
          {(data.allowCustom !== false) && (
            <>
              {!showCustomInput ? (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                    showCustomInput
                      ? 'border-teal-300 bg-teal-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    <span className="text-xs text-gray-500">其他</span>
                  </div>
                </button>
              ) : (
                <div className="px-3 py-2 rounded-lg border border-teal-300 bg-teal-50">
                  <textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="输入你的想法..."
                    rows={2}
                    className="w-full text-xs bg-transparent border-0 outline-none resize-none placeholder:text-gray-400"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/50 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {data.step != null && data.totalSteps != null && (
            <span className="text-[11px] text-gray-400">
              {data.step} / {data.totalSteps} {data.subtitle || '子选项设计'}
            </span>
          )}
          {selectedLabels.length > 0 && (
            <span className="text-[11px] text-teal-600 font-medium truncate max-w-[140px]">
              已选: {selectedLabels.join(', ')}
            </span>
          )}
          {missingRequiredGroups.length > 0 && (
            <span className="text-[11px] text-amber-600 font-medium truncate max-w-[180px]">
              还需选择: {missingRequiredGroups.map((group) => group.title).join('、')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              取消
            </button>
          )}
          {data.step != null && data.step > 1 && onBack && (
            <button
              onClick={onBack}
              className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3 h-3" /> 上一步
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-3 py-1 text-xs font-medium text-white bg-gray-800 hover:bg-gray-900 disabled:bg-gray-200 disabled:text-gray-400 rounded transition-colors flex items-center gap-1"
          >
            {data.step != null && data.totalSteps != null && data.step < data.totalSteps ? (
              <>下一步 <ChevronRight className="w-3 h-3" /></>
            ) : (
              '确定'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
