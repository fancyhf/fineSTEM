import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 端口规范：前端开发服务器必须使用端口 5284，代理到后端 3200
// 详见：.trae/rules/project_rules.md §1.6 服务端口管理规范
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5284,
    proxy: {
      '/api': {
        target: 'http://localhost:3200',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco-editor': ['monaco-editor'],
        },
      },
    },
  },
});
