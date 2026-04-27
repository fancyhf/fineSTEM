import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Search, Sparkles, ClipboardList, Link2, User } from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
  { icon: Search, label: '探索', to: '/explore' },
  { icon: Sparkles, label: '创造', to: '/create' },
  { icon: ClipboardList, label: '研究', to: '/research' },
  { icon: Link2, label: '互联', to: '/connect' },
];

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-200 z-40',
        isExpanded ? 'w-50' : 'w-16'
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="flex flex-col h-full py-4">
        {/* Logo */}
        <div className="flex items-center justify-center px-4 mb-8">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">F</span>
          </div>
          {isExpanded && (
            <span className="ml-3 text-xl font-bold text-gray-800">fineSTEM</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-3 py-2.5 rounded-lg transition-colors group',
                  isActive
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {isExpanded && (
                <span className="ml-3 font-medium whitespace-nowrap">{item.label}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User profile */}
        <div className="mt-auto px-2">
          <button className="flex items-center w-full px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            <User className="w-5 h-5 flex-shrink-0" />
            {isExpanded && (
              <span className="ml-3 font-medium whitespace-nowrap">我的</span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}