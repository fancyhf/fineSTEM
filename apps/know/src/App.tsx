import { Route, Routes, Outlet } from 'react-router-dom';

import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import SeriesPage from './pages/SeriesPage';
import EpisodePage from './pages/EpisodePage';
import PlayPage from './pages/PlayPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      {/* 互动全屏页：脱离常规布局，整屏就是动画 */}
      <Route path="/ep/:seriesSlug/:epSlug/play" element={<PlayPage />} />

      <Route
        path="/"
        element={
          <>
            <Header />
            <main className="container">
              <Outlet />
            </main>
            <div className="container">
              <Footer />
            </div>
          </>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="series/:slug" element={<SeriesPage />} />
        <Route path="ep/:seriesSlug/:epSlug" element={<EpisodePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
