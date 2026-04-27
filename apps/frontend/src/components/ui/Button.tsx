import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'text' | 'success' | 'warning' | 'error';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 disabled:bg-gray-300 disabled:text-gray-400',
    secondary: 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 active:bg-gray-300 disabled:bg-gray-50 disabled:text-gray-400',
    ghost: 'bg-transparent text-primary-500 border border-primary-500 hover:bg-primary-50 active:bg-primary-100 disabled:text-gray-400 disabled:border-gray-300',
    text: 'bg-transparent text-primary-500 hover:bg-primary-50 active:bg-primary-100 disabled:text-gray-400',
    success: 'bg-success-500 text-white hover:bg-success-600 active:bg-success-600 disabled:bg-gray-300',
    warning: 'bg-warning-500 text-white hover:bg-warning-600 active:bg-warning-600 disabled:bg-gray-300',
    error: 'bg-error-500 text-white hover:bg-error-600 active:bg-error-600 disabled:bg-gray-300',
  };

  const sizes = {
    xs: 'h-7 px-3 text-xs',
    sm: 'h-9 px-4 text-sm',
    md: 'h-11 px-5 text-base',
    lg: 'h-13 px-6 text-lg',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}