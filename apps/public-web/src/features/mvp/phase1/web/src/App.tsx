import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import TrackA from './pages/TrackA';
import TrackE from './pages/TrackE';

function App() {
  const basename = import.meta.env.VITE_BASE_PATH || '/';
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/track-a" element={<TrackA />} />
        <Route path="/track-e" element={<TrackE />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
