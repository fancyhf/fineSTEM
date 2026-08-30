import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Know 子系统（know.wostemstudio.site）构建配置
// 与主站 apps/frontend 同机部署但完全独立：独立入口、独立风格、轻依赖。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5185,
    proxy: {
      '/api': {
        target: 'http://localhost:3200',
        changeOrigin: true,
      },
      '/content': {
        target: 'http://localhost:3200',
        changeOrigin: true,
      },
    },
  },
});
