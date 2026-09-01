/**
 * 复制项目任务引导：纯函数判定（MVP2 P0-04）。
 *
 * 用于 Create.tsx 判断是否显示"首次提醒"以及"任务引导"快捷入口。
 * 抽成纯函数便于 vitest 覆盖，不依赖 React state。
 *
 * 维护者：AI Agent
 * links: .trae/documents/产品与规划/09_fineSTEM_MVP2_Create任务引导_功能与开发说明书_V1.0.md
 */
import type { Project, ProjectProgress, CopyGuidanceNode } from '../types';

/**
 * 是否显示复制项目首次提醒。
 *
 * 满足条件：
 * 1. 项目由 Demo 复制而来（`from_demo_id` 非空）
 * 2. `progress.copy_guidance.intro_status === 'pending'`（未开始也未忽略）
 */
export function shouldShowCopyGuidanceIntro(
  project: Pick<Project, 'from_demo_id'> | null | undefined,
  progress: Pick<ProjectProgress, 'copy_guidance'> | null | undefined,
): boolean {
  if (!project || !progress) return false;
  if (!project.from_demo_id) return false;
  const cg = progress.copy_guidance;
  if (!cg) return false;
  return cg.intro_status === 'pending';
}

/**
 * 是否在快捷区显示"任务引导"入口。
 *
 * 只要是复制项目（`from_demo_id` 非空且有 copy_guidance 节点）就一直显示，
 * 首次提醒关闭后仍能从这里再次进入。
 */
export function shouldShowCopyGuidanceShortcut(
  project: Pick<Project, 'from_demo_id'> | null | undefined,
  progress: Pick<ProjectProgress, 'copy_guidance'> | null | undefined,
): boolean {
  if (!project || !progress) return false;
  if (!project.from_demo_id) return false;
  return !!progress.copy_guidance;
}

/**
 * 快捷区按钮的显示文案。
 *
 * - 有 current_task 且带 title：显示"继续任务：<title>"
 * - 有 current_task 但无 title：显示"继续任务"
 * - 其他：显示"任务引导"
 */
export function getCopyGuidanceShortcutLabel(
  copyGuidance: CopyGuidanceNode | null | undefined,
): string {
  if (!copyGuidance) return '任务引导';
  const task = copyGuidance.current_task;
  if (task && task.id) {
    if (task.title) return `继续任务：${task.title}`;
    return '继续任务';
  }
  return '任务引导';
}

/**
 * 快捷区按钮点击后的后续动作。
 *
 * - 若尚未 `started`（含 pending / dismissed）：需要先把 intro_status 推进为 'started'
 *   并切到 copy_project_guidance 场景。
 * - 若已 started：只切场景，避免重复调 intro_status 更新接口。
 */
export type CopyGuidanceShortcutAction =
  | { kind: 'noop' }
  | { kind: 'start_and_switch_scene' }
  | { kind: 'switch_scene_only' };

export function resolveCopyGuidanceShortcutAction(
  copyGuidance: CopyGuidanceNode | null | undefined,
): CopyGuidanceShortcutAction {
  if (!copyGuidance) return { kind: 'noop' };
  if (copyGuidance.intro_status !== 'started') {
    return { kind: 'start_and_switch_scene' };
  }
  return { kind: 'switch_scene_only' };
}

/**
 * 点击"开始任务引导/继续任务引导"后发给 AI 的场景触发消息（AC-06 / AC-12）。
 *
 * 背景：2026-08-16 线上问题——点击后只切了 activeScene 没发消息，界面停在空聊天框。
 * 根因是 10 号开发文档把"不自动发 AI 消息"错挂到点击时机（正确语义：仅横幅出现、
 * 点击之前禁止自动发送；点击本身就是学生授权的发送时机）。把触发内容抽成纯函数
 * 并用 vitest 锁住，防止再次回归。
 *
 * 两条硬规则（对应 09 文档场景要求）：
 * 1. 必须要求 AI 先读 Skill 状态和真实代码，再给任务（不凭项目名猜）。
 * 2. 只索要一项任务，不得要求完整答案。
 */
export type CopyGuidanceTriggerKind = 'start' | 'continue';

export interface CopyGuidanceTrigger {
  kind: CopyGuidanceTriggerKind;
  scene: 'copy_project_guidance';
  /** 发给 AI 的完整触发消息 */
  message: string;
  /** 聊天气泡展示的短文本（完整指令不污染 UI） */
  displayContent: string;
}

export function buildCopyGuidanceTrigger(kind: CopyGuidanceTriggerKind): CopyGuidanceTrigger {
  if (kind === 'start') {
    return {
      kind,
      scene: 'copy_project_guidance',
      message:
        '我想开始这个复制项目的任务引导。请先读取 Skill 状态和当前项目代码，再只给我第一项任务、它的完成条件和一个下一步动作。',
      displayContent: '开始任务引导',
    };
  }
  return {
    kind,
    scene: 'copy_project_guidance',
    message:
      '请继续这个复制项目的任务引导。请先读取 Skill 状态和当前项目代码，结合当前任务进度，告诉我接下来这一项任务和它的完成条件。',
    displayContent: '继续任务引导',
  };
}
