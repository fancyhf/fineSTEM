// questionParser 测试 runner
// 用 esbuild 把 .test.ts bundle 成 .mjs，再用 node:test 跑
// 用法：node apps/frontend/src/lib/questionParser.run.mjs

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../../..'); // G:/mediaProjects/fineSTEM

const testFile = resolve(__dirname, 'questionParser.test.ts');
const tmpDir = mkdtempSync(resolve(tmpdir(), 'qparser-test-'));
const outFile = resolve(tmpDir, 'questionParser.test.bundle.mjs');

try {
  // esbuild bundle：把 TS + node:test + node:assert 编译成单个 mjs
  await build({
    entryPoints: [testFile],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    outfile: outFile,
    // node 内置模块保持外部 import
    external: ['node:test', 'node:assert/strict', 'node:assert'],
    logLevel: 'warning',
  });

  // 用 node 跑 bundle 后的测试
  const result = spawnSync('node', ['--test', outFile], {
    cwd: tmpDir,
    stdio: 'inherit',
    encoding: 'utf-8',
  });

  process.exit(result.status ?? 1);
} finally {
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
}
