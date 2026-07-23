/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 2026-07-22 测试体系重构：vitest 配置
// 前端单元测试环境，与 vite 构建配置分离。
// 覆盖：useStreamingChat 的 normalizeToolName/parseMcpOutput、
// Create.tsx 的 sanitizeAssistantNarration、questionParser 等纯逻辑模块。
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'tests/**', 'src/**/*.legacy.ts', 'src/**/__tests__/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/lib/**', 'src/hooks/useStreamingChat.ts'],
    },
  },
  resolve: {
    alias: {
      // 让测试里能用和源码一致的相对/绝对路径
    },
  },
});
