import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

/**
 * 顶栏：印章台标 + 全站搜索（回车跳首页并携带 ?q=）+ fineSTEM 主站入口。
 * 搜索逻辑收敛在首页 FilterBar，本组件只负责入口。
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
          <span className="brand__seal">话</span>
          <span>
            <span className="brand__name">与孩子对话</span>
            <div className="brand__sub">STEM 与亲子共学 · 节目频道</div>
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
    </header>
  );
}
