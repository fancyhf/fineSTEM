import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// 自托管 webfont（@fontsource，构建产物自带 woff2 分片，不依赖任何字体 CDN）
// 频道外壳面向家长：思源宋体做标题（编辑部风），正文走系统黑体
import '@fontsource/noto-serif-sc/500.css';
import '@fontsource/noto-serif-sc/700.css';

import './index.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
