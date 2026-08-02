import React, { createContext, useContext, useState } from 'react';

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within <Tabs>');
  }
  return context;
}

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className = '' }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export function TabsList({ children, className = '' }: TabsListProps) {
  return (
    <div className={`inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1 ${className}`}>
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className = '' }: TabsTriggerProps) {
  const { value: selectedValue, onValueChange } = useTabs();
  const isSelected = selectedValue === value;

  return (
    <button
      type="button"
      onClick={() => onValueChange(value)}
      className={`
        inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium
        transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500
        disabled:pointer-events-none disabled:opacity-50
        ${isSelected 
          ? 'bg-white text-teal-700 shadow-sm' 
          : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className = '' }: TabsContentProps) {
  const { value: selectedValue } = useTabs();
  
  if (value !== selectedValue) {
    return null;
  }

  return (
    <div className={`mt-2 focus-visible:outline-none ${className}`}>
      {children}
    </div>
  );
}
