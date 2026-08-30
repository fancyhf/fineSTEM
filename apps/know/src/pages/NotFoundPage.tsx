import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="page-error">
      <div className="page-error__title">这里没有节目</div>
      <p className="page-error__desc">
        这里没有节目。<Link to="/">回首页 →</Link>
      </p>
    </div>
  );
}
