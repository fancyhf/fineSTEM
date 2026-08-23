/**
 * vitest 专用 monaco-editor 桩（2026-08-16）。
 *
 * 背景：CodeEditor.tsx 静态 `import * as monaco from 'monaco-editor'`，
 * 引入 js-beautify 后 vitest 依赖优化策略变化，monaco 的浏览器 contrib
 * （clipboard 的 document.queryCommandSupported）在 jsdom 里执行导致
 * Create.test.ts 整文件加载失败。单测只测纯函数、从不渲染编辑器，
 * 这里用最小桩替换 monaco，保持单测快速且不依赖浏览器 API。
 * 真实编辑器行为由 Playwright E2E 覆盖。
 */
export const KeyMod = { CtrlCmd: 2048, Shift: 1024, Alt: 512 };
export const KeyCode = { KeyS: 47 };
export const editor = {
  defineTheme: () => undefined,
  create: () => ({
    updateOptions: () => undefined,
    addCommand: () => undefined,
    getAction: () => undefined,
    dispose: () => undefined,
  }),
};
