import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-700 placeholder:text-gray-400 transition-all',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:border-primary-500',
        error && 'border-error-500 focus:ring-error-500 focus:border-error-500',
        'disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  );
}