import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 端口规范：前端开发服务器必须使用端口 5173，代理到后端 3000
// 详见：.trae/rules/project_rules.md §1.6 服务端口管理规范
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
