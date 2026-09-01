/**
 * copyGuidance 判定函数 vitest 覆盖（MVP2 P0-09）。
 */
import { describe, expect, it } from 'vitest';
import {
  shouldShowCopyGuidanceIntro,
  shouldShowCopyGuidanceShortcut,
  getCopyGuidanceShortcutLabel,
  resolveCopyGuidanceShortcutAction,
  buildCopyGuidanceTrigger,
} from './copyGuidance';

describe('shouldShowCopyGuidanceIntro', () => {
  it('复制项目 + intro pending → 显示', () => {
    expect(
      shouldShowCopyGuidanceIntro(
        { from_demo_id: 'demo_poetry_card' },
        {
          copy_guidance: {
            intro_status: 'pending',
            session_status: 'idle',
          },
        },
      ),
    ).toBe(true);
  });

  it('复制项目 + intro started → 不显示', () => {
    expect(
      shouldShowCopyGuidanceIntro(
        { from_demo_id: 'demo_poetry_card' },
        {
          copy_guidance: {
            intro_status: 'started',
            session_status: 'active',
          },
        },
      ),
    ).toBe(false);
  });

  it('复制项目 + intro dismissed → 不显示', () => {
    expect(
      shouldShowCopyGuidanceIntro(
        { from_demo_id: 'demo_poetry_card' },
        {
          copy_guidance: {
            intro_status: 'dismissed',
            session_status: 'idle',
          },
        },
      ),
    ).toBe(false);
  });

  it('自建项目 → 不显示', () => {
    expect(
      shouldShowCopyGuidanceIntro(
        { from_demo_id: undefined },
        {
          copy_guidance: {
            intro_status: 'pending',
            session_status: 'idle',
          },
        },
      ),
    ).toBe(false);
  });

  it('progress 无 copy_guidance → 不显示', () => {
    expect(
      shouldShowCopyGuidanceIntro(
        { from_demo_id: 'demo_poetry_card' },
        { copy_guidance: null },
      ),
    ).toBe(false);
  });

  it('project / progress 空 → 不显示', () => {
    expect(shouldShowCopyGuidanceIntro(null, null)).toBe(false);
    expect(
      shouldShowCopyGuidanceIntro(undefined, {
        copy_guidance: { intro_status: 'pending', session_status: 'idle' },
      }),
    ).toBe(false);
  });
});

describe('shouldShowCopyGuidanceShortcut', () => {
  it('复制项目 + 有 copy_guidance（任何状态）→ 显示', () => {
    expect(
      shouldShowCopyGuidanceShortcut(
        { from_demo_id: 'demo_poetry_card' },
        {
          copy_guidance: {
            intro_status: 'dismissed',
            session_status: 'idle',
          },
        },
      ),
    ).toBe(true);
  });

  it('自建项目 → 不显示', () => {
    expect(
      shouldShowCopyGuidanceShortcut(
        { from_demo_id: undefined },
        {
          copy_guidance: {
            intro_status: 'pending',
            session_status: 'idle',
          },
        },
      ),
    ).toBe(false);
  });

  it('复制项目但 copy_guidance 缺失 → 不显示（工作树迁移期）', () => {
    expect(
      shouldShowCopyGuidanceShortcut(
        { from_demo_id: 'demo_poetry_card' },
        { copy_guidance: null },
      ),
    ).toBe(false);
  });
});

describe('getCopyGuidanceShortcutLabel', () => {
  it('无 copy_guidance → 任务引导', () => {
    expect(getCopyGuidanceShortcutLabel(null)).toBe('任务引导');
    expect(getCopyGuidanceShortcutLabel(undefined)).toBe('任务引导');
  });

  it('无 current_task → 任务引导', () => {
    expect(
      getCopyGuidanceShortcutLabel({
        intro_status: 'started',
        session_status: 'active',
        current_task: null,
      }),
    ).toBe('任务引导');
  });

  it('current_task 有 title → 继续任务：<title>', () => {
    expect(
      getCopyGuidanceShortcutLabel({
        intro_status: 'started',
        session_status: 'active',
        current_task: { id: 'replace_first_card', title: '替换标题和第一张卡片' },
      }),
    ).toBe('继续任务：替换标题和第一张卡片');
  });

  it('current_task 只有 id → 继续任务', () => {
    expect(
      getCopyGuidanceShortcutLabel({
        intro_status: 'started',
        session_status: 'active',
        current_task: { id: 'replace_first_card' },
      }),
    ).toBe('继续任务');
  });
});

describe('resolveCopyGuidanceShortcutAction', () => {
  it('空节点 → noop', () => {
    expect(resolveCopyGuidanceShortcutAction(null)).toEqual({ kind: 'noop' });
    expect(resolveCopyGuidanceShortcutAction(undefined)).toEqual({ kind: 'noop' });
  });

  it('intro pending → start_and_switch_scene', () => {
    expect(
      resolveCopyGuidanceShortcutAction({
        intro_status: 'pending',
        session_status: 'idle',
      }),
    ).toEqual({ kind: 'start_and_switch_scene' });
  });

  it('intro dismissed（回访）→ start_and_switch_scene', () => {
    expect(
      resolveCopyGuidanceShortcutAction({
        intro_status: 'dismissed',
        session_status: 'idle',
      }),
    ).toEqual({ kind: 'start_and_switch_scene' });
  });

  it('intro started → switch_scene_only（避免重复调更新接口）', () => {
    expect(
      resolveCopyGuidanceShortcutAction({
        intro_status: 'started',
        session_status: 'active',
      }),
    ).toEqual({ kind: 'switch_scene_only' });
  });
});

describe('buildCopyGuidanceTrigger（2026-08-16 线上问题防回归）', () => {
  it('start：scene 必须是 copy_project_guidance，且带完整消息和短气泡', () => {
    const trigger = buildCopyGuidanceTrigger('start');
    expect(trigger.scene).toBe('copy_project_guidance');
    expect(trigger.kind).toBe('start');
    expect(trigger.message.length).toBeGreaterThan(20);
    expect(trigger.displayContent).toBe('开始任务引导');
    expect(trigger.displayContent.length).toBeLessThan(trigger.message.length);
  });

  it('start：消息必须要求 AI 先读 Skill 状态和代码，再给任务', () => {
    const { message } = buildCopyGuidanceTrigger('start');
    expect(message).toContain('Skill 状态');
    expect(message).toContain('项目代码');
  });

  it('start：只索要一项任务，不得索要完整答案', () => {
    const { message } = buildCopyGuidanceTrigger('start');
    expect(message).toContain('第一项任务');
    expect(message).toContain('完成条件');
    expect(message).not.toContain('完整答案');
    expect(message).not.toContain('完整代码');
  });

  it('continue：要求结合当前任务进度续上引导', () => {
    const trigger = buildCopyGuidanceTrigger('continue');
    expect(trigger.scene).toBe('copy_project_guidance');
    expect(trigger.displayContent).toBe('继续任务引导');
    expect(trigger.message).toContain('任务进度');
    expect(trigger.message).toContain('完成条件');
  });
});
