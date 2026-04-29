import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Search, Lightbulb, ClipboardList, Link2, LogOut, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { icon: Search, label: '探索', to: '/explore' },
  { icon: Lightbulb, label: '创造', to: '/create' },
  { icon: ClipboardList, label: '研究', to: '/research' },
  { icon: Link2, label: '互联', to: '/connect' },
];

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-200 z-40',
        isExpanded ? 'w-52' : 'w-16'
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="flex flex-col h-full py-4">
        <div className="flex items-center justify-center px-4 mb-8">
          <NavLink to="/" className="flex items-center">
            <Sparkles className="h-8 w-8 text-teal-600 flex-shrink-0" />
            {isExpanded && (
              <span className="ml-3 text-xl font-bold text-gray-900">fineSTEM</span>
            )}
          </NavLink>
        </div>

        <nav className="flex-1 px-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-3 py-2.5 rounded-lg transition-colors group',
                  isActive
                    ? 'bg-teal-50 text-teal-700'
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

        <div className="mt-auto px-2">
          {user ? (
            <div className="space-y-1">
              <div className="flex items-center px-3 py-2.5 rounded-lg text-gray-600">
                <div className="w-5 h-5 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-medium text-[10px] flex-shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                {isExpanded && (
                  <span className="ml-3 font-medium whitespace-nowrap text-sm truncate">{user.name}</span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-3 py-2.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                {isExpanded && (
                  <span className="ml-3 font-medium whitespace-nowrap">退出</span>
                )}
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="flex items-center px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Sparkles className="w-5 h-5 flex-shrink-0" />
              {isExpanded && (
                <span className="ml-3 font-medium whitespace-nowrap">登录</span>
              )}
            </NavLink>
          )}
        </div>
      </div>
    </aside>
  );
}
