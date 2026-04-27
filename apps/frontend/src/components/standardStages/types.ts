import React from 'react';

export interface StageComponentProps<T> {
  value: T;
  onChange: (next: T) => void;
}

export function splitLines(input: string): string[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function joinLines(items: string[] | undefined): string {
  return (items ?? []).join('\n');
}

export function updateField<T extends object, K extends keyof T>(
  value: T,
  key: K,
  next: T[K],
  onChange: (next: T) => void
): void {
  onChange({ ...value, [key]: next });
}
