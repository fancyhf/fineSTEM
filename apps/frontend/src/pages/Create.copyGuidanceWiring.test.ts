/**
 * 复制项目任务引导：Create.tsx 接线守卫（源码级断言）。
 *
 * 为什么是源码断言而不是组件测试：
 * Create.tsx 是 4400+ 行巨型组件，仓库目前没有 @testing-library / Playwright
 * 基建，直接渲染组件不可行。2026-08-16 线上问题（点"开始任务引导"后只切场景、
 * 没发消息，界面停在空聊天框）恰好位于组件事件接线里——所有纯函数单测都无法
 * 覆盖。本文件用最小代价锁住接线事实，等组件/E2E 测试基建落地后可删除。
 *
 * 维护者：AI Agent
 * links: .trae/documents/产品与规划/09_fineSTEM_MVP2_Create任务引导_功能与开发说明书_V1.0.md（AC-03/AC-06/AC-12）
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// jsdom 环境下 import.meta.url 不是 file: 协议，用 cwd（apps/frontend）解析。
// npm run test / npx vitest run 都以该目录为根，约定即可靠。
const source = readFileSync(resolve(process.cwd(), 'src/pages/Create.tsx'), 'utf-8');

function sliceBetween(startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  expect(start, `找不到起始标记：${startMarker}（Create.tsx 结构变了？请同步更新本守卫测试）`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endMarker, start);
  expect(end, `找不到结束标记：${endMarker}（Create.tsx 结构变了？请同步更新本守卫测试）`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('handleCopyGuidanceIntroChange 接线（AC-06：点击后必须发消息）', () => {
  const handler = sliceBetween(
    'const handleCopyGuidanceIntroChange = useCallback(',
    'const handleCopyGuidanceShortcut = useCallback(',
  );

  it('started 分支：用 buildCopyGuidanceTrigger("start") 发送场景消息', () => {
    expect(handler).toContain("if (nextStatus === 'started')");
    expect(handler).toContain("buildCopyGuidanceTrigger('start')");
    expect(handler).toContain('handleSendRef.current?.(');
    expect(handler).toContain('displayContent: trigger.displayContent');
  });

  it('只允许在 started 分支发送一次：dismissed（先自己看看）不得触发消息（AC-04）', () => {
    const sendCount = handler.split('handleSendRef.current?.(').length - 1;
    expect(sendCount).toBe(1);
  });

  it('接口失败不得静默：必须有可见的失败反馈（2026-08-16 修复的一部分）', () => {
    expect(handler).toContain('任务引导启动失败');
    expect(handler).toContain('setShowChatHistory(true)');
  });

  it('本地临时项目（local- 前缀）直接返回，不调接口不发送（AC-14）', () => {
    expect(handler).toContain("pid.startsWith('local-')");
  });
});

describe('handleCopyGuidanceShortcut 接线（AC-12：再次进入也要发消息）', () => {
  const handler = sliceBetween(
    'const handleCopyGuidanceShortcut = useCallback(',
    'const handleSend = async (',
  );

  it('switch_scene_only 分支：用 buildCopyGuidanceTrigger("continue") 续上当前任务', () => {
    expect(handler).toContain("'switch_scene_only'");
    expect(handler).toContain("buildCopyGuidanceTrigger('continue')");
    expect(handler).toContain('handleSendRef.current?.(');
  });
});

describe('首次提醒横幅渲染（AC-03：横幅出现时不自动发消息）', () => {
  const banner = sliceBetween('{shouldShowCopyGuidanceIntro(', '{showChatHistory ? (');

  it('横幅 JSX 中不得出现任何发送调用——"不自动发消息"只约束横幅出现时', () => {
    expect(banner).not.toContain('handleSendRef');
    expect(banner).not.toContain('handleSend(');
    expect(banner).not.toContain('handleSend,');
  });

  it('两个按钮只更新 intro_status，不直接发消息', () => {
    expect(banner).toContain("handleCopyGuidanceIntroChange('started')");
    expect(banner).toContain("handleCopyGuidanceIntroChange('dismissed')");
  });
});
