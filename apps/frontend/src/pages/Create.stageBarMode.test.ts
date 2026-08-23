/**
 * Create.tsx 阶段条 mode 守卫（源码级断言，2026-08-20，Q-049）。
 *
 * 背景：handleSend 流末的 setProjectContext 曾硬编码 `mode: 'standard'`，
 * light 项目（复制引导/轻项目）每收完一条 AI 回复，顶部阶段条就从
 * "想法与方向/设计与实现/展示与反思"3 步翻成标准 9 阶段条（线上实测项目
 * b9e0f446）。修复：同一项目保留现有 mode；新项目才用 standard；流末
 * workspace 回读以服务端为准同步 mode/current_stage。
 * 组件测试基建落地后可删除本文件。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/pages/Create.tsx'), 'utf-8');

describe('handleSend 流末 mode 处理（Q-049 防回归）', () => {
  it('不得再出现无条件 mode: standard 硬编码', () => {
    const start = source.indexOf('const finalProjectId');
    expect(start, '找不到流末项目上下文块起点').toBeGreaterThanOrEqual(0);
    const end = source.indexOf('} catch (error)', start);
    expect(end, '找不到流末项目上下文块终点').toBeGreaterThan(start);
    const ctx = source.slice(start, end);
    expect(ctx).not.toMatch(/mode:\s*'standard',\s*\n\s*currentStage:\s*finalStage/);
  });

  it('同一项目保留现有 mode；新项目才 standard', () => {
    expect(source).toContain("prev.projectId === finalProjectId && prev.mode ? prev.mode : 'standard'");
  });

  it('流末 workspace 回读以服务端为准同步 mode 与 current_stage（收官推进即时可见）', () => {
    expect(source).toContain("wsMode === 'light' || wsMode === 'standard'");
    expect(source).toContain('next.currentStage = wsStage');
  });
});
