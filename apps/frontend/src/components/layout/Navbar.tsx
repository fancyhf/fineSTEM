import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { 
  Sparkles, 
  LogOut, 
  Menu, 
  X,
  Home,
  BookOpen,
  Code,
  CodeSquare,
  Trophy,
  GraduationCap,
  Globe,
  ScrollText,
  MessageCircle,
} from 'lucide-react';

interface NavbarProps {
  title?: string;
  children?: React.ReactNode;
}

export function Navbar({ title, children }: NavbarProps) {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
    setShowMenu(false);
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <header className="bg-white border-b border-gray-200 h-16 sticky top-0 z-30">
      <div className="h-full flex items-center justify-between px-6">
        {/* 左侧 - Logo 和导航 */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-teal-600" />
            <span className="text-xl font-bold text-gray-900">fineSTEM</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/') && !isActive('/explore') && !isActive('/create') && !isActive('/research') && !isActive('/connect')
                  ? 'bg-teal-100 text-teal-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Home className="h-4 w-4" />
              首页
            </Link>
            <Link
              to="/explore"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/explore')
                  ? 'bg-teal-100 text-teal-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              示例项目
            </Link>
            <Link
              to="/create"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/create')
                  ? 'bg-teal-100 text-teal-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Code className="h-4 w-4" />
              创建项目
            </Link>
            <Link
              to="/connect"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/connect')
                  ? 'bg-teal-100 text-teal-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Trophy className="h-4 w-4" />
              灵感墙
            </Link>
            <Link
              to="/hongkong-macao"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/hongkong-macao') || isActive('/international-admissions')
                  ? 'bg-teal-100 text-teal-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              升学
            </Link>
            <Link
              to="/assistant-dialogues"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/assistant-dialogues')
                  ? 'bg-teal-100 text-teal-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              对话
            </Link>
            <Link
              to="/course-library"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/course-library')
                  ? 'bg-teal-100 text-teal-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              课程库
            </Link>
            <Link
              to="/code-studio"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/code-studio')
                  ? 'bg-teal-100 text-teal-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <CodeSquare className="h-4 w-4" />
              代码编辑器
            </Link>
            <Link
              to="/audit-logs"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/audit-logs')
                  ? 'bg-teal-100 text-teal-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <ScrollText className="h-4 w-4" />
              审计
            </Link>
          </nav>
        </div>

        {/* 右侧 - 用户菜单 */}
        <div className="flex items-center gap-4">
          {children}
          
          {user ? (
            <div className="relative">
              <Button
                variant="ghost"
                className="flex items-center gap-2"
                onClick={() => setShowMenu(!showMenu)}
              >
                <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden md:inline text-sm font-medium text-gray-700">{user.name}</span>
              </Button>

              {showMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-100">
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                    <div className="p-2">
                      <Link
                        to="/dashboard"
                        onClick={() => setShowMenu(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg w-full"
                      >
                        <Home className="h-4 w-4" />
                        仪表盘
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg w-full"
                      >
                        <LogOut className="h-4 w-4" />
                        退出登录
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost">登录</Button>
              </Link>
              <Link to="/register">
                <Button className="bg-teal-600 hover:bg-teal-700 text-white">注册</Button>
              </Link>
            </div>
          )}

          {/* 移动端菜单按钮 */}
          <Button
            variant="ghost"
            className="md:hidden"
            onClick={() => setShowMenu(!showMenu)}
          >
            {showMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* 移动端导航菜单 */}
      {showMenu && !user && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <nav className="p-4 space-y-2">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setShowMenu(false)}
            >
              <Home className="h-4 w-4" />
              首页
            </Link>
            <Link
              to="/explore"
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setShowMenu(false)}
            >
              <BookOpen className="h-4 w-4" />
              示例项目
            </Link>
            <Link
              to="/create"
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setShowMenu(false)}
            >
              <Code className="h-4 w-4" />
              创建项目
            </Link>
            <Link
              to="/connect"
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setShowMenu(false)}
            >
              <Trophy className="h-4 w-4" />
              灵感墙
            </Link>
            <Link
              to="/hongkong-macao"
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setShowMenu(false)}
            >
              <GraduationCap className="h-4 w-4" />
              升学
            </Link>
            <Link
              to="/assistant-dialogues"
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setShowMenu(false)}
            >
              <MessageCircle className="h-4 w-4" />
              对话
            </Link>
            <Link
              to="/course-library"
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setShowMenu(false)}
            >
              <BookOpen className="h-4 w-4" />
              课程库
            </Link>
            <Link
              to="/code-studio"
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setShowMenu(false)}
            >
              <CodeSquare className="h-4 w-4" />
              代码编辑器
            </Link>
            <Link
              to="/audit-logs"
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setShowMenu(false)}
            >
              <Globe className="h-4 w-4" />
              审计
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
