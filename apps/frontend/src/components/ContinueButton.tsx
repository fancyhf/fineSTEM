import React from 'react';
import { Loader2, Play } from 'lucide-react';

interface ContinueButtonProps {
  onContinue: () => void;
  isLoading?: boolean;
  visible?: boolean;
}

export function ContinueButton({ onContinue, isLoading, visible }: ContinueButtonProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onContinue}
      disabled={isLoading}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>继续生成中...</span>
        </>
      ) : (
        <>
          <Play className="w-4 h-4" />
          <span>继续生成</span>
        </>
      )}
    </button>
  );
}
