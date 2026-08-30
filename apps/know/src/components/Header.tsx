import { useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';

import { CATEGORIES } from '../categories';

/**
 * 顶栏：品牌台标 + 四栏目页签（第二行）+ 全站搜索 + fineSTEM 主站入口。
 */
export default function Header() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/');
  };

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="brand">
          <svg className="brand__icon" viewBox="0 0 48 48" aria-hidden>
            <rect x="5" y="7" width="30" height="23" rx="9" fill="none" stroke="#29251F" strokeWidth="3" />
            <path d="M 12 30 L 9 38 L 20 31 Z" fill="#29251F" />
            <rect x="26" y="24" width="17" height="13" rx="6.5" fill="#1E4A66" />
            <path d="M 38 37 L 40 42 L 33 37.5 Z" fill="#1E4A66" />
            <circle cx="14" cy="18.5" r="2.2" fill="#29251F" />
            <circle cx="20" cy="18.5" r="2.2" fill="#29251F" />
            <circle cx="26" cy="18.5" r="2.2" fill="#29251F" />
          </svg>
          <span>
            <span className="brand__name">与孩子对话</span>
            <span className="brand__sub">给家长的播客与互动节目</span>
          </span>
        </Link>

        <form className="site-header__search" onSubmit={submit}>
          <span aria-hidden>⌕</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索节目、话题、标签…"
            aria-label="搜索节目"
          />
        </form>

        <nav className="site-header__nav">
          <a
            className="external"
            href="https://wostemstudio.site"
            target="_blank"
            rel="noopener noreferrer"
          >
            fineSTEM 主站
          </a>
        </nav>
      </div>

      {/* 四栏目页签 */}
      <nav className="site-tabs">
        <div className="container site-tabs__inner">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            首页
          </NavLink>
          {CATEGORIES.map((c) => (
            <NavLink
              key={c.cid}
              to={`/c/${c.cid}`}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {c.short}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}
